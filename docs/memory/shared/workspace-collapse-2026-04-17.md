> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md).

# Workspace Collapse: 10-file → native 8 (2026-04-17)

The decision (and follow-up scrub) that removed the Sentura-invented `RULES.md` and `CONTEXT.md` from every agent workspace. Hard safety boundaries now live inside `AGENTS.md → ## Hard Rules (must not override)`, and enterprise context lives inside `BOOTSTRAP.md → ## Enterprise Context`. Every template, test fixture, skill, and hook was updated in the same pass. Per-user memory (`memory/users/MEMORY_USER_{token}.md`) is the only runtime-injected extension.

> **Why this is shared, not per-person:** the change touched Person A's workspace creation lib + hook, Person B's Creator/Tuner/MCP-Builder workspaces, Person C's dashboard assertions, and Person D's enterprise templates — simultaneously.

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-17 | Collapse Sentura's 10-file workspace into OpenClaw's native 8 |
| 2026-04-17 | Scrub residual RULES.md / CONTEXT.md references |

---

## 2026-04-17 — Collapse Sentura's 10-file workspace into OpenClaw's native 8

**Context / problem:**
Sentura previously layered two extra workspace files on top of OpenClaw's
8 native workspace files:

- `RULES.md` — position-specific "hard boundaries" (NEVER / ALWAYS).
- `CONTEXT.md` — enterprise / department context (org, systems, policies).

Both were injected into each agent's system prompt via the
`sentura-bootstrap` hook. The problem: hook-injected content has *lower*
prompt priority than OpenClaw's native workspace files (AGENTS.md, SOUL.md,
TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md),
which OpenClaw's system prompt assembler loads first. The consequence —
observed multiple times with the Creator agent this week — was that the
runtime would still attempt actions the RULES.md explicitly forbade
(e.g. reading `~/.openclaw/config.json5`, reading the host OpenClaw
`docs/README.md`), because by the time the model saw the hook-injected
"NEVER" block, the native files had already framed what tools and files
were legitimate. The rules were there, just too late in the priority
order to stop sandbox escapes.

**Decision / resolution:**
Collapse the 10-file layout back down to OpenClaw's native 8. Move the
actual content, not just the labels:

1. `RULES.md` → new `## Hard Rules (must not override)` section inside
   each agent's `AGENTS.md`. AGENTS.md is OpenClaw's highest-priority
   native file, so hard rules now land at the top of the prompt.
2. `CONTEXT.md` → new `## Enterprise Context` section inside each
   agent's `BOOTSTRAP.md`. BOOTSTRAP.md is natively loaded and already
   carries org-scoped context, which is a natural home for things like
   "you work at GradSale; approvals >$500 require manager sign-off;
   here are the canonical tools and systems."
3. Narrow `sentura-bootstrap` hook to do exactly one thing: inject
   per-user memory from `memory/users/MEMORY_USER_{token}.md` when a
   session has a resolvable `userToken`. Per-user memory must be
   dynamic (different per conversation, not known at agent-create
   time), so it cannot live in a static native file — the hook stays,
   just with a much smaller responsibility.
4. Keep Sentura-specific subdirectories (`skills/`, `ekg/`,
   `memory/users/`) alongside the 8 native files. Those are not
   workspace files in OpenClaw's sense; they're complementary stores.

**What changed (concrete):**
- Source workspaces (`sentura/agents/{creator,tuner,orchestrator,mcp-builder}/`)
  now ship the 8 native files. `RULES.md` and `CONTEXT.md` deleted;
  their content merged into `AGENTS.md` (Hard Rules section) and
  `BOOTSTRAP.md` (Enterprise Context section).
- Runtime mirrors (`~/.openclaw/workspace/{creator,tuner,orchestrator,mcp-builder}/`)
  pulled back in sync with source. Any drifted runtime-only files were
  retained by merging into source first, then rewriting runtime from
  source.
- Role templates (`sentura/config/templates/ap-clerk`, `cs-agent`, `sdr`)
  and the `cs-agent-gradsale` workspace under
  `sentura/config/workspaces/` all migrated to the 8-file layout.
