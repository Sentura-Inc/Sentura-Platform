#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolvePnpmRunner } from "./pnpm-runner.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hashFile = path.join(rootDir, "src", "canvas-host", "a2ui", ".bundle.hash");
const outputFile = path.join(rootDir, "src", "canvas-host", "a2ui", "a2ui.bundle.js");
const a2uiRendererDir = path.join(rootDir, "vendor", "a2ui", "renderers", "lit");
const a2uiAppDir = path.join(rootDir, "apps", "shared", "OpenClawKit", "Tools", "CanvasA2UI");
const uiPackageFile = path.join(rootDir, "ui", "package.json");
const bundleDependencyIds = ["lit", "@lit/context", "@lit-labs/signals", "signal-utils"];
const repoInputPaths = [uiPackageFile, a2uiRendererDir, a2uiAppDir];
const ignoredBundleHashInputPrefixes = ["vendor/a2ui/renderers/lit/dist"];
const relativeRepoInputPaths = repoInputPaths.map((inputPath) =>
  normalizePath(path.relative(rootDir, inputPath)),
);
const placeholderBundleBanner = [
  "// Auto-generated placeholder bundle.",
  "// This source checkout does not include the full A2UI renderer sources.",
  "// Canvas A2UI remains unavailable until those sources are restored.",
].join("\n");

function fail(message) {
  console.error(message);
  console.error("A2UI bundling failed. Re-run with: pnpm canvas:a2ui:bundle");
  console.error("If this persists, verify pnpm deps and try again.");
  process.exit(1);
}

async function writePlaceholderBundle() {
  const sourceHint = [
    "OpenClaw built without the optional A2UI renderer sources.",
    "Canvas A2UI is unavailable in this checkout.",
    "Restore vendor/a2ui and apps/shared/OpenClawKit/Tools/CanvasA2UI, then rerun `pnpm canvas:a2ui:bundle`.",
  ].join(" ");
  const contents = `${placeholderBundleBanner}
(function () {
  const message = ${JSON.stringify(sourceHint)};
  console.warn(message);
  function render() {
    const root = document.body;
    if (!root) return;
    root.innerHTML = "";
    root.style.margin = "0";
    root.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
    root.style.background = "#0f1117";
    root.style.color = "#f3f4f6";
    root.style.minHeight = "100vh";
    root.style.display = "grid";
    root.style.placeItems = "center";
    const card = document.createElement("div");
    card.style.maxWidth = "720px";
    card.style.padding = "24px";
    card.style.margin = "24px";
    card.style.border = "1px solid rgba(255,255,255,0.12)";
    card.style.borderRadius = "16px";
    card.style.background = "rgba(255,255,255,0.04)";
    card.innerHTML =
      "<h1 style=\\"margin:0 0 12px;font-size:24px\\">A2UI unavailable</h1>" +
      "<p style=\\"margin:0;line-height:1.6\\">" + message + "</p>";
    root.appendChild(card);
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", render, { once: true });
    } else {
      render();
    }
  }
})();
`;
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, contents, "utf8");
}

async function pathExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

export function isBundleHashInputPath(filePath, repoRoot = rootDir) {
  const relativePath = normalizePath(path.relative(repoRoot, filePath));
  return !ignoredBundleHashInputPrefixes.some(
    (ignoredPath) => relativePath === ignoredPath || relativePath.startsWith(`${ignoredPath}/`),
  );
}

export function getLocalRolldownCliCandidates(repoRoot = rootDir) {
  return [
    path.join(repoRoot, "node_modules", "rolldown", "bin", "cli.mjs"),
    path.join(repoRoot, "node_modules", ".pnpm", "node_modules", "rolldown", "bin", "cli.mjs"),
    path.join(
      repoRoot,
      "node_modules",
      ".pnpm",
      "rolldown@1.0.0-rc.12",
      "node_modules",
      "rolldown",
      "bin",
      "cli.mjs",
    ),
  ];
}

export function getBundleHashRepoInputPaths(repoRoot = rootDir) {
  return [
    path.join(repoRoot, "ui", "package.json"),
    path.join(repoRoot, "vendor", "a2ui", "renderers", "lit"),
    path.join(repoRoot, "apps", "shared", "OpenClawKit", "Tools", "CanvasA2UI"),
  ];
}

export function getResolvedBundleDependencyPackageJsonPaths(repoRoot = rootDir) {
  const uiNodeModules = path.join(repoRoot, "ui", "node_modules");
  const repoNodeModules = path.join(repoRoot, "node_modules");
  const paths = [];
  for (const dependencyId of bundleDependencyIds) {
    const candidates = [
      path.join(uiNodeModules, dependencyId, "package.json"),
      path.join(repoNodeModules, dependencyId, "package.json"),
    ];
    const match = candidates.find((candidate) => existsSync(candidate));
    if (match) {
      paths.push(match);
    }
  }
  return [...new Set(paths)];
}

