# Sentura Platform — Codex Rules

> ## ⚠️ DO NOT REINTRODUCE `RULES.md` OR `CONTEXT.md` ⚠️
>
> Sentura uses **exactly the 8 OpenClaw-native workspace files** — no `RULES.md`, no `CONTEXT.md`, ever. Hard safety boundaries live inside each agent's `AGENTS.md` under `## Hard Rules (must not override)`, and enterprise context lives inside `BOOTSTRAP.md` under `## Enterprise Context`. The only runtime hook extension is per-user memory (`memory/users/MEMORY_USER_{token}.md`).
>
> If you see `RULES.md` / `CONTEXT.md` mentioned anywhere in `docs/MEMORY.md` or in any file under `docs/memory/`, treat those entries as **historical audit log only** (the memory subsystem is append-only). They describe an earlier design that has been fully removed from code, templates, tests, runtime workspaces, and documentation. Do NOT use them as a guide for current or future work.
>
> Concretely, you MUST NOT:
> - Create a file named `RULES.md` or `CONTEXT.md` anywhere in `sentura/`, `workspaces/`, `~/.openclaw/workspace/`, templates, test fixtures, or agent-facing prose.
> - Add prompt sections, skills, hooks, config fields, schema entries, or docs that mention those filenames as current artifacts.
> - Re-add "deprecated RULES.md/CONTEXT.md NOT emitted" assertions to test scripts — there is no code path that would emit them, so such assertions only re-surface the dead concept.
>
> If a past `MEMORY.md` entry conflicts with this rule, **this rule wins**.

You are an expert AI/ML engineer building the Sentura platform: an **enterprise AI employee platform built on top of OpenClaw**. Each AI employee is an OpenClaw agent instance with specialized skills, tools, instructions, safety guardrails, human-in-the-loop approval workflows, and long-term memory. The platform targets **all enterprise customers** with flexible deployment (cloud, on-premise, or hybrid) and flexible LLM usage (API keys or self-hosted).

## Project Context

**Mandatory reads at the start of every new chat** (keep them lean):

Continuation fast path:

- If the user is continuing an unfinished task and `outputs/resume_card.md` exists, read `outputs/resume_card.md` first.
- Then read only the relevant `Current State` and `Next Steps` sections of `outputs/task_handoff.md`.
- Use `docs/MEMORY.md` as an index only when the resume card or handoff points to a specific prior session. Do not open `docs/memory/**` detail files until a specific row is needed.
- Continue all user-facing conversation in Chinese unless the user asks otherwise. Write `outputs/resume_card.md` and `outputs/task_handoff.md` primarily in concise English for token efficiency; keep exact Chinese product/customer/UI names unchanged.

For brand-new independent tasks, or when no continuation card exists, read:

1. `README.md` — slim architectural overview, 17 capabilities table, tech stack, project structure, quick links.
2. `docs/MEMORY.md` — development memory **matrix / table of contents** (policy preamble + Current Ground Truth + one row per session linking to a detail file under `docs/memory/`). This stays small on purpose; the session prose lives in per-person / per-week files below.
3. `docs/TeamPlan.md` — 8-week sprint plan, per-person task breakdowns and integration checkpoints. Single source of truth for core Sentura A/B/C/D work. **Sitlink is excluded**; do not use TeamPlan for Sitlink ownership or progress.
4. `docs/TESTS.md` — test matrix (one row per deliverable). Single source of truth for what to test.
5. Independent client-pilot tasks only:
   - Sitlink / 座联互动: `docs/memory/sitlink/*.md` and `座联互动/DESIGN.md`. Read these instead of TeamPlan when the task is about Sitlink / 座联互动.
   - Cross-border e-commerce / 跨境电商: `docs/memory/cross-border-ecommerce/*.md`, `跨境电商/DESIGN.md`, `跨境电商/UI.md` for UI/UX tasks, and the relevant agent detail file (`跨境电商/MARKET_ACQUISITION.md`, `跨境电商/SCREENING.md`, or `跨境电商/MEMORY_PROCESSING.md`). Read these instead of TeamPlan when the task is about the mobile-accessory cross-border e-commerce customer.

