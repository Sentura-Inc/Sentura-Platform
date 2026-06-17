> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md)

# Cross-Border E-Commerce — Phase 2

Independent Phase 2 memory for the mobile-accessory Cross-border e-commerce / 跨境电商 client pilot. Use this file for production persistence, customer `admin`/`operator` role boundaries, Admin monitoring, typed store/API routes, DB-backed Employee state, Lead coordination, durable Screening/Accio workflows, load-smoke work, and all future Phase 2 implementation notes. Phase 1 and demo-era history remains in [`phase-1.md`](phase-1.md) as historical audit context.

## Sessions in this file

| Date | Session | Summary |
|---|---|---|
| 2026-06-16 | Next-phase planning readout | Recommended starting Phase 2 with the tenant-scoped CBE business database and typed store layer before localStorage migration, Lead coordinator, or agent tuning. |
| 2026-06-16 | Phase 2 execution plan | Filled `跨境电商/PHASE-2.md` with the production-hardening plan and CE17 coverage. |
| 2026-06-16 | Phase 2 user stratification | Added the first role-boundary design, later superseded by the customer-specific two-level model. |
| 2026-06-16 | Phase 2 customer Admin monitoring redesign | Superseded the broad Sentura-RBAC-style role model with CBE-specific `operator` and `admin` customer levels. |
| 2026-06-16 | Phase 2 P2.1 business database foundation | Implemented PostgreSQL migrations, migration runner, seed tenant/users/profiles, dashboard CBE role/module constants, and CE18 static/live DB verification. |
| 2026-06-17 | Phase 2 memory/test document split | Created this Phase 2 memory file and `docs/tests/tests-cross-border-phase2.md`; updated AGENTS/README/matrices so future CBE Phase 2 memory and tests use the new docs. |
| 2026-06-17 | Phase 2 P2.1 re-verification | Re-ran CE18 static/live PostgreSQL checks, migration seed, focused TS/lint, full dashboard typecheck, legacy CBE suite, DB role/view probes, secret hygiene, and repo hygiene before proceeding to P2.2. |
| 2026-06-17 | Phase 2 P2.2 typed Dashboard store/API routes | Implemented typed Dashboard CBE store modules, Employee/Admin App Router routes, validated Lead/Screening/Accio completion writes, marker parse-failure run/audit handling, and CE19 static/live PostgreSQL checks. |

## Current Phase 2 Ground Truth

- Phase 2 is the current active CBE implementation lane. New CBE production/database/customer-admin/concurrency/store/UI-persistence work should log here, not in `phase-1.md`.
- Phase 1 remains historically important but is not the default detail file for new Phase 2 sessions.
- Customer-facing CBE roles are only `operator` and `admin`.
- `operator` uses the existing `个人中心`, `获客与背调`, and `记忆整理` surfaces.
- `admin` is a customer-side monitoring/supervisor role for live tasks, aggregate lists, per-user lists, Agent usage, costs, failures, and statistics. It is not a Sentura platform administrator and must not expose employee creation, prompt/tool/model/provider settings, OpenClaw config, Gateway config, MCP config, or sandbox/tool-policy changes.
- P2.1 is complete and was re-verified on 2026-06-17. The PostgreSQL foundation lives under `sentura/lib/cross-border-store/` and uses `CBE_DATABASE_URL`; credentials must remain in env/secret injection, not committed files.
- P2.2 typed Dashboard store/API routes are complete. P2.3 DB-backed Employee UI migration is next; `localStorage` remains the Employee UI source of truth until that migration lands.

## 2026-06-16 — Next-phase planning readout

### Context

The Employee UI and hidden OpenClaw task runner had reached CE16 coverage, but customer rows, task records, notifications, reports, and memory previews were still local/client-persisted. That blocked multi-user behavior, dedupe, audit, retry, and production readiness.

### Decision

Start Phase 2 with the shared CBE business database and typed persistence/store layer, then:

1. Replace Employee localStorage as the source of truth.
2. Add Lead Discovery run-scope dedupe/shared-result coordination.
3. Tune the three employees against durable run/evidence/handoff contracts.
4. Add duplicate-run and 30-50 user/load-smoke coverage once the store and coordinator exist.

