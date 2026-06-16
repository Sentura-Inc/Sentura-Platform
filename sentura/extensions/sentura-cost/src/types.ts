/**
 * Cost-event schema. One row per billable or auditable API/service call.
 *
 * Sourced from OpenClaw's `model.usage` diagnostic event:
 *   - provider, model, usage (input/output/cache tokens), costUsd, durationMs.
 * Or backfilled from OpenClaw session logs for external tool/API calls:
 *   - provider, operation, external usage unit, pricing status, costUsd when
 *     the provider returns a concrete USD value or an official per-unit price
 *     can be applied.
 * Enriched on capture with Sentura attribution:
 *   - userToken extracted from sessionKey
 *   - tenantId / departmentId looked up from `agent-tenancy.json`
 *
 * `costUsd` may be `null` when the underlying provider doesn't expose a
 * USD cost in the event, or the provider bills by plan/credits that cannot
 * be truthfully converted without account-specific plan data. Callers are
 * expected to treat null as "not yet priced" (NOT zero) so aggregations
 * don't silently under-report spend.
 */
export type CostEventKind = "model" | "external_api" | "local_tool";

export type CostPricingStatus =
  | "priced"
  | "estimated"
  | "free"
  | "included"
  | "unpriced";

export interface ExternalUsageUnit {
  unit: "request" | "credit" | "page" | "local_call";
  quantity: number;
  label?: string;
}

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
  /** Model name for LLM calls; operation/endpoint label for external calls. */
  model: string;
  kind?: CostEventKind;
  service?: string;
  operation?: string;
  pricingStatus?: CostPricingStatus;
  pricingNote?: string;
  externalUsage?: ExternalUsageUnit;
  httpStatus?: number;
  toolName?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens: number;
  };
  costUsd: number | null;
  durationMs: number;
  /** Capture source. `session_log` backfills real OpenClaw usage rows if live diagnostics were missed. */
  source?: "diagnostic" | "session_log" | "external_tool_log";
  messageId?: string;
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
