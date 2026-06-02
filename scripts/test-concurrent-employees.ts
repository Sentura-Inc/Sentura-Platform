#!/usr/bin/env tsx
/**
 * Week 4 Task 4 — Gateway concurrency / performance harness.
 *
 * Spawns N concurrent WebSocket clients that each issue M sequential RPC
 * calls against the local OpenClaw gateway and reports p50/p95/p99
 * latencies. Pass criterion (per the Week 4 plan): with 5 concurrent
 * agents × 3 sessions each, p95 LLM round-trip latency stays within 2×
 * the single-session baseline.
 *
 * REQUIRES a running gateway on localhost:18789. The harness does NOT
 * spin one up — start it via `cd openclaw && pnpm gateway:watch` first.
 *
 * The default RPC mix exercises read-only methods (`health`,
 * `config.get`, `agents.list`) so the harness can be re-run without
 * mutating state. Pass `--mix=cost` to also drive `sentura.cost.summary`
 * and `sentura.health.summary` after Week 4 lands.
 *
 * Usage:
 *   npx tsx scripts/test-concurrent-employees.ts                 # 5×10 reads
 *   npx tsx scripts/test-concurrent-employees.ts --clients 20    # 20 clients
 *   npx tsx scripts/test-concurrent-employees.ts --calls 50      # 50 calls each
 *   npx tsx scripts/test-concurrent-employees.ts --mix cost      # add cost RPCs
 */

import WebSocket from "ws";
import fs from "node:fs/promises";
import path from "node:path";

const GATEWAY_URL = "ws://localhost:18789";
const OPENCLAW_HOME =
  process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");

interface CliArgs {
  clients: number;
  calls: number;
  mix: "read-only" | "cost";
  warmup: number;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: CliArgs = { clients: 5, calls: 10, mix: "read-only", warmup: 3 };
  for (let i = 0; i < argv.length; i++) {
    const [key, value] = [argv[i], argv[i + 1]];
    switch (key) {
      case "--clients":
        args.clients = parseInt(value ?? "5", 10);
        i++;
        break;
      case "--calls":
        args.calls = parseInt(value ?? "10", 10);
        i++;
        break;
      case "--warmup":
        args.warmup = parseInt(value ?? "3", 10);
        i++;
        break;
      case "--mix":
        args.mix = (value as CliArgs["mix"]) ?? "read-only";
        i++;
        break;
    }
  }
  return args;
}

async function getGatewayToken(): Promise<string> {
  const raw = await fs.readFile(CONFIG_PATH, "utf-8");
  const cfg = JSON.parse(raw) as { gateway?: { token?: string; auth?: { token?: string } } };
  return cfg.gateway?.token ?? cfg.gateway?.auth?.token ?? "";
}

class GatewayClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  async connect(token: string, clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(GATEWAY_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.ws = ws;
      ws.once("error", (err) => reject(err));
      ws.once("open", () => {
        ws.send(
          JSON.stringify({
            type: "hello",
            client: { id: "openclaw-tui", instanceId: clientId, mode: "ui" },
          }),
        );
        resolve();
      });
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            id?: number;
            result?: unknown;
            error?: { message?: string };
          };
          if (typeof msg.id !== "number") return;
          const handler = this.pending.get(msg.id);
          if (!handler) return;
          this.pending.delete(msg.id);
          if (msg.error) handler.reject(new Error(msg.error.message ?? "rpc error"));
          else handler.resolve(msg.result);
        } catch {
          // ignore parse errors
        }
      });
    });
  }

  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws) throw new Error("not connected");
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout waiting for ${method}`));
        }
      }, 30_000);
    });
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

interface CallSample {
  method: string;
  ms: number;
  ok: boolean;
}

async function runClient(
  clientIdx: number,
  args: CliArgs,
  token: string,
  rpcMix: string[],
): Promise<CallSample[]> {
  const client = new GatewayClient();
  await client.connect(token, `perf-client-${clientIdx}`);

  // Warmup — keep the cache hot, exclude from the report.
  for (let i = 0; i < args.warmup; i++) {
    await client.call(rpcMix[i % rpcMix.length]).catch(() => {});
  }

  const samples: CallSample[] = [];
  for (let i = 0; i < args.calls; i++) {
    const method = rpcMix[i % rpcMix.length];
    const t0 = performance.now();
    let ok = true;
    try {
      await client.call(method);
    } catch {
      ok = false;
    }
    samples.push({ method, ms: performance.now() - t0, ok });
  }
  await client.close();
  return samples;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

interface PerMethodStats {
  method: string;
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

function computeStats(samples: CallSample[]): PerMethodStats[] {
  const byMethod = new Map<string, CallSample[]>();
  for (const s of samples) {
    const list = byMethod.get(s.method) ?? [];
    list.push(s);
    byMethod.set(s.method, list);
  }
  const stats: PerMethodStats[] = [];
  for (const [method, list] of byMethod) {
    const okMs = list.filter((s) => s.ok).map((s) => s.ms);
    stats.push({
      method,
      count: list.length,
      errors: list.length - okMs.length,
      p50: Math.round(percentile(okMs, 50)),
      p95: Math.round(percentile(okMs, 95)),
      p99: Math.round(percentile(okMs, 99)),
      max: okMs.length > 0 ? Math.round(Math.max(...okMs)) : 0,
      mean:
        okMs.length > 0
          ? Math.round(okMs.reduce((sum, x) => sum + x, 0) / okMs.length)
          : 0,
    });
  }
  return stats.sort((a, b) => b.p95 - a.p95);
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`Week 4 Task 4 — concurrent gateway perf harness`);
  console.log(`  clients=${args.clients}, calls=${args.calls}, mix=${args.mix}, warmup=${args.warmup}`);

  let token: string;
  try {
    token = await getGatewayToken();
  } catch (err) {
    console.error(`Could not read gateway token from ${CONFIG_PATH}: ${String(err)}`);
    console.error(`Make sure OpenClaw is onboarded (\`pnpm openclaw onboard\`) before running.`);
    process.exit(1);
  }
  if (!token) {
    console.error("No gateway token in openclaw.json — run `pnpm openclaw onboard` first.");
    process.exit(1);
  }

  const rpcMix =
    args.mix === "cost"
      ? ["health", "config.get", "agents.list", "sentura.cost.summary", "sentura.health.summary"]
      : ["health", "config.get", "agents.list"];

  console.log(`  rpc mix: ${rpcMix.join(", ")}`);

  // Baseline — single client, single call per method, sequential.
  console.log("\n[baseline] 1 client × 1 call per method");
  const baselineStart = performance.now();
  const baseline = await runClient(-1, { ...args, calls: rpcMix.length, warmup: 0 }, token, rpcMix);
  const baselineMs = performance.now() - baselineStart;
  const baselineStats = computeStats(baseline);
  console.log(`  total ${Math.round(baselineMs)}ms`);
  for (const s of baselineStats) {
    console.log(`  ${s.method.padEnd(30)} mean=${s.mean}ms`);
  }

  // Concurrent — N clients in parallel.
  console.log(`\n[concurrent] ${args.clients} clients × ${args.calls} calls each, in parallel`);
  const concurrentStart = performance.now();
  const results = await Promise.all(
    Array.from({ length: args.clients }, (_, i) => runClient(i, args, token, rpcMix)),
  );
  const concurrentMs = performance.now() - concurrentStart;
  const concurrentSamples = results.flat();
  const concurrentStats = computeStats(concurrentSamples);
  const totalCalls = concurrentSamples.length;
  const totalErrors = concurrentSamples.filter((s) => !s.ok).length;
  console.log(
    `  total ${Math.round(concurrentMs)}ms, ${totalCalls} calls, ${totalErrors} errors, ` +
      `${(totalCalls / (concurrentMs / 1000)).toFixed(1)} calls/sec`,
  );
  for (const s of concurrentStats) {
    console.log(
      `  ${s.method.padEnd(30)} count=${s.count} err=${s.errors} ` +
        `p50=${s.p50}ms p95=${s.p95}ms p99=${s.p99}ms max=${s.max}ms`,
    );
  }

  // Bar: p95 ≤ 2× single-session mean.
  console.log("\n[verdict] Week 4 IC-4 bar: p95 ≤ 2× baseline mean per method");
  let allPass = true;
  for (const c of concurrentStats) {
    const baselineMean = baselineStats.find((b) => b.method === c.method)?.mean ?? 0;
    if (baselineMean === 0) continue;
    const passes = c.p95 <= baselineMean * 2;
    const flag = passes ? "PASS" : "FAIL";
    if (!passes) allPass = false;
    console.log(`  ${flag}  ${c.method.padEnd(30)} p95=${c.p95}ms vs baseline ${baselineMean}ms`);
  }

  if (totalErrors > 0) {
    console.log(`\n${totalErrors}/${totalCalls} calls errored — see logs above.`);
    process.exit(1);
  }
  if (!allPass) {
    console.log(`\nVerdict: FAIL — at least one method exceeded the 2× baseline budget.`);
    process.exit(2);
  }
  console.log(`\nVerdict: PASS — all methods within budget.`);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
