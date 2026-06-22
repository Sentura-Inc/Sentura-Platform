> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Read when the current task touches the specific subsystem this session covered.

# Person A — Platform & OpenClaw — Week 4

Week 4 Person A scope: multi-tenancy data model, per-user LanceDB partitioning (memory-lancedb fork), cost tracking, gateway monitoring, OpenTelemetry enablement, gateway concurrency harness, and the PowerShell parity pass that brings `scripts/sentura-setup.ps1` up to bash feature parity.

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-28 | Week 4 Person A: Multi-tenancy model |
| 2026-04-28 | Week 4 Person A: sentura-memory-lancedb fork (per-user partitioning) |
| 2026-04-28 | Week 4 Person A: sentura-cost extension (model.usage subscriber) |
| 2026-04-28 | Week 4 Person A: sentura-monitoring extension (health RPCs) |
| 2026-04-28 | Week 4 Person A: OpenTelemetry wiring (Step 7c) |
| 2026-04-28 | Week 4 Person A: Gateway concurrency harness |
| 2026-04-28 | Week 4 Person A: PowerShell parity (Steps 4b/4c/6a/6b/6c) |

---

## 2026-04-28 — Week 4 Person A: Multi-tenancy model

**What was done.** Built the foundational tenancy primitive that every other Week 4 task attributes against. Tenancy lives in a Sentura-owned file at `~/.openclaw/sentura-rbac/agent-tenancy.json`, NOT inside `agents.list[]` — never mutates undocumented OpenClaw config fields. `Department.parentId` (already in sentura-rbac) gives hierarchical rollup; `tenantId` is always set (defaults to `"default"`); `departmentId` is `null` until assigned.

**Why this storage location.** Trade-offs ruled out by audit:
- `agents.list[].context: {...}` — undocumented free-form bag on `AgentConfig`; OpenClaw parser tolerates it now but may validate later → fragile invariant.
- `agents.list[].params: {...}` — plugin-config terrain; mixing tenancy in muddies the contract.
- Sentura-side JSON (chosen) — sits next to `users.json` / `departments.json`, survives `openclaw doctor`, never sent to providers.

**Why agent IDs stay flat.** `sentura/extensions/sentura-agents/src/paths.ts:159` regex `/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/` forbids slashes, so `finance/ap-clerk` namespacing must be encoded in metadata, not in the ID. Display labels (`finance/ap-clerk`) are composed at the dashboard render layer.

**Files created:**
- `sentura/lib/tenancy.ts` — `loadAgentTenancy`, `getAgentTenancy`, `setAgentTenancy`, `resolveTenantContext`, `applyDefaultTenancyOnDisk`. Idempotent upsert (no rewrite when scope matches). `resolveTenantContext` combines `extractUserToken` from a session key with the agent's tenancy record so `sentura-cost` and `sentura-monitoring` can attribute events without falling back to "unknown tenant".
- `sentura/extensions/sentura-rbac/src/tenancy-store.ts` — `TenancyStore` class mirroring `RbacStore` (file-backed, sorted persistence, idempotent upsert, listByTenant/listByDepartment scoping).
- `scripts/test-week4-tenancy.ts` — 24 unit tests.

**Files modified:**
- `sentura/extensions/sentura-rbac/src/types.ts` — added `AgentTenancy` interface.
- `sentura/extensions/sentura-rbac/index.ts` — registered `sentura.rbac.tenancy.{get,list,set}` RPCs (set is RBAC-guarded via `withRbac`); exports `DEFAULT_TENANT_ID` and `AgentTenancy`.
- `sentura/lib/agent-registration.ts` — `FullAgentRegistration` accepts optional `tenancy: { tenantId, departmentId }`; `registerAgentOnDisk` writes a tenancy record after the config write.
- `sentura/lib/index.ts` — re-exports `./tenancy`.
- `scripts/sentura-setup.sh` — new **Step 4b** (between Step 4 and Step 5) seeds `tenantId="default"`, `departmentId=null` for every registered agent missing a record. Idempotent; preserves manually-scoped records.

