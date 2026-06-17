# Sentura CBE Continuation Handoff

## Current Resume Snapshot

Default continuation rule: read this file first, especially this snapshot and `Next Steps`. Do not read `docs/MEMORY.md` by default. Use `docs/MEMORY.md` only as a targeted historical index when this file names a specific prior project-memory row, section, or detail to check.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce Phase 2 persistence.

## Completed Current Turn — 2026-06-17 P2.2 Typed Dashboard Store/API Routes

User asked: start from P2.2 in `跨境电商/PHASE-2.md`, strictly follow the plan, complete the next-phase task, and check the implementation.

Completed:

- Read continuation card/handoff, `跨境电商/PHASE-2.md`, `跨境电商/DESIGN.md`, `docs/memory/cross-border-ecommerce/phase-2.md`, and `docs/tests/tests-cross-border-phase2.md`.
- Verified current Next.js Route Handler and Zod docs:
  - Next Route Handlers use Web `Request`/`Response` APIs inside `app`.
  - Next 16 dynamic route `params` is a Promise.
  - Zod `safeParse` is the right non-throwing API-boundary validator.
- Added `pg`, `zod`, and `@types/pg` to `sentura/dashboard/package.json`.
- Implemented typed Dashboard CBE store modules under `sentura/dashboard/src/lib/cross-border-store/`:
  - `db.ts`, `schemas.ts`, `tenant-context.ts`, `errors.ts`, `ids.ts`;
  - `agent-runs.ts`, `audit.ts`, `api-ledger.ts`;
  - `customers.ts`, `tasks.ts`, `notifications.ts`;
  - `lead-runs.ts`, `screening.ts`, `accio.ts`, `handoffs.ts`;
  - `admin.ts`, `route-utils.ts`;
  - updated `index.ts` barrel exports.
- Added Employee API routes:
  - `employee/customers/route.ts`
  - `employee/lead-runs/route.ts`
  - `employee/lead-runs/[id]/complete/route.ts`
  - `employee/screening-runs/route.ts`
  - `employee/screening-runs/[id]/complete/route.ts`
  - `employee/tasks/route.ts`
  - `employee/tasks/[id]/dismiss/route.ts`
  - `employee/notifications/route.ts`
  - `employee/notifications/read/route.ts`
  - `employee/memory/route.ts`
  - `employee/memory/imports/route.ts`
  - `employee/memory/imports/[id]/complete/route.ts`
  - `employee/handoffs/route.ts`
- Added Admin read-only monitoring API routes:
  - `admin/overview/route.ts`
  - `admin/live-tasks/route.ts`
  - `admin/customers/route.ts`
  - `admin/operators/route.ts`
  - `admin/operators/[id]/route.ts`
  - `admin/agent-usage/route.ts`
- Extended `scripts/test-cross-border-phase2-store.ts`:
  - P2.2 static checks for store modules/routes/schema boundaries;
  - live PostgreSQL round-trip through Dashboard store functions;
  - live probe creates and cleans Lead, Screening, Accio, pending memory fact, handoff, task, and marker-failure records.

Behavior implemented:

- `resolveCbeTenantContext(request)` resolves seeded `cbe_user_profiles` from `x-cbe-user-id` / `x-sentura-user-id`, defaulting to the seeded operator for local demo.
- Operator reads are server-side scoped to own/shared records; Admin routes call `requireCbeAdmin`.
- Completion routes use Zod validation before writes.
- Evidence-bearing Lead/Screening payloads require source URLs and fetched timestamps.
- Lead completion writes:
  - `lead_runs`, `lead_candidates`, `lead_sources`, `lead_identities`, `lead_run_results`, `agent_run_activity_events`, `audit_events`.
- Screening completion writes:
  - `screening_targets`, `screening_reports`, `screening_evidence`, `screening_score_blocks`, `agent_run_activity_events`, `audit_events`.
- Accio import/summary writes:
  - `accio_imports`, `accio_conversations`, hash/redacted-only `accio_messages`, `accio_summaries`, pending-review `memory_facts`, `handoff_events`, activity/audit rows.
- Parse/validation failures can set `agent_runs.status = failed`, `error_code = marker_parse_failed`, and audit metadata when an `agent_run_id` is present.

Important fixes discovered during verification:

- Store functions originally relied on route-level Zod defaults. Live store tests caught null `visibility_scope` on direct store calls. Fixed by parsing create inputs at the store boundary too.
- Task/notification reads originally reused a scope helper that referenced `team_name`, but `agent_runs` has no `team_name`. Fixed task/notification filters to use owner/user/tenant-shared scope; team scope remains for business projections that actually include `team_name`.

Verification completed:

- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 109/109.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 129/129.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store src/app/api/client-demos/cross-border/employee src/app/api/client-demos/cross-border/admin`: PASS.
- `cd sentura/dashboard && pnpm build`: PASS; route manifest lists all new Employee/Admin API routes.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.

Docs updated:

- `跨境电商/PHASE-2.md`: P2.2 implemented; next task changed to P2.3; CE roadmap shifted to CE19=P2.2, CE20=P2.3, CE21=P2.4, CE22=P2.5, CE23=P2.6.
- `docs/tests/tests-cross-border-phase2.md`: CE19 PASS details added; CE20-CE23 PEND placeholders adjusted.
- `docs/TESTS.md`: CE19 summary row added; CBE summary updated to 19/19 implemented sections PASS.
- `docs/MEMORY.md`: Current Ground Truth and Session Matrix updated.
- `docs/memory/cross-border-ecommerce/phase-2.md`: P2.2 session detail appended.

## Current Boundary

P2.2 is complete for server/store/API. It does not migrate the actual Employee React pages or `use-cbe-employee-store` off localStorage. That is P2.3.

Do not start P2.4 Lead coordinator until P2.3 UI reads/writes through the P2.2 endpoints, unless the user explicitly changes priority.

## Next Steps

1. Start P2.3 Employee UI migration:
   - replace customer/task/memory/notification reads with P2.2 API calls;
   - keep localStorage only for drafts/cache or explicit fallback;
   - refresh lists from DB after writes.
2. Wire hidden task runner completion:
   - after marker parsing succeeds, call Lead/Screening/Accio completion endpoints;
   - on marker/model/Gateway failure, call failure path where possible.
3. Add CE20 Browser/type/build coverage for:
   - `个人中心`;
   - `获客与背调`;
   - `记忆整理`;
   - task notifications/report drawers surviving refresh and route navigation.
