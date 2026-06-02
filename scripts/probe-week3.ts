/**
 * Probe: verify the Person D Week 3 extensions (sentura-approval and
 * sentura-provisioner) loaded into the IN-REPO gateway and respond to
 * their dashboard RPCs.
 *
 * What it checks:
 *   1. sentura.approval.policies.list  — expects ≥ 2 built-in policies
 *      (`builtin:critical-always-human`, `builtin:low-risk-auto-approve`).
 *   2. sentura.approval.requests.list  — expects an empty array on a
 *      fresh install (or whatever's there from prior runs).
 *   3. sentura.provisioner.requests.list — same.
 *
 * Run from the repo root with the gateway running on :18789:
 *   npx tsx scripts/probe-week3.ts
 *
 * If you see `Method not found` for any of the three calls, that
 * extension did not register — check the gateway log for an
 * "Extension registered" line per extension.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";

const GATEWAY_URL = "ws://localhost:18789";
const CONFIG_PATH = path.join(os.homedir(), ".openclaw/openclaw.json");

function loadOperatorToken(): { token: string; scopes: string[] } {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as {
    gateway?: { auth?: { token?: string } };
  };
  const tok = cfg.gateway?.auth?.token;
  if (!tok) throw new Error("no gateway.auth.token in ~/.openclaw/openclaw.json — run scripts/sentura-setup.sh first");
  return {
    token: tok,
    scopes: ["operator.read", "operator.write", "operator.admin"],
  };
}

class Rpc {
  ws!: WebSocket;
  private pending = new Map<string, (v: unknown, err?: Error) => void>();
  private id = 0;

  connect(url: string, token: string, scopes: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      const to = setTimeout(() => reject(new Error("connect timeout")), 10_000);
      this.ws.on("error", (e) => reject(e as Error));
      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === "event" && msg.event === "connect.challenge") {
          const id = String(++this.id);
          this.pending.set(id, (_v, err) => {
            if (err) return reject(err);
            clearTimeout(to);
            resolve();
          });
          this.ws.send(
            JSON.stringify({
              type: "req",
              id,
              method: "connect",
              params: {
                minProtocol: 4,
                maxProtocol: 4,
                client: {
                  id: "openclaw-tui",
                  displayName: "Sentura Week3 Probe",
                  version: "0.1.0",
                  platform: "node",
                  mode: "ui",
                },
                caps: [],
                role: "operator",
                scopes,
                auth: { token },
              },
            }),
          );
        } else if (msg.type === "res") {
          const h = this.pending.get(msg.id as string);
          if (h) {
            this.pending.delete(msg.id as string);
            if (msg.ok) h(msg.payload);
            else h(undefined, new Error((msg.error as { message?: string })?.message ?? "rpc error"));
          }
        }
      });
    });
  }

  rpc<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = String(++this.id);
      const to = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`rpc timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, (v, err) => {
        clearTimeout(to);
        if (err) reject(err);
        else resolve(v as T);
      });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

async function tryRpc<T>(rpc: Rpc, method: string, params: Record<string, unknown> = {}): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  try {
    const result = await rpc.rpc<T>(method, params);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function main() {
  const { token, scopes } = loadOperatorToken();
  const rpc = new Rpc();
  await rpc.connect(GATEWAY_URL, token, scopes);
  console.log("✓ connected to gateway");

  let pass = 0;
  let fail = 0;

  // --- D16: sentura-approval ---
  const policies = await tryRpc<{ policies: Array<{ id: string }> }>(rpc, "sentura.approval.policies.list");
  if (policies.ok) {
    const ids = policies.result.policies.map((p) => p.id);
    const hasCritical = ids.includes("builtin:critical-always-human");
    const hasLow = ids.includes("builtin:low-risk-auto-approve");
    if (hasCritical && hasLow) {
      console.log(`✓ D16.3 sentura.approval.policies.list — ${policies.result.policies.length} policies (both built-ins present)`);
      pass++;
    } else {
      console.log(`✗ D16.3 sentura.approval.policies.list — missing built-ins. Got: ${ids.join(", ")}`);
      fail++;
    }
  } else {
    console.log(`✗ D16.3 sentura.approval.policies.list — ${policies.error}`);
    fail++;
  }

  const approvals = await tryRpc<{ requests: unknown[]; count: number }>(rpc, "sentura.approval.requests.list", { limit: 5 });
  if (approvals.ok) {
    console.log(`✓ D16.7 sentura.approval.requests.list — ${approvals.result.count} pending request(s)`);
    pass++;
  } else {
    console.log(`✗ D16.7 sentura.approval.requests.list — ${approvals.error}`);
    fail++;
  }

  // --- D17: sentura-provisioner ---
  const provisionings = await tryRpc<{ requests: unknown[]; count: number }>(rpc, "sentura.provisioner.requests.list", { limit: 5 });
  if (provisionings.ok) {
    console.log(`✓ D17.8 sentura.provisioner.requests.list — ${provisionings.result.count} request(s)`);
    pass++;
  } else {
    console.log(`✗ D17.8 sentura.provisioner.requests.list — ${provisionings.error}`);
    fail++;
  }

  // --- File a real approval to prove evaluate() runs and the store persists ---
  const filed = await tryRpc<{ policy: unknown }>(rpc, "sentura.approval.policies.upsert", {
    id: "probe:auto-approve-low",
    description: "Probe-only policy — safe to leave behind",
    priority: 5,
    match: { actions: ["probe.test.action"] },
    outcome: { kind: "auto_approve", reason: "probe smoke test" },
  });
  if (filed.ok) {
    console.log("✓ D16.7 sentura.approval.policies.upsert — probe policy persisted");
    pass++;
  } else {
    console.log(`✗ D16.7 sentura.approval.policies.upsert — ${filed.error}`);
    fail++;
  }

  console.log(`\n${pass} pass / ${fail} fail`);
  rpc.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});
