import type { PoolClient } from "pg";
import { withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import { completeAgentRun, createAgentRunActivityEvent, failAgentRun, insertAgentRun } from "./agent-runs";
import { createAuditEvent } from "./audit";
import type {
  CompleteScreeningRunRequest,
  CreateScreeningRunRequest,
  ScreeningEvidenceMarker,
  ScreeningReportMarker,
  ScreeningScoreBlockMarker,
  ScreeningTargetMarker,
  TenantContext,
} from "./schemas";
import { CreateScreeningRunRequestSchema } from "./schemas";

export interface ScreeningTargetRecord {
  id: string;
  companyName: string;
  country: string | null;
  domain: string | null;
}

export interface ScreeningReportRecord {
  id: string;
  screeningTargetId: string;
  riskTier: string;
  normalizedScore: number | null;
}

interface ScreeningTargetRow {
  id: string;
  company_name: string;
  country: string | null;
  domain: string | null;
}

interface ScreeningReportRow {
  id: string;
  screening_target_id: string;
  risk_tier: string;
  normalized_score: string | null;
}

function toScreeningTargetRecord(row: ScreeningTargetRow): ScreeningTargetRecord {
  return {
    id: row.id,
    companyName: row.company_name,
    country: row.country,
    domain: row.domain,
  };
}

function toScreeningReportRecord(row: ScreeningReportRow): ScreeningReportRecord {
  return {
    id: row.id,
    screeningTargetId: row.screening_target_id,
    riskTier: row.risk_tier,
    normalizedScore: row.normalized_score === null ? null : Number(row.normalized_score),
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

async function resolveLeadCandidateId(
  client: PoolClient,
  context: TenantContext,
  leadId?: string | null,
) {
  if (!leadId) return null;
  const result = await client.query<{ id: string }>(
    `
      select id
      from lead_candidates
      where tenant_id = $1
        and id = $2
      limit 1
    `,
    [context.tenantId, leadId],
  );
  return result.rows[0]?.id ?? null;
}

async function insertScreeningTarget(
  client: PoolClient,
  context: TenantContext,
  report: ScreeningReportMarker,
) {
  const target: ScreeningTargetMarker = report.target ?? {
    source: report.target_source ?? "manual_input",
    lead_id: report.lead_id,
    company_name: report.company_name,
    product_interest: [],
    supplied_fields: [],
    missing_fields: [],
  };
  const leadCandidateId = await resolveLeadCandidateId(client, context, target.lead_id ?? report.lead_id);
  const companyName = target.company_name ?? report.company_name;
  const domain = normalizeDomain(target.domain ?? target.website);
  const result = await client.query<ScreeningTargetRow>(
    `
      insert into screening_targets (
        id,
        tenant_id,
        source,
        lead_candidate_id,
        created_by_user_id,
        owner_user_id,
        department_id,
        team_name,
        visibility_scope,
        company_name,
        country,
        domain,
        email,
        contact_person,
        product_interest_json,
        supplied_fields_json
      )
      values ($1, $2, $3, $4, $5, $5, $6, $7, 'private', $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
      returning id, company_name, country, domain
    `,
    [
      createCbeId("screening_target"),
      context.tenantId,
      target.source,
      leadCandidateId,
      context.userId,
      context.departmentId ?? null,
      context.teamName ?? null,
      companyName,
      target.country ?? null,
      domain,
      target.email ?? null,
      target.contact_person ?? null,
      JSON.stringify(target.product_interest ?? []),
      JSON.stringify({
        supplied_fields: target.supplied_fields ?? [],
        missing_fields: target.missing_fields ?? [],
        website: target.website,
      }),
    ],
  );
  return {
    record: toScreeningTargetRecord(result.rows[0]),
    leadCandidateId,
  };
}

async function insertEvidence(
  client: PoolClient,
  context: TenantContext,
  reportId: string,
  evidence: ScreeningEvidenceMarker,
) {
  await client.query(
    `
      insert into screening_evidence (
        id,
        tenant_id,
        screening_report_id,
        layer,
        source_type,
        source,
        source_url,
        finding,
        confidence,
        cost_usd,
        score_block,
        score_impact,
        fetched_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz)
    `,
    [
      createCbeId("evidence"),
      context.tenantId,
      reportId,
      evidence.layer,
      evidence.source_type,
      evidence.source ?? null,
      evidence.source_url ?? evidence.url ?? null,
      evidence.finding,
      evidence.confidence ?? null,
      evidence.cost_usd ?? null,
      evidence.score_block ?? null,
      evidence.score_impact,
      evidence.fetched_at,
    ],
  );
}

async function insertScoreBlock(
  client: PoolClient,
  context: TenantContext,
  reportId: string,
  block: ScreeningScoreBlockMarker,
) {
  await client.query(
    `
      insert into screening_score_blocks (
        id,
        tenant_id,
        screening_report_id,
        block,
        status,
        max_points,
        earned_points,
        reason
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      createCbeId("score_block"),
      context.tenantId,
      reportId,
      block.block,
      block.status,
      block.max_points ?? null,
      block.earned_points ?? null,
      block.reason ?? block.summary ?? null,
    ],
  );
}

export async function createScreeningRun(
  context: TenantContext,
  rawInput: CreateScreeningRunRequest,
) {
  const input = CreateScreeningRunRequestSchema.parse(rawInput);
  return withCbeTransaction(async (client) => {
    const agentRun = await insertAgentRun(client, context, {
      agent_id: "cbe-buyer-screening",
      task_kind: "screening",
      status: input.session_key ? "running" : "queued",
      session_key: input.session_key,
      target_record_type: input.target_record_type,
      target_record_id: input.target_record_id,
      target_summary: input.target_summary,
      current_stage: input.session_key ? "submitted_to_employee" : "queued",
      visibility_scope: input.visibility_scope,
      metadata_json: input.metadata_json,
    });
    await createAgentRunActivityEvent(client, context, {
      agentRunId: agentRun.id,
      agentId: "cbe-buyer-screening",
      taskKind: "screening",
      targetRecordType: input.target_record_type,
      targetRecordId: input.target_record_id,
      targetSummary: input.target_summary,
      stage: agentRun.status,
      eventType: "screening_run_created",
      status: agentRun.status,
    });
    await createAuditEvent(client, context, {
      agentId: "cbe-buyer-screening",
      eventType: "screening_run_created",
      dataTier: "T1",
      metadataJson: { agent_run_id: agentRun.id },
    });
    return { agentRun };
  });
}

export async function saveScreeningReports(
  context: TenantContext,
  input: CompleteScreeningRunRequest,
) {
  return withCbeTransaction(async (client) => {
    const targets: ScreeningTargetRecord[] = [];
    const reports: ScreeningReportRecord[] = [];
    let evidenceCount = 0;
    let blockCount = 0;

    for (const report of input.payload.reports) {
      const target = await insertScreeningTarget(client, context, report);
      targets.push(target.record);
      const reportResult = await client.query<ScreeningReportRow>(
        `
          insert into screening_reports (
            id,
            tenant_id,
            screening_target_id,
            agent_run_id,
            created_by_user_id,
            owner_user_id,
            department_id,
            team_name,
            visibility_scope,
            risk_tier,
            normalized_score,
            evidence_coverage,
            recommended_action,
            report_json
          )
          values ($1, $2, $3, $4, $5, $5, $6, $7, 'private', $8, $9, $10, $11, $12::jsonb)
          returning id, screening_target_id, risk_tier, normalized_score::text as normalized_score
        `,
        [
          report.report_id ?? createCbeId("screening_report"),
          context.tenantId,
          target.record.id,
          input.agent_run_id,
          context.userId,
          context.departmentId ?? null,
          context.teamName ?? null,
          report.risk_tier,
          report.normalized_score,
          report.evidence_coverage,
          report.recommended_action,
          JSON.stringify(report),
        ],
      );
      const savedReport = toScreeningReportRecord(reportResult.rows[0]);
      reports.push(savedReport);
      for (const evidence of report.evidence) {
        await insertEvidence(client, context, savedReport.id, evidence);
        evidenceCount++;
      }
      for (const block of report.score_blocks) {
        await insertScoreBlock(client, context, savedReport.id, block);
        blockCount++;
      }
      if (target.leadCandidateId) {
        await client.query(
          `
            update lead_candidates
            set status = 'screened'
            where tenant_id = $1
              and id = $2
          `,
          [context.tenantId, target.leadCandidateId],
        );
      }
    }

    const agentRun = await completeAgentRun(client, context, {
      agentRunId: input.agent_run_id,
      sessionKey: input.session_key,
      currentStage: "screening_reports_saved",
      metadataJson: {
        saved_reports: reports.length,
        saved_evidence: evidenceCount,
        saved_score_blocks: blockCount,
      },
    });
    if (!agentRun) {
      throw new CbeStoreError(404, "agent_run_missing", "Agent run was not found for Screening completion.");
    }
    await createAgentRunActivityEvent(client, context, {
      agentRunId: input.agent_run_id,
      agentId: "cbe-buyer-screening",
      taskKind: "screening",
      targetSummary: `Saved ${reports.length} screening reports`,
      stage: "completed",
      eventType: "screening_run_completed",
      status: "completed",
      metadataJson: { saved_reports: reports.length, saved_evidence: evidenceCount },
    });
    await createAuditEvent(client, context, {
      agentId: "cbe-buyer-screening",
      eventType: "screening_reports_saved",
      dataTier: "T2",
      metadataJson: {
        agent_run_id: input.agent_run_id,
        saved_targets: targets.length,
        saved_reports: reports.length,
        saved_evidence: evidenceCount,
      },
    });

    return { agentRun, targets, reports };
  });
}

export async function failScreeningCompletion(
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
