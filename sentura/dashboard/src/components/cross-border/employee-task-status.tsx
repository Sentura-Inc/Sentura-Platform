"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
};

function taskIcon(task: CbeEmployeeTaskRecord) {
  if (task.status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (task.status === "failed") return <AlertTriangle className="h-4 w-4 text-rose-600" />;
  if (task.status === "queued") return <Clock3 className="h-4 w-4 text-sky-700" />;
  return <Loader2 className="h-4 w-4 animate-spin text-sky-700" />;
}

function taskTone(task: CbeEmployeeTaskRecord) {
  if (task.status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (task.status === "failed") return "border-rose-200 bg-rose-50 text-rose-950";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

function completedTaskSummary(task: CbeEmployeeTaskRecord) {
  const count = typeof task.resultCount === "number" ? task.resultCount : 0;
  if (task.kind === "screening") {
    return `背调员工已返回 ${count} 份报告，客户评分已更新。`;
  }
  if (task.kind === "accio_memory") {
    return `记忆员工已返回 ${count} 份摘要，记忆列表已更新。`;
  }
  return `获客员工已返回 ${count} 个客户，客户列表已更新。`;
}

export function EmployeeTaskStatusBar() {
  const pathname = usePathname();
  const tasks = useCbeEmployeeStore((state) => state.tasks);
  const dismissTask = useCbeEmployeeStore((state) => state.dismissTask);
  const recoverStaleTasks = useCbeEmployeeStore((state) => state.recoverStaleTasks);
  const [now, setNow] = useState(() => Date.now());

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

  if (!pathname.startsWith("/client-demos/cross-border/employee") || visibleTasks.length === 0) {
    return null;
  }

  return (
    <div className="border-b bg-background">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-3 lg:px-6">
        {visibleTasks.length > 1 ? (
          <div className="text-xs font-medium text-muted-foreground">
            正在同时运行 {visibleTasks.length} 个后台任务
          </div>
        ) : null}
        {visibleTasks.map((visibleTask) => {
          const timing = getCbeTaskTiming(visibleTask, now);
          const isActive = isCbeEmployeeTaskActive(visibleTask);
          const elapsed = formatCbeTaskDuration(timing.elapsedMs);
          const remaining = formatCbeTaskDuration(timing.remainingMs);
          const estimate = formatCbeTaskDuration(visibleTask.estimatedMs);
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
                      完成耗时 {elapsed} ·{" "}
                      {completedTaskSummary(visibleTask)}
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 leading-5">{visibleTask.message}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs opacity-75">
                        <span>预计 {estimate}</span>
                        <span>已用 {elapsed}</span>
                        {isActive ? <span>倒计时 {remaining}</span> : null}
                        {typeof visibleTask.resultCount === "number" ? (
                          <span>结果 {visibleTask.resultCount} 条</span>
                        ) : null}
                        {visibleTask.sessionKey ? <span className="truncate">任务 {visibleTask.sessionKey}</span> : null}
                      </div>
                    </>
                  )}
                </div>
                {!isActive ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="关闭任务状态"
                    onClick={() => dismissTask(visibleTask.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    visibleTask.status === "failed"
                      ? "bg-rose-500"
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
