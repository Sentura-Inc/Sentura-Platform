import type { PoolClient } from "pg";
import { queryCbe, withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import {
  completeAgentRun,
  createAgentRunActivityEvent,
  failAgentRun,
  insertAgentRun,
  markAgentRunRunning,
  type AgentRunRecord,
} from "./agent-runs";
import { createAuditEvent } from "./audit";
import { createApiLedgerEntry } from "./api-ledger";
import { scopedOwnerClause } from "./tenant-context";
import type {
  ClaimQueuedScreeningRunsRequest,
  CompleteScreeningRunRequest,
  CreateScreeningRunRequest,
  RetryScreeningChildRunRequest,
  ScreeningEvidenceMarker,
  ScreeningReportMarker,
  ScreeningScoreBlockMarker,
  ScreeningTargetMarker,
  TenantContext,
} from "./schemas";
import {
  ClaimQueuedScreeningRunsRequestSchema,
  CreateScreeningRunRequestSchema,
  RetryScreeningChildRunRequestSchema,
} from "./schemas";
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

export interface ScreeningBatchRecord {
  id: string;
  parentAgentRunId: string;
  requestedTargetCount: number;
  executionMode: string;
  status: string;
  aggregate: ScreeningBatchAggregate;
}

export interface ScreeningChildRunRecord {
  batchTargetId: string;
  targetOrder: number;
  status: string;
  agentRun: AgentRunRecord;
  target: ScreeningTargetMarker;
  paidSourcePolicy?: ScreeningPaidSourcePolicy;
}

export interface ScreeningBatchAggregate {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  retryable: number;
  terminal: number;
}

export interface ScreeningPaidSourceRule {
  enabled: boolean;
  allowed: boolean;
  callStatus: string;
  callCount: number;
  reapprovalRequired: boolean;
  reapprovedAt: string | null;
  budgetUsd?: number;
  spendUsd?: number;
}

export interface ScreeningPaidSourcePolicy {
  paidEmailValidation: ScreeningPaidSourceRule;
  paidTradeData: ScreeningPaidSourceRule;
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
  lead_candidate_id: string | null;
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

interface ScreeningBatchRow {
  id: string;
  parent_agent_run_id: string;
  requested_target_count: number;
  execution_mode: string;
  status: string;
  aggregate_json: Record<string, unknown> | null;
}

interface ScreeningBatchAggregateRow {
  batch_id: string;
  parent_agent_run_id: string;
  total_count: string;
  queued_count: string;
  running_count: string;
  completed_count: string;
  failed_count: string;
  cancelled_count: string;
}

interface QueuedScreeningChildRow {
  agent_run_id: string;
  screening_batch_id: string;
  batch_target_id: string;
  target_order: number;
  metadata_json: Record<string, unknown>;
  paid_email_call_status: string;
  paid_email_call_count: number;
  paid_email_reapproved_at: Date | null;
  paid_trade_call_status: string;
  paid_trade_call_count: number;
  paid_trade_spend_usd: string;
  paid_trade_reapproved_at: Date | null;
  paid_email_enabled: boolean;
  paid_trade_enabled: boolean;
  per_target_trade_budget_usd: string;
}

interface ScreeningRetryChildRow extends QueuedScreeningChildRow {
  child_agent_run_id: string;
  screening_target_id: string;
  parent_agent_run_id: string;
  status: string;
  target_json: ScreeningTargetMarker;
}

interface ScreeningAgentRunRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  owner_user_id: string | null;
  parent_agent_run_id: string | null;
  agent_id: AgentRunRecord["agentId"];
  session_key: string | null;
  status: AgentRunRecord["status"];
  task_kind: AgentRunRecord["taskKind"];
  target_summary: string | null;
  current_stage: string | null;
  queue_priority: number;
  queued_at: Date | null;
  lease_owner: string | null;
  lease_until: Date | null;
  cost_usd_estimate: string | null;
  started_at: Date;
  finished_at: Date | null;
  error_code: string | null;
  error_message: string | null;
  metadata_json: Record<string, unknown>;
}

function toAgentRunRecord(row: ScreeningAgentRunRow): AgentRunRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    ownerUserId: row.owner_user_id,
    parentAgentRunId: row.parent_agent_run_id,
    agentId: row.agent_id,
    sessionKey: row.session_key,
    status: row.status,
    taskKind: row.task_kind,
    targetSummary: row.target_summary,
    currentStage: row.current_stage,
    queuePriority: row.queue_priority,
    queuedAt: row.queued_at?.toISOString() ?? null,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until?.toISOString() ?? null,
    costUsdEstimate: row.cost_usd_estimate === null ? null : Number(row.cost_usd_estimate),
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    metadataJson: row.metadata_json ?? {},
  };
}

function toScreeningTargetRecord(row: ScreeningTargetRow): ScreeningTargetRecord {
  return {
    id: row.id,
    companyName: row.company_name,
    country: row.country,
    domain: row.domain,
  };
}

