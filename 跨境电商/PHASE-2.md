> **On-demand reference — not read by default.**
>
> Back-link: [`DESIGN.md`](DESIGN.md)
>
> Status: Phase 2 implementation plan. This document is the execution bridge from the completed Phase-1 Employee UI and three-agent MVP to production persistence, multi-user concurrency, and durable agent optimization.
>
> Last updated: 2026-06-17

# Sentura x Cross-Border E-Commerce — Phase 2 Plan

Phase 2 turns the current cross-border e-commerce demo into a production-shaped pilot for 30-50 sales/operator users. It must keep the existing Sentura/OpenClaw architecture: OpenClaw remains the agent runtime, Sentura remains the control plane, and the three CBE employees remain normal OpenClaw agents. The main change is moving business state out of browser-local persistence into a tenant-scoped business database, then using that durable state to support multi-user sessions, duplicate-run prevention, retry, audit, and cost attribution.

## 1. Source Alignment

This plan is derived from the current project documents and should be read with them:

| Source | Current decision used in Phase 2 |
|---|---|
| [`DESIGN.md`](DESIGN.md) | One shared CBE business database, one OpenClaw Gateway, three persistent CBE agents, typed store boundary, 30-50 user concurrency targets, China primary hosting, and no custom runtime. |
| [`UI.md`](UI.md) | Employee UI uses business actions and hidden OpenClaw sessions, not direct free-form agent chat. Customer rows, memory rows, task notifications, reports, and hidden session keys must become auditable records. |
| [`MARKET_ACQUISITION.md`](MARKET_ACQUISITION.md) | Lead Discovery still needs production persistence, run-scope dedupe, shared result pools, top-up-only mode, allocation/claim behavior, and concurrency tests. |
| [`SCREENING.md`](SCREENING.md) | Screening still needs production persistence for targets/reports/evidence, typed store writes, Alibaba internal-data enhancement after access proof, more registry adapters, and budget approval UX. |
| [`MEMORY_PROCESSING.md`](MEMORY_PROCESSING.md) | Accio Memory still needs production persistence, upload storage, redaction, memory-fact preview/approval, and durable Screening handoff records. |
| [`docs/TESTS.md`](../docs/TESTS.md) | CE4-CE16 are green for Phase-1 workspaces, MCP tools, Employee UI, hidden tasks, progress/cost/notification UX, and compact Screening evidence. Phase 2 adds CE17 and later implementation tests. |
| [`docs/MEMORY.md`](../docs/MEMORY.md) | Latest ground truth: CBE sandbox is `non-main`; live E2E on the current Mac needs Docker/compatible sandbox runtime or an explicit unsafe sandbox-off override; recent UI fixes are complete. |

External implementation references checked for this plan:

- Next.js App Router Route Handlers: `https://nextjs.org/docs/app/getting-started/route-handlers`
- Next.js route file convention and supported HTTP methods: `https://nextjs.org/docs/app/api-reference/file-conventions/route`
- PostgreSQL `SELECT ... FOR UPDATE`, `NOWAIT`, and `SKIP LOCKED`: `https://www.postgresql.org/docs/current/sql-select.html`
- OpenClaw Gateway protocol: `https://docs.openclaw.ai/gateway/protocol`
- OpenClaw MCP docs: `https://docs.openclaw.ai/cli/mcp`
- OpenClaw sandbox MCP/plugin tool policy: `https://docs.openclaw.ai/gateway/config-tools`

## 2. Phase 2 Goals

Phase 2 must deliver:

1. A tenant-scoped CBE business database that stores structured business records for all three employees.
2. A typed CBE store boundary used by Dashboard server code after validating employee JSON markers.
3. Employee UI state sourced from the database instead of `localStorage`.
4. A Lead Discovery run coordinator that prevents duplicate same-scope AgentChat launches and supports shared result pools.
5. Durable task status, notifications, cost ledger, evidence, reports, handoffs, and retry paths.
6. Agent prompt/skill optimizations that rely on durable contracts instead of frontend-only state.
7. Automated tests for persistence, multi-user duplicate-run behavior, task recovery, and load-smoke readiness.
8. Customer-specific user levels for admins and ordinary business users, focused on monitoring, scoped work execution, and reporting rather than Sentura platform administration.

Phase 2 must not:

- Build a custom agent runtime, custom Gateway, custom Docker wrapper, or direct LLM provider path.
- Give the three employees raw SQL credentials or free-form SQL tools.
- Store API keys, model keys, or provider secrets in the database, workspace prose, docs, or conversation history.
- Store raw Accio chats in vector memory.
- Send outreach automatically.
- Treat missing paid evidence as fraud evidence.

## 2.1 Customer User Levels And Permission Boundary

For this customer, do not use the full Sentura platform role design as the product experience. The customer is not buying an employee-creation console. They already have three fixed AI employees behind the scenes, and the current Employee UI is the ordinary user-facing product surface. Phase 2 only needs two customer-facing user levels:

| User level | Chinese label | Main purpose | Visible surface |
|---|---|---|---|
| `operator` | 普通用户 / 业务员工 | Execute daily work: find leads, start Screening, import Accio records, review own task results. | Existing `个人中心`, `获客与背调`, `记忆整理`. |
| `admin` | 管理员 / 业务主管 | Monitor work and business output across users: who is running which task, which Agent is being called, what target is under investigation, aggregate lists, per-user lists, and statistics. | Existing Employee pages plus Admin monitoring pages. |

Sentura authentication can still protect the underlying dashboard session, but the CBE product must not expose platform concepts such as creating AI employees, changing agent tool policy, editing OpenClaw config, or managing global provider settings. Admin is a customer-side monitor/supervisor role, not a Sentura platform administrator.

### Ordinary User Permissions

