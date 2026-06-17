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

## Current Phase 2 Ground Truth

- Phase 2 is the current active CBE implementation lane. New CBE production/database/customer-admin/concurrency/store/UI-persistence work should log here, not in `phase-1.md`.
- Phase 1 remains historically important but is not the default detail file for new Phase 2 sessions.
- Customer-facing CBE roles are only `operator` and `admin`.
- `operator` uses the existing `个人中心`, `获客与背调`, and `记忆整理` surfaces.
- `admin` is a customer-side monitoring/supervisor role for live tasks, aggregate lists, per-user lists, Agent usage, costs, failures, and statistics. It is not a Sentura platform administrator and must not expose employee creation, prompt/tool/model/provider settings, OpenClaw config, Gateway config, MCP config, or sandbox/tool-policy changes.
- P2.1 is complete. The PostgreSQL foundation lives under `sentura/lib/cross-border-store/` and uses `CBE_DATABASE_URL`; credentials must remain in env/secret injection, not committed files.
- P2.2 is next: typed Dashboard store API and route handlers that validate employee marker JSON before DB writes.

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
