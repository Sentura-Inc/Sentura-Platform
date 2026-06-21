import type { PoolClient } from "pg";
import { CbeStoreError } from "./errors";
import type { CbeAgentId, CbeTaskKind, TenantContext } from "./schemas";

export interface CbeWorkloadSettings {
  maxActiveTotal: number;
  maxActiveTotalHard: number;
  leadMaxActiveRuns: number;
  leadDefaultTargetCount: number;
  screeningExecutionMode: "single_target_fanout" | "batch3_experiment";
  screeningMaxTargetsPerSession: number;
  screeningAllowBatch3: boolean;
  screeningMaxActiveTargets: number;
  accioMaxActiveImports: number;
  providerHeadroomRatio: number;
  queueLeaseSeconds: number;
  completedPoolTtlHours: number;
}

export interface CbeWorkloadSnapshot {
  activeTotal: number;
  activeByAgent: Record<CbeAgentId, number>;
  queuedTotal: number;
  settings: CbeWorkloadSettings;
}

export interface CbeWorkloadAdmission {
  status: "running" | "queued";
  sessionKey?: string;
  currentStage: string;
  queuePriority: number;
  queued: boolean;
  reason: "admitted" | "no_session_key" | "global_soft_cap" | "global_hard_cap" | "agent_cap";
  activeTotal: number;
  activeAgent: number;
  cap: number;
  hardCap: number;
  queuedAt?: string;
  estimatedStartSeconds?: number;
  settings: CbeWorkloadSettings;
}

interface ActiveCountRow {
  active_total: string;
  active_lead: string;
  active_screening: string;
  active_accio: string;
  queued_total: string;
}

function intFromEnv(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 0) {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.max(min, value) : fallback;
}

