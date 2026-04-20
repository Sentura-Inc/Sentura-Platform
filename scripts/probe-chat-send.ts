/**
 * Probe: trigger a real `chat.send` against Forge as the dashboard does, then
 * capture the `[sentura-debug] attempt.effectiveTools` line written by the
 * instrumented embedded runner. The debug line tells us exactly what tool
 * names the LLM receives on this path.
 *
 * Run: npx tsx scripts/probe-chat-send.ts
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import WebSocket from "ws";

const GATEWAY_URL = "ws://localhost:18789";
const CONFIG_PATH = path.join(os.homedir(), ".openclaw/openclaw.json");
const AGENT_ID = "creator";
const LOG_FILE = "/tmp/gateway-latest.log";

function loadOperatorToken(): { token: string; scopes: string[] } {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as {
    gateway?: { auth?: { token?: string } };
  };
  const tok = cfg.gateway?.auth?.token;
  if (!tok) throw new Error("no gateway.auth.token in openclaw.json");
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
                minProtocol: 3,
                maxProtocol: 3,
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

  rpc<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 60_000): Promise<T> {
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

async function main() {
  const { token, scopes } = loadOperatorToken();
  const rpc = new Rpc();
  await rpc.connect(GATEWAY_URL, token, scopes);
  console.log("connected");

  const session = (await rpc.rpc("sessions.create", { agentId: AGENT_ID })) as {
    key?: string;
    sessionKey?: string;
  };
  const sessionKey = (session.key ?? session.sessionKey) as string;
  console.log("created session", sessionKey);

  const logStart = fs.statSync(LOG_FILE).size;

  await rpc.rpc(
    "chat.send",
    {
      message:
        "Reply with the literal word OK and nothing else. Do not call any tools.",
      sessionKey,
      idempotencyKey: `probe-${Date.now()}`,
    },
    120_000,
  );
  console.log("chat.send done");

  // Give the embedded runner a moment to flush logs
  await new Promise((r) => setTimeout(r, 1500));

  const logBuf = fs.readFileSync(LOG_FILE);
  const tail = logBuf.subarray(logStart).toString("utf-8");
  const hits = tail.split(/\r?\n/).filter((l) => l.includes("sentura-debug"));
  console.log(`\n[debug log lines]: ${hits.length}`);
  for (const h of hits) {
    console.log(h);
  }

  rpc.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
