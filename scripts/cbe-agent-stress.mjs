// cbe-agent-stress.mjs — L3 max-intensity stress for cbe-accio-memory + cbe-lead-discovery.
// Drives the production gateway agent + agent.wait path through a worker pool, grading not just
// throughput but DATA-INTEGRITY UNDER SATURATION: marker-block survival, schema validity, accio
// no-memory-write, and cross-session bleed (per-session nonce uniqueness). Designed to be run at
// rising maxConcurrent rungs (the "shield removal") to force a real organic DeepSeek 429 and prove
// the deepseek→qwen→glm fallback catches on these two agents.
//   usage (server):  MODE=accio CONCURRENCY TOTAL RUNG ...   MODE=lead ...   MODE=mixed ...
//     MODE=mixed  OPENCLAW_DIR=/root/sentura/openclaw node /root/cbe-agent-stress.mjs 32 192 m32
//     env: DURATION_MS (soak: keep refilling queue until elapsed), WAIT_MS, RPC_MS, LEAD_FRACTION (mixed)
import fs from "node:fs";
import path from "node:path";
import * as L from "./cbe-lib.mjs";

const MODE = (process.env.MODE || "accio").toLowerCase(); // accio | lead | mixed
const CONCURRENCY = Number(process.argv[2] || 8);
const TOTAL = Number(process.argv[3] || CONCURRENCY * 6);
const RUNG = process.argv[4] || "r";
const DURATION_MS = Number(process.env.DURATION_MS || 0);
const LEAD_FRACTION = Number(process.env.LEAD_FRACTION || 0.34); // mixed: share of tasks that are lead
const FIXDIR = process.env.FIXTURE_DIR || "/root/cbe-fixtures";
const OUTDIR = process.env.OUTDIR || "/root/cbe-stress2-out";
const WAIT_MS = Number(process.env.WAIT_MS || 220000);
const RPC_MS = Number(process.env.RPC_MS || 300000);
const RUN = process.env.RUN || `st-${MODE}-${RUNG}-` + new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
const START_WALL = Date.now();
fs.mkdirSync(OUTDIR, { recursive: true });

const A_START = "ACCIO_SUMMARIES_JSON_START", A_END = "ACCIO_SUMMARIES_JSON_END";
const Lc_START = "LEAD_CANDIDATES_JSON_START", Lc_END = "LEAD_CANDIDATES_JSON_END";
const ACCIO_AGENT = "cbe-accio-memory", LEAD_AGENT = "cbe-lead-discovery";
const accioProviderOf = { cbe_intel_parse_accio_chat: "accio_parse", cbe_intel_summarize_accio_chat: "accio_summary", memory_search: "memory_search", memory_get: "memory_get" };
const leadProviderOf = { web_search: "tavily", web_fetch: "web_fetch", cbe_intel_domain_rdap_lookup: "rdap", cbe_intel_email_domain_check: "dns" };

// accio fixture mix, selectable via ACCIO_MODE:
//   fast  = golden 3-conv only (fast turns → best for piling up concurrent DeepSeek calls / 429-forcing)
//   mixed = golden + 20/50-conv (token variety)
//   heavy = 50/120-conv token bomb (host-RSS + large-export latency axis; needs a high WAIT_MS)
const ACCIO_MIXES = {
  fast: [{ f: "accio-chat-records.sample.json", w: 1.0 }],
  mixed: [{ f: "accio-chat-records.sample.json", w: 0.55 }, { f: "generated/accio-20conv.json", w: 0.25 }, { f: "generated/accio-50conv.json", w: 0.20 }],
  heavy: [{ f: "generated/accio-50conv.json", w: 0.5 }, { f: "generated/accio-120conv.json", w: 0.5 }],
};
const ACCIO_MIX = ACCIO_MIXES[process.env.ACCIO_MODE || "fast"] || ACCIO_MIXES.fast;
function pickAccio(idx) { const r = (idx * 0.61803398875) % 1; let a = 0; for (const m of ACCIO_MIX) { a += m.w; if (r < a) return m.f; } return ACCIO_MIX[0].f; }
const LEAD_BRIEFS = [
  "为英国(GB)找 5 个手机壳/钢化膜下游 B2B 买家(零售/电商/维修连锁),排除批发商/工厂/目录/社媒,给公司名+官网+来源URL。",
  "为美国(US)找 5 个 USB-C 充电器下游 B2B 买家(电商零售),排除市场页/工厂,给公司名+官网+来源URL。",
  "为德国(DE)找 5 个手机配件下游 B2B 买家(零售),只要公司官网,排除目录站。",
];
// VERBATIM production prompt (dashboard buildEmployeePrompt) + a NONCE tag for the bleed check —
// using the real prompt so marker-survival is measured on the production path, not a paraphrase.
const accioPrompt = (json, nonce) =>
`[CBE Accio Memory Employee Task] (压测标记 NONCE=${nonce})

请处理以下 Alibaba Accio JSON，严格按 \`跨境电商/DESIGN.md\` Milestone 6 输出报告。

要求：
- 只依据下方 JSON 的 buyer/messages/attachments 分析，不要使用示例模板、文件名或 Dashboard 预设内容补全事实。
- 先调用 Accio parser 工具验证 JSON，并总结 conversation_count。
- 再调用 Accio summarizer 工具，为每条 conversation 生成一个 AccioChatSummary；如工具遗漏了 messages 中明确出现的字段，请基于原文补齐。
- 提取公司信息、产品、型号、数量、月潜量、目标/报价/最佳价格、包装加价、付款/物流/证书条款、next_actions、behavior_signals。
- 只生成 memory_write_preview，不要声称已经写入长期记忆。
- 生成 screening_handoff_target，source 必须是 "accio_memory"。
- 最后用以下标记包住 JSON 数组，供 Dashboard 解析：
${A_START}
[...]
${A_END}

Accio JSON:
${json}`;
const leadJsonTail = `请用简体中文输出操作员摘要,并在最后用 ${Lc_START} 和 ${Lc_END} 标记(不要放进代码块)包一段 leads JSON 数组,每个候选含 lead_id、company_name、country、buyer_type、matched_products、source_urls、discovery_evidence、dedupe_key、duplicate_status、created_at。`;
const leadPrompt = (brief, nonce) => `(压测标记 NONCE=${nonce}) 你是营销获客员工。${brief} ${leadJsonTail}`;