### Boundary

Keep one OpenClaw Gateway with three persistent CBE employees for this single customer trust boundary. Do not give employees raw SQL credentials or SQL tools.

## 2026-06-16 — Phase 2 execution plan

### Changes made

- Filled `跨境电商/PHASE-2.md` with:
  - source alignment table;
  - Phase 2 goals and non-goals;
  - P2.1-P2.6 execution order;
  - PostgreSQL-compatible tenant-scoped schema and indexes;
  - typed store and Next.js route-handler boundary;
  - Employee state migration plan;
  - Lead Discovery coordinator algorithm;
  - durable Screening and Accio persistence/approval workflows;
  - backpressure/load-smoke plan;
  - implementation files, tests, acceptance criteria, and risks.
- Linked Phase 2 from README/AGENTS/DESIGN.
- Added CE17 coverage.

### Boundary

This was a planning/documentation pass. No runtime schema, route, store, or UI migration code was added in that session.

## 2026-06-16 — Phase 2 user stratification

### Changes made

- Added an initial user-stratification design in `跨境电商/PHASE-2.md`.
- Mapped broader Sentura-style roles into CBE-facing concepts.
- Added database implications around CBE profiles, row ownership, departments, visibility, budget policies, and data-source settings.
- Expanded CE17 coverage.

### Supersession

This session was superseded later the same day by the customer-specific Admin monitoring redesign. The current model is only `operator` and `admin`.

## 2026-06-16 — Phase 2 customer Admin monitoring redesign

### User clarification

The customer is not buying an employee-creation console. Ordinary users should use the current Employee UI. Admin should monitor which human user is running which task, which CBE Agent is investigating which target, aggregate acquisition/screening lists, per-user lists, usage, costs, failures, and statistics.

### Current decision

- `operator` / 普通用户 / 业务员工:
  - uses `个人中心`, `获客与背调`, and `记忆整理`;
  - starts Lead/Screening/Accio work;
  - sees own/shared work and retryable own failures.
- `admin` / 管理员 / 业务主管:
  - read-mostly customer supervisor;
  - monitors live/recent tasks, aggregate lists, per-user views, Agent usage, costs, failures, and statistics;
  - cannot create AI employees or modify prompts, tools, models, providers, OpenClaw config, Gateway config, MCP config, sandbox/tool policy, or duplicate-run coordinator behavior.

### Files updated

- `跨境电商/PHASE-2.md`
- `跨境电商/UI.md`
- `跨境电商/DESIGN.md`
- `README.md`
- `AGENTS.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-1.md`

### Boundary

This was still design/documentation only. Runtime enforcement and Admin pages remained future work.

## 2026-06-16 — Phase 2 P2.1 business database foundation

### User request

Start the next phase from `跨境电商/PHASE-2.md` 2.1/P2.1, use local PostgreSQL (`postgres` user on port 5432), strictly follow the plan, and check the implementation.

### Scope completed

- PostgreSQL schema/migration files.
- `CBE_DATABASE_URL`-driven DB config loading.
- Migration runner and deterministic seed data.
- Tenant `cross-border-ecommerce`, one `admin`, and two `operator` profiles.
- Dashboard-side CBE role/module boundary constants for later P2.2 route work.
- CE18 verification script with static and live PostgreSQL checks.

### Files added

- `sentura/lib/cross-border-store/migrations/001_initial_schema.sql`
- `sentura/lib/cross-border-store/migrations/002_lead_scope_coordinator.sql`
- `sentura/lib/cross-border-store/db.ts`
- `sentura/lib/cross-border-store/ids.ts`
- `sentura/lib/cross-border-store/schemas.ts`
- `sentura/lib/cross-border-store/seed.ts`
- `sentura/lib/cross-border-store/migrate.ts`
- `sentura/lib/cross-border-store/index.ts`
- `sentura/dashboard/src/lib/cross-border-store/index.ts`
- `scripts/test-cross-border-phase2-store.ts`

### Files updated

