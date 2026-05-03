import { describe, expect, it } from "vitest";
import {
  aggregateByAgent,
  aggregateByDepartment,
  aggregateByModel,
  aggregateByTenant,
  aggregateByUser,
  summarize,
} from "./aggregator.js";
import type { CostEvent } from "./types.js";

function makeEvent(overrides: Partial<CostEvent> = {}): CostEvent {
  return {
    id: "evt_1",
    timestamp: "2026-04-27T10:00:00.000Z",
    agentId: "ap-clerk",
    sessionKey: "agent:ap-clerk:user:alice-token:s1",
    userToken: "alice-token",
    tenantId: "default",
    departmentId: "finance",
    provider: "openai",
    model: "gpt-5.4",
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    costUsd: 0.001,
    durationMs: 800,
    ...overrides,
  };
}

describe("aggregateByAgent", () => {
  it("groups events by agentId and sums totals", () => {
    const events = [
      makeEvent({ agentId: "ap-clerk", costUsd: 0.001 }),
      makeEvent({ agentId: "ap-clerk", costUsd: 0.002 }),
      makeEvent({ agentId: "cs-agent", costUsd: 0.003 }),
    ];
    const buckets = aggregateByAgent(events);
    const ap = buckets.find((b) => b.key === "ap-clerk")!;
    const cs = buckets.find((b) => b.key === "cs-agent")!;
    expect(ap.totalCalls).toBe(2);
    expect(ap.totalCostUsd).toBeCloseTo(0.003, 6);
    expect(cs.totalCalls).toBe(1);
    expect(cs.totalCostUsd).toBeCloseTo(0.003, 6);
  });

  it("sorts buckets by totalCostUsd descending", () => {
    const events = [
      makeEvent({ agentId: "cheap", costUsd: 0.0001 }),
      makeEvent({ agentId: "expensive", costUsd: 1.0 }),
      makeEvent({ agentId: "medium", costUsd: 0.05 }),
    ];
    const buckets = aggregateByAgent(events);
    expect(buckets.map((b) => b.key)).toEqual(["expensive", "medium", "cheap"]);
  });
});

describe("aggregateByDepartment", () => {
  it("groups by department and treats null as '(unassigned)'", () => {
    const events = [
      makeEvent({ departmentId: "finance" }),
      makeEvent({ departmentId: "support" }),
      makeEvent({ departmentId: null }),
      makeEvent({ departmentId: "finance" }),
    ];
    const buckets = aggregateByDepartment(events);
    expect(buckets.find((b) => b.key === "finance")!.totalCalls).toBe(2);
    expect(buckets.find((b) => b.key === "support")!.totalCalls).toBe(1);
    expect(buckets.find((b) => b.key === "(unassigned)")!.totalCalls).toBe(1);
  });
});

describe("aggregateByTenant", () => {
  it("groups by tenantId", () => {
    const events = [
      makeEvent({ tenantId: "default" }),
      makeEvent({ tenantId: "acme" }),
      makeEvent({ tenantId: "acme" }),
    ];
    const buckets = aggregateByTenant(events);
    expect(buckets.find((b) => b.key === "acme")!.totalCalls).toBe(2);
    expect(buckets.find((b) => b.key === "default")!.totalCalls).toBe(1);
  });
});

describe("aggregateByModel", () => {
  it("groups by provider/model", () => {
    const events = [
      makeEvent({ provider: "openai", model: "gpt-5.4" }),
      makeEvent({ provider: "anthropic", model: "sonnet-4.6" }),
      makeEvent({ provider: "openai", model: "gpt-5.4" }),
    ];
    const buckets = aggregateByModel(events);
    expect(buckets.find((b) => b.key === "openai/gpt-5.4")!.totalCalls).toBe(2);
    expect(buckets.find((b) => b.key === "anthropic/sonnet-4.6")!.totalCalls).toBe(1);
  });
});

describe("aggregateByUser", () => {
  it("groups by userToken", () => {
    const events = [
      makeEvent({ userToken: "alice-token" }),
      makeEvent({ userToken: "bob-token" }),
      makeEvent({ userToken: "alice-token" }),
    ];
    const buckets = aggregateByUser(events);
    expect(buckets.find((b) => b.key === "alice-token")!.totalCalls).toBe(2);
    expect(buckets.find((b) => b.key === "bob-token")!.totalCalls).toBe(1);
  });

  it("groups empty userToken under '(anonymous)'", () => {
    const events = [makeEvent({ userToken: "" })];
    const buckets = aggregateByUser(events);
    expect(buckets[0].key).toBe("(anonymous)");
  });
});

describe("unpriced events", () => {
  it("counts costUsd === null events separately and excludes them from totalCostUsd", () => {
    const events = [
      makeEvent({ costUsd: 0.5 }),
      makeEvent({ costUsd: null }),
      makeEvent({ costUsd: null }),
      makeEvent({ costUsd: 0.25 }),
    ];
    const buckets = aggregateByAgent(events);
    const ap = buckets[0];
    expect(ap.totalCalls).toBe(4);
    expect(ap.unpricedCalls).toBe(2);
    expect(ap.totalCostUsd).toBeCloseTo(0.75, 6);
  });
});

describe("summarize", () => {
  it("returns the full summary shape with all rollups", () => {
    const events = [
      makeEvent({ agentId: "ap-clerk", departmentId: "finance", costUsd: 0.5 }),
      makeEvent({ agentId: "cs-agent", departmentId: "support", costUsd: 0.3 }),
      makeEvent({ agentId: "cs-agent", departmentId: "support", costUsd: null }),
    ];
    const summary = summarize(events, { start: "2026-04-01", end: "2026-04-30" });
    expect(summary.totalCalls).toBe(3);
    expect(summary.totalTokens).toBe(450);
    expect(summary.totalCostUsd).toBeCloseTo(0.8, 6);
    expect(summary.unpricedCalls).toBe(1);
    expect(summary.byAgent).toHaveLength(2);
    expect(summary.byDepartment).toHaveLength(2);
    expect(summary.byModel).toHaveLength(1);
    expect(summary.period.end).toBe("2026-04-30");
  });
});

describe("isolation by department (cross-department attribution)", () => {
  it("two agents in different departments produce disjoint cost rollups", () => {
    const events = [
      makeEvent({ agentId: "ap-clerk", departmentId: "finance", costUsd: 1.0 }),
      makeEvent({ agentId: "cs-agent", departmentId: "support", costUsd: 2.0 }),
      makeEvent({ agentId: "ap-clerk", departmentId: "finance", costUsd: 0.5 }),
    ];
    const byDept = aggregateByDepartment(events);
    const finance = byDept.find((b) => b.key === "finance")!;
    const support = byDept.find((b) => b.key === "support")!;
    expect(finance.totalCostUsd).toBeCloseTo(1.5, 6);
    expect(support.totalCostUsd).toBeCloseTo(2.0, 6);
    // Sorted: support is more expensive, comes first
    expect(byDept[0].key).toBe("support");
  });
});
