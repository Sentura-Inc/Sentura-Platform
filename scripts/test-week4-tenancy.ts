#!/usr/bin/env tsx
/**
 * Week 4 Task 1 — Multi-tenancy unit tests.
 *
 * Verifies the `sentura/lib/tenancy.ts` library + `TenancyStore` +
 * setup-script Step 4b idempotent seed behavior. Does NOT require a
 * running gateway (live RPC coverage is in `test-gateway-integration.ts`
 * via the new `sentura.rbac.tenancy.*` methods).
 *
 * Usage:  npx tsx scripts/test-week4-tenancy.ts
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_TENANT_ID,
  applyDefaultTenancyOnDisk,
  getAgentTenancy,
  loadAgentTenancy,
  resolveTenantContext,
  setAgentTenancy,
} from "../sentura/lib/tenancy.js";
import { TenancyStore } from "../sentura/extensions/sentura-rbac/src/tenancy-store.js";

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

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sentura-week4-tenancy-"));
  const previous = {
    home: process.env.OPENCLAW_HOME,
    state: process.env.OPENCLAW_STATE_DIR,
  };
  process.env.OPENCLAW_HOME = tmp;
  delete process.env.OPENCLAW_STATE_DIR;
  try {
    return await fn(path.join(tmp, ".openclaw"));
  } finally {
    if (previous.home === undefined) delete process.env.OPENCLAW_HOME;
    else process.env.OPENCLAW_HOME = previous.home;
    if (previous.state === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = previous.state;
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function testStoreUpsertIdempotent(): Promise<void> {
  console.log("\n[1] TenancyStore — set/get/list + idempotent upsert");
  await withTempHome(async (home) => {
    const dataDir = path.join(home, "sentura-rbac");
    const store = new TenancyStore(dataDir);
    await store.initialize();

    const a = await store.set({ agentId: "ap-clerk", tenantId: "acme", departmentId: "finance" });
    check("set returns the new record", a.agentId === "ap-clerk" && a.tenantId === "acme" && a.departmentId === "finance");

    const b = await store.set({ agentId: "cs-agent", tenantId: "acme", departmentId: "support" });
    check("set adds a second agent", b.agentId === "cs-agent");

    const fetched = await store.get("ap-clerk");
    check("get returns the stored record", fetched?.tenantId === "acme" && fetched?.departmentId === "finance");

    const same = await store.set({ agentId: "ap-clerk", tenantId: "acme", departmentId: "finance" });
    check("idempotent re-set returns same updatedAt (no rewrite)", same.updatedAt === a.updatedAt);

    const list = await store.list();
    check("list returns 2 records", list.length === 2);

    const byDept = await store.listByDepartment("finance");
    check("listByDepartment scopes correctly", byDept.length === 1 && byDept[0].agentId === "ap-clerk");
  });
}

async function testLibraryHelpers(): Promise<void> {
  console.log("\n[2] sentura/lib/tenancy.ts — setAgentTenancy / getAgentTenancy / loadAgentTenancy");
  await withTempHome(async () => {
    const created = await setAgentTenancy("ap-clerk", { tenantId: "acme", departmentId: "finance" });
    check("setAgentTenancy creates a record", created.agentId === "ap-clerk");

    const fetched = await getAgentTenancy("ap-clerk");
    check("getAgentTenancy returns the record", fetched?.departmentId === "finance");

    const missing = await getAgentTenancy("does-not-exist");
    check("getAgentTenancy returns null for unknown agent", missing === null);

    await setAgentTenancy("ap-clerk-2", {});
    const all = await loadAgentTenancy();
    const second = all.find((r) => r.agentId === "ap-clerk-2");
    check("setAgentTenancy with no scope defaults to tenantId='default'", second?.tenantId === DEFAULT_TENANT_ID);
    check("setAgentTenancy defaults departmentId to null", second?.departmentId === null);
  });
}

async function testResolveTenantContext(): Promise<void> {
  console.log("\n[3] resolveTenantContext — combines session-key userToken with agent tenancy");
  await withTempHome(async () => {
    await setAgentTenancy("ap-clerk", { tenantId: "acme", departmentId: "finance" });

    const sessionKey = "agent:ap-clerk:user:11111111-2222-3333-4444-555555555555:abc";
    const ctx = await resolveTenantContext(sessionKey);
    check("resolves agentId from session key", ctx?.agentId === "ap-clerk");
    check("resolves tenantId from store", ctx?.tenantId === "acme");
    check("resolves departmentId from store", ctx?.departmentId === "finance");
    check("extracts userToken from session key", ctx?.userToken === "11111111-2222-3333-4444-555555555555");

    const noTenancyKey = "agent:unscoped-agent:user:99999999-2222-3333-4444-555555555555:abc";
    const fallback = await resolveTenantContext(noTenancyKey);
    check("falls back to tenantId='default' when no tenancy record", fallback?.tenantId === DEFAULT_TENANT_ID);
    check("falls back to departmentId=null when no tenancy record", fallback?.departmentId === null);

    const nonSentura = "openclaw-cli-session-12345";
    const none = await resolveTenantContext(nonSentura);
    check("returns null for non-Sentura session key", none === null);
  });
}

async function testApplyDefaultTenancyIdempotent(): Promise<void> {
  console.log("\n[4] applyDefaultTenancyOnDisk — Step 4b semantics");
  await withTempHome(async (home) => {
    const cfgPath = path.join(home, "openclaw.json");
    await fs.mkdir(home, { recursive: true });
    await fs.writeFile(
      cfgPath,
      JSON.stringify(
        {
          agents: {
            list: [{ id: "creator" }, { id: "tuner" }, { id: "orchestrator" }],
          },
        },
        null,
        2,
      ),
    );

    const seeded1 = await applyDefaultTenancyOnDisk(cfgPath);
    check("first run seeds 3 default records", seeded1.length === 3);

    const records = await loadAgentTenancy();
    check("all seeded records have tenantId='default'", records.every((r) => r.tenantId === DEFAULT_TENANT_ID));
    check("all seeded records have departmentId=null", records.every((r) => r.departmentId === null));

    const seeded2 = await applyDefaultTenancyOnDisk(cfgPath);
    check("second run is a no-op (idempotent)", seeded2.length === 0);

    // Pre-existing scoped record must be preserved through Step 4b.
    await setAgentTenancy("creator", { tenantId: "platform", departmentId: "meta" });
    const seeded3 = await applyDefaultTenancyOnDisk(cfgPath);
    check("third run preserves manually-scoped records", seeded3.length === 0);
    const creator = await getAgentTenancy("creator");
    check("manual scope survives re-seed", creator?.tenantId === "platform" && creator?.departmentId === "meta");
  });
}

async function main(): Promise<void> {
  console.log("Week 4 Task 1 — Multi-tenancy tests");

  await testStoreUpsertIdempotent();
  await testLibraryHelpers();
  await testResolveTenantContext();
  await testApplyDefaultTenancyIdempotent();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
