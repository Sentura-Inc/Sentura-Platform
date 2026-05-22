import type {
  CheckResult,
  CheckStrategy,
  McpHealthConfig,
  McpServerEntry,
  McpServerHealth,
  McpServerStatus,
} from "./types.js";

const EMPTY_HEALTH: Omit<McpServerHealth, "name"> = {
  status: "unknown",
  lastCheckAt: "1970-01-01T00:00:00.000Z",
  consecutiveErrors: 0,
  successCount: 0,
  errorCount: 0,
};

export interface ApplyResult {
  next: McpServerHealth;
  previousStatus: McpServerStatus;
  changed: boolean;
}

/**
 * Apply one CheckResult to the current health snapshot for a single server.
 * Pure function — separated from scheduling and I/O so tests can drive the
 * status-machine deterministically without spawning real MCP servers.
 */
export function applyCheck(
  current: McpServerHealth,
  result: CheckResult,
  config: Pick<McpHealthConfig, "degradedAfterErrors" | "downAfterErrors">,
  now: Date = new Date(),
): ApplyResult {
  const ts = now.toISOString();
  const previousStatus = current.status;

  if (result.ok) {
    const next: McpServerHealth = {
      ...current,
      status: "up",
      lastCheckAt: ts,
      latencyMs: result.latencyMs,
      toolCount: result.toolCount,
      consecutiveErrors: 0,
      successCount: current.successCount + 1,
      lastUpAt: ts,
      lastError: undefined,
    };
    return { next, previousStatus, changed: previousStatus !== "up" };
  }

  const consecutiveErrors = current.consecutiveErrors + 1;
  let nextStatus: McpServerStatus = current.status === "unknown" ? "unknown" : current.status;
  if (consecutiveErrors >= config.downAfterErrors) {
    nextStatus = "down";
  } else if (consecutiveErrors >= config.degradedAfterErrors) {
    nextStatus = "degraded";
  } else if (current.status === "unknown") {
    // First-ever check failed before we hit the degraded threshold.
    nextStatus = "degraded";
  }

  const next: McpServerHealth = {
    ...current,
    status: nextStatus,
    lastCheckAt: ts,
    consecutiveErrors,
    errorCount: current.errorCount + 1,
    lastError: result.error,
    lastDownAt: nextStatus === "down" ? ts : current.lastDownAt,
  };
  return { next, previousStatus, changed: previousStatus !== nextStatus };
}

export function emptyHealth(name: string): McpServerHealth {
  return { ...EMPTY_HEALTH, name };
}

/**
 * In-memory health table. Holds one McpServerHealth per server name and
 * coordinates a periodic timer that re-checks each server. The monitor is
 * orchestration-only — every effect (audit emit, persistence) is pushed
 * through callbacks supplied by the plugin entry.
 */
export class HealthMonitor {
  private readonly servers = new Map<string, McpServerEntry>();
  private readonly snapshots = new Map<string, McpServerHealth>();
  private readonly config: McpHealthConfig;
  private readonly check: CheckStrategy;
  private readonly onChange: (next: McpServerHealth, previous: McpServerStatus) => void;
  private readonly onCheck: (next: McpServerHealth) => void;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: {
    config: McpHealthConfig;
    check: CheckStrategy;
    onChange: (next: McpServerHealth, previous: McpServerStatus) => void;
    onCheck: (next: McpServerHealth) => void;
    initialServers?: readonly McpServerEntry[];
    initialSnapshots?: readonly McpServerHealth[];
  }) {
    this.config = opts.config;
    this.check = opts.check;
    this.onChange = opts.onChange;
    this.onCheck = opts.onCheck;
    for (const s of opts.initialSnapshots ?? []) this.snapshots.set(s.name, s);
    for (const s of opts.initialServers ?? []) this.upsertServer(s);
  }

  upsertServer(server: McpServerEntry): void {
    this.servers.set(server.name, server);
    if (!this.snapshots.has(server.name)) {
      this.snapshots.set(server.name, emptyHealth(server.name));
    }
  }

  removeServer(name: string): void {
    this.servers.delete(name);
    this.snapshots.delete(name);
  }

  list(): McpServerHealth[] {
    return Array.from(this.snapshots.values());
  }

  get(name: string): McpServerHealth | undefined {
    return this.snapshots.get(name);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Run a single round of checks across every registered server. Exposed
   * for tests and for the dashboard's "check now" button (gateway RPC).
   */
  async runOnce(): Promise<McpServerHealth[]> {
    const results: McpServerHealth[] = [];
    for (const server of this.servers.values()) {
      if (server.disabled) continue;
      const before = this.snapshots.get(server.name) ?? emptyHealth(server.name);
      let result: CheckResult;
      try {
        result = await this.check(server, this.config.checkTimeoutMs);
      } catch (err) {
        result = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      const { next, previousStatus, changed } = applyCheck(before, result, this.config);
      this.snapshots.set(server.name, next);
      results.push(next);
      this.onCheck(next);
      if (changed) this.onChange(next, previousStatus);
    }
    return results;
  }
}
