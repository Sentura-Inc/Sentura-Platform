> **On-demand reference — not read by default.**
>
> Back-link: [`docs/TESTS.md`](../TESTS.md)

# Cross-Border E-Commerce Phase 2 Tests

Detailed test cases for Phase 2 of the mobile-accessory Cross-border e-commerce / 跨境电商 independent client pilot. Use this file for production persistence, customer `admin`/`operator` monitoring, typed store/API routes, DB-backed Employee state, Lead coordination, durable Screening/Accio workflows, and load-smoke tests. Phase 1/MVP tests remain in [`tests-cross-border-ecommerce.md`](tests-cross-border-ecommerce.md) as historical and regression coverage.

## CE17 — Cross-Border Phase 2 Execution Plan

Status: PASS (2026-06-16; rechecked 2026-06-17; report-driven concurrency/API-scope design updated 2026-06-21; Google Maps + web-search source route implemented 2026-06-21; Dashboard Lead timeout/runtime env fix verified 2026-06-21; Screening Google Maps address-footprint report path and dedicated address table implemented 2026-06-22; scale-aware Google Maps first-block scoring implemented and verified 2026-06-23)

Scope:

- `跨境电商/PHASE-2.md`
- `跨境电商/DESIGN.md`
- `跨境电商/SCREENING.md`
- `跨境电商/API_KEYS_OPENCLAW_SETUP.md`
- `sentura/agents/cbe-buyer-screening/config.json5`
- `sentura/agents/cbe-buyer-screening/TOOLS.md`
- `sentura/agents/cbe-buyer-screening/skills/*/SKILL.md`
- `sentura/mcp-servers/cross-border-intel/README.md`
- `README.md`
- `AGENTS.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`

Validation method:

```bash
test -s 跨境电商/PHASE-2.md
rg -n 'PHASE-2.md|CE17|Phase 2|phase-2.md|tests-cross-border-phase2' README.md AGENTS.md 跨境电商/DESIGN.md docs/TESTS.md docs/tests/tests-cross-border-phase2.md docs/MEMORY.md docs/memory/cross-border-ecommerce/phase-2.md
git diff --check
```

Latest recheck, 2026-06-17:

