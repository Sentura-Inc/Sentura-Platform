# Sentura CBE Task Handoff

Default continuation rule: read `outputs/resume_card.md` first. Then read this file only if deeper context is needed. Use `docs/MEMORY.md` as an index when a specific prior session is required.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep exact Chinese UI labels unchanged when relevant.

## Current Resume Snapshot

Date: 2026-06-26

Latest user request: Implement dynamic Lead/Screening task time growth so long legitimate tasks do not fail because fixed estimates are too short; account for Screening fan-out, bursts, and coordinator queue behavior.

Latest local implementation:

- Problem:
  - One Screening child is now roughly 3 minutes.
  - Multi-target Screening should grow by fan-out waves, not stay near a fixed 4-6 minute window.
  - Lead tasks should grow with requested target count and query breadth.
  - DB-backed task refresh/queued coordinator records must not shrink the wait window after task creation.
- Code changes:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
    - Added task timing constants.
    - Lead estimate scales by product/buyer/country query count, requested target count, max result scan count, and top-up overhead.
    - Screening estimate uses `SCREENING_SINGLE_TARGET_DURATION_MS = 180_000` and `SCREENING_CHILD_CONCURRENCY = 3`, with wave/drain and paid-source overhead.
    - Timeout budget = estimate + max(3 minutes, 50% grace), clamped to 6-30 minutes.
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
    - Lead/Screening create requests persist `metadata_json.estimated_ms` and `metadata_json.timeout_ms`.
    - Task hydration uses stored timing first, then reconstructs estimates from metadata.
    - Queued records add `workload_admission.estimated_start_seconds` to local `timeoutMs`/`deadlineAt`.
  - `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
    - Lead create request accepts `metadata_json`.
  - `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts`
    - Lead run preflight and inserted agent run preserve timing metadata alongside `query_config`, target counts, and workload metadata without adding timing to the Lead scope fingerprint.
  - Static regressions:
    - `scripts/test-cross-border-agents.ts` adds Lead scaling, Screening fan-out wave, and timeout cap checks.
    - `scripts/test-cross-border-phase2-store.ts` adds timing metadata and queued coordinator-delay checks.
- Verification:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 427/427.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 220/220.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- Docs updated:
  - `docs/TESTS.md`
  - `docs/tests/tests-cross-border-phase2.md`
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-2.md`
- Deployment status:
  - CE33 is local only. It has not been deployed to ECS in this session.
  - Next production step: commit/push, ECS pull/build/restart, then public Employee/Admin and task-create smoke.

Previous operational fix:

- Failed production run:
  - `agent_run_id`: `run_e9dc249b-d1b0-4243-81c2-7eadd5f1549f`
  - `target_summary`: `USB-C charger / US`
  - `session_key`: `agent:cbe-lead-discovery:user:0c01d63d-de13-4478-a6a7-af3680b979b6:cab9a635-ee0f-4216-82eb-c5c7e9647f8c`
  - lead run: `lead_run_58f1040e-4fc5-45d7-8fcc-c4f94859ff68`
- Root cause on ECS: CE31's transient 2MB `chat.history.maxChars` setting exceeded OpenClaw Gateway's validator cap of 500,000 chars, so Dashboard polling failed immediately before reading the completed employee result.
- Evidence:
  - OpenClaw session file `/root/.openclaw/agents/cbe-lead-discovery/sessions/22929183-100d-4872-9a65-06906b1e3f16.jsonl` contained `LEAD_CANDIDATES_JSON_START/END` with 3 leads.
  - Session file size was about 242KB, inside the Gateway-safe 500KB limit.
- Code fix:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts` keeps `HIDDEN_TASK_TRANSCRIPT_MAX_CHARS = 500_000`.
  - `scripts/test-cross-border-agents.ts` asserts the 500KB cap and `client.getTranscript()` `maxChars` wiring.
- Verification:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 424/424.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - ECS `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 424/424.
  - ECS `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - ECS `pnpm --dir sentura/dashboard build`: PASS.
  - ECS services after restart: `sentura-dashboard`, `nginx`, and root `openclaw-gateway` active.
  - Public `https://app.sentura.ai/employee`: 200 with Employee shell.
  - Public `https://admin.sentura.ai/admin/login`: 200 with Admin shell.
