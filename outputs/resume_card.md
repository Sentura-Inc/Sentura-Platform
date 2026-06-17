# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese UI labels.

Latest completed task, 2026-06-17:

- Completed Phase 2 P2.2 typed Dashboard store/API routes from `跨境电商/PHASE-2.md`.
- Added typed Dashboard store modules under `sentura/dashboard/src/lib/cross-border-store/`.
- Added Employee API routes under `sentura/dashboard/src/app/api/client-demos/cross-border/employee/`:
  - customers, tasks, notifications, memory reads;
  - Lead/Screening/Accio create and complete routes;
  - task dismiss, notification read, handoff create.
- Added Admin read-only monitoring API routes under `sentura/dashboard/src/app/api/client-demos/cross-border/admin/`:
  - overview, live-tasks, customers, operators, operators/[id], agent-usage.
- Completion routes validate marker payloads with Zod before DB writes.
- Lead/Screening evidence-bearing markers require source URLs and fetched timestamps.
- Marker validation failures can mark referenced `agent_runs` as `failed` with `marker_parse_failed` and audit metadata.
- Lead writes now persist run/candidate/source/identity/result/activity/audit rows.
- Screening writes now persist target/report/evidence/score-block/activity/audit rows.
- Accio writes now persist import/conversation/hash-redacted messages/summary/pending memory fact/handoff/activity/audit rows.

Verification:

- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 109/109.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 129/129.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- Focused Dashboard ESLint for new store/routes: PASS.
- `cd sentura/dashboard && pnpm build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.

Docs updated:

- `跨境电商/PHASE-2.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`

Important boundary:

- P2.2 is server/store/API only.
- The Employee React pages still use `use-cbe-employee-store` / localStorage as the UI source of truth until P2.3.

Next:

- Start P2.3 Employee UI migration:
  - read customer/task/memory/notification state from P2.2 endpoints;
  - keep localStorage only for drafts/cache or explicit fallback;
  - call completion endpoints after hidden task marker parsing;
  - refresh DB-backed lists after successful writes.
