// cbe-lib.mjs — shared gateway WS plumbing + trajectory parsing + assertion helpers
// for the two-agent (cbe-accio-memory / cbe-lead-discovery) functional + stress drivers.
// Reuses the proven handshake / sessions.json→sessionId→.jsonl lookup / per-tool latency
// reconstruction from cbe-functional-test.mjs + cbe-fulltool-stress.mjs, generalized so the
// target AGENT, the provider map, and the success grader are all caller-supplied.
//
// Must run on a host that can require("ws") from OPENCLAW_DIR and read ~/.openclaw/agents/*
// (i.e. the server). Relative-imported by cbe-agent-functional.mjs / cbe-agent-stress.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

export const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/sentura/openclaw";
const require = createRequire(path.join(OPENCLAW_DIR, "package.json"));
const WS = require("ws");
const WebSocket = WS.WebSocket || WS;

export const HOME = os.homedir();
export const GATEWAY_URL = process.env.GW_URL || "ws://127.0.0.1:18789";
export const TOKEN = JSON.parse(fs.readFileSync(path.join(HOME, ".openclaw/openclaw.json"), "utf8")).gateway.auth.token;

export const sessDir = (agent) => path.join(HOME, ".openclaw/agents", agent, "sessions");
export const shortName = (n) => String(n || "").replace(/^cross-border-intel__/, "");
export const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
export const ms = (n) => (n == null ? "—" : (n / 1000).toFixed(2) + "s");
export const sleep = (n) => new Promise((r) => setTimeout(r, n));
export const hasCJK = (s) => /[一-鿿]/.test(String(s || ""));

