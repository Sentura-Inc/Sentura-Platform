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
| CE20.14 | Browser render check | Browser | `/employee`, `/employee/customers`, and `/employee/memory` render without runtime error or console error against local `sentura_cbe_dev`; empty DB lists show expected empty states. |
| CE20.15 | Live DB inspection runbook | Static script + live SQL execution | `scripts/inspect-cross-border-live-db.sql` uses real physical columns and joins/JSON projection for website/company/source fields; it avoids stale table-only columns such as `lead_candidates.agent_run_id`, `lead_sources.finding`, and `screening_reports.company_name`. |
| CE20.16 | Customer list simplification | Static script + Browser | `获客与背调` keeps the existing primary row information, lightens status row backgrounds, removes row-level delete buttons while retaining top `删除所选`, merges score sorting into one `评分排序` select, and shows business score labels such as `优先跟进`, `谨慎跟进`, `暂缓/高风险`, with `证据不足` gray. |
| CE20.17 | Task-completion row highlight | Static script + Browser | Completed Lead/Screening task notifications link to `/employee/customers?highlightTask=...`; the customer page maps task IDs through affected customer IDs or lead/screening run IDs, clears filters as needed, scrolls to visible affected rows, and flashes a light-blue outline for 3 seconds. |
| CE20.18 | Customer list compact polish | Static script + Browser | Product overflow chips such as `+1` expand the row in place to show the complete product list and can collapse with `收起`; row `新找到` badges are removed; screened rows show a green `✅` instead of a persistent `已完成` badge; `找到时间` displays as Beijing `YYYY-MM-DD HH:mm:ss` without ISO `T`/`Z`. |
| CE20.19 | Message/task dismissal polish | Static script + Browser | The message center dialog closes on outside pointer click, completed task-status banners persist local and DB dismiss state, and closing a terminal banner prevents older completed banners from replacing it after route switching. |
| CE20.20 | Screening budget estimate | Static script | Background-check estimated price is itemized from configured unit assumptions for OpenAI model tokens, Tavily search, optional Abstract/Hunter email checks, and optional paid trade-data budget rather than a fixed demo per-target value. |
| CE20.21 | Manager report-window parity | Focused lint/typecheck + Browser | Manager `查看报告` actions use the shared Employee `CustomerReportDialog` only, the report overlay is portaled outside the Manager employee-detail dialog so it is not clipped, report sections and top metrics are visible, `X` closes the report, and outside-overlay click closes only the report while leaving the Manager detail dialog open. |
| CE20.22 | Manager login parity | Typecheck + Static script + HTTP smoke | Manager has `/admin/login` using the same logo/card/input/button layout as the Employee login page, submits `cbeRole: "admin"`, preset admin `孙总/1234` signs an `admin` session, wrong password returns 401, Manager APIs default to cookie session rather than a hardcoded admin header, and the seeded admin profile can self-heal from the old preset row. |
| CE20.23 | Employee/Manager login kickout fix | Typecheck + Static script + HTTP/browser smoke | Employee and Manager sessions use role-scoped cookies (`sentura_cbe_employee_session`, `sentura_cbe_admin_session`) with legacy same-role fallback only; AppShell calls `/api/session?role=operator` or `/api/session?role=admin`; Admin cookies are rejected by Employee checks, Employee cookies are rejected by Admin checks, combined cookies keep both platforms active, and persistent UI state reads `localStorage` after mount to avoid first-render hydration mismatch. |

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

Status: PASS — Lead result-level DB reconciliation/top-up PASS 2026-06-21; Google Maps + web-search MCP/source route PASS 2026-06-21; Screening address-footprint implementation PASS 2026-06-22; scale-aware Google Maps first-block scoring implementation PASS 2026-06-23; Screening parent/child fan-out and route-triggered queued-child drain PASS 2026-06-24; paid retry state and explicit re-approval PASS 2026-06-24. The historical Accio approval-to-memory and Screening handoff path from 2026-06-24 is superseded by CE25 on 2026-06-25: `记忆整理` is now preview-only and separated from `获客与背调`.

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

Implemented paid retry and historical Accio/Screening workflow checks:

