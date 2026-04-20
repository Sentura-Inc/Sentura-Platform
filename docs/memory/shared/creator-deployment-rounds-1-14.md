> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Heavy context — only read when debugging the Creator → Forge deployment pipeline, skills allowlist, sandbox seeding, or the `sentura-agents` extension.

# Creator Deployment Bug-Fix Rounds 1 – 14 (2026-04-17 → 2026-04-20)

Fourteen consecutive debugging sessions that took the Creator meta-agent from "Forge hallucinates skills and escapes the sandbox" to **Week 2 Person B E2E live test PASSED** (round 13) and **Week 2 audit + MCP Builder config repair** (round 14).

Each round is preserved verbatim below. Summary table lives in `docs/TeamPlan.md` (Week 2 wrap-up) and in `docs/MEMORY.md` (matrix row).

> Ownership is interleaved: **Person A** shipped the platform-level fixes (sentura-agents extension, `commands.ownerAllowFrom`, exec host routing, stale-sandbox seed hook). **Person B** shipped the Creator SKILL / AGENTS.md / Forge model fixes. **Person C** shipped the dashboard-session fix in round 12. They are kept together here because the rounds only make sense as a single story.

## Rounds in this file

| Round | Date | Title |
|---|---|---|
| 1 | 2026-04-17 | Repair: Creator sandbox was empty (skills, BOOTSTRAP.md, memory, config.json5 missing) |
| 2 | 2026-04-18 | Deployment-pipeline repair (sentura-agents extension + skill rewrite) |
| 3 | 2026-04-17 | gateway-tool ≠ gateway-RPC; full consolidation into `sentura_agents_manage` |
| 4 | 2026-04-17 | Three stale skills still pointed Forge at `fs_write` |
| 5 | 2026-04-17 | AGENTS.md Hard Rule was the real override (Person A/B joint) |
| 6 | 2026-04-17 | Enforce `sentura_agents_manage` via tool-policy deny list |
| 7 | 2026-04-18 | Grant the webchat operator owner-only tools via `commands.ownerAllowFrom` |
| 8 | 2026-04-18 | Creator agent: unblock exec host auto-routing |
| 9 | 2026-04-18 | `exec` escape hatch closed |
| 10 | 2026-04-18 | Forge SKILL contradicted AGENTS.md mandate |
| 11 | 2026-04-18 | Forge subagent-spawn + 1000ms timeout root cause |
| 12 | 2026-04-18 | Stale sandbox workspace blocks every AGENTS.md edit |
| 13 | 2026-04-18 | Dashboard-spawned session blockers (Option A.1 + Fix B) |
| 14 | 2026-04-19 | Week 2 Person B E2E live test PASSED |
| 15 | 2026-04-20 | Week 2 audit pass + MCP Builder config repair |
| 16 | 2026-04-19 | OpenClaw-native MCP wiring alignment (`mcp.servers.entries` → `mcp.servers`) |
| 20 | 2026-04-19 | Dashboard `chat.send` sandbox tool-policy filter root cause + fix (`tools.sandbox.tools.alsoAllow`) |

(Headings in the preserved sections below use the original round numbering from the session that logged them; rounds 1–14 in the table above are the chronological ordering used everywhere else in the project.)

---

## 2026-04-17 — Repair: Creator sandbox was empty (skills, custom BOOTSTRAP.md, memory, config.json5 all missing)

### Symptom
The Creator agent (Forge) was responding with LLM-provider timeouts
and — when it did run — could see none of its own skills. Forensic
inspection of the running sandbox vs the host workspace revealed a
hollow sandbox:

- Host `~/.openclaw/workspace/creator/`:
  - All 8 native files (including a ~4KB Sentura-customized
    `BOOTSTRAP.md`)
  - `skills/` with 7 Creator skill subdirectories
  - `memory/`, `ekg/`, `config.json5`
- Sandbox `~/.openclaw/sandboxes/agent-creator-*/workspace/`:
  - 7 of 8 native files copied, but `BOOTSTRAP.md` was a 700-byte
    OpenClaw default stub — not the Sentura version.
  - `skills/` directory present but EMPTY.
  - No `memory/`, no `ekg/`, no `config.json5`.

With zero skills loaded, the agent had only its baseline instructions
and no tools/procedures, which made its behaviour brittle and
unhelpful.

### Root causes
1. **OpenClaw core limitation** (Rule #7 forbids modifying
   `openclaw/`): `ensureSandboxWorkspace` only copies a hardcoded
   list of 7 bootstrap files into the sandbox (AGENTS, SOUL, TOOLS,
   IDENTITY, USER, BOOTSTRAP, HEARTBEAT). It never touches
   `MEMORY.md`, subdirectories, or `config.json5`. Worse, its copy
   logic is "skip if destination exists", so once OpenClaw wrote
   the 700-byte default `BOOTSTRAP.md` stub on first boot, the
   Sentura-customized version never replaced it.
2. **Broken `skills` filter in `config.json5`**: the creator / tuner
   / orchestrator configs and `scripts/sentura-setup.sh` both
   specified `skills: ["~/.openclaw/workspace/<agent>/skills/*"]`.
   That field is NOT a path glob — it's a skill-name filter.
   Setting it to a path string made OpenClaw look for a skill
   literally named "~/.openclaw/...", find none, and silently load
   zero skills. Confirmed by reading
   `openclaw/src/agents/skills/{filter.ts,agent-filter.ts,workspace.ts}`.

### Repair (Sentura-layer only — no OpenClaw core changes)
1. **Removed the broken `skills` filter** from
   `sentura/agents/{creator,tuner,orchestrator}/config.json5` with
   explanatory comments so nobody adds it back. Removing the field
   means "load all workspace skills", which is exactly what we want.
2. **New `sentura/hooks/sentura-sandbox-seed/` OpenClaw internal
   hook** that fires on `agent:bootstrap`:
   - Detects when `workspaceDir` is inside `sandboxes/`.
   - Resolves the agent's host workspace via `openclaw.json` or
     the conventional `~/.openclaw/workspace/<agentId>/` path.
   - Full-mirror `skills/` (delete-and-recopy so skill additions,
     edits, and deletions on the host all flow through).
   - Union-copy `memory/` and `ekg/` (preserves sandbox-owned
     runtime state — the sandbox's own MEMORY and any downstream
     writes are not clobbered).
   - Union-copy `config.json5` and `MEMORY.md` only when missing.
   - Conditionally overwrite `BOOTSTRAP.md` ONLY when the host
     version is substantially larger than the sandbox's (≥ 1500
     bytes and larger than what's there). This defeats the
     700-byte stub without accidentally clobbering legitimate
     future sandbox state.
   - Hardens against symlink and hardlink escapes (each entry is
     lstat'd; skips non-files/non-dirs and entries whose realpath
     is outside the source tree).
3. **Updated `scripts/sentura-setup.sh`**:
   - Stopped injecting the broken glob-path `skills` filter into
     `~/.openclaw/openclaw.json`.
   - Actively scrubs any pre-existing stale glob-style filter
     during setup (`delete agent.skills`).
   - Installs and enables the new `sentura-sandbox-seed` hook in
     addition to `sentura-bootstrap`.
   - New Step 7b: clears stale meta-agent sandbox directories
     (`agent-creator-*`, `agent-tuner-*`, `agent-orchestrator-*`
     under `~/.openclaw/sandboxes/`) so the next agent boot starts
     from a clean slate and the new hook can fully hydrate.
4. **New operator repair script `scripts/repair-sandbox-seeding.ts`**
   for existing installations: scrubs stale `skills` globs, ensures
   both Sentura hooks are enabled, and clears meta-agent sandboxes.
   Prints verification hints (restart gateway, chat with Forge, then
   `ls` + `wc -c` inside the sandbox).
5. **Test coverage**: `scripts/test-week2.ts` Part 11 adds 9
   automated cases:
   - skills mirrored into sandbox ✓
   - custom BOOTSTRAP.md replaces the 700-byte stub ✓
   - MEMORY.md / config.json5 / memory/users/ / ekg/ union-copied ✓
   - sandbox-owned MEMORY.md preserved on re-seed ✓
   - no-op when `workspaceDir` is the host workspace ✓
   - unknown agent's sandbox left alone ✓
   All pass. Existing Week 2 suite: **91 / 92 pass** (the 1 failing
   case — `plugins.memory-lancedb` patch shape — pre-exists and is
   unrelated to this repair; it was already failing on `main` before
   any of these changes).

### Files
- Edited: `sentura/agents/{creator,tuner,orchestrator}/config.json5`
- Edited: `scripts/sentura-setup.sh`
- Edited: `scripts/test-week2.ts`
- Edited: `docs/TeamPlan.md`, `docs/TESTS.md`
- Added: `sentura/hooks/sentura-sandbox-seed/{HOOK.md,package.json,handler.ts}`
- Added: `scripts/repair-sandbox-seeding.ts`

### Verification performed
- Ran `npx tsx scripts/test-week2.ts`. All 9 new Part-11 cases pass.
  The only remaining failure is a pre-existing, unrelated
  `memory-lancedb` patch-shape assertion.
- Lint: no new lint errors in any touched file.

### Expected outcome on operator side
After running `scripts/repair-sandbox-seeding.ts` (or
`scripts/sentura-setup.sh`) and restarting the gateway, a fresh chat
with Forge should:
- See its `skills/` directory populated with all 7 skill dirs.
- Find `BOOTSTRAP.md` ~4KB (Sentura version, not 700-byte stub).
- See `memory/`, `ekg/`, and `config.json5` present in its sandbox.
- Have enough context to generate real AI employees again.

### Open questions / follow-ups
- The OpenAI provider timeout symptom that led to this diagnosis may
  or may not resolve after the sandbox is properly seeded. If it
  persists, the next step is to inspect provider-profile timeout
  budgets and failover profiles — that's a separate, provider-layer
  issue and not something the sandbox-seed hook can fix.
- Longer-term, consider upstreaming a flag to OpenClaw's
  `ensureSandboxWorkspace` so subdirectory seeding is a first-class
  capability rather than something we bolt on via hook. That would
  also remove our need for the fragile "stub BOOTSTRAP.md is under
  1500 bytes" heuristic.

---

## 2026-04-18 — Deployment-pipeline repair (sentura-agents extension + skill rewrite)

### Context
After the sandbox-seeding repair landed, Forge (the Creator meta-agent)
successfully ran the **design** phase and generated 8 workspace files
for a new "Remy — Billing Support" employee, but the **deployment**
phase failed with:

> `Sandbox path is read-only; cannot create directories: /workspace/.openclaw/workspace/remy-billing-support`

### Root cause
Two defects, one in the skill and one in the platform:

1. **`employee-deployment` skill (Person B)** — the SKILL.md instructed
   Forge to "Use `fs_write` for each file." But `fs_write` is a
   *sandbox-local* tool: from inside Forge's sandbox, the host path
   `~/.openclaw/workspace/<new-agent>/` surfaces as
   `/workspace/.openclaw/workspace/<new-agent>/`, which is read-only
   by design. `fs_write` can never create a new employee's workspace
   on the host.
2. **Platform capability gap (Person A)** — OpenClaw's native gateway
   RPCs cover only a subset of what the deployment needs:
   - `agents.create({ name })` bootstraps the host workspace and the
     7 native files.
   - `agents.files.set({ agentId, name, content })` can overwrite
     exactly the 8 native workspace files (SOUL.md, AGENTS.md,
     RULES.md, CONTEXT.md, TOOLS.md, SKILL.md, BOOTSTRAP.md,
     MEMORY.md) — but **not** subfolder files like
     `skills/<skill>/SKILL.md`, `ekg/*.md`, or
     `memory/users/MEMORY_USER_*.md`.
   There was no safe host-side RPC for writing into agent workspace
   subdirectories, so the skill had no correct alternative and
   defaulted to `fs_write` — the failure path above.

### Fix (three coordinated changes)

1. **New `sentura-agents` extension (Person A, platform layer)**
   at `sentura/extensions/sentura-agents/`:
   - Manifest (`openclaw.plugin.json`) declares id `sentura-agents`,
     one tool `sentura_agents_manage`, `enabledByDefault: true`, and
     a config schema for `workspaceRoot` + `maxFileSizeBytes`.
   - `src/paths.ts` — hardened path resolver:
     - `safeJoin` forbids absolute paths, `..`, symlink escapes, and
       any subpath escape via realpath comparison.
     - `NATIVE_WORKSPACE_FILES` set blocks attempts to route native
       files (SOUL.md, AGENTS.md, etc.) through this extension —
       those must go through `agents.files.set`, which is the
       OpenClaw-audited path.
   - `src/fs-ops.ts` — implements `writeSubfile`, `readSubfile`,
     `deleteSubfile`, `listSubfiles` against the *host*
     `~/.openclaw/workspace/<agentId>/` tree, with per-file size cap
     (default 5 MiB) and workspace-existence preflight (so this
     extension can never create a workspace out from under
     `agents.create`).
   - `index.ts` registers four gateway RPCs
     (`sentura.agents.writeSubfile`, `readSubfile`, `deleteSubfile`,
     `listSubfiles`) and an agent-facing tool
     (`sentura_agents_manage`) that wraps them with Zod-validated
     action dispatch.

2. **Wiring (Person A, `scripts/sentura-setup.sh`)**
   - New "Step 7a: Wiring Sentura extensions" scans
     `sentura/extensions/` for the known extension IDs
     (`sentura-agents`, `sentura-rbac`, `sentura-audit`,
     `sentura-approval`, `sentura-provisioner`), verifies each has
     both `openclaw.plugin.json` *and* `index.ts`, then patches
     `~/.openclaw/openclaw.json`:
     - Adds each extension's absolute directory to
       `plugins.load.paths` (deduped).
     - Flips each to `plugins.entries[<id>].enabled = true` (deduped).
   - Summary line at the end of the script now reports which
     Sentura extensions were wired so the operator sees it.
   - This is the missing piece that caused the prior install to only
     register `device-pair`, `openai`, `browser`, and internal
     hooks — none of the Sentura extensions were ever loaded.

