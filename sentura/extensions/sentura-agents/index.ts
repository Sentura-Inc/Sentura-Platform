import fs from "node:fs";
import path from "node:path";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import {
  hasSenturaSecret,
  putSenturaSecret,
} from "../../lib/secrets.ts";
import {
  removePerAgentMcpServers,
  upsertPerAgentMcpServers,
} from "../../lib/per-agent-mcp.ts";
import {
  createAgentWorkspace,
  deleteSubfile,
  listSubfiles,
  readSubfile,
  writeSubfile,
} from "./src/fs-ops.js";
import { NATIVE_WORKSPACE_FILES, PathValidationError } from "./src/paths.js";
import {
  registerAgentInRuntimeConfig,
  stampAgentWorkspaceSetupCompleted,
  type BindingEntry,
} from "./src/register-agent.js";

interface ResolvedConfig {
  workspaceRoot: string;
  allowedPrefixes: string[];
  maxFileBytes: number;
  maxPathDepth: number;
}

const DEFAULT_ALLOWED_PREFIXES = ["skills/", "ekg/", "memory/users/"];
const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const DEFAULT_MAX_PATH_DEPTH = 4;

function resolveConfig(raw: Record<string, unknown> | undefined): ResolvedConfig {
  const workspaceRoot =
    typeof raw?.workspaceRoot === "string" && raw.workspaceRoot.trim().length
      ? (raw.workspaceRoot as string)
      : path.join(resolveOpenClawDir(), "workspace");
  const allowedPrefixes = Array.isArray(raw?.allowedPrefixes)
    ? (raw?.allowedPrefixes as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
    : DEFAULT_ALLOWED_PREFIXES;
  const maxFileBytes =
    typeof raw?.maxFileBytes === "number" && raw.maxFileBytes > 0
      ? (raw.maxFileBytes as number)
      : DEFAULT_MAX_FILE_BYTES;
  const maxPathDepth =
    typeof raw?.maxPathDepth === "number" && raw.maxPathDepth > 0
      ? (raw.maxPathDepth as number)
      : DEFAULT_MAX_PATH_DEPTH;
  return {
    workspaceRoot: path.resolve(workspaceRoot),
    allowedPrefixes: allowedPrefixes.length ? allowedPrefixes : DEFAULT_ALLOWED_PREFIXES,
    maxFileBytes,
    maxPathDepth,
  };
}

function toErrorShape(err: unknown): { code: string; message: string } {
  if (err instanceof PathValidationError) {
    return { code: err.code, message: err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: "INTERNAL_ERROR", message };
}

function normalizeBindings(raw: unknown): BindingEntry[] | undefined {
  return Array.isArray(raw)
    ? (raw.filter(
        (entry): entry is BindingEntry =>
          typeof entry === "object"
          && entry !== null
          && typeof (entry as { agentId?: unknown }).agentId === "string",
      ) as BindingEntry[])
    : undefined;
}

function normalizeRecord(raw: unknown): Record<string, unknown> | undefined {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : undefined;
}

function normalizeStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const values = raw.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return values.length > 0 ? values : undefined;
}

/**
 * Read OPENCLAW_HOME/.env and report whether the requested key has a non-empty
 * value WITHOUT returning the value itself. Used by self-provisioning to
 * verify a global credential is configured before invoking a tool that
 * depends on it.
 *
 * Parser is the standard dotenv format: lines of `KEY=value` or `KEY="value"`
 * or `KEY='value'`. Lines starting with `#` and blank lines are skipped.
 */
function checkDotenvKey(dotenvPath: string, key: string): { exists: boolean; length: number } {
  let raw: string;
  try {
    raw = fs.readFileSync(dotenvPath, "utf-8");
  } catch {
    return { exists: false, length: 0 };
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) continue;
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return { exists: v.length > 0, length: v.length };
  }
  return { exists: false, length: 0 };
}

