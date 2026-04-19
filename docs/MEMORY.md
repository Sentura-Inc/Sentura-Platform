# Sentura Development Memory

> ## ⚠️ Historical log — do NOT treat as specification ⚠️
>
> This file is an **append-only audit log** of development sessions, reorganized on 2026-04-19 into a **table of contents** that points at per-person / per-week detail files under `docs/memory/`. Older entries describe designs that have since been superseded. In particular, anything in the detail files that mentions `RULES.md` or `CONTEXT.md` as real workspace files is **historical only** — those files were fully removed on 2026-04-17 and must not be reintroduced.
>
> **Current policy** (authoritative sources: `.cursorrules` and `docs/TeamPlan.md`):
> - Sentura agent workspaces use exactly the 8 OpenClaw-native files.
> - Hard safety boundaries live inside `AGENTS.md → ## Hard Rules (must not override)`.
> - Enterprise context lives inside `BOOTSTRAP.md → ## Enterprise Context`.
> - The `sentura-bootstrap` hook injects only per-user memory (`memory/users/MEMORY_USER_{token}.md`).
>
> If anything in the detail files contradicts the current policy, the current policy wins. Do not mine `docs/memory/**` for requirements.
>
> **Structure.** `docs/MEMORY.md` is the matrix. Session prose and decision records live in:
> - `docs/memory/person-{a,b,c,d}/week-{N}.md` — per-owner, per-week
> - `docs/memory/shared/*.md` — cross-cutting sessions (architecture pivots, workspace collapses, multi-round bug hunts)
>
> **How to use this file.** Find the row for your task's area/week, open the linked detail file, read only the sections you need. The matrix is cheap to skim; the details are on-demand.
>
> **Writing policy.** Add new sessions as a new row in the matrix **and** a new section in the appropriate detail file (create a new `week-N.md` if crossing into a new sprint week). Never delete prior rows; summaries are allowed, but every session date, decision, file path, and fix must remain traceable from the matrix.

## Current Ground Truth (2026-04-20)

- **Workspace convention.** Exactly 8 OpenClaw-native files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`. Plus `skills/`, `ekg/` (4-pillar), `memory/users/`, `config/`.
- **Safety boundaries.** `AGENTS.md → ## Hard Rules (must not override)` (highest priority).
- **Enterprise context.** `BOOTSTRAP.md → ## Enterprise Context`.
- **Per-user memory.** `sentura-bootstrap` hook injects `memory/users/MEMORY_USER_{token}.md` based on the user token embedded in the session key; everything else is static on disk.
- **RBAC.** 7 roles: Platform Admin, Department Admin, Employee Owner, Auditor, Employee-User, Channel-Guest, Service-Account.
- **Creator deployment path (post-Round 14).** Forge reads config via the `agent-config-schema` skill; writes go through the `sentura_agents_manage` tool (gateway RPC, not `fs_write`); owner-only tools are granted to the webchat operator via `commands.ownerAllowFrom`; stale sandbox workspaces are re-seeded by the setup hook on every install.

## Session Matrix

Each row links to the detail file where that session's prose, code diffs, verification steps, and open questions are preserved.

### Week 1 (Foundation)

