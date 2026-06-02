/**
 * GET /api/groups/[id]/history
 *
 * Reconstructs the merged group transcript from two authoritative sources:
 *
 *   1. Group-level user messages persisted on the GroupRecord (single
 *      `messages: PersistedUserMessage[]` array — one entry per typed
 *      input regardless of how many agents fan-out).
 *   2. Per-agent assistant replies pulled from each participant's
 *      OpenClaw session via gateway RPC `chat.history`.
 *
 * Why the split: a user message in a group fan-out reaches every agent's
 * session. Naively merging all per-agent transcripts would duplicate the
 * user message N times. Persisting once on the group + fetching only
 * `assistant`-role entries from each per-agent transcript gives us a
 * single canonical user message and N independent assistant replies,
 * merged by timestamp.
 *
 * Wire shape (JSON response body):
 *
 *   { messages: [
 *       { kind: "user",      id, text, timestamp },
 *       { kind: "assistant", id, agentId, text, timestamp },
 *     ...] }
 *
 * Sorted ascending by `timestamp`.
 */

import { getGroup, getGroupMessages } from "@/lib/groups/store";
import { getServerGatewayClient } from "@/lib/gateway/server-client";
import type { TranscriptMessage } from "@/lib/gateway";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UserEntry {
  kind: "user";
  id: string;
  text: string;
  timestamp: number;
}

interface AssistantEntry {
  kind: "assistant";
  id: string;
  agentId: string;
  text: string;
  timestamp: number;
}

type GroupTranscriptEntry = UserEntry | AssistantEntry;

const HISTORY_PER_AGENT_LIMIT = 200;

export async function GET(_request: Request, ctx: RouteContext) {
  const { id: groupId } = await ctx.params;

  const group = await getGroup(groupId);
  if (!group) return jsonError(`Group ${groupId} not found`, 404);

  // Persisted user side.
  const persisted = await getGroupMessages(groupId);
  const userEntries: UserEntry[] = persisted.map((m) => ({
    kind: "user",
    id: m.id,
    text: m.text,
    timestamp: m.timestamp,
  }));

  // Per-agent assistant side. Gateway failure for one agent must NOT
  // collapse the whole transcript — best-effort, same posture as the
  // SSE fan-out route.
  const client = await getServerGatewayClient();
  const assistantEntries: AssistantEntry[] = [];
  await Promise.all(
    group.participantAgentIds.map(async (agentId) => {
      const sessionKey = group.underlyingSessionKeys[agentId];
      if (!sessionKey) return; // No session yet — agent has never replied.
      try {
        const messages = await client.getTranscript(
          sessionKey,
          HISTORY_PER_AGENT_LIMIT,
        );
        for (const m of messages) {
          if (m.role !== "assistant") continue;
          const text = extractText(m);
          if (!text) continue;
          assistantEntries.push({
            kind: "assistant",
            // Stable id from session + timestamp avoids React-key collisions
            // when the same agent has multiple replies in rapid succession.
            id: `${agentId}-${m.timestamp ?? Date.now()}-${assistantEntries.length}`,
            agentId,
            text,
            timestamp: parseTimestamp(m.timestamp),
          });
        }
      } catch {
        // Per-agent fetch failure: skip silently. The merged transcript
        // is still useful with N-1 agents' replies, and the live SSE
        // path will repopulate when the user sends the next message.
      }
    }),
  );

  const merged: GroupTranscriptEntry[] = [...userEntries, ...assistantEntries].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  return new Response(JSON.stringify({ messages: merged }), {
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractText(m: TranscriptMessage): string {
  const c = m.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) {
    if (c && typeof c === "object" && "type" in c && (c as { type: unknown }).type === "text") {
      const text = (c as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    }
    return "";
  }
  return c
    .map((b) =>
      b && typeof b === "object" && "type" in b && b.type === "text" && typeof b.text === "string"
        ? b.text
        : "",
    )
    .join("");
}

function parseTimestamp(t: string | undefined): number {
  if (!t) return Date.now();
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : Date.now();
}
