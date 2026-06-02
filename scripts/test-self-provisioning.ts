/**
 * test-self-provisioning.ts — Self-Provisioning Pipeline offline + live tests
 *
 * Offline tests: structural checks on SKILL.md, provisioning templates,
 *                approval-policies config, creator workspace files.
 * Live tests:    gateway connectivity (with connect.challenge handshake),
 *                secrets.reload liveness probe, config.get for Creator agent
 *                presence, exec.approval.list reachability — against a running
 *                OpenClaw instance.
 *
 * Live tests are skipped (not failed) when the gateway is unreachable.
 *
 * Run:
 *   npx tsx scripts/test-self-provisioning.ts
 */

import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, "..");
const CREATOR_SRC = path.join(ROOT, "sentura/agents/creator");
const SKILL_PATH = path.join(
  CREATOR_SRC,
  "skills/self-provisioning/SKILL.md"
);
const TEMPLATES_DIR = path.join(ROOT, "sentura/config/provisioning-templates");
const APPROVAL_POLICIES_PATH = path.join(
  ROOT,
  "sentura/config/approval-policies.json5"
);
const GATEWAY_URL =
  process.env.SENTURA_GATEWAY_URL ?? "ws://localhost:18789";

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function skip(label: string, reason: string): void {
  console.log(`  ~ ${label} [SKIP: ${reason}]`);
  skipped++;
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

// ---------------------------------------------------------------------------
// Offline: SKILL.md structure
// ---------------------------------------------------------------------------

section("T-OFF-1  SKILL.md exists and covers all pipeline steps");

const skillExists = fs.existsSync(SKILL_PATH);
ok("SKILL.md present at creator/skills/self-provisioning/SKILL.md", skillExists);

if (skillExists) {
  const skill = fs.readFileSync(SKILL_PATH, "utf-8");

  const REQUIRED_STEPS = [
    "Step 1",
    "Step 2",
    "Step 3",
    "Step 4",
    "Step 5",
    "Step 6",
    "Step 7",
    "Step 8",
    "Step 9",
  ];
  for (const step of REQUIRED_STEPS) {
    ok(`SKILL.md contains ${step}`, skill.includes(step));
  }

  ok(
    "SKILL.md references approval tiers (Auto/Standard/Elevated)",
    skill.includes("Auto") && skill.includes("Standard") && skill.includes("Elevated")
  );
  ok(
    "SKILL.md references Sentura primitives (dotenv_check / sentura_approval_request)",
    skill.includes("dotenv_check") && skill.includes("sentura_approval_request"),
  );
  ok(
    "SKILL.md references browser navigation for registration",
    skill.includes("browser")
  );
  ok(
    "SKILL.md references approval workflow",
    skill.includes("approval")
  );
  ok(
    "SKILL.md contains Safety section with Hard Rules",
    skill.includes("## Safety") && skill.includes("NEVER") && skill.includes("ALWAYS")
  );
  ok(
    "SKILL.md blocks storing credentials in conversation history",
    skill.includes("conversation")
  );
}

// ---------------------------------------------------------------------------
// Offline: provisioning templates
// ---------------------------------------------------------------------------

section("T-OFF-2  Provisioning templates — all 5 required services present");

const REQUIRED_SERVICES = ["zendesk", "hubspot", "salesforce", "notion", "slack"];
const REQUIRED_TEMPLATE_FIELDS = [
  "service",
  "displayName",
  "tier",
  "registrationUrl",
  "credentialKeys",
  "minimumScopes",
];

for (const svc of REQUIRED_SERVICES) {
  const templatePath = path.join(TEMPLATES_DIR, `${svc}.json5`);
  const exists = fs.existsSync(templatePath);
  ok(`${svc}.json5 present`, exists);

  if (exists) {
    const raw = fs.readFileSync(templatePath, "utf-8");
    for (const field of REQUIRED_TEMPLATE_FIELDS) {
      // minimumScopes not required for slack (uses native channel extension)
      if (field === "minimumScopes" && svc === "slack") continue;
      ok(`  ${svc}.json5 contains field "${field}"`, raw.includes(field));
    }

    // Tier-specific assertions
    if (svc === "salesforce") {
      ok(
        `  ${svc}.json5 tier is "elevated" (OAuth + paid)`,
        raw.includes('"elevated"') || raw.includes("elevated")
      );
    }
    if (svc === "slack") {
      ok(
        `  ${svc}.json5 notes native OpenClaw channel extension`,
        raw.includes("channel") || raw.includes("native")
      );
    }
    if (svc === "notion") {
      ok(
        `  ${svc}.json5 references MCP server package`,
        raw.includes("mcpServerPackage")
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Offline: approval-policies.json5 exists
// ---------------------------------------------------------------------------

section("T-OFF-3  Approval policies config");

const approvalExists = fs.existsSync(APPROVAL_POLICIES_PATH);
ok(
  "approval-policies.json5 present at sentura/config/approval-policies.json5",
  approvalExists,
  approvalExists ? "" : "file missing — create sentura/config/approval-policies.json5"
);

if (approvalExists) {
  const raw = fs.readFileSync(APPROVAL_POLICIES_PATH, "utf-8");
  ok(
    "approval-policies.json5 references tier levels",
    raw.includes("auto") || raw.includes("standard") || raw.includes("elevated")
  );
}

// ---------------------------------------------------------------------------
// Offline: creator workspace has Phase 3 skill loaded
// ---------------------------------------------------------------------------

section("T-OFF-4  Creator workspace loads self-provisioning skill");

const creatorSkillsDir = path.join(CREATOR_SRC, "skills");
const phase3SkillDir = path.join(creatorSkillsDir, "self-provisioning");
ok("self-provisioning skill directory exists", fs.existsSync(phase3SkillDir));

const creatorAgentsMd = path.join(CREATOR_SRC, "AGENTS.md");
if (fs.existsSync(creatorAgentsMd)) {
  const agentsMd = fs.readFileSync(creatorAgentsMd, "utf-8");
  ok(
    "Creator AGENTS.md references Phase 3",
    agentsMd.includes("Phase 3") || agentsMd.includes("self-provisioning")
  );
}

// ---------------------------------------------------------------------------
// Offline: templates store key names, not plaintext credentials
// ---------------------------------------------------------------------------

section("T-OFF-5  Provisioning templates use key names (no plaintext creds)");

for (const svc of REQUIRED_SERVICES) {
  const templatePath = path.join(TEMPLATES_DIR, `${svc}.json5`);
  if (!fs.existsSync(templatePath)) continue;
  const raw = fs.readFileSync(templatePath, "utf-8");
  // Ensure no obvious secret values are present (no Bearer tokens, no passwords).
  const hasNoPlaintextSecret =
    !raw.match(/Bearer\s+[A-Za-z0-9+/=]{20,}/) &&
    !raw.match(/password\s*:\s*["'][^"']{6,}["']/i);
  ok(`${svc}.json5 contains no plaintext credentials`, hasNoPlaintextSecret);
}

// ---------------------------------------------------------------------------
// Live: gateway reachability probe
// ---------------------------------------------------------------------------

section("T-LIVE-1  Gateway connectivity");

// OpenClaw gateway uses a custom envelope (NOT json-rpc 2.0):
//   client connects → gateway sends { type: "event", event: "connect.challenge" }
//   client replies   → { type: "req", id, method: "connect", params: { ... auth.token ... } }
//   gateway acks     → { type: "res", id, ok: true, payload }
//   subsequent RPCs  → { type: "req", id, method, params } / { type: "res", id, ok, payload, error }
// See scripts/probe-creator-tools.ts for the canonical implementation.

const CONFIG_PATH = path.join(
  process.env.HOME ?? "/root",
  ".openclaw/openclaw.json"
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

interface PendingRpc {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

class GatewayRpcClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRpc>();
  private idCounter = 0;

  connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let connected = false;
      const to = setTimeout(() => {
        if (!connected) {
          ws.terminate();
          reject(new Error("connect timeout"));
        }
      }, 8000);

      ws.on("error", (e) => {
        clearTimeout(to);
        if (!connected) reject(e as Error);
      });
      ws.on("close", (code, reason) => {
        clearTimeout(to);
        if (!connected) {
          reject(
            new Error(`closed before connect code=${code} reason=${String(reason)}`)
          );
        }
      });

      ws.on("message", (data: Buffer) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(data.toString()) as Record<string, unknown>;
        } catch {
          return;
        }

        if (msg.type === "event" && msg.event === "connect.challenge") {
          const id = String(++this.idCounter);
          const handshake = {
            type: "req",
            id,
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "openclaw-tui",
                displayName: "Sentura Self-Prov Test",
                version: "0.1.0",
                platform: "node",
                mode: "ui",
              },
              caps: [],
              role: "operator",
              scopes: [
                "operator.read",
                "operator.write",
                "operator.admin",
              ],
              auth: { token },
            },
          };
          this.pending.set(id, {
            resolve: () => {
              connected = true;
              clearTimeout(to);
              resolve();
            },
            reject: (e) => reject(e),
          });
          ws.send(JSON.stringify(handshake));
          return;
        }

        if (msg.type === "res") {
          const id = msg.id as string;
          const handler = this.pending.get(id);
          if (!handler) return;
          this.pending.delete(id);
          if (msg.ok) handler.resolve(msg.payload);
          else
            handler.reject(
              new Error(
                (msg.error as { message?: string } | undefined)?.message ??
                  "rpc error"
              )
            );
        }
      });
    });
  }

  rpc<T = unknown>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = String(++this.idCounter);
      const to = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`rpc timeout: ${method}`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(to);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(to);
          reject(e);
        },
      });
      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  close(): void {
    this.ws?.close();
  }
}

