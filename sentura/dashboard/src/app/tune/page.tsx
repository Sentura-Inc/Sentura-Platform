"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  Sliders,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  useGateway,
  useGatewayEvents,
} from "@/lib/gateway";
import type { SessionSummary } from "@/lib/gateway";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgentChat } from "@/components/agent-chat";
import { cn } from "@/lib/utils";

const TUNER_AGENT_ID = "tuner";
const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

/**
 * `/tune` — Live Tuning UI for the Refine (Tuner) meta-agent.
 *
 * Single-agent surface (only the Tuner is targetable here), so simpler
 * than `/chat`: no employee picker, no group-by-agent in the sidebar,
 * no draft-agent state. URL `?key=<sessionKey>` is the source of truth
 * for the active tuning conversation; "+ New tuning" clears it and
 * AgentChat handles the undefined-→-defined transition on first send.
 *
 * Per Week 4 D1 (chat-only MVP): no inline diff panel today. The Tuner
 * shows changes verbally and requests approval via /approvals where the
 * existing exec.approval.requested payload renders the diff. Inline diff
 * panel deferred to W6-8 polish once Tuner emits a "pending change"
 * event subtype the dashboard can intercept.
 */
export default function TunePage() {
  // useSearchParams() inside the inner component opts the route into
  // CSR. Wrapping it in <Suspense> here lets Next.js prerender the
  // outer shell. Mirrors the /chat/page.tsx pattern.
  return (
    <Suspense fallback={null}>
      <TunePageInner />
    </Suspense>
  );
}

function TunePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { client, state } = useGateway();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const activeKey = searchParams.get("key");

  // URL helper — tuning surface only writes the `key` param.
  const setActiveKey = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("key", next);
      else params.delete("key");
      const qs = params.toString();
      router.replace(qs ? `/tune?${qs}` : "/tune", { scroll: false });
    },
    [router, searchParams],
  );

  // Fetch only Tuner sessions — `sessions.list` accepts an agentId filter.
  const refreshSessions = useCallback(async () => {
    if (state !== "connected") return;
    setSessionsLoading(true);
    try {
      const list = await client.listSessions({ agentId: TUNER_AGENT_ID });
      setSessions(list);
    } catch (err) {
      console.warn("[tune] failed to list sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [client, state]);

  useEffect(() => {
    if (state !== "connected") return;
    void refreshSessions();
  }, [state, refreshSessions]);

  useGatewayEvents({
    "sessions.changed": () => {
      void refreshSessions();
    },
  });

  // If the URL key references a session that no longer exists, drop it.
  useEffect(() => {
    if (!activeKey) return;
    if (sessionsLoading) return;
    if (sessions.length === 0) return;
    if (!sessions.some((s) => s.key === activeKey)) {
      setActiveKey(null);
    }
  }, [activeKey, sessions, sessionsLoading, setActiveKey]);

  const handleNewTuning = useCallback(() => {
    setActiveKey(null);
  }, [setActiveKey]);

  const handleSelectConversation = useCallback(
    (key: string) => {
      setActiveKey(key);
    },
    [setActiveKey],
  );

  const handleSessionCreated = useCallback(
    (key: string) => {
      // Optimistically prepend so the new conversation appears in the
      // sidebar immediately; refresh reconciles with the server.
      setSessions((prev) => [
        { key, agentId: TUNER_AGENT_ID, updatedAt: Date.now() },
        ...prev.filter((s) => s.key !== key),
      ]);
      setActiveKey(key);
      void refreshSessions();
    },
    [refreshSessions, setActiveKey],
  );

  const handleDeleteConversation = useCallback(
    async (key: string) => {
      try {
        await client.deleteSession(key, { deleteTranscript: true });
        setSessions((prev) => prev.filter((s) => s.key !== key));
        if (activeKey === key) setActiveKey(null);
        void refreshSessions();
      } catch (err) {
        console.warn("[tune] delete failed:", err);
      }
    },
    [client, activeKey, refreshSessions, setActiveKey],
  );

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions],
  );

  const disconnected = state === "disconnected" || state === "reconnecting";

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <TuneSidebar
        sessions={sortedSessions}
        activeKey={activeKey}
        loading={sessionsLoading}
        disabled={state !== "connected"}
        onNew={handleNewTuning}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sliders className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight truncate">
                Tune Employee
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Adjust deployed AI employees through natural language.
                The Tuner shows changes for approval before applying.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
              Gateway disconnected. The Tuner cannot apply changes until the
              connection is restored.
            </div>
          </div>
        )}

        <AgentChat
          agentId={TUNER_AGENT_ID}
          sessionKey={activeKey ?? undefined}
          onSessionCreated={handleSessionCreated}
          emptyState={<TuneEmptyState />}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Sidebar — flat list, sorted by lastActive (no grouping; all Tuner sessions)
