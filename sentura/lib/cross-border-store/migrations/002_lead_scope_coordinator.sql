create table if not exists lead_discovery_scopes (
  id text primary key,
  tenant_id text not null references tenants(id),
  scope_hash text not null,
  canonical_scope_json jsonb not null,
  status text not null check (status in ('idle', 'running', 'completed', 'failed', 'expired')),
  active_agent_run_id text references agent_runs(id),
  requested_total integer not null default 0 check (requested_total >= 0),
  produced_unique_count integer not null default 0 check (produced_unique_count >= 0),
  locked_until timestamptz,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, scope_hash)
);

create table if not exists lead_run_memberships (
  id text primary key,
  tenant_id text not null references tenants(id),
  scope_id text not null references lead_discovery_scopes(id),
  lead_run_id text not null references lead_runs(id),
  user_id text references sentura_users(id),
  mode text not null check (mode in ('started_new', 'joined_existing', 'reuse_completed_pool', 'top_up')),
  requested_count integer not null check (requested_count > 0),
  joined_at timestamptz not null default now()
);

create table if not exists lead_identities (
  id text primary key,
  tenant_id text not null references tenants(id),
  identity_key text not null,
  normalized_domain text,
  normalized_company_name text,
  country text,
  confidence numeric(5, 4),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(tenant_id, identity_key)
);

create table if not exists lead_run_results (
  id text primary key,
  tenant_id text not null references tenants(id),
  lead_run_id text not null references lead_runs(id),
  lead_identity_id text not null references lead_identities(id),
  rank integer not null check (rank > 0),
  duplicate_status text not null,
  duplicate_reason text,
  source_snapshot_json jsonb not null,
  created_at timestamptz not null default now(),
  unique(tenant_id, lead_run_id, lead_identity_id)
);

create table if not exists lead_allocations (
  id text primary key,
  tenant_id text not null references tenants(id),
  lead_identity_id text not null references lead_identities(id),
  allocated_to_user_id text references sentura_users(id),
  source_lead_run_id text references lead_runs(id),
  allocation_status text not null check (allocation_status in ('active', 'released', 'expired', 'converted')),
  expires_at timestamptz,
  allocated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lead_candidates_lead_identity_fk'
  ) then
    alter table lead_candidates
      add constraint lead_candidates_lead_identity_fk
      foreign key (lead_identity_id) references lead_identities(id);
  end if;
end;
$$;

drop trigger if exists lead_discovery_scopes_touch_updated_at on lead_discovery_scopes;
create trigger lead_discovery_scopes_touch_updated_at
before update on lead_discovery_scopes
for each row execute function cbe_touch_updated_at();

create index if not exists lead_scopes_active_idx
  on lead_discovery_scopes(tenant_id, status, locked_until);

create index if not exists lead_run_memberships_scope_idx
  on lead_run_memberships(tenant_id, scope_id, joined_at desc);

create index if not exists lead_identities_domain_idx
  on lead_identities(tenant_id, normalized_domain)
  where normalized_domain is not null;

create index if not exists lead_allocations_user_idx
  on lead_allocations(tenant_id, allocated_to_user_id, allocation_status, allocated_at desc);