- Static CE18 script: 64/64 PASS without `CBE_DATABASE_URL`.
- Live PostgreSQL CE18 script: 74/74 PASS against `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`.
- Migration runner `--seed`: PASS; migrations `001_initial_schema.sql` and `002_lead_scope_coordinator.sql` skipped as already applied; seed summary `seededUsers=3`, `adminProfiles=1`, `operatorProfiles=2`.
- Focused strict NodeNext compile for P2.1 files: PASS.
- Dashboard focused lint for `src/lib/cross-border-store/index.ts`: PASS.
- Dashboard full `pnpm exec tsc --noEmit`: PASS.
- Legacy CBE regression `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.
- DB probes: migrations `001/002`, roles `admin=1` and `operator=2`, three projection views, and invalid `platform_admin` CBE role rejected by constraint.
- Secret hygiene over migration/seed/source ID files: PASS.
- Repo hygiene: `git diff --check` PASS and no `RULES.md` / `CONTEXT.md` files found outside pruned dependency/git directories.

| # | Check | Method | Expected |
|---|---|---|---|
| CE17.1 | On-demand banner | Static review | `PHASE-2.md` starts with the standard `On-demand reference — not read by default` banner and links back to `DESIGN.md`. |
| CE17.2 | Existing-doc grounding | Manual review | The plan explicitly maps decisions from `DESIGN.md`, `UI.md`, `MARKET_ACQUISITION.md`, `SCREENING.md`, `MEMORY_PROCESSING.md`, `docs/TESTS.md`, and `docs/MEMORY.md`. |
| CE17.3 | Runtime boundary | Manual review | The plan preserves OpenClaw as the agent runtime and Sentura as control plane; it forbids custom runtime/Gateway/Docker wrappers, direct LLM provider calls, and raw SQL access for employees. |
| CE17.4 | Phase-2 goals | Manual review | The plan defines production persistence, typed store, DB-backed Employee UI state, Lead coordinator, durable Screening/Accio records, agent contract tuning, and multi-user/load-smoke coverage. |
| CE17.5 | Execution order | Manual review | The plan orders work as DB foundation, typed store/routes, UI migration, Lead coordinator, Screening/Accio durable workflows, and load smoke. |
| CE17.6 | Business DB schema | Manual review | The plan includes tenant/user/run, Lead, Screening, Accio, handoff, memory-fact, API ledger, audit, and Lead coordinator tables with minimum indexes. |
| CE17.7 | Store and route boundary | Manual review | The plan defines typed store modules and Next.js App Router route handlers that validate employee marker JSON before DB writes. |
| CE17.8 | LocalStorage migration | Manual review | The plan makes DB the source of truth for customers, tasks, reports, notifications, memory rows, and handoffs while keeping localStorage only for drafts/cache. |
| CE17.9 | Lead coordinator design | Manual review | The plan defines `scope_hash`, leases, memberships, shared result pool, near-duplicate choices, top-up-only mode, and `existing_identity_keys` denylist. |
| CE17.10 | Screening durability | Manual review | The plan persists targets, reports, evidence, score blocks, cost/audit rows, and failure codes without erasing prior good reports. |
| CE17.11 | Accio durability and memory approval | Manual review | The plan stores raw uploads outside vector memory, persists redacted/hash-only messages, writes summaries and handoffs, and requires approval before memory facts become approved. |
| CE17.12 | Backpressure/load smoke | Manual review | The plan uses the existing 30-50 user concurrency targets and describes queued `agent_runs`, row locks/leases, duplicate-run tests, and staged load-smoke expectations. |
| CE17.13 | Test roadmap | Manual review | The plan defines CE18-CE22 implementation-test targets and minimum commands for each implementation slice. |
| CE17.14 | Documentation sync | Static review | README, AGENTS, `DESIGN.md`, `docs/TESTS.md`, and memory files all link to or record the Phase 2 plan. |
| CE17.15 | Customer-specific user levels | Manual review | `PHASE-2.md` defines only two customer-facing CBE product roles, `operator` and `admin`, and explicitly avoids exposing the full Sentura platform role model in this client UI. |
| CE17.16 | Ordinary-user product surface | Manual review | The plan and `UI.md` state that the existing `个人中心`, `获客与背调`, and `记忆整理` pages are the ordinary-user surface for starting Lead/Screening/Accio work and viewing own/shared records. |
| CE17.17 | Admin monitoring boundary | Manual review | Admin is a customer-side supervisor role with read-mostly monitoring over live tasks, aggregate lead/screening lists, per-user lists, per-agent usage, statistics, costs, and failures; it cannot create AI employees or edit prompts/tools/model/provider/OpenClaw config. |
| CE17.18 | Monitoring database design | Manual review | The schema includes `cbe_user_profiles` with `admin`/`operator`, `agent_runs` target/stage fields, `agent_run_activity_events`, and owner/team/visibility fields for Lead, Screening, Accio, handoff, and memory records. |
| CE17.19 | Admin monitoring route planning | Static review | `PHASE-2.md` includes planned Admin monitoring route handlers and page files for `overview`, `live-tasks`, `customers`, `operators`, `operators/[id]`, and `agent-usage`. |
| CE17.20 | Report-driven workload baseline | Manual review | `PHASE-2.md` incorporates the supplied final pressure reports: Lead `find-10` remains one session, Screening batch-10 is blocked, Screening default is single-target fan-out, and the current single-box pilot envelope is 24 soft / 32 hard active OpenClaw sessions. |
| CE17.21 | Workload coordinator config | Static/manual review | `PHASE-2.md` defines target P2.4/P2.5 settings for global active-task caps, Lead active runs, Screening execution mode, batch-3 feature flag, paid email/trade per-target caps, Accio active imports, provider headroom, and queue leases. |
| CE17.22 | Screening fan-out data model | Manual review | `PHASE-2.md` adds planned queue/fan-out schema for parent `agent_runs`, queue claim fields, `screening_batches`, and `screening_batch_targets`; retries do not rerun completed siblings. |
| CE17.23 | Screening API scope | Static/manual review | `SCREENING.md` and the Screening workspace docs restrict default API scope to read-only public/official/paid-budgeted sources, defer Alibaba/ICBU and sales-enrichment APIs, cap paid email/trade calls once per target, and treat missing/denied providers as coverage gaps. |
| CE17.24 | Screening employee config alignment | Static review | `sentura/agents/cbe-buyer-screening/config.json5`, `TOOLS.md`, and related skills state `single_target_fanout`, `maxTargetsPerSession=1`, batch-5+ block, batch-3 feature flag, and per-target paid call caps without granting mutation tools. |
| CE17.25 | P2.6 load-smoke recalibration | Manual review | `PHASE-2.md` updates load smoke to 50 sessions, 10 Lead `find-10` requests, Screening batches split into child runs, 3 Accio imports, and a controlled C=40/48 queue validation rather than unbounded active-session starts. |
| CE17.26 | Country-aware API runbook | Static/manual review | `API_KEYS_OPENCLAW_SETUP.md`, `SCREENING.md`, `registry-verification/SKILL.md`, and `cross-border-intel/README.md` distinguish implemented GB/US/RDAP/email/trade/OpenCorporates routes from planned France/Japan/Korea/Brazil/Italy adapters and Germany/Spain/Mexico official-page/manual routes; registration steps are documented without adding unimplemented env vars to MCP setup. |
| CE17.27 | Google Maps + web-search source route | Static/manual review + mocked MCP tests | `MARKET_ACQUISITION.md`, `SCREENING.md`, `DESIGN.md`, `PHASE-2.md`, `API_KEYS_OPENCLAW_SETUP.md`, and `cross-border-intel/README.md` make Google Maps Places + OpenClaw web search the implemented primary acquisition/backcheck route while preserving OpenClaw runtime boundaries; Google Maps is documented as discovery/local-presence/address-consistency evidence and, after CE17.29, as allowed first-block authenticity support for small local/offline companies, but never as formal registry/KYB/legal ownership proof; `GOOGLE_MAPS_API_KEY` remains server-side/secret-only current MCP capability with setup env references; field-mask profiles, attribution/caching guardrails, request caps, ledger-ready metadata, mocked adapter tests, and no browser-side key exposure are covered. |
| CE17.28 | Screening Google Maps address-footprint report path | Static/manual review + regression tests | `SCREENING.md`, `PHASE-2.md`, `DESIGN.md`, `cbe-buyer-screening` skills, `cross-border-intel`, Dashboard marker normalization, store schemas, completion writes, `screening_address_locations`, and shared report UI require Screening to run bounded multi-query Google Places discovery for company-related offices/stores/warehouses/service locations, dedupe and classify address candidates, validate addresses where possible, persist normalized address rows, and render a dedicated `Google Maps 地址版图` / `address_footprint` report section that is visually separate from ordinary evidence and does not act as legal/KYB proof. |
| CE17.29 | Scale-aware Google Maps first-block scoring redesign | Static/manual review + runtime regression | `SCREENING.md`, `PHASE-2.md`, `DESIGN.md`, `cbe-buyer-screening` skills, `cross-border-intel`, Dashboard marker/store schemas, hidden runner normalization, shared report UI, legacy Screening page, and regression scripts implement the new first 25% block as `公司注册与线下门店/地址`, require company scale assessment before scoring, fuse registry/disclosure + Google Maps for listed/medium-large companies, and allow small local/offline companies to satisfy the first block through an `OPERATIONAL` Google Maps physical address when registry APIs cannot match them; docs and UI clearly state this is sales-screening authenticity evidence, not formal KYB/legal ownership proof. |

## CE18 — Phase 2 P2.1 Business Database Foundation

Status: PASS (2026-06-16)

Scope:

- `sentura/lib/cross-border-store/migrations/001_initial_schema.sql`
- `sentura/lib/cross-border-store/migrations/002_lead_scope_coordinator.sql`
- `sentura/lib/cross-border-store/db.ts`
- `sentura/lib/cross-border-store/ids.ts`
- `sentura/lib/cross-border-store/migrate.ts`
- `sentura/lib/cross-border-store/schemas.ts`
- `sentura/lib/cross-border-store/seed.ts`
- `sentura/lib/cross-border-store/index.ts`
- `sentura/dashboard/src/lib/cross-border-store/index.ts`
- `scripts/test-cross-border-phase2-store.ts`
- `package.json`
- `pnpm-lock.yaml`
- `sentura/lib/package.json`
- `sentura/lib/tsconfig.json`

Validation commands:

```bash
pnpm exec tsx scripts/test-cross-border-phase2-store.ts
CBE_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sentura_cbe_dev" pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db
CBE_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sentura_cbe_dev" pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed
sentura/dashboard/node_modules/.bin/tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck sentura/lib/cross-border-store/*.ts scripts/test-cross-border-phase2-store.ts sentura/dashboard/src/lib/cross-border-store/index.ts
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store/index.ts
pnpm exec tsx scripts/test-cross-border-agents.ts
git diff --check
```

| # | Check | Method | Expected |
|---|---|---|---|
| CE18.1 | Migration files exist | `scripts/test-cross-border-phase2-store.ts` | `001_initial_schema.sql` and `002_lead_scope_coordinator.sql` exist under `sentura/lib/cross-border-store/migrations/` with ordered numeric names. |
| CE18.2 | Core tenant/user/profile schema | Static/live DB check | Migrations create `tenants`, `sentura_users`, and `cbe_user_profiles`, with CBE product roles limited to `admin` and `operator`. |
| CE18.3 | Agent-run monitoring schema | Static/live DB check | `agent_runs` stores tenant/user/owner, visibility, agent id, session key, status, task kind, target summary, stage, timestamps, model/cost, and error fields. |
| CE18.4 | Activity-event monitoring schema | Static/live DB check | `agent_run_activity_events` records operator, Agent, task kind, target record/summary, stage, event type, tool/source, status, timestamp, and metadata for Admin live-task monitoring. |
| CE18.5 | Lead persistence schema | Static/live DB check | Lead tables cover `lead_runs`, `lead_candidates`, `lead_sources`, owner/team/visibility fields, matched products JSON, dedupe keys, and source metadata. |
| CE18.6 | Screening persistence schema | Static/live DB check | Screening tables cover targets, reports, evidence, score blocks, dedicated Google Maps address locations, risk tier, normalized score, evidence coverage, recommended action, and report JSON. |
| CE18.7 | Accio persistence schema | Static/live DB check | Accio tables cover imports, conversations, redacted/hash-only messages, summaries, source file hash, storage key, validation status, and behavior summary JSON. |
| CE18.8 | Handoff/memory/cost/audit schema | Static/live DB check | `handoff_events`, `memory_facts`, `api_call_ledger`, and `audit_events` exist with tenant scope and structured JSON payload fields. |
| CE18.9 | Lead coordinator schema | Static/live DB check | `lead_discovery_scopes`, `lead_run_memberships`, `lead_identities`, `lead_run_results`, and `lead_allocations` exist with scope hash, lease, identity, membership, result, and allocation fields. |
| CE18.10 | Index coverage | Static/live DB check | Required indexes exist for lead domain uniqueness, Screening lookups/latest report, Screening address report/target/place/country/domain lookup, Accio lookup, cost/audit rollups, run status, active scopes, profile role, owner scopes, and activity monitoring. |
| CE18.11 | Projection views | Static/live DB check | `cbe_customer_work_items`, `cbe_operator_workload_daily`, and `cbe_agent_usage_daily` exist for Employee/Admin read projections. |
| CE18.12 | Config boundary | Static check | `db.ts` requires `CBE_DATABASE_URL` and tells callers to use environment/secret injection rather than committed credentials. |
| CE18.13 | Migration runner | Static/live DB check | Runner creates migration history, uses a transaction, records checksums, rejects changed applied migrations, and re-runs as no-op. |
| CE18.14 | Seed records | Static/live DB check | Seed creates tenant `cross-border-ecommerce`, one admin profile, and at least two operator profiles without storing emails, raw tokens, or credentials. |
| CE18.15 | Dashboard boundary placeholder | Static check | Dashboard `src/lib/cross-border-store/index.ts` exposes CBE product role and Admin/ordinary-user module constants without giving employees raw SQL access. |
| CE18.16 | Live local PostgreSQL migration | `--require-db` command | On the local `sentura_cbe_dev` database, migrations apply successfully, seed succeeds, rerun is a no-op, and required tables/views/indexes/profiles are present. |
| CE18.17 | Activity write probe | `--require-db` command | A rollback-scoped insert into `agent_runs` plus `agent_run_activity_events` succeeds, proving the monitoring FK path is writable without leaving test rows. |
| CE18.18 | Type/lint compatibility | Commands above | New store files compile under strict NodeNext settings; dashboard typecheck and focused lint pass. Existing full `sentura/lib` typecheck remains blocked by pre-existing `.ts` import-extension settings outside the new store files. |
| CE18.19 | Legacy CBE suite preserved | `pnpm exec tsx scripts/test-cross-border-agents.ts` | Existing CE4-CE7/CE16 checks remain green at 335/335 after adding P2.1 files. |
| CE18.20 | Secret hygiene | Static check | Migration and seed files do not embed connection strings, passwords, API keys, app secrets, bearer tokens, email addresses, or raw user tokens. |

## CE19 — Phase 2 P2.2 Typed Dashboard Store And Route Boundaries

Status: PASS (2026-06-17)

Scope:

- Employee customer/task/memory read route handlers.
- Lead/Screening/Accio start and completion route handlers.
- Validated Lead marker writes to `lead_runs`, `lead_candidates`, `lead_sources`, and `lead_identities`.
- Validated Screening marker writes to `screening_targets`, `screening_reports`, `screening_evidence`, and `screening_score_blocks`.
- Validated Accio import/summary writes to `accio_imports`, `accio_conversations`, redacted/hash-only `accio_messages`, `accio_summaries`, `memory_facts(status=pending_review)`, and `handoff_events`.
- Parse/validation failure path that marks `agent_runs.status = failed` with `error_code = marker_parse_failed` and writes audit metadata.
- Admin read-only monitoring endpoints for overview, live tasks, customers, operators, operator detail, and Agent usage.

Scope boundary:

- This is P2.2 server-side persistence and route-boundary work only.
- P2.3 still needs to migrate the actual Employee React pages/store off `localStorage`; until then, UI state can still be client-persisted.

Primary files:

- `sentura/dashboard/src/lib/cross-border-store/db.ts`
- `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
- `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`
- `sentura/dashboard/src/lib/cross-border-store/agent-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/customers.ts`
- `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/screening.ts`
- `sentura/dashboard/src/lib/cross-border-store/accio.ts`
- `sentura/dashboard/src/lib/cross-border-store/tasks.ts`
- `sentura/dashboard/src/lib/cross-border-store/notifications.ts`
- `sentura/dashboard/src/lib/cross-border-store/admin.ts`
- `sentura/dashboard/src/lib/cross-border-store/audit.ts`
- `sentura/dashboard/src/lib/cross-border-store/api-ledger.ts`
- `sentura/dashboard/src/lib/cross-border-store/handoffs.ts`
- `sentura/dashboard/src/lib/cross-border-store/route-utils.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/**/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/**/route.ts`
- `scripts/test-cross-border-phase2-store.ts`
- `sentura/dashboard/package.json`
- `pnpm-lock.yaml`

Validation commands:

```bash
env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts
CBE_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sentura_cbe_dev" pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store src/app/api/client-demos/cross-border/employee src/app/api/client-demos/cross-border/admin
cd sentura/dashboard && pnpm build
pnpm exec tsx scripts/test-cross-border-agents.ts
git diff --check
```

Latest verification, 2026-06-17:

- Static Phase 2 store script: 109/109 PASS without `CBE_DATABASE_URL`.
- Live PostgreSQL Phase 2 store script: 129/129 PASS against local `sentura_cbe_dev`; live probe created and cleaned up Lead, Screening, Accio, memory fact, handoff, task, and marker-failure records.
- Dashboard `pnpm exec tsc --noEmit`: PASS.
- Focused Dashboard ESLint over new store/routes: PASS.
- Dashboard `pnpm build`: PASS; Next route manifest includes all new Employee/Admin API routes.
- Legacy CBE regression: `pnpm exec tsx scripts/test-cross-border-agents.ts` PASS, 335/335.

| # | Check | Method | Expected |
|---|---|---|---|
| CE19.1 | Store module layout | Static script | Dashboard has typed modules for DB, schemas, tenant context, customers, Lead, Screening, Accio, tasks, notifications, admin, audit, API ledger, handoffs, and route utilities. |
| CE19.2 | Route surface | Static script + Next build | Employee and Admin App Router `route.ts` files exist under the planned P2.2 paths and build as dynamic Node.js routes. |
| CE19.3 | Tenant context | Static/live store check | Requests resolve seeded `cbe_user_profiles`; operators get own/shared scope and admin routes require `cbeRole = admin`. |
| CE19.4 | Validation boundary | Static/live store check | Completion routes use Zod `safeParse`; evidence-bearing Lead/Screening marker payloads require source URLs and fetched timestamps. |
| CE19.5 | No raw SQL for employees | Static script | Employee route handlers call typed store functions and do not embed SQL in completion route files. |
| CE19.6 | Lead completion write | Live store check | A validated Lead marker payload writes a Lead run, candidate, source evidence, identity/result linkage, task activity, and audit rows. |
| CE19.7 | Customer read projection | Live store check | The Employee customer read projection returns the newly saved Lead candidate through server-side row filtering. |
| CE19.8 | Screening completion write | Live store check | A validated Screening marker payload writes target, report, evidence, score block, task activity, and audit rows. |
| CE19.9 | Accio import write | Live store check | An Accio import stores hash/redacted-message records only, not raw chat text. |
| CE19.10 | Accio summary write | Live store check | A validated Accio summary creates summaries, pending-review memory facts, Screening handoff events, task activity, and audit rows. |
| CE19.11 | Task/notification projection | Live store check | Employee task reads return completed probe runs; marker failure path returns a failed run with `marker_parse_failed`. |
| CE19.12 | Admin monitoring reads | Static/build check | Overview, live-task, customer, operator, operator-detail, and agent-usage routes are read-only and require admin context. |
| CE19.13 | Dashboard dependencies | Static/build check | Dashboard package explicitly declares `pg`, `zod`, and `@types/pg` for server-side store compilation. |
| CE19.14 | Legacy regression | `scripts/test-cross-border-agents.ts` | Existing Phase 1/Employee hidden runner checks remain green at 335/335. |
| CE19.15 | Production build | `cd sentura/dashboard && pnpm build` | Next build compiles and lists the new Employee/Admin API route handlers. |

## CE20 — Employee DB-Backed UI Migration

Status: PASS (2026-06-17; customer-list UX/list polish rechecked 2026-06-18)

Scope implemented:

| ID | Area | Method | Assertion |
|---|---|---|---|
| CE20.1 | Client API adapter | Static script | `employee-api.ts` calls the P2.2 Employee read/write routes for customers, tasks, memory, notifications, Lead, Screening, Accio, and task failure. |
| CE20.2 | Typed response mappers | Static script | API records are mapped into existing UI `CustomerListItem`, `MemoryRecordItem`, and task types without making DB rows a browser-side persistence source. |
| CE20.3 | Store persistence boundary | Static script | `use-cbe-employee-store` persists only `draftCache`; customer rows, memory rows, and task rows are set from API reads. |
| CE20.4 | Demo seed boundary | Static script | Demo seed rows are gated by `NEXT_PUBLIC_CBE_USE_DEMO_SEED=1` or `CBE_USE_DEMO_SEED=1`. |
| CE20.5 | Employee home hydration | Static script + Browser | `个人中心` fetches customer, memory, and task projections from Employee APIs and renders the current DB-backed state. |
| CE20.6 | Customer page hydration | Static script + Browser | `获客与背调` fetches customer/task projections from Employee APIs and trims selection to DB-returned rows. |
| CE20.7 | Memory page hydration | Static script + Browser | `记忆整理` fetches memory/task projections from Employee APIs; import/analyze flows refresh DB-backed memory records after writes. |
| CE20.8 | Lead run lifecycle | Static/live store check | Lead submissions create a DB run before hidden session start, complete through the validated endpoint after marker parsing, and refresh customers/tasks. |
| CE20.9 | Screening run lifecycle | Static/live store check | Screening submissions create a DB run before hidden session start, complete through the validated endpoint after marker parsing, and refresh customers/tasks. |
| CE20.10 | Accio run lifecycle | Static/live store check | Accio import/analyze creates a DB import/run, sends hash/redacted summaries to completion, and refreshes memory/tasks. |
| CE20.11 | Failure lifecycle | Static/live store check | Gateway/model/marker failures call the task failure endpoint with stable error codes and terminal `agent_runs.status = failed`. |
| CE20.12 | Notification center | Static script + Browser | The global notification center polls DB-backed terminal task projections and marks unread notifications through the API. |
| CE20.13 | Projection detail fields | Static/live store check | Customer and Accio read projections expose report/source/memory fields required by existing drawers and cards. |
| CE20.14 | Browser render check | Browser | `/client-demos/cross-border/employee`, `/employee/customers`, and `/employee/memory` render without runtime error or console error against local `sentura_cbe_dev`; empty DB lists show expected empty states. |
| CE20.15 | Live DB inspection runbook | Static script + live SQL execution | `scripts/inspect-cross-border-live-db.sql` uses real physical columns and joins/JSON projection for website/company/source fields; it avoids stale table-only columns such as `lead_candidates.agent_run_id`, `lead_sources.finding`, and `screening_reports.company_name`. |
| CE20.16 | Customer list simplification | Static script + Browser | `获客与背调` keeps the existing primary row information, lightens status row backgrounds, removes row-level delete buttons while retaining top `删除所选`, merges score sorting into one `评分排序` select, and shows business score labels such as `优先跟进`, `谨慎跟进`, `暂缓/高风险`, with `证据不足` gray. |
| CE20.17 | Task-completion row highlight | Static script + Browser | Completed Lead/Screening task notifications link to `/employee/customers?highlightTask=...`; the customer page maps task IDs through affected customer IDs or lead/screening run IDs, clears filters as needed, scrolls to visible affected rows, and flashes a light-blue outline for 3 seconds. |
| CE20.18 | Customer list compact polish | Static script + Browser | Product overflow chips such as `+1` expand the row in place to show the complete product list and can collapse with `收起`; row `新找到` badges are removed; screened rows show a green `✅` instead of a persistent `已完成` badge; `找到时间` displays as Beijing `YYYY-MM-DD HH:mm:ss` without ISO `T`/`Z`. |
| CE20.19 | Message/task dismissal polish | Static script + Browser | The message center dialog closes on outside pointer click, completed task-status banners persist local and DB dismiss state, and closing a terminal banner prevents older completed banners from replacing it after route switching. |
| CE20.20 | Screening budget estimate | Static script | Background-check estimated price is itemized from configured unit assumptions for OpenAI model tokens, Tavily search, optional Abstract/Hunter email checks, and optional paid trade-data budget rather than a fixed demo per-target value. |
| CE20.21 | Manager report-window parity | Focused lint/typecheck + Browser | Manager `查看报告` actions use the shared Employee `CustomerReportDialog` only, the report overlay is portaled outside the Manager employee-detail dialog so it is not clipped, report sections and top metrics are visible, `X` closes the report, and outside-overlay click closes only the report while leaving the Manager detail dialog open. |
| CE20.22 | Manager login parity | Typecheck + Static script + HTTP smoke | Manager has `/client-demos/cross-border/admin/login` using the same logo/card/input/button layout as the Employee login page, submits `cbeRole: "admin"`, preset admin `孙总/1234` signs an `admin` session, wrong password returns 401, Manager APIs default to cookie session rather than a hardcoded admin header, and the seeded admin profile can self-heal from the old preset row. |
| CE20.23 | Employee/Manager login kickout fix | Typecheck + Static script + HTTP/browser smoke | Employee and Manager sessions use role-scoped cookies (`sentura_cbe_employee_session`, `sentura_cbe_admin_session`) with legacy same-role fallback only; AppShell calls `/session?role=operator` or `/session?role=admin`; Admin cookies are rejected by Employee checks, Employee cookies are rejected by Admin checks, combined cookies keep both platforms active, and persistent UI state reads `localStorage` after mount to avoid first-render hydration mismatch. |

Verification:

- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 127/127 static checks.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147 static + live PostgreSQL checks.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 353/353 legacy CBE checks after adding customer-list polish, Screening budget, message-center outside-click, and task-dismissal guards.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- Focused Dashboard ESLint for Employee pages/components/store/API/store modules: PASS.
- `cd sentura/dashboard && pnpm build`: PASS; route manifest includes `employee/tasks/[id]/fail`.
- Browser validation against `http://localhost:3000/client-demos/cross-border/employee`, `/employee/customers`, and `/employee/memory`: PASS, no console errors.
- Browser validation on 2026-06-18 against `/employee/customers`: PASS, `评分排序` select present, one top `删除所选`, zero row-level delete buttons, 10 visible customer rows, and no console errors.
- Browser validation on 2026-06-18 against `/employee/customers?highlightTask=run_4d25b516-78d7-438f-9bb4-578a88e22127`: PASS, five visible screening rows flashed, the located notice appeared during the flash, and highlight classes cleared after 3 seconds.
- Browser validation on 2026-06-18 against `/employee/customers`: PASS, 15 visible customer rows, product `+1` expanded in place with `收起`, found times rendered as Beijing `YYYY-MM-DD HH:mm:ss` with no ISO markers, no `新找到` badge, screened rows showed `✅`, task banner close stayed dismissed after route switching, and browser console had no errors.
- Browser validation on 2026-06-18 against the global message center: PASS, message dialog opened with `aria-expanded=true`, outside click closed it and reset `aria-expanded=false`, and browser console had no errors.
- Browser validation on 2026-06-19 against `/admin/employees`: PASS, Lin Yue -> Currys `查看报告` opened the shared report window with visible top metrics, `背调结论`, `评分维度拆解`, `证据明细`, and `客户概览`; the report was not nested inside Manager `DialogContent`, was fully inside a 1440x1000 viewport, `X` closed it, outside-overlay click closed only the report, and browser console had no warnings/errors.
- 2026-06-19 Manager login verification: `pnpm --dir sentura/dashboard exec tsc --noEmit` PASS; `pnpm exec tsx scripts/test-cross-border-phase2-store.ts` PASS, 172/172; `pnpm exec tsx scripts/test-cross-border-agents.ts` PASS, 389/389; `POST /api/auth/login` with `孙总/1234` returned 200, `displayName=孙总`, `cbeRole=admin`, and `redirectTo=/client-demos/cross-border/admin/employees`; wrong password returned 401; cookie-authenticated `/session` returned `孙总/admin`; cookie-authenticated `/admin/operators` returned 200.
- 2026-06-19 Employee/Manager login-kickout verification: `pnpm --dir sentura/dashboard exec tsc --noEmit` PASS; `node_modules/.bin/tsx scripts/test-cross-border-phase2-store.ts` PASS, 174/174; `node_modules/.bin/tsx scripts/test-cross-border-agents.ts` PASS, 392/392; `POST /api/auth/login` with `孙总/1234/admin` returned 200 and wrote legacy + admin role cookies; HTTP smoke confirmed Admin cookie accepts only `role=admin`, Employee cookie accepts only `role=operator`, and combined cookies keep both role session endpoints at 200; browser smoke submitted Manager login, reached `/admin/employees`, had no Next overlay/console errors, visiting Employee without an Employee cookie correctly redirected to Employee login, and returning to Manager kept the Manager session active.
- Manual code review tightened Lead/Screening marker normalization so missing traceable source URLs enter the failure path instead of writing placeholder evidence URLs.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev node <inline pg runner for scripts/inspect-cross-border-live-db.sql>`: PASS, inspection query file runs against the live DB without missing-column errors. The documented user-facing command remains `psql ... -f scripts/inspect-cross-border-live-db.sql`.

Notes:

- P2.3 still starts one DB run per submission. P2.4 must add exact/near-duplicate Lead Discovery coordination before launching `cbe-lead-discovery`.
- The local PostgreSQL seed used for Browser validation had no customer/memory/task rows, so the expected UI state was a DB-backed empty list, not demo fixture rows.
- Manual DB inspection should use `scripts/inspect-cross-border-live-db.sql` or the Employee API projections. The physical tables intentionally do not duplicate every UI field as a same-named column.

## CE21 — Workload Coordinator And Lead Coordinator Concurrency

Status: PASS (2026-06-21)

Scope:

- `sentura/lib/cross-border-store/migrations/005_workload_queue_and_screening_batches.sql`
- `sentura/dashboard/src/lib/cross-border-store/workload-coordinator.ts`
- `sentura/dashboard/src/lib/cross-border-store/agent-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/screening.ts`
- `sentura/dashboard/src/lib/cross-border-store/accio.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`
- `sentura/agents/cbe-lead-discovery/AGENTS.md`
- `sentura/agents/cbe-lead-discovery/skills/lead-query-generation/SKILL.md`
- `sentura/agents/cbe-lead-discovery/skills/lead-deduplication/SKILL.md`
- `scripts/test-cross-border-phase2-concurrency.ts`
- `scripts/test-cross-border-phase2-store.ts`

Validation commands:

```bash
pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts
CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db
pnpm exec tsx scripts/test-cross-border-phase2-store.ts
CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db
pnpm exec tsx scripts/test-cross-border-agents.ts
pnpm --dir sentura/dashboard exec tsc --noEmit
CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm --dir sentura/dashboard build
git diff --check
find . -path './node_modules' -prune -o -path './openclaw/node_modules' -prune -o -path './.git' -prune -o \( -name RULES.md -o -name CONTEXT.md \) -print
```

Assertions:

| # | Check | Method | Expected |
|---|---|---|---|
| CE21.1 | Queue schema | Static/live DB check | Migration `005_workload_queue_and_screening_batches.sql` adds `agent_runs.parent_agent_run_id`, `queue_priority`, `queued_at`, `lease_owner`, and `lease_until`. |
| CE21.2 | Queue indexes | Static/live DB check | `agent_runs_queue_claim_idx` and `agent_runs_active_session_idx` exist. |
| CE21.3 | Screening fan-out preparation | Static/live DB check | `screening_batches` and `screening_batch_targets` tables exist for P2.5 parent/child runs. |
| CE21.4 | Config contract | Static review | Workload settings read `CBE_TASK_MAX_ACTIVE_TOTAL=24`, `CBE_TASK_MAX_ACTIVE_TOTAL_HARD=32`, `CBE_LEAD_MAX_ACTIVE_RUNS=12`, Screening/Accio caps, and queue lease env values on the server side. |
| CE21.5 | Tenant admission lock | Static review | Workload admission uses a tenant-scoped PostgreSQL advisory transaction lock before counting active sessions. |
| CE21.6 | Active-session counting | Static/live check | Active load counts only `running`/`polling` rows with non-null `session_key`, so joined business records do not inflate OpenClaw session caps. |
| CE21.7 | Soft cap queueing | Live PostgreSQL check | With 24 active CBE sessions, a new Lead request creates a queued `agent_run` with no `session_key` and `coordinatorDecision.workloadStatus = "queued"`. |
| CE21.8 | Lead scope fingerprint | Static review | Lead coordinator computes a canonical JSON scope and `sha256:` hash excluding user id and target count. |
| CE21.9 | Exact duplicate join | Live PostgreSQL check | Two exact same-scope Lead requests create one active `agent_run`, two `lead_runs`, and two `lead_run_memberships`; the second response is `join_existing`. |
| CE21.10 | Near duplicate choices | Live PostgreSQL check | Similar active scopes with score >= 0.75 return `offer_near_duplicate_choices` and no new `agent_run`. |
| CE21.11 | Completed scope no-reuse | Live PostgreSQL check | A same-scope normal request after a completed run returns `start_new_run`, carries prior identity keys in the denylist, and asks for the full requested new-customer count instead of reusing or copying assigned rows. |
| CE21.12 | Explicit top-up denylist | Live PostgreSQL check | An internal `run_mode = "top_up_unique_leads"` request after a short completed run returns `queue_top_up`, includes existing identity keys, and creates a top-up `lead_run` for the missing count only. |
| CE21.13 | Lead completion DB reconciliation | Static/live check | Completed Lead runs pre-check the tenant DB before writing visible candidates, skip same/other-operator duplicates, record `items_produced`, `duplicate_leads`, `top_up_needed`, `missing_count`, `existing_identity_keys`, and release the scope active lease. |
| CE21.14 | Lead pre-search DB denylist | Live PostgreSQL check | A brand-new executable Lead run queries tenant DB identities before hidden search starts and returns prior customer identity keys on `coordinatorDecision.denylist`, so the prompt can avoid already-found customers before spending search/fetch work. |
| CE21.15 | Screening batch block | Static check | Production `createScreeningRun` calls `assertScreeningSessionShape` before `insertAgentRun`, blocking multi-target single-session runs unless explicitly feature-flagged. |
| CE21.16 | Employee start gating and auto top-up | Static/typecheck | Employee Lead/Screening/Accio UI does not call hidden OpenClaw runner for queued, joined, or near-duplicate responses; executable Lead runs pass DB pre-search denylist into the hidden prompt, and Lead completion uses DB reconciliation to automatically launch bounded top-up rounds when unique saved customers are below the current request target. |
| CE21.17 | Lead strict-target prompt | Static review | Hidden Lead prompt and Lead workspace skills support `run_mode = "top_up_unique_leads"`, `existing_identity_keys`, `already_covered_queries`, pre-search exclusion of tenant DB identities in every run mode, strict `target_count` net-new output semantics, over-collection before dedupe, and search-result evidence fallback when `web_fetch` is blocked. |
| CE21.18 | Existing regression coverage | Automated scripts | Store static checks are 211/211; live store checks are 238/238; CBE agent checks are 410/410; Dashboard typecheck/build and repo hygiene pass. |

Latest verification, 2026-06-21:

- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21 static checks.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 38/38 static + live PostgreSQL checks after the strict new-customer target update.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 184/184.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 204/204.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 403/403.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm --dir sentura/dashboard build`: PASS. Build still prints the existing Next workspace-root warning caused by multiple lockfiles.
- `git diff --check`: PASS.
- Forbidden workspace file scan for `RULES.md`/`CONTEXT.md`: PASS, no output.
- Dashboard Lead timeout recovery recheck: PASS. Static checks cover Gateway client `timeoutMs` propagation, recoverable `sendChatMessage` timeout transcript polling, final transcript grace, and setup reading project `.env` plus `~/.openclaw/.env` before writing MCP env references.
- Real Google Places smoke against the configured API key: PASS, HTTP 200 with `status="found"`, one candidate, `place_id`, and `google_maps_uri`; no raw key or full provider response was printed.
- Dashboard Lead target-count submit recheck: PASS. The inspected live run called Google Maps successfully but carried `target_count=3` in both prompt and `lead_runs`, so the UI now snapshots the current numeric input ref at submit time and displays the target in the summary/button.

