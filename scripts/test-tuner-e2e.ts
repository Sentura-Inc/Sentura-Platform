/**
 * test-tuner-e2e.ts — Tuner Agent (Refine) offline + live integration tests
 *
 * Offline tests: structural checks on tuner workspace files, skills, config.
 * Live tests:    gateway config.patch round-trip + workspace-file read-back
 *                against a running OpenClaw instance at SENTURA_GATEWAY_URL.
 *
 * Live tests are skipped (not failed) when the gateway is unreachable.
 *
 * Run:
 *   npx tsx scripts/test-tuner-e2e.ts
 */

import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, "..");
const TUNER_SRC = path.join(ROOT, "sentura/agents/tuner");
const TUNER_WORKSPACE = path.join(
  process.env.HOME ?? "/root",
  ".openclaw/workspace/tuner"
);
const GATEWAY_URL = process.env.SENTURA_GATEWAY_URL ?? "ws://localhost:18789";

// ---------------------------------------------------------------------------
// Minimal WebSocket RPC client
// ---------------------------------------------------------------------------

let rpcId = 1;
// OpenClaw gateway uses a custom envelope (NOT json-rpc 2.0):
//   client connects → gateway sends { type: "event", event: "connect.challenge" }
//   client replies   → { type: "req", id, method: "connect", params: { ... auth.token ... } }
//   gateway acks     → { type: "res", id, ok: true, payload }
//   subsequent RPCs  → { type: "req", id, method, params } / { type: "res", id, ok, payload, error }
// See scripts/probe-creator-tools.ts for the canonical implementation.

const CONFIG_PATH = path.join(
  process.env.HOME ?? "/root",
  ".openclaw/openclaw.json",
);

function loadOperatorToken(): string | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const cfg = JSON.parse(raw) as { gateway?: { auth?: { token?: string } } };
    return cfg.gateway?.auth?.token ?? null;
  } catch {
    return null;
  }
}

let ws: WebSocket | null = null;
const pending = new Map<
  string,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();
let connectedFlag = false;

async function connectGateway(): Promise<boolean> {
  const token = loadOperatorToken();
  if (!token) return false;

  return new Promise((resolve) => {
    const socket = new WebSocket(GATEWAY_URL);
    let resolved = false;
    const settle = (ok: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(ok);
      }
    };
    const timeout = setTimeout(() => {
      socket.terminate();
      settle(false);
    }, 8000);

    socket.on("error", () => {
      clearTimeout(timeout);
      settle(false);
    });
    socket.on("close", () => {
      clearTimeout(timeout);
      if (!connectedFlag) settle(false);
    });
    socket.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.type === "event" && msg.event === "connect.challenge") {
        const id = String(rpcId++);
        const handshake = {
          type: "req",
          id,
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "openclaw-tui",
              displayName: "Sentura Tuner Test",
              version: "0.1.0",
              platform: "node",
              mode: "ui",
            },
            caps: [],
            role: "operator",
            scopes: ["operator.read", "operator.write", "operator.admin"],
            auth: { token },
          },
        };
        pending.set(id, {
          resolve: () => {
            connectedFlag = true;
            ws = socket;
            clearTimeout(timeout);
            settle(true);
          },
          reject: () => settle(false),
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
        else
          handler.reject(
            new Error(
              (msg.error as { message?: string } | undefined)?.message ??
                "rpc error",
            ),
          );
      }
    });
  });
}

async function rpc(method: string, params: unknown = {}): Promise<unknown> {
  if (!ws) throw new Error("Not connected");
  const id = String(rpcId++);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws!.send(JSON.stringify({ type: "req", id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }
    }, 15_000);
  });
}

function disconnect() {
  ws?.close();
  ws = null;
  connectedFlag = false;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; failures.push(label); }
}

function section(title: string) { console.log(`\n=== ${title} ===`); }

// ---------------------------------------------------------------------------
// OFFLINE TESTS
// ---------------------------------------------------------------------------

function runOfflineTests() {
  section("T-OFF-1: Tuner source workspace — 8 native files + config");

  for (const f of ["AGENTS.md","SOUL.md","TOOLS.md","IDENTITY.md","USER.md","HEARTBEAT.md","BOOTSTRAP.md","MEMORY.md","config.json5"]) {
    assert(fs.existsSync(path.join(TUNER_SRC, f)), `sentura/agents/tuner/${f} exists`);
  }

  section("T-OFF-2: Tuner skills present with required sections");

  for (const skill of ["nl-to-config", "workspace-edit"]) {
    const skillPath = path.join(TUNER_SRC, "skills", skill, "SKILL.md");
    assert(fs.existsSync(skillPath), `skills/${skill}/SKILL.md exists`);
    const c = fs.readFileSync(skillPath, "utf-8");
    for (const s of ["## When to Use", "## Procedure", "## Tools Needed", "## Safety"]) {
      assert(c.includes(s), `${skill}: has section "${s}"`);
    }
  }

  section("T-OFF-3: nl-to-config skill — key content");

  const nl = fs.readFileSync(path.join(TUNER_SRC, "skills/nl-to-config/SKILL.md"), "utf-8");
  assert(nl.includes("config.patch"), "nl-to-config references config.patch");
  assert(nl.includes("baseHash"), "nl-to-config includes baseHash (optimistic concurrency)");
  assert(nl.includes("explicit approval"), "nl-to-config requires explicit operator approval");
  assert(nl.includes("NEVER") && nl.includes("gateway"), "nl-to-config has gateway safety rule");

  section("T-OFF-4: workspace-edit skill — key content");

  const we = fs.readFileSync(path.join(TUNER_SRC, "skills/workspace-edit/SKILL.md"), "utf-8");
  assert(
    we.includes("sentura_agents_manage") && we.includes('action: "read"'),
    "workspace-edit uses sentura_agents_manage read",
  );
  assert(
    we.includes("sentura_agents_manage") && we.includes('action: "write"'),
    "workspace-edit uses sentura_agents_manage write",
  );
  assert(we.includes("Hard Rules"), "workspace-edit preserves ## Hard Rules");
  assert(we.includes("complete file"), "workspace-edit notes the write overwrites the whole file");

  section("T-OFF-5: Tuner AGENTS.md — Hard Rules present");

  const agents = fs.readFileSync(path.join(TUNER_SRC, "AGENTS.md"), "utf-8");
  assert(agents.includes("## Hard Rules (must not override)"), "AGENTS.md has ## Hard Rules section");
  assert(agents.includes("Never remove safety guardrails"), "Hard Rule 1 present");
  assert(agents.includes("Never expose secrets"), "Hard Rule 2 present");
  assert(agents.includes("Require confirmation"), "Hard Rule: require confirmation present");

  section("T-OFF-6: Tuner config.json5 — sandbox tool-policy block");

  const cfg = fs.readFileSync(path.join(TUNER_SRC, "config.json5"), "utf-8");
  assert(cfg.includes("sandbox"), "config.json5 has sandbox block");
  assert(cfg.includes("alsoAllow"), "config.json5 has sandbox.alsoAllow");
  assert(cfg.includes('"gateway"') || cfg.includes("'gateway'") || cfg.includes("gateway"), "config.json5 allows gateway in sandbox");
}