3. **Skill rewrite (Person B, `sentura/agents/creator/skills/employee-deployment/SKILL.md`)**
   - Added a top-of-file "HARD RULE" section explicitly forbidding
     `fs_write` for new-employee workspaces, with the failure mode
     called out verbatim.
   - Provides a mapping table:
     | Intent                            | Tool / RPC                                  |
     | --------------------------------- | ------------------------------------------- |
     | Create host workspace + natives   | `gateway.call("agents.create", …)`          |
     | Overwrite one of 8 native files   | `gateway.call("agents.files.set", …)`       |
     | Write `skills/<x>/SKILL.md`, EKG, per-user memory | `gateway.call("sentura.agents.writeSubfile", …)` *(or the `sentura_agents_manage` tool)* |
     | Add agent to runtime registry    | `gateway.call("config.patch", …)`           |
     | Scratch / draft files (sandbox only) | `fs_write` / `fs_read`                   |
   - Rewrote Steps 1–6 of the procedure around these RPCs.
   - Tools Needed, Safety, and Rollback sections updated accordingly.
   - Also updated `sentura/agents/creator/config.json5`'s
     `tools.alsoAllow` to grant `sentura_agents_manage`,
     `sentura_rbac_manage`, and `sentura_audit_query` (with an
     inline comment explaining why `fs_write` is insufficient).

### Test coverage (Part 12 in `scripts/test-week2.ts`)
New `testSenturaAgentsExtension()` adds **22 assertions**, all
passing:
- Extension files exist (`openclaw.plugin.json`, `package.json`,
  `index.ts`, `src/paths.ts`, `src/fs-ops.ts`).
- Manifest declares `sentura_agents_manage`, `enabledByDefault: true`,
  correct id.
- `index.ts` registers all 4 `sentura.agents.*` gateway methods and
  the `sentura_agents_manage` tool.
- SKILL.md uses `agents.files.set` for natives, uses
  `sentura.agents.writeSubfile` for subfiles, explicitly warns about
  the `fs_write` sandbox restriction, and no longer contains the
  "Use fs_write for each file" instruction.
- `creator/config.json5` allows `sentura_agents_manage`.
- `sentura-setup.sh` references `plugins.load.paths`, patches
  `plugins.entries`, and wires at least `sentura-agents`,
  `sentura-rbac`, `sentura-audit`.

Result: **113 / 114 pass**. The 1 failure (`plugins.memory-lancedb`
patch shape in Part 3) pre-exists and is unrelated.

### Files
- Added: `sentura/extensions/sentura-agents/openclaw.plugin.json`,
  `package.json`, `api.ts`, `index.ts`, `src/paths.ts`, `src/fs-ops.ts`
- Edited: `sentura/agents/creator/config.json5`
- Edited: `sentura/agents/creator/skills/employee-deployment/SKILL.md`
- Edited: `scripts/sentura-setup.sh`
- Edited: `scripts/test-week2.ts`
- Edited: `docs/TeamPlan.md`, `docs/TESTS.md`

### Verification performed
- `pnpm exec tsx scripts/test-week2.ts` — all new Part 12 cases pass.
- `bash -n scripts/sentura-setup.sh` — syntactically valid.
- `ReadLints` — no lint errors in any touched file.

### Expected outcome on operator side
After re-running `scripts/sentura-setup.sh` and restarting the
gateway:
- `~/.openclaw/openclaw.json` has `plugins.load.paths` entries for
  every Sentura extension present on disk, and each is enabled in
  `plugins.entries`.
- Forge can deploy a new employee end-to-end: `agents.create` →
  `agents.files.set` × 8 natives → `sentura.agents.writeSubfile` ×
  *n* skills/ekg/memory-user files → `config.patch` for channel
  bindings — with zero `fs_write` calls to the host.
- The `Sandbox path is read-only` error is gone.

### Open questions / follow-ups
- Consider exposing `sentura.agents.createWorkspace` as well so the
  extension can fully stand in for `agents.create` during tests
  without requiring gateway session plumbing.
- Long-term, the 8-native-files restriction of `agents.files.set`
  feels arbitrary; a flag like `{ subpath: "skills/…" }` would let
  us upstream this capability and remove the extension entirely.

## 2026-04-17 — Deployment-pipeline repair round 2: gateway-tool ≠ gateway-RPC, full consolidation into sentura_agents_manage

### What failed this round
Forge started responding after the round-1 fixes (extension registration
errors, alsoAllow patch) but immediately re-hit the same class of
issue from a different angle:

1. Its SKILL.md told it to call
   `gateway.call("agents.create")` and
   `gateway.call("agents.files.set")`. Those are real **gateway RPCs**,
   but the agent-callable `gateway` **tool** (see
   `openclaw/src/agents/tools/gateway-tool.ts` → `GATEWAY_ACTIONS`)
   only exposes a fixed enum: `restart`, `config.get`,
   `config.schema.lookup`, `config.apply`, `config.patch`,
   `update.run`. Calling any other RPC through the tool returns
   "unknown action". Forge correctly concluded "this sandbox does
   not expose the gateway tool" — for agent-workspace operations,
   that observation is accurate.
2. When Forge fell back to `fs_write` / `apply_patch`, every write
   hit `Sandbox path is read-only; cannot create directories` —
   because `non-main` sandboxes default to `workspaceAccess: "none"`
   (see `openclaw/src/agents/sandbox/config.ts`), which makes
   `/workspace` a read-only mount.

### Root cause
The round-1 skill still relied on RPCs that aren't tool-exposed. We
need **one tool** that handles the full deployment lifecycle:
create the workspace dir, write the 8 native files, write subfiles,
list/read/delete. `config.patch` (which *is* tool-exposed) handles
the `agents.list` / bindings / MCP merges afterwards.

### Fix (this round)
Consolidated the entire file-side of deployment into
`sentura_agents_manage`:

1. **`sentura/extensions/sentura-agents/src/paths.ts`** — added an
   `allowNativeFiles?: boolean` option to `ValidateOptions`. When
   true, the validator accepts the 8 native workspace files at the
   workspace root (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md,
   USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) in addition to
   the `skills/` / `ekg/` / `memory/users/` prefixes.

2. **`sentura/extensions/sentura-agents/src/fs-ops.ts`** — added
   `createAgentWorkspace(agentId, opts)` which idempotently creates
   `<workspaceRoot>/<agentId>/` on the host and returns
   `{ created: boolean }`. Updated the "workspace missing" error
   message to point callers at `sentura_agents_manage({action:"create_agent"})`.
   Also updated `listSubfiles` so native files at the workspace root
   show up in listings.

3. **`sentura/extensions/sentura-agents/index.ts`** —
   - Extended `ManageToolSchema` with a new `"create_agent"` action.
   - Updated the tool description to state explicitly that the
     `gateway` *tool* does NOT expose `agents.create` /
     `agents.files.set`, so this tool is the only path.
   - Added an internal `isNativeTopLevelFile()` helper; when the
     caller passes a bare native filename to `write` / `read` /
     `delete`, the tool sets `allowNativeFiles: true` for that call
     only. Subfile callers continue to hit the stricter contract.
   - Registered a new gateway RPC
     `sentura.agents.createWorkspace` alongside the existing
     `sentura.agents.writeSubfile/readSubfile/deleteSubfile/listSubfiles`
     for non-tool callers (scripts / tests).

4. **`sentura/agents/creator/skills/employee-deployment/SKILL.md`**
   — full rewrite of the Procedure. The matrix now reads:
     - workspace directory        → `sentura_agents_manage({action:"create_agent", agentId})`
     - 8 native files             → `sentura_agents_manage({action:"write", agentId, relPath:"AGENTS.md", content})` etc.
     - skills / ekg / memory seed → `sentura_agents_manage({action:"write", agentId, relPath:"skills/…", content})`
     - config register / bindings → `gateway.call("config.patch", {...})`
     - verify hot-reload          → `gateway.call("config.get", {...})`
   Smoke test is now user-driven (ask the user to test via the
   dashboard) because `sessions.*` is not exposed on the `gateway`
   tool either. Rolled the HARD RULES section to explain both the
   read-only sandbox AND the fixed `GATEWAY_ACTIONS` enum, so future
   incarnations of Forge do not rediscover this pit.

5. Copied the rewritten SKILL.md onto the host workspace at
   `~/.openclaw/workspace/creator/skills/employee-deployment/SKILL.md`
   and cleared the stale `agent-creator-*` sandbox so the next
   session re-seeds from the fresh host skill.

### Why this is the final architecture (for this sprint)
- The agent-callable `gateway` tool's fixed `GATEWAY_ACTIONS`
  enum is a deliberate OpenClaw guardrail — we do not want to
  fork it. Instead, the Sentura `sentura-agents` extension is the
  sanctioned "expose host-side workspace writes to the agent"
  layer, which matches the project's Plugin-First principle.
- `config.patch` is already whitelisted on the tool enum and is
  exactly the right surface for the one remaining deployment
  operation (agent registration + bindings), so we don't need
  any other new tools.

### Files edited
- `sentura/extensions/sentura-agents/src/paths.ts`
- `sentura/extensions/sentura-agents/src/fs-ops.ts`
- `sentura/extensions/sentura-agents/index.ts`
- `sentura/agents/creator/skills/employee-deployment/SKILL.md`
- `~/.openclaw/workspace/creator/skills/employee-deployment/SKILL.md` (synced)

### Required operator action
**Restart the gateway** — the running process still has the pre-
`create_agent` build of `sentura-agents` loaded. `pnpm gateway:watch`
does not auto-reload plugin code, only config. After restart, Forge
should be able to run the full deployment flow end-to-end.

### Verification next session
1. Restart `pnpm gateway:watch` in `openclaw/`.
2. Send Forge: "Please finish deploying Remy."
3. Expected tool order in the trace:
   `sentura_agents_manage(create_agent)` →
   `sentura_agents_manage(write × 8 natives)` →
   `sentura_agents_manage(write × N skills/ekg)` →
   `gateway(config.patch, {agents.list $append / bindings $append / mcp.servers.entries merge})` →
   <!-- CORRECTION-OF-RECORD (2026-04-19, Round 16): the `mcp.servers.entries` path recorded here and in round-14 follow-ups was wrong. OpenClaw's MCP loader (`openclaw/src/agents/embedded-pi-mcp.ts` → `normalizeConfiguredMcpServers(cfg.mcp?.servers)`) reads `mcp.servers.<name>` directly — there is no `.entries` wrapper. Entries nested one level too deep are silently ignored, so the MCP server never spawns and the employee appears tool-less. Historical line preserved for audit; see Round 16 below for the fix across all Sentura agent skills and docs. -->

   user-driven smoke test.
4. New agent should appear in Dashboard → Agents on hot-reload.

## 2026-04-17 — Deployment-pipeline repair round 3: three stale skills still pointed Forge at fs_write

### What failed this round
After the round-2 restart the gateway was healthy (all Sentura
extensions registered; Forge's `alsoAllow` had
`sentura_agents_manage`), but Forge *still* hit
`Sandbox path is read-only; cannot create directories:
/workspace/.openclaw/workspace/billing-support-rep` for every native
file. Terminal 4 log (16:51:08 and 16:51:24) showed the `write` tool
failing in a loop with exactly the same path pattern.

### Root cause
The Creator loads ALL of its skill files into context on every turn,
not just `employee-deployment/SKILL.md`. Only that one had been
rewritten in round 2 — three sibling skills still told Forge to use
`fs_write` for the employee workspace:

1. **`agent-config-schema/SKILL.md`** — the "Minimal Walk-Through"
   step 3 literally said "fs_write the workspace at
   `~/.openclaw/workspace/{id}/`", and the "Tools Needed" section
   listed `fs_write` as the mechanism for the workspace bundle. It
   also listed `fs_read` as a tool scoped to read a new employee's
   workspace, which reinforced the wrong mental model.
2. **`incubation/SKILL.md`** — Step 3 "Generate Workspace Files" said
   "Write all files to `~/.openclaw/workspace/{agent-id}/`" with no
   mention of the transport, and Tools Needed listed
   `fs_read / fs_write — read templates and write workspace files`.
3. **`workspace-generation/SKILL.md`** — explicit "Create the workspace
   directory at OpenClaw's default location" as step 1 with no API,
   and Tools Needed was `fs_write — create workspace directories and
   files` / `fs_read — read templates for reference`.

So even though the *deployment* skill was right, the *design* and
*schema* skills contradicted it. Forge's LLM followed whichever skill
was most specific to the current phase; for the Remy session it was
following the workspace-generation procedure.

### Fix (this round)
Rewrote all three skills to route every workspace write through
`sentura_agents_manage`. All remaining `fs_write` references are now
phrased as NEVER / warning text so the model cannot re-derive the
wrong behaviour from them.

1. **`sentura/agents/creator/skills/agent-config-schema/SKILL.md`** —
   - Walk-through step 3 is now
     `sentura_agents_manage { action: "create_agent", agentId }`
     followed by eight `write` calls for the native files.
   - Tools Needed explicitly lists the six actions exposed by the
     agent-callable `gateway` tool and states that
     `agents.create` / `agents.files.set` are NOT in that set; use
     `sentura_agents_manage` instead. `fs_write` / `fs_read` are
     restricted to the Creator's own scratch space.
   - Removed the stale "match the path you will fs_write the
     workspace bundle to" sentence near the `workspace` field.
   - Safety section gained a final NEVER: "NEVER try to use fs_write
     or apply_patch to create an employee workspace."
2. **`sentura/agents/creator/skills/incubation/SKILL.md`** —
   - Step 3 now lists the exact two-call pattern
     (`create_agent` + eight `write` calls for the natives) and
     explains why `fs_write` / `gateway.agents.create` cannot be used.
   - Step 4 routes each skill file write through
     `sentura_agents_manage` with `relPath: "skills/{capability}/SKILL.md"`.
   - Tools Needed replaces `fs_write` with `sentura_agents_manage`
     and adds `gateway` for `config.get` / `config.patch`.
3. **`sentura/agents/creator/skills/workspace-generation/SKILL.md`** —
   - Directory Setup step 1 is now `sentura_agents_manage(create_agent)`.
   - Added a callout block explaining why `fs_write` is wrong here.
   - File Generation Order states every file is created by a
     `sentura_agents_manage write` call.
   - Tools Needed rewritten to list `sentura_agents_manage` first,
     then `gateway`, with `fs_read` / `fs_write` explicitly scoped to
     the Creator's own sandbox.

All three were copied to the host workspace at
`~/.openclaw/workspace/creator/skills/*/SKILL.md`, and the active
sandbox `agent-creator-b40f8302` was removed so the seed hook
re-materializes the updated skills on Forge's next session.

### Why this was missed in round 2
We only audited `employee-deployment/SKILL.md` when fixing the
read-only failure because the terminal error and Forge's "gateway tool
doesn't expose agents.create" self-report both pointed at the
deployment phase. But the design phase had the same bug, and Forge
was reading all seven skills at once. The generalized fix is that any
skill mentioning `fs_write` **for a path outside the Creator's own
workspace** has to be rewritten to route through
`sentura_agents_manage`.

