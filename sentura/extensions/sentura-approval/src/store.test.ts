import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApprovalStore } from "./store.js";
import type { ApprovalRequest } from "./types.js";

function makeRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: `apr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    agentId: "agent-1",
    action: "test.action",
    riskLevel: "medium",
    context: {},
    requestedAt: new Date().toISOString(),
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    onTimeoutDecision: "deny",
    escalation: { chain: ["platform_admin"], currentIndex: 0 },
    ...overrides,
  };
}

describe("ApprovalStore — multi-tenancy + base flow", () => {
  let tmpDir: string;
  let store: ApprovalStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sentura-approval-test-"));
    store = new ApprovalStore({ dataDir: tmpDir, retention: { maxAgeDays: 30 } });
    await store.initialize([]);
  });

  afterEach(async () => {
    await store.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("appends and retrieves requests by id", async () => {
    const req = makeRequest({ id: "apr_test_1" });
    await store.appendRequest(req);
    expect(store.getRequest("apr_test_1")?.id).toBe("apr_test_1");
  });

  it("filters query by status and agentId", async () => {
    await store.appendRequest(makeRequest({ id: "a", status: "pending" }));
    await store.appendRequest(makeRequest({ id: "b", status: "approved", decidedAt: "x" }));
    await store.appendRequest(makeRequest({ id: "c", status: "pending", agentId: "agent-2" }));

    expect(store.query({ status: "pending" }).length).toBe(2);
    expect(store.query({ agentId: "agent-2" }).length).toBe(1);
  });

  it("filters by tenantId — isolates approvals between tenants", async () => {
    await store.appendRequest(makeRequest({ id: "a1", tenantId: "acme" }));
    await store.appendRequest(makeRequest({ id: "a2", tenantId: "acme" }));
    await store.appendRequest(makeRequest({ id: "g1", tenantId: "globex" }));
    await store.appendRequest(makeRequest({ id: "n1" })); // no tenant

    const acme = store.query({ tenantId: "acme" });
    expect(acme.length).toBe(2);
    expect(acme.every((r) => r.tenantId === "acme")).toBe(true);

    const globex = store.query({ tenantId: "globex" });
    expect(globex.length).toBe(1);
    expect(globex[0].id).toBe("g1");
  });

  it("filters by departmentId — independent of tenant filter", async () => {
    await store.appendRequest(
      makeRequest({ id: "s1", tenantId: "acme", departmentId: "support" }),
    );
    await store.appendRequest(
      makeRequest({ id: "s2", tenantId: "acme", departmentId: "support" }),
    );
    await store.appendRequest(
      makeRequest({ id: "f1", tenantId: "acme", departmentId: "finance" }),
    );

    expect(store.query({ departmentId: "support" }).length).toBe(2);
    expect(store.query({ tenantId: "acme", departmentId: "finance" }).length).toBe(1);
  });

  it("transitions a pending request to expired via sweepExpired()", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    await store.appendRequest(
      makeRequest({ id: "exp1", expiresAt: past, status: "pending" }),
    );
    const expired = await store.sweepExpired();
    expect(expired.length).toBe(1);
    expect(store.getRequest("exp1")?.status).toBe("expired");
  });

  it("persists tenant fields across reload", async () => {
    await store.appendRequest(
      makeRequest({ id: "p1", tenantId: "acme", departmentId: "support" }),
    );
    await store.close();

    const reloaded = new ApprovalStore({ dataDir: tmpDir, retention: { maxAgeDays: 30 } });
    await reloaded.initialize([]);
    const got = reloaded.getRequest("p1");
    expect(got?.tenantId).toBe("acme");
    expect(got?.departmentId).toBe("support");
    await reloaded.close();
  });
});
