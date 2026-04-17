# Employee Deployment (Phase 4)

## When to Use

Phase 4 of employee incubation. Run AFTER Phase 2 (Design) has produced a confirmed design bundle AND Phase 3 (Self-Provisioning) has ensured all required MCP servers and secrets are in place.

This skill materializes the design: writes workspace files to disk, patches the OpenClaw config, and runs a smoke test.

## Procedure

### Step 1: Precondition Checks

1. **Design bundle is complete** — all 10 workspace files + skills + EKG files are in memory.
2. **Caller is authorized** — call `sentura.rbac.roles` via gateway; caller must be `manager`, `agent_manager`, or higher.
3. **Agent ID is not taken** — call `gateway.config.get`, inspect `agents.list[]` for collision. If colliding, abort and ask user to confirm overwrite (dangerous).
4. **All required secrets are present** — for each `$secret.{NAME}` reference in the design, call `gateway.secrets.exists` (or inspect env). If missing, halt and instruct user to set them.
5. **MCP servers are available** — for each MCP server reference, verify it's either in `mcp.servers.entries` OR included in this deploy's patch.

If ANY precondition fails, abort with a clear error. Do NOT proceed with partial state.

### Step 2: Create the Workspace Directory

Use the `sentura/lib/workspace.ts` helper `createWorkspace(agentId, templateDir, industryOntologyDir)`:

1. Creates `~/.openclaw/workspace/{agent-id}/` with all subdirectories:
   - `skills/`
   - `ekg/org/`, `ekg/rules/`, `ekg/assets/`, `ekg/workflows/experience-links/`
   - `memory/users/`
2. Copies the role template if provided.
3. Merges the industry ontology into `ekg/` (additive merge per `sentura/config/ekg-schema.json5`).
4. Seeds default empty files for any missing Sentura extras (RULES.md, CONTEXT.md, MEMORY.md, USER.md).

### Step 3: Write Workspace Files

Write each of the 10 standard files + skills from the design bundle to the workspace:

```
~/.openclaw/workspace/{agent-id}/
├── SOUL.md
├── AGENTS.md
├── IDENTITY.md
├── TOOLS.md
├── USER.md
├── HEARTBEAT.md
├── BOOTSTRAP.md
├── MEMORY.md
├── RULES.md
├── CONTEXT.md
├── skills/
│   └── {capability}/SKILL.md
└── ekg/
    └── (from step 2)
```

Use `fs_write` for each file. Verify writes by reading back a small sample.

### Step 4: Write Per-Agent Plugin Config

Write `~/.openclaw/config/plugins/memory-lancedb/agents/{agent-id}.json5`:

```json5
{
  dbPath: "~/.openclaw/memory/{agent-id}/lancedb",
}
```

This ensures per-agent memory isolation. Alternatively, use the `sentura/lib/memory-isolation.ts` helper `applyMemoryIsolationOnDisk(agentId)`.

### Step 5: Patch OpenClaw Config

Assemble a single `config.patch` RPC call combining:

1. Add the agent to `agents.list` (append semantics).
2. Add channel bindings to `bindings[]` (append).
3. Add any new MCP servers to `mcp.servers.entries` (merge).

```typescript
gateway.call("config.patch", {
  patch: {
    "agents.list": {
      $append: [agentEntry],
    },
    "bindings": {
      $append: bindingEntries,
    },
    "mcp.servers.entries": mcpEntries,  // object merge
  }
});
```

Consult the OpenClaw gateway RPC schema for the exact patch syntax.

### Step 6: Register Capabilities with Orchestrator

Write capability tags to the Orchestrator agent's EKG:

`~/.openclaw/workspace/orchestrator/ekg/capabilities/{agent-id}.json5`

```json5
{
  schemaVersion: "1.0",
  agentId: "{agent-id}",
  capabilities: [
    { tag: "...", description: "..." },
  ],
  inputSchema: { required: [...], optional: [...] },
  outputSchema: { produces: [...] },
  lastUpdated: "<ISO-8601>",
}
```

This allows the Orchestrator to dispatch tasks to this agent in Mode B.

### Step 7: Wait for Hot-Reload

