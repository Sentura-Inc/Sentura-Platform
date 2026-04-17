# Sentura Platform — Test Documentation

> **Scope**: All deliverables from Weeks 1–2 across all four team members.
>
> **Last updated**: 2026-04-16 (B11 scope note + B13 stub added; misleading "E2E" claims corrected to "helper validation"; memory-isolation claim softened to design intent)

---

## How to Run Tests

### Automated Unit Tests (Person D Extensions)

```bash
cd openclaw && npx vitest run --config vitest.sentura.config.ts
```

Watch mode (re-runs on save):

```bash
cd openclaw && npx vitest --config vitest.sentura.config.ts
```

Run a specific test file:

```bash
cd openclaw && npx vitest run --config vitest.sentura.config.ts redaction
cd openclaw && npx vitest run --config vitest.sentura.config.ts authorizer
```

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

---

## Person A — Platform & OpenClaw Engineer

### A1. OpenClaw Build & Runtime

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A1.1 | OpenClaw builds from source | `cd openclaw && pnpm install && pnpm ui:build && pnpm build` | Exit code 0, no TypeScript errors |
| A1.2 | Onboard completes | `cd openclaw && pnpm openclaw onboard` | Wizard completes; `~/.openclaw/openclaw.json` created; gateway token set |
| A1.3 | Gateway starts | `cd openclaw && pnpm gateway:watch` | Gateway process starts; health endpoint responds |
| A1.4 | Health check | `curl http://localhost:18789/healthz` | Returns 200 OK with JSON body |
| A1.5 | Control UI loads | Open `http://localhost:18789` in browser | OpenClaw Control UI renders with sidebar navigation |
| A1.6 | LLM provider works | Send a test message via Control UI chat | Agent responds with LLM-generated text (not an error) |
| A1.7 | WebChat channel | Use Control UI chat or WebSocket client | Messages round-trip through the gateway |

### A2. Sentura Setup Script (`scripts/sentura-setup.sh`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A2.1 | Script runs cleanly | `./scripts/sentura-setup.sh` (after onboard) | Exit code 0; summary printed with "Setup complete" |
| A2.2 | Meta-agent workspaces copied | `ls ~/.openclaw/workspace/{creator,tuner,orchestrator}/` | All 7+ workspace files present in each directory |
| A2.3 | Agents registered | `cd openclaw && pnpm openclaw agents list --json` | Output includes `creator`, `tuner`, `orchestrator` agent IDs |
| A2.4 | Config patched | `cd openclaw && pnpm openclaw config get` | `agents.list` contains entries for all three meta-agents; `agents.defaults.workspace` is set |
| A2.5 | Bootstrap hook installed | `ls ~/.openclaw/hooks/sentura-bootstrap/` | `handler.ts` and `HOOK.md` present |
| A2.6 | Hook enabled in config | `cd openclaw && pnpm openclaw config get` | `hooks.internal.entries.sentura-bootstrap` exists and is enabled |
| A2.7 | Idempotency | Run `./scripts/sentura-setup.sh` a second time | Exit code 0; no duplicate agents; config unchanged; no errors |
| A2.8 | Pre-flight failure | Remove `~/.openclaw/openclaw.json`, then run script | Script exits with clear error message about missing config |

### A3. Sentura Bootstrap Hook (`sentura/hooks/sentura-bootstrap/handler.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A3.1 | RULES.md injection | Create an agent workspace with RULES.md, start a session | System prompt includes RULES.md content (verify via session transcript or `sessions.preview`) |
| A3.2 | CONTEXT.md injection | Create an agent workspace with CONTEXT.md, start a session | System prompt includes CONTEXT.md content |
| A3.3 | Missing files skipped | Create an agent workspace without RULES.md or CONTEXT.md | No errors; agent boots normally; only standard 8 files in prompt |
| A3.4 | Empty files skipped | Create RULES.md with only whitespace content | File is not appended to bootstrapFiles (whitespace-only = absent) |
| A3.5 | Non-bootstrap events ignored | Other hook events fire during normal operation | Hook returns without modification; no errors in gateway logs |

### A4. Week 2 — Workspace Creation Library (`sentura/lib/workspace.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A4.1 | createWorkspace creates all dirs | Call `createWorkspace({ agentId: "test-agent" })` | Creates workspace dir, skills/, ekg/{org,rules,assets,workflows,workflows/experience-links}/, memory/users/ |
| A4.2 | All 10 workspace files created | Call `createWorkspace()` then list files | AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md, RULES.md, CONTEXT.md all exist |
| A4.3 | Template files used when provided | Call `createWorkspace({ templateDir: "sentura/config/templates/cs-agent" })` | Files come from template, not defaults |
| A4.4 | Existing files not overwritten | Create SOUL.md manually, call `createWorkspace()` | Pre-existing SOUL.md content preserved |
| A4.5 | Industry ontology merge | Call with `industryOntologyDir` pointing to e-commerce ontology | EKG pillar files from ontology copied into agent's ekg/ |

### A5. Week 2 — Agent Registration (`sentura/lib/agent-registration.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A5.1 | buildAgentPatch output | Call `buildAgentPatch()` with full registration | Returns valid JSON with `agents.list[]` array, bindings, mcp.servers |
| A5.2 | registerAgentOnDisk adds agent | Call `registerAgentOnDisk()` | Agent appears in config.agents.list |
| A5.3 | registerAgentOnDisk deduplicates | Call twice with same agentId | Agent appears only once; second call updates existing |
| A5.4 | isAgentRegistered check | Register agent then check | Returns true for registered, false for unregistered |
| A5.5 | buildGatewayToolCall format | Call `buildGatewayToolCall()` | Returns { tool: "gateway", action: "config.patch", params: { raw: "...", note: "..." } } |
| A5.6 | buildMemoryDbPath format | Call `buildMemoryDbPath("test-agent")` | Returns `~/.openclaw/memory/test-agent/lancedb` |

### A6. Week 2 — Hot-Reload Verification (`scripts/test-hot-reload.sh`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A6.1 | Script runs cleanly | `./scripts/test-hot-reload.sh` | Exit code 0; all 6 steps pass; cleanup removes test agent |
| A6.2 | Workspace structure correct | Script step 4 | All workspace files and ekg/ + memory/users/ dirs verified |
| A6.3 | Memory isolation verified | Script step 5 | Agent has unique memoryDbPath in params |

### A7. Week 2 — MCP Loopback Configuration (`scripts/configure-mcp-loopback.sh`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A7.1 | Script configures loopback | `./scripts/configure-mcp-loopback.sh` | Exit code 0; `mcp.servers.openclaw-loopback` in config |
| A7.2 | Idempotent | Run twice | Second run detects existing config; no duplicates |

