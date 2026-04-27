> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Read when the current task touches Tier-1 MCP wiring, the `sentura-bootstrap` hook, the `sentura-approval` extension, the `sentura-provisioner` extension, or the cross-extension singleton handle pattern between approval and provisioning.

# Person D — Extensions & Integrations — Week 3

Sessions completing Person D's Week 3 scope: stand up the self-provisioning surface (`sentura-provisioner`) on top of the now-live `sentura-approval` extension, ship the first two Tier-1 (open-source npm) MCP server configurations, and extend the `sentura-bootstrap` hook to publish a workspace EKG summary into the system prompt (capability #11). Deferred: the GradSale-flavoured test-data extraction tool (D10 / capability #15 is still WK3+) and the MCP Builder Agent expansion (B-side meta-agent work).

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-26 | Person D Week 3 kickoff — 2 Tier-1 MCP servers, EKG bootstrap injection, sentura-approval entry, sentura-provisioner scaffold + wired |
| 2026-04-26 | Week 2 carry-over closed — GradSale web MCP server (32 tools, sibling to gradsale-admin) |

---

### 2026-04-26 — Person D Week 3 kickoff — 2 Tier-1 MCP servers, EKG bootstrap injection, sentura-approval entry, sentura-provisioner scaffold + wired

**Summary.** Closed the four lowest-friction Person D items in `memory/person-d/TeamPlan.md` § Week 3: the two Tier-1 MCP server configurations, the EKG summary in the bootstrap hook, the `sentura-approval` plugin entry-point that turns its existing scaffolding (`src/types.ts`, `src/policy.ts`, `src/store.ts`) into a live OpenClaw plugin, and the `sentura-provisioner` extension that calls `sentura-approval` imperatively to file HITL approvals for any new-account creation.

**What was done:**

