import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendSenturaConfigDiff,
  resolveSenturaConfigDiffLogPathFromOpenClawDir,
  type SenturaConfigDiffRecord,
} from "./config-versioning.ts";
import {
  readJson5ObjectIfExists,
  stringifyJson5,
} from "./json5-file.ts";
import { resolveOpenClawWorkspaceBase } from "./openclaw-paths.ts";

export interface ManagedMcpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string | number | boolean>;
  cwd?: string;
  workingDirectory?: string;
  url?: string;
  transport?: "sse" | "streamable-http";
  headers?: Record<string, string | number | boolean>;
  connectionTimeoutMs?: number;
  [key: string]: unknown;
}

export interface UpsertPerAgentMcpServersOptions {
  agentId: string;
  mcpServers: Record<string, ManagedMcpServerConfig>;
  workspaceRoot?: string;
  actor?: string;
  note?: string;
  sessionKey?: string;
}

export interface UpsertPerAgentMcpServersResult {
  ok: true;
  agentId: string;
  configPath: string;
  changed: boolean;
  createdConfig: boolean;
  upsertedServerNames: string[];
  diffRecord: SenturaConfigDiffRecord | null;
}

export interface RemovePerAgentMcpServersOptions {
  agentId: string;
  serverNames: string[];
  workspaceRoot?: string;
  actor?: string;
  note?: string;
  sessionKey?: string;
}

export interface RemovePerAgentMcpServersResult {
  ok: true;
  agentId: string;
  configPath: string;
  changed: boolean;
  removedServerNames: string[];
  diffRecord: SenturaConfigDiffRecord | null;
}

const SAFE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SECRET_POINTER_RE = /^\$secret:\//;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SENTURA_MCP_LAUNCHER_PATH = path.join(REPO_ROOT, "scripts", "sentura-mcp-launcher.mjs");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value);
}

function validateSafeSegment(label: string, value: string): string {
  const trimmed = value.trim();
  if (!SAFE_SEGMENT_RE.test(trimmed)) {
    throw new Error(
      `${label} must match /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/; received "${value}".`,
    );
  }
  return trimmed;
}

function normalizeAgentId(agentId: string): string {
  const trimmed = agentId.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(trimmed)) {
    throw new Error(`Invalid agentId "${agentId}".`);
  }
  return trimmed;
}

function normalizeStringRecord(
  value: unknown,
): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter((entry): entry is [string, string] => {
    return typeof entry[1] === "string";
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isStdioServer(server: ManagedMcpServerConfig): boolean {
  return typeof server.command === "string" && server.command.trim().length > 0;
}

function isRemoteServer(server: ManagedMcpServerConfig): boolean {
  return typeof server.url === "string" && server.url.trim().length > 0;
}

function hasSecretPointer(value: unknown): boolean {
  return typeof value === "string" && SECRET_POINTER_RE.test(value);
}

function isAlreadyManagedServer(server: ManagedMcpServerConfig): boolean {
  return server.command === "node"
    && Array.isArray(server.args)
    && server.args[0] === SENTURA_MCP_LAUNCHER_PATH
    && isRecord(server.sentura)
    && server.sentura.managedBy === "sentura-mcp-launcher";
}

function buildManagedServerConfig(
  serverName: string,
  server: ManagedMcpServerConfig,
): ManagedMcpServerConfig {
  if (isAlreadyManagedServer(server)) {
    return server;
  }

  const env = normalizeStringRecord(server.env);
  const headers = normalizeStringRecord(server.headers);
  const containsEnvPointer = Object.values(env ?? {}).some(hasSecretPointer);
  const containsHeaderPointer = Object.values(headers ?? {}).some(hasSecretPointer);

  if (containsHeaderPointer) {
    throw new Error(
      `MCP server "${serverName}" uses $secret pointers in headers. Week 3 A only supports secret pointers in stdio env.`,
    );
  }

  if (isRemoteServer(server)) {
    if (containsEnvPointer) {
      throw new Error(
        `MCP server "${serverName}" is remote/http-based. $secret pointers are only supported in stdio env.`,
      );
    }
    return server;
  }

  if (!isStdioServer(server)) {
    throw new Error(
      `MCP server "${serverName}" must define either a stdio command or a remote url.`,
    );
  }

  const args = Array.isArray(server.args)
    ? server.args.filter((entry): entry is string => typeof entry === "string")
    : [];
  const cwd =
    typeof server.cwd === "string" && server.cwd.trim().length > 0
      ? server.cwd
      : typeof server.workingDirectory === "string" && server.workingDirectory.trim().length > 0
        ? server.workingDirectory
        : undefined;

  const next: ManagedMcpServerConfig = {
    command: "node",
    args: [SENTURA_MCP_LAUNCHER_PATH, server.command!, ...args],
    ...(env ? { env } : {}),
    ...(cwd ? { cwd } : {}),
    ...(typeof server.connectionTimeoutMs === "number"
      ? { connectionTimeoutMs: server.connectionTimeoutMs }
      : {}),
    sentura: {
      managedBy: "sentura-mcp-launcher",
      version: 1,
      targetCommand: server.command,
      targetArgs: args,
      secretPointerMode: containsEnvPointer ? "stdio-env" : "none",
    },
  };

  return next;
}

export function getSenturaMcpLauncherPath(): string {
  return SENTURA_MCP_LAUNCHER_PATH;
}

export function resolvePerAgentConfigPath(
  agentId: string,
  workspaceRoot = resolveOpenClawWorkspaceBase(),
): string {
  return path.join(workspaceRoot, normalizeAgentId(agentId), "config.json5");
}

async function ensureAgentWorkspace(agentId: string, workspaceRoot: string): Promise<string> {
  const normalizedAgentId = normalizeAgentId(agentId);
  const workspaceDir = path.join(workspaceRoot, normalizedAgentId);
  const stat = await fs.stat(workspaceDir).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") {
      throw new Error(
        `Agent workspace missing at ${workspaceDir}. Create the agent workspace before managing per-agent MCP servers.`,
      );
    }
    throw err;
  });
  if (!stat.isDirectory()) {
    throw new Error(`Agent workspace path exists but is not a directory: ${workspaceDir}`);
  }
  return workspaceDir;
}

