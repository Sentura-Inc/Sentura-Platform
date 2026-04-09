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
- Marked all Person A Week 1 tasks as complete in `docs/TeamPlan.md`

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
- `docs/TeamPlan.md` — marked Person A Week 1 tasks complete
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
- Wrote comprehensive `docs/OPENCLAW.md` technical reference document (23 sections, ~700 lines)

**Files created/modified:**
- `docs/OPENCLAW.md` — full technical reference document
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
- `docs/SETUP.md` — full rewrite for local install
- `README.md` — updated Deployment Options and Quick Start sections
- `docs/TeamPlan.md` — updated Person A tasks to reflect local setup
- `.cursorrules` — updated tech stack table and rules for local-first dev
- `docs/MEMORY.md` — this entry

**Critical lesson:**
For development, always build OpenClaw from source (`cd openclaw && pnpm install && pnpm ui:build && pnpm build`) and run via `pnpm gateway:watch`. Docker is only for production deployment. Do not create custom Docker wrappers, compose files, or setup scripts for development.

---

## 2026-03-28 — Major Architecture Pivot: OpenClaw-Based AI Employees

**What was done:**
- Complete rewrite of `README.md` — pivoted from custom Python/FastAPI/LangGraph platform to OpenClaw-based architecture
- Complete rewrite of `.cursorrules` — updated all coding standards, tech stack, and behavioral rules for OpenClaw/TypeScript
- Complete rewrite of `docs/TeamPlan.md` — new 8-week sprint plan for 4 people building on OpenClaw

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
- `docs/TeamPlan.md` — complete rewrite (new 8-week plan)
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
- Updated docs/SETUP.md with comprehensive Sentura layer description showing all 13 capabilities with status

**Key findings from OpenClaw codebase analysis:**
1. OpenClaw's default workspace files are defined in `openclaw/src/agents/workspace.ts`: AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, BOOTSTRAP, MEMORY — no RULES.md
2. OpenClaw's security is generic: `DEFAULT_GATEWAY_HTTP_TOOL_DENY` in `src/security/dangerous-tools.ts` blocks high-risk tools on HTTP; exec approvals in `src/infra/exec-approvals.ts` are binary per-agent-ID overrides — no decision-context awareness
3. OpenClaw's `agents.create` RPC takes structured params (model, systemPrompt, workspace, tools) — no natural language creation
4. OpenClaw has zero enterprise connector extensions — all 86 extensions are channels, AI providers, speech, search, tools, or infrastructure
5. OpenClaw is single-tenant: one gateway, one config file, one user context
6. OpenClaw's `sessions_spawn` has depth limits but no task decomposition, progress tracking, or macro-objective planning

**Files modified:**
- `README.md` — 5 sections updated with accurate OpenClaw/Sentura attribution
- `docs/SETUP.md` — Sentura layer section rewritten with capability inventory
- `docs/MEMORY.md` — this entry

**Nothing left incomplete.**

**Known issues:** None introduced.

---

## 2026-04-05 — docs/TeamPlan.md Full Rewrite for 12-Capability Alignment

**What was done:**
- Complete rewrite of `docs/TeamPlan.md` to align with the updated README.md's 12 Sentura capabilities
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
- `docs/TeamPlan.md` — full rewrite
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

**docs/TeamPlan.md:**
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

**docs/SETUP.md:**
- Added "Pre-deployment testing" row to What Sentura Adds table

**Files modified:**
- `README.md` — capability table, Section 4 (5-phase incubation)
- `docs/TeamPlan.md` — capability map, contracts, weekly tasks, checkpoints, risks, traceability
- `docs/SETUP.md` — capability table
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
- `docs/TeamPlan.md` — marked all Person B Week 1 tasks as done
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

4. **docs/SETUP.md and README.md** updated with two-step setup flow:
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
- `docs/SETUP.md`
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
- `docs/SETUP.md` — added hook installation to setup script description
- `README.md` — updated RULES.md section + added hooks to project structure
- `docs/MEMORY.md` — this entry

**Key architectural decisions:**
1. Used OpenClaw's managed hooks directory (`~/.openclaw/hooks/`) — shared across workspaces, no OpenClaw core modification
2. Direct `context.bootstrapFiles` manipulation (not via `loadExtraBootstrapFilesWithDiagnostics`) to bypass the `VALID_BOOTSTRAP_NAMES` filter
3. Hook source lives in git at `sentura/hooks/` and is copied to `~/.openclaw/hooks/` during setup
4. Hook is safe for non-Sentura agents (silently skips missing files)

**Nothing left incomplete.**

---

## 2026-04-06 — Week 1 Person C: Dashboard Scaffold, RPC Client, App Shell, Employee Roster, Session View

**What was done:**

All 5 Person C Week 1 tasks completed:

