// cbe-handoff-e2e.mjs — L2 handoff-to-screening end-to-end (artifact/clipboard handoff, NOT a
// runtime cross-agent call). Two stages, injecting the human/clipboard hop the same way the
// dashboard does.
//   STAGE 1 (produce): gateway-drive cbe-lead-discovery + cbe-accio-memory to emit a typed handoff
//     payload; negative-assert NO sessions_send/sessions_spawn/gateway tool fired (structural proof
//     there is no auto-invocation).
//   STAGE 2 (consume parser): run the screening intake parser (mirror of
//     sentura/dashboard/.../screening/page.tsx buildScreeningPayload) over the shapes the two senders
//     actually emit — proving {targets:[...]} (accio) and the full {handoff_id,...,targets:[...]}
//     envelope (lead) silently parse to an EMPTY batch under the current code, while {leads:[...]}
//     and a bare array work. Re-run after the fix to confirm all shapes ingest.
//   usage (server): OPENCLAW_DIR=/root/sentura/openclaw node /root/cbe-handoff-e2e.mjs
import fs from "node:fs";
import path from "node:path";
import * as L from "./cbe-lib.mjs";

const OUTDIR = process.env.OUTDIR || "/root/cbe-agent-out";
const WAIT_MS = Number(process.env.WAIT_MS || 200000);
const RUN = process.env.RUN || "handoff-" + new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
fs.mkdirSync(OUTDIR, { recursive: true });

// PARSER_VARIANT=current mirrors today's buggy buildScreeningPayload; PARSER_VARIANT=fixed mirrors
// the proposed fix (also unwrap {targets:[...]} and the outer handoff envelope). Lets this test
// document both the bug and the fix without importing the React page.
const VARIANT = process.env.PARSER_VARIANT || "current";
function buildTargets(batchJson) {
  let parsed;
  try { parsed = JSON.parse(batchJson || "[]"); } catch (e) { return { error: "JSON.parse failed: " + e.message }; }
  if (VARIANT === "fixed") {
    // proposed fix: bare array | {leads:[]} | {targets:[]} | {…envelope…, targets|leads: []}
    const pick = (o) => Array.isArray(o?.leads) ? o.leads : Array.isArray(o?.targets) ? o.targets : null;
    const targets = Array.isArray(parsed) ? parsed : (pick(parsed) || []);
    return { targets };
  }
  // current (page.tsx:652-658): bare array | {leads:[]} ; everything else → []
  const targets = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" && Array.isArray(parsed.leads) ? parsed.leads : []);
  return { targets };
}

// tolerant: pull JSON objects/arrays containing leads|targets|handoff from agent prose
function extractPayloads(text) {
  const out = [];
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "{" && ch !== "[") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") { depth--; if (depth === 0) { const blk = s.slice(i, j + 1); if (/targets|leads|handoff_id|ready_for_screening/.test(blk)) { try { out.push({ raw: blk, json: JSON.parse(blk) }); } catch { /* skip */ } } i = j; break; } }
    }
  }
  return out;
}

const LEAD = "cbe-lead-discovery", ACCIO = "cbe-accio-memory";
const sessionsTools = (parsed) => L.toolShorts(parsed).filter((s) => /sessions_send|sessions_spawn|^gateway$|^message$|agents_list/.test(s));

