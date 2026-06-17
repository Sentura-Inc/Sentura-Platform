// cbe-functional-test.mjs — Phase 1 功能验证(全 §4 埋点)
// 目标:验证 cbe-buyer-screening 员工经 gateway 真实串起 8 个工具、返回真数据。
// 机制:走生产路径 agent + agent.wait(非 /run 诊断路由);跑完解析磁盘上的
//   会话轨迹 JSONL(/root/.openclaw/agents/<agent>/sessions/<id>.jsonl)取
//   工具开火 / 每工具延迟+http / 付费源成本配额 / LLM 回合耗时 / 最终答案。
// 必须在能 require("ws") 且能读 sessions 目录的机器跑(=服务器)。
//   用法: OPENCLAW_DIR=/root/sentura/openclaw node /root/cbe-functional-test.mjs
//   输出: <OUTDIR>/results-<run>.jsonl + summary-<run>.md  (+ 外部 sampler 的 monitor-<run>.log)
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
const CONFIG_PATH = path.join(HOME, ".openclaw/openclaw.json");
const token = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")).gateway.auth.token;
const AGENT = "cbe-buyer-screening";
const SESS_DIR = path.join(HOME, ".openclaw/agents", AGENT, "sessions");
const WAIT_MS = Number(process.env.WAIT_MS || 280000);
const RPC_MS = Number(process.env.RPC_MS || 300000);
const REPARSE = process.env.REPARSE_RUN || null; // 设为某次 RUN 则跳过派发,只重解析磁盘轨迹(不烧额度)
const RUN = REPARSE || process.env.RUN || "func-" + new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
const OUTDIR = process.env.OUTDIR || "/root/cbe-func-out";
fs.mkdirSync(OUTDIR, { recursive: true });

// ── 工具名 → 上游 provider 归类(MCP 工具名去掉 cross-border-intel__ 前缀)──
const PROVIDER_OF = {
  cbe_intel_company_registry_search: "companies_house",
  cbe_intel_company_profile: "companies_house",
  cbe_intel_domain_rdap_lookup: "rdap",
  cbe_intel_email_domain_check: "dns", // 同时内含 abstract/hunter 子结果
  cbe_intel_official_contact_email_search: "official_site",
  cbe_intel_sec_lookup: "sec",
  cbe_intel_trade_record_search: "importyeti", // 也可能 volza / public_web_fallback
  cbe_intel_score_buyer: "score",
  web_search: "tavily",
  web_fetch: "web_fetch",
};
const shortName = (n) => String(n || "").replace(/^cross-border-intel__/, "");
const IMPORTYETI_UNIT_USD = 0.09; // $9 / 100 credits 按量估算

// ── 测试用例(operator 显式授权付费,让员工把对应工具全点起来)──
const TASKS = [
  {
    label: "Tesco-UK", company: "Tesco PLC", domain: "tesco.com", country: "United Kingdom",
    expect: ["companies_house", "rdap", "dns", "hunter", "abstract", "importyeti", "tavily"], na: ["sec"],
    prompt:
`你是买家背调员工。现在 operator(操作员)已明确授权"付费邮箱校验 + 付费贸易数据(单次预算上限 $1)"。请对一家英国公司做一次尽量完整的买家背调。
公司:Tesco PLC;官网域名:tesco.com;待核验联系邮箱:customer.services@tesco.com。
请实际逐项调用工具取证(operator 已授权,放心调用付费源):
① Companies House 查英国公司注册信息(注册号 / 状态 / 注册地址);
② RDAP 查 tesco.com 域名注册;
③ 检查 tesco.com 的 MX/SPF/DMARC 邮件配置;
④ 对邮箱 customer.services@tesco.com 做邮箱校验,enable_paid_validation=true(operator 已授权付费校验);
⑤ 查海关进口贸易记录,operator 已启用付费贸易数据、max_paid_spend_usd=1、source=auto(或 importyeti);
⑥ 网页搜索补充公开口碑。
基于工具返回的真实证据,用中文写约 150 字可信度小结,并给出 trusted_candidate / cautious / high_risk 之一的结论。英国公司无需查美国 SEC。`,
  },
  {
    label: "Apple-US", company: "Apple Inc.", domain: "apple.com", country: "United States",
    expect: ["sec", "rdap", "dns", "importyeti", "tavily"], na: ["companies_house"],
    prompt:
`你是买家背调员工。operator 已授权"付费贸易数据(单次预算上限 $1)"。请对一家美国公司做一次较完整的买家背调。
公司:Apple Inc.;官网域名:apple.com。
请实际逐项调用工具取证:
① SEC 查 Apple Inc. 的美股公开披露摘要;
② RDAP 查 apple.com 域名注册;
③ 检查 apple.com 的 MX/SPF/DMARC;
④ 查海关进口贸易记录,operator 已启用付费贸易数据、max_paid_spend_usd=1、source=auto(或 importyeti);
⑤ 网页搜索补充公开口碑。
本次只验美国侧链路,不要做付费邮箱校验(enable_paid_validation 保持默认 false)。基于真实证据用中文写约 150 字可信度小结 + trusted_candidate/cautious/high_risk 结论。美国公司无需查英国 Companies House。`,
  },
];

