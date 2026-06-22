# Sentura CBE Continuation Handoff

Default continuation rule: read `outputs/resume_card.md` first. Then read this file only if more detail is needed. Use `docs/MEMORY.md` as an index only when a specific prior row is needed.

Workspace: `/Users/eee/Desktop/Sentura-Platform-ecommerce`

User-facing language: Chinese.

Active lane: Cross-border e-commerce / 跨境电商 Phase 2.

## Current Stack Snapshot

- PostgreSQL: Docker container `sentura-cbe-postgres`, DB `sentura_cbe_dev`, URL `postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev`.
- Gateway: `http://localhost:18789`.
- Dashboard: `http://localhost:3000`.
- Employee route: `http://localhost:3000/client-demos/cross-border/employee/memory`.
- Demo users: Admin `孙总/1234`, Employee `Lin Yue/1234`.
- Local OpenClaw source build remains incomplete in this checkout; setup/start scripts use packaged CLI fallback when needed.

## Latest Task

Date: 2026-06-23

User request: full code review and test pass for the Memory Agent, with fixes for commercial readiness and fuller Chinese-translated analysis reports.

### Main Behavior Delivered

- Audited the current Memory Agent flow from `记忆整理` upload/paste/screenshot intake through hidden OpenClaw task execution, marker parsing, API normalization, durable Accio storage, and report rendering.
- Hardened the hidden Accio prompt in `employee-task-runner.ts` so new analyses must return `report_zh`, `summary_zh`, Chinese next actions, Chinese price context, and explicit unit-vs-total price fields.
- Synchronized the source `cbe-accio-memory` workspace contract in `AGENTS.md` and `skills/deal-summary/SKILL.md`; no non-native workspace files were introduced.
- Fixed normalization gaps: object-shaped `next_actions` no longer drop in `employee-task-runner.ts`, numeric amounts are preserved in compact action text, and `employee-api.ts` keeps `report_zh` / `translation_zh` / `memory_preview.summary_zh`.
- Expanded `/employee/memory` report detail into Chinese operator sections:
  - `完整分析报告`
  - `客户档案`
  - `咨询内容与采购意图`
  - `价格与条款`
  - `客户判断与风险信号`
  - `写入记忆预览`
  - `背调交接`
- Added Chinese field labels for purchase intent, behavior/risk signals, handoff payloads, and missing fields. Price labels now cover new unit/total fields such as `quoted_unit_price_usd`, `agreed_unit_price_usd`, `quoted_total_usd`, and `agreed_total_usd`.
- Added regression checks to `scripts/test-cross-border-phase2-store.ts` for the bilingual Accio prompt contract, `report_zh` preservation, object next-action handling, and complete Chinese report rendering.

### Verification Completed

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 198/198.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 413/413.
- Browser smoke: Dashboard at `http://localhost:3000` returned 200; logged in as `Lin Yue/1234`; `/client-demos/cross-border/employee/memory` rendered one memory record; opening detail showed the new Chinese report sections without runtime failure. Pre-login 401 console entries were expected auth redirects.

### Files Updated In Latest Pass

- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/agents/cbe-accio-memory/AGENTS.md`
- `sentura/agents/cbe-accio-memory/skills/deal-summary/SKILL.md`
- `scripts/test-cross-border-phase2-store.ts`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `outputs/resume_card.md`
- `outputs/task_handoff.md`

### Boundary

- This pass did not launch a paid/live vision-model reanalysis. Existing already-analyzed memory rows only gain the new `report_zh` structure after reanalysis.
- Remaining P2.5 work is still approval-to-memory promotion, missing-field resolution workflow, screenshot retry/reupload UX, durable Screening handoff consumption, Screening fan-out, and queue-drain behavior.

## Previous Task

Date: 2026-06-22

User request: implement the approved “记忆 Agent 多格式导入与自动建档方案”.

### Main Behavior Delivered

- `记忆整理` new-record modal now supports:
  - `JSON 文件`
  - `粘贴文字`
  - `聊天截图`
- The official `阿里国际站`/Alibaba API import option was removed from the UI. Historical labels can still display for old rows.
- Frontend no longer has a fixed screenshot count limit. It validates per-image format/size and relies on hidden task batching for payload control.
- Screenshot import uses OpenClaw Gateway chat attachments; the runner sends image transcript preflight batches and then a final summary/handoff prompt.
- The task uses the configured `cbe-accio-memory` OpenClaw employee model/provider. No OpenAI hardcoding was added. Screenshot mode requires the configured model/provider to support image attachments.
- Text import handles incomplete copied snippets and uses placeholders/missing fields instead of fabricating customer/company facts.
- Raw screenshots are not durably stored and are not written to vector memory. Persisted data is metadata/hash/redacted text/structured summaries/pending facts/handoff payloads.

### Important Code Paths

- New normalizer:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/memory-import-normalizer.ts`
- Employee Memory UI:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- Hidden task runner:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- Employee API mapper:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
- Gateway attachments:
  - `sentura/dashboard/src/lib/gateway/client.ts`
  - `sentura/dashboard/src/lib/gateway/types.ts`
  - `sentura/dashboard/src/lib/gateway/index.ts`