// JSON schema for the agent-facing tool. Permissive optional fields cover
// several actions; per-action required fields are enforced in `execute`. Writes
// may target either a subfile (skills/, ekg/, memory/users/) OR one of the
// eight OpenClaw-native workspace files at the root (AGENTS.md, SOUL.md,
// TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) —
// because the agent-callable `gateway` tool does NOT expose agents.files.set.
const ManageToolSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: [
        "create_agent",
        "write",
        "read",
        "delete",
        "list",
        "register_agent",
        "stamp_setup",
        "put_secret",
        "has_secret",
        "upsert_mcp_servers",
        "remove_mcp_servers",
        "dotenv_check",
      ],
      description:
        "Operation: 'create_agent' creates the agent workspace directory (idempotent, auto-stamps setupCompletedAt so the agent is not bootstrap-pending); 'write' creates/overwrites a file (either a native top-level workspace file like AGENTS.md OR a subfile under skills/, ekg/, memory/users/); 'read' returns a file's content; 'delete' removes a file; 'list' enumerates files under the workspace (optionally scoped by relDir); 'register_agent' registers the agent in openclaw.json (agents.list + optional bindings + optional mcp.servers) IN-PROCESS, bypassing the gateway's scope-upgrade pairing requirement; 'stamp_setup' idempotently stamps setupCompletedAt in the workspace-state.json so the agent is not bootstrap-pending on first boot; 'put_secret' stores a per-agent secret in Sentura's file-backed secret store and returns only a $secret pointer; 'has_secret' checks whether a per-agent secret already exists; 'upsert_mcp_servers' writes per-agent MCP servers into the target workspace's config.json5 -> mcpServers using the Sentura secret-pointer launcher; 'remove_mcp_servers' removes named per-agent MCP servers from config.json5; 'dotenv_check' reads ~/.openclaw/.env and reports whether the given dotenv key has a non-empty value WITHOUT returning the value itself (used by self-provisioning to verify a global credential is configured before invoking a tool that depends on it).",
    },
    agentId: {
      type: "string",
      minLength: 1,
      description:
        "Target agent id (e.g. 'remy-billing-support'). Lowercase letters, digits, and hyphens only (same rules as OpenClaw agent ids).",
    },
    relPath: {
      type: "string",
      description:
        "Relative path under the agent's workspace. Either one of the native workspace files (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) OR a subfile under skills/, ekg/, memory/users/. Example: 'AGENTS.md' or 'skills/billing-triage/SKILL.md'. Required for action='write' | 'read' | 'delete'. Ignored otherwise.",
    },
    content: {
      type: "string",
      description: "File contents (UTF-8). Required for action='write'.",
    },
    relDir: {
      type: "string",
      description:
        "Optional subdirectory under the agent's workspace to restrict a 'list' action to (e.g. 'skills'). Only used when action='list'.",
    },
    service: {
      type: "string",
      description:
        "Integration/service name used in Sentura's secret path convention. Required for action='put_secret' | 'has_secret'. Example: 'zendesk' or 'gradsale'.",
    },
    credential: {
      type: "string",
      description:
        "Credential field name used in Sentura's secret path convention. Required for action='put_secret' | 'has_secret'. Example: 'api_key' or 'admin_token'.",
    },
    secretValue: {
      type: "string",
      description:
        "Secret plaintext to store in the file provider. Required for action='put_secret'. Never echoed back in tool output.",
    },
    dotenvKey: {
      type: "string",
      description:
        "Dotenv key name (e.g. 'OPENAI_API_KEY'). Required for action='dotenv_check'. The check returns only existence + value length — never the value itself.",
    },
    name: {
      type: "string",
      description:
        "Human-friendly display name for the employee (e.g. 'Remy'). Only used when action='register_agent'. Falls back to agentId if omitted.",
    },
    model: {
      type: "string",
      description:
        "Provider/model slug (e.g. 'openai/gpt-5.4'). Only used when action='register_agent'. If omitted, falls back to agents.defaults.model.",
    },
    workspaceDir: {
      type: "string",
      description:
        "Absolute path (or '~/…') to the employee's workspace. Defaults to '<OPENCLAW_HOME>/workspace/<agentId>'. Only used when action='register_agent'.",
    },
    agentDir: {
      type: "string",
      description:
        "Absolute path (or '~/…') to the agent's code directory. Defaults to '<OPENCLAW_HOME>/agents/<agentId>/agent'. Only used when action='register_agent'.",
    },
    identity: {
      description:
        "Identity metadata object (e.g. { name, emoji, role }) written into the agents.list entry. Only used when action='register_agent'.",
    },
    tools: {
      description:
        "Tools config object (profile, alsoAllow[], deny[], etc.). Only used when action='register_agent'.",
    },
    sandbox: {
      description:
        "Sandbox config object. Defaults to { mode: 'non-main' }. Only used when action='register_agent'.",
    },
    runtime: {
      description:
        "Runtime config object. Defaults to { type: 'embedded' }. Only used when action='register_agent'.",
    },
    params: {
      description:
        "Free-form agent params object (e.g. { memoryDbPath }). Only used when action='register_agent'.",
    },
    bindings: {
      description:
        "Optional array of channel-binding objects to append to config.bindings[] in the SAME atomic config write. Each entry must include an agentId field. Only used when action='register_agent'.",
    },
    mcpServers: {
      description:
        "Record of MCP server entries. For action='register_agent', merges under openclaw.json -> config.mcp.servers (shared/global Week 2 path). For action='upsert_mcp_servers', writes to the target workspace's config.json5 -> mcpServers (Week 3 per-agent path).",
    },
    serverNames: {
      description:
        "Array of MCP server names to remove from the target workspace's config.json5 -> mcpServers. Required for action='remove_mcp_servers'.",
    },
    overwrite: {
      type: "boolean",
      description:
        "If true, replaces an existing agents.list entry with the same id (deep-merging nested objects). Defaults to false. Only used when action='register_agent'.",
    },
    stampSetupCompleted: {
      type: "boolean",
      description:
        "If true (default), also stamp setupCompletedAt into <workspaceDir>/.openclaw/workspace-state.json so the new employee is not bootstrap-pending on first boot. Only used when action='register_agent'.",
    },
    tenancy: {
      description:
        "Optional tenancy assignment object: { tenantId?: string, departmentId?: string | null }. Written to ~/.openclaw/sentura-rbac/agent-tenancy.json (NOT to OpenClaw config). Defaults to { tenantId: 'default', departmentId: null } when omitted. Idempotent on identical scope. Only used when action='register_agent'.",
    },
  },
  required: ["action", "agentId"],
} as const;

