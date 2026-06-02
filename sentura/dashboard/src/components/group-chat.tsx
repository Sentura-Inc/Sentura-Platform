"use client";

/**
 * GroupChat — broadcast-style multi-agent chat surface (capability #16
 * Phase 2). Distinct from <AgentChat>:
 *   - One thread, N parallel assistant streams (one per participant).
 *   - Each assistant bubble shows a sender chip identifying the agent.
 *   - Tool/progress detail is intentionally NOT shown here (use the 1:1
 *     /chat surface to inspect a single agent's run if needed).
 *
 * Wire format consumed: the SSE stream produced by
 * /api/groups/[groupId]/send.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentConfig } from "@/lib/gateway";
import type { GroupRecord } from "@/lib/groups/types";

type AgentLookup = Record<string, AgentConfig | undefined>;

interface UserMsg {
  kind: "user";
  id: string;
  text: string;
  timestamp: number;
}

interface AssistantMsg {
  kind: "assistant";
  id: string;
  agentId: string;
  runId: string;
  text: string;
  streaming: boolean;
  timestamp: number;
}

interface AgentErrorMsg {
  kind: "agent-error";
  id: string;
  agentId: string;
  error: string;
  timestamp: number;
}

type GroupMessage = UserMsg | AssistantMsg | AgentErrorMsg;

/**
 * Wire shape returned by `GET /api/groups/[id]/history`. Persisted user
 * messages are rebuilt by reading the group's `messages[]` plus each
 * per-agent OpenClaw `chat.history`, merged by timestamp on the server.
 */
type GroupHistoryEntry =
  | { kind: "user"; id: string; text: string; timestamp: number }
  | { kind: "assistant"; id: string; agentId: string; text: string; timestamp: number };

interface SseFrame {
  type: "started" | "delta" | "final" | "agent-error" | "done";
  agentId?: string;
  sessionKey?: string;
  runId?: string;
  text?: string;
  error?: string;
  state?: string;
}

interface GroupChatProps {
  group: GroupRecord;
  agents: AgentLookup;
}

