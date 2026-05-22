#!/usr/bin/env -S npx tsx
/**
 * scripts/scan-agent-security.ts
 *
 * CLI driver for the Sentura security scanner. Walks the OpenClaw runtime
 * config (`~/.openclaw/openclaw.json`) and each agent's workspace
 * `AGENTS.md`, runs `scan(...)` from `sentura/extensions/sentura-audit/src/
 * security-scanner.ts`, and prints findings.
 *
 * Exit codes:
 *   0 — no critical findings
 *   1 — at least one critical finding (blocking)
 *   2 — config not found / parse error
 *
 * Owned by Person D (Week 4).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  scan,
  summarize,
  type SecurityFinding,
} from "../sentura/extensions/sentura-audit/src/security-scanner.js";

interface CliOptions {
  configPath: string;
  workspacesDir: string;
  format: "text" | "json";
  /** Print only criticals (filter applied AFTER summarize so counts stay accurate). */
  criticalOnly: boolean;
}

/**
 * Mirror of `sentura-audit/api.ts:resolveOpenClawDir`. Inlined to avoid
 * importing through the extension's plugin entry (which has runtime side
 * effects). The precedence — `OPENCLAW_STATE_DIR` → `OPENCLAW_HOME` →
 * `$HOME/.openclaw` — must match the extensions, otherwise the scanner
 * inspects a stale config in non-default installations.
 */
function resolveOpenClawHome(env: NodeJS.ProcessEnv = process.env): string {
  const stateDir = env.OPENCLAW_STATE_DIR?.trim();
  if (stateDir) return stateDir;
  const home = env.OPENCLAW_HOME?.trim() || env.HOME?.trim() || os.homedir();
  return path.join(home, ".openclaw");
}

function parseArgs(argv: string[]): CliOptions {
  const home = resolveOpenClawHome();
  const opts: CliOptions = {
    configPath: path.join(home, "openclaw.json"),
    workspacesDir: path.join(home, "workspace"),
    format: "text",
    criticalOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config" && argv[i + 1]) opts.configPath = argv[++i];
    else if (arg === "--workspaces" && argv[i + 1]) opts.workspacesDir = argv[++i];
    else if (arg === "--json") opts.format = "json";
    else if (arg === "--critical-only") opts.criticalOnly = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`
Usage: npx tsx scripts/scan-agent-security.ts [options]

Walks ~/.openclaw/openclaw.json and ~/.openclaw/workspace/<agent-id>/AGENTS.md
for each agent and reports security findings (sandbox.mode, tool allowlists,
Hard Rules header, AGENTS.md size, raw secrets, MCP env hygiene).

Options:
  --config PATH         Path to openclaw.json (default: ~/.openclaw/openclaw.json)
  --workspaces PATH     Path to workspaces dir   (default: ~/.openclaw/workspace)
  --json                Emit findings as JSON
  --critical-only       Filter output to critical findings only
  -h, --help            Show this help

Exit codes: 0 = no criticals, 1 = blocked, 2 = config error.
`);
}

function loadConfig(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function loadWorkspaceAgentsMd(
  workspacesDir: string,
  agentIds: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of agentIds) {
    const file = path.join(workspacesDir, id, "AGENTS.md");
    try {
      out[id] = fs.readFileSync(file, "utf-8");
    } catch {
      // Workspace may not exist yet — scanner skips workspace checks for
      // that agent rather than treating absence as a finding. The bootstrap
      // pipeline materialises AGENTS.md on first deploy.
    }
  }
  return out;
}

function colorize(severity: string, text: string): string {
  if (!process.stdout.isTTY) return text;
  const codes: Record<string, string> = {
    critical: "[1;31m", // bright red
    high: "[31m", // red
    medium: "[33m", // yellow
    low: "[36m", // cyan
  };
  const code = codes[severity] ?? "";
  return code ? `${code}${text}[0m` : text;
}

function printText(findings: readonly SecurityFinding[]): void {
  if (findings.length === 0) {
    console.log("✓ No security findings.");
    return;
  }
  for (const f of findings) {
    const tag = colorize(f.severity, `[${f.severity.toUpperCase()}]`);
    const agent = f.agentId ? ` (agent=${f.agentId})` : "";
    console.log(`${tag}${agent} ${f.message}`);
    console.log(`        → ${f.remediation}`);
  }
  const sum = summarize(findings);
  console.log("");
  console.log(
    `Total: ${sum.total} (critical=${sum.bySeverity.critical}, high=${sum.bySeverity.high}, medium=${sum.bySeverity.medium}, low=${sum.bySeverity.low})`,
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  let configRaw: unknown;
  try {
    configRaw = loadConfig(opts.configPath);
  } catch (err) {
    console.error(`[scan-agent-security] Failed to load ${opts.configPath}:`, err);
    process.exit(2);
  }

  const config = configRaw as {
    agents?: { list?: { id: string }[] };
    mcp?: { servers?: Record<string, unknown> };
  };
  const agentIds = (config.agents?.list ?? []).map((a) => a.id);
  const agentsMdByAgentId = loadWorkspaceAgentsMd(opts.workspacesDir, agentIds);

  const findings = scan({
    openclawConfig: config,
    agentsMdByAgentId,
  });

  const filtered = opts.criticalOnly
    ? findings.filter((f) => f.severity === "critical")
    : findings;

  if (opts.format === "json") {
    console.log(JSON.stringify({ findings: filtered, summary: summarize(findings) }, null, 2));
  } else {
    printText(filtered);
  }

  process.exit(summarize(findings).hasBlockers ? 1 : 0);
}

main().catch((err) => {
  console.error("[scan-agent-security] fatal:", err);
  process.exit(2);
});