type ManageToolAction =
  | "create_agent"
  | "write"
  | "read"
  | "delete"
  | "list"
  | "register_agent"
  | "stamp_setup"
  | "put_secret"
  | "has_secret"
  | "upsert_mcp_servers"
  | "remove_mcp_servers"
  | "dotenv_check";

interface ManageToolParams {
  action: ManageToolAction;
  agentId: string;
  relPath?: string;
  content?: string;
  relDir?: string;
  service?: string;
  credential?: string;
  secretValue?: string;
  dotenvKey?: string;
  name?: string;
  model?: string;
  workspaceDir?: string;
  agentDir?: string;
  identity?: unknown;
  tools?: unknown;
  sandbox?: unknown;
  runtime?: unknown;
  params?: unknown;
  bindings?: unknown;
  mcpServers?: unknown;
  serverNames?: unknown;
  overwrite?: boolean;
  stampSetupCompleted?: boolean;
  tenancy?: { tenantId?: string; departmentId?: string | null };
}

function renderResultText(action: string, result: unknown): string {
  if (action === "create_agent" && result && typeof result === "object" && "workspaceDir" in result) {
    const r = result as {
      agentId: string;
      workspaceDir: string;
      created: boolean;
      setupCompletedStamped?: boolean;
    };
    const stamp = r.setupCompletedStamped ? " (setupCompletedAt stamped)" : "";
    return r.created
      ? `Created workspace for ${r.agentId} at ${r.workspaceDir}${stamp}`
      : `Workspace for ${r.agentId} already exists at ${r.workspaceDir}${stamp}`;
  }
  if (action === "register_agent" && result && typeof result === "object" && "agentId" in result) {
    const r = result as {
      agentId: string;
      workspaceDir: string;
      agentDir: string;
      model?: string;
      mode: "created" | "updated";
      bindingsAdded: number;
      mcpServersMerged: number;
      setupCompletedStamped: boolean;
      tenancy?: { tenantId: string; departmentId: string | null; wrote: boolean };
    };
    const tenancyTag = r.tenancy
      ? ` tenancy=${r.tenancy.tenantId}${r.tenancy.departmentId ? `/${r.tenancy.departmentId}` : ""}${r.tenancy.wrote ? " (new)" : ""}`
      : "";
    const parts = [
      `${r.mode === "created" ? "Registered" : "Updated"} agent ${r.agentId} in openclaw.json`,
      r.model ? ` model=${r.model}` : "",
      ` workspace=${r.workspaceDir}`,
      ` agentDir=${r.agentDir}`,
      r.bindingsAdded > 0 ? ` bindings+=${r.bindingsAdded}` : "",
      r.mcpServersMerged > 0 ? ` mcp.servers+=${r.mcpServersMerged}` : "",
      r.setupCompletedStamped ? " (setupCompletedAt stamped)" : "",
      tenancyTag,
    ];
    return parts.filter(Boolean).join("");
  }
  if (action === "stamp_setup" && result && typeof result === "object" && "workspaceDir" in result) {
    const r = result as { workspaceDir: string; stamped: boolean };
    return r.stamped
      ? `Stamped setupCompletedAt in ${r.workspaceDir}/.openclaw/workspace-state.json`
      : `Workspace at ${r.workspaceDir} was already marked setup-complete`;
  }
  if (action === "put_secret" && result && typeof result === "object" && "pointer" in result) {
    const r = result as { pointer: string; created: boolean };
    return `${r.created ? "Stored" : "Updated"} secret pointer ${r.pointer}`;
  }
  if (action === "has_secret" && result && typeof result === "object" && "exists" in result) {
    const r = result as { pointer: string; exists: boolean };
    return `${r.exists ? "Found" : "Missing"} secret pointer ${r.pointer}`;
  }
  if (action === "upsert_mcp_servers" && result && typeof result === "object" && "configPath" in result) {
    const r = result as { upsertedServerNames: string[]; configPath: string; changed: boolean };
    const names = r.upsertedServerNames.join(", ");
    return r.changed
      ? `Upserted per-agent MCP servers [${names}] in ${r.configPath}`
      : `Per-agent MCP servers already up to date [${names}] in ${r.configPath}`;
  }
  if (action === "remove_mcp_servers" && result && typeof result === "object" && "configPath" in result) {
    const r = result as { removedServerNames: string[]; configPath: string; changed: boolean };
    const names = r.removedServerNames.join(", ");
    return r.changed
      ? `Removed per-agent MCP servers [${names}] from ${r.configPath}`
      : `No matching per-agent MCP servers to remove from ${r.configPath}`;
  }
  if (action === "list" && result && typeof result === "object" && "entries" in result) {
    const entries = (result as { entries: Array<{ relPath: string; bytes: number }> }).entries;
    if (entries.length === 0) {
      return "(no files)";
    }
    return entries.map((e) => `${e.relPath} (${e.bytes} bytes)`).join("\n");
  }
  if (action === "write" && result && typeof result === "object" && "relPath" in result) {
    const r = result as { agentId: string; relPath: string; bytes: number };
    return `Wrote ${r.relPath} (${r.bytes} bytes) to ${r.agentId}`;
  }
  if (action === "delete" && result && typeof result === "object" && "removed" in result) {
    const r = result as { agentId: string; relPath: string; removed: boolean };
    return r.removed
      ? `Deleted ${r.relPath} from ${r.agentId}`
      : `No file to delete at ${r.relPath} in ${r.agentId}`;
  }
  if (action === "read" && result && typeof result === "object" && "content" in result) {
    const r = result as { agentId: string; relPath: string; content: string; bytes: number };
    return `# ${r.agentId}/${r.relPath} (${r.bytes} bytes)\n\n${r.content}`;
  }
  return JSON.stringify(result, null, 2);
}

