import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Authorizer } from "./authorizer.js";
import { createImperativeAuthorize, withRbac, resolveActorUser } from "./middleware.js";
import { RbacStore } from "./store.js";
import type { SenturaUser } from "./types.js";

function makeUser(overrides: Partial<SenturaUser> = {}): SenturaUser {
  const now = new Date().toISOString();
  const id = `u-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    email: `${id}@ex.com`,
    name: "T",
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

describe("middleware.withRbac", () => {
  let tmpDir: string;
  let store: RbacStore;
  let authorizer: Authorizer;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rbac-mw-test-"));
    store = new RbacStore(tmpDir);
    await store.initialize();
    authorizer = new Authorizer(store);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("resolves user by userId param", async () => {
    const user = makeUser({ role: "ekg_manager" });
    await store.upsertUser(user);
    const resolved = await resolveActorUser(store, { userId: user.id });
    expect(resolved?.id).toBe(user.id);
  });

  it("resolves user by userToken param", async () => {
    const user = makeUser({ role: "manager", userToken: "tok-abc" });
    await store.upsertUser(user);
    const resolved = await resolveActorUser(store, { userToken: "tok-abc" });
    expect(resolved?.id).toBe(user.id);
  });

  it("calls the inner handler when authorized and passes rbac context", async () => {
    const user = makeUser({ role: "platform_admin" });
    await store.upsertUser(user);

    const inner = vi.fn(async ({ respond, rbac }) => {
      respond(true, { gotScope: rbac.scope, gotRole: rbac.user.role });
    });

    const guarded = withRbac(authorizer, store, { method: "agents.delete" }, inner);
    const respond = vi.fn();
    await guarded({ params: { userId: user.id }, respond });

    expect(inner).toHaveBeenCalledOnce();
    expect(respond).toHaveBeenCalledWith(true, { gotScope: "all", gotRole: "platform_admin" });
  });

  it("responds FORBIDDEN and does not call inner handler when role lacks permission", async () => {
    const user = makeUser({ role: "end_user" });
    await store.upsertUser(user);

    const inner = vi.fn();
    const guarded = withRbac(authorizer, store, { method: "agents.delete" }, inner);

    const respond = vi.fn();
    await guarded({ params: { userId: user.id }, respond });

    expect(inner).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("responds UNAUTHORIZED when no user identity is supplied", async () => {
    // Seed a user so we skip bootstrap mode and exercise the UNAUTHORIZED path.
    await store.upsertUser(makeUser({ role: "end_user" }));
    const inner = vi.fn();
    const guarded = withRbac(authorizer, store, { method: "agents.list" }, inner);

    const respond = vi.fn();
    await guarded({ params: {}, respond });

    expect(inner).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("bootstrap mode: allows calls through when the store has no users yet", async () => {
    const inner = vi.fn(async ({ respond, rbac }) => {
      respond(true, { bootstrap: rbac.user.id === "__bootstrap__" });
    });
    const guarded = withRbac(authorizer, store, { method: "sentura.rbac.users.create" }, inner);

    const respond = vi.fn();
    await guarded({ params: {}, respond });

    expect(inner).toHaveBeenCalledOnce();
    expect(respond).toHaveBeenCalledWith(true, { bootstrap: true });
  });

  it("passes through in non-enforce mode even on denial", async () => {
    const user = makeUser({ role: "end_user" });
    await store.upsertUser(user);

    const inner = vi.fn(async ({ respond }) => respond(true, { ok: true }));
    const guarded = withRbac(
      authorizer,
      store,
      { method: "agents.delete", enforce: false },
      inner,
    );

    const respond = vi.fn();
    await guarded({ params: { userId: user.id }, respond });

    expect(inner).toHaveBeenCalledOnce();
  });
});

describe("middleware.createImperativeAuthorize", () => {
  let tmpDir: string;
  let store: RbacStore;
  let authorizer: Authorizer;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rbac-imp-test-"));
    store = new RbacStore(tmpDir);
    await store.initialize();
    authorizer = new Authorizer(store);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns ok:true with user and scope on success", async () => {
    const user = makeUser({ role: "ekg_manager" });
    await store.upsertUser(user);
    const authorize = createImperativeAuthorize(authorizer, store);
    const result = await authorize({ userId: user.id }, "sentura.mcp.build");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe(user.id);
      expect(result.scope).toBe("all");
    }
  });

  it("returns ok:false with FORBIDDEN when role lacks permission", async () => {
    const user = makeUser({ role: "agent_manager" });
    await store.upsertUser(user);
    const authorize = createImperativeAuthorize(authorizer, store);
    const result = await authorize({ userId: user.id }, "sentura.mcp.build");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });

  it("returns ok:false with UNAUTHORIZED when no user is found", async () => {
    const authorize = createImperativeAuthorize(authorizer, store);
    const result = await authorize({}, "agents.list");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
  });
});
