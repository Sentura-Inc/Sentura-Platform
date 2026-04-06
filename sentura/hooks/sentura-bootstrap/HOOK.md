---
name: sentura-bootstrap
description: "Inject Sentura workspace files (RULES.md, CONTEXT.md) into agent system prompt"
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

Injects Sentura-specific workspace files (`RULES.md` and `CONTEXT.md`) into the agent's system prompt during bootstrap.

## Why

OpenClaw natively loads 8 workspace files into the system prompt (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md). Sentura extends every AI employee with two additional files:

- **RULES.md** — Hard safety boundaries (NEVER/ALWAYS rules) that constrain the agent's behavior
- **CONTEXT.md** — Enterprise organizational context (company structure, systems, policies)

This hook reads those files from the agent's workspace directory and appends them to the bootstrap context so they appear in the system prompt alongside the standard 8 files.

## How It Works

1. Hooks into the `agent:bootstrap` event
2. Resolves the agent's workspace directory from the event context
3. Reads `RULES.md` and `CONTEXT.md` from the workspace root (if they exist)
4. Appends them to `context.bootstrapFiles` so they flow into `# Project Context`

Files that don't exist are silently skipped — this hook is safe to run on agents that don't have Sentura workspace files.

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

No additional configuration is needed. The hook automatically finds RULES.md and CONTEXT.md in each agent's workspace directory.