/**
 * Deterministically decide whether a given relPath is a native top-level
 * workspace file (AGENTS.md, SOUL.md, ...). Used to relax the path validator
 * on write/read/delete when Forge is materializing native files directly.
 */
function isNativeTopLevelFile(relPath: string): boolean {
  const trimmed = relPath.trim().replace(/^\/+|\/+$/g, "");
  if (trimmed.includes("/") || trimmed.includes("\\")) return false;
  return NATIVE_WORKSPACE_FILES.has(trimmed);
}

export default definePluginEntry({
  id: "sentura-agents",
  name: "Sentura Agents",
  description:
    "Host-side subfile RPCs for employee workspaces. Complements OpenClaw's agents.files.set which only covers the eight native files.",
  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig as Record<string, unknown> | undefined);
    const opts = {
      workspaceRoot: config.workspaceRoot,
      allowedPrefixes: config.allowedPrefixes,
      maxDepth: config.maxPathDepth,
      maxFileBytes: config.maxFileBytes,
    };

    api.logger.info(
      `[sentura-agents] Registering subfile RPCs. workspaceRoot=${config.workspaceRoot} allowedPrefixes=${config.allowedPrefixes.join("|")} maxBytes=${config.maxFileBytes} maxDepth=${config.maxPathDepth}`,
    );

    api.registerGatewayMethod("sentura.agents.createWorkspace", async ({ params, respond }) => {
      try {
        const result = await createAgentWorkspace(params?.agentId, opts);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.writeSubfile", async ({ params, respond }) => {
      try {
        const writeOpts = {
          ...opts,
          allowNativeFiles:
            typeof params?.relPath === "string" && isNativeTopLevelFile(params.relPath),
        };
        const result = await writeSubfile(params?.agentId, params?.relPath, params?.content, writeOpts);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.readSubfile", async ({ params, respond }) => {
      try {
        const result = await readSubfile(params?.agentId, params?.relPath, opts);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.deleteSubfile", async ({ params, respond }) => {
      try {
        const result = await deleteSubfile(params?.agentId, params?.relPath, opts);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.listSubfiles", async ({ params, respond }) => {
      try {
        const result = await listSubfiles(params?.agentId, params?.relDir, opts);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.registerAgent", async ({ params, respond }) => {
      try {
        const openclawHomeDir = resolveOpenClawDir();
        const normalizedBindings = normalizeBindings((params ?? {}).bindings as unknown);
        const normalizedMcp = normalizeRecord((params ?? {}).mcpServers as unknown);
        const result = await registerAgentInRuntimeConfig(api, {
          agentId: params?.agentId,
          name: params?.name,
          model: params?.model,
          workspaceDir: params?.workspaceDir,
          agentDir: params?.agentDir,
          identity: params?.identity as Record<string, unknown> | undefined,
          tools: params?.tools as Record<string, unknown> | undefined,
          sandbox: params?.sandbox as Record<string, unknown> | undefined,
          runtime: params?.runtime as Record<string, unknown> | undefined,
          params: params?.params as Record<string, unknown> | undefined,
          bindings: normalizedBindings,
          mcpServers: normalizedMcp,
          overwrite: params?.overwrite,
          stampSetupCompleted: params?.stampSetupCompleted,
          tenancy: params?.tenancy as
            | { tenantId?: string; departmentId?: string | null }
            | undefined,
          openclawHomeDir,
        });
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.putSecret", async ({ params, respond }) => {
      try {
        const result = await putSenturaSecret({
          agentId: String(params?.agentId ?? ""),
          service: String(params?.service ?? ""),
          credential: String(params?.credential ?? ""),
          value: String(params?.secretValue ?? ""),
          actor: "sentura.agents.putSecret",
        });
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.hasSecret", async ({ params, respond }) => {
      try {
        const result = await hasSenturaSecret({
          agentId: String(params?.agentId ?? ""),
          service: String(params?.service ?? ""),
          credential: String(params?.credential ?? ""),
        });
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.upsertMcpServers", async ({ params, respond }) => {
      try {
        const normalizedMcp = normalizeRecord(params?.mcpServers);
        if (!normalizedMcp) {
          throw new PathValidationError(
            "INVALID_MCP_SERVERS",
            "mcpServers must be a record for sentura.agents.upsertMcpServers",
          );
        }
        const result = await upsertPerAgentMcpServers({
          agentId: String(params?.agentId ?? ""),
          mcpServers: normalizedMcp,
          workspaceRoot: config.workspaceRoot,
          actor: "sentura.agents.upsertMcpServers",
        });
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.removeMcpServers", async ({ params, respond }) => {
      try {
        const serverNames = normalizeStringArray(params?.serverNames);
        if (!serverNames) {
          throw new PathValidationError(
            "INVALID_SERVER_NAMES",
            "serverNames must be a non-empty string array for sentura.agents.removeMcpServers",
          );
        }
        const result = await removePerAgentMcpServers({
          agentId: String(params?.agentId ?? ""),
          serverNames,
          workspaceRoot: config.workspaceRoot,
          actor: "sentura.agents.removeMcpServers",
        });
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    api.registerGatewayMethod("sentura.agents.stampSetupCompleted", async ({ params, respond }) => {
      try {
        const workspaceDir =
          typeof params?.workspaceDir === "string" && params.workspaceDir.trim().length > 0
            ? params.workspaceDir
            : path.join(config.workspaceRoot, params?.agentId ?? "");
        const result = await stampAgentWorkspaceSetupCompleted(workspaceDir);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, toErrorShape(err));
      }
    });

    // --- Agent-facing tool: unified handle on all four RPCs ---
    // NOTE: this tool MUST conform to the AgentTool interface from
    // @mariozechner/pi-agent-core: it needs a `label`, a TypeBox `parameters`
    // schema, and an `execute(toolCallId, params, signal, onUpdate)` method
    // returning { content, details }. Previous versions of this file used a
    // plain JSON schema + an (args) => string handler which broke the agent
    // loop at tool-dispatch time and caused the Creator to silently stall.
    api.registerTool({
      name: "sentura_agents_manage",
      label: "Sentura: Manage Employee Workspace",
      description:
        "Create and register an employee end-to-end on the HOST filesystem, secret store, and runtime config, entirely in-process. This is the ONLY correct way for Forge to deploy and evolve an employee, because: (a) fs_write cannot write to /workspace/.openclaw/workspace/<agent>/... (sandbox mount is read-only in 'non-main' mode); (b) the agent-callable `gateway` tool only supports the fixed GATEWAY_ACTIONS enum (restart, config.get, config.schema.lookup, config.apply, config.patch, update.run) — it does NOT expose agents.create or agents.files.set; and (c) gateway.call('config.patch', ...) requires operator.admin scope, and OpenClaw hard-codes silent=false for scope upgrades, so an embedded agent has no way to approve its own pairing prompt and the call hangs forever with 'pairing required'. Actions: 'create_agent' creates the workspace root directory (idempotent, AUTO-stamps setupCompletedAt so the new agent is not bootstrap-pending) — call this FIRST; 'write' creates/overwrites any file in the workspace, including the eight native files (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) AND subfiles under skills/, ekg/, memory/users/; 'read' returns a file's content; 'delete' removes a file; 'list' enumerates files (optionally scoped by relDir); 'register_agent' registers the agent in openclaw.json (agents.list + optional bindings + optional mcp.servers, all in one atomic write) — keep this for shared/global MCP wiring; 'put_secret' and 'has_secret' manage per-agent secrets in the Sentura file provider and return only $secret pointers; 'upsert_mcp_servers' and 'remove_mcp_servers' manage Week 3 per-agent MCP servers in the target workspace's config.json5 -> mcpServers via the Sentura secret-pointer launcher; 'stamp_setup' idempotently stamps setupCompletedAt in the workspace-state.json for an existing workspace; 'dotenv_check' reads ~/.openclaw/.env and reports whether a given dotenv key has a non-empty value WITHOUT returning the value itself — used by self-provisioning to verify a global credential is configured before invoking a tool that depends on it.",
      parameters: ManageToolSchema,
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as ManageToolParams;
        const action = params.action;
        try {
          if (action === "create_agent") {
            const result = await createAgentWorkspace(params.agentId, opts);
            // Sentura's convention keeps BOOTSTRAP.md permanently (as the
            // Enterprise Context doc), so without a setupCompletedAt stamp
            // the new workspace would boot in bootstrap-pending mode forever.
            // Stamp now — idempotent, cheap, and pairs naturally with
            // create_agent's "the workspace is ready to populate" semantics.
            let stamped = false;
            try {
              const stampRes = await stampAgentWorkspaceSetupCompleted(result.workspaceDir);
              stamped = stampRes.stamped;
            } catch (err) {
              api.logger.warn?.(
                `[sentura-agents] create_agent succeeded but setupCompletedAt stamp failed for ${params.agentId}: ${(err as Error).message}`,
              );
            }
            const enriched = { ...result, setupCompletedStamped: stamped };
            return {
              content: [{ type: "text", text: renderResultText("create_agent", enriched) }],
              details: enriched,
            };
          }
          if (action === "register_agent") {
            const openclawHomeDir = resolveOpenClawDir();
            const normalizedBindings = normalizeBindings(params.bindings as unknown);
            const normalizedMcp = normalizeRecord(params.mcpServers as unknown);
            const result = await registerAgentInRuntimeConfig(api, {
              agentId: params.agentId,
              name: params.name,
              model: params.model,
              workspaceDir: params.workspaceDir,
              agentDir: params.agentDir,
              identity: params.identity as Record<string, unknown> | undefined,
              tools: params.tools as Record<string, unknown> | undefined,
              sandbox: params.sandbox as Record<string, unknown> | undefined,
              runtime: params.runtime as Record<string, unknown> | undefined,
              params: params.params as Record<string, unknown> | undefined,
              bindings: normalizedBindings,
              mcpServers: normalizedMcp,
              overwrite: params.overwrite,
              stampSetupCompleted: params.stampSetupCompleted,
              tenancy: params.tenancy,
              openclawHomeDir,
            });
            return {
              content: [{ type: "text", text: renderResultText("register_agent", result) }],
              details: result,
            };
          }
          if (action === "put_secret") {
            if (!params.service) {
              throw new PathValidationError("MISSING_SERVICE", "service is required for action='put_secret'");
            }
            if (!params.credential) {
              throw new PathValidationError("MISSING_CREDENTIAL", "credential is required for action='put_secret'");
            }
            if (typeof params.secretValue !== "string") {
              throw new PathValidationError("MISSING_SECRET_VALUE", "secretValue is required for action='put_secret'");
            }
            const result = await putSenturaSecret({
              agentId: params.agentId,
              service: params.service,
              credential: params.credential,
              value: params.secretValue,
              actor: "sentura_agents_manage.put_secret",
            });
            return {
              content: [{ type: "text", text: renderResultText("put_secret", result) }],
              details: {
                ok: result.ok,
                created: result.created,
                secretId: result.secretId,
                pointer: result.pointer,
                ref: result.ref,
                secretsFilePath: result.secretsFilePath,
              },
            };
          }
          if (action === "has_secret") {
            if (!params.service) {
              throw new PathValidationError("MISSING_SERVICE", "service is required for action='has_secret'");
            }
            if (!params.credential) {
              throw new PathValidationError("MISSING_CREDENTIAL", "credential is required for action='has_secret'");
            }
            const result = await hasSenturaSecret({
              agentId: params.agentId,
              service: params.service,
              credential: params.credential,
            });
            return {
              content: [{ type: "text", text: renderResultText("has_secret", result) }],
              details: result,
            };
          }
          if (action === "upsert_mcp_servers") {
            const normalizedMcp = normalizeRecord(params.mcpServers);
            if (!normalizedMcp) {
              throw new PathValidationError("MISSING_MCP_SERVERS", "mcpServers is required for action='upsert_mcp_servers'");
            }
            const result = await upsertPerAgentMcpServers({
              agentId: params.agentId,
              mcpServers: normalizedMcp,
              workspaceRoot: config.workspaceRoot,
              actor: "sentura_agents_manage.upsert_mcp_servers",
            });
            return {
              content: [{ type: "text", text: renderResultText("upsert_mcp_servers", result) }],
              details: result,
            };
          }
          if (action === "remove_mcp_servers") {
            const serverNames = normalizeStringArray(params.serverNames);
            if (!serverNames) {
              throw new PathValidationError("MISSING_SERVER_NAMES", "serverNames is required for action='remove_mcp_servers'");
            }
            const result = await removePerAgentMcpServers({
              agentId: params.agentId,
              serverNames,
              workspaceRoot: config.workspaceRoot,
              actor: "sentura_agents_manage.remove_mcp_servers",
            });
            return {
              content: [{ type: "text", text: renderResultText("remove_mcp_servers", result) }],
              details: result,
            };
          }
          if (action === "stamp_setup") {
            const workspaceDir = path.join(config.workspaceRoot, params.agentId);
            const result = await stampAgentWorkspaceSetupCompleted(workspaceDir);
            return {
              content: [{ type: "text", text: renderResultText("stamp_setup", result) }],
              details: result,
            };
          }
          if (action === "write") {
            if (!params.relPath) {
              throw new PathValidationError("MISSING_RELPATH", "relPath is required for action='write'");
            }
            if (typeof params.content !== "string") {
              throw new PathValidationError("MISSING_CONTENT", "content is required for action='write'");
            }
            const writeOpts = {
              ...opts,
              allowNativeFiles: isNativeTopLevelFile(params.relPath),
            };
            const result = await writeSubfile(params.agentId, params.relPath, params.content, writeOpts);
            return {
              content: [{ type: "text", text: renderResultText("write", result) }],
              details: result,
            };
          }
          if (action === "read") {
            if (!params.relPath) {
              throw new PathValidationError("MISSING_RELPATH", "relPath is required for action='read'");
            }
            const readOpts = {
              ...opts,
              allowNativeFiles: isNativeTopLevelFile(params.relPath),
            };
            const result = await readSubfile(params.agentId, params.relPath, readOpts);
            return {
              content: [{ type: "text", text: renderResultText("read", result) }],
              details: result,
            };
          }
          if (action === "delete") {
            if (!params.relPath) {
              throw new PathValidationError("MISSING_RELPATH", "relPath is required for action='delete'");
            }
            const deleteOpts = {
              ...opts,
              allowNativeFiles: isNativeTopLevelFile(params.relPath),
            };
            const result = await deleteSubfile(params.agentId, params.relPath, deleteOpts);
            return {
              content: [{ type: "text", text: renderResultText("delete", result) }],
              details: result,
            };
          }
          if (action === "dotenv_check") {
            if (!params.dotenvKey) {
              throw new PathValidationError("MISSING_DOTENV_KEY", "dotenvKey is required for action='dotenv_check'");
            }
            const dotenvPath = path.join(resolveOpenClawDir(), ".env");
            const probe = checkDotenvKey(dotenvPath, params.dotenvKey);
            const result = {
              ok: true,
              exists: probe.exists,
              length: probe.length,
              dotenvFilePath: dotenvPath,
            };
            const text = probe.exists
              ? `dotenv key '${params.dotenvKey}' is set (length=${probe.length})`
              : `dotenv key '${params.dotenvKey}' is NOT set`;
            return {
              content: [{ type: "text", text }],
              details: result,
            };
          }
          // action === "list"
          const result = await listSubfiles(params.agentId, params.relDir, opts);
          return {
            content: [{ type: "text", text: renderResultText("list", result) }],
            details: result,
          };
        } catch (err) {
          const shape = toErrorShape(err);
          return {
            content: [
              {
                type: "text",
                text: `sentura_agents_manage(${action}) error [${shape.code}]: ${shape.message}`,
              },
            ],
            details: { error: shape },
          };
        }
      },
    });

    api.logger.info("[sentura-agents] Extension registered. workspaceRoot:", config.workspaceRoot);
  },
});
