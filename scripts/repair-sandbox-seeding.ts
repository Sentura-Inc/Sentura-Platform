/**
 * Sentura — Sandbox Seeding Repair Script
 * =======================================
 *
 * Fixes pre-existing installations that booted under the old OpenClaw
 * sandbox seeding behaviour (empty `skills/`, 700-byte `BOOTSTRAP.md` stub,
 * and a broken glob-path `agents.list[].skills` filter in `openclaw.json`).
 *
 * Run:
 *   npx tsx scripts/repair-sandbox-seeding.ts
 *
 * What it does (idempotent):
 *   1. Scrubs any `skills:` field that looks like a path glob (e.g.
 *      "~/.openclaw/workspace/creator/skills/*") from every agent in
 *      `~/.openclaw/openclaw.json`. This was being interpreted as a skill
 *      *name filter*, not a path, so it silenced every skill.
 *   2. Enables the `sentura-bootstrap` and `sentura-sandbox-seed` internal
 *      hooks in `~/.openclaw/openclaw.json`.
 *   3. Deletes every stale sandbox directory for Sentura meta-agents under
 *      `~/.openclaw/sandboxes/agent-{creator|tuner|orchestrator}-*`. The
 *      next `agent:bootstrap` will recreate them from scratch and the
 *      `sentura-sandbox-seed` hook will mirror skills/, memory/, ekg/, and
 *      the custom BOOTSTRAP.md from the host workspace.
 *
 * The script never touches the host workspace (`~/.openclaw/workspace/*`).
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? path.join(HOME, ".openclaw");
const LIVE_CONFIG = path.join(OPENCLAW_HOME, "openclaw.json");
const SANDBOXES_ROOT = path.join(OPENCLAW_HOME, "sandboxes");

const META_AGENTS = ["creator", "tuner", "orchestrator"] as const;
const SENTURA_HOOKS = ["sentura-bootstrap", "sentura-sandbox-seed"] as const;

// Tools the Creator (Forge) needs in order to materialize a new employee's
// workspace. `sentura_agents_manage` writes skills/, ekg/, memory/users/
// subfiles on the host (bypassing the read-only sandbox path and the
// 8-file limit of gateway.agents.files.set). `sentura_rbac_manage` and
// `sentura_audit_query` are used by the compliance/deployment skills.
const CREATOR_REQUIRED_TOOLS = [
  "gateway",
  "sessions_send",
  "sessions_spawn",
  "web_search",
  "web_fetch",
  "browser",
  "pdf",
  "canvas",
  "sentura_agents_manage",
  "sentura_rbac_manage",
  "sentura_audit_query",
] as const;

const reset = "\x1b[0m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const bold = "\x1b[1m";

function log(msg: string): void {
  console.log(`  ${msg}`);
}

function ok(msg: string): void {
  console.log(`  ${green}✓${reset} ${msg}`);
}

function warn(msg: string): void {
  console.log(`  ${yellow}![${reset} ${msg}`);
}

function fail(msg: string): void {
  console.error(`  ${red}✗${reset} ${msg}`);
}

function section(title: string): void {
  console.log(`\n${bold}━━━ ${title} ━━━${reset}`);
}

type AgentEntry = {
  id?: string;
  skills?: unknown;
  tools?: {
    profile?: string;
    alsoAllow?: string[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

type LiveConfig = {
  agents?: { list?: AgentEntry[] };
  hooks?: {
    internal?: {
      enabled?: boolean;
      entries?: Record<string, { enabled?: boolean }>;
    };
  };
  [k: string]: unknown;
};

function looksLikePathGlob(value: unknown): boolean {
  return typeof value === "string" && value.includes("/");
}

async function scrubGlobSkillsFilter(cfg: LiveConfig): Promise<number> {
  let changed = 0;
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) return 0;
  for (const agent of list) {
    if (!Array.isArray(agent.skills)) continue;
    if (!agent.skills.some((s) => looksLikePathGlob(s))) continue;
    delete agent.skills;
    changed += 1;
    ok(`cleared glob-style skills filter on agent "${agent.id}"`);
  }
  return changed;
}

function ensureCreatorTools(cfg: LiveConfig): number {
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) return 0;
  const creator = list.find((a) => a.id === "creator");
  if (!creator) {
    warn(`no "creator" agent entry found in config; skipping alsoAllow patch`);
    return 0;
  }
  creator.tools ??= { profile: "coding", alsoAllow: [] };
  creator.tools.profile ??= "coding";
  const current = Array.isArray(creator.tools.alsoAllow) ? creator.tools.alsoAllow : [];
  const next = Array.from(new Set([...current, ...CREATOR_REQUIRED_TOOLS]));
  const added = next.filter((t) => !current.includes(t));
  if (added.length === 0) {
    log("creator.tools.alsoAllow already includes all required tools");
    return 0;
  }
  creator.tools.alsoAllow = next;
  for (const tool of added) {
    ok(`added "${tool}" to creator.tools.alsoAllow`);
  }
  return added.length;
}

function enableSenturaHooks(cfg: LiveConfig): number {
  cfg.hooks ??= {};
  cfg.hooks.internal ??= {};
  cfg.hooks.internal.enabled = true;
  cfg.hooks.internal.entries ??= {};
  let changed = 0;
  for (const name of SENTURA_HOOKS) {
    const existing = cfg.hooks.internal.entries[name];
    if (!existing || existing.enabled !== true) {
      cfg.hooks.internal.entries[name] = { ...(existing ?? {}), enabled: true };
      changed += 1;
      ok(`enabled hook "${name}"`);
    } else {
      log(`hook "${name}" already enabled`);
    }
  }
  return changed;
}

async function clearStaleSandboxes(): Promise<number> {
  let cleared = 0;
  const root = SANDBOXES_ROOT;
  try {
    const stat = await fsp.stat(root);
    if (!stat.isDirectory()) return 0;
  } catch {
    log(`sandbox root does not exist yet (${root}); nothing to clear`);
    return 0;
  }

  const entries = await fsp.readdir(root);
  for (const name of entries) {
    const matched = META_AGENTS.find((agent) => name.startsWith(`agent-${agent}-`));
    if (!matched) continue;
    const full = path.join(root, name);
    await fsp.rm(full, { recursive: true, force: true });
    cleared += 1;
    ok(`cleared stale sandbox ${full}`);
  }
  return cleared;
}

async function main(): Promise<void> {
  console.log(`${bold}\n╔════════════════════════════════════════╗`);
  console.log(`║  Sentura sandbox-seeding repair        ║`);
  console.log(`╚════════════════════════════════════════╝${reset}\n`);

  section("1. Live OpenClaw config");
  if (!fs.existsSync(LIVE_CONFIG)) {
    fail(`No config at ${LIVE_CONFIG}. Run \`cd openclaw && pnpm openclaw onboard\` first.`);
    process.exit(1);
  }
  log(`config: ${LIVE_CONFIG}`);
  const raw = await fsp.readFile(LIVE_CONFIG, "utf-8");
  const cfg = JSON.parse(raw) as LiveConfig;

  const scrubbed = await scrubGlobSkillsFilter(cfg);
  const enabled = enableSenturaHooks(cfg);
  const toolsPatched = ensureCreatorTools(cfg);
  if (scrubbed > 0 || enabled > 0 || toolsPatched > 0) {
    await fsp.writeFile(LIVE_CONFIG, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");
    ok(
      `wrote updated config (${scrubbed} scrubs, ${enabled} hook-enables, ${toolsPatched} creator-tool adds)`,
    );
  } else {
    log("config already healthy — no changes needed");
  }

  section("2. Stale sandbox directories");
  const cleared = await clearStaleSandboxes();
  if (cleared === 0) {
    log("no stale sandboxes to clear");
  }

  section("3. Verification hints");
  log("Restart the gateway (cd openclaw && pnpm gateway:watch).");
  log("Send one message to the Creator agent from the dashboard.");
  log("Then run:");
  log("    ls ~/.openclaw/sandboxes/agent-creator-*/skills");
  log("You should see 7 skill directories (agent-config-schema, ...)");
  log("    wc -c ~/.openclaw/sandboxes/agent-creator-*/BOOTSTRAP.md");
  log("Size should be >1.5 KB (the custom host BOOTSTRAP.md, not the 700B stub)");
  console.log();

  if (scrubbed > 0) {
    warn(
      "A glob-style `skills:` filter was cleared. Older versions of scripts/sentura-setup.sh installed this broken filter. Your repo now uses the fixed version — re-running setup is safe.",
    );
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