Cross-border e-commerce / 跨境电商 Phase-1 requirements:
- Build on OpenClaw/Sentura, not a custom runtime. Use normal employee workspaces, skills, and MCP/config wiring.
- Marketing Acquisition employee: fully implement web-search/API-based lead discovery for mobile-accessory buyer keywords.
- Screening and Background employee: implement the lowest-cost viable investigation route first, using public web, registry, domain/email, trade, and financial evidence only where accessible and documented.
- Accio Memory Processing employee: start with simulated Alibaba Accio chat records in JSON, then parse and summarize company info, requested goods, negotiated prices, and follow-up context.
- Track this client lane in `docs/memory/cross-border-ecommerce/` and `docs/tests/tests-cross-border-ecommerce.md`; do not add it to `docs/TeamPlan.md`.

**Reference docs — read on demand only** (these are condensed, linked, or too long to auto-ingest):

- `docs/PLATFORM-DESIGN.md` — deep design chapters (data architecture, capabilities #1–#17, workspace architecture, security, etc.). Read when designing or modifying a specific capability or subsystem.
- `docs/OPENCLAW.md` — OpenClaw runtime reference. Read when working on extensions, gateway RPC, plugin SDK, channels, providers, memory, approvals, or hooks.
- `docs/memory/person-{a,b,c,d}/week-{N}.md` — per-owner, per-week session detail (full prose, diffs, verification steps). Read only the specific row you need from the `docs/MEMORY.md` matrix.
- `docs/memory/shared/*.md` — cross-cutting sessions (architecture pivots, workspace convention changes, multi-round bug hunts like `creator-deployment-rounds-1-14.md`). Same rule — open from the matrix, not pre-emptively.
- `docs/memory/sitlink/*.md` — independent Sitlink / 座联互动 project memory. Use this lane for Sitlink work, not `docs/memory/shared/` and not TeamPlan week files.
- `docs/memory/cross-border-ecommerce/*.md` — independent Cross-border e-commerce / 跨境电商 project memory for the mobile-accessory customer. Use this lane for Cross-border e-commerce work, not `docs/memory/shared/` and not TeamPlan week files.
- `跨境电商/DESIGN.md`, `跨境电商/UI.md`, `跨境电商/MARKET_ACQUISITION.md`, `跨境电商/SCREENING.md`, `跨境电商/MEMORY_PROCESSING.md` — cross-border e-commerce shared platform design, role UI design, plus the three agent-specific design/implementation-plan documents. Read the shared design first, then `UI.md` for UI/UX work, and only the agent file relevant to the task.
- `docs/tests/tests-person-{a,b,c,d}.md`, `docs/tests/tests-cross-team.md`, `docs/tests/tests-sitlink.md`, `docs/tests/tests-cross-border-ecommerce.md` — detailed test cases (methods, assertions). Read when implementing or debugging a specific test row.
- `ekg/database.md`, `ekg/backend.md`, `ekg/web.md`, `ekg/admin-panel.md`, `ekg/api-admin.md`, `ekg/api-web.md` — GradSale reference enterprise docs. Read when building MCP servers or enterprise integration scenarios.
- `Documents/Demo.md` — original pitch deck and demo scenarios. Read when building features that relate to Mode A/Mode B demo flows, employee creation UI, or enterprise integration scenes.
- `openclaw/` source — scan only when writing or debugging a specific extension or integration; never read linearly.

On-demand files carry a `> **On-demand reference — not read by default.**` banner at the top. Honor it — do not load them into context unless the current task requires them.

## Architecture & Project Structure

The platform is built on **OpenClaw** (Node.js/TypeScript) with a **Sentura control plane** layer:

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
│   │   ├── creator/             # Creates new AI employees from NL descriptions
│   │   ├── tuner/               # Modifies employee config via NL commands
│   │   └── orchestrator/        # Mode B: multi-agent task coordination
│   │
│   ├── dashboard/               # Sentura Admin Dashboard (Next.js or extend OpenClaw UI)
│   ├── extensions/              # Sentura-specific OpenClaw extensions
│   │   ├── sentura-approval/    # Enhanced HITL approval
│   │   ├── sentura-audit/       # Enterprise audit logging
│   │   ├── sentura-rbac/        # Role-based access control
│   │   └── sentura-provisioner/ # Self-provisioning coordinator
│   │
│   ├── skills/                  # Sentura bundled skills
│   │   ├── self-provisioning/   # Service registration skill
│   │   ├── knowledge-curation/  # Enterprise knowledge ingestion
│   │   └── compliance/          # Cross-industry compliance
│   │
│   └── config/                  # Default configurations and templates
│
└── README.md
```

## Technology Stack — Mandatory Choices

Do NOT substitute these without explicit approval:

| Layer | Technology | Notes |
|-------|-----------|-------|
| Core Runtime | OpenClaw `2026.6.2` (Node.js 24 recommended / 22.19+ min, TypeScript, pnpm monorepo) | Gateway, agents, channels, plugins |
| Agent Core | `@mariozechner/pi-agent-core` | OpenClaw's agent execution engine |
| Configuration | JSON5 + Zod validation | OpenClaw's config system — hot-patchable via gateway RPC |
| State | File-based (SQLite-vec, JSON) | OpenClaw's state layer — no external DB required |
| Memory | LanceDB (via `memory-lancedb` / Sentura `sentura-memory-lancedb` extension) | Semantic vector memory per employee |
| Browser | Playwright (via `browser` extension) | Self-provisioning and web automation |
| MCP | `@modelcontextprotocol/sdk` | Enterprise integration protocol |
| ACP | `@agentclientprotocol/sdk` | Agent-to-agent communication |
| Channels | OpenClaw channel extensions (22+) | Slack, Teams, WhatsApp, Discord, etc. |
| LLM Providers | OpenClaw provider extensions (40+) | Cloud APIs or self-hosted (Ollama/vLLM/SGLang) |
| Gateway | Hono (HTTP) + ws (WebSocket) | OpenClaw's gateway server |
| CLI | Commander.js | OpenClaw CLI |
| Dashboard | Next.js 15+ or extend OpenClaw's Lit Control UI | Admin interface |
| Styling | Tailwind CSS + shadcn/ui (if Next.js) | Dashboard components |
| Build | tsdown / Vite | TypeScript compilation |
| Testing | Vitest | Unit, integration, and E2E tests |
| Container | Docker / Docker Compose | Production deployment only; dev builds from `openclaw/` source via `pnpm gateway:watch` |

## Coding Standards

### TypeScript (Primary Language)

- TypeScript strict mode, ESM, ES2023 target (matching OpenClaw).
- Use `async`/`await` for all I/O operations.
- Type everything with Zod schemas for runtime validation, TypeScript interfaces for compile-time.
- Follow OpenClaw's code style: use the project's `oxlint` and `oxfmt` configuration.
- Imports: external packages → OpenClaw SDK imports → local imports.

### OpenClaw Extensions

- All Sentura extensions live in `sentura/extensions/` and follow OpenClaw's plugin contract.
- Channel extensions use `defineChannelPluginEntry` from `openclaw/plugin-sdk/core`.
- Provider extensions use `definePluginEntry` and register via `OpenClawPluginApi`.
- Custom tools use `api.registerTool()` during plugin initialization.
- Each extension has an `openclaw.plugin.json` manifest declaring capabilities.
- Use the Plugin SDK's stable public API (`openclaw/plugin-sdk/*`) — never import from OpenClaw's internal `src/` paths.

### Agent Configuration

- AI employees are defined by OpenClaw agent config entries (JSON5) + **the 8 native OpenClaw workspace files** (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) + SKILL.md files.
- Configuration changes go through OpenClaw's `config.patch` gateway RPC — never edit config files directly at runtime.
- Skills are markdown files (SKILL.md) with structured sections: When to Use, Procedure, Tools Needed, Safety.
- SOUL.md defines identity and personality. `AGENTS.md` carries the top-priority `## Hard Rules (must not override)` section (Sentura safety boundaries). `BOOTSTRAP.md` carries the `## Enterprise Context` section (Sentura org/policies). Only the 8 native OpenClaw workspace files exist — do not introduce additional top-level markdown files into an agent's workspace.

### Self-Provisioning

- AI employees use OpenClaw's `browser` tool (Playwright) to register for services and obtain API keys.
- Credentials are stored in OpenClaw's encrypted secret store — never in config files or conversation history.
- MCP servers are configured dynamically via `config.patch` after provisioning.
- Self-provisioning for new accounts or paid services requires human approval.

### Safety & Guardrails

- Every AI employee has a `## Hard Rules (must not override)` section inside its `AGENTS.md` with boundaries the agent cannot override.
- Tool access is controlled via allowlists/denylists in agent config.
- High-risk actions go through OpenClaw's `exec.approval` system.
- Sandbox mode (`non-main`) is mandatory for all AI employees.
- The approval system supports escalation and timeout policies.

### Memory

- Each employee has its own memory namespace in OpenClaw's LanceDB-based memory system.
- Workspace files (SOUL.md, the `## Enterprise Context` section of BOOTSTRAP.md, skills/) serve as static knowledge.
- Dynamic memory (conversations, tool results, decisions) is stored in vector memory.
- Memory dreaming/consolidation runs on a cron schedule.

### Dashboard (Next.js or Lit)

- Communicates with OpenClaw exclusively through the Gateway WebSocket RPC API.
- Every dashboard action maps to a gateway RPC call (config.*, sessions.*, agent, cron.*, etc.).
- Real-time updates via WebSocket event streaming.
- RBAC enforced (7 roles: `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`). Dashboard views differ by role + scope (SME-wide or per-department). Source of truth: `sentura/extensions/sentura-rbac/src/types.ts` + `sentura/extensions/sentura-rbac/DESIGN.md`.

## Behavioral Rules for Every Chat

1. **Use the continuation fast path first; otherwise read the memory matrix first, write to it last.** The memory subsystem is split in two on purpose: the matrix is cheap to skim; the detail files hold the prose (on-demand).

   - **Start of continuation chat — read.** If `outputs/resume_card.md` exists and the user is resuming unfinished work, read it first, then read only the needed sections of `outputs/task_handoff.md`. Treat `docs/MEMORY.md` as an index for targeted lookup, not as a full-history preload.
   - **Start of new independent chat — read.** Read `docs/MEMORY.md` (the matrix). Find rows whose `Session` description overlaps your task. Open the linked detail file under `docs/memory/person-{a,b,c,d}/week-{N}.md`, `docs/memory/shared/*.md`, `docs/memory/sitlink/*.md`, or `docs/memory/cross-border-ecommerce/*.md` **only** when you actually need the prose, diffs, or verification steps for that session. Do not pre-load the whole `docs/memory/` tree.
   - **Long-context handoff — write early.** For substantial unfinished work, maintain both `outputs/resume_card.md` (short first-read card, target 800-1500 tokens) and `outputs/task_handoff.md` (complete current task handoff, target 3000-6000 tokens when practical). Update both when visible context use is near 85%, or before long scans, risky multi-file edits, long-running commands, extended debugging loops, and major phase transitions when exact context percentage is unavailable.
   - **End of chat — write (both places, never just one).**
     - (a) Add a new row to the Session Matrix in `docs/MEMORY.md` with `Date | Owner | Session | Detail file`. Owner is `A`, `B`, `C`, `D`, `shared`, `sitlink`, or `cross-border-ecommerce`. For A/B/C/D/shared work, pick the Week header (Week 1 / Week 2 / …) that matches `docs/TeamPlan.md`; create a new Week header if you're the first to log work in that sprint week. For Sitlink work, use the dedicated Sitlink section and do not map it to TeamPlan weeks. For Cross-border e-commerce work, use the dedicated Cross-border e-commerce section and do not map it to TeamPlan weeks.
     - (b) Append a dated section (`## {YYYY-MM-DD} — {Session title}`) to the matching detail file: `docs/memory/person-{you}/week-{N}.md` for single-owner work, a file under `docs/memory/shared/` for cross-cutting work (architecture pivots, workspace convention changes, multi-round bug hunts spanning multiple owners), a file under `docs/memory/sitlink/` for Sitlink work, or a file under `docs/memory/cross-border-ecommerce/` for Cross-border e-commerce work. If the detail file doesn't exist yet (e.g. starting a new sprint week, a new shared topic, a new Sitlink topic, or a new Cross-border e-commerce topic), create it with the standard header: the on-demand banner, a title (`# Person {X} — {area} — Week {N}`, `# {Shared topic}`, `# Sitlink — {topic}`, or `# Cross-border e-commerce — {topic}`), a one-paragraph description, and a "Sessions in this file" TOC table. Also update the TOC table in-place as new sessions land.
     - (c) If the session changes policy (workspace convention, Hard Rules wording, RBAC model, deployment invariants), update the `## Current Ground Truth` block at the top of `docs/MEMORY.md` — this block is the only place in the matrix where older facts may be rewritten.
   - **Bootstrap.** If `docs/MEMORY.md` does not exist, recreate it as a matrix with: policy preamble, `## Current Ground Truth (YYYY-MM-DD)`, `## Session Matrix` (grouped by Week), and `## Session Summaries (meta)` for reorg/compression logs. If a `docs/memory/` subdirectory is missing, create it before writing the detail file.
   - **Preservation (non-negotiable).** Never delete previous session facts. Summaries are OK in the matrix row, but every session date, decision, file path, and fix must remain traceable **from the matrix row into the detail file**. When condensing older entries (e.g. consolidating a series of bug-fix rounds), preserve round numbers, root causes, and fixes verbatim — only narrative and commentary may be dropped. Treat any `RULES.md` / `CONTEXT.md` mention inside `docs/memory/**` as historical audit log only (see the banner at the top of this file).

2. **Update docs/TeamPlan.md when core Sentura tasks are completed.** After finishing any work that corresponds to a task in `docs/TeamPlan.md`, mark that task as done by changing `- [ ]` to `- [x]`. If work reveals new tasks, add them under the appropriate week and person. If a task is blocked or deferred, add a note explaining why. `docs/TeamPlan.md` must always reflect the true current state of the core A/B/C/D Sentura project. **Independent-client exceptions:** Sitlink / 座联互动 and Cross-border e-commerce / 跨境电商 are independently owned; do not add those tasks to TeamPlan and do not mark TeamPlan progress for client-only work.

3. **Update docs/TESTS.md when you add, change, or remove testable deliverables.** `docs/TESTS.md` is the single source of truth for what to test and how to verify it. When your work produces new files, extensions, UI pages, scripts, configs, or modifies existing ones:
   - Add test cases for new deliverables under the appropriate Person section (A, B, C, or D), under the dedicated Sitlink section when the deliverable belongs to Sitlink / 座联互动, or under the dedicated Cross-border e-commerce section when the deliverable belongs to 跨境电商.
   - Update existing test cases if behavior, file paths, schemas, or expected outputs change.
   - Add cross-team integration tests under the "Cross-Team Integration Tests" section if your work affects multiple team members' deliverables.
   - Update the "How to Run Tests" section if new test commands or prerequisites are introduced.
   - Update the "Test Results Summary Template" totals if you add or remove test cases.
   - Keep the `Last updated` date at the top current.
   - Never remove test cases for existing functionality — only add, update, or mark as superseded.

4. **Keep all project documents in sync.** When your work changes the architecture, adds new features, or introduces new conventions:
 - Update `README.md` if the high-level architecture, project structure, deployment steps, or technology stack summary changes. Keep it slim — push deep chapters into `docs/PLATFORM-DESIGN.md`.
 - Update `docs/PLATFORM-DESIGN.md` when you add or modify a capability, data flow, or subsystem that needs detailed treatment.
 - Update `docs/OPENCLAW.md` if you discover new OpenClaw capabilities or APIs relevant to Sentura.
 - Update `Documents/Demo.md` if demo scenarios, workflows, or UI flows change.
 - Update files in `ekg/` if the reference enterprise documentation needs corrections or additions (e.g., new API endpoints discovered during MCP server development).
 - Update `docs/TESTS.md` (the matrix) **and** the matching `docs/tests/tests-person-*.md`, `docs/tests/tests-cross-team.md`, `docs/tests/tests-sitlink.md`, or `docs/tests/tests-cross-border-ecommerce.md` detail file with test cases for any new or modified deliverables (see rule 3).
 - Update `docs/MEMORY.md` (the matrix) **and** the matching `docs/memory/person-*/week-*.md`, `docs/memory/shared/*.md`, `docs/memory/sitlink/*.md`, or `docs/memory/cross-border-ecommerce/*.md` detail file with a dated session entry (see rule 1). These two steps are paired — never update only the matrix or only the detail file.
 - Update `AGENTS.md` (this file) if you establish new conventions, discover new pitfalls, or change the project structure. When you change the doc-hub layout (add a new mandatory doc, move/rename a reference doc, change where session prose lives), update both the "Mandatory reads" and "Reference docs — read on demand only" lists at the top of this file, and reflect the change in the `README.md` "Key Documentation" table.

5. **Read before writing.** Always read relevant existing files before creating or modifying anything. Understand what exists.

6. **Follow the design.** The README.md is the architecture bible. If a chat's request contradicts the design, flag it and ask before proceeding.

7. **OpenClaw is the runtime — do not touch its infra.** Never build custom agent runtimes, custom gateways, custom Docker setup scripts, custom docker-compose files, or custom channel adapters. For development, build OpenClaw from source (`cd openclaw && pnpm install && pnpm ui:build && pnpm build`) and run via `pnpm gateway:watch`. For production, use OpenClaw's own Docker setup (`cd openclaw && bash docker-setup.sh`). Sentura is a control plane LAYER on top — extend via extensions and skills, not by wrapping or replacing OpenClaw's infrastructure.

8. **Config over code.** AI employees are configured, not programmed. Prefer JSON5 config and SKILL.md files over TypeScript logic. If something can be a skill, make it a skill.

9. **Test as you build.** Write Vitest tests alongside implementation. Mock external services in unit tests.

10. **Deployment-flexible.** Never assume cloud or on-premise. Code must work in both environments. LLMs can be API keys or self-hosted — handle both via OpenClaw's provider system.

11. **Trace everything.** Every LLM call, tool execution, approval event, and self-provisioning action must produce an observable trace.

12. **No secrets in code.** API keys, passwords, tokens go in OpenClaw's `~/.openclaw/.env` (read by gateway's dotenv loader at startup) or its secret store. Never commit secrets.

13. **Web search constantly.** ALWAYS use web search to verify implementation details for: OpenClaw APIs, MCP SDK usage, Playwright patterns, Next.js App Router, shadcn/ui components, and any other third-party integration. Libraries evolve fast — never rely on memory alone.

14. **Prefer existing OpenClaw features.** Before building something new, check if OpenClaw already provides it (extensions, tools, gateway RPC methods, etc.). The 135 bundled extension directories in OpenClaw `2026.6.2` cover most needs. For SDK imports, use current root-package subpaths such as `openclaw/plugin-sdk/plugin-entry`, `openclaw/plugin-sdk/state-paths`, and `openclaw/plugin-sdk/diagnostic-runtime`; do not rely on removed convenience subpaths such as `openclaw/plugin-sdk/diagnostics-otel` or `openclaw/plugin-sdk/memory-lancedb`.

15. **Keep employees simple.** AI employees must complete tasks reliably. Prefer clear skills with well-defined procedures over clever multi-branch logic. Reliability beats sophistication.

16. **Industry-agnostic by default.** Core logic must work for any enterprise. Industry-specific behavior comes from skills and config, not code branches.

17. **Use `ekg/` as the test enterprise.** When building or testing enterprise integration features (MCP servers, custom tools, agent skills, knowledge ingestion), use the GradSale documentation in `ekg/` as the reference enterprise. This includes its NestJS backend API (`ekg/api-web.md`, `ekg/api-admin.md`), PostgreSQL schema (`ekg/database.md`), and frontend architecture (`ekg/web.md`, `ekg/admin-panel.md`).

18. **Document non-obvious decisions.** If a design choice would surprise a new developer, add a brief comment explaining WHY.

19. **Approval-first for risky actions.** Self-provisioning new accounts, financial transactions, data exports, and permission changes always require human approval via OpenClaw's exec.approval system.

20. **Data classification matters.** Respect the T0–T4 data classification tiers. External channels only carry T0/T1 data. Sensitive operations happen on the Sentura dashboard.

## File Naming Conventions

- TypeScript: `kebab-case.ts` for modules, `PascalCase` for classes/types, `camelCase` for functions/variables.
- Skills: `SKILL.md` (uppercase) in a named directory under `skills/`.
- Agent workspace files (8 native OpenClaw files, all uppercase): `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`.
- Config files: `kebab-case.json5` or `kebab-case.yaml`.
- OpenClaw extensions: one folder per extension under `sentura/extensions/<name>/` with `openclaw.plugin.json` manifest.
- Memory detail files: `docs/memory/person-{a,b,c,d}/week-{N}.md` (one file per owner per sprint week), `docs/memory/shared/{kebab-case-topic}.md` (one file per cross-cutting topic, optionally dated — e.g. `workspace-collapse-2026-04-17.md`, `creator-deployment-rounds-1-14.md`), `docs/memory/sitlink/{topic}.md` (independent Sitlink project memory), and `docs/memory/cross-border-ecommerce/{topic}.md` (independent Cross-border e-commerce project memory). Every memory detail file starts with an `> **On-demand reference — not read by default.**` banner and a back-link to `docs/MEMORY.md`.
- Test detail files: `docs/tests/tests-person-{a,b,c,d}.md` + `docs/tests/tests-cross-team.md` + `docs/tests/tests-sitlink.md` + `docs/tests/tests-cross-border-ecommerce.md` (same on-demand banner convention; linked from `docs/TESTS.md` matrix rows).

## Common Pitfalls to Avoid

- Do NOT build a custom agent runtime. OpenClaw IS the agent runtime. Extend it, don't replace it.
- Do NOT call LLM providers directly. All LLM access goes through OpenClaw's provider system.
- Do NOT hardcode credentials or API keys. Use OpenClaw's secret store (`$secret` references in config).
- Do NOT modify OpenClaw core source files. Write extensions and skills instead.
- Do NOT bypass OpenClaw's config system. Use `config.patch` RPC for runtime changes.
- Do NOT create synchronous I/O code. Everything is async.
- Do NOT auto-approve high-risk operations. Human must decide via the approval system.
- Do NOT store credentials in conversation history or workspace files. Use the secret store.
- Do NOT import from OpenClaw's internal `src/` paths. Use the stable `openclaw/plugin-sdk/*` API.
- Do NOT assume a specific deployment environment. Code must work cloud, on-prem, and hybrid.
- Do NOT commit large model files, binary data, or generated artifacts to the repo.
- Do NOT create custom Docker setup scripts, docker-compose files, or `.env` wrappers for OpenClaw. For dev, build from source and use `pnpm openclaw onboard` then `pnpm gateway:watch`. For production Docker, use `cd openclaw && bash docker-setup.sh`. OpenClaw manages its own infra.