export function GroupChat({ group, agents }: GroupChatProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll, but yield to user when they scroll up.
  const userScrolledUpRef = useRef(false);
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const onScroll = () => {
      const delta = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledUpRef.current = delta > 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    if (userScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Reset transcript when switching to a different group, then fetch the
  // persisted history. Persisted user messages live on the group record
  // (`~/.openclaw/sentura-group-chats/groups.json`); assistant replies are
  // joined in by the route from each per-agent OpenClaw session via
  // `chat.history`. Until 2026-05-04 the group transcript was purely
  // in-memory React state and was lost on every re-mount.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setSubmitting(false);
    userScrolledUpRef.current = false;

    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/groups/${group.id}/history`, {
          signal: controller.signal,
        });
        if (!res.ok) return; // Best-effort — fall through to empty state.
        const data = (await res.json()) as { messages?: GroupHistoryEntry[] };
        if (cancelled || !data?.messages) return;
        const seeded: GroupMessage[] = data.messages
          .map((m): GroupMessage | null => {
            if (m.kind === "user") {
              return {
                kind: "user",
                id: m.id,
                text: m.text,
                timestamp: m.timestamp,
              };
            }
            if (m.kind === "assistant") {
              return {
                kind: "assistant",
                id: m.id,
                agentId: m.agentId,
                runId: m.id, // No runId from history; reuse id as a stable React key.
                text: m.text,
                streaming: false,
                timestamp: m.timestamp,
              };
            }
            return null;
          })
          .filter((m): m is GroupMessage => m !== null);
        if (!cancelled) setMessages(seeded);
      } catch {
        // Aborted or transient failure — leave transcript empty; live SSE
        // path will start fresh on the next user message.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [group.id]);

  // Cancel any in-flight stream on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const applyFrame = useCallback((frame: SseFrame) => {
    if (frame.type === "started" || frame.type === "done") return;

    if (frame.type === "agent-error") {
      if (!frame.agentId) return;
      const agentId = frame.agentId;
      const errMsg = frame.error ?? "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          kind: "agent-error",
          id: `err-${agentId}-${Date.now()}`,
          agentId,
          error: errMsg,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    if (!frame.agentId || !frame.runId) return;
    const agentId = frame.agentId;
    const runId = frame.runId;
    const text = frame.text ?? "";
    const isFinal = frame.type === "final";

    setMessages((prev) => {
      const idx = prev.findIndex(
        (m) => m.kind === "assistant" && m.runId === runId,
      );
      if (idx === -1) {
        const next: AssistantMsg = {
          kind: "assistant",
          id: runId,
          agentId,
          runId,
          text,
          streaming: !isFinal,
          timestamp: Date.now(),
        };
        return [...prev, next];
      }
      const clone = prev.slice();
      const current = clone[idx] as AssistantMsg;
      clone[idx] = {
        ...current,
        text: text || current.text,
        streaming: !isFinal,
      };
      return clone;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || submitting) return;

      setError(null);
      setSubmitting(true);
      const userMsg: UserMsg = {
        kind: "user",
        id: `user-${Date.now()}`,
        text: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/groups/${group.id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) errMsg = data.error;
          } catch {
            // ignore — keep status-based message
          }
          throw new Error(errMsg);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const rawFrame = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            const dataLine = rawFrame
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const frame = JSON.parse(dataLine.slice(6)) as SseFrame;
              applyFrame(frame);
            } catch {
              // Malformed frame — ignore, keep reading.
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          // user navigated away or sent another message; not a real error
        } else {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: unknown }).message)
              : "Send failed";
          setError(msg);
        }
      } finally {
        setSubmitting(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [input, submitting, group.id, applyFrame],
  );

  const participantLabels = group.participantAgentIds.map(
    (aid) => agents[aid]?.name ?? aid,
  );

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{group.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {participantLabels.join(" · ")}
            </p>
          </div>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Group · {group.participantAgentIds.length}
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6 space-y-5">
          {messages.length === 0 && (
            <GroupEmptyState participantLabels={participantLabels} />
          )}
          {messages.map((m) => (
            <GroupMessageBubble key={m.id} msg={m} agents={agents} />
          ))}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border bg-background"
      >
        <div className="mx-auto max-w-3xl px-6 py-4 space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder={`Broadcast to ${participantLabels.length} agents… (Shift+Enter for newline)`}
              rows={3}
              className={cn(
                "flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none",
                "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
              disabled={submitting}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || submitting}
              className="shrink-0"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function GroupEmptyState({ participantLabels }: { participantLabels: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Broadcast to a group</p>
        <p className="text-xs text-muted-foreground">
          Your message will be sent to {participantLabels.length} agents:{" "}
          <span className="font-medium text-foreground">
            {participantLabels.join(", ")}
          </span>
        </p>
      </div>
    </div>
  );
}

function GroupMessageBubble({
  msg,
  agents,
}: {
  msg: GroupMessage;
  agents: AgentLookup;
}) {
  if (msg.kind === "user") {
    return (
      <div className="flex flex-row-reverse gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-4 w-4" />
        </div>
        <div className="flex flex-col items-end gap-1.5 max-w-[80%]">
          <div className="rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap break-words text-primary-foreground">
            {msg.text}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(msg.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  if (msg.kind === "agent-error") {
    const label = agents[msg.agentId]?.name ?? msg.agentId;
    return (
      <div className="flex justify-center">
        <div className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <span className="font-medium">{label}</span> failed: {msg.error}
        </div>
      </div>
    );
  }

  // Assistant
  const label = agents[msg.agentId]?.name ?? msg.agentId;
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-[80%]">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {label}
          </span>
          {msg.streaming && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        {msg.streaming && !msg.text ? (
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <StreamingDots />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm whitespace-pre-wrap break-words">
            {msg.text || "…"}
            {msg.streaming && msg.text && (
              <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-current align-middle opacity-70" />
            )}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground">
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
      <span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
        style={{ animationDelay: "120ms" }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
        style={{ animationDelay: "240ms" }}
      />
    </span>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
