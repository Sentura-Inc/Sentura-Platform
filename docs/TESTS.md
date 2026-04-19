# Sentura Platform — Test Documentation

> **Scope**: All deliverables from Weeks 1–2 across all four team members.
>
> **Last updated**: 2026-04-20 (Week 2 audit round 14: added B9.6 + B9.7 covering the MCP Builder `config.json5` repair — invalid `openai/gpt-4o` model replaced with `openai/gpt-5.4`, broken path-glob `skills:` filter removed, and Creator-parity `tools.deny = [sessions_spawn, subagents, sessions_yield]` applied so mcp-builder cannot reproduce the Round-10 noop-hallucination loop when first deployed. No live-config change needed: mcp-builder isn't in `~/.openclaw/openclaw.json` `agents.list[]` yet. Previous: 2026-04-19 (Person B Week 2, round 13: added B6.9 Creator Agent TRUE end-to-end live run — 10 test cases covering the canonical Week-2-close-out path. Harness `scripts/test-creator-e2e-live.ts` PASSED on first clean run on 2026-04-19 with `openai/gpt-5.4`: NL brief → Forge Phase 1-4 → new `penny-ap` agent registered in live config in ~110s with 8-file workspace and correct Hard Rules translation (> £5000 → human approval). This round is gated by the Round 11-12 infra fixes (`workspaceAccess: "rw"`, device-pair, `bindings[]` populated) and by a valid provider/model pairing (`openai/gpt-5.4` with `~/.openclaw/.env`-loaded key — NOT `openai/gpt-5.3-codex`, which requires OAuth). Previous: 2026-04-18 (Person A Week 2, round 11: added B6.8 Creator sandbox `workspaceAccess: "rw"` — 6 test cases verifying the sandbox mount points at the live `~/.openclaw/workspace/creator/` directory so host-edits to AGENTS.md / TOOLS.md / BOOTSTRAP.md reach the in-container LLM without manual sandbox deletion. This was the actual reason Round 10's AGENTS.md edits had no effect on the running agent. Previous, round 10: added B6.7 Creator subagent-spawn denial + `exec` removal — 9 test cases verifying `sessions_spawn`/`subagents`/`sessions_yield` are in `creator.tools.deny`, `AGENTS.md` no longer advertises denied tools, the `gateway`-unknown warning is scoped to subagent sessions only, and a retry deploy of `billing-support-rep` runs without spawning subagents or hitting the `1000ms` embedded-run timeout. Previous, round 7: added B6.6 `tools.exec.host` pinned to `gateway` — 8 test cases verifying the `exec host not allowed` rejection no longer derails Forge's self-probe, which round 6 alone had not addressed. Previous, round 6: added B6.5 Owner-authorization grant for webchat operator — 7 test cases verifying `commands.ownerAllowFrom: ["*"]` is persisted in the live config and setup script so owner-only tools like `gateway` are no longer stripped from Forge's manifest. This was the actual blocker behind "deployment tools are not exposed in this session" after round 5. Previous, round 5: added B6.4 Creator tool-policy deny-list enforcement — 7 test cases verifying the `coding` profile's `write`/`edit`/`apply_patch` tools are denied for Forge so the LLM can no longer route around the Hard Rules. Previous, round 4: added B6.3 Creator `AGENTS.md` / `TOOLS.md` / `BOOTSTRAP.md` Hard Rule repair — 8 test cases verifying the Creator's Hard Rules no longer prescribe `fs_write` for new-employee workspaces, that `sentura_agents_manage` is the primary transport, and that host copies stay in sync. Previous: Person A + Person B Week 2: added A15 `sentura-agents` Extension + Deployment Pipeline Wiring section — 12 test cases covering the new platform extension, setup-script plugin wiring, and live deployment verification. Added B6.2 `employee-deployment` skill rewrite — 6 test cases verifying Forge uses gateway RPCs instead of `fs_write` for new-employee workspaces. Previous: 2026-04-17 — Person A Week 2: added A14 Sandbox Seed Hook section; Person C Week 2: added C8/C9/C10 sections + per-employee conversation helpers)

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

The hook's sole job is per-user memory injection. Hard Rules and Enterprise Context live inside `AGENTS.md` and `BOOTSTRAP.md` and are loaded natively by OpenClaw — the hook does not touch them.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A3.1 | Per-user memory injection | Bind a session with a user token; ensure `memory/users/MEMORY_USER_{token}.md` exists in the workspace | System prompt includes that file's content (verify via session transcript or `sessions.preview`) |
| A3.2 | Session without user token | Start a session whose session key does not carry a user token | Hook returns without injecting any file; no errors |
| A3.3 | Missing per-user file skipped | Use a user token that has no corresponding `MEMORY_USER_{token}.md` file | No errors; agent boots normally; only the standard 8 native files in prompt |
| A3.4 | Empty per-user file skipped | Create `MEMORY_USER_{token}.md` with only whitespace | File is not appended to bootstrapFiles (whitespace-only = absent) |
| A3.5 | Non-bootstrap events ignored | Other hook events fire during normal operation | Hook returns without modification; no errors in gateway logs |

### A4. Week 2 — Workspace Creation Library (`sentura/lib/workspace.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A4.1 | createWorkspace creates all dirs | Call `createWorkspace({ agentId: "test-agent" })` | Creates workspace dir, skills/, ekg/{org,rules,assets,workflows,workflows/experience-links}/, memory/users/ |
| A4.2 | All 8 native workspace files created | Call `createWorkspace()` then list files | AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md all exist |
| A4.2a | AGENTS.md carries Hard Rules section | Read the generated AGENTS.md | Contains `## Hard Rules (must not override)` heading with at least one `NEVER`/`ALWAYS` bullet |
| A4.2b | BOOTSTRAP.md carries Enterprise Context section | Read the generated BOOTSTRAP.md | Contains `## Enterprise Context` heading with Company / Organization / Systems / Policies subsections |
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
| A13.9 | AGENTS.md Hard Rules present | Verify each meta-agent's AGENTS.md contains a `## Hard Rules (must not override)` section | All 3 meta-agents have Hard Rules |
| A13.10 | BOOTSTRAP.md Enterprise Context present | Verify each meta-agent's BOOTSTRAP.md contains a `## Enterprise Context` section | All 3 meta-agents have Enterprise Context |
| A13.11 | HTTP health endpoint | GET /health | Returns 200 with status field |

### A14. Week 2 — Sandbox Seed Hook (`sentura/hooks/sentura-sandbox-seed/handler.ts`)

