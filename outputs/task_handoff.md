# Sentura CBE Continuation Handoff

## Current Resume Snapshot

Default continuation rule: read `outputs/resume_card.md` first. Then read only this snapshot and `Next Steps` unless deeper history is required. Use `docs/MEMORY.md` as an index only when a specific prior row is needed.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Current local workspace for this continuation turn: `/Users/purest./Documents/Sentura/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce Manager system implementation.

## Current Turn — 2026-06-19 CBE Employee Notification Deep Links And Bell Preview Count

### Task Introduction

User asks to improve Employee-side notification behavior:

- Clicking a concrete bell/message item should jump to the concrete task target and flash a light-blue frame.
- Only clicking `查看全部消息` should go to the personal-center `消息提醒` section.
- Lead discovery (`获客`), screening (`背调`), and Accio memory (`记忆整理`) task messages should jump to the relevant company list / company rows and flash light blue.
- Cost quota / API budget related messages should jump to personal-center `我的 API 成本` and flash light blue.
- Messages shown inside personal-center `消息提醒` need the same deep-link + flash behavior.
- Bell dropdown should show up to 10 messages and have a vertical scroll area.

Hard constraints:

- Reuse existing `highlightTask` customer-list flash behavior where possible.
- Preserve the current Employee page information architecture and current columns.
- Do not turn every bell message into a personal-center link; only `查看全部消息` should do that.
- Keep user-facing response in Chinese.
- Update this handoff before broad edits and after verification.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard app: `sentura/dashboard`
- Local services currently verified:
  - Gateway: `http://localhost:18789`
  - Dashboard: `http://localhost:3000`
- Relevant files to inspect first:
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/stores/use-cbe-employee-store.ts`

### Task Flow

1. Inspect current `EmployeeNotificationBell`, personal-center message list, task notification shape, and existing customer-list `highlightTask` behavior.
2. Add a shared helper for task notification target URLs.
3. Route lead/screening/memory concrete task messages to the relevant task/company-list target with existing `highlightTask` semantics when possible.
4. Add a cost-card highlight target on Employee home for cost quota/API budget messages.
5. Make personal-center message items use the same target URL behavior.
6. Increase bell preview to 10 messages and keep the dropdown scrollable.
7. Verify with typecheck/lint and local HTTP/browser smoke.

### Progress So Far

- Next.js skill read completely.
- Memory quick pass found prior CBE notification work: `highlightTask` already maps task reminders to affected customer rows and flashes light-blue outlines for 3 seconds.
- Current runtime status checked: Gateway and Dashboard are running on `18789` and `3000`.
- Existing customer-list code already supports `/client-demos/cross-border/employee/customers?highlightTask=...`.
- Existing bell code currently renders every concrete item as `messageCenterHref`, which explains why item clicks go to personal-center messages instead of the concrete task target.

### Current State

- Handoff updated before code edits.
- No implementation edits for this notification request yet.

### Next Steps

1. Inspect all message rendering and task metadata shapes in the files listed above.
2. Implement shared target URL helper and highlight behavior.
3. Run `pnpm --dir sentura/dashboard exec tsc --noEmit`, focused lint, and browser smoke against `http://localhost:3000`.

## Current Turn — 2026-06-19 CBE Employee/Admin Login Kickout Bug

### Task Introduction

User reports both Employee operating platform and Manager platform have a bug where pages flash then return to the login screen. Intended outcome: fully inspect and fix the session/auth routing so neither platform is incorrectly kicked back to login.

Hard constraints:

- Fix the real auth/session chain, not a visual workaround.
- Preserve unrelated dirty worktree changes.
- Keep user-facing answer in Chinese.
- Update this handoff before broad edits and after verification.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard app: `sentura/dashboard`
- Current local server from prior verification: `http://localhost:3002`
- Relevant files:
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/app/api/auth/login/route.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/session/route.ts`
  - `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`
  - `sentura/dashboard/src/lib/cross-border-store/session.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_data/admin-api.ts`

### Task Flow

1. Inspect current AppShell guard, session API, login route, and tenant context resolution.
2. Reproduce with HTTP/cookie flows if possible.
3. Fix session mismatch and stale server/session behavior with a narrow auth-chain patch.
4. Add regression checks for both Employee and Manager.
5. Verify with TypeScript, CBE static scripts, and local HTTP smoke.

### Progress So Far

- Memory quick pass used: runtime verification must be prioritized, and Phase 2 docs/handoff must be synced after final verification.
- Next.js skill read for App Router auth/routing context.
- Initial search shows both platforms share `sentura_cbe_session`, and AppShell redirects immediately when the cookie role mismatches the current platform.
- Implemented role-scoped CBE auth cookies:
  - legacy cookie remains `sentura_cbe_session`
  - employee cookie is `sentura_cbe_employee_session`
  - admin cookie is `sentura_cbe_admin_session`
- Patched login/session/logout flow so Employee checks `role=operator` and Manager checks `role=admin`.
- Patched tenant context resolution so Employee APIs only accept operator sessions and Manager APIs only accept admin sessions.
- Patched AppShell and Employee home session fetches to use role-scoped session endpoints.
- Updated static regression scripts to assert role-scoped cookies/session/logout behavior.
- Verification completed before hydration fix:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit` passed.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts` passed with `174 passed, 0 failed` after escalation because pnpm registry signature fetch failed in the restricted sandbox.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` passed with `391 passed, 0 failed` after the same sandbox/network escalation.
- Local dev server check found PID `88092` listening on port `3002`, but sandboxed `curl` still could not connect to `http://localhost:3002`.
- `sentura/dashboard/.next/dev/logs/next-development.log` showed a real Employee home hydration mismatch: server rendered `本月`, client rendered persisted `本周`.
- Patched `sentura/dashboard/src/lib/use-persistent-ui-state.ts` so the first client render uses the stable default and reads `localStorage` after mount, preventing SSR/client text mismatch.
- Added a static regression assertion that persistent UI state avoids first-render `localStorage` hydration mismatch.
- Stopped unresponsive Next dev PID `88092`, restarted Dashboard dev server on `http://127.0.0.1:3002`, and completed smoke verification.
- Final verification:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `node_modules/.bin/tsx scripts/test-cross-border-phase2-store.ts`: PASS, `174 passed, 0 failed`.
  - `node_modules/.bin/tsx scripts/test-cross-border-agents.ts`: PASS, `392 passed, 0 failed`.
  - HTTP role-cookie smoke: Admin cookie accepts only `role=admin`, Employee cookie accepts only `role=operator`, and combined cookies keep both role session endpoints active.
  - Browser smoke: Manager login `孙总/1234` reaches `/client-demos/cross-border/admin/employees`, no Next overlay/console errors, Employee without Employee cookie redirects to Employee login as expected, and returning to Manager keeps Manager logged in.
- Updated docs:
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `docs/tests/tests-cross-border-phase2.md`
  - `outputs/resume_card.md`

### Current State

- Completed. Main auth kickout root cause is fixed: Employee and Manager no longer overwrite each other's active session role.
- Hydration mismatch seen in the old dev log has been fixed at the shared persistent UI state hook.
- A clean dev server is currently running on `http://127.0.0.1:3002` from command `pnpm --dir sentura/dashboard dev --hostname 127.0.0.1 --port 3002`.

### Next Steps

1. No required next implementation step for this bug.
2. If continuing QA manually, open `http://127.0.0.1:3002/client-demos/cross-border/admin/login` and use `孙总` / `1234` for Manager.
3. For future Employee browser login smoke, use an Employee account whose password has been set by Manager; the seeded operators do not have a default public password.

## Current Turn — 2026-06-19 CBE Employee Messages Unlimited History And Delete

### Task Introduction

User reports Employee `消息提醒` can only accumulate 8 messages. Required outcome:

- Employee messages should accumulate all messages, not just the latest 8.
- All messages should be reviewable later.
- Employee should be able to delete messages.

Hard constraints:

- Implement against the real Employee message/task notification data chain, not UI-only hidden state.
- Preserve existing dirty worktree changes.
- Keep answer to user in Chinese.
- Update this handoff before broad edits and after verification.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard app: `sentura/dashboard`
- Current dev server from prior turns: `http://localhost:3002`
- Relevant files to inspect first:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/route.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/employee/notifications/read/route.ts`
  - `sentura/dashboard/src/lib/cross-border-store/tasks.ts`

### Task Flow

1. Locate where the 8-message cap is applied.
2. Change list/query/store behavior so all non-deleted Employee notifications are available for history review.
3. Add a real delete mutation for Employee message notifications, likely by marking notification/task metadata as deleted instead of deleting historical task rows.
4. Add UI controls for deleting one or multiple messages without reintroducing the visible top-right text `消息中心`.
5. Verify with TypeScript, ESLint, API smoke, and browser smoke if server remains available.

### Progress So Far

- Next.js skill read.
- Memory quick pass confirms this checkout should keep `outputs/task_handoff.md` as active continuation and verify real runtime behavior for CBE UI/message work.
- Initial search shows Employee top-right bell and page `消息提醒` both use `fetchEmployeeTasks()` and local `useCbeEmployeeStore` task notifications.

### Current State

- Investigation in progress; no code edits yet for this exact request.

### Next Steps

1. Inspect task listing route/store query and Employee page message rendering.
2. Patch unlimited history and deletion.
3. Run focused verification.

## Current Turn — 2026-06-19 CBE Manager Login Same As Employee

### Task Introduction

User asks for a Manager login interface, same as the Employee login screen, by directly copying the Employee login UI. Preset Manager account:

- Name: `孙总`
- Password: `1234`

The login must be functional, not only visual. Manager pages should use the logged-in admin session instead of the previous default frontend admin override.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard app: `sentura/dashboard`
- Current dev server from prior turns: `http://localhost:3002`
- Existing Employee login UI: `sentura/dashboard/src/app/auth/login/page.tsx`
- Existing login/session code:
  - `sentura/dashboard/src/app/api/auth/login/route.ts`
  - `sentura/dashboard/src/app/api/auth/logout/route.ts`
  - `sentura/dashboard/src/lib/cross-border-store/session.ts`
  - `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`
- Existing Manager API client currently has a default override in `sentura/dashboard/src/app/client-demos/cross-border/admin/_data/admin-api.ts`: `NEXT_PUBLIC_CBE_ADMIN_USER_ID ?? "cbe-user-admin-001"`.

### Task Flow

1. Reuse Employee login visual structure for a Manager login page.
2. Extend name/password login to support CBE `admin` role.
3. Seed/update preset admin profile `孙总` with password `1234`.
4. Make admin API calls default to cookie session; keep only explicit env override if needed.
5. Redirect unauthenticated Manager API failures to Manager login.
6. Verify with lint, typecheck, and browser/API smoke.

### Progress So Far

- Product Design get-context/index/user-context/critical-overrides read for UI workflow.
- Product Design preflight showed no saved context; existing Employee login page is the visual source of truth.
- Existing Employee login page and auth API/session files inspected.
- Initial handoff section created before edits.
- Confirmed admin fetch path still sends default `x-cbe-admin-user-id: cbe-user-admin-001`, so current Manager pages can bypass login.
- Confirmed Employee login API currently limits name/password login to `cbe_role = 'operator'`.
- Confirmed seed profile currently names admin `CBE Admin` and does not write `password_hash`.
- Added Manager login page at `sentura/dashboard/src/app/client-demos/cross-border/admin/login/page.tsx`, copied from Employee login layout.
- Extended `sentura/dashboard/src/app/api/auth/login/route.ts` for `admin` password login and preset `孙总/1234` self-heal on seeded admin `cbe-user-admin-001`.
- Updated seed constants/seed writer for Manager `孙总` and password hash creation.
- Removed default frontend admin header from Manager API client and AppShell notification fetches; cookie session is now default.
- Added Manager session guard/logout/session display in AppShell.
- Updated static regression tests and CBE docs/memory/resume notes.

### Current State

- Code implementation is complete for this request.
- Explicit `pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed` could not run from this shell because `CBE_DATABASE_URL` is not set here.
- Local Dashboard server at `http://localhost:3002` did have DB access; the Manager login API self-heal path updated/used the seeded admin profile and verified `孙总/1234`.
- Worktree remains dirty from previous CBE Manager/Employee work. Do not revert unrelated changes.

### Next Steps

1. Optional browser visual smoke for `/client-demos/cross-border/admin/login` if further UI QA is desired.
2. If a future shell has `CBE_DATABASE_URL`, running `pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed` will also persist the seed path directly. The runtime login self-heal already verified in local server.
3. Continue with the next user request; no known blocker remains for Manager login.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 172/172.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 389/389.
- `POST http://localhost:3002/api/auth/login` with `孙总/1234/admin`: PASS, returned 200, `displayName=孙总`, `cbeRole=admin`, session cookie, and Manager employees redirect.
- Wrong password login: PASS, returned 401.
- Cookie-authenticated `/api/client-demos/cross-border/session`: PASS, returned `孙总/admin`.
- Cookie-authenticated `/api/client-demos/cross-border/admin/operators`: PASS, returned 200.

## Current Turn — 2026-06-19 CBE Pending Overage Reject Still Reappears

### Task Introduction

User reports Manager `待审批超额申请` still remains after clicking `拒绝`; it only flashes. Screenshot shows one pending row:

- Employee: `Lin Yue`
- Task: `lead`
- Period: `month`
- Estimated cost: `US$1.00`
- Requested amount input: `1.000001`
- Target: `本月真实成本已超过管理者设置的月限额。`

Hard constraints:

- Fix real backend/store behavior, not frontend-only hiding.
- Preserve existing dirty worktree changes.
- Keep answer in Chinese.
- Update handoff before deeper debugging and after the fix.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- App: Next.js dashboard under `sentura/dashboard`
- Current dev server: `http://localhost:3002`
- Relevant files:
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/cost-approvals/route.ts`

### Task Flow

1. Read current pending approval via API.
2. Inspect `decideAdminCostApproval()` and `syncOverrunApprovalForUserPeriod()`.
3. Reproduce the reject/recreate path if needed through API against local dev server.
4. Patch suppression so rejected monthly-overrun approvals are not immediately recreated from a still-over-budget state.
5. Verify with `tsc`, `git diff --check`, targeted tests, and API/browser smoke.

### Progress So Far

- Existing worktree already dirty from prior CBE work; do not revert unrelated changes.
- Reproduced with API:
  - `GET /api/client-demos/cross-border/admin/cost-approvals` returned pending `cost_approval_071ecd78-6a64-4f71-a1e3-0f18c496dc91` for `Lin Yue`.
  - Rejecting that request updated it to `rejected`, but the subsequent cost refresh recreated a new pending request `cost_approval_182ef2dd-68d3-455a-9ee3-a4447e12394b`.
- Root cause: `syncOverrunApprovalForUserPeriod()` suppressed equivalent rejected monthly-overrun approvals using exact numeric comparisons. Live cost was `3.7594790000000007`, while the rejected row was stored as `3.759479`, so exact `>=` failed and recreated the pending row.
- Patched `sentura/dashboard/src/lib/cross-border-store/admin.ts`:
  - reuse `COST_EPSILON_USD = 0.005` when comparing rejected approval `current_spend_usd` / `requested_allowance_usd` against live values;
  - identify older monthly-overrun rows by either `metadata_json->>'syncKind' = 'monthly_overrun'` or target summary `本月真实成本已超过管理者设置的月限额。`.
- Verified with live API:
  - Rejected `cost_approval_182ef2dd-68d3-455a-9ee3-a4447e12394b`.
  - `GET /api/client-demos/cross-border/admin/costs?range=month` returned `approvals: []`.
  - Lin Yue row returned `pending_approval_count: 0`.
  - `GET /api/client-demos/cross-border/admin/cost-approvals` returned `{"items":[]}`.
- Verification commands:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
  - `pnpm --dir sentura/dashboard exec eslint src/lib/cross-border-store/admin.ts src/app/client-demos/cross-border/admin/costs/page.tsx src/app/client-demos/cross-border/employee/_data/employee-api.ts src/components/app-shell.tsx`: PASS with existing warnings only (`rangeSql`, `periodSql`, `toCostItem` unused in `admin.ts`).

### Current State

- The reported pending overage request is cleared in the running local API. Refreshing Manager `成本监控` should no longer show the same rejected row reappearing.
- The fix is backend/store-side, not frontend-only hiding.

### Next Steps

1. User can hard-refresh `http://localhost:3002/client-demos/cross-border/admin/costs`.
2. If spend changes beyond the previously rejected amount, the system may create a new distinct approval request; equivalent rejected monthly-overrun requests should stay suppressed.

## Current Turn — 2026-06-19 CBE Employee Top-Right Message Center Restore

### Task Introduction

User reports the Employee-side top-right `消息中心` is gone and asks to restore it. Follow-up constraint: do not show the words `消息中心`; the top-right entry should be only a bell icon.

Hard constraints:

- Keep existing dirty worktree changes; do not revert unrelated work.
- Restore Employee right-top message entry as a bell-only icon, without reintroducing the old personal/account dropdown unless needed.
- Keep using real Employee task notifications already surfaced by `消息提醒`.
- Answer the user in Chinese.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- App: Next.js dashboard under `sentura/dashboard`
- Relevant file: `sentura/dashboard/src/components/app-shell.tsx`
- Related Employee page anchor: `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`, card id `employee-messages`

### Task Flow

1. Inspect current AppShell top-right controls for Employee and Admin modes.
2. Add Employee-only top-right bell/dropdown that reads the same task notifications from `useCbeEmployeeStore`.
3. Link the action to `/client-demos/cross-border/employee#employee-messages` so it jumps to the existing real message list.
4. Run TypeScript/static checks and browser/API smoke if available.

### Progress So Far

- Memory quick pass did not find a specific implementation note, but prior memory confirms this checkout uses `outputs/task_handoff.md` for active continuation and needs runtime-truthful UI.
- Read current `app-shell.tsx`, `layout.tsx`, and Employee home page. Finding: Admin has `AdminNotificationBell`; Employee top-right currently only shows `EmployeeCostMini`, connection, account label, and logout. Employee messages still exist in page body via `Card id="employee-messages"`.

### Current State

- Patched `sentura/dashboard/src/components/app-shell.tsx`:
  - added `EmployeeNotificationBell`;
  - right-top Employee entry is a pure Bell icon button with `aria-label="员工消息提醒"` and unread badge;
  - dropdown uses `消息提醒` and `查看全部消息`, not `消息中心`;
  - clicking preview/all messages marks current unread task notifications read through `markEmployeeNotificationsRead()` and local store `markTaskNotificationsRead()`;
  - dropdown links to `/client-demos/cross-border/employee#employee-messages`, reusing the real Employee page message list.
- Verification completed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm --dir sentura/dashboard exec eslint src/components/app-shell.tsx`: PASS.
  - `git diff --check`: PASS.
  - Restarted stale `http://localhost:3002` dev server because SSR still served old `消息中心` markup and caused hydration mismatch.
  - Chrome/Playwright verification after restart: PASS. One `[aria-label="员工消息提醒"]` bell button found; header/button/dropdown do not contain `消息中心`; dropdown contains `消息提醒`; console errors empty.

### Next Steps

1. User can hard-refresh `http://localhost:3002/client-demos/cross-border/employee`.
2. The right-top Employee entry should now be a bell-only icon. The words `消息中心` should not appear there.

## Current Turn — 2026-06-19 CBE Manager Cost Approval Notifications And Live Limits Fix

### Task Introduction

User reports two Manager/Employee cost-control requirements:

1. In Manager `待审批超额申请`, clicking `拒绝` only flashes and has no real effect. Fix the bug.
2. Manager single-employee monthly limit changes and temporary allowance changes must take real effect, notify that exact Employee account through `消息中心`, and every pending overage approval `批准` / `拒绝` must also notify the exact Employee account, including final requested/approved/rejected quota information.

Hard constraints:

- Preserve existing dirty worktree changes; do not revert unrelated work.
- Use real store/API behavior, not UI-only optimistic/demo state.
- Keep response to user in Chinese.
- Update this handoff early and after major findings/edits.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- App: Next.js dashboard under `sentura/dashboard`
- Package manager: `pnpm`
- Current likely dev URL from previous turns: `http://localhost:3002`
- Relevant files to inspect first:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/cost-approvals/route.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/cost-limits/route.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/cost-allowances/route.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/employee/notifications/route.ts`
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `sentura/dashboard/src/lib/cross-border-store/schemas.ts`

### Task Flow

1. Inspect Manager cost page button handlers and API route status mapping for `approved` vs `rejected` / `denied`.
2. Trace storage tables and employee notification API to identify the real notification insertion path.
3. Patch limit, temporary allowance, and approval decision mutations to persist real cost-control state and create employee-scoped notifications.
4. Ensure `拒绝` removes/updates the pending row by using the exact status accepted by store/schema.
5. Add or update focused tests/scripts where practical, then run TypeScript/static checks and any targeted CBE store tests.
6. Browser-smoke the Manager cost-control flow if a usable local dev server is available.

### Progress So Far

- Memory quick pass completed; relevant prior context says this checkout must distinguish real runtime/store truth from UI fallback.
- Existing `outputs/task_handoff.md`, root/package scripts, dashboard package scripts, and broad approval/limit/notification search were inspected.
- Worktree is already dirty with many CBE changes and untracked admin cost-control routes from prior work.
- Confirmed Employee `消息提醒` currently reads terminal `agent_runs` records only; there is no separate employee notification table yet.
- Found likely `拒绝` flash/no-op root cause: `decideAdminCostApproval()` updates pending request to `rejected`, but the following `listAdminCosts()` refresh calls `syncMonthlyOverrunApprovalsForTenant()`, which immediately recreates the same `monthly_overrun` pending request while spend remains above limit.
- Patched `sentura/dashboard/src/lib/cross-border-store/admin.ts`:
  - added `createEmployeeCostControlNotification()` which writes employee-scoped completed `agent_runs` records with `metadata_json.notification_*` for Employee `消息提醒`;
  - `upsertAdminCostLimit()` now notifies the exact employee with final period/base-limit details;
  - `setAdminCostAllowance()` now notifies the exact employee with final active temporary allowance;
  - `decideAdminCostApproval()` now locks the pending request, persists final requested amount metadata, grants allowance on approval, and notifies the exact employee for both `approved` and `rejected`;
  - `syncOverrunApprovalForUserPeriod()` now suppresses immediate recreation of an equivalent rejected `monthly_overrun` request on monitor refresh;
  - added `COST_EPSILON_USD = 0.005` so floating-point residue like `remaining_usd = -8.88e-16` does not create `US$0.00` pending approvals.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`:
  - rejection now sends the Manager input amount as final request amount too;
  - `refresh()` was converted to `useCallback` and the initial effect load is deferred through `setTimeout` so ESLint no longer flags synchronous setState-in-effect.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts` so task notifications display `notification_title`, `notification_message`, and `notification_target_label` from metadata.
- Verification completed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
  - `pnpm --dir sentura/dashboard exec eslint src/lib/cross-border-store/admin.ts src/app/client-demos/cross-border/admin/costs/page.tsx src/app/client-demos/cross-border/employee/_data/employee-api.ts`: PASS with existing warnings in `admin.ts` for `rangeSql`, `periodSql`, and `toCostItem`.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 166/0.
  - API smoke on `http://localhost:3002/api/client-demos/cross-border/admin/costs?range=month`: PASS 200.
  - API smoke on `http://localhost:3002/api/client-demos/cross-border/admin/cost-approvals`: PASS 200 and now returns `{"items":[]}` after cancelling the prior zero-dollar pending row.

