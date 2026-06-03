"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
  User,
  Wrench,
} from "lucide-react";
import { useGateway } from "@/lib/gateway";
import type {
  ChatEventPayload,
  ContentBlock,
  TranscriptMessage,
} from "@/lib/gateway";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// =============================================================================
// Public types — exported for callers and side-effect hooks (onMessage, etc).
// =============================================================================

export type ChatRole = "user" | "assistant" | "system";

export type ProgressKind = "tool_start" | "tool_result" | "tool_error" | "stream";

/**
 * A single observable step the agent took while producing a response.
 * Rendered in the hide-able "Progress" dropdown above each assistant bubble.
 */
export interface ProgressStep {
  id: string;
  kind: ProgressKind;
  label: string;
  detail?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Whether the assistant is still streaming content for this message. */
  streaming?: boolean;
  /** Observable run steps (tool calls, streaming snapshots). */
  progress?: ProgressStep[];
  timestamp: number;
}

/** Minimal tool-call event surface exposed to caller's onToolCall hook. */
export interface ToolCallEvent {
  runId: string;
  sessionKey: string;
  phase: "start" | "result" | "error";
  toolName: string;
  toolCallId: string;
  args?: unknown;
  result?: unknown;
  error?: unknown;
  timestamp: number;
}

export interface AgentChatProps {
  /** ID of the agent this chat targets. Stable for the lifetime of the
   * component — switching agents requires unmounting and remounting. */
  agentId: string;
  /** Existing session key to resume. If omitted, AgentChat creates a new
   * session on the first user message and fires `onSessionCreated`. */
  sessionKey?: string;
  /** Optional prefilled draft for the input box on mount. */
  initialPrompt?: string;
  /** Optional label for the new session created on first send. The label
   * shows in the sidebar and OpenClaw Control UI — without it sessions
   * read as "Untitled". /tune passes "Tuning {Employee name}". */
  sessionLabel?: string;
  /**
   * Fired with the new session key after AgentChat creates a session on
   * first send. Caller should adopt the key into its own state so subsequent
   * renders pass it back as `sessionKey` (otherwise AgentChat may try to
   * create another session).
   */
  onSessionCreated?: (sessionKey: string) => void;
  /** Fired for every message AgentChat appends to its own transcript
   * (user messages on submit, assistant messages on terminal stream frame). */
  onMessage?: (message: ChatMessage) => void;
  /** Fired for each tool-lifecycle event observed during a run. */
  onToolCall?: (event: ToolCallEvent) => void;
  /** Hide technical seed messages from the visible transcript. */
  hiddenUserPrefixes?: string[];
  /** Custom UI to render when the conversation has no messages yet. */
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Imperative handle exposed via `ref`. Use sparingly — prefer the prop-based
 * API where possible. Required for cases where the parent's `emptyState` UI
 * needs to write into the input box (e.g. "click a suggestion to prefill").
 */
export interface AgentChatHandle {
  setInput: (text: string) => void;
  focus: () => void;
  clearInput: () => void;
  sendMessage: (text: string) => Promise<void>;
}

// =============================================================================
// Helpers
// =============================================================================

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

function isHiddenUserMessage(
  role: ChatRole,
  text: string,
  prefixes: readonly string[] | undefined,
): boolean {
  if (role !== "user") return false;
  if (!prefixes || prefixes.length === 0) return false;
  const trimmed = text.trimStart();
  return prefixes.some((prefix) => prefix && trimmed.startsWith(prefix));
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

// =============================================================================
// AgentChat — main component
// =============================================================================

export const AgentChat = forwardRef<AgentChatHandle, AgentChatProps>(
  function AgentChat(props, ref) {
    const {
      agentId,
      sessionKey,
      initialPrompt,
      sessionLabel,
      onSessionCreated,
      onMessage,
      onToolCall,
      hiddenUserPrefixes,
      emptyState,
      className,
    } = props;
    // Stable ref so the submit handler reads the latest label without
    // resubscribing the entire send closure on every parent render.
    const sessionLabelRef = useRef(sessionLabel);
    useEffect(() => {
      sessionLabelRef.current = sessionLabel;
    }, [sessionLabel]);

    const { client, state } = useGateway();

    // Stable refs to caller-provided callbacks so subscriber effects don't
    // resubscribe when the parent passes new closures every render.
    const onSessionCreatedRef = useRef(onSessionCreated);
    const onMessageRef = useRef(onMessage);
    const onToolCallRef = useRef(onToolCall);
    const hiddenUserPrefixesRef = useRef(hiddenUserPrefixes);
    useEffect(() => {
      onSessionCreatedRef.current = onSessionCreated;
      onMessageRef.current = onMessage;
      onToolCallRef.current = onToolCall;
      hiddenUserPrefixesRef.current = hiddenUserPrefixes;
    });

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState(initialPrompt ?? "");
    const [submitting, setSubmitting] = useState(false);
    const [hydrating, setHydrating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const transcriptRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // sessionKey may change between renders (parent adopts a new key after
    // onSessionCreated fires). Mirror into a ref so chat subscribers always
    // filter on the current value without re-subscribing.
    const sessionKeyRef = useRef<string | undefined>(sessionKey);
    useEffect(() => {
      sessionKeyRef.current = sessionKey;
    });

    // Auto-scroll to bottom on new content unless the user scrolled up
    // recently. We track this via a userScrolledUpRef sentinel updated on
    // wheel/touch.
    const userScrolledUpRef = useRef(false);
    useEffect(() => {
      const el = transcriptRef.current;
      if (!el) return;
      const onScroll = () => {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        userScrolledUpRef.current = distanceFromBottom > 80;
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

    // Combined reset + hydrate effect, with one important wrinkle: the
    // `undefined → defined` sessionKey transition happens when AgentChat
    // creates a session on first send and the parent adopts the new key.
    // At that moment our local state already has the user's first message
    // and a streaming assistant placeholder — clearing or re-fetching from
    // the server transcript would race against the in-flight stream and
    // wipe out the optimistic state. Detect that transition via a prev-key
    // ref and skip both the clear and the fetch.
    const prevSessionKeyRef = useRef<string | undefined>(sessionKey);
    useEffect(() => {
      if (state !== "connected") return;
      const prev = prevSessionKeyRef.current;
      prevSessionKeyRef.current = sessionKey;
      if (prev === undefined && sessionKey !== undefined) {
        // Just-created session — preserve optimistic state, server stream
        // will fill in the rest.
        return;
      }

      setMessages([]);
      setError(null);
      userScrolledUpRef.current = false;

      if (!sessionKey) return;

      let cancelled = false;
      setHydrating(true);
      (async () => {
        // Retry-on-startup: when the dashboard's WebSocket reconnects faster
        // than the gateway's plugin handshake completes, `chat.history` returns
        // `UNAVAILABLE: chat.history unavailable during gateway startup`. The
        // pre-2026-05-04 build caught the error and never retried, leaving the
        // /tune (and /chat) transcript empty until the user manually clicked
        // away and back. Retry with exponential backoff covers the entire
        // typical plugin-load window (~3-8 seconds in dev, longer with cold
        // node_modules).
        const MAX_RETRIES = 5;
        const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];
        let lastError: unknown = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (cancelled) return;
          try {
            const transcript = await client.getTranscript(sessionKey);
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
              .filter((m) => m.text.trim().length > 0)
              .filter(
                (m) =>
                  !isHiddenUserMessage(
                    m.role,
                    m.text,
                    hiddenUserPrefixesRef.current,
                  ),
              );
            setMessages(hydrated);
            lastError = null;
            break;
          } catch (err: unknown) {
            lastError = err;
            const msg =
              err && typeof err === "object" && "message" in err
                ? String((err as { message: unknown }).message)
                : "";
            const isStartup =
              /unavailable during gateway startup/i.test(msg) ||
              /UNAVAILABLE/.test(msg);
            if (!isStartup || attempt === MAX_RETRIES - 1) break;
            await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
          }
        }
        if (lastError && !cancelled) {
          const msg =
            lastError && typeof lastError === "object" && "message" in lastError
              ? (lastError as { message: string }).message
              : "Unknown error";
          console.warn("[agent-chat] transcript hydration failed:", msg);
          setError(`Could not load transcript: ${msg}`);
        }
        if (!cancelled) setHydrating(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [client, state, sessionKey]);

    // Subscribe to server-side session events so we receive `session.tool`
    // and `session.message` events alongside the broadcast `chat` stream.
    useEffect(() => {
      if (state !== "connected") return;
      let cancelled = false;
      (async () => {
        try {
          await client.subscribeSessions();
        } catch (err) {
          if (!cancelled) {
            console.warn("[agent-chat] sessions.subscribe failed:", err);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [client, state]);

    // Streaming chat events — accumulate deltas into the active message,
    // commit on `state: "final"`.
    useEffect(() => {
      if (state !== "connected") return;
      const unsub = client.on("chat", (event) => {
        const payload = event.payload as unknown as ChatEventPayload | undefined;
        if (!payload) return;
        if (!sessionKeyRef.current || payload.sessionKey !== sessionKeyRef.current) {
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

        // Ignore deltas with no assistant content (tool-only intermediate
        // frames the gateway flushes — those land via session.tool).
        if (!isTerminal && !text) return;

        setMessages((prev) => {
          const existingIdx = prev.findIndex(
            (m) => m.role === "assistant" && m.id === runId,
          );

          if (existingIdx === -1) {
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
            if (isTerminal) onMessageRef.current?.(next);
            return [...prev, next];
          }

          const clone = prev.slice();
          const current = clone[existingIdx];
          const progress = current.progress ? current.progress.slice() : [];

          if (isTerminal) {
            const filtered = progress.filter((p) => p.kind !== "stream");
            const finalized: ChatMessage = {
              ...current,
              text: text || current.text,
              streaming: false,
              progress: filtered,
            };
            clone[existingIdx] = finalized;
            onMessageRef.current?.(finalized);
          } else {
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

    // Tool-lifecycle events for the active conversation.
    useEffect(() => {
      if (state !== "connected") return;
      const unsub = client.on("session.tool", (event) => {
        const payload = event.payload as unknown as SessionToolEvent | undefined;
        if (!payload) return;
        if (!sessionKeyRef.current || payload.sessionKey !== sessionKeyRef.current) {
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

        // Notify caller (audit logging, analytics, etc.)
        if (phase === "start" || phase === "result" || phase === "error") {
          onToolCallRef.current?.({
            runId,
            sessionKey: sessionKeyRef.current!,
            phase,
            toolName,
            toolCallId,
            args: data.args ?? data.input,
            result: data.result,
            error: data.error,
            timestamp: step.timestamp,
          });
        }

        setMessages((prev) => {
          const existingIdx = prev.findIndex(
            (m) => m.role === "assistant" && m.id === runId,
          );
          if (existingIdx === -1) {
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

    const sendText = useCallback(
      async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || submitting || state !== "connected") return;

        setError(null);
        setSubmitting(true);

        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          text: trimmed,
          timestamp: Date.now(),
        };
        if (
          !isHiddenUserMessage(
            userMessage.role,
            userMessage.text,
            hiddenUserPrefixesRef.current,
          )
        ) {
          setMessages((prev) => [...prev, userMessage]);
          onMessageRef.current?.(userMessage);
        }
        setInput((current) => (current.trim() === trimmed ? "" : current));

        try {
          if (!sessionKeyRef.current) {
            // First message of a new conversation — create the session.
            const label = sessionLabelRef.current?.trim();
            const result = await client.createSession(
              agentId,
              trimmed,
              label ? { label } : undefined,
            );
            if (!result?.key) {
              throw new Error("Gateway did not return a session key");
            }
            sessionKeyRef.current = result.key;
            onSessionCreatedRef.current?.(result.key);
          } else {
            await client.sendChat(trimmed, sessionKeyRef.current);
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
      [client, state, submitting, agentId],
    );

    // Imperative handle for the parent (e.g. suggestion buttons).
    useImperativeHandle(
      ref,
      () => ({
        setInput: (text) => setInput(text),
        focus: () => textareaRef.current?.focus(),
        clearInput: () => setInput(""),
        sendMessage: (text) => sendText(text),
      }),
      [sendText],
    );

    // Composer submit handler.
    const handleSubmit = useCallback(
      async (e?: React.FormEvent) => {
        e?.preventDefault();
        await sendText(input);
      },
      [input, sendText],
    );

    // Show emptyState whenever we have no messages and aren't currently
    // restoring a transcript — true for both "draft mode" (sessionKey
    // undefined, awaiting first user send) and "resumed empty session"
    // (sessionKey defined, server transcript came back empty). The earlier
    // `sessionKey !== undefined` guard was wrong: it silently hid the pills
    // exactly in the case (new conversation) where they're most needed.
    const showEmptyState =
      !hydrating &&
      messages.length === 0 &&
      emptyState !== undefined;

    return (
      <div className={cn("flex flex-1 flex-col min-w-0 min-h-0", className)}>
        {/* Transcript */}
        <div ref={transcriptRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
            {hydrating && messages.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Restoring conversation…
              </div>
            )}
            {showEmptyState && emptyState}
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
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder={
                  sessionKey
                    ? "Continue the conversation… (Shift+Enter for newline)"
                    : "Type a message to start…"
                }
                rows={3}
                disabled={state !== "connected"}
                className={cn(
                  "flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none",
                  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || submitting || state !== "connected"}
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
  },
);

// =============================================================================
// Presentational subcomponents
// =============================================================================

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
