/**
 * Rolling JSONL store for cost events.
 *
 * Mirrors the `sentura-audit/src/store.ts` pattern: one file per day under
 * `<logDir>/cost-YYYY-MM-DD.jsonl`, append-only, retention-pruned on
 * initialize. The `query()` method reads files in reverse chronological
 * order so the dashboard's "most recent first" view loads quickly.
 */

import fs from "node:fs";
import path from "node:path";
import type { CostConfig, CostEvent, CostQueryParams } from "./types.js";

export class CostStore {
  private readonly logDir: string;
  private readonly retention: CostConfig["retention"];
  private writeStream: fs.WriteStream | null = null;
  private currentLogFile = "";

  constructor(config: Pick<CostConfig, "logDir" | "retention">) {
    this.logDir = config.logDir;
    this.retention = config.retention;
  }

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.logDir, { recursive: true });
    this.rotateIfNeeded();
  }

  async append(event: CostEvent): Promise<void> {
    const logFile = this.getCurrentLogFile();
    if (logFile !== this.currentLogFile) {
      await this.closeStream();
      this.currentLogFile = logFile;
    }
    if (!this.writeStream) {
      this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: "a" });
    }
    const line = JSON.stringify(event) + "\n";
    return new Promise((resolve, reject) => {
      this.writeStream!.write(line, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async query(params: CostQueryParams): Promise<CostEvent[]> {
    const files = await this.getLogFiles();
    const results: CostEvent[] = [];
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    let skipped = 0;

    for (const file of files.reverse()) {
      if (results.length >= limit) break;
      const content = await fs.promises.readFile(file, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      for (const line of lines.reverse()) {
        try {
          const event = JSON.parse(line) as CostEvent;
          if (!this.matchesQuery(event, params)) continue;
          if (skipped < offset) {
            skipped++;
            continue;
          }
          results.push(event);
          if (results.length >= limit) break;
        } catch {
          continue;
        }
      }
    }
    return results;
  }

  /**
   * Read every event in the configured period. Used by the
   * `sentura.cost.summary` RPC where pagination doesn't apply (we need
   * the whole range to compute totals).
   */
  async readRange(start?: string, end?: string): Promise<CostEvent[]> {
    const files = await this.getLogFiles();
    const out: CostEvent[] = [];
    for (const file of files) {
      const content = await fs.promises.readFile(file, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as CostEvent;
          if (start && event.timestamp < start) continue;
          if (end && event.timestamp > end) continue;
          out.push(event);
        } catch {
          continue;
        }
      }
    }
    return out;
  }

  async close(): Promise<void> {
    await this.closeStream();
  }

  private matchesQuery(event: CostEvent, params: CostQueryParams): boolean {
    if (params.agentId && event.agentId !== params.agentId) return false;
    if (params.tenantId && event.tenantId !== params.tenantId) return false;
    if (params.departmentId && event.departmentId !== params.departmentId) return false;
    if (params.userToken !== undefined && event.userToken !== params.userToken) return false;
    if (params.model && event.model !== params.model) return false;
    if (params.provider && event.provider !== params.provider) return false;
    if (params.startTime && event.timestamp < params.startTime) return false;
    if (params.endTime && event.timestamp > params.endTime) return false;
    return true;
  }

  private getCurrentLogFile(): string {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(this.logDir, `cost-${date}.jsonl`);
  }

  private async getLogFiles(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.logDir);
      return entries
        .filter((f) => f.startsWith("cost-") && f.endsWith(".jsonl"))
        .sort()
        .map((f) => path.join(this.logDir, f));
    } catch {
      return [];
    }
  }

  private async closeStream(): Promise<void> {
    if (this.writeStream) {
      const stream = this.writeStream;
      this.writeStream = null;
      return new Promise((resolve) => {
        stream.end(() => resolve());
      });
    }
  }

  private rotateIfNeeded(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retention.maxAgeDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    try {
      const entries = fs.readdirSync(this.logDir);
      for (const file of entries) {
        if (!file.startsWith("cost-") || !file.endsWith(".jsonl")) continue;
        const dateStr = file.slice(5, 15);
        if (dateStr < cutoffStr) {
          fs.unlinkSync(path.join(this.logDir, file));
        }
      }
    } catch {
      // dir not yet created
    }
  }
}
