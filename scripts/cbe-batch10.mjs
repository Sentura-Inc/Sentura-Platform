// cbe-batch10.mjs — 10-项/任务 压测:背调 batch-10(单会话查 N 家)+ 获客 find-10(单任务找 N 个)
// 回答两问:(1) 单任务 5→10 的 耗时/上下文token/工具数/成本 增长;(2) 这种"重任务"下单盒安全并发拐点。
// 复用 cbe-lib(Rpc/dispatch/parseTrajectory/sessionEntry/marker/validators)+ 移植 fulltool 的成本抽取。
//   PHASE=A: 真实工具 + 付费授权(背调),低并发,标定基线
//   PHASE=B: 并发阶梯 + 付费 CAP 熔断(不另造 mock;rss 压力来自 LLM 上下文与工具后端无关)
// 用法(服务器):
//   KIND=screen PHASE=A OPENCLAW_DIR=/root/sentura/openclaw node /root/cbe-batch10.mjs 1 1 a-smoke
//   KIND=lead   PHASE=A node /root/cbe-batch10.mjs 1 1 a-smoke
//   KIND=mixed  PHASE=B IY_CAP=40 node /root/cbe-batch10.mjs 8 24 b8
import fs from "node:fs";
import path from "node:path";
import * as L from "./cbe-lib.mjs";

const KIND = (process.env.KIND || "screen").toLowerCase(); // screen | lead | mixed
const PHASE = (process.env.PHASE || "A").toUpperCase();    // A | B
const CONCURRENCY = Number(process.argv[2] || 1);
const TOTAL = Number(process.argv[3] || 1);
const RUNG = process.argv[4] || (PHASE === "A" ? "a" : "b");
const ITEMS = Number(process.env.ITEMS || 10);
const LEAD_FRACTION = Number(process.env.LEAD_FRACTION || 0.5);
const WAIT_MS = Number(process.env.WAIT_MS || 890000); // batch-10 全背调可能很长
const RPC_MS = Number(process.env.RPC_MS || 900000);
const OUTDIR = process.env.OUTDIR || "/root/cbe-batch10-out";
const RUN = process.env.RUN || `b10-${KIND}-${PHASE}-${RUNG}-` + new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
const START_WALL = Date.now();
fs.mkdirSync(OUTDIR, { recursive: true });
// 🔴 限量付费源累计上限(成功调用数,到顶停派新任务)
const CAP = { importyeti: Number(process.env.IY_CAP || 40), hunter: Number(process.env.HUNTER_CAP || 60), abstract: Number(process.env.ABS_CAP || 60) };

const SCREEN_AGENT = "cbe-buyer-screening", LEAD_AGENT = "cbe-lead-discovery";
const S_START = "SCREEN_REPORTS_JSON_START", S_END = "SCREEN_REPORTS_JSON_END";
const Lc_START = "LEAD_CANDIDATES_JSON_START", Lc_END = "LEAD_CANDIDATES_JSON_END";
const IMPORTYETI_UNIT_USD = 0.09;

const screenProviderOf = {
  cbe_intel_company_registry_search: "companies_house", cbe_intel_company_profile: "companies_house",
  cbe_intel_domain_rdap_lookup: "rdap", cbe_intel_email_domain_check: "dns",
  cbe_intel_official_contact_email_search: "official_site", cbe_intel_sec_lookup: "sec",
  cbe_intel_trade_record_search: "importyeti", cbe_intel_score_buyer: "score",
  web_search: "tavily", web_fetch: "web_fetch",
};
const leadProviderOf = { web_search: "tavily", web_fetch: "web_fetch", cbe_intel_domain_rdap_lookup: "rdap", cbe_intel_email_domain_check: "dns" };

