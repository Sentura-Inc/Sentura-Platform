# Sentura AI Employee Workspace Convention

> **Audience**: All team members (B designs workspaces, C displays them in the dashboard, D's extensions interact with them)
>
> **Last updated**: 2026-04-05

## Overview

Every AI employee on the Sentura platform has a dedicated **workspace directory** containing identity files, safety rules, enterprise context, and domain skills. This convention defines the 10-file + skills/ structure that all Sentura workspaces follow.

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
    ├── SOUL.md, RULES.md, ...       # Workspace files (copied to ~/.openclaw/ at deploy)
    └── skills/                      # Skill files

~/.openclaw/                         # Runtime state directory (NOT in git)
├── workspace/                       # agents.defaults.workspace base
│   ├── creator/                     # Sentura Creator meta-agent workspace
│   ├── tuner/                       # Sentura Tuner meta-agent workspace
│   ├── orchestrator/                # Sentura Orchestrator meta-agent workspace
│   ├── cs-agent-gradsale/           # Example AI employee workspace
│   │   ├── SOUL.md, RULES.md, ...
│   │   ├── skills/
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
│ — OpenClaw Default Workspace Files (8) ——————————————
├── AGENTS.md            # Session behavior, memory protocol, workspace rules
├── SOUL.md              # Core identity, personality, values, escalation
├── TOOLS.md             # Tool-specific notes, environment config
├── IDENTITY.md          # Name, creature, vibe, emoji, avatar
├── USER.md              # Primary human contact info
├── HEARTBEAT.md         # Proactive check schedule
├── BOOTSTRAP.md         # First-run initialization procedure
├── MEMORY.md            # Agent scratchpad / long-term notes
│
│ — Sentura Enterprise Additions (2) ——————————————————
├── RULES.md             # Hard safety boundaries (NEVER/ALWAYS rules)
├── CONTEXT.md           # Enterprise org structure, policies, systems
│
│ — Skills Directory ——————————————————————————————————
└── skills/
    ├── {capability-1}/
    │   └── SKILL.md
    ├── {capability-2}/
    │   └── SKILL.md
    └── ...
```

## File Specifications

### 1. AGENTS.md — Session Behavior

**Source**: OpenClaw default  
**Purpose**: Defines how the agent behaves in each session — startup procedure, memory protocol, workspace rules, group chat behavior.

**Required sections**:
- Session Startup (what files to read on session start)
- Memory protocol (how to use daily notes and MEMORY.md)
- Red Lines (what the agent must never do)
- External vs Internal action boundaries

**Key constraint**: This file controls the agent's meta-behavior. Keep it concise — the agent reads it on every session startup.

### 2. SOUL.md — Identity & Personality

**Source**: OpenClaw default  
**Purpose**: Defines WHO the agent is — their identity, personality, communication style, and escalation policies.

**Required sections**:
- Identity (1-sentence: "You are the [role] for [company] [department]")
- Personality (3-5 personality traits matching the role)
- Communication Style (tone, formality level, typical response length)
- Escalation Policy (who to escalate to, with names and thresholds)

**Key constraint**: SOUL.md defines personality. It does NOT define safety rules (that's RULES.md) or procedures (that's skills/).

### 3. TOOLS.md — Tool Environment Notes

**Source**: OpenClaw default  
**Purpose**: Local, environment-specific notes about tool configuration — MCP server names, API quirks, credential references, service-specific details.

**Required sections**:
- MCP Servers (list all configured MCP servers this agent uses)
- Tool Notes (any environment-specific details)

**Key constraint**: This file contains NO credentials — only references. Credentials live in the secret store.

### 4. IDENTITY.md — Agent Identity Card

**Source**: OpenClaw default  
**Purpose**: Machine-readable identity metadata — name, avatar, signature emoji.

**Required fields**:
- Name
- Creature (role-appropriate description)
- Vibe (1-3 word description)
- Emoji (signature emoji for messages)
- Avatar (path or URL, optional)

### 5. USER.md — Human Contact

**Source**: OpenClaw default  
**Purpose**: Context about the primary human(s) this agent works with.

**Required fields**:
- Name
- Role/Title
- Timezone
- Communication preferences
- Notes

### 6. HEARTBEAT.md — Proactive Schedule

**Source**: OpenClaw default  
**Purpose**: Defines what the agent checks on periodic heartbeat polls.

**Usage**: Can be empty (agent just responds HEARTBEAT_OK). When populated, lists tasks to check on each heartbeat (inbox, calendar, pending items, etc.).

### 7. BOOTSTRAP.md — First Run

**Source**: OpenClaw default  
**Purpose**: Instructions for the agent's very first session. Deleted after bootstrap completes.

**Required sections**:
- What files to read
- Initial verification steps
- How to announce readiness

### 8. MEMORY.md — Agent Scratchpad

**Source**: OpenClaw default  
**Purpose**: Long-term memory notes maintained by the agent itself. Starts empty; the agent populates it over time.

**Key constraint**: Do NOT seed this with content during incubation. The agent builds its own memory.

### 9. RULES.md — Safety Boundaries (Sentura Addition)

**Source**: Sentura-specific (NOT in OpenClaw's default workspace)  
**Purpose**: Hard safety boundaries that the agent must NEVER violate, regardless of what the user or any skill says.

**Required sections**:
- Financial Controls (payment limits, duplicate detection, vendor verification)
- Data Protection (PII handling, channel boundaries, encryption requirements)
- Operational Boundaries (tool restrictions, service limits, escalation mandates)

**Format**: Every rule starts with **NEVER** or **ALWAYS**. Rules must be specific and testable.

**Example**:
```markdown
## Financial Controls
- NEVER approve a payment above $50,000 without CFO approval
- NEVER process a payment to a bank account changed in the last 30 days
- ALWAYS verify vendor exists in approved vendor list before processing

## Data Protection
- NEVER share customer PII outside approved systems
- NEVER include bank account numbers in Slack messages
- ALWAYS redact sensitive numbers in logs

## Operational Boundaries
- NEVER modify database records directly — use API via MCP
- ALWAYS log every financial decision with reasoning
- ALWAYS escalate when uncertain — safety over speed
```

**Key constraint**: RULES.md is injected into the agent's system prompt by the `sentura-bootstrap` hook (installed at `~/.openclaw/hooks/sentura-bootstrap/`). This hook runs during the `agent:bootstrap` event and appends RULES.md content to the Project Context section alongside the standard 8 OpenClaw files. RULES.md takes precedence over SOUL.md personality and skill procedures.

### 10. CONTEXT.md — Enterprise Context (Sentura Addition)

**Source**: Sentura-specific (NOT in OpenClaw's default workspace)  
**Purpose**: Enterprise-specific context that the agent needs to do its job — org structure, key personnel, system inventory, policies.

**Required sections**:
- Company (name, industry, size)
- Organization Structure (relevant hierarchy with names and titles)
- Key Systems (system name → MCP server mapping)
- Policies (approval thresholds, data handling, compliance requirements)

**Example**:
```markdown
## Company
- Name: Acme Corporation
- Industry: Manufacturing
- Size: 2,500 employees

## Organization Structure
- CFO: Bob Johnson (approves invoices > $50K)
- VP Finance: Alice Chen (approves new vendors)
- Finance Manager: David Park (day-to-day oversight)

## Key Systems
- ERP: SAP S/4HANA (MCP: sap-erp)
- CRM: Salesforce (MCP: salesforce)
- Ticketing: Zendesk (MCP: zendesk)
- Communication: Slack (#accounts-payable, #finance-team)

## Policies
- Invoice approval: $10K (manager), $50K (CFO)
- New vendor onboarding: requires Finance Manager approval
- PII handling: never share outside approved systems
```

**Key constraint**: CONTEXT.md is injected into the agent's system prompt by the same `sentura-bootstrap` hook that handles RULES.md. It should contain ONLY information relevant to this specific agent's role. Don't dump the entire org chart — just the parts that affect this employee.

### 11. skills/ Directory — Domain Knowledge

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
- Skills encode capabilities, not rules (that's RULES.md)
- Procedure steps must be specific enough to verify in a test
- Safety section cannot weaken RULES.md — it can only add more restrictions

## File Priority

When there's a conflict between files, this is the precedence order (highest first):

1. **RULES.md** — Hard boundaries override everything
2. **Skills Safety sections** — Skill-specific restrictions
3. **SOUL.md Escalation** — Escalation rules
4. **AGENTS.md Red Lines** — General workspace rules
5. **CONTEXT.md Policies** — Enterprise policy context
6. **SOUL.md Personality** — Personality preferences (lowest priority)

## System Prompt Assembly

OpenClaw assembles the agent's system prompt from workspace files. There is **no `systemPrompt` field** in the agent config — identity and behavior come entirely from workspace markdown files.

### OpenClaw Native (8 files)

OpenClaw natively loads these 8 files from the workspace directory and injects them into the `# Project Context` section of the system prompt:

1. `AGENTS.md` → `SOUL.md` → `IDENTITY.md` → `USER.md` → `TOOLS.md` → `BOOTSTRAP.md` → `MEMORY.md` + `HEARTBEAT.md` (dynamic)

This set is hardcoded in `openclaw/src/agents/workspace.ts` (`VALID_BOOTSTRAP_NAMES`).

### Sentura Addition (2 files via hook)

`RULES.md` and `CONTEXT.md` are **not** part of OpenClaw's native workspace files. They are injected by the **`sentura-bootstrap` hook** (`~/.openclaw/hooks/sentura-bootstrap/`), which:

1. Listens for the `agent:bootstrap` event
2. Reads `RULES.md` and `CONTEXT.md` from the agent's workspace directory
3. Appends them to `context.bootstrapFiles` so they appear in `# Project Context`

The hook is installed by `scripts/sentura-setup.sh` and enabled in `~/.openclaw/openclaw.json` under `hooks.internal.entries.sentura-bootstrap`.

If either file doesn't exist for a given agent, it is silently skipped — the hook is safe for agents that don't use Sentura's extended workspace convention.

### Effective Prompt Order

The full system prompt `# Project Context` contains (in order):

1. `AGENTS.md` (session behavior)
2. `SOUL.md` (identity, personality, escalation)
3. `IDENTITY.md` (name, avatar)
4. `USER.md` (human contact)
5. `TOOLS.md` (tool environment)
6. `BOOTSTRAP.md` (first-run, deleted after)
7. `MEMORY.md` (agent scratchpad)
8. `HEARTBEAT.md` (proactive checks — dynamic)
9. `RULES.md` (safety boundaries — via sentura-bootstrap hook)
10. `CONTEXT.md` (enterprise context — via sentura-bootstrap hook)

Skills are loaded on-demand based on the conversation context via OpenClaw's skills system.

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

1. **Creator Agent** generates all workspace files during incubation
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
- Read-only view for all files
- Edit capability for SOUL.md, RULES.md, CONTEXT.md, skills/ (via Tuning Agent or direct edit)
- Syntax highlighting for markdown
- Diff view for file changes (version history)
- Visual indicator for Sentura-specific files (RULES.md, CONTEXT.md) vs OpenClaw defaults

The dashboard reads workspace files from `~/.openclaw/workspace/{agent-id}/` — the resolved runtime path. Use `resolveAgentWorkspaceDir()` from OpenClaw's agent scope to find the correct directory.

## For Extensions Team (Person D)

Extensions interact with workspace files through:
- `sentura-audit`: Logs all workspace file changes with before/after diffs
- `sentura-approval`: RULES.md changes require admin approval
- `sentura-rbac`: Workspace file access controlled by RBAC role
- `sentura-provisioner`: Writes TOOLS.md entries when provisioning completes

All extensions resolve workspace paths via OpenClaw's internal APIs — they never hardcode paths.
