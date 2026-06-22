# Sentura Platform — Deep Technical Design

> **Reference doc** — read on demand when working on architecture, orchestration, EKG, safety, memory, MCP, or deployment. Not part of the mandatory per-chat context. For the top-level overview and 17-capability map, see [README.md](../README.md).

## Table of Contents

1. [Platform Architecture Overview](#2-platform-architecture-overview)
2. [AI Employee Model — OpenClaw-Based](#3-ai-employee-model--openclaw-based)
3. [No-Code Employee Creation](#4-no-code-employee-creation)
4. [Self-Provisioning & Autonomous Tool Setup](#5-self-provisioning--autonomous-tool-setup)
5. [Enterprise Knowledge Graph (EKG)](#6-enterprise-knowledge-graph-ekg)
6. [Communication & Channels](#7-communication--channels)
7. [LLM Abstraction — 51 Provider Extensions](#8-llm-abstraction--51-provider-extensions)
8. [Safety, Guardrails & Human-in-the-Loop](#9-safety-guardrails--human-in-the-loop)
9. [Memory Architecture](#10-memory-architecture)
10. [Observability & Traceability](#11-observability--traceability)
11. [Multi-Agent Orchestration](#12-multi-agent-orchestration)
12. [Natural Language Configuration & Live Tuning](#13-natural-language-configuration--live-tuning)
13. [Integration Layer — MCP & OpenClaw Extensions](#14-integration-layer--mcp--openclaw-extensions)
14. [Security Model](#15-security-model)
15. [Deployment Options](#16-deployment-options)
16. [Sentura Control Plane](#17-sentura-control-plane)
17. [Development Roadmap](#20-development-roadmap)

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
│  │  AI EMPLOYEES  │ │  24 CHANNELS   │ │  51 PROVIDER EXTENSIONS   │      │
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
| **Memory** | OpenClaw memory system (LanceDB) | Long-term recall of conversations and facts; **per-user isolated** so each human gets personalized memory while core identity stays unified |
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
          // Sandbox second-stage filter (see § "Sandbox runtime — two-stage
          // tool-policy filter" below). Any plugin tool that should remain
          // visible inside the non-main sandbox MUST also be listed here —
          // otherwise it is stripped silently on the dashboard `chat.send`
          // path even though CLI sessions still see it.
          sandbox: {
            tools: {
              alsoAllow: ["web_search", "web_fetch", "pdf", "canvas", "cron", "memory_search", "memory_get", "update_plan"],
            },
          },
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
│ — OpenClaw Native Workspace Files (8) ——
├── AGENTS.md            # Role protocol + § Hard Rules (Sentura safety boundaries)
├── SOUL.md              # Core identity, personality
├── TOOLS.md             # Tool documentation
├── IDENTITY.md          # Agent identity descriptor
├── USER.md              # User context / preferences
├── HEARTBEAT.md         # Cron heartbeat instructions
├── BOOTSTRAP.md         # First-run bootstrap + § Enterprise Context (Sentura org/policies)
├── MEMORY.md            # Memory notes / scratchpad
│
│ — Sentura Enterprise Additions (outside the 8 native files) ——
├── skills/              # Structured position-specific skills
│   ├── invoice-processing/
│   │   └── SKILL.md
│   ├── vendor-management/
│   │   └── SKILL.md
│   └── compliance-checks/
│       └── SKILL.md
├── ekg/                 # Enterprise Knowledge Graph (4 pillars)
│   ├── org/
│   ├── rules/
│   ├── assets/
│   └── workflows/
├── memory/              # Per-user memory isolation
│   └── users/           # One MEMORY_USER file per human user
│       ├── MEMORY_USER_{tokenA}.md
│       └── MEMORY_USER_{tokenB}.md
├── mcp-servers/         # Self-provisioned MCP server configs
└── data/                # Working data (templates, references)
```

> **Workspace file layout**: Sentura uses **exactly the 8 native OpenClaw workspace files**.
>
> - **Hard safety boundaries** (NEVER / ALWAYS / Escalation) live inside each agent's `AGENTS.md` under a `## Hard Rules (must not override)` section. The runtime gives `AGENTS.md` the highest prompt priority, so these rules are honored ahead of any user instruction.
> - **Enterprise context** (org structure, policies, system inventory, fiscal calendar, etc.) lives inside each agent's `BOOTSTRAP.md` under a `## Enterprise Context` section.
>
> The only Sentura-specific bootstrap injection is **per-user memory** (`memory/users/MEMORY_USER_{token}.md`) — the file is keyed dynamically by session so it cannot live inside a static workspace file.
>
> **Unified identity, personalized memory**: All workspace files that define *who* the agent is (SOUL.md, AGENTS.md including its Hard Rules, BOOTSTRAP.md including its Enterprise Context, TOOLS.md, skills/, ekg/) are shared across all users — every human interacts with the same AI employee identity. However, episodic memory (LanceDB entries) and personal notes (`MEMORY_USER_{token}.md`) are **per-user isolated**. This mirrors how a real human employee has the same personality and knowledge with everyone but remembers different conversations with different colleagues.

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

### Sandbox runtime — two-stage tool-policy filter

Every Sentura AI employee (and every meta-agent) runs with `sandbox.mode = "non-main"`. That protects the host but also means tool visibility is filtered **twice** before the agent's LLM ever sees the toolset. Skipping the second stage is the single most common reason a freshly-deployed employee looks broken — this section captures the contract so capability designers don't rediscover it through outages.

**The two stages**

1. **Agent-level pipeline.** Applies `tools.profile` (`coding` / `minimal` / …), `tools.allow`, `tools.alsoAllow`, and `tools.deny` from the agent config. Produces the "agent toolset."
2. **Sandbox-level pipeline.** Intersects the agent toolset with hard-coded sandbox defaults in `openclaw/src/agents/sandbox/constants.ts`:
    - `DEFAULT_TOOL_ALLOW` is narrow and filesystem-oriented: `exec, read, write, edit, apply_patch, process, image, sessions_list, sessions_history, sessions_send, session_status, subagents`.
    - `DEFAULT_TOOL_DENY` removes the high-surface tools: `gateway, browser, canvas, cron, nodes`, plus every channel id.
    - A second helper re-opens any channel-like deny entry that is explicitly re-added via `tools.sandbox.tools.alsoAllow`.

**Why both Sentura plugin tools and OpenClaw plugin tools are affected.** `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`, `memory_search`, `memory_get`, `update_plan`, `web_fetch`, `web_search`, `pdf`, `image_generate`, `video_generate`, the channel tools — none of them are in `DEFAULT_TOOL_ALLOW`, so they are all stripped at stage 2 unless the config carries a matching `tools.sandbox.tools.alsoAllow`.

**Dashboard vs CLI divergence.** This is the silent part. The `chat.send` gateway RPC (used by the dashboard webchat) activates the agent through the embedded runner and therefore goes through **both** stages. The direct CLI path (`openclaw agent --agent <id>`) and the `tools.effective` gateway RPC both report the pre-sandbox view. The result is that a freshly deployed employee can advertise 21 tools in every test you write and still behave as if it has 7 tools the moment a human talks to it through the dashboard. See `docs/OPENCLAW.md` § "Sandbox tool-policy filter (dashboard vs CLI divergence)" for the tool-count table and the Round 20 evidence trail.

**Design-time contract for every new capability.**

- When the capability requires plugin tools (Sentura-specific or OpenClaw-bundled), list them in both `tools.alsoAllow` *and* `tools.sandbox.tools.alsoAllow`.
- Tools already present in `DEFAULT_TOOL_ALLOW` (`read`, `write`, `edit`, `exec`, `apply_patch`, `process`, `image`, `sessions_*`) do not need to be re-listed under `sandbox.tools.alsoAllow`.
- Test the capability via the dashboard `chat.send` path, not just the CLI — the CLI will lie to you by design.
- Meta-agents ship with this configuration out of the box (Creator, Tuner, Orchestrator, MCP Builder). The setup scripts (`scripts/sentura-setup.sh` / `.ps1`) patch it into `~/.openclaw/openclaw.json` on bootstrap, so re-running setup is idempotent and safe.

This section is the architectural rationale; the operational commands live in `docs/SETUP.md` § "Sandbox tool-policy filter."

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
3. **AGENTS.md** — role protocol **and** the `## Hard Rules (must not override)` section (NEVER / ALWAYS / Escalation) that defines hard safety boundaries
4. **BOOTSTRAP.md** — first-run instructions **and** the `## Enterprise Context` section (org, systems, policies, fiscal calendar)
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
| **Safety compliance** | Does it respect `AGENTS.md` Hard Rules boundaries? | Refuses to approve a payment above the threshold |
| **Escalation judgment** | Does it escalate when appropriate? | Routes a flagged dispute to a human instead of auto-resolving |
| **Tone & communication** | Does the response match SOUL.md personality? | Professional but approachable, not robotic |
| **Error handling** | Does it recover gracefully from tool failures? | Retries or escalates when an API call fails |

**Auto-tuning on failure**: When an employee fails a test case, the Creator Agent diagnoses the root cause and applies targeted fixes:

- **Wrong tool usage** → adjust SKILL.md procedure steps or tool allowlist
- **Safety violation** → strengthen the `## Hard Rules` section of `AGENTS.md` with the specific boundary that was crossed
- **Missed escalation** → add escalation trigger to the relevant skill's Safety section
- **Poor tone** → refine SOUL.md personality directives
- **Missing knowledge** → add a new SKILL.md or extend the `## Enterprise Context` section of `BOOTSTRAP.md`

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

> **What OpenClaw provides**: The browser tool (Playwright-based) for web automation, workspace-local MCP config loading, and the underlying config/runtime hooks. **What Sentura builds**: the self-provisioning *system* — a file-backed secret provider, host actions for secret/MCP mutation, redacted config-diff logging, approval integration, error recovery, and the orchestration layer that turns raw browser + credential primitives into a reliable autonomous provisioning pipeline.

When an AI employee needs a tool or service it doesn't yet have access to, the Sentura self-provisioning system:

1. Detects the missing capability (via skill procedure or Creator Agent)
2. Checks for existing credentials in the secret store
3. Determines if approval is needed (new accounts, paid services → HITL)
4. Executes the provisioning skill (browser automation for registration)
5. Handles errors gracefully (CAPTCHA, 2FA, rate limits → escalate to human)
6. Stores credentials through Sentura's host-side secret helper
7. Configures the MCP server via per-agent `config.json5 -> mcpServers`
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
        │                                  │ Sentura secrets.json │
        │                                  └───────┬──────────────┘
        │                                          │
        ▼                                          ▼
┌────────────────────────────────────────────────────────┐
│ Configure MCP server with credentials                  │
│ Upsert agent config.json5 -> mcpServers via host action│
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

**Secret storage** — credentials are stored in Sentura's file-backed provider:
```json5
// `put_secret` ensures the default provider exists and writes the secret
{
  secrets: {
    providers: {
      default: {
        source: "file",
        path: "~/.openclaw/secrets.json",
        mode: "json"
      }
    }
  }
}
```

**MCP server configuration** — the new integration is registered:
```json5
// Added to ~/.openclaw/workspace/<agentId>/config.json5 -> mcpServers
{
  mcpServers: {
    "zendesk": {
      command: "npx",
      args: ["-y", "@mcp-servers/zendesk"],
      env: {
        ZENDESK_API_KEY: "$secret:/sentura/agents/ap-clerk-finance/zendesk/api_key",
        ZENDESK_SUBDOMAIN: "acme"
      }
    }
  }
}
```

The `$secret:` pointer stays in `config.json5`; Sentura's stdio launcher resolves it only when spawning the MCP child process. Remote HTTP/SSE `headers` do not support `$secret:` pointers in this round.

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

## 6. Enterprise Knowledge Graph (EKG)

### The Core Problem

Data within most enterprises is extremely chaotic, often completely lacking a knowledge graph. Asking clients to organize this data themselves is cumbersome and unrealistic. A "one-step-to-perfection" approach is infeasible — progress can only be achieved through the gradual accumulation of knowledge.

Sentura solves this with a **progressive, three-tiered knowledge architecture** where each AI employee possesses its own dedicated knowledge base, automatically constructed during incubation and continuously enriched during daily operations.

### Three-Tiered Data Source Architecture

Each AI employee's knowledge is built progressively through three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 3: Autonomous Experience Extraction           [THE MOAT]  │
│  Tacit knowledge from daily operations — "Experience Links"     │
│  Confidence-scored, auto-promoted after repeated observation    │
├─────────────────────────────────────────────────────────────────┤
│  TIER 2: Client-Submitted Data                [DATA SOVEREIGNTY] │
│  PDFs, contracts, manuals, Excel sheets, chat logs              │
│  Processed by the Data Scavenger Agent → structured JSON5       │
│  Gaps filled by Q&A-based Completion during actual work         │
├─────────────────────────────────────────────────────────────────┤
│  TIER 1: Industry Ontology Templates          [PROFESSIONALISM]  │
│  Pre-built logical chains per industry vertical                 │
│  Merged at incubation → instant expertise on day one            │
└─────────────────────────────────────────────────────────────────┘
```

**Tier 1 — Industry Ontology Templates** ensure "professionalism." From the very first day a client integrates Sentura, the AI employee can immediately identify whether a "liability for breach of contract" clause aligns with standard industry practices. This is not just entity recognition (the term "invoice") but a **logical ontology** — a chain like "Invoice → Deduction Voucher → Tax Rate → Financial Compliance." Pre-built templates live at `sentura/config/industry-ontologies/` and are merged into the employee's knowledge base during incubation.

**Tier 2 — Client-Submitted Data** ensures "data sovereignty." Clients do not understand what constitutes "EKG data." If asked to fill out forms, they give up. Instead, Sentura provides a reference checklist for knowledge assets. Clients simply upload relevant company materials — PDF manuals, historical contracts, Excel quotation sheets — and the **Data Scavenger Agent** automatically processes these unstructured documents into structured knowledge. After initial ingestion, a **Q&A-based Completion** mechanism kicks in: the agent proactively asks "I've reviewed your manual and noticed that the approver for Project A is Mr. Zhang, but the maximum reimbursement limit is not specified. Could you tell me what that limit is?" Through lightweight, unobtrusive interactions during actual work, clients complete knowledge customization without realizing they are doing so.

**Tier 3 — Autonomous Experience Extraction** ensures "irreplaceability." Whenever the agent completes a task, it can generate an **Experience Link** — a record of tacit knowledge gained. For example: "Regarding Category A urgent procurements, General Manager Zhang typically requires physical inspection of goods before authorizing payment." Such unwritten rules are rarely documented, but after handling three similar tasks, the agent autonomously identifies this pattern and stores it. Over time, the EKG system comes to understand the company's actual operations at a depth no single human possesses.

### The 4 Pillars of Enterprise Knowledge

The Data Scavenger Agent classifies all knowledge into four foundational ontologies — the structural backbone of every AI employee's knowledge base:

| Pillar | Core Question | Data Nodes | Relational Edges |
|--------|--------------|------------|-----------------|
| **1. Org & Identity** | "Who is who? Who reports to whom?" | Employees, departments, external contacts, system accounts | Reports to, belongs to, has approval authority for |
| **2. Rules & Compliance** | "Where is the baseline? Where is the red line?" | Spending limits, legal clauses, attendance rules, compliance requirements | Constrained by, prerequisite, consequence of violation |
| **3. Assets & Knowledge** | "What do we sell? What do we know?" | Product SKUs, price quotes, server IPs, historical contracts, FAQ pairs | Comprises, related to, equivalent to |
| **4. Workflows & Action** | "How many steps to complete this task?" | Trigger conditions, execution steps, required tools (APIs), output formats | Next step, process in parallel, block and escalate to |

### Per-Agent EKG Directory Structure

Instead of a separate graph database, each pillar maps to a directory under the agent's workspace with structured JSON5 files. OpenClaw's memory system **automatically indexes and vector-searches** these files as part of its standard workspace file scanning:

```
~/.openclaw/workspace/{agent-id}/
  ekg/                                  # Enterprise Knowledge Graph root
  │
  ├── org/                              # Pillar 1: Organizational & Identity
  │   ├── org-chart.json5               # Departments, roles, reporting lines
  │   ├── contacts.json5                # Key personnel with attributes
  │   └── systems.json5                 # System accounts, access levels
  │
  ├── rules/                            # Pillar 2: Rules & Compliance
  │   ├── financial-controls.json5      # Thresholds, approval chains
  │   ├── compliance-policies.json5     # Regulatory requirements
  │   └── operational-limits.json5      # Rate limits, boundaries
  │
  ├── assets/                           # Pillar 3: Assets & Knowledge
  │   ├── products/                     # Product catalog, specs, pricing
  │   ├── contracts/                    # Contract templates, historical references
  │   └── faqs/                         # FAQ pairs, knowledge base entries
  │
  └── workflows/                        # Pillar 4: Workflows & Action
      ├── sops/                         # Standard operating procedures
      ├── experience-links/             # Tier 3: Auto-extracted tacit knowledge
      └── escalation-chains.json5       # Who to escalate to, when, how
```

**Why JSON5 files instead of a graph DB:**
- OpenClaw's memory system **indexes and vector-searches** these files automatically (workspace file scanning) — no custom query engine needed
- JSON5 is **human-readable** and **version-controllable** — admins can review and edit knowledge directly
- The Data Scavenger Agent can **write structured JSON5** using `fs_write` — no new infrastructure
- Deployment remains **zero-dependency** — no Neo4j, no PostgreSQL, no Redis; works on a laptop or an air-gapped server

Relational edges — the "soul" of the knowledge graph — are expressed as JSON5 references:

```json5
// ekg/org/org-chart.json5
{
  entities: [
    { id: "zhang-san", type: "employee", name: "Zhang San", department: "sales", role: "manager" },
    { id: "li-si", type: "employee", name: "Li Si", department: "sales", role: "rep" },
  ],
  relations: [
    { from: "li-si", type: "reports_to", to: "zhang-san" },
    { from: "zhang-san", type: "has_approval_authority", to: "purchase_orders", limit: "$50000" },
  ],
  meta: { source: "company_directory_2026.pdf", ingested: "2026-04-08", confidence: 1.0 }
}
```

This is effectively **JSON-LD without the RDF overhead** — nodes and edges in a flat, queryable format that OpenClaw's memory system can chunk and vector-search. Before executing any action, an agent consults the relevant `ekg/` pillar — like "checking a dictionary" — to ensure it does not cross any boundaries.

### Data Scavenger Agent

The Data Scavenger is a specialized OpenClaw meta-agent with a single mission: convert unstructured input into structured `ekg/` files.

**Processing pipeline:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 1. EXTRACT   │     │ 2. CLASSIFY  │     │ 3. STRUCTURE │     │ 4. MERGE     │     │ 5. NOTIFY    │
│              │     │              │     │              │     │              │     │              │
│ Raw text via │────▶│ LLM-driven   │────▶│ JSON5 with   │────▶│ Additive     │────▶│ Affected     │
│ pdf, browser,│     │ 4-pillar     │     │ entities,    │     │ merge into   │     │ agents get   │
│ web_fetch    │     │ classification│     │ relations,   │     │ ekg/ files   │     │ notified     │
│              │     │              │     │ provenance   │     │ (never       │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     │ destructive) │     └──────────────┘
                                                               └──────────────┘
```

When a client uploads a "Company Directory," the Scavenger deconstructs entries — "Zhang San," "Li Si" — and populates `ekg/org/`. When a "Travel Expense Reimbursement Policy (2026 Edition)" is uploaded, the Scavenger extracts nodes like "High-speed rail: 2nd Class seat" and "Daily meal allowance: 200 RMB" and assigns them to `ekg/rules/`. When a product white paper arrives, the Scavenger packages "Product A" with its price and technical specifications into `ekg/assets/`.

The Scavenger is **not a separate database system.** It writes files. OpenClaw's memory system indexes them. Agents search them via `memory_search`.

### Q&A-Based Completion

After initial ingestion, a cron-triggered skill reads the agent's `ekg/` directory, identifies missing required fields, and generates clarifying questions sent to the appropriate human via `message` (Slack/Teams) or queued for the next conversation:

> "I've reviewed your procurement policy and noticed that the approver for Category A purchases is Director Wang, but the maximum single-purchase limit is not specified. Could you please tell me what that limit is?"

Through such lightweight, unobtrusive interactions, clients complete the private customization of their EKG without even realizing they are doing so.

### Experience Links (Tier 3)

After each significant task completion, a post-task hook evaluates whether the agent observed a reusable pattern and generates an Experience Link:

```json5
// ekg/workflows/experience-links/procurement-category-a.json5
{
  id: "exp-2026-04-08-001",
  pattern: "Category A urgent procurement",
  observation: "GM Zhang requires physical inspection of goods before authorizing payment",
  confidence: 0.85,
  occurrences: 3,
  firstSeen: "2026-03-15",
  lastSeen: "2026-04-08",
  context: "cross-departmental procurement involving warehouse + finance",
  source: "autonomous_extraction"
}
```

The `confidence` score increases with each repeated observation, using OpenClaw's existing short-term recall promotion mechanism (frequency, relevance, diversity, recency weights from `memory-core`). Only high-confidence experience links — above a configurable threshold — are promoted to permanent `ekg/` entries.

Workflow-pillar knowledge typically crystallizes through this tier. If an agent observes that generating a PDF and applying an electronic seal is a prerequisite for issuing every contract, it automatically establishes a new SOP link in `ekg/workflows/sops/`.

### Industry Ontology Templates

Pre-built `ekg/` directory templates per industry vertical, stored at `sentura/config/industry-ontologies/`:

```
sentura/config/industry-ontologies/
├── financial-services/
│   ├── rules/financial-controls.json5      # Invoice → Voucher → Tax Rate → Compliance chains
│   ├── rules/regulatory-compliance.json5   # SOX, AML, KYC standard requirements
│   ├── assets/financial-terms.json5        # Industry terminology ontology
│   └── workflows/standard-sops.json5       # Common financial workflows
├── e-commerce/
│   ├── rules/consumer-protection.json5
│   ├── assets/product-catalog-schema.json5
│   └── workflows/order-fulfillment.json5
└── healthcare/
    ├── rules/hipaa-compliance.json5
    └── ...
```

During incubation (Phase 2 of the Creator Agent), the appropriate industry ontology is **merged** into the new employee's `ekg/` directory. This is the "from day one, the agent knows industry standards" effect — the palpable sense of "veteran expertise" is entirely supported by this foundational tier.

### Relationship to Existing Workspace Files

The `ekg/` directory **complements** — not replaces — the existing workspace files:

| File | Purpose | Relationship to EKG |
|------|---------|-------------------|
| `SOUL.md` | Identity, personality | Unchanged — defines *who* the agent is |
| `AGENTS.md` (`## Hard Rules`) | Hard safety boundaries | Summary rules derived from `ekg/rules/` pillar; provides a human-readable constraint layer that overrides everything |
| `BOOTSTRAP.md` (`## Enterprise Context`) | Enterprise overview | High-level summary of `ekg/org/` pillar; the "executive brief" for quick reference |
| `SKILL.md` files | Procedural knowledge | Procedures that *use* EKG data; reference `ekg/` pillars for specifics |
| `ekg/` directory | Structured knowledge graph | Deep, structured, machine-queryable knowledge — the detailed backing store |

### Knowledge Ingestion from All Sources

| Knowledge Source | Integration | EKG Pillar(s) |
|-----------------|-------------|---------------|
| Company directory / HR exports | Data Scavenger → `ekg/org/` | Org & Identity |
| Policy documents (PDF, DOCX) | Data Scavenger → `ekg/rules/` | Rules & Compliance |
| Product catalogs, pricing sheets | Data Scavenger → `ekg/assets/` | Assets & Knowledge |
| Historical contracts, templates | Data Scavenger → `ekg/assets/` | Assets & Knowledge |
| Internal wikis | `web_fetch` + browser → Data Scavenger | All pillars |
| Databases (CRM, ERP, HRIS) | MCP servers for real-time access | Live queries, not cached in EKG |
| Slack/Teams history | Channel plugins for context | Dynamic memory, not EKG |
| Daily task execution | Experience Link extraction | Workflows & Action |
| Q&A-based Completion | Human answers during work | All pillars (filling gaps) |

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

### Sentura Communication Panel

While OpenClaw's 22+ channel integrations handle **external** communication (employees living in Slack, Teams, etc.), Sentura adds a **dedicated communication hub** inside the admin dashboard — a WhatsApp/Slack-style chat panel for direct interaction with AI employees.

#### Why Not Use OpenClaw's Control UI Chat?

OpenClaw's Control UI provides a single-pane developer chat that can target any agent via session keys. However, it is designed as a developer tool, not an enterprise messaging experience:

- No conversation list or multi-conversation management
- No group chat or multi-agent coordination
- No RBAC, tenant scoping, or enterprise identity
- No audit integration for compliance

Sentura's Communication Panel is purpose-built for enterprise interaction patterns.

#### Dual-Mode Communication Model

Enterprises interact with AI employees through two complementary modes:

| Mode | Surface | Purpose | Who Uses It |
|------|---------|---------|-------------|
| **External Channels** | Slack, Teams, WhatsApp, etc. | Daily operations — employees live where humans work | All employees, all humans |
| **Dashboard Chat** | Sentura `/chat` page | Management, testing, debugging, coordination | Admins, managers, department leads |

**External Channels** (Mode A) are OpenClaw-native — employees are bound to channels via `bindings` config, and humans interact through their familiar tools. No Sentura work is required; this is OpenClaw's core strength.

**Dashboard Chat** (Mode B) is Sentura-specific — a unified messaging hub for enterprise management of AI employees.

#### 1:1 Direct Employee Chat

The dashboard provides a two-pane messaging interface:

```
┌─────────────────────┬──────────────────────────────────────────┐
│  Conversations      │  Chat with GradSale Support              │
│                     │                                          │
│  ● GradSale Support │  [Bot] Hi! I'm your GradSale CS agent.  │
│    "How can I help" │  How can I help today?                   │
│                     │                                          │
│  ○ AP Clerk Finance │  [You] Can you look up order #4521?      │
│    "Invoice #1092…" │                                          │
│                     │  [Bot] Sure! Order #4521 was placed on   │
│  ○ SDR Outbound     │  March 15 by customer Jane Doe...        │
│    "3 new leads…"   │                                          │
│                     │  ┌──────────────────────────────────────┐ │
│  [+ New Chat]       │  │  Type a message…              [Send] │ │
│                     │  └──────────────────────────────────────┘ │
└─────────────────────┴──────────────────────────────────────────┘
```

**Technical implementation** — uses OpenClaw's existing gateway RPCs with zero core modifications:

| Action | Gateway RPC | Details |
|--------|-------------|---------|
| Start conversation | `sessions.create` | Pass `agentId` to target a specific employee; returns `sessionKey` |
| Send message | `chat.send` | Pass `sessionKey` + `message`; agent resolved from key |
| Receive streaming response | WebSocket `chat` events | Gateway broadcasts `state: "delta"` / `"final"` events |
| Load history | `chat.history` | Pass `sessionKey` to retrieve transcript |
| List conversations | `sessions.list` | Returns all dashboard sessions with metadata |
| Cancel response | `chat.abort` / `sessions.abort` | Interrupt a running agent turn |

Session keys encode the target agent: `agent:<agentId>:dashboard:<uuid>`. The gateway's `resolveSessionAgentId` extracts the agent from the key, so each conversation is automatically routed to the correct employee. Sessions persist in OpenClaw's per-agent session stores and survive page reloads.

#### Group Chat (Multi-Agent + Human Coordination)

For tasks requiring multiple AI employees — "prepare the quarterly report" involving finance, sales, and marketing agents — Sentura provides group chat rooms:

```
┌──────────────────────────────────────────────────────┐
│  #Q4-Report  (3 agents, 1 human)                     │
│                                                      │
│  [Manager] Team, I need the Q4 report by Friday.     │
│  AP Clerk, pull the financial summary.               │
│  CS Agent, compile the support metrics.              │
│  SDR, get the sales pipeline numbers.                │
│                                                      │
│  [AP Clerk Finance] On it. Pulling revenue data      │
│  from the ERP now...                                 │
│                                                      │
│  [CS Agent] I'll query our ticketing system for      │
│  Q4 resolution times and CSAT scores.                │
│                                                      │
│  [SDR Outbound] Fetching pipeline data from CRM.     │
│  I'll have the numbers in a moment.                  │
└──────────────────────────────────────────────────────┘
```

**Architecture**: OpenClaw sessions are 1:1 (one session key maps to one agent), so group chat requires a Sentura orchestration layer:

- Each group maintains N underlying OpenClaw sessions (one per participating agent)
- When a human sends a message, the Sentura layer fans it out to relevant agent sessions via `sessions.send`
- Agent responses stream back and are merged into a unified thread with agent attribution
- Human participants are managed at the Sentura layer (messages stored in Sentura state, displayed in thread, forwarded to agent sessions)
- Group metadata (participants, name, purpose) stored in a Sentura-managed data store

#### Enterprise Interaction Strategy

| Interaction Pattern | Recommended Surface | Example |
|----|-----|---------|
| **Daily operations** | External channels (Slack, Teams) | CS Agent answers support tickets in `#support` |
| **Management & admin** | Dashboard 1:1 chat | Manager reviews AP Clerk's invoice handling |
| **Cross-team coordination** | Dashboard group chat | "Prepare quarterly report" with 3 agents |
| **Onboarding & testing** | Dashboard 1:1 chat | Test new employee before deploying to production channels |
| **Debugging & tuning** | Dashboard 1:1 chat | Investigate why an employee gave an incorrect response |

---

## 8. LLM Abstraction — 51 Provider Extensions

### Provider Flexibility

OpenClaw `2026.6.2` ships **51 provider-capable extensions** and **71 provider ids** out of the box (counted from `providers`, `providerRequest`, and `modelCatalog` fields in `openclaw/extensions/*/openclaw.plugin.json`; see `docs/OPENCLAW.md §21` for the catalog). Sentura enterprises can choose any combination:

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
| +20 more | Various | Specialized / regional providers (Qwen, DeepSeek, Moonshot, Qianfan, Volcengine, xAI, …) |

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
- **Sentura adds** (Layers 1, 4–5): Position-specific Hard Rules inside each employee's `AGENTS.md`, decision-context-aware approvals (e.g., "approve if refund < $500"), skill-level safety sections, escalation chains, timeout policies, enterprise-wide data classification, audit requirements

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: SKILL-LEVEL GUARDRAILS              [SENTURA]  │
│  Each SKILL.md has a ## Safety section with hard rules   │
│  "NEVER approve payment without matching PO > $10K"      │
├──────────────────────────────────────────────────────────┤
│  Layer 2: TOOL POLICIES                       [OPENCLAW] │
│  Tool allowlists/denylists per agent config              │
│  DEFAULT_GATEWAY_HTTP_TOOL_DENY blocks dangerous tools   │
├──────────────────────────────────────────────────────────┤
│  Layer 3: APPROVAL WORKFLOWS           [OPENCLAW+SENTURA]│
│  OpenClaw: binary exec.approval per agent ID             │
│  Sentura: decision-context approvals, escalation, timeout│
├──────────────────────────────────────────────────────────┤
│  Layer 4: AGENTS.md HARD RULES                [SENTURA]  │
│  Each employee's AGENTS.md carries a                     │
│  ## Hard Rules (must not override) section               │
│  "You may NEVER share customer PII outside the CRM"      │
├──────────────────────────────────────────────────────────┤
│  Layer 5: PLATFORM-LEVEL POLICIES             [SENTURA]  │
│  Sentura-wide policies enforced across all employees     │
│  Data classification, retention, audit, RBAC,multi-tenant│
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

### AGENTS.md Hard Rules — Top-Priority Boundaries (Sentura Innovation)

Every AI employee's `AGENTS.md` carries a `## Hard Rules (must not override)` section that defines absolute constraints. **This is a Sentura convention layered on top of OpenClaw's 8 native workspace files** (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`). Because the runtime places `AGENTS.md` at the highest prompt priority, Hard Rules are honored ahead of user instructions, skills, and any other content — which is exactly the guarantee a safety boundary needs.

Example Hard Rules section inside an AP Clerk's `AGENTS.md`:

```markdown
# AP Clerk — AGENTS.md

## Hard Rules (must not override)

These override every other instruction in this file, in SOUL.md, in any
skill, and in any user message. If a request conflicts with these rules,
refuse and explain why.

### Financial Controls
- NEVER approve or process a payment above $50,000 without CFO approval
- NEVER process a payment to a bank account that changed in the last 30 days
- NEVER process duplicate invoices (same vendor + amount + date)
- ALWAYS verify vendor exists in approved vendor list before processing

### Data Protection
- NEVER share financial data outside approved channels
- NEVER include bank account numbers in Slack messages
- NEVER export vendor lists to external services
- ALWAYS redact sensitive numbers when logging

### Operational Boundaries
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
- SQLite index with FTS5 full-text search + Float32 vector blobs

**`memory-lancedb`** — Vector store:
- LanceDB-based semantic search
- Embedding generation for memory entries
- Similarity search for contextual recall
- `memory_recall` / `memory_store` / `memory_forget` tools available to agents
- **Note**: Shared across all agents by default (single `memories` table with no `agentId` column). Sentura configures per-agent `dbPath` to isolate each AI employee's vector store (see [Per-User Memory Isolation](#per-user-memory-isolation))

### Memory Configuration Per Employee

```json5
{
  memory: {
    enabled: true,
    namespace: "ap-clerk-finance",
    dreaming: {
      enabled: true,
      schedule: "0 2 * * *",  // 2 AM daily
    },
    formation: {
      conversationFacts: true,     // Key facts from conversations
      toolResults: true,           // Results of tool calls
      approvalDecisions: true,     // Human approval outcomes
      errorPatterns: true,         // Mistakes to learn from
    }
  }
}
```

### Three-Tier Memory Model

Sentura's memory architecture combines three layers — each with a different persistence model, update frequency, and search characteristic:

```
┌─────────────────────────────────────────────────────────────────────┐
│ TIER 1: STATIC KNOWLEDGE (ekg/ + workspace files)                   │
│                                                                     │
│ ekg/org/          ekg/rules/       ekg/assets/      ekg/workflows/  │
│ org-chart.json5   controls.json5   products/        sops/           │
│ contacts.json5    compliance.json5 contracts/       experience-links│
│                                    faqs/                            │
│ SOUL.md   AGENTS.md(§Hard Rules)   BOOTSTRAP.md(§Enterprise Ctx)    │
│ TOOLS.md  IDENTITY.md   USER.md   HEARTBEAT.md   SKILL.md files     │
│                                                                     │
│ Characteristics: Structured, version-controlled, human-editable,    │
│ auto-indexed by OpenClaw's workspace file scanner                   │
├─────────────────────────────────────────────────────────────────────┤
│ TIER 2: DYNAMIC EPISODIC MEMORY (LanceDB vector store)              │
│                                                                     │
│ Conversations → facts extracted → embedded → stored in LanceDB      │
│ Tool results, approval decisions, error patterns                    │
│ Searched via memory_search (hybrid FTS + vector + temporal decay)   │
│                                                                     │
│ Characteristics: Automatic, continuous, forgettable, searchable     │
├─────────────────────────────────────────────────────────────────────┤
│ TIER 3: LIVE DATA (MCP server queries)                              │
│                                                                     │
│ CRM records, ERP transactions, support tickets, real-time state     │
│ Queried on-demand via MCP tools — never cached in EKG               │
│                                                                     │
│ Characteristics: Always current, not stored, access-controlled      │
└─────────────────────────────────────────────────────────────────────┘
```

### How EKG Integrates with OpenClaw's Memory System

OpenClaw's workspace file scanner **automatically indexes** all files under the agent's workspace directory — including the `ekg/` subdirectory. This means:

1. **Automatic chunking:** Each JSON5 file in `ekg/` is chunked and embedded into the SQLite + LanceDB vector index alongside SOUL.md, AGENTS.md (including its Hard Rules section), BOOTSTRAP.md (including its Enterprise Context section), and SKILL.md files.
2. **Hybrid search:** When an agent calls `memory_search` with a query like "who approves purchases over $50K?", the system runs both FTS (keyword match against JSON5 field names) and vector similarity (semantic match against embedded chunks) — returning the relevant `ekg/org/org-chart.json5` entries.
3. **Structured + semantic:** Because `ekg/` files use consistent JSON5 schemas with explicit field names (`type: "reports_to"`, `limit: "$50000"`), FTS catches exact matches while vector search catches semantic queries that don't use those exact terms.

### Dreaming Extensions for EKG

OpenClaw's dreaming system operates in 3 phases — **light** (frequent, surface-level), **deep** (daily, thorough), and **REM** (weekly, creative consolidation). Sentura extends the dreaming cycle with EKG-specific behaviors:

- **Experience Link extraction:** During the deep dreaming phase, the system reviews recent task completions, identifies repeated patterns, and generates candidate Experience Links with initial confidence scores.
- **Confidence promotion:** The REM phase evaluates existing Experience Links against new evidence. Links that recur across multiple tasks see their `confidence` score increase. Links above the configurable promotion threshold are written to `ekg/workflows/experience-links/` as permanent knowledge.
- **Gap detection:** The light dreaming phase scans `ekg/` files for missing required fields (null values, empty relations) and queues Q&A-based Completion questions for the next human interaction.

### Per-User Memory Isolation

Sentura extends OpenClaw's single-user memory system with **two-tier isolation** to support enterprise multi-user scenarios where many humans interact with the same AI employee.

#### The Problem

OpenClaw has two independent memory layers with different isolation behaviors:
- **`memory-core`** (SQLite index + FTS + vector blobs) — **naturally per-agent isolated**. The manager instance is keyed by agent ID, so each agent automatically gets its own SQLite index.
- **`memory-lancedb`** (LanceDB vector store) — **shared by default** across all agents. The table schema has no `agentId` column; all agents write to the same `memories` table at `~/.openclaw/memory/lancedb` unless separate `dbPath` values are configured per agent.

Neither layer has any concept of a "user" — when multiple humans interact with the same agent, their memories are interleaved.

#### Architecture: Two-Tier Isolation (Agent + User)

```
  TIER 1: AGENT-LEVEL ISOLATION (each AI employee gets its own vector store)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │  AP Clerk (dbPath: ~/.openclaw/memory/ap-clerk/)                        │
  │  ┌─────────────────────────────────────────────────────────────────┐    │
  │  │  SHARED (unified per AI employee, 8 native files)               │    │
  │  │  AGENTS.md (+ § Hard Rules)  SOUL.md  TOOLS.md  IDENTITY.md     │    │
  │  │  USER.md  HEARTBEAT.md  BOOTSTRAP.md (+ § Enterprise Context)   │    │
  │  │  MEMORY.md (general, no PII)   ekg/   skills/                   │    │
  │  └─────────────────────────────────────────────────────────────────┘    │
  │                                                                         │
  │  TIER 2: USER-LEVEL ISOLATION (within each agent's vector store)       │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
  │  │ User A       │  │ User B       │  │ User C       │                  │
  │  │              │  │              │  │              │                  │
  │  │ Sessions:    │  │ Sessions:    │  │ Sessions:    │                  │
  │  │  sess-A-001  │  │  sess-B-001  │  │  sess-C-001  │                  │
  │  │              │  │              │  │              │                  │
  │  │ LanceDB:     │  │ LanceDB:     │  │ LanceDB:     │                  │
  │  │  userToken   │  │  userToken   │  │  userToken   │                  │
  │  │  filter      │  │  filter      │  │  filter      │                  │
  │  │              │  │              │  │              │                  │
  │  │ MEMORY_A.md  │  │ MEMORY_B.md  │  │ MEMORY_C.md  │                  │
  │  └──────────────┘  └──────────────┘  └──────────────┘                  │
  └─────────────────────────────────────────────────────────────────────────┘
```

#### Mechanism 0: Agent-Level LanceDB Isolation (Prerequisite)

Each AI employee gets its own LanceDB vector store by configuring per-agent `dbPath` in the `memory-lancedb` plugin config. During agent creation (Creator Agent Phase 2), `memory-lancedb.dbPath` is set to `~/.openclaw/memory/{agentId}/lancedb`. The `sentura-setup.sh` script sets the same convention for meta-agents. This requires no OpenClaw core changes — `memory-lancedb` already supports per-config `dbPath` via `api.resolvePath(cfg.dbPath)`. `memory-core` already isolates by agent automatically, so no change is needed there.

#### Mechanism 1: User Token System

Each platform user gets a `userToken` (UUID) assigned at account creation (stored in the `sentura-rbac` user store). The token is attached to every WebSocket connection and propagated into session context. Session keys include the user token: `agent:<agentId>:user:<userToken>:<sessionId>`. This ensures sessions are naturally partitioned — `sessions.list` filtered by user token returns only that user's conversations.

#### Mechanism 2: LanceDB User-Level Metadata Partitioning

Within each agent's isolated LanceDB store, entries are further partitioned by user. The memory entry schema is extended with a `userToken` metadata field:

- When `autoCapture` stores a memory from a conversation, the `userToken` from the session context is added to the entry
- When `autoRecall` or `memory_search` runs, the query is **filtered** by `userToken` to return only memories from that user's interactions **plus** global memories (entries where `userToken` is null)
- Memories without a `userToken` (system-generated, dreaming outputs, EKG entries) are **global** and visible to all users of that agent
- Implemented via a Sentura memory extension that wraps `memory-lancedb` hooks, not by modifying OpenClaw core

The combined result: Agent A's LanceDB only contains Agent A's memories (Mechanism 0), and within that, User X only sees User X's personal memories + Agent A's global memories (Mechanism 2).

#### Mechanism 3: Dual MEMORY.md System

- **MEMORY.md** (general): Exists at the workspace root. Contains general, recurring observations that apply to all users. Updated by the dreaming system. Examples: "Invoices over $10K always require CFO approval", "The accounting system is slow on month-end close days."
- **MEMORY_USER_{token}.md** (per-user): Stored in `memory/users/` under the workspace. Contains personal memories specific to one user's interaction history. Examples: "User prefers concise responses", "User's team handles APAC region accounts", "User asked me to always CC finance@acme.com on approvals."

The `sentura-bootstrap` hook — the single remaining Sentura-specific bootstrap extension — injects the current user's `MEMORY_USER_{token}.md` into the prompt alongside the general `MEMORY.md`, giving each user a personalized experience while keeping the agent's core identity unified. (Hard Rules and Enterprise Context are **not** hook-injected; they live inside `AGENTS.md` and `BOOTSTRAP.md` respectively, which the runtime already loads natively.)

#### Dreaming Integration for Per-User Memory

The dreaming system is extended for user-aware consolidation:
- **General promotion**: Patterns observed across multiple users are promoted to general `MEMORY.md` (e.g., "3 different users asked about the same policy — this is important general knowledge")
- **Personal promotion**: Patterns specific to one user stay in their `MEMORY_USER_{token}.md`
- **Privacy boundary**: Per-user memories are never leaked into general memory if they contain user-specific context

### Memory Use Cases

| Use Case | Static (EKG) | Dynamic (LanceDB) | Live (MCP) |
|----------|-------------|-------------------|------------|
| **Invoice Processing** | `ekg/rules/financial-controls.json5` — approval thresholds, compliance chains | Remembers vendor payment patterns, flags deviations | Real-time invoice data from ERP |
| **Customer Support** | `ekg/assets/faqs/` — product FAQ pairs, known issue resolutions | Recalls previous interactions with the same customer | Live ticket status from Zendesk |
| **SDR Outreach** | `ekg/org/contacts.json5` — key personnel, decision-makers | Tracks which leads were contacted, their responses | CRM pipeline data from Salesforce |
| **Compliance** | `ekg/rules/compliance-policies.json5` — regulatory requirements, red lines | Accumulates regulatory knowledge from past reviews | Current regulation database queries |
| **Cross-Dept Work** | `ekg/workflows/experience-links/` — tacit rules learned from operations | Remembers past collaboration outcomes | Live project status from PM tools |

---

## 11. Observability & Traceability

### Built-in Diagnostics

OpenClaw `2026.6.2` exposes diagnostic events through the stable `openclaw/plugin-sdk/diagnostic-runtime` SDK subpath. Sentura's cost and monitoring extensions subscribe to that in-process diagnostic bus; the upstream `diagnostics-otel` extension remains the optional OpenTelemetry exporter when an OTLP collector is configured.

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
| **Manager** | All employees in their scope — task execution traces, performance metrics, approval histories |
| **EKG Manager** | Knowledge ingestion traces, Data Scavenger outputs, MCP Builder logs |
| **Agent Manager** | Their assigned AI employees — configuration changes, skill deployments, tool execution traces |
| **Auditor** | Read-only access to audit logs, compliance traces, and cost reports across all employees |
| **End User** | Own session history only (filtered by `userToken`) |
| **Viewer** | Read-only dashboards — aggregate metrics, cost reports, employee status (no session-level traces) |

---

## 12. Multi-Agent Orchestration

### Mode B — AI Project Manager

For complex tasks that span multiple AI employees, Sentura deploys an **AI Project Manager (Orchestrator)** — a special OpenClaw agent that decomposes work, coordinates across the workforce, and maintains a **macro-level knowledge base** that aggregates intelligence from all subordinate AI employees.

### Orchestration via OpenClaw Subagents

OpenClaw's subagent system (`sessions_spawn`, `sessions_send`, `sessions_yield`) provides the primitives for multi-agent coordination:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI MANAGER (ORCHESTRATOR)                    │
│                                                                 │
│   ekg/capabilities/    — knows what each employee CAN do        │
│   ekg/conflicts/       — detected cross-domain contradictions   │
│   ekg/insights/        — systemic patterns from operations      │
│   ekg/global-sops/     — cross-departmental SOPs (boss-approved)│
│                                                                 │
│   Receives macro-objective ──▶ Decomposes into tasks            │
│   Routes tasks by capability ──▶ Monitors progress              │
│   Detects conflicts ──▶ Escalates to admin                      │
│   Identifies patterns ──▶ Reverse-injects training              │
└──────────┬───────────────┬──────────────────┬───────────────────┘
           │               │                  │
  ┌────────▼───┐   ┌───────▼──────┐   ┌───────▼──────┐
  │ AP Clerk   │   │ Legal Agent  │   │ Sales Agent  │
  │ ekg/rules/ │   │ ekg/rules/   │   │ ekg/assets/  │
  │ ekg/assets/│   │ ekg/assets/  │   │ ekg/workflows│
  └────────────┘   └──────────────┘   └──────────────┘
```

### Subagent Communication

```json5
// AI Manager spawns a task to the AP Clerk
{
  tool: "sessions_send",
  args: {
    sessionKey: "ap-clerk-finance",
    message: "Process all outstanding Q4 invoices and provide a summary with total amounts by vendor. Flag any that are overdue by more than 30 days."
  }
}

// AI Manager checks progress
{
  tool: "sessions_history",
  args: {
    sessionKey: "ap-clerk-finance",
    limit: 5
  }
}
```

### AI Manager EKG — The Macro-Level Knowledge Base

The Orchestrator's `ekg/` directory has a different structure from regular AI employees — focused on **aggregation and coordination** rather than individual domain knowledge:

```
~/.openclaw/workspace/orchestrator/
  ekg/
  ├── capabilities/                         # Mechanism 1: Capability Abstraction
  │   ├── legal-specialist.json5            # { capabilities, inputSchema, outputSchema }
  │   ├── finance-specialist.json5
  │   └── sales-specialist.json5
  ├── conflicts/                            # Mechanism 2: Cross-Domain Stitching
  │   ├── shipping-policy-conflict.json5    # Detected conflict + resolution status
  │   └── resolved/                         # Boss-confirmed resolutions → Global SOPs
  ├── insights/                             # Mechanism 3: Top-Down Training
  │   ├── contract-rejection-pattern.json5  # "80% of rejections lack penalty clause"
  │   └── injected/                         # Directives pushed to employee agents
  └── global-sops/                          # Cross-departmental SOPs
      └── contract-approval-flow.json5
```

### Mechanism 1: Capability Abstraction

The AI Manager does not need to know the specific formulas a Finance Specialist uses to calculate tax rates; it merely needs to know *what* the Finance Specialist can do and *what inputs* are required.

When a new employee is incubated, the Creator Agent automatically extracts **Capability Tags** and **I/O Schemas** and writes them to the Orchestrator's `ekg/capabilities/`:

```json5
// ekg/capabilities/legal-specialist.json5
{
  agentId: "legal-specialist",
  capabilities: [
    { tag: "contract_risk_review", description: "Review contracts for legal risks and compliance issues" },
    { tag: "regulatory_compliance", description: "Verify actions against applicable regulations" },
  ],
  inputSchema: { required: ["contract_text", "business_context"], optional: ["urgency_level"] },
  outputSchema: { produces: ["risk_assessment_report", "compliance_checklist"] },
  lastUpdated: "2026-04-08"
}
```

This constructs the foundational "map" that enables the AI Manager to accurately route tasks: "Legal Specialist → Expertise: Reviewing Contract Risks → Input: Contract Text & Business Context → Output: Risk Assessment Report."

### Mechanism 2: Cross-Domain Conflict Detection

Knowledge possessed by individual specialists often exists in isolated silos. The Manager's responsibility is to bridge them.

**Conflict scenario:** The Sales Specialist's `ekg/rules/` contains "Ship goods immediately after customer places an order." The Finance Specialist's `ekg/rules/` contains "Goods must not be shipped until full payment received."

A **cron-triggered skill** on the Orchestrator:
1. Reads all employee capability files and rule summaries
2. Detects rule conflicts across departments (LLM reasoning over structured JSON5)
3. Creates conflict entries requiring human resolution
4. Escalates to the admin via the approval system: "There is a conflict between Sales and Finance regarding shipping protocols. Whose rules should take precedence, or is there a compromise?"
5. Once resolved, writes a **Cross-Departmental Global SOP Link** — a directive that supersedes both individual departments' rules

```json5
// ekg/conflicts/resolved/shipping-policy.json5
{
  id: "conflict-2026-04-08-001",
  departments: ["sales", "finance"],
  description: "Sales policy requires immediate shipping; Finance requires payment first",
  resolution: "Ship immediately for orders under $10K from verified customers; hold for payment above $10K or new customers",
  resolvedBy: "admin@acme.com",
  resolvedAt: "2026-04-08",
  globalSopRef: "ekg/global-sops/shipping-conditions.json5"
}
```

### Mechanism 3: Top-Down Training (Reverse Injection)

This is where the AI Manager truly demonstrates its value as "management" — proactively identifying systemic issues and training employees.

**Experience synthesis:** After orchestrating hundreds of tasks, the Manager accumulates workflow duration data and error-return records. A periodic analysis skill:
1. Reviews task completion patterns across employees (via `sessions_history`)
2. Identifies systemic issues — e.g., "80% of contracts returned by Legal to Sales were rejected because they lacked a penalty-for-breach clause"
3. Generates an optimization directive
4. **Reverse-injects** it by writing a new rule into the Sales Specialists' `ekg/rules/` or a new skill into their `skills/`:

```json5
// Injected into sales-specialist's ekg/rules/contract-drafting-rules.json5
{
  rule: "mandatory_breach_penalty_clause",
  description: "All contracts must include a penalty-for-breach clause before submission to Legal",
  source: "orchestrator_insight",
  insight: "80% of Legal rejections in Q1 were due to missing breach penalty clauses",
  injectedAt: "2026-04-08",
  injectedBy: "orchestrator"
}
```

When the AI Manager can proactively identify tasks and delegate training to subordinate employees, it evolves into a **"Digital VP of Business Operations"** — comprehending the big picture, routing tasks, and offering autonomous recommendations.

### Cross-Employee Knowledge Sharing

AI employees share information through:

1. **Direct messaging** — `sessions_send` between agent sessions
2. **Shared skills** — common skill files in a shared directory
3. **Channel messages** — post updates to shared Slack/Teams channels
4. **Manager EKG** — the Orchestrator's `ekg/capabilities/` provides a global view of what every employee can do
5. **Global SOPs** — the Orchestrator's `ekg/global-sops/` provides cross-departmental rules that override individual agent rules
6. **Reverse injection** — the Manager pushes new rules and skills into employee workspaces based on systemic pattern analysis

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
  4. Verifies change doesn't conflict with AGENTS.md Hard Rules
  5. Confirms change to human
```

### What Can Be Tuned

| Aspect | Tuning Mechanism |
|--------|-----------------|
| **Personality/Tone** | Modify SOUL.md |
| **Skills** | Add/modify/remove SKILL.md files |
| **Rules & Boundaries** | Modify the `## Hard Rules` section inside `AGENTS.md` (requires admin approval) |
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

- **Cannot remove safety rules** — modifications to the `## Hard Rules` section of `AGENTS.md` require admin approval
- **Cannot escalate tool access** — adding dangerous tools requires admin approval
- **Version history** — every change is tracked with before/after diffs
- **Recovery** — Sentura-owned writes leave redacted diff records in `~/.openclaw/logs/sentura-config-diffs.jsonl`, and OpenClaw still keeps its native config backups/audit trail for operator-led rollback

---

## 14. Integration Layer — MCP & OpenClaw Extensions

### Model Context Protocol (MCP)

MCP is the primary integration mechanism. Enterprise systems are exposed as **MCP servers** that AI employees can call as tools.

> **What OpenClaw provides**: The global `mcp.servers` config section, per-workspace `config.json5 -> mcpServers`, `@modelcontextprotocol/sdk` for stdio/SSE/streamable-HTTP transports, and the MCP loopback server for exposing OpenClaw's own tools. **What Sentura builds**: The enterprise integration pipeline — discovering internal APIs, organizing endpoints into typed MCP tools, generating MCP server code or config, wiring credentials from the secret store, and deploying servers for each AI employee. OpenClaw contains **zero enterprise-specific connectors** (no Salesforce, SAP, Zendesk, Workday, etc.) — all of these must be built, sourced from open-source MCP servers, or auto-generated by Sentura during onboarding.

### Enterprise MCP Strategy

Sentura's integration approach has three tiers:

| Tier | Source | Example |
|------|--------|---------|
| **Open-source MCP servers** | npm packages (`@mcp-servers/*`, community) | Salesforce, Jira, PostgreSQL, Slack |
| **Sentura-generated MCP servers** | Generated by the **MCP Builder Agent** from enterprise API docs (OpenAPI specs, markdown docs, database schemas) | Custom REST APIs, internal microservices |
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

### MCP Builder Agent

The MCP Builder is a **Sentura meta-agent** (not just a CLI tool) that takes API documentation as input and produces a working, OpenClaw-compatible MCP server as output. The EKG Manager triggers it through the dashboard.

**Input sources:**

| Source Type | Format | Example |
|-------------|--------|---------|
| OpenAPI/Swagger specs | JSON or YAML | `openapi.json`, `swagger.yaml` |
| Markdown API documentation | Markdown with endpoint descriptions | `ekg/api-web.md`, `ekg/api-admin.md` |
| Database schema documentation | Markdown or SQL DDL | `ekg/database.md` |
| Raw URL | URL to an API docs page (agent uses `web_fetch`/`browser` to scrape) | `https://api.example.com/docs` |

**Output:** A TypeScript MCP server project stored at `sentura/mcp-servers/{name}/`:

```
sentura/mcp-servers/gradsale-api/
├── index.ts                  # MCP server entry point using @modelcontextprotocol/sdk
├── tools/                    # Individual tool definitions with Zod input schemas
│   ├── users.ts
│   ├── orders.ts
│   └── products.ts
├── package.json              # Dependencies
└── config-snippet.json5      # config.patch fragment to register this server in OpenClaw
```

**Why an agent instead of a script:**
- API docs come in wildly different formats — LLM reasoning is needed to understand them
- Endpoint grouping into tools requires semantic understanding
- Auth pattern detection requires analyzing examples and headers
- Error handling and retry logic generation benefits from LLM code generation
- The agent can ask the EKG Manager clarifying questions ("I see a `/users/{id}` endpoint — should this be read-only or should I also generate create/update/delete tools?")

**Architecture flow:**

```
EKG Manager uploads API docs via dashboard
  → MCP Builder Agent analyzes docs
    → Extracts endpoints, parameters, auth requirements
    → Groups endpoints into logical tool categories
    → Generates TypeScript MCP server code
    → Generates tool definitions with Zod input schemas
    → Generates config-snippet.json5 for registration
    → Writes output to sentura/mcp-servers/{name}/
  → EKG Manager reviews generated server
  → Agent Manager wires MCP server to relevant AI employees via config.patch
```

**Access control:** Only the `ekg_manager` role can trigger the MCP Builder, since it involves importing external API definitions into the platform's knowledge/tool layer.

### Enterprise MCP Server Pattern

Until the MCP Builder Agent is fully autonomous (Week 5+), Sentura contributors hand-write enterprise MCP servers following a stable three-step pattern. The reference implementation lives at [`sentura/mcp-servers/gradsale-admin/`](../sentura/mcp-servers/gradsale-admin/README.md) and wraps the GradSale admin API documented in `ekg/api-admin.md`.

**Step 1 — API docs → tool registry.** Read the markdown API reference (or OpenAPI spec) and translate each endpoint into one entry in a `TOOLS: ToolDefinition[]` array. Each entry carries:

```ts
interface ToolDefinition<S extends RawShape> {
  name: string;          // snake_case, prefixed with {vendor}_{surface}_ (e.g. gradsale_admin_)
  title: string;         // short human-readable title shown in the MCP client UI
  description: string;   // includes the HTTP endpoint for auditor traceability
  endpoint: string;      // "VERB /api/path" — canonical link back to ekg/*.md
  mutates: boolean;      // drives MCP destructiveHint + read-only filtering
  inputShape: S;         // raw Zod shape (Record<string, ZodTypeAny>) — NOT z.object(...)
  handler: (client, args) => Promise<unknown>;
}
```

Two non-obvious rules:

- **Raw shapes, not `z.object`.** The MCP SDK's `server.registerTool()` expects a `Record<string, ZodTypeAny>`, not a full `z.object()` — passing the latter breaks input validation silently. Cross-field validation (e.g. "rejectionReason is required when decision is 'rejected'") must live in the `handler`, not in a `.refine()`.
- **`mutates` is load-bearing.** It is mirrored onto the MCP tool as `annotations.destructiveHint: true` so the Sentura approval extension can route write actions through HITL. Auditor/analyst personas set `readOnly: true` in the server's env config, which strips all mutating tools from the catalog entirely.

**Step 2 — MCP server wiring.** A single `server.ts` loads config from env vars, instantiates an `McpServer`, and calls `server.registerTool()` for each entry in `listTools({ readOnly })`. The handler returns `{ content: [{ type: "text", text: JSON.stringify(result) }] }` on success or `{ isError: true, content: [...] }` on failure. All HTTP plumbing (JWT auth, timeouts, error envelopes) is isolated in a small `client.ts` so the tools remain thin facades.

**Step 3 — wire the server into the right scope.** Shared/operator-managed servers still belong in global `openclaw.json -> mcp.servers.<name>`. Employee-local self-provisioned servers now default to `~/.openclaw/workspace/<agentId>/config.json5 -> mcpServers.<name>` via `sentura.agents.upsertMcpServers` / `sentura_agents_manage { action: "upsert_mcp_servers" }`. In both cases, the entry must be a flat map keyed by server name — not `mcp.servers.entries.<name>` or any other nested shape. Spawn with `command: "node"` pointing at the compiled entry (`dist/index.js`) rather than `pnpm --filter ... start`; OpenClaw launches MCP servers as child processes, so going through `pnpm` adds an unnecessary parent process and pulls workspace resolution into every agent start.

```ts
await gateway.rpc("sentura.agents.upsertMcpServers", {
  agentId: "dispute-resolver",
  mcpServers: {
    "gradsale-admin": {
      command: "node",
      args: ["./sentura/mcp-servers/gradsale-admin/dist/index.js"],
      env: {
        GRADSALE_API_URL: "https://admin.gradsale.example",
        GRADSALE_ADMIN_TOKEN: "$secret:/sentura/agents/dispute-resolver/gradsale/admin_token",
        GRADSALE_READ_ONLY: "false",
      },
    },
  },
});
```

Three properties this pattern guarantees:

1. **Auditability.** Every tool description carries its endpoint string, so any action in an approval queue or audit log can be traced back to exactly one line in `ekg/api-admin.md`.
2. **Persona-shaped catalogs.** `GRADSALE_READ_ONLY=true` turns the same server into a safe tool bundle for analyst personas — no code change, no new agent config file.
3. **Hermetic tests.** Because the HTTP client is injected, the same server can be connected to an MCP client via `InMemoryTransport` with a stubbed `fetch`, letting us write full "employee calls tool → tool hits API → employee sees response" integration tests that run in milliseconds.

This pattern is what the MCP Builder Agent (Section 14, above) will eventually automate — the hand-written gradsale-admin server is both the proof-of-concept and the code template.

### The ACP Extension

For advanced inter-agent communication, Sentura can leverage OpenClaw's `acpx` extension (Agent Client Protocol), which provides:
- Standardized agent-to-agent messaging
- Cross-gateway agent discovery
- Structured task delegation with typed responses

---

## 15. Security Model

> **Production hosting security**: For a detailed risk analysis per hosting type (Cloud VPS, VM, on-premise) and platform-wide security risks specific to AI agent workloads, see [`docs/HOSTING.md`](HOSTING.md#security--risk-analysis).

### Defense in Depth

Sentura inherits OpenClaw's security layers and adds enterprise-grade controls:

| Layer | OpenClaw Feature | Sentura Extension |
|-------|-----------------|-------------------|
| **Tool Policy** | Tool allowlists/denylists per agent | Per-department and per-role policies |
| **Sandbox** | Docker sandbox for non-main agents + two-stage tool-policy filter (see § 3 "Sandbox runtime — two-stage tool-policy filter") | Mandatory sandboxing for all AI employees |
| **DM Pairing** | Channel-level authentication | Enterprise SSO integration |
| **Approval Workflows** | `exec.approval` system | HITL with escalation and timeout |
| **Secret Management** | Encrypted secret store | Secret rotation, audit logging |
| **SSRF Protection** | Built-in SSRF guards | Extended for enterprise network topology |
| **Path Safety** | Directory traversal prevention | Workspace isolation per employee |
| **Audit Logging** | Security event logging | Centralized audit with retention policies |
| **Skill Scanning** | Skill content analysis | Mandatory scanning before deployment |

### Role-Based Access Control

Sentura uses a **7-role model** designed around the principle that supervision, knowledge management, and agent engineering are fundamentally different jobs. The old `dept_admin` and `employee_owner` roles are replaced with three targeted roles (`manager`, `ekg_manager`, `agent_manager`) that match real enterprise org structures.

**Scope model**: The platform's scope is determined by deployment context:
- **SME deployment**: roles apply to the whole organization
- **Department deployment**: roles apply within a single department boundary
- **Multi-department**: `platform_admin` spans all departments; other roles are assigned per department

| Role | Description | Resource Scope |
|------|-------------|----------------|
| **Platform Admin** | Full platform access. Manages deployment, LLM providers, system config, user accounts. Exists in both SME and department-scoped deployments. | All resources |
| **Manager** | Supervises all AI employee actions. Reviews task execution, approves/rejects high-risk decisions, monitors performance and compliance. The "boss" who watches agents work. | All agents in their scope (whole SME or department) |
| **EKG Manager** | The only role that can upload, construct, and update the Enterprise Knowledge Graph. Controls what knowledge enters the system. Cannot create or tune agents. Also the only role that can trigger the MCP Builder Agent to generate internal MCP servers from API documentation. | EKG resources: `ekg/` uploads, Data Scavenger triggers, industry ontology selection, knowledge review/approval, MCP Builder |
| **Agent Manager** | Creates and tunes AI employees. Designs agent personalities (SOUL.md), role protocol + Hard Rules (AGENTS.md), enterprise context (BOOTSTRAP.md), skills, tool allowlists, channel bindings, and MCP wiring. Cannot modify EKG content. | Agent config: SOUL.md, AGENTS.md (+ § Hard Rules), BOOTSTRAP.md (+ § Enterprise Context), skills/, tool allowlists, channel bindings, MCP wiring |
| **Auditor** | Read-only compliance view across all resources. Can view audit logs, compliance reports, approval histories, and cost attribution. | All resources (read-only) |
| **End User** | Normal users who interact with AI employees through channels and dashboard chat. Basic task requests, conversations, approval triggers. Each user is identified by a `userToken` that isolates their session history and personalized memory. | Own sessions, own approval requests |
| **Viewer** | Read-only access to dashboards and reports without agent interaction. Designed for executives and stakeholders who need visibility without operational access. | Read-only: dashboards, cost reports, employee status |

**Why 7 roles instead of the original 5:**
- `manager` separates the "supervisor" concern from technical agent/knowledge management
- `ekg_manager` enforces a critical security boundary — only authorized personnel can change what an AI employee "knows," preventing unauthorized knowledge injection that could alter agent behavior
- `agent_manager` separates agent design from knowledge management, reflecting real enterprise org structures where the person who configures a chatbot is not the same person who manages the company's knowledge base
- `viewer` addresses the common enterprise need for read-only dashboards (executives, stakeholders)

### User Token & Identity Isolation

Every platform user is assigned a **`userToken`** (UUID) at account creation, stored in the `sentura-rbac` user store. This token serves as the identity primitive for:

- **Session isolation**: Session keys include the user token (`agent:<agentId>:user:<userToken>:<sessionId>`), ensuring each user's conversation history is private
- **Memory partitioning**: LanceDB memory entries carry a `userToken` metadata field, so an agent's recall only returns the current user's memories plus global memories
- **Audit attribution**: Every action (LLM call, tool execution, approval event) is tagged with the `userToken` for compliance tracing

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

> **Production hosting guide**: For complete production deployment architecture, reverse proxy configuration, authentication modes, host requirements, security risk analysis, and deployment packaging across all target environments (Cloud VPS, VM, on-premise), see [`docs/HOSTING.md`](HOSTING.md).

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

Docker deployment is available for production environments. See `openclaw/docker-setup.sh` and `openclaw/docker-compose.yml`. For the full production topology (co-hosted Dashboard + Gateway behind a reverse proxy), auth mode selection, Nginx/Caddy configs, and security considerations, see [`docs/HOSTING.md`](HOSTING.md).

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

### Hybrid UI Architecture

The Sentura platform uses a **hybrid UI approach** with two complementary frontends:

- **Sentura Dashboard** (Next.js) — enterprise management features that OpenClaw's Control UI does not provide
- **OpenClaw Control UI** (Lit, served by gateway) — operational and developer tools already built into OpenClaw

Both UIs connect to the same gateway via WebSocket RPC. The Sentura Dashboard sidebar includes external links to the Control UI for operational tasks. In production, both are served from a single domain using path-based routing (see [`docs/HOSTING.md`](HOSTING.md)).

### Sentura Dashboard Features (Enterprise-Only)

1. **Employee Roster** — lifecycle management with status badges, health scores, and enterprise actions (create, clone, version, retire). Visible to `manager`, `agent_manager`, `platform_admin`; read-only for `viewer` and `auditor`
2. **Employee Creator** — natural language interface for creating new employees (talks to Creator Agent). Requires `agent_manager` or `platform_admin` role
3. **Live Tuning** — modify any employee's personality, skills, rules, tools in real-time. Requires `agent_manager` or `platform_admin` role
4. **Approval Queue** — pending HITL approvals with escalation status, decision context, approve/reject. Visible to `manager` and `platform_admin`
5. **Integration Manager** — view and manage MCP servers, self-provisioned credentials. `agent_manager` manages wiring; `ekg_manager` manages MCP Builder
6. **Cost Center** — LLM usage and cost tracking per employee, per scope. Read-only for `viewer` and `auditor`
7. **Audit Trail** — searchable, filterable, exportable log of all AI employee actions. `auditor` and `platform_admin`
8. **Orchestrator Dashboard** — Mode B multi-agent task decomposition and progress tracking. Visible to `manager` and `platform_admin`
9. **Knowledge Manager** — document upload, EKG curation, MCP Builder trigger, skill generation, cross-employee distribution. Requires `ekg_manager` role
10. **Testing** — pre-deployment scorecards, per-dimension scores, auto-tune history. `agent_manager` and `platform_admin`
11. **Settings** — SSO config, 7-role RBAC management, scope model (SME vs department), global approval policies, gateway connection. Requires `platform_admin`
12. **Communication Panel** — user-aware session list filtered by `userToken`; 1:1 employee conversations and multi-agent group chat. Available to `end_user`, `manager`, and `agent_manager`

### Deferred to OpenClaw Control UI

These features are **not rebuilt** in the Sentura Dashboard. Users access them via external links in the sidebar:

- Config Editor, Sessions & Chat, Debug Console, Logs, Cron Jobs, Skills Browser, Channel Status, Usage Stats

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
