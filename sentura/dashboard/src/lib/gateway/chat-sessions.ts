import type { SessionSummary } from "./types";

export interface ParsedDashboardChatSessionKey {
  agentId: string;
  sessionId: string;
}

export interface FilterChatSessionsOptions {
  agentId?: string;
  includeMetaAgents?: boolean;
}

const META_AGENT_IDS = new Set(["creator", "tuner", "orchestrator", "mcp-builder"]);
const DASHBOARD_CHAT_SESSION_RE = /^agent:([^:]+):dashboard:([0-9a-f-]+)$/i;

export function isMetaAgentId(agentId: string | null | undefined): boolean {
  return typeof agentId === "string" && META_AGENT_IDS.has(agentId);
}

export function parseDashboardChatSessionKey(
  sessionKey: string,
): ParsedDashboardChatSessionKey | null {
  const match = DASHBOARD_CHAT_SESSION_RE.exec(sessionKey.trim());
  if (!match) {
    return null;
  }
  return {
    agentId: match[1],
    sessionId: match[2],
  };
}

export function isDashboardChatSessionKey(sessionKey: string): boolean {
  return parseDashboardChatSessionKey(sessionKey) !== null;
}

export function filterChatSessions(
  sessions: readonly SessionSummary[],
  options: FilterChatSessionsOptions = {},
): SessionSummary[] {
  return [...sessions]
    .filter((session) => {
      const parsed = parseDashboardChatSessionKey(session.key);
      if (!parsed) {
        return false;
      }
      if (options.agentId && parsed.agentId !== options.agentId) {
        return false;
      }
      if (!options.includeMetaAgents && isMetaAgentId(parsed.agentId)) {
        return false;
      }
      return true;
    })
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
}
