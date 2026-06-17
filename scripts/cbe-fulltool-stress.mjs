// cbe-fulltool-stress.mjs — Phase 2 配额感知压测(双轨,全 §4 埋点)
// 复用 cbe-functional-test.mjs 的握手 + 轨迹解析 + provider/成本抽取,加 worker 池并发 + 预算熔断。
//   TRACK=A: 免费源高并发(测吞吐天花板;关付费,只 RDAP/DNS/SEC + 轻量 web)
//   TRACK=B: 全 8 工具小批量低并发(测全链路 + 真成本;🔴 限量源到顶即停)
// 用法(服务器上):
//   TRACK=A OPENCLAW_DIR=/root/sentura/openclaw node /root/cbe-fulltool-stress.mjs <并发> <总数> <档名>
//   TRACK=B IY_CAP=30 HUNTER_CAP=30 ABS_CAP=30 node /root/cbe-fulltool-stress.mjs 3 10 b1
// 输出: <OUTDIR>/results-<run>.jsonl + summary-<run>.md (+ 外部 cbe-loadmon2.sh 的 monitor-<run>.log)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/sentura/openclaw";
const require = createRequire(path.join(OPENCLAW_DIR, "package.json"));
const WS = require("ws");
const WebSocket = WS.WebSocket || WS;

const GATEWAY_URL = process.env.GW_URL || "ws://127.0.0.1:18789";
const HOME = os.homedir();
const token = JSON.parse(fs.readFileSync(path.join(HOME, ".openclaw/openclaw.json"), "utf8")).gateway.auth.token;
const AGENT = "cbe-buyer-screening";
const SESS_DIR = path.join(HOME, ".openclaw/agents", AGENT, "sessions");
const WAIT_MS = Number(process.env.WAIT_MS || 290000);
const RPC_MS = Number(process.env.RPC_MS || 300000);

const TRACK = (process.env.TRACK || "A").toUpperCase();
const CONCURRENCY = Number(process.argv[2] || (TRACK === "B" ? 3 : 8));
const TOTAL = Number(process.argv[3] || (TRACK === "B" ? 10 : 40));
const RUNG = process.argv[4] || (TRACK === "B" ? "b" : "a");
const RUN = process.env.RUN || `st${TRACK}-${RUNG}-` + new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
const OUTDIR = process.env.OUTDIR || "/root/cbe-stress-out";
fs.mkdirSync(OUTDIR, { recursive: true });
// 🔴 限量源预算上限(累计成功调用数,到顶停派新任务)
const CAP = { importyeti: Number(process.env.IY_CAP || 30), hunter: Number(process.env.HUNTER_CAP || 30), abstract: Number(process.env.ABS_CAP || 30) };

const PROVIDER_OF = {
  cbe_intel_company_registry_search: "companies_house", cbe_intel_company_profile: "companies_house",
  cbe_intel_domain_rdap_lookup: "rdap", cbe_intel_email_domain_check: "dns",
  cbe_intel_official_contact_email_search: "official_site", cbe_intel_sec_lookup: "sec",
  cbe_intel_trade_record_search: "importyeti", cbe_intel_score_buyer: "score",
  web_search: "tavily", web_fetch: "web_fetch",
};
const shortName = (n) => String(n || "").replace(/^cross-border-intel__/, "");
const IMPORTYETI_UNIT_USD = 0.09;

// ── Track A:免费源背调(US 上市公司,提示词明示不调付费源)──
const A_TARGETS = [
  { name: "Apple Inc.", domain: "apple.com" }, { name: "Tesla Inc.", domain: "tesla.com" },
  { name: "Microsoft Corporation", domain: "microsoft.com" }, { name: "Nike Inc.", domain: "nike.com" },
  { name: "Starbucks Corporation", domain: "starbucks.com" }, { name: "Ford Motor Company", domain: "ford.com" },
  { name: "Intel Corporation", domain: "intel.com" }, { name: "Cisco Systems Inc.", domain: "cisco.com" },
];
function promptA(i) {
  const t = A_TARGETS[i % A_TARGETS.length];
  return `对一家美国公司做轻量真实背调。公司名:${t.name},官网域名:${t.domain}。` +
    `请实际调用工具收集证据:① RDAP 查 ${t.domain} 域名注册;② 检查 ${t.domain} 的 MX/SPF/DMARC;③ 用 SEC 查 ${t.name} 公开披露摘要。` +
    `基于真实证据用中文写约120字可信度小结 + trusted_candidate/cautious/high_risk 之一的结论。` +
    `不要做穷尽联系人邮箱搜索,不要调用任何付费数据源(enable_paid_validation 保持 false、不查海关贸易)。`;
}