- `007_screening_retry_memory_approval.sql` adds per-target paid email/trade status, call counts, spend, retry timestamps, memory review metadata, and handoff consumption timestamps.
- Failed Screening children move available paid email/trade lookups to `reapproval_required`.
- `POST /api/client-demos/cross-border/employee/screening-runs/[id]/retry` can rerun a failed child without rerunning completed siblings. Normal retry disables paid email/trade sources; explicit re-approval reopens paid lookup for that child only.
- Employee hidden Screening execution applies child `paid_source_policy` before building the child prompt, so stale UI paid options cannot repeat a paid lookup without server approval.
- Screening completion records observed paid email/trade evidence into per-target state and `api_call_ledger`.
- `PATCH /api/client-demos/cross-border/employee/memory/facts` approves or rejects pending Accio memory facts with reviewer metadata; it does not write raw chat text to vector memory.
- Accio-to-Screening handoffs are marked `accepted` on Screening task creation and `completed` when a report is saved for the Accio summary target.

Current product boundary:

- CE25 supersedes the two Accio interop bullets above. The historical rows remain as audit context for the 2026-06-24 local preflight, but current code intentionally disables Accio memory-fact approval, long-term memory write, customer-list projection, supplement routing, and Accio-to-Screening handoff consumption.

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

Status: PASS — `agent-memory` branch merged into `ecommerce` and integrated with Phase 2 DB/store/UI boundaries on 2026-06-24; structured report projection repaired and verified on 2026-06-25.

Scope:

- `memory-import-normalizer.ts` supports JSON, pasted text, and multi-screenshot import preparation for Employee `记忆整理`.
- The Dashboard Gateway client forwards image attachments through OpenClaw-compatible `chat.send` payloads.
- The hidden Accio task runner batches screenshot preflight transcription turns before requesting the final structured memory summary.
- `008_accio_manual_import_formats.sql` adds source/input/attachment metadata to `accio_imports`.
- Employee `记忆整理` exposes JSON/text/image modes. Screenshot mode accepts multiple selected image files, shows the selected screenshot count/list, and keeps raw images out of persistent storage.
- Employee memory reports project analyzed `customer_profile`, `purchase_intent`, `negotiated_price`, `behavior_signals`, and `next_actions` fields instead of showing only a generic summary string.
- Memory record projection prefers analyzed company/country values from `accio_summaries` over placeholder manual import values such as `待确认客户`.

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
set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db
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
| CE24.8 | Structured report projection | Static store/UI scripts | Store/API projection exposes `customerProfile`, `purchaseIntent`, `negotiatedPrices`, and `behaviorSignals`; analyzed customer profile company wins over placeholder import company; Employee report dialog renders `客户画像`, `采购需求`, `价格与条款`, and `下一步`. |
| CE24.9 | Browser sample smoke | Local Dashboard + Browser | The teammate sample record renders as Rossi Telecom SRL and the report modal shows Rossi/Marco, S25 Ultra magnetic rugged case, 500/1000 pcs, DDP Milan/payment context, US$1,925 in next actions, and concrete follow-up tasks. |
| CE24.10 | Multi-screenshot upload | Static script + typecheck | Image import iterates every selected file, names multi-image records as `聊天截图 N 张`, exposes a `multiple` file input, shows selected count/list, converts all images to Gateway attachments, and the Accio runner splits attachments into numbered preflight batches. |
| CE24.11 | Regression commands | Automated scripts | Dashboard typecheck, Phase 2 store static/live checks, broad CBE static checks, Browser sample smoke, and whitespace checks pass after the projection/multi-screenshot fix. |

Latest verification, 2026-06-25:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 218/218.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 244/244 after CE25 separation.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 415/415 after CE25 separation.
- API smoke against local Dashboard returned `name: "Rossi Telecom SRL"` plus structured profile/intent/price/behavior/next-action fields.
- Browser smoke against local Dashboard confirmed the sample report modal renders the structured sections and useful deal facts.
- `git diff --check`: PASS.

Boundary:

- CE24 does not add a direct Alibaba International Station API integration. It only broadens manual Accio intake sources while preserving OpenClaw employee execution and Phase 2 persistence boundaries.
- Screenshot raw image bytes are not written into the CBE business database. Re-analysis of image-sourced records requires the operator to upload the screenshots again.
- CE25 adds the current product boundary on top of CE24: Accio reports are structured analysis previews only and must not offer write approval, customer projection, Screening handoff, or supplement-chat interop.

