# NL-to-Config Tuning

## When to Use

When an operator sends a natural-language instruction to modify an AI employee's configuration. Examples:

- "Make the AP Clerk more concise"
- "Upgrade the CS Agent to GPT-5.4"
- "Add the Salesforce MCP server to the Sales Rep"
- "Remove Slack from the Support Agent's channels"

Do NOT use this skill for workspace file edits (SOUL.md, AGENTS.md, skill content) — use the `workspace-edit` skill for those.

## Procedure

### Step 1: Identify the Target Employee

1. Parse the operator's message for an agent name or ID.
2. If ambiguous, call `gateway.call("config.get", {})` and list available agents with names and roles. Ask the operator to confirm.
3. Record the target `agentId`.

### Step 2: Fetch Current Config

```
gateway.call("config.get", {})
```

`config.get` returns a `ConfigFileSnapshot`:
```
{
  hash: "<sha256>",                       // <-- pass as baseHash to config.patch
  runtimeConfig: { agents: { list: [...] }, ... },
  config: { ... },                        // deprecated alias of runtimeConfig
  parsed, resolved, raw, valid, ...
}
```

Extract the agent's current entry from `runtimeConfig.agents.list[]` (NOT
`agents.list` at the top level — the bare config is wrapped). Record:
- The top-level `hash` field — pass it as `baseHash` to `config.patch` for optimistic concurrency.
- Current values of every field the tuning request might touch.

### Step 3: Parse the Tuning Intent

Map the natural-language request to config fields:

| Natural language | Config field | Notes |
|-----------------|-------------|-------|
| Change model | `model` | Must be a valid provider/model string |
| Add/remove tool | `tools.alsoAllow` / `tools.deny` | Never add `gateway` to non-meta-agents. There is no `tools.alsoDeny` — to block a tool use `tools.deny`. Plugin tools also need a matching `tools.sandbox.tools.alsoAllow` entry to survive the sandbox filter (see Round 20). |
| Change channel binding | `bindings[]` | Use existing binding helpers |
| Add MCP server | `mcp.servers.<name>` | Verify credentials exist first |
| Remove MCP server | Delete `mcp.servers.<name>` | Confirm with operator before removing |
| Change parameter | `params.<key>` | e.g. tone, escalateTo, allowedActions |
| Change skill set | `skills` filter | Add or remove skill directory names |

If the request is ambiguous, ask a clarifying question before producing the diff.

### Step 4: Produce a Diff

Show the operator a before/after diff:

```
Proposed change to: <agent name> (<agentId>)

BEFORE:
  model: "openai/gpt-4o"

AFTER:
  model: "openai/gpt-5.4"

Other fields unchanged.

Apply this change? (yes / no / modify)
```

For multi-field changes, list each field separately.

### Step 5: Wait for Explicit Approval

**STOP.** Do not apply any change until the operator sends explicit approval in the current turn. A prior approval from an earlier turn does not count.

If the operator says "modify", incorporate feedback and re-show the diff from Step 4.

### Step 6: Apply the Config Patch

```
gateway.call("config.patch", {
  baseHash: "<baseHash from Step 2>",
  patch: {
    agents: {
      list: [
        {
          id: "<agentId>",
          // only the changed fields
        }
      ]
    }
  }
})
```

Use a minimal patch — only include fields that changed.

### Step 7: Verify

1. Re-fetch config: `gateway.call("config.get", {})`
2. Confirm each patched field has the expected value.
3. Report to the operator:
   - Success: "Change applied. [agent name] now uses [new value]."
   - Failure: "The patch was rejected: [error]. Current value is still [old value]."

## Tools Needed

- `gateway` — `config.get`, `config.patch`
- `message` — operator interaction (diffs, confirmations, results)

## Safety

- **NEVER** apply a config change without explicit operator approval in the current turn.
- **NEVER** add the `gateway` tool to a non-meta-agent.
- **NEVER** change `sandbox.mode` from `"non-main"` to `"main"` for any employee.
- **NEVER** remove `tools.deny` entries that block dangerous actions.
- **ALWAYS** show the full diff before applying, no matter how small the change.
- **ALWAYS** include `baseHash` in `config.patch` to prevent overwriting concurrent changes.
- On hash-mismatch error: re-fetch config, re-derive the diff, re-show it to the operator before re-applying.
