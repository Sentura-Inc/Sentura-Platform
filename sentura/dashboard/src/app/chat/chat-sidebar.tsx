"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AgentConfig, SessionSummary } from "@/lib/gateway";
import { getSessionAgentId } from "@/lib/gateway";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ChatSidebarProps {
  sessions: SessionSummary[];
  agents: AgentConfig[];
  /** Currently-active session key, or null if a draft / no selection. */
  activeKey: string | null;
  /** Currently-drafted agentId (picker selection awaiting first send). */
  draftAgentId: string | null;
  loading: boolean;
  disabled?: boolean;
  onNew: () => void;
  onSelect: (key: string) => void;
  onSelectDraft: () => void;
  onDelete: (key: string) => Promise<void> | void;
}

interface AgentGroup {
  agentId: string;
  agent: AgentConfig | undefined;
  sessions: SessionSummary[];
  /** Most-recent updatedAt within the group (used for cross-group sort). */
  mostRecent: number;
}

function formatRelativeTime(updatedAt: number | null | undefined): string {
  if (!updatedAt) return "";
  const diff = Date.now() - updatedAt;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(updatedAt).toLocaleDateString();
}

function labelFor(session: SessionSummary): string {
  return (
    session.label?.trim() ||
    session.displayName?.trim() ||
    session.derivedTitle?.trim() ||
    "Untitled conversation"
  );
}

function previewFor(session: SessionSummary): string | undefined {
  const raw = session.lastMessagePreview?.trim();
  if (!raw) return undefined;
  return raw.length > 60 ? raw.slice(0, 60) + "…" : raw;
}

/**
 * Sidebar conversation list for /chat. Sessions are grouped by agent
 * (matching how a user mentally organizes "talks with Alice the
 * billing-rep" vs "talks with Bob the SDR") and groups themselves are
 * ordered by most-recent activity within each group.
 *
 * The "+ New chat" button at the top opens an employee picker dialog
 * (handled by the parent via `onNew`); selecting an agent enters draft
 * mode where AgentChat is mounted with `sessionKey={undefined}` and
 * creates the session on first user send.
 */
export function ChatSidebar({
  sessions,
  agents,
  activeKey,
  draftAgentId,
  loading,
  disabled,
  onNew,
  onSelect,
  onSelectDraft,
  onDelete,
}: ChatSidebarProps) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groups: AgentGroup[] = useMemo(() => {
    const agentLookup = new Map(agents.map((a) => [a.id, a]));
    const grouped = new Map<string, SessionSummary[]>();
    for (const s of sessions) {
      // Derive agentId from session key (structured `agent:<id>:...`); falls
      // back to schema field, then to "unknown" if neither is parseable.
      const id = getSessionAgentId(s) ?? "unknown";
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id)!.push(s);
    }
    return Array.from(grouped.entries())
      .map(([agentId, list]) => {
        const sorted = [...list].sort(
          (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
        );
        return {
          agentId,
          agent: agentLookup.get(agentId),
          sessions: sorted,
          mostRecent: sorted[0]?.updatedAt ?? 0,
        };
      })
      .sort((a, b) => b.mostRecent - a.mostRecent);
  }, [sessions, agents]);

  const sessionToDelete =
    deletingKey !== null
      ? sessions.find((s) => s.key === deletingKey) ?? null
      : null;

  const handleConfirmDelete = async () => {
    if (!deletingKey) return;
    setBusy(true);
    try {
      await onDelete(deletingKey);
    } finally {
      setBusy(false);
      setDeletingKey(null);
    }
  };

  const draftAgent =
    draftAgentId !== null
      ? agents.find((a) => a.id === draftAgentId)
      : undefined;

  const showEmpty =
    !loading && groups.length === 0 && draftAgentId === null;

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
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Draft row (picker selected an agent, awaiting first send) */}
        {draftAgentId !== null && (
          <div className="p-2">
            <button
              type="button"
              onClick={onSelectDraft}
              className={cn(
                "group flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm",
                activeKey === null
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50",
              )}
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {draftAgent?.name ?? draftAgentId}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Draft — send a message to start
                </p>
              </div>
            </button>
          </div>
        )}

        {loading && groups.length === 0 && draftAgentId === null && (
          <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading conversations…
          </div>
        )}

        {showEmpty && (
          <div className="p-4 text-xs text-muted-foreground">
            No conversations yet. Click{" "}
            <span className="font-medium text-foreground">New chat</span>{" "}
            to start one with an AI employee.
          </div>
        )}

        {groups.map((group) => (
          <AgentGroupSection
            key={group.agentId}
            group={group}
            activeKey={activeKey}
            onSelect={onSelect}
            onRequestDelete={(key) => setDeletingKey(key)}
          />
        ))}
      </div>

      <Dialog
        open={deletingKey !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeletingKey(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              This will permanently remove the conversation
              {sessionToDelete ? (
                <>
                  {" "}(
                  <span className="font-medium text-foreground">
                    {labelFor(sessionToDelete)}
                  </span>
                  )
                </>
              ) : null}
              , including its transcript. The AI employee itself is not
              affected and will remain available for new conversations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingKey(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function AgentGroupSection({
  group,
  activeKey,
  onSelect,
  onRequestDelete,
}: {
  group: AgentGroup;
  activeKey: string | null;
  onSelect: (key: string) => void;
  onRequestDelete: (key: string) => void;
}) {
  const agentName = group.agent?.name ?? group.agentId;

  return (
    <div className="px-2 py-2">
      <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        <Bot className="h-3 w-3" />
        <span className="truncate">{agentName}</span>
        <span className="ml-auto tabular-nums">{group.sessions.length}</span>
      </div>
      <ul className="space-y-0.5">
        {group.sessions.map((session) => (
          <ConversationRow
            key={session.key}
            session={session}
            isActive={session.key === activeKey}
            onSelect={() => onSelect(session.key)}
            onRequestDelete={() => onRequestDelete(session.key)}
          />
        ))}
      </ul>
    </div>
  );
}

function ConversationRow({
  session,
  isActive,
  onSelect,
  onRequestDelete,
}: {
  session: SessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onRequestDelete: () => void;
}) {
  const subtitle = previewFor(session);
  const updatedAt = session.updatedAt ?? null;

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
          <span className="flex-1 truncate font-medium">
            {labelFor(session)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete();
            }}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {(subtitle || updatedAt) && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{subtitle ?? ""}</span>
            {updatedAt ? (
              <span className="shrink-0">{formatRelativeTime(updatedAt)}</span>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}