## CE22 — Lead Reconciliation, Google Maps Source Redesign, Screening Fan-Out/API Scope, And Accio Durable Workflow

Status: PASS — Lead result-level DB reconciliation/top-up PASS 2026-06-21; Google Maps + web-search MCP/source route PASS 2026-06-21; Screening address-footprint implementation PASS 2026-06-22; scale-aware Google Maps first-block scoring implementation PASS 2026-06-23; Screening parent/child fan-out and route-triggered queued-child drain PASS 2026-06-24; paid retry state, explicit re-approval, Accio approval-to-memory, and durable Screening handoff consumption PASS 2026-06-24.

Implemented Lead scope:

- Lead completion uses the database as the source of truth before visible customer writes.
- Returned Lead candidates are normalized by domain/identity key before visible writes.
- Duplicate candidates already owned by the same employee or another employee are not written into the requesting employee's actionable customer list.
- Duplicate candidates are recorded in `lead_run_results` with reason metadata for audit/provenance.
- Before every executable Lead search, the coordinator retrieves tenant DB identity keys and passes them into the hidden employee as `existing_identity_keys`; a normal repeated request still asks for the full requested new-customer count, and if reconciliation still produces fewer unique new customers than requested, the Employee UI starts bounded top-up rounds for the missing count using the expanded database-derived denylist.
- Employee task completion summaries show returned candidates, new unique customers, duplicates skipped, missing count, and top-up status.

