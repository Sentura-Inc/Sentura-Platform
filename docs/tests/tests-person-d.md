# Sentura Tests — Person D (Extensions & Integrations)

> Detailed test cases. Summary matrix lives in `docs/TESTS.md`. Read on demand.

## Person D — Extensions & Integrations Engineer

### D1. Audit Extension — Automated Unit Tests

These tests run via `cd openclaw && npx vitest run --config test/vitest/vitest.sentura.config.ts`.

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

These tests run via `cd openclaw && npx vitest run --config test/vitest/vitest.sentura.config.ts`.

| # | Test File | Tests | What is Covered |
|---|-----------|-------|-----------------|
| D3.1 | `sentura-rbac/src/roles.test.ts` | 9 | **7-role** model: all role IDs present (`platform_admin`, `dept_admin`, `employee_owner`, `auditor`, `end_user`, `employee_agent`, `integrator`); platform_admin has all 6 operator scopes; end_user only has operator.read; auditor permissions are read-only; platform_admin T0-T4 access; end_user T0 only; `employee_agent` scoped to own workspace; `integrator` limited to gateway integration methods |
| D3.2 | `sentura-rbac/src/authorizer.test.ts` | 13+ | Unknown users denied; platform_admin gets "all" scope; auditor can read but not delete agents; employee_owner gets "owned" scope for read/update; employee_owner cannot create agents; end_user gets "self" scope for sessions; end_user denied config access; dept_admin gets "department" scope; auditor can query audit logs; end_user denied audit access; only platform_admin can access secrets; `userToken` resolves the acting user via `RbacStore.getUserByToken` |
| D3.3 | `sentura-rbac/src/middleware.test.ts` | 10 | `withRbac(authorizer, store, opts, handler)` wraps RPC handlers; resolves actor from `params.userToken` (default) or custom `userIdField`; responds `UNAUTHORIZED` when actor cannot be identified; denies when authorizer returns `decision: "deny"`; passes `{ user, scope }` into guarded handler on allow; enforcement toggle (`opts.enforce = false`) lets handler run untouched; **bootstrap escape hatch** — when `store.listUsers()` returns empty, call proceeds with synthetic `__bootstrap__` user at `platform_admin` role so the first human can be seeded via `sentura.rbac.users.upsert` before any user exists; additional coverage for per-handler scope override, error pass-through, and stamp-level metadata |

### D4. RBAC Extension — Manual Verification

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| D4.1 | Design document | Read `sentura/extensions/sentura-rbac/DESIGN.md` | Documents all 5 roles, 3-layer authorization (scope → method → resource), department hierarchy, data tier access matrix, permission tables for standard and Sentura methods |
| D4.2 | Seven roles defined | Read `src/roles.ts` | `ROLE_DEFINITIONS` array has exactly 7 entries: platform_admin, dept_admin, employee_owner, auditor, end_user, employee_agent, integrator |
| D4.3 | Operator scope mapping | Read `src/roles.ts` | platform_admin: all 6 scopes; dept_admin: 3 (read, write, approvals); employee_owner: 2 (read, write); auditor: 1 (read); end_user: 1 (read); employee_agent: tool-only; integrator: gateway-integration scope |
| D4.4 | Data tier access | Read `src/roles.ts` | platform_admin: T0-T4; dept_admin: T0-T2; employee_owner: T0-T1; auditor: T0-T2; end_user: T0; employee_agent: tier set declared by owning employee; integrator: T0 only |
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

### D7. GradSale Admin MCP Server — Unit Tests

Run via `pnpm --filter @sentura/mcp-gradsale-admin test` (workspace package at `sentura/mcp-servers/gradsale-admin/`).

| # | Test File | Tests | What is Covered |
|---|-----------|-------|-----------------|
| D7.1 | `src/tools.test.ts` | 14 | Registry has 29 tools covering every endpoint in `ekg/api-admin.md` (auth, disputes, user verification, ratings, reports, support, waitlist, email verification, transactions, admin management); tool names follow `gradsale_admin_<verb>_<noun>` convention; each tool exposes a raw Zod `inputShape` (not a `z.object`), a `title`, a `description`, an `endpoint` string (e.g. `"POST /api/disputes/:id/handle"`), and a `mutates` boolean; `listTools({ readOnly: true })` filters out every `mutates: true` tool (used to build Dispute Observer / Trust & Safety read-only personas); `getTool()` returns `undefined` for unknown names; handler-level cross-field validation — `gradsale_admin_review_verification` throws `"rejectionReason is required when decision is 'rejected'"` without touching `fetch`; `GradSaleAdminClient` attaches `Authorization: Bearer <token>` header and resolves token via email/password login when `adminToken` is unset; `GradSaleAdminError` surfaces HTTP status + body on 4xx/5xx |

