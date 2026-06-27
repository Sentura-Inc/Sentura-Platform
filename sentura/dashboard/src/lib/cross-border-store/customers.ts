import { queryCbe, withCbeTransaction } from "./db";
import { createAuditEvent } from "./audit";
import { CbeStoreError } from "./errors";
import { scopedOwnerClause } from "./tenant-context";
import type { ListQuery, TenantContext } from "./schemas";

export interface EmployeeCustomerRecord {
  recordType: string;
  recordId: string;
  companyName: string;
  country: string | null;
  buyerType: string | null;
  domain: string | null;
  matchedProducts: string[];
  website: string | null;
  leadStatus: string;
  screeningStatus: string;
  latestScreeningReportId: string | null;
  normalizedScore: number | null;
  evidenceCoverage: number | null;
  recommendedAction: string | null;
  reportJson: Record<string, unknown> | null;
  ownerUserId: string | null;
  ownerName: string | null;
  teamName: string | null;
  leadAgentRunId: string | null;
  screeningAgentRunId: string | null;
  sourceUrls: string[];
  createdAt: string;
  updatedAt: string;
}

interface CustomerRow {
  record_type: string;
  record_id: string;
  company_name: string;
  country: string | null;
  buyer_type: string | null;
  domain: string | null;
  matched_products_json: unknown;
  target_fields_json: Record<string, unknown> | null;
  lead_status: string;
  screening_status: string;
  latest_screening_report_id: string | null;
  normalized_score: string | null;
  evidence_coverage: string | null;
  recommended_action: string | null;
  report_json: Record<string, unknown> | null;
  owner_user_id: string | null;
  owner_name: string | null;
  team_name: string | null;
  lead_agent_run_id: string | null;
  screening_agent_run_id: string | null;
  source_urls: string[] | null;
  created_at: Date;
  updated_at: Date;
}

function stringArray(value: unknown) {
  const items = Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && !Array.isArray(item)) {
            const product = (item as Record<string, unknown>).product;
            return typeof product === "string" ? product : null;
          }
          return null;
        })
        .filter((item): item is string => Boolean(item))
    : [];
  return Array.from(new Set(items));
}

function websiteFromRow(row: CustomerRow) {
  const targetWebsite =
    row.target_fields_json &&
    typeof row.target_fields_json === "object" &&
    typeof row.target_fields_json.website === "string"
      ? row.target_fields_json.website
      : null;
  if (targetWebsite) return targetWebsite;
  if (row.domain) return `https://${row.domain}`;
  return null;
}

