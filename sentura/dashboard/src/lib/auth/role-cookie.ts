/**
 * Role cookie helpers (client-side write).
 *
 * The dev role is mirrored to a cookie alongside localStorage so:
 *   1. Server components can read the role for SSR (no hydration flash).
 *   2. Server API routes can authoritatively check the caller's role.
 *
 * In production (post-SSO), this cookie is replaced by the SSO session cookie.
 * The shape of `getServerRole(req)` stays the same.
 *
 * Security note: this cookie is NOT a secret. It tells the dashboard which
 * role-scoped UI to render and which API routes to allow. The OpenClaw
 * gateway is the actual auth boundary (bearer token); a tampered cookie can
 * only forge dashboard-side state. Once SSO ships, the cookie becomes
 * HttpOnly + signed.
 */
import { isRole, type Role } from "./roles";

export const ROLE_COOKIE = "sentura_dev_role";
const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

export function writeRoleCookie(role: Role): void {
  if (typeof document === "undefined") return;
  // SameSite=Lax mitigates basic CSRF while still allowing top-level nav
  // with `?as=<role>` to work across tabs.
  document.cookie = [
    `${ROLE_COOKIE}=${encodeURIComponent(role)}`,
    "Path=/",
    `Max-Age=${ONE_MONTH_SECONDS}`,
    "SameSite=Lax",
  ].join("; ");
}

export function readRoleCookieFromString(cookieHeader: string | null | undefined): Role | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq) !== ROLE_COOKIE) continue;
    const raw = decodeURIComponent(part.slice(eq + 1));
    return isRole(raw) ? raw : null;
  }
  return null;
}
