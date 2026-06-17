import type { PoolClient } from "pg";
import { queryCbe, withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import { completeAgentRun, createAgentRunActivityEvent, failAgentRun, insertAgentRun } from "./agent-runs";
import { createAuditEvent } from "./audit";
import { insertHandoffEvent } from "./handoffs";
import type {
  AccioConversationImport,
  AccioSummaryMarker,
  CompleteAccioImportRequest,
  CreateAccioImportRequest,
  TenantContext,
} from "./schemas";
import { CreateAccioImportRequestSchema } from "./schemas";

export interface AccioImportRecord {
  id: string;
  agentRunId: string | null;
  sourceFileName: string | null;
  validationStatus: string;
  classification: string;
  uploadedAt: string;
}

export interface AccioSummaryRecord {
  id: string;
  accioConversationId: string;
  sourceRecordType: string;
}

export interface EmployeeMemoryRecord {
  importId: string;
  summaryId: string | null;
  companyName: string | null;
  country: string | null;
  memoryFactStatus: string | null;
  uploadedAt: string;
}

interface AccioImportRow {
  id: string;
  agent_run_id: string | null;
  source_file_name: string | null;
  validation_status: string;
  classification: string;
  uploaded_at: Date;
}

interface AccioSummaryRow {
  id: string;
  accio_conversation_id: string;
}

interface MemoryRow {
  import_id: string;
  summary_id: string | null;
  company_name: string | null;
  country: string | null;
  memory_fact_status: string | null;
  uploaded_at: Date;
}

function toAccioImportRecord(row: AccioImportRow): AccioImportRecord {
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    sourceFileName: row.source_file_name,
    validationStatus: row.validation_status,
    classification: row.classification,
    uploadedAt: row.uploaded_at.toISOString(),
  };
}

function toSummaryRecord(row: AccioSummaryRow): AccioSummaryRecord {
  return {
    id: row.id,
    accioConversationId: row.accio_conversation_id,
    sourceRecordType: "accio_summary",
  };
}

function toMemoryRecord(row: MemoryRow): EmployeeMemoryRecord {
  return {
    importId: row.import_id,
    summaryId: row.summary_id,
    companyName: row.company_name,
    country: row.country,
    memoryFactStatus: row.memory_fact_status,
    uploadedAt: row.uploaded_at.toISOString(),
  };
}

async function insertConversation(
  client: PoolClient,
  context: TenantContext,
  importId: string,
  conversation: AccioConversationImport,
) {
  const result = await client.query<{ id: string }>(
    `
      insert into accio_conversations (
        id,
        tenant_id,
        accio_import_id,
        external_conversation_id,
        company_name,
        country,
        contact_person,
        email,
        website
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id
    `,
    [
      createCbeId("accio_conversation"),
      context.tenantId,
      importId,
      conversation.external_conversation_id ?? null,
      conversation.company_name ?? null,
      conversation.country ?? null,
      conversation.contact_person ?? null,
      conversation.email ?? null,
      conversation.website ?? null,
    ],
  );
  const conversationId = result.rows[0].id;
  for (const message of conversation.messages) {
    await client.query(
      `
        insert into accio_messages (
          id,
          tenant_id,
          accio_conversation_id,
          message_ts,
          sender_role,
          text_hash,
          text_redacted,
          attachment_json
        )
        values ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8::jsonb)
      `,
      [
        createCbeId("accio_message"),
        context.tenantId,
        conversationId,
        message.message_ts ?? null,
        message.sender_role ?? null,
        message.text_hash,
        message.text_redacted ?? null,
        JSON.stringify(message.attachment_json),
      ],
    );
  }
  return conversationId;
}

