#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const SECRET_POINTER_PREFIX = "$secret:";

function resolveOpenClawDir(env = process.env) {
  const stateDirOverride = env.OPENCLAW_STATE_DIR?.trim();
  if (stateDirOverride) {
    return stateDirOverride;
  }
  const home = env.OPENCLAW_HOME?.trim() || env.HOME?.trim() || os.homedir();
  if (!home) {
    throw new Error(
      "[sentura-mcp-launcher] Could not resolve OpenClaw home directory from OPENCLAW_STATE_DIR / OPENCLAW_HOME / HOME.",
    );
  }
  return path.join(home, ".openclaw");
}

function resolveSecretStorePath(env = process.env) {
  const openclawDir = resolveOpenClawDir(env);
  const configPath = path.join(openclawDir, "openclaw.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const provider = config?.secrets?.providers?.default;
    if (
      provider
      && provider.source === "file"
      && typeof provider.path === "string"
      && provider.path.trim().length > 0
    ) {
      return provider.path.trim();
    }
  } catch {
    // Fall through to Sentura's default file-provider location.
  }
  return path.join(openclawDir, "secrets.json");
}

function readJsonObject(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON object.`);
  }
  return parsed;
}

function resolveSecretId(store, secretId) {
  const segments = secretId.replace(/^\/+/, "").split("/").filter(Boolean);
  let current = store;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return typeof current === "string" ? current : undefined;
}

function resolveLauncherEnv(env = process.env) {
  const secretsPath = resolveSecretStorePath(env);
  const store = readJsonObject(secretsPath);
  const nextEnv = { ...env };

  for (const [key, value] of Object.entries(nextEnv)) {
    if (typeof value !== "string" || !value.startsWith(SECRET_POINTER_PREFIX)) {
      continue;
    }
    const secretId = value.slice(SECRET_POINTER_PREFIX.length).trim();
    if (!secretId.startsWith("/")) {
      throw new Error(
        `[sentura-mcp-launcher] ${key} uses an invalid secret pointer "${value}". Expected "$secret:/path".`,
      );
    }
    const resolved = resolveSecretId(store, secretId);
    if (typeof resolved !== "string" || resolved.length === 0) {
      throw new Error(
        `[sentura-mcp-launcher] ${key} points at missing secret path "${secretId}" in ${secretsPath}.`,
      );
    }
    nextEnv[key] = resolved;
  }

  return nextEnv;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    throw new Error(
      "[sentura-mcp-launcher] Usage: node scripts/sentura-mcp-launcher.mjs <command> [args...]",
    );
  }

  const env = resolveLauncherEnv(process.env);
  const child = spawn(command, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env,
  });

  child.on("error", (err) => {
    console.error(`[sentura-mcp-launcher] failed to spawn ${command}: ${err.message}`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