export async function upsertPerAgentMcpServers(
  options: UpsertPerAgentMcpServersOptions,
): Promise<UpsertPerAgentMcpServersResult> {
  const agentId = normalizeAgentId(options.agentId);
  const workspaceRoot = path.resolve(options.workspaceRoot ?? resolveOpenClawWorkspaceBase());
  const openclawDir = path.dirname(workspaceRoot);
  await ensureAgentWorkspace(agentId, workspaceRoot);
  const configPath = resolvePerAgentConfigPath(agentId, workspaceRoot);
  const loaded = await readJson5ObjectIfExists(configPath);

  const nextConfig = structuredClone(loaded.parsed);
  const beforeConfig = structuredClone(loaded.parsed);
  const existingMcpServers = isRecord(nextConfig.mcpServers)
    ? ({ ...(nextConfig.mcpServers as Record<string, unknown>) })
    : {};
  const nextMcpServers = { ...existingMcpServers };
  const upsertedServerNames: string[] = [];

  for (const [rawName, server] of Object.entries(options.mcpServers)) {
    const serverName = validateSafeSegment("serverName", rawName);
    const managed = buildManagedServerConfig(serverName, server);
    nextMcpServers[serverName] = managed;
    upsertedServerNames.push(serverName);
  }

  nextConfig.mcpServers = nextMcpServers;
  if (stableSerialize(beforeConfig) === stableSerialize(nextConfig)) {
    return {
      ok: true,
      agentId,
      configPath,
      changed: false,
      createdConfig: !loaded.existed,
      upsertedServerNames: upsertedServerNames.toSorted(),
      diffRecord: null,
    };
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, stringifyJson5(nextConfig), "utf8");
  const diffRecord = await appendSenturaConfigDiff({
    operation: "sentura.upsert_per_agent_mcp_servers",
    actor: options.actor,
    note: options.note ?? `Upsert per-agent MCP servers: ${upsertedServerNames.join(", ")}`,
    targetType: "agent.config",
    targetPath: configPath,
    agentId,
    sessionKey: options.sessionKey,
    beforeValue: beforeConfig,
    afterValue: nextConfig,
    logPath: resolveSenturaConfigDiffLogPathFromOpenClawDir(openclawDir),
  });

  return {
    ok: true,
    agentId,
    configPath,
    changed: true,
    createdConfig: !loaded.existed,
    upsertedServerNames: upsertedServerNames.toSorted(),
    diffRecord,
  };
}

export async function removePerAgentMcpServers(
  options: RemovePerAgentMcpServersOptions,
): Promise<RemovePerAgentMcpServersResult> {
  const agentId = normalizeAgentId(options.agentId);
  const workspaceRoot = path.resolve(options.workspaceRoot ?? resolveOpenClawWorkspaceBase());
  const openclawDir = path.dirname(workspaceRoot);
  await ensureAgentWorkspace(agentId, workspaceRoot);
  const configPath = resolvePerAgentConfigPath(agentId, workspaceRoot);
  const loaded = await readJson5ObjectIfExists(configPath);
  const beforeConfig = structuredClone(loaded.parsed);
  const nextConfig = structuredClone(loaded.parsed);
  const mcpServers = isRecord(nextConfig.mcpServers)
    ? ({ ...(nextConfig.mcpServers as Record<string, unknown>) })
    : {};
  const removedServerNames: string[] = [];

  for (const rawName of options.serverNames) {
    const serverName = validateSafeSegment("serverName", rawName);
    if (serverName in mcpServers) {
      delete mcpServers[serverName];
      removedServerNames.push(serverName);
    }
  }

  if (removedServerNames.length === 0) {
    return {
      ok: true,
      agentId,
      configPath,
      changed: false,
      removedServerNames: [],
      diffRecord: null,
    };
  }

  if (Object.keys(mcpServers).length > 0) {
    nextConfig.mcpServers = mcpServers;
  } else {
    delete nextConfig.mcpServers;
  }

  await fs.writeFile(configPath, stringifyJson5(nextConfig), "utf8");
  const diffRecord = await appendSenturaConfigDiff({
    operation: "sentura.remove_per_agent_mcp_servers",
    actor: options.actor,
    note: options.note ?? `Remove per-agent MCP servers: ${removedServerNames.join(", ")}`,
    targetType: "agent.config",
    targetPath: configPath,
    agentId,
    sessionKey: options.sessionKey,
    beforeValue: beforeConfig,
    afterValue: nextConfig,
    logPath: resolveSenturaConfigDiffLogPathFromOpenClawDir(openclawDir),
  });

  return {
    ok: true,
    agentId,
    configPath,
    changed: true,
    removedServerNames: removedServerNames.toSorted(),
    diffRecord,
  };
}
