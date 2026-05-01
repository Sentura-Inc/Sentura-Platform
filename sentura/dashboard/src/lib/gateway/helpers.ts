import type { SessionSummary } from "./types";

/**
 * Session keys are structured: `agent:<agentId>:user:<userToken>:<sessionId>`
 * (or `agent:<agentId>:dashboard:<sessionId>` for the dashboard's operator
 * connection). Parsing the key as the source of truth is more reliable than
 * the gateway's `agentId` schema field, which is inconsistently populated
 * in `sessions.list` responses.
 */
export function parseAgentIdFromKey(key: string): string | null {
  const m = key.match(/^agent:([^:]+):/);
  return m ? m[1] : null;
}

/**
 * Resolve a session's agent id, preferring the structured key prefix and
 * falling back to the schema field for keys that don't match the format.
 * Returns null only when neither source yields a usable id.
 */
export function getSessionAgentId(session: SessionSummary): string | null {
  return parseAgentIdFromKey(session.key) ?? session.agentId ?? null;
}
