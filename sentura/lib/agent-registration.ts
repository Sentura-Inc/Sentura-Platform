/**
 * Agent registration via OpenClaw config.patch.
 *
 * Provides helpers to register new AI employees in the OpenClaw config
 * by constructing the correct JSON5 merge-patch for agents.list.
 * Works both programmatically (Node.js scripts) and as a pattern for
 * meta-agents using the gateway tool.
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface AgentToolsConfig {
  profile?: "minimal" | "coding" | "full";
  alsoAllow?: string[];
  deny?: string[];
}

export interface AgentSandboxConfig {
  mode: "main" | "non-main";
}

export interface AgentRegistrationOptions {
  id: string;
  name?: string;
  model?: string;
  tools?: AgentToolsConfig;
  sandbox?: AgentSandboxConfig;
  runtime?: { type: "embedded" } | { type: "acp"; acp?: Record<string, unknown> };
  skills?: string[];
  thinkingDefault?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive";
}

export interface BindingConfig {
  agentId: string;
  channel: string;
  accountId?: string;
  peer?: { kind: "dm" | "channel" | "group" | "thread"; id: string };
  guildId?: string;
  teamId?: string;
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  transport?: "sse" | "streamable-http";
  headers?: Record<string, string>;
}

export interface FullAgentRegistration {
  agent: AgentRegistrationOptions;
  bindings?: BindingConfig[];
  mcpServers?: Record<string, McpServerConfig>;
  memoryLanceDbPath?: string;
}

/**
 * Build a JSON5 merge-patch string for config.patch that adds a new agent.
 * The patch merges into agents.list by id (OpenClaw's mergeObjectArraysById).
 */
export function buildAgentPatch(registration: FullAgentRegistration): string {
  const { agent, bindings, mcpServers, memoryLanceDbPath } = registration;

  const agentEntry: Record<string, unknown> = { id: agent.id };

  if (agent.name) agentEntry.name = agent.name;
  if (agent.model) agentEntry.model = agent.model;
  if (agent.tools) agentEntry.tools = agent.tools;
  if (agent.sandbox) agentEntry.sandbox = agent.sandbox;
  if (agent.runtime) agentEntry.runtime = agent.runtime;
  if (agent.skills) agentEntry.skills = agent.skills;
  if (agent.thinkingDefault) agentEntry.thinkingDefault = agent.thinkingDefault;

  const patch: Record<string, unknown> = {
    agents: {
      list: [agentEntry],
    },
  };

  if (bindings && bindings.length > 0) {
    patch.bindings = bindings.map((b) => ({
      agentId: b.agentId,
      match: {
        channel: b.channel,
        ...(b.accountId ? { accountId: b.accountId } : {}),
        ...(b.peer ? { peer: b.peer } : {}),
        ...(b.guildId ? { guildId: b.guildId } : {}),
        ...(b.teamId ? { teamId: b.teamId } : {}),
      },
    }));
  }

  if (mcpServers && Object.keys(mcpServers).length > 0) {
    patch.mcp = { servers: mcpServers };
  }

  if (memoryLanceDbPath) {
    // OpenClaw plugin config lives under `plugins.entries[<id>].config`.
    // NOTE: memory-lancedb exposes a single global `dbPath` — true per-agent
    // isolation would require collection-level filtering by agentId, not
    // separate dbPaths. We still stamp the per-agent path here so the
    // Creator Agent's last-deployed employee owns the current path; see
    // docs/MEMORY.md for the tracked follow-up.
    patch.plugins = {
      entries: {
        "memory-lancedb": {
          config: {
            dbPath: memoryLanceDbPath,
          },
        },
      },
    };
  }

  return JSON.stringify(patch, null, 2);
}

/**
 * Build the per-agent LanceDB memory isolation path.
 */
export function buildMemoryDbPath(agentId: string): string {
  return `~/.openclaw/memory/${agentId}/lancedb`;
}

/**
 * Register an agent by directly patching the OpenClaw config file on disk.
 * Used by setup scripts and CLI tools (not at runtime — use config.patch RPC at runtime).
 */
export async function registerAgentOnDisk(
  registration: FullAgentRegistration,
  configPath?: string,
): Promise<void> {
  const cfgPath = configPath ?? path.join(
    process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw"),
    "openclaw.json",
  );

  const raw = await fs.readFile(cfgPath, "utf-8");
  const config = JSON.parse(raw);

  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  const existing = config.agents.list.findIndex(
    (a: { id: string }) => a.id === registration.agent.id,
  );

  const agentEntry: Record<string, unknown> = {
    id: registration.agent.id,
  };

  if (registration.agent.name) agentEntry.name = registration.agent.name;
  if (registration.agent.model) agentEntry.model = registration.agent.model;
  if (registration.agent.tools) agentEntry.tools = registration.agent.tools;
  if (registration.agent.sandbox) agentEntry.sandbox = registration.agent.sandbox;
  if (registration.agent.runtime) agentEntry.runtime = registration.agent.runtime;
  if (registration.agent.skills) agentEntry.skills = registration.agent.skills;
  if (registration.agent.thinkingDefault) agentEntry.thinkingDefault = registration.agent.thinkingDefault;

  if (existing >= 0) {
    Object.assign(config.agents.list[existing], agentEntry);
  } else {
    config.agents.list.push(agentEntry);
  }

  if (registration.bindings) {
    if (!config.bindings) config.bindings = [];
    for (const binding of registration.bindings) {
      const exists = config.bindings.some(
        (b: { agentId: string; match?: { channel: string } }) =>
          b.agentId === binding.agentId && b.match?.channel === binding.channel,
      );
      if (!exists) {
        config.bindings.push({
          agentId: binding.agentId,
          match: {
            channel: binding.channel,
            ...(binding.accountId ? { accountId: binding.accountId } : {}),
            ...(binding.peer ? { peer: binding.peer } : {}),
          },
        });
      }
    }
  }

  if (registration.mcpServers) {
    if (!config.mcp) config.mcp = {};
    if (!config.mcp.servers) config.mcp.servers = {};
    Object.assign(config.mcp.servers, registration.mcpServers);
  }

  if (registration.memoryLanceDbPath) {
    if (!config.plugins) config.plugins = {};
    if (!config.plugins["memory-lancedb"]) config.plugins["memory-lancedb"] = {};
    config.plugins["memory-lancedb"].dbPath = registration.memoryLanceDbPath;
  }

  await fs.writeFile(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Check if an agent is already registered in the config.
 */
export async function isAgentRegistered(
  agentId: string,
  configPath?: string,
): Promise<boolean> {
  const cfgPath = configPath ?? path.join(
    process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw"),
    "openclaw.json",
  );

  try {
    const raw = await fs.readFile(cfgPath, "utf-8");
    const config = JSON.parse(raw);
    return (config.agents?.list ?? []).some((a: { id: string }) => a.id === agentId);
  } catch {
    return false;
  }
}

/**
 * Build a gateway tool call payload for meta-agents to register employees.
 * The Creator Agent uses this pattern to register new employees at runtime.
 */
export function buildGatewayToolCall(registration: FullAgentRegistration): {
  tool: string;
  action: string;
  params: { raw: string; note?: string };
} {
  return {
    tool: "gateway",
    action: "config.patch",
    params: {
      raw: buildAgentPatch(registration),
      note: `Register AI employee: ${registration.agent.name ?? registration.agent.id}`,
    },
  };
}