- `package.json`
- `pnpm-lock.yaml`
- `sentura/lib/index.ts`
- `sentura/lib/package.json`
- `sentura/lib/tsconfig.json`
- `跨境电商/PHASE-2.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-1.md`

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 64/64 static checks.
- `CBE_DATABASE_URL=... pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 74/74 static + live DB checks.
- `CBE_DATABASE_URL=... pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS; skipped both already-applied migrations and returned `seededUsers=3`, `adminProfiles=1`, `operatorProfiles=2`.
- Focused TypeScript compile for new store/test files: PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store/index.ts`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.
- `git diff --check`: PASS.

### Known boundary

Full `sentura/lib` typecheck remained blocked by pre-existing `.ts` import-extension errors in `config-versioning.ts`, `per-agent-mcp.ts`, and `secrets.ts`. The new cross-border store files were typechecked directly under strict NodeNext settings.

Next implementation step is P2.2: typed store API and Next.js route handlers that validate employee marker JSON before DB writes.

## 2026-06-17 — Phase 2 memory/test document split

### User request

The user clarified that from now on all CBE memory and tests should be Phase 2 related, and asked to create new Phase 2 memory and test documents, reorganize the relevant content into them, and update `AGENTS.md`.

### Changes made

- Created this file: `docs/memory/cross-border-ecommerce/phase-2.md`.
- Created `docs/tests/tests-cross-border-phase2.md`.
- Updated `docs/MEMORY.md` so Phase 2 rows point to this file and future Phase 2 sessions are expected here.
- Updated `docs/TESTS.md` so CE17/CE18 detail links point to the new Phase 2 test detail file.
- Updated `AGENTS.md` to make the Phase 2 CBE memory/test docs the default for production/database/concurrency/customer-admin/store/UI-persistence work.
- Updated `README.md` Key Documentation so the new docs are visible from the doc hub.

### Boundary

No business-code changes were made in this session. This is a documentation topology change for future Phase 2 work. Historical Phase 1 detail and test files remain intact for auditability.

## 2026-06-17 — Phase 2 P2.1 re-verification

### User request

The user asked to recheck the P2.1 implementation and decide whether Phase 2 can proceed to the next step.

### Verification performed

- Read the current resume card and targeted handoff references for P2.1/CE18.
- Verified local tool versions: Node `v24.16.0`, pnpm `11.5.1`.
- Confirmed `pg_isready`, `psql`, and `createdb` are not on the current shell `PATH`, then used the project `pg` dependency to connect to local PostgreSQL as `postgres:postgres` and reuse `sentura_cbe_dev`.
- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 64/64 static checks.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 74/74 static + live DB checks.
- `CBE_DATABASE_URL=... pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS; migrations skipped as already applied and seed returned `seededUsers=3`, `adminProfiles=1`, `operatorProfiles=2`.
- Focused strict NodeNext compile for new store/test files: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store/index.ts`: PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335 legacy CBE checks.
- DB probe confirmed migrations `001/002`, CBE roles `admin=1` and `operator=2`, all three projection views, and rejection of invalid `platform_admin` CBE role by DB constraint.
- Secret hygiene grep over migration/seed/source ID files returned no committed database URLs, passwords, API keys, app secrets, bearer tokens, emails, or raw tokens.
- `git diff --check`: PASS.
- No `RULES.md` / `CONTEXT.md` files were found outside pruned dependency/git directories.

### Decision

P2.1 remains complete. It is safe to proceed to P2.2: typed Dashboard store API modules and Next.js route handlers for validated Employee customer/task/memory reads plus Lead/Screening/Accio completion writes.

## 2026-06-17 — Phase 2 P2.2 typed Dashboard store/API routes

### User request

The user asked to start from P2.2 in `跨境电商/PHASE-2.md`, strictly follow the plan, complete the next-phase work, and check the implementation.

### Scope completed

- Added typed Dashboard CBE store modules under `sentura/dashboard/src/lib/cross-border-store/`:
  - DB pool/config boundary using `CBE_DATABASE_URL`;
  - Zod request/marker schemas;
  - tenant context and `operator`/`admin` role enforcement;
  - `agent_runs`, audit, activity event, customer, task, notification, Lead, Screening, Accio, handoff, API ledger, and Admin read modules.
- Added Employee App Router API routes under `sentura/dashboard/src/app/api/client-demos/cross-border/employee/`:
  - customer/task/notification/memory reads;
  - Lead run create and complete;
  - Screening run create and complete;
  - Accio import create and complete;
  - task dismiss, notification read, and handoff create.
- Added Admin read-only monitoring API routes under `sentura/dashboard/src/app/api/client-demos/cross-border/admin/`:
  - overview;
  - live tasks;
  - customers;
  - operators;
  - operator detail;
  - Agent usage.
- Completion endpoints validate marker payloads before writes.
- Evidence-bearing Lead/Screening markers require source URLs and fetched timestamps.
- Validation failure routes mark the referenced `agent_runs` row failed with `error_code = marker_parse_failed` and write audit metadata when an `agent_run_id` is available.
- Lead completion writes candidates, source evidence, identities/results, activity events, and audits.
- Screening completion writes targets, reports, evidence, score blocks, activity events, and audits.
- Accio imports store hash/redacted message records only; Accio summaries create pending-review memory facts and Screening handoffs.
- Dashboard package now declares `pg`, `zod`, and `@types/pg`.
- Extended `scripts/test-cross-border-phase2-store.ts` with CE19 static checks and live PostgreSQL round-trip checks.

### Important boundary

P2.2 is server-side store/API work. It does not migrate the existing React Employee pages or `use-cbe-employee-store` off `localStorage`; that is P2.3. The P2.2 routes are now ready for that migration.

### Files added

- `sentura/dashboard/src/lib/cross-border-store/db.ts`
- `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
- `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`
- `sentura/dashboard/src/lib/cross-border-store/errors.ts`
- `sentura/dashboard/src/lib/cross-border-store/ids.ts`
- `sentura/dashboard/src/lib/cross-border-store/agent-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/audit.ts`
- `sentura/dashboard/src/lib/cross-border-store/api-ledger.ts`
- `sentura/dashboard/src/lib/cross-border-store/customers.ts`
- `sentura/dashboard/src/lib/cross-border-store/tasks.ts`
- `sentura/dashboard/src/lib/cross-border-store/notifications.ts`
- `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/screening.ts`
- `sentura/dashboard/src/lib/cross-border-store/accio.ts`
- `sentura/dashboard/src/lib/cross-border-store/handoffs.ts`
- `sentura/dashboard/src/lib/cross-border-store/admin.ts`
- `sentura/dashboard/src/lib/cross-border-store/route-utils.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/customers/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/lead-runs/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/lead-runs/[id]/complete/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/screening-runs/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/screening-runs/[id]/complete/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/[id]/dismiss/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/notifications/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/notifications/read/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/imports/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/imports/[id]/complete/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/handoffs/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/overview/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/live-tasks/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/customers/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/[id]/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/agent-usage/route.ts`

