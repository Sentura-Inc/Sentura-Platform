# Agent Config Schema (OpenClaw)

> **This file is the authoritative, inline reference for the OpenClaw
> agent config schema.** You are sandboxed — you **cannot** read the
> OpenClaw source or docs directly. Everything you need to build a
> valid `config.patch` is on this page.

## When to Use

Use this skill **every time** you assemble a `config.patch` payload in
Phase 2 (Design & Configuration) or Phase 5 (Deploy & Go Live).

### Do NOT `fs_read` any of these

All of the following live **outside your sandbox root**
(`~/.openclaw/sandboxes/agent-creator-*`) and the `read` tool will
reject them with `Path escapes sandbox root`:

- `~/Desktop/.../openclaw/docs/...` — OpenClaw docs
- `~/Desktop/.../openclaw/src/...` — OpenClaw source
- `~/.openclaw/openclaw.json` — the live gateway config
- `~/.openclaw/config.json` / `~/.openclaw/config.json5` — do **not
  speculate** filenames; the on-disk name is irrelevant to you
- `~/.openclaw/.env`, `~/.openclaw/*` in general — host-level files
- `~/.openclaw/workspace/<some-other-agent>/...` — other agents'
  workspaces

### Read the live config the RIGHT way

To inspect the current config, use the `gateway` tool with
`action: "config.get"` (RPC). The gateway returns the validated,
merged config tree — there is no reason to touch the JSON file on
disk, and doing so will always fail the sandbox check.

```text
gateway { action: "config.get", path: "agents.list" }
gateway { action: "config.get", path: "bindings" }
```

To mutate the config, use `config.patch` (see "Applying the Patch"
below). Again: never `fs_write` the live config file.

Trust this skill for schema details. If a field appears unfamiliar,
escalate to the human instead of attempting a sandbox escape.

## Top-Level Shape

A valid patch that registers one employee looks like this, and nothing
else at the top level is required:

```json5
{
  agents: {
    list: [
      {
        id: "ap-clerk-finance",
        name: "Remy",
        model: "openai/gpt-5.4",
        skills: ["~/.openclaw/workspace/ap-clerk-finance/skills/*"],
        runtime: { type: "embedded" },
        sandbox: { mode: "non-main" },
        tools: {
          profile: "minimal",
          alsoAllow: ["web_fetch", "browser"],
          deny: ["exec", "gateway"],
        },
      },
    ],
  },
  bindings: [
    {
      agentId: "ap-clerk-finance",
      match: { channel: "webchat", peer: { kind: "direct", id: "*" } },
    },
  ],
}
```

Key invariants — violating any of these will get the patch rejected by
the gateway:

- `agents` is `strict()`. The only allowed keys are `defaults` and
  `list`. There is **no** `agents.entries`. There is **no** top-level
  `agents` array.
- Each entry in `agents.list` is `strict()`. Every field below is
  optional **unless explicitly marked required**. Unknown fields are
  rejected.
