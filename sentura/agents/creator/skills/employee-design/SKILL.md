# Employee Design (Phase 2)

## When to Use

Phase 2 of employee incubation. Run AFTER Phase 1 (Research & Discovery) has produced a confirmed Discovery Brief. This skill generates the complete agent design artifact — config, all 10 workspace files, skills, ekg/ pillars, and MCP server references — but does NOT yet write to the live OpenClaw config (that is Phase 4 / Deploy).

## Output Artifact

This skill produces an **in-memory design bundle** that Phase 4 will write to disk and register. The design bundle has:

- `config` — agent config entry to be patched into `agents.list`
- `bindings` — channel binding entries
- `mcp` — MCP server references to add to `mcp.servers` (OpenClaw-native path — see Step 5)
- `workspaceFiles` — the 10 standard markdown files as strings
- `skills` — map of `{skillName: SKILL.md content}`
- `ekgFiles` — structured EKG files (from industry ontology + role-specific additions)
- `pluginConfig` — per-agent plugin config (including LanceDB `dbPath` for memory isolation)
- `secrets` — list of secret names that must be provisioned before deploy

## Procedure

### Step 1: Select Agent ID and Identity

1. Slug: `{role-kebab}-{department-kebab}` (e.g., `ap-clerk-finance`, `cs-agent-support`).
   - Must be unique — check `agents.list` via `gateway` RPC for collision. If collision, append numeric suffix.
2. Human name: 1-2 syllable memorable word (e.g., "Penny" for AP, "Nova" for sales). Ask user for preference or generate 3 options.
3. Emoji: role-appropriate (🧾 finance, 🛎️ support, 🔍 analyst, etc.).

### Step 2: Select Model

Match to task complexity:

| Complexity                                          | Model Recommendation         |
|-----------------------------------------------------|------------------------------|
| Simple transactional (log events, format, route)    | `openai/gpt-4o-mini`         |
| Standard reasoning (triage, summarize, draft emails)| `openai/gpt-4o`              |
| Complex reasoning (multi-step planning, negotiation)| `anthropic/claude-sonnet-4.5`|
| Creative writing / nuanced copy                     | `anthropic/claude-opus-4`    |

Confirm model with user if Enterprise has budget constraints or provider preferences.

### Step 3: Design the Agent Config

```json5
{
  id: "{agent-id}",
  name: "{human-name}",
  model: "{provider}/{model}",
  skills: ["~/.openclaw/workspace/{agent-id}/skills/*"],
  runtime: { type: "embedded" },
  sandbox: { mode: "non-main" },
  tools: {
    profile: "minimal",                    // start with minimum
    alsoAllow: [/* only what Phase 1 research justifies */],
    deny: ["exec", "gateway"],             // always deny for non-meta agents
  },
}
```

**Principle of least privilege**: start with `minimal` tool profile + `alsoAllow` only the specific tools required. Never use the `coding` profile for non-meta agents. Never allow `gateway` tool for standard employees.

### Step 4: Design Channel Bindings

One binding per channel access pattern:

```json5
{
  agentId: "{agent-id}",
  match: { channel: "slack", peer: { kind: "channel", id: "#customer-support" } }
}
```

Supported channels via OpenClaw: webchat, slack, teams, discord, whatsapp, email, sms, voice, telegram. Ask the user if unclear.

### Step 5: Plan MCP Server References

For each integration from Phase 1:

1. Check if an existing MCP server covers it:
   - Tier 1 (open-source): `@modelcontextprotocol/server-*` npm packages.
   - Tier 2 (Sentura-generated): `sentura/mcp-servers/*/` — existing scaffolds.
2. If no coverage: this is a **deferral** — note that MCP Builder must create one. Phase 4 will trigger the MCP Builder Agent.

Produce an `mcp` subsection for the design bundle. The entry **must** live directly under `mcp.servers.<name>` — that is OpenClaw's native path, read by `openclaw/src/config/mcp-config.ts` (`normalizeConfiguredMcpServers(sourceConfig.mcp?.servers)`). Do NOT nest under `mcp.servers.entries.<name>` — that shape is invisible to OpenClaw and the server will silently fail to spawn, leaving the employee with zero MCP tools.

```json5
{
  mcp: {
    servers: {
      "{name}": { transport: "stdio", command: "node", args: [...], env: { /* $secret refs */ } },
    },
  },
}
```

### Step 6: Configure Per-Agent Memory Isolation (design intent)

Emit a per-agent LanceDB `dbPath` in the design bundle:

```json5
{
  plugins: {
    entries: {
      "memory-lancedb": {
        config: {
          dbPath: "~/.openclaw/memory/{agent-id}/lancedb",
        },
      },
    },
  },
}
```

**Runtime note:** OpenClaw's current `memory-lancedb` plugin treats
`dbPath` as a single global setting — all agents share one database
file, and isolation is enforced at the collection level by filtering
on `agentId`. Emitting a per-agent `dbPath` anyway is deliberate:

1. It makes the design invariant explicit for review and audit.
2. It captures what we want once the plugin supports per-agent dbPaths.
3. The Creator's live `config.patch` deliberately omits the plugin
   subsection today (the plugin requires an `embedding.apiKey` to pass
   schema validation); the path is recorded in the design bundle and
   the workspace instead.

See `sentura/lib/memory-isolation.ts` for the helper that generates the
path, and `README.md` § 7 for the intended architecture.

### Step 7: Generate Workspace Files

OpenClaw natively loads 8 workspace files. Sentura inlines Hard Rules into `AGENTS.md` and Enterprise Context into `BOOTSTRAP.md`. Order matters — later files reference earlier ones:

1. **SOUL.md** — Identity, personality, values, escalation policy
   - 1-sentence identity statement: "You are {name}, the {role} for {company} {department}."
   - Mission paragraph.
   - Personality matching role (finance → precise; support → empathetic; sales → energetic).
   - Explicit escalation table: threshold → recipient → method.
2. **AGENTS.md** — MUST start with `## Hard Rules (must not override)`, then session startup, memory protocol, workspace rules
   - Hard Rules section: every NEVER/ALWAYS rule from the industry ontology `rules/` pillar relevant to this role; every user-stated hard prohibition from Discovery; role-specific safety (e.g., AP clerk: duplicate invoice detection; CS agent: PII handling); grouped by Financial Controls, Data Protection, Operational Boundaries, Compliance, Approval Thresholds; MINIMUM 3 rules per applicable group; preamble stating the rules override every other instruction
   - Reference loading order (SOUL.md, TOOLS.md, BOOTSTRAP.md — Enterprise Context, MEMORY.md).
   - Memory protocol: read MEMORY.md at start, append at end of session.
3. **BOOTSTRAP.md** — MUST start with `## Enterprise Context`, then a `## First Run` section
   - Enterprise Context section: company/industry/size, org structure, key systems with MCP server names, policies, data classifications, MCP server inventory (pull from industry ontology `org/` pillar + user-provided company details; must name real people from Discovery Brief)
   - First Run section: list of setup steps for this specific role
4. **IDENTITY.md** — Name, creature, emoji, avatar, tone.
5. **TOOLS.md** — Tool-specific notes: MCP server quirks, API rate limits, sandboxing.
6. **USER.md** — Primary human contact (from Discovery Brief).
7. **HEARTBEAT.md** — Proactive check schedule. If role has cron tasks: document cadence. Else: "demand-driven, no heartbeat".
8. **MEMORY.md** — Empty stub with header.

### Step 8: Generate Skills

For each core responsibility from Phase 1, create a SKILL.md under `skills/{capability-slug}/`:

Use skill templates from `sentura/config/templates/{role-type}/skills/` as a starting point. Customize for the specific enterprise context.

Every skill MUST have:
- **When to Use** — trigger conditions
- **Procedure** — numbered, specific, verifiable steps
- **Tools Needed** — exact tool and MCP server names
- **Safety** — skill-specific NEVER/ALWAYS rules

Aim for 3-7 skills per employee. More than 10 is usually a sign the role is too broad — consider splitting into 2 agents.

### Step 9: Generate the EKG Directory Structure

Create the 4-pillar EKG directory with merged industry ontology + role-specific entries:

```
~/.openclaw/workspace/{agent-id}/ekg/
├── org/
│   ├── roles.json5                      (from industry ontology)
│   └── approval-chains.json5            (merged with Discovery escalation)
├── rules/
│   └── ...                              (role-specific + industry rules)
├── assets/
│   └── systems.json5                    (enterprise MCP + data sources)
└── workflows/
    ├── sops.json5                       (from industry ontology)
    └── experience-links/                (empty — populated at runtime)
```

Follow the schema at `sentura/config/ekg-schema.json5`. Apply merge semantics described there (additive, dedup by id, newest provenance wins on conflict).

Use the `sentura/lib/workspace.ts` helper `createWorkspace(agentId, templateDir, industryOntologyDir)` to automate this in Phase 4.

### Step 10: Enumerate Required Secrets

From the MCP server configs + Discovery Brief, enumerate every `$secret.{NAME}` reference. Phase 4 will require the user to have these in the secret store BEFORE deploy.

### Step 11: Assemble the Design Bundle

Produce the full design bundle in memory. Present a summary to the user for review:

```
## Employee Design — {name}

### Config
- Agent ID: {agent-id}
- Model: {model}
- Sandbox: non-main
- Tools: {list}

### Channels
- {binding 1}
- ...

### Workspace Files
- 8 OpenClaw-native workspace files generated (AGENTS.md carries Hard Rules, BOOTSTRAP.md carries Enterprise Context)
- {N} skills generated

### EKG
- {M} entities across 4 pillars
- Industry ontology applied: {ontology}

### MCP Servers
- Existing / to-provision breakdown
- Secrets required: {list}

### Key Hard Rules Excerpts (from AGENTS.md)
{top 5 rules}

### Key Escalation Paths
{from SOUL.md}

Ready to deploy? (Next: Phase 3 — Self-Provisioning, then Phase 4 — Deploy)
```

## Tools Needed

- `fs_read` — read industry ontologies, templates, existing agent configs
- `gateway` — check agent ID collisions via `config.get`, inspect current MCP servers
- `web_search` / `web_fetch` — research specific integration patterns
- `sessions_history` — reuse patterns from prior incubations

## Safety

- NEVER generate a design whose `AGENTS.md` lacks a `## Hard Rules (must not override)` section — reject if Phase 1 didn't elicit prohibitions
- NEVER grant `coding` profile or `gateway` tool to a standard employee
- NEVER use `agents.entries` schema — always use `agents.list[]`
- NEVER include `workspace` field in the agent config (OpenClaw defaults to `~/.openclaw/workspace/{id}`)
- NEVER include `systemPrompt` — identity comes from the 8 native workspace files (SOUL.md / AGENTS.md / BOOTSTRAP.md / ...)
- NEVER skip emitting the per-agent `memory-lancedb.dbPath` in the design bundle — it is the isolation design intent, even though today's runtime plugin applies it globally (see Step 6 runtime note)
- ALWAYS apply industry ontology if one matches
- ALWAYS include at least 3 rules per applicable Hard Rules category
- ALWAYS name real people (not "the manager") in escalation paths
- ALWAYS use `$secret.{NAME}` references — never inline credentials