| Date | Owner | Session | Detail file |
|---|---|---|---|
| 2026-03-28 | shared | Major Architecture Pivot: OpenClaw-Based AI Employees | [`memory/shared/architecture-pivot-2026-03-28.md`](memory/shared/architecture-pivot-2026-03-28.md) |
| 2026-04-05 | A | Week 1 Person A: Platform Foundation & OpenClaw Setup | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-05 | A | Docker Architecture Overhaul & Final Fixes | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-05 | A | OpenClaw Technical Analysis | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-05 | A | Switch from Docker to Local Development Setup | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-05 | A | OpenClaw vs Sentura Gap Analysis & README/SETUP Accuracy Update | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-05 | A | docs/TeamPlan.md Full Rewrite for 12-Capability Alignment | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-05 | A | Capability #13: Pre-Deployment Testing & Validation | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-05 | A | Critical Config Schema Discovery & Sentura-OpenClaw Integration Architecture | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-05 | B | Week 1 Person B: Creator Agent, Workspace Convention, Templates, Skills | [`memory/person-b/week-1.md`](memory/person-b/week-1.md) |
| 2026-04-05 | B | Workspace Path Architecture Fix (OpenClaw State Directory Integration) | [`memory/person-b/week-1.md`](memory/person-b/week-1.md) |
| 2026-04-06 | A | Sentura Bootstrap Hook (RULES.md + CONTEXT.md injection — historical; since removed) | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-06 | C | Week 1 Person C: Dashboard Scaffold, RPC Client, App Shell, Employee Roster, Session View | [`memory/person-c/week-1.md`](memory/person-c/week-1.md) |
| 2026-04-06 | C | Fix: Gateway WebSocket Protocol Alignment | [`memory/person-c/week-1.md`](memory/person-c/week-1.md) |
| 2026-04-06 | A | Created docs/HOSTING.md Production Hosting Guide | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-06 | A | Added Security Risk Analysis to docs/HOSTING.md | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-06 | C | Hybrid Dashboard Revision (Approach C) | [`memory/person-c/week-1.md`](memory/person-c/week-1.md) |
| 2026-04-06 | A | Post-Review Cleanup (Week 1 Polish) | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-08 | D | Person D Week 1 Complete (industries, GradSale scaffold, Sales Manager, sample data) | [`memory/person-d/week-1.md`](memory/person-d/week-1.md) |
| 2026-04-08 | A | Cross-Platform Setup Scripts (Linux + Windows) | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-08 | A | docs/TESTS.md Policy Added to Project Rules | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |
| 2026-04-08 | C | Sentura Communication Panel Design & Plan | [`memory/person-c/week-1.md`](memory/person-c/week-1.md) |
| 2026-04-08 | D | Enterprise Knowledge Graph (EKG) Architecture Documentation | [`memory/person-d/week-1.md`](memory/person-d/week-1.md) |
| 2026-04-11 | A | OpenClaw Technical Analysis & Sentura Integration Evaluation Report | [`memory/person-a/week-1.md`](memory/person-a/week-1.md) |

### Week 2 (AI Employee Creation & Enterprise Integration Foundation)

| Date | Owner | Session | Detail file |
|---|---|---|---|
| 2026-04-13 | shared | Three Major Design Updates: RBAC Redesign (5→7), Per-User Memory Isolation, MCP Builder Agent | [`memory/shared/design-updates-2026-04-13.md`](memory/shared/design-updates-2026-04-13.md) |
| 2026-04-15 | A | Week 2 Person A: Platform Utilities, Memory Isolation, User Tokens, RBAC Update | [`memory/person-a/week-2.md`](memory/person-a/week-2.md) |
| 2026-04-16 | A | Week 2 Person A: Reevaluation & Bug Fixes | [`memory/person-a/week-2.md`](memory/person-a/week-2.md) |
| 2026-04-16 | B | Week 2 Person B: Creator Agent, EKG Schema, Industry Ontologies, MCP Builder | [`memory/person-b/week-2.md`](memory/person-b/week-2.md) |
| 2026-04-16 | B | Week 2 Person B: Live-Gateway Integration Tests Passing (77/77) | [`memory/person-b/week-2.md`](memory/person-b/week-2.md) |
| 2026-04-16 | B | Week 2 Person B: Re-evaluation corrections | [`memory/person-b/week-2.md`](memory/person-b/week-2.md) |
| 2026-04-17 | C | Week 2 Person C: Dashboard UI for Create / Detail / Approvals | [`memory/person-c/week-2.md`](memory/person-c/week-2.md) |
| 2026-04-17 | C | Person C: Per-employee conversations in `/create` (sidebar, rename, delete) | [`memory/person-c/week-2.md`](memory/person-c/week-2.md) |
| 2026-04-17 | C | Person C: Creator sandbox-escape fix (`agent-config-schema` skill) | [`memory/person-c/week-2.md`](memory/person-c/week-2.md) |
| 2026-04-17 | shared | Collapse Sentura's 10-file workspace into OpenClaw's native 8 + RULES/CONTEXT scrub | [`memory/shared/workspace-collapse-2026-04-17.md`](memory/shared/workspace-collapse-2026-04-17.md) |
| 2026-04-17 → 2026-04-20 | shared (A/B/C interleaved) | Creator Deployment Bug-Fix Rounds 1–14 (sentura-agents, ownerAllowFrom, exec host, AGENTS.md Hard Rule, Forge model/skills, stale sandbox, dashboard session, E2E PASS, MCP Builder repair) | [`memory/shared/creator-deployment-rounds-1-14.md`](memory/shared/creator-deployment-rounds-1-14.md) |