(async () => {
  const client = new L.Rpc("Sentura handoff E2E");
  await client.connect();
  console.log(`[handoff] run=${RUN} parser=${VARIANT}`);
  const report = { run: RUN, parser_variant: VARIANT, stage1: {}, stage2: [] };

  // ───── STAGE 1: produce ─────
  const leadMsg = `你是营销获客员工。假设我已选定 2 个候选买家(英国手机维修连锁、美国电商零售)。请把它们打包成发往背调员工 cbe-buyer-screening 的 handoff 载荷:输出一个 JSON,含 handoff_id、from_agent='cbe-lead-discovery'、to_agent='cbe-buyer-screening'、status='ready_for_screening'、targets 数组(每个含 company_name、country、website、supplied_fields、missing_fields=[registry_number,trade_records,financial_filing])。明确说明背调尚未开始。不要发任何消息或调用其他员工。`;
  const accioJson = fs.readFileSync(path.join(process.env.FIXTURE_DIR || "/root/cbe-fixtures", "accio-chat-records.sample.json"), "utf8");
  const accioMsg = `[CBE Accio Memory Employee Task]\n请先用 parser/summarizer 处理这份 Accio JSON,然后把【智利买家 Andes Mobile Parts】打包成发往 cbe-buyer-screening 的 handoff:输出一个 JSON,含 source='accio_memory'、company_name、country、website、email、supplied_fields、missing_fields。不要调用任何背调/外部工具,只产出待移交载荷。\nAccio JSON:\n${accioJson}`;

  for (const [agent, msg, who] of [[LEAD, leadMsg, "lead"], [ACCIO, accioMsg, "accio"]]) {
    const sk = `agent:${agent}:${RUN}-${who}`.toLowerCase();
    const d = await L.dispatch(client, { agent, sessionKey: sk, idem: `${RUN}-${who}`, message: msg, waitMs: WAIT_MS });
    await L.sleep(1500);
    const f = L.findSessionFile(agent, sk);
    const parsed = f ? L.parseTrajectory(f, {}) : null;
    const ans = parsed ? (parsed.fullAssistant || parsed.answer) : "";
    const payloads = extractPayloads(ans);
    const st = parsed ? sessionsTools(parsed) : [];
    report.stage1[who] = {
      agent, status: d.status, payloads_found: payloads.length,
      no_runtime_invoke: st.length === 0, sessions_tools_fired: st,
      sample_payload: payloads[0] ? payloads[0].raw.slice(0, 400) : null,
      shapes: payloads.map((p) => Array.isArray(p.json) ? "array" : Object.keys(p.json).slice(0, 6).join(",")),
    };
    console.log(`[handoff] stage1 ${who}(${agent}) status=${d.status} payloads=${payloads.length} no_runtime_invoke=${st.length === 0} shapes=${report.stage1[who].shapes.join(" | ")}`);
  }
  client.close();

  // ───── STAGE 2: consume parser over the shapes the senders emit ─────
  const sampleTargets = [{ company_name: "Acme Repairs Ltd", country: "GB", website: "https://acme.example" }, { company_name: "Best Retail Inc", country: "US", website: "https://bestretail.example" }];
  const shapes = {
    "bare-array": JSON.stringify(sampleTargets),
    "leads-wrapped (lead clipboard)": JSON.stringify({ leads: sampleTargets }),
    "targets-wrapped (accio clipboard)": JSON.stringify({ targets: sampleTargets }),
    "full-envelope (lead agent package)": JSON.stringify({ handoff_id: "h1", from_agent: LEAD, to_agent: "cbe-buyer-screening", status: "ready_for_screening", targets: sampleTargets }),
    "malformed": '{ "leads": [ ',
  };
  // also fold in the REAL payloads captured from stage 1
  for (const who of ["lead", "accio"]) { const sp = report.stage1[who]?.sample_payload; if (sp) shapes[`real-${who}-emit`] = report.stage1[who].sample_payload; }
  for (const [name, json] of Object.entries(shapes)) {
    const r = buildTargets(json);
    const n = r.error ? "ERR" : r.targets.length;
    const expectedNonEmpty = !/malformed/.test(name);
    const ok = r.error ? /malformed/.test(name) : (expectedNonEmpty ? r.targets.length > 0 : true);
    report.stage2.push({ shape: name, parsed_targets: n, ok });
    console.log(`[handoff] stage2 [${VARIANT}] ${name.padEnd(38)} -> targets=${n} ${ok ? "✅" : "❌ DROPPED-TO-EMPTY (silent data loss)"}`);
  }
  fs.writeFileSync(path.join(OUTDIR, `handoff-${RUN}-${VARIANT}.json`), JSON.stringify(report, null, 2));
  console.log(`\n==HANDOFF_SUMMARY== ` + JSON.stringify({ run: RUN, variant: VARIANT, stage1: Object.fromEntries(Object.entries(report.stage1).map(([k, v]) => [k, { status: v.status, payloads: v.payloads_found, no_runtime_invoke: v.no_runtime_invoke }])), stage2: report.stage2 }));
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
