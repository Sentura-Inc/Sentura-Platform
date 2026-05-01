import os from "node:os";
import path from "node:path";

export {
  definePluginEntry,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";

/**
 * Resolve the root OpenClaw state directory. Mirrors the helper in
 * `sentura-rbac/api.ts` and `sentura-agents/api.ts` — the OpenClaw plugin
 * SDK does not export a public `resolveStateDir`, so we inline the same
 * precedence used by `openclaw/src/...`: OPENCLAW_STATE_DIR → OPENCLAW_HOME
 * → $HOME/.openclaw.
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
