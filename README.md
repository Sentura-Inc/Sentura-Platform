# Sentura Platform — Enterprise AI Employee Platform on OpenClaw

> **Slim overview.** For the full design (architecture, EKG, memory, safety, orchestration, deployment, etc.) see [`docs/DESIGN.md`](docs/DESIGN.md). For the 8-week sprint plan see [`docs/TeamPlan.md`](docs/TeamPlan.md). For testing see [`docs/TESTS.md`](docs/TESTS.md).

## Executive Summary

Sentura is an **enterprise AI employee platform** built on top of [OpenClaw](https://github.com/openclaw/openclaw). It transforms OpenClaw — an open-source multi-channel AI assistant runtime — into a **managed workforce of specialized AI employees** that enterprises can create, configure, deploy, and manage without writing code.

Each AI employee is an **OpenClaw agent instance** with its own skills, tools, instructions, safety guardrails, HITL approval workflows, long-term memory, and channel bindings. Employees communicate across **22+ messaging platforms** (Slack, MS Teams, WhatsApp, Discord, Telegram, and more) and can autonomously integrate with enterprise systems.

**What makes Sentura unique**: when an employee needs a new capability — say, access to a CRM or an email service — it can **autonomously browse the web, register for the service, obtain API keys, and configure itself**. No code, no DevOps, no manual wiring.

### Core Mission

Turn OpenClaw agents into **mission-ready AI employees** for specific enterprise positions — by connecting enterprise data and applications, wiring internal API tools, adding position-specific skills, defining safety guardrails, and configuring identity files — all through natural language, with zero code required.

### Core Principles

- **OpenClaw at the core** — every AI employee is a configured OpenClaw agent. No custom runtime. 135 bundled extension directories, 51 provider-capable extensions, 24 channel extensions (as of OpenClaw `2026.6.2`).
- **No-code everything** — enterprise users create and manage AI employees through natural language.
- **Self-provisioning** — AI employees autonomously register for services and configure integrations using browser automation, structured skills, approval workflows, and error recovery.
- **Flexible deployment** — cloud, on-premise, or hybrid; cloud LLMs or self-hosted (Ollama / vLLM / SGLang).
- **Human-in-the-loop** — high-risk decisions always require human approval, with escalation chains and timeout policies.
- **Multi-tenancy** — per-department, per-role isolation; per-user memory partitioning.

### Platform Modes

| Mode | Purpose |
|------|---------|
| **Mode A — Single Employee** | Create and deploy a single AI employee for a specific role (Accounts Payable, Customer Support, SDR, HR, or any custom role). |
| **Mode B — Multi-Agent Orchestration** | An AI Project Manager decomposes macro-objectives and routes tasks across multiple AI employees using OpenClaw's subagent system. |

---

## What Sentura Builds (That OpenClaw Does Not Have) — 17 Capabilities

OpenClaw is a mature personal AI assistant platform providing runtime, channels, providers, tools, config, memory, and security primitives. Sentura builds the **enterprise management layer** — these 17 capabilities, verified absent from the OpenClaw codebase:

| # | Sentura Builds | Why OpenClaw Doesn't Have It |
|---|---------------|------------------------------|
| 1 | **Enterprise data integration** — CRM, ERP, contact center, database connectors built during onboarding | OpenClaw has zero enterprise connectors (no Salesforce, SAP, Zendesk, etc.) — only messaging channels and AI providers |
| 2 | **Internal MCP server generation** — an MCP Builder Agent that takes API documentation (OpenAPI specs, markdown docs, database schemas) and generates OpenClaw-compatible MCP servers with typed tool definitions | OpenClaw's `mcp.servers` config is manual JSON5; no auto-discovery, API analysis, or API-to-MCP generation |
| 3 | **Self-provisioning orchestration** — skills + approval workflows + error handling for autonomous service registration | OpenClaw has the browser tool (Playwright) but no built-in workflow for account registration or credential harvesting |
| 4 | **Position-specific safety guardrails** — `AGENTS.md` Hard Rules section, decision-context-aware approval, escalation chains | OpenClaw has generic tool denylists and binary agent-scoped exec approvals; no structured Hard Rules convention |
| 5 | **No-code employee creation** — natural language → working AI employee via Creator Agent | OpenClaw's `agents.create` takes structured config params; no NL creation flow exists |
| 6 | **Incubation pipeline** — fill workspace files, connect data layer, wire MCP tools, merge industry ontology, add position skills | OpenClaw bootstraps 8 generic workspace files; Sentura inlines Hard Rules into `AGENTS.md`, Enterprise Context into `BOOTSTRAP.md`, and adds the `ekg/` directory plus structured skills |
| 7 | **Enterprise orchestration + AI Manager EKG** — macro-objective decomposition, multi-employee coordination, capability abstraction, cross-domain conflict detection, reverse-injection training | OpenClaw has basic subagent spawning with depth limits; no task decomposition, progress tracking, or cross-agent knowledge aggregation |
| 8 | **Multi-tenancy & scope model** — platform scope can be an entire SME or a single department; tenant isolation, user-level namespacing, data segregation | OpenClaw is single-tenant (one user, one gateway, one config) |
| 9 | **Enterprise authentication** — SAML/OIDC/SSO for the dashboard | OpenClaw uses token + device pairing; no SSO |
| 10 | **Cost management** — per-employee, per-department LLM spend tracking and attribution | OpenClaw has no per-agent cost tracking |
| 11 | **Enterprise Knowledge Graph (EKG)** — per-agent structured knowledge in 4 pillars (Org, Rules, Assets, Workflows) as JSON5 files, auto-indexed by OpenClaw's memory system | OpenClaw's memory is per-agent LanceDB with unstructured text chunks; no structured knowledge schema, no ontology, no pillar organization |
| 12 | **Data Scavenger Agent** — unstructured document ingestion → 4-pillar classification → structured JSON5 output into agent `ekg/` directories | OpenClaw has no document ingestion agent, no structured output pipeline, no knowledge classification |
| 13 | **Progressive knowledge accumulation** — industry ontology templates (Tier 1), Q&A-based Completion (Tier 2 gap-filling), Experience Links (Tier 3 tacit knowledge extraction) | OpenClaw's dreaming consolidates episodic memory; no industry templates, no gap detection, no tacit knowledge extraction |
| 14 | **Employee lifecycle management** — versioning, cloning, health scoring, rollback, retirement | OpenClaw creates and runs agents; no lifecycle management |
| 15 | **Pre-deployment testing & validation** — test employees against real/mock tasks before going live, auto-tune on failure | OpenClaw has no test harness, task simulation, or pre-deployment validation pipeline |
| 16 | **Communication panel** — WhatsApp/Slack-style dashboard chat with 1:1 employee conversations and multi-agent group chat | OpenClaw's Control UI has a single-pane developer chat; no conversation list, group chat, or enterprise messaging UX |
| 17 | **Cross-agent knowledge aggregation** — AI Manager aggregates capability tags, detects cross-domain rule conflicts, generates Global SOPs, reverse-injects training into employee agents | OpenClaw agents operate in isolated workspaces; no cross-agent knowledge sharing, no conflict detection, no top-down training |

### What OpenClaw Provides (That We Leverage As-Is)

- **22+ messaging channels** (Slack, Teams, WhatsApp, Discord, Telegram, Signal, Matrix, and more)
- **51 provider-capable extensions** (OpenAI, Anthropic, Google, Ollama, vLLM, SGLang, Mistral, Groq, and more — see `docs/OPENCLAW.md §21`)
- **Agent tool system** (30+ built-in tools: browser, search, fetch, PDF, canvas, exec, cron, etc.)
- **Gateway server** with HTTP + WebSocket JSON-RPC protocol
- **Config system** with hot-patchable JSON5, Zod validation, `config.patch` RPC
- **Memory system** (LanceDB vector embeddings, dreaming/consolidation)
- **Cron scheduler** for recurring autonomous tasks
- **Plugin SDK** (`@openclaw/plugin-sdk`, monorepo package under `openclaw/packages/plugin-sdk/`) with 135 bundled extension directories and typed contracts
- **Security primitives** (tool denylists, sandbox mode, SSRF guards, path safety, audit logging)
- **Exec approval system** (`exec.approval.*`, `plugin.approval.*` RPC)
- **Subagent spawning** with depth limits and isolated sessions
- **Secret store** for encrypted credential management
- **Native apps** (macOS, iOS, Android) and Control UI (Lit web components)
- **Deployment options** (npm, Docker, Podman, Render, Kubernetes)

---

## Platform Architecture (High-Level)

```
┌───────────────────────────────────────────────────────────┐
│                  SENTURA CONTROL PLANE                    │
│  Employee Creator │ Tuner │ Orchestrator │ Dashboard      │
└──────────────────────────┬────────────────────────────────┘
                           │ manages (via WebSocket RPC)
┌──────────────────────────▼────────────────────────────────┐
│                    OPENCLAW GATEWAY                       │
│  Config RPC │ Sessions RPC │ Agent RPC │ Cron │ Plugins   │
└──────┬──────────────┬──────────────┬──────────────────────┘
       │              │              │
 ┌─────▼────┐   ┌────▼──────┐   ┌───▼─────────────────┐
 │ AI       │   │ 24        │   │ 51 PROVIDER EXTS    │
 │ EMPLOYEES│   │ CHANNELS  │   │ (cloud + self-host) │
 └──────────┘   └───────────┘   └─────────────────────┘

 MCP SERVERS (enterprise integrations: CRM │ ERP │ HRIS │ …)
 STATE LAYER (sessions │ config │ secrets │ cron │ memory)
```

For the full diagram and design principles, see [`docs/DESIGN.md` §2 Platform Architecture Overview](docs/DESIGN.md#2-platform-architecture-overview).

---

## Technology Stack — Mandatory Choices

Do NOT substitute these without explicit approval.

### Core Runtime (OpenClaw)

| Component | Technology |
|-----------|-----------|
| **Runtime** | Node.js 24 (recommended) or Node 22.19+ — ESM, TypeScript (matches OpenClaw `2026.6.2` engines) |
| **Gateway** | Hono (HTTP) + ws (WebSocket) |
| **Agent core** | `@mariozechner/pi-agent-core` |
| **Configuration** | JSON5 + Zod validation + JSON Schema |
| **State** | File-based (SQLite-vec for embeddings, JSON for sessions) |
| **Memory** | LanceDB (vector embeddings) |
| **Browser** | Playwright (for self-provisioning) |
| **MCP** | `@modelcontextprotocol/sdk` |
| **ACP** | `@agentclientprotocol/sdk` |
| **CLI** | Commander.js |
| **Build** | tsdown (ESBuild-based) |
| **Testing** | Vitest |

### Sentura Control Plane

| Component | Technology |
|-----------|-----------|
| **Dashboard** | Next.js 15 (App Router) or extend OpenClaw's Lit Control UI |
| **Styling** | Tailwind CSS + shadcn/ui (if Next.js) or CSS Modules (if Lit) |
| **State** | React Server Components / Lit Signals |
| **API** | WebSocket JSON-RPC to OpenClaw Gateway |
| **Auth** | Enterprise SSO (SAML/OIDC) + gateway token auth |

### Infrastructure

| Component | Options |
|-----------|---------|
| **Container** | Docker / Podman (production only; dev builds from source via `pnpm gateway:watch`) |
| **Orchestration** | Docker Compose (small), Kubernetes (enterprise) |
| **LLM serving** | Ollama, vLLM, SGLang (self-hosted) or cloud APIs |
| **Monitoring** | OpenClaw diagnostic bus via `openclaw/plugin-sdk/diagnostic-runtime`; optional OpenTelemetry export via upstream `diagnostics-otel` |
| **Logging** | tslog → file / stdout / external collector |

---

## Project Structure

```
Sentura-Platform/
├── openclaw/                      # OpenClaw core (pnpm monorepo, v2026.6.2)
│   ├── src/                       # Core TypeScript source (gateway, agents, config, mcp, …)
│   ├── extensions/                # 135 extension directories (channels, providers, tools, memory, diagnostics)
│   ├── packages/                  # pnpm workspace packages
│   │   ├── plugin-sdk/            # @openclaw/plugin-sdk (stable public API for extensions)
│   │   ├── memory-host-sdk/       # @openclaw/memory-host-sdk (memory engine host interface)
│   │   └── plugin-package-contract/ # @openclaw/plugin-package-contract
│   ├── apps/                      # Native companion apps (macos/, ios/, android/, shared/)
│   ├── Swabble/                   # Swift package (shared Swift surface)
│   ├── skills/                    # Bundled skills
│   └── ui/                        # Control UI (Lit web components, also a workspace package)
│
├── sentura/                       # Sentura control plane
│   ├── agents/                    # Meta-agents (each uses the 8 native workspace files)
│   │   ├── creator/               # Creator — no-code employee creation
│   │   ├── tuner/                 # Live tuning
│   │   ├── orchestrator/          # Mode B multi-agent coordination
│   │   ├── data-scavenger/        # Unstructured → 4-pillar EKG ingestion
│   │   └── mcp-builder/           # API docs → MCP server generator
│   │
│   ├── mcp-servers/               # Generated MCP servers (output of MCP Builder)
│   ├── dashboard/                 # Next.js Sentura Admin Dashboard
│   ├── extensions/                # Sentura-specific OpenClaw extensions
│   │   ├── sentura-approval/      # Enhanced HITL approval
│   │   ├── sentura-audit/         # Enterprise audit logging
│   │   ├── sentura-rbac/          # Role-based access control (7 roles)
│   │   └── sentura-provisioner/   # Self-provisioning coordinator
│   ├── hooks/
│   │   └── sentura-bootstrap/     # Injects per-user MEMORY_USER_{token}.md
│   ├── skills/                    # Sentura bundled skills (self-provisioning,
│   │                              # knowledge-curation, qa-completion,
│   │                              # experience-extraction, compliance, onboarding)
│   └── config/                    # Templates, policies, industry ontologies
│
├── workspaces/                    # AI Employee workspaces (runtime state)
│   └── {agent-id}/                # Each uses the 8 native OpenClaw files
│       ├── AGENTS.md              # includes § Hard Rules (Sentura safety boundary)
│       ├── SOUL.md  TOOLS.md  IDENTITY.md  USER.md  HEARTBEAT.md
│       ├── BOOTSTRAP.md           # includes § Enterprise Context
│       ├── MEMORY.md
│       ├── skills/                # Structured SKILL.md files
│       ├── memory/users/          # Per-user MEMORY_USER_{token}.md
│       └── ekg/                   # 4 pillars: org/ rules/ assets/ workflows/
│
├── scripts/
│   ├── sentura-setup.sh           # macOS / Linux / WSL2 setup
│   └── sentura-setup.ps1          # Windows PowerShell setup
├── docs/
│   ├── DESIGN.md                  # Deep technical design (read on demand)
│   ├── MEMORY.md                  # Development session log
│   ├── TeamPlan.md                # 8-week sprint plan + task breakdown
│   ├── TESTS.md                   # Test matrix (detail under docs/tests/)
│   ├── tests/                     # Per-person test detail (on demand)
│   ├── SETUP.md                   # Local development setup
│   ├── HOSTING.md                 # Production hosting guide
│   └── OPENCLAW.md                # OpenClaw reference (on demand)
├── Documents/
│   └── Demo.md                    # Demo scenarios (on demand)
├── ekg/                           # GradSale reference enterprise docs (on demand)
└── README.md                      # This file
```

**Workspace invariant**: Sentura agents use **exactly the 8 native OpenClaw workspace files**. Never `RULES.md`, never `CONTEXT.md`. Hard Rules live inside `AGENTS.md § Hard Rules (must not override)`; Enterprise Context lives inside `BOOTSTRAP.md § Enterprise Context`. See `.cursorrules` and [`docs/MEMORY.md`](docs/MEMORY.md).

---

## Quick Start

### 1. Cloud API (Fastest)

```bash
git clone https://github.com/sentura/Sentura-Platform.git
cd Sentura-Platform/openclaw

pnpm install && pnpm ui:build && pnpm build
pnpm openclaw onboard
# follow prompts — provide your LLM API key (OpenAI, Anthropic, etc.)

cd .. && ./scripts/sentura-setup.sh   # registers Creator, Tuner, Orchestrator, MCP Builder
cd openclaw && pnpm gateway:watch
# open the Control UI URL printed at the end
```

### 2. Local with Ollama (Privacy-First)

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.3:70b

git clone https://github.com/sentura/Sentura-Platform.git
cd Sentura-Platform/openclaw

pnpm install && pnpm ui:build && pnpm build
pnpm openclaw onboard         # choose local provider

cd .. && ./scripts/sentura-setup.sh
cd openclaw && pnpm gateway:watch
```

### 3. Development Setup

```bash
git clone https://github.com/sentura/Sentura-Platform.git
cd Sentura-Platform/openclaw

pnpm install && pnpm ui:build && pnpm build
pnpm openclaw onboard

cd .. && ./scripts/sentura-setup.sh
cd openclaw && pnpm gateway:watch

# In another terminal:
cd sentura/dashboard && pnpm dev

# OpenClaw Control UI → http://localhost:18789
# Sentura Dashboard   → http://localhost:3000
```

For production Docker: `cd openclaw && bash docker-setup.sh`. Do not create custom `docker-compose.yml` wrappers — OpenClaw manages its own infrastructure.

---

## Key Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [`outputs/resume_card.md`](outputs/resume_card.md) | Short continuation card for unfinished work: current goal, state, next 3 actions, working set, last verification | First file for continuing an unfinished task |
| [`outputs/task_handoff.md`](outputs/task_handoff.md) | Full current task handoff with decisions, commands, verification, blockers, and next steps | After `resume_card.md` points to it, or before handing off unfinished work |
| [`README.md`](README.md) | High-level overview + 17-capability map (this file) | Every session |
| [`docs/MEMORY.md`](docs/MEMORY.md) | Development session **matrix / TOC** — policy preamble, Current Ground Truth, one row per session linking to a detail file | New independent sessions; targeted lookup during continuation |
| [`docs/TeamPlan.md`](docs/TeamPlan.md) | 8-week sprint plan with per-person task breakdowns | Every session |
| [`docs/TESTS.md`](docs/TESTS.md) | Test matrix — what to test and how | When adding/changing deliverables |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Deep technical design (architecture, EKG, memory, orchestration, deployment) | On demand — when making architectural decisions |
| [`docs/OPENCLAW.md`](docs/OPENCLAW.md) | OpenClaw technical reference | On demand — when working with plugin-sdk, gateway RPC, extensions |
| [`docs/memory/person-*/week-*.md`](docs/memory/) | Per-owner, per-week session detail (prose, diffs, verification steps) | On demand — open from the matrix row |
| [`docs/memory/shared/*.md`](docs/memory/shared/) | Cross-cutting sessions (architecture pivots, workspace collapses, multi-round bug hunts) | On demand — open from the matrix row |
| [`docs/memory/sitlink/*.md`](docs/memory/sitlink/) | Sitlink / 座联互动 independent client-pilot memory | On demand — for Sitlink tasks only |
| [`docs/memory/cross-border-ecommerce/phase-2.md`](docs/memory/cross-border-ecommerce/phase-2.md) | Active Cross-border e-commerce / 跨境电商 Phase 2 memory for production persistence, customer Admin monitoring, typed store, concurrency, and durable workflows | On demand — for current 跨境电商 Phase 2 tasks |
| [`docs/memory/cross-border-ecommerce/phase-1.md`](docs/memory/cross-border-ecommerce/phase-1.md) | Historical Cross-border e-commerce / 跨境电商 Phase 1/MVP memory | On demand — for Phase 1 regression/provenance lookup only |
| [`座联互动/DESIGN.md`](座联互动/DESIGN.md) | Sitlink client-pilot design | On demand — for Sitlink tasks only |
| [`跨境电商/DESIGN.md`](跨境电商/DESIGN.md) | Mobile-accessory cross-border e-commerce shared platform, database, deployment, MCP, and cross-agent design | On demand — for 跨境电商 tasks only |
| [`跨境电商/PHASE-2.md`](跨境电商/PHASE-2.md) | Cross-border Phase 2 execution plan for production persistence, customer `admin`/`operator` levels, Admin monitoring, typed store, multi-user sessions, Lead coordinator, durable Screening/Accio workflows, and load-smoke testing | On demand — for 跨境电商 production/database/concurrency/customer-permission tasks only |
| [`跨境电商/UI.md`](跨境电商/UI.md) | Cross-border ordinary-user/Admin monitoring UI design, Employee page layouts, status colors, and hidden Agent task connection contract | On demand — for 跨境电商 UI/UX tasks only |
| [`跨境电商/MARKET_ACQUISITION.md`](跨境电商/MARKET_ACQUISITION.md) | Cross-border Marketing Acquisition / Lead Discovery employee design, implementation status, and plan | On demand — for 跨境电商获客 tasks only |
| [`跨境电商/SCREENING.md`](跨境电商/SCREENING.md) | Cross-border Screening and Background employee design, evidence model, Alibaba API plan, implementation status, and plan | On demand — for 跨境电商背调 tasks only |
| [`跨境电商/MEMORY_PROCESSING.md`](跨境电商/MEMORY_PROCESSING.md) | Cross-border Accio Memory Processing employee design, fixture/upload workflow, memory policy, implementation status, and plan | On demand — for 跨境电商记忆处理 tasks only |
| [`docs/SETUP.md`](docs/SETUP.md) | Local development setup (cross-platform) | When setting up a dev environment |
| [`docs/HOSTING.md`](docs/HOSTING.md) | Production hosting, topology, security analysis | When deploying to production |
| [`docs/tests/tests-cross-border-phase2.md`](docs/tests/tests-cross-border-phase2.md) | Active Cross-border e-commerce / 跨境电商 Phase 2 detailed test cases (CE17+) | When running or updating CBE Phase 2 tests |
| [`docs/tests/*`](docs/tests/) | Detailed per-person, cross-team, and independent-client test cases; `tests-cross-border-ecommerce.md` remains CBE Phase 1/MVP regression history | When running or updating tests |
| [`Documents/Demo.md`](Documents/Demo.md) | Demo scenarios and workflows | When designing demo flows |
| [`ekg/*`](ekg/) | GradSale reference enterprise docs | When building MCP servers or integration skills |

> **Contributors**: update `docs/TESTS.md` whenever you add, change, or remove testable deliverables. See `.cursorrules` rule 3.

> **Deploying a new meta-agent or sandboxed employee?** The `non-main` sandbox applies a **second** tool-policy filter after the agent-level one — plugin tools (`sentura_*`, `memory_*`, `update_plan`, `web_fetch`, `pdf`, `canvas`, `cron`, channels) disappear from the dashboard `chat.send` path unless you also set `tools.sandbox.tools.alsoAllow` in the agent config. The CLI will still show the full toolset, so don't trust CLI-only verification. See [`docs/SETUP.md` § "Sandbox tool-policy filter"](docs/SETUP.md) and [`docs/OPENCLAW.md` § "Sandbox tool-policy filter (dashboard vs CLI divergence)"](docs/OPENCLAW.md).
