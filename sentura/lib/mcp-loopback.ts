/**
 * MCP loopback server configuration.
 *
 * Configures a loopback MCP server for tool protocol interop,
 * allowing agents to communicate with the OpenClaw gateway itself
 * as an MCP server (useful for testing and internal tool access).
 *
 * OpenClaw has a built-in MCP channel server at openclaw/src/mcp/channel-server.ts
 * that exposes gateway conversations as MCP tools. This module configures
 * it as an MCP server entry in the OpenClaw config.
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface McpLoopbackConfig {
  openclawDir: string;
  serverName?: string;
  env?: Record<string, string>;
}

/**
 * Build the MCP loopback server config entry.
 * Uses OpenClaw's built-in MCP channel server via stdio transport.
 */
export function buildLoopbackServerConfig(config: McpLoopbackConfig): Record<string, unknown> {
  const serverName = config.serverName ?? "openclaw-loopback";
  return {
    [serverName]: {
      command: "node",
      args: [
        path.join(config.openclawDir, "dist", "mcp", "channel-server.js"),
      ],
      env: {
        OPENCLAW_HOME: process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw"),
        ...config.env,
      },
    },
  };
}

/**
 * Build a config.patch string that adds the loopback MCP server.
 */
export function buildLoopbackPatch(config: McpLoopbackConfig): string {
  return JSON.stringify(
    {
      mcp: {
        servers: buildLoopbackServerConfig(config),
      },
    },
    null,
    2,
  );
}

/**
 * Add the loopback MCP server to the OpenClaw config file on disk.
 */
export async function addLoopbackServerOnDisk(
  config: McpLoopbackConfig,
  configPath?: string,
): Promise<void> {
  const cfgPath = configPath ?? path.join(
    process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw"),
    "openclaw.json",
  );

  const raw = await fs.readFile(cfgPath, "utf-8");
  const openclawConfig = JSON.parse(raw);

  if (!openclawConfig.mcp) openclawConfig.mcp = {};
  if (!openclawConfig.mcp.servers) openclawConfig.mcp.servers = {};

  const serverConfig = buildLoopbackServerConfig(config);
  Object.assign(openclawConfig.mcp.servers, serverConfig);

  await fs.writeFile(cfgPath, JSON.stringify(openclawConfig, null, 2) + "\n", "utf-8");
}

/**
 * Build MCP server configs for enterprise integrations.
 * Standard pattern: Node.js stdio server with environment variable refs.
 */
export function buildEnterpriseMcpServer(
  name: string,
  serverPath: string,
  envVars?: Record<string, string>,
): Record<string, unknown> {
  return {
    [name]: {
      command: "node",
      args: [serverPath],
      ...(envVars ? { env: envVars } : {}),
    },
  };
}

/**
 * Build MCP server config for an HTTP/SSE-based MCP server.
 */
export function buildRemoteMcpServer(
  name: string,
  url: string,
  options?: {
    transport?: "sse" | "streamable-http";
    headers?: Record<string, string>;
    connectionTimeoutMs?: number;
  },
): Record<string, unknown> {
  return {
    [name]: {
      url,
      transport: options?.transport ?? "sse",
      ...(options?.headers ? { headers: options.headers } : {}),
      ...(options?.connectionTimeoutMs
        ? { connectionTimeoutMs: options.connectionTimeoutMs }
        : {}),
    },
  };
}
