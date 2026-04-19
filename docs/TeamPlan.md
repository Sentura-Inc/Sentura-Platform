# Sentura Platform — 8-Week Team Sprint Plan

> **Aligned with**: README.md (17 Sentura capabilities), docs/OPENCLAW.md, ekg/ test enterprise
>
> **Last synced**: 2026-04-13

> ## ⚠️ DO NOT REINTRODUCE `RULES.md` OR `CONTEXT.md` ⚠️
>
> Sentura agent workspaces use **exactly the 8 OpenClaw-native files** — no `RULES.md`, no `CONTEXT.md`, ever. Hard safety boundaries live inside each agent's `AGENTS.md` under `## Hard Rules (must not override)`, and enterprise context lives inside `BOOTSTRAP.md` under `## Enterprise Context`. The only runtime hook extension is per-user memory (`memory/users/MEMORY_USER_{token}.md`).
>
> If you see `RULES.md` or `CONTEXT.md` mentioned anywhere in `docs/MEMORY.md`, treat those entries as **historical audit log only**. `MEMORY.md` is append-only: earlier entries describe a design that was fully removed from code, templates, tests, runtime workspaces, and documentation. They are kept for provenance, not as specification. Do NOT use them as a guide for current or future tasks.
>
> Concretely, when picking up any task below you MUST NOT:
> - Add a file named `RULES.md` or `CONTEXT.md` anywhere in `sentura/`, `workspaces/`, `~/.openclaw/workspace/`, templates, tests, or scripts.
> - Add prompt sections, skills, hooks, config fields, schema entries, or docs that mention those filenames as current artifacts.
> - Re-introduce "deprecated RULES.md/CONTEXT.md NOT emitted" assertions in tests — the concept is gone from the code, so asserting its absence only keeps it alive in the reader's head.
>
> If a past `MEMORY.md` entry conflicts with this rule, **this rule wins**, and `.cursorrules` + this file are the authoritative source.

## Team Roles

| Person | Title | Ownership | Directories |
|--------|-------|-----------|-------------|
| **A** | Platform & OpenClaw Engineer | OpenClaw local runtime, multi-tenancy, cost tracking, workspace lifecycle, deployment, infrastructure | OpenClaw source (`openclaw/`), deployment configs, CI/CD, platform-level systems |
| **B** | AI Employee & Skills Engineer | Meta-agents (Creator, Tuner, Orchestrator), skills, self-provisioning, knowledge pipeline, employee lifecycle | `sentura/agents/`, `sentura/skills/`, `workspaces/`, skill templates |
| **C** | Frontend & Dashboard Engineer | Sentura admin dashboard, all UI pages, gateway RPC integration | `sentura/dashboard/`, all UI routes, components, WebSocket client |
| **D** | Extensions & Integrations Engineer | Sentura OpenClaw extensions, enterprise MCP generation, security, RBAC, approval, audit | `sentura/extensions/`, MCP server configs, `ekg/` test integration |

## Sentura Capability Coverage Map

Each of the 17 capabilities from README.md Section 1 must have explicit sprint tasks:

| # | Capability | Primary Owner | Sprint Weeks |
|---|-----------|--------------|-------------|
| 1 | Enterprise data integration | D | 2, 3, 4 |
| 2 | Internal MCP server generation (MCP Builder Agent) | B + D | 2, 3 |
| 3 | Self-provisioning orchestration | B + D | 3, 4 |
| 4 | Position-specific safety guardrails (AGENTS.md `§ Hard Rules`) | B + D | 1, 2, 3 |
| 5 | No-code employee creation | B + C | 1, 2 |
| 6 | Incubation pipeline (+ industry ontology merge, ekg/ setup) | B + A | 2, 3, 4 |
| 7 | Enterprise orchestration + AI Manager EKG | B + C | 4, 5 |
| 8 | Multi-tenancy | A + D | 4, 5 |
| 9 | Enterprise authentication (SSO) | A + C | 5, 6 |
| 10 | Cost management | A + C | 4, 5 |
| 11 | Enterprise Knowledge Graph (EKG) — per-agent 4-pillar structured knowledge | B + D | 2, 3, 4 |
| 12 | Data Scavenger Agent — document ingestion → 4-pillar classification → JSON5 | B | 3, 4 |
| 13 | Progressive knowledge accumulation — industry ontologies, Q&A Completion, Experience Links | B + D | 3, 4, 5 |
| 14 | Employee lifecycle management | B + A + C | 5, 6 |
| 15 | Pre-deployment testing & validation | B + D + C | 3, 4, 5 |
| 16 | Communication panel (1:1 chat + group chat) | C + A + D | 3, 4 |
| 17 | Cross-agent knowledge aggregation — Manager capability abstraction, conflict detection, reverse injection | B | 4, 5 |

## Test Documentation Policy

**`docs/TESTS.md` is the single source of truth for what to test and how to verify it.** Every team member must update `docs/TESTS.md` when they add, change, or remove testable deliverables:

- Add test cases for new files, extensions, UI pages, scripts, configs, or skills under your Person section (A, B, C, or D).
- Update existing test cases if behavior, file paths, schemas, or expected outputs change.
- Add cross-team integration tests if your work affects other team members' deliverables.
- Update the "How to Run Tests" section if new test commands are introduced.
- Update the "Test Results Summary Template" totals when test counts change.
- Keep the `Last updated` date current.

This policy is enforced by `.cursorrules` rule 3.

---

## Interface Contracts (Agreed Day 1)

Before Week 1 coding begins, the team agrees on these shared contracts:

| Contract | Owner | Consumers | Format |
|----------|-------|-----------|--------|
| OpenClaw config schema (agents, channels, MCP) | A | B, C, D | JSON5 + Zod schemas (OpenClaw native) |
| Gateway RPC API surface | A | C (dashboard), B (meta-agents) | WebSocket JSON-RPC (OpenClaw protocol) |
| Agent workspace file convention | B | C (UI display), D (extensions) | **OpenClaw 8 native files only**: AGENTS.md (+ § Hard Rules), SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md (+ § Enterprise Context), MEMORY.md + **Sentura additions (outside the 8)**: skills/ directory, ekg/ directory (org/, rules/, assets/, workflows/), memory/users/MEMORY_USER_{token}.md. |
| Creator Agent input/output contract | B | C (UI chat interface) | NL input → agent config + all 8 native workspace files (AGENTS.md with Hard Rules, BOOTSTRAP.md with Enterprise Context) + skills + ekg/ with industry ontology merge |
| Tuning Agent input/output contract | B | C (UI tuning panel) | NL tuning request → config.patch diff + workspace file edits |
| Sentura extension plugin contract | D | B (agents use extensions), C (UI shows status) | `openclaw.plugin.json` manifest + `definePluginEntry` |
| Approval workflow schema | D | B (agents trigger), C (UI approve/reject) | `exec.approval.*` + `plugin.approval.*` RPC + Sentura escalation policies |
| RBAC role definitions (7-role model) | D | C (UI access control), A (gateway auth) | Role → permissions mapping (7 roles from README §15): `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`. Scope model: SME-wide or per-department. Replaces old 5-role model (`dept_admin` and `employee_owner` removed). |
| Dashboard ↔ Gateway communication | C + A | C | WebSocket client wrapper with typed RPC calls |
| Self-provisioning skill interface | B | D (extension support) | Skill + browser tool + secrets store + approval + error recovery flow |
| Enterprise MCP generation contract | D + B | B (Creator Agent wires MCP), A (infra), C (MCP Builder UI) | API docs (ekg/) → MCP Builder Agent → TypeScript MCP server at `sentura/mcp-servers/{name}/` → `config.patch`. See also: MCP Builder Agent I/O contract. |
| Multi-tenancy model | A | D (extensions), C (dashboard) | Tenant isolation strategy, namespace convention |
| Cost tracking event schema | A | C (Cost Center UI), D (audit) | Per-agent LLM call events with token counts and cost estimates |
| Pre-deployment test harness contract | B | D (test data extraction via MCP), C (test results UI) | Test case format (input, expected outcome, scoring rubric), test run results schema, pass/fail thresholds |
| Communication panel session contract | C + A | D (audit), B (meta-agent chat) | `sessions.create` with `agentId` → `sessionKey`; `chat.send` with `sessionKey`; group chat fan-out via `sessions.send`; group metadata store schema |
| **EKG pillar JSON5 schema** | B | D (bootstrap hook), C (Knowledge Manager UI), A (workspace creation) | Entity/relation/attribute format per pillar; required fields: `id`, `type`, `name`; relation format: `{ from, type, to }`; provenance: `{ source, ingested, confidence }`; reference schema at `sentura/config/ekg-schema.json5` |
| **Data Scavenger I/O contract** | B | C (upload UI), D (audit logging) | Input: document file (PDF/DOCX/Excel/image) + target agent ID; Output: structured JSON5 files written to target agent's `ekg/` directory; classification into 4 pillars; additive merge only; notification to affected agents |
| **Experience Link format** | B | D (dreaming extensions), C (EKG browser UI) | JSON5 with fields: `id`, `pattern`, `observation`, `confidence` (0–1), `occurrences`, `firstSeen`, `lastSeen`, `context`, `source` ("autonomous_extraction"); stored at `ekg/workflows/experience-links/`; promotion threshold configurable per agent |
| **Manager capability tag schema** | B | C (Orchestrator dashboard), D (audit) | JSON5 per employee: `agentId`, `capabilities[]` (tag + description), `inputSchema` (required + optional fields), `outputSchema` (produces), `lastUpdated`; stored at Orchestrator's `ekg/capabilities/{agent-id}.json5` |
| **Cross-domain conflict resolution protocol** | B | D (approval integration), C (conflict resolution UI) | Conflict entry: `departments[]`, `description`, `conflicting_rules[]`; Resolution: escalated to admin via approval system; resolved entry includes `resolvedBy`, `resolvedAt`, `globalSopRef`; resolved conflicts move to `ekg/conflicts/resolved/` |
| **Industry ontology template format** | B | A (workspace setup), C (template library UI) | Directory structure mirroring `ekg/` pillars under `sentura/config/industry-ontologies/{industry}/`; each file follows EKG pillar JSON5 schema; merged into agent `ekg/` at incubation Phase 2 |
| **User token contract** | A + D | B (session context), C (user-aware UI) | UUID `userToken` assigned at user creation, stored in `sentura-rbac` user store. Attached to every WebSocket connection. Session key format: `agent:<agentId>:user:<userToken>:<sessionId>`. All LLM/tool/approval traces tagged with `userToken` for audit attribution. `sessions.list` filterable by `userToken`. |
| **Per-user memory isolation contract** | A + B | C (session filtering), D (audit) | Two-tier isolation: (1) Agent-level — per-agent LanceDB `dbPath` at `~/.openclaw/memory/{agentId}/lancedb`; (2) User-level — `userToken` metadata on LanceDB entries, filtered on recall (user entries + global entries where `userToken` is null). Dual MEMORY.md: general `MEMORY.md` at workspace root + `memory/users/MEMORY_USER_{token}.md` per user. `sentura-bootstrap` hook injects both. Dreaming system extended: general promotion (cross-user patterns → MEMORY.md), personal promotion (user-specific → MEMORY_USER_{token}.md), privacy boundary (no user PII in general memory). |
| **MCP Builder Agent I/O contract** | B + D | C (MCP Builder UI), A (infra) | Input: API documentation (OpenAPI/Swagger JSON/YAML, markdown API docs, database schema docs, raw URL for web scraping). Trigger: `ekg_manager` role via dashboard Knowledge Manager page. Output: TypeScript MCP server project at `sentura/mcp-servers/{name}/` containing `index.ts`, `tools/`, `package.json`, `config-snippet.json5`. Agent can ask clarifying questions to EKG Manager. Agent Manager wires generated servers to agents via `config.patch`. |

