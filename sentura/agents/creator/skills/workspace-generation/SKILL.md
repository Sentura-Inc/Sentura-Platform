# Workspace Generation

## When to Use

During Phase 2 (Design & Configuration) of the incubation process, after research is complete and the role spec is confirmed.

## Procedure

### Directory Setup

1. Create the workspace directory at OpenClaw's default location: `~/.openclaw/workspace/{role-slug}-{department}/`
2. Create the skills subdirectory: `~/.openclaw/workspace/{role-slug}-{department}/skills/`

> **Why `~/.openclaw/workspace/`?** The gateway config has `agents.defaults.workspace` pointing to `~/.openclaw/workspace`. For any agent entry without an explicit `workspace` field, OpenClaw resolves to `{defaults.workspace}/{agent-id}`. This is absolute, deterministic, and works identically across dev/Docker/production.

### File Generation Order

Generate files in dependency order — later files reference earlier ones. All files are written to `~/.openclaw/workspace/{agent-id}/`. The 8 standard files (AGENTS.md through MEMORY.md) are natively loaded by OpenClaw. RULES.md and CONTEXT.md are injected by the `sentura-bootstrap` hook during `agent:bootstrap`.

1. **CONTEXT.md** first — enterprise context that other files reference (injected by sentura-bootstrap hook)
2. **RULES.md** second — safety boundaries that constrain everything else (injected by sentura-bootstrap hook)
3. **SOUL.md** third — identity that respects RULES.md boundaries
4. **AGENTS.md** — session behavior that references SOUL.md and RULES.md
5. **IDENTITY.md** — name and avatar derived from SOUL.md identity
6. **TOOLS.md** — tool notes based on the integration plan
7. **USER.md** — primary human contact
8. **HEARTBEAT.md** — proactive check schedule (may be empty)
9. **BOOTSTRAP.md** — first-run initialization
10. **MEMORY.md** — empty file (agent builds memory over time)
11. **skills/*.md** — one per core capability

### Generation Guidelines

**SOUL.md**:
- Start with a clear 1-sentence identity statement
- Include the company name and department
- Personality should match the role (finance = precise, support = empathetic, sales = energetic)
- Escalation section must name real people and their thresholds

**RULES.md**:
- Every rule starts with NEVER or ALWAYS
- Group rules by category: Financial Controls, Data Protection, Operational Boundaries
- Include at least 3 rules per category
- Rules must be specific and testable (not vague like "be careful")

**CONTEXT.md**:
- Company name, industry, size
- Org structure relevant to this role
- Key systems with MCP server names
- Policies that affect this role's behavior

**Skills**:
- One SKILL.md per distinct capability
- Procedure steps must be numbered and specific
- Each step should reference the exact tool to use
- Safety section with skill-specific NEVER/ALWAYS rules

### Agent Config Generation

Use the `gateway` tool with `action: "config.patch"` to register the new agent. The patch is a JSON5 merge-patch applied to `~/.openclaw/openclaw.json`.

OpenClaw uses `agents.list` (an **array** with `id` fields), NOT `agents.entries`. There is no `systemPrompt` field — identity comes from workspace SOUL.md and AGENTS.md. Bindings and MCP servers go at the top level, not inside the agent entry.

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

- `fs_write` — create workspace directories and files
- `fs_read` — read templates for reference

## Safety

- NEVER generate a workspace without RULES.md
- NEVER set sandbox mode to "main" — all AI employees run sandboxed
- NEVER include credentials or secrets in workspace files
- ALWAYS use `"${SECRET_NAME}"` env-style references for credentials in config
- ALWAYS verify generated RULES.md is not weaker than the role template baseline