### Files updated

- `sentura/dashboard/src/lib/cross-border-store/index.ts`
- `sentura/dashboard/package.json`
- `pnpm-lock.yaml`
- `scripts/test-cross-border-phase2-store.ts`
- `跨境电商/PHASE-2.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`

### Verification

- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 109/109 static checks.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 129/129 static + live PostgreSQL checks.
- Live CE19 probe created and cleaned up Lead, Screening, Accio import/summary, pending memory fact, handoff, completed task, and failed marker-parse records.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store src/app/api/client-demos/cross-border/employee src/app/api/client-demos/cross-border/admin`: PASS.
- `cd sentura/dashboard && pnpm build`: PASS; Next route manifest includes all new Employee/Admin API routes.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.

### Fixes found during verification

- Store functions originally relied on route-level Zod defaults for `visibility_scope`; live direct-store tests caught null `visibility_scope` inserts. Fixed by parsing create inputs at the store boundary as well.
- Task/notification reads originally reused a scope helper that referenced `team_name`, but `agent_runs` has no `team_name` column. Fixed task/notification filters to use owner/user/tenant-shared scope for `agent_runs`, while keeping team scope for business record projections that actually have `team_name`.

### Next

Proceed to P2.3: migrate the Employee UI pages and `use-cbe-employee-store` to read/write through these DB-backed APIs, keeping localStorage only for drafts/cache or explicit fallback.
