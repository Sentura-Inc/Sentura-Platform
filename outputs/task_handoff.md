# Sentura CBE Continuation Handoff

## Current Resume Snapshot

Default continuation rule: read `outputs/resume_card.md` first. Then read only this snapshot and `Next Steps` unless deeper history is required. Use `docs/MEMORY.md` as an index only when a specific prior row is needed.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce / 跨境电商 Phase 2 production hardening.

## Latest Completed Task

Date: 2026-06-21

Task: fix the Lead strict current-request target semantics after the live two-operator retest where 吴思彤 and 张昊翔 each asked for 10 new customers but the visible latest run outputs were 1 and 5.

### Root Cause

- DB inspection showed final visible Lead owner counts were 吴思彤 = 11 and 张昊翔 = 10, with no duplicate `normalized_domain` rows.
- The latest two runs were not full normal requests:
  - 吴思彤: `lead_run_3448b710-9b0e-4c9b-b035-66a66565c514`, `run_mode = top_up_unique_leads`, `target_count = 1`.
  - 张昊翔: `lead_run_8a39b090-0a61-4bf5-8029-f55655a431ff`, `run_mode = top_up_unique_leads`, `target_count = 5`.
- The old completed-scope logic treated a repeated normal same-scope request as "fill this employee's current list up to the requested target total". That made a user-entered "找 10 个新客户" look like it only requested/saved the remaining 1 or 5.
- Product rule now clarified: a normal Lead request target means net-new customers for the current request, not visible-list total. Only automatic internal top-up runs use the missing-count remainder.

### Implementation

- `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts`
  - Removed the owner-scope count discount from completed-scope normal requests.
  - Normal requests always create `run_mode = new_scope` with `target_count = input.target_count`, even if the same scope was completed before.
  - Explicit `run_mode = top_up_unique_leads` still creates `queue_top_up` and treats `target_count` as the missing-count target.
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - Strengthened hidden Lead prompt: `target_count` is a hard net-new customer target for this request; `max_results_per_query` is only a per-query hint; denylist hits must be replaced; `web_fetch` security blocks should not terminate discovery when `web_search` has company-owned URL/title/snippet evidence.
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - Increased `MAX_LEAD_COMPLETION_ATTEMPTS` from 4 to 8.
  - Incomplete final Lead notices now use error tone instead of success tone.
- `sentura/agents/cbe-lead-discovery/AGENTS.md`
  - Added strict `target_count` net-new semantics and `existing_identity_keys` replacement rules to hard workflow expectations.
- `sentura/agents/cbe-lead-discovery/skills/lead-query-generation/SKILL.md`
  - Added over-collection guidance, strict current-request target semantics, denylist replacement, and `web_fetch` blocked fallback behavior.
- `sentura/agents/cbe-lead-discovery/skills/lead-deduplication/SKILL.md`
  - Denylist-dropped candidates no longer count toward target; retained final leads should equal `target_count` where public search allows.
- `sentura/agents/cbe-lead-discovery/skills/lead-list-production/SKILL.md`
  - Final `leads` array should contain exactly `target_count` net-new candidates unless `shortage_reason` explains exhausted public sources/replacement searches.
- Synced the four Lead workspace behavior files to `~/.openclaw/workspace/cbe-lead-discovery` and verified each with `cmp`.
- Updated CE21 tests so:
  - ordinary repeated completed scopes return `start_new_run`, carry denylist, and keep the full requested new-customer count;
  - explicit top-up requests return `queue_top_up` and preserve the missing-count target.
- Updated docs/tests/memory:
  - `跨境电商/PHASE-2.md`
  - `docs/TESTS.md`
  - `docs/tests/tests-cross-border-phase2.md`
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `outputs/resume_card.md`
  - `outputs/task_handoff.md`

## Verification

Commands run:

- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`
  - PASS, 38 passed, 0 failed.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`
  - PASS.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`
  - PASS, 204 passed, 0 failed.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`
  - PASS, 394 passed, 0 failed.
- `pnpm --dir sentura/dashboard build`
  - PASS. Existing Next warning about multiple lockfiles/workspace root only.
- `git diff --check`
  - PASS.
- DB inspection after the user retest:
  - owner counts: 吴思彤 11, 张昊翔 10.
  - duplicate `lead_candidates.normalized_domain`: none.
  - latest two successful user runs were top-up runs with target counts 1 and 5, confirming the old semantics bug.

## Current Dirty Worktree Note

The worktree contains many modified/untracked files from previous CBE Phase 2 work. Files intentionally touched for this task:

- `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/agents/cbe-lead-discovery/AGENTS.md`
- `sentura/agents/cbe-lead-discovery/skills/lead-query-generation/SKILL.md`
- `sentura/agents/cbe-lead-discovery/skills/lead-deduplication/SKILL.md`
- `sentura/agents/cbe-lead-discovery/skills/lead-list-production/SKILL.md`
- `scripts/test-cross-border-phase2-concurrency.ts`
- `scripts/test-cross-border-agents.ts`
- `跨境电商/PHASE-2.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `outputs/resume_card.md`
- `outputs/task_handoff.md`

Do not revert unrelated dirty files unless the user explicitly asks.

## Next Steps

1. User live retest: restart/refresh Gateway so the synced `~/.openclaw/workspace/cbe-lead-discovery` behavior files are loaded, then run `找 10 个新客户` with 吴思彤 and 张昊翔. Normal repeated scopes should now request 10 net-new customers per submission, not 1/5 top-up totals.
2. Continue P2.5: Screening parent task plus single-target child-run fan-out, queue claim/drain behavior, paid-call retry state, durable Screening evidence/report UX, Accio approval-to-memory promotion, and Screening handoff consumption.
