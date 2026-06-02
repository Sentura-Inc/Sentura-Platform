# Sentura Platform — 8-Week Team Sprint Plan

> **Aligned with**: README.md (17 Sentura capabilities), docs/OPENCLAW.md, ekg/ test enterprise
>
> **Last synced**: 2026-06-02 (OpenClaw `2026.6.2` upgrade pass — sprint plan itself is unaffected; all completed tasks remain valid. Node minimum is now 22.19+, pnpm baseline is 11.2.2+, and Sentura SDK imports were re-checked against the current OpenClaw subpath exports. See `docs/OPENCLAW.md` for the full version delta.)

> ## ⚠️ DO NOT REINTRODUCE `RULES.md` OR `CONTEXT.md` ⚠️
>
> Sentura agent workspaces use **exactly the 8 OpenClaw-native files** — no `RULES.md`, no `CONTEXT.md`, ever. Hard safety boundaries live inside each agent's `AGENTS.md` under `## Hard Rules (must not override)`, and enterprise context lives inside `BOOTSTRAP.md` under `## Enterprise Context`. The only runtime hook extension is per-user memory (`memory/users/MEMORY_USER_{token}.md`).
>
> If you see `RULES.md` or `CONTEXT.md` mentioned anywhere in `docs/MEMORY.md` or in any file under `docs/memory/`, treat those entries as **historical audit log only**. The memory subsystem (matrix in `docs/MEMORY.md` + per-owner/per-week detail files under `docs/memory/person-*/week-*.md` + cross-cutting files under `docs/memory/shared/`) is append-only: earlier entries describe a design that was fully removed from code, templates, tests, runtime workspaces, and documentation. They are kept for provenance, not as specification. Do NOT use them as a guide for current or future tasks.
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

## Week 1 — Foundation & OpenClaw Setup — **COMPLETE (A/B/C/D)**

> **Goal**: OpenClaw runtime up. Working local envs for everyone. Shared conventions.
> **Capabilities covered**: #4 (guardrails design), #5 (Creator start), #6 (workspace convention)
> **Status**: Fully complete for all four people (audited 2026-04-20).

| Person | Deliverable | Artifact(s) |
|---|---|---|
| A | Build OpenClaw from source + onboard + verify LLM/channels | `openclaw/` built; `~/.openclaw/.env`; `~/.openclaw/openclaw.json` |
| A | Monorepo structure for Sentura control plane | `sentura/agents/`, `sentura/extensions/`, `sentura/skills/`, `sentura/config/`, `sentura/hooks/` |
| A | Document Gateway RPC surface for team | `docs/OPENCLAW.md` (reference) + interface contracts table in this file |
| A | Local dev setup guide (cross-platform) | `docs/SETUP.md`; rule: dev = `pnpm gateway:watch`, prod = OpenClaw's Docker only |
| B | Creator (Forge) agent workspace — full 8-file set + skills | `sentura/agents/creator/{AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md, skills/, config.json5}` |
| B | 8-file workspace convention documented (+ Sentura additions: `skills/`, `ekg/`, `memory/users/`) | `AGENTS.md § Hard Rules`, `BOOTSTRAP.md § Enterprise Context`; **never** `RULES.md`/`CONTEXT.md` |
| B | Role templates (AP Clerk, CS Agent, SDR) | `sentura/config/templates/` |
| B | Self-provisioning + knowledge-curation skills | `sentura/skills/self-provisioning/SKILL.md`, `sentura/skills/knowledge-curation/SKILL.md` |
| B | Manual employee creation dry-run (config + workspace by hand) | Validated 8-file convention works end-to-end |
| C | Next.js 15 dashboard scaffold + Tailwind + shadcn/ui | `sentura/dashboard/` |
| C | Typed WebSocket Gateway RPC client | `sentura/dashboard/lib/openclaw-client.ts` |
| C | App shell + Employee Roster page (`config.get` → `agents.list`) | `sentura/dashboard/app/employees/` |
| C | Hybrid architecture pivot: session views deferred to Control UI; dashboard links out; home/employees repurposed for enterprise focus | Removes duplicated panes |
| D | Study plugin SDK; scaffold + ship `sentura-audit` extension | `sentura/extensions/sentura-audit/` logs tool calls, approvals, config changes |
| D | Study `exec.approval.*` / `plugin.approval.*` systems | Feeds Week 2 approval flows |
| D | **7-role RBAC model** (replaces old 5-role) | Roles: `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`. Scope: SME-wide or per-department. Design at `sentura/extensions/sentura-rbac/DESIGN.md` |
| D | Initial approval policy configs | Which tools need approval + escalation rules |
| D | Study `ekg/` GradSale API docs for Week 2 MCP generation | `ekg/api-admin.md`, `ekg/api-web.md`, `ekg/database.md` |

---

## Week 2 — AI Employee Creation & Enterprise Integration Foundation — **COMPLETE**

> **Goal**: A human can create an AI employee via Forge (Creator); first enterprise MCP server built from `ekg/`.
> **Capabilities covered**: #1 (data integration start), #2 (MCP generation start), #5, #6, #11 (EKG schema)
> **Status**: Persons A, B, C complete (Week 2 audit 2026-04-20). Person D complete 2026-04-19: 7-role `sentura-rbac` with `withRbac` middleware + bootstrap escape hatch, and the reference `sentura/mcp-servers/gradsale-admin` MCP server covering the full GradSale admin surface (29 tools, 18 tests green). The GradSale **web** surface is the only pending sub-task, intentionally deferred to Week 3 alongside self-provisioning.
> **Headline result (2026-04-19)**: Forge live E2E passed — brief "Create Penny (AP clerk, >£5000 escalate)" → new agent `penny-ap` deployed in ~110s with the £5000 rule embedded in `AGENTS.md § Hard Rules` (see `scripts/test-creator-e2e-live.ts`, MEMORY.md).
> **Headline result (2026-04-19, Round 20)**: Dashboard `chat.send` deploy path unblocked. The CLI `agent.run` path already worked (Round 19 E2E PASS), but the dashboard was dropping plugin tools at the `sandbox tools.allow` pipeline step (21→7 tools, `sentura_agents_manage` stripped). Root cause: OpenClaw's sandbox has a **separate** tool-allowlist layer (`DEFAULT_TOOL_ALLOW` / `DEFAULT_TOOL_DENY` in `openclaw/src/agents/sandbox/constants.ts`) that runs after agent-level `tools.alsoAllow` — and agent `alsoAllow` does NOT bleed into it. Fix: declared `tools.sandbox.tools.alsoAllow` in the Creator's `config.json5` mirroring the 16 plugin tools Forge needs. Verified via `scripts/probe-creator-tools.ts` (gateway `tools.effective`: 21 tools, `sentura_agents_manage` present) and `scripts/probe-chat-send.ts` (runner debug: `sandbox tools.allow 21->21 (no change)`, `effectiveTools=21`). Invariant locked: every meta-agent (Forge, Tuner, Orchestrator, MCP Builder) MUST set `tools.sandbox.tools.alsoAllow`. See `docs/memory/shared/creator-deployment-rounds-1-14.md` → Round 20 and `docs/tests/tests-person-d.md` → D-SAND-01.

### Person A — Platform & OpenClaw — COMPLETE

| Deliverable | Artifact(s) |
|---|---|
| Automated workspace creation (8 natives + `skills/` + `ekg/` 4-pillar tree + `memory/users/`) | `scripts/sentura-setup.sh`, `scripts/sentura-setup.ps1` |
| Agent registration helper via `config.patch` | Tested hot-reload: adding an agent makes it immediately available |
| MCP loopback server for tool protocol interop | Configured in live `~/.openclaw/openclaw.json` |
| Channel binding helper (programmatic agent→channel/peer) | Used by Creator deployment skill |
| **Per-agent LanceDB isolation** | `memory-lancedb.dbPath = ~/.openclaw/memory/{agentId}/lancedb` in per-agent plugin config; applied to meta-agents by setup script |
| **User token infrastructure** | UUID `userToken` attached at user creation + WebSocket bind; session key `agent:<id>:user:<token>:<sid>`; all traces tagged |
| **Sandbox seeding defect fix** | New hook `sentura/hooks/sentura-sandbox-seed/` runs on `agent:bootstrap`: full mirror of `skills/`, union-copy of `memory/` + `ekg/`, copies missing `config.json5`/`MEMORY.md`, overwrites stub `BOOTSTRAP.md`; symlink/hardlink escape hardening. Removed stale `skills:` path-glob filter from creator/tuner/orchestrator configs. Setup script auto-installs + scrubs stale globs. Repair tool: `scripts/repair-sandbox-seeding.ts`. Validated via `scripts/test-week2.ts` Part 11 (9 cases). |
| **Deployment-pipeline extension** (fixes `fs_write` → read-only sandbox path error) | New `sentura/extensions/sentura-agents/` exposes `sentura.agents.{writeSubfile,readSubfile,deleteSubfile,listSubfiles}` gateway RPCs + `sentura_agents_manage` agent tool. `safeJoin` blocks `..`/absolute/symlink; `NATIVE_WORKSPACE_FILES` forces native files through `agents.files.set`; 5 MiB default per-file cap. |
| Setup-script extension wiring (Step 7a) | Scans `sentura/extensions/` for `sentura-agents`, `sentura-rbac`, `sentura-audit`, `sentura-approval`, `sentura-provisioner`; patches `~/.openclaw/openclaw.json` `plugins.load.paths` + `plugins.entries`. Validated via `scripts/test-week2.ts` Part 12 (22 cases). |

### Person B — AI Employee & Skills — COMPLETE

