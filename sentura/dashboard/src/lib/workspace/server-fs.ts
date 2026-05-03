import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import JSON5 from "json5";

/**
 * Server-only filesystem helpers for reading agent workspace artifacts
 * out of OpenClaw's runtime state directory (`~/.openclaw/`).
 *
 * `node:` import prefix so the bundler emits a clear server-only error
 * if accidentally imported into a client component (mirrors the pattern
 * Person C established in `lib/groups/store.ts`).
 *
 * All public read functions enforce path-traversal containment via
 * `safeJoinUnder` — callers pass a root + a relative path; results
 * outside root are rejected.
 */

const DEFAULT_OPENCLAW_HOME = path.join(homedir(), ".openclaw");

/** Where OpenClaw keeps per-agent deployed workspaces. */
export function getOpenClawWorkspaceRoot(): string {
  return (
    process.env.OPENCLAW_WORKSPACE_DIR ??
    path.join(DEFAULT_OPENCLAW_HOME, "workspace")
  );
}

/**
 * Where Person B's pre-deployment runner writes SuiteRunResult files.
 * Path matches the doc-block in `scripts/run-pre-deployment-tests.ts`:
 * `~/.openclaw/test-runs/{suiteId}-{ISO}.json5`.
 */
export function getTestRunsRoot(): string {
  return (
    process.env.SENTURA_TEST_RUNS_DIR ??
    path.join(DEFAULT_OPENCLAW_HOME, "test-runs")
  );
}

/**
 * Resolve `relative` under `root`, rejecting any result whose absolute
 * path escapes the root (defense against `../`, absolute paths,
 * normalized-path tricks).
 */
export function safeJoinUnder(root: string, relative: string): string {
  const rootAbs = path.resolve(root);
  const candidate = path.resolve(rootAbs, relative);
  const rel = path.relative(rootAbs, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes root: ${relative}`);
  }
  return candidate;
}

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

export async function listDirUnder(
  root: string,
  relative: string,
): Promise<DirEntry[]> {
  const abs = safeJoinUnder(root, relative);
  try {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        isFile: e.isFile(),
        isDirectory: e.isDirectory(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export interface FileMeta {
  sizeBytes: number;
  modifiedAt: number;
}

export async function statUnder(
  root: string,
  relative: string,
): Promise<FileMeta | null> {
  const abs = safeJoinUnder(root, relative);
  try {
    const s = await fs.stat(abs);
    return { sizeBytes: s.size, modifiedAt: s.mtimeMs };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function readTextUnder(
  root: string,
  relative: string,
): Promise<string | null> {
  const abs = safeJoinUnder(root, relative);
  try {
    return await fs.readFile(abs, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Read + parse a JSON5 file (handles unquoted keys, trailing commas,
 * comments). Person B's orchestrator EKG entries use unquoted keys,
 * so plain JSON.parse will not work here.
 *
 * Returns null if the file is missing. Throws on parse error so the
 * caller surfaces a clear 500 rather than silently substituting bad
 * data.
 */
export async function readJson5Under(
  root: string,
  relative: string,
): Promise<unknown | null> {
  const text = await readTextUnder(root, relative);
  if (text === null) return null;
  return JSON5.parse(text);
}

/**
 * Read + parse plain JSON. Person B's pre-deployment test runner uses
 * `JSON.stringify` even though file extension is `.json5`, so this is
 * the right reader for `~/.openclaw/test-runs/`.
 */
export async function readJsonUnder(
  root: string,
  relative: string,
): Promise<unknown | null> {
  const text = await readTextUnder(root, relative);
  if (text === null) return null;
  return JSON.parse(text);
}
