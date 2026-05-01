import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { getAuditRuntime } from "@sentura/audit";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import { HealthMonitor, emptyHealth } from "./src/monitor.js";
import type {
  CheckResult,
  CheckStrategy,
  McpHealthConfig,
  McpServerEntry,
  McpServerHealth,
} from "./src/types.js";

export { HealthMonitor, applyCheck, emptyHealth } from "./src/monitor.js";
export type {
  CheckResult,
  CheckStrategy,
  McpHealthConfig,
  McpServerEntry,
  McpServerHealth,
  McpServerStatus,
} from "./src/types.js";

interface SnapshotFile {
  schemaVersion: 1;
  writtenAt: string;
  servers: McpServerHealth[];
}

function resolveConfig(pluginConfig: Record<string, unknown>): McpHealthConfig {
  const raw = pluginConfig as Partial<McpHealthConfig>;
  return {
    checkIntervalMs: raw.checkIntervalMs ?? 60_000,
    checkTimeoutMs: raw.checkTimeoutMs ?? 5_000,
    degradedAfterErrors: raw.degradedAfterErrors ?? 3,
    downAfterErrors: raw.downAfterErrors ?? 5,
    emitAuditOnEveryCheck: raw.emitAuditOnEveryCheck ?? false,
    stateFile:
      raw.stateFile ?? path.join(resolveOpenClawDir(), "sentura-mcp-health", "health.json"),
  };
}

/**
 * Default health check — spawn the configured MCP server and ask it for
 * `tools/list` over stdio. Resolves with `{ ok: true, latencyMs, toolCount }`
 * on a well-formed reply, or `{ ok: false, error }` on timeout/spawn error.
 *
 * For SSE/HTTP transport servers (`url`-based), we fall back to a HEAD probe.
 */
export const defaultCheckStrategy: CheckStrategy = async (server, timeoutMs) => {
  if (server.url) {
    return checkHttpUrl(server.url, timeoutMs);
  }
  if (!server.command) {
    return { ok: false, error: "neither `command` nor `url` configured" };
  }
  return checkStdioServer(server, timeoutMs);
};

async function checkHttpUrl(url: string, timeoutMs: number): Promise<CheckResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    return {
      ok: res.ok,
      latencyMs: Date.now() - start,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkStdioServer(
  server: McpServerEntry,
  timeoutMs: number,
): Promise<CheckResult> {
  if (!server.command) {
    return { ok: false, error: "command is required for stdio servers" };
  }
  return new Promise((resolve) => {
    const start = Date.now();
    let resolved = false;
    let stdoutBuffer = "";
    const child = spawn(server.command!, server.args ?? [], {
      env: { ...process.env, ...(server.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const cleanup = (result: CheckResult) => {
      if (resolved) return;
      resolved = true;
      try {
        child.kill();
      } catch {
        // best-effort
      }
      resolve(result);
    };

    const timer = setTimeout(
      () => cleanup({ ok: false, error: `timeout after ${timeoutMs}ms` }),
      timeoutMs,
    );

    child.on("error", (err) => {
      clearTimeout(timer);
      cleanup({ ok: false, error: err.message });
    });

    let initializedSent = false;
    const initializedNotification = JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    const toolsList = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as {
            id?: number;
            result?: { tools?: unknown[]; protocolVersion?: string };
            error?: { message?: string };
          };

          // initialize reply (id=0) — send the required `initialized`
          // notification, THEN ask for tools/list. MCP servers (especially
          // strict ones) refuse `tools/list` until they've seen the
          // notification. Skipping it caused spurious `down` reports.
          if (msg.id === 0 && !initializedSent) {
            if (msg.error) {
              clearTimeout(timer);
              cleanup({ ok: false, error: msg.error.message ?? "initialize error" });
              return;
            }
            try {
              child.stdin?.write(initializedNotification + "\n");
              child.stdin?.write(toolsList + "\n");
              initializedSent = true;
            } catch (err) {
              clearTimeout(timer);
              cleanup({
                ok: false,
                error: err instanceof Error ? err.message : "failed to write tools/list",
              });
            }
            continue;
          }

          if (msg.id !== 1) continue;
          clearTimeout(timer);
          if (msg.error) {
            cleanup({ ok: false, error: msg.error.message ?? "tools/list error" });
            return;
          }
          const toolCount = Array.isArray(msg.result?.tools) ? msg.result!.tools!.length : 0;
          cleanup({ ok: true, latencyMs: Date.now() - start, toolCount });
          return;
        } catch {
          // Not valid JSON yet — keep buffering.
        }
      }
    });

    const initialize = JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "sentura-mcp-health", version: "0.1.0" },
      },
    });
    try {
      child.stdin?.write(initialize + "\n");
    } catch (err) {
      clearTimeout(timer);
      cleanup({
        ok: false,
        error: err instanceof Error ? err.message : "failed to write initialize",
      });
    }
  });
}

