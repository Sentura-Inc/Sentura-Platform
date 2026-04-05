# Sentura Development Memory

## 2026-04-05 — OpenClaw Technical Analysis

**What was done:**
- Deep-scanned the entire `openclaw/` directory (86 extensions, 700+ source files, native apps, UI, docs)
- Analyzed architecture: gateway server (Hono HTTP + WS JSON-RPC), agent tool system (pi-agent-core), plugin SDK (100+ sub-path exports), 22 messaging channels, 40+ AI providers
- Wrote comprehensive `OPENCLAW.md` technical reference document (23 sections, ~700 lines)

**Files created/modified:**
- `OPENCLAW.md` — full technical reference document
- `docs/MEMORY.md` — this file (created)

**Key decisions:**
- Organized the document to cover all major subsystems: architecture, gateway, agents, plugins, channels, providers, config, sessions, security, cron, memory, CLI, TUI, UI, native apps, deployment, testing
- Included a "Relevance to Sentura" section mapping OpenClaw patterns to Sentura equivalents
- Cataloged all 86 extensions with categorization (channels, providers, speech, search, tools, infrastructure)

**Nothing left incomplete.**

**Known issues:** None introduced.

## 2026-03-28 — Major Architecture Pivot: OpenClaw-Based AI Employees

**What was done:**
- Complete rewrite of `README.md` — pivoted from custom Python/FastAPI/LangGraph platform to OpenClaw-based architecture
- Complete rewrite of `.cursorrules` — updated all coding standards, tech stack, and behavioral rules for OpenClaw/TypeScript
- Complete rewrite of `TeamPlan.md` — new 8-week sprint plan for 4 people building on OpenClaw

**Key architectural changes:**
1. **Target customers**: All enterprises (was: 5 regulated verticals only)
2. **Deployment**: Cloud, on-premise, or hybrid (was: on-premise only)
3. **LLM access**: API keys or self-hosted (was: self-hosted only in production)
4. **Core runtime**: OpenClaw (Node.js/TypeScript) (was: custom Python/FastAPI/LangGraph)
5. **AI employee = OpenClaw agent** with skills (SKILL.md), identity (SOUL.md), rules (RULES.md), tools, channel bindings, and memory
6. **Self-provisioning**: AI employees use browser automation (Playwright) to register for services, get API keys, and configure themselves
7. **No-code**: Creator Agent builds employees from natural language descriptions
8. **22+ channels**: via OpenClaw's native channel extensions (Slack, Teams, WhatsApp, Discord, etc.)
9. **40+ LLM providers**: via OpenClaw's native provider extensions

**Files created/modified:**
- `README.md` — complete rewrite (new architecture, 20 sections)
- `.cursorrules` — complete rewrite (TypeScript/OpenClaw standards)
- `TeamPlan.md` — complete rewrite (new 8-week plan)
- `docs/MEMORY.md` — updated with this entry

**Key decisions:**
- OpenClaw is used as-is (not forked) — Sentura extends it via extensions and skills
- Meta-agents (Creator, Tuner, Orchestrator) are themselves OpenClaw agents
- Enterprise integrations use MCP servers (OpenClaw native support)
- Dashboard communicates via OpenClaw Gateway WebSocket RPC (not a separate API)
- Self-provisioning uses OpenClaw's browser extension (Playwright) + secret store

**Nothing left incomplete.**

**Known issues:** None introduced.
