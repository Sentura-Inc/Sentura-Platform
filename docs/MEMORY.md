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

---

## 2026-04-05 — OpenClaw vs Sentura Gap Analysis & README/SETUP Accuracy Update

**What was done:**
- Deep analysis of OpenClaw codebase to objectively verify what it provides vs what Sentura must build
- Identified 12 specific capabilities Sentura needs that OpenClaw does not have (7 user-identified + 5 discovered)
- Updated README.md with accurate OpenClaw vs Sentura distinction across 5 sections:
  - **Section 1 (Executive Summary)**: Added "Core Mission" statement, "What Sentura Builds" table (12 items), "What OpenClaw Provides" list
  - **Section 3 (AI Employee Model)**: Fixed workspace file list — OpenClaw has 8 default files (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md); Sentura adds RULES.md, CONTEXT.md, and structured skills/
  - **Section 5 (Self-Provisioning)**: Clarified self-provisioning is a Sentura-built system (skills + approval + error handling + audit), not just a browser prompt
  - **Section 9 (Safety)**: Marked each safety layer as [OPENCLAW] or [SENTURA]; clarified RULES.md does not exist in OpenClaw's workspace system
  - **Section 14 (Integration Layer)**: Added Enterprise MCP Strategy (3-tier approach); clarified OpenClaw has zero enterprise connectors and Sentura builds all of them
- Updated SETUP.md with comprehensive Sentura layer description showing all 13 capabilities with status

**Key findings from OpenClaw codebase analysis:**
1. OpenClaw's default workspace files are defined in `openclaw/src/agents/workspace.ts`: AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, BOOTSTRAP, MEMORY — no RULES.md
2. OpenClaw's security is generic: `DEFAULT_GATEWAY_HTTP_TOOL_DENY` in `src/security/dangerous-tools.ts` blocks high-risk tools on HTTP; exec approvals in `src/infra/exec-approvals.ts` are binary per-agent-ID overrides — no decision-context awareness
3. OpenClaw's `agents.create` RPC takes structured params (model, systemPrompt, workspace, tools) — no natural language creation
4. OpenClaw has zero enterprise connector extensions — all 86 extensions are channels, AI providers, speech, search, tools, or infrastructure
5. OpenClaw is single-tenant: one gateway, one config file, one user context
6. OpenClaw's `sessions_spawn` has depth limits but no task decomposition, progress tracking, or macro-objective planning

**Files modified:**
- `README.md` — 5 sections updated with accurate OpenClaw/Sentura attribution
- `SETUP.md` — Sentura layer section rewritten with capability inventory
- `docs/MEMORY.md` — this entry

**Nothing left incomplete.**

**Known issues:** None introduced.

---

## 2026-04-05 — TeamPlan.md Full Rewrite for 12-Capability Alignment

**What was done:**
- Complete rewrite of `TeamPlan.md` to align with the updated README.md's 12 Sentura capabilities
- Every capability now has explicit sprint tasks and owner assignments

**Major changes from previous plan:**

1. **Added Capability Coverage Map** — table mapping all 12 capabilities to owners and sprint weeks
2. **Added multi-tenancy tasks** (was completely missing):
   - Person A designs/implements tenant isolation model in Week 4
   - Person D implements tenant-aware extensions in Week 4
   - Person A completes data segregation in Week 5
3. **Added enterprise MCP generation tasks** (was missing):
   - Person D builds first MCP server from ekg/ GradSale API docs in Week 2
   - Person D builds MCP generation CLI tool in Week 3
4. **Added cost tracking backend** (only had frontend page before):
   - Person A builds cost tracking event system in Week 4
5. **Added employee lifecycle management** (was partial):
   - Person B builds health scoring and retirement in Week 5
   - Person C builds lifecycle UI in Week 5
6. **Added ekg/ GradSale references** throughout:
   - Person D studies ekg/ docs in Week 1
   - First MCP server from ekg/ in Week 2
   - GradSale E2E scenario in Week 6
   - Demo scenarios use GradSale in Week 8