### A8. Week 2 — Channel Binding Helpers (`sentura/lib/channel-bindings.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A8.1 | createWebchatBinding | Call function | Returns correct binding with `channel: "webchat"`, `peer: { kind: "dm", id: "*" }` |
| A8.2 | createSlackChannelBinding | Call function | Correct Slack channel binding with peer kind "channel" |
| A8.3 | createDiscordBinding | Call with guildId and roles | Includes guildId and roles in match |
| A8.4 | addBindingsOnDisk deduplicates | Add same binding twice | Only one copy in config |
| A8.5 | removeAgentBindingsOnDisk | Remove bindings for agent | All bindings for that agentId removed; others preserved |

### A9. Week 2 — Per-Agent LanceDB Isolation (`sentura/lib/memory-isolation.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A9.1 | agentMemoryDbPath format | Call with agent ID | Returns `~/.openclaw/memory/{agentId}/lancedb` |
| A9.2 | applyMemoryIsolationOnDisk | Call on config with 3 agents | All 3 agents get unique memoryDbPath in params |
| A9.3 | validateMemoryIsolation | Call after isolation applied | All agents in `isolated` array; `shared` array empty |
| A9.4 | Setup script sets dbPath | Run `sentura-setup.sh` | Meta-agents have memoryDbPath set in config |

### A10. Week 2 — User Token Infrastructure (`sentura/lib/user-token.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A10.1 | generateUserToken format | Call function | Returns valid UUID v4 |
| A10.2 | buildSessionKey format | Call with agentId and userToken | Returns `agent:{agentId}:user:{userToken}:{sessionId}` |
| A10.3 | parseSessionKey roundtrip | Build then parse | All components (agentId, userToken, sessionId) correctly extracted |
| A10.4 | isUserSession check | Build key, check with correct/wrong token | Returns true for matching token, false for different |
| A10.5 | hashUserToken deterministic | Hash same token twice | Same 16-char hex output both times |
| A10.6 | userMemoryFilePath format | Call with workspace dir and token | Returns `{workspaceDir}/memory/users/MEMORY_USER_{token}.md` |
| A10.7 | ensureUserMemoryFile creates | Call function | File and directory created if not exists |

### A11. Week 2 — RBAC 7-Role Model Update

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A11.1 | 7 roles defined | Read `sentura/extensions/sentura-rbac/src/roles.ts` | `ROLE_DEFINITIONS` has exactly 7 entries |
| A11.2 | Role IDs correct | Check role IDs | `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer` |
| A11.3 | userToken in SenturaUser | Read `src/types.ts` | `SenturaUser` interface includes `userToken: string` |
| A11.4 | getUserByToken works | Read `src/store.ts` | `getUserByToken()` method exists and searches by userToken |
| A11.5 | Upsert auto-assigns token | Read `index.ts` upsert handler | New users get `crypto.randomUUID()` userToken; existing users keep their token |
| A11.6 | resolveByToken RPC | Read `index.ts` | `sentura.rbac.users.resolveByToken` method registered |
| A11.7 | Bootstrap hook injects user memory | Read bootstrap handler.ts | Extracts userToken from session key, injects MEMORY_USER_{token}.md |

### A12. Documentation Accuracy

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A12.1 | docs/SETUP.md steps work | Follow every step in `docs/SETUP.md` on a clean checkout | All commands succeed; final verification checklist passes |
| A12.2 | Gateway RPC doc accuracy | Test documented methods against live gateway | `config.get`, `agents.list`, `sessions.list`, `health` return expected shapes |
| A12.3 | Monorepo scripts | `pnpm run build`, `pnpm test`, `pnpm lint` from root | Each script runs without error (or skips gracefully if no sub-packages define the script) |
| A12.4 | pnpm workspaces | `pnpm -r list` from root | Lists `sentura/dashboard` and `sentura/extensions/*` packages |

### A13. Week 2 — Gateway Integration Tests (`scripts/test-gateway-integration.ts`)

Run: `npx tsx scripts/test-gateway-integration.ts` (requires gateway running at localhost:18789)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A13.1 | Gateway handshake | WebSocket challenge-response with TUI client identity | Connection succeeds; no origin or scope errors |
| A13.2 | config.get reads live config | RPC `config.get` | Returns config object + hash; agents.list is an array |
| A13.3 | Meta-agents registered | Parse agents from config.get | creator, tuner, orchestrator all present |
| A13.4 | Memory isolation live | Check memoryDbPath for each meta-agent | Each has unique path containing agent ID |
| A13.5 | config.patch registers agent | RPC `config.patch` with baseHash | Temp agent appears in subsequent config.get |
| A13.6 | config.patch fields correct | Read temp agent config after patch | name, memoryDbPath, sandbox.mode all match |
| A13.7 | Temp agent cleanup | Remove test agent from config file | Agent count decreases by 1 |
| A13.8 | Bootstrap hook config | Check hooks.internal.entries in live config | sentura-bootstrap exists and is enabled |
| A13.9 | Workspace RULES.md present | Verify RULES.md in each meta-agent workspace | All 3 workspaces have RULES.md |
| A13.10 | Workspace CONTEXT.md present | Verify CONTEXT.md in each meta-agent workspace | All 3 workspaces have CONTEXT.md |
| A13.11 | HTTP health endpoint | GET /health | Returns 200 with status field |

---

## Person B — AI Employee & Skills Engineer

### B1. Creator Agent Workspace

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B1.1 | All workspace files present | `ls sentura/agents/creator/` | Contains: SOUL.md, AGENTS.md, IDENTITY.md, BOOTSTRAP.md, HEARTBEAT.md, TOOLS.md, USER.md |
| B1.2 | Skills directory | `ls sentura/agents/creator/skills/` | Contains 3 subdirectories: `incubation/`, `role-research/`, `workspace-generation/` |
| B1.3 | Each skill has SKILL.md | `ls sentura/agents/creator/skills/*/SKILL.md` | All 3 skill files exist and are non-empty |
| B1.4 | SOUL.md identity | Read `sentura/agents/creator/SOUL.md` | Contains agent name "Forge", 5-phase incubation mission, operating principles |
| B1.5 | AGENTS.md protocol | Read `sentura/agents/creator/AGENTS.md` | Contains phases 1-5, output format, red lines; references `agents.list` array (not object map) |
| B1.6 | config.json5 valid schema | Read `sentura/agents/creator/config.json5` | Uses `agents.list[]` array; `id: "creator"`; `tools.profile: "coding"`; no `workspace` field; no `systemPrompt` field |
| B1.7 | No incorrect schema patterns | Grep all config.json5 files for `agents.entries`, `systemPrompt`, `tools.allowlist` | Zero matches — these are the old incorrect schema patterns |
| B1.8 | Creator Agent loads | After setup script, start a session with the Creator agent | Agent responds; identifies itself as Forge; knows its incubation protocol |

