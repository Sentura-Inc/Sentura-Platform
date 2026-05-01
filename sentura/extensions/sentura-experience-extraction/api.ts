import os from "node:os";
import path from "node:path";

export {
  definePluginEntry,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";

/**
 * Resolve the root OpenClaw state directory. See
 * `sentura/extensions/sentura-agents/api.ts` for the full rationale — the
 * short version is that `openclaw/plugin-sdk/core` does not export this
 * helper, so we inline the same precedence rules
 * (`OPENCLAW_STATE_DIR` → `OPENCLAW_HOME` → `$HOME/.openclaw`) used by
 * OpenClaw's own `resolveStateDir`.
 */
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