7. **Updated workspace file convention** in Interface Contracts:
   - Now lists all 8 OpenClaw files + 2 Sentura additions explicitly
8. **Updated self-provisioning tasks** to emphasize the full pipeline:
   - Error recovery (CAPTCHA, 2FA, rate limits)
   - Audit logging
   - Structured skill procedure (not just a prompt)
9. **Added Capability-to-README Traceability** section at bottom
10. **Updated Integration Checkpoints** to reference capability numbers

**Files modified:**
- `TeamPlan.md` — full rewrite
- `docs/MEMORY.md` — this entry

**Nothing left incomplete.**

**Known issues:** None introduced.

---

## 2026-04-05 — Capability #13: Pre-Deployment Testing & Validation

### Summary
Added a critical missing capability: pre-deployment testing of AI employees against real/mock enterprise tasks before they go live. An employee that can't handle actual work on day one isn't "mission-ready."

### What was added

**README.md:**
- Added capability #13 to Section 1 capability table: "Pre-deployment testing & validation"
- Updated capability count from 12 → 13
- Added new **Phase 4: Pre-Deployment Testing & Validation** to Section 4 (No-Code Employee Creation), shifting the old Phase 4 (Deploy) to Phase 5
- Phase 4 includes: 3 test case sources (historical records, generated mocks, role template suites), testing flow diagram, 6 test dimensions table, auto-tune on failure logic
- Updated the incubation flow diagram to show the testing step
- Updated incubation from "four phases" to "five phases"

**TeamPlan.md:**
- Updated all "12 capabilities" references to "13 capabilities"
- Added #13 to Capability Coverage Map (Owner: B + D + C, Weeks: 3, 4, 5)
- Added new interface contract: "Pre-deployment test harness contract"
- Week 3/B: Design test harness (test case schema, extractor, mock generator, thresholds)
- Week 3/D: Build test data extraction tools via MCP, test with ekg/ GradSale
- Week 4/B: Implement test runner, scoring across 6 dimensions, auto-tune loop
- Week 4/C: Build Test Results dashboard page
- Week 5/B: Bundle role template test suites (10 test cases per template)
- Week 6/B: E2E test of full pre-deployment testing pipeline
- Updated GradSale E2E test to include pre-deployment testing step
- Updated integration checkpoints IC-3 through IC-8 to include #13
- Added 2 risk entries (insufficient historical data, auto-tune non-convergence)
- Added capability-to-README traceability row

**SETUP.md:**
- Added "Pre-deployment testing" row to What Sentura Adds table

**Files modified:**
- `README.md` — capability table, Section 4 (5-phase incubation)
- `TeamPlan.md` — capability map, contracts, weekly tasks, checkpoints, risks, traceability
- `SETUP.md` — capability table
- `docs/MEMORY.md` — this entry

**Nothing left incomplete.**

**Known issues:** None introduced.

---

## 2026-04-05 — Week 1 Person B: Creator Agent, Workspace Convention, Templates, Skills

**What was done:**

All 7 Person B Week 1 tasks completed:

1. **Creator Agent workspace** (`sentura/agents/creator/`) — rewrote all 7 OpenClaw default files from generic personal-assistant templates to Sentura-specific Creator Agent content:
   - SOUL.md: Creator Agent identity, 5-phase incubation mission, operating principles
   - AGENTS.md: Detailed incubation protocol (Phase 1-5), output format, red lines
   - IDENTITY.md: Named "Forge", emoji 🔨
   - BOOTSTRAP.md: First-run initialization for meta-agent
   - HEARTBEAT.md: Periodic checks for pending incubations and post-deployment monitoring
   - TOOLS.md: Tool catalog, template library reference, MCP tier system
   - USER.md: Primary user profile (enterprise admins and department managers)
   - Created 3 Creator Agent skills: `skills/incubation/SKILL.md`, `skills/role-research/SKILL.md`, `skills/workspace-generation/SKILL.md`

2. **Workspace file convention** — created `docs/workspace-convention.md`:
   - Full specification for all 10 files + skills/ directory
   - File priority order (RULES.md > Skills Safety > SOUL.md Escalation > AGENTS.md Red Lines > CONTEXT.md Policies > SOUL.md Personality)
   - System prompt assembly order
   - Cross-team guidance (for Person C dashboard display, Person D extension interaction)

