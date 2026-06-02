/**
 * Cached read of `~/.openclaw/sentura-rbac/agent-tenancy.json`.
 *
 * Cost capture is hot — `model.usage` fires once per LLM call, and
 * re-parsing the tenancy file on every event would be wasteful. We cache
 * the parsed table in-memory and refresh it whenever the file's mtime
 * changes (or every 30s as a safety net for cloud filesystems where mtime
 * can be unreliable).
 */

import fs from "node:fs";
import path from "node:path";

interface AgentTenancy {
  agentId: string;
  tenantId: string;
  departmentId: string | null;
}

interface TenancyResolution {
  tenantId: string;
  departmentId: string | null;
}

const DEFAULT_TENANCY: TenancyResolution = { tenantId: "default", departmentId: null };
const REFRESH_INTERVAL_MS = 30_000;

export class TenancyResolver {
  private readonly filePath: string;
  private cache: Map<string, TenancyResolution> = new Map();
  private lastMtimeMs = -1;
  private lastRefreshAt = 0;

  constructor(rbacDataDir: string) {
    this.filePath = path.join(rbacDataDir, "agent-tenancy.json");
  }

  resolve(agentId: string): TenancyResolution {
    this.refreshIfStale();
    return this.cache.get(agentId) ?? DEFAULT_TENANCY;
  }

  /** Forces a re-read; mostly useful for tests. */
  invalidate(): void {
    this.lastMtimeMs = -1;
    this.lastRefreshAt = 0;
    this.cache.clear();
  }

  private refreshIfStale(): void {
    const now = Date.now();
    if (now - this.lastRefreshAt < REFRESH_INTERVAL_MS && this.lastMtimeMs >= 0) {
      // mtime check only kicks in once we've already loaded once
      let stat: fs.Stats | null = null;
      try {
        stat = fs.statSync(this.filePath);
      } catch {
        // file missing — keep current cache (empty)
        return;
      }
      if (stat.mtimeMs === this.lastMtimeMs) return;
    }

    try {
      const stat = fs.statSync(this.filePath);
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const records = JSON.parse(raw) as AgentTenancy[];
      const next = new Map<string, TenancyResolution>();
      for (const r of records) {
        if (r && typeof r.agentId === "string") {
          next.set(r.agentId, {
            tenantId: r.tenantId ?? "default",
            departmentId: r.departmentId ?? null,
          });
        }
      }
      this.cache = next;
      this.lastMtimeMs = stat.mtimeMs;
    } catch {
      // file missing or malformed — leave the cache as-is so we keep
      // serving the last known good state.
    }
    this.lastRefreshAt = now;
  }
}
