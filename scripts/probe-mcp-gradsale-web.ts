/**
 * Probe: spawn the gradsale-web MCP server as a child process exactly the
 * way OpenClaw will, then drive it from the official MCP SDK Client over
 * stdio. Proves the compiled `dist/index.js` actually boots and lists 32
 * tools.
 *
 * No GradSale backend is required — this script never calls a tool, it
 * just reads the catalog. If you want to call tools end-to-end against
 * a stubbed fetch, the existing `src/server.test.ts` rig already does
 * that hermetically.
 *
 * Run from repo root:
 *   pnpm --filter @sentura/mcp-gradsale-web build   # one-time per code change
 *   npx tsx scripts/probe-mcp-gradsale-web.ts
 */

import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER_ENTRY = path.resolve(
  "sentura/mcp-servers/gradsale-web/dist/index.js",
);

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_ENTRY],
    // Provide enough config for the server to boot. We never actually call
    // a tool, so a fake token is fine — auto-login is only triggered on
    // the FIRST authenticated request, which we don't make.
    env: {
      ...process.env,
      GRADSALE_API_URL: "http://localhost:3001",
      GRADSALE_USER_TOKEN: "probe-token-not-real",
    },
  });

  const client = new Client(
    { name: "sentura-gradsale-web-probe", version: "0.0.0-probe" },
    { capabilities: {} },
  );
  await client.connect(transport);
  console.log("✓ connected to MCP server over stdio");

  const { tools } = await client.listTools();
  console.log(`✓ catalog: ${tools.length} tools`);

  const expectedCount = 32;
  if (tools.length !== expectedCount) {
    console.error(`✗ expected ${expectedCount} tools, got ${tools.length}`);
    process.exit(1);
  }

  // Spot-check the persona-critical tools
  const expected = [
    "gradsale_web_register",
    "gradsale_web_login",
    "gradsale_web_get_me",
    "gradsale_web_list_listings",
    "gradsale_web_search_listings",
    "gradsale_web_create_listing",
    "gradsale_web_set_listing_status",
    "gradsale_web_create_thread",
    "gradsale_web_send_message",
    "gradsale_web_complete_checkout",
  ];
  for (const name of expected) {
    if (!tools.some((t) => t.name === name)) {
      console.error(`✗ missing expected tool: ${name}`);
      process.exit(1);
    }
  }
  console.log("✓ all 10 persona-critical tools present");

  // Verify annotation hints are correct (read vs destructive)
  const listListings = tools.find((t) => t.name === "gradsale_web_list_listings");
  const sendMessage = tools.find((t) => t.name === "gradsale_web_send_message");
  if (!listListings?.annotations?.readOnlyHint) {
    console.error("✗ list_listings should have readOnlyHint=true");
    process.exit(1);
  }
  if (!sendMessage?.annotations?.destructiveHint) {
    console.error("✗ send_message should have destructiveHint=true");
    process.exit(1);
  }
  console.log("✓ MCP annotations correctly reflect mutates flag");

  // Verify the source-doc backlink lands in tool _meta
  const sample = tools[0];
  const meta = sample._meta as Record<string, unknown> | undefined;
  if (meta?.["sentura/sourceDoc"] !== "ekg/api-web.md") {
    console.error(
      `✗ first tool _meta.sentura/sourceDoc should be 'ekg/api-web.md', got: ${meta?.["sentura/sourceDoc"]}`,
    );
    process.exit(1);
  }
  console.log("✓ tool _meta carries source-doc backlink");

  await client.close();
  console.log("\n4 pass / 0 fail");
  process.exit(0);
}

main().catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});
