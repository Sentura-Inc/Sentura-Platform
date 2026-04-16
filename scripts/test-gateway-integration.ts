/**
 * Integration test: verify Sentura's config structures work with a live OpenClaw gateway.
 * Requires: gateway running at localhost:18789
 *
 * Uses the `openclaw-tui` client identity with `allowInsecureAuth` to connect
 * from Node.js without browser device identity. The script temporarily enables
 * `gateway.controlUi.allowInsecureAuth` in the config file if needed, waits for
 * the gateway to hot-reload, then restores the original value on exit.
 *
 * Run: npx tsx scripts/test-gateway-integration.ts
 */

import WebSocket from "ws";
import fs from "node:fs/promises";
import path from "node:path";

const GATEWAY_URL = "ws://localhost:18789";
const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readConfig(): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

async function getGatewayToken(): Promise<string> {
  const config = await readConfig();
  const gw = config.gateway as Record<string, unknown> | undefined;
  const token = (gw?.token as string) ?? (gw?.auth as Record<string, unknown>)?.token as string ?? "";
  return token;
}

/**
 * Ensure gateway.controlUi.allowInsecureAuth is true so a Node.js client
 * (no browser device identity) can connect with operator scopes on localhost.
 * Returns a restore function that reverts the change.
 */
async function ensureAllowInsecureAuth(): Promise<() => Promise<void>> {
  const config = await readConfig();
  const gw = (config.gateway ?? {}) as Record<string, unknown>;
  const controlUi = (gw.controlUi ?? {}) as Record<string, unknown>;
  const wasSet = controlUi.allowInsecureAuth === true;

  if (wasSet) {
    return async () => {};
  }

  controlUi.allowInsecureAuth = true;
  gw.controlUi = controlUi;
  config.gateway = gw;
  await writeConfig(config);
  console.log("  (enabled gateway.controlUi.allowInsecureAuth for test — will restore after)");
  await sleep(1500);

  return async () => {
    const cfg = await readConfig();
    const g = (cfg.gateway ?? {}) as Record<string, unknown>;
    const cui = (g.controlUi ?? {}) as Record<string, unknown>;
    delete cui.allowInsecureAuth;
    if (Object.keys(cui).length === 0) delete g.controlUi;
    cfg.gateway = g;
    await writeConfig(cfg);
    console.log("  (restored gateway.controlUi — removed allowInsecureAuth)");
  };
}

class TestClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private idCounter = 0;
  private connectPromise: { resolve: () => void; reject: (e: Error) => void } | null = null;

  async connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectPromise = { resolve, reject };
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout (10s)"));
        this.ws?.close();
      }, 10_000);

      this.ws.on("close", (code, reason) => {
        clearTimeout(timeout);
        if (this.connectPromise) {
          this.connectPromise.reject(new Error(`Closed before handshake: code=${code} reason=${reason}`));
          this.connectPromise = null;
        }
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        if (this.connectPromise) {
          this.connectPromise.reject(err);
          this.connectPromise = null;
        }
      });

      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === "event" && msg.event === "connect.challenge") {
          // Respond with TUI identity — avoids browser origin check while
          // preserving operator scopes via allowInsecureAuth on localhost.
          const handshake = {
            type: "req",
            id: String(++this.idCounter),
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "openclaw-tui",
                displayName: "Sentura Test Client",
                version: "0.1.0",
                platform: "node",
                mode: "ui",
              },
              caps: [],
              role: "operator",
              scopes: ["operator.read", "operator.write", "operator.admin"],
              auth: { token },
            },
          };

          this.pending.set(handshake.id, {
            resolve: () => {
              clearTimeout(timeout);
              if (this.connectPromise) {
                this.connectPromise.resolve();
                this.connectPromise = null;
              }
            },
            reject: (err) => {
              clearTimeout(timeout);
              if (this.connectPromise) {
                this.connectPromise.reject(err);
                this.connectPromise = null;
              }
            },
          });

          this.ws!.send(JSON.stringify(handshake));
          return;
        }

        if (msg.type === "res") {
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            if (msg.ok) {
              handler.resolve(msg.payload);
            } else {
              handler.reject(new Error(msg.error?.message ?? "RPC error"));
            }
          }
        }
      });
    });
  }

  rpc<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = String(++this.idCounter);
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 15_000);

      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v as T); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });

      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  close() {
    this.ws?.close();
    for (const [, h] of this.pending) {
      h.reject(new Error("Client closed"));
    }
    this.pending.clear();
  }
}

