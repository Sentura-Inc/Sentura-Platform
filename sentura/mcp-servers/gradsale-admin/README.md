# @sentura/mcp-gradsale-admin

MCP server that exposes the **GradSale admin panel API** as tools for Sentura AI employees (e.g. Dispute Resolver, Support Agent, Trust & Safety reviewer).

It is generated from, and structurally mirrors, [`ekg/api-admin.md`](../../../ekg/api-admin.md). Every tool carries its HTTP endpoint in the tool description so auditors can trace any action back to the source docs.

## What it exposes

29 tools across 9 capability groups, each 1:1 with an endpoint from the admin API reference:

| Group | Tools | Read/Write |
| --- | --- | --- |
| Admin Auth | `gradsale_admin_login` | R |
| Disputes | `list_disputes`, `get_dispute`, `handle_dispute` | R, R, **W** |
| Verification Review | `list_pending_verifications`, `get_user`, `review_verification` | R, R, **W** |
| Ratings Oversight | `get_user_ratings`, `get_user_rating_stats`, `get_transaction_ratings` | R, R, R |
| Reports | `list_reports`, `get_report_stats`, `get_report`, `update_report`, `delete_report` | R, R, R, **W**, **W** |
| Support | `list_support_threads`, `get_support_thread`, `update_support_thread_status`, `send_support_reply`, `support_system_user_exists`, `create_support_system_user` | R, R, **W**, **W**, R, **W** |
| Waitlist | `list_waitlist_entries`, `get_waitlist_stats`, `export_waitlist`, `delete_waitlist_entry` | R, R, R, **W** |
| Email Verification | `list_pending_email_verifications` | R |
| Transactions | `list_transactions`, `get_transaction`, `trigger_auto_complete` | R, R, **W** |

Every mutating tool carries `annotations.destructiveHint = true` so the Sentura approval extension can route it through HITL automatically.

## Configuration

All config is environment-variable driven (the MCP server process is spawned by OpenClaw with `env:` entries from the agent config):

| Env var | Required | Purpose |
| --- | --- | --- |
| `GRADSALE_API_URL` | no (defaults to `http://localhost:3001`) | Base URL of the GradSale NestJS backend |
| `GRADSALE_ADMIN_TOKEN` | one of token / email+password | Pre-issued admin JWT — fastest path |
| `GRADSALE_ADMIN_EMAIL` | one of token / email+password | Email used to log in and fetch a token on first call |
| `GRADSALE_ADMIN_PASSWORD` | one of token / email+password | Password paired with the email |
| `GRADSALE_REQUEST_TIMEOUT_MS` | no (default `30000`) | Per-request timeout in ms |
| `GRADSALE_READ_ONLY` | no (`true` / `1` to enable) | Strip all mutating tools — used for auditor / analyst personas |

Credentials should come from Sentura's file-backed secret provider as `$secret:/sentura/agents/<agentId>/gradsale/<credential>` pointers — never inline them in agent config.

## Wiring into an AI employee

For Week 3 self-provisioning, register this server with `sentura_agents_manage { action: "upsert_mcp_servers", ... }` (or the matching gateway RPC `sentura.agents.upsertMcpServers`). That writes to the target employee's `~/.openclaw/workspace/<agentId>/config.json5 -> mcpServers`, keeps secrets as pointers, and wraps stdio servers with Sentura's launcher at write time. Shared/operator-managed MCPs can still live in global `openclaw.json -> mcp.servers`, but employee-local provisioning should default to the per-agent path.

```json5
{
  action: "upsert_mcp_servers",
  agentId: "gradsale-dispute-resolver",
  mcpServers: {
    "gradsale-admin": {
      command: "node",
      args: ["./sentura/mcp-servers/gradsale-admin/dist/index.js"],
      env: {
        GRADSALE_API_URL: "https://admin.gradsale.example",
        GRADSALE_ADMIN_TOKEN: "$secret:/sentura/agents/gradsale-dispute-resolver/gradsale/admin_token",
        GRADSALE_READ_ONLY: "false",
      },
    },
  },
}
```

Use `command: "node"` with a direct path to the compiled entry (`dist/index.js`) rather than `pnpm --filter ... start`. Sentura's per-agent MCP helper preserves that command/args pair, stores the `$secret:` pointer string in `config.json5`, and resolves the plaintext secret only when `scripts/sentura-mcp-launcher.mjs` spawns the child process.

This round supports `$secret:` pointers only for stdio MCP server `env` values. Remote HTTP/SSE servers with secret-bearing `headers` remain operator-managed.

For auditor or analyst employees, set `GRADSALE_READ_ONLY: "true"` — write tools disappear from the catalog entirely, so the agent cannot even try to call them.

## Development

```bash
pnpm install                                  # once, at repo root
pnpm --filter @sentura/mcp-gradsale-admin test   # unit + integration tests
pnpm --filter @sentura/mcp-gradsale-admin build  # compile to dist/
pnpm --filter @sentura/mcp-gradsale-admin start  # run over stdio (for manual testing)
```

Tests use `InMemoryTransport` from the MCP SDK plus a stubbed `fetch`, so they are hermetic — the real GradSale backend does not need to be running.

## Pattern

This package is the reference implementation of the **API-docs → MCP-server → employee wiring** pattern — see [`docs/DESIGN.md` › Enterprise MCP Server Pattern](../../../docs/DESIGN.md#enterprise-mcp-server-pattern) for the shared/global and per-agent registration paths.