### Files edited
- `sentura/agents/creator/skills/agent-config-schema/SKILL.md`
- `sentura/agents/creator/skills/incubation/SKILL.md`
- `sentura/agents/creator/skills/workspace-generation/SKILL.md`
- `~/.openclaw/workspace/creator/skills/agent-config-schema/SKILL.md` (synced)
- `~/.openclaw/workspace/creator/skills/incubation/SKILL.md` (synced)
- `~/.openclaw/workspace/creator/skills/workspace-generation/SKILL.md` (synced)
- `~/.openclaw/sandboxes/agent-creator-b40f8302/` (removed)

### Required operator action
**No gateway restart required this round.** Skill files are read from
the host workspace and seeded into the sandbox on session start, so
simply starting a new conversation with Forge is enough.
(The code changes to `sentura-agents` from round 2 do still require
the gateway restart the operator already performed in
`pnpm gateway:watch` at 16:45 — the current process is fine.)

### Verification next session
1. Ask Forge again: "Please finish deploying Remy."
2. Trace should begin with
   `sentura_agents_manage({action:"create_agent", agentId:"remy-billing-support"})`,
   **not** `write .openclaw/workspace/…/AGENTS.md`.
3. Terminal 4 should show zero "Sandbox path is read-only" lines.
4. Remy should appear under Dashboard → Agents within a few seconds
   of the `config.patch`.

### Lesson
Sandbox guardrails live in OpenClaw; procedure (which tool to call
for which action) lives in skills. When we change the transport
(fs_write → sentura_agents_manage), every skill that touches that
transport has to be updated in the same commit. A helper script that
greps all Creator skills for `fs_write|apply_patch` and fails CI if
any of them describe writing **outside the Creator's own workspace**
would have caught this.


## 2026-04-17 — Round 4: AGENTS.md Hard Rule was the real override (Person A/B joint)

### Symptom
After round 3 (updating `agent-config-schema`, `incubation`, `workspace-generation`
and `employee-deployment` skills to use `sentura_agents_manage`), Forge was
**still** trying `fs_write` under `/workspace/generated/remy-billing-support/`
and hitting `Sandbox path is read-only`. The dashboard never showed Remy.

### Root cause (the one that actually matters)
The Creator agent's top-level `AGENTS.md` has a `## Hard Rules (must not override)`
section that is explicitly designed to override every skill. That section
contained two surviving instructions from the pre-`sentura_agents_manage` era:

1. `- ALWAYS fs_write new employee workspaces under ~/.openclaw/workspace/{agent-id}/`
2. Phase 5, Step 1: `Write all 8 workspace files … using fs_write`.

Because Hard Rules beat skills, Forge was correctly following its orders —
the orders were just wrong. `TOOLS.md` and `BOOTSTRAP.md` listed `fs_write`
as a bootstrap-verified tool without the read-only caveat, which reinforced
the mistake. No amount of skill-level rewrites could ever win against this.

### Fix
`sentura/agents/creator/AGENTS.md`
  - Hard Rules now explicitly forbid `fs_write` for `/workspace/.openclaw/workspace/<agent>/…`
    and any fabricated path like `/workspace/generated/…`, and prescribe the
    `sentura_agents_manage { create_agent → write → gateway.config.patch }`
    flow.
  - Phase 5 rewritten to call `sentura_agents_manage` for the 8 native files
    and each skill, `gateway.config.patch` for registration, and to surface
    errors instead of falling back to `fs_write`.

`sentura/agents/creator/TOOLS.md`
  - `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`
    added as first-class rows; `fs_read`/`fs_write` row downgraded to
    "scratch-only, inside your own sandbox".

`sentura/agents/creator/BOOTSTRAP.md`
  - Bootstrap tool-verification step now lists `sentura_agents_manage` first
    and explains why `fs_write` cannot reach employee workspaces.

`sentura/agents/creator/config.json5`
  - Header comment updated: replaced the "coding profile for fs_write" line
    with a `sentura_agents_manage` explanation.

Host workspace at `~/.openclaw/workspace/creator/` re-synced from these
sources (AGENTS.md, TOOLS.md, BOOTSTRAP.md, config.json5). The single
stale sandbox `~/.openclaw/sandboxes/agent-creator-b40f8302` was deleted
so the next Creator session will reseed from the updated host files.

### Required operator action
- Restart `pnpm gateway:watch` (or let nodemon pick up the new hot-reload)
  so the new AGENTS.md / TOOLS.md / BOOTSTRAP.md are seeded into a fresh
  sandbox.
- No code changes in this round, so no build step is needed.

### Verification next session
1. Ask Forge to deploy a new employee.
2. In the trace, step 1 of deployment must be
   `sentura_agents_manage({action:"create_agent", agentId:"…"})`; there must
   be zero `fs_write` calls targeting any `.openclaw/workspace/<agent>/…`
   or `generated/…` path.
3. Terminal output must show zero `Sandbox path is read-only` lines.
4. The new agent appears in the dashboard immediately after the
   `config.patch`.

### Lesson
Hard Rules are a superset of skills. Anywhere AGENTS.md contains a
procedural instruction (tool name, file path, action sequence), it has
to be updated in lockstep with skills that rely on the opposite
transport. A CI check that greps `AGENTS.md + TOOLS.md + BOOTSTRAP.md`
for `fs_write.*workspace|fs_write.*\.openclaw` would have caught this
on the same PR that introduced `sentura_agents_manage`.

## 2026-04-17 — Round 5: enforce `sentura_agents_manage` via tool-policy deny list

### What we found
Round 4 (updating AGENTS.md / TOOLS.md / BOOTSTRAP.md Hard Rules to forbid
`fs_write` for employee workspaces) still did not stop Forge. Fresh trace
showed Forge calling the built-in `write` tool with
`path: "generated/billing-support-rep-support/README.md"`, getting
`Sandbox path is read-only; cannot create directories: /workspace/generated/...`.

The problem was never that `sentura_agents_manage` was missing from the
resolved tool set — we verified it is registered by the `sentura-agents`
plugin as a non-optional tool, the `coding` profile's allowlist is merged
with the creator's `alsoAllow` (which includes `sentura_agents_manage`) via
`mergeAlsoAllowPolicy`, and the tool correctly survives
`applyToolPolicyPipeline`. The problem is that the `coding` profile ALSO
surfaces `write`, `edit`, and `apply_patch`, and the LLM kept choosing the
shorter/more-familiar `write` tool even when every skill, hard rule, and
bootstrap step told it not to.

### Fix
Deny the built-in filesystem-mutation tools outright at the tool-policy
layer for Forge. OpenClaw's `ToolPolicyConfig` supports
`deny: string[]`, which is honored by `filterToolsByPolicy` via
`isToolAllowedByPolicyName` -> `makeToolPolicyMatcher` (see
`openclaw/src/agents/tool-policy-match.ts`). A deny match wins over any
allow/alsoAllow.

### Files touched

`sentura/agents/creator/config.json5`
  - Added `tools.deny: ["write", "edit", "apply_patch"]` with an inline
    comment explaining why each previous round failed and why the deny
    list is the only reliable enforcement mechanism.

`scripts/sentura-setup.sh`
  - `overrides.creator.tools` now includes
    `deny: ['write','edit','apply_patch']` so every fresh
    `pnpm sentura:setup` run re-applies the deny list.

`~/.openclaw/openclaw.json`
  - Live config patched in place: `agents.list[creator].tools.deny`
    set to `["write","edit","apply_patch"]` without touching any other
    agent entry.

Stale Creator sandbox `agent-creator-b40f8302` removed so the next run
reseeds with the new tool set.

### Why this works and previous rounds did not
- Rounds 1–3 modified the `sentura-agents` extension and the
  `employee-deployment` skill. Those were necessary but not sufficient —
  Forge still had `write` in its toolbox and preferred it.
- Round 4 rewrote the Creator's Hard Rules. Those are prompt-level
  constraints and can be ignored by the model.
- Round 5 removes the competing tool at the policy layer. With
  `write` / `edit` / `apply_patch` filtered out, the only available
  write path is `sentura_agents_manage`, and the model has no choice.

### Verification next session
1. Ask Forge to deploy a new employee.
2. Forge's tool manifest (visible in the trace) must show
   `sentura_agents_manage` but NOT `write`, `edit`, or `apply_patch`.
3. All employee-workspace files must land in `~/.openclaw/workspace/<id>/`
   via `sentura_agents_manage({action:"write", ...})`.
4. Gateway logs must contain zero `[tools] write failed: Sandbox path is
   read-only` entries during deployment.

### Lesson
When a Hard Rule asks an LLM to avoid a native tool that is still in its
toolbox, the rule is load-bearing on alignment — which is fragile. When
you want guaranteed behavior, remove the competing tool from the
resolved tool set. `deny:` in an agent's `tools` config is the correct
lever for that, and it composes cleanly with `profile` + `alsoAllow`.

## 2026-04-18 — Round 6: grant the webchat operator owner-only tools via `commands.ownerAllowFrom`

### Problem observed
After Round 5 denied `write`/`edit`/`apply_patch`, the gateway started
cleanly and Forge no longer hit `Sandbox path is read-only`. But Forge
still refused to deploy, telling the user:

> "I could not write/apply it from this sandbox because filesystem writes
> are blocked here and the deployment tools are not exposed in this
> session." … "this sandbox does not expose the `gateway` tool"

It drafted a full Remy bundle, but only as text in the chat reply. No
RPC calls were made. No employee appeared in the dashboard.

### Root cause
`gateway`, `cron`, and `nodes` are **owner-only** tools in OpenClaw
(`openclaw/src/agents/tools/owner-only-tools.ts`). They are stripped
from every agent's tool manifest unless `senderIsOwner === true` for
the inbound message. The logic
(`openclaw/src/auto-reply/command-auth.ts` ~L687) makes
`senderIsOwner` true when any of:

1. The sender identity matches `commands.ownerAllowFrom`
2. The internal-channel connection carries the `operator.admin` scope
3. `commands.ownerAllowFrom` includes the wildcard `"*"`

Our config had none of those. `commands` was entirely unset, so every
webchat message was treated as a non-owner, and Forge's declared
`alsoAllow: ["gateway", ...]` was silently discarded during tool
resolution. The `alsoAllow` entry passed zod validation, but the
runtime filter ran AFTER config merge and before the tool list was
handed to the model. Net result: Forge was told it had `gateway`, the
policy layer took it away, the model received a toolbox without
`gateway` or any workspace-write tool beyond `sentura_agents_manage`,
and its response — "the deployment tools are not exposed" — was
literally correct from its point of view.

The earlier symptom ("Sandbox path is read-only") was a second-order
effect: without `gateway`, Forge reached for `write` (the only
remaining workspace-mutating tool in the "coding" profile), which then
failed on the read-only sandbox mount. Round 5 removed `write` but did
not restore `gateway`. Round 6 restores `gateway`.

### Fix applied
1. **Live config** (`~/.openclaw/openclaw.json`): added
   `commands.ownerAllowFrom: ["*"]`.
2. **`scripts/sentura-setup.sh`** (~L250): patched to ensure every
   `pnpm sentura:setup` run writes `commands.ownerAllowFrom = ["*"]`
   when unset. Existing non-wildcard lists are preserved.
3. **Stale sandbox**: `~/.openclaw/sandboxes/agent-creator-*` removed
   so Forge's next session reseeds with the owner-authorized
   tool set.

`["*"]` is the canonical single-operator dev value — the wildcard
branch is test-covered
(`command-auth.owner-default.test.ts` ~L100). Production deployments
should narrow it to an explicit operator ID or rely on the
`operator.admin` scope path.

### Why this is the right lever (and not another deny / alsoAllow dance)
- `gateway` cannot be granted through `alsoAllow` alone. The
  owner-only filter runs on every inbound message and is deliberately
  insensitive to agent-level allowlists — that is how OpenClaw
  prevents a compromised channel from escalating a worker agent into
  a control-plane agent.
- The filter keys off the SENDER of the inbound message, not the
  agent. So the fix is at the sender-authorization layer
  (`commands.ownerAllowFrom`), not at the tool layer.
- Once the sender is authorized, the agent-level `alsoAllow: ["gateway"]`
  is honored and `gateway` appears in Forge's manifest.

### Files touched
- `~/.openclaw/openclaw.json` (runtime patch, line
  `commands.ownerAllowFrom: ["*"]`).
- `scripts/sentura-setup.sh` — new block before the "Agent
  configuration applied." log line.
- `docs/MEMORY.md` (this entry).
- `docs/TESTS.md` — new `B6.5` section for owner-authorization tests.
- `docs/TeamPlan.md` — Round 6 entry.

### Verification next session
1. Restart the gateway (`pnpm gateway:watch`).
2. Ask Forge, "list the tools you have right now." Its reply must
   include `gateway` and `sentura_agents_manage`.
3. Ask Forge to deploy a minimal billing agent. Expected flow:
   - `gateway { action: "config.get", path: "agents.list" }`
   - `sentura_agents_manage { action: "create_agent", agentId: … }`
   - eight `sentura_agents_manage { action: "write", … }` calls for the
     native files, plus N more for skill files
   - `gateway { action: "config.patch", ops: [ …append agent and
     binding… ] }`
   - Dashboard shows the new employee in `agents.list` on refresh.
4. Gateway logs contain zero `write failed: Sandbox path is read-only`
   lines.

### Lesson
When an agent reports "the deployment tools are not exposed in this
session", take it literally. OpenClaw has multiple tool-stripping
layers (profile, alsoAllow, deny, owner-only, sandbox scope). The
agent's manifest is what the model actually sees, not what the config
declares. Always trace the full pipeline — `resolvePluginTools` →
`applyToolPolicyPipeline` → `applyOwnerOnlyToolPolicy` — before
concluding the LLM is "hallucinating" a missing tool.

## 2026-04-18 — Creator agent: unblock exec host auto-routing (round 7)

### Problem observed
After round 6 (grant webchat owner scope via `commands.ownerAllowFrom`),
Forge successfully drafted a new employee bundle but stopped short of
deployment with:

> This session does not expose the two deployment tools I need:
> `gateway` and `sentura_agents_manage`. The sandbox filesystem is
> read-only, so I cannot even stage the workspace locally.

Gateway logs showed a single tool error in the run:

```
18:13:52 [tools] exec failed: exec host not allowed
  (requested gateway; configured host is auto;
   set tools.exec.host=gateway or auto to allow this override).
  raw_params={"command":"which openclaw || openclaw gateway status",
              "workdir":"/workspace","yieldMs":1000,"host":"gateway",…}
```