// ── gateway WS JSON-RPC client (handshake verbatim from the proven drivers) ──
export class Rpc {
  constructor(clientName = "Sentura CBE Test") { this.pending = new Map(); this.id = 0; this.ws = null; this.clientName = clientName; }
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
              client: { id: "openclaw-tui", displayName: this.clientName, version: "0.1.0", platform: "node", mode: "ui" },
              caps: [], role: "operator",
              scopes: ["operator.read", "operator.write", "operator.admin"],
              auth: { token: TOKEN },
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
  rpc(method, params = {}, timeoutMs = 300000) {
    return new Promise((resolve, reject) => {
      const id = String(++this.id);
      const to = setTimeout(() => { this.pending.delete(id); reject(new Error("rpc timeout")); }, timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }
  close() { this.ws && this.ws.close(); }
}

// ── sessionKey → sessionId → <id>.jsonl (raw JSONL has no sessionKey; map via sessions.json) ──
export function sessionEntry(agent, sessionKey) {
  const k = String(sessionKey).toLowerCase(); // gateway lowercases on disk
  try { return JSON.parse(fs.readFileSync(path.join(sessDir(agent), "sessions.json"), "utf8"))[k] || null; } catch { return null; }
}
export function findSessionFile(agent, sessionKey) {
  const ent = sessionEntry(agent, sessionKey);
  if (ent && ent.sessionId) { const p = path.join(sessDir(agent), ent.sessionId + ".jsonl"); if (fs.existsSync(p)) return p; }
  return null;
}

// ── reconstruct tool timeline + per-tool latency + LLM turn time + final answer ──
export function parseTrajectory(file, providerOf = {}) {
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const msgs = lines.filter((o) => (o.type || "") === "message");
  const calls = new Map();
  const order = [];
  let prevTs = null, llmMs = 0, turns = 0, firstTs = null, lastTs = null;
  for (const m of msgs) {
    const mm = m.message || {};
    const ts = Date.parse(m.timestamp || mm.timestamp || "") || null;
    if (ts) { if (firstTs === null) firstTs = ts; lastTs = ts; }
    const role = mm.role;
    if (role === "assistant") {
      turns++;
      if (prevTs && ts) llmMs += Math.max(0, ts - prevTs);
      for (const c of (Array.isArray(mm.content) ? mm.content : [])) {
        if (c && c.type === "toolCall") {
          const short = shortName(c.name);
          calls.set(c.id, { id: c.id, name: c.name, short, provider: providerOf[short] || short, args: c.arguments, t_call: ts });
          order.push(c.id);
        }
      }
    } else if (role === "toolResult") {
      const call = calls.get(mm.toolCallId);
      const txt = Array.isArray(mm.content) ? mm.content.map((c) => (c && c.text) || "").join("") : "";
      let resJson = null; try { resJson = JSON.parse(txt); } catch { /* keep text */ }
      if (call) { call.t_res = ts; call.latency_ms = call.t_call && ts ? ts - call.t_call : null; call.result = resJson; call.resultText = txt.slice(0, 12000); }
    }
    if (ts) prevTs = ts;
  }
  let answer = "";
  for (let i = msgs.length - 1; i >= 0; i--) {
    const mm = msgs[i].message || {};
    if (mm.role === "assistant" && Array.isArray(mm.content)) {
      answer = mm.content.filter((c) => c && c.type === "text").map((c) => c.text).join(" ").trim();
      if (answer) break;
    }
  }
  // full concatenated assistant text (markers can land across multiple assistant messages)
  const fullAssistant = msgs.filter((m) => (m.message || {}).role === "assistant")
    .flatMap((m) => (Array.isArray(m.message.content) ? m.message.content : []))
    .filter((c) => c && c.type === "text").map((c) => c.text).join("\n");
  return { calls: [...calls.values()], order, llmMs, turns, traj_ms: firstTs && lastTs ? lastTs - firstTs : null, answer, fullAssistant, file };
}

export const toolShorts = (parsed) => parsed.calls.map((c) => c.short);
export const firedProviders = (parsed) => [...new Set(parsed.calls.map((c) => c.provider))];

// ── marker-block extraction (ACCIO_SUMMARIES_JSON_START/END, LEAD_CANDIDATES_JSON_START/END) ──
export function extractMarker(text, start, end) {
  const t = String(text || "");
  const countStart = t.split(start).length - 1;
  const countEnd = t.split(end).length - 1;
  const i = t.indexOf(start);
  if (i < 0) return { present: false, countStart, countEnd, json: null, raw: null, parseErr: null };
  const j = t.indexOf(end, i + start.length);
  if (j < 0) return { present: false, openOnly: true, countStart, countEnd, json: null, raw: null, parseErr: "end marker missing" };
  let raw = t.slice(i + start.length, j).trim();
  // tolerate a ```json fence accidentally placed inside the markers
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let json = null, parseErr = null; try { json = JSON.parse(raw); } catch (e) { parseErr = String(e.message); }
  return { present: true, countStart, countEnd, raw: raw.slice(0, 200), json, parseErr };
}

// ── lite LeadCandidate validator (mirrors sentura/lib/cross-border-ecommerce.ts LeadCandidateSchema) ──
export function validateLeadCandidate(o) {
  const errs = [];
  const reqStr = (k) => { if (!o || typeof o[k] !== "string" || !o[k].length) errs.push(`missing ${k}`); };
  reqStr("lead_id"); reqStr("company_name"); reqStr("country"); reqStr("buyer_type"); reqStr("dedupe_key");
  if (!Array.isArray(o?.matched_products) || o.matched_products.length < 1) errs.push("matched_products<1");
  if (!Array.isArray(o?.source_urls) || o.source_urls.length < 1) errs.push("source_urls<1");
  else if (!o.source_urls.every((u) => /^https?:\/\//.test(String(u)))) errs.push("source_urls not all URLs");
  if (!Array.isArray(o?.discovery_evidence) || o.discovery_evidence.length < 1) errs.push("discovery_evidence<1");
  if (o?.duplicate_status && !["new", "possible_duplicate", "duplicate"].includes(o.duplicate_status)) errs.push("bad duplicate_status");
  if (!o?.created_at) errs.push("missing created_at");
  return { valid: errs.length === 0, errs };
}

// ── lite AccioChatSummary validator ──
export function validateAccioSummary(o) {
  const errs = [];
  if (!o || typeof o.conversation_id !== "string") errs.push("missing conversation_id");
  const cp = o?.customer_profile;
  if (!cp || typeof cp.company_name !== "string") errs.push("missing customer_profile.company_name");
  if (cp && cp.company_evidence_status && !["needs_screening", "screened", "insufficient_evidence"].includes(cp.company_evidence_status)) errs.push("bad company_evidence_status");
  if (!Array.isArray(o?.purchase_intent) || o.purchase_intent.length < 1) errs.push("purchase_intent<1");
  return { valid: errs.length === 0, errs };
}

// dispatch one task through the production agent + agent.wait path; returns timing + status
export async function dispatch(client, { agent, sessionKey, idem, message, waitMs = 280000, rpcMs = 300000 }) {
  const t_enqueue = Date.now();
  let runId = null, result = null, t_accepted, t_done, status = "ok", error = null;
  try {
    const acc = await client.rpc("agent", { message, agentId: agent, sessionKey, idempotencyKey: idem }, 30000);
    t_accepted = Date.now();
    runId = acc && acc.runId;
    if (!runId) throw new Error("no runId: " + JSON.stringify(acc).slice(0, 160));
    result = await client.rpc("agent.wait", { runId, timeoutMs: waitMs }, rpcMs);
    t_done = Date.now();
    const st = String((result && (result.status || result.state)) || "");
    if (/timeout|error|fail|reject|cancel/i.test(st)) status = /timeout/i.test(st) ? "agent_timeout" : "agent_" + st;
  } catch (e) {
    t_accepted = t_accepted || Date.now(); t_done = Date.now();
    const msg = String((e && e.message) || e);
    status = /429|rate.?limit|quota|too many/i.test(msg) ? "429" : /timeout/i.test(msg) ? "timeout" : "error";
    error = msg.slice(0, 160);
  }
  return { runId, status, error, t_enqueue, t_accepted, t_done, t_e2e: t_done - t_enqueue, t_queue: t_accepted - t_enqueue, t_exec: t_done - t_accepted };
}
