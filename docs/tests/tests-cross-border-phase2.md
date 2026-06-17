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

Status: PEND

Planned scope:

- Replace `use-cbe-employee-store` customer/task/memory source-of-truth reads with P2.2 API endpoints.
- Keep `localStorage` only for drafts/cache or explicit fallback.
- Refresh `个人中心`, `获客与背调`, and `记忆整理` from DB-backed projections.
- Notifications and report drawers backed by DB records.

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
