---
name: sentura-bootstrap
description: "Inject per-user Sentura memory (MEMORY_USER_{token}.md) into agent system prompt"
metadata:
  {
    "openclaw":
      {
        "emoji": "🛡️",
        "events": ["agent:bootstrap"],
        "install": [{ "id": "managed", "kind": "managed", "label": "Installed by Sentura setup" }],
      },
  }
---

# Sentura Bootstrap Hook

Injects Sentura's per-user memory file into the agent's system prompt during bootstrap.

## Why

OpenClaw natively loads 8 workspace files into the system prompt: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`. As of 2026-04-17, Sentura writes its platform-level conventions directly into those 8 files:

- **Hard Rules** (safety boundaries, NEVER/ALWAYS) live inside each agent's `AGENTS.md` under a `## Hard Rules (must not override)` section.
- **Enterprise Context** (company structure, systems, policies) lives inside each agent's `BOOTSTRAP.md` under a `## Enterprise Context` section.

This keeps every Sentura agent using exactly the 8-file native layout — the runtime already gives those files highest prompt priority, so hard rules are no longer injected as a lower-priority extension.

The one Sentura-specific prompt extension this hook still performs is **per-user memory**. When a session is bound to a user token (via the `agent:{id}:user:{token}:*` session-key convention), the hook loads `memory/users/MEMORY_USER_{token}.md` from the agent's workspace and appends it to `context.bootstrapFiles`. This allows a single employee workspace to maintain separate memory per human user without fan-out into many workspaces.

## How It Works

1. Hooks into the `agent:bootstrap` event.
2. Parses the session key for a user token (pattern `agent:{id}:user:{token}:...`).
3. If a token is present, reads `memory/users/MEMORY_USER_{token}.md` from the workspace.
4. If the file exists and is non-empty, appends it to `context.bootstrapFiles` so it flows into `# Project Context`.

Sessions without a user token, or users without an existing memory file, are silently skipped.

## Configuration

Enable in `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "sentura-bootstrap": {
          "enabled": true
        }
      }
    }
  }
}
```

No additional configuration is needed. The hook automatically resolves per-user memory based on the session key.
