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
});