### Current State

- Requested code fixes are implemented.
- Current dev server on `http://localhost:3002` is running and serving the patched API.
- The shell environment has no direct `CBE_DATABASE_URL`, so DB-backed CLI tests were not run manually with `--require-db`; API smoke used the already-running dev server and its configured DB/runtime.
- Existing worktree remains dirty from previous CBE turns; this turn intentionally only changed cost-control logic, employee task notification mapping, Manager cost page refresh/decision payload, and handoff.

### Next Steps

1. User can hard-refresh `http://localhost:3002/client-demos/cross-border/admin/costs` and test real Manager actions.
2. If a new pending approval appears with nonzero requested amount, rejecting it should remove it and notify the Employee account instead of reappearing on refresh.
3. To verify Employee messages visually, log in as the affected employee after Manager changes; the `消息提醒` card should show limit/allowance/approval titles and final quota text.

## Current Turn — 2026-06-19 CBE Manager Report Dialog Exact Employee Parity

### Task Introduction

User says the Manager-side `查看报告` window is still visually messy and asks to completely copy the Employee-side report window code so the modal layout is clean and has no mistakes.

Hard constraints:

- Keep user-facing response in Chinese.
- Use Employee-side report window as the visual/interaction source of truth.
- Do not revert unrelated dirty worktree changes.
- Preserve continuation context early and update it after major phases.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Likely app: Next.js dashboard under `sentura/dashboard`
- Current verified dev URL from prior turns: `http://localhost:3002`
- Relevant files found so far:
  - Employee/shared report dialog: `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx`
  - Manager customer/report wrapper: `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`
  - Manager employee page likely consuming wrapper: `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`
  - Manager high-value page also uses report button: `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`

### Task Flow

1. Read active handoff/resume context and Product Design get-context guard.
2. Compare Employee report window implementation with Manager report trigger/wrapper.
3. Remove Manager-only modal/report duplication if present; make Manager invoke the same `CustomerReportDialog` component and same row shape as Employee.
4. Run TypeScript/static checks and browser smoke for Manager report window.

### Progress So Far

- Memory quick pass completed; relevant prior context confirms `outputs/task_handoff.md` is the single active handoff and this checkout has known Manager/Employee CBE UI work.
- Product Design context preflight ran; no saved Product Design context exists, so current codebase and Employee report component are the source of truth.
- Initial handoff section created before deeper source scan and edits.
- Patched `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx`:
  - kept the Employee report layout as the single shared implementation;
  - renders the report overlay through `createPortal(..., document.body)`;
  - raised overlay layer to `z-[70]` so it appears above Manager employee-detail dialogs.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`:
  - removed the leftover Manager-specific `ReportDetailDialog` implementation and duplicated report layout helpers;
  - Manager report buttons and row-detail report actions now only convert admin rows to Employee `CustomerListItem` and render shared `CustomerReportDialog`.
- Verification completed:
  - `pnpm --dir sentura/dashboard exec eslint src/components/cross-border/customer-report-dialog.tsx src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`: PASS.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
  - Browser smoke on `http://localhost:3002/client-demos/cross-border/admin/employees`: PASS.
    - Opened Lin Yue detail.
    - Opened Currys `查看报告`.
    - Report title, `背调结论`, `评分维度拆解`, `证据明细`, `客户概览`, and four top metrics were visible.
    - Dialog bounding box was fully inside 1440x1000 viewport: x=144, y=32, width=1152, height=936.
    - Report dialog was not inside Manager Base UI `DialogContent`.
    - `X` close detached the report dialog.
    - Outside overlay click closed only the report and left Manager employee detail open.
    - No browser console warnings/errors were captured.

### Current State

- Requested report-window parity fix is complete and verified.
- Worktree remains dirty from prior CBE work; this turn intentionally touched only the shared report dialog, Manager customer-list wrapper, and handoff/resume files.

### Next Steps

1. User can hard-refresh `http://localhost:3002/client-demos/cross-border/admin/employees` and test Lin Yue -> `查看报告`.
2. Continue using `http://localhost:3002`, not stale `127.0.0.1:3001`.

## Current Turn — 2026-06-19 CBE Admin Report Modal And Cost Parity Fix

### Task Introduction

User reports five issues after latest Manager detail fix:

1. In Manager employee detail, clicking `查看报告` opens a report window whose top content is clipped/incomplete.
2. Manager report window should match the size of the `获客与背调` panel, avoid overlapping awkwardly with the underlying panel, and close via `X` or outside click back to the customer panel.
3. Remove checkbox selection controls in the Manager `获客与背调` panel because they have no Manager-side action.
4. Manager `成本明细` for Lin Yue does not match true cost.
5. Lin Yue Employee-side monthly API cost is `US$3.76`, but Manager currently shows `US$0.82`; Manager must fully synchronize with the Employee-side cost value.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current dev server expected: `http://localhost:3002`
- Target employee: Lin Yue, `user_id = cbe-user-operator-001`.

### Task Flow

1. Preserve handoff before edits.
2. Compare Employee-side cost API/component/store and Manager-side admin cost SQL for Lin Yue.
3. Patch Manager cost aggregation to use the same source/period semantics as Employee monthly API cost.
4. Patch Manager employee-detail report modal sizing/layering so it fits inside the Manager detail surface and closes cleanly.
5. Remove unused checkbox column from Manager customer list.
6. Run TypeScript/static/DB checks and browser smoke.

### Progress So Far

- Handoff section created.

### Current State

- Investigation just started.

### Next Steps

1. Inspect Employee cost component/API and Admin cost store queries.
2. Patch UI and cost calculations.
3. Verify Lin Yue Manager cost equals Employee cost.

## Current Turn — 2026-06-19 CBE Admin Session Conflict And Detail UI Copy Fix

### Task Introduction

User reports:

1. After logging in as employee `Lin Yue`, Manager pages fail to read employee historical data with `CBE admin role is required for this endpoint`.
2. Manager employee detail customer list/report still does not match Employee-side `获客与背调` page closely enough. User asks to directly copy/reuse the Employee-side list/report code and only adjust modal/window sizing.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current dev server expected: `http://localhost:3002`
- Root cause hypothesis for error: global CBE session cookie is overwritten by Employee login. Admin APIs resolve session first, so the same browser is treated as `operator` and rejected by admin-only endpoints.

### Task Flow

1. Preserve handoff before edits.
2. Inspect `tenant-context/session/auth` and admin fetch path.
3. Fix admin context so Manager local/demo access is not blocked by an Employee session, without breaking Employee login.
4. Inspect Employee `customers/page.tsx` list/report JSX and reuse it for Manager operator detail.
5. Verify with TypeScript, existing CBE scripts, and browser check using an Employee session plus Manager page.

### Progress So Far

- Handoff section created.
- Fixed admin/employee session conflict:
  - `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts` now honors `x-cbe-admin-user-id` for `/api/client-demos/cross-border/admin/**` routes before session cookie resolution.
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_data/admin-api.ts` sends `x-cbe-admin-user-id` with seeded/local admin id `cbe-user-admin-001` unless `NEXT_PUBLIC_CBE_ADMIN_USER_ID` is set.
- Updated Manager employee detail UI:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx` now wraps the table in the same Employee-side `Card + 搜索 + 国家 / 类型 / 产品 + 全部/未背调/已评分/证据不足 + 评分排序` layout.
  - Existing Employee-style report dialog remains reused for Manager rows.
- Verification completed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 165/0.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 378/0.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 185/0.
- Browser verification against `http://localhost:3002`: PASS.
  - With a synthetic Lin Yue employee session cookie, Manager admin APIs `/admin/operators` and `/admin/operators/cbe-user-operator-001` returned 200.
  - No `CBE admin role is required for this endpoint` was shown.
  - Lin Yue detail contained original data such as `Global Express Electronics`, `Currys`, and `iFixScreens`.
  - Detail UI contained Employee-style search/filter/sort controls.
  - Report dialog contained `背调结论`, `评分维度拆解`, `证据明细`, and `客户概览`.

### Current State

- Requested fixes are implemented and verified.

### Next Steps

1. User should hard-refresh `http://localhost:3002/client-demos/cross-border/admin/employees` if the old client bundle remains open.
2. Avoid `127.0.0.1:3001`, which is an older production server from a prior build.

## Current Turn — 2026-06-19 CBE Runtime Mismatch Debug

### Task Introduction

User reports that the previous Manager/Employee UI changes do not appear, and the Employee-side web page cannot open. User asks whether a full restart is needed and wants the reason analyzed.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current suspected issue: runtime/server mismatch after multiple dev/prod servers on ports `3000`, `3001`, and `3002`.
- Prior verified current-code server was `http://localhost:3002`; `3001` was explicitly noted as possibly stale.

### Task Flow

1. Check active port processes and server logs.
2. Reproduce Employee page load on active local ports.
3. Distinguish stale server vs auth/session redirect vs missing DB/env/migration runtime error.
4. Decide whether a full restart is needed or only a targeted dev-server restart plus DB migration/env setup.

### Progress So Far

- Handoff section created before runtime checks.
- Active port/process findings:
  - `3002`: current `next dev --port 3002` process, PID chain `8411 -> 8466 -> 8497`.
  - `3001`: old `pnpm --dir sentura/dashboard start --hostname 127.0.0.1 --port 3001`, PID chain `10751 -> 10789`.
- Request/browser findings:
  - `http://localhost:3002/client-demos/cross-border/admin/high-value-customers` shows current code rule `评分 >= 80 / 高分 / 优先跟进`.
  - `http://127.0.0.1:3001/client-demos/cross-border/admin/high-value-customers` still shows stale rule `trusted / 80 分以上 / 优先跟进`.
  - `3001` Employee page is old production build content with old account/message surfaces; it does not reflect latest source changes.
  - `http://localhost:3002/client-demos/cross-border/employee/customers` redirects to `/auth/login?...`, which is expected after adding Employee name/password login.
  - `http://127.0.0.1:3002` triggers Next dev HMR WebSocket errors; use `http://localhost:3002`.
- Current `3002` logs show relevant Admin/Employee/session/login APIs returning `200`; no backend crash observed.

### Current State

- Root cause is runtime mismatch plus new login requirement, not a full machine-level failure.
- User likely saw stale UI because browser was on `127.0.0.1:3001`, which is an old `next start` build.
- Employee page "cannot open" is likely the intended unauthenticated redirect to login on `3002`; existing employees must first receive a password via Manager `员工管理`.

### Next Steps

1. Tell user to use `http://localhost:3002` immediately, or stop/rebuild stale `3001`.
2. If user wants one canonical port, stop `3001` and `3002`, then restart a single dev server with the current code and DB env.
3. For existing employees, set/reset password in Manager before Employee login.

## Current Turn — 2026-06-19 CBE Manager UI Polish And Employee Login Fixes

### Task Introduction

User attached screenshots and requested six concrete fixes after Manager implementation:

1. In Manager `员工管理`, clicking an employee must open a centered rectangular detail surface whose `获客与背调` list and `查看报告` report match the Employee-side list/report exactly in behavior and visual structure.
2. Manager `高分客户` must only show final score `>=80` / `高分` / `优先跟进`; low-score rows must be filtered out after the scoring-rule change.
3. `成本监控` limit inputs need a `$` unit suffix and left-aligned/neat limit-setting controls.
4. `创建员工账户` monthly limit should not auto-fill `120`; it should show only the placeholder `月限额`.
5. `创建员工账户` should use a manager-set password instead of an email field.
6. Employee platform should have a real login page using employee name + manager-set password; remove the top-right Employee personal/message dropdown.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch: `wst1.0-ecommerce`
- Dashboard app: `sentura/dashboard`
- Local DB used for live verification: `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`
- Current dev verification server: `http://localhost:3002`; avoid stale `127.0.0.1:3001` from prior runs.

### Task Flow

1. Preserve handoff before large edits.
2. Reuse Employee-side list/report rendering by adding a shared Manager wrapper component rather than approximating the table.
3. Patch high-value customer filtering in store and UI to final-score `>=80`.
4. Patch cost monitor input alignment and `$` suffixes.
5. Replace create-employee email/token UX with password creation.
6. Add password hashing, migration, name/password login route, logout route, and Employee AppShell redirect to login.
7. Add/reset password UI for existing employees so old seeded operators can also log in by name/password.
8. Re-run TypeScript, static CBE scripts, DB-backed store checks, API probes, and browser smoke.

### Progress So Far

- Added `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx` to render Manager customer lists/reports with Employee-side table/report styling.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`:
  - centered detail dialog;
  - Employee-style customer/report list in the detail dialog;
  - create form now uses `姓名`, `登录密码`, `团队`, blank `月限额`;
  - success notice no longer exposes a reusable token;
  - added per-employee `新密码` + `设密码` control for existing employee accounts.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx` and `sentura/dashboard/src/lib/cross-border-store/admin.ts` so high-value rows require `normalizedScore >= 80`.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx` so limit/approval inputs show `$` and align neatly.
- Added password login support:
  - `sentura/lib/cross-border-store/migrations/004_operator_password_login.sql`;
  - `sentura/dashboard/src/lib/cross-border-store/session.ts`;
  - `sentura/dashboard/src/app/api/auth/login/route.ts`;
  - `sentura/dashboard/src/app/api/auth/logout/route.ts`;
  - `sentura/dashboard/src/app/auth/login/page.tsx`;
  - `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`;
  - `sentura/dashboard/src/components/app-shell.tsx`.
- Updated static tests in:
  - `scripts/test-cross-border-phase2-store.ts`;
  - `scripts/test-cross-border-agents.ts`.

### Current State

- Code edits and verification for this request are complete.
- Verification completed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 165/0.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 378/0.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 185/0.
- Browser smoke against `http://localhost:3002`: PASS.
  - High-value page DOM only contains `>=80` scored rows and no screenshot low-score values.
  - Employee detail dialog opens centered and uses Employee-side customer table headers.
  - Manager report dialog contains Employee-side report sections: `背调结论`, `评分维度拆解`, `证据明细`, `客户概览`.
  - Cost monitor numeric limit inputs show `$`.
  - Temporary employee probe: Manager `设密码` wrote real `password_hash`; Employee login by name/password reached `/client-demos/cross-border/employee/customers`; header showed employee name + `退出`; `消息中心` absent.
- Temporary DB probe employees were cleaned after browser verification.
- Known runtime note: use `http://localhost:3002` for current code. Older port `3001` can show stale pre-fix UI.

### Next Steps

1. If the user continues testing manually, use `http://localhost:3002`.
2. For existing real employees, set or reset their password from Manager `员工管理` using the row-level `新密码` + `设密码` control before asking them to log in by name/password.

## Current Turn — 2026-06-19 CBE Final Score And Tier Simplification

### Task Introduction

User approved a simpler scoring model for buyer Screening:

- `normalized_score` should be the single final score customers see.
- Evidence coverage must be included inside final score calculation, not used as a hidden downgrade after scoring.
- `高分` / `中等` / `低分` must be decided only by final score so the UI never shows contradictions like `85/100 · 中等` while `84/100 · 高分`.
- Keep objectivity by making coverage a transparent weighted scoring component, recommended baseline: evidence quality 80% + evidence coverage 20%.
- Preserve `证据不足` only when core evidence is too weak to compute a normal score.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Next.js dashboard app: `sentura/dashboard`
- Core scoring code:
  - `sentura/lib/cross-border-ecommerce.ts`
  - `sentura/mcp-servers/cross-border-intel/src/schemas.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/screening/run/route.ts`
- Employee customer list mapping:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- Existing worktree has many unrelated/uncommitted CBE Manager changes; do not revert them.

### Task Flow

1. Preserve this handoff before edits.
2. Replace hidden coverage downgrade with final-score weighting in all scoring implementations.
3. Make score-tier mapping pure score thresholds in Employee list/task data.
4. Update UI labels/docs/tests so high/medium/low match final score only.
5. Run focused TypeScript/tests for scoring and Employee CBE paths.

### Progress So Far

- Handoff section created.
- Relevant finding: current code calculates quality score from scored blocks, separately calculates evidence coverage, then sets `risk_tier="cautious"` when score is high but coverage `< 0.7`; Employee list then maps `riskTier=cautious` to `scoreTier=medium`.
- Patched core score calculation in:
  - `sentura/lib/cross-border-ecommerce.ts`
  - `sentura/mcp-servers/cross-border-intel/src/schemas.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/screening/run/route.ts`
- New formula: `quality_score = raw_score / score_denominator * 100`; `normalized_score = quality_score * 0.8 + evidence_coverage * 100 * 0.2`.
- New final-score tier thresholds: `>=80 trusted_candidate/high`, `60-79 cautious/medium`, `<60 high_risk/low`; `score_denominator=0` stays `insufficient_evidence`.
- Forced downgrades now cap final score at `59` instead of only changing the risk label.
- Patched Employee list/task normalization so `scoreTier` and report fallback risk tier are derived from final score only, not from a separate `risk_tier` downgrade.
- Patched Manager high-value customers to filter only by `normalizedScore >= 80`.
- Updated relevant UI text from `风险层级` to `跟进评级` where report-facing.
- Updated scoring tests/docs/config:
  - `sentura/mcp-servers/cross-border-intel/src/server.test.ts`
  - `scripts/test-cross-border-milestone2.ts`
  - `scripts/test-cross-border-agents.ts`
  - `sentura/config/industry-ontologies/cross-border-mobile-accessories/rules/scoring-rules.json5`
  - `跨境电商/UI.md`
  - `跨境电商/SCREENING.md`
  - `跨境电商/API_KEYS_OPENCLAW_SETUP.md`
- Verification completed:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 375/375.
  - `pnpm exec tsx scripts/test-cross-border-milestone2.ts`: PASS, 40/40.
  - `pnpm --dir sentura/mcp-servers/cross-border-intel test`: PASS, 17/17.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - Formula smoke via `pnpm exec tsx -e ...`: evidence quality 85 + coverage 40% produced final `normalized_score=76`, `risk_tier=cautious`.
  - Focused ESLint on core scoring/data/admin files: PASS with existing warnings only in `sentura/dashboard/src/lib/cross-border-store/admin.ts` (`rangeSql`, `periodSql`, `toCostItem` unused).

### Current State

- Implementation and focused verification are complete.
- Full focused ESLint including `customers/page.tsx` and `screening/page.tsx` still fails on pre-existing React hooks lint issues:
  - `react-hooks/set-state-in-effect` in `customers/page.tsx` and `screening/page.tsx`;
  - `showNotice` accessed before declaration in `customers/page.tsx`.
  These were not introduced by the scoring-rule change and TypeScript still passes.

### Next Steps

1. If desired, separately clean the pre-existing React hooks ESLint issues in `customers/page.tsx` and `screening/page.tsx`.
2. If live browser verification is needed, open the Employee customer list and confirm score badges now follow final score only.

## Current Turn — 2026-06-19 CBE Memory Supplement Flow For Evidence-Insufficient Customers

### Task Introduction

User asked for two follow-up fixes:

1. Manual-input customers (`手动录入`) with `证据不足` should also show/click `补充聊天记录` instead of continuing with `开始调研`.
2. After clicking `补充聊天记录`, `记忆整理` must provide a complete supplement flow: upload a JSON chat file, submit it, create a new Memory row shown as `未分析`, allow re-analysis, and then allow sending the analyzed record back to Screening.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Key files expected:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `scripts/test-cross-border-agents.ts`

### Task Flow

1. Preserve this handoff before edits.
2. Inspect current customer action and memory import/add-sheet logic.
3. Extend the customer action gate from Accio-only to manual-input plus Accio.
4. Add URL/query-driven Memory supplement mode with prefilled company context and JSON upload.
5. Ensure supplement submission creates a DB-backed `未分析` Accio import row, highlights it, and leaves it ready for `开始分析`.
6. Verify TypeScript, static tests, and browser DOM flow.

### Progress So Far

- Current turn started.
- Relevant prior behavior: Accio insufficient-evidence rows already show `补充聊天记录` and navigate to Memory with highlight; manual-input rows still need the same action.
- Patched `customers/page.tsx`:
  - replaced Accio-only supplement predicate with `needsChatRecordSupplement()`;
  - `manual_screening` and `accio_handoff` with `insufficient_evidence` now show `补充聊天记录`;
  - supplement navigation now passes `supplementCustomer`, `supplementCompany`, and `supplementSource` to Memory; Accio rows also pass `highlightRecord`.
- Patched `memory/page.tsx`:
  - added `supplement` sheet mode and query parsing for `supplementCustomer/supplementCompany/supplementSource`;
  - Memory opens the supplement upload panel automatically for those query params;
  - supplement submission uses existing `createEmployeeAccioImport()` without a session key, so the new row appears as `未分析`;
  - after submit, Memory filters to `未分析`, highlights the new import id, and replaces the URL with `highlightRecord=<new import id>`;
  - supplement mode has only `提交补充记录`, not `导入并分析`, so the operator must explicitly run `开始分析` next.
- Updated `scripts/test-cross-border-agents.ts` assertions for manual/Accio evidence-insufficient supplement routing and Memory supplement flow.

### Current State

- Current requested implementation is patched.
- `pnpm --dir sentura/dashboard exec tsc --noEmit` is currently blocked by an unrelated deleted file: `sentura/dashboard/src/lib/cross-border-store/admin.ts` is deleted in the working tree while admin API routes still import its exports.

### Next Steps

1. Run static test and browser DOM checks for the current feature.
2. If full TypeScript verification is required, first decide whether to restore/rebuild `sentura/dashboard/src/lib/cross-border-store/admin.ts` or complete the manager-system store replacement that removed it.

## Current Turn — 2026-06-19 CBE Manager System Implementation

### Task Introduction

User asked to implement the approved CBE manager-account plan. Final outcome: a real `/client-demos/cross-border/admin` manager system connected to current Employee DB/task/report/cost data, with three pages only:

1. `员工管理`
2. `高分客户`
3. `成本监控`

Hard product decisions from user:

- Employee platform title: `跨境电商员工操作系统`.
- Manager platform title: `跨境电商管理者系统`.
- Keep the same logo and visual style as the current Employee UI.
- Manager can create employee accounts and suspend/reactivate them.
- Authentication should use the existing Sentura platform/RBAC identity path for this v1.
- Cost limits are configurable by period: day/week/month/all-time.
- When a task would exceed a limit, do not launch the employee task. Create an approval request, notify/show it in Manager, and after approval add temporary allowance so the employee can retry.
- High-value customers use the existing high/trusted-candidate Screening result definition, not a new threshold.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch: `wst1.0-ecommerce`
- Date: 2026-06-19 Asia/Shanghai
- Existing app stack: Next.js App Router, Tailwind/shadcn-style components, DB-backed CBE Employee pages.
- Current CBE employee pages/API already read from database:
  - `/client-demos/cross-border/employee`
  - `/client-demos/cross-border/employee/customers`
  - `/client-demos/cross-border/employee/memory`
- Existing Admin read-only routes/store exist but are incomplete for this request:
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/**/route.ts`
- Existing CBE identity seam:
  - `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`
  - currently resolves `x-cbe-user-id`, `x-sentura-user-id`, env fallback, or default operator.
- Existing Sentura RBAC identity source:
  - `sentura/extensions/sentura-rbac/index.ts`
  - RPCs include `sentura.rbac.users.resolveByToken`, `sentura.rbac.users.upsert`.

### Task Flow

1. Preserve this handoff and resume card before edits.
2. Inspect current seams before editing:
   - CBE DB migrations/schema/store modules;
   - Employee API/task creation paths;
   - AppShell/navigation/title;
   - existing Admin store/routes;
   - sentura-rbac RPC/client patterns.
3. Add DB schema and typed store support for:
   - cost limits;
   - temporary allowances;
   - cost approval requests;
   - employee account/profile upsert and suspend/reactivate;
   - manager high-value customer and operator detail projections.
4. Add CBE auth/session route layer:
   - login with platform `userToken`;
   - cookie-backed CBE session;
   - tenant context resolution from session first, with test/debug header fallback.
5. Wire Employee task create routes to budget preflight:
   - Lead;
   - Screening;
   - Accio.
6. Build Manager UI:
   - `员工管理`;
   - `高分客户`;
   - `成本监控`;
   - manager nav/title in AppShell, employee title rename.
7. Extend static/live tests and docs, then run focused verification.

### Progress So Far

- Read Next.js skill guidance; key implementation constraint: keep DB/client initialization lazy and App Router route handlers dynamic Node runtime.
- Read Product Design get-context/user-context guidance; no saved Product Design context exists, so current Employee UI is the visual source.
- User brief is complete and confirmed in the implementation prompt.
- Current worktree is already dirty from earlier CBE work; do not revert unrelated edits.
- Added migration `sentura/lib/cross-border-store/migrations/003_manager_cost_controls.sql`:
  - adds nullable `cbe_user_profiles.email`;
  - adds `cbe_cost_limits`, `cbe_cost_allowances`, `cbe_cost_approval_requests`;
  - seeds monthly `US$120` limits for existing operator profiles.
- Extended CBE schemas and agent run persistence:
  - `CbeCostPeriodSchema`, cost approval schemas, admin operator/cost schemas;
  - `ListQuerySchema.owner_user_id/range`;
  - `estimated_cost_usd` on Lead/Screening/Accio create requests;
  - `agent_runs.cost_usd_estimate` now written from task estimates.
- Rebuilt `sentura/dashboard/src/lib/cross-border-store/admin.ts` with:
  - `checkCbeCostBudgetBeforeRun()`;
  - admin operator list/detail/create/update helpers;
  - operator customer filtering;
  - high-value customer aggregation;
  - cost pool/list/limit/approval helpers.
- Wired budget preflight before task creation in:
  - `lead-runs.ts`;
  - `screening.ts`;
  - `accio.ts`.
- Added cookie-backed CBE session support:
  - `session.ts`;
  - `POST /api/auth/login`;
  - `POST /api/auth/logout`;
  - `GET /api/client-demos/cross-border/session`;
  - `tenant-context.ts` now resolves session cookie first, then debug headers/env/default fallback.
- Added/extended admin API routes:
  - `GET/POST /api/client-demos/cross-border/admin/operators`;
  - `GET/PATCH /api/client-demos/cross-border/admin/operators/[id]`;
  - `GET /api/client-demos/cross-border/admin/operators/[id]/customers`;
  - `GET /api/client-demos/cross-border/admin/high-value-customers`;
  - `GET /api/client-demos/cross-border/admin/costs`;
  - `PATCH /api/client-demos/cross-border/admin/cost-limits`;
  - `GET/POST /api/client-demos/cross-border/admin/cost-approvals`.
- Updated employee browser API client to rely on cookies by default, retain `NEXT_PUBLIC_CBE_USER_ID` as explicit debug override, and pass estimated task costs to server.
- Updated AppShell:
  - employee title now `跨境电商员工操作系统`;
  - admin path title now `跨境电商管理者系统`;
  - same logo retained;
  - admin nav only has `员工管理`, `高分客户`, `成本监控`;
  - employee-only task/cost widgets hidden on admin pages.
- Added manager UI:
  - `/client-demos/cross-border/admin` redirects to `/admin/employees`;
  - `/client-demos/cross-border/admin/employees`;
  - `/client-demos/cross-border/admin/high-value-customers`;
  - `/client-demos/cross-border/admin/costs`;
  - shared admin API helper and complete Screening report dialog;
  - `/auth/login` page.

### Current State

- Backend/API/UI implementation is in place and verified.
- Verification completed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 164/164.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 368/368.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 184/184.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm --dir sentura/dashboard build`: PASS.
  - Browser smoke against production server `http://127.0.0.1:3001`: PASS for Manager three pages and Employee three pages; no console errors.
  - Live budget smoke via API: PASS. Temporary day limit for `cbe-user-operator-002` produced HTTP 402 `cost_approval_required`, created one pending approval, and created zero `agent_runs`; temporary DB rows were restored/cleaned.
- A production `next start` verification server is currently running on `http://127.0.0.1:3001` with:
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev'`
  - `CBE_DEMO_USER_ID='cbe-user-admin-001'`
  - `NEXT_PUBLIC_CBE_USER_ID='cbe-user-admin-001'`
- Cost truthfulness implementation:
  - admin cost pages use `api_call_ledger` actual cost when present;
  - if no priced ledger is linked to a task, they show `agent_runs.cost_usd_estimate` separately as estimated;
  - unpriced ledger calls are counted rather than converted to fake dollars.

### Next Steps

1. If using the running verification server, open `http://127.0.0.1:3001/client-demos/cross-border/admin/employees`.
2. For a normal dev server, stop any existing dashboard dev process on 3000 first; Next 16 blocked a second dev server for the same app.

## Current Turn — 2026-06-19 CBE Manager/Employee Full Connection Audit

### Task Introduction

User asked for a comprehensive verification of the implemented Manager system and Employee system:

- whether Manager and Employee data are accurately connected in real time;
- whether all features are wired successfully;
- whether Manager actions can truly control Employee accounts/cost approvals;
- whether bugs remain.

Hard requirement for this audit: distinguish real runtime truth from UI-only impressions, especially for cost data and budget control.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current verification target from previous implementation: production server can run on `http://127.0.0.1:3001`.
- Local DB used for live checks: `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`.
- Existing dashboard dev server may already be running on 3000; do not kill it unless explicitly needed.

### Task Flow

1. Preserve this handoff before deeper audit work.
2. Re-check implementation code paths for session/auth, admin APIs, employee create APIs, DB budget controls, and UI data loading.
3. Run TypeScript/static/DB/live route checks.
4. Exercise key real-control flows:
   - admin list/cost/high-value APIs;
   - operator API access denial for admin-only endpoints;
   - budget over-limit block creates approval and no `agent_runs`;
   - approval adds allowance and retry can create task;
   - suspend operator blocks new Employee API access;
   - Manager pages load current DB data.
5. Fix confirmed bugs and rerun affected checks.

### Progress So Far

- Audit handoff section created.

### Current State

- Audit just started; no new findings yet.

### Next Steps

1. Inspect relevant changed files and route shapes.
2. Run automated verification and live smoke.
3. Record confirmed pass/fail status and any residual risk.

## Current Turn — 2026-06-19 CBE Memory Selection Delete And Evidence-Insufficient Actions

### Task Introduction

User attached two screenshots and asked for three follow-up fixes:

1. In `记忆整理`, remove `分析中` and `失败` from the visible list status category buttons, and add a `删除所选` function.
2. In `获客与背调`, remove the `证据不足` badge shown under company names; keep the status behavior but do not show this badge in that subtitle area.
3. For companies handed off from chat records (`聊天记录移交`) whose Screening result is evidence-insufficient, do not keep showing `开始调研`; instead the operator should be guided to add more chat records, re-analyze in `记忆整理`, and send to Screening again.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current date: 2026-06-19 Asia/Shanghai
- Key files expected:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - possibly `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/route.ts`
  - `scripts/test-cross-border-agents.ts`

### Task Flow

1. Preserve handoff before edits.
2. Inspect memory page filters/row rendering and customer page badge/action rendering.
3. Add a DB-backed delete endpoint for selected memory rows if no suitable delete path already exists.
4. Add UI selection and `删除所选` in memory list.
5. Hide subtitle `证据不足` badge in customer rows.
6. Change evidence-insufficient Accio handoff action from `开始调研` to memory re-analysis guidance/navigation.
7. Run TypeScript/static tests and browser/API checks.

### Progress So Far

- Added DB-backed selected memory deletion:
  - `DeleteMemoryRecordsRequestSchema` in `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
  - `deleteEmployeeMemoryRecords()` in `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `DELETE /api/client-demos/cross-border/employee/memory` in `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/route.ts`
  - browser API helper `deleteEmployeeMemoryRecords()` in `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
- Delete semantics: selected not-started rows delete the import; selected analyzed rows delete the associated summary/conversation/messages and delete the import only when no conversations remain.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`:
  - visible memory status filters now use `["all", "not_started", "analyzed"]`;
  - added row/card checkboxes, current-filter select-all, `删除所选`, and centered delete confirmation dialog;
  - running records are not selectable for deletion.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`:
  - `workflowBadge()` no longer renders the company-name `证据不足` badge;
  - `source === "accio_handoff"` plus `screeningStatus === "insufficient_evidence"` now shows `补充聊天记录`, routes to `/memory?highlightRecord=<customerId>`, and is skipped by bulk Screening;
  - bulk Screening filters out those Accio insufficient-evidence rows as a safety fallback.
- Updated `scripts/test-cross-border-agents.ts` with assertions for memory filter cleanup, selected DB deletion, hidden customer badge, and Accio evidence-insufficient memory refresh.
- Verification completed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit` passed.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` passed (`367 passed, 0 failed`).
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db` passed (`147 passed, 0 failed`).
  - Browser DOM check on local `http://localhost:3000` passed: memory filters show only `全部/未分析/已分析`, `删除所选` is visible, Nordic row shows `补充聊天记录`, no row `开始调研`, no company-name `证据不足` badge, and clicking the button navigates to Memory with the Nordic memory row highlighted.
- Worktree is already dirty from prior CBE work; do not revert unrelated files.

### Current State

- Current requested fixes are implemented and verified.
- No known blocker remains for this turn.

### Next Steps

1. Read the relevant UI and store files.
2. Patch narrowly.
3. Verify with `pnpm --dir sentura/dashboard exec tsc --noEmit` and `pnpm exec tsx scripts/test-cross-border-agents.ts`.

## Current Turn — 2026-06-18 CBE Memory Report, Highlight, And Screening Evidence Fixes

### Task Introduction

User attached screenshots and asked for five fixes:

1. In `记忆整理`, remove the lower duplicate task-progress notice and keep only the top global task status bar.
2. The analyzed memory report is still vague fallback content; inspect the record/output path and fix the cause.
3. Message-center navigation should make the corresponding memory row keep flashing until the user clicks inside the light-blue row/card, not auto-clear after 3 seconds.
4. `记忆整理` `查看报告` should open the same kind of centered rectangular dialog as `获客与背调`, not a right-side sheet.
5. Screening runs that lack traceable evidence URLs should still be saved as already screened, classified as `证据不足`, while surfacing that the employee did not return usable traceable evidence.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Key files:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `sentura/dashboard/src/lib/cross-border-store/screening.ts`
  - `scripts/test-cross-border-agents.ts`

### Task Flow

1. Preserve this handoff before edits.
2. Patch memory page progress and highlight behavior.
3. Convert memory detail/report from sheet to centered dialog while keeping add/filter sheets.
4. Fix Accio memory normalization/prompt/report derivation so analyzed reports contain grounded buyer intent, price, next action, and source-reference fields instead of fallback filler when the employee returns usable facts under adjacent keys.
5. Change Screening normalization for missing evidence URLs from hard failure to an insufficient-evidence report with an internal traceability-gap marker, so the customer is listed as screened and evidence-insufficient.
6. Run focused static/API/browser checks and update this handoff again before final response.

### Progress So Far

- Read the existing handoff and confirmed the latest user request supersedes the prior memory UX request.
- Located the duplicate lower progress source in `memory/page.tsx`: `createProgressHandler()` calls `showNotice(progress.message, "info", 0)` for non-failed progress, duplicating the top `EmployeeTaskStatusBar`.
- Located the 3-second auto-clear source in `memory/page.tsx`: `highlightMemoryRecords()` schedules `window.setTimeout(..., 3000)`.
- Located the current report surface in `memory/page.tsx`: detail mode still renders inside `SheetContent`.
- Located the Screening evidence hard failure in `employee-api.ts`: `normalizeScreeningPayload()` throws `EmployeeTaskError("marker_missing", "背调报告缺少可追溯证据 URL：...")` when the employee output has no evidence URL.
- Patched `memory/page.tsx`:
  - removed the non-failed progress `showNotice()` from `createProgressHandler()`, so only the global task status bar shows live progress;
  - removed the 3-second highlight timeout; highlighted memory rows now stay flashing until row/card `onMouseDown` clears them;
  - moved detail/report mode out of the right-side `Sheet` and into centered `MemoryReportDialog`, while keeping add/filter in the sheet.
- Patched `employee-task-runner.ts` Accio prompt:
  - required `purchase_intent`, `negotiated_prices`, `behavior_signals`, `screening_handoff_target`, `memory_preview`, and source references;
  - accepts `memory_write_preview` by copying it into `memory_preview`.
- Patched `employee-api.ts`:
  - Accio normalization now accepts `memory_write_preview`, derives purchase intent/price facts from preview/handoff fields when the employee returned them under adjacent keys, and always builds a non-empty `accio_memory` handoff target;
  - empty behavior signals now preserve `negotiation_summary` as a summary so list/detail reports are not vague fallback only;
  - Screening normalization no longer throws on missing evidence URL; it creates an internal traceability-gap evidence marker, forces `risk_tier: "insufficient_evidence"`, uses null score / low coverage, and adds a concrete coverage gap.
- Patched `sentura/dashboard/src/lib/cross-border-store/accio.ts` memory fact payload to retain `negotiation_summary`, `behavior_signals`, and `source_references`.
- Updated `scripts/test-cross-border-agents.ts` assertions for persistent highlight, centered memory report dialog, Accio deal-fact normalization, and Screening insufficient-evidence behavior.
- Found the concrete cause of the existing vague Global/Nordic reports in local DB:
  - bad analyzed rows were created from placeholder conversations such as `已导入，等待记忆员工分析后生成写入预览。`;
  - the original real imported chats still existed as queued imports (`accio_hq_001`, `accio_low_001`) but were hidden by duplicate suppression after the bad summary existed.
- Patched existing-import analysis flow:
  - added `getAccioImportAnalysisPayload()` in `sentura/dashboard/src/lib/cross-border-store/accio.ts`;
  - added GET route `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/imports/[id]/route.ts`;
  - added `fetchEmployeeAccioImportPayload()` in `employee-api.ts`;
  - changed `submitExistingMemoryTask()` in `memory/page.tsx` to reload stored redacted chat from DB instead of fabricating a single-message payload from `record.summary`.
- Patched `sentura/dashboard/src/lib/cross-border-store/customers.ts` so Accio-sourced Screening reports merge back into the matching `accio_summary` handoff row and the intermediate `screening_target` row is hidden.
- Repaired local test DB rows:
  - updated `Global Express Electronics` and `Nordic Phone Parts AB` Accio summary JSON fields from the already stored redacted chat facts;
  - completed the prior failed Nordic Screening run `run_656f8cda-cfa4-45d2-b0f7-83aa17c77343` with an `insufficient_evidence` report (`screening_report_nordic_missing_evidence_20260618`).
- Browser/API verification:
  - `GET /employee/memory/imports/accio_import_77b47fc5-cd41-4871-b9bf-8dac7c00338c` returned real Nordic messages with 20,000 pcs, USD 0.34, 9H report, packaging, and payment terms.
  - Memory page `查看报告` opens a centered dialog; right-side sheet is not visible.
  - Memory row highlight remains after 4 seconds and clears only after row/card mousedown.
  - Customers API now returns exactly one Nordic row as `recordType: "accio_summary"`, `screeningStatus: "insufficient_evidence"`, `latestScreeningReportId: "screening_report_nordic_missing_evidence_20260618"`.
- Verification commands passed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` (`363 passed, 0 failed` after final assertion update)
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db` (`147 passed, 0 failed`)

### Current State

- Latest-turn code patch has been applied.
- Worktree already contains many prior CBE edits; do not revert unrelated files.
- Latest requested behavior is implemented and verified against the running local dev server on port 3000.
- Existing local bad Global/Nordic demo rows were repaired in the local PostgreSQL test DB.

### Next Steps

1. If further QA is needed, manually refresh:
   - `/client-demos/cross-border/employee/memory`
   - `/client-demos/cross-border/employee/customers?highlightCustomer=accio_summary_aa540875-5337-44cb-852e-7fea3d1da976`
2. Do not reintroduce `showNotice(progress.message, "info", 0)` in memory progress handling; the global top task bar is the single live progress surface.
3. Keep Accio existing-record analysis DB-backed; do not rebuild chat payloads from list summary text.

## Current Turn — 2026-06-18 CBE Manager Account Design/UI Audit

### Task Introduction

User asked in Chinese to find the existing manager-account version design and UI for the Sentura cross-border e-commerce platform under `/Users/purest./Documents/Sentura/Sentura-Platform`, where the current implemented version is mainly the employee-account version. Intended final outcome: explain the complete manager-account design thinking, grounded in existing repo docs and UI/source files, not invented product ideas.

Hard constraints:
- Answer the user in Chinese.
- Use local repo evidence first: design docs, Phase 2 docs, UI docs, memory matrix/detail docs, and dashboard source.
- Distinguish implemented UI from planned or documented design if the repo shows a gap.
- Do not make unrelated code changes.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current cwd: `/Users/purest./Documents/Sentura`
- Key docs expected from AGENTS guidance for CBE UI/design work:
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `docs/tests/tests-cross-border-phase2.md` only if test/design verification is needed
  - `跨境电商/DESIGN.md`
  - `跨境电商/PHASE-2.md`
  - `跨境电商/UI.md`
- Likely UI/source areas:
  - `sentura/dashboard/src/app/client-demos/cross-border/**`
  - any `admin`, `manager`, `management`, `owner`, `operator`, `role`, `tenant`, or Chinese `管理` references.

### Task Flow

1. Preserve this handoff before broad repository scans.
2. Read the CBE design/UI docs and memory matrix rows relevant to Phase 2 manager/admin work.
3. Search dashboard route/source files for manager/admin/account role UI.
4. Separate three layers in the final answer:
   - product design intent and user role model;
   - actual UI structure/screens/components found in code/docs;
   - current implementation gaps or places where the manager version is only planned.
5. Update this handoff after the main scan before final response if meaningful findings emerge.

### Progress So Far

- Existing repo `AGENTS.md` was read enough to confirm CBE UI/design docs to inspect and the requirement to maintain handoff/resume context.
- User-level memory was checked; relevant prior context says this checkout has a CBE employee flow and `outputs/task_handoff.md` should be inspected before changing or analyzing the UI.
- Existing `outputs/task_handoff.md` was read and this current-turn section was added before broad code/doc scans.
- Read CBE role/design sources:
  - `跨境电商/UI.md`
  - `跨境电商/PHASE-2.md`
  - `跨境电商/DESIGN.md`
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `docs/tests/tests-cross-border-phase2.md`
- Searched source with manager/admin/operator/role/tenant/管理 keywords.
- Key evidence found:
  - `跨境电商/UI.md` states admin monitoring boundary is designed but detailed Admin monitoring page implementation remains planned.
  - `跨境电商/PHASE-2.md` defines exactly two customer-facing roles: `operator` and `admin`; admin is a customer-side supervisor, not a Sentura platform admin.
  - Admin modules are `总览`, `实时任务`, `获客与背调汇总`, `员工视图`, and `Agent 使用统计`.
  - Dashboard source has admin read-only API routes:
    - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/overview/route.ts`
    - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/live-tasks/route.ts`
    - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/customers/route.ts`
    - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/route.ts`
    - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/[id]/route.ts`
    - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/agent-usage/route.ts`
  - Admin data reads are implemented in `sentura/dashboard/src/lib/cross-border-store/admin.ts`.
  - Role/security boundary is implemented in `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts` through `resolveCbeTenantContext()` and `requireCbeAdmin()`.
  - Seed users include one admin `cbe-user-admin-001` and two operators in `sentura/lib/cross-border-store/ids.ts`.
  - Current visible cross-border app routes under `sentura/dashboard/src/app/client-demos/cross-border/` do not include `admin/page.tsx`; `find ... -name page.tsx` only found employee, lead-discovery, screening, and accio-memory pages.
  - Current `AppShell` `employeeNav` only renders `个人中心`, `获客与背调`, and `记忆整理`, so there is no implemented admin navigation tab yet.

### Current State

- No code changes have been made.
- Analysis evidence is gathered.
- Working conclusion: manager-account design is present as a product/UI plan and server-side read-only monitoring API boundary; full visual Admin page UI is not implemented yet.
- Worktree may already contain unrelated CBE changes from earlier 2026-06-18 work; do not revert or overwrite unrelated edits.

### Next Steps

1. Produce the Chinese explanation with exact file paths and clear distinction between implemented UI and planned page work.
2. If user wants implementation next, first create `/client-demos/cross-border/admin/page.tsx`, add role-aware admin nav in `AppShell`, and wire it to the existing six admin APIs.

## Current Turn — 2026-06-18 CBE Memory Analysis UX And Accio Handoff Fixes

### Task Introduction

User reported four issues on the CBE Employee `记忆整理` flow:

1. During memory analysis, keep only the top global task progress and remove the duplicate lower progress/status display.
2. Clicking a memory task in the message center should navigate to `记忆整理` and flash the corresponding row with a light-blue outline.
3. Clicking `发送到背调` currently only shows `已创建聊天记录移交客户行，可在获客与背调中继续调研。`; the customer, e.g. `Nordic Phone Parts AB`, does not appear in `获客与背调`, and the analyzed report detail content does not materially change.
4. After analysis, the memory list should keep only analyzed rows; the un-analyzed upload row should not remain as a duplicate.

Intended final outcome: memory analysis creates one visible analyzed row per conversation, message/task navigation highlights the right row, sending to Screening actually creates a customer/work item visible in `获客与背调`, and duplicate progress/record surfaces are removed.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Primary files:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `sentura/dashboard/src/lib/cross-border-store/customers.ts`

### Task Flow

1. Preserve this handoff before broader edits.
2. Inspect existing memory row projection, notification routing, memory sheet duplicate progress UI, and Accio handoff persistence.
3. Patch memory list projection to avoid import-only duplicate rows once summaries exist.
4. Patch message center routing/highlight for `accio_memory` tasks.
5. Patch `发送到背调` so it creates or exposes an Accio handoff/customer row in the `获客与背调` list, or route to existing handoff-backed row if already present.
6. Run focused TypeScript/static tests and update this handoff before final response.

### Progress So Far

- Scope captured; code inspection started.
- Existing handoff preserved before implementation.
- Implemented memory notification highlight:
  - `sentura/dashboard/src/components/app-shell.tsx` now routes `accio_memory` notifications to `/client-demos/cross-border/employee/memory?highlightTask=<taskId>`.
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx` reads `highlightTask`, finds rows whose `latestAgentRunId` matches, scrolls them into view, and clears the light-blue flash after 3 seconds.
- Removed the duplicate lower progress/row surface for analysis runs by changing `sentura/dashboard/src/lib/cross-border-store/accio.ts`:
  - hides running/polling unsummarized Accio import rows;
  - hides stale same-company unsummarized import rows when an analyzed summary already exists;
  - returns `agentRunStatus` correctly to the frontend.
- Fixed duplicate memory list identity:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts` now uses `summaryId` as the memory row `recordId` when available, so analyzed rows do not collide with import rows.
- Improved analyzed report content:
  - `accio.ts` now derives `summaryText` from purchase intent, negotiated price, Incoterm/payment, and next action JSON where available instead of only behavior summary/next-action fallback.
- Fixed `发送到背调` behavior:
  - memory detail button now routes to `/client-demos/cross-border/employee/customers?highlightCustomer=<summaryId>`.
  - `sentura/dashboard/src/lib/cross-border-store/customers.ts` projects `accio_summaries` as `record_type='accio_summary'` / `lead_status='accio_handoff'` rows, so analyzed Accio buyers appear in `获客与背调`.
  - `employee-api.ts` maps `accio_summary` records to UI source `accio_handoff`.
- Added regression guards in `scripts/test-cross-border-agents.ts` for memory-task highlight, memory handoff navigation, duplicate import suppression, and Accio handoff customer projection.

Validation completed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 357/357.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147.
- Direct DB-backed store read with `listEmployeeCustomers` / `listEmployeeMemoryRecords`: PASS; local DB shows `Nordic Phone Parts AB` as one `accio_handoff` customer row and memory list reduced to one analyzed Nordic row.
- Headless Chrome UI flow against `http://localhost:3000`: PASS; `/memory` has one visible Nordic analyzed row, `/memory?highlightTask=<agentRunId>` flashes the Nordic row, clicking `发送到背调` routes to `/customers?highlightCustomer=<summaryId>`, the Nordic customer row flashes there, and browser console errors were empty.
- `git diff --check`: PASS.

### Current State

- Implementation complete for the four requested fixes.
- Worktree already contains prior CBE changes; do not revert unrelated edits.
- Browser flow was validated with system Chrome via Playwright package because the local Playwright-managed Chromium binary was not installed.

### Next Steps

1. User can refresh `/client-demos/cross-border/employee/memory` and `/client-demos/cross-border/employee/customers`.
2. For already-analyzed Accio rows, `发送到背调` should open `获客与背调` and flash the matching Accio handoff row.
3. If a future browser pass is needed, test message center click on a completed `记忆整理` notification and the `发送到背调` button against the running dashboard.

## Current Turn — 2026-06-18 CBE List Product Expansion, Beijing Time, Cost Estimate, Message/Task Dismissal Fixes

### Task Introduction

User provided a screenshot and requested six concrete fixes:

1. Replace product `+1` overflow chip with click-to-expand full product list.
2. Remove the `新找到` badge from customer rows; replace `已完成` badge with a green check mark.
3. Format `找到时间` as `2026-06-18 10:54:03`, not ISO `2026-06-18T10:54:03.237Z`, and display it in Beijing time.
4. Ensure Screening/background-check estimated price uses actual price calculation rather than demo values.
5. When message center is open, clicking outside the message window should close it automatically.
6. Fix task progress banner bug: after a completed task is dismissed with the close `x`, it must not reappear after route/page switching.

Intended final outcome: the customer list is clearer, dates are localized for Chinese users, cost estimates are explainable/realistic, and notification/task overlays have predictable dismissal behavior.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- App route: `/client-demos/cross-border/employee/customers`
- Likely files:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `scripts/test-cross-border-agents.ts`

### Task Flow

1. Read current Product Design and Next.js guidance; user has provided enough brief/screenshot context, no follow-up question needed.
2. Preserve this handoff before code scans/edits.
3. Inspect list product chips, time formatting, screening budget calculation, message center popover, and task status dismissal state.
4. Patch narrow UI/state/cost logic and update focused tests.
5. Run focused CBE regression, dashboard typecheck, browser smoke where feasible, then update this handoff.

### Progress So Far

- Implemented product overflow expansion in `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`:
  - first two products remain visible;
  - `+N` is now a clickable inline control with `aria-expanded`;
  - expanded rows show all products and a `收起` control.
- Removed row `新找到` badges from desktop and mobile rows while preserving task-linked blue flash highlighting.
- Changed screened row status from text `已完成` to green `✅`; `not_started` no longer renders a workflow badge.
- Added Beijing-time `formatBeijingDateTime` for desktop rows, mobile cards, and report detail metrics, producing `YYYY-MM-DD HH:mm:ss` with no ISO `T`/`Z`.
- Reworked Screening task budget estimates in `employee-data.ts` and the customer page so estimated cost is itemized from configured unit assumptions for OpenAI model tokens, Tavily search, optional Abstract/Hunter email checks, and optional paid trade-data budget.
- Added outside-click close behavior to the global message center in `sentura/dashboard/src/components/app-shell.tsx`.
- Fixed completed task banner dismissal:
  - `use-cbe-employee-store.ts` now persists recently dismissed task IDs in `draftCache` and preserves dismissals when API polling refreshes tasks;
  - `employee-api.ts` exposes `dismissEmployeeTaskInDb`;
  - `employee-task-status.tsx` closes all terminal banners when a terminal task is dismissed, preventing older completed banners from replacing the closed one after route switching;
  - the DB dismiss API writes `metadata_json.dismissed_at`, which maps back to `dismissed`.
- Updated regression guards in `scripts/test-cross-border-agents.ts`.
- Updated docs:
  - `docs/tests/tests-cross-border-phase2.md`
  - `docs/TESTS.md`
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `docs/MEMORY.md`

Validation completed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 353/353.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 127/127.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147.
- `git diff --check`: PASS after code, docs, resume card, and handoff updates.
- Browser validation with system Chrome against `/client-demos/cross-border/employee/customers`: PASS, 15 visible rows, product `+1` expanded in place with `收起`, found times rendered as Beijing `YYYY-MM-DD HH:mm:ss`, no ISO markers, no `新找到`, green `✅` present, task close left zero task-status buttons immediately and after route switching, and browser console had no errors.
- Browser validation against message center: PASS, dialog opened with `aria-expanded=true`, outside click closed it and reset `aria-expanded=false`, and browser console had no errors.

### Current State

- Current turn implementation is complete.
- Local dev server responds at `http://localhost:3000/client-demos/cross-border/employee/customers`.
- Worktree still contains prior CBE changes from earlier 2026-06-18 turns; do not revert unrelated edits.
- Browser verification saw only a Next.js LCP warning for `/sentura-logo-side.svg`; no browser console errors were observed.

### Next Steps

1. Final response should answer in Chinese and mention the verified local URL plus the main checks.
2. If committing, stage CBE-related files deliberately because the worktree includes prior same-day CBE hardening changes as well as this polish pass.

## Current Turn — 2026-06-18 CBE Lead + Screening Concurrent Timeout

### Task Introduction

User reports that a standalone screening/background-check task can complete, but when Lead Discovery and Screening run at the same time the Screening task consistently fails with `LLM idle timeout (120s): no response from model` after tool calls. Screenshot shows a failed `背调任务` for `Currys, iFixScreens` at `06/18 21:14`. User asks to evaluate whether simultaneous execution is supported, and if supported, fix the issue.

Intended final outcome: determine from code/logs/runtime evidence whether Lead Discovery and Screening are meant to be concurrent. If concurrency is supported, fix the backend/runtime path so Screening does not fail under concurrent Lead Discovery. If the platform cannot safely support concurrency, make that explicit in product logic and UI rather than silently failing.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch: `wst1.0-ecommerce` tracking `origin/ecommerce`
- Local app: Dashboard `http://localhost:3000`, Gateway `http://localhost:18789`
- Local DB: `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`
- Relevant runtime logs expected under `${TMPDIR}/sentura-demo/dashboard.log` and `${TMPDIR}/sentura-demo/gateway.log`
- Primary files to inspect: hidden employee task runner, Gateway client RPC timeout handling, OpenClaw chat/session runtime timeout config, customer page task gating, focused CBE agent tests.

### Task Flow

1. Preserve this handoff before log/database/code investigation.
2. Inspect latest failed run in PostgreSQL around `2026-06-18 21:14`, including `agent_runs`, activity events, metadata, and session key.
3. Inspect Dashboard and Gateway logs for `LLM idle timeout`, `Currys`, `iFixScreens`, and session/task identifiers.
4. Trace timeout propagation from CBE runner to dashboard Gateway client to OpenClaw chat/session runtime.
5. Decide whether the intended product contract is true concurrency or serialized work; patch the implementation and focused tests accordingly.
6. Verify with type checks and focused tests; avoid live Lead Discovery/Screening reruns unless needed because they can incur model/search cost and write to the DB.

### Progress So Far

- User report captured with exact failure text and affected companies.
- Vercel investigation and Next.js App Router guidance were read before beginning runtime/debug work.
- Handoff updated before running the broader log/database/code investigation.
- DB evidence: failed run `run_d5f9bf1c-2cff-48ac-8bbc-8a4ecc1c7f8a` started `2026-06-18 21:12:03+08`, was marked failed at `21:14:36+08`, target `Currys, iFixScreens`, error `LLM idle timeout (120s): no response from model`.
- Gateway evidence: same screening session `agent:cbe-buyer-screening:...:db672057-...` continued running after the DB failure, retried after the idle timeout, emitted `SCREENING_REPORTS_JSON_START` around `21:18:03-21:18:10+08`, and completed at `21:18:10+08` after about 367 seconds.
- Root cause identified: concurrency itself was not the primary blocker. The Dashboard runner treated the first recoverable OpenClaw idle-timeout transcript entry as a terminal failure, while OpenClaw was still retrying and later produced a valid structured report. Also, `agents.defaults.timeoutSeconds=900` did not raise the cloud provider stream idle watchdog; OpenAI provider requests still logged `timeoutMs=120000`.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts` so recoverable `LLM idle timeout` / empty aborted assistant transcript entries are recorded and the runner continues polling until a final marker appears or the overall task timeout expires.
- Patched `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` to set `models.providers.openai.timeoutSeconds` alongside `agents.defaults.timeoutSeconds` when the preferred model is `openai/...`.
- Patched local `~/.openclaw/openclaw.json` to set `models.providers.openai.timeoutSeconds=900` without printing secrets.
- Updated static regression checks in `scripts/test-cross-border-agents.ts`.
- Validation so far:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, `348 passed, 0 failed`.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
- Restarted services with `./scripts/start-sentura-demo.sh restart`; Gateway `http://localhost:18789`, Dashboard `http://localhost:3000`.
- Verified local runtime config after restart:
  - `agents.defaults.timeoutSeconds=900`
  - `models.providers.openai.timeoutSeconds=900`
- Recovered the already-failed user run without rerunning the model:
  - extracted the final `SCREENING_REPORTS_JSON` from session `9a5ec719-3149-40b2-9562-8d0c11de4733`;
  - called the local Screening completion API for `run_d5f9bf1c-2cff-48ac-8bbc-8a4ecc1c7f8a`;
  - inserted 2 screening reports and 21 evidence rows;
  - cleared temporary validation/failure metadata from that run.
- Final DB/API verification:
  - latest task API returns `run_d5f9bf1c-2cff-48ac-8bbc-8a4ecc1c7f8a` as `completed`;
  - customer API now returns 15 items;
  - `Currys` is `screened`, risk `trusted_candidate`, score `84.00`;
  - `iFixScreens` is `screened`, risk `high_risk`, score `58.67`.
- Final validation after recovery:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, `348 passed, 0 failed`.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, `147 passed, 0 failed`.
  - `git diff --check`: PASS.

### Current State

- Root cause is confirmed from DB and Gateway logs.
- Product support for concurrent Lead Discovery + Screening should remain enabled; the failing run eventually produced valid Screening JSON while Lead Discovery was also running.
- Code/config patches are in place and focused validation passed.
- Services are running.
- The user's failed 21:14 Screening run has been repaired in the local DB and now appears completed in APIs.
- No live Lead Discovery/Screening rerun was started after the fix to avoid extra model/search spend.

### Next Steps

1. User can refresh `http://localhost:3000/client-demos/cross-border/employee/customers` and inspect Currys/iFixScreens as completed screening rows.
2. Next live concurrent Lead + Screening run should no longer fail early on a recoverable 120s idle-timeout transcript entry; provider idle timeout is also configured at 900s for OpenAI.
3. If committing, include this turn's files plus earlier intended CBE hardening files deliberately; do not stage unrelated changes blindly.

## Current Turn — 2026-06-18 CBE Customer List UX Updates And Task-Completion Highlight

### Task Introduction

User confirmed six concrete UI/interaction changes for the CBE Employee `获客与背调` page:

1. Keep the current customer-list primary information columns; they are considered direct and necessary.
2. Make full-row status background colors lighter.
3. Keep the top `删除所选` action, but remove per-row delete buttons because they are repetitive.
4. Merge `评分高到低` and `评分低到高` into one sort dropdown/select instead of two persistent buttons.
5. Make score/status labels more business-oriented: high score adds `优先跟进`, medium adds `谨慎跟进`, low adds `暂缓/高风险`, and `证据不足` remains gray.
6. In the message center/task-completion reminder flow, clicking a completed task should locate newly found customers or newly completed screening rows in the customer list and show a light-blue flashing outline around those rows for 3 seconds.

Intended final outcome: the existing information architecture stays intact, but row emphasis is calmer, row actions are less noisy, sorting is compact, score labels are more actionable, and task-completion messages can visually guide the user to affected customer rows.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch expected from prior work: `wst1.0-ecommerce`
- App: Next.js Dashboard, route `/client-demos/cross-border/employee/customers`
- Primary file already identified: `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- Related state/API files to inspect next: CBE employee store, task status/message center components, employee shell/layout, task API projections.

### Task Flow

1. Read Product Design get-context and Next.js App Router guidance; the user supplied an explicit implementation brief, so no additional design questions are needed.
2. Preserve this handoff before scanning message-center/task-notification code and editing UI files.
3. Inspect existing task/message-center click behavior and task-to-customer relationships.
4. Patch customer list row classes, row actions, compact sort control, score labels, and highlight-on-task-click plumbing.
5. Run focused TypeScript/tests and, if feasible, browser/UI smoke for `/client-demos/cross-border/employee/customers`.

### Progress So Far

- Implemented the customer-list UX update in `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`:
  - kept the existing main row information/columns;
  - lightened row status backgrounds;
  - removed desktop/mobile row-level delete buttons;
  - kept top `删除所选`;
  - merged score sort buttons into one `评分排序` select in both desktop filters and drawer filters;
  - added business score labels (`优先跟进`, `谨慎跟进`, `暂缓/高风险`) and kept `证据不足` gray;
  - added `highlightTask` query handling, row data attributes, filter clearing, visible-row scroll, and 3-second light-blue flash.
- Implemented notification/task routing in `sentura/dashboard/src/components/app-shell.tsx`: Lead/Screening terminal task notifications now link to `/client-demos/cross-border/employee/customers?highlightTask=...`.
- Added task-to-customer mapping support:
  - `sentura/dashboard/src/stores/use-cbe-employee-store.ts` task records now support `affectedCustomerIds`;
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts` customer items expose `leadAgentRunId` and `screeningAgentRunId`;
  - `sentura/dashboard/src/lib/cross-border-store/customers.ts` projects lead/screening run IDs;
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts` maps affected IDs from task metadata and sends screening target IDs;
  - `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts` and `screening.ts` save affected customer IDs into completion metadata.
- Updated regression coverage in `scripts/test-cross-border-agents.ts`.
- Updated docs:
  - `docs/tests/tests-cross-border-phase2.md`
  - `docs/TESTS.md`
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `docs/MEMORY.md`
  - `outputs/resume_card.md`

Validation completed:

- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 345/345.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 127/127.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147.
- `git diff --check`: PASS.
- `curl -I http://localhost:3000/client-demos/cross-border/employee/customers`: HTTP 200.
- Browser `/client-demos/cross-border/employee/customers`: PASS, `评分排序` select present, one top `删除所选`, zero row-level delete buttons, 10 visible customer rows, no console errors.
- Browser `/client-demos/cross-border/employee/customers?highlightTask=run_4d25b516-78d7-438f-9bb4-578a88e22127`: PASS, five visible screening rows flashed, located notice appeared, highlight cleared after 3 seconds, no console errors.

### Current State

- The requested current-turn UX changes are complete and verified.
- Local DB currently has 10 visible customer records, including a completed screening task `run_4d25b516-78d7-438f-9bb4-578a88e22127`; this was used for the browser `highlightTask` smoke.
- Existing pre-task dirty changes from earlier CBE hardening work remain in the worktree and were not reverted.

### Next Steps

1. User can review `http://localhost:3000/client-demos/cross-border/employee/customers`.
2. If committing, include this turn's files plus the earlier related CBE hardening files intentionally in scope; do not stage unrelated runtime files.
3. P2.4 Lead Discovery coordinator concurrency remains the next planned Phase 2 implementation lane.

## Current Turn — 2026-06-18 CBE Product Hardening: Customer List Polish, Target Count, Budget, Evidence Gaps

### Task Introduction

User asked for five follow-up fixes on the CBE employee platform:

1. Remove the `最长等待剩余` wording from running task progress.
2. Visually distinguish newly found customers from completed customers in the list; newly found customers should get a light-blue flashing outline for 3 seconds when entering the list.
3. Fix the target-count input bug where single-digit values other than `1` cannot be entered, and cap lead discovery at at most 20 customers.
4. Ensure lead discovery budget estimates reflect real pricing rather than demo values.
5. Evidence gaps currently all show `缺少该维度证据`; fill gaps according to what was actually searched and missing.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch: `wst1.0-ecommerce` tracking `origin/ecommerce`
- Active app: Next.js Dashboard, CBE employee route `/client-demos/cross-border/employee`
- Relevant files expected: employee hidden task runner, customers page/list UI, cost/budget helpers, screening evidence/gap rendering, focused CBE tests.

### Task Flow

1. Read Next.js skill guidance because changes are inside App Router client components and API-bound UI.
2. Preserve this handoff before scanning and editing.
3. Inspect existing progress text, target-count controls, customer row rendering, budget copy/math, and evidence gap mapping.
4. Patch narrow UI/data logic and update focused tests.
5. Run `pnpm exec tsx scripts/test-cross-border-agents.ts`, dashboard typecheck, and API/UI smoke where feasible.

### Progress So Far

- Handoff skeleton created before code edits.
- Removed `最长等待剩余` from hidden runner progress messages; running progress now shows elapsed time and poll count only.
- Added 1-20 customer cap across UI, client API, hidden runner output slicing, and server schema (`target_count.max(20)`).
- Fixed target-count input by introducing text draft state (`leadTargetCountText`) so single-digit values like 2-9 can be entered normally.
- Added new customer visual treatment in the list:
  - `新找到` workflow badge for not-yet-screened customers.
  - `已完成` badge for screened customers.
  - Newly returned lead rows flash with a light-blue outline/pulse for 3 seconds after a successful lead task.
- Rebuilt lead discovery budget estimate around current official unit pricing:
  - OpenAI GPT-5.5 short-context model unit prices.
  - Tavily pay-as-you-go advanced search price (`2 credits * $0.008/credit = $0.016/search`).
  - Estimated input/cache/output tokens, fetched pages, retained candidates, and safety multiplier.
- Replaced generic evidence-gap fallback with concrete source-specific gap reasons/actions using score block and status:
  - legal identity, domain/email, public footprint, business fit, trade/financial, conversation behavior.
  - If model returns only generic `缺少该维度证据`, UI mapping derives specific gaps from `score_blocks`.
- Evidence gap UI now displays the evidence dimension label next to the reason.
- Updated focused tests in `scripts/test-cross-border-agents.ts`.

### Current State

- Code changes for all five follow-up requests are complete.
- Services were already running; customer route returns HTTP 200.
- Live DB currently has real business data: 10 customer rows from a completed lead task and completed screening task. Do not delete them.
- Validation:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, `342 passed, 0 failed`.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, `147 passed, 0 failed`.
  - `curl -I http://localhost:3000/client-demos/cross-border/employee/customers`: HTTP 200.
  - `GET /api/client-demos/cross-border/employee/tasks?limit=5`: returned `items=3`, no error.

### Next Steps

1. Optional visual browser check of `/client-demos/cross-border/employee/customers` to inspect the new `新找到`/`已完成` badges and row colors with the current 10 customer records.
2. To see the 3-second flash, run a small live lead task for 1-2 customers; do not run this automatically without user approval because it can incur model/search cost and writes to the DB.
3. If committing, include this turn's changed files plus earlier intended startup/task-hardening files; do not stage unrelated runtime files.

## Current Turn — 2026-06-18 CBE Product Hardening: Real Progress, LLM Timeout, DB State, Cost Consistency

### Task Introduction

