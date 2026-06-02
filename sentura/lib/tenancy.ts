/**
 * Multi-tenancy helpers for Sentura.
 *
 * Tenancy is the bridge between an agent's flat ID (e.g. `ap-clerk`) and
 * its organizational scope (`tenantId` + `departmentId`). The agent ID
 * regex forbids slashes (see sentura/extensions/sentura-agents/src/paths.ts),
 * so we record tenancy in `~/.openclaw/sentura-rbac/agent-tenancy.json`
 * instead of mutating the OpenClaw config.
 *
 * Single-tenant deployments use `tenantId = "default"`. Multi-department
 * SMEs partition agents by `departmentId`. Multi-tenant deployments
 * (Week 5+) use distinct `tenantId` values and an SSO mapping layer.
 *
 * This file provides programmatic helpers for setup scripts, the
 * `sentura-cost` and `sentura-monitoring` extensions, and tests. Runtime
 * RPC access goes through `sentura.rbac.tenancy.{get,list,set}`.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractUserToken } from "./user-token.js";

export const DEFAULT_TENANT_ID = "default";

export interface AgentTenancy {
  agentId: string;
  tenantId: string;
  departmentId: string | null;
  updatedAt: string;
}

export interface TenantContext {
  agentId: string;
  tenantId: string;
  departmentId: string | null;
  userToken: string | null;
}

function resolveOpenClawHome(env: NodeJS.ProcessEnv = process.env): string {
  const stateDirOverride = env.OPENCLAW_STATE_DIR?.trim();
  if (stateDirOverride) return stateDirOverride;
  const home = env.OPENCLAW_HOME?.trim() || env.HOME?.trim() || os.homedir();
  if (!home) {
    throw new Error("Could not resolve OpenClaw home directory");
  }
  return path.join(home, ".openclaw");
}

function tenancyFilePath(): string {
  return path.join(resolveOpenClawHome(), "sentura-rbac", "agent-tenancy.json");
}

/**
 * Load the entire agent-tenancy table from disk. Returns `[]` if the
 * file does not exist (fresh install).
 */
export async function loadAgentTenancy(): Promise<AgentTenancy[]> {
  try {
    const raw = await fs.readFile(tenancyFilePath(), "utf-8");
    return JSON.parse(raw) as AgentTenancy[];
  } catch {
    return [];
  }
}

/**
 * Look up a single agent's tenancy. Returns `null` when no record exists
 * yet — callers should treat this as `{ tenantId: "default", departmentId: null }`.
 */
export async function getAgentTenancy(agentId: string): Promise<AgentTenancy | null> {
  const records = await loadAgentTenancy();
  return records.find((r) => r.agentId === agentId) ?? null;
}

/**
 * Idempotent upsert. If an existing record matches the requested tenant
 * and department, no write happens (keeps the setup-script "default
 * tenancy" step quiet on re-runs). The directory is created if missing.
 */
export async function setAgentTenancy(
  agentId: string,
  scope: { tenantId?: string; departmentId?: string | null },
): Promise<AgentTenancy> {
  const filePath = tenancyFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const records = await loadAgentTenancy();
  const tenantId = scope.tenantId ?? DEFAULT_TENANT_ID;
  const departmentId = scope.departmentId ?? null;

  const existingIndex = records.findIndex((r) => r.agentId === agentId);
  if (
    existingIndex >= 0 &&
    records[existingIndex].tenantId === tenantId &&
    records[existingIndex].departmentId === departmentId
  ) {
    return records[existingIndex];
  }

  const record: AgentTenancy = {
    agentId,
    tenantId,
    departmentId,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }

  records.sort((a, b) => a.agentId.localeCompare(b.agentId));
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), "utf-8");
  return record;
}

/**
 * Resolve the full tenant context for a session: combine the
 * `userToken` extracted from the session key with the agent's tenancy
 * record. Used by `sentura-cost` and `sentura-monitoring` to attribute
 * events.
 *
 * Returns `null` when the session key does not match the Sentura format
 * (`agent:<agentId>:user:<userToken>:<sessionId>`) — non-Sentura sessions
 * (e.g. raw OpenClaw CLI sessions) cannot be attributed.
 */
export async function resolveTenantContext(sessionKey: string): Promise<TenantContext | null> {
  const userToken = extractUserToken(sessionKey);
  const agentMatch = sessionKey.match(/^agent:([^:]+):/);
  if (!agentMatch) return null;
  const agentId = agentMatch[1];

  const tenancy = await getAgentTenancy(agentId);
  return {
    agentId,
    tenantId: tenancy?.tenantId ?? DEFAULT_TENANT_ID,
    departmentId: tenancy?.departmentId ?? null,
    userToken,
  };
}

/**
 * Apply default tenancy (`tenantId = "default"`, `departmentId = null`)
 * to every agent registered in the OpenClaw config that does not yet
 * have a tenancy record. Used by `scripts/sentura-setup.sh` Step 4b.
 * Returns the list of agent IDs that received a fresh default record.
 */
export async function applyDefaultTenancyOnDisk(configPath?: string): Promise<string[]> {
  const cfgPath = configPath ?? path.join(resolveOpenClawHome(), "openclaw.json");

  let config: { agents?: { list?: Array<{ id: string }> } };
  try {
    const raw = await fs.readFile(cfgPath, "utf-8");
    config = JSON.parse(raw);
  } catch {
    return [];
  }

  const agents = config.agents?.list ?? [];
  if (agents.length === 0) return [];

  const existing = await loadAgentTenancy();
  const seen = new Set(existing.map((r) => r.agentId));

  const seeded: string[] = [];
  for (const agent of agents) {
    if (!seen.has(agent.id)) {
      await setAgentTenancy(agent.id, { tenantId: DEFAULT_TENANT_ID, departmentId: null });
      seeded.push(agent.id);
    }
  }
  return seeded;
}
