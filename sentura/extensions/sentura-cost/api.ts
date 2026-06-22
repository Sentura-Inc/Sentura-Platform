import os from "node:os";
import path from "node:path";

export {
  definePluginEntry,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";

/**
 * Resolve the OpenClaw state directory. Mirrors the inline helpers used by
 * `sentura-rbac` and `sentura-agents` — the SDK does not export this and
 * the precedence rules (`OPENCLAW_STATE_DIR` → `OPENCLAW_HOME` →
 * `$HOME/.openclaw`) are stable.
 */
export function resolveOpenClawDir(env: NodeJS.ProcessEnv = process.env): string {
  const stateDirOverride = env.OPENCLAW_STATE_DIR?.trim();
  if (stateDirOverride) return stateDirOverride;
  const home = env.OPENCLAW_HOME?.trim() || env.HOME?.trim() || os.homedir();
  if (!home) {
    throw new Error(
      "[sentura-cost] Could not resolve OpenClaw home directory: neither OPENCLAW_HOME, HOME, nor os.homedir() is set.",
    );
  }
  return path.join(home, ".openclaw");
}