function floatFromEnv(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 0, max = 1) {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function boolFromEnv(env: NodeJS.ProcessEnv, key: string, fallback = false) {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

export function getCbeWorkloadSettings(env: NodeJS.ProcessEnv = process.env): CbeWorkloadSettings {
  const maxActiveTotal = intFromEnv(env, "CBE_TASK_MAX_ACTIVE_TOTAL", 24, 1);
  const maxActiveTotalHard = Math.max(
    maxActiveTotal,
    intFromEnv(env, "CBE_TASK_MAX_ACTIVE_TOTAL_HARD", 32, maxActiveTotal),
  );
  const screeningAllowBatch3 = boolFromEnv(env, "CBE_SCREENING_ALLOW_BATCH3", false);
  const screeningMode =
    env.CBE_SCREENING_EXECUTION_MODE?.trim() === "batch3_experiment" && screeningAllowBatch3
      ? "batch3_experiment"
      : "single_target_fanout";

  return {
    maxActiveTotal,
    maxActiveTotalHard,
    leadMaxActiveRuns: intFromEnv(env, "CBE_LEAD_MAX_ACTIVE_RUNS", 12, 1),
    leadDefaultTargetCount: intFromEnv(env, "CBE_LEAD_DEFAULT_TARGET_COUNT", 10, 1),
    screeningExecutionMode: screeningMode,
    screeningMaxTargetsPerSession: intFromEnv(env, "CBE_SCREENING_MAX_TARGETS_PER_SESSION", 1, 1),
    screeningAllowBatch3,
    screeningMaxActiveTargets: intFromEnv(env, "CBE_SCREENING_MAX_ACTIVE_TARGETS", 12, 1),
    accioMaxActiveImports: intFromEnv(env, "CBE_ACCIO_MAX_ACTIVE_IMPORTS", 3, 1),
    providerHeadroomRatio: floatFromEnv(env, "CBE_PROVIDER_HEADROOM_RATIO", 0.2, 0, 0.9),
    queueLeaseSeconds: intFromEnv(env, "CBE_QUEUE_LEASE_SECONDS", 90, 10),
    completedPoolTtlHours: intFromEnv(env, "CBE_LEAD_COMPLETED_POOL_TTL_HOURS", 24, 1),
  };
}

export function assertScreeningSessionShape(targetCount: number, settings = getCbeWorkloadSettings()) {
  if (targetCount <= settings.screeningMaxTargetsPerSession) return;
  if (settings.screeningAllowBatch3 && targetCount <= 3) return;

  throw new CbeStoreError(
    409,
    "screening_fanout_required",
    "当前生产路径不允许把多个客户放进一个背调员工会话；请按 P2.5 拆成 parent task + single-target child runs。",
    {
      requested_target_count: targetCount,
      max_targets_per_session: settings.screeningMaxTargetsPerSession,
      batch3_enabled: settings.screeningAllowBatch3,
    },
  );
}

function activeCapForAgent(settings: CbeWorkloadSettings, agentId: CbeAgentId) {
  if (agentId === "cbe-lead-discovery") return settings.leadMaxActiveRuns;
  if (agentId === "cbe-buyer-screening") return settings.screeningMaxActiveTargets;
  return settings.accioMaxActiveImports;
}

async function lockTenantWorkload(client: PoolClient, tenantId: string) {
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [`cbe-workload:${tenantId}`]);
}

async function countWorkload(client: PoolClient, tenantId: string) {
  const counts = await client.query<ActiveCountRow>(
    `
      select
        count(*) filter (where status in ('running', 'polling') and session_key is not null)::text as active_total,
        count(*) filter (where status in ('running', 'polling') and session_key is not null and agent_id = 'cbe-lead-discovery')::text as active_lead,
        count(*) filter (where status in ('running', 'polling') and session_key is not null and agent_id = 'cbe-buyer-screening')::text as active_screening,
        count(*) filter (where status in ('running', 'polling') and session_key is not null and agent_id = 'cbe-accio-memory')::text as active_accio,
        count(*) filter (where status = 'queued')::text as queued_total
      from agent_runs
      where tenant_id = $1
    `,
    [tenantId],
  );
  const row = counts.rows[0];
  return {
    activeTotal: Number(row.active_total),
    activeByAgent: {
      "cbe-lead-discovery": Number(row.active_lead),
      "cbe-buyer-screening": Number(row.active_screening),
      "cbe-accio-memory": Number(row.active_accio),
    },
    queuedTotal: Number(row.queued_total),
  };
}

export async function getCbeWorkloadSnapshot(
  client: PoolClient,
  context: TenantContext,
  settings = getCbeWorkloadSettings(),
): Promise<CbeWorkloadSnapshot> {
  const counts = await countWorkload(client, context.tenantId);
  return { ...counts, settings };
}

export async function admitCbeWorkload(
  client: PoolClient,
  context: TenantContext,
  input: {
    agentId: CbeAgentId;
    taskKind: CbeTaskKind;
    requestedSessionKey?: string;
    currentStageWhenRunning?: string;
    currentStageWhenQueued?: string;
    queuePriority?: number;
  },
): Promise<CbeWorkloadAdmission> {
  const settings = getCbeWorkloadSettings();
  await lockTenantWorkload(client, context.tenantId);
  const counts = await countWorkload(client, context.tenantId);
  const activeAgent = counts.activeByAgent[input.agentId];
  const agentCap = activeCapForAgent(settings, input.agentId);
  const queuedAt = new Date().toISOString();

  const queued = (
    !input.requestedSessionKey ||
    counts.activeTotal >= settings.maxActiveTotalHard ||
    counts.activeTotal >= settings.maxActiveTotal ||
    activeAgent >= agentCap
  );
  const reason: CbeWorkloadAdmission["reason"] =
    !input.requestedSessionKey
      ? "no_session_key"
      : counts.activeTotal >= settings.maxActiveTotalHard
        ? "global_hard_cap"
        : counts.activeTotal >= settings.maxActiveTotal
          ? "global_soft_cap"
          : activeAgent >= agentCap
            ? "agent_cap"
            : "admitted";
  const queuePosition = queued ? counts.queuedTotal + 1 : 0;

  return {
    status: queued ? "queued" : "running",
    sessionKey: queued ? undefined : input.requestedSessionKey,
    currentStage: queued
      ? input.currentStageWhenQueued ?? "queued"
      : input.currentStageWhenRunning ?? "submitted_to_employee",
    queuePriority: input.queuePriority ?? 0,
    queued,
    reason,
    activeTotal: counts.activeTotal,
    activeAgent,
    cap: settings.maxActiveTotal,
    hardCap: settings.maxActiveTotalHard,
    queuedAt: queued ? queuedAt : undefined,
    estimatedStartSeconds: queued ? Math.max(30, queuePosition * settings.queueLeaseSeconds) : undefined,
    settings,
  };
}

export function workloadMetadata(admission: CbeWorkloadAdmission) {
  return {
    workload_admission: {
      status: admission.status,
      queued: admission.queued,
      reason: admission.reason,
      active_total: admission.activeTotal,
      active_agent: admission.activeAgent,
      cap: admission.cap,
      hard_cap: admission.hardCap,
      estimated_start_seconds: admission.estimatedStartSeconds,
    },
  };
}
