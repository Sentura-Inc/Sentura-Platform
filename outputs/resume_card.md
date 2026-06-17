# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese UI labels.

Latest completed task, 2026-06-17:

- Completed Phase 2 P2.3 Employee DB-backed UI migration from `跨境电商/PHASE-2.md`.
- Fixed the follow-up live DB inspection gap after manual psql queries exposed stale UI-projection column assumptions.
- Added `scripts/inspect-cross-border-live-db.sql` as the supported runbook for checking whether Lead/Screening/Accio writes reached PostgreSQL.
- Added `employee-api.ts` as the typed client-side adapter for P2.2 Employee APIs.
- Moved Employee home/customers/memory page reads to DB-backed endpoints:
  - `个人中心`
  - `获客与背调`
  - `记忆整理`
- Reduced `use-cbe-employee-store` persistence to `draftCache` only.
- Kept demo seed rows only behind `NEXT_PUBLIC_CBE_USE_DEMO_SEED=1` or `CBE_USE_DEMO_SEED=1`.
- Wired hidden Lead/Screening/Accio tasks to:
  - create DB `agent_runs` / import rows before OpenClaw session start;
  - reuse a planned `session_key`;
  - call validated completion endpoints after marker parsing;
  - call the task failure endpoint on Gateway/model/marker failures;
  - refresh DB-backed customer/task/memory lists after writes.
- Lead/Screening marker normalization fails missing traceable source URLs instead of writing placeholder evidence.
- Updated notification center to poll terminal DB-backed task projections and mark read through the API.
- Added `employee/tasks/[id]/fail` route and store failure helper.
- Expanded customer and Accio projections with report/source/memory fields needed by the existing UI.
- Documented that physical tables intentionally differ from UI projection names:
  - `lead_candidates` has `normalized_domain`, not `website`;
  - `lead_sources` has `excerpt`, not `finding`;
  - `screening_targets` stores website under `supplied_fields_json->>'website'`;
  - `screening_reports` joins `screening_targets` for `company_name`;
  - `lead_candidates` joins `lead_runs` for `agent_run_id`.

Verification:

- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 127/127.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 337/337.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147.
- `scripts/inspect-cross-border-live-db.sql` executed against local `sentura_cbe_dev` through node-postgres: PASS, no missing-column errors. User-facing psql command: `psql "postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev" -f scripts/inspect-cross-border-live-db.sql`.
- Focused Dashboard ESLint for Employee pages/components/store/API/store modules: PASS.
- `cd sentura/dashboard && pnpm build`: PASS.
- Browser validation for `/client-demos/cross-border/employee`, `/employee/customers`, and `/employee/memory`: PASS, no console errors.

Docs updated:

- `跨境电商/PHASE-2.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `scripts/inspect-cross-border-live-db.sql`

Important boundary:

- P2.3 does not implement cross-user Lead Discovery dedupe.
- The next phase is P2.4 Lead Discovery coordinator concurrency.

Next:

- Start P2.4:
  - add run-scope fingerprinting before launching `cbe-lead-discovery`;
  - exact duplicate scopes join one active run via memberships;
  - near duplicates offer choices;
  - completed-pool reuse and top-up denylist behavior are implemented and tested.
