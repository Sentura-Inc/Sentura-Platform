# Sentura CBE Continuation Handoff

## Current Resume Snapshot

Default continuation rule: read this file first, especially this snapshot and `Next Steps`. Do not read `docs/MEMORY.md` by default. Use `docs/MEMORY.md` only as a targeted historical index when this file names a specific row, section, or project-memory detail to check.

Workspace: `/Users/purest./Documents/Sentura/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce Employee flow.

Completed 2026-06-16 repeated Screening timeout task:

- User sent a new screenshot from the notification center showing `单个背调` failed with `等待后台 AI 员工返回结构化结果超时。`, timestamp `06/16 01:22`, `需要处理 1 个客户`.
- Investigation result:
  - This failure is different from the earlier 10,570-character marker truncation bug.
  - Matching session key: `agent:cbe-buyer-screening:user:69ddf60b-84ab-4fe3-aedf-5d1b8bc1d502:49d98565-c527-43c5-9b55-2baad3a2d84e`.
  - OpenClaw session id: `a91359b8-832b-450c-91ef-110c00d30d81`.
  - Backend metadata showed status `done`, runtime about 173s, provider `openai`, model `gpt-5.5`, estimated cost about `US$0.069468`.
  - Session JSONL final assistant had empty text, `stopReason: "aborted"`, and `errorMessage: "LLM idle timeout (120s): no response from model"`.
  - Trajectory recorded `finalStatus: "error"`, `aborted: true`, `timedOut: true`, `idleTimedOut: true`.
  - The session had already called tools; one SEC EDGAR result was about 64 KB because `cbe_intel_sec_lookup` returned full SEC submissions JSON. That large tool result is a major context/latency risk before the model has to produce final structured Screening JSON.
  - The frontend hid the real backend failure because the hidden runner only waited for marker JSON and did not inspect transcript `errorMessage` / `stopReason`.
- Completed files:
  - `sentura/mcp-servers/cross-border-intel/src/tools.ts`
  - `sentura/mcp-servers/cross-border-intel/src/server.test.ts`
  - `sentura/dashboard/src/lib/gateway/types.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `scripts/test-cross-border-agents.ts`
  - `docs/TESTS.md`
  - `docs/tests/tests-cross-border-ecommerce.md`
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-1.md`
- Completed changes:
  - `cbe_intel_sec_lookup` now returns compact `submissions_summary` with recent filing count, bounded form list, and latest 8 filing records instead of full SEC submissions JSON.
  - MCP test now verifies the full `submissions` object is absent, only 8 recent filings are returned, and the serialized result stays compact.
  - Gateway `TranscriptMessage` typing now includes optional `stopReason` and `errorMessage`.
  - Employee hidden runner now surfaces backend model failures as `backend_error`, including a specific Chinese message for `LLM idle timeout`, instead of waiting until the generic marker timeout.
  - CBE static suite now includes guards for backend failure surfacing and compact SEC lookup.
- Verification completed:
  - `pnpm --filter @sentura/mcp-cross-border-intel test` -> 17/17 pass.
  - `pnpm --filter @sentura/mcp-cross-border-intel build` -> pass.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> 335/335 pass.
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass.
  - `cd sentura/dashboard && pnpm exec eslint src/lib/gateway/types.ts src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts` -> pass.
  - `cd sentura/dashboard && pnpm build` -> pass; existing Next workspace-root warning only.
  - Local runtime restarted after MCP build. Gateway is running on `http://localhost:18789` and Dashboard is running on `http://localhost:3000`.
- Remaining boundary:
  - No new live paid/LLM Screening submit was triggered during this fix. The old failed notification may remain as a historical failed task record in local task state; new runs should use the compact SEC payload and display real backend errors if the model/provider still aborts.

Active 2026-06-16 external API cost truth task:

- User opened `本月 API 成本明细` on `/client-demos/cross-border/employee/customers` and saw only `gpt-5.5` usage. Screenshot shows currently connected sources: OpenAI model, Tavily/web_search, Companies House, RDAP, DNS MX/SPF/DMARC, Abstract Email Reputation, Hunter Email Verifier, SEC EDGAR, ImportYeti, official website contact search. User asks whether those key/API-call fees are counted and wants the most truthful API cost details.
- Initial finding:
  - Current `sentura-cost` schema says `One row per LLM call` and only captures OpenClaw `model.usage` diagnostic/session-log backfill.
  - Employee cost UI explicitly says external search/email/trade services are not counted yet. That is now product-incorrect for the user requirement.
  - Need add external API/service cost events, not just UI copy.
- Completed result:
  - `sentura-cost` now supports model, external API, and local-tool events with service/interface labels, operation, pricing status, usage units, HTTP status, tool name, and pricing notes.
  - OpenClaw session-log backfill now converts CBE `toolResult` rows into visible external cost rows for Tavily/web_search, web_fetch, Companies House/public registry fallback, RDAP, DNS MX/SPF/DMARC, Abstract Email Reputation, Hunter Email Verifier, SEC EDGAR, ImportYeti, official website contact search, and local scoring.
  - The Employee `本月 API 成本明细` dialog no longer shows only `gpt-5.5`; it labels rows as model/external backfill and shows `真实美元`, `按官方单价估算`, `0 美元`, `套餐内/返回 0`, or `未折算美元`.
  - Monthly total remains truthful: free/public/included/unpriced calls are visible but not fabricated into dollar spend. ImportYeti uses provider `requestCost` when present; Abstract/Hunter show request/credit usage without fake USD when account-plan allocation is unknown.
