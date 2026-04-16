/**
 * Channel binding helpers for programmatically binding agents to channels/peers.
 *
 * Bindings in OpenClaw are top-level config entries that map
 * { channel, accountId, peer } → agentId. This module provides
 * typed helpers to create, remove, and query bindings.
 */

import fs from "node:fs/promises";
import path from "node:path";

export type ChatType = "dm" | "channel" | "group" | "thread";

export interface PeerMatch {
  kind: ChatType;
  id: string;
}

export interface BindingMatch {
  channel: string;
  accountId?: string;
  peer?: PeerMatch;
  guildId?: string;
  teamId?: string;
  roles?: string[];
}

export interface AgentBinding {
  type?: "route" | "acp";
  agentId: string;
  comment?: string;
  match: BindingMatch;
}

/**
 * Create a webchat DM binding (for dashboard chat).
 */
export function createWebchatBinding(agentId: string): AgentBinding {
  return {
    agentId,
    match: {
      channel: "webchat",
      peer: { kind: "dm", id: "*" },
    },
  };
}

/**
 * Create a Slack channel binding.
 */
export function createSlackChannelBinding(
  agentId: string,
  channelId: string,
  accountId?: string,
): AgentBinding {
  return {
    agentId,
    comment: `Slack channel binding for ${agentId}`,
    match: {
      channel: "slack",
      ...(accountId ? { accountId } : {}),
      peer: { kind: "channel", id: channelId },
    },
  };
}

/**
 * Create a Slack DM binding.
 */
export function createSlackDmBinding(
  agentId: string,
  accountId?: string,
): AgentBinding {
  return {
    agentId,
    comment: `Slack DM binding for ${agentId}`,
    match: {
      channel: "slack",
      ...(accountId ? { accountId } : {}),
      peer: { kind: "dm", id: "*" },
    },
  };
}

/**
 * Create a Discord channel binding with optional guild/role restrictions.
 */
export function createDiscordBinding(
  agentId: string,
  channelId: string,
  options?: { guildId?: string; roles?: string[]; accountId?: string },
): AgentBinding {
  return {
    agentId,
    comment: `Discord binding for ${agentId}`,
    match: {
      channel: "discord",
      ...(options?.accountId ? { accountId: options.accountId } : {}),
      ...(options?.guildId ? { guildId: options.guildId } : {}),
      ...(options?.roles ? { roles: options.roles } : {}),
      peer: { kind: "channel", id: channelId },
    },
  };
}

/**
 * Create a Teams channel binding.
 */
export function createTeamsBinding(
  agentId: string,
  channelId: string,
  options?: { teamId?: string; accountId?: string },
): AgentBinding {
  return {
    agentId,
    comment: `Teams binding for ${agentId}`,
    match: {
      channel: "teams",
      ...(options?.accountId ? { accountId: options.accountId } : {}),
      ...(options?.teamId ? { teamId: options.teamId } : {}),
      peer: { kind: "channel", id: channelId },
    },
  };
}

/**
 * Create a generic channel binding.
 */
export function createChannelBinding(
  agentId: string,
  channel: string,
  peer?: PeerMatch,
  options?: { accountId?: string; guildId?: string; teamId?: string },
): AgentBinding {
  return {
    agentId,
    match: {
      channel,
      ...(options?.accountId ? { accountId: options.accountId } : {}),
      ...(options?.guildId ? { guildId: options.guildId } : {}),
      ...(options?.teamId ? { teamId: options.teamId } : {}),
      ...(peer ? { peer } : {}),
    },
  };
}

/**
 * Build a config.patch JSON string that adds bindings.
 */
export function buildBindingsPatch(bindings: AgentBinding[]): string {
  return JSON.stringify({ bindings }, null, 2);
}

/**
 * Add bindings to the OpenClaw config file on disk.
 * Deduplicates by agentId + channel + peer.
 */
export async function addBindingsOnDisk(
  bindings: AgentBinding[],
  configPath?: string,
): Promise<number> {
  const cfgPath = configPath ?? path.join(
    process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw"),
    "openclaw.json",
  );

  const raw = await fs.readFile(cfgPath, "utf-8");
  const config = JSON.parse(raw);

  if (!config.bindings) config.bindings = [];

  let added = 0;
  for (const binding of bindings) {
    const exists = config.bindings.some(
      (b: AgentBinding) =>
        b.agentId === binding.agentId &&
        b.match.channel === binding.match.channel &&
        b.match.peer?.id === binding.match.peer?.id &&
        b.match.peer?.kind === binding.match.peer?.kind,
    );
    if (!exists) {
      config.bindings.push(binding);
      added++;
    }
  }

  if (added > 0) {
    await fs.writeFile(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  }

  return added;
}

/**
 * Remove all bindings for a specific agent from the config file on disk.
 */
export async function removeAgentBindingsOnDisk(
  agentId: string,
  configPath?: string,
): Promise<number> {
  const cfgPath = configPath ?? path.join(
    process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw"),
    "openclaw.json",
  );

  const raw = await fs.readFile(cfgPath, "utf-8");
  const config = JSON.parse(raw);

  if (!config.bindings) return 0;

  const before = config.bindings.length;
  config.bindings = config.bindings.filter(
    (b: AgentBinding) => b.agentId !== agentId,
  );
  const removed = before - config.bindings.length;

  if (removed > 0) {
    await fs.writeFile(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  }

  return removed;
}

/**
 * List all bindings for a specific agent from the config.
 */
export async function listAgentBindings(
  agentId: string,
  configPath?: string,
): Promise<AgentBinding[]> {
  const cfgPath = configPath ?? path.join(
    process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw"),
    "openclaw.json",
  );

  try {
    const raw = await fs.readFile(cfgPath, "utf-8");
    const config = JSON.parse(raw);
    return (config.bindings ?? []).filter(
      (b: AgentBinding) => b.agentId === agentId,
    );
  } catch {
    return [];
  }
}
