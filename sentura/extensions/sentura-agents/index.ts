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
      ],
      {
        description:
          "Operation: 'create_agent' creates the agent workspace directory (idempotent); 'write' creates/overwrites a file (either a native top-level workspace file like AGENTS.md OR a subfile under skills/, ekg/, memory/users/); 'read' returns a file's content; 'delete' removes a file; 'list' enumerates files under the workspace (optionally scoped by relDir).",
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
  },
  { additionalProperties: false },
);

type ManageToolParams = Static<typeof ManageToolSchema>;

function renderResultText(action: string, result: unknown): string {
  if (action === "create_agent" && result && typeof result === "object" && "workspaceDir" in result) {
    const r = result as { agentId: string; workspaceDir: string; created: boolean };
    return r.created
      ? `Created workspace for ${r.agentId} at ${r.workspaceDir}`
      : `Workspace for ${r.agentId} already exists at ${r.workspaceDir}`;
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
        "Create an employee workspace and materialize its files on the HOST filesystem. This is the ONLY correct way for Forge to deploy a new employee: fs_write cannot write to /workspace/.openclaw/workspace/<agent>/... (sandbox mount is read-only in 'non-main' mode), and the agent-callable `gateway` tool does NOT expose agents.create or agents.files.set (it only supports the fixed GATEWAY_ACTIONS enum: restart, config.get, config.schema.lookup, config.apply, config.patch, update.run). Actions: 'create_agent' creates the workspace root directory (idempotent — call this FIRST); 'write' creates/overwrites any file in the workspace, including the eight native files (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) AND subfiles under skills/, ekg/, memory/users/; 'read' returns a file's content; 'delete' removes a file; 'list' enumerates files (optionally scoped by relDir). After using this tool to create the workspace + files, register the agent in openclaw.json via gateway.call('config.patch', { path: 'agents.list', ... }).",
      parameters: ManageToolSchema,
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as ManageToolParams;
        const action = params.action;
        try {
          if (action === "create_agent") {
            const result = await createAgentWorkspace(params.agentId, opts);
            return {
              content: [{ type: "text", text: renderResultText("create_agent", result) }],
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