function toScreeningBatchRecord(row: ScreeningBatchRow): ScreeningBatchRecord {
  const aggregate = row.aggregate_json && typeof row.aggregate_json === "object"
    ? row.aggregate_json as Partial<ScreeningBatchAggregate>
    : {};
  return {
    id: row.id,
    parentAgentRunId: row.parent_agent_run_id,
    requestedTargetCount: row.requested_target_count,
    executionMode: row.execution_mode,
    status: row.status,
    aggregate: {
      total: Number(aggregate.total ?? row.requested_target_count),
      queued: Number(aggregate.queued ?? 0),
      running: Number(aggregate.running ?? 0),
      completed: Number(aggregate.completed ?? 0),
      failed: Number(aggregate.failed ?? 0),
      cancelled: Number(aggregate.cancelled ?? 0),
      retryable: Number(aggregate.retryable ?? 0),
      terminal: Number(aggregate.terminal ?? 0),
    },
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

async function resolveLeadCandidateIdByIds(
  client: PoolClient,
  context: TenantContext,
  candidateIds: Array<string | null | undefined>,
) {
  const ids = Array.from(new Set(
    candidateIds
      .map((id) => id?.trim())
      .filter((id): id is string => typeof id === "string" && id.length > 0 && !id.startsWith("screening_target")),
  ));
  if (ids.length === 0) return null;
  const scope = scopedOwnerClause(context, "lc", 3);
  const result = await client.query<{ id: string }>(
    `
      select lc.id
      from lead_candidates lc
      where lc.tenant_id = $1
        and lc.id = any($2::text[])
        ${scope.sql}
      order by array_position($2::text[], lc.id)
      limit 1
    `,
    [context.tenantId, ids, ...scope.values],
  );
  return result.rows[0]?.id ?? null;
}

async function resolveLeadCandidateIdByDomain(
  client: PoolClient,
  context: TenantContext,
  domain?: string | null,
) {
  if (!domain) return null;
  const scope = scopedOwnerClause(context, "lc", 3);
  const result = await client.query<{ id: string }>(
    `
      select lc.id
      from lead_candidates lc
      where lc.tenant_id = $1
        and lc.normalized_domain = $2
        ${scope.sql}
      order by
        case when lc.status = 'screened' then 1 else 0 end,
        lc.created_at desc,
        lc.id desc
      limit 1
    `,
    [context.tenantId, domain, ...scope.values],
  );
  return result.rows[0]?.id ?? null;
}

async function resolveLeadCandidateIdByCompany(
  client: PoolClient,
  context: TenantContext,
  input: { companyName?: string | null; country?: string | null },
) {
  const companyName = input.companyName?.trim();
  if (!companyName) return null;
  const scope = scopedOwnerClause(context, "lc", 4);
  const result = await client.query<{ id: string }>(
    `
      select lc.id
      from lead_candidates lc
      where lc.tenant_id = $1
        and lower(lc.company_name) = lower($2)
        and ($3::text is null or lc.country = $3)
        ${scope.sql}
      order by
        case when lc.status = 'screened' then 1 else 0 end,
        lc.created_at desc,
        lc.id desc
      limit 1
    `,
    [context.tenantId, companyName, input.country ?? null, ...scope.values],
  );
  return result.rows[0]?.id ?? null;
}

async function resolveLeadCandidateIdForTarget(
  client: PoolClient,
  context: TenantContext,
  target: ScreeningTargetMarker,
  input: { companyName?: string | null; domain?: string | null },
) {
  const exactMatch = await resolveLeadCandidateIdByIds(client, context, [target.lead_id, target.target_id]);
  if (exactMatch) return exactMatch;

  if (target.source === "manual_input") return null;
  return (
    await resolveLeadCandidateIdByDomain(client, context, input.domain)
  ) ?? await resolveLeadCandidateIdByCompany(client, context, {
    companyName: input.companyName,
    country: target.country ?? null,
  });
}

async function saveScreeningTargetMarker(
  client: PoolClient,
  context: TenantContext,
  target: ScreeningTargetMarker,
  fallbackCompanyName?: string,
) {
  const companyName = target.company_name ?? fallbackCompanyName;
  if (!companyName?.trim()) {
    throw new CbeStoreError(400, "screening_target_missing_company", "Screening target requires a company name.");
  }
  const domain = normalizeDomain(target.domain ?? target.website);
  const leadCandidateId = await resolveLeadCandidateIdForTarget(client, context, target, { companyName, domain });
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
          supplied_fields_json = supplied_fields_json || $9::jsonb,
          lead_candidate_id = coalesce(lead_candidate_id, $13)
        where tenant_id = $1
          and id = $2
          and (
            $10::boolean
            or owner_user_id = $11
            or visibility_scope = 'tenant_shared'
            or (visibility_scope = 'team' and team_name = $12)
          )
        returning id, company_name, country, domain, lead_candidate_id
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
        leadCandidateId,
      ],
    );
    if (existing.rows[0]) {
      return {
        record: toScreeningTargetRecord(existing.rows[0]),
        leadCandidateId: existing.rows[0].lead_candidate_id ?? leadCandidateId,
      };
    }
  }
  if (leadCandidateId) {
    const existingForLead = await client.query<ScreeningTargetRow>(
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
          and id = (
            select id
            from screening_targets
            where tenant_id = $1
              and lead_candidate_id = $2
              and source <> 'accio_memory'
              and (
                $10::boolean
                or owner_user_id = $11
                or visibility_scope = 'tenant_shared'
                or (visibility_scope = 'team' and team_name = $12)
              )
            order by created_at desc, id desc
            limit 1
          )
        returning id, company_name, country, domain, lead_candidate_id
      `,
      [
        context.tenantId,
        leadCandidateId,
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
    if (existingForLead.rows[0]) {
      return {
        record: toScreeningTargetRecord(existingForLead.rows[0]),
        leadCandidateId: existingForLead.rows[0].lead_candidate_id ?? leadCandidateId,
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
      returning id, company_name, country, domain, lead_candidate_id
    `,
    [
      createCbeId("screening_target"),
      context.tenantId,
      target.source,
      leadCandidateId,
      context.userId,
      context.departmentId ?? null,
      context.teamName ?? null,
      companyName.trim(),
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

async function insertScreeningTarget(
  client: PoolClient,
  context: TenantContext,
  report: ScreeningReportMarker,
) {
  return saveScreeningTargetMarker(
    client,
    context,
    report.target ?? {
      source: report.target_source ?? "manual_input",
      lead_id: report.lead_id,
      company_name: report.company_name,
      product_interest: [],
      supplied_fields: [],
      missing_fields: [],
    },
    report.company_name,
  );
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

function aggregateFromRow(row: ScreeningBatchAggregateRow): ScreeningBatchAggregate {
  const total = Number(row.total_count);
  const queued = Number(row.queued_count);
  const running = Number(row.running_count);
  const completed = Number(row.completed_count);
  const failed = Number(row.failed_count);
  const cancelled = Number(row.cancelled_count);
  const terminal = completed + failed + cancelled;
  return {
    total,
    queued,
    running,
    completed,
    failed,
    cancelled,
    retryable: failed,
    terminal,
  };
}

function batchStatusFromAggregate(aggregate: ScreeningBatchAggregate): "queued" | "running" | "completed" | "failed" {
  if (aggregate.terminal >= aggregate.total) {
    return aggregate.completed > 0 || aggregate.total === 0 ? "completed" : "failed";
  }
  if (aggregate.running > 0 || aggregate.completed > 0 || aggregate.failed > 0 || aggregate.cancelled > 0) {
    return "running";
  }
  return "queued";
}

function screeningBatchNotificationMessage(aggregate: ScreeningBatchAggregate) {
  if (aggregate.terminal >= aggregate.total) {
    if (aggregate.failed > 0 && aggregate.completed === 0) {
      return `批量背调失败：${aggregate.failed} 个客户未完成，可稍后重试。`;
    }
    if (aggregate.failed > 0) {
      return `已完成 ${aggregate.completed} 份背调报告，${aggregate.failed} 个客户失败，可稍后重试。`;
    }
    return `已完成 ${aggregate.completed} 份背调报告，客户评分已更新。`;
  }
  if (aggregate.failed > 0 || aggregate.completed > 0) {
    return `已完成 ${aggregate.completed} 份背调报告，${aggregate.failed} 个客户失败，${aggregate.queued + aggregate.running} 个仍在处理中。`;
  }
  return `已拆分为 ${aggregate.total} 个单客户背调子任务。`;
}

async function refreshScreeningBatchAggregate(
  client: PoolClient,
  context: TenantContext,
  input: { batchId?: string; childAgentRunId?: string },
) {
  const result = await client.query<ScreeningBatchAggregateRow>(
    `
      with selected_batch as (
        select
          sb.id,
          sb.parent_agent_run_id
        from screening_batches sb
        where sb.tenant_id = $1
          and (
            ($2::text is not null and sb.id = $2)
            or (
              $3::text is not null
              and exists (
                select 1
                from screening_batch_targets child_sbt
                where child_sbt.tenant_id = sb.tenant_id
                  and child_sbt.screening_batch_id = sb.id
                  and child_sbt.child_agent_run_id = $3
              )
            )
          )
        limit 1
      )
      select
        selected_batch.id as batch_id,
        selected_batch.parent_agent_run_id,
        count(*)::text as total_count,
        count(*) filter (where sbt.status = 'queued')::text as queued_count,
        count(*) filter (where sbt.status = 'running')::text as running_count,
        count(*) filter (where sbt.status = 'completed')::text as completed_count,
        count(*) filter (where sbt.status = 'failed')::text as failed_count,
        count(*) filter (where sbt.status = 'cancelled')::text as cancelled_count
      from selected_batch
      join screening_batch_targets sbt
        on sbt.tenant_id = $1
       and sbt.screening_batch_id = selected_batch.id
      group by selected_batch.id, selected_batch.parent_agent_run_id
    `,
    [context.tenantId, input.batchId ?? null, input.childAgentRunId ?? null],
  );
  const row = result.rows[0];
  if (!row) return null;

  const aggregate = aggregateFromRow(row);
  const status = batchStatusFromAggregate(aggregate);
  const metadata = {
    screening_batch: {
      id: row.batch_id,
      status,
      aggregate,
    },
    screening_batch_id: row.batch_id,
    screening_batch_total: aggregate.total,
    screening_batch_queued: aggregate.queued,
    screening_batch_running: aggregate.running,
    screening_batch_completed: aggregate.completed,
    screening_batch_failed: aggregate.failed,
    screening_batch_retryable: aggregate.retryable,
    notification_message: screeningBatchNotificationMessage(aggregate),
  };

  await client.query(
    `
      update screening_batches
      set
        status = $3,
        completed_at = case when $4::boolean then coalesce(completed_at, now()) else null end
      where tenant_id = $1
        and id = $2
    `,
    [context.tenantId, row.batch_id, status, aggregate.terminal >= aggregate.total],
  );

  if (aggregate.terminal >= aggregate.total) {
    if (status === "failed") {
      await failAgentRun(client, context, {
        agentRunId: row.parent_agent_run_id,
        errorCode: "screening_batch_failed",
        errorMessage: screeningBatchNotificationMessage(aggregate),
        metadataJson: metadata,
      });
    } else {
      await completeAgentRun(client, context, {
        agentRunId: row.parent_agent_run_id,
        currentStage: aggregate.failed > 0 ? "screening_batch_completed_with_failures" : "screening_batch_completed",
        metadataJson: metadata,
      });
    }
  } else {
    await client.query(
      `
        update agent_runs
        set
          status = 'running',
          current_stage = $3,
          last_activity_at = now(),
          metadata_json = metadata_json || $4::jsonb
        where tenant_id = $1
          and id = $2
      `,
      [
        context.tenantId,
        row.parent_agent_run_id,
        status === "queued" ? "screening_children_queued" : "screening_children_running",
        JSON.stringify(metadata),
      ],
    );
  }

  return {
    batchId: row.batch_id,
    parentAgentRunId: row.parent_agent_run_id,
    status,
    aggregate,
  };
}

async function loadScreeningBatchRecord(client: PoolClient, context: TenantContext, batchId: string) {
  const aggregate = await refreshScreeningBatchAggregate(client, context, { batchId });
  const result = await client.query<ScreeningBatchRow>(
    `
      select
        sb.id,
        sb.parent_agent_run_id,
        sb.requested_target_count,
        sb.execution_mode,
        sb.status,
        $3::jsonb as aggregate_json
      from screening_batches sb
      where sb.tenant_id = $1
        and sb.id = $2
      limit 1
    `,
    [context.tenantId, batchId, JSON.stringify(aggregate?.aggregate ?? {})],
  );
  return result.rows[0] ? toScreeningBatchRecord(result.rows[0]) : null;
}

function targetForChildRun(target: ScreeningTargetMarker, targetRecord: ScreeningTargetRecord) {
  return {
    ...target,
    target_id: targetRecord.id,
    company_name: target.company_name ?? targetRecord.companyName,
    country: target.country ?? targetRecord.country ?? undefined,
    domain: target.domain ?? targetRecord.domain ?? undefined,
  } satisfies ScreeningTargetMarker;
}

function plannedSessionKeyForChild(input: CreateScreeningRunRequest, index: number) {
  return input.child_session_keys?.[index] ?? (index === 0 ? input.session_key : undefined);
}

function childTargetFromMetadata(metadata: Record<string, unknown>) {
  const target = metadata.child_target_json;
  if (target && typeof target === "object") return target as ScreeningTargetMarker;
  return {
    source: "manual_input",
    company_name: "未命名客户",
    product_interest: [],
    supplied_fields: [],
    missing_fields: [],
  } satisfies ScreeningTargetMarker;
}

function paidRule(input: {
  enabled: boolean;
  status: string;
  count: number;
  reapprovedAt: Date | string | null;
  budgetUsd?: string | number | null;
  spendUsd?: string | number | null;
}): ScreeningPaidSourceRule {
  const reapprovalRequired = input.enabled && input.status === "reapproval_required";
  return {
    enabled: input.enabled,
    allowed: input.enabled && ["available", "reapproved"].includes(input.status),
    callStatus: input.status,
    callCount: Number(input.count ?? 0),
    reapprovalRequired,
    reapprovedAt: input.reapprovedAt instanceof Date
      ? input.reapprovedAt.toISOString()
      : input.reapprovedAt ?? null,
    budgetUsd: input.budgetUsd === undefined || input.budgetUsd === null ? undefined : Number(input.budgetUsd),
    spendUsd: input.spendUsd === undefined || input.spendUsd === null ? undefined : Number(input.spendUsd),
  };
}

function paidSourcePolicyFromRow(row: QueuedScreeningChildRow): ScreeningPaidSourcePolicy {
  return {
    paidEmailValidation: paidRule({
      enabled: row.paid_email_enabled,
      status: row.paid_email_call_status,
      count: row.paid_email_call_count,
      reapprovedAt: row.paid_email_reapproved_at,
    }),
    paidTradeData: paidRule({
      enabled: row.paid_trade_enabled,
      status: row.paid_trade_call_status,
      count: row.paid_trade_call_count,
      reapprovedAt: row.paid_trade_reapproved_at,
      budgetUsd: row.per_target_trade_budget_usd,
      spendUsd: row.paid_trade_spend_usd,
    }),
  };
}

function paidSourcePolicyMetadata(policy: ScreeningPaidSourcePolicy) {
  return { paid_source_policy: policy };
}

function paidEmailObserved(evidence: ScreeningEvidenceMarker) {
  const haystack = [
    evidence.source_type,
    evidence.source,
    evidence.source_url,
    evidence.url,
    evidence.finding,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes("paid_email_validation") ||
    haystack.includes("abstract") ||
    haystack.includes("hunter") ||
    haystack.includes("email verifier") ||
    haystack.includes("email verification");
}

function paidTradeObserved(evidence: ScreeningEvidenceMarker) {
  const haystack = [
    evidence.source_type,
    evidence.source,
    evidence.source_url,
    evidence.url,
    evidence.finding,
  ].filter(Boolean).join(" ").toLowerCase();
  return evidence.source_type === "paid_trade_data" ||
    haystack.includes("importyeti") ||
    haystack.includes("volza") ||
    haystack.includes("paid trade");
}

async function createScreeningBatchRun(
  client: PoolClient,
  context: TenantContext,
  input: CreateScreeningRunRequest,
  targetCount: number,
) {
  const settings = getCbeWorkloadSettings();
  const parentAgentRun = await insertAgentRun(client, context, {
    agent_id: "cbe-buyer-screening",
    task_kind: "screening",
    status: "running",
    target_record_type: "screening_batch",
    target_summary: input.target_summary,
    current_stage: "screening_children_created",
    queue_priority: 0,
    cost_usd_estimate: input.estimated_cost_usd,
    visibility_scope: input.visibility_scope,
    metadata_json: {
      ...input.metadata_json,
      target_count: targetCount,
      screening_execution_mode: "single_target_fanout",
      notification_title: "批量背调",
      notification_message: `已拆分为 ${targetCount} 个单客户背调子任务。`,
      notification_target_label: `${targetCount} 个客户`,
    },
  });

  const batchId = createCbeId("screening_batch");
  const screeningOptions = input.metadata_json.options && typeof input.metadata_json.options === "object"
    ? input.metadata_json.options as Record<string, unknown>
    : {};
  const paidEmailEnabled = Boolean(screeningOptions.paidEmailValidation);
  const paidTradeEnabled = Boolean(screeningOptions.paidTradeData);
  const perTargetTradeBudgetUsd = typeof screeningOptions.maxPaidSpendUsd === "number"
    ? screeningOptions.maxPaidSpendUsd
    : 0;
  await client.query(
    `
      insert into screening_batches (
        id,
        tenant_id,
        created_by_user_id,
        parent_agent_run_id,
        requested_target_count,
        execution_mode,
        paid_email_enabled,
        paid_trade_enabled,
        per_target_trade_budget_usd,
        status
      )
      values ($1, $2, $3, $4, $5, 'single_target_fanout', $6, $7, $8, 'running')
    `,
    [
      batchId,
      context.tenantId,
      context.userId,
      parentAgentRun.id,
      targetCount,
      paidEmailEnabled,
      paidTradeEnabled,
      perTargetTradeBudgetUsd,
    ],
  );

  const childRuns: ScreeningChildRunRecord[] = [];
  const targets = input.targets ?? [];
  for (const [index, target] of targets.entries()) {
    const targetResult = await saveScreeningTargetMarker(client, context, target);
    const childTarget = targetForChildRun(target, targetResult.record);
    const batchTargetId = createCbeId("screening_batch_target");
    const paidSourcePolicy: ScreeningPaidSourcePolicy = {
      paidEmailValidation: paidRule({
        enabled: paidEmailEnabled,
        status: paidEmailEnabled ? "available" : "disabled",
        count: 0,
        reapprovedAt: null,
      }),
      paidTradeData: paidRule({
        enabled: paidTradeEnabled,
        status: paidTradeEnabled ? "available" : "disabled",
        count: 0,
        reapprovedAt: null,
        budgetUsd: perTargetTradeBudgetUsd,
        spendUsd: 0,
      }),
    };
    const admission = await admitCbeWorkload(client, context, {
      agentId: "cbe-buyer-screening",
      taskKind: "screening",
      requestedSessionKey: plannedSessionKeyForChild(input, index),
      currentStageWhenRunning: "submitted_to_employee",
      currentStageWhenQueued: "queued",
    });
    const childAgentRun = await insertAgentRun(client, context, {
      agent_id: "cbe-buyer-screening",
      task_kind: "screening",
      parent_agent_run_id: parentAgentRun.id,
      status: admission.status,
      session_key: admission.sessionKey,
      target_record_type: "screening_target",
      target_record_id: targetResult.record.id,
      target_summary: childTarget.company_name,
      current_stage: admission.currentStage,
      queue_priority: admission.queuePriority,
      queued_at: admission.queuedAt,
      cost_usd_estimate: input.estimated_cost_usd / Math.max(targetCount, 1),
      visibility_scope: input.visibility_scope,
      metadata_json: {
        ...input.metadata_json,
        target_count: 1,
        screening_batch_id: batchId,
        screening_batch_target_id: batchTargetId,
        screening_parent_agent_run_id: parentAgentRun.id,
        child_target_json: childTarget,
        planned_session_key: plannedSessionKeyForChild(input, index),
        notification_silent: true,
        screening_execution_mode: settings.screeningExecutionMode,
        max_targets_per_session: settings.screeningMaxTargetsPerSession,
        ...paidSourcePolicyMetadata(paidSourcePolicy),
        ...workloadMetadata(admission),
      },
    });
    await client.query(
      `
        insert into screening_batch_targets (
          id,
          tenant_id,
          screening_batch_id,
          screening_target_id,
          child_agent_run_id,
          target_order,
          status,
          paid_email_call_status,
          paid_trade_call_status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        batchTargetId,
        context.tenantId,
        batchId,
        targetResult.record.id,
        childAgentRun.id,
        index + 1,
        childAgentRun.status,
        paidEmailEnabled ? "available" : "disabled",
        paidTradeEnabled ? "available" : "disabled",
      ],
    );
    await createAgentRunActivityEvent(client, context, {
      agentRunId: childAgentRun.id,
      agentId: "cbe-buyer-screening",
      taskKind: "screening",
      targetRecordType: "screening_target",
      targetRecordId: targetResult.record.id,
      targetSummary: childTarget.company_name,
      stage: childAgentRun.status,
      eventType: "screening_child_run_created",
      status: childAgentRun.status,
      metadataJson: {
        screening_batch_id: batchId,
        screening_batch_target_id: batchTargetId,
        parent_agent_run_id: parentAgentRun.id,
        target_order: index + 1,
      },
    });
    childRuns.push({
      batchTargetId,
      targetOrder: index + 1,
      status: childAgentRun.status,
      agentRun: childAgentRun,
      target: childTarget,
      paidSourcePolicy,
    });
  }

  await createAgentRunActivityEvent(client, context, {
    agentRunId: parentAgentRun.id,
    agentId: "cbe-buyer-screening",
    taskKind: "screening",
    targetRecordType: "screening_batch",
    targetRecordId: batchId,
    targetSummary: input.target_summary,
    stage: "running",
    eventType: "screening_batch_created",
    status: "running",
    metadataJson: {
      screening_batch_id: batchId,
      requested_target_count: targetCount,
      child_run_count: childRuns.length,
    },
  });
  await createAuditEvent(client, context, {
    agentId: "cbe-buyer-screening",
    eventType: "screening_batch_created",
    dataTier: "T1",
    metadataJson: {
      agent_run_id: parentAgentRun.id,
      screening_batch_id: batchId,
      requested_target_count: targetCount,
    },
  });

  const batch = await loadScreeningBatchRecord(client, context, batchId);
  return { agentRun: parentAgentRun, batch, childRuns };
}

export async function createScreeningRun(
  context: TenantContext,
  rawInput: CreateScreeningRunRequest,
) {
  const input = CreateScreeningRunRequestSchema.parse(rawInput);
  const targetCount = input.targets?.length ?? (typeof input.metadata_json.target_count === "number"
    ? input.metadata_json.target_count
    : 1);
  const settings = getCbeWorkloadSettings();
  const shouldFanOut =
    targetCount > settings.screeningMaxTargetsPerSession &&
    !(settings.screeningAllowBatch3 && settings.screeningExecutionMode === "batch3_experiment" && targetCount <= 3);
  if (shouldFanOut && (!input.targets || input.targets.length !== targetCount)) {
    throw new CbeStoreError(
      400,
      "screening_targets_required",
      "批量背调需要提交每个客户的结构化目标，才能拆分为单客户子任务。",
    );
  }
  await checkCbeCostBudgetBeforeRun(context, {
    agentId: "cbe-buyer-screening",
    taskKind: "screening",
    targetSummary: input.target_summary,
    estimatedCostUsd: input.estimated_cost_usd,
    metadataJson: input.metadata_json,
  });
  return withCbeTransaction(async (client) => {
    if (shouldFanOut) {
      return createScreeningBatchRun(client, context, input, targetCount);
    }
    assertScreeningSessionShape(targetCount, settings);
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

export async function claimQueuedScreeningChildRuns(
  context: TenantContext,
  rawInput: Partial<ClaimQueuedScreeningRunsRequest> = {},
) {
  const input = ClaimQueuedScreeningRunsRequestSchema.parse(rawInput);
  return withCbeTransaction(async (client) => {
    const scopeClause = context.cbeRole === "admin"
      ? ""
      : "and (ar.owner_user_id = $2 or ar.user_id = $2 or ar.visibility_scope = 'tenant_shared')";
    const batchClause = input.screening_batch_id
      ? `and sbt.screening_batch_id = $${context.cbeRole === "admin" ? 2 : 3}`
      : "";
    const limitIndex = (context.cbeRole === "admin" ? 2 : 3) + (input.screening_batch_id ? 1 : 0);
    const values: unknown[] = [context.tenantId];
    if (context.cbeRole !== "admin") values.push(context.userId);
    if (input.screening_batch_id) values.push(input.screening_batch_id);
    values.push(input.limit);

    const queued = await client.query<QueuedScreeningChildRow>(
      `
        select
          ar.id as agent_run_id,
          sbt.screening_batch_id,
          sbt.id as batch_target_id,
          sbt.target_order,
          ar.metadata_json,
          sbt.paid_email_call_status,
          sbt.paid_email_call_count,
          sbt.paid_email_reapproved_at,
          sbt.paid_trade_call_status,
          sbt.paid_trade_call_count,
          sbt.paid_trade_spend_usd::text as paid_trade_spend_usd,
          sbt.paid_trade_reapproved_at,
          sb.paid_email_enabled,
          sb.paid_trade_enabled,
          sb.per_target_trade_budget_usd::text as per_target_trade_budget_usd
        from agent_runs ar
        join screening_batch_targets sbt
          on sbt.tenant_id = ar.tenant_id
         and sbt.child_agent_run_id = ar.id
        join screening_batches sb
          on sb.tenant_id = sbt.tenant_id
         and sb.id = sbt.screening_batch_id
        where ar.tenant_id = $1
          and ar.agent_id = 'cbe-buyer-screening'
          and ar.task_kind = 'screening'
          and ar.status = 'queued'
          and sbt.status = 'queued'
          and (ar.lease_until is null or ar.lease_until < now())
          ${scopeClause}
          ${batchClause}
        order by ar.queue_priority desc, ar.queued_at asc nulls last, sbt.target_order asc
        limit $${limitIndex}
        for update skip locked
      `,
      values,
    );

    const childRuns: ScreeningChildRunRecord[] = [];
    for (const row of queued.rows) {
      const metadata = row.metadata_json ?? {};
      const paidSourcePolicy = paidSourcePolicyFromRow(row);
      const plannedSessionKey =
        typeof metadata.planned_session_key === "string" && metadata.planned_session_key.trim()
          ? metadata.planned_session_key
          : `agent:cbe-buyer-screening:dashboard:${createCbeId("session")}`;
      const admission = await admitCbeWorkload(client, context, {
        agentId: "cbe-buyer-screening",
        taskKind: "screening",
        requestedSessionKey: plannedSessionKey,
        currentStageWhenRunning: "submitted_to_employee",
        currentStageWhenQueued: "queued",
      });
      if (admission.status !== "running" || !admission.sessionKey) break;
      const leaseUntil = new Date(Date.now() + admission.settings.queueLeaseSeconds * 1000).toISOString();
      await client.query(
        `
          update agent_runs
          set metadata_json = metadata_json || $3::jsonb
          where tenant_id = $1
            and id = $2
        `,
        [
          context.tenantId,
          row.agent_run_id,
          JSON.stringify({
            planned_session_key: plannedSessionKey,
            ...paidSourcePolicyMetadata(paidSourcePolicy),
          }),
        ],
      );
      const agentRun = await markAgentRunRunning(client, context, {
        agentRunId: row.agent_run_id,
        sessionKey: admission.sessionKey,
        currentStage: admission.currentStage,
        leaseOwner: "dashboard-route-drain",
        leaseUntil,
      });
      if (!agentRun) continue;
      await client.query(
        `
          update screening_batch_targets
          set status = 'running'
          where tenant_id = $1
            and id = $2
        `,
        [context.tenantId, row.batch_target_id],
      );
      await createAgentRunActivityEvent(client, context, {
        agentRunId: row.agent_run_id,
        agentId: "cbe-buyer-screening",
        taskKind: "screening",
        targetRecordType: "screening_batch_target",
        targetRecordId: row.batch_target_id,
        targetSummary: agentRun.targetSummary ?? undefined,
        stage: "running",
        eventType: "screening_child_run_claimed",
        status: "running",
        metadataJson: {
          screening_batch_id: row.screening_batch_id,
          screening_batch_target_id: row.batch_target_id,
          target_order: row.target_order,
          lease_until: leaseUntil,
        },
      });
      childRuns.push({
        batchTargetId: row.batch_target_id,
        targetOrder: row.target_order,
        status: "running",
        agentRun,
        target: childTargetFromMetadata(metadata),
        paidSourcePolicy,
      });
    }

    const batchId = input.screening_batch_id ?? queued.rows[0]?.screening_batch_id;
    const batch = batchId ? await loadScreeningBatchRecord(client, context, batchId) : null;
    return {
      batch,
      childRuns,
      queuedRemaining: batch?.aggregate.queued ?? 0,
    };
  });
}

export async function retryFailedScreeningChildRun(
  context: TenantContext,
  agentRunId: string,
  rawInput: Partial<RetryScreeningChildRunRequest> = {},
) {
  const input = RetryScreeningChildRunRequestSchema.parse(rawInput);
  return withCbeTransaction(async (client) => {
    const result = await client.query<ScreeningRetryChildRow>(
      `
        select
          ar.id as agent_run_id,
          ar.id as child_agent_run_id,
          sb.parent_agent_run_id,
          sbt.screening_batch_id,
          sbt.id as batch_target_id,
          sbt.screening_target_id,
          sbt.target_order,
          sbt.status,
          ar.metadata_json,
          sbt.paid_email_call_status,
          sbt.paid_email_call_count,
          sbt.paid_email_reapproved_at,
          sbt.paid_trade_call_status,
          sbt.paid_trade_call_count,
          sbt.paid_trade_spend_usd::text as paid_trade_spend_usd,
          sbt.paid_trade_reapproved_at,
          sb.paid_email_enabled,
          sb.paid_trade_enabled,
          sb.per_target_trade_budget_usd::text as per_target_trade_budget_usd,
          jsonb_build_object(
            'target_id', st.id,
            'source', st.source,
            'lead_id', st.lead_candidate_id,
            'company_name', st.company_name,
            'country', st.country,
            'domain', st.domain,
            'email', st.email,
            'contact_person', st.contact_person,
            'product_interest', st.product_interest_json,
            'supplied_fields', array[]::text[],
            'missing_fields', array[]::text[]
          ) as target_json
        from screening_batch_targets sbt
        join screening_batches sb
          on sb.tenant_id = sbt.tenant_id
         and sb.id = sbt.screening_batch_id
        join agent_runs ar
          on ar.tenant_id = sbt.tenant_id
         and ar.id = sbt.child_agent_run_id
        join screening_targets st
          on st.tenant_id = sbt.tenant_id
         and st.id = sbt.screening_target_id
        where sbt.tenant_id = $1
          and sbt.child_agent_run_id = $2
          and (ar.owner_user_id = $3 or ar.user_id = $3 or $4::boolean)
        limit 1
        for update
      `,
      [context.tenantId, agentRunId, context.userId, context.cbeRole === "admin"],
    );
    const row = result.rows[0];
    if (!row) {
      throw new CbeStoreError(404, "screening_child_missing", "Screening child run was not found or is outside the user's scope.");
    }
    if (row.status !== "failed") {
      throw new CbeStoreError(409, "screening_child_not_retryable", "Only failed Screening child runs can be retried.");
    }

    const nextEmailStatus = input.reapprove_paid_email && row.paid_email_enabled
      ? "reapproved"
      : row.paid_email_call_status;
    const nextTradeStatus = input.reapprove_paid_trade && row.paid_trade_enabled
      ? "reapproved"
      : row.paid_trade_call_status;
    await client.query(
      `
        update screening_batch_targets
        set
          status = 'queued',
          error_code = null,
          retry_count = retry_count + 1,
          last_retry_at = now(),
          paid_email_call_status = $3,
          paid_email_reapproved_by_user_id = case when $4::boolean then $5 else paid_email_reapproved_by_user_id end,
          paid_email_reapproved_at = case when $4::boolean then now() else paid_email_reapproved_at end,
          paid_trade_call_status = $6,
          paid_trade_reapproved_by_user_id = case when $7::boolean then $5 else paid_trade_reapproved_by_user_id end,
          paid_trade_reapproved_at = case when $7::boolean then now() else paid_trade_reapproved_at end
        where tenant_id = $1
          and id = $2
      `,
      [
        context.tenantId,
        row.batch_target_id,
        nextEmailStatus,
        input.reapprove_paid_email,
        context.userId,
        nextTradeStatus,
        input.reapprove_paid_trade,
      ],
    );

    const policy = paidSourcePolicyFromRow({
      ...row,
      paid_email_call_status: nextEmailStatus,
      paid_email_reapproved_at: input.reapprove_paid_email ? new Date() : row.paid_email_reapproved_at,
      paid_trade_call_status: nextTradeStatus,
      paid_trade_reapproved_at: input.reapprove_paid_trade ? new Date() : row.paid_trade_reapproved_at,
    });
    const metadataPatch = {
      retry_count_incremented_at: new Date().toISOString(),
      retry_approval_reason: input.approval_reason,
      ...paidSourcePolicyMetadata(policy),
    };
    const plannedSessionKey = input.session_key ??
      (typeof row.metadata_json.planned_session_key === "string" && row.metadata_json.planned_session_key.trim()
        ? row.metadata_json.planned_session_key
        : `agent:cbe-buyer-screening:dashboard:${createCbeId("session")}`);
    const admission = await admitCbeWorkload(client, context, {
      agentId: "cbe-buyer-screening",
      taskKind: "screening",
      requestedSessionKey: plannedSessionKey,
      currentStageWhenRunning: "submitted_to_employee",
      currentStageWhenQueued: "queued",
    });

    let agentRun: AgentRunRecord | null = null;
    if (admission.status === "running" && admission.sessionKey) {
      agentRun = await markAgentRunRunning(client, context, {
        agentRunId,
        sessionKey: admission.sessionKey,
        currentStage: admission.currentStage,
        leaseOwner: "dashboard-route-retry",
        leaseUntil: new Date(Date.now() + admission.settings.queueLeaseSeconds * 1000).toISOString(),
      });
      await client.query(
        `
          update agent_runs
          set metadata_json = metadata_json || $3::jsonb
          where tenant_id = $1
            and id = $2
        `,
        [context.tenantId, agentRunId, JSON.stringify(metadataPatch)],
      );
      await client.query(
        `update screening_batch_targets set status = 'running' where tenant_id = $1 and id = $2`,
        [context.tenantId, row.batch_target_id],
      );
    } else {
      const queuedRun = await client.query<ScreeningAgentRunRow>(
        `
          update agent_runs
          set
            status = 'queued',
            session_key = null,
            current_stage = 'queued',
            queue_priority = $3,
            queued_at = coalesce($4::timestamptz, now()),
            lease_owner = null,
            lease_until = null,
            finished_at = null,
            error_code = null,
            error_message = null,
            last_activity_at = now(),
            metadata_json = metadata_json || $5::jsonb
          where tenant_id = $1
            and id = $2
          returning *
        `,
        [
          context.tenantId,
          agentRunId,
          admission.queuePriority,
          admission.queuedAt,
          JSON.stringify({
            planned_session_key: plannedSessionKey,
            ...metadataPatch,
            ...workloadMetadata(admission),
          }),
        ],
      );
      agentRun = queuedRun.rows[0] ? toAgentRunRecord(queuedRun.rows[0]) : null;
    }

    if (!agentRun) {
      throw new CbeStoreError(404, "screening_child_missing", "Screening child run could not be retried.");
    }
    await refreshScreeningBatchAggregate(client, context, { batchId: row.screening_batch_id });
    await createAgentRunActivityEvent(client, context, {
      agentRunId,
      agentId: "cbe-buyer-screening",
      taskKind: "screening",
      targetRecordType: "screening_batch_target",
      targetRecordId: row.batch_target_id,
      targetSummary: agentRun.targetSummary ?? undefined,
      stage: agentRun.status,
      eventType: "screening_child_retry_requested",
      status: agentRun.status,
      metadataJson: {
        screening_batch_id: row.screening_batch_id,
        screening_batch_target_id: row.batch_target_id,
        reapprove_paid_email: input.reapprove_paid_email,
        reapprove_paid_trade: input.reapprove_paid_trade,
        paid_source_policy: policy,
      },
    });
    await createAuditEvent(client, context, {
      agentId: "cbe-buyer-screening",
      eventType: input.reapprove_paid_email || input.reapprove_paid_trade
        ? "screening_paid_retry_reapproved"
        : "screening_child_retry_requested",
      dataTier: "T2",
      metadataJson: {
        agent_run_id: agentRunId,
        screening_batch_id: row.screening_batch_id,
        screening_batch_target_id: row.batch_target_id,
        reapprove_paid_email: input.reapprove_paid_email,
        reapprove_paid_trade: input.reapprove_paid_trade,
      },
    });

    return {
      batch: await loadScreeningBatchRecord(client, context, row.screening_batch_id),
      childRun: {
        batchTargetId: row.batch_target_id,
        targetOrder: row.target_order,
        status: agentRun.status,
        agentRun,
        target: childTargetFromMetadata(row.metadata_json) ?? row.target_json,
        paidSourcePolicy: policy,
      } satisfies ScreeningChildRunRecord,
    };
  });
}

export async function markScreeningChildRunFailed(
  client: PoolClient,
  context: TenantContext,
  input: { agentRunId: string; errorCode: string },
) {
  await client.query(
    `
      update screening_batch_targets
      set
        status = 'failed',
        error_code = $3,
        paid_email_call_status = case
          when paid_email_call_status in ('available', 'reapproved') then 'reapproval_required'
          else paid_email_call_status
        end,
        paid_trade_call_status = case
          when paid_trade_call_status in ('available', 'reapproved') then 'reapproval_required'
          else paid_trade_call_status
        end
      where tenant_id = $1
        and child_agent_run_id = $2
        and status in ('queued', 'running')
    `,
    [context.tenantId, input.agentRunId, input.errorCode],
  );
  return refreshScreeningBatchAggregate(client, context, { childAgentRunId: input.agentRunId });
}

export async function markScreeningChildRunCancelled(
  client: PoolClient,
  context: TenantContext,
  input: { agentRunId: string },
) {
  await client.query(
    `
      update screening_batch_targets
      set
        status = 'cancelled',
        error_code = 'cancelled'
      where tenant_id = $1
        and child_agent_run_id = $2
        and status in ('queued', 'running')
    `,
    [context.tenantId, input.agentRunId],
  );
  return refreshScreeningBatchAggregate(client, context, { childAgentRunId: input.agentRunId });
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
      const usedPaidEmail = report.evidence.some(paidEmailObserved);
      const usedPaidTrade = report.evidence.some(paidTradeObserved);
      const paidTradeCostUsd = report.evidence
        .filter(paidTradeObserved)
        .reduce((sum, evidence) => sum + (evidence.cost_usd ?? 0), 0);
      await client.query(
        `
          update screening_batch_targets
          set
            paid_email_call_count = paid_email_call_count + $3::integer,
            paid_email_call_status = case
              when $3::integer > 0 then 'used'
              else paid_email_call_status
            end,
            paid_trade_call_count = paid_trade_call_count + $4::integer,
            paid_trade_spend_usd = paid_trade_spend_usd + $5::numeric,
            paid_trade_call_status = case
              when $4::integer > 0 then 'used'
              else paid_trade_call_status
            end
          where tenant_id = $1
            and child_agent_run_id = $2
        `,
        [
          context.tenantId,
          input.agent_run_id,
          usedPaidEmail ? 1 : 0,
          usedPaidTrade ? 1 : 0,
          paidTradeCostUsd,
        ],
      );
      if (usedPaidEmail) {
        await createApiLedgerEntry(client, context, {
          agentRunId: input.agent_run_id,
          provider: "paid-email-validation",
          endpoint: "screening-email-validation",
          sourceType: "paid_email_validation",
          requestUnits: 1,
          costUsd: report.evidence.find(paidEmailObserved)?.cost_usd,
          status: "observed",
          metadataJson: {
            screening_report_id: savedReport.id,
            screening_target_id: target.record.id,
            company_name: report.company_name,
          },
        });
      }
      if (usedPaidTrade) {
        await createApiLedgerEntry(client, context, {
          agentRunId: input.agent_run_id,
          provider: "paid-trade-data",
          endpoint: "screening-trade-data",
          sourceType: "paid_trade_data",
          requestUnits: 1,
          costUsd: paidTradeCostUsd || undefined,
          status: "observed",
          metadataJson: {
            screening_report_id: savedReport.id,
            screening_target_id: target.record.id,
            company_name: report.company_name,
          },
        });
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
    await client.query(
      `
        update screening_batch_targets
        set status = 'completed'
        where tenant_id = $1
          and child_agent_run_id = $2
          and status in ('queued', 'running')
      `,
      [context.tenantId, input.agent_run_id],
    );
    const batchAggregate = await refreshScreeningBatchAggregate(client, context, {
      childAgentRunId: input.agent_run_id,
    });
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
        screening_batch: batchAggregate,
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
    const failed = await failAgentRun(client, context, {
      agentRunId: input.agentRunId,
      sessionKey: input.sessionKey,
      errorCode: "marker_parse_failed",
      errorMessage: input.message,
      metadataJson: { validation_error: input.details },
    });
    await client.query(
      `
        update screening_batch_targets
        set
          status = 'failed',
          error_code = 'marker_parse_failed',
          paid_email_call_status = case
            when paid_email_call_status in ('available', 'reapproved') then 'reapproval_required'
            else paid_email_call_status
          end,
          paid_trade_call_status = case
            when paid_trade_call_status in ('available', 'reapproved') then 'reapproval_required'
            else paid_trade_call_status
          end
        where tenant_id = $1
          and child_agent_run_id = $2
          and status in ('queued', 'running')
      `,
      [context.tenantId, input.agentRunId],
    );
    await refreshScreeningBatchAggregate(client, context, { childAgentRunId: input.agentRunId });
    return failed;
  });
}
