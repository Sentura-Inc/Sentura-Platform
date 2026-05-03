/**
 * LanceDB runtime loader for sentura-memory-lancedb.
 *
 * Forked from `openclaw/extensions/memory-lancedb/lancedb-runtime.ts` —
 * structurally identical, but the install dir is namespaced under
 * `plugin-runtimes/sentura-memory-lancedb/lancedb` so the Sentura fork's
 * cached LanceDB native binaries don't collide with the upstream variant
 * if both are present on the same host (e.g. during a migration window).
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveStateDir } from "./api.js";

type LanceDbModule = typeof import("@lancedb/lancedb");

export type LanceDbRuntimeLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

type RuntimeManifest = {
  name: string;
  private: true;
  type: "module";
  dependencies: Record<string, string>;
};

type PackageJsonWithDependencies = {
  dependencies?: Record<string, string>;
};

type ReadPackageJson = (manifestPath: string) => PackageJsonWithDependencies | null;

function defaultReadPackageJson(manifestPath: string): PackageJsonWithDependencies | null {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PackageJsonWithDependencies;
  } catch {
    return null;
  }
}

function buildManifestCandidates(modulePath: string): string[] {
  const moduleDir = path.dirname(modulePath);
  const candidates = new Set<string>();
  candidates.add(path.join(moduleDir, "package.json"));

  let cursor = moduleDir;
  while (true) {
    candidates.add(path.join(cursor, "extensions", "sentura-memory-lancedb", "package.json"));
    candidates.add(path.join(cursor, "sentura-memory-lancedb", "package.json"));
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return [...candidates];
}

export function resolveLanceDbDependencySpec(
  modulePath: string,
  readPackageJson: ReadPackageJson = defaultReadPackageJson,
): string {
  for (const manifestPath of buildManifestCandidates(modulePath)) {
    const lanceDbSpec = readPackageJson(manifestPath)?.dependencies?.["@lancedb/lancedb"];
    if (lanceDbSpec) {
      return lanceDbSpec;
    }
  }
  throw new Error('sentura-memory-lancedb package.json is missing "@lancedb/lancedb"');
}

const SENTURA_LANCEDB_RUNTIME_MANIFEST: RuntimeManifest = (() => {
  const lanceDbSpec = resolveLanceDbDependencySpec(fileURLToPath(import.meta.url));
  return {
    name: "sentura-memory-lancedb-runtime",
    private: true,
    type: "module",
    dependencies: { "@lancedb/lancedb": lanceDbSpec },
  };
})();

function resolveRuntimeDir(stateDir: string): string {
  return path.join(stateDir, "plugin-runtimes", "sentura-memory-lancedb", "lancedb");
}

function readRuntimeManifest(filePath: string): RuntimeManifest | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as RuntimeManifest;
  } catch {
    return null;
  }
}

function manifestsMatch(actual: RuntimeManifest | null, expected: RuntimeManifest): boolean {
  if (!actual) return false;
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function defaultResolveRuntimeEntry(params: {
  runtimeDir: string;
  manifest: RuntimeManifest;
}): string | null {
  const runtimePackagePath = path.join(params.runtimeDir, "package.json");
  if (!manifestsMatch(readRuntimeManifest(runtimePackagePath), params.manifest)) {
    return null;
  }
  try {
    const runtimeRequire = createRequire(runtimePackagePath);
    return runtimeRequire.resolve("@lancedb/lancedb");
  } catch {
    return null;
  }
}

function collectSpawnOutput(params: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}): Promise<{ code: number | null; stdout: string; stderr: string; error?: Error }> {
  return new Promise((resolve) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      env: params.env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => resolve({ code: null, stdout, stderr, error }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function defaultInstallRuntime(params: {
  runtimeDir: string;
  manifest: RuntimeManifest;
  env: NodeJS.ProcessEnv;
  logger?: LanceDbRuntimeLogger;
}): Promise<string> {
  const runtimePackagePath = path.join(params.runtimeDir, "package.json");
  const currentManifest = readRuntimeManifest(runtimePackagePath);
  if (!manifestsMatch(currentManifest, params.manifest)) {
    await fs.promises.rm(path.join(params.runtimeDir, "node_modules"), {
      recursive: true,
      force: true,
    });
    await fs.promises.rm(path.join(params.runtimeDir, "package-lock.json"), { force: true });
  }

  await fs.promises.mkdir(params.runtimeDir, { recursive: true });
  await fs.promises.writeFile(
    runtimePackagePath,
    `${JSON.stringify(params.manifest, null, 2)}\n`,
    "utf8",
  );

  const install = await collectSpawnOutput({
    command: "npm",
    args: ["install", "--omit=dev", "--silent", "--ignore-scripts", "--package-lock=false"],
    cwd: params.runtimeDir,
    env: params.env,
  });
  if (install.error) {
    const spawnError = install.error as NodeJS.ErrnoException;
    throw new Error(
      spawnError.code === "ENOENT"
        ? "npm is required to install the LanceDB runtime but was not found on PATH"
        : install.error.message,
    );
  }
  if ((install.code ?? 0) !== 0) {
    const detail = install.stderr.trim() || install.stdout.trim();
    throw new Error(detail || `npm exited with code ${install.code ?? "unknown"}`);
  }

  const resolved = defaultResolveRuntimeEntry({
    runtimeDir: params.runtimeDir,
    manifest: params.manifest,
  });
  if (!resolved) {
    throw new Error("installed LanceDB runtime is missing the @lancedb/lancedb entry");
  }
  params.logger?.info?.(
    `sentura-memory-lancedb: installed LanceDB runtime under ${params.runtimeDir}`,
  );
  return resolved;
}

function defaultImportResolved(resolvedPath: string): Promise<LanceDbModule> {
  return import(pathToFileURL(resolvedPath).href);
}

let loadPromise: Promise<LanceDbModule> | null = null;

export async function loadLanceDbModule(logger?: LanceDbRuntimeLogger): Promise<LanceDbModule> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        return await import("@lancedb/lancedb");
      } catch (bundledError) {
        const env = process.env;
        const stateDir = resolveStateDir(env, () =>
          env.HOME?.trim() ? env.HOME : os.homedir(),
        );
        const runtimeDir = resolveRuntimeDir(stateDir);
        const existingRuntime = defaultResolveRuntimeEntry({
          runtimeDir,
          manifest: SENTURA_LANCEDB_RUNTIME_MANIFEST,
        });
        if (existingRuntime) {
          try {
            return await defaultImportResolved(existingRuntime);
          } catch {
            // fall through to reinstall
          }
        }
        if (env.OPENCLAW_NIX_MODE === "1") {
          throw new Error(
            `sentura-memory-lancedb: failed to load LanceDB and Nix mode disables auto-install. ${String(bundledError)}`,
            { cause: bundledError },
          );
        }
        logger?.warn?.(
          `sentura-memory-lancedb: bundled LanceDB runtime unavailable (${String(bundledError)}); installing under ${runtimeDir}`,
        );
        const installedEntry = await defaultInstallRuntime({
          runtimeDir,
          manifest: SENTURA_LANCEDB_RUNTIME_MANIFEST,
          env,
          logger,
        });
        return await defaultImportResolved(installedEntry);
      }
    })().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  return await loadPromise;
}
