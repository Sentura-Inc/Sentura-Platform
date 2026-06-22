# Employee Deployment (Phase 4)

## When to Use

Phase 4 of employee incubation. Run AFTER Phase 2 (Design) has produced a confirmed design bundle AND Phase 3 (Self-Provisioning) has ensured all required MCP servers and secrets are in place.

This skill materializes the design onto the host filesystem: it creates the agent workspace, writes the 8 native workspace files, writes every skill / EKG / per-user memory file, patches the OpenClaw config to register the agent + bindings + MCP servers, then runs a smoke test.

## ⛔ DO NOT STALL — DEPLOY

The moment you enter Phase 4 you make tool calls. You do NOT produce a "Draft config" codeblock and ask for confirmation. You do NOT say "If you want, I can next generate the files." The user already asked for deployment — the tool calls ARE the deliverable.

The correct response format for a successful deployment is:

1. A summary block (Employee Summary, Generated Files, Safety Guardrails, Approval Policies) — AFTER the tool calls have run.
2. Quoted output from `gateway.config.get("agents.list")` showing the new agent appears.
3. Next steps (smoke test via dashboard).

If you catch yourself writing "```json5" or "```json" as the final thing in your reply WITHOUT first having made `sentura_agents_manage` calls that actually wrote files AND a `sentura_agents_manage({ action: "register_agent", ... })` call that registered the agent in openclaw.json, STOP and restart the reply with the tool calls.

## ⛔ HARD RULES — How writes actually work

You are running inside a sandbox. Three things about that matter:

1. **`/workspace` is mounted read-only (in `workspaceAccess: "none"` mode)**, which is the default for `non-main` sandboxes like Forge's. Any `fs_write` / `apply_patch` under `/workspace/.openclaw/workspace/<agent>/...` will fail with:
   > Sandbox path is read-only; cannot create directories

2. **The `gateway` agent tool does NOT expose agent-workspace RPCs.** It only supports a fixed enum: `restart`, `config.get`, `config.schema.lookup`, `config.apply`, `config.patch`, `update.run`. `gateway.call("agents.create")` and `gateway.call("agents.files.set")` do NOT exist at the tool layer — calling them returns `unknown action`.

3. **`gateway.call("config.patch", …)` IS UNREACHABLE from Forge.** It requires `operator.admin` scope. OpenClaw's ws-connection message-handler hard-codes `silent=false` for scope upgrades, which means a manual human must click "approve" on the pairing prompt — and the `device-pair` plugin is disabled by default, so even that prompt never surfaces. From an embedded agent like Forge, a `config.patch` call hangs forever with `GatewayClientRequestError: pairing required`. **Do not use it for deploys.** Use `sentura_agents_manage({ action: "register_agent", ... })` instead — it routes the same config mutation through the in-process plugin runtime API (`api.runtime.config.{loadConfig, writeConfigFile}`) with no gateway auth, no pairing, and the same hot-reload semantics.

Use this matrix and NOTHING else:

| What you're writing | Tool / RPC |
|---|---|
| Create the agent workspace directory on the host | `sentura_agents_manage({ action: "create_agent", agentId })` |
| Any of the 8 OpenClaw-native workspace files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) | `sentura_agents_manage({ action: "write", agentId, relPath: "AGENTS.md", content })` |
| Anything under `skills/`, `ekg/`, or `memory/users/` | `sentura_agents_manage({ action: "write", agentId, relPath: "skills/...", content })` |
| Register the agent in `agents.list`, add bindings, attach MCP servers (ONE atomic write) | `sentura_agents_manage({ action: "register_agent", agentId, name, model, identity, tools, bindings, mcpServers, ... })` |
| Mark an existing workspace as bootstrap-complete (rarely needed — `create_agent` and `register_agent` already do this) | `sentura_agents_manage({ action: "stamp_setup", agentId })` |
| Read back / verify | `gateway.call("config.get", { path })` or `sentura_agents_manage({ action: "read"/"list", ... })` |