3. **3 role templates** in `sentura/config/templates/`:
   - `ap-clerk/` — config.json5, SOUL.md, RULES.md, CONTEXT.md, skills/{invoice-processing,vendor-management}
   - `cs-agent/` — config.json5, SOUL.md, RULES.md, CONTEXT.md, skills/{ticket-triage,refund-processing}
   - `sdr/` — config.json5, SOUL.md, RULES.md, CONTEXT.md, skills/{prospect-research,outreach-crafting}
   - All templates use `{placeholder}` convention for customizable values
   - `README.md` explaining template system and how to add new templates

4. **Self-provisioning skill** (`sentura/skills/self-provisioning/SKILL.md`):
   - 8-step procedure: check credentials → determine approval → navigate → register → obtain API keys → configure MCP → verify → audit log
   - Error handling for CAPTCHA, 2FA, rate limits, phone verification
   - Approval routing table (auto-approve vs standard vs elevated)
   - Secret store naming convention

5. **Knowledge-curation skill** (`sentura/skills/knowledge-curation/SKILL.md`):
   - 6-step procedure: receive source → extract info → structure knowledge → identify affected employees → distribute → verify
   - Handles URLs, PDFs, API docs, and verbal descriptions
   - Knowledge classification (procedural → SKILL.md, contextual → CONTEXT.md, safety → RULES.md with approval, reference → data/)

6. **Manual employee creation test** — created `workspaces/cs-agent-gradsale/`:
   - Complete 10-file workspace based on the GradSale ekg/ reference enterprise
   - All files filled with real GradSale context (admin API endpoints, dispute handling, support policies)
   - 2 skills: `support-triage/SKILL.md` and `dispute-resolution/SKILL.md` referencing actual GradSale admin API endpoints
   - `config.json5` — full agent config with MCP server references for gradsale-admin and gradsale-web

**Files created:**
- `sentura/agents/creator/SOUL.md` (rewritten)
- `sentura/agents/creator/AGENTS.md` (rewritten)
- `sentura/agents/creator/IDENTITY.md` (rewritten)
- `sentura/agents/creator/BOOTSTRAP.md` (rewritten)
- `sentura/agents/creator/HEARTBEAT.md` (rewritten)
- `sentura/agents/creator/TOOLS.md` (rewritten)
- `sentura/agents/creator/USER.md` (rewritten)
- `sentura/agents/creator/skills/incubation/SKILL.md`
- `sentura/agents/creator/skills/role-research/SKILL.md`
- `sentura/agents/creator/skills/workspace-generation/SKILL.md`
- `docs/workspace-convention.md`
- `sentura/config/templates/README.md`
- `sentura/config/templates/ap-clerk/{config.json5,SOUL.md,RULES.md,CONTEXT.md,skills/invoice-processing/SKILL.md,skills/vendor-management/SKILL.md}`
- `sentura/config/templates/cs-agent/{config.json5,SOUL.md,RULES.md,CONTEXT.md,skills/ticket-triage/SKILL.md,skills/refund-processing/SKILL.md}`
- `sentura/config/templates/sdr/{config.json5,SOUL.md,RULES.md,CONTEXT.md,skills/prospect-research/SKILL.md,skills/outreach-crafting/SKILL.md}`
- `sentura/skills/self-provisioning/SKILL.md`
- `sentura/skills/knowledge-curation/SKILL.md`
- `workspaces/cs-agent-gradsale/{SOUL.md,RULES.md,CONTEXT.md,AGENTS.md,IDENTITY.md,TOOLS.md,HEARTBEAT.md,BOOTSTRAP.md,MEMORY.md,USER.md,config.json5,skills/support-triage/SKILL.md,skills/dispute-resolution/SKILL.md}`

**Files modified:**
- `TeamPlan.md` — marked all Person B Week 1 tasks as done
- `docs/MEMORY.md` — this entry

