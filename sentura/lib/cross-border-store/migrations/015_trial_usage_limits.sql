create table if not exists cbe_trial_usage_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  agent_run_id text references agent_runs(id),
  usage_kind text not null check (usage_kind in ('lead_success', 'screening_success')),
  source_record_type text not null,
  source_record_id text not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tenant_id, usage_kind, source_record_type, source_record_id)
);

create index if not exists cbe_trial_usage_events_kind_idx
  on cbe_trial_usage_events(tenant_id, usage_kind, created_at desc);

insert into cbe_trial_usage_events (
  id,
  tenant_id,
  user_id,
  agent_run_id,
  usage_kind,
  source_record_type,
  source_record_id,
  quantity,
  metadata_json,
  created_at
)
select
  'trial_lead_' || lrr.id,
  lrr.tenant_id,
  lr.owner_user_id,
  lr.agent_run_id,
  'lead_success',
  'lead_run_result',
  lrr.id,
  1,
  jsonb_build_object('backfilled_from', 'lead_run_results'),
  lrr.created_at
from lead_run_results lrr
join lead_runs lr
  on lr.tenant_id = lrr.tenant_id
 and lr.id = lrr.lead_run_id
where lrr.duplicate_status = 'new'
on conflict (tenant_id, usage_kind, source_record_type, source_record_id)
do nothing;

insert into cbe_trial_usage_events (
  id,
  tenant_id,
  user_id,
  agent_run_id,
  usage_kind,
  source_record_type,
  source_record_id,
  quantity,
  metadata_json,
  created_at
)
select
  'trial_screening_' || sr.id,
  sr.tenant_id,
  sr.owner_user_id,
  sr.agent_run_id,
  'screening_success',
  'screening_report',
  sr.id,
  1,
  jsonb_build_object('backfilled_from', 'screening_reports'),
  sr.created_at
from screening_reports sr
on conflict (tenant_id, usage_kind, source_record_type, source_record_id)
do nothing;
