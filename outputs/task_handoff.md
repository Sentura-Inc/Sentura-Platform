# Sentura CBE Lead Internal Batching and Overflow Retry 2026-06-29

## Task Introduction

The user reported that Lead Discovery sometimes fails when asking for many customers with an OpenClaw error like:

`context overflow: estimated context size exceeds safe threshold during tool loop`

The requested fix is "internal batching + overflow auto retry" without lightening Lead research quality. The user clarified that this should apply to any single Lead request above 5, not only target count 10.

## Workspace And Environment

Repo: `/Users/henry/Desktop/Sentura-Platform`.

Primary files changed for this task:

- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
- `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
- `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/admin.ts`
- `scripts/test-cross-border-agents.ts`
- `scripts/test-cross-border-phase2-store.ts`
- CE47 docs/tests/memory files.

## Diagnosis

Lead Discovery asks the OpenClaw `cbe-lead-discovery` Agent to search, browse, evaluate, dedupe, and output multiple customer records in one hidden task. When target counts are high, the Agent can accumulate enough tool-loop context that OpenClaw refuses to continue before the Dashboard receives a marker payload.

Reducing evidence requirements would reduce report quality. The correct fix is to keep the same Lead work but split large target counts into independent smaller hidden runs, then merge the structured results.

## Current State

Implementation is complete locally.

What changed:

- Added `LEAD_INTERNAL_BATCH_MAX_TARGET_COUNT = 5`.
- Added `shouldInternallyBatchLeadTask()` so only `targetCount > 5` is internally batched.
- Added balanced internal split sizing:
  - `6 => 3 + 3`
  - `7 => 4 + 3`
  - `8 => 4 + 4`
  - `9 => 5 + 4`
  - `10 => 5 + 5`
- Added hidden Lead batch metadata (`internal_batch`) to the Agent payload/prompt.
- Added separate OpenClaw sessions per internal batch.
- Added parallel batch execution with `Promise.allSettled`.
- Added context-overflow detection for safe-threshold/context-size/context-window/prompt-too-long errors.
- Added recursive force-split retry when a sub-batch overflows.
- Merged successful child payloads into one final Lead payload before normal DB completion/reconciliation.
- Persisted `internal_session_keys` and `internal_batching` in Lead completion metadata.
- Updated Admin/Employee cost session scoping so `agent_runs.metadata_json.internal_session_keys` are included when reading Sentura cost events.
- Added CE47 static regression coverage in CBE agent and store scripts.

## Verification

Completed locally:

- `pnpm --dir sentura/dashboard exec eslint --quiet src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts src/app/client-demos/cross-border/employee/_data/employee-api.ts src/lib/cross-border-store/schemas.ts src/lib/cross-border-store/lead-runs.ts src/lib/cross-border-store/admin.ts`: PASS.
- `pnpm --dir sentura/dashboard exec tsc --noEmit --pretty false`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: CE47 assertion PASS; broad script exits nonzero with 447 passed / 6 unrelated existing failures.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: CE47 assertion PASS; broad script exits nonzero with 250 passed / 3 unrelated existing failures.
- `git diff --check`: PASS.

Known broad-script caveat from prior CBE work: these scripts may still exit nonzero because of unrelated existing assertions, but CE47 labels should pass.

## Boundaries

- This does not lighten Lead Discovery source policy, evidence collection, or output requirements.
- Employee UI still exposes one requested target count up to 10.
- The split is internal to hidden runner execution and completion metadata.
- This is local only. It has not been deployed to ECS/public domains.