Implemented Google Maps source route:

- `cross-border-intel` implements Google Maps Places Text Search, Nearby Search, Place Details, Geocoding, and Address Validation with field-mask profiles, request caps, attribution/caching guardrails, provider-status handling, key redaction, and ledger-ready `api_call_ledger` metadata without exposing `GOOGLE_MAPS_API_KEY` to browser/client/prompt code.
- Lead Discovery defaults to Google Maps Places candidate discovery plus OpenClaw `web_search` / `web_fetch` official-site/product-fit validation; web-only search remains fallback when Maps is unavailable.
- Screening can refresh one Place Details lookup per target, run one Text Search for manual storefront targets lacking a website, and validate public addresses for local-presence evidence. After the 2026-06-23 design, Maps can also support the first authenticity block for small local/offline companies, while still never acting as formal registry/KYB/legal ownership proof.
- Screening now discovers all bounded Google Maps address-footprint candidates for a company, classifies office/store/warehouse/service locations, validates unique addresses where possible, normalizes/persists `address_footprint`, writes every location to `screening_address_locations`, and renders a dedicated `Google Maps 地址版图` report section with summary counts, capped-search limitations, Maps URIs, validation verdicts, confidence, and match reasons.

Implemented scale-aware Screening scoring checks:

- `company_scale_assessment` is present before scoring and classifies targets as `listed_or_public`, `medium_large_registered`, `small_local_offline`, `small_online_only`, or `unknown_scale`.
- The first score block is displayed as `公司注册与线下门店/地址`, remains 25 points, and is explained as the first 25% authenticity block.
- For listed/public or medium-large companies, the scoring path fuses official registry/disclosure evidence with Google Maps address/local-presence consistency and does not allow Maps alone to claim formal registration.
- For small local/offline companies, one confirmed/probable `OPERATIONAL` Google Maps Place with physical address, plausible category/name/location match, and no contradictory official/web evidence can score the first block as real-company/offline-existence evidence.
- Report wording distinguishes `线下经营真实性由 Google Maps 公开门店/地址证据支持` from formal legal/KYB registration proof.
- Regression coverage now checks that MCP scoring carries `company_scale_assessment`, Dashboard store schemas preserve it in `report_json`, hidden and legacy Screening prompts require it, report labels render `公司注册与线下门店/地址`, and live workspace files contain the small-local/offline Maps first-block rule. Future behavior fixtures should still add concrete end-to-end examples for: small shop no registry API match but operational Maps address earns first-block credit; listed/public company with Maps but no registry/disclosure match does not earn full first-block credit; closed Maps location triggers caution; online-only small company does not get penalized solely for missing Maps.

