import fs from "node:fs";
import path from "node:path";
import type { ProvisioningQueryParams, ProvisioningRequest } from "./types.js";

const INDEX_FILE = "requests-index.json";
const LOG_PREFIX = "requests-";

/**
 * Mirror of the sentura-approval storage shape: an authoritative
 * `requests-index.json` snapshot for fast list/get plus a daily JSONL
 * append-only log for audit replay. The two-file split keeps dashboard
 * queries cheap while preserving a tamper-evident trail.
 */
export class ProvisioningStore {
  private readonly dataDir: string;
  private readonly retentionDays: number;
  private requests = new Map<string, ProvisioningRequest>();
  private writeStream: fs.WriteStream | null = null;
  private currentLogFile = "";

  constructor(params: { dataDir: string; retentionDays: number }) {
    this.dataDir = params.dataDir;
    this.retentionDays = params.retentionDays;
  }

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.dataDir, { recursive: true });
    await this.loadIndex();
    this.rotateIfNeeded();
  }

  list(params: ProvisioningQueryParams): ProvisioningRequest[] {
    const limit = params.limit ?? 100;
    const out: ProvisioningRequest[] = [];
    const all = Array.from(this.requests.values()).reverse();
    for (const r of all) {
      if (params.status && r.status !== params.status) continue;
      if (params.agentId && r.agentId !== params.agentId) continue;
      if (params.service && r.service !== params.service) continue;
      out.push(r);
      if (out.length >= limit) break;
    }
    return out;
  }

  get(id: string): ProvisioningRequest | undefined {
    return this.requests.get(id);
  }

  async append(request: ProvisioningRequest): Promise<void> {
    this.requests.set(request.id, request);
    await this.persistIndex();
    await this.appendLog({ kind: "create", request });
  }

  async update(
    id: string,
    patch: Partial<Omit<ProvisioningRequest, "id" | "requestedAt">>,
  ): Promise<ProvisioningRequest | null> {
    const existing = this.requests.get(id);
    if (!existing) return null;
    const updated: ProvisioningRequest = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.requests.set(id, updated);
    await this.persistIndex();
    await this.appendLog({ kind: "update", id, patch });
    return updated;
  }

  async close(): Promise<void> {
    if (this.writeStream) {
      const stream = this.writeStream;
      this.writeStream = null;
      await new Promise<void>((resolve) => stream.end(() => resolve()));
    }
  }

  private async loadIndex(): Promise<void> {
    const file = path.join(this.dataDir, INDEX_FILE);
    try {
      const raw = await fs.promises.readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as ProvisioningRequest[];
      if (Array.isArray(parsed)) {
        this.requests = new Map(parsed.map((r) => [r.id, r]));
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "ENOENT") throw err;
      this.requests = new Map();
    }
  }

  private async persistIndex(): Promise<void> {
    const file = path.join(this.dataDir, INDEX_FILE);
    const arr = Array.from(this.requests.values());
    await fs.promises.writeFile(file, JSON.stringify(arr, null, 2) + "\n", "utf-8");
  }

  private async appendLog(event: Record<string, unknown>): Promise<void> {
    const file = this.currentLogPath();
    if (file !== this.currentLogFile) {
      if (this.writeStream) {
        const stream = this.writeStream;
        this.writeStream = null;
        await new Promise<void>((resolve) => stream.end(() => resolve()));
      }
      this.currentLogFile = file;
    }
    if (!this.writeStream) {
      this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: "a" });
    }
    const stream = this.writeStream;
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n";
    await new Promise<void>((resolve, reject) => {
      stream.write(line, (err) => (err ? reject(err) : resolve()));
    });
  }

  private currentLogPath(): string {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(this.dataDir, `${LOG_PREFIX}${date}.jsonl`);
  }

  private rotateIfNeeded(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    try {
      for (const file of fs.readdirSync(this.dataDir)) {
        if (!file.startsWith(LOG_PREFIX) || !file.endsWith(".jsonl")) continue;
        const dateStr = file.slice(LOG_PREFIX.length, LOG_PREFIX.length + 10);
        if (dateStr < cutoffStr) {
          fs.unlinkSync(path.join(this.dataDir, file));
        }
      }
    } catch {
      // Directory may not exist yet — first-run safe.
    }
  }
}
