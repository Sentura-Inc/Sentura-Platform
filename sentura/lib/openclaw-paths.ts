import os from "node:os";
import path from "node:path";

export function resolveOpenClawDir(env: NodeJS.ProcessEnv = process.env): string {
  const stateDirOverride = env.OPENCLAW_STATE_DIR?.trim();
  if (stateDirOverride) {
    return stateDirOverride;
  }
  const home = env.OPENCLAW_HOME?.trim() || env.HOME?.trim() || os.homedir();
  if (!home) {
    throw new Error(
      "[sentura] Could not resolve OpenClaw home directory: neither OPENCLAW_HOME, HOME, nor os.homedir() is set.",
    );
  }
  return path.join(home, ".openclaw");
}

export function resolveOpenClawConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveOpenClawDir(env), "openclaw.json");
}

export function resolveOpenClawWorkspaceBase(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveOpenClawDir(env), "workspace");
}

export function resolveOpenClawLogsDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveOpenClawDir(env), "logs");
}

export function resolveDefaultSecretFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveOpenClawDir(env), "secrets.json");
}