// =============================================================================

interface TuneSidebarProps {
  sessions: SessionSummary[];
  activeKey: string | null;
  loading: boolean;
  disabled?: boolean;
  onNew: () => void;
  onSelect: (key: string) => void;
  onDelete: (key: string) => Promise<void> | void;
}

function TuneSidebar({
  sessions,
  activeKey,
  loading,
  disabled,
  onNew,
  onSelect,
  onDelete,
}: TuneSidebarProps) {
  const [busy, setBusy] = useState(false);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="border-b border-border p-3">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="w-full justify-start"
          onClick={onNew}
          disabled={disabled}
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          New tuning
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && sessions.length === 0 && (
          <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading tunings…
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">
            No tuning conversations yet. Click{" "}
            <span className="font-medium text-foreground">New tuning</span>{" "}
            to start one.
          </div>
        )}

        <ul className="space-y-1">
          {sessions.map((session) => (
            <TuneRow
              key={session.key}
              session={session}
              isActive={session.key === activeKey}
              busy={busy}
              onSelect={() => onSelect(session.key)}
              onDelete={async () => {
                setBusy(true);
                try {
                  await onDelete(session.key);
                } finally {
                  setBusy(false);
                }
              }}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}

function TuneRow({
  session,
  isActive,
  busy,
  onSelect,
  onDelete,
}: {
  session: SessionSummary;
  isActive: boolean;
  busy: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const label =
    session.label?.trim() ||
    session.displayName?.trim() ||
    session.derivedTitle?.trim() ||
    "Untitled tuning";
  const updatedAt = session.updatedAt;

  return (
    <li>
      <div
        className={cn(
          "group relative flex flex-col gap-0.5 rounded-md px-2 py-2 text-sm cursor-pointer",
          isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
        )}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-1 truncate font-medium">{label}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={busy}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {updatedAt && (
          <div className="text-[11px] text-muted-foreground">
            {formatRelative(updatedAt)}
          </div>
        )}
      </div>
    </li>
  );
}

function formatRelative(updatedAt: number): string {
  const diff = Date.now() - updatedAt;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(updatedAt).toLocaleDateString();
}

// =============================================================================
// Empty state — Tuner-specific suggestion pills
// =============================================================================

const TUNER_SUGGESTIONS = [
  "Make billing-support-rep more friendly in tone, but keep the read-only constraint.",
  "Add the meeting-notes skill to penny-ap and bind it to the Slack #ap-team channel.",
  "Switch the model on creator to openai/gpt-5.4 and tighten the tools allow-list to design tools only.",
  "Lower the approval threshold for refunds on billing-support-rep from $500 to $200.",
];

function TuneEmptyState() {
  return (
    <Card>
      <CardContent className="py-8 space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">What needs tuning?</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Describe the change in plain English. The Tuner will inspect the
            target employee&apos;s config + workspace files, propose a diff,
            and wait for your approval before applying.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Common adjustments:
          </p>
          <div className="grid grid-cols-1 gap-2">
            {TUNER_SUGGESTIONS.map((s) => (
              <div
                key={s}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
              >
                {s}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Tip: include the target employee&apos;s ID (e.g.{" "}
            <code className="font-mono">billing-support-rep</code>) so the
            Tuner doesn&apos;t have to ask which one.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