OpenClaw hot-reloads on `config.patch`. Wait 2-3 seconds, then:

1. Call `gateway.agents.list` to confirm the new agent is registered.
2. Call `gateway.config.get` to verify the patch was applied correctly.

### Step 8: Smoke Test

Spawn a test session and send a simple prompt that exercises a core skill:

```typescript
const sessionId = await gateway.call("sessions.spawn", { agentId: "{agent-id}" });
const result = await gateway.call("sessions.send", {
  sessionId,
  text: "Introduce yourself briefly.",
});
// Validate response shape and content
```

Criteria for smoke test pass:
- Session spawns without error.
- Agent responds within 60 seconds.
- Response mentions the correct role and company (proves SOUL.md/CONTEXT.md were loaded).
- No tool-use errors in the trace.

If smoke test fails:
1. Read trace to diagnose.
2. Common causes: bad MCP secret (fix in secret store), typo in SKILL.md, missing tool allowlist, bad binding.
3. Apply targeted fix (may require sub-patch or workspace edit).
4. Re-run smoke test. Max 3 attempts.
5. After 3 failures: roll back via `config.patch` with a reverse-append, and escalate with diagnosis.

### Step 9: Audit Log Entry (automatic)

Do NOT attempt to write audit entries manually — there is no
`sentura.audit.append` gateway RPC. The `sentura-audit` extension
(owned by Person D) is responsible for capturing deployment events
automatically via OpenClaw lifecycle hooks.

Currently the extension hooks `before_tool_call`, `after_tool_call`,
`session_start`/`_end`, `message_received`/`_sent`, `agent_end`, and
`gateway_start`/`_stop`. Every `fs_write` and every `gateway.call` the
Creator performs during deployment therefore produces audit entries
automatically.

Known gap (TeamPlan — Person D, Week 2+): there is no `config_change`
hook wired into `sentura-audit`, so `config.patch` calls themselves are
not yet audited as a dedicated `config_change` event type. Until Person D
adds that hook, the trail of tool-call entries (plus the resulting live
config) is the audit evidence for a deployment.

For querying after the fact, use:

```typescript
await gateway.call("sentura.audit.query", {
  agentId: "{agent-id}",
  limit: 100,
});
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
- Memory: ~/.openclaw/memory/{agent-id}/lancedb/
- Source template: sentura/config/templates/{template} (if used)
```

## Rollback Procedure

If deployment fails catastrophically (e.g., workspace created but config.patch succeeded with wrong entry):

1. Call `config.patch` with inverse patch to remove the agent entry.
2. Remove bindings referencing the agent.
3. Delete `~/.openclaw/workspace/{agent-id}/` (or archive to `/workspace/_archived/{agent-id}-{timestamp}/`).
4. Remove capability tags from Orchestrator EKG.
5. Report rollback status to user with root-cause analysis.

## Tools Needed

- `fs_write` — write workspace files, plugin configs
- `fs_read` — verify writes, inspect results
- `gateway` — config.patch, config.get, sessions.spawn, sessions.send, secrets.exists, sentura.rbac.roles, sentura.audit.query
- `sessions_send` — communicate with user

## Safety

- NEVER deploy without all precondition checks passing
- NEVER overwrite an existing agent without explicit user confirmation (use a "confirm overwrite" gate)
- NEVER deploy with missing secrets — halt and request
- NEVER skip the smoke test
- NEVER fabricate an `sentura.audit.append` call — it does not exist; rely on the audit extension's automatic hooks
- ALWAYS emit a per-agent `memory-lancedb.dbPath` in the patch as a design
  invariant, even though OpenClaw's `memory-lancedb` plugin currently applies
  a single global `dbPath` (per-agent isolation is realized at the collection
  level via `agentId` filtering, not separate DB files). The per-agent path
  becomes authoritative once the plugin supports per-agent dbPaths.
- ALWAYS register capabilities with the Orchestrator (for Mode B dispatch)
- ALWAYS offer a rollback on smoke-test failure
- ALWAYS include the caller's `userToken` in the audit context (currently
  captured indirectly via session metadata on tool-call hooks; once
  Person D wires a `config_change` hook, include it explicitly)