- `sentura/hooks/sentura-bootstrap/handler.ts` narrowed: no longer
  injects `RULES.md` / `CONTEXT.md`; only injects the matching
  `memory/users/MEMORY_USER_{token}.md` when the hook payload supplies
  a `userToken`. `HOOK.md` updated to reflect the new contract.
- `sentura/lib/workspace.ts` constants + `defaultFileContent` purged of
  `RULES.md` / `CONTEXT.md`. The BOOTSTRAP.md seed now includes the
  `## Enterprise Context` template section, and the AGENTS.md seed
  includes the `## Hard Rules (must not override)` template section.
- Dashboard (`sentura/dashboard/app/employees/[id]/page.tsx`,
  `sentura/dashboard/app/create/page.tsx`) no longer lists `RULES.md`
  or `CONTEXT.md` as first-class files. The 8 native files are shown;
  Hard Rules / Enterprise Context render as collapsible sections under
  AGENTS.md and BOOTSTRAP.md respectively.
- Creator skills (`sentura/agents/creator/skills/*/SKILL.md`) rewritten
  so "Design Phase 2" produces Hard Rules into AGENTS.md and
  Enterprise Context into BOOTSTRAP.md rather than emitting separate
  files.
- Tests / scripts updated: `scripts/test-hot-reload.sh`,
  `scripts/test-week2.ts`, `scripts/test-week2-b-gateway.ts`,
  `scripts/test-creator-helpers.ts`,
  `scripts/test-gateway-integration.ts`, `scripts/setup.sh`,
  `scripts/setup.ps1` now assert an 8-file workspace and explicitly
  assert that `RULES.md` / `CONTEXT.md` are *not* emitted.
- Docs updated: `README.md`, `docs/workspace-convention.md`,
  `docs/TESTS.md`, `docs/TeamPlan.md`, `docs/SETUP.md`,
  `docs/HOSTING.md`, `.cursorrules`, `Report.md`.

**Why not a different split (considered alternatives):**
- Keeping 10 files and boosting hook priority was rejected: the hook
  still runs after OpenClaw's native prompt assembler, so even with a
  higher-priority banner the *first* pages of the system prompt would
  still come from the 8 native files. The model consistently treated
  the native files as the authoritative frame.
- Inlining everything into AGENTS.md (including enterprise context)
  was rejected because AGENTS.md is meant for behavior/rules, not for
  long static context. Splitting hard rules vs. enterprise context
  across AGENTS.md and BOOTSTRAP.md preserves the intent of each
  native file.
- Killing per-user memory was not considered — per-user isolation is
  a product feature. It *has* to be dynamic, so the hook keeps its
  remaining job.

**Files touched (incomplete list — see commit diff):**
- `sentura/agents/{creator,tuner,orchestrator,mcp-builder}/AGENTS.md`
- `sentura/agents/{creator,tuner,orchestrator,mcp-builder}/BOOTSTRAP.md`
- `sentura/agents/{creator,tuner,orchestrator,mcp-builder}/RULES.md` (deleted)
- `sentura/agents/{creator,tuner,orchestrator,mcp-builder}/CONTEXT.md` (deleted)
- `sentura/hooks/sentura-bootstrap/{HOOK.md,handler.ts}`
- `sentura/lib/workspace.ts`
- `sentura/dashboard/app/employees/[id]/page.tsx`
- `sentura/dashboard/app/create/page.tsx`
- `sentura/config/templates/{ap-clerk,cs-agent,sdr}/**`
- `sentura/config/workspaces/cs-agent-gradsale/**`
- `sentura/agents/creator/skills/**/SKILL.md`
- `scripts/setup.sh`, `scripts/setup.ps1`,
  `scripts/test-hot-reload.sh`, `scripts/test-week2.ts`,
  `scripts/test-week2-b-gateway.ts`,
  `scripts/test-creator-helpers.ts`,
  `scripts/test-gateway-integration.ts`
- `README.md`, `docs/workspace-convention.md`, `docs/TESTS.md`,
  `docs/TeamPlan.md`, `docs/SETUP.md`, `docs/HOSTING.md`,
  `.cursorrules`, `Report.md`, `docs/MEMORY.md` (this entry)
