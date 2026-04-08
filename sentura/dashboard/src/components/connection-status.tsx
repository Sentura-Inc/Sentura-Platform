"use client";

import { useGateway } from "@/lib/gateway";
import { cn } from "@/lib/utils";

const stateLabels = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  connected: "Connected",
  reconnecting: "Reconnecting...",
} as const;

const stateColors = {
  disconnected: "bg-red-500",
  connecting: "bg-yellow-500",
  connected: "bg-emerald-500",
  reconnecting: "bg-yellow-500",
} as const;

export function ConnectionStatus() {
  const { state } = useGateway();

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={cn("h-2 w-2 rounded-full", stateColors[state])}
      />
      <span>Gateway: {stateLabels[state]}</span>
    </div>
  );
}
