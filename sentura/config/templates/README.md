# Sentura Role Templates

Each directory contains a complete role template that the Creator Agent uses as a starting point when incubating a new AI employee. Templates include:

| File | Purpose |
|------|---------|
| `config.json5` | Agent configuration with placeholders |
| `SOUL.md` | Identity and personality template |
| `RULES.md` | Safety boundaries with configurable thresholds |
| `CONTEXT.md` | Enterprise context template with placeholders |
| `skills/` | Role-specific skill files |

## Available Templates

| Template | Directory | Role |
|----------|-----------|------|
| AP Clerk | `ap-clerk/` | Accounts Payable invoice processing and vendor management |
| CS Agent | `cs-agent/` | Customer support ticket triage and resolution |
| SDR | `sdr/` | Sales development prospecting and outreach |

## Placeholder Convention

Templates use `{placeholder_name}` for values that must be customized per deployment:

- `{Company}` — enterprise name
- `{agent-id}` — OpenClaw agent identifier
- `{cfo_name}`, `{finance_manager_name}`, etc. — personnel names
- `${high_threshold}`, `${refund_limit}`, etc. — financial thresholds ($ prefix for amounts)
- `{erp_mcp}`, `{crm_mcp}`, etc. — MCP server identifiers

The Creator Agent fills these placeholders during the incubation process based on the user's answers to clarifying questions and the enterprise CONTEXT.md.

## Agent Config Schema

Template `config.json5` files use OpenClaw's correct schema:
- `agents.list` — **array** of agent objects with `id` field (NOT `agents.entries`)
- No `systemPrompt` — identity comes from workspace SOUL.md and AGENTS.md
- No `workspace` — OpenClaw resolves via `agents.defaults.workspace/{agent-id}`
- `tools.profile` + `tools.alsoAllow` / `tools.deny` (NOT `allowlist`/`denylist`)
- Bindings, MCP servers, and approvals are top-level config (NOT inside the agent entry)

## Adding New Templates

1. Create a new directory: `sentura/config/templates/{role-slug}/`
2. Add all required files following the workspace convention (`docs/workspace-convention.md`)
3. Use `{placeholder}` syntax for values that change per deployment
4. Include at least 2 skills covering the role's core capabilities
5. Update this README with the new template entry