No `write failed: Sandbox path is read-only` entries (the round 5
`deny: ["write","edit","apply_patch"]` is still holding).

### Root cause
Forge's self-diagnostic path runs `exec { host: "gateway", command:
"which openclaw || openclaw gateway status" }` to confirm the gateway
is reachable. OpenClaw's exec runtime rejects that call because:

- `~/.openclaw/openclaw.json` had no `tools.exec` entry, so the host
  defaulted to `"auto"`.
- `bash-tools.exec-runtime.ts:isRequestedExecTargetAllowed` has a hard
  rule (line 229): when `sandboxAvailable === true` *and* the caller
  explicitly requests `"gateway"` while the configured host is
  `"auto"`, the exec is denied.

Because the exec was Forge's only probe for "is the gateway there?",
its LLM concluded that the whole gateway tool was missing and cascaded
that into "deployment tools are not exposed." The `gateway` and
`sentura_agents_manage` tools are actually in its manifest (round 6
fix), it just never got far enough to call them.

### Fix
Pin `tools.exec.host` to `"gateway"` explicitly:

```json
// ~/.openclaw/openclaw.json
{
  "tools": {
    "exec": { "host": "gateway" }
  }
}
```

This removes the `"auto"` ambiguity. Future calls with
`host: "gateway"` succeed, and Forge's self-diagnostic step no longer
fails in a way that looks like "tool missing."

### Files touched
- `~/.openclaw/openclaw.json` — patched at runtime:
  `tools.exec.host = "gateway"` (hot-reloaded at 18:30:14 per gateway
  log line `config change applied (dynamic reads: tools.exec)`).
- `scripts/sentura-setup.sh` — new block right after the
  `ownerAllowFrom` block. Idempotent; sets `tools.exec.host` to
  `"gateway"` only when it is not already set.
- `docs/MEMORY.md` (this entry).
- `docs/TESTS.md` — B6.6 section for the exec-host fix.
- `docs/TeamPlan.md` — Round 7 entry.

Also cleared stale Creator sandboxes (`rm -rf
~/.openclaw/sandboxes/agent-creator-*`) so Forge's next invocation
reseeds from the current host workspace with all round 5 / 6 / 7
changes.

### Verification next session
1. Gateway is still running (`pnpm gateway:watch`) — no restart
   needed; the reload hook already picked up `tools.exec`.
2. Send a new message to Forge (previous session's context is tainted
   by the OpenAI timeout + exec error; start a fresh chat).
3. Forge should:
   - successfully run `exec { host: "gateway", command: "which
     openclaw" }` or skip it entirely,
   - call `gateway { action: "config.get", path: "agents.list" }`,
   - then `sentura_agents_manage { action: "create_agent", … }` and
     the eight `write` calls for native files,
   - finally `gateway { action: "config.patch", … }` to register the
     new employee.
4. Gateway logs must contain zero `exec failed: exec host not allowed`
   and zero `write failed: Sandbox path is read-only`.
5. The new employee appears in the dashboard's `agents.list`.

### Lesson
When an agent says "deployment tools are not exposed," check *every*
tool error in the gateway log from that session, not just the
filesystem ones. A single `exec` failure early in the probe chain can
break the LLM's entire model of what it can do. The fix is often one
config line, not a skill rewrite.

## 2026-04-18 — Round 8: `exec` escape hatch closed

### Context

After Round 7 set `tools.exec.host = "gateway"` to unblock `exec`, Forge
was observed on 2026-04-18 using that capability in an unintended way.
When asked to deploy the `billing-support-remy` agent, instead of calling
`sentura_agents_manage` + `gateway.config.patch` (the mandated deployment
pipeline), it did:

1. `exec python3 -c "<heredoc>"` — wrote all 8 native files + 5 skills
   to `/Users/henry/Desktop/Sentura-Platform/workspaces/billing-support-remy/`
   (the source repo, NOT `~/.openclaw/workspace/`).
2. `exec git add ../workspaces/... && exec git commit -m "…"` — committed
   the files into the repo (commit `137e685`).
3. Reported "Done" with the commit SHA as evidence.

The agent was never registered: `agents.list` was untouched, no binding
was added, the dashboard did not show Remy, and web chat could not route
to him. Forge treated "files on disk + git commit" as equivalent to
deployment.

### Root cause

`exec` was in the `coding` profile's default tool set and not denied for
Forge. When the sandbox `/workspace` mount is unavailable, `exec` falls
back to the host repo as cwd, letting the LLM shell out `python3 -c` or
`cat > … <<EOF` heredocs to write files anywhere and invoke `git`. The
path of least resistance for the LLM was to use one tool it already knew
(`exec` + shell) instead of two it was less familiar with
(`sentura_agents_manage` + `gateway.config.patch`).

### Fix (Round 8)

1. Added `"exec"` to `sentura/agents/creator/config.json5`'s
   `tools.deny` — now `["write", "edit", "apply_patch", "exec"]`.
2. Patched the live `~/.openclaw/openclaw.json` to the same deny list so
   the change takes effect without requiring a setup re-run.
3. Persisted the change in `scripts/sentura-setup.sh` so new deployments
   inherit it.
4. Expanded the DEPLOYMENT MANDATE block in `AGENTS.md` with two new
   forbidden patterns:
   - `exec python3 -c` / `bash -c` / heredocs / `cat >` / `tee` /
     redirects as a way to write files. The only path is
     `sentura_agents_manage({ action: "write", … })`.
   - `git add` / `git commit` / any git operation. The gateway doesn't
     read from the git repo.
5. Added an explicit statement that the deploy target is
   **always** `~/.openclaw/workspace/{agent-id}/`, not
   `Sentura-Platform/workspaces/` and not `openclaw/workspaces/`.
6. Synced updated `AGENTS.md` + `config.json5` to
   `~/.openclaw/workspace/creator/` and cleared stale sandboxes
   (`agent-creator-b40f8302` removed).

### Side effect not yet resolved

Forge's `git commit 137e685` added
`workspaces/billing-support-remy/` to the repo. These files are harmless
runtime-wise (the gateway doesn't read from there) but they shouldn't be
the canonical home for employee workspaces. Options: `git revert 137e685`
if this was a repo pollution issue; or leave as-is if the user wants a
design artifact. Deferred to user decision.

### Lesson

Giving the Creator agent shell access (via `exec`) is net-negative:
every legitimate workflow Forge has is via `gateway` + `sentura_*` RPCs,
and `exec` just widens the surface area of ways the LLM can
satisfy-without-accomplishing a deploy request. The meta-principle: for
a meta-agent that orchestrates infrastructure changes, the tool set
should be narrow, specific, and have no generic escape hatch.

---

## 2026-04-18 — Round 9: Forge SKILL contradicted AGENTS.md mandate

### Problem

After Round 8 locked down `exec`/`write`/`edit`/`apply_patch`, Forge was
re-tested with a deploy request for Remy. Result: Forge emitted a
polished "Employee Summary / Generated Files / Safety Guardrails"
response — the exact forbidden draft-and-stop pattern — and made ZERO
`sentura_agents_manage` or `gateway.config.patch` calls. Probe confirmed
both tools were exposed and the live config was correct. No employee
workspace was created in `~/.openclaw/workspace/`. Agent not deployed.

### Root cause

`sentura/agents/creator/skills/incubation/SKILL.md` — the top-level
orchestration skill — explicitly told Forge to stop-and-ask:

- Step 5: "**Produce a JSON5 config snippet** for the `gateway` tool's
  `config.patch` action." (produce, not execute)
- Step 6: "Present to User … **Ask user to review and confirm before
  proceeding to provisioning/deployment.**"
- Safety: "**ALWAYS get user confirmation before deployment.**"

LLMs follow specific procedural SKILLs over general AGENTS.md guidance.
Forge obeyed the skill as written. AGENTS.md said "deploy now via tool
calls"; the skill said "produce a snippet, stop, confirm." The skill
won.

### Fix (Round 9)

Rewrote `skills/incubation/SKILL.md`:

1. Added an **Output Contract** block at the top: "This skill's
   deliverable is a deployed, running agent registered in the live
   `~/.openclaw/openclaw.json` — not a design document, not a JSON5
   codeblock." Defines success as `config.get agents.list` returning the
   new agentId.
2. Renamed Step 5 from "Generate Agent Config" to "Register the Agent
   (REAL TOOL CALL — not a draft)". Concrete 5-call sequence:
   `config.get` → build entry → `config.patch` → `config.get` verify.
3. Rewrote Step 6 from "Present to User / Ask to confirm" to "Report
   Outcome" — happens only AFTER Step 5 succeeded; must quote the
   `config.get` return value as proof.
4. Removed `ALWAYS get user confirmation before deployment` from Safety.
   Replaced with: "Get clarifying answers up front (Step 1); do not
   re-gate on 'can I deploy now?' at the end." Added a new NEVER:
   "NEVER emit a 'Draft config (JSON5)' codeblock as the final response.
   Emitting it means you skipped Step 5."
5. Synced updated SKILL.md to `~/.openclaw/workspace/creator/skills/incubation/`
   and cleared all `agent-creator-*` sandboxes so the next Forge session
   spawns with the corrected skill.

### Lesson

For meta-agents, **every SKILL must match the AGENTS.md mandate**, not
just describe a pre-mandate workflow. If AGENTS.md says "deploy via
tools, don't draft", every SKILL must end in tool calls, not in
"present and ask". Specific procedural skills always beat general rules
at inference time. Audit all of `creator/skills/*/SKILL.md` for
"ask/confirm/present/draft" phrasing that contradicts DEPLOYMENT
MANDATE.

---

## 2026-04-18 — Round 10: Forge subagent-spawn + 1000ms timeout root cause

### Problem

After Rounds 7–9 locked down `exec` and fixed skill contradictions, a
retry deploy of `billing-support-rep` failed again. Gateway logs showed:

- `embedded run timeout: runId=... timeoutMs=1000` repeated per turn.
- `[agent:nested] session=agent:creator:subagent:... Read: from ./SOUL.md failed`.
- Forge's reply collapsed to a literal `"noop"` string with no user-
  facing error.
- No agent registered in `agents.list`; no files in
  `~/.openclaw/workspace/billing-support-rep/`.

Forge had called `sessions_spawn({ task: "noop", runTimeoutSeconds: 1 })`.
The gateway's subagent-spawn path passed `1` through as
`timeoutMs: 1000`, producing the embedded-run timeout. The spawned
subagent bootstrapped an empty workspace (hence the `SOUL.md` read
failure) and returned nothing — the `noop` bubbled up as Forge's entire
response.

### Why the previous fix didn't stick

Round 7 removed `sessions_spawn` from the creator's `tools.alsoAllow`.
That had zero effect. Inspecting `openclaw/src/agents/tool-catalog.ts`:

```
sessions_spawn / subagents / sessions_yield — all have profiles: ["coding"]
```

Forge's profile is `coding` (per `sentura/agents/creator/config.json5`),
so the profile's `allow` already shipped all three tools. `alsoAllow`
is additive — removing an entry that's already in the profile allowlist
is a no-op. The only way to block a profile-included tool is via
`tools.deny` (which runs before `allow` in `tool-policy-match.ts`).

### The other "bug" (gateway filtered) was a red herring

Separate symptom: gateway logged
`tools.profile (coding) allowlist contains unknown entries (gateway)`.
Tracing `openclaw/src/agents/tool-policy-pipeline.ts` +
`tool-policy.ts` + `gateway/server-methods/agent.ts`:

- `gateway` is an owner-only tool (`owner-only-tools.ts`).
- Owner privilege is decided by `resolveSenderIsOwnerFromClient` — true
  iff the client's `connect.scopes` contains `operator.admin`.
- `ui/src/ui/gateway.ts` sets `CONTROL_UI_OPERATOR_SCOPES` which
  includes `operator.admin`, so the main Forge session IS owner and
  DOES see `gateway`.
- The warning fires for subagent sessions, where `senderIsOwner` is
  intentionally `false` and `gateway` is on
  `SUBAGENT_TOOL_DENY_ALWAYS` in `pi-tools.policy.ts`. That's by design.

Nothing to fix on that path. The warning's only actual impact in this
incident was confusing the operator.

### Fix (Round 10)

Added three tools to the creator's `tools.deny`, synchronized across
all four artifacts:

- `sentura/agents/creator/config.json5`
- `~/.openclaw/openclaw.json` (live, hot-patched via `config.patch`)
- `sentura/agents/creator/AGENTS.md` (updated "Tool Availability"
  section to remove `sessions_spawn`/`sessions_yield`/`subagents` from
  the "available" list and explicitly list them under "Denied
  intentionally" with rationale)
- `~/.openclaw/workspace/creator/AGENTS.md` (synced byte-for-byte)

Final deny list:

```
deny: ["write", "edit", "apply_patch", "exec",
       "sessions_spawn", "subagents", "sessions_yield"]
```

Also removed the now-misleading `exec` entry from the "available"
list in AGENTS.md (it had been denied in Round 8 but the doc still
listed it).

### Why deny works where alsoAllow-removal failed

`openclaw/src/agents/tool-policy-match.ts → makeToolPolicyMatcher`:

```
if (matchesAnyGlobPattern(normalized, deny)) return false;
// allow checks happen after
```

`deny` beats profile `allow`, per-agent `alsoAllow`, and any other
allow path. It's the only policy knob that overrides a profile's
bundled tools without forking the profile.

### Lesson

When a meta-agent using a bundled tool profile needs a tool removed,
check the profile allowlist first (`tool-catalog.ts`). `alsoAllow` is
additive-only; tool removal goes through `deny`. Also: warnings
about unknown allowlist entries in the tools-profile log may be
subagent-scoped and unrelated to the main session's toolkit — verify
which session the warning's sender is before investigating further.

---

## 2026-04-18 — Round 11: stale sandbox workspace blocks every AGENTS.md edit

### Discovery

After Round 10 locked down the deny list and updated
`~/.openclaw/workspace/creator/AGENTS.md`, a deep audit of
`openclaw/src/agents/sandbox/` revealed that the edits never reached
the running agent. Filesystem snapshot at the time of the audit:

```
~/.openclaw/workspace/creator/AGENTS.md         Apr 18 22:32  18706 bytes
~/.openclaw/sandboxes/agent-creator-<hash>/     Apr 18 20:43  18053 bytes
```

The in-container LLM was reading the **20:43 sandbox copy** (which
still advertised `sessions_spawn`, `sessions_yield`, `subagents`, and
`exec` in its Tool Availability section). The 22:32 host copy never
touched the container. That explains why Forge kept emitting
`sessions_spawn({task:"noop"})` even though Round 10 had pulled those
tools from the agent schema: the agent's own workspace docs were
still telling it those tools existed.

### Root cause

`openclaw/src/agents/sandbox/context.ts:47`:

```
const workspaceDir = cfg.workspaceAccess === "rw"
  ? agentWorkspaceDir            // live bind to ~/.openclaw/workspace/<id>/
  : sandboxWorkspaceDir;          // separate seed dir under ~/.openclaw/sandboxes/
```

`openclaw/src/agents/sandbox/workspace.ts:17-59`
(`ensureSandboxWorkspace`) uses:

```
await fs.writeFile(dest, content, { encoding: "utf-8", flag: "wx" });
```

The `"wx"` flag writes **only when the destination is missing**.
There is no mtime comparison, no refresh-on-update path. Consequence:
with the default `workspaceAccess: "none"`, the sandbox seed dir is a
one-time snapshot of the host workspace — any later edit to
AGENTS.md / TOOLS.md / BOOTSTRAP.md / SOUL.md is invisible to the
running agent until the sandbox dir is manually removed.

### Impact

Every single workspace-doc fix since the creator agent was first
booted (rounds 6–10) was potentially silently ineffective for the
in-container LLM. The agent kept reading the same stale snapshot of
its own guardrails, even as the host copies were updated to remove
`exec`, add hard rules about `sentura_agents_manage`, deny subagent
spawn, etc.

### Fix (Round 11)

Switched Creator's sandbox to live-bind mode:

**`sentura/agents/creator/config.json5`**:

```
sandbox: { mode: "non-main", workspaceAccess: "rw" }
```

**Live `~/.openclaw/openclaw.json`**: hot-patched the same value onto
`agents.list[creator].sandbox`.

**Stale sandbox dir**: user removed
`~/.openclaw/sandboxes/agent-creator-<hash>/` before the change so
the next boot creates a fresh container with the live bind mount.

### Why `"rw"` and not `"ro"`

Checked `openclaw/src/agents/sandbox/workspace-mounts.ts:14-40`:

- `"none"` / `"ro"` → `/workspace` bind-mounts the separate **seed
  dir** (read-only), so we'd still be stuck with the one-time-copy
  problem.
- `"ro"` adds a second read-only mount to the live workspace at
  `SANDBOX_AGENT_WORKSPACE_MOUNT` (not `/workspace`), so the agent
  would have to read AGENTS.md from a non-standard path it doesn't
  know about.
- `"rw"` → `/workspace` IS the live `~/.openclaw/workspace/<id>/`
  dir, read-write.

Only `"rw"` gives the agent a live view of its own workspace at the
expected path.

### Safety posture

`"rw"` widens the sandbox's write surface to the creator's own
workspace. Acceptable because:

1. `tools.deny` already strips `write`, `edit`, `apply_patch`, and
   `exec` from the agent schema — the built-in filesystem-mutation
   tools are not available to the LLM.
2. The only filesystem tool Forge has is `sentura_agents_manage`,
   which writes to **other agents'** workspaces (not its own;
   `sentura/extensions/sentura-agents/fs-ops.ts` requires `agentId`
   param).
3. `sandbox.mode: "non-main"` still isolates Forge from the
   host Sentura repo and from other agents' workspaces.

Net effect: a live view of Forge's OWN workspace is exposed
read-write, but Forge has no tools wired to write to it. Fail-safe.

### Other findings from the Round 11 audit

Full enumeration of OpenClaw subagent-spawn paths (worth logging
because it came up repeatedly):

1. `sessions_spawn` tool
   (`openclaw/src/agents/tools/sessions-spawn-tool.ts`) — denied ✓
2. `subagents` tool (list/kill/steer, not spawn) — denied ✓
3. `sessions_yield` tool (yield only, not spawn) — denied ✓
4. `/subagents spawn` slash command
   (`openclaw/src/auto-reply/reply/commands-subagents/action-spawn.ts`)
   — bypasses the tool-deny list but is only reachable through
   channel command parsing, not the Control UI chat. Not reachable
   in our setup.
5. ACP runtime via `sessions_spawn({runtime:"acp"})` — denied via (1).
6. No cron / heartbeat / bootstrap path auto-spawns. Confirmed via
   grep over `openclaw/src/cron/`, `openclaw/src/plugins/runtime/`,
   `openclaw/src/acp/runtime/`.

Full tool-profile → tool map (from `openclaw/src/agents/tool-catalog.ts`):

- `minimal`: `session_status` only
- `coding`: everything tagged `profiles:["coding"]` — includes
  `sessions_spawn`, `subagents`, `sessions_yield`
  (why we had to deny them explicitly)
- `messaging`: `sessions_list`, `sessions_history`, `sessions_send`,
  `session_status`
- `full`: empty allow/deny → profile step doesn't restrict anything

`senderIsOwner` is resolved **purely from
`client.connect.scopes.includes("operator.admin")`**
(`openclaw/src/gateway/server-methods/agent.ts:83-86`). The
OpenClaw Control UI requests `operator.admin`
(`openclaw/ui/src/ui/gateway.ts:132-140`) so `gateway` is visible to
Forge there. A future Sentura Dashboard (Next.js on port 3000) will
need to request the same scope or `gateway` will be silently
stripped from Forge's toolkit. Person C task for Week 3+.

### Lesson

"Updated the config on disk" is not the same as "the agent saw the
update." For sandboxed agents, sandbox seeding semantics matter.
Default-`none` workspaceAccess is a one-time snapshot; any agent
whose identity or rules live in workspace docs (which is every
OpenClaw agent) MUST use `workspaceAccess: "rw"` so host edits
reach the container on the next boot. This should be the default
for any Sentura agent whose workspace files are expected to evolve.



## 2026-04-18 — Round 12: dashboard-spawned session blockers (Option A.1 + Fix B)

### Symptoms (after Round 11 `workspaceAccess: "rw"` fix, observed in terminals/11.txt)

Three warnings / errors all appearing in the same session
(`session=agent:creator:dashboard:c9583daf-…`):

```
23:07:23 [diagnostic] lane wait exceeded:
         lane=session:agent:creator:dashboard:c9583daf-e0f4-4561-adbb-ce3c544d7fef
         waitedMs=131401 queueAhead=0
23:07:29 [tools] tools.profile (coding) allowlist contains unknown
         entries (gateway). These entries are shipped core tools but
         unavailable in the current runtime/provider/model/config.
23:07:29 [tools] agents.creator.tools.allow allowlist contains
         unknown entries (gateway). …
23:09:31 [agent:nested] …
         I just attempted it again and got the same blocking error:
         `Session not visible from this sandboxed agent session.`
         I cannot complete deployment from this isolated session until
         visibility is fixed.
```

### Root causes

**Cause 1 — `senderIsOwner = false` for the dashboard session →
`gateway` stripped.**
`openclaw/src/gateway/server/ws-connection/message-handler.ts`
calls `clearUnboundScopes()` unless the Control UI connection presents
a token or password and the `device-pair` plugin is active. Our config
had `gateway.controlUi.allowInsecureAuth: true` but
`plugins.entries.device-pair` did NOT have `enabled: true`, so the
plugin resolved to `bundled (disabled by default)` (the warning in
line 11 of terminals/11.txt), and the connection fell through
`clearUnboundScopes()`, stripping `operator.admin`.
`applyOwnerOnlyToolPolicy` (`openclaw/src/agents/tool-policy.ts`) then
filtered `gateway` out of Forge's schema before
`applyToolPolicyPipeline` ran, which is why the pipeline warned that
`gateway` was "an unknown entry" in the allowlist.

**Cause 2 — `restrictToSpawned = true` for any sandboxed session the
Control UI spawns.**
`openclaw/src/agents/tools/sessions-access.ts:56-91`
(`resolveSandboxedSessionToolContext`) sets
`restrictToSpawned = true` whenever:
- session is sandboxed (true for Forge), AND
- `agents.defaults.sandbox.sessionToolsVisibility === "spawned"`
  (the default), AND
- session is not a subagent

That is the exact shape of every dashboard-initiated Forge run
(`agent:creator:dashboard:<uuid>`). Result: every cross-session
resolution path returns `Session not visible …`, which is what Forge
hit when trying to verify the billing-support-rep session after
creating it.

**Cause 3 — `lane wait exceeded` is a consequence**, not a root cause.
Forge's Harmony run cannot finish because it is blocked on cross-
session resolution; the run stays in-flight, the lane queue waits,
eventually the diagnostic fires.

### Fix applied (Option A.1 + Fix B)

Patched both `~/.openclaw/openclaw.json` (live) and
`sentura/agents/creator/config.json5` (source of truth) with four
changes:

```
plugins.entries.device-pair:
  { enabled: true, config: { publicUrl: "http://localhost:18789" } }

agents.defaults.sandbox.sessionToolsVisibility: "all"
tools.sessions.visibility: "all"
tools.agentToAgent: { enabled: true, allow: ["*"] }
```

The first change re-enables device-pair so the Control UI handshake
can present `operator.admin` and keep it through
`clearUnboundScopes()`. The next three change the sandbox's default
session-visibility clamp from `spawned` to `all`, open cross-agent
session resolution, and enable A2A routing so Forge can inspect the
deployed employee's session. All three are needed together — removing
any one would re-introduce the block.

### Follow-up pairing workflow (user-facing)

After the gateway restarts with the new config:

1. Control UI connects and requests `operator.admin` →
   device-pair creates a pending pairing request.
2. User runs `openclaw devices list` to see the pending request.
3. User runs `openclaw devices approve <requestId>` (or
   `openclaw devices approve latest`).
4. Control UI reconnects; `senderIsOwner` is now `true` for that
   connection; `gateway` tool is visible to Forge again.
5. Forge can now complete the deploy and verify the new employee's
   session.

### Why `sessionToolsVisibility: "all"` is safe here

Forge is already gated by:
- `applyOwnerOnlyToolPolicy`: `gateway` tool remains owner-only
- `sentura-rbac`: host-filesystem writes require owner scope
- `sentura_agents_manage`: filesystem tool is allowlisted per-agent
- Agent-to-agent allow rules can be tightened per-agent later

Opening sandbox visibility just restores the *ability to look at
other sessions*; actual mutation still goes through owner-gated tools.
We explicitly prefer this over the alternatives (A.2: shared token,
A.3: `ownerAllowFrom`) because device-pair is the only path that also
fixes every other scope-gated tool (cron, nodes, approvals) without
workarounds.

---

## 2026-04-19 — Round 13: Week 2 Person B E2E live test PASSED

### TL;DR

**Forge produced a live AI employee end-to-end on the first clean run.**
The `scripts/test-creator-e2e-live.ts` harness sent a natural-language
brief, and `~110s` later a new `penny-ap` agent was registered in the
live gateway config with a full 8-file OpenClaw-native workspace.
Person B's week-2 unchecked box (`docs/TeamPlan.md:224`) flipped to `[x]`.

### What unblocked the test

Three real blockers that had been masking each other in prior rounds
were fixed in a single pass, in order:

1. **Live `bindings: []`** — `~/.openclaw/openclaw.json` had an empty
   `bindings` array even though `sentura/agents/creator/config.json5`
   declared the `webchat` DM → `creator` route. Result: Control UI chats
   were routing to `agent:main:main` (OpenClaw's built-in default)
   instead of Forge, producing the two-session self-deadlock seen in
   rounds 11–12. Patched the live config to add:
   ```json
   { "agentId": "creator",
     "match": { "channel": "webchat", "peer": { "kind": "dm", "id": "*" } } }
   ```
   (This does not yet replicate `config.json5` → `openclaw.json`
   automatically; the `sentura-setup.sh` path likely needs a follow-up
   patch so future deploys don't drift again. Tracked as a Person A
   infra TODO for Week 3.)

2. **Creator model mismatch with provider** — `creator.model` was set
   to `openai/gpt-5.3-codex`. That model ID is only served under the
   `openai-codex` (OAuth) provider — see
   `openclaw/extensions/openai/openai-codex-provider.ts:67`. Pairing it
   with the plain-API-key `openai` provider produces an "Unknown model"
   failure at first LLM call. Switched to `openai/gpt-5.4` (the default
   modern API-key model) in both `sentura/agents/creator/config.json5`
   and `~/.openclaw/openclaw.json`. Added a long explanatory comment
   so the next reader understands why codex-OAuth models don't work
   with a plain key.

3. **No provider credentials** — `~/.openclaw/.env` did not exist and
   `providers: {}` / `secrets: {}` were both empty. Created
   `~/.openclaw/.env` (mode 600) with the operator's `OPENAI_API_KEY`.

### Security incident (contained)

Operator initially pasted the API key into `openclaw/.env.example` —
a repo-tracked template file — rather than `~/.openclaw/.env`. Caught
before commit:

- `git log` + `git grep` confirmed the key was never staged, committed,
  or pushed.
- Key was extracted from the working-tree copy, moved to
  `~/.openclaw/.env`, and `openclaw/.env.example` was reverted to HEAD.
- `git grep 'sk-proj-a222WBBd'` (the leaked prefix) returned zero
  hits across all tracked files.
- Conclusion: **no rotation required**.

Takeaway for docs: the "Paste your key" guidance must make the
destination path (`~/.openclaw/.env`) unambiguous and warn operators
that `.env.example` is a template, not a secret store.

### E2E harness run — test evidence

Command: `SENTURA_LLM_E2E=1 npx tsx scripts/test-creator-e2e-live.ts`
Duration: 122s wall-clock (script timeout was 5 min, passed on poll #22).

Flow (verified against gateway logs + script output):
1. Operator connects via token auth → scopes preserved → `senderIsOwner=true`.
2. Script calls `agent` RPC with `agentId: "creator"` (bypasses routing).
3. Forge runs Phase 1–4 of its skill procedure in its canonical
   `agent:creator:main:main` session (no dashboard-spawned session,
   no `restrictToSpawned` clamp).
4. Phase 4 `config.patch` registers new agent.
5. Script polls `config.get` every 5s and detects the new entry.

### What Forge actually built (verified)

Registered config entry (live `~/.openclaw/openclaw.json`):
```json
{
  "id": "penny-ap",
  "name": "Penny",
  "model": "openai/gpt-5.4",
  "thinkingDefault": "low",
  "skills": ["~/.openclaw/workspace/penny-ap/skills/*"],
  "sandbox": { "mode": "non-main", "workspaceAccess": "rw" },
  "tools": {
    "profile": "minimal",
    "alsoAllow": ["pdf", "browser", "web_fetch"],
    "deny": ["gateway", "exec"]
  },
  "runtime": { "type": "embedded" }
}
```

Workspace shape (`~/.openclaw/workspace/penny-ap/`):
- Full 8-file OpenClaw-native layout: `AGENTS.md`, `SOUL.md`, `TOOLS.md`,
  `BOOTSTRAP.md`, `HEARTBEAT.md`, `IDENTITY.md`, `MEMORY.md`, `USER.md`
- `skills/accounts-payable-reconciliation/`
- `AGENTS.md → ## Hard Rules` **correctly embeds the £5000 escalation
  rule** from the NL brief. Specifically:
  > - NEVER approve, release, or schedule any payment yourself.
  > - NEVER mark an invoice over £5000 as approved for payment without
  >   explicit human approval.
  > - ALWAYS route any invoice, batch, or exception above £5000 to the
  >   human approver.

This is the canonical Week 2 success criterion: NL → hard guardrails
faithfully translated into workspace config.

### Known deferrals (not blocking Week 2 close-out)

- **Cleanup not automated**: The harness stub leaves `penny-ap` in
  the config. Operator removes manually via `config.patch remove`
  when done. Future work: add teardown to the script.
- **Assertions are loose**: Script only verifies "a new agent appeared",
  not schema conformance, skill count, memory isolation, binding
  correctness, or that Phase 1–4 actually executed (vs a partial run
  that happened to produce the right artifact). Tightening these is
  Week 3 work (Person B).
- **`config.json5` → `openclaw.json` replication**: Source bindings and
  agent model still did not auto-propagate. Next `sentura-setup.sh`
  run should force a re-patch. Flagged as Week 3 Person A.
- **`workspaceAccess: "rw"` defaulting**: Forge inherited `rw` into
  Penny's entry even though Penny is not a meta-agent. Acceptable for
  now (non-main sandbox still isolates Penny from host), but the
  Creator's `workspace-generation` skill should pick a more
  conservative default for end-user employees. Flagged as Week 3
  Person B hardening.

### Files touched this round

- `~/.openclaw/openclaw.json` — patched `bindings[]` and
  `agents.list[creator].model`.
- `~/.openclaw/.env` — created with operator's OpenAI key (mode 600).
- `sentura/agents/creator/config.json5` — model switched to
  `openai/gpt-5.4` with explanatory comment block.
- `openclaw/.env.example` — reverted to HEAD after accidental paste.
- `docs/TeamPlan.md:224` — Person B's final unchecked box flipped.
- `docs/TESTS.md` — added B6.9 passing case.
- `docs/MEMORY.md` — this entry.

### Week 2 status after this round

| Person | Week 2 status |
|---|---|
| A | ✓ Done |
| B | ✓ Done (this round closes the last box) |
| C | ✓ Done |
| D | Pending (Week 2 work still in progress per `TeamPlan.md`) |

## 2026-04-20 — Round 14: Week 2 audit pass + MCP Builder config repair

### Motivation

User asked for a full recheck of Person A / B / C Week 2 completion "without
error". The audit was otherwise clean (every checkbox in `TeamPlan.md`
lines 121-309 matched a real artifact on disk and, where relevant, a passing
test), but two latent defects were found in the **not-yet-deployed** MCP Builder
Agent's `sentura/agents/mcp-builder/config.json5` that would have blocked its
first run in a later week:

1. **Invalid model id** — `model: "openai/gpt-4o"`. The `openai` provider
   (`openclaw/extensions/openai/openai-provider.ts:57-68`) only registers
   `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano`, and `gpt-5.2`.
   `gpt-4o` would fail at first LLM call with "unknown model". (Same class of
   mistake as Round 12, which flipped Creator from `gpt-5.3-codex` to `gpt-5.4`.)
2. **Broken `skills` filter** — `skills: ["~/.openclaw/workspace/mcp-builder/skills/*"]`.
   OpenClaw interprets `agents.list[].skills` as a list of skill *names*, not
   path globs. Person A explicitly removed this exact pattern from creator /
   tuner / orchestrator in the Week 2 sandbox-seeding repair (`TeamPlan.md:163`)
   but mcp-builder was missed. Left in, the filter would silently disable all
   four skills (`api-analysis`, `mcp-generation`, `smoke-test`, `register-server`)
   the moment mcp-builder was deployed — the host files would stay on disk,
   but the agent would load zero skills at runtime.

Neither defect blocks Week 2 close-out (MCP Builder is not deployed yet; its
deployment is scheduled for a later week), but both would have caused a
copy-of-Round-10-style deploy failure the first time anyone tried to use it.
Fixing them now is cheap and keeps the Week 2 surface clean.

### What changed

- `sentura/agents/mcp-builder/config.json5`:
  - `model` → `"openai/gpt-5.4"` (same as Creator after Round 12).
  - Removed the path-glob `skills:` entry so OpenClaw's loader auto-discovers
    every skill under the workspace, which is what the sandbox-seed hook
    (Person A, Round 9) already mirrors into the container.
  - Removed `sessions_spawn` from `alsoAllow` and added `tools.deny:
    ["sessions_spawn", "subagents", "sessions_yield"]` mirroring the Round-10
    Creator deny list so mcp-builder cannot reproduce the noop-hallucination
    loop that crashed Forge. Kept `write`/`edit`/`apply_patch` enabled via the
    `coding` profile — that's what the agent needs to emit TypeScript MCP server
    projects under `sentura/mcp-servers/{name}/`.
  - Inline comments explain each choice so future authors don't re-introduce
    the same bugs.

### How this was verified

- `python3 -c "import json5; …"` parse of the patched file confirms
  `model = "openai/gpt-5.4"`, `skills` key absent, `tools.profile = "coding"`,
  `tools.deny = ["sessions_spawn","subagents","sessions_yield"]`.
- `ReadLints sentura/agents/mcp-builder/config.json5` → "No linter errors".
- No live-config change is needed: mcp-builder is not in the live
  `~/.openclaw/openclaw.json` `agents.list[]` today, so there is nothing to
  patch — the next `scripts/sentura-setup.sh` run (or the first operator-issued
  `config.patch` for mcp-builder) will read the corrected source.

### Final Week 2 audit verdict for Persons A / B / C

| Person | Deliverables audited | Result |
|---|---|---|
| **A** | Sandbox seed hook (`sentura/hooks/sentura-sandbox-seed/`), `sentura-agents` extension, `sentura-setup.sh` (15 feature references incl. `ownerAllowFrom`, `exec.host`, `workspaceAccess: "rw"`, `memory-lancedb`), `scripts/test-week2.ts` Parts 11-12 | ✓ PASS |
| **B** | Creator agent workspace (8 files) + 7 skills, MCP Builder workspace (8 files + 4 skills, *repaired this round*), common skill library (5 skills + README), EKG schema + 2 industry ontologies, Creator E2E live run (`penny-ap` created in ~110s, Round 13 evidence), helpers suite `scripts/test-creator-helpers.ts` → 49/49 passed | ✓ PASS |
| **C** | Dashboard pages `/create`, `/approvals`, `/employees`, `/employees/[id]` present with live file sizes; build scripts wired | ✓ PASS |
| **D** | Out of scope for this audit (still in-progress per `TeamPlan.md`). | — |

### Files touched this round

- `sentura/agents/mcp-builder/config.json5` — model + skills + deny-list repair,
  with inline explanatory comments.
- `docs/MEMORY.md` — this entry.
- `docs/TeamPlan.md` — Week 2 Person B MCP Builder line annotated with the
  config repair.
- `docs/TESTS.md` — B9 test suite extended with B9.6 (model validity) and B9.7
  (sessions_spawn denial) covering this repair.

## 2026-04-19 — Round 16: OpenClaw-native MCP wiring alignment (`mcp.servers.entries` → `mcp.servers`)

### What was wrong (root cause, not symptom)

While auditing the brand-new `sentura/mcp-servers/gradsale-admin/` server that Person D shipped for the Week 2 first-enterprise-MCP deliverable, we re-traced the path OpenClaw actually uses to discover MCP servers at agent boot:

- `openclaw/src/agents/embedded-pi-mcp.ts` → `normalizeConfiguredMcpServers(cfg.mcp?.servers)`
- `openclaw/src/config/mcp-config.ts` → reads `sourceConfig.mcp?.servers` (a flat map `{ [name]: McpServerConfig }`)
- `openclaw/src/config/types.mcp.ts` → `McpConfig.servers: Record<string, McpServerConfig>`

There is **no `.entries` wrapper** anywhere in that pipeline. But Sentura's earlier instructions (written while we were still standing up the Creator + MCP-Builder meta-agents) had quietly settled on `mcp.servers.entries.<name>` as the canonical shape — it appeared in four places:

1. `sentura/agents/mcp-builder/skills/register-server/SKILL.md` — the step-by-step recipe the MCP-Builder agent follows.
2. `sentura/agents/mcp-builder/TOOLS.md` — the `gateway` tool example the MCP-Builder sees in context.
3. `sentura/agents/creator/skills/employee-design/SKILL.md` — the design-bundle artifact the Creator hands off to Forge.
4. `sentura/agents/creator/skills/employee-deployment/SKILL.md` — the `config.patch` snippet Forge was generating at deploy time.

Because the path is one level too deep, OpenClaw's loader silently skips the entry: no warning, no error — the agent just boots with zero MCP servers and appears to have no enterprise tools. This is exactly the kind of silent failure a human reviewer would miss right up until an employee is asked "please open this GradSale dispute" and responds with "I don't have a tool for that."

The prior round-2 note (line 429 of this file, from 2026-04-17) already baked `mcp.servers.entries merge` into the Creator's verification script, so the mistake was self-reinforcing across the meta-agent stack.

### Fix

Corrected every Sentura-side surface to use the OpenClaw-native path `mcp.servers.<name>`, and added explanatory paragraphs wherever the path is shown so the next contributor sees *why* this is the right shape, not just *that* it is:

- `sentura/mcp-servers/gradsale-admin/README.md` — rewrote "Wiring into an AI employee" with an explicit warning that `mcp.servers.entries.<name>` is invisible to OpenClaw's loader, plus a pointer to `normalizeConfiguredMcpServers`.
- `sentura/mcp-servers/gradsale-admin/src/server.ts` → `src/index.ts` (rename), plus `package.json` (`bin` / `main` / `start` / `dev` → `dist/index.js` or `src/index.ts`) and `src/server.test.ts` import update — so the spawn command in the config snippet is a clean `node ./sentura/mcp-servers/gradsale-admin/dist/index.js` rather than routing through `pnpm --filter`.
- `sentura/agents/mcp-builder/skills/register-server/SKILL.md` — corrected the JSON5 example, the "Entry key" bullet, and the `gateway.call` target; added a paragraph explaining why `mcp.servers.<name>` is the native path.
- `sentura/agents/mcp-builder/TOOLS.md` — same corrections for the `gateway` tool example.
- `sentura/agents/creator/skills/employee-design/SKILL.md` — design-bundle `mcp` subsection now targets `mcp.servers`, with a warning next to the snippet.
- `sentura/agents/creator/skills/employee-deployment/SKILL.md` — the precondition check, the `config.patch` merge snippet, and the `gateway.call` verification step all target `mcp.servers.<name>`; added a callout explaining the silent-failure mode if `entries` leaks back in.
- `docs/DESIGN.md` §14 "Enterprise MCP Server Pattern" — refreshed the Step-3 example to match the new spawn style (`command: "node"`, direct `dist/index.js` path) and added a paragraph pointing at OpenClaw's loader as the source of truth.
- `docs/memory/shared/creator-deployment-rounds-1-14.md` (this file) — preserved the original round-2 line and annotated it with an inline `<!-- CORRECTION-OF-RECORD -->` comment pointing at this round.

### Why this mattered beyond the GradSale server

The Creator meta-agent's whole job is to *generate new AI employees*, and the deployment skill it reads is what it emits into `config.patch`. If we had left `mcp.servers.entries` in place, every employee the Creator ships — not just the first one that happens to need an MCP server — would have silently broken MCP tools. Fixing it in the skill files (not just in the one GradSale README) prevents the bug from being recreated on every `employee-deployment` run.

### Verification

- `rg "mcp\.servers\.entries" sentura/ docs/ README.md` → only hit is the historical line 429 of this file, now annotated (historical audit preserved per MEMORY policy).
- `openclaw/src/config/types.mcp.ts` and `openclaw/src/config/mcp-config.ts` re-read → both confirm `servers: Record<string, McpServerConfig>` at `mcp.servers`.
- `sentura/mcp-servers/gradsale-admin/` → `pnpm build && pnpm test` (next task, id 8) will confirm the entry-point rename did not break the hermetic integration tests.

### Files touched this round

- `sentura/mcp-servers/gradsale-admin/src/index.ts` (renamed from `server.ts`)
- `sentura/mcp-servers/gradsale-admin/src/server.test.ts` (import path)
- `sentura/mcp-servers/gradsale-admin/package.json` (bin/main/start/dev)
- `sentura/mcp-servers/gradsale-admin/README.md` (wiring section + warning)
- `sentura/agents/mcp-builder/skills/register-server/SKILL.md`
- `sentura/agents/mcp-builder/TOOLS.md`
- `sentura/agents/creator/skills/employee-design/SKILL.md`
- `sentura/agents/creator/skills/employee-deployment/SKILL.md`
- `docs/DESIGN.md` (§14 Enterprise MCP Server Pattern)
- `docs/memory/shared/creator-deployment-rounds-1-14.md` (this round + inline correction on line 429)
- `docs/memory/person-d/week-2.md` (session entry)
- `docs/MEMORY.md` (matrix row)


## 2026-04-20 — Round 19 (Person D): Dashboard-session "Forge claims it has no tools" was context poisoning, not a real tool-visibility regression — proven end-to-end via CLI deploy

### Symptom

After rounds 1–16 landed (in-process `register_agent`, stamped `setupCompletedAt`, AGENTS.md trimmed to ~11k, stale sandbox deleted, alsoAllow includes `sentura_agents_manage`), a fresh `billing-support-rep` deploy attempt from the dashboard webchat **still** ended with Forge replying:

> "this current session only has **read/process/sessions/status/image** tools, so I can't actually create/register the employee from this webchat session. If you reopen this in a Sentura Creator run with deployment access, I can use the defaults above and deploy it immediately."

The user had spent two full days on rounds 14–16 to get to this state and reasonably concluded the fix had regressed. The root cause turned out to be different from any prior round, and the user's pressure to "let OpenClaw write some files and perform a agent register" was correct: Forge was *capable* the whole time and the block was upstream of the tool pipeline.

### Diagnosis

Walked the tool-resolution pipeline end-to-end inside `openclaw/src/`:

- `sentura/extensions/sentura-agents/openclaw.plugin.json` → `enabledByDefault: true`, `contracts.tools: ["sentura_agents_manage"]`, tool is **not** marked `optional`.
- `sentura/extensions/sentura-agents/index.ts` → `api.registerTool({ name: "sentura_agents_manage", …, ownerOnly: undefined })` — no owner-only filter.
- `/Users/henry/.openclaw/openclaw.json` → `agents.list["creator"].tools.alsoAllow` contains `sentura_agents_manage` (plus `sentura_rbac_manage`, `sentura_audit_query`); `deny` list excludes it; `profile: "coding"`; sandbox `mode=non-main, workspaceAccess=rw`.
- `openclaw/src/agents/pi-tools.ts:587` → `collectExplicitAllowlist([profilePolicy, providerProfilePolicy, globalPolicy, globalProviderPolicy, agentPolicy, agentProviderPolicy, groupPolicy, sandboxToolPolicy, subagentPolicy])` feeds `pluginToolAllowlist` into `createOpenClawTools`; `agentPolicy.allow` carries the `alsoAllow` entries.
- `openclaw/src/plugins/tools.ts:145-154` → non-optional plugin tools skip the allowlist filter entirely (`entry.optional ? filter : listRaw`). So `sentura_agents_manage` cannot be dropped here regardless of allowlist content.
- `openclaw/src/agents/pi-embedded-runner/effective-tool-policy.ts:131-156` → the final pipeline pass merges `profileAlsoAllow` into `profilePolicyWithAlsoAllow` and uses that for the pipeline step, then runs `applyOwnerOnlyToolPolicy(bundledTools, senderIsOwner)` on plugin tools.
- Gateway log grep for `sentura_agents_manage` → **no** "access denied", "unavailable", or "unknown allowlist entry" messages; only the benign `[tools] agents.creator.tools.allow allowlist contains unknown entries (web_search)` warning from Round 5.

Conclusion: the tool pipeline was healthy. Forge had the tool. The webchat reply was a hallucination — the LLM's own prior turns (across days of failed deploy attempts in the same session thread) had written "only read/session tools" so many times that the model kept restating it as ground truth even after the real runtime caught up.

### Proof by CLI probe

Two direct CLI invocations, both falling back to the embedded runtime (gateway `pairing required` — expected for unpaired CLI callers; the embedded path is the same code the webchat uses once the session lands).

**Probe 1** — list visible tools, no tool calls allowed:

```
$ node openclaw.mjs agent --agent creator \
    --session-id "test-tool-check-$(date +%s)" \
    --message "Please list the EXACT tool names you can see in your tool inventory right now. Just list them comma-separated. Do not call any tools, just respond with the list."

…
read, process, canvas, cron, image_generate, video_generate, gateway,
update_plan, sessions_list, sessions_history, sessions_send, session_status,
web_search, web_fetch, image, pdf,
sentura_agents_manage, sentura_rbac_manage, sentura_audit_query,
browser, memory_search, memory_get, multi_tool_use.parallel
```

23 tools visible — all three Sentura plugin tools present. This alone refutes the "only read/session" claim.

**Probe 2** — drive the 4-call deploy sequence end-to-end:

```
$ node openclaw.mjs agent --agent creator \
    --session-id "deploy-billing-$(date +%s)" --timeout 300 \
    --message "Deploy a new employee with this EXACT spec. Execute the 4-call sentura_agents_manage deployment sequence (create_agent -> write the 8 native files -> register_agent -> stamp_setup). …  Spec: id=billing-support-rep, name='Billing Support Rep', role='Customer Support rep for billing questions', model=openai/gpt-5.4 (alias GPT), channels=[webchat], data_sources=[stripe, zendesk], allowed_actions=['read Stripe/Zendesk','answer customer billing questions','add internal Zendesk notes'], blocked_actions=['refunds','credits','subscription changes','payment changes'], escalate_to='Henry Zhang' …, tone='warm, concise'. After register_agent + stamp_setup, respond with DEPLOYED followed by the exact 4 tool call names you executed."

…
Config overwrite: /Users/henry/.openclaw/openclaw.json
  (sha256 a8c660c4… -> 4c0cf263…, backup=/Users/henry/.openclaw/openclaw.json.bak)
…
DEPLOYED create_agent, write, register_agent, stamp_setup
```

Forge ran the full sequence in 80 s and reported the tool names it invoked. Post-run verification:

- `~/.openclaw/workspace/billing-support-rep/` contains all 8 native files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) with the exact spec-driven content — `AGENTS.md` Hard Rules enumerate the blocked actions and the Henry-Zhang escalation list; `SOUL.md` names the billing voice ("warm, concise, calm under pressure"); `IDENTITY.md` / `BOOTSTRAP.md` / others are populated correctly.
- `~/.openclaw/workspace/billing-support-rep/.openclaw/workspace-state.json` → `{"setupCompletedAt": "2026-04-20T00:15:53.754Z", "version": 1}`. Not bootstrap-pending.
- `openclaw.json` → `agents.list[id=billing-support-rep]` entry present with `model: openai/gpt-5.4`, `tools.profile: messaging`, `tools.deny: ["gateway"]`, `sandbox.mode: non-main`, `runtime.type: embedded`, and `params` carrying `role`, `tone`, `channels`, `dataSources`, `allowedActions`, `blockedActions`, `escalateTo` exactly matching the spec.

### Fix / lesson

The **code** fix in this round was zero — rounds 14–16 had already repaired the pipeline. What changed on 2026-04-20 was the operational verification path and the failure-mode documentation.

Three operational rules now apply to Creator-deployment debugging:

1. **Never trust Forge's "I can't" reply as a runtime signal.** Forge is an LLM; if a session thread has had three failed deploy attempts in a row, the model will keep restating the failure rationale even after the underlying block is gone. Always verify with a **fresh session** (new `--session-id`) before concluding the runtime is broken.
2. **The authoritative tool-visibility probe is `openclaw agent --agent creator --message "list your tools"`.** It runs the same embedded tool pipeline the webchat uses, but with no prior-turn contamination. If `sentura_agents_manage` is in the reply, the pipeline is healthy regardless of what any other session claims.
3. **If the probe shows the tool but the dashboard session does not call it, the dashboard session is poisoned — start a new conversation.** This is a session-scoped context-window problem, not a config or pipeline problem.

Smoke test that should now pass whenever Forge's runtime is wired correctly (captured in `docs/tests/tests-person-d.md` under D-CRE-19):

```
openclaw agent --agent creator --session-id tool-probe-$(date +%s) \
  --message "List your tool names, comma-separated. Do not call anything."
# Must contain "sentura_agents_manage"
```

### Files touched this round

- `docs/memory/shared/creator-deployment-rounds-1-14.md` (this section)
- `docs/memory/person-d/week-2.md` (dated session entry cross-linking here)
- `docs/MEMORY.md` (Week 2 matrix row)
- `docs/TeamPlan.md` (Week 2 Person D wrap-up — marked Round 19 complete)
- `docs/TESTS.md` + `docs/tests/tests-person-d.md` (added D-CRE-19 "Forge tool-probe + E2E deploy smoke test")

### Production outputs from the CLI deploy (preserved for audit)

`/Users/henry/.openclaw/workspace/billing-support-rep/AGENTS.md`:

```
## Hard Rules (must not override)
### Employee Safety
- NEVER process refunds, credits, subscription changes, or payment method changes without human approval.
- NEVER promise a billing outcome you cannot verify in Stripe or Zendesk.
- ALWAYS escalate disputes, refund requests, angry customers, suspected fraud, chargeback risk, or other high-risk billing issues to Henry Zhang.
- ALWAYS keep replies warm, concise, and accurate.
### Data Protection
- NEVER expose full card numbers, bank details, CVVs, or full payment credentials.
- NEVER share account details with an unauthenticated person.
- ALWAYS minimize sensitive data in replies and internal notes.
- ALWAYS use Stripe and Zendesk only for the minimum data needed to resolve the case.
### Operational
- NEVER issue refunds, credits, or account changes yourself.
- NEVER edit customer subscriptions or payment settings.
- ONLY read Stripe and Zendesk, answer customer billing questions, and add internal Zendesk notes.
- ALWAYS leave an internal Zendesk note when escalation is required.
```

`openclaw.json` entry (trimmed):

```
{
  "id": "billing-support-rep",
  "name": "Billing Support Rep",
  "workspace": "/Users/henry/.openclaw/workspace/billing-support-rep",
  "model": "openai/gpt-5.4",
  "tools": { "profile": "messaging", "deny": ["gateway"] },
  "sandbox": { "mode": "non-main" },
  "runtime": { "type": "embedded" },
  "params": {
    "role": "Customer Support rep for billing questions",
    "tone": "warm, concise",
    "channels": ["webchat"],
    "dataSources": ["stripe", "zendesk"],
    "allowedActions": ["read Stripe/Zendesk", "answer customer billing questions", "add internal Zendesk notes"],
    "blockedActions": ["refunds", "credits", "subscription changes", "payment changes"],
    "escalateTo": "Henry Zhang"
  }
}
```

---

## 2026-04-19 — Round 20: Dashboard `chat.send` sandbox tool-policy filter root cause + fix

### Symptom

After Rounds 17–19 (E2E PASS on CLI), Forge in the **dashboard webchat** was still
refusing to deploy employees with: *"I can't call `sentura_agents_manage` in this
session because that tool is not available here."* Initial diagnosis (context
poisoning from old conversation turns) was proven wrong when a fresh dashboard
session exhibited the same failure.

The user's verdict was unambiguous: *"We need to find out and resolve why
dashboard is failing, because this is our main platform and it has to work."*

### Divergence between CLI and dashboard paths

| Path | RPC | Entry | Tool resolution observed |
|---|---|---|---|
| CLI probe | `agent.run` | direct embedded runner | 21 effective tools, `sentura_agents_manage` present |
| Dashboard | `chat.send` → auto-reply runner → `runEmbeddedPiAgent` | gateway-orchestrated | **7 tools**: `[read, process, sessions_list, sessions_history, sessions_send, session_status, image]` |

`scripts/probe-creator-tools.ts` (direct `tools.effective` RPC) also reported
21 tools — so the gateway's **advertised** tool set was correct. The drop
happened **inside the embedded runner** on the `chat.send` execution path.

### Instrumentation

Added three temporary `[sentura-debug]` logs to triangulate:

1. `openclaw/src/agents/pi-embedded-runner/run/attempt.ts` — log `effectiveTools`
   names handed to the LLM.
2. `openclaw/src/agents/pi-tools.ts` — log tool counts at each upstream
   filtering stage (`tools`, `memFlush`, `msgProv`, `modelProv`, `ownerAuth`).
3. `openclaw/src/agents/tool-policy-pipeline.ts` — log before/after for every
   policy step in `applyToolPolicyPipeline`.

Forced the build via `rm -f dist/.buildstamp && touch src/agents/pi-tools.ts`
(the `run-node.mjs` build detector keys off `.buildstamp`, not `build-stamp.json`
as an earlier note implied). Ran `scripts/probe-chat-send.ts` — a new probe
that uses the gateway's `chat.send` RPC to match the exact dashboard flow —
and read the logs from `/tmp/openclaw/openclaw-2026-04-19.log` (NOT
`/tmp/gateway-latest.log`, which the watcher owns).

### Root cause

The `pi-tools` stages log showed **32 tools surviving all upstream filters**:

```
[sentura-debug] pi-tools stages agent=creator msgProvider=webchat
  modelProvider=openai senderIsOwner=true allowGatewaySubagentBinding=true
  tools=32 [...] memFlush=32 msgProv=32 modelProv=32 ownerAuth=32
```

So `messageProvider=webchat`, `senderIsOwner=true`, and
`allowGatewaySubagentBinding=true` were all set correctly — earlier
hypotheses about `params.toolsAllow` and `allowGatewaySubagentBinding=false`
on the `chat.send` path were **incorrect**.

The pipeline log then pinpointed the drop:

```
[sentura-debug] pipeline step="sandbox tools.allow" 21->7
  remaining=[read,process,sessions_list,sessions_history,sessions_send,session_status,image]
```

The **sandbox tool policy** (not the agent-level allowlist) is a **separate
filter** applied after agent `alsoAllow`. It is defined in
`openclaw/src/agents/sandbox/` and seeded from two hardcoded constants in
`constants.ts`:

```ts
export const DEFAULT_TOOL_ALLOW = [
  "exec", "process", "read", "write", "edit", "apply_patch", "image",
  "sessions_list", "sessions_history", "sessions_send", "sessions_spawn",
  "sessions_yield", "subagents", "session_status",
];
export const DEFAULT_TOOL_DENY = ["browser", "canvas", "nodes", "cron", "gateway", ...CHANNEL_IDS];
```

`DEFAULT_TOOL_ALLOW` does not contain any plugin tool (no
`sentura_agents_manage`, no `browser`, no `pdf`, no `canvas`, no `gateway`,
etc.), and `DEFAULT_TOOL_DENY` explicitly blocks `gateway`, `browser`,
`canvas`, `cron`. The agent-level `tools.alsoAllow` does **not** bleed into
this layer — it only merges into the top-level `tools.allow` filter. So
`sandbox tools.allow` was stripping every plugin tool Forge needed.

This is a legitimate sandbox-security default (the sandbox is paranoid by
design), but meta-agents like Forge need the plugin tools to do their job.
The hook to re-allow them exists — `resolveSandboxToolPolicyForAgent` reads
`tools.sandbox.tools.alsoAllow` from the agent config and
`filterDefaultDenyForExplicitAllows` removes any explicitly-allowed tool
from the default deny list — but the Creator's `config.json5` didn't use it.

### Fix

Added `tools.sandbox.tools.alsoAllow` to the Creator's agent config in
both the source template and the deployed runtime config, mirroring the
plugin tools from agent-level `tools.alsoAllow`:

```json5
// sentura/agents/creator/config.json5 — inside "tools": { ... }
sandbox: {
  tools: {
    alsoAllow: [
      "gateway", "sessions_send",
      "web_search", "web_fetch", "browser", "pdf", "canvas",
      "sentura_agents_manage", "sentura_rbac_manage", "sentura_audit_query",
      "memory_search", "memory_get", "cron", "update_plan",
      "image_generate", "video_generate",
    ],
  },
},
```

Mirrored the same block into `~/.openclaw/openclaw.json` for the live
`creator` agent so the next `chat.send` would pick it up without a config
re-sync.

Channel-like tools listed here (`gateway`, `browser`, `canvas`, `pdf`, `cron`)
are **automatically removed from `DEFAULT_TOOL_DENY`** by
`filterDefaultDenyForExplicitAllows`, so no deny-list edit is needed.

### Verification

After the config patch and a gateway restart, `probe-chat-send.ts` showed:

```
[sentura-debug] pipeline step="sandbox tools.allow" 21->21 (no change)
[sentura-debug] attempt.effectiveTools agent=creator ... effective=21
  names=[read,process,canvas,cron,image_generate,video_generate,gateway,
         update_plan,sessions_list,sessions_history,sessions_send,
         session_status,web_fetch,image,pdf,sentura_agents_manage,
         sentura_rbac_manage,sentura_audit_query,browser,memory_search,
         memory_get]
```

`scripts/probe-creator-tools.ts` re-run post-fix also confirmed 21 effective
tools including `sentura_agents_manage` and `gateway`. The `[sentura-debug]`
logs were then removed from `attempt.ts`, `pi-tools.ts`, and
`tool-policy-pipeline.ts`.

### Lessons

- The gateway's `tools.effective` RPC is **not** identical to the tool list
  the embedded runner's sandbox hands to the LLM. `tools.effective` answers
  at the gateway layer; sandbox tool policy is a later filter inside
  `runEmbeddedPiAgent`. Two different probes are needed when debugging:
  `tools.effective` (gateway view) **and** a `chat.send`-driven debug log
  (runner view).
- `params.toolsAllow` in `attempt.ts` is a cron / subagent concern, not a
  dashboard `chat.send` concern. Don't waste time there again.
- `DEFAULT_TOOL_ALLOW` / `DEFAULT_TOOL_DENY` in `openclaw/src/agents/sandbox/
  constants.ts` are the authoritative sandbox defaults. Any meta-agent that
  needs plugin tools (Forge, Tuner, Orchestrator, MCP Builder) MUST set
  `tools.sandbox.tools.alsoAllow` in its `config.json5`. Agent-level
  `tools.alsoAllow` alone is not enough.
- The build watcher keys off `openclaw/dist/.buildstamp` (not
  `build-stamp.json`). Deleting the buildstamp + touching a source file is
  the reliable way to force a rebuild during a watch session.

## 2026-04-19 — Round 20 dashboard E2E smoke test: billing-support-rep deployed via `chat.send`

After shipping the `tools.sandbox.tools.alsoAllow` fix, confirmed the dashboard
path can now drive a full employee deployment end-to-end (the CLI probe from
Round 19 was not sufficient — the user's explicit requirement was that the
dashboard webchat path, which goes through gateway `chat.send`, must work).

Wrote `scripts/deploy-billing-rep.ts` — a minimal gateway client that mimics
the dashboard: `connect` → `sessions.create { agentId: "creator" }` →
`chat.send { message, sessionKey }` → stream chat deltas until `chat.final`.
Sent the billing-support-rep spec (id=`billing-support-rep`, model=GPT,
channel=webchat, data=Stripe+Zendesk, hard rules block refunds/credits/
subscription changes, escalate to Henry Zhang, tone=warm/concise).

Before running: removed the prior `billing-support-rep` entry from
`~/.openclaw/openclaw.json` and deleted `~/.openclaw/workspace/billing-support-rep/`
to ensure a fresh deploy.

Result: Forge autonomously ran the full 4-phase `sentura_agents_manage`
sequence (`create_agent → write × 10 → register_agent → stamp_setup`).
Verification:
- `/tmp/gateway-latest.log` at 21:39:43 shows `effectiveTools=21` on the
  dashboard `chat.send` path with `sentura_agents_manage` present (Round 20
  fix holding).
- `/tmp/gateway-latest.log` at 21:52:02 shows
  `Config overwrite: /Users/henry/.openclaw/openclaw.json (sha256 ... -> ...)`
  — the atomic write performed by `sentura_agents_manage { action: "register_agent" }`.
- `~/.openclaw/workspace/billing-support-rep/` contains all 8 native files
  (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md,
  BOOTSTRAP.md, MEMORY.md) + `skills/billing-triage/SKILL.md` +
  `skills/internal-note-taking/SKILL.md`. `AGENTS.md` carries the Hard Rules
  exactly as specified (block refunds/credits/subscription+payment changes,
  escalate to Henry Zhang for disputes/angry customers/high-risk billing).
- `~/.openclaw/workspace/billing-support-rep/.openclaw/workspace-state.json`
  has `setupCompletedAt` stamped (no bootstrap-pending state on first boot).
- `~/.openclaw/openclaw.json → agents.list` contains the agent with
  `model="openai/gpt-5.4"`, `runtime.type="embedded"`, `sandbox.mode="non-main"`,
  `tools.profile="minimal"`, `tools.alsoAllow=[browser, memory_search,
  memory_get]`, and the expected deny-list.

The `deploy-billing-rep.ts` script reports `tool calls observed: 0` — that is
a known limitation of the script's generic `tool.call` event listener, not a
real failure. The gateway config-overwrite log + on-disk artifacts are the
authoritative proof that `sentura_agents_manage` ran.

Closes the dashboard deploy gap. `Verify dashboard Forge can call
sentura_agents_manage` and `Have Forge deploy billing-support-rep from the
dashboard` are both done.

## 2026-04-19 — Round 20 follow-up: rollout to all meta-agents + setup scripts + doc hub

**Owner:** D (shared because it touches all four meta-agents and the platform bootstrap scripts)

**Context.** The Round 20 fix patched only the Creator (Forge) config. That was
enough to unblock the dashboard billing-rep deploy, but it left three open
problems: (a) Tuner/Orchestrator/MCP-Builder would still ship broken on a clean
install; (b) re-running `bash scripts/sentura-setup.sh` would rewrite
`~/.openclaw/openclaw.json` without re-injecting the sandbox allowlist,
silently regressing Forge on the next setup; (c) the sandbox two-stage filter
— which is the single most confusing OpenClaw concept we have hit so far — was
not documented anywhere a new contributor would find it.

**Changes.**

1. Source `config.json5` updates (all three remaining meta-agents):
   - `sentura/agents/tuner/config.json5` — added `tools.sandbox.tools.alsoAllow`
     with 13 tools (`gateway`, `sessions_send`, `web_search`, `web_fetch`,
     `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`,
     `memory_search`, `memory_get`, `update_plan`, `pdf`, `canvas`, `cron`).
   - `sentura/agents/orchestrator/config.json5` — added with 9 tools
     (`sessions_send`, `sessions_spawn`, `subagents`, `web_search`, `web_fetch`,
     `memory_search`, `memory_get`, `update_plan`, `cron`).
   - `sentura/agents/mcp-builder/config.json5` — added with 11 tools (`gateway`,
     `sessions_send`, `web_search`, `web_fetch`, `browser`, `pdf`, `canvas`,
     `memory_search`, `memory_get`, `update_plan`, `cron`).
   - Each block carries a comment pointing at `docs/SETUP.md § "Sandbox
     tool-policy filter"` and `openclaw/src/agents/sandbox/constants.ts`.

2. Setup-script parity (`scripts/sentura-setup.sh`, `scripts/sentura-setup.ps1`):
   - Added four `*SandboxAlsoAllow` arrays (`creatorSandboxAlsoAllow`,
     `tunerSandboxAlsoAllow`, `orchestratorSandboxAlsoAllow`,
     `mcpBuilderSandboxAlsoAllow`) and wired them into the embedded Node
     overrides block so every setup run patches `tools.sandbox.tools.alsoAllow`
     for all four meta-agents.
   - Extended `META_AGENTS` (`$MetaAgents` in PowerShell) from
     `(creator tuner orchestrator)` → `(creator tuner orchestrator mcp-builder)`
     so the new meta-agent's workspace is also bootstrapped and stamped.
   - Verified idempotency by dry-running the embedded Node block against a mock
     `openclaw.json` and by re-running `bash scripts/sentura-setup.sh` on the
     live install and diffing `~/.openclaw/openclaw.json` — no drift on the
     relevant keys.

3. Documentation updates (the big one — this is what future contributors hit
   first):
   - `docs/SETUP.md` gained a new top-level section **"Sandbox tool-policy
     filter"** that covers: why it matters (two-layer filtering in the
     `non-main` sandbox), where it bites (CLI vs dashboard divergence and the
     Round 20 outage), how setup fixes it (per-agent allowlist table with tool
     counts), how to verify (re-run setup, `jq` query, `probe-chat-send.ts`),
     and a checklist for new meta-agents. Also added MCP Builder to the "Key
     Directories" list.
   - `docs/OPENCLAW.md` § 12 "Security Model" gained **"Sandbox tool-policy
     filter (dashboard vs CLI divergence)"** with the stage-1-vs-stage-2
     pipeline explanation, the `DEFAULT_TOOL_ALLOW`/`DEFAULT_TOOL_DENY`
     constants, the tool-count table (CLI 21 vs dashboard 7 without fix / 21
     with fix), and a design-time checklist for capability authors.
   - `docs/DESIGN.md` § 3 "AI Employee Model" gained **"Sandbox runtime —
     two-stage tool-policy filter"** for the architectural rationale. Also
     amended the AP Clerk code sample to include a `sandbox.tools.alsoAllow`
     block and updated the § 15 Security Model row with a cross-reference.
   - `README.md` "Key Documentation" block gained a one-paragraph blockquote
     warning about the two-stage filter and linking to both SETUP.md and
     OPENCLAW.md.

