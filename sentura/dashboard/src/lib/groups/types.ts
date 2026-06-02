/**
 * Shared types for the group-chat data model. Kept in a Node-import-free
 * file so client components can import without dragging server-only `fs`
 * code into the browser bundle.
 */

/**
 * One user-typed message addressed to the entire group. Persisted on the
 * group record so the merged transcript survives page navigation. Assistant
 * replies are NOT persisted here — they live in each per-agent OpenClaw
 * session (`underlyingSessionKeys[agentId]`) and are fetched via
 * `chat.history` at mount time. This split avoids duplicating the user's
 * message N times (once per agent's transcript) while keeping the merged
 * group view reconstructable from authoritative sources.
 */
export interface PersistedUserMessage {
  id: string;
  text: string;
  timestamp: number;
}

export interface GroupRecord {
  id: string;
  name: string;
  participantAgentIds: string[];
  underlyingSessionKeys: Record<string, string>;
  createdAt: number;
  archivedAt?: number;
  /**
   * Group-level user messages. Optional for backwards compatibility with
   * group records written before the persistence fix (2026-05-04). Sorted
   * ascending by `timestamp` on every write.
   */
  messages?: PersistedUserMessage[];
}