// ── Track B:全 8 工具完整背调(operator 授权付费;每目标给域名 + 待验邮箱)──
const B_TARGETS = [
  { name: "Tesco PLC", domain: "tesco.com", email: "customer.services@tesco.com", country: "UK" },
  { name: "Apple Inc.", domain: "apple.com", email: "media.help@apple.com", country: "US" },
  { name: "Currys plc", domain: "currys.co.uk", email: "customer.services@currys.co.uk", country: "UK" },
  { name: "Best Buy Co. Inc.", domain: "bestbuy.com", email: "customercare@bestbuy.com", country: "US" },
  { name: "J Sainsbury plc", domain: "sainsburys.co.uk", email: "customer.relations@sainsburys.co.uk", country: "UK" },
  { name: "Walmart Inc.", domain: "walmart.com", email: "help@walmart.com", country: "US" },
  { name: "Argos Limited", domain: "argos.co.uk", email: "support@argos.co.uk", country: "UK" },
  { name: "Target Corporation", domain: "target.com", email: "guest.relations@target.com", country: "US" },
];
function promptB(i) {
  const t = B_TARGETS[i % B_TARGETS.length];
  const reg = t.country === "UK"
    ? "① Companies House 查英国公司注册信息(注册号/状态/地址);"
    : "① SEC 查该公司美股公开披露摘要;";
  const na = t.country === "UK" ? "英国公司无需查美国 SEC。" : "美国公司无需查英国 Companies House。";
  return `你是买家背调员工。operator 已明确授权"付费邮箱校验 + 付费贸易数据(单次预算上限 $1)"。请对【${t.country} 公司 ${t.name},域名 ${t.domain},待验邮箱 ${t.email}】做一次尽量完整的买家背调:` +
    `${reg}② RDAP 查 ${t.domain} 域名注册;③ 检查 ${t.domain} 的 MX/SPF/DMARC;` +
    `④ 对邮箱 ${t.email} 做邮箱校验,enable_paid_validation=true(operator 已授权付费校验);` +
    `⑤ 查海关进口贸易记录,operator 已启用付费贸易数据、max_paid_spend_usd=1、source=auto;⑥ 网页搜索补充公开口碑。` +
    `基于真实证据用中文写约120字可信度小结 + trusted_candidate/cautious/high_risk 结论。${na}`;
}

const TARGETS = TRACK === "B" ? B_TARGETS : A_TARGETS;
const promptFor = TRACK === "B" ? promptB : promptA;
const labelFor = (i) => TARGETS[i % TARGETS.length].name;

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
              client: { id: "openclaw-tui", displayName: "Sentura FullTool Stress", version: "0.1.0", platform: "node", mode: "ui" },
              caps: [], role: "operator", scopes: ["operator.read", "operator.write", "operator.admin"],
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
      this.pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }
  close() { this.ws && this.ws.close(); }
}

