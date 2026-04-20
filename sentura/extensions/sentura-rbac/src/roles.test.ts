import { describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS, getOperatorScopesForRole, getRoleDefinition } from "./roles.js";
import { SENTURA_ROLES } from "./types.js";

describe("ROLE_DEFINITIONS", () => {
  it("defines exactly seven roles", () => {
    expect(ROLE_DEFINITIONS).toHaveLength(7);
  });

  it("covers all expected role IDs", () => {
    const ids = ROLE_DEFINITIONS.map((r) => r.id);
    expect(ids).toEqual([...SENTURA_ROLES]);
    for (const r of [
      "platform_admin",
      "manager",
      "ekg_manager",
      "agent_manager",
      "auditor",
      "end_user",
      "viewer",
    ]) {
      expect(ids).toContain(r);
    }
  });

  it("platform_admin has all six operator scopes", () => {
    const admin = getRoleDefinition("platform_admin")!;
    expect(admin.operatorScopes).toContain("operator.admin");
    expect(admin.operatorScopes).toContain("operator.read");
    expect(admin.operatorScopes).toContain("operator.write");
    expect(admin.operatorScopes).toContain("operator.approvals");
    expect(admin.operatorScopes).toContain("operator.pairing");
    expect(admin.operatorScopes).toContain("operator.talk.secrets");
    expect(admin.operatorScopes).toHaveLength(6);
  });

  it("end_user only gets operator.read", () => {
    const endUser = getRoleDefinition("end_user")!;
    expect(endUser.operatorScopes).toEqual(["operator.read"]);
  });

  it("viewer only gets operator.read", () => {
    const viewer = getRoleDefinition("viewer")!;
    expect(viewer.operatorScopes).toEqual(["operator.read"]);
  });

  it("auditor has read-only permissions on all resources", () => {
    const auditor = getRoleDefinition("auditor")!;
    for (const perm of auditor.permissions) {
      const hasWriteAction = perm.actions.some((a) =>
        ["write", "create", "update", "delete", "configure"].includes(a),
      );
      expect(hasWriteAction, `auditor should not have write actions on ${perm.resource}`).toBe(false);
    }
  });

  it("platform_admin has T0-T4 data tier access", () => {
    const admin = getRoleDefinition("platform_admin")!;
    expect(admin.dataTierAccess).toEqual(["T0", "T1", "T2", "T3", "T4"]);
  });

  it("end_user only has T0 data tier access", () => {
    const endUser = getRoleDefinition("end_user")!;
    expect(endUser.dataTierAccess).toEqual(["T0"]);
  });

  it("viewer only has T0 data tier access", () => {
    const viewer = getRoleDefinition("viewer")!;
    expect(viewer.dataTierAccess).toEqual(["T0"]);
  });

  it("agent_manager has owned-scope on agents and config", () => {
    const agentMgr = getRoleDefinition("agent_manager")!;
    const agents = agentMgr.permissions.find((p) => p.resource === "agents");
    expect(agents?.scope).toBe("owned");
    const cfg = agentMgr.permissions.find((p) => p.resource === "config");
    expect(cfg?.scope).toBe("owned");
  });

  it("manager has department-scope on agents and audit", () => {
    const mgr = getRoleDefinition("manager")!;
    const agents = mgr.permissions.find((p) => p.resource === "agents");
    expect(agents?.scope).toBe("department");
    const audit = mgr.permissions.find((p) => p.resource === "audit");
    expect(audit?.scope).toBe("department");
  });

  it("ekg_manager has SME-wide write on ekg and mcp resources", () => {
    const ekgMgr = getRoleDefinition("ekg_manager")!;
    const ekg = ekgMgr.permissions.find((p) => p.resource === "ekg");
    expect(ekg?.scope).toBe("all");
    expect(ekg?.actions).toContain("write");
    const mcp = ekgMgr.permissions.find((p) => p.resource === "mcp");
    expect(mcp?.scope).toBe("all");
    expect(mcp?.actions).toContain("create");
  });
});

describe("getOperatorScopesForRole", () => {
  it("returns scopes for manager", () => {
    const scopes = getOperatorScopesForRole("manager");
    expect(scopes).toContain("operator.read");
    expect(scopes).toContain("operator.write");
    expect(scopes).toContain("operator.approvals");
  });

  it("returns scopes for agent_manager", () => {
    const scopes = getOperatorScopesForRole("agent_manager");
    expect(scopes).toContain("operator.read");
    expect(scopes).toContain("operator.write");
    expect(scopes).not.toContain("operator.approvals");
  });

  it("returns empty array for unknown role", () => {
    const scopes = getOperatorScopesForRole("nonexistent");
    expect(scopes).toEqual([]);
  });
});

describe("getRoleDefinition", () => {
  it("returns undefined for unknown role", () => {
    expect(getRoleDefinition("bogus")).toBeUndefined();
  });

  it("returns correct definition for each role", () => {
    for (const def of ROLE_DEFINITIONS) {
      expect(getRoleDefinition(def.id)).toBe(def);
    }
  });
});