- Completed files:
  - `sentura/extensions/sentura-cost/src/types.ts`
  - `sentura/extensions/sentura-cost/src/session-log-backfill.ts`
  - `sentura/extensions/sentura-cost/index.ts`
  - `sentura/dashboard/src/lib/gateway/types.ts`
  - `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
  - `scripts/test-week4-cost.ts`
  - `scripts/test-cross-border-agents.ts`
  - `docs/TESTS.md`
  - `docs/tests/tests-cross-border-ecommerce.md`
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-1.md`
- Verification completed:
  - `pnpm exec tsx scripts/test-week4-cost.ts` -> 37/37 pass.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> 333/333 pass.
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass.
  - `cd sentura/dashboard && pnpm exec eslint src/components/cross-border/employee-cost.tsx src/lib/gateway/types.ts` -> pass.
  - Restarted local demo with `scripts/start-sentura-demo.sh restart`; Gateway PID 82516 on `:18789`, Dashboard PID 82347 on `:3000`.
  - Browser verification on `http://localhost:3000/client-demos/cross-border/employee/customers`: opened `本月 API 成本明细`; visible rows included Hunter, Abstract, DNS, Public web fetch, Official website contact search, RDAP, ImportYeti, SEC EDGAR, and model rows. Dialog total showed `本月已用 US$3.59`, `调用次数 198`, `模型 tokens 114.5万`.
  - Direct local backfill probe over `~/.openclaw` found 220 total rows: 83 model/session rows and 137 external tool-log rows.
- Pricing sources checked:
  - OpenAI official pricing: GPT-5.5 is $5/1M input, $0.50/1M cached input, $30/1M output.
  - Tavily docs: pay-as-you-go $0.008/credit; basic search 1 credit, advanced search 2 credits; extract credits are batched per successful URL count.
  - Hunter pricing: one credit per email found; email verification is 0.5 credit.
  - Abstract Email Reputation pricing: free/starter plans are monthly request quotas, so single-request USD is not safely inferable without account-plan allocation.
  - Companies House and SEC EDGAR public data are treated as no platform third-party API fee.
  - ImportYeti cost uses API response metadata such as `requestCost`; if response says `requestCost=0`, show included zero spend.
- Remaining boundary:
  - This is observed-call cost visibility, not provider invoice reconciliation. External services that bill monthly or via account-specific credits remain `未折算美元` unless the app is later configured with account-plan amortization rules.
- Original planned investigation:
  - Inspect `cross-border-intel` MCP tools and OpenClaw session/trajectory logs to determine where external provider calls are observable.
  - Verify pricing assumptions from current official provider docs before hardcoding cost estimates.
  - Extend `sentura-cost` types/backfill/aggregation/dashboard display so external provider calls are visible as real recorded rows with clear pricing status: priced/free/unpriced/plan-included/estimated.
  - Keep monthly API cost truthful: do not invent spend for services that are free, not called, plan-included, or unavailable; surface them as zero-cost or unpriced rows with reason.

Completed 2026-06-16 Screening timeout + Lead target-count task:

- User tried parallel `寻找客户` + `背调`; Lead succeeded but Screening failed with `等待后台 AI 员工返回结构化结果超时。`
- User also reports selecting Lead target count `20` still returns only 5 customers, and asks for arbitrary manual target-count input with strict target-count execution.
- Investigation result:
  - Screenshot session key `agent:cbe-buyer-screening:user:69ddf60b-84ab-4fe3-aedf-5d1b8bc1d502:971df594-3d82-4bee-963f-f498c55e253c` maps to OpenClaw session id `a118d03c-331d-4a57-91f7-c36820081c1d`.
  - OpenClaw session status is `done`, runtime about 168s, not a backend crash.
  - The final assistant message was 10,570 characters and did produce `SCREENING_REPORTS_JSON_START/END`.
  - Root cause: dashboard `chat.history` uses a default per-message text projection around 8000 chars; the long Screening JSON was truncated before the end marker, so `runHiddenEmployeeTask()` never parsed it and eventually marked the frontend task as timeout.
  - Lead count root cause: `buildLeadPrompt()` currently says `优先返回 1-5 个高质量候选`, so the agent is being instructed to cap output even when `target_count` is higher.
- Completed files:
  - `sentura/dashboard/src/lib/gateway/client.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `scripts/test-cross-border-agents.ts`
  - `docs/TESTS.md`
  - `docs/tests/tests-cross-border-ecommerce.md`
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-1.md`
- Completed changes:
  - `GatewayClient.getTranscript()` now forwards optional `maxChars` into `chat.history`.
  - Hidden Employee tasks now request `HIDDEN_TASK_TRANSCRIPT_MAX_CHARS = 300_000`, preventing long Screening JSON marker output from being truncated by frontend polling.
  - Hidden task timeout grace is wider for long real Screening runs.
  - Lead prompt removed the old `1-5` cap and treats `target_count` as the requested count.
  - Lead target count is now a manual numeric input (`min=1`, normalized integer) instead of fixed 20/50/100/150 presets.
  - Lead import caps over-returned rows to the requested target count.
  - CBE static suite now includes guards for long history reads, Lead target prompt behavior, numeric input, and over-return capping.
