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
| `config.patch` | Merge-patch config (hot-reload) | `{ patch: object, hash?: string }` | Updated config + new hash |
| `config.apply` | Replace full config | `{ config: object }` | New config |
| `config.revert` | Revert to previous config state | `{}` | Reverted config |

### Key Usage Patterns

**List all AI employees:**
```json
{ "method": "config.get", "params": { "path": "agents.entries" } }
```

**Add a new AI employee (Creator Agent uses this):**
```json
{
  "method": "config.patch",
  "params": {
    "patch": {
      "agents": {
        "entries": {
          "ap-clerk-finance": {
            "model": "openai/gpt-5.2",
            "systemPrompt": "You are the AP Clerk...",
            "workspace": "./workspaces/ap-clerk-finance",
            "tools": { "allowlist": ["web_search", "pdf", "message"] },
            "memory": { "enabled": true }
          }
        }
      }
    }
  }
}
```

**Tune an employee (Tuner Agent uses this):**
```json
{
  "method": "config.patch",
  "params": {
    "patch": {
      "agents": {
        "entries": {
          "ap-clerk-finance": {
            "model": "openai/gpt-5.2"
          }
        }
      }
    }
  }
}
```

---

## Session Methods

Used by: **Person B** (agents), **Person C** (dashboard conversation view)

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `sessions.list` | List all active sessions | `{}` | Array of session summaries |
| `sessions.get` | Get session state | `{ sessionKey: string }` | Session object |
| `sessions.transcript` | Get full conversation transcript | `{ sessionKey: string }` | Message array |
| `sessions.compact` | Summarize and compact a session | `{ sessionKey: string }` | Compacted session |
| `sessions.reset` | Clear session history | `{ sessionKey: string }` | Cleared session |
| `sessions.delete` | Delete a session | `{ sessionKey: string }` | Confirmation |

### Key Usage Patterns

**View an employee's conversation:**
```json
{ "method": "sessions.transcript", "params": { "sessionKey": "slack:acme:ap-clerk-finance" } }
```

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

**Dashboard: send message to Creator Agent:**
```json
{
  "method": "chat.send",
  "params": {
    "message": "Create an AI employee for customer support that monitors Zendesk and responds on Slack",
    "sessionKey": "webchat:sentura-creator"
  }
}
```

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
const employees = await rpc("config.get", { path: "agents.entries" });
```

---

## Per-Team Usage Summary

| Team Member | Primary RPC Methods | Purpose |
|-------------|-------------------|---------|
| **A (Platform)** | `config.*`, `health`, `models.list` | Gateway management, provider config |
| **B (AI/Skills)** | `config.patch`, `sessions.*`, `chat.*`, `cron.*`, `skills.*` | Agent lifecycle, skill management |
| **C (Dashboard)** | All read methods + `chat.send` + `exec.approval.*` | UI data, chat, approvals |
| **D (Extensions)** | `config.get`, `tools.catalog`, `plugin.approval.*` | Extension integration, approval flows |
