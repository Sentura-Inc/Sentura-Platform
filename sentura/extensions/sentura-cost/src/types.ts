/**
 * Cost-event schema. One row per LLM call.
 *
 * Sourced from OpenClaw's `model.usage` diagnostic event:
 *   - provider, model, usage (input/output/cache tokens), costUsd, durationMs.
 * Enriched on capture with Sentura attribution:
 *   - userToken extracted from sessionKey
 *   - tenantId / departmentId looked up from `agent-tenancy.json`
 *
 * `costUsd` may be `null` when the underlying provider doesn't expose a
 * cost in the event — callers are expected to treat null as "not yet
 * priced" (NOT zero) so aggregations don't silently under-report spend.
 */
export interface CostEvent {
  id: string;
  timestamp: string;
  agentId: string;
  sessionKey: string;
  /** "" when the session is non-Sentura (raw CLI). */
  userToken: string;
  tenantId: string;
  departmentId: string | null;
  provider: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens: number;
  };
  costUsd: number | null;
  durationMs: number;
}

export interface CostConfig {
  logDir: string;
  retention: {
    maxAgeDays: number;
  };
}

export interface CostQueryParams {
  agentId?: string;
  tenantId?: string;
  departmentId?: string;
  userToken?: string;
  model?: string;
  provider?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface CostAggregateBucket {
  key: string;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  /** Number of events whose costUsd was null (provider didn't price the call). */
  unpricedCalls: number;
}

export interface CostSummary {
  period: { start: string; end: string };
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  unpricedCalls: number;
  byAgent: CostAggregateBucket[];
  byDepartment: CostAggregateBucket[];
  byTenant: CostAggregateBucket[];
  byModel: CostAggregateBucket[];
}