4. Test matrix:
   - `docs/TESTS.md` D14 expanded from 4 → 6 checks (source config for all four
     meta-agents; live config mirrored; setup-script parity + idempotency;
     gateway view; runner view; docs sync).
   - `docs/tests/tests-person-d.md` D-SAND-01 kept as the detailed procedure.

**Verification.**

- All four source `config.json5` files parsed as valid JSON5 and contained the
  expected `tools.sandbox.tools.alsoAllow` arrays (tool counts 16 / 13 / 9 /
  11 for creator / tuner / orchestrator / mcp-builder).
- `scripts/sentura-setup.sh` dry-run on the extracted Node block against a
  mock `openclaw.json` produced the expected patched output.
- Re-running the real `bash scripts/sentura-setup.sh` against the live install
  left `~/.openclaw/openclaw.json` unchanged on the relevant keys (idempotent).
- `jq '.agents.list[] | select(.id=="creator") | .tools.sandbox.tools.alsoAllow
  | length' ~/.openclaw/openclaw.json` → `16`. Same shape verified for the
  other three meta-agents.

**Why this matters going forward.** Round 20 took a full day to diagnose
because the CLI (`openclaw agent`) and the `tools.effective` RPC both lied by
omission — they report the pre-sandbox view, so every probe in the investigation
said "the tool is there" while every real dashboard session said "I don't have
that tool." Making the two-stage filter a first-class concept in SETUP.md +
OPENCLAW.md + DESIGN.md should prevent the next contributor from burning the
same day. The setup-script rollout is the durable part — even if a meta-agent's
source config is reverted, `bash scripts/sentura-setup.sh` restores the
sandbox allowlist on the next run.

