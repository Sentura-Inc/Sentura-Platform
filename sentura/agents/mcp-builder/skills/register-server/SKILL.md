# Register MCP Server with OpenClaw

## When to Use

After Phase D (Smoke Test) passes. This skill registers the newly scaffolded MCP server with the OpenClaw gateway so agents can use it.

## Procedure

### Step 1: Verify Preconditions

1. `sentura/mcp-servers/{name}/dist/index.js` exists (build succeeded).
2. `README.md` includes a "Verified Tools" section with at least one ✅ entry.
3. Caller has `ekg_manager` or higher RBAC role (verify via `sentura.rbac.roles`).

If any precondition fails → refuse with a clear error.

### Step 2: Ensure Secrets Are Registered

For each secret reference in the generated README:

1. Ask the user: "Is `$secret.{NAME}` already set in OpenClaw's secret store?"
2. If not: instruct them to add via one of:
   - Dashboard: Settings → Secrets → Add
   - CLI: `openclaw secrets set {NAME} <value>`
   - Env file: append `{NAME}=<value>` to `~/.openclaw/.env`, then restart gateway
3. Wait for confirmation before proceeding.

### Step 3: Build the `config.patch` Request

Example patch:

```json5
{
  mcp: {
    servers: {
      entries: {
        "{name}": {
          transport: "stdio",
          command: "node",
          args: ["sentura/mcp-servers/{name}/dist/index.js"],
          env: {
            // map each required secret
            "{ENV_VAR}": "$secret.{SECRET_NAME}",
          },
          // optional:
          timeoutMs: 30000,
          restartOnCrash: true,
        },
      },
    },
  },
}
```

### Step 4: Present for Confirmation

Show the proposed patch to the user:

```
## Proposed MCP Server Registration

- Entry key: mcp.servers.entries.{name}
- Command: node sentura/mcp-servers/{name}/dist/index.js
- Environment:
  - {ENV_VAR} = $secret.{NAME}
- Tools exposed: {count}

Apply this config patch? [yes / no / modify]
```

### Step 5: Apply via Gateway

On user `yes`:

```typescript
gateway.call("config.patch", {
  patch: {
    "mcp.servers.entries.{name}": { /* the entry */ }
  }
});
```

OpenClaw hot-reloads the MCP config on receipt.

### Step 6: Verify Registration

1. Call `gateway.config.get` to confirm the entry is present.
2. Call `gateway.mcp.status` (if available) to verify the server started.
3. List available tools via `gateway.mcp.tools.list` — confirm the generated tools appear.

### Step 7: Report to User

```
## MCP Server Registered

- Name: {name}
- Status: ✅ running
- Tools available: {count}
- To bind to an agent: include "{name}" in the agent's `mcp.allow` list via the Tuner Agent or Creator Agent.
```

## Tools Needed

- `gateway` — config.patch, config.get, mcp.status, mcp.tools.list
- `sessions_send` — communicate status back to user

## Safety

- NEVER register a server without a successful smoke test
- NEVER register without verifying the caller's RBAC role
- NEVER overwrite an existing MCP server entry without explicit user confirmation
- ALWAYS verify the server started successfully before reporting success
- ALWAYS provide instructions for binding the server to specific agents (via Tuner)
