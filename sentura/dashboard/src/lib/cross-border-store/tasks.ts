import type { CbeDb } from "./db";
import { queryCbe, withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createAgentRunActivityEvent, failAgentRun } from "./agent-runs";
import type {
  CbeAgentId,
  CbeAgentRunStatus,
  CbeTaskKind,
  FailEmployeeTaskRequest,
  ListQuery,
  TenantContext,
} from "./schemas";

export interface EmployeeTaskRecord {
  id: string;
  agentId: CbeAgentId;
  taskKind: CbeTaskKind;
  status: CbeAgentRunStatus;
  targetSummary: string | null;
  currentStage: string | null;
  sessionKey: string | null;
  startedAt: string;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadataJson: Record<string, unknown>;
}

interface TaskRow {
  id: string;
  agent_id: CbeAgentId;
  task_kind: CbeTaskKind;
  status: CbeAgentRunStatus;
  target_summary: string | null;
  current_stage: string | null;
  session_key: string | null;
  started_at: Date;
  finished_at: Date | null;
  error_code: string | null;
  error_message: string | null;
  metadata_json: Record<string, unknown>;
}

function toTaskRecord(row: TaskRow): EmployeeTaskRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    taskKind: row.task_kind,
    status: row.status,
    targetSummary: row.target_summary,
    currentStage: row.current_stage,
    sessionKey: row.session_key,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    metadataJson: row.metadata_json ?? {},
  };
}

export async function listEmployeeTasks(context: TenantContext, query: ListQuery) {
  const scope = context.cbeRole === "admin"
    ? { sql: "", values: [] as unknown[] }
    : {
        sql: "and (ar.owner_user_id = $2 or ar.user_id = $2 or ar.visibility_scope = 'tenant_shared')",
        values: [context.userId] as unknown[],
      };
  const statusValue = query.status ? [query.status] : [];
  const statusClause = query.status ? `and ar.status = $${2 + scope.values.length}` : "";
  const limitIndex = 2 + scope.values.length + statusValue.length;
  const offsetIndex = limitIndex + 1;

  const result = await queryCbe<TaskRow>(
    `
      select
        ar.id,
        ar.agent_id,
        ar.task_kind,
        ar.status,
        ar.target_summary,
        ar.current_stage,
        ar.session_key,
        ar.started_at,
        ar.finished_at,
        ar.error_code,
        ar.error_message,
        ar.metadata_json
      from agent_runs ar
      where ar.tenant_id = $1
      ${scope.sql}
      ${statusClause}
      order by ar.started_at desc, ar.id desc
      limit $${limitIndex}
      offset $${offsetIndex}
    `,
    [context.tenantId, ...scope.values, ...statusValue, query.limit, query.offset],
  );
  return {
    items: result.rows.map(toTaskRecord),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function dismissEmployeeTask(
  db: CbeDb,
  context: TenantContext,
  taskId: string,
) {
  const result = await db.query<TaskRow>(
    `
      update agent_runs
      set metadata_json = metadata_json || $3::jsonb
      where tenant_id = $1
        and id = $2
        and (owner_user_id = $4 or user_id = $4 or $5::boolean)
      returning *
    `,
    [
      context.tenantId,
      taskId,
      JSON.stringify({ dismissed_by_user_id: context.userId, dismissed_at: new Date().toISOString() }),
      context.userId,
      context.cbeRole === "admin",
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new CbeStoreError(404, "task_missing", "CBE task was not found or is outside the user's scope.");
  }
  return toTaskRecord(row);
}

export async function failEmployeeTask(
  context: TenantContext,
  taskId: string,
  input: FailEmployeeTaskRequest,
) {
  return withCbeTransaction(async (client) => {
    const existing = await client.query<TaskRow>(
      `
        select
          id,
          agent_id,
          task_kind,
          status,
          target_summary,
          current_stage,
          session_key,
          started_at,
          finished_at,
          error_code,
          error_message,
          metadata_json
        from agent_runs
        where tenant_id = $1
          and id = $2
          and (owner_user_id = $3 or user_id = $3 or $4::boolean)
        limit 1
      `,
      [context.tenantId, taskId, context.userId, context.cbeRole === "admin"],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new CbeStoreError(404, "task_missing", "CBE task was not found or is outside the user's scope.");
    }

    const agentRun = await failAgentRun(client, context, {
      agentRunId: taskId,
      sessionKey: input.session_key,
      errorCode: input.error_code,
      errorMessage: input.error_message,
      metadataJson: {
        failure_details: input.details ?? {},
      },
    });
    if (!agentRun) {
      throw new CbeStoreError(404, "task_missing", "CBE task could not be failed.");
    }

    await createAgentRunActivityEvent(client, context, {
      agentRunId: taskId,
      agentId: row.agent_id,
      taskKind: row.task_kind,
      targetSummary: row.target_summary ?? undefined,
      stage: "failed",
      eventType: "employee_task_failed",
      status: "failed",
      metadataJson: {
        error_code: input.error_code,
        error_message: input.error_message,
      },
    });
    return agentRun;
  });
}
