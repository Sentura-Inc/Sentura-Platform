> **On-demand reference — not read by default.**
>
> Back-link: [`DESIGN.md`](DESIGN.md)
>
> Status: Phase 2 implementation plan. This document is the execution bridge from the completed Phase-1 Employee UI and three-agent MVP to production persistence, multi-user concurrency, and durable agent optimization.
>
> Last updated: 2026-06-24

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
| [`P2.6-LOAD-SMOKE-RUNBOOK.md`](P2.6-LOAD-SMOKE-RUNBOOK.md) | P2.6 operational runbook for DB-only load smoke, backup/restore drill, pressure-result labels, and target-deployment go-live checklist. |
| [`docs/TESTS.md`](../docs/TESTS.md) | CE4-CE16 are green for Phase-1 workspaces, MCP tools, Employee UI, hidden tasks, progress/cost/notification UX, and compact Screening evidence. Phase 2 adds CE17 and later implementation tests. |
| [`docs/MEMORY.md`](../docs/MEMORY.md) | Latest ground truth: CBE sandbox is `non-main`; live E2E on the current Mac needs Docker/compatible sandbox runtime or an explicit unsafe sandbox-off override; recent UI fixes are complete. |
| `final-test-report(1).docx` | 2026-06-20 10-task pressure test: Lead Discovery should keep one `find-10` session; Screening must not run 10 companies in one AgentChat session and should fan out one company per child run. |
| `测试结论总报告.docx` | 2026-06-19 cloud test summary: on the tested 4C/16G mainland ECS with DeepSeek as primary model, current safe active-task envelope is about 32; 48 hits a Gateway RSS soft threshold rather than hardware exhaustion. |
| `Sentura - API Pricing.pdf` | API source scope and cost posture: official registry sources first, RDAP/DNS low-cost checks, paid email/trade data behind explicit budget, and sales/enrichment APIs outside the default Screening path. |
| Google Maps Platform Places API docs | Places Text Search/Nearby Search/Details are suitable for local-business lead discovery and local-presence evidence when used with explicit field masks, API-key restrictions, source attribution, and caching/retention guardrails. |

External implementation references checked for this plan:

- Next.js App Router Route Handlers: `https://nextjs.org/docs/app/getting-started/route-handlers`
- Next.js route file convention and supported HTTP methods: `https://nextjs.org/docs/app/api-reference/file-conventions/route`
- PostgreSQL `SELECT ... FOR UPDATE`, `NOWAIT`, and `SKIP LOCKED`: `https://www.postgresql.org/docs/current/sql-select.html`
- Companies House API rate limit: `https://developer.company-information.service.gov.uk/developer-guidelines`
- SEC EDGAR fair access: `https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data`
- RDAP.org rate limits: `https://about.rdap.org/`
- French API Entreprise rate-limit headers and 429 behavior: `https://entreprise.api.gouv.fr/developpeurs`
- OpenClaw Gateway protocol: `https://docs.openclaw.ai/gateway/protocol`
- OpenClaw MCP docs: `https://docs.openclaw.ai/cli/mcp`
- OpenClaw sandbox MCP/plugin tool policy: `https://docs.openclaw.ai/gateway/config-tools`
- Google Maps Platform Places Text Search: `https://developers.google.com/maps/documentation/places/web-service/text-search`
- Google Maps Platform Places Nearby Search: `https://developers.google.com/maps/documentation/places/web-service/nearby-search`
- Google Maps Platform Place Details: `https://developers.google.com/maps/documentation/places/web-service/place-details`
- Google Maps Platform Geocoding API: `https://developers.google.com/maps/documentation/geocoding/overview`
- Google Maps Platform Address Validation API: `https://developers.google.com/maps/documentation/address-validation/overview`
- Google Maps Platform place data fields, usage/billing, policies, and API security:
  - `https://developers.google.com/maps/documentation/places/web-service/data-fields`
  - `https://developers.google.com/maps/documentation/places/web-service/usage-and-billing`
  - `https://developers.google.com/maps/documentation/places/web-service/policies`
  - `https://developers.google.com/maps/api-security-best-practices`

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
9. Report-calibrated workload control: Lead `find-10` stays a single session, Screening batches are split into bounded single-target child runs, and all three CBE employees share one queue/backpressure policy.
10. Google Maps Places + OpenClaw web search becomes the target primary acquisition/backcheck source combination: Maps discovers local/storefront buyer seeds; web search/fetch verifies official-site product fit and non-local B2B evidence.

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
| P2.4 | 4-5 days | Global CBE workload coordinator, queue/backpressure limits, Lead Discovery run-scope coordinator, leases, memberships, shared progress, identity dedupe, and top-up mode. | Queue/coordinator library, Lead run route/store, `agent_runs` queue metadata, `cbe-lead-discovery` prompt/skill updates, concurrency tests. |
| P2.5 | 3-4 days | Lead result-level DB reconciliation/top-up correction, Google Maps + web-search source redesign, Screening single-target fan-out, report-driven API source scope, durable Screening/Accio persistence, report/evidence/handoff tables, approval-to-memory workflow. | Lead reconciliation store/UI, Google Maps Places adapter plan, Screening/Memory route/store, `cross-border-intel`, `cbe-buyer-screening`, `cbe-accio-memory` skills, fan-out/budget tests. |
| P2.6 | 2-3 days | Multi-user/load smoke against the calibrated 24/32/48 active-task envelope, backup/restore drill, production-readiness report. | Test scripts, runbook, go-live checklist updates. |

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

