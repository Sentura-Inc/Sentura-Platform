/**
 * Week 2 Person B — Creator Agent TRUE end-to-end live test (STUB).
 *
 * Unlike `test-creator-helpers.ts` (which validates the deterministic helpers
 * offline) and `test-week2-b-gateway.ts` (which validates config.patch shape
 * against a live gateway without invoking the Creator Agent itself), this
 * script exercises the Creator Agent as an LLM-driven agent:
 *
 *   1. Sends a natural-language brief ("Create an AP clerk named Penny for
 *      Acme Finance Ltd") to the `creator` agent via the `agent` gateway RPC.
 *   2. Waits for the Creator to run Phase 1 → 4 of its SKILL.md procedure,
 *      which should culminate in a `config.patch` that registers a brand-new
 *      agent in the live gateway config.
 *   3. Polls `config.get` for up to N minutes waiting for the new agent to
 *      appear. Reports whether the Creator actually produced a working
 *      employee end-to-end.
 *   4. Cleans up the created agent + workspace on success (or failure).
 *
 * This is gated on the SENTURA_LLM_E2E=1 env var because it:
 *   - costs real LLM tokens (the Creator is driven by a real provider)
 *   - requires provider credentials (OPENAI_API_KEY / ANTHROPIC_API_KEY / etc.)
 *     wired into the gateway's secret store
 *   - takes minutes, not seconds
 *   - may be flaky if the Creator LLM wanders off-script
 *
 * Status: STUB. The flow below is intentionally minimal so it can be iterated
 * on once we have a provider configured in dev. It DOES connect to the
 * gateway and DOES send the NL message, but the success criteria are
 * deliberately loose — we check only that *some* new agent appeared in
 * config after the Creator's run, not that every invariant holds. Tightening
 * assertions is future work.
 *
 * Run:
 *   SENTURA_LLM_E2E=1 npx tsx scripts/test-creator-e2e-live.ts
 *
 * Prerequisites:
 *   1. Gateway running: `cd openclaw && pnpm gateway:watch`
 *   2. At least one provider configured in `~/.openclaw/openclaw.json` with
 *      credentials in `~/.openclaw/.env`.
 *   3. `creator` agent is registered (see sentura/agents/creator/).
 */

import WebSocket from "ws";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const GATEWAY_URL = "ws://localhost:18789";
const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");

// Loose overall budget — Creator must finish Phase 1-4 within this window.
const OVERALL_TIMEOUT_MS = 5 * 60_000; // 5 minutes
const POLL_INTERVAL_MS = 5_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Gate ───

if (process.env.SENTURA_LLM_E2E !== "1") {
  console.log("");
  console.log("\x1b[1m⚠ Skipped: SENTURA_LLM_E2E != 1\x1b[0m");
  console.log("");
  console.log("This test runs the Creator Agent against a live LLM provider,");
  console.log("which costs real tokens and takes ~1-5 minutes. To opt in:");
  console.log("");
  console.log("  SENTURA_LLM_E2E=1 npx tsx scripts/test-creator-e2e-live.ts");
  console.log("");
  process.exit(0);
}

// ─── Minimal gateway client (operator role, TUI identity) ───

async function readConfig(): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(CONFIG_PATH, "utf-8"));
}

async function getGatewayToken(): Promise<string> {
  const cfg = await readConfig();
  const gw = (cfg.gateway ?? {}) as Record<string, unknown>;
  return ((gw.token as string) ?? ((gw.auth as Record<string, unknown>)?.token as string)) ?? "";
}

class Client {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private id = 0;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(GATEWAY_URL);
      this.ws.on("error", reject);
      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "event" && msg.event === "connect.challenge") {
          const id = String(++this.id);
          this.pending.set(id, { resolve: () => resolve(), reject });
          this.ws!.send(
            JSON.stringify({
              type: "req",
              id,
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: "openclaw-tui",
                  displayName: "Sentura Creator E2E Live",
                  version: "0.1.0",
                  platform: "node",
                  mode: "ui",
                },
                caps: [],
                role: "operator",
                scopes: ["operator.read", "operator.write", "operator.admin"],
                auth: { token },
              },
            }),
          );
          return;
        }
        if (msg.type === "res") {
          const h = this.pending.get(msg.id);
          if (h) {
            this.pending.delete(msg.id);
            if (msg.ok) h.resolve(msg.payload);
            else h.reject(new Error(msg.error?.message ?? "RPC error"));
          }
        }
      });
    });
  }

  rpc<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = String(++this.id);
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