Ordinary users can:

- Use the existing `个人中心`, `获客与背调`, and `记忆整理` pages.
- Start `寻找客户`, `批量背调`, `手动背调`, and `开始分析`.
- See their own task progress, task notifications, cost attribution, reports, and imported memory records.
- See shared customer records that the business chooses to make visible to all sales users or their team.
- Retry their own recoverable failed tasks.

Ordinary users cannot:

- See the Admin monitoring pages.
- See other users' private task inputs unless the result is tenant-shared.
- Create, delete, or configure AI employees.
- Change model/API/provider settings, tool policy, sandbox settings, budget caps, or source adapters.
- Export tenant-wide datasets.

### Admin Monitoring Permissions

Admins can view and monitor:

- Live and recent task activity: which human user triggered the task, which CBE Agent is running, target company/domain, task type, current stage, last tool/source used, started time, elapsed time, status, and failure reason.
- Aggregate `获客与背调` list across the whole tenant or a selected team.
- Per-user customer lists: leads found, screenings completed, high-score buyers, insufficient-evidence rows, failed tasks, and Accio records processed by each business user.
- Operational statistics:
  - leads found by day/week/month;
  - screenings completed and average score distribution;
  - high-score/medium/low/insufficient-evidence counts;
  - active/running/queued/failed task counts;
  - per-agent usage and average runtime;
  - API/model cost by user, Agent, provider, and day;
  - evidence-source coverage by registry/domain/email/trade/public-web source.
- Task transcripts or detailed evidence only through the same data-tier rules as the Employee UI; raw T3 Accio chat remains protected.

Admins cannot:

- Create new AI employees from this customer UI.
- Tune or rewrite employee prompts, tools, sandbox policies, model routing, Gateway config, MCP server config, or provider credentials.
- Impersonate a user by silently starting tasks as that user.
- Override the Lead coordinator by launching duplicate same-scope tasks outside the shared-result/top-up flow.
- Auto-send outreach.

### Admin Page Modules

The Admin route should be a monitoring console with these modules:

| Module | Purpose | Primary DB/source |
|---|---|---|
| `总览` | Tenant-wide KPI cards and charts for leads, screenings, high-score buyers, failed tasks, and cost. | `agent_runs`, `lead_candidates`, `screening_reports`, `api_call_ledger`. |
| `实时任务` | Live table of running/queued/recent tasks: user, Agent, target, current stage, elapsed time, last tool/source, status. | `agent_runs`, `agent_run_activity_events`, OpenClaw session references. |
| `获客与背调汇总` | All customers across users with filters by owner, score tier, status, country, product, source, and date. | Lead/Screening projection over `lead_candidates`, `screening_targets`, `screening_reports`. |
| `员工视图` | Per-user list and performance summary. Clicking a user opens that user's leads, screenings, Accio records, costs, and failed tasks. | `cbe_user_profiles`, `agent_runs`, Lead/Screening/Accio tables. |
| `Agent 使用统计` | Usage by `cbe-lead-discovery`, `cbe-buyer-screening`, `cbe-accio-memory`: runs, failures, average duration, model/tool cost, evidence coverage. | `agent_runs`, `api_call_ledger`, `agent_run_activity_events`. |

### Database Implications

Use a customer-specific profile table that only models the CBE product role:

```sql
cbe_user_profiles(
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null references sentura_users(id),
  cbe_role text not null, -- admin | operator
  display_name text not null,
  team_name text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, user_id)
);
```

Every user-visible business record family should keep owner and visibility fields:

| Column | Meaning |
|---|---|
| `created_by_user_id` | Human user who submitted/imported the work. |
| `owner_user_id` | Business user responsible for the customer row or memory record. |
| `team_name` | Optional sales team/group label for admin filtering. |
| `visibility_scope` | `private`, `team`, or `tenant_shared`. |
| `target_summary` | Human-readable target text for admin monitoring, such as `Mobile Lab UK / mobilelab.co.uk`. |

Add a task-activity table so admins can see "which employee is calling which Agent to investigate what" without parsing raw transcripts:

```sql
agent_run_activity_events(
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
```

Admin pages should read projections/views rather than mutating core settings:

- `cbe_customer_work_items`: one row per visible customer/target with latest Lead/Screening state.
- `cbe_operator_workload_daily`: per-user daily/weekly task and result counts.
- `cbe_agent_usage_daily`: per-Agent runs, errors, duration, cost, and evidence-source coverage.

The route/store layer must enforce:

- `operator`: can create tasks and read own/shared records.
- `admin`: read-only tenant/team monitoring plus scoped report detail. Mutating runtime/platform settings is not part of this customer UI.

## 3. Execution Order

Use this order. Later phases depend on durable database IDs and store contracts from the earlier phases.

| Phase | Target duration | Outcome | Primary files/modules |
|---|---:|---|---|
| P2.1 | 2-3 days | Database schema, migration runner, local dev DB config, seed tenant/user records. | `sentura/lib/cross-border-store/*`, `sentura/dashboard/src/lib/cross-border-store/*`, migration files, setup docs. |
| P2.2 | 2-3 days | Typed CBE store API and Next.js route handlers for customer/task/memory/report reads and validated writes. | Dashboard `app/api/client-demos/cross-border/employee/**/route.ts`, shared schemas, store tests. |
| P2.3 | 3-4 days | Employee UI reads from DB and uses `localStorage` only for drafts/cache. | Employee pages, `use-cbe-employee-store`, task runner, notification center, cost card. |
| P2.4 | 4-5 days | Lead Discovery run-scope coordinator, leases, memberships, shared progress, identity dedupe, top-up mode. | Lead run route/store, coordinator library, `cbe-lead-discovery` prompt/skill updates, concurrency tests. |
| P2.5 | 3-4 days | Screening and Accio durable persistence, report/evidence/handoff tables, approval-to-memory workflow. | Screening/Memory route/store, `cross-border-intel`, `cbe-buyer-screening`, `cbe-accio-memory` skills. |
| P2.6 | 2-3 days | Multi-user/load smoke, backup/restore drill, production-readiness report. | Test scripts, runbook, go-live checklist updates. |

