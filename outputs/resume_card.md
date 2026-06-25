# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese product/customer/UI names unchanged.

Active product area: Cross-border e-commerce / 跨境电商 Phase 2 production hardening.

Latest operational fix, 2026-06-26:

- User asked whether future hidden Employee tasks can still timeout because of response format problems, and whether there is an enforcement path.
- Fix added a one-shot structured-output repair loop in `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`.
- Hidden task parsing order is now explicit markers first, whole-response JSON/code-fenced JSON fallback second, then one repair turn for malformed or completed non-marker output.
- Repair prompt forbids new investigation, tool calls, added/deleted evidence, and invented facts; it only asks the employee to rewrite its prior result as strict marker-wrapped JSON.
- Transcript reads are timestamp-scoped with `minMessageTimestampMs`, so final tasks do not parse old screenshot-preflight messages and repair polling only reads messages after the repair request.
- Expected top-level arrays remain guarded: `leads`, `reports`, `summaries`, image `images`.
- Verification:
  - Local: CBE static 420/420, Dashboard typecheck PASS, `git diff --check` PASS.
  - ECS: CBE static 420/420, Dashboard typecheck/build PASS, `sentura-dashboard`, `nginx`, and root `openclaw-gateway` active after restart.
  - Public HTTPS: `https://app.sentura.ai/employee` and `https://admin.sentura.ai/admin/login` return 200 with correct Employee/Admin shells.
- Docs/tests updated with CE29 in `docs/TESTS.md`, `docs/tests/tests-cross-border-phase2.md`, `docs/MEMORY.md`, and `docs/memory/cross-border-ecommerce/phase-2.md`.
- Boundary: this prevents format-only failures from becoming local timeouts when the employee has produced usable content or can reformat it. It does not guarantee success if the model/tool/provider/backend never produces a result or the repair turn also fails.

Previous operational fix, 2026-06-26:

- User reported production `背调` failed after a successful `寻找客户`, likely when estimated wait time expired.
- Root cause on ECS: OpenClaw `cbe-buyer-screening` completed the CPR report in about 195s, but returned a ```json fenced object without `SCREENING_REPORTS_JSON_START` / `SCREENING_REPORTS_JSON_END`; Dashboard only accepted explicit markers, kept polling until the 6-minute local wait window, and wrote timeout.
- Failed/recovered run:
  - RDS run: `run_bd41a833-f84b-4b20-930d-65732ffab564`.
  - Session key: `agent:cbe-buyer-screening:user:0c01d63d-de13-4478-a6a7-af3680b979b6:f70c7296-85d5-4f1c-b4d5-ba0bf659c81b`.
  - Session file: `/root/.openclaw/agents/cbe-buyer-screening/sessions/bb9127f8-5645-4e06-9c57-93ca8f6fa220.jsonl`.
- Fix:
  - `employee-task-runner.ts` now keeps marker parsing first, then accepts whole-response JSON/code-fenced JSON only when the expected top-level array matches the task (`leads`, `reports`, `summaries`, or image `images`).
  - `scripts/test-cross-border-agents.ts` has a static regression for the fallback.
  - Applied the same hotfix on ECS via `git apply`, ran static tests/typecheck/build, restarted `sentura-dashboard.service`, and restored generated `next-env.d.ts`.
  - Backfilled the CPR report from the existing transcript through the normal Dashboard completion API/store path, not raw SQL.
- Verification:
  - Local: CBE static 419/419, Dashboard typecheck PASS.
  - ECS: CBE static 419/419, Dashboard typecheck/build PASS, services active.
  - RDS: run status `completed`, stage `screening_reports_saved`, report `RPT-20260625-CPR-001`, score `78.67`, risk `cautious`, 29 evidence rows, 6 score blocks, 16 address locations, active Screening count `0`.
  - Employee API `query=CPR` returns CPR with `screeningStatus=cautious`, `normalizedScore=78.67`, and the recovered run id.
- Local docs/tests updated with CE28. Local source changes: `employee-task-runner.ts`, `scripts/test-cross-border-agents.ts`, docs/handoff files. ECS currently has the two source hotfix files uncommitted until local branch is pushed and server aligned.

Previous operational fix, 2026-06-26:

- User reported the first production `寻找客户` task on `app.sentura.ai` failed with "未写入客户：本地页面超过等待时间仍未收到结构化结果", session key `agent:cbe-lead-discovery:user:0c01d63d-de13-4478-a6a7-af3680b979b6:0deacf0e-2189-48a5-a26d-fb8056b592c2`.
- Root cause on ECS: OpenClaw Gateway failed before reply because Docker sandbox image `openclaw-sandbox:bookworm-slim` was missing. Docker was active, but the image had not been built after deployment.
- Fix on ECS:
  - Ran `bash openclaw/scripts/sandbox-setup.sh`; image `openclaw-sandbox:bookworm-slim` now exists.
  - Restarted root `systemctl --user openclaw-gateway`; service is active and Gateway reached ready.
  - Verified `cbe-lead-discovery` can start in the sandbox with a temporary `READY` session.
  - Ran a non-writing tool smoke that reached `cross-border-intel__cbe_intel_google_places_search`; Google Places returned HTTP 200 candidates.
  - Marked the stale RDS run `run_3d2c0614-713a-4906-a9b9-5b9c6cc25879` failed through `failEmployeeTask()`, which also failed `lead_run_c2679c8b-b354-4f87-8b4c-0dad2434fc14` and released the active Lead scope.
  - Removed diagnostic session files; the user's original failed session remains for audit.
- RDS verification after cleanup: original run status `failed`, error code `gateway`, lead run status `failed`, active `cbe-lead-discovery` count `0`, lingering scopes `[]`.
- No application source code changed. Docs/tests updated with CE27 ECS Lead sandbox readiness.

Latest hotfix, 2026-06-26:

- User reported `app.sentura.ai` opened Employee but `admin.sentura.ai` did not open the Admin side correctly.
- Root cause: public `admin.sentura.ai/admin/login` returned `200`, but SSR HTML contained the Employee shell (`跨境电商员工操作系统`). Next rewrites `/admin/login` to `/client-demos/cross-border/admin/login`; AppShell route helpers only recognized canonical `/admin*`, so SSR misclassified the internal rewrite destination as Employee.
- Dashboard has canonical CBE routes:
  - Employee: `/employee`, `/employee/login`, `/employee/customers`, `/employee/memory`.
  - Admin: `/admin`, `/admin/login`, `/admin/employees`, `/admin/high-value-customers`, `/admin/costs`.
  - APIs: `/api/employee/*`, `/api/admin/*`, `/api/session`.
- Hotfix:
  - `sentura/dashboard/src/lib/cross-border-routes.ts` now recognizes canonical paths and internal rewrite destination paths.
  - `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts` now recognizes canonical and rewritten CBE API paths.
  - Added regression checks in `scripts/test-cross-border-agents.ts` and `scripts/test-cross-border-phase2-store.ts`.
- `next.config.ts` keeps compatibility:
  - Old `/client-demos/cross-border/employee*` page URLs redirect to `/employee*`.
  - Old `/client-demos/cross-border/admin*` page URLs redirect to `/admin*`.
  - `/auth/login` redirects to `/employee/login`.
  - Canonical pages/APIs rewrite to existing implementation files/route handlers under `client-demos/cross-border/**`.
- ECS hotfix work completed:
  - `pnpm --dir sentura/dashboard build`: PASS on `/root/Sentura-Platform`.
  - `sentura-dashboard.service`: active on `127.0.0.1:3000`.
  - root `systemctl --user openclaw-gateway.service`: active on `127.0.0.1:18789`.
  - Nginx unchanged from the previous route split rollout: root redirects point `app.sentura.ai/` to `/employee` and `admin.sentura.ai/` to `/admin/login`; backup remains `/etc/nginx/sites-available/sentura.conf.bak-20260626043945`.
  - Server build-generated `sentura/dashboard/next-env.d.ts` restored.
  - Server repo now has two intentional uncommitted hotfix source changes until the local branch is pushed and ECS is aligned: `cross-border-routes.ts`, `tenant-context.ts`.
- Verification:
  - Local: Dashboard typecheck PASS, Dashboard build PASS, CBE static 418/418, store 219/219.
  - Local production HTTP smoke: `/admin/login` SSR HTML contains `跨境电商管理者系统`, not `跨境电商员工操作系统`.
  - Public HTTPS: `https://admin.sentura.ai/` -> `/admin/login`; `https://admin.sentura.ai/admin/login` 200 and contains `跨境电商管理者系统`, not Employee shell.
  - Public login smoke: `孙总` / `1234` returns `redirectTo: "/admin/employees"`; authenticated `/admin/employees` returns 200 and renders manager nav labels.
  - `https://app.sentura.ai/employee` remains 200.
- Remaining readiness work before `production_go_live_ready`: target load-smoke/restore drill, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS/runtime observations.

Previous operational setup, 2026-06-26:

- Alibaba Cloud target setup is complete enough for app/admin connectivity smoke:
  - Server repo: `/root/Sentura-Platform` on branch `ecommerce`; OpenClaw `2026.6.2`.
  - User completed `pnpm build` and `pnpm openclaw onboard`; then Sentura setup ran successfully with `scripts/sentura-setup.sh`.
  - Registered Sentura meta-agents plus CBE agents in OpenClaw, using the target `~/.openclaw` config/env.
  - Alibaba RDS PostgreSQL database `sentura` was created/migrated through `001`-`008` and seeded with one CBE `admin` plus two `operator` profiles.
  - Dashboard `.env.local` points CBE store to target RDS and public Gateway URL to `wss://admin.sentura.ai/gateway`.
  - Systemd services are active: OpenClaw Gateway on loopback `127.0.0.1:18789`; Sentura Dashboard on loopback `127.0.0.1:3000`; Nginx on public `:80` behind Alibaba ALB.
  - Nginx routes `app.sentura.ai` to Employee, `admin.sentura.ai` to Admin login, and `/gateway` to the loopback OpenClaw Gateway WebSocket.
- Verification:
  - Target live DB store test PASS: `scripts/test-cross-border-phase2-store.ts --require-db` `244/244`.
  - RDS migration/profile check confirmed 8 migrations, `admin:1`, `operator:2`.
  - Public HTTPS checks: `https://app.sentura.ai/` and `https://admin.sentura.ai/` return expected redirects.
  - Admin login API through Nginx returned authenticated redirect.
  - Public WSS Gateway handshake at `wss://admin.sentura.ai/gateway` passed.
  - Nginx logs show Alibaba SLB health checks hitting the ECS target.
- Cleanup:
  - Removed failed old `/srv/sentura` deployment residue.
  - Fixed stale `/root/.bashrc` OpenClaw completion source guard.
- Caveats:
  - This proves DNS/ALB/ECS/Nginx/Dashboard/Gateway/RDS connectivity, but is not full `production_go_live_ready`.
  - Remaining target evidence: load-smoke, disposable restore drill, provider/source-rate headroom, model concurrency, DB connection limits, Gateway RSS.
  - `sentura-memory-lancedb` is configured but inactive; runtime memory slot remains `memory-core`.
  - OpenClaw Gateway device-auth bypass is temporarily enabled for Dashboard compatibility; keep `18789` loopback-only and never expose it directly.

Previous fix, 2026-06-25:

- User clarified the memory Agent / `记忆整理` board must be separated from `获客与背调`; it should not provide backcheck, write, or cross-board handoff options.
- Implemented separation end to end:
  - Employee `记忆整理` is preview-only. Removed `批准写入`, `发送到背调`, write-status display, supplement-target state, and Screening route actions.
  - Employee `获客与背调` no longer offers `补充聊天记录` / route-back-to-memory actions and no longer projects Accio rows as customer sources.
  - Standalone `/client-demos/cross-border/accio-memory` no longer exposes Screening handoff copy/send behavior.
  - Accio store completion persists summaries but returns `memoryFactIds: []` and `handoffIds: []`; stale `supplement_target` payloads are rejected with `accio_interop_disabled`.
  - Handoff store rejects Accio-to-Screening events with `accio_handoff_disabled`.
  - Memory-facts PATCH route now returns `memory_fact_review_disabled`.
  - `cbe-accio-memory` workspace no longer has `skills/handoff-to-screening/SKILL.md`; prompts/skills are preview-only.
- CE25 added to `docs/TESTS.md` and `docs/tests/tests-cross-border-phase2.md`; memory matrix/detail updated.
- Verification: Dashboard typecheck PASS; `scripts/test-cross-border-agents.ts` PASS 415/415; `scripts/test-cross-border-phase2-store.ts` PASS 218/218; live PostgreSQL store PASS 244/244.

Previous fix, 2026-06-25:

- User clarified screenshot analysis should support uploading multiple screenshots.
- Confirmed the bottom path already supports multiple images: `normalizeImageMemoryImport(files)` iterates all selected images; the Employee file input uses `multiple`; all images are converted to Gateway attachments; `runAccioMemoryTask()` batches them through `imageAttachmentBatches()` before final summary.
- Made the UI explicit: upload label now says `上传聊天截图图片（可多选）`; image-mode description and safety notice mention multi-image support.
- Added static regression `employee memory screenshot import supports multiple screenshots`.
- Verification: Dashboard typecheck PASS; `pnpm exec tsx scripts/test-cross-border-agents.ts` PASS, 418/418.
- Raw image boundary unchanged: images are transient task inputs only; DB stores hashes/metadata and structured results, not raw image bytes.

Previous fix, 2026-06-25:

- User reviewed the teammate sample report and found it appeared to contain no useful information.
- Diagnosis: the sample/Agent extraction was not empty. The local DB row already contained Rossi Telecom SRL, Marco Rossi, S25 Ultra magnetic rugged case, 500/1000 pcs, DDP Milan/payment/price context, final total US$1,925, and next actions.
- Root cause: merged store/API/UI projection flattened the structured Accio summary into one generic `summary`; list projection also preferred manual import placeholder company `待确认客户` over analyzed `customer_profile_json.company_name`.
- Fixed `sentura/dashboard/src/lib/cross-border-store/accio.ts` to prefer analyzed company/country, synthesize summary from structured deal facts before behavior fallback, and project `customerProfile`, `purchaseIntent`, `negotiatedPrices`, and `behaviorSignals`.
- Passed structured fields through `employee-api.ts` / `employee-data.ts`.
- Updated Employee `记忆整理` report modal to render `客户画像`, `采购需求`, `价格与条款`, and `下一步`.
- Added static regression checks for structured report sections, structured deal projection, and analyzed-company precedence.
- Verification: Dashboard typecheck PASS; `scripts/test-cross-border-agents.ts` PASS 417/417 before the later multi-screenshot regression; store static PASS 218/218; live PostgreSQL store PASS 245/245; API smoke returned `Rossi Telecom SRL`; Browser sample smoke confirmed useful deal facts in the modal.
- Local dev server may still be running at `http://localhost:3000` with `CBE_DEMO_USER_ID=cbe-user-operator-9fc8f72c-751a-451e-9edc-221e96e4377f` if not stopped by the current agent.

Previous operational fix, 2026-06-25:

- User reported `column ai.source_kind does not exist`.
- Root cause: local CBE database had the merged Dashboard/store code but had not yet applied `008_accio_manual_import_formats.sql`.
- Ran `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`.
- Migration applied only `008_accio_manual_import_formats.sql`; migrations `001` through `007` were already applied/skipped.
- Confirmed `accio_imports` has `source_kind`, `input_format`, and `attachment_metadata_json`.
- Verification: `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db` PASS, 243/243.
- No application-code change was required for the migration application itself. Existing unrelated local generated change remains: `sentura/dashboard/next-env.d.ts`.

Latest task, 2026-06-24:

- User asked to pull teammate branch `agent-memory`, merge it into the `ecommerce` customer branch, resolve conflicts, and integrate the memory-agent optimization with the existing CBE design.
- Merge is complete locally. `agent-memory` was fetched, merged into `ecommerce`, conflicts were resolved by preserving current `ecommerce` P2.5/P2.6 production boundaries first, then manually integrating the useful Accio memory import work.
- Important conflict decision: the branch's Accio import-format migration was integrated as `sentura/lib/cross-border-store/migrations/008_accio_manual_import_formats.sql`, keeping existing `007_screening_retry_memory_approval.sql` intact.
- Added Employee `记忆整理` manual import modes for JSON, pasted chat text, and screenshots. JSON/text can be imported-only or analyzed. Screenshots require immediate analysis because raw images are not persisted.
- Added `memory-import-normalizer.ts`, OpenClaw-compatible Gateway chat attachments, screenshot preflight transcription batches in the hidden Accio runner, and Chinese operator-ready Accio summary prompt requirements.
- Accio import persistence now carries `source_kind`, `input_format`, and `attachment_metadata_json` through schemas, store writes, memory records, analysis payloads, activity events, and audit metadata.
- Screenshot raw image bytes remain transient task inputs only. Re-analysis of image-sourced DB records requires the operator to upload the screenshots again.
- Added teammate sample assets under `outputs/memory-agent-samples/`.
- Docs updated: CE24 in `docs/TESTS.md`, detailed CE24 in `docs/tests/tests-cross-border-phase2.md`, matrix row in `docs/MEMORY.md`, detailed session in `docs/memory/cross-border-ecommerce/phase-2.md`, plus this handoff.

Verification completed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 416/416.
- `git diff --check`: PASS before final staging/commit.

Current boundary:

- This merge does not change CBE `operator`/`admin` role boundaries, workload caps, P2.6 go-live labels, or OpenClaw runtime assumptions.
- Full `production_go_live_ready` remains conditional on target-deployment smoke, target restore drill, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS behavior.