function taskFor(idx) {
  const nonce = `n${RUNG}x${idx}x${START_WALL}`;
  let isLead = MODE === "lead";
  if (MODE === "mixed") isLead = ((idx * 0.61803398875) % 1) < LEAD_FRACTION;
  if (isLead) { const b = LEAD_BRIEFS[idx % LEAD_BRIEFS.length]; return { agent: LEAD_AGENT, kind: "lead", nonce, message: leadPrompt(b, nonce), providerOf: leadProviderOf }; }
  const f = pickAccio(idx); const json = fs.readFileSync(path.join(FIXDIR, f), "utf8");
  return { agent: ACCIO_AGENT, kind: "accio", nonce, fixture: f, message: accioPrompt(json, nonce), providerOf: accioProviderOf };
}

function gradeTask(t, parsed) {
  const ans = parsed ? (parsed.fullAssistant || parsed.answer || "") : "";
  const shorts = parsed ? L.toolShorts(parsed) : [];
  // nonce uniqueness inside this session file (cross-session bleed detector)
  const nonces = [...new Set((ans.match(/NONCE=(\w+)/g) || []).map((s) => s.slice(6)))];
  const userNonces = parsed ? [...new Set((fs.readFileSync(parsed.file, "utf8").match(/NONCE=(\w+)/g) || []).map((s) => s.slice(6)))] : [];
  const foreign = userNonces.filter((n) => n !== t.nonce);
  if (t.kind === "accio") {
    const mk = L.extractMarker(ans, A_START, A_END);
    const arr = Array.isArray(mk.json) ? mk.json : [];
    const validN = arr.filter((s) => L.validateAccioSummary(s).valid).length;
    const noWriteClaim = !/已写入(长期)?记忆|memory written|persisted to (vector|long)/i.test(ans);
    const noWriteTool = !shorts.some((s) => /memory_write|memory_upsert|memory_add|memory_put/.test(s));
    return { marker_ok: mk.present && !mk.parseErr, marker_err: mk.parseErr || null, summaries: arr.length, schema_valid: validN, no_write_claim: noWriteClaim, no_write_tool: noWriteTool, foreign_nonce: foreign, parse_err: mk.parseErr || null };
  }
  const mk = L.extractMarker(ans, Lc_START, Lc_END);
  const arr = Array.isArray(mk.json) ? mk.json : (mk.json && Array.isArray(mk.json.leads) ? mk.json.leads : []);
  const validN = arr.filter((l) => L.validateLeadCandidate(l).valid).length;
  return { marker_ok: mk.present && !mk.parseErr, marker_err: mk.parseErr || null, leads: arr.length, schema_valid: validN, foreign_nonce: foreign, parse_err: mk.parseErr || null };
}

const results = [];
const errs = {};
let dispatched = 0;
const nextIdx = (() => { let i = 0; return () => (DURATION_MS ? (Date.now() - START_WALL < DURATION_MS ? i++ : -1) : (i < TOTAL ? i++ : -1)); })();