- Production recovery:
  - completed `run_e9dc249b-d1b0-4243-81c2-7eadd5f1549f` through the Dashboard Lead completion route/store path after normalizer-equivalent cleanup;
  - did not hand-write lead/source rows with raw SQL;
  - RDS now has `agent_runs.status = completed`, `current_stage = lead_results_saved`, no error code/message, `lead_runs.status = completed`, 3 saved candidates, 12 sources, active Lead scope 0;
  - Employee API queries show NEM Electronics Corp, Entro Wholesale, and Mighty Wireless Wholesale Cellphone Accessories.
- Server repo:
  - ECS is clean at `1fd474e4` after restoring build-generated `sentura/dashboard/next-env.d.ts`.
- Docs/tests updated with CE32:
  - `docs/TESTS.md`;
  - `docs/tests/tests-cross-border-phase2.md`;
  - `docs/MEMORY.md`;
  - `docs/memory/cross-border-ecommerce/phase-2.md`.

Previous operational fix:

- Root cause on ECS: the employee produced both an original Adorama report and a repair result, but Dashboard did not read the final repair payload because the OpenClaw session was about 333KB and the hidden runner requested only 300KB from `chat.history`.
- Failed production run `run_0ce71f21-efbc-43be-909d-6309c7039548` with session file `/root/.openclaw/agents/cbe-buyer-screening/sessions/8f062995-9c46-43ce-bf7a-5eb985b760d3.jsonl`.
- Code fix added embedded fenced-JSON parsing and final full transcript reread; CE32 later corrected the transient 2MB cap to the Gateway-safe 500KB cap.
- Recovered Adorama report `cbe_sr_20260626_adorama_001`, score `59`, risk `high_risk`, 22 evidence rows, 6 score blocks, 6 address locations, active Screening count `0`.

Previous operational fix:

- Root cause on ECS: OpenClaw produced the Cellairis Screening report before Dashboard timeout, but `chat.history`/session JSONL exposed raw nested transcript rows shaped like `{ message: { role, content } }`. The hidden runner only read top-level `role/content`, so it saw no assistant text and never parsed the marker payload or triggered CE29 repair.
- Failed/recovered production run:
  - `agent_run_id`: `run_230efb76-4442-4e46-a5d0-0467dea30b8f`
  - `target_summary`: `Cellairis`
  - `session_key`: `agent:cbe-buyer-screening:user:0c01d63d-de13-4478-a6a7-af3680b979b6:18ac43d8-10b0-4812-8b98-e82504b0dbdd`
  - session file: `/root/.openclaw/agents/cbe-buyer-screening/sessions/2cd1d554-f500-41d4-927b-8aa225f3d96c.jsonl`
- Code fix in `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - added `transcriptMessageRecord()`, `messageRole()`, and `messageContent()` so assistant text extraction accepts both flat transcript messages and nested OpenClaw raw entries;
  - added `coerceTimestampMs()` for ISO strings, numeric epoch seconds/milliseconds, and alternate timestamp fields;
  - `transcriptMessagesSince()` now falls back to the full transcript when no rows have comparable timestamps.
- Static regressions added in `scripts/test-cross-border-agents.ts`:
  - `employee runner reads nested OpenClaw transcript messages`;
  - `employee runner falls back when transcript timestamps are not comparable`.
- Verification:
  - Local `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 422/422.
  - Local `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - Local `git diff --check`: PASS.
  - ECS `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 422/422.
  - ECS `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - ECS `pnpm --dir sentura/dashboard build`: PASS.
  - ECS services after restart: `sentura-dashboard`, `nginx`, and root `openclaw-gateway` active.
  - Public HTTPS: `https://app.sentura.ai/employee` 200; `https://admin.sentura.ai/admin/login` 200.
- Production recovery:
  - recovered the existing Cellairis payload through `completeEmployeeScreeningRun()` and the existing Dashboard API/store normalization path, not raw SQL report insertion;
  - RDS now has `agent_runs.status = completed`, `current_stage = screening_reports_saved`, no error code/message;
  - saved report `SR-20260625-CELLAIRIS-001`, risk `trusted_candidate`, score `88.44`, 29 evidence rows, 6 score blocks, 14 address locations;
  - active Screening run count is `0`.
- Docs/tests updated:
  - CE30 in `docs/TESTS.md` and `docs/tests/tests-cross-border-phase2.md`.
  - Matrix row in `docs/MEMORY.md`.
  - Detailed section in `docs/memory/cross-border-ecommerce/phase-2.md`.