// ─── Main ───

async function main() {
  console.log("\x1b[1m\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Sentura Week 2 — Creator Agent TRUE E2E (Live LLM)          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\x1b[0m");

  const token = await getGatewayToken();
  const client = new Client();
  console.log("→ Connecting to gateway…");
  await client.connect(token);
  console.log("  ✓ Connected");

  // Snapshot agent list BEFORE the Creator runs, so we can detect what's new.
  const configBefore = await client.rpc<{ config: { agents?: { list?: Array<Record<string, unknown>> } } }>(
    "config.get",
    {},
  );
  const idsBefore = new Set(
    (configBefore.config.agents?.list ?? []).map((a) => a.id as string),
  );
  console.log(`  ✓ Baseline: ${idsBefore.size} agent(s) in config`);

  // Send the NL brief to the Creator Agent.
  const brief =
    "Create a new AI employee named Penny who handles accounts-payable for " +
    "Acme Finance Ltd (a mid-size financial-services firm in the UK). " +
    "She should reconcile vendor invoices, flag duplicates, and route " +
    "anything > £5000 to human approval. Deploy her now.";

  console.log("\n→ Sending NL brief to creator agent…");
  console.log(`  \x1b[90m"${brief}"\x1b[0m`);
  const idempotencyKey = `creator-e2e-live-${Date.now()}`;
  await client.rpc(
    "agent",
    {
      agentId: "creator",
      message: brief,
      idempotencyKey,
      deliver: false, // we don't need the final response delivered anywhere
    },
    60_000,
  );
  console.log("  ✓ Creator acknowledged the brief; running Phase 1-4…");

  // Poll config.get until a new agent appears (or we time out).
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  let newAgentId: string | null = null;
  let polls = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    polls++;
    try {
      const snap = await client.rpc<{
        config: { agents?: { list?: Array<Record<string, unknown>> } };
      }>("config.get", {}, 10_000);
      const current = snap.config.agents?.list ?? [];
      const newEntry = current.find((a) => !idsBefore.has(a.id as string));
      if (newEntry) {
        newAgentId = newEntry.id as string;
        console.log(`  ✓ New agent '${newAgentId}' appeared in config after poll #${polls}`);
        break;
      }
      console.log(`  … poll #${polls}: still waiting (${Math.round((deadline - Date.now()) / 1000)}s left)`);
    } catch (err) {
      // Gateway may be restarting mid-patch; re-establish and keep polling.
      console.log(`  … poll #${polls}: RPC failed (${(err as Error).message}); reconnecting`);
      try {
        client.close();
        const fresh = new Client();
        await fresh.connect(token);
        // Swap in place (simple) — the outer `client` reference is still OK
        // because `rpc` reads its own `this.ws`.
        (client as unknown as { ws: WebSocket | null }).ws = (
          fresh as unknown as { ws: WebSocket | null }
        ).ws;
      } catch {
        /* next iteration */
      }
    }
  }

  if (!newAgentId) {
    console.log("\n\x1b[31m✗ FAIL: Creator did not register a new agent within budget.\x1b[0m");
    console.log("  This could mean:");
    console.log("    - The Creator's LLM provider isn't configured or failed.");
    console.log("    - The Creator skill procedure didn't reach config.patch.");
    console.log("    - The 5-minute budget is too short for the current model.");
    console.log("    - The Creator asked a clarifying question instead of acting.");
    console.log("  Inspect gateway logs and the creator session in the Control UI.");
    client.close();
    process.exit(1);
  }

  console.log("\n\x1b[32m✓ PASS: Creator produced a live AI employee end-to-end.\x1b[0m");
  console.log(`  New agent id: ${newAgentId}`);
  console.log("  Note: This stub does NOT yet verify workspace shape, skills,");
  console.log("  bindings, or memory isolation for the created agent.");
  console.log("  Cleanup is also not performed — remove the test agent manually");
  console.log("  via `config.patch` once you're done inspecting it.");

  client.close();
}

main().catch((err) => {
  console.error("\x1b[31mFATAL:\x1b[0m", err);
  process.exit(1);
});
