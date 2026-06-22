> **On-demand reference — not read by default.** Back-link: [`docs/MEMORY.md`](../../MEMORY.md)

# Context Handoff Optimization

This shared memory file records the 2026-06-15 convention for low-token continuation across Codex chat windows.

## Sessions in this file

| Date | Session |
|---|---|
| 2026-06-15 | Resume card and handoff read-order optimization |

## 2026-06-15 — Resume card and handoff read-order optimization

**Problem.** Long Sentura tasks often continue in a fresh chat window after context pressure. Reading the full handoff, project memory matrix, and linked detail files at every restart wastes context before the actual work resumes.

**Decision.**
- `outputs/resume_card.md` is the first-read file for unfinished tasks. It stays short and records the current goal, current state, next 3 actions, working set, and last verification.
- `outputs/task_handoff.md` remains the complete current-task handoff, but new chats should read only its relevant `Current State` and `Next Steps` sections first.
- `docs/MEMORY.md` remains the durable project memory matrix, but continuation chats use it as a targeted index only when the resume card or handoff points to a specific prior session.
- Linked `docs/memory/**` detail files remain on demand. Do not load the full memory tree by default.
- User-facing conversation remains Chinese. The two continuation files are primarily concise English for token efficiency, while exact Chinese product/customer/UI wording is preserved when it matters.
- The practical handoff trigger is near 85% visible context use. When exact percentage is unavailable, update both continuation files before long scans, risky multi-file edits, long-running commands, extended debugging loops, and major phase transitions.

**Files updated.**
- `outputs/resume_card.md`
- `outputs/task_handoff.md`
- `AGENTS.md`
- `README.md`
- `docs/MEMORY.md`
- `docs/memory/shared/context-handoff-2026-06-15.md`

**Verification.**
- Documentation/workflow change only; no application build or runtime test is required.
- Existing unrelated dirty worktree changes were intentionally left untouched.