function sessionEntry(sessionKey) {
  const k = String(sessionKey).toLowerCase();
  try { return JSON.parse(fs.readFileSync(path.join(SESS_DIR, "sessions.json"), "utf8"))[k] || null; } catch { return null; }
}
function findSessionFile(sessionKey) {
  const ent = sessionEntry(sessionKey);
  if (ent && ent.sessionId) { const p = path.join(SESS_DIR, ent.sessionId + ".jsonl"); if (fs.existsSync(p)) return p; }
  return null;
}
function parseTrajectory(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const msgs = lines.filter((o) => (o.type || "") === "message");
  const calls = new Map(); let prevTs = null, llmMs = 0, turns = 0;
  for (const m of msgs) {
    const mm = m.message || {};
    const ts = Date.parse(m.timestamp || mm.timestamp || "") || null;
    const role = mm.role;
    if (role === "assistant") {
      turns++;
      if (prevTs && ts) llmMs += Math.max(0, ts - prevTs);
      for (const c of (Array.isArray(mm.content) ? mm.content : [])) {
        if (c && c.type === "toolCall") { const short = shortName(c.name); calls.set(c.id, { id: c.id, short, provider: PROVIDER_OF[short] || short, t_call: ts }); }
      }
    } else if (role === "toolResult") {
      const call = calls.get(mm.toolCallId);
      const txt = Array.isArray(mm.content) ? mm.content.map((c) => (c && c.text) || "").join("") : "";
      let resJson = null; try { resJson = JSON.parse(txt); } catch { /* keep */ }
      if (call) { call.t_res = ts; call.latency_ms = call.t_call && ts ? ts - call.t_call : null; call.result = resJson; }
    }
    if (ts) prevTs = ts;
  }
  let answer = "";
  for (let i = msgs.length - 1; i >= 0; i--) {
    const mm = msgs[i].message || {};
    if (mm.role === "assistant" && Array.isArray(mm.content)) { answer = mm.content.filter((c) => c && c.type === "text").map((c) => c.text).join(" ").trim(); if (answer) break; }
  }
  return { calls: [...calls.values()], llmMs, turns, answer };
}
function extractProviders(parsed) {
  const fired = {}; const cost = { importyeti_calls: 0, importyeti_usd: 0, hunter_calls: 0, abstract_calls: 0, importyeti_exec_ms: [], credits: {} };
  const mark = (p, info) => { if (!fired[p]) fired[p] = info; else Object.assign(fired[p], info); };
  for (const c of parsed.calls) {
    const r = c.result || {}; const lat = c.latency_ms;
    if (c.provider === "rdap") mark("rdap", { tool: c.short, http: r.http_status, status: r.status, latency_ms: lat, ok: /ok|found|redirect|checked|200|302/i.test(String(r.status || r.http_status || "")) });
    else if (c.provider === "sec") mark("sec", { tool: c.short, http: r.http_status, status: r.status, latency_ms: lat, ok: r.status === "found" || r.http_status === 200 });
    else if (c.provider === "companies_house") mark("companies_house", { tool: c.short, http: r.http_status, status: r.status, latency_ms: lat, ok: r.status === "found" || r.http_status === 200, records: (r.items && r.items.length) || (r.company_number ? 1 : undefined) });
    else if (c.provider === "official_site") mark("official_site", { tool: c.short, status: r.status, latency_ms: lat, ok: r.status === "found", records: (r.emails && r.emails.length) || 0 });
    else if (c.provider === "dns") {
      const mx = r.checks && r.checks.mx;
      mark("dns", { tool: c.short, status: r.status, latency_ms: lat, ok: r.status === "checked" || (mx && mx.present), records: mx && mx.records ? mx.records.length : undefined });
      for (const pv of ((r.paid_validation && r.paid_validation.providers) || [])) {
        if (pv.provider === "abstract") { cost.abstract_calls++; mark("abstract", { tool: c.short, http: pv.http_status, ok: pv.http_status === 200, latency_ms: lat }); }
        if (pv.provider === "hunter") { cost.hunter_calls++; const hr = (pv.result && pv.result.data) || {}; mark("hunter", { tool: c.short, http: pv.http_status, ok: pv.http_status === 200, latency_ms: lat, verdict: hr.status || hr.result, score: hr.score }); }
      }
    } else if (c.short === "cbe_intel_trade_record_search") {
      const prov = r.provider || "importyeti"; const body = r.records || {};
      const exec = body.executionTime || body.execution_time;
      const credits = body.creditsRemaining ?? body.credits_remaining ?? body.requestsRemaining;
      const recCount = Array.isArray(body.data) ? body.data.length : (Array.isArray(body) ? body.length : (body.total ?? undefined));
      const ok = r.status === "found" || r.http_status === 200;
      mark(prov === "public_web_fallback" ? "importyeti" : prov, { tool: c.short, http: r.http_status, status: r.status, latency_ms: lat, ok, records: recCount, exec_ms: exec, note: r.status });
      if (prov === "importyeti" && ok) { cost.importyeti_calls++; cost.importyeti_usd += IMPORTYETI_UNIT_USD; if (exec) cost.importyeti_exec_ms.push(exec); if (credits != null) cost.credits.importyeti = credits; }
    } else if (c.provider === "tavily") mark("tavily", { tool: c.short, latency_ms: lat, ok: !!r && !r.error, records: (r.results && r.results.length) || undefined });
  }
  return { fired, cost };
}
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const ms = (n) => (n == null ? "—" : (n / 1000).toFixed(2) + "s");

