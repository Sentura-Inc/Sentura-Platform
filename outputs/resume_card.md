# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese product/customer/UI names unchanged.

Active product area: Cross-border e-commerce / 跨境电商 Phase 2 production hardening.

Latest fix, 2026-06-25:

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