- Runtime: `~/.openclaw/workspace/{creator,tuner,orchestrator,mcp-builder}/`
  regenerated from source to match the 8-file layout.

**Follow-ups / open questions:**
- `sentura/config/industry-ontologies/financial-services/` and a few
  common skills still reference `RULES.md` / `CONTEXT.md` in prose.
  Needs a sweep (tracked as `update-ontology-refs`).
- Need a dashboard `pnpm typecheck` + a fresh `/create` smoke test to
  confirm nothing downstream still looks for RULES.md / CONTEXT.md
  (tracked as `verify`).
- The `sentura-bootstrap` hook's new contract (per-user memory only)
  should eventually move under a `memory/` extension so the hook
  layer can shrink further. Not urgent.
- Creator agent sandbox escapes should be retested after this
  refactor — if the Hard Rules section inside AGENTS.md still gets
  overridden, the remaining lever is OpenClaw's sandbox policy itself
  rather than more prompt engineering.

## 2026-04-17 — Scrub residual RULES.md / CONTEXT.md references

### Why
Follow-up to the same day's 10→8 file collapse. The user pointed out
that leaving migration notes, "deprecated" assertions, and "as of
2026-04-17" annotations scattered through the codebase could itself
leak into agent prompts and re-create the very concept we just
removed. The cleanest signal to every agent — and to future
contributors — is that these two files simply don't exist in
Sentura's mental model anymore.

### What changed (in addition to prior entry)
- Agent-facing files (loaded into prompts) — stripped all migration
  notes and dated disclaimers:
  - `sentura/agents/creator/AGENTS.md`, `BOOTSTRAP.md`, `SOUL.md`
  - `sentura/agents/tuner/BOOTSTRAP.md`
  - `sentura/agents/orchestrator/BOOTSTRAP.md`
  - `sentura/agents/creator/skills/workspace-generation/SKILL.md`
  - `sentura/agents/creator/skills/employee-design/SKILL.md`
  - Runtime copies in `~/.openclaw/workspace/{creator,tuner,orchestrator}/`
    synchronized with the source.
- Library / hook code comments — removed dated migration commentary:
  - `sentura/lib/workspace.ts`
  - `sentura/hooks/sentura-bootstrap/handler.ts`
    (runtime copy at `~/.openclaw/hooks/sentura-bootstrap/handler.ts`
    synced).
- Documentation — removed migration sections, rewrote remaining
  references to describe only the current 8-file contract:
  - `README.md`
  - `docs/workspace-convention.md`
  - `docs/TeamPlan.md`
  - `docs/TESTS.md` (dropped A3.5, A4.2 annotation, A13.10a,
    B9.1 comment, B12.5 annotation, X2.3 annotation, and several
    inline mentions; kept the single "Last updated" metadata line
    because it's just a changelog date, not a rule)
  - `.cursorrules`
- Test scripts — removed `"Deprecated RULES.md/CONTEXT.md NOT
  emitted"` assertions. There is no code path that would ever emit
  those files, so asserting their absence is dead weight and keeps
  the names alive:
  - `scripts/test-week2.ts`
  - `scripts/test-week2-b-gateway.ts`
  - `scripts/test-creator-helpers.ts`
  - `scripts/test-gateway-integration.ts`

### What stayed
Only historical `MEMORY.md` entries still mention `RULES.md` /
`CONTEXT.md`. That's intentional: `MEMORY.md` is an append-only
audit log and past entries are never rewritten.

### Verification
- `sentura/lib/tsconfig.json` typecheck: clean.
- `sentura/dashboard/tsconfig.json` typecheck: clean.
- Repo-wide grep for `RULES.md` or `CONTEXT.md` outside of
  `docs/MEMORY.md`: no matches in code, scripts, agent files, or
  current-facing docs.

### Follow-ups
- Still want a live `/create` smoke test end-to-end to confirm the
  Creator stays inside its sandbox with the new top-priority Hard
  Rules and without any of the legacy surface area nudging it.
- If the sandbox still leaks despite AGENTS.md carrying the rules
  at top priority, next lever is tightening OpenClaw's exec /
  filesystem policy rather than more prompt content.

---

