# Sentura CBE Resume Card

Workspace: `/Users/eee/Desktop/Sentura-Platform-ecommerce`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese UI/product names unchanged.

Active product area: Cross-border e-commerce / 跨境电商 Phase 2 production hardening.

## Current Local Stack

- PostgreSQL: Docker container `sentura-cbe-postgres`, DB `sentura_cbe_dev`, URL `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`.
- Gateway: `http://localhost:18789`, cwd `/Users/eee/Desktop/Sentura-Platform-ecommerce/openclaw`.
- Dashboard: `http://localhost:3000`, cwd `/Users/eee/Desktop/Sentura-Platform-ecommerce/sentura/dashboard`.
- Demo logins: Admin `孙总/1234`; Employee `Lin Yue/1234`.
- Local caveat: repo-local `openclaw/` source build is blocked by missing source workspace packages. Startup uses packaged OpenClaw CLI fallback from `openclaw/node_modules/openclaw/openclaw.mjs`. Packaged host still skips `sentura-memory-lancedb` because host API is older than the plugin requirement.

## Latest Implementation, 2026-06-23

Task: commercial-readiness review and hardening for the Memory Agent report flow.

Result:

- Audited the current `记忆整理` JSON/text/screenshot import, hidden runner, API normalization, Accio store projection, source `cbe-accio-memory` workspace, and report UI.
- Hardened `employee-task-runner.ts` Accio prompt to require bilingual Chinese operator reports: `report_zh`, `summary_zh`, Chinese next actions, Chinese price context, and explicit unit-vs-total price fields.
- Updated source `sentura/agents/cbe-accio-memory/AGENTS.md` and `skills/deal-summary/SKILL.md` with the same report and price-contract requirements.
- Updated `employee-api.ts` normalization to preserve `report_zh` / `translation_zh`, prefer Chinese summaries when available, keep `memory_preview.summary_zh`, and compact object-shaped next actions plus numeric amount fields safely.
- Expanded `/employee/memory` report detail into Chinese business sections: `完整分析报告`, `咨询内容与采购意图`, `价格与条款`, `客户判断与风险信号`, `写入记忆预览`, and detailed `背调交接`, with localized field labels and translated missing-field names.
- Added Phase 2 static checks for the bilingual Accio prompt contract, object next-action preservation, and complete Chinese report rendering.

Previous 2026-06-22 implementation still applies:

- Upgraded Employee `记忆整理` from JSON-only to three modes: `JSON 文件`, `粘贴文字`, `聊天截图`.
- Removed the official `阿里国际站` / Alibaba API import choice from the new-record UI.
- Added `memory-import-normalizer.ts` to normalize JSON, pasted chat snippets, and screenshot metadata into one Accio-compatible conversation export.
- Pasted text now accepts incomplete snippets such as seller answer + timestamp + buyer question, creates placeholder `待确认客户` / `待确认联系人` / country `ZZ` when necessary, and drives `missing_fields` instead of invented facts.
- Screenshot mode accepts multiple selected images with no fixed UI count limit. It validates each image type/size, sends OpenClaw Gateway image attachments, chunks screenshot transcription by payload size, then runs one final summary/handoff prompt.
- Screenshot mode does not allow `仅导入` because raw images are not durably stored for queued/retry analysis.
- Gateway client/types now forward `chat.send` attachments.
- `employee-task-runner.ts` supports image transcript preflight turns (`ACCIO_IMAGE_TRANSCRIPT_BATCH_*`) before final `ACCIO_SUMMARIES_JSON_START/END`.
- `cbe-accio-memory` workspace prompts/skills now require top-level `{ "summaries": [...] }`, preserve transcription uncertainty, and forbid invented company/country/contact fields.
- Added migration `007_accio_manual_import_formats.sql` for `accio_imports.source_kind`, `input_format`, and `attachment_metadata_json`.
- Accio store/API projections now carry source/input/attachment metadata and richer report detail fields.
- Memory report dialog now shows customer profile, inquiry/purchase intent, price/shipment/payment terms, chat summary, missing fields, memory-write preview, and Screening handoff suggestions.
- Synced live `~/.openclaw/workspace/cbe-accio-memory`; top-level Markdown files remain exactly the 8 OpenClaw-native files and no `RULES.md`/`CONTEXT.md` exists.
- Manual test fixture now lives under `outputs/memory-agent-samples/`: one complete Rossi Telecom SRL customer conversation with a 31-message pasted transcript, one Accio-compatible JSON export, five continuous screenshot-style PNGs, a README, and `generate_complete_case.py`. It covers customer identity, inquiry, sample, pricing, negotiation, DDP freight, documents, payment, shipment tracking, and follow-up tasks.

## Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 413/413.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 198/198.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS, applied `007_accio_manual_import_formats.sql`.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 217/217.
- `bash -n scripts/sentura-setup.sh && bash -n scripts/start-sentura-demo.sh`: PASS.
- Browser smoke: logged in as `Lin Yue/1234`, opened `/client-demos/cross-border/employee/memory`, verified the memory page renders, opened a memory detail dialog, and confirmed the new Chinese report sections appear without runtime failure. Pre-login 401 console entries were expected from unauthenticated redirects.
- Fixture validation: regenerated the complete case, validated the JSON with `python3 -m json.tool`, confirmed `message_count=31`, `attachment_count=6`, buyer company `Rossi Telecom SRL`, `missing_fields=[]`, and opened all five PNGs with Pillow to confirm dimensions and size below the 10 MB per-image limit.

## Docs Updated

- `跨境电商/MEMORY_PROCESSING.md`
- `跨境电商/PHASE-2.md`
- `跨境电商/UI.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `outputs/resume_card.md`
- `outputs/task_handoff.md`
- `outputs/memory-agent-samples/`

## Boundaries / Next

- No real external AI/vision task was launched in this smoke. Screenshot analysis requires the active `cbe-accio-memory` model/provider to support image attachments through OpenClaw.
- Raw screenshots are not stored durably; reanalysis requires re-uploading screenshots.
- Remaining P2.5 work: Screening parent/child fan-out, queue draining/claim behavior, paid-call retry approval state, Accio approval-to-memory promotion, missing-field resolution, screenshot retry/reupload UX, and durable Screening handoff consumption.
- Existing already-analyzed memory rows only gain the new `report_zh` structure after reanalysis with the updated prompt.
