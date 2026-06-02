#!/usr/bin/env tsx
/**
 * Week 4 Task 3 — sentura-cost extension tests.
 *
 * Pure-logic coverage of the cost-event aggregator + JSONL store
 * (round-trip through a temp dir). Does NOT spin up a gateway or fire
 * real `model.usage` events — the live wire-up is exercised in
 * `test-week4-health.ts` once the monitoring extension lands.
 *
 * Mirrors `aggregator.test.ts` so this can run via tsx without vitest.
 *
 * Usage:  npx tsx scripts/test-week4-cost.ts
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  aggregateByAgent,
  aggregateByDepartment,
  aggregateByModel,
  aggregateByTenant,
  aggregateByUser,
  summarize,
} from "../sentura/extensions/sentura-cost/src/aggregator.js";
import { CostStore } from "../sentura/extensions/sentura-cost/src/store.js";
import type { CostEvent } from "../sentura/extensions/sentura-cost/src/types.js";

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

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

function testAgentRollup(): void {
  console.log("\n[1] aggregateByAgent — sum + sort by cost desc");
  const events = [
    makeEvent({ agentId: "cheap", costUsd: 0.0001 }),
    makeEvent({ agentId: "expensive", costUsd: 1.0 }),
    makeEvent({ agentId: "medium", costUsd: 0.05 }),
  ];
  const buckets = aggregateByAgent(events);
  check(
    "sorted by totalCostUsd desc",
    buckets.map((b) => b.key).join(",") === "expensive,medium,cheap",
  );
}

function testDepartmentRollup(): void {
  console.log("\n[2] aggregateByDepartment — null becomes '(unassigned)'");
  const events = [
    makeEvent({ departmentId: "finance" }),
    makeEvent({ departmentId: "support" }),
    makeEvent({ departmentId: null }),
    makeEvent({ departmentId: "finance" }),
  ];
  const buckets = aggregateByDepartment(events);
  check("finance 2 calls", buckets.find((b) => b.key === "finance")?.totalCalls === 2);
  check("support 1 call", buckets.find((b) => b.key === "support")?.totalCalls === 1);
  check(
    "(unassigned) 1 call",
    buckets.find((b) => b.key === "(unassigned)")?.totalCalls === 1,
  );
}

function testTenantAndModelRollup(): void {
  console.log("\n[3] aggregateByTenant + aggregateByModel");
  const events = [
    makeEvent({ tenantId: "acme", provider: "openai", model: "gpt-5.4" }),
    makeEvent({ tenantId: "acme", provider: "anthropic", model: "sonnet-4.6" }),
    makeEvent({ tenantId: "default", provider: "openai", model: "gpt-5.4" }),
  ];
  const tenants = aggregateByTenant(events);
  check("acme 2 calls", tenants.find((b) => b.key === "acme")?.totalCalls === 2);
  check("default 1 call", tenants.find((b) => b.key === "default")?.totalCalls === 1);

  const models = aggregateByModel(events);
  check(
    "openai/gpt-5.4 2 calls",
    models.find((b) => b.key === "openai/gpt-5.4")?.totalCalls === 2,
  );
  check(
    "anthropic/sonnet-4.6 1 call",
    models.find((b) => b.key === "anthropic/sonnet-4.6")?.totalCalls === 1,
  );
}

function testUserRollup(): void {
  console.log("\n[4] aggregateByUser — empty token grouped under '(anonymous)'");
  const events = [
    makeEvent({ userToken: "alice-token" }),
    makeEvent({ userToken: "" }),
    makeEvent({ userToken: "alice-token" }),
  ];
  const buckets = aggregateByUser(events);
  check("alice 2 calls", buckets.find((b) => b.key === "alice-token")?.totalCalls === 2);
  check("(anonymous) 1 call", buckets.find((b) => b.key === "(anonymous)")?.totalCalls === 1);
}

function testUnpricedEvents(): void {
  console.log("\n[5] unpriced (costUsd: null) events isolated from totalCostUsd");
  const events = [
    makeEvent({ costUsd: 0.5 }),
    makeEvent({ costUsd: null }),
    makeEvent({ costUsd: null }),
    makeEvent({ costUsd: 0.25 }),
  ];
  const buckets = aggregateByAgent(events);
  const ap = buckets[0];
  check("totalCalls = 4", ap.totalCalls === 4);
  check("unpricedCalls = 2", ap.unpricedCalls === 2);
  check("totalCostUsd = 0.75", near(ap.totalCostUsd, 0.75));
}

function testSummary(): void {
  console.log("\n[6] summarize — full summary shape");
  const events = [
    makeEvent({ agentId: "ap-clerk", departmentId: "finance", costUsd: 0.5 }),
    makeEvent({ agentId: "cs-agent", departmentId: "support", costUsd: 0.3 }),
    makeEvent({ agentId: "cs-agent", departmentId: "support", costUsd: null }),
  ];
  const summary = summarize(events, { start: "2026-04-01", end: "2026-04-30" });
  check("totalCalls = 3", summary.totalCalls === 3);
  check("totalTokens = 450", summary.totalTokens === 450);
  check("totalCostUsd = 0.8", near(summary.totalCostUsd, 0.8));
  check("unpricedCalls = 1", summary.unpricedCalls === 1);
  check("byAgent has 2 buckets", summary.byAgent.length === 2);
  check("byDepartment has 2 buckets", summary.byDepartment.length === 2);
  check("byModel has 1 bucket", summary.byModel.length === 1);
  check("period.end preserved", summary.period.end === "2026-04-30");
}

async function testStoreRoundTrip(): Promise<void> {
  console.log("\n[7] CostStore — append, query, readRange round-trip");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sentura-cost-test-"));
  try {
    const store = new CostStore({ logDir: tmp, retention: { maxAgeDays: 365 } });
    await store.initialize();

    await store.append(
      makeEvent({ id: "evt_a", agentId: "ap-clerk", costUsd: 0.001, timestamp: "2026-04-27T09:00:00.000Z" }),
    );
    await store.append(
      makeEvent({ id: "evt_b", agentId: "cs-agent", costUsd: 0.002, timestamp: "2026-04-27T10:00:00.000Z" }),
    );
    await store.append(
      makeEvent({ id: "evt_c", agentId: "ap-clerk", costUsd: 0.003, timestamp: "2026-04-27T11:00:00.000Z" }),
    );
    await store.close();

    const all = await store.readRange();
    check("readRange returns 3 events", all.length === 3);
    check("totalCost via aggregator", near(aggregateByAgent(all).reduce((sum, b) => sum + b.totalCostUsd, 0), 0.006));

    const apOnly = await store.query({ agentId: "ap-clerk" });
    check("query by agentId returns 2 events", apOnly.length === 2);

    const limited = await store.query({ limit: 1 });
    check("query with limit=1 returns 1 event", limited.length === 1);

    const offset = await store.query({ limit: 1, offset: 1 });
    check("query with offset=1 returns the next event", offset.length === 1 && offset[0].id !== limited[0].id);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  console.log("Week 4 Task 3 — sentura-cost extension tests");

  testAgentRollup();
  testDepartmentRollup();
  testTenantAndModelRollup();
  testUserRollup();
  testUnpricedEvents();
  testSummary();
  await testStoreRoundTrip();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