- Boundary: this fixes transcript-shape compatibility. The marker contract, CE28 fenced-JSON fallback, and CE29 repair loop still apply; if OpenClaw never writes a final assistant result or no usable payload exists after fallback/repair, the task still fails explicitly.

Previous operational fix:

- Implemented a one-shot structured-output repair loop in `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`.
- Parsing order is now explicit markers first, whole-response JSON/code-fenced JSON fallback second, and one repair turn third for malformed JSON or completed non-marker assistant output.
- Repair prompt forbids new investigation, tool calls, added/deleted/invented evidence, and only rewrites the prior assistant result as strict marker-wrapped JSON.
- Verification before CE30: local/ECS CBE static 420/420, Dashboard typecheck/build PASS, services active, public app/admin HTTPS 200.
- Docs/tests updated with CE29.

Previous operational fix:

- Root cause on ECS: OpenClaw `cbe-buyer-screening` completed the `CPR Cell Phone Repair` report in about 195s, but the final assistant response omitted `SCREENING_REPORTS_JSON_START` / `SCREENING_REPORTS_JSON_END` and returned a valid ```json fenced object. The Dashboard hidden runner only accepted marker-delimited output, so it polled until the 6-minute local wait window and then wrote `error_code = timeout`.
- Evidence:
  - RDS run `run_bd41a833-f84b-4b20-930d-65732ffab564` was `failed`, `error_code = timeout`, `error_message = 等待任务返回结果超时。`.
  - Session key `agent:cbe-buyer-screening:user:0c01d63d-de13-4478-a6a7-af3680b979b6:f70c7296-85d5-4f1c-b4d5-ba0bf659c81b`.
  - OpenClaw session file `/root/.openclaw/agents/cbe-buyer-screening/sessions/bb9127f8-5645-4e06-9c57-93ca8f6fa220.jsonl` had `status=done`, runtime about 195s, no markers, and a whole fenced JSON payload with `reports`.
- Code fix:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts` now keeps explicit marker parsing first.
  - If markers are absent, it strips optional JSON code fences and accepts only a whole JSON object whose expected top-level array matches the current task (`leads`, `reports`, `summaries`, or image preflight `images`).
  - `scripts/test-cross-border-agents.ts` adds the static regression `employee runner accepts fenced JSON when model omits markers`.
- ECS rollout:
  - Applied the same two-file hotfix via `git apply`.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 419/419.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm --dir sentura/dashboard build`: PASS.
  - Restarted `sentura-dashboard.service`; `sentura-dashboard`, `nginx`, and root `openclaw-gateway` are active.
  - Restored generated `sentura/dashboard/next-env.d.ts`; server repo now has only the two intentional hotfix source changes.
- Production backfill:
  - Parsed the existing OpenClaw transcript and completed it through the normal Dashboard completion API/store path, using Dashboard normalization rather than raw SQL.
  - RDS now has run `completed`, stage `screening_reports_saved`, no error code/message.
  - Saved report `RPT-20260625-CPR-001`, risk `cautious`, score `78.67`, 29 evidence rows, 6 score blocks, 16 address locations.
  - Active Screening run count is `0`.
  - Employee API `query=CPR` returns CPR with `screeningStatus=cautious`, `normalizedScore=78.67`, and `screeningAgentRunId=run_bd41a833-f84b-4b20-930d-65732ffab564`.
- Public checks:
  - `https://app.sentura.ai/employee`: 200.
  - `https://admin.sentura.ai/admin/login`: 200.
- Docs/tests updated:
  - CE28 in `docs/TESTS.md` and `docs/tests/tests-cross-border-phase2.md`.
  - Matrix row in `docs/MEMORY.md`.
  - Detailed section in `docs/memory/cross-border-ecommerce/phase-2.md`.

Previous operational fix:

- Root cause on ECS: OpenClaw Gateway failed before reply because Docker sandbox image `openclaw-sandbox:bookworm-slim` was missing. Docker service was active, but the upstream OpenClaw sandbox image had not been built after deployment.
- Evidence:
  - OpenClaw session transcript `/root/.openclaw/agents/cbe-lead-discovery/sessions/8707fd3e-e456-4e4b-b480-785fa131d51c.jsonl` contains `Agent failed before reply: Sandbox image not found: openclaw-sandbox:bookworm-slim`.
  - Gateway journal at `2026-06-26 05:24:20 +08:00` logs the same sandbox image error for the failed session.
  - RDS still had the corresponding `agent_runs` and `lead_runs` rows in `running`, which left an active Lead scope and could block/rejoin retries.
