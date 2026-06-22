> **On-demand reference — not read by default.**
>
> Back-link: [`docs/TESTS.md`](../TESTS.md)

# Cross-Border E-Commerce Phase 2 Tests

Detailed test cases for Phase 2 of the mobile-accessory Cross-border e-commerce / 跨境电商 independent client pilot. Use this file for production persistence, customer `admin`/`operator` monitoring, typed store/API routes, DB-backed Employee state, Lead coordination, durable Screening/Accio workflows, and load-smoke tests. Phase 1/MVP tests remain in [`tests-cross-border-ecommerce.md`](tests-cross-border-ecommerce.md) as historical and regression coverage.

## CE17 — Cross-Border Phase 2 Execution Plan

Status: PASS (2026-06-16; rechecked 2026-06-17; report-driven concurrency/API-scope design updated 2026-06-21; Google Maps + web-search source route implemented 2026-06-21; Dashboard Lead timeout/runtime env fix verified 2026-06-21; Screening Google Maps address-footprint report path and dedicated address table implemented 2026-06-22; Accio manual JSON/text/screenshot import implemented 2026-06-22; Accio report next-action/price display polished and bilingual Chinese report contract hardened 2026-06-23)

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
| CE17.27 | Google Maps + web-search source route | Static/manual review + mocked MCP tests | `MARKET_ACQUISITION.md`, `SCREENING.md`, `DESIGN.md`, `PHASE-2.md`, `API_KEYS_OPENCLAW_SETUP.md`, and `cross-border-intel/README.md` make Google Maps Places + OpenClaw web search the implemented primary acquisition/backcheck route while preserving OpenClaw runtime boundaries; Google Maps is documented as discovery/local-presence/address-consistency evidence, not registry/KYB proof; `GOOGLE_MAPS_API_KEY` remains server-side/secret-only current MCP capability with setup env references; field-mask profiles, attribution/caching guardrails, request caps, ledger-ready metadata, mocked adapter tests, and no browser-side key exposure are covered. |
| CE17.28 | Screening Google Maps address-footprint report path | Static/manual review + regression tests | `SCREENING.md`, `PHASE-2.md`, `DESIGN.md`, `cbe-buyer-screening` skills, `cross-border-intel`, Dashboard marker normalization, store schemas, completion writes, `screening_address_locations`, and shared report UI require Screening to run bounded multi-query Google Places discovery for company-related offices/stores/warehouses/service locations, dedupe and classify address candidates, validate addresses where possible, persist normalized address rows, and render a dedicated `Google Maps 地址版图` / `address_footprint` report section that is visually separate from ordinary evidence and does not act as legal/KYB proof. |
| CE17.29 | Accio manual multi-format intake | Static/manual review + regression tests | `MEMORY_PROCESSING.md`, `UI.md`, `PHASE-2.md`, `cbe-accio-memory` workspace skills, Dashboard memory normalizer, Gateway attachment client, hidden task runner, Accio store schemas, and Employee memory UI define JSON/text/screenshot manual imports; remove the official Alibaba API source option; keep screenshot count uncapped at the UI level with per-image validation and payload batching; use the configured OpenClaw employee model/provider; require vision support for screenshot mode; persist source/input/attachment metadata while excluding raw images from vector memory; render structured next-action objects as readable follow-up bullets; distinguish total-price fields from unit-price fields; and require `report_zh` / Chinese business summaries for operator-facing reports. |

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
| CE18.7 | Accio persistence schema | Static/live DB check | Accio tables cover imports, conversations, redacted/hash-only messages, summaries, source file hash, storage key, validation status, source kind, input format, attachment metadata, and behavior summary JSON. |
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

