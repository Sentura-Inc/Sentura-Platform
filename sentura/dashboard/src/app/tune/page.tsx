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
  useAgents,
  useGateway,
  useGatewayEvents,
} from "@/lib/gateway";
import type { AgentConfig, SessionSummary } from "@/lib/gateway";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgentChat } from "@/components/agent-chat";
import { EmployeePickerDialog } from "@/app/chat/employee-picker-dialog";
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

  // Pull the deployable employee roster so operators can pick which agent
  // to tune. useAgents() already excludes meta-agents (creator/tuner/
  // orchestrator/mcp-builder/data-scavenger) via isMetaAgentId.
  const { data: agents, loading: agentsLoading } = useAgents();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  // Picker dialog visibility — opens when "+ New tuning" is clicked.
  // Replaces the deprecated header-dropdown TargetAgentPicker.
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeKey = searchParams.get("key");
  // `?agent=` is set when the operator picks a target through the dialog.
  // It only matters until the first send creates a session — once `?key=`
  // exists, the session itself owns the target context (via `label`), and
  // the resolved agent for header display comes from session-key parsing.
  const targetAgentId = searchParams.get("agent");

  // URL helper — write `?key=` (selected tuning conversation) and/or
  // `?agent=` (which employee the new tuning will target).
  const setUrlState = useCallback(
    (next: { key?: string | null; agent?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if ("key" in next) {
        if (next.key) params.set("key", next.key);
        else params.delete("key");
      }
      if ("agent" in next) {
        if (next.agent) params.set("agent", next.agent);
        else params.delete("agent");
      }
      const qs = params.toString();
      router.replace(qs ? `/tune?${qs}` : "/tune", { scroll: false });
    },
    [router, searchParams],
  );

  const setActiveKey = useCallback(
    (next: string | null) => setUrlState({ key: next }),
    [setUrlState],
  );

  // Resolved target agent — preferred sources, in order:
  //   1. `?agent=` URL param (set by the picker dialog before first send).
  //   2. Active session's label parsed for "Tuning <name>" then matched to
  //      an agent by display name. Survives page navigation: as long as
  //      the active session was created via the picker dialog, the label
  //      tells us which employee it targets even when `?agent=` is gone.
  const activeSession = useMemo(
    () => sessions.find((s) => s.key === activeKey),
    [sessions, activeKey],
  );
  const targetAgent: AgentConfig | undefined = useMemo(() => {
    if (!agents) return undefined;
    if (targetAgentId) return agents.find((a) => a.id === targetAgentId);
    const label = activeSession?.label?.trim() ?? "";
    const match = /^Tuning\s+(.+)$/i.exec(label);
    if (!match) return undefined;
    const name = match[1].trim();
    return agents.find((a) => a.name === name || a.id === name);
  }, [agents, targetAgentId, activeSession]);

  // Seed the AgentChat textarea with a `Tune <agentId>: ` prefix so the
  // Tuner LLM has unambiguous target context on first send. Only seeds
  // for fresh tuning conversations (no activeKey) so we don't clobber
  // the operator's continuation of an existing session.
  const initialPrompt =
    !activeKey && targetAgent ? `Tune ${targetAgent.id}: ` : undefined;

  // Label that AgentChat will pass to `sessions.create` on first send.
  // Sidebar reads `session.label` first when rendering the row, so this
  // is the single source of truth for "Tuning Penny" vs "Untitled tuning".
  const sessionLabel = useMemo(() => {
    if (activeKey) return undefined; // Existing session — don't relabel.
    if (!targetAgent) return undefined;
    const display = targetAgent.name?.trim() || targetAgent.id;
    return `Tuning ${display}`;
  }, [activeKey, targetAgent]);

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
  // Skip the prune while sessions are still loading on a fresh mount —
  // otherwise a transiently-empty list (state=connected but list pending)
  // would strip a perfectly valid `?key=` from the URL and the user would
  // see an empty AgentChat instead of their resumed transcript. This was
  // the cause of the 2026-05-04 "history not loading on return" report.
  useEffect(() => {
    if (!activeKey) return;
    if (sessionsLoading) return;
    if (sessions.length === 0) return;
    if (!sessions.some((s) => s.key === activeKey)) {
      setActiveKey(null);
    }
  }, [activeKey, sessions, sessionsLoading, setActiveKey]);

  const handleNewTuning = useCallback(() => {
    // Clear active session and open the picker. The dialog drives target
    // selection; URL state changes only after the user picks an employee.
    setUrlState({ key: null, agent: null });
    setPickerOpen(true);
  }, [setUrlState]);

  const handleAgentPicked = useCallback(
    (agentId: string) => {
      // No `?key=` yet — AgentChat will create the session on first send,
      // labeled "Tuning <Employee name>" via the `sessionLabel` prop.
      setUrlState({ key: null, agent: agentId });
    },
    [setUrlState],
  );

  const handleSelectConversation = useCallback(
    (key: string) => {
      // Selecting a past tuning drops `?agent=` so the active session's
      // label drives header / empty-state target rendering — avoids a
      // mismatch between the picker's stale `?agent=` and what the
      // session was actually opened against.
      setUrlState({ key, agent: null });
    },
    [setUrlState],
  );

  const handleSessionCreated = useCallback(
    (key: string) => {
      // Optimistically prepend so the new conversation appears in the
      // sidebar immediately; refresh reconciles with the server. We
      // include the optimistic label so the row reads "Tuning <name>"
      // until the gateway echo confirms it.
      const optimisticLabel = sessionLabel;
      setSessions((prev) => [
        {
          key,
          agentId: TUNER_AGENT_ID,
          updatedAt: Date.now(),
          ...(optimisticLabel ? { label: optimisticLabel } : {}),
        },
        ...prev.filter((s) => s.key !== key),
      ]);
      // Drop `?agent=` once the session exists — the session label is
      // now authoritative for the target.
      setUrlState({ key, agent: null });
      void refreshSessions();
    },
    [refreshSessions, setUrlState, sessionLabel],
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

  // Header title: derived from the resolved target agent. Falls back to
  // "Tune Employee" when the operator hasn't picked anyone yet.
  const headerTitle = targetAgent
    ? `Tuning ${targetAgent.name?.trim() || targetAgent.id}`
    : "Tune Employee";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <TuneSidebar
        sessions={sortedSessions}
        activeKey={activeKey}
        loading={sessionsLoading}
        disabled={state !== "connected"}
        onNew={handleNewTuning}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
      />

      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sliders className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight truncate">
                {headerTitle}
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
          initialPrompt={initialPrompt}
          sessionLabel={sessionLabel}
          onSessionCreated={handleSessionCreated}
          emptyState={<TuneEmptyState targetAgent={targetAgent} />}
        />
      </div>

      <EmployeePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handleAgentPicked}
        agents={agents ?? null}
        loading={agentsLoading ?? false}
        title="Pick an employee to tune"
        description="Choose which AI employee this tuning conversation is about. The session will be named 'Tuning {Employee name}' and the Tuner will scope its proposed changes to that employee only."
      />
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

const GENERIC_TUNER_SUGGESTIONS = [
  "Make {AGENT} more friendly in tone, but keep the read-only constraint.",
  "Add the meeting-notes skill to {AGENT} and bind it to the Slack #ap-team channel.",
  "Switch the model on {AGENT} to openai/gpt-5.4 and tighten the tools allow-list.",
  "Lower the approval threshold for refunds on {AGENT} from $500 to $200.",
];

function tunerSuggestionsFor(agentId: string | undefined): string[] {
  if (!agentId) return GENERIC_TUNER_SUGGESTIONS.map((s) => s.replace("{AGENT}", "<agent-id>"));
  return GENERIC_TUNER_SUGGESTIONS.map((s) => s.replace(/\{AGENT\}/g, agentId));
}

function TuneEmptyState({ targetAgent }: { targetAgent?: AgentConfig }) {
  const suggestions = tunerSuggestionsFor(targetAgent?.id);
  return (
    <Card>
      <CardContent className="py-8 space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">
            {targetAgent
              ? `What needs tuning on ${targetAgent.name ?? targetAgent.id}?`
              : "Pick an employee to tune"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {targetAgent ? (
              <>
                Describe the change in plain English. The Tuner will inspect{" "}
                <code className="font-mono text-xs">{targetAgent.id}</code>&apos;s
                config + workspace files, propose a diff, and wait for your
                approval before applying.
              </>
            ) : (
              <>
                Use the picker in the header above to choose which AI employee
                you want to tune. Once selected, the chat input will be seeded
                with the right target context.
              </>
            )}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {targetAgent
              ? `Common adjustments for ${targetAgent.id}:`
              : "Common adjustments (pick an employee first):"}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {suggestions.map((s) => (
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
