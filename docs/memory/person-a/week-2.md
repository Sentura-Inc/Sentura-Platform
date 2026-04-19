> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Read when the current task touches the specific subsystem this session covered.

# Person A — Platform & OpenClaw — Week 2

Week 2 Person A scope: sentura-platform TS lib (workspace creation, agent registration, channel bindings, memory isolation), per-user memory token infrastructure, 7-role RBAC wiring, and the reevaluation / bug-fix pass that followed live integration testing.

> For the 14 Creator-deployment bug-fix rounds that hit Week 2 (Person A shipped the sentura-agents extension, commands.ownerAllowFrom, exec host routing, and stale-sandbox seed hook in that series), see [`../shared/creator-deployment-rounds-1-14.md`](../shared/creator-deployment-rounds-1-14.md).

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-15 | Week 2 Person A: Platform Utilities, Memory Isolation, User Tokens, RBAC Update |
| 2026-04-16 | Week 2 Person A: Reevaluation & Bug Fixes |

---

## 2026-04-15 — Week 2 Person A: Platform Utilities, Memory Isolation, User Tokens, RBAC Update

**What was done:**

All 7 Person A Week 2 tasks completed, plus RBAC extension updated to the 7-role model:

1. **Automated workspace directory creation** (`sentura/lib/workspace.ts`) — W2A-1:
   - `createWorkspace()` generates full agent workspace: 10 core files (8 OpenClaw + RULES.md + CONTEXT.md), `skills/`, `ekg/{org,rules,assets,workflows,workflows/experience-links}/`, `memory/users/`
   - Supports template directories and industry ontology merging
   - Preserves existing files (no overwrite)

2. **Agent registration via config.patch** (`sentura/lib/agent-registration.ts`) — W2A-2:
   - `buildAgentPatch()` creates JSON5 merge-patches for runtime use by meta-agents via `gateway` tool
   - `registerAgentOnDisk()` for direct config file modification (setup scripts)
   - `buildMemoryDbPath()`, `isAgentRegistered()`, `buildGatewayToolCall()` helpers

3. **Hot-reload test** (`scripts/test-hot-reload.sh`) — W2A-3:
   - 6-step bash script: creates temp workspace with ekg/ and memory/users/, registers agent via direct config patching, verifies presence and memoryDbPath, cleans up

4. **MCP loopback server configuration** (`sentura/lib/mcp-loopback.ts` + `scripts/configure-mcp-loopback.sh`) — W2A-4:
   - `buildLoopbackServerConfig()` configures OpenClaw's internal `channel-server.js` as `openclaw-loopback` MCP server
   - `buildEnterpriseMcpServer()` and `buildRemoteMcpServer()` for generic MCP server config
   - Idempotent setup script

5. **Channel binding helpers** (`sentura/lib/channel-bindings.ts`) — W2A-5:
   - `createWebchatBinding()`, `createSlackChannelBinding()`, `createSlackDmBinding()`, `createTeamsBinding()`, `createDiscordBinding()`, `createTelegramBinding()`, `createWhatsAppBinding()`
   - `buildBindingsPatch()` for runtime, `addBindingsOnDisk()` / `removeAgentBindingsOnDisk()` for setup
   - Deduplication on add

6. **Per-agent LanceDB isolation** (`sentura/lib/memory-isolation.ts`) — W2A-6:
   - Convention: `~/.openclaw/memory/{agentId}/lancedb` per agent
   - `applyMemoryIsolationOnDisk()` sets `params.memoryDbPath` for all agents in config
   - `validateMemoryIsolation()` audits for unique paths
   - `sentura-setup.sh` updated with Step 5 to configure meta-agents' dbPaths

7. **User token infrastructure** (`sentura/lib/user-token.ts`) — W2A-7:
   - `generateUserToken()` (UUID v4), `buildSessionKey()` format `agent:{agentId}:user:{userToken}:{sessionId}`
   - `parseSessionKey()`, `isUserSession()`, `extractUserToken()` for key inspection
   - `userMemoryFileName()` / `userMemoryFilePath()` / `ensureUserMemoryFile()` for per-user MEMORY_USER_{token}.md files
   - `buildAuditMeta()`, `buildConnectionMeta()`, `hashUserToken()` for attribution

8. **RBAC 7-role model update** — Updated `sentura/extensions/sentura-rbac/`:
   - `src/types.ts` — 7 roles: `platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`; added `userToken` to `SenturaUser`
   - `src/roles.ts` — Full `ROLE_DEFINITIONS` for all 7 roles with permissions, operator scopes, data tier access
   - `src/store.ts` — Added `getUserByToken()` method; updated scope filtering for new roles
   - `src/authorizer.ts` — Updated method policies for new Sentura RPC methods (users, departments, EKG, MCP builder)
   - `index.ts` — Auto-assigns `userToken` on upsert; added `sentura.rbac.users.resolveByToken` RPC

9. **Bootstrap hook updated** — `sentura/hooks/sentura-bootstrap/handler.ts`:
   - Extracts `userToken` from session key
   - Injects `MEMORY_USER_{token}.md` into agent system prompt if present