OpenClaw's `ensureSandboxWorkspace` only copies a fixed set of 7 bootstrap files and never transfers `skills/`, `memory/`, `ekg/`, `config.json5`, `MEMORY.md`, or a customized `BOOTSTRAP.md` into the agent's sandbox. This hook runs on `agent:bootstrap` and backfills those gaps from the host workspace. Unit tests live in `scripts/test-week2.ts` Part 11.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A14.1 | Skills mirrored into sandbox | `npx tsx scripts/test-week2.ts` Part 11 | Host `skills/<name>/SKILL.md` appears at sandbox path |
| A14.2 | Custom BOOTSTRAP.md replaces stub | Same | 700-byte default stub is replaced when host BOOTSTRAP.md is substantially larger (≥ 1500 bytes) |
| A14.3 | MEMORY.md union-copied | Same | Sandbox gets `MEMORY.md` when missing |
| A14.4 | config.json5 union-copied | Same | Sandbox gets `config.json5` when missing |
| A14.5 | memory/users/ union-copied | Same | `memory/users/MEMORY_USER_*.md` mirrored into sandbox |
| A14.6 | ekg/ subtree mirrored | Same | `ekg/org/*.md` and other ekg subfolders appear in sandbox |
| A14.7 | Sandbox-owned MEMORY preserved | Same | Subsequent boots do NOT overwrite existing sandbox MEMORY.md (union semantics) |
| A14.8 | Host workspace no-op | Same | When `workspaceDir` equals the host workspace, hook returns without seeding |
| A14.9 | Unknown agent sandbox no-op | Same | Sandbox for an agent without a host workspace is left untouched |
| A14.10 | Live verification — skills present | After `scripts/sentura-setup.sh` + gateway restart, chat with Forge: "list files in skills/" | Sandbox's `skills/` directory contains all 7 Creator skill subdirectories |
| A14.11 | Live verification — custom BOOTSTRAP.md | In chat with Forge: "show the first 20 lines of BOOTSTRAP.md" | Reads the full Sentura-customized content (not the 700-byte OpenClaw stub) |
| A14.12 | Repair script fixes stale installs | `npx tsx scripts/repair-sandbox-seeding.ts` on an existing install with glob-style `skills` filters | Removes glob-path `skills` filters from `~/.openclaw/openclaw.json`, enables both Sentura hooks, and clears stale meta-agent sandboxes |

### A15. Week 2 — `sentura-agents` Extension + Deployment Pipeline Wiring

After A14 landed, Forge could design an employee but deployment failed with `Sandbox path is read-only; cannot create directories: /workspace/.openclaw/workspace/<id>`. The `employee-deployment` skill used `fs_write`, which is sandbox-local, and OpenClaw's `agents.files.set` only covers the 8 native files — there was no safe RPC for subdirectory files (`skills/`, `ekg/`, `memory/users/`). Fix: new `sentura-agents` extension + setup-script wiring + skill rewrite. Unit tests live in `scripts/test-week2.ts` Part 12.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A15.1 | Extension directory exists | `ls sentura/extensions/sentura-agents/` | Contains `openclaw.plugin.json`, `package.json`, `api.ts`, `index.ts`, `src/paths.ts`, `src/fs-ops.ts` |
| A15.2 | Manifest declares correct id + tool | `scripts/test-week2.ts` Part 12 | `openclaw.plugin.json` has `id: "sentura-agents"`, `contracts.tools` includes `sentura_agents_manage`, `enabledByDefault: true` |
| A15.3 | All four gateway methods registered | Same | `index.ts` calls `api.registerMethod("sentura.agents.{writeSubfile,readSubfile,deleteSubfile,listSubfiles}", …)` |
| A15.4 | Agent-facing tool registered | Same | `index.ts` calls `api.registerTool("sentura_agents_manage", …)` |
| A15.5 | Path validation blocks escapes | Unit test against `src/paths.ts#safeJoin` | `..`, absolute paths, and symlink escapes throw `PathValidationError` |
| A15.6 | Native files blocked from this extension | Unit test | Writing `AGENTS.md` / `SOUL.md` / etc. via `writeSubfile` is rejected — those must go through `agents.files.set` |
| A15.7 | Setup script references `plugins.load.paths` | `scripts/test-week2.ts` Part 12 | `scripts/sentura-setup.sh` mentions `plugins.load.paths` |
| A15.8 | Setup script patches `plugins.entries` | Same | Step 7a writes `plugins.entries[<id>].enabled = true` for each present extension |
| A15.9 | Setup script wires the known extensions | Same | Script enumerates at least `sentura-agents`, `sentura-rbac`, `sentura-audit` |
| A15.10 | Live wiring — extension loaded | After `scripts/sentura-setup.sh` + gateway restart, `cat ~/.openclaw/openclaw.json` | `plugins.load.paths` contains the absolute path to `sentura/extensions/sentura-agents`; `plugins.entries["sentura-agents"].enabled === true` |
| A15.11 | Live — gateway advertises new methods | Call `gateway.methods.list` | Response includes `sentura.agents.writeSubfile`, `readSubfile`, `deleteSubfile`, `listSubfiles` |
| A15.12 | Live — subfile write round-trip | `gateway.call("sentura.agents.writeSubfile", { agentId, subpath: "skills/test/SKILL.md", content: "# test" })` then `listSubfiles` | File appears in host `~/.openclaw/workspace/<agentId>/skills/test/SKILL.md`; listing returns it |

### B6.2. Week 2 — `employee-deployment` skill rewrite (deployment-pipeline repair)

Updated in lockstep with A15; verifies Forge no longer uses `fs_write` for new-employee workspaces.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.2.1 | Skill calls out `fs_write` restriction | `scripts/test-week2.ts` Part 12 | SKILL.md explicitly warns about the read-only sandbox and forbids `fs_write` for new-employee files |
| B6.2.2 | Skill references `agents.files.set` | Same | SKILL.md uses `agents.files.set` for the 8 native files |
| B6.2.3 | Skill references `sentura.agents.writeSubfile` | Same | SKILL.md uses `sentura.agents.writeSubfile` for `skills/`, `ekg/`, `memory/users/` files |
| B6.2.4 | Legacy instruction removed | Same | SKILL.md no longer contains the "Use `fs_write` for each file" instruction |
| B6.2.5 | Creator allows the new tool | Same | `sentura/agents/creator/config.json5` `tools.alsoAllow` contains `sentura_agents_manage` |
| B6.2.6 | Live deployment smoke test | Chat with Forge: "incubate a minimal billing-support employee named Remy with 1 skill and deploy" | Deployment completes; host `~/.openclaw/workspace/remy-billing-support/` has 8 native files + `skills/<name>/SKILL.md` + optional `ekg/` files; no `Sandbox path is read-only` error |

### B6.3. Week 2 — Creator `AGENTS.md` / `TOOLS.md` / `BOOTSTRAP.md` Hard Rule repair (round 4)

