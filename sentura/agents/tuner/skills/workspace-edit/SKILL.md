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

### Step 3: File a Structured Approval Request (MANDATORY — DO THIS BEFORE SHOWING THE DIFF)

> **STOP.** The single most common procedural failure for this skill is
> skipping this step because "I already showed the operator the diff in
> chat — the diff IS the approval request." That is wrong. The structured
> approval is a separate system-of-record row on the dashboard's
> `/approvals` page, captured in the audit trail, and resolvable via UI
> click — not just a chat-yes. **You must file `sentura_approval_request`
> BEFORE composing the diff message you send to the operator.** If you
> are about to show a diff and the previous tool call was NOT
> `sentura_approval_request`, you are about to break this skill.

For every workspace edit, exactly one structured approval. Compute the
before/after excerpts inline (you'll reuse them in the next step's chat
message):

```
sentura_approval_request({
  kind: "tuner.workspace_edit",
  action: "Edit <agentId>:<filename> — <one-line summary>",
  riskLevel: "medium",     // "high" if touching AGENTS.md or Hard Rules
  summary: "<one-line summary of the change>",
  details: {
    agentId: "<agentId>",
    relPath: "<filename>",
    beforeExcerpt: "<lines being replaced>",
    afterExcerpt: "<replacement lines>",
  },
})
// → { id: "<approvalId>", status: "pending" }
```

If the change touches multiple files, file ONE approval request per file.
Do not bundle. Each row on `/approvals` should be independently
approvable/rejectable so the operator can accept the SOUL.md edit while
deferring on the AGENTS.md edit.

If `sentura_approval_request` errors (extension disabled, validation
failure), STOP and tell the operator. Do not fall back to chat-only
approval — the audit trail requirement is non-negotiable. Re-run setup
with `bash scripts/sentura-setup.sh` to ensure the `sentura-approval`
extension is registered.

### Step 4: Show the Before/After Excerpt to the Operator

ONLY after Step 3 succeeds. Quote the approval id you just received so
both paths (UI click on `/approvals`, or chat-yes here) are visible:

```
I've filed approval `<approvalId>` on /approvals.

Proposed edit to: <agent name> → <filename>

BEFORE (lines 12–18):
  ## Vibe
  Be professional and formal at all times. Use complete sentences.
  Avoid contractions.

AFTER:
  ## Vibe
  Be warm and conversational. Contractions are fine. Get to the point quickly.

Other sections unchanged.

You can approve on the /approvals page, or reply 'yes' here to apply.
```

### Step 5: Wait for Explicit Approval

**STOP.** Do not write any file until either:
- The operator explicitly approves in the current chat turn (a prior chat-yes
  does NOT carry over to a new edit), OR
- The approval request from Step 3 transitions to `approved` (poll via
  `sentura_approval_request { action: "status", id: "<approvalId>" }` if
  the operator says they approved on `/approvals`).

If the operator denies (chat-no, or `/approvals` reject), abort the edit
and report.

### Step 6: Write a Backup Snapshot (MANDATORY)

BEFORE applying the edit, write the current file content to a `.bak`
sibling so the operator can diff or restore. Use an ISO-with-dashes
suffix so multiple tunings don't clobber each other:

```
sentura_agents_manage({
  action: "write",
  agentId: "<agentId>",
  relPath: "<filename>.bak.<YYYY-MM-DDTHH-MM-SS>",
  content: "<the unchanged content fetched in Step 2>",
})
```

Tell the operator the backup path so they can `diff` or `mv` it back if
something looks wrong:
> "Backup at `~/.openclaw/workspace/<agentId>/<filename>.bak.<timestamp>`."

### Step 7: Apply the Edit

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

### Step 8: Verify

```
sentura_agents_manage({
  action: "read",
  agentId: "<agentId>",
  relPath: "<filename>",
})
```

Confirm the returned content matches what was written. Report:
- Success: "Updated. New [filename] excerpt: [changed section]. Backup at [path]."
- Failure: "Write failed: [error]. File is unchanged. Backup still available at [path]."

## Tools Needed

- `sentura_agents_manage` — `read` / `write` actions on the target employee's workspace files. (Note: the agent-callable `gateway` tool's restricted action enum does NOT expose `agents.files.get`/`agents.files.set` — those gateway-server RPCs are reachable only from typed clients like the dashboard, not from inside an agent's tool call.)
- `sentura_approval_request` — files structured approval requests that surface on `/approvals` and emit audit events. MANDATORY for every edit per Step 3 (must be called BEFORE showing the diff in chat).
- `message` — operator interaction (diffs, confirmations, results)

## Safety

- **NEVER** use the raw `read` / `write` / `edit` / `apply_patch` tools on workspace files. Tuner's sandbox is rooted at `~/.openclaw/sandboxes/agent-tuner-<hash>/`; absolute paths under `~/.openclaw/workspace/<other-agent>/*` will be rejected with "Path escapes sandbox root". ALL target-agent file I/O goes through `sentura_agents_manage` (those raw tools are denied at both the agent and sandbox tool-policy filters, so they shouldn't even appear in your tool palette).
- **NEVER** skip Step 3 (structured approval request). In-chat "yes" is a convenience; the structured request is the system-of-record for compliance + audit. **Step 3 must precede Step 4 (showing the diff)** — if you have shown a diff and not yet called `sentura_approval_request`, you have already broken this skill.
- **NEVER** skip Step 6 (backup). The operator's diff/rollback path depends on it.
- **NEVER** remove the `## Hard Rules (must not override)` section from any employee's `AGENTS.md`. You may add or tighten rules, never delete or weaken them.
- **NEVER** edit `## Hard Rules` to allow blocked actions without platform-admin confirmation. Mark such requests as `riskLevel: "high"` in Step 3.
- **NEVER** write credentials, tokens, or API keys into workspace files.
- **NEVER** edit `MEMORY.md` to plant false memories or erase accountability entries.
- **ALWAYS** show before/after excerpt for operator review before writing.
- **ALWAYS** send the complete file content in `sentura_agents_manage write` — partial content truncates the file.
- **ALWAYS** verify by re-reading after write.
- When editing `AGENTS.md`, touch only the requested section. Preserve the `## Hard Rules` block verbatim unless the operator explicitly asks to add a new rule (adding only, never removing).