function toCustomerRecord(row: CustomerRow): EmployeeCustomerRecord {
  return {
    recordType: row.record_type,
    recordId: row.record_id,
    companyName: row.company_name,
    country: row.country,
    buyerType: row.buyer_type,
    domain: row.domain,
    matchedProducts: stringArray(row.matched_products_json),
    website: websiteFromRow(row),
    leadStatus: row.lead_status,
    screeningStatus: row.screening_status,
    latestScreeningReportId: row.latest_screening_report_id,
    normalizedScore: row.normalized_score === null ? null : Number(row.normalized_score),
    evidenceCoverage: row.evidence_coverage === null ? null : Number(row.evidence_coverage),
    recommendedAction: row.recommended_action,
    reportJson: row.report_json,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    teamName: row.team_name,
    leadAgentRunId: row.lead_agent_run_id,
    screeningAgentRunId: row.screening_agent_run_id,
    sourceUrls: row.source_urls ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listEmployeeCustomers(
  context: TenantContext,
  query: ListQuery,
) {
  const scope = scopedOwnerClause(context, "c", 2);
  const statusValue = query.status ? [query.status] : [];
  const teamValue = query.team_name && context.cbeRole === "admin" ? [query.team_name] : [];
  const ownerValue = query.owner_user_id && context.cbeRole === "admin" ? [query.owner_user_id] : [];
  const statusClause = query.status ? `and c.screening_status = $${2 + scope.values.length}` : "";
  const teamClause = query.team_name && context.cbeRole === "admin"
    ? `and c.team_name = $${2 + scope.values.length + statusValue.length}`
    : "";
  const ownerClause = query.owner_user_id && context.cbeRole === "admin"
    ? `and c.owner_user_id = $${2 + scope.values.length + statusValue.length + teamValue.length}`
    : "";
  const limitIndex = 2 + scope.values.length + statusValue.length + teamValue.length + ownerValue.length;
  const offsetIndex = limitIndex + 1;

  const result = await queryCbe<CustomerRow>(
    `
      select
        c.record_type,
        c.record_id,
        c.company_name,
        c.country,
        c.buyer_type,
        c.domain,
        c.matched_products_json,
        c.target_fields_json,
        c.lead_status,
        c.screening_status,
        c.latest_screening_report_id,
        c.normalized_score::text as normalized_score,
        c.evidence_coverage::text as evidence_coverage,
        sr.recommended_action,
        sr.report_json,
        c.owner_user_id,
        owner_prof.display_name as owner_name,
        c.team_name,
        c.lead_agent_run_id,
        c.screening_agent_run_id,
        c.source_urls,
        c.created_at,
        c.updated_at
      from (
        select distinct on (base.record_type, base.record_id)
          base.*
        from (
          select
            c.tenant_id,
            c.record_type,
            c.record_id,
            c.company_name,
            c.country,
            c.buyer_type,
            c.domain,
            c.owner_user_id,
            c.created_by_user_id,
            c.department_id,
            c.team_name,
            c.visibility_scope,
            coalesce(lc.matched_products_json, st.product_interest_json, '[]'::jsonb) as matched_products_json,
            st.supplied_fields_json as target_fields_json,
            c.lead_status,
            c.screening_status,
            c.latest_screening_report_id,
            c.normalized_score,
            c.evidence_coverage,
            lead_run_for_customer.agent_run_id as lead_agent_run_id,
            sr.agent_run_id as screening_agent_run_id,
            coalesce(ls.source_urls, array[]::text[]) as source_urls,
            c.created_at,
            c.updated_at
          from cbe_customer_work_items c
          left join lead_candidates lc
            on c.record_type = 'lead_candidate'
           and lc.tenant_id = c.tenant_id
           and lc.id = c.record_id
          left join screening_reports sr
            on sr.tenant_id = c.tenant_id
           and sr.id = c.latest_screening_report_id
          left join lead_runs lead_run_for_customer
            on c.record_type = 'lead_candidate'
           and lead_run_for_customer.tenant_id = c.tenant_id
           and lead_run_for_customer.id = lc.lead_run_id
          left join screening_targets st
            on st.tenant_id = c.tenant_id
           and (
              (c.record_type = 'screening_target' and st.id = c.record_id)
              or (c.record_type = 'lead_candidate' and st.id = sr.screening_target_id)
            )
          left join lateral (
            select array_agg(source_url order by fetched_at desc nulls last, id) filter (where source_url is not null) as source_urls
            from lead_sources
            where tenant_id = c.tenant_id
              and lead_candidate_id = c.record_id
          ) ls on c.record_type = 'lead_candidate'
          where not (
            c.record_type = 'screening_target'
            and coalesce((
              st.source = 'accio_memory'
              or sr.report_json->'target'->>'source' = 'accio_memory'
              or sr.report_json->>'target_source' = 'accio_memory'
            ), false)
          )
          union all
          select
            asum.tenant_id,
            'accio_summary'::text as record_type,
            asum.id as record_id,
            coalesce(ac.company_name, asum.customer_profile_json->>'company_name', 'Unknown Accio buyer') as company_name,
            coalesce(ac.country, asum.customer_profile_json->>'country') as country,
            null::text as buyer_type,
            nullif(
              regexp_replace(
                coalesce(ac.website, asum.customer_profile_json->>'website', ''),
                '^https?://(www\\.)?([^/]+).*$',
                '\\2'
              ),
              ''
            ) as domain,
            asum.owner_user_id,
            asum.created_by_user_id,
            asum.department_id,
            asum.team_name,
            asum.visibility_scope,
            coalesce(asum.purchase_intent_json, '[]'::jsonb) as matched_products_json,
            jsonb_build_object(
              'website', coalesce(ac.website, asum.customer_profile_json->>'website'),
              'email', coalesce(ac.email, asum.customer_profile_json->>'email'),
              'contact_person', coalesce(ac.contact_person, asum.customer_profile_json->>'contact_person'),
              'source_file', ai.source_file_name
            ) as target_fields_json,
            'accio_handoff'::text as lead_status,
            coalesce(accio_sr.risk_tier, 'not_started')::text as screening_status,
            accio_sr.id as latest_screening_report_id,
            accio_sr.normalized_score,
            accio_sr.evidence_coverage,
            asum.agent_run_id as lead_agent_run_id,
            accio_sr.agent_run_id as screening_agent_run_id,
            array_remove(array[ai.source_file_name], null)::text[] as source_urls,
            asum.created_at,
            coalesce(accio_sr.created_at, asum.created_at) as updated_at
          from accio_summaries asum
          join accio_conversations ac
            on ac.tenant_id = asum.tenant_id
           and ac.id = asum.accio_conversation_id
          join accio_imports ai
            on ai.tenant_id = ac.tenant_id
           and ai.id = ac.accio_import_id
          left join lateral (
            select
              sr2.id,
              sr2.agent_run_id,
              sr2.risk_tier,
              sr2.normalized_score,
              sr2.evidence_coverage,
              sr2.created_at
            from screening_reports sr2
            where sr2.tenant_id = asum.tenant_id
              and (
                sr2.report_json->'target'->>'lead_id' = asum.id
                or sr2.report_json->'target'->>'target_id' = asum.id
                or sr2.report_json->>'lead_id' = asum.id
              )
            order by sr2.created_at desc, sr2.id desc
            limit 1
          ) accio_sr on true
          where coalesce(asum.behavior_signals_json->'supplement_target'->>'source', '') <> 'manual_screening'
        ) base
        order by base.record_type, base.record_id, base.updated_at desc, base.latest_screening_report_id desc nulls last
      ) c
      left join screening_reports sr
        on sr.tenant_id = c.tenant_id
       and sr.id = c.latest_screening_report_id
      left join cbe_user_profiles owner_prof
        on owner_prof.tenant_id = c.tenant_id
       and owner_prof.user_id = c.owner_user_id
      where c.tenant_id = $1
      ${scope.sql}
      ${statusClause}
      ${teamClause}
      ${ownerClause}
      order by c.updated_at desc, c.record_id desc
      limit $${limitIndex}
      offset $${offsetIndex}
    `,
    [
      context.tenantId,
      ...scope.values,
      ...statusValue,
      ...teamValue,
      ...ownerValue,
      query.limit,
      query.offset,
    ],
  );

  return {
    items: result.rows.map(toCustomerRecord),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function deleteEmployeeCustomers(context: TenantContext, ids: string[]) {
  const requestedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (requestedIds.length === 0) {
    throw new CbeStoreError(400, "customer_delete_empty", "No customer records were selected for deletion.");
  }

  return withCbeTransaction(async (client) => {
    const leadScope = scopedOwnerClause(context, "lc", 3);
    const leadRows = await client.query<{ id: string }>(
      `
        select lc.id
        from lead_candidates lc
        where lc.tenant_id = $1
          and lc.id = any($2::text[])
          ${leadScope.sql}
      `,
      [context.tenantId, requestedIds, ...leadScope.values],
    );
    const leadCandidateIds = leadRows.rows.map((row) => row.id);

    const targetScope = scopedOwnerClause(context, "st", 3);
    const targetRows = await client.query<{ id: string }>(
      `
        select st.id
        from screening_targets st
        where st.tenant_id = $1
          and st.id = any($2::text[])
          ${targetScope.sql}
      `,
      [context.tenantId, requestedIds, ...targetScope.values],
    );
    const screeningTargetIds = new Set(targetRows.rows.map((row) => row.id));

    if (leadCandidateIds.length > 0) {
      const leadTargets = await client.query<{ id: string }>(
        `
          select id
          from screening_targets
          where tenant_id = $1
            and lead_candidate_id = any($2::text[])
        `,
        [context.tenantId, leadCandidateIds],
      );
      for (const row of leadTargets.rows) screeningTargetIds.add(row.id);
    }

    const summaryScope = scopedOwnerClause(context, "asum", 3);
    const summaryRows = await client.query<{
      id: string;
      accio_conversation_id: string;
      accio_import_id: string;
    }>(
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
    const accioSummaryIds = summaryRows.rows.map((row) => row.id);

    if (accioSummaryIds.length > 0) {
      const accioTargets = await client.query<{ id: string }>(
        `
          select distinct sr.screening_target_id as id
          from screening_reports sr
          where sr.tenant_id = $1
            and (
              sr.report_json->'target'->>'lead_id' = any($2::text[])
              or sr.report_json->'target'->>'target_id' = any($2::text[])
              or sr.report_json->>'lead_id' = any($2::text[])
            )
        `,
        [context.tenantId, accioSummaryIds],
      );
      for (const row of accioTargets.rows) screeningTargetIds.add(row.id);
    }

    if (leadCandidateIds.length === 0 && screeningTargetIds.size === 0 && accioSummaryIds.length === 0) {
      throw new CbeStoreError(404, "customer_record_missing", "Selected customer records were not found.");
    }

    const screeningTargetIdList = Array.from(screeningTargetIds);
    let screeningReportIds: string[] = [];
    if (screeningTargetIdList.length > 0) {
      const reportRows = await client.query<{ id: string }>(
        `
          select id
          from screening_reports
          where tenant_id = $1
            and screening_target_id = any($2::text[])
        `,
        [context.tenantId, screeningTargetIdList],
      );
      screeningReportIds = reportRows.rows.map((row) => row.id);
    }
    if (screeningReportIds.length > 0) {
      await client.query(
        `delete from screening_address_locations where tenant_id = $1 and screening_report_id = any($2::text[])`,
        [context.tenantId, screeningReportIds],
      );
      await client.query(
        `delete from screening_score_blocks where tenant_id = $1 and screening_report_id = any($2::text[])`,
        [context.tenantId, screeningReportIds],
      );
      await client.query(
        `delete from screening_evidence where tenant_id = $1 and screening_report_id = any($2::text[])`,
        [context.tenantId, screeningReportIds],
      );
      await client.query(
        `delete from screening_reports where tenant_id = $1 and id = any($2::text[])`,
        [context.tenantId, screeningReportIds],
      );
    }
    if (screeningTargetIdList.length > 0) {
      await client.query(
        `delete from screening_targets where tenant_id = $1 and id = any($2::text[])`,
        [context.tenantId, screeningTargetIdList],
      );
    }

    const conversationIds = new Set(summaryRows.rows.map((row) => row.accio_conversation_id));
    const candidateImportIds = new Set(summaryRows.rows.map((row) => row.accio_import_id));
    if (accioSummaryIds.length > 0) {
      await client.query(
        `
          delete from memory_facts
          where tenant_id = $1
            and source_record_type = 'accio_summary'
            and source_record_id = any($2::text[])
        `,
        [context.tenantId, accioSummaryIds],
      );
      await client.query(
        `
          delete from handoff_events
          where tenant_id = $1
            and source_record_type = 'accio_summary'
            and source_record_id = any($2::text[])
        `,
        [context.tenantId, accioSummaryIds],
      );
      await client.query(
        `delete from accio_summaries where tenant_id = $1 and id = any($2::text[])`,
        [context.tenantId, accioSummaryIds],
      );
    }
    const conversationIdList = Array.from(conversationIds);
    if (conversationIdList.length > 0) {
      await client.query(
        `delete from accio_messages where tenant_id = $1 and accio_conversation_id = any($2::text[])`,
        [context.tenantId, conversationIdList],
      );
      await client.query(
        `delete from accio_conversations where tenant_id = $1 and id = any($2::text[])`,
        [context.tenantId, conversationIdList],
      );
    }
    const candidateImportIdList = Array.from(candidateImportIds);
    let deletedImportIds: string[] = [];
    if (candidateImportIdList.length > 0) {
      const deletedImports = await client.query<{ id: string }>(
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
        [context.tenantId, candidateImportIdList],
      );
      deletedImportIds = deletedImports.rows.map((row) => row.id);
    }

    if (leadCandidateIds.length > 0) {
      await client.query(
        `delete from lead_sources where tenant_id = $1 and lead_candidate_id = any($2::text[])`,
        [context.tenantId, leadCandidateIds],
      );
      await client.query(
        `delete from lead_candidates where tenant_id = $1 and id = any($2::text[])`,
        [context.tenantId, leadCandidateIds],
      );
    }

    await createAuditEvent(client, context, {
      eventType: "customer_records_deleted",
      dataTier: "T2",
      metadataJson: {
        requested_ids: requestedIds,
        deleted_lead_candidate_ids: leadCandidateIds,
        deleted_screening_target_ids: screeningTargetIdList,
        deleted_accio_summary_ids: accioSummaryIds,
        deleted_accio_import_ids: deletedImportIds,
      },
    });

    return {
      deletedCustomerIds: requestedIds,
      deletedLeadCandidateIds: leadCandidateIds,
      deletedScreeningTargetIds: screeningTargetIdList,
      deletedAccioSummaryIds: accioSummaryIds,
      deletedAccioImportIds: deletedImportIds,
    };
  });
}