### B2. Workspace Convention (`docs/workspace-convention.md`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B2.1 | All 10 files documented | Read `docs/workspace-convention.md` | Documents all 8 OpenClaw files + RULES.md + CONTEXT.md + skills/ directory |
| B2.2 | File priority order | Check convention doc | Priority chain: RULES.md > Skills Safety > SOUL.md Escalation > AGENTS.md Red Lines > CONTEXT.md > SOUL.md Personality |
| B2.3 | Runtime vs design-time | Check convention doc | Explains `workspaces/` in git = reference, `~/.openclaw/workspace/` = runtime, `sentura/config/templates/` = starting templates |
| B2.4 | No `workspace` field rule | Check convention doc | Explicitly states: omit `workspace` from agent configs; let OpenClaw resolve to `~/.openclaw/workspace/{agent-id}/` |
| B2.5 | Cross-team notes | Check convention doc | Contains guidance for Person C (dashboard display), Person D (extension interaction) |

### B3. Role Templates

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B3.1 | Three templates exist | `ls sentura/config/templates/` | Contains `ap-clerk/`, `cs-agent/`, `sdr/` directories + `README.md` |
| B3.2 | Template structure | `ls sentura/config/templates/cs-agent/` | Contains: config.json5, SOUL.md, RULES.md, CONTEXT.md, skills/ directory with at least 2 skills |
| B3.3 | Placeholders used | Grep templates for `{` placeholder pattern | All templates use `{placeholder}` convention for customizable values (e.g. `{agent-id}`, `{company-name}`) |
| B3.4 | Config schema correct | Read each template's config.json5 | Uses `agents.list[]` array format; no `workspace` field; no `systemPrompt`; appropriate `tools.profile` and deny lists |
| B3.5 | AP Clerk tools | Read `sentura/config/templates/ap-clerk/config.json5` | Allows `pdf` tool; denies `browser`, `exec`, `gateway` |
| B3.6 | CS Agent tools | Read `sentura/config/templates/cs-agent/config.json5` | `minimal` profile; allows `web_search`, `web_fetch`; denies `exec`, `gateway` |
| B3.7 | SDR tools | Read `sentura/config/templates/sdr/config.json5` | Allows `browser` (for research/outreach); denies `exec`, `gateway` |
| B3.8 | Template README | Read `sentura/config/templates/README.md` | Documents template structure, placeholder convention, how to add new templates |

### B4. Platform Skills

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B4.1 | Self-provisioning skill exists | `ls sentura/skills/self-provisioning/SKILL.md` | File exists and is non-empty |
| B4.2 | Self-provisioning procedure | Read the skill | Contains 8-step procedure; approval routing table; error handling for CAPTCHA/2FA/rate limits; secret store naming convention |
| B4.3 | No secrets in workspace rule | Read the skill | Explicitly states credentials go to secret store, never workspace files or conversation |
| B4.4 | Knowledge-curation skill exists | `ls sentura/skills/knowledge-curation/SKILL.md` | File exists and is non-empty |
| B4.5 | Knowledge classification | Read the skill | Documents classification routing: procedural → SKILL.md, contextual → CONTEXT.md, safety → RULES.md (with approval), reference → data/ |
| B4.6 | Source handling | Read the skill | Handles URLs, PDFs, API docs, verbal descriptions |

### B5. Test Employee (GradSale CS Agent)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B5.1 | Workspace files present | `ls workspaces/cs-agent-gradsale/` | All 10 workspace files + config.json5 + skills/ directory present |
| B5.2 | GradSale context | Read CONTEXT.md and RULES.md | References real GradSale entities (listings, transactions, disputes) from `ekg/` docs |
| B5.3 | Skills reference real APIs | Read `skills/support-triage/SKILL.md` and `skills/dispute-resolution/SKILL.md` | Reference actual GradSale admin API endpoints from `ekg/api-admin.md` |
| B5.4 | MCP server references | Read config.json5 | Contains `mcp.servers` for `gradsale-admin` and `gradsale-web`; secrets use env var references (`$secret.`) |
| B5.5 | Config schema correct | Read config.json5 | Uses `agents.list[]` format; no `workspace` field; denies `exec`, `gateway`, `browser` |

### B6. Creator Agent Phase Skills (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.1 | Phase 1 skill exists | `ls sentura/agents/creator/skills/research-and-discovery/SKILL.md` | Non-empty; has sections When to Use, Procedure (7+ steps), Tools Needed, Safety |
| B6.2 | Phase 1 covers clarifying Qs | Read skill | Contains numbered clarifying questions list; industry classification step; memory search step |
| B6.3 | Phase 2 skill exists | `ls sentura/agents/creator/skills/employee-design/SKILL.md` | Non-empty; produces a design bundle with config, bindings, MCP refs, workspace files, EKG, pluginConfig |
| B6.4 | Phase 2 enforces isolation | Grep skill for `memory-lancedb` and `dbPath` | Mandates per-agent `memory-lancedb.dbPath` in plugin config |
| B6.5 | Phase 2 enforces RULES/CONTEXT | Read skill | Step 7 generates both RULES.md and CONTEXT.md with explicit categories and minimum 3 rules per category |
| B6.6 | Phase 4 skill exists | `ls sentura/agents/creator/skills/employee-deployment/SKILL.md` | Non-empty; covers preconditions, workspace write, plugin config, config.patch, smoke test, rollback |
| B6.7 | Phase 4 enforces smoke test | Grep skill | Includes smoke test step with session spawn + validation + rollback on failure |
| B6.8 | Phase 4 includes audit | Grep skill for `sentura.audit` | Includes `agent.deployed` audit log entry with caller userToken |

### B7. EKG Schema (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B7.1 | Schema reference exists | `ls sentura/config/ekg-schema.json5` | File present and non-empty |
| B7.2 | 4 pillars documented | Grep schema | Documents org/, rules/, assets/, workflows/ pillars |
| B7.3 | Experience Link format | Grep schema | Includes pattern, observation, confidence, occurrences fields |
| B7.4 | Provenance fields | Grep schema | Includes source document, ingestion date, confidence score |
| B7.5 | Industry Ontology format | Grep schema | Documents merge semantics and template format |