screening_address_locations(
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_report_id text not null references screening_reports(id) on delete cascade,
  screening_target_id text not null references screening_targets(id) on delete cascade,
  lead_candidate_id text references lead_candidates(id) on delete set null,
  agent_run_id text references agent_runs(id) on delete set null,
  created_by_user_id text references sentura_users(id),
  owner_user_id text references sentura_users(id),
  department_id text,
  team_name text,
  visibility_scope text not null default 'private',
  company_name text not null,
  normalized_domain text,
  google_place_id text,
  display_name text not null,
  formatted_address text not null,
  address_type text not null,
  relationship_status text not null,
  city text,
  region text,
  country text,
  business_status text,
  types_json jsonb not null default '[]'::jsonb,
  website_uri text,
  domain_match text not null default 'not_checked',
  phone_match text not null default 'not_checked',
  address_validation_json jsonb not null default '{}'::jsonb,
  google_maps_uri text,
  match_confidence numeric(5, 4),
  match_reasons_json jsonb not null default '[]'::jsonb,
  source_type text not null default 'google_maps_places',
  fetched_at timestamptz,
  created_at timestamptz not null default now()
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

## 7. P2.4 — Workload Coordinator And Lead Discovery Coordinator

Status: Implemented and verified on 2026-06-21. P2.4 now has the global CBE workload queue/admission layer, Lead scope coordinator, queue metadata migration, Employee launch gating, Lead pre-search/top-up prompt support, and CE21 static/live PostgreSQL coverage. P2.4 scope prediction is a cost/backpressure optimization, not the final customer-dedupe source of truth. Lead result-level DB reconciliation/top-up was implemented immediately after P2.4. Every executable Lead run now retrieves tenant DB identity keys before hidden search starts, completed scopes provide denylist context only, and the runtime never reuses assigned customer rows.

The 2026-06-19/20 pressure reports change P2.4 from a Lead-only dedupe feature into the first global workload-control slice. Lead Discovery still needs scope coordination, but Screening now also needs a scheduler because "10 companies" must be split into child AgentChat sessions instead of one large batch.

### 7.0 Report-Calibrated Workload Baseline

Use these measurements as the initial production-sizing contract for the current single-box pilot profile:

| Workload | Measured result | Phase 2 execution decision |
|---|---|---|
| Lead Discovery `find-10` | One session produced 10/10 leads in about 2 minutes; higher concurrency kept near-linear item throughput, but high-concurrency runs sometimes completed with fewer than 10 parsed leads. | Keep one `cbe-lead-discovery` session per request, default `targetCount <= 10`, then top up through the Lead coordinator when `items_produced < targetCount`. |
| Screening single target | Single-company sessions produced the thickest reports, zero compaction, about 6 evidence sources, and 100% marker survival in the 16/32 concurrency steps. | Default Screening execution is one company per `cbe-buyer-screening` child run. |
| Screening batch-3 | Clean in the report: 0 compaction and about 7 evidence sources per company. | Keep only as an explicit low-pressure optimization behind a feature flag. Do not make it the default. |
| Screening batch-5 | Produced thinner reports, repeated context compaction, slower wall time, and paid-call duplication even after prompt optimization. | Disable by default; allow only for controlled experiments. |
| Screening batch-10 | Failed with context overflow / payload-too-large and 0 usable reports while still burning some paid checks. | Block at the Dashboard/store boundary; split into child runs. |
| Total active CBE tasks | 32 active tasks were healthy in the tested 4C/16G ECS profile; 48 hit a Gateway RSS soft threshold, not hardware exhaustion. | Use a conservative soft cap of 24 active OpenClaw sessions and a hard cap of 32 until a C=40/48 knee test and soak test pass. Queue above the soft cap. |

Important interpretation:

- `success` at the OpenClaw session level is not enough. For Lead runs, store `items_produced`, marker parse status, and top-up need; a completed session with 0 parsed leads must be recoverable rather than counted as business success.
- All three CBE employees share one Gateway/main-lane capacity pool. Per-agent limits must add up under the global active-task cap.
- Increasing single-box concurrency past the knee mostly adds queueing because the bottleneck is model turn latency, not network API latency. Higher sustained throughput requires horizontal workers or a faster/provider-local model path.
- Model fallback is production-relevant: record DeepSeek -> Qwen -> GLM fallback events in `agent_runs.metadata_json` and cost/audit surfaces, but do not treat fallback as a reason to bypass queue limits.

### 7.0.1 Coordinator Configuration Contract

These are target runtime/config fields for P2.4/P2.5. They may live in environment, tenant settings, or a typed CBE settings table, but they must not be hardcoded in client components.

| Setting | Pilot default | Meaning |
|---|---:|---|
| `CBE_TASK_MAX_ACTIVE_TOTAL` | `24` | Soft active OpenClaw-session cap across Lead, Screening, and Accio. New work becomes `queued` when this is reached. |
| `CBE_TASK_MAX_ACTIVE_TOTAL_HARD` | `32` | Hard cap for the current single-box profile. Do not start new sessions above this cap unless an operator has explicitly switched to a pressure-test profile. |
| `CBE_LEAD_MAX_ACTIVE_RUNS` | `12` | Max active `cbe-lead-discovery` sessions. Each session may request up to 10 leads by default. |
| `CBE_LEAD_DEFAULT_TARGET_COUNT` | `10` | Default Lead request size. Larger requests must be chunked or approved. |
| `CBE_SCREENING_EXECUTION_MODE` | `single_target_fanout` | Default Screening batch behavior. A user batch creates a parent task plus child runs, one target per child. |
| `CBE_SCREENING_MAX_TARGETS_PER_SESSION` | `1` | Default child-run target count. This prevents batch-10 context overflow. |
| `CBE_SCREENING_ALLOW_BATCH3` | `false` | Optional controlled optimization; when true, the scheduler may pack up to 3 low-risk targets into one session under low load. |
| `CBE_SCREENING_MAX_ACTIVE_TARGETS` | `12` | Active Screening child-run cap under normal production load. Can be raised toward 16/32 only after API/provider budgets and queue behavior are verified. |
| `CBE_SCREENING_PAID_EMAIL_MAX_CALLS_PER_TARGET` | `1` | Abstract/Hunter paid validation cap per target. |
| `CBE_SCREENING_TRADE_MAX_CALLS_PER_TARGET` | `1` | ImportYeti/Volza paid trade-data cap per target. |
| `CBE_SCREENING_TRADE_MAX_SPEND_USD_PER_TARGET` | `1` when paid mode is enabled; otherwise `0` | Per-target paid trade-data request cap. This complements global `CBE_MAX_PAID_SPEND_USD`. |
| `CBE_ACCIO_MAX_ACTIVE_IMPORTS` | `3` | Active `cbe-accio-memory` import/analyze cap. |
| `CBE_PROVIDER_HEADROOM_RATIO` | `0.2` | Reserve at least 20% capacity under provider or Gateway quotas. |
| `CBE_QUEUE_LEASE_SECONDS` | `90` | Initial queue/active lease window; long-running sessions heartbeat to extend it. |

### 7.0.2 Queue And Fan-Out Data Model Additions

P2.1/P2.2 tables are enough for current task persistence, but P2.4/P2.5 should add explicit queue/fan-out metadata before implementing the scheduler:

```sql
alter table agent_runs
  add column parent_agent_run_id text references agent_runs(id),
  add column queue_priority integer not null default 0,
  add column queued_at timestamptz,
  add column lease_owner text,
  add column lease_until timestamptz;

create index agent_runs_queue_claim_idx
  on agent_runs(tenant_id, status, queue_priority desc, queued_at)
  where status = 'queued';

create table screening_batches(
  id text primary key,
  tenant_id text not null references tenants(id),
  created_by_user_id text references sentura_users(id),
  parent_agent_run_id text references agent_runs(id),
  requested_target_count integer not null,
  execution_mode text not null, -- single_target_fanout | batch3_experiment
  paid_email_enabled boolean not null default false,
  paid_trade_enabled boolean not null default false,
  per_target_trade_budget_usd numeric(12, 6) not null default 0,
  status text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table screening_batch_targets(
  id text primary key,
  tenant_id text not null references tenants(id),
  screening_batch_id text not null references screening_batches(id),
  screening_target_id text not null references screening_targets(id),
  child_agent_run_id text references agent_runs(id),
  target_order integer not null,
  status text not null,
  error_code text,
  created_at timestamptz not null default now()
);
```

Queue claiming should use `SELECT ... FOR UPDATE SKIP LOCKED` when multiple Dashboard/server processes or workers exist. The first implementation can drain queued rows from route-triggered workers, but it must preserve the same lease columns so the worker can later move out of the request path.

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
  | { action: "queue_top_up"; scopeId: string; missingCount: number; denylist: string[] };
```

Lead requests define the final number of unique new customers required for the current request, not a hard limit on how many web-search rows may be inspected. A normal repeated same-scope request for 10 means "add 10 more database-unique customers now", not "bring this employee's visible list up to 10 total". Only the internal `run_mode = "top_up_unique_leads"` path treats `target_count` as the missing-count remainder from a previous attempt. The employee may search enough public results to satisfy the target, subject to workload/cost budgets. Before every executable Lead search, the coordinator must retrieve existing tenant/customer identity keys from the database and pass them to the employee as `existing_identity_keys` so known customers are excluded during query generation and candidate filtering. Lead requests that ask for 10 or fewer final unique customers should still be one OpenClaw session. If the marker parser recovers fewer than the requested count, or DB reconciliation finds duplicates, the coordinator should create a top-up run with database-derived `existing_identity_keys` and `already_covered_queries` instead of treating the run as fully successful.

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
9. On completion, reconcile every candidate against `lead_identities`, `lead_candidates`, `lead_run_results`, and active allocations before writing visible customer rows.
10. Only new, unassigned identities may enter an employee's actionable customer list by default.
11. Duplicate or possible-duplicate candidates are recorded in `lead_run_results` for audit/provenance, but do not count toward the requested target count.
12. If unique new customers are below target, start a missing-count top-up run using a database-derived denylist.
13. Update `produced_unique_count`, set `status = completed` only after the required unique customer count is satisfied or a terminal shortage reason is recorded, and clear active lease.

Use `SKIP LOCKED` for queue workers if multiple server processes are later added. For the first single-dashboard-process implementation, row-level locks plus lease expiry are enough.

### 7.4 User Experience

Exact duplicate:

- Show `已有相同获客任务正在运行`.
- Default button: `只补充未分配客户`.
- Secondary copy: `为避免重复客户，本次只会写入未分配的新客户`.
- B may see the same coordination progress but receives only database-unique, unassigned customer rows.

Near duplicate:

- Show `已有相似获客任务正在运行，预计还需 N 分钟`.
- Choices:
  - `只看当前任务进度`
  - `只补充未分配客户`
  - `缩小条件并重新搜索`

Finished same scope within TTL:

- Do not reuse another employee's assigned customer rows.
- For a normal operator request, start a new executable run with the database denylist and the full requested new-customer count.
- For an internal auto top-up request, start a `top_up_unique_leads` run for exactly the missing count.

Queued due to global load:

- Show `排队中`.
- Display the number of active CBE tasks and an estimated start window when available.
- Do not start a second OpenClaw session to "beat the queue"; this must be enforced server-side.

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

### 7.6 Lead Result Reconciliation Correction

Live testing with two real operators exposed a product requirement that must override the earlier "reuse result pool" phrasing: the database is the final source of truth for customer uniqueness, and no two human employees should receive the same buyer/customer in their actionable lists. Pre-run `scope_similarity` is useful for avoiding obviously duplicated work, but it cannot predict subset overlaps such as:

- Zhang Haoxiang: `phone case + tempered glass screen protector / GB + US`
- Wu Sitong: `phone case / GB`

P2.5 must add a server-side pre-search denylist step before launching the employee and a reconciliation step between employee marker parsing and visible customer writes:

1. Before launching an executable Lead session, query existing tenant identity keys from the database and pass them into the prompt as `existing_identity_keys`.
2. The employee must avoid those identities in query generation, search-result review, and candidate dedupe before spending additional fetch work on known customers.
3. Normalize every returned lead by domain, email domain, company name, and country.
4. Query tenant-level `lead_identities`, `lead_candidates`, prior `lead_run_results`, and active/claimed allocations.
5. Classify each returned candidate as `new_unique`, `duplicate_same_owner`, `duplicate_other_operator`, `duplicate_team_or_tenant`, or `possible_duplicate`.
6. Write only `new_unique` candidates to the employee customer list by default.
7. Record duplicate and possible-duplicate candidates in `lead_run_results` with reason metadata for audit and debugging.
8. Compute `requested_target_count - new_unique_count` after reconciliation.
9. If the result is positive, create a top-up run for exactly the missing final unique customer count.
10. Pass all existing tenant identity keys plus the just-rejected duplicate identities into the top-up prompt as `existing_identity_keys`.
11. Show the operator a completion summary with returned, new unique, duplicate, possible duplicate, and top-up counts.

This correction means a completed Lead run is successful only when it has produced the requested number of database-unique, unassigned customers, or when it records a clear terminal shortage reason after top-up attempts. The old "reuse completed pool" action is removed from the runtime decision contract: completed scopes can provide denylist context only, not assigned customer rows.

## 8. P2.5 — Lead Reconciliation, Screening, And Accio Durable Workflows

### 8.0 Lead Result-Level DB Reconciliation

Status: Implemented and verified on 2026-06-21. This was the first P2.5 task before Screening fan-out. It closes the gap found during real two-operator testing: partially overlapping search scopes can return overlapping buyers even when pre-run `scope_similarity` does not trigger. It now performs two database-backed protections: pre-search tenant denylist context to reduce wasted search/fetch work, then completion-time reconciliation before visible customer writes.

Required behavior:

1. Treat `targetCount` as the number of database-unique, unassigned customers required for the current request. A normal repeated same-scope request keeps the full requested count; only internal auto top-up requests pass a missing-count remainder.
2. Do not expose or assign duplicate customers in the employee list, even when the duplicate belongs to the same employee.
3. Do not expose or assign another employee's existing customer to the current employee by "reusing" a completed pool.
4. Query the CBE database before hidden search starts and pass existing tenant identity keys to the employee as `existing_identity_keys`, using tenant-level `lead_identities`/`lead_candidates` as the pre-search exclusion source.
5. The employee must avoid those identities while generating queries, reviewing search results, and deduplicating candidates.
6. Query the CBE database again before candidate writes, using tenant-level `lead_identities`, `lead_candidates`, `lead_run_results`, and `lead_allocations` as the authoritative dedupe reference.
7. Record duplicate candidates in run result/audit tables, but do not count them as successful customer output.
8. If reconciliation leaves fewer unique new customers than requested for the current request, automatically create a top-up run for the missing count.
9. Use database-derived denylist context for top-up: domains, business email domains, normalized company-name/country keys, and already-covered search queries when available.
10. Update Employee task completion copy and Admin monitoring so they show returned candidates, newly assigned unique customers, duplicates skipped, possible duplicates, and top-up status.

The recommended first implementation can keep `lead_allocations` simple: a candidate becomes allocated when it is written into an employee's actionable customer list. A later manager workflow can add explicit transfer/share semantics, but the default path must keep ownership unique.

### 8.0.1 Google Maps + Web Search Source Redesign

Status: Implemented on 2026-06-21 as a read-only `cross-border-intel` MCP adapter plus Lead/Screening employee prompt and tool-policy updates. Google Maps calls remain server-side only and are not made from browser/client code.

Business reason:

- The current Lead route can find company websites through generic web search, but it misses many local downstream buyers whose public footprint is primarily a Google Maps profile: phone repair shops, mobile phone stores, electronics retailers, accessory stores, regional wholesalers, and small distributors.
- For this mobile-accessory exporter, those local businesses are valid sales targets if web evidence confirms they buy/sell phone cases, screen protectors, chargers, cables, holders, repair parts, or related products.
- Google Maps should therefore become a primary candidate-discovery source, paired with OpenClaw web search/fetch for independent verification.

Source responsibility split:

| Source | Primary job | Not allowed to decide alone |
|---|---|---|
| Google Maps Places Text/Nearby Search | Find candidate local/storefront businesses by query, geography, and place type. | Formal legal registry status, import history, or final customer assignment. |
| Google Maps Place Details | Enrich shortlisted place IDs with website, address, phone, business status, type, rating count, opening hours, and Maps URI using narrow field masks. For small local/offline companies, an `OPERATIONAL` place with a physical address can satisfy the first company-registration/authenticity score block. | Listed/public-company registry proof, legal ownership, trade evidence, financial risk, or long-term memory facts. |
| Google Geocoding / Address Validation | Support Nearby Search coordinates and public address consistency checks. | Legal ownership, trade evidence, financial evidence, or risk tier by itself. |
| OpenClaw `web_search` / `web_fetch` | Confirm company-owned website, product/category fit, contact page, B2B/wholesale/import/distribution language, and non-Maps public sources. | Login-gated/social/private data. |
| CBE database reconciliation | Decide whether a candidate is tenant-new, same-owner duplicate, other-operator duplicate, possible duplicate, or needs top-up. | External discovery. |

Target Google Maps adapter:

| Tool | Endpoint | Required input | Normalized output |
|---|---|---|---|
| `cbe_intel_google_places_search` | Places API (New) Text Search and optional Nearby Search | `text_query`, `country`, `city_or_region`, optional `location_bias`/`location_restriction`, `included_types`, `max_result_count`, `field_mask_profile` | Bounded candidate list with `google_place_id`, display name, formatted address, location, types, business status, Maps URI, query, field mask, fetched timestamp, provider status, attribution metadata, and ledger-ready call metadata. |
| `cbe_intel_google_place_details` | Places API (New) Place Details | `place_id`, `field_mask_profile`, `purpose=lead_discovery|screening` | Bounded details object with website URI, phones, address, business status, types, rating/user rating count, opening hours, Maps URI, fetched timestamp, provider status, field mask, attribution metadata, and ledger-ready call metadata. |
| `cbe_intel_google_geocode` | Geocoding API | `address`, optional `country`, `language_code`, `region_code`, `max_results` | Bounded geocode results for coordinate support, with redacted source URL and no raw response retention. |
| `cbe_intel_google_address_validate` | Address Validation API | `address_lines`, optional locality/region/postal fields | Bounded address-completeness, unresolved component, geocode, and business/residential metadata for public address consistency only. |

Default field-mask profiles:

| Profile | Endpoint | Fields |
|---|---|---|
| `lead_discovery_list` | Text/Nearby Search | `places.id`, `places.displayName`, `places.formattedAddress`, `places.location`, `places.types`, `places.businessStatus`, `places.googleMapsUri` |
| `lead_discovery_basic` | Place Details | `id`, `displayName`, `formattedAddress`, `nationalPhoneNumber`, `internationalPhoneNumber`, `websiteUri`, `businessStatus`, `types`, `rating`, `userRatingCount`, `regularOpeningHours`, `googleMapsUri` |
| `screening_local_presence` | Place Details | `id`, `displayName`, `formattedAddress`, `websiteUri`, `businessStatus`, `types`, `rating`, `userRatingCount`, `googleMapsUri`, `regularOpeningHours` |
| `screening_address_footprint` | Text Search + Place Details | Search fields from `lead_discovery_list`, then Details fields from `screening_local_presence` plus `nationalPhoneNumber` / `internationalPhoneNumber` for bounded phone-consistency matching. |
| `human_review_optional` | Place Details | Add `reviews`, `photos`, or `editorialSummary` only after explicit human-review need and policy-compliant display/storage review. |

Implemented Lead workflow:

1. Server computes the existing Lead `scope_hash` and tenant DB denylist before any external call.
2. Server builds Google Maps query families from products/personas/countries/city seeds.
3. Adapter runs Text Search first. Nearby Search is used only when the server has a reliable lat/lng city/market grid.
4. Server deduplicates by `google_place_id`, website domain, phone, and normalized company name + city/country.
5. Server calls Place Details only for shortlisted candidates up to request target + over-collection buffer.
6. Employee receives normalized Maps candidates plus denylist and web-search instructions.
7. Employee uses `web_search` / `web_fetch` to confirm official-site and product/category buyer fit.
8. Completion still runs the existing DB reconciliation/top-up path before visible customer writes.

Implemented Screening workflow:

1. If a Lead has `google_place_id`, Screening may refresh Place Details once per target using `screening_local_presence`.
2. If a manual target has only name/city/country and no website, Screening may run one Text Search to find a likely place match.
3. Maps evidence contributes to `public_footprint`, domain/website consistency, and the scale-aware first score block. For `small_local_offline` targets, an `OPERATIONAL` Google Maps place with a physical address can satisfy the 25% company-registration/authenticity block; for `listed_or_public` and `medium_large_registered` targets, Maps must be fused with registry/disclosure evidence rather than replacing it.
4. `CLOSED_PERMANENTLY` is a caution/blocker for active outreach unless web evidence shows relocation/rebrand.
5. No Maps result is neutral and should be shown as coverage gap, not risk.

Implemented Screening address-footprint enhancement:

1. For each target, Screening builds a company-address search plan from legal/brand names, country, city/region, website/domain, phone when available, and official-site location pages found through web search/fetch.
2. It runs bounded Google Places Text Search variants, deduplicates by place id/address/phone/domain/display name, and calls Place Details for shortlisted unique places under the configured Google Maps Details cap using `field_mask_profile="screening_address_footprint"`.
3. It calls Address Validation for unique formatted addresses under the configured address-validation cap.
4. It classifies every discovered place as `confirmed_company_location`, `probable_company_location`, `possible_related_location`, or `rejected_unrelated_location`; classifies address role as office/headquarters, storefront, warehouse/distribution, service/repair, or unknown business location.
5. The final Screening report includes a dedicated `address_footprint` object and a visually separate `Google Maps 地址版图` report section. This section shows summary counts, operational/closed counts, country/city coverage, capped-search limitations, and grouped address rows with Maps URI, formatted address, business status, website/domain, validation verdict, confidence, and match reason.
6. Every `address_footprint.locations[]` row is also written to `screening_address_locations`, linked to the report, target, optional Lead candidate, and agent run. `report_json` remains the full report snapshot, while the dedicated table supports later company-address management, filtering, dedupe review, and Admin/Employee lookup without JSON traversal.
7. Migration `006_screening_address_locations.sql` creates the dedicated table and backfills any existing `screening_reports.report_json.address_footprint.locations[]` rows so historical reports with this object are not stranded inside JSON only.
8. Address-footprint findings may support public footprint/domain/business-fit evidence and the scale-aware first score block. They never become formal legal registry/KYB, trade, financial, or Accio behavior proof.

Implemented scale-aware Screening scoring redesign, completed 2026-06-23:

1. Add a `company_scale_assessment` step before scoring: `listed_or_public`, `medium_large_registered`, `small_local_offline`, `small_online_only`, or `unknown_scale`.
2. Rename the first report block label from pure `公司注册` to `公司注册与线下门店/地址`; keep the JSON block id `legal_identity` unless a migration intentionally changes it.
3. Keep this first block at 25 points / 25% of the primary score explanation.
4. For listed/public and medium-large companies, fuse official registry/disclosure evidence with Google Maps address/local-presence evidence. Registry/disclosure remains primary; Maps adds address, website, phone, and operational consistency.
5. For small local/offline companies, allow Google Maps to satisfy the first block when at least one confirmed/probable place is `OPERATIONAL`, has a physical address, has plausible category/name/location match, and has no contradictory official-site/registry/web evidence.
6. Reports must phrase the small-company result as `线下经营真实性由 Google Maps 公开门店/地址证据支持`, not as formal legal registration or KYB proof.
7. Implementation updated the Screening prompt/skills, deterministic `cbe_intel_score_buyer` behavior, marker/report schema, report UI labels, live `cbe-buyer-screening` workspace files, and regression tests.

Database and policy impact:

- `lead_sources.source_type` and marker schemas support `google_maps_places`, `google_maps_geocoding`, and `google_maps_address_validation`.
- `source_snapshot_json` stores bounded metadata such as endpoint, field mask profile, place id, Maps URI, business status, fetched timestamp, and normalized fields used for dedupe.
- `screening_address_locations` stores normalized address rows from `address_footprint.locations[]` with `google_place_id`, formatted address, address type, relationship status, city/country, business status, Maps URI, validation JSON, confidence, and match reasons. It links to `screening_reports`, `screening_targets`, optional `lead_candidates`, and `agent_runs`; report/target deletion cascades address rows, while Lead/run deletion keeps the address history with null references.
- Do not store raw Google responses, review text, or photos long-term unless the implementation includes an explicit Google Maps Platform policy/attribution retention decision.
- MCP tool outputs include ledger-ready `api_call_ledger` metadata with endpoint, field-mask profile where applicable, request units, provider status, and cost posture. A downstream run with tenant/run context can persist those rows.
- `GOOGLE_MAPS_API_KEY` belongs in `~/.openclaw/.env` or secret injection only. It must be restricted to needed Maps APIs and server egress/IPs where possible.

Acceptance now covered:

- User approved Google Maps as the primary Lead acquisition source combined with web search.
- Docs and skills remain clear that Google Maps is not a formal registry/KYB authority, while the 2026-06-23 design now permits Maps to satisfy the first authenticity block for small local/offline companies.
- Adapter tests cover mocked Google responses, missing-key behavior, Text/Nearby/Details request shapes, quota/provider errors, field masks, source attribution, redacted query keys, and no browser-side key exposure.

### 8.1 Screening Execution Shape And API Scope

The 2026-06-20 final pressure report supersedes the earlier idea that Screening could safely accept a large batch in one AgentChat session. The production shape is:

1. A user may submit a batch of up to 10 targets from the UI.
2. The server creates one parent `agent_runs` row plus a `screening_batches` row.
3. The scheduler creates one child `agent_runs` row per target by default.
4. Each child run calls `cbe-buyer-screening` with exactly one company/domain/email target.
5. Parent progress is the aggregate of child runs; a failed child does not fail or rerun the entire batch.
6. Optional `batch3_experiment` may pack up to 3 targets only when `CBE_SCREENING_ALLOW_BATCH3=true`, paid checks are disabled or already budgeted, and global active load is low.
7. Batch sizes of 5 or 10 must not be sent as one Screening prompt in the production path.

The API source scope for each Screening child run is:

| Layer | Default API/source scope | Call rule |
|---|---|---|
| Registry / legal identity | GB Companies House API or official public page; US SEC only for public-company/SEC-filer checks; France/Japan/Korea/Brazil official APIs only after adapter/access proof; Germany/Spain/Italy/Mexico official web/manual routes or OpenCorporates fallback. | Use country-aware routing. Missing unsupported registry APIs are `unavailable_api` or `pending_human_input`, not fraud evidence. |
| Domain / email foundation | RDAP, MX, SPF, DMARC, free/disposable/role-inbox flags, and official-site same-domain contact-email discovery. | Always low-cost first. RDAP.org is low-volume only; high-volume production should move to IANA bootstrap RDAP or a budgeted WHOIS/RDAP provider. |
| Paid email validation | Abstract and Hunter email verifier only. | Call at most once per target, only when the operator enables paid validation and a supplied or official-site same-domain email exists. Do not paid-validate random third-party or free-provider emails discovered by search. |
| Public footprint | OpenClaw `web_search` and bounded `web_fetch` of public official pages returned by search or supplied by the operator. | Do not fetch protected/login-gated pages. Do not `web_fetch` Wikipedia for this workflow because the pressure report found it to be a reliable failure source in the sandbox. |
| Google Maps/local presence and address footprint | Google Maps Places Text Search/Place Details, Geocoding, and Address Validation through read-only MCP. | Use for storefront/local-business existence, office/store/warehouse/service-location discovery, website/address/phone consistency, category support, Nearby coordinates, and address consistency. For small local/offline companies, `OPERATIONAL` physical-address evidence can satisfy the first company-registration/authenticity score block. For listed/public or medium-large companies, Maps is fused with registry/disclosure evidence and does not replace formal registry/KYB evidence. |
| Trade/customs evidence | ImportYeti for current paid US import evidence profile; Volza only after the customer enables a paid plan and budget; public-web fallback when paid data is off. | Paid trade search is at most once per target with `max_records <= 5` and `max_paid_spend_usd <= CBE_SCREENING_TRADE_MAX_SPEND_USD_PER_TARGET`. |
| Financial/public filings | SEC summary fields, official annual reports found through public search, and registry filing history where available. | Do not load raw SEC `submissions` history into prompts or final markers; keep bounded summaries only. |
| Behavior evidence | Accio summaries, approved memory facts, or supplied sales notes. | Only applies when conversation/history exists. Cold leads keep this block `not_applicable`. |
| Alibaba/ICBU seller-owned data | `icbu-openapi` future read-only MCP after seller authorization/access proof. | Not part of the default P2.5 Screening path. Missing ICBU access is neutral. |
| Sales/enrichment/contact databases | Apollo, broad Hunter Domain Search/Finder, ImportGenius/Panjiva enterprise APIs, Surepass/Karza, and similar paid enrichment. | Out of default scope. Add only through a separate paid-source approval and budgeted adapter. |

Per-target prompt/tool contract:

- Registry and domain/email checks run before paid checks.
- Paid email validation and paid trade search each have a maximum of one call per target.
- SEC lookup reads only identity/listing/summary fields and must drop or summarize large filing history.
- Provider errors, 401/403/429, missing keys, disabled budgets, and unsupported countries are coverage states, not negative evidence.
- Every evidence-bearing result must carry `source_type`, `source_url`, `fetched_at`, confidence, provider/status, and cost/price posture where known.
- Every report should carry the dedicated `address_footprint` section when Google Maps is configured or a Maps lookup was attempted. If no address is found, the section should still show `coverage_status = "not_found"` or `unavailable_api` with a neutral coverage note.
- The child run should emit one `SCREEN_REPORTS_JSON_START` / `SCREEN_REPORTS_JSON_END` array containing exactly one report object. Marker recovery remains useful, but the child run should be treated as failed if no traceable source URL/timestamp can be recovered for evidence-bearing claims.

Implementation status, 2026-06-24:

- Multi-target Screening requests now create one parent `agent_runs` record, one `screening_batches` record, and one child `agent_runs` / `screening_batch_targets` pair per target.
- Child prompt payloads carry exactly one target. Production batch-5 and batch-10 prompts remain blocked; the old batch-3 path remains available only behind `CBE_SCREENING_ALLOW_BATCH3=true`.
- Child runs are admitted through the existing CBE workload coordinator. Children above the active cap remain `queued` with planned session keys instead of starting OpenClaw work immediately.
- `POST /api/client-demos/cross-border/employee/screening-runs/drain` claims queued Screening children with row locking, admission checks, leases, and aggregate parent refresh so queued work can start after earlier children finish.
- Ordinary Employee task lists hide silent child notifications and show the parent aggregate task; child completion/failure/cancellation updates the parent batch counts.
- Live OpenClaw validation on 2026-06-24 with operator `吴思彤` completed two real three-target bulk Screening runs. The second run ended with parent aggregate `total=3`, `completed=3`, `terminal=3`, and one saved report per child. A live-test bug where child-id aggregate refresh counted only one target was fixed by resolving the batch before aggregating all children.

### 8.2 Screening Persistence

When Screening completes:

1. Upsert or create `screening_targets`.
2. Insert `screening_reports`.
3. Insert `screening_evidence`.
4. Insert `screening_score_blocks`.
5. Update linked customer row status through the projection.
6. Add `api_call_ledger` rows for observed external calls where not already backfilled by `sentura-cost`.
7. Add an `audit_events` row with source count, data tier, and session key reference.

For fan-out batches:

- Each child run writes its own target/report/evidence/score blocks.
- The parent batch run stores aggregate counts: total, queued, running, completed, failed, retryable, paid calls used, and estimated/observed spend.
- Retrying a failed child must not rerun completed siblings.
- Parent notifications should link to the customer list with affected child target IDs, while detail drawers can show per-child evidence and failure reasons.

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
- Keep one target per Screening session by default; do not use batch-5 or batch-10 prompts in the production path.
- Keep paid email and paid trade calls idempotent per target. The scheduler/store should prevent repeated paid calls after a child run is retried unless the user explicitly approves a fresh paid lookup.
- Add more country registry adapters only after DB evidence model is stable.
- Add Alibaba internal-data evidence only after signed-seller API access is proven.

### 8.3 Accio Persistence And Memory Approval

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

Implementation status, 2026-06-24:

- Added migration `007_screening_retry_memory_approval.sql`.
- `screening_batch_targets` now stores per-target paid email/trade status, call counts, spend, retry count, last retry time, and re-approval actor/timestamp.
- Failed Screening child runs move previously available paid email/trade sources to `reapproval_required`; normal retry can rerun the child with paid sources disabled, and explicit re-approval reopens the paid source for that child only.
- The Employee customer task runner reads child `paid_source_policy` from the server and disables paid email/trade options before starting a hidden Screening child when re-approval is missing.
- Screening completion records observed paid email/trade evidence into per-target state and `api_call_ledger`.
- Accio memory facts can be reviewed through the typed store/API; approval changes `memory_facts.status` from `pending_review` to `approved`, stores reviewer metadata, and does not write raw chat text to vector memory.
- Accio-to-Screening handoffs are marked `accepted` when a Screening task starts from an Accio summary and `completed` when the Screening report is saved.

## 9. P2.6 — Multi-User, Backpressure, And Load Smoke

Initial limits from `DESIGN.md §9`, recalibrated by the 2026-06-19/20 cloud pressure reports:

| Workload | Initial limit |
|---|---:|
| Concurrent user web sessions | 50-80 |
| Active OpenClaw CBE sessions across all three employees | 24 soft / 32 hard on the current single-box pilot profile |
| Active Lead Discovery runs | 8-12 `find-10` sessions |
| Active Screening runs | 12 single-target child runs by default; batch-3 only behind feature flag; no batch-5/batch-10 production sessions |
| Active Accio imports | 3 files by default, 5 only after soak validation |
| Browser/Playwright tasks | 0 normally; max 1-2 for self-provisioning |
| Model calls | Provider quota minus 20% headroom |

Backpressure method:

- Add a small queue layer backed by `agent_runs.status = queued`.
- If active count exceeds the global or per-kind soft limit, create queued run and show `排队中`.
- Never exceed the hard active cap for normal customer traffic. A pressure-test profile may raise the cap only with explicit operator approval and a separate result label.
- Use a worker loop or route-triggered drain for first implementation.
- If multiple server processes are introduced, use PostgreSQL row locks and `SKIP LOCKED` for queue claiming.
- Respect provider/source rate limits separately from OpenClaw session slots. For example, throttle Companies House near 600 requests / 5 minutes, SEC under 10 requests / second with a valid User-Agent, and RDAP.org under 10 requests / 10 seconds or move to an IANA-bootstrap/paid RDAP provider for production volume.

Load smoke:

1. Seed 50 users under tenant `cross-border-ecommerce`.
2. Open or simulate 50 dashboard sessions.
3. Start 10 Lead `find-10` requests with 3 duplicate scopes and 2 near-duplicate scopes.
4. Start 5 Screening batches totaling at least 25 targets; verify they split into single-target child runs and queue above active limits.
5. Start 3 Accio imports with fixture payloads.
6. Run one controlled C=40/48 pressure profile after the queue is implemented; verify excess tasks queue instead of causing Gateway RSS threshold failures.
7. Assert:
   - exact duplicate Lead scopes launch one OpenClaw session only;
   - joined users receive shared progress;
   - same lead identity is not duplicated in the tenant pool;
   - no production Screening path sends 5 or 10 targets to one `cbe-buyer-screening` session;
   - a 10-target Screening request creates one parent task and 10 child target runs;
   - child failures are retryable without rerunning successful siblings;
   - task notifications appear for the correct user;
   - API cost ledger rows are tenant/user/agent-run attributable;
   - paid email and trade calls are capped to one each per target unless explicitly re-approved;
   - p95 dashboard API latency is recorded;
   - provider throttling produces coverage gaps, retryable child failures, or queued status, not crashes.

Implementation status, 2026-06-24:

- Added `scripts/test-cross-border-phase2-load-smoke.ts` for CE23. Static checks validate the P2.6 plan/runbook/backup-drill contract. Live PostgreSQL checks create and clean up 50 temporary operators, simulate 50 Dashboard sessions through the typed tenant context, create 10 Lead `find-10` requests with exact/near duplicate scopes, create 5 Screening batches with 25 single-target child runs, create 3 Accio imports, run a DB-only C=48 soft-cap pressure probe, and run a separate DB-only 32-active hard-guard probe.
- The CE23 live smoke intentionally does not start real OpenClaw AgentChat sessions or external provider/API calls. It validates DB queue/admission behavior, cost/audit attribution, p95 context/API latency recording, and retryable Screening child behavior without spending model/API budget.
- Added `scripts/cross-border-phase2-backup-restore-drill.sh`, which requires `CBE_DATABASE_URL` plus a separate disposable `CBE_RESTORE_DATABASE_URL`, runs `pg_dump --format=custom`, restores with `pg_restore --clean --if-exists`, then verifies migrations and Phase 2 store checks against the restored database.
- Added `P2.6-LOAD-SMOKE-RUNBOOK.md` with commands, expected results, backup/restore safety guards, result labels, and the production-readiness checklist.
- The backup/restore drill supports `CBE_POSTGRES_CLIENT_IMAGE` for environments without matching local PostgreSQL client tools. The local drill was run with `postgres:18` against disposable `sentura_cbe_restore_drill`; `pg_dump` / `pg_restore` completed and restored Phase 2 store checks passed 238/238.
- Dashboard production build passed locally with the new CE22/P2.5 + CE23/P2.6 routes. Browser smoke verified the Employee `记忆整理` approval flow: a synthetic Accio memory record loaded from the DB, the report showed `仅预览`, `批准写入` PATCH succeeded, status changed to `已批准`, and the temporary record was removed.
- Local DB-only readiness is now labeled `db_only_preflight_passed` after the store/concurrency/type/build/load-smoke and local backup/restore checks pass. Do not use `production_go_live_ready` until the same load-smoke profile passes on the target deployment, the target restore drill passes against a disposable restore database, and provider quota/source-rate headroom is explicitly confirmed.

## 10. Implementation File Plan

Expected new or changed files:

```text
sentura/lib/cross-border-store/
  migrations/001_initial_schema.sql
  migrations/002_lead_scope_coordinator.sql
  migrations/004_workload_queue_and_screening_fanout.sql
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
  workload-queue.ts
  screening.ts
  screening-batches.ts
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
scripts/test-cross-border-phase2-load-smoke.ts
scripts/cross-border-phase2-backup-restore-drill.sh
scripts/test-cross-border-agents.ts
docs/TESTS.md
docs/tests/tests-cross-border-phase2.md
跨境电商/P2.6-LOAD-SMOKE-RUNBOOK.md
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
| CE21 — P2.4 workload coordinator and Lead dedupe | `scripts/test-cross-border-phase2-concurrency.ts` | PASS 2026-06-21; rechecked 2026-06-24 with 46/46 live/static coverage including the new Screening fan-out probe, parent-not-prematurely-completed check, and saved-report completion-count check. Global active-task soft/hard caps queue excess work; two exact same-scope Lead requests create one active OpenClaw run and two memberships; near duplicates offer choices; completed scopes no longer reuse assigned rows; normal repeated same-scope requests keep the full current-request new-customer target; every executable Lead run carries tenant DB pre-search denylist; explicit top-up denylist and completion-time DB duplicate skipping work. |
| CE22 — P2.5 Lead reconciliation, Screening fan-out/API scope, and Accio durable workflow | Store tests + Browser + MCP tests | Lead completion reconciles returned candidates against the DB before visible writes, skips duplicate same-owner/other-operator/team/tenant customers, records duplicate reasons, top-ups missing unique counts, and updates UI/Admin summaries; multi-target Screening requests create one parent task and single-target child runs; route-triggered drain claims queued children with leases and aggregate parent refresh; Employee completion messages count backend-saved Screening reports; no production batch-5/batch-10 Screening session starts. Live OpenClaw validation completed two real three-target bulk Screening runs under operator `吴思彤`. Paid email/trade retry state, explicit re-approval, retry recovery, Accio approval-to-memory, and durable Screening handoff consumption are implemented and covered by live PostgreSQL store checks. |
| CE23 — P2.6 load smoke | `scripts/test-cross-border-phase2-load-smoke.ts` + backup/restore drill + staged run | Static contract checks plus live DB-only smoke cover 50 sessions, 10 Lead `find-10` requests, 5 Screening batches split into 25 child runs, 3 Accio imports, 24/32/48 active-task behavior, p95 API latency, and cost/audit metadata. `scripts/cross-border-phase2-backup-restore-drill.sh` verifies `pg_dump`/`pg_restore` plus restored-store checks; the local disposable restore drill and Dashboard production build passed on 2026-06-24. Local DB-only preflight can be labeled `db_only_preflight_passed`; `production_go_live_ready` still requires target-deployment smoke, target restore drill, and provider quota/source-rate confirmation. |

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

After P2.6 load-smoke implementation:

```bash
pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts
set -a; source sentura/dashboard/.env.local; set +a
pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts --require-db --report outputs/cbe-phase2-load-smoke-report.json
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
5. A 10-target Screening submission never becomes one batch-10 AgentChat session; it creates a parent task and single-target child runs, with optional batch-3 only behind an explicit feature flag.
6. Screening reports persist all evidence and score blocks with source URLs/timestamps.
7. Paid Screening email and trade checks are capped per target, visible in cost/audit records, and not repeated on retry unless the user explicitly approves a fresh paid lookup.
8. Active CBE tasks above the soft limit become queued, and normal traffic never exceeds the hard active cap for the current deployment profile.
9. Accio raw uploads are stored outside vector memory; only approved concise memory facts can be promoted.
10. Every employee run has `tenant_id`, `user_id`, `agent_id`, `session_key`, `status`, timestamps, cost references, and audit references.
11. Failed runs are visible and retryable with real backend errors where available.
12. API calls are visible through `sentura-cost` and/or `api_call_ledger` without fabricating spend.
13. Typecheck, build, CBE static checks, store tests, coordinator tests, and MCP tests pass.

## 13. Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Local dev lacks Docker/sandbox runtime for true live E2E | Keep employees configured as `sandbox.mode: "non-main"`; use static/store/coordinator tests locally and run true E2E on an environment with Docker/Podman/OrbStack, or use a clearly labeled temporary sandbox-off local override only with explicit approval. |
| Coordinator starts AgentChat before acquiring lease | Enforce transaction-first start order and test exact duplicate submissions. |
| DB writes leak raw Accio chats into vector memory | Store raw files separately; persist redacted text/hash rows; require memory-fact approval before vector write. |
| External provider costs are incomplete | Keep observed calls visible; mark free/included/unpriced accurately; do not invent USD for account-plan services. |
| Google Maps API usage grows faster than expected | Use field masks, Text/Nearby Search before Details, per-run caps, no default reviews/photos, and `api_call_ledger` cost attribution before customer-wide rollout. |
| Google Maps data is treated as official KYB evidence | Keep Maps evidence framed as public local-presence/offline-existence evidence. It can support the scale-aware first `公司注册与线下门店/地址` block for small local/offline companies, but official registry, KYB ownership, trade, financial, and Accio behavior conclusions remain separate evidence lanes. |
| Google Maps caching/attribution policy is violated | Store only policy-reviewed bounded metadata, preserve Maps URI/source attribution, and avoid raw review/photo/response retention unless implementation documents compliance. |
| Long Screening context causes model timeout again | Default to one target per Screening session, block batch-5/batch-10 in production, keep MCP outputs bounded, store partial evidence, and surface backend errors directly in `agent_runs`. |
| Retry accidentally repeats paid email/trade calls | Store per-target paid-call state and require explicit re-approval before a retry can call Abstract/Hunter/ImportYeti/Volza again. |
| 48-style pressure trips Gateway RSS threshold | Queue above the 24 soft cap and do not exceed the 32 hard cap until a C=40/48 pressure profile and soak test pass on the target deployment. |
| UI becomes too technical for sales users | Keep technical IDs in detail drawers; visible labels remain Simplified Chinese business wording. |

## 14. Immediate Next Task

P2.1-P2.6 are complete for the local production-shaped pilot preflight path. The remaining production gate is target-environment evidence, not local implementation:

1. Run the P2.6 load-smoke profile on the actual target deployment with Dashboard/Gateway processes and approved provider quotas.
2. Run the backup/restore drill against a disposable restore database in the target environment.
3. Record provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS behavior before applying `production_go_live_ready`.
