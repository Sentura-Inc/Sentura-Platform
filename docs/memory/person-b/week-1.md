> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Read when the current task touches the specific subsystem this session covered.

# Person B — Creator Agent & Agent Workspaces — Week 1

Sessions that built the Creator meta-agent workspace (AGENTS.md, SOUL.md, skills, templates) and fixed the workspace-path architecture so Sentura templates resolve from repo root while runtime state lives under OpenClaw's state dir.

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-05 | Week 1 Person B: Creator Agent, Workspace Convention, Templates, Skills |
| 2026-04-05 | Workspace Path Architecture Fix (OpenClaw State Directory Integration) |

---

## 2026-04-05 — Week 1 Person B: Creator Agent, Workspace Convention, Templates, Skills

**What was done:**

All 7 Person B Week 1 tasks completed:

1. **Creator Agent workspace** (`sentura/agents/creator/`) — rewrote all 7 OpenClaw default files from generic personal-assistant templates to Sentura-specific Creator Agent content:
   - SOUL.md: Creator Agent identity, 5-phase incubation mission, operating principles
   - AGENTS.md: Detailed incubation protocol (Phase 1-5), output format, red lines
   - IDENTITY.md: Named "Forge", emoji 🔨
   - BOOTSTRAP.md: First-run initialization for meta-agent
   - HEARTBEAT.md: Periodic checks for pending incubations and post-deployment monitoring
   - TOOLS.md: Tool catalog, template library reference, MCP tier system
   - USER.md: Primary user profile (enterprise admins and department managers)
   - Created 3 Creator Agent skills: `skills/incubation/SKILL.md`, `skills/role-research/SKILL.md`, `skills/workspace-generation/SKILL.md`

2. **Workspace file convention** — created `docs/workspace-convention.md`:
   - Full specification for all 10 files + skills/ directory
   - File priority order (RULES.md > Skills Safety > SOUL.md Escalation > AGENTS.md Red Lines > CONTEXT.md Policies > SOUL.md Personality)
   - System prompt assembly order
   - Cross-team guidance (for Person C dashboard display, Person D extension interaction)

3. **3 role templates** in `sentura/config/templates/`:
   - `ap-clerk/` — config.json5, SOUL.md, RULES.md, CONTEXT.md, skills/{invoice-processing,vendor-management}
   - `cs-agent/` — config.json5, SOUL.md, RULES.md, CONTEXT.md, skills/{ticket-triage,refund-processing}
   - `sdr/` — config.json5, SOUL.md, RULES.md, CONTEXT.md, skills/{prospect-research,outreach-crafting}
   - All templates use `{placeholder}` convention for customizable values
   - `README.md` explaining template system and how to add new templates

4. **Self-provisioning skill** (`sentura/skills/self-provisioning/SKILL.md`):
   - 8-step procedure: check credentials → determine approval → navigate → register → obtain API keys → configure MCP → verify → audit log
   - Error handling for CAPTCHA, 2FA, rate limits, phone verification
   - Approval routing table (auto-approve vs standard vs elevated)
   - Secret store naming convention

5. **Knowledge-curation skill** (`sentura/skills/knowledge-curation/SKILL.md`):
   - 6-step procedure: receive source → extract info → structure knowledge → identify affected employees → distribute → verify
   - Handles URLs, PDFs, API docs, and verbal descriptions
   - Knowledge classification (procedural → SKILL.md, contextual → CONTEXT.md, safety → RULES.md with approval, reference → data/)

6. **Manual employee creation test** — created `workspaces/cs-agent-gradsale/`:
   - Complete 10-file workspace based on the GradSale ekg/ reference enterprise
   - All files filled with real GradSale context (admin API endpoints, dispute handling, support policies)
   - 2 skills: `support-triage/SKILL.md` and `dispute-resolution/SKILL.md` referencing actual GradSale admin API endpoints
   - `config.json5` — full agent config with MCP server references for gradsale-admin and gradsale-web