### B8. Industry Ontologies (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B8.1 | Financial-services template | `ls sentura/config/industry-ontologies/financial-services/{org,rules,assets,workflows}/` | All 4 pillars populated with JSON5 files + README.md |
| B8.2 | Financial-services rules | Read `rules/financial-controls.json5` + `rules/compliance.json5` | Includes SOX, AML/KYC, PCI-DSS, 3-way match, payment thresholds |
| B8.3 | E-commerce template | `ls sentura/config/industry-ontologies/e-commerce/{org,rules,assets,workflows}/` | All 4 pillars populated with JSON5 files + README.md |
| B8.4 | E-commerce rules | Read `rules/consumer-protection.json5` + `rules/fraud-detection.json5` | Includes return/refund, chargeback, MAP, velocity checks |

### B9. MCP Builder Agent (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B9.1 | Workspace complete | `ls sentura/agents/mcp-builder/` | Contains config.json5 + all 10 workspace files (AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, BOOTSTRAP, MEMORY, RULES, CONTEXT) |
| B9.2 | Four skills present | `ls sentura/agents/mcp-builder/skills/*/SKILL.md` | api-analysis, mcp-generation, smoke-test, register-server |
| B9.3 | Config schema correct | Read config.json5 | `agents.list[]`; `sandbox.mode = "non-main"`; `tools.profile = "coding"` with explicit gateway/web/browser allow |
| B9.4 | SOUL identity | Read SOUL.md | Name "Smith"; mission of generating MCP servers from API docs |
| B9.5 | RULES prohibitions | Read RULES.md | NEVER embed secrets; NEVER destructive ops without approval; ALWAYS RBAC verify |

### B10. Common Skill Library (Week 2)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B10.1 | Library directory | `ls sentura/config/templates/_common/skills/` | 5 skill directories: meeting-notes, document-summarization, escalation-handling, status-update, knowledge-base-lookup |
| B10.2 | Each has SKILL.md | `find sentura/config/templates/_common/skills -name SKILL.md` | 5 files, all non-empty |
| B10.3 | Skill format | Read each SKILL.md | Contains When to Use, Procedure (numbered), Tools Needed, Safety sections |
| B10.4 | Library README | Read `sentura/config/templates/_common/README.md` | Lists all 5 skills; documents placeholder convention |
| B10.5 | Templates README updated | Read `sentura/config/templates/README.md` | References `_common/` library and the 5 common skills |

### B11. Creator Agent Helper Validation (Week 2)

> **Scope note:** This suite validates the *deterministic helper functions*
> (`sentura/lib/workspace.ts`, `sentura/lib/agent-registration.ts`,
> `sentura/lib/channel-bindings.ts`) with a hard-coded brief and design
> bundle. It is **NOT** a true LLM end-to-end test — no LLM is invoked and
> the Creator Agent's `SKILL.md` files are not executed. For a real
> LLM-driven Creator run, see the `B13. Creator Agent TRUE E2E` stub below.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B11.1 | Helpers script runs | `npx tsx scripts/test-creator-helpers.ts` | Exits 0; reports 49/49 passed |
| B11.2 | 10 workspace files produced | Inspect output | All 10 files created in temp workspace |
| B11.3 | EKG pillars created | Inspect output | org/, rules/, assets/, workflows/, workflows/experience-links/ all present |
| B11.4 | Industry ontology merged | Inspect output | roles.json5, financial-controls.json5, systems.json5, sops.json5 present in ekg/ |
| B11.5 | Skills copied | Inspect output | invoice-processing and vendor-management skills in skills/ |
| B11.6 | config.patch shape | Inspect output | Uses `agents.list[]`; has bindings, mcp.servers, plugins.entries."memory-lancedb".config.dbPath; uses `$secret.` references |
| B11.7 | Per-agent memory `dbPath` *emitted in patch* | Inspect output | `dbPath === "~/.openclaw/memory/{agentId}/lancedb"`. **Design-intent only** — the live `memory-lancedb` plugin currently treats `dbPath` as a single global setting; per-agent isolation today is collection-level (via `agentId` filtering), not per-file. |

### B13. Creator Agent TRUE E2E — Live LLM (Week 2, STUB)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B13.0 | Gate behaviour | `npx tsx scripts/test-creator-e2e-live.ts` (no env) | Prints "Skipped: SENTURA_LLM_E2E != 1" and exits 0 |
| B13.1 | Live Creator run (opt-in) | `SENTURA_LLM_E2E=1 npx tsx scripts/test-creator-e2e-live.ts` | Sends NL brief to `creator` agent; polls `config.get` for up to 5 min; passes if a new agent appears. Requires running gateway + provider creds. |

This test is **not run by default** and is not counted in the passing
total. It is the forward-looking harness for validating that the
Creator Agent actually works as an LLM-driven agent end-to-end.

#### B6–B11 Detailed Run Commands & Expected Outputs

All commands assume repo root (`/Users/henry/Desktop/Sentura-Platform`) and
Node 22+. No gateway required for B6–B11; these are purely structural /
offline tests.

**One-shot driver that covers B6.1–B11.7 (49 assertions):**

```bash
npx tsx scripts/test-creator-helpers.ts
```

Expected final output:

```
[SECTION] Summary
  Passed: 49
  Failed: 0
  Total:  49

[OK] All Creator Agent end-to-end tests passed.
```

Exit code `0` on full pass; non-zero otherwise.

**B6 — Per-skill quick checks:**

```bash
# B6.1 / B6.3 / B6.6 — all three phase skills present & non-trivial
wc -l sentura/agents/creator/skills/{research-and-discovery,employee-design,employee-deployment}/SKILL.md
# Expected: each file > 80 lines; none empty.

# B6.2 — clarifying Qs + memory-search procedure in Phase 1
rg -n "clarifying|memory.search|industry" sentura/agents/creator/skills/research-and-discovery/SKILL.md | head -20

# B6.4 — Phase 2 enforces per-agent memory isolation
rg -n "memory-lancedb|dbPath" sentura/agents/creator/skills/employee-design/SKILL.md
# Expected: at least one hit referencing `memory-lancedb.dbPath` with a per-agent template.

# B6.5 — Phase 2 generates RULES + CONTEXT
rg -n "RULES\.md|CONTEXT\.md" sentura/agents/creator/skills/employee-design/SKILL.md

# B6.7 — smoke test + rollback in Phase 4
rg -n "smoke.test|rollback|sessions.create" sentura/agents/creator/skills/employee-deployment/SKILL.md

# B6.8 — audit trail written on deploy
rg -n "sentura\.audit|agent\.deployed" sentura/agents/creator/skills/employee-deployment/SKILL.md
```

**B7 — EKG schema documentation:**

```bash
# B7.1 — file present
ls -l sentura/config/ekg-schema.json5

# B7.2 — all 4 pillars documented
rg -n "^//.*(org|rules|assets|workflows)/" sentura/config/ekg-schema.json5

# B7.3 — Experience Link fields
rg -n "pattern|observation|confidence|occurrences" sentura/config/ekg-schema.json5 | head

# B7.4 — provenance fields
rg -n "source|ingested|confidence" sentura/config/ekg-schema.json5

# B7.5 — industry ontology merge semantics documented
rg -n -i "ontology|merge|template" sentura/config/ekg-schema.json5
```