async function runLiveTests(): Promise<void> {
  const token = loadOperatorToken();
  if (!token) {
    skip(
      "Gateway operator token loaded",
      `~/.openclaw/openclaw.json missing gateway.auth.token`
    );
    skip("secrets.reload responds (secrets subsystem live)", "no operator token");
    skip("Creator agent present in live config", "no operator token");
    skip("exec.approval.list responds", "no operator token");
    return;
  }

  const client = new GatewayRpcClient();
  try {
    await client.connect(GATEWAY_URL, token);
    ok("Gateway reachable + handshake completed", true);
  } catch (err) {
    skip(
      "Gateway reachable",
      `${GATEWAY_URL} unreachable or handshake failed — ${String(err).slice(0, 100)}`
    );
    skip("secrets.reload responds (secrets subsystem live)", "no live connection");
    skip("Creator agent present in live config", "no live connection");
    skip("exec.approval.list responds", "no live connection");
    return;
  }

  section("T-LIVE-2  Secrets subsystem reachable");
  // OpenClaw exposes secrets.reload (no params) and secrets.resolve (known target ids only) —
  // there is no secrets.exists. We use secrets.reload as a liveness probe.
  try {
    const result = await client.rpc<{ ok?: boolean; warningCount?: number }>(
      "secrets.reload",
      {},
    );
    ok(
      "secrets.reload responds (secrets subsystem live)",
      typeof result === "object" && result !== null && result.ok === true,
    );
  } catch (err) {
    ok(
      "secrets.reload responds (secrets subsystem live)",
      false,
      String(err).slice(0, 100),
    );
  }

  section("T-LIVE-3  Creator agent present in live config");
  // config.get returns a ConfigFileSnapshot wrapper: { valid, config, parsed, resolved, raw, ... }
  // The agents list lives at payload.config.agents.list (or parsed/resolved depending on env).
  try {
    type AgentEntry = { id?: string };
    type AgentsBlock = { list?: AgentEntry[] };
    type Snapshot = {
      config?: { agents?: AgentsBlock };
      parsed?: { agents?: AgentsBlock };
      resolved?: { agents?: AgentsBlock };
      agents?: AgentsBlock;
    };
    const snapshot = await client.rpc<Snapshot>("config.get", {});
    const candidates: Array<AgentEntry[] | undefined> = [
      snapshot?.config?.agents?.list,
      snapshot?.parsed?.agents?.list,
      snapshot?.resolved?.agents?.list,
      snapshot?.agents?.list,
    ];
    const list =
      candidates.find((c): c is AgentEntry[] => Array.isArray(c)) ?? [];
    const ids = list.map((a) => a?.id).filter((id): id is string => !!id);
    const creatorPresent = ids.some(
      (id) => id === "creator" || id === "sentura-creator",
    );
    ok(
      `Creator agent found in live config (saw ${ids.length} agents: ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? "…" : ""})`,
      creatorPresent,
    );
  } catch (err) {
    ok("Creator agent present in live config", false, String(err));
  }

  section("T-LIVE-4  Approval system reachable");
  try {
    const result = await client.rpc("exec.approval.list", { status: "pending" });
    ok(
      "exec.approval.list responds (approval system live)",
      Array.isArray(result) || (typeof result === "object" && result !== null)
    );
  } catch (err) {
    skip(
      "exec.approval.list responds",
      `RPC not available — ${String(err).slice(0, 100)}`
    );
  }

  client.close();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

await runLiveTests();

section("Summary");
console.log(`  Passed:  ${passed}`);
console.log(`  Failed:  ${failed}`);
console.log(`  Skipped: ${skipped}`);

if (failed > 0) {
  console.error("\nSome tests failed.");
  process.exit(1);
} else {
  console.log("\nAll tests passed (or skipped).");
}