**Key decisions:**
- Creator Agent named "Forge" with a structured 5-phase incubation protocol
- File priority order defined: RULES.md has highest precedence, SOUL.md personality lowest
- Templates use `{placeholder}` convention (curly braces) for values customized at incubation time
- Templates include `$` prefix for financial thresholds (e.g., `${high_threshold}`) to distinguish from string placeholders
- GradSale CS Agent used as the manual creation test — references real GradSale admin API endpoints from ekg/ docs
- MCP server config in the test employee references Tier 2 (Sentura-generated) servers that Person D will build in Week 2

**Nothing left incomplete.** All 7 Person B Week 1 tasks are done.

**Known issues:** None introduced.

---

## 2026-04-05 — Workspace Path Architecture Fix (OpenClaw State Directory Integration)

**What was done:**

Investigated how OpenClaw resolves agent workspace paths at runtime and corrected all Sentura files that had incorrect assumptions about workspace locations.

**Problem identified:**
All agent `config.json5` files (templates and test employee) used `workspace: "./workspaces/{agent-id}"` — a CWD-relative path. OpenClaw resolves relative paths via `path.resolve()` against the gateway process's CWD, which varies by environment (local dev launches from `openclaw/`, Docker uses `/app/`, etc.). This made workspace resolution fragile and environment-dependent.

**Resolution chain discovered (from OpenClaw source):**
1. `resolveAgentWorkspaceDir()` in `openclaw/src/agents/agent-scope.ts`
2. → checks agent config `workspace` field → `resolveUserPath()` → `path.resolve()` (CWD-relative)
3. → checks `agents.defaults.workspace` + agent ID
4. → falls back to `resolveStateDir()` + `workspace-{agentId}` → `~/.openclaw/workspace-{agentId}`

**Sentura convention adopted:** Omit `workspace` from all agent configs. Let OpenClaw fall back to `~/.openclaw/workspace-{agent-id}/`. This is absolute, deterministic, and works identically across dev/Docker/production.

**Clarified design-time vs runtime:**
- `workspaces/` in git = reference examples for development validation (NOT runtime)
- `sentura/config/templates/` in git = starting-point templates with placeholders (NOT runtime)
- `~/.openclaw/workspace-{agent-id}/` = live runtime workspaces (NOT in git)

**Files modified:**
- `docs/workspace-convention.md` — added Runtime vs Design-time sections, deployment lifecycle, path resolution explanation, templates-vs-runtime comparison table
- `workspaces/cs-agent-gradsale/config.json5` — removed `workspace` and `skills` fields
- `sentura/config/templates/ap-clerk/config.json5` — removed `workspace` and `skills` fields
- `sentura/config/templates/cs-agent/config.json5` — removed `workspace` and `skills` fields
- `sentura/config/templates/sdr/config.json5` — removed `workspace` and `skills` fields
- `sentura/config/templates/README.md` — added workspace path convention section
- `sentura/agents/creator/AGENTS.md` — Phase 5 now specifies `~/.openclaw/` target
- `sentura/agents/creator/TOOLS.md` — corrected workspace directory reference
- `sentura/agents/creator/skills/workspace-generation/SKILL.md` — corrected directory setup to `~/.openclaw/`, removed `workspace` from config template
- `sentura/agents/creator/skills/incubation/SKILL.md` — added target directory note and no-workspace-field rule
- `docs/MEMORY.md` — this entry

**Key architectural decision:**
Sentura never sets `workspace` in agent configs. The Creator Agent writes files directly to `~/.openclaw/workspace/{agent-id}/` during incubation, and OpenClaw's default namespace resolution finds them automatically. This single convention eliminates an entire class of CWD-related deployment bugs.

**Nothing left incomplete.**

**Known issues:** None introduced.

---

## 2026-04-05 — Critical Config Schema Discovery & Sentura-OpenClaw Integration Architecture

**What was done:**

Deep architectural investigation into how Sentura connects to and interacts with OpenClaw at runtime. This resolved three blocking questions:

1. **How does Sentura connect to OpenClaw?** There is no separate Sentura process. The entire platform runs inside one OpenClaw gateway (single Node.js process). Sentura's meta-agents (Creator, Tuner, Orchestrator) are themselves OpenClaw agents with elevated tool permissions. The Creator Agent uses the `gateway` tool with `config.patch` action to register new AI employees and `fs_write` to create workspace files. The Sentura Dashboard connects via the Gateway WebSocket RPC API.

2. **Can we register agents during OpenClaw setup?** No. OpenClaw's `onboard` command has no post-setup hook. Solution: a `scripts/sentura-setup.sh` script that runs after `openclaw onboard`.

3. **Should we wait until all 3 meta-agents are ready?** No. Agents are independent config entries — register them as they become ready.

**Critical discovery — Agent config schema was WRONG:**

All Sentura `config.json5` files and documentation used an incorrect schema. The differences:

| Aspect | What we had (WRONG) | What OpenClaw uses (CORRECT) |
|--------|---------------------|------------------------------|
| Agent list | `agents.entries.{id}` (object map) | `agents.list[]` (array with `id` field) |
| System prompt | `systemPrompt` field in agent config | No field — comes from workspace SOUL.md/AGENTS.md |
| Tool access | `tools.allowlist` / `tools.denylist` | `tools.profile` + `tools.alsoAllow` / `tools.deny` |
| Bindings | Inside agent entry | Top-level `bindings[]` array |
| MCP servers | Inside agent entry | Top-level `mcp.servers` |
| Approvals | Inside agent entry | Top-level `approvals` |
| Memory | `memory: { enabled: true }` | `memorySearch.enabled` (default on) |

Source of truth: `openclaw/src/config/types.agents.ts` (AgentsConfig, AgentConfig) and `openclaw/src/config/types.openclaw.ts` (OpenClawConfig).

**What was fixed:**

1. **All 4 config.json5 files** rewritten to correct schema:
   - `sentura/config/templates/ap-clerk/config.json5`
   - `sentura/config/templates/cs-agent/config.json5`
   - `sentura/config/templates/sdr/config.json5`
   - `workspaces/cs-agent-gradsale/config.json5`

2. **Documentation updated** to use correct schema:
   - `docs/gateway-rpc.md` — config.patch examples
   - `docs/workspace-convention.md` — agent config schema section, deployment lifecycle, path references
   - `sentura/agents/creator/AGENTS.md` — Phase 2 config format
   - `sentura/agents/creator/TOOLS.md` — added `gateway` tool, corrected workspace paths
   - `sentura/agents/creator/skills/workspace-generation/SKILL.md` — corrected config template
   - `sentura/agents/creator/skills/incubation/SKILL.md` — corrected Step 5 config generation
   - `sentura/config/templates/README.md` — corrected schema documentation
   - `README.md` — fixed config examples in Sections 3, 8, 9, 16, 17, Quick Start

3. **Setup infrastructure created:**
   - `scripts/sentura-setup.sh` — idempotent script that copies meta-agent workspaces to `~/.openclaw/workspace/` and registers them via OpenClaw CLI
   - `sentura/agents/creator/config.json5` — Creator Agent config with correct schema
   - `sentura/agents/tuner/config.json5` — Tuner Agent config with correct schema
   - `sentura/agents/orchestrator/config.json5` — Orchestrator Agent config with correct schema

4. **SETUP.md and README.md** updated with two-step setup flow:
   1. `cd openclaw && pnpm openclaw onboard` (OpenClaw itself)
   2. `./scripts/sentura-setup.sh` (Sentura meta-agents)

**OpenClaw CLI capabilities discovered:**
- `openclaw agents add [name]` — registers agents with `--workspace`, `--model`, `--non-interactive`
- `openclaw config set` — supports `--batch-file` and `--batch-json` for bulk config
- `openclaw agents list --json` — lists registered agents
- `agents.defaults.workspace` is set by onboard to determine default workspace base path

**Workspace path convention updated:**
- Previous: `~/.openclaw/workspace-{agent-id}/` (fallback pattern)
- Current: `~/.openclaw/workspace/{agent-id}/` (via `agents.defaults.workspace` + agent ID)