- Verification completed:
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass
  - `cd sentura/dashboard && pnpm exec eslint src/lib/gateway/client.ts src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts src/app/client-demos/cross-border/employee/customers/page.tsx` -> pass
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> `331 passed, 0 failed`
  - `cd sentura/dashboard && pnpm build` -> pass; existing Next workspace-root warning only
  - `git diff --check` -> pass
- Product boundary:
  - The target count is now a hard requested count and over-return is capped. The system will not fabricate buyer companies to fill arbitrary numbers; if public sources and exclusion rules leave fewer compliant buyers, the employee should return fewer rows with `shortage_reason`.

Active 2026-06-15 Employee navigation/report/delete task:

- User asks:
  1. `http://localhost:3000/client-demos/cross-border/employee` should not be accessed via the logo. Add a clean first navigation option to the left of `获客与背调` and `记忆整理`.
  2. When clicking `查看报告`, the report sheet/page should open at the top of its scroll area, not midway down.
  3. Add customer deletion in the `获客与背调` list, supporting single and batch deletion, with a required confirmation design.
- Planned files:
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
  - `scripts/test-cross-border-agents.ts`
- Current findings:
  - Header currently wraps `sentura-logo-side.svg` in a `Link` to `/client-demos/cross-border/employee`.
  - `employeeNav` currently has only `获客与背调` and `记忆整理`.
  - Customer store supports `setRows` and `upsertRows`, but no explicit delete helper.
  - Customer detail sheet uses one scrollable `SheetContent`; opening detail needs scroll reset via content ref/effect.
- Completed:
  - `sentura/dashboard/src/components/app-shell.tsx`
    - Added `个人中心` as the first Employee navigation option, to the left of `获客与背调` and `记忆整理`.
    - Removed the logo-as-home-link behavior. The logo is now a non-clickable brand block with `aria-label="Sentura 跨境电商客户系统"`.
    - Updated mobile Employee nav from two columns to three columns.
  - `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
    - Added persisted `deleteRows(customerIds)` helper that removes customer rows by `customerId`.
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
    - Added batch `删除所选（N）` action in the list toolbar.
    - Added per-row delete action on desktop and mobile customer cards.
    - Added required delete confirmation sheet (`确认删除客户`) with target list and explicit destructive confirmation.
    - Deletes clear affected selections and active detail state, then show a completion notice.
    - Added `SheetContent` scroll ref/effect so `查看报告` opens at the top of the report sheet.
  - `scripts/test-cross-border-agents.ts`
    - Added static regression checks for `个人中心` nav ordering, non-clickable logo home behavior, persisted customer deletion, report sheet scroll reset, and delete confirmation.
- Verification completed:
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass
  - `cd sentura/dashboard && pnpm exec eslint src/components/app-shell.tsx src/app/client-demos/cross-border/employee/customers/page.tsx src/stores/use-cbe-employee-store.ts` -> pass
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> `327 passed, 0 failed`
  - `git diff --check` -> pass
- Browser verification:
  - `/client-demos/cross-border/employee`: DOM shows nav order `个人中心 / 获客与背调 / 记忆整理`; logo brand block exists and `logoAnchor` is `null`.
  - `/client-demos/cross-border/employee/customers`: DOM shows `删除所选（1）`, per-row `删除` buttons, and the score sort controls.
  - Delete confirmation opened successfully from `删除所选（1）`; dialog text starts with `确认删除客户`, includes `取消`, `确认删除 1 个客户`, and no-recycle-bin wording.
  - Report detail retest after scroll fix: clicking `Mobile Lab UK` -> `查看报告` opens the report dialog with `scrollTop: 0`, `scrollHeight: 2608`, and expected report text present.
  - Browser error-log check showed only earlier historical Base UI errors; no new error was produced during the final report retest.

Active 2026-06-15 lead/screening parallel task:

- User approved implementation for allowing the same Employee customer page to run one `寻找客户` task and one `背调` task at the same time.
- Scope:
  - Keep the current Employee UI and hidden OpenClaw task model.
  - Allow at most one active Lead task and at most one active Screening task concurrently.
  - Do not open unlimited same-kind concurrency or production multi-user dedupe in this pass.
  - Update progress/status UI so both active tasks can be visible instead of only the first active task.
- Completed:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx` now uses independent `leadRunning` and `screeningRunning` gates instead of a single `taskRunning` lock.
  - `寻找客户` is disabled only while a Lead task is active; `批量背调` / `手动背调` are disabled only while a Screening task is active.
  - Task-sheet copy now tells the user that the other task type can keep running concurrently; same-kind duplicate submissions remain blocked.
  - `sentura/dashboard/src/components/cross-border/employee-task-status.tsx` now renders up to two active task cards and shows `正在同时运行` when both task kinds are active.
  - `scripts/test-cross-border-agents.ts` added guards for independent Lead/Screening gates and multi-task status rendering; CBE static suite is now 322/322.
  - `docs/TESTS.md`, `docs/tests/tests-cross-border-ecommerce.md`, `docs/MEMORY.md`, and `docs/memory/cross-border-ecommerce/phase-1.md` are updated for the parallel-task behavior.
