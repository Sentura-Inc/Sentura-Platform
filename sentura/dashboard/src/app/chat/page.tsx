"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, ExternalLink, MessageSquare, WifiOff } from "lucide-react";
import {
  getSessionAgentId,
  useAgents,
  useGateway,
  useGatewayEvents,
} from "@/lib/gateway";
import type { SessionSummary } from "@/lib/gateway";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgentChat, type AgentChatHandle } from "@/components/agent-chat";
import { GroupChat } from "@/components/group-chat";
import { useAgentRosterStore } from "@/stores/use-agent-roster";
import { ChatSidebar } from "./chat-sidebar";
import { EmployeePickerDialog } from "./employee-picker-dialog";
import { GroupPickerDialog } from "./group-picker-dialog";
import type { GroupRecord } from "@/lib/groups/types";

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

/**
 * `/chat` — 1:1 conversation surface.
 *
 * Architecture:
 * - URL query param `?key=<sessionKey>` is the source of truth for which
 *   conversation is active (refresh-resilient, multi-tab independent).
 * - Sessions are fetched globally (no per-user filter — single-tenant dev)
 *   and grouped by agentId in the sidebar.
 * - "New chat" opens the employee picker; picking an agent enters draft
 *   mode (no session created until first send, matching /create's pattern).
 * - The thread pane mounts `<AgentChat>` (D2 contract); session creation
 *   on first send fires `onSessionCreated`, which adopts the new key into
 *   the URL.
 */
