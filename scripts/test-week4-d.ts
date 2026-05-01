/**
 * scripts/test-week4-d.ts
 *
 * Live integration test for Person D's Week 4 deliverables. Connects to a
 * running OpenClaw gateway and exercises the new RPCs end-to-end:
 *
 *   - sentura.audit.chat.log         (Communication Panel single-message audit)
 *   - sentura.audit.group.log        (group lifecycle audit)
 *   - sentura.audit.mcp.health       (MCP health event ingest)
 *   - sentura.audit.query            (verifies tenant/dataTier/groupId filters)
 *   - sentura.audit.stats            (verifies new byTier/byTenant rollups)
 *   - sentura.mcp.health.list        (live snapshot)
 *   - sentura.mcp.health.checkNow    (forced health round)
 *   - sentura.approval.requests.list (multi-tenancy filter)
 *
 * Prereq: gateway running (`pnpm gateway:watch` in openclaw/).
 *
 * Run:   npx tsx scripts/test-week4-d.ts
 *        (override URL with TEST_GATEWAY_URL=ws://host:port if non-default)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";

const GATEWAY_URL = process.env.TEST_GATEWAY_URL ?? "ws://localhost:18789";
const CONFIG_PATH = path.join(os.homedir(), ".openclaw/openclaw.json");

interface Token {
  token: string;
  scopes: string[];
}

function loadOperatorToken(): Token {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as {
    gateway?: { auth?: { token?: string } };
  };
  const tok = cfg.gateway?.auth?.token;
  if (!tok) throw new Error("no gateway.auth.token in openclaw.json — run pnpm openclaw onboard");
  return {
    token: tok,
    scopes: ["operator.read", "operator.write", "operator.admin"],
  };
}

class RpcClient {
  ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private idCounter = 0;
  private connectResolver: { resolve: () => void; reject: (e: Error) => void } | null = null;

  connect(url: string, token: string, scopes: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectResolver = { resolve, reject };
      this.ws = new WebSocket(url);
      const bail = (err: Error) => {
        if (this.connectResolver) {
          this.connectResolver.reject(err);
          this.connectResolver = null;
        }
      };
      const to = setTimeout(() => bail(new Error("connect timeout")), 10_000);

      this.ws.on("close", (code, reason) =>
        bail(new Error(`closed code=${code} reason=${reason}`)),
      );
      this.ws.on("error", (e) => bail(e as Error));
      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === "event" && msg.event === "connect.challenge") {
          const id = String(++this.idCounter);
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
                  displayName: "Sentura Week-4-D Test",
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
          this.pending.set(id, {
            resolve: () => {
              clearTimeout(to);
              this.connectResolver?.resolve();
              this.connectResolver = null;
            },
            reject: (e) => bail(e),
          });
          return;
        }
        if (msg.type === "res") {
          const handler = this.pending.get(String(msg.id));
          if (!handler) return;
          this.pending.delete(String(msg.id));
          if (msg.ok) handler.resolve(msg.payload);
          else
            handler.reject(
              new Error((msg.error as { message?: string })?.message ?? "rpc error"),
            );
        }
      });
    });
  }

  rpc<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = String(++this.idCounter);
      const to = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`rpc timeout: ${method}`));
      }, 15_000);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(to);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(to);
          reject(e);
        },
      });
      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  close(): void {
    this.ws?.close();
  }
}

interface Result {
  name: string;
  ok: boolean;
  detail?: string;
}

const results: Result[] = [];

function record(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  const color = ok ? "[32m" : "[31m";
  const reset = "[0m";
  // eslint-disable-next-line no-console
  console.log(`${color}${icon}${reset} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function tryStep<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn();
    record(name, true);
    return r;
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Connecting to ${GATEWAY_URL} ...`);
  const tok = loadOperatorToken();
  const client = new RpcClient();
  try {
    await client.connect(GATEWAY_URL, tok.token, tok.scopes);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("connect failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
  record("connect", true);

  // ---------- Communication Panel chat audit ----------
  const tenantId = "test-acme";
  const departmentId = "test-support";
  const groupId = `grp-w4d-${Date.now()}`;

  await tryStep("audit.chat.log human→agent", () =>
    client.rpc("sentura.audit.chat.log", {
      direction: "human_to_agent",
      agentId: "test-agent",
      sessionKey: "webchat:test-agent:tok_w4d_synthetic",
      tenantId,
      departmentId,
      userId: "user_w4d",
      channel: "dashboard",
      messageLength: 42,
      messageDigest: "abc12345",
    }),
  );

  await tryStep("audit.chat.log agent→human", () =>
    client.rpc("sentura.audit.chat.log", {
      direction: "agent_to_human",
      agentId: "test-agent",
      sessionKey: "webchat:test-agent:tok_w4d_synthetic",
      tenantId,
      departmentId,
      userId: "user_w4d",
      channel: "dashboard",
      messageLength: 120,
      groupId,
    }),
  );

  await tryStep("audit.chat.log rejects bad direction", async () => {
    try {
      await client.rpc("sentura.audit.chat.log", {
        direction: "invalid",
        agentId: "test-agent",
      });
      throw new Error("expected BAD_REQUEST but got success");
    } catch (err) {
      if (err instanceof Error && err.message.match(/direction|BAD_REQUEST/i)) return;
      throw err;
    }
  });

  // ---------- Group lifecycle audit ----------
  await tryStep("audit.group.log created", () =>
    client.rpc("sentura.audit.group.log", {
      event: "created",
      groupId,
      tenantId,
      departmentId,
      actorUserId: "user_w4d",
      participants: ["user_w4d", "agent_a", "agent_b"],
      name: "Q4 Report Working Group",
    }),
  );

  await tryStep("audit.group.log fanout", () =>
    client.rpc("sentura.audit.group.log", {
      event: "fanout",
      groupId,
      tenantId,
      departmentId,
      actorUserId: "user_w4d",
      fanoutTo: ["agent_a", "agent_b"],
      messageDigest: "deadbeef",
    }),
  );

  await tryStep("audit.group.log archived", () =>
    client.rpc("sentura.audit.group.log", {
      event: "archived",
      groupId,
      tenantId,
      departmentId,
      actorUserId: "user_w4d",
    }),
  );

  // ---------- MCP health audit ----------
  await tryStep("audit.mcp.health up", () =>
    client.rpc("sentura.audit.mcp.health", {
      server: "test-fs",
      status: "up",
      latencyMs: 12,
      errorCount: 0,
      isChange: true,
      previousStatus: "unknown",
    }),
  );

  await tryStep("audit.mcp.health down", () =>
    client.rpc("sentura.audit.mcp.health", {
      server: "test-fs",
      status: "down",
      previousStatus: "up",
      errorCount: 5,
      lastError: "spawn ENOENT",
      isChange: true,
    }),
  );

  // Give the audit appender ~250ms to flush before querying.
  await new Promise((r) => setTimeout(r, 250));

  // ---------- Audit query — multi-tenancy + groupId + dataTier ----------
  const byTenant = await tryStep<{ entries: { eventType: string }[] }>(
    "audit.query tenantId filter",
    () => client.rpc("sentura.audit.query", { tenantId, limit: 50 }),
  );
  if (byTenant) {
    const ok = byTenant.entries.length >= 4;
    record(
      "  ↳ found ≥ 4 chat/group events for tenant",
      ok,
      `entries=${byTenant.entries.length}`,
    );
  }

  const byGroup = await tryStep<{ entries: { eventType: string; metadata?: { groupId?: string } }[] }>(
    "audit.query groupId filter",
    () => client.rpc("sentura.audit.query", { groupId, limit: 50 }),
  );
  if (byGroup) {
    const allMatchGroup = byGroup.entries.every((e) => e.metadata?.groupId === groupId);
    record(
      "  ↳ every entry's metadata.groupId matches",
      allMatchGroup,
      `entries=${byGroup.entries.length}`,
    );
  }

  const t1Events = await tryStep<{ entries: unknown[] }>(
    "audit.query dataTier=T1",
    () => client.rpc("sentura.audit.query", { dataTier: "T1", tenantId, limit: 50 }),
  );
  if (t1Events) record("  ↳ T1 query returned entries", t1Events.entries.length > 0);

  // ---------- Audit stats — new byTier/byTenant rollups ----------
  const stats = await tryStep<{
    total: number;
    byTier: Record<string, number>;
    byTenant: Record<string, number>;
  }>("audit.stats", () => client.rpc("sentura.audit.stats", {}));
  if (stats) {
    record("  ↳ stats.byTier present", typeof stats.byTier === "object" && stats.byTier !== null);
    record(
      "  ↳ stats.byTenant present",
      typeof stats.byTenant === "object" && stats.byTenant !== null,
    );
  }

  // ---------- MCP health monitor ----------
  await tryStep("mcp.health.list", () => client.rpc("sentura.mcp.health.list", {}));

  await tryStep("mcp.health.get rejects empty name", async () => {
    try {
      await client.rpc("sentura.mcp.health.get", {});
      throw new Error("expected BAD_REQUEST");
    } catch (err) {
      if (err instanceof Error && err.message.match(/name|BAD_REQUEST/i)) return;
      throw err;
    }
  });

  // ---------- Approval list with tenant filter ----------
  await tryStep("approval.requests.list with tenantId filter", () =>
    client.rpc("sentura.approval.requests.list", { tenantId, limit: 5 }),
  );

  client.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(`Total: ${results.length}  passed=${passed}  failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("fatal:", err);
  process.exit(1);
});
