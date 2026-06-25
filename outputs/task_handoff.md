# Sentura CBE Task Handoff

Default continuation rule: read `outputs/resume_card.md` first. Then read this file only if deeper context is needed. Use `docs/MEMORY.md` as an index when a specific prior session is required.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep exact Chinese UI labels unchanged when relevant.

## Current Resume Snapshot

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