async function findOrCreateConversationForSummary(
  client: PoolClient,
  context: TenantContext,
  importId: string,
  summary: AccioSummaryMarker,
) {
  const existing = await client.query<{ id: string }>(
    `
      select id
      from accio_conversations
      where tenant_id = $1
        and accio_import_id = $2
        and external_conversation_id = $3
      limit 1
    `,
    [context.tenantId, importId, summary.conversation_id],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const profile = summary.customer_profile;
  const result = await client.query<{ id: string }>(
    `
      insert into accio_conversations (
        id,
        tenant_id,
        accio_import_id,
        external_conversation_id,
        company_name,
        country,
        contact_person,
        email,
        website
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id
    `,
    [
      createCbeId("accio_conversation"),
      context.tenantId,
      importId,
      summary.conversation_id,
      String(profile.company_name),
      typeof profile.country === "string" ? profile.country : null,
      typeof profile.contact_person === "string" ? profile.contact_person : null,
      typeof profile.email === "string" ? profile.email : null,
      typeof profile.website === "string" ? profile.website : null,
    ],
  );
  return result.rows[0].id;
}

export async function saveAccioImport(
  context: TenantContext,
  rawInput: CreateAccioImportRequest,
) {
  const input = CreateAccioImportRequestSchema.parse(rawInput);
  return withCbeTransaction(async (client) => {
    const agentRun = await insertAgentRun(client, context, {
      agent_id: "cbe-accio-memory",
      task_kind: "accio_memory",
      status: input.session_key ? "running" : "queued",
      session_key: input.session_key,
      target_summary: input.source_file_name,
      current_stage: input.session_key ? "submitted_to_employee" : "uploaded",
      visibility_scope: input.visibility_scope,
      metadata_json: { source_file_name: input.source_file_name },
    });
    const importId = createCbeId("accio_import");
    const importResult = await client.query<AccioImportRow>(
      `
        insert into accio_imports (
          id,
          tenant_id,
          user_id,
          owner_user_id,
          department_id,
          team_name,
          visibility_scope,
          agent_run_id,
          source_file_name,
          file_hash,
          storage_key,
          validation_status,
          classification
        )
        values ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, 'validated', $11)
        returning id, agent_run_id, source_file_name, validation_status, classification, uploaded_at
      `,
      [
        importId,
        context.tenantId,
        context.userId,
        context.departmentId ?? null,
        context.teamName ?? null,
        input.visibility_scope,
        agentRun.id,
        input.source_file_name ?? null,
        input.file_hash,
        input.storage_key ?? null,
        input.classification,
      ],
    );
    for (const conversation of input.conversations) {
      await insertConversation(client, context, importId, conversation);
    }
    await createAgentRunActivityEvent(client, context, {
      agentRunId: agentRun.id,
      agentId: "cbe-accio-memory",
      taskKind: "accio_memory",
      targetRecordType: "accio_import",
      targetRecordId: importId,
      targetSummary: input.source_file_name,
      stage: agentRun.status,
      eventType: "accio_import_created",
      status: agentRun.status,
      metadataJson: { conversation_count: input.conversations.length },
    });
    await createAuditEvent(client, context, {
      agentId: "cbe-accio-memory",
      eventType: "accio_import_created",
      dataTier: "T2",
      metadataJson: { agent_run_id: agentRun.id, accio_import_id: importId },
    });
    return {
      agentRun,
      accioImport: toAccioImportRecord(importResult.rows[0]),
    };
  });
}

export async function saveAccioSummaries(
  context: TenantContext,
  importId: string,
  input: CompleteAccioImportRequest,
) {
  return withCbeTransaction(async (client) => {
    const importRows = await client.query<AccioImportRow>(
      `
        select id, agent_run_id, source_file_name, validation_status, classification, uploaded_at
        from accio_imports
        where tenant_id = $1
          and id = $2
        limit 1
      `,
      [context.tenantId, importId],
    );
    if (!importRows.rows[0]) {
      throw new CbeStoreError(404, "accio_import_missing", "Accio import was not found.");
    }

    const summaries = [];
    const memoryFactIds: string[] = [];
    const handoffIds: string[] = [];
    for (const summary of input.payload.summaries) {
      const conversationId = await findOrCreateConversationForSummary(client, context, importId, summary);
      const summaryResult = await client.query<AccioSummaryRow>(
        `
          insert into accio_summaries (
            id,
            tenant_id,
            accio_conversation_id,
            agent_run_id,
            created_by_user_id,
            owner_user_id,
            department_id,
            team_name,
            visibility_scope,
            customer_profile_json,
            purchase_intent_json,
            negotiated_price_json,
            next_actions_json,
            behavior_signals_json
          )
          values ($1, $2, $3, $4, $5, $5, $6, $7, 'private', $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb)
          returning id, accio_conversation_id
        `,
        [
          createCbeId("accio_summary"),
          context.tenantId,
          conversationId,
          input.agent_run_id,
          context.userId,
          context.departmentId ?? null,
          context.teamName ?? null,
          JSON.stringify(summary.customer_profile),
          JSON.stringify(summary.purchase_intent),
          JSON.stringify(summary.negotiated_prices),
          JSON.stringify(summary.next_actions),
          JSON.stringify(summary.behavior_signals),
        ],
      );
      const savedSummary = toSummaryRecord(summaryResult.rows[0]);
      summaries.push(savedSummary);

      const memoryFactId = createCbeId("memory_fact");
      await client.query(
        `
          insert into memory_facts (
            id,
            tenant_id,
            agent_id,
            created_by_user_id,
            owner_user_id,
            department_id,
            team_name,
            visibility_scope,
            source_record_type,
            source_record_id,
            fact_json,
            status
          )
          values ($1, $2, 'cbe-accio-memory', $3, $3, $4, $5, 'private', 'accio_summary', $6, $7::jsonb, 'pending_review')
        `,
        [
          memoryFactId,
          context.tenantId,
          context.userId,
          context.departmentId ?? null,
          context.teamName ?? null,
          savedSummary.id,
          JSON.stringify({
            customer_profile: summary.customer_profile,
            purchase_intent: summary.purchase_intent,
            negotiated_prices: summary.negotiated_prices,
            next_actions: summary.next_actions,
            memory_preview: summary.memory_preview,
          }),
        ],
      );
      memoryFactIds.push(memoryFactId);

      const handoff = await insertHandoffEvent(client, context, {
        from_agent_id: "cbe-accio-memory",
        to_agent_id: "cbe-buyer-screening",
        source_record_type: "accio_summary",
        source_record_id: savedSummary.id,
        payload_json: summary.screening_handoff_target ?? {
          company_name: summary.customer_profile.company_name,
          country: summary.customer_profile.country,
          email: summary.customer_profile.email,
          website: summary.customer_profile.website,
        },
        status: "pending",
        visibility_scope: "private",
      });
      handoffIds.push(handoff.id);
    }

    const agentRun = await completeAgentRun(client, context, {
      agentRunId: input.agent_run_id,
      sessionKey: input.session_key,
      currentStage: "accio_summaries_saved",
      metadataJson: {
        accio_import_id: importId,
        saved_summaries: summaries.length,
        memory_fact_ids: memoryFactIds,
        handoff_ids: handoffIds,
      },
    });
    if (!agentRun) {
      throw new CbeStoreError(404, "agent_run_missing", "Agent run was not found for Accio completion.");
    }
    await createAgentRunActivityEvent(client, context, {
      agentRunId: input.agent_run_id,
      agentId: "cbe-accio-memory",
      taskKind: "accio_memory",
      targetRecordType: "accio_import",
      targetRecordId: importId,
      targetSummary: `Saved ${summaries.length} Accio summaries`,
      stage: "completed",
      eventType: "accio_import_completed",
      status: "completed",
      metadataJson: { saved_summaries: summaries.length },
    });
    await createAuditEvent(client, context, {
      agentId: "cbe-accio-memory",
      eventType: "accio_summaries_saved",
      dataTier: "T2",
      metadataJson: {
        agent_run_id: input.agent_run_id,
        accio_import_id: importId,
        saved_summaries: summaries.length,
        memory_facts_pending_review: memoryFactIds.length,
        handoffs_created: handoffIds.length,
      },
    });
    return { agentRun, summaries, memoryFactIds, handoffIds };
  });
}

export async function listEmployeeMemoryRecords(context: TenantContext) {
  const result = await queryCbe<MemoryRow>(
    `
      select
        ai.id as import_id,
        asum.id as summary_id,
        ac.company_name,
        ac.country,
        mf.status as memory_fact_status,
        ai.uploaded_at
      from accio_imports ai
      left join accio_conversations ac
        on ac.tenant_id = ai.tenant_id
       and ac.accio_import_id = ai.id
      left join accio_summaries asum
        on asum.tenant_id = ai.tenant_id
       and asum.accio_conversation_id = ac.id
      left join memory_facts mf
        on mf.tenant_id = ai.tenant_id
       and mf.source_record_type = 'accio_summary'
       and mf.source_record_id = asum.id
      where ai.tenant_id = $1
        and (
          $2::boolean
          or ai.owner_user_id = $3
          or ai.visibility_scope = 'tenant_shared'
          or (ai.visibility_scope = 'team' and ai.team_name = $4)
        )
      order by ai.uploaded_at desc, ai.id desc
      limit 100
    `,
    [context.tenantId, context.cbeRole === "admin", context.userId, context.teamName ?? null],
  );
  return { items: result.rows.map(toMemoryRecord) };
}

export async function failAccioCompletion(
  context: TenantContext,
  input: { agentRunId: string; sessionKey?: string; message: string; details?: unknown },
) {
  return withCbeTransaction(async (client) => {
    return failAgentRun(client, context, {
      agentRunId: input.agentRunId,
      sessionKey: input.sessionKey,
      errorCode: "marker_parse_failed",
      errorMessage: input.message,
      metadataJson: { validation_error: input.details },
    });
  });
}
