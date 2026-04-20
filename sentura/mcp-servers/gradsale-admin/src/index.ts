#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  GradSaleAdminClient,
  GradSaleAdminError,
  type FetchLike,
} from "./client.js";
import { loadConfigFromEnv, type GradSaleAdminConfig } from "./config.js";
import { listTools } from "./tools.js";

export interface CreateServerOptions {
  /** Override the config loaded from env. Useful for tests. */
  config?: Partial<GradSaleAdminConfig>;
  /** Override the fetch function used by the HTTP client. Useful for tests. */
  fetchFn?: FetchLike;
}

export async function createServer(options: CreateServerOptions = {}) {
  const config: GradSaleAdminConfig = { ...loadConfigFromEnv(), ...options.config };
  const client = new GradSaleAdminClient({ config, fetchFn: options.fetchFn });

  const server = new McpServer({
    name: "sentura-gradsale-admin",
    version: "0.1.0",
  });

  for (const tool of listTools({ readOnly: config.readOnly })) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputShape,
        annotations: {
          // MCP annotations used by the client (Sentura agent) to decide whether
          // to require human approval. `destructiveHint` maps naturally onto our
          // `mutates` flag, and `readOnlyHint` is the inverse.
          readOnlyHint: !tool.mutates,
          destructiveHint: tool.mutates,
        },
        _meta: {
          "sentura/endpoint": tool.endpoint,
          "sentura/sourceDoc": "ekg/api-admin.md",
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(
            client,
            args as Parameters<typeof tool.handler>[1],
          );
          return {
            content: [
              {
                type: "text" as const,
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const message =
            err instanceof GradSaleAdminError
              ? `GradSale API ${err.status}: ${err.message}\n${JSON.stringify(err.body, null, 2)}`
              : err instanceof Error
                ? err.message
                : String(err);
          return {
            isError: true,
            content: [{ type: "text" as const, text: message }],
          };
        }
      },
    );
  }

  return { server, client, config };
}

async function main() {
  const { server } = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[sentura-gradsale-admin] MCP server started on stdio");
}

// Only run main() if this file is the entry point (invoked as `node dist/index.js`)
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error("[sentura-gradsale-admin] fatal:", err);
    process.exit(1);
  });
}
