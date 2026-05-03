// Local plugin-sdk barrel for sentura-memory-lancedb. Mirrors the upstream
// memory-lancedb api.ts surface (definePluginEntry, resolveStateDir,
// OpenClawPluginApi) so the fork imports through a single seam — flipping a
// future SDK rename only requires editing this file.
export {
  definePluginEntry,
  resolveStateDir,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/memory-lancedb";