1. **Scaffolded Sentura dashboard** (`sentura/dashboard/`):
   - Next.js 16.2.2 (App Router) with TypeScript strict mode
   - Tailwind CSS v4 with shadcn/ui v4 (base-ui/react)
   - 14 shadcn/ui components installed: button, card, badge, table, scroll-area, separator, skeleton, tooltip, avatar, input, sheet, tabs, dialog, dropdown-menu
   - Geist font family (sans + mono)
   - Dark mode support via CSS custom properties (oklch color scheme)
   - `.env.local.example` with `NEXT_PUBLIC_GATEWAY_URL` and `NEXT_PUBLIC_GATEWAY_TOKEN`

2. **Built the Gateway WebSocket RPC client library** (`src/lib/gateway/`):
   - `types.ts` — full TypeScript interfaces for AgentConfig, SessionSummary, TranscriptMessage, ApprovalRequest, RpcRequest/Response, GatewayEvent, GatewayClientOptions
   - `client.ts` — `GatewayClient` class with:
     - WebSocket connection management with auto-reconnect (configurable max attempts + interval)
     - JSON-RPC 2.0 protocol with `rpc<T>()` generic method and 30s timeout
     - Event subscription system (`on()` returns unsubscribe function)
     - Connection state tracking (disconnected/connecting/connected/reconnecting)
     - Typed convenience methods: `getAgents()`, `listSessions()`, `getTranscript()`, `sendChat()`, `listApprovals()`, `resolveApproval()`, `health()`, `listModels()`, `listTools()`
     - Singleton `getGatewayClient()` factory using env vars
   - `hooks.ts` — React hooks for gateway data:
     - `useGateway()` — manages connection lifecycle, returns client + state
     - `useAgents()`, `useSessions()`, `useTranscript()`, `useApprovals()` — data-fetching hooks with loading/error/refetch
     - `useGatewayEvent()` — subscribe to real-time gateway events
   - `index.ts` — clean re-exports

3. **Created the app shell** (`src/components/` + `src/app/layout.tsx`):
   - `sidebar.tsx` — collapsible sidebar navigation with 8 nav items (Overview, Employees, Sessions, Approvals, Integrations, Cost Center, Audit Trail, Health), disabled items show "W2"–"W5" badges for upcoming sprints, Settings placeholder, user avatar/role placeholder, collapse toggle
   - `app-shell.tsx` — flex layout with sidebar + header + main content area
   - `connection-status.tsx` — real-time gateway connection indicator (colored dot + label)
   - Root layout wraps everything in `TooltipProvider` + `AppShell`

4. **Built the Employee Roster page** (`src/app/employees/page.tsx`):
   - Table listing all agents from `config.get → agents.list`
   - Columns: Employee (name + ID), Model, Tools (profile + count), Sandbox mode
   - Search/filter by name, ID, or model
   - Click-to-open detail dialog showing full agent config (tools allowlist, denylist, sandbox, runtime)
   - Loading skeleton, empty state, error state
   - Refresh button

5. **Built the Session View** (`src/app/sessions/page.tsx` + `src/app/sessions/[key]/page.tsx`):
   - Session list page: table with session key, channel, agent, message count, status; search/filter; link to transcript
   - Transcript page: chat-style message bubbles (user messages right-aligned with primary color, assistant left-aligned with avatar, tool calls in bordered panel with mono font, system messages in dashed border), scroll area, loading/error/empty states
   - Chat input at bottom with send button, Enter-to-send, disables when gateway disconnected
   - Back navigation to session list

**Files created:**
- `sentura/dashboard/` — full Next.js project (scaffolded via create-next-app + shadcn init)
- `src/lib/gateway/types.ts` — RPC type definitions
- `src/lib/gateway/client.ts` — WebSocket RPC client
- `src/lib/gateway/hooks.ts` — React hooks
- `src/lib/gateway/index.ts` — re-exports
- `src/components/sidebar.tsx` — navigation sidebar
- `src/components/app-shell.tsx` — layout wrapper
- `src/components/connection-status.tsx` — gateway status indicator
- `src/app/layout.tsx` — root layout (updated)
- `src/app/page.tsx` — dashboard overview
- `src/app/employees/page.tsx` — employee roster
- `src/app/sessions/page.tsx` — session list
- `src/app/sessions/[key]/page.tsx` — session transcript viewer
- `.env.local.example` — environment variable template

**Files modified:**
- `docs/TeamPlan.md` — marked all Person C Week 1 tasks as done
- `docs/MEMORY.md` — this entry

**Key decisions:**
- Used Next.js 16 (latest via create-next-app) with App Router and client components for real-time WebSocket state
- shadcn/ui v4 uses `@base-ui/react` (not Radix) — TooltipProvider uses `delay` prop (not `delayDuration`), TooltipTrigger does not support `asChild`
- Gateway client is a singleton class (`getGatewayClient()`) initialized from `NEXT_PUBLIC_GATEWAY_URL` + `NEXT_PUBLIC_GATEWAY_TOKEN` env vars
- Token is passed as URL query param on WebSocket connection (`ws://host:port?token=...`)
- All data-fetching hooks use a shared `useRpc()` pattern that auto-connects on first use
- Sidebar nav items for future weeks are rendered as disabled with sprint week badges to show the roadmap
- Session transcript page uses `use(params)` (React 19 pattern) for async params in Next.js 16
- Build compiles successfully with 0 TypeScript errors and 0 lint errors