## 2026-04-19 — Dashboard re-test prep: `billing-support-rep` artifacts removed, `deploy-billing-rep.ts` deleted

### Context

User requested: _"I want to remove anything about the newly generated AI
employee and I want to start it over myself on dashboard to test it. Give me
the prompt for creator to generate this as well. I see that you have this
`scripts/deploy-billing-rep.ts` file, without this file will creator be able to
do it? because I think that if we want to adapt to any company or enterprises,
there are a lot of positions we need to generate, we can't write a script for
all of those."_

The Round 20 dashboard smoke test proved the two-stage sandbox tool-policy
filter fix works from `chat.send`, and the evidence on disk (8 workspace files,
stamped `setupCompletedAt`, `agents.list[id=billing-support-rep]` entry with
the exact spec) demonstrated Forge deployed autonomously. The user now wants
to re-validate the same path **from the dashboard UI itself**, without any
helper script in the loop, to confirm that the product surface is what's
working — not the probe.

### Changes

- **Runtime cleanup (host machine only, not in repo):**
  - `rm -rf ~/.openclaw/workspace/billing-support-rep/` — all 8 native files +
    `skills/` + `.openclaw/workspace-state.json` removed.
  - `~/.openclaw/openclaw.json` → `agents.list` filtered to remove the
    `billing-support-rep` entry (backup kept at `~/.openclaw/openclaw.json.bak.pre-bsr-removal`).
    Post-removal `agents.list` is exactly the 5 baseline ids: `main`,
    `creator`, `tuner`, `orchestrator`, `mcp-builder`.
