"use client";

import { hasPermission, ROLE_LABELS } from "./roles";
import { useCurrentRole } from "./use-current-role";

/**
 * Permission action vocabulary.
 *
 * Initial set co-designed with Person D (Extensions & Integrations) per
 * docs/memory/person-c/week-3.md § D3. D owns the canonical list — adding
 * an action here MUST be paired with a sentura-rbac mapping in
 * `src/lib/auth/roles.ts` (otherwise the matrix returns `allowed: false`
 * for the new action and the UI silently denies).
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
   * True while the underlying lookup is in flight. The current implementation
   * (client-side role lookup) is synchronous, but consumers MUST handle the
   * loading branch so a future server-side lookup is a drop-in.
   */
  loading: boolean;
}

/**
 * Check whether the current user may perform `action` in the optional `ctx`.
 *
 * **Week 5 implementation:** reads the current role from `useCurrentRole()`
 * and looks up `action` in the `ROLE_PERMISSIONS` matrix
 * (`src/lib/auth/roles.ts`). Resource-level scoping (dept-only, own-only) is
 * still backend-enforced; this client-side gate hides UI but doesn't
 * authorize — server is the source of truth.
 *
 * **Adoption rule:** any UI action that mutates server state (button click,
 * form submit, link to a mutation page) MUST be gated by usePermission. Per
 * Week 5 D1: hard-hide enforcement — render `null` (not a disabled button)
 * when `allowed: false` so the action surface disappears entirely from the
 * unauthorized user's view.
 */
export function usePermission(
  action: PermissionAction,
  ctx?: PermissionContext,
): PermissionResult {
  const { role } = useCurrentRole();
  void ctx; // resource-level scoping deferred to backend authorization

  const allowed = hasPermission(role, action);
  return {
    allowed,
    loading: false,
    reason: allowed
      ? undefined
      : `${ROLE_LABELS[role]} role does not have permission for ${action}`,
  };
}