// ── gateway WS JSON-RPC(握手取自 cbe-loadtest-tools.mjs)──
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
              client: { id: "openclaw-tui", displayName: "Sentura Functional Test", version: "0.1.0", platform: "node", mode: "ui" },
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
      this.pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }
  close() { this.ws && this.ws.close(); }
}

// 原始 JSONL 事件里不存 sessionKey;sessionKey→sessionId 的映射在 sessions.json,据此定位轨迹文件
function sessionEntry(sessionKey) {
  const k = String(sessionKey).toLowerCase(); // gateway 存盘时小写化
  try { return JSON.parse(fs.readFileSync(path.join(SESS_DIR, "sessions.json"), "utf8"))[k] || null; }
  catch { return null; }
}
function findSessionFile(sessionKey) {
  const ent = sessionEntry(sessionKey);
  if (ent && ent.sessionId) {
    const p = path.join(SESS_DIR, ent.sessionId + ".jsonl");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// 从原始会话 JSONL 重建工具时间线 + 每工具延迟/结果 + LLM 回合耗时
function parseTrajectory(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const msgs = lines.filter((o) => (o.type || "") === "message");
  const calls = new Map(); // toolCallId -> {name, short, provider, args, t_call, t_res, latency_ms, result}
  const order = [];
  let prevTs = null, llmMs = 0, turns = 0;
  let firstTs = null, lastTs = null;
  for (const m of msgs) {
    const mm = m.message || {};
    const ts = Date.parse(m.timestamp || mm.timestamp || "") || null;
    if (ts) { if (firstTs === null) firstTs = ts; lastTs = ts; }
    const role = mm.role;
    if (role === "assistant") {
      turns++;
      if (prevTs && ts) llmMs += Math.max(0, ts - prevTs); // 上一事件→本次出 assistant = 模型思考/生成
      for (const c of (Array.isArray(mm.content) ? mm.content : [])) {
        if (c && c.type === "toolCall") {
          const short = shortName(c.name);
          calls.set(c.id, { id: c.id, name: c.name, short, provider: PROVIDER_OF[short] || short, args: c.arguments, t_call: ts });
          order.push(c.id);
        }
      }
    } else if (role === "toolResult") {
      const call = calls.get(mm.toolCallId);
      const txt = Array.isArray(mm.content) ? mm.content.map((c) => (c && c.text) || "").join("") : "";
      let resJson = null; try { resJson = JSON.parse(txt); } catch { /* keep text */ }
      if (call) {
        call.t_res = ts;
        call.latency_ms = call.t_call && ts ? ts - call.t_call : null;
        call.result = resJson; call.resultText = txt.slice(0, 4000);
      }
    }
    if (ts) prevTs = ts;
  }
  // 最终答案:末个 assistant 的 text
  let answer = "";
  for (let i = msgs.length - 1; i >= 0; i--) {
    const mm = msgs[i].message || {};
    if (mm.role === "assistant" && Array.isArray(mm.content)) {
      answer = mm.content.filter((c) => c && c.type === "text").map((c) => c.text).join(" ").trim();
      if (answer) break;
    }
  }
  return { calls: [...calls.values()], order, llmMs, turns, traj_ms: firstTs && lastTs ? lastTs - firstTs : null, answer, file };
}

// 从工具结果里抽取:实际开火的 provider 集合 + 每 provider http/status + 成本/配额
function extractProviders(parsed) {
  const fired = {}; // provider -> {tool, http, status, latency_ms, records, ok, note}
  const cost = { importyeti_calls: 0, importyeti_usd: 0, hunter_calls: 0, abstract_calls: 0, importyeti_exec_ms: [], credits: {} };
  function mark(p, info) { if (!fired[p]) fired[p] = info; else Object.assign(fired[p], info); }

  for (const c of parsed.calls) {
    const r = c.result || {};
    const lat = c.latency_ms;
    if (c.provider === "rdap") {
      mark("rdap", { tool: c.short, http: r.http_status, status: r.status, latency_ms: lat, ok: /ok|found|redirect|checked|success|200|302/i.test(String(r.status || r.http_status || "")) });
    } else if (c.provider === "sec") {
      // SEC "found" result embeds the full ~32KB submissions blob; stored trajectory truncates
      // it so JSON.parse can fail (r empty). Regex the leading status/http from raw text.
      const t = c.resultText || "";
      const st = r.status || (t.match(/"status":\s*"(\w+)"/) || [])[1];
      const http = r.http_status ?? Number((t.match(/"http_status":\s*(\d+)/) || [])[1]);
      mark("sec", { tool: c.short, http: Number.isFinite(http) ? http : undefined, status: st, latency_ms: lat, ok: st === "found" || http === 200, records: r.facts ? 1 : (r.recent_filings ? r.recent_filings.length : undefined) });
    } else if (c.provider === "companies_house") {
      mark("companies_house", { tool: c.short, http: r.http_status, status: r.status, latency_ms: lat, ok: r.status === "found" || r.http_status === 200, records: (r.items && r.items.length) || (r.company_number ? 1 : undefined) });
    } else if (c.provider === "official_site") {
      mark("official_site", { tool: c.short, status: r.status, latency_ms: lat, ok: r.status === "found", records: (r.emails && r.emails.length) || 0 });
    } else if (c.provider === "dns") {
      // email_domain_check → DNS 主结果 + 内含 abstract/hunter 子结果
      const mx = r.checks && r.checks.mx;
      mark("dns", { tool: c.short, status: r.status, latency_ms: lat, ok: r.status === "checked" || (mx && mx.present), records: mx && mx.records ? mx.records.length : undefined });
      const provs = (r.paid_validation && r.paid_validation.providers) || [];
      for (const pv of provs) {
        if (pv.provider === "abstract") { cost.abstract_calls++; mark("abstract", { tool: c.short, http: pv.http_status, ok: pv.http_status === 200, latency_ms: lat, verdict: pv.result && (pv.result.deliverability || pv.result.quality_score || pv.result.is_valid_format) }); }
        if (pv.provider === "hunter") { cost.hunter_calls++; const hr = (pv.result && pv.result.data) || {}; mark("hunter", { tool: c.short, http: pv.http_status, ok: pv.http_status === 200, latency_ms: lat, verdict: hr.status || hr.result, score: hr.score }); }
      }
    } else if (c.short === "cbe_intel_trade_record_search") {
      const prov = r.provider || "importyeti";
      const body = r.records || {};
      const exec = body.executionTime || body.execution_time;
      const credits = body.creditsRemaining ?? body.credits_remaining ?? body.requestsRemaining;
      const recCount = Array.isArray(body.data) ? body.data.length : (Array.isArray(body) ? body.length : (body.total ?? undefined));
      const ok = r.status === "found" || r.http_status === 200;
      mark(prov === "public_web_fallback" ? "importyeti" : prov, { tool: c.short, http: r.http_status, status: r.status, latency_ms: lat, ok, records: recCount, exec_ms: exec, note: r.status });
      if (prov === "importyeti" && ok) { cost.importyeti_calls++; cost.importyeti_usd += IMPORTYETI_UNIT_USD; if (exec) cost.importyeti_exec_ms.push(exec); if (credits != null) cost.credits.importyeti = credits; }
    } else if (c.provider === "tavily") {
      mark("tavily", { tool: c.short, latency_ms: lat, ok: !!r && !r.error, records: (r.results && r.results.length) || undefined });
    }
  }
  return { fired, cost };
}

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const ms = (n) => (n == null ? "—" : (n / 1000).toFixed(2) + "s");

(async () => {
  const client = new Rpc();
  if (!REPARSE) await client.connect();
  console.log(`[func] ${REPARSE ? "REPARSE run=" + RUN : "connected. agent=" + AGENT + " run=" + RUN} tasks=${TASKS.length} (sequential, paid sources ON)`);
  const results = [];
  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    // sessionKey 必须以 agent:<agentId>: 开头(否则 gateway 解析出 agent="main" 不匹配而拒绝),
    // 且 gateway 会把 sessionKey 全部小写化存盘,这里先小写以便回查 sessions.json
    const sessionKey = `agent:${AGENT}:func-${task.label}-${RUN}`.toLowerCase();
    const idem = `func-${task.label}-${RUN}`;
    console.log(`\n[func] #${i} ${task.label} (${task.company}) ${REPARSE ? "reparse…" : "dispatch…"}`);
    let acc, runId = null, result = null, t_enqueue, t_accepted, t_done, status = "ok", error = null;
    if (REPARSE) {
      // 只重解析:时间从 sessions.json 取(sessionStartedAt→lastInteractionAt),不烧额度
      const ent = sessionEntry(sessionKey) || {};
      t_enqueue = ent.sessionStartedAt || Date.now();
      t_accepted = t_enqueue;
      t_done = ent.lastInteractionAt || ent.updatedAt || t_enqueue;
    } else {
      t_enqueue = Date.now();
      try {
        acc = await client.rpc("agent", { message: task.prompt, agentId: AGENT, sessionKey, idempotencyKey: idem }, 30000);
        t_accepted = Date.now();
        runId = acc && acc.runId;
        if (!runId) throw new Error("no runId: " + JSON.stringify(acc).slice(0, 160));
        result = await client.rpc("agent.wait", { runId, timeoutMs: WAIT_MS }, RPC_MS);
        t_done = Date.now();
        const st = String((result && (result.status || result.state)) || "");
        if (/timeout|error|fail|reject|cancel/i.test(st)) { status = /timeout/i.test(st) ? "agent_timeout" : "agent_" + st; }
      } catch (e) {
        t_accepted = t_accepted || Date.now(); t_done = Date.now();
        status = "error"; error = String((e && e.message) || e);
      }
    }
    const t_e2e = t_done - t_enqueue, t_queue = t_accepted - t_enqueue, t_exec = t_done - t_accepted;
    // 等磁盘落盘后解析轨迹
    if (!REPARSE) await new Promise((r) => setTimeout(r, 1500));
    const file = findSessionFile(sessionKey);
    let parsed = null, ext = { fired: {}, cost: {} };
    if (file) { parsed = parseTrajectory(file); ext = extractProviders(parsed); }
    else console.log(`[func] #${i} ⚠ 未找到 sessionKey=${sessionKey} 的轨迹文件`);

    const firedSet = Object.keys(ext.fired);
    const expHit = task.expect.filter((p) => firedSet.includes(p));
    const expMiss = task.expect.filter((p) => !firedSet.includes(p));
    const naLeak = task.na.filter((p) => firedSet.includes(p));

    const rec = {
      task_id: i, run: RUN, agent: AGENT, label: task.label, company: task.company, domain: task.domain, country: task.country,
      sessionKey, runId: runId || null, status, error,
      t_enqueue: new Date(t_enqueue).toISOString(), t_accepted: new Date(t_accepted).toISOString(), t_done: new Date(t_done).toISOString(),
      t_e2e_ms: t_e2e, t_queue_ms: t_queue, t_exec_ms: t_exec,
      t_llm_ms: parsed ? parsed.llmMs : null, turns: parsed ? parsed.turns : null,
      traj_file: file || null,
      tools: parsed ? parsed.calls.map((c) => ({ tool: c.short, provider: c.provider, http: (c.result && c.result.http_status) ?? null, status: (c.result && c.result.status) ?? null, latency_ms: c.latency_ms })) : [],
      providers_fired: ext.fired,
      expected_hit: expHit, expected_missing: expMiss, na_correctly_skipped: task.na.filter((p) => !firedSet.includes(p)), na_leaked: naLeak,
      cost: ext.cost,
      answer: parsed ? parsed.answer : null,
    };
    results.push(rec);
    console.log(`[func] #${i} ${task.label} ${status} e2e=${ms(t_e2e)} queue=${ms(t_queue)} exec=${ms(t_exec)} llm=${ms(rec.t_llm_ms)} turns=${rec.turns}`);
    console.log(`       fired(${firedSet.length}): ${firedSet.join(", ") || "(none)"}`);
    console.log(`       expect✅ ${expHit.join(",") || "-"}  | expect❌MISSING ${expMiss.join(",") || "-"}  | N/A漏调 ${naLeak.join(",") || "-"}`);
    if (ext.cost.importyeti_calls || ext.cost.hunter_calls || ext.cost.abstract_calls)
      console.log(`       cost: ImportYeti×${ext.cost.importyeti_calls} (~$${ext.cost.importyeti_usd.toFixed(2)}) Hunter×${ext.cost.hunter_calls} Abstract×${ext.cost.abstract_calls}`);
  }
  if (!REPARSE) client.close();

  // ── 输出三件套(§4.6)──
  const jsonl = path.join(OUTDIR, `results-${RUN}.jsonl`);
  fs.writeFileSync(jsonl, results.map((r) => JSON.stringify(r)).join("\n") + "\n");

  const e2es = results.map((r) => r.t_e2e_ms);
  const allProviders = ["companies_house", "rdap", "dns", "hunter", "abstract", "importyeti", "sec", "tavily"];
  const unionFired = new Set();
  results.forEach((r) => Object.keys(r.providers_fired).forEach((p) => unionFired.add(p)));
  const totCost = results.reduce((s, r) => s + (r.cost.importyeti_usd || 0), 0);
  const totIY = results.reduce((s, r) => s + (r.cost.importyeti_calls || 0), 0);
  const totH = results.reduce((s, r) => s + (r.cost.hunter_calls || 0), 0);
  const totA = results.reduce((s, r) => s + (r.cost.abstract_calls || 0), 0);

  let md = `# cbe 功能验证报告 — ${RUN}\n\n`;
  md += `**Agent**: ${AGENT} · **任务数**: ${results.length}(顺序执行,付费源开)· **生成**: ${new Date().toISOString()}\n\n`;
  md += `## 8 工具开火总览\n\n| Provider | 是否在本批开过火 |\n|---|---|\n`;
  for (const p of allProviders) md += `| ${p} | ${unionFired.has(p) ? "✅ 开火" : "❌ 未开火"} |\n`;
  md += `\n**8 工具覆盖: ${unionFired.size}/8**\n\n`;
  md += `## 时间指标(§4.1)\n\n| 任务 | 状态 | t_e2e | t_queue | t_exec | t_llm | 回合 |\n|---|---|---|---|---|---|---|\n`;
  for (const r of results) md += `| ${r.label} | ${r.status} | ${ms(r.t_e2e_ms)} | ${ms(r.t_queue_ms)} | ${ms(r.t_exec_ms)} | ${ms(r.t_llm_ms)} | ${r.turns ?? "—"} |\n`;
  md += `\n**t_e2e 分位**: p50=${ms(pct(e2es, 50))} p95=${ms(pct(e2es, 95))} max=${ms(Math.max(...e2es))}\n\n`;
  md += `## 每任务工具明细\n\n`;
  for (const r of results) {
    md += `### ${r.label} — ${r.company}(${r.country})\n\n`;
    md += `- 期望命中 ✅: ${r.expected_hit.join(", ") || "—"}\n- 期望缺失 ❌: ${r.expected_missing.join(", ") || "(无)"}\n- N/A 正确跳过: ${r.na_correctly_skipped.join(", ") || "—"}${r.na_leaked.length ? ` · ⚠ N/A 误调: ${r.na_leaked.join(", ")}` : ""}\n\n`;
    md += `| Provider | 工具 | http | status | 延迟 | 记录 |\n|---|---|---|---|---|---|\n`;
    for (const [p, info] of Object.entries(r.providers_fired)) md += `| ${p} | ${info.tool || "—"} | ${info.http ?? "—"} | ${info.status ?? (info.ok ? "ok" : "—")} | ${ms(info.latency_ms)} | ${info.records ?? "—"} |\n`;
    md += `\n**结论答案**: ${r.answer ? r.answer.slice(0, 500) : "(无)"}\n\n`;
  }
  md += `## 成本 / 配额(§4.3)\n\n- ImportYeti: ${totIY} 次(~$${totCost.toFixed(2)})\n- Hunter: ${totH} 次\n- Abstract: ${totA} 次\n`;
  const credits = results.map((r) => r.cost.credits && r.cost.credits.importyeti).filter((x) => x != null);
  if (credits.length) md += `- ImportYeti creditsRemaining(末次): ${credits[credits.length - 1]}\n`;
  const iyExec = results.flatMap((r) => r.cost.importyeti_exec_ms || []);
  if (iyExec.length) md += `- ImportYeti executionTime: ${iyExec.join(", ")} ms\n`;
  md += `\n## 验收\n\n- 8 工具覆盖 ${unionFired.size}/8 ${unionFired.size >= 8 ? "✅" : "⚠"}\n- 渲染崩溃 / agent_timeout: ${results.some((r) => r.status !== "ok") ? "⚠ 见上表" : "无 ✅"}\n`;

  const summary = path.join(OUTDIR, `summary-${RUN}.md`);
  fs.writeFileSync(summary, md);
  console.log(`\n[func] 写出: ${jsonl}`);
  console.log(`[func] 写出: ${summary}`);
  console.log(`\n==FUNC_SUMMARY== ` + JSON.stringify({ run: RUN, tasks: results.length, coverage_8: unionFired.size, union_fired: [...unionFired], cost_usd: Number(totCost.toFixed(2)), importyeti: totIY, hunter: totH, abstract: totA, statuses: results.map((r) => r.status) }));
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
