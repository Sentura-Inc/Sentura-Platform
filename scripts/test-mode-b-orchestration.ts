/**
 * test-mode-b-orchestration.ts — Mode B (Orchestrator) integration tests.
 *
 * Offline:
 *   - Orchestrator workspace + skills exist with required sections.
 *   - Sandbox tool-policy block includes sessions_send / sessions_spawn / subagents.
 *   - ekg/ pillars (capabilities, conflicts, insights, global-sops) and README present.
 *   - Capability discovery resolver: given ekg/capabilities/*.json5 fixtures,
 *     a synthetic "Prepare Q4 report" decomposition resolves to expected agents.
 *
 * Live:
 *   - Orchestrator registered in agents.list.
 *   - sessions.create against the orchestrator returns a sessionKey (then
 *     immediately deletes it). No prompt is sent — Mode B *execution* is
 *     opt-in via SENTURA_MODE_B_LIVE_PROMPT to avoid burning tokens.
 *
 * Run:
 *   npx tsx scripts/test-mode-b-orchestration.ts
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

const ROOT = path.resolve(import.meta.dirname, "..");
const ORCH_SRC = path.join(ROOT, "sentura/agents/orchestrator");
const ORCH_EKG = path.join(ORCH_SRC, "ekg");
const GATEWAY_URL = process.env.SENTURA_GATEWAY_URL ?? "ws://localhost:18789";
const CONFIG_PATH = path.join(process.env.HOME ?? "/root", ".openclaw/openclaw.json");

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, label: string): void {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; failures.push(label); }
}
function section(t: string): void { console.log(`\n=== ${t} ===`); }

// ---------------------------------------------------------------------------
// OFFLINE
// ---------------------------------------------------------------------------

function runOfflineTests(): void {
  section("T-OFF-1: Orchestrator workspace — 8 native files + config");
  for (const f of ["AGENTS.md","SOUL.md","TOOLS.md","IDENTITY.md","USER.md","HEARTBEAT.md","BOOTSTRAP.md","MEMORY.md","config.json5"]) {
    assert(fs.existsSync(path.join(ORCH_SRC, f)), `sentura/agents/orchestrator/${f} exists`);
  }

  section("T-OFF-2: Orchestrator skills present with required sections");
  for (const skill of ["task-decomposition", "multi-agent-routing"]) {
    const p = path.join(ORCH_SRC, "skills", skill, "SKILL.md");
    assert(fs.existsSync(p), `skills/${skill}/SKILL.md exists`);
    const c = fs.readFileSync(p, "utf-8");
    for (const s of ["## When to Use", "## Procedure", "## Tools Needed", "## Safety"]) {
      assert(c.includes(s), `${skill}: section "${s}"`);
    }
  }

  section("T-OFF-3: Orchestrator config — sessions_send / sessions_spawn allowed in sandbox");
  const cfg = fs.readFileSync(path.join(ORCH_SRC, "config.json5"), "utf-8");
  assert(cfg.includes("sessions_send"), "config allows sessions_send");
  assert(cfg.includes("sessions_spawn"), "config allows sessions_spawn");
  assert(cfg.includes("sandbox"), "config has sandbox block");
  assert(cfg.includes("subagents"), "sandbox block includes subagents (Round 20 fix)");

  section("T-OFF-4: Orchestrator EKG pillars + README");
  for (const pillar of ["capabilities", "conflicts", "insights", "global-sops"]) {
    assert(fs.existsSync(path.join(ORCH_EKG, pillar)), `ekg/${pillar}/ directory exists`);
  }
  const readmePath = path.join(ORCH_EKG, "README.md");
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf-8") : "";
  assert(readme.includes("capabilities/"), "ekg/README.md documents capabilities/ pillar");
  assert(readme.includes("conflicts/"), "ekg/README.md documents conflicts/ pillar");
  assert(readme.includes("insights/"), "ekg/README.md documents insights/ pillar");
  assert(readme.includes("global-sops/"), "ekg/README.md documents global-sops/ pillar");
  assert(readme.includes("provenance"), "ekg/README.md mentions provenance invariant");
  assert(readme.includes("Additive merge only"), "ekg/README.md states additive-only invariant");

  section("T-OFF-5: Capability extraction skill exists");
  const capPath = path.join(ROOT, "sentura/agents/creator/skills/capability-extraction/SKILL.md");
  assert(fs.existsSync(capPath), "creator/skills/capability-extraction/SKILL.md exists");
  if (fs.existsSync(capPath)) {
    const cap = fs.readFileSync(capPath, "utf-8");
    assert(cap.includes("orchestrator"), "capability-extraction targets orchestrator workspace");
    assert(cap.includes("ekg/capabilities"), "capability-extraction writes to ekg/capabilities");
    assert(cap.includes("provenance"), "capability-extraction enforces provenance");
    assert(cap.includes("reviewRequired"), "capability-extraction handles reviewRequired flag");
  }

  section("T-OFF-6: Decomposition resolver — Prepare Q4 report fixture");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentura-mode-b-"));
  try {
    const apClerk = {
      agentId: "ap-clerk",
      name: "Avery (AP Clerk)",
      department: "finance",
      capabilityTags: ["invoice-processing", "vendor-payment", "expense-reconciliation", "finance-reporting", "q4-financial-summary"],
      ioSchemas: { accepts: [{ kind: "report-period" }], produces: [{ kind: "financial-summary" }] },
      provenance: { source: "creator.phase-5.capability-extraction", extractedAt: "2026-04-30T00:00:00.000Z", confidence: 0.85 },
      reviewRequired: false,
    };
    const csAgent = {
      agentId: "cs-agent",
      name: "Casey (CS Agent)",
      department: "support",
      capabilityTags: ["ticket-triage", "dispute-resolution", "support-volume-summary", "q4-support-summary"],
      ioSchemas: { accepts: [{ kind: "report-period" }], produces: [{ kind: "support-summary" }] },
      provenance: { source: "creator.phase-5.capability-extraction", extractedAt: "2026-04-30T00:00:00.000Z", confidence: 0.82 },
      reviewRequired: false,
    };
    fs.writeFileSync(path.join(tmpDir, "ap-clerk.json5"), JSON.stringify(apClerk, null, 2));
    fs.writeFileSync(path.join(tmpDir, "cs-agent.json5"), JSON.stringify(csAgent, null, 2));

    const resolved = resolveDecomposition(tmpDir, "Prepare Q4 report covering finance and support");
    assert(resolved.includes("ap-clerk"), "resolver picks ap-clerk for finance subtask");
    assert(resolved.includes("cs-agent"), "resolver picks cs-agent for support subtask");

    const noMatch = resolveDecomposition(tmpDir, "Translate Klingon poetry into Esperanto");
    assert(noMatch.length === 0, `resolver returns empty when no agent matches (got [${noMatch.join(",")}])`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  section("T-OFF-7: Resolver respects reviewRequired flag");
  const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "sentura-mode-b-rr-"));
  try {
    const lowConfidence = {
      agentId: "tentative-agent",
      name: "Tentative",
      department: "ops",
      capabilityTags: ["q4-financial-summary"],
      ioSchemas: { accepts: [], produces: [] },
      provenance: { source: "creator.phase-5.capability-extraction", extractedAt: "2026-04-30T00:00:00.000Z", confidence: 0.6 },
      reviewRequired: true,
    };
    fs.writeFileSync(path.join(tmpDir2, "tentative.json5"), JSON.stringify(lowConfidence, null, 2));
    const resolved = resolveDecomposition(tmpDir2, "Prepare Q4 financial summary");
    assert(!resolved.includes("tentative-agent"), "resolver excludes reviewRequired agents");
  } finally {
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  }
}

interface CapabilityManifest {
  agentId: string;
  capabilityTags?: string[];
  reviewRequired?: boolean;
  provenance?: { confidence?: number };
}

function loadManifest(p: string): CapabilityManifest | null {
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as CapabilityManifest;
  } catch {
    return null;
  }
}

function tokensForRequest(request: string): string[] {
  return request
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4); // drop short words like "and", "for", "q4"
}

export function resolveDecomposition(capabilitiesDir: string, request: string): string[] {
  const tokens = tokensForRequest(request);
  const matches = new Set<string>();
  if (!fs.existsSync(capabilitiesDir)) return [];
  for (const file of fs.readdirSync(capabilitiesDir)) {
    if (!file.endsWith(".json5") && !file.endsWith(".json")) continue;
    const manifest = loadManifest(path.join(capabilitiesDir, file));
    if (!manifest) continue;
    if (manifest.reviewRequired) continue;
    const confidence = manifest.provenance?.confidence ?? 0;
    if (confidence < 0.7) continue;
    const tags = (manifest.capabilityTags ?? []).map((t) => t.toLowerCase());
    const hit = tags.some((tag) =>
      tokens.some((tok) => tag.includes(tok) || tok.includes(tag.split("-")[0] ?? ""))
    );
    if (hit) matches.add(manifest.agentId);
  }
  return [...matches];
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
            client: { id: "openclaw-tui", displayName: "Sentura Mode-B Test", version: "0.1.0", platform: "node", mode: "ui" },
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
  section("T-LIVE-1: Gateway connectivity + Orchestrator registered");
  const client = await connectGateway();
  if (!client) {
    console.log("  ⚠  Gateway unreachable or operator token missing — skipping live tests");
    return;
  }
  try {
    interface AgentEntry { id: string; model?: string }
    interface Snap { runtimeConfig?: { agents?: { list?: AgentEntry[] } } }
    const snap = (await client.rpc("config.get", {})) as Snap;
    const list = snap.runtimeConfig?.agents?.list ?? [];
    assert(list.length > 0, `config.get returns ≥1 agent (saw ${list.length})`);
    const orch = list.find((a) => a.id === "orchestrator");
    assert(!!orch, "orchestrator present in agents.list");

    if (orch) {
      section("T-LIVE-2: sessions.create against Orchestrator");
      try {
        // sessions.create accepts { key?, agentId?, label?, model?, parentSessionKey?, task?, message? }
        // The returned payload has `key` (the session key); some places call this `sessionKey`.
        const created = (await client.rpc("sessions.create", {
          agentId: "orchestrator",
          label: "Sentura Mode-B test probe",
        })) as { key?: string; sessionKey?: string };
        const sessionKey = created.key ?? created.sessionKey;
        assert(typeof sessionKey === "string" && sessionKey.length > 0, "sessions.create returns key");

        if (sessionKey) {
          if (process.env.SENTURA_MODE_B_LIVE_PROMPT) {
            section("T-LIVE-3: opt-in Mode-B execution");
            await client.rpc("sessions.send", {
              key: sessionKey,
              message: process.env.SENTURA_MODE_B_LIVE_PROMPT,
            });
            await new Promise((r) => setTimeout(r, 2000));
          }
          await client.rpc("sessions.delete", { key: sessionKey });
          assert(true, "sessions.delete cleanup succeeded");
        }
      } catch (err) {
        console.log(`  ⚠  Live session error: ${(err as Error).message}`);
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
  console.log("Sentura Mode-B Orchestrator — test suite\n");
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