- Fix completed on ECS:
  - Ran `bash openclaw/scripts/sandbox-setup.sh`; Docker image `openclaw-sandbox:bookworm-slim` now exists.
  - Restarted root `systemctl --user openclaw-gateway`; service is active and Gateway reached ready.
  - Verified a temporary `cbe-lead-discovery` sandbox startup session returned `READY`.
  - Ran a non-writing Lead tool smoke: `cross-border-intel__cbe_intel_google_places_search` reached Google Places HTTP 200 and returned candidates. This smoke intentionally did not write customers.
  - Used the existing store function `failEmployeeTask()` to mark stale run `run_3d2c0614-713a-4906-a9b9-5b9c6cc25879` failed, fail lead run `lead_run_c2679c8b-b354-4f87-8b4c-0dad2434fc14`, and release the active Lead scope.
  - Removed temporary diagnostic session files; the user's original failed session remains as audit evidence.
- RDS verification after cleanup:
  - original `agent_runs.status = failed`, `error_code = gateway`.
  - original `lead_runs.status = failed`.
  - active `cbe-lead-discovery` run count = `0`.
  - lingering `lead_discovery_scopes` for the failed run = `[]`.
- No application source code changed for this fix. Docs/tests updated with CE27 ECS Lead sandbox readiness.
- Next user action: retry `寻找客户` from `app.sentura.ai`; the prior failed task can be dismissed in the UI.

Previous user issue: Admin domain opened incorrectly after route split. User reported `app.sentura.ai` opens Employee but `admin.sentura.ai` does not open Admin correctly.

Current state:

- Dashboard exposes canonical production CBE routes:
  - Employee pages: `/employee`, `/employee/login`, `/employee/customers`, `/employee/memory`.
  - Admin pages: `/admin`, `/admin/login`, `/admin/employees`, `/admin/high-value-customers`, `/admin/costs`.
  - APIs: `/api/employee/*`, `/api/admin/*`, and shared `/api/session`.
- Existing implementation files under `src/app/client-demos/cross-border/**` were kept in place behind Next rewrites. Old demo URLs redirect to the new canonical URLs.
- Added shared route constants in `sentura/dashboard/src/lib/cross-border-routes.ts`; runtime code and tests consume these constants rather than hardcoding demo paths.
- Root cause of the Admin issue:
  - Public `https://admin.sentura.ai/admin/login` returned `200`; DNS/ALB/Nginx were not the blocker.
  - The SSR HTML still contained `跨境电商员工操作系统` because Next rewrote `/admin/login` to `/client-demos/cross-border/admin/login` and AppShell route helpers only recognized canonical `/admin*`.
  - The Admin login form appeared inside an Employee shell, which made the Admin side look broken.
- Hotfix:
  - `sentura/dashboard/src/lib/cross-border-routes.ts` now recognizes canonical paths and internal rewrite destination paths for Employee/Admin.
  - `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts` now recognizes canonical and rewritten CBE API paths.
  - Regression checks were added to `scripts/test-cross-border-agents.ts` and `scripts/test-cross-border-phase2-store.ts`.
- `sentura/dashboard/next.config.ts` now:
  - redirects old `/client-demos/cross-border/...` and `/auth/login` URLs to canonical employee/admin URLs.
  - rewrites canonical page/API URLs back to the existing legacy implementation modules.
- Alibaba ECS rollout/hotfix is complete:
  - Confirmed `/root/Sentura-Platform` on `ecommerce` contains the route split.
  - Rebuilt Dashboard with `pnpm --dir sentura/dashboard build`.
  - Restarted `sentura-dashboard.service` on loopback `127.0.0.1:3000`.
  - Updated `/etc/nginx/sites-available/sentura.conf` root redirects to `/employee` and `/admin/login`; backup: `/etc/nginx/sites-available/sentura.conf.bak-20260626043945`.
  - Ran `nginx -t` and reloaded Nginx.
  - Confirmed OpenClaw Gateway is root's systemd user service on loopback `127.0.0.1:18789`.
  - Applied the Admin SSR hotfix on ECS with `git apply`, rebuilt Dashboard, restarted `sentura-dashboard.service`, restored build-generated `next-env.d.ts`, and cleaned temporary patch files.
  - Server repo now intentionally has two uncommitted source changes (`cross-border-routes.ts`, `tenant-context.ts`) until the same local fix is pushed and ECS can be aligned with `origin/ecommerce`.