`fs_write` is only valid for scratch files inside the Creator's OWN sandbox (e.g. `/workspace/tmp/draft.md` for preview). It must NEVER target any path under `/workspace/.openclaw/workspace/<new-agent>/...`.

## Procedure

### Step 1: Precondition Checks

1. **Design bundle is complete** — all 8 native workspace files, all skills, all EKG files, bindings list, MCP server list, and the agent id / name / model / emoji are in memory.
2. **Caller is authorized** — call `sentura_rbac_manage({ action: "check_auth" })`; caller must be `manager`, `agent_manager`, or higher.
3. **Agent ID is not taken** — call `gateway.call("config.get", { path: "agents.list" })`; inspect the list for a collision on `id`. If colliding, abort and ask the user to confirm overwrite (dangerous).
4. **All required secrets are present** — for each `$secret.{NAME}` in the design, verify the ref exists. If missing, halt and instruct the user to set them.
5. **MCP servers are available** — for each MCP server referenced, verify it is either already under `mcp.servers` (OpenClaw's native path) OR included in this deploy's `register_agent` call (`mcpServers` param).

If ANY precondition fails, abort with a clear error. Do NOT proceed with partial state.

### Step 2: Create the Agent Workspace Directory

```json
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "create_agent",
    "agentId": "remy-billing-support"
  }
}
```

This is idempotent: if the directory already exists it returns `{ created: false }`. On success you get `{ agentId, workspaceDir, created, setupCompletedStamped }`. Sentura keeps `BOOTSTRAP.md` as a permanent Enterprise Context doc (instead of OpenClaw's convention of deleting it after first boot), so `create_agent` also stamps `setupCompletedAt` into `workspace-state.json` — that flag is what prevents the new employee from coming up in bootstrap-pending mode on first boot.

Do NOT fall back to `fs_write` on failure — surface the error.

### Step 3: Write the 8 Native Workspace Files

For each of the 8 native files, call `sentura_agents_manage` with `action: "write"` and the bare filename as `relPath`. The tool auto-detects that these are native top-level files and permits the write.

```json
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "write",
    "agentId": "remy-billing-support",
    "relPath": "AGENTS.md",
    "content": "## Hard Rules\n\n- ...\n"
  }
}
```

Repeat for: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`.

Invariants you MUST preserve:

- `AGENTS.md` must start with `## Hard Rules`.
- `BOOTSTRAP.md` must include a `## Enterprise Context` section.

Writes are atomic (tmp + rename inside the validated target dir).

### Step 4: Write Skills, EKG, and Per-User Memory Files

Use `sentura_agents_manage` with `action: "write"` and a `relPath` starting with `skills/`, `ekg/`, or `memory/users/`. The tool enforces:

- `relPath` validated against path traversal, absolute paths, unsafe segments, and over-deep hierarchies.
- Writes are atomic (tmp + rename).

```json
// Skills: one SKILL.md per capability
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "write",
    "agentId": "remy-billing-support",
    "relPath": "skills/billing-triage/SKILL.md",
    "content": "# Billing Triage\n..."
  }
}

// Optional supporting files (examples, prompts, templates):
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "write",
    "agentId": "remy-billing-support",
    "relPath": "skills/billing-triage/examples.md",
    "content": "..."
  }
}

// EKG: org, rules, assets, workflows/experience-links
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "write",
    "agentId": "remy-billing-support",
    "relPath": "ekg/rules/refund-policy.md",
    "content": "..."
  }
}

// Memory: per-user seed files (optional)
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "write",
    "agentId": "remy-billing-support",
    "relPath": "memory/users/MEMORY_USER_alice.md",
    "content": "..."
  }
}
```

### Step 5: Register the Agent in openclaw.json

Use the in-process `register_agent` action. It atomically:

1. Adds the agent entry to `agents.list` (or overwrites an existing entry if `overwrite: true`).
2. Appends any channel bindings you pass to `bindings[]`.
3. Merges any MCP server entries you pass under `mcp.servers.<name>`. This path is **not optional** — OpenClaw's MCP config loader (`openclaw/src/config/mcp-config.ts` → `normalizeConfiguredMcpServers(sourceConfig.mcp?.servers)`) reads exactly `mcp.servers[<name>]`. Writing to `mcp.servers.entries.<name>` or any other nested shape silently fails: OpenClaw treats `entries` as a single malformed server, skips it, and the employee gets zero MCP tools with no user-visible error.
4. Stamps `setupCompletedAt` into the new agent's `workspace-state.json` (unless you pass `stampSetupCompleted: false`), so it does not boot in bootstrap-pending mode.
5. Triggers the same hot-reload listeners that a `config.patch` would — no restart needed.

Why this replaces `gateway.call("config.patch", ...)`:
`config.*` gateway RPCs require `operator.admin` scope, and scope upgrades are hard-coded to require manual pairing approval. From Forge's embedded runtime there is no human to approve the prompt, so the gateway path deadlocks. `register_agent` uses the plugin runtime's in-process `loadConfig` / `writeConfigFile` surface, so it bypasses the gateway entirely.

```json
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "register_agent",
    "agentId": "remy-billing-support",
    "name": "Remy",
    "model": "openai/gpt-5.4",
    "identity": { "name": "Remy", "emoji": "🧾", "role": "Billing Support Rep" },
    "tools": { "profile": "employee", "alsoAllow": ["memory_query", "memory_save"] },
    "sandbox": { "mode": "non-main" },
    "runtime": { "type": "embedded" },
    "params": { "memoryDbPath": "~/.openclaw/memory/remy-billing-support/lancedb" },
    "bindings": [
      { "agentId": "remy-billing-support", "channel": "zendesk", "config": { "$secret": "ZENDESK_WEBHOOK_SECRET" } }
    ],
    "mcpServers": {
      "stripe":  { "command": "npx", "args": ["-y", "@stripe/mcp", "--tools=all"], "env": { "STRIPE_API_KEY": { "$secret": "STRIPE_API_KEY" } } },
      "zendesk": { "command": "npx", "args": ["-y", "@zendesk/mcp"], "env": { "ZENDESK_API_TOKEN": { "$secret": "ZENDESK_API_TOKEN" } } }
    }
  }
}
```

Important: always set `params.memoryDbPath` to `"~/.openclaw/memory/<agent-id>/lancedb"` as a design invariant, even though the current `memory-lancedb` plugin applies a single global `dbPath`. Per-agent isolation today is enforced at the collection level via `agentId` filtering; the path becomes authoritative once the plugin honors per-agent dbPaths.

If the agent id already exists and you intend to replace it, pass `"overwrite": true`. Nested objects (`identity`, `tools`, `sandbox`, `runtime`, `params`) are deep-merged into the existing entry so you do not accidentally drop unrelated fields.

The RPC form (for non-agent callers — tests, scripts, platform admin dashboards) is `sentura.agents.registerAgent` with the same params. It is also callable via `sentura.agents.stampSetupCompleted` if you only need the workspace-state.json stamp.

### Step 6: Register Capabilities with the Orchestrator (MANDATORY)

**You cannot proceed to Step 7 without writing the capability manifest.** Without it, the Orchestrator's `task-decomposition` skill cannot find the new employee, Mode-B routing breaks, and the deploy is incomplete.

The procedure for THIS step is inlined here so you do not have to context-switch to a sibling skill mid-deploy. (For the full extraction guidance — including tag-style rules, confidence scoring, and what to do on under-specification — see `sentura/agents/creator/skills/capability-extraction/SKILL.md`. The schema is documented in `sentura/agents/orchestrator/ekg/README.md`.)

#### 6.1: Read the new agent's workspace files (read-only)

```
sentura_agents_manage { action: "read", agentId: "<new-agent-id>", relPath: "IDENTITY.md" }
sentura_agents_manage { action: "read", agentId: "<new-agent-id>", relPath: "SOUL.md" }
sentura_agents_manage { action: "read", agentId: "<new-agent-id>", relPath: "BOOTSTRAP.md" }
sentura_agents_manage { action: "read", agentId: "<new-agent-id>", relPath: "TOOLS.md" }
sentura_agents_manage { action: "list", agentId: "<new-agent-id>", relDir: "skills" }
// Then for each skill returned by `list`:
sentura_agents_manage { action: "read", agentId: "<new-agent-id>", relPath: "skills/<name>/SKILL.md" }
```

#### 6.2: Extract the manifest fields

| Field | Source | Rules |
|-------|--------|-------|
| `agentId` | `register_agent` response | lowercase kebab-case |
| `name` | `IDENTITY.md` | display name |
| `department` | `IDENTITY.md` "Dept: …" | lowercase, single word preferred |
| `deployedAt` | `new Date().toISOString()` | ISO-8601 UTC, e.g. `"2026-04-30T10:14:00.000Z"` |
| `deployedBy` | literal `"creator"` | always |
| `capabilityTags` | skill folder names + "When to Use" verbs + `BOOTSTRAP.md` Enterprise Context | 3-10 entries, kebab-case, NO proper nouns (`marketplace-listing-management` ✅, `gradsale-listings` ❌) |
| `ioSchemas.accepts` | each `SKILL.md` Procedure inputs | array of `{ kind, description, required?, values? }` |
| `ioSchemas.produces` | each `SKILL.md` Procedure outputs | same shape; use `values: [...]` for closed enums |
| `invokableSkills` | result of `list` | folder names |
| `approvalsRequired` | `BOOTSTRAP.md` Enterprise Context "approval-required:" lines + `AGENTS.md` Hard Rules | array of strings naming each escalation rule |
| `costEstimate.tokensPerTask` | heuristic: 4000 (read-only) / 8000 (transactional) / 12000 (research-heavy) | matches the role's complexity |
| `costEstimate.model` | `register_agent` `model` field | as registered |
| `provenance.source` | literal `"creator.phase-5.capability-extraction"` | always |
| `provenance.extractedAt` | same ISO-8601 timestamp as `deployedAt` | UTC |
| `provenance.confidence` | 0.85 if every field came from explicit text; 0.7 if any tag was implicit; 0.5 if any field is under-specified | floor for routing is 0.7 — below that, set `reviewRequired: true` |

#### 6.3: Write the manifest

```
sentura_agents_manage {
  action: "write",
  agentId: "orchestrator",
  relPath: "ekg/capabilities/<new-agent-id>.json5",
  content: "<the JSON5-formatted manifest>"
}
```

Concrete example for an AP Clerk:

```json5
{
  agentId: "ap-clerk-finance",
  name: "Avery (AP Clerk)",
  department: "finance",
  deployedAt: "2026-04-30T10:14:00.000Z",
  deployedBy: "creator",
  capabilityTags: ["invoice-processing", "vendor-payment", "expense-reconciliation", "finance-reporting"],
  ioSchemas: {
    accepts: [
      { kind: "invoice-pdf", description: "Vendor invoice", required: ["vendor", "amount", "dueDate"] },
      { kind: "purchase-order-id", description: "Existing PO reference" },
    ],
    produces: [
      { kind: "payment-decision", values: ["approve", "hold-for-review", "reject"] },
      { kind: "audit-event", description: "Mirrored into sentura-audit log" },
    ],
  },
  invokableSkills: ["invoice-triage", "vendor-lookup", "payment-runs"],
  approvalsRequired: ["payment-amount-over-threshold", "new-vendor-onboarding"],
  costEstimate: { tokensPerTask: 8000, model: "openai/gpt-5.4" },
  provenance: {
    source: "creator.phase-5.capability-extraction",
    extractedAt: "2026-04-30T10:14:00.000Z",
    confidence: 0.85,
  },
  reviewRequired: false,
}
```

#### 6.4: Verify the write before proceeding

Read back what you just wrote:

```
sentura_agents_manage {
  action: "read",
  agentId: "orchestrator",
  relPath: "ekg/capabilities/<new-agent-id>.json5"
}
```

If the file is absent or empty → STOP. The deploy is in a half-state: agent registered but unrouteable. Do NOT advance to Step 7 until the manifest is on disk and parseable.

This step is the seam between Phase 5 (Deploy) and capability #17 Mechanism 1 (Manager EKG aggregation). Skipping it means the Orchestrator cannot dispatch tasks to this agent in Mode B.

### Step 7: Wait for Hot-Reload

OpenClaw hot-reloads on every in-process `writeConfigFile` (same listeners that fire on `config.patch`). Wait 2–3 seconds, then verify:

1. `gateway.call("config.get", { path: "agents.list" })` should list the new agent.
2. `gateway.call("config.get", { path: "bindings" })` should show the new bindings.
3. `gateway.call("config.get", { path: "mcp.servers" })` should show any merged servers.

### Step 8: Smoke Test

#### 8.0: Deploy-complete probe (run BEFORE telling the user "deployment complete")

Before announcing the deploy, verify the four artifacts that constitute a complete deploy. If any check fails, the deploy is incomplete — do NOT tell the user "deployment complete"; either fix the gap on the spot or roll back per the Rollback section.

| Check | How |
|-------|-----|
| Workspace files written | `sentura_agents_manage { action: "list", agentId: "<new-agent-id>" }` returns at least the 8 native files + every `skills/<name>/SKILL.md` you wrote in Phase 4 |
| Agent registered | `gateway.call("config.get", {})` → `runtimeConfig.agents.list` contains an entry with `id: "<new-agent-id>"` |
| Capability manifest written | `sentura_agents_manage { action: "read", agentId: "orchestrator", relPath: "ekg/capabilities/<new-agent-id>.json5" }` returns content with `agentId`, `capabilityTags`, `provenance.source: "creator.phase-5.capability-extraction"` — if this returns empty or errors, Step 6 was skipped → re-run Step 6 NOW |
| `setupCompletedAt` stamped | `sentura_agents_manage { action: "read", agentId: "<new-agent-id>", relPath: "../workspace-state.json" }` (or rely on the `create_agent` auto-stamp from Step 4) — without this the new agent boots in bootstrap-pending mode |

If the capability-manifest check fails: re-run Step 6 in full (read workspace files → extract fields → write manifest → verify). Do NOT fabricate the manifest from memory — read the actual workspace files first, since pre-deploy intent and post-deploy reality can differ.

#### 8.1: User-visible smoke test

The `sessions.*` RPCs are NOT exposed via the `gateway` tool. The smoke test is therefore a user-visible step:

1. Tell the user: "Deployment complete. Please open the dashboard → Agents → {agent-id} and send it a test message (e.g. 'Introduce yourself and describe your role.')."
2. Wait for the user to report back.
3. Pass criteria:
   - Agent appears in the dashboard.
   - Session opens without error.
   - Agent responds within 60 seconds.
   - Response references the correct role and company (proves `SOUL.md` + `BOOTSTRAP.md` → Enterprise Context loaded).

Failure handling:

1. Ask the user to paste any error or the last reply.
2. Common causes: missing secret, typo in `SKILL.md`, missing tool allowlist, bad binding.
3. Apply a targeted fix via `sentura_agents_manage({ action: "register_agent", overwrite: true, ... })` (to adjust agent config) or `sentura_agents_manage({ action: "write", ... })` (to overwrite a workspace file).
4. Re-run smoke test. Max 3 attempts.
5. After 3 failures: roll back (see Rollback) and escalate with the full diagnosis.

### Step 9: Audit Log (automatic)

Do NOT attempt to write audit entries manually — there is no `sentura.audit.append` agent-callable path. The `sentura-audit` extension captures deployment events automatically via OpenClaw lifecycle hooks (`before_tool_call`, `after_tool_call`, `session_start`/`_end`, `message_received`/`_sent`, `agent_end`, `gateway_start`/`_stop`).

Every `sentura_agents_manage` invocation in this skill — including `register_agent` — therefore produces audit entries automatically.

Known gap (TeamPlan — Person D, Week 2+): there is no `config_change` hook wired into `sentura-audit`, so the underlying `writeConfigFile` calls are not yet audited as a dedicated event type. Until that is wired, the trail of tool-call entries (plus the resulting live config) is the audit evidence for a deployment.

To query after the fact:

```json
{
  "tool": "sentura_audit_query",
  "args": { "agentId": "remy-billing-support", "limit": 100 }
}
```

### Step 10: Report to User

Present the final summary with a clear next-steps block:

```
## ✅ Employee Deployed: {name}

- Agent ID: {agent-id}
- Model: {model}
- Channels: {list}
- Skills: {count}
- MCP Servers: {count}
- Smoke Test: PASS ({N}/3 attempts)

### Next Steps
1. Monitor first live interactions in the Dashboard → Agents → {agent-id}.
2. Use the Tuner Agent to adjust behavior based on feedback ("Make {name} more formal").
3. Review the first week's experience-link extractions (autonomous learning).

### Location
- Workspace: ~/.openclaw/workspace/{agent-id}/
- Memory:    ~/.openclaw/memory/{agent-id}/lancedb/
- Source template: sentura/config/templates/{template} (if used)
```

## Rollback Procedure

If deployment fails catastrophically (e.g. workspace created but `register_agent` produced a broken bindings entry):

1. Forge cannot undo a `register_agent` write from its own runtime — the removal path (`agents.delete`-style mutations) is still gateway-only and will hit the same pairing block. Report the problem and surface the exact shell command for the operator / platform admin to run from a primary shell: `openclaw config patch agents.list '{"$filterOut":[{"id":"<agent-id>"}]}'` (and similar for `bindings` and `mcp.servers` if you added any).
2. Remove the capability manifest from the Orchestrator via `sentura_agents_manage({ action: "delete", agentId: "orchestrator", relPath: "ekg/capabilities/<agent-id>.json5" })`.
3. Archive the workspace: there is no `workspace.delete` RPC, so this is a manual operator step — surface it in the rollback report (recommend: move `~/.openclaw/workspace/<agent-id>/` to `~/.openclaw/workspace/_archived/<agent-id>-<timestamp>/`).
4. Report rollback status to the user with root-cause analysis, including the exact commands the operator needs to run.

## Tools Needed

- `sentura_agents_manage` — the ONLY tool that writes to the new employee's workspace on the host AND registers the agent in `openclaw.json` (create_agent, write / read / list / delete of native files AND subfiles under skills/, ekg/, memory/users/, plus register_agent / stamp_setup).
- `gateway` — `config.get`, `config.schema.lookup` (verify hot-reload and look up patch semantics for operator runbooks). **Do not** use `gateway.call("config.patch", ...)` from Forge — it deadlocks on a scope-upgrade pairing prompt that no human can answer.
- `sentura_rbac_manage` — authorization check in Step 1.
- `sentura_audit_query` — read audit trail (troubleshooting, rollback).
- `fs_write`, `fs_read` — scratch files in the Creator's own sandbox ONLY. Never for the new employee's workspace.
- `sessions_send` — communicate with the user.

## Safety

- NEVER deploy without all precondition checks passing.
- NEVER overwrite an existing agent without explicit user confirmation (and only then with `overwrite: true` on `register_agent`).
- NEVER deploy with missing secrets — halt and request.
- NEVER skip the smoke test.
- NEVER fabricate a `sentura.audit.append` call or a `gateway.agents.*` call — they do not exist at the agent-tool layer; rely on `sentura_agents_manage` and the audit extension's automatic hooks.
- NEVER use `fs_write` to create or modify an employee's workspace file — the sandbox shadow of `/workspace/.openclaw/workspace/*` is read-only, and silent partial writes can corrupt the deployment.
- NEVER call `gateway.call("config.patch", ...)` to register a new employee — it requires `operator.admin`, which triggers a non-silent pairing prompt Forge cannot answer. Use `sentura_agents_manage({ action: "register_agent", ... })`.
- ALWAYS emit a per-agent `memory-lancedb.dbPath` in the `params` block as a design invariant (see Step 5 note).
- ALWAYS register capabilities with the Orchestrator (Mode B dispatch).
- ALWAYS offer a rollback on smoke-test failure.
- ALWAYS preserve the `## Hard Rules` section at the top of `AGENTS.md` and the `## Enterprise Context` section in `BOOTSTRAP.md` when overwriting those files in Step 3.
