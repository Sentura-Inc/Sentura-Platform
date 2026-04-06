# Sentura Creator Agent — CONTEXT.md

## Platform

- **Name**: Sentura
- **Type**: Enterprise AI Employee Platform built on OpenClaw
- **Architecture**: OpenClaw runtime with Sentura control plane layer

## Meta-Agent Ecosystem

| Agent | ID | Role |
|-------|-----|------|
| Creator (Forge) | `creator` | Incubates new AI employees from natural language descriptions |
| Tuner (Refine) | `tuner` | Modifies existing employee configs via natural language |
| Orchestrator (Conductor) | `orchestrator` | Coordinates multi-agent tasks across employees |

## Key Systems

| System | Purpose |
|--------|---------|
| OpenClaw Gateway | Core runtime — agent execution, tools, channels, config |
| Gateway RPC (`config.patch`) | How agents are registered and configured at runtime |
| OpenClaw Secret Store | Encrypted credential storage (`"${SECRET_NAME}"` references) |
| MCP Protocol | Enterprise system integration (3-tier: npm, generated, self-provisioned) |

## Workspace Convention

Every AI employee workspace contains 10 files + skills/:
AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md (OpenClaw 8) + RULES.md, CONTEXT.md (Sentura 2)

The 8 OpenClaw files are natively injected into the system prompt. RULES.md and CONTEXT.md are injected by the `sentura-bootstrap` hook (`~/.openclaw/hooks/sentura-bootstrap/`). Just write all 10 files to the workspace directory — the hook handles the rest.

## Agent Config Schema

- Agents are registered via `agents.list` (array with `id` fields)
- No `systemPrompt` — identity comes from workspace SOUL.md and AGENTS.md
- No `workspace` field in agent entries — defaults to `~/.openclaw/workspace/{agent-id}`
- Bindings and MCP servers are top-level config, not inside agent entries
- Tool access via `tools.profile` + `alsoAllow` / `deny`

## Role Template Library

Templates in `sentura/config/templates/` provide starting points for common roles:
- AP Clerk (finance)
- CS Agent (support)
- SDR (sales)