- Verification completed so far:
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass
  - `cd sentura/dashboard && pnpm exec eslint src/app/client-demos/cross-border/employee/customers/page.tsx src/components/cross-border/employee-task-status.tsx` -> pass
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> `322 passed, 0 failed`
  - `cd sentura/dashboard && pnpm build` -> pass; existing Next workspace-root warning only
  - `git diff --check` -> pass
- Live-submit note:
  - This pass did not click new live Lead/Screening submit calls to avoid extra external search/LLM/API spend. Behavior was verified by source, TypeScript/build, focused lint, and CBE static guards.

Active 2026-06-15 header notification/logo task:

- User wants the top-right bell to have real function, not only a decorative button. It should surface completed/failed background task notifications and show a red numeric unread badge after tasks finish.
- User also wants the top-left header to stop showing two logos. Remove the standalone `sentura-logo-icon.svg` from the shell and keep only `sentura-logo-side.svg` so the layout stays clean.
- Planned files:
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `scripts/test-cross-border-agents.ts`
  - `docs/TESTS.md`
  - `docs/tests/tests-cross-border-ecommerce.md`
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-1.md`
- Completed:
  - `sentura/dashboard/src/components/app-shell.tsx` now makes the header bell a real `消息中心` notification popover, backed by completed/failed CBE task records from `useCbeEmployeeStore`.
  - The bell shows a red unread count badge when terminal task records have not been marked read.
  - Read notification IDs are persisted under `sentura-cbe-notification-read-task-ids-v1`; rows mark read on click, and `全部已读` marks all current notifications read.
  - Header brand now renders only `/sentura-logo-side.svg`; `/sentura-logo-icon.svg` is no longer used in the Employee shell.
  - CE16 static coverage is now 317/317 and includes guards for the task notification center and single-logo header.
- Verification:
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass
  - `cd sentura/dashboard && pnpm exec eslint src/components/app-shell.tsx` -> pass
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> 317 passed, 0 failed
  - `cd sentura/dashboard && pnpm build` -> pass; existing Next workspace-root warning only
  - `git diff --check` -> pass
  - Browser DOM check on `http://127.0.0.1:3000/client-demos/cross-border/employee/customers`: header image list contains only `/sentura-logo-side.svg`, not `/sentura-logo-icon.svg`; `消息中心` button renders with dialog semantics; console errors 0.
  - Browser automation caveat: this Browser session did not trigger any page click handlers, including unrelated existing buttons such as `寻找客户`, so the actual bell click path was validated through source/static/type/build checks rather than a successful Browser click.

Active 2026-06-15 UI functionality task:

- User reports two Employee-side issues:
  1. The `本月 API 成本` detail view opens, but the detailed records cannot scroll vertically and feel frozen; clicking `刷新明细` should show a brief visual refresh flash/state.
  2. `http://localhost:3000/client-demos/cross-border/employee` still contains several buttons that do nothing; audit and optimize the Employee home page so visible controls either navigate, open a detail view, or trigger a real supported action.
- Work should keep the Employee UI business-facing and avoid decorative/no-op buttons.
- Verify with browser after edits.
- Completed:
  - `EmployeeCostMini` dialog now uses a flex, max-height layout. The cost record table area is an independent `overflow-auto` region and remains scrollable when records exceed the visible height.
  - `刷新明细` now triggers a short blue highlight/flash on the details area plus refresh icon animation.
  - Employee home now reads customers from `useCbeEmployeeStore`, not only static seed rows, so route-to-route task results can affect the home dashboard.
  - Home `今日 / 本周 / 本月 / 全部` controls now update real filter state and change dashboard stats/lists.
  - Header `消息中心` was later upgraded again in the header notification/logo task above: it now opens the task notification popover instead of linking to a hash anchor.
  - Profile dropdown keeps real links only (`个人中心`, `消息中心`); removed no-op `设置` and `退出登录` from Employee shell until real routes/auth actions exist.
- Verification:
  - Browser: cost dialog table region had `scrollHeight 2614` and `clientHeight 391`, confirming vertical scroll; refresh click applied temporary `bg-sky-50`/inset ring class and then reverted.
  - Browser: home range buttons changed copy to `当前查看 今日 数据` / `当前查看 本月 数据`.
  - Browser: message center link navigated to `#employee-messages`; profile menu showed no `设置` or `退出登录`; stats card navigated to `/client-demos/cross-border/employee/customers`.
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass
  - `cd sentura/dashboard && pnpm exec eslint src/app/client-demos/cross-border/employee/page.tsx src/components/cross-border/employee-cost.tsx src/components/app-shell.tsx` -> pass
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> `315 passed, 0 failed`
  - `pnpm exec tsx scripts/test-week4-cost.ts` -> `32 passed, 0 failed`

