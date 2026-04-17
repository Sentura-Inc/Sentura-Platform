/**
 * Week 2 Person B — Creator helper validation (NOT a true LLM E2E test).
 *
 * This script simulates the Creator Agent's Phase 1/2/4 by calling the
 * deterministic helpers (workspace.ts, agent-registration.ts,
 * channel-bindings.ts) with hard-coded brief/design objects. It validates
 * internal consistency of those helpers, workspace file generation, and the
 * shape of the config.patch payload.
 *
 * It does NOT:
 *   - invoke an LLM
 *   - load or execute `sentura/agents/creator/skills/*.md`
 *   - talk to the OpenClaw gateway
 *
 * For a real LLM-driven Creator run, see scripts/test-creator-e2e-live.ts
 * (requires SENTURA_LLM_E2E=1 and a running gateway with provider creds).
 *
 * Run: npx tsx scripts/test-creator-helpers.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { createWorkspace, listWorkspaceFiles } from "../sentura/lib/workspace.ts";
import { buildAgentPatch, buildMemoryDbPath } from "../sentura/lib/agent-registration.ts";
import { createSlackChannelBinding, createWebchatBinding } from "../sentura/lib/channel-bindings.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

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

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ─── Phase 1: Research & Discovery (simulated) ───

interface DiscoveryBrief {
  roleSlug: string;
  humanName: string;
  department: string;
  industry: string;
  model: string;
  responsibilities: string[];
  integrations: Array<{ name: string; mcp: string; secretName: string }>;
  channels: Array<{ channel: string; kind: "channel" | "dm"; id: string }>;
  escalation: { name: string; email: string; trigger: string };
  hardProhibitions: string[];
}

function phase1Discovery(): DiscoveryBrief {
  // Simulate a confirmed brief from NL input:
  //   "I need an AP clerk for our finance team at Acme Corp. They process
  //    invoices, reconcile POs, and escalate anything over $25k."
  return {
    roleSlug: "ap-clerk-finance",
    humanName: "Penny",
    department: "finance",
    industry: "financial-services",
    model: "openai/gpt-4o",
    responsibilities: [
      "invoice-processing",
      "vendor-management",
      "month-end-reconciliation",
    ],
    integrations: [
      { name: "netsuite", mcp: "netsuite", secretName: "NETSUITE_TOKEN" },
      { name: "bill.com", mcp: "billdotcom", secretName: "BILLDOTCOM_API_KEY" },
    ],
    channels: [
      { channel: "slack", kind: "channel", id: "#ap-finance" },
      { channel: "webchat", kind: "dm", id: "*" },
    ],
    escalation: {
      name: "Alex Chen",
      email: "alex.chen@acme.example",
      trigger: "Any invoice >$25,000 or duplicate vendor suspicion",
    },
    hardProhibitions: [
      "Never approve an invoice without 3-way match",
      "Never pay a vendor not in the approved vendor master",
      "Never bypass the approval chain",
    ],
  };
}

// ─── Phase 2: Design ───

interface DesignBundle {
  agentEntry: Record<string, unknown>;
  bindings: unknown[];
  mcpServers: Record<string, unknown>;
  memoryDbPath: string;
  secrets: string[];
  workspaceOptions: {
    agentId: string;
    name: string;
    templateDir: string;
    industryOntologyDir: string;
  };
}

function phase2Design(brief: DiscoveryBrief): DesignBundle {
  const agentEntry = {
    id: brief.roleSlug,
    name: brief.humanName,
    model: brief.model,
    skills: [`~/.openclaw/workspace/${brief.roleSlug}/skills/*`],
    runtime: { type: "embedded" },
    sandbox: { mode: "non-main" },
    tools: {
      profile: "minimal",
      alsoAllow: ["fs_read", "fs_write", "web_search", "web_fetch"],
      deny: ["exec", "gateway"],
    },
  };

  const bindings = brief.channels.map((ch) => {
    if (ch.channel === "slack" && ch.kind === "channel") {
      return createSlackChannelBinding(brief.roleSlug, ch.id);
    }
    return createWebchatBinding(brief.roleSlug);
  });

  const mcpServers: Record<string, unknown> = {};
  for (const integ of brief.integrations) {
    mcpServers[integ.mcp] = {
      transport: "stdio",
      command: "npx",
      args: [`@sentura/mcp-${integ.mcp}`],
      env: { [`${integ.mcp.toUpperCase()}_TOKEN`]: `$secret.${integ.secretName}` },
    };
  }

  return {
    agentEntry,
    bindings,
    mcpServers,
    memoryDbPath: buildMemoryDbPath(brief.roleSlug),
    secrets: brief.integrations.map((i) => i.secretName),
    workspaceOptions: {
      agentId: brief.roleSlug,
      name: brief.humanName,
      templateDir: path.join(REPO_ROOT, "sentura/config/templates/ap-clerk"),
      industryOntologyDir: path.join(
        REPO_ROOT,
        "sentura/config/industry-ontologies",
        brief.industry,
      ),
    },
  };
}

// ─── Phase 4: Deploy (offline) ───

async function phase4Deploy(design: DesignBundle, workspaceBase: string) {
  const result = await createWorkspace({
    ...design.workspaceOptions,
    workspaceBase,
  });

  const patch = buildAgentPatch({
    agent: design.agentEntry as any,
    bindings: design.bindings as any,
    mcpServers: design.mcpServers as any,
    memoryLanceDbPath: design.memoryDbPath,
  });

  return { workspaceResult: result, patch };
}

// ─── Validations ───

async function validate(brief: DiscoveryBrief, design: DesignBundle, deploy: Awaited<ReturnType<typeof phase4Deploy>>, workspaceBase: string) {
  section("Phase 1 — Discovery brief");
  check("Brief has roleSlug", !!brief.roleSlug);
  check("Brief has escalation target", !!brief.escalation.name && !!brief.escalation.email);
  check("Brief has >=3 hard prohibitions", brief.hardProhibitions.length >= 3);
  check("Brief has >=1 integration", brief.integrations.length >= 1);
  check("Brief has >=1 channel", brief.channels.length >= 1);

  section("Phase 2 — Design bundle shape");
  const agent = design.agentEntry as any;
  check("Agent id set", agent.id === brief.roleSlug);
  check("Agent sandbox mode = non-main", agent.sandbox?.mode === "non-main");
  check("Agent denies exec", Array.isArray(agent.tools?.deny) && agent.tools.deny.includes("exec"));
  check("Agent denies gateway", Array.isArray(agent.tools?.deny) && agent.tools.deny.includes("gateway"));
  check("Agent tool profile is minimal", agent.tools?.profile === "minimal");
  check("Agent has no systemPrompt", agent.systemPrompt === undefined);
  check("Agent has no explicit workspace field", agent.workspace === undefined);
  check("Bindings has >=1", design.bindings.length >= 1);
  check("MCP servers configured per integration", Object.keys(design.mcpServers).length === brief.integrations.length);
  check("Memory dbPath is per-agent", design.memoryDbPath === `~/.openclaw/memory/${brief.roleSlug}/lancedb`);
  check("Secrets enumerated", design.secrets.length === brief.integrations.length);

  section("Phase 4 — Workspace on disk");
  const wsDir = deploy.workspaceResult.workspaceDir;
  const required10 = [
    "AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md", "USER.md",
    "HEARTBEAT.md", "BOOTSTRAP.md", "MEMORY.md", "RULES.md", "CONTEXT.md",
  ];
  for (const f of required10) {
    check(`Workspace has ${f}`, await exists(path.join(wsDir, f)));
  }

  const ekgDirs = ["ekg/org", "ekg/rules", "ekg/assets", "ekg/workflows", "ekg/workflows/experience-links"];
  for (const d of ekgDirs) {
    check(`EKG pillar exists: ${d}`, await exists(path.join(wsDir, d)));
  }

  check("memory/users/ exists", await exists(path.join(wsDir, "memory", "users")));

  section("Phase 4 — RULES.md and CONTEXT.md content");
  const rules = await fs.readFile(path.join(wsDir, "RULES.md"), "utf-8");
  const context = await fs.readFile(path.join(wsDir, "CONTEXT.md"), "utf-8");
  check("RULES.md is non-empty", rules.trim().length > 0);
  check("RULES.md includes NEVER or ALWAYS", /NEVER|ALWAYS/.test(rules));
  check("CONTEXT.md is non-empty", context.trim().length > 0);

  section("Phase 4 — Template skills copied");
  const skills = await listWorkspaceFiles(brief.roleSlug, workspaceBase);
  const skillFiles = skills.filter((f) => f.startsWith("skills/") && f.endsWith("SKILL.md"));
  check("At least 2 skills copied from template", skillFiles.length >= 2);
  check("invoice-processing skill copied", skillFiles.some((f) => f.includes("invoice-processing")));

  section("Phase 4 — Industry ontology merged");
  const ontologyFiles = [
    "ekg/org/roles.json5",
    "ekg/rules/financial-controls.json5",
    "ekg/assets/systems.json5",
    "ekg/workflows/sops.json5",
  ];
  for (const f of ontologyFiles) {
    check(`Ontology file merged: ${f}`, await exists(path.join(wsDir, f)));
  }

  section("Phase 4 — config.patch shape");
  const patch = JSON.parse(deploy.patch);
  check("Patch uses agents.list (not entries)", Array.isArray(patch.agents?.list));
  check("Patch does NOT use agents.entries", patch.agents?.entries === undefined);
  check("Patch agent id matches", patch.agents?.list?.[0]?.id === brief.roleSlug);
  check("Patch has bindings[]", Array.isArray(patch.bindings));
  check("Patch has mcp.servers", typeof patch.mcp?.servers === "object");
  // OpenClaw's plugin config schema is `plugins.entries.<id>.config.<key>`.
  // The older flat shape (`plugins.<id>.<key>`) was never correct — it happened
  // to round-trip through loose merge semantics but is not what OpenClaw's
  // loader reads. buildAgentPatch emits the nested form; the assertion must too.
  check(
    "Patch has plugins.entries['memory-lancedb'].config.dbPath",
    typeof patch.plugins?.entries?.["memory-lancedb"]?.config?.dbPath === "string",
  );
  check(
    "Memory dbPath is per-agent (design intent; see lib/agent-registration.ts note)",
    patch.plugins?.entries?.["memory-lancedb"]?.config?.dbPath ===
      `~/.openclaw/memory/${brief.roleSlug}/lancedb`,
  );
  check(
    "Secrets use $secret. references (no inline)",
    JSON.stringify(patch.mcp?.servers).includes("$secret.") &&
      !/sk-[A-Za-z0-9]{10,}/.test(JSON.stringify(patch)),
  );
}

// ─── Run ───

async function main() {
  console.log("\x1b[1m\n╔════════════════════════════════════════════╗");
  console.log("║  Week 2 Person B — Creator Agent E2E Test  ║");
  console.log("╚════════════════════════════════════════════╝\x1b[0m");

  const workspaceBase = path.join(os.tmpdir(), `sentura-creator-e2e-${Date.now()}`);

  try {
    const brief = phase1Discovery();
    const design = phase2Design(brief);
    const deploy = await phase4Deploy(design, workspaceBase);

    await validate(brief, design, deploy, workspaceBase);

    console.log(`\n\x1b[1m━━━ Results ━━━\x1b[0m`);
    console.log(`  \x1b[32m${passed} passed\x1b[0m`);
    if (failed > 0) {
      console.log(`  \x1b[31m${failed} failed\x1b[0m`);
      for (const f of failures) console.log(`    - ${f}`);
    }
    console.log(`  ${passed + failed} total\n`);
  } finally {
    await fs.rm(workspaceBase, { recursive: true, force: true });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
