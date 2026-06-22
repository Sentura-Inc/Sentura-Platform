import type { CbeDb } from "./db";
import { createCbeId } from "./ids";
import type { TenantContext } from "./schemas";

export async function createApiLedgerEntry(
  db: CbeDb,
  context: TenantContext,
  input: {
    agentRunId?: string;
    provider: string;
    endpoint?: string;
    sourceType?: string;
    requestUnits?: number;
    costUsd?: number;
    status: string;
    metadataJson?: Record<string, unknown>;
  },
) {
  const id = createCbeId("api_call");
  await db.query(
    `
      insert into api_call_ledger (
        id,
        tenant_id,
        agent_run_id,
        provider,
        endpoint,
        source_type,
        request_units,
        cost_usd,
        status,
        metadata_json
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `,
    [
      id,
      context.tenantId,
      input.agentRunId ?? null,
      input.provider,
      input.endpoint ?? null,
      input.sourceType ?? null,
      input.requestUnits ?? null,
      input.costUsd ?? null,
      input.status,
      JSON.stringify(input.metadataJson ?? {}),
    ],
  );
  return id;
}
