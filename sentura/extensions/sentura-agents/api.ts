import os from "node:os";
import path from "node:path";

export {
  definePluginEntry,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";

/**
 * Resolve the root OpenClaw state directory ("OPENCLAW_HOME"), mirroring the
 * precedence that `openclaw/src/config/paths.ts#resolveStateDir` uses at the
 * gateway level.
 *
 * OpenClaw's plugin SDK (`openclaw/plugin-sdk/core`) does not re-export this
 * helper — attempting to import it yields `undefined` and fails the plugin
 * with `TypeError: resolveOpenClawDir is not a function`. We therefore inline
 * the same precedence rules here so Sentura extensions have a stable,
 * SDK-independent anchor for per-plugin data directories.
 *
 * Precedence:
 *   1. `OPENCLAW_STATE_DIR`  — explicit state-dir override used by tests and
 *                              on-prem deployments with non-home install roots
 *   2. `OPENCLAW_HOME`       — override for the "home" that `~/.openclaw`
 *                              would otherwise resolve from
 *   3. `$HOME/.openclaw`     — the default install location
 *
 * NB: we deliberately resolve lazily (no top-level `os.homedir()` call) so
 * that tests which mutate `process.env.HOME` / `OPENCLAW_HOME` between
 * registrations pick up the change.
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
