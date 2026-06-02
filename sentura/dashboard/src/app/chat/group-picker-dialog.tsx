"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Users } from "lucide-react";
import type { AgentConfig } from "@/lib/gateway";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GroupRecord } from "@/lib/groups/types";

export interface GroupPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Roster of selectable agents (meta-agents excluded by useAgents). */
  agents: AgentConfig[] | null;
  loading: boolean;
  /** Resolves with the created group; caller should adopt it into URL state. */
  onCreated: (group: GroupRecord) => void;
}

/**
 * Modal that lets the user create a new group conversation. Pick 2+ AI
 * employees, name the group, hit Create. POSTs to /api/groups and returns
 * the saved record to the parent.
 */
export function GroupPickerDialog({
  open,
  onOpenChange,
  agents,
  loading,
  onCreated,
}: GroupPickerDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setName("");
    setError(null);
    setSubmitting(false);
  }, [open]);

  const selectedAgents = useMemo(() => {
    if (!agents) return [];
    return agents.filter((a) => selected.has(a.id));
  }, [agents, selected]);

  const toggle = (agentId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const canSubmit =
    !submitting && selected.size >= 2 && name.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          participantAgentIds: Array.from(selected),
        }),
      });
      const data = (await res.json()) as { group?: GroupRecord; error?: string };
      if (!res.ok || !data.group) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onCreated(data.group);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to create group";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Create a group conversation
          </DialogTitle>
          <DialogDescription>
            Pick two or more AI employees and give the group a name. Messages
            you send will be broadcast to every participant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="group-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Group name
            </label>
            <input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order issue triage"
              className={cn(
                "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none",
                "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Participants
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selected.size} selected
              </span>
            </div>
            <div className="max-h-[40vh] overflow-y-auto rounded-md border border-border">
              {loading ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !agents || agents.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">
                  No employees available yet. Create at least two AI employees
                  first.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {agents.map((agent) => {
                    const isOn = selected.has(agent.id);
                    return (
                      <li key={agent.id}>
                        <button
                          type="button"
                          onClick={() => toggle(agent.id)}
                          disabled={submitting}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                            isOn ? "bg-accent/60" : "hover:bg-accent/30",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              isOn
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input",
                            )}
                          >
                            {isOn && (
                              <span className="text-[10px] leading-none">✓</span>
                            )}
                          </div>
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {agent.name ?? agent.id}
                            </p>
                            <p className="truncate text-[11px] font-mono text-muted-foreground">
                              {agent.id}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {selectedAgents.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Will broadcast to:{" "}
                <span className="font-medium text-foreground">
                  {selectedAgents.map((a) => a.name ?? a.id).join(", ")}
                </span>
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Create group
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
