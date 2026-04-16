/**
 * Per-agent LanceDB memory isolation.
 *
 * OpenClaw's memory-lancedb extension uses a shared LanceDB store by default
 * (~/.openclaw/memory/lancedb). Sentura configures per-agent dbPath to ensure
 * each AI employee's vector memory is isolated.
 *
 * Two-tier isolation:
 *   Tier 1 (this module): Per-agent LanceDB directory
 *   Tier 2 (Week 4): User-level metadata partitioning within each agent's store
 */

import fs from "node:fs/promises";
import path from "node:path";

const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw");

/**
 * Build the per-agent LanceDB path convention.
 * Format: ~/.openclaw/memory/{agentId}/lancedb
 */
export function agentMemoryDbPath(agentId: string): string {
  return `~/.openclaw/memory/${agentId}/lancedb`;
}

/**
 * Resolve the absolute path for an agent's memory directory.
 */
export function resolveAgentMemoryDir(agentId: string): string {
  return path.join(OPENCLAW_HOME, "memory", agentId, "lancedb");
}

/**
 * Ensure the memory directory exists for an agent.
 */
export async function ensureAgentMemoryDir(agentId: string): Promise<string> {
  const dir = resolveAgentMemoryDir(agentId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Build a config.patch fragment that sets per-agent LanceDB dbPath.
 *
 * OpenClaw's memory-lancedb plugin reads its config from the plugin config section.
 * However, per-agent plugin config is not natively supported — the plugin reads
 * a single global config. For true per-agent isolation, we use per-agent
 * `agents.list[].params.memoryDbPath` and a Sentura extension wrapper.
 *
 * For meta-agents registered during setup, we set their dbPath in the global
 * config since they're the only agents that need memory initially.
 */
export function buildMemoryIsolationPatch(agentId: string): Record<string, unknown> {
  return {
    agents: {
      list: [
        {
          id: agentId,
          params: {
            memoryDbPath: agentMemoryDbPath(agentId),
          },
        },
      ],
    },
  };
}

/**
 * Apply per-agent memory isolation to all agents in the config file.
 * Sets params.memoryDbPath for each agent that doesn't already have one.
 */
export async function applyMemoryIsolationOnDisk(configPath?: string): Promise<string[]> {
  const cfgPath = configPath ?? path.join(OPENCLAW_HOME, "openclaw.json");

  const raw = await fs.readFile(cfgPath, "utf-8");
  const config = JSON.parse(raw);

  const updated: string[] = [];

  for (const agent of config.agents?.list ?? []) {
    if (!agent.params) agent.params = {};
    if (!agent.params.memoryDbPath) {
      agent.params.memoryDbPath = agentMemoryDbPath(agent.id);
      updated.push(agent.id);
    }
  }

  if (updated.length > 0) {
    await fs.writeFile(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  }

  return updated;
}

/**
 * Validate that all agents have unique, isolated memory paths.
 * Returns any agents that share a memory directory (should be empty).
 */
export async function validateMemoryIsolation(configPath?: string): Promise<{
  isolated: string[];
  shared: Array<{ agents: string[]; path: string }>;
}> {
  const cfgPath = configPath ?? path.join(OPENCLAW_HOME, "openclaw.json");

  const raw = await fs.readFile(cfgPath, "utf-8");
  const config = JSON.parse(raw);

  const pathToAgents = new Map<string, string[]>();
  const isolated: string[] = [];

  for (const agent of config.agents?.list ?? []) {
    const dbPath = agent.params?.memoryDbPath ?? "~/.openclaw/memory/lancedb";
    const agents = pathToAgents.get(dbPath) ?? [];
    agents.push(agent.id);
    pathToAgents.set(dbPath, agents);
  }

  const shared: Array<{ agents: string[]; path: string }> = [];

  for (const [dbPath, agents] of pathToAgents) {
    if (agents.length > 1) {
      shared.push({ agents, path: dbPath });
    } else {
      isolated.push(agents[0]);
    }
  }

  return { isolated, shared };
}
