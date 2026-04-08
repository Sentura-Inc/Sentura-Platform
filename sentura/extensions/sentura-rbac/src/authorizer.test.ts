import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Authorizer } from "./authorizer.js";
import { RbacStore } from "./store.js";
import type { SenturaUser } from "./types.js";

function makeUser(overrides: Partial<SenturaUser> = {}): SenturaUser {
  const now = new Date().toISOString();
  return {
    id: `user-${Math.random().toString(36).slice(2)}`,
    email: "test@example.com",
    name: "Test User",
    role: "end_user",
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

  it("employee_owner can read and update agents with 'owned' scope", async () => {
    const owner = makeUser({ role: "employee_owner" });
    await store.upsertUser(owner);

    const readResult = await authorizer.authorize(owner.id, "agents.list");
    expect(readResult.allowed).toBe(true);
    expect(readResult.filteredScope).toBe("owned");

    const updateResult = await authorizer.authorize(owner.id, "agents.update");
    expect(updateResult.allowed).toBe(true);
    expect(updateResult.filteredScope).toBe("owned");
  });

  it("employee_owner cannot create agents", async () => {
    const owner = makeUser({ role: "employee_owner" });
    await store.upsertUser(owner);

    const result = await authorizer.authorize(owner.id, "agents.create");
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

  it("dept_admin can access agents with 'department' scope", async () => {
    const deptAdmin = makeUser({ role: "dept_admin" });
    await store.upsertUser(deptAdmin);

    const result = await authorizer.authorize(deptAdmin.id, "agents.list");
    expect(result.allowed).toBe(true);
    expect(result.filteredScope).toBe("department");
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

  it("only platform_admin can access secrets", async () => {
    const admin = makeUser({ role: "platform_admin" });
    const deptAdmin = makeUser({ role: "dept_admin" });
    const owner = makeUser({ role: "employee_owner" });

    await store.upsertUser(admin);
    await store.upsertUser(deptAdmin);
    await store.upsertUser(owner);

    expect((await authorizer.authorize(admin.id, "secrets.resolve")).allowed).toBe(true);
    expect((await authorizer.authorize(deptAdmin.id, "secrets.resolve")).allowed).toBe(false);
    expect((await authorizer.authorize(owner.id, "secrets.resolve")).allowed).toBe(false);
  });
});
