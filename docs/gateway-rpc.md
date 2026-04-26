# OpenClaw Gateway RPC — Sentura Team Reference

This document catalogs the Gateway WebSocket JSON-RPC methods that the Sentura team will use. All communication between the Sentura Dashboard, meta-agents, and extensions goes through these RPC methods.

**Connection**: WebSocket at `ws://localhost:18789` (default)
**Protocol**: JSON-RPC over WebSocket frames
**Auth**: Include `OPENCLAW_GATEWAY_TOKEN` as a bearer token in the connection params

---

## Configuration Methods

Used by: **Person A** (infra), **Person B** (Creator/Tuner agents), **Person C** (dashboard), **Person D** (extensions)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `config.get` | Read current gateway config | `{ path?: string }` | Full or partial config object |
| `config.patch` | Merge-patch shared gateway config (hot-reload) | `{ patch: object, hash?: string }` | Updated config + new hash |
| `config.apply` | Replace full config | `{ config: object }` | New config |

### Key Usage Patterns

**List all AI employees:**
```json
{ "method": "config.get", "params": { "path": "agents.list" } }
```

**Operator-side direct patch example (not the Week 2/3 Forge path):**

Note: `config.patch` takes a `raw` param (JSON5 string), not a `patch` object. The patch is a merge-patch applied to the current config. `agents.list` is an **array** — the merge patch engine handles array-of-objects by matching on `id`. Embedded agents should use `sentura_agents_manage { action: "register_agent" }` / `sentura.agents.registerAgent` instead of patching `agents.list` themselves.
```json5
// Payload sent via the gateway tool's config.patch action
{
  agents: {
    list: [
      {
        id: "ap-clerk-finance",
        name: "AP Clerk",
        model: "openai/gpt-4o",
        runtime: { type: "embedded" },
        sandbox: { mode: "non-main" },
        tools: {
          profile: "minimal",
          alsoAllow: ["web_search", "web_fetch", "pdf", "message"],
          deny: ["exec", "gateway"],
        },
      }
    ]
  }
}
```

**Tune an employee (Tuner Agent patches an existing entry by matching `id`):**
```json5
{
  agents: {
    list: [
      {
        id: "ap-clerk-finance",
        model: "openai/gpt-5.4"
      }
    ]
  }
}
```

> Week 3 A rule: use `sentura.agents.putSecret`, `sentura.agents.hasSecret`, `sentura.agents.upsertMcpServers`, and `sentura.agents.removeMcpServers` (or the matching `sentura_agents_manage` tool actions) for per-agent self-provisioning. `config.patch` remains the shared/global config path; it is not the default path for employee-local MCP registration.

---

## Session Methods

Used by: **Person B** (agents), **Person C** (dashboard conversation view)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `sessions.create` | Create a new session | `{ agentId?: string, message?: string, label?: string }` | Session key + session summary |
| `sessions.list` | List all active sessions | `{}` | Array of session summaries |
| `sessions.get` | Get session state | `{ sessionKey: string }` | Session object |
| `sessions.transcript` | Get full conversation transcript | `{ sessionKey: string }` | Message array |
| `sessions.compact` | Summarize and compact a session | `{ sessionKey: string }` | Compacted session |
| `sessions.reset` | Clear session history | `{ sessionKey: string }` | Cleared session |
| `sessions.delete` | Delete a session | `{ sessionKey: string }` | Confirmation |

### Key Usage Patterns

**Start a dashboard 1:1 conversation with an employee:**
```json
{ "method": "sessions.create", "params": { "agentId": "ap-clerk-finance", "label": "AP Clerk chat" } }
```

**View an employee's conversation:**
```json
{ "method": "sessions.transcript", "params": { "sessionKey": "agent:ap-clerk-finance:dashboard:8d2a5dc8-97af-45cf-8bd4-7ccfc6f4d9d2" } }
```

