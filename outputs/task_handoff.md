# Sentura CBE Continuation Handoff

## Current Resume Snapshot

Default continuation rule: read `outputs/resume_card.md` first. Then read only this snapshot and `Next Steps` unless deeper history is required. Use `docs/MEMORY.md` as an index only when a specific prior row is needed.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce Phase 2 persistence and concurrency.

## Completed Current Turn — 2026-06-17 P2.3 Employee DB-Backed UI Migration + DB Inspection Fix

User asked: start from P2.3 in `跨境电商/PHASE-2.md`, strictly follow the plan, complete the next-stage task, and check the implementation.

Completed:

- Read continuation card/handoff plus the active CBE Phase 2 docs:
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `docs/tests/tests-cross-border-phase2.md`
  - `跨境电商/DESIGN.md`
  - `跨境电商/PHASE-2.md`
- Used the Next.js and React best-practices skills for App Router/client-component boundaries.
- Checked current official guidance for Next.js App Router route handlers and Zustand persistence behavior before finalizing the client/server split.
- Added a typed Employee client API adapter:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
- Updated the hidden task runner:
  - planned session keys;
  - exported Lead/Screening/Accio agent IDs;
  - hidden runs can reuse DB-created `session_key`;
  - prompts require evidence timestamps/source references where relevant.
- Updated Employee pages:
  - `个人中心` fetches customer/task/memory projections from APIs;
  - `获客与背调` fetches DB-backed customers/tasks and refreshes after Lead/Screening writes;
  - `记忆整理` fetches DB-backed memory/tasks and refreshes after Accio writes.
- Updated global Employee shell/notifications:
  - notification center polls terminal task projections from the Employee tasks API;
  - read state writes through the notification read API;
  - Accio terminal notifications link to `/employee/memory`.
- Updated `use-cbe-employee-store`:
  - `rows`, `memoryRows`, and `tasks` are in-memory projections from API reads;
  - `draftCache` is the only persisted state;
  - old seed rows are gated behind explicit demo seed env flags.
- Added failure route/store support:
  - `sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/[id]/fail/route.ts`
  - `FailEmployeeTaskRequestSchema`
  - `failEmployeeTask(...)`
- Expanded store projections:
  - customers now include matched products, website, recommended action, report JSON, source URLs;
  - Accio memory records now include agent run status, source file, conversation count, next actions, summary text, validation status, and classification.
- Fixed the manual DB inspection path after user psql queries exposed stale projection-only column assumptions:
  - added `scripts/inspect-cross-border-live-db.sql`;
  - documented that `lead_candidates.website`, `lead_sources.finding`, `screening_targets.website`, `screening_reports.company_name`, and `lead_candidates.agent_run_id` are not physical columns;
  - the script derives websites through `lead_run_results.source_snapshot_json`, `lead_candidates.normalized_domain`, or `screening_targets.supplied_fields_json`, and joins reports/candidates through their real FK paths.
- Extended test scripts:
  - `scripts/test-cross-border-phase2-store.ts` covers CE20/P2.3 static and live checks;
  - CE20.15 covers the live DB inspection SQL runbook;
  - `scripts/test-cross-border-agents.ts` now checks DB-backed API lifecycle, draft-cache-only persistence, marker normalization, and DB notifications.

Behavior implemented:

- Customer/task/memory reads are DB/API-backed, not browser-local source of truth.
- Local seed rows require `NEXT_PUBLIC_CBE_USE_DEMO_SEED=1` or `CBE_USE_DEMO_SEED=1`.
- Hidden Lead/Screening/Accio tasks create DB `agent_runs` or import rows before Gateway session creation.
- Completion writes call P2.2 validated endpoints after marker parsing succeeds.
- Failures call the new task failure route with stable error codes such as `gateway`, `backend_error`, `marker_missing`, `parse_error`, `timeout`, and `marker_parse_failed`.
- Successful writes refresh DB-backed customer/task/memory lists.
- Lead/Screening marker normalization fails missing traceable source URLs instead of writing placeholder evidence.
- Accio uploads are hashed/redacted before completion payload submission; memory facts remain pending/preview-only.

Verification completed:

- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 127/127.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 337/337.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147.
- `scripts/inspect-cross-border-live-db.sql` executed against local `sentura_cbe_dev` through node-postgres after removing psql-only `\echo` lines: PASS, no missing-column errors. User-facing command remains `psql "postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev" -f scripts/inspect-cross-border-live-db.sql`.
- Focused Dashboard ESLint:
  - `src/app/client-demos/cross-border/employee`
  - `src/components/app-shell.tsx`
  - `src/components/cross-border/employee-task-status.tsx`
  - `src/stores/use-cbe-employee-store.ts`
  - `src/lib/cross-border-store`
  - `src/app/api/client-demos/cross-border/employee/tasks/[id]/fail/route.ts`
  - PASS.
- `cd sentura/dashboard && pnpm build`: PASS; route manifest includes `employee/tasks/[id]/fail`.
- Browser validation using local dev server with `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`:
  - `/client-demos/cross-border/employee`: PASS;
  - `/client-demos/cross-border/employee/customers`: PASS;
  - `/client-demos/cross-border/employee/memory`: PASS;
  - no browser console errors.
- Employee GET API probes for customers, memory, and tasks returned HTTP 200 envelopes.
- `git diff --check`: PASS before doc updates; rerun after final doc sync before responding.
- RULES/CONTEXT absence check is expected before final response.

Docs updated:

- `跨境电商/PHASE-2.md`: P2.3 implemented; immediate next task is P2.4.
- `docs/tests/tests-cross-border-phase2.md`: CE20 PASS detail and CE20.15 inspection runbook added.
- `docs/TESTS.md`: CE20 summary row and CBE 20/20 summary updated.
- `docs/MEMORY.md`: Current Ground Truth and matrix row updated.
- `docs/memory/cross-border-ecommerce/phase-2.md`: P2.3 and DB inspection fix session details appended.
- `outputs/resume_card.md` and this handoff updated.

## Current Boundary

P2.3 is complete for DB-backed Employee UI state and hidden task lifecycle writes. It does not implement cross-user Lead Discovery dedupe.

Do not start P2.5 durable Screening/Accio workflow polish until P2.4 Lead Discovery coordinator concurrency is implemented and CE21 coverage passes, unless the user explicitly changes priority.

## Next Steps

1. Start P2.4 Lead Discovery coordinator:
   - define/normalize run-scope fingerprint inputs;
   - acquire a DB lease before starting any new `cbe-lead-discovery` Gateway session;
   - create one active run plus multiple memberships for exact duplicates.
2. Add near-duplicate handling:
   - compare country/product/persona/source/language scope;
   - return join/new/top-up choices to the UI.
3. Add completed-pool reuse and top-up mode:
   - reuse available unique identities;
   - pass `existing_identity_keys` denylist for missing unique leads.
4. Add CE21 tests:
   - static coordinator checks;
   - live PostgreSQL duplicate and near-duplicate probes;
   - Browser check if UI choices are implemented in the same slice.
