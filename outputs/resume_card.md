# Active Task: CBE Lead Internal Batching and Overflow Retry

Started/completed 2026-06-29 in `/Users/henry/Desktop/Sentura-Platform`.

- User reported intermittent Lead Discovery failures such as `context overflow: estimated context size exceeds safe threshold during tool loop`.
- Required behavior: do not lighten Lead research. Any single Employee `寻找客户` request with target count above 5 must be split internally into hidden sub-runs, and overflow in a sub-run must trigger automatic smaller-batch retry.
- Implemented locally:
  - `targetCount <= 5` still runs as one OpenClaw Lead Discovery session.
  - `targetCount > 5` uses balanced hidden batches of at most 5:
    - `6 = 3 + 3`
    - `7 = 4 + 3`
    - `8 = 4 + 4`
    - `9 = 5 + 4`
    - `10 = 5 + 5`
  - Hidden batches run as separate OpenClaw sessions and are merged into one final Lead payload before normal DB reconciliation/top-up.
  - Sub-batches that fail with context overflow / safe threshold / context-window style errors are recursively split and retried.
  - The Lead prompt receives `internal_batch` metadata so the Agent only completes the current sub-target and tries different search-result segments for later batches.
  - The merged payload records `internal_session_keys` and `internal_batching` in `agent_runs.metadata_json`.
  - Admin/Employee cost attribution now includes internal child session keys, so split Lead runs do not disappear from cost totals.
  - CE47 static regression assertions were added to both CBE agent and Phase 2 store scripts.
- Verification:
  - Focused ESLint over touched Lead/store files PASS.
  - Dashboard typecheck PASS.
  - `scripts/test-cross-border-agents.ts`: CE47 PASS; broad result 447 passed / 6 unrelated existing failures.
  - `scripts/test-cross-border-phase2-store.ts`: CE47 PASS; broad result 250 passed / 3 unrelated existing failures.
  - `git diff --check`: PASS.
- Deployment status: local only; not deployed to ECS/public domains.
