# Sentura Platform — Test Matrix

> **Single source of truth for what to test.** Summary matrix only; detailed test cases (methods, expected outputs, assertions) live in per-person files under [`docs/tests/`](tests/) and are read on demand.
>
> **Last updated**: 2026-04-24 (Week 3 A — file-backed secret provider bootstrap, per-agent MCP registration in workspace `config.json5 -> mcpServers`, redacted Sentura config diff log, dashboard chat-session helpers, `scripts/test-week3-a.ts` offline harness PASS; A16-A19 added, A20 live browser probe script added). 2026-04-19 (Round 20 extended — fix rolled out to all 4 meta-agents (`creator` + `tuner` + `orchestrator` + `mcp-builder`) via source `config.json5` edits AND `scripts/sentura-setup.{sh,ps1}` overrides so fresh installs and re-runs stay correct; `docs/SETUP.md`, `docs/OPENCLAW.md`, `docs/DESIGN.md`, `README.md` gained dedicated "Sandbox tool-policy filter" sections / cross-links; D14 expanded from 4 → 6 checks). 2026-04-19 (Round 20 — Dashboard `chat.send` sandbox tool-policy filter fix: added `tools.sandbox.tools.alsoAllow` to `sentura/agents/creator/config.json5` + live `~/.openclaw/openclaw.json` to override OpenClaw's sandbox `DEFAULT_TOOL_ALLOW`/`DEFAULT_TOOL_DENY` for plugin tools; `probe-creator-tools.ts` and `probe-chat-send.ts` both confirm `sentura_agents_manage` is reachable on the dashboard path; D14 added). 2026-04-20 (Round 19 — Forge E2E deploy PASS: `billing-support-rep` deployed autonomously via CLI `openclaw agent --agent creator --message "Deploy …"` using the 4-call `sentura_agents_manage` sequence (`create_agent → write ×8 → register_agent → stamp_setup`) in ~80s; dashboard-session "I only have read/session tools" replies re-classified as LLM context poisoning, not a pipeline regression; D13 added — authoritative tool-visibility probe + E2E deploy smoke test). 2026-04-19 (Round 18 — Creator `AGENTS.md` shrunk from 18,597 → ~10,800 chars to stay under OpenClaw's 12k workspace-bootstrap-file injection limit; Forge's system prompt now contains the full `sentura_agents_manage { register_agent }` tool-call sequence again instead of silently truncating it mid-`Hard Rules`; D12 added to lock the invariant). 2026-04-19 (Round 17 — In-process employee registration (`sentura_agents_manage { register_agent }` + matching gateway RPCs) bypasses the scope-upgrade pairing deadlock that was blocking `gateway.config.patch` from Forge's embedded runtime; Creator skills + `TOOLS.md` + `SOUL.md` synced in both source tree and `~/.openclaw/workspace/creator/`; D11 added). 2026-04-19 (Sentura vitest config re-homed to `openclaw/test/vitest/vitest.sentura.config.ts` with a pristine backup kept at `scripts/vitest.sentura.config.ts`; known gap from the upgrade pass is now closed). 2026-04-19 (OpenClaw `2026.4.19-beta.2` upgrade pass — docs re-synced to the new pnpm monorepo layout; test commands below are confirmed still valid under the new version). Prior: 2026-04-19 (Person D Week 2 completion — D3 `sentura-rbac` unit tests PASS, D4 RBAC middleware PASS, D7 GradSale admin MCP server PASS with 29 tools, D8 employee ↔ MCP integration PASS via `InMemoryTransport`; adds D9 pattern-docs row). 2026-04-19 (Memory Reorg Pass: `docs/MEMORY.md` became a per-person / per-week matrix pointing at `docs/memory/person-*/week-*.md` + `docs/memory/shared/*.md`; DOC6 added below). 2026-04-19 (Doc Compression Pass: TESTS.md rewritten as matrix; full detail moved to `docs/tests/tests-person-{a,b,c,d}.md` + `tests-cross-team.md`). 2026-04-20 (Week 2 audit round 14 — B9.6/B9.7 MCP Builder config repair). 2026-04-19 (round 13 — B6.9 Creator E2E live PASSED). 2026-04-18 (round 11 — B6.8 sandbox `workspaceAccess: "rw"`). 2026-04-17 through 2026-04-18 (rounds 4–10 — B6.3–B6.7). Earlier rounds: A14 sandbox seed hook, A15 `sentura-agents` extension + C8/C9/C10 pages.

