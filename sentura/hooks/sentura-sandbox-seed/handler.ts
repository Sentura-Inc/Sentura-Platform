/**
 * Sentura Sandbox Seed Hook
 *
 * See HOOK.md for the full rationale. Short version: OpenClaw's native
 * `ensureSandboxWorkspace` only copies 7 bootstrap files on first sandbox
 * creation and never re-syncs afterward, and it completely ignores
 * subdirectories (skills/, memory/, ekg/) and loose config files
 * (config.json5, MEMORY.md).
 *
 * This hook runs on `agent:bootstrap` and performs a targeted host→sandbox
 * reconciliation so Sentura meta-agents (Creator / Tuner / Orchestrator) and
 * any self-provisioned employees boot with their full workspace.
 *
 * Design constraints:
 *   - No mutations to OpenClaw core (rule #7).
 *   - Bootstrap must never be blocked by a filesystem error — the hook
 *     catches everything and just logs.
 *   - Never follow symlinks or hardlinks, never copy `.git`/`.openclaw`/
 *     `node_modules`, never write outside the sandbox root.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type HookEvent = {
  type: string;
  action: string;
  context: Record<string, unknown>;
};

type HookHandler = (event: HookEvent) => Promise<void> | void;

type BootstrapFile = {
  name: string;
  path: string;
  content: string;
  missing: boolean;
};

type BootstrapContext = {
  workspaceDir: string;
  bootstrapFiles: BootstrapFile[];
  sessionKey?: string;
  agentId?: string;
};

const HOME = os.homedir();

// These are resolved PER CALL rather than captured at module-load, so that
// tests (and runtime reconfiguration) can override `OPENCLAW_HOME` without
// re-importing the module.
function openclawHome(): string {
  return process.env.OPENCLAW_HOME ?? path.join(HOME, ".openclaw");
}
function sandboxesRoot(): string {
  return path.join(openclawHome(), "sandboxes");
}
function workspacesRoot(): string {
  return path.join(openclawHome(), "workspace");
}
function liveConfigPath(): string {
  return path.join(openclawHome(), "openclaw.json");
}

const CUSTOM_BOOTSTRAP_MIN_BYTES = 1500;
const EXCLUDED_NAMES = new Set([".git", ".openclaw", "node_modules", ".DS_Store"]);
const UNION_SUBDIRS = ["memory", "ekg"] as const;
const UNION_FILES = ["config.json5", "MEMORY.md"] as const;

function isBootstrapEvent(event: HookEvent): event is HookEvent & { context: BootstrapContext } {
  if (event.type !== "agent" || event.action !== "bootstrap") return false;
  const ctx = event.context as Partial<BootstrapContext>;
  return typeof ctx.workspaceDir === "string" && Array.isArray(ctx.bootstrapFiles);
}

function debug(message: string, extra?: Record<string, unknown>): void {
  if (!process.env.SENTURA_SANDBOX_SEED_DEBUG) return;
  if (extra) {
    console.log(`[sentura-sandbox-seed] ${message}`, extra);
  } else {
    console.log(`[sentura-sandbox-seed] ${message}`);
  }
}

function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isSandboxPath(workspaceDir: string): boolean {
  const resolved = path.resolve(workspaceDir);
  const root = sandboxesRoot();
  return (
    resolved === root ||
    isPathInside(root, resolved) ||
    resolved.includes(`${path.sep}sandboxes${path.sep}`)
  );
}

function extractAgentIdFromSandboxPath(workspaceDir: string): string | null {
  const base = path.basename(path.resolve(workspaceDir));
  const match = base.match(/^agent-([^-]+(?:-[^-]+)*?)-[0-9a-f]+$/);
  return match ? match[1] : null;
}

function readHostWorkspaceFromLiveConfig(agentId: string): string | null {
  try {
    const raw = fs.readFileSync(liveConfigPath(), "utf-8");
    const cfg = JSON.parse(raw) as {
      agents?: { list?: Array<{ id?: string; workspace?: string }> };
    };
    const entry = cfg.agents?.list?.find((a) => a.id === agentId);
    const ws = entry?.workspace;
    if (typeof ws === "string" && ws.length > 0) {
      return ws.startsWith("~/") ? path.join(HOME, ws.slice(2)) : ws;
    }
  } catch {
    // ignore — the live config may not exist or may be mid-write
  }
  return null;
}

function resolveHostWorkspace(agentId: string | undefined): string | null {
  if (!agentId) return null;
  const fromConfig = readHostWorkspaceFromLiveConfig(agentId);
  if (fromConfig && fs.existsSync(fromConfig)) return fromConfig;
  const conventional = path.join(workspacesRoot(), agentId);
  if (fs.existsSync(conventional)) return conventional;
  return null;
}

async function safeStat(p: string): Promise<fs.Stats | null> {
  try {
    return await fsp.lstat(p);
  } catch {
    return null;
  }
}

async function isSafeEntry(srcDir: string, entryPath: string): Promise<boolean> {
  const stat = await safeStat(entryPath);
  if (!stat) return false;
  if (stat.isSymbolicLink()) return false;
  if (stat.nlink > 1 && stat.isFile()) return false;
  let real: string;
  try {
    real = await fsp.realpath(entryPath);
  } catch {
    return false;
  }
  let srcReal: string;
  try {
    srcReal = await fsp.realpath(srcDir);
  } catch {
    return false;
  }
  return real === srcReal || isPathInside(srcReal, real);
}

/**
 * Recursively copy `src` into `dst` with optional union-merge semantics.
 * - `overwrite: true`   → files in dst are replaced (used for skills/).
 * - `overwrite: false`  → files already present in dst are preserved (used
 *   for memory/ and ekg/ so the agent's runtime state survives reboots).
 * Skips symlinks, hardlinks, and excluded names.
 */
