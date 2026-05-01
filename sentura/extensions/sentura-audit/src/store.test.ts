import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuditStore } from "./store.js";
import type { AuditEntry } from "./types.js";

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    eventType: "tool_call",
    severity: "info",
    dataTier: "T1",
    details: { toolName: "test_tool" },
    ...overrides,
  };
}

describe("AuditStore", () => {
  let tmpDir: string;
  let store: AuditStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sentura-audit-test-"));
    store = new AuditStore({ logDir: tmpDir, retention: { maxAgeDays: 90, maxSizeMb: 500 } });
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("appends and queries entries", async () => {
    const entry = makeEntry({ agentId: "agent-1" });
    await store.append(entry);

    const results = await store.query({});
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(entry.id);
    expect(results[0].agentId).toBe("agent-1");
  });

  it("filters by eventType", async () => {
    await store.append(makeEntry({ eventType: "tool_call" }));
    await store.append(makeEntry({ eventType: "session_start" }));
    await store.append(makeEntry({ eventType: "tool_call" }));

    const toolCalls = await store.query({ eventType: "tool_call" });
    expect(toolCalls.length).toBe(2);

    const sessions = await store.query({ eventType: "session_start" });
    expect(sessions.length).toBe(1);
  });

  it("filters by agentId", async () => {
    await store.append(makeEntry({ agentId: "agent-a" }));
    await store.append(makeEntry({ agentId: "agent-b" }));
    await store.append(makeEntry({ agentId: "agent-a" }));

    const results = await store.query({ agentId: "agent-a" });
    expect(results.length).toBe(2);
  });

  it("filters by severity", async () => {
    await store.append(makeEntry({ severity: "info" }));
    await store.append(makeEntry({ severity: "warning" }));
    await store.append(makeEntry({ severity: "error" }));

    const warnings = await store.query({ severity: "warning" });
    expect(warnings.length).toBe(1);
    expect(warnings[0].severity).toBe("warning");
  });

  it("filters by time range", async () => {
    const old = makeEntry({ timestamp: "2025-01-01T00:00:00.000Z" });
    const recent = makeEntry({ timestamp: new Date().toISOString() });

    await store.append(old);
    await store.append(recent);

    const results = await store.query({ startTime: "2026-01-01T00:00:00.000Z" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(recent.id);
  });

  it("respects limit", async () => {
    for (let i = 0; i < 10; i++) {
      await store.append(makeEntry());
    }

    const results = await store.query({ limit: 3 });
    expect(results.length).toBe(3);
  });

  it("creates log directory if missing", async () => {
    const nested = path.join(tmpDir, "nested", "deep");
    const nestedStore = new AuditStore({
      logDir: nested,
      retention: { maxAgeDays: 90, maxSizeMb: 500 },
    });
    await nestedStore.initialize();
    await nestedStore.append(makeEntry());

    const results = await nestedStore.query({});
    expect(results.length).toBe(1);
    await nestedStore.close();
  });

  // -----------------------------------------------------------------
  // Week 4 Person D — multi-tenancy + data-tier filters
  // -----------------------------------------------------------------

  it("filters by tenantId", async () => {
    await store.append(makeEntry({ metadata: { tenantId: "acme" } }));
    await store.append(makeEntry({ metadata: { tenantId: "globex" } }));
    await store.append(makeEntry({ metadata: { tenantId: "acme" } }));

    const acme = await store.query({ tenantId: "acme" });
    expect(acme.length).toBe(2);
    expect(acme.every((e) => e.metadata?.tenantId === "acme")).toBe(true);
  });

  it("filters by departmentId", async () => {
    await store.append(makeEntry({ metadata: { tenantId: "acme", departmentId: "support" } }));
    await store.append(makeEntry({ metadata: { tenantId: "acme", departmentId: "finance" } }));

    const support = await store.query({ departmentId: "support" });
    expect(support.length).toBe(1);
    expect(support[0].metadata?.departmentId).toBe("support");
  });

  it("filters by userId and groupId", async () => {
    await store.append(
      makeEntry({
        eventType: "chat_message",
        metadata: { userId: "u_001", groupId: "grp_a" },
      }),
    );
    await store.append(
      makeEntry({
        eventType: "chat_message",
        metadata: { userId: "u_002", groupId: "grp_a" },
      }),
    );
    await store.append(
      makeEntry({
        eventType: "chat_message",
        metadata: { userId: "u_001", groupId: "grp_b" },
      }),
    );

    expect((await store.query({ userId: "u_001" })).length).toBe(2);
    expect((await store.query({ groupId: "grp_a" })).length).toBe(2);
    expect((await store.query({ userId: "u_001", groupId: "grp_a" })).length).toBe(1);
  });

  it("filters by dataTier", async () => {
    await store.append(makeEntry({ dataTier: "T0" }));
    await store.append(makeEntry({ dataTier: "T2" }));
    await store.append(makeEntry({ dataTier: "T4" }));

    const t4 = await store.query({ dataTier: "T4" });
    expect(t4.length).toBe(1);
    expect(t4[0].dataTier).toBe("T4");
  });

  it("filters by free-text search across details and metadata", async () => {
    await store.append(makeEntry({ details: { toolName: "browser_navigate" } }));
    await store.append(makeEntry({ details: { toolName: "fs_read" } }));
    await store.append(
      makeEntry({
        details: { toolName: "fs_read" },
        metadata: { mcpServer: "filesystem-shared" },
      }),
    );

    const browserHits = await store.query({ search: "browser" });
    expect(browserHits.length).toBe(1);

    const sharedHits = await store.query({ search: "shared" });
    expect(sharedHits.length).toBe(1);
    expect(sharedHits[0].metadata?.mcpServer).toBe("filesystem-shared");
  });

  it("supports composite filters (tenant + tier + eventType)", async () => {
    await store.append(
      makeEntry({
        eventType: "approval_requested",
        dataTier: "T3",
        metadata: { tenantId: "acme" },
      }),
    );
    await store.append(
      makeEntry({
        eventType: "approval_requested",
        dataTier: "T2",
        metadata: { tenantId: "acme" },
      }),
    );
    await store.append(
      makeEntry({
        eventType: "tool_call",
        dataTier: "T3",
        metadata: { tenantId: "acme" },
      }),
    );
    await store.append(
      makeEntry({
        eventType: "approval_requested",
        dataTier: "T3",
        metadata: { tenantId: "globex" },
      }),
    );

    const result = await store.query({
      tenantId: "acme",
      dataTier: "T3",
      eventType: "approval_requested",
    });
    expect(result.length).toBe(1);
    expect(result[0].metadata?.tenantId).toBe("acme");
    expect(result[0].dataTier).toBe("T3");
    expect(result[0].eventType).toBe("approval_requested");
  });
});
