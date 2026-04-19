# Sentura Platform — Test Matrix

> **Single source of truth for what to test.** Summary matrix only; detailed test cases (methods, expected outputs, assertions) live in per-person files under [`docs/tests/`](tests/) and are read on demand.
>
> **Last updated**: 2026-04-19 (Memory Reorg Pass: `docs/MEMORY.md` became a per-person / per-week matrix pointing at `docs/memory/person-*/week-*.md` + `docs/memory/shared/*.md`; DOC6 added below). Prior: 2026-04-19 (Doc Compression Pass: TESTS.md rewritten as matrix; full detail moved to `docs/tests/tests-person-{a,b,c,d}.md` + `tests-cross-team.md`). 2026-04-20 (Week 2 audit round 14 — B9.6/B9.7 MCP Builder config repair). 2026-04-19 (round 13 — B6.9 Creator E2E live PASSED). 2026-04-18 (round 11 — B6.8 sandbox `workspaceAccess: "rw"`). 2026-04-17 through 2026-04-18 (rounds 4–10 — B6.3–B6.7). Earlier rounds: A14 sandbox seed hook, A15 `sentura-agents` extension + C8/C9/C10 pages.

---

## How to Run Tests

### Automated Unit Tests (Person D extensions)

```bash
cd openclaw && npx vitest run --config vitest.sentura.config.ts
```

Watch mode: `cd openclaw && npx vitest --config vitest.sentura.config.ts`
Single file: `cd openclaw && npx vitest run --config vitest.sentura.config.ts redaction`

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
| D3 | `sentura-rbac` — unit tests | — | 7-role model, scope, `userToken` | **PEND** | § D3 |
| D4 | `sentura-rbac` — manual | — | Role-gated RPC verification | **PEND** | § D4 |
| D5 | Approval policy configs | — | Tools-requiring-approval list + escalation rules present | PASS | § D5 |
| D6 | GradSale API study | — | `ekg/api-admin.md`, `ekg/api-web.md`, `ekg/database.md` read and summarized for MCP generation | PASS | § D6 |
| D7 | First enterprise MCP server (GradSale admin + web) | — | `@modelcontextprotocol/sdk` wrap; registered via `config.patch` | **PEND** | (new, W2) |
| D8 | MCP integration — agent uses GradSale tools | — | End-to-end conversation with an employee consuming the MCP | **PEND** | (new, W2) |

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
Person A: N/15 sections PASS (cases: ?/? )
Person B: N/21 sections PASS (cases: ?/? — B11 49/49 offline)
Person C: N/10 sections PASS
Person D: N/8  sections PASS
Cross-team: N/6 scenarios PASS
Last live E2E (Creator): 2026-04-19 — penny-ap deployed in ~110s (openai/gpt-5.4)
```

---

## Contributor Policy (from `.cursorrules` rule 3)

When you add, change, or remove a testable deliverable:

1. Add/update the row in the matrix above **and** add/update the detailed cases in the corresponding `docs/tests/tests-person-*.md` file (or `tests-cross-team.md` if it spans people).
2. Keep the `Last updated` date current.
3. Never remove cases for existing behavior — only add, update, or mark as superseded.
4. If a new script is introduced, add it under "How to Run Tests".
