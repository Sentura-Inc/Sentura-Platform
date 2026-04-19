# Employee Incubation

## When to Use

When a user requests a new AI employee by describing a role, job function, or set of responsibilities they want automated.

## Output Contract (read this before Step 1)

This skill's deliverable is **a deployed, running agent registered in
the live `~/.openclaw/openclaw.json`** — not a design document, not a
JSON5 codeblock, not a markdown summary.

You succeed when `gateway.config.get agents.list` returns the new
agentId after Step 5. You fail if your final response contains a
"Draft config" codeblock, a "Here is what I would deploy" section,
or a "Shall I proceed?" question after Step 2 — Step 2 is the last
chance to ask for clarification.

## Procedure

### Step 1: Intake & Clarification

1. Parse the user's description for: job title, department, core tasks, integrations, channels, compliance needs
2. Identify ambiguities and ask targeted clarifying questions:
   - Required system access (CRM, ERP, ticketing, email, databases)
   - Approval thresholds (financial limits, data access boundaries)
   - Escalation contacts (who to notify for different risk levels)
   - Communication tone (formal, casual, technical, friendly)
   - Prohibited actions (what should the employee NEVER do)
3. If user is vague, propose a concrete role spec and ask them to confirm or adjust

### Step 2: Research

1. Search for best practices for the role type using `web_search`
2. Check incubation memory for similar past roles (reuse proven patterns)
3. Check `sentura/config/templates/` for matching role templates
4. If enterprise context exists, read the `## Enterprise Context` section of `BOOTSTRAP.md` from existing employees for org info

### Step 3: Generate Workspace Files

Materialize the workspace via the `sentura_agents_manage` tool — this
is the ONLY way to write under `~/.openclaw/workspace/{agent-id}/` from
inside the sandbox. `fs_write` CANNOT reach that path (the sandbox
mount is read-only in `non-main` mode), and the `gateway` tool does
NOT expose `agents.create` / `agents.files.set`.

1. `sentura_agents_manage { action: "create_agent", agentId }` — creates
   the workspace directory (idempotent).
2. For each of the 8 native files (AGENTS.md, SOUL.md, TOOLS.md,
   IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md):
   `sentura_agents_manage { action: "write", agentId, relPath: "<FILE>.md", content }`.

OpenClaw natively loads all 8 workspace files into the system prompt.
Sentura inlines Hard Rules into `AGENTS.md` and Enterprise Context into
`BOOTSTRAP.md` — no additional hook injection is needed.

1. **SOUL.md** — Write identity, personality, values, escalation rules
   - Be specific: "You are the AP Clerk for [company] [department]"
   - Include escalation thresholds with names and titles
2. **AGENTS.md** — Starts with `## Hard Rules (must not override)` (NEVER/ALWAYS rules), then session startup, memory protocol, workspace rules. Cover in Hard Rules:
   - Financial controls (approval limits, duplicate detection)
   - Data protection (PII handling, channel boundaries)
   - Operational boundaries (tool restrictions, service limits)
3. **BOOTSTRAP.md** — Starts with `## Enterprise Context` (org structure, key systems, policies), then a `## First Run` section with first-run initialization procedure
4. **IDENTITY.md** — Assign name, emoji, vibe
5. **TOOLS.md** — Document environment-specific tool notes
6. **USER.md** — Record primary human contact
7. **HEARTBEAT.md** — Define proactive check schedule (if applicable)
8. **MEMORY.md** — Leave empty (agent builds its own)

### Step 4: Generate Skills

For each core responsibility, write a skill file via:
`sentura_agents_manage { action: "write", agentId,
  relPath: "skills/{capability}/SKILL.md", content: "…" }`

Each skill contains:
- **When to Use** — trigger conditions
- **Procedure** — numbered steps with specific, verifiable actions
- **Tools Needed** — exact tool names and MCP server references
- **Safety** — NEVER/ALWAYS rules specific to this skill

### Step 5: Register the Agent (REAL TOOL CALL — not a draft)

Build the config entry in memory, then **execute** a `gateway.config.patch`
call. Do NOT print a JSON5 "draft" codeblock and stop — the patch call IS
the deliverable.

Required sequence:

1. `gateway { action: "config.get", path: "agents.list" }` — fetch current
   list (arrays are replaced, not merged; you need the full list before
   patching).
2. `gateway { action: "config.get", path: "bindings" }` — same reason.
3. Build `newAgentEntry` and `newBindings` objects per the
   `agent-config-schema` skill. Required shape:
   - `id` (slug, kebab-case) in `agents.list[]` entry
   - `model`, `name`, `skills: ["~/.openclaw/workspace/{id}/skills/*"]`
   - `runtime: { type: "embedded" }`
   - `sandbox: { mode: "non-main" }`  ← required
   - `tools.profile` + `tools.alsoAllow` + `tools.deny` (least privilege;
     always deny `gateway` and `exec` for employees)
   - NO `workspace`, NO `systemPrompt` — those are set elsewhere.
4. `gateway { action: "config.patch", ops: [
     { op: "append", path: "agents.list", value: newAgentEntry },
     { op: "append", path: "bindings",    value: newBinding },
     …
   ] }` — this is the deploy action. Emit it, do not narrate it.
5. `gateway { action: "config.get", path: "agents.list" }` — verify the
   new entry appears. If it does NOT appear, the patch failed — report
   the exact error to the user and stop. Do not retry silently.

### Step 6: Report Outcome

ONLY after Step 5 succeeds, report the result to the user. Include:

- Summary (name, role, model, channels, integrations, skills)
- List of files written (with `sentura_agents_manage { action: "write", ... }`
  having already been executed in Step 3/4 — just list the `relPath` values)
- Safety guardrails highlight (key `AGENTS.md` Hard Rules entries)
- Approval policies
- Confirmation that `config.get agents.list` now contains the new
  `agentId` (quote the exact returned value)
- Next step for the human: "Send a test message in the Sentura dashboard
  to `<agentId>` via the `<channel>` binding to smoke-test."

**Do NOT at this step emit a "Draft config (JSON5)" codeblock.** By the
time you reach Step 6, the agent is already registered. The codeblock
in Step 5 was consumed by the `gateway` tool, not the user. If you
find yourself about to output a JSON5 block of the new agent, you
skipped Step 5 — go back and execute it.

## Tools Needed

- `web_search` — research roles and best practices
- `web_fetch` — read API documentation for integrations
- `sentura_agents_manage` — create the employee workspace and write
  every workspace / skill / ekg file on the HOST filesystem. This is
  the only sandbox-safe way to materialize an employee.
- `gateway` — `config.get` to fetch current state and `config.patch`
  to register the new agent once files are in place.
- `fs_read` / `fs_write` — scratch files in the Creator's OWN sandbox
  only. Never for another agent's workspace.
- `sessions_history` — learn from existing employee configurations
- `canvas` — present employee designs visually

## Safety

- NEVER generate an employee whose `AGENTS.md` lacks a `## Hard Rules (must not override)` section
- NEVER skip the clarifying questions step (Step 1 — BEFORE you start
  calling `sentura_agents_manage` or `gateway`)
- NEVER give an employee more tool access than it needs
- ALWAYS include financial controls for any role with payment capabilities
- ALWAYS include data protection rules
- ALWAYS treat "deployment" as the tool calls in Step 5, not as a
  question to ask the user. The user already asked for deployment when
  they invoked this skill. Get clarifying answers up front (Step 1);
  do not re-gate on "can I deploy now?" at the end.
- **NEVER emit a "Draft config (JSON5)" codeblock as the final
  response. Emitting it means you skipped Step 5 — the patch call.**
