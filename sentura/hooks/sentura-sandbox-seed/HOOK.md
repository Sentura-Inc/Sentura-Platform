---
name: sentura-sandbox-seed
description: "Re-seed Sentura meta-agent sandbox workspaces from the host workspace on every bootstrap (skills/, memory/, ekg/, custom BOOTSTRAP.md, config.json5, MEMORY.md)"
metadata:
  {
    "openclaw":
      {
        "emoji": "📦",
        "events": ["agent:bootstrap"],
        "install": [{ "id": "managed", "kind": "managed", "label": "Installed by Sentura setup" }],
      },
  }
---

# Sentura Sandbox Seed Hook

Re-seeds the **agent's sandbox workspace** from the matching **host workspace**
at every `agent:bootstrap`. Fixes a long-standing defect where OpenClaw's native
`ensureSandboxWorkspace` only copies **7 markdown files on first boot** and
never syncs:

- the `skills/` subdirectory,
- `memory/` (including per-user memory files under `memory/users/`),
- `ekg/` (enterprise knowledge graph assets),
- the agent's `config.json5`,
- `MEMORY.md` (OpenClaw seeds the other 7 files but omits MEMORY.md),
- and — critically — **any customized `BOOTSTRAP.md`** written after the
  sandbox's initial creation (because the seed step uses `fs.access(dest)` and
  skips on existence, so the 700-byte default stub wins forever).

Without this hook the Creator / Tuner / Orchestrator agents boot into an
essentially empty sandbox and have no skills to drive employee creation.

## Why a hook, not a patch to OpenClaw?

Sentura rule #7 forbids modifying OpenClaw core. The `agent:bootstrap` event
is the earliest moment at which Sentura code runs inside a sandboxed agent
with access to both the `workspaceDir` (sandbox path) and `agentId`, which is
everything we need to locate the matching host workspace and hydrate it.

## How It Works

1. The hook fires on `agent:bootstrap` for **every** agent boot.
2. It inspects `context.workspaceDir`:
   - if it is not a sandbox path (`~/.openclaw/sandboxes/agent-*`), the hook
     is a no-op (the main runtime and the host workspace are identical).
3. It locates the host workspace:
   - primary: `~/.openclaw/workspace/{agentId}`
   - fallback: the value reported by `agents.list[id].workspace` in
     `~/.openclaw/openclaw.json`.
4. It performs a **union copy** from host → sandbox:
   - subdirectories: `skills/`, `memory/`, `ekg/`
     - `skills/` is fully mirrored each boot — the authoritative skills live
       in the host workspace.
     - `memory/` and `ekg/` are union-copied: existing files are NOT
       overwritten (the agent can mutate memory during its lifetime).
   - loose files: `config.json5`, `MEMORY.md`
     - union-copied (not overwritten if the sandbox already has a newer
       version written by the agent).
   - **`BOOTSTRAP.md` exception**: if the host copy is substantially larger
     (> 1500 bytes) than the sandbox copy, the host wins. This captures the
     "Sentura-specific custom BOOTSTRAP.md" that OpenClaw's default stub
     replaces.
5. All copies skip symlinks, hardlinks, `.git`, `.openclaw`, `node_modules`,
   and any file whose real path escapes the source directory — matching the
   security posture of OpenClaw's own `ensureSandboxWorkspace`.

## Configuration

Enabled automatically by `scripts/sentura-setup.sh`:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "sentura-sandbox-seed": { "enabled": true }
      }
    }
  }
}
```

The hook reads no environment variables and takes no parameters; it is a
pure filesystem reconciler driven by the `agent:bootstrap` context.

## Known limitations

- The hook only acts on agents whose id appears under
  `~/.openclaw/workspace/{id}` (i.e. Sentura meta-agents and any
  self-provisioned employees). An agent with a custom `workspace:` path
  outside `~/.openclaw/workspace/` is left alone; the bootstrap context
  already carries the right `sessionKey` + `workspaceDir` for those.
- The hook is synchronous-enough (<200 ms for typical workspaces) that it
  runs on the hot bootstrap path. A future optimization may move it to an
  async "prepare" phase.