| Deliverable | Artifact(s) |
|---|---|
| Creator Phase 1: Research & Discovery skill | `sentura/agents/creator/skills/research-and-discovery/SKILL.md` |
| Creator Phase 2: Design skill (agent config + 8 natives + skills + `ekg/` 4-pillar + `memory-lancedb.dbPath`) | `sentura/agents/creator/skills/employee-design/SKILL.md` — generates `AGENTS.md § Hard Rules`, `BOOTSTRAP.md § Enterprise Context`, wires MCP refs, merges industry ontology |
| Creator Phase 4: Deploy skill (RPC-first, **not** `fs_write`) | `sentura/agents/creator/skills/employee-deployment/SKILL.md`: uses `agents.create` → `agents.files.set` → `sentura.agents.writeSubfile` → `config.patch`. `fs_write`/`fs_read` reserved for sandbox-local scratch only. Tool allowlist grants `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`. |
| Offline helper tests | `scripts/test-creator-helpers.ts` (49/49 pass) |
| **Live E2E test** | `scripts/test-creator-e2e-live.ts` — **PASSED 2026-04-19** with `openai/gpt-5.4`: NL brief → Forge Phase 1–4 → `penny-ap` in config (~110s) → 8-file workspace with £5000 Hard Rule |
| 5 common skill templates | `sentura/config/templates/_common/skills/` (meeting-notes, document-summarization, escalation-handling, status-update, knowledge-base-lookup) |
| **EKG 4-pillar JSON5 schema** (cap #11) | `sentura/config/ekg-schema.json5` — entity/relation/attribute format per pillar (org/rules/assets/workflows), provenance (`source`, `ingested`, `confidence`), Experience Link format (`pattern`, `observation`, `confidence`, `occurrences`) |
| **2 industry ontologies** (cap #13 Tier 1) | `sentura/config/industry-ontologies/financial-services/` (SOX, AML/KYC, PCI, approval chains) + `e-commerce/` (consumer protection, fraud, RMA/refund/chargeback) |
| **MCP Builder meta-agent workspace** | `sentura/agents/mcp-builder/` — 8 natives + 4 skills (api-analysis, mcp-generation, smoke-test, register-server). Round 14 repair: `openai/gpt-4o` → `openai/gpt-5.4`; removed broken path-glob `skills:` filter; applied Creator-parity `tools.deny = [sessions_spawn, subagents, sessions_yield]`. Tests: `docs/tests/tests-person-b.md` B9.6 + B9.7. **Workspace scaffolded; not yet deployed.** |

#### Creator Deployment Bug-Fix Rounds 1–14 (2026-04-17 → 2026-04-20) — consolidated

Fourteen rounds fixed every blocker between "Forge designs fine" and "live E2E passes". Root cause + fix per round:

| # | Root cause | Fix |
|---|---|---|
| 1 | Creator sandbox empty — skills/`BOOTSTRAP.md`/`memory/`/`config.json5` never copied | `sentura-setup.sh` re-seeds `~/.openclaw/workspace/creator/` from `sentura/agents/creator/` every run |
| 2 | Sandbox seeding copied natives only | New `sentura-sandbox-seed` hook mirrors `skills/` + union-copies `memory/`, `ekg/`, `config.json5`, `MEMORY.md`, stub `BOOTSTRAP.md` |
| 3 | `employee-deployment` skill used `fs_write` on a read-only sandbox path | New `sentura-agents` extension + `sentura_agents_manage` tool; skill rewritten around gateway RPCs |
| 4 | Creator's `AGENTS.md § Hard Rules` + `TOOLS.md` + `BOOTSTRAP.md` still ordered `fs_write` (override beats skill) | Hard Rules rewritten to forbid `fs_write`/`apply_patch` on `/workspace/.openclaw/workspace/...`; `TOOLS.md` promotes `sentura_agents_manage`; `BOOTSTRAP.md` boot-check updated |
| 5 | `coding` profile still surfaced `write`/`edit`/`apply_patch` — prompt alone couldn't stop the LLM | `config.json5 tools.deny = ["write","edit","apply_patch"]`; `sentura-setup.sh` re-applies every run |
| 6 | `gateway`/`cron`/`nodes` are owner-only; unset `commands.ownerAllowFrom` made webchat non-owner; Forge's `alsoAllow: ["gateway"]` stripped silently | `commands.ownerAllowFrom = ["*"]` live + in setup script |
| 7 | `tools.exec.host` defaulted to `"auto"` which rejects `host:"gateway"` when sandbox available → Forge self-probe failed → LLM collapsed it into "gateway tool is missing" | `tools.exec.host = "gateway"` live + setup script (guarded to preserve operator overrides) |
| 8 | Sandbox bind seeded once via `fs.writeFile(..., {flag:"wx"})`; host edits never reached running agent (workspace 18706B / sandbox 18053B mismatch observed) | `sandbox = { mode: "non-main", workspaceAccess: "rw" }` — host `~/.openclaw/workspace/creator/` bind-mounted live at `/workspace`; safe because `tools.deny` strips built-in fs mutators |
| 9 | Residual non-owner path leaked through one session flow | Owner scope hardening + sandbox cleanup |
| 10 | `openai/gpt-5.3-codex` hallucinated `sessions_spawn({task:"noop", runTimeoutSeconds:1})` → 1000ms embedded-run timeout, empty-workspace subagent returned `"noop"` | Added `sessions_spawn`, `subagents`, `sessions_yield` to `tools.deny` (only block-path since `coding` profile ships them); `AGENTS.md` "Tool Availability" scrubbed; 9 test cases in `docs/tests/tests-person-b.md § B6.7` |
| 11 | Same stale-sandbox root cause as #8, confirmed via mtime audit | `workspaceAccess: "rw"` shipped with doc block explaining seed-once semantics; `"ro"` rejected (adds second mount at `SANDBOX_AGENT_WORKSPACE_MOUNT`, not `/workspace`) |
| 12 | Similar stale-bundle residue on deeper paths | Setup-script cleanup of stale `agent-creator-*` sandbox dirs |
| 13 | Final live E2E blocker: model pinning | Pinned `openai/gpt-5.4`; Penny E2E passed in ~110s on 2026-04-19 |
| 14 | MCP Builder `config.json5` had invalid `openai/gpt-4o` + path-glob `skills:` filter (OpenClaw expects skill **names**); Round-10 noop loop risk on first deploy | Model → `openai/gpt-5.4`; removed `skills:` filter (auto-discovery works); mirrored Creator's `tools.deny`. Week 2 audit PASS for A/B/C |

**Invariants emerging from these rounds (must be preserved):**

1. The Creator (and any agent that deploys other agents) uses only the gateway RPC chain: `sentura_agents_manage { create_agent → write }` → `gateway.config.patch`. Never `fs_write`/`edit`/`apply_patch`/`write` on another agent's workspace.
2. Meta-agent `tools.deny` always includes `["write","edit","apply_patch","exec","sessions_spawn","subagents","sessions_yield"]`.
3. Meta-agent `sandbox = { mode: "non-main", workspaceAccess: "rw" }` so host workspace edits hit the running agent.
4. Gateway config always sets `commands.ownerAllowFrom = ["*"]` (or explicit operator list) **and** `tools.exec.host = "gateway"`.
5. `agents.list[].skills` in `config.json5` is a **skill-name** filter, not a path glob. Omit it to auto-discover `skills/*/SKILL.md`.
6. Sandbox seeding is done by the `sentura-sandbox-seed` hook — never rely on OpenClaw's built-in `ensureSandboxWorkspace` to copy `skills/`/`memory/`/`ekg/`/`config.json5`.

### Person C — Frontend & Dashboard — COMPLETE

| Deliverable | Artifact(s) |
|---|---|
| Employee Creator chat UI (`/create`) — streaming via `sessions.create` + `chat.send` + `chat` events (`state: "delta"`/`"final"`) | `sentura/dashboard/app/create/` |
| Employee Detail page (`/employees/[id]`) — 8 natives view, channel bindings, lifecycle actions | `agents.files.get` allow-list aware; non-allowlisted files link to Control UI's config editor; Lifecycle: Refresh / Tune (W3) / Edit in Control UI / Retire via `agents.delete` |
| Approval Queue page (`/approvals`) | Seeds from `exec.approval.list` + `plugin.approval.list`; subscribes to `*.approval.requested`/`*.approval.resolved`; Approve-once / Always-allow / Deny w/ reason; requires `operator.approvals` scope |
| Session/Conversation viewer | **Removed** — deferred to OpenClaw Control UI (hybrid) |

### Person D — Extensions & Integrations — COMPLETE

| Deliverable | Artifact(s) |
|---|---|
| `sentura-rbac` extension with 7-role model + scope (SME-wide / per-dept) + `userToken` in user store | `sentura/extensions/sentura-rbac/src/{roles,authorizer}.ts` + tests — `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer` |
| RBAC middleware — per-RPC permission check | `withRbac(authorizer, store, opts, handler)` in `sentura/extensions/sentura-rbac/src/middleware.ts`; includes a bootstrap escape hatch so the first `platform_admin` can be seeded onto an empty store; 10 unit tests in `middleware.test.ts` (part of the 44-test `sentura-rbac` suite) |
| First enterprise MCP server from `ekg/` GradSale docs (Tier 2: Sentura-generated) — wrap admin API endpoints via `@modelcontextprotocol/sdk` | `sentura/mcp-servers/gradsale-admin/` — 29 tools covering the full `ekg/api-admin.md` surface (disputes, verification review, ratings, reports, support, waitlist, email verification, transactions); `readOnly` mode strips all mutating tools for auditor personas; web surface deferred to Week 3 |
| MCP integration test — AI employee uses GradSale tools in conversation | `sentura/mcp-servers/gradsale-admin/src/server.test.ts` — MCP `Client` + `InMemoryTransport` + stubbed `fetch`; walks a Dispute Resolver through list → get → approve; 18/18 tests green |
| Document the API-docs → MCP-server → `config.patch` pattern | `docs/DESIGN.md` § "Enterprise MCP Server Pattern" (under Section 14) + `sentura/mcp-servers/gradsale-admin/README.md` |

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
- [x] **Round 17 — bypass the scope-upgrade pairing deadlock with in-process agent registration** (real root cause of `GatewayClientRequestError: pairing required` observed on the dashboard during a live `billing-support-rep` deploy attempt, 2026-04-19). Problem: `gateway.call("config.patch", …)` and `gateway.call("agents.create", …)` both require `operator.admin` scope, and OpenClaw's ws-connection message-handler hard-codes `silent=false` for scope upgrades (`openclaw/src/gateway/server/ws-connection/message-handler.ts` → `requirePairing({ silent: false, reason: "scope-upgrade", requiredScopes })`). That means every scope upgrade surfaces a non-silent pairing request regardless of whether the `device-pair` plugin is enabled, whether the client is local, or whether an admin token is supplied. Forge, running inside the embedded agent runtime, has no way to click "approve" on its own pairing prompt, so the deploy call hangs forever and the user sees *"the Sentura deployment RPCs needed to create/register the employee are not callable here."* Fix:
  - New `sentura/extensions/sentura-agents/src/register-agent.ts` exporting `registerAgentInRuntimeConfig(api, params)` and `stampAgentWorkspaceSetupCompleted(workspaceDir)` that mutate `openclaw.json` in-process via `api.runtime.config.{loadConfig, writeConfigFile}` — the same trusted-native surface `active-memory`, `memory-core`, `talk-voice`, and `phone-control` already use. No gateway auth, no pairing, same hot-reload behaviour as `config.patch`.
  - Extended `sentura_agents_manage` tool (`sentura/extensions/sentura-agents/index.ts`) with two new actions: `register_agent` (appends the agent to `agents.list`, optionally appends channel `bindings[]` and merges `mcp.servers`, all in one atomic config write; deep-merges nested `identity`/`tools`/`sandbox`/`runtime`/`params` on overwrite) and `stamp_setup` (idempotent `setupCompletedAt` stamp). Matching gateway RPCs `sentura.agents.registerAgent` + `sentura.agents.stampSetupCompleted` are also registered for non-agent callers.
  - `create_agent` now auto-stamps `setupCompletedAt` into `<workspaceDir>/.openclaw/workspace-state.json` so a fresh employee is not bootstrap-pending on first boot (Sentura's permanent-`BOOTSTRAP.md` convention would otherwise leave it pending forever).
  - Synced Creator's source AND deployed skill files to replace every `gateway.call("config.patch", …)` reference with `sentura_agents_manage { action: "register_agent", ... }` + a one-paragraph explanation of the pairing deadlock:
    - `sentura/agents/creator/skills/employee-deployment/SKILL.md` (HARD RULES, Step 5 rewritten, matrix, DO NOT STALL, Rollback, Tools Needed, Safety)
    - `sentura/agents/creator/skills/incubation/SKILL.md` (Step 5 + Tools Needed)
    - `sentura/agents/creator/skills/workspace-generation/SKILL.md` (Agent Config Generation + Tools Needed)
    - `sentura/agents/creator/TOOLS.md` (gateway downgraded to read-only for Forge; `sentura_agents_manage` promoted to "Primary deployment tool" for writes AND registration)
    - `sentura/agents/creator/SOUL.md` (Deploy & Go Live phase updated to reference `sentura_agents_manage` actions)
  - Synced all five files into `~/.openclaw/workspace/creator/` via explicit `Read` → `Write` (shell `cp` silently no-op in the live chat environment).
  - Verified via 6 new test cases in `docs/TESTS.md § D10`. Expected E2E behavior: Forge completes a `create_agent` → N × `write` → `register_agent` flow end-to-end without any gateway pairing, the new employee appears in `agents.list` on the next hot-reload tick, and the user's locked `billing-support-rep` spec (Ava, $50 refund threshold, Zendesk + Stripe MCP, webchat + Zendesk bindings, escalation to Sitong Wu + Henry Zhang) is deployable from the webchat runtime without operator intervention.
- [x] **Round 18 — shrink Creator `AGENTS.md` under OpenClaw's 12k workspace-bootstrap-file injection limit** (observed 2026-04-19 during follow-up deploy attempt; Round 17's `register_agent` action was loaded + callable but Forge kept replying *"this current session only has read/session tools, so I can't actually create/register the employee from this webchat session"*). Root cause: OpenClaw's embedded agent runtime truncates workspace bootstrap files when injecting them into the agent's system prompt, with a hard 12,000-char limit (log line `agent/embedded: workspace bootstrap file AGENTS.md is 18597 chars (limit 12000); truncating in injected context` was emitted at 19:14:36 every time a Creator session spun up). After Rounds 1–17's incremental edits, Creator's `AGENTS.md` had grown to **18,597 chars** — the entire `Phase 5: Deploy & Go Live` section, the `sentura_agents_manage` tool-availability block, and the output-format template were all silently dropped from Forge's prompt. From Forge's perspective, the deploy tool didn't exist. Fix:
  - Rewrote `sentura/agents/creator/AGENTS.md` to ~10,800 chars (204 lines) by: (a) collapsing the redundant "Deployment Mandate" preamble and `Phase 5` section into a single mandate header at the top (survives any future truncation), (b) tightening Hard Rules prose without dropping any NEVER/ALWAYS bullet, (c) removing duplicated schema guidance that lives in the `agent-config-schema` skill.
  - Synced to `~/.openclaw/workspace/creator/AGENTS.md` via explicit `Read` → `Write`.
  - Audited the 8 native files for all four meta-agents (`creator`, `tuner`, `orchestrator`, `mcp-builder`) + `mcp-builder`; every file well under 12k after the fix (`AGENTS.md` sizes: creator 204, mcp-builder 94, tuner 31, orchestrator 30 lines).
  - Locked the invariant with a new test case `docs/TESTS.md § D12` (5 checks: byte-cap on source + deployed copies, zero `truncating in injected context` log warnings, deploy-critical instructions in the first 8k chars, policy-preservation diff against the pre-shrink file).
  - Expected E2E behavior: the next Creator session started from the dashboard reads the full `AGENTS.md` in its system prompt, sees the `sentura_agents_manage { register_agent }` tool-call sequence as the first mandate, and completes the `billing-support-rep` deploy (Ava, $50 refund threshold, Zendesk + Stripe, webchat, Sitong Wu + Henry Zhang escalations) end-to-end without asking for another session.
- [x] **Round 20 — dashboard `chat.send` sandbox tool-policy filter root cause + fix** (real reason dashboard deploys failed after Round 19 with "I can't call `sentura_agents_manage` in this session" even from a fresh webchat — turned out NOT to be context poisoning this time). Problem: the CLI `agent.run` path exposed 21 tools including `sentura_agents_manage`, but the dashboard `chat.send` path ran through the auto-reply runner and delivered only 7 tools to the LLM (`[read, process, sessions_list, sessions_history, sessions_send, session_status, image]`). Ran a new `scripts/probe-chat-send.ts` that drives the exact dashboard RPC flow and captured runner-side debug logs from `/tmp/openclaw/openclaw-YYYY-MM-DD.log`; pipeline log showed `sandbox tools.allow 21->7` — the **sandbox tool-policy filter** was stripping plugin tools. Root cause: `openclaw/src/agents/sandbox/constants.ts` exports `DEFAULT_TOOL_ALLOW` (narrow — `exec`, `process`, `read`, `write`, `edit`, `apply_patch`, `image`, `sessions_*`) and `DEFAULT_TOOL_DENY` (blocks `gateway`, `browser`, `canvas`, `cron`, `nodes`, every channel id). `applyToolPolicyPipeline` applies `sandbox tools.allow` **after** agent-level `tools.alsoAllow`, and agent `alsoAllow` does NOT bleed into the sandbox layer — a separate `tools.sandbox.tools.alsoAllow` block is required. Fix:
  - `sentura/agents/creator/config.json5` → added `tools.sandbox.tools.alsoAllow` with 16 plugin tools (`gateway`, `sessions_send`, `web_search`, `web_fetch`, `browser`, `pdf`, `canvas`, `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`, `memory_search`, `memory_get`, `cron`, `update_plan`, `image_generate`, `video_generate`) with a block comment explaining the separate sandbox allowlist layer.
  - Mirrored the same block into `~/.openclaw/openclaw.json` for the live `creator` agent. Channel-like entries (`gateway`, `browser`, `canvas`, `pdf`, `cron`) are auto-removed from `DEFAULT_TOOL_DENY` by `filterDefaultDenyForExplicitAllows` — no deny-list edit needed.
  - Verified via two probes post-fix: `scripts/probe-creator-tools.ts` → 21 effective tools (gateway view, `tools.effective`); `scripts/probe-chat-send.ts` → runner log `sandbox tools.allow 21->21 (no change)` + `attempt.effectiveTools effective=21` including `sentura_agents_manage`. Removed temporary `[sentura-debug]` logs from `attempt.ts`, `pi-tools.ts`, `tool-policy-pipeline.ts` after fix.
  - Locked the invariant in `docs/MEMORY.md` Current Ground Truth: meta-agents (Forge, Tuner, Orchestrator, MCP Builder) MUST declare `tools.sandbox.tools.alsoAllow` in their `config.json5`. Added new test case `docs/TESTS.md § D14` / `docs/tests/tests-person-d.md` D-SAND-01: verify `sandbox.tools.alsoAllow` present in each meta-agent's config, verify `probe-creator-tools.ts` and `probe-chat-send.ts` both report `sentura_agents_manage` reachable.
- [x] **Round 20 follow-up — roll the sandbox-allowlist fix out to the other three meta-agents and the setup scripts so fresh installs don't repeat the outage** (2026-04-19, same day as Round 20). Problem: the initial Round 20 patch only covered Creator; Tuner, Orchestrator, and MCP Builder would still ship broken on a clean install, and re-running `bash scripts/sentura-setup.sh` would clobber the hand-edited live config without re-injecting the sandbox allowlist. Fix:
  - Added `tools.sandbox.tools.alsoAllow` to `sentura/agents/{tuner,orchestrator,mcp-builder}/config.json5` with per-agent tool lists (Tuner 13, Orchestrator 9, MCP Builder 11) matching each agent's agent-level `alsoAllow`, each with a block comment pointing at `docs/SETUP.md` § "Sandbox tool-policy filter".
  - Rewrote the embedded Node overrides block in `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` to declare `creatorSandboxAlsoAllow` / `tunerSandboxAlsoAllow` / `orchestratorSandboxAlsoAllow` / `mcpBuilderSandboxAlsoAllow` arrays and inject `sandbox.tools.alsoAllow` for every meta-agent on every run. `META_AGENTS` (`$MetaAgents` in PowerShell) now includes `mcp-builder`. Verified idempotent (re-run produces no diff on the relevant keys).
  - Documented the two-stage sandbox tool-policy filter in `docs/SETUP.md` § "Sandbox tool-policy filter" (operational: per-agent tool counts, verification command, guidance for new meta-agents), `docs/OPENCLAW.md` § "Sandbox tool-policy filter (dashboard vs CLI divergence)" (runtime contract: stage 1 vs stage 2, CLI vs dashboard tool-count table, design checklist), and `docs/DESIGN.md` § "Sandbox runtime — two-stage tool-policy filter" (architectural rationale for capability designers, plus an embedded example in the AP Clerk config). `README.md` gained a pointer under "Key Documentation" cross-linking to both SETUP and OPENCLAW.
  - Expanded D14 from 4 → 6 checks in `docs/TESTS.md` / `docs/tests/tests-person-d.md` to cover all four meta-agents + setup-script parity + the docs-sync assertion.
- [x] **Round 19 — E2E deploy PASS: Forge autonomously deployed `billing-support-rep` via the 4-call `sentura_agents_manage` sequence; dashboard-session "no tools" reply re-classified as context poisoning, not a pipeline bug** (closes the loop on Rounds 17 + 18, 2026-04-20). Problem: after Rounds 17 (in-process `register_agent`) and 18 (AGENTS.md 12k shrink) landed, a fresh `billing-support-rep` deploy attempt from the dashboard webchat **still** ended with Forge replying *"this current session only has read/process/sessions/status/image tools"* — indistinguishable from the pre-fix failure mode. The user had spent two days on Rounds 14–18 and reasonably concluded the fix had regressed. Root cause: the dashboard session had accumulated multiple failed-deploy turns across days, and Forge's LLM kept restating the earlier "I only have read/session tools" rationale from its own context window even after the runtime was correct. Zero code change needed in this round. Verification:
  - Walked the full plugin-tool resolution pipeline end-to-end inside `openclaw/src/` (`pi-tools.ts:587 → collectExplicitAllowlist` feeds `pluginToolAllowlist` into `createOpenClawTools`; `plugins/tools.ts:145-154` non-optional plugin tools bypass the allowlist filter — `sentura_agents_manage` has `optional: false` at `sentura/extensions/sentura-agents/index.ts`; `effective-tool-policy.ts:131 → mergeAlsoAllowPolicy` merges `alsoAllow` entries into the pipeline's profile policy). Confirmed the config makes `sentura_agents_manage` reachable for Forge.
  - **Tool-inventory CLI probe** (authoritative check going forward): `openclaw agent --agent creator --session-id tool-probe-$(date +%s) --message "list your tools comma-separated, do not call anything"` returned all 23 tools — `read, process, canvas, cron, image_generate, video_generate, gateway, update_plan, sessions_list, sessions_history, sessions_send, session_status, web_search, web_fetch, image, pdf, sentura_agents_manage, sentura_rbac_manage, sentura_audit_query, browser, memory_search, memory_get, multi_tool_use.parallel`. Tool is visible. Pipeline is healthy.
  - **E2E deploy drive** via CLI: `openclaw agent --agent creator --session-id deploy-billing-$(date +%s) --timeout 300 --message "Deploy a new employee with this EXACT spec. Execute the 4-call sentura_agents_manage deployment sequence … Spec: id=billing-support-rep, name='Billing Support Rep', role='Customer Support rep for billing questions', model=openai/gpt-5.4, channels=[webchat], data_sources=[stripe, zendesk], allowed_actions=['read Stripe/Zendesk','answer customer billing questions','add internal Zendesk notes'], blocked_actions=['refunds','credits','subscription changes','payment changes'], escalate_to='Henry Zhang' …, tone='warm, concise'. Respond DEPLOYED followed by the exact 4 tool call names you executed."`. Result: Forge autonomously ran `create_agent → write (×8) → register_agent → stamp_setup` in ~80 s and replied `DEPLOYED create_agent, write, register_agent, stamp_setup`. The gateway log confirmed `Config overwrite: /Users/henry/.openclaw/openclaw.json (sha256 a8c660c4 → 4c0cf263, backup=…openclaw.json.bak)`.
  - **Post-deploy disk verification**: `~/.openclaw/workspace/billing-support-rep/` contains all 8 native files with correct Hard Rules (blocked refunds/credits/subscription/payment, escalation to Henry Zhang, no full card numbers/CVVs), tone ("warm, concise, calm under pressure"), and workflow. `~/.openclaw/workspace/billing-support-rep/.openclaw/workspace-state.json` = `{"setupCompletedAt": "2026-04-20T00:15:53.754Z", "version": 1}`. `openclaw.json` → `agents.list[id=billing-support-rep]` with `model: openai/gpt-5.4`, `tools.profile: messaging`, `tools.deny: ["gateway"]`, `sandbox.mode: non-main`, `runtime.type: embedded`, and full `params.{role,tone,channels,dataSources,allowedActions,blockedActions,escalateTo}` matching the spec.
  - **Creator debug playbook (added to `docs/memory/shared/creator-deployment-rounds-1-14.md` Round 19 and the MEMORY.md Current Ground Truth)**: (a) never treat an LLM "I can't deploy" reply as a runtime signal — the LLM may be restating its own prior turns; always probe with a fresh `--session-id`; (b) the authoritative tool-visibility probe is the CLI one-liner above; if it lists `sentura_agents_manage`, the pipeline is healthy regardless of what any other session claims; (c) a dashboard webchat session that shows the tool in the probe but refuses to call it is context-poisoned — start a new conversation, not a new investigation.
  - Verified via new test case `docs/TESTS.md § D13` / `docs/tests/tests-person-d.md` D-CRE-19 (4 checks: tool-probe reply contains `sentura_agents_manage`; E2E CLI deploy of `billing-support-rep` succeeds with `DEPLOYED …` reply; all 8 native files present with `setupCompletedAt` stamped; `openclaw.json` registration matches spec).
  - Expected behavior going forward: any dashboard webchat session spun up after this date, given a complete employee spec, will deploy it end-to-end in a single conversation — no re-sessioning, no CLI fallback, no manual workspace writes.
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
- [x] Build `sentura-rbac` extension with **7-role model**: `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`. Implement scope model (SME-wide or per-department). Include `userToken` in user store. _(completed Week 2 — tests in `sentura/extensions/sentura-rbac/src/{roles,authorizer}.test.ts`)_
- [x] Implement RBAC middleware: check permissions before every RPC call (role-based, using new 7-role definitions) _(completed Week 2 — `withRbac` helper in `sentura/extensions/sentura-rbac/src/middleware.ts` with a bootstrap escape hatch so the first `platform_admin` can be seeded on an empty store; 10 unit tests in `middleware.test.ts`, 44 total in the `sentura-rbac` suite)_
- [x] **Build first enterprise MCP server from ekg/ GradSale API docs** (Tier 2: Sentura-generated) _(completed Week 2 — `sentura/mcp-servers/gradsale-admin/`; 29 tools covering all endpoints in `ekg/api-admin.md` across disputes, verification review, ratings, reports, support, waitlist, email verification, transactions)_
  - [x] Wrap GradSale admin API endpoints (disputes, users, support threads, transactions) as MCP tools
  - [ ] Wrap GradSale **web** API endpoints (auth, listings, messages) as MCP tools _(deferred — admin surface unblocks the Dispute Resolver / Trust & Safety / Support personas; web surface scheduled for Week 3 alongside self-provisioning)_
  - [x] Use `@modelcontextprotocol/sdk` to build typed tool definitions _(with raw Zod shapes + cross-field validation in handlers; MCP SDK v1.29.0)_
- [x] Test MCP server integration: AI employee can use GradSale MCP tools in conversation _(completed Week 2 — end-to-end test in `sentura/mcp-servers/gradsale-admin/src/server.test.ts` connects an MCP `Client` via `InMemoryTransport` and walks through "list pending disputes → get one → approve with notes"; 18 tests green)_
- [x] Document the enterprise MCP generation pattern (API docs → MCP server → config.patch) _(completed Week 2 — `docs/DESIGN.md` § "Enterprise MCP Server Pattern" under Section 14; package-level README at `sentura/mcp-servers/gradsale-admin/README.md`)_

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
- [x] Build Creator Agent Phase 3: Self-Provisioning pipeline
  - Structured SKILL.md procedure (not just a prompt)
  - Approval integration (new accounts → HITL via exec.approval)
  - Error recovery (CAPTCHA, 2FA, rate limits → escalate to human with context)
  - Audit logging of every provisioning event
  - **Completed 2026-04-26**: `sentura/agents/creator/skills/self-provisioning/SKILL.md` — 9-step pipeline covering credential check, tier classification, HITL approval, browser navigation, credential extraction, verification, audit log, TOOLS.md update, Phase 4 signal
- [x] Test self-provisioning end-to-end: create employee → needs Zendesk → registers → configures
  - **Completed 2026-04-26**: `scripts/test-self-provisioning.ts` — 5 offline test groups (T-OFF-1 through T-OFF-5) + 4 live test groups (T-LIVE-1 through T-LIVE-4); live tests skip gracefully when gateway unreachable
- [x] **Design the pre-deployment test harness (capability #15)**:
  - Define test case schema: input scenario, expected actions, expected outcome, scoring rubric
  - Build test case extractor: pull historical tasks from enterprise data layer via MCP tools
  - Build mock task generator: synthesize realistic scenarios from database schema + API capabilities when historical data is insufficient
  - Define pass/fail thresholds and maximum auto-tune iteration count
  - **Completed 2026-04-26**: `sentura/config/test-harness-schema.json5` (TestCase, MockGeneratorConfig, TestRunResult, TestSuite, SuiteRunResult schemas; passMark: 0.75, maxAutoTuneIterations: 3) + `sentura/skills/pre-deployment-testing/SKILL.md` (7-step workflow including adversarial Hard Rule block condition)
- [x] Build Tuning Agent: NL instruction → workspace file edits + config.patch
  - **Completed 2026-04-26**: `sentura/agents/tuner/skills/nl-to-config/SKILL.md` + `sentura/agents/tuner/skills/workspace-edit/SKILL.md`
- [x] Test Tuning Agent: "make the AP clerk more casual" → SOUL.md updated
  - **Completed 2026-04-26**: `scripts/test-tuner-e2e.ts` — 6 offline + 4 live test cases
- [x] Create the Orchestrator Agent workspace (Mode B: multi-agent coordination)
  - **Completed 2026-04-26**: `sentura/agents/orchestrator/skills/task-decomposition/SKILL.md` + `sentura/agents/orchestrator/skills/multi-agent-routing/SKILL.md`
- [x] Write provisioning templates for 5 common SaaS services
  - **Completed 2026-04-26**: `sentura/config/provisioning-templates/{zendesk,hubspot,salesforce,notion,slack}.json5` — tiers: standard/standard/elevated/standard/auto respectively
- [x] **Build Data Scavenger Agent workspace (capability #12)**:
  - Create `sentura/agents/data-scavenger/` with SOUL.md and skills/
  - Build ingestion skill: accept uploaded documents (PDF, DOCX, Excel, images)
  - Build classification skill: LLM-driven 4-pillar classification of extracted content
  - Build structuring skill: convert classified content to JSON5 with entities, relations, provenance
  - Build merge skill: additive merge into target agent's `ekg/` files (never destructive)
  - Notification: alert affected agents that their knowledge base was updated
  - **Completed 2026-04-26**: Full workspace at `sentura/agents/data-scavenger/` — 9 workspace files (config.json5 + 8 native: AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) + 4 skills (ingestion, classification, structuring, ekg-merge)
- [x] **Design Q&A-based Completion skill (capability #13 — Tier 2 gap-filling)**:
  - Cron-triggered skill that reads agent's `ekg/` directory
  - Identifies missing required fields (null values, empty relations, incomplete entities)
  - Generates clarifying questions with context ("I noticed X is missing from Y")
  - Delivers questions via `message` tool (Slack/Teams) or queues for next conversation
  - Write skill: `sentura/skills/qa-completion/SKILL.md`
  - **Completed 2026-04-26**: `sentura/skills/qa-completion/SKILL.md` — 7-step cron skill; 5 questions/run cap; 7-day re-ask guard; pending records in MEMORY.md
- [x] **Design Experience Link extraction skill (capability #13 — Tier 3)**:
  - Post-task hook that evaluates completed tasks for reusable patterns
  - Generates candidate Experience Links with initial confidence scores
  - Write skill: `sentura/skills/experience-extraction/SKILL.md`
  - **Completed 2026-04-26**: `sentura/skills/experience-extraction/SKILL.md` — 6-step post-task hook; confidence formula `min(0.9, existing + 0.1*sqrt(occurrences))`; promotion at confidence ≥ 0.75 AND occurrences ≥ 3
- [x] **Design per-user memory isolation (workspace layer)**:
  - Implement dual MEMORY.md system: general `MEMORY.md` (workspace root) + `MEMORY_USER_{token}.md` files in `memory/users/`
  - Extend `sentura-bootstrap` hook to inject current user's `MEMORY_USER_{token}.md` alongside general `MEMORY.md` into system prompt
  - Extend dreaming system: general promotion (cross-user patterns → `MEMORY.md`), personal promotion (user-specific → `MEMORY_USER_{token}.md`), privacy boundary (no user PII in general memory)
  - Test: two users interact with same AI employee → verify memories are isolated, general patterns are promoted
  - **Completed 2026-04-26**: bootstrap hook injection already implemented by Person A (Week 2). Added `sentura/skills/personal-memory/SKILL.md` covering dual-scope read priority, personal/general write rules, dreaming promotion (≥3 users → general), consolidation (>150 lines), stale pruning (90 days), and privacy boundary table

### Person C — Frontend & Dashboard Engineer
- [ ] **Wire the auto-seeded platform admin into the dashboard gateway client** (unblocks every RBAC-guarded RPC) — `scripts/sentura-setup.{sh,ps1}` now writes `NEXT_PUBLIC_SENTURA_ADMIN_USER_ID` and `NEXT_PUBLIC_SENTURA_ADMIN_TOKEN` into `sentura/dashboard/.env.local` automatically (Week 2 wrap-up, Person D, 2026-04-19). The dashboard's gateway client must:
  - Read `process.env.NEXT_PUBLIC_SENTURA_ADMIN_TOKEN` on startup and expose it as the "acting user" identity.
  - Attach the token as `params.userToken` (default) — or `params.actorToken` on RPCs whose `userIdField` is different (e.g. `sentura.rbac.users.upsert` takes `userId` for the target + `actorToken` for the caller; see `sentura/extensions/sentura-rbac/src/middleware.ts`).
  - Surface a clear "no admin token — re-run `./scripts/sentura-setup.sh`" banner when the env var is missing, instead of letting calls fall silently into RBAC bootstrap mode.
  - Document the contract in `sentura/dashboard/README.md` so future Next.js pages don't forget to forward the token.
- [ ] Build the Live Tuning UI (`/tune` — chat with Tuning Agent, show before/after diffs)
- [ ] Build the Integration Manager page (`/integrations` — list MCP servers, status, credentials)
- [ ] ~~Build the Employee Editor~~ → Simplified: workspace file editor in `/employees/[id]` detail page (raw config editing deferred to Control UI)
- [x] Add real-time updates: WebSocket events for approvals, config changes (session events deferred to Control UI) _(completed 2026-04-25 — `useGatewayEvents(handlerMap)` primitive in `sentura/dashboard/src/lib/gateway/hooks.ts` (commit `42e98f5e`); `useApprovals` refactored as first consumer with 4 event types collapsed to 1 handler map; `config.changed` exposed in `GatewayEventType` union ready for use; sidebar `/chat` badge live-updates via `sessions.changed`)_
- [x] **Build 1:1 Chat Panel — Communication Panel MVP (capability #16)** _(completed 2026-04-25 — `sentura/dashboard/src/app/chat/` (commits `6af96df7` + `3468afcc`); 17 sub-tests in `docs/tests/tests-person-c.md` C11; all 4 acceptance criteria from `docs/memory/person-c/week-3.md` Phase 3 verified end-to-end via Playwright)_:
  - [x] New `/chat` route with two-pane layout: conversation list (left) + chat thread (right) — `chat-sidebar.tsx` + `<AgentChat>` mounted in right pane
  - [x] Conversation list: all dashboard sessions grouped by employee (via `getSessionAgentId` helper that parses the structured session key prefix because gateway `sessions.list` inconsistently populates the `agentId` schema field), sorted by last activity within each group
  - [x] "New conversation" button: employee picker (`employee-picker-dialog.tsx`) → `?draft=<agentId>` URL → first send fires `sessions.create` and the URL adopts the resulting `?key=<sessionKey>`
  - [x] Chat thread: send messages via `chat.send`, stream responses via WebSocket `chat` events (`state: "delta"` / `"final"`) — all encapsulated in shared `<AgentChat>` (D2 contract)
  - [x] Load conversation history via `chat.history` on conversation open — handled inside `<AgentChat>`'s combined reset+hydrate effect
  - [x] Typing indicator, message timestamps, agent avatar/name attribution — `<AgentChat>` `MessageBubble` + `StreamingDots`
  - [x] Conversation persistence — URL `?key=` query param is source of truth, refresh-resilient and multi-tab independent
  - [x] Add `/chat` link to dashboard sidebar navigation with live conversation-count badge (`useSessions().length` refetched on `sessions.changed`)

### Person D — Extensions & Integrations Engineer
- [x] Build `sentura-provisioner` extension: coordinates self-provisioning workflows _(completed 2026-04-26 — `sentura/extensions/sentura-provisioner/` ships `index.ts` + `src/{store,types}.ts` + `openclaw.plugin.json` with 2 tools (`sentura_provisioner_request`, `sentura_provisioner_complete`) and 3 dashboard RPCs (`sentura.provisioner.requests.list/get/cancel`).)_
- [x] Implement approval integration for self-provisioning (new accounts need approval) _(completed 2026-04-26 — provisioner lazy-resolves `getApprovalRuntime()` and calls `fileApprovalImperative(...)` against the shared store; auto_approved/auto_denied/pending mapped onto provisioning status. `package.json` declares `@sentura/approval: workspace:*`.)_
- [x] Build `sentura-approval` extension: enhanced HITL with escalation + timeout + decision-context _(completed 2026-04-26 — `sentura/extensions/sentura-approval/index.ts` (~445 lines) with `sentura_approval_request` tool, 6 dashboard RPCs (`requests.list/get/decide` + `policies.list/upsert/remove`), 60s sweep, builtin policies, cross-extension singleton via `getApprovalRuntime()`, `fileApprovalImperative()` helper, `ApprovalRequest.onTimeoutDecision` field for replay-safe policy intent.)_
  - Extends OpenClaw's binary exec.approval into context-aware approval (e.g., "approve if refund < $500")
  - Configurable escalation chains and timeout policies
- [x] **Expand MCP generation into MCP Builder Agent** (replaces standalone CLI tool) _(completed 2026-04-27 — Person B shipped 4 SKILL.md files (`api-analysis`, `mcp-generation`, `register-server`, `smoke-test`) under `sentura/agents/mcp-builder/skills/`; Person D's Week-2 `config.json5` already wires the sandbox `tools.alsoAllow` block (Round 20 fix), and `sentura-rbac/DESIGN.md` line 13/42 documents `ekg_manager` as the trigger role for the MCP Catalog. Cross-team integration test will land when Person C adds the dashboard "Trigger MCP Builder" page.)_
  - Wire B's MCP Builder Agent workspace (`sentura/agents/mcp-builder/`) with API analysis + code generation skills
  - Input: OpenAPI/Swagger specs (JSON/YAML), markdown API docs (like ekg/*.md), database schema docs, or raw URL
  - Output: TypeScript MCP server project at `sentura/mcp-servers/{name}/` with `index.ts`, `tools/`, `package.json`, `config-snippet.json5`
  - Agent can ask clarifying questions to `ekg_manager` who triggers it
  - Access control: only `ekg_manager` role can trigger the MCP Builder Agent via dashboard
- [x] Configure 2 open-source MCP servers (Tier 1: npm packages) for common enterprise tools _(completed 2026-04-26 — `sentura/mcp-servers/{filesystem,slack}/` each ship `config-snippet.json5` (paste-ready under `mcp.servers.<name>`) and `README.md` with security checklist. Tier-1 = upstream `@modelcontextprotocol/server-{filesystem,slack}` via `npx -y` — no in-tree code.)_
- [x] **Build test data extraction tools for pre-deployment testing (capability #15)** _(completed 2026-04-27 — `sentura/skills/test-data-extraction/SKILL.md` (agent-driven extraction in any session) + `scripts/extract-test-cases.ts` (operator-side runner). Output conforms to `sentura/config/test-harness-schema.json5` TestCase shape; supports `dispute`/`support_thread`/`report`/`verification` record types via `gradsale-admin` MCP tools; PII scrubbing masks emails and customer-name patterns; regulatory-tag rows (`legal_hold`/`gdpr_request`/`pci_violation`) are dropped before persisting.)_
  - MCP tool wrapper that queries enterprise data for historical task records (e.g., past support tickets, past invoices)
  - Output in standardized test case format (matching B's test harness schema)
  - Test with ekg/ GradSale: extract past dispute records and support threads as test cases
- [x] Test approval flow: AI employee triggers high-risk action → human approves on dashboard _(completed 2026-04-27 — `scripts/test-approval-flow.ts` (21 offline structural assertions PASS + 5 live gateway-connected RPC checks that skip cleanly when gateway is unreachable). Dashboard `/approvals` page now wires the Sentura approval kind: `useApprovals()` seeds via `listSenturaApprovals({status:"pending"})` on connect, the resolve handler dispatches to `decideSenturaApproval(...)` for `kind === "sentura"`, and the card surfaces `riskLevel` and `policyId` badges.)_
- [x] **Extend sentura-bootstrap hook to load `ekg/` files into agent context (capability #11)** _(completed 2026-04-26 — `sentura/hooks/sentura-bootstrap/handler.ts` walks `<workspaceDir>/ekg/{org,rules,assets,workflows}/` and synthesises a virtual `EKG_SUMMARY.md` (pillar inventory + per-file domain/entity/relation/rule counts + memory_search guidance). Dependency-free regex counters (no JSON5 parser in hot path). Co-exists with the existing per-user memory branch.)_
  - Update `sentura/hooks/sentura-bootstrap/handler.ts` to scan `ekg/` directory at agent startup
  - Inject EKG summary (pillar counts, key entities, rule count) into system prompt alongside AGENTS.md Hard Rules and BOOTSTRAP.md Enterprise Context (both already loaded natively by OpenClaw)
  - Ensure `ekg/` files are included in OpenClaw's workspace file scanning for vector indexing

---

## Week 4 — Multi-Tenancy, Orchestration & Knowledge Pipeline

> **Goal**: Multi-tenancy foundation. Mode B orchestration working. Knowledge ingestion functional. Cost tracking starts.
>
> **Capabilities covered**: #7 (orchestration + Manager EKG), #8 (multi-tenancy), #10 (cost tracking), #11 (EKG integration testing), #12 (Data Scavenger testing), #13 (Experience Links implementation), #15 (test runner implementation), #16 (communication panel — group chat), #17 (Manager capability abstraction)

### Person A — Platform & OpenClaw Engineer
- [x] **Design and implement multi-tenancy model** — `sentura/lib/tenancy.ts` + `sentura/extensions/sentura-rbac/src/tenancy-store.ts` + `sentura.rbac.tenancy.{get,list,set}` RPCs + `scripts/sentura-setup.{sh,ps1}` Step 4b. Tenancy lives outside `agents.list[]` in `~/.openclaw/sentura-rbac/agent-tenancy.json`; agent IDs stay flat (regex-restricted); single-tenant default = `tenantId="default"`, `departmentId=null`. Verified by `scripts/test-week4-tenancy.ts` (24/24).
- [x] **Build LanceDB user-level metadata partitioning** — forked `openclaw/extensions/memory-lancedb/` into `sentura/extensions/sentura-memory-lancedb/` with a `userToken` column on the LanceDB schema. Tools registered as factories so `ctx.sessionKey` → `extractUserTokenFromSessionKey` runs at registration, not at call time. `userTokenScope` config field controls the filter (`user-plus-global` default, `user-only`, `global-only`). One-shot `openclaw ltm migrate-userToken` CLI for legacy tables. Setup script disables upstream `memory-lancedb` when the Sentura variant is wired. Verified by `scripts/test-week4-memory.ts` (21/21).
- [x] **Build cost tracking backend** — `sentura/extensions/sentura-cost/` subscribes to OpenClaw's `model.usage` diagnostic event (which already carries `costUsd` from the gateway pricing cache) and writes a rolling JSONL store at `~/.openclaw/sentura-cost/cost-YYYY-MM-DD.jsonl`. Per-agent / per-department / per-tenant / per-model / per-user rollups. Three RPCs: `sentura.cost.events`, `sentura.cost.summary`, `sentura.cost.byUser` (user tokens hashed before export). Verified by `scripts/test-week4-cost.ts` (26/26).
- [x] Optimize gateway performance for multiple concurrent AI employees — `scripts/test-concurrent-employees.ts` is a measurement-and-tune harness that drives N concurrent WebSocket clients × M sequential RPC calls and reports p50/p95/p99 with a 2× baseline budget. Documented in `docs/HOSTING.md`. Run against a live gateway to validate IC-4.
- [x] Build monitoring: health endpoints, employee status, provider availability — `sentura/extensions/sentura-monitoring/` registers `sentura.health.{gateway,employees,providers,summary}`. Provider availability is computed from a rolling 5-minute window of `model.usage` events (no separate probe). Verified by `scripts/test-week4-health.ts` (22/22).
- [x] Set up OpenTelemetry via `diagnostics-otel` extension — `scripts/sentura-setup.{sh,ps1}` Step 7c stamps `diagnostics.otel.enabled = true` + endpoint when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; skips silently when unset. Optional Jaeger compose snippet at `docs/otel/docker-compose.example.yml`. Verified by `scripts/test-week4-otel.ts` (19/19).

### Person B — AI Employee & Skills Engineer
- [x] **Close the agent-callable gateway-tool surface gap** (Week 3 follow-up, surfaced 2026-04-26 during Week 3 re-audit) _(closed 2026-05-01 — turned out two of the four "missing" RPCs were already covered by Person D's `sentura_approval_request` tool; the secrets-existence probe gap is now closed by adding a `dotenv_check` action to `sentura_agents_manage` (3 lines of schema + a small parser). Self-provisioning SKILL.md rewritten to use the Sentura primitives; ⚠️ caveat block removed; `scripts/test-self-provisioning.ts` 66/66 PASS live. The Creator's allowAllow + sandbox-mirror updated. The remaining secrets.reload mid-session case is an operator escalation — documented in the SKILL.md.)_:
  - The agent-callable `gateway` tool's restricted action enum currently
    exposes only `restart`, `config.get`, `config.schema.lookup`,
    `config.apply`, `config.patch`, `update.run` (see
    `openclaw/src/agents/tools/gateway-tool.ts:137`).
  - Self-provisioning needs `secrets.resolve` / `secrets.reload` /
    `exec.approval.request` / `exec.approval.resolve` reachable from inside
    an agent's tool palette, otherwise Steps 1, 3, 5 of
    `sentura/agents/creator/skills/self-provisioning/SKILL.md` are
    operator-driven instead of autonomous (the SKILL.md ⚠️ caveat block
    documents the current operator-driven fallback).
  - Two implementation options: (a) widen the `gateway` tool's action enum
    in OpenClaw core, or (b) add Sentura plugin tools
    (`sentura_secrets_manage` / `sentura_approvals_manage`) under
    `sentura/extensions/` following the `sentura_agents_manage` pattern.
  - Once shipped, remove the ⚠️ Implementation caveat block at the top of
    `self-provisioning/SKILL.md` and re-test end-to-end via
    `scripts/test-self-provisioning.ts`.
- [x] Build Orchestrator Agent: task decomposition, assignment to employees, result synthesis _(completed 2026-05-01 — Orchestrator skills `task-decomposition` + `multi-agent-routing` shipped Week 3; this week added `sentura/agents/orchestrator/ekg/{capabilities,conflicts,insights,global-sops}/` pillars with README schema + invariants. Mode-B integration test `scripts/test-mode-b-orchestration.ts` verifies workspace + capability resolver — 46 PASS / 0 FAIL live + offline.)_
  - Extends OpenClaw's basic `sessions_spawn` with structured task tracking
  - Progress monitoring via `sessions_history`
  - Dependency-aware task ordering
  - Set up Orchestrator's `ekg/` directory structure (capabilities/, conflicts/, insights/, global-sops/)
- [x] Test Mode B: "Prepare Q4 report" → Orchestrator assigns subtasks to AP Clerk + CS Agent _(completed 2026-05-01 — `scripts/test-mode-b-orchestration.ts` includes a fixture-based decomposition resolver test that picks `ap-clerk` + `cs-agent` for a Q4 report request. Live execution opt-in via `SENTURA_MODE_B_LIVE_PROMPT`; sessions.create against orchestrator verified live.)_
- [x] **Integrate Data Scavenger Agent with Knowledge Curator (capabilities #11, #12)** _(completed 2026-05-01 — added `sentura/skills/ekg-to-skill-synthesis/SKILL.md`; parent `sentura/skills/knowledge-curation/SKILL.md` now delegates the EKG-handoff path to it. The sub-skill protects hand-authored skills via a synthesized provenance footer.)_:
  - Data Scavenger processes uploads → writes structured JSON5 to agent `ekg/` directories
  - Knowledge Curator continues generating SKILL.md files from `ekg/` structured data
  - Test: upload company directory PDF → Data Scavenger → `ekg/org/org-chart.json5` → agent can answer "who approves purchases?"
  - Test: upload financial policy PDF → Data Scavenger → `ekg/rules/financial-controls.json5` → agent checks limits before acting
- [x] **Implement Experience Link extraction (capability #13 — Tier 3)** _(closed 2026-05-01 — new `sentura/extensions/sentura-experience-extraction/` plugin registers `after_tool_call` + `agent_end` hooks, accumulates per-agent tool-sequence patterns, and promotes patterns into target agent `ekg/workflows/experience-links/{linkId}.json5` once `occurrences ≥ minOccurrences (3)` AND `confidence ≥ 0.75`. Confidence formula matches the SKILL.md design: `min(0.9, 0.3 + 0.1 * sqrt(occurrences))`. Pure helpers split into `src/scoring.ts` for offline tests. `scripts/test-experience-extraction.ts` — 48/48 PASS live + offline including end-to-end 3-session promotion simulation. Plugin enrolled in `~/.openclaw/openclaw.json` and `scripts/sentura-setup.sh`. Dreaming-cycle integration (light/deep/REM phases) still defers to Person A's Week-5 bootstrap-hook seam, but the on-task-complete promotion path is fully live.)_:
  - Build post-task hook that evaluates completed tasks for reusable patterns
  - Implement confidence scoring: frequency, relevance, diversity, recency weights
  - Integrate with dreaming cycle: light phase detects gaps, deep phase extracts patterns, REM promotes high-confidence links
  - Test: run agent through 3 similar procurement tasks → verify Experience Link auto-generated
- [x] **Build Manager capability abstraction (capability #17 — Mechanism 1)** _(completed 2026-05-01 — Creator skill `sentura/agents/creator/skills/capability-extraction/SKILL.md` shipped, invoked from `employee-deployment/SKILL.md` Step 6. Manifest schema + invariants documented in `sentura/agents/orchestrator/ekg/README.md`. Test asserts schema + workspace integration in `scripts/test-mode-b-orchestration.ts` T-OFF-5/6.)_:
  - When Creator Agent incubates a new employee (Phase 5: Deploy), auto-extract Capability Tags and I/O Schemas
  - Write capability metadata to Orchestrator's `ekg/capabilities/{agent-id}.json5`
  - Test: create a Legal Specialist → verify `ekg/capabilities/legal-specialist.json5` created with correct capability tags
- [x] **Implement pre-deployment test runner (capability #15)** _(completed 2026-05-01 — `scripts/run-pre-deployment-tests.ts` implements the full scoring engine + suite aggregator + JSON5-tolerant loader + auto-tune recommendation generator. Self-test passes; companion test `scripts/test-pre-deployment-runner.ts` 25/25 PASS live + offline. Auto-tune loop wires through to a target file (SKILL.md / AGENTS.md / SOUL.md / BOOTSTRAP.md) per criterion. Cap of 3 iterations + hard-rule fail forces 'block' recommendation.)_:
  - Run employee in sandbox mode against each test case
  - Score results across 6 dimensions: task completion, tool usage, safety compliance, escalation judgment, tone, error handling
  - Build auto-tune loop: diagnose failure root cause → apply targeted fix (SKILL.md, AGENTS.md `§ Hard Rules`, SOUL.md, BOOTSTRAP.md `§ Enterprise Context`, ekg/ files, or tool config) → re-test
  - Cap iterations with human-review escalation if max retries exceeded
  - Test against ekg/ GradSale: create CS agent → run against historical dispute records → tune until all pass
- [x] Build incubation memory: Creator Agent remembers past creations, learns from failures _(completed 2026-05-01 — `sentura/agents/creator/skills/incubation-memory/SKILL.md` defines append-only protocol over Creator's native `MEMORY.md` workspace file. Read at start of `incubation/SKILL.md` Step 2; written at end of `employee-deployment/SKILL.md` Step 8.)_
- [x] Write reflection loop: Creator monitors new employee, auto-patches issues _(completed 2026-05-01 — `sentura/agents/creator/skills/reflection-loop/SKILL.md` defines a bounded 3-round, 1-patch-per-round loop with revert-on-regression and operator escalation. Re-test integrates with the pre-deploy runner.)_

### Person C — Frontend & Dashboard Engineer
- [x] Build the Orchestrator dashboard (`/orchestrator` — task decomposition view, progress tracking) _(completed 2026-05-01 during week-4 merge integration — 4-tab Manager EKG browser (capabilities/conflicts/insights/global-sops) backed by new server-side route handler `/api/orchestrator/ekg` reading Person B's `~/.openclaw/workspace/orchestrator/ekg/*.json5`. Capabilities tab shows live data from Creator's `capability-extraction` skill output (agent name + department + capabilityTags + approvalsRequired + deployedAt + provenance.confidence). Conflicts/insights/global-sops show honest empty states naming the W5 Manager skills that will populate them. Smoke-tested live: `acme-legal-specialist.json5` parses correctly with all unquoted-key JSON5 fields.)_
- [x] Build the Knowledge Manager UI (`/knowledge` — upload documents to Data Scavenger, view generated skills, browse agent EKG pillar contents, skill distribution) _(completed 2026-05-01 during week-4 merge integration — 3-pane EKG browser (agent picker → file list → markdown/JSON5 preview) backed by new server-side route handlers `/api/knowledge/agents` and `/api/knowledge/agents/[agentId]/file/[filename]` reading per-agent `~/.openclaw/workspace/<agent>/ekg/*.{md,json5}`. Hides orchestrator agent (surfaced separately) + state runtime cache. Path-traversal guarded at handler + safeJoinUnder layers. Upload zone deferred — Data Scavenger ingestion is currently agent-side; dashboard upload trigger lands when the Scavenger gets a dashboard surface.)_
- [x] **Build the Cost Center page** (`/cost` — per-employee, per-department LLM spend — backed by A's cost tracking) _(completed 2026-05-03 during week-4 merge integration round 3 — `/cost` graduated from skeleton to real Cost Center backed by `client.getCostSummary()` → `sentura.cost.summary` RPC. Renders 4 headline stats (total spend / calls / tokens / avg) + 4-tab breakdown (by agent / department / tenant / model) with progress-bar share columns + range switcher (today / 7d / 30d / all). Surfaces `unpricedCalls` separately so unpriced calls don't silently under-report spend. Friendly fallback when the extension isn't registered. Backend: Person A's `sentura/extensions/sentura-cost/` shipped Week 4 — JSONL store at `~/.openclaw/sentura-cost/cost-YYYY-MM-DD.jsonl`, subscribed to OpenClaw's `model.usage` diagnostic event.)_
- [ ] ~~Build the Health Monitor~~ → Removed: deferred to OpenClaw Control UI `/overview` (linked via sidebar)
- [x] **Build the Test Results dashboard** (`/testing` — capability #15: test scorecard per employee, per-dimension scores, pass/fail status, auto-tune history) _(completed 2026-05-01 during week-4 merge integration — split-pane SuiteRunResult viewer (runs list left, scorecard detail right) backed by new server-side route handlers `/api/testing/runs` and `/api/testing/runs/[runId]` reading Person B's `~/.openclaw/test-runs/*.json5`. Each row shows pass-rate badge + recommendation pill (deploy/auto-tune/block) + iteration count + relative run age. Detail pane shows per-case pass/fail + score + safety: prefix highlight for Hard-Rule failures. Empty state shows the exact CLI command to populate the dir.)_
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

### Person D — Extensions & Integrations Engineer — COMPLETE (2026-05-01)
- [x] Build comprehensive audit logging (every action, every tool call, searchable) — extended `sentura-audit` with 7 new event types (`chat_message`, `chat_group_*`, `mcp_health_*`), tenant/department/userId/groupId/argumentsDigest metadata, and free-text `search` filter on `sentura.audit.query`.
- [x] Implement data classification (T0–T4 tiers) in audit extension — `dataTier` field stamped on every entry by `classifyDataTier(eventType, details, defaultTier)`; query/tool both filterable by tier; `sentura.audit.stats` rolls up `byTier`. Schema extended in `openclaw.plugin.json` with `defaultDataTier` config.
- [x] **Implement multi-tenancy in extensions**: tenant-aware audit logging, approval routing, RBAC scoping — `AuditMetadata` and `ApprovalRequest` both carry `tenantId`/`departmentId`; `AuditQueryParams` and `ApprovalQueryParams` both filterable; `fileApprovalImperative` honours the new fields; `sentura.audit.stats` exposes `byTenant`.
- [x] **Integrate audit logging for Communication Panel conversations (capability #16)**: new gateway RPCs `sentura.audit.chat.log` (per-message) and `sentura.audit.group.log` (group lifecycle: created/updated/archived/fanout) — both written by `sentura-audit/index.ts`; events queryable by `groupId`/`tenantId` via the existing `sentura.audit.query` RPC.
- [x] Configure more MCP servers using 3-tier strategy:
  - 2 more open-source MCP servers (Tier 1) — `sentura/mcp-servers/github/` (`@modelcontextprotocol/server-github`) + `sentura/mcp-servers/postgres/` (`@modelcontextprotocol/server-postgres`), each with `config-snippet.json5` + `README.md` per the existing `filesystem/` and `slack/` template.
  - 1 more enterprise-generated MCP server from ekg/ docs (Tier 2) — `sentura/mcp-servers/gradsale-search/` covering Sections 2 (Users), 9 (Ratings), 15 (Universities), 17 (Geocoding) of `ekg/api-web.md`. 8 read-only tools, full vitest suite (11 green).
- [x] Build MCP server health monitoring (connection status, error tracking) — new extension `sentura/extensions/sentura-mcp-health/` with stdio-MCP-ping `defaultCheckStrategy`, status state-machine (up→degraded→down with configurable thresholds), gateway RPCs `sentura.mcp.health.{list,get,checkNow}`, agent tool `sentura_mcp_health`, and audit emit on every status change via `sentura.audit.mcp.health`.
- [x] Write security scanner: detect risky agent configurations — `sentura/extensions/sentura-audit/src/security-scanner.ts` (pure `scan`/`summarize`) plus CLI driver `scripts/scan-agent-security.ts`. Detects sandbox-mode misuse, wildcard tool allowlists, high-risk tools (`exec`/`browser`), missing Hard Rules header in AGENTS.md, oversized AGENTS.md (>11.5k chars → 12k truncation footgun), raw secret patterns (OpenAI/AWS/Slack/GitHub/PEM/Google) in workspace files or MCP env, and channel-bound agents missing `escalateTo`.

**Verification:** Offline — 107 vitest cases green across 10 test files (sentura suite 9 files / 96 tests + gradsale-search 1 file / 11 tests); `pnpm build` succeeds for the new MCP server. Live — `scripts/test-week4-d.ts` runs **21/21 passing** RPCs against a live gateway (chat/group/mcp-health audit ingest, multi-tenancy + dataTier + groupId query filters, MCP health monitor list/get, approval list with tenant filter). Security scanner CLI runs cleanly against the live config (3 high, 0 critical).

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
- [ ] **Harden Tuner workspace-edit skill so the structured approval cannot be skipped.** Discovered 2026-05-04 during A4 manual testing: Tuner replied with a fully-formatted diff but did NOT call `sentura_approval_request` — `/approvals` stayed empty even though the SKILL.md was correct. Same procedural-skipping pattern as capability-extraction. Quick fix landed (reordered the skill so the structured approval is Step 3 BEFORE the diff display in Step 4, plus a "STOP — DO THIS BEFORE SHOWING THE DIFF" heading callout). But that's still LLM-compliance-by-prose. Proper fix: a hook-driven assertion that watches Tuner's outgoing chat messages for diff syntax (` ```diff ` fence, `BEFORE:` / `AFTER:` markers, `--- ` / `+++ ` headers) and fails the message if the most recent tool call from the Tuner agent in this session was NOT `sentura_approval_request`. The Tuner sees the failure on its next turn and is forced to file the approval before retrying. Belongs in `sentura/extensions/sentura-experience-extraction` (existing after_tool_call + agent_end hooks have the right shape) or as a new tiny extension. Acceptance: 10/10 Tuner workspace-edit deploys (including high-risk AGENTS.md edits) end with at least one `sentura_approval_request` row matching the diff that was shown — verifiable by `node -e "const a=require('/Users/<you>/.openclaw/sentura-approval/approvals.json'); console.log(a.filter(r=>r.kind==='tuner.workspace_edit').length)"` matching the chat-message count. Update `scripts/test-tuner-e2e.ts` to assert the approval row exists at the moment the diff is received, not just at session end.
- [ ] **Harden Phase 5 Step 6 (capability extraction) so Forge cannot skip it.** Discovered 2026-05-04 during A2 manual testing: Forge deployed `penny-ap-test` end-to-end (workspace + `register_agent` + tenancy) but silently skipped capability extraction, leaving `~/.openclaw/workspace/orchestrator/ekg/capabilities/` empty. Without the manifest, the Orchestrator's `task-decomposition` skill cannot route Mode-B work to the new employee, and `/orchestrator` capabilities tab won't list them. The skill is currently LLM-driven judgment-heavy work (read 5+ workspace files → extract `capabilityTags` / `ioSchemas` / `approvalsRequired` → write JSON5), and Forge under-runs the deploy procedure when the chat is long or context is poisoned. **Three options to weigh — pick one or combine:**
  - **(1) Hook-driven assertion.** Add a post-`register_agent` hook (or extend `sentura-experience-extraction`) that checks for `ekg/capabilities/<id>.json5` within ~30s of registration; if missing, emit a `capability_manifest_missing` audit event and surface a red banner on `/employees/<id>` until Forge writes it. Forge sees the failure on its next turn and retries.
  - **(2) Tool-side directive.** Extend `sentura_agents_manage action:"register_agent"` result to include `nextAction: "extract_capabilities"` + the relevant file-read list. Strengthens the LLM's procedural anchor without changing skill prose.
  - **(3) Plugin auto-stub + LLM upgrade.** On `register_agent`, plugin auto-creates a minimal capability stub (`agentId`, `name`, `department`, `invokableSkills` from the workspace file list, `provenance.confidence: 0.5`, `reviewRequired: true`). Forge's Step 6 then *upgrades* the stub to confidence ≥0.7 with full extraction. Guarantees routing-time presence even on Forge no-shows; degrades gracefully to "needs review" rather than "missing".
  - Acceptance: deploy 10 employees back-to-back via Forge with deliberately-truncated chat context; 10/10 should end with a usable capability manifest on disk. Update `docs/manual-tests/week-3-4-live.md` A2 step 7 to reflect whichever mechanism lands.
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
- [x] Build the Audit Trail page (`/audit` — searchable, filterable, exportable, tagged with `userToken` for attribution) _(completed 2026-05-03 during week-4 merge integration round 4 — `/audit` graduated from disabled-W5-placeholder to real Audit Trail backed by `client.queryAudit()` + `client.getAuditStats()` → `sentura.audit.{query,stats}` RPCs. Renders 4 headline stat cards (events/24h, critical, warnings, T3+T4 high-tier counts) + 5-field filter bar (free-text search, eventType dropdown across all 19 types, severity dropdown info/warning/critical, dataTier dropdown T0–T4, agentId text) + entries table with severity/tier badges (T3+T4 in destructive variant), tenant/department metadata, and detail-summary truncation. Friendly fallback when extension is not registered. Sidebar `/audit` link enabled (W5 badge dropped). Backend: Person D's `sentura/extensions/sentura-audit/` with T0–T4 data classification, 19 event types incl. chat/group/mcp-health, free-text contains-match on details JSON.)_
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
- [ ] **Promote group-chat transcript to a Sentura extension + gateway RPC.** Discovered 2026-05-04 during A3.2 testing: the dashboard had no group-history persistence at all (`messages` was purely React state, lost on re-mount). Quick fix landed a dashboard-only `/api/groups/[id]/history` Route Handler with split persistence (user-side on `GroupRecord.messages`, assistant-side joined from each per-agent `chat.history` via gateway RPC). That works for the dashboard, but every other surface that needs group transcripts — `/audit` deep-links into a group exchange, future Slack-group integration, scheduled-report email digests, multi-employee orchestrator runs — would have to fork the same merge logic. Promote the group-chat data model into a proper extension `sentura-group-chats` (currently the file store at `sentura/dashboard/src/lib/groups/store.ts` lives under the dashboard, which is wrong). Expose gateway RPCs `sentura.groups.{list, get, create, archive, history, send}` matching `chat.history` payload shape so existing consumers don't fork their parsing. Move the JSON store from `~/.openclaw/sentura-group-chats/groups.json` to extension state via `api.runtime.state` (or the equivalent SDK seam). The dashboard's two Route Handlers should shrink to thin pass-throughs that call the new RPCs. Acceptance: (a) the `/api/groups/[id]/history` route is reduced to one RPC call; (b) the orchestrator's Mode-B task-decomposition skill can read group history when continuing a multi-employee task across page refreshes; (c) audit events from group exchanges include the resolvable `groupId` so the audit page can deep-link back into the merged transcript.

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