**Verification:** 24/24 tests pass via `npx tsx scripts/test-week4-tenancy.ts`.

---

## 2026-04-28 — Week 4 Person A: sentura-memory-lancedb fork (per-user partitioning)

**What was done.** Forked `openclaw/extensions/memory-lancedb/` into `sentura/extensions/sentura-memory-lancedb/` to add a `userToken` column to the LanceDB memory schema. Two users sharing one agent now see two independent slices of the same vector store. Default scope `user-plus-global` returns the caller's own entries plus globals (entries with `userToken === ""`); `user-only` hides globals; `global-only` disables partitioning entirely.

**Why a fork rather than a wrapper.** Audit findings (validated against the upstream code at `extensions/memory-lancedb/index.ts:29-94`): LanceDB schema is immutable at table creation, the upstream plugin exposes no `beforeStore`/`afterSearch` hook seam, and tool-level wrapping is too late — interception must happen at `db.store()` and `db.search()`. The only clean option is owning the schema from creation.

**Why under `sentura/extensions/`, not `openclaw/extensions/`.** The `openclaw/` tree is re-pulled periodically and would blow away a fork sitting in there. Keeping the variant under `sentura/` matches the "Sentura is a control-plane LAYER, never modifies OpenClaw core" invariant. The duplicated ~500 lines are the explicit, accepted cost.

**Slot collision strategy.** Both upstream `memory-lancedb` and `sentura-memory-lancedb` register `kind: "memory"`, so only one can own the slot at a time. The setup script's Step 7a Node patcher disables `plugins.entries["memory-lancedb"].enabled` whenever `sentura-memory-lancedb` is wired. Idempotent: only flips when currently `true`.

**Files created (sentura/extensions/sentura-memory-lancedb/):**
- `openclaw.plugin.json` — manifest, `id: "sentura-memory-lancedb"`, `kind: "memory"`, adds `userTokenScope` enum to the config schema.
- `package.json`, `tsconfig.json`, `api.ts` (re-exports from `openclaw/plugin-sdk/memory-lancedb`).
- `config.ts` — fork of upstream config with `userTokenScope: "user-plus-global" | "user-only" | "global-only"` (default `"user-plus-global"`).
- `lancedb-runtime.ts` — fork with the runtime install dir namespaced under `plugin-runtimes/sentura-memory-lancedb/lancedb/` so cached binaries don't collide with the upstream variant during a migration window.
- `index.ts` — main plugin. `MemoryEntry` gains `userToken: string`; the schema-init row writes it as `""` so the column exists from creation. `MemoryDB.store()` accepts a `userToken`; `MemoryDB.search()` post-filters via the pure helper `applyUserTokenScope`. Tool factories `(ctx) => tool` capture `userToken` from `ctx.sessionKey` at registration, so the LLM sees a per-session-scoped tool. `before_agent_start` and `agent_end` hooks pull `userToken` from `event.sessionKey`. `memory_recall`/`memory_store`/`memory_forget` are all session-scoped.
- `src/session.ts` — pure parser for the Sentura session key format `agent:<agentId>:user:<userToken>:<sessionId>`.
- `src/partition.ts` — pure scope filter `applyUserTokenScope(rows, callerUserToken, scope, options)`. Handles four cases: user-plus-global (default), user-only, global-only, and pre-migration tables (returns all rows so legacy data stays visible until the migration runs).
- `src/migration.ts` — one-shot helper exposed as `openclaw ltm migrate-userToken`. Reads every row out of the legacy table, drops, recreates with the userToken-aware schema, and re-inserts with `userToken === ""` (all migrated rows land as global). Idempotent: skips when the column is already present.
- `src/partition.test.ts` + `src/session.test.ts` — vitest unit tests.