async function copyTree(
  src: string,
  dst: string,
  opts: { overwrite: boolean },
): Promise<{ copied: number; skipped: number }> {
  let copied = 0;
  let skipped = 0;
  const srcStat = await safeStat(src);
  if (!srcStat || !srcStat.isDirectory()) return { copied: 0, skipped: 0 };

  await fsp.mkdir(dst, { recursive: true });

  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_NAMES.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (!(await isSafeEntry(src, srcPath))) {
      skipped += 1;
      continue;
    }

    if (entry.isDirectory()) {
      const sub = await copyTree(srcPath, dstPath, opts);
      copied += sub.copied;
      skipped += sub.skipped;
      continue;
    }

    if (entry.isFile()) {
      if (!opts.overwrite) {
        try {
          await fsp.access(dstPath);
          skipped += 1;
          continue;
        } catch {
          // dst missing → fall through and copy
        }
      }
      try {
        await fsp.copyFile(srcPath, dstPath);
        copied += 1;
      } catch {
        skipped += 1;
      }
    }
  }
  return { copied, skipped };
}

async function replaceTree(src: string, dst: string): Promise<{ copied: number; skipped: number }> {
  await fsp.rm(dst, { recursive: true, force: true });
  return copyTree(src, dst, { overwrite: true });
}

async function seedBootstrapMd(hostDir: string, sandboxDir: string): Promise<boolean> {
  const hostFile = path.join(hostDir, "BOOTSTRAP.md");
  const sandboxFile = path.join(sandboxDir, "BOOTSTRAP.md");
  const hostStat = await safeStat(hostFile);
  if (!hostStat || !hostStat.isFile()) return false;
  const sandboxStat = await safeStat(sandboxFile);
  const hostBytes = hostStat.size;
  const sandboxBytes = sandboxStat?.isFile() ? sandboxStat.size : 0;
  // Only replace the sandbox copy if the host copy looks like a genuine
  // Sentura-customized BOOTSTRAP.md AND is larger than what's already there.
  // (OpenClaw's default stub is ~700 bytes; anything > 1500 bytes is custom.)
  if (hostBytes < CUSTOM_BOOTSTRAP_MIN_BYTES) return false;
  if (hostBytes <= sandboxBytes) return false;
  try {
    await fsp.copyFile(hostFile, sandboxFile);
    return true;
  } catch {
    return false;
  }
}