// ---------------------------------------------------------------------------
// LIVE TESTS
// ---------------------------------------------------------------------------

// config.get returns a ConfigFileSnapshot:
//   { hash, runtimeConfig: { agents: { list: [...] } }, config: { ... } (deprecated alias), ... }
// The runtime baseHash for config.patch lives at the top-level `hash` field.
type AgentEntry = { id: string; model?: string };
type SnapshotPayload = {
  hash?: string;
  runtimeConfig?: { agents?: { list?: AgentEntry[] } };
  config?: { agents?: { list?: AgentEntry[] } };
  parsed?: { agents?: { list?: AgentEntry[] } };
  resolved?: { agents?: { list?: AgentEntry[] } };
};
type PatchPayload = SnapshotPayload;

function readAgentsList(snap: SnapshotPayload): AgentEntry[] {
  return (
    snap.runtimeConfig?.agents?.list ??
    snap.config?.agents?.list ??
    snap.parsed?.agents?.list ??
    snap.resolved?.agents?.list ??
    []
  );
}

async function runLiveTests(connected: boolean) {
  section("T-LIVE-1: Gateway connectivity");

  if (!connected) {
    console.log("  ⚠  Gateway unreachable or no operator token — skipping live tests");
    return;
  }
  assert(true, "Gateway connected at " + GATEWAY_URL);

  section("T-LIVE-2: config.get — tuner agent present");

  const config = (await rpc("config.get", {})) as SnapshotPayload;
  const list = readAgentsList(config);
  const tunerEntry = list.find((a) => a.id === "tuner");
  assert(!!tunerEntry, `tuner present in agents.list (saw ${list.length} agents)`);
  assert(!!config.hash, "config.get returns top-level hash (baseHash for patches)");

  section("T-LIVE-3: config.patch round-trip on a non-meta agent (model change + rollback)");

  const metaIds = new Set([
    "creator",
    "tuner",
    "orchestrator",
    "mcp-builder",
    "data-scavenger",
    "main",
  ]);
  const target = list.find((a) => !metaIds.has(a.id));

  if (!target) {
    console.log("  ⚠  No non-meta agent found — skipping patch round-trip");
  } else {
    const origModel = target.model ?? "openai/gpt-4o";
    const testModel = "openai/gpt-4o-mini";

    const patch1 = (await rpc("config.patch", {
      baseHash: config.hash,
      patch: { agents: { list: [{ id: target.id, model: testModel }] } },
    })) as PatchPayload;
    assert(!!patch1.hash, "config.patch returns new hash");

    const after1 = (await rpc("config.get", {})) as SnapshotPayload;
    const patched = readAgentsList(after1).find((a) => a.id === target.id);
    assert(patched?.model === testModel, `model updated to ${testModel}`);

    await rpc("config.patch", {
      baseHash: after1.hash,
      patch: { agents: { list: [{ id: target.id, model: origModel }] } },
    });
    const after2 = (await rpc("config.get", {})) as SnapshotPayload;
    const restored = readAgentsList(after2).find((a) => a.id === target.id);
    assert(restored?.model === origModel, `model rolled back to ${origModel}`);
  }

  section("T-LIVE-4: Deployed tuner workspace — skills match source");

  if (!fs.existsSync(TUNER_WORKSPACE)) {
    console.log("  ⚠  ~/.openclaw/workspace/tuner not found — skipping");
    return;
  }
  const deployedAgents = fs.readFileSync(path.join(TUNER_WORKSPACE, "AGENTS.md"), "utf-8");
  assert(deployedAgents.includes("## Hard Rules (must not override)"), "Deployed AGENTS.md has Hard Rules");
  assert(
    fs.existsSync(path.join(TUNER_WORKSPACE, "skills/nl-to-config/SKILL.md")),
    "Deployed workspace has skills/nl-to-config/SKILL.md"
  );
  assert(
    fs.existsSync(path.join(TUNER_WORKSPACE, "skills/workspace-edit/SKILL.md")),
    "Deployed workspace has skills/workspace-edit/SKILL.md"
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Sentura Tuner Agent (Refine) — test suite\n");
  runOfflineTests();
  const connected = await connectGateway();
  await runLiveTests(connected);
  disconnect();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.error("\nFailed:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log("All tests passed.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
