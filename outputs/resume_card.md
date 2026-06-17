# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese UI labels.

Completed task, 2026-06-17:

- Created dedicated Phase 2 CBE memory and test detail docs.
- Updated AGENTS.md and README doc hub so future CBE Phase 2 work uses the new files by default.
- Preserved Phase 1/MVP docs as historical/regression sources.

New active Phase 2 docs:

- Memory: `docs/memory/cross-border-ecommerce/phase-2.md`
- Tests: `docs/tests/tests-cross-border-phase2.md`

Changed routing:

- `docs/MEMORY.md` Phase 2 rows now point to `phase-2.md`.
- `docs/TESTS.md` CE17/CE18 detail links now point to `tests-cross-border-phase2.md`.
- `docs/memory/cross-border-ecommerce/phase-1.md` now states it is historical Phase 1/MVP memory.
- `docs/tests/tests-cross-border-ecommerce.md` now states CE17+ active details live in the Phase 2 test file.

Verification:

- New files have on-demand banners.
- On-demand banner count is 50; DOC2 updated to `>= 50`.
- `git diff --check`: pass.
- No `RULES.md` / `CONTEXT.md` files found.

Next:

- Continue P2.2 typed Dashboard store API and route handlers.
- For all new CBE Phase 2 memory/tests, write to `phase-2.md` and `tests-cross-border-phase2.md`.
