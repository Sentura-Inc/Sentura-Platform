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
import { collectSessionLogCostEvents } from "../sentura/extensions/sentura-cost/src/session-log-backfill.js";
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

async function testSessionLogBackfill(): Promise<void> {
  console.log("\n[8] session-log backfill — real OpenClaw usage rows become cost events");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sentura-cost-backfill-test-"));
  try {
    const sessionsDir = path.join(tmp, "agents/cbe-lead-discovery/sessions");
    const sessionFile = path.join(sessionsDir, "session-1.jsonl");
    const sessionKey = "agent:cbe-lead-discovery:dashboard:test-session";
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        [sessionKey]: {
          sessionId: "session-1",
          sessionFile,
          modelProvider: "openai",
          model: "gpt-5.5",
          runtimeMs: 1234,
        },
      }),
    );
    await fs.writeFile(
      sessionFile,
      [
        JSON.stringify({
          type: "session",
          id: "session-1",
          timestamp: "2026-06-15T13:00:00.000Z",
        }),
        JSON.stringify({
          type: "message",
          id: "assistant-usage-1",
          timestamp: "2026-06-15T13:00:05.000Z",
          message: { role: "assistant", content: "done" },
          provider: "openai",
          model: "gpt-5.5",
          usage: {
            input: 1000,
            output: 200,
            cacheRead: 500,
            cacheWrite: 0,
            totalTokens: 1700,
            cost: { input: 0.005, output: 0.006, cacheRead: 0.00025, total: 0.01125 },
          },
        }),
      ].join("\n"),
    );

    const events = await collectSessionLogCostEvents({
      openClawDir: tmp,
      defaultDashboardUserToken: "employee-token",
    });
    check("one usage event collected", events.length === 1);
    check("dashboard CBE session attributed to employee token", events[0]?.userToken === "employee-token");
    check("costUsd from usage.cost.total", near(events[0]?.costUsd ?? 0, 0.01125));
    check("token totals preserved", events[0]?.usage.totalTokens === 1700);
    check("source marked session_log", events[0]?.source === "session_log");
    check("stable id prefix", events[0]?.id.startsWith("sessionlog_") === true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function testExternalToolLogBackfill(): Promise<void> {
  console.log("\n[9] external tool-log backfill — public/free/unpriced API calls become cost rows");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sentura-cost-external-test-"));
  try {
    const sessionsDir = path.join(tmp, "agents/cbe-buyer-screening/sessions");
    const sessionFile = path.join(sessionsDir, "session-2.jsonl");
    const sessionKey = "agent:cbe-buyer-screening:user:employee-token:s2";
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        [sessionKey]: {
          sessionId: "session-2",
          sessionFile,
          modelProvider: "openai",
          model: "gpt-5.5",
          runtimeMs: 2345,
        },
      }),
    );
    await fs.writeFile(
      sessionFile,
      [
        JSON.stringify({ type: "session", id: "session-2", timestamp: "2026-06-16T00:00:00.000Z" }),
        JSON.stringify({
          type: "message",
          id: "assistant-tool-calls",
          timestamp: "2026-06-16T00:00:01.000Z",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "call-trade",
                name: "cross-border-intel__cbe_intel_trade_record_search",
                arguments: { company_name: "MOBO", source: "auto", max_paid_spend_usd: 9 },
              },
              {
                type: "toolCall",
                id: "call-email",
                name: "cross-border-intel__cbe_intel_email_domain_check",
                arguments: { email: "buyer@example.com", enable_paid_validation: true },
              },
            ],
          },
          provider: "openai",
          model: "gpt-5.5",
          usage: {
            input: 10,
            output: 20,
            totalTokens: 30,
            cost: { total: 0.0003 },
          },
        }),
        JSON.stringify({
          type: "message",
          id: "tool-trade",
          timestamp: "2026-06-16T00:00:02.000Z",
          message: {
            role: "toolResult",
            toolCallId: "call-trade",
            toolName: "cross-border-intel__cbe_intel_trade_record_search",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "found",
                  provider: "importyeti",
                  endpoint: "GET /v1.0/company/search",
                  http_status: 200,
                  records: { requestCost: 0, creditsRemaining: 100, data: [] },
                }),
              },
            ],
          },
        }),
        JSON.stringify({
          type: "message",
          id: "tool-email",
          timestamp: "2026-06-16T00:00:03.000Z",
          message: {
            role: "toolResult",
            toolCallId: "call-email",
            toolName: "cross-border-intel__cbe_intel_email_domain_check",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "checked",
                  paid_validation: {
                    providers: [
                      { provider: "abstract", http_status: 200, result: {} },
                      { provider: "hunter", http_status: 200, result: {} },
                    ],
                  },
                }),
              },
            ],
          },
        }),
      ].join("\n"),
    );

    const events = await collectSessionLogCostEvents({ openClawDir: tmp });
    const external = events.filter((event) => event.source === "external_tool_log");
    const importYeti = external.find((event) => event.service === "ImportYeti");
    const abstract = external.find((event) => event.service === "Abstract Email Reputation");
    const hunter = external.find((event) => event.service === "Hunter Email Verifier");
    const dns = external.find((event) => event.service === "DNS MX/SPF/DMARC");

    check("external tool rows collected", external.length === 4);
    check("ImportYeti requestCost=0 is recorded as included zero spend", importYeti?.pricingStatus === "included" && importYeti.costUsd === 0);
    check("Abstract request is visible but not falsely converted to USD", abstract?.pricingStatus === "unpriced" && abstract.costUsd === null);
    check("Hunter verifier credit usage is visible", hunter?.externalUsage?.unit === "credit" && hunter.externalUsage.quantity === 0.5);
    check("DNS check is recorded as free public infrastructure", dns?.pricingStatus === "free" && dns.costUsd === 0);
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
  await testSessionLogBackfill();
  await testExternalToolLogBackfill();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