**Nothing left incomplete.** All 5 Person C Week 1 tasks are done.

**Known issues:** None introduced.

---

### 2026-04-06 — Fix: Gateway WebSocket Protocol Alignment (Person C)

**Problem:** The Sentura Dashboard's `GatewayClient` was using JSON-RPC 2.0 framing (`{ jsonrpc: "2.0", method, params, id }`) to communicate with the OpenClaw Gateway, which uses a custom frame protocol (`{ type: "req", id, method, params }`). Additionally, the client did not implement the required `connect.challenge` → `connect` handshake. This caused repeated `[ws] invalid handshake` / `[ws] closed before connect` errors.

**Root cause analysis:**
- OpenClaw Gateway expects custom frames: `RequestFrame { type: "req", id, method, params }`, `ResponseFrame { type: "res", id, ok, payload, error }`, `EventFrame { type: "event", event, payload }`
- Server sends `connect.challenge` event with a `nonce` immediately on connection; client must respond with a `connect` request containing `ConnectParams` (protocol version, client ID, auth token, etc.)
- The original dashboard client resolved its `connect()` promise on `ws.onopen` and sent JSON-RPC 2.0 frames, both incorrect

**Files modified:**
- `sentura/dashboard/src/lib/gateway/types.ts` — Replaced JSON-RPC 2.0 types (`RpcRequest`, `RpcResponse`) with OpenClaw frame types (`RequestFrame`, `ResponseFrame`, `EventFrame`, `ConnectParams`, `HelloOk`, `GatewayErrorShape`)
- `sentura/dashboard/src/lib/gateway/client.ts` — Complete rewrite: implements `connect.challenge` listener, sends proper `connect` handshake with `webchat-ui` client ID and `webchat` mode, uses OpenClaw frame format for all RPC calls, correctly parses `ResponseFrame.ok`/`ResponseFrame.payload` responses
- `sentura/dashboard/src/lib/gateway/index.ts` — Updated barrel exports (removed `RpcResponse`, added new frame types)

