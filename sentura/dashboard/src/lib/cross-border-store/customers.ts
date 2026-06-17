import { queryCbe } from "./db";
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
  source_urls: string[] | null;
  created_at: Date;
  updated_at: Date;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
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
  const statusClause = query.status ? `and c.screening_status = $${2 + scope.values.length}` : "";
  const teamClause = query.team_name && context.cbeRole === "admin"
    ? `and c.team_name = $${2 + scope.values.length + statusValue.length}`
    : "";
  const limitIndex = 2 + scope.values.length + statusValue.length + teamValue.length;
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
        coalesce(lc.matched_products_json, st.product_interest_json, '[]'::jsonb) as matched_products_json,
        st.supplied_fields_json as target_fields_json,
        c.lead_status,
        c.screening_status,
        c.latest_screening_report_id,
        c.normalized_score::text as normalized_score,
        c.evidence_coverage::text as evidence_coverage,
        sr.recommended_action,
        sr.report_json,
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
      where c.tenant_id = $1
      ${scope.sql}
      ${statusClause}
      ${teamClause}
      order by c.updated_at desc, c.record_id desc
      limit $${limitIndex}
      offset $${offsetIndex}
    `,
    [
      context.tenantId,
      ...scope.values,
      ...statusValue,
      ...teamValue,
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
