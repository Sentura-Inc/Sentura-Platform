import type { PoolClient } from "pg";
import { withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import { completeAgentRun, createAgentRunActivityEvent, failAgentRun, insertAgentRun } from "./agent-runs";
import { createAuditEvent } from "./audit";
import type {
  CompleteLeadRunRequest,
  CreateLeadRunRequest,
  LeadCandidateMarker,
  LeadDiscoveryEvidence,
  TenantContext,
} from "./schemas";
import { CreateLeadRunRequestSchema } from "./schemas";
import { checkCbeCostBudgetBeforeRun } from "./admin";

export interface LeadRunRecord {
  id: string;
  agentRunId: string | null;
  status: string;
  targetCount: number;
  completedAt: string | null;
}

export interface LeadCandidateRecord {
  id: string;
  companyName: string;
  normalizedDomain: string | null;
  country: string | null;
  status: string;
}

export interface LeadSourceRecord {
  id: string;
  leadCandidateId: string;
  sourceUrl: string | null;
}

interface LeadRunRow {
  id: string;
  agent_run_id: string | null;
  status: string;
  target_count: number;
  completed_at: Date | null;
}

interface LeadCandidateRow {
  id: string;
  company_name: string;
  normalized_domain: string | null;
  country: string | null;
  status: string;
}

interface LeadSourceRow {
  id: string;
  lead_candidate_id: string;
  source_url: string | null;
}

function toLeadRunRecord(row: LeadRunRow): LeadRunRecord {
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    status: row.status,
    targetCount: row.target_count,
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

function toLeadCandidateRecord(row: LeadCandidateRow): LeadCandidateRecord {
  return {
    id: row.id,
    companyName: row.company_name,
    normalizedDomain: row.normalized_domain,
    country: row.country,
    status: row.status,
  };
}

function toLeadSourceRecord(row: LeadSourceRow): LeadSourceRecord {
  return {
    id: row.id,
    leadCandidateId: row.lead_candidate_id,
    sourceUrl: row.source_url,
  };
}

function normalizeDomain(value?: string) {
  if (!value) return null;
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

function identityKeyForLead(lead: LeadCandidateMarker) {
  const domain = normalizeDomain(lead.domain ?? lead.website);
  if (domain) return `domain:${domain}`;
  return `name:${lead.company_name.trim().toLowerCase()}|country:${lead.country}`;
}

async function upsertLeadIdentity(
  client: PoolClient,
  context: TenantContext,
  lead: LeadCandidateMarker,
) {
  const identityKey = identityKeyForLead(lead);
  const normalizedDomain = normalizeDomain(lead.domain ?? lead.website);
  const id = createCbeId("lead_identity");
  const result = await client.query<{ id: string }>(
    `
      insert into lead_identities (
        id,
        tenant_id,
        identity_key,
        normalized_domain,
        normalized_company_name,
        country,
        confidence,
        last_seen_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, now())
      on conflict (tenant_id, identity_key)
      do update set
        normalized_domain = coalesce(excluded.normalized_domain, lead_identities.normalized_domain),
        normalized_company_name = excluded.normalized_company_name,
        country = coalesce(excluded.country, lead_identities.country),
        confidence = coalesce(excluded.confidence, lead_identities.confidence),
        last_seen_at = now()
      returning id
    `,
    [
      id,
      context.tenantId,
      identityKey,
      normalizedDomain,
      lead.company_name.trim().toLowerCase(),
      lead.country,
      lead.confidence ?? null,
    ],
  );
  return result.rows[0].id;
}

async function insertLeadSource(
  client: PoolClient,
  context: TenantContext,
  candidateId: string,
  evidence: LeadDiscoveryEvidence,
) {
  const result = await client.query<LeadSourceRow>(
    `
      insert into lead_sources (
        id,
        tenant_id,
        lead_candidate_id,
        source_type,
        source_url,
        query,
        excerpt,
        fetched_at,
        confidence
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9)
      returning id, lead_candidate_id, source_url
    `,
    [
      createCbeId("lead_source"),
      context.tenantId,
      candidateId,
      evidence.source_type,
      evidence.source_url,
      evidence.query ?? null,
      evidence.excerpt ?? evidence.finding ?? evidence.signal ?? null,
      evidence.fetched_at,
      evidence.confidence ?? null,
    ],
  );
  return toLeadSourceRecord(result.rows[0]);
}

export async function createLeadRun(
  context: TenantContext,
  rawInput: CreateLeadRunRequest,
) {
  const input = CreateLeadRunRequestSchema.parse(rawInput);
  await checkCbeCostBudgetBeforeRun(context, {
    agentId: "cbe-lead-discovery",
    taskKind: "lead",
    targetSummary: input.target_summary,
    estimatedCostUsd: input.estimated_cost_usd,
    metadataJson: { query_config: input.query_config, target_count: input.target_count },
  });
  return withCbeTransaction(async (client) => {
    const agentRun = await insertAgentRun(client, context, {
      agent_id: "cbe-lead-discovery",
      task_kind: "lead",
      status: input.session_key ? "running" : "queued",
      session_key: input.session_key,
      target_summary: input.target_summary,
      current_stage: input.session_key ? "submitted_to_employee" : "queued",
      cost_usd_estimate: input.estimated_cost_usd,
      visibility_scope: input.visibility_scope,
      metadata_json: { query_config: input.query_config },
    });
    const leadRunId = createCbeId("lead_run");
    const leadRun = await client.query<LeadRunRow>(
      `
        insert into lead_runs (
          id,
          tenant_id,
          user_id,
          owner_user_id,
          department_id,
          team_name,
          visibility_scope,
          agent_run_id,
          query_config_json,
          status,
          target_count
        )
        values ($1, $2, $3, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
        returning id, agent_run_id, status, target_count, completed_at
      `,
      [
        leadRunId,
        context.tenantId,
        context.userId,
        context.departmentId ?? null,
        context.teamName ?? null,
        input.visibility_scope,
        agentRun.id,
        JSON.stringify(input.query_config),
        input.session_key ? "running" : "queued",
        input.target_count,
      ],
    );
    await createAgentRunActivityEvent(client, context, {
      agentRunId: agentRun.id,
      agentId: "cbe-lead-discovery",
      taskKind: "lead",
      targetRecordType: "lead_run",
      targetRecordId: leadRunId,
      targetSummary: input.target_summary,
      stage: input.session_key ? "running" : "queued",
      eventType: "lead_run_created",
      status: agentRun.status,
      metadataJson: { target_count: input.target_count },
    });
    await createAuditEvent(client, context, {
      agentId: "cbe-lead-discovery",
      eventType: "lead_run_created",
      dataTier: "T1",
      metadataJson: { agent_run_id: agentRun.id, lead_run_id: leadRunId },
    });
    return { agentRun, leadRun: toLeadRunRecord(leadRun.rows[0]) };
  });
}

export async function saveLeadRunResult(
  context: TenantContext,
  leadRunId: string,
  input: CompleteLeadRunRequest,
) {
  return withCbeTransaction(async (client) => {
    const existing = await client.query<LeadRunRow>(
      `
        select id, agent_run_id, status, target_count, completed_at
        from lead_runs
        where tenant_id = $1
          and id = $2
        limit 1
      `,
      [context.tenantId, leadRunId],
    );
    if (!existing.rows[0]) {
      throw new CbeStoreError(404, "lead_run_missing", "Lead run was not found.");
    }

    const candidateRecords: LeadCandidateRecord[] = [];
    const sourceRecords: LeadSourceRecord[] = [];
    for (const [index, lead] of input.payload.leads.entries()) {
      const leadIdentityId = await upsertLeadIdentity(client, context, lead);
      const normalizedDomain = normalizeDomain(lead.domain ?? lead.website);
      const candidateResult = await client.query<LeadCandidateRow>(
        `
          insert into lead_candidates (
            id,
            tenant_id,
            lead_run_id,
            lead_identity_id,
            created_by_user_id,
            owner_user_id,
            department_id,
            team_name,
            visibility_scope,
            normalized_domain,
            company_name,
            country,
            buyer_type,
            matched_products_json,
            confidence,
            dedupe_key,
            status
          )
          values ($1, $2, $3, $4, $5, $5, $6, $7, 'private', $8, $9, $10, $11, $12::jsonb, $13, $14, 'new')
          on conflict (tenant_id, normalized_domain) where normalized_domain is not null
          do update set
            lead_identity_id = excluded.lead_identity_id,
            matched_products_json = excluded.matched_products_json,
            confidence = coalesce(excluded.confidence, lead_candidates.confidence),
            dedupe_key = coalesce(excluded.dedupe_key, lead_candidates.dedupe_key)
          returning id, company_name, normalized_domain, country, status
        `,
        [
          createCbeId("lead"),
          context.tenantId,
          leadRunId,
          leadIdentityId,
          context.userId,
          context.departmentId ?? null,
          context.teamName ?? null,
          normalizedDomain,
          lead.company_name,
          lead.country,
          lead.buyer_type,
          JSON.stringify(lead.matched_products),
          lead.confidence ?? null,
          lead.dedupe_key ?? lead.lead_id ?? identityKeyForLead(lead),
        ],
      );
      const candidate = toLeadCandidateRecord(candidateResult.rows[0]);
      candidateRecords.push(candidate);
      for (const evidence of lead.discovery_evidence) {
        sourceRecords.push(await insertLeadSource(client, context, candidate.id, evidence));
      }
      await client.query(
        `
          insert into lead_run_results (
            id,
            tenant_id,
            lead_run_id,
            lead_identity_id,
            rank,
            duplicate_status,
            duplicate_reason,
            source_snapshot_json
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          on conflict (tenant_id, lead_run_id, lead_identity_id)
          do update set
            rank = excluded.rank,
            duplicate_status = excluded.duplicate_status,
            duplicate_reason = excluded.duplicate_reason,
            source_snapshot_json = excluded.source_snapshot_json
        `,
        [
          createCbeId("lead_result"),
          context.tenantId,
          leadRunId,
          leadIdentityId,
          index + 1,
          lead.duplicate_status,
          lead.dedupe_key ?? null,
          JSON.stringify(lead),
        ],
      );
    }

    const leadRunResult = await client.query<LeadRunRow>(
      `
        update lead_runs
        set
          agent_run_id = $3,
          status = 'completed',
          completed_at = now()
        where tenant_id = $1
          and id = $2
        returning id, agent_run_id, status, target_count, completed_at
      `,
      [context.tenantId, leadRunId, input.agent_run_id],
    );
    const agentRun = await completeAgentRun(client, context, {
      agentRunId: input.agent_run_id,
      sessionKey: input.session_key,
      currentStage: "lead_results_saved",
      metadataJson: {
        lead_run_id: leadRunId,
        saved_leads: candidateRecords.length,
        saved_customer_ids: candidateRecords.map((candidate) => candidate.id),
        lead_candidate_ids: candidateRecords.map((candidate) => candidate.id),
        shortage_reason: input.payload.shortage_reason,
      },
    });
    if (!agentRun) {
      throw new CbeStoreError(404, "agent_run_missing", "Agent run was not found for Lead completion.");
    }
    await createAgentRunActivityEvent(client, context, {
      agentRunId: input.agent_run_id,
      agentId: "cbe-lead-discovery",
      taskKind: "lead",
      targetRecordType: "lead_run",
      targetRecordId: leadRunId,
      targetSummary: `Saved ${candidateRecords.length} lead candidates`,
      stage: "completed",
      eventType: "lead_run_completed",
      status: "completed",
      metadataJson: {
        saved_leads: candidateRecords.length,
        saved_customer_ids: candidateRecords.map((candidate) => candidate.id),
      },
    });
    await createAuditEvent(client, context, {
      agentId: "cbe-lead-discovery",
      eventType: "lead_run_completed",
      dataTier: "T1",
      metadataJson: {
        agent_run_id: input.agent_run_id,
        lead_run_id: leadRunId,
        saved_leads: candidateRecords.length,
        saved_sources: sourceRecords.length,
      },
    });

    return {
      agentRun,
      leadRun: toLeadRunRecord(leadRunResult.rows[0]),
      candidates: candidateRecords,
      sources: sourceRecords,
    };
  });
}

export async function failLeadCompletion(
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
