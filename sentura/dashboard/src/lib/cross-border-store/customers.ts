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
  leadStatus: string;
  screeningStatus: string;
  latestScreeningReportId: string | null;
  normalizedScore: number | null;
  evidenceCoverage: number | null;
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
  lead_status: string;
  screening_status: string;
  latest_screening_report_id: string | null;
  normalized_score: string | null;
  evidence_coverage: string | null;
  created_at: Date;
  updated_at: Date;
}

function toCustomerRecord(row: CustomerRow): EmployeeCustomerRecord {
  return {
    recordType: row.record_type,
    recordId: row.record_id,
    companyName: row.company_name,
    country: row.country,
    buyerType: row.buyer_type,
    domain: row.domain,
    leadStatus: row.lead_status,
    screeningStatus: row.screening_status,
    latestScreeningReportId: row.latest_screening_report_id,
    normalizedScore: row.normalized_score === null ? null : Number(row.normalized_score),
    evidenceCoverage: row.evidence_coverage === null ? null : Number(row.evidence_coverage),
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
        c.lead_status,
        c.screening_status,
        c.latest_screening_report_id,
        c.normalized_score::text as normalized_score,
        c.evidence_coverage::text as evidence_coverage,
        c.created_at,
        c.updated_at
      from cbe_customer_work_items c
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
