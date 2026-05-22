import { describe, expect, it, vi } from "vitest";
import { HealthMonitor, applyCheck, emptyHealth } from "./monitor.js";
import type { CheckResult, McpHealthConfig, McpServerEntry } from "./types.js";

const baseConfig: McpHealthConfig = {
  checkIntervalMs: 60_000,
  checkTimeoutMs: 5_000,
  degradedAfterErrors: 3,
  downAfterErrors: 5,
  emitAuditOnEveryCheck: false,
  stateFile: "/tmp/unused.json",
};

describe("applyCheck — pure status-machine", () => {
  it("transitions unknown → up on first success", () => {
    const r = applyCheck(
      emptyHealth("filesystem"),
      { ok: true, latencyMs: 12, toolCount: 11 },
      baseConfig,
    );
    expect(r.next.status).toBe("up");
    expect(r.next.latencyMs).toBe(12);
    expect(r.next.toolCount).toBe(11);
    expect(r.next.consecutiveErrors).toBe(0);
    expect(r.next.successCount).toBe(1);
    expect(r.previousStatus).toBe("unknown");
    expect(r.changed).toBe(true);
  });

  it("transitions unknown → degraded on first failure", () => {
    const r = applyCheck(
      emptyHealth("filesystem"),
      { ok: false, error: "spawn ENOENT" },
      baseConfig,
    );
    expect(r.next.status).toBe("degraded");
    expect(r.next.consecutiveErrors).toBe(1);
    expect(r.next.errorCount).toBe(1);
    expect(r.next.lastError).toBe("spawn ENOENT");
    expect(r.changed).toBe(true);
  });

  it("transitions up → degraded → down on consecutive failures", () => {
    let h = emptyHealth("filesystem");
    h = applyCheck(h, { ok: true, latencyMs: 5 }, baseConfig).next;
    expect(h.status).toBe("up");

    h = applyCheck(h, { ok: false, error: "x" }, baseConfig).next;
    expect(h.status).toBe("up"); // 1 consecutive
    h = applyCheck(h, { ok: false, error: "x" }, baseConfig).next;
    expect(h.status).toBe("up"); // 2 consecutive
    h = applyCheck(h, { ok: false, error: "x" }, baseConfig).next;
    expect(h.status).toBe("degraded"); // 3 consecutive
    h = applyCheck(h, { ok: false, error: "x" }, baseConfig).next;
    h = applyCheck(h, { ok: false, error: "x" }, baseConfig).next;
    expect(h.status).toBe("down"); // 5 consecutive
    expect(h.lastDownAt).toBeDefined();
  });

  it("recovers down → up on a successful check", () => {
    let h: ReturnType<typeof applyCheck>["next"] = emptyHealth("filesystem");
    for (let i = 0; i < 5; i++) {
      h = applyCheck(h, { ok: false, error: "x" }, baseConfig).next;
    }
    expect(h.status).toBe("down");

    const recovery = applyCheck(h, { ok: true, latencyMs: 7, toolCount: 11 }, baseConfig);
    expect(recovery.next.status).toBe("up");
    expect(recovery.next.consecutiveErrors).toBe(0);
    expect(recovery.previousStatus).toBe("down");
    expect(recovery.changed).toBe(true);
  });
});

describe("HealthMonitor — orchestration", () => {
  it("runs a check round across registered servers", async () => {
    const onChange = vi.fn();
    const onCheck = vi.fn();
    const check = vi.fn(
      async (server: McpServerEntry): Promise<CheckResult> => ({
        ok: true,
        latencyMs: 1,
        toolCount: server.name === "fs" ? 11 : 5,
      }),
    );

    const monitor = new HealthMonitor({
      config: baseConfig,
      check,
      onChange,
      onCheck,
      initialServers: [
        { name: "fs", command: "node", args: ["fs.js"] },
        { name: "slack", command: "node", args: ["slack.js"] },
      ],
    });

    const results = await monitor.runOnce();
    expect(results.length).toBe(2);
    expect(results.every((r) => r.status === "up")).toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
    expect(onCheck).toHaveBeenCalledTimes(2);
    // Both transitioned from unknown → up — both fire onChange.
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("only fires onChange when status transitions", async () => {
    const onChange = vi.fn();
    const onCheck = vi.fn();
    let okCounter = 0;
    const check = async (): Promise<CheckResult> => ({
      ok: true,
      latencyMs: ++okCounter,
    });

    const monitor = new HealthMonitor({
      config: baseConfig,
      check,
      onChange,
      onCheck,
      initialServers: [{ name: "fs", command: "node" }],
    });

    await monitor.runOnce(); // unknown → up : change
    await monitor.runOnce(); // up → up : no change
    await monitor.runOnce(); // up → up : no change

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledTimes(3);
  });

  it("skips servers marked disabled", async () => {
    const check = vi.fn(async (): Promise<CheckResult> => ({ ok: true }));
    const monitor = new HealthMonitor({
      config: baseConfig,
      check,
      onChange: () => {},
      onCheck: () => {},
      initialServers: [
        { name: "fs", command: "node" },
        { name: "off", command: "node", disabled: true },
      ],
    });
    const results = await monitor.runOnce();
    expect(results.map((r) => r.name)).toEqual(["fs"]);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("captures CheckStrategy throws as failed checks", async () => {
    const monitor = new HealthMonitor({
      config: baseConfig,
      check: async () => {
        throw new Error("boom");
      },
      onChange: () => {},
      onCheck: () => {},
      initialServers: [{ name: "fs", command: "node" }],
    });
    const [result] = await monitor.runOnce();
    expect(result.status).toBe("degraded");
    expect(result.lastError).toBe("boom");
  });
});
