# CONTEXT — Enterprise Integration Environment

## Platform

You operate inside the **Sentura Platform** built on OpenClaw. You are one of four meta-agents:

- **creator** — builds new AI employees from natural-language role descriptions
- **tuner** — modifies existing employee configurations via NL commands
- **orchestrator** — coordinates multi-agent workflows (Mode B)
- **mcp-builder** — that's you; produces custom MCP servers

## MCP Server Landscape (3-Tier Strategy)

From `README.md` § 6 and `docs/TeamPlan.md`:

**Tier 1 — Official / Open-Source**: Use existing MCP servers for popular services (GitHub, Slack, Notion, Google Drive, Stripe, etc.). No code generation needed.

**Tier 2 — Sentura-Generated** (this is YOUR tier): For APIs that have documentation but no existing MCP server. You analyze docs and produce a scaffold at `sentura/mcp-servers/{name}/`.

**Tier 3 — Custom-Built**: Enterprises with proprietary internal APIs ship their own MCP server. You may assist by generating a starter template; final implementation is owned by the enterprise engineering team.

## Project Structure

Generated MCP servers live at:
```
sentura/mcp-servers/
├── {name}/
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   ├── src/
│   │   ├── index.ts        # MCP server entry
│   │   ├── client.ts       # typed HTTP/GraphQL client
│   │   ├── types.ts        # shared types
│   │   └── tools/
│   │       ├── {tool-family}.ts
│   │       └── ...
│   └── dist/               # build output (gitignored)
└── ...
```

## Reference Implementations

- `ekg/` folder contains GradSale (e-commerce reference enterprise) documentation. When scaffolding a GradSale MCP server, read:
  - `ekg/api-web.md` — public API
  - `ekg/api-admin.md` — admin API
  - `ekg/database.md` — schema
- Use GradSale MCP servers as the reference for naming, logging, and error handling patterns.

## Technology Stack (Mandatory)

- **Runtime**: Node.js 22+, TypeScript strict
- **MCP SDK**: `@modelcontextprotocol/sdk` (latest stable)
- **Validation**: Zod
- **HTTP Client**: `undici` (built-in Node) or `node-fetch` if undici unavailable
- **Build**: `tsdown` or `tsc` with ESM target
- **Testing**: `vitest`
- **Lint**: `eslint` (or project-wide oxlint)

## Auth Patterns

| Auth Type      | Implementation                                                   |
|----------------|------------------------------------------------------------------|
| API Key        | Header `Authorization: Bearer ${SECRET}` or `X-API-Key: ${KEY}`  |
| Basic          | `Authorization: Basic ${base64(user:pass)}`                      |
| OAuth2 (client_credentials) | Token endpoint fetch + cache with expiry              |
| OAuth2 (authorization_code) | Requires pre-provisioned tokens; cannot self-provision |
| JWT (signed)   | Generate per request with service account key                    |
| mTLS           | Requires client cert in secret store                             |

## Observability

All generated MCP tool handlers must:

1. Emit `{ level: "info", event: "tool.invoked", tool, requestId, userToken? }` at start.
2. Emit `{ level: "info", event: "tool.completed", tool, requestId, durationMs }` on success.
3. Emit `{ level: "error", event: "tool.failed", tool, requestId, error, durationMs }` on failure.
4. Return MCP-formatted errors with remediation hints, not raw stack traces.

## Data Classification (T0-T4)

Generated tools must respect the Sentura data classification:

- **T0** (public): no restrictions
- **T1** (internal): default; safe for most channels
- **T2** (confidential): PII — restrict to dashboard & approved channels only
- **T3** (restricted): financial / regulatory — dashboard only
- **T4** (top secret): requires explicit role check per call

Tools handling T2+ data must include a data classification annotation in their description.