**Files created:**
- `scripts/sentura-setup.sh`
- `sentura/agents/creator/config.json5`
- `sentura/agents/tuner/config.json5`
- `sentura/agents/orchestrator/config.json5`

**Files modified:**
- All 4 `config.json5` templates/examples
- `docs/gateway-rpc.md`
- `docs/workspace-convention.md`
- `sentura/agents/creator/AGENTS.md`
- `sentura/agents/creator/TOOLS.md`
- `sentura/agents/creator/skills/workspace-generation/SKILL.md`
- `sentura/agents/creator/skills/incubation/SKILL.md`
- `sentura/config/templates/README.md`
- `README.md`
- `SETUP.md`
- `docs/MEMORY.md` — this entry

**Key architectural decisions:**
1. Sentura is a layer inside OpenClaw, not a separate process
2. Meta-agents are OpenClaw agents with `gateway` tool access
3. Agent registration uses `openclaw agents add` CLI + `openclaw config set --batch-file`
4. All config files now use the correct `agents.list` array schema
5. Setup is a two-step flow: OpenClaw onboard + Sentura setup script

**Nothing left incomplete.**

**Known issues:** None introduced.

---

### 2026-04-06 — Sentura Bootstrap Hook (RULES.md + CONTEXT.md Injection)

**Problem**: OpenClaw natively loads only 8 hardcoded workspace files into the agent system prompt (`VALID_BOOTSTRAP_NAMES` in `openclaw/src/agents/workspace.ts`): AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md. Sentura's two additional files — `RULES.md` (safety boundaries) and `CONTEXT.md` (enterprise context) — were not being injected into the system prompt.

**Investigation**: Explored OpenClaw's system prompt assembly pipeline:
- `workspace.ts` → `loadWorkspaceBootstrapFiles()` hardcodes `VALID_BOOTSTRAP_NAMES`
- `bootstrap-hooks.ts` → `applyBootstrapHookOverrides()` fires `agent:bootstrap` event
- `bootstrap-extra-files` bundled hook demonstrates the pattern but also filters by `VALID_BOOTSTRAP_NAMES`
- However, direct manipulation of `context.bootstrapFiles` in a hook bypasses that filter
- `buildBootstrapContextFiles()` in `pi-embedded-helpers/bootstrap.ts` only uses `path`, `content`, `missing`, and `name` (as string for display) — no runtime type validation

**Solution (Option C — Sentura bootstrap hook)**:

Created a managed hook at `sentura/hooks/sentura-bootstrap/` that:
1. Listens for `agent:bootstrap` events
2. Reads `RULES.md` and `CONTEXT.md` from the agent's workspace directory
3. Appends them directly to `context.bootstrapFiles`
4. Silently skips missing files (safe for non-Sentura agents)

The hook is installed to `~/.openclaw/hooks/sentura-bootstrap/` by `scripts/sentura-setup.sh` (Step 5) and enabled in `hooks.internal.entries.sentura-bootstrap` in the OpenClaw config.

**Files created:**
- `sentura/hooks/sentura-bootstrap/HOOK.md` — hook metadata
- `sentura/hooks/sentura-bootstrap/handler.ts` — hook handler

**Files modified:**
- `scripts/sentura-setup.sh` — added Step 5 (hook installation + config enablement)
- `docs/workspace-convention.md` — documented system prompt assembly with hook details
- `SETUP.md` — added hook installation to setup script description
- `README.md` — updated RULES.md section + added hooks to project structure
- `docs/MEMORY.md` — this entry

**Key architectural decisions:**
1. Used OpenClaw's managed hooks directory (`~/.openclaw/hooks/`) — shared across workspaces, no OpenClaw core modification
2. Direct `context.bootstrapFiles` manipulation (not via `loadExtraBootstrapFilesWithDiagnostics`) to bypass the `VALID_BOOTSTRAP_NAMES` filter
3. Hook source lives in git at `sentura/hooks/` and is copied to `~/.openclaw/hooks/` during setup
4. Hook is safe for non-Sentura agents (silently skips missing files)

**Nothing left incomplete.**
