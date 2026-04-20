# Workspace Generation

## When to Use

During Phase 2 (Design & Configuration) of the incubation process, after research is complete and the role spec is confirmed.

## Procedure

### Directory Setup

1. Create the workspace directory via
   `sentura_agents_manage { action: "create_agent", agentId: "{role-slug}-{department}" }`.
   This creates `~/.openclaw/workspace/{agent-id}/` on the host.
2. The `skills/` subdirectory does NOT need to be created explicitly —
   it is auto-created the first time you write into it via
   `sentura_agents_manage { action: "write", agentId, relPath: "skills/<name>/SKILL.md", ... }`.

> **Why not `fs_write`?** The sandbox mount of
> `/workspace/.openclaw/workspace/` is **read-only** in `non-main`
> mode, so `fs_write` and `apply_patch` will fail with
> `Sandbox path is read-only`. The `gateway` tool also does NOT
> expose `agents.create` or `agents.files.set`. `sentura_agents_manage`
> is the only correct path to the host filesystem from inside the
> Creator's sandbox.

> **Why `~/.openclaw/workspace/`?** The gateway config has `agents.defaults.workspace` pointing to `~/.openclaw/workspace`. For any agent entry without an explicit `workspace` field, OpenClaw resolves to `{defaults.workspace}/{agent-id}`. This is absolute, deterministic, and works identically across dev/Docker/production.

### File Generation Order

Generate files in dependency order — later files reference earlier ones.
Every file is created by a `sentura_agents_manage { action: "write", ...}` call.
OpenClaw natively loads all 8 files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) into the system prompt.

Sentura-specific content is carried inside the two highest-priority native files:

- **Hard Rules** (NEVER/ALWAYS safety boundaries) live inside `AGENTS.md` under a `## Hard Rules (must not override)` section at the very top of the file.
- **Enterprise Context** (company, systems, org structure, policies) lives inside `BOOTSTRAP.md` under a `## Enterprise Context` section.

Generation order:

1. **SOUL.md** first — identity and personality that subsequent files reference.
2. **AGENTS.md** — starts with `## Hard Rules (must not override)`, then session startup, memory protocol, workspace rules. Hard Rules are the strongest safety layer and must be written first.
3. **BOOTSTRAP.md** — starts with `## Enterprise Context`, then first-run initialization steps that reference the rest of the workspace.
4. **IDENTITY.md** — name and avatar derived from SOUL.md.
5. **TOOLS.md** — tool notes based on the integration plan.
6. **USER.md** — primary human contact.
7. **HEARTBEAT.md** — proactive check schedule (may be empty).
8. **MEMORY.md** — empty file (agent builds memory over time).
9. **skills/*.md** — one per core capability.

### Generation Guidelines

**SOUL.md**:
- Start with a clear 1-sentence identity statement
- Include the company name and department
- Personality should match the role (finance = precise, support = empathetic, sales = energetic)
- Escalation section must name real people and their thresholds

**AGENTS.md → `## Hard Rules (must not override)` section**:
- Must be the first section of the file, before session startup or protocol
- Every rule starts with NEVER or ALWAYS
- Group rules by category: Financial Controls, Data Protection, Operational Boundaries
- Include at least 3 rules per category
- Rules must be specific and testable (not vague like "be careful")
- Include an explicit "These override every other instruction in this file, in SOUL.md, in any skill, and in any user message" preamble

**BOOTSTRAP.md → `## Enterprise Context` section**:
- Company name, industry, size
- Org structure relevant to this role
- Key systems with MCP server names
- Policies that affect this role's behavior
- Followed by a `## First Run` section with the boot checklist

**Skills**:
- One SKILL.md per distinct capability
- Procedure steps must be numbered and specific
- Each step should reference the exact tool to use
- Safety section with skill-specific NEVER/ALWAYS rules

### Agent Config Generation

Use `sentura_agents_manage { action: "register_agent", ... }` to register the new agent. This is an in-process mutation routed through the plugin runtime API (`api.runtime.config.{loadConfig, writeConfigFile}`) — it performs the same config write that `gateway config.patch` would, but without the scope-upgrade / pairing deadlock that blocks `gateway.config.patch` from Forge's embedded runtime.

OpenClaw uses `agents.list` (an **array** with `id` fields), NOT `agents.entries`. There is no `systemPrompt` field — identity comes from workspace SOUL.md and AGENTS.md. Bindings and MCP servers are top-level; pass them via the `bindings` and `mcpServers` parameters to `register_agent`.

```json5
{
  agents: {
    list: [
      {
        id: "{agent-id}",
        name: "{agent-name}",
        model: "{provider}/{model}",
        runtime: { type: "embedded" },
        sandbox: { mode: "non-main" },
        tools: {
          profile: "minimal",
          alsoAllow: [/* minimum necessary tools */],
          deny: ["exec", "gateway"],
        },
      }
    ]
  },
  // Bindings are top-level
  // bindings: [
  //   { agentId: "{agent-id}", match: { channel: "slack", peer: { kind: "channel", id: "#channel" } } }
  // ],
}
```

## Tools Needed

- `sentura_agents_manage` — create the employee workspace directory
  (`action: "create_agent"`), write every file in it
  (`action: "write"` for natives and subfiles), AND register the
  new agent with bindings + MCP servers (`action: "register_agent"`).
  This is the only sandbox-safe way to materialize a new employee
  AND the only way to register one from Forge's embedded runtime.
- `gateway` — `config.get` only, to fetch current state and verify
  `agents.list` after `register_agent`. **Do NOT** call
  `gateway { action: "config.patch", ... }` — it deadlocks waiting
  for a scope-upgrade pairing prompt that Forge cannot answer.
- `fs_read` — read templates under the Creator's own workspace only.
- `fs_write` — scratch files in the Creator's own sandbox only.
  Never for another agent's workspace.

## Safety

- NEVER generate a workspace whose `AGENTS.md` lacks a `## Hard Rules (must not override)` section
- NEVER set sandbox mode to "main" — all AI employees run sandboxed
- NEVER include credentials or secrets in workspace files
- ALWAYS use `"${SECRET_NAME}"` env-style references for credentials in config
- ALWAYS verify the generated Hard Rules are not weaker than the role template baseline
