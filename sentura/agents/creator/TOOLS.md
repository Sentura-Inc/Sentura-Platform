# Sentura Creator Agent — TOOLS.md

## Core Tools

| Tool | Usage |
|------|-------|
| `gateway` | **Read-only from Forge.** Use `action: "config.get"` to sanity-check `agents.list` / `bindings` before and after a deploy. **Do NOT** use `action: "config.patch"` — it requires `operator.admin` scope, which triggers a non-silent pairing prompt Forge cannot answer, so the call will hang with `GatewayClientRequestError: pairing required`. The agent-callable `gateway` enum also does NOT include `agents.create` or `agents.files.set` — use `sentura_agents_manage` for both workspace writes AND config registration. |
| `sentura_agents_manage` | **Primary deployment tool.** Handles BOTH workspace file writes AND agent registration in one in-process API (no gateway auth, no pairing). Actions: `create_agent`, `write`, `read`, `list`, `delete` for workspace files; `register_agent` for registering the agent in `openclaw.json` with bindings + MCP servers in a single atomic write; `stamp_setup` to manually mark an existing workspace bootstrap-complete (rarely needed — `create_agent` and `register_agent` already do this). This is the ONLY correct way to materialize a new employee AND the ONLY way to register one from Forge's embedded runtime — `fs_write` cannot reach `/workspace/.openclaw/workspace/<agent>/...` because that mount is read-only in your sandbox, and `gateway.config.patch` deadlocks on pairing. |
| `sentura_rbac_manage` | Enforce role-based access control on platform operations (Sentura extension). |
| `sentura_audit_query` | Query the Sentura audit log (Sentura extension). |
| `web_search` | Research best practices for roles, find integration documentation |
| `web_fetch` | Read API docs, service documentation, pricing pages |
| `browser` | Explore enterprise systems, self-provisioning workflows |
| `fs_read` / `fs_write` | Scratch files inside your OWN sandbox ONLY (e.g. `/workspace/tmp/*`). NEVER for new employee workspace files — use `sentura_agents_manage` for that. |
| `sessions_history` | Learn from existing employee configurations and performance |
| `sessions_send` | Communicate with other meta-agents (Tuner, Orchestrator) |
| `pdf` | Read enterprise documentation in PDF format |
| `canvas` | Present employee designs visually to the user |

## Template Library

Role templates live in `sentura/config/templates/`. Each template contains pre-built workspace files and config for a common enterprise role. Always check templates before building from scratch.

## Workspace Directories

New employee workspaces are created under OpenClaw's state directory: `~/.openclaw/workspace/{agent-id}/`. This is the resolved path from `agents.defaults.workspace` + the agent ID. Directory naming convention: `{role-slug}-{department}` (e.g., `workspace/ap-clerk-finance`, `workspace/cs-agent-support`).

The `workspaces/` directory in the Sentura repo is for git-tracked reference examples only — not for runtime use.

## MCP Server Reference

- **Tier 1 (open-source)**: Check npm for `@mcp-servers/*` packages
- **Tier 2 (Sentura-generated)**: Built from enterprise API docs during onboarding
- **Tier 3 (self-provisioned)**: Browser automation to obtain credentials + configure

## Secret Store

Credentials are stored in OpenClaw's encrypted secret store. Reference them in config as `"${SECRET_NAME}"` (env-style references). Never store credentials in workspace files or conversation history.