export function getBundleHashInputPaths(repoRoot = rootDir) {
  return [
    ...getBundleHashRepoInputPaths(repoRoot),
    ...getResolvedBundleDependencyPackageJsonPaths(repoRoot),
  ];
}

export function compareNormalizedPaths(left, right) {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  if (normalizedLeft < normalizedRight) {
    return -1;
  }
  if (normalizedLeft > normalizedRight) {
    return 1;
  }
  return 0;
}

async function walkFiles(entryPath, files) {
  if (!isBundleHashInputPath(entryPath)) {
    return;
  }
  const stat = await fs.stat(entryPath);
  if (!stat.isDirectory()) {
    files.push(entryPath);
    return;
  }
  const entries = await fs.readdir(entryPath);
  for (const entry of entries) {
    await walkFiles(path.join(entryPath, entry), files);
  }
}

function listTrackedInputFiles() {
  const result = spawnSync("git", ["ls-files", "--", ...relativeRepoInputPaths], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    return null;
  }
  const trackedFiles = result.stdout
    .split("\n")
    .filter(Boolean)
    .map((filePath) => path.join(rootDir, filePath))
    .filter((filePath) => isBundleHashInputPath(filePath));
  return [...trackedFiles, ...getResolvedBundleDependencyPackageJsonPaths(rootDir)];
}

async function computeHash() {
  let files = listTrackedInputFiles();
  if (!files) {
    files = [];
    for (const inputPath of getBundleHashRepoInputPaths(rootDir)) {
      await walkFiles(inputPath, files);
    }
    files.push(...getResolvedBundleDependencyPackageJsonPaths(rootDir));
  }
  files = [...new Set(files)].toSorted(compareNormalizedPaths);

  const hash = createHash("sha256");
  for (const filePath of files) {
    hash.update(normalizePath(path.relative(rootDir, filePath)));
    hash.update("\0");
    hash.update(await fs.readFile(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function runStep(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPnpm(pnpmArgs) {
  const runner = resolvePnpmRunner({
    pnpmArgs,
    nodeExecPath: process.execPath,
    npmExecPath: process.env.npm_execpath,
    comSpec: process.env.ComSpec,
    platform: process.platform,
  });
  runStep(runner.command, runner.args, {
    shell: runner.shell,
    windowsVerbatimArguments: runner.windowsVerbatimArguments,
  });
}

async function main() {
  const hasRendererDir = await pathExists(a2uiRendererDir);
  const hasAppDir = await pathExists(a2uiAppDir);
  const hasOutputFile = await pathExists(outputFile);
  if (!hasRendererDir || !hasAppDir) {
    if (hasOutputFile) {
      console.log("A2UI sources missing; keeping prebuilt bundle.");
      return;
    }
    if (process.env.OPENCLAW_SPARSE_PROFILE || process.env.OPENCLAW_A2UI_SKIP_MISSING === "1") {
      console.error(
        "A2UI sources missing; skipping bundle because OPENCLAW_A2UI_SKIP_MISSING=1 or OPENCLAW_SPARSE_PROFILE is set.",
      );
      return;
    }
    console.warn(`A2UI sources missing; writing placeholder bundle to: ${outputFile}`);
    await writePlaceholderBundle();
    return;
  }

  const currentHash = await computeHash();
  if (await pathExists(hashFile)) {
    const previousHash = (await fs.readFile(hashFile, "utf8")).trim();
    if (previousHash === currentHash && hasOutputFile) {
      console.log("A2UI bundle up to date; skipping.");
      return;
    }
  }

  runPnpm(["-s", "exec", "tsc", "-p", path.join(a2uiRendererDir, "tsconfig.json")]);

  const localRolldownCliCandidates = getLocalRolldownCliCandidates(rootDir);
  const localRolldownCli = (
    await Promise.all(
      localRolldownCliCandidates.map(async (candidate) =>
        (await pathExists(candidate)) ? candidate : null,
      ),
    )
  ).find(Boolean);

  if (localRolldownCli) {
    runStep(process.execPath, [
      localRolldownCli,
      "-c",
      path.join(a2uiAppDir, "rolldown.config.mjs"),
    ]);
  } else {
    runPnpm(["-s", "exec", "rolldown", "-c", path.join(a2uiAppDir, "rolldown.config.mjs")]);
  }

  await fs.writeFile(hashFile, `${currentHash}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
