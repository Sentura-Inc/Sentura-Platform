import type { PoolClient } from "pg";
import { queryCbe, withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import { completeAgentRun, createAgentRunActivityEvent, failAgentRun, insertAgentRun } from "./agent-runs";
import { createAuditEvent } from "./audit";
import { checkCbeCostBudgetBeforeRun } from "./admin";
import { insertHandoffEvent } from "./handoffs";
import { scopedOwnerClause } from "./tenant-context";
import type {
  AccioConversationImport,
  AccioSupplementTarget,
  AccioSummaryMarker,
  CompleteAccioImportRequest,
  CreateAccioImportRequest,
  TenantContext,
} from "./schemas";
import { CreateAccioImportRequestSchema } from "./schemas";

export interface AccioImportRecord {
  id: string;
  agentRunId: string | null;
  agentRunStatus: string | null;
  sourceFileName: string | null;
  validationStatus: string;
  classification: string;
  uploadedAt: string;
  supplementTarget: {
    customerId: string;
    companyName: string;
    source: string;
  } | null;
}

export interface AccioSummaryRecord {
  id: string;
  accioConversationId: string;
  sourceRecordType: string;
}

export interface EmployeeMemoryRecord {
  importId: string;
  summaryId: string | null;
  agentRunId: string | null;
  agentRunStatus: string | null;
  sourceFileName: string | null;
  companyName: string | null;
  country: string | null;
  conversationCount: number;
  nextActions: string[];
  summaryText: string | null;
  memoryFactStatus: string | null;
  validationStatus: string;
  classification: string;
  uploadedAt: string;
  supplementTarget: {
    customerId: string;
    companyName: string;
    source: string;
  } | null;
}

interface AccioImportRow {
  id: string;
  agent_run_id: string | null;
  agent_run_status: string | null;
  source_file_name: string | null;
  validation_status: string;
  classification: string;
  uploaded_at: Date;
  supplement_target_json: Record<string, unknown> | null;
  reused_summary_id: string | null;
}

interface AccioSummaryRow {
  id: string;
  accio_conversation_id: string;
}

interface MemoryDeleteImportRow {
  id: string;
}

interface MemoryDeleteSummaryRow {
  id: string;
  accio_conversation_id: string;
  accio_import_id: string;
}

interface MemoryDeleteIdRow {
  id: string;
}

interface MemoryRow {
  import_id: string;
  summary_id: string | null;
  agent_run_id: string | null;
  agent_run_status: string | null;
  source_file_name: string | null;
  company_name: string | null;
  country: string | null;
  conversation_count: string;
  customer_profile_json: Record<string, unknown> | null;
  purchase_intent_json: unknown;
  negotiated_price_json: unknown;
  next_actions_json: unknown;
  behavior_signals_json: Record<string, unknown> | null;
  supplement_target_json: Record<string, unknown> | null;
  memory_fact_status: string | null;
  validation_status: string;
  classification: string;
  uploaded_at: Date;
}

interface AccioImportPayloadRow {
  import_id: string;
  source_file_name: string | null;
  classification: string;
  uploaded_at: Date;
  conversation_id: string | null;
  external_conversation_id: string | null;
  company_name: string | null;
  country: string | null;
  contact_person: string | null;
  email: string | null;
  website: string | null;
  message_ts: Date | null;
  sender_role: string | null;
  text_redacted: string | null;
  attachment_json: unknown;
  supplement_target_json: Record<string, unknown> | null;
}

function firstObject(value: unknown) {
  if (Array.isArray(value)) {
    const found = value.find((item) => item && typeof item === "object" && !Array.isArray(item));
    return found ? (found as Record<string, unknown>) : null;
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function toSupplementTarget(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const customerId = stringValue(record.customer_id ?? record.customerId);
  const companyName = stringValue(record.company_name ?? record.companyName);
  const source = stringValue(record.source);
  if (!customerId || !companyName || !source) return null;
  return { customerId, companyName, source };
}

function supplementTargetMetadata(target: AccioSupplementTarget | undefined) {
  return target
    ? {
        customer_id: target.customer_id,
        company_name: target.company_name,
        source: target.source,
      }
    : undefined;
}

function moneyValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return `USD ${value}`;
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function buildMemorySummary(row: MemoryRow) {
  const behaviorSummary =
    row.behavior_signals_json &&
    typeof row.behavior_signals_json === "object" &&
    typeof row.behavior_signals_json.summary === "string"
      ? row.behavior_signals_json.summary
      : null;
  if (behaviorSummary) return behaviorSummary;

  const intent = firstObject(row.purchase_intent_json);
  const price = firstObject(row.negotiated_price_json);
  const nextActions = Array.isArray(row.next_actions_json)
    ? row.next_actions_json.map((item) => String(item)).filter(Boolean)
    : [];
  const pieces = [
    row.company_name ? `${row.company_name} 的 Accio 对话已整理` : "Accio 对话已整理",
    stringValue(intent?.product) ? `产品：${stringValue(intent?.product)}` : null,
    stringValue(intent?.quantity) ? `数量：${stringValue(intent?.quantity)} pcs` : null,
    moneyValue(intent?.target_price_usd ?? price?.target_price_usd) ? `目标价：${moneyValue(intent?.target_price_usd ?? price?.target_price_usd)}` : null,
    moneyValue(intent?.seller_best_price_usd ?? price?.agreed_or_best_price_usd ?? price?.quoted_price_usd)
      ? `卖方报价/最好价：${moneyValue(intent?.seller_best_price_usd ?? price?.agreed_or_best_price_usd ?? price?.quoted_price_usd)}`
      : null,
    stringValue(intent?.incoterm) ? `贸易条款：${stringValue(intent?.incoterm)}` : null,
    stringValue(intent?.payment_terms) ? `付款：${stringValue(intent?.payment_terms)}` : null,
    nextActions[0] ? `下一步：${nextActions[0]}` : null,
  ].filter((item): item is string => Boolean(item));

  return pieces.length > 1 ? pieces.join("；") : null;
}

function toAccioImportRecord(row: AccioImportRow): AccioImportRecord {
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    agentRunStatus: row.agent_run_status,
    sourceFileName: row.source_file_name,
    validationStatus: row.validation_status,
    classification: row.classification,
    uploadedAt: row.uploaded_at.toISOString(),
    supplementTarget: toSupplementTarget(row.supplement_target_json),
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
    agentRunId: row.agent_run_id,
    agentRunStatus: row.agent_run_status,
    sourceFileName: row.source_file_name,
    companyName: row.company_name,
    country: row.country,
    conversationCount: Number(row.conversation_count),
    nextActions: Array.isArray(row.next_actions_json)
      ? row.next_actions_json.map((item) => String(item)).filter(Boolean)
      : [],
    summaryText: buildMemorySummary(row),
    memoryFactStatus: row.memory_fact_status,
    validationStatus: row.validation_status,
    classification: row.classification,
    uploadedAt: row.uploaded_at.toISOString(),
    supplementTarget: toSupplementTarget(row.supplement_target_json),
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

async function insertConversationMessages(
  client: PoolClient,
  context: TenantContext,
  conversationId: string,
  conversation: AccioConversationImport,
) {
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
}

async function deleteScreeningReportsForCustomerReference(
  client: PoolClient,
  context: TenantContext,
  customerId: string,
  options: { deleteTargets: boolean },
) {
  const linkedReports = await client.query<{ report_id: string; target_id: string }>(
    `
      select sr.id as report_id, sr.screening_target_id as target_id
      from screening_reports sr
      where sr.tenant_id = $1
        and (
          sr.screening_target_id = $2
          or sr.report_json->'target'->>'lead_id' = $2
          or sr.report_json->'target'->>'target_id' = $2
          or sr.report_json->>'lead_id' = $2
        )
    `,
    [context.tenantId, customerId],
  );
  const reportIds = linkedReports.rows.map((row) => row.report_id);
  const targetIds = linkedReports.rows.map((row) => row.target_id);
  if (reportIds.length > 0) {
    await client.query(
      `delete from screening_score_blocks where tenant_id = $1 and screening_report_id = any($2::text[])`,
      [context.tenantId, reportIds],
    );
    await client.query(
      `delete from screening_evidence where tenant_id = $1 and screening_report_id = any($2::text[])`,
      [context.tenantId, reportIds],
    );
    await client.query(
      `delete from screening_reports where tenant_id = $1 and id = any($2::text[])`,
      [context.tenantId, reportIds],
    );
  }
  if (options.deleteTargets && targetIds.length > 0) {
    await client.query(
      `delete from screening_targets where tenant_id = $1 and id = any($2::text[])`,
      [context.tenantId, targetIds],
    );
  }
}

async function deleteScreeningReportsForAccioSummary(
  client: PoolClient,
  context: TenantContext,
  summaryId: string,
) {
  await deleteScreeningReportsForCustomerReference(client, context, summaryId, { deleteTargets: true });
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
  const supplementInputTarget = input.supplement_target;
  const supplementTarget = supplementTargetMetadata(input.supplement_target);
  await checkCbeCostBudgetBeforeRun(context, {
    agentId: "cbe-accio-memory",
    taskKind: "accio_memory",
    targetSummary: input.source_file_name,
    estimatedCostUsd: input.estimated_cost_usd,
    metadataJson: {
      source_file_name: input.source_file_name,
      conversation_count: input.conversations.length,
      ...(supplementTarget ? { supplement_target: supplementTarget } : {}),
    },
  });
  if (supplementInputTarget) {
    const merged = await withCbeTransaction(async (client) => {
      const existing = await client.query<{
        import_id: string;
        conversation_id: string | null;
        summary_id: string | null;
      }>(
        `
          select import_id, conversation_id, summary_id
          from (
            select
              ac.accio_import_id as import_id,
              ac.id as conversation_id,
              asum.id as summary_id,
              0 as priority,
              asum.created_at as sort_at
            from accio_summaries asum
            join accio_conversations ac
              on ac.tenant_id = asum.tenant_id
             and ac.id = asum.accio_conversation_id
            where asum.tenant_id = $1
              and (
                (asum.id = $2 and $6 = 'accio_handoff')
                or asum.behavior_signals_json->'supplement_target'->>'customer_id' = $2
                or asum.behavior_signals_json->'supplement_target'->>'customerId' = $2
              )
              and (
                $3::boolean
                or asum.owner_user_id = $4
                or asum.visibility_scope = 'tenant_shared'
                or (asum.visibility_scope = 'team' and asum.team_name = $5)
              )
            union all
            select
              ai.id as import_id,
              ac.id as conversation_id,
              null::text as summary_id,
              1 as priority,
              ai.uploaded_at as sort_at
            from accio_imports ai
            join agent_runs ar
              on ar.tenant_id = ai.tenant_id
             and ar.id = ai.agent_run_id
            left join accio_conversations ac
              on ac.tenant_id = ai.tenant_id
             and ac.accio_import_id = ai.id
            where ai.tenant_id = $1
              and (
                ar.metadata_json->'supplement_target'->>'customer_id' = $2
                or ar.metadata_json->'supplement_target'->>'customerId' = $2
              )
              and (
                $3::boolean
                or ai.owner_user_id = $4
                or ai.visibility_scope = 'tenant_shared'
                or (ai.visibility_scope = 'team' and ai.team_name = $5)
              )
          ) existing_target
          order by priority, sort_at desc
          limit 1
        `,
        [
          context.tenantId,
          supplementInputTarget.customer_id,
          context.cbeRole === "admin",
          context.userId,
          context.teamName ?? null,
          supplementInputTarget.source,
        ],
      );
      const target = existing.rows[0];
      if (!target) {
        if (supplementInputTarget.source === "accio_handoff") {
          throw new CbeStoreError(
            404,
            "accio_summary_missing",
            "Original Accio memory customer was not found; refusing to create a duplicate customer record.",
          );
        }
        return null;
      }

      const agentRun = await insertAgentRun(client, context, {
        agent_id: "cbe-accio-memory",
        task_kind: "accio_memory",
        status: input.session_key ? "running" : "queued",
        session_key: input.session_key,
        target_record_type: "accio_import",
        target_record_id: target.import_id,
        target_summary: input.source_file_name,
        current_stage: input.session_key ? "submitted_to_employee" : "uploaded",
        cost_usd_estimate: input.estimated_cost_usd,
        visibility_scope: input.visibility_scope,
        metadata_json: {
          source_file_name: input.source_file_name,
          supplement_target: supplementTarget,
          supplement_mode: "merge_existing_accio_summary",
          ...(target.summary_id ? { reused_summary_id: target.summary_id } : {}),
        },
      });

      await client.query(
        `
          update accio_imports
          set
            agent_run_id = $3,
            source_file_name = coalesce($4, source_file_name),
            uploaded_at = now()
          where tenant_id = $1
            and id = $2
        `,
        [context.tenantId, target.import_id, agentRun.id, input.source_file_name ?? null],
      );
      let primaryConversationId = target.conversation_id;
      for (const [index, conversation] of input.conversations.entries()) {
        if (primaryConversationId && index === 0) {
          await client.query(
            `
              update accio_conversations
              set
                company_name = coalesce($3, company_name),
                country = coalesce($4, country),
                contact_person = coalesce($5, contact_person),
                email = coalesce($6, email),
                website = coalesce($7, website)
              where tenant_id = $1
                and id = $2
            `,
            [
              context.tenantId,
              primaryConversationId,
              supplementInputTarget.company_name,
              conversation.country ?? null,
              conversation.contact_person ?? null,
              conversation.email ?? null,
              conversation.website ?? null,
            ],
          );
          await insertConversationMessages(client, context, primaryConversationId, conversation);
        } else {
          const conversationId = await insertConversation(client, context, target.import_id, {
            ...conversation,
            company_name: conversation.company_name ?? supplementInputTarget.company_name,
          });
          if (!primaryConversationId) primaryConversationId = conversationId;
        }
      }

      if (target.summary_id) {
        await client.query(
          `
            delete from memory_facts
            where tenant_id = $1
              and source_record_type = 'accio_summary'
              and source_record_id = $2
          `,
          [context.tenantId, target.summary_id],
        );
        await client.query(
          `
            delete from handoff_events
            where tenant_id = $1
              and source_record_type = 'accio_summary'
              and source_record_id = $2
          `,
          [context.tenantId, target.summary_id],
        );
      }
      await createAgentRunActivityEvent(client, context, {
        agentRunId: agentRun.id,
        agentId: "cbe-accio-memory",
        taskKind: "accio_memory",
        targetRecordType: "accio_import",
        targetRecordId: target.import_id,
        targetSummary: input.source_file_name,
        stage: agentRun.status,
        eventType: "accio_import_supplemented",
        status: agentRun.status,
        metadataJson: { supplement_target: supplementTarget, conversation_count: input.conversations.length },
      });
      await createAuditEvent(client, context, {
        agentId: "cbe-accio-memory",
        eventType: "accio_import_supplemented",
        dataTier: "T2",
        metadataJson: {
          agent_run_id: agentRun.id,
          accio_import_id: target.import_id,
          replaced_summary_id: target.summary_id,
          supplement_target: supplementTarget,
        },
      });
      const importResult = await client.query<AccioImportRow>(
        `
          select
            ai.id,
            ai.agent_run_id,
            ar.status as agent_run_status,
            ai.source_file_name,
            ai.validation_status,
            ai.classification,
            ai.uploaded_at,
            ar.metadata_json->'supplement_target' as supplement_target_json,
            ar.metadata_json->>'reused_summary_id' as reused_summary_id
          from accio_imports ai
          left join agent_runs ar
            on ar.tenant_id = ai.tenant_id
           and ar.id = ai.agent_run_id
          where ai.tenant_id = $1
            and ai.id = $2
          limit 1
        `,
        [context.tenantId, target.import_id],
      );
      return {
        agentRun,
        accioImport: toAccioImportRecord(importResult.rows[0]),
      };
    });
    if (merged) return merged;
  }
  return withCbeTransaction(async (client) => {
    const agentRun = await insertAgentRun(client, context, {
      agent_id: "cbe-accio-memory",
      task_kind: "accio_memory",
      status: input.session_key ? "running" : "queued",
      session_key: input.session_key,
      target_summary: input.source_file_name,
      current_stage: input.session_key ? "submitted_to_employee" : "uploaded",
      cost_usd_estimate: input.estimated_cost_usd,
      visibility_scope: input.visibility_scope,
      metadata_json: {
        source_file_name: input.source_file_name,
        ...(supplementTarget ? { supplement_target: supplementTarget } : {}),
      },
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
        returning
          id,
          agent_run_id,
          null::text as agent_run_status,
          source_file_name,
          validation_status,
          classification,
          uploaded_at,
          null::jsonb as supplement_target_json,
          null::text as reused_summary_id
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
        select
          ai.id,
          ai.agent_run_id,
          ar.status as agent_run_status,
          ai.source_file_name,
          ai.validation_status,
          ai.classification,
          ai.uploaded_at,
          ar.metadata_json->'supplement_target' as supplement_target_json,
          ar.metadata_json->>'reused_summary_id' as reused_summary_id
        from accio_imports ai
        left join agent_runs ar
          on ar.tenant_id = ai.tenant_id
         and ar.id = ai.agent_run_id
        where ai.tenant_id = $1
          and ai.id = $2
        limit 1
      `,
      [context.tenantId, importId],
    );
    if (!importRows.rows[0]) {
      throw new CbeStoreError(404, "accio_import_missing", "Accio import was not found.");
    }
    const supplementTarget = toSupplementTarget(importRows.rows[0].supplement_target_json);
    const supplementTargetJson = supplementTarget
      ? {
          customer_id: supplementTarget.customerId,
          company_name: supplementTarget.companyName,
          source: supplementTarget.source,
        }
      : null;
    const reusableSummaryId =
      importRows.rows[0].reused_summary_id ??
      (
        supplementTargetJson?.source === "accio_handoff" &&
        supplementTargetJson.customer_id.startsWith("accio_summary")
          ? supplementTargetJson.customer_id
          : null
      );
    const summariesToSave = supplementTargetJson ? input.payload.summaries.slice(0, 1) : input.payload.summaries;
    if (reusableSummaryId) {
      await deleteScreeningReportsForAccioSummary(client, context, reusableSummaryId);
    } else if (supplementTargetJson?.source === "manual_screening") {
      await deleteScreeningReportsForCustomerReference(client, context, supplementTargetJson.customer_id, {
        deleteTargets: false,
      });
    }

    const summaries = [];
    const memoryFactIds: string[] = [];
    const handoffIds: string[] = [];
    for (const [summaryIndex, summary] of summariesToSave.entries()) {
      const conversationId = await findOrCreateConversationForSummary(client, context, importId, summary);
      const summaryId = summaryIndex === 0 && reusableSummaryId ? reusableSummaryId : createCbeId("accio_summary");
      const behaviorSignals = {
        ...summary.behavior_signals,
        ...(supplementTargetJson ? { supplement_target: supplementTargetJson } : {}),
      };
      const handoffTarget = supplementTargetJson
        ? {
            ...(summary.screening_handoff_target ?? {}),
            lead_id: supplementTargetJson.customer_id,
            target_id: supplementTargetJson.customer_id,
            company_name: supplementTargetJson.company_name,
            source: supplementTargetJson.source === "manual_screening" ? "manual_input" : "accio_memory",
          }
        : summary.screening_handoff_target;
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
          on conflict (id) do update
          set
            accio_conversation_id = excluded.accio_conversation_id,
            agent_run_id = excluded.agent_run_id,
            created_by_user_id = excluded.created_by_user_id,
            owner_user_id = excluded.owner_user_id,
            department_id = excluded.department_id,
            team_name = excluded.team_name,
            visibility_scope = excluded.visibility_scope,
            customer_profile_json = excluded.customer_profile_json,
            purchase_intent_json = excluded.purchase_intent_json,
            negotiated_price_json = excluded.negotiated_price_json,
            next_actions_json = excluded.next_actions_json,
            behavior_signals_json = excluded.behavior_signals_json
          returning id, accio_conversation_id
        `,
        [
          summaryId,
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
          JSON.stringify(behaviorSignals),
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
            negotiation_summary: summary.negotiation_summary,
            next_actions: summary.next_actions,
            behavior_signals: behaviorSignals,
            memory_preview: summary.memory_preview,
            source_references: summary.source_references,
          }),
        ],
      );
      memoryFactIds.push(memoryFactId);

      const handoff = await insertHandoffEvent(client, context, {
        from_agent_id: "cbe-accio-memory",
        to_agent_id: "cbe-buyer-screening",
        source_record_type: "accio_summary",
        source_record_id: savedSummary.id,
        payload_json: handoffTarget ?? {
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
        ai.agent_run_id,
        ar.status as agent_run_status,
        ai.source_file_name,
        coalesce(ac.company_name, asum.customer_profile_json->>'company_name') as company_name,
        coalesce(ac.country, asum.customer_profile_json->>'country') as country,
        count(ac.id) over (partition by ai.id)::text as conversation_count,
        asum.customer_profile_json,
        asum.purchase_intent_json,
        asum.negotiated_price_json,
        asum.next_actions_json,
        asum.behavior_signals_json,
        coalesce(
          asum.behavior_signals_json->'supplement_target',
          ar.metadata_json->'supplement_target'
        ) as supplement_target_json,
        mf.status as memory_fact_status,
        ai.validation_status,
        ai.classification,
        ai.uploaded_at
      from accio_imports ai
      left join accio_conversations ac
        on ac.tenant_id = ai.tenant_id
       and ac.accio_import_id = ai.id
      left join agent_runs ar
        on ar.tenant_id = ai.tenant_id
       and ar.id = ai.agent_run_id
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
        and (
          asum.id is not null
          or (
            coalesce(ar.status, 'queued') not in ('running', 'polling')
            and not exists (
              select 1
              from accio_summaries existing_summary
              join accio_conversations summary_conversation
                on summary_conversation.tenant_id = existing_summary.tenant_id
               and summary_conversation.id = existing_summary.accio_conversation_id
              where existing_summary.tenant_id = ai.tenant_id
                and summary_conversation.accio_import_id = ai.id
            )
            and not exists (
              select 1
              from accio_summaries duplicate_summary
              join accio_conversations duplicate_conversation
                on duplicate_conversation.tenant_id = duplicate_summary.tenant_id
               and duplicate_conversation.id = duplicate_summary.accio_conversation_id
              where duplicate_summary.tenant_id = ai.tenant_id
                and duplicate_summary.owner_user_id = ai.owner_user_id
                and lower(coalesce(duplicate_conversation.company_name, duplicate_summary.customer_profile_json->>'company_name', '')) =
                    lower(coalesce(ac.company_name, ''))
                and coalesce(ac.company_name, '') <> ''
            )
          )
        )
      order by ai.uploaded_at desc, ai.id desc
      limit 100
    `,
    [context.tenantId, context.cbeRole === "admin", context.userId, context.teamName ?? null],
  );
  return { items: result.rows.map(toMemoryRecord) };
}

export async function deleteEmployeeMemoryRecords(context: TenantContext, ids: string[]) {
  const requestedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (requestedIds.length === 0) {
    throw new CbeStoreError(400, "memory_delete_empty", "No memory records were selected for deletion.");
  }

  return withCbeTransaction(async (client) => {
    const importScope = scopedOwnerClause(context, "ai", 3);
    const importRows = await client.query<MemoryDeleteImportRow>(
      `
        select ai.id
        from accio_imports ai
        where ai.tenant_id = $1
          and ai.id = any($2::text[])
          ${importScope.sql}
      `,
      [context.tenantId, requestedIds, ...importScope.values],
    );
    const selectedImportIds = importRows.rows.map((row) => row.id);

    const summaryScope = scopedOwnerClause(context, "asum", 3);
    const summaryRows = await client.query<MemoryDeleteSummaryRow>(
      `
        select
          asum.id,
          asum.accio_conversation_id,
          ac.accio_import_id
        from accio_summaries asum
        join accio_conversations ac
          on ac.tenant_id = asum.tenant_id
         and ac.id = asum.accio_conversation_id
        where asum.tenant_id = $1
          and asum.id = any($2::text[])
          ${summaryScope.sql}
      `,
      [context.tenantId, requestedIds, ...summaryScope.values],
    );

    const selectedSummaryIds = summaryRows.rows.map((row) => row.id);
    if (selectedImportIds.length === 0 && selectedSummaryIds.length === 0) {
      throw new CbeStoreError(404, "memory_record_missing", "Selected memory records were not found.");
    }

    const conversationIds = new Set(summaryRows.rows.map((row) => row.accio_conversation_id));
    if (selectedImportIds.length > 0) {
      const conversationRows = await client.query<MemoryDeleteIdRow>(
        `
          select id
          from accio_conversations
          where tenant_id = $1
            and accio_import_id = any($2::text[])
        `,
        [context.tenantId, selectedImportIds],
      );
      for (const row of conversationRows.rows) conversationIds.add(row.id);
    }

    const conversationIdList = Array.from(conversationIds);
    let summaryIdsToDelete = [...selectedSummaryIds];
    if (conversationIdList.length > 0) {
      const summaryRowsForConversations = await client.query<MemoryDeleteIdRow>(
        `
          select id
          from accio_summaries
          where tenant_id = $1
            and accio_conversation_id = any($2::text[])
        `,
        [context.tenantId, conversationIdList],
      );
      summaryIdsToDelete = Array.from(new Set([
        ...summaryIdsToDelete,
        ...summaryRowsForConversations.rows.map((row) => row.id),
      ]));
    }

    const candidateImportIds = Array.from(new Set([
      ...selectedImportIds,
      ...summaryRows.rows.map((row) => row.accio_import_id),
    ]));

    if (summaryIdsToDelete.length > 0) {
      await client.query(
        `
          delete from memory_facts
          where tenant_id = $1
            and source_record_type = 'accio_summary'
            and source_record_id = any($2::text[])
        `,
        [context.tenantId, summaryIdsToDelete],
      );
      await client.query(
        `
          delete from handoff_events
          where tenant_id = $1
            and source_record_type = 'accio_summary'
            and source_record_id = any($2::text[])
        `,
        [context.tenantId, summaryIdsToDelete],
      );
      await client.query(
        `
          delete from accio_summaries
          where tenant_id = $1
            and id = any($2::text[])
        `,
        [context.tenantId, summaryIdsToDelete],
      );
    }

    if (conversationIdList.length > 0) {
      await client.query(
        `
          delete from accio_messages
          where tenant_id = $1
            and accio_conversation_id = any($2::text[])
        `,
        [context.tenantId, conversationIdList],
      );
      await client.query(
        `
          delete from accio_conversations
          where tenant_id = $1
            and id = any($2::text[])
        `,
        [context.tenantId, conversationIdList],
      );
    }

    let deletedImportIds: string[] = [];
    if (candidateImportIds.length > 0) {
      const deletedImports = await client.query<MemoryDeleteIdRow>(
        `
          delete from accio_imports ai
          where ai.tenant_id = $1
            and ai.id = any($2::text[])
            and not exists (
              select 1
              from accio_conversations ac
              where ac.tenant_id = ai.tenant_id
                and ac.accio_import_id = ai.id
            )
          returning ai.id
        `,
        [context.tenantId, candidateImportIds],
      );
      deletedImportIds = deletedImports.rows.map((row) => row.id);
    }

    await createAuditEvent(client, context, {
      agentId: "cbe-accio-memory",
      eventType: "accio_memory_deleted",
      dataTier: "T2",
      metadataJson: {
        requested_ids: requestedIds,
        deleted_summary_ids: summaryIdsToDelete,
        deleted_conversation_ids: conversationIdList,
        deleted_import_ids: deletedImportIds,
      },
    });

    return {
      deletedRecordIds: requestedIds,
      deletedSummaryIds: summaryIdsToDelete,
      deletedConversationIds: conversationIdList,
      deletedImportIds,
    };
  });
}

export async function getAccioImportAnalysisPayload(context: TenantContext, importId: string) {
  const result = await queryCbe<AccioImportPayloadRow>(
    `
      select
        ai.id as import_id,
        ai.source_file_name,
        ai.classification,
        ai.uploaded_at,
        ac.id as conversation_id,
        ac.external_conversation_id,
        ac.company_name,
        ac.country,
        ac.contact_person,
        ac.email,
        ac.website,
        am.message_ts,
        am.sender_role,
        am.text_redacted,
        am.attachment_json,
        ar.metadata_json->'supplement_target' as supplement_target_json
      from accio_imports ai
      left join agent_runs ar
        on ar.tenant_id = ai.tenant_id
       and ar.id = ai.agent_run_id
      left join accio_conversations ac
        on ac.tenant_id = ai.tenant_id
       and ac.accio_import_id = ai.id
      left join accio_messages am
        on am.tenant_id = ai.tenant_id
       and am.accio_conversation_id = ac.id
      where ai.tenant_id = $1
        and ai.id = $2
        and (
          $3::boolean
          or ai.owner_user_id = $4
          or ai.visibility_scope = 'tenant_shared'
          or (ai.visibility_scope = 'team' and ai.team_name = $5)
        )
      order by ac.id, am.message_ts nulls last
    `,
    [context.tenantId, importId, context.cbeRole === "admin", context.userId, context.teamName ?? null],
  );
  if (result.rows.length === 0) {
    throw new CbeStoreError(404, "accio_import_missing", "Accio import was not found.");
  }

  const first = result.rows[0];
  const conversations = new Map<string, {
    conversation_id: string;
    buyer: Record<string, unknown>;
    messages: Array<Record<string, unknown>>;
    attachments: unknown[];
  }>();

  for (const row of result.rows) {
    if (!row.conversation_id) continue;
    const key = row.external_conversation_id ?? row.conversation_id;
    let conversation = conversations.get(key);
    if (!conversation) {
      conversation = {
        conversation_id: key,
        buyer: {
          company_name: row.company_name ?? undefined,
          display_name: row.company_name ?? undefined,
          country: row.country ?? undefined,
          contact_person: row.contact_person ?? undefined,
          email: row.email ?? undefined,
          website: row.website ?? undefined,
        },
        messages: [],
        attachments: [],
      };
      conversations.set(key, conversation);
    }
    const attachments = Array.isArray(row.attachment_json) ? row.attachment_json : [];
    if (attachments.length) conversation.attachments.push(...attachments);
    if (row.text_redacted) {
      conversation.messages.push({
        timestamp: row.message_ts?.toISOString(),
        sender: row.sender_role ?? "unknown",
        text: row.text_redacted,
      });
    }
  }

  return {
    export_metadata: {
      platform: "stored_accio_import",
      exported_at: first.uploaded_at.toISOString(),
      seller_company: "Sentura cross-border demo",
      source_file: first.source_file_name ?? importId,
      data_classification: first.classification,
      import_id: first.import_id,
      supplement_target: first.supplement_target_json ?? undefined,
    },
    conversations: Array.from(conversations.values()),
  };
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