Implemented Screening fan-out/drain checks:

- `POST /api/client-demos/cross-border/employee/screening-runs` accepts `targets` plus planned `child_session_keys` for multi-target Screening requests.
- Multi-target requests create one parent `agent_runs` row, one `screening_batches` row, one pre-created `screening_targets` row per target, one child `agent_runs` row per target, and one `screening_batch_targets` row per child.
- Each child run prompt carries exactly one target. Production batch-5 and batch-10 prompts remain blocked; batch-3 remains only behind `CBE_SCREENING_ALLOW_BATCH3=true`.
- Child rows use `parent_agent_run_id`, `child_target_json`, planned session keys, and `notification_silent` metadata so ordinary task lists show the parent aggregate rather than noisy child notifications.
- `POST /api/client-demos/cross-border/employee/screening-runs/drain` claims queued child rows with `FOR UPDATE SKIP LOCKED`, admission checks, leases, running session keys, activity events, and parent aggregate refresh.
- Child completion/failure/cancellation updates `screening_batch_targets` and refreshes parent aggregate counts so completed, failed, cancelled, queued, and running children remain durable.
- Employee bulk Screening execution now starts the parent task, runs claimed single-target children, fails individual child runs when marker/runtime errors occur, and drains another queued wave after each child wave completes.
- Parent aggregate refresh first resolves the batch id before counting all batch targets, so one terminal child cannot prematurely mark the parent completed. Employee completion messages use the backend-saved `reports.length`, not only the hidden runner's local marker count.

