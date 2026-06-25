# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese product/customer/UI names unchanged.

Active product area: Cross-border e-commerce / 跨境电商 Phase 2 production hardening.

Latest local fix, 2026-06-26:

- User noticed deployment domains were split (`app.sentura.ai` / `admin.sentura.ai`) but CBE Dashboard still used demo-style paths. Server changes are intentionally deferred until the user reviews, pushes the branch, and pulls it on ECS.
- Local Dashboard now has canonical CBE routes:
  - Employee: `/employee`, `/employee/login`, `/employee/customers`, `/employee/memory`.
  - Admin: `/admin`, `/admin/login`, `/admin/employees`, `/admin/high-value-customers`, `/admin/costs`.
  - APIs: `/api/employee/*`, `/api/admin/*`, `/api/session`.
- `next.config.ts` keeps compatibility:
  - Old `/client-demos/cross-border/employee*` page URLs redirect to `/employee*`.
  - Old `/client-demos/cross-border/admin*` page URLs redirect to `/admin*`.
  - `/auth/login` redirects to `/employee/login`.
  - Canonical pages/APIs rewrite to existing implementation files/route handlers under `client-demos/cross-border/**`.
- Updated AppShell, login/session redirects, Employee/Admin API helpers, notification links, memory import redirect, and route regression tests to use the canonical paths.
- Verification:
  - Dashboard typecheck PASS.
  - Dashboard build PASS, with the existing multiple-lockfile workspace-root warning only.
  - `scripts/test-cross-border-agents.ts` PASS, 417/417.
  - `scripts/test-cross-border-phase2-store.ts` PASS, 218/218.
  - `scripts/test-cross-border-phase2-concurrency.ts` PASS, 23/23.
  - `scripts/test-cross-border-phase2-load-smoke.ts` PASS, 16/16.
  - Local HTTP smoke on `127.0.0.1:3000`: `/employee` 200, `/admin/login` 200, old demo page URLs 307 to canonical paths, new APIs reach handlers with expected unauthenticated 401.
  - Browser smoke PASS for `/employee` and `/admin/login`.
- Local production server is running at `http://127.0.0.1:3000` for review.
- Next server step after user push/pull: rebuild Dashboard, restart `sentura-dashboard.service`, update Nginx redirects to `/employee` and `/admin/login`, then re-run public HTTPS/WSS smoke.

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
