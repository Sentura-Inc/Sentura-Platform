"use client";

/**
 * Permission action vocabulary.
 *
 * Initial set co-designed with Person D (Extensions & Integrations) per
 * docs/memory/person-c/week-3.md § D3. D owns the canonical list — adding
 * an action here MUST be paired with a sentura-rbac mapping in Week 5
 * (otherwise the real impl will return `allowed: false` for the new action
 * and block the UI silently).
 */
export type PermissionAction =
  | "audit.read"
  | "audit.export"
  | "agents.create"
  | "agents.delete"
  | "agents.tune"
  | "agents.read"
  | "approvals.resolve"
  | "settings.write"
  | "ekg.read"
  | "ekg.write"
  | "sessions.read";

export type PermissionScope = "sme" | { dept: string };

export interface PermissionContext {
  scope?: PermissionScope;
}

export interface PermissionResult {
  /** True if the current user may perform `action` in `ctx`. */
  allowed: boolean;
  /** Human-readable reason when denied. Stable enough to render in a tooltip. */
  reason?: string;
  /**
   * True while the underlying lookup is in flight. The Week 3 stub never
   * sets this — but consumers MUST still handle the loading branch so
   * Week 5's real implementation is a drop-in (no caller-side refactor).
   */
  loading: boolean;
}

/**
 * Check whether the current user may perform `action` in the optional `ctx`.
 *
 * **Week 3 stub.** Returns `{ allowed: true, loading: false }` unconditionally.
 * Wired into all surfaces day-1 so Person D's Week 5 `sentura-rbac` frontend
 * lookup drops in with zero caller-side refactor.
 *
 * **Adoption rule:** any UI action that mutates server state (button click,
 * form submit, link to a mutation page) MUST be gated by usePermission, even
 * while the stub always returns true. Read-only views can call usePermission
 * with the corresponding `.read` action when the page itself should hide from
 * unauthorized users — that gating activates in Week 5.
 */
export function usePermission(
  action: PermissionAction,
  ctx?: PermissionContext,
): PermissionResult {
  // TODO(person-d, week-5): swap in real sentura-rbac lookup.
  // Reference: docs/TeamPlan.md § Week 5 → Person D → "Frontend RBAC hooks"
  void action;
  void ctx;
  return { allowed: true, loading: false };
}