### D8. GradSale Admin MCP Server — Employee Integration

Run via `pnpm --filter @sentura/mcp-gradsale-admin test` (same command as D7 — tests share the workspace).

| # | Test File | Tests | What is Covered |
|---|-----------|-------|-----------------|
| D8.1 | `src/server.test.ts` | 4 | `createServer({ fetchFn })` registers tools on an `McpServer`, and a separate MCP `Client` connects via `InMemoryTransport.createLinkedPair()` (no process, no stdio, no network — hermetic); `client.listTools()` returns all 29 tool names; **end-to-end Dispute Resolver walk**: client calls `gradsale_admin_list_disputes` → `gradsale_admin_get_dispute` → `gradsale_admin_handle_dispute`, each backed by a stubbed `fetchFn` that asserts method + URL + body; 4xx backend response surfaces as `isError: true` with the body in the text content instead of throwing; **SDK-level input validation** — calling `gradsale_admin_get_dispute` with `disputeId: "not-a-uuid"` is rejected by the SDK before the handler runs, returns `isError: true` with `"Invalid uuid"` in the content, and `fetchFn` is never called |

### D9. Enterprise MCP Server Pattern — Documentation

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| D9.1 | Pattern documented in DESIGN.md | Read `docs/DESIGN.md` § "Enterprise MCP Server Pattern" (Section 14) | Three-step pattern: (1) API doc → `ToolDefinition[]` registry using raw Zod shapes + `mutates` flag, (2) `McpServer` wiring mapping `mutates` → `annotations.destructiveHint` + `readOnly`/`title`/`_meta`, (3) `config.patch` to bolt the server onto an employee's `mcpServers` block; references `sentura/mcp-servers/gradsale-admin/` as the reference implementation |
| D9.2 | README for the server | Read `sentura/mcp-servers/gradsale-admin/README.md` | Lists all 29 tools; documents env vars (`GRADSALE_API_URL`, `GRADSALE_ADMIN_TOKEN`, `GRADSALE_ADMIN_EMAIL`/`_PASSWORD`, `GRADSALE_READ_ONLY`, `GRADSALE_REQUEST_TIMEOUT_MS`); shows the `config.patch` snippet that wires the server into an employee workspace; notes that `mutates: true` tools emit `annotations.destructiveHint` so `sentura-approval` routes them through HITL by default |
| D9.3 | Package wired into workspace | Read `pnpm-workspace.yaml` | `sentura/mcp-servers/*` is listed so `pnpm --filter @sentura/mcp-gradsale-admin ...` works from repo root |

### D10. GradSale Web MCP Surface

> Locks in the Week-2 carry-over deliverable at `sentura/mcp-servers/gradsale-web/`. Sibling package to `gradsale-admin/` covering sections 1, 3, 6 of `ekg/api-web.md` (Authentication, Listings, Messages). Hermetic — same `InMemoryTransport` + stubbed `fetch` rig as D7/D8.

| # | Test File | Tests | What is Covered |
|---|-----------|-------|-----------------|
| D10.1 | `sentura/mcp-servers/gradsale-web/src/tools.test.ts` | 12 | Registry shape (`gradsale_web_` prefix invariant, exactly 32 tools, every tool has an `endpoint` string, every input field is a `z.ZodType`); `readOnly: true` strips mutating tools (excludes `create_listing`, `send_message`; keeps `list_listings`, `get_thread`); per-tool URL/method/body assertions for `register` (`auth: false`), `login` (caches token via subsequent `Authorization: Bearer fresh-token` check), `logout` (clears cached token), `list_listings` (multi-field query string), `create_listing` (full body POST), `update_listing` (PATCH only supplied fields, `listingId` in path not body), `set_listing_status` (only `status` in body), `send_message` (`threadId` in path, body trimmed), `complete_checkout` (`transactionId` in body); 4xx → `GradSaleWebError` with status + body |
| D10.2 | `sentura/mcp-servers/gradsale-web/src/server.test.ts` | 4 | Catalog exposed via MCP `Client.listTools()` reports 32 tools; annotations correctly reflect `mutates` (`readOnlyHint`/`destructiveHint`); simulated Buyer Concierge walks `search_listings` → `create_thread` → `send_message` against stubbed responses, all three calls land at expected endpoints with expected method/body; 4xx surfaces as `isError` with text matching `/GradSale API 404/`; SDK-level UUID validation rejects `not-a-uuid` for `get_listing` before the handler runs (fetch never called) |