User reported four production-readiness issues in the cross-border e-commerce employee platform and asked to eliminate demo-only behavior:

1. Background task progress text shows `预计剩余 09:42，当前约 10%`, apparently always starting from `10:00` and not matching real task ETA.
2. Lead/customer discovery failed after tool calls because the backend model hit `LLM idle timeout (120s): no response from model`; the system did not generate a structured report.
3. `获客与背调` customer/company count is now 0; user suspects the DB was reattached/reset and wants clear behavior.
4. API cost still shows previous billing even if business data was reset, creating inconsistent state.

Intended final outcome: make the platform use real runtime data for task progress/ETA, handle agent/LLM timeout with actionable persisted failure state, make DB empty-state/reset status explicit, and align cost metrics with the active database/run scope so customers can use the product without demo artifacts.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch: `wst1.0-ecommerce` tracking `origin/ecommerce`
- Current user-facing app: Dashboard on `http://localhost:3000`, CBE employee route `/client-demos/cross-border/employee`
- Local PostgreSQL from prior setup: `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`
- Important runtime files likely involved: Employee task runner, task status/progress UI, CBE store/API routes, Gateway/OpenClaw logs, cost aggregation components.

### Task Flow

1. Preserve this handoff before code search and debugging.
2. Inspect current dirty files to avoid overwriting user work.
3. Trace the user story: employee Lead Discovery UI -> hidden task runner -> Gateway/LLM session -> persisted DB rows -> dashboard/task/cost projections.
4. Find all places using fixed 10 minute ETA, demo progress, local-only costs, or non-persisted failure handling.
5. Patch the smallest set of files so displayed progress/cost/state are derived from real timestamps, persisted runs, and active DB records.
6. Verify with type checks, focused scripts, API probes, and if possible a browser/API end-to-end smoke.

### Progress So Far

- Started this task after prior environment setup and startup documentation work.
- Existing dirty files before this turn: `outputs/task_handoff.md` and `启动说明.md`; do not revert them.
- Read Next.js and Vercel verification skill guidance for App Router debugging and end-to-end evidence.
- Queried local PostgreSQL `sentura_cbe_dev`; current DB has `agent_runs=1`, `lead_runs=1`, `lead_candidates=0`, `screening_targets=0`, `screening_reports=0`, `accio_imports=0`, `api_call_ledger=0`.
- Latest DB run is `cbe-lead-discovery` and failed with `后台模型在工具调用后超时，未能生成结构化报告：LLM idle timeout (120s): no response from model`; this explains why `获客与背调` has 0 companies.
- Found cost mismatch source: `api_call_ledger` is empty in current DB, while `~/.openclaw/sentura-cost/cost-*.jsonl` contains historical events for the same CBE user token. Cost UI was summing user-token history rather than only current DB task sessions.
- Patched progress logic so active task progress/remaining time is based on `timeoutMs`/deadline and elapsed wall time, not a fixed/demo `estimatedMs` ETA.
- Patched task status UI labels to show `计划耗时`, `最长等待`, `已用`, `剩余等待`, and `最后活动`.
- Patched hidden employee runner polling message to show measured elapsed time, max-wait remaining time, and poll count; removed `预计剩余`/`当前约` wording.
- Patched DB task projection/API mapping to carry `lastActivityAt` from `agent_runs.last_activity_at`.
- Patched cost mini-panel to count only cost events whose `sessionKey` exists in current DB task records, and to disclose excluded historical `sentura-cost` rows.
- Patched CBE empty states on employee home/customers pages to explain current DB is empty and show the latest persisted lead failure reason/session key.
- Initially tried `timeoutSeconds: 900` on individual CBE agent config objects, but OpenClaw rejected `agents.list[].timeoutSeconds` as invalid schema. Removed that incompatible field from agent templates, setup overrides, and local `~/.openclaw/openclaw.json`.
- Correct timeout fix: set `agents.defaults.timeoutSeconds=900` in setup scripts and local `~/.openclaw/openclaw.json`, using `SENTURA_AGENT_TIMEOUT_SECONDS` or fallback `CBE_AGENT_TIMEOUT_SECONDS`/`900`. Gateway now validates and starts.
- Updated `scripts/test-cross-border-agents.ts` expectations so tests protect measured wait/cost-scoped behavior instead of the old demo ETA strings.
- Validation completed:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, `339 passed, 0 failed`.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, `147 passed, 0 failed`.
  - `./scripts/start-sentura-demo.sh restart`: PASS after switching timeout config to `agents.defaults.timeoutSeconds`; Gateway `http://localhost:18789`, Dashboard `http://localhost:3000`.
  - `curl -I http://localhost:3000/client-demos/cross-border/employee`: HTTP 200.
  - `GET /api/client-demos/cross-border/employee/tasks?limit=50`: returned 1 failed task with `lastActivityAt`.
  - `GET /api/client-demos/cross-border/employee/customers?limit=100`: returned `items=0`, no error.

### Current State

- Code patches for all four reported product issues are in place and focused tests/type checks/API smokes passed.
- Current local DB being empty is a real DB state, not only a UI projection. It is empty because the latest lead task failed before writing `lead_candidates`.
- Current cost ledger in DB is empty; historical OpenClaw JSONL costs must not be displayed as current CBE workbench cost unless their session key belongs to a task in the active DB.
- Services are running after restart. Gateway log confirms plugins loaded and cost events RPCs are responding; dashboard log confirms employee page and APIs return 200.

### Next Steps

1. Optionally open `http://localhost:3000/client-demos/cross-border/employee` in the browser and verify the user-facing empty state text visually.
2. Start a new small lead task to confirm the new `agents.defaults.timeoutSeconds=900` prevents the earlier `LLM idle timeout (120s)` path in a live run.
3. If committing, include only this task's files plus prior intended doc changes; do not stage unrelated generated/runtime files.

## Current Turn — 2026-06-18 Local Environment Bootstrap For Latest `ecommerce`

### Task Introduction

User pulled latest `origin/ecommerce` and asked Codex to install whatever is needed, decide whether PostgreSQL is required, verify the updated CBE Phase 2 platform can run locally, and confirm whether `./scripts/start-sentura-demo.sh restart` still starts everything.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current branch at start: `wst1.0-ecommerce` tracking `origin/ecommerce`
- Latest pulled commit: `03d24d8d Connected Database to UI + Agents`
- Important docs: `docs/memory/cross-border-ecommerce/phase-2.md`, `docs/tests/tests-cross-border-phase2.md`, `跨境电商/PHASE-2.md`
- New Phase 2 runtime dependency: local PostgreSQL reachable through `CBE_DATABASE_URL`, normally `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`
- Existing launcher: `scripts/start-sentura-demo.sh`; initial code inspection shows it starts Gateway and Dashboard, but does not itself start PostgreSQL or run DB migrations.

### Task Flow

1. Confirm repo status and latest pulled branch.
2. Inspect Phase 2 docs and launcher/runtime expectations.
3. Preserve this handoff before dependency installation, DB setup, long test runs, or server restart.
4. Next: check installed tools (`node`, `pnpm`, `brew`, `psql`/Postgres), install missing dependencies, create/start DB if needed, run migrations/seed, run focused CBE Phase 2 checks, then test launcher.

### Progress So Far

- `git status --short --branch`: clean on `wst1.0-ecommerce...origin/ecommerce`.
- Read relevant references for `CBE_DATABASE_URL`, PostgreSQL, `start-sentura-demo.sh`, and Phase 2 test commands.
- Confirmed from docs that CE18-CE20 live checks expect PostgreSQL and `CBE_DATABASE_URL`.
- Local tools checked:
  - Node: `v24.16.0`
  - pnpm: `11.5.1` initially; nested dashboard install used `11.6.0`
  - Docker CLI: `29.5.3`; Docker Desktop started successfully
  - `brew`, `psql`, and `pg_isready`: not available on PATH
  - no local listener on port `5432`
- `pnpm install`: PASS; installed/confirmed new root deps `pg` and `@types/pg`.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS; dashboard deps installed/confirmed.
- `./sentura/dashboard/node_modules/.bin/tsc --noEmit -p sentura/dashboard/tsconfig.json`: PASS.
- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, `127 passed, 0 failed`.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' ./scripts/start-sentura-demo.sh restart`: PASS for Gateway and Dashboard startup.
- `curl -I http://localhost:3000/client-demos/cross-border/employee`: HTTP 200.
- `curl ... /api/client-demos/cross-border/employee/customers`: returned `{"error":{"code":"internal_error","message":""}}`, expected while PostgreSQL is absent.
- Gateway log shows 18 plugins loaded and gateway ready on `18789`.
- Dashboard log shows Next.js ready on `3000`.
- Updated ignored local file `sentura/dashboard/.env.local` to include `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`; this is not tracked by Git.
- Tried PostgreSQL installation paths:
  - Docker Hub `postgres:16-alpine`: failed/stalled on Docker Hub auth/network timeout.
  - `mirror.gcr.io/library/postgres:16-alpine`: stalled during pull.
  - `cgr.dev/chainguard/postgres:latest`: made progress but stalled before image completion.
  - Official Postgres.app PostgreSQL 16 DMG download from GitHub release was started but network speed was about 1% per minute, so it was interrupted at about 3%.
- User installed Postgres.app with PostgreSQL 16.
- Found Postgres.app 16 tools at `/Applications/Postgres.app/Contents/Versions/16/bin`.
- Initialized local Postgres data directory at `/Users/purest./Library/Application Support/Postgres/var-16` with superuser `postgres` and dev password `postgres`.
- Started PostgreSQL 16.14 on `localhost:5432`; `pg_isready` reports accepting connections.
- Created database `sentura_cbe_dev`.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS; applied `001_initial_schema.sql`, `002_lead_scope_coordinator.sql`, seeded 3 users, 1 admin profile, 2 operator profiles.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, `147 passed, 0 failed`.
- `./scripts/start-sentura-demo.sh restart`: PASS after DB setup; Gateway on `18789`, Dashboard on `3000`.
- Employee page probe: `curl -I http://localhost:3000/client-demos/cross-border/employee`: HTTP 200.
- Employee API probes:
  - `/api/client-demos/cross-border/employee/customers`: HTTP 200 JSON `{"items":[],"limit":50,"offset":0}`
  - `/api/client-demos/cross-border/employee/tasks`: HTTP 200 JSON `{"items":[],"limit":50,"offset":0}`
- DB role probe: `admin=1`, `operator=2`.
- `psql ... -f scripts/inspect-cross-border-live-db.sql`: PASS; no SQL errors. Empty result sections are expected before any real employee tasks are run.

### Current State

- Gateway and Dashboard are currently running from `scripts/start-sentura-demo.sh restart`:
  - Gateway: `http://localhost:18789`
  - Dashboard: `http://localhost:3000`
  - Employee page: `http://localhost:3000/client-demos/cross-border/employee`
- Full Phase 2 DB-backed startup path is now live locally with Postgres.app PostgreSQL 16 on `localhost:5432`.
- `scripts/start-sentura-demo.sh` only starts Gateway and Dashboard. It does not start PostgreSQL, create `sentura_cbe_dev`, or run migrations/seed. After the local `.env.local` update, Dashboard will have `CBE_DATABASE_URL` once restarted, but the database server still must exist.
- The project dependencies and non-DB checks are installed/green.
- There is no remaining environment blocker for the DB-backed Employee API smoke path. Real Lead/Screening/Accio execution still depends on the normal OpenClaw/Gateway agent setup and any external/model API keys required by those employees.

### Next Steps

1. For normal local startup after reboot:
   - Start Postgres.app or start the server with `/Applications/Postgres.app/Contents/Versions/16/bin/pg_ctl -D "$HOME/Library/Application Support/Postgres/var-16" -l /tmp/sentura-postgres-16.log start`.
   - Run `cd /Users/purest./Documents/Sentura/Sentura-Platform && ./scripts/start-sentura-demo.sh restart`.
2. If schema changes are pulled later, rerun:
   `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`.
3. For a DB-backed smoke check:
   `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`.
4. Next product work remains P2.4 Lead Discovery coordinator unless user changes priority.

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
## Current Turn — 2026-06-18 Centered Screening Report Detail Modal

### Task Introduction

User asked to adjust the `查看报告` interaction on the cross-border ecommerce employee customer list so the detailed report window opens in the center of the viewport instead of as a right-side drawer. The intended result is a rectangular centered modal with tidy, clear report content layout. Other task drawers such as `寻找客户`, filters, manual screening, bulk screening, and delete confirmation should keep their existing behavior.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Main target file: `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- Local services from prior work are expected at:
  - Dashboard: `http://localhost:3000`
  - Gateway: `http://localhost:18789`
- Current customer page route: `http://localhost:3000/client-demos/cross-border/employee/customers`

### Task Flow

1. Inspect the customer page report detail implementation and identify why it opens from the right.
2. Split `mode === "detail"` away from the shared shadcn `Sheet` drawer while preserving all other sheet modes.
3. Build a centered `role="dialog"` report modal with a rectangular max-width layout, contained scroll, clear header, metric summary, conclusion, score breakdown, evidence, and evidence-gap sections.
4. Run focused TypeScript/static checks and, if feasible, browser-smoke the customer page.

### Progress So Far

- Read the page imports and key helper functions in `customers/page.tsx`.
- Confirmed `查看报告` calls `openDetail(item)`, which sets `sheetMode` to `"detail"`.
- Confirmed the detail content is currently rendered inside `<SheetContent className="w-full overflow-y-auto sm:max-w-xl">`, which forces the right-side drawer behavior and narrow layout.
- Added `ReportDetailDialog`, `ReportMetric`, and `ReportPanel` in `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`.
- `TaskSheet` now returns the centered report dialog for `mode === "detail"` and keeps shadcn `Sheet` for filters, lead, bulk, manual, and delete modes.
- Removed the old detail block from `SheetContent`.
- The modal now has a centered overlay, rectangular max-width layout, header metrics, conclusion, score breakdown, evidence details, customer overview, and evidence gaps.
- Also restored visible row workflow labels expected by the prior UI task: newly flashed customers show `新找到`, completed screened customers show `已完成`.

### Current State

- The centered modal implementation is in place.
- Focused checks passed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`
  - `git diff --check`
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: `348 passed, 0 failed`
  - `curl -I http://localhost:3000/client-demos/cross-border/employee/customers`: HTTP 200
- Browser layout check passed through system Chrome with Playwright:
  - opened `http://localhost:3000/client-demos/cross-border/employee/customers`
  - clicked first `查看报告`
  - dialog title: `Currys`
  - bounding box: left gap 144px, right gap 144px, width 1152px, height 936px, center delta 0
  - `证据明细` and `客户概览` rendered
- Mobile-width browser check passed at 390px viewport:
  - dialog left gap 12px, right gap 12px, width 366px, height 812px

### Next Steps

1. User can refresh `http://localhost:3000/client-demos/cross-border/employee/customers` and click `查看报告` to inspect the centered report modal.
2. If committing this slice, include `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx` plus the already-intended ongoing CBE files; do not accidentally stage unrelated local runtime artifacts.
## Current Turn — 2026-06-18 Personal Center Navigation Highlight Refinements

### Task Introduction

User asked for three UI fixes:

1. From the personal center page, clicking `获客结果`, `背调结果`, `记忆整理`, `高可信客户`, plus `待处理事项` entries such as `高可信客户`, should still navigate but also highlight the corresponding target content with a blue flashing frame.
2. The blue highlight must no longer stop after three seconds. It should keep showing until the user clicks inside the highlighted frame.
3. Replace list-row emoji `✅` with a cleaner green check icon, and remove the top `获客员工` source badge text from the report detail modal.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Main files expected:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- Existing local dashboard is available at `http://localhost:3000`.

### Task Flow

1. Inspect personal center card/link destinations and target-page query handling.
2. Add stable query parameters for highlight intent.
3. Change target page highlighters from timed flash to persistent-until-click blue frames.
4. Swap emoji completion marker for a lucide/check icon-based badge.
5. Remove source badge text from report detail modal header.
6. Run TypeScript, static regression, diff whitespace, and browser/API smokes.

### Progress So Far

- Product Design and Next.js instructions were loaded for this UI/App Router task.
- Updated personal center navigation in `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`:
  - `获客结果` links to customers with `highlight=lead-results`.
  - `背调结果` links to customers with `highlight=screening-results`.
  - `记忆整理` links to memory with `highlight=memory-results`.
  - `高可信客户` links to customers with `highlight=trusted`.
  - pending customer rows link with `highlight=pending&highlightCustomer=<id>`.
  - high-trust customer rows link with `highlight=trusted&highlightCustomer=<id>`.
- Updated customers page:
  - added URL-param highlight handling for task, scope, and specific customer id.
  - blue outline no longer auto-clears after 3 seconds; it clears when the user clicks inside the highlighted row/card.
  - completion badge uses a lucide `CheckCircle2` icon and `已完成`, not emoji `✅`.
  - report detail modal header no longer renders the source badge, so `获客员工` is removed from the top of the report window.
- Updated memory page:
  - wrapped page content in `Suspense` for `useSearchParams`.
  - added `highlight=memory-results` handling.
  - blue outline clears when clicking inside highlighted memory row/card.
- Updated `scripts/test-cross-border-agents.ts` static assertion so it rejects emoji/new-found badges and checks click-clear highlight behavior.

### Current State

- This subtask is implemented and verified.
- Checks passed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: `353 passed, 0 failed`
  - `git diff --check`
  - HTTP smoke for employee home, customer highlight URL, and memory highlight URL: all HTTP 200
- Browser verification through system Chrome:
  - from personal center, clicked `高可信客户`;
  - customer page opened with highlight URL;
  - highlighted desktop customer row count before click: 1;
  - highlighted row count after clicking inside the row: 0;
  - opened report modal and confirmed header did not contain `获客员工`;
  - confirmed rendered page had no `✅` text.
- Memory page highlight URL loaded; current DB has no memory rows, so no memory row could be visually highlighted in this run.

### Next Steps

1. User can refresh `http://localhost:3000/client-demos/cross-border/employee` and test the personal center links.
2. If memory records are added later, click `记忆整理` from personal center to confirm the same persistent blue-row highlight appears there.

## Current Turn — 2026-06-19 Evidence-Insufficient Customer Supplement Chat Flow

### Task Introduction

User asked for a complete loop when a customer has `证据不足`: manually entered companies as well as Accio/chat-handoff companies should show `补充聊天记录`, jump to Memory, allow uploading a JSON chat file, create a fresh `未分析` memory record, then let the operator re-run memory analysis and send the result back to screening.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard dev server: `http://localhost:3000`
- Dev command used: `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm --dir sentura/dashboard dev --port 3000`
- Main edited files:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `scripts/test-cross-border-agents.ts`

### Task Flow

1. Broaden customer-list evidence-insufficient logic from Accio-only to both `manual_screening` and `accio_handoff`.
2. Route `补充聊天记录` clicks to Memory with `supplementCustomer`, `supplementCompany`, and `supplementSource`.
3. Add Memory supplement sheet mode with company/source context, JSON upload, and a submit-only path that creates an import without starting analysis.
4. Keep the newly created supplement import in `未分析`, highlight it, and let the existing `开始分析` and `发送到背调` actions handle the next steps.
5. Repair a missing/stale `admin.ts` store file that was blocking TypeScript and Next runtime compilation.
6. Run static, type, HTTP, and browser/API verification.

### Progress So Far

- Customer list now uses `needsChatRecordSupplement(item)`:
  - `item.source === "manual_screening"` and `screeningStatus === "insufficient_evidence"` now show `补充聊天记录`.
  - `item.source === "accio_handoff"` still shows `补充聊天记录`.
  - selected/batch screening excludes both categories until chat records are supplemented and re-analyzed.
- Memory page now supports `mode === "supplement"`:
  - auto-opens from the query params.
  - pre-fills `补充聊天记录 - <company>`.
  - shows source label such as `手动录入`.
  - has a `提交补充记录` primary action.
  - uses the existing JSON import path but does not pass a session key, so the saved record remains `queued/uploaded` and displays as `未分析`.
- Static test coverage added/updated:
  - manual and Accio insufficient-evidence rows route back to Memory supplement.
  - Memory supplement flow imports JSON as a not-started record.
  - AppShell static assertion updated to match the current dynamic Sentura system title.
- `sentura/dashboard/src/lib/cross-border-store/admin.ts` was restored and expanded because the working tree had a deleted/stale version that made `./admin` exports unavailable:
  - added cost limit/list/approval functions.
  - added operator profile upsert/update and operator customer/high-value customer helpers.
  - added `checkCbeCostBudgetBeforeRun`, used by lead, screening, and Accio memory run creation.

### Current State

- Verification passed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: `368 passed, 0 failed`
  - `curl -I http://localhost:3000/client-demos/cross-border/employee/customers`: HTTP 200
  - `curl -I http://localhost:3000/client-demos/cross-border/employee/memory`: HTTP 200
  - `curl 'http://localhost:3000/api/client-demos/cross-border/employee/tasks?limit=1'`: HTTP 200 JSON
- Browser verification:
  - On `/employee/customers`, the evidence-insufficient manual row `Andes Repair Supply` displayed `补充聊天记录`, not `开始调研`.
  - Clicking that button navigated to `/employee/memory?supplementCustomer=...&supplementCompany=Andes+Repair+Supply&supplementSource=manual_screening`.
  - Memory opened the centered/right sheet supplement UI with title `补充聊天记录`, context `来源：手动录入`, prefilled record name, and disabled `提交补充记录` before a file is selected.
- API verification for the submit path:
  - Posted `跨境电商/fixtures/accio-chat-records.sample.json` through `/api/client-demos/cross-border/employee/memory/imports` with no `session_key`.
  - Response created `agentRun.status = "queued"`, `currentStage = "uploaded"`, and an `accioImport`.
  - Memory API listed the created import rows as `agentRunStatus: "queued"`, `summaryId: null`, visible in UI as `未分析` with `开始分析`.
  - The temporary verification import `accio_import_96a47c8c-e1f3-465f-be0c-6d7c62f4c55d` was deleted afterward; follow-up API check returned `remaining: 0`.

### Next Steps

1. User can manually test the full UI file-picker path:
   - open `/client-demos/cross-border/employee/customers`;
   - click `补充聊天记录` on a `证据不足` manual or Accio-handoff company;
   - select a JSON chat file;
   - click `提交补充记录`;
   - confirm a `未分析` row appears in Memory, then click `开始分析`.
2. If the supplement JSON contains multiple conversations, Memory will show one row per conversation company. If the desired product behavior is one supplement row named only after the original customer regardless of conversation contents, adjust `listEmployeeMemoryRecords` projection or store supplement target metadata.
3. Keep the dev server running only if the user wants to test at `http://localhost:3000`; otherwise stop it with Ctrl-C in the server session.

