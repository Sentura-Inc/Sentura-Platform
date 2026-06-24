# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese product/customer/UI names unchanged.

Active product area: Cross-border e-commerce / 跨境电商 Phase 2 production hardening.

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
