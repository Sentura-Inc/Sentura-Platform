# Workspace File Editing

## When to Use

When an operator's tuning request requires changing workspace file content — not config keys. Examples:

- "Make the AP Clerk more casual" → edit `SOUL.md`
- "Add a hard rule that the CS Agent never issues refunds over $500" → edit `AGENTS.md`
- "Update the Sales Rep's enterprise context with the new pricing" → edit `BOOTSTRAP.md`
- "Rewrite the AP Clerk's escalation-handling skill" → edit `skills/escalation-handling/SKILL.md`

Use the `nl-to-config` skill instead when the request maps to a config key (model, tools, channels, MCP servers, params).

## Procedure

### Step 1: Identify Target File(s)

Map the operator's intent to the appropriate workspace file:

| Intent | File |
|--------|------|
| Personality, tone, communication style | `SOUL.md` |
| Safety rules, hard limits, escalation rules | `AGENTS.md` — `## Hard Rules` section only |
| Enterprise context, org policies, system list | `BOOTSTRAP.md` — `## Enterprise Context` section only |
| Tool usage notes, environment-specific config | `TOOLS.md` |
| Identity card (role, department, name) | `IDENTITY.md` |
| User-facing persona/introduction | `USER.md` |
| Heartbeat/status reporting behaviour | `HEARTBEAT.md` |
| Long-term memory entries | `MEMORY.md` |
| Skill procedure | `skills/<skill-name>/SKILL.md` |

### Step 2: Fetch Current File Content

The agent-callable `gateway` tool's restricted action enum
(`restart`, `config.get`, `config.schema.lookup`, `config.apply`, `config.patch`,
`update.run`) does **not** include `agents.files.get`/`agents.files.set`. Use
the `sentura_agents_manage` plugin tool for workspace file reads and writes.

```
sentura_agents_manage({
  action: "read",
  agentId: "<agentId>",
  relPath: "<filename>",       // e.g. "SOUL.md", "skills/foo/SKILL.md"
})
// → { content: "<full file body>", ... }
```

Read the full current content before proposing any edit.

### Step 3: Produce a Before/After Excerpt

Show the operator only the section that will change:

```
Proposed edit to: <agent name> → <filename>

BEFORE (lines 12–18):
  ## Vibe
  Be professional and formal at all times. Use complete sentences.
  Avoid contractions.

AFTER:
  ## Vibe
  Be warm and conversational. Contractions are fine. Get to the point quickly.

Other sections unchanged.

Apply this edit? (yes / no / modify)
```

### Step 4: Wait for Explicit Approval

**STOP.** Do not write any file until the operator explicitly approves in the current turn. A prior approval does not carry over.

### Step 5: Apply the Edit

Construct the full new file content by applying the change to the content fetched in Step 2. Then write:

```
sentura_agents_manage({
  action: "write",
  agentId: "<agentId>",
  relPath: "<filename>",
  content: "<complete new file content>",
})
```

Always send the complete file — `sentura_agents_manage` write overwrites the
whole file, not a patch. The plugin auto-detects native top-level files
(AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md,
MEMORY.md) and permits the write; subfiles must live under `skills/`, `ekg/`,
or `memory/users/`.

### Step 6: Verify

```
sentura_agents_manage({
  action: "read",
  agentId: "<agentId>",
  relPath: "<filename>",
})
```

Confirm the returned content matches what was written. Report:
- Success: "Updated. New [filename] excerpt: [changed section]."
- Failure: "Write failed: [error]. File is unchanged."

## Tools Needed

- `sentura_agents_manage` — `read` / `write` actions on the target employee's workspace files. (Note: the agent-callable `gateway` tool's restricted action enum does NOT expose `agents.files.get`/`agents.files.set` — those gateway-server RPCs are reachable only from typed clients like the dashboard, not from inside an agent's tool call.)
- `message` — operator interaction (diffs, confirmations, results)

## Safety

- **NEVER** remove the `## Hard Rules (must not override)` section from any employee's `AGENTS.md`. You may add or tighten rules, never delete or weaken them.
- **NEVER** edit `## Hard Rules` to allow blocked actions without platform-admin confirmation.
- **NEVER** write credentials, tokens, or API keys into workspace files.
- **NEVER** edit `MEMORY.md` to plant false memories or erase accountability entries.
- **ALWAYS** show before/after excerpt for operator review before writing.
- **ALWAYS** send the complete file content in `agents.files.set` — partial content truncates the file.
- **ALWAYS** verify by re-reading after write.
- When editing `AGENTS.md`, touch only the requested section. Preserve the `## Hard Rules` block verbatim unless the operator explicitly asks to add a new rule (adding only, never removing).
