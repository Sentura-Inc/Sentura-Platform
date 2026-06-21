import type { PoolClient } from "pg";
import { queryCbe, withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import { completeAgentRun, createAgentRunActivityEvent, failAgentRun, insertAgentRun } from "./agent-runs";
import { createAuditEvent } from "./audit";
import { scopedOwnerClause } from "./tenant-context";
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
import { checkCbeCostBudgetBeforeRun } from "./admin";
import { admitCbeWorkload, assertScreeningSessionShape, getCbeWorkloadSettings, workloadMetadata } from "./workload-coordinator";

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

export interface ScreeningAddressLocationRecord {
  id: string;
  screeningReportId: string;
  screeningTargetId: string;
  leadCandidateId: string | null;
  agentRunId: string | null;
  companyName: string;
  normalizedDomain: string | null;
  googlePlaceId: string | null;
  displayName: string;
  formattedAddress: string;
  addressType: string;
  relationshipStatus: string;
  city: string | null;
  region: string | null;
  country: string | null;
  businessStatus: string | null;
  types: unknown[];
  websiteUri: string | null;
  domainMatch: string;
  phoneMatch: string;
  addressValidation: Record<string, unknown>;
  googleMapsUri: string | null;
  matchConfidence: number | null;
  matchReasons: unknown[];
  sourceType: string;
  fetchedAt: string | null;
  createdAt: string;
}

export interface ListScreeningAddressLocationsQuery {
  screeningReportId?: string;
  screeningTargetId?: string;
  leadCandidateId?: string;
  agentRunId?: string;
  companyName?: string;
  domain?: string;
  googlePlaceId?: string;
  country?: string;
  city?: string;
  relationshipStatus?: string;
  addressType?: string;
  limit?: number;
  offset?: number;
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

interface ScreeningAddressLocationRow {
  id: string;
  screening_report_id: string;
  screening_target_id: string;
  lead_candidate_id: string | null;
  agent_run_id: string | null;
  company_name: string;
  normalized_domain: string | null;
  google_place_id: string | null;
  display_name: string;
  formatted_address: string;
  address_type: string;
  relationship_status: string;
  city: string | null;
  region: string | null;
  country: string | null;
  business_status: string | null;
  types_json: unknown;
  website_uri: string | null;
  domain_match: string;
  phone_match: string;
  address_validation_json: Record<string, unknown> | null;
  google_maps_uri: string | null;
  match_confidence: string | null;
  match_reasons_json: unknown;
  source_type: string;
  fetched_at: Date | null;
  created_at: Date;
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

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toScreeningAddressLocationRecord(row: ScreeningAddressLocationRow): ScreeningAddressLocationRecord {
  return {
    id: row.id,
    screeningReportId: row.screening_report_id,
    screeningTargetId: row.screening_target_id,
    leadCandidateId: row.lead_candidate_id,
    agentRunId: row.agent_run_id,
    companyName: row.company_name,
    normalizedDomain: row.normalized_domain,
    googlePlaceId: row.google_place_id,
    displayName: row.display_name,
    formattedAddress: row.formatted_address,
    addressType: row.address_type,
    relationshipStatus: row.relationship_status,
    city: row.city,
    region: row.region,
    country: row.country,
    businessStatus: row.business_status,
    types: jsonArray(row.types_json),
    websiteUri: row.website_uri,
    domainMatch: row.domain_match,
    phoneMatch: row.phone_match,
    addressValidation: row.address_validation_json ?? {},
    googleMapsUri: row.google_maps_uri,
    matchConfidence: row.match_confidence === null ? null : Number(row.match_confidence),
    matchReasons: jsonArray(row.match_reasons_json),
    sourceType: row.source_type,
    fetchedAt: row.fetched_at ? row.fetched_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
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

function booleanMatchValue(value: boolean | "not_checked" | undefined): "match" | "mismatch" | "not_checked" {
  if (value === true) return "match";
  if (value === false) return "mismatch";
  return "not_checked";
}

function phoneMatchValue(value: boolean | "not_checked" | "conflict" | undefined): "match" | "mismatch" | "conflict" | "not_checked" {
  if (value === true) return "match";
  if (value === false) return "mismatch";
  if (value === "conflict") return "conflict";
  return "not_checked";
}

export async function listScreeningAddressLocations(
  context: TenantContext,
  input: ListScreeningAddressLocationsQuery = {},
) {
  const scope = scopedOwnerClause(context, "sal", 2);
  const values: unknown[] = [context.tenantId, ...scope.values];
  const filters: string[] = [];
  const addFilter = (sql: string, value: unknown) => {
    values.push(value);
    filters.push(sql.replace("?", `$${values.length}`));
  };

  if (input.screeningReportId) addFilter("and sal.screening_report_id = ?", input.screeningReportId);
  if (input.screeningTargetId) addFilter("and sal.screening_target_id = ?", input.screeningTargetId);
  if (input.leadCandidateId) addFilter("and sal.lead_candidate_id = ?", input.leadCandidateId);
  if (input.agentRunId) addFilter("and sal.agent_run_id = ?", input.agentRunId);
  if (input.googlePlaceId) addFilter("and sal.google_place_id = ?", input.googlePlaceId);
  if (input.country) addFilter("and sal.country = ?", input.country);
  if (input.city) addFilter("and sal.city = ?", input.city);
  if (input.relationshipStatus) addFilter("and sal.relationship_status = ?", input.relationshipStatus);
  if (input.addressType) addFilter("and sal.address_type = ?", input.addressType);
  const domain = normalizeDomain(input.domain);
  if (domain) addFilter("and sal.normalized_domain = ?", domain);
  if (input.companyName) addFilter("and sal.company_name ilike ?", `%${input.companyName.trim()}%`);

  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 100), 1), 500);
  const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;

  const result = await queryCbe<ScreeningAddressLocationRow>(
    `
      select
        sal.id,
        sal.screening_report_id,
        sal.screening_target_id,
        sal.lead_candidate_id,
        sal.agent_run_id,
        sal.company_name,
        sal.normalized_domain,
        sal.google_place_id,
        sal.display_name,
        sal.formatted_address,
        sal.address_type,
        sal.relationship_status,
        sal.city,
        sal.region,
        sal.country,
        sal.business_status,
        sal.types_json,
        sal.website_uri,
        sal.domain_match,
        sal.phone_match,
        sal.address_validation_json,
        sal.google_maps_uri,
        sal.match_confidence::text as match_confidence,
        sal.match_reasons_json,
        sal.source_type,
        sal.fetched_at,
        sal.created_at
      from screening_address_locations sal
      where sal.tenant_id = $1
        ${scope.sql}
        ${filters.join("\n        ")}
      order by sal.created_at desc, sal.id
      limit $${limitIndex}
      offset $${offsetIndex}
    `,
    values,
  );

  return {
    items: result.rows.map(toScreeningAddressLocationRecord),
    limit,
    offset,
  };
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
  const existingTargetId =
    target.target_id?.startsWith("screening_target") ? target.target_id :
      target.lead_id?.startsWith("screening_target") ? target.lead_id :
        null;
  if (existingTargetId) {
    const existing = await client.query<ScreeningTargetRow>(
      `
        update screening_targets
        set
          company_name = coalesce($3, company_name),
          country = coalesce($4, country),
          domain = coalesce($5, domain),
          email = coalesce($6, email),
          contact_person = coalesce($7, contact_person),
          product_interest_json = case when $8::jsonb <> '[]'::jsonb then $8::jsonb else product_interest_json end,
          supplied_fields_json = supplied_fields_json || $9::jsonb
        where tenant_id = $1
          and id = $2
          and (
            $10::boolean
            or owner_user_id = $11
            or visibility_scope = 'tenant_shared'
            or (visibility_scope = 'team' and team_name = $12)
          )
        returning id, company_name, country, domain
      `,
      [
        context.tenantId,
        existingTargetId,
        companyName ?? null,
        target.country ?? null,
        domain,
        target.email ?? null,
        target.contact_person ?? null,
        JSON.stringify(target.product_interest ?? []),
        JSON.stringify({
          supplied_fields: target.supplied_fields ?? [],
          missing_fields: target.missing_fields ?? [],
          website: target.website,
          source: target.source,
        }),
        context.cbeRole === "admin",
        context.userId,
        context.teamName ?? null,
      ],
    );
    if (existing.rows[0]) {
      return {
        record: toScreeningTargetRecord(existing.rows[0]),
        leadCandidateId: null,
      };
    }
  }
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

async function insertAddressFootprintLocations(
  client: PoolClient,
  context: TenantContext,
  args: {
    report: ScreeningReportMarker;
    reportId: string;
    screeningTargetId: string;
    leadCandidateId: string | null;
    agentRunId: string;
  },
) {
  const locations = args.report.address_footprint?.locations ?? [];
  if (locations.length === 0) return 0;

  const reportDomain = normalizeDomain(
    args.report.target?.domain ??
    args.report.target?.website ??
    args.report.target?.email?.split("@")[1] ??
    undefined,
  );

  for (const location of locations) {
    await client.query(
      `
        insert into screening_address_locations (
          id,
          tenant_id,
          screening_report_id,
          screening_target_id,
          lead_candidate_id,
          agent_run_id,
          created_by_user_id,
          owner_user_id,
          department_id,
          team_name,
          visibility_scope,
          company_name,
          normalized_domain,
          google_place_id,
          display_name,
          formatted_address,
          address_type,
          relationship_status,
          city,
          region,
          country,
          business_status,
          types_json,
          website_uri,
          domain_match,
          phone_match,
          address_validation_json,
          google_maps_uri,
          match_confidence,
          match_reasons_json,
          source_type,
          fetched_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $7, $8, $9, 'private', $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $23, $24,
          $25::jsonb, $26, $27, $28::jsonb, $29, $30::timestamptz
        )
      `,
      [
        createCbeId("screening_address"),
        context.tenantId,
        args.reportId,
        args.screeningTargetId,
        args.leadCandidateId,
        args.agentRunId,
        context.userId,
        context.departmentId ?? null,
        context.teamName ?? null,
        args.report.company_name,
        reportDomain ?? normalizeDomain(location.website_uri),
        location.google_place_id ?? null,
        location.display_name,
        location.formatted_address,
        location.address_type,
        location.relationship_status,
        location.city ?? null,
        location.region ?? null,
        location.country ?? args.report.target?.country ?? null,
        location.business_status ?? null,
        JSON.stringify(location.types ?? []),
        location.website_uri ?? null,
        booleanMatchValue(location.domain_match),
        phoneMatchValue(location.phone_match),
        JSON.stringify(location.address_validation ?? {}),
        location.google_maps_uri ?? null,
        location.match_confidence ?? null,
        JSON.stringify(location.match_reasons ?? []),
        location.source_type ?? "google_maps_places",
        location.fetched_at ?? null,
      ],
    );
  }

  return locations.length;
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
  const targetCount = typeof input.metadata_json.target_count === "number"
    ? input.metadata_json.target_count
    : 1;
  const settings = getCbeWorkloadSettings();
  assertScreeningSessionShape(targetCount, settings);
  await checkCbeCostBudgetBeforeRun(context, {
    agentId: "cbe-buyer-screening",
    taskKind: "screening",
    targetSummary: input.target_summary,
    estimatedCostUsd: input.estimated_cost_usd,
    metadataJson: input.metadata_json,
  });
  return withCbeTransaction(async (client) => {
    const admission = await admitCbeWorkload(client, context, {
      agentId: "cbe-buyer-screening",
      taskKind: "screening",
      requestedSessionKey: input.session_key,
      currentStageWhenRunning: "submitted_to_employee",
      currentStageWhenQueued: "queued",
    });
    const agentRun = await insertAgentRun(client, context, {
      agent_id: "cbe-buyer-screening",
      task_kind: "screening",
      status: admission.status,
      session_key: admission.sessionKey,
      target_record_type: input.target_record_type,
      target_record_id: input.target_record_id,
      target_summary: input.target_summary,
      current_stage: admission.currentStage,
      queue_priority: admission.queuePriority,
      queued_at: admission.queuedAt,
      cost_usd_estimate: input.estimated_cost_usd,
      visibility_scope: input.visibility_scope,
      metadata_json: {
        ...input.metadata_json,
        screening_execution_mode: settings.screeningExecutionMode,
        max_targets_per_session: settings.screeningMaxTargetsPerSession,
        ...workloadMetadata(admission),
      },
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
    const affectedCustomerIds: string[] = [];
    let evidenceCount = 0;
    let blockCount = 0;
    let addressFootprintLocationCount = 0;

    for (const report of input.payload.reports) {
      const target = await insertScreeningTarget(client, context, report);
      targets.push(target.record);
      const targetRecordId =
        report.target?.lead_id ??
        report.target?.target_id ??
        report.lead_id ??
        target.record.id;
      affectedCustomerIds.push(target.leadCandidateId ?? targetRecordId);
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
      addressFootprintLocationCount += await insertAddressFootprintLocations(client, context, {
        report,
        reportId: savedReport.id,
        screeningTargetId: target.record.id,
        leadCandidateId: target.leadCandidateId,
        agentRunId: input.agent_run_id,
      });
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
        saved_customer_ids: affectedCustomerIds,
        affected_customer_ids: affectedCustomerIds,
        screening_target_ids: targets.map((target) => target.id),
        saved_evidence: evidenceCount,
        saved_score_blocks: blockCount,
        saved_address_footprint_locations: addressFootprintLocationCount,
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
      metadataJson: {
        saved_reports: reports.length,
        saved_customer_ids: affectedCustomerIds,
        saved_evidence: evidenceCount,
        saved_address_footprint_locations: addressFootprintLocationCount,
      },
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
        saved_address_footprint_locations: addressFootprintLocationCount,
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
