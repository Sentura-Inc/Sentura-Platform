#!/usr/bin/env tsx
/**
 * Week 4 Task 5 — sentura-monitoring health-check tests.
 *
 * Pure-logic coverage of the four check helpers. Mirrors `checks.test.ts`
 * so this can run via tsx without vitest.
 *
 * Usage:  npx tsx scripts/test-week4-health.ts
 */

import {
  buildSummary,
  checkEmployees,
  checkGateway,
  checkProviders,
  type AgentActivity,
  type AgentRegistry,
  type AgentTenancyRecord,
  type ProviderActivity,
} from "../sentura/extensions/sentura-monitoring/src/checks.js";

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

function testGateway(): void {
  console.log("\n[1] checkGateway");
  const now = 1_700_000_100_000;
  const startedAt = 1_700_000_000_000;
  const result = checkGateway(now, startedAt, 50 * 1024 * 1024);
  check("status ok", result.status === "ok");
  check("uptimeSeconds = 100", result.uptimeSeconds === 100);
  check("memoryRssMb ≈ 50", Math.abs(result.memoryRssMb - 50) < 0.5);
  check(
    "startedAt iso matches",
    result.startedAt === new Date(startedAt).toISOString(),
  );
}

function testEmployees(): void {
  console.log("\n[2] checkEmployees");
  const now = Date.parse("2026-04-27T10:05:00.000Z");
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
  const result = checkEmployees(registry, tenancy, activity, 5, now);

  check("status ok", result.status === "ok");
  check("count = 3", result.count === 3);
  check("registered = 3", result.registered === 3);
  check("active = 1 (only ap-clerk in window)", result.active === 1);

  const orphan = result.employees.find((e) => e.agentId === "orphan")!;
  check("orphan tenantId defaults to 'default'", orphan.tenantId === "default");
  check("orphan departmentId null", orphan.departmentId === null);
  check("orphan lastActivityAt null", orphan.lastActivityAt === null);
  check("orphan totalCalls = 0", orphan.totalCalls === 0);

  const empty = checkEmployees([], [], [], 5, now);
  check("empty registry → status down", empty.status === "down");
}

function testProviders(): void {
  console.log("\n[3] checkProviders");
  const now = Date.parse("2026-04-27T10:05:00.000Z");

  const fresh: ProviderActivity[] = [
    {
      provider: "openai",
      modelCount: 2,
      lastActivityAt: "2026-04-27T10:03:00.000Z",
      recentCalls: 12,
    },
  ];
  check("recent provider → ok", checkProviders(fresh, 5, now).status === "ok");

  const stale: ProviderActivity[] = [
    {
      provider: "anthropic",
      modelCount: 1,
      lastActivityAt: "2026-04-27T09:30:00.000Z",
      recentCalls: 0,
    },
  ];
  check("stale provider → degraded", checkProviders(stale, 5, now).status === "degraded");

  const dead: ProviderActivity[] = [
    { provider: "openai", modelCount: 0, lastActivityAt: null, recentCalls: 0 },
  ];
  check("never-active provider → down", checkProviders(dead, 5, now).status === "down");

  const mixed: ProviderActivity[] = [
    {
      provider: "openai",
      modelCount: 1,
      lastActivityAt: "2026-04-27T10:04:00.000Z",
      recentCalls: 5,
    },
    { provider: "anthropic", modelCount: 0, lastActivityAt: null, recentCalls: 0 },
  ];
  check(
    "mixed (one ok + one down) → degraded",
    checkProviders(mixed, 5, now).status === "degraded",
  );

  check(
    "no providers → ok (no signal yet)",
    checkProviders([], 5, now).status === "ok",
  );
}

function testSummary(): void {
  console.log("\n[4] buildSummary");
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
  check("generatedAt is ISO", summary.generatedAt === new Date(now).toISOString());
  check("gateway.uptimeSeconds = 60", summary.gateway.uptimeSeconds === 60);
  check("employees.count = 1", summary.employees.count === 1);
  check("providers.status = ok", summary.providers.status === "ok");
}

function main(): void {
  console.log("Week 4 Task 5 — sentura-monitoring health-check tests");

  testGateway();
  testEmployees();
  testProviders();
  testSummary();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
