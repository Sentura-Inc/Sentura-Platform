> **On-demand reference — not read by default.** Open from [`docs/MEMORY.md`](../../MEMORY.md) when you need this session's prose, diffs, and verification steps.

# Person D — Extensions & Integrations — Week 4

Sentura's Week-4 sprint scope for Person D was multi-tenancy, audit + data-classification depth, MCP server expansion, MCP health monitoring, and a security scanner. The core idea: every Sentura extension should now be tenant-aware, audit every action with a data-tier label, and surface a live read-only health view of the MCP fleet to dashboards and agents.

## Sessions in this file

| Date | Title |
|---|---|
| 2026-05-01 | Week 4 Person D — Audit T0–T4 + Multi-Tenancy + MCP Health + Security Scanner |

---

## 2026-05-01 — Week 4 Person D — Audit T0–T4 + Multi-Tenancy + MCP Health + Security Scanner

### Goal

Land all eight Person-D Week-4 deliverables in one branch (`person-d-week4`):

1. Comprehensive audit logging — every action, every tool call, searchable.
2. T0–T4 data classification on every audit entry.
3. Multi-tenancy threaded through audit, approval, and (consumer-side) RBAC.
4. Audit hooks for the Communication Panel (capability #16) — single messages and group lifecycle.
5. Two more open-source (Tier 1) + one more enterprise (Tier 2) MCP servers.
6. Live MCP server health monitoring with audit emit on status changes.
7. Security scanner for risky agent configurations.
8. Both offline and live OpenClaw verification.

### Files touched / created

**Audit extension (`sentura/extensions/sentura-audit/`):**
- `src/types.ts` — added 7 new event types (`chat_message`, `chat_group_created/updated/archived/fanout`, `mcp_health_check`, `mcp_health_change`); added `DataTier` literal union (`T0…T4`); added `AuditMetadata` (channel, userId, userToken, tenantId, departmentId, groupId, mcpServer, argumentsDigest); widened `AuditQueryParams` with `tenantId`/`departmentId`/`userId`/`groupId`/`dataTier`/`search`; added `defaultDataTier` to `AuditConfig`.
- `src/store.ts` — extended `matchesQuery` with the six new filter clauses + a free-text contains-match against the JSON of `details`+`metadata`.
- `src/store.test.ts` — 6 new test cases for tenant/department/user/group/tier/search filters and a composite filter.
- `src/data-tier.test.ts` — new file, 7 cases asserting `classifyDataTier` mappings for each event-type group.
- `src/security-scanner.ts` + `src/security-scanner.test.ts` — new files (scanner core + 12 cases).
- `src/tool.ts` — widened the `sentura_audit_query` agent tool's input schema with the six new filters and the seven new event types; extended `summarizeDetails` for the new event groups.
- `index.ts` — new helpers `classifyDataTier`, `extractUserTokenFromSessionKey`, `sha8`, `pickMetadata`; `emit()` now stamps `dataTier` and `metadata` on every entry; new gateway RPCs `sentura.audit.chat.log`, `sentura.audit.group.log`, `sentura.audit.mcp.health`; existing RPCs unchanged in shape but `sentura.audit.stats` adds `byTier` and `byTenant` rollups; existing hooks (`before_tool_call`, `after_tool_call`, `session_start`, `message_received`, `message_sent`) now pass channel + arguments-digest into metadata.
- `openclaw.plugin.json` — added `defaultDataTier` to `configSchema.properties` (enum T0…T4, default T1).

**Approval extension (`sentura/extensions/sentura-approval/`):**
- `src/types.ts` — added optional `tenantId` / `departmentId` to `ApprovalRequest` and `ApprovalQueryParams`.
- `src/store.ts` — `query()` now filters by `tenantId`/`departmentId`.
- `src/store.test.ts` — new file (7 cases): basic flow + tenant isolation + department filter + sweep + persistence reload.
- `index.ts` — `sentura_approval_request` agent tool widened with optional `tenantId`/`departmentId` input fields; the three `ApprovalRequest` constructions inside `execute()` (auto_approve / auto_deny / pending) now stamp those fields; `FileApprovalParams` widened so the imperative path also threads them through.

**New extension `sentura/extensions/sentura-mcp-health/`:**
- `package.json`, `openclaw.plugin.json`, `api.ts` — standard scaffolding mirroring the other Sentura extensions.
- `src/types.ts` — `McpServerStatus` (`up|degraded|down|unknown`), `McpServerHealth`, `McpHealthConfig`, `CheckResult`, `CheckStrategy`, `McpServerEntry` shapes.
- `src/monitor.ts` — pure `applyCheck(current, result, config) → { next, previousStatus, changed }` state machine + `HealthMonitor` orchestrator class with `start/stop/runOnce`, `upsertServer`, `removeServer`, `list/get` and callback-based `onChange`/`onCheck` (no I/O inside the orchestrator).
- `src/monitor.test.ts` — 9 cases: pure state-machine transitions + monitor orchestration.
- `index.ts` — `defaultCheckStrategy` (stdio MCP `initialize`+`tools/list` ping with `AbortController` timeout, plus a `HEAD` fallback for `url`-based servers); `loadSnapshots`/`persistSnapshots` to `~/.openclaw/sentura-mcp-health/health.json`; gateway RPCs `sentura.mcp.health.list`, `sentura.mcp.health.get`, `sentura.mcp.health.checkNow`; agent-callable tool `sentura_mcp_health`; audit-emit-on-transition (best-effort gateway-RPC call to `sentura.audit.mcp.health`, swallowed on error so a broken audit pipeline can't take the monitor down).

**MCP servers:**
- `sentura/mcp-servers/github/config-snippet.json5` + `README.md` — Tier 1, paste-in `mcp.servers.github` for `@modelcontextprotocol/server-github`.
- `sentura/mcp-servers/postgres/config-snippet.json5` + `README.md` — Tier 1, read-only-by-design Postgres via `@modelcontextprotocol/server-postgres`.
- `sentura/mcp-servers/gradsale-search/` — Tier 2 server generated from `ekg/api-web.md` Sections 2/9/15/17. 8 read-only tools (`gradsale_search_get_public_profile`, `gradsale_search_get_user_ratings`, `gradsale_search_get_user_transaction_stats`, `gradsale_search_get_user_verification_status`, `gradsale_search_list_universities`, `gradsale_search_geocode_address`, `gradsale_search_reverse_geocode`, `gradsale_search_users`). All tools advertise `readOnlyHint: true / destructiveHint: false`. Single-source `src/index.ts` + `src/server.test.ts` (11 tests). `pnpm build` produces `dist/index.js`; OpenClaw spawns it with `command: node`, per the post-Round-16 native wiring.

**Security scanner:**
- `sentura/extensions/sentura-audit/src/security-scanner.ts` — pure `scan(input) → SecurityFinding[]` over an `OpenClawConfigShape` plus an optional `agentsMdByAgentId` map. 7 check families: sandbox-mode, wildcard tools.allow, high-risk tools (`exec`/`browser`/`shell`/`bash`/`eval`/etc.), missing `## Hard Rules (must not override)` header, oversized AGENTS.md (>11 500 chars — guards the OpenClaw 12 000-char injection truncation), raw-secret regex match in AGENTS.md or MCP env, channel-bound agent missing `escalateTo`. Plus `summarize(findings)`.
- `sentura/extensions/sentura-audit/src/security-scanner.test.ts` — 12 cases covering each finding type (positive + negative cases, including the `$secret:` reference exemption).
- `scripts/scan-agent-security.ts` — CLI driver. Reads `~/.openclaw/openclaw.json` and `~/.openclaw/workspace/<id>/AGENTS.md`, prints text or JSON, exits 0 (no criticals) / 1 (blocking criticals) / 2 (config not found).

**Live test:**
- `scripts/test-week4-d.ts` — gateway WebSocket integration test using the canonical handshake from `scripts/probe-creator-tools.ts:71-173`. Exercises every new RPC (chat, group lifecycle, MCP health audit, query with tenant/group/tier filters, stats with byTier/byTenant rollups, MCP health list/get, approval list with tenant filter).

**Operator config touch:**
- `~/.openclaw/openclaw.json` — removed stale `sentura-experience-extraction` entry (Person B Week 4 deliverable that doesn't exist on the `person-d-week4` branch — the gateway refused to start with the dangling reference) and added `sentura-mcp-health` to both `plugins.entries` and `plugins.load.paths`. Backup at `~/.openclaw/openclaw.json.bak.pre-w4d-test`.

### Verification

**Offline (vitest):**

```
$ cd openclaw && npx vitest run --config test/vitest/vitest.sentura.config.ts
Test Files  9 passed (9)
Tests  96 passed (96)

$ cd sentura/mcp-servers/gradsale-search && pnpm test
Test Files  1 passed (1)
Tests  11 passed (11)
```

Total: **107 offline tests green, 0 failures.**

`pnpm --filter @sentura/mcp-gradsale-search build` succeeds with no TypeScript errors.

**Live (OpenClaw gateway running):**

Gateway started cleanly with all six Sentura extensions including the new `sentura-mcp-health`:

```
[gateway] ready (11 plugins: acpx, browser, device-pair, phone-control,
  sentura-agents, sentura-approval, sentura-audit, sentura-mcp-health,
  sentura-provisioner, sentura-rbac, talk-voice; 4.5s)
```

`scripts/test-week4-d.ts` end-to-end:

```
✓ connect
✓ audit.chat.log human→agent
✓ audit.chat.log agent→human
✓ audit.chat.log rejects bad direction
✓ audit.group.log created / fanout / archived
✓ audit.mcp.health up / down
✓ audit.query tenantId filter (entries=5)
✓ audit.query groupId filter — every entry's metadata.groupId matches (entries=4)
✓ audit.query dataTier=T1 returned entries
✓ audit.stats — byTier and byTenant present
✓ mcp.health.list
✓ mcp.health.get rejects empty name
✓ approval.requests.list with tenantId filter

Total: 21  passed=21  failed=0
```

**Security scanner against the live config** (from `npx tsx scripts/scan-agent-security.ts`):

```
[HIGH] (agent=main) Agent 'main' has no explicit sandbox.mode (defaults vary by OpenClaw version).
  → Set 'sandbox.mode' to 'non-main' in the agent's config.json5.
[HIGH] (agent=creator) Agent 'creator' allows 'browser' — verify a Hard Rule constrains its blast radius.
[HIGH] (agent=mcp-builder) Agent 'mcp-builder' allows 'browser' — verify a Hard Rule constrains its blast radius.

Total: 3 (critical=0, high=3, medium=0, low=0)
```

Exit code 0 (no blocking criticals). The 3 highs are real diagnostic findings — the `main` agent has no explicit sandbox mode (OpenClaw default), and Forge/MCP-Builder each carry `browser` for legitimate self-provisioning use; both have Hard Rules constraining the blast radius, but the scanner correctly flags them for review.

### Decisions / non-obvious notes

- **Why a `defaultDataTier` config knob.** Most events have an obvious tier (chat → T2, secrets → T4), but a few are ambiguous (`unknown` events from third-party plugins, custom emit calls). Rather than hard-coding T1, the extension exposes a per-installation default so security-conscious deployments can set it to T2.
- **Why an `argumentsDigest` instead of full args.** `verbose: true` already opts into recording full tool args, which is dangerous for agents that touch PII. The 8-char SHA-256 digest gives compliance reviewers a way to correlate `tool_call` and `tool_result` events without storing the raw payload.
- **Why the MCP health extension owns persistence callbacks rather than the monitor.** `HealthMonitor` is pure orchestration so tests can drive the state machine deterministically without spawning real MCP servers (`vi.fn()` as `CheckStrategy`). The plugin entry wires `onChange`/`onCheck` to the audit RPC + JSON snapshot. This keeps the audit-emit and the persistence layer testable separately.
- **Why the security scanner is a sibling module of `sentura-audit` rather than a dedicated extension.** It is a pure function on a parsed config, with no runtime hooks. Living next to `sentura-audit` lets the audit dashboard import `scan(...)` and turn findings into `critical`-severity audit entries on demand without needing yet another plugin.
- **Why only one Tier-2 server (gradsale-search) with 8 tools, all read-only.** The Person-D Week-4 task says "1 more enterprise-generated MCP server"; the existing `gradsale-admin/` (admin write surface) and `gradsale-web/` (auth + listings + messages) already cover the high-write paths. The remaining clean disjoint surfaces in `ekg/api-web.md` are Sections 2/9/15/17 — all naturally read-only. Building a fourth write-server would have either overlapped or required handling sensitive operations (e.g. submitting verification, posting reviews) that legitimately want HITL approval anyway.

### Follow-ups

- Person C dashboard: when the Communication Panel ships, call `sentura.audit.chat.log` and `sentura.audit.group.log` from the dashboard's gateway client. Wire `groupId` through the message-fanout layer.
- Person A multi-tenancy: when the tenant model lands, populate `tenantId`/`departmentId` from the session key resolver before invoking any Sentura extension RPC. The audit layer already accepts both fields; without an upstream populator they'll just be `undefined` (queryable but empty).
- Live test recommended cadence: re-run `scripts/test-week4-d.ts` whenever `sentura-audit` or `sentura-mcp-health` change, and `pnpm test` for the gradsale-search package whenever its surface changes.
