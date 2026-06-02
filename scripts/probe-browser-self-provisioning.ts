/**
 * Probe: create a real dashboard-style session for Forge, ask it to use the
 * browser tool on a harmless page, and verify that the conversation transcript
 * shows both the browser tool call and the expected page title.
 *
 * Run:
 *   node --import ./openclaw/node_modules/tsx/dist/loader.mjs scripts/probe-browser-self-provisioning.ts
 *
 * Requires:
 * - local gateway listening on :18789
 * - Creator agent auth profile configured for its model/provider
 * - Docker daemon available for sandbox startup
 * - browser extension loaded by the gateway
 * - agents.defaults.sandbox.browser.enabled = true
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "../openclaw/node_modules/ws/index.js";

const GATEWAY_URL = "ws://localhost:18789";
const CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");
const AGENT_ID = "creator";

type TranscriptMessage = {
  role?: string;
  content?: unknown;
  toolName?: string;
};

function loadOperatorToken(): { token: string; scopes: string[] } {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as {
    gateway?: { auth?: { token?: string } };
  };
  const token = cfg.gateway?.auth?.token;
  if (!token) {
    throw new Error("No gateway.auth.token found in ~/.openclaw/openclaw.json");
  }
  return {
    token,
    scopes: ["operator.read", "operator.write", "operator.admin"],
  };
}

function flattenContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((entry) =>
      entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string"
        ? entry.text
        : "",
    )
    .join("");
}

class RpcClient {
  ws!: WebSocket;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private counter = 0;
  readonly toolEvents: Array<{ name?: string; sessionKey?: string }> = [];

  async connect(url: string, token: string, scopes: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("connect timeout")), 10_000);
      this.ws = new WebSocket(url);
      this.ws.on("error", reject);
      this.ws.on("message", (data) => {
        const frame = JSON.parse(data.toString()) as Record<string, unknown>;
        if (frame.type === "event") {
          if (frame.event === "connect.challenge") {
            const id = this.nextId();
            this.pending.set(id, {
              resolve: () => {
                clearTimeout(timeout);
                resolve();
              },
              reject,
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
                    displayName: "Sentura Browser Probe",
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
            return;
          }
          if (frame.event === "session.tool") {
            const payload = (frame.payload ?? {}) as {
              sessionKey?: string;
              data?: { name?: string };
            };
            this.toolEvents.push({
              name: payload.data?.name,
              sessionKey: payload.sessionKey,
            });
          }
          return;
        }
        if (frame.type === "res") {
          const handler = this.pending.get(String(frame.id));
          if (!handler) {
            return;
          }
          this.pending.delete(String(frame.id));
          if (frame.ok) {
            handler.resolve(frame.payload);
          } else {
            handler.reject(
              new Error(
                ((frame.error as { message?: string } | undefined)?.message) ?? "rpc error",
              ),
            );
          }
        }
      });
    });
  }

  nextId(): string {
    this.counter += 1;
    return `rpc-${this.counter}-${Date.now()}`;
  }

  async rpc<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs = 60_000): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const id = this.nextId();
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`rpc timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

async function pollTranscript(
  rpc: RpcClient,
  sessionKey: string,
  timeoutMs = 90_000,
): Promise<TranscriptMessage[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let history: { messages?: TranscriptMessage[] };
    try {
      history = await rpc.rpc<{ messages?: TranscriptMessage[] }>("chat.history", {
        sessionKey,
        limit: 50,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("chat.history unavailable during gateway startup")) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      throw error;
    }
    const messages = history.messages ?? [];
    const assistantText = messages
      .filter((message) => message.role === "assistant")
      .map((message) => flattenContent(message.content))
      .join("\n");
    if (
      assistantText.includes("BROWSER_OK: Example Domain")
      || assistantText.includes("BROWSER_UNAVAILABLE")
    ) {
      return messages;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    "Timed out waiting for browser probe response in transcript. Check the gateway log for model auth or sandbox startup failures.",
  );
}

async function main() {
  const { token, scopes } = loadOperatorToken();
  const rpc = new RpcClient();
  await rpc.connect(GATEWAY_URL, token, scopes);
  console.log("connected");

  await rpc.rpc("sessions.subscribe");
  const session = await rpc.rpc<{ key?: string; sessionKey?: string }>("sessions.create", {
    agentId: AGENT_ID,
  });
  const sessionKey = session.key ?? session.sessionKey;
  if (!sessionKey) {
    throw new Error("sessions.create did not return a session key");
  }
  console.log("created session", sessionKey);

  await rpc.rpc("chat.send", {
    sessionKey,
    idempotencyKey: `browser-probe-${Date.now()}`,
    message:
      "Use the browser tool to open https://example.com. After reading the page title, reply with exactly `BROWSER_OK: Example Domain`. If the browser tool is unavailable, reply with exactly `BROWSER_UNAVAILABLE`.",
  }, 120_000);
  console.log("chat.send dispatched");

  const messages = await pollTranscript(rpc, sessionKey);
  const toolHit = rpc.toolEvents.some(
    (entry) => entry.sessionKey === sessionKey && entry.name === "browser",
  ) || messages.some((message) => message.toolName === "browser");
  const assistantText = messages
    .filter((message) => message.role === "assistant")
    .map((message) => flattenContent(message.content))
    .join("\n");

  console.log(`browser tool observed: ${toolHit ? "YES" : "NO"}`);
  console.log(`assistant reply: ${assistantText}`);

  if (!toolHit) {
    throw new Error("Transcript did not show a browser tool invocation for the dashboard-created session.");
  }
  if (!assistantText.includes("BROWSER_OK: Example Domain")) {
    throw new Error(`Unexpected assistant output: ${assistantText}`);
  }

  rpc.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
