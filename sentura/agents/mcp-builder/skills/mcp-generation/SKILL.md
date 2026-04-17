# MCP Server Generation

## When to Use

After Phase B (API Analysis) is complete and the user has approved the API Brief. This skill generates the actual TypeScript MCP server scaffold.

## Procedure

### Step 1: Create Project Structure

```
sentura/mcp-servers/{name}/
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
├── api-brief.md                (from api-analysis skill)
├── src/
│   ├── index.ts
│   ├── client.ts
│   ├── types.ts
│   └── tools/
│       └── {family}.ts
└── tests/
    └── smoke.test.ts
```

Use `fs_write` to create each file.

### Step 2: Scaffold `package.json`

```json
{
  "name": "@sentura/mcp-{name}",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "tsc -p tsconfig.json --watch",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "latest",
    "undici": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "vitest": "latest",
    "@types/node": "latest"
  }
}
```

Resolve "latest" to actual pinned versions by checking npm via `web_fetch` on `https://registry.npmjs.org/{pkg}`.

### Step 3: Scaffold `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 4: Scaffold `src/client.ts`

Build a typed HTTP/GraphQL client:
- Read credentials from env vars (never hardcoded).
- Include request ID generation for observability.
- Retry-with-backoff for 5xx and 429 (respect Retry-After).
- Expose `request<TReq, TRes>(params): Promise<TRes>` as the core method.
- Strong typing throughout — no `any`.

### Step 5: Scaffold `src/tools/{family}.ts`

For each selected tool in the API Brief:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { apiClient } from "../client.js";

const inputSchema = z.object({
  // ...from the endpoint spec
});

const outputSchema = z.object({
  // ...
});

export function register{ToolName}(server: McpServer) {
  server.tool(
    "{tool-name}",
    "Description. Data Class: T{n}. Idempotent: yes/no.",
    inputSchema.shape,
    async (input) => {
      const requestId = crypto.randomUUID();
      console.log(JSON.stringify({ level: "info", event: "tool.invoked", tool: "{tool-name}", requestId }));
      const start = Date.now();
      try {
        const result = await apiClient.request({ /* ... */ });
        const parsed = outputSchema.parse(result);
        console.log(JSON.stringify({ level: "info", event: "tool.completed", tool: "{tool-name}", requestId, durationMs: Date.now() - start }));
        return { content: [{ type: "text", text: JSON.stringify(parsed) }] };
      } catch (err) {
        console.log(JSON.stringify({ level: "error", event: "tool.failed", tool: "{tool-name}", requestId, error: String(err), durationMs: Date.now() - start }));
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );
}
```

### Step 6: Wire `src/index.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register{Family1} } from "./tools/{family1}.js";
// ...

async function main() {
  const server = new McpServer({
    name: "{name}",
    version: "0.1.0",
  });

  register{Family1}(server);
  // ...

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(JSON.stringify({ level: "fatal", event: "server.startup_failed", error: String(err) }));
  process.exit(1);
});
```

### Step 7: Write `README.md`

Include:
- Purpose and target API (with doc URL)
- Required secrets (`$secret.{NAME}` references)
- Installation: `pnpm install && pnpm build`
- OpenClaw registration snippet (for `mcp.servers`)
- Tool list (from api-brief.md)
- "Verified Tools" section (populated by smoke-test skill)
- Known limitations

### Step 8: Install & Build

```bash
cd sentura/mcp-servers/{name}
pnpm install
pnpm build
```

If build fails: read TypeScript errors, patch the offending files, retry. Cap at 5 attempts. If still failing, escalate with a summary of blockers.

## Tools Needed

- `fs_write` — create all scaffold files
- `fs_read` — load api-brief.md
- `exec` / shell — run pnpm install/build
- `web_fetch` — resolve npm package versions

## Safety

- NEVER put secret values in source code; use env var references only
- NEVER leave `any` types — fail the build instead
- NEVER mark complete if `pnpm build` fails
- ALWAYS write a README with secret setup instructions before marking complete
- ALWAYS include structured logging in every tool handler
- ALWAYS use the exact tool name pattern `{api}.{family}.{action}` for discoverability