**Files created:**
- `sentura/agents/creator/SOUL.md` (rewritten)
- `sentura/agents/creator/AGENTS.md` (rewritten)
- `sentura/agents/creator/IDENTITY.md` (rewritten)
- `sentura/agents/creator/BOOTSTRAP.md` (rewritten)
- `sentura/agents/creator/HEARTBEAT.md` (rewritten)
- `sentura/agents/creator/TOOLS.md` (rewritten)
- `sentura/agents/creator/USER.md` (rewritten)
- `sentura/agents/creator/skills/incubation/SKILL.md`
- `sentura/agents/creator/skills/role-research/SKILL.md`
- `sentura/agents/creator/skills/workspace-generation/SKILL.md`
- `docs/workspace-convention.md`
- `sentura/config/templates/README.md`
- `sentura/config/templates/ap-clerk/{config.json5,SOUL.md,RULES.md,CONTEXT.md,skills/invoice-processing/SKILL.md,skills/vendor-management/SKILL.md}`
- `sentura/config/templates/cs-agent/{config.json5,SOUL.md,RULES.md,CONTEXT.md,skills/ticket-triage/SKILL.md,skills/refund-processing/SKILL.md}`
- `sentura/config/templates/sdr/{config.json5,SOUL.md,RULES.md,CONTEXT.md,skills/prospect-research/SKILL.md,skills/outreach-crafting/SKILL.md}`
- `sentura/skills/self-provisioning/SKILL.md`
- `sentura/skills/knowledge-curation/SKILL.md`
- `workspaces/cs-agent-gradsale/{SOUL.md,RULES.md,CONTEXT.md,AGENTS.md,IDENTITY.md,TOOLS.md,HEARTBEAT.md,BOOTSTRAP.md,MEMORY.md,USER.md,config.json5,skills/support-triage/SKILL.md,skills/dispute-resolution/SKILL.md}`

**Files modified:**
- `docs/TeamPlan.md` — marked all Person B Week 1 tasks as done
- `docs/MEMORY.md` — this entry

**Key decisions:**
- Creator Agent named "Forge" with a structured 5-phase incubation protocol
- File priority order defined: RULES.md has highest precedence, SOUL.md personality lowest
- Templates use `{placeholder}` convention (curly braces) for values customized at incubation time
- Templates include `$` prefix for financial thresholds (e.g., `${high_threshold}`) to distinguish from string placeholders
- GradSale CS Agent used as the manual creation test — references real GradSale admin API endpoints from ekg/ docs
- MCP server config in the test employee references Tier 2 (Sentura-generated) servers that Person D will build in Week 2

**Nothing left incomplete.** All 7 Person B Week 1 tasks are done.

**Known issues:** None introduced.

---

## 2026-04-05 — Workspace Path Architecture Fix (OpenClaw State Directory Integration)

**What was done:**

Investigated how OpenClaw resolves agent workspace paths at runtime and corrected all Sentura files that had incorrect assumptions about workspace locations.

**Problem identified:**
All agent `config.json5` files (templates and test employee) used `workspace: "./workspaces/{agent-id}"` — a CWD-relative path. OpenClaw resolves relative paths via `path.resolve()` against the gateway process's CWD, which varies by environment (local dev launches from `openclaw/`, Docker uses `/app/`, etc.). This made workspace resolution fragile and environment-dependent.

**Resolution chain discovered (from OpenClaw source):**
1. `resolveAgentWorkspaceDir()` in `openclaw/src/agents/agent-scope.ts`
2. → checks agent config `workspace` field → `resolveUserPath()` → `path.resolve()` (CWD-relative)
3. → checks `agents.defaults.workspace` + agent ID
4. → falls back to `resolveStateDir()` + `workspace-{agentId}` → `~/.openclaw/workspace-{agentId}`

**Sentura convention adopted:** Omit `workspace` from all agent configs. Let OpenClaw fall back to `~/.openclaw/workspace-{agent-id}/`. This is absolute, deterministic, and works identically across dev/Docker/production.

**Clarified design-time vs runtime:**
- `workspaces/` in git = reference examples for development validation (NOT runtime)
- `sentura/config/templates/` in git = starting-point templates with placeholders (NOT runtime)
- `~/.openclaw/workspace-{agent-id}/` = live runtime workspaces (NOT in git)

**Files modified:**
- `docs/workspace-convention.md` — added Runtime vs Design-time sections, deployment lifecycle, path resolution explanation, templates-vs-runtime comparison table
- `workspaces/cs-agent-gradsale/config.json5` — removed `workspace` and `skills` fields
- `sentura/config/templates/ap-clerk/config.json5` — removed `workspace` and `skills` fields
- `sentura/config/templates/cs-agent/config.json5` — removed `workspace` and `skills` fields
- `sentura/config/templates/sdr/config.json5` — removed `workspace` and `skills` fields
- `sentura/config/templates/README.md` — added workspace path convention section
- `sentura/agents/creator/AGENTS.md` — Phase 5 now specifies `~/.openclaw/` target
- `sentura/agents/creator/TOOLS.md` — corrected workspace directory reference
- `sentura/agents/creator/skills/workspace-generation/SKILL.md` — corrected directory setup to `~/.openclaw/`, removed `workspace` from config template
- `sentura/agents/creator/skills/incubation/SKILL.md` — added target directory note and no-workspace-field rule
- `docs/MEMORY.md` — this entry

**Key architectural decision:**
Sentura never sets `workspace` in agent configs. The Creator Agent writes files directly to `~/.openclaw/workspace/{agent-id}/` during incubation, and OpenClaw's default namespace resolution finds them automatically. This single convention eliminates an entire class of CWD-related deployment bugs.

**Nothing left incomplete.**

**Known issues:** None introduced.

---

