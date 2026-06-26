create table if not exists cbe_schema_migrations (
  id text primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now()
);

create table if not exists tenants (
  id text primary key,
  slug text unique not null,
  display_name text not null,
  data_region text not null,
  created_at timestamptz not null default now()
);

create table if not exists sentura_users (
  id text primary key,
  tenant_id text not null references tenants(id),
  display_name text not null,
  role text not null,
  department_id text,
  user_token_hash text,
  created_at timestamptz not null default now()
);

create table if not exists cbe_user_profiles (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null references sentura_users(id),
  cbe_role text not null check (cbe_role in ('admin', 'operator')),
  display_name text not null,
  team_name text,
  status text not null check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, user_id)
);

create table if not exists agent_runs (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  agent_id text not null,
  session_key text,
  status text not null check (status in ('queued', 'running', 'polling', 'completed', 'failed', 'cancelled')),
  task_kind text not null,
  target_record_type text,
  target_record_id text,
  target_summary text,
  current_stage text,
  last_activity_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  model_ref text,
  cost_usd_estimate numeric(12, 6),
  error_code text,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists lead_runs (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  agent_run_id text references agent_runs(id),
  query_config_json jsonb not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  target_count integer not null check (target_count > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists lead_candidates (
  id text primary key,
  tenant_id text not null references tenants(id),
  lead_run_id text references lead_runs(id),
  lead_identity_id text,
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  normalized_domain text,
  company_name text not null,
  country text,
  buyer_type text,
  matched_products_json jsonb not null default '[]'::jsonb,
  confidence numeric(5, 4),
  dedupe_key text,
  status text not null check (status in ('new', 'claimed', 'screening_ready', 'screened', 'archived', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists lead_sources (
  id text primary key,
  tenant_id text not null references tenants(id),
  lead_candidate_id text not null references lead_candidates(id),
  source_type text not null,
  source_url text,
  query text,
  excerpt text,
  fetched_at timestamptz,
  confidence numeric(5, 4)
);

create table if not exists screening_targets (
  id text primary key,
  tenant_id text not null references tenants(id),
  source text not null,
  lead_candidate_id text references lead_candidates(id),
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  company_name text not null,
  country text,
  domain text,
  email text,
  contact_person text,
  product_interest_json jsonb not null default '[]'::jsonb,
  supplied_fields_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists screening_reports (
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_target_id text not null references screening_targets(id),
  agent_run_id text references agent_runs(id),
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  risk_tier text not null,
  normalized_score numeric(6, 2),
  evidence_coverage numeric(6, 2),
  recommended_action text,
  created_at timestamptz not null default now(),
  report_json jsonb not null default '{}'::jsonb
);

create table if not exists screening_evidence (
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_report_id text not null references screening_reports(id),
  layer text not null,
  source_type text not null,
  source text,
  source_url text,
  finding text not null,
  confidence numeric(5, 4),
  cost_usd numeric(12, 6),
  score_block text,
  score_impact text,
  fetched_at timestamptz
);

create table if not exists screening_score_blocks (
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_report_id text not null references screening_reports(id),
  block text not null,
  status text not null,
  max_points numeric(6, 2),
  earned_points numeric(6, 2),
  reason text
);

create table if not exists accio_imports (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  agent_run_id text references agent_runs(id),
  source_file_name text,
  file_hash text not null,
  storage_key text,
  validation_status text not null,
  classification text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists accio_conversations (
  id text primary key,
  tenant_id text not null references tenants(id),
  accio_import_id text not null references accio_imports(id),
  external_conversation_id text,
  company_name text,
  country text,
  contact_person text,
  email text,
  website text
);

create table if not exists accio_messages (
  id text primary key,
  tenant_id text not null references tenants(id),
  accio_conversation_id text not null references accio_conversations(id),
  message_ts timestamptz,
  sender_role text,
  text_hash text not null,
  text_redacted text,
  attachment_json jsonb not null default '[]'::jsonb
);

create table if not exists accio_summaries (
  id text primary key,
  tenant_id text not null references tenants(id),
  accio_conversation_id text not null references accio_conversations(id),
  agent_run_id text references agent_runs(id),
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  customer_profile_json jsonb not null,
  purchase_intent_json jsonb not null,
  negotiated_price_json jsonb not null,
  next_actions_json jsonb not null,
  behavior_signals_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists handoff_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  from_agent_id text not null,
  to_agent_id text not null,
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  assigned_to_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  source_record_type text not null,
  source_record_id text not null,
  payload_json jsonb not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists memory_facts (
  id text primary key,
  tenant_id text not null references tenants(id),
  agent_id text not null,
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  reviewed_by_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'team', 'tenant_shared')),
  source_record_type text not null,
  source_record_id text not null,
  fact_json jsonb not null,
  vector_memory_ref text,
  status text not null check (status in ('pending_review', 'approved', 'rejected', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists api_call_ledger (
  id text primary key,
  tenant_id text not null references tenants(id),
  agent_run_id text references agent_runs(id),
  provider text not null,
  endpoint text,
  source_type text,
  request_units numeric(12, 4),
  cost_usd numeric(12, 6),
  status text not null,
  created_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists audit_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  agent_id text,
  event_type text not null,
  data_tier text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists agent_run_activity_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  agent_run_id text not null references agent_runs(id),
  operator_user_id text references sentura_users(id),
  agent_id text not null,
  task_kind text not null,
  target_record_type text,
  target_record_id text,
  target_summary text,
  stage text,
  event_type text not null,
  tool_name text,
  source_url text,
  status text not null,
  created_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb
);

create or replace function cbe_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cbe_user_profiles_touch_updated_at on cbe_user_profiles;
create trigger cbe_user_profiles_touch_updated_at
before update on cbe_user_profiles
for each row execute function cbe_touch_updated_at();

create unique index if not exists lead_candidates_tenant_domain_uidx
  on lead_candidates(tenant_id, normalized_domain)
  where normalized_domain is not null;

create index if not exists screening_targets_identity_idx
  on screening_targets(tenant_id, domain, email);

create index if not exists screening_reports_latest_idx
  on screening_reports(tenant_id, screening_target_id, created_at desc);

create index if not exists accio_conversations_lookup_idx
  on accio_conversations(tenant_id, company_name, email);

create index if not exists api_call_ledger_rollup_idx
  on api_call_ledger(tenant_id, created_at, provider);

create index if not exists audit_events_rollup_idx
  on audit_events(tenant_id, created_at, event_type, data_tier);

create index if not exists agent_runs_status_idx
  on agent_runs(tenant_id, agent_id, status, started_at desc);

create index if not exists cbe_user_profiles_role_idx
  on cbe_user_profiles(tenant_id, cbe_role, status);

create index if not exists lead_candidates_owner_scope_idx
  on lead_candidates(tenant_id, owner_user_id, team_name, visibility_scope);

create index if not exists screening_targets_owner_scope_idx
  on screening_targets(tenant_id, owner_user_id, team_name, visibility_scope);

create index if not exists accio_imports_owner_scope_idx
  on accio_imports(tenant_id, owner_user_id, team_name, visibility_scope);

create index if not exists agent_run_activity_monitor_idx
  on agent_run_activity_events(tenant_id, status, agent_id, created_at desc);

create or replace view cbe_customer_work_items as
with latest_reports as (
  select
    sr.*,
    row_number() over (
      partition by sr.tenant_id, sr.screening_target_id
      order by sr.created_at desc, sr.id desc
    ) as rn
  from screening_reports sr
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
  coalesce(lr.risk_tier, 'not_started') as screening_status,
  lr.id as latest_screening_report_id,
  lr.normalized_score,
  lr.evidence_coverage,
  lc.created_at,
  coalesce(lr.created_at, lc.created_at) as updated_at
from lead_candidates lc
left join screening_targets st
  on st.tenant_id = lc.tenant_id
  and st.lead_candidate_id = lc.id
left join latest_reports lr
  on lr.tenant_id = st.tenant_id
  and lr.screening_target_id = st.id
  and lr.rn = 1
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

create or replace view cbe_operator_workload_daily as
select
  ar.tenant_id,
  ar.user_id,
  ar.owner_user_id,
  ar.department_id,
  ar.started_at::date as work_date,
  ar.task_kind,
  count(*) as run_count,
  count(*) filter (where ar.status = 'completed') as completed_count,
  count(*) filter (where ar.status = 'failed') as failed_count,
  sum(coalesce(ar.cost_usd_estimate, 0)) as cost_usd_estimate
from agent_runs ar
group by
  ar.tenant_id,
  ar.user_id,
  ar.owner_user_id,
  ar.department_id,
  ar.started_at::date,
  ar.task_kind;

create or replace view cbe_agent_usage_daily as
select
  ar.tenant_id,
  ar.agent_id,
  ar.started_at::date as usage_date,
  ar.task_kind,
  ar.status,
  count(*) as run_count,
  avg(extract(epoch from (coalesce(ar.finished_at, ar.last_activity_at, ar.started_at) - ar.started_at))) as avg_duration_seconds,
  sum(coalesce(ar.cost_usd_estimate, 0)) as cost_usd_estimate
from agent_runs ar
group by
  ar.tenant_id,
  ar.agent_id,
  ar.started_at::date,
  ar.task_kind,
  ar.status;
