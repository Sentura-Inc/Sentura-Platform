// Sentura 跨境电商 cbe 员工 — 压测驱动(gateway WS 生产路径)
// ---------------------------------------------------------------------------
// 走 OpenClaw gateway 的 `agent`(enqueue,返回 runId)+ `agent.wait`(阻塞到
// 跑完)两段式 RPC —— 与 dashboard chat.send 同一条共享 Main lane,而非 Next.js
// /run 诊断路由(那条 off-path、无认证、花真钱,审计禁止用于压测)。
//
// 协议要点:OpenClaw 不是 JSON-RPC 2.0,用 connect.challenge 握手 + token
// (~/.openclaw/openclaw.json 的 gateway.auth.token)。参考 docs/gateway-rpc.md
// 和 scripts/probe-creator-tools.ts。
//
// 负载单元:每发 = 一次纯 DeepSeek 推理(~120 字中文,提示词明确不调用工具)。
// 不带外部工具调用 → 可复现、无 API 噪声、不花付费数据的钱。
//
// 用法(在能解析到 openclaw `ws` 模块的机器上,通常就是服务器):
//   OPENCLAW_DIR=/root/sentura/openclaw node scripts/cbe-loadtest.mjs <并发> <总数> <档名>
//   例: OPENCLAW_DIR=/root/sentura/openclaw node scripts/cbe-loadtest.mjs 8 80 r2
// 环境变量:
//   OPENCLAW_DIR   openclaw 仓库根(用于解析 ws 模块),默认 /root/sentura/openclaw
//   GW_URL         gateway WS 地址,默认 ws://127.0.0.1:18789
//   REQ_TIMEOUT_MS 客户端单 RPC 超时,默认 240000
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/sentura/openclaw";
const require = createRequire(path.join(OPENCLAW_DIR, "package.json"));
const WS = require("ws");
const WebSocket = WS.WebSocket || WS;

const GATEWAY_URL = process.env.GW_URL || "ws://127.0.0.1:18789";
const CONFIG_PATH = path.join(os.homedir(), ".openclaw/openclaw.json");
const token = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")).gateway.auth.token;

const CONCURRENCY = Number(process.argv[2] || 1);
const TOTAL = Number(process.argv[3] || 3);
const RUNG = process.argv[4] || "r";
const REQ_TIMEOUT_MS = Number(process.env.REQ_TIMEOUT_MS || 240000);

const AGENTS = ["cbe-lead-discovery", "cbe-buyer-screening", "cbe-accio-memory"];
const PROMPTS = {
  "cbe-lead-discovery":
    "用中文写一段约120字的分析:一家做太阳能逆变器的中国出口商想开拓德国市场,列出3个最该优先接触的客户类型和理由。只输出分析正文,不要调用任何工具。",
  "cbe-buyer-screening":
    "用中文写一段约120字的尽调要点:评估一个声称年采购量10万台LED灯的英国买家是否可信,列出4个最关键的核验信号。只输出正文,不要调用任何工具。",
  "cbe-accio-memory":
    "用中文把这段对话浓缩成3条采购意向要点:客户想买工业级3D打印机,预算单台2万美元,月需求约15台,倾向FDM大尺寸机型。只输出3条要点,不要调用任何工具。",
};

class Rpc {
  constructor() { this.pending = new Map(); this.id = 0; this.ws = null; }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(GATEWAY_URL);
      const to = setTimeout(() => reject(new Error("connect timeout")), 15000);
      this.ws.on("error", reject);
      this.ws.on("message", (d) => {
        const m = JSON.parse(d.toString());
        if (m.type === "event" && m.event === "connect.challenge") {
          const id = String(++this.id);
          this.pending.set(id, { resolve: () => { clearTimeout(to); resolve(); }, reject });
          this.ws.send(JSON.stringify({
            type: "req", id, method: "connect",
            params: {
              minProtocol: 4, maxProtocol: 4,
              client: { id: "openclaw-tui", displayName: "Sentura LoadTest", version: "0.1.0", platform: "node", mode: "ui" },
              caps: [], role: "operator",
              scopes: ["operator.read", "operator.write", "operator.admin"],
              auth: { token },
            },
          }));
          return;
        }
        if (m.type === "res") {
          const h = this.pending.get(m.id);
          if (!h) return;
          this.pending.delete(m.id);
          if (m.ok) h.resolve(m.payload);
          else h.reject(new Error((m.error && (m.error.message || JSON.stringify(m.error))) || "rpc error"));
        }
      });
    });
  }
  rpc(method, params = {}, timeoutMs = REQ_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const id = String(++this.id);
      const to = setTimeout(() => { this.pending.delete(id); reject(new Error("rpc timeout")); }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(to); resolve(v); },
        reject: (e) => { clearTimeout(to); reject(e); },
      });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }
  close() { this.ws && this.ws.close(); }
}

