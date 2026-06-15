// Sweep 3 — 真实工具调用压测驱动(模拟 cbe 员工真实多回合工作)
// 与 cbe-loadtest.mjs 同机制(gateway agent + agent.wait),但任务会真正触发工具调用。
// 双模式(环境变量 CBE_MODE 切换):
//   screening(默认): 背调员工 cbe-buyer-screening 对真实美国公司做背调 → RDAP + DNS + SEC(免费工具)
//   lead:            营销获客员工 cbe-lead-discovery 用 web_search(Tavily)找下游买家官网
// 用法: CBE_MODE=lead node cbe-loadtest-tools.mjs <concurrency> <total> <rungLabel>
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
const TOTAL = Number(process.argv[3] || 1);
const RUNG = process.argv[4] || "t";
const MODE = process.env.CBE_MODE || "screening";
const WAIT_MS = Number(process.env.WAIT_MS || 280000);
const RPC_MS = Number(process.env.RPC_MS || 300000);

// --- screening 模式:真实美国上市公司(SEC 可查、域名真实)---
const SCREEN_TARGETS = [
  { name: "Apple Inc.", domain: "apple.com" },
  { name: "Tesla Inc.", domain: "tesla.com" },
  { name: "Microsoft Corporation", domain: "microsoft.com" },
  { name: "Nike Inc.", domain: "nike.com" },
  { name: "Starbucks Corporation", domain: "starbucks.com" },
  { name: "Ford Motor Company", domain: "ford.com" },
  { name: "Intel Corporation", domain: "intel.com" },
  { name: "Cisco Systems Inc.", domain: "cisco.com" },
];
function screenPrompt(i) {
  const t = SCREEN_TARGETS[i % SCREEN_TARGETS.length];
  return `对一家美国公司做轻量真实背调。公司名:${t.name},官网域名:${t.domain}。` +
    `请实际调用你的工具收集证据:① 用 RDAP 查 ${t.domain} 的域名注册信息;` +
    `② 检查 ${t.domain} 的邮件/DNS 配置(MX/SPF/DMARC);③ 如可用,用 SEC 查 ${t.name} 的公开披露摘要。` +
    `基于工具返回的真实证据,用中文写约120字可信度小结,并给出 trusted_candidate / cautious / high_risk 之一的结论。` +
    `不要做穷尽的联系人邮箱搜索,不要调用任何付费数据源。`;
}

// --- lead 模式:营销获客找下游买家(触发 web_search / Tavily)---
const LEAD_TARGETS = [
  { country: "英国", product: "手机壳" },
  { country: "德国", product: "手机充电器" },
  { country: "法国", product: "手机屏幕保护膜" },
  { country: "西班牙", product: "手机数据线" },
  { country: "意大利", product: "手机支架" },
  { country: "荷兰", product: "无线充电器" },
  { country: "波兰", product: "手机壳" },
  { country: "瑞典", product: "充电宝" },
];
function leadPrompt(i) {
  const t = LEAD_TARGETS[i % LEAD_TARGETS.length];
  return `用网页搜索,找 2 个${t.country}的${t.product}下游买家(零售连锁/电商/手机维修连锁,` +
    `不是批发商/工厂/目录站/社交媒体主页)的公司官网。请实际调用 web_search 来搜索(最多搜索 3 次)。` +
    `对每个买家给出:公司名、官网域名、一句话为什么是合适的下游买家。用中文输出。`;
}

const AGENT = MODE === "lead" ? "cbe-lead-discovery" : "cbe-buyer-screening";
const promptFor = MODE === "lead" ? leadPrompt : screenPrompt;
const labelFor = (i) => MODE === "lead"
  ? `${LEAD_TARGETS[i % LEAD_TARGETS.length].country}/${LEAD_TARGETS[i % LEAD_TARGETS.length].product}`
  : SCREEN_TARGETS[i % SCREEN_TARGETS.length].name;

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
              client: { id: "openclaw-tui", displayName: "Sentura LoadTest Tools", version: "0.1.0", platform: "node", mode: "ui" },
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
  rpc(method, params = {}, timeoutMs = RPC_MS) {
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

const lat = [];
let ok = 0, empty = 0;
const errs = {};
let firstLogged = false;
const startWall = Date.now();

async function worker(client, queue) {
  while (queue.length) {
    const idx = queue.shift();
    const sessionKey = `agent:${AGENT}:lt-${RUNG}:${idx}-${startWall}`;
    const t0 = Date.now();
    try {
      const acc = await client.rpc("agent", { message: promptFor(idx), agentId: AGENT, sessionKey, idempotencyKey: `lt-${RUNG}-${idx}-${startWall}` }, 30000);
      const runId = acc && acc.runId;
      if (!runId) throw new Error("no runId: " + JSON.stringify(acc).slice(0, 120));
      const result = await client.rpc("agent.wait", { runId, timeoutMs: WAIT_MS }, RPC_MS);
      const dt = Date.now() - t0;
      lat.push(dt);
      if (!firstLogged) { firstLogged = true; console.error("FIRST_WAIT_SHAPE: " + JSON.stringify(result).slice(0, 600)); }
      const status = String((result && (result.status || result.state)) || "");
      if (/timeout|error|fail|reject|cancel/i.test(status)) {
        const kind = /timeout/i.test(status) ? "agent_timeout" : "agent_" + (status || "error");
        errs[kind] = (errs[kind] || 0) + 1;
        console.log(`[${RUNG}] #${idx} ${labelFor(idx)} ${kind} ${(dt / 1000).toFixed(1)}s`);
      } else {
        ok++;
        console.log(`[${RUNG}] #${idx} ${labelFor(idx)} ok ${(dt / 1000).toFixed(1)}s status=${status}`);
      }
    } catch (e) {
      const dt = Date.now() - t0;
      const msg = String((e && e.message) || e);
      let kind = "other";
      if (/429|rate.?limit|quota|too many/i.test(msg)) kind = "429";
      else if (/timeout/i.test(msg)) kind = "timeout";
      else kind = msg.slice(0, 40);
      errs[kind] = (errs[kind] || 0) + 1;
      console.log(`[${RUNG}] #${idx} ERR(${kind}) ${(dt / 1000).toFixed(1)}s :: ${msg.slice(0, 90)}`);
    }
  }
}

(async () => {
  const client = new Rpc();
  await client.connect();
  console.log(`[${RUNG}] connected. mode=${MODE} agent=${AGENT} concurrency=${CONCURRENCY} total=${TOTAL} (real tool-calling)`);
  const queue = Array.from({ length: TOTAL }, (_, i) => i);
  const workers = Array.from({ length: CONCURRENCY }, () => worker(client, queue));
  await Promise.all(workers);
  client.close();
  lat.sort((a, b) => a - b);
  const pct = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))] : 0);
  const wall = (Date.now() - startWall) / 1000;
  const mean = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
  console.log("==RUNG_SUMMARY== " + JSON.stringify({
    rung: RUNG, mode: MODE, agent: AGENT, concurrency: CONCURRENCY, total: TOTAL, ok, empty,
    errors: errs, wall_s: Math.round(wall),
    throughput_per_min: lat.length ? Math.round(((ok + empty) / wall) * 60 * 10) / 10 : 0,
    p50_s: Math.round(pct(50) / 100) / 10, p95_s: Math.round(pct(95) / 100) / 10, max_s: Math.round((lat[lat.length - 1] || 0) / 100) / 10, mean_s: Math.round(mean / 100) / 10,
  }));
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