Dashboard chat helpers (`createChatSession`, `listChatSessions`, `sendChatMessage`) use the `agent:<agentId>:dashboard:<uuid>` session-key contract, filter to dashboard sessions only, sort by `updatedAt` descending, and exclude meta-agents by default.

---

## Agent Methods

Used by: **Person B** (meta-agents), **Person C** (dashboard chat UI)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `agent` | Invoke an agent with a message | `{ message: string, agentId?: string, sessionKey?: string }` | Agent response |
| `chat.send` | Send a chat message (streaming) | `{ message: string, sessionKey: string }` | Stream of response frames |
| `chat.abort` | Abort a running agent | `{ sessionKey: string }` | Confirmation |
| `chat.history` | Get chat history | `{ sessionKey: string, limit?: number }` | Message array |

### Key Usage Patterns

**Dashboard: send message to an existing employee session:**
```json
{
  "method": "chat.send",
  "params": {
    "message": "Summarize the open AP exceptions for this week.",
    "sessionKey": "agent:ap-clerk-finance:dashboard:8d2a5dc8-97af-45cf-8bd4-7ccfc6f4d9d2"
  }
}
```

---

## Sentura Agent Host Methods

Used by: **Person A** (infra), **Person B** (Creator/Tuner/self-provisioning), **Person C** (dashboard helpers)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `sentura.agents.putSecret` | Store a per-agent secret in Sentura's file-backed secret provider | `{ agentId, service, credential, secretValue }` | Pointer + redacted metadata |
| `sentura.agents.hasSecret` | Check whether a per-agent secret already exists | `{ agentId, service, credential }` | `{ exists, pointer, ... }` |
| `sentura.agents.upsertMcpServers` | Write per-agent MCP servers into `~/.openclaw/workspace/<agentId>/config.json5 -> mcpServers` | `{ agentId, mcpServers }` | Changed flag + config path + diff metadata |
| `sentura.agents.removeMcpServers` | Remove named per-agent MCP servers from `config.json5 -> mcpServers` | `{ agentId, serverNames }` | Changed flag + config path + diff metadata |

### Week 3 A Contracts

- Secret ids use the canonical path `/sentura/agents/<agentId>/<service>/<credential>`.
- MCP env values store secret pointers as strings, for example `"$secret:/sentura/agents/ap-clerk-finance/zendesk/api_key"`.
- Secret pointer resolution is supported only for stdio MCP servers and only in the server's `env` map.
- Remote HTTP/SSE MCP servers remain operator-managed this round; do not place `$secret:` pointers in `headers`.
- `register_agent(..., mcpServers)` remains available for shared/global `openclaw.json -> mcp.servers` wiring, but self-provisioning defaults to per-agent `config.json5 -> mcpServers`.

**Per-agent MCP registration example:**
```json5
{
  "method": "sentura.agents.upsertMcpServers",
  "params": {
    "agentId": "ap-clerk-finance",
    "mcpServers": {
      "zendesk": {
        "command": "npx",
        "args": ["-y", "@mcp-servers/zendesk"],
        "env": {
          "ZENDESK_API_KEY": "$secret:/sentura/agents/ap-clerk-finance/zendesk/api_key",
          "ZENDESK_SUBDOMAIN": "acme"
        }
      }
    }
  }
}
```

The host helper preserves the pointer in `config.json5`, wraps stdio servers with Sentura's launcher, and resolves the plaintext secret only when the child MCP process is spawned.

---

## Cron Methods

Used by: **Person B** (scheduled agent tasks), **Person C** (dashboard cron management)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `cron.list` | List all cron jobs | `{}` | Array of cron job definitions |
| `cron.add` | Create a new cron job | `{ schedule, message, agentId?, sessionKey? }` | New job ID |
| `cron.update` | Update an existing cron job | `{ id, patch }` | Updated job |
| `cron.remove` | Delete a cron job | `{ id }` | Confirmation |
| `cron.run` | Manually trigger a cron job | `{ id }` | Run result |