function extractText(payload) {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  const cand = payload.text ?? payload.response ?? payload.content ?? payload.output ??
    payload.answer ?? payload.finalText ?? payload.reply_text ??
    (typeof payload.result === "string" ? payload.result : undefined) ??
    (payload.result && typeof payload.result === "object" && (payload.result.text ?? payload.result.content ?? payload.result.message)) ??
    (payload.message && (payload.message.content ?? payload.message.text)) ??
    (payload.reply && (payload.reply.content ?? payload.reply.text ?? payload.reply));
  if (typeof cand === "string") return cand;
  if (Array.isArray(payload.messages) && payload.messages.length) {
    const last = payload.messages[payload.messages.length - 1];
    if (last) return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
  }
  return JSON.stringify(payload);
}

const lat = [];
let ok = 0, empty = 0;
const errs = {};
let firstLogged = false;
const startWall = Date.now();

async function worker(client, queue) {
  while (queue.length) {
    const idx = queue.shift();
    const agentId = AGENTS[idx % AGENTS.length];
    const sessionKey = `agent:${agentId}:lt-${RUNG}:${idx}-${startWall}`;
    const t0 = Date.now();
    try {
      const acc = await client.rpc("agent", { message: PROMPTS[agentId], agentId, sessionKey, idempotencyKey: `lt-${RUNG}-${idx}-${startWall}` }, 30000);
      const runId = acc && acc.runId;
      if (!runId) throw new Error("no runId: " + JSON.stringify(acc).slice(0, 120));
      const result = await client.rpc("agent.wait", { runId, timeoutMs: 230000 }, 245000);
      const dt = Date.now() - t0;
      lat.push(dt);
      if (!firstLogged) { firstLogged = true; console.error("FIRST_WAIT_SHAPE: " + JSON.stringify(result).slice(0, 1000)); }
      const status = String((result && (result.status || result.state)) || "");
      const text = extractText(result);
      if (/timeout|error|fail|reject|cancel/i.test(status)) {
        const kind = /timeout/i.test(status) ? "agent_timeout" : "agent_" + (status || "error");
        errs[kind] = (errs[kind] || 0) + 1;
        console.log(`[${RUNG}] #${idx} ${agentId} ${kind} ${dt}ms`);
      } else if (text.trim().length < 8) {
        empty++; console.log(`[${RUNG}] #${idx} ${agentId} EMPTY ${dt}ms status=${status}`);
      } else {
        ok++; console.log(`[${RUNG}] #${idx} ${agentId} ok ${dt}ms len=${text.length} status=${status}`);
      }
    } catch (e) {
      const dt = Date.now() - t0;
      const msg = String((e && e.message) || e);
      let kind = "other";
      if (/429|rate.?limit|quota|too many/i.test(msg)) kind = "429";
      else if (/timeout/i.test(msg)) kind = "timeout";
      else kind = msg.slice(0, 40);
      errs[kind] = (errs[kind] || 0) + 1;
      console.log(`[${RUNG}] #${idx} ${agentId} ERR(${kind}) ${dt}ms :: ${msg.slice(0, 90)}`);
    }
  }
}

(async () => {
  const client = new Rpc();
  await client.connect();
  console.log(`[${RUNG}] connected. concurrency=${CONCURRENCY} total=${TOTAL}`);
  const queue = Array.from({ length: TOTAL }, (_, i) => i);
  const workers = Array.from({ length: CONCURRENCY }, () => worker(client, queue));
  await Promise.all(workers);
  client.close();
  lat.sort((a, b) => a - b);
  const pct = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))] : 0);
  const wall = (Date.now() - startWall) / 1000;
  const mean = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
  console.log("==RUNG_SUMMARY== " + JSON.stringify({
    rung: RUNG, concurrency: CONCURRENCY, total: TOTAL, ok, empty,
    errors: errs, wall_s: Math.round(wall),
    throughput_per_min: lat.length ? Math.round(((ok + empty) / wall) * 60 * 10) / 10 : 0,
    p50_ms: pct(50), p95_ms: pct(95), max_ms: lat[lat.length - 1] || 0, mean_ms: mean,
  }));
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