Hard Rules live at the top of `AGENTS.md` and explicitly override every skill.
Round 3 only fixed skills, so Forge still followed the Hard Rules' `fs_write`
instruction and kept hitting `Sandbox path is read-only`. This section guards
against that regression.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.3.1 | AGENTS.md Hard Rules forbid `fs_write` for employees | `rg -n "fs_write" sentura/agents/creator/AGENTS.md` | Every match is a prohibition (e.g. "NEVER via `fs_write`", "`fs_write` cannot write to…"); zero prescriptive lines like "use `fs_write`" |
| B6.3.2 | AGENTS.md Hard Rules prescribe `sentura_agents_manage` flow | `rg -n "sentura_agents_manage" sentura/agents/creator/AGENTS.md` | Hard Rules section lists the 3-step flow: `create_agent` → `write` (native + skills) → `gateway.config.patch` |
| B6.3.3 | Phase 5 deploys via `sentura_agents_manage` | Read `sentura/agents/creator/AGENTS.md` § Phase 5 | Steps 1–3 call `sentura_agents_manage` with `create_agent` and `write`; step 4 uses `gateway` `config.patch`; there is no `fs_write` prescription anywhere in Phase 5 |
| B6.3.4 | TOOLS.md promotes `sentura_agents_manage` to primary | Read `sentura/agents/creator/TOOLS.md` | `sentura_agents_manage` row exists and is labelled "Primary workspace tool"; the `fs_read`/`fs_write` row is downgraded to "scratch-only, inside your own sandbox" |
| B6.3.5 | BOOTSTRAP.md bootstrap check lists `sentura_agents_manage` first | Read `sentura/agents/creator/BOOTSTRAP.md` step 4 | Lists `sentura_agents_manage` as a mandatory tool and notes that `fs_write` cannot reach `/workspace/.openclaw/workspace/<agent>/…` |
| B6.3.6 | config.json5 header matches reality | Read `sentura/agents/creator/config.json5` header comment | Header references `sentura_agents_manage`, not "coding profile for fs_write" |
| B6.3.7 | Host workspace kept in sync | `diff sentura/agents/creator/{AGENTS,TOOLS,BOOTSTRAP}.md ~/.openclaw/workspace/creator/{AGENTS,TOOLS,BOOTSTRAP}.md` | All three diffs are empty (host copy was re-synced as part of the fix) |
| B6.3.8 | Deployment regression — no fs_write in trace | Chat with Forge: "deploy a minimal billing-support agent named Remy" | In the session trace, step 1 is `sentura_agents_manage{action:"create_agent"}`; zero `fs_write` tool invocations target any `.openclaw/workspace/<agent>/…` or `/workspace/generated/…` path; terminal shows zero `Sandbox path is read-only` lines; the new agent appears in the dashboard after the `config.patch` |

### B6.4. Week 2 — Creator tool-policy deny-list enforcement (round 5)

Round 4 rewrote Hard Rules to forbid `fs_write` for employee workspaces,
but Forge still selected the built-in `write` tool (which the `coding`
profile exposes) and kept hitting `Sandbox path is read-only`. Rules at
the prompt layer are not binding on the model; the only reliable
enforcement is removing the competing tool from the resolved tool set.
This section verifies the `deny:` policy stays in place.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.4.1 | Source config denies `write`/`edit`/`apply_patch` | `rg -n "deny" sentura/agents/creator/config.json5` | `tools.deny` contains exactly `["write","edit","apply_patch"]` |
| B6.4.2 | Setup script re-applies deny list | `rg -n "deny.*write.*edit.*apply_patch" scripts/sentura-setup.sh` | `overrides.creator.tools.deny` has the same three entries so every `pnpm sentura:setup` run restores the policy |
| B6.4.3 | Live openclaw.json has deny list | `node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/.openclaw/openclaw.json','utf8')).agents.list.find(a=>a.id==='creator').tools.deny)"` | Output is `[ 'write', 'edit', 'apply_patch' ]` |
| B6.4.4 | `sentura_agents_manage` still allowed | Same config, inspect `tools.alsoAllow` | Still contains `sentura_agents_manage` so Forge has a workspace-write path |
| B6.4.5 | Stale sandbox cleared | `ls ~/.openclaw/sandboxes/ \| grep agent-creator` | Either empty or only sandboxes created AFTER the deny-list was applied (they will reseed the new tool set) |
| B6.4.6 | Tool manifest in trace | Chat with Forge: "list your writing tools" | Reply mentions `sentura_agents_manage` and explicitly NOT `write`, `edit`, or `apply_patch` |
| B6.4.7 | Deployment regression — zero `write` invocations | Chat with Forge: "deploy a minimal billing-support agent named Ada" | Trace contains zero `write`/`edit`/`apply_patch` calls; every file lands via `sentura_agents_manage`; terminal has zero `Sandbox path is read-only` lines |

### B6.5. Week 2 — Owner-authorization grant for webchat operator (round 6)

Round 5 removed `write`/`edit`/`apply_patch` but Forge still refused to
deploy, saying "the deployment tools are not exposed in this session"
and "this sandbox does not expose the `gateway` tool". Root cause:
`gateway`, `cron`, and `nodes` are owner-only tools
(`openclaw/src/agents/tools/owner-only-tools.ts`) that are stripped from
the tool manifest whenever `senderIsOwner === false`. Our
`commands.ownerAllowFrom` was unset, so every webchat message — even
from the local operator — was treated as non-owner and `alsoAllow:
["gateway", …]` was silently discarded. The fix is to authorize the
local operator as owner via `commands.ownerAllowFrom: ["*"]`.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.5.1 | Live config grants owner | `node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/.openclaw/openclaw.json','utf8')).commands?.ownerAllowFrom)"` | Output is `[ '*' ]` |
| B6.5.2 | Setup script persists grant | `rg -n "ownerAllowFrom" scripts/sentura-setup.sh` | Matches the `config.commands.ownerAllowFrom = ['*']` block that runs during `pnpm sentura:setup` |
| B6.5.3 | Setup script only sets when unset | Read the surrounding block in `scripts/sentura-setup.sh` | The assignment is guarded by `!Array.isArray(...) \|\| .length === 0`, so an operator-scoped ID configured by the user is preserved |
| B6.5.4 | Owner-only tools still declared in `alsoAllow` | `rg -n "'gateway'" scripts/sentura-setup.sh sentura/agents/creator/config.json5` | Both source files keep `gateway` in `alsoAllow` so the ownership grant can surface it |
| B6.5.5 | Stale Creator sandbox cleared | `ls ~/.openclaw/sandboxes 2>/dev/null \| grep agent-creator \|\| echo none` | `none`, or only sandboxes created AFTER Round 6 |
| B6.5.6 | Tool manifest in trace — gateway present | Chat with Forge: "list your tools" | Reply includes `gateway` (with actions `config.get`, `config.patch`, etc.) and `sentura_agents_manage` |
| B6.5.7 | End-to-end deployment | Chat with Forge: "deploy a minimal billing-support agent named Remy" | Trace includes `gateway { action: "config.get" }`, `sentura_agents_manage { action: "create_agent" }`, eight `sentura_agents_manage { action: "write" }` native-file calls, skill writes, and a final `gateway { action: "config.patch" }`. Dashboard shows the new employee in `agents.list`. Gateway logs contain zero `Sandbox path is read-only` lines and zero `Path escapes sandbox root` lines. |

### B6.6. Week 2 — `tools.exec.host` pinned to `gateway` (round 7)

After round 6 the gateway/agents tools were technically in Forge's
manifest, but Forge still reported "deployment tools are not exposed."
The only remaining tool error in the gateway log was:

```
[tools] exec failed: exec host not allowed
  (requested gateway; configured host is auto; …)
  raw_params={…,"host":"gateway",…}
```

