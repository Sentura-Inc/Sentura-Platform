import type { CbeDb } from "./db";
import { createCbeId } from "./ids";
import type { CbeAgentId, CbeDataTier, TenantContext } from "./schemas";

export interface AuditEventInput {
  userId?: string;
  agentId?: CbeAgentId;
  eventType: string;
  dataTier: CbeDataTier;
  metadataJson?: Record<string, unknown>;
}

export async function createAuditEvent(
  db: CbeDb,
  context: TenantContext,
  input: AuditEventInput,
) {
  const id = createCbeId("audit");
  await db.query(
    `
      insert into audit_events (
        id,
        tenant_id,
        user_id,
        agent_id,
        event_type,
        data_tier,
        metadata_json
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      id,
      context.tenantId,
      input.userId ?? context.userId,
      input.agentId ?? null,
      input.eventType,
      input.dataTier,
      JSON.stringify(input.metadataJson ?? {}),
    ],
  );
  return id;
}