Implemented paid retry and durable Accio/Screening workflow checks:

- `007_screening_retry_memory_approval.sql` adds per-target paid email/trade status, call counts, spend, retry timestamps, memory review metadata, and handoff consumption timestamps.
- Failed Screening children move available paid email/trade lookups to `reapproval_required`.
- `POST /api/client-demos/cross-border/employee/screening-runs/[id]/retry` can rerun a failed child without rerunning completed siblings. Normal retry disables paid email/trade sources; explicit re-approval reopens paid lookup for that child only.
- Employee hidden Screening execution applies child `paid_source_policy` before building the child prompt, so stale UI paid options cannot repeat a paid lookup without server approval.
- Screening completion records observed paid email/trade evidence into per-target state and `api_call_ledger`.
- `PATCH /api/client-demos/cross-border/employee/memory/facts` approves or rejects pending Accio memory facts with reviewer metadata; it does not write raw chat text to vector memory.
- Accio-to-Screening handoffs are marked `accepted` on Screening task creation and `completed` when a report is saved for the Accio summary target.

Latest verification, 2026-06-24:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 211/211.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 238/238 static + live PostgreSQL checks. The live probe verifies memory approval, Accio handoff accepted/completed transitions, and paid retry disabling paid sources without explicit re-approval.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 46/46 static + live PostgreSQL checks. The live probe creates a three-target Screening batch with an active-target cap of 1, verifies parent/child rows, queued excess children, one-child failure, parent remains running after one terminal child, drain claim of one queued child, aggregate counts, and completion-count source checks.
- Browser smoke against `http://localhost:3000/client-demos/cross-border/employee/memory`: PASS. A synthetic Accio memory record loaded from the DB, the report dialog showed `仅预览`, `PATCH /api/client-demos/cross-border/employee/memory/facts` completed through the `批准写入` action, the UI changed to `已批准`, and the temporary record was removed.
- Live OpenClaw/Dashboard validation with operator `吴思彤`: PASS. Two real three-target bulk Screening submissions split into one parent plus three child sessions, updated six customer scores/reports, showed no production batch-5/batch-10 single-session path, and the second run finished with parent aggregate `total=3/completed=3/terminal=3`.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 410/410 after aligning current UI/cost/status assertions and adding concrete searched-source evidence-gap wording for RDAP/DNS/contact email plus trade/customs/SEC/financial sources.

