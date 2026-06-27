"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/lib/gateway";
import { isCbeEmployeePath } from "@/lib/cross-border-routes";
import { cn } from "@/lib/utils";
import {
  cancelEmployeeTaskInDb,
  dismissEmployeeTaskInDb,
} from "@/app/client-demos/cross-border/employee/_data/employee-api";
import { cancelCbeEmployeeRuntimeTask } from "@/app/client-demos/cross-border/employee/_data/employee-task-cancellation";
import {
  formatCbeTaskDuration,
  getCbeTaskTiming,
  isCbeEmployeeTaskActive,
  useCbeEmployeeStore,
  type CbeEmployeeTaskRecord,
} from "@/stores/use-cbe-employee-store";

const statusLabels: Record<CbeEmployeeTaskRecord["status"], string> = {
  queued: "排队中",
  running: "执行中",
  polling: "读取结果",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function taskIcon(task: CbeEmployeeTaskRecord) {
  if (task.status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (task.status === "failed") return <AlertTriangle className="h-4 w-4 text-rose-600" />;
  if (task.status === "cancelled") return <X className="h-4 w-4 text-[var(--sentura-muted)]" />;
  if (task.status === "queued") return <Clock3 className="h-4 w-4 text-sky-700" />;
  return <Loader2 className="h-4 w-4 animate-spin text-sky-700" />;
}

function taskTone(task: CbeEmployeeTaskRecord) {
  if (task.status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (task.status === "failed") return "border-rose-200 bg-rose-50 text-rose-950";
  if (task.status === "cancelled") return "border-[var(--sentura-border-strong)] bg-[var(--sentura-surface-2)] text-[var(--sentura-ink)]";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

function completedTaskSummary(task: CbeEmployeeTaskRecord) {
  const count = typeof task.resultCount === "number" ? task.resultCount : 0;
  if (task.kind === "screening") {
    return `已完成 ${count} 份背调报告，客户评分已更新。`;
  }
  if (task.kind === "accio_memory") {
    return `已整理 ${count} 份聊天记录，记忆列表已更新。`;
  }
  return `已找到 ${count} 个客户，客户列表已更新。`;
}

function formatTaskClock(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function EmployeeTaskStatusBar() {
  const pathname = usePathname();
  const { client } = useGateway();
  const tasks = useCbeEmployeeStore((state) => state.tasks);
  const cancelTask = useCbeEmployeeStore((state) => state.cancelTask);
  const dismissTask = useCbeEmployeeStore((state) => state.dismissTask);
  const recoverStaleTasks = useCbeEmployeeStore((state) => state.recoverStaleTasks);
  const [now, setNow] = useState(() => Date.now());

  const closeTaskStatus = (task: CbeEmployeeTaskRecord) => {
    dismissTask(task.id);
    void dismissEmployeeTaskInDb(task.id).catch(() => undefined);
  };

  const cancelTaskStatus = (task: CbeEmployeeTaskRecord) => {
    if (!isCbeEmployeeTaskActive(task)) return;
    const message = "任务已取消，结果不会写入列表。";
    cancelCbeEmployeeRuntimeTask(task.id);
    cancelTask(task.id, message, task.sessionKey);
    if (task.sessionKey) {
      void client.deleteSession(task.sessionKey, { deleteTranscript: false }).catch(() => undefined);
    }
    void cancelEmployeeTaskInDb({ id: task.id, sessionKey: task.sessionKey }).catch(() => undefined);
  };

  useEffect(() => {
    recoverStaleTasks();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      recoverStaleTasks();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recoverStaleTasks]);

  const active = tasks.filter((task) => isCbeEmployeeTaskActive(task) && !task.dismissed);
  const visibleTasks =
    active.length > 0
      ? active.slice(0, 2)
      : tasks.filter((task) => !task.dismissed).slice(0, 1);

  if (!isCbeEmployeePath(pathname) || visibleTasks.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-[var(--sentura-border)] bg-white/58 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-3 lg:px-6">
        {visibleTasks.length > 1 ? (
          <div className="text-xs font-medium text-muted-foreground">
            正在处理 {visibleTasks.length} 个任务
          </div>
        ) : null}
        {visibleTasks.map((visibleTask) => {
          const timing = getCbeTaskTiming(visibleTask, now);
          const isActive = isCbeEmployeeTaskActive(visibleTask);
          const elapsed = formatCbeTaskDuration(timing.elapsedMs);
          const remaining = formatCbeTaskDuration(timing.remainingMs);
          const waitWindow = formatCbeTaskDuration(visibleTask.timeoutMs);
          const plannedDuration = formatCbeTaskDuration(visibleTask.estimatedMs);
          const lastActivity = formatTaskClock(visibleTask.lastActivityAt ?? visibleTask.updatedAt);
          const isCompleted = visibleTask.status === "completed";
          return (
            <div
              key={visibleTask.id}
              className={cn(
                "rounded-md border px-3 py-2 text-sm shadow-sm",
                taskTone(visibleTask),
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{taskIcon(visibleTask)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                    <span>{visibleTask.title}</span>
                    <span className="text-xs font-normal opacity-75">· {statusLabels[visibleTask.status]}</span>
                    {visibleTask.targetLabel ? (
                      <span className="text-xs font-normal opacity-75">· {visibleTask.targetLabel}</span>
                    ) : null}
                  </div>
                  {isCompleted ? (
                    <div className="mt-1 leading-5">
                      用时 {elapsed} ·{" "}
                      {completedTaskSummary(visibleTask)}
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 leading-5">{visibleTask.message}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-75">
                        <span>已用 {elapsed}</span>
                        {isActive ? <span>剩余等待 {remaining}</span> : null}
                        {typeof visibleTask.resultCount === "number" ? (
                          <span>结果 {visibleTask.resultCount} 条</span>
                        ) : null}
                      </div>
                      <details className="mt-1 text-xs opacity-70">
                        <summary className="cursor-pointer">查看技术详情</summary>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono">
                          <span>计划耗时 {plannedDuration}</span>
                          <span>最长等待 {waitWindow}</span>
                          {lastActivity ? <span>最后活动 {lastActivity}</span> : null}
                          {visibleTask.sessionKey ? <span className="truncate">任务 {visibleTask.sessionKey}</span> : null}
                        </div>
                      </details>
                    </>
                  )}
                </div>
                {isActive ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label="取消任务"
                    onClick={() => cancelTaskStatus(visibleTask)}
                  >
                    <X className="h-4 w-4" />
                    取消
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="关闭任务状态"
                    onClick={() => closeTaskStatus(visibleTask)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    visibleTask.status === "failed"
                      ? "bg-rose-500"
                      : visibleTask.status === "cancelled"
                        ? "bg-[var(--sentura-muted)]"
                      : visibleTask.status === "completed"
                        ? "bg-emerald-500"
                        : "bg-sky-500",
                  )}
                  style={{ width: `${timing.progressPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