**Key design decisions:**
- Client uses `webchat-ui` as `client.id` and `webchat` as `client.mode` (matching OpenClaw's `GATEWAY_CLIENT_IDS` / `GATEWAY_CLIENT_MODES`)
- Protocol version hardcoded to `3` (current `PROTOCOL_VERSION` from OpenClaw)
- Role set to `operator` with `operator.admin` scope for dashboard admin access
- Auth token passed in `ConnectParams.auth.token` (from `NEXT_PUBLIC_GATEWAY_TOKEN` env var)
- No changes needed to `hooks.ts` — method names and types remained compatible

**Build status:** Compiles successfully with 0 TypeScript errors.

---

### 2026-04-06 — Created docs/HOSTING.md Production Hosting Guide

**What was done:**
- Created `docs/HOSTING.md` in the project root as the canonical production hosting document
- Covers all three target environments: Cloud VPS, Virtual Machine, and customer on-premise servers
- Documents the co-hosted topology (Dashboard + Gateway on the same machine behind a reverse proxy)
- Describes three auth modes mapped to deployment types: Token Auth (VPS/VM), Trusted-Proxy (enterprise SSO), Tailscale (hybrid)
- Includes host requirements, Nginx and Caddy reference configs, gateway config reference table, and deployment packaging strategy

**Files created:**
- `docs/HOSTING.md` — Production hosting guide for all deployment targets

---

### 2026-04-06 — Added Security Risk Analysis to docs/HOSTING.md, Updated Cross-References

**What was done:**
- Added comprehensive security and risk analysis section to `docs/HOSTING.md` covering:
  - Per-hosting-type risk tables: Cloud VPS (moderate safety), VM/private cloud (high safety), on-premise (highest safety)
  - Platform-wide risks applicable to all hosting types: agent shell execution, browser automation exfiltration, credential store compromise, MCP server access, LLM prompt leakage, approval bypass
  - Security spectrum visualization (on-prem air-gapped > VM > VPS)
  - Recommended security posture table by customer profile (startup, mid-market, regulated enterprise, distributed team)
- Updated `README.md` §15 (Security Model) and §16 (Deployment Options) with cross-references to `docs/HOSTING.md`
- Updated `docs/TeamPlan.md`:
  - Added `docs/HOSTING.md` references to Week 3 (deployment docs), Week 5 (on-prem docs), and Week 7 (deployment guide) tasks
  - Added `docs/HOSTING.md` to Capability-to-README Traceability table (enterprise authentication row + new "Production hosting & security" row)
  - Added three new risks to Risk Mitigation table: LLM prompt leakage, credential store compromise, agent shell/browser exfiltration

**Files modified:**
- `docs/HOSTING.md` — Added "Security & Risk Analysis" section with risk tables, mitigations, and customer profile recommendations
- `README.md` — Added cross-references to `docs/HOSTING.md` in §15 and §16
- `docs/TeamPlan.md` — Added `docs/HOSTING.md` references to deployment tasks, traceability table, and risk mitigation table
- `docs/MEMORY.md` — This entry

### 2026-04-06 — Hybrid Dashboard Revision (Approach C)

**Architectural Decision:**
Adopted a hybrid UI approach for the Sentura platform. Instead of rebuilding all OpenClaw Control UI features in the Next.js dashboard (Approach A) or abandoning the Next.js dashboard to extend the Lit-based Control UI (Approach B), the platform uses both UIs with a clear responsibility split:

- **Sentura Dashboard (Next.js)** — enterprise management features OpenClaw lacks: employee lifecycle, approvals, cost center, audit trail, integrations, orchestrator, knowledge manager, testing, settings, SSO
- **OpenClaw Control UI (Lit, served by gateway)** — operational/developer tools already built: config editor, sessions & chat, logs, debug console, cron, skills browser, channel status, usage stats

The Sentura Dashboard sidebar includes external links to the Control UI. In production, both UIs are served from a single domain using path-based routing (see `docs/HOSTING.md`).

**What was done:**
- Deleted duplicate pages: `sentura/dashboard/src/app/sessions/page.tsx` and `sentura/dashboard/src/app/sessions/[key]/page.tsx`
- Rewrote `sentura/dashboard/src/components/sidebar.tsx` with three nav sections (Enterprise, Management, Operations) and external links to Control UI
- Repurposed `sentura/dashboard/src/app/page.tsx` — removed Sessions stat card, added Pending Approvals count, added System Health link to Control UI, replaced "View Sessions" quick action with "Create Employee" placeholder
- Repurposed `sentura/dashboard/src/app/employees/page.tsx` — removed raw config detail dialog, replaced with enterprise lifecycle table (Status column, Tune/Config actions, "Create Employee" button, external link to Control UI raw config)
- Added `NEXT_PUBLIC_CONTROL_UI_URL` environment variable to `.env.local` and `.env.local.example`
- Updated `docs/HOSTING.md` — revised production topology to show hybrid UI architecture, replaced two-subdomain Nginx config with single-domain path-based routing as recommended approach, updated dashboard client configuration table with `NEXT_PUBLIC_CONTROL_UI_URL`
- Updated `README.md` §17 — replaced "Dashboard Features" with "Hybrid UI Architecture" section documenting the responsibility split, listed 11 enterprise-only features, added "Deferred to OpenClaw Control UI" section
- Updated `docs/TeamPlan.md` — revised Person C tasks across Weeks 1–8: marked session-related tasks as removed/deferred, added hybrid architecture tasks, added route paths to task descriptions, updated Week 7-8 validation to reference 11 enterprise features

**Files modified:**
- `sentura/dashboard/src/app/sessions/page.tsx` — deleted
- `sentura/dashboard/src/app/sessions/[key]/page.tsx` — deleted
- `sentura/dashboard/src/components/sidebar.tsx` — rewritten
- `sentura/dashboard/src/app/page.tsx` — repurposed for enterprise overview
- `sentura/dashboard/src/app/employees/page.tsx` — repurposed for lifecycle management
- `sentura/dashboard/.env.local` — added `NEXT_PUBLIC_CONTROL_UI_URL`
- `sentura/dashboard/.env.local.example` — added `NEXT_PUBLIC_CONTROL_UI_URL`
- `docs/HOSTING.md` — updated topology, Nginx config, client config table
- `README.md` — updated §17 with hybrid UI architecture
- `docs/TeamPlan.md` — revised Person C tasks Weeks 1–8
- `docs/MEMORY.md` — this entry

**Key decisions:**
- OpenClaw Control UI has no documented plugin API for custom tabs, so extending it would require modifying core OpenClaw files (violates project rule #6)
- The gateway client library (`sentura/dashboard/src/lib/gateway/client.ts`) remains unchanged — all RPC methods are still useful for enterprise pages
- Hooks for sessions/transcripts remain in the gateway library for potential future use but are no longer imported by any page

---

### 2026-04-06 — Post-Review Cleanup (Week 1 Polish)

**Summary:** Applied four fixes identified during the Week 1 implementation review.

**What was done:**
1. **Meta-agent filtering** — `GatewayClient.getAgents()` now excludes `creator`, `tuner`, and `orchestrator` (the platform's internal meta-agents) from the employee list. Added `getAllAgentsIncludingMeta()` for cases that need unfiltered access.
2. **GatewayEventType fix** — Replaced stale `"approval.pending"` / `"approval.resolved"` with correct OpenClaw event names: `exec.approval.requested`, `exec.approval.resolved`, `plugin.approval.requested`, `plugin.approval.resolved`. Also added `sessions.changed` and `health` event types.
3. **JSDoc fix** — Corrected the `sendConnectHandshake` comment to document the actual client ID (`openclaw-control-ui`) and mode (`ui`).
4. **Home page error state** — Added a "Gateway Disconnected" banner on the Enterprise Overview page when the WebSocket connection is in `disconnected` state, with guidance to check the gateway and env config.

**Files modified:**
- `sentura/dashboard/src/lib/gateway/client.ts` — meta-agent filtering, JSDoc fix
- `sentura/dashboard/src/lib/gateway/types.ts` — corrected GatewayEventType union
- `sentura/dashboard/src/app/page.tsx` — disconnection banner, error-aware imports

---

### 2026-04-08 — Person D Week 1 Complete

**Summary:** Completed all Person D Week 1 tasks: studied OpenClaw's plugin SDK and approval system, built the `sentura-audit` extension, designed and scaffolded the `sentura-rbac` extension, wrote initial approval policy configs, and studied the GradSale API docs for MCP generation prep.

**What was done:**

1. **OpenClaw Plugin SDK study** — Analyzed `definePluginEntry`, `OpenClawPluginApi`, `api.registerTool()`, `api.on()` typed hooks, `api.registerGatewayMethod()`, and `api.registerHttpRoute()`. Identified key hooks: `before_tool_call`, `after_tool_call`, `session_start`, `session_end`, `message_received`, `message_sent`, `agent_end`, `gateway_start`, `gateway_stop`. Extension entry points follow `openclaw.extensions` in `package.json` pointing to `index.ts`.

2. **OpenClaw Approval System study** — Analyzed `exec.approval.*` and `plugin.approval.*` systems. Learned the `ExecApprovalsFile` structure (version, defaults, per-agent overrides, allowlists), security modes (`deny`/`allowlist`/`full`), ask modes (`off`/`on-miss`/`always`), approval persistence (`~/.openclaw/exec-approvals.json`), and human approval via Unix socket.

3. **sentura-audit extension** — Full implementation with:
   - `package.json`, `openclaw.plugin.json` manifest, `api.ts` barrel
   - `src/types.ts` — Audit event types, severity levels, AuditEntry, AuditConfig, AuditQueryParams
   - `src/redaction.ts` — Configurable PII/secret redaction with regex patterns
   - `src/store.ts` — File-based JSONL audit store with daily rotation, age/size retention, query filtering
   - `src/tool.ts` — `sentura_audit_query` agent-facing tool for querying audit logs
   - `index.ts` — Plugin entry registering all hooks (tool_call, tool_result, session_start/end, message_received/sent, agent_end, gateway_start/stop), gateway RPC methods (`sentura.audit.query`, `sentura.audit.stats`)

4. **RBAC model design** — Created `DESIGN.md` documenting the five-role permission model:
   - **platform_admin**: All scopes, all resources, T0-T4 data access
   - **dept_admin**: read/write/approvals scopes, department-scoped resources, T0-T2
   - **employee_owner**: read/write scopes, owned-employee resources, T0-T1
   - **auditor**: read scope, all resources read-only, T0-T2 (redacted PII)
   - **end_user**: read scope (limited), self-scoped sessions/approvals, T0 only
   - Three-layer authorization: OpenClaw scope → Sentura method policy → resource-level filtering
   - Department hierarchy with inheritance for nested departments

5. **sentura-rbac extension** — Scaffolded with:
   - `package.json`, `openclaw.plugin.json`, `api.ts`
   - `src/types.ts` — SenturaRole, SenturaUser, Department, RbacConfig, AuthorizationResult
   - `src/roles.ts` — Complete role definitions with operator scopes, permissions, data tier access
   - `src/store.ts` — File-based CRUD for users and departments with department hierarchy
   - `src/authorizer.ts` — Method-level authorization with role-permission matching and scope resolution
   - `index.ts` — Plugin entry with gateway RPC methods (roles.list, users.list/get/assign/upsert, departments.list, authorize, scope.employees) and `sentura_rbac_manage` agent tool

6. **Approval policy configs** — Created two files:
   - `sentura/config/approval-policies.json5` — Comprehensive Sentura-layer policy with tool-level policies (high/medium/low risk), action-level policies (self-provisioning, financial, data export, permissions), escalation chain (employee_owner → dept_admin → platform_admin), notification channels, reminder settings
   - `sentura/config/exec-approvals-template.json` — OpenClaw-native exec-approvals template with `security: "full"`, `ask: "always"`, `askFallback: "deny"`

7. **GradSale API study** — Analyzed all ekg/ docs. Identified 40+ admin API endpoints and 30+ web API endpoints. Categorized by MCP tool suitability: admin-scoped (user management, dispute resolution, report handling) vs user-scoped (listings, transactions, messaging). Key insight: separate MCP servers for admin vs user operations, with different approval policies.

**Files created:**
- `sentura/extensions/sentura-audit/package.json`
- `sentura/extensions/sentura-audit/openclaw.plugin.json`
- `sentura/extensions/sentura-audit/api.ts`
- `sentura/extensions/sentura-audit/index.ts`
- `sentura/extensions/sentura-audit/src/types.ts`
- `sentura/extensions/sentura-audit/src/redaction.ts`
- `sentura/extensions/sentura-audit/src/store.ts`
- `sentura/extensions/sentura-audit/src/tool.ts`
- `sentura/extensions/sentura-rbac/package.json`
- `sentura/extensions/sentura-rbac/openclaw.plugin.json`
- `sentura/extensions/sentura-rbac/api.ts`
- `sentura/extensions/sentura-rbac/index.ts`
- `sentura/extensions/sentura-rbac/DESIGN.md`
- `sentura/extensions/sentura-rbac/src/types.ts`
- `sentura/extensions/sentura-rbac/src/roles.ts`
- `sentura/extensions/sentura-rbac/src/store.ts`
- `sentura/extensions/sentura-rbac/src/authorizer.ts`
- `sentura/config/approval-policies.json5`
- `sentura/config/exec-approvals-template.json`

**Files modified:**
- `docs/TeamPlan.md` — Marked all Person D Week 1 tasks as done
- `docs/MEMORY.md` — This entry

**Key decisions:**
- Audit logs use daily JSONL files (not SQLite) for simplicity and grep-ability, with configurable retention by age and size
- RBAC uses file-based JSON storage consistent with OpenClaw's state layer (no external DB)
- Sentura roles map to subsets of OpenClaw's six operator scopes — platform_admin gets all six, end_user gets only operator.read
- Approval policies are layered: OpenClaw's exec.approval handles shell commands, Sentura's policy layer handles tool-level and action-level approvals
- Escalation chain follows role hierarchy: employee_owner → dept_admin → platform_admin, with 15-minute escalation timeout
- GradSale MCP servers should be split: admin-scoped vs user-scoped, each with different approval policies

---

## 2026-04-08 — Cross-Platform Setup Scripts (Linux + Windows)

**What was done:**
- Audited existing `scripts/sentura-setup.sh` — confirmed it was bash-only, works on macOS but had no explicit Linux or Windows support
- Studied OpenClaw's cross-platform approach: native Windows support via `scripts/install.ps1` (PowerShell), `schtasks.ts` daemon install, `USERPROFILE` home dir resolution; Linux via systemd; WSL2 detected via `/proc/version`
- Created `scripts/sentura-setup.ps1` — full PowerShell port of the setup script for native Windows, matching all 7 steps from the bash version (workspace copy, agent registration, config patching, hook installation)
- Hardened `scripts/sentura-setup.sh` — added platform detection (Linux/macOS/WSL2/MINGW), Node.js version check, WSL2 detection via `/proc/version`, and early exit with redirect to PowerShell for Windows Git Bash/MSYS users
- Updated `docs/SETUP.md` with cross-platform instructions: platform-specific prerequisite install commands (brew/apt/winget), parallel bash/PowerShell command blocks for all steps, state directory table by platform, Windows-specific troubleshooting (execution policy, long paths, WSL2 recommendation)

**Files created:**
- `scripts/sentura-setup.ps1`

**Files modified:**
- `scripts/sentura-setup.sh` — Added platform detection, Node.js version guard, WSL2 detection, MINGW/MSYS redirect
- `docs/SETUP.md` — Full cross-platform rewrite of prerequisites, OpenClaw setup, Sentura setup, troubleshooting
- `docs/MEMORY.md` — This entry

**Key decisions:**
- PowerShell script uses `$env:USERPROFILE\.openclaw` as the default state dir (matching OpenClaw's `home-dir.ts` resolution: `OPENCLAW_HOME` → `HOME` → `USERPROFILE` → `os.homedir()`)
- Inline `node -e` scripts for JSON config patching work identically on both platforms — Node.js normalizes path separators
- Windows Git Bash / MSYS / Cygwin users are explicitly redirected to the PowerShell script to avoid path resolution issues
- WSL2 is treated as Linux (uses the bash script), with an informational log message

---

## 2026-04-08 — docs/TESTS.md Policy Added to Project Rules

**What was done:**
- Added docs/TESTS.md maintenance as a mandatory behavioral rule (rule 3) in `.cursorrules` — every agent must update `docs/TESTS.md` when adding, changing, or removing testable deliverables
- Added "Test Documentation Policy" section to `docs/TeamPlan.md` (above Interface Contracts) with specific update guidelines
- Added `docs/TESTS.md` to `README.md` project structure tree and added a "Key Documentation" table in the Quick Start section with a bold callout about keeping docs/TESTS.md updated
- Renumbered `.cursorrules` behavioral rules 4–19 → 5–20 to accommodate the new rule 3
- Added `docs/TESTS.md` to the document sync list in `.cursorrules` rule 4

**Files modified:**
- `.cursorrules` — New rule 3 (docs/TESTS.md policy); docs/TESTS.md added to rule 4 sync list; rules 4–19 renumbered to 5–20
- `docs/TeamPlan.md` — New "Test Documentation Policy" section
- `README.md` — Project structure updated; Key Documentation table added
- `docs/MEMORY.md` — This entry

---

## 2026-04-08 — Sentura Communication Panel Design & Plan

**What was done:**

Deep investigation of OpenClaw's session, channel, binding, and multi-agent orchestration systems to design Sentura's Communication Panel — a WhatsApp/Slack-style chat interface for the dashboard.

**Key investigation findings:**

- OpenClaw sessions use keys of the form `agent:<agentId>:<rest>`, and the embedded `agentId` determines which agent handles the conversation
- `sessions.create` RPC accepts an explicit `agentId` parameter, creating keys like `agent:<agentId>:dashboard:<uuid>` — this is the supported way to start direct sessions with non-main agents
- `chat.send` resolves the agent from the session key via `resolveSessionAgentId` — no separate agent parameter needed
- The gateway broadcasts `chat` events with `state: "delta"` / `"final"` for real-time streaming
- OpenClaw's Control UI can already target any agent by changing `sessionKey`, but its UX is a single-pane developer tool, not an enterprise messaging experience
- `webchat` is a built-in internal channel constant (`INTERNAL_MESSAGE_CHANNEL`), not a plugin — identified by `client.mode === "webchat"`
- Bindings map `{ channel, accountId, peer }` → `agentId` via tiered first-match resolution, but `sessions.create` with explicit `agentId` bypasses binding resolution entirely
- Multi-agent orchestration uses `sessions_spawn` (agent tool, NOT an RPC) for subagent delegation; there is no `sessions.spawn` RPC
- ACP (`@agentclientprotocol/sdk`) is used for external ACP-capable child processes, not for intra-OpenClaw agent-to-agent messaging

**Critical decision: No OpenClaw core modifications needed for 1:1 chat.** All required RPCs (`sessions.create`, `chat.send`, `chat.history`, `sessions.list`, `chat.abort`) already exist. Group chat requires a Sentura-level fan-out orchestration layer but still uses the same underlying RPCs.

**Architecture decisions:**

- Dual-mode communication: external channels (Slack, Teams, etc.) for daily operations + Sentura dashboard chat for management/testing/debugging
- 1:1 chat: two-pane layout (conversation list + chat thread), uses `sessions.create` with `agentId` + `chat.send` with `sessionKey`
- Group chat: Sentura maintains group metadata and N underlying OpenClaw sessions (one per agent), fans out messages via `sessions.send`, merges responses into a unified thread
- Communication panel added as capability #14 (was 13 capabilities, now 14)
- Sprint allocation: 1:1 chat in Week 3 (Person C + Person A), group chat in Week 4 (Person C + Person D for audit)

**Files modified:**
- `README.md` — Added "Sentura Communication Panel" subsection to Section 7 (Communication & Channels) with 1:1 chat design, group chat architecture, enterprise interaction strategy; updated capability count from 13 to 14; added capability #14 to the Sentura Builds table
- `docs/TeamPlan.md` — Updated capability coverage map (13→14 capabilities); added capability #14 row; added Week 3 tasks: Person A session management helpers, Person C 1:1 Chat Panel; added Week 4 tasks: Person C group chat, Person D audit integration for chat; updated integration checkpoints IC-3 and IC-4; added communication panel session contract to Interface Contracts; updated all "13 capabilities" references to "14"
- `docs/MEMORY.md` — This entry

**Also fixed in this session:**
- Dashboard `config.get` bug: `sentura/dashboard/src/lib/gateway/client.ts` `getConfig()` was not unwrapping the `{ hash, config }` snapshot wrapper from OpenClaw's `config.get` RPC, causing `getAgents()` to return empty. Fixed by extracting `snapshot.config` before returning.

---

### 2026-04-08 — Enterprise Knowledge Graph (EKG) Architecture Documentation

**What was done:**

Implemented the EKG architecture design into the project's source-of-truth documents (README.md and docs/TeamPlan.md). This was a documentation-only update — no implementation code was written. The goal was to lock in the EKG architecture before any team member begins building.

**Architecture decisions documented:**

1. **Hybrid EKG design:** Enterprise knowledge stored as structured JSON5 files in per-agent `ekg/` directories (4 pillars: org/, rules/, assets/, workflows/), auto-indexed by OpenClaw's workspace file scanner and searchable via hybrid FTS + vector search. No graph database required.
2. **Three-tiered data source model:** Tier 1 (Industry Ontology Templates at `sentura/config/industry-ontologies/`), Tier 2 (Client data via Data Scavenger Agent + Q&A-based Completion), Tier 3 (Autonomous Experience Links extracted from daily operations).
3. **Data Scavenger Agent:** New meta-agent at `sentura/agents/data-scavenger/` that processes unstructured documents → classifies into 4 pillars → writes structured JSON5 → additive merge only.
4. **AI Manager EKG:** Orchestrator gets its own `ekg/` with capabilities/, conflicts/, insights/, global-sops/ directories. Three mechanisms: capability abstraction, cross-domain conflict detection, reverse-injection training.
5. **Capability count increased from 14 to 17:** Added #11 (Enterprise Knowledge Graph), #12 (Data Scavenger Agent), #13 (Progressive knowledge accumulation), #17 (Cross-agent knowledge aggregation). Renumbered old #11-14 to #14-16.

**Files modified:**

- `README.md`:
  - Section 1: Capability table expanded from 14 to 17 capabilities (added #11 EKG, #12 Data Scavenger, #13 Progressive accumulation, #17 Cross-agent aggregation; renumbered old #11-14 to #14-16)
  - Section 6: Full rewrite from "From EKG to Knowledge Skills" → "Enterprise Knowledge Graph (EKG)" — 3-tier model, 4-pillar ontology, per-agent `ekg/` directory, Data Scavenger Agent, Q&A-based Completion, Experience Links, industry ontology templates, knowledge source ingestion table
  - Section 10: Expanded memory architecture — added three-tier memory model (static EKG + dynamic LanceDB + live MCP), EKG-memory integration (auto-indexing, hybrid search), dreaming extensions for Experience Link extraction and gap detection
  - Section 12: Expanded multi-agent orchestration — added AI Manager EKG directory structure, Mechanism 1 (capability abstraction), Mechanism 2 (cross-domain conflict detection), Mechanism 3 (reverse-injection training), updated cross-employee knowledge sharing list
  - Section 19: Project structure updated — added `sentura/agents/data-scavenger/`, `sentura/config/industry-ontologies/`, `sentura/skills/qa-completion/`, `sentura/skills/experience-extraction/`, per-agent `ekg/` directory in workspaces, Orchestrator EKG subdirectories

- `docs/TeamPlan.md`:
  - Header: Updated from 13 to 17 capabilities, last synced date to 2026-04-08
  - Capability Coverage Map: Expanded from 14 to 17 rows with new EKG capabilities and sprint week assignments
  - Interface Contracts: Added 7 new contracts (EKG pillar JSON5 schema, Data Scavenger I/O, Experience Link format, Manager capability tag schema, cross-domain conflict resolution protocol, industry ontology template format, updated workspace convention)
  - Week 2 Person A: Workspace creation now includes `ekg/` directory
  - Week 2 Person B: Added EKG pillar JSON5 schema design task, 2 industry ontology template tasks, Creator Agent Phase 2 now creates `ekg/` and merges industry ontology
  - Week 3 Person B: Added Data Scavenger Agent workspace build, Q&A Completion skill design, Experience Link extraction skill design
  - Week 3 Person D: Added bootstrap hook extension to load `ekg/` files into agent context
  - Week 4 Person B: Added Data Scavenger + Knowledge Curator integration tests, Experience Link implementation, Manager capability abstraction (Mechanism 1), pre-deployment test runner now includes `ekg/` files in auto-tune
  - Week 4 Person C: Knowledge Manager UI now includes EKG upload/browse
  - Week 5 Person B: Added Manager cross-domain conflict detection skill (Mechanism 2), reverse-injection training skill (Mechanism 3), 3rd industry ontology template (healthcare)
  - Week 6 Person B: Added E2E tests for full EKG pipeline and Manager EKG aggregation
  - Week 8 All: Updated demo scenarios from 3 to 5 (added EKG data flow demo and Manager training demo)
  - Integration Checkpoints: Updated IC-2 through IC-8 to include EKG verification steps
  - Risk Mitigation: Added 5 new EKG-specific risks (misclassification, false experience patterns, false conflict positives, ontology mismatch, JSON5 file growth)
  - Capability-to-README Traceability: Updated all 17 capabilities with correct README section references
  - All capability number references updated throughout (old #11-14 → new #14-16)

- `docs/MEMORY.md` — This entry

**What's left (implementation, not yet started):**
- Design and implement the EKG pillar JSON5 schema (`sentura/config/ekg-schema.json5`)
- Build industry ontology templates (financial-services, e-commerce, healthcare)
- Build Data Scavenger Agent workspace and skills
- Build Q&A-based Completion and Experience Link extraction skills
- Extend bootstrap hook to load `ekg/` files
- Build Manager EKG mechanisms (capability abstraction, conflict detection, reverse injection)
- Dashboard UI for EKG browsing and document upload
