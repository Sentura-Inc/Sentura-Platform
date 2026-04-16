import { getRoleDefinition } from "./roles.js";
import { RbacStore } from "./store.js";
import type { AuthorizationResult, PermissionScope, SenturaRole, SenturaUser } from "./types.js";

type MethodAction = "read" | "write" | "create" | "update" | "delete" | "resolve" | "configure" | "export" | "query";

interface MethodPolicy {
  resource: string;
  action: MethodAction;
}

const METHOD_POLICIES: Record<string, MethodPolicy> = {
  "config.get": { resource: "config", action: "read" },
  "config.set": { resource: "config", action: "write" },
  "config.apply": { resource: "config", action: "write" },
  "config.patch": { resource: "config", action: "write" },
  "config.schema": { resource: "config", action: "read" },
  "config.schema.lookup": { resource: "config", action: "read" },

  "agents.list": { resource: "agents", action: "read" },
  "agents.create": { resource: "agents", action: "create" },
  "agents.update": { resource: "agents", action: "update" },
  "agents.delete": { resource: "agents", action: "delete" },
  "agents.files.list": { resource: "agents", action: "read" },
  "agents.files.get": { resource: "agents", action: "read" },
  "agents.files.set": { resource: "agents", action: "write" },

  "sessions.list": { resource: "sessions", action: "read" },
  "sessions.preview": { resource: "sessions", action: "read" },
  "sessions.subscribe": { resource: "sessions", action: "read" },
  "sessions.unsubscribe": { resource: "sessions", action: "read" },
  "sessions.create": { resource: "sessions", action: "create" },
  "sessions.send": { resource: "sessions", action: "write" },
  "sessions.abort": { resource: "sessions", action: "write" },
  "sessions.patch": { resource: "sessions", action: "write" },
  "sessions.reset": { resource: "sessions", action: "delete" },
  "sessions.delete": { resource: "sessions", action: "delete" },
  "sessions.compact": { resource: "sessions", action: "write" },

  "cron.list": { resource: "cron", action: "read" },
  "cron.status": { resource: "cron", action: "read" },
  "cron.add": { resource: "cron", action: "create" },
  "cron.update": { resource: "cron", action: "write" },
  "cron.remove": { resource: "cron", action: "delete" },
  "cron.run": { resource: "cron", action: "write" },
  "cron.runs": { resource: "cron", action: "read" },

  "exec.approval.get": { resource: "approvals", action: "read" },
  "exec.approval.request": { resource: "approvals", action: "write" },
  "exec.approval.resolve": { resource: "approvals", action: "resolve" },
  "exec.approvals.get": { resource: "approvals", action: "read" },
  "exec.approvals.set": { resource: "approvals", action: "configure" },
  "plugin.approval.request": { resource: "approvals", action: "write" },
  "plugin.approval.resolve": { resource: "approvals", action: "resolve" },

  "secrets.reload": { resource: "secrets", action: "write" },
  "secrets.resolve": { resource: "secrets", action: "read" },

  "skills.status": { resource: "skills", action: "read" },
  "skills.search": { resource: "skills", action: "read" },
  "skills.detail": { resource: "skills", action: "read" },
  "skills.install": { resource: "skills", action: "write" },
  "skills.update": { resource: "skills", action: "write" },

  "models.list": { resource: "skills", action: "read" },
  "tools.catalog": { resource: "skills", action: "read" },
  "tools.effective": { resource: "skills", action: "read" },

  // Sentura extension methods
  "sentura.audit.query": { resource: "audit", action: "query" },
  "sentura.audit.stats": { resource: "audit", action: "read" },
  "sentura.rbac.roles.list": { resource: "users", action: "read" },
  "sentura.rbac.users.list": { resource: "users", action: "read" },
  "sentura.rbac.users.get": { resource: "users", action: "read" },
  "sentura.rbac.users.create": { resource: "users", action: "create" },
  "sentura.rbac.users.update": { resource: "users", action: "write" },
  "sentura.rbac.users.delete": { resource: "users", action: "delete" },
  "sentura.rbac.users.assign": { resource: "users", action: "write" },
  "sentura.rbac.departments.list": { resource: "departments", action: "read" },
  "sentura.rbac.departments.create": { resource: "departments", action: "create" },
  "sentura.rbac.departments.update": { resource: "departments", action: "write" },
  "sentura.rbac.departments.delete": { resource: "departments", action: "delete" },
  "sentura.rbac.policies.get": { resource: "approvals", action: "read" },
  "sentura.rbac.policies.set": { resource: "approvals", action: "configure" },
  "sentura.ekg.browse": { resource: "ekg", action: "read" },
  "sentura.ekg.upload": { resource: "ekg", action: "write" },
  "sentura.ekg.delete": { resource: "ekg", action: "delete" },
  "sentura.mcp.list": { resource: "mcp", action: "read" },
  "sentura.mcp.build": { resource: "mcp", action: "create" },
  "sentura.mcp.configure": { resource: "mcp", action: "write" },
};

export class Authorizer {
  constructor(private store: RbacStore) {}

  async authorize(
    userId: string,
    method: string,
  ): Promise<AuthorizationResult> {
    const user = await this.store.getUser(userId);
    if (!user) {
      return { allowed: false, reason: "User not found in RBAC store" };
    }

    const roleDef = getRoleDefinition(user.role);
    if (!roleDef) {
      return { allowed: false, reason: `Unknown role: ${user.role}` };
    }

    if (user.role === "platform_admin") {
      return { allowed: true, filteredScope: "all" };
    }

    const policy = METHOD_POLICIES[method];
    if (!policy) {
      if (user.role === "manager" || user.role === "ekg_manager") {
        return { allowed: true, filteredScope: "department" };
      }
      return { allowed: false, reason: `Method ${method} has no RBAC policy` };
    }

    const matchingPermission = roleDef.permissions.find(
      (p) => p.resource === policy.resource && p.actions.includes(policy.action),
    );

    if (!matchingPermission) {
      return {
        allowed: false,
        reason: `Role ${user.role} lacks ${policy.action} permission on ${policy.resource}`,
      };
    }

    return {
      allowed: true,
      filteredScope: matchingPermission.scope,
    };
  }

  async resolveVisibleEmployeeIds(userId: string): Promise<string[] | "all"> {
    return this.store.getEmployeeIdsVisibleToUser(userId);
  }

  async resolveEffectiveScope(userId: string, method: string): Promise<PermissionScope> {
    const result = await this.authorize(userId, method);
    return result.filteredScope ?? "self";
  }

  resolveRoleFromUser(user: SenturaUser): SenturaRole {
    return user.role;
  }
}
