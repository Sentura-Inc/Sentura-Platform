#!/usr/bin/env tsx
/**
 * Week 4 Task 2 — sentura-memory-lancedb partition logic tests.
 *
 * Pure-logic coverage of the userToken filter (`applyUserTokenScope`) and
 * the session-key parser (`extractUserTokenFromSessionKey`). Does NOT spin
 * up a real LanceDB instance — full integration coverage lives in the
 * vitest live test (`memory-lancedb.live.test.ts`) which is gated on the
 * embedded LanceDB binary.
 *
 * Mirrors `partition.test.ts` and `session.test.ts` so this can run via
 * tsx in environments where `pnpm install` hasn't materialized the OpenClaw
 * vitest workspace.
 *
 * Usage:  npx tsx scripts/test-week4-memory.ts
 */

import {
  GLOBAL_USER_TOKEN,
  applyUserTokenScope,
} from "../sentura/extensions/sentura-memory-lancedb/src/partition.js";
import {
  extractAgentIdFromSessionKey,
  extractUserTokenFromSessionKey,
} from "../sentura/extensions/sentura-memory-lancedb/src/session.js";

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

type Row = { userToken: string; tag: string };

const alice: Row = { userToken: "alice-token", tag: "alice" };
const bob: Row = { userToken: "bob-token", tag: "bob" };
const global: Row = { userToken: GLOBAL_USER_TOKEN, tag: "global" };

function testUserPlusGlobal(): void {
  console.log("\n[1] applyUserTokenScope — user-plus-global (default)");
  const rows: Row[] = [alice, bob, global];

  const aliceView = applyUserTokenScope(rows, "alice-token", "user-plus-global");
  check(
    "alice sees own + global",
    aliceView.map((r) => r.tag).sort().join(",") === "alice,global",
  );

  const bobView = applyUserTokenScope(rows, "bob-token", "user-plus-global");
  check(
    "bob sees own + global",
    bobView.map((r) => r.tag).sort().join(",") === "bob,global",
  );

  const unknown = applyUserTokenScope(rows, "unknown-token", "user-plus-global");
  check(
    "unknown caller sees only globals",
    unknown.map((r) => r.tag).join(",") === "global",
  );

  const empty = applyUserTokenScope(rows, "", "user-plus-global");
  check("empty userToken sees only globals", empty.map((r) => r.tag).join(",") === "global");
}

function testUserOnly(): void {
  console.log("\n[2] applyUserTokenScope — user-only");
  const rows: Row[] = [alice, bob, global];

  const aliceView = applyUserTokenScope(rows, "alice-token", "user-only");
  check("alice sees only own (no globals)", aliceView.map((r) => r.tag).join(",") === "alice");

  const empty = applyUserTokenScope(rows, "", "user-only");
  check("empty userToken returns nothing", empty.length === 0);
}

function testGlobalOnly(): void {
  console.log("\n[3] applyUserTokenScope — global-only (partitioning disabled)");
  const rows: Row[] = [alice, bob, global];

  const result = applyUserTokenScope(rows, "alice-token", "global-only");
  check("returns every row regardless of caller", result.length === 3);
}

function testPreMigrationFallback(): void {
  console.log("\n[4] applyUserTokenScope — pre-migration table fallback");
  const rows: Row[] = [alice, bob, global];

  const result = applyUserTokenScope(rows, "alice-token", "user-only", {
    hasUserTokenColumn: false,
  });
  check("disables filtering when hasUserTokenColumn is false", result.length === 3);
}

function testTwoUserIsolation(): void {
  console.log("\n[5] Two users sharing one store — disjoint own-rows + shared globals");

  const rows: Row[] = [
    { userToken: "alice-token", tag: "a1" },
    { userToken: "alice-token", tag: "a2" },
    { userToken: "bob-token", tag: "b1" },
    { userToken: "bob-token", tag: "b2" },
    { userToken: GLOBAL_USER_TOKEN, tag: "g1" },
  ];

  const aliceView = applyUserTokenScope(rows, "alice-token", "user-plus-global");
  const bobView = applyUserTokenScope(rows, "bob-token", "user-plus-global");

  const aliceOwn = aliceView.filter((r) => r.userToken === "alice-token").map((r) => r.tag);
  const bobOwn = bobView.filter((r) => r.userToken === "bob-token").map((r) => r.tag);

  check("alice sees a1 + a2", aliceOwn.sort().join(",") === "a1,a2");
  check("bob sees b1 + b2", bobOwn.sort().join(",") === "b1,b2");
  check(
    "alice does NOT see bob's rows",
    aliceView.find((r) => r.tag === "b1") === undefined &&
      aliceView.find((r) => r.tag === "b2") === undefined,
  );
  check(
    "bob does NOT see alice's rows",
    bobView.find((r) => r.tag === "a1") === undefined &&
      bobView.find((r) => r.tag === "a2") === undefined,
  );
  check(
    "both users see the shared global",
    aliceView.find((r) => r.tag === "g1") !== undefined &&
      bobView.find((r) => r.tag === "g1") !== undefined,
  );
}

function testSessionKeyParsing(): void {
  console.log("\n[6] Session-key parsing");

  const senturaKey = "agent:ap-clerk:user:11111111-2222-3333-4444-555555555555:abc";
  check(
    "extracts userToken from Sentura session key",
    extractUserTokenFromSessionKey(senturaKey) === "11111111-2222-3333-4444-555555555555",
  );
  check(
    "extracts agentId from Sentura session key",
    extractAgentIdFromSessionKey(senturaKey) === "ap-clerk",
  );

  check(
    "raw OpenClaw session returns empty userToken",
    extractUserTokenFromSessionKey("session-12345") === "",
  );
  check(
    "agent:<id>:cli:<...> returns empty userToken",
    extractUserTokenFromSessionKey("agent:cs-agent:cli:xyz") === "",
  );
  check(
    "agent:<id>:cli:<...> still extracts agentId",
    extractAgentIdFromSessionKey("agent:cs-agent:cli:xyz") === "cs-agent",
  );
  check("undefined returns empty userToken", extractUserTokenFromSessionKey(undefined) === "");
  check("null returns empty userToken", extractUserTokenFromSessionKey(null) === "");
  check(
    "non-agent key returns null agentId",
    extractAgentIdFromSessionKey("session-12345") === null,
  );
}

function main(): void {
  console.log("Week 4 Task 2 — sentura-memory-lancedb partition tests");

  testUserPlusGlobal();
  testUserOnly();
  testGlobalOnly();
  testPreMigrationFallback();
  testTwoUserIsolation();
  testSessionKeyParsing();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
