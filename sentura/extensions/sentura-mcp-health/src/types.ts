/**
 * MCP server health snapshot — surfaced to the dashboard via the
 * `sentura.mcp.health.list` gateway RPC and to agents via the
 * `sentura_mcp_health` tool.
 */
export type McpServerStatus = "up" | "degraded" | "down" | "unknown";

export interface McpServerHealth {
  /** Logical server name (matches the key under `mcp.servers` in openclaw.json). */
  name: string;
  status: McpServerStatus;
  lastCheckAt: string;
  /** Round-trip time of the most recent successful check, in ms. */
  latencyMs?: number;
  /** Tool count returned by the server's `tools/list` reply, if reachable. */
  toolCount?: number;
  /** Consecutive failures since the last successful check. Resets to 0 on `up`. */
  consecutiveErrors: number;
  /** Total successful checks since this monitor started. */
  successCount: number;
  /** Total failed checks since this monitor started. */
  errorCount: number;
  lastError?: string;
  lastUpAt?: string;
  lastDownAt?: string;
}

export interface McpHealthConfig {
  checkIntervalMs: number;
  checkTimeoutMs: number;
  degradedAfterErrors: number;
  downAfterErrors: number;
  emitAuditOnEveryCheck: boolean;
  stateFile: string;
}

export interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  toolCount?: number;
  error?: string;
}

/**
 * Strategy for performing a single health check on a server. The default
 * implementation spawns the MCP server's command and exchanges a `tools/list`
 * JSON-RPC message over stdio, but the monitor accepts an injectable checker
 * so tests can supply deterministic results.
 */
export type CheckStrategy = (server: McpServerEntry, timeoutMs: number) => Promise<CheckResult>;

/**
 * Subset of OpenClaw's MCP server config that the monitor cares about — the
 * shape OpenClaw normalises into `mcp.servers.<name>` (per the post-Round-16
 * convention recorded in docs/MEMORY.md).
 */
export interface McpServerEntry {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** SSE/HTTP transport servers — present, then `command` is missing. */
  url?: string;
  /** When true, the monitor skips this server entirely (manual override). */
  disabled?: boolean;
}