// ── 累计预算计数器 + 熔断标志 ──
const budget = { importyeti: 0, hunter: 0, abstract: 0 };
let stopReason = null;
function budgetExceeded() { return budget.importyeti >= CAP.importyeti || budget.hunter >= CAP.hunter || budget.abstract >= CAP.abstract; }

const results = [];
const errs = {};
const startWall = Date.now();

async function worker(client, queue) {
  while (queue.length) {
    if (TRACK === "B" && budgetExceeded()) { if (!stopReason) stopReason = `budget cap hit (IY=${budget.importyeti}/${CAP.importyeti} H=${budget.hunter}/${CAP.hunter} A=${budget.abstract}/${CAP.abstract})`; break; }
    const idx = queue.shift();
    if (idx === undefined) break;
    const sessionKey = `agent:${AGENT}:st${TRACK}-${RUNG}-${idx}-${startWall}`.toLowerCase();
    const idem = `st${TRACK}-${RUNG}-${idx}-${startWall}`;
    const t_enqueue = Date.now();
    let runId = null, result = null, t_accepted, t_done, status = "ok", error = null;
    try {
      const acc = await client.rpc("agent", { message: promptFor(idx), agentId: AGENT, sessionKey, idempotencyKey: idem }, 30000);
      t_accepted = Date.now();
      runId = acc && acc.runId;
      if (!runId) throw new Error("no runId: " + JSON.stringify(acc).slice(0, 120));
      result = await client.rpc("agent.wait", { runId, timeoutMs: WAIT_MS }, RPC_MS);
      t_done = Date.now();
      const st = String((result && (result.status || result.state)) || "");
      if (/timeout|error|fail|reject|cancel/i.test(st)) { status = /timeout/i.test(st) ? "agent_timeout" : "agent_" + st; errs[status] = (errs[status] || 0) + 1; }
    } catch (e) {
      t_accepted = t_accepted || Date.now(); t_done = Date.now();
      const msg = String((e && e.message) || e);
      status = /429|rate.?limit|quota|too many/i.test(msg) ? "429" : /timeout/i.test(msg) ? "timeout" : "error";
      error = msg.slice(0, 120); errs[status] = (errs[status] || 0) + 1;
    }
    const t_e2e = t_done - t_enqueue, t_queue = t_accepted - t_enqueue, t_exec = t_done - t_accepted;
    await new Promise((r) => setTimeout(r, 800));
    const file = findSessionFile(sessionKey);
    let parsed = null, ext = { fired: {}, cost: { importyeti_calls: 0, hunter_calls: 0, abstract_calls: 0, importyeti_usd: 0, importyeti_exec_ms: [], credits: {} } };
    if (file) { parsed = parseTrajectory(file); ext = extractProviders(parsed); }
    // 累加预算
    budget.importyeti += ext.cost.importyeti_calls; budget.hunter += ext.cost.hunter_calls; budget.abstract += ext.cost.abstract_calls;
    const firedSet = Object.keys(ext.fired);
    const rec = {
      task_id: idx, run: RUN, track: TRACK, rung: RUNG, concurrency: CONCURRENCY, agent: AGENT, label: labelFor(idx),
      sessionKey, runId, status, error,
      t_enqueue: new Date(t_enqueue).toISOString(), t_e2e_ms: t_e2e, t_queue_ms: t_queue, t_exec_ms: t_exec,
      t_llm_ms: parsed ? parsed.llmMs : null, turns: parsed ? parsed.turns : null,
      providers_fired: ext.fired, fired_count: firedSet.length, cost: ext.cost,
      answer_len: parsed ? (parsed.answer || "").length : 0,
    };
    results.push(rec);
    console.log(`[${RUN}] #${idx} ${labelFor(idx)} ${status} e2e=${ms(t_e2e)} q=${ms(t_queue)} fired=${firedSet.length}(${firedSet.join(",")}) ${ext.cost.importyeti_calls ? "IY+" + ext.cost.importyeti_calls : ""}${ext.cost.hunter_calls ? " H+" + ext.cost.hunter_calls : ""}${ext.cost.abstract_calls ? " A+" + ext.cost.abstract_calls : ""}`);
  }
}

