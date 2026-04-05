# Sentura Development Memory

## 2026-04-05 — Week 1 Person A: Platform Foundation & OpenClaw Setup

**What was done:**
- Set up the complete monorepo directory structure matching the README architecture:
  - `sentura/agents/{creator,tuner,orchestrator}/` — meta-agent workspaces
  - `sentura/dashboard/src/{app,components,lib,styles}/` — Next.js dashboard placeholder
  - `sentura/extensions/{sentura-approval,sentura-audit,sentura-rbac,sentura-provisioner}/` — extension scaffolds
  - `sentura/skills/{self-provisioning,knowledge-curation,compliance,onboarding}/` — bundled skills
  - `sentura/config/{templates,policies}/` — config templates and policies
  - `workspaces/` — runtime AI employee workspaces
  - `state/` — OpenClaw state directory (gitignored except .gitkeep)
- Created `.env.example` with all environment variables for:
  - Gateway settings (token, ports, bind)
  - LLM providers (Anthropic, OpenAI, Ollama)
  - Channel credentials (Slack, Teams, Discord, Telegram)
  - Dashboard settings
  - Docker/deployment settings
  - SSO and observability placeholders
- Created `docker-compose.yml` (cloud deployment) with:
  - openclaw-gateway service (builds from openclaw/ with browser + key extensions)
  - openclaw-cli service sharing gateway network
  - Volume mounts for state, workspaces, config, agents, skills
  - Health checks, security hardening, host.docker.internal for Ollama
- Created `docker-compose.onprem.yml` (on-premise deployment) with:
  - Ollama service (local LLM inference, GPU-ready with commented NVIDIA config)
  - openclaw-gateway pointing to local Ollama
  - Health checks and dependency ordering
  - Named volume for Ollama model persistence
- Created `docs/gateway-rpc.md` — comprehensive RPC reference for the team covering:
  - Config methods (get, patch, apply, revert) with usage examples
  - Session methods (list, get, transcript, compact, reset, delete)
  - Agent/chat methods (agent, chat.send, chat.abort, chat.history)
  - Cron methods (list, add, update, remove, run)
  - Approval methods (exec.approval.*, plugin.approval.*)
  - Skills methods (list, install, enable, disable)
  - Model/tool discovery methods
  - Gateway events (server → client)
  - TypeScript connection example
  - Per-team usage summary
- Created root `package.json` with monorepo scripts
- Created `pnpm-workspace.yaml` for workspace packages
- Updated `.gitignore` with Sentura-specific patterns
- Marked all Person A Week 1 tasks as complete in `TeamPlan.md`

**Files created:**
- `package.json` — root monorepo package config
- `pnpm-workspace.yaml` — pnpm workspace config
- `.env.example` — environment variable template
- `docker-compose.yml` — cloud deployment stack
- `docker-compose.onprem.yml` — on-premise deployment stack
- `docs/gateway-rpc.md` — Gateway RPC team reference
- `state/.gitkeep` — state directory placeholder
- Multiple `.gitkeep` files across all `sentura/` subdirectories

**Files modified:**
- `.gitignore` — added Sentura runtime patterns
- `TeamPlan.md` — marked Person A Week 1 tasks complete
- `docs/MEMORY.md` — added this entry

**Key decisions:**
- Gateway config is seeded as `state/openclaw.json` by `scripts/setup.sh` (not mounted from project root)
- Docker images build from `openclaw/` context with `OPENCLAW_EXTENSIONS` build arg listing all 25 extensions with npm deps
- On-prem stack includes a dedicated Ollama container with GPU passthrough ready
- WebChat channel requires zero config (built into OpenClaw gateway); Slack needs env vars
- Gateway RPC docs organized by team member usage patterns for quick reference

**Nothing left incomplete.** All 9 Person A Week 1 tasks are done.

**Known issues:** None introduced.

## 2026-04-05 — Docker Architecture Overhaul & Final Fixes

**What was done:**
- Complete rewrite of Docker setup after multiple rounds of debugging
- Deleted ALL custom setup artifacts: `scripts/setup.sh`, `docker-compose.yml`, `docker-compose.onprem.yml`, `.env`, `.env.example`, `sentura-config.json5`, `sentura-config.onprem.json5`
- OpenClaw runs its own setup directly: `cd openclaw && bash docker-setup.sh`

**Critical lesson (DO NOT repeat):**

**Do not wrap, shorten, customize, or interfere with OpenClaw's infrastructure.** OpenClaw is a mature product with battle-tested setup scripts, Docker images, config management, authentication, dotenv loading, extension dependency handling, and onboarding flows. Sentura is a control plane LAYER on top — it does not touch OpenClaw's infra. Run `cd openclaw && bash docker-setup.sh` and let OpenClaw handle everything: image building, extension deps, API key loading (`~/.openclaw/.env`), token management, permissions, gateway config, and startup. No custom compose files, no wrapper scripts, no reimplemented logic.

---

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

## 2026-04-05 — Switch from Docker to Local Development Setup

**What was done:**
- Abandoned Docker as the default development environment for OpenClaw
- OpenClaw now builds from source (`cd openclaw && pnpm install && pnpm ui:build && pnpm build && pnpm openclaw onboard`) and runs via `pnpm gateway:watch`
- Docker is kept only for production deployment (`cd openclaw && bash docker-setup.sh`)

**Why:**
Docker added unnecessary complexity for development: container networking, volume mounts, bind address conflicts, token synchronization between host and container, missing extension dependencies from build caching, and API key loading issues (`~/.openclaw/.env` not mounted correctly). Building from source and running locally handles all of this transparently — `pnpm openclaw onboard --install-daemon` configures the gateway, LLM provider, and API keys in one step, and `pnpm gateway:watch` provides auto-reload during development.

**Files modified:**
- `SETUP.md` — full rewrite for local install
- `README.md` — updated Deployment Options and Quick Start sections
- `TeamPlan.md` — updated Person A tasks to reflect local setup
- `.cursorrules` — updated tech stack table and rules for local-first dev
- `docs/MEMORY.md` — this entry

**Critical lesson:**
For development, always build OpenClaw from source (`cd openclaw && pnpm install && pnpm ui:build && pnpm build`) and run via `pnpm gateway:watch`. Docker is only for production deployment. Do not create custom Docker wrappers, compose files, or setup scripts for development.

---

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
