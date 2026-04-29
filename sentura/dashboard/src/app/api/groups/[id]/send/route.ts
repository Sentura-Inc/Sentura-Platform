/**
 * Group fan-out endpoint with Server-Sent Events (SSE).
 *
 *   POST /api/groups/[id]/send  { message }
 *     → text/event-stream of frames:
 *
 *       { type: "started",   agentId, sessionKey, runId? }
 *       { type: "delta",     agentId, runId, text }
 *       { type: "final",     agentId, runId, text }
 *       { type: "agent-error", agentId, error }
 *       { type: "done" }
 *
 * Failure mode: best-effort. Each agent's lifecycle is independent — a
 * failed `createSession` for agent X emits an `agent-error` frame for X
 * but doesn't abort the stream for Y, Z. Rationale: a 3-agent group where
 * one MCP integration is mid-deploy should still let the user converse
 * with the other two; an all-or-nothing model would block productive work
 * on a transient single-agent failure.
 */

import { getGroup, recordSessionKey } from "@/lib/groups/store";
import { getServerGatewayClient } from "@/lib/gateway/server-client";
import type { ChatEventPayload } from "@/lib/gateway";
import { checkServerPermission } from "@/lib/auth/server-role";

interface SendBody {
  message?: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

const FAN_OUT_TIMEOUT_MS = 120_000;

export async function POST(request: Request, ctx: RouteContext) {
  const denied = checkServerPermission(request, "agents.tune");
  if (denied) {
    return jsonError(`Forbidden: ${denied.role} lacks ${denied.action}`, 403);
  }

  const { id: groupId } = await ctx.params;

  let body: SendBody;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const message = (body.message ?? "").trim();
  if (!message) return jsonError("message is required", 400);

  const group = await getGroup(groupId);
  if (!group) return jsonError(`Group ${groupId} not found`, 404);
  if (group.archivedAt) return jsonError(`Group ${groupId} is archived`, 410);

  const client = await getServerGatewayClient();

  const encoder = new TextEncoder();
  const sseFrame = (payload: Record<string, unknown>): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  // Map of sessionKey -> agentId for fast lookup when the broadcast
  // `chat` event arrives. Populated after each session is established.
  const sessionToAgent = new Map<string, string>();

  // Per-agent finalization tracking. Stream closes when every participant
  // has either reached terminal state ("final" / "aborted" / "error") or
  // an `agent-error` was emitted for them.
  const remaining = new Set<string>(group.participantAgentIds);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let unsubscribe: (() => void) | null = null;
      let unsubscribeState: (() => void) | null = null;
      let closed = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const closeOnce = () => {
        if (closed) return;
        closed = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        unsubscribe?.();
        unsubscribeState?.();
        try {
          controller.enqueue(sseFrame({ type: "done" }));
          controller.close();
        } catch {
          // Already closed by client cancel — ignore.
        }
      };

      // F2.6: if the gateway disconnects mid-stream, the chat events stop
      // arriving and we'd otherwise wait the full 120s timeout. Watch state
      // changes and surface the disconnect to every still-pending agent.
      unsubscribeState = client.onStateChange((nextState) => {
        if (closed) return;
        if (nextState === "connected") return;
        for (const agentId of remaining) {
          try {
            controller.enqueue(
              sseFrame({
                type: "agent-error",
                agentId,
                error: `gateway ${nextState}`,
              }),
            );
          } catch {
            // ignore — closeOnce below will tidy up.
          }
        }
        closeOnce();
      });

      const markDone = (agentId: string) => {
        remaining.delete(agentId);
        if (remaining.size === 0) closeOnce();
      };

      // Subscribe to broadcast `chat` events. Each event carries one
      // agent's response delta; we filter by sessionKey to find the
      // owning agent and re-tag the frame for the SSE consumer.
      unsubscribe = client.on("chat", (event) => {
        const payload = event.payload as unknown as ChatEventPayload | undefined;
        if (!payload) return;
        const agentId = sessionToAgent.get(payload.sessionKey);
        if (!agentId) return;

        const text = extractText(payload);
        const chatState = payload.state as unknown as string;
        const isFinal = chatState === "final";
        const isTerminal =
          isFinal || chatState === "aborted" || chatState === "error";

        if (!isTerminal && !text) return;

        try {
          controller.enqueue(
            sseFrame({
              type: isTerminal ? "final" : "delta",
              agentId,
              runId: payload.runId,
              text,
              ...(isTerminal && !isFinal ? { state: chatState } : {}),
            }),
          );
        } catch {
          closeOnce();
          return;
        }

        if (isTerminal) markDone(agentId);
      });

      // Fan-out: kick off each participant in parallel. A failure for
      // one agent emits an `agent-error` frame and removes that agent
      // from the `remaining` set so the stream can still close cleanly.
      await Promise.all(
        group.participantAgentIds.map(async (agentId) => {
          try {
            const existingKey = group.underlyingSessionKeys[agentId];
            if (existingKey) {
              sessionToAgent.set(existingKey, agentId);
              controller.enqueue(
                sseFrame({
                  type: "started",
                  agentId,
                  sessionKey: existingKey,
                }),
              );
              await client.sendChat(message, existingKey);
            } else {
              const result = await client.createSession(agentId, message, {
                label: `Group: ${group.name}`,
              });
              if (!result?.key) throw new Error("Gateway returned no session key");
              sessionToAgent.set(result.key, agentId);
              await recordSessionKey(group.id, agentId, result.key);
              controller.enqueue(
                sseFrame({
                  type: "started",
                  agentId,
                  sessionKey: result.key,
                }),
              );
            }
          } catch (err) {
            // S3.4: log full detail server-side, return sanitized public
            // message. Forwarding raw err.message leaks gateway internals
            // (paths, plugin error frames, deploy username via homedir).
            console.error(
              `[api/groups/${group.id}/send] agent=${agentId} fan-out failed:`,
              err,
            );
            try {
              controller.enqueue(
                sseFrame({
                  type: "agent-error",
                  agentId,
                  error: "send failed",
                }),
              );
            } catch {
              // Stream already closed.
            }
            markDone(agentId);
          }
        }),
      );

      // Hard ceiling so a stuck agent run doesn't pin the SSE
      // connection forever. 120s matches typical Sonnet long-form
      // generations and leaves room for tool-heavy turns.
      timeoutHandle = setTimeout(() => {
        for (const agentId of remaining) {
          try {
            controller.enqueue(
              sseFrame({ type: "agent-error", agentId, error: "timeout" }),
            );
          } catch {
            // ignore
          }
        }
        closeOnce();
      }, FAN_OUT_TIMEOUT_MS);

      // Client disconnected — propagate cleanup.
      request.signal.addEventListener("abort", closeOnce);
    },

    cancel() {
      // ReadableStream consumer cancelled — start() captured the
      // unsubscribe handle in its closure, so the abort listener
      // attached above already runs closeOnce. Nothing extra here.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractText(payload: ChatEventPayload): string {
  const msg = payload.message;
  if (!msg || msg.role !== "assistant") return "";
  const content = msg.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((b) =>
      b && typeof b === "object" && "type" in b && b.type === "text" &&
      typeof b.text === "string"
        ? b.text
        : "",
    )
    .join("");
}