Note: `ekg-schema.json5` is documentation-only (all comments, no JSON body),
so `json5.parse` legitimately rejects it — don't pipe it into `json5`.

**B8 — Industry ontology templates:**

```bash
# B8.1 / B8.3 — both templates fully populated
find sentura/config/industry-ontologies -name '*.json5' | sort
# Expected: at least 11 files across financial-services/ and e-commerce/,
# covering org/, rules/, assets/, workflows/ in each.

# B8.2 — financial-services rule coverage
rg -n -i "SOX|AML|KYC|PCI|three.way|payment.threshold" \
  sentura/config/industry-ontologies/financial-services/rules/

# B8.4 — e-commerce rule coverage
rg -n -i "return|refund|chargeback|MAP|velocity" \
  sentura/config/industry-ontologies/e-commerce/rules/
```

**B9 — MCP Builder Agent workspace:**

```bash
# B9.1 — all 10 workspace files + config
ls sentura/agents/mcp-builder/
# Expected entries (order may vary):
#   AGENTS.md BOOTSTRAP.md CONTEXT.md HEARTBEAT.md IDENTITY.md
#   MEMORY.md RULES.md SOUL.md TOOLS.md USER.md
#   config.json5 skills/

# B9.2 — 4 skills
ls sentura/agents/mcp-builder/skills/
# Expected: api-analysis/ mcp-generation/ smoke-test/ register-server/

# B9.3 — config schema invariants
rg -n 'agents:|sandbox|profile|"coding"' sentura/agents/mcp-builder/config.json5

# B9.4 — SOUL identity
rg -n -i "name|smith|mission|mcp" sentura/agents/mcp-builder/SOUL.md | head

# B9.5 — rules prohibitions
rg -n -i "NEVER|secret|destructive|RBAC|approval" sentura/agents/mcp-builder/RULES.md
```

**B10 — Common skill library:**

```bash
# B10.1 — 5 skill directories
ls sentura/config/templates/_common/skills/
# Expected: meeting-notes/ document-summarization/ escalation-handling/
#           status-update/ knowledge-base-lookup/

# B10.2 — each has SKILL.md
find sentura/config/templates/_common/skills -name SKILL.md
# Expected: 5 paths, all > 0 bytes.

# B10.3 — standard sections in each SKILL.md
for f in sentura/config/templates/_common/skills/*/SKILL.md; do
  echo "=== $f ==="
  rg -n "^## (When to Use|Procedure|Tools Needed|Safety)" "$f"
done
# Expected: each file shows all four headers.

# B10.4 / B10.5 — libraries referenced in both READMEs
rg -n "_common|meeting-notes|knowledge-base-lookup" \
  sentura/config/templates/README.md sentura/config/templates/_common/README.md
```

**B11 — Creator helper validation (offline, NOT a true LLM E2E):**

`scripts/test-creator-helpers.ts` simulates the Creator Agent's Phase 1/2/4
by calling the deterministic helpers (`workspace.ts`, `agent-registration.ts`,
`channel-bindings.ts`) with a hard-coded brief + design bundle. It writes
the generated workspace + patch body into a temp directory so nothing leaks
into `~/.openclaw/`. **No LLM is invoked** and the Creator's `SKILL.md`
files are not executed. Key assertions:

| Section | What the helper run proves |
|---------|----------------------------|
| B11.1 | Script exits 0, reports `49 / 49 passed` |
| B11.2 | Every one of the 10 workspace files is written (AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, BOOTSTRAP, MEMORY, RULES, CONTEXT) |
| B11.3 | EKG directory contains `org/`, `rules/`, `assets/`, `workflows/`, `workflows/experience-links/` |
| B11.4 | Financial-services ontology files (`roles.json5`, `financial-controls.json5`, `systems.json5`, `sops.json5`) merged in |
| B11.5 | `skills/invoice-processing/SKILL.md` + `skills/vendor-management/SKILL.md` copied from `ap-clerk` template |
| B11.6 | Generated `config.patch` body uses `agents.list[]` (array), includes `bindings[]`, `mcp.servers`, and every secret is a `$secret.` reference |
| B11.7 | `plugins.entries["memory-lancedb"].config.dbPath === "~/.openclaw/memory/ap-clerk-acme/lancedb"` — per-agent path **shape** emitted by `buildAgentPatch`. The live `memory-lancedb` plugin does not currently honour per-agent dbPaths at runtime (see scope note on B11). |

To diff the generated patch body against a known-good snapshot (optional):

```bash
npx tsx scripts/test-creator-helpers.ts | rg -A 2 "config\.patch preview"
```

For the forward-looking live LLM harness (gated, not run by default), see
**B13. Creator Agent TRUE E2E** above.

### B12. Live Gateway Integration (Week 2)

Validates Person B's Week 2 deliverables against a **running OpenClaw gateway**
end-to-end: workspace generation, `config.patch` RPC acceptance, `config.get`
read-back, and cleanup. Requires gateway at `ws://localhost:18789`.

**Prereqs**:

```bash
cd openclaw && pnpm gateway:watch   # terminal 1 — leave running
# wait for "ready (N plugins, ...s)"
```

**Run**:

```bash
npx tsx scripts/test-week2-b-gateway.ts   # terminal 2
```

**Expected output**: `77 passed / 77 total` (exit 0). Script self-cleans — the
test agent and its workspace are removed whether tests pass or fail.

