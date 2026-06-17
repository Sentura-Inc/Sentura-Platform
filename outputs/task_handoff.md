# Sentura CBE Continuation Handoff

## Current Resume Snapshot

Default continuation rule: read this file first, especially this snapshot and `Next Steps`. Do not read `docs/MEMORY.md` by default. Use `docs/MEMORY.md` only as a targeted historical index when this file names a specific prior project-memory row, section, or detail to check.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce Phase 2 persistence.

## Completed Current Turn — 2026-06-17 P2.1 Recheck

User asked to recheck the Phase 2 P2.1 implementation and decide whether we can proceed to the next step.

Completed:

- Read `outputs/resume_card.md` and targeted P2.1/CE18 references from `outputs/task_handoff.md`, `docs/tests/tests-cross-border-phase2.md`, and `跨境电商/PHASE-2.md`.
- Confirmed tool versions: Node `v24.16.0`, pnpm `11.5.1`.
- `pg_isready`, `psql`, and `createdb` are not on PATH in this shell, so local DB setup/checks used project `pg`.
- Reused local database `sentura_cbe_dev` through `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`.
- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 64/64 static checks.
- `CBE_DATABASE_URL=... pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 74/74 static + live checks.
- `CBE_DATABASE_URL=... pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS; migrations skipped as already applied and seed summary was `seededUsers=3`, `adminProfiles=1`, `operatorProfiles=2`.
- Focused strict NodeNext compile for P2.1 files: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store/index.ts`: PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.
- DB probes confirmed migrations `001/002`, roles `admin=1` and `operator=2`, views `cbe_agent_usage_daily`, `cbe_customer_work_items`, `cbe_operator_workload_daily`, and rejection of invalid `platform_admin` CBE role.
- Secret hygiene over migration/seed/source ID files: PASS.
- `git diff --check`: PASS.
- RULES/CONTEXT absence check: PASS.
- Updated Phase 2 memory/test docs with the 2026-06-17 recheck result:
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `docs/MEMORY.md`
  - `docs/tests/tests-cross-border-phase2.md`
  - `docs/TESTS.md`

Decision:

- P2.1 is complete and clear to proceed to P2.2.
- Next implementation step: typed Dashboard store API modules and Next.js route handlers for validated Employee customer/task/memory reads plus Lead/Screening/Accio completion writes.

## Previous Completed Turn — 2026-06-17 Phase 2 Memory/Test Split

User asked: from now on all CBE memory and tests should be Phase 2 related; create new Phase 2 memory/test docs, reorganize related content into them, and update `AGENTS.md`.

Completed:

- Created `docs/memory/cross-border-ecommerce/phase-2.md`.
- Created `docs/tests/tests-cross-border-phase2.md`.
- Moved/reorganized Phase 2 content into the new files:
  - Next-phase planning readout.
  - Phase 2 execution plan.
  - Phase 2 user stratification.
  - Phase 2 customer Admin monitoring redesign.
  - Phase 2 P2.1 business database foundation.
  - 2026-06-17 memory/test split session.
  - CE17 and CE18 test details.
  - CE19-CE22 PEND placeholders.
- Updated `docs/MEMORY.md`:
  - Current Ground Truth says current/future CBE Phase 2 memory/tests use `phase-2.md` and `tests-cross-border-phase2.md`.
  - Phase 2 rows now link to `memory/cross-border-ecommerce/phase-2.md`.
  - Added the 2026-06-17 matrix row for this doc split.
- Updated `docs/TESTS.md`:
  - Last updated text.
  - Phase 2 detailed-case note.
  - CE17/CE18 detail links now point to `tests-cross-border-phase2.md`.
  - Contributor policy includes `tests-cross-border-phase2.md`.
  - DOC2 on-demand count updated to `>= 50`.
- Updated `docs/memory/cross-border-ecommerce/phase-1.md`:
  - Added a Phase 2 split note saying it is now historical Phase 1/MVP memory.
- Updated `docs/tests/tests-cross-border-ecommerce.md`:
  - Added a Phase 2 split note saying it remains CE1-CE16/MVP regression detail and CE17+ active details live in `tests-cross-border-phase2.md`.
- Updated `AGENTS.md`:
  - Mandatory CBE Phase 2 reads now include `phase-2.md` and `tests-cross-border-phase2.md`.
  - Reference docs and test-file conventions now include the Phase 2 test file.
  - Rule 4 now directs CBE Phase 2 test details to `tests-cross-border-phase2.md`.
- Updated `README.md` Key Documentation:
  - Added explicit rows for active CBE Phase 2 memory and test docs.
  - Marked Phase 1 memory/test docs as historical/regression context.

Preserved:

- `docs/memory/cross-border-ecommerce/phase-1.md` remains intact as historical/audit memory.
- `docs/tests/tests-cross-border-ecommerce.md` remains intact as Phase 1/MVP and CE1-CE16 regression detail. Historical CE17/CE18 sections may remain there, but the new Phase 2 file is the active detail source.

## Verification Completed

- `test -s docs/memory/cross-border-ecommerce/phase-2.md`
- `test -s docs/tests/tests-cross-border-phase2.md`
- `rg -n "On-demand reference — not read by default|Phase 2 memory/test document split|CE17|CE18" docs/memory/cross-border-ecommerce/phase-2.md docs/tests/tests-cross-border-phase2.md`
- `rg -l 'On-demand reference — not read by default' docs/ ekg/ Documents/ 跨境电商/ | wc -l` -> 50.
- `git diff --check` -> pass.
- `find ... RULES.md/CONTEXT.md` -> none found outside pruned dirs.

## Previous P2.1 State

P2.1 business database foundation is already complete:

- PostgreSQL migrations under `sentura/lib/cross-border-store/migrations/`.
- Migration runner/seed under `sentura/lib/cross-border-store/`.
- Dashboard CBE role constants under `sentura/dashboard/src/lib/cross-border-store/`.
- CE18 script `scripts/test-cross-border-phase2-store.ts`.
- Local dev database `sentura_cbe_dev` was created and verified last turn.

## Next Steps

1. Start P2.2 typed Dashboard store API:
   - modules under `sentura/dashboard/src/lib/cross-border-store/`;
   - reuse CBE Zod schemas where possible;
   - add DB projection/write schemas where needed.
2. Add first route handlers:
   - Employee customer/task/memory read endpoints;
   - Lead/Screening/Accio completion write endpoints that accept only validated marker JSON plus `agent_run_id` / `session_key`.
3. Store parse/write failures as failed `agent_runs` plus `audit_events`.
4. Keep Employee UI state migration (P2.3) behind route/store tests.
5. Do not start P2.4 duplicate-run coordinator until P2.2 store writes are real.

Important: all new CBE Phase 2 session memory goes to `docs/memory/cross-border-ecommerce/phase-2.md`; all new CBE Phase 2 detailed tests go to `docs/tests/tests-cross-border-phase2.md`.