export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { client, state } = useGateway();

  // --- Roster (mirrors useAgents into the global store as a side effect
  // so /chat is self-sufficient even if user lands here before /employees) ---
  const { data: agents } = useAgents();
  const setRosterAgents = useAgentRosterStore((s) => s.setAgents);
  const rosterAgents = useAgentRosterStore((s) => s.agents);
  useEffect(() => {
    if (agents) setRosterAgents(agents);
  }, [agents, setRosterAgents]);

  // --- Sessions list ---
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // --- Active conversation (URL-driven) ---
  const activeKey = searchParams.get("key");
  const draftAgentId = searchParams.get("draft");
  const activeGroupId = searchParams.get("groupKey");

  // --- Picker dialogs ---
  const [pickerOpen, setPickerOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  // --- Groups list (loaded once on mount + after creation) ---
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const refreshGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      if (!res.ok) return;
      const data = (await res.json()) as { groups?: GroupRecord[] };
      setGroups(data.groups ?? []);
    } catch (err) {
      console.warn("[chat] failed to list groups:", err);
    } finally {
      setGroupsLoaded(true);
    }
  }, []);
  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  // Imperative handle into AgentChat (no use today but reserved for future
  // suggestion-pill EmptyState).
  const chatRef = useRef<AgentChatHandle | null>(null);

  // --- URL helpers ---
  const setUrlState = useCallback(
    (next: {
      key?: string | null;
      draft?: string | null;
      groupKey?: string | null;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      if ("key" in next) {
        if (next.key) params.set("key", next.key);
        else params.delete("key");
      }
      if ("draft" in next) {
        if (next.draft) params.set("draft", next.draft);
        else params.delete("draft");
      }
      if ("groupKey" in next) {
        if (next.groupKey) params.set("groupKey", next.groupKey);
        else params.delete("groupKey");
      }
      const qs = params.toString();
      router.replace(qs ? `/chat?${qs}` : "/chat", { scroll: false });
    },
    [router, searchParams],
  );

  // --- Load sessions ---
  const refreshSessions = useCallback(async () => {
    if (state !== "connected") return;
    setSessionsLoading(true);
    try {
      const list = await client.listSessions();
      setSessions(list);
    } catch (err) {
      console.warn("[chat] failed to list sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [client, state]);

  useEffect(() => {
    if (state !== "connected") return;
    void refreshSessions();
  }, [state, refreshSessions]);

  // Live session updates — re-fetch list on any session.message event so
  // last-activity sort stays accurate. `sessions.changed` (when emitted by
  // the gateway) covers create/delete/rename without needing a poll.
  useGatewayEvents({
    "session.message": () => {
      void refreshSessions();
    },
    "sessions.changed": () => {
      void refreshSessions();
    },
  });

  // If the URL key references a session that doesn't exist server-side
  // (e.g. deleted from another tab), drop it gracefully rather than
  // showing a permanent loading spinner in the thread pane.
  useEffect(() => {
    if (!activeKey) return;
    if (sessionsLoading) return;
    if (sessions.length === 0) return;
    const stillExists = sessions.some((s) => s.key === activeKey);
    if (!stillExists) {
      setUrlState({ key: null });
    }
  }, [activeKey, sessions, sessionsLoading, setUrlState]);

  // Same idea for groupKey — drop stale URL state after the groups list
  // has loaded at least once and the referenced id isn't present.
  useEffect(() => {
    if (!activeGroupId) return;
    if (!groupsLoaded) return;
    const stillExists = groups.some((g) => g.id === activeGroupId);
    if (!stillExists) {
      setUrlState({ groupKey: null });
    }
  }, [activeGroupId, groups, groupsLoaded, setUrlState]);

  // --- Handlers ---

  const handleOpenPicker = useCallback(() => setPickerOpen(true), []);
  const handleOpenGroupPicker = useCallback(
    () => setGroupPickerOpen(true),
    [],
  );

  const handlePickAgent = useCallback(
    (agentId: string) => {
      setUrlState({ key: null, draft: agentId, groupKey: null });
    },
    [setUrlState],
  );

  const handleSelectConversation = useCallback(
    (key: string) => {
      setUrlState({ key, draft: null, groupKey: null });
    },
    [setUrlState],
  );

  const handleSelectDraft = useCallback(() => {
    setUrlState({ key: null, groupKey: null });
  }, [setUrlState]);

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      setUrlState({ key: null, draft: null, groupKey: groupId });
    },
    [setUrlState],
  );

  const handleGroupCreated = useCallback(
    (group: GroupRecord) => {
      setGroups((prev) => [
        group,
        ...prev.filter((g) => g.id !== group.id),
      ]);
      setUrlState({ key: null, draft: null, groupKey: group.id });
    },
    [setUrlState],
  );

  const handleDeleteConversation = useCallback(
    async (key: string) => {
      try {
        await client.deleteSession(key, { deleteTranscript: true });
        setSessions((prev) => prev.filter((s) => s.key !== key));
        if (activeKey === key) {
          setUrlState({ key: null });
        }
        void refreshSessions();
      } catch (err) {
        console.warn("[chat] delete failed:", err);
      }
    },
    [client, activeKey, refreshSessions, setUrlState],
  );

  const handleSessionCreated = useCallback(
    (key: string) => {
      // Adopt the newly-created session into the URL and exit draft mode.
      // Optimistically prepend to the sidebar so the new conversation
      // appears immediately; refresh reconciles with the server.
      const agentId = draftAgentId ?? "unknown";
      setSessions((prev) => [
        {
          key,
          agentId,
          updatedAt: Date.now(),
        },
        ...prev.filter((s) => s.key !== key),
      ]);
      setUrlState({ key, draft: null });
      void refreshSessions();
    },
    [draftAgentId, refreshSessions, setUrlState],
  );

  // --- Derived state ---

  const activeSession = useMemo(
    () =>
      activeKey !== null ? sessions.find((s) => s.key === activeKey) : null,
    [activeKey, sessions],
  );

  // The agent the right pane is targeting:
  // - If active session exists, derive agentId from key (or schema fallback)
  // - Else if in draft mode, use draftAgentId
  // - Else null (show "no chat selected" state)
  const targetAgentId =
    (activeSession ? getSessionAgentId(activeSession) : null) ??
    (draftAgentId !== null ? draftAgentId : null);

  const targetAgent =
    targetAgentId !== null
      ? rosterAgents.find((a) => a.id === targetAgentId) ??
        agents?.find((a) => a.id === targetAgentId)
      : undefined;

  const activeGroup =
    activeGroupId !== null
      ? groups.find((g) => g.id === activeGroupId) ?? null
      : null;

  const agentLookup = useMemo(() => {
    const map: Record<string, typeof rosterAgents[number] | undefined> = {};
    const source = rosterAgents.length > 0 ? rosterAgents : agents ?? [];
    for (const a of source) map[a.id] = a;
    return map;
  }, [rosterAgents, agents]);

  const headerTitle = activeGroup
    ? activeGroup.name
    : activeSession?.label?.trim()
      ? activeSession.label
      : targetAgent?.name ?? targetAgentId ?? "Chat";

  const disconnected = state === "disconnected" || state === "reconnecting";
  const hasSomethingToShow =
    activeKey !== null || draftAgentId !== null || activeGroupId !== null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <ChatSidebar
        sessions={sessions}
        agents={rosterAgents.length > 0 ? rosterAgents : agents ?? []}
        groups={groups}
        activeKey={activeKey}
        activeGroupId={activeGroupId}
        draftAgentId={draftAgentId}
        loading={sessionsLoading}
        disabled={state !== "connected"}
        onNew={handleOpenPicker}
        onNewGroup={handleOpenGroupPicker}
        onSelect={handleSelectConversation}
        onSelectGroup={handleSelectGroup}
        onSelectDraft={handleSelectDraft}
        onDelete={handleDeleteConversation}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              {hasSomethingToShow ? (
                <Bot className="h-4 w-4 text-muted-foreground" />
              ) : (
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight truncate">
                {hasSomethingToShow ? headerTitle : "Chat"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {activeGroup
                  ? `Broadcasting to ${activeGroup.participantAgentIds.length} agents`
                  : hasSomethingToShow && targetAgentId
                    ? `Talking with ${targetAgentId}`
                    : "Select or start a conversation with an AI employee."}
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
              Gateway disconnected. Messages will queue once the connection
              is restored.
            </div>
          </div>
        )}

        {activeGroup ? (
          <GroupChat group={activeGroup} agents={agentLookup} />
        ) : !hasSomethingToShow ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-6 py-10">
              <Card>
                <CardContent className="py-10 space-y-3">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">No conversation selected</h2>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Pick an existing conversation from the left, or click
                      <span className="font-medium text-foreground">
                        {" "}New chat{" "}
                      </span>
                      to start a new one with any of your AI employees.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : targetAgentId ? (
          <AgentChat
            ref={chatRef}
            agentId={targetAgentId}
            sessionKey={activeKey ?? undefined}
            onSessionCreated={handleSessionCreated}
            emptyState={<EmptyChatState agentName={targetAgent?.name ?? targetAgentId} />}
          />
        ) : (
          // hasSomethingToShow but no targetAgentId — shouldn't happen in
          // practice, but rendering an explicit fallback keeps the UI
          // stable instead of showing a blank pane.
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Conversation references an unknown agent.
          </div>
        )}
      </div>

      <EmployeePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePickAgent}
        agents={rosterAgents.length > 0 ? rosterAgents : agents ?? null}
        loading={!agents}
      />
      <GroupPickerDialog
        open={groupPickerOpen}
        onOpenChange={setGroupPickerOpen}
        agents={rosterAgents.length > 0 ? rosterAgents : agents ?? null}
        loading={!agents}
        onCreated={handleGroupCreated}
      />
    </div>
  );
}

function EmptyChatState({ agentName }: { agentName: string }) {
  return (
    <Card>
      <CardContent className="py-10 space-y-3">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">
            Say hello to {agentName}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Type your first message below. Your conversation history will
            be saved and available the next time you visit.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