Root cause: `tools.exec.host` defaulted to `"auto"`. When a sandbox is
available, `bash-tools.exec-runtime.ts:isRequestedExecTargetAllowed`
explicitly rejects an `exec` call that asks for `host: "gateway"` under
the `auto` policy. Forge's probe (`which openclaw || openclaw gateway
status`) was its way of confirming the gateway was reachable; the
rejection convinced it that the gateway tool itself was missing. The
fix is to pin `tools.exec.host: "gateway"` in the live config and in
the setup script.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.6.1 | Live config pins exec host | `node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/.openclaw/openclaw.json','utf8')).tools?.exec?.host)"` | Output is `gateway` |
| B6.6.2 | Setup script persists pin | `rg -n "tools.exec.host" scripts/sentura-setup.sh` | Matches the `config.tools.exec.host = 'gateway'` block that runs during `pnpm sentura:setup` |
| B6.6.3 | Setup script only sets when missing | Read surrounding block in `scripts/sentura-setup.sh` | The assignment is guarded by `if (config.tools.exec.host !== 'gateway')`, so operator-customized hosts (e.g. `"sandbox"`) are preserved |
| B6.6.4 | Gateway hot-reload picked up change | `rg "config change applied.*tools.exec" ~/.openclaw/logs/openclaw-*.log /tmp/openclaw/openclaw-*.log 2>/dev/null` | Matches at least one line like `[reload] config change applied (dynamic reads: tools.exec)` |
| B6.6.5 | No pending `exec host not allowed` errors | `rg -n "exec host not allowed" /tmp/openclaw/openclaw-*.log` in a fresh run | Zero matches after the hot-reload line |
| B6.6.6 | Stale Creator sandbox cleared | `ls ~/.openclaw/sandboxes 2>/dev/null \| grep agent-creator \|\| echo none` | `none`, or only sandboxes created AFTER Round 7 |
| B6.6.7 | Forge's self-probe succeeds | New chat with Forge: "before you do anything, run `which openclaw` and tell me what you see" | Forge returns the `openclaw` CLI path with zero `exec host not allowed` errors in gateway log |
| B6.6.8 | End-to-end deployment still works | Chat with Forge: "deploy a minimal agent named Remy" | Trace includes the gateway/sentura_agents_manage calls from B6.5.7; zero `exec host not allowed` and zero `Sandbox path is read-only` lines in gateway log |

### B6.7. Week 2 — Creator subagent-spawn denial + `exec` removal (round 10)

Between rounds 7–9 a follow-up deploy attempt surfaced a new failure
mode: Forge (running `openai/gpt-5.3-codex`) hallucinated a call to
`sessions_spawn({ task: "noop", runTimeoutSeconds: 1 })`. The `1` was
passed straight through to the embedded-run timeout as `1000ms`, the
spawned subagent had no `SOUL.md` and returned nothing, and Forge's
entire user-facing reply collapsed to the literal string `"noop"`. No
agent was deployed.

Root cause: `openclaw/src/agents/tool-catalog.ts` registers
`sessions_spawn`, `subagents`, and `sessions_yield` with
`profiles: ["coding"]`, so Forge's `coding` profile allowlist already
shipped all three tools. A previous attempt to remove `sessions_spawn`
from `tools.alsoAllow` was a no-op because `alsoAllow` is additive-only.
The only way to block a profile-included tool is through `tools.deny`
(`openclaw/src/agents/tool-policy-match.ts` checks `deny` before any
`allow` path).

Round 10 also closes the previously-dangling `exec` case: `exec` had
been denied since round 8 but the creator's `AGENTS.md` still listed
it under "Tool Availability", which mis-advertised the toolkit to the
model.

Fix: add `sessions_spawn`, `subagents`, `sessions_yield` to
`creator.tools.deny` in the source config, the live config, and the
creator's `AGENTS.md`. Remove `exec` from AGENTS.md's "available"
list; list it explicitly under "Denied intentionally" with rationale.
Sync the host copy byte-for-byte.

A separate warning — `tools.profile (coding) allowlist contains
unknown entries (gateway)` — is NOT a bug: it fires only for subagent
sessions (which intentionally strip `gateway` via
`SUBAGENT_TOOL_DENY_ALWAYS` in `pi-tools.policy.ts`). The main Forge
session gets `gateway` because control-ui connects with the
`operator.admin` scope that flips `senderIsOwner=true`. No fix needed.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.7.1 | Source config denies subagent tools | `rg -n "^\s+deny:" sentura/agents/creator/config.json5` | Matched line contains `sessions_spawn`, `subagents`, `sessions_yield` in addition to `write`, `edit`, `apply_patch`, `exec` |
| B6.7.2 | Live openclaw.json denies subagent tools | `node -e "const c=require(process.env.HOME+'/.openclaw/openclaw.json'); console.log(c.agents.list.find(a=>a.id==='creator').tools.deny)"` | Output is `[ 'write', 'edit', 'apply_patch', 'exec', 'sessions_spawn', 'subagents', 'sessions_yield' ]` |
| B6.7.3 | AGENTS.md does not advertise denied tools | `rg -n "sessions_spawn\|sessions_yield\|subagents\|\bexec\b" sentura/agents/creator/AGENTS.md` | Every match occurs inside the "Denied intentionally" block; zero matches inside the "available to you" list |
| B6.7.4 | AGENTS.md host copy synced | `diff -q sentura/agents/creator/AGENTS.md ~/.openclaw/workspace/creator/AGENTS.md` | No output (files are byte-identical) |
| B6.7.5 | Deny precedence verified in source | `rg -n "matchesAnyGlobPattern.*deny" openclaw/src/agents/tool-policy-match.ts` | Matches the early-return `return false` that runs before any `allow` check, confirming `deny` beats profile allow |
| B6.7.6 | `gateway` warning is subagent-only | `rg -n "unknown entries.*gateway" ~/.openclaw/logs/openclaw-*.log /tmp/openclaw/openclaw-*.log 2>/dev/null \| rg "session=agent:creator:subagent"` | Every hit is for a subagent session; zero hits where the session id is the bare `agent:creator` main session |
| B6.7.7 | Stale Creator sandbox cleared | `ls ~/.openclaw/sandboxes 2>/dev/null \| grep agent-creator \|\| echo none` | `none`, or only sandboxes created after Round 10 so they reseed the new tool set |
| B6.7.8 | Regression — no subagent spawn during deploy | New chat: "deploy a minimal billing-support agent named Remy" | Gateway log contains zero `[agent:nested] session=agent:creator:subagent:` lines, zero `embedded run timeout: runId=… timeoutMs=1000` lines, and zero `Read: from ./SOUL.md failed` lines for the duration of this deploy |
| B6.7.9 | Regression — end-to-end deployment succeeds | Same chat session | Trace shows the B6.5.7 sequence (`gateway.config.get` → `sentura_agents_manage.create_agent` → 8× `sentura_agents_manage.write` → skills writes → `gateway.config.patch` → final `gateway.config.get` verify); `agents.list` returns the new `billing-support-rep` entry |

### B6.8. Week 2 — Creator sandbox `workspaceAccess: "rw"` (round 11)

