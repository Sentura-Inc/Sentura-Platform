import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import { completeAgentRun, createAgentRunActivityEvent, failAgentRun, insertAgentRun } from "./agent-runs";
import { createAuditEvent } from "./audit";
import { admitCbeWorkload, getCbeWorkloadSettings, workloadMetadata } from "./workload-coordinator";
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

export interface SimilarLeadScope {
  scopeId: string;
  scopeHash: string;
  similarity: number;
  activeAgentRunId: string | null;
  requestedTotal: number;
  producedUniqueCount: number;
  lockedUntil: string | null;
}

export type LeadCoordinatorDecision =
  | { action: "start_new_run"; scopeId: string; leadRunId: string; agentRunId: string; denylist: string[]; workloadStatus: "running" | "queued" }
  | { action: "join_existing"; scopeId: string; leadRunId: string; activeAgentRunId: string }
  | { action: "offer_near_duplicate_choices"; similarScopes: SimilarLeadScope[] }
  | { action: "queue_top_up"; scopeId: string; leadRunId: string; agentRunId: string; missingCount: number; denylist: string[]; workloadStatus: "running" | "queued" };

interface LeadScopeRow {
  id: string;
  scope_hash: string;
  canonical_scope_json: Record<string, unknown>;
  status: string;
  active_agent_run_id: string | null;
  requested_total: number;
  produced_unique_count: number;
  locked_until: Date | null;
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

type LeadCandidateReconciliationStatus =
  | "new_unique"
  | "duplicate_same_owner"
  | "duplicate_other_operator";

export interface LeadCandidateReconciliationItem {
  rank: number;
  identityKey: string;
  leadIdentityId: string;
  companyName: string;
  normalizedDomain: string | null;
  country: string | null;
  status: LeadCandidateReconciliationStatus;
  duplicateReason: string | null;
  existingCandidateId: string | null;
  existingOwnerUserId: string | null;
  existingOwnerName: string | null;
  savedCandidateId: string | null;
}

export interface LeadRunReconciliationSummary {
  requestedCount: number;
  returnedCount: number;
  newUniqueCount: number;
  duplicateCount: number;
  missingCount: number;
  topUpNeeded: boolean;
  identityDenylist: string[];
  items: LeadCandidateReconciliationItem[];
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

interface LeadIdentityRecord {
  id: string;
  identityKey: string;
  normalizedDomain: string | null;
}

interface ExistingLeadCandidateRow {
  id: string;
  lead_identity_id: string | null;
  company_name: string;
  normalized_domain: string | null;
  country: string | null;
  owner_user_id: string | null;
  visibility_scope: string;
  team_name: string | null;
  owner_display_name: string | null;
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

function normalizedStrings(value: unknown, options: { upper?: boolean } = {}) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return Array.from(new Set(items
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => (options.upper ? item.toUpperCase() : item.toLowerCase())))).sort();
}

function leadScopeFingerprint(queryConfig: Record<string, unknown>) {
  const canonicalScopeJson = {
    products: normalizedStrings(queryConfig.product_keywords ?? queryConfig.products),
    buyer_personas: normalizedStrings(queryConfig.buyer_types ?? queryConfig.buyer_personas),
    countries: normalizedStrings(queryConfig.countries, { upper: true }),
    languages: normalizedStrings(queryConfig.languages),
    source_policy: normalizedStrings(queryConfig.source_policy ?? ["public_web", "company_site_only"]),
    exclude_domains: normalizedStrings(queryConfig.exclude_domains),
    time_window_hours: 24,
  };
  const canonical = JSON.stringify(canonicalScopeJson);
  return {
    canonicalScopeJson,
    scopeHash: `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`,
  };
}

function overlapScore(left: unknown, right: unknown) {
  const a = new Set(Array.isArray(left) ? left.map(String) : []);
  const b = new Set(Array.isArray(right) ? right.map(String) : []);
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / Math.max(a.size, b.size);
}

function leadScopeSimilarity(left: Record<string, unknown>, right: Record<string, unknown>) {
  return (
    overlapScore(left.products, right.products) * 0.35 +
    overlapScore(left.buyer_personas, right.buyer_personas) * 0.25 +
    overlapScore(left.countries, right.countries) * 0.25 +
    (
      overlapScore(left.source_policy, right.source_policy) * 0.5 +
      overlapScore(left.exclude_domains, right.exclude_domains) * 0.5
    ) * 0.10 +
    overlapScore(left.languages, right.languages) * 0.05
  );
}

async function upsertLeadScope(
  client: PoolClient,
  context: TenantContext,
  input: {
    scopeHash: string;
    canonicalScopeJson: Record<string, unknown>;
    requestedCount: number;
  },
) {
  const result = await client.query<LeadScopeRow>(
    `
      insert into lead_discovery_scopes (
        id,
        tenant_id,
        scope_hash,
        canonical_scope_json,
        status,
        requested_total
      )
      values ($1, $2, $3, $4::jsonb, 'idle', $5)
      on conflict (tenant_id, scope_hash)
      do update set
        requested_total = greatest(lead_discovery_scopes.requested_total, excluded.requested_total),
        updated_at = now()
      returning *
    `,
    [
      createCbeId("lead_scope"),
      context.tenantId,
      input.scopeHash,
      JSON.stringify(input.canonicalScopeJson),
      input.requestedCount,
    ],
  );
  return result.rows[0];
}

function scopeLeaseActive(scope: LeadScopeRow) {
  return scope.status === "running" &&
    Boolean(scope.active_agent_run_id) &&
    Boolean(scope.locked_until) &&
    scope.locked_until!.getTime() > Date.now();
}

async function createLeadRunRow(
  client: PoolClient,
  context: TenantContext,
  input: CreateLeadRunRequest,
  options: { agentRunId?: string | null; status: "queued" | "running" | "completed"; targetCount?: number },
) {
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
        target_count,
        completed_at
      )
      values ($1, $2, $3, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, case when $9 = 'completed' then now() else null end)
      returning id, agent_run_id, status, target_count, completed_at
    `,
    [
      leadRunId,
      context.tenantId,
      context.userId,
      context.departmentId ?? null,
      context.teamName ?? null,
      input.visibility_scope,
      options.agentRunId ?? null,
      JSON.stringify(input.query_config),
      options.status,
      options.targetCount ?? input.target_count,
    ],
  );
  return toLeadRunRecord(leadRun.rows[0]);
}

async function insertLeadMembership(
  client: PoolClient,
  context: TenantContext,
  input: {
    scopeId: string;
    leadRunId: string;
    mode: "started_new" | "joined_existing" | "reuse_completed_pool" | "top_up";
    requestedCount: number;
  },
) {
  await client.query(
    `
      insert into lead_run_memberships (
        id,
        tenant_id,
        scope_id,
        lead_run_id,
        user_id,
        mode,
        requested_count
      )
      values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      createCbeId("lead_membership"),
      context.tenantId,
      input.scopeId,
      input.leadRunId,
      context.userId,
      input.mode,
      input.requestedCount,
    ],
  );
}