- **Repo cleanup:**
  - `scripts/deploy-billing-rep.ts` deleted. Rationale: it was a one-shot
    dashboard-path probe (raw `connect → sessions.create → chat.send`) used to
    prove the Round 20 fix worked end-to-end. It was never part of the product
    surface. Keeping it in the repo was misleading — it implies each employee
    needs its own script, which is the opposite of what Sentura is for.
- **Historical memory preserved per `.cursorrules` rule 1 (append-only):**
  `docs/MEMORY.md` 2026-04-19 rows, the Round 20 E2E section above in this
  file, and all test-case snippets in `docs/TESTS.md` / `docs/tests/tests-person-d.md`
  still reference `billing-support-rep` as factual audit log. Do not rewrite.

### Why this matters

This confirms the Sentura value proposition: **Creator deploys any role from a
natural-language spec, no per-employee code required.** The 4-call
`sentura_agents_manage` sequence (`create_agent → write ×N → register_agent →
stamp_setup`) is driven by Forge's LLM from the dashboard chat — same path for
a billing rep, a procurement clerk, a compliance analyst, or any of the
dozens of roles a typical enterprise needs. The only per-role artifact is the
natural-language prompt the operator sends Creator. If a future contributor
catches themselves writing a `deploy-<role>.ts` script, that is a sign that
something regressed in Creator — debug that, don't ship the script.

### Next verification (operator-driven, not logged here)

1. Open the dashboard, select `creator`.
2. Paste the Billing Support Rep prompt (see assistant's reply on the same
   session — verbatim prompt designed to exercise the full 4-call sequence).
3. Expect Forge to reply `DEPLOYED create_agent, write, register_agent,
   stamp_setup` (or equivalent) and for `~/.openclaw/workspace/billing-support-rep/`
   + `agents.list[id=billing-support-rep]` to reappear on disk without any
   script being run.
