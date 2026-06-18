> **On-demand reference — not read by default.**
>
> Back-link: [`docs/TESTS.md`](../TESTS.md)

# Cross-Border E-Commerce Phase 2 Tests

Detailed test cases for Phase 2 of the mobile-accessory Cross-border e-commerce / 跨境电商 independent client pilot. Use this file for production persistence, customer `admin`/`operator` monitoring, typed store/API routes, DB-backed Employee state, Lead coordination, durable Screening/Accio workflows, and load-smoke tests. Phase 1/MVP tests remain in [`tests-cross-border-ecommerce.md`](tests-cross-border-ecommerce.md) as historical and regression coverage.

## CE17 — Cross-Border Phase 2 Execution Plan

Status: PASS (2026-06-16; rechecked 2026-06-17)

Scope:

- `跨境电商/PHASE-2.md`
- `跨境电商/DESIGN.md`
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
| CE18.6 | Screening persistence schema | Static/live DB check | Screening tables cover targets, reports, evidence, score blocks, risk tier, normalized score, evidence coverage, recommended action, and report JSON. |
| CE18.7 | Accio persistence schema | Static/live DB check | Accio tables cover imports, conversations, redacted/hash-only messages, summaries, source file hash, storage key, validation status, and behavior summary JSON. |
| CE18.8 | Handoff/memory/cost/audit schema | Static/live DB check | `handoff_events`, `memory_facts`, `api_call_ledger`, and `audit_events` exist with tenant scope and structured JSON payload fields. |
| CE18.9 | Lead coordinator schema | Static/live DB check | `lead_discovery_scopes`, `lead_run_memberships`, `lead_identities`, `lead_run_results`, and `lead_allocations` exist with scope hash, lease, identity, membership, result, and allocation fields. |
| CE18.10 | Index coverage | Static/live DB check | Required indexes exist for lead domain uniqueness, Screening lookups/latest report, Accio lookup, cost/audit rollups, run status, active scopes, profile role, owner scopes, and activity monitoring. |
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

## CE21 — Lead Coordinator Concurrency

Status: PEND

Planned scope:

- Exact same-scope Lead requests create one active OpenClaw run and multiple memberships.
- Near duplicates offer choices.
- Completed pool reuse and top-up denylist work.

## CE22 — Screening/Accio Durable Workflow

Status: PEND

Planned scope:

- Screening writes targets/reports/evidence/score blocks.
- Accio writes import/conversations/redacted messages/summaries.
- Memory facts require approval before promotion.
- Extend beyond P2.2 completion writes into the full P2.5 workflow: report/evidence detail UI, approval-to-memory promotion, retry/recovery, and durable Screening handoff consumption.

## CE23 — Load Smoke

Status: PEND

Planned scope:

- 30-50 user readiness checks.
- Queued/running task counts.
- Cost/audit/load-smoke records.
