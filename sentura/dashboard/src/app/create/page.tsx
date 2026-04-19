"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  Send,
  Sparkles,
  User,
  Wrench,
  WifiOff,
} from "lucide-react";
import { useGateway } from "@/lib/gateway";
import type {
  ChatEventPayload,
  ContentBlock,
  SessionSummary,
  TranscriptMessage,
} from "@/lib/gateway";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ConversationSidebar } from "./conversation-sidebar";

const CREATOR_AGENT_ID = "creator";
const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

/** Remembers the last selected conversation so reloads can restore context. */
const ACTIVE_KEY_STORAGE = "sentura.create.activeKey";
const DRAFT_STORAGE = "sentura.create.draftLabel";

/** Flatten a transcript message's content into plain text for display. */
function transcriptToText(content: TranscriptMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        b && typeof b === "object" && "type" in b && b.type === "text" &&
        typeof (b as ContentBlock).text === "string"
          ? ((b as ContentBlock).text as string)
          : "",
      )
      .join("");
  }
  if (content && typeof content === "object" && "text" in content) {
    const t = (content as ContentBlock).text;
    return typeof t === "string" ? t : "";
  }
  return "";
}

type ChatRole = "user" | "assistant" | "system";

type ProgressKind = "tool_start" | "tool_result" | "tool_error" | "stream";

/**
 * A single observable step the Creator agent took while producing a
 * response. Rendered in the hide-able "Progress" dropdown above the bubble.
 */
interface ProgressStep {
  id: string;
  kind: ProgressKind;
  label: string;
  detail?: string;
  timestamp: number;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Whether the assistant is still streaming content for this message. */
  streaming?: boolean;
  /** Observable run steps (tool calls, streaming snapshots). */
  progress?: ProgressStep[];
  timestamp: number;
}

/** Safe truncation for preview text in the progress dropdown. */
function truncate(value: string, max = 400): string {
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd() + "…";
}