// batch-10 背调目标:UK + US 真实零售商(给域名 + 待验邮箱,触发付费校验)
const COMPANIES = [
  { name: "Tesco PLC", domain: "tesco.com", email: "customer.services@tesco.com", country: "UK" },
  { name: "Apple Inc.", domain: "apple.com", email: "media.help@apple.com", country: "US" },
  { name: "Currys plc", domain: "currys.co.uk", email: "customer.services@currys.co.uk", country: "UK" },
  { name: "Best Buy Co. Inc.", domain: "bestbuy.com", email: "customercare@bestbuy.com", country: "US" },
  { name: "J Sainsbury plc", domain: "sainsburys.co.uk", email: "customer.relations@sainsburys.co.uk", country: "UK" },
  { name: "Walmart Inc.", domain: "walmart.com", email: "help@walmart.com", country: "US" },
  { name: "Argos Limited", domain: "argos.co.uk", email: "support@argos.co.uk", country: "UK" },
  { name: "Target Corporation", domain: "target.com", email: "guest.relations@target.com", country: "US" },
  { name: "Marks and Spencer plc", domain: "marksandspencer.com", email: "customer.service@marksandspencer.com", country: "UK" },
  { name: "The Home Depot Inc.", domain: "homedepot.com", email: "customercare@homedepot.com", country: "US" },
];

function screenPrompt(nonce) {
  const list = COMPANIES.slice(0, ITEMS).map((t, i) => `${i + 1}. ${t.country} 公司 ${t.name},域名 ${t.domain},待验邮箱 ${t.email}`).join("\n");
  return `(压测标记 NONCE=${nonce}) 你是买家背调员工。operator 已明确授权"付费邮箱校验 + 付费贸易数据(单家预算上限 $1)"。请对以下 ${ITEMS} 家公司【逐家】各做一次尽量完整的买家背调:
${list}

每家执行:① UK 公司用 Companies House 查注册信息(注册号/状态/地址)、US 公司用 SEC 查公开披露摘要;② RDAP 查该域名注册;③ 检查该域名 MX/SPF/DMARC;④ 对该邮箱做邮箱校验,enable_paid_validation=true(operator 已授权付费校验);⑤ 查海关进口贸易记录,operator 已启用付费贸易数据、max_paid_spend_usd=1、source=auto;⑥ 网页搜索补充公开口碑。
每家给约 80 字中文可信度小结 + trusted_candidate/cautious/high_risk 之一的结论。
最后用以下标记包一个 JSON 数组(正好 ${ITEMS} 个对象),供 Dashboard 解析,每个对象含 company_name、country、trust_tier、confidence、evidence_sources(数组)、summary:
${S_START}
[...]
${S_END}`;
}
const leadJsonTail = `请用简体中文输出操作员摘要,并在最后用 ${Lc_START} 和 ${Lc_END} 标记(不要放进代码块)包一段 leads JSON 数组,每个候选含 lead_id、company_name、country、buyer_type、matched_products、source_urls、discovery_evidence、dedupe_key、duplicate_status、created_at。`;
function leadPrompt(nonce) {
  return `(压测标记 NONCE=${nonce}) 你是营销获客员工。根据手机壳、钢化膜、USB-C 充电器关键词,为英国(GB)和美国(US)合计找 ${ITEMS} 个潜在 B2B 下游买家(零售商/电商/手机维修连锁),排除批发商/工厂/目录站/社媒/市场页。每个买家给公司名、官网域名、为什么是合适买家、来源 URL。${leadJsonTail}`;
}

function taskFor(idx) {
  const nonce = `b10${RUNG}x${idx}x${START_WALL}`;
  let isLead = KIND === "lead";
  if (KIND === "mixed") isLead = ((idx * 0.61803398875) % 1) < LEAD_FRACTION;
  if (isLead) return { agent: LEAD_AGENT, kind: "lead", nonce, message: leadPrompt(nonce), providerOf: leadProviderOf };
  return { agent: SCREEN_AGENT, kind: "screen", nonce, message: screenPrompt(nonce), providerOf: screenProviderOf };
}

