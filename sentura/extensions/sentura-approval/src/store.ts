import fs from "node:fs";
import path from "node:path";
import type {
  ApprovalConfig,
  ApprovalPolicy,
  ApprovalQueryParams,
  ApprovalRequest,
  ApprovalStatus,
} from "./types.js";

const POLICIES_FILE = "policies.json";
const REQUESTS_INDEX_FILE = "requests-index.json";
const REQUESTS_LOG_PREFIX = "requests-";

/**
 * Two-tier storage:
 * - `policies.json` — array of ApprovalPolicy, fully read into memory.
 * - `requests-YYYY-MM-DD.jsonl` — append-only event log (one line per
 *   request creation OR decision update).
 * - `requests-index.json` — current snapshot of every request keyed by id,
 *   rebuilt by replaying the JSONL files. Kept on disk so the dashboard's
 *   "list pending" call doesn't have to re-scan logs every time.
 */
export class ApprovalStore {
  private readonly dataDir: string;
  private readonly retention: ApprovalConfig["retention"];
  private requestsIndex = new Map<string, ApprovalRequest>();
  private policies: ApprovalPolicy[] = [];
  private writeStream: fs.WriteStream | null = null;
  private currentLogFile = "";

  constructor(config: Pick<ApprovalConfig, "dataDir" | "retention">) {
    this.dataDir = config.dataDir;
    this.retention = config.retention;
  }

  async initialize(seedPolicies: ApprovalPolicy[]): Promise<void> {
    await fs.promises.mkdir(this.dataDir, { recursive: true });
    await this.loadPolicies(seedPolicies);
    await this.loadRequestsIndex();
    this.rotateIfNeeded();
  }

  // ---- Policies ----

  listPolicies(): ApprovalPolicy[] {
    return this.policies.slice();
  }

  async upsertPolicy(policy: ApprovalPolicy): Promise<void> {
    const idx = this.policies.findIndex((p) => p.id === policy.id);
    if (idx >= 0) this.policies[idx] = policy;
    else this.policies.push(policy);
    await this.persistPolicies();
  }

  async removePolicy(id: string): Promise<boolean> {
    const before = this.policies.length;
    this.policies = this.policies.filter((p) => p.id !== id);
    if (this.policies.length === before) return false;
    await this.persistPolicies();
    return true;
  }

  // ---- Requests ----

  async appendRequest(request: ApprovalRequest): Promise<void> {
    this.requestsIndex.set(request.id, request);
    await this.persistIndex();
    await this.appendLog({ kind: "create", request });
  }

  async updateStatus(
    id: string,
    patch: Partial<Pick<ApprovalRequest, "status" | "decisionReason" | "decidedAt" | "decidedByUserId">>,
  ): Promise<ApprovalRequest | null> {
    const existing = this.requestsIndex.get(id);
    if (!existing) return null;
    const updated: ApprovalRequest = { ...existing, ...patch };
    this.requestsIndex.set(id, updated);
    await this.persistIndex();
    await this.appendLog({ kind: "update", id, patch });
    return updated;
  }

  getRequest(id: string): ApprovalRequest | undefined {
    return this.requestsIndex.get(id);
  }

  query(params: ApprovalQueryParams): ApprovalRequest[] {
    const limit = params.limit ?? 100;
    const out: ApprovalRequest[] = [];
    // Iterate in insertion order, newest last — reverse so callers get
    // newest first.
    const all = Array.from(this.requestsIndex.values()).reverse();
    for (const r of all) {
      if (params.status && r.status !== params.status) continue;
      if (params.agentId && r.agentId !== params.agentId) continue;
      if (params.riskLevel && r.riskLevel !== params.riskLevel) continue;
      out.push(r);
      if (out.length >= limit) break;
    }
    return out;
  }

  /**
   * Mark every pending request whose `expiresAt` has passed as expired.
   * Returns the affected requests so the caller can apply the configured
   * onTimeout decision (handled outside the store to keep policy logic out
   * of persistence).
   */
  async sweepExpired(now = new Date()): Promise<ApprovalRequest[]> {
    const cutoff = now.toISOString();
    const expired: ApprovalRequest[] = [];
    for (const r of this.requestsIndex.values()) {
      if (r.status !== "pending") continue;
      if (!r.expiresAt) continue;
      if (r.expiresAt > cutoff) continue;
      const updated = await this.updateStatus(r.id, {
        status: "expired",
        decidedAt: cutoff,
        decisionReason: "Approval expired without a human response",
      });
      if (updated) expired.push(updated);
    }
    return expired;
  }

  async close(): Promise<void> {
    if (this.writeStream) {
      const stream = this.writeStream;
      this.writeStream = null;
      await new Promise<void>((resolve) => stream.end(() => resolve()));
    }
  }

  // ---- Internal: persistence ----

  private async loadPolicies(seedPolicies: ApprovalPolicy[]): Promise<void> {
    const file = path.join(this.dataDir, POLICIES_FILE);
    try {
      const raw = await fs.promises.readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as ApprovalPolicy[];
      this.policies = Array.isArray(parsed) ? parsed : [];
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "ENOENT") throw err;
      this.policies = seedPolicies.slice();
      await this.persistPolicies();
    }
  }

  private async persistPolicies(): Promise<void> {
    const file = path.join(this.dataDir, POLICIES_FILE);
    await fs.promises.writeFile(file, JSON.stringify(this.policies, null, 2) + "\n", "utf-8");
  }

  private async loadRequestsIndex(): Promise<void> {
    const file = path.join(this.dataDir, REQUESTS_INDEX_FILE);
    try {
      const raw = await fs.promises.readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as ApprovalRequest[];
      if (Array.isArray(parsed)) {
        this.requestsIndex = new Map(parsed.map((r) => [r.id, r]));
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "ENOENT") throw err;
      this.requestsIndex = new Map();
    }
  }

  private async persistIndex(): Promise<void> {
    const file = path.join(this.dataDir, REQUESTS_INDEX_FILE);
    const arr = Array.from(this.requestsIndex.values());
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
    return path.join(this.dataDir, `${REQUESTS_LOG_PREFIX}${date}.jsonl`);
  }

  private rotateIfNeeded(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retention.maxAgeDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    try {
      for (const file of fs.readdirSync(this.dataDir)) {
        if (!file.startsWith(REQUESTS_LOG_PREFIX) || !file.endsWith(".jsonl")) continue;
        const dateStr = file.slice(REQUESTS_LOG_PREFIX.length, REQUESTS_LOG_PREFIX.length + 10);
        if (dateStr < cutoffStr) {
          fs.unlinkSync(path.join(this.dataDir, file));
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }
}
