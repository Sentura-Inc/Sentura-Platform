import type { CbeDb } from "./db";
import { queryCbe } from "./db";
import type { ListQuery, TenantContext } from "./schemas";
import { listEmployeeTasks } from "./tasks";

export async function listEmployeeNotifications(context: TenantContext, query: ListQuery) {
  const terminalQuery = { ...query, status: query.status };
  const tasks = await listEmployeeTasks(context, terminalQuery);
  return {
    ...tasks,
    items: tasks.items.filter((task) => task.status === "completed" || task.status === "failed" || task.status === "cancelled"),
  };
}

export async function markEmployeeNotificationsRead(
  db: CbeDb,
  context: TenantContext,
  ids: string[],
) {
  const scope = context.cbeRole === "admin"
    ? { sql: "", values: [] as unknown[] }
    : {
        sql: "and (ar.owner_user_id = $4 or ar.user_id = $4 or ar.visibility_scope = 'tenant_shared')",
        values: [context.userId] as unknown[],
      };
  const result = await db.query<{ id: string }>(
    `
      update agent_runs ar
      set metadata_json = metadata_json || $3::jsonb
      where ar.tenant_id = $1
        and ar.id = any($2::text[])
        and ar.status in ('completed', 'failed', 'cancelled')
        and not (ar.metadata_json ? 'notification_deleted_at')
      ${scope.sql}
      returning ar.id
    `,
    [
      context.tenantId,
      ids,
      JSON.stringify({ notification_read_by_user_id: context.userId, notification_read_at: new Date().toISOString() }),
      ...scope.values,
    ],
  );
  return { readIds: result.rows.map((row) => row.id) };
}

export async function deleteEmployeeNotifications(
  db: CbeDb,
  context: TenantContext,
  ids: string[],
) {
  const scope = context.cbeRole === "admin"
    ? { sql: "", values: [] as unknown[] }
    : {
        sql: "and (ar.owner_user_id = $4 or ar.user_id = $4 or ar.visibility_scope = 'tenant_shared')",
        values: [context.userId] as unknown[],
      };
  const result = await db.query<{ id: string }>(
    `
      update agent_runs ar
      set metadata_json = metadata_json || $3::jsonb
      where ar.tenant_id = $1
        and ar.id = any($2::text[])
        and ar.status in ('completed', 'failed', 'cancelled')
        and not (ar.metadata_json ? 'notification_deleted_at')
      ${scope.sql}
      returning ar.id
    `,
    [
      context.tenantId,
      ids,
      JSON.stringify({ notification_deleted_by_user_id: context.userId, notification_deleted_at: new Date().toISOString() }),
      ...scope.values,
    ],
  );
  return { deletedIds: result.rows.map((row) => row.id) };
}

export async function countUnreadEmployeeNotifications(context: TenantContext) {
  const scope = context.cbeRole === "admin"
    ? { sql: "", values: [] as unknown[] }
    : {
        sql: "and (ar.owner_user_id = $2 or ar.user_id = $2 or ar.visibility_scope = 'tenant_shared')",
        values: [context.userId] as unknown[],
      };
  const result = await queryCbe<{ count: string }>(
    `
      select count(*)::text as count
      from agent_runs ar
      where ar.tenant_id = $1
        and ar.status in ('completed', 'failed', 'cancelled')
        and not (ar.metadata_json ? 'notification_read_at')
        and not (ar.metadata_json ? 'notification_deleted_at')
      ${scope.sql}
    `,
    [context.tenantId, ...scope.values],
  );
  return Number(result.rows[0]?.count ?? 0);
}
