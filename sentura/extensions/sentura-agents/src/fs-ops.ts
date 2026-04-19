import fs from "node:fs/promises";
import path from "node:path";
import {
  NATIVE_WORKSPACE_FILES,
  PathValidationError,
  safeJoin,
  validateAgentId,
  validateRelPath,
} from "./paths.js";
import type { ValidateOptions } from "./paths.js";

export interface ResolvedTarget {
  agentId: string;
  workspaceDir: string;
  relPath: string;
  absPath: string;
}

export interface SubfileOptions extends ValidateOptions {
  workspaceRoot: string;
  maxFileBytes: number;
}

async function ensureWorkspaceExists(workspaceDir: string): Promise<void> {
  try {
    const stat = await fs.stat(workspaceDir);
    if (!stat.isDirectory()) {
      throw new PathValidationError(
        "WORKSPACE_NOT_DIR",
        `agent workspace path exists but is not a directory: ${workspaceDir}`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PathValidationError(
        "WORKSPACE_MISSING",
        `agent workspace does not exist: ${workspaceDir}. Create it via sentura_agents_manage({action:"create_agent",agentId}) first.`,
      );
    }
    throw err;
  }
}

/**
 * Create the agent's workspace directory on the HOST filesystem. This is a
 * direct substitute for the portion of gateway.agents.create that creates the
 * workspace root; it does NOT write the openclaw.json agents.list entry (that
 * must be done separately via gateway.config.patch from the caller).
 *
 * Idempotent: if the directory already exists it returns { created: false }.
 */
export async function createAgentWorkspace(
  agentIdRaw: unknown,
  opts: SubfileOptions,
): Promise<{
  ok: true;
  agentId: string;
  workspaceDir: string;
  created: boolean;
}> {
  const agentId = validateAgentId(agentIdRaw);
  const workspaceDir = path.resolve(opts.workspaceRoot, agentId);
  let created = false;
  try {
    const stat = await fs.stat(workspaceDir);
    if (!stat.isDirectory()) {
      throw new PathValidationError(
        "WORKSPACE_NOT_DIR",
        `agent workspace path exists but is not a directory: ${workspaceDir}`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.mkdir(workspaceDir, { recursive: true, mode: 0o755 });
      created = true;
    } else {
      throw err;
    }
  }
  return { ok: true, agentId, workspaceDir, created };
}

export function resolveTarget(
  agentIdRaw: unknown,
  relPathRaw: unknown,
  opts: SubfileOptions,
): ResolvedTarget {
  const agentId = validateAgentId(agentIdRaw);
  const validated = validateRelPath(relPathRaw, opts);
  const workspaceDir = path.resolve(opts.workspaceRoot, agentId);
  const absPath = safeJoin(workspaceDir, validated);
  return { agentId, workspaceDir, relPath: validated.joined, absPath };
}

export async function writeSubfile(
  agentIdRaw: unknown,
  relPathRaw: unknown,
  contentRaw: unknown,
  opts: SubfileOptions,
): Promise<{ ok: true; agentId: string; relPath: string; bytes: number }> {
  if (typeof contentRaw !== "string") {
    throw new PathValidationError("INVALID_CONTENT", "content must be a string");
  }
  const bytes = Buffer.byteLength(contentRaw, "utf8");
  if (bytes > opts.maxFileBytes) {
    throw new PathValidationError(
      "TOO_LARGE",
      `content is ${bytes} bytes; max ${opts.maxFileBytes}`,
    );
  }
  const target = resolveTarget(agentIdRaw, relPathRaw, opts);
  await ensureWorkspaceExists(target.workspaceDir);
  await fs.mkdir(path.dirname(target.absPath), { recursive: true });
  const tmp = `${target.absPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmp, contentRaw, { encoding: "utf8", mode: 0o644 });
    await fs.rename(tmp, target.absPath);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
  return { ok: true, agentId: target.agentId, relPath: target.relPath, bytes };
}

export async function deleteSubfile(
  agentIdRaw: unknown,
  relPathRaw: unknown,
  opts: SubfileOptions,
): Promise<{ ok: true; agentId: string; relPath: string; removed: boolean }> {
  const target = resolveTarget(agentIdRaw, relPathRaw, opts);
  await ensureWorkspaceExists(target.workspaceDir);
  try {
    await fs.unlink(target.absPath);
    return { ok: true, agentId: target.agentId, relPath: target.relPath, removed: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: true, agentId: target.agentId, relPath: target.relPath, removed: false };
    }
    throw err;
  }
}

export interface SubfileListEntry {
  relPath: string;
  bytes: number;
  modifiedAtMs: number;
}

export async function listSubfiles(
  agentIdRaw: unknown,
  relDirRaw: unknown,
  opts: SubfileOptions,
): Promise<{ ok: true; agentId: string; entries: SubfileListEntry[] }> {
  const agentId = validateAgentId(agentIdRaw);
  const workspaceDir = path.resolve(opts.workspaceRoot, agentId);
  await ensureWorkspaceExists(workspaceDir);
  const relDir = (() => {
    if (relDirRaw === undefined || relDirRaw === null || relDirRaw === "") return null;
    const validated = validateRelPath(`${String(relDirRaw).replace(/\/+$/, "")}/_list_.placeholder`, opts);
    validated.segments.pop();
    return validated.segments.join("/");
  })();
  const walkRoot = relDir ? path.resolve(workspaceDir, relDir) : workspaceDir;
  const entries: SubfileListEntry[] = [];

  async function walk(current: string, rel: string): Promise<void> {
    let children: import("node:fs").Dirent[];
    try {
      children = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const dirent of children) {
      const childRel = rel ? `${rel}/${dirent.name}` : dirent.name;
      const childAbs = path.join(current, dirent.name);
      if (dirent.isDirectory()) {
        await walk(childAbs, childRel);
      } else if (dirent.isFile()) {
        const prefixOk = opts.allowedPrefixes.some((p) =>
          childRel === p.replace(/\/+$/, "") || childRel.startsWith(p),
        );
        const isNativeAtRoot =
          !rel && !childRel.includes("/") && NATIVE_WORKSPACE_FILES.has(dirent.name);
        if (!prefixOk && !isNativeAtRoot) continue;
        const stat = await fs.stat(childAbs);
        entries.push({
          relPath: childRel,
          bytes: stat.size,
          modifiedAtMs: Math.floor(stat.mtimeMs),
        });
      }
    }
  }

  await walk(walkRoot, relDir ?? "");
  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { ok: true, agentId, entries };
}

export async function readSubfile(
  agentIdRaw: unknown,
  relPathRaw: unknown,
  opts: SubfileOptions,
): Promise<{ ok: true; agentId: string; relPath: string; content: string; bytes: number }> {
  const target = resolveTarget(agentIdRaw, relPathRaw, opts);
  await ensureWorkspaceExists(target.workspaceDir);
  const content = await fs.readFile(target.absPath, "utf8");
  return {
    ok: true,
    agentId: target.agentId,
    relPath: target.relPath,
    content,
    bytes: Buffer.byteLength(content, "utf8"),
  };
}