**Run command:**

```bash
pnpm install                                     # one-time, picks up the new package
pnpm --filter @sentura/mcp-gradsale-web test     # 16 tests
pnpm --filter @sentura/mcp-gradsale-web build    # tsc → dist/
```

**Failure triage:** if D10.1 reports the tool count is wrong, an endpoint was added/removed in `src/tools.ts` without updating the assertion — keep them in sync. If D10.1 `login persists the access token` test fails, the handler stopped calling `client.setToken(...)` after a successful login (or `setToken` itself stopped being public — check `src/client.ts`). If D10.2 `Buyer Concierge` walk fails on the third call, confirm `send_message` is still embedding `threadId` in the path (`/api/messages/threads/${threadId}/messages`) rather than the body — a refactor that pulled it into the body would silently 404 on the live API too.

### D-CRE-19. Forge tool-visibility probe + E2E CLI deploy regression (Round 19)

> This regression guards the Round 17 (in-process `register_agent`) + Round 18 (AGENTS.md 12k shrink) fixes and the Round 19 diagnosis (dashboard-session "I only have read/session tools" replies are **LLM context poisoning**, not a tool-pipeline regression). Run it whenever Forge in a dashboard session appears to refuse deployment, **before** touching code.

**Prerequisites**: OpenClaw gateway running (`pnpm gateway:watch` from `openclaw/`); `~/.openclaw/openclaw.json` healthy (`agents.list[id=creator]` has `tools.alsoAllow` containing `sentura_agents_manage`, `tools.deny` containing `sessions_spawn`, `sandbox.workspaceAccess: "rw"`).

| # | Test | Method | Expected result |
|---|------|--------|-----------------|
| D-CRE-19.1 | **Authoritative tool-visibility probe** | From repo root: `node openclaw.mjs agent --agent creator --session-id "tool-probe-$(date +%s)" --message "List your tools comma-separated, do not call anything."` | Reply is a comma-separated list containing **all three Sentura plugin tools** (`sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`) alongside core tools (`gateway`, `read`, `process`, `web_search`, `web_fetch`, `browser`, `pdf`, `canvas`, `sessions_list`, `sessions_history`, `sessions_send`, `session_status`, `cron`, `image_generate`, `video_generate`, `image`, `update_plan`, `memory_search`, `memory_get`, `multi_tool_use.parallel`). If the probe lists the three Sentura tools, the pipeline is healthy and any contrary claim in a dashboard session is context poisoning — start a fresh webchat conversation instead of investigating code. |
| D-CRE-19.2 | **E2E CLI deploy — 4-call sequence** | `node openclaw.mjs agent --agent creator --session-id "deploy-test-$(date +%s)" --timeout 300 --message "Deploy a new employee with this EXACT spec. Execute the 4-call sentura_agents_manage deployment sequence: create_agent → write (one per native file + skills) → register_agent → stamp_setup. Spec: id=billing-support-rep-test, name='Billing Support Rep Test', role='Customer Support rep for billing questions', model=openai/gpt-5.4, channels=[webchat], data_sources=[stripe, zendesk], allowed_actions=['read Stripe/Zendesk','answer customer billing questions','add internal Zendesk notes'], blocked_actions=['refunds','credits','subscription changes','payment changes'], escalate_to='Henry Zhang', tone='warm, concise'. Respond DEPLOYED followed by the exact 4 tool call names you executed."` | Forge replies `DEPLOYED create_agent, write, register_agent, stamp_setup` within 300s. Gateway log shows exactly one `Config overwrite: /Users/henry/.openclaw/openclaw.json (sha256 <old> → <new>, backup=…openclaw.json.bak)` line and **zero** occurrences of `Sandbox path is read-only`, `pairing required`, `raw required raw_params={}`, `exec host not allowed`, `embedded run timeout`, or `truncating in injected context`. |
| D-CRE-19.3 | **Post-deploy workspace check** | `ls -la ~/.openclaw/workspace/billing-support-rep-test/ && ls -la ~/.openclaw/workspace/billing-support-rep-test/.openclaw/ && cat ~/.openclaw/workspace/billing-support-rep-test/.openclaw/workspace-state.json` | Directory contains all 8 native files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) plus the `.openclaw/workspace-state.json` file with `{"setupCompletedAt": "<ISO-8601 timestamp>", "version": 1}`. `AGENTS.md` contains a `## Hard Rules (must not override)` section listing every `blocked_actions` entry verbatim and an escalation line naming `Henry Zhang`. |
| D-CRE-19.4 | **Registration matches spec** | Python one-liner: `python3 -c "import json; d=json.load(open('/Users/henry/.openclaw/openclaw.json')); a=[x for x in d['agents']['list'] if x['id']=='billing-support-rep-test'][0]; import pprint; pprint.pprint({k:a.get(k) for k in ['id','name','model','tools','sandbox','runtime','params']})"` | `id='billing-support-rep-test'`, `model='openai/gpt-5.4'`, `tools.profile='messaging'`, `sandbox.mode='non-main'`, `runtime.type='embedded'`, and `params` contains `role`, `tone='warm, concise'`, `channels=['webchat']`, `dataSources` containing both `stripe` and `zendesk`, `allowedActions` / `blockedActions` arrays matching the input spec verbatim, and `escalateTo='Henry Zhang'`. |

