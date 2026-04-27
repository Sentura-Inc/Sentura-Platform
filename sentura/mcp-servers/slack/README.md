# sentura/mcp-servers/slack

**Tier 1 — Open-Source MCP Server.** This directory is *configuration*, not source. The actual server is the upstream npm package [`@modelcontextprotocol/server-slack`](https://www.npmjs.com/package/@modelcontextprotocol/server-slack), spawned by OpenClaw via [`config-snippet.json5`](./config-snippet.json5).

## Why this server

Slack is the dominant internal chat surface for most enterprise customers, and several Sentura employee templates need to read or post in it:

- **Communication Panel** (capability #16) routes group chat fan-out through Slack channels in deployments that don't use the dashboard's first-party chat view.
- **CS Agent / Dispute Resolver** templates pick up customer escalations posted into shared support channels.
- **Provisioner workflows** (capability #3) post status updates to a configured channel when a new tool is requested or a credential rotates.

## What it exposes (tool inventory at the time of writing)

The upstream package owns this list — verify it against the version pinned in `config-snippet.json5` before relying on any specific tool name in an SOP.

| Tool | Purpose | Read/Write |
| --- | --- | --- |
| `slack_list_channels` | List channels the bot has been invited to | R |
| `slack_post_message` | Post a new message to a channel | **W** |
| `slack_reply_to_thread` | Reply to a specific thread | **W** |
| `slack_add_reaction` | Add an emoji reaction | **W** |
| `slack_get_channel_history` | Read recent messages | R |
| `slack_get_thread_replies` | Read a thread's replies | R |
| `slack_get_users` | List workspace users | R |
| `slack_get_user_profile` | Get one user's profile | R |

## Wiring it into an AI employee

1. **Create a dedicated Slack app** (one per logical tenant — do not reuse a personal app token across customers). Grant only the OAuth scopes listed at the top of [`config-snippet.json5`](./config-snippet.json5).
2. **Store the bot token in the secret store**:
   ```bash
   openclaw secret set slack.bot_token 'xoxb-...'
   openclaw secret set slack.team_id   'T01234ABC'
   ```
   These keys are referenced as `$secret:slack.bot_token` / `$secret:slack.team_id` from the config snippet — OpenClaw's secret resolver substitutes the live values at agent-spawn time.
3. **Apply `config-snippet.json5`** through the gateway `config.patch` RPC. Never paste the snippet into `~/.openclaw/openclaw.json` while the gateway is running.
4. **Invite the bot user to each channel** the agent needs to read or post in. Slack enforces this at the API layer; without an invite, even valid scopes return `not_in_channel`.

## Security checklist

- [ ] Bot token is referenced via `$secret:` only — no token text appears in any committed file, audit log redactions cover `xoxb-` / `xoxp-` / `xapp-` prefixes.
- [ ] If the agent only needs to read (e.g. an analytics employee), grant only the `*:read` / `*:history` scopes and omit `chat:write` / `reactions:write` from the Slack app.
- [ ] Every `slack_post_message` and `slack_reply_to_thread` call from a customer-facing employee is routed through `sentura-approval` until the operator has signed off on the message-posting policy. Default-deny is the safer starting point.
- [ ] If the employee sandbox is `non-main`, the Slack tool names are also listed in `tools.sandbox.tools.alsoAllow` of the agent config — otherwise the dashboard chat path will silently strip them.

## Pattern

This is the reference for the **upstream-MCP → `config.patch`** Tier-1 path. See `docs/DESIGN.md › Three-tier MCP strategy` for when to pick Tier 1 vs Tier 2 (in-tree-generated, e.g. `gradsale-admin/`) vs Tier 3 (self-provisioned via `sentura-provisioner`).
