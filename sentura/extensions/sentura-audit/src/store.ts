import fs from "node:fs";
import path from "node:path";
import type { AuditEntry, AuditConfig, AuditQueryParams } from "./types.js";

export class AuditStore {
  private readonly logDir: string;
  private readonly retention: AuditConfig["retention"];
  private writeStream: fs.WriteStream | null = null;
  private currentLogFile: string = "";

  constructor(config: Pick<AuditConfig, "logDir" | "retention">) {
    this.logDir = config.logDir;
    this.retention = config.retention;
  }

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.logDir, { recursive: true });
    this.rotateIfNeeded();
  }

  async append(entry: AuditEntry): Promise<void> {
    const logFile = this.getCurrentLogFile();

    if (logFile !== this.currentLogFile) {
      await this.closeStream();
      this.currentLogFile = logFile;
    }

    if (!this.writeStream) {
      this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: "a" });
    }

    const line = JSON.stringify(entry) + "\n";
    return new Promise((resolve, reject) => {
      this.writeStream!.write(line, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async query(params: AuditQueryParams): Promise<AuditEntry[]> {
    const files = await this.getLogFiles();
    const results: AuditEntry[] = [];
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    let skipped = 0;

    for (const file of files.reverse()) {
      if (results.length >= limit) break;

      const content = await fs.promises.readFile(file, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      for (const line of lines.reverse()) {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          if (!this.matchesQuery(entry, params)) continue;

          if (skipped < offset) {
            skipped++;
            continue;
          }

          results.push(entry);
          if (results.length >= limit) break;
        } catch {
          continue;
        }
      }
    }

    return results;
  }

  async close(): Promise<void> {
    await this.closeStream();
  }

  private matchesQuery(entry: AuditEntry, params: AuditQueryParams): boolean {
    if (params.eventType && entry.eventType !== params.eventType) return false;
    if (params.agentId && entry.agentId !== params.agentId) return false;
    if (params.severity && entry.severity !== params.severity) return false;
    if (params.startTime && entry.timestamp < params.startTime) return false;
    if (params.endTime && entry.timestamp > params.endTime) return false;
    if (params.dataTier && entry.dataTier !== params.dataTier) return false;
    if (params.tenantId && entry.metadata?.tenantId !== params.tenantId) return false;
    if (params.departmentId && entry.metadata?.departmentId !== params.departmentId) return false;
    if (params.userId && entry.metadata?.userId !== params.userId) return false;
    if (params.groupId && entry.metadata?.groupId !== params.groupId) return false;
    if (params.search) {
      const needle = params.search.toLowerCase();
      const haystack = (
        JSON.stringify(entry.details ?? {}) +
        " " +
        JSON.stringify(entry.metadata ?? {})
      ).toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }

  private getCurrentLogFile(): string {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(this.logDir, `audit-${date}.jsonl`);
  }

  private async getLogFiles(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.logDir);
      return entries
        .filter((f) => f.startsWith("audit-") && f.endsWith(".jsonl"))
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
        if (!file.startsWith("audit-") || !file.endsWith(".jsonl")) continue;
        const dateStr = file.slice(6, 16);
        if (dateStr < cutoffStr) {
          fs.unlinkSync(path.join(this.logDir, file));
        }
      }
    } catch {
      // Directory may not exist yet during first initialization
    }
  }
}