Previous verification, 2026-06-23:

- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 24/24.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 410/410.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 195/195.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 217/217 static + live PostgreSQL checks, including `screening_address_locations` write/read and store-schema acceptance of scale-aware report JSON.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- Minimal real Google Places API (New) smoke with configured `GOOGLE_MAPS_API_KEY`: PASS, HTTP 200, one candidate, place id present, Maps URI present, `business_status="OPERATIONAL"`; key and full provider response were not printed.
- `git diff --check`: PASS before documentation updates.
- Live `~/.openclaw/workspace/cbe-buyer-screening` sync check: `AGENTS.md`, `BOOTSTRAP.md`, `TOOLS.md`, `evidence-collection`, `buyer-scoring`, and `report-writing` match source; no `RULES.md` / `CONTEXT.md`.

Latest verification, 2026-06-22:

- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 23/23.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 406/406.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 194/194.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216 static + live PostgreSQL checks, including true `saveScreeningReports` write/read of `screening_address_locations` and typed `listScreeningAddressLocations` retrieval.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS, applied `006_screening_address_locations.sql`.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `bash -n scripts/sentura-setup.sh`: PASS.
- `git diff --check`: PASS.
- Live `~/.openclaw/workspace/cbe-buyer-screening` sync check: `TOOLS.md`, `evidence-collection`, `report-writing`, and `buyer-scoring` match source; top-level markdown files remain exactly the 8 OpenClaw-native files; no `RULES.md` / `CONTEXT.md`.
- Browser smoke: started Dashboard dev server, logged into Manager as `孙总/1234`, opened 吴思彤's employee detail, and opened the KIKO shared report dialog with no browser console errors. The historical KIKO report predates this implementation and therefore did not contain `address_footprint`; the next live Screening run should verify populated `Google Maps 地址版图` rows.

Remaining scope:

- Default Screening API scope stays read-only and source/budget-gated.
- Country-aware registry routing is documented and tested as a static contract before any new country adapter is exposed to agents.
- Target-deployment smoke and provider quota checks belong to CE23/P2.6, not CE22.

## CE23 — Load Smoke

Status: PASS for local DB-only preflight — executable DB-only smoke tooling is implemented; CE22 prerequisites, local backup/restore drill, Dashboard production build, and Browser memory-approval smoke are complete. Full `production_go_live_ready` still requires target-deployment smoke, target restore drill, and provider quota/source-rate confirmation.

Primary files:

- `scripts/test-cross-border-phase2-load-smoke.ts`
- `scripts/cross-border-phase2-backup-restore-drill.sh`
- `跨境电商/P2.6-LOAD-SMOKE-RUNBOOK.md`

Commands:

```bash
pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts

set -a
source sentura/dashboard/.env.local
set +a
pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts --require-db --report outputs/cbe-phase2-load-smoke-report.json

export CBE_RESTORE_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sentura_cbe_restore_drill"
# Optional when local pg_dump/pg_restore are unavailable or older than the source server:
# export CBE_POSTGRES_CLIENT_IMAGE="postgres:18"
bash scripts/cross-border-phase2-backup-restore-drill.sh
```

Test cases:

| ID | Area | Method | Expected |
|---|---|---|---|
| CE23.1 | Static P2.6 plan contract | Static script | `PHASE-2.md` includes the 50-session, 10 Lead request, 5 Screening batch / 25 target, 3 Accio import, C=40/48 pressure, p95 latency, cost/audit, DB-only preflight, and target-deployment go-live boundary clauses. |
| CE23.2 | Workload cap defaults | Static script | `workload-coordinator.ts` keeps 24 soft / 32 hard global active defaults, 12 Screening active child target cap, and 3 Accio active import cap. |
| CE23.3 | Runbook and result labels | Static script | `P2.6-LOAD-SMOKE-RUNBOOK.md` documents static, DB-only, `db_only_preflight_passed`, target-deployment, provider-soak, and `production_go_live_ready` labels, and reserves `production_go_live_ready` for the target checklist. |
| CE23.4 | Backup/restore drill guard | Static script | `scripts/cross-border-phase2-backup-restore-drill.sh` requires `CBE_DATABASE_URL` and separate `CBE_RESTORE_DATABASE_URL`, refuses identical source/restore URLs, and requires a restore/drill target unless explicitly overridden. |
| CE23.5 | Backup/restore commands | Static script + live drill | The drill uses `pg_dump --format=custom --no-owner --no-privileges`, restores with `pg_restore --clean --if-exists --no-owner --no-privileges`, supports `CBE_POSTGRES_CLIENT_IMAGE` for matching Docker client tools, then runs migration seed and Phase 2 store checks against the restored database. Local run PASS 2026-06-24 with `postgres:18` and restored-store checks 238/238. |
| CE23.6 | 50-user/session smoke | Live PostgreSQL DB-only smoke | The script seeds 50 temporary `operator` users/profiles, resolves 50 tenant contexts through the Employee API path, records p95 context/API latency, and cleans the probe users afterward. |
| CE23.7 | Lead duplicate load shape | Live PostgreSQL DB-only smoke | 10 Lead `find-10` requests produce 5 active OpenClaw session records after 3 exact duplicate joins and 2 near-duplicate choice responses. |
| CE23.8 | Screening fan-out load shape | Live PostgreSQL DB-only smoke | 5 Screening batches create 5 parent runs and 25 child runs; every child has `target_count = 1`, parents have no OpenClaw session key, 12 children run under the active-target cap, and at least 13 children queue. |
| CE23.9 | Screening child retry/drain | Live PostgreSQL DB-only smoke | Failing one running child marks it retryable and allows a queued sibling to be claimed without rerunning successful siblings. |
| CE23.10 | Accio import cap | Live PostgreSQL DB-only smoke | 3 Accio imports with redacted fixture messages are admitted under the default active import cap. |
| CE23.11 | C=48 soft-cap pressure | Live PostgreSQL DB-only smoke | Additional DB-only pressure requests keep active sessions at 24 and queue excess work rather than starting more hidden sessions. |
| CE23.12 | 32 hard-cap guard | Live PostgreSQL DB-only smoke | A labeled DB-only hard-guard probe at 32 active slots queues a new request with `workload_admission.reason = "global_hard_cap"`. |
| CE23.13 | Cost/audit/load-smoke records | Live PostgreSQL DB-only smoke | `api_call_ledger` probe rows are attributable to `agent_run_id`; an `audit_events` row records p95 latency, DB-only label, and `go_live_readiness = "db_only_preflight_passed"`. |

Latest verification, 2026-06-24:

- `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`: PASS, 16/16 static checks.
- `set -a; source sentura/dashboard/.env.local; set +a; CBE_BACKUP_RESTORE_DRILL_PASSED=1 pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts --require-db --report outputs/cbe-phase2-load-smoke-report.json`: PASS, 48/48 static + live PostgreSQL DB-only smoke checks.
- `scripts/cross-border-phase2-backup-restore-drill.sh`: PASS against disposable local `sentura_cbe_restore_drill` using `CBE_POSTGRES_CLIENT_IMAGE=postgres:18`; restored migration seed skipped existing migrations and restored Phase 2 store checks passed 238/238.
- `pnpm --dir sentura/dashboard build`: PASS; route manifest includes `employee/memory/facts` and `employee/screening-runs/[id]/retry`.
- `outputs/cbe-phase2-load-smoke-report.json` records `go_live_readiness = "db_only_preflight_passed"` and `backup_restore_drill = "passed"`.
- `git diff --check`: PASS after final documentation/handoff updates.

Boundary:

- CE23 DB-only smoke does not start real OpenClaw sessions and does not call paid or external providers.
- Target-deployment load smoke and `production_go_live_ready` are separate from the local DB-only preflight and require the target Dashboard/Gateway, target disposable restore database, and provider/source-rate quota confirmation.

## CE24 — Accio Manual Memory Import Formats

Status: PASS — `agent-memory` branch merged into `ecommerce` and integrated with Phase 2 DB/store/UI boundaries on 2026-06-24.

Scope:

- `memory-import-normalizer.ts` supports JSON, pasted text, and screenshot import preparation for Employee `记忆整理`.
- The Dashboard Gateway client forwards image attachments through OpenClaw-compatible `chat.send` payloads.
- The hidden Accio task runner batches screenshot preflight transcription turns before requesting the final structured memory summary.
- `008_accio_manual_import_formats.sql` adds source/input/attachment metadata to `accio_imports`.
- Employee `记忆整理` exposes JSON/text/image modes. Screenshot raw images are not persisted and cannot be replayed from DB.

Primary files:

- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/memory-import-normalizer.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/lib/gateway/{types.ts,client.ts,index.ts}`
- `sentura/dashboard/src/lib/cross-border-store/{schemas.ts,accio.ts}`
- `sentura/lib/cross-border-store/migrations/008_accio_manual_import_formats.sql`
- `scripts/test-cross-border-phase2-store.ts`
- `scripts/test-cross-border-agents.ts`

Commands:

```bash
pnpm --dir sentura/dashboard exec tsc --noEmit
pnpm exec tsx scripts/test-cross-border-phase2-store.ts
pnpm exec tsx scripts/test-cross-border-agents.ts
git diff --check
```

Test cases:

| ID | Area | Method | Expected |
|---|---|---|---|
| CE24.1 | Import normalizer contract | Static script + typecheck | JSON import preserves parsed Accio export structure; pasted text becomes a line/message-based export; image import validates image MIME/size, computes attachment hashes, and keeps base64 only in browser/task state. |
| CE24.2 | Gateway attachment contract | Static script + local OpenClaw source review | `GatewayChatAttachment` supports OpenClaw `source: { type: "base64", media_type, data }`, and `sendChat`/`sendChatMessage` forward `attachments` without changing existing text-only calls. |
| CE24.3 | Screenshot preflight transcription | Static script | The Accio runner splits image attachments into bounded preflight batches, waits for batch markers, then sends the final summary prompt with transcript context instead of storing raw screenshots. |
| CE24.4 | Source/input metadata persistence | Static store script | `accio_imports` stores `source_kind`, `input_format`, and `attachment_metadata_json`; typed store/API projections return the metadata on imports, memory records, and analysis payloads. |
| CE24.5 | Employee UI modes | Static script + typecheck | `记忆整理` presents JSON upload, pasted text, and screenshot upload modes with matching import/analyze actions and source labels. |
| CE24.6 | Screenshot no-replay boundary | Static script | Screenshot mode cannot use import-only storage; queued/no-session screenshot analysis is failed immediately because raw images are intentionally not persisted; stored image-format records cannot be directly re-analyzed from DB. |
| CE24.7 | Chinese operator-ready summary prompt | Static script | Accio prompts require Chinese operator-ready deal summaries, product/price context, follow-up fields, and explicit distinction between unit price and total price. |
| CE24.8 | Regression commands | Automated scripts | Dashboard typecheck, Phase 2 store static checks, broad CBE static checks, and whitespace checks pass after the merge. |

Latest verification, 2026-06-24:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 416/416.
- `git diff --check`: PASS.

Boundary:

- CE24 does not add a direct Alibaba International Station API integration. It only broadens manual Accio intake sources while preserving OpenClaw employee execution and Phase 2 persistence boundaries.
- Screenshot raw image bytes are not written into the CBE business database. Re-analysis of image-sourced records requires the operator to upload the screenshots again.
