"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useGateway } from "@/lib/gateway";
import type { SessionSummary } from "@/lib/gateway";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgentChat, type AgentChatHandle } from "@/components/agent-chat";
import { usePermission } from "@/lib/auth/use-permission";
import { ConversationSidebar } from "./conversation-sidebar";

const CREATOR_AGENT_ID = "creator";
const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

/** Remembers the last selected conversation so reloads can restore context. */
const ACTIVE_KEY_STORAGE = "sentura.create.activeKey";
const DRAFT_STORAGE = "sentura.create.draftLabel";

/**
 * Employee Creator page. Hosts multiple Creator-agent conversations (one per
 * employee creation flow) with a sidebar for navigation, plus rename and
 * delete support. The conversation list is sourced from the gateway
 * (`sessions.list { agentId: "creator" }`) so it stays consistent across
 * browsers and survives reloads. The chat thread itself is delegated to the
 * shared `<AgentChat>` component (D2 contract).
 */
export default function CreateEmployeePage() {
  const { client, state } = useGateway();
  const { allowed: canCreate } = usePermission("agents.create");

  // --- Conversation list ---
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // --- Active conversation ---
  // `activeKey === null` combined with `draftLabel !== null` means the user is
  // authoring a new employee but hasn't sent the first message yet. Once they
  // send, AgentChat creates the session and fires onSessionCreated; we adopt
  // the returned key and patch the label in.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  const [hasRestored, setHasRestored] = useState(false);

  // Imperative handle into AgentChat — needed so the EmptyState's suggestion
  // pills can prefill the input box.
  const chatRef = useRef<AgentChatHandle | null>(null);

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
    }
  }, [sessions, activeKey, sessionsLoading, hasRestored]);

  // --- Sidebar handlers ---

  const handleNewConversation = useCallback(() => {
    setActiveKey(null);
    setDraftLabel("New employee");
  }, []);

  const handleSelectConversation = useCallback((key: string | null) => {
    setActiveKey(key);
    if (key !== null) setDraftLabel(null);
  }, []);

  const handleRenameConversation = useCallback(
    async (key: string, newLabel: string) => {
      try {
        await client.patchSession(key, { label: newLabel });
        setSessions((prev) =>
          prev.map((s) => (s.key === key ? { ...s, label: newLabel } : s)),
        );
        void refreshSessions();
      } catch (err) {
        console.warn("[create] rename failed:", err);
      }
    },
    [client, refreshSessions],
  );

  const handleDeleteConversation = useCallback(
    async (key: string) => {
      try {
        await client.deleteSession(key, { deleteTranscript: true });
        setSessions((prev) => prev.filter((s) => s.key !== key));
        if (activeKey === key) {
          setActiveKey(null);
          setDraftLabel(null);
        }
        void refreshSessions();
      } catch (err) {
        console.warn("[create] delete failed:", err);
      }
    },
    [client, refreshSessions, activeKey],
  );

  // Fired by AgentChat when it creates a session on the user's first send.
  // We adopt the new key, apply the user's draft label, and optimistically
  // update the sidebar so the new conversation appears without a round-trip.
  const handleSessionCreated = useCallback(
    (key: string) => {
      const label = draftLabel?.trim() || "New employee";
      setActiveKey(key);
      setDraftLabel(null);
      // Apply the label out-of-band — D2 keeps AgentChat's contract free of
      // session metadata so all 4 future consumers stay aligned.
      void client.patchSession(key, { label }).catch((err) => {
        console.warn("[create] patchSession label failed:", err);
      });
      setSessions((prev) => [
        {
          key,
          agentId: CREATOR_AGENT_ID,
          label,
          updatedAt: Date.now(),
        },
        ...prev.filter((s) => s.key !== key),
      ]);
      void refreshSessions();
    },
    [client, draftLabel, refreshSessions],
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

        {!hasActiveConversation ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
              <WelcomeState onNew={handleNewConversation} canCreate={canCreate} />
            </div>
          </div>
        ) : (
          <AgentChat
            ref={chatRef}
            agentId={CREATOR_AGENT_ID}
            sessionKey={activeKey ?? undefined}
            onSessionCreated={handleSessionCreated}
            emptyState={
              <EmptyState
                suggestions={suggestions}
                onPick={(s) => {
                  chatRef.current?.setInput(s);
                  chatRef.current?.focus();
                }}
              />
            }
          />
        )}
      </div>
    </div>
  );
}

function WelcomeState({
  onNew,
  canCreate,
}: {
  onNew: () => void;
  canCreate: boolean;
}) {
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
          <Button
            className="mt-2"
            onClick={onNew}
            disabled={!canCreate}
            title={!canCreate ? "You don't have permission to create employees" : undefined}
          >
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