Status: PASS (2026-06-17; customer-list UX/list polish rechecked 2026-06-18; memory multi-format import and complete manual fixture rechecked 2026-06-22; Accio bilingual report hardening rechecked 2026-06-23)

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
| CE20.24 | Memory multi-format import UI | Static script + Browser | `/employee/memory` `添加新记录` drawer exposes `JSON 文件`, `粘贴文字`, and `聊天截图`; no official Alibaba API source button exists; pasted text sample enables import/analyze with auto record name; screenshot mode accepts image selection, shows file metadata, enables only `导入并分析`, and states raw images are not durably stored. |
| CE20.25 | Memory import complete manual fixture | Generated fixtures + static validation | `outputs/memory-agent-samples/` contains one complete Rossi Telecom SRL customer case across pasted-text transcript, Accio-compatible JSON, and five continuous screenshot-style PNGs; the case covers customer identity, inquiry, sample, pricing, negotiation, DDP freight, documents, payment, shipment tracking, and follow-up tasks. |
| CE20.26 | Accio report action/price display | Dashboard typecheck + Store regression + manual review | `next_actions` values returned as objects are normalized to readable strings before DB completion and API projection; historical object values are read back without `[object Object]`; the memory report renders follow-up actions as bullets; `价格与条款` labels unit price, total price, freight, sample fee, and derived all-in unit price separately so a negotiated DDP total such as `USD 1,925` is not presented as a per-piece price. |
| CE20.27 | Accio bilingual complete report | Dashboard typecheck + Store regression + Browser | The hidden Accio prompt and source `cbe-accio-memory` workspace require `report_zh`, `summary_zh`, Chinese `next_actions`, Chinese price context, and explicit unit-vs-total fields; API normalization preserves `report_zh`/`translation_zh`; `/employee/memory` report detail renders `完整分析报告`, `咨询内容与采购意图`, `价格与条款`, `客户判断与风险信号`, `写入记忆预览`, and `背调交接` with Chinese field labels and translated missing-field names. |

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
- 2026-06-23 Accio report display polish: `pnpm --dir sentura/dashboard exec tsc --noEmit` PASS; `pnpm exec tsx scripts/test-cross-border-phase2-store.ts` PASS, 195/195. Static review confirmed `next_actions` object values are converted to readable action text in the hidden runner, Employee API normalizer, and Accio store projection, and that `/employee/memory` report details use a dedicated price/terms renderer for unit-vs-total labeling.
- 2026-06-23 Accio commercial-readiness report review: `pnpm --dir sentura/dashboard exec tsc --noEmit` PASS; `pnpm exec tsx scripts/test-cross-border-phase2-store.ts` PASS, 198/198; `pnpm exec tsx scripts/test-cross-border-agents.ts` PASS, 413/413. Browser smoke logged in as `Lin Yue/1234`, opened `/client-demos/cross-border/employee/memory`, and confirmed the dialog renders the new Chinese report sections without runtime failure; pre-login 401 console entries were expected auth redirects.

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
| CE21.18 | Existing regression coverage | Automated scripts | Store static checks are 195/195; live store checks are 217/217; CBE agent checks are 413/413; Dashboard typecheck and Browser smoke pass. |

Latest verification, 2026-06-21:

- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21 static checks.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 38/38 static + live PostgreSQL checks after the strict new-customer target update.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 184/184.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 204/204.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 403/403.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm --dir sentura/dashboard build`: PASS. Build still prints the existing Next workspace-root warning caused by multiple lockfiles.
- Forbidden workspace file scan for `RULES.md`/`CONTEXT.md`: PASS, no output.
- Dashboard Lead timeout recovery recheck: PASS. Static checks cover Gateway client `timeoutMs` propagation, recoverable `sendChatMessage` timeout transcript polling, final transcript grace, and setup reading project `.env` plus `~/.openclaw/.env` before writing MCP env references.
- Real Google Places smoke against the configured API key: PASS, HTTP 200 with `status="found"`, one candidate, `place_id`, and `google_maps_uri`; no raw key or full provider response was printed.
- Dashboard Lead target-count submit recheck: PASS. The inspected live run called Google Maps successfully but carried `target_count=3` in both prompt and `lead_runs`, so the UI now snapshots the current numeric input ref at submit time and displays the target in the summary/button.

## CE22 — Lead Reconciliation, Google Maps Source Redesign, Screening Fan-Out/API Scope, And Accio Durable Workflow

Status: PARTIAL — Lead result-level DB reconciliation/top-up PASS 2026-06-21; Google Maps + web-search MCP/source route PASS 2026-06-21; Screening address-footprint implementation PASS 2026-06-22; Accio manual JSON/text/screenshot import PASS 2026-06-22; Accio bilingual report hardening PASS 2026-06-23; Screening fan-out/API-scope plus Accio approval/retry/handoff polish remain PEND.

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
- Screening can refresh one Place Details lookup per target, run one Text Search for manual storefront targets lacking a website, and validate public addresses for local-presence evidence, while Maps remains public-footprint/domain/address-consistency support rather than registry/KYB proof.
- Screening now discovers all bounded Google Maps address-footprint candidates for a company, classifies office/store/warehouse/service locations, validates unique addresses where possible, normalizes/persists `address_footprint`, writes every location to `screening_address_locations`, and renders a dedicated `Google Maps 地址版图` report section with summary counts, capped-search limitations, Maps URIs, validation verdicts, confidence, and match reasons.

Implemented Accio memory import scope:

- Employee `记忆整理` import drawer supports `JSON 文件`, `粘贴文字`, and `聊天截图`; the official Alibaba/API source option is removed.
- `memory-import-normalizer.ts` unifies JSON, pasted chat text, and screenshot attachment metadata into an Accio-compatible export with `input_format` and `source_kind`.
- Screenshot mode accepts multiple images at the UI level, validates each image by type/size, sends images through Gateway `chat.send` attachments, chunks transcript extraction by payload size, and merges transcript batches before the final summary/handoff prompt.
- The `cbe-accio-memory` workspace skills and prompt contract require `ACCIO_SUMMARIES_JSON_START/END` to contain `{ "summaries": [...] }`, preserve missing fields instead of inventing company/country/contact values, and mark screenshot transcription uncertainty.
- Accio import persistence records `source_kind`, `input_format`, and `attachment_metadata_json`; raw screenshots are not written to vector memory or durable image storage.
- The memory report dialog shows customer profile, inquiry/purchase intent, price/shipment terms, chat summary, missing fields, memory-write preview, and Screening handoff recommendations.
- The hidden Accio prompt and `cbe-accio-memory` workspace now require Chinese `report_zh`, `summary_zh`, Chinese next actions, Chinese price context, and explicit unit/total price fields; API normalization preserves `report_zh` and `translation_zh`.
- The memory report dialog renders a fuller Chinese operator report with localized field labels for customer profile, purchase intent, pricing/terms, behavior/risk signals, missing fields, memory preview, and Screening handoff details.

Latest verification, 2026-06-22:

- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 23/23.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 413/413.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 198/198.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS, applied `007_accio_manual_import_formats.sql`.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 217/217 static + live PostgreSQL checks, including true Accio import/summary/memory-fact/handoff writes and `screening_address_locations` write/read.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `bash -n scripts/sentura-setup.sh && bash -n scripts/start-sentura-demo.sh`: PASS.
- Live `~/.openclaw/workspace/cbe-buyer-screening` sync check: `TOOLS.md`, `evidence-collection`, `report-writing`, and `buyer-scoring` match source; top-level markdown files remain exactly the 8 OpenClaw-native files; no `RULES.md` / `CONTEXT.md`.
- Live `~/.openclaw/workspace/cbe-accio-memory` sync check: source workspace synced; top-level markdown files remain exactly the 8 OpenClaw-native files; no `RULES.md` / `CONTEXT.md`.
- Browser smoke: started Dashboard dev server, logged into Manager as `孙总/1234`, opened 吴思彤's employee detail, and opened the KIKO shared report dialog with no browser console errors. The historical KIKO report predates this implementation and therefore did not contain `address_footprint`; the next live Screening run should verify populated `Google Maps 地址版图` rows.
- Browser smoke for `/client-demos/cross-border/employee/memory`: logged in as `Lin Yue/1234`, opened `添加新记录`, verified the three import modes, no official Alibaba/API source button, pasted-text sample enables import/analyze, screenshot file selection shows file metadata and enables `导入并分析`, and no new post-login console errors occurred.
- Fixture validation: `python3 outputs/memory-agent-samples/generate_complete_case.py` regenerated the complete Rossi Telecom case; `python3 -m json.tool` passed for the JSON export; JSON inspection confirmed `message_count=31`, `attachment_count=6`, buyer company `Rossi Telecom SRL`, and `missing_fields=[]`; Pillow opened all five generated PNG screenshots and confirmed each image is below the 10 MB per-image limit.

Remaining scope:

- A 10-target Screening request creates one parent task and single-target child runs.
- No production path sends batch-5 or batch-10 prompts to `cbe-buyer-screening`.
- Optional batch-3 is allowed only behind `CBE_SCREENING_ALLOW_BATCH3`.
- Paid email and paid trade checks are capped once per target and require explicit re-approval on retry.
- Default Screening API scope stays read-only and source/budget-gated.
- Country-aware registry routing is documented and tested as a static contract before any new country adapter is exposed to agents.
- Screening writes targets/reports/evidence/score blocks.
- Memory facts require approval before promotion.
- Extend beyond the current Accio import/summary writes into approval-to-memory promotion, missing-field resolution, screenshot retry/reupload flow, and durable Screening handoff consumption.

## CE23 — Load Smoke

Status: PEND

Planned scope:

- 30-50 user readiness checks.
- 24 soft / 32 hard active-task behavior and controlled C=40/48 queue validation on the target deployment.
- Queued/running task counts across Lead, Screening child runs, and Accio imports.
- Cost/audit/load-smoke records.

## CE24 — Local Startup/Config Recovery Smoke

Status: PASS (2026-06-22)

Scope:

- `scripts/sentura-setup.sh`
- `scripts/start-sentura-demo.sh`
- `启动说明.md`
- local `~/.openclaw/openclaw.json`
- local Docker PostgreSQL container `sentura-cbe-postgres`
- local Dashboard env file `sentura/dashboard/.env.local`
- Gateway at `http://localhost:18789`
- Dashboard at `http://localhost:3000`

