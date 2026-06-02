# sentura/mcp-servers/postgres

**Tier 1 — Open-Source MCP Server.** This directory is *configuration*, not source — there is nothing to build. The actual server is the upstream npm package [`@modelcontextprotocol/server-postgres`](https://www.npmjs.com/package/@modelcontextprotocol/server-postgres), which OpenClaw spawns as a child process via the snippet in [`config-snippet.json5`](./config-snippet.json5).

## Why this server

Several Sentura roles need authenticated PostgreSQL access:

- **Finance Analyst** — ad-hoc queries against the data warehouse for executive summaries.
- **Customer Support** — pull a customer's account history, last invoice, ticket count, churn risk score.
- **Compliance / Auditor** — query the audit trail for a date-range investigation.
- **Knowledge Curator** — read schema metadata so the agent's EKG describes the data model accurately.

Granting that access through a dedicated read-only role + the upstream MCP server is safer than handing out raw `psql` shell access — the upstream package exposes typed `query` and `schema` tools so the agent cannot escape into shell or DDL.

## What it exposes

The upstream package owns this list — verify it against the version pinned in `config-snippet.json5` before relying on any specific tool name:

| Tool | Purpose | Read/Write |
| --- | --- | --- |
| `query` | Run a SELECT statement and return rows as JSON | **R only** |
| `list_tables` | List tables in a schema | R |
| `describe_table` | Return column types, constraints, indexes | R |

The package is intentionally **read-only**. There is no `insert`, no `update`, no `delete`. For write operations, build a dedicated **Tier 2** MCP server (see `gradsale-admin/`) that exposes only the specific business operation the agent should be allowed to perform.

## Wiring it into an AI employee

1. **Mint a dedicated database role.** Don't reuse the application's primary credential. Grant `CONNECT`, `USAGE` on schema, `SELECT` on the specific tables — nothing else.
2. **Stash the connection URL in OpenClaw's secret store.** Add `SENTURA_PG_READONLY_URL=postgres://...` to `~/.openclaw/.env` (read by the gateway dotenv loader at startup) or use a configured `secrets.providers.<name>.command`. Reference the secret as `$secret:SENTURA_PG_READONLY_URL` in the snippet.
3. **Apply [`config-snippet.json5`](./config-snippet.json5)** by calling the gateway's `config.patch` RPC.
4. **Allow the tools through the sandbox filter.** Add `query`, `list_tables`, `describe_table` to the agent's `tools.sandbox.tools.alsoAllow` block (see `docs/OPENCLAW.md § Sandbox tool-policy filter (dashboard vs CLI divergence)` — Round 20 fix). Without this, the dashboard chat path will silently strip them.
5. **Cap rows.** Set `MCP_PG_MAX_ROWS` so a runaway analytics query cannot drag latency for the rest of the system.

## Security checklist

- [ ] Database role is **read-only** (`SELECT` only, no `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/`COPY`).
- [ ] Role can only see the specific schemas / tables the employee should touch (no `pg_catalog` access if avoidable).
- [ ] No use of `pg_read_server_files`, `pg_write_server_files`, `lo_*` (large object) functions — all should be `REVOKE`d from the role.
- [ ] Connection URL is stored in OpenClaw's secret store, never in the snippet itself.
- [ ] Network: the gateway can reach Postgres only through a dedicated VPC peering / SSH tunnel — no public exposure.
- [ ] Audit: every `query` is logged via the `sentura-audit` `tool_call` hook with arguments digest.
- [ ] If the employee sandbox is `non-main`, `query` / `list_tables` / `describe_table` are listed in `tools.sandbox.tools.alsoAllow`.

## When this is the WRONG tool

- If the agent needs to **write** any data, use a Tier 2 MCP server with narrow business tools — never widen this server to read+write.
- If the agent needs to call **stored procedures** that touch sensitive data, wrap each call in a Tier 2 server so HITL approval can be threaded through `sentura-approval`.
- If the data is **PII**: prefer a column-masked view in Postgres rather than relying on the agent to redact in-prompt.

## Pattern

This is the third Tier-1 reference snippet (alongside `filesystem/`, `slack/`, `github/`). For Tier 2 (in-tree-generated from `ekg/` API docs) see `gradsale-admin/`, `gradsale-web/`, and `gradsale-search/`. For Tier 3 (self-provisioned via `sentura-provisioner`) see `sentura/extensions/sentura-provisioner/`. The three-tier strategy is documented in `docs/DESIGN.md › Three-tier MCP strategy`.
