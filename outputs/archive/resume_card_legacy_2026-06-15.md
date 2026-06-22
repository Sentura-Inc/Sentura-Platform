# Resume Card

## Current Active Task 2026-06-15 — API Cost Accuracy Audit

User asked whether the Employee UI's monthly API cost is real-time/real, whether the Lead Discovery estimated cost is truly calculated from call-cost information, and to ensure the numbers are accurate.

Workspace: `/Users/purest./Documents/Sentura/Sentura-Platform`.

Final verified state in this task:

- Live Gateway RPC for the current local month returned no real cost events:
  - employee token `69ddf60b-84ab-4fe3-aedf-5d1b8bc1d502`
  - month start sent as `2026-05-31T16:00:00.000Z` (Asia/Shanghai June 1 midnight)
  - `sentura.cost.events` by employee token: `0`
  - `sentura.cost.events` all users: `0`
  - `sentura.cost.summary`: `totalCalls=0`, `totalTokens=0`, `totalCostUsd=0`, `unpricedCalls=0`
- `/Users/purest./.openclaw/sentura-cost` exists but has no `cost-*.jsonl`; current local month has no persisted real API cost events.
- `sentura-cost` captures only OpenClaw `model.usage` events. External public search, email validation, and trade-data provider costs are not yet recorded as real cost events.
- Patched:
  - `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
  - `outputs/task_handoff.md`
- UI now shows actual recorded cost as `US$0.00` / `暂无实时记录` instead of the old demo fallback `US$43.76` / `演示估算`.
- Lead estimate is explicitly labeled `寻找客户预算预估` / `提交前预算模型`. It remains a configurable budget formula, not a calculation from real historical call costs.
- Browser verified:
  - `/client-demos/cross-border/employee`: `暂无实时记录`, `US$0.00`, no `演示估算`, no `US$44`/`US$43.76`, no console errors.
  - `/client-demos/cross-border/employee/customers`: top mini cost `本月 API 成本 / US$0.00 / 上限 US$120 / 后台：已连接`.
  - Lead drawer: `寻找客户预算预估`, `提交前预算模型`, `US$4.99`, formula text including `18 组搜索 × 10 条上限，最多保留 50 个候选`, and "预计值不会写入本月 API 成本".
- Verification passed:
  - `cd sentura/dashboard && pnpm exec tsc --noEmit`
  - `pnpm exec tsx scripts/test-cross-border-agents.ts` => `310 passed, 0 failed`
  - `pnpm exec tsx scripts/test-week4-cost.ts` => `26 passed, 0 failed`
  - `cd sentura/dashboard && pnpm exec eslint src/components/cross-border/employee-cost.tsx src/app/client-demos/cross-border/employee/_data/employee-data.ts`

Truthful answer to preserve: monthly API cost is now accurate for recorded `sentura-cost` model-usage events, and currently equals `US$0.00` because no real events exist. Lead Discovery estimated cost is not real billed spend; it is a pre-submit budget model.

## Current Active Task 2026-06-15 — CBE Employee Task Progress Persistence Fix

User reported three current production-demo problems:

1. `寻找客户` / `背调` only shows `正在读取后台任务进度...`; needs visible progress, approximate completion time, and countdown.
2. Running Lead/Screening tasks disappear or appear to stop when navigating to `记忆整理` or another page.
3. Runs sometimes disappear after searching for a while without Lead/Screening results; failure/result state must be diagnosed and surfaced.

Workspace: `/Users/purest./Documents/Sentura/Sentura-Platform`.

Key files to read first:

- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`

Latest hypothesis before code patch: task state is page-local, so route unmount clears progress and result handling. Fix should keep OpenClaw hidden employee execution, add a cross-route/client-persistent task state and ETA/countdown, and show terminal success/failure instead of disappearing.

Status: implemented and verified.

Changed files:

- `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
- `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`
- `sentura/dashboard/src/components/app-shell.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `scripts/test-cross-border-agents.ts`
- docs/memory/test files listed in `outputs/task_handoff.md`

Verification:

- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 310/310.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm build`: PASS, with only existing Next workspace-root warning.
- Browser desktop customers/memory checks: PASS, no console errors.
- Browser 390px customers check: PASS, no horizontal overflow, no console errors.
- Final live submit buttons were not clicked in this pass to avoid fresh external search/LLM/provider spend.

Current behavior: Lead/Screening tasks now create global persisted task records, show ETA/countdown/progress through the Employee shell, remain visible when navigating to `记忆整理`, and retain terminal success/failure with session keys instead of disappearing.

User language: Continue all conversation, status updates, and final answers in Chinese. Keep this card and `outputs/task_handoff.md` primarily in concise English for token efficiency; preserve exact Chinese product, customer, or UI wording when it matters.

## Current Goal

Continue the Sentura cross-border e-commerce Employee backend/live verification from the latest user screenshot. The immediate current question is why Lead live E2E still fails after the Docker/sandbox/tool-policy/label/idempotency repairs, and whether manual demo verification is useful right now.

## Latest Current-Status Recheck 2026-06-15

- User asked whether the Sentura cross-border e-commerce platform is complete now, whether the pages/functions really reach backend links, and whether actual runtime capability can be triggered.
- Fresh runtime check: Gateway is listening on `18789` (PID `8549`, `openclaw`) and dashboard is listening on `3000` (PID `90431`, `next-server (v16.2.2)`). `curl http://localhost:3000/client-demos/cross-border/employee` returned HTTP `200`.
- Fresh tests: `pnpm exec tsx scripts/test-cross-border-agents.ts` PASS, `301 passed, 0 failed`; `pnpm --filter @sentura/mcp-cross-border-intel test` PASS, `17 passed, 0 failed`.
- Code status: page/runner/config wiring exists. Employee hidden runner creates sessions for Lead, Screening, and Accio and parses `LEAD_CANDIDATES_JSON`, `SCREENING_REPORTS_JSON`, and `ACCIO_SUMMARIES_JSON`. CBE configs use embedded OpenClaw runtime, `sandbox.mode: "non-main"`, and additive tool allowlists.
- Latest persisted runtime evidence: Lead latest session `110aaf6a-e002-43c2-9b40-f730fd51cb98` failed before tool calls/marker output with `terminated` / `non_deliverable_terminal_turn`. Screening latest session `c459df01-d244-458f-a2a4-0d5d91132883` executed real `cross-border-intel` MCP tools, then failed before final `SCREENING_REPORTS_JSON` marker output.
- Truthful status: page/demo layer and backend triggering are real, but full business E2E is not complete. Do not describe it as finished or reliably runnable until Lead, Screening, and Accio all return marker JSON and update UI rows.

## Active Repair Phase 2026-06-15

