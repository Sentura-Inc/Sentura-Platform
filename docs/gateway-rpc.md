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
{ "method": "config.get", "params": { "path": "agents.list" } }
```

**Add a new AI employee (Creator Agent uses the `gateway` tool with action `config.patch`):**

Note: `config.patch` takes a `raw` param (JSON5 string), not a `patch` object. The patch is a merge-patch applied to the current config. `agents.list` is an **array** — the merge patch engine handles array-of-objects by matching on `id`.
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

> ⚠️ **OpenClaw does NOT use JSON-RPC 2.0 framing.** It uses a custom envelope
> with a `connect.challenge` handshake. Sending `{ jsonrpc: "2.0", method, ... }`
> will be rejected by the gateway with `code 1008: invalid request frame`.
> Reference implementation: [`scripts/probe-creator-tools.ts:71-173`](../scripts/probe-creator-tools.ts).

The protocol:

1. Client opens WebSocket → gateway sends `{ type: "event", event: "connect.challenge", payload: { nonce } }`.
2. Client replies with the `connect` request containing protocol version, client identity, role, scopes, and an auth token.
3. Gateway responds `{ type: "res", id, ok: true, payload }` — the connection is now authenticated.
4. Subsequent RPCs use the same `type: "req"` / `type: "res"` envelope. Replies carry results in `payload` (NOT `result`).

```typescript
import { WebSocket } from "ws";
import fs from "node:fs";

// Operator token lives in ~/.openclaw/openclaw.json under gateway.auth.token.
const config = JSON.parse(
  fs.readFileSync(`${process.env.HOME}/.openclaw/openclaw.json`, "utf-8"),
) as { gateway: { auth: { token: string } } };

const ws = new WebSocket("ws://localhost:18789");
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let nextId = 0;

ws.on("message", (raw: Buffer) => {
  const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

  // Step 1: respond to the handshake challenge
  if (msg.type === "event" && msg.event === "connect.challenge") {
    const id = String(++nextId);
    ws.send(JSON.stringify({
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-tui",   // must be an allowed client id (see protocol schema)
          displayName: "My Client",
          version: "0.1.0",
          platform: "node",
          mode: "ui",
        },
        caps: [],
        role: "operator",
        scopes: ["operator.read", "operator.write", "operator.admin"],
        auth: { token: config.gateway.auth.token },
      },
    }));
    return;
  }

  // Step 2: route RPC responses (note: ok / payload, NOT result)
  if (msg.type === "res") {
    const handler = pending.get(msg.id as string);
    if (!handler) return;
    pending.delete(msg.id as string);
    if (msg.ok) handler.resolve(msg.payload);
    else handler.reject(new Error((msg.error as { message?: string })?.message ?? "rpc error"));
  }
});

function rpc<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = String(++nextId);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    ws.send(JSON.stringify({ type: "req", id, method, params }));
  });
}

// config.get returns a ConfigFileSnapshot:
//   { hash, runtimeConfig: { agents: { list: [...] } }, config: { ... } (deprecated alias), ... }
// Use payload.hash as the baseHash for subsequent config.patch calls.
const snapshot = await rpc<{
  hash: string;
  runtimeConfig?: { agents?: { list?: Array<{ id: string }> } };
}>("config.get", {});
const employees = snapshot.runtimeConfig?.agents?.list ?? [];
```

---

## Per-Team Usage Summary

| Team Member | Primary RPC Methods | Purpose |
|-------------|-------------------|---------|
| **A (Platform)** | `config.*`, `health`, `models.list` | Gateway management, provider config |
| **B (AI/Skills)** | `config.patch`, `sessions.*`, `chat.*`, `cron.*`, `skills.*` | Agent lifecycle, skill management |
| **C (Dashboard)** | All read methods + `chat.send` + `exec.approval.*` | UI data, chat, approvals |
| **D (Extensions)** | `config.get`, `tools.catalog`, `plugin.approval.*` | Extension integration, approval flows |
