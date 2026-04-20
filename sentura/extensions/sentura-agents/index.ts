import path from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
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

// TypeBox schema for the agent-facing tool. Permissive optional fields cover
// five actions; per-action required fields are enforced in `execute`. Writes
// may target either a subfile (skills/, ekg/, memory/users/) OR one of the
// eight OpenClaw-native workspace files at the root (AGENTS.md, SOUL.md,
// TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) —
// because the agent-callable `gateway` tool does NOT expose agents.files.set.
const ManageToolSchema = Type.Object(
  {
    action: Type.Union(
      [
        Type.Literal("create_agent"),
        Type.Literal("write"),
        Type.Literal("read"),
        Type.Literal("delete"),
        Type.Literal("list"),
        Type.Literal("register_agent"),
        Type.Literal("stamp_setup"),
      ],
      {
        description:
          "Operation: 'create_agent' creates the agent workspace directory (idempotent, auto-stamps setupCompletedAt so the agent is not bootstrap-pending); 'write' creates/overwrites a file (either a native top-level workspace file like AGENTS.md OR a subfile under skills/, ekg/, memory/users/); 'read' returns a file's content; 'delete' removes a file; 'list' enumerates files under the workspace (optionally scoped by relDir); 'register_agent' registers the agent in openclaw.json (agents.list + optional bindings + optional mcp.servers) IN-PROCESS, bypassing the gateway's scope-upgrade pairing requirement; 'stamp_setup' idempotently stamps setupCompletedAt in the workspace-state.json so the agent is not bootstrap-pending on first boot.",
      },
    ),
    agentId: Type.String({
      minLength: 1,
      description:
        "Target agent id (e.g. 'remy-billing-support'). Lowercase letters, digits, and hyphens only (same rules as OpenClaw agent ids).",
    }),
    relPath: Type.Optional(
      Type.String({
        description:
          "Relative path under the agent's workspace. Either one of the native workspace files (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) OR a subfile under skills/, ekg/, memory/users/. Example: 'AGENTS.md' or 'skills/billing-triage/SKILL.md'. Required for action='write' | 'read' | 'delete'. Ignored otherwise.",
      }),
    ),
    content: Type.Optional(
      Type.String({
        description: "File contents (UTF-8). Required for action='write'.",
      }),
    ),
    relDir: Type.Optional(
      Type.String({
        description:
          "Optional subdirectory under the agent's workspace to restrict a 'list' action to (e.g. 'skills'). Only used when action='list'.",
      }),
    ),
    // --- Fields used by action='register_agent' ---
    name: Type.Optional(
      Type.String({
        description:
          "Human-friendly display name for the employee (e.g. 'Remy'). Only used when action='register_agent'. Falls back to agentId if omitted.",
      }),
    ),
    model: Type.Optional(
      Type.String({
        description:
          "Provider/model slug (e.g. 'openai/gpt-5.4'). Only used when action='register_agent'. If omitted, falls back to agents.defaults.model.",
      }),
    ),
    workspaceDir: Type.Optional(
      Type.String({
        description:
          "Absolute path (or '~/…') to the employee's workspace. Defaults to '<OPENCLAW_HOME>/workspace/<agentId>'. Only used when action='register_agent'.",
      }),
    ),
    agentDir: Type.Optional(
      Type.String({
        description:
          "Absolute path (or '~/…') to the agent's code directory. Defaults to '<OPENCLAW_HOME>/agents/<agentId>/agent'. Only used when action='register_agent'.",
      }),
    ),
    identity: Type.Optional(
      Type.Any({
        description:
          "Identity metadata object (e.g. { name, emoji, role }) written into the agents.list entry. Only used when action='register_agent'.",
      }),
    ),
    tools: Type.Optional(
      Type.Any({
        description:
          "Tools config object (profile, alsoAllow[], deny[], etc.). Only used when action='register_agent'.",
      }),
    ),
    sandbox: Type.Optional(
      Type.Any({
        description:
          "Sandbox config object. Defaults to { mode: 'non-main' }. Only used when action='register_agent'.",
      }),
    ),
    runtime: Type.Optional(
      Type.Any({
        description:
          "Runtime config object. Defaults to { type: 'embedded' }. Only used when action='register_agent'.",
      }),
    ),
    params: Type.Optional(
      Type.Any({
        description:
          "Free-form agent params object (e.g. { memoryDbPath }). Only used when action='register_agent'.",
      }),
    ),
    bindings: Type.Optional(
      Type.Any({
        description:
          "Optional array of channel-binding objects to append to config.bindings[] in the SAME atomic config write. Each entry must include an agentId field. Only used when action='register_agent'.",
      }),
    ),
    mcpServers: Type.Optional(
      Type.Any({
        description:
          "Optional record of MCP server entries to merge under config.mcp.servers. Each key is the server name; each value is its config. Only used when action='register_agent'.",
      }),
    ),
    overwrite: Type.Optional(
      Type.Boolean({
        description:
          "If true, replaces an existing agents.list entry with the same id (deep-merging nested objects). Defaults to false. Only used when action='register_agent'.",
      }),
    ),
    stampSetupCompleted: Type.Optional(
      Type.Boolean({
        description:
          "If true (default), also stamp setupCompletedAt into <workspaceDir>/.openclaw/workspace-state.json so the new employee is not bootstrap-pending on first boot. Only used when action='register_agent'.",
      }),
    ),
  },
  { additionalProperties: false },
);