- `systemPrompt` does **not exist** as a field on an agent entry.
  Identity is injected from OpenClaw's 8 native workspace files
  (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`,
  `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`). Sentura writes Hard
  Rules inside `AGENTS.md` and Enterprise Context inside `BOOTSTRAP.md`
  so they ride the highest-priority native prompt slots.
- `bindings` is **top-level**. Do not nest it inside an agent entry.
- Do not set `workspace` on the agent entry. OpenClaw defaults to
  `~/.openclaw/workspace/{agent-id}` — matching the path you create
  via `sentura_agents_manage({action:"create_agent", agentId})`.
- `sandbox.mode` must be `"non-main"` for every AI employee (see the
  Hard Rules section of each AGENTS.md). `"main"` is forbidden;
  `"off"` is reserved for debugging meta-agents.

## `agents.list[*]` Field Reference

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (**required**) | Slug: lowercase, kebab-case, stable. Used as the workspace dir name. |
| `default` | `boolean?` | Marks the fallback agent when no binding matches. Leave `false` for employees. |
| `name` | `string?` | Human-facing display name, e.g. `"Remy"`. |
| `model` | `string?` | `"provider/model"`, e.g. `"openai/gpt-5.4"`, `"anthropic/claude-4.6-sonnet"`. |
| `skills` | `string[]?` | Glob paths. Use `["~/.openclaw/workspace/{id}/skills/*"]`. |
| `thinkingDefault` | enum? | One of `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"adaptive"`. |
| `reasoningDefault` | enum? | One of `"on"`, `"off"`, `"stream"`. |
| `fastModeDefault` | `boolean?` | Keep `false` for production employees. |
| `sandbox` | object? | See **Sandbox** below. |
| `tools` | object? | See **Tools** below. |
| `runtime` | object? | `{ type: "embedded" }` for in-process (default) or `{ type: "acp", acp: {...} }` for ACP subprocess agents. Use `embedded` unless you explicitly need an ACP backend. |
| `identity` | object? | Avatar / emoji metadata. Prefer setting in `IDENTITY.md` instead. |
| `heartbeat` | object? | Proactive cron. See **Heartbeat** below. Leave unset unless the employee has a real schedule. |
| `humanDelay` | object? | Typing-latency simulation. Rarely needed. |
| `groupChat` | object? | Multi-party channel rules. Rarely needed. |
| `memorySearch` | object? | Overrides for semantic memory lookups. Leave default. |
| `subagents` | object? | `{ allowAgents?, model?, thinking?, requireAgentId? }`. Only set for meta-agents that spawn others. |
| `params` | `Record<string, unknown>?` | Free-form kwargs surfaced to tools/skills. Use sparingly. |
| `workspace` | `string?` | **Do not set.** Let OpenClaw default to `~/.openclaw/workspace/{id}`. |
| `agentDir` | `string?` | **Do not set** unless the employee needs a non-default on-disk home. |
| `systemPromptOverride` | `string?` | **Do not set.** Use `SOUL.md`/`AGENTS.md`. |

### Sandbox

```json5
sandbox: {
  mode: "non-main",            // REQUIRED for employees
  backend: "docker",           // optional; defaults to the gateway default
  workspaceAccess: "rw",       // "none" | "ro" | "rw"
  sessionToolsVisibility: "spawned",  // "spawned" | "all"
  scope: "session",            // "session" | "agent" | "shared"
  // workspaceRoot: "~/.openclaw/sandboxes/agent-{id}",  // usually inferred
  // docker: { ... },          // see SandboxDockerSchema
  // browser: { ... },
  // ssh: { ... },
  // prune: { ... },
}
```

Only set the keys you need. Sandbox is `strict()`.

### Tools

```json5
tools: {
  profile: "minimal",          // "minimal" | "coding" | "messaging" | "full"
  alsoAllow: ["web_fetch"],    // add on top of the profile
  deny: ["exec", "gateway"],   // revoke even if profile would have granted
  // byProvider: { ... },      // per-provider overrides; rarely needed
  // elevated, exec, fs, loopDetection, sandbox: { ... }
}
```

**Rules the zod schema enforces:**

- You cannot set both `allow` and `alsoAllow` in the same scope. Pick
  one strategy. For employees, prefer `profile + alsoAllow`.
- `profile` is optional but strongly recommended — leaving it unset
  gives no tools at all unless you set `allow`.
- `deny` always wins.
- The `gateway` tool is reserved for meta-agents. Employees must have
  `"gateway"` in `deny` (see the Creator `AGENTS.md` Hard Rules).

### Heartbeat (only if the employee needs proactive checks)

```json5
heartbeat: {
  every: "15m",                // ms/s/m/h duration; required if object present
  activeHours: { start: "09:00", end: "18:00", timezone: "America/New_York" },
  prompt: "Check overnight AP inbox and summarize.",
  target: "slack:#finance",    // optional channel to send the ack to
}
```

## Top-Level `bindings`

`bindings` is an array. Each entry is either a **Route** binding (the
common case) or an **ACP** binding.

### Route binding

```json5
{
  // type: "route" is the default — may be omitted
  agentId: "ap-clerk-finance",
  comment: "Route finance DMs to Remy",
  match: {
    channel: "slack",           // required
    accountId: "T0123456",      // optional workspace/team filter
    peer: { kind: "channel", id: "#ap-clerk" },   // peer.kind ∈ {direct, group, channel, dm}
    guildId: "...",             // Discord only
    teamId: "...",              // Teams only
    roles: ["billing-team"],    // optional role filter
  },
}
```

`peer.kind` values:

- `"direct"` — DM / 1:1 conversation (preferred for personal employees).
- `"group"` — group DM.
- `"channel"` — shared channel / room.
- `"dm"` — deprecated alias for `"direct"`. Don't emit; accept only.

### ACP binding

Use **only** when the runtime is `{ type: "acp" }`. Requires a concrete
`match.peer.id` — the schema will reject an empty one.

```json5
{
  type: "acp",
  agentId: "ap-clerk-finance",
  match: { channel: "webchat", peer: { kind: "direct", id: "remy-debug" } },
  acp: { mode: "persistent", label: "remy-debug", backend: "embedded-acpx" },
}
```

## Applying the Patch

Use the `gateway` tool with `action: "config.patch"`. The patch is a
deep-merge over `~/.openclaw/openclaw.json`.

Merging semantics to remember:

- Arrays (`agents.list`, `bindings`) are **replaced** when patched — the
  gateway's `config.patch` does a deep merge for objects but treats
  arrays as atomic replacements. When adding a new employee, fetch the
  current `agents.list` via `config.get` first, append the new entry,
  and patch the full array back. Same for `bindings`.
- Keys you omit are preserved. Keys you set to `null` are dropped.
- Validation runs before the patch is applied; on failure you get the
  exact zod path, e.g. `agents.list[0].sandbox: unexpected property
  'dockerImage'`. Match the field name exactly.

## Minimal Walk-Through (Remy example)

```text
1. gateway { action: "config.get", path: "agents.list" }
   gateway { action: "config.get", path: "bindings" }
2. Build newEntry with id: "ap-clerk-finance", minimal tools, sandbox.mode: "non-main"
3. sentura_agents_manage { action: "create_agent", agentId: "ap-clerk-finance" }
4. sentura_agents_manage { action: "write", agentId: "ap-clerk-finance",
                           relPath: "AGENTS.md",     content: "…" }
   sentura_agents_manage { action: "write", agentId: "ap-clerk-finance",
                           relPath: "SOUL.md",       content: "…" }
   … (repeat for TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md,
      BOOTSTRAP.md, MEMORY.md)
5. sentura_agents_manage { action: "write", agentId: "ap-clerk-finance",
                           relPath: "skills/<name>/SKILL.md", content: "…" }
   …one call per skill / EKG seed file.
6. gateway { action: "config.patch", ops: [
     { op: "append", path: "agents.list", value: newEntry },
     { op: "append", path: "bindings",    value: newBinding },
   ] }
7. gateway { action: "config.get", path: "agents.list" }  // verify hot-reload
8. Ask the human to send a smoke message in the dashboard; agent-side
   `sessions.*` RPCs are not tool-exposed.
```

## Tools Needed

- `gateway` — `config.get` to inspect the config, `config.patch` to
  apply the new agent entry + binding. This is the **only** tool
  action list exposed to agents: `restart`, `config.get`,
  `config.schema.lookup`, `config.apply`, `config.patch`, `update.run`.
  In particular, `agents.create` and `agents.files.set` are **NOT**
  reachable from the `gateway` tool — use `sentura_agents_manage`
  for those instead.
- `sentura_agents_manage` — creates the employee workspace directory
  and writes every file (native + skills + ekg + memory/users). This
  is the correct tool for workspace materialization. `fs_write`
  CANNOT write under `/workspace/.openclaw/workspace/<agent-id>/`
  because the sandbox mount is read-only in `non-main` mode.
- `fs_write` / `fs_read` — scratch files in the Creator's OWN sandbox
  only. Never touch another agent's workspace with these.

## Safety

- NEVER emit fields outside this schema. Extra keys fail strict
  validation.
- NEVER set `sandbox.mode` to `"main"` or `"all"` for an employee.
- NEVER grant `"gateway"` to an employee's `alsoAllow`. Add it to
  `deny`.
- NEVER hardcode credentials. Use `"${SECRET_NAME}"` placeholders in
  config, and store the actual value via the secret store.
- NEVER try to read OpenClaw source or docs to "verify" the schema.
  This file is authoritative; if you believe it is wrong, escalate to
  the human rather than attempting a sandbox escape.
- ALWAYS call `config.get` before `config.patch` so you replace arrays
  intentionally.
- ALWAYS ask the human to run a smoke message through the dashboard
  after deployment — `sessions.*` RPCs are not exposed to the
  `gateway` tool, so Forge cannot self-test.
- NEVER try to use `fs_write` or `apply_patch` to create an employee
  workspace. The sandbox mount of `/workspace/.openclaw/workspace/`
  is read-only. Use `sentura_agents_manage` for every employee file.