async function loadSnapshots(file: string): Promise<McpServerHealth[]> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as SnapshotFile | McpServerHealth[];
    if (Array.isArray(parsed)) return parsed;
    if (parsed.schemaVersion === 1 && Array.isArray(parsed.servers)) return parsed.servers;
    return [];
  } catch {
    return [];
  }
}

async function persistSnapshots(file: string, servers: McpServerHealth[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload: SnapshotFile = {
    schemaVersion: 1,
    writtenAt: new Date().toISOString(),
    servers,
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

/**
 * Pull the current MCP server config from OpenClaw's runtime config. The
 * loader stores them at `mcp.servers.<name>` (post-Round 16 — see
 * docs/MEMORY.md Current Ground Truth #5). The canonical read is
 * `api.runtime.config.loadConfig()`, mirroring the pattern in
 * `sentura-agents/src/register-agent.ts`.
 */
function readConfiguredServers(api: OpenClawPluginApi): McpServerEntry[] {
  type ConfigShape = {
    mcp?: { servers?: Record<string, Partial<McpServerEntry>> };
  };
  const runtime = api.runtime as unknown as {
    config?: { loadConfig?: () => unknown };
  };
  const cfg = (runtime.config?.loadConfig?.() ?? {}) as ConfigShape;
  const servers = cfg.mcp?.servers ?? {};
  return Object.entries(servers).map(([name, entry]) => ({
    name,
    command: entry?.command,
    args: entry?.args,
    env: entry?.env,
    url: entry?.url,
    disabled: entry?.disabled,
  }));
}

export default definePluginEntry({
  id: "sentura-mcp-health",
  name: "Sentura MCP Health",
  description:
    "Periodic MCP server health monitoring with status tracking and audit emit on transitions.",
  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig ?? {});
    let monitor: HealthMonitor | null = null;

    function emitChangeAudit(next: McpServerHealth, previous: string): void {
      // Lazy-resolve the audit runtime — extension load order is not
      // guaranteed, so resolving on every emit instead of caching avoids a
      // race where mcp-health loads before sentura-audit. Identical pattern
      // to sentura-provisioner ↔ sentura-approval.
      const audit = getAuditRuntime();
      if (!audit) return;
      void audit
        .emit(
          "mcp_health_change",
          {
            status: next.status,
            previousStatus: previous,
            latencyMs: next.latencyMs,
            errorCount: next.errorCount,
            lastError: next.lastError,
          },
          undefined,
          undefined,
          { mcpServer: next.name },
        )
        .catch((err) => api.logger.warn("[sentura-mcp-health] audit emit failed:", err));
    }

    function emitCheckAudit(next: McpServerHealth): void {
      if (!config.emitAuditOnEveryCheck) return;
      const audit = getAuditRuntime();
      if (!audit) return;
      void audit
        .emit(
          "mcp_health_check",
          {
            status: next.status,
            latencyMs: next.latencyMs,
            errorCount: next.errorCount,
            lastError: next.lastError,
          },
          undefined,
          undefined,
          { mcpServer: next.name },
        )
        .catch(() => {
          // best-effort
        });
    }

    async function start(): Promise<void> {
      const initialSnapshots = await loadSnapshots(config.stateFile);
      const initialServers = readConfiguredServers(api);
      monitor = new HealthMonitor({
        config,
        check: defaultCheckStrategy,
        initialServers,
        initialSnapshots,
        onChange: (next, prev) => {
          emitChangeAudit(next, prev);
          void persistSnapshots(config.stateFile, monitor?.list() ?? []);
        },
        onCheck: (next) => {
          emitCheckAudit(next);
        },
      });
      monitor.start();
      api.logger.info(
        `[sentura-mcp-health] watching ${initialServers.length} server(s); interval=${config.checkIntervalMs}ms`,
      );
    }

    // Start the monitor immediately during register() — mirroring the
    // `store.initialize()` pattern in `sentura-audit/index.ts`. The
    // `gateway_start` event does NOT fire reliably for every plugin runtime
    // (the gateway has multiple registration rounds: main gateway runtime +
    // embedded acpx runtime), so waiting on the event leaves the main
    // runtime's gateway-RPC handlers seeing `monitor === null` indefinitely.
    // OpenClaw guarantees the runtime config is loaded before plugin
    // register() runs, so loadConfig() is safe here.
    void start().catch((err) => {
      api.logger.error("[sentura-mcp-health] Failed to start monitor:", err);
    });

    api.on("gateway_stop", async () => {
      monitor?.stop();
      if (monitor) await persistSnapshots(config.stateFile, monitor.list());
      monitor = null;
      return {};
    });

    // -----------------------------------------------------------------
    // Dashboard / agent gateway RPCs
    // -----------------------------------------------------------------
    api.registerGatewayMethod("sentura.mcp.health.list", async ({ respond }) => {
      try {
        const servers = monitor?.list() ?? (await loadSnapshots(config.stateFile));
        respond(true, { servers, count: servers.length });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.mcp.health.get", async ({ params, respond }) => {
      try {
        const name = (params as { name?: string } | undefined)?.name;
        if (!name) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "name is required" });
          return;
        }
        const snapshot = monitor?.get(name);
        respond(true, snapshot ? { server: snapshot } : { server: null });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.mcp.health.checkNow", async ({ params, respond }) => {
      try {
        if (!monitor) {
          respond(false, undefined, {
            code: "NOT_READY",
            message: "Monitor not yet started. Wait for gateway_start.",
          });
          return;
        }
        const name = (params as { name?: string } | undefined)?.name;
        if (name) {
          const single = monitor.get(name) ?? emptyHealth(name);
          const all = await monitor.runOnce();
          respond(true, { server: all.find((s) => s.name === name) ?? single });
          return;
        }
        const servers = await monitor.runOnce();
        respond(true, { servers, count: servers.length });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // -----------------------------------------------------------------
    // Agent-callable tool — read-only view onto the health table.
    // -----------------------------------------------------------------
    api.registerTool(
      {
        name: "sentura_mcp_health",
        description:
          "Read the live MCP server health table. Returns status (up/degraded/down), latency, tool count, and recent errors per configured MCP server. Use before delegating a task to a server-backed capability.",
        parameters: {
          type: "object" as const,
          properties: {
            name: {
              type: "string",
              description:
                "Optional server name to filter to a single MCP server. When omitted, returns every configured server.",
            },
          },
        },
        async execute(args: Record<string, unknown>) {
          const name = typeof args.name === "string" ? args.name : undefined;
          if (!monitor) {
            const fallback = await loadSnapshots(config.stateFile);
            return JSON.stringify(
              name ? fallback.find((s) => s.name === name) ?? null : fallback,
              null,
              2,
            );
          }
          if (name) {
            return JSON.stringify(monitor.get(name) ?? null, null, 2);
          }
          return JSON.stringify(monitor.list(), null, 2);
        },
      } as Parameters<typeof api.registerTool>[0],
      { name: "sentura_mcp_health" },
    );

    api.logger.info("[sentura-mcp-health] Extension registered.");
  },
});