Active 2026-06-15 Screening report/data-support task:

- User asks:
  1. Inspect all current Screening reports and identify which weak points lack data support because no result was found versus because the backend did not truly search. User specifically notes `贸易 / 海关记录` and `SEC / 财务公开文件` are almost empty.
  2. Remove `评分计算` from reports.
  3. In the `获客与背调` list, remove the `背调中` status filter and add score sorting.
- Must distinguish UI seed/persisted report content from actual OpenClaw agent session/tool-call evidence.
- Planned path:
  - Read current report data from `employee-data.ts`, browser persisted rows if needed, and recent `~/.openclaw/agents/cbe-buyer-screening/sessions/*.trajectory.jsonl`.
  - Update report UI layer list to hide/remove `评分计算`.
  - Update customer list controls: remove `背调中` filter button; add score high/low sort control.
  - Verify with TypeScript, eslint, CBE tests, and browser.
- Investigation so far:
  - Recent Screening trajectory files under `~/.openclaw/agents/cbe-buyer-screening/sessions/` were parsed.
  - Latest real run `d19d4da3-ff0b-43a7-9c7f-96c77f86eab4.trajectory.jsonl` actually called company registry, email domain, trade record, RDAP, official contact email, and scoring tools twice each for two targets.
  - Latest real run did not call `cbe_intel_sec_lookup`; its `finalPromptText` was an older prompt that did not mention `SEC/财务公开文件` or expanded `score_blocks`.
  - Trade/customs was truly searched in recent runs when enabled; observed outcomes include ImportYeti no match, ImportYeti same/near-name ambiguity, disabled-by-budget, or public-web fallback.
  - SEC/financial filing gaps are partly legitimate for private/non-US/non-filer companies, but the backend must still call `cbe_intel_sec_lookup` or record a clear not-applicable gap so the report does not look empty.
  - Next edit should remove report `scoring` layer, remove `评分计算` from the prompt/layer union, require SEC/financial lookup handling in the prompt, and add score sorting while removing `背调中` from list filters.
- Completed:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
    - Removed `scoring` from `ScreeningEvidenceLayer`.
    - Added explicit SEC/financial-file coverage-gap language to seed reports so missing SEC data has a reason, not a silent empty section.
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
    - No longer normalizes raw `scoring` evidence into a report layer.
    - Removed `scoring` from the allowed report `layer` contract.
    - Strengthened the hidden Screening prompt so every target must handle trade/customs and SEC/financial filing lookup or write a clear gap/not-applicable reason.
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
    - Removed `评分计算` from report evidence labels and ordering.
    - Removed `背调中` from the `获客与背调` quick status filters and the filter sheet status group.
    - Added `评分高到低` / `评分低到高` score sorting with reset chips and filter reset support.
  - `scripts/test-cross-border-agents.ts`
    - Added regression checks for no running status filter, score sorting, and no scoring calculation evidence layer.
  - `sentura/dashboard/src/components/app-shell.tsx`
    - Fixed a Base UI dropdown trigger warning by rendering a native `button`.
    - Replaced the profile dropdown label with a plain label block to avoid the Base UI `MenuGroupRootContext` runtime error.
    - Added explicit logo width style to satisfy Next Image aspect-ratio guidance.
- Verification:
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass
  - `cd sentura/dashboard && pnpm exec eslint src/components/app-shell.tsx src/app/client-demos/cross-border/employee/customers/page.tsx src/app/client-demos/cross-border/employee/_data/employee-data.ts src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts` -> pass
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> `320 passed, 0 failed`
  - `git diff --check` -> pass
  - Browser DOM check on `/client-demos/cross-border/employee/customers`: quick buttons are `全部/未背调/已评分/证据不足/评分高到低/评分低到高`; no `评分计算` appears on the page; `背调中` remains only as an individual row status, not as a filter option.
  - Browser logs after reload did not show new AppShell Base UI errors; the retrieved log list still contained earlier historical entries from before the fix.
  - Browser automation caveat: current Browser session focused report buttons but did not trigger the React detail-sheet click handler. Report-layer removal was validated by source/type/static tests.

Active 2026-06-15 UI polish/debug task from screenshot `/Users/purest./Desktop/截屏2026-06-15 22.04.38.png`:

- User wants three Employee-side fixes:
  1. Keep only the top global `正在读取后台任务进度` banner; remove the duplicate lower inline progress strip under the `获客与背调` header.
  2. Make the top-right `本月 API 成本` box scale on hover and be clickable. Clicking should open a detail view showing each cost-consumption record.
  3. In `筛选客户`, translate remaining English labels to Chinese while preserving real product terms such as `USB-C` and `OLED`; also debug the filter bug where selecting filters does not return the correct customer rows.

Initial implementation stance:

- Keep Employee UI business-facing and Chinese-first.
- Preserve the existing global hidden-task runner/status bar and remove only the duplicate page-local progress alert.
- Use existing `sentura-cost` API/store data for cost details when possible; avoid inventing billed spend.
- Fix filter matching using stable internal values plus localized display labels, rather than comparing localized strings to raw row values.

