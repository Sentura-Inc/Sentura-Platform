/**
 * Server-side role helpers.
 *
 * Use these from server components (root layout) and API route handlers.
 * For dev mode the role comes from the `sentura_dev_role` cookie (see
 * role-cookie.ts). For SSO mode (post-W6) this resolves to the session's
 * asserted role.
 *
 * Auth model recap (W5):
 *   - `usePermission` and `<RequirePermission>` are CLIENT hints — UI shaping.
 *   - `getServerRole(req)` + `assertServerPermission` are the SERVER gate
 *     for dashboard-owned API routes (`/api/groups/*`, etc.).
 *   - The OpenClaw gateway is the ultimate auth boundary; once SSO lands,
 *     server routes will forward the SSO-asserted actorId to the gateway
 *     instead of impersonating platform_admin via a shared bearer token.
 */
import { cookies } from "next/headers";
import { DEFAULT_DEV_ROLE, hasPermission, isRole, type Role } from "./roles";
import type { PermissionAction } from "./use-permission";
import { readRoleCookieFromString, ROLE_COOKIE } from "./role-cookie";

/**
 * For API route handlers — reads the role from the incoming Request cookie.
 */
export function getServerRole(request: Request): Role {
  const role = readRoleCookieFromString(request.headers.get("cookie"));
  return role ?? DEFAULT_DEV_ROLE;
}

/**
 * For server components / layouts — reads the role from `cookies()` (async
 * Next 16 API). Use this in `app/layout.tsx` to seed `RoleProvider`.
 */
export async function getServerRoleFromHeaders(): Promise<Role> {
  try {
    const store = await cookies();
    const value = store.get(ROLE_COOKIE)?.value;
    if (value && isRole(value)) return value;
  } catch {
    // cookies() throws outside a request scope (e.g. static optimization);
    // fall back to default — client mount effect will reconcile.
  }
  return DEFAULT_DEV_ROLE;
}

export interface ServerPermissionDenied {
  ok: false;
  status: 403;
  role: Role;
  action: PermissionAction;
}

/**
 * Returns null if allowed; returns a denial descriptor if not. Callers
 * decide the response shape (JSON vs SSE 4xx) based on their route style.
 */
export function checkServerPermission(
  request: Request,
  action: PermissionAction,
): ServerPermissionDenied | null {
  const role = getServerRole(request);
  if (hasPermission(role, action)) return null;
  return { ok: false, status: 403, role, action };
}