A deep audit of `openclaw/src/agents/sandbox/` revealed that Rounds
6–10's edits to the Creator's workspace docs (AGENTS.md, TOOLS.md,
BOOTSTRAP.md) were not reaching the running agent. The sandbox
workspace-seed function
(`openclaw/src/agents/sandbox/workspace.ts:17-59`,
`ensureSandboxWorkspace`) uses `fs.writeFile(..., {flag: "wx"})`,
which only writes when the destination is missing — there is no
mtime-based refresh. With the default `workspaceAccess: "none"`, the
`/workspace` bind mount points at a separate host dir
(`~/.openclaw/sandboxes/agent-creator-<hash>/`) that is seeded
one-time. The agent kept reading a pre-round-10 AGENTS.md that still
advertised `sessions_spawn`, `sessions_yield`, `subagents`, and
`exec`, which is why the deny-list fix looked invisible from the
model's perspective.

Fix: set `sandbox.workspaceAccess: "rw"` in both the source config
and the live config. With `"rw"`
(`openclaw/src/agents/sandbox/workspace-mounts.ts:14-40`),
`/workspace` becomes a live bind of `~/.openclaw/workspace/creator/`,
so host edits are visible on the next boot without manual cleanup.
Safety: acceptable because `tools.deny` already strips `write`,
`edit`, `apply_patch`, and `exec` from Forge's tool schema, and
`sentura_agents_manage` targets other agents' workspaces, not
Forge's own. `sandbox.mode: "non-main"` still isolates Forge from
the host Sentura repo.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.8.1 | Source config sets rw | `rg -n "workspaceAccess" sentura/agents/creator/config.json5` | Matches a line inside the creator's `sandbox` block with `workspaceAccess: "rw"` |
| B6.8.2 | Live openclaw.json sets rw | `node -e "const c=require(process.env.HOME+'/.openclaw/openclaw.json'); console.log(c.agents.list.find(a=>a.id==='creator').sandbox)"` | Output is `{ mode: 'non-main', workspaceAccess: 'rw' }` |
| B6.8.3 | Sandbox docker flag is not read-only | Restart gateway, send one message to Forge, then `docker inspect openclaw-sbx-<creator-slug> --format '{{json .Mounts}}'` | The `/workspace` mount has `RW: true` and `Source` equals `~/.openclaw/workspace/creator` |
| B6.8.4 | Host edits propagate to the container | Edit a trailing line in `~/.openclaw/workspace/creator/AGENTS.md`, restart gateway, ask Forge what its AGENTS.md ends with | Forge's `read` of `/workspace/AGENTS.md` returns the newly-added line, without needing to delete the sandbox dir |
| B6.8.5 | Old sandbox path unused | `ls ~/.openclaw/sandboxes 2>/dev/null \| grep agent-creator \|\| echo none` after several Forge runs | `none` — no separate seed dir is created for Creator when `workspaceAccess: "rw"` is active (`openclaw/src/agents/sandbox/context.ts:47` resolves `workspaceDir` to the live agent dir) |
| B6.8.6 | Forge still cannot mutate its own docs | Ask Forge to overwrite its own `SOUL.md` | Forge reports that `write` / `edit` / `apply_patch` are not available (they are denied) and does not modify the file; `sentura_agents_manage` rejects the call because it validates `agentId` against its parameter rather than silently overwriting Forge's workspace |

### B6.9. Week 2 — Creator Agent TRUE end-to-end live run (round 13) — **PASSING**

This is the canonical Week-2-close-out test for Person B: drive Forge
with a real LLM against a real NL brief and prove a working AI employee
emerges. Round 13 is the first round that exercises this path; it
passed on the first clean run after the config/credential blockers
from rounds 11–12 were resolved.

**Preconditions** (must all hold before invoking the harness):
- `~/.openclaw/.env` exists (mode 600) with a valid `OPENAI_API_KEY`.
- `creator.model` is paired with a provider that accepts plain API-key
  auth (e.g. `openai/gpt-5.4`). `openai/gpt-5.3-codex` requires
  OpenAI Codex OAuth and will fail fast at the first LLM call.
- Live `openclaw.json` has a `bindings[]` entry for `webchat` DMs →
  `creator` so routing does not fall back to `agent:main:main`.
- `creator.sandbox.workspaceAccess = "rw"` so Forge sees the latest
  host copies of `AGENTS.md`/`TOOLS.md`/`BOOTSTRAP.md` (see B6.8).
- `~/.openclaw/sandboxes/agent-creator-*` does NOT exist (stale mirror
  would mask host edits even with `rw`).