**Files created:**
- `sentura/lib/workspace.ts`
- `sentura/lib/agent-registration.ts`
- `sentura/lib/channel-bindings.ts`
- `sentura/lib/memory-isolation.ts`
- `sentura/lib/user-token.ts`
- `sentura/lib/mcp-loopback.ts`
- `sentura/lib/index.ts`
- `sentura/lib/package.json`
- `sentura/lib/tsconfig.json`
- `scripts/test-hot-reload.sh`
- `scripts/configure-mcp-loopback.sh`

**Files modified:**
- `sentura/extensions/sentura-rbac/src/types.ts` — 7-role model + userToken
- `sentura/extensions/sentura-rbac/src/roles.ts` — 7-role definitions
- `sentura/extensions/sentura-rbac/src/store.ts` — getUserByToken, updated scope logic
- `sentura/extensions/sentura-rbac/src/authorizer.ts` — expanded method policies
- `sentura/extensions/sentura-rbac/index.ts` — userToken auto-assign, resolveByToken RPC
- `sentura/hooks/sentura-bootstrap/handler.ts` — userToken extraction, per-user memory injection
- `scripts/sentura-setup.sh` — added Step 5 (LanceDB memory isolation for meta-agents)
- `docs/TeamPlan.md` — marked all Person A Week 2 tasks as done
- `docs/TESTS.md` — added Week 2 test cases (A4–A11), updated totals from 120 to 164
- `docs/MEMORY.md` — this entry

**Key architectural decisions:**
1. All utility modules live in `sentura/lib/` with a barrel export — shared between setup scripts, meta-agents, and extensions
2. Dual-mode design: every utility works both as importable TypeScript (for meta-agents/extensions) and as inline Node.js scripts in bash (for setup automation)
3. Per-agent LanceDB isolation uses `params.memoryDbPath` (agent config's custom params object) — no OpenClaw core changes needed
4. `userToken` is a UUID v4 stored in the RBAC user record — serves as identity primitive for session keys, memory files, and audit attribution
5. Session key format `agent:{agentId}:user:{userToken}:{sessionId}` embeds user identity directly in the key for efficient extraction without database lookups
6. RBAC expanded from 5 to 7 roles — `manager` (supervision), `ekg_manager` (knowledge), `agent_manager` (agent config), `viewer` (read-only dashboards) are now distinct security domains

**Nothing left incomplete.** All 7 Person A Week 2 tasks are done.

**Known issues:** None introduced.

---

### 2026-04-16 — Week 2 Person A: Reevaluation & Bug Fixes

Reevaluated all Week 2 implementation against live OpenClaw gateway. Found and fixed 5 bugs:

**Bugs found and fixed:**
1. **RBAC authorizer type error** — `MethodAction` type was missing `"update"`, causing `agents.update` policy to fail TypeScript compilation. Fixed in `sentura/extensions/sentura-rbac/src/authorizer.ts`.
2. **Setup script missing ekg/ and memory/users/ directories** — `copy_workspace()` only copied source files; Sentura-specific runtime dirs (`ekg/org`, `ekg/rules`, `ekg/assets`, `ekg/workflows/experience-links`, `memory/users/`) were never created. Fixed by adding `mkdir -p` block after workspace copy step.
3. **Setup script CLI `--value` flag error** — `openclaw_cli config set ... --value` is not supported by the CLI. Replaced with direct JSON file patching via node.
4. **Setup script idempotency failure** — `register_agent()` used `openclaw_cli agents list --json | grep` which didn't work reliably; `agents add` exited non-zero for existing agents, killing the script. Fixed by checking the config file directly via `node -e`.
5. **Tuner/Orchestrator missing RULES.md and CONTEXT.md** — Source directories only had `config.json5` and `skills/`. Created proper RULES.md (safety guardrails) and CONTEXT.md (enterprise context) for both agents.

**Files created:**
- `sentura/agents/tuner/RULES.md` — Refine's hard boundaries
- `sentura/agents/tuner/CONTEXT.md` — Refine's enterprise context
- `sentura/agents/orchestrator/RULES.md` — Conductor's hard boundaries
- `sentura/agents/orchestrator/CONTEXT.md` — Conductor's enterprise context

**Files modified:**
- `sentura/extensions/sentura-rbac/src/authorizer.ts` — added `"update"` to `MethodAction` type
- `scripts/sentura-setup.sh` — fixed 3 issues (idempotency, ekg/memory dirs, CLI --value)
- `scripts/test-gateway-integration.ts` — added bootstrap hook config & workspace file checks (28 tests total)

**Test results after fixes:**
- `scripts/test-week2.ts`: 86/86 passed (unit tests)
- `scripts/test-gateway-integration.ts`: 28/28 passed (live gateway)
- TypeScript compilation: 0 errors with `--esModuleInterop --skipLibCheck`
- Setup script idempotency: confirmed (two consecutive runs, both exit 0)
- Bootstrap hook loaded by gateway: confirmed (5 handlers = 4 bundled + 1 managed)

