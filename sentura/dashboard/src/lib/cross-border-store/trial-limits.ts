import type { PoolClient, QueryResultRow } from "pg";
import {
  CBE_TRIAL_LEAD_SUCCESS_LIMIT,
  CBE_TRIAL_OPERATOR_ACCOUNT_LIMIT,
  CBE_TRIAL_SCREENING_SUCCESS_LIMIT,
  cbeTrialLimitBucket,
  type CbeTrialLimitsSnapshot,
  type CbeTrialUsageKind,
} from "../cross-border-trial-limits";
import { queryCbe } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import type { TenantContext } from "./schemas";

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
};

interface TrialUsageRow extends QueryResultRow {
  operator_count: string;
  lead_success_count: string;
  screening_success_count: string;
}

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getCbeTrialLimitsSnapshot(
  context: Pick<TenantContext, "tenantId">,
  db: Queryable = { query: queryCbe },
): Promise<CbeTrialLimitsSnapshot> {
  const result = await db.query<TrialUsageRow>(
    `
      select
        (
          select count(*)::text
          from cbe_user_profiles
          where tenant_id = $1
            and cbe_role = 'operator'
            and status <> 'inactive'
        ) as operator_count,
        (
          select coalesce(sum(quantity), 0)::text
          from cbe_trial_usage_events
          where tenant_id = $1
            and usage_kind = 'lead_success'
        ) as lead_success_count,
        (
          select coalesce(sum(quantity), 0)::text
          from cbe_trial_usage_events
          where tenant_id = $1
            and usage_kind = 'screening_success'
        ) as screening_success_count
    `,
    [context.tenantId],
  );
  const row = result.rows[0];
  return {
    enabled: true,
    locked: true,
    operatorAccounts: cbeTrialLimitBucket(n(row?.operator_count), CBE_TRIAL_OPERATOR_ACCOUNT_LIMIT),
    leadSuccesses: cbeTrialLimitBucket(n(row?.lead_success_count), CBE_TRIAL_LEAD_SUCCESS_LIMIT),
    screeningSuccesses: cbeTrialLimitBucket(n(row?.screening_success_count), CBE_TRIAL_SCREENING_SUCCESS_LIMIT),
    updatedAt: new Date().toISOString(),
  };
}

export async function lockCbeTrialLimitsForTenant(client: PoolClient, context: Pick<TenantContext, "tenantId">) {
  const result = await client.query<{ id: string }>(
    `
      select id
      from tenants
      where id = $1
      for update
    `,
    [context.tenantId],
  );
  if (!result.rows[0]) {
    throw new CbeStoreError(404, "tenant_missing", "CBE tenant was not found.");
  }
}

export async function assertCbeTrialOperatorCapacity(
  client: PoolClient,
  context: Pick<TenantContext, "tenantId">,
  requestedSlots: number,
) {
  const snapshot = await getCbeTrialLimitsSnapshot(context, client);
  if (requestedSlots > snapshot.operatorAccounts.remaining) {
    throw new CbeStoreError(
      409,
      "trial_operator_limit_exceeded",
      `试用期最多只能保留 ${snapshot.operatorAccounts.limit} 个员工账户，当前还可创建 ${snapshot.operatorAccounts.remaining} 个。`,
      snapshot,
    );
  }
  return snapshot;
}

export async function assertCbeTrialLeadCapacity(
  context: Pick<TenantContext, "tenantId">,
  requestedCount: number,
) {
  const snapshot = await getCbeTrialLimitsSnapshot(context);
  if (requestedCount > snapshot.leadSuccesses.remaining) {
    throw new CbeStoreError(
      409,
      "trial_lead_limit_exceeded",
      `试用期获客成功额度剩余 ${snapshot.leadSuccesses.remaining} 个，本次最多只能提交 ${snapshot.leadSuccesses.remaining} 个。`,
      snapshot,
    );
  }
  return snapshot;
}

export async function assertCbeTrialScreeningCapacity(
  context: Pick<TenantContext, "tenantId">,
  requestedCount: number,
) {
  const snapshot = await getCbeTrialLimitsSnapshot(context);
  if (requestedCount > snapshot.screeningSuccesses.remaining) {
    throw new CbeStoreError(
      409,
      "trial_screening_limit_exceeded",
      `试用期背调成功额度剩余 ${snapshot.screeningSuccesses.remaining} 次，本次最多只能提交 ${snapshot.screeningSuccesses.remaining} 次。`,
      snapshot,
    );
  }
  return snapshot;
}

export async function getCbeTrialRemainingAfterLock(
  client: PoolClient,
  context: Pick<TenantContext, "tenantId">,
  usageKind: CbeTrialUsageKind,
) {
  await lockCbeTrialLimitsForTenant(client, context);
  const snapshot = await getCbeTrialLimitsSnapshot(context, client);
  return usageKind === "lead_success"
    ? snapshot.leadSuccesses.remaining
    : snapshot.screeningSuccesses.remaining;
}

export async function recordCbeTrialUsageEvent(
  client: PoolClient,
  context: Pick<TenantContext, "tenantId" | "userId">,
  input: {
    usageKind: CbeTrialUsageKind;
    agentRunId?: string | null;
    sourceRecordType: string;
    sourceRecordId: string;
    quantity?: number;
    metadataJson?: Record<string, unknown>;
  },
) {
  await client.query(
    `
      insert into cbe_trial_usage_events (
        id,
        tenant_id,
        user_id,
        agent_run_id,
        usage_kind,
        source_record_type,
        source_record_id,
        quantity,
        metadata_json
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      on conflict (tenant_id, usage_kind, source_record_type, source_record_id)
      do nothing
    `,
    [
      createCbeId("trial_usage"),
      context.tenantId,
      context.userId,
      input.agentRunId ?? null,
      input.usageKind,
      input.sourceRecordType,
      input.sourceRecordId,
      input.quantity ?? 1,
      JSON.stringify(input.metadataJson ?? {}),
    ],
  );
}
