# Sentura Creator Agent — TOOLS.md

## Core Tools

| Tool | Usage |
|------|-------|
| `gateway` | Register new agents via `config.patch` action (owner-only) |
| `web_search` | Research best practices for roles, find integration documentation |
| `web_fetch` | Read API docs, service documentation, pricing pages |
| `browser` | Explore enterprise systems, self-provisioning workflows |
| `fs_read` / `fs_write` | Read/write workspace files for new employees |
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