async function findNearDuplicateScopes(
  client: PoolClient,
  context: TenantContext,
  scopeHash: string,
  canonicalScopeJson: Record<string, unknown>,
) {
  const result = await client.query<LeadScopeRow>(
    `
      select *
      from lead_discovery_scopes
      where tenant_id = $1
        and scope_hash <> $2
        and status = 'running'
        and locked_until > now()
      order by updated_at desc
      limit 12
    `,
    [context.tenantId, scopeHash],
  );
  return result.rows
    .map((row) => ({
      scopeId: row.id,
      scopeHash: row.scope_hash,
      similarity: Number(leadScopeSimilarity(canonicalScopeJson, row.canonical_scope_json).toFixed(4)),
      activeAgentRunId: row.active_agent_run_id,
      requestedTotal: row.requested_total,
      producedUniqueCount: row.produced_unique_count,
      lockedUntil: row.locked_until?.toISOString() ?? null,
    }))
    .filter((scope) => scope.similarity >= 0.75)
    .sort((a, b) => b.similarity - a.similarity);
}

async function identityKeysForScope(client: PoolClient, context: TenantContext, scopeId: string) {
  const result = await client.query<{ identity_key: string }>(
    `
      select distinct li.identity_key
      from lead_run_memberships m
      join lead_run_results lrr
        on lrr.tenant_id = m.tenant_id
       and lrr.lead_run_id = m.lead_run_id
      join lead_identities li
        on li.tenant_id = lrr.tenant_id
       and li.id = lrr.lead_identity_id
      where m.tenant_id = $1
        and m.scope_id = $2
      order by li.identity_key
    `,
    [context.tenantId, scopeId],
  );
  return result.rows.map((row) => row.identity_key);
}

