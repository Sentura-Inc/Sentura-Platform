create or replace view cbe_customer_work_items as
with latest_reports as (
  select
    sr.*,
    row_number() over (
      partition by sr.tenant_id, sr.screening_target_id
      order by sr.created_at desc, sr.id desc
    ) as rn
  from screening_reports sr
),
lead_latest_reports as (
  select
    st.tenant_id,
    st.lead_candidate_id,
    lr.id,
    lr.risk_tier,
    lr.normalized_score,
    lr.evidence_coverage,
    lr.created_at,
    row_number() over (
      partition by st.tenant_id, st.lead_candidate_id
      order by lr.created_at desc nulls last, st.created_at desc, st.id desc
    ) as rn
  from screening_targets st
  left join latest_reports lr
    on lr.tenant_id = st.tenant_id
    and lr.screening_target_id = st.id
    and lr.rn = 1
  where st.lead_candidate_id is not null
)
select
  lc.tenant_id,
  'lead_candidate'::text as record_type,
  lc.id as record_id,
  lc.company_name,
  lc.country,
  lc.buyer_type,
  lc.normalized_domain as domain,
  lc.owner_user_id,
  lc.created_by_user_id,
  lc.department_id,
  lc.team_name,
  lc.visibility_scope,
  lc.status as lead_status,
  coalesce(llr.risk_tier, 'not_started') as screening_status,
  llr.id as latest_screening_report_id,
  llr.normalized_score,
  llr.evidence_coverage,
  lc.created_at,
  coalesce(llr.created_at, lc.created_at) as updated_at
from lead_candidates lc
left join lead_latest_reports llr
  on llr.tenant_id = lc.tenant_id
  and llr.lead_candidate_id = lc.id
  and llr.rn = 1
union all
select
  st.tenant_id,
  'screening_target'::text as record_type,
  st.id as record_id,
  st.company_name,
  st.country,
  null::text as buyer_type,
  st.domain,
  st.owner_user_id,
  st.created_by_user_id,
  st.department_id,
  st.team_name,
  st.visibility_scope,
  'manual'::text as lead_status,
  coalesce(lr.risk_tier, 'not_started') as screening_status,
  lr.id as latest_screening_report_id,
  lr.normalized_score,
  lr.evidence_coverage,
  st.created_at,
  coalesce(lr.created_at, st.created_at) as updated_at
from screening_targets st
left join latest_reports lr
  on lr.tenant_id = st.tenant_id
  and lr.screening_target_id = st.id
  and lr.rn = 1
where st.lead_candidate_id is null;