**Cleanup after running the regression**:
```bash
rm -rf ~/.openclaw/workspace/billing-support-rep-test
python3 -c "import json; p='/Users/henry/.openclaw/openclaw.json'; d=json.load(open(p)); d['agents']['list']=[x for x in d['agents']['list'] if x['id']!='billing-support-rep-test']; json.dump(d, open(p,'w'), indent=2)"
```

**Failure triage**: if D-CRE-19.1 passes but D-CRE-19.2 fails, check the gateway log first — any `pairing required` error means Round 17 regressed (Forge is reaching for `gateway.config.patch` instead of `sentura_agents_manage.register_agent`); any `truncating in injected context` warning means Round 18 regressed (`AGENTS.md` grew back over 12k chars); any `Sandbox path is read-only` means Round 11's `workspaceAccess: "rw"` got stripped from `openclaw.json`. If D-CRE-19.1 itself fails (the three Sentura plugin tools are missing), check `alsoAllow` in the creator entry of `openclaw.json` and confirm `sentura-agents` extension is loaded (`rg 'sentura-agents.*Extension registered' /tmp/openclaw/openclaw-*.log`). If CLI probes pass but dashboard `chat.send` sessions still show Forge with only 7 tools (`read`, `process`, `sessions_*`, `session_status`, `image`), run D-SAND-01 below — the culprit is the sandbox tool-policy allowlist, not the top-level `alsoAllow`.

---

### D-SAND-01. Meta-agent sandbox tool-policy allowlist (Round 20)

> This regression guards the Round 20 fix: OpenClaw's sandbox has a **separate** tool-allowlist layer (`DEFAULT_TOOL_ALLOW` / `DEFAULT_TOOL_DENY` in `openclaw/src/agents/sandbox/constants.ts`) that filters the agent's tool set inside `applyToolPolicyPipeline` at the `sandbox tools.allow` step, **after** the top-level `tools.alsoAllow` runs. Agent-level `tools.alsoAllow` does NOT bleed into this layer. Plugin tools (`sentura_agents_manage`, `gateway`, `browser`, `pdf`, `canvas`, `cron`, `memory_*`, `update_plan`, `image_generate`, `video_generate`) and channel-like ids (`gateway`, `browser`, `canvas`, `pdf`, `cron`) that live in `DEFAULT_TOOL_DENY` are stripped unless the agent declares them in `tools.sandbox.tools.alsoAllow`. Channel-like entries listed in sandbox `alsoAllow` are auto-removed from `DEFAULT_TOOL_DENY` by `filterDefaultDenyForExplicitAllows` — no deny-list edit needed.

**Prerequisites**: OpenClaw gateway running (`pnpm gateway:watch` from `openclaw/`). Repo root has helper scripts `scripts/probe-creator-tools.ts` and `scripts/probe-chat-send.ts`.