### Weeks 3–8 (not yet started)

No sessions logged. See `docs/TeamPlan.md` for the planned scope. When sessions start, add rows here and create `docs/memory/person-*/week-{3..8}.md` detail files as needed.

---

## Session Summaries (meta)

### 2026-04-19 — Memory Reorg Audit & `.cursorrules` Alignment

Re-evaluated the memory reorg for content loss and cross-doc alignment. Results:

- **Content preservation**: 50/50 original dated headings (`## 2026-*` ×40 + `### 2026-*` ×10) present verbatim in detail files; 0 drift. Every non-trivial line from the original 3,623-line body is reachable in `docs/memory/person-*/*.md` or `docs/memory/shared/*.md`. Every session heading lives in exactly one detail file (no duplicates). Every detail-file link from the matrix resolves to an existing file.
- **`.cursorrules` alignment**: rule 1 rewritten as explicit Start / End / Bootstrap / Preservation steps so the per-person/per-week split is unambiguous; rule 4 adds the paired MEMORY.md matrix + detail-file update (mirrors the TESTS.md matrix + `docs/tests/*` detail-file rule); File Naming Conventions now covers `docs/memory/` and `docs/tests/` trees.
- **`docs/TeamPlan.md` preamble**: extended the historical-log warning to cover any `docs/memory/**` file, not just `docs/MEMORY.md`.
- **`README.md` Key Documentation table**: added two rows for `docs/memory/person-*/week-*.md` (on-demand) and `docs/memory/shared/*.md` (on-demand); tightened MEMORY.md row to call it "matrix / TOC".
- **`docs/TESTS.md` DOC checks**: already updated to DOC1 (≤1,500-line mandatory context), DOC2 (≥19 on-demand banners), DOC6 (memory matrix ↔ detail files). All PASS. Current mandatory-context total: 1,338 lines (README 285 + MEMORY 107 + TeamPlan 769 + TESTS 177).

No code changed in this pass.

### 2026-04-19 — Doc Reorganization Pass: MEMORY.md → per-person / per-week split

Rewrote `docs/MEMORY.md` (3,637 lines) as the 2-week matrix above, pointing at 11 detail files under `docs/memory/` — one per (owner, week) plus four shared cross-cutting session groups. Every original line below the 14-line preamble (3,623 body lines) was sliced verbatim into exactly one detail file (no overlaps, no gaps):

- `memory/person-a/week-1.md` — 15 sessions / ~549 lines
- `memory/person-b/week-1.md` — 2 sessions / ~143 lines
- `memory/person-c/week-1.md` — 4 sessions / ~211 lines
- `memory/person-d/week-1.md` — 2 sessions / ~148 lines
- `memory/person-a/week-2.md` — 2 sessions / ~137 lines
- `memory/person-b/week-2.md` — 3 sessions / ~291 lines
- `memory/person-c/week-2.md` — 3 sessions / ~364 lines
- `memory/shared/architecture-pivot-2026-03-28.md` — ~45 lines
- `memory/shared/design-updates-2026-04-13.md` — ~95 lines
- `memory/shared/workspace-collapse-2026-04-17.md` — 2 sessions / ~220 lines
- `memory/shared/creator-deployment-rounds-1-14.md` — 15 section headings covering Rounds 1–14 + E2E PASS / audit / ~1,646 lines

Every file carries an "On-demand reference — not read by default" banner and a back-link to this matrix. `.cursorrules` rule 1 and rule 4 updated accordingly: `docs/MEMORY.md` stays mandatory; the detail files are reference-only. Mandatory per-chat context from the memory system drops from ~3,650 lines (old `MEMORY.md`) to ~104 lines (this matrix). Total information preserved: 100%.

No code changed in this pass.