Verification:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, `418/418`.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, `219/219`.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, `23/23`.
- `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`: PASS, `16/16`.
- `pnpm --dir sentura/dashboard build`: PASS. Existing Next workspace-root warnings remain.
- Local production server smoke on `127.0.0.1:3000`:
  - `/employee`: `200`.
  - `/admin/login`: `200`.
  - `/client-demos/cross-border/employee`: `307` to `/employee`.
  - `/client-demos/cross-border/admin/login`: `307` to `/admin/login`.
  - `/auth/login`: `307` to `/employee/login`.
  - `/api/session?role=operator`, `/api/employee/customers?limit=1`, `/api/admin/operators`: reached handlers and returned expected unauthenticated `401` responses.
- Target ECS smoke:
  - Dashboard build PASS on ECS.
  - `sentura-dashboard.service`, `nginx`, and root `openclaw-gateway.service` are active.
  - Dashboard loopback `/employee` and `/admin/login`: `200`.
  - Nginx host-header root checks: `app.sentura.ai/` -> `https://app.sentura.ai/employee`; `admin.sentura.ai/` -> `https://admin.sentura.ai/admin/login`.
  - Live RDS store check: `pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 244/244.
  - Public HTTPS: `https://app.sentura.ai/` -> `/employee`; `https://admin.sentura.ai/` -> `/admin/login`; `https://app.sentura.ai/employee` 200; `https://admin.sentura.ai/admin/login` 200.
  - Public Admin SSR after hotfix: `https://admin.sentura.ai/admin/login` contains `跨境电商管理者系统`, does not contain `跨境电商员工操作系统`, and exposes `管理者姓名` / `密码` / `登录`.
  - Public login smoke: `孙总` / `1234` returns `redirectTo: "/admin/employees"`; authenticated `/admin/employees` returns 200 and renders `员工管理`, `优先跟进客户`, `费用监控`.
  - Old public demo URLs return 307 to canonical paths.
  - Public canonical APIs return expected unauthenticated 401.
  - Public Gateway WebSocket `wss://admin.sentura.ai/gateway` opens successfully.

Operational boundaries:

- This route split does not rename the historical source folder yet; rewrites intentionally avoid a large file move.
- Successful browser access to `app.sentura.ai` and `admin.sentura.ai` means DNS/ALB reaches ECS/Nginx/Dashboard. It does not mean domains point directly to the ECS public IP.
- This is deployment/connectivity evidence, not a full `production_go_live_ready` label. Remaining readiness evidence: target load-smoke/restore drill, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS/runtime observations.
- Important follow-up: push the local hotfix, then align ECS with `origin/ecommerce` so the two server source changes are no longer uncommitted hotfix drift.

## Previous Alibaba Setup Snapshot

Date: 2026-06-26

User issue: Alibaba Cloud target setup after OpenClaw onboard. User wanted Sentura setup, Alibaba RDS wiring, external app/admin/gateway reachability tests, cleanup of prior failed artifacts, and confirmation of whether successful `app.sentura.ai` / `admin.sentura.ai` access means traffic reaches ECS.

State:

- Target host: Alibaba Cloud ECS running repo `/root/Sentura-Platform` on `ecommerce`; OpenClaw `2026.6.2`.
- User completed `pnpm build` and `pnpm openclaw onboard` manually with LLM/Tavily configured.
- Follow-up setup completed:
  - Ran `scripts/sentura-setup.sh` after onboard.
  - Registered Sentura meta-agents plus CBE agents into OpenClaw.
  - Wired Dashboard env to Alibaba RDS and public Gateway URL.
  - Created/migrated RDS database `sentura` through migrations `001`-`008`.
  - Seeded CBE profiles: one `admin`, two `operator`.
  - Built root workspace packages, including Dashboard and MCP builds.
  - OpenClaw Gateway service active on loopback `127.0.0.1:18789`.
  - Sentura Dashboard systemd service active on loopback `127.0.0.1:3000`.
  - Nginx active on `:80` behind Alibaba ALB, routing `app.sentura.ai`, `admin.sentura.ai`, and `/gateway`.