(async () => {
  const client = new Rpc();
  await client.connect();
  console.log(`[${RUN}] connected. TRACK=${TRACK} agent=${AGENT} concurrency=${CONCURRENCY} total=${TOTAL}` + (TRACK === "B" ? ` caps(IY/H/A)=${CAP.importyeti}/${CAP.hunter}/${CAP.abstract}` : " (free sources, paid OFF)"));
  const queue = Array.from({ length: TOTAL }, (_, i) => i);
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(client, queue)));
  client.close();

  // ── 汇总(§4)──
  const okN = results.filter((r) => r.status === "ok").length;
  const e2es = results.filter((r) => r.status === "ok").map((r) => r.t_e2e_ms);
  const wall = (Date.now() - startWall) / 1000;
  const ALLP = ["companies_house", "rdap", "dns", "hunter", "abstract", "importyeti", "sec", "tavily"];
  const provStat = {};
  for (const p of ALLP) { provStat[p] = { fired: 0, ok: 0, lat: [] }; }
  for (const r of results) for (const [p, info] of Object.entries(r.providers_fired)) { if (!provStat[p]) provStat[p] = { fired: 0, ok: 0, lat: [] }; provStat[p].fired++; if (info.ok) provStat[p].ok++; if (info.latency_ms != null) provStat[p].lat.push(info.latency_ms); }
  const totIY = results.reduce((s, r) => s + (r.cost.importyeti_calls || 0), 0);
  const totH = results.reduce((s, r) => s + (r.cost.hunter_calls || 0), 0);
  const totA = results.reduce((s, r) => s + (r.cost.abstract_calls || 0), 0);
  const totUSD = results.reduce((s, r) => s + (r.cost.importyeti_usd || 0), 0);
  const lastCredits = results.map((r) => r.cost.credits && r.cost.credits.importyeti).filter((x) => x != null).pop();

  fs.writeFileSync(path.join(OUTDIR, `results-${RUN}.jsonl`), results.map((r) => JSON.stringify(r)).join("\n") + "\n");

  let md = `# cbe 压测报告(Track ${TRACK})— ${RUN}\n\n`;
  md += `**Agent**: ${AGENT} · **并发**: ${CONCURRENCY} · **总数**: ${TOTAL} · **完成**: ${results.length} · **生成**: ${new Date().toISOString()}\n\n`;
  md += `## 吞吐 / 可靠性\n- 墙钟 wall_clock: ${wall.toFixed(1)}s\n- 成功率: ${okN}/${results.length}\n- 吞吐: ${(results.length / wall * 60).toFixed(1)} 任务/分\n- 错误: ${JSON.stringify(errs)}\n`;
  if (stopReason) md += `- ⏹ 预算熔断: ${stopReason}\n`;
  md += `\n## t_e2e 分位(成功任务,§4.1)\n`;
  md += `min=${ms(Math.min(...e2es, 0))} p50=${ms(pct(e2es, 50))} p95=${ms(pct(e2es, 95))} p99=${ms(pct(e2es, 99))} max=${ms(Math.max(...e2es, 0))}\n\n`;
  md += `## 每工具统计(§4.2)\n\n| Provider | 开火次数 | 成功 | 延迟 p50 | 延迟 p95 |\n|---|---|---|---|---|\n`;
  for (const p of ALLP) { const s = provStat[p]; if (!s.fired) continue; md += `| ${p} | ${s.fired} | ${s.ok} | ${ms(pct(s.lat, 50))} | ${ms(pct(s.lat, 95))} |\n`; }
  md += `\n## 成本 / 配额(§4.3)\n- ImportYeti: ${totIY} 次成功(估上限 $${totUSD.toFixed(2)};creditsRemaining 末次=${lastCredits ?? "—"})\n- Hunter: ${totH} 次 · Abstract: ${totA} 次\n- 预算上限(IY/H/A): ${CAP.importyeti}/${CAP.hunter}/${CAP.abstract}${stopReason ? " — 已熔断" : " — 未触顶"}\n`;
  fs.writeFileSync(path.join(OUTDIR, `summary-${RUN}.md`), md);

  console.log(`\n==STRESS_SUMMARY== ` + JSON.stringify({
    run: RUN, track: TRACK, concurrency: CONCURRENCY, total: TOTAL, done: results.length, ok: okN,
    wall_s: Math.round(wall), throughput_per_min: Math.round(results.length / wall * 60 * 10) / 10,
    p50_s: Math.round(pct(e2es, 50) / 100) / 10, p95_s: Math.round(pct(e2es, 95) / 100) / 10, max_s: Math.round(Math.max(...e2es, 0) / 100) / 10,
    errors: errs, importyeti: totIY, hunter: totH, abstract: totA, credits_last: lastCredits ?? null, stop: stopReason,
  }));
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
