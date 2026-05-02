# Sentura Tests — Person A (Platform & OpenClaw)

> Detailed test cases. Summary matrix lives in `docs/TESTS.md`. Read on demand.

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

### A16. Week 4 — Multi-tenancy (`sentura/lib/tenancy.ts` + `TenancyStore`)

Run: `npx tsx scripts/test-week4-tenancy.ts` (offline — uses temp `OPENCLAW_HOME`).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A16.1 | TenancyStore upsert | Set `{agentId, tenantId, departmentId}` | Returns the new record with the right fields |
| A16.2 | TenancyStore idempotency | Re-set same scope | Returns the same `updatedAt` (no rewrite) |
| A16.3 | listByDepartment scopes correctly | Two agents in two departments | `listByDepartment("finance")` returns only the finance agent |
| A16.4 | `setAgentTenancy` defaults | Call with empty scope | Defaults to `tenantId="default"`, `departmentId=null` |
| A16.5 | `getAgentTenancy` returns null for unknown | Call with non-existent agentId | Returns `null` (callers fall back to default tenancy) |
| A16.6 | `resolveTenantContext` combines session key + tenancy | Sentura session key `agent:ap-clerk:user:<uuid>:s1` | Returns `{agentId, tenantId, departmentId, userToken}` with all four extracted |
| A16.7 | `resolveTenantContext` falls back to default tenancy | Session key for an agent with no tenancy record | `tenantId = "default"`, `departmentId = null` |
| A16.8 | `resolveTenantContext` returns null for non-Sentura keys | `"openclaw-cli-session-12345"` | Returns `null` (raw CLI sessions can't be attributed) |
| A16.9 | `applyDefaultTenancyOnDisk` first-run seeds | 3 agents, no existing records | Returns 3 seeded agentIds |
| A16.10 | `applyDefaultTenancyOnDisk` idempotent re-run | Run twice on the same config | Second run returns `[]` |
| A16.11 | `applyDefaultTenancyOnDisk` preserves manual scopes | Manually set `creator → {tenantId: "platform"}` then re-run | Manual scope survives |

### A17. Week 4 — `sentura-memory-lancedb` fork (per-user metadata partitioning)

Run: `npx tsx scripts/test-week4-memory.ts` (offline — pure logic; live LanceDB coverage in `memory-lancedb.live.test.ts`).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A17.1 | user-plus-global default | Three rows: alice / bob / global | alice sees own + global; bob sees own + global; unknown caller sees only globals |
| A17.2 | user-only mode | Three rows: alice / bob / global | alice sees only `alice`; empty caller returns `[]` (does NOT match global by accident) |
| A17.3 | global-only mode | Disables partitioning | Returns every row regardless of caller |
| A17.4 | Pre-migration fallback | `hasUserTokenColumn=false` + user-only scope | Returns all rows (legacy memories don't disappear until migration runs) |
| A17.5 | Two-user isolation | 2 alice rows + 2 bob rows + 1 global, both query | Disjoint own-rows; both see the shared global |
| A17.6 | Session-key parser | `agent:ap-clerk:user:<uuid>:s1` | Correctly extracts agentId + userToken |
| A17.7 | Non-Sentura session keys | `"session-12345"`, `"agent:cs-agent:cli:xyz"`, `undefined`, `null` | All return empty userToken |
| A17.8 | Migration idempotency | Run `migrate-userToken` twice on the same store | Second run is a no-op (`status: "already-migrated"`) |
| A17.9 | Setup script disables upstream memory-lancedb | `~/.openclaw/openclaw.json` after Step 7a runs | `plugins.entries["memory-lancedb"].enabled = false` when `sentura-memory-lancedb` is enabled |
| A17.10 | Live: tools registered as factories | Boot Forge with two sessions for two users | Each session gets a separate `memory_recall` tool with its own `userToken` baked in |

### A18. Week 4 — `sentura-cost` extension (model.usage subscriber + JSONL store)

Run: `npx tsx scripts/test-week4-cost.ts` (offline — synthetic events, temp store).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A18.1 | aggregateByAgent sort order | 3 events with different costs | Buckets sorted by `totalCostUsd` desc |
| A18.2 | aggregateByDepartment treats null as "(unassigned)" | Mix of `departmentId: "finance" / null` | `null` rolls up under the literal key `"(unassigned)"` |
| A18.3 | aggregateByTenant + aggregateByModel | Mixed tenants + provider/model strings | Correct totals per `tenantId` and `provider/model` |
| A18.4 | aggregateByUser groups empty as "(anonymous)" | Mix of populated and empty `userToken` | Empty token rolled up under `"(anonymous)"` |
| A18.5 | Unpriced events isolated from totalCostUsd | Mix of `costUsd: 0.5 / null` | `unpricedCalls` counts the nulls; `totalCostUsd` excludes them (NOT zero) |
| A18.6 | summarize composes the full view | Multiple events across agents | `byAgent`, `byDepartment`, `byModel`, `byTenant` populated; `period` preserved |
| A18.7 | CostStore round-trip | Append 3 events, query, readRange | Returns all 3; query by agentId filters; limit/offset paginates |
| A18.8 | Cross-department isolation | 3 events split between finance and support | `aggregateByDepartment` produces disjoint cost totals |
| A18.9 | Live: `model.usage` subscription captures real LLM calls | Boot gateway, run a session, check `~/.openclaw/sentura-cost/cost-YYYY-MM-DD.jsonl` | At least one row per LLM call with correct `agentId`, `costUsd`, `usage.totalTokens` |
| A18.10 | Live: `sentura.cost.summary` RPC | Gateway RPC call after some traffic | Returns `byAgent`/`byDepartment`/`byModel`/`byTenant` with non-empty buckets |
| A18.11 | `sentura.cost.byUser` hashes tokens | RPC call | Bucket keys are 16-hex-char SHA256 prefixes (or `"(anonymous)"`), never raw UUIDs |

### A19. Week 4 — `sentura-monitoring` extension (health endpoints)

Run: `npx tsx scripts/test-week4-health.ts` (offline — pure logic).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A19.1 | checkGateway uptime + memory | `now=t1, startedAt=t0, rss=50MB` | `uptimeSeconds = (t1-t0)/1000`, `memoryRssMb ≈ 50`, status `"ok"` |
| A19.2 | checkEmployees status escalation | All 3 registered → all unregistered | `"ok"` → `"down"` |
| A19.3 | checkEmployees windowing | Only 1 of 3 active in last 5 minutes | `active = 1` |
| A19.4 | checkEmployees orphan handling | Agent registered but no tenancy record | Falls back to `tenantId="default"`, `departmentId=null` |
| A19.5 | checkProviders ok / degraded / down | Recent / stale / never-active providers | Status reflects activity vs window |
| A19.6 | checkProviders aggregate degraded | One ok + one down | Aggregated status is `"degraded"` |
| A19.7 | buildSummary composition | Compose gateway + employees + providers | `generatedAt` ISO; nested objects present |
| A19.8 | Live: `sentura.health.summary` RPC | Gateway RPC call | Returns the summary shape; `gateway.uptimeSeconds > 0` |

### A20. Week 4 — OpenTelemetry wiring (Step 7c)

Run: `npx tsx scripts/test-week4-otel.ts` (offline — replays the Step 7c node-patcher against synthetic configs).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A20.1 | OTEL_EXPORTER_OTLP_ENDPOINT set → enables | Replay Step 7c with env var | `plugins.entries["diagnostics-otel"].enabled = true`, `diagnostics.otel.{enabled,endpoint,serviceName}` stamped |
| A20.2 | Endpoint unset → no-op | Replay with env var unset | No mutations to the config |
| A20.3 | Idempotent re-run | Same endpoint twice | Second run reports `changed=false` |
| A20.4 | Endpoint change re-stamps | Run with two different endpoints | Second run flips `changed=true` and updates `endpoint` |
| A20.5 | Operator serviceName preserved | Manually set `serviceName` then re-run | Custom name survives the re-run |
| A20.6 | docs/otel/docker-compose.example.yml present | Read file | Contains OTEL_EXPORTER_OTLP_ENDPOINT, port 4318, port 16686 |
| A20.7 | Live: traces visible in Jaeger | Set env var to `http://localhost:4318`, restart gateway, run a session | At least one trace with `service.name = openclaw-sentura` visible at `http://localhost:16686` |

### A21. Week 4 — Gateway concurrency perf harness

Run: `npx tsx scripts/test-concurrent-employees.ts` (LIVE — requires gateway on :18789).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| A21.1 | Baseline single client × 1 call per method | Default flags | Exit 0; reports baseline mean per method |
| A21.2 | Concurrent N clients × M calls | `--clients 5 --calls 10` | Exit 0 if every method's p95 ≤ 2× baseline mean; throughput in calls/sec reported |
| A21.3 | Cost-mix variant | `--mix cost` (after Week 4 cost RPCs ship) | Exits with verdict; `sentura.cost.summary` and `sentura.health.summary` included in the report |
| A21.4 | Errors fail the run | Force a bad RPC name | Exit code 1, error count surfaces in the table |
| A21.5 | Verdict gate | A method exceeds 2× budget | Exit code 2 with `FAIL` line per method that breached |
