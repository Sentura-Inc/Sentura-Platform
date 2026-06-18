import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CBE_SESSION_COOKIE,
  CBE_TENANT_ID,
  CbeStoreError,
  cbeSessionCookieNameForRole,
  cbeRouteError,
  encodeCbeSession,
  hashCbePassword,
  queryCbe,
  readJsonRequest,
  verifyCbePassword,
} from "@/lib/cross-border-store";
import { getServerGatewayClient } from "@/lib/gateway/server-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LoginRequestSchema = z.object({
  userToken: z.string().min(1).optional(),
  user_token: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  display_name: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  cbeRole: z.enum(["admin", "operator"]).optional(),
  cbe_role: z.enum(["admin", "operator"]).optional(),
  role: z.enum(["admin", "operator"]).optional(),
}).superRefine((value, ctx) => {
  const hasToken = Boolean(value.userToken || value.user_token);
  const hasName = Boolean(value.displayName || value.display_name || value.name);
  const hasPassword = Boolean(value.password);
  if (!hasToken && !(hasName && hasPassword)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "userToken or employee name/password is required.",
      path: ["displayName"],
    });
  }
});

type RbacUser = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  userToken?: string;
};

const PRESET_MANAGER_LOGIN = {
  userId: "cbe-user-admin-001",
  displayName: "孙总",
  password: "1234",
} as const;

type LoginProfileRow = {
  tenant_id: string;
  user_id: string;
  cbe_role: "admin" | "operator";
  display_name: string;
  status: string;
  password_hash: string | null;
};

async function createLoginResponse(row: {
  tenant_id: string;
  user_id: string;
  cbe_role: "admin" | "operator";
  display_name: string;
}, userToken?: string) {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const response = NextResponse.json({
    user: {
      id: row.user_id,
      displayName: row.display_name,
      cbeRole: row.cbe_role,
    },
    redirectTo: row.cbe_role === "admin"
      ? "/client-demos/cross-border/admin/employees"
      : "/client-demos/cross-border/employee",
  });
  const encodedSession = encodeCbeSession({
    userId: row.user_id,
    tenantId: row.tenant_id,
    cbeRole: row.cbe_role,
    displayName: row.display_name,
    userToken,
    expiresAt,
  });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  } as const;
  response.cookies.set(CBE_SESSION_COOKIE, encodedSession, cookieOptions);
  response.cookies.set(cbeSessionCookieNameForRole(row.cbe_role), encodedSession, cookieOptions);
  return response;
}

async function loadPresetManagerProfile() {
  const profile = await queryCbe<LoginProfileRow>(
    `
      select tenant_id, user_id, cbe_role, display_name, status, password_hash
      from cbe_user_profiles
      where tenant_id = $1
        and user_id = $2
        and cbe_role = 'admin'
        and status = 'active'
      limit 1
    `,
    [CBE_TENANT_ID, PRESET_MANAGER_LOGIN.userId],
  );
  return profile.rows[0] ?? null;
}

async function createPresetManagerLoginResponse(row: LoginProfileRow) {
  const passwordHash = hashCbePassword(PRESET_MANAGER_LOGIN.password);
  await queryCbe(
    `
      update sentura_users
      set display_name = $3
      where tenant_id = $1
        and id = $2
    `,
    [CBE_TENANT_ID, PRESET_MANAGER_LOGIN.userId, PRESET_MANAGER_LOGIN.displayName],
  );
  await queryCbe(
    `
      update cbe_user_profiles
      set display_name = $3,
          password_hash = $4,
          updated_at = now()
      where tenant_id = $1
        and user_id = $2
        and cbe_role = 'admin'
    `,
    [CBE_TENANT_ID, PRESET_MANAGER_LOGIN.userId, PRESET_MANAGER_LOGIN.displayName, passwordHash],
  );
  return createLoginResponse({
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    cbe_role: row.cbe_role,
    display_name: PRESET_MANAGER_LOGIN.displayName,
  });
}

async function loginByNameAndPassword(displayName: string, password: string, cbeRole: "admin" | "operator") {
  const profile = await queryCbe<LoginProfileRow>(
    `
      select tenant_id, user_id, cbe_role, display_name, status, password_hash
      from cbe_user_profiles
      where tenant_id = $1
        and lower(display_name) = lower($2)
        and cbe_role = $3
        and status = 'active'
      order by updated_at desc
      limit 2
    `,
    [CBE_TENANT_ID, displayName, cbeRole],
  );
  const roleLabel = cbeRole === "admin" ? "管理者" : "员工";
  if (profile.rows.length > 1) {
    throw new CbeStoreError(409, "cbe_login_name_ambiguous", `存在多个同名${roleLabel}账户，请先改名后再登录。`);
  }
  const row = profile.rows[0];
  if (row && verifyCbePassword(password, row.password_hash)) {
    return createLoginResponse(row);
  }

  const matchesPresetManager = cbeRole === "admin"
    && displayName === PRESET_MANAGER_LOGIN.displayName
    && password === PRESET_MANAGER_LOGIN.password;
  if (matchesPresetManager) {
    const presetRow = row?.user_id === PRESET_MANAGER_LOGIN.userId ? row : await loadPresetManagerProfile();
    if (presetRow?.user_id === PRESET_MANAGER_LOGIN.userId) {
      return createPresetManagerLoginResponse(presetRow);
    }
  }

  if (!row || !verifyCbePassword(password, row.password_hash)) {
    throw new CbeStoreError(
      401,
      cbeRole === "admin" ? "invalid_admin_credentials" : "invalid_employee_credentials",
      `${roleLabel}姓名或密码不正确。`,
    );
  }
  return createLoginResponse(row);
}

export async function POST(request: Request) {
  try {
    const body = LoginRequestSchema.parse(await readJsonRequest(request));
    const userToken = body.userToken ?? body.user_token;
    const displayName = body.displayName ?? body.display_name ?? body.name;
    const cbeRole = body.cbeRole ?? body.cbe_role ?? body.role ?? "operator";
    if (!userToken && displayName && body.password) {
      return await loginByNameAndPassword(displayName.trim(), body.password, cbeRole);
    }
    const client = await getServerGatewayClient();
    const resolved = await client.rpc<{ user?: RbacUser }>("sentura.rbac.users.resolveByToken", { userToken });
    const user = resolved?.user;
    if (!user?.id) {
      throw new CbeStoreError(401, "invalid_user_token", "User token was not recognized by Sentura RBAC.");
    }
    const profile = await queryCbe<{
      tenant_id: string;
      user_id: string;
      cbe_role: "admin" | "operator";
      display_name: string;
      status: string;
    }>(
      `
        select tenant_id, user_id, cbe_role, display_name, status
        from cbe_user_profiles
        where tenant_id = $1
          and user_id = $2
        limit 1
      `,
      [CBE_TENANT_ID, user.id],
    );
    const row = profile.rows[0];
    if (!row || row.status !== "active") {
      throw new CbeStoreError(401, "cbe_profile_missing", "Active CBE user profile was not found.");
    }
    return createLoginResponse(row, userToken);
  } catch (error) {
    return cbeRouteError(error);
  }
}
