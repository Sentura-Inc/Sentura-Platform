# MCP Builder — Tool Notes

## Tool Access

Your profile is `coding` with extra allowlist for `gateway`, `web_search`, `web_fetch`, `browser`, `pdf`, `sessions_send`, `sessions_spawn`.

## Key Tools

### `fs_write` / `fs_read`
- Writes happen exclusively under `sentura/mcp-servers/{name}/`.
- Never write outside of this directory except for adding the MCP server to OpenClaw config via `gateway`.

### `web_fetch` — primary tool for API docs
- Use for fetching OpenAPI/Swagger specs, documentation pages.
- If the doc is JavaScript-heavy (SPA), fall back to `browser`.

### `browser` — for JS-rendered API docs
- Use Playwright via this tool. Never hardcode credentials; prompt the user if auth needed.
- Respect `robots.txt` and rate limits.

### `pdf` — for PDF API specifications
- Extract text from uploaded PDFs with this tool.
- Large PDFs (>50MB): extract section-by-section to stay within context.

### `gateway` — for OpenClaw integration
- Use `config.patch` to add entries at OpenClaw's native path `mcp.servers.{name}`. This is the exact path OpenClaw's MCP loader reads (`openclaw/src/agents/embedded-pi-mcp.ts` → `normalizeConfiguredMcpServers(cfg.mcp?.servers)`). Any other nesting (including the legacy `mcp.servers.entries.{name}`) is silently ignored at runtime — the server never spawns and the agent has no tools.
- NEVER write to `agents.*` from this agent — that is the Creator Agent's job.

### `pnpm` / `npm` (via `exec` in coding profile)
- `pnpm install`, `pnpm build`, `pnpm test`, `pnpm lint`.
- Cap build retries at 5 before escalating.

## Environment

- Working directory for builds: `sentura/mcp-servers/{name}/`.
- TypeScript strict mode, ES2023 target.
- Required dependencies: `@modelcontextprotocol/sdk`, `zod`, `undici` (HTTP), `dotenv` (dev-only).

## Secret Store References

All credentials use OpenClaw's `$secret.{NAME}` syntax in config, NEVER in source code.

Example generated config entry (uses OpenClaw's native `mcp.servers.<name>` path):

```json5
{
  mcp: {
    servers: {
      "example-api": {
        transport: "stdio",
        command: "node",
        args: ["sentura/mcp-servers/example-api/dist/index.js"],
        env: {
          EXAMPLE_API_KEY: "$secret.EXAMPLE_API_KEY",
          EXAMPLE_API_BASE_URL: "https://api.example.com",
        },
      },
    },
  },
}
```
