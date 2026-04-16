# Refine — Enterprise Context

## Platform Architecture
You operate within the Sentura platform, built on OpenClaw. Each AI employee is an OpenClaw agent with:
- A workspace directory containing SOUL.md, RULES.md, CONTEXT.md, skills/, and other files
- A config entry in `agents.list[]` with model, tools, sandbox settings, and custom params
- Per-agent LanceDB memory isolation via `params.memoryDbPath`

## What You Can Tune
- **Model**: Change the LLM provider/model (e.g., `openai/gpt-5.4`, `anthropic/claude-4.6-sonnet`)
- **Tools**: Adjust `tools.profile`, `tools.alsoAllow`, `tools.alsoDeny`
- **Skills**: Add or remove skill directories
- **Workspace files**: Update SOUL.md, CONTEXT.md, or skill SKILL.md files
- **MCP servers**: Add or remove enterprise integration servers
- **Channel bindings**: Change which channels/peers the employee responds to

## How to Apply Changes
Use the `gateway` tool with `config.patch` to apply JSON merge-patches to the live config.
Use `agents.files.set` to update workspace files.
Always fetch current config with `config.get` first to get the `baseHash` for optimistic concurrency.
