import type { CbeDb } from "./db";
import { queryCbe } from "./db";
import { CbeStoreError } from "./errors";
import {
  CBE_ADMIN_API_BASE,
  CBE_EMPLOYEE_API_BASE,
  CBE_INTERNAL_ADMIN_API_BASE,
  CBE_INTERNAL_EMPLOYEE_API_BASE,
} from "../cross-border-routes";
import {
  CBE_TENANT_ID,
  TenantContextSchema,
  type TenantContext,
} from "./schemas";
import { cbeSessionFromRequest, type CbeSessionRole } from "./session";

interface ProfileRow {
  tenant_id: string;
  user_id: string;
  cbe_role: "admin" | "operator";
  display_name: string;
  team_name: string | null;
  department_id: string | null;
  status: string;
}

function expectedRoleFromPath(pathname: string): CbeSessionRole | undefined {
  if (pathname.includes(`${CBE_ADMIN_API_BASE}/`) || pathname.includes(`${CBE_INTERNAL_ADMIN_API_BASE}/`)) {
    return "admin";
  }
  if (pathname.includes(`${CBE_EMPLOYEE_API_BASE}/`) || pathname.includes(`${CBE_INTERNAL_EMPLOYEE_API_BASE}/`)) {
    return "operator";
  }
  return undefined;
}

export function userIdFromRequest(request: Request, expectedRole?: CbeSessionRole) {
  const pathname = new URL(request.url).pathname;
  const role = expectedRole ?? expectedRoleFromPath(pathname);
  const adminOverrideUserId = request.headers.get("x-cbe-admin-user-id")?.trim();
  const isAdminApiPath =
    pathname.includes(`${CBE_ADMIN_API_BASE}/`) || pathname.includes(`${CBE_INTERNAL_ADMIN_API_BASE}/`);
  if (adminOverrideUserId && role === "admin" && isAdminApiPath) {
    return adminOverrideUserId;
  }
  return (
    cbeSessionFromRequest(request, role)?.userId ||
    request.headers.get("x-cbe-user-id")?.trim() ||
    request.headers.get("x-sentura-user-id")?.trim() ||
    process.env.CBE_DEMO_USER_ID?.trim() ||
    null
  );
}

export async function resolveCbeTenantContext(
  request: Request,
  options: { expectedRole?: CbeSessionRole } = {},
): Promise<TenantContext> {
  const pathname = new URL(request.url).pathname;
  const expectedRole = options.expectedRole ?? expectedRoleFromPath(pathname);
  const userId = userIdFromRequest(request, expectedRole);
  if (!userId) {
    throw new CbeStoreError(401, "cbe_login_required", "CBE login is required.");
  }
  const result = await queryCbe<ProfileRow>(
    `
      select
        p.tenant_id,
        p.user_id,
        p.cbe_role,
        p.display_name,
        p.team_name,
        u.department_id,
        p.status
      from cbe_user_profiles p
      join sentura_users u
        on u.tenant_id = p.tenant_id
       and u.id = p.user_id
      where p.tenant_id = $1
        and p.user_id = $2
      limit 1
    `,
    [CBE_TENANT_ID, userId],
  );
  const row = result.rows[0];
  if (!row || row.status !== "active") {
    throw new CbeStoreError(401, "cbe_profile_missing", "Active CBE user profile was not found.");
  }
  if (expectedRole && row.cbe_role !== expectedRole) {
    throw new CbeStoreError(401, "cbe_role_mismatch", "CBE login role does not match this workspace.");
  }

  return TenantContextSchema.parse({
    tenantId: row.tenant_id,
    userId: row.user_id,
    cbeRole: row.cbe_role,
    displayName: row.display_name,
    teamName: row.team_name ?? undefined,
    departmentId: row.department_id ?? undefined,
    dataScope: row.cbe_role === "admin" ? "tenant_monitor" : "own_work",
  });
}

export function requireCbeAdmin(context: TenantContext) {
  if (context.cbeRole !== "admin") {
    throw new CbeStoreError(403, "cbe_admin_required", "CBE admin role is required for this endpoint.");
  }
}

export function scopedOwnerClause(
  context: TenantContext,
  alias: string,
  startIndex: number,
) {
  if (context.cbeRole === "admin") {
    return { sql: "", values: [] as unknown[] };
  }

  const prefix = alias ? `${alias}.` : "";
  if (context.teamName) {
    return {
      sql: `and (${prefix}owner_user_id = $${startIndex} or ${prefix}visibility_scope = 'tenant_shared' or (${prefix}visibility_scope = 'team' and ${prefix}team_name = $${startIndex + 1}))`,
      values: [context.userId, context.teamName],
    };
  }
  return {
    sql: `and (${prefix}owner_user_id = $${startIndex} or ${prefix}visibility_scope = 'tenant_shared')`,
    values: [context.userId],
  };
}

export async function assertRecordBelongsToTenant(
  db: CbeDb,
  table: string,
  id: string,
  context: TenantContext,
) {
  const allowedTables = new Set(["agent_runs", "lead_runs", "accio_imports"]);
  if (!allowedTables.has(table)) {
    throw new CbeStoreError(500, "invalid_tenant_check_table", "Invalid tenant check table.");
  }
  const result = await db.query<{ id: string }>(
    `select id from ${table} where tenant_id = $1 and id = $2 limit 1`,
    [context.tenantId, id],
  );
  if (!result.rows[0]) {
    throw new CbeStoreError(404, "record_missing", "Requested CBE record was not found.");
  }
}