Context:

This checkout was moved from an older local path and had no installed `node_modules`, no Dashboard `.env.local`, no `~/.openclaw/.env`, no local Postgres.app v16 binaries, and a stale `~/.openclaw/openclaw.json` pointing Sentura extension paths at an old checkout. The repo-local `openclaw/` source build was also incomplete in this checkout because required source workspace packages such as `gateway-protocol`, `normalization-core`, and `packages/acp-core` were missing. The recovery path therefore uses the installed packaged OpenClaw CLI under `openclaw/node_modules/openclaw/openclaw.mjs` while preserving OpenClaw as the runtime.

Validation commands:

```bash
CI=true pnpm install
cd openclaw && CI=true pnpm install
cd ..
pnpm --filter @sentura/mcp-cross-border-intel build
bash -n scripts/sentura-setup.sh && bash -n scripts/start-sentura-demo.sh
bash scripts/sentura-setup.sh
docker start sentura-cbe-postgres || docker run -d --name sentura-cbe-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sentura_cbe_dev -p 127.0.0.1:5432:5432 -v sentura-cbe-postgres-data:/var/lib/postgresql/data postgres:16
docker exec sentura-cbe-postgres pg_isready -U postgres -d sentura_cbe_dev
CBE_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev" pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed
./scripts/start-sentura-demo.sh restart
./scripts/start-sentura-demo.sh status
curl -sS http://localhost:18789/healthz
curl -I http://localhost:3000/client-demos/cross-border/employee
curl -I http://localhost:3000/client-demos/cross-border/admin/login
pnpm --filter @sentura/mcp-cross-border-intel test
pnpm --dir sentura/dashboard exec tsc --noEmit
CBE_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev" pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db
CBE_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev" pnpm exec tsx scripts/test-cross-border-agents.ts
```

Latest verification, 2026-06-22:

- Root `pnpm install`: PASS across 17 workspace projects.
- `openclaw/ pnpm install`: PASS and installed the packaged `openclaw` CLI dependency used by the fallback path.
- OpenClaw source build attempt: BLOCKED in this checkout by missing source workspace packages; startup scripts now prefer the packaged CLI fallback when present.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `bash scripts/sentura-setup.sh`: PASS after adding packaged CLI fallback, stale Sentura extension path pruning, Dashboard env upsert, and a timeout guard for `agents add` calls that write config but keep open handles.
- `sentura-setup.sh` idempotency rerun: PASS; stale old-checkout Sentura extension paths were pruned from `~/.openclaw/openclaw.json`.
- Docker PostgreSQL 16 container `sentura-cbe-postgres`: PASS; `pg_isready` returned ready.
- Migration seed: PASS; migrations `001` through `007` applied and seed produced tenant `cross-border-ecommerce`, one admin, and two operator users.
- `./scripts/start-sentura-demo.sh restart`: PASS; Gateway and Dashboard were started from `/Users/eee/Desktop/Sentura-Platform-ecommerce`.
- Gateway health: PASS, `GET /healthz` returned live status.
- Dashboard page smoke: PASS, Employee route and Admin login route returned HTTP 200.
- Admin login smoke: PASS, `孙总/1234` returned an admin session.
- Employee API smoke: PASS, `GET /api/client-demos/cross-border/employee/customers` with `x-cbe-user-id: cbe-user-operator-001` returned a JSON envelope.
- Employee browser smoke: PASS, `Lin Yue/1234` logged in and rendered `个人中心`, `获客与背调`, and `记忆整理` navigation with DB-backed empty state.
- Manager browser smoke: PASS, `孙总/1234` logged in and rendered `员工管理`, `高分客户`, and `成本监控` navigation with seeded employees visible.
- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 23/23.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `CBE_DATABASE_URL=... pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 217/217.
- `CBE_DATABASE_URL=... pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 413/413.

Assertions:

| # | Check | Method | Expected |
|---|---|---|---|
| CE24.1 | Dependency install | `pnpm install` | Root and `openclaw/` installs complete without requiring committed secrets. |
| CE24.2 | OpenClaw CLI fallback | Static/script run | Setup/start scripts use `openclaw/node_modules/openclaw/openclaw.mjs` when source runner/build artifacts are unavailable. |
| CE24.3 | Stale config path cleanup | Setup rerun + config inspection | Old Sentura extension paths outside the current checkout are pruned; current `sentura/extensions/sentura-*` paths remain registered. |
| CE24.4 | Agent registration robustness | Setup rerun | CBE agents are registered idempotently even when the packaged CLI leaves open handles after writing config. |
| CE24.5 | Dashboard env wiring | File/env smoke | `.env.local` contains Gateway WebSocket URL, Control UI URL, Sentura admin env, and `CBE_DATABASE_URL`; secrets are not copied into docs. |
| CE24.6 | PostgreSQL ready | Docker + migration | PostgreSQL 16 is reachable, migrations `001`-`007` apply, and seed creates expected CBE tenant/users. |
| CE24.7 | Current-checkout runtime | Process cwd check | Gateway cwd is the current checkout's `openclaw/`; Dashboard cwd is the current checkout's `sentura/dashboard/`. |
| CE24.8 | Gateway/Dashboard health | HTTP smoke | Gateway `/healthz`, Employee route, and Admin login route respond successfully. |
| CE24.9 | Role login smoke | HTTP/browser | Admin `孙总/1234` and Employee `Lin Yue/1234` sessions reach the expected pages without app runtime errors. |
| CE24.10 | Regression gates | Automated scripts | MCP tests, Dashboard typecheck, live Phase 2 store checks, and CBE agent checks pass. |

Known limitations:

- `sentura-memory-lancedb` is skipped by the packaged OpenClaw host because the host package is `2026.5.28` while the plugin declares API `>=2026.6.2`. This does not block the CBE Dashboard/API startup smoke, but long-term memory plugin testing requires a complete/newer OpenClaw runtime.
- No real external Lead/Screening/Accio task was launched in this recovery smoke. External AI/API runs still require provider keys and `GOOGLE_MAPS_API_KEY` / related source keys in `~/.openclaw/.env` or another configured secret source.