| # | Test | What the script verifies |
|---|------|--------------------------|
| B12.1 | Gateway token discoverable | `~/.openclaw/config.json` has `gateway.controlUi.token` |
| B12.2 | WebSocket handshake succeeds | `connect.challenge` → `connect` RPC resolves with protocol v3 |
| B12.3 | Creator Agent live-registered | `config.get → agents.list[]` contains `creator` agent |
| B12.4 | Creator Agent config intact | `creator` entry has `parameters.memoryDbPath` set to per-agent template |
| B12.5 | Workspace materialized on disk | All 10 files (AGENTS/SOUL/TOOLS/IDENTITY/USER/HEARTBEAT/BOOTSTRAP/MEMORY/RULES/CONTEXT.md) exist in `~/.openclaw/workspace/<test-agent-id>/` |
| B12.6 | EKG pillars created | `ekg/{org,rules,assets,workflows}/` directories exist in workspace |
| B12.7 | `memory/users/` created | Per-user sub-memory directory exists |
| B12.8 | Industry ontology merged | `ekg/rules/financial-controls.json5` copied from `sentura/config/industry-ontologies/financial-services/` |
| B12.9 | RULES.md has guardrails | Non-empty and contains `NEVER`/`ALWAYS` clauses |
| B12.10 | Per-agent dbPath format | `buildMemoryDbPath(id)` returns `~/.openclaw/memory/<id>/lancedb` |
| B12.11 | No inline secrets in patch | Patch JSON body contains `$secret.` references, never raw tokens |
| B12.12 | `config.patch` accepted by live gateway | RPC resolves OK; new agent count = previous + 1 |
| B12.13 | Reconnect after mcp.servers restart | Gateway restarts in-process (`[reload] config change requires gateway restart`); client reconnects cleanly after ~6s |
| B12.14 | Agent visible in `config.get` | New agent appears in `agents.list[]` post-restart |
| B12.15 | Sandbox enforced | Live agent has `sandbox.mode = "non-main"` |
| B12.16 | Tool denylist honored | `tools.deny` contains `"exec"` and `"gateway"` |
| B12.17 | MCP server registered | `mcp.servers["netsuite-test"]` present in live config |
| B12.18 | MCP env wired | Live MCP server's `env.NETSUITE_TOKEN` key present (value resolved from secret store at read time) |
| B12.19 | Slack binding registered | `bindings[]` contains entry matching `{agentId, match.channel: "slack"}` |
| B12.20 | Clean removal | After cleanup, test agent removed from `agents.list[]`; test workspace directory deleted |

**Known limitations of this live test**:

1. **`memory-lancedb` not patched live.** The plugin's Zod schema requires a
   configured `embedding.apiKey` and the dev gateway here has embeddings
   disabled. The per-agent `dbPath` invariant is verified at the *shape* level
   offline (B12.10, B11.7). The live `config.patch` deliberately omits the
   `plugins.entries["memory-lancedb"]` subsection.

2. **Per-agent memory isolation is design intent, not runtime reality.**
   OpenClaw's `memory-lancedb` plugin currently treats `dbPath` as a single
   *global* setting — every agent shares one LanceDB file, and isolation is
   enforced at the collection level by filtering on `agentId`. The per-agent
   `dbPath` emitted by the Creator's `config.patch` is a forward-looking
   invariant that will become authoritative once the plugin supports
   per-agent paths.

3. **No LLM is driving the Creator Agent here.** B12 validates that the
   config.patch body Person B's helpers produce is accepted by a live
   gateway. It does not test whether an actual LLM running the Creator
   Agent would produce the same patch. See `B13. Creator Agent TRUE E2E`
   for the forward-looking live-LLM harness.

4. **`netsuite-test` MCP server is a placeholder.** The script registers
   `mcp.servers["netsuite-test"]` with `command: "npx"`,
   `args: ["@sentura/mcp-netsuite"]` — that npm package does not exist yet.
   Config validation accepts it because `mcp.servers` does not try to
   spawn processes at validation time. Actual MCP server packages are the
   MCP Builder Agent's (Smith's) deliverable.

---

## Person C — Frontend & Dashboard Engineer

### C1. Dashboard Build & Lint

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C1.1 | Dependencies install | `cd sentura/dashboard && pnpm install` | Exit code 0; no peer dependency errors |
| C1.2 | TypeScript compiles | `cd sentura/dashboard && pnpm build` | Exit code 0; 0 TypeScript errors |
| C1.3 | Lint passes | `cd sentura/dashboard && pnpm lint` | Exit code 0; 0 lint errors |
| C1.4 | Dev server starts | `cd sentura/dashboard && pnpm dev` | Next.js dev server starts on port 3000; no runtime errors in console |
| C1.5 | Framework versions | Read `sentura/dashboard/package.json` | Next.js 16+, React 19+, Tailwind CSS 4 |

### C2. Gateway Client Library (`src/lib/gateway/`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C2.1 | Frame types correct | Read `types.ts` | Defines `RequestFrame` (`type: "req"`), `ResponseFrame` (`type: "res"`), `EventFrame` (`type: "event"`) — NOT JSON-RPC 2.0 |
| C2.2 | ConnectParams | Read `types.ts` | Has `ConnectParams` with protocol version, client.id, client.mode, auth.token |
| C2.3 | GatewayEventType union | Read `types.ts` | Includes `exec.approval.requested`, `exec.approval.resolved`, `plugin.approval.requested`, `plugin.approval.resolved`, `sessions.changed`, `health` |
| C2.4 | Handshake protocol | Read `client.ts` | Listens for `connect.challenge` event, responds with `connect` request containing `ConnectParams` |
| C2.5 | Client identity | Read `client.ts` | Uses `openclaw-control-ui` as client ID, `ui` as mode, protocol version `3` |
| C2.6 | Meta-agent filtering | Read `client.ts` | `getAgents()` filters out `creator`, `tuner`, `orchestrator`; `getAllAgentsIncludingMeta()` returns all |
| C2.7 | Approval routing | Read `client.ts` | `resolveApproval()` branches on `plugin:` prefix in approval ID to route to correct RPC method |
| C2.8 | RPC timeout | Read `client.ts` | RPC calls have 30-second timeout; promise rejects on timeout |
| C2.9 | Reconnect logic | Read `client.ts` | Auto-reconnect with configurable max attempts and interval; state transitions through disconnected → connecting → connected → reconnecting |
| C2.10 | Environment config | Read `client.ts` | `getGatewayClient()` reads `NEXT_PUBLIC_GATEWAY_URL` and `NEXT_PUBLIC_GATEWAY_TOKEN` from env |

### C3. React Hooks (`src/lib/gateway/hooks.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C3.1 | useGateway hook | Read `hooks.ts` | Manages connection lifecycle; returns client instance + connection state |
| C3.2 | useAgents hook | Read `hooks.ts` | Calls `getAgents()` (filtered); returns agents array, loading, error, refetch |
| C3.3 | useApprovals hook | Read `hooks.ts` | Accumulates approval events by ID (deduplication); listens to both exec and plugin approval events |
| C3.4 | Cleanup on unmount | Read `hooks.ts` | Event subscriptions are cleaned up when components unmount (unsubscribe functions called) |

### C4. App Shell & Navigation

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C4.1 | Sidebar renders | Load dashboard in browser | Sidebar shows three sections: Enterprise, Management, Operations |
| C4.2 | Active route highlighting | Navigate between Overview and Employees | Active page is highlighted in the sidebar |
| C4.3 | Disabled items | Check sidebar items marked W2–W5 | Items are visually disabled; clicking does not navigate |
| C4.4 | Control UI links | Check Operations section in sidebar | External links to OpenClaw Control UI use `NEXT_PUBLIC_CONTROL_UI_URL` env var |
| C4.5 | Sidebar collapse | Click collapse toggle | Sidebar collapses; tooltips appear on hover for icon-only mode |
| C4.6 | Connection status | Check header area | Shows colored dot + label matching gateway connection state |
| C4.7 | App shell layout | Load any page | Full viewport height; sidebar + header + scrollable main content area |