// 移植 fulltool 的 provider/成本抽取(operates on cbe-lib parseTrajectory 的 calls)
function extractProviders(parsed) {
  const fired = {};
  const cost = { importyeti_calls: 0, importyeti_usd: 0, hunter_calls: 0, abstract_calls: 0, importyeti_exec_ms: [], credits: {} };
  const mark = (p, info) => { if (!fired[p]) fired[p] = info; else Object.assign(fired[p], info); };
  for (const c of parsed.calls) {
    const r = c.result || {}; const lat = c.latency_ms;
    if (c.provider === "rdap") mark("rdap", { ok: /ok|found|redirect|checked|200|302/i.test(String(r.status || r.http_status || "")), latency_ms: lat });
    else if (c.provider === "sec") {
      const t = c.resultText || "";
      const st = r.status || (t.match(/"status":\s*"(\w+)"/) || [])[1];
      const http = r.http_status ?? Number((t.match(/"http_status":\s*(\d+)/) || [])[1]);
      mark("sec", { ok: st === "found" || http === 200, latency_ms: lat });
    } else if (c.provider === "companies_house") mark("companies_house", { ok: r.status === "found" || r.http_status === 200, latency_ms: lat });
    else if (c.provider === "official_site") mark("official_site", { ok: r.status === "found", latency_ms: lat });
    else if (c.provider === "dns") {
      const mx = r.checks && r.checks.mx;
      mark("dns", { ok: r.status === "checked" || (mx && mx.present), latency_ms: lat });
      for (const pv of ((r.paid_validation && r.paid_validation.providers) || [])) {
        if (pv.provider === "abstract") { cost.abstract_calls++; mark("abstract", { ok: pv.http_status === 200, latency_ms: lat }); }
        if (pv.provider === "hunter") { cost.hunter_calls++; mark("hunter", { ok: pv.http_status === 200, latency_ms: lat }); }
      }
    } else if (c.short === "cbe_intel_trade_record_search") {
      const prov = r.provider || "importyeti"; const body = r.records || {};
      const exec = body.executionTime || body.execution_time;
      const credits = body.creditsRemaining ?? body.credits_remaining ?? body.requestsRemaining;
      const ok = r.status === "found" || r.http_status === 200;
      mark(prov === "public_web_fallback" ? "importyeti" : prov, { ok, latency_ms: lat, note: r.status });
      if (prov === "importyeti" && ok) { cost.importyeti_calls++; cost.importyeti_usd += IMPORTYETI_UNIT_USD; if (exec) cost.importyeti_exec_ms.push(exec); if (credits != null) cost.credits.importyeti = credits; }
    } else if (c.provider === "tavily") mark("tavily", { ok: !!r && !r.error, latency_ms: lat });
  }
  return { fired, cost };
}

function gradeTask(t, parsed) {
  const ans = parsed ? (parsed.fullAssistant || parsed.answer || "") : "";
  if (t.kind === "screen") {
    const mk = L.extractMarker(ans, S_START, S_END);
    const arr = Array.isArray(mk.json) ? mk.json : [];
    const withName = arr.filter((o) => o && typeof o.company_name === "string" && o.company_name.length).length;
    return { marker_ok: mk.present && !mk.parseErr, marker_err: mk.parseErr || null, items_produced: arr.length, items_named: withName };
  }
  const mk = L.extractMarker(ans, Lc_START, Lc_END);
  const arr = Array.isArray(mk.json) ? mk.json : (mk.json && Array.isArray(mk.json.leads) ? mk.json.leads : []);
  const validN = arr.filter((l) => L.validateLeadCandidate(l).valid).length;
  return { marker_ok: mk.present && !mk.parseErr, marker_err: mk.parseErr || null, items_produced: arr.length, items_named: validN };
}

const results = [];
const errs = {};
const budget = { importyeti: 0, hunter: 0, abstract: 0 };
let stopReason = null;
const budgetExceeded = () => budget.importyeti >= CAP.importyeti || budget.hunter >= CAP.hunter || budget.abstract >= CAP.abstract;
let dispatched = 0;
const queue = Array.from({ length: TOTAL }, (_, i) => i);

