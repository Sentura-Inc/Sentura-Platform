# Sentura Platform — Detailed Technical Design Document

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Architecture Overview](#2-platform-architecture-overview)
3. [AI Employee Model — OpenClaw-Based](#3-ai-employee-model--openclaw-based)
4. [No-Code Employee Creation](#4-no-code-employee-creation)
5. [Self-Provisioning & Autonomous Tool Setup](#5-self-provisioning--autonomous-tool-setup)
6. [Enterprise Knowledge Integration](#6-enterprise-knowledge-integration)
7. [Communication & Channels](#7-communication--channels)
8. [LLM Abstraction — 40+ Providers](#8-llm-abstraction--40-providers)
9. [Safety, Guardrails & Human-in-the-Loop](#9-safety-guardrails--human-in-the-loop)
10. [Memory Architecture](#10-memory-architecture)
11. [Observability & Traceability](#11-observability--traceability)
12. [Multi-Agent Orchestration](#12-multi-agent-orchestration)
13. [Natural Language Configuration & Live Tuning](#13-natural-language-configuration--live-tuning)
14. [Integration Layer — MCP & OpenClaw Extensions](#14-integration-layer--mcp--openclaw-extensions)
15. [Security Model](#15-security-model)
16. [Deployment Options](#16-deployment-options)
17. [Sentura Control Plane](#17-sentura-control-plane)
18. [Technology Stack](#18-technology-stack)
19. [Project Structure](#19-project-structure)
20. [Development Roadmap](#20-development-roadmap)

---

## 1. Executive Summary

Sentura is an **enterprise AI employee platform** built on top of [OpenClaw](https://github.com/openclaw/openclaw). It transforms OpenClaw — an open-source multi-channel AI assistant — into a **managed workforce of specialized AI employees** that enterprises can create, configure, deploy, and manage without writing a single line of code.

Each AI employee is an **OpenClaw agent instance** with its own specialized skills, tools, instructions, safety guardrails, human-in-the-loop approval workflows, long-term memory, and channel bindings. Employees communicate with human colleagues through **22+ messaging platforms** (Slack, Microsoft Teams, WhatsApp, Discord, Telegram, and more) and can autonomously integrate with enterprise systems.

**What makes Sentura unique**: when an AI employee needs a new capability — say, access to a CRM or an email service — it can **autonomously browse the web, register for the service, obtain API keys, and configure itself** without human intervention. No code, no DevOps, no manual configuration.

### Core Mission

Turn OpenClaw agents into **mission-ready AI employees** for specific enterprise positions — by connecting enterprise data and applications, wiring internal API tools, adding position-specific skills, defining safety guardrails, and configuring identity files — all through natural language, with zero code required.

### What Sentura Builds (That OpenClaw Does Not Have)

OpenClaw is a mature personal AI assistant platform. It provides the runtime, channels, providers, tools, config system, memory, and security primitives. Sentura builds the **enterprise management layer** on top — specifically these 13 capabilities verified absent from the OpenClaw codebase:

| # | Sentura Builds | Why OpenClaw Doesn't Have It |
|---|---------------|------------------------------|
| 1 | **Enterprise data integration** — CRM, ERP, contact center, database connectors built during onboarding | OpenClaw has zero enterprise connectors (no Salesforce, SAP, Zendesk, etc.) — only messaging channels and AI providers |
| 2 | **Internal MCP server generation** — organize enterprise API endpoints into MCP tools and wire them to employees | OpenClaw's `mcp.servers` config is manual JSON5; no auto-discovery or API-to-MCP generation |
| 3 | **Self-provisioning orchestration** — skills + approval workflows + error handling for autonomous service registration | OpenClaw has the browser tool (Playwright) but no built-in workflow for account registration or credential harvesting |
| 4 | **Position-specific safety guardrails** — RULES.md, decision-context-aware approval, escalation chains | OpenClaw has generic tool denylists and binary agent-scoped exec approvals; no `RULES.md` in its workspace files |
| 5 | **No-code employee creation** — natural language → working AI employee via Creator Agent | OpenClaw's `agents.create` takes structured config params; no NL creation flow exists |
| 6 | **Incubation pipeline** — fill workspace files, connect data layer, wire MCP tools, add position skills | OpenClaw bootstraps 8 generic workspace files; Sentura adds RULES.md, CONTEXT.md, and structured skills |
| 7 | **Enterprise orchestration** — macro-objective decomposition, multi-employee task coordination | OpenClaw has basic subagent spawning with depth limits; no task decomposition or progress tracking |
| 8 | **Multi-tenancy** — tenant isolation, per-department namespacing, data segregation | OpenClaw is single-tenant (one user, one gateway, one config) |
| 9 | **Enterprise authentication** — SAML/OIDC/SSO for the dashboard | OpenClaw uses token + device pairing; no SSO |
| 10 | **Cost management** — per-employee, per-department LLM spend tracking and attribution | OpenClaw has no per-agent cost tracking |
| 11 | **Knowledge ingestion pipeline** — enterprise documents → SKILL.md distribution across employees | OpenClaw's memory is per-agent LanceDB; no document ingestion or cross-employee knowledge distribution |
| 12 | **Employee lifecycle management** — versioning, cloning, health scoring, rollback, retirement | OpenClaw creates and runs agents; no lifecycle management |
| 13 | **Pre-deployment testing & validation** — test employees against real/mock tasks before going live, auto-tune on failure | OpenClaw has no test harness, task simulation, or pre-deployment validation pipeline |

### What OpenClaw Provides (That We Leverage As-Is)

These are mature, battle-tested, and require no Sentura reimplementation:

- **22+ messaging channels** (Slack, Teams, WhatsApp, Discord, Telegram, Signal, Matrix, and more)
- **40+ AI provider integrations** (OpenAI, Anthropic, Google, Ollama, vLLM, and more)
- **Agent tool system** (30+ built-in tools: browser, search, fetch, PDF, canvas, exec, cron, etc.)
- **Gateway server** with HTTP + WebSocket JSON-RPC protocol
- **Config system** with hot-patchable JSON5, Zod validation, `config.patch` RPC
- **Memory system** (LanceDB vector embeddings, dreaming/consolidation)
- **Cron scheduler** for recurring autonomous tasks
- **Plugin SDK** with 86 bundled extensions and typed contracts
- **Security primitives** (tool denylists, sandbox mode, SSRF guards, path safety, audit logging)
- **Exec approval system** (`exec.approval.*`, `plugin.approval.*` RPC)
- **Subagent spawning** with depth limits and isolated sessions
- **Secret store** for encrypted credential management
- **Native apps** (macOS, iOS, Android) and Control UI (Lit web components)
- **Deployment options** (npm, Docker, Podman, Render, Kubernetes)

### Core Principles

- **OpenClaw at the Core**: Every AI employee is a configured OpenClaw agent. No custom runtime — we stand on the shoulders of a battle-tested, open-source, MIT-licensed platform with 86 extensions, 40+ AI providers, and 22+ channels.
- **No-Code Everything**: Enterprise users create and manage AI employees through natural language. Describe a role → get a working AI employee.
- **Self-Provisioning**: AI employees autonomously register for services, obtain credentials, and configure integrations using browser automation, structured skills, approval workflows, and error recovery.
- **Flexible Deployment**: Run in the cloud, install on-premise, or hybrid. Use API keys for LLMs or self-host with Ollama/vLLM.
- **Human-in-the-Loop**: High-risk decisions always require human approval. Sentura extends OpenClaw's generic exec approval into position-aware, decision-context-aware HITL with escalation chains and timeout policies.
- **Enterprise-Grade Multi-Tenancy**: Multiple departments, teams, and roles — each with isolated AI employees, permissions, and audit trails.

### Platform Modes

| Mode | Purpose |
|------|---------|
| **Mode A** — Single Employee Deployment | Create and deploy a single AI employee for a specific role (Accounts Payable, Customer Support, SDR, HR, or any custom role) |
| **Mode B** — Multi-Agent Orchestration | An AI Project Manager decomposes macro-objectives and routes tasks across multiple AI employees using OpenClaw's subagent system |

### Deployment Flexibility

```
┌─────────────────────────────────────────────────────────────┐
│                   DEPLOYMENT OPTIONS                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   CLOUD      │  │  ON-PREMISE  │  │   HYBRID         │   │
│  │              │  │              │  │                  │   │
│  │  Docker on   │  │  Bare metal  │  │  Cloud control   │   │
│  │  AWS/GCP/    │  │  or Docker   │  │  plane +         │   │
│  │  Azure/      │  │  behind      │  │  on-prem LLMs    │   │
│  │  Render/     │  │  enterprise  │  │  & data stores   │   │
│  │  Railway     │  │  firewall    │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                             │
│  LLM Options:                                               │
│  • Cloud API keys (OpenAI, Anthropic, Google, 40+ more)     │
│  • Self-hosted (Ollama, vLLM, SGLang on your GPUs)          │
│  • Mix: fast cloud models for simple tasks, local for       │
│    sensitive data                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Platform Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          SENTURA PLATFORM                                 │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    SENTURA CONTROL PLANE                            │  │
│  │   Employee Creator │ Tuning Agent │ Orchestrator │ Admin Dashboard  │  │
│  └────────────────────────────┬────────────────────────────────────────┘  │
│                               │ manages                                   │
│  ┌────────────────────────────▼────────────────────────────────────────┐  │
│  │                     OPENCLAW GATEWAY                                │  │
│  │   HTTP + WebSocket │ Config RPC │ Session RPC │ Agent RPC           │  │
│  │   Plugin Registry  │ Cron Scheduler │ MCP Loopback                  │  │
│  └─────────┬──────────────────┬──────────────────┬─────────────────────┘  │
│            │                  │                  │                        │
│  ┌─────────▼──────┐ ┌────────▼───────┐ ┌───────▼───────────────────┐      │
│  │  AI EMPLOYEES  │ │  22+ CHANNELS  │ │  40+ LLM PROVIDERS        │      │
│  │                │ │                │ │                           │      │
│  │ ┌────────────┐ │ │ Slack          │ │ OpenAI    │ Ollama        │      │
│  │ │ AP Clerk   │ │ │ MS Teams       │ │ Anthropic │ vLLM          │      │
│  │ │ Skills +   │ │ │ WhatsApp       │ │ Google    │ SGLang        │      │
│  │ │ Tools +    │ │ │ Discord        │ │ Mistral   │ DeepSeek      │      │
│  │ │ Guardrails │ │ │ Telegram       │ │ Groq      │ OpenRouter    │      │
│  │ └────────────┘ │ │ Signal         │ │ xAI       │ LiteLLM       │      │
│  │ ┌────────────┐ │ │ Matrix         │ │ Together  │ HuggingFace   │      │
│  │ │ CS Agent   │ │ │ IRC            │ │ Bedrock   │ +30 more      │      │
│  │ │ Skills +   │ │ │ Google Chat    │ │           │               │      │
│  │ │ Tools +    │ │ │ WebChat        │ └───────────┴───────────────┘      │
│  │ │ Guardrails │ │ │ +13 more       │                                    │
│  │ └────────────┘ │ └────────────────┘                                    │
│  │ ┌────────────┐ │                                                       │
│  │ │ SDR Agent  │ │ ┌──────────────────────────────────────────────┐      │
│  │ │ Skills +   │ │ │  MCP SERVERS (Enterprise Integrations)       │      │
│  │ │ Tools +    │ │ │  CRM │ ERP │ HRIS │ Ticketing │ Email │ ...  │      │
│  │ │ Guardrails │ │ └──────────────────────────────────────────────┘      │
│  │ └────────────┘ │                                                       │
│  └────────────────┘ ┌──────────────────────────────────────────────┐      │
│                     │  STATE LAYER                                 │      │
│                     │  Sessions │ Config │ Secrets │ Cron │ Memory │      │
│                     └──────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **OpenClaw is the runtime** — Sentura is a management layer on top of OpenClaw, not a replacement. Every AI employee is a configured OpenClaw agent.
2. **Plugin-first** — New capabilities come from OpenClaw extensions (channels, providers, tools) and MCP servers. No monolithic code.
3. **Config-driven** — AI employees are defined by JSON5 configuration, skills (SKILL.md files), and natural language instructions — not code.
4. **Self-provisioning** — AI employees use OpenClaw's browser tool to autonomously register for external services, obtain API keys, and store them in OpenClaw's secret manager.
5. **Deployment-agnostic** — Same platform runs in the cloud, on-premise, or a hybrid of both. LLMs can be cloud APIs or self-hosted.

---

## 3. AI Employee Model — OpenClaw-Based

### What Is an AI Employee?

An AI employee is an **OpenClaw agent configuration** — a bundle of:

| Component | OpenClaw Primitive | Purpose |
|-----------|-------------------|---------|
| **Identity** | Agent `id` + workspace files (SOUL.md, AGENTS.md) | Who the employee is, their role, personality, boundaries |
| **Skills** | `SKILL.md` files in agent workspace | Domain knowledge and procedural expertise |
| **Tools** | OpenClaw tools + MCP servers + plugin tools | What the employee can do (browse, search, file I/O, APIs) |
| **Channels** | Channel bindings (`bindings` config) | Where the employee communicates (Slack, Teams, etc.) |
| **Model** | Provider + model config | Which LLM powers the employee's reasoning |
| **Memory** | OpenClaw memory system (LanceDB) | Long-term recall of conversations and facts |
| **Guardrails** | Approval workflows + tool policies | Safety boundaries and HITL triggers |
| **Schedule** | Cron jobs | Recurring tasks the employee performs autonomously |
| **Integrations** | MCP servers + self-provisioned API keys | External systems the employee connects to |

### Agent Configuration Anatomy

Each AI employee maps to an entry in the `agents.list` array in the OpenClaw gateway config (`~/.openclaw/openclaw.json`). Identity comes from workspace files (SOUL.md, AGENTS.md), not a `systemPrompt` field. Bindings and MCP servers are top-level config:

```json5
{
  agents: {
    list: [
      {
        id: "ap-clerk-finance",
        name: "AP Clerk",
        model: "openai/gpt-4o",
        // No workspace — defaults to ~/.openclaw/workspace/ap-clerk-finance
        // No systemPrompt — identity from SOUL.md and AGENTS.md
        runtime: { type: "embedded" },
        sandbox: { mode: "non-main" },
        tools: {
          profile: "minimal",
          alsoAllow: ["web_search", "web_fetch", "pdf", "canvas", "cron", "message"],
          deny: ["exec", "gateway"],
        },
      }
    ]
  },
  // Bindings are top-level — route channel messages to agents
  bindings: [
    {
      agentId: "ap-clerk-finance",
      match: { channel: "slack", accountId: "acme-workspace", peer: { kind: "channel", id: "#accounts-payable" } },
    },
    {
      agentId: "ap-clerk-finance",
      match: { channel: "msteams", accountId: "acme-tenant", peer: { kind: "channel", id: "finance-general" } },
    }
  ],
}
```

### Agent Workspace Structure

Each AI employee has a dedicated workspace directory. OpenClaw provides 8 default bootstrap files; Sentura adds enterprise-specific files on top:

```
workspaces/ap-clerk-finance/
│
│ — OpenClaw Default Workspace Files (8) ——
├── AGENTS.md            # Multi-agent routing (OpenClaw default)
├── SOUL.md              # Core identity, personality (OpenClaw default)
├── TOOLS.md             # Tool documentation (OpenClaw default)
├── IDENTITY.md          # Agent identity descriptor (OpenClaw default)
├── USER.md              # User context / preferences (OpenClaw default)
├── HEARTBEAT.md         # Cron heartbeat instructions (OpenClaw default)
├── BOOTSTRAP.md         # Agent bootstrap instructions (OpenClaw default)
├── MEMORY.md            # Memory notes / scratchpad (OpenClaw default)
│
│ — Sentura Enterprise Additions ——
├── RULES.md             # Hard boundaries — Sentura-specific, not in OpenClaw
├── CONTEXT.md           # Enterprise-specific context (org structure, policies)
├── skills/              # Structured position-specific skills
│   ├── invoice-processing/
│   │   └── SKILL.md
│   ├── vendor-management/
│   │   └── SKILL.md
│   └── compliance-checks/
│       └── SKILL.md
├── mcp-servers/         # Self-provisioned MCP server configs
└── data/                # Working data (templates, references)
```

> **Important distinction**: OpenClaw's `AGENTS.md` defines multi-agent routing rules; `SOUL.md` defines personality; `TOOLS.md` documents available tools; `IDENTITY.md` provides agent identity; `USER.md` captures user context; `HEARTBEAT.md` gives cron-invoked instructions; `BOOTSTRAP.md` provides initial setup instructions; `MEMORY.md` serves as a scratchpad. **Sentura adds `RULES.md`** (hard safety boundaries per position — this file does not exist in OpenClaw's workspace system) **and `CONTEXT.md`** (enterprise-specific context like org structure, policies, system inventory).

### SOUL.md — Employee Identity

```markdown
# AP Clerk — Acme Corp Finance Department

## Identity
You are the Accounts Payable clerk for Acme Corp's finance department. You
process invoices, manage vendor payments, flag anomalies, and ensure compliance
with Acme's financial policies.

## Personality
- Professional but approachable
- Detail-oriented — always double-check numbers
- Proactive — flag potential issues before they become problems

## Escalation
- Any invoice > $50,000 → escalate to CFO
- Any new vendor → escalate to Finance Manager
- Any compliance concern → escalate immediately with detailed report
```

### SKILL.md — Domain Knowledge

```markdown
# Invoice Processing

## When to Use
When you receive an invoice (PDF, image, or forwarded email) from any channel.

## Procedure
1. Extract key fields: vendor name, invoice number, amount, due date, line items
2. Cross-reference vendor against approved vendor list (check ERP via MCP)
3. Validate amount against purchase order if referenced
4. Check for duplicates in recent 90-day history
5. If amount exceeds $50,000 or vendor is new, request human approval
6. If all checks pass, submit for payment via ERP integration
7. Notify the requester with a summary

## Tools Needed
- `pdf` — extract text from PDF invoices
- `web_fetch` — access ERP API via MCP server
- `browser` — look up vendor information if needed
- `message` — notify stakeholders

## Safety
- NEVER approve payment without matching PO for amounts > $10,000
- ALWAYS flag invoices from unrecognized vendors
- Request human approval for any payment to a new bank account
```

---

## 4. No-Code Employee Creation

### The Incubation Flow

Enterprise users create AI employees through **natural language conversation** with the Sentura Creator Agent — no code, no configuration files, no technical knowledge required.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  User tells  │     │  Creator Agent   │     │  Test against    │     │  AI Employee     │
│  Sentura what│────▶│  builds config,  │────▶│  real/mock tasks │────▶│  is live and     │
│  they need   │     │  skills, rules   │     │  auto-tune if    │     │  mission-ready   │
│              │     │  & provisions    │     │  any fail        │     │                  │
└──────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Creator Agent — The Incubation Engine

The Creator Agent is itself an OpenClaw agent (the "meta-agent") that takes a natural language job description and produces a fully configured AI employee. It operates in five phases:

#### Phase 1: Research & Discovery

```
User: "I need an AI employee that handles customer support tickets from
       our Zendesk, responds on Slack, and escalates billing issues to
       the finance team."

Creator Agent:
  1. Asks clarifying questions about the role
  2. Discovers enterprise context from existing employees' knowledge
  3. Searches the web for best practices in customer support automation
  4. Identifies required integrations: Zendesk, Slack, billing system
```

The Creator Agent uses OpenClaw's built-in tools:
- `web_search` — research best practices and find relevant templates
- `web_fetch` — read documentation for required integrations
- `browser` — explore enterprise systems to understand their APIs
- `sessions_history` — learn from existing AI employees' configurations

#### Phase 2: Design & Configuration

The Creator Agent produces:

1. **Agent config** — model selection, tool allowlist, channel bindings
2. **SOUL.md** — identity, personality, values
3. **AGENTS.md** — role definition, responsibilities
4. **RULES.md** — hard boundaries and compliance rules
5. **SKILL.md files** — one per capability (ticket triage, escalation, billing inquiry, etc.)
6. **MCP server list** — which enterprise integrations are needed
7. **Approval workflow** — which actions require human approval

#### Phase 3: Self-Provisioning

If the new employee needs integrations that don't have credentials yet, the Creator Agent (or the employee itself) autonomously provisions them using browser automation (see Section 5).

#### Phase 4: Pre-Deployment Testing & Validation

Before an employee goes live, the Creator Agent runs it through a structured **test battery** to verify it can handle real work from day one. An employee that passes testing is "mission-ready" — an employee that fails gets auto-tuned and re-tested until it passes.

**Test case sources** (in priority order):

1. **Historical enterprise records** — real past tasks from the company's data layer (e.g., past support tickets from the ticketing system, past invoices from the ERP, past disputes from the admin panel). These are the gold standard because they reflect actual business scenarios with known correct outcomes.
2. **Generated mock tasks** — when historical data is insufficient, the Creator Agent generates realistic task scenarios from the enterprise's data and application layer (e.g., synthesize a support ticket based on the database schema and API capabilities, create a mock invoice matching the company's vendor and amount patterns).
3. **Role template test suites** — pre-built test cases bundled with each role template (e.g., the AP Clerk template includes 10 standard invoice scenarios).

**Testing flow**:

```
┌───────────────┐     ┌────────────────────┐     ┌─────────────────┐
│ Gather test   │     │ Run employee in    │     │ Score results   │
│ cases from    │────▶│ sandbox mode       │────▶│ against expected│
│ data layer    │     │ against each case  │     │ outcomes        │
└───────────────┘     └────────────────────┘     └───────┬─────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │ All tests pass?     │
                                              │                     │
                                              │ Yes → Phase 5       │
                                              │       (Deploy)      │
                                              │                     │
                                              │ No  → Diagnose      │
                                              │   → Auto-tune       │
                                              │     (skills, rules, │
                                              │      prompts, tools)│
                                              │   → Re-test         │
                                              └─────────────────────┘
```

**What gets tested**:

| Test Dimension | What It Validates | Example |
|---------------|-------------------|---------|
| **Task completion** | Can the employee finish the task end-to-end? | Process an invoice from PDF extraction to ERP submission |
| **Tool usage** | Does it use the right MCP tools correctly? | Calls the correct API endpoint with valid parameters |
| **Safety compliance** | Does it respect RULES.md boundaries? | Refuses to approve a payment above the threshold |
| **Escalation judgment** | Does it escalate when appropriate? | Routes a flagged dispute to a human instead of auto-resolving |
| **Tone & communication** | Does the response match SOUL.md personality? | Professional but approachable, not robotic |
| **Error handling** | Does it recover gracefully from tool failures? | Retries or escalates when an API call fails |

**Auto-tuning on failure**: When an employee fails a test case, the Creator Agent diagnoses the root cause and applies targeted fixes:

- **Wrong tool usage** → adjust SKILL.md procedure steps or tool allowlist
- **Safety violation** → strengthen RULES.md with the specific boundary that was crossed
- **Missed escalation** → add escalation trigger to the relevant skill's Safety section
- **Poor tone** → refine SOUL.md personality directives
- **Missing knowledge** → add a new SKILL.md or update CONTEXT.md

The test-tune-retest loop runs until all test cases pass or a maximum iteration count is reached (at which point the employee is flagged for human review before deployment).

#### Phase 5: Deploy & Go Live

1. Write workspace files (SOUL.md, skills, etc.) to the agent's workspace directory
2. Register the agent in OpenClaw's config via `config.patch` gateway RPC
3. Bind the agent to the specified channels
4. Mark the employee as "live" with test results attached
5. Notify the creator that the employee is live, including the test scorecard

### Incubation Memory

The Creator Agent maintains a persistent record of every incubation it performs. This allows:

- **Template reuse**: If a similar role was created before, start from that template
- **Learning from failures**: If a previous employee had issues, the Creator Agent avoids the same mistakes
- **Enterprise pattern library**: Over time, the enterprise accumulates a library of proven role templates

This memory is stored in the Creator Agent's own OpenClaw memory system (LanceDB), making it searchable by semantic similarity.

### Reflection Loop

After deployment, the Creator Agent monitors the new employee's first interactions:

```
┌─────────────┐      ┌─────────────┐      ┌────────────┐
│ New Employee│─────▶│ Handle First│─────▶│ Creator    │
│ Deployed    │      │ Interactions│      │ Reviews    │
└─────────────┘      └─────────────┘      └──────┬─────┘
                                                │
                                    ┌───────────▼──────────┐
                                    │ Issues found?        │
                                    │ Yes → Adjust config, │
                                    │       skills, rules  │
                                    │ No  → Mark stable    │
                                    └──────────────────────┘
```

The Creator Agent can read the new employee's session transcripts via `sessions_history` and `sessions_transcript`, identify issues (wrong tone, missed edge cases, tool failures), and patch the employee's configuration or skills in real-time via `config.patch`.

---

## 5. Self-Provisioning & Autonomous Tool Setup

### The Core Innovation

Traditional enterprise AI requires manual integration: a developer writes API connectors, an admin provisions credentials, a DevOps engineer deploys the connector. Sentura eliminates this entire workflow.

> **What OpenClaw provides**: The browser tool (Playwright-based) for web automation, the encrypted secret store for credential management, and `config.patch` RPC for runtime configuration changes. **What Sentura builds**: The self-provisioning *system* — structured SKILL.md procedures, approval integration, error recovery, audit logging, and the orchestration layer that turns raw browser + secrets primitives into a reliable autonomous provisioning pipeline.

When an AI employee needs a tool or service it doesn't yet have access to, the Sentura self-provisioning system:

1. Detects the missing capability (via skill procedure or Creator Agent)
2. Checks for existing credentials in the secret store
3. Determines if approval is needed (new accounts, paid services → HITL)
4. Executes the provisioning skill (browser automation for registration)
5. Handles errors gracefully (CAPTCHA, 2FA, rate limits → escalate to human)
6. Stores credentials in OpenClaw's encrypted secret store
7. Configures the MCP server or tool via `config.patch`
8. Verifies the connection with a test call
9. Logs the entire provisioning event for enterprise audit

### Self-Provisioning Flow

```
┌────────────────┐
│ AI Employee    │
│ needs Zendesk  │
│ access         │
└───────┬────────┘
        │
        ▼
┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Check: do we   │ No  │ Browser: go to   │     │ Browser: create  │
│ have Zendesk   │────▶│ zendesk.com      │────▶│ account with     │
│ credentials?   │     │                  │     │ enterprise email │
└───────┬────────┘     └──────────────────┘     └───────┬──────────┘
        │ Yes                                           │
        │                                               ▼
        │                                  ┌──────────────────────┐
        │                                  │ Browser: navigate to │
        │                                  │ API settings, create │
        │                                  │ API key              │
        │                                  └───────┬──────────────┘
        │                                          │
        │                                          ▼
        │                                  ┌──────────────────────┐
        │                                  │ Store credentials in │
        │                                  │ OpenClaw secrets     │
        │                                  └───────┬──────────────┘
        │                                          │
        ▼                                          ▼
┌────────────────────────────────────────────────────────┐
│ Configure MCP server with credentials                  │
│ Add to agent's mcp.servers config via config.patch     │
│ Verify connection with a test API call                 │
└────────────────────────────────────────────────────────┘
```

### Implementation Details

The self-provisioning capability leverages OpenClaw's existing tools:

**Browser tool** (`extensions/browser/` — Playwright):
```json5
// The AI employee uses the browser tool like a human would
{
  tool: "browser",
  action: "navigate",
  url: "https://zendesk.com/register"
}
// Fill in registration form
{
  tool: "browser",
  action: "fill",
  selector: "#email",
  value: "ai-support@acme.com"
}
// Navigate to API settings
{
  tool: "browser",
  action: "navigate",
  url: "https://acme.zendesk.com/admin/apps-integrations/apis/zendesk-api"
}
// Extract the API key from the page
{
  tool: "browser",
  action: "extract",
  selector: ".api-key-value"
}
```

**Secret storage** — credentials are stored in OpenClaw's encrypted secret store:
```json5
// Stored via gateway RPC or secrets CLI
{
  secrets: {
    "zendesk_api_key": { source: "env", provider: "zendesk", id: "api_key" }
  }
}
```

**MCP server configuration** — the new integration is registered:
```json5
// Added to config.json5 → mcp.servers
{
  mcp: {
    servers: {
      "zendesk": {
        command: "npx",
        args: ["-y", "@mcp-servers/zendesk"],
        env: {
          ZENDESK_API_KEY: { $secret: "zendesk_api_key" },
          ZENDESK_SUBDOMAIN: "acme"
        }
      }
    }
  }
}
```

### Human Approval for Sensitive Provisioning

Self-provisioning respects the approval workflow. When the AI employee attempts to:
- Create accounts on new services → **approval required** (routed through OpenClaw's `exec.approval` system)
- Spend money (paid API plans) → **approval required**
- Access sensitive enterprise systems → **approval required**
- Register with a service already in the approved list → **auto-approved**

```json5
// Approval policy for self-provisioning
{
  approvals: {
    selfProvisioning: {
      requireApproval: ["new_account", "paid_service", "sensitive_system"],
      autoApprove: ["approved_service_list"],
      notifyOn: ["all"],
      approvers: ["it-admin", "department-head"]
    }
  }
}
```

### Self-Provisioning Skill

The self-provisioning capability is itself a skill loaded into every AI employee:

```markdown
# Self-Provisioning

## When to Use
When you need access to an external service or API that you don't currently
have credentials for, and the task requires it.

## Procedure
1. Check if credentials already exist in secrets store
2. If not, check if the service is on the approved auto-provision list
3. If approval needed, request human approval with justification
4. Once approved (or auto-approved):
   a. Use browser to navigate to the service
   b. Register using the enterprise's designated AI email
   c. Complete setup and generate API credentials
   d. Store credentials securely
   e. Configure MCP server or direct API access
   f. Verify with a test call
5. Log the provisioning event for audit

## Safety
- NEVER use personal email addresses — always use enterprise AI email
- NEVER store credentials in plaintext or in conversation
- ALWAYS request approval for paid services
- ALWAYS verify the connection works before using it in production
- Log every provisioning action for audit trail
```

---

## 6. Enterprise Knowledge Integration

### From EKG to Knowledge Skills

Instead of building a complex Enterprise Knowledge Graph engine from scratch, Sentura leverages OpenClaw's native capabilities to integrate enterprise knowledge:

| Knowledge Source | OpenClaw Integration | How It Works |
|-----------------|---------------------|--------------|
| Documents (PDF, DOCX, etc.) | `pdf` tool + memory system | AI employee reads documents, stores key facts in memory |
| Databases | MCP servers | Direct SQL/API access via MCP protocol |
| APIs (CRM, ERP, HRIS) | MCP servers (self-provisioned) | Real-time data access through typed tool calls |
| Internal wikis | `web_fetch` + `browser` tools | Crawl and index internal documentation |
| Slack/Teams history | Channel plugins | Access conversation history for context |
| File systems | `fs_*` tools (sandboxed) | Read enterprise files from shared drives |

### Knowledge Ingestion as a Skill

Enterprise knowledge ingestion is handled by a dedicated **Knowledge Curator** employee (an OpenClaw agent):

```markdown
# Knowledge Curator Skill

## Purpose
Ingest, organize, and maintain enterprise knowledge so that other AI employees
can access it efficiently.

## Procedure
1. Receive knowledge source (URL, file path, API endpoint, or description)
2. Crawl/read the source using appropriate tools
3. Extract structured information (entities, relationships, procedures)
4. Store in memory system with rich metadata tags
5. Generate or update SKILL.md files for relevant AI employees
6. Notify affected employees of new knowledge

## Tools
- `web_fetch` / `browser` — crawl web-based knowledge sources
- `pdf` — extract from PDF documents
- `fs_read` — read local files
- MCP servers — query databases and APIs
- `message` — notify other AI employees
```

### Shared Knowledge via Skills

Enterprise knowledge is distributed to AI employees as **SKILL.md files** in their workspaces. This is more robust than a centralized knowledge graph because:

1. **Each employee gets only relevant knowledge** — an AP clerk doesn't need HR policy details
2. **Knowledge is versioned** — changes to skills are tracked and can be rolled back
3. **Knowledge is testable** — skills can be validated by running test scenarios
4. **Knowledge is human-readable** — any employee (human or AI) can read and verify skill files

### Enterprise Context Document

Each AI employee receives a `CONTEXT.md` file with enterprise-specific information:

```markdown
# Enterprise Context — Acme Corp

## Company
- Name: Acme Corporation
- Industry: Manufacturing
- Size: 2,500 employees
- Headquarters: Chicago, IL

## Organization Structure
- CEO: Jane Smith
- CFO: Bob Johnson (approves invoices > $50K)
- VP Finance: Alice Chen (approves new vendors)
- IT Director: Tom Davis (manages integrations)

## Key Systems
- ERP: SAP S/4HANA (MCP: sap-erp)
- CRM: Salesforce (MCP: salesforce)
- HRIS: Workday (MCP: workday)
- Ticketing: Zendesk (MCP: zendesk)
- Communication: Slack (channel: slack), MS Teams (channel: msteams)

## Policies
- Invoice approval threshold: $10,000 (manager), $50,000 (CFO)
- New vendor onboarding: requires Finance Manager approval
- PII handling: never share outside approved systems
```

---

## 7. Communication & Channels

### 22+ Channels via OpenClaw

OpenClaw provides native support for **22+ messaging channels**, all available to Sentura AI employees:

| Channel | Extension | Enterprise Use Case |
|---------|-----------|-------------------|
| **Slack** | `slack` | Primary enterprise communication |
| **Microsoft Teams** | `msteams` | Enterprise communication (Microsoft shops) |
| **WhatsApp** | `whatsapp` | Customer-facing communication |
| **Discord** | `discord` | Community management, developer relations |
| **Telegram** | `telegram` | Quick messaging, bot interactions |
| **Google Chat** | `googlechat` | Google Workspace enterprises |
| **Signal** | `signal` | Secure/confidential communication |
| **Matrix** | `matrix` | Self-hosted secure messaging (E2EE) |
| **iMessage** | `imessage` | Executive communication |
| **IRC** | `irc` | Developer/ops teams |
| **Feishu/Lark** | `feishu` | Chinese enterprise communication |
| **LINE** | `line` | Asian market customer support |
| **Mattermost** | `mattermost` | Self-hosted enterprise chat |
| **WebChat** | Built-in | Sentura dashboard embedded chat |
| **Voice Call** | `voice-call` | Phone-based support (Twilio/Telnyx/Plivo) |
| **+7 more** | Various | Nostr, Twitch, QQ, Zalo, Synology, Nextcloud, Tlon |

### Channel Binding Architecture

AI employees are bound to specific channels and conversations via OpenClaw's `bindings` configuration:

```json5
{
  bindings: [
    {
      // AP Clerk responds in #accounts-payable on Slack
      channel: "slack",
      account: "acme-workspace",
      peers: ["#accounts-payable"],
      agent: "ap-clerk-finance",
      type: "agent"
    },
    {
      // CS Agent responds to customer WhatsApp messages
      channel: "whatsapp",
      account: "+1-555-ACME",
      agent: "cs-agent-support",
      type: "agent"
    },
    {
      // SDR Agent monitors Discord for leads
      channel: "discord",
      account: "acme-community",
      peers: ["#general", "#product-questions"],
      agent: "sdr-outbound",
      type: "agent"
    }
  ]
}
```

### Multi-Channel Employee

A single AI employee can be bound to **multiple channels simultaneously**. The AP Clerk might:
- Receive invoices via email (forwarded to Slack)
- Answer questions on MS Teams #finance-help
- Send approval requests via the Sentura WebChat dashboard
- Post daily summaries to Slack #finance-daily

OpenClaw's routing system ensures messages from each channel are routed to the correct agent, with proper session isolation per channel/peer combination.

### Inbound Message Flow

```
Human sends message on Slack #accounts-payable
  → Slack extension receives webhook
    → OpenClaw routing resolves binding → ap-clerk-finance agent
      → Agent processes message with tools, skills, memory
        → Reply pipeline formats response
          → Slack extension sends reply to #accounts-payable
```

---

## 8. LLM Abstraction — 40+ Providers

### Provider Flexibility

OpenClaw supports **40+ AI providers** out of the box. Sentura enterprises can choose any combination:

**Cloud Providers (API key-based)**:

| Provider | Extension | Best For |
|----------|-----------|----------|
| OpenAI | `openai` | GPT-4o, o3, Codex |
| Anthropic | `anthropic` | Claude Sonnet/Opus for complex reasoning |
| Google | `google` | Gemini for multimodal tasks |
| Mistral | `mistral` | European data residency |
| Groq | `groq` | Ultra-fast inference |
| DeepSeek | `deepseek` | Cost-effective reasoning |
| xAI | `xai` | Grok models |
| Together | `together` | Open model hosting |
| OpenRouter | `openrouter` | Multi-provider routing |
| Amazon Bedrock | `amazon-bedrock` | AWS-native enterprises |
| +25 more | Various | Specialized providers |

**Self-Hosted (Local Inference)**:

| Provider | Extension | Use Case |
|----------|-----------|----------|
| **Ollama** | `ollama` | Easy local setup, auto-detection |
| **vLLM** | `vllm` | High-throughput production serving |
| **SGLang** | `sglang` | Structured generation, constrained decoding |
| **LiteLLM** | `litellm` | Unified proxy for any provider |

### Per-Employee Model Configuration

Different AI employees can use different models based on their needs:

```json5
{
  agents: {
    list: [
      {
        id: "ap-clerk",
        model: "openai/gpt-4o",
        // Complex financial reasoning needs a strong model
      },
      {
        id: "faq-bot",
        model: "ollama/llama3.2",
        // Simple FAQ answering can use a local model
      },
      {
        id: "code-reviewer",
        model: "openai/o3",
        // Code review benefits from reasoning models
      }
    ]
  }
}
```

### Model Fallback & Routing

OpenClaw supports model fallback chains — if the primary provider is unavailable, automatically switch to a backup:

```json5
{
  models: {
    primary: "openai/gpt-5.2",
    fallback: ["openai/gpt-4o", "ollama/llama3.3-70b"],
    routing: {
      "simple_query": "groq/llama-3.3-70b-versatile",
      "complex_reasoning": "openai/gpt-5.2",
      "code_generation": "openai/o3"
    }
  }
}
```

---

## 9. Safety, Guardrails & Human-in-the-Loop

### Multi-Layer Safety Architecture

Sentura implements safety at every level, combining OpenClaw's built-in security primitives with enterprise-grade additions. The distinction matters:

- **OpenClaw provides** (Layers 2–3): Generic tool allowlists/denylists per agent (`DEFAULT_GATEWAY_HTTP_TOOL_DENY`), sandbox mode, binary exec approvals per agent ID, SSRF guards, path safety
- **Sentura adds** (Layers 1, 4–5): Position-specific `RULES.md` files, decision-context-aware approvals (e.g., "approve if refund < $500"), skill-level safety sections, escalation chains, timeout policies, enterprise-wide data classification, audit requirements

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: SKILL-LEVEL GUARDRAILS              [SENTURA]  │
│  Each SKILL.md has a ## Safety section with hard rules    │
│  "NEVER approve payment without matching PO > $10K"      │
├──────────────────────────────────────────────────────────┤
│  Layer 2: TOOL POLICIES                       [OPENCLAW] │
│  Tool allowlists/denylists per agent config               │
│  DEFAULT_GATEWAY_HTTP_TOOL_DENY blocks dangerous tools    │
├──────────────────────────────────────────────────────────┤
│  Layer 3: APPROVAL WORKFLOWS           [OPENCLAW+SENTURA]│
│  OpenClaw: binary exec.approval per agent ID              │
│  Sentura: decision-context approvals, escalation, timeout │
├──────────────────────────────────────────────────────────┤
│  Layer 4: RULES.md HARD BOUNDARIES            [SENTURA]  │
│  Per-employee rules that override everything else         │
│  This file does NOT exist in OpenClaw's workspace system  │
│  "You may NEVER share customer PII outside the CRM"      │
├──────────────────────────────────────────────────────────┤
│  Layer 5: PLATFORM-LEVEL POLICIES             [SENTURA]  │
│  Sentura-wide policies enforced across all employees      │
│  Data classification, retention, audit, RBAC, multi-tenant│
└──────────────────────────────────────────────────────────┘
```

### Human-in-the-Loop via OpenClaw Approvals

OpenClaw has a built-in approval system (`exec.approval` and `plugin.approval` RPC methods) that Sentura extends for enterprise HITL:

```json5
{
  approvals: {
    // Global policy: these tool categories always need approval
    requireApproval: [
      "exec",           // Shell execution
      "fs_write",       // File system writes
      "self_provision", // Creating new service accounts
      "payment",        // Any financial transaction
      "data_export"     // Exporting data outside the platform
    ],
    // Per-employee overrides
    agents: {
      "ap-clerk-finance": {
        requireApproval: ["payment_above_10000", "new_vendor"],
        autoApprove: ["read_erp", "read_crm", "send_slack_message"]
      }
    },
    // How approvals are delivered
    delivery: {
      primary: "webchat",      // Sentura dashboard
      notifications: ["slack", "msteams", "email"]
    },
    // Timeout and escalation
    timeout: "4h",
    escalation: {
      after: "2h",
      to: ["department-head", "it-admin"]
    }
  }
}
```

### Approval Flow

```
AI Employee wants to execute a high-risk action
  → OpenClaw checks approval policy
    → Action requires approval? Yes
      → Create approval request (stored in state)
      → Notify approver via Sentura dashboard (WebChat)
      → Send lightweight alert to Slack/Teams (no sensitive data)
      → Wait for approval (with timeout)
        → Approved → execute action, log result
        → Rejected → abort action, notify employee
        → Timeout → escalate to next approver
```

### RULES.md — Hard Boundaries (Sentura Innovation)

Every AI employee has a `RULES.md` file that defines absolute constraints. **This is a Sentura-specific addition** — OpenClaw's default workspace files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) do not include a dedicated rules file. Sentura's `sentura-bootstrap` hook (`~/.openclaw/hooks/sentura-bootstrap/`) injects `RULES.md` and `CONTEXT.md` into each agent's system prompt during the `agent:bootstrap` event:

```markdown
# AP Clerk — Hard Rules

## Financial Controls
- NEVER approve or process a payment above $50,000 without CFO approval
- NEVER process a payment to a bank account that changed in the last 30 days
- NEVER process duplicate invoices (same vendor + amount + date)
- ALWAYS verify vendor exists in approved vendor list before processing

## Data Protection
- NEVER share financial data outside approved channels
- NEVER include bank account numbers in Slack messages
- NEVER export vendor lists to external services
- ALWAYS redact sensitive numbers when logging

## Operational Boundaries
- NEVER modify ERP records directly — always use the ERP API via MCP
- NEVER create accounts on services not in the approved list
- ALWAYS log every financial decision with reasoning
- ALWAYS escalate if unsure — being safe is more important than being fast
```

### Tool Policy Enforcement

OpenClaw's security layer enforces tool policies at the runtime level:

```json5
{
  agents: {
    list: [
      {
        id: "ap-clerk-finance",
        tools: {
          profile: "minimal",
          alsoAllow: ["web_search", "web_fetch", "pdf", "cron", "message", "canvas"],
          deny: ["exec", "gateway"],
        },
        sandbox: { mode: "non-main" },
      }
    ]
  }
}
```

---

## 10. Memory Architecture

### OpenClaw Memory System

Each AI employee has its own long-term memory powered by OpenClaw's two-extension memory system:

**`memory-core`** — Core memory engine:
- Memory formation from conversations (what to remember, what to forget)
- QMD (Query-Memory-Decide) cycle for relevant recall
- Dreaming/consolidation cron job (periodically reorganizes memories)
- Memory scoring and relevance ranking

**`memory-lancedb`** — Vector store:
- LanceDB-based semantic search
- Embedding generation for memory entries
- Similarity search for contextual recall

### Memory Configuration Per Employee

```json5
{
  memory: {
    enabled: true,
    // Each agent gets its own memory namespace
    namespace: "ap-clerk-finance",
    // Dreaming schedule: consolidate memories nightly
    dreaming: {
      enabled: true,
      schedule: "0 2 * * *",  // 2 AM daily
    },
    // What to remember
    formation: {
      conversationFacts: true,     // Key facts from conversations
      toolResults: true,           // Results of tool calls
      approvalDecisions: true,     // Human approval outcomes
      errorPatterns: true,         // Mistakes to learn from
    }
  }
}
```

### Memory Use Cases

| Use Case | How Memory Helps |
|----------|-----------------|
| **Invoice Processing** | Remembers vendor payment patterns, flags deviations |
| **Customer Support** | Recalls previous interactions with the same customer |
| **SDR Outreach** | Tracks which leads were contacted, their responses |
| **HR Onboarding** | Remembers each new hire's onboarding progress |
| **Compliance** | Accumulates regulatory knowledge from past reviews |

### Workspace Files as Static Memory

In addition to the dynamic LanceDB memory, each employee's workspace files serve as "static memory":

- `SOUL.md` — permanent identity (rarely changes)
- `CONTEXT.md` — enterprise context (updated by Knowledge Curator)
- `SKILL.md` files — procedural knowledge (versioned and updatable)
- `data/` directory — reference materials, templates, lookup tables

This two-tier approach (static workspace files + dynamic vector memory) gives employees both reliable procedural knowledge and adaptive experiential learning.

---

## 11. Observability & Traceability

### Built-in Diagnostics

OpenClaw includes the `diagnostics-otel` extension for OpenTelemetry-based observability. Sentura extends this with enterprise-grade monitoring:

### Trace Architecture

```
AI Employee Action
  → OpenClaw agent execution trace (tool calls, LLM calls, timing)
    → OpenTelemetry spans exported to collector
      → Sentura Dashboard (real-time view)
      → Log aggregation (file-based or external: Loki, ELK, etc.)
```

### What Gets Traced

| Event | Data Captured |
|-------|--------------|
| **LLM Call** | Provider, model, token count, latency, cost estimate |
| **Tool Execution** | Tool name, args (redacted if sensitive), result summary, duration |
| **Approval Request** | Action, requester (agent), approver (human), decision, latency |
| **Channel Message** | Direction (in/out), channel, session key, message length |
| **Memory Operation** | Store/recall, query, results count, relevance scores |
| **Self-Provisioning** | Service, action (register/configure), success/failure |
| **Error** | Error type, stack trace, recovery action |

### Sentura Dashboard Observability

The Sentura control plane dashboard provides:

1. **Employee Activity Feed** — real-time stream of all AI employee actions
2. **Session Inspector** — drill into any conversation with full tool/LLM traces
3. **Cost Tracker** — per-employee, per-department LLM spend tracking
4. **Error Dashboard** — failed tool calls, rejected approvals, timeouts
5. **Performance Metrics** — response latency, tool success rates, memory recall accuracy
6. **Audit Log** — every action taken by every AI employee, searchable and exportable

### Access Control for Observability

| Role | Can See |
|------|---------|
| **Platform Admin** | Everything — all employees, all departments, raw traces |
| **Department Manager** | Their department's employees only, redacted PII in traces |
| **Employee Owner** | Their specific AI employees only |
| **Auditor** | Read-only access to audit logs and compliance traces |

---

## 12. Multi-Agent Orchestration

### Mode B — AI Project Manager

For complex tasks that span multiple AI employees, Sentura deploys an **AI Project Manager** — a special OpenClaw agent that decomposes work and coordinates across the workforce.

### Orchestration via OpenClaw Subagents

OpenClaw's subagent system (`sessions_spawn`, `sessions_send`, `sessions_yield`) provides the primitives for multi-agent coordination:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI PROJECT MANAGER                         │
│   Receives macro-objective from human                        │
│   Decomposes into tasks                                     │
│   Assigns tasks to AI employees                             │
│   Monitors progress                                         │
│   Synthesizes results                                       │
└────────────────┬───────────┬──────────────┬─────────────────┘
                 │           │              │
        ┌────────▼──┐ ┌─────▼─────┐ ┌──────▼──────┐
        │ AP Clerk   │ │ CS Agent  │ │ SDR Agent   │
        │ "Process   │ │ "Compile  │ │ "Identify   │
        │  Q4 inv."  │ │  CSAT"    │ │  top leads" │
        └────────────┘ └───────────┘ └─────────────┘
```

### Subagent Communication

```json5
// AI Project Manager spawns a task to the AP Clerk
{
  tool: "sessions_send",
  args: {
    sessionKey: "ap-clerk-finance",
    message: "Process all outstanding Q4 invoices and provide a summary with total amounts by vendor. Flag any that are overdue by more than 30 days."
  }
}

// AI Project Manager checks progress
{
  tool: "sessions_history",
  args: {
    sessionKey: "ap-clerk-finance",
    limit: 5  // Last 5 messages
  }
}
```

### Cross-Employee Knowledge Sharing

AI employees can share information through:

1. **Direct messaging** — `sessions_send` between agent sessions
2. **Shared skills** — common skill files in a shared directory
3. **Channel messages** — post updates to shared Slack/Teams channels
4. **Memory** — the Project Manager can query any employee's memory (with permission)

---

## 13. Natural Language Configuration & Live Tuning

### Tuning Agent

Sentura includes a dedicated **Tuning Agent** — an OpenClaw agent that modifies other agents' configurations based on natural language instructions from enterprise users.

```
Human: "The AP clerk is being too formal with the finance team.
        Make it more friendly and casual."

Tuning Agent:
  1. Reads current SOUL.md for ap-clerk-finance
  2. Modifies personality section to be more casual
  3. Updates via workspace file write
  4. Verifies change doesn't conflict with RULES.md
  5. Confirms change to human
```

### What Can Be Tuned

| Aspect | Tuning Mechanism |
|--------|-----------------|
| **Personality/Tone** | Modify SOUL.md |
| **Skills** | Add/modify/remove SKILL.md files |
| **Rules & Boundaries** | Modify RULES.md (requires admin approval) |
| **Tools** | Update agent config tool allowlist via `config.patch` |
| **Channel Bindings** | Add/remove channel bindings via `config.patch` |
| **Model** | Switch LLM provider/model via `config.patch` |
| **Schedule** | Add/modify cron jobs via `cron.add`/`cron.update` RPC |
| **Integrations** | Add MCP servers or trigger self-provisioning |
| **Approval Thresholds** | Modify approval policies (admin only) |

### Live Hot-Reload

OpenClaw's `config.patch` RPC applies changes immediately without restarting the gateway. Workspace file changes (SOUL.md, SKILL.md, etc.) are picked up on the next agent invocation. This means tuning is **instant** — no downtime, no redeployment.

### Tuning Safety

The Tuning Agent enforces safety boundaries:

- **Cannot remove safety rules** — RULES.md modifications require admin approval
- **Cannot escalate tool access** — adding dangerous tools requires admin approval
- **Version history** — every change is tracked with before/after diffs
- **Rollback** — any change can be reverted via `config.revert` RPC

---

## 14. Integration Layer — MCP & OpenClaw Extensions

### Model Context Protocol (MCP)

MCP is the primary integration mechanism. Enterprise systems are exposed as **MCP servers** that AI employees can call as tools.

> **What OpenClaw provides**: The `mcp.servers` config section that accepts manual JSON5 entries, `@modelcontextprotocol/sdk` for stdio/SSE/streamable-HTTP transports, and the MCP loopback server for exposing OpenClaw's own tools. **What Sentura builds**: The entire enterprise integration pipeline — discovering an enterprise's internal APIs, organizing endpoints into typed MCP tools, generating MCP server code or config, wiring credentials from the secret store, and deploying servers for each AI employee. OpenClaw contains **zero enterprise-specific connectors** (no Salesforce, SAP, Zendesk, Workday, etc.) — all of these must be built, sourced from open-source MCP servers, or auto-generated by Sentura during onboarding.

### Enterprise MCP Strategy

Sentura's integration approach has three tiers:

| Tier | Source | Example |
|------|--------|---------|
| **Open-source MCP servers** | npm packages (`@mcp-servers/*`, community) | Salesforce, Jira, PostgreSQL, Slack |
| **Sentura-generated MCP servers** | Auto-generated from enterprise API docs during onboarding | Custom REST APIs, internal microservices |
| **Self-provisioned MCP configs** | AI employee uses browser to obtain credentials, then configures MCP | SaaS tools with API key setup flows |

For enterprises with internal REST APIs (like the GradSale example in `ekg/`), Sentura builds custom MCP servers that wrap those endpoints as typed tools — this is a core onboarding deliverable, not something OpenClaw handles.

### MCP Server Configuration

```json5
{
  mcp: {
    servers: {
      "salesforce": {
        command: "npx",
        args: ["-y", "@mcp-servers/salesforce"],
        env: {
          SF_INSTANCE_URL: "https://acme.my.salesforce.com",
          SF_ACCESS_TOKEN: { $secret: "salesforce_token" }
        }
      },
      "jira": {
        command: "npx",
        args: ["-y", "@mcp-servers/jira"],
        env: {
          JIRA_URL: "https://acme.atlassian.net",
          JIRA_API_TOKEN: { $secret: "jira_api_token" }
        }
      },
      "postgres-erp": {
        command: "npx",
        args: ["-y", "@mcp-servers/postgres"],
        env: {
          DATABASE_URL: { $secret: "erp_database_url" }
        }
      },
      "custom-api": {
        // HTTP-based MCP server (for services with SSE/streamable HTTP)
        url: "https://internal-api.acme.com/mcp",
        transport: "streamable-http",
        headers: {
          Authorization: "Bearer ${INTERNAL_API_TOKEN}"
        }
      }
    }
  }
}
```

### OpenClaw Extension System

Beyond MCP servers, OpenClaw's plugin system provides additional integration points:

| Integration Type | Mechanism | Example |
|-----------------|-----------|---------|
| **Messaging Channels** | Channel extensions (`defineChannelPluginEntry`) | Slack, Teams, WhatsApp |
| **AI Providers** | Provider extensions (`definePluginEntry`) | OpenAI, Anthropic, Ollama |
| **Custom Tools** | Plugin tools (`registerTool`) | Browser automation, PDF processing |
| **Web Search** | Search provider extensions | Brave, DuckDuckGo, Tavily |
| **Memory Backends** | Memory extensions (`kind: "memory"`) | LanceDB, custom stores |
| **Speech/Voice** | Speech extensions | ElevenLabs, Deepgram |

### Integration at Inception (IAI)

Sentura's IAI principle means that when an AI employee is created, all required integrations are set up as part of the incubation process. This is where Sentura does the heavy lifting that OpenClaw does not provide:

```
Employee Creation Request
  → Creator Agent identifies needed integrations
    → Tier 1: Check for open-source MCP server packages (npm registry)
    → Tier 2: Generate MCP server from enterprise API documentation (ekg/)
    → Tier 3: Self-provision via browser automation (Section 5)
    → Check existing credentials in secret store
      → Missing? → Self-provision or request from enterprise admin
    → Configure MCP servers in agent config via config.patch
    → Wire tool allowlists so the employee can access the new MCP tools
    → Verify all connections with test calls
    → Deploy employee with all integrations ready
```

The enterprise data integration during onboarding covers:

| Data Source | Integration Method | Sentura's Job |
|------------|-------------------|---------------|
| **Structured** (SQL databases, ERP tables) | MCP server wrapping database queries | Build/generate the MCP server, manage credentials |
| **Semi-structured** (APIs, webhooks, event streams) | MCP server wrapping REST/GraphQL endpoints | Map API docs to MCP tools, generate typed schemas |
| **Unstructured** (PDFs, wikis, Confluence, SharePoint) | Browser + PDF tools → SKILL.md distribution | Ingest, extract, convert to skills and memory entries |
| **Real-time** (CRM events, ticket updates, Slack messages) | Channel extensions + MCP servers with SSE | Configure event listeners and routing rules |

### The ACP Extension

For advanced inter-agent communication, Sentura can leverage OpenClaw's `acpx` extension (Agent Client Protocol), which provides:
- Standardized agent-to-agent messaging
- Cross-gateway agent discovery
- Structured task delegation with typed responses

---

## 15. Security Model

### Defense in Depth

Sentura inherits OpenClaw's security layers and adds enterprise-grade controls:

| Layer | OpenClaw Feature | Sentura Extension |
|-------|-----------------|-------------------|
| **Tool Policy** | Tool allowlists/denylists per agent | Per-department and per-role policies |
| **Sandbox** | Docker sandbox for non-main agents | Mandatory sandboxing for all AI employees |
| **DM Pairing** | Channel-level authentication | Enterprise SSO integration |
| **Approval Workflows** | `exec.approval` system | HITL with escalation and timeout |
| **Secret Management** | Encrypted secret store | Secret rotation, audit logging |
| **SSRF Protection** | Built-in SSRF guards | Extended for enterprise network topology |
| **Path Safety** | Directory traversal prevention | Workspace isolation per employee |
| **Audit Logging** | Security event logging | Centralized audit with retention policies |
| **Skill Scanning** | Skill content analysis | Mandatory scanning before deployment |

### Role-Based Access Control

| Role | Permissions |
|------|------------|
| **Platform Admin** | Full access: create/delete employees, manage providers, view all traces |
| **Department Admin** | Manage employees in their department, view department traces |
| **Employee Owner** | Configure and tune their assigned AI employees |
| **Auditor** | Read-only access to audit logs, compliance reports |
| **End User** | Interact with AI employees via channels, request approvals |

### Data Classification

| Tier | Description | Handling |
|------|-------------|---------|
| **T0 — Public** | General information, FAQs | Can be shared on any channel |
| **T1 — Internal** | Internal procedures, org charts | Internal channels only |
| **T2 — Confidential** | Financial data, customer records | Approved systems only, logged access |
| **T3 — Restricted** | PII, health records, credentials | Encrypted at rest, approval for access |
| **T4 — Critical** | Encryption keys, auth tokens | Secret store only, never in conversation |

### External Channel Boundaries

When AI employees communicate on external channels (Slack, Teams, WhatsApp):

- **T0 and T1 data only** in messages
- **No PII, financial details, or credentials** in channel messages
- **Approval actions** happen on the Sentura dashboard, not in Slack
- **Notifications** on external channels link to the dashboard for details

---

## 16. Deployment Options

### Local Development (Default)

```bash
git clone https://github.com/sentura/Sentura-Platform.git
cd Sentura-Platform

# Step 1: Build OpenClaw from source
cd openclaw
pnpm install && pnpm ui:build && pnpm build

# Step 2: Onboard OpenClaw (configures gateway, LLM provider, API keys)
pnpm openclaw onboard

# Step 3: Register Sentura meta-agents
cd .. && ./scripts/sentura-setup.sh

# Step 4: Start the gateway
cd openclaw && pnpm gateway:watch
```

### On-Premise with Local LLM

```bash
# Install Ollama for local LLM inference
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.3:70b

# Build OpenClaw from source and onboard with local provider
cd openclaw
pnpm install && pnpm ui:build && pnpm build
pnpm openclaw onboard

# Register Sentura meta-agents, then start
cd .. && ./scripts/sentura-setup.sh
cd openclaw && pnpm gateway:watch
```

### Production (Docker)

Docker deployment is available for production environments. See `openclaw/docker-setup.sh` and `openclaw/docker-compose.yml`.

### Hybrid Deployment

```
┌──────────────────────────────────┐
│          CLOUD                    │
│  Sentura Control Plane           │
│  (dashboard, monitoring)         │
│  Cloud LLMs (API keys)          │
└──────────────┬───────────────────┘
               │ VPN / Private Link
┌──────────────▼───────────────────┐
│        ON-PREMISE                 │
│  OpenClaw Gateway                │
│  AI Employees                    │
│  Enterprise Data & MCP Servers   │
│  Local LLMs (Ollama/vLLM)       │
│  Memory (LanceDB)               │
└──────────────────────────────────┘
```

### LLM Deployment Options

| Option | Setup | Best For |
|--------|-------|----------|
| **Cloud API Keys** | Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. in `.env` | Quick start, low maintenance |
| **Self-Hosted Ollama** | `ollama serve` on a GPU machine, point OpenClaw to it | Data privacy, no per-token cost |
| **Self-Hosted vLLM** | Deploy vLLM with production models, configure as provider | High throughput, production scale |
| **LiteLLM Proxy** | Run LiteLLM in front of multiple providers | Unified API, cost optimization |
| **Mixed** | Cloud for general tasks, local for sensitive data | Balance of speed and privacy |

---

## 17. Sentura Control Plane

### Architecture

The Sentura Control Plane is a management layer that sits on top of OpenClaw's gateway, providing enterprise-specific features:

```
┌─────────────────────────────────────────────────────────┐
│                SENTURA CONTROL PLANE                     │
│                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ Admin Dashboard│  │ Employee      │  │ Monitoring  │ │
│  │ (Web UI)       │  │ Management    │  │ & Analytics │ │
│  │               │  │ API           │  │             │ │
│  │ • Create       │  │ • CRUD agents │  │ • Traces    │ │
│  │ • Configure    │  │ • Tune skills │  │ • Costs     │ │
│  │ • Monitor      │  │ • Manage MCP  │  │ • Errors    │ │
│  │ • Approve      │  │ • Approvals   │  │ • Audit     │ │
│  └───────┬───────┘  └───────┬───────┘  └──────┬──────┘ │
│          │                  │                  │        │
│  ┌───────▼──────────────────▼──────────────────▼──────┐ │
│  │           OpenClaw Gateway RPC (WebSocket)          │ │
│  │   config.* │ sessions.* │ agent │ cron.* │ skills.* │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Dashboard Features

1. **Employee Roster** — list all AI employees with status, channel bindings, recent activity
2. **Employee Creator** — natural language interface for creating new employees (talks to Creator Agent)
3. **Live Tuning** — modify any employee's personality, skills, rules, tools in real-time
4. **Approval Queue** — pending HITL approvals with context and one-click approve/reject
5. **Conversation View** — read any AI employee's conversations (with access control)
6. **Integration Manager** — view and manage MCP servers, self-provisioned credentials
7. **Cost Center** — LLM usage and cost tracking per employee, per department
8. **Audit Trail** — searchable log of all AI employee actions
9. **Health Monitor** — employee uptime, error rates, response latency

### Implementation

The Sentura Control Plane communicates with OpenClaw exclusively through the **Gateway WebSocket RPC API**:

| Dashboard Action | Gateway RPC Call |
|-----------------|-----------------|
| Create employee | `config.patch` (add agent entry) + file writes for workspace |
| List employees | `config.get` → parse `agents.list` |
| Tune employee | `config.patch` + workspace file updates |
| View conversations | `sessions.list` + `sessions.transcript` |
| Approve action | `exec.approval.resolve` / `plugin.approval.resolve` |
| Manage cron jobs | `cron.list` / `cron.add` / `cron.update` / `cron.remove` |
| Check health | `health` / `models.list` / `tools.catalog` |
| Install skills | `skills.install` / `skills.enable` |

---

## 18. Technology Stack

### Core Runtime (OpenClaw)

| Component | Technology |
|-----------|-----------|
| **Runtime** | Node.js 22+ (ESM, TypeScript) |
| **Gateway** | Hono (HTTP) + ws (WebSocket) |
| **Agent Core** | `@mariozechner/pi-agent-core` |
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
| **Dashboard** | Next.js 15 (App Router) or extend OpenClaw's Lit-based Control UI |
| **Styling** | Tailwind CSS + shadcn/ui (if Next.js) or CSS Modules (if Lit) |
| **State Management** | React Server Components / Lit Signals |
| **API Communication** | WebSocket JSON-RPC to OpenClaw Gateway |
| **Authentication** | Enterprise SSO (SAML/OIDC) + gateway token auth |

### Infrastructure

| Component | Options |
|-----------|---------|
| **Container** | Docker / Podman |
| **Orchestration** | Docker Compose (small), Kubernetes (enterprise) |
| **LLM Serving** | Ollama, vLLM, SGLang (self-hosted) or cloud APIs |
| **Monitoring** | OpenTelemetry (via `diagnostics-otel` extension) |
| **Logging** | tslog (structured) → file / stdout / external collector |
| **CI/CD** | GitHub Actions, GitLab CI, or any Docker-capable CI |

---

## 19. Project Structure

```
Sentura-Platform/
├── openclaw/                    # OpenClaw core (submodule or local install)
│   ├── src/                     # Core TypeScript source
│   ├── extensions/              # 86 plugin extensions
│   ├── skills/                  # Bundled skills
│   ├── ui/                      # Control UI (Lit web components)
│   └── ...
│
├── sentura/                     # Sentura control plane
│   ├── agents/                  # Meta-agents (Creator, Tuner, Orchestrator)
│   │   ├── creator/
│   │   │   ├── SOUL.md          # Creator Agent identity
│   │   │   ├── skills/          # Incubation skills
│   │   │   └── templates/       # Employee templates (per-role)
│   │   ├── tuner/
│   │   │   ├── SOUL.md          # Tuning Agent identity
│   │   │   └── skills/          # Configuration modification skills
│   │   └── orchestrator/
│   │       ├── SOUL.md          # Project Manager identity
│   │       └── skills/          # Task decomposition, coordination
│   │
│   ├── dashboard/               # Sentura Admin Dashboard
│   │   ├── src/
│   │   │   ├── app/             # Next.js app router pages
│   │   │   ├── components/      # UI components
│   │   │   ├── lib/             # Gateway RPC client, auth
│   │   │   └── styles/          # Tailwind config
│   │   ├── package.json
│   │   └── next.config.js
│   │
│   ├── extensions/              # Sentura-specific OpenClaw extensions
│   │   ├── sentura-approval/    # Enhanced HITL approval extension
│   │   ├── sentura-audit/       # Enterprise audit logging
│   │   ├── sentura-rbac/        # Role-based access control
│   │   └── sentura-provisioner/ # Self-provisioning coordinator
│   │
│   ├── hooks/                   # Sentura OpenClaw hooks
│   │   └── sentura-bootstrap/   # Injects RULES.md + CONTEXT.md into system prompt
│   │       ├── HOOK.md          # Hook metadata (events, install info)
│   │       └── handler.ts       # Bootstrap event handler
│   │
│   ├── skills/                  # Sentura bundled skills
│   │   ├── self-provisioning/   # Service registration skill
│   │   ├── knowledge-curation/  # Enterprise knowledge ingestion
│   │   ├── compliance/          # Cross-industry compliance
│   │   └── onboarding/          # New employee onboarding guide
│   │
│   └── config/                  # Default configurations
│       ├── base.json5           # Sentura base config overlay
│       ├── templates/           # Role-specific config templates
│       └── policies/            # Default approval/security policies
│
├── workspaces/                  # AI Employee workspaces (created at runtime)
│   ├── ap-clerk-finance/        # Example: Accounts Payable clerk
│   │   ├── SOUL.md
│   │   ├── AGENTS.md
│   │   ├── RULES.md
│   │   ├── CONTEXT.md
│   │   ├── TOOLS.md
│   │   └── skills/
│   └── cs-agent-support/        # Example: Customer Support agent
│       └── ...
│
├── render.yaml                  # Cloud deployment (Render)
├── charts/                      # Helm charts for Kubernetes
│   └── sentura/
├── package.json                 # Root workspace
└── README.md                    # This file
```

---

## 20. Development Roadmap

### Phase 1 — Foundation (Weeks 1–3)

**Goal**: OpenClaw running with Sentura control plane basics.

| Task | Owner | Deliverable |
|------|-------|-------------|
| Set up OpenClaw as core runtime | Platform | Working gateway with provider + channel config |
| Build Creator Agent (v1) | Agent Dev | Meta-agent that generates agent configs from NL |
| Sentura Dashboard shell | Frontend | Next.js app connecting to gateway via WS RPC |
| Employee workspace manager | Platform | Create/read/update/delete workspace directories |
| Basic RBAC extension | Platform | Role-based access to gateway RPC methods |

### Phase 2 — AI Employee Lifecycle (Weeks 4–6)

**Goal**: Full create → configure → deploy → tune lifecycle working.

| Task | Owner | Deliverable |
|------|-------|-------------|
| Creator Agent skill generation | Agent Dev | Auto-generate SKILL.md files from NL job descriptions |
| Self-provisioning skill (v1) | Agent Dev | Browser-based service registration for common services |
| Tuning Agent | Agent Dev | Modify employee config/skills via NL commands |
| Dashboard: Employee Creator UI | Frontend | Chat interface for creating employees |
| Dashboard: Live Tuning UI | Frontend | Edit personality, skills, rules in real-time |
| MCP server auto-configuration | Platform | Configure MCP servers from self-provisioned credentials |

### Phase 3 — Enterprise Features (Weeks 7–9)

**Goal**: Approval workflows, observability, multi-agent orchestration.

| Task | Owner | Deliverable |
|------|-------|-------------|
| HITL approval extension | Platform | Enhanced approval workflows with escalation + timeout |
| Observability dashboard | Frontend | Traces, costs, errors, audit log views |
| Orchestrator Agent (Mode B) | Agent Dev | AI Project Manager for multi-agent task coordination |
| Enterprise knowledge skill | Agent Dev | Knowledge Curator agent for document ingestion |
| Security hardening | Platform | Tool policies, sandbox enforcement, audit logging |
| Channel integration testing | Platform | Verify Slack, Teams, WhatsApp, WebChat working end-to-end |

### Phase 4 — Production Readiness (Weeks 10–12)

**Goal**: Production-grade deployment with enterprise SSO, monitoring, and documentation.

| Task | Owner | Deliverable |
|------|-------|-------------|
| Enterprise SSO integration | Platform | SAML/OIDC auth for dashboard |
| Self-provisioning for 20+ services | Agent Dev | Templates for common SaaS tools (CRM, email, ticketing, etc.) |
| Kubernetes Helm chart | Platform | Production deployment on K8s |
| On-premise deployment guide | Platform | Docker Compose + offline LLM setup |
| Employee template library | Agent Dev | Pre-built templates for 10+ common roles |
| Performance optimization | Platform | Load testing, memory tuning, model routing |
| Documentation | All | User guide, admin guide, API reference |

### Phase 5 — Scale & Ecosystem (Post-Launch)

- **Sentura Skill Store** — marketplace for community-contributed role templates and skills
- **Custom extension SDK** — documentation and tooling for building Sentura-specific OpenClaw extensions
- **Advanced orchestration** — complex multi-agent workflows with dependency graphs
- **Voice employees** — AI employees that handle phone calls via the `voice-call` extension
- **Canvas/A2UI integration** — AI employees that produce visual artifacts (dashboards, reports)
- **Mobile companion** — native iOS/Android app for approving actions and chatting with employees

---

## Quick Start

### 1. Cloud API (Fastest)

```bash
git clone https://github.com/sentura/Sentura-Platform.git
cd Sentura-Platform/openclaw

# Step 1: Build and onboard OpenClaw
pnpm install && pnpm ui:build && pnpm build
pnpm openclaw onboard
# Follow prompts — provide your LLM API key (OpenAI, Anthropic, etc.)

# Step 2: Register Sentura meta-agents
cd .. && ./scripts/sentura-setup.sh

# Step 3: Start the gateway
cd openclaw && pnpm gateway:watch
# Open the Control UI URL printed at the end
```

### 2. Local with Ollama (Privacy-First)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.3:70b

git clone https://github.com/sentura/Sentura-Platform.git
cd Sentura-Platform/openclaw

pnpm install && pnpm ui:build && pnpm build
pnpm openclaw onboard
# Choose local provider during onboarding

cd .. && ./scripts/sentura-setup.sh
cd openclaw && pnpm gateway:watch
```

### 3. Development Setup

```bash
git clone https://github.com/sentura/Sentura-Platform.git
cd Sentura-Platform/openclaw

pnpm install && pnpm ui:build && pnpm build
pnpm openclaw onboard

# Register Sentura meta-agents (Creator, Tuner, Orchestrator)
cd .. && ./scripts/sentura-setup.sh

# Start the gateway
cd openclaw && pnpm gateway:watch

# Start Sentura dashboard in dev mode (when built)
cd ../sentura/dashboard && pnpm dev

# OpenClaw Control UI available at http://localhost:18789
# Sentura Dashboard available at http://localhost:3000
```
