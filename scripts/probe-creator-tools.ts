/**
 * Probe: ask the live gateway exactly which tools it reports as available
 * to the `creator` agent. This is the authoritative source-of-truth for what
 * Forge sees when it runs — it bypasses LLM self-reports and avoids relying
 * on log output.
 *
 * Run: npx tsx scripts/probe-creator-tools.ts
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import WebSocket from "ws";

const GATEWAY_URL = "ws://localhost:18789";
const DEVICE_AUTH = path.join(os.homedir(), ".openclaw/identity/device-auth.json");
const CONFIG_PATH = path.join(os.homedir(), ".openclaw/openclaw.json");
const AGENT_ID = "creator";

type Token = { token: string; role: string; scopes: string[] };

function loadOperatorToken(): Token {
  // Prefer gateway.auth.token (the live gateway's expected token); fall back
  // to device-auth.json.
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as {
      gateway?: { auth?: { token?: string } };
    };
    const tok = cfg.gateway?.auth?.token;
    if (tok)
      return {
        token: tok,
        role: "operator",
        scopes: ["operator.read", "operator.write", "operator.admin"],
      };
  } catch {}
  const raw = fs.readFileSync(DEVICE_AUTH, "utf-8");
  const parsed = JSON.parse(raw) as {
    tokens: Record<string, { token: string; role: string; scopes: string[] }>;
  };
  const op = parsed.tokens?.operator;
  if (!op?.token) throw new Error("no operator token in device-auth.json");
  return op as Token;
}

async function ensureInsecureAuth(): Promise<() => void> {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Record<string, unknown>;
  const gw = ((cfg.gateway ?? {}) as Record<string, unknown>);
  const cui = ((gw.controlUi ?? {}) as Record<string, unknown>);
  if (cui.allowInsecureAuth === true) return () => {};
  cui.allowInsecureAuth = true;
  gw.controlUi = cui;
  cfg.gateway = gw;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n");
  console.log("  (enabled gateway.controlUi.allowInsecureAuth — will restore)");
  // Give the gateway a moment to hot-reload
  return () => {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Record<string, unknown>;
    const g = ((c.gateway ?? {}) as Record<string, unknown>);
    const u = ((g.controlUi ?? {}) as Record<string, unknown>);
    delete u.allowInsecureAuth;
    if (Object.keys(u).length === 0) delete g.controlUi;
    c.gateway = g;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2) + "\n");
    console.log("  (restored gateway.controlUi)");
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
          const handshake = {
            type: "req",
            id,
            method: "connect",
            params: {
              minProtocol: 4,
              maxProtocol: 4,
              client: {
                id: "openclaw-tui",
                displayName: "Sentura Probe",
                version: "0.1.0",
                platform: "node",
                mode: "ui",
              },
              caps: [],
              role: "operator",
              scopes,
              auth: { token },
            },
          };
          this.pending.set(id, {
            resolve: () => {
              clearTimeout(to);
              if (this.connectResolver) {
                this.connectResolver.resolve();
                this.connectResolver = null;
              }
            },
            reject: (e) => bail(e),
          });
          this.ws!.send(JSON.stringify(handshake));
          return;
        }
        if (msg.type === "res") {
          const handler = this.pending.get(msg.id as string);
          if (handler) {
            this.pending.delete(msg.id as string);
            if (msg.ok) handler.resolve(msg.payload);
            else
              handler.reject(
                new Error(
                  (msg.error as { message?: string } | undefined)?.message ?? "rpc error",
                ),
              );
          }
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

  close() {
    this.ws?.close();
  }
}

async function main() {
  const restore = await ensureInsecureAuth();
  await sleep(1500);
  const op = loadOperatorToken();
  const rpc = new RpcClient();
  try {
    await rpc.connect(GATEWAY_URL, op.token, op.scopes);
    console.log("connected. op scopes:", op.scopes.join(","));

    // 1. tools.catalog — global catalog of tools registered in the gateway.
    const catalog = (await rpc.rpc("tools.catalog", { agentId: AGENT_ID })) as {
      agentId?: string;
      groups?: Array<{
        id: string;
        label: string;
        source: string;
        pluginId?: string;
        tools?: Array<{ id: string; label: string; optional?: boolean }>;
      }>;
    };
    const groups = catalog?.groups ?? [];
    const allCatalogTools = groups.flatMap((g) =>
      (g.tools ?? []).map((t) => ({ ...t, groupId: g.id, source: g.source, pluginId: g.pluginId })),
    );
    console.log(
      `\ntools.catalog (agentId=${catalog?.agentId}): ${groups.length} groups, ${allCatalogTools.length} tools`,
    );
    for (const g of groups) {
      console.log(`  [${g.source}] ${g.label} (${g.id}): ${(g.tools ?? []).length} tools`);
      for (const t of g.tools ?? []) {
        console.log(`    - ${t.id}${t.optional ? " (optional)" : ""}`);
      }
    }
    const senturaInCatalog = allCatalogTools.filter((t) => t.id?.startsWith("sentura_"));
    console.log(
      `\n  sentura_* in catalog: ${senturaInCatalog.map((t) => t.id).join(", ") || "(none)"}`,
    );
    console.log(`  gateway in catalog: ${allCatalogTools.some((t) => t.id === "gateway") ? "YES" : "NO"}`);
    console.log(
      `  sentura_agents_manage in catalog: ${allCatalogTools.some((t) => t.id === "sentura_agents_manage") ? "YES" : "NO"}`,
    );

    // 2. sessions.list — pick most recent creator session
    const sessions = (await rpc.rpc("sessions.list", { limit: 50 })) as {
      sessions?: Array<{ key?: string; agentId?: string; updatedAt?: number }>;
    };
    const entries = sessions?.sessions ?? [];
    console.log(`\nsessions.list: ${entries.length} total sessions`);
    for (const s of entries.slice(0, 10)) {
      console.log(`  - key=${s.key} agentId=${s.agentId} updatedAt=${s.updatedAt}`);
    }
    const creatorSessions = entries
      .filter((s) => s.agentId === AGENT_ID)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    console.log(`  ${creatorSessions.length} for ${AGENT_ID}`);

    // Resolve tools.effective using any creator session OR fall back to any session if none.
    const targetSession = creatorSessions[0] ?? entries[0];
    if (!targetSession) {
      console.log("  no sessions found — cannot resolve tools.effective");
    } else {
      const sess = targetSession;
      console.log(`  using session key: ${sess.key} agent=${sess.agentId}`);
      try {
        const eff = (await rpc.rpc("tools.effective", {
          sessionKey: sess.key,
          agentId: AGENT_ID,
        })) as {
          groups?: Array<{
            source: string;
            label: string;
            tools?: Array<{ id: string; label: string }>;
          }>;
        };
        console.log("\ntools.effective for creator:");
        for (const g of eff?.groups ?? []) {
          console.log(`  [${g.source}] ${g.label}: ${g.tools?.length ?? 0} tools`);
          for (const t of g.tools ?? []) {
            const flag =
              t.id === "sentura_agents_manage" || t.id === "gateway" ? "  <== TARGET" : "";
            console.log(`    - ${t.id}${flag}`);
          }
        }
        const allIds = (eff?.groups ?? []).flatMap((g) => (g.tools ?? []).map((t) => t.id));
        console.log(`\nsummary: ${allIds.length} effective tools`);
        console.log(`  gateway exposed: ${allIds.includes("gateway") ? "YES" : "NO"}`);
        console.log(
          `  sentura_agents_manage exposed: ${allIds.includes("sentura_agents_manage") ? "YES" : "NO"}`,
        );
      } catch (err) {
        console.log(`  tools.effective failed: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.error("probe failed:", err);
    process.exitCode = 1;
  } finally {
    rpc.close();
    await sleep(300);
    restore();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
