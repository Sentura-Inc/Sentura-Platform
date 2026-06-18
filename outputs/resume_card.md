# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Current local workspace: `/Users/purest./Documents/Sentura/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese UI labels.

Active task, 2026-06-19:

- Current immediate fix completed: Employee and Manager no longer overwrite each other's CBE login session. Auth now writes role-scoped cookies (`sentura_cbe_employee_session`, `sentura_cbe_admin_session`) plus legacy compatibility, AppShell calls `/api/client-demos/cross-border/session?role=operator|admin`, tenant context enforces expected roles for Employee/Admin API paths, and logout clears the relevant role cookie. Also fixed `usePersistentUiState` first-render localStorage hydration mismatch. Verified with Dashboard typecheck, `scripts/test-cross-border-phase2-store.ts` 174/174, `scripts/test-cross-border-agents.ts` 392/392, HTTP dual-cookie role-isolation smoke, and browser Manager login persistence on `http://127.0.0.1:3002`.

- Current immediate fix completed: Manager now has `/client-demos/cross-border/admin/login`, copied from the Employee login layout with Manager labels. Preset Manager login is `孙总` / `1234`; successful login signs `sentura_cbe_session` with `cbeRole=admin` and redirects to `/client-demos/cross-border/admin/employees`. Manager APIs now use cookie session by default; `NEXT_PUBLIC_CBE_ADMIN_USER_ID` is only an explicit override. Verified with `tsc --noEmit`, `scripts/test-cross-border-phase2-store.ts` 172/172, `scripts/test-cross-border-agents.ts` 389/389, and HTTP smoke on `localhost:3002` for good password, wrong password, session, and admin operators API.

- Current immediate fix completed: Manager-side `查看报告` now reuses the Employee/shared `CustomerReportDialog` only. `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx` renders through a body portal at `z-[70]` so opening reports from the Manager employee detail dialog is not clipped by the parent dialog. `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx` no longer contains the duplicate Manager-specific report dialog/layout helpers. Verified with focused ESLint, `tsc --noEmit`, `git diff --check`, and Chrome smoke on `http://localhost:3002/client-demos/cross-border/admin/employees` using Lin Yue -> Currys `查看报告`; report sections and metrics were visible, X close and outside-click close worked.

- Implement the CBE Manager system at `/client-demos/cross-border/admin`.
- User-approved scope:
  - three Manager pages only: `员工管理`, `高分客户`, `成本监控`;
  - real data connected to current Employee DB/task/report/cost surfaces;
  - same logo/style as Employee UI;
  - Employee platform title becomes `跨境电商员工操作系统`;
  - Manager platform title becomes `跨境电商管理者系统`;
  - Manager can create employee accounts and suspend/reactivate employees;
  - platform authentication via existing Sentura RBAC `userToken` path for v1;
  - cost limits support day/week/month/all-time;
  - over-limit task creates an approval request and does not launch OpenClaw session;
  - Manager approval adds temporary allowance; employee retries after approval;
  - high-value customers use existing high/trusted-candidate Screening result.
- Current status:
  - Backend/API/UI implementation is in place.
  - Added migration `003_manager_cost_controls.sql` for profile email, cost limits, temporary allowances, and approval requests.
  - Added cookie-backed login/session routes and RBAC token login.
  - Rebuilt admin store functions for employees, high-value customers, costs, limits, and approvals.
  - Wired Lead/Screening/Accio task creation to budget preflight and task cost estimates.
  - Added manager routes/pages: `/admin/employees`, `/admin/high-value-customers`, `/admin/costs`.
  - AppShell now switches titles/nav between `跨境电商员工操作系统` and `跨境电商管理者系统`.
  - Verification passed:
    - `pnpm --dir sentura/dashboard exec tsc --noEmit`
    - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts` (164/164)
    - `pnpm exec tsx scripts/test-cross-border-agents.ts` (368/368)
    - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db` (184/184)
    - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm --dir sentura/dashboard build`
    - browser smoke on `http://127.0.0.1:3001`
    - live budget smoke: over-limit Lead create returned `cost_approval_required`, created approval, created zero `agent_runs`, then cleaned temporary DB rows.
  - A production verification server is running on `http://127.0.0.1:3001` with admin debug identity.
  - Worktree already dirty from earlier CBE work; do not revert unrelated edits.
- Main files likely to edit:
  - `sentura/lib/cross-border-store/migrations/*`
  - `sentura/dashboard/src/lib/cross-border-store/*`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/**`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/**`
  - `sentura/dashboard/src/components/app-shell.tsx`
  - Employee task submit pages/API helpers.
- Required validation:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`
  - `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`
  - browser smoke for Employee three pages and Manager three pages.

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