Recommended work rule: finish each phase with tests and doc sync before starting the next phase. Do not start P2.4 concurrency work until P2.1/P2.2 store writes are real.

## 4. P2.1 — Business Database Foundation

### 4.1 Storage Choice

Production target:

- PostgreSQL-compatible managed database.
- Alibaba Cloud PolarDB/RDS PostgreSQL or TencentDB/TDSQL-C PostgreSQL depending on customer procurement.

Local/dev target:

- Prefer a local PostgreSQL instance when available so transaction/lock behavior matches production.
- SQLite WAL is acceptable only as a single-server pilot fallback with a written migration path and a feature flag that disables distributed assumptions.

Configuration:

- Database URL must come from environment or OpenClaw/Sentura secret injection, not committed config.
- Suggested env name: `CBE_DATABASE_URL`.
- Optional fallback path for single-server SQLite: `CBE_SQLITE_PATH`, explicitly documented as non-production unless the customer accepts the limitation.

### 4.2 Schema Scope

Create one tenant-scoped schema for the CBE lane. The core shape comes from `DESIGN.md §8` and agent-specific docs.

Minimum tables:

```sql
tenants(
  id text primary key,
  slug text unique not null,
  display_name text not null,
  data_region text not null,
  created_at timestamptz not null default now()
);

sentura_users(
  id text primary key,
  tenant_id text not null references tenants(id),
  display_name text not null,
  role text not null,
  department_id text,
  user_token_hash text,
  created_at timestamptz not null default now()
);

cbe_user_profiles(
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null references sentura_users(id),
  cbe_role text not null,
  display_name text not null,
  team_name text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, user_id)
);

agent_runs(
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  visibility_scope text not null default 'private',
  agent_id text not null,
  session_key text,
  status text not null,
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

lead_runs(
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  agent_run_id text references agent_runs(id),
  query_config_json jsonb not null,
  status text not null,
  target_count integer not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

lead_candidates(
  id text primary key,
  tenant_id text not null references tenants(id),
  lead_run_id text references lead_runs(id),
  lead_identity_id text,
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  normalized_domain text,
  company_name text not null,
  country text,
  buyer_type text,
  matched_products_json jsonb not null default '[]'::jsonb,
  confidence numeric(5, 4),
  dedupe_key text,
  status text not null,
  created_at timestamptz not null default now()
);

lead_sources(
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

screening_targets(
  id text primary key,
  tenant_id text not null references tenants(id),
  source text not null,
  lead_candidate_id text references lead_candidates(id),
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  company_name text not null,
  country text,
  domain text,
  email text,
  contact_person text,
  product_interest_json jsonb not null default '[]'::jsonb,
  supplied_fields_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

screening_reports(
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_target_id text not null references screening_targets(id),
  agent_run_id text references agent_runs(id),
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  risk_tier text not null,
  normalized_score numeric(6, 2),
  evidence_coverage numeric(6, 2),
  recommended_action text,
  created_at timestamptz not null default now(),
  report_json jsonb not null default '{}'::jsonb
);

screening_evidence(
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

screening_score_blocks(
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_report_id text not null references screening_reports(id),
  block text not null,
  status text not null,
  max_points numeric(6, 2),
  earned_points numeric(6, 2),
  reason text
);

accio_imports(
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  agent_run_id text references agent_runs(id),
  source_file_name text,
  file_hash text not null,
  storage_key text,
  validation_status text not null,
  classification text not null,
  uploaded_at timestamptz not null default now()
);

accio_conversations(
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

accio_messages(
  id text primary key,
  tenant_id text not null references tenants(id),
  accio_conversation_id text not null references accio_conversations(id),
  message_ts timestamptz,
  sender_role text,
  text_hash text not null,
  text_redacted text,
  attachment_json jsonb not null default '[]'::jsonb
);

accio_summaries(
  id text primary key,
  tenant_id text not null references tenants(id),
  accio_conversation_id text not null references accio_conversations(id),
  agent_run_id text references agent_runs(id),
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  customer_profile_json jsonb not null,
  purchase_intent_json jsonb not null,
  negotiated_price_json jsonb not null,
  next_actions_json jsonb not null,
  behavior_signals_json jsonb not null,
  created_at timestamptz not null default now()
);

handoff_events(
  id text primary key,
  tenant_id text not null references tenants(id),
  from_agent_id text not null,
  to_agent_id text not null,
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  assigned_to_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  source_record_type text not null,
  source_record_id text not null,
  payload_json jsonb not null,
  status text not null,
  created_at timestamptz not null default now()
);

memory_facts(
  id text primary key,
  tenant_id text not null references tenants(id),
  agent_id text not null,
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  reviewed_by_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  source_record_type text not null,
  source_record_id text not null,
  fact_json jsonb not null,
  vector_memory_ref text,
  status text not null,
  created_at timestamptz not null default now()
);

api_call_ledger(
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

audit_events(
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text references sentura_users(id),
  agent_id text,
  event_type text not null,
  data_tier text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

agent_run_activity_events(
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
```

Concurrency-specific tables from `MARKET_ACQUISITION.md §9`:

```sql
lead_discovery_scopes(
  id text primary key,
  tenant_id text not null references tenants(id),
  scope_hash text not null,
  canonical_scope_json jsonb not null,
  status text not null,
  active_agent_run_id text references agent_runs(id),
  requested_total integer not null default 0,
  produced_unique_count integer not null default 0,
  locked_until timestamptz,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, scope_hash)
);

lead_run_memberships(
  id text primary key,
  tenant_id text not null references tenants(id),
  scope_id text not null references lead_discovery_scopes(id),
  lead_run_id text not null references lead_runs(id),
  user_id text references sentura_users(id),
  mode text not null,
  requested_count integer not null,
  joined_at timestamptz not null default now()
);

lead_identities(
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

lead_run_results(
  id text primary key,
  tenant_id text not null references tenants(id),
  lead_run_id text not null references lead_runs(id),
  lead_identity_id text not null references lead_identities(id),
  rank integer not null,
  duplicate_status text not null,
  duplicate_reason text,
  source_snapshot_json jsonb not null,
  created_at timestamptz not null default now(),
  unique(tenant_id, lead_run_id, lead_identity_id)
);

lead_allocations(
  id text primary key,
  tenant_id text not null references tenants(id),
  lead_identity_id text not null references lead_identities(id),
  allocated_to_user_id text references sentura_users(id),
  source_lead_run_id text references lead_runs(id),
  allocation_status text not null,
  expires_at timestamptz,
  allocated_at timestamptz not null default now()
);
```

Minimum indexes:

```sql
create unique index lead_candidates_tenant_domain_uidx
  on lead_candidates(tenant_id, normalized_domain)
  where normalized_domain is not null;

create index screening_targets_identity_idx
  on screening_targets(tenant_id, domain, email);

create index screening_reports_latest_idx
  on screening_reports(tenant_id, screening_target_id, created_at desc);

create index accio_conversations_lookup_idx
  on accio_conversations(tenant_id, company_name, email);

create index api_call_ledger_rollup_idx
  on api_call_ledger(tenant_id, created_at, provider);

create index audit_events_rollup_idx
  on audit_events(tenant_id, created_at, event_type, data_tier);

create index agent_runs_status_idx
  on agent_runs(tenant_id, agent_id, status, started_at desc);

create index lead_scopes_active_idx
  on lead_discovery_scopes(tenant_id, status, locked_until);

create index cbe_user_profiles_role_idx
  on cbe_user_profiles(tenant_id, cbe_role, status);

create index lead_candidates_owner_scope_idx
  on lead_candidates(tenant_id, owner_user_id, team_name, visibility_scope);

create index screening_targets_owner_scope_idx
  on screening_targets(tenant_id, owner_user_id, team_name, visibility_scope);

create index accio_imports_owner_scope_idx
  on accio_imports(tenant_id, owner_user_id, team_name, visibility_scope);

create index agent_run_activity_monitor_idx
  on agent_run_activity_events(tenant_id, status, agent_id, created_at desc);
```

### 4.3 Migration Method

Implementation should add a small migration runner rather than ad hoc SQL in route handlers.

Recommended shape:

```text
sentura/lib/cross-border-store/
  migrations/
    001_initial_schema.sql
    002_lead_scope_coordinator.sql
  migrate.ts
  db.ts
  ids.ts
  schemas.ts
```

Rules:

- Migrations are idempotent where possible, but the migration table remains the source of applied history.
- Every table includes `tenant_id` unless it is global static metadata.
- JSON columns store validated structured payloads only.
- Use deterministic IDs for test fixtures when test stability matters; use random UUIDs for runtime records.
- Redact direct personal contact values in audit metadata where feasible.

Acceptance checks:

- Fresh migration creates all tables and indexes.
- Re-running migration is a no-op.
- Seed creates one tenant `cross-border-ecommerce`, one CBE admin profile, and at least two ordinary CBE operator profiles for concurrency/monitoring tests.
- No secret-like value appears in migration files or seed records.

Implementation status (2026-06-16): complete for the P2.1 foundation. The repository now has PostgreSQL migrations in `sentura/lib/cross-border-store/migrations/`, a `CBE_DATABASE_URL`-driven migration runner and seed flow in `sentura/lib/cross-border-store/`, a dashboard-side CBE role/module boundary placeholder, and `scripts/test-cross-border-phase2-store.ts`. Local verification created/reused the `sentura_cbe_dev` database, applied migrations, seeded one admin and two operators, reran migrations as a no-op, checked tables/views/indexes, and passed an activity-event insert probe inside a rollback transaction.

## 5. P2.2 — Typed Store And Route Boundaries

### 5.1 Boundary Decision

Phase 2 should start with Dashboard server route handlers plus a shared typed store library. This matches the existing Next.js dashboard stack and avoids giving employees raw DB access. Later, the same store API can be wrapped by a `cross-border-store` MCP server or Sentura plugin if agents need first-class store tools.

Use Next.js App Router `route.ts` handlers for server endpoints because the current dashboard already uses App Router and official Next.js docs define Route Handlers as Web Request/Response based handlers inside `app`.

Do not:

- Put database writes in client components.
- Parse employee marker JSON directly in route handlers without Zod validation.
- Let the three employees call SQL.

### 5.2 Store API

Recommended library layout:

```text
sentura/dashboard/src/lib/cross-border-store/
  index.ts
  db.ts
  schemas.ts
  tenant-context.ts
  customers.ts
  lead-runs.ts
  screening.ts
  accio.ts
  tasks.ts
  notifications.ts
  api-ledger.ts
  audit.ts
```

Core functions:

```ts
resolveCbeTenantContext(request): Promise<{
  tenantId: string;
  userId: string;
  cbeRole: "admin" | "operator";
  teamName?: string;
  dataScope: "tenant_monitor" | "team_monitor" | "own_work";
}>;

createAgentRun(input): Promise<AgentRunRecord>;
markAgentRunRunning(input): Promise<AgentRunRecord>;
completeAgentRun(input): Promise<AgentRunRecord>;
failAgentRun(input): Promise<AgentRunRecord>;

saveLeadRunResult(input): Promise<{
  leadRun: LeadRunRecord;
  candidates: LeadCandidateRecord[];
  sources: LeadSourceRecord[];
}>;

saveScreeningReports(input): Promise<{
  targets: ScreeningTargetRecord[];
  reports: ScreeningReportRecord[];
}>;

saveAccioImport(input): Promise<AccioImportRecord>;
saveAccioSummaries(input): Promise<AccioSummaryRecord[]>;
createHandoffEvent(input): Promise<HandoffEventRecord>;
createMemoryFactPreview(input): Promise<MemoryFactRecord>;

listEmployeeCustomers(query): Promise<EmployeeCustomerPage>;
listEmployeeTasks(query): Promise<EmployeeTaskPage>;
listEmployeeNotifications(query): Promise<EmployeeNotificationPage>;
listEmployeeMemoryRecords(query): Promise<EmployeeMemoryPage>;
```

Validation:

- Reuse existing CBE Zod schemas from `sentura/lib/cross-border-ecommerce.ts` where possible.
- Add DB-facing schemas for normalized records and row projections.
- Reject marker payloads that do not include source URLs/timestamps for evidence-bearing results.
- Store parse failures as failed `agent_runs` plus `audit_events`; do not silently drop failed runs.

### 5.3 Route Handler Surface

Initial endpoints:

```text
GET  /api/client-demos/cross-border/employee/customers
POST /api/client-demos/cross-border/employee/lead-runs
POST /api/client-demos/cross-border/employee/lead-runs/{id}/complete
POST /api/client-demos/cross-border/employee/screening-runs
POST /api/client-demos/cross-border/employee/screening-runs/{id}/complete
GET  /api/client-demos/cross-border/employee/tasks
POST /api/client-demos/cross-border/employee/tasks/{id}/dismiss
GET  /api/client-demos/cross-border/employee/notifications
POST /api/client-demos/cross-border/employee/notifications/read
GET  /api/client-demos/cross-border/employee/memory
POST /api/client-demos/cross-border/employee/memory/imports
POST /api/client-demos/cross-border/employee/memory/imports/{id}/complete
POST /api/client-demos/cross-border/employee/handoffs

GET  /api/client-demos/cross-border/admin/overview
GET  /api/client-demos/cross-border/admin/live-tasks
GET  /api/client-demos/cross-border/admin/customers
GET  /api/client-demos/cross-border/admin/operators
GET  /api/client-demos/cross-border/admin/operators/{id}
GET  /api/client-demos/cross-border/admin/agent-usage
```

Implementation notes:

- `POST /lead-runs` starts by creating DB records and acquiring coordinator state; it does not directly return fabricated leads.
- Hidden OpenClaw session creation still uses the Gateway client from the Dashboard flow.
- Completion endpoints accept only parsed/validated employee marker JSON plus the `agent_run_id`/`session_key` reference.
- All writes add audit rows with `data_tier`.
- Admin endpoints require `cbeRole = admin` and are read-mostly monitoring endpoints for this customer UI.
- Read endpoints must apply server-side row filters from `resolveCbeTenantContext`; client-side filtering is only presentation.

### 5.4 Implementation Status (2026-06-17)

P2.2 is implemented for the Dashboard server/store boundary:

- Added typed Dashboard store modules under `sentura/dashboard/src/lib/cross-border-store/`.
- Added Employee API routes for customer/task/notification/memory reads, Lead/Screening/Accio run creation, validated completion writes, notification read, task dismiss, and handoff creation.
- Added Admin monitoring read routes for overview, live tasks, customers, operators, operator detail, and Agent usage.
- Completion endpoints validate marker payloads with Zod before writes and mark parse failures as failed `agent_runs` with audit metadata.
- Lead completion writes candidates, sources, identities/results, activity, and audit rows.
- Screening completion writes targets, reports, evidence, score blocks, activity, and audit rows.
- Accio import/summary writes hash/redacted message records, summaries, pending-review memory facts, Screening handoffs, activity, and audit rows.
- `scripts/test-cross-border-phase2-store.ts` now covers P2.2 static route/store checks and live PostgreSQL round-trip checks.

Boundary: P2.3 is still required to migrate the actual Employee React pages and `use-cbe-employee-store` off `localStorage`; P2.2 only creates the durable server API/store contract.

## 6. P2.3 — Move Employee UI Off `localStorage`

### 6.1 Current State

The Employee UI currently uses a persisted client store for customer rows, task records, notifications, and memory rows. That is acceptable for demo continuity but not for multi-user operation.

### 6.2 Target State

The DB is the source of truth:

| Data | Source after P2.3 | Local client role |
|---|---|---|
| Customer rows | `lead_candidates`, `screening_targets`, `screening_reports` | Cache current page only. |
| Task progress | `agent_runs`, `lead_runs`, `lead_run_memberships` | Poll or subscribe; keep optimistic draft state only. |
| Notifications | DB-backed notification/task projection | Store read UI state only if DB read state is not yet implemented. |
| Reports | `screening_reports`, `screening_evidence`, `screening_score_blocks` | Cache selected drawer only. |
| Memory records | `accio_imports`, `accio_conversations`, `accio_summaries`, `memory_facts` | Draft upload payload before submit. |
| API cost details | `sentura-cost` events plus `api_call_ledger` | Display aggregation only. |

Implementation method:

1. Add server-side list endpoints and typed response mappers.
2. Replace direct seed/local state initialization with endpoint reads.
3. Keep existing local seed rows only as a dev fallback behind an explicit `CBE_USE_DEMO_SEED=1`.
4. When a hidden task starts, immediately create an `agent_runs` row and task projection in DB.
5. When employee marker parsing succeeds, write results in one store transaction and refresh affected lists.
6. When parsing/model/Gateway fails, update `agent_runs.status = failed` with stable `error_code` and `error_message`.
7. Update notification center to query terminal `agent_runs` and explicit task notification rows.

User-facing behavior should not regress:

- `个人中心`, `获客与背调`, and `记忆整理` keep their current layout.
- `寻找客户` and `背调` can still run one each concurrently on the same page.
- Completed/failed task notifications still show unread count.
- Cost detail still shows model and external tool/API rows truthfully.

### 6.3 Implementation Status (2026-06-17)

P2.3 is implemented for the ordinary Employee UI:

- Added `employee-api.ts` as the typed client-side adapter for the P2.2 Employee routes, including customer/task/memory reads, notification read writes, Lead/Screening/Accio create/complete calls, failure writes, and marker payload normalization.
- Changed `use-cbe-employee-store` so `localStorage` persists only `draftCache`; customer rows, memory rows, and task records are hydrated from server APIs. Demo seed rows are available only behind `NEXT_PUBLIC_CBE_USE_DEMO_SEED=1` or `CBE_USE_DEMO_SEED=1`.
- Updated `个人中心`, `获客与背调`, and `记忆整理` to fetch DB-backed projections on load and refresh customer/task/memory lists after successful writes.
- Wired hidden Lead/Screening/Accio runs to create DB `agent_runs` before session start, reuse the planned `session_key` for the OpenClaw session, call validated completion endpoints after marker parsing, and call the task failure endpoint on Gateway/model/marker failures.
- Lead/Screening marker normalization preserves source traceability: it derives evidence URLs only from returned source fields or target websites; missing traceable URLs fail the task instead of writing placeholder evidence.
- Updated the notification center to poll DB-backed task projections and mark terminal task notifications read through the API.
- Extended customer and Accio read projections with report/source/memory detail fields needed by the existing UI.
- Added CE20 coverage in `scripts/test-cross-border-phase2-store.ts`, updated the legacy CBE static suite, and verified with typecheck, focused ESLint, production build, Browser checks, and live PostgreSQL checks.

Boundary: P2.4 is still required for cross-user Lead Discovery run-scope coordination. P2.3 creates one DB run per Employee submission; it does not yet join exact duplicate Lead scopes into one shared OpenClaw run.

### 6.4 Manual DB Inspection

Use the checked-in inspection script instead of guessing raw table columns:

```bash
psql "postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev" \
  -f scripts/inspect-cross-border-live-db.sql
```

The same SQL file is covered by CE20 static checks and was executed against local `sentura_cbe_dev` with `node-postgres` to verify the query columns and joins. Use the `psql` command above when you want human-readable result tables in your own terminal.

Important physical-schema notes:

- `lead_candidates` stores `normalized_domain`, not a `website` column. Website is derived from `lead_run_results.source_snapshot_json->>'website'` or `normalized_domain`.
- `lead_sources` stores source text in `excerpt`; it does not have a `finding` column.
- `screening_targets` stores original website in `supplied_fields_json->>'website'`; it also stores normalized `domain`.
- `screening_reports` does not duplicate `company_name`; join through `screening_targets` on `screening_target_id`.
- `lead_candidates` does not have `agent_run_id`; join `lead_candidates -> lead_runs -> agent_runs`.

## 7. P2.4 — Lead Discovery Coordinator

### 7.1 Problem

If User A starts a 20-lead run and User B starts the same or near-identical 20-lead run while A is still running, starting a second `cbe-lead-discovery` AgentChat wastes search quota and can create duplicated buyer ownership. OpenClaw may run multiple sessions, but business dedupe belongs in Sentura.

### 7.2 Coordinator Contract

Add a coordinator before any new `cbe-lead-discovery` session starts.

Inputs:

```ts
{
  tenantId: string;
  userId: string;
  products: string[];
  buyerPersonas: string[];
  countries: string[];
  languages: string[];
  sourcePolicy: string[];
  excludeDomains: string[];
  targetCount: number;
}
```

Derived values:

- `canonical_scope_json`: sorted normalized JSON.
- `scope_hash`: SHA-256 of canonical scope fields excluding user id and target count.
- `scope_similarity`: weighted overlap from `MARKET_ACQUISITION.md §9.1`.

Outputs:

```ts
type LeadCoordinatorDecision =
  | { action: "start_new_run"; scopeId: string; leadRunId: string; agentRunId: string }
  | { action: "join_existing"; scopeId: string; leadRunId: string; activeAgentRunId: string }
  | { action: "offer_near_duplicate_choices"; similarScopes: SimilarScope[] }
  | { action: "reuse_completed_pool"; scopeId: string; availableCount: number }
  | { action: "queue_top_up"; scopeId: string; missingCount: number; denylist: string[] };
```

### 7.3 Transaction Method

For PostgreSQL:

1. Start transaction.
2. Upsert or fetch `lead_discovery_scopes` by `(tenant_id, scope_hash)`.
3. Lock the scope row with `SELECT ... FOR UPDATE`.
4. If `status = running` and `locked_until > now()`, insert `lead_run_memberships` with `mode = joined_existing` and return `join_existing`.
5. If no active lease exists, update scope with `status = running`, `active_agent_run_id`, and `locked_until = now() + interval '90 seconds'`.
6. Commit.
7. Start OpenClaw `sessions.create` / `chat.send` only after the lease is acquired.
8. Heartbeat the lease every 30-60 seconds.
9. On completion, upsert `lead_identities`, create `lead_run_results`, update `produced_unique_count`, set `status = completed`, and clear active lease.

