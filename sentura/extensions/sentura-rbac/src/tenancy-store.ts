import fs from "node:fs/promises";
import path from "node:path";
import type { AgentTenancy } from "./types.js";

export const DEFAULT_TENANT_ID = "default";

export class TenancyStore {
  private dataDir: string;
  private records: Map<string, AgentTenancy> = new Map();
  private loaded = false;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.load();
    this.loaded = true;
  }

  async get(agentId: string): Promise<AgentTenancy | undefined> {
    await this.ensureLoaded();
    return this.records.get(agentId);
  }

  async list(): Promise<AgentTenancy[]> {
    await this.ensureLoaded();
    return Array.from(this.records.values());
  }

  async listByTenant(tenantId: string): Promise<AgentTenancy[]> {
    await this.ensureLoaded();
    return Array.from(this.records.values()).filter((r) => r.tenantId === tenantId);
  }

  async listByDepartment(departmentId: string): Promise<AgentTenancy[]> {
    await this.ensureLoaded();
    return Array.from(this.records.values()).filter((r) => r.departmentId === departmentId);
  }

  /**
   * Idempotent upsert. If the requested record matches what's already on
   * disk byte-for-byte (modulo `updatedAt`), no write happens — keeps the
   * setup-script "default tenancy" step quiet on re-runs.
   */
  async set(input: Omit<AgentTenancy, "updatedAt">): Promise<AgentTenancy> {
    await this.ensureLoaded();
    const existing = this.records.get(input.agentId);
    if (
      existing &&
      existing.tenantId === input.tenantId &&
      existing.departmentId === input.departmentId
    ) {
      return existing;
    }
    const record: AgentTenancy = {
      agentId: input.agentId,
      tenantId: input.tenantId,
      departmentId: input.departmentId,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(record.agentId, record);
    await this.persist();
    return record;
  }

  async delete(agentId: string): Promise<boolean> {
    await this.ensureLoaded();
    const existed = this.records.delete(agentId);
    if (existed) await this.persist();
    return existed;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.initialize();
  }

  private filePath(): string {
    return path.join(this.dataDir, "agent-tenancy.json");
  }

  private async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath(), "utf-8");
      const arr = JSON.parse(raw) as AgentTenancy[];
      this.records = new Map(arr.map((r) => [r.agentId, r]));
    } catch {
      this.records = new Map();
    }
  }

  private async persist(): Promise<void> {
    const arr = Array.from(this.records.values()).sort((a, b) => a.agentId.localeCompare(b.agentId));
    await fs.writeFile(this.filePath(), JSON.stringify(arr, null, 2), "utf-8");
  }
}
