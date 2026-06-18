import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const CBE_SESSION_COOKIE = "sentura_cbe_session";
export const CBE_EMPLOYEE_SESSION_COOKIE = "sentura_cbe_employee_session";
export const CBE_ADMIN_SESSION_COOKIE = "sentura_cbe_admin_session";
export const CBE_SESSION_COOKIES = [
  CBE_SESSION_COOKIE,
  CBE_EMPLOYEE_SESSION_COOKIE,
  CBE_ADMIN_SESSION_COOKIE,
] as const;

export type CbeSessionRole = "admin" | "operator";

export interface CbeSessionPayload {
  userId: string;
  tenantId: string;
  cbeRole: CbeSessionRole;
  displayName: string;
  userToken?: string;
  expiresAt: number;
}

function sessionSecret() {
  return (
    process.env.SENTURA_CBE_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.GATEWAY_TOKEN ||
    "sentura-cbe-local-session-secret"
  );
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function safeBufferEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) continue;
    cookies.set(rawKey, decodeURIComponent(rawValue.join("=")));
  }
  return cookies;
}

export function encodeCbeSession(payload: CbeSessionPayload) {
  const encoded = base64UrlJson(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function decodeCbeSession(value: string | undefined | null): CbeSessionPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<CbeSessionPayload>;
    if (!payload.userId || !payload.tenantId || !payload.cbeRole || !payload.displayName || !payload.expiresAt) {
      return null;
    }
    if (payload.expiresAt < Date.now()) return null;
    return payload as CbeSessionPayload;
  } catch {
    return null;
  }
}

export function cbeSessionCookieNameForRole(role: CbeSessionRole) {
  return role === "admin" ? CBE_ADMIN_SESSION_COOKIE : CBE_EMPLOYEE_SESSION_COOKIE;
}

function sessionCookieCandidates(expectedRole?: CbeSessionRole) {
  if (expectedRole) {
    return [cbeSessionCookieNameForRole(expectedRole), CBE_SESSION_COOKIE];
  }
  return [CBE_SESSION_COOKIE, CBE_ADMIN_SESSION_COOKIE, CBE_EMPLOYEE_SESSION_COOKIE];
}

export function cbeSessionFromRequest(request: Request, expectedRole?: CbeSessionRole) {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  for (const cookieName of sessionCookieCandidates(expectedRole)) {
    const session = decodeCbeSession(cookies.get(cookieName));
    if (session && (!expectedRole || session.cbeRole === expectedRole)) {
      return session;
    }
  }
  return null;
}

export function hashCbePassword(password: string) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyCbePassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [algorithm, saltValue, keyValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !keyValue) return false;
  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(keyValue, "base64url");
    const actual = scryptSync(password, salt, expected.length);
    return safeBufferEqual(actual, expected);
  } catch {
    return false;
  }
}