## CE25 — Memory Agent Separation From Lead/Screening Boards

Status: PASS — Implemented and verified on 2026-06-25 after the user clarified that `记忆整理` must be a separate board from `获客与背调`.

Scope:

- Employee `记忆整理` keeps JSON/text/multi-screenshot import and structured report preview.
- `记忆整理` no longer exposes `批准写入`, `发送到背调`, or write-status actions.
- `获客与背调` no longer offers supplement-chat routing back into `记忆整理`.
- Accio summaries no longer create `memory_facts`, no longer create `handoff_events`, and no longer appear as customer rows.
- Backend/store guards reject Accio interop attempts instead of silently accepting stale clients or legacy payloads.
- The `cbe-accio-memory` workspace no longer contains a handoff skill and its prompt/skills describe preview-only analysis.

Primary files:

- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/facts/route.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/{employee-api.ts,employee-data.ts,employee-task-runner.ts}`
- `sentura/dashboard/src/lib/cross-border-store/{accio.ts,customers.ts,handoffs.ts,schemas.ts,screening.ts}`
- `sentura/agents/cbe-accio-memory/**`
- `scripts/test-cross-border-agents.ts`
- `scripts/test-cross-border-phase2-store.ts`

Commands:

```bash
pnpm --dir sentura/dashboard exec tsc --noEmit
pnpm exec tsx scripts/test-cross-border-agents.ts
pnpm exec tsx scripts/test-cross-border-phase2-store.ts
set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db
git diff --check
```

Test cases:

| ID | Area | Method | Expected |
|---|---|---|---|
| CE25.1 | Memory UI action boundary | Static script + typecheck | Employee `记忆整理` report/import flows have no `批准写入`, `发送到背调`, write status, or Screening route action; report UI is labeled as analysis preview. |
| CE25.2 | Customer page boundary | Static script + typecheck | `获客与背调` runs Lead and Screening only; selected customers no longer route to memory supplement flows and no Accio source label is projected into the customer list. |
| CE25.3 | Accio persistence boundary | Static/live store check | `saveAccioSummaries()` persists summaries but returns `memoryFactIds: []` and `handoffIds: []`; raw `supplement_target` payloads are rejected with `accio_interop_disabled`. |
| CE25.4 | Handoff guard | Static/live store check | Accio-to-Screening handoff creation is rejected with `accio_handoff_disabled`. |
| CE25.5 | Screening source boundary | Static script | `accio_memory` is removed from Screening target/report source schemas and Screening no longer accepts/completes Accio handoff events. |
| CE25.6 | Agent workspace boundary | Static script | `cbe-accio-memory` no longer has `skills/handoff-to-screening/SKILL.md`; prompt and skills forbid long-term write, customer creation, or Screening handoff output. |
| CE25.7 | Standalone Accio page boundary | Static script + typecheck | `/client-demos/cross-border/accio-memory` renders preview/copy analysis only and has no Screening handoff copy/send path. |
| CE25.8 | Regression commands | Automated scripts | Dashboard typecheck, broad CBE static checks, Phase 2 store static/live checks, and whitespace checks pass after removing the interop path. |

Latest verification, 2026-06-25:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 415/415.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 218/218.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 244/244.

Boundary:

- CE25 intentionally supersedes the CE22 Accio approval-to-memory and Accio-to-Screening handoff UX. Historical CE22 rows remain for audit traceability only.
- Existing database tables such as `memory_facts` and `handoff_events` remain for other platform/history needs; the current Accio `记忆整理` flow does not write to them.

## CE26 — Production Employee/Admin route split

Status: PASS (2026-06-26)

Scope:

- `sentura/dashboard/next.config.ts`
- `sentura/dashboard/src/lib/cross-border-routes.ts`
- `sentura/dashboard/src/components/app-shell.tsx`
- `sentura/dashboard/src/app/page.tsx`
- `sentura/dashboard/src/app/auth/login/page.tsx`
- `sentura/dashboard/src/app/api/auth/login/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/session/route.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/{employee,admin}/**`
- `scripts/test-cross-border-agents.ts`
- `scripts/test-cross-border-phase2-store.ts`
- `scripts/test-cross-border-phase2-concurrency.ts`
- `scripts/test-cross-border-phase2-load-smoke.ts`

Validation method:

```bash
pnpm --dir sentura/dashboard exec tsc --noEmit
pnpm --dir sentura/dashboard build
pnpm exec tsx scripts/test-cross-border-agents.ts
pnpm exec tsx scripts/test-cross-border-phase2-store.ts
pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts
pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts
```

Test cases:

| ID | Area | Method | Expected |
|---|---|---|---|
| CE26.1 | Canonical page routes | Static script + browser smoke | Employee entry is `/employee`; Employee login is `/employee/login`; Admin entry is `/admin`; Admin login is `/admin/login`. Browser smoke loads `/employee` and finds the Employee shell/login surface; `/admin/login` exposes the manager login form. |
| CE26.2 | Canonical API routes | Static script + HTTP smoke | Employee APIs are called through `/api/employee/*`; Admin APIs are called through `/api/admin/*`; role session checks use `/api/session?role=operator|admin`. HTTP smoke reaches handlers and returns expected auth errors when unauthenticated, not 404. |
| CE26.3 | Legacy URL compatibility | Static script + HTTP smoke | Old `/client-demos/cross-border/employee*` and `/client-demos/cross-border/admin*` page URLs redirect to canonical `/employee*` and `/admin*`; legacy implementation files remain readable behind Next rewrites during this migration. |
| CE26.4 | Next config routing | Static script + build | `next.config.ts` redirects old demo page URLs, rewrites `/employee`, `/admin`, `/api/employee/*`, `/api/admin/*`, and `/api/session` to the existing implementation, and production build succeeds. |
| CE26.5 | AppShell/session boundary | Static script + typecheck | AppShell role checks, login redirects, nav links, notification links, logout targets, and login API `redirectTo` values use canonical Employee/Admin routes and no longer send users back to demo URLs. |
| CE26.6 | Regression coverage | Automated scripts | Dashboard typecheck/build, broad CBE static checks, Phase 2 store checks, concurrency checks, load-smoke static checks, browser route smoke, and whitespace checks pass. |
| CE26.7 | Alibaba ECS rollout | Target smoke | ECS pulls the route split, rebuilds Dashboard, restarts `sentura-dashboard.service`, reloads Nginx root redirects to `/employee` and `/admin/login`, confirms loopback-only Dashboard/Gateway listeners, verifies live RDS store checks, public HTTPS canonical redirects/pages, auth-boundary API 401s, and public WSS Gateway handshake. |
| CE26.8 | Admin SSR rewrite shell | Static + HTTP smoke | Route helpers recognize both canonical paths and Next rewrite destination paths (`/client-demos/cross-border/admin*`) so `/admin/login` server-rendered HTML shows `跨境电商管理者系统`, not `跨境电商员工操作系统`; tenant context also recognizes both canonical and rewritten API paths. |

Latest verification, 2026-06-26:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm --dir sentura/dashboard build`: PASS, with the existing multiple-lockfile workspace-root warning only.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 417/417.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 218/218.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23.
- `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`: PASS, 16/16.
- Local HTTP smoke against `http://127.0.0.1:3000`: `/employee` returned 200; `/admin/login` returned 200; old `/client-demos/cross-border/employee` redirected to `/employee`; old `/client-demos/cross-border/admin/login` redirected to `/admin/login`; `/api/session`, `/api/employee/customers`, and `/api/admin/operators` reached handlers and returned expected unauthenticated 401 responses.
- Browser smoke against `http://127.0.0.1:3000`: `/employee` loaded the Employee shell/login surface; `/admin/login` exposed the `管理者姓名` / `密码` login form and `登录` button.
- Admin SSR rewrite fix:
  - Before the fix, public `https://admin.sentura.ai/admin/login` returned `200` but its SSR HTML included `跨境电商员工操作系统` because AppShell saw the rewritten internal path `/client-demos/cross-border/admin/login` and route helpers only recognized `/admin`.
  - Fixed `sentura/dashboard/src/lib/cross-border-routes.ts` to recognize canonical paths plus internal rewrite destination paths, and fixed `tenant-context.ts` to recognize canonical plus rewritten API paths.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 418/418.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 219/219.
  - `pnpm --dir sentura/dashboard build`: PASS, with the existing multiple-lockfile workspace-root warning only.
  - Local production HTTP smoke: `/admin/login` SSR HTML contains `跨境电商管理者系统`, does not contain `跨境电商员工操作系统`, and exposes `管理者姓名` / `密码` / `登录`.
- Target ECS rollout:
  - `pnpm --dir sentura/dashboard build`: PASS on `/root/Sentura-Platform`.
  - `sentura-dashboard.service`: active after restart on `127.0.0.1:3000`.
  - root `systemctl --user openclaw-gateway.service`: active on `127.0.0.1:18789`.
  - `nginx -t`: PASS; Nginx reloaded after changing root redirects to `https://$host/employee` and `https://$host/admin/login`.
  - Server host-header smoke: `app.sentura.ai/` redirects to `https://app.sentura.ai/employee`; `admin.sentura.ai/` redirects to `https://admin.sentura.ai/admin/login`.
  - Live RDS store check: `pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 244/244.
  - Public HTTPS smoke: `https://app.sentura.ai/` redirects to `/employee`, `https://admin.sentura.ai/` redirects to `/admin/login`, `https://app.sentura.ai/employee` returns 200, and `https://admin.sentura.ai/admin/login` returns 200.
  - Public compatibility smoke: old `/client-demos/cross-border/employee` and `/client-demos/cross-border/admin/login` return 307 to canonical paths.
  - Public API smoke: `/api/session?role=operator` and `/api/admin/operators` reach handlers and return expected unauthenticated 401 responses.
  - Public Gateway smoke: `wss://admin.sentura.ai/gateway` opens a WebSocket and closes cleanly after the probe.
- Target ECS admin SSR hotfix:
  - Applied the two-source-file hotfix to ECS with `git apply`, rebuilt Dashboard, restarted `sentura-dashboard.service`, and restored generated `next-env.d.ts`.
  - Server loopback HTML smoke: `/admin/login` contains `跨境电商管理者系统`, does not contain `跨境电商员工操作系统`, and includes `管理者姓名` / `密码` / `登录`.
  - Public HTML smoke: `https://admin.sentura.ai/admin/login` contains `跨境电商管理者系统`, does not contain `跨境电商员工操作系统`, and includes the manager login fields.
  - Public login smoke with `孙总` / `1234`: `/api/auth/login` returns 200 with `redirectTo: "/admin/employees"`; authenticated `/admin/employees` returns 200 and renders manager navigation labels.

Boundary:

- This route split changes public/canonical Dashboard paths only. The source implementation files remain under `src/app/client-demos/cross-border/**` for now and are reached through Next rewrites to avoid a high-risk file move.
- Existing standalone historical demo pages such as `/client-demos/cross-border/lead-discovery`, `/screening`, and `/accio-memory` are not promoted to production entrypoints in this pass.

## CE27 — ECS Lead Sandbox Readiness

Status: PASS (2026-06-26)

Scope:

- Alibaba ECS target `/root/Sentura-Platform`.
- Root user OpenClaw Gateway systemd user service.
- Docker sandbox image `openclaw-sandbox:bookworm-slim`.
- `cbe-lead-discovery` hidden OpenClaw task startup.
- RDS `agent_runs`, `lead_runs`, and `lead_discovery_scopes` cleanup for failed Lead runs.

Validation method:

```bash
cd /root/Sentura-Platform
docker image ls | grep openclaw-sandbox
systemctl --user restart openclaw-gateway
systemctl --user is-active openclaw-gateway
```

Plus targeted Gateway/RDS probes:

- Temporary `cbe-lead-discovery` sandbox startup session returns `READY`.
- Non-writing Lead smoke reaches `cross-border-intel__cbe_intel_google_places_search` and receives Google Places HTTP 200.
- Original failed session is terminal in RDS and has no lingering active Lead scope.

Test cases:

| ID | Area | Method | Expected |
|---|---|---|---|
| CE27.1 | Sandbox image prerequisite | ECS shell | Docker is active and `openclaw-sandbox:bookworm-slim` exists after `bash openclaw/scripts/sandbox-setup.sh`. |
| CE27.2 | Gateway restart | systemd user service | Root `openclaw-gateway` restarts cleanly, returns `active`, and Gateway reaches `ready` without repeating `Sandbox image not found`. |
| CE27.3 | Sandboxed Lead startup | Temporary Gateway session | `cbe-lead-discovery` starts in its sandbox and returns `READY`; diagnostic transcript/session artifacts are removed after the probe. |
| CE27.4 | Lead tool availability | Non-writing Gateway smoke | `cross-border-intel__cbe_intel_google_places_search` is available to `cbe-lead-discovery` and returns Google Places HTTP 200 candidates. |
| CE27.5 | Failed-run terminal state | RDS query | The original failed run has `agent_runs.status = failed`, `agent_runs.error_code = gateway`, and its `lead_runs.status = failed`. |
| CE27.6 | Scope release | RDS query | Active `cbe-lead-discovery` run count is `0` and no `lead_discovery_scopes` row keeps `active_agent_run_id` pointing to the failed run. |
| CE27.7 | Diagnostic cleanup | ECS filesystem | Temporary diagnostic `READY` and smoke session artifacts are removed; the user's original failed session remains as an audit record. |

Latest verification, 2026-06-26:

- Built `openclaw-sandbox:bookworm-slim` with `bash openclaw/scripts/sandbox-setup.sh`.
- Restarted root `openclaw-gateway`; service returned `active` and Gateway logged `ready`.
- Temporary `cbe-lead-discovery` startup probe returned `READY`.
- Non-writing tool smoke called `cross-border-intel__cbe_intel_google_places_search`; Google Places returned HTTP 200 and candidates.
- RDS check for the original failed session:
  - `agent_runs.status = failed`.
  - `agent_runs.error_code = gateway`.
  - `lead_runs.status = failed`.
  - active Lead run count = `0`.
  - lingering scopes = `[]`.
- Removed temporary diagnostic session files from `/root/.openclaw/agents/cbe-lead-discovery/sessions`.

Boundary:

- CE27 is a target operational readiness check, not an application-code change.
- It does not insert test customers into the production customer table.
- Full `production_go_live_ready` still requires target load-smoke, target restore drill, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS evidence.

## CE28 — Screening Fenced JSON Recovery And Backfill

Status: PASS (2026-06-26)

Scope:

- Employee hidden runner structured-result parsing.
- Production `cbe-buyer-screening` task recovery on Alibaba ECS.
- RDS `agent_runs`, `screening_reports`, `screening_evidence`, `screening_score_blocks`, and `screening_address_locations` completion state.

Context:

- Production `背调` for `CPR Cell Phone Repair` failed in the Dashboard as `timeout`.
- RDS run: `run_bd41a833-f84b-4b20-930d-65732ffab564`.
- OpenClaw session key: `agent:cbe-buyer-screening:user:0c01d63d-de13-4478-a6a7-af3680b979b6:f70c7296-85d5-4f1c-b4d5-ba0bf659c81b`.
- OpenClaw session file: `/root/.openclaw/agents/cbe-buyer-screening/sessions/bb9127f8-5645-4e06-9c57-93ca8f6fa220.jsonl`.

Root cause:

- The OpenClaw session itself completed in about 195 seconds and returned a valid JSON object in a ```json fenced block.
- The assistant response omitted `SCREENING_REPORTS_JSON_START` / `SCREENING_REPORTS_JSON_END`.
- The Dashboard parser only accepted explicit markers, so it continued polling until the local 6-minute wait window expired and wrote `error_code = timeout`.

Fix:

- `extractMarkerPayload()` still prefers explicit markers.
- When markers are absent, it now tries a whole-response JSON fallback after removing an optional ```json code fence.
- The fallback is accepted only when the parsed object contains the expected top-level array for the current task:
  - Lead: `leads`.
  - Screening: `reports`.
  - Accio memory: `summaries`.
  - Image preflight: `images`.
- Added static regression coverage in `scripts/test-cross-border-agents.ts`.
- Applied the same hotfix on ECS, rebuilt Dashboard, and restarted `sentura-dashboard.service`.
- Backfilled the already-generated CPR Screening report through the existing completion API/store path, using the transcript payload and the normal Dashboard normalization layer.

Validation method:

```bash
pnpm --dir sentura/dashboard exec tsc --noEmit
pnpm exec tsx scripts/test-cross-border-agents.ts
pnpm --dir sentura/dashboard build
```

Target ECS checks:

```bash
systemctl is-active sentura-dashboard nginx
systemctl --user is-active openclaw-gateway
curl -I https://app.sentura.ai/employee
curl -I https://admin.sentura.ai/admin/login
```

RDS checks:

```sql
select id, status, current_stage, error_code, error_message
from agent_runs
where id = 'run_bd41a833-f84b-4b20-930d-65732ffab564';

select id, risk_tier, normalized_score
from screening_reports
where agent_run_id = 'run_bd41a833-f84b-4b20-930d-65732ffab564';
```

Test cases:

| ID | Area | Method | Expected |
|---|---|---|---|
| CE28.1 | Whole-response JSON fallback | Static script | Hidden runner contains `parseWholeJsonPayload`, `stripJsonCodeFence`, expected-key routing, and `Array.isArray(record[expectedKey])` guard. |
| CE28.2 | Marker-first behavior | Static review | Explicit marker extraction remains the primary path; fallback runs only when `startMarker` is absent. |
| CE28.3 | Typecheck | Local + ECS | `pnpm --dir sentura/dashboard exec tsc --noEmit` passes after the parser change. |
| CE28.4 | Static regression | Local + ECS | `pnpm exec tsx scripts/test-cross-border-agents.ts` passes 419/419. |
| CE28.5 | ECS rollout | Target build/service | `pnpm --dir sentura/dashboard build` passes; `sentura-dashboard.service`, `nginx`, and root `openclaw-gateway` are active. |
| CE28.6 | Production report backfill | API/store path | The CPR transcript payload is normalized and completed through the existing API/store path, not hand-written with raw SQL. |
| CE28.7 | RDS terminal state | RDS query | `run_bd41a833-f84b-4b20-930d-65732ffab564` is `completed`, `current_stage = screening_reports_saved`, and has no `error_code` / `error_message`. |
| CE28.8 | Report visibility | Employee API smoke | `GET /api/employee/customers?query=CPR` shows `CPR Cell Phone Repair` with `screeningStatus = cautious`, `normalizedScore = 78.67`, and `latestScreeningReportId = RPT-20260625-CPR-001`. |

Latest verification, 2026-06-26:

- Local `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 419/419.
- Local `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- ECS `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 419/419.
- ECS `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- ECS `pnpm --dir sentura/dashboard build`: PASS, with the existing multiple-lockfile workspace-root warning only.
- ECS services: `sentura-dashboard`, `nginx`, and root `openclaw-gateway` active.
- Public HTTPS:
  - `https://app.sentura.ai/employee`: 200.
  - `https://admin.sentura.ai/admin/login`: 200.
- RDS:
  - `agent_runs.status = completed`.
  - `agent_runs.current_stage = screening_reports_saved`.
  - `agent_runs.error_code = null`.
  - saved reports = 1.
  - report id `RPT-20260625-CPR-001`.
  - risk tier `cautious`.
  - normalized score `78.67`.
  - address-footprint locations = 16.
  - active Screening run count = 0.
- Employee API smoke returned CPR with `screeningStatus = cautious`, `normalizedScore = 78.67`, and `screeningAgentRunId = run_bd41a833-f84b-4b20-930d-65732ffab564`.

Boundary:

- CE28 does not relax the prompt contract; agents are still instructed to output markers.
- The fallback is deliberately narrow and only accepts full JSON/code-fenced JSON with the expected top-level array.
- The production backfill used the existing completion route/store normalization path and did not create a synthetic test customer.

## CE29 — Hidden Task Structured Output Repair Loop

Status: PASS (2026-06-26)

Scope:

- Employee hidden runner structured-output enforcement for Lead, Screening, Accio, and screenshot preflight tasks.
- Local and Alibaba ECS rollout of the format-repair path.
- Public Employee/Admin reachability after the rebuilt Dashboard restart.

Context:

- CE28 fixed the production CPR Screening timeout by accepting valid whole-response fenced JSON when markers are omitted.
- The remaining risk was malformed or prose-wrapped structured output that still cannot be parsed after marker and fenced-JSON fallback.
- The user asked whether future tasks could still timeout because of formatting and whether there is an enforcement path to ensure a return.

Fix:

- Added `HIDDEN_TASK_FORMAT_REPAIR_TIMEOUT_MS = 90_000`.
- Added timestamp-scoped transcript reads:
  - Normal task polling can pass `minMessageTimestampMs` so preflight or previous turns are not parsed as current output.
  - Repair polling reads only messages after the repair request timestamp.
- Added `buildStructuredOutputRepairPrompt()`:
  - Instructs the employee that the Dashboard could not read the JSON.
  - Forbids new investigation, tool calls, added evidence, deleted evidence, or invented evidence.
  - Requires only the existing result, rewritten as strict `JSON.parse`-compatible JSON.
  - Requires the original task markers and the expected top-level array key.
- Added `requestHiddenTaskFormatRepair()`:
  - Sends one repair turn on malformed JSON or completed non-marker output.
  - Polls the repair transcript for 90s.
  - Preserves terminal backend failures separately from repair parse/timeout failures.
- Wired repair into:
  - screenshot preflight turns, where `chat.send` normally returns after the preflight turn completes;
  - final Lead/Screening/Accio turns;
  - final transcript grace handling after long `chat.send` timeouts.
- Kept CE28's marker-first and fenced-JSON fallback path before the repair loop.

Test cases:

| ID | Area | Method | Expected |
|---|---|---|---|
| CE29.1 | Repair prompt contract | Static script | `scripts/test-cross-border-agents.ts` asserts `buildStructuredOutputRepairPrompt`, `requestHiddenTaskFormatRepair`, `HIDDEN_TASK_FORMAT_REPAIR_TIMEOUT_MS`, and the no-reinvestigation/no-tool repair wording exist. |
| CE29.2 | Timestamp-scoped transcript reads | Static script + code review | Hidden runner contains `minMessageTimestampMs` and uses it for preflight, final-task, and repair polling so stale transcript messages do not satisfy a later task. |
| CE29.3 | Expected key enforcement | Static/code review | Repair prompt and fallback derive the expected top-level key from the original marker: `leads`, `reports`, `summaries`, or image `images`. |
| CE29.4 | Preflight repair | Static/code review | Screenshot preflight calls `waitForHiddenTaskMarker()` with `repairOnAssistantText: true` only after the preflight `chat.send` completes. |
| CE29.5 | Final task repair | Static/code review | Final Lead/Screening/Accio polling calls one repair round for parse errors, and for non-marker assistant output only when the send completed or the normal wait/grace window has elapsed. |
| CE29.6 | Local regression | Local commands | `pnpm exec tsx scripts/test-cross-border-agents.ts` passes 420/420; `pnpm --dir sentura/dashboard exec tsc --noEmit` passes; `git diff --check` passes. |
| CE29.7 | ECS rollout | Target commands | ECS static 420/420, Dashboard typecheck/build pass, `sentura-dashboard`, `nginx`, and root `openclaw-gateway` are active after restart, and generated `next-env.d.ts` is restored. |
| CE29.8 | Public smoke | Public HTTPS | `https://app.sentura.ai/employee` returns 200 with the Employee shell; `https://admin.sentura.ai/admin/login` returns 200 with the Admin shell and not the Employee shell. |

Latest verification, 2026-06-26:

- Local `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 420/420.
- Local `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- Local `git diff --check`: PASS.
- ECS `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 420/420.
- ECS `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- ECS `pnpm --dir sentura/dashboard build`: PASS, with the existing multiple-lockfile workspace-root warning only.
- ECS services: `sentura-dashboard`, `nginx`, and root `openclaw-gateway` active.
- Public HTTPS:
  - `https://app.sentura.ai/employee`: 200; contains `跨境电商员工操作系统` and not `跨境电商管理者系统`.
  - `https://admin.sentura.ai/admin/login`: 200; contains `跨境电商管理者系统` and not `跨境电商员工操作系统`.

Boundary:

- CE29 is not a guarantee that every task will succeed. It prevents format-only failures from being reported as local timeouts when the employee has already produced usable structured content or can rewrite it.
- If the employee never reaches a final result, a provider/tool/backend failure occurs, or the repair turn also fails to produce parseable JSON, the task still fails explicitly with the corresponding error.
- The repair prompt intentionally forbids new facts and tool calls, so it is a formatting guard rather than a second investigation pass.