| # | Test | Method | Expected result |
|---|------|--------|-----------------|
| D-SAND-01.1 | **Source-of-truth config declares sandbox allow-list** | `rg -n 'sandbox:' sentura/agents/creator/config.json5 -A 30` | The `creator` config's `tools` block contains `sandbox.tools.alsoAllow` with at minimum: `gateway`, `sessions_send`, `web_search`, `web_fetch`, `browser`, `pdf`, `canvas`, `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`, `memory_search`, `memory_get`, `cron`, `update_plan`, `image_generate`, `video_generate`. |
| D-SAND-01.2 | **Live runtime config mirrored** | `python3 -c "import json; d=json.load(open('/Users/henry/.openclaw/openclaw.json')); a=[x for x in d['agents']['list'] if x['id']=='creator'][0]; print(a['tools']['sandbox']['tools']['alsoAllow'])"` | Prints the same ≥ 16-entry list as D-SAND-01.1. If missing, either re-run `sentura-setup.sh` (the setup script must patch this in) or manually copy from `sentura/agents/creator/config.json5`. |
| D-SAND-01.3 | **Gateway view — `tools.effective`** | `npx tsx scripts/probe-creator-tools.ts` | Script connects to `ws://localhost:18789`, authenticates as `operator.admin`, calls `tools.catalog` + `tools.effective` for `creator`; output lists ≥ 21 effective tools including `sentura_agents_manage`, `gateway`, `browser`, `pdf`, `canvas`, `cron`. If the effective count is 7 or `sentura_agents_manage` is missing, the sandbox policy is filtering — D-SAND-01.1/.2 are out of sync. |
| D-SAND-01.4 | **Runner view — `chat.send` dashboard path** | `npx tsx scripts/probe-chat-send.ts` then inspect the gateway log (`ls -1t /tmp/openclaw/openclaw-*.log \| head -1` → `tail -300 <file>`) | Log contains a pipeline entry labelled `sandbox tools.allow` where the tool count is unchanged (`21->21 (no change)`) or the step is silent on drops; must NOT contain `sandbox tools.allow 21->7` (or any other drop). Agent's effective tool list at LLM invocation includes `sentura_agents_manage`. |

**Failure triage**: if D-SAND-01.3 passes but D-SAND-01.4 fails, the top-level `alsoAllow` is correct but the sandbox layer is stripping tools — edit `sentura/agents/creator/config.json5` to add the missing tool under `tools.sandbox.tools.alsoAllow` and mirror into `~/.openclaw/openclaw.json`. If D-SAND-01.3 also fails, the top-level `tools.alsoAllow` is missing the tool — fix that first. If both pass but a dashboard session still claims "I only have read/session tools", it is LLM context poisoning (see D-CRE-19) — start a fresh webchat session.

**When to extend**: Tuner, Orchestrator, and MCP Builder meta-agents MUST declare the same sandbox `alsoAllow` (or a superset) when they need plugin tools. Add a D-SAND-01.5+ row per additional meta-agent, mirroring the same 4 checks.

---

### D15. `sentura-bootstrap` EKG summary injection (capability #11)

> Locks in the Week 3 extension to `sentura/hooks/sentura-bootstrap/handler.ts`: on every `agent:bootstrap` event the hook walks `<workspaceDir>/ekg/{org,rules,assets,workflows}/` and synthesises a virtual `EKG_SUMMARY.md` into `context.bootstrapFiles` so the agent knows the EKG exists. The full JSON5 stays on disk — OpenClaw's existing memory indexer is what makes the entries `memory_search`-able.

| # | Test | Method | Expected result |
|---|------|--------|-----------------|
| D15.1 | **4-pillar walk only** | `rg -n 'EKG_PILLARS\\s*=' sentura/hooks/sentura-bootstrap/handler.ts` | Single hit; the constant is exactly `["org", "rules", "assets", "workflows"] as const` (in that order). No other pillar names. |
| D15.2 | **Dependency-free counting** | Read `summarizeEkgFile` in `handler.ts` | Uses regexes `{\s*id:\s*["']entity:` (entities), `{\s*from:\s*["']entity:` (relations), `{\s*id:\s*["']rule:` (rules), and `^\s*domain:\s*["']([^"']+)["']` (top-level `domain:` capture). No `import` of `json5` / `JSON5.parse` / any third-party parser. |
| D15.3 | **Virtual file shape** | Read `renderEkgSummary` in `handler.ts` | Returned `BootstrapFile` has `name: "EKG_SUMMARY.md"`, `path: <workspaceDir>/ekg`, `content` starting with `# Enterprise Knowledge Graph (EKG) — Summary`, and `missing: false`. Content lists pillar inventory with per-file domain/entity/relation/rule counts and includes a `memory_search` guidance line. |
| D15.4 | **Per-user memory still works** | Read the hook's main handler | After running the user-token branch (existing behaviour), the EKG branch runs unconditionally — both append to the SAME `extraFiles` array, and the merge into `context.bootstrapFiles` happens once at the end. Workspaces with no `ekg/` dir return `null` from `renderEkgSummary` and add no extra file. |
| D15.5 | **Raw JSON5 not duplicated into the prompt** | `rg -n 'readFileSync.*\\.json5' sentura/hooks/sentura-bootstrap/handler.ts` | Only `summarizeEkgFile` reads JSON5; the *content* of those files never lands in `context.bootstrapFiles`. Only `EKG_SUMMARY.md`'s synthesised text does. |

