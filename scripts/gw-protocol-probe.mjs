// 网关协议探针 — 模拟 Sentura dashboard 的连接(minProtocol=maxProtocol=4 + token)
// 用途:实证网关是否接受 dashboard 的协议版本 4 + token,证伪/坐实"版本太老连不上"。
// 用法:OPENCLAW_DIR=/root/sentura/openclaw node scripts/gw-protocol-probe.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/sentura/openclaw";
const require = createRequire(path.join(OPENCLAW_DIR, "package.json"));
const WS = require("ws");
const WebSocket = WS.WebSocket || WS;
const GATEWAY_URL = process.env.GW_URL || "ws://127.0.0.1:18789";
const token = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".openclaw/openclaw.json"), "utf8")).gateway.auth.token;

const ORIGIN = process.env.ORIGIN || "";
const ws = new WebSocket(GATEWAY_URL, ORIGIN ? { headers: { Origin: ORIGIN } } : undefined);
const pending = new Map();
let idc = 0;
const send = (method, params) => {
  const id = String(++idc);
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ type: "req", id, method, params }));
  });
};
const fail = (msg) => { console.log("PROBE_FAIL: " + msg); process.exit(1); };
setTimeout(() => fail("timeout 15s"), 15000);

ws.on("error", (e) => fail("ws error: " + e.message));
ws.on("message", async (d) => {
  const m = JSON.parse(d.toString());
  if (m.type === "event" && m.event === "connect.challenge") {
    try {
      const payload = await send("connect", {
        minProtocol: 4, maxProtocol: 4,
        client: { id: "openclaw-control-ui", displayName: "Sentura Dashboard Probe", version: "0.1.0", platform: "browser", mode: "ui" },
        caps: [], role: "operator",
        scopes: ["operator.read", "operator.write", "operator.admin", "operator.approvals"],
        auth: { token },
      });
      console.log("CONNECT_OK protocol=4 accepted; negotiated=" + JSON.stringify(payload?.protocol ?? payload));
      const cfg = await send("config.get", {});
      console.log("RPC_OK config.get returned keys=" + Object.keys(cfg || {}).slice(0, 6).join(","));
      console.log("VERDICT: gateway accepts dashboard protocol 4 + token -> NOT a version problem");
      process.exit(0);
    } catch (e) { fail("connect/rpc rejected: " + e.message); }
    return;
  }
  if (m.type === "res") {
    const h = pending.get(m.id);
    if (!h) return;
    pending.delete(m.id);
    if (m.ok) h.res(m.payload);
    else h.rej(new Error((m.error && (m.error.message || JSON.stringify(m.error))) || "rpc error"));
  }
});