Latest verified product state from 2026-06-15:

- Current screenshot polish/debug task implementation status:
  - `sentura/dashboard/src/components/cross-border/employee-cost.tsx` now makes `本月 API 成本` a clickable hover-scaling card and opens a `本月 API 成本明细` dialog backed by `sentura.cost.events` records.
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx` no longer renders task progress/success as a page-local info notice; the global top `EmployeeTaskStatusBar` remains the only ongoing task-progress surface.
  - Customer filters now use stable canonical values for buyer type and products while displaying Chinese labels. Product terms such as `USB-C`, `OLED`, and `MagSafe` are preserved in display labels.
  - `foundAtInRange` now uses the current browser date instead of a hard-coded `2026-06-14`, fixing stale date-range filtering.
  - Regression coverage updated in `scripts/test-cross-border-agents.ts`; CE16 is now 22 checks and the full CBE static suite is 315/315.
  - Docs/memory sync updated in `docs/TESTS.md`, `docs/tests/tests-cross-border-ecommerce.md`, `docs/MEMORY.md`, and `docs/memory/cross-border-ecommerce/phase-1.md`.
  - Verification passed:
    - `cd sentura/dashboard && pnpm exec tsc --noEmit`
    - `cd sentura/dashboard && pnpm exec eslint src/components/cross-border/employee-cost.tsx src/app/client-demos/cross-border/employee/customers/page.tsx`
    - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> 315/315
    - `cd sentura/dashboard && pnpm build`
    - Browser: cost card opens per-call details, `USB-C 充电器` filter narrows to `Nordic Accessories AB`, lower duplicate progress notice absent, console errors 0.
- Employee UI is not just decorative. The verified path is UI action -> OpenClaw Gateway hidden employee session -> employee tools/MCP -> marker JSON -> UI row update.
- Completed Lead/Screening task status has been fixed again: completed tasks no longer show clock completion time; they show `完成耗时 mm:ss` plus business copy such as `背调员工已返回 N 份报告，客户评分已更新。`
- Employee hidden tasks now create user-attributed session keys for future runs: `agent:<agentId>:user:<employeeProfile.userToken>:<uuid>`.
- Cost monitoring now backfills real OpenClaw session-log usage into `~/.openclaw/sentura-cost/cost-YYYY-MM-DD.jsonl`, not just live diagnostic events. On 2026-06-15 it backfilled 64 CBE model-usage events.
- Current Employee-token-visible CBE cost after backfill: 47 events, `US$2.403581`, 830,240 tokens. Agent split: Lead `US$1.284564`, Screening `US$0.827415`, Accio memory `US$0.291602`.
- Lead budget estimate is now labeled `OpenAI/Tavily 官方价格口径` and uses current official gpt-5.5/Tavily assumptions with a safety multiplier; the old `搜索结果 US$0.018/条` formula is removed.
- 2026-06-15 latest budget adjustment: default Lead/Screening estimates are calibrated down toward recent real session-log costs. Lead source label is now `官方价格 + 近期真实用量`; Screening source label is `按近期真实用量校准`. Optional paid email/trade costs are small add-ons only when enabled, not part of the default scary estimate.
- Employee customer report detail has been expanded with `screeningReport` data: score blocks, evidence rows by category, coverage gaps, and a horizontal stacked score breakdown.
- 2026-06-15 latest report/status adjustment completed: completed task status now shows duration copy such as `完成耗时 mm:ss`; report details now show score weight, `单项得分`, gaps, and evidence layers for registry/RDAP/DNS/contact/public footprint/trade/SEC/Accio. Existing persisted browser rows are hydrated with the new seeded report shape when they lacked `screeningReport`.
- Employee-facing task history/run-id UI has been hidden/removed. Static `taskRuns` demo history data was removed from Employee data. Per-row `latestAgentRunId` remains internal metadata for later manager/admin views and live debugging but is not shown to ordinary Employee users.
- Lead Discovery passed direct Gateway E2E and Browser UI row-update verification.
  - Direct marker: `LEAD_CANDIDATES_JSON` with a buyer lead such as MobileBitz GB.
  - UI result: customer rows increased from 5 to 10 and notice said `获客员工已返回 5 个客户，已写入当前列表。`
- Screening passed direct Gateway E2E and Browser UI row-update verification.
  - Direct marker: `SCREENING_REPORTS_JSON`.
  - UI result: selected customer `SnapCases Ltd` updated to score `80/100`; notice said `背调员工已返回 1 份报告，客户评分已更新。`
- Accio Memory passed direct Gateway E2E and Browser UI row-update verification.
  - Direct marker: `ACCIO_SUMMARIES_JSON`.
  - UI result: memory row became `线下展会名片记录 - Accio 对话`, status `已分析`; notice said `记忆员工已返回 1 份结构化摘要，已更新当前列表。`
- Runtime currently checked in this cleanup pass:
  - Gateway is listening on `127.0.0.1:18789` / `[::1]:18789`.
  - Dashboard is listening on `:3000`.

Truthful limitations that must not be lost:

- Do not call the platform production-complete yet.
- Verified row writes are React client state; they do not yet persist across a full page reload as production data.
- The verified claim is business E2E through the local OpenClaw/Sentura runtime, not production persistence, multi-user concurrency, billing-grade cost capture, or cloud deployment.
- `sentura-cost` records only OpenClaw `model.usage` events. External public search, email validation, and trade-data provider costs are not yet fully ingested as real cost events.
- Monthly API cost UI should show recorded actual spend only. It now reads `sentura-cost` records including session-log backfill; do not restore demo fallback spend.
- Lead estimated cost is a pre-submit budget/reserve, not historical billed spend. It should remain labeled `预算预估` and cite the official-price assumption source.

Deprecated continuation files:

- `outputs/resume_card.md` has been removed from the active read path.
- Full old logs were archived only for emergency lookup:
  - `outputs/archive/task_handoff_legacy_2026-06-15.md`
  - `outputs/archive/resume_card_legacy_2026-06-15.md`
- Do not load archive files by default; they contain stale intermediate states and can mislead a new chat.

## Task Introduction

The user wants Sentura's cross-border Employee platform to be genuinely runnable through the backend OpenClaw/Sentura employee path, not just a polished UI. They also asked to simplify continuation context so future chats do not waste tokens or get misled by old history.

Intended outcome:

- One active continuation file: `outputs/task_handoff.md`.
- A concise current snapshot at the top for new chats.
- Old handoff/resume logs excluded from default reading.
- `docs/MEMORY.md` kept as historical project memory/index only, not as the default continuation source.

Hard constraints:

- Preserve the real OpenClaw hidden employee execution path.
- Do not replace business execution with dashboard-only precomputed shortcuts.
- Keep CBE employees sandboxed with `sandbox.mode: "non-main"` unless the user explicitly approves a temporary unsafe local-only override.
- Preserve exact distinctions between UI/demo readiness, live local E2E verification, and production readiness.

## Workspace And Environment

- Repo: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Active handoff: `outputs/task_handoff.md`
- Historical project memory index: `docs/MEMORY.md`
- Legacy archived logs:
  - `outputs/archive/task_handoff_legacy_2026-06-15.md`
  - `outputs/archive/resume_card_legacy_2026-06-15.md`
- Dashboard app: `sentura/dashboard`
- Main Employee routes:
  - `/client-demos/cross-border/employee`
  - `/client-demos/cross-border/employee/customers`
  - `/client-demos/cross-border/employee/memory`
- Runtime ports:
  - OpenClaw Gateway: `18789`
  - Dashboard: `3000`
- Key files for future CBE work:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
  - `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`
  - `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
  - `sentura/extensions/sentura-cost/index.ts`
  - `sentura/extensions/sentura-cost/src/session-log-backfill.ts`
  - `sentura/extensions/sentura-cost/src/types.ts`
  - `sentura/agents/cbe-lead-discovery/config.json5`
  - `sentura/agents/cbe-buyer-screening/config.json5`
  - `sentura/agents/cbe-accio-memory/config.json5`
  - `scripts/sentura-setup.sh`
  - `scripts/test-cross-border-agents.ts`