Use `SKIP LOCKED` for queue workers if multiple server processes are later added. For the first single-dashboard-process implementation, row-level locks plus lease expiry are enough.

### 7.4 User Experience

Exact duplicate:

- Show `已有相同获客任务正在运行`.
- Default button: `加入共享结果池`.
- Secondary copy: `为了避免重复消耗搜索额度，本次不会启动第二个相同搜索`.
- B sees the same progress and receives deduped final results.

Near duplicate:

- Show `已有相似获客任务正在运行，预计还需 N 分钟`.
- Choices:
  - `加入共享结果池`
  - `只补充未分配客户`
  - `缩小条件并重新搜索`

Finished same scope within TTL:

- Reuse cached lead pool.
- If unique available count is below requested count, offer top-up.

### 7.5 Agent Contract Updates

Update `cbe-lead-discovery` skills and prompt builder to support:

- `run_mode = "new_scope"` for normal runs.
- `run_mode = "top_up_unique_leads"` for missing-count runs.
- `existing_identity_keys` denylist.
- `already_covered_queries` to avoid repeating the same search strings.
- Optional incremental output markers:
  - `LEAD_CANDIDATE_BATCH_JSON_START`
  - `LEAD_CANDIDATE_BATCH_JSON_END`

Do not require incremental markers for the first coordinator implementation. Add them once DB result writing and joined-user progress are stable.

## 8. P2.5 — Screening And Accio Durable Workflows

### 8.1 Screening Persistence

When Screening completes:

1. Upsert or create `screening_targets`.
2. Insert `screening_reports`.
3. Insert `screening_evidence`.
4. Insert `screening_score_blocks`.
5. Update linked customer row status through the projection.
6. Add `api_call_ledger` rows for observed external calls where not already backfilled by `sentura-cost`.
7. Add an `audit_events` row with source count, data tier, and session key reference.

Screening failures:

- Preserve the target row.
- Mark `agent_runs.status = failed`.
- Store stable error code:
  - `gateway_unavailable`
  - `employee_missing`
  - `marker_timeout`
  - `backend_model_timeout`
  - `marker_parse_failed`
  - `provider_rate_limited`
- Show retry action in UI.
- Never erase prior good reports for the same target.

Agent optimization after persistence:

- Keep MCP outputs bounded.
- Prefer official-source-first order for GB/US.
- Add more country registry adapters only after DB evidence model is stable.
- Add Alibaba internal-data evidence only after signed-seller API access is proven.

### 8.2 Accio Persistence And Memory Approval

When a user uploads or imports Accio JSON:

1. Hash the raw file.
2. Store raw upload in object storage or encrypted local volume.
3. Insert `accio_imports`.
4. Insert `accio_conversations`.
5. Insert redacted/hash-only `accio_messages`.
6. Run `cbe-accio-memory` through hidden OpenClaw session.
7. Insert `accio_summaries`.
8. Create `memory_facts` as `status = pending_review`.
9. Create `handoff_events` for Screening-ready buyer context.

Memory approval:

- User sees `memory_write_preview`.
- Approval action changes `memory_facts.status` from `pending_review` to `approved`.
- Only approved concise facts may be written into vector memory.
- Raw chat text remains T2/T3 business data and must not be written to vector memory or external channels.

## 9. P2.6 — Multi-User, Backpressure, And Load Smoke

Initial limits from `DESIGN.md §9`:

| Workload | Initial limit |
|---|---:|
| Concurrent user web sessions | 50-80 |
| Active Lead Discovery runs | 8-12 |
| Active Screening runs | 8-12 targets or 3-5 batches |
| Active Accio imports | 3-5 files |
| Browser/Playwright tasks | 0 normally; max 1-2 for self-provisioning |
| Model calls | Provider quota minus 20% headroom |

Backpressure method:

- Add a small queue layer backed by `agent_runs.status = queued`.
- If active count exceeds the per-kind limit, create queued run and show `排队中`.
- Use a worker loop or route-triggered drain for first implementation.
- If multiple server processes are introduced, use PostgreSQL row locks and `SKIP LOCKED` for queue claiming.

Load smoke:

1. Seed 50 users under tenant `cross-border-ecommerce`.
2. Open or simulate 50 dashboard sessions.
3. Start 10 Lead requests with 3 duplicate scopes and 2 near-duplicate scopes.
4. Start 5 Screening batches with mixed completed/failed provider fixtures.
5. Start 3 Accio imports with fixture payloads.
6. Assert:
   - exact duplicate Lead scopes launch one OpenClaw session only;
   - joined users receive shared progress;
   - same lead identity is not duplicated in the tenant pool;
   - task notifications appear for the correct user;
   - API cost ledger rows are tenant/user/agent-run attributable;
   - p95 dashboard API latency is recorded;
   - provider throttling produces coverage gaps or queued status, not crashes.

## 10. Implementation File Plan

Expected new or changed files:

```text
sentura/lib/cross-border-store/
  migrations/001_initial_schema.sql
  migrations/002_lead_scope_coordinator.sql
  migrate.ts
  db.ts
  schemas.ts
  ids.ts

sentura/dashboard/src/lib/cross-border-store/
  index.ts
  tenant-context.ts
  customers.ts
  lead-runs.ts
  lead-coordinator.ts
  screening.ts
  accio.ts
  tasks.ts
  notifications.ts
  api-ledger.ts
  audit.ts

sentura/dashboard/src/app/api/client-demos/cross-border/employee/
  customers/route.ts
  lead-runs/route.ts
  lead-runs/[id]/complete/route.ts
  screening-runs/route.ts
  screening-runs/[id]/complete/route.ts
  memory/route.ts
  memory/imports/route.ts
  memory/imports/[id]/complete/route.ts
  tasks/route.ts
  notifications/route.ts
  notifications/read/route.ts
  handoffs/route.ts

sentura/dashboard/src/app/api/client-demos/cross-border/admin/
  overview/route.ts
  live-tasks/route.ts
  customers/route.ts
  operators/route.ts
  operators/[id]/route.ts
  agent-usage/route.ts

sentura/dashboard/src/app/client-demos/cross-border/employee/
  page.tsx
  customers/page.tsx
  memory/page.tsx
  _data/employee-task-runner.ts

sentura/dashboard/src/app/client-demos/cross-border/admin/
  page.tsx

sentura/dashboard/src/stores/use-cbe-employee-store.ts
scripts/test-cross-border-phase2-store.ts
scripts/test-cross-border-phase2-concurrency.ts
scripts/test-cross-border-agents.ts
docs/TESTS.md
docs/tests/tests-cross-border-ecommerce.md
```

Do not create new top-level agent workspace markdown files beyond the 8 native OpenClaw files.

## 11. Test Plan

Add CE17 for this planning document, then implementation tests as work lands.

Phase 2 implementation tests:

| Test | Method | Expected |
|---|---|---|
| CE18 — DB migrations/store | `scripts/test-cross-border-phase2-store.ts` | Migrations run idempotently; seed tenant/users created; store writes/reads all major record families; no secrets in output. |
| CE19 — P2.2 typed Dashboard store/API routes | `scripts/test-cross-border-phase2-store.ts` + type/lint/build | Store modules and Employee/Admin route handlers exist; Zod marker validation gates writes; Lead/Screening/Accio live PostgreSQL round-trip succeeds; parse failures mark failed `agent_runs`. |
| CE20 — P2.3 Employee DB-backed UI migration | `scripts/test-cross-border-phase2-store.ts` + `scripts/inspect-cross-border-live-db.sql` + type/lint/build + Browser | Employee home/customers/memory render from DB; `localStorage` persists drafts/cache only; hidden Lead/Screening/Accio runs create/complete/fail DB task projections; notifications read terminal `agent_runs`; manual DB inspection queries match the physical schema. |
| CE21 — P2.4 Lead coordinator concurrency | `scripts/test-cross-border-phase2-concurrency.ts` | Two exact same-scope requests create one active OpenClaw run and two memberships; near duplicates offer choices; completed pool reuse and top-up denylist work. |
| CE22 — P2.5 Screening/Accio durable workflow | Store tests + Browser | Screening report/evidence detail UX, retry/recovery, Accio approval-to-memory promotion, and durable Screening handoff consumption work. |
| CE23 — P2.6 load smoke | Live/staged run | 50 sessions, 10 Lead runs, 5 Screening batches, 3 Accio imports; limits/backpressure/cost/audit recorded. |

Minimum verification after each implementation slice:

```bash
pnpm exec tsx scripts/test-cross-border-agents.ts
pnpm exec tsx scripts/test-cross-border-phase2-store.ts
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm build
git diff --check
```

After coordinator implementation:

```bash
pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts
```

After MCP or employee skill changes:

```bash
pnpm --filter @sentura/mcp-cross-border-intel test
pnpm --filter @sentura/mcp-cross-border-intel build
```

## 12. Acceptance Criteria

Phase 2 is complete when:

1. New customer rows, Screening reports, Accio summaries, task records, notifications, and handoffs survive browser refresh, route navigation, and a dashboard restart.
2. Two users submitting the same Lead Discovery scope join one shared run instead of launching duplicate `cbe-lead-discovery` sessions.
3. Lead identity dedupe prevents the same company/domain from appearing as separate active buyer identities in the same tenant.
4. Top-up mode asks the employee only for missing unique leads and passes an `existing_identity_keys` denylist.
5. Screening reports persist all evidence and score blocks with source URLs/timestamps.
6. Accio raw uploads are stored outside vector memory; only approved concise memory facts can be promoted.
7. Every employee run has `tenant_id`, `user_id`, `agent_id`, `session_key`, `status`, timestamps, cost references, and audit references.
8. Failed runs are visible and retryable with real backend errors where available.
9. API calls are visible through `sentura-cost` and/or `api_call_ledger` without fabricating spend.
10. Typecheck, build, CBE static checks, store tests, coordinator tests, and MCP tests pass.

## 13. Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Local dev lacks Docker/sandbox runtime for true live E2E | Keep employees configured as `sandbox.mode: "non-main"`; use static/store/coordinator tests locally and run true E2E on an environment with Docker/Podman/OrbStack, or use a clearly labeled temporary sandbox-off local override only with explicit approval. |
| Coordinator starts AgentChat before acquiring lease | Enforce transaction-first start order and test exact duplicate submissions. |
| DB writes leak raw Accio chats into vector memory | Store raw files separately; persist redacted text/hash rows; require memory-fact approval before vector write. |
| External provider costs are incomplete | Keep observed calls visible; mark free/included/unpriced accurately; do not invent USD for account-plan services. |
| Long Screening context causes model timeout again | Keep MCP outputs bounded, store partial evidence, and surface backend errors directly in `agent_runs`. |
| UI becomes too technical for sales users | Keep technical IDs in detail drawers; visible labels remain Simplified Chinese business wording. |

## 14. Immediate Next Task

P2.1, P2.2, and P2.3 are complete. Next start P2.4:

1. Add the Lead Discovery run-scope coordinator before a new `cbe-lead-discovery` OpenClaw session starts.
2. Enforce exact-scope reuse with one active run and multiple memberships.
3. Add near-duplicate detection and user choice handling.
4. Implement completed-pool reuse and top-up denylist behavior.
5. Extend CE21 concurrency coverage before starting P2.5 durable Screening/Accio workflow polish.