**Failure triage**: if a workspace prints `EKG_SUMMARY.md` in its bootstrap log but counts are zero, the JSON5 file is using a non-canonical shape — the regexes only fire on the standard `{ id: "entity:...", ... }` / `{ from: "entity:...", ... }` / `{ id: "rule:...", ... }` patterns documented in `docs/DESIGN.md`. Either fix the JSON5 or extend the regexes (and add a row here).

---

### D16. `sentura-approval` extension entry-point (capability #4)

> Locks in the Week 3 wiring of the existing `src/types.ts`, `src/policy.ts`, `src/store.ts` scaffolding into a real OpenClaw plugin via `sentura/extensions/sentura-approval/index.ts`.

| # | Test | Method | Expected result |
|---|------|--------|-----------------|
| D16.1 | **Manifest contracts** | Read `sentura/extensions/sentura-approval/openclaw.plugin.json` | `id: "sentura-approval"`, `enabledByDefault: true`, `contracts.tools: ["sentura_approval_request"]`, configSchema for `dataDir` / `defaultTimeoutMs` / `defaultOnTimeout` / `retention`. |
| D16.2 | **Config defaults resolved** | Read `resolveConfig` in `index.ts` | Defaults: `dataDir = ~/.openclaw/sentura-approval/`, `defaultTimeoutMs = 30 * 60 * 1000` (30 min), `defaultOnTimeout = "deny"`, `retention.maxAgeDays = 180`. |
| D16.3 | **Built-in policies seeded** | Read `register()` in `index.ts` | `store.initialize(builtinPolicies())` is called; `builtinPolicies()` returns `builtin:critical-always-human` (priority 100, `riskLevels: ["critical"]`, require_human + chain `["department_admin","platform_admin"]`) and `builtin:low-risk-auto-approve` (priority 10, `riskLevels: ["low"]`, auto_approve). |
| D16.4 | **Tool wiring** | Read `api.registerTool({ name: "sentura_approval_request", ... })` block | Parameters: `action` (string, required), `riskLevel` (enum `low|medium|high|critical`, required), `context` (object, optional), `sessionKey` (string, optional). Returns JSON-stringified `{ status, requestId, policyId, reason }` for terminal decisions or `{ status: "pending", requestId, policyId, reason, expiresAt, escalation, onTimeoutDecision }` for `require_human`. |
| D16.5 | **`onTimeoutDecision` carries the policy fallback** | Read `sentura/extensions/sentura-approval/src/types.ts` | `ApprovalRequest.onTimeoutDecision?: "approve" \| "deny"` is declared. The `require_human` branch in `index.ts` sets it from `evaluation.outcome.onTimeout`. |
| D16.6 | **60-second sweep** | Read `register()` in `index.ts` | `setInterval(() => store.sweepExpired()..., 60_000)` is registered. `clearInterval` is called in the `gateway_stop` hook. The sweep marks pending requests past `expiresAt` as `status: "expired"` with the literal reason `"Approval expired without a human response"`. |
| D16.7 | **Six gateway RPCs** | `rg -n 'registerGatewayMethod\\("sentura\\.approval\\.' sentura/extensions/sentura-approval/index.ts` | Six matches: `requests.list`, `requests.get`, `requests.decide`, `policies.list`, `policies.upsert`, `policies.remove`. |
| D16.8 | **State-transition guard on decide** | Read `sentura.approval.requests.decide` handler | When `existing.status !== "pending"` the handler responds `false` with `code: "CONFLICT"` and message `Request is already <status> — cannot re-decide`. `decision` must be `"approved"` or `"denied"` — anything else returns `code: "BAD_REQUEST"`. |
| D16.9 | **Cross-extension singleton + helper exported** | Read the top of `index.ts` | `getApprovalRuntime(): { store, config } \| null` is exported; the value is set in `register()` and accessed lazily by callers (e.g. `sentura-provisioner`). `fileApprovalImperative(store, config, params)` is also exported and produces the same record shapes the tool's `execute()` writes. `ApprovalStore`, `evaluate`, `builtinPolicies` are re-exported from the package barrel. |

**Failure triage**: if the dashboard's `/approvals` page is silent on a Sentura approval but `~/.openclaw/sentura-approval/requests-index.json` shows pending entries, Person C's gateway client is missing the `sentura.approval.*` wiring — file a Person C task, do NOT change the extension. If pending requests never expire, confirm the gateway process didn't lose its sweep timer (the 60s `setInterval` lives in the same node process and is cleared only on `gateway_stop`).

---

### D17. `sentura-provisioner` extension scaffold (capability #3)

> Locks in the Week 3 build-out at `sentura/extensions/sentura-provisioner/`: the new extension that drives self-provisioning of external integrations through `sentura-approval` for HITL.