type ManageToolParams = Static<typeof ManageToolSchema>;

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
    };
    const parts = [
      `${r.mode === "created" ? "Registered" : "Updated"} agent ${r.agentId} in openclaw.json`,
      r.model ? ` model=${r.model}` : "",
      ` workspace=${r.workspaceDir}`,
      ` agentDir=${r.agentDir}`,
      r.bindingsAdded > 0 ? ` bindings+=${r.bindingsAdded}` : "",
      r.mcpServersMerged > 0 ? ` mcp.servers+=${r.mcpServersMerged}` : "",
      r.setupCompletedStamped ? " (setupCompletedAt stamped)" : "",
    ];
    return parts.filter(Boolean).join("");
  }
  if (action === "stamp_setup" && result && typeof result === "object" && "workspaceDir" in result) {
    const r = result as { workspaceDir: string; stamped: boolean };
    return r.stamped
      ? `Stamped setupCompletedAt in ${r.workspaceDir}/.openclaw/workspace-state.json`
      : `Workspace at ${r.workspaceDir} was already marked setup-complete`;
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
        const rawBindings = (params ?? {}).bindings as unknown;
        const normalizedBindings: BindingEntry[] | undefined = Array.isArray(rawBindings)
          ? (rawBindings.filter(
              (b): b is BindingEntry =>
                typeof b === "object" && b !== null && typeof (b as { agentId?: unknown }).agentId === "string",
            ) as BindingEntry[])
          : undefined;
        const rawMcp = (params ?? {}).mcpServers as unknown;
        const normalizedMcp =
          rawMcp && typeof rawMcp === "object" && !Array.isArray(rawMcp)
            ? (rawMcp as Record<string, unknown>)
            : undefined;
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
          openclawHomeDir,
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
        "Create and register an employee end-to-end on the HOST filesystem AND in openclaw.json, entirely in-process. This is the ONLY correct way for Forge to deploy a new employee, because: (a) fs_write cannot write to /workspace/.openclaw/workspace/<agent>/... (sandbox mount is read-only in 'non-main' mode); (b) the agent-callable `gateway` tool only supports the fixed GATEWAY_ACTIONS enum (restart, config.get, config.schema.lookup, config.apply, config.patch, update.run) — it does NOT expose agents.create or agents.files.set; and (c) gateway.call('config.patch', ...) requires operator.admin scope, and OpenClaw hard-codes silent=false for scope upgrades, so an embedded agent has no way to approve its own pairing prompt and the call hangs forever with 'pairing required'. Actions: 'create_agent' creates the workspace root directory (idempotent, AUTO-stamps setupCompletedAt so the new agent is not bootstrap-pending) — call this FIRST; 'write' creates/overwrites any file in the workspace, including the eight native files (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) AND subfiles under skills/, ekg/, memory/users/; 'read' returns a file's content; 'delete' removes a file; 'list' enumerates files (optionally scoped by relDir); 'register_agent' registers the agent in openclaw.json (agents.list + optional bindings + optional mcp.servers, all in one atomic write) — use this INSTEAD OF gateway.call('config.patch', ...) to avoid the scope-upgrade pairing deadlock; 'stamp_setup' idempotently stamps setupCompletedAt in the workspace-state.json for an existing workspace. Standard deploy order: create_agent → write (each of the 8 native files + skills/* + ekg/*) → register_agent.",
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
            const rawBindings = params.bindings as unknown;
            const normalizedBindings: BindingEntry[] | undefined = Array.isArray(rawBindings)
              ? (rawBindings.filter(
                  (b): b is BindingEntry =>
                    typeof b === "object" && b !== null && typeof (b as { agentId?: unknown }).agentId === "string",
                ) as BindingEntry[])
              : undefined;
            const rawMcp = params.mcpServers as unknown;
            const normalizedMcp =
              rawMcp && typeof rawMcp === "object" && !Array.isArray(rawMcp)
                ? (rawMcp as Record<string, unknown>)
                : undefined;
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
              openclawHomeDir,
            });
            return {
              content: [{ type: "text", text: renderResultText("register_agent", result) }],
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