/** Best-effort stringification for tool args / results of unknown shape. */
function formatDetail(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Session-tool event payload shape (subset we consume). */
interface SessionToolEvent {
  runId?: string;
  sessionKey?: string;
  stream?: string;
  ts?: number;
  data?: {
    phase?: "start" | "result" | "error" | string;
    name?: string;
    toolCallId?: string;
    args?: unknown;
    input?: unknown;
    result?: unknown;
    error?: unknown;
    message?: unknown;
  };
}

function extractTextFromContent(content: ChatEventPayload["message"]): string {
  if (!content) return "";
  if (typeof content.content === "string") return content.content;
  if (!Array.isArray(content.content)) return "";
  return content.content
    .map((block: ContentBlock) => {
      if (block.type === "text" && typeof block.text === "string") return block.text;
      return "";
    })
    .join("");
}

/**
 * Employee Creator page. Hosts multiple Creator-agent conversations (one per
 * employee creation flow) with a sidebar for navigation, plus rename and
 * delete support. The conversation list is sourced from the gateway
 * (`sessions.list { agentId: "creator" }`) so it stays consistent across
 * browsers and survives reloads.
 */
export default function CreateEmployeePage() {
  const { client, state } = useGateway();

  // --- Conversation list ---
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // --- Active conversation ---
  // `activeKey === null` combined with `draftLabel !== null` means the user is
  // authoring a new employee but hasn't sent the first message yet. Once they
  // send, we call sessions.create with the draft label and adopt the returned
  // key. `draftLabel === null && activeKey === null` means no selection.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  const [hasRestored, setHasRestored] = useState(false);

  // --- Chat state for the active conversation ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  activeKeyRef.current = activeKey;

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Persist active selection across reloads ---
  useEffect(() => {
    try {
      const savedKey = window.localStorage.getItem(ACTIVE_KEY_STORAGE);
      const savedDraft = window.localStorage.getItem(DRAFT_STORAGE);
      if (savedKey) {
        setActiveKey(savedKey);
      } else if (savedDraft) {
        setDraftLabel(savedDraft);
      }
    } catch {
      // localStorage unavailable (SSR / private mode). Ignore.
    } finally {
      setHasRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestored) return;
    try {
      if (activeKey) {
        window.localStorage.setItem(ACTIVE_KEY_STORAGE, activeKey);
        window.localStorage.removeItem(DRAFT_STORAGE);
      } else if (draftLabel !== null) {
        window.localStorage.removeItem(ACTIVE_KEY_STORAGE);
        window.localStorage.setItem(DRAFT_STORAGE, draftLabel);
      } else {
        window.localStorage.removeItem(ACTIVE_KEY_STORAGE);
        window.localStorage.removeItem(DRAFT_STORAGE);
      }
    } catch {
      // ignore
    }
  }, [activeKey, draftLabel, hasRestored]);

  // --- Load the conversation list ---
  const refreshSessions = useCallback(async () => {
    if (state !== "connected") return;
    setSessionsLoading(true);
    try {
      const list = await client.listSessions({ agentId: CREATOR_AGENT_ID });
      setSessions(list);
    } catch (err) {
      console.warn("[create] failed to list sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [client, state]);

  useEffect(() => {
    if (state !== "connected") return;
    void refreshSessions();
  }, [state, refreshSessions]);

  // If the restored activeKey no longer exists on the server (e.g. deleted
  // from another tab), drop it gracefully.
  useEffect(() => {
    if (!hasRestored) return;
    if (!activeKey) return;
    if (sessionsLoading) return;
    if (sessions.length === 0) return;
    const stillExists = sessions.some((s) => s.key === activeKey);
    if (!stillExists) {
      setActiveKey(null);
      setMessages([]);
    }
  }, [sessions, activeKey, sessionsLoading, hasRestored]);

  // --- Hydrate transcript whenever the active conversation changes ---
  useEffect(() => {
    if (state !== "connected") return;
    if (!activeKey) return;
    if (messages.length > 0) return;
    let cancelled = false;
    setHydrating(true);
    (async () => {
      try {
        const transcript = await client.getTranscript(activeKey);
        if (cancelled) return;
        const hydrated: ChatMessage[] = transcript
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m, idx) => ({
            id: `hydrated-${idx}-${m.role}`,
            role: m.role as ChatRole,
            text: transcriptToText(m.content),
            streaming: false,
            timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
          }))
          .filter((m) => m.text.trim().length > 0);
        setMessages(hydrated);
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? (err as { message: string }).message
            : "Unknown error";
        console.warn("[create] transcript hydration failed:", msg);
        // Session is gone; drop it and let the sidebar refresh clean up.
        setActiveKey(null);
        void refreshSessions();
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, state, activeKey, messages.length, refreshSessions]);

  // --- Subscribe to server-side session events ---
  // Without this, we only receive the broadcast `chat` text stream. Once
  // subscribed, the gateway also forwards `session.tool` and
  // `session.message` events so we can surface tool calls in the progress
  // dropdown.
  useEffect(() => {
    if (state !== "connected") return;
    let cancelled = false;
    (async () => {
      try {
        await client.subscribeSessions();
      } catch (err) {
        if (!cancelled) {
          console.warn("[create] sessions.subscribe failed:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, state]);

  // --- Subscribe to streaming chat events for the active conversation ---
  useEffect(() => {
    if (state !== "connected") return;
    const unsub = client.on("chat", (event) => {
      const payload = event.payload as unknown as ChatEventPayload | undefined;
      if (!payload) return;
      if (!activeKeyRef.current || payload.sessionKey !== activeKeyRef.current) {
        return;
      }

      const runId = payload.runId;
      const chatState = payload.state as unknown as string;
      const isFinal = chatState === "final";
      const isTerminal = isFinal || chatState === "aborted" || chatState === "error";
      const text =
        payload.message && payload.message.role === "assistant"
          ? extractTextFromContent(payload.message)
          : "";

      // Ignore deltas that don't carry an assistant message (e.g. tool-only
      // intermediate frames the gateway flushes). Tool events land via
      // session.tool instead.
      if (!isTerminal && !text) return;

      setMessages((prev) => {
        const existingIdx = prev.findIndex(
          (m) => m.role === "assistant" && m.id === runId,
        );

        if (existingIdx === -1) {
          // Drop empty terminal frames with no prior placeholder.
          if (isTerminal && !text) return prev;
          const next: ChatMessage = {
            id: runId,
            role: "assistant",
            text: isTerminal ? text : "",
            streaming: !isTerminal,
            progress: !isTerminal && text
              ? [
                  {
                    id: `stream-${runId}`,
                    kind: "stream",
                    label: "Composing response",
                    detail: truncate(text),
                    timestamp: Date.now(),
                  },
                ]
              : [],
            timestamp: payload.message?.timestamp ?? Date.now(),
          };
          return [...prev, next];
        }

        const clone = prev.slice();
        const current = clone[existingIdx];
        const progress = current.progress ? current.progress.slice() : [];

        if (isTerminal) {
          // Drop the transient "Composing response" step; the final text
          // now lives in the bubble.
          const filtered = progress.filter((p) => p.kind !== "stream");
          clone[existingIdx] = {
            ...current,
            text: text || current.text,
            streaming: false,
            progress: filtered,
          };
        } else {
          // Update (or insert) the rolling stream preview so the user can
          // expand the dropdown and watch the response form.
          const streamIdx = progress.findIndex((p) => p.kind === "stream");
          const step: ProgressStep = {
            id: `stream-${runId}`,
            kind: "stream",
            label: "Composing response",
            detail: truncate(text),
            timestamp: Date.now(),
          };
          if (streamIdx === -1) progress.push(step);
          else progress[streamIdx] = step;
          clone[existingIdx] = {
            ...current,
            // Keep the bubble showing three dots until the final frame; we
            // intentionally do NOT mirror partial text into `text`.
            text: current.text,
            streaming: true,
            progress,
          };
        }

        return clone;
      });
    });
    return unsub;
  }, [client, state]);

  // --- Tool-lifecycle events for the active conversation ---
  useEffect(() => {
    if (state !== "connected") return;
    const unsub = client.on("session.tool", (event) => {
      const payload = event.payload as unknown as SessionToolEvent | undefined;
      if (!payload) return;
      if (!activeKeyRef.current || payload.sessionKey !== activeKeyRef.current) {
        return;
      }
      const runId = payload.runId;
      if (!runId) return;
      const data = payload.data ?? {};
      const phase = typeof data.phase === "string" ? data.phase : "";
      const toolName = typeof data.name === "string" && data.name ? data.name : "tool";
      const toolCallId =
        typeof data.toolCallId === "string" ? data.toolCallId : `${toolName}-${Date.now()}`;

      let kind: ProgressKind;
      let label: string;
      let detail: string | undefined;
      if (phase === "start") {
        kind = "tool_start";
        label = `Calling ${toolName}`;
        const argDetail = formatDetail(data.args ?? data.input);
        detail = argDetail ? truncate(argDetail, 800) : undefined;
      } else if (phase === "result") {
        kind = "tool_result";
        label = `${toolName} returned`;
        const resultDetail = formatDetail(data.result ?? data.message);
        detail = resultDetail ? truncate(resultDetail, 800) : undefined;
      } else if (phase === "error") {
        kind = "tool_error";
        label = `${toolName} failed`;
        const errDetail = formatDetail(data.error ?? data.message);
        detail = errDetail ? truncate(errDetail, 800) : undefined;
      } else {
        return;
      }

      const step: ProgressStep = {
        id: `${kind}-${toolCallId}-${payload.ts ?? Date.now()}`,
        kind,
        label,
        detail,
        timestamp: payload.ts ?? Date.now(),
      };

      setMessages((prev) => {
        const existingIdx = prev.findIndex(
          (m) => m.role === "assistant" && m.id === runId,
        );
        if (existingIdx === -1) {
          // Tool event arrived before the first chat delta — seed a
          // placeholder so progress has somewhere to live.
          const placeholder: ChatMessage = {
            id: runId,
            role: "assistant",
            text: "",
            streaming: true,
            progress: [step],
            timestamp: step.timestamp,
          };
          return [...prev, placeholder];
        }
        const clone = prev.slice();
        const current = clone[existingIdx];
        const progress = current.progress ? current.progress.slice() : [];
        progress.push(step);
        clone[existingIdx] = { ...current, streaming: true, progress };
        return clone;
      });
    });
    return unsub;
  }, [client, state]);

  // --- Sidebar handlers ---

  const handleNewConversation = useCallback(() => {
    setActiveKey(null);
    setDraftLabel("New employee");
    setMessages([]);
    setInput("");
    setError(null);
  }, []);

  const handleSelectConversation = useCallback((key: string | null) => {
    setActiveKey(key);
    if (key !== null) {
      setDraftLabel(null);
    }
    setMessages([]);
    setInput("");
    setError(null);
  }, []);

  const handleRenameConversation = useCallback(
    async (key: string, newLabel: string) => {
      try {
        await client.patchSession(key, { label: newLabel });
        setSessions((prev) =>
          prev.map((s) => (s.key === key ? { ...s, label: newLabel } : s)),
        );
        // Reconcile with server to pick up any normalization.
        void refreshSessions();
      } catch (err) {
        console.warn("[create] rename failed:", err);
        setError(
          err && typeof err === "object" && "message" in err
            ? `Rename failed: ${(err as { message: string }).message}`
            : "Rename failed",
        );
      }
    },
    [client, refreshSessions],
  );

  const handleDeleteConversation = useCallback(
    async (key: string) => {
      try {
        await client.deleteSession(key, { deleteTranscript: true });
        setSessions((prev) => prev.filter((s) => s.key !== key));
        if (activeKeyRef.current === key) {
          setActiveKey(null);
          setMessages([]);
          setDraftLabel(null);
        }
        void refreshSessions();
      } catch (err) {
        console.warn("[create] delete failed:", err);
        setError(
          err && typeof err === "object" && "message" in err
            ? `Delete failed: ${(err as { message: string }).message}`
            : "Delete failed",
        );
      }
    },
    [client, refreshSessions],
  );

  // --- Composer ---

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || submitting || state !== "connected") return;

      setError(null);
      setSubmitting(true);

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      try {
        if (!activeKeyRef.current) {
          // First message of a new conversation — create the session with the
          // draft label (or a sensible default).
          const label = draftLabel?.trim() || "New employee";
          const result = await client.createSession(
            CREATOR_AGENT_ID,
            trimmed,
            { label },
          );
          if (!result?.key) {
            throw new Error("Gateway did not return a session key");
          }
          setActiveKey(result.key);
          activeKeyRef.current = result.key;
          setDraftLabel(null);
          // Update sidebar immediately with an optimistic row so the user
          // sees their new conversation without waiting for a round-trip.
          setSessions((prev) => [
            {
              key: result.key,
              agentId: CREATOR_AGENT_ID,
              label,
              updatedAt: Date.now(),
            },
            ...prev.filter((s) => s.key !== result.key),
          ]);
          void refreshSessions();
        } else {
          await client.sendChat(trimmed, activeKeyRef.current);
        }
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? (err as { message: string }).message
            : "Failed to send message";
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            role: "system",
            text: `Error: ${msg}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setSubmitting(false);
      }
    },
    [input, client, state, submitting, draftLabel, refreshSessions],
  );

  const disconnected = state === "disconnected" || state === "reconnecting";
  const suggestions = [
    "I need a Customer Support rep who answers billing questions using our Stripe + Zendesk data.",
    "Create a Sales Development Rep that qualifies leads from HubSpot and drafts outreach in Gmail.",
    "Build a Finance Analyst that reconciles QuickBooks transactions weekly and flags anomalies.",
  ];

  const activeSession =
    activeKey !== null ? sessions.find((s) => s.key === activeKey) : null;
  const headerTitle = activeSession?.label?.trim()
    ? activeSession.label
    : draftLabel !== null
      ? draftLabel || "New employee"
      : "Create Employee";

  const hasActiveConversation = activeKey !== null || draftLabel !== null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <ConversationSidebar
        sessions={sessions}
        activeKey={activeKey}
        draftLabel={draftLabel}
        loading={sessionsLoading}
        disabled={state !== "connected"}
        onNew={handleNewConversation}
        onSelect={handleSelectConversation}
        onRename={handleRenameConversation}
        onDelete={handleDeleteConversation}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/employees"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 min-w-0">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">{headerTitle}</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chat with the Creator Agent to design and deploy a new AI employee.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeKey && (
              <Badge variant="outline" className="font-mono text-[10px]">
                session: {activeKey.split(":").slice(-1)[0].slice(0, 8)}…
              </Badge>
            )}
            <a
              href={`${CONTROL_UI_URL}/#sessions`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open in Control UI
            </a>
          </div>
        </div>

        {disconnected && (
          <div className="border-b border-destructive/50 bg-destructive/5 px-6 py-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <WifiOff className="h-4 w-4" />
              Gateway disconnected. Messages will queue once the connection is restored.
            </div>
          </div>
        )}

        {/* Transcript */}
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto"
        >
          <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
            {!hasActiveConversation && (
              <WelcomeState onNew={handleNewConversation} />
            )}
            {hasActiveConversation && hydrating && messages.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Restoring conversation…
              </div>
            )}
            {hasActiveConversation && !hydrating && messages.length === 0 && (
              <EmptyState
                suggestions={suggestions}
                onPick={(s) => setInput(s)}
              />
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border bg-background"
        >
          <div className="mx-auto max-w-3xl px-6 py-4 space-y-2">
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
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
                placeholder={
                  !hasActiveConversation
                    ? "Click “New employee” on the left to start…"
                    : activeKey
                      ? "Continue the conversation… (Shift+Enter for newline)"
                      : "Describe the AI employee you want to create…"
                }
                rows={3}
                disabled={state !== "connected" || !hasActiveConversation}
                className={cn(
                  "flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none",
                  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              />
              <Button
                type="submit"
                size="sm"
                disabled={
                  !input.trim() ||
                  submitting ||
                  state !== "connected" ||
                  !hasActiveConversation
                }
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
            <p className="text-[10px] text-muted-foreground">
              The Creator Agent will design, incubate, and deploy the employee. High-risk
              actions (self-provisioning, credential capture) will require human approval.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function WelcomeState({ onNew }: { onNew: () => void }) {
  return (
    <Card>
      <CardContent className="py-10 space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Start a new employee</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Each AI employee gets its own conversation with the Creator Agent.
            Start a new one on the left, or pick an existing conversation to
            continue where you left off.
          </p>
          <Button className="mt-2" onClick={onNew}>
            <Sparkles className="h-4 w-4 mr-2" />
            New employee
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <Card>
      <CardContent className="py-8 space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Describe the employee you need</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            The Creator Agent will ask clarifying questions, propose a design
            (SOUL.md, AGENTS.md Hard Rules, BOOTSTRAP.md Enterprise Context,
            skills, channel bindings) and deploy once you approve.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Try one of these to get started:
          </p>
          <div className="grid grid-cols-1 gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                className="group text-left rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="text-muted-foreground">{s}</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {msg.text}
        </div>
      </div>
    );
  }

  const steps = msg.progress ?? [];
  const hasProgress = steps.length > 0;

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("flex flex-col gap-1.5 max-w-[80%]", isUser && "items-end")}>
        {!isUser && hasProgress && (
          <ProgressDropdown steps={steps} streaming={!!msg.streaming} />
        )}
        {msg.streaming && !msg.text ? (
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <StreamingDots />
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border",
            )}
          >
            {msg.text || "…"}
            {msg.streaming && msg.text && (
              <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-current align-middle opacity-70" />
            )}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

function ProgressDropdown({
  steps,
  streaming,
}: {
  steps: ProgressStep[];
  streaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  const latest = steps[steps.length - 1];
  const headline = streaming
    ? latest?.label ?? "Working…"
    : `Progress · ${steps.length} step${steps.length === 1 ? "" : "s"}`;

  return (
    <div className="w-full rounded-lg border border-border/70 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        {streaming ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
        ) : (
          <Check className="h-3 w-3 shrink-0 text-emerald-500" />
        )}
        <span className="truncate">{headline}</span>
        <span className="ml-auto tabular-nums text-[10px] text-muted-foreground/70">
          {steps.length}
        </span>
      </button>
      {open && (
        <ol className="flex flex-col gap-1.5 border-t border-border/60 px-2.5 py-2">
          {steps.map((step) => (
            <ProgressStepRow key={step.id} step={step} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ProgressStepRow({ step }: { step: ProgressStep }) {
  const [expanded, setExpanded] = useState(false);
  const Icon =
    step.kind === "tool_error"
      ? AlertTriangle
      : step.kind === "tool_result"
        ? Check
        : step.kind === "tool_start"
          ? Wrench
          : Sparkles;
  const iconClass =
    step.kind === "tool_error"
      ? "text-destructive"
      : step.kind === "tool_result"
        ? "text-emerald-500"
        : step.kind === "tool_start"
          ? "text-primary"
          : "text-muted-foreground";

  const hasDetail = !!step.detail;

  return (
    <li className="text-xs">
      <button
        type="button"
        disabled={!hasDetail}
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-start gap-2 text-left",
          hasDetail && "hover:text-foreground",
        )}
      >
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconClass)} />
        <span className="flex-1 break-words">{step.label}</span>
        <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/70">
          {new Date(step.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </button>
      {expanded && hasDetail && (
        <pre className="mt-1 ml-5 max-h-48 overflow-auto rounded bg-background/80 p-2 text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-words">
          {step.detail}
        </pre>
      )}
    </li>
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