### C5. Enterprise Overview Page (`/`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C5.1 | Page loads | Navigate to `/` | Page renders without errors |
| C5.2 | Disconnected banner | Load page without gateway running | "Gateway Disconnected" banner appears with guidance |
| C5.3 | Employee count | Load page with gateway running and agents registered | Stat card shows correct number of AI employees (excluding meta-agents) |
| C5.4 | Pending approvals | Check approval stat card | Shows count from event-driven approval list (may be 0 if no pending approvals) |
| C5.5 | Loading skeletons | Observe page during data fetch | Skeleton placeholders appear while data loads |
| C5.6 | Employee cards | Check bottom section | Shows up to 6 employee cards with links to `/employees?id=...` |
| C5.7 | Control UI link | Check System Health card | Links to Control UI at correct URL |

### C6. Employee Roster Page (`/employees`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C6.1 | Page loads | Navigate to `/employees` | Table renders without errors |
| C6.2 | Agent listing | With registered agents | Table shows agent ID, name, model, tools, sandbox status |
| C6.3 | Search filter | Type in search box | Filters agents by ID, name, or model substring match |
| C6.4 | Refresh | Click refresh button | Triggers data refetch; table updates |
| C6.5 | Empty state | No agents registered (or all filtered out) | Empty state message displayed |
| C6.6 | Error state | Gateway disconnected during fetch | Error card displayed |
| C6.7 | Meta-agents excluded | Check table contents | `creator`, `tuner`, `orchestrator` do not appear in the roster |
| C6.8 | Status column | Check Status column | Shows "active" for all agents (placeholder — lifecycle not implemented yet) |
| C6.9 | Config link | Check row actions | External link to Control UI raw config for each agent |
| C6.10 | Create/Tune disabled | Check action buttons | "Create Employee" and "Tune" buttons are present but disabled (Week 2) |

### C7. Environment Configuration

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C7.1 | .env.local.example | Read `sentura/dashboard/.env.local.example` | Contains `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_GATEWAY_TOKEN`, `NEXT_PUBLIC_CONTROL_UI_URL` |
| C7.2 | Default gateway URL | Check code | Defaults to `ws://localhost:18789` when env var not set |
| C7.3 | Default Control UI URL | Check sidebar code | Defaults to `http://localhost:18789` when env var not set |

---

## Person D — Extensions & Integrations Engineer

### D1. Audit Extension — Automated Unit Tests

These tests run via `cd openclaw && npx vitest run --config vitest.sentura.config.ts`.

| # | Test File | Tests | What is Covered |
|---|-----------|-------|-----------------|
| D1.1 | `sentura-audit/src/redaction.test.ts` | 6 | Default sensitive field redaction (apiKey, password, token); nested objects; arrays; primitives passthrough; custom patterns; case-insensitive matching |
| D1.2 | `sentura-audit/src/store.test.ts` | 7 | Append and query entries; filter by eventType, agentId, severity, time range; respect limit; create nested log directories |

### D2. Audit Extension — Manual Verification

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| D2.1 | Plugin manifest valid | Read `sentura/extensions/sentura-audit/openclaw.plugin.json` | Has `id: "sentura-audit"`, `enabledByDefault: true`, contracts list `sentura_audit_query` tool, configSchema for logDir/retention/redaction/verbose |
| D2.2 | Package.json entry point | Read `sentura/extensions/sentura-audit/package.json` | `openclaw.extensions` points to `./index.ts` |
| D2.3 | Hook registrations | Read `sentura/extensions/sentura-audit/index.ts` | Registers hooks for: `before_tool_call`, `after_tool_call`, `session_start`, `session_end`, `message_received`, `message_sent`, `agent_end`, `gateway_start`, `gateway_stop` |
| D2.4 | Gateway RPC methods | Read `index.ts` | Registers `sentura.audit.query` and `sentura.audit.stats` gateway methods |
| D2.5 | Tool registered | Read `index.ts` | Registers `sentura_audit_query` tool for agent use |
| D2.6 | Redaction defaults | Read `src/redaction.ts` | Default patterns cover: `key`, `secret`, `token`, `password`, `credential`, `auth`, `bearer`, `session` |
| D2.7 | Store rotation config | Read `src/store.ts` | Supports `maxAgeDays` and `maxSizeMb` retention configuration |
| D2.8 | Audit entry structure | Read `src/types.ts` | `AuditEntry` has: id, timestamp, eventType, severity, agentId?, sessionKey?, details, metadata? |
| D2.9 | Event types complete | Read `src/types.ts` | `AuditEventType` covers: `tool_call`, `tool_result`, `approval_requested`, `approval_resolved`, `config_change`, `session_start`, `session_end`, `message_received`, `message_sent`, `agent_end`, `gateway_start`, `gateway_stop` |

### D3. RBAC Extension — Automated Unit Tests

These tests run via `cd openclaw && npx vitest run --config vitest.sentura.config.ts`.

| # | Test File | Tests | What is Covered |
|---|-----------|-------|-----------------|
| D3.1 | `sentura-rbac/src/roles.test.ts` | 9 | Five roles defined; all role IDs present; platform_admin has all 6 operator scopes; end_user only has operator.read; auditor permissions are read-only; platform_admin T0-T4 access; end_user T0 only; getOperatorScopesForRole works; unknown role returns empty |
| D3.2 | `sentura-rbac/src/authorizer.test.ts` | 13 | Unknown users denied; platform_admin gets "all" scope; auditor can read but not delete agents; employee_owner gets "owned" scope for read/update; employee_owner cannot create agents; end_user gets "self" scope for sessions; end_user denied config access; dept_admin gets "department" scope; auditor can query audit logs; end_user denied audit access; only platform_admin can access secrets |

