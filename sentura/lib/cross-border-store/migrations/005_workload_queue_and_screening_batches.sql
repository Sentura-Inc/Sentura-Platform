alter table agent_runs
  add column if not exists parent_agent_run_id text references agent_runs(id),
  add column if not exists queue_priority integer not null default 0,
  add column if not exists queued_at timestamptz,
  add column if not exists lease_owner text,
  add column if not exists lease_until timestamptz;

create index if not exists agent_runs_queue_claim_idx
  on agent_runs(tenant_id, status, queue_priority desc, queued_at)
  where status = 'queued';

create index if not exists agent_runs_active_session_idx
  on agent_runs(tenant_id, agent_id, status, started_at)
  where status in ('running', 'polling') and session_key is not null;

create table if not exists screening_batches (
  id text primary key,
  tenant_id text not null references tenants(id),
  created_by_user_id text references sentura_users(id),
  parent_agent_run_id text references agent_runs(id),
  requested_target_count integer not null check (requested_target_count > 0),
  execution_mode text not null check (execution_mode in ('single_target_fanout', 'batch3_experiment')),
  paid_email_enabled boolean not null default false,
  paid_trade_enabled boolean not null default false,
  per_target_trade_budget_usd numeric(12, 6) not null default 0,
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists screening_batch_targets (
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_batch_id text not null references screening_batches(id),
  screening_target_id text not null references screening_targets(id),
  child_agent_run_id text references agent_runs(id),
  target_order integer not null check (target_order > 0),
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists screening_batches_parent_idx
  on screening_batches(tenant_id, parent_agent_run_id, created_at desc);

create index if not exists screening_batch_targets_batch_idx
  on screening_batch_targets(tenant_id, screening_batch_id, target_order);