- User now asked to start fixing and ensure the complete business flow runs through.
- Required completion: Lead Discovery, Screening, and Accio Memory all execute through Sentura/OpenClaw employee runtime, return required marker JSON, and update Employee UI rows.
- Constraints: keep OpenClaw runtime, keep CBE sandbox `non-main`, do not replace the business flow with dashboard-only precomputed API shortcuts.
- Planned sequence: direct Gateway reproduction first, patch smallest runtime/prompt/runner path, run focused checks, then full UI/browser verification.
- Patch now applied in `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - Lead/Screening/Accio prompts now require backend automation behavior, real tool use, marker-only final JSON, and no `web.run`/browser/shell/citation drift.
  - Lead no longer includes a concrete empty `{"leads":[]}` sample that could be copied without tool use.
  - Parser now strips JSON code fences and accepts real-world field variants such as string evidence, `summary`, `source_url`, `sourceUrl`, `score`, `riskTier`, and Accio `memory_preview`.
  - Post-patch checks pass: `scripts/test-cross-border-agents.ts` 301/301, `@sentura/mcp-cross-border-intel` 17/17, dashboard `pnpm exec tsc --noEmit`, and `git diff --check` for touched files.
  - Gateway is still listening on `18789`; dashboard is still listening on `3000`.
  - Direct Gateway E2E through patched dashboard runner passed:
    - Lead `agent:cbe-lead-discovery:dashboard:11343d5f-ff17-4d67-bdb8-4b2d3c02dfe2` returned `LEAD_CANDIDATES_JSON` with MobileBitz GB; trajectory success with `web_fetch`.
    - Screening `agent:cbe-buyer-screening:dashboard:c5e081e6-9d6a-411a-a79d-8a1324dedc86` returned `SCREENING_REPORTS_JSON`, normalized score 75 / UI tier medium; trajectory success with six `cross-border-intel__*` tools.
    - Accio `agent:cbe-accio-memory:dashboard:1bd352a2-5f5a-4ab8-b00c-1803c75a0b8b` returned `ACCIO_SUMMARIES_JSON` for `mem-accio_conv_001`; trajectory success with Accio parser and summarizer tools.
  - Browser UI row-update verification also passed:
    - UI was reconnected after Gateway restart; header showed `后台：已连接`.
    - Lead drawer submitted from Customers page after reducing scope to 1 product / 1 buyer / 1 country / max 5 results; rows increased 5 -> 10 and notice said `获客员工已返回 5 个客户，已写入当前列表。` New rows included `SnapCases Ltd`.
    - Latest UI Lead trajectory success: `agent:cbe-lead-discovery:dashboard:285bde06-8485-459d-a3eb-409fbb079ff1`, tools `web_fetch`, marker `LEAD_CANDIDATES_JSON_START`.
    - UI Screening selected `SnapCases Ltd`, submitted `批量背调` -> `确认背调`; notice said `背调员工已返回 1 份报告，客户评分已更新。`; SnapCases changed to `80/100`.
    - Latest UI Screening trajectory success: `agent:cbe-buyer-screening:dashboard:5f325e6f-09aa-4fa1-adac-f96fee4dec67`, tools include six `cross-border-intel__*` calls.
    - UI Memory clicked `线下展会名片记录` -> `开始分析`; notice said `记忆员工已返回 1 份结构化摘要，已更新当前列表。`; row became `线下展会名片记录 - Accio 对话`, status `已分析`.
    - Latest UI Accio trajectory success: `agent:cbe-accio-memory:dashboard:4fd4aa8b-a29c-4335-b3e0-4d2c2cc21800`, tools `cross-border-intel__cbe_intel_parse_accio_chat` and `cross-border-intel__cbe_intel_summarize_accio_chat`.
  - Runtime was stabilized into detached background processes:
    - Gateway wrapper PID `24028`, actual listener PID `24103` on `18789`, log `/tmp/sentura-gateway-final.log`.
    - Dashboard wrapper PID `24029`, actual listener PID `24068` on `3000`, log `/tmp/sentura-dashboard-final.log`.
    - Final fresh Browser tab confirmed `/client-demos/cross-border/employee/customers` shows `后台：已连接`.
  - Limitation to mention honestly: Employee demo row writes are React client state and do not persist across full page reload yet. The verified claim is true UI -> OpenClaw employee -> tools/MCP -> marker JSON -> UI row update, not production persistence.

## Current State

- 2026-06-15 user resumed with screenshot `/var/folders/9q/vtk4m50x0_1cp2cjpjdtz20h0000gn/T/TemporaryItems/NSIRD_screencaptureui_Ut8yLR/截屏2026-06-15 18.12.12.png`.
- Screenshot stop point: focused CBE assertions had advanced to 301/301; the user/customer page had been reloaded; Lead retry was submitted; Browser polling hit a URL policy limit; local Gateway RPC reproduction added the required `idempotencyKey`; minimal direct Lead E2E submitted session `agent:cbe-lead-discovery:dashboard:51e98e2a-c67a-4d10-9142-a0b41d54256a` and was waiting for a marker or hard failure.
- Actual session follow-up checked from disk after the screenshot: that session maps to `/Users/purest./.openclaw/agents/cbe-lead-discovery/sessions/039c5599-fd8c-46f6-a83a-280d120b12dc.jsonl`; it is no longer pending. `sessions.json` marks it `failed`, runtime about 21s.
- Transcript evidence: the run received the full Lead task with `idempotencyKey`, selected `openai/gpt-5.5`, then assistant only replied `收到，我会按正式获客任务执行：只查公开来源、只返回下游买家公司、不做任何外联。`; the assistant message has `stopReason: "error"` and `errorMessage: "terminated"`. No `LEAD_CANDIDATES_JSON` marker was produced.
- Trajectory evidence for that run: item lifecycle started/completed counts are 0. That means the latest failure did not reach real tool execution; it ended during/around the model response before `web_search`, `web_fetch`, or MCP tools were actually called.
- Current port check after reading the screenshot: Gateway is still listening on `127.0.0.1:18789`, but dashboard port `3000` is not listening. Manual UI demo cannot be verified until the dashboard dev server is restarted.
- Current diagnosis: old blockers are not the active blocker anymore. Docker, sandbox image, Sentura startup plugins, tool-policy `alsoAllow`, fixed session labels, and required `idempotencyKey` have all been addressed. The active live blocker is model-run completion/marker production for the Lead employee under the sandboxed Gateway path.
- 2026-06-15 latest resume screenshot (`codex-clipboard-a77bc721-9700-48ee-a634-555615a7eafb.png`) shows the prior turn had identified the real sandbox tool-policy bug: `tools.profile: "minimal"` filtered out `web_search` / `web_fetch` / `group:plugins`, and later `tools.allow` could not add them back. The fix is to use `tools.alsoAllow` and `tools.sandbox.tools.alsoAllow` for the three CBE employees.
- Current code check confirms this source-side repair is present in:
  - `sentura/agents/cbe-lead-discovery/config.json5`
  - `sentura/agents/cbe-buyer-screening/config.json5`
  - `sentura/agents/cbe-accio-memory/config.json5`
  - `scripts/sentura-setup.sh`
  - `scripts/sentura-setup.ps1`
  - `scripts/test-cross-border-agents.ts`
- `docker` is now available at `/usr/local/bin/docker`, and `openclaw-sandbox:bookworm-slim` exists locally, so the older Docker/sandbox-image blocker should not be treated as current until rechecked.
- Before live E2E, run setup to rewrite the live OpenClaw config from source/setup, restart Gateway, verify live CBE tool policies, and only then retry Lead/Screening/Accio.
- Setup/restart/runtime verification completed in this continuation:
  - `./scripts/sentura-setup.sh`: PASS; patched all CBE agents and wired Sentura extensions.
  - Live `~/.openclaw/openclaw.json`: all three CBE agents have `sandbox.mode: "non-main"`, `tools.profile: "minimal"`, top-level `tools.alsoAllow`, and `tools.sandbox.tools.alsoAllow`.
  - Gateway restarted on `18789`; startup logs show Sentura runtime plugins registered, including `sentura-cost` and `sentura-mcp-health`.
  - `sentura.cost.events`, `sentura.mcp.health.list`, `sentura.approval.requests.list`, and `sentura.provisioner.requests.list` respond over live Gateway RPC.
  - Focused tests pass: `scripts/test-cross-border-agents.ts` 297/297, `@sentura/mcp-cross-border-intel` 17/17, `scripts/test-week2.ts` 148/148.
  - Important nuance: no-message `tools.effective` sessions do not connect MCP, so they initially omit `cross-border-intel__*`. Minimal real warm runs for Lead, Screening, and Accio all replied `READY` and then exposed `cross-border-intel__*`.
- User resumed with `/Users/purest./Desktop/截屏2026-06-15 16.10.39.png` and asked to read the handoff, memory index, and image, then continue the previous task.
- Screenshot shows the previous run had already fixed the `sentura.cost.events`/Gateway plugin-startup issue, added hook permissions for `sentura-audit` and `sentura-experience-extraction`, re-ran setup/tests, restarted Gateway, and passed direct WebSocket RPC smoke for cost/health/MCP/audit/approval/provisioner.
- Screenshot stopping point: in-app Browser verification was underway. Customer and memory pages were connected to Gateway with no console errors and no visible free-form chat input; the home page first-sample connection handshake still needed recheck, plus the two main drawers needed interaction checks.
- This chat completed that safe verification:
  - dashboard on `3000` and Gateway on `18789` were already running;
  - live config has Sentura plugin load paths/entries, CBE `sandbox.mode: "non-main"`, sandbox allowlists, and hook `allowConversationAccess` for audit/experience extraction;
  - Gateway RPC smoke passed for cost, health, MCP health, audit, approval, and provisioner;
  - Browser desktop and 390px checks passed for home/customers/memory with no console errors, no horizontal overflow on mobile, and no visible free-form chat;
  - `寻找客户` and `添加新记录` drawers opened; Lead estimate changed from `US$4.99` to `US$6.07` when a target option was changed.
- Continue in Chinese. Do not click final task-submit buttons that would trigger external search/LLM/provider calls unless the user explicitly approves.
- User explicitly approved clicking final submit buttons that trigger real external search, LLM, or provider calls. This live E2E can proceed.
- Runtime rechecked before live E2E: dashboard is listening on `3000`; Gateway is listening on `127.0.0.1:18789` / `[::1]:18789`.
- First live Lead Discovery submit attempt:
  - UI click on `提交获客任务` returned `隐藏员工任务提交失败。`
  - Direct Gateway reproduction with the same minimal Lead payload created `agent:cbe-lead-discovery:dashboard:99908386-9c5a-4b38-8c7b-a4c49013b6be`, but the run failed before reply with `Sandbox mode requires Docker, but the "docker" command was not found in PATH`.
  - `docker`, `podman`, Docker Desktop, OrbStack, and Podman Desktop are not installed/found.
  - Current CBE agents are correctly configured as `sandbox.mode: "non-main"`, so live employee runs are blocked until Docker/sandbox runtime exists. Do not silently set sandbox off; that would bypass the Sentura safety boundary.
- User now asked: "安装/启动 Docker 后，继续跑完整 live E2E".
- Fresh recheck at the start of this continuation: `docker` command is still absent; `/Applications/Docker.app`, `/usr/local/bin/docker`, and `/opt/homebrew/bin/docker` were not found; machine is macOS `26.5` on `arm64`.
- Docker Desktop install/start completed in this continuation:
  - `/Applications/Docker.app` installed from the official Apple Silicon DMG.
  - `~/Library/pnpm/bin/docker` links to `/Applications/Docker.app/Contents/Resources/bin/docker`.
  - `~/.docker/cli-plugins/docker-compose` links to the bundled compose plugin.
  - `~/Library/pnpm/bin/docker-credential-desktop` and `docker-credential-osxkeychain` link to bundled credential helpers.
  - `docker --version`: Docker `29.5.3`.
  - `docker compose version`: Docker Compose `v5.1.4`.
  - `docker info`: OK against Docker Desktop `4.77.0`, Engine `29.5.3`, `linux/arm64`.
- Gateway was restarted after Docker install; `/tmp/sentura-gateway-live-e2e.log` shows Sentura runtime plugins registered.
- `docker run --rm hello-world`: PASS after adding credential-helper symlinks.
- Gateway was then started in a persistent terminal session and is stable/ready on `18789`.
- First post-Docker UI Lead submit failed immediately for a new reason: Gateway rejected `sessions.create` with `label already in use: CBE Employee lead discovery`.
- Patched `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts` so Lead, Screening, and Accio hidden tasks use unique labels instead of fixed labels.
- Verification after patch: `cd sentura/dashboard && pnpm exec tsc --noEmit` PASS; `git diff --check` on the runner file PASS.
- Retried Lead submit after the label patch. It reached sandbox startup, then timed out in the UI because Gateway logged: `Sandbox image not found: openclaw-sandbox:bookworm-slim. Build it with scripts/sandbox-setup.sh before enabling Docker sandboxing.`
- Confirmed `openclaw/scripts/sandbox-setup.sh` builds that image from `openclaw/scripts/docker/sandbox/Dockerfile`.
- Built sandbox image successfully:
  - `cd openclaw && bash scripts/sandbox-setup.sh`: PASS, built `openclaw-sandbox:bookworm-slim`.
  - `docker images openclaw-sandbox:bookworm-slim`: image present, disk usage about `337MB`.
  - `docker run --rm openclaw-sandbox:bookworm-slim python3 --version`: `Python 3.11.2`.

## Next 3 Actions

1. Fix the Lead employee execution path so a sandboxed live run either goes straight to `web_search`/`web_fetch` or returns the required empty-but-valid `LEAD_CANDIDATES_JSON` marker.
2. Fix Screening final-response/marker delivery after successful MCP tool calls, then verify the UI writes report rows from `SCREENING_REPORTS_JSON`.
3. Run Accio full UI marker E2E after Lead/Screening are stable; do not label the platform demo-ready until all three markers update UI rows.

## Working Set

- `outputs/resume_card.md`
- `outputs/task_handoff.md`
- `docs/MEMORY.md`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/**`
- `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
- `sentura/dashboard/src/lib/gateway/**`

## Last Verified

- Date: 2026-06-15
- Check: Gateway and dashboard both currently listening; CBE employee page route HTTP 200; CBE focused assertions PASS 301/301; cross-border-intel tests PASS 17/17; latest Lead real session fails before tool/marker output; latest Screening real session calls MCP tools but fails before marker output. Full Employee UI Lead/Screening/Accio marker E2E still pending.
- Context rule: update this card and `outputs/task_handoff.md` before long scans, risky edits, long-running commands, extended debugging loops, or visible context pressure.