async function seedUnionFile(hostDir: string, sandboxDir: string, name: string): Promise<boolean> {
  const hostFile = path.join(hostDir, name);
  const sandboxFile = path.join(sandboxDir, name);
  const hostStat = await safeStat(hostFile);
  if (!hostStat || !hostStat.isFile()) return false;
  const sandboxStat = await safeStat(sandboxFile);
  if (sandboxStat && sandboxStat.isFile()) return false;
  try {
    await fsp.copyFile(hostFile, sandboxFile);
    return true;
  } catch {
    return false;
  }
}

async function seedSandbox(hostDir: string, sandboxDir: string): Promise<void> {
  // 1. skills/ — authoritative source is host; mirror fully each boot so the
  //    agent sees the latest SKILL.md edits.
  const hostSkills = path.join(hostDir, "skills");
  if ((await safeStat(hostSkills))?.isDirectory()) {
    const sandboxSkills = path.join(sandboxDir, "skills");
    const result = await replaceTree(hostSkills, sandboxSkills);
    debug("skills mirrored", { copied: result.copied, skipped: result.skipped });
  }

  // 2. memory/, ekg/ — union-copy so existing sandbox state (persisted memory
  //    in particular) is never clobbered, but new host files land in place.
  for (const sub of UNION_SUBDIRS) {
    const hostSub = path.join(hostDir, sub);
    if ((await safeStat(hostSub))?.isDirectory()) {
      const sandboxSub = path.join(sandboxDir, sub);
      const result = await copyTree(hostSub, sandboxSub, { overwrite: false });
      debug(`${sub} union-copied`, { copied: result.copied, skipped: result.skipped });
    }
  }

  // 3. Loose files: config.json5, MEMORY.md — seed only if missing in sandbox.
  for (const name of UNION_FILES) {
    const wrote = await seedUnionFile(hostDir, sandboxDir, name);
    if (wrote) debug(`seeded ${name}`);
  }

  // 4. Custom BOOTSTRAP.md override — only if host is substantially larger.
  const wroteBootstrap = await seedBootstrapMd(hostDir, sandboxDir);
  if (wroteBootstrap) debug("replaced BOOTSTRAP.md stub with host custom version");
}

const senturaSandboxSeedHook: HookHandler = async (event) => {
  try {
    if (!isBootstrapEvent(event)) return;
    const ctx = event.context as BootstrapContext;
    const workspaceDir = ctx.workspaceDir;
    if (!isSandboxPath(workspaceDir)) {
      debug("not a sandbox path, skipping", { workspaceDir });
      return;
    }

    const agentId = ctx.agentId ?? extractAgentIdFromSandboxPath(workspaceDir);
    if (!agentId) {
      debug("could not infer agentId", { workspaceDir });
      return;
    }

    const hostDir = resolveHostWorkspace(agentId);
    if (!hostDir) {
      debug("no host workspace for agent", { agentId });
      return;
    }

    if (path.resolve(hostDir) === path.resolve(workspaceDir)) {
      debug("host workspace == sandbox (runtime=embedded with rw access); skipping", { hostDir });
      return;
    }

    debug("seeding sandbox from host", { agentId, hostDir, sandboxDir: workspaceDir });
    await seedSandbox(hostDir, workspaceDir);
  } catch (error) {
    // Never crash bootstrap because of a seeding error.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[sentura-sandbox-seed] error while seeding sandbox: ${message}`);
  }
};

export default senturaSandboxSeedHook;