### D4. RBAC Extension — Manual Verification

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| D4.1 | Design document | Read `sentura/extensions/sentura-rbac/DESIGN.md` | Documents all 5 roles, 3-layer authorization (scope → method → resource), department hierarchy, data tier access matrix, permission tables for standard and Sentura methods |
| D4.2 | Five roles defined | Read `src/roles.ts` | `ROLE_DEFINITIONS` array has exactly 5 entries: platform_admin, dept_admin, employee_owner, auditor, end_user |
| D4.3 | Operator scope mapping | Read `src/roles.ts` | platform_admin: 6 scopes; dept_admin: 3 (read, write, approvals); employee_owner: 2 (read, write); auditor: 1 (read); end_user: 1 (read) |
| D4.4 | Data tier access | Read `src/roles.ts` | platform_admin: T0-T4; dept_admin: T0-T2; employee_owner: T0-T1; auditor: T0-T2; end_user: T0 |
| D4.5 | Authorizer method coverage | Read `src/authorizer.ts` | `METHOD_POLICIES` maps all key OpenClaw methods (config.*, agents.*, sessions.*, cron.*, exec.approval.*, secrets.*, skills.*) and Sentura methods (sentura.audit.*, sentura.rbac.*) |
| D4.6 | Store persistence | Read `src/store.ts` | Users stored in `users.json`, departments in `departments.json`; supports CRUD operations |
| D4.7 | Department hierarchy | Read `src/store.ts` | `getEmployeeIdsVisibleToUser` traverses parent → child departments recursively |
| D4.8 | Gateway methods registered | Read `index.ts` | Registers: `sentura.rbac.roles.list`, `sentura.rbac.users.list`, `sentura.rbac.users.get`, `sentura.rbac.users.assign`, `sentura.rbac.users.upsert`, `sentura.rbac.departments.list`, `sentura.rbac.authorize`, `sentura.rbac.scope.employees` |
| D4.9 | Agent tool registered | Read `index.ts` | Registers `sentura_rbac_manage` tool with actions: `list_roles`, `list_users`, `get_user`, `check_auth`, `list_departments` |

### D5. Approval Policy Configs

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| D5.1 | Policy file parses | Parse `sentura/config/approval-policies.json5` as JSON5 | File parses without errors (valid JSON5 syntax) |
| D5.2 | Tool risk levels | Read the file | High risk: `browser_navigate`, `browser_fill`, `browser_click`, `mcp_*`; Medium: `send_email`, `send_message`, `config_patch`; Low: `memory_*`, `file_read`, `file_write`, `sentura_audit_query`, `sentura_rbac_manage` |
| D5.3 | Action policies | Read the file | Critical: `self_provision_new_account`, `financial_transaction`, `permission_change`; High: `self_provision_existing_account`, `data_export`; Medium: `employee_config_change`, `skill_install` |
| D5.4 | Escalation chain | Read the file | Chain: employee_owner → dept_admin → platform_admin; 15-min escalation timeout; max 2 escalations; final timeout action: deny |
| D5.5 | Default exec policy | Read `sentura/config/exec-approvals-template.json` | `security: "full"`, `ask: "always"`, `askFallback: "deny"`, `autoAllowSkills: false` |
| D5.6 | Timeout defaults | Read the policy file | Default timeout: 30 minutes (1800000ms); critical actions: 1 hour (3600000ms) |
| D5.7 | Notification channels | Read the file | Slack (all approvals), Email (urgent only), Dashboard (all) |

### D6. GradSale API Study Validation

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| D6.1 | Admin API coverage | Cross-reference `ekg/api-admin.md` with MEMORY.md entry | 40+ admin endpoints identified; categorized by MCP tool suitability |
| D6.2 | Web API coverage | Cross-reference `ekg/api-web.md` with MEMORY.md entry | 30+ web endpoints identified |
| D6.3 | Separation strategy | Read MEMORY.md Person D entry | Admin-scoped vs user-scoped MCP servers documented as separate with different approval policies |
| D6.4 | GradSale test employee alignment | Compare `workspaces/cs-agent-gradsale/skills/` with `ekg/api-admin.md` | Skill procedures reference real GradSale API endpoints |

---

## Cross-Team Integration Tests

These tests verify that deliverables from different team members work together correctly.

### X1. Setup → Agent Registration → Dashboard Display

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X1.1 | Full setup flow | Follow docs/SETUP.md end-to-end, then run `sentura-setup.sh` | Gateway running; meta-agents registered; dashboard starts |
| X1.2 | Meta-agents not in roster | After setup, load `/employees` in dashboard | `creator`, `tuner`, `orchestrator` NOT shown in the employee table |
| X1.3 | GradSale agent in roster | Register `cs-agent-gradsale` via CLI, load `/employees` | Agent appears with correct name, model, tools |

### X2. Bootstrap Hook → Workspace Convention → Agent Behavior

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X2.1 | RULES.md respected | Create agent with RULES.md containing a clear boundary, test with a prompt that would violate it | Agent refuses to violate the boundary defined in RULES.md |
| X2.2 | CONTEXT.md available | Create agent with CONTEXT.md containing enterprise-specific knowledge, ask about it | Agent references the enterprise context in its response |
| X2.3 | Convention compliance | Check `workspaces/cs-agent-gradsale/` against `docs/workspace-convention.md` | All 10 files present; file content follows documented structure |

### X3. Config Schema Consistency

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X3.1 | All configs use correct schema | Grep all `config.json5` files for deprecated patterns | No occurrences of `agents.entries`, `systemPrompt`, `tools.allowlist`, `tools.denylist` |
| X3.2 | Config patch works | Apply any template's config.json5 via `config.patch` | Agent appears in `agents.list`; gateway accepts the config without errors |
| X3.3 | Template placeholders | Check that no template config has unresolved placeholders in use | All `{placeholder}` values are documented in template README |

### X4. Dashboard ↔ Gateway Protocol

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X4.1 | Dashboard connects | Start gateway + dashboard; load dashboard | Connection status shows "Connected" (green dot) |
| X4.2 | Dashboard disconnects gracefully | Stop gateway while dashboard is open | Connection status shows "Disconnected" or "Reconnecting"; no page crash |
| X4.3 | Overview stats accurate | Load `/` with agents registered | Employee count matches `config.get agents.list` length (minus 3 meta-agents) |

### X5. Extension ↔ Policy Alignment

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| X5.1 | RBAC roles match README | Compare `sentura-rbac/src/roles.ts` role IDs with README §15 table | All 5 roles present with matching names and descriptions |
| X5.2 | Audit event types cover all hooks | Compare `sentura-audit/src/types.ts` AuditEventType with registered hooks in `index.ts` | Every registered hook produces at least one audit event type |
| X5.3 | Approval policies reference valid tools | Check tool names in `approval-policies.json5` | Tool names match OpenClaw's tool catalog (browser_navigate, mcp_*, etc.) |

---

## Test Results Summary Template

Use this template to record test results:

```
Date: ____
Tester: ____
Gateway version: ____
Node version: ____

Person A: __ / 74 passed
Person B: __ / 85 passed   (65 + 20 new B12 live-gateway cases)
Person C: __ / 33 passed
Person D: __ / 31 passed (22 automated + 9 manual)
Cross-team: __ / 13 passed

Total: __ / 195

Notes:
- ...
```