**Files modified:**
- `scripts/sentura-setup.sh` — added `sentura-memory-lancedb` to `SENTURA_EXT_IDS` (line 524); the Step 7a Node patcher now disables upstream `memory-lancedb` when the Sentura variant is wired.

**Test runner:** `scripts/test-week4-memory.ts` mirrors the vitest tests so they run via tsx in environments where `pnpm install` hasn't materialized the OpenClaw vitest workspace. 21/21 passing.

**Subtle bug caught during testing:** in `user-only` mode, an empty caller (raw CLI / no Sentura user) would accidentally see global entries because both share `userToken === ""`. Fixed by short-circuiting `applyUserTokenScope` to return `[]` when `callerUserToken === GLOBAL_USER_TOKEN` under `user-only`. Otherwise CLI processes could read every user's "global" entries by accident.

---

## 2026-04-28 — Week 4 Person A: sentura-cost extension (model.usage subscriber)

**What was done.** Built the per-agent / per-department LLM cost attribution backend. Subscribes to OpenClaw's `model.usage` diagnostic event (one per LLM call, with `costUsd` already computed by the gateway's pricing cache) and persists every call to a rolling JSONL store at `~/.openclaw/sentura-cost/cost-YYYY-MM-DD.jsonl`. Three gateway RPCs power the dashboard's Cost Center page.

**Why `model.usage` and not `llm_output` or `agent_end`.** Audit findings:
- `model.usage` diagnostic event already carries `costUsd` (computed via `openclaw/src/gateway/model-pricing-cache.ts`). Reusing it means we don't re-implement cost math against OpenRouter pricing.
- `llm_output` plugin hook lacks `costUsd` and would force re-importing the pricing cache.
- `agent_end`'s `totalTokens`/`totalCost` are explicitly undocumented in the TS hook contract — `sentura-audit` relies on them at risk; `sentura-cost` does not.

**Why JSONL not SQLite.** Matches the battle-tested `sentura-audit` pattern (rolling daily files, append-only, naturally partitioned). SQLite would be better for ad-hoc dashboard aggregation queries but adds a native dep + schema-migration story we don't need to ship before IC-4.

**Files created (sentura/extensions/sentura-cost/):**
- `openclaw.plugin.json`, `package.json`, `tsconfig.json`, `api.ts`.
- `index.ts` — subscribes to `onDiagnosticEvent`, filters for `event.type === "model.usage"`, resolves `userToken` from `sessionKey` and `tenantId/departmentId` via the `TenancyResolver`, builds a `CostEvent`, appends to the store. Registers `sentura.cost.events` (paginated query), `sentura.cost.summary` (full rollup), `sentura.cost.byUser` (user tokens hashed via SHA-256 prefix before export so cost reports never leak raw tokens). Cleans up the diagnostic-event subscription on `gateway_stop`.
- `src/types.ts` — `CostEvent`, `CostQueryParams`, `CostAggregateBucket`, `CostSummary`. `costUsd` is `number | null` to distinguish unpriced events from zero-cost events; the dashboard surfaces `unpricedCalls` separately.
- `src/store.ts` — mirror of `sentura-audit/src/store.ts` with daily rotation. Adds `readRange(start, end)` for the summary RPC where pagination doesn't apply.
- `src/aggregator.ts` — pure functions: `aggregateByAgent`, `aggregateByDepartment`, `aggregateByTenant`, `aggregateByModel`, `aggregateByUser`, `summarize`. Buckets sort by `totalCostUsd` desc; `null` department becomes the literal key `"(unassigned)"` so it shows up cleanly in the dashboard.
- `src/tenancy-resolver.ts` — cached read of `~/.openclaw/sentura-rbac/agent-tenancy.json` with mtime-based invalidation + 30s safety refresh. Hot-path: `model.usage` fires once per LLM call, so re-parsing the file on every event would be wasteful.
- `src/aggregator.test.ts` — vitest tests.

