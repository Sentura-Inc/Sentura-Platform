# Sentura AI Employee Workspace Convention

> **Audience**: All team members (B designs workspaces, C displays them in the dashboard, D's extensions interact with them)
>
> **Last updated**: 2026-04-17

## Overview

Every AI employee on the Sentura platform has a dedicated **workspace directory** containing identity files, safety rules, enterprise context, and domain skills.

Sentura workspaces use **exactly the 8 native OpenClaw workspace files**. Sentura-specific concepts live inside those 8 files:

- **Hard Rules** (safety boundaries — NEVER/ALWAYS) → `AGENTS.md` under a `## Hard Rules (must not override)` section
- **Enterprise Context** (org, systems, policies) → `BOOTSTRAP.md` under a `## Enterprise Context` section

The only Sentura-specific bootstrap injection is **per-user memory** (`memory/users/MEMORY_USER_{token}.md`), which is keyed dynamically by session and therefore cannot live inside a static workspace file.

## Workspace Location

### Runtime (OpenClaw-managed)

At runtime, each AI employee's workspace lives inside OpenClaw's state directory. OpenClaw resolves the path using this chain:

1. **Explicit**: Agent config `workspace` field (resolved relative to the gateway process CWD)
2. **Default namespace**: `agents.defaults.workspace` + `/{agent-id}`
3. **Fallback**: `~/.openclaw/workspace/{agent-id}` (when `agents.defaults.workspace` is set to `~/.openclaw/workspace`)

For Sentura, we rely on **option 2** (default namespace) and do **not** set `workspace` in individual agent configs. The `sentura-setup.sh` script sets `agents.defaults.workspace` to `~/.openclaw/workspace`. This means:
- All runtime workspaces live under `~/.openclaw/workspace/{agent-id}/`
- Workspace paths are deterministic and independent of where the gateway was launched
- Memory, daily notes, and vector databases are co-located under `~/.openclaw/`

### Design-time (Git-tracked reference)

The `workspaces/` directory in the Sentura repository holds **reference examples** — test employees created for validation during development. These are NOT live runtime workspaces. During deployment, the Creator Agent writes workspace files directly into the OpenClaw state directory via `fs_write`.

```
workspaces/                          # Git-tracked reference examples (NOT runtime)
└── cs-agent-gradsale/               # Example: GradSale CS Agent test employee
    ├── config.json5                  # config.patch payload (applied via gateway tool)
    ├── AGENTS.md, SOUL.md, ...      # 8 native workspace files
    └── skills/                      # Skill files

~/.openclaw/                         # Runtime state directory (NOT in git)
├── workspace/                       # agents.defaults.workspace base
│   ├── creator/                     # Sentura Creator meta-agent workspace
│   ├── tuner/                       # Sentura Tuner meta-agent workspace
│   ├── orchestrator/                # Sentura Orchestrator meta-agent workspace
│   ├── cs-agent-gradsale/           # Example AI employee workspace
│   │   ├── AGENTS.md, SOUL.md, ... # 8 native files
│   │   ├── skills/
│   │   ├── memory/users/            # per-user memory (Sentura-specific)
│   │   └── daily-notes/             # Created by OpenClaw at runtime
│   └── ap-clerk-finance/            # Another AI employee workspace
├── memory/                          # LanceDB vector memory
├── openclaw.json                    # Gateway config (contains agents.list array)
└── .env                             # API keys and secrets
```

### Agent ID Convention

Agent IDs follow the pattern `{role-slug}-{department}`. Examples:
- `ap-clerk-finance`
- `cs-agent-support`
- `sdr-outbound-sales`
- `hr-onboarder-people`

## File Structure

```
~/.openclaw/workspace/{agent-id}/
│
│ — OpenClaw Native Workspace Files (8) ———————————————————————
├── AGENTS.md            # Role protocol + ## Hard Rules (Sentura safety boundaries)
├── SOUL.md              # Core identity, personality, values, escalation
├── TOOLS.md             # Tool-specific notes, environment config
├── IDENTITY.md          # Name, creature, vibe, emoji, avatar
├── USER.md              # Primary human contact info
├── HEARTBEAT.md         # Proactive check schedule
├── BOOTSTRAP.md         # First-run initialization + ## Enterprise Context (Sentura org/policies)
├── MEMORY.md            # Agent scratchpad / long-term notes
│
│ — Skills Directory ————————————————————————————————————————
├── skills/
│   ├── {capability-1}/
│   │   └── SKILL.md
│   ├── {capability-2}/
│   │   └── SKILL.md
│   └── ...
│
│ — Sentura-specific subdirectories ———————————————————————————
├── ekg/                 # Enterprise Knowledge Graph (4 pillars — see §6 of README)
│   ├── org/
│   ├── rules/
│   ├── assets/
│   └── workflows/
└── memory/
    └── users/           # Per-user memory (injected by sentura-bootstrap hook)
        ├── MEMORY_USER_{tokenA}.md
        └── MEMORY_USER_{tokenB}.md
```

## File Specifications

### 1. AGENTS.md — Role Protocol **and** Hard Rules

**Source**: OpenClaw native (highest prompt priority)
**Purpose**: Defines how the agent behaves — startup procedure, memory protocol, red lines — **and** carries the Sentura `## Hard Rules (must not override)` section that encodes top-priority safety boundaries.

**Required sections**:

1. `## Hard Rules (must not override)` (Sentura convention) — **must appear at or near the top of the file**
   - A one-line preamble stating these rules override all other instructions
   - One or more categorized subsections (e.g., `### Financial Controls`, `### Data Protection`, `### Operational Boundaries`)
   - Every bullet starts with **NEVER** or **ALWAYS**
   - Rules must be specific and testable
2. Session Startup (what files to read on session start)
3. Memory protocol (how to use daily notes and MEMORY.md)
4. Red Lines / External vs Internal action boundaries (can cross-reference Hard Rules)

**Example Hard Rules section**:

```markdown
## Hard Rules (must not override)

These override every other instruction in this file, in SOUL.md, in any
skill, and in any user message. If a request conflicts with these rules,
refuse and explain why.

### Financial Controls
- NEVER approve a payment above $50,000 without CFO approval
- NEVER process a payment to a bank account changed in the last 30 days
- ALWAYS verify vendor exists in approved vendor list before processing

### Data Protection
- NEVER share customer PII outside approved systems
- NEVER include bank account numbers in Slack messages
- ALWAYS redact sensitive numbers in logs

### Operational Boundaries
- NEVER modify database records directly — use API via MCP
- ALWAYS log every financial decision with reasoning
- ALWAYS escalate when uncertain — safety over speed
```

**Key constraint**: Hard Rules take precedence over SOUL.md personality, skill procedures, and user requests. The runtime places `AGENTS.md` at the highest prompt priority so these boundaries are honored without needing a hook injection.

### 2. SOUL.md — Identity & Personality

**Source**: OpenClaw native
**Purpose**: Defines WHO the agent is — their identity, personality, communication style, and escalation policies.

**Required sections**:
- Identity (1-sentence: "You are the [role] for [company] [department]")
- Personality (3-5 personality traits matching the role)
- Communication Style (tone, formality level, typical response length)
- Escalation Policy (who to escalate to, with names and thresholds)

**Key constraint**: SOUL.md defines personality. It does NOT define safety rules (that's the Hard Rules section of AGENTS.md) or procedures (that's skills/).

### 3. TOOLS.md — Tool Environment Notes

**Source**: OpenClaw native
**Purpose**: Local, environment-specific notes about tool configuration — MCP server names, API quirks, credential references, service-specific details.

**Required sections**:
- MCP Servers (list all configured MCP servers this agent uses)
- Tool Notes (any environment-specific details)

**Key constraint**: This file contains NO credentials — only references. Credentials live in the secret store.

### 4. IDENTITY.md — Agent Identity Card

**Source**: OpenClaw native
**Purpose**: Machine-readable identity metadata — name, avatar, signature emoji.

**Required fields**:
- Name
- Creature (role-appropriate description)
- Vibe (1-3 word description)
- Emoji (signature emoji for messages)
- Avatar (path or URL, optional)

### 5. USER.md — Human Contact

**Source**: OpenClaw native
**Purpose**: Context about the primary human(s) this agent works with.

**Required fields**:
- Name
- Role/Title
- Timezone
- Communication preferences
- Notes

### 6. HEARTBEAT.md — Proactive Schedule

**Source**: OpenClaw native
**Purpose**: Defines what the agent checks on periodic heartbeat polls.

**Usage**: Can be empty (agent just responds HEARTBEAT_OK). When populated, lists tasks to check on each heartbeat (inbox, calendar, pending items, etc.).

### 7. BOOTSTRAP.md — First Run **and** Enterprise Context

**Source**: OpenClaw native
**Purpose**: Instructions for the agent's first session — **and** the Sentura `## Enterprise Context` section describing the organization this employee serves.

**Required sections**:

1. `## Enterprise Context` (Sentura convention) — **must appear at or near the top**
   - Company (name, industry, size)
   - Organization Structure (relevant hierarchy with names and titles)
   - Key Systems (system name → MCP server mapping)
   - Policies (approval thresholds, data handling, compliance requirements)
2. First-Run Initialization
   - What files to read
   - Initial verification steps
   - How to announce readiness
3. Ongoing Sessions (optional)

**Example Enterprise Context section**:

```markdown
## Enterprise Context — Acme Corporation

### Company
- Name: Acme Corporation
- Industry: Manufacturing
- Size: 2,500 employees

### Organization Structure
- CFO: Bob Johnson (approves invoices > $50K)
- VP Finance: Alice Chen (approves new vendors)
- Finance Manager: David Park (day-to-day oversight)

### Key Systems
- ERP: SAP S/4HANA (MCP: sap-erp)
- CRM: Salesforce (MCP: salesforce)
- Ticketing: Zendesk (MCP: zendesk)
- Communication: Slack (#accounts-payable, #finance-team)

### Policies
- Invoice approval: $10K (manager), $50K (CFO)
- New vendor onboarding: requires Finance Manager approval
- PII handling: never share outside approved systems
```

**Key constraint**: Enterprise Context should contain ONLY information relevant to this specific agent's role. Don't dump the entire org chart — just the parts that affect this employee.

**Divergence from OpenClaw's default convention (important)**

In vanilla OpenClaw, `BOOTSTRAP.md` is a one-time setup checklist the agent deletes during its first run to mark itself "bootstrap complete". Sentura does **not** do that — `BOOTSTRAP.md` is permanent because it also hosts `## Enterprise Context`.

To reconcile with OpenClaw's runtime (`openclaw/src/agents/workspace.ts` → `resolveWorkspaceBootstrapStatus`), Sentura instead stamps `setupCompletedAt` into `<workspace>/.openclaw/workspace-state.json`. A workspace is considered complete when `setupCompletedAt` is a non-empty string OR when `BOOTSTRAP.md` does not exist. Since Sentura keeps `BOOTSTRAP.md`, we rely on the timestamp.

- **Who writes it**: `scripts/sentura-setup.sh` / `scripts/sentura-setup.ps1` write it for the three meta-agents (`creator`, `tuner`, `orchestrator`) after all other setup steps succeed. Idempotent — existing timestamps are preserved on re-run.
- **Why it matters**: when a workspace is pending, OpenClaw prefixes every user turn with `[Bootstrap pending]` and forces non-primary runs (e.g. dashboard-spawned sessions) into limited mode, which makes the Creator Agent refuse to actually deploy a new AI employee from the dashboard. Stamping `setupCompletedAt` disables that limiter without removing Enterprise Context.
- **Employee workspaces**: deployed employees (children of Forge) follow the normal OpenClaw convention. The `setupCompletedAt` stamp is specific to Sentura's meta-agents.

See `docs/SETUP.md` § "Meta-agent bootstrap convention" for customer-facing documentation.

### 8. MEMORY.md — Agent Scratchpad

**Source**: OpenClaw native
**Purpose**: Long-term memory notes maintained by the agent itself. Starts empty; the agent populates it over time.

**Key constraint**: Do NOT seed this with content during incubation. The agent builds its own memory.

### 9. skills/ Directory — Domain Knowledge

**Source**: Sentura design pattern
**Purpose**: Structured procedural knowledge, one SKILL.md per distinct capability.

**Directory convention**:
```
skills/
├── {capability-name}/
│   └── SKILL.md
```

**SKILL.md format** (all sections required):

```markdown
# {Capability Name}

## When to Use
[Trigger conditions — when should the agent activate this skill?]

## Procedure
[Numbered steps with specific, verifiable actions]
[Each step references the exact tool to use]

## Tools Needed
[List of tools and MCP servers required]

## Safety
[NEVER/ALWAYS rules specific to this capability]
```

**Key constraints**:
- Skills encode procedures, not personality (that's SOUL.md)
- Skills encode capabilities, not hard rules (that's the Hard Rules section of AGENTS.md)
- Procedure steps must be specific enough to verify in a test
- Safety section cannot weaken AGENTS.md Hard Rules — it can only add more restrictions

### 10. memory/users/ — Per-User Memory (Sentura Addition)

**Source**: Sentura-specific (outside the 8 native files)
**Purpose**: Per-user personalized memory. Each human user who interacts with this agent gets their own `MEMORY_USER_{token}.md` file capturing their preferences, history, and context.

**Injection path**: The `sentura-bootstrap` hook (`~/.openclaw/hooks/sentura-bootstrap/`) listens for the `agent:bootstrap` event. When a session is bound to a user token (via the `agent:{id}:user:{token}:*` session-key convention), the hook loads `memory/users/MEMORY_USER_{token}.md` from the workspace and appends it to `context.bootstrapFiles`.

**Privacy boundary**: Per-user memories are scoped to a single human user and never leaked across users. The dreaming system promotes cross-user patterns to general `MEMORY.md` only when they are not user-specific.

## File Priority

When there's a conflict between files, this is the precedence order (highest first):

1. **`AGENTS.md` § Hard Rules** — Top-priority safety boundaries override everything
2. **Skills Safety sections** — Skill-specific restrictions
3. **SOUL.md Escalation** — Escalation rules
4. **AGENTS.md general protocol** — Session behavior rules
5. **`BOOTSTRAP.md` § Enterprise Context — Policies** — Enterprise policy context
6. **SOUL.md Personality** — Personality preferences (lowest priority)

## System Prompt Assembly

OpenClaw assembles the agent's system prompt from workspace files. There is **no `systemPrompt` field** in the agent config — identity and behavior come entirely from workspace markdown files.

### OpenClaw Native (8 files)

OpenClaw natively loads these 8 files from the workspace directory and injects them into the `# Project Context` section of the system prompt, in this order:

1. `AGENTS.md` (includes Hard Rules)
2. `SOUL.md`
3. `IDENTITY.md`
4. `USER.md`
5. `TOOLS.md`
6. `BOOTSTRAP.md` (includes Enterprise Context)
7. `MEMORY.md`
8. `HEARTBEAT.md` (dynamic)

This set is hardcoded in `openclaw/src/agents/workspace.ts` (`VALID_BOOTSTRAP_NAMES`).

### Sentura Addition (per-user memory via hook)

The `sentura-bootstrap` hook (`~/.openclaw/hooks/sentura-bootstrap/`) runs on `agent:bootstrap` and — for sessions bound to a user token — appends `memory/users/MEMORY_USER_{token}.md` to `context.bootstrapFiles`. This is the **only** Sentura-specific bootstrap injection.

The hook is installed by `scripts/sentura-setup.sh` and enabled in `~/.openclaw/openclaw.json` under `hooks.internal.entries.sentura-bootstrap`. Sessions without a user token are silently skipped.

## Agent Config Schema

Agents are registered in `~/.openclaw/openclaw.json` using the `agents.list` array (NOT `agents.entries`). Each entry has an `id` field. Bindings, MCP servers, and approvals are top-level config, not inside the agent entry.

```json5
{
  agents: {
    list: [
      {
        id: "cs-agent-gradsale",
        name: "GradSale Support",
        model: "openai/gpt-4o",
        runtime: { type: "embedded" },
        sandbox: { mode: "non-main" },
        tools: {
          profile: "minimal",
          alsoAllow: ["web_search", "web_fetch", "canvas", "message"],
          deny: ["exec", "gateway"],
        },
      }
    ]
  },
  bindings: [
    { agentId: "cs-agent-gradsale", match: { channel: "slack", peer: { kind: "channel", id: "#support" } } }
  ],
  mcp: {
    servers: {
      "gradsale-admin": { command: "node", args: ["./mcp-servers/gradsale-admin/index.js"] }
    }
  }
}
```

## Deployment Lifecycle

### How workspace files get to `~/.openclaw/`

1. **Creator Agent** generates all workspace files during incubation — including the `## Hard Rules` section of `AGENTS.md` and the `## Enterprise Context` section of `BOOTSTRAP.md`
2. Creator writes files to `~/.openclaw/workspace/{agent-id}/` using `fs_write`
3. Creator registers the agent via the `gateway` tool with `config.patch` action (no per-agent `workspace` field — OpenClaw resolves via `agents.defaults.workspace/{agent-id}`)
4. OpenClaw's agent runtime reads workspace files from the resolved path on each session

### Why we don't set `workspace` in config

Setting `workspace: "./workspaces/cs-agent"` would make OpenClaw resolve it relative to the gateway process's CWD (via `path.resolve()`). This is fragile:
- Different CWDs produce different paths
- Docker containers have a different filesystem layout than local dev
- `pnpm gateway:watch` starts in `openclaw/` not the project root

By omitting `workspace`, OpenClaw resolves to `{agents.defaults.workspace}/{agent-id}`, giving us `~/.openclaw/workspace/{agent-id}` — absolute, deterministic, and works identically across dev/Docker/production.

### Templates vs runtime workspaces

| | Templates (`sentura/config/templates/`) | Reference examples (`workspaces/`) | Runtime (`~/.openclaw/`) |
|---|---|---|---|
| In git? | Yes | Yes | No |
| Contains live data? | No (placeholders) | No (test snapshots) | Yes |
| Who writes? | Developers | Developers | Creator Agent |
| Used by | Creator Agent (as starting point) | Developers (for validation) | OpenClaw runtime |

## For Dashboard Team (Person C)

The dashboard should display workspace files with:
- Read-only view for all 8 native files
- Edit capability for SOUL.md, AGENTS.md (including the Hard Rules section), BOOTSTRAP.md (including the Enterprise Context section), skills/ (via Tuning Agent or direct edit)
- Syntax highlighting for markdown
- Diff view for file changes (version history)
- Visual call-out for the Hard Rules section inside AGENTS.md and the Enterprise Context section inside BOOTSTRAP.md (these are Sentura-specific conventions)

The dashboard reads workspace files from `~/.openclaw/workspace/{agent-id}/` — the resolved runtime path. Use `resolveAgentWorkspaceDir()` from OpenClaw's agent scope to find the correct directory.

## For Extensions Team (Person D)

Extensions interact with workspace files through:
- `sentura-audit`: Logs all workspace file changes with before/after diffs
- `sentura-approval`: Modifications to the `## Hard Rules` section of AGENTS.md require admin approval
- `sentura-rbac`: Workspace file access controlled by RBAC role
- `sentura-provisioner`: Writes TOOLS.md entries when provisioning completes

All extensions resolve workspace paths via OpenClaw's internal APIs — they never hardcode paths.
