"use client";

import { useGateway } from "@/lib/gateway";
import { cn } from "@/lib/utils";

const stateLabels = {
  disconnected: "未连接",
  connecting: "连接中",
  connected: "已连接",
  reconnecting: "重连中",
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
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2">
      <span
        className={cn("h-2 w-2 rounded-full", stateColors[state])}
      />
      <span title="系统连接状态：已连接时才能提交任务。">
        <span className="hidden sm:inline">系统：</span>
        {stateLabels[state]}
      </span>
    </div>
  );
}
