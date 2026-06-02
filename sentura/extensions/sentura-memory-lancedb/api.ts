// Local plugin-sdk barrel for sentura-memory-lancedb.
//
// OpenClaw 2026.6.x no longer exposes the old
// `openclaw/plugin-sdk/memory-lancedb` convenience subpath, so this file keeps
// the fork's imports behind one seam while using the stable public SDK exports.
export { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
export { resolveStateDir } from "openclaw/plugin-sdk/state-paths";