- Gateway is running (`cd openclaw && pnpm gateway:watch`).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B6.9.1 | Harness gate respected | `npx tsx scripts/test-creator-e2e-live.ts` (no env var) | Exits 0 with "Skipped: SENTURA_LLM_E2E != 1" — guards against accidental LLM spend |
| B6.9.2 | Token-auth preserves admin scope | `SENTURA_LLM_E2E=1 npx tsx scripts/test-creator-e2e-live.ts` | Client connects and `config.get` returns without `not authorized: missing scope operator.admin` — proves token auth preserves scopes (unlike Control UI's insecure path) |
| B6.9.3 | Routing bypass works | Inspect harness output | Script logs `Creator acknowledged the brief; running Phase 1-4` — proves the `agent` RPC reached `agentId: "creator"` directly without binding resolution |
| B6.9.4 | Forge completes within budget | Same harness run | Harness prints `✓ PASS: Creator produced a live AI employee end-to-end` before the 5-minute deadline. Round 13 baseline: poll #22 (~110s) on `openai/gpt-5.4`. |
| B6.9.5 | New agent registered in live config | After harness exit 0: `node -e "const c=require(process.env.HOME+'/.openclaw/openclaw.json'); console.log(c.agents.list.find(a=>a.id===process.argv[1]))" <new-id>` | Entry has `id`, `name`, `model`, `runtime.type: "embedded"`, `sandbox.mode: "non-main"`, a `tools` block with `profile` + `deny`, and `skills` glob pointing at the new workspace |
| B6.9.6 | 8-file workspace materialized | `ls ~/.openclaw/workspace/<new-id>/` | All 8 OpenClaw-native files present: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `BOOTSTRAP.md`, `HEARTBEAT.md`, `IDENTITY.md`, `MEMORY.md`, `USER.md`, plus a `skills/` directory |
| B6.9.7 | NL intent → Hard Rules translation | `rg -n "Hard Rules" ~/.openclaw/workspace/<new-id>/AGENTS.md` and inspect the section | The financial/approval/safety boundaries stated in the NL brief appear verbatim or semantically equivalent under `## Hard Rules (must not override)`. Round 13 baseline: the "> £5000 → human approval" rule from the Penny brief was correctly emitted as three hard rules (NEVER approve, NEVER mark > £5000 approved, ALWAYS route > £5000 to human). |
| B6.9.8 | Skills directory is non-empty | `ls ~/.openclaw/workspace/<new-id>/skills/` | At least one skill directory exists with a populated `SKILL.md` (Round 13 baseline: `accounts-payable-reconciliation/`) |
| B6.9.9 | No subagent-spawn or 1000ms timeout regression | `grep -E 'subagent|embedded run timeout' /tmp/openclaw/openclaw-*.log` during the E2E run | Zero matches. Confirms the Round 10 denial of `sessions_spawn`/`subagents`/`sessions_yield` + AGENTS.md sync is still holding when Forge is driven by a real LLM, not just by canned tool calls. |
| B6.9.10 | No missing-auth provider error | `grep -E 'No API key found for provider|Unknown model' /tmp/openclaw/openclaw-*.log` during the E2E run | Zero matches. Confirms both the `.env` wiring and the model↔provider pairing are correct. |

**Known loose-assertions (deferred to Week 3 Person B hardening):**
- B6.9 does not verify schema conformance of the new `config.json5`
  entry beyond top-level fields, nor memory-namespace isolation, nor
  binding correctness of the new agent. Tighten by adding B6.9.11–15
  once Forge's `employee-deployment` skill is augmented to cover them.
- Harness does not clean up the created agent; operator must remove
  it via `config.patch` when done. Cleanup automation is out-of-scope
  for Week 2.

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
| B2.1 | All 8 native files documented | Read `docs/workspace-convention.md` | Documents all 8 OpenClaw native files + skills/ directory + memory/users/; explains that Hard Rules live inside AGENTS.md `## Hard Rules` and Enterprise Context lives inside BOOTSTRAP.md `## Enterprise Context` |
| B2.2 | File priority order | Check convention doc | Priority chain: AGENTS.md `§ Hard Rules` > Skills Safety > SOUL.md Escalation > AGENTS.md general > BOOTSTRAP.md `§ Enterprise Context` Policies > SOUL.md Personality |
| B2.3 | Runtime vs design-time | Check convention doc | Explains `workspaces/` in git = reference, `~/.openclaw/workspace/` = runtime, `sentura/config/templates/` = starting templates |
| B2.4 | No `workspace` field rule | Check convention doc | Explicitly states: omit `workspace` from agent configs; let OpenClaw resolve to `~/.openclaw/workspace/{agent-id}/` |
| B2.5 | Cross-team notes | Check convention doc | Contains guidance for Person C (dashboard display), Person D (extension interaction) |

### B3. Role Templates

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B3.1 | Three templates exist | `ls sentura/config/templates/` | Contains `ap-clerk/`, `cs-agent/`, `sdr/` directories + `README.md` |
| B3.2 | Template structure | `ls sentura/config/templates/cs-agent/` | Contains: config.json5, all 8 native workspace files (AGENTS.md with Hard Rules, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md with Enterprise Context, MEMORY.md), skills/ directory with at least 2 skills |
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
| B4.5 | Knowledge classification | Read the skill | Documents classification routing: procedural → SKILL.md, contextual → BOOTSTRAP.md `§ Enterprise Context`, safety → AGENTS.md `§ Hard Rules` (with approval), reference → data/ |
| B4.6 | Source handling | Read the skill | Handles URLs, PDFs, API docs, verbal descriptions |

### B5. Test Employee (GradSale CS Agent)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| B5.1 | Workspace files present | `ls workspaces/cs-agent-gradsale/` | All 8 native workspace files + config.json5 + skills/ directory present |
| B5.2 | GradSale context | Read AGENTS.md `§ Hard Rules` and BOOTSTRAP.md `§ Enterprise Context` | References real GradSale entities (listings, transactions, disputes) from `ekg/` docs |
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
| B6.5 | Phase 2 enforces Hard Rules + Enterprise Context | Read skill | Step 7 generates AGENTS.md with a `## Hard Rules (must not override)` section (explicit categories, minimum 3 rules per category) AND BOOTSTRAP.md with a `## Enterprise Context` section (Company / Organization / Systems / Policies). |
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
| B9.5 | AGENTS.md Hard Rules prohibitions | Read the `## Hard Rules` section inside AGENTS.md | NEVER embed secrets; NEVER destructive ops without approval; ALWAYS RBAC verify |
| B9.6 | Model id is registered (round 14) | `rg -n '"model"' sentura/agents/mcp-builder/config.json5` | Value is `openai/gpt-5.4` (NOT `openai/gpt-4o` — the `openai` provider in `openclaw/extensions/openai/openai-provider.ts:57-68` only registers `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.2`). No path-glob `skills:` entry, so OpenClaw auto-discovers all four workspace skills. |
| B9.7 | sessions_spawn denial matches Creator (round 14) | `rg -n 'deny|alsoAllow' sentura/agents/mcp-builder/config.json5` | `tools.deny` contains `sessions_spawn`, `subagents`, `sessions_yield`; `tools.alsoAllow` does NOT contain `sessions_spawn`. Prevents the Round-10 noop-hallucination loop when mcp-builder is first deployed. |

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
# B9.1 — 8 native workspace files + config
ls sentura/agents/mcp-builder/
# Expected entries (order may vary):
#   AGENTS.md BOOTSTRAP.md HEARTBEAT.md IDENTITY.md
#   MEMORY.md SOUL.md TOOLS.md USER.md
#   config.json5 skills/

# B9.2 — 4 skills
ls sentura/agents/mcp-builder/skills/
# Expected: api-analysis/ mcp-generation/ smoke-test/ register-server/

# B9.3 — config schema invariants
rg -n 'agents:|sandbox|profile|"coding"' sentura/agents/mcp-builder/config.json5

# B9.4 — SOUL identity
rg -n -i "name|smith|mission|mcp" sentura/agents/mcp-builder/SOUL.md | head

# B9.5 — Hard Rules prohibitions (now inlined into AGENTS.md)
rg -n -i "NEVER|secret|destructive|RBAC|approval" sentura/agents/mcp-builder/AGENTS.md
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
| B12.5 | Workspace materialized on disk | All 8 native files (AGENTS/SOUL/TOOLS/IDENTITY/USER/HEARTBEAT/BOOTSTRAP/MEMORY.md) exist in `~/.openclaw/workspace/<test-agent-id>/` |
| B12.6 | EKG pillars created | `ekg/{org,rules,assets,workflows}/` directories exist in workspace |
| B12.7 | `memory/users/` created | Per-user sub-memory directory exists |
| B12.8 | Industry ontology merged | `ekg/rules/financial-controls.json5` copied from `sentura/config/industry-ontologies/financial-services/` |
| B12.9 | AGENTS.md Hard Rules present | `## Hard Rules (must not override)` section exists in AGENTS.md and contains `NEVER`/`ALWAYS` clauses |
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
| C2.11 | Approvals scope | Read `client.ts` | Client `scopes` array includes `operator.approvals` (required to receive `*.approval.requested`/`*.approval.resolved` events) |
| C2.12 | createSession helper | Read `client.ts` | `createSession(agentId, initialMessage?)` calls `sessions.create` RPC and returns `{ sessionKey, ... }` |
| C2.13 | Agent file helpers | Read `client.ts` | `listAgentFiles(agentId)` calls `agents.files.list`; `getAgentFile(agentId, name)` calls `agents.files.get` and tolerates missing/denied files by returning `null` |
| C2.14 | Bindings helper | Read `client.ts` | `getBindingsForAgent(agentId)` reads `config.bindings` and filters to this agent |
| C2.15 | getAgent includes meta | Read `client.ts` | `getAgent(agentId)` uses `getAllAgentsIncludingMeta()` so `creator`/`tuner`/`orchestrator` can still be fetched by ID |
| C2.16 | deleteAgent helper | Read `client.ts` | `deleteAgent(agentId, { deleteFiles? })` calls `agents.delete` with optional workspace purge; returns `{ ok, agentId, removedBindings? }` |
| C2.17 | resolveApproval options | Read `client.ts` | Accepts `options.kind` (`exec`/`plugin`) to route, and optional `reason` string — passed through to the RPC payload |
| C2.18 | List historical approvals | Read `client.ts` | `listExecApprovals()` and `listPluginApprovals()` call `exec.approval.list` and `plugin.approval.list` respectively; return `[]` on RPC error |

### C3. React Hooks (`src/lib/gateway/hooks.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C3.1 | useGateway hook | Read `hooks.ts` | Manages connection lifecycle; returns client instance + connection state |
| C3.2 | useAgents hook | Read `hooks.ts` | Calls `getAgents()` (filtered); returns agents array, loading, error, refetch |
| C3.3 | useApprovals hook | Read `hooks.ts` | Accumulates approval events by ID (deduplication); listens to both exec and plugin approval events |
| C3.4 | Cleanup on unmount | Read `hooks.ts` | Event subscriptions are cleaned up when components unmount (unsubscribe functions called) |
| C3.5 | useApprovals seeds history | Read `hooks.ts` | On connect, `useApprovals` calls `client.listExecApprovals()` + `client.listPluginApprovals()` and merges results into state without duplicating IDs already received via live events |
| C3.6 | useApprovals resolves cleanup | Trigger a resolve on any pending approval | Approval is removed from the `useApprovals()` data array on `*.approval.resolved` event |

### C4. App Shell & Navigation

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C4.1 | Sidebar renders | Load dashboard in browser | Sidebar shows three sections: Enterprise, Management, Operations |
| C4.2 | Active route highlighting | Navigate between Overview and Employees | Active page is highlighted in the sidebar |
| C4.3 | Disabled items | Check sidebar items marked W3–W5 (Tune Employee, Channel Bindings, etc.) | Items are visually disabled; clicking does not navigate |
| C4.4 | Control UI links | Check Operations section in sidebar | External links to OpenClaw Control UI use `NEXT_PUBLIC_CONTROL_UI_URL` env var |
| C4.5 | Sidebar collapse | Click collapse toggle | Sidebar collapses; tooltips appear on hover for icon-only mode |
| C4.6 | Connection status | Check header area | Shows colored dot + label matching gateway connection state |
| C4.7 | App shell layout | Load any page | Full viewport height; sidebar + header + scrollable main content area |
| C4.8 | Create/Approvals enabled | Check Management and Operations sections | `/create` and `/approvals` are enabled (navigable) with no disabled styling |
| C4.9 | Live approval badge | Trigger a pending approval while dashboard is connected | Sidebar "Approvals" link shows numeric badge with destructive/alert tone equal to pending count; badge disappears when count drops to 0 |

### C5. Enterprise Overview Page (`/`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C5.1 | Page loads | Navigate to `/` | Page renders without errors |
| C5.2 | Disconnected banner | Load page without gateway running | "Gateway Disconnected" banner appears with guidance |
| C5.3 | Employee count | Load page with gateway running and agents registered | Stat card shows correct number of AI employees (excluding meta-agents) |
| C5.4 | Pending approvals | Check approval stat card | Shows count from event-driven approval list (may be 0 if no pending approvals) |
| C5.5 | Loading skeletons | Observe page during data fetch | Skeleton placeholders appear while data loads |
| C5.6 | Employee cards | Check bottom section | Shows up to 6 employee cards with links to `/employees/{id}` (path param, not query string) |
| C5.7 | Control UI link | Check System Health card | Links to Control UI at correct URL |
| C5.8 | Create Employee quick action | Click "Create Employee" card in Quick Actions | Navigates to `/create`; card is no longer dimmed/disabled |

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
| C6.10 | Create Employee enabled | Check action buttons | "Create Employee" button is enabled and links to `/create`; "Tune" remains disabled (Week 3) |
| C6.11 | Row click navigates | Click anywhere on an agent row (outside the action links) | Navigates to `/employees/{id}` detail page |

### C7. Environment Configuration

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C7.1 | .env.local.example | Read `sentura/dashboard/.env.local.example` | Contains `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_GATEWAY_TOKEN`, `NEXT_PUBLIC_CONTROL_UI_URL` |
| C7.2 | Default gateway URL | Check code | Defaults to `ws://localhost:18789` when env var not set |
| C7.3 | Default Control UI URL | Check sidebar code | Defaults to `http://localhost:18789` when env var not set |

### C8. Employee Creator Page (`/create`) — Week 2

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C8.1 | Page loads | Navigate to `/create` | Page renders without runtime errors; shows chat composer and streaming transcript area |
| C8.2 | Disconnected banner | Load page without gateway running | Shows "Gateway disconnected" state; composer is disabled or shows guidance |
| C8.3 | Session creation | Send first message | Dashboard calls `sessions.create` for the `creator` meta-agent; subsequent messages reuse the returned `sessionKey` |
| C8.4 | Message streams | Send a message that triggers a non-trivial Creator response | UI renders incremental deltas from `chat` events with `state: "delta"`, then finalizes on `state: "final"` |
| C8.5 | Creator target | Inspect `chat.send` payload (network tab or `NEXT_PUBLIC_GATEWAY_VERBOSE=1` logs) | `agentId` is `creator` (meta-agent), not a real employee |
| C8.6 | Error handling | Disconnect gateway mid-stream | Assistant message is marked as errored or truncated; composer becomes re-enabled; user can retry |
| C8.7 | Composer keyboard | Press Enter in textarea | Submits message; Shift+Enter inserts newline |
| C8.8 | Transcript scrolls | Send several messages | Transcript auto-scrolls to newest message |
| C8.9 | Cross-link to new employee | When Creator finishes deploying an employee and mentions its id | User can navigate to `/employees/{id}` (either via a link in the UI or via the roster) and see the new agent |
| C8.10 | Session key persists across navigation | Start a chat, navigate away to `/employees`, then back to `/create` | Previous messages are restored via `chat.history`; session badge shows same id; a "Restoring conversation…" indicator briefly appears |
| C8.11 | Session key persists across reload | Start a chat, hard-reload `/create` | After gateway reconnects, transcript is rehydrated; composer reuses the saved `sessionKey` for the next `chat.send` |
| C8.12 | New conversation button | With an active session, click "New" in the header | `sessionKey` and `messages` cleared; `localStorage["sentura.create.sessionKey"]` removed; next message calls `sessions.create` again |
| C8.13 | Stale session recovery | Manually delete the session server-side (or wait for pruning) while a saved `sessionKey` is in `localStorage`, then load `/create` | Hydration fails gracefully; saved key is dropped; empty state renders; user can start a new conversation |
| C8.14 | Idempotency key on chat.send | Send a second message in an existing session | `chat.send` payload includes a non-empty `idempotencyKey` (auto-generated via `crypto.randomUUID`); gateway does not reject with `missing property 'idempotencyKey'` |
| C8.15 | Conversation sidebar renders | Load `/create` with multiple prior creator sessions on the gateway | Left sidebar lists one entry per session filtered to `agentId=creator`; entries show label/displayName and relative `updatedAt`; most recent sits on top |
| C8.16 | New employee draft flow | Click "+ New employee" in the sidebar | A new draft appears as the active conversation with default label "New employee"; transcript area clears; no `sessions.create` call is made yet |
| C8.17 | First message creates server session | Send the first message in a draft | `sessions.create` is called with `{ agentId: "creator", message, label }`; returned `sessionKey` becomes `activeKey`; sidebar refreshes and shows the new entry |
| C8.18 | Switching conversations rehydrates transcript | With ≥2 creator sessions, click another entry in the sidebar | Current transcript clears; `chat.history` is called for the selected `sessionKey`; previous messages render; composer targets the selected session |
| C8.19 | Rename conversation | Click the rename affordance on a sidebar row, edit label, submit | `sessions.patch` is called with `{ key, label }`; sidebar label and header title update immediately; reload confirms label persists |
| C8.20 | Delete conversation | Click delete on a sidebar row and confirm in the dialog | `sessions.delete` is called with `{ key }` (not `sessionKey`); entry disappears; if it was active, view falls back to welcome state or nearest sibling |
| C8.21 | Active conversation persisted across reloads | Select a conversation, hard-reload `/create` | `localStorage["sentura.create.activeKey"]` restores selection; transcript rehydrates via `chat.history`; draft label is restored if the active item is a draft |

### C9. Employee Detail Page (`/employees/[id]`) — Week 2

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C9.1 | Page loads | Navigate to `/employees/{existing-agent-id}` | Page renders with agent name, id, and header actions |
| C9.2 | Agent not found | Navigate to `/employees/does-not-exist` | Friendly "not found" state; link back to `/employees` |
| C9.3 | Workspace file list | Check file section | Shows the 8 native files from `agents.files.list` (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) and `skills/*` |
| C9.4 | Allow-list content | Click into `SOUL.md` or another allow-listed file | File content is rendered inline |
| C9.5 | Denied file fallback | Click into a file not in the dashboard allow-list | File entry appears in list, but content panel shows an "Edit in Control UI" link instead of raw content (no RPC error surfaced to the user) |
| C9.6 | Channel bindings | Section lists bindings | Calls `config.bindings` via `getBindingsForAgent`; shows channel name + target for bindings scoped to this agent |
| C9.7 | Refresh action | Click Refresh | Reloads agent config, files list, and bindings without full page reload |
| C9.8 | Tune disabled | Check Tune button | Present but disabled with "Week 3" tooltip |
| C9.9 | Edit in Control UI | Click the Control UI link | Opens external link to `${NEXT_PUBLIC_CONTROL_UI_URL}` targeting this agent's config |
| C9.10 | Retire (confirmation) | Click Retire | Confirmation dialog appears; cancelling closes dialog without calling `agents.delete` |
| C9.11 | Retire (delete) | Confirm retirement | Calls `client.deleteAgent(agentId)`; on success redirects to `/employees`; agent no longer appears in roster |
| C9.12 | Meta-agent fetch | Navigate to `/employees/creator` | Page loads (meta-agents are not hidden from detail view via direct URL) — confirms `getAgent` uses `getAllAgentsIncludingMeta` |

### C10. Approval Queue Page (`/approvals`) — Week 2

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C10.1 | Page loads | Navigate to `/approvals` | Page renders with header, Control UI link, and pending count |
| C10.2 | Empty state | No pending approvals | Shows empty-state message (e.g. "No pending approvals") |
| C10.3 | Disconnected state | Load page without gateway | Card warns user that live approvals require the gateway; list area is empty |
| C10.4 | Historical seed | Start gateway with existing pending approvals, then load `/approvals` | All pre-existing pending approvals appear (seeded via `exec.approval.list` + `plugin.approval.list`) — page does NOT require a fresh event to show them |
| C10.5 | Live request event | Trigger a new high-risk tool call from an employee | New approval card appears in the list without page reload |
| C10.6 | Live resolved event | Approve/deny an approval from another client (e.g. Control UI) | Card disappears from this page within ~1s |
| C10.7 | Exec vs plugin kind | Inspect cards | Exec approvals show a terminal icon + command (`$ ...` code block); plugin approvals show a shield icon + plugin title/subtitle |
| C10.8 | Countdown timer | Card with `expiresAtMs` in the future | Shows remaining time; updates once per second; becomes urgent (alert tone) near expiry |
| C10.9 | Show details toggle | Click "Show details" | Expands to show full raw request payload as formatted JSON; toggles back on second click |
| C10.10 | View employee link | Click "View employee" | Navigates to `/employees/{agentId}` of the approval's agent |
| C10.11 | Approve once | Click Approve once → confirm | Calls `client.resolveApproval(id, "allow-once", { kind, reason })`; card removed |
| C10.12 | Always allow | Click Always allow → confirm | Calls `resolveApproval` with `"allow-always"` — confirmation dialog explicitly warns this persists |
| C10.13 | Deny with reason | Click Deny → type reason → confirm | Calls `resolveApproval` with `"deny"` and the typed `reason`; audit log (via sentura-audit) should contain this reason |
| C10.14 | Confirmation cancel | Open any decision dialog → click Cancel or press Escape | Dialog closes with no RPC call; reason field and any error reset |
| C10.15 | RPC error handling | Simulate RPC failure (e.g. kill gateway mid-confirm) | Error message shown inline on the dialog; card remains pending; user can retry |
| C10.16 | Sidebar sync | Resolve an approval on this page | Sidebar badge count decrements via `useApprovals` (same source) without manual refresh |
| C10.17 | Scope required | Verify client connects with `operator.approvals` scope | Events actually arrive; if scope is stripped, approvals never appear even when triggered (regression guard) |

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
| X2.1 | AGENTS.md Hard Rules respected | Create agent with a clear Hard Rule in `AGENTS.md § Hard Rules`, test with a prompt that would violate it | Agent refuses to violate the boundary defined in Hard Rules |
| X2.2 | BOOTSTRAP.md Enterprise Context available | Create agent with enterprise-specific knowledge under `BOOTSTRAP.md § Enterprise Context`, ask about it | Agent references the enterprise context in its response |
| X2.3 | Convention compliance | Check `workspaces/cs-agent-gradsale/` against `docs/workspace-convention.md` | All 8 native files present; AGENTS.md has `§ Hard Rules`; BOOTSTRAP.md has `§ Enterprise Context`; file content follows documented structure |

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

Person A: __ / 98 passed   (74 + 12 A14 sandbox-seed + 12 A15 sentura-agents extension cases)
Person B: __ / 101 passed  (65 + 20 B12 live-gateway + 6 B6.2 deployment-skill rewrite + 10 B6.9 live E2E cases)
Person C: __ / 85 passed   (33 Week 1 + 52 Week 2 cases across C2.11–C10.17)
Person D: __ / 31 passed (22 automated + 9 manual)
Cross-team: __ / 13 passed

Total: __ / 328

Notes:
- ...
```
