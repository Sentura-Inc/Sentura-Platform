#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfigFromEnv, type CrossBorderIntelConfig } from "./config.js";
import {
  defaultDnsResolver,
  listTools,
  type DnsResolver,
  type FetchLike,
} from "./tools.js";

export interface CreateServerOptions {
  config?: Partial<CrossBorderIntelConfig>;
  fetchFn?: FetchLike;
  dnsResolver?: DnsResolver;
  now?: () => Date;
}

export async function createServer(options: CreateServerOptions = {}) {
  const config: CrossBorderIntelConfig = { ...loadConfigFromEnv(), ...options.config };
  const ctx = {
    config,
    fetchFn: options.fetchFn ?? fetch,
    dnsResolver: options.dnsResolver ?? defaultDnsResolver,
    now: options.now ?? (() => new Date()),
  };

  const server = new McpServer({
    name: "sentura-cross-border-intel",
    version: "0.1.0",
  });

  for (const tool of listTools()) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputShape,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
        },
        _meta: {
          "sentura/endpoint": tool.endpoint,
          "sentura/sourceDoc": "跨境电商/DESIGN.md Milestone 3",
          "sentura/sourceTypeRequired": true,
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(ctx, args as never);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            isError: true,
            content: [{ type: "text" as const, text: message }],
          };
        }
      },
    );
  }

  return { server, config };
}

async function main() {
  const { server } = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[sentura-cross-border-intel] MCP server started on stdio");
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error("[sentura-cross-border-intel] fatal:", err);
    process.exit(1);
  });
}
