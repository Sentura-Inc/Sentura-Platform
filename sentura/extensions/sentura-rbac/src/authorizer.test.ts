import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Authorizer } from "./authorizer.js";
import { RbacStore } from "./store.js";
import type { SenturaUser } from "./types.js";

function makeUser(overrides: Partial<SenturaUser> = {}): SenturaUser {
  const now = new Date().toISOString();
  const id = `user-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    email: `${id}@example.com`,
    name: "Test User",
    role: "end_user",
    userToken: `tok-${id}`,
    departmentIds: [],
    ownedEmployeeIds: [],
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...overrides,
  };
}

describe("Authorizer", () => {
  let tmpDir: string;
  let store: RbacStore;
  let authorizer: Authorizer;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sentura-rbac-test-"));
    store = new RbacStore(tmpDir);
    await store.initialize();
    authorizer = new Authorizer(store);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("denies unknown users", async () => {
    const result = await authorizer.authorize("nonexistent", "agents.list");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("platform_admin is allowed everything with scope 'all'", async () => {
    const admin = makeUser({ role: "platform_admin" });
    await store.upsertUser(admin);

    const result = await authorizer.authorize(admin.id, "agents.delete");
    expect(result.allowed).toBe(true);
    expect(result.filteredScope).toBe("all");
  });

  it("auditor can read agents but not delete", async () => {
    const auditor = makeUser({ role: "auditor" });
    await store.upsertUser(auditor);

    const readResult = await authorizer.authorize(auditor.id, "agents.list");
    expect(readResult.allowed).toBe(true);

    const deleteResult = await authorizer.authorize(auditor.id, "agents.delete");
    expect(deleteResult.allowed).toBe(false);
  });

  it("agent_manager can read and update agents with 'owned' scope", async () => {
    const owner = makeUser({ role: "agent_manager" });
    await store.upsertUser(owner);

    const readResult = await authorizer.authorize(owner.id, "agents.list");
    expect(readResult.allowed).toBe(true);
    expect(readResult.filteredScope).toBe("owned");

    const updateResult = await authorizer.authorize(owner.id, "agents.update");
    expect(updateResult.allowed).toBe(true);
    expect(updateResult.filteredScope).toBe("owned");
  });

  it("agent_manager can create agents with 'owned' scope", async () => {
    const owner = makeUser({ role: "agent_manager" });
    await store.upsertUser(owner);

    const result = await authorizer.authorize(owner.id, "agents.create");
    expect(result.allowed).toBe(true);
    expect(result.filteredScope).toBe("owned");
  });

  it("agent_manager cannot delete agents", async () => {
    const owner = makeUser({ role: "agent_manager" });
    await store.upsertUser(owner);

    const result = await authorizer.authorize(owner.id, "agents.delete");
    expect(result.allowed).toBe(false);
  });

  it("end_user can only read own sessions", async () => {
    const user = makeUser({ role: "end_user" });
    await store.upsertUser(user);

    const sessionsResult = await authorizer.authorize(user.id, "sessions.list");
    expect(sessionsResult.allowed).toBe(true);
    expect(sessionsResult.filteredScope).toBe("self");
  });

  it("end_user cannot access config", async () => {
    const user = makeUser({ role: "end_user" });
    await store.upsertUser(user);

    const result = await authorizer.authorize(user.id, "config.get");
    expect(result.allowed).toBe(false);
  });

  it("manager can access agents with 'department' scope", async () => {
    const mgr = makeUser({ role: "manager" });
    await store.upsertUser(mgr);

    const result = await authorizer.authorize(mgr.id, "agents.list");
    expect(result.allowed).toBe(true);
    expect(result.filteredScope).toBe("department");
  });

  it("manager can resolve approvals but not configure them", async () => {
    const mgr = makeUser({ role: "manager" });
    await store.upsertUser(mgr);

    const resolveResult = await authorizer.authorize(mgr.id, "exec.approval.resolve");
    expect(resolveResult.allowed).toBe(true);
    expect(resolveResult.filteredScope).toBe("department");

    const configureResult = await authorizer.authorize(mgr.id, "exec.approvals.set");
    expect(configureResult.allowed).toBe(false);
  });

  it("ekg_manager has SME-wide write access to EKG", async () => {
    const ekgMgr = makeUser({ role: "ekg_manager" });
    await store.upsertUser(ekgMgr);

    const result = await authorizer.authorize(ekgMgr.id, "sentura.ekg.upload");
    expect(result.allowed).toBe(true);
    expect(result.filteredScope).toBe("all");
  });

  it("ekg_manager can build MCP servers", async () => {
    const ekgMgr = makeUser({ role: "ekg_manager" });
    await store.upsertUser(ekgMgr);

    const result = await authorizer.authorize(ekgMgr.id, "sentura.mcp.build");
    expect(result.allowed).toBe(true);
  });

  it("agent_manager cannot build MCP servers", async () => {
    const owner = makeUser({ role: "agent_manager" });
    await store.upsertUser(owner);

    const result = await authorizer.authorize(owner.id, "sentura.mcp.build");
    expect(result.allowed).toBe(false);
  });

  it("auditor can query audit logs", async () => {
    const auditor = makeUser({ role: "auditor" });
    await store.upsertUser(auditor);

    const result = await authorizer.authorize(auditor.id, "sentura.audit.query");
    expect(result.allowed).toBe(true);
    expect(result.filteredScope).toBe("all");
  });

  it("end_user cannot query audit logs", async () => {
    const user = makeUser({ role: "end_user" });
    await store.upsertUser(user);

    const result = await authorizer.authorize(user.id, "sentura.audit.query");
    expect(result.allowed).toBe(false);
  });

  it("viewer can read agents list but not sessions", async () => {
    const viewer = makeUser({ role: "viewer" });
    await store.upsertUser(viewer);

    const agents = await authorizer.authorize(viewer.id, "agents.list");
    expect(agents.allowed).toBe(true);

    const sessions = await authorizer.authorize(viewer.id, "sessions.list");
    expect(sessions.allowed).toBe(false);
  });

  it("only platform_admin can access secrets", async () => {
    const admin = makeUser({ role: "platform_admin" });
    const manager = makeUser({ role: "manager" });
    const agentMgr = makeUser({ role: "agent_manager" });
    const ekgMgr = makeUser({ role: "ekg_manager" });
    const auditor = makeUser({ role: "auditor" });

    await store.upsertUser(admin);
    await store.upsertUser(manager);
    await store.upsertUser(agentMgr);
    await store.upsertUser(ekgMgr);
    await store.upsertUser(auditor);

    expect((await authorizer.authorize(admin.id, "secrets.resolve")).allowed).toBe(true);
    expect((await authorizer.authorize(manager.id, "secrets.resolve")).allowed).toBe(false);
    expect((await authorizer.authorize(agentMgr.id, "secrets.resolve")).allowed).toBe(false);
    expect((await authorizer.authorize(ekgMgr.id, "secrets.resolve")).allowed).toBe(false);
    expect((await authorizer.authorize(auditor.id, "secrets.resolve")).allowed).toBe(false);
  });
});
