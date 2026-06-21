# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese product/customer/UI names unchanged.

Active product area: Cross-border e-commerce / 跨境电商 Phase 2 production hardening.

Latest completed task, 2026-06-21:

- Fixed the Lead coordinator semantics exposed by the real 吴思彤/张昊翔 retest.
- Root cause: the previous completed-scope path treated a normal repeated `找 10 个新客户` request as "top up this employee's visible list to 10 total"; therefore the latest runs were `top_up_unique_leads` with `target_count = 1` for 吴思彤 and `target_count = 5` for 张昊翔. The database itself had no duplicate visible domains and final owner counts were 吴思彤 11, 张昊翔 10.
- New rule: a normal Lead request target means net-new customers for the current request. A repeated same-scope `target_count = 10` now starts an executable run for 10 more unique customers with the tenant DB denylist. Only internal `run_mode = "top_up_unique_leads"` auto-recovery uses the missing-count remainder.
- Strengthened the hidden Lead prompt and `cbe-lead-discovery` workspace rules: over-collect raw candidates before final dedupe, treat `max_results_per_query` as a per-query hint not a total cap, replace denylist hits, and continue with search-result evidence when `web_fetch` is blocked by local security policy.
- Increased Employee auto top-up attempts from 4 to 8 and changed incomplete Lead final notices from success tone to error tone.
- Synced `~/.openclaw/workspace/cbe-lead-discovery/AGENTS.md`, `skills/lead-query-generation/SKILL.md`, `skills/lead-deduplication/SKILL.md`, and `skills/lead-list-production/SKILL.md`; all four match the repo by `cmp`.

Verification:

- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 38/38.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `CBE_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev' pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 204/204.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 394/394.
- `pnpm --dir sentura/dashboard build`: PASS with existing Next workspace-root warning only.
- `git diff --check`: PASS.

Files intentionally edited for this task:

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

Current dirty worktree note:

- The workspace already contains many unrelated modified/untracked files from previous CBE Phase 2 work. Do not revert them unless the user explicitly asks.

Next:

- User can retest by refreshing/restarting the Gateway so the updated `.openclaw` workspace prompt is loaded, then ask each employee to run `找 10 个新客户`.
- Remaining P2.5 implementation starts with Screening parent/child fan-out, queue draining/claim behavior, paid-call retry state, durable Screening report UX, Accio approval-to-memory promotion, and Screening handoff consumption.
