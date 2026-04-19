import crypto from "node:crypto";
import path from "node:path";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import { Authorizer } from "./src/authorizer.js";
import { ROLE_DEFINITIONS, getOperatorScopesForRole } from "./src/roles.js";
import { RbacStore } from "./src/store.js";
import type { RbacConfig, SenturaRole, SenturaUser } from "./src/types.js";

function resolveConfig(pluginConfig: Record<string, unknown>): RbacConfig {
  const raw = pluginConfig as Partial<RbacConfig>;
  return {
    dataDir: raw.dataDir ?? path.join(resolveOpenClawDir(), "sentura-rbac"),
    defaultRole: raw.defaultRole ?? "end_user",
    enforceOnPluginMethods: raw.enforceOnPluginMethods ?? true,
  };
}

export default definePluginEntry({
  id: "sentura-rbac",
  name: "Sentura RBAC",
  description: "Enterprise role-based access control with seven-role permission model and user token identity.",
  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig ?? {});
    const store = new RbacStore(config.dataDir);
    const authorizer = new Authorizer(store);

    store.initialize().catch((err) => {
      api.logger.error("[sentura-rbac] Failed to initialize RBAC store:", err);
    });

    // --- Gateway RPC: List role definitions ---
    api.registerGatewayMethod("sentura.rbac.roles.list", async ({ respond }) => {
      respond(true, { roles: ROLE_DEFINITIONS });
    });

    // --- Gateway RPC: List users ---
    api.registerGatewayMethod("sentura.rbac.users.list", async ({ params, respond }) => {
      try {
        const departmentId = params?.departmentId as string | undefined;
        const users = departmentId
          ? await store.listUsersByDepartment(departmentId)
          : await store.listUsers();
        respond(true, { users, count: users.length });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Gateway RPC: Get user ---
    api.registerGatewayMethod("sentura.rbac.users.get", async ({ params, respond }) => {
      try {
        const userId = params?.userId as string;
        const user = await store.getUser(userId);
        respond(true, user ? { user } : { user: null });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Gateway RPC: Assign role ---
    api.registerGatewayMethod("sentura.rbac.users.assign", async ({ params, respond }) => {
      try {
        const userId = params?.userId as string;
        const role = params?.role as SenturaRole;
        if (!userId || !role) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "userId and role are required" });
          return;
        }
        const success = await store.assignRole(userId, role);
        if (success) {
          respond(true, { success: true, operatorScopes: getOperatorScopesForRole(role) });
        } else {
          respond(false, undefined, { code: "NOT_FOUND", message: "User not found" });
        }
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Gateway RPC: Upsert user (auto-assigns userToken on creation) ---
    api.registerGatewayMethod("sentura.rbac.users.upsert", async ({ params, respond }) => {
      try {
        const userData = params as unknown as Partial<SenturaUser>;
        if (!userData?.id || !userData?.email) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "id and email are required" });
          return;
        }
        const now = new Date().toISOString();
        const existing = await store.getUser(userData.id);
        const user: SenturaUser = {
          id: userData.id,
          email: userData.email,
          name: userData.name ?? userData.email,
          role: userData.role ?? existing?.role ?? config.defaultRole,
          userToken: existing?.userToken ?? crypto.randomUUID(),
          departmentIds: userData.departmentIds ?? existing?.departmentIds ?? [],
          ownedEmployeeIds: userData.ownedEmployeeIds ?? existing?.ownedEmployeeIds ?? [],
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          metadata: userData.metadata ?? existing?.metadata ?? {},
        };
        await store.upsertUser(user);
        respond(true, { user });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Gateway RPC: Resolve user by token (for WebSocket auth) ---
    api.registerGatewayMethod("sentura.rbac.users.resolveByToken", async ({ params, respond }) => {
      try {
        const userToken = params?.userToken as string;
        if (!userToken) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "userToken required" });
          return;
        }
        const user = await store.getUserByToken(userToken);
        if (user) {
          respond(true, { user });
        } else {
          respond(false, undefined, { code: "NOT_FOUND", message: "User not found for token" });
        }
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Gateway RPC: List departments ---
    api.registerGatewayMethod("sentura.rbac.departments.list", async ({ respond }) => {
      try {
        const departments = await store.listDepartments();
        respond(true, { departments, count: departments.length });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Gateway RPC: Authorize check (for dashboard pre-flight) ---
    api.registerGatewayMethod("sentura.rbac.authorize", async ({ params, respond }) => {
      try {
        const userId = params?.userId as string;
        const method = params?.method as string;
        if (!userId || !method) {
          respond(true, { allowed: false, reason: "userId and method are required" });
          return;
        }
        const result = await authorizer.authorize(userId, method);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Gateway RPC: Resolve visible employees for a user ---
    api.registerGatewayMethod("sentura.rbac.scope.employees", async ({ params, respond }) => {
      try {
        const userId = params?.userId as string;
        if (!userId) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "userId required" });
          return;
        }
        const ids = await authorizer.resolveVisibleEmployeeIds(userId);
        respond(true, { employeeIds: ids });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Register the agent-facing tool ---
    api.registerTool(
      {
        name: "sentura_rbac_manage",
        description:
          "Query Sentura RBAC data: list roles, users, departments, or check authorization for a given user and method.",
        parameters: {
          type: "object" as const,
          properties: {
            action: {
              type: "string",
              enum: ["list_roles", "list_users", "get_user", "check_auth", "list_departments"],
              description: "The RBAC action to perform",
            },
            userId: {
              type: "string",
              description: "User ID (for get_user and check_auth actions)",
            },
            method: {
              type: "string",
              description: "Gateway method name (for check_auth action)",
            },
            departmentId: {
              type: "string",
              description: "Filter users by department ID (for list_users action)",
            },
          },
          required: ["action"],
        },
        async execute(args: Record<string, unknown>) {
          const action = args.action as string;
          switch (action) {
            case "list_roles":
              return JSON.stringify(ROLE_DEFINITIONS, null, 2);
            case "list_users": {
              const deptId = args.departmentId as string | undefined;
              const users = deptId
                ? await store.listUsersByDepartment(deptId)
                : await store.listUsers();
              return JSON.stringify({ users, count: users.length }, null, 2);
            }
            case "get_user": {
              const user = await store.getUser(args.userId as string);
              return user ? JSON.stringify(user, null, 2) : "User not found";
            }
            case "check_auth": {
              const result = await authorizer.authorize(
                args.userId as string,
                args.method as string,
              );
              return JSON.stringify(result, null, 2);
            }
            case "list_departments": {
              const depts = await store.listDepartments();
              return JSON.stringify({ departments: depts, count: depts.length }, null, 2);
            }
            default:
              return `Unknown action: ${action}`;
          }
        },
      } as Parameters<typeof api.registerTool>[0],
      { name: "sentura_rbac_manage" },
    );

    api.logger.info("[sentura-rbac] Extension registered. Data dir:", config.dataDir);
  },
});
