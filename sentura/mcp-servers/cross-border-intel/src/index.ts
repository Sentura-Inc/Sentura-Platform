#!/usr/bin/env node
import { setDefaultAutoSelectFamily } from "node:net";
import { setDefaultResultOrder } from "node:dns";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfigFromEnv, type CrossBorderIntelConfig } from "./config.js";

// IPv4 pin (runs at process start, before any fetch). WHY: on an IPv4-only host (e.g. the
// mainland ECS) Node's global fetch (undici) uses Happy-Eyeballs `autoSelectFamily`, which
// races an IPv6 attempt to dual-stack hosts. For SEC's Akamai edge (`www.sec.gov`) the IPv6
// leg dies at the ~250ms attempt-timeout and surfaces as a fast ETIMEDOUT ("fetch failed")
// instead of falling back to IPv4 — making `cbe_intel_sec_lookup` fail 100% (the CIK-resolution
// step fetches `https://www.sec.gov/files/company_tickers.json`). Disabling Happy-Eyeballs +
// preferring IPv4 makes the connect IPv4-first sequential, which fixes SEC and is harmless on
// dual-stack hosts (IPv4-preferred is the internet norm). Opt out with CBE_INTEL_FORCE_IPV4=false.
if (process.env.CBE_INTEL_FORCE_IPV4 !== "false") {
  setDefaultAutoSelectFamily(false);
  setDefaultResultOrder("ipv4first");
}
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
