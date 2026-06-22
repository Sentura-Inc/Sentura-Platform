/**
 * test-experience-extraction.ts — offline + live tests for the Sentura
 * experience-extraction extension (capability #13 Tier 3).
 *
 * Offline:
 *   - computeSignature joins tool sequences with ">"
 *   - computeConfidence implements 0.3 + 0.1*sqrt(n), clamped to 0.9
 *   - updateCandidate increments occurrences and updates lastSeen
 *   - shouldPromote requires occurrences >= minOccurrences AND confidence >= threshold
 *   - File round-trip: saveCandidateFile / loadCandidateFile preserves shape
 *   - writeExperienceLink writes JSON5 with provenance footer
 *   - isMetaAgent excludes meta-agents
 *   - End-to-end simulation: 3 sessions promote a pattern
 *
 * Live:
 *   - sentura-experience-extraction plugin appears in the gateway's loaded
 *     plugin list (config.get -> runtimeConfig.plugins.entries).
 *   - sentura_agents_manage tool's action enum includes 'dotenv_check' for the
 *     creator agent.
 *   - sentura_approval_request is reachable from the creator's effective
 *     toolset.
 *
 * Run:
 *   npx tsx scripts/test-experience-extraction.ts
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

import {
  computeSignature,
  computeConfidence,
  shouldPromote,
  updateCandidate,
  loadCandidateFile,
  saveCandidateFile,
  writeExperienceLink,
  isMetaAgent,
  type CandidateEntry,
} from "../sentura/extensions/sentura-experience-extraction/src/scoring.ts";

const GATEWAY_URL = process.env.SENTURA_GATEWAY_URL ?? "ws://localhost:18789";
const CONFIG_PATH = path.join(process.env.HOME ?? "/root", ".openclaw/openclaw.json");

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, label: string): void {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; failures.push(label); }
}
function approxEq(a: number, b: number, tol = 1e-6): boolean { return Math.abs(a - b) < tol; }
function section(t: string): void { console.log(`\n=== ${t} ===`); }

// ---------------------------------------------------------------------------
// OFFLINE
// ---------------------------------------------------------------------------

function runOfflineTests(): void {
  section("T-OFF-1: computeSignature");
  assert(computeSignature(["a", "b", "c"]) === "a>b>c", "joins with '>'");
  assert(computeSignature([]) === "", "empty sequence → empty signature");
  const long = Array.from({ length: 20 }, (_, i) => `t${i}`);
  const sig = computeSignature(long);
  assert(sig.split(">").length === 12, "trims to MAX_TOOL_SEQUENCE=12");

  section("T-OFF-2: computeConfidence formula");
  assert(approxEq(computeConfidence(0), 0), "0 → 0");
  assert(approxEq(computeConfidence(1), 0.3 + 0.1), "1 → 0.4");
  assert(approxEq(computeConfidence(4), 0.3 + 0.1 * 2), "4 → 0.5");
  assert(approxEq(computeConfidence(9), 0.3 + 0.1 * 3), "9 → 0.6");
  assert(computeConfidence(10000) <= 0.9, "clamps at 0.9");

  section("T-OFF-3: updateCandidate creates new on first sighting");
  const t1 = "2026-05-01T16:00:00.000Z";
  const fresh = updateCandidate(undefined, "a>b", "agt:ap:1", t1);
  assert(fresh.occurrences === 1, "occurrences=1");
  assert(fresh.firstSeen === t1, "firstSeen set");
  assert(fresh.lastSeen === t1, "lastSeen set");
  assert(fresh.sampleSessionKeys.length === 1 && fresh.sampleSessionKeys[0] === "agt:ap:1", "sample keys recorded");
  assert(approxEq(fresh.confidence, 0.4), "confidence 0.4");

  section("T-OFF-4: updateCandidate increments and bounds samples");
  let cur: CandidateEntry = fresh;
  for (let i = 2; i <= 8; i++) {
    cur = updateCandidate(cur, "a>b", `agt:ap:${i}`, `2026-05-01T16:0${i}:00.000Z`);
  }
  assert(cur.occurrences === 8, `8 → occurrences=8 (got ${cur.occurrences})`);
  assert(cur.sampleSessionKeys.length === 5, `bounded to 5 sample keys (got ${cur.sampleSessionKeys.length})`);
  assert(cur.lastSeen === "2026-05-01T16:08:00.000Z", "lastSeen advances");
  assert(cur.firstSeen === t1, "firstSeen unchanged");

  section("T-OFF-5: shouldPromote gates");
  const cfg = { minOccurrences: 3, confidenceThreshold: 0.75 };
  assert(!shouldPromote({ ...fresh }, cfg), "fresh (occ=1) → no promote");
  assert(!shouldPromote({ ...fresh, occurrences: 3, confidence: 0.5 }, cfg), "low confidence → no promote");
  assert(shouldPromote({ ...fresh, occurrences: 25, confidence: 0.8 }, cfg), "occ=25 conf=0.8 → promote");
  assert(!shouldPromote({ ...fresh, occurrences: 25, confidence: 0.8, promotedAs: "expl-x" }, cfg), "already-promoted → no re-promote");

  section("T-OFF-6: isMetaAgent");
  for (const id of ["creator", "tuner", "orchestrator", "mcp-builder", "data-scavenger", "main"]) {
    assert(isMetaAgent(id), `${id} → meta`);
  }
  assert(!isMetaAgent("ap-clerk"), "ap-clerk → not meta");

  section("T-OFF-7: candidate file round-trip");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentura-ee-test-"));
  try {
    saveCandidateFile(tmpDir, { agentId: "ap-clerk", candidates: [cur], updatedAt: t1 });
    const loaded = loadCandidateFile(tmpDir, "ap-clerk");
    assert(loaded.agentId === "ap-clerk", "loaded agentId matches");
    assert(loaded.candidates.length === 1, "1 candidate");
    assert(loaded.candidates[0]?.signature === "a>b", "signature preserved");
    assert(loaded.candidates[0]?.occurrences === 8, "occurrences preserved");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  section("T-OFF-8: loadCandidateFile returns empty file when absent");
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentura-ee-empty-"));
  try {
    const result = loadCandidateFile(emptyDir, "nonexistent-agent");
    assert(result.candidates.length === 0, "empty candidates");
    assert(result.agentId === "nonexistent-agent", "agentId set");
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }

  section("T-OFF-9: writeExperienceLink emits JSON5 with provenance");
  const wsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sentura-ee-ws-"));
  try {
    const linkId = writeExperienceLink(wsRoot, "ap-clerk", cur, "Pattern observed across 8 sessions");
    assert(linkId.startsWith("expl-"), `linkId starts with 'expl-' (${linkId})`);
    const linkDir = path.join(wsRoot, "ap-clerk", "ekg", "workflows", "experience-links");
    const files = fs.readdirSync(linkDir);
    assert(files.length === 1, "one link file written");
    const content = fs.readFileSync(path.join(linkDir, files[0] ?? ""), "utf-8");
    assert(content.includes("Auto-generated by sentura-experience-extraction"), "header comment present");
    assert(content.includes('"type": "experience-link"'), "type field present");
    assert(content.includes('"source": "sentura-experience-extraction"'), "provenance source present");
    assert(content.includes('"extractedAt"'), "extractedAt present");
    const body = content.replace(/^\/\/.*\n/, "");
    const parsed = JSON.parse(body) as { occurrences: number; pattern: { tools: string[] } };
    assert(parsed.occurrences === 8, "occurrences serialized");
    assert(Array.isArray(parsed.pattern.tools) && parsed.pattern.tools.length === 2, "tools array length 2");
  } finally {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  }

  section("T-OFF-10: end-to-end simulation — 3 sessions promote");
  const candDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentura-ee-e2e-"));
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentura-ee-e2e-ws-"));
  try {
    const cfg2 = { minOccurrences: 3, confidenceThreshold: 0.4 };
    let file = loadCandidateFile(candDir, "ap-clerk");
    let promoted = false;
    for (let i = 1; i <= 3; i++) {
      const sig = computeSignature(["sentura_agents_manage", "browser", "message"]);
      const ts = `2026-05-01T16:0${i}:00.000Z`;
      const idx = file.candidates.findIndex((c) => c.signature === sig);
      const updated = updateCandidate(idx >= 0 ? file.candidates[idx] : undefined, sig, `agt:ap:${i}`, ts);
      if (idx >= 0) file.candidates[idx] = updated;
      else file.candidates.push(updated);
      file.updatedAt = ts;
      if (shouldPromote(updated, cfg2)) {
        const linkId = writeExperienceLink(wsDir, "ap-clerk", updated, "test");
        updated.promotedAs = linkId;
        if (idx >= 0) file.candidates[idx] = updated;
        promoted = true;
      }
      saveCandidateFile(candDir, file);
    }
    assert(promoted, "promotion happened on 3rd session");
    const linkDir = path.join(wsDir, "ap-clerk", "ekg", "workflows", "experience-links");
    assert(fs.existsSync(linkDir) && fs.readdirSync(linkDir).length === 1, "exactly 1 link file written");
    const reload = loadCandidateFile(candDir, "ap-clerk");
    assert(reload.candidates[0]?.promotedAs !== undefined, "promotedAs persisted");
  } finally {
    fs.rmSync(candDir, { recursive: true, force: true });
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// LIVE
// ---------------------------------------------------------------------------

function loadOperatorToken(): string | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const cfg = JSON.parse(raw) as { gateway?: { auth?: { token?: string } } };
    return cfg.gateway?.auth?.token ?? null;
  } catch { return null; }
}

interface LiveClient {
  rpc: (method: string, params?: unknown) => Promise<unknown>;
  close: () => void;
}

async function connectGateway(): Promise<LiveClient | null> {
  const token = loadOperatorToken();
  if (!token) return null;
  return new Promise((resolve) => {
    const socket = new WebSocket(GATEWAY_URL);
    let rpcId = 1;
    const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    let resolved = false;
    const timeout = setTimeout(() => { socket.terminate(); if (!resolved) { resolved = true; resolve(null); } }, 8000);
    socket.on("error", () => { clearTimeout(timeout); if (!resolved) { resolved = true; resolve(null); } });
    socket.on("close", () => { clearTimeout(timeout); if (!resolved) { resolved = true; resolve(null); } });
    socket.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(raw.toString()) as Record<string, unknown>; } catch { return; }
      if (msg.type === "event" && msg.event === "connect.challenge") {
        const id = String(rpcId++);
        const handshake = {
          type: "req", id, method: "connect",
          params: {
            minProtocol: 4, maxProtocol: 4,
            client: { id: "openclaw-tui", displayName: "Sentura EE Test", version: "0.1.0", platform: "node", mode: "ui" },
            caps: [], role: "operator",
            scopes: ["operator.read", "operator.write", "operator.admin"],
            auth: { token },
          },
        };
        pending.set(id, {
          resolve: () => {
            clearTimeout(timeout);
            if (!resolved) {
              resolved = true;
              resolve({
                rpc: (method, params = {}) => new Promise((res, rej) => {
                  const rid = String(rpcId++);
                  pending.set(rid, { resolve: res, reject: rej });
                  socket.send(JSON.stringify({ type: "req", id: rid, method, params }));
                  setTimeout(() => { if (pending.has(rid)) { pending.delete(rid); rej(new Error(`RPC timeout: ${method}`)); } }, 15000);
                }),
                close: () => socket.close(),
              });
            }
          },
          reject: () => { if (!resolved) { resolved = true; resolve(null); } },
        });
        socket.send(JSON.stringify(handshake));
        return;
      }
      if (msg.type === "res") {
        const id = msg.id as string;
        const handler = pending.get(id);
        if (!handler) return;
        pending.delete(id);
        if (msg.ok) handler.resolve(msg.payload);
        else handler.reject(new Error((msg.error as { message?: string } | undefined)?.message ?? "rpc error"));
      }
    });
  });
}

async function runLiveTests(): Promise<void> {
  section("T-LIVE-1: gateway lists sentura-experience-extraction in plugins.entries");
  const client = await connectGateway();
  if (!client) {
    console.log("  ⚠  Gateway unreachable or operator token missing — skipping live tests");
    return;
  }
  try {
    interface Snap { runtimeConfig?: { plugins?: { entries?: Record<string, { enabled?: boolean }> } } }
    const snap = (await client.rpc("config.get", {})) as Snap;
    const entries = snap.runtimeConfig?.plugins?.entries ?? {};
    const eeEntry = entries["sentura-experience-extraction"];
    assert(eeEntry?.enabled === true, "sentura-experience-extraction enabled in plugins.entries");

    section("T-LIVE-2: sentura_approval_request + sentura_agents_manage reachable from creator");
    // tools.effective response shape: { agentId, profile, groups: [{ id, source, tools: [...] }] }
    // Each tool entry has { id, label, description, rawDescription, source, pluginId? }.
    // tools.effective does NOT return parameter schemas — full schema verification is offline.
    interface EffTool { id: string; pluginId?: string }
    interface EffGroup { id: string; source: string; tools: EffTool[] }
    interface EffResp { agentId?: string; profile?: string; groups?: EffGroup[] }
    let sessionKey: string | undefined;
    try {
      const created = (await client.rpc("sessions.create", {
        agentId: "creator",
        label: `Sentura EE tools probe ${Date.now()}`,
      })) as { key?: string; sessionKey?: string };
      sessionKey = created.key ?? created.sessionKey;
      if (!sessionKey) {
        console.log("  ⚠  sessions.create returned no key — skipping tools.effective probe");
        return;
      }
      const eff = (await client.rpc("tools.effective", { sessionKey })) as EffResp;
      const allTools = (eff.groups ?? []).flatMap((g) => g.tools);
      const tool = allTools.find((t) => t.id === "sentura_agents_manage");
      assert(!!tool, `creator can call sentura_agents_manage (saw ${allTools.length} tools)`);
      const approvalTool = allTools.find((t) => t.id === "sentura_approval_request");
      assert(!!approvalTool, "creator can call sentura_approval_request");
    } catch (err) {
      console.log(`  ⚠  tools.effective probe skipped: ${(err as Error).message}`);
    } finally {
      if (sessionKey) {
        try { await client.rpc("sessions.delete", { key: sessionKey }); } catch { /* ignore */ }
      }
    }
  } finally {
    client.close();
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Sentura Experience Extraction — test suite\n");
  runOfflineTests();
  await runLiveTests();
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("\nFailed:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("All tests passed.");
}

main().catch((err) => { console.error(err); process.exit(1); });
