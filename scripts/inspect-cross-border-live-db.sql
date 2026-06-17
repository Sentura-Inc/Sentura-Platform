-- Cross-border e-commerce live DB inspection queries.
-- Run with:
-- psql "postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev" -f scripts/inspect-cross-border-live-db.sql
--
-- These queries intentionally use the physical Phase 2 schema:
-- - lead_candidates has normalized_domain, not website.
-- - lead_sources has excerpt, not finding.
-- - screening_targets stores website in supplied_fields_json->>'website'.
-- - screening_reports joins screening_targets for company metadata.
-- - lead_candidates joins lead_runs to reach agent_runs.

\echo ''
\echo '== Recent employee runs =='
select
  id,
  agent_id,
  task_kind,
  status,
  target_summary,
  session_key,
  error_code,
  error_message,
  started_at,
  finished_at
from agent_runs
order by started_at desc
limit 20;

\echo ''
\echo '== Recent Lead runs =='
select
  lr.id as lead_run_id,
  lr.agent_run_id,
  ar.status as agent_run_status,
  lr.status as lead_run_status,
  lr.target_count,
  lr.completed_at,
  ar.error_code,
  ar.error_message
from lead_runs lr
left join agent_runs ar
  on ar.tenant_id = lr.tenant_id
 and ar.id = lr.agent_run_id
order by lr.created_at desc
limit 10;

\echo ''
\echo '== Recent Lead candidates =='
select
  lc.id,
  lc.company_name,
  lc.country,
  lc.buyer_type,
  coalesce(
    lrr.source_snapshot_json->>'website',
    case when lc.normalized_domain is not null then 'https://' || lc.normalized_domain end
  ) as website,
  lc.normalized_domain,
  lc.matched_products_json,
  coalesce(lrr.duplicate_status, lc.status) as duplicate_status,
  lc.confidence,
  lc.created_at
from lead_candidates lc
left join lead_run_results lrr
  on lrr.tenant_id = lc.tenant_id
 and lrr.lead_run_id = lc.lead_run_id
 and lrr.lead_identity_id = lc.lead_identity_id
order by lc.created_at desc
limit 20;

\echo ''
\echo '== Recent Lead source evidence =='
select
  lc.company_name,
  ls.source_type,
  ls.source_url,
  ls.excerpt as source_excerpt,
  ls.fetched_at
from lead_sources ls
join lead_candidates lc
  on lc.tenant_id = ls.tenant_id
 and lc.id = ls.lead_candidate_id
order by ls.fetched_at desc nulls last, ls.id desc
limit 20;

\echo ''
\echo '== Recent Screening targets =='
select
  id,
  source,
  company_name,
  country,
  supplied_fields_json->>'website' as website,
  domain,
  email,
  created_at
from screening_targets
order by created_at desc
limit 20;

\echo ''
\echo '== Recent Screening reports =='
select
  sr.id as report_id,
  sr.agent_run_id,
  ar.status as agent_run_status,
  st.company_name,
  sr.risk_tier,
  sr.normalized_score,
  sr.evidence_coverage,
  sr.recommended_action,
  sr.created_at,
  ar.error_code,
  ar.error_message
from screening_reports sr
join screening_targets st
  on st.tenant_id = sr.tenant_id
 and st.id = sr.screening_target_id
left join agent_runs ar
  on ar.tenant_id = sr.tenant_id
 and ar.id = sr.agent_run_id
order by sr.created_at desc
limit 20;

\echo ''
\echo '== Recent Screening evidence =='
select
  st.company_name,
  se.layer,
  se.source_type,
  se.source_url,
  se.finding,
  se.fetched_at,
  se.score_block,
  se.score_impact
from screening_evidence se
join screening_reports sr
  on sr.tenant_id = se.tenant_id
 and sr.id = se.screening_report_id
join screening_targets st
  on st.tenant_id = sr.tenant_id
 and st.id = sr.screening_target_id
order by se.fetched_at desc nulls last, se.id desc
limit 30;

\echo ''
\echo '== Recent Screening score blocks =='
select
  st.company_name,
  ssb.block,
  ssb.status,
  ssb.max_points,
  ssb.earned_points,
  ssb.reason
from screening_score_blocks ssb
join screening_reports sr
  on sr.tenant_id = ssb.tenant_id
 and sr.id = ssb.screening_report_id
join screening_targets st
  on st.tenant_id = sr.tenant_id
 and st.id = sr.screening_target_id
order by sr.created_at desc, ssb.id desc
limit 30;

\echo ''
\echo '== Recent task activity events =='
select
  agent_id,
  task_kind,
  event_type,
  status,
  stage,
  target_summary,
  created_at,
  metadata_json
from agent_run_activity_events
order by created_at desc
limit 30;

\echo ''
\echo '== Recent run write summary =='
select
  ar.started_at,
  ar.agent_id,
  ar.task_kind,
  ar.status,
  ar.target_summary,
  count(distinct lc.id) as lead_count,
  count(distinct sr.id) as screening_report_count,
  ar.error_code,
  ar.error_message
from agent_runs ar
left join lead_runs lr
  on lr.tenant_id = ar.tenant_id
 and lr.agent_run_id = ar.id
left join lead_candidates lc
  on lc.tenant_id = lr.tenant_id
 and lc.lead_run_id = lr.id
left join screening_reports sr
  on sr.tenant_id = ar.tenant_id
 and sr.agent_run_id = ar.id
group by ar.id
order by ar.started_at desc
limit 20;