- Cleanup completed:
  - Removed old failed `/srv/sentura`.
  - Fixed stale `/root/.bashrc` completion source guard.

Verification:

- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, `244/244` against target Alibaba RDS.
- RDS migration/profile check: 8 migrations, `admin:1`, `operator:2`.
- Local Nginx host-header checks:
  - `app.sentura.ai` root redirects to `/client-demos/cross-border/employee`.
  - `admin.sentura.ai` root redirects to `/client-demos/cross-border/admin/login`.
  - Admin login route returns `200`.
- Public HTTPS:
  - `https://app.sentura.ai/` returns expected Employee redirect.
  - `https://admin.sentura.ai/` returns expected Admin login redirect.
- Public Gateway:
  - `wss://admin.sentura.ai/gateway` completed the OpenClaw connect handshake.
- ECS Nginx logs show Alibaba SLB health checks reaching the instance, so the public domains are routed through ALB to the ECS/Nginx target.

Boundaries:

- Successful `app.sentura.ai` and `admin.sentura.ai` browser loads mean DNS resolves to Alibaba ALB and the ALB target path reaches this ECS/Nginx/Dashboard stack. It does not mean the domains point directly to the ECS public IP; they point to ALB, which forwards to ECS.
- Use HTTPS for public access. Direct public HTTP timed out during external checks; the ALB appears HTTPS-facing from the outside.
- This is target connectivity/setup evidence, not full `production_go_live_ready`. Remaining target evidence: load-smoke, disposable restore drill, provider/source-rate headroom, model concurrency, DB connection-limit headroom, Gateway RSS/runtime observations.
- `sentura-memory-lancedb` is configured but inactive because runtime memory slot remains `memory-core` and the embedding key path was not active. This does not block app/admin/RDS checks.
- Gateway device-auth bypass is temporarily enabled for Sentura Dashboard compatibility with OpenClaw `2026.6.2`; keep `18789` loopback-only and do not expose it directly.

## Previous Local UI Snapshot

Date: 2026-06-25

Latest user issue: `记忆整理` must be separated from `获客与背调`; the memory Agent should not provide backcheck, write, or cross-board handoff options.

Current state:

- Implemented CE25 separation:
  - Employee `记忆整理` remains a JSON/text/multi-screenshot structured report preview board.
  - Removed `批准写入`, `发送到背调`, write-status display, supplement-target state, and Screening route actions from the memory page.
  - Employee `获客与背调` no longer offers `补充聊天记录` or any route-back-to-memory flow; selected customers are used only for Lead/Screening work.
  - Standalone `/client-demos/cross-border/accio-memory` no longer exposes Screening handoff copy/send behavior.
  - Accio summaries no longer create `memory_facts` or `handoff_events`; Accio rows no longer project into the customer list.
  - Store/API guards reject stale interop with `accio_interop_disabled`, `accio_handoff_disabled`, and `memory_fact_review_disabled`.
  - `cbe-accio-memory` prompt/skills now describe preview-only analysis; `skills/handoff-to-screening/SKILL.md` was removed.
- Updated docs/tests/memory:
  - `docs/TESTS.md` adds CE25 and updates current counts.
  - `docs/tests/tests-cross-border-phase2.md` adds detailed CE25 cases and marks CE22 Accio interop as historical audit context.
  - `docs/MEMORY.md` and `docs/memory/cross-border-ecommerce/phase-2.md` record the separation as current ground truth.

Verification:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 415/415.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 218/218.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 244/244.

Previous user issue: screenshot analysis should support uploading multiple screenshots.

Previous state:

- Confirmed multi-image support already existed in the lower-level path:
  - `normalizeImageMemoryImport(files)` accepts `FileList | File[]`, loops every image, and writes one metadata item per image.
  - Employee upload input uses `multiple`, stores `imageAttachments[]`, and sends all images through `toGatewayChatAttachments()`.
  - `runAccioMemoryTask()` groups image attachments with `imageAttachmentBatches()` and submits numbered preflight transcription batches before the final Accio summary prompt.
- Made UI copy explicit: `上传聊天截图图片（可多选）`, multi-image image-mode description, and safety notice.
- Added static regression `employee memory screenshot import supports multiple screenshots`.

Verification:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 418/418.
- Raw-image boundary unchanged: images are transient task inputs only; DB stores hashes/metadata and structured results.

Previous user issue: the teammate Accio sample report looked empty/useless in the Employee `记忆整理` report dialog.