| # | Test | Method | Expected result |
|---|------|--------|-----------------|
| D17.1 | **Manifest contracts** | Read `sentura/extensions/sentura-provisioner/openclaw.plugin.json` | `id: "sentura-provisioner"`, `enabledByDefault: true`, `contracts.tools: ["sentura_provisioner_request", "sentura_provisioner_complete"]`, configSchema for `dataDir` / `approvalDataDir` / `defaultRiskLevel` (default `"high"`) / `retention.maxAgeDays` (default 365). |
| D17.2 | **Cross-extension dep declared** | Read `sentura/extensions/sentura-provisioner/package.json` | `dependencies` contains `"@sentura/approval": "workspace:*"`. `openclaw.extensions: ["./index.ts"]`. |
| D17.3 | **`ProvisioningStatus` covers seven states** | Read `src/types.ts` | Exactly: `pending_approval \| approved \| denied \| in_progress \| completed \| failed \| cancelled`. `ProvisioningRequest` includes `service`, `role`, `justification`, `riskLevel`, `approvalRequestId`, `secretRef`, `mcpServerConfigPath`, `errorMessage`, `metadata`. |
| D17.4 | **Store mirrors the approval JSONL pattern** | Read `src/store.ts` | `requests-index.json` snapshot + daily `requests-YYYY-MM-DD.jsonl` append-only log + retention-day rotation. `update(id, patch)` always sets `updatedAt` to `new Date().toISOString()` regardless of the patch. |
| D17.5 | **`sentura_provisioner_request` files an approval** | Read `register()` in `index.ts` | The tool's `execute()` calls `resolveApprovalRuntime()` (lazy), then `fileApprovalImperative(store, config, { agentId: "", action: "provisioner.<service>.create", riskLevel, context: { service, role, justification, provisioningRequestId, ...metadata } })`. Falls back to a fresh `ApprovalStore` against `config.approvalDataDir` if the singleton is absent. |
| D17.6 | **Status mapping is deterministic** | Read the same handler | `auto_approved → "approved"`, `auto_denied → "denied"`, `pending → "pending_approval"`. The provisioning record is appended with the linking `approvalRequestId` set to the approval store's request id. |
| D17.7 | **Completion contract enforced** | Read `sentura_provisioner_complete` handler | `outcome === "completed"` requires non-empty `secretRef`; `outcome === "failed"` requires non-empty `errorMessage`. Already-terminal requests (status in `completed | failed | cancelled`) are rejected with `Request is already <status> — cannot re-complete`. |
| D17.8 | **Three gateway RPCs** | `rg -n 'registerGatewayMethod\\("sentura\\.provisioner\\.' sentura/extensions/sentura-provisioner/index.ts` | Three matches: `requests.list`, `requests.get`, `requests.cancel`. Cancel rejects terminal-state requests with `code: "CONFLICT"` and stores the cancel reason as `errorMessage`. |

**Failure triage**: if `sentura_provisioner_request` succeeds but the approval row never appears in `~/.openclaw/sentura-approval/requests-index.json`, the singleton is not resolving — check that `sentura-approval` registers BEFORE the provisioner's first tool call (it should, because the singleton is set in `register()` and the tool executes lazily). If two index files diverge, both extensions are accidentally running their own `ApprovalStore` instance — the fallback path in the provisioner is meant only for the case where `sentura-approval` is disabled entirely.

---

### D18. Tier-1 open-source MCP server configurations

> Locks in the Week 3 deliverable at `sentura/mcp-servers/{filesystem,slack}/`: documentation-only directories that stage upstream open-source MCP servers for operators to apply via `config.patch`. There is intentionally no in-tree code or build step.