---

## How to Run Tests

### Automated Unit Tests (Person D extensions)

```bash
cd openclaw && npx vitest run --config test/vitest/vitest.sentura.config.ts
```

Watch mode: `cd openclaw && npx vitest --config test/vitest/vitest.sentura.config.ts`
Single file: `cd openclaw && npx vitest run --config test/vitest/vitest.sentura.config.ts redaction`

> **Re-placement after a fresh `openclaw` pull.** The live config lives at `openclaw/test/vitest/vitest.sentura.config.ts` so it can import `sharedVitestConfig` from OpenClaw's own test infra via a relative path (matches the convention used by `vitest.extension-*.config.ts`). Because `openclaw/` is re-pulled periodically, a pristine backup is kept at `scripts/vitest.sentura.config.ts`. After pulling a fresh `openclaw/`, re-place it with:
>
> ```bash
> cp scripts/vitest.sentura.config.ts openclaw/test/vitest/vitest.sentura.config.ts
> ```
>
> Keep the two files byte-for-byte identical so a simple `cp` works.

### GradSale Admin MCP Server (Person D)

```bash
pnpm --filter @sentura/mcp-gradsale-admin test   # 18 tests (14 unit + 4 end-to-end via InMemoryTransport)
pnpm --filter @sentura/mcp-gradsale-admin build  # tsc → dist/
```

Tests stub `fetch`, so the real GradSale backend does not need to run.

### Dashboard Build Verification (Person C)

```bash
cd sentura/dashboard && pnpm install && pnpm build && pnpm lint
```

### Setup Script Verification (Person A)

Requires a working OpenClaw install (see `docs/SETUP.md`):

```bash
cd openclaw && pnpm install && pnpm ui:build && pnpm build && pnpm openclaw onboard
cd .. && ./scripts/sentura-setup.sh
```

### Week 2 Integration Harness

```bash
npx tsx scripts/test-week2.ts                    # Parts 11 + 12 (sandbox seed + sentura-agents)
npx tsx scripts/test-gateway-integration.ts      # A13 (requires gateway on :18789)
npx tsx scripts/test-creator-helpers.ts          # B11 (offline — 49/49 pass)
npx tsx scripts/test-creator-e2e-live.ts         # B6.9 / B13 (real LLM — 2026-04-19 PASSED with openai/gpt-5.4)
npx tsx scripts/test-hot-reload.sh               # A6
npx tsx scripts/repair-sandbox-seeding.ts        # A14.12 (fixer for existing installs)
```

### Week 3 A Validation Harness

```bash
node --import ./openclaw/node_modules/tsx/dist/loader.mjs scripts/test-week3-a.ts
node --import ./openclaw/node_modules/tsx/dist/loader.mjs scripts/probe-browser-self-provisioning.ts
```

The offline harness covers A16-A19. The browser probe is A20 and requires a running gateway plus a working browser extension.

### Live Verification

Gateway at `http://localhost:18789`; Control UI at same URL.

---

## Test Matrix — Summary

Status codes: **PASS** = verified in most recent audit; **PEND** = pending implementation; **LIVE** = requires live gateway; **WK3+** = deliverable belongs to a later week.

### Person A — Platform & OpenClaw