### Key Usage Patterns

**Schedule a daily report for an AI employee:**
```json
{
  "method": "cron.add",
  "params": {
    "schedule": "0 9 * * 1-5",
    "message": "Generate and send the daily AP aging report to #finance-daily on Slack",
    "agentId": "ap-clerk-finance"
  }
}
```

---

## Approval Methods

Used by: **Person C** (dashboard approval queue), **Person D** (approval extension)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `exec.approval.list` | List pending exec approvals | `{}` | Pending approval array |
| `exec.approval.resolve` | Approve or reject an execution | `{ id, approved: boolean, reason? }` | Resolution result |
| `plugin.approval.list` | List pending plugin approvals | `{}` | Pending approval array |
| `plugin.approval.resolve` | Approve or reject a plugin action | `{ id, approved: boolean, reason? }` | Resolution result |

### Key Usage Patterns

**Dashboard: list pending approvals:**
```json
{ "method": "exec.approval.list", "params": {} }
```

**Dashboard: approve an action:**
```json
{ "method": "exec.approval.resolve", "params": { "id": "approval-123", "approved": true } }
```

---

## Skills Methods

Used by: **Person B** (skill management), **Person C** (dashboard skill browser)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `skills.list` | List available skills | `{}` | Skill manifest array |
| `skills.install` | Install a skill | `{ source }` | Installation result |
| `skills.enable` | Enable a skill for an agent | `{ skillId, agentId }` | Confirmation |
| `skills.disable` | Disable a skill for an agent | `{ skillId, agentId }` | Confirmation |

---

## Model & Tool Discovery

Used by: **Person C** (dashboard settings), **Person D** (extension development)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `models.list` | List configured LLM models | `{}` | Provider + model array |
| `tools.catalog` | List available tools | `{}` | Tool manifest array |
| `health` | Gateway health status | `{}` | Health object |

---

## Gateway Events (Server → Client)

Subscribe to these events via WebSocket for real-time updates.

| Event | Description | Payload |
|-------|-------------|---------|
| `session.message` | New message in a session | `{ sessionKey, message, role }` |
| `session.tool` | Tool execution event | `{ sessionKey, toolName, status, result? }` |
| `presence` | User/agent online/offline | `{ id, status }` |
| `heartbeat` | Keepalive ping | `{ timestamp }` |
| `cron` | Cron job executed | `{ jobId, status, result? }` |
| `config.changed` | Config was patched | `{ path, patch }` |
| `approval.pending` | New approval request | `{ id, agentId, action, context }` |
| `approval.resolved` | Approval resolved | `{ id, approved, resolver }` |

---

## Connection Example (TypeScript)

```typescript
const ws = new WebSocket("ws://localhost:18789");

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    method: "connect",
    params: { token: process.env.OPENCLAW_GATEWAY_TOKEN },
    id: 1,
  }));
};

// Send an RPC call
function rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener("message", handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ jsonrpc: "2.0", method, params, id }));
  });
}

// List all AI employees
const employees = await rpc("config.get", { path: "agents.list" });
```

---

## Per-Team Usage Summary

| Team Member | Primary RPC Methods | Purpose |
|-------------|-------------------|---------|
| **A (Platform)** | `config.*`, `sentura.agents.*`, `health`, `models.list` | Gateway management, secret/MCP host helpers, provider config |
| **B (AI/Skills)** | `sentura.agents.*`, `sessions.*`, `chat.*`, `cron.*`, `skills.*` | Agent lifecycle, self-provisioning, communication-panel plumbing |
| **C (Dashboard)** | All read methods + `sessions.create` + `chat.send` + `exec.approval.*` | UI data, 1:1 chat, approvals |
| **D (Extensions)** | `config.get`, `tools.catalog`, `plugin.approval.*` | Extension integration, approval flows |