## Task Flow

Completed simplification flow:

1. Evaluated active continuation files.
2. Determined that `resume_card.md` and `task_handoff.md` duplicated each other and could drift.
3. Determined that `docs/MEMORY.md` is a long-term project memory matrix, not a current continuation handoff.
4. Archived old verbose continuation files for emergency lookup.
5. Replaced the active handoff with a concise current-state file.
6. Updated `docs/MEMORY.md` so continuation starts with only `outputs/task_handoff.md`.

Future handoff-update rule:

- Keep this file short.
- Update the top snapshot after major runtime/product status changes.
- If a task becomes large and unfinished, add only the current task's essential context, commands, verification results, blocker, and next steps.
- Move stale or superseded detail to archive instead of appending indefinitely.

## Progress So Far

Continuation cleanup completed:

- Archived old verbose logs:
  - `outputs/archive/task_handoff_legacy_2026-06-15.md`
  - `outputs/archive/resume_card_legacy_2026-06-15.md`
- Replaced `outputs/task_handoff.md` with this concise handoff.
- Removed `outputs/resume_card.md` from the active continuation set.
- Updated `docs/MEMORY.md` continuation rules to avoid default loading of `resume_card.md` or full historical memory.
- Rechecked ports during cleanup:
  - Gateway: listening on `18789`.
  - Dashboard: listening on `3000`.

Previously verified CBE implementation highlights:

- Hidden employee runner creates sessions for Lead, Screening, and Accio.
- Parser accepts marker JSON and real-world field variants.
- Persisted client store keeps customer rows and task records across route navigation.
- Global Employee task status bar shows ETA/countdown/progress and terminal success/failure.
- Cost UI no longer substitutes demo spend when live cost events are empty.
- Cost UI now shows real session-log-backed model cost after Gateway plugin backfill.
- CBE agent source configs and setup scripts now use `operationScope` instead of demo/simulated scope labels for CBE employees and default to `openai/gpt-5.5`.

Important prior checks that passed:

- `pnpm exec tsx scripts/test-cross-border-agents.ts` -> `311 passed, 0 failed`
- `pnpm exec tsx scripts/test-week4-cost.ts` -> `32 passed, 0 failed`
- `pnpm --filter @sentura/mcp-cross-border-intel test`
- `cd sentura/dashboard && pnpm exec tsc --noEmit`
- `cd sentura/dashboard && pnpm exec eslint ...changed dashboard files...` -> no errors; one pre-existing `_nonce` warning in `src/lib/gateway/client.ts`
- `scripts/start-sentura-demo.sh restart` -> Gateway PID `50126`, Dashboard PID `49957` at verification time
- Browser checks: real cost around `US$2.40`, no demo cost, no stuck `正在读取后台任务进度...`, Lead budget drawer shows official gpt-5.5/Tavily assumptions, no console errors.
- Browser checks for desktop and 390px mobile Employee routes.
- Direct Gateway and Browser UI live E2E for Lead, Screening, and Accio marker flows.
- 2026-06-15 latest browser verification:
  - `/client-demos/cross-border/employee/customers`: Mobile Lab UK report shows `评分维度拆解`, `权重`, `单项得分`, `证据缺口`, and evidence categories for company registry, domain/RDAP, email/DNS, official contact, public footprint, trade/customs, SEC/financial filings, Accio behavior.
  - Existing local persisted rows without `screeningReport` now hydrate into the new report detail without clearing browser storage.
  - Lead default budget estimate observed at about `US$0.56`; bulk Screening default estimate observed at about `US$0.16`.
  - Employee home shows `高可信客户` and no longer shows `最近完成`, `任务历史`, or visible `run-screen`.
- 2026-06-15 latest checks:
  - `cd sentura/dashboard && pnpm exec tsc --noEmit` -> pass
  - `cd sentura/dashboard && pnpm exec eslint src/app/client-demos/cross-border/employee/customers/page.tsx src/app/client-demos/cross-border/employee/page.tsx src/app/client-demos/cross-border/employee/_data/employee-data.ts src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts src/stores/use-cbe-employee-store.ts src/components/cross-border/employee-task-status.tsx` -> pass
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` -> `311 passed, 0 failed`
  - `pnpm exec tsx scripts/test-week4-cost.ts` -> `32 passed, 0 failed`

## Current State

What works:

- The current local app has a real CBE Employee backend path through OpenClaw Gateway and the three CBE employees.
- Gateway and Dashboard are currently listening.
- Lead, Screening, and Accio have been verified end to end in local live UI/runtime.
- Employee cost monitoring is no longer stuck at zero in the verified local runtime; real CBE model usage is recorded under `~/.openclaw/sentura-cost/cost-2026-06-15.jsonl`.
- Continuation context is now reduced to one active file.

What remains incomplete or unverified:

- Production persistence for customer rows, screening reports, Accio imports, memory previews, handoff records, and agent-run history.
- Durable billing-grade cost ingestion for non-model external providers.
- Current cost mismatch explanation: recent real runs mostly spent model cost plus public/free lookup cost. Paid email validation only triggers after a concrete email is found and user enables it; ImportYeti returned `requestCost: 0` in inspected runs; external provider costs still need first-class cost events for billing-grade all-in spend.
- Broader production-route cleanup: some pages still live under `/client-demos/...` and some Accio sample-upload scaffolding remains from the demo era.
- Production deployment, multi-user concurrency, tenant data isolation under real DB persistence, and cloud/runtime hardening.
- Full reload persistence of Employee UI row updates.

What to avoid:

- Do not reload old archive handoffs unless debugging a specific historical claim.
- Do not treat old `sandbox.mode: "off"` notes as current unless live config is freshly rechecked.
- Do not describe API cost numbers as real billed spend unless backed by current `sentura-cost` events.
- Do not call the platform production-ready just because local UI E2E passed.

## Next Steps

For the next CBE product phase:

1. Add production persistence for customer rows, screening reports, Accio memory summaries, task records, and agent-run/session metadata.
2. Re-run setup and live config checks before any new live E2E:
   - `./scripts/sentura-setup.sh`
   - verify CBE agents have `sandbox.mode: "non-main"` and required `tools.alsoAllow` / `tools.sandbox.tools.alsoAllow`.
3. Start or verify runtime:
   - Gateway on `18789`
   - Dashboard on `3000`
4. Run focused tests:
   - `pnpm exec tsx scripts/test-cross-border-agents.ts`
   - `pnpm --filter @sentura/mcp-cross-border-intel test`
   - `cd sentura/dashboard && pnpm exec tsc --noEmit`
5. Browser-verify the Employee home/customers/memory routes on desktop and mobile.
6. If changing business execution, verify all three marker flows again:
   - `LEAD_CANDIDATES_JSON`
   - `SCREENING_REPORTS_JSON`
   - `ACCIO_SUMMARIES_JSON`
7. For exact all-in spend, add first-class cost events from `cross-border-intel` tools for Tavily/search, email validation, and trade-data providers.

For future continuation hygiene:

1. New chats should read only `outputs/task_handoff.md` first.
2. Read `docs/MEMORY.md` only when a specific historical lookup is needed.
3. Keep this handoff concise; archive stale detail instead of appending old history.