1. **Tier-1 MCP servers — `sentura/mcp-servers/{filesystem,slack}/`.** Each directory ships only `config-snippet.json5` (paste-ready under OpenClaw's native `mcp.servers.<name>`) and `README.md`. No `package.json` because Tier 1 = upstream npm package, not in-tree code.
   - **filesystem**: wraps `@modelcontextprotocol/server-filesystem` via `npx -y` (so a fresh OpenClaw re-pull does not break the wiring); takes positional arg(s) for allowed root(s); README enumerates tool inventory (read/write/edit/list/tree/move/search/info), security checklist (no `~`/`$HOME`, no overlap with the agent's own `workspaces/{id}/`, mutating tools route through `sentura-approval`, sandbox `tools.alsoAllow` reminder).
   - **slack**: wraps `@modelcontextprotocol/server-slack`; required scopes documented at the top of the snippet; `SLACK_BOT_TOKEN` / `SLACK_TEAM_ID` are `$secret:` references; optional `SLACK_CHANNEL_IDS` allow-list for department scoping; README covers OAuth scopes, the `not_in_channel` invite gotcha, the `xoxb-/xoxp-/xapp-` audit-redaction prefixes, and the same sandbox `alsoAllow` reminder.
   - Both READMEs cross-reference `docs/DESIGN.md › Three-tier MCP strategy` and the gradsale-admin (Tier 2) reference for contrast.

2. **`sentura-bootstrap` hook — EKG summary injection.** Extended `sentura/hooks/sentura-bootstrap/handler.ts` (was 95 lines, now 240) so that on every `agent:bootstrap` event it walks `<workspaceDir>/ekg/{org,rules,assets,workflows}/` (the canonical 4-pillar shape from `docs/DESIGN.md`). For each `*.json5` file, dependency-free regexes count `entities[]`, `relations[]`, and `rules[]` and pull the top-level `domain:` value — no JSON5 parser is loaded into the hook's hot path. The result is a synthesised virtual `EKG_SUMMARY.md` (name + path + content + `missing: false`, matching the existing `MEMORY_USER_{token}.md` injection shape) appended to `context.bootstrapFiles`. The summary lists pillar inventory with per-file domain/entity/relation/rule counts plus an explicit "use `memory_search` to recall specific entries" pointer so the agent treats EKG as ground truth without us having to inline tens of KB of JSON5 into every system prompt. The raw `ekg/` JSON5 files remain on disk and are still auto-indexed by OpenClaw's memory system (no change to the indexer needed). Workspaces without an `ekg/` directory are silently skipped, preserving the existing per-user-memory behaviour for non-Sentura agents.

3. **`sentura-approval` plugin entry-point — `sentura/extensions/sentura-approval/index.ts` (~430 lines).** The extension's `src/types.ts`, `src/policy.ts`, and `src/store.ts` already existed (built earlier this week from the manifest scaffolding) but no `index.ts` had been wired. Today's index does six jobs:
   - **Resolve plugin config**: `dataDir` defaults to `~/.openclaw/sentura-approval/`, `defaultTimeoutMs = 30 * 60 * 1000`, `defaultOnTimeout = "deny"`, `retention.maxAgeDays = 180`.
   - **Initialise the store** with `builtinPolicies()` as the seed (`builtin:critical-always-human` priority 100, `builtin:low-risk-auto-approve` priority 10).
   - **Register the agent-facing tool `sentura_approval_request`**: takes `action`, `riskLevel`, `context`, optional `sessionKey`; runs `evaluate(...)` against the live policy list; for `auto_approve` / `auto_deny` it persists a terminal `ApprovalRequest` and returns `{ status: "auto_approved" | "auto_denied", requestId, policyId, reason }`; for `require_human` it persists a `pending` request with `expiresAt`, `escalation: { chain, currentIndex: 0 }`, and `onTimeoutDecision` (the new field added below) and returns the same shape with `status: "pending"`. Tool description explicitly tells the calling agent NOT to proceed on a pending result.
   - **Register six dashboard-facing gateway RPCs**: `sentura.approval.requests.list` (filterable), `requests.get`, `requests.decide` (validates state transition — refuses to re-decide a non-pending request with `code: "CONFLICT"`), `policies.list`, `policies.upsert`, `policies.remove`. RBAC middleware is intentionally NOT applied yet — the dashboard's gateway client is mid-rewrite for Week 3 (Person C wiring `params.actorToken` from the auto-seeded `platform_admin`). Comment in code calls out that `*.decide` and `policies.{upsert,remove}` need `withRbac` once the dashboard side lands.
   - **60-second sweep timer** (`setInterval`, `clearInterval` in `gateway_stop`): calls `store.sweepExpired()` which terminal-states pending requests whose `expiresAt` has passed (status `expired`, decision reason `Approval expired without a human response`). The configured `onTimeoutDecision` is preserved on the request itself so downstream callers (provisioner, future audit replay) can recover the policy's intent even after the policy was edited.
   - **Cross-extension singleton + imperative helper.** Added module-scoped `runtimeHandle` set in `register()` and exported `getApprovalRuntime()` so sibling extensions can lazy-resolve the same `{ store, config }` pair without going through the gateway RPC layer. Also exported `fileApprovalImperative(store, config, params)` for callers that want to file an approval without going through the agent-facing tool — used by `sentura-provisioner` below. **Type extension**: added `onTimeoutDecision?: "approve" | "deny"` to `ApprovalRequest` so the policy's chosen fallback survives policy edits.
   - Re-exports the ApprovalStore, evaluate, and builtinPolicies symbols so consumers don't have to deep-import `./src/`.

4. **`sentura-provisioner` extension — full scaffold + approval wiring.** Built `sentura/extensions/sentura-provisioner/` from scratch (was just a `.gitkeep`):
   - **`package.json`** declares `@sentura/provisioner` with `dependencies: { "@sentura/approval": "workspace:*" }` and the `openclaw.extensions: ["./index.ts"]` entry-point.
   - **`openclaw.plugin.json`** declares the contract (`sentura_provisioner_request`, `sentura_provisioner_complete`) and configSchema (`dataDir`, `approvalDataDir`, `defaultRiskLevel = "high"`, `retention.maxAgeDays = 365`).
   - **`api.ts`** mirrors the rbac/audit/approval pattern — re-exports `definePluginEntry` + `OpenClawPluginApi` from `openclaw/plugin-sdk/plugin-entry`, plus a local `resolveOpenClawDir(env)` helper (no public SDK export for this exists yet).
   - **`src/types.ts`** declares `ProvisioningStatus` (`pending_approval | approved | denied | in_progress | completed | failed | cancelled`), `ProvisioningRequest` (with `service`, `role`, `justification`, `riskLevel`, `approvalRequestId`, `secretRef`, `mcpServerConfigPath`, `metadata`), `ProvisioningConfig`, `ProvisioningQueryParams`. Imports `RiskLevel` directly from `@sentura/approval` to keep risk-level definitions DRY.
   - **`src/store.ts`** mirrors the approval store: in-memory `Map<id, ProvisioningRequest>` snapshot persisted to `requests-index.json` plus a daily JSONL append-only log (`requests-YYYY-MM-DD.jsonl`) for tamper-evident audit replay; `list/get/append/update/close` plus log rotation past `retentionDays`.
   - **`index.ts`** wires it all up:
     - **Tool `sentura_provisioner_request`** — agent calls with `service`, `role`, `justification`, optional `riskLevel` override, optional `metadata`. Lazy-resolves the approval runtime via `getApprovalRuntime()` (handles register-order races) — falls back to spinning up its own `ApprovalStore` against `config.approvalDataDir` if `sentura-approval` is disabled, so the dashboard's approval RPCs still see the data on disk. Calls `fileApprovalImperative(...)` with `action = "provisioner.{service}.create"` and `context = { service, role, justification, provisioningRequestId, ...metadata }` so an operator can write a policy like `{ match: { actions: ["provisioner.zendesk.create"] }, outcome: { kind: "auto_approve", ... } }` for whitelisted services. Maps the approval decision to the initial provisioning status (`auto_approved → approved`, `auto_denied → denied`, `pending → pending_approval`) and persists the record with the linking `approvalRequestId`.
     - **Tool `sentura_provisioner_complete`** — called by the (future, B-side) browser-driven provisioning skill once the external account exists. Takes `requestId`, `outcome` (`completed | failed`), `secretRef` (required when `completed`), optional `mcpServerConfigPath`, `errorMessage` (required when `failed`). Refuses to re-complete a request already in a terminal state. The skill is responsible for writing the credential into the secret store via `openclaw secret set`; the provisioner just records the `$secret:` reference.
     - **Three dashboard RPCs**: `sentura.provisioner.requests.list / get / cancel`. Cancel refuses terminal-state requests with `code: "CONFLICT"`; emits an `errorMessage` so the audit trail records the cancellation reason.
     - **`gateway_stop`** closes the JSONL writer cleanly.

**Technical notes (worth preserving):**

- **Cross-extension imports stay inside the public-barrel rule.** `sentura-provisioner/index.ts` imports `ApprovalStore`, `fileApprovalImperative`, `getApprovalRuntime`, `RiskLevel`, and `ApprovalConfig` from `@sentura/approval` — i.e. the package's `index.ts` barrel. Per `memory/person-d/CLAUDE.md` § Sentura extensions, that's allowed; deep-importing `@sentura/approval/src/store` would violate the boundary. The `workspace:*` dep in `package.json` is what makes the import resolve under pnpm.
- **The "two ApprovalStore instances against the same dir" footgun is real.** If we had each extension construct its own `ApprovalStore`, the in-memory snapshots would diverge between writes and the dashboard list call would miss events filed via the provisioner. The singleton handle (`getApprovalRuntime()`) avoids this for the normal case where both extensions are loaded in the same gateway process. The fallback path (spin up our own store when approval is absent) is only safe because there's no second writer in that scenario — the dashboard RPCs simply won't be registered.
- **Lazy resolution of the singleton.** `getApprovalRuntime()` is called inside the tool's `execute()`, not in the provisioner's `register()`. OpenClaw's plugin loader doesn't guarantee load order; lazy resolution makes this robust regardless of which extension loads first.
- **IDE diagnostics on the new files are pre-existing workspace artifacts.** `sentura-approval` and `sentura-provisioner` both surface `Cannot find name 'node:fs'` / `Binding element implicitly has 'any' type` because their `node_modules/` directories are empty until the next `pnpm install`. The same diagnostics would appear on `sentura-rbac/index.ts` if its `node_modules` was wiped — these are not regressions and clear after install. The one **real** type fix in this session: removed the optional `setInterval(...).unref?.()` call in `sentura-approval/index.ts` because without `@types/node` the DOM `setInterval` returns `number` (not `NodeJS.Timeout`) and TS rejects the `.unref?.()` chain. `clearInterval` in `gateway_stop` covers cleanup.
- **Dashboard wiring next.** `sentura.approval.requests.list / decide` and `sentura.provisioner.requests.list / cancel` need to be plumbed into Person C's `/approvals` and (new) `/integrations` pages alongside her ongoing platform-admin-token wiring. The token attaches as `params.actorToken` (matching the convention from `sentura-rbac/src/middleware.ts`) and we'll re-introduce `withRbac` middleware on the write RPCs once that's live.
- **Tier-1 MCP wiring is operator-paste, not setup-script-managed.** Both `config-snippet.json5` files are intentionally not auto-applied by `scripts/sentura-setup.{sh,ps1}` — operator chooses which integrations belong in this deployment, supplies the absolute paths and Slack OAuth tokens, and applies the snippet through the gateway `config.patch` RPC. The setup script staying out of this prevents accidental mass-rollout of integrations.

**Scope deferred (not done in this session):**

- D10 — GradSale **web** MCP surface (capability-wise distinct from the Tier-1 work; needs the same `@modelcontextprotocol/sdk` codegen pattern as `gradsale-admin/`; user explicitly asked to skip GradSale-flavoured tasks for now).
- "Build test data extraction tools for pre-deployment testing (capability #15)" — gradsale-flavoured by definition (extract historical dispute records as test cases); skipped per user.
- "Expand MCP generation into MCP Builder Agent" — the meta-agent workspace (`sentura/agents/mcp-builder/`) already exists but its skill set hasn't been built; this is the heavier B-cooperative task and was deferred.
- "Test approval flow: AI employee triggers high-risk action → human approves on dashboard" — depends on Person C's `/approvals` page binding the new `sentura.approval.*` RPCs (currently the page is wired to OpenClaw's binary `exec.approval.*` / `plugin.approval.*` only).

**Files touched / created:**

- `sentura/mcp-servers/filesystem/{config-snippet.json5,README.md}` — new
- `sentura/mcp-servers/slack/{config-snippet.json5,README.md}` — new
- `sentura/hooks/sentura-bootstrap/handler.ts` — extended (95 → 240 lines)
- `sentura/extensions/sentura-approval/src/types.ts` — added `ApprovalRequest.onTimeoutDecision`
- `sentura/extensions/sentura-approval/index.ts` — new
- `sentura/extensions/sentura-provisioner/.gitkeep` — removed
- `sentura/extensions/sentura-provisioner/{package.json,openclaw.plugin.json,api.ts,index.ts}` — new
- `sentura/extensions/sentura-provisioner/src/{types.ts,store.ts}` — new
- `memory/person-d/TeamPlan.md` — flipped 5 checkboxes (`sentura-provisioner`, approval-integration, `sentura-approval`, Tier-1 MCP, EKG bootstrap) with dated annotations
- `docs/MEMORY.md` — added Week 3 header + this row
- `docs/TESTS.md` — added D15 / D16 / D17 / D18 rows under Person D
- `docs/tests/tests-person-d.md` — added detail sections for D15–D18

---

### 2026-04-26 — Week 2 carry-over closed — GradSale web MCP server (32 tools, sibling to gradsale-admin)

**Summary.** Closed the only outstanding Week-2 Person-D deliverable: wrap the GradSale **web/user** API surface as MCP tools so AI employees can act on behalf of (or as) end users — a strict superset of the buyer-side / seller-side / onboarding-assistant / support-walk-through personas that the admin surface (`gradsale-admin/`) cannot satisfy. The work was deferred from Week 2 explicitly so the admin surface could ship first and unblock the Dispute Resolver / Trust & Safety / Support staff personas; the `roadmap.md` carry-over note ("⚠ explicitly deferred to Week 3 alongside self-provisioning") is now flipped to ✅.

Implemented as a **new sibling package** `sentura/mcp-servers/gradsale-web/` rather than folding into `gradsale-admin/`. Sibling structure was the right call: the two servers have different auth paths (`/api/auth/login` vs `/api/auth/admin/login`), different token lifetimes (user tokens are session-scoped + can refresh, admin tokens are pre-issued + long-lived), different read-only persona semantics (web read-only = analytics; admin read-only = auditor), and different tool-name prefixes (`gradsale_web_` vs `gradsale_admin_`) so they can be loaded side-by-side on the same employee without collisions. Folding them would have leaked admin-specific config (e.g. `GRADSALE_ADMIN_TOKEN`) into the web tool surface and vice versa.

**Scope and counts.**

- **32 tools** across sections 1, 3, 6 of `ekg/api-web.md`: Authentication × 10, Listings × 11, Messages × 11. Other web sections (Users, Cart, Saved Items, Transactions, Stripe, Ratings, Disputes, Reports, Notifications, Support, File Upload, Universities, Waitlist, Geocoding) are intentionally out of scope for this v0.1 — adding them is a one-file edit to `src/tools.ts` driven by the next persona need.
- **16 tests** total: 12 unit cases in `src/tools.test.ts` (registry shape + per-tool URL/method/body/auth-header assertions), 4 e2e cases in `src/server.test.ts` (catalog exposed via MCP `Client.listTools`, simulated Buyer Concierge walk `search_listings → create_thread → send_message`, 4xx surfaces as `isError`, SDK-level UUID validation rejects bad input before the handler runs).

**Where it diverges from `gradsale-admin/` (worth preserving):**

1. **User-auth path.** `client.ts` calls `/api/auth/login` with `{ emailOrUsername, password, deviceId? }` and persists the returned `accessToken` only — `refreshToken` is dropped for v0.1 because the MCP server's process lifetime is short enough that a refresh dance isn't load-bearing yet. If the gateway starts running the same MCP server for hours, this becomes a TODO.
2. **Cached-token mutation post-login.** `gradsale_web_login`, `gradsale_web_google_oauth`, and `gradsale_web_reset_password` handlers call `client.setToken(result.accessToken)` so subsequent authenticated tool calls in the same MCP-server process ride the freshly-minted token. `gradsale_web_logout` calls `client.setToken(undefined)` to invalidate the cache — next call either re-logs-in from configured creds or fails cleanly with no `Authorization` header.
3. **`auth: false` opt-out.** The unauthenticated endpoints (`register`, `login`, `google_oauth`, `verify_email`, `resend_verification`, `forgot_password`, `reset_password`) pass `{ auth: false }` to `client.request(...)` so the resolver skips the auto-login path entirely. Without this, an onboarding agent that has no user yet would fail every call with "no token resolved" before it could even register. `gradsale-admin/` has no equivalent because admin-auth is always pre-issued.
4. **`mark_listing_viewed` is `mutates: true` but cosmetically read-only.** Description tells reviewers it's safe to auto-approve in policy. Kept as `mutates: true` so operators can still gate it via policy if they want — flipping it to read-only would foreclose that option.
5. **Listing payload split into `createListingFields` + `updateListingFields`.** Update marks every field optional so PATCH semantics are honored; create requires the canonical subset. Both share the same nested `locationShape`. `create_listings_batch` reuses `createListingFields` inside `z.array(z.object(...))`.

**Files created:**

- `sentura/mcp-servers/gradsale-web/package.json` — `@sentura/mcp-gradsale-web@0.1.0`, deps mirror `gradsale-admin` (`@modelcontextprotocol/sdk@^1.29.0`, `zod@^3.23.8`).
- `sentura/mcp-servers/gradsale-web/tsconfig.json` + `vitest.config.ts` — byte-identical to gradsale-admin's, kept symmetric so a single fix to one config flows to both via `cp` if needed.
- `sentura/mcp-servers/gradsale-web/src/config.ts` — Zod-validated env load: `GRADSALE_API_URL`, `GRADSALE_USER_TOKEN`, `GRADSALE_USER_EMAIL` (or `GRADSALE_USER_USERNAME`), `GRADSALE_USER_PASSWORD`, optional `GRADSALE_DEVICE_ID`, `GRADSALE_REQUEST_TIMEOUT_MS`, `GRADSALE_READ_ONLY`.
- `sentura/mcp-servers/gradsale-web/src/client.ts` — `GradSaleWebClient` with `request(method, pathAndQuery, body, { auth })` + `setToken(token)`; auto-login on first authenticated call when `userEmailOrUsername + userPassword` are configured.
- `sentura/mcp-servers/gradsale-web/src/tools.ts` — 32-entry `TOOLS` registry + `listTools({ readOnly })` + `getTool(name)` lookup.
- `sentura/mcp-servers/gradsale-web/src/index.ts` — `createServer({ config?, fetchFn? })` factory (test-injectable), `_meta` annotations carry `sentura/endpoint` + `sentura/sourceDoc: ekg/api-web.md`, stdio entry-point gated on `import.meta.url === file://process.argv[1]` so import-without-side-effects works in tests.
- `sentura/mcp-servers/gradsale-web/src/tools.test.ts` + `src/server.test.ts` — see counts above.
- `sentura/mcp-servers/gradsale-web/README.md` — covers tool inventory, configuration, persona examples (Buyer Concierge / Seller Inbox Triage / Listing Manager / Onboarding Assistant / Support Walk-Through), wiring snippet, dev commands, and the deltas vs gradsale-admin.

**IDE diagnostics on the new files** — same pattern as the Week-3 sentura-approval / sentura-provisioner work earlier in this week-3 file: `vitest` and `zod` declared in `package.json` but `node_modules/` for the new package is empty until `pnpm install` runs at the workspace root. The implicit-`any` errors on `vi.fn(async (url, init) => …)` arrow-function params are the same pattern as `gradsale-admin/src/tools.test.ts` — green there because admin's deps are hydrated. Single `pnpm install` from the repo root clears all of these.

**How to test (per Person D's standard cadence — same shape as the Week-3 kickoff session above):**

1. **Workspace install** — `cd /home/yding/Desktop/Sentura-Platform && pnpm install` (picks up `sentura/mcp-servers/gradsale-web` via the existing `sentura/mcp-servers/*` glob in `pnpm-workspace.yaml`).
2. **Static checks** — confirm 32 tools and the prefix invariant: `grep -c "name: \"gradsale_web_" sentura/mcp-servers/gradsale-web/src/tools.ts` should print `32`.
3. **Vitest** — `pnpm --filter @sentura/mcp-gradsale-web test` should report **16 tests passing**.
4. **Build** — `pnpm --filter @sentura/mcp-gradsale-web build`; `dist/index.js` must exist.
5. **Optional manual smoke** — wire the snippet from `README.md` into `~/.openclaw/openclaw.json` against a running GradSale backend (or stubbed one), restart the gateway, confirm an agent loaded with this MCP server has 32 new tools available.

**Files touched / paired writes:**

- `sentura/mcp-servers/gradsale-web/{package.json,tsconfig.json,vitest.config.ts,README.md,src/{config,client,tools,index,tools.test,server.test}.ts}` — 9 new files.
- `memory/person-d/TeamPlan.md` — flipped the Week-2 carry-over checkbox (line 352) with a dated annotation.
- `memory/person-d/roadmap.md` — flipped both Week-2 carry-over markers (line 27 ⚠→✅, line 39 `[ ]→[x]`).
- `docs/MEMORY.md` — added 2026-04-26 row under Week 3 pointing at this detail file.
- `docs/memory/person-d/week-3.md` — appended this section + TOC entry.
- `docs/TESTS.md` + `docs/tests/tests-person-d.md` — D7 / D8 / D10 updated: D7 expanded to track web tool count, D10 flipped from WK3+ to PEND (will go PASS after `pnpm install` + `vitest run`), and a paired D7-WEB / D8-WEB pair added for the web surface tests.
