import type { CbeDb } from "./db";
import { withCbeTransaction } from "./db";
import { createCbeId } from "./ids";
import type {
  CbeAgentId,
  CbeAgentRunStatus,
  CbeTaskKind,
  CreateAgentRunInput,
  TenantContext,
} from "./schemas";
import { CreateAgentRunInputSchema } from "./schemas";
import { createAuditEvent } from "./audit";

export interface AgentRunRecord {
  id: string;
  tenantId: string;
  userId: string | null;
  ownerUserId: string | null;
  parentAgentRunId: string | null;
  agentId: CbeAgentId;
  sessionKey: string | null;
  status: CbeAgentRunStatus;
  taskKind: CbeTaskKind;
  targetSummary: string | null;
  currentStage: string | null;
  queuePriority: number;
  queuedAt: string | null;
  leaseOwner: string | null;
  leaseUntil: string | null;
  costUsdEstimate: number | null;
  startedAt: string;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadataJson: Record<string, unknown>;
}

interface AgentRunRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  owner_user_id: string | null;
  parent_agent_run_id: string | null;
  agent_id: CbeAgentId;
  session_key: string | null;
  status: CbeAgentRunStatus;
  task_kind: CbeTaskKind;
  target_summary: string | null;
  current_stage: string | null;
  queue_priority: number;
  queued_at: Date | null;
  lease_owner: string | null;
  lease_until: Date | null;
  cost_usd_estimate: string | null;
  started_at: Date;
  finished_at: Date | null;
  error_code: string | null;
  error_message: string | null;
  metadata_json: Record<string, unknown>;
}

function toAgentRunRecord(row: AgentRunRow): AgentRunRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    ownerUserId: row.owner_user_id,
    parentAgentRunId: row.parent_agent_run_id,
    agentId: row.agent_id,
    sessionKey: row.session_key,
    status: row.status,
    taskKind: row.task_kind,
    targetSummary: row.target_summary,
    currentStage: row.current_stage,
    queuePriority: row.queue_priority,
    queuedAt: row.queued_at?.toISOString() ?? null,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until?.toISOString() ?? null,
    costUsdEstimate: row.cost_usd_estimate === null ? null : Number(row.cost_usd_estimate),
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    metadataJson: row.metadata_json ?? {},
  };
}

export async function insertAgentRun(
  db: CbeDb,
  context: TenantContext,
  rawInput: CreateAgentRunInput,
) {
  const input = CreateAgentRunInputSchema.parse(rawInput);
  const id = createCbeId("run");
  const result = await db.query<AgentRunRow>(
    `
      insert into agent_runs (
        id,
        tenant_id,
        user_id,
        owner_user_id,
        parent_agent_run_id,
        department_id,
        visibility_scope,
        agent_id,
        session_key,
        status,
        task_kind,
        target_record_type,
        target_record_id,
        target_summary,
        current_stage,
        queue_priority,
        queued_at,
        lease_owner,
        lease_until,
        last_activity_at,
        cost_usd_estimate,
        metadata_json
      )
      values (
        $1, $2, $3, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, case when $9 = 'queued' then coalesce($16::timestamptz, now()) else null end,
        $17, $18::timestamptz, now(), $19, $20::jsonb
      )
      returning *
    `,
    [
      id,
      context.tenantId,
      context.userId,
      input.parent_agent_run_id ?? null,
      context.departmentId ?? null,
      input.visibility_scope,
      input.agent_id,
      input.session_key ?? null,
      input.status,
      input.task_kind,
      input.target_record_type ?? null,
      input.target_record_id ?? null,
      input.target_summary ?? null,
      input.current_stage ?? null,
      input.queue_priority,
      input.queued_at ?? null,
      input.lease_owner ?? null,
      input.lease_until ?? null,
      input.cost_usd_estimate ?? null,
      JSON.stringify(input.metadata_json),
    ],
  );
  return toAgentRunRecord(result.rows[0]);
}

export async function createAgentRun(
  context: TenantContext,
  input: CreateAgentRunInput,
) {
  return withCbeTransaction(async (client) => {
    const run = await insertAgentRun(client, context, input);
    await createAuditEvent(client, context, {
      agentId: run.agentId,
      eventType: "agent_run_created",
      dataTier: input.task_kind === "accio_memory" ? "T2" : "T1",
      metadataJson: {
        agent_run_id: run.id,
        task_kind: run.taskKind,
        target_summary: run.targetSummary,
      },
    });
    return run;
  });
}