Diagnosis: not a bad sample and not a complete Agent extraction failure. The local DB row contains Rossi Telecom SRL, Marco Rossi, S25 Ultra magnetic rugged case, 500/1000 pcs, DDP Milan/payment/price context, final US$1,925, and concrete next actions. The failure was the merged store/API/UI projection: it flattened structured Accio fields into one generic `summary` and preferred manual placeholder company `待确认客户` over analyzed `customer_profile_json.company_name`.

Current fix implemented:

- `listEmployeeMemoryRecords()` now prefers analyzed company/country values from `accio_summaries`.
- `buildMemorySummary()` now synthesizes useful deal facts from product/quantity/price/terms/next action before falling back to behavior summaries.
- Employee memory records/API items now carry `customerProfile`, `purchaseIntent`, `negotiatedPrices`, `behaviorSignals`, and `nextActions`.
- `MemoryReportDialog` now renders `客户画像`, `采购需求`, `价格与条款`, and `下一步`.
- Regression tests were added for structured projection, analyzed-company precedence, and structured report sections.

Verification completed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 417/417 before the later multi-screenshot regression.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 218/218.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 245/245.
- API smoke returned `name: "Rossi Telecom SRL"` and structured profile/intent/price/behavior/next-action fields.
- Browser smoke confirmed the sample report modal shows useful deal facts.

## Prior Task

## Merge State

- Started on branch `ecommerce`.
- Fetched `origin`; local `agent-memory` matched `origin/agent-memory` at `5f15ef83`.
- Merged `agent-memory` into `ecommerce`.
- Conflicts were resolved by keeping current `ecommerce` production-hardening behavior as the base and manually integrating the relevant memory import changes.
- Merge commit exists locally: `8e05b434 Merge agent-memory into ecommerce`.

Key conflict decision:

- Preserve existing `sentura/lib/cross-border-store/migrations/007_screening_retry_memory_approval.sql`.
- Integrate the branch's Accio manual import metadata migration as `sentura/lib/cross-border-store/migrations/008_accio_manual_import_formats.sql`.

## Implementation Summary

- Added `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/memory-import-normalizer.ts`.
- Employee `记忆整理` now supports three manual Accio import modes:
  - JSON file import.
  - Pasted chat text import.
  - Screenshot image import.
- JSON/text modes can be imported-only or submitted for hidden Accio analysis.
- Screenshot mode requires immediate analysis; raw image bytes are not persisted, and DB replay is blocked with a user-facing explanation.
- Gateway chat client/types now support OpenClaw-compatible attachments:
  - `source: { type: "base64", media_type, data }`
  - forwarded through `sendChat` / `sendChatMessage`.
- Hidden Accio task runner now supports screenshot preflight transcription batches before the final summary prompt.
- Accio prompt now asks for Chinese operator-ready report fields, product context, price context, follow-up context, and explicit unit-price versus total-price distinctions.
- Accio store schemas and persistence now carry:
  - `source_kind`
  - `input_format`
  - `attachment_metadata_json`
- Metadata is projected through imports, memory records, analysis payloads, activity events, audit events, and typed Employee API objects.
- Added sample memory-agent assets under `outputs/memory-agent-samples/`.

## Files Touched

Main implementation:

- `sentura/dashboard/src/lib/gateway/types.ts`
- `sentura/dashboard/src/lib/gateway/client.ts`
- `sentura/dashboard/src/lib/gateway/index.ts`
- `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
- `sentura/dashboard/src/lib/cross-border-store/accio.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/memory-import-normalizer.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/lib/cross-border-store/migrations/008_accio_manual_import_formats.sql`
- `scripts/test-cross-border-phase2-store.ts`
- `scripts/test-cross-border-agents.ts`

Docs/handoff:

- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `outputs/resume_card.md`
- `outputs/task_handoff.md`

Sample assets:

- `outputs/memory-agent-samples/**`

## Verification

Completed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 416/416.
- `git diff --check`: PASS before final staging/commit.

Recommended final checks before reporting completion:

```bash
git diff --check
git status --short --branch
```

## Boundaries

- Do not add CBE work to `docs/TeamPlan.md`; this is an independent client lane.
- Do not call this target deployment `production_go_live_ready`; CE23 target-environment smoke/restore/provider evidence is still required.
- Do not persist raw screenshot bytes into the CBE business DB.