async function main() {
  console.log("\x1b[1m\n╔═════════════════════════════════════════════════╗");
  console.log("║  Sentura Week 2 — Gateway Integration Tests     ║");
  console.log("╚═════════════════════════════════════════════════╝\x1b[0m");

  // --- Setup: ensure allowInsecureAuth for local TUI-style connection ---
  section("Setup");
  const restoreConfig = await ensureAllowInsecureAuth();

  const token = await getGatewayToken();
  if (!token) {
    console.log("  \x1b[31m✗ No gateway token in ~/.openclaw/openclaw.json (gateway.token or gateway.auth.token)\x1b[0m");
    await restoreConfig();
    process.exit(1);
  }
  check("Gateway token found", true);

  // --- Connect ---
  section("Gateway Handshake");
  const client = new TestClient();
  try {
    await client.connect(GATEWAY_URL, token);
    check("Challenge-response handshake succeeds", true);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    check(`Challenge-response handshake succeeds (${msg})`, false);
    await restoreConfig();
    process.exit(1);
  }

  // --- config.get ---
  section("config.get — Read Current Config");
  let configHash = "";
  try {
    const snapshot = await client.rpc<{ config: Record<string, unknown>; hash: string }>("config.get");
    const config = snapshot.config;
    configHash = snapshot.hash ?? "";
    check("config.get returns config object", typeof config === "object" && config !== null);
    check("config.get returns hash", configHash.length > 0);

    const agents = config.agents as { list?: Array<{ id: string; params?: Record<string, unknown> }> } | undefined;
    check("config has agents.list array", Array.isArray(agents?.list));

    const agentIds = (agents?.list ?? []).map((a) => a.id);
    console.log(`  Agents found: [${agentIds.join(", ")}]`);

    check("creator agent registered", agentIds.includes("creator"));
    check("tuner agent registered", agentIds.includes("tuner"));
    check("orchestrator agent registered", agentIds.includes("orchestrator"));

    for (const metaId of ["creator", "tuner", "orchestrator"]) {
      const agent = agents?.list?.find((a) => a.id === metaId);
      const dbPath = agent?.params?.memoryDbPath as string | undefined;
      check(`${metaId} has memoryDbPath`, typeof dbPath === "string" && dbPath.includes(metaId));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    check(`config.get failed: ${msg}`, false);
  }

  // --- config.patch — Register temp agent ---
  section("config.patch — Register Test Agent via RPC");
  const testAgentId = `integration-test-${Date.now()}`;
  try {
    const patch = JSON.stringify({
      agents: {
        list: [{
          id: testAgentId,
          name: "Integration Test Agent",
          model: "openai/gpt-4o-mini",
          tools: { profile: "minimal" },
          sandbox: { mode: "non-main" },
          params: { memoryDbPath: `~/.openclaw/memory/${testAgentId}/lancedb` },
        }],
      },
    });

    await client.rpc("config.patch", {
      raw: patch,
      baseHash: configHash,
      note: "Integration test: register temp agent",
    });
    check("config.patch accepted", true);

    const snapshot2 = await client.rpc<{ config: Record<string, unknown>; hash: string }>("config.get");
    configHash = snapshot2.hash ?? configHash;
    const agents2 = snapshot2.config.agents as { list?: Array<{ id: string; name?: string; params?: Record<string, unknown>; sandbox?: Record<string, unknown> }> };
    const agentIds2 = (agents2?.list ?? []).map((a) => a.id);
    check("Test agent appears after patch", agentIds2.includes(testAgentId));

    const testAgent = agents2?.list?.find((a) => a.id === testAgentId);
    check("Test agent has correct name", testAgent?.name === "Integration Test Agent");
    check("Test agent has memoryDbPath in params", Boolean(
      (testAgent?.params?.memoryDbPath as string | undefined)?.includes(testAgentId)
    ));
    check("Test agent has sandbox non-main", testAgent?.sandbox?.mode === "non-main");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    check(`config.patch failed: ${msg}`, false);
  }

  // --- Cleanup temp agent ---
  section("Cleanup — Remove Test Agent");
  try {
    const config = await readConfig();
    const agents = (config.agents ?? {}) as { list?: Array<{ id: string }> };
    const before = agents.list?.length ?? 0;
    agents.list = (agents.list ?? []).filter((a) => a.id !== testAgentId);
    config.agents = agents;
    await writeConfig(config);
    check(`Removed test agent (${before} → ${agents.list.length} agents)`, agents.list.length === before - 1);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    check(`Cleanup failed: ${msg}`, false);
  }

  // --- Bootstrap hook verification ---
  section("Bootstrap Hook — Configuration & Workspace Files");
  try {
    const snapshot3 = await client.rpc<{ config: Record<string, unknown>; hash: string }>("config.get");
    const hookCfg = snapshot3.config.hooks as { internal?: { enabled?: boolean; entries?: Record<string, { enabled?: boolean }> } } | undefined;
    check("hooks.internal.enabled is not false", hookCfg?.internal?.enabled !== false);
    check("sentura-bootstrap entry exists", Boolean(hookCfg?.internal?.entries?.["sentura-bootstrap"]));
    check("sentura-bootstrap enabled", hookCfg?.internal?.entries?.["sentura-bootstrap"]?.enabled === true);

    for (const agentId of ["creator", "tuner", "orchestrator"]) {
      const wsDir = path.join(OPENCLAW_HOME, "workspace", agentId);
      const entries = await fs.readdir(wsDir).catch(() => [] as string[]);
      check(`${agentId} workspace has RULES.md`, entries.includes("RULES.md"));
      check(`${agentId} workspace has CONTEXT.md`, entries.includes("CONTEXT.md"));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    check(`Bootstrap hook check failed: ${msg}`, false);
  }

  // --- health endpoint ---
  section("HTTP Health Endpoint");
  try {
    const resp = await fetch("http://localhost:18789/health");
    check("GET /health returns 200", resp.status === 200);
    const body = await resp.json() as Record<string, unknown>;
    check("Health response has status field", typeof body.status === "string" || typeof body.ok !== "undefined");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    check(`Health check failed: ${msg}`, false);
  }

  // --- Done ---
  client.close();
  await restoreConfig();

  console.log(`\n\x1b[1m━━━ Results ━━━\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m`);
  if (failed > 0) {
    console.log(`  \x1b[31m${failed} failed\x1b[0m`);
  }
  console.log(`  ${passed + failed} total\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
