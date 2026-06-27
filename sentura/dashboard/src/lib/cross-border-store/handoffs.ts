import { withCbeTransaction, type CbeDb } from "./db";
import { createCbeId } from "./ids";
import { createAuditEvent } from "./audit";
import { CbeStoreError } from "./errors";
import type { CreateHandoffRequest, TenantContext } from "./schemas";

export interface HandoffEventRecord {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  sourceRecordType: string;
  sourceRecordId: string;
  status: string;
}

interface HandoffRow {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  source_record_type: string;
  source_record_id: string;
  status: string;
}

function toHandoffRecord(row: HandoffRow): HandoffEventRecord {
  return {
    id: row.id,
    fromAgentId: row.from_agent_id,
    toAgentId: row.to_agent_id,
    sourceRecordType: row.source_record_type,
    sourceRecordId: row.source_record_id,
    status: row.status,
  };
}

export async function insertHandoffEvent(
  db: CbeDb,
  context: TenantContext,
  input: CreateHandoffRequest,
) {
  const result = await db.query<HandoffRow>(
    `
      insert into handoff_events (
        id,
        tenant_id,
        from_agent_id,
        to_agent_id,
        created_by_user_id,
        owner_user_id,
        assigned_to_user_id,
        department_id,
        team_name,
        visibility_scope,
        source_record_type,
        source_record_id,
        payload_json,
        status
      )
      values ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
      returning id, from_agent_id, to_agent_id, source_record_type, source_record_id, status
    `,
    [
      createCbeId("handoff"),
      context.tenantId,
      input.from_agent_id,
      input.to_agent_id,
      context.userId,
      input.assigned_to_user_id ?? null,
      context.departmentId ?? null,
      context.teamName ?? null,
      input.visibility_scope,
      input.source_record_type,
      input.source_record_id,
      JSON.stringify(input.payload_json),
      input.status,
    ],
  );
  return toHandoffRecord(result.rows[0]);
}

export async function createHandoffEvent(
  context: TenantContext,
  input: CreateHandoffRequest,
) {
  if (
    input.from_agent_id === "cbe-accio-memory" ||
    (input.to_agent_id === "cbe-buyer-screening" && input.source_record_type === "accio_summary")
  ) {
    throw new CbeStoreError(
      400,
      "accio_handoff_disabled",
      "记忆整理已与获客/背调分离，不能移交背调。",
    );
  }
  return withCbeTransaction(async (client) => {
    const handoff = await insertHandoffEvent(client, context, input);
    await createAuditEvent(client, context, {
      agentId: input.from_agent_id,
      eventType: "handoff_created",
      dataTier: "T2",
      metadataJson: {
        handoff_id: handoff.id,
        to_agent_id: input.to_agent_id,
        source_record_type: input.source_record_type,
        source_record_id: input.source_record_id,
      },
    });
    return handoff;
  });
}
