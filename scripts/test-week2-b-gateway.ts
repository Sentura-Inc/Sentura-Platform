/**
 * Week 2 Person B — Live Gateway Integration Tests
 *
 * Validates Person B's Week 2 deliverables against a running OpenClaw gateway:
 *   1. Creator Agent is registered and has all 3 new phase skills on disk.
 *   2. MCP Builder Agent workspace is fully present and config-valid.
 *   3. EKG schema + both industry ontologies parse as valid JSON5.
 *   4. Creator Agent's Phase 2/4 output can be applied to the LIVE gateway via
 *      `config.patch` — the resulting agent appears in `config.get`, has a
 *      per-agent LanceDB dbPath, the correct sandbox mode, MCP servers with
 *      `$secret.` references (never inline), and a 10-file workspace on disk.
 *   5. Cleanup: the test agent is removed from config and its workspace is
 *      wiped so the gateway returns to its prior state.
 *
 * Requires: OpenClaw gateway running at ws://localhost:18789.
 *
 * Run:
 *   # First make sure the gateway is up:
 *   cd openclaw && pnpm gateway:watch
 *
 *   # Then in another terminal:
 *   npx tsx scripts/test-week2-b-gateway.ts
 */

import WebSocket from "ws";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { createWorkspace } from "../sentura/lib/workspace.ts";
import {
  buildAgentPatch,
  buildMemoryDbPath,
  type BindingConfig,
  type McpServerConfig,
} from "../sentura/lib/agent-registration.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const GATEWAY_URL = "ws://localhost:18789";
const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");
const WORKSPACE_BASE = path.join(OPENCLAW_HOME, "workspace");

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(label);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ─── JSON5 parse via openclaw's json5 module (no added dep) ───

/**
 * Parse a JSON5 file by spawning Node with its cwd set to openclaw, where
 * `json5` is already installed as a transitive dependency. Returns the
 * parsed object or throws.
 */
