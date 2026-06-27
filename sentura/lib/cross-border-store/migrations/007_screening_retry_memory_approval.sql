alter table screening_batch_targets
  add column if not exists paid_email_call_status text not null default 'disabled',
  add column if not exists paid_email_call_count integer not null default 0,
  add column if not exists paid_email_reapproved_by_user_id text references sentura_users(id),
  add column if not exists paid_email_reapproved_at timestamptz,
  add column if not exists paid_trade_call_status text not null default 'disabled',
  add column if not exists paid_trade_call_count integer not null default 0,
  add column if not exists paid_trade_spend_usd numeric(12, 6) not null default 0,
  add column if not exists paid_trade_reapproved_by_user_id text references sentura_users(id),
  add column if not exists paid_trade_reapproved_at timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_retry_at timestamptz;

alter table screening_batch_targets
  drop constraint if exists screening_batch_targets_paid_email_status_chk,
  add constraint screening_batch_targets_paid_email_status_chk
    check (paid_email_call_status in ('disabled', 'available', 'used', 'reapproval_required', 'reapproved'));

alter table screening_batch_targets
  drop constraint if exists screening_batch_targets_paid_trade_status_chk,
  add constraint screening_batch_targets_paid_trade_status_chk
    check (paid_trade_call_status in ('disabled', 'available', 'used', 'reapproval_required', 'reapproved'));

create index if not exists screening_batch_targets_retry_idx
  on screening_batch_targets(tenant_id, status, last_retry_at)
  where status = 'failed';

create index if not exists screening_batch_targets_paid_state_idx
  on screening_batch_targets(tenant_id, paid_email_call_status, paid_trade_call_status);

alter table memory_facts
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create index if not exists memory_facts_review_idx
  on memory_facts(tenant_id, status, owner_user_id, created_at desc);

alter table handoff_events
  add column if not exists accepted_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists consumed_by_agent_run_id text references agent_runs(id);

create index if not exists handoff_events_screening_consumption_idx
  on handoff_events(tenant_id, to_agent_id, status, source_record_type, source_record_id);