| # | Test | Method | Expected result |
|---|------|--------|-----------------|
| D18.1 | **filesystem snippet** | Read `sentura/mcp-servers/filesystem/config-snippet.json5` | Lives under OpenClaw's native path `mcp.servers.filesystem`. Uses `command: "npx"`, `args: ["-y", "@modelcontextprotocol/server-filesystem", "<absolute-root>"]`. Includes `MCP_FS_MAX_FILE_BYTES` env var with a reasonable default (10 MiB). Comment warns against pointing roots at `$HOME` / `/`. |
| D18.2 | **filesystem README** | Read `sentura/mcp-servers/filesystem/README.md` | Documents tool inventory (`read_file`, `write_file`, `edit_file`, `create_directory`, `list_directory`, `directory_tree`, `move_file`, `search_files`, `get_file_info`); security checklist (absolute paths only, no overlap with `workspaces/{id}/`, mutating tools route through `sentura-approval`, sandbox `tools.alsoAllow` reminder); explains the `npx -y` choice over a vendored copy. |
| D18.3 | **slack snippet** | Read `sentura/mcp-servers/slack/config-snippet.json5` | Lives under `mcp.servers.slack`. Required scopes documented at the top (`channels:history channels:read chat:write groups:history groups:read im:history im:read mpim:history mpim:read reactions:write users:read users:read.email`). `SLACK_BOT_TOKEN` references `$secret:slack.bot_token`; `SLACK_TEAM_ID` references `$secret:slack.team_id`. Optional `SLACK_CHANNEL_IDS` allow-list line is present (commented). No raw token text. |
| D18.4 | **slack README** | Read `sentura/mcp-servers/slack/README.md` | Documents tool inventory (`slack_list_channels`, `slack_post_message`, `slack_reply_to_thread`, `slack_add_reaction`, `slack_get_channel_history`, `slack_get_thread_replies`, `slack_get_users`, `slack_get_user_profile`); security checklist (token only via `$secret:`, audit-redaction prefixes `xoxb-/xoxp-/xapp-`, customer-facing posts route through `sentura-approval`, sandbox `tools.alsoAllow` reminder); explains the dedicated-Slack-app-per-tenant rule and the `not_in_channel` invite gotcha. |

**Failure triage**: if either directory grows a `package.json` or a `dist/`, Tier 1 has been confused with Tier 2 — the Tier-2 reference is `sentura/mcp-servers/gradsale-admin/`. Tier-1 directories are config-only by design. If an operator pastes the snippet and the gateway still doesn't surface the tools to the agent, double-check the dashboard `chat.send` path (D-SAND-01) and confirm `tools.sandbox.tools.alsoAllow` lists each tool name from D18.2 / D18.4.

---

## D19 — Audit T0–T4 + multi-tenancy (W4)

`cd openclaw && npx vitest run --config test/vitest/vitest.sentura.config.ts` runs `sentura-audit/src/store.test.ts` and `sentura-audit/src/data-tier.test.ts`. Expected: 12 store cases (6 pre-existing + 6 new for tenant/department/composite/dataTier/search/composite-tenant+tier+eventType) and 7 data-tier cases. Sentura suite at this commit shows `Test Files 9 passed (9), Tests 96 passed (96)`.

## D20 — Audit Comm-Panel + MCP-health RPCs (W4)

Live gateway must be running. Run `npx tsx scripts/test-week4-d.ts`. 21/21 checks expected: `audit.chat.log` (both directions + bad-direction-rejected), `audit.group.log` (created/fanout/archived), `audit.mcp.health` (up/down with `isChange: true`), `audit.query` filters (tenantId, groupId, dataTier=T1), `audit.stats` exposes `byTier` and `byTenant` rollups.

## D21 — `sentura-mcp-health` (W4)

Offline `monitor.test.ts` 9 cases: pure-state-machine (unknown→up, unknown→degraded, escalation, recovery) + orchestration (multi-server round, onChange-only-on-transition, disabled skip, throw → degraded). Live: `sentura.mcp.health.list` and `sentura.mcp.health.get` (BAD_REQUEST on empty `name`).

## D22 — `sentura-approval` multi-tenancy (W4)

`sentura-approval/src/store.test.ts` 7 cases: round-trip; status/agentId filter; tenantId isolation; departmentId composite; sweepExpired; tenant fields persist across reload. Live: `sentura.approval.requests.list` accepts `{ tenantId, limit }`.

## D23 — Tier-1 GitHub + Postgres (W4)

Verify `sentura/mcp-servers/github/{config-snippet.json5,README.md}` and `sentura/mcp-servers/postgres/{config-snippet.json5,README.md}` are paste-ready, reference secrets via `$secret:`, document tool inventory + security checklist, and contain no `package.json`/`dist/` (Tier 1 = upstream npm).

## D24 — Tier-2 `gradsale-search` (W4)

`cd sentura/mcp-servers/gradsale-search && pnpm install && pnpm test && pnpm build`. Expected `Test Files 1 passed (1), Tests 11 passed (11)` and clean `tsc` build producing `dist/index.js`.

## D25 — Security scanner (W4)

Offline `sentura-audit/src/security-scanner.test.ts` 12 cases (one per finding family + summarize rollup). Live `npx tsx scripts/scan-agent-security.ts` reads `~/.openclaw/openclaw.json` and `~/.openclaw/workspace/<id>/AGENTS.md`, exits 0 (no criticals) / 1 (criticals) / 2 (config error). At this commit reports `3 high, 0 critical` against the live config.

---