**Files modified:**
- `scripts/sentura-setup.sh` — added `sentura-cost` to `SENTURA_EXT_IDS`.

**Test runner:** `scripts/test-week4-cost.ts` covers aggregator + JSONL store round-trip. 26/26 passing.

---

## 2026-04-28 — Week 4 Person A: sentura-monitoring extension (health RPCs)

**What was done.** Built four aggregated health RPCs that the dashboard's `/cost` and `/overview` pages consume:

- `sentura.health.gateway` — process uptime, RSS in MB, started-at ISO timestamp.
- `sentura.health.employees` — registered agents from `openclaw.json` + tenancy from `agent-tenancy.json` + per-agent recent activity from the in-memory `model.usage` cache. `status: "ok"` when every registered agent is healthy; `"degraded"` when some are missing tenancy; `"down"` when no agents are registered at all.
- `sentura.health.providers` — provider availability based on a rolling 5-minute window of `model.usage` events. `"ok"` if any event in the window; `"degraded"` if last activity is older than the window; `"down"` if no activity ever recorded. Aggregated status: `"ok"` when every provider is ok, `"degraded"` if mixed, `"down"` when every provider is dead.
- `sentura.health.summary` — one-shot composition of the three above for the dashboard's "platform health" widget.

**Why a separate plugin vs. extending sentura-cost.** Cost attribution and health checks have different retention/querying needs. Cost is durable (rolling JSONL, year-long retention); health is volatile (in-memory, resets on gateway restart). Keeping them separate also lets the dashboard query each independently without blocking on the other.

**Files created (sentura/extensions/sentura-monitoring/):**
- `openclaw.plugin.json`, `package.json`, `tsconfig.json`, `api.ts`.
- `index.ts` — subscribes to `onDiagnosticEvent` with its own per-process state maps (`agentActivity` keyed by agentId, `providerActivity` keyed by provider with model set + rolling 1-hour timestamp ring). Registers the four RPCs above. Reads `agent-tenancy.json` and `openclaw.json` directly for the registry/tenancy snapshot rather than going through gateway loopback (lighter; same data either way).
- `src/types.ts` — `HealthStatus`, `HealthGateway`, `HealthEmployee[]` view-models.
- `src/checks.ts` — pure functions: `checkGateway`, `checkEmployees`, `checkProviders`, `buildSummary`. Side-effect-free so tests can hand them synthetic state objects.
- `src/checks.test.ts` — vitest tests.

**Files modified:**
- `scripts/sentura-setup.sh` — added `sentura-monitoring` to `SENTURA_EXT_IDS`.

**Test runner:** `scripts/test-week4-health.ts` — 22/22 passing.

---

## 2026-04-28 — Week 4 Person A: OpenTelemetry wiring (Step 7c)