async function identityKeysForTenantCandidates(client: PoolClient, context: TenantContext) {
  const result = await client.query<{ identity_key: string }>(
    `
      select distinct li.identity_key
      from lead_candidates lc
      join lead_identities li
        on li.tenant_id = lc.tenant_id
       and li.id = lc.lead_identity_id
      where lc.tenant_id = $1
      order by li.identity_key
    `,
    [context.tenantId],
  );
  return result.rows.map((row) => row.identity_key);
}

async function producedCandidateCountForScope(client: PoolClient, context: TenantContext, scopeId: string) {
  const result = await client.query<{ count: string }>(
    `
      select count(distinct lc.lead_identity_id)::text as count
      from lead_run_memberships m
      join lead_candidates lc
        on lc.tenant_id = m.tenant_id
       and lc.lead_run_id = m.lead_run_id
      where m.tenant_id = $1
        and m.scope_id = $2
    `,
    [context.tenantId, scopeId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

function uniqueIdentityKeys(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

async function activateLeadScope(
  client: PoolClient,
  context: TenantContext,
  input: {
    scopeId: string;
    activeAgentRunId: string;
    requestedCount: number;
  },
) {
  const settings = getCbeWorkloadSettings();
  await client.query(
    `
      update lead_discovery_scopes
      set
        status = 'running',
        active_agent_run_id = $3,
        requested_total = greatest(requested_total, $4),
        locked_until = now() + ($5::text || ' seconds')::interval,
        heartbeat_at = now(),
        updated_at = now()
      where tenant_id = $1
        and id = $2
    `,
    [context.tenantId, input.scopeId, input.activeAgentRunId, input.requestedCount, settings.queueLeaseSeconds],
  );
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
  if (lead.google_place_id) return `google_place:${lead.google_place_id}`;
  const domain = normalizeDomain(lead.domain ?? lead.website);
  if (domain) return `domain:${domain}`;
  return `name:${lead.company_name.trim().toLowerCase()}|country:${lead.country}`;
}

async function upsertLeadIdentity(
  client: PoolClient,
  context: TenantContext,
  lead: LeadCandidateMarker,
): Promise<LeadIdentityRecord> {
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
  return {
    id: result.rows[0].id,
    identityKey,
    normalizedDomain,
  };
}

async function findExistingLeadCandidate(
  client: PoolClient,
  context: TenantContext,
  input: { leadIdentityId: string; normalizedDomain: string | null },
) {
  const result = await client.query<ExistingLeadCandidateRow>(
    `
      select
        lc.id,
        lc.lead_identity_id,
        lc.company_name,
        lc.normalized_domain,
        lc.country,
        lc.owner_user_id,
        lc.visibility_scope,
        lc.team_name,
        profile.display_name as owner_display_name
      from lead_candidates lc
      left join cbe_user_profiles profile
        on profile.tenant_id = lc.tenant_id
       and profile.user_id = lc.owner_user_id
      where lc.tenant_id = $1
        and (
          lc.lead_identity_id = $2
          or ($3::text is not null and lc.normalized_domain = $3)
        )
      order by lc.created_at asc
      limit 1
    `,
    [context.tenantId, input.leadIdentityId, input.normalizedDomain],
  );
  return result.rows[0] ?? null;
}

function duplicateStatusForCandidate(
  existing: ExistingLeadCandidateRow,
  context: TenantContext,
): Exclude<LeadCandidateReconciliationStatus, "new_unique"> {
  return existing.owner_user_id === context.userId ? "duplicate_same_owner" : "duplicate_other_operator";
}

function duplicateReasonForCandidate(
  existing: ExistingLeadCandidateRow,
  context: TenantContext,
) {
  const ownerName = existing.owner_display_name ?? existing.owner_user_id ?? "其他员工";
  return existing.owner_user_id === context.userId
    ? `already_exists_in_current_employee_list:${existing.id}`
    : `already_owned_by:${ownerName}:${existing.id}`;
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
    metadataJson: {
      ...input.metadata_json,
      query_config: input.query_config,
      target_count: input.target_count,
    },
  });
  return withCbeTransaction(async (client) => {
    const admission = await admitCbeWorkload(client, context, {
      agentId: "cbe-lead-discovery",
      taskKind: "lead",
      requestedSessionKey: input.session_key,
      currentStageWhenRunning: "submitted_to_employee",
      currentStageWhenQueued: "queued",
    });
    const fingerprint = leadScopeFingerprint(input.query_config);
    const scope = await upsertLeadScope(client, context, {
      scopeHash: fingerprint.scopeHash,
      canonicalScopeJson: fingerprint.canonicalScopeJson,
      requestedCount: input.target_count,
    });

    if (scopeLeaseActive(scope) && scope.active_agent_run_id) {
      const leadRun = await createLeadRunRow(client, context, input, {
        agentRunId: scope.active_agent_run_id,
        status: "running",
      });
      await insertLeadMembership(client, context, {
        scopeId: scope.id,
        leadRunId: leadRun.id,
        mode: "joined_existing",
        requestedCount: input.target_count,
      });
      await createAuditEvent(client, context, {
        agentId: "cbe-lead-discovery",
        eventType: "lead_run_joined_existing",
        dataTier: "T1",
        metadataJson: {
          lead_run_id: leadRun.id,
          scope_id: scope.id,
          active_agent_run_id: scope.active_agent_run_id,
        },
      });
      const decision: LeadCoordinatorDecision = {
        action: "join_existing",
        scopeId: scope.id,
        leadRunId: leadRun.id,
        activeAgentRunId: scope.active_agent_run_id,
      };
      return { leadRun, coordinatorDecision: decision };
    }

    const similarScopes = await findNearDuplicateScopes(
      client,
      context,
      fingerprint.scopeHash,
      fingerprint.canonicalScopeJson,
    );
    if (similarScopes.length > 0) {
      const decision: LeadCoordinatorDecision = {
        action: "offer_near_duplicate_choices",
        similarScopes,
      };
      return { coordinatorDecision: decision };
    }

    const scopeDenylist = scope.status === "completed"
      ? await identityKeysForScope(client, context, scope.id)
      : [];
    const tenantDenylist = await identityKeysForTenantCandidates(client, context);
    const denylist = uniqueIdentityKeys([...scopeDenylist, ...tenantDenylist]);
    const runMode = input.run_mode === "top_up_unique_leads" ? "top_up_unique_leads" : "new_scope";
    // A normal operator request always means "add this many net-new customers
    // for this request", even when the scope was completed before. Only the
    // internal auto top-up loop passes a missing-count target.
    const missingCount = runMode === "top_up_unique_leads" ? input.target_count : 0;
    const agentTargetCount = input.target_count;
    const agentRun = await insertAgentRun(client, context, {
      agent_id: "cbe-lead-discovery",
      task_kind: "lead",
      status: admission.status,
      session_key: admission.sessionKey,
      target_summary: input.target_summary,
      current_stage: admission.currentStage,
      queue_priority: admission.queuePriority,
      queued_at: admission.queuedAt,
      cost_usd_estimate: input.estimated_cost_usd,
      visibility_scope: input.visibility_scope,
      metadata_json: {
        ...input.metadata_json,
        query_config: input.query_config,
        target_count: agentTargetCount,
        requested_target_count: input.target_count,
        lead_scope_id: scope.id,
        scope_hash: fingerprint.scopeHash,
        run_mode: runMode,
        existing_identity_keys: denylist,
        already_covered_queries: [],
        ...workloadMetadata(admission),
      },
    });
    const leadRun = await createLeadRunRow(client, context, input, {
      agentRunId: agentRun.id,
      status: admission.status,
      targetCount: agentTargetCount,
    });
    await activateLeadScope(client, context, {
      scopeId: scope.id,
      activeAgentRunId: agentRun.id,
      requestedCount: input.target_count,
    });
    await insertLeadMembership(client, context, {
      scopeId: scope.id,
      leadRunId: leadRun.id,
      mode: runMode === "top_up_unique_leads" ? "top_up" : "started_new",
      requestedCount: input.target_count,
    });
    await createAgentRunActivityEvent(client, context, {
      agentRunId: agentRun.id,
      agentId: "cbe-lead-discovery",
      taskKind: "lead",
      targetRecordType: "lead_run",
      targetRecordId: leadRun.id,
      targetSummary: input.target_summary,
      stage: admission.status,
      eventType: "lead_run_created",
      status: agentRun.status,
      metadataJson: {
        target_count: agentTargetCount,
        requested_target_count: input.target_count,
        coordinator_action: runMode === "top_up_unique_leads" ? "queue_top_up" : "start_new_run",
        scope_id: scope.id,
        pre_search_denylist_count: denylist.length,
      },
    });
    await createAuditEvent(client, context, {
      agentId: "cbe-lead-discovery",
      eventType: "lead_run_created",
      dataTier: "T1",
      metadataJson: {
        agent_run_id: agentRun.id,
        lead_run_id: leadRun.id,
        scope_id: scope.id,
        coordinator_action: runMode === "top_up_unique_leads" ? "queue_top_up" : "start_new_run",
        target_count: agentTargetCount,
        requested_target_count: input.target_count,
        pre_search_denylist_count: denylist.length,
      },
    });
    const coordinatorDecision: LeadCoordinatorDecision = runMode === "top_up_unique_leads"
      ? {
          action: "queue_top_up",
          scopeId: scope.id,
          leadRunId: leadRun.id,
          agentRunId: agentRun.id,
          missingCount,
          denylist,
          workloadStatus: admission.status,
        }
      : {
          action: "start_new_run",
          scopeId: scope.id,
          leadRunId: leadRun.id,
          agentRunId: agentRun.id,
          denylist,
          workloadStatus: admission.status,
        };
    return { agentRun, leadRun, coordinatorDecision };
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
    const reconciliationItems: LeadCandidateReconciliationItem[] = [];
    for (const [index, lead] of input.payload.leads.entries()) {
      const leadIdentity = await upsertLeadIdentity(client, context, lead);
      let existingCandidate = await findExistingLeadCandidate(client, context, {
        leadIdentityId: leadIdentity.id,
        normalizedDomain: leadIdentity.normalizedDomain,
      });
      let candidate: LeadCandidateRecord | null = null;
      let status: LeadCandidateReconciliationStatus = "new_unique";
      let duplicateReason: string | null = null;

      if (existingCandidate) {
        status = duplicateStatusForCandidate(existingCandidate, context);
        duplicateReason = duplicateReasonForCandidate(existingCandidate, context);
      } else {
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
            do nothing
            returning id, company_name, normalized_domain, country, status
          `,
          [
            createCbeId("lead"),
            context.tenantId,
            leadRunId,
            leadIdentity.id,
            context.userId,
            context.departmentId ?? null,
            context.teamName ?? null,
            leadIdentity.normalizedDomain,
            lead.company_name,
            lead.country,
            lead.buyer_type,
            JSON.stringify(lead.matched_products),
            lead.confidence ?? null,
            lead.dedupe_key ?? lead.lead_id ?? leadIdentity.identityKey,
          ],
        );
        if (candidateResult.rows[0]) {
          candidate = toLeadCandidateRecord(candidateResult.rows[0]);
          candidateRecords.push(candidate);
          for (const evidence of lead.discovery_evidence) {
            sourceRecords.push(await insertLeadSource(client, context, candidate.id, evidence));
          }
        } else {
          existingCandidate = await findExistingLeadCandidate(client, context, {
            leadIdentityId: leadIdentity.id,
            normalizedDomain: leadIdentity.normalizedDomain,
          });
          if (!existingCandidate) {
            throw new CbeStoreError(409, "lead_duplicate_race", "Lead candidate conflicted but no existing row was visible.");
          }
          status = duplicateStatusForCandidate(existingCandidate, context);
          duplicateReason = duplicateReasonForCandidate(existingCandidate, context);
        }
      }
      const reconciliationItem: LeadCandidateReconciliationItem = {
        rank: index + 1,
        identityKey: leadIdentity.identityKey,
        leadIdentityId: leadIdentity.id,
        companyName: lead.company_name,
        normalizedDomain: leadIdentity.normalizedDomain,
        country: lead.country,
        status,
        duplicateReason,
        existingCandidateId: existingCandidate?.id ?? null,
        existingOwnerUserId: existingCandidate?.owner_user_id ?? null,
        existingOwnerName: existingCandidate?.owner_display_name ?? null,
        savedCandidateId: candidate?.id ?? null,
      };
      reconciliationItems.push(reconciliationItem);
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
          leadIdentity.id,
          index + 1,
          status === "new_unique" ? "new" : "duplicate",
          duplicateReason,
          JSON.stringify({
            ...lead,
            database_reconciliation: reconciliationItem,
          }),
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
    const scopeResult = await client.query<{ scope_id: string }>(
      `
        select scope_id
        from lead_run_memberships
        where tenant_id = $1
          and lead_run_id = $2
        order by joined_at asc
        limit 1
      `,
      [context.tenantId, leadRunId],
    );
    const scopeId = scopeResult.rows[0]?.scope_id;
    const topUpDenylist = uniqueIdentityKeys([
      ...(scopeId ? await identityKeysForScope(client, context, scopeId) : []),
      ...(await identityKeysForTenantCandidates(client, context)),
    ]);
    const missingCount = Math.max(0, existing.rows[0].target_count - candidateRecords.length);
    if (scopeId) {
      const producedCount = await producedCandidateCountForScope(client, context, scopeId);
      await client.query(
        `
          update lead_discovery_scopes
          set
            status = 'completed',
            active_agent_run_id = null,
            produced_unique_count = greatest(produced_unique_count, $3),
            locked_until = now(),
            heartbeat_at = now(),
            updated_at = now()
          where tenant_id = $1
            and id = $2
        `,
        [context.tenantId, scopeId, producedCount],
      );
    }
    const reconciliation: LeadRunReconciliationSummary = {
      requestedCount: existing.rows[0].target_count,
      returnedCount: input.payload.leads.length,
      newUniqueCount: candidateRecords.length,
      duplicateCount: reconciliationItems.filter((item) => item.status !== "new_unique").length,
      missingCount,
      topUpNeeded: missingCount > 0,
      identityDenylist: topUpDenylist,
      items: reconciliationItems,
    };
    const agentRun = await completeAgentRun(client, context, {
      agentRunId: input.agent_run_id,
      sessionKey: input.session_key,
      currentStage: "lead_results_saved",
      metadataJson: {
        lead_run_id: leadRunId,
        saved_leads: candidateRecords.length,
        items_produced: candidateRecords.length,
        returned_leads: input.payload.leads.length,
        duplicate_leads: reconciliation.duplicateCount,
        top_up_needed: reconciliation.topUpNeeded,
        missing_count: missingCount,
        existing_identity_keys: topUpDenylist,
        duplicate_identity_keys: reconciliationItems
          .filter((item) => item.status !== "new_unique")
          .map((item) => item.identityKey),
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
        returned_leads: input.payload.leads.length,
        duplicate_leads: reconciliation.duplicateCount,
        top_up_needed: reconciliation.topUpNeeded,
        missing_count: reconciliation.missingCount,
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
        returned_leads: input.payload.leads.length,
        duplicate_leads: reconciliation.duplicateCount,
        top_up_needed: reconciliation.topUpNeeded,
        missing_count: reconciliation.missingCount,
      },
    });

    return {
      agentRun,
      leadRun: toLeadRunRecord(leadRunResult.rows[0]),
      candidates: candidateRecords,
      sources: sourceRecords,
      reconciliation,
      topUp: missingCount > 0 && scopeId
        ? {
            scopeId,
            missingCount,
            denylist: topUpDenylist,
          }
        : null,
    };
  });
}

export async function failLeadCompletion(
  context: TenantContext,
  input: { agentRunId: string; sessionKey?: string; message: string; details?: unknown },
) {
  return withCbeTransaction(async (client) => {
    await client.query(
      `
        update lead_discovery_scopes
        set
          status = 'failed',
          active_agent_run_id = null,
          locked_until = now(),
          updated_at = now()
        where tenant_id = $1
          and active_agent_run_id = $2
      `,
      [context.tenantId, input.agentRunId],
    );
    await client.query(
      `
        update lead_runs
        set status = 'failed'
        where tenant_id = $1
          and agent_run_id = $2
          and status in ('queued', 'running')
      `,
      [context.tenantId, input.agentRunId],
    );
    return failAgentRun(client, context, {
      agentRunId: input.agentRunId,
      sessionKey: input.sessionKey,
      errorCode: "marker_parse_failed",
      errorMessage: input.message,
      metadataJson: { validation_error: input.details },
    });
  });
}
