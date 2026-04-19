"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { SessionSummary } from "@/lib/gateway";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ConversationSidebarProps {
  sessions: SessionSummary[];
  activeKey: string | null;
  /** If set, a local draft (not yet persisted) is shown at the top. */
  draftLabel: string | null;
  loading: boolean;
  disabled?: boolean;
  onNew: () => void;
  onSelect: (key: string | null) => void;
  onRename: (key: string, newLabel: string) => Promise<void> | void;
  onDelete: (key: string) => Promise<void> | void;
}

/** Relative time formatter that falls back to a full date for old rows. */
function formatRelativeTime(updatedAt: number | null | undefined): string {
  if (!updatedAt) return "";
  const now = Date.now();
  const diff = now - updatedAt;
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

export function ConversationSidebar({
  sessions,
  activeKey,
  draftLabel,
  loading,
  disabled,
  onNew,
  onSelect,
  onRename,
  onDelete,
}: ConversationSidebarProps) {
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...sessions].sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  );

  const sessionToDelete = sorted.find((s) => s.key === deletingKey) ?? null;

  const handleStartRename = (session: SessionSummary) => {
    setRenamingKey(session.key);
    setRenameValue(labelFor(session));
  };

  const handleCommitRename = async () => {
    if (!renamingKey) return;
    const next = renameValue.trim();
    if (!next) {
      setRenamingKey(null);
      return;
    }
    setBusy(true);
    try {
      await onRename(renamingKey, next);
    } finally {
      setBusy(false);
      setRenamingKey(null);
    }
  };

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
          New employee
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {draftLabel !== null && (
          <ConversationRow
            isActive={activeKey === null}
            isDraft
            label={draftLabel || "New employee"}
            subtitle="Draft — send a message to start"
            updatedAt={null}
            onSelect={() => onSelect(null)}
            renaming={false}
            renameValue=""
            onRenameChange={() => {}}
            onCommitRename={() => {}}
            onCancelRename={() => {}}
            onStartRename={() => {}}
            onRequestDelete={() => {}}
            busy={false}
          />
        )}

        {loading && sorted.length === 0 && draftLabel === null && (
          <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading conversations…
          </div>
        )}

        {!loading && sorted.length === 0 && draftLabel === null && (
          <div className="p-4 text-xs text-muted-foreground">
            No conversations yet. Click{" "}
            <span className="font-medium text-foreground">
              New employee
            </span>{" "}
            to begin.
          </div>
        )}

        <ul className="p-2 space-y-1">
          {sorted.map((session) => {
            const isActive = session.key === activeKey;
            const isRenaming = session.key === renamingKey;
            const previewBase =
              session.lastMessagePreview?.trim() || session.derivedTitle?.trim();
            const subtitle = previewBase
              ? previewBase.length > 60
                ? previewBase.slice(0, 60) + "…"
                : previewBase
              : undefined;
            return (
              <ConversationRow
                key={session.key}
                isActive={isActive}
                isDraft={false}
                label={labelFor(session)}
                subtitle={subtitle}
                updatedAt={session.updatedAt ?? null}
                onSelect={() => onSelect(session.key)}
                renaming={isRenaming}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onCommitRename={handleCommitRename}
                onCancelRename={() => setRenamingKey(null)}
                onStartRename={() => handleStartRename(session)}
                onRequestDelete={() => setDeletingKey(session.key)}
                busy={busy}
              />
            );
          })}
        </ul>
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
              This will permanently remove the conversation with the Creator
              Agent{sessionToDelete ? (
                <>
                  {" "}
                  (
                  <span className="font-medium text-foreground">
                    {labelFor(sessionToDelete)}
                  </span>
                  )
                </>
              ) : null}
              , including its transcript. Any AI employee that was already
              deployed from this chat will not be affected.
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

interface ConversationRowProps {
  isActive: boolean;
  isDraft: boolean;
  label: string;
  subtitle?: string;
  updatedAt: number | null;
  onSelect: () => void;
  renaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onRequestDelete: () => void;
  busy: boolean;
}

function ConversationRow({
  isActive,
  isDraft,
  label,
  subtitle,
  updatedAt,
  onSelect,
  renaming,
  renameValue,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onRequestDelete,
  busy,
}: ConversationRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  return (
    <li>
      <div
        className={cn(
          "group relative flex flex-col gap-0.5 rounded-md px-2 py-2 text-sm cursor-pointer",
          isActive
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent/50",
        )}
        onClick={renaming ? undefined : onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!renaming && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isDraft && (
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          {renaming ? (
            <div
              className="flex flex-1 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCommitRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    onCancelRename();
                  }
                }}
                className="h-7 text-xs"
                disabled={busy}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={onCommitRename}
                disabled={busy}
                title="Save"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={onCancelRename}
                disabled={busy}
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <span className="flex-1 truncate font-medium">{label}</span>
              {!isDraft && (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartRename();
                    }}
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDelete();
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {!renaming && (subtitle || updatedAt || isDraft) && (
          <div className="flex items-center justify-between gap-2 pl-0 text-[11px] text-muted-foreground">
            <span className="truncate">
              {subtitle ?? (isDraft ? "Draft" : "")}
            </span>
            {updatedAt ? (
              <span className="shrink-0">{formatRelativeTime(updatedAt)}</span>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}