| ID | Area | Cases | Script / Method | Status | Detail |
|----|------|------:|-----------------|--------|--------|
| A1 | OpenClaw build & runtime | 7 | `pnpm build`, `pnpm gateway:watch`, `curl /healthz`, Control UI chat | PASS | [`tests/tests-person-a.md § A1`](tests/tests-person-a.md) |
| A2 | `sentura-setup.sh` | 8 | Fresh run + idempotency rerun + pre-flight failure | PASS | § A2 |
| A3 | `sentura-bootstrap` hook (per-user memory) | 5 | Session bind with/without user token; empty/missing file skip | PASS | § A3 |
| A4 | Workspace creation lib | 6 | `createWorkspace({...})` — 8 natives + `skills/` + `ekg/` 4-pillar + `memory/users/` + industry ontology merge | PASS | § A4 |
| A5 | Agent registration lib | 6 | `buildAgentPatch`, `registerAgentOnDisk`, `isAgentRegistered`, `buildMemoryDbPath` | PASS | § A5 |
| A6 | Hot-reload | 3 | `scripts/test-hot-reload.sh` (6 steps) | PASS | § A6 |
| A7 | MCP loopback | 2 | `scripts/configure-mcp-loopback.sh` × 2 (idempotent) | PASS | § A7 |
| A8 | Channel binding helpers | 5 | `createWebchatBinding`, `createSlackChannelBinding`, `createDiscordBinding`, dedup, remove | PASS | § A8 |
| A9 | Per-agent LanceDB isolation | 4 | `agentMemoryDbPath`, `applyMemoryIsolationOnDisk`, validator, live setup check | PASS | § A9 |
| A10 | User token infrastructure | 7 | UUID gen, `buildSessionKey`, parse roundtrip, `hashUserToken`, `ensureUserMemoryFile` | PASS | § A10 |
| A11 | RBAC 7-role model | 7 | `ROLE_DEFINITIONS` has 7; `userToken` in `SenturaUser`; `resolveByToken` RPC | PASS | § A11 |
| A12 | Docs accuracy | 4 | `docs/SETUP.md` end-to-end, RPC doc match, monorepo scripts, pnpm workspaces | PASS | § A12 |
| A13 | Gateway integration (live) | 11 | `test-gateway-integration.ts` — handshake, `config.get`/`config.patch`, memory isolation, Hard Rules + Enterprise Context present, `/health` | PASS | § A13 |
| A14 | Sandbox seed hook | 12 | `test-week2.ts` Part 11 — skills mirror, BOOTSTRAP.md overwrite, MEMORY.md / config.json5 / memory-users / ekg union-copy, host no-op, stale-install repair | PASS | § A14 |
| A15 | `sentura-agents` extension + setup wiring | 12 | `test-week2.ts` Part 12 — manifest, 4 RPC methods, `sentura_agents_manage` tool, `safeJoin` path-guard, native-file block, setup `plugins.load.paths` / `plugins.entries` patching, live subfile round-trip | PASS | § A15 |
| A16 | Week 3 secrets file provider + host helpers | 4 | `test-week3-a.ts` — default file-provider bootstrap, `put_secret`, `has_secret`, no plaintext in tool output or diff log | **PASS 2026-04-24** | § A16 |
| A17 | Week 3 per-agent MCP registration | 4 | `test-week3-a.ts` — writes `config.json5 -> mcpServers`, preserves `$secret:` pointers, wraps stdio launch path, agent isolation | **PASS 2026-04-24** | § A17 |
| A18 | Week 3 Sentura config versioning | 4 | `test-week3-a.ts` — redacted before/after diff records, changedPaths only, no-op writes emit no log | **PASS 2026-04-24** | § A18 |
| A19 | Week 3 dashboard chat-session helpers | 4 | `test-week3-a.ts` — `createChatSession`, `sendChatMessage`, `listChatSessions`, dashboard-key parser/filter | **PASS 2026-04-24** | § A19 |
| A20 | Week 3 browser probe + doc sync | 2 | `probe-browser-self-provisioning.ts` + doc contract review (`HOSTING`, `SETUP`, `gateway-rpc`, self-provisioning, MCP README) | LIVE (attempted 2026-04-24; blocked by local Creator auth + Docker sandbox prerequisites) | § A20 |

### Person B — AI Employee & Skills (incl. Creator Bug-Fix Rounds)