async function worker(client) {
  for (;;) {
    const idx = nextIdx();
    if (idx < 0) break;
    const t = taskFor(idx);
    dispatched++;
    const sessionKey = `agent:${t.agent}:st-${RUNG}-${idx}-${START_WALL}`.toLowerCase();
    const idem = `st-${RUNG}-${idx}-${START_WALL}`;
    const d = await L.dispatch(client, { agent: t.agent, sessionKey, idem, message: t.message, waitMs: WAIT_MS, rpcMs: RPC_MS });
    if (d.status !== "ok") errs[d.status] = (errs[d.status] || 0) + 1;
    await L.sleep(800);
    const file = L.findSessionFile(t.agent, sessionKey);
    const parsed = file ? L.parseTrajectory(file, t.providerOf) : null;
    const g = gradeTask(t, parsed);
    results.push({ idx, run: RUN, agent: t.agent, kind: t.kind, fixture: t.fixture || null, nonce: t.nonce, status: d.status, t_e2e_ms: d.t_e2e, t_queue_ms: d.t_queue, t_llm_ms: parsed?.llmMs ?? null, turns: parsed?.turns ?? null, tools_n: parsed ? parsed.calls.length : 0, ...g });
    if (g.foreign_nonce && g.foreign_nonce.length) console.log(`[${RUN}] #${idx} ⚠ BLEED foreign nonce in ${t.agent}: ${g.foreign_nonce.join(",")}`);
    if (dispatched % 10 === 0) console.log(`[${RUN}] ${dispatched} dispatched, ${results.length} done, errs=${JSON.stringify(errs)}`);
  }
}

(async () => {
  const client = new L.Rpc(`Sentura stress ${MODE}`);
  await client.connect();
  console.log(`[${RUN}] connected MODE=${MODE} concurrency=${CONCURRENCY} ${DURATION_MS ? "soak=" + (DURATION_MS / 1000) + "s" : "total=" + TOTAL} leadFrac=${MODE === "mixed" ? LEAD_FRACTION : "-"}`);
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(client)));
  client.close();
  const wall = (Date.now() - START_WALL) / 1000;
  const okN = results.filter((r) => r.status === "ok").length;
  const e2es = results.filter((r) => r.status === "ok").map((r) => r.t_e2e_ms);
  const accio = results.filter((r) => r.kind === "accio"), lead = results.filter((r) => r.kind === "lead");
  const markerSurv = (rs) => { const done = rs.filter((r) => r.status === "ok"); return done.length ? (done.filter((r) => r.marker_ok).length / done.length) : null; };
  const bleed = results.filter((r) => r.foreign_nonce && r.foreign_nonce.length);
  const pctv = (a, p) => L.pct(a, p);
  fs.writeFileSync(path.join(OUTDIR, `results-${RUN}.jsonl`), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const summary = {
    run: RUN, mode: MODE, concurrency: CONCURRENCY, soak_s: DURATION_MS ? DURATION_MS / 1000 : null, total_dispatched: dispatched, done: results.length, ok: okN,
    wall_s: Math.round(wall), throughput_per_min: Math.round(results.length / wall * 60 * 10) / 10,
    errors: errs, e2e_p50_s: Math.round(pctv(e2es, 50) / 100) / 10, e2e_p95_s: Math.round(pctv(e2es, 95) / 100) / 10, e2e_max_s: Math.round(Math.max(0, ...e2es) / 100) / 10,
    accio: { n: accio.length, ok: accio.filter((r) => r.status === "ok").length, marker_survival: markerSurv(accio), no_write_violations: accio.filter((r) => r.no_write_claim === false || r.no_write_tool === false).length },
    lead: { n: lead.length, ok: lead.filter((r) => r.status === "ok").length, marker_survival: markerSurv(lead) },
    cross_session_bleed: bleed.length, bleed_detail: bleed.slice(0, 5).map((r) => ({ agent: r.agent, nonce: r.nonce, foreign: r.foreign_nonce })),
  };
  let md = `# cbe 压测2(${MODE})— ${RUN}\n\n并发 ${CONCURRENCY} · ${DURATION_MS ? "soak " + DURATION_MS / 1000 + "s" : "total " + TOTAL} · 完成 ${results.length} · 墙钟 ${wall.toFixed(0)}s\n\n`;
  md += `- 吞吐: ${summary.throughput_per_min}/min · 成功 ${okN}/${results.length} · 错误 ${JSON.stringify(errs)}\n`;
  md += `- e2e p50/p95/max: ${summary.e2e_p50_s}/${summary.e2e_p95_s}/${summary.e2e_max_s}s\n`;
  md += `- accio: ${summary.accio.ok}/${summary.accio.n} ok · marker存活 ${summary.accio.marker_survival == null ? "—" : (summary.accio.marker_survival * 100).toFixed(1) + "%"} · 写入违规 ${summary.accio.no_write_violations}\n`;
  md += `- lead: ${summary.lead.ok}/${summary.lead.n} ok · marker存活 ${summary.lead.marker_survival == null ? "—" : (summary.lead.marker_survival * 100).toFixed(1) + "%"}\n`;
  md += `- 跨会话串扰(foreign nonce): ${bleed.length} ${bleed.length ? "⚠️" : "✅ 无"}\n`;
  fs.writeFileSync(path.join(OUTDIR, `summary-${RUN}.md`), md);
  console.log(`\n[${RUN}] wrote results-${RUN}.jsonl + summary-${RUN}.md`);
  console.log(`\n==STRESS2_SUMMARY== ` + JSON.stringify(summary));
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
