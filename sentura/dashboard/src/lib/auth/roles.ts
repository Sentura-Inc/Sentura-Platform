/**
 * Sentura 7-role RBAC matrix.
 *
 * Source of truth for role → permission mapping on the dashboard. Mirrors
 * `sentura/extensions/sentura-rbac/DESIGN.md` § 2 (roles) + § 4 (method
 * permissions). When the real `sentura-rbac` extension RPC ships (Person D
 * Week 5 / W6), `usePermission` will swap to a server-side lookup; this
 * matrix becomes the dashboard-side fallback / cache shape.
 *
 * Roles per README §15 + DESIGN.md:
 *   platform_admin → full access (no restrictions)
 *   manager        → dept-scoped supervision (approves, views dept agents/sessions)
 *   ekg_manager    → SME-wide knowledge graph + MCP catalog control
 *   agent_manager  → creates/tunes owned agents
 *   auditor        → read-only access to logs, sessions, agents
 *   end_user       → interacts via channels; sees own sessions / approvals only
 *   viewer         → read-only aggregate dashboards
 */

import type { PermissionAction } from "./use-permission";

export const ROLES = [
  "platform_admin",
  "manager",
  "ekg_manager",
  "agent_manager",
  "auditor",
  "end_user",
  "viewer",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform Admin",
  manager: "Manager",
  ekg_manager: "EKG Manager",
  agent_manager: "Agent Manager",
  auditor: "Auditor",
  end_user: "End User",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  platform_admin: "Full platform access — creates/deletes employees, configures policies, sees everything.",
  manager: "Department-scoped supervision — approves decisions, views dept sessions and traces.",
  ekg_manager: "SME-wide knowledge graph + MCP catalog — triggers MCP Builder, manages ontologies.",
  agent_manager: "Creates and tunes owned AI employees — configures skills, rules, and tools.",
  auditor: "Read-only access to audit logs, compliance reports, and trace data.",
  end_user: "Channel user — sees own sessions and approvals only.",
  viewer: "Read-only aggregate dashboards for executives and stakeholders.",
};

/**
 * The full role → action allow-list. Resource-level scoping (dept-only,
 * own-only) is NOT modeled here — that lands when sentura-rbac ships its
 * real lookup. Today the matrix represents "can the user perform this action
 * AT ALL anywhere in their scope". Specific resource gates (e.g. "can THIS
 * user delete THIS agent") are still subject to backend authorization.
 */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<PermissionAction>> = {
  platform_admin: new Set<PermissionAction>([
    "audit.read",
    "audit.export",
    "agents.create",
    "agents.delete",
    "agents.tune",
    "agents.read",
    "approvals.resolve",
    "settings.write",
    "ekg.read",
    "ekg.write",
    "sessions.read",
  ]),
  manager: new Set<PermissionAction>([
    "audit.read",
    "agents.read",
    "agents.tune",
    "approvals.resolve",
    "ekg.read",
    "sessions.read",
  ]),
  ekg_manager: new Set<PermissionAction>([
    "audit.read",
    "agents.read",
    "ekg.read",
    "ekg.write",
    "sessions.read",
  ]),
  agent_manager: new Set<PermissionAction>([
    "agents.create",
    "agents.tune",
    "agents.read",
    "approvals.resolve",
    "ekg.read",
    "ekg.write",
    "sessions.read",
  ]),
  auditor: new Set<PermissionAction>([
    "audit.read",
    "audit.export",
    "agents.read",
    "ekg.read",
    "sessions.read",
  ]),
  end_user: new Set<PermissionAction>([
    "approvals.resolve",
    "sessions.read",
  ]),
  viewer: new Set<PermissionAction>([
    "audit.read",
    "agents.read",
  ]),
};

/**
 * Default role used when no `?as=<role>` URL param is set. Today's dashboard
 * is single-tenant local-dev — `platform_admin` keeps the experience open.
 * When SSO ships (W6+), this default disappears in favor of the SSO-asserted
 * role.
 */
export const DEFAULT_DEV_ROLE: Role = "platform_admin";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: Role, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role].has(action);
}