**What was done.** Added a new **Step 7c** to `scripts/sentura-setup.sh` (and parity Step 6c to `.ps1`) that enables the upstream `diagnostics-otel` plugin and stamps the OTLP endpoint into the live config when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Skips silently with a clear log line when unset (so we don't leak traces to a non-existent collector). Idempotent.

**Why env-var-driven and not interactive.** Spinning up a collector inside the setup script would add Docker as a hard prereq, which Sentura intentionally avoids. Many enterprise runs already have a collector reachable via `OTEL_EXPORTER_OTLP_ENDPOINT`. For developers who want a one-command local pipeline, `docs/otel/docker-compose.example.yml` ships a Jaeger all-in-one snippet (documentation only — not invoked by setup).

**Files created:**
- `docs/otel/docker-compose.example.yml` — Jaeger all-in-one with the OTLP HTTP receiver on port 4318 and the Jaeger UI on 16686. Includes setup/usage notes in a comment block.
- `scripts/test-week4-otel.ts` — replays the Step 7c node-patcher against synthetic configs (env-var set vs. unset, idempotency, endpoint change, operator-customized serviceName preservation, docs example present + parseable). 19/19 passing.

**Files modified:**
- `scripts/sentura-setup.sh` — Step 7c block.
- `scripts/sentura-setup.ps1` — parity Step 6c block (PowerShell numbering offset by one because the .ps1 script consolidated bash Steps 6/7/7a/7b into Steps 5/6/6a/6b/6c).

---

## 2026-04-28 — Week 4 Person A: Gateway concurrency harness

**What was done.** Built `scripts/test-concurrent-employees.ts` — a measurement-and-tune harness that drives N concurrent WebSocket clients × M sequential RPC calls against a live OpenClaw gateway and reports p50/p95/p99 latencies per method. Verdict logic enforces the IC-4 bar: every method's concurrent p95 must stay within 2× of the single-session baseline mean.

Default mix exercises read-only methods (`health`, `config.get`, `agents.list`) so the harness can be re-run without mutating state. Pass `--mix=cost` to also drive `sentura.cost.summary` and `sentura.health.summary` once those RPCs are wired live.

**Why a tsx script vs. vitest.** Perf measurement is a tool, not a unit test — the result depends on a live gateway, available LLM providers, and host load. tsx makes it cheap to invoke ad-hoc during the W4 implementation window; CI wires up something more deterministic later.

**Files created:**
- `scripts/test-concurrent-employees.ts` — full WebSocket client + percentile computation + verdict block. Documented inline.

**Files modified:** none (pure script).

---

## 2026-04-28 — Week 4 Person A: PowerShell parity (Steps 4b/4c/6a/6b/6c)

**What was done.** Brought `scripts/sentura-setup.ps1` up to feature parity with the bash counterpart by adding five new steps that had been missing (the .ps1 script had only Steps 1-7 covering ~622 lines; bash has 1-9 covering ~1,000 lines after Week 4):

| Bash step | PowerShell step | Purpose |
|---|---|---|
| 4b | 4b | Default tenancy seed (`agent-tenancy.json`) |
| 5 | 4c | Per-agent LanceDB memoryDbPath |
| 7a | 6a | Sentura extension wiring + memory-lancedb disable |
| 7b | 6b | Clear stale meta-agent sandboxes |
| 7c | 6c | OpenTelemetry wiring |

The PowerShell numbering shifts by one starting at Step 5 because the .ps1 script collapsed the gateway-controlUi, hook-install, and admin-seed steps differently. New steps slot in by letter (4b/4c/6a/6b/6c) so the existing numbered steps don't renumber.

Each new PowerShell block uses the same `node -e $script` heredoc pattern as the existing PS file, with `$($var -replace '\\', '\\\\')` for path escaping. Idempotent: every Node patcher checks for the desired state before writing.

**Files modified:**
- `scripts/sentura-setup.ps1` — five new step blocks inserted at the matching offsets.

**Verification:** Manual diff against the bash reference confirms structural parity. End-to-end PS testing requires a Windows host (or PowerShell on macOS) with a fresh `~/.openclaw` install; deferred to the IC-4 dry run.

---

## Verification summary

```
Week 4 Person A test runners (all tsx-runnable):
  scripts/test-week4-tenancy.ts   24/24 PASS
  scripts/test-week4-memory.ts    21/21 PASS
  scripts/test-week4-cost.ts      26/26 PASS
  scripts/test-week4-health.ts    22/22 PASS
  scripts/test-week4-otel.ts      19/19 PASS
  scripts/test-concurrent-employees.ts   (live gateway required — manual)

Total automated: 112/112 PASS
```

All six TeamPlan checkboxes for Week 4 Person A are now `[x]`. PowerShell parity is shipped in the same change so fresh Windows installs don't ship with a Sentura layer that was missing extension wiring. Documentation updates land in the same commit (TESTS.md matrix rows A16–A21 + tests-person-a.md detail sections; this MEMORY entry).