async function worker(client) {
  while (queue.length) {
    if (PHASE === "B" && budgetExceeded()) { if (!stopReason) stopReason = `budget cap hit (IY=${budget.importyeti}/${CAP.importyeti} H=${budget.hunter}/${CAP.hunter} A=${budget.abstract}/${CAP.abstract})`; break; }
    const idx = queue.shift();
    if (idx === undefined) break;
    const t = taskFor(idx);
    dispatched++;
    const sessionKey = `agent:${t.agent}:b10-${RUNG}-${idx}-${START_WALL}`.toLowerCase();
    const idem = `b10-${RUNG}-${idx}-${START_WALL}`;
    const d = await L.dispatch(client, { agent: t.agent, sessionKey, idem, message: t.message, waitMs: WAIT_MS, rpcMs: RPC_MS });
    if (d.status !== "ok") errs[d.status] = (errs[d.status] || 0) + 1;
    await L.sleep(900);
    const file = L.findSessionFile(t.agent, sessionKey);
    const parsed = file ? L.parseTrajectory(file, t.providerOf) : null;
    const ext = parsed ? extractProviders(parsed) : { fired: {}, cost: { importyeti_calls: 0, hunter_calls: 0, abstract_calls: 0, importyeti_usd: 0 } };
    budget.importyeti += ext.cost.importyeti_calls; budget.hunter += ext.cost.hunter_calls; budget.abstract += ext.cost.abstract_calls;
    const g = gradeTask(t, parsed);
    const ent = L.sessionEntry(t.agent, sessionKey) || {};
    const rec = {
      idx, run: RUN, kind: t.kind, agent: t.agent, items_target: ITEMS, status: d.status, error: d.error || null,
      t_e2e_ms: d.t_e2e, t_queue_ms: d.t_queue, t_llm_ms: parsed?.llmMs ?? null, turns: parsed?.turns ?? null,
      tools_n: parsed ? parsed.calls.length : 0, providers_fired: Object.keys(ext.fired), cost: ext.cost,
      ...g,
      // sessions.json 富字段(真实 token / 上下文预算 / 估算成本)
      input_tokens: ent.inputTokens ?? null, output_tokens: ent.outputTokens ?? null, total_tokens: ent.totalTokens ?? null,
      context_tokens: ent.contextTokens ?? null, context_budget_status: ent.contextBudgetStatus ?? null,
      est_cost_usd: ent.estimatedCostUsd ?? null, runtime_ms: ent.runtimeMs ?? null, model: ent.model ?? null,
    };
    results.push(rec);
    console.log(`[${RUN}] #${idx} ${t.kind} ${d.status} e2e=${L.ms(d.t_e2e)} turns=${rec.turns} tools=${rec.tools_n} items=${g.items_produced}/${ITEMS} ctx=${rec.context_budget_status} tok=${rec.total_tokens} ${ext.cost.importyeti_calls ? "IY+" + ext.cost.importyeti_calls : ""}${ext.cost.hunter_calls ? " H+" + ext.cost.hunter_calls : ""}${ext.cost.abstract_calls ? " A+" + ext.cost.abstract_calls : ""}`);
  }
}

