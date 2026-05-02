import os from "node:os";
import path from "node:path";

export {
  definePluginEntry,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";

export function resolveOpenClawDir(env: NodeJS.ProcessEnv = process.env): string {
  const stateDirOverride = env.OPENCLAW_STATE_DIR?.trim();
  if (stateDirOverride) return stateDirOverride;
  const home = env.OPENCLAW_HOME?.trim() || env.HOME?.trim() || os.homedir();
  if (!home) {
    throw new Error("[sentura-monitoring] Could not resolve OpenClaw home directory");
  }
  return path.join(home, ".openclaw");
}
