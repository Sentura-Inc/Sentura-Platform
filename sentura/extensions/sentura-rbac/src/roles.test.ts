import { describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS, getOperatorScopesForRole, getRoleDefinition } from "./roles.js";

describe("ROLE_DEFINITIONS", () => {
  it("defines exactly five roles", () => {
    expect(ROLE_DEFINITIONS).toHaveLength(5);
  });

  it("covers all expected role IDs", () => {
    const ids = ROLE_DEFINITIONS.map((r) => r.id);
    expect(ids).toContain("platform_admin");
    expect(ids).toContain("dept_admin");
    expect(ids).toContain("employee_owner");
    expect(ids).toContain("auditor");
    expect(ids).toContain("end_user");
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
});

describe("getOperatorScopesForRole", () => {
  it("returns scopes for a valid role", () => {
    const scopes = getOperatorScopesForRole("dept_admin");
    expect(scopes).toContain("operator.read");
    expect(scopes).toContain("operator.write");
    expect(scopes).toContain("operator.approvals");
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
