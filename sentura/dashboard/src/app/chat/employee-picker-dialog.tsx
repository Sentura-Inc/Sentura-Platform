"use client";

import { Bot, Loader2 } from "lucide-react";
import type { AgentConfig } from "@/lib/gateway";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface EmployeePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback when an agent is selected. The dialog auto-closes after. */
  onPick: (agentId: string) => void;
  /** Roster of selectable agents. Excludes meta-agents (creator/tuner/etc). */
  agents: AgentConfig[] | null;
  loading: boolean;
}

/**
 * Modal that lets the user pick which AI employee they want to chat with.
 *
 * Used by `/chat` to start a new conversation. Selection sets the parent's
 * `draftAgentId` state (no session is created until the user sends their
 * first message — matching the `/create` draft pattern).
 *
 * Meta-agents (creator/tuner/orchestrator) are filtered out by
 * `getAgents()` upstream, so the picker only shows real employees the user
 * is meant to interact with.
 */
export function EmployeePickerDialog({
  open,
  onOpenChange,
  onPick,
  agents,
  loading,
}: EmployeePickerDialogProps) {
  const handlePick = (agentId: string) => {
    onPick(agentId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a new conversation</DialogTitle>
          <DialogDescription>
            Pick an AI employee to chat with. Your message history with each
            employee is independent.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !agents || agents.length === 0 ? (
            <EmptyAgentsState />
          ) : (
            <ul className="space-y-1 py-1">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(agent.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors",
                      "hover:border-border hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {agent.name ?? agent.id}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        {agent.id} · {agent.model}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyAgentsState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Bot className="h-6 w-6 text-muted-foreground opacity-60" />
      </div>
      <p className="text-sm font-medium">No employees available yet</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Create an AI employee from the Create Employee page first, then come
        back here to start chatting.
      </p>
    </div>
  );
}

/** Tiny re-export so callers don't need to import Loader2 separately. */
export const PickerLoader = Loader2;
