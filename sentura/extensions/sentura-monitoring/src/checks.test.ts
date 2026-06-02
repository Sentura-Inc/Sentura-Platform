import { describe, expect, it } from "vitest";
import {
  buildSummary,
  checkEmployees,
  checkGateway,
  checkProviders,
  type AgentActivity,
  type AgentRegistry,
  type AgentTenancyRecord,
  type ProviderActivity,
} from "./checks.js";

describe("checkGateway", () => {
  it("computes uptime and memory", () => {
    const now = 1_700_000_100_000;
    const startedAt = 1_700_000_000_000;
    const result = checkGateway(now, startedAt, 50 * 1024 * 1024);
    expect(result.status).toBe("ok");
    expect(result.uptimeSeconds).toBe(100);
    expect(result.memoryRssMb).toBeCloseTo(50, 1);
    expect(result.startedAt).toBe(new Date(startedAt).toISOString());
  });
});

describe("checkEmployees", () => {
  const now = Date.parse("2026-04-27T10:05:00.000Z");

  function setup() {
    const registry: AgentRegistry[] = [
      { agentId: "ap-clerk", registered: true },
      { agentId: "cs-agent", registered: true },
      { agentId: "orphan", registered: true },
    ];
    const tenancy: AgentTenancyRecord[] = [
      { agentId: "ap-clerk", tenantId: "default", departmentId: "finance" },
      { agentId: "cs-agent", tenantId: "default", departmentId: "support" },
    ];
    const activity: AgentActivity[] = [
      { agentId: "ap-clerk", lastActivityAt: "2026-04-27T10:04:00.000Z", totalCalls: 5 },
      { agentId: "cs-agent", lastActivityAt: "2026-04-27T09:30:00.000Z", totalCalls: 1 },
    ];
    return { registry, tenancy, activity };
  }

  it("returns 'ok' status when all agents are registered", () => {
    const { registry, tenancy, activity } = setup();
    const result = checkEmployees(registry, tenancy, activity, 5, now);
    expect(result.status).toBe("ok");
    expect(result.count).toBe(3);
    expect(result.registered).toBe(3);
  });

  it("counts only agents active within the window", () => {
    const { registry, tenancy, activity } = setup();
    const result = checkEmployees(registry, tenancy, activity, 5, now);
    expect(result.active).toBe(1); // only ap-clerk in window
  });

  it("falls back to default tenancy for agents missing a record", () => {
    const { registry, tenancy, activity } = setup();
    const result = checkEmployees(registry, tenancy, activity, 5, now);
    const orphan = result.employees.find((e) => e.agentId === "orphan")!;
    expect(orphan.tenantId).toBe("default");
    expect(orphan.departmentId).toBeNull();
    expect(orphan.lastActivityAt).toBeNull();
    expect(orphan.totalCalls).toBe(0);
  });

  it("returns 'down' when no agents are registered", () => {
    const result = checkEmployees([], [], [], 5, now);
    expect(result.status).toBe("down");
    expect(result.count).toBe(0);
  });
});

describe("checkProviders", () => {
  const now = Date.parse("2026-04-27T10:05:00.000Z");

  it("flags providers within the window as 'ok'", () => {
    const activity: ProviderActivity[] = [
      {
        provider: "openai",
        modelCount: 2,
        lastActivityAt: "2026-04-27T10:03:00.000Z",
        recentCalls: 12,
      },
    ];
    const result = checkProviders(activity, 5, now);
    expect(result.status).toBe("ok");
    expect(result.providers[0].status).toBe("ok");
  });

  it("flags stale providers as 'degraded'", () => {
    const activity: ProviderActivity[] = [
      {
        provider: "anthropic",
        modelCount: 1,
        lastActivityAt: "2026-04-27T09:30:00.000Z",
        recentCalls: 0,
      },
    ];
    const result = checkProviders(activity, 5, now);
    expect(result.providers[0].status).toBe("degraded");
    expect(result.status).toBe("degraded");
  });

  it("flags providers with no activity as 'down'", () => {
    const activity: ProviderActivity[] = [
      { provider: "openai", modelCount: 0, lastActivityAt: null, recentCalls: 0 },
    ];
    const result = checkProviders(activity, 5, now);
    expect(result.providers[0].status).toBe("down");
    expect(result.status).toBe("down");
  });

  it("aggregates to 'degraded' when at least one provider is healthy", () => {
    const activity: ProviderActivity[] = [
      {
        provider: "openai",
        modelCount: 1,
        lastActivityAt: "2026-04-27T10:04:00.000Z",
        recentCalls: 5,
      },
      { provider: "anthropic", modelCount: 0, lastActivityAt: null, recentCalls: 0 },
    ];
    const result = checkProviders(activity, 5, now);
    expect(result.status).toBe("degraded");
  });

  it("returns 'ok' when no providers are tracked yet", () => {
    const result = checkProviders([], 5, now);
    expect(result.status).toBe("ok");
    expect(result.providers).toHaveLength(0);
  });
});

describe("buildSummary", () => {
  it("composes the full summary view", () => {
    const now = Date.parse("2026-04-27T10:05:00.000Z");
    const gateway = checkGateway(now, now - 60_000, 100 * 1024 * 1024);
    const employees = checkEmployees(
      [{ agentId: "ap", registered: true }],
      [{ agentId: "ap", tenantId: "default", departmentId: null }],
      [{ agentId: "ap", lastActivityAt: new Date(now).toISOString(), totalCalls: 1 }],
      5,
      now,
    );
    const providers = checkProviders([], 5, now);
    const summary = buildSummary(gateway, employees, providers, now);
    expect(summary.generatedAt).toBe(new Date(now).toISOString());
    expect(summary.gateway.uptimeSeconds).toBe(60);
    expect(summary.employees.count).toBe(1);
  });
});