---

## Week 1 — Foundation & OpenClaw Setup

> **Goal**: OpenClaw running as the core runtime. Everyone has a working local environment. Shared conventions established.
>
> **Capabilities covered**: #4 (guardrails design), #5 (Creator Agent start), #6 (workspace convention)

### Person A — Platform & OpenClaw Engineer
- [x] Build OpenClaw from source (`cd openclaw && pnpm install && pnpm ui:build && pnpm build`)
- [x] Run `pnpm openclaw onboard` — configure gateway, LLM provider, API keys
- [x] Verify LLM providers work (cloud API keys via `~/.openclaw/.env`, local via Ollama)
- [x] Verify channels available (Slack + WebChat via OpenClaw's onboarding)
- [x] Set up the project monorepo structure (`sentura/`, etc.)
- [x] Document the OpenClaw Gateway RPC methods the team will use
- [x] Write `docs/SETUP.md` for local development setup
- Note: OpenClaw builds from source and runs via `pnpm gateway:watch`. Docker is for production only.

### Person B — AI Employee & Skills Engineer
- [x] Create the Creator Agent workspace: `sentura/agents/creator/` with SOUL.md, AGENTS.md, skills/
- [x] Write the first version of the Creator Agent's system prompt
- [x] Design the agent workspace file convention documenting the 8-file native structure (plus Sentura-added skills/, ekg/, memory/users/ subdirectories):
  - OpenClaw 8: AGENTS.md (Sentura adds `## Hard Rules` section — position-specific safety), SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md (Sentura adds `## Enterprise Context` section), MEMORY.md
  - Sentura additions outside the 8 native files: skills/ directory (structured SKILL.md files per capability), ekg/ directory, memory/users/ directory
- [x] Create 3 role templates: `sentura/config/templates/` (AP Clerk, CS Agent, SDR)
- [x] Write the `self-provisioning` skill: `sentura/skills/self-provisioning/SKILL.md`
- [x] Write the `knowledge-curation` skill: `sentura/skills/knowledge-curation/SKILL.md`
- [x] Test manual creation of an AI employee by writing config + workspace files by hand

### Person C — Frontend & Dashboard Engineer
- [x] Scaffold Sentura dashboard (Next.js 15 + Tailwind + shadcn/ui)
- [x] Build the Gateway WebSocket RPC client library (typed wrapper around OpenClaw protocol)
- [x] Create the app shell: sidebar navigation, auth placeholder, layout
- [x] Build the Employee Roster page (list all agents from `config.get` → `agents.list`)
- [x] ~~Build the basic session view~~ → Removed: deferred to OpenClaw Control UI (hybrid approach)
- [x] Revise dashboard to hybrid architecture: remove duplicate pages (sessions), add Control UI external links in sidebar, repurpose home/employees pages for enterprise focus

### Person D — Extensions & Integrations Engineer
- [x] Study OpenClaw's plugin SDK thoroughly (`openclaw/plugin-sdk/*`)
- [x] Scaffold Sentura extension boilerplate: `sentura/extensions/sentura-audit/`
- [x] Build `sentura-audit` extension: logs all tool calls, approvals, config changes to structured output
- [x] Study OpenClaw's approval system (`exec.approval.*`, `plugin.approval.*`)
- [x] ~~Design the RBAC model (Platform Admin, Dept Admin, Employee Owner, Auditor, End User)~~ → Redesigned: **7-role model** (`platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`). Removed `dept_admin` and `employee_owner`; added `manager` (supervision), `ekg_manager` (knowledge control), `agent_manager` (agent design), `viewer` (read-only dashboards). Scope model: SME-wide or per-department.
- [x] Update `sentura/extensions/sentura-rbac/DESIGN.md` with the 7-role model, scope model, and permission tables
- [x] Write initial approval policy configs (which tools need approval, escalation rules)
- [x] Study the `ekg/` GradSale API docs (api-admin.md, api-web.md, database.md) for enterprise MCP generation prep

---

## Week 2 — AI Employee Creation & Enterprise Integration Foundation

> **Goal**: A human can create an AI employee through the Creator Agent. First enterprise MCP server built from ekg/ docs.
>
> **Capabilities covered**: #1 (data integration start), #2 (MCP generation start), #5 (Creator Agent), #6 (incubation pipeline), #11 (EKG schema design)

### Person A — Platform & OpenClaw Engineer
- [x] Implement automated workspace directory creation (create dirs, write all 10 template files + skills/ + ekg/ directory structure + `memory/users/` directory)
- [x] Build a helper script/API that registers a new agent into OpenClaw config via `config.patch`
- [x] Test hot-reload: adding an agent via `config.patch` makes it immediately available
- [x] Configure MCP loopback server for tool protocol interop
- [x] Set up channel binding helpers (programmatically bind agent → channel/peer)
- [x] **Implement per-agent LanceDB isolation convention**: configure `memory-lancedb.dbPath` to `~/.openclaw/memory/{agentId}/lancedb` in per-agent plugin config. Update `sentura-setup.sh` to set `dbPath` for meta-agents. Verify each agent's vector store is isolated.
- [x] **Implement user token infrastructure**: assign `userToken` (UUID) at user creation in `sentura-rbac` user store. Attach `userToken` to WebSocket connections. Define session key format: `agent:<agentId>:user:<userToken>:<sessionId>`. Add `userToken` to all trace/audit events.
- [x] **Fix sandbox seeding defect** (blocker surfaced during Week 2 integration): OpenClaw's `ensureSandboxWorkspace` only copies 7 hardcoded bootstrap files — it never mirrors `skills/`, `memory/`, `ekg/`, `config.json5`, or a customized `BOOTSTRAP.md` into the agent sandbox. Additionally, `agents.list[].skills` in `config.json5` acts as a *skill-name* filter (not a path glob), so the stale `["~/.openclaw/workspace/.../skills/*"]` entries silently disabled all skills. Repair delivered:
  - Removed broken glob-path `skills` filter from `sentura/agents/{creator,tuner,orchestrator}/config.json5` (with explanatory comments).
  - Built new `sentura/hooks/sentura-sandbox-seed/` internal hook that runs on `agent:bootstrap`, detects sandbox workspaces, and syncs from the host workspace: full mirror for `skills/`, union-copy for `memory/` and `ekg/`, union-copy for missing `config.json5`/`MEMORY.md`, and conditional overwrite of stub `BOOTSTRAP.md`. Hardens against symlink/hardlink escapes.
  - Updated `scripts/sentura-setup.sh` to install + enable the new hook, scrub stale `skills` globs from `~/.openclaw/openclaw.json`, and clear stale meta-agent sandboxes so fresh boots hydrate correctly.
  - Added operator repair tool `scripts/repair-sandbox-seeding.ts` for existing installations.
  - Verified via `scripts/test-week2.ts` Part 11 (9 new test cases covering mirror, union-copy, preservation, and sandbox guardrails).
- [x] **Fix deployment-pipeline defect** (follow-on blocker: after sandbox seeding landed, Forge could design a new employee but deployment failed with `Sandbox path is read-only; cannot create directories: /workspace/.openclaw/workspace/<id>`). Root cause: the `employee-deployment` skill used `fs_write` for new-employee workspace files, but `fs_write` is sandbox-local and the host path surfaces as read-only inside the sandbox. OpenClaw's `agents.files.set` only covers the 8 native files; no native RPC exists for subdirectory files. Repair delivered:
  - Built new `sentura/extensions/sentura-agents/` platform extension exposing `sentura.agents.{writeSubfile,readSubfile,deleteSubfile,listSubfiles}` gateway RPCs and a `sentura_agents_manage` agent-facing tool. Path validation (`safeJoin`) blocks `..`, absolute paths, and symlink escapes; `NATIVE_WORKSPACE_FILES` blocks routing native files around `agents.files.set`; per-file size cap (5 MiB default).
  - Updated `scripts/sentura-setup.sh` with a new Step 7a that scans `sentura/extensions/` for the known extension IDs (`sentura-agents`, `sentura-rbac`, `sentura-audit`, `sentura-approval`, `sentura-provisioner`), patches `~/.openclaw/openclaw.json` to add each to `plugins.load.paths`, and enables each in `plugins.entries` — this is the missing wiring step that left all prior installs without any Sentura extensions loaded.
  - Verified via `scripts/test-week2.ts` Part 12 (22 new test cases covering extension manifest, gateway method registration, skill guidance, creator tool allowlist, and setup-script wiring).

### Person B — AI Employee & Skills Engineer — deployment repair
- [x] Rewrite `sentura/agents/creator/skills/employee-deployment/SKILL.md` around gateway RPCs instead of `fs_write`:
  - Added top-level "HARD RULE" forbidding `fs_write` for new-employee workspaces, with the failure mode spelled out.
  - Mapped every deployment intent to the correct RPC: `agents.create` (workspace + natives), `agents.files.set` (overwrite natives), `sentura.agents.writeSubfile` (skills/, ekg/, memory/users/), `config.patch` (registry + bindings). `fs_write`/`fs_read` retained only for sandbox-local scratch.
  - Rewrote Steps 1–6, Tools Needed, Safety, and Rollback sections to match.
  - Updated `sentura/agents/creator/config.json5` `tools.alsoAllow` to grant `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`.
- [x] **Round 4 — fix Creator `AGENTS.md` / `TOOLS.md` / `BOOTSTRAP.md` Hard Rule override** (real root cause of "no response / read-only" after round 3). Problem: Hard Rules at the top of `AGENTS.md` explicitly override every skill, and they still ordered Forge to "ALWAYS `fs_write` new employee workspaces" + prescribed `fs_write` in Phase 5 Step 1. `TOOLS.md` listed `fs_write` as a primary tool and `BOOTSTRAP.md` had Forge verify access to `fs_write` on boot. So Forge kept emitting `fs_write` calls that hit `Sandbox path is read-only`, and the new agent was never registered. Fix:
  - `sentura/agents/creator/AGENTS.md § Hard Rules` rewritten to forbid `fs_write`/`apply_patch` for anything under `/workspace/.openclaw/workspace/<agent>/…` or `/workspace/generated/…`, and to prescribe the canonical `sentura_agents_manage { create_agent → write } → gateway.config.patch` flow. Phase 5 rewritten to match (no `fs_write` prescription anywhere).
  - `sentura/agents/creator/TOOLS.md` promotes `sentura_agents_manage` to "Primary workspace tool"; adds `sentura_rbac_manage` and `sentura_audit_query`; downgrades `fs_read`/`fs_write` to "scratch-only, inside your own sandbox".
  - `sentura/agents/creator/BOOTSTRAP.md` boot-tool-check lists `sentura_agents_manage` first and documents why `fs_write` cannot reach employee workspaces.
  - `sentura/agents/creator/config.json5` header comment updated from "coding profile for fs_write" to the `sentura_agents_manage` rationale.
  - Re-synced all four files into `~/.openclaw/workspace/creator/` and cleared the stale `agent-creator-*` sandbox so the next session reseeds.
  - Verified via 8 new test cases in `docs/TESTS.md § B6.3`.
- [x] **Round 5 — enforce `sentura_agents_manage` via tool-policy deny list** (real root cause of "no response / read-only" after round 4). Problem: rounds 1–4 all lived in prompts (skills, Hard Rules, TOOLS.md, BOOTSTRAP.md). After round 4 Forge's trace still showed `write` tool calls such as `path: "generated/billing-support-rep-support/README.md"` failing with `Sandbox path is read-only; cannot create directories: /workspace/generated/…`. Root cause: the `coding` profile surfaces `write`, `edit`, and `apply_patch` to Forge, and no prompt-level instruction can reliably stop an LLM from reaching for a tool that is still in its toolbox. Fix:
  - `sentura/agents/creator/config.json5 → agents.list[creator].tools.deny = ["write","edit","apply_patch"]`, forcing Forge to route all workspace mutations through `sentura_agents_manage`.
  - `scripts/sentura-setup.sh → overrides.creator.tools.deny = ['write','edit','apply_patch']` so every `pnpm sentura:setup` re-applies the policy.
  - Live `~/.openclaw/openclaw.json` patched in place; stale `agent-creator-b40f8302` sandbox deleted so the next session reseeds with the new tool set.
  - Verified via 7 new test cases in `docs/TESTS.md § B6.4`.
- [x] **Round 6 — authorize the webchat operator via `commands.ownerAllowFrom`** (real root cause of "deployment tools are not exposed" after round 5). Problem: Round 5 removed `write`/`edit`/`apply_patch` and the gateway stopped logging `Sandbox path is read-only`, but Forge still refused to deploy, returning drafts with the explicit message "this sandbox does not expose the `gateway` tool". Root cause: `gateway`, `cron`, and `nodes` are **owner-only** core tools (`openclaw/src/agents/tools/owner-only-tools.ts`); `applyOwnerOnlyToolPolicy` strips them from every agent's manifest whenever `senderIsOwner` is false. Our `commands.ownerAllowFrom` was entirely unset, so every webchat message — including from the local operator on the OpenClaw dashboard — was treated as non-owner, and Forge's declared `alsoAllow: ["gateway", …]` was silently discarded at tool-resolution time. The earlier `Sandbox path is read-only` symptom was a downstream effect: without `gateway`, Forge reached for whichever built-in write tool was still in the `coding` profile. Fix:
  - Live `~/.openclaw/openclaw.json` patched with `commands.ownerAllowFrom: ["*"]` (the canonical single-operator wildcard, covered by `openclaw/src/auto-reply/command-auth.owner-default.test.ts`).
  - `scripts/sentura-setup.sh` (after the agent-overrides block) now writes `config.commands.ownerAllowFrom = ['*']` when unset and preserves any explicit operator list you configure later.
  - Stale `agent-creator-*` sandboxes deleted so Forge's next session reseeds with the owner-authorized tool set.
  - Verified via 7 new test cases in `docs/TESTS.md § B6.5`. Expected E2E behavior after restart: Forge's manifest lists `gateway` and `sentura_agents_manage`; a "deploy a minimal billing agent" request produces a real `gateway.config.patch` call and the new employee appears in the dashboard's `agents.list`.
- [x] **Round 7 — pin `tools.exec.host` to `"gateway"`** (real root cause of "deployment tools are not exposed" that survived round 6). Problem: Round 6 restored `gateway` to Forge's manifest, but Forge still concluded that "this session does not expose the two deployment tools I need" after generating a draft bundle. Only a single tool error was left in the gateway log: `[tools] exec failed: exec host not allowed (requested gateway; configured host is auto; …) raw_params={"command":"which openclaw || openclaw gateway status", … "host":"gateway"}`. Root cause: `tools.exec` was absent from `~/.openclaw/openclaw.json`, so `tools.exec.host` defaulted to `"auto"`. `openclaw/src/agents/bash-tools.exec-runtime.ts → isRequestedExecTargetAllowed` explicitly rejects `host: "gateway"` whenever `sandboxAvailable` is true under `auto`. Forge's self-diagnostic ("can I reach the gateway CLI?") failed, and its LLM collapsed the exec rejection into "the gateway tool itself is missing." Fix:
  - Live `~/.openclaw/openclaw.json` patched with `tools.exec.host: "gateway"` (hot-reloaded at 18:30:14 per the gateway log line `config change applied (dynamic reads: tools.exec)`; no process restart required).
  - `scripts/sentura-setup.sh` now writes `config.tools.exec.host = 'gateway'` right after the `ownerAllowFrom` block, guarded by `if (config.tools.exec.host !== 'gateway')` so operator-customized hosts (`"sandbox"` etc.) are preserved on re-run.
  - Stale `agent-creator-*` sandboxes deleted so Forge's next session reseeds with the updated config.
  - Verified via 8 new test cases in `docs/TESTS.md § B6.6`. Expected E2E behavior: Forge's self-probe succeeds, the `sentura_agents_manage` + `gateway` deployment chain from round 6 actually runs to completion, and `agents.list` picks up the new employee.
- [x] **Round 10 — deny `sessions_spawn` / `subagents` / `sessions_yield` and reconcile AGENTS.md with the existing `exec` deny** (real root cause of the `"noop"` reply and `1000ms` embedded-run timeout observed on retry after round 9). Problem: Forge running `openai/gpt-5.3-codex` hallucinated a `sessions_spawn({ task: "noop", runTimeoutSeconds: 1 })` call. The gateway's subagent-spawn path passed the `1` through as `timeoutMs: 1000`, so the embedded run timed out every turn; the spawned subagent bootstrapped an empty workspace (logs: `[agent:nested] session=agent:creator:subagent:… Read: from ./SOUL.md failed`) and returned nothing, which bubbled up as Forge's literal `"noop"` reply. Zero files written, agent not registered. A previous attempt to remove `sessions_spawn` from `tools.alsoAllow` was a no-op because `openclaw/src/agents/tool-catalog.ts` registers all three tools with `profiles: ["coding"]`, so Forge's `coding` profile's allowlist already shipped them. The only way to block a profile-included tool is via `tools.deny` — `openclaw/src/agents/tool-policy-match.ts → makeToolPolicyMatcher` checks `deny` before any `allow` path. Separately audited a persistent `tools.profile (coding) allowlist contains unknown entries (gateway)` warning; it fires only for subagent sessions (`pi-tools.policy.ts → SUBAGENT_TOOL_DENY_ALWAYS` includes `gateway`) and does not affect the main Forge session, which gets `gateway` via the control-ui's `operator.admin` scope. No fix needed for that warning. Fix:
  - `sentura/agents/creator/config.json5` `tools.deny` extended from `["write","edit","apply_patch","exec"]` to `["write","edit","apply_patch","exec","sessions_spawn","subagents","sessions_yield"]` with a block comment documenting the `coding`-profile override rationale and the `noop` failure mode.
  - Live `~/.openclaw/openclaw.json` hot-patched with the same deny list; verified via `c.agents.list.find(a=>a.id==='creator').tools.deny`.
  - `sentura/agents/creator/AGENTS.md` "Tool Availability" section scrubbed of `sessions_spawn`/`sessions_yield`/`subagents`/`exec`; "Denied intentionally" block now enumerates all seven denied tools with per-tool rationale (matches the config's inline comment).
  - `~/.openclaw/workspace/creator/AGENTS.md` synced byte-for-byte with the repo copy.
  - Verified via 9 new test cases in `docs/TESTS.md § B6.7`. Expected E2E behavior: a fresh deploy of `billing-support-rep` produces zero `[agent:nested] session=agent:creator:subagent:` lines, zero `embedded run timeout` logs, and zero `Read: from ./SOUL.md failed` logs; Forge completes the deploy in a single main session using `sentura_agents_manage` + `gateway.config.patch`, and `agents.list` returns the new employee.
- [x] **Round 11 — set creator `sandbox.workspaceAccess: "rw"` so host workspace edits actually reach the in-container agent** (real reason Rounds 6–10's AGENTS.md/TOOLS.md/BOOTSTRAP.md edits had no visible effect on the running agent). Problem: deep audit of `openclaw/src/agents/sandbox/` found that with the default `workspaceAccess: "none"`, `/workspace` in the container is bind-mounted at a separate host dir (`~/.openclaw/sandboxes/agent-creator-<hash>/`) that is seeded from `~/.openclaw/workspace/creator/` exactly once via `ensureSandboxWorkspace` (`openclaw/src/agents/sandbox/workspace.ts:17-59`, which uses `fs.writeFile(..., {flag: "wx"})` — only writes if the dest is missing, never on mtime change). Live evidence at the time of the audit: workspace `AGENTS.md` was 18706 bytes (Apr 18 22:32) while the sandbox copy was 18053 bytes (Apr 18 20:43). Forge was reading the 20:43 copy, which still advertised `sessions_spawn`, `sessions_yield`, `subagents`, and `exec` in its Tool Availability list — exactly why the model kept emitting `sessions_spawn({task:"noop"})` even after Round 10's deny list shipped. Also audited the full subagent-spawn surface (only `sessions_spawn`, `subagents` tool, `sessions_yield`, `/subagents spawn` slash command) and the `senderIsOwner` path (`openclaw/src/gateway/server-methods/agent.ts:83-86`, scope-based); confirmed no implicit auto-spawn or auto-heartbeat exists for Creator. Fix:
  - `sentura/agents/creator/config.json5` `sandbox` upgraded from `{ mode: "non-main" }` to `{ mode: "non-main", workspaceAccess: "rw" }` with a block comment documenting (a) the seed-once semantics of `ensureSandboxWorkspace`, (b) why `"ro"` does not solve the problem (the second mount it adds is at `SANDBOX_AGENT_WORKSPACE_MOUNT`, not `/workspace`, so the agent would still read stale docs from `/workspace`), and (c) the safety posture (OK because `tools.deny` already strips all built-in filesystem-mutation tools and Forge's only fs tool — `sentura_agents_manage` — targets OTHER agents' workspaces, not Forge's own; `sandbox.mode: "non-main"` still isolates Forge from the host Sentura repo).
  - Live `~/.openclaw/openclaw.json` hot-patched with the same sandbox block; verified via `c.agents.list.find(a=>a.id==='creator').sandbox === { mode: "non-main", workspaceAccess: "rw" }`.
  - Stale `~/.openclaw/sandboxes/agent-creator-<hash>/` dir removed by the operator prior to the change so the next Forge boot creates a fresh container with the live bind mount.
  - Verified via 6 new test cases in `docs/TESTS.md § B6.8`. Expected E2E behavior: editing `~/.openclaw/workspace/creator/AGENTS.md` on the host and restarting the gateway is sufficient for the in-container agent to see the new content, with no manual sandbox cleanup required. `docker inspect` of the creator sandbox shows `/workspace` mount `Source` = `~/.openclaw/workspace/creator` and `RW: true`. No new `~/.openclaw/sandboxes/agent-creator-*` dir is created.

### Person B — AI Employee & Skills Engineer
- [x] Build Creator Agent Phase 1: Research & Discovery (web search, clarifying questions) — `sentura/agents/creator/skills/research-and-discovery/SKILL.md`
- [x] Build Creator Agent Phase 2: Design (generate agent config + all 8 native workspace files + skills) — `sentura/agents/creator/skills/employee-design/SKILL.md`
  - [x] Generates `AGENTS.md` with a `## Hard Rules (must not override)` section carrying position-specific guardrails (Sentura convention; top-priority prompt placement)
  - [x] Generates `BOOTSTRAP.md` with a `## Enterprise Context` section carrying enterprise org/policies
  - [x] Wires MCP server references for required integrations
  - [x] Creates `ekg/` directory structure with 4 pillar subdirectories (org/, rules/, assets/, workflows/)
  - [x] Merges appropriate industry ontology template into `ekg/` during incubation
  - [x] Sets `memory-lancedb.dbPath` to `~/.openclaw/memory/{agentId}/lancedb` in per-agent plugin config for vector store isolation
- [x] Build Creator Agent Phase 4: Deploy (write workspace, `config.patch`, smoke test) — `sentura/agents/creator/skills/employee-deployment/SKILL.md`
- [x] Test Creator helpers offline — `scripts/test-creator-helpers.ts` (49/49 pass; helper-level validation, not true LLM E2E)
- [x] Test end-to-end: NL → real LLM Creator run → working AI employee — `scripts/test-creator-e2e-live.ts` PASSED on 2026-04-19 with `openai/gpt-5.4`: NL brief "Create Penny (AP clerk, > £5000 escalate)" → Forge ran Phase 1–4 → new agent `penny-ap` appeared in config after ~110s → 8-file workspace materialized with the £5000 approval rule correctly embedded in AGENTS.md Hard Rules. See MEMORY.md Round 13.
- [x] Write 5 more skill templates for common enterprise tasks — `sentura/config/templates/_common/skills/` (meeting-notes, document-summarization, escalation-handling, status-update, knowledge-base-lookup)
- [x] **Design the EKG 4-pillar JSON5 schema (capability #11)**:
  - [x] Defined entity/relation/attribute format for each pillar (org, rules, assets, workflows)
  - [x] Defined provenance tracking fields (source document, ingestion date, confidence score)
  - [x] Defined Experience Link JSON5 format (pattern, observation, confidence, occurrences)
  - [x] Documented schema at `sentura/config/ekg-schema.json5`
- [x] **Build 2 industry ontology templates (capability #13 — Tier 1)**:
  - [x] `sentura/config/industry-ontologies/financial-services/` (SOX, AML/KYC, PCI, approval chains, standard SOPs)
  - [x] `sentura/config/industry-ontologies/e-commerce/` (consumer protection, fraud detection, order fulfillment, RMA/refund/chargeback)
- [x] **Create MCP Builder Agent workspace**: `sentura/agents/mcp-builder/` with the full 8 native workspace files (AGENTS.md § Hard Rules + BOOTSTRAP.md § Enterprise Context) and 4 skills (api-analysis, mcp-generation, smoke-test, register-server). Agent takes API docs as input and produces TypeScript MCP server projects at `sentura/mcp-servers/{name}/`. **Round 14 (2026-04-20)**: `config.json5` repaired during Week 2 audit — invalid `openai/gpt-4o` model replaced with `openai/gpt-5.4` (the `openai` provider doesn't register `gpt-4o`); broken path-glob `skills:` filter removed (OpenClaw treats `agents.list[].skills` as a name filter, not a glob, so the old entry silently disabled all four skills); Creator-parity `tools.deny = [sessions_spawn, subagents, sessions_yield]` applied to prevent the Round-10 noop-hallucination loop on first deploy. Covered by `docs/TESTS.md` B9.6 + B9.7.

### Person C — Frontend & Dashboard Engineer
- [x] Build the Employee Creator chat UI (`/create` — talks to Creator Agent via gateway). Streaming chat via `sessions.create` + `chat.send` + `chat` events with `state: "delta"`/`"final"`.
- [x] Build the Employee Detail page (`/employees/[id]` — show the 8 native workspace files, channel bindings, lifecycle actions). Note: `agents.files.get` only exposes bootstrap + memory files from an allow-list (e.g., `SOUL.md`, `AGENTS.md`, `BOOTSTRAP.md`); any file outside the allow-list is shown in the file list but edit-out links to Control UI's config editor. Lifecycle: Refresh, Tune (deferred W3), Edit in Control UI, Retire (via `agents.delete` with confirmation dialog).
- [x] ~~Build the Session/Conversation viewer~~ → Removed: deferred to OpenClaw Control UI (hybrid approach)
- [x] Build the Approval Queue page (`/approvals` — list pending approvals, approve/reject with decision context). Seeds from `exec.approval.list` + `plugin.approval.list` on connect, then subscribes to `*.approval.requested`/`*.approval.resolved` events. Approve-once / Always-allow / Deny with optional reason. Requires `operator.approvals` scope (added to gateway client).

### Person D — Extensions & Integrations Engineer
- [ ] Build `sentura-rbac` extension with **7-role model**: `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`. Implement scope model (SME-wide or per-department). Include `userToken` in user store.
- [ ] Implement RBAC middleware: check permissions before every RPC call (role-based, using new 7-role definitions)
- [ ] **Build first enterprise MCP server from ekg/ GradSale API docs** (Tier 2: Sentura-generated)
  - Wrap GradSale admin API endpoints (disputes, users, support threads, transactions) as MCP tools
  - Wrap GradSale web API endpoints (auth, listings, messages) as MCP tools
  - Use `@modelcontextprotocol/sdk` to build typed tool definitions
- [ ] Test MCP server integration: AI employee can use GradSale MCP tools in conversation
- [ ] Document the enterprise MCP generation pattern (API docs → MCP server → config.patch)

---

## Week 3 — Self-Provisioning & Live Tuning

> **Goal**: AI employees can self-provision new tools with approval + error handling. Users can tune employees via NL.
>
> **Capabilities covered**: #1 (data integration continued), #2 (MCP generation tooling), #3 (self-provisioning), #4 (guardrails enforcement), #12 (Data Scavenger Agent), #13 (Q&A Completion + Experience Links design), #15 (test harness design), #16 (communication panel — 1:1 chat)

### Person A — Platform & OpenClaw Engineer
- [ ] Build secret store helpers: programmatic write/read of OpenClaw secrets
- [ ] Build MCP server dynamic registration: add MCP server configs via `config.patch`
- [ ] Validate Playwright browser extension works locally (for self-provisioning)
- [ ] Implement config versioning: track before/after diffs for every `config.patch`
- [ ] Build deployment documentation for cloud and on-premise (see [`docs/HOSTING.md`](docs/HOSTING.md) for production topology, auth modes, reverse proxy configs, and security risk analysis)
- [ ] **Build session management helpers for Communication Panel (capability #16)**:
  - Helper to create dashboard sessions targeting specific agents (`sessions.create` with `agentId`)
  - Helper to list/filter dashboard sessions across all agents (`sessions.list` with dashboard key prefix filtering)
  - Extend gateway client with `createChatSession(agentId)`, `listChatSessions()`, `sendChatMessage(sessionKey, message)` typed wrappers

### Person B — AI Employee & Skills Engineer
- [ ] Build Creator Agent Phase 3: Self-Provisioning pipeline
  - Structured SKILL.md procedure (not just a prompt)
  - Approval integration (new accounts → HITL via exec.approval)
  - Error recovery (CAPTCHA, 2FA, rate limits → escalate to human with context)
  - Audit logging of every provisioning event
- [ ] Test self-provisioning end-to-end: create employee → needs Zendesk → registers → configures
- [ ] **Design the pre-deployment test harness (capability #15)**:
  - Define test case schema: input scenario, expected actions, expected outcome, scoring rubric
  - Build test case extractor: pull historical tasks from enterprise data layer via MCP tools
  - Build mock task generator: synthesize realistic scenarios from database schema + API capabilities when historical data is insufficient
  - Define pass/fail thresholds and maximum auto-tune iteration count
- [ ] Build Tuning Agent: NL instruction → workspace file edits + config.patch
- [ ] Test Tuning Agent: "make the AP clerk more casual" → SOUL.md updated
- [ ] Create the Orchestrator Agent workspace (Mode B: multi-agent coordination)
- [ ] Write provisioning templates for 5 common SaaS services
- [ ] **Build Data Scavenger Agent workspace (capability #12)**:
  - Create `sentura/agents/data-scavenger/` with SOUL.md and skills/
  - Build ingestion skill: accept uploaded documents (PDF, DOCX, Excel, images)
  - Build classification skill: LLM-driven 4-pillar classification of extracted content
  - Build structuring skill: convert classified content to JSON5 with entities, relations, provenance
  - Build merge skill: additive merge into target agent's `ekg/` files (never destructive)
  - Notification: alert affected agents that their knowledge base was updated
- [ ] **Design Q&A-based Completion skill (capability #13 — Tier 2 gap-filling)**:
  - Cron-triggered skill that reads agent's `ekg/` directory
  - Identifies missing required fields (null values, empty relations, incomplete entities)
  - Generates clarifying questions with context ("I noticed X is missing from Y")
  - Delivers questions via `message` tool (Slack/Teams) or queues for next conversation
  - Write skill: `sentura/skills/qa-completion/SKILL.md`
- [ ] **Design Experience Link extraction skill (capability #13 — Tier 3)**:
  - Post-task hook that evaluates completed tasks for reusable patterns
  - Generates candidate Experience Links with initial confidence scores
  - Write skill: `sentura/skills/experience-extraction/SKILL.md`
- [ ] **Design per-user memory isolation (workspace layer)**:
  - Implement dual MEMORY.md system: general `MEMORY.md` (workspace root) + `MEMORY_USER_{token}.md` files in `memory/users/`
  - Extend `sentura-bootstrap` hook to inject current user's `MEMORY_USER_{token}.md` alongside general `MEMORY.md` into system prompt
  - Extend dreaming system: general promotion (cross-user patterns → `MEMORY.md`), personal promotion (user-specific → `MEMORY_USER_{token}.md`), privacy boundary (no user PII in general memory)
  - Test: two users interact with same AI employee → verify memories are isolated, general patterns are promoted

### Person C — Frontend & Dashboard Engineer
- [ ] Build the Live Tuning UI (`/tune` — chat with Tuning Agent, show before/after diffs)
- [ ] Build the Integration Manager page (`/integrations` — list MCP servers, status, credentials)
- [ ] ~~Build the Employee Editor~~ → Simplified: workspace file editor in `/employees/[id]` detail page (raw config editing deferred to Control UI)
- [ ] Add real-time updates: WebSocket events for approvals, config changes (session events deferred to Control UI)
- [ ] **Build 1:1 Chat Panel — Communication Panel MVP (capability #16)**:
  - New `/chat` route with two-pane layout: conversation list (left) + chat thread (right)
  - Conversation list: all dashboard sessions grouped by employee, sorted by last activity
  - "New conversation" button: employee picker → `sessions.create` with selected `agentId`
  - Chat thread: send messages via `chat.send`, stream responses via WebSocket `chat` events (`state: "delta"` / `"final"`)
  - Load conversation history via `chat.history` on conversation open
  - Typing indicator, message timestamps, agent avatar/name attribution
  - Conversation persistence (OpenClaw session stores survive page reloads)
  - Add `/chat` link to dashboard sidebar navigation

### Person D — Extensions & Integrations Engineer
- [ ] Build `sentura-provisioner` extension: coordinates self-provisioning workflows
- [ ] Implement approval integration for self-provisioning (new accounts need approval)
- [ ] Build `sentura-approval` extension: enhanced HITL with escalation + timeout + decision-context
  - Extends OpenClaw's binary exec.approval into context-aware approval (e.g., "approve if refund < $500")
  - Configurable escalation chains and timeout policies
- [ ] **Expand MCP generation into MCP Builder Agent** (replaces standalone CLI tool):
  - Wire B's MCP Builder Agent workspace (`sentura/agents/mcp-builder/`) with API analysis + code generation skills
  - Input: OpenAPI/Swagger specs (JSON/YAML), markdown API docs (like ekg/*.md), database schema docs, or raw URL
  - Output: TypeScript MCP server project at `sentura/mcp-servers/{name}/` with `index.ts`, `tools/`, `package.json`, `config-snippet.json5`
  - Agent can ask clarifying questions to `ekg_manager` who triggers it
  - Access control: only `ekg_manager` role can trigger the MCP Builder Agent via dashboard
- [ ] Configure 2 open-source MCP servers (Tier 1: npm packages) for common enterprise tools
- [ ] **Build test data extraction tools for pre-deployment testing (capability #15)**:
  - MCP tool wrapper that queries enterprise data for historical task records (e.g., past support tickets, past invoices)
  - Output in standardized test case format (matching B's test harness schema)
  - Test with ekg/ GradSale: extract past dispute records and support threads as test cases
- [ ] Test approval flow: AI employee triggers high-risk action → human approves on dashboard
- [ ] **Extend sentura-bootstrap hook to load `ekg/` files into agent context (capability #11)**:
  - Update `sentura/hooks/sentura-bootstrap/handler.ts` to scan `ekg/` directory at agent startup
  - Inject EKG summary (pillar counts, key entities, rule count) into system prompt alongside AGENTS.md Hard Rules and BOOTSTRAP.md Enterprise Context (both already loaded natively by OpenClaw)
  - Ensure `ekg/` files are included in OpenClaw's workspace file scanning for vector indexing

---

## Week 4 — Multi-Tenancy, Orchestration & Knowledge Pipeline

> **Goal**: Multi-tenancy foundation. Mode B orchestration working. Knowledge ingestion functional. Cost tracking starts.
>
> **Capabilities covered**: #7 (orchestration + Manager EKG), #8 (multi-tenancy), #10 (cost tracking), #11 (EKG integration testing), #12 (Data Scavenger testing), #13 (Experience Links implementation), #15 (test runner implementation), #16 (communication panel — group chat), #17 (Manager capability abstraction)

### Person A — Platform & OpenClaw Engineer
- [ ] **Design and implement multi-tenancy model**:
  - Tenant isolation strategy (OpenClaw is single-tenant → Sentura must add namespacing)
  - Per-department agent namespacing (e.g., `finance/ap-clerk`, `support/cs-agent`)
  - Workspace directory isolation per tenant
  - Config namespace separation
- [ ] **Build LanceDB user-level metadata partitioning** (Sentura memory extension wrapper):
  - Extend LanceDB memory entry schema with `userToken` metadata field
  - On `autoCapture`: inject `userToken` from session context into memory entries
  - On `autoRecall` / `memory_search`: filter by `userToken` (return user entries + global entries where `userToken` is null)
  - Implement as a Sentura memory extension that wraps `memory-lancedb` hooks (no OpenClaw core modification)
  - Test: two users interact with same agent → recall returns only own memories + global memories
- [ ] **Build cost tracking backend**:
  - Intercept LLM calls via extension hook → capture token counts, model, latency
  - Per-agent cost attribution (OpenClaw has no per-agent cost tracking)
  - Per-department aggregation
  - Store cost events for dashboard queries
- [ ] Optimize gateway performance for multiple concurrent AI employees
- [ ] Build monitoring: health endpoints, employee status, provider availability
- [ ] Set up OpenTelemetry via `diagnostics-otel` extension

### Person B — AI Employee & Skills Engineer
- [ ] Build Orchestrator Agent: task decomposition, assignment to employees, result synthesis
  - Extends OpenClaw's basic `sessions_spawn` with structured task tracking
  - Progress monitoring via `sessions_history`
  - Dependency-aware task ordering
  - Set up Orchestrator's `ekg/` directory structure (capabilities/, conflicts/, insights/, global-sops/)
- [ ] Test Mode B: "Prepare Q4 report" → Orchestrator assigns subtasks to AP Clerk + CS Agent
- [ ] **Integrate Data Scavenger Agent with Knowledge Curator (capabilities #11, #12)**:
  - Data Scavenger processes uploads → writes structured JSON5 to agent `ekg/` directories
  - Knowledge Curator continues generating SKILL.md files from `ekg/` structured data
  - Test: upload company directory PDF → Data Scavenger → `ekg/org/org-chart.json5` → agent can answer "who approves purchases?"
  - Test: upload financial policy PDF → Data Scavenger → `ekg/rules/financial-controls.json5` → agent checks limits before acting
- [ ] **Implement Experience Link extraction (capability #13 — Tier 3)**:
  - Build post-task hook that evaluates completed tasks for reusable patterns
  - Implement confidence scoring: frequency, relevance, diversity, recency weights
  - Integrate with dreaming cycle: light phase detects gaps, deep phase extracts patterns, REM promotes high-confidence links
  - Test: run agent through 3 similar procurement tasks → verify Experience Link auto-generated
- [ ] **Build Manager capability abstraction (capability #17 — Mechanism 1)**:
  - When Creator Agent incubates a new employee (Phase 5: Deploy), auto-extract Capability Tags and I/O Schemas
  - Write capability metadata to Orchestrator's `ekg/capabilities/{agent-id}.json5`
  - Test: create a Legal Specialist → verify `ekg/capabilities/legal-specialist.json5` created with correct capability tags
- [ ] **Implement pre-deployment test runner (capability #15)**:
  - Run employee in sandbox mode against each test case
  - Score results across 6 dimensions: task completion, tool usage, safety compliance, escalation judgment, tone, error handling
  - Build auto-tune loop: diagnose failure root cause → apply targeted fix (SKILL.md, AGENTS.md `§ Hard Rules`, SOUL.md, BOOTSTRAP.md `§ Enterprise Context`, ekg/ files, or tool config) → re-test
  - Cap iterations with human-review escalation if max retries exceeded
  - Test against ekg/ GradSale: create CS agent → run against historical dispute records → tune until all pass
- [ ] Build incubation memory: Creator Agent remembers past creations, learns from failures
- [ ] Write reflection loop: Creator monitors new employee, auto-patches issues

### Person C — Frontend & Dashboard Engineer
- [ ] Build the Orchestrator dashboard (`/orchestrator` — task decomposition view, progress tracking)
- [ ] Build the Knowledge Manager UI (`/knowledge` — upload documents to Data Scavenger, view generated skills, browse agent EKG pillar contents, skill distribution)
- [ ] **Build the Cost Center page** (`/cost` — per-employee, per-department LLM spend — backed by A's cost tracking)
- [ ] ~~Build the Health Monitor~~ → Removed: deferred to OpenClaw Control UI `/overview` (linked via sidebar)
- [ ] **Build the Test Results dashboard** (`/testing` — capability #15: test scorecard per employee, per-dimension scores, pass/fail status, auto-tune history)
- [ ] Add tenant/department selector to dashboard (prep for multi-tenancy UI)
- [ ] **Implement user-aware session filtering in dashboard**:
  - Filter `sessions.list` by `userToken` — each user sees only their own conversations
  - `manager` and `platform_admin` roles can view all sessions (filtered by scope)
  - `auditor` sees all sessions (read-only)
  - `viewer` sees aggregate metrics only (no session-level access)
  - Chat panel and session views respect `userToken` isolation
- [ ] **Build Group Chat — Communication Panel Phase 2 (capability #16)**:
  - Group creation UI: select multiple AI employees + invite humans by name/role
  - Fan-out orchestration layer (Next.js API route): receives a human message → sends to N agent sessions via `sessions.send` → merges streaming responses into a unified thread with agent attribution
  - Group metadata store (Sentura-managed JSON/SQLite): group name, participant list, purpose, underlying session keys
  - Unified chat thread view: messages from all agents and humans interleaved chronologically with sender attribution
  - Group management: add/remove participants, rename group, archive

### Person D — Extensions & Integrations Engineer
- [ ] Build comprehensive audit logging (every action, every tool call, searchable)
- [ ] Implement data classification (T0–T4 tiers) in audit extension
- [ ] **Implement multi-tenancy in extensions**: tenant-aware audit logging, approval routing, RBAC scoping
- [ ] **Integrate audit logging for Communication Panel conversations (capability #16)**:
  - Log all dashboard chat messages (human → agent, agent → human) as audit events
  - Log group chat creation, participant changes, and fan-out actions
  - Ensure chat audit events are queryable via the audit trail page
- [ ] Configure more MCP servers using 3-tier strategy:
  - 2 more open-source MCP servers (Tier 1)
  - 1 more enterprise-generated MCP server from ekg/ docs (Tier 2)
- [ ] Build MCP server health monitoring (connection status, error tracking)
- [ ] Write security scanner: detect risky agent configurations

---

## Week 5 — Security, SSO & Employee Lifecycle

> **Goal**: Enterprise-grade security. SSO integration. Complete RBAC. Employee lifecycle management.
>
> **Capabilities covered**: #8 (multi-tenancy complete), #9 (SSO), #14 (employee lifecycle), #15 (role template test suites), #17 (Manager conflict detection + reverse injection)

### Person A — Platform & OpenClaw Engineer
- [ ] **Implement enterprise SSO integration** (SAML/OIDC for dashboard auth)
  - OpenClaw uses token + device pairing — Sentura adds SSO on top
- [ ] **Complete multi-tenancy implementation**: tenant data segregation, cross-tenant protection
- [ ] Build secret rotation automation (API keys, tokens)
- [ ] Implement backup/restore for OpenClaw state directory (including `ekg/` directories)
- [ ] Build on-premise deployment documentation (air-gapped, no internet) — extend [`docs/HOSTING.md`](docs/HOSTING.md) with air-gap-specific instructions
- [ ] Load testing: verify platform handles 20+ concurrent AI employees

### Person B — AI Employee & Skills Engineer
- [ ] Build 10 role templates covering common enterprise positions
- [ ] Refine Creator Agent with real-world feedback from testing
- [ ] **Build employee lifecycle management**:
  - Employee cloning: duplicate an employee with modifications
  - Employee versioning: rollback to previous configuration (workspace files + config)
  - Employee health scoring: response quality, error rate, approval rejection rate
  - Employee retirement: graceful shutdown, session handoff, data archival
- [ ] **Bundle role template test suites**: write 10 standard test cases per role template (AP Clerk, CS Agent, SDR, etc.)
- [ ] Refine self-provisioning for 10+ common SaaS services
- [ ] Test Creator Agent against GradSale ekg/ scenario: create a CS agent for GradSale → run pre-deployment tests → auto-tune → deploy
- [ ] **Build Manager cross-domain conflict detection skill (capability #17 — Mechanism 2)**:
  - Cron-triggered skill on the Orchestrator that reads all employee `ekg/rules/` summaries
  - Detects rule conflicts across departments (LLM reasoning over structured JSON5)
  - Creates conflict entries in `ekg/conflicts/` requiring human resolution
  - Escalates to admin via approval system with conflict context
  - On resolution: writes Global SOP link to `ekg/global-sops/`
- [ ] **Build Manager reverse-injection training skill (capability #17 — Mechanism 3)**:
  - Periodic analysis skill that reviews task completion patterns across employees (via `sessions_history`)
  - Identifies systemic issues (e.g., high rejection rates, common errors)
  - Generates optimization directives in `ekg/insights/`
  - Reverse-injects new rules or skills into target employees' workspaces (`ekg/rules/` or `skills/`)
  - Test: run 10 contract tasks → Manager detects "80% rejected for missing penalty clause" → injects rule into Sales agents
- [ ] **Build 3rd industry ontology template**: `sentura/config/industry-ontologies/healthcare/` (HIPAA compliance, clinical workflows)

### Person C — Frontend & Dashboard Engineer
- [ ] Implement full 7-role RBAC in dashboard (role-based views, permission enforcement per README §15 — `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`)
- [ ] Build the Audit Trail page (`/audit` — searchable, filterable, exportable, tagged with `userToken` for attribution)
- [ ] Build the Settings page (`/settings` — SSO config, 7-role RBAC management, scope model, global approval policies, gateway connection)
- [ ] Build the Employee Template Library (browse, preview, deploy from template — part of `/create`)
- [ ] **Implement SSO login flow in dashboard** (SAML/OIDC redirect, integrated with trusted-proxy auth per docs/HOSTING.md)
- [ ] **Build Employee Lifecycle UI** (in `/employees` and `/employees/[id]`): version history, clone, health score, retire

### Person D — Extensions & Integrations Engineer
- [ ] Security audit: review all extensions for vulnerabilities
- [ ] Implement external channel data boundaries (T0/T1 only on Slack/Teams per README §15)
- [ ] Build sandbox enforcement: all AI employees run in sandbox mode
- [ ] Implement credential encryption at rest in secret store
- [ ] Build security event monitoring and alerting
- [ ] Finalize RBAC policy enforcement across all gateway RPC methods

---

## Week 6 — Polish & Integration Testing

> **Goal**: All features integrated. End-to-end flows working reliably. All 17 capabilities functional.
>
> **Validation**: Test every capability against the ekg/ GradSale enterprise scenario (including EKG pipeline and pre-deployment testing)

### Person A — Platform & OpenClaw Engineer
- [ ] E2E test: full employee lifecycle (create → provision → work → tune → version → clone → retire)
- [ ] E2E test: multi-agent orchestration with real channel communication
- [ ] E2E test: multi-tenancy isolation (two departments cannot see each other's employees)
- [ ] E2E test: cost tracking produces accurate per-agent, per-department reports
- [ ] Performance optimization: memory usage, startup time, response latency
- [ ] Docker image optimization: slim build, fast startup

### Person B — AI Employee & Skills Engineer
- [ ] E2E test: Creator Agent creates employees for all 10 role templates
- [ ] E2E test: self-provisioning works for all supported services (including error recovery)
- [ ] E2E test: Tuning Agent handles diverse tuning requests
- [ ] E2E test: Knowledge Curator + Data Scavenger ingests documents → structured `ekg/` files + distributes skills to employees
- [ ] **E2E test: Full EKG pipeline** (upload company docs → Data Scavenger → `ekg/` JSON5 files → agent uses structured knowledge → Q&A Completion detects gaps → Experience Links generated after repeated tasks)
- [ ] **E2E test: Manager EKG aggregation** (incubate 3 employees → capability tags auto-extracted → conflict detection finds rule contradiction → admin resolves → Global SOP written → reverse injection trains employee)
- [ ] **E2E test: GradSale scenario end-to-end** (create CS agent from ekg/ docs → merge e-commerce ontology → wire MCP → Data Scavenger ingests GradSale data → pre-deployment tests → auto-tune → deploy → handle support tickets)
- [ ] **E2E test: Pre-deployment testing pipeline** (historical task extraction → test run → failure → auto-tune → re-test → pass → deploy)
- [ ] Polish skill templates based on testing feedback
- [ ] Write the employee onboarding skill (new employee introduces itself)

### Person C — Frontend & Dashboard Engineer
- [ ] E2E test: all enterprise dashboard pages with real data (excludes Control UI pages)
- [ ] **E2E test: Communication Panel (capability #16)**: 1:1 chat with 3+ employees, group chat with 2+ agents, message streaming, history persistence, conversation list accuracy
- [ ] UI polish: loading states, error handling, empty states, responsive design
- [ ] Accessibility audit (keyboard nav, screen readers)
- [ ] Build the onboarding wizard (first-time setup experience — includes Control UI URL configuration)
- [ ] Dashboard performance optimization
- [ ] E2E test: SSO login flow with test OIDC provider
- [ ] Verify Control UI external links work across all deployment topologies (single-domain, two-subdomain, local dev)

### Person D — Extensions & Integrations Engineer
- [ ] E2E test: approval flows for all risk categories (including decision-context approvals)
- [ ] E2E test: audit logging captures all required events
- [ ] E2E test: RBAC prevents unauthorized access at every level
- [ ] E2E test: MCP servers from all 3 tiers work reliably
- [ ] E2E test: data classification enforcement (T0–T4 tier boundaries)
- [ ] Integration test: GradSale MCP server handles all admin + web API endpoints
- [ ] Write security documentation

---

## Week 7 — Documentation & Edge Cases

> **Goal**: Comprehensive documentation. Edge cases handled. Ready for beta.

### Person A — Platform & OpenClaw Engineer
- [ ] Write deployment guide (cloud, on-premise, hybrid) — finalize [`docs/HOSTING.md`](docs/HOSTING.md) with step-by-step instructions for each target (VPS, VM, on-prem)
- [ ] Write admin guide (configuration, monitoring, troubleshooting, multi-tenancy setup)
- [ ] Handle edge cases: gateway restart with active sessions, provider failover
- [ ] Handle edge cases: multi-tenant config conflicts, cost tracking during provider outages
- [ ] CI/CD pipeline: build, test, deploy automation
- [ ] Final performance benchmarks

### Person B — AI Employee & Skills Engineer
- [ ] Write user guide (creating employees, tuning, orchestration, knowledge ingestion)
- [ ] Handle edge cases: Creator Agent failures, incomplete provisioning, bad user input
- [ ] Build fallback strategies: if self-provisioning fails, graceful degradation to manual setup
- [ ] Write skill authoring guide (how to write custom SKILL.md files, AGENTS.md `§ Hard Rules` conventions)
- [ ] Write enterprise onboarding guide (how to prepare API docs for MCP generation)
- [ ] Final skill template polish

### Person C — Frontend & Dashboard Engineer
- [ ] Write UI component documentation
- [ ] Handle edge cases: offline gateway, long-running operations, concurrent edits
- [ ] Build export features (conversation export, audit log export, cost reports)
- [ ] Final UI polish and cross-browser testing
- [ ] Mobile-responsive dashboard optimization

### Person D — Extensions & Integrations Engineer
- [ ] Write extension development guide
- [ ] Write MCP server configuration guide (all 3 tiers with examples)
- [ ] Write enterprise MCP generation guide (API docs → MCP server → employee integration)
- [ ] Handle edge cases: approval timeout handling, secret rotation during active sessions
- [ ] Final security review and penetration testing
- [ ] Write compliance documentation (data handling, audit capabilities, data classification)

---

## Week 8 — Beta Release & Stabilization

> **Goal**: Beta-ready platform. All 17 capabilities stable. Documentation complete.

### All Team Members
- [ ] Full regression testing against all 17 Sentura capabilities
- [ ] Fix all critical and high-priority bugs
- [ ] Review and merge all pending PRs
- [ ] Final documentation review
- [ ] Prepare demo scenarios using GradSale ekg/ enterprise:
  - Demo 1: Create a CS agent for GradSale via natural language (with e-commerce industry ontology merged)
  - Demo 2: Upload GradSale company docs → Data Scavenger populates `ekg/` → agent uses structured knowledge
  - Demo 3: Self-provision GradSale API access, wire MCP tools, handle a support ticket
  - Demo 4: Orchestrator assigns tasks across multiple GradSale employees, detects cross-department conflict, generates Global SOP
  - Demo 5: Manager identifies systemic pattern, reverse-injects training into employee agent
- [ ] Record demo video
- [ ] Tag beta release

### Person A
- [ ] Final deployment pipeline validation (cloud + on-premise)
- [ ] Write release notes covering all 17 capabilities
- [ ] Set up monitoring and alerting for beta deployment
- [ ] Validate multi-tenancy and cost tracking in production-like environment

### Person B
- [ ] Final Creator Agent testing with diverse role descriptions
- [ ] Validate all role templates work end-to-end (including `ekg/` setup and industry ontology merge)
- [ ] Validate employee lifecycle (create → work → version → clone → retire)
- [ ] Validate full EKG pipeline: Data Scavenger → Q&A Completion → Experience Links → Manager aggregation
- [ ] Prepare beta feedback collection mechanism

### Person C
- [ ] Final dashboard polish and performance optimization
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Prepare demo dashboard with GradSale sample data
- [ ] Validate all 11 enterprise dashboard features from README §17 (hybrid approach — excludes Control UI features)
- [ ] Verify hybrid UI cross-links work in all deployment topologies

### Person D
- [ ] Final security audit against README §15 security model
- [ ] Validate all approval and RBAC policies
- [ ] Validate MCP servers from all 3 tiers
- [ ] Prepare security whitepaper for enterprise customers

---

## Integration Checkpoints

| Checkpoint | Week | What Gets Tested | Capabilities Validated |
|------------|------|-----------------|----------------------|
| **IC-1** | End of Week 1 | OpenClaw gateway runs, channels connected, LLM responds | Foundation |
| **IC-2** | End of Week 2 | Creator Agent produces a working AI employee with `ekg/` directory; visible in dashboard; GradSale MCP server works; EKG pillar schema defined; 2 industry ontologies built | #1, #2, #5, #6, #11 (schema) |
| **IC-3** | End of Week 3 | Self-provisioning works with approval + error handling; Tuning Agent modifies employees; Data Scavenger Agent built; Q&A Completion and Experience Link skills designed; test harness design complete; 1:1 Chat Panel functional; bootstrap hook loads `ekg/` | #3, #4, #11, #12, #13 (design), #15 (design), #16 (1:1 chat) |
| **IC-4** | End of Week 4 | Multi-tenancy isolation works; orchestration works with Manager EKG; Data Scavenger ingests documents into `ekg/` JSON5; Experience Links generated; Manager capability abstraction works; cost tracking live; pre-deployment test runner working; group chat functional | #7, #8, #10, #11, #12, #13, #15, #16 (group chat), #17 (capability abstraction) |
| **IC-5** | End of Week 5 | SSO login works; RBAC enforced; employee lifecycle functional; Manager conflict detection and reverse injection working; 3rd industry ontology built; role template test suites bundled | #9, #13, #14, #15, #17 (conflict + training) |
| **IC-6** | End of Week 6 | All 17 capabilities tested E2E; GradSale scenario fully working (including full EKG pipeline, Manager aggregation, and pre-deployment test pipeline) | All 17 |
| **IC-7** | End of Week 7 | Documentation complete; edge cases handled | All 17 |
| **IC-8** | End of Week 8 | Beta release tagged; demo-ready with GradSale enterprise (5 demo scenarios) | All 17 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| OpenClaw API breaking changes | Pin OpenClaw version; use stable Plugin SDK only |
| Self-provisioning unreliable (websites change) | Graceful degradation + manual provisioning fallback + error recovery skill |
| Creator Agent generates poor configs | Human review step before deployment; reflection loop; incubation memory |
| Browser automation blocked by CAPTCHAs | Approval-based manual fallback; enterprise SSO for known services |
| LLM provider outages | Model fallback chains configured in OpenClaw |
| Channel integration complexity | Start with Slack + WebChat; add others incrementally |
| Dashboard performance with many employees | Pagination, virtual scrolling, lazy loading |
| Multi-tenancy adds complexity to every layer | Design tenant model in Week 1 contracts; test isolation early in Week 4 |
| Enterprise MCP generation quality | Test against ekg/ GradSale docs first; iterate on generation quality |
| Cost tracking accuracy | Cross-validate with LLM provider billing; add reconciliation checks |
| OpenClaw single-tenant architecture limits | Namespace-level isolation first; full gateway-per-tenant if needed later |
| Pre-deployment testing insufficient historical data | Fall back to mock task generation from schema + API docs; bundle role template test suites as baseline |
| Auto-tune loop doesn't converge | Cap iterations; escalate to human review; store failure diagnostics for Creator Agent learning |
| LLM prompt leakage in cloud deployments | Self-hosted LLMs for regulated customers; enterprise data agreements for cloud LLM providers. See docs/HOSTING.md security analysis |
| Credential store compromise on host | Disk encryption at rest; minimize per-employee MCP scope; secret rotation. See docs/HOSTING.md platform-wide risks |
| Agent shell/browser exfiltration | Sandbox mode mandatory; tool denylists; AGENTS.md `§ Hard Rules` guardrails; network egress filtering on host. See docs/HOSTING.md |
| Data Scavenger misclassifies knowledge into wrong EKG pillar | LLM-driven classification with confidence thresholds; low-confidence items flagged for human review; additive-only merges (never destructive) |
| Experience Links generate false patterns from insufficient data | Minimum occurrence threshold (default: 3) before promotion; confidence scoring with decay; human review for high-impact experience links |
| Manager conflict detection produces false positives | All conflicts require human resolution via approval system; never auto-resolve; confidence scoring on detected conflicts |
| Industry ontology templates don't match client's actual domain | Templates are starting points, not constraints; Data Scavenger overwrites/extends with client-specific data; Q&A Completion fills gaps |
| EKG JSON5 files grow too large for workspace scanning | File size monitoring; split large pillar files into sub-files (e.g., `org/dept-sales.json5`); archival policy for old experience links |
| **User token leakage across sessions** | `userToken` never stored in conversation history or workspace files; propagated only in session context and WebSocket metadata; audit log attribution uses hashed tokens for external exports |
| **Memory partition bypass (user sees other user's memories)** | `userToken` filter applied at the Sentura memory extension wrapper level; unit tests verify isolation; `memory_search` always adds `userToken` filter before LanceDB query; global memories (null `userToken`) reviewed by dreaming system to prevent PII leakage |
| **LanceDB shared-store data leak between agents** | Per-agent `dbPath` configured at agent creation; `sentura-setup.sh` validates all agents have unique `dbPath`; startup health check verifies no agents share a LanceDB directory |
| **MCP Builder generates insecure code** | Generated MCP server code reviewed by `ekg_manager` before deployment; auth credentials always reference `$secret` store, never hardcoded; generated code scanned by security scanner extension; sandboxed test run before wiring to production agents |

---

## Capability-to-README Traceability

Every Sentura capability references specific README.md sections for requirements:

| Capability | README Section | Key Requirements |
|-----------|---------------|-----------------|
| Enterprise data integration | §6, §14 | 3-tier MCP strategy, knowledge ingestion from all sources table |
| Internal MCP server generation | §14 | API docs → MCP server code → config.patch pipeline |
| Self-provisioning orchestration | §5 | 9-step pipeline, approval integration, error recovery, audit logging |
| Position-specific safety guardrails | §9 | 5-layer safety architecture, AGENTS.md `§ Hard Rules` (Sentura convention inside OpenClaw's native AGENTS.md), decision-context approvals |
| No-code employee creation | §4 | 4-phase incubation (Research → Design → Provision → Deploy), reflection loop |
| Incubation pipeline (+ EKG setup) | §3, §4, §6 | 8 native workspace files (AGENTS.md with Hard Rules, BOOTSTRAP.md with Enterprise Context) + `ekg/` directory + industry ontology merge, structured skills/ directory |
| Enterprise orchestration + Manager EKG | §12 | AI Manager with capability abstraction, conflict detection, reverse injection; sessions_spawn + progress tracking |
| Multi-tenancy | §1, §15 | Tenant isolation, per-department namespacing, data segregation |
| Enterprise authentication | §15, §17, docs/HOSTING.md | SAML/OIDC SSO for dashboard, gateway auth modes (token, trusted-proxy, Tailscale) per hosting target |
| Cost management | §11, §17 | Per-employee + per-department cost tracking, Cost Center dashboard page |
| Enterprise Knowledge Graph (EKG) | §6 | 4-pillar ontology (Org, Rules, Assets, Workflows), per-agent `ekg/` directory, JSON5 format with entities/relations/provenance |
| Data Scavenger Agent | §6 | 5-step pipeline (extract → classify → structure → merge → notify), 4-pillar classification, provenance tracking |
| Progressive knowledge accumulation | §6, §10 | Industry ontology templates (Tier 1), Q&A-based Completion (Tier 2), Experience Links with confidence scoring (Tier 3), dreaming extensions |
| Employee lifecycle management | §1 | Versioning, cloning, health scoring, rollback, retirement |
| Pre-deployment testing & validation | §1, §4 | 5-phase incubation (Phase 4: Testing), 3 test case sources, 6 test dimensions, auto-tune loop, pass/fail thresholds |
| Communication panel | §17 | 1:1 chat, group chat, message streaming, conversation persistence |
| Cross-agent knowledge aggregation | §12 | Manager capability abstraction, cross-domain conflict detection, Global SOPs, reverse-injection training |
| Production hosting & security | docs/HOSTING.md | Co-hosted topology, reverse proxy config, security risk analysis per hosting type (VPS/VM/on-prem), LLM data transit risks |