- Accio store/persistence:
  - `sentura/dashboard/src/lib/cross-border-store/accio.ts`
  - `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
  - `sentura/lib/cross-border-store/migrations/007_accio_manual_import_formats.sql`
- Accio employee behavior:
  - `sentura/agents/cbe-accio-memory/AGENTS.md`
  - `sentura/agents/cbe-accio-memory/HEARTBEAT.md`
  - `sentura/agents/cbe-accio-memory/config.json5`
  - `sentura/agents/cbe-accio-memory/skills/accio-upload-intake/SKILL.md`
  - `sentura/agents/cbe-accio-memory/skills/chat-normalization/SKILL.md`
  - `sentura/agents/cbe-accio-memory/skills/deal-summary/SKILL.md`

### Persistence / Schema

Migration `007_accio_manual_import_formats.sql` adds:

- `accio_imports.source_kind`
- `accio_imports.input_format`
- `accio_imports.attachment_metadata_json`
- `accio_imports_source_kind_idx`

Valid new manual source/input values:

- `manual_json` + `json`
- `manual_text` + `pasted_text`
- `manual_image` + `image`

The schema still allows historical `alibaba_international`, `demo_data`, and `other` for provenance compatibility.

### Agent Output Contract

`ACCIO_SUMMARIES_JSON_START/END` must contain:

```json
{ "summaries": [] }
```

The agent must:

- preserve `missing_fields`;
- not invent company, country, contact, website, or email;
- identify stock/lead-time/shipping answers when present;
- mark screenshot transcription uncertainty.

### UI Report Detail

The memory report dialog now displays:

- customer profile;
- inquiry / purchase intent;
- price, shipment, payment, and negotiated terms;
- chat summary;
- missing fields;
- memory-write preview;
- Screening handoff recommendation.

### Manual Test Fixtures

The previous short/fragmented sample files were deleted at the user's request. Current fixture pack contains one complete Rossi Telecom SRL customer conversation:

- `outputs/memory-agent-samples/text/rossi_telecom_complete_chat.txt`
- `outputs/memory-agent-samples/json/rossi_telecom_complete_accio_export.json`
- `outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_01.png`
- `outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_02.png`
- `outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_03.png`
- `outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_04.png`
- `outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_05.png`
- `outputs/memory-agent-samples/README.md`
- `outputs/memory-agent-samples/generate_complete_case.py`

Fixture validation completed: generator ran, JSON passed `python3 -m json.tool`, inspection confirmed `message_count=31`, `attachment_count=6`, buyer company `Rossi Telecom SRL`, `missing_fields=[]`, and all five PNGs opened through Pillow with valid dimensions and size under 10 MB.

### Live Workspace Sync

`~/.openclaw/workspace/cbe-accio-memory` was synced from source. Rechecked:

- top-level Markdown files are exactly the 8 OpenClaw-native files;
- no `RULES.md`;
- no `CONTEXT.md`.

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

## Verification Completed

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 413/413.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 195/195.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS, applied `007_accio_manual_import_formats.sql`.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 217/217.
- `bash -n scripts/sentura-setup.sh && bash -n scripts/start-sentura-demo.sh`: PASS.
- Browser smoke: logged in as `Lin Yue/1234`, opened `/client-demos/cross-border/employee/memory`, verified the three import modes, no official Alibaba/API source button, pasted text sample enables actions, screenshot selection shows file metadata and enables only `导入并分析`, and no new post-login console errors. Pre-login 401s were expected unauthenticated prefetches.
- Manual fixture validation: PASS, regenerated the complete Rossi Telecom fixture, validated JSON with `python3 -m json.tool`, inspected 31 messages / 6 attachments / empty missing fields, and checked all PNGs through Pillow.

## Boundaries And Remaining Work

- No real external AI/vision screenshot analysis task was launched. This would require a vision-capable model/provider configured for `cbe-accio-memory`.
- Screenshot imports cannot be reanalyzed from stored raw images. The user must re-upload screenshots for retry/reanalysis.
- `仅导入` is intentionally unavailable for screenshot mode.
- Remaining P2.5 work:
  - Screening parent task + single-target child-run fan-out.
  - Queue draining/claim behavior for queued `agent_runs`.
  - Paid email/trade retry approval state.
  - Accio approval-to-memory promotion.
  - Missing-field resolution workflow.
  - Screenshot retry/reupload UX.
  - Durable Screening handoff consumption.