export async function markAgentRunRunning(
  db: CbeDb,
  context: TenantContext,
  input: { agentRunId: string; sessionKey?: string; currentStage?: string },
) {
  const result = await db.query<AgentRunRow>(
    `
      update agent_runs
      set
        status = 'running',
        session_key = coalesce($3, session_key),
        current_stage = coalesce($4, current_stage),
        last_activity_at = now()
      where tenant_id = $1
        and id = $2
      returning *
    `,
    [context.tenantId, input.agentRunId, input.sessionKey ?? null, input.currentStage ?? null],
  );
  return result.rows[0] ? toAgentRunRecord(result.rows[0]) : null;
}

export async function completeAgentRun(
  db: CbeDb,
  context: TenantContext,
  input: {
    agentRunId: string;
    sessionKey?: string;
    currentStage?: string;
    metadataJson?: Record<string, unknown>;
  },
) {
  const result = await db.query<AgentRunRow>(
    `
      update agent_runs
      set
        status = 'completed',
        session_key = coalesce($3, session_key),
        current_stage = coalesce($4, current_stage),
        finished_at = now(),
        last_activity_at = now(),
        metadata_json = metadata_json || $5::jsonb,
        error_code = null,
        error_message = null
      where tenant_id = $1
        and id = $2
      returning *
    `,
    [
      context.tenantId,
      input.agentRunId,
      input.sessionKey ?? null,
      input.currentStage ?? null,
      JSON.stringify(input.metadataJson ?? {}),
    ],
  );
  return result.rows[0] ? toAgentRunRecord(result.rows[0]) : null;
}

export async function failAgentRun(
  db: CbeDb,
  context: TenantContext,
  input: {
    agentRunId: string;
    sessionKey?: string;
    errorCode: string;
    errorMessage: string;
    metadataJson?: Record<string, unknown>;
  },
) {
  const result = await db.query<AgentRunRow>(
    `
      update agent_runs
      set
        status = 'failed',
        session_key = coalesce($3, session_key),
        finished_at = now(),
        last_activity_at = now(),
        error_code = $4,
        error_message = $5,
        metadata_json = metadata_json || $6::jsonb
      where tenant_id = $1
        and id = $2
      returning *
    `,
    [
      context.tenantId,
      input.agentRunId,
      input.sessionKey ?? null,
      input.errorCode,
      input.errorMessage,
      JSON.stringify(input.metadataJson ?? {}),
    ],
  );
  await createAuditEvent(db, context, {
    eventType: "agent_run_failed",
    dataTier: "T1",
    metadataJson: {
      agent_run_id: input.agentRunId,
      error_code: input.errorCode,
      error_message: input.errorMessage,
    },
  });
  return result.rows[0] ? toAgentRunRecord(result.rows[0]) : null;
}

export async function createAgentRunActivityEvent(
  db: CbeDb,
  context: TenantContext,
  input: {
    agentRunId: string;
    agentId: CbeAgentId;
    taskKind: CbeTaskKind;
    targetRecordType?: string;
    targetRecordId?: string;
    targetSummary?: string;
    stage?: string;
    eventType: string;
    toolName?: string;
    sourceUrl?: string;
    status: CbeAgentRunStatus;
    metadataJson?: Record<string, unknown>;
  },
) {
  const id = createCbeId("activity");
  await db.query(
    `
      insert into agent_run_activity_events (
        id,
        tenant_id,
        agent_run_id,
        operator_user_id,
        agent_id,
        task_kind,
        target_record_type,
        target_record_id,
        target_summary,
        stage,
        event_type,
        tool_name,
        source_url,
        status,
        metadata_json
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
    `,
    [
      id,
      context.tenantId,
      input.agentRunId,
      context.userId,
      input.agentId,
      input.taskKind,
      input.targetRecordType ?? null,
      input.targetRecordId ?? null,
      input.targetSummary ?? null,
      input.stage ?? null,
      input.eventType,
      input.toolName ?? null,
      input.sourceUrl ?? null,
      input.status,
      JSON.stringify(input.metadataJson ?? {}),
    ],
  );
  return id;
}