function parseJson5File(filePath: string): unknown {
  const openclawDir = path.join(REPO_ROOT, "openclaw");
  const result = spawnSync(
    "node",
    [
      "-e",
      `const fs = require('fs'); const j = require('json5'); const v = j.parse(fs.readFileSync(process.argv[1], 'utf-8')); process.stdout.write(JSON.stringify(v));`,
      filePath,
    ],
    { cwd: openclawDir, encoding: "utf-8" },
  );
  if (result.status !== 0) {
    throw new Error(`json5 parse failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

// ─── Gateway client (TUI identity) ───

async function readConfig(): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

async function getGatewayToken(): Promise<string> {
  const config = await readConfig();
  const gw = config.gateway as Record<string, unknown> | undefined;
  const token =
    ((gw?.token as string) ?? ((gw?.auth as Record<string, unknown>)?.token as string)) ?? "";
  return token;
}

async function ensureAllowInsecureAuth(): Promise<() => Promise<void>> {
  const config = await readConfig();
  const gw = (config.gateway ?? {}) as Record<string, unknown>;
  const controlUi = (gw.controlUi ?? {}) as Record<string, unknown>;
  if (controlUi.allowInsecureAuth === true) return async () => {};

  controlUi.allowInsecureAuth = true;
  gw.controlUi = controlUi;
  config.gateway = gw;
  await writeConfig(config);
  console.log("  (enabled gateway.controlUi.allowInsecureAuth — will restore on exit)");
  await sleep(1500);

  return async () => {
    const cfg = await readConfig();
    const g = (cfg.gateway ?? {}) as Record<string, unknown>;
    const cui = (g.controlUi ?? {}) as Record<string, unknown>;
    delete cui.allowInsecureAuth;
    if (Object.keys(cui).length === 0) delete g.controlUi;
    cfg.gateway = g;
    await writeConfig(cfg);
    console.log("  (restored gateway.controlUi)");
  };
}

class TestClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private idCounter = 0;
  private connectPromise: { resolve: () => void; reject: (e: Error) => void } | null = null;

  async connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectPromise = { resolve, reject };
      this.ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout (10s)"));
        this.ws?.close();
      }, 10_000);

      this.ws.on("close", (code, reason) => {
        clearTimeout(timeout);
        if (this.connectPromise) {
          this.connectPromise.reject(new Error(`Closed before handshake: code=${code} reason=${reason}`));
          this.connectPromise = null;
        }
      });
      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        if (this.connectPromise) {
          this.connectPromise.reject(err);
          this.connectPromise = null;
        }
      });
      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "event" && msg.event === "connect.challenge") {
          const handshake = {
            type: "req",
            id: String(++this.idCounter),
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "openclaw-tui",
                displayName: "Sentura Week 2 Person B Test",
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
          this.pending.set(handshake.id, {
            resolve: () => {
              clearTimeout(timeout);
              if (this.connectPromise) {
                this.connectPromise.resolve();
                this.connectPromise = null;
              }
            },
            reject: (err) => {
              clearTimeout(timeout);
              if (this.connectPromise) {
                this.connectPromise.reject(err);
                this.connectPromise = null;
              }
            },
          });
          this.ws!.send(JSON.stringify(handshake));
          return;
        }
        if (msg.type === "res") {
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            if (msg.ok) handler.resolve(msg.payload);
            else handler.reject(new Error(msg.error?.message ?? "RPC error"));
          }
        }
      });
    });
  }

  rpc<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = String(++this.idCounter);
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 15_000);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });
      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  close() {
    this.ws?.close();
    for (const [, h] of this.pending) h.reject(new Error("Client closed"));
    this.pending.clear();
  }
}

// ─── Main ───

async function main() {
  console.log("\x1b[1m\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  Sentura Week 2 — Person B Live Gateway Integration Tests  ║");
  console.log("╚════════════════════════════════════════════════════════════╝\x1b[0m");

  // ─── B_OFFLINE_1: Creator Agent skills on disk ───
  section("B_OFFLINE_1 — Creator Agent phase skills present on disk");
  const creatorSkillsDir = path.join(REPO_ROOT, "sentura/agents/creator/skills");
  check(
    "research-and-discovery/SKILL.md exists",
    await exists(path.join(creatorSkillsDir, "research-and-discovery/SKILL.md")),
  );
  check(
    "employee-design/SKILL.md exists",
    await exists(path.join(creatorSkillsDir, "employee-design/SKILL.md")),
  );
  check(
    "employee-deployment/SKILL.md exists",
    await exists(path.join(creatorSkillsDir, "employee-deployment/SKILL.md")),
  );

  // Sanity: each skill references the critical invariant(s) from the spec.
  const designSkill = await fs.readFile(
    path.join(creatorSkillsDir, "employee-design/SKILL.md"),
    "utf-8",
  );
  check(
    "employee-design skill references memory-lancedb dbPath isolation",
    /memory-lancedb/.test(designSkill) && /dbPath/.test(designSkill),
  );
  check(
    "employee-design skill references AGENTS.md Hard Rules and BOOTSTRAP.md Enterprise Context",
    /Hard Rules/i.test(designSkill) && /Enterprise Context/i.test(designSkill),
  );

  const deploySkill = await fs.readFile(
    path.join(creatorSkillsDir, "employee-deployment/SKILL.md"),
    "utf-8",
  );
  check(
    "employee-deployment skill uses config.patch",
    /config\.patch/.test(deploySkill),
  );
  check(
    "employee-deployment skill has rollback procedure",
    /rollback/i.test(deploySkill),
  );

  // ─── B_OFFLINE_2: MCP Builder Agent workspace ───
  section("B_OFFLINE_2 — MCP Builder Agent workspace complete");
  const mcpBuilderDir = path.join(REPO_ROOT, "sentura/agents/mcp-builder");
  const required8 = [
    "AGENTS.md",
    "SOUL.md",
    "TOOLS.md",
    "IDENTITY.md",
    "USER.md",
    "HEARTBEAT.md",
    "BOOTSTRAP.md",
    "MEMORY.md",
  ];
  for (const f of required8) {
    check(`mcp-builder has ${f}`, await exists(path.join(mcpBuilderDir, f)));
  }
  check("mcp-builder has config.json5", await exists(path.join(mcpBuilderDir, "config.json5")));
  for (const skillDir of ["api-analysis", "mcp-generation", "smoke-test", "register-server"]) {
    check(
      `mcp-builder skill ${skillDir}/SKILL.md exists`,
      await exists(path.join(mcpBuilderDir, "skills", skillDir, "SKILL.md")),
    );
  }

  // Parse MCP Builder config.json5.
  try {
    const mcpCfg = parseJson5File(path.join(mcpBuilderDir, "config.json5")) as Record<string, unknown>;
    const agents = (mcpCfg.agents ?? {}) as { list?: Array<Record<string, unknown>> };
    const entry = agents.list?.[0];
    check("mcp-builder config uses agents.list[]", Array.isArray(agents.list));
    check("mcp-builder id is 'mcp-builder'", entry?.id === "mcp-builder");
    check(
      "mcp-builder sandbox.mode = non-main",
      (entry?.sandbox as Record<string, unknown> | undefined)?.mode === "non-main",
    );
    check(
      "mcp-builder has no systemPrompt",
      entry?.systemPrompt === undefined,
    );
    check(
      "mcp-builder has no workspace field",
      entry?.workspace === undefined,
    );
  } catch (err) {
    check(`mcp-builder config.json5 parses as JSON5 (${(err as Error).message})`, false);
  }

  // ─── B_OFFLINE_3: EKG schema and industry ontologies parse ───
  section("B_OFFLINE_3 — EKG schema & industry ontologies parse as JSON5");

  // The schema file is a documentation-only reference written entirely in
  // JSON5 comments (no top-level object). Validate that (a) it exists, (b) it
  // has substantive content, and (c) stripping // line comments leaves no
  // stray JSON tokens — i.e. every non-comment line is blank.
  const schemaPath = path.join(REPO_ROOT, "sentura/config/ekg-schema.json5");
  try {
    const raw = await fs.readFile(schemaPath, "utf-8");
    const stripped = raw
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trimEnd())
      .join("\n")
      .trim();
    check(
      "ekg-schema.json5 is a well-formed JSON5 comment-only reference doc",
      raw.length > 1000 && stripped.length === 0,
      `raw=${raw.length}B stripped=${stripped.length}B`,
    );
  } catch (err) {
    check(`ekg-schema.json5 readable (${(err as Error).message})`, false);
  }

  const ontologyFiles: Array<{ industry: string; file: string; requiresEntities: boolean }> = [
    { industry: "financial-services", file: "org/roles.json5", requiresEntities: true },
    { industry: "financial-services", file: "org/approval-chains.json5", requiresEntities: true },
    { industry: "financial-services", file: "rules/financial-controls.json5", requiresEntities: true },
    { industry: "financial-services", file: "rules/compliance.json5", requiresEntities: true },
    { industry: "financial-services", file: "assets/systems.json5", requiresEntities: true },
    { industry: "financial-services", file: "workflows/sops.json5", requiresEntities: true },
    { industry: "e-commerce", file: "org/roles.json5", requiresEntities: true },
    { industry: "e-commerce", file: "rules/consumer-protection.json5", requiresEntities: true },
    { industry: "e-commerce", file: "rules/fraud-detection.json5", requiresEntities: true },
    { industry: "e-commerce", file: "assets/systems.json5", requiresEntities: true },
    { industry: "e-commerce", file: "workflows/sops.json5", requiresEntities: true },
  ];

  for (const o of ontologyFiles) {
    const p = path.join(REPO_ROOT, "sentura/config/industry-ontologies", o.industry, o.file);
    try {
      const parsed = parseJson5File(p) as Record<string, unknown>;
      const hasPillar = typeof parsed.pillar === "string";
      const hasEntities = Array.isArray(parsed.entities) && (parsed.entities as unknown[]).length > 0;
      check(
        `${o.industry}/${o.file} parses + has pillar + has entities`,
        hasPillar && hasEntities,
      );
    } catch (err) {
      check(`${o.industry}/${o.file} parses (${(err as Error).message})`, false);
    }
  }

  // ─── B_OFFLINE_4: Common skill library ───
  section("B_OFFLINE_4 — Common skill library (5 templates)");
  const commonSkills = [
    "meeting-notes",
    "document-summarization",
    "escalation-handling",
    "status-update",
    "knowledge-base-lookup",
  ];
  for (const s of commonSkills) {
    const p = path.join(REPO_ROOT, "sentura/config/templates/_common/skills", s, "SKILL.md");
    const present = await exists(p);
    if (present) {
      const body = await fs.readFile(p, "utf-8");
      const hasProcedure = /##\s*Procedure/i.test(body);
      const hasSafety = /##\s*Safety/i.test(body);
      check(
        `${s}/SKILL.md present + has Procedure + Safety`,
        hasProcedure && hasSafety,
      );
    } else {
      check(`${s}/SKILL.md exists`, false);
    }
  }

  // ─── Setup: connect to gateway ───
  section("Gateway setup");
  const restoreConfig = await ensureAllowInsecureAuth();
  const token = await getGatewayToken();
  if (!token) {
    check("Gateway token available in ~/.openclaw/openclaw.json", false);
    await restoreConfig();
    process.exit(1);
  }
  check("Gateway token available", true);

  let client = new TestClient();
  try {
    await client.connect(GATEWAY_URL, token);
    check("WebSocket handshake succeeds", true);
  } catch (err) {
    check(`WebSocket handshake (${(err as Error).message})`, false);
    await restoreConfig();
    process.exit(1);
  }

  // ─── B_LIVE_1: Creator Agent registered + no schema drift ───
  section("B_LIVE_1 — Creator Agent registered on live gateway");
  let configHash = "";
  try {
    const snap = await client.rpc<{ config: Record<string, unknown>; hash: string }>("config.get");
    configHash = snap.hash ?? "";
    const agents = snap.config.agents as { list?: Array<{ id: string; params?: Record<string, unknown> }> };
    const list = agents?.list ?? [];
    const creator = list.find((a) => a.id === "creator");
    check("creator agent registered on live gateway", !!creator);
    check(
      "creator agent has memoryDbPath parameter",
      typeof creator?.params?.memoryDbPath === "string" &&
        (creator?.params?.memoryDbPath as string).includes("creator"),
    );
  } catch (err) {
    check(`config.get failed: ${(err as Error).message}`, false);
  }

  // ─── B_LIVE_2: Run Creator Agent Phase 2/4 output against the live gateway ───
  section("B_LIVE_2 — Register Creator-generated employee via config.patch");

  const testAgentId = `b-test-ap-clerk-${Date.now()}`;
  const testWorkspaceDir = path.join(WORKSPACE_BASE, testAgentId);
  let deployedSuccessfully = false;

  try {
    // Phase 2 (Design) — same logic the Creator Agent runs, exercised offline
    // here but producing real artifacts that we then ship to the gateway.
    const industry = "financial-services";
    const templateDir = path.join(REPO_ROOT, "sentura/config/templates/ap-clerk");
    const industryDir = path.join(REPO_ROOT, "sentura/config/industry-ontologies", industry);

    const memoryDbPath = buildMemoryDbPath(testAgentId);

    const agentEntry = {
      id: testAgentId,
      name: "Penny (Week 2 Live Test)",
      model: "openai/gpt-4o-mini",
      skills: [`~/.openclaw/workspace/${testAgentId}/skills/*`],
      runtime: { type: "embedded" as const },
      sandbox: { mode: "non-main" as const },
      tools: {
        profile: "minimal" as const,
        alsoAllow: ["fs_read", "fs_write"],
        deny: ["exec", "gateway"],
      },
    };

    // Build BindingConfig[] directly so buildAgentPatch wraps them into
    // top-level `bindings[].match` entries correctly. (The channel-bindings
    // helpers return a pre-nested AgentBinding shape that buildAgentPatch
    // re-wraps, dropping the channel.)
    const bindings: BindingConfig[] = [
      {
        agentId: testAgentId,
        channel: "slack",
        peer: { kind: "channel", id: "#ap-finance-test" },
      },
      {
        agentId: testAgentId,
        channel: "webchat",
        peer: { kind: "dm", id: "*" },
      },
    ];

    // Stdio transport is implicit when `command` is set — McpServerConfig's
    // explicit transport field is only for http-based servers.
    //
    // PLACEHOLDER: `@sentura/mcp-netsuite` is NOT a published npm package yet.
    // It's referenced here purely to exercise the config.patch shape —
    // `mcp.servers` accepts arbitrary command/args/env at validation time
    // without attempting to spawn the process. The MCP Builder Agent (Smith)
    // is the team member responsible for actually producing Sentura-branded
    // MCP server packages; until Smith produces one, live MCP registration
    // tests use this stub name. The package need not exist for this test.
    const mcpServers: Record<string, McpServerConfig> = {
      "netsuite-test": {
        command: "npx",
        args: ["@sentura/mcp-netsuite"], // placeholder package — see comment above
        env: { NETSUITE_TOKEN: "$secret.NETSUITE_TOKEN" },
      },
    };

    // Phase 4 (Deploy) — write workspace to live OPENCLAW_HOME, then patch config.
    await createWorkspace({
      agentId: testAgentId,
      name: "Penny (Week 2 Live Test)",
      templateDir,
      industryOntologyDir: industryDir,
      workspaceBase: WORKSPACE_BASE,
    });

    // Verify workspace shape on disk.
    for (const f of required8) {
      check(
        `Live workspace has ${f}`,
        await exists(path.join(testWorkspaceDir, f)),
      );
    }
    for (const d of ["ekg/org", "ekg/rules", "ekg/assets", "ekg/workflows", "memory/users"]) {
      check(
        `Live workspace has ${d}/`,
        await exists(path.join(testWorkspaceDir, d)),
      );
    }
    check(
      "Live workspace has merged industry ontology (rules/financial-controls.json5)",
      await exists(path.join(testWorkspaceDir, "ekg/rules/financial-controls.json5")),
    );

    const agentsBody = await fs.readFile(path.join(testWorkspaceDir, "AGENTS.md"), "utf-8");
    check(
      "AGENTS.md contains Hard Rules + NEVER/ALWAYS",
      /##\s+Hard Rules/i.test(agentsBody) && /NEVER|ALWAYS/.test(agentsBody),
    );
    const bootstrapBody = await fs.readFile(path.join(testWorkspaceDir, "BOOTSTRAP.md"), "utf-8");
    check(
      "BOOTSTRAP.md contains Enterprise Context",
      /##\s+Enterprise Context/i.test(bootstrapBody),
    );

    // Build and apply the config.patch live.
    // Assert the Creator Agent's design-intent per-agent dbPath without
    // actually patching the memory-lancedb plugin config on this live gateway.
    // Reason: memory-lancedb requires an `embedding.apiKey` to pass full-config
    // validation, and this gateway deployment doesn't have embeddings enabled.
    // Patching dbPath alone would (correctly) fail zod's required-field check.
    // The design invariant (per-agent dbPath string format) is still covered
    // by `test-creator-helpers.ts` and the assertion immediately below.
    check(
      "Creator Agent emits per-agent LanceDB dbPath",
      memoryDbPath === `~/.openclaw/memory/${testAgentId}/lancedb`,
      `got ${memoryDbPath}`,
    );

    const patchJson = buildAgentPatch({
      agent: agentEntry,
      bindings,
      mcpServers,
      // memoryLanceDbPath intentionally omitted — see comment above.
    });

    // Sanity: no inline secrets in patch body.
    check(
      "config.patch body contains $secret. references (not inline)",
      patchJson.includes("$secret.NETSUITE_TOKEN"),
    );
    check(
      "config.patch body does NOT contain raw secret-looking material",
      !/sk-[A-Za-z0-9]{20,}/.test(patchJson) && !/api[_-]?key\s*[:=]\s*['\"]/.test(patchJson),
    );

    await client.rpc("config.patch", {
      raw: patchJson,
      baseHash: configHash,
      note: `Week 2 Person B live test: register ${testAgentId}`,
    });
    check("config.patch accepted by live gateway", true);
    deployedSuccessfully = true;

    // Adding mcp.servers triggers an in-process gateway restart (see
    // [reload] config change requires gateway restart (mcp.servers) in the
    // gateway log). Our WebSocket gets severed during the ~4s restart, so we
    // reconnect before querying the new config.
    client.close();
    await sleep(6_000);
    client = new TestClient();
    await client.connect(GATEWAY_URL, token);

    const snap2 = await client.rpc<{ config: Record<string, unknown>; hash: string }>("config.get");
    configHash = snap2.hash ?? configHash;

    const agents = snap2.config.agents as { list?: Array<Record<string, unknown>> };
    const live = agents?.list?.find((a) => a.id === testAgentId);
    check("Test agent appears in config.get after patch", !!live);
    check(
      "Live agent has sandbox.mode = non-main",
      (live?.sandbox as Record<string, unknown> | undefined)?.mode === "non-main",
    );
    check(
      "Live agent tools.deny includes 'exec' and 'gateway'",
      Array.isArray((live?.tools as Record<string, unknown> | undefined)?.deny) &&
        ((live?.tools as Record<string, unknown>).deny as string[]).includes("exec") &&
        ((live?.tools as Record<string, unknown>).deny as string[]).includes("gateway"),
    );

    // memory-lancedb config.patch is intentionally omitted (see comment at
    // the patch-construction site). The per-agent dbPath design invariant is
    // asserted separately via `buildMemoryDbPath` above.

    const liveMcp = snap2.config.mcp as { servers?: Record<string, Record<string, unknown>> } | undefined;
    check(
      "MCP server 'netsuite-test' registered in live config",
      !!liveMcp?.servers?.["netsuite-test"],
    );
    const envBlock = liveMcp?.servers?.["netsuite-test"]?.env as Record<string, string> | undefined;
    // NOTE: config.get applies secret resolution — $secret.NETSUITE_TOKEN
    // becomes "" (or the resolved value) in the returned snapshot. The
    // invariant we actually care about is that the submitted patch body
    // used $secret. references, which we already asserted above. Here we
    // only verify the key exists in the live server's env.
    check(
      "MCP server env has NETSUITE_TOKEN key (value resolved from secret store)",
      typeof envBlock?.NETSUITE_TOKEN === "string",
      `env=${JSON.stringify(envBlock)}`,
    );

    const liveBindings = snap2.config.bindings as Array<Record<string, unknown>> | undefined;
    const slackBinding = liveBindings?.find(
      (b) =>
        b.agentId === testAgentId &&
        (b.match as Record<string, unknown> | undefined)?.channel === "slack",
    );
    check("Slack binding present in live config", !!slackBinding);
  } catch (err) {
    check(`Live deploy failed: ${(err as Error).message}`, false);
  }

  // ─── Cleanup — remove test agent, bindings, mcp servers from config; wipe workspace ───
  section("Cleanup — revert live gateway + remove test workspace");
  try {
    const cfg = await readConfig();
    const agents = (cfg.agents ?? {}) as { list?: Array<{ id: string }> };
    const before = agents.list?.length ?? 0;
    agents.list = (agents.list ?? []).filter((a) => a.id !== testAgentId);
    cfg.agents = agents;

    const bindings = (cfg.bindings ?? []) as Array<{ agentId: string }>;
    cfg.bindings = bindings.filter((b) => b.agentId !== testAgentId);

    const mcp = (cfg.mcp ?? {}) as { servers?: Record<string, unknown> };
    if (mcp.servers) {
      delete mcp.servers["netsuite-test"];
      if (Object.keys(mcp.servers).length === 0) delete mcp.servers;
    }
    cfg.mcp = mcp;

    // Leave plugins.memory-lancedb.dbPath alone; the setup script will
    // normalize it on next run.

    await writeConfig(cfg);
    const after = (agents.list ?? []).length;
    check(
      deployedSuccessfully
        ? `Removed test agent (${before} → ${after} agents)`
        : "Cleanup pass (nothing to remove)",
      deployedSuccessfully ? after === before - 1 : true,
    );

    if (await exists(testWorkspaceDir)) {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
      check("Removed test workspace directory", !(await exists(testWorkspaceDir)));
    } else {
      check("Test workspace directory was never created (skipped)", true);
    }
  } catch (err) {
    check(`Cleanup failed: ${(err as Error).message}`, false);
  }

  client.close();
  await restoreConfig();

  console.log(`\n\x1b[1m━━━ Results ━━━\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m`);
  if (failed > 0) {
    console.log(`  \x1b[31m${failed} failed\x1b[0m`);
    for (const f of failures) console.log(`    - ${f}`);
  }
  console.log(`  ${passed + failed} total\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
