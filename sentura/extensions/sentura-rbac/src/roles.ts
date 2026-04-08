import type { RoleDefinition } from "./types.js";

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    id: "platform_admin",
    name: "Platform Admin",
    description: "Full platform access — creates/deletes employees, manages providers, configures approval policies, views all traces",
    operatorScopes: [
      "operator.admin",
      "operator.read",
      "operator.write",
      "operator.approvals",
      "operator.pairing",
      "operator.talk.secrets",
    ],
    permissions: [
      { resource: "agents", actions: ["read", "create", "update", "delete"], scope: "all" },
      { resource: "sessions", actions: ["read", "create", "send", "abort", "delete"], scope: "all" },
      { resource: "config", actions: ["read", "write"], scope: "all" },
      { resource: "audit", actions: ["read", "query", "export"], scope: "all" },
      { resource: "secrets", actions: ["read", "write", "reload"], scope: "all" },
      { resource: "skills", actions: ["read", "install", "update"], scope: "all" },
      { resource: "cron", actions: ["read", "create", "update", "delete", "run"], scope: "all" },
      { resource: "approvals", actions: ["read", "resolve", "configure"], scope: "all" },
      { resource: "users", actions: ["read", "create", "update", "delete"], scope: "all" },
      { resource: "departments", actions: ["read", "create", "update", "delete"], scope: "all" },
    ],
    dataTierAccess: ["T0", "T1", "T2", "T3", "T4"],
  },
  {
    id: "dept_admin",
    name: "Department Admin",
    description: "Manages employees within their assigned department(s) — can create employees, view department traces, configure department-level approval policies",
    operatorScopes: [
      "operator.read",
      "operator.write",
      "operator.approvals",
    ],
    permissions: [
      { resource: "agents", actions: ["read", "create", "update", "delete"], scope: "department" },
      { resource: "sessions", actions: ["read", "create", "send", "abort"], scope: "department" },
      { resource: "config", actions: ["read", "write"], scope: "department" },
      { resource: "audit", actions: ["read", "query"], scope: "department" },
      { resource: "skills", actions: ["read"], scope: "all" },
      { resource: "cron", actions: ["read", "create", "update", "delete", "run"], scope: "department" },
      { resource: "approvals", actions: ["read", "resolve"], scope: "department" },
      { resource: "users", actions: ["read"], scope: "department" },
      { resource: "departments", actions: ["read"], scope: "department" },
    ],
    dataTierAccess: ["T0", "T1", "T2"],
  },
  {
    id: "employee_owner",
    name: "Employee Owner",
    description: "Configures and tunes their assigned AI employees — can view sessions, modify skills and config for owned employees only",
    operatorScopes: [
      "operator.read",
      "operator.write",
    ],
    permissions: [
      { resource: "agents", actions: ["read", "update"], scope: "owned" },
      { resource: "sessions", actions: ["read", "create", "send", "abort"], scope: "owned" },
      { resource: "config", actions: ["read", "write"], scope: "owned" },
      { resource: "skills", actions: ["read"], scope: "all" },
      { resource: "cron", actions: ["read", "create", "update"], scope: "owned" },
      { resource: "approvals", actions: ["read", "resolve"], scope: "owned" },
    ],
    dataTierAccess: ["T0", "T1"],
  },
  {
    id: "auditor",
    name: "Auditor",
    description: "Read-only access to audit logs, compliance reports, and trace data — cannot modify anything",
    operatorScopes: [
      "operator.read",
    ],
    permissions: [
      { resource: "agents", actions: ["read"], scope: "all" },
      { resource: "sessions", actions: ["read"], scope: "all" },
      { resource: "config", actions: ["read"], scope: "all" },
      { resource: "audit", actions: ["read", "query", "export"], scope: "all" },
      { resource: "skills", actions: ["read"], scope: "all" },
      { resource: "cron", actions: ["read"], scope: "all" },
      { resource: "approvals", actions: ["read"], scope: "all" },
      { resource: "users", actions: ["read"], scope: "all" },
      { resource: "departments", actions: ["read"], scope: "all" },
    ],
    dataTierAccess: ["T0", "T1", "T2"],
  },
  {
    id: "end_user",
    name: "End User",
    description: "Interacts with AI employees via channels — can trigger approval requests and view their own sessions",
    operatorScopes: [
      "operator.read",
    ],
    permissions: [
      { resource: "sessions", actions: ["read"], scope: "self" },
      { resource: "approvals", actions: ["read", "resolve"], scope: "self" },
    ],
    dataTierAccess: ["T0"],
  },
];

const ROLE_MAP = new Map(ROLE_DEFINITIONS.map((r) => [r.id, r]));

export function getRoleDefinition(role: string): RoleDefinition | undefined {
  return ROLE_MAP.get(role as RoleDefinition["id"]);
}

export function getOperatorScopesForRole(role: string): readonly string[] {
  return getRoleDefinition(role)?.operatorScopes ?? [];
}