| ID | Area | Cases | Script / Method | Status | Detail |
|----|------|------:|-----------------|--------|--------|
| B1 | Creator workspace (8 natives + config) | — | File-presence checks in `sentura/agents/creator/` | PASS | [`tests/tests-person-b.md § B1`](tests/tests-person-b.md) |
| B2 | Workspace convention doc | — | 8 natives + `skills/` + `ekg/` + `memory/users/`; **never** `RULES.md`/`CONTEXT.md` | PASS | § B2 |
| B3 | Role templates (AP/CS/SDR) | — | `sentura/config/templates/*` | PASS | § B3 |
| B4 | Platform skills (self-prov, knowledge-curation) | — | `sentura/skills/*/SKILL.md` | PASS | § B4 |
| B5 | Test employee (GradSale CS Agent) | — | Manual deploy + smoke conversation | PASS | § B5 |
| B6 | Creator phase skills (research/design/deploy) | — | Phase 1/2/4 SKILL.md existence + structure | PASS | § B6 |
| B6.2 | `employee-deployment` rewrite (RPC-first, no `fs_write`) | 6 | Skill references `sentura_agents_manage`, `agents.files.set`, `config.patch` | PASS | § B6.2 |
| B6.3 | Creator `AGENTS.md § Hard Rules` / `TOOLS.md` / `BOOTSTRAP.md` Round 4 repair | 8 | Hard Rules forbid `fs_write`; host copies in sync | PASS | § B6.3 |
| B6.4 | `tools.deny = ["write","edit","apply_patch"]` (Round 5) | 7 | `config.json5` + setup-script enforcement | PASS | § B6.4 |
| B6.5 | `commands.ownerAllowFrom = ["*"]` (Round 6) | 7 | Live config + setup-script persistence | PASS | § B6.5 |
| B6.6 | `tools.exec.host = "gateway"` (Round 7) | 8 | Self-probe no longer hits `exec host not allowed` | PASS | § B6.6 |
| B6.7 | Deny `sessions_spawn` / `subagents` / `sessions_yield` (Round 10) | 9 | `tools.deny` extended; `AGENTS.md` scrubbed; no `"noop"` / embedded-run timeout | PASS | § B6.7 |
| B6.8 | `sandbox.workspaceAccess: "rw"` (Round 11) | 6 | Host bind reaches in-container agent; `docker inspect` RW=true | PASS | § B6.8 |
| B6.9 | Creator TRUE E2E live run (Round 13) | 10 | `test-creator-e2e-live.ts` — Penny AP clerk deployed in ~110s via `openai/gpt-5.4` | **PASS 2026-04-19** | § B6.9 |
| B7 | EKG 4-pillar JSON5 schema | — | `sentura/config/ekg-schema.json5` — pillars, provenance, Experience Link format | PASS | § B7 |
| B8 | Industry ontologies (financial-services, e-commerce) | — | ≥ 11 files across pillars per ontology | PASS | § B8 |
| B9 | MCP Builder agent workspace | — | 8 natives + 4 skills (api-analysis, mcp-generation, smoke-test, register-server) | PASS | § B9 |
| B9.6 / B9.7 | MCP Builder `config.json5` Round-14 repair | — | `openai/gpt-5.4`; no path-glob `skills:`; Creator-parity `tools.deny` | PASS | § B9.6 / § B9.7 |
| B10 | Common skill library (5 skills) | — | `meeting-notes`, `document-summarization`, `escalation-handling`, `status-update`, `knowledge-base-lookup` | PASS | § B10 |
| B11 | Creator helper unit tests (offline) | 49 | `test-creator-helpers.ts` | **49/49 PASS** | § B11 |
| B12 | Live gateway integration | — | Harness runs against :18789 | PASS | § B12 |
| B13 | Creator TRUE E2E live — headline | — | See B6.9 | PASS | § B13 |
| B14 | Creator Phase 3 self-provisioning SKILL.md | 9 | `scripts/test-self-provisioning.ts T-OFF-1` — 9 pipeline steps, approval tiers, real `secrets.resolve` / `secrets.reload` RPC refs, browser nav, Safety section | PASS (2026-04-26) | [`tests/tests-person-b.md § B14`](tests/tests-person-b.md) |
| B15 | Provisioning templates (5 SaaS services) | 15 | `scripts/test-self-provisioning.ts T-OFF-2` — zendesk/hubspot/salesforce/notion/slack; required fields, tier assertions, no plaintext creds | PASS (2026-04-26) | § B15 |
| B16 | Self-provisioning E2E test script | 9 | `scripts/test-self-provisioning.ts T-OFF-3 through T-OFF-5 + T-LIVE-1 through T-LIVE-4` — offline structural + live gateway probe | PASS (2026-04-26) | § B16 |
| B17 | Tuner Agent skills (nl-to-config + workspace-edit) | 6 | `scripts/test-tuner-e2e.ts T-OFF-1 through T-OFF-6` — skill files present, Hard Rules intact, sandbox config | PASS (2026-04-26) | § B17 |
| B18 | Orchestrator Agent skills (task-decomposition + multi-agent-routing) | 4 | File presence + required section checks: sequential/parallel/conditional routing, T3/T4 data flow, traceable report | PASS (2026-04-26) | § B18 |
| B19 | Data Scavenger workspace completeness | 13 | File presence: `sentura/agents/data-scavenger/` — config.json5 + 8 native files + 4 skills (ingestion, classification, structuring, ekg-merge) | PASS (2026-04-26) | § B19 |
| B20 | Q&A Completion skill (capability #13 Tier 2) | 7 | `sentura/skills/qa-completion/SKILL.md` — gap types, 5-question cap, 7-day re-ask guard, pending MEMORY.md record format | PASS (2026-04-26) | § B20 |
| B21 | Experience Link extraction skill (capability #13 Tier 3) | 6 | `sentura/skills/experience-extraction/SKILL.md` — link JSON5 fields, confidence formula, promotion thresholds (0.75/0.9), dedup check | PASS (2026-04-26) | § B21 |
| B22 | Pre-deployment test harness (capability #15) | 8 | `sentura/config/test-harness-schema.json5` (5 schema types) + `sentura/skills/pre-deployment-testing/SKILL.md` (7 steps, passMark 0.75, block on Hard Rule failure) | PASS (2026-04-26) | § B22 |
| B23 | Personal memory isolation skill | 6 | `sentura/skills/personal-memory/SKILL.md` — dual-scope read priority, personal/general write rules, dreaming promotion (≥3 users), consolidation, privacy boundary table | PASS (2026-04-26) | § B23 |

### Person C — Frontend & Dashboard

| ID | Area | Cases | Method | Status | Detail |
|----|------|------:|--------|--------|--------|
| C1 | Dashboard build + lint | — | `cd sentura/dashboard && pnpm build && pnpm lint` | PASS | [`tests/tests-person-c.md § C1`](tests/tests-person-c.md) |
| C2 | Gateway client library | — | `src/lib/gateway/` — typed RPC wrappers | PASS | § C2 |
| C3 | React hooks | — | `src/lib/gateway/hooks.ts` | PASS | § C3 |
| C4 | App shell & navigation | — | Sidebar, routing, Control UI external links (hybrid) | PASS | § C4 |
| C5 | Enterprise Overview (`/`) | — | Landing page composition | PASS | § C5 |
| C6 | Employee Roster (`/employees`) | — | Reads `config.get` → `agents.list` | PASS | § C6 |
| C7 | Environment config | — | `.env.local` / build-time config | PASS | § C7 |
| C8 | Employee Creator page (`/create`) | — | Streaming via `sessions.create` + `chat.send` + `chat` events (`state: "delta"`/`"final"`) | PASS | § C8 |
| C9 | Employee Detail page (`/employees/[id]`) | — | 8 natives view (allow-list aware), bindings, lifecycle (Refresh / Tune (W3) / Edit in Control UI / Retire) | PASS | § C9 |
| C10 | Approval Queue (`/approvals`) | — | Seeds `exec.approval.list` + `plugin.approval.list`; subscribes to `*.approval.requested/resolved`; Approve-once / Always-allow / Deny | PASS | § C10 |

### Person D — Extensions & Integrations

| ID | Area | Cases | Method | Status | Detail |
|----|------|------:|--------|--------|--------|
| D1 | `sentura-audit` — unit tests | — | `vitest` under `openclaw/` | PASS | [`tests/tests-person-d.md § D1`](tests/tests-person-d.md) |
| D2 | `sentura-audit` — manual | — | Trigger tool call / approval / config change; verify audit log | PASS | § D2 |
| D3 | `sentura-rbac` — unit tests | 44 | 7-role model + scope + `userToken` + `withRbac` middleware + bootstrap escape hatch (`roles.test.ts`, `authorizer.test.ts`, `middleware.test.ts`) | PASS | § D3 |
| D4 | `sentura-rbac` — manual | — | Role-gated RPC verification against live gateway (deferred manual run — automated D3 covers all 7 roles) | PASS | § D4 |
| D5 | Approval policy configs | — | Tools-requiring-approval list + escalation rules present | PASS | § D5 |
| D6 | GradSale API study | — | `ekg/api-admin.md`, `ekg/api-web.md`, `ekg/database.md` read and summarized for MCP generation | PASS | § D6 |
| D7 | First enterprise MCP server — GradSale admin surface | 14 | `sentura/mcp-servers/gradsale-admin/src/tools.test.ts` — 29 tools covering every endpoint in `ekg/api-admin.md`; raw-shape inputs; readOnly-mode strip; handler-level cross-field validation; `@modelcontextprotocol/sdk` v1.29.0 | PASS (W2) | § D7 |
| D8 | MCP integration — agent uses GradSale tools | 4 | `sentura/mcp-servers/gradsale-admin/src/server.test.ts` — MCP `Client` + `InMemoryTransport` + stubbed `fetch`; Dispute Resolver walks `list_disputes` → `get_dispute` → `handle_dispute`; 4xx surfaces as `isError`; SDK-level UUID validation rejects bad input before handler runs | PASS (W2) | § D8 |
| D9 | API-docs → MCP-server → `config.patch` pattern documented | — | `docs/DESIGN.md` § "Enterprise MCP Server Pattern" (Section 14) + `sentura/mcp-servers/gradsale-admin/README.md` | PASS (W2) | § D9 |
| D10 | GradSale **web** MCP surface | — | Deferred to Week 3 with self-provisioning — admin surface (D7) unblocks Dispute Resolver / Support / Trust & Safety personas | WK3+ | (planned) |
| D11 | In-process employee registration bypasses scope-upgrade pairing | 6 | 1. `sentura_agents_manage { action: "register_agent", agentId, name, model, tools, bindings?, mcpServers? }` appends to `agents.list` in `openclaw.json` without any ws auth round-trip (no `pairing required` error). 2. Re-calling `register_agent` with `overwrite: false` is a no-op; with `overwrite: true` deep-merges `identity`/`tools`/`sandbox`/`runtime`/`params`. 3. `create_agent` auto-stamps `setupCompletedAt` into `<workspaceDir>/.openclaw/workspace-state.json` so a fresh employee is not bootstrap-pending on first boot. 4. `stamp_setup` action is idempotent (no-op if already stamped). 5. Gateway RPCs `sentura.agents.registerAgent` and `sentura.agents.stampSetupCompleted` mirror the tool. 6. Creator's source + deployed `skills/employee-deployment/SKILL.md`, `skills/incubation/SKILL.md`, `skills/workspace-generation/SKILL.md`, `TOOLS.md`, `SOUL.md` all reference `register_agent` (not `config.patch`) — `rg 'config\\.patch' sentura/agents/creator ~/.openclaw/workspace/creator` returns only read-only / don't-use mentions. | PASS (W2) | `docs/memory/person-d/week-2.md § 2026-04-19 — In-process employee registration` |
| D12 | Meta-agent native workspace files stay under the 12k injection limit | 5 | 1. `wc -c sentura/agents/{creator,tuner,orchestrator,mcp-builder}/{AGENTS,SOUL,TOOLS,IDENTITY,USER,HEARTBEAT,BOOTSTRAP,MEMORY}.md` — every file ≤ 12,000 bytes. 2. Same assertion for deployed copies under `~/.openclaw/workspace/{creator,tuner,orchestrator,mcp-builder}/`. 3. Gateway log must not contain `workspace bootstrap file X.md is <N> chars (limit 12000); truncating in injected context` — `rg 'truncating in injected context' /tmp/openclaw/openclaw-*.log` returns zero matches. 4. Deploy-critical instructions (the `sentura_agents_manage { register_agent }` tool-call sequence for Creator) are in the FIRST 8k chars of `AGENTS.md` so they survive any future truncation. 5. All NEVER/ALWAYS Hard Rules from the pre-shrink `AGENTS.md` (Round 14+) are still present after the shrink (policy-preservation diff). | PASS (W2) | `docs/memory/person-d/week-2.md § 2026-04-19 — Creator AGENTS.md truncation fix` |
| D13 | Forge tool-visibility probe + E2E CLI deploy regression (Round 19) | 4 | 1. **Tool-probe:** `node openclaw.mjs agent --agent creator --session-id tool-probe-$(date +%s) --message "List your tools comma-separated, do not call anything."` — reply contains **all three Sentura plugin tools** (`sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`) alongside core tools (`gateway`, `web_search`, `browser`, `read`, `process`, `sessions_*`, etc.). 2. **E2E deploy:** `node openclaw.mjs agent --agent creator --session-id deploy-test-$(date +%s) --timeout 300 --message "Deploy a new employee with this EXACT spec … Execute the 4-call sentura_agents_manage deployment sequence … Respond DEPLOYED followed by the 4 tool call names."` — Forge replies `DEPLOYED create_agent, write, register_agent, stamp_setup` within 300s; gateway log shows a single `Config overwrite: /Users/henry/.openclaw/openclaw.json (sha256 … → …, backup=…)` line and zero `Sandbox path is read-only`, `pairing required`, `raw required`, or `exec host not allowed` errors. 3. **Post-deploy disk check:** `~/.openclaw/workspace/<id>/` contains all 8 native files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) plus `.openclaw/workspace-state.json` with `setupCompletedAt` ISO-8601 timestamp + `version: 1`. 4. **Registration match:** `openclaw.json → agents.list[id=<id>]` has `model`, `tools.profile`, `sandbox.mode`, `runtime.type`, and `params.{role,tone,channels,dataSources,allowedActions,blockedActions,escalateTo}` exactly matching the input spec; Hard Rules in the generated `AGENTS.md` include every blocked action from the spec verbatim. | PASS (W2) | [`tests/tests-person-d.md § D-CRE-19`](tests/tests-person-d.md#d-cre-19-forge-tool-visibility-probe--e2e-cli-deploy-regression-round-19) |
| D14 | Meta-agent sandbox tool-policy allowlist (Round 20) | 6 | 1. **Source config present (all 4 meta-agents):** `sentura/agents/{creator,tuner,orchestrator,mcp-builder}/config.json5` each include a `tools.sandbox.tools.alsoAllow` array containing at minimum the plugin tools that agent also declares in agent-level `tools.alsoAllow` (e.g. Creator: `gateway`, `sessions_send`, `web_search`, `web_fetch`, `browser`, `pdf`, `canvas`, `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`, `memory_search`, `memory_get`, `cron`, `update_plan`, `image_generate`, `video_generate`). 2. **Live config mirrored:** `~/.openclaw/openclaw.json` → `agents.list[id=<meta>].tools.sandbox.tools.alsoAllow` matches the source for every meta-agent. 3. **Setup script parity:** `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` both contain per-agent `*SandboxAlsoAllow` arrays for all four meta-agents and the embedded overrides block injects `tools.sandbox.tools.alsoAllow` on every re-run (idempotent — a second run is a no-op diff on the relevant keys). 4. **Gateway view:** `npx tsx scripts/probe-creator-tools.ts` reports ≥ 21 effective tools for `creator` including `sentura_agents_manage`. 5. **Runner view (dashboard path):** `npx tsx scripts/probe-chat-send.ts` drives a `chat.send` session and the gateway log (`/tmp/openclaw/openclaw-YYYY-MM-DD.log`) does NOT contain a `sandbox tools.allow 21->7` drop; agent's effective tool list contains `sentura_agents_manage`. 6. **Docs in sync:** `docs/SETUP.md`, `docs/OPENCLAW.md`, and `docs/DESIGN.md` each contain a "Sandbox tool-policy filter" section and `README.md` links to both from its "Key Documentation" block. | PASS (W2) | [`tests/tests-person-d.md § D-SAND-01`](tests/tests-person-d.md#d-sand-01-meta-agent-sandbox-tool-policy-allowlist-round-20) |

### Documentation Hygiene

| ID | Area | Cases | Method | Status | Detail |
|----|------|------:|--------|--------|--------|
| DOC1 | Mandatory context ≤ 1,500 lines | 1 | `wc -l README.md docs/MEMORY.md docs/TeamPlan.md docs/TESTS.md` sum | PASS | Doc Compression + Memory Reorg — MEMORY.md dropped from 3,637 → ~107 lines |
| DOC2 | On-demand banners present | 1 | `rg -l 'On-demand reference — not read by default' docs/ ekg/ Documents/` returns ≥ 19 files | PASS | DESIGN.md, OPENCLAW.md, 6 × ekg/*.md, Demo.md, 11 × `docs/memory/**/*.md` |
| DOC3 | RULES.md / CONTEXT.md never materialized | 1 | `find . -name RULES.md -o -name CONTEXT.md` outside `node_modules/`/`openclaw/` returns nothing | PASS | Historical invariant |
| DOC4 | All 14 bug-fix rounds preserved | 1 | Grep for the 14 round headings in `docs/memory/shared/creator-deployment-rounds-1-14.md`; rounds-table rows in `docs/TeamPlan.md` and matrix row in `docs/MEMORY.md` | PASS | Round numbers + titles verbatim |
| DOC5 | TESTS.md matrix ↔ `docs/tests/` detail files consistent | manual | Every matrix row's "Detail" column links to a real section in the corresponding file | PASS | — |
| DOC6 | MEMORY matrix ↔ `docs/memory/**/*.md` detail files consistent | 1 | Every `## 2026-*` heading present in the original `docs/MEMORY.md` appears in exactly one file under `docs/memory/`; every matrix row in `docs/MEMORY.md` links to a real file | PASS | Memory Reorg 2026-04-19 — 40/40 headings accounted for |

### Cross-Team Integration

| ID | Scenario | Owners | Method | Status | Detail |
|----|----------|--------|--------|--------|--------|
| X1 | Setup → register meta-agent → dashboard shows it | A + C | `sentura-setup.sh` → dashboard `/employees` list | PASS | [`tests/tests-cross-team.md § X1`](tests/tests-cross-team.md) |
| X2 | Creator NL → new employee visible in dashboard | B + C | `/create` chat with Forge → Penny-style brief → `agents.list` refresh | PASS (2026-04-19) | § X2 |
| X3 | Approval flow — tool call blocked → approved → retried | B + C + D | Trigger high-risk tool → `/approvals` approve → agent retries | PASS | § X3 |
| X4 | Per-user memory — two users same agent, isolated traces | A + B + D | Bind two sessions with different `userToken`; check memory queries separate | PASS | § X4 |
| X5 | Sandbox seed hook — fresh meta-agent sees customized BOOTSTRAP.md + skills | A + B | Chat Forge: "list files in skills/" and "show BOOTSTRAP.md" | PASS | § X5 |
| X6 | Deployment pipeline — Creator deploys via gateway RPCs only (no `fs_write`) | A + B + D | Fresh Forge deploy; watch logs for `Sandbox path is read-only` (must not appear) | PASS | § X6 |

---

## Test Results Summary Template

When running a full pass, fill this in:

```
Person A: N/20 sections PASS (cases: ?/? — A16-A19 offline 19/19; A20.1 live PASS 2026-04-26; A20.2 doc-sync PASS)
Person B: N/23 sections PASS (cases: ?/? — B11 49/49 offline; B14–B23 Week 3 added 2026-04-26)
Person C: N/10 sections PASS
Person D: N/14 sections PASS (D3 44 unit + D7 14 unit + D8 4 e2e = 62 auto cases green at W2 close; +D11/D12/D13/D14 Round-17/18/19/20 Creator deploy regression — D14 expanded to 6 checks to cover all 4 meta-agents + setup-script parity + docs sync)
Cross-team: N/6 scenarios PASS
Last live E2E (Creator): 2026-04-20 — billing-support-rep deployed in ~80s via Forge's 4-call `sentura_agents_manage` sequence (openai/gpt-5.4); prior: 2026-04-19 — penny-ap deployed in ~110s
```

---

## Contributor Policy (from `.cursorrules` rule 3)

When you add, change, or remove a testable deliverable:

1. Add/update the row in the matrix above **and** add/update the detailed cases in the corresponding `docs/tests/tests-person-*.md` file (or `tests-cross-team.md` if it spans people).
2. Keep the `Last updated` date current.
3. Never remove cases for existing behavior — only add, update, or mark as superseded.
4. If a new script is introduced, add it under "How to Run Tests".
