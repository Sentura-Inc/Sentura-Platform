/**
 * Shared types for the group-chat data model. Kept in a Node-import-free
 * file so client components can import without dragging server-only `fs`
 * code into the browser bundle.
 */

export interface GroupRecord {
  id: string;
  name: string;
  participantAgentIds: string[];
  underlyingSessionKeys: Record<string, string>;
  createdAt: number;
  archivedAt?: number;
}