## Current Turn — 2026-06-19 Customer Deduplication, Delete Consistency, And Memory Supplement Merge

### Task Introduction

User reported three CBE employee workflow bugs:

1. `获客与背调` shows many `城市未确认` labels, which should be removed.
2. Deleted customer records still have bugs; after screening a chat-record handoff company, a duplicate row can appear as `手动录入`.
3. Supplementing chat records currently creates a new company/customer record; it should supplement the existing company, update its prior conversation list and analysis report, then allow re-analysis/re-screening without duplicating the customer.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Main areas to inspect first:
  - `sentura/dashboard/src/lib/cross-border-store/customers.ts`
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `sentura/dashboard/src/lib/cross-border-store/screening.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- Local dashboard normally runs at `http://localhost:3000`.

### Task Flow

1. Inspect customer projection and UI source/subtitle rendering to remove `城市未确认`.
2. Trace delete endpoints and projection joins to find why deleted rows or duplicate source rows remain.
3. Trace screening completion for Accio/chat handoffs to prevent creation/projection of a duplicate `manual_screening` row.
4. Extend memory supplement imports so they can attach to an existing customer/import instead of creating an unrelated company record.
5. Update static tests and run TypeScript/API/browser checks.

### Progress So Far

- New turn scoped; no code changes for this turn yet.

### Current State

- Worktree is already dirty with multiple CBE changes from previous turns; do not revert unrelated files.
- Previous turn left the dev server running at `http://localhost:3000`, but it should be rechecked before browser verification.

### Next Steps

1. Read the projection/delete/import code paths listed above.
2. Patch server-side data model first, then UI display.
3. Verify deletion and supplement merge with API probes before browser testing.

## Current Turn — 2026-06-19 CBE Manager/Employee Full Connection Audit

### Task Introduction

User asked for a comprehensive truth check of the cross-border ecommerce manager system and employee operation system: whether data is live and accurate between the two versions, whether all functions are actually connected, whether manager-side controls affect employee-side behavior, and whether bugs remain.

Hard constraints:

- Verify real DB/API/runtime behavior, not only static UI appearance.
- Keep manager title as `跨境电商管理者系统` and employee title as `跨境电商员工操作系统` with the same logo/style.
- Manager system scope remains only `员工管理`, `高分客户`, and `成本监控`.
- Preserve context because this is a multi-file, multi-API, multi-runtime audit.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch: `wst1.0-ecommerce`
- Local DB used for live checks: `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`
- Dashboard app: `sentura/dashboard`
- Main implementation areas:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/**`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/**`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/employee/**`
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`
  - `sentura/lib/cross-border-store/migrations/003_manager_cost_controls.sql`

### Task Flow

1. Confirm current worktree and handoff status.
2. Run static, store, agent, DB-backed, and production-build checks.
3. Start/restart a current production server on a non-conflicting port and run browser/API smoke checks.
4. Prove manager/employee control links with live API tests: role isolation, suspend/restore, cost limit update, over-limit approval, approval retry, and full report retrieval.
5. Record confirmed bugs, fixes, caveats, and remaining risks.

### Progress So Far

- Loaded the local browser verification skill and confirmed this audit should include browser checks after server start.
- Confirmed the worktree is already dirty with many cross-border ecommerce changes; do not revert unrelated user or previous-turn changes.
- Found one real isolation bug in `sentura/dashboard/src/components/app-shell.tsx` before this handoff update: admin/auth routes were still polling employee tasks in a hidden effect. Patched the effect to skip employee task polling on admin/auth routes.
- Found and fixed a production-build blocker in `sentura/dashboard/src/lib/cross-border-store/accio.ts`: `AccioImportRow` used `supplement_target_json` but the type and several SQL projections did not return it. The corrected queries now project `agent_runs.metadata_json->'supplement_target'` where appropriate.
- Found and fixed a second TypeScript blocker in the same Accio supplement path: `input.supplement_target` was not narrowed inside the async transaction callback. The code now captures `supplementInputTarget` before the callback.
- Static checks after that patch passed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: `164 passed, 0 failed`
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: `368 passed, 0 failed`
- DB-backed checks passed:
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: `184 passed, 0 failed`
- Production build passed after the Accio fixes:
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm --dir sentura/dashboard build`
- A concurrent `tsc` run briefly failed with `.next/types/validator.ts` missing `./routes.js` while `next build` was generating `.next/types`; rerunning `pnpm --dir sentura/dashboard exec tsc --noEmit` after build completed passed.

### Current State

- Need to restart the current production server on port 3001 before browser/API smoke so it uses the latest build and Accio/AppShell fixes.
- 3000 may be an older dev server and should not be used as the source of truth for this audit unless explicitly restarted.

### Next Steps

1. Restart `pnpm --dir sentura/dashboard start --hostname 127.0.0.1 --port 3001` with the same DB env.
2. Browser-check the three manager routes and three employee routes for content, title, navigation, and console/overlay errors.
3. Run API scripts for manager-only access, operator access denial, suspend/restore, cost limit mutation, approval creation/approval/retry, and high-value full report payload.

## Current Turn Update — 2026-06-19 Customer Delete And Memory Supplement Fix Complete

### Task Introduction

The latest user request was to remove `城市未确认` labels from `获客与背调`, thoroughly fix deletion/duplicate-row bugs, stop chat-record handoff screening from creating a duplicate `手动录入` row, and make `补充聊天记录` update the existing company/customer rather than creating a new customer record.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Primary touched files:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/employee/customers/route.ts`
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `sentura/dashboard/src/lib/cross-border-store/customers.ts`
  - `sentura/dashboard/src/lib/cross-border-store/screening.ts`
  - `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
  - `scripts/test-cross-border-agents.ts`

### Task Flow

1. Removed the unknown-city fallback from customer row subtitle rendering.
2. Added DB-backed customer deletion via `DELETE /api/client-demos/cross-border/employee/customers`, with cascading cleanup across lead candidates, screening targets/reports/evidence/score blocks, Accio summaries, handoffs, memory facts, conversations, messages, and empty imports.
3. Fixed screening target source mapping so `accio_handoff` rows are sent as `accio_memory`, and saved screening reports attach back to the Accio summary/customer row instead of projecting an extra manual row.
4. Extended memory supplement imports with `supplement_target` metadata and UI/API propagation.
5. Reworked Accio supplement storage so existing supplement records are reused when possible; the old analysis and linked screening report are cleared before re-analysis, new chat messages are appended under the same import, and re-analysis reuses the old summary id when available.
6. Added regression checks for original-customer binding, summary-id reuse, DB-backed customer deletion, and absence of `城市未确认`.

### Progress So Far

- `customers/page.tsx` no longer renders `城市未确认`.
- `customers/page.tsx` now blocks `开始调研` for insufficient-evidence manual/Accio rows and routes them to `补充聊天记录`.
- `memory/page.tsx` passes supplement customer id/company/source through import, existing-record analysis, and send-to-screening navigation.
- `accio.ts` now returns `supplementTarget` on memory records, reuses existing imports/summaries for supplement mode, refuses to silently create a duplicate Accio handoff customer if the original summary cannot be found, and saves only one supplement summary for the target customer.
- `customers.ts` hides Accio-only screening target projections and merges Accio screening reports back into the handoff row.
- `screening.ts` reuses an existing manual screening target when re-screening a manual record.
- `scripts/test-cross-border-agents.ts` now reports `371 passed, 0 failed`.

### Current State

- Static verification passed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: `371 passed, 0 failed`
  - `git diff --check`
- DB-backed store verification passed:
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: `184 passed, 0 failed`
- No browser/manual DB smoke was run in this turn after the final patch.
- Worktree remains dirty with many pre-existing CBE/admin/session changes; do not revert unrelated files.

### Next Steps

1. If continuing, run a browser smoke against the live dashboard:
   - open `/client-demos/cross-border/employee/customers`;
   - confirm no `城市未确认` appears;
   - create or use an insufficient-evidence manual/Accio row;
   - click `补充聊天记录`, upload JSON, verify the memory row is bound to the original customer and returns to `未分析`;
   - analyze it and send to screening; confirm the same customer row is highlighted and no duplicate `手动录入` row appears.
2. If DB-level certainty is needed, run the same flow against `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev'` and inspect affected `accio_imports`, `accio_summaries`, `screening_targets`, and `screening_reports` rows before/after supplement.

## Current Turn — 2026-06-19 Keep Customer Visible During Chat Supplement

### Task Introduction

User reported that after clicking `补充聊天记录`, the original company disappeared from `获客与背调`. This contradicts the intended business logic: supplementing chat records should keep the existing customer/company visible, bind the new chat JSON to it, mark analysis/backscreening as pending or stale, then allow re-analysis and re-screening without creating a duplicate customer.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Main files to inspect:
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `sentura/dashboard/src/lib/cross-border-store/customers.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `scripts/test-cross-border-agents.ts`

### Task Flow

1. Confirm whether supplement import currently deletes the `accio_summaries` row before re-analysis.
2. If yes, fix the projection/storage so `获客与背调` keeps showing the original company while the memory record is waiting for analysis.
3. Add regression coverage for “supplement should not hide the customer row”.
4. Run TypeScript and focused CBE tests.

### Progress So Far

- Scope identified from user report; no fix applied yet.

### Current State

- Worktree is already dirty with many CBE changes. Do not revert unrelated files.
- Likely root cause to verify: customer projection for Accio handoffs is driven by `accio_summaries`, while supplement upload may delete the summary immediately to force `记忆整理` back to `未分析`.

### Next Steps

1. Inspect the supplement merge path in `accio.ts`.
2. Patch only the relevant persistence/projection behavior.
3. Re-run `pnpm --dir sentura/dashboard exec tsc --noEmit`, `pnpm exec tsx scripts/test-cross-border-agents.ts`, and `git diff --check`.

## Current Turn Final — 2026-06-19 CBE Manager/Employee Full Connection Audit Complete

### Task Introduction

User asked for the most comprehensive check possible of whether the CBE manager system and employee operation system are live-connected, accurate, controllable, and bug-free enough to trust.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch: `wst1.0-ecommerce`
- Runtime checked: Next production build served at `http://127.0.0.1:3001`
- Live DB checked: `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`
- Actual tenant id discovered during audit: `cross-border-ecommerce`
- Seeded manager used by 3001 fallback: `cbe-user-admin-001`
- Employee API/browser checks used header: `x-cbe-user-id: cbe-user-operator-001` or `cbe-user-operator-002`

### Task Flow

1. Ran static, live DB, production build, browser, API, and direct Postgres checks.
2. Fixed issues found during the audit instead of only reporting them.
3. Restarted 3001 after rebuilds and verified the current build, not stale dev server output.
4. Tested real manager controls against employee APIs and cleaned up all audit data.

### Progress So Far

Confirmed fixes made during this audit:

- `sentura/dashboard/src/components/app-shell.tsx`: admin/auth routes no longer hidden-poll employee task APIs. Browser proof: manager routes made 0 `/employee/tasks` requests; employee routes made 0 admin API requests.
- `sentura/dashboard/src/lib/cross-border-store/accio.ts`: fixed `supplement_target_json` row typing and SQL projections; fixed async narrowing of `supplement_target`.
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`: added stable customer subtitle formatting and removed the visible `城市未确认` leak from the employee customer table.

Checks passed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: `164 passed, 0 failed`
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: `368 passed, 0 failed`
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: `184 passed, 0 failed`
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm --dir sentura/dashboard build`
- `git diff --check`

Browser verification on latest 3001 build:

- Manager pages loaded with `跨境电商管理者系统`, no Next overlay, no console errors:
  - `/client-demos/cross-border/admin/employees`
  - `/client-demos/cross-border/admin/high-value-customers`
  - `/client-demos/cross-border/admin/costs`
- Employee pages loaded with `跨境电商员工操作系统`, no Next overlay, no console errors:
  - `/client-demos/cross-border/employee`
  - `/client-demos/cross-border/employee/customers`
  - `/client-demos/cross-border/employee/memory`
- `城市未确认` was absent from all six checked pages.
- Manager high-value page and employee customer page both opened full screening report dialogs with score, evidence, coverage gap, and recommended-action signals.

Live API/control verification:

- Operator trying to read manager API got `403 cbe_admin_required`.
- Admin read operator list successfully and saw 2 operators.
- Admin suspended `cbe-user-operator-002`; that operator's employee API then returned `401 cbe_profile_missing`.
- Admin restored operator status; employee API worked again.
- Admin set operator day limit to 0; cost monitor reflected base limit 0 in `range=today`.
- Employee over-limit lead task returned `402 cost_approval_required`.
- The over-limit task created 0 `agent_runs`.
- DB contained the expected pending `cbe_cost_approval_requests` row.
- Admin approval created an active temporary `cbe_cost_allowances` row.
- Employee retry after approval returned `201` and created a real queued/running lead task.
- High-value API returned full report payload, e.g. Currys with owner `cbe-user-operator-001`, score 84, and 10 evidence rows.
- Cleanup check passed: no audit agent runs, no audit approvals, no active test allowances, no temporary day limit remained; operator-002 ended active.

Current monthly cost monitor after cleanup:

- Pool: `spendUsd=0.27`, `actualCostUsd=0`, `estimatedCostUsd=0.27`, `baseLimitUsd=240`, `remainingUsd=239.73`, `activeAllowanceUsd=0`.
- Operator-002: `base_limit_usd=120`, `active_allowance_usd=0`, `remaining_usd=120`, `pending_approval_count=0`.

### Current State

- Manager and employee systems are genuinely connected through the same CBE DB/API layer in the checked local environment.
- Manager controls for suspend/restore, cost limit mutation, approval generation, approval decision, and employee retry are runtime-proven.
- High-value customers are aggregated from employee screening results and include full report JSON.
- Cost monitor is live DB-backed and distinguishes actual, estimated, and unpriced signals; current local data has estimated spend only (`actualCostUsd=0`, `estimatedCostUsd=0.27`).
- 3001 is currently running the latest checked production build with:
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev'`
  - `CBE_DEMO_USER_ID='cbe-user-admin-001'`

Known caveat:

- Manager-side employee creation through live RBAC `sentura.rbac.users.upsert` was not exercised end-to-end in this audit because it would create a persistent platform user/token and there is no clear cleanup endpoint in this flow. Static route coverage says it is wired; runtime creation should be tested with a disposable account before calling it fully production-proven.

### Next Steps

1. If continuing from here, first inspect this final section and the latest git diff.
2. If proving account creation is required, create a disposable operator through `/api/client-demos/cross-border/admin/operators`, record the returned one-time token, then define or add a cleanup path for the platform RBAC user.
3. For production readiness, decide whether manager employee/high-value pages need auto-polling like the costs page; they are DB-backed but not all pages auto-refresh on an interval.

## Current Turn Final — 2026-06-19 CBE Memory Supplement Visibility Recheck Complete

### Task Introduction

User reported that after choosing `补充聊天记录`, the company disappeared from `获客与背调`, and asked whether the current implementation fully matches the intended business logic:

- the original company must not be deleted or hidden from `获客与背调`;
- the supplement JSON must bind to the existing company/customer record;
- `记忆整理` must show the supplemented record as needing re-analysis;
- after re-analysis, the same customer should be able to re-enter Screening without duplicate manual/input rows.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Main files checked/changed in this flow:
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `sentura/dashboard/src/lib/cross-border-store/customers.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `scripts/test-cross-border-agents.ts`
- Live DB used for verification: `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`

### Task Flow

1. Rechecked the Accio supplement storage path, manual supplement path, and customer projection path.
2. Confirmed the original bug: supplement upload previously deleted the `accio_summaries` row, while `获客与背调` projects chat-handoff customers from `accio_summaries`; this made the company disappear.
3. Kept the original summary/customer visible during supplement upload and supplement analysis.
4. Made pending supplement records use the original `importId` for re-analysis so `开始分析` can fetch the stored chat payload.
5. On successful re-analysis, reused the original `accio_summary` id for Accio handoffs and cleared the old insufficient-evidence screening report so the same customer becomes re-runnable.
6. Found and fixed an additional SQL three-valued-logic bug where manual `screening_target` rows with no latest report were filtered out because `sr.report_json` was null.
7. Ran static tests, live DB tests, and targeted live DB probes for both Accio handoff and manual-input supplement flows.

### Progress So Far

Confirmed implementation details:

- `saveAccioImport()` supplement mode now merges into the existing Accio import/summary path instead of creating a new company row.
- Supplement upload no longer deletes the original `accio_summaries` row.
- While waiting for re-analysis, the original company remains visible in `获客与背调` with its existing `insufficient_evidence` state.
- `memoryFromApi()` treats a supplemented summary with `queued`/`running`/`polling`/`failed` agent status as pending refresh and uses `record.importId` as `recordId`.
- `saveAccioSummaries()` reuses the existing summary id through `on conflict (id) do update`.
- After re-analysis, old Screening reports linked to that Accio summary are deleted, so the same customer returns to `not_started` and can be sent to Screening again.
- For manual-input supplements, `saveAccioSummaries()` clears old Screening reports linked to the manual `screening_target` but keeps the target row, so it returns to `not_started`.
- `listEmployeeCustomers()` now wraps the Accio-screening-target exclusion in `coalesce(..., false)` so manual targets are not filtered out when their latest report has been cleared.
- Manual and Accio insufficient-evidence rows both route to `补充聊天记录`.

Verification completed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, `378 passed, 0 failed`.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, `184 passed, 0 failed`.
- `git diff --check`: PASS.
- Targeted live DB probe for Accio handoff supplement flow: PASS with states:
  - before supplement: `insufficient_evidence`;
  - after supplement upload: `insufficient_evidence`;
  - during supplement analysis: `insufficient_evidence`;
  - pending memory row: `queued`;
  - running memory row: `running`;
  - after re-analysis: `not_started`;
  - same import reused: `true`;
  - same summary reused: `true`.
- Targeted live DB probe for manual-input supplement flow: PASS with states:
  - before supplement: `insufficient_evidence`;
  - after supplement upload: `insufficient_evidence`;
  - during supplement analysis: `insufficient_evidence`;
  - pending memory row: `queued`;
  - after re-analysis: `not_started`;
  - same import reused: `true`;
  - manual target preserved: `true`.
- Probe cleanup check: `Supplement Probe Nordic%`, `Manual Supplement Probe%`, and `Manual Debug%` rows are 0 in `accio_conversations`, `accio_summaries`, `screening_targets`, and `agent_runs`.

### Current State

- The implemented business logic now matches the intended flow in the local code and live DB probes.
- The user-observed disappearance was real under the previous logic; the Accio case was caused by deleting `accio_summaries` too early, and the manual case could disappear after re-analysis due to a NULL-sensitive customer-list SQL filter.
- Current expected behavior:
  - clicking `补充聊天记录` does not remove the company from `获客与背调`;
  - the company stays visible while memory supplement is waiting/running;
  - after memory re-analysis, the same customer row is updated and becomes ready to re-run Screening;
  - the flow does not create a duplicate `手动录入` company row.

### Next Steps

1. If the user still sees disappearance in the browser, verify the browser is running the latest built/dev server code and not stale Next output.
2. Reproduce through UI with an existing insufficient-evidence company:
   - click `补充聊天记录`;
   - upload JSON in `记忆整理`;
   - confirm the original company remains in `获客与背调`;
   - click `开始分析` in Memory;
   - after analysis, click `发送到背调` or return to `获客与背调` and confirm the same row is `not_started`.
3. If needed, add a permanent scripted regression test for this targeted DB flow instead of keeping it as an ad hoc probe.

## Current Turn — 2026-06-19 CBE Manager Polish, High-Value Rule, Cost UI, And Employee Login

### Task Introduction

User provided two screenshots and requested six concrete adjustments:

1. In manager `员工管理`, clicking an employee must open a centered rectangular detail window/page whose full `获客与背调` list matches the employee-side customer table exactly; `查看报告` must also match the employee-side report UI.
2. `高分客户` must only include `>=80` and high/priority-follow-up customers. Current page incorrectly includes lower-scored customers such as 58.67 and 63.33 after scoring-rule changes.
3. Cost-limit inputs need `$` unit labels and the cost-monitor limit settings should shift left and align cleanly.
4. Create-employee form must not auto-fill monthly limit `120`; it should show only a monthly-limit label/placeholder.
5. Create-employee account field must change from email to password set by the manager.
6. Employee operation platform needs a login page; remove right-top employee personal center and message center, and allow employee login with employee name plus manager-set password.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current likely server: local Next app on ports 3000/3001; must verify before browser checks.
- Visual references:
  - `/var/folders/9q/vtk4m50x0_1cp2cjpjdtz20h0000gn/T/TemporaryItems/NSIRD_screencaptureui_tn5w7Y/截屏2026-06-19 01.44.27.png`
  - `/var/folders/9q/vtk4m50x0_1cp2cjpjdtz20h0000gn/T/TemporaryItems/NSIRD_screencaptureui_mo0n4A/截屏2026-06-19 01.48.02.png`
- Product Design saved context preflight returned no saved context; screenshots plus existing employee-side code are the source of truth.

### Task Flow

1. Inspect employee customer table/report implementation and manager admin pages/API.
2. Reuse or extract employee-side customer list/report components for manager detail instead of recreating a divergent table.
3. Fix high-value rule in store/API to require score >= 80 and high/priority semantics.
4. Patch cost-monitor UI alignment/unit labels and create-employee modal defaults/fields.
5. Add employee name/password login path and connect manager-set password to CBE profile/auth session.
6. Remove employee top-right personal center/message center UI once employee login exists.
7. Run TypeScript, existing static/live tests, build, and browser smoke.

### Progress So Far

- Loaded Product Design context/get-context guidance and Next.js/React guidance.
- Product Design user-context preflight found no saved context.
- Memory quick pass found Sentura CBE runtime/cost-truthfulness notes; keep real data/cost truth separate from estimates.
- Added `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`, copying the employee-side customer table/report interaction and adapting it to `AdminCustomerRow`.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`:
  - employee detail now opens in a centered rectangular `Dialog`, not a right-side `Sheet`;
  - detail customer list now uses the employee-side table/report visual treatment;
  - create-employee form uses manager-set password instead of email;
  - monthly limit defaults to blank placeholder instead of `120`;
  - creation success message now instructs name/password login rather than showing a one-time token.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`:
  - added client-side score `>=80` defensive filtering;
  - changed rule copy to `评分 >= 80 / 高分 / 优先跟进`;
  - uses the employee-style report dialog button.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`:
  - limit-setting column is fixed-width and left-aligned;
  - limit and approval amount inputs show `$` unit suffixes.

### Current State

- Worktree is already dirty from prior CBE implementation turns. Do not revert unrelated files.
- This turn's requested implementation is complete and verified against current local code.
- A fresh dev server is running at `http://localhost:3002` with:
  - `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`
  - `CBE_DEMO_USER_ID=cbe-user-admin-001`
- Important browser note: use `localhost:3002`, not `127.0.0.1:3002`, because Next dev blocks cross-origin HMR/dev resources from `127.0.0.1` and hydration may not run there.
- Port `3001` is an older/stale server for this code path and still showed old high-value behavior during verification. Use `3002`.
- Previous `3000` dev server was stopped because Next refused another dev server for the same dashboard directory while it was running.

### Next Steps

1. Keep using `http://localhost:3002` for manual review.
2. If testing real manager-created accounts from the UI, ensure the RBAC gateway is available because `POST /api/client-demos/cross-border/admin/operators` still calls `sentura.rbac.users.upsert`.
3. Existing seeded employees do not have passwords unless the manager creates/resets them; newly created employees store `password_hash` and can log in by display name/password.

### Final Verification For This Turn

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, `165 passed, 0 failed`.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, `185 passed, 0 failed`.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, `378 passed, 0 failed`.
- `git diff --check`: PASS.
- Direct login route DB probe: PASS. Temporary employee with `password_hash` logged in with name/password, received session cookie and operator redirect; wrong password returned `401`; probe records cleaned.
- Browser smoke on `http://localhost:3002`: PASS.
  - High-value page shows new rule text and no `<80` score rows.
  - Cost page hydrates and shows cost table with limit inputs and `$` suffixes.
  - Employee management create form password field exists and monthly limit defaults blank.
  - Lin Yue detail dialog opens centered and shows employee-style customer table headers.
  - Lin Yue detail rows with reports show `查看报告`; report dialog contains employee-style `背调结论` and `客户概览`.
  - Employee unauthenticated access redirects to login; temporary employee can log in by name/password; header shows employee name plus `退出` and no message center.

### Update — Admin Report Panel And Cost Source Patch Started

- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`:
  - Manager detail `查看报告` now uses an embedded `presentation="panel"` report surface instead of a nested full-screen fixed overlay.
  - The report panel replaces the `获客与背调` list panel in-place and closes back to the list via `X`, `Escape`, or outside click.
  - Removed the unused Manager checkbox selection column from the customer table.
- Patched `sentura/dashboard/src/lib/cross-border-store/admin.ts`:
  - Added server-side `sentura.cost.events` retrieval through `getServerGatewayClient()`.
  - Added session-key reconciliation from `agent_runs.session_key` to sentura-cost events.
  - Manager employee rows, cost monitor rows, and operator detail cost events now prefer sentura-cost events and fall back to DB estimates only if gateway cost events are unavailable.
- Next verification: run `pnpm --dir sentura/dashboard exec tsc --noEmit`, then API/browser-check Lin Yue month cost against Employee-side `US$3.76`.

### Update — Report Panel Height Correction

- Browser measurement found the first embedded Manager report panel still had `min-h-[720px]`, causing the inner report surface to extend below a 720px viewport.
- Changed Manager report panel sizing to `h-[min(68vh,620px)] max-h-[calc(88vh-7rem)]` so the report surface remains fully visible and scrolls internally.
- Need rerun browser measurement after HMR/reload.

## Current Turn - 2026-06-19 Personal Center Filter Persistence

### Task Introduction

The user asked that the personal center segmented case filters `今日 / 本周 / 本月 / 全部` should not reset to `本月` after switching pages. They also asked to inspect similar button groups that unexpectedly change during navigation.

### Workspace And Environment

- Repository: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Frontend: `/Users/purest./Documents/Sentura/Sentura-Platform/sentura/dashboard`
- Framework: Next.js App Router, client-side React pages under `src/app/client-demos/cross-border`
- Relevant files identified:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`

### Task Flow

- Root cause found: these pages use local `useState` defaults such as `"month"`, so route changes unmount/remount the component and restore the default value.
- Chosen fix: add a small client-only persistent UI state hook backed by `localStorage`, then apply it to segmented/filter button state that should survive navigation.
- Keep the change scoped to navigation-persistent button/filter state, avoiding unrelated data or server behavior.

### Progress So Far

- Memory quick pass confirmed this is the existing Sentura cross-border workspace.
- Initial search found reset-prone state in employee personal center, employee customers, employee memory, admin employee statistics, admin cost monitor, and the admin customer table component.
- No code edits for this current request have been applied yet.

### Current State

- Worktree is already dirty from previous Sentura CBE work. Do not revert unrelated changes.
- Need inspect exact state types and component props before patching.

### Next Steps

1. Read the relevant state declarations and filter button implementations in the files above.
2. Add `usePersistentUiState` under `sentura/dashboard/src/lib/`.
3. Replace reset-prone button/filter `useState` calls with the hook and lightweight validators.
4. Update static tests if the CBE test script checks these UI files.
5. Run `pnpm --dir sentura/dashboard exec tsc --noEmit`, `pnpm exec tsx scripts/test-cross-border-agents.ts`, and `git diff --check`.

### Update — Outside Click Close No Longer Click-Throughs

- Browser close test found document `mousedown` outside-close could reveal the underlying customer list before the same click completed, accidentally opening another row.
- Changed embedded Manager report outside-close listener to capture-phase `click` with `preventDefault()`/`stopPropagation()` before `onClose()`.
- Need rerun browser close test to confirm outside click returns to the list without opening another customer.

### Update — Verification Complete

- API verification against `http://localhost:3002`:
  - `GET /api/client-demos/cross-border/admin/operators` returned Lin Yue `month_cost_usd = 3.759479`.
  - `GET /api/client-demos/cross-border/admin/costs?range=month` returned Lin Yue `spend_usd = 3.7594790000000007` and pool `spendUsd = 3.7594790000000007`.
  - `GET /api/client-demos/cross-border/admin/operators/cbe-user-operator-001` returned 202 sentura-cost detail rows with sum `3.76`.
- Browser verification against `http://localhost:3002`:
  - Employees page shows total cost `US$3.76`; Lin Yue row shows `US$3.76` and remaining monthly budget `US$116.24`.
  - Lin Yue detail customer table has no checkbox column (`checkboxCount = 0`).
  - Embedded report panel for Currys is not clipped at 1280x720: inner panel top `77.7`, bottom `567.3`, viewport height `720`.
  - `X` close returns to the customer list; outside click returns to the customer list without click-through opening another customer.
  - Costs page shows Lin Yue row with `US$3.76`; total cost pool shows `US$3.76`.
- Added detail UI truth fix: unpriced sentura-cost events now display `未折算` instead of `US$0.00` in Manager cost details.
- Automated checks after patches:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 165/0.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 379/0.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 185/0.

### Update — Budget Enforcement Cost Source Also Reconciled

- Found `checkCbeCostBudgetBeforeRun()` still calculated current spend from DB `agent_runs/api_call_ledger`, which could make over-limit control disagree with Manager/Employee visible sentura-cost spend.
- Added `getSenturaCostSpendForUserPeriod()` and `periodToRange()` in `sentura/dashboard/src/lib/cross-border-store/admin.ts`.
- Budget preflight now computes current spend from `sentura.cost.events` filtered by the employee's real `agent_runs.session_key`; if sentura-cost is unavailable, it falls back to the old DB estimate path.
- Re-ran checks after this control-path fix:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 165/0.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 379/0.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 185/0.

## Current Turn — 2026-06-19 CBE Admin High-Value UI, Monthly Limits, Auto Approval Alerts

### Task Introduction

User requests five changes:

1. Manager `高分客户` list should remove `覆盖` and `推荐动作`; rename `最近背调` to `背调时间`; `查看报告` should reuse the Employee-side report UI adjusted to Manager size.
2. Employee Management `active` status badge should be green instead of gray.
3. Cost Monitor limits are monthly: the month base limit should apply to today/week/month views instead of today/week showing 0 base limit.
4. If current cost already exceeds a lowered limit, the system should promptly create a manager approval request; currently manual limit reduction did not create a pending over-limit approval.
5. Manager header needs a notification bell for cost-overrun approvals and newly found high-value customers.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Current dev server expected: `http://localhost:3002`
- Relevant files likely:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `sentura/dashboard/src/components/app-shell.tsx`

### Task Flow

1. Preserve handoff before edits.
2. Inspect current admin high-value, costs, app shell notification/header paths, and admin cost store logic.
3. Reuse the existing Employee-style Manager report component for high-value customer report viewing.
4. Change monthly-limit read/write semantics so day/week/month views use the month limit.
5. Add server-side auto approval request creation when a monthly limit is lowered below current spend.
6. Add Manager notification bell backed by pending approvals and recent high-value rows.
7. Re-run TypeScript, static scripts, DB checks, and browser/API smoke.

### Progress So Far

- Handoff section created.

### Current State

- Investigation starting.

### Next Steps

1. Read the files listed above and locate reusable report component boundaries.
2. Patch UI and admin cost store.
3. Verify with Lin Yue and a deliberately low monthly limit.

### Update — Personal Center Filter Persistence Complete

- Added `sentura/dashboard/src/lib/use-persistent-ui-state.ts`, a client-only localStorage hook with validation fallback.
- Patched navigation-persistent button/dropdown state:
  - Employee personal center `今日 / 本周 / 本月 / 全部` now persists via `HOME_RANGE_STORAGE_KEY`.
  - Employee `获客与背调` status, score sort, and filter-sheet selections now persist.
  - Employee `记忆整理` status and filter-sheet selections now persist.
  - Admin employee statistics range and cost monitor range now persist.
  - Admin customer-list status and score sort now persist.
- Left free-text search fields as page-local state, because those are transient searches rather than button/range preferences.
- Added static assertions in `scripts/test-cross-border-agents.ts` to prevent these controls from regressing to local `useState` resets.
- Verification:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 384/0.
  - `git diff --check`: PASS.
  - `curl -I http://localhost:3002/client-demos/cross-border/employee`: PASS, 200 OK.
  - `curl -I http://localhost:3002/client-demos/cross-border/admin/employees`: PASS, 200 OK.

### Update — 2026-06-19 Admin High-Value, Monthly Limits, Auto Approval Notifications Complete

- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`:
  - Removed `覆盖` and `推荐动作` columns.
  - Renamed `最近背调` to `背调时间`.
  - Empty/loading colSpans updated from 9 to 7.
  - High-value API/UI still filters by final normalized score `>= 80`.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`:
  - Manager report modal now uses the Employee-style report body at `w-[96vw] max-w-[1280px]`, with full viewport-height containment.
  - Browser smoke confirmed report dialog rect at 1440x900: top `24`, bottom `876`, width `1280`, height `852`; no top clipping.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`:
  - `active` badge now uses green `border-emerald-200 bg-emerald-50 text-emerald-700`.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`:
  - Limit setting always writes `period: "month"`; today/week/month/all tabs no longer create separate day/week/all-time base limits.
- Patched `sentura/dashboard/src/lib/cross-border-store/admin.ts`:
  - Cost monitor spend range still follows the selected tab, but base limit and active allowance lookup now always use the monthly limit.
  - Added `syncOverrunApprovalForUserPeriod()` and `syncMonthlyOverrunApprovalsForTenant()`.
  - `GET /api/client-demos/cross-border/admin/costs` now syncs monthly overrun approvals on refresh.
  - `PATCH /api/client-demos/cross-border/admin/cost-limits` now immediately syncs approval state after saving a monthly limit.
  - Automatic approval logic compares sentura-cost monthly spend first, DB estimate fallback second. If no pending request exists and monthly spend exceeds base limit + allowance, it creates one pending request. If a previous automatic monthly-overrun request is no longer needed, it is cancelled.
- Patched `sentura/dashboard/src/components/app-shell.tsx`:
  - Added Manager header notification bell.
  - Bell polls admin costs and high-value customer APIs every 15 seconds.
  - Pending cost approvals count directly in the badge.
  - High-value customer badge count is based on rows newer than local `sentura:cbe:admin:seen-high-value-at:v1`, so old high-value rows are not repeatedly counted as new.

Verification:

- API checks on `http://localhost:3002`:
  - `GET /api/client-demos/cross-border/admin/costs?range=month`: PASS.
  - Lin Yue current restored state: `spend_usd = 3.7594790000000007`, `base_limit_usd = 12`, `remaining_usd = 8.240521`, `pending_approval_count = 0`.
  - `GET /api/client-demos/cross-border/admin/costs?range=today`: PASS; Lin Yue uses same `base_limit_usd = 12` with today spend `1.118636`.
  - `GET /api/client-demos/cross-border/admin/costs?range=week`: PASS; Lin Yue uses same `base_limit_usd = 12` with week/month spend `3.7594790000000007`.
  - `GET /api/client-demos/cross-border/admin/high-value-customers?limit=100&range=all`: PASS; returned 3 rows, all score `>= 80` (`Currys 84`, `Argos 83.33`, `Cellairis 85`).
- Deliberate temporary overrun test:
  - Temporarily set Lin Yue monthly limit to `US$1.00` via `PATCH /api/client-demos/cross-border/admin/cost-limits`.
  - Next costs read created pending approval `cost_approval_33638ebc-c2c1-4cee-9b08-97ef9d81a67f` with requested allowance `2.759479`.
  - Restored Lin Yue monthly limit to `US$12.00`; next costs read showed pending approvals empty again.
- Browser smoke with installed Chrome channel:
  - High-value table headers: `客户`, `国家`, `产品`, `负责人`, `评分`, `背调时间`, `报告`.
  - No `覆盖` column; no `推荐动作` column.
  - Manager notification bell exists.
  - Active badge computed class contains green emerald styles.
  - Cost page text includes `Lin Yue`, `US$3.76`, and `US$12.00`.
- Automated checks:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 384/0.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 165/0.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 185/0.

Current state after verification:

- Lin Yue monthly cost remains synced to sentura-cost at `US$3.76`.
- Lin Yue monthly base limit was restored to `US$12.00` after the temporary overrun test.
- There are no pending automatic approvals in the restored state because `3.76 < 12.00`.
- If the manager lowers Lin Yue's monthly limit below `US$3.76`, the next save/refresh creates a pending cost approval automatically.

## Current Turn — 2026-06-19 Admin Cost Limits, Notifications, Report Window Cleanup

### Task Introduction

User reports five follow-up issues:

1. Add `（月限额）` note beside the cost limit setting.
2. Temporary allowance must also be editable in real time.
3. Pending over-limit approval section flashes every refresh; refresh should happen in the background without visible flicker.
4. Manager notification center should jump to the exact relevant place and use the same淡蓝色 flashing box behavior as Employee; clicking inside the flashing box should stop flashing.
5. Manager report view still looks broken; copy/reuse the Employee report window code exactly and adapt only sizing as needed.

### Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dev server: `http://localhost:3002`
- Must preserve dirty worktree and not revert unrelated files.
- Current relevant paths:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_data/admin-api.ts`
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `sentura/dashboard/src/components/app-shell.tsx`

### Task Flow

1. Inspect Employee report window implementation and Manager duplicate report implementation.
2. Refactor/copy so Manager report uses Employee report code path instead of divergent layout.
3. Update cost UI: annotate monthly limit, add editable temporary allowance, and avoid flicker by background refresh/skip identical state churn.
4. Add server API path for Manager temporary allowance updates if missing.
5. Upgrade Manager notifications to deep-link and blue flashing highlight behavior.
6. Verify with TypeScript, API checks, and browser smoke.

### Progress So Far

- Handoff section created before edits.
- Manager/Employee report modal is now shared:
  - Added `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx`.
  - This component directly reuses the Employee report window implementation and sizing:
    - overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-6`
    - dialog: `max-w-6xl`, `max-h-[calc(100vh-2rem)]`, scroll-contained content.
  - Employee customer page now imports and uses this shared component.
  - Manager employee-detail customer list and Manager high-value report buttons now open this same shared component instead of the divergent Manager report layout.
- Cost monitor UI updates:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
  - Header now shows `限额设置（月限额）`.
  - Each employee row now has editable `基础限额` and editable `临时额度`, both saved against the monthly period and displayed with `$`.
  - Refresh interval now runs as background refresh and preserves identical state to stop the pending approval area from flashing/loading every poll.
  - Deep-link query parameters support blue flashing highlight:
    - `?notify=approvals#pending-approvals`
    - `?highlightApproval=<approval_id>#pending-approvals`
  - Clicking inside a highlighted approval/card dismisses the flash.
- Temporary allowance backend:
  - Added schema `AdminCostAllowancePatchRequestSchema`.
  - Added store function `setAdminCostAllowance(...)` in `sentura/dashboard/src/lib/cross-border-store/admin.ts`.
  - Added route `sentura/dashboard/src/app/api/client-demos/cross-border/admin/cost-allowances/route.ts`.
  - Added client helper `updateAdminCostAllowance(...)`.
  - Current semantics: the Manager edits the current total active temporary allowance for that employee/month. Saving revokes prior active allowances for that user/period and inserts one replacement allowance if amount is greater than `0`.
- Manager notification center:
  - `sentura/dashboard/src/components/app-shell.tsx`
  - Cost approval notifications now link to the costs page and highlight the exact pending approval row when available.
  - New high-value customer notifications now link to the high-value page with `?highlightCustomer=<record_id>`.
- High-value customer page:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`
  - Supports `highlightCustomer` deep-link, scrolls to the row, flashes with the same light-blue highlight pattern, and stops flashing after clicking inside the row.
- Non-destructive live API probe:
  - Patched temporary allowance endpoint with Chen Wei `amount_usd: 0`; response succeeded and existing values stayed unchanged.
  - Current Lin Yue live state at verification time:
    - `base_limit_usd = 1`
    - `active_allowance_usd = 224.759479`
    - `spend_usd = 3.759479`
    - `remaining_usd = 222`
    - `pending_approval_count = 0`
  - Do not reset Lin Yue automatically; these values appear to reflect the user's recent manual limit/allowance experiments.
- Browser smoke:
  - Used installed Chrome after the in-app Browser wait hit a timeout; app/API remained healthy.
  - Costs page confirmed:
    - `限额设置（月限额)` visible.
    - limit + allowance inputs visible.
    - no foreground loading flicker after data load.
    - pending approval deep-link applied highlight class.
  - Report modal confirmed at 1280x720 viewport:
    - modal rectangle approx `1152 x 656`
    - class includes shared Employee `max-w-6xl` sizing.
- Tests/checks completed:
  - `git diff --check`: PASS.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 387 passed / 0 failed.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 165 passed / 0 failed.
  - `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 185 passed / 0 failed.

### Current State

- Requested implementation is complete and verified against TypeScript, static checks, live DB store checks, and browser smoke.
- Manager report windows now use the same report component as Employee, so future report UI fixes should be made in `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx`.
- Old local report helper code still exists in some page/component files but is no longer the active rendered path. It can be removed in a later cleanup if desired.
- The worktree remains very dirty from this and prior Sentura CBE work. Do not revert unrelated files.

### Next Steps

1. User should hard-refresh Manager pages on `http://localhost:3002` to ensure the latest dev bundle is loaded.
2. Manual UI spot-check still useful:
   - Open Manager > 成本监控 and edit Lin Yue `临时额度`.
   - Open Manager notification bell and click a cost/high-value notification.
   - Confirm the target card/row flashes light blue and stops flashing only after clicking inside it.
3. If a later requirement needs temporary allowance audit history preserved while editing the displayed total, split the current replacement behavior into an explicit adjustment ledger.

## Current Turn - 2026-06-19 CBE Task Cancellation And Employee Deletion

### Task Introduction

The user requested two changes:

1. When the employee system runs lead discovery or screening/background-check tasks, the task progress UI should have a real-time cancel task control on the right side.
2. The manager system's employee management page should support deleting employees.

### Workspace And Environment

- Repository: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Frontend: `/Users/purest./Documents/Sentura/Sentura-Platform/sentura/dashboard`
- Framework: Next.js App Router with client components and route handlers under `src/app`
- Likely relevant files:
  - `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`
  - `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/[id]/route.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`

### Task Flow

- Use the existing CBE DB/task store and API patterns; do not invent an unrelated task queue.
- Inspect whether gateway/client supports abort/cancel. If not, implement cancellation as best-effort frontend abort plus persisted task state update so the UI and DB stop treating it as active.
- Employee deletion should be server-backed from the manager page, with confirmation and list/detail refresh.

### Progress So Far

- Memory quick pass confirmed this is the active Sentura CBE workspace.
- Next.js App Router skill guidance was read for this turn.
- No code edits for this current request have been applied yet.

### Current State

- Worktree is already dirty with prior Sentura CBE changes; do not revert unrelated files.
- Need inspect task runner/gateway capabilities and admin store delete semantics.

### Next Steps

1. Search task status, task runner, gateway client, and admin operator API/store paths.
2. Patch cancel flow and employee deletion flow with focused UI.
3. Add/update static checks in `scripts/test-cross-border-agents.ts`.
4. Run `pnpm --dir sentura/dashboard exec tsc --noEmit`, `pnpm exec tsx scripts/test-cross-border-agents.ts`, relevant store tests if touched, and `git diff --check`.

### Completion Update

Completed the current request.

Files changed for task cancellation:

- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-cancellation.ts`
  - Added a small client-side `AbortController` registry keyed by CBE task id.
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - Lead, screening, and Accio hidden task runners now accept `AbortSignal`.
  - `runHiddenEmployeeTask()` checks cancellation before/after session creation, message send, polling, transcript reads, and before returning parsed payloads.
  - On abort, it best-effort deletes the gateway session transcript reference with `deleteTranscript: false`.
  - Added `EmployeeTaskError` code `cancelled` and exported `isEmployeeTaskCancellation()`.
- `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
  - Added terminal task status `cancelled`.
  - Added `cancelTask()`.
  - Progress/complete/fail now skip non-active tasks so a cancelled task cannot be overwritten by a late result.
- `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
  - Added `CancelEmployeeTaskRequestSchema`.
- `sentura/dashboard/src/lib/cross-border-store/tasks.ts`
  - Added `cancelEmployeeTask()` to persist `agent_runs.status = 'cancelled'`, set `finished_at`, write cancellation metadata, cancel associated active `lead_runs`, and write an `employee_task_cancelled` activity event.
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/[id]/cancel/route.ts`
  - New `POST` route for employee task cancellation.
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - Added `cancelEmployeeTaskInDb()` and normalized API task status `cancelled`.
- `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`
  - Active tasks now show a right-side red `取消` button.
  - Clicking it immediately marks local status cancelled, aborts the registered runner signal, calls the DB cancel endpoint, and best-effort deletes the gateway session.
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - Lead discovery, bulk screening, and manual screening now create abort signals and pass them to the runner.
  - Cancellation catch branches do not write failed/completed results and refresh DB-backed lists instead.

Important cancellation caveat:

- Gateway RPC currently has no true request-level `AbortSignal`. Cancellation is immediate for UI/DB state and blocks late writeback, while the underlying gateway/backend operation is best-effort cancelled by deleting the session and by runner-side checks when control returns.

Files changed for manager employee deletion:

- `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `listAdminOperators()`, `getAdminOperator()`, `updateAdminOperator()`, and `listAdminCosts()` now exclude `cbe_user_profiles.status = 'inactive'`.
  - Added `deleteAdminOperator()` soft delete:
    - marks the operator profile `inactive`;
    - cancels active `agent_runs`;
    - cancels active `lead_runs`;
    - cancels pending `cbe_cost_approval_requests`;
    - preserves historical customer/cost data.
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/[id]/route.ts`
  - Added `DELETE`.
- `sentura/dashboard/src/app/client-demos/cross-border/admin/_data/admin-api.ts`
  - Added `deleteAdminOperator()`.
- `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`
  - Added per-row `删除` button with confirmation dialog.
  - Successful delete removes the row, closes matching detail view, clears password draft, refreshes list, and shows a notice.

Tests and checks run:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 387 passed / 0 failed.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 165 passed / 0 failed.
- `git diff --check`: PASS.
- `curl -I --max-time 10 http://127.0.0.1:3002/client-demos/cross-border/employee/customers`: PASS, 200 OK.
- `curl -I --max-time 10 http://127.0.0.1:3002/client-demos/cross-border/admin/employees`: PASS, 200 OK.
- `POST http://127.0.0.1:3002/api/client-demos/cross-border/employee/tasks/nonexistent-task/cancel`: route loaded; returned expected `task_missing` JSON.
- `DELETE http://127.0.0.1:3002/api/client-demos/cross-border/admin/operators/nonexistent-operator`: route loaded; returned expected `operator_missing` JSON.

Current State:

- Dev server already listening on `http://127.0.0.1:3002`; both touched pages return 200.
- Worktree remains dirty from this and prior Sentura work. Do not revert unrelated files.
- No remaining implementation work for this request.

Next Steps:

1. Manual browser test if desired:
   - Start a lead or screening task in Employee.
   - Click the right-side `取消` button in the task progress bar.
   - Confirm the task becomes `已取消` and no customer/report writeback happens after a late result.
2. Manual manager test if desired:
   - In Manager > Employee Management, delete a non-critical test employee.
   - Confirm the employee disappears from Employee Management and Costs while historical customer/cost rows remain queryable via existing history paths.

## Current Turn - 2026-06-19 Admin Employee Create Unexpected Route Error

### Task Introduction

User reports Manager > Employee Management cannot create an employee account; UI shows `Unexpected CBE route error.` The intended final outcome is that management can create real employee accounts in the live CBE database from the admin UI.

### Workspace And Environment

- Repository: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard: `sentura/dashboard`, Next.js App Router.
- Relevant likely paths:
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/route.ts`
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_data/admin-api.ts`

### Task Flow

1. Reproduce the exact POST `/api/client-demos/cross-border/admin/operators` error with curl against the live dev server.
2. Inspect route error handling and server logs/code to identify the real thrown database/schema/validation error hidden behind the generic message.
3. Patch the create-operator flow to create a real DB-backed employee account reliably.
4. Add or update regression checks.
5. Run TypeScript and CBE tests.

### Progress So Far

- Memory quick pass found Sentura CBE workspace guidance.
- Next.js App Router skill was read for this turn.
- Handoff section created before edits.

### Current State

- No code edits for this request yet.
- Need reproduce the POST error and patch focused files only.

### Next Steps

1. `curl` the admin operator create endpoint with a test payload.
2. Inspect `cbeRouteError`, `AdminCreateOperatorRequestSchema`, `createAdminOperator` route, and `upsertAdminOperatorProfile`.
3. Patch and verify.

### Completion Update

Completed this request.

Root cause:

- `POST /api/client-demos/cross-border/admin/operators` called `sentura.rbac.users.upsert` through the server-side gateway before writing the CBE database.
- The current gateway rejected the server handshake with `Gateway handshake failed: device identity required`.
- Because `GatewayClient.rpc()` can reject plain RPC-shaped values, the route error layer could collapse some failures to `Unexpected CBE route error.`
- Employee login in this CBE flow already supports manager-set employee name + password directly from `cbe_user_profiles`, so gateway RBAC upsert was an unnecessary hard dependency for creating a usable employee account.

Files changed:

- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/route.ts`
  - Removed gateway RBAC upsert dependency from employee creation.
  - Added local CBE operator identity creation with `cbe-user-operator-${uuid}` and generated `@cbe.local` email fallback.
  - Response now uses `tokenDisplayPolicy: "password_only"` because employees log in with name + password.
- `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `upsertAdminOperatorProfile()` now checks visible same-name operators before insert/update and returns `operator_name_exists` with a Chinese message.
  - This prevents creating active/suspended duplicate employee names that would make name/password login ambiguous.
- `sentura/dashboard/src/lib/cross-border-store/route-utils.ts`
  - Plain object errors with a `message` field are now surfaced in JSON instead of being replaced by `Unexpected CBE route error.`
- `scripts/test-cross-border-phase2-store.ts`
  - Updated CE21 assertions from the old RBAC-upsert assumption to DB-backed name/password creation and route-error diagnostics.

Verification:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 166/0.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 387/0.
- `git diff --check`: PASS.
- Live API smoke on `http://127.0.0.1:3002`:
  - Created temporary employee: `POST /api/client-demos/cross-border/admin/operators` returned `201`.
  - Logged in with created employee name/password: `POST /api/auth/login` returned `200` and employee redirect.
  - Deleted temporary employee: `DELETE /api/client-demos/cross-border/admin/operators/:id` returned `200`.
  - Duplicate active name check: first create `201`, second create `409 operator_name_exists`, cleanup delete `200`.

Current State:

- Manager employee creation is now real-time and CBE DB-backed.
- It no longer depends on the currently failing server-side gateway identity handshake.
- Temporary smoke-test employees were deleted via the manager delete API, leaving inactive audit rows only.
- No remaining implementation work for this request.

## Current Turn - 2026-06-19 Employee Personal Center Session Name

### Task Introduction

The user reports that the Employee operating system personal center always says `你好，林悦` and does not change based on the logged-in employee. The intended outcome is for the Employee personal center to greet the actual logged-in employee name from the current CBE session.

### Workspace And Environment

- Repository: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard: `sentura/dashboard`, Next.js App Router.
- Likely relevant paths:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/session/route.ts`
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/app/api/auth/login/route.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`

### Task Flow

1. Locate the hardcoded `林悦`/employee profile usage in personal center.
2. Reuse existing CBE session API/session cookie path rather than inventing a new identity store.
3. Patch personal center to read the current session display name and fall back only if session lookup fails.
4. Add/update regression checks for the dynamic greeting.
5. Run TypeScript and CBE tests, plus a live session/API smoke if feasible.

### Progress So Far

- Memory quick pass found this checkout's Sentura CBE context.
- Next.js App Router skill was read for this turn.
- Handoff skeleton created before edits.

### Current State

- Implementation is complete for this request.
- Employee personal center now reads `/api/client-demos/cross-border/session` and uses the logged-in operator `displayName` for `你好，...`.
- `employeeProfile.name` remains only as a fallback if the session name cannot be read.

### Next Steps

1. If further UI verification is needed, log in with two different manager-created employee accounts and open `/client-demos/cross-border/employee`; the greeting should switch to each account's display name.
2. No remaining code work is known for this specific request.

### Progress So Far

- Changed `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`:
  - Added a session-name refresh effect using `/api/client-demos/cross-border/session`.
  - Added `sessionDisplayName` state and `currentEmployeeName`.
  - Replaced the welcome heading from static `employeeProfile.name` to `currentEmployeeName`.
- Changed `scripts/test-cross-border-agents.ts`:
  - Added a regression check that the employee personal center greeting uses the logged-in session display name and no longer renders `你好，{employeeProfile.name}` directly.
- Verification:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 388 passed / 0 failed.
  - `git diff --check`: PASS.

## Current Turn - 2026-06-19 Manager Cost Amount Precision

### Task Introduction

The user asks that all costs and monetary amounts in the manager system display and any over-limit calculations keep at most two decimal places. The intended outcome is a consistent manager-side amount formatting rule with no UI values showing more than two digits after the decimal point.

### Workspace And Environment

- Repository: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard: `sentura/dashboard`, Next.js App Router.
- Relevant area expected:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/**`
  - `sentura/dashboard/src/components/cross-border/**`
  - cost/admin store helpers under `sentura/dashboard/src/lib/cross-border-store/**`
  - regression checks in `scripts/test-cross-border-agents.ts` and possibly `scripts/test-cross-border-phase2-store.ts`

### Task Flow

1. Search manager-side cost, money, currency, USD, budget, and over-limit displays.
2. Reuse or introduce a small helper so manager costs are rounded/formatted to two decimals consistently.
3. Ensure over-limit calculations also round to two decimals before display.
4. Add regression coverage to detect excessive decimal rendering.
5. Run TypeScript and CBE tests.

### Progress So Far

- Memory quick pass found the Sentura CBE cost-truthfulness context.
- Next.js App Router skill was read for this turn.
- Handoff section created before implementation.

### Current State

- Implementation is complete for this request.
- Manager system cost and money fields now round to at most two decimals in schemas, admin store/API responses, overrun approval calculations, and manager UI inputs/displays.
- No `toFixed(6)` remains in the manager cost store/UI path.

### Next Steps

1. If further verification is needed, log in to the manager system, open `成本监控`, and paste a value such as `12.3456` into 月限额/临时额度/审批金额. Saving should store/display it as two decimals.
2. No remaining code work is known for this specific request.

### Progress So Far

- Changed `sentura/dashboard/src/lib/cross-border-store/schemas.ts`:
  - Added `CbeMoneyUsdSchema` to round money input to two decimals.
  - Applied it to agent/task estimated cost, manager initial limits, cost limits, allowances, approval amounts, and Accio import estimated cost.
- Changed `sentura/dashboard/src/lib/cross-border-store/admin.ts`:
  - Added `moneyUsd()` and `moneyUsdText()`.
  - Rounded manager overview, operator rows, operator cost details, admin cost rows, pool totals, approval rows, monthly overrun sync, approval decisions, and budget preflight overrun payloads.
  - Replaced prior sentura-cost six-decimal formatting with two-decimal money formatting.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`:
  - Added front-end money rounding helpers.
  - Rounded submitted month limits, temporary allowances, and approval amounts.
  - Set manager cost inputs to `step="0.01"` and default two-decimal input values.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`:
  - Rounded employee-management cost display and new employee month-limit submissions to two decimals.
  - Set new employee month-limit input to `step="0.01"`.
- Changed tests:
  - `scripts/test-cross-border-agents.ts`: added manager two-decimal money precision regression check.
  - `scripts/test-cross-border-phase2-store.ts`: added schema/store/overrun precision regression check.
- Verification:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 389 passed / 0 failed.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 171 passed / 0 failed.
  - `git diff --check`: PASS.

## Current Turn - 2026-06-19 Scrollable Message Reminders

### Task Introduction

The user asks that Employee system message reminders should not stretch into a long single column, and should instead have a scrollbar for vertical browsing. They also ask to ensure the Manager system can view all message reminders, also with a scrollbar.

### Workspace And Environment

- Repository: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard: `sentura/dashboard`, Next.js App Router.
- Likely relevant files:
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/employee/notifications/route.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/**`
  - `scripts/test-cross-border-agents.ts`
  - `scripts/test-cross-border-phase2-store.ts`

### Task Flow

1. Inspect existing Employee and Manager notification/message UI in `AppShell`.
2. Add constrained-height scroll containers for message lists.
3. Ensure Manager notification UI can list all message reminders, not only a compact count-only summary.
4. Add regression checks for scrollable message reminder lists.
5. Run TypeScript and CBE tests.

### Progress So Far

- Memory quick pass found prior Sentura CBE message-center context.
- Next.js App Router skill was read for this turn.
- Handoff section created before implementation.

### Current State

- Implementation is complete for this request.
- Employee AppShell message dropdown now renders the full message list inside a constrained vertical scroll area.
- Employee personal center `消息提醒` card now uses a constrained vertical scroll area so many reminders no longer stretch the page indefinitely.
- Manager AppShell notification dropdown now renders all pending cost-approval reminders and high-value customer reminders in a scrollable list instead of only showing compact summary counts.

### Next Steps

1. If browser verification is needed, open Employee and Manager systems with many notifications and confirm the dropdown/personal-center lists scroll vertically.
2. No remaining code work is known for this specific request.

### Progress So Far

- Changed `sentura/dashboard/src/components/app-shell.tsx`:
  - Added manager notification item typing for pending approvals and high-value customer reminders.
  - Fetched manager high-value customer reminders with a larger `limit=100&range=all` request.
  - Replaced compact manager summary-only reminder rows with full scrollable lists for cost approvals and high-value customers.
  - Removed the Employee dropdown's four-message preview cap and wrapped the full list in a scrollable container.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`:
  - Wrapped the personal-center `消息提醒` list in a `max-h-[360px]` vertical scroll area.
- Changed tests:
  - `scripts/test-cross-border-agents.ts`: added regression checks for scrollable full Employee/Manager AppShell reminders and the Employee personal-center scroll area.
  - `scripts/test-cross-border-phase2-store.ts`: added a regression check that Employee and Manager notification lists stay scrollable and full-length.
- Verification:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 391 passed / 0 failed.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 174 passed / 0 failed.
  - `git diff --check`: PASS.

## Current Turn - 2026-06-19 Manager/Employee Cost Limit Synchronization

### Task Introduction

The user reports that after changing quota/limit values in the Manager system, the Employee system's remaining quota number does not change. The intended outcome is that manager-side cost-limit edits and employee-side API-cost/remaining-quota displays read the same current data source and refresh correctly.

### Workspace And Environment

- Repository: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Dashboard: `sentura/dashboard`, Next.js App Router.
- Likely relevant files:
  - `sentura/dashboard/src/lib/cross-border-store/admin.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/admin/cost-limits/route.ts`
  - `sentura/dashboard/src/app/api/client-demos/cross-border/employee/costs/route.ts` if present, or the employee cost component/API path.
  - `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
  - `scripts/test-cross-border-agents.ts`
  - `scripts/test-cross-border-phase2-store.ts`

### Task Flow

1. Trace manager cost-limit write path and employee cost-summary read path.
2. Confirm whether employee remaining quota uses stale local defaults, hardcoded budget, or a different identifier than manager writes.
3. Patch the employee read path to derive remaining quota from the current manager cost limit plus active allowance minus current usage.
4. Add regression coverage for manager/employee cost-limit synchronization.
5. Run TypeScript and CBE tests.

### Progress So Far

- Memory quick pass found prior Sentura CBE cost-truthfulness and budget-model context.
- Next.js App Router skill was read for this turn.
- Initial scan points to `cross-border-store/admin.ts`, `employee-cost.tsx`, manager cost routes/pages, and CBE regression scripts.

### Current State

- Implementation is complete for this request.
- Employee cost UI no longer calculates remaining quota from the static `monthlyCostBudget.limitUsd` value.
- Employee cost UI now reads the current logged-in operator's server-side cost budget from a new Employee API route, using the Manager-updated monthly base limit plus active temporary allowance.
- The employee cost mini card, personal-center cost card, and task budget notice all use the same dynamic budget object.
- The sentura-cost spend helper now returns `null` when no scoped real events exist, so budget calculations can fall back to DB task estimates instead of incorrectly treating missing event coverage as zero spend.

### Next Steps

1. If browser verification is needed, log in as manager, change an operator's 月基础限额 or 临时额度, then log in as that operator and click `刷新成本`; the Employee `剩余` and header `上限` should reflect the Manager values.
2. No remaining code work is known for this specific request.

### Progress So Far

- Changed `sentura/dashboard/src/lib/cross-border-store/admin.ts`:
  - Added `getEmployeeCostBudget(context, "month")`.
  - The function reads `cbe_cost_limits`, active `cbe_cost_allowances`, current spend, and returns `limitUsd`, `remainingUsd`, `warningRatio`, and `hardStopRatio` for the current logged-in operator.
  - Adjusted `getSenturaCostSpendForUserPeriod` so missing scoped sentura-cost events fall back to DB estimates instead of forcing spend to zero.
- Added `sentura/dashboard/src/app/api/client-demos/cross-border/employee/cost-budget/route.ts`:
  - Employee-scoped, force-dynamic, Node runtime route for the current operator's budget snapshot.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`:
  - Added `fetchEmployeeCostBudget()` and `EmployeeCostBudgetSnapshot`.
- Changed `sentura/dashboard/src/components/cross-border/employee-cost.tsx`:
  - Cost mini/card/task notices now use dynamic server budget instead of static `monthlyCostBudget.limitUsd`.
  - Removed the static `employeeProfile.userToken` cost-event filter and scopes events by the current operator's DB task session keys.
- Changed tests:
  - `scripts/test-cross-border-agents.ts`: added manager/employee cost-quota sync regression check.
  - `scripts/test-cross-border-phase2-store.ts`: added employee cost-budget route and store wiring checks.
- Verification:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 394 passed / 0 failed.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 176 passed / 0 failed.

## Current Turn - 2026-06-19 CBE Employee Notification Deep Links And Bell Preview Count

### Task Introduction

The user wants Employee-side message reminders to behave as task deep links, not generic message-center links. Clicking a concrete bell or personal-center message should jump to the related task target and show a light-blue flashing frame. Only `查看全部消息` should go to the Employee personal-center `消息提醒` section. Lead discovery, buyer screening, and Accio memory organization messages should jump to the related company list/task rows. API cost/quota messages should jump to personal-center `我的 API 成本` and flash that card. The bell dropdown should contain 10 concrete messages total, with a scroll area that shows about 3 messages at once.

### Workspace And Environment

- Repository: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Branch: `wst1.0-ecommerce` tracking `origin/ecommerce`
- Dashboard: `sentura/dashboard`, Next.js App Router.
- Relevant files identified:
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/components/cross-border/employee-cost.tsx`

### Task Flow

1. Confirm current bell and personal-center message rendering.
2. Create a shared Employee notification target helper so both surfaces use the same target decision.
3. Route cost/quota notifications to the Employee API-cost card and task notifications to the customers page `highlightTask` flow.
4. Ensure Accio memory supplement tasks expose affected customer ids from `metadata.supplement_target.customer_id`.
5. Run TypeScript and relevant lightweight checks, then commit and push to `origin/ecommerce`.

### Progress So Far

- Memory quick pass found prior Sentura CBE message-center/highlight context.
- Next.js App Router skill was read earlier in the turn.
- Existing customer-list `highlightTask` support already flashes related customer rows with a light-blue outline.
- Existing bell implementation currently routes every concrete message to `/client-demos/cross-border/employee#employee-messages`; this is the bug to fix.
- Existing personal-center message rows are static blocks, so they need `Link` behavior plus read marking.
- Cost-control notifications are persisted as task-like `agent_runs` with id prefix `cost_notice` and `metadata.notification_kind` values such as `cost_limit_updated`, `cost_allowance_updated`, and `cost_approval_approved/rejected`.

### Current State

- Superseded by implementation notes below; this section was the pre-edit state.
- Dashboard and Gateway were already running successfully from the previous startup fix.

### Next Steps

1. Add shared helper under Employee `_data` for message-center href, API-cost highlight href, cost-notification detection, and notification target href.
2. Patch `EmployeeNotificationBell` to show `messages.slice(0, 10)` in a scroll area; concrete message clicks mark only that message read and navigate to the helper href; `查看全部消息` marks all unread and keeps the personal-center anchor.
3. Patch Employee home `消息提醒` rows to link to the same helper href and mark the clicked message read; wrap `EmployeeCostCard` in `#employee-api-cost` and flash it when `highlightCost=api` is present.
4. Patch `employee-api.ts` task affected id extraction to include `metadata.supplement_target.customer_id/customerId`.
5. Run `pnpm --dir sentura/dashboard exec tsc --noEmit`, `git diff --check`, and browser/curl smoke checks if possible.

### Progress So Far

- Implemented the current notification request.
- Added `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-notification-targets.ts`:
  - Shared `EMPLOYEE_MESSAGE_CENTER_HREF`.
  - Shared `EMPLOYEE_NOTIFICATION_PREVIEW_LIMIT = 10` for the bell total preview count.
  - Shared `EMPLOYEE_NOTIFICATION_VISIBLE_COUNT = 3` for the bell scroll-window height.
  - Shared `employeeTaskNotificationHref(task)`:
    - Cost/quota notifications route to `/client-demos/cross-border/employee?highlightCost=api&highlightMessage=<taskId>#employee-api-cost`.
    - All other task notifications route to `/client-demos/cross-border/employee/customers?highlightTask=<taskId>`.
  - Shared light-blue flash class for the Employee API cost card.
- Changed `sentura/dashboard/src/components/app-shell.tsx`:
  - Concrete Employee bell messages now deep-link to the helper target instead of always going to `#employee-messages`.
  - Concrete message clicks mark only that message read.
  - `查看全部消息` still goes to the Employee personal-center message section and marks current unread messages read.
  - The bell renders the newest 10 concrete messages in a scroll area sized for about 3 compact rows.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`:
  - Personal-center message rows are now clickable and use the same task/cost target helper.
  - Cost notifications scroll to `#employee-api-cost` and flash the `我的 API 成本` card for 3 seconds.
  - Clicking a personal-center message marks that one message read.
- Changed `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`:
  - `taskAffectedCustomerIds()` now includes `metadata.supplement_target.customer_id/customerId`, so Accio memory supplement tasks can locate their company row in the customer list.
- Updated static regression scripts:
  - `scripts/test-cross-border-agents.ts`
  - `scripts/test-cross-border-phase2-store.ts`

### Current State

- Verification passed:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 394 passed / 0 failed.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 176 passed / 0 failed.
  - `git diff --check`: PASS.
- Runtime smoke:
  - `curl -I http://localhost:3000/client-demos/cross-border/employee`: 200.
  - `curl -I 'http://localhost:3000/client-demos/cross-border/employee/customers?highlightTask=smoke-task'`: 200.
  - `curl -I 'http://localhost:3000/client-demos/cross-border/employee?highlightCost=api&highlightMessage=smoke-task#employee-api-cost'`: 200.
  - `curl -s -H 'x-cbe-user-id: cbe-user-operator-001' 'http://localhost:3000/api/client-demos/cross-border/employee/tasks?limit=5'`: returned live cost notices and Accio task metadata including `notification_kind: cost_*` and `supplement_target.customer_id`.

### Next Steps

1. Stage, commit, and push to `origin/ecommerce`.
2. Optional manual UI pass with a logged-in operator account can click the bell and watch the actual flashing rows/cards; no known implementation blocker remains.