(async () => {
  const client = new L.Rpc(`Sentura batch10 ${KIND}`);
  await client.connect();
  console.log(`[${RUN}] connected KIND=${KIND} PHASE=${PHASE} items=${ITEMS} concurrency=${CONCURRENCY} total=${TOTAL}` + (PHASE === "B" ? ` caps(IY/H/A)=${CAP.importyeti}/${CAP.hunter}/${CAP.abstract}` : ""));
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(client)));
  client.close();
  const wall = (Date.now() - START_WALL) / 1000;
  const ok = results.filter((r) => r.status === "ok");
  const e2es = ok.map((r) => r.t_e2e_ms);
  const itemsTotal = ok.reduce((s, r) => s + (r.items_produced || 0), 0);
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const okTok = ok.map((r) => r.total_tokens).filter((x) => x != null);
  const okItems = ok.map((r) => r.items_produced);
  const ctxBudgets = {};
  for (const r of results) { const k = r.context_budget_status || "—"; ctxBudgets[k] = (ctxBudgets[k] || 0) + 1; }
  const totIY = results.reduce((s, r) => s + (r.cost.importyeti_calls || 0), 0);
  const totH = results.reduce((s, r) => s + (r.cost.hunter_calls || 0), 0);
  const totA = results.reduce((s, r) => s + (r.cost.abstract_calls || 0), 0);
  const totUSD = results.reduce((s, r) => s + (r.cost.importyeti_usd || 0), 0);
  const estUSD = ok.reduce((s, r) => s + (r.est_cost_usd || 0), 0);
  fs.writeFileSync(path.join(OUTDIR, `results-${RUN}.jsonl`), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const summary = {
    run: RUN, kind: KIND, phase: PHASE, items_per_task: ITEMS, concurrency: CONCURRENCY, total: TOTAL, done: results.length, ok: ok.length,
    wall_s: Math.round(wall), errors: errs, stop: stopReason,
    task_per_min: Math.round(results.length / wall * 600) / 10, items_per_min: Math.round(itemsTotal / wall * 600) / 10,
    e2e_p50_s: Math.round(L.pct(e2es, 50) / 100) / 10, e2e_p90_s: Math.round(L.pct(e2es, 90) / 100) / 10, e2e_max_s: Math.round(Math.max(0, ...e2es) / 100) / 10,
    e2e_mean_s: avg(e2es) != null ? Math.round(avg(e2es) / 100) / 10 : null,
    turns_mean: avg(ok.map((r) => r.turns).filter((x) => x != null)), tools_mean: avg(ok.map((r) => r.tools_n)),
    items_mean: avg(okItems), items_min_max: okItems.length ? `${Math.min(...okItems)}~${Math.max(...okItems)}` : "—",
    total_tokens_mean: avg(okTok), total_tokens_max: okTok.length ? Math.max(...okTok) : null,
    context_budget_dist: ctxBudgets, marker_ok: results.filter((r) => r.marker_ok).length,
    importyeti: totIY, hunter: totH, abstract: totA, importyeti_usd: Math.round(totUSD * 100) / 100, est_cost_usd_sum: Math.round(estUSD * 1000) / 1000,
  };
  let md = `# cbe batch-10 压测(${KIND} / Phase ${PHASE})— ${RUN}\n\n`;
  md += `items/任务=${ITEMS} · 并发 ${CONCURRENCY} · total ${TOTAL} · 完成 ${results.length} · 成功 ${ok.length} · 墙钟 ${wall.toFixed(0)}s\n\n`;
  md += `- 吞吐: ${summary.task_per_min} 任务/min · **${summary.items_per_min} 项/min** · 错误 ${JSON.stringify(errs)}${stopReason ? " · ⏹ " + stopReason : ""}\n`;
  md += `- e2e mean/p50/p90/max: ${summary.e2e_mean_s}/${summary.e2e_p50_s}/${summary.e2e_p90_s}/${summary.e2e_max_s}s\n`;
  md += `- 回合 mean ${summary.turns_mean} · 工具 mean ${summary.tools_mean} · 产出 items mean ${summary.items_mean}(范围 ${summary.items_min_max},目标 ${ITEMS})\n`;
  md += `- token: total mean ${summary.total_tokens_mean} · max ${summary.total_tokens_max} · 上下文预算分布 ${JSON.stringify(ctxBudgets)}\n`;
  md += `- 成本: ImportYeti ${totIY} 次($${summary.importyeti_usd}) · Hunter ${totH} · Abstract ${totA} · 网关估算 $${summary.est_cost_usd_sum}\n`;
  md += `- marker 存活: ${summary.marker_ok}/${results.length}\n`;
  fs.writeFileSync(path.join(OUTDIR, `summary-${RUN}.md`), md);
  console.log(`\n[${RUN}] wrote results-${RUN}.jsonl + summary-${RUN}.md`);
  console.log(`\n==BATCH10_SUMMARY== ` + JSON.stringify(summary));
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
