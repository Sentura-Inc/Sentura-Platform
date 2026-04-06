# Employee Incubation

## When to Use

When a user requests a new AI employee by describing a role, job function, or set of responsibilities they want automated.

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
4. If enterprise context exists, read CONTEXT.md from existing employees for org info

### Step 3: Generate Workspace Files

Write all files to `~/.openclaw/workspace/{agent-id}/` (resolved from `agents.defaults.workspace` + agent ID).
For each file, follow the workspace convention in `docs/workspace-convention.md`.

The 8 standard OpenClaw files are natively loaded into the system prompt. RULES.md and CONTEXT.md are injected by the `sentura-bootstrap` hook — just write them to the workspace directory and the hook handles the rest.

1. **SOUL.md** — Write identity, personality, values, escalation rules
   - Be specific: "You are the AP Clerk for [company] [department]"
   - Include escalation thresholds with names and titles
2. **AGENTS.md** — Write session startup, memory protocol, workspace rules
3. **RULES.md** — Write NEVER/ALWAYS rules covering (injected by sentura-bootstrap hook):
   - Financial controls (approval limits, duplicate detection)
   - Data protection (PII handling, channel boundaries)
   - Operational boundaries (tool restrictions, service limits)
4. **CONTEXT.md** — Write enterprise org structure, key systems, policies (injected by sentura-bootstrap hook)
5. **IDENTITY.md** — Assign name, emoji, vibe
6. **TOOLS.md** — Document environment-specific tool notes
7. **USER.md** — Record primary human contact
8. **HEARTBEAT.md** — Define proactive check schedule (if applicable)
9. **BOOTSTRAP.md** — Write first-run initialization procedure
10. **MEMORY.md** — Leave empty (agent builds its own)

### Step 4: Generate Skills

For each core responsibility, create a `skills/{capability}/SKILL.md` with:
- **When to Use** — trigger conditions
- **Procedure** — numbered steps with specific, verifiable actions
- **Tools Needed** — exact tool names and MCP server references
- **Safety** — NEVER/ALWAYS rules specific to this skill

### Step 5: Generate Agent Config

Produce a JSON5 config snippet for the `gateway` tool's `config.patch` action.

Use the correct OpenClaw schema (`agents.list` array, NOT `agents.entries` object):
- `id` field inside the array entry
- Model selection (match complexity to capability)
- `tools.profile` + `tools.alsoAllow` / `tools.deny` (principle of least privilege)
- Sandbox mode: `non-main` (mandatory)
- Top-level `bindings[]` for channel routing (NOT inside the agent entry)
- Top-level `mcp.servers` for enterprise integrations (NOT inside the agent entry)
- Do NOT set `workspace` (defaults to `~/.openclaw/workspace/{agent-id}`)
- Do NOT set `systemPrompt` (comes from workspace SOUL.md/AGENTS.md)

### Step 6: Present to User

Show the complete employee design with:
- Summary (name, role, model, channels, integrations, skills)
- All generated files (with brief explanations)
- Safety guardrails highlight (key RULES.md entries)
- Approval policies
- Required integrations and their provisioning status

Ask user to review and confirm before proceeding to provisioning/deployment.

## Tools Needed

- `web_search` — research roles and best practices
- `web_fetch` — read API documentation for integrations
- `fs_read` / `fs_write` — read templates and write workspace files
- `sessions_history` — learn from existing employee configurations
- `canvas` — present employee designs visually

## Safety

- NEVER generate an employee without RULES.md
- NEVER skip the clarifying questions step
- NEVER give an employee more tool access than it needs
- ALWAYS include financial controls for any role with payment capabilities
- ALWAYS include data protection rules
- ALWAYS get user confirmation before deployment
