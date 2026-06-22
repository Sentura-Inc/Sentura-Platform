alter table cbe_user_profiles
  add column if not exists email text;

create table if not exists cbe_cost_limits (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null references sentura_users(id),
  period text not null check (period in ('day', 'week', 'month', 'all_time')),
  limit_usd numeric(12, 6) not null check (limit_usd >= 0),
  enabled boolean not null default true,
  warning_ratio numeric(6, 4) not null default 0.8 check (warning_ratio >= 0 and warning_ratio <= 1),
  created_by_user_id text references sentura_users(id),
  updated_by_user_id text references sentura_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, user_id, period)
);

create table if not exists cbe_cost_allowances (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null references sentura_users(id),
  period text not null check (period in ('day', 'week', 'month', 'all_time')),
  amount_usd numeric(12, 6) not null check (amount_usd >= 0),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  reason text,
  approval_request_id text,
  approved_by_user_id text references sentura_users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists cbe_cost_approval_requests (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null references sentura_users(id),
  agent_id text not null,
  task_kind text not null,
  target_summary text,
  estimated_cost_usd numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  period text not null check (period in ('day', 'week', 'month', 'all_time')),
  current_spend_usd numeric(12, 6) not null default 0 check (current_spend_usd >= 0),
  base_limit_usd numeric(12, 6) not null default 0 check (base_limit_usd >= 0),
  active_allowance_usd numeric(12, 6) not null default 0 check (active_allowance_usd >= 0),
  requested_allowance_usd numeric(12, 6) not null default 0 check (requested_allowance_usd >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by_user_id text references sentura_users(id),
  decided_by_user_id text references sentura_users(id),
  decision_note text,
  decided_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists cbe_cost_limits_touch_updated_at on cbe_cost_limits;
create trigger cbe_cost_limits_touch_updated_at
before update on cbe_cost_limits
for each row execute function cbe_touch_updated_at();

create index if not exists cbe_cost_limits_user_idx
  on cbe_cost_limits(tenant_id, user_id, period, enabled);

create index if not exists cbe_cost_allowances_user_idx
  on cbe_cost_allowances(tenant_id, user_id, period, status, expires_at);

create index if not exists cbe_cost_approval_requests_pending_idx
  on cbe_cost_approval_requests(tenant_id, status, created_at desc);

create index if not exists cbe_cost_approval_requests_user_idx
  on cbe_cost_approval_requests(tenant_id, user_id, status, created_at desc);

insert into cbe_cost_limits (
  id,
  tenant_id,
  user_id,
  period,
  limit_usd,
  enabled,
  warning_ratio
)
select
  'cost_limit_' || p.tenant_id || '_' || p.user_id || '_month',
  p.tenant_id,
  p.user_id,
  'month',
  120.000000,
  true,
  0.8
from cbe_user_profiles p
where p.cbe_role = 'operator'
on conflict (tenant_id, user_id, period) do nothing;
