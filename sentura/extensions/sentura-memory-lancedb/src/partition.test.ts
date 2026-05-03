import { describe, expect, it } from "vitest";
import { GLOBAL_USER_TOKEN, applyUserTokenScope } from "./partition.js";

type Row = { userToken: string; tag: string };

const alice = { userToken: "alice-token", tag: "alice-row" };
const bob = { userToken: "bob-token", tag: "bob-row" };
const global = { userToken: GLOBAL_USER_TOKEN, tag: "global-row" };

describe("applyUserTokenScope", () => {
  describe("user-plus-global (default)", () => {
    it("returns caller's own rows plus global rows", () => {
      const rows: Row[] = [alice, bob, global];
      const result = applyUserTokenScope(rows, "alice-token", "user-plus-global");
      expect(result.map((r) => r.tag).sort()).toEqual(["alice-row", "global-row"]);
    });

    it("hides other users' rows", () => {
      const rows: Row[] = [alice, bob, global];
      const result = applyUserTokenScope(rows, "bob-token", "user-plus-global");
      expect(result.map((r) => r.tag).sort()).toEqual(["bob-row", "global-row"]);
    });

    it("for an unknown caller, returns only globals", () => {
      const rows: Row[] = [alice, bob, global];
      const result = applyUserTokenScope(rows, "unknown-token", "user-plus-global");
      expect(result.map((r) => r.tag)).toEqual(["global-row"]);
    });

    it("for an empty userToken (raw CLI), returns only globals", () => {
      const rows: Row[] = [alice, bob, global];
      const result = applyUserTokenScope(rows, "", "user-plus-global");
      expect(result.map((r) => r.tag)).toEqual(["global-row"]);
    });
  });

  describe("user-only", () => {
    it("hides global rows", () => {
      const rows: Row[] = [alice, bob, global];
      const result = applyUserTokenScope(rows, "alice-token", "user-only");
      expect(result.map((r) => r.tag)).toEqual(["alice-row"]);
    });

    it("for an empty userToken, returns nothing", () => {
      const rows: Row[] = [alice, bob, global];
      const result = applyUserTokenScope(rows, "", "user-only");
      expect(result).toEqual([]);
    });
  });

  describe("global-only", () => {
    it("returns every row regardless of caller", () => {
      const rows: Row[] = [alice, bob, global];
      const result = applyUserTokenScope(rows, "alice-token", "global-only");
      expect(result).toHaveLength(3);
    });
  });

  describe("pre-migration tables", () => {
    it("disables filtering when hasUserTokenColumn is false", () => {
      const rows: Row[] = [alice, bob, global];
      const result = applyUserTokenScope(rows, "alice-token", "user-only", {
        hasUserTokenColumn: false,
      });
      expect(result).toHaveLength(3);
    });
  });

  describe("isolation guarantee", () => {
    it("two users sharing the same store see disjoint own-rows", () => {
      const aliceRow1 = { userToken: "alice-token", tag: "a1" };
      const aliceRow2 = { userToken: "alice-token", tag: "a2" };
      const bobRow1 = { userToken: "bob-token", tag: "b1" };
      const bobRow2 = { userToken: "bob-token", tag: "b2" };
      const sharedGlobal = { userToken: GLOBAL_USER_TOKEN, tag: "g1" };
      const rows: Row[] = [aliceRow1, aliceRow2, bobRow1, bobRow2, sharedGlobal];

      const aliceView = applyUserTokenScope(rows, "alice-token", "user-plus-global");
      const bobView = applyUserTokenScope(rows, "bob-token", "user-plus-global");

      const aliceOwn = aliceView.filter((r) => r.userToken === "alice-token");
      const bobOwn = bobView.filter((r) => r.userToken === "bob-token");

      // Disjoint own-rows
      expect(aliceOwn.map((r) => r.tag).sort()).toEqual(["a1", "a2"]);
      expect(bobOwn.map((r) => r.tag).sort()).toEqual(["b1", "b2"]);

      // Both see the shared global
      expect(aliceView.find((r) => r.tag === "g1")).toBeDefined();
      expect(bobView.find((r) => r.tag === "g1")).toBeDefined();

      // Neither user sees the other's rows
      expect(aliceView.find((r) => r.tag === "b1")).toBeUndefined();
      expect(bobView.find((r) => r.tag === "a1")).toBeUndefined();
    });
  });
});
