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

If you catch yourself writing "```json5" or "```json" as the final thing in your reply WITHOUT first having made `sentura_agents_manage` and `gateway` calls that actually wrote files and patched config, STOP and restart the reply with the tool calls.

## ⛔ HARD RULES — How writes actually work

You are running inside a sandbox. Two things about that matter:

1. **`/workspace` is mounted read-only (in `workspaceAccess: "none"` mode)**, which is the default for `non-main` sandboxes like Forge's. Any `fs_write` / `apply_patch` under `/workspace/.openclaw/workspace/<agent>/...` will fail with:
   > Sandbox path is read-only; cannot create directories

2. **The `gateway` agent tool does NOT expose agent-workspace RPCs.** It only supports a fixed enum: `restart`, `config.get`, `config.schema.lookup`, `config.apply`, `config.patch`, `update.run`. `gateway.call("agents.create")` and `gateway.call("agents.files.set")` do NOT exist at the tool layer — calling them returns `unknown action`.

Use this matrix and NOTHING else:

| What you're writing | Tool / RPC |
|---|---|
| Create the agent workspace directory on the host | `sentura_agents_manage({ action: "create_agent", agentId })` |
| Any of the 8 OpenClaw-native workspace files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) | `sentura_agents_manage({ action: "write", agentId, relPath: "AGENTS.md", content })` |
| Anything under `skills/`, `ekg/`, or `memory/users/` | `sentura_agents_manage({ action: "write", agentId, relPath: "skills/...", content })` |
| Register the agent, add bindings, attach MCP servers | `gateway.call("config.patch", { path, value })` |
| Read back / verify | `gateway.call("config.get", { path })` or `sentura_agents_manage({ action: "read"/"list", ... })` |

`fs_write` is only valid for scratch files inside the Creator's OWN sandbox (e.g. `/workspace/tmp/draft.md` for preview). It must NEVER target any path under `/workspace/.openclaw/workspace/<new-agent>/...`.

## Procedure

### Step 1: Precondition Checks

1. **Design bundle is complete** — all 8 native workspace files, all skills, all EKG files, bindings list, MCP server list, and the agent id / name / model / emoji are in memory.
2. **Caller is authorized** — call `sentura_rbac_manage({ action: "check_auth" })`; caller must be `manager`, `agent_manager`, or higher.
3. **Agent ID is not taken** — call `gateway.call("config.get", { path: "agents.list" })`; inspect the list for a collision on `id`. If colliding, abort and ask the user to confirm overwrite (dangerous).
4. **All required secrets are present** — for each `$secret.{NAME}` in the design, verify the ref exists. If missing, halt and instruct the user to set them.
5. **MCP servers are available** — for each MCP server referenced, verify it is either already in `mcp.servers.entries` OR included in this deploy's `config.patch` body.

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

This is idempotent: if the directory already exists it returns `{ created: false }`. On success you get `{ agentId, workspaceDir, created }`.

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

### Step 5: Patch OpenClaw Config

Assemble a `config.patch` combining:

1. Add the agent to `agents.list` (append semantics).
2. Add channel bindings to `bindings[]` (append).
3. Add any new MCP servers to `mcp.servers.entries` (object merge).

```json
{
  "tool": "gateway",
  "args": {
    "action": "config.patch",
    "patch": {
      "agents.list":        { "$append": [{ "id": "remy-billing-support", "name": "Remy", "model": "...", "params": { ... } }] },
      "bindings":           { "$append": [ ... ] },
      "mcp.servers.entries": { "stripe": { ... }, "zendesk": { ... } }
    }
  }
}
```

Consult the OpenClaw gateway RPC schema (`gateway.call("config.schema.lookup", ...)`) for exact patch semantics (`$append`, `$set`, `$merge`, etc.).

Important: set `agentEntry.params.memoryDbPath` to `"~/.openclaw/memory/<agent-id>/lancedb"` as a design invariant, even though the current `memory-lancedb` plugin applies a single global `dbPath`. Per-agent isolation today is enforced at the collection level via `agentId` filtering; the path becomes authoritative once the plugin honors per-agent dbPaths.

### Step 6: Register Capabilities with the Orchestrator

Write a capability manifest into the Orchestrator's EKG — same tool as Step 4, just a different `agentId`:

```json
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "write",
    "agentId": "orchestrator",
    "relPath": "ekg/capabilities/remy-billing-support.json5",
    "content": "{\n  schemaVersion: '1.0',\n  agentId: 'remy-billing-support',\n  capabilities: [...],\n  ...\n}"
  }
}
```

This lets the Orchestrator dispatch tasks to this agent in Mode B.

### Step 7: Wait for Hot-Reload

OpenClaw hot-reloads on `config.patch`. Wait 2–3 seconds, then verify:

1. `gateway.call("config.get", { path: "agents.list" })` should list the new agent.
2. `gateway.call("config.get", { path: "bindings" })` should show the new bindings.
3. `gateway.call("config.get", { path: "mcp.servers.entries" })` should show any merged servers.

### Step 8: Smoke Test

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
3. Apply a targeted fix via `config.patch` or overwrite the offending file via `sentura_agents_manage({ action: "write", ... })`.
4. Re-run smoke test. Max 3 attempts.
5. After 3 failures: roll back (see Rollback) and escalate with the full diagnosis.

### Step 9: Audit Log (automatic)

Do NOT attempt to write audit entries manually — there is no `sentura.audit.append` agent-callable path. The `sentura-audit` extension captures deployment events automatically via OpenClaw lifecycle hooks (`before_tool_call`, `after_tool_call`, `session_start`/`_end`, `message_received`/`_sent`, `agent_end`, `gateway_start`/`_stop`).

Every `sentura_agents_manage` invocation and every `gateway.call("config.patch", ...)` call in this skill therefore produces audit entries automatically.

Known gap (TeamPlan — Person D, Week 2+): there is no `config_change` hook wired into `sentura-audit`, so `config.patch` calls themselves are not yet audited as a dedicated event type. Until that is wired, the trail of tool-call entries (plus the resulting live config) is the audit evidence for a deployment.

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

If deployment fails catastrophically (e.g. workspace created but `config.patch` registered the agent with broken bindings):

1. Call `gateway.call("config.patch", ...)` with an inverse patch to remove the agent entry (`agents.list: { $filterOut: [{ id: agentId }] }`) and any bindings / MCP entries you added.
2. Remove the capability manifest from the Orchestrator via `sentura_agents_manage({ action: "delete", agentId: "orchestrator", relPath: "ekg/capabilities/<agent-id>.json5" })`.
3. Archive the workspace: there is no `workspace.delete` RPC, so this is a manual operator step — surface it in the rollback report (recommend: move `~/.openclaw/workspace/<agent-id>/` to `~/.openclaw/workspace/_archived/<agent-id>-<timestamp>/`).
4. Report rollback status to the user with root-cause analysis.

## Tools Needed

- `sentura_agents_manage` — the ONLY tool that writes to the new employee's workspace on the host (create_agent, write / read / list / delete of native files AND subfiles under skills/, ekg/, memory/users/).
- `gateway` — `config.get`, `config.patch`, `config.schema.lookup` (register the agent, verify hot-reload).
- `sentura_rbac_manage` — authorization check in Step 1.
- `sentura_audit_query` — read audit trail (troubleshooting, rollback).
- `fs_write`, `fs_read` — scratch files in the Creator's own sandbox ONLY. Never for the new employee's workspace.
- `sessions_send` — communicate with the user.

## Safety

- NEVER deploy without all precondition checks passing.
- NEVER overwrite an existing agent without explicit user confirmation.
- NEVER deploy with missing secrets — halt and request.
- NEVER skip the smoke test.
- NEVER fabricate a `sentura.audit.append` call or a `gateway.agents.*` call — they do not exist at the agent-tool layer; rely on `sentura_agents_manage` and the audit extension's automatic hooks.
- NEVER use `fs_write` to create or modify an employee's workspace file — the sandbox shadow of `/workspace/.openclaw/workspace/*` is read-only, and silent partial writes can corrupt the deployment.
- ALWAYS emit a per-agent `memory-lancedb.dbPath` in the patch as a design invariant (see Step 5 note).
- ALWAYS register capabilities with the Orchestrator (Mode B dispatch).
- ALWAYS offer a rollback on smoke-test failure.
- ALWAYS preserve the `## Hard Rules` section at the top of `AGENTS.md` and the `## Enterprise Context` section in `BOOTSTRAP.md` when overwriting those files in Step 3.
