"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  CheckCircle2,
  Database,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ConnectionStatus } from "@/components/connection-status";
import { MissingTokenBanner } from "@/components/missing-token-banner";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeCostMini } from "@/components/cross-border/employee-cost";
import { EmployeeTaskStatusBar } from "@/components/cross-border/employee-task-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { employeeProfile } from "@/app/client-demos/cross-border/employee/_data/employee-data";
import {
  formatCbeTaskDuration,
  isCbeEmployeeTaskActive,
  type CbeEmployeeTaskRecord,
  useCbeEmployeeStore,
} from "@/stores/use-cbe-employee-store";

const employeeNav = [
  {
    label: "个人中心",
    href: "/client-demos/cross-border/employee",
    icon: UserRound,
  },
  {
    label: "获客与背调",
    href: "/client-demos/cross-border/employee/customers",
    icon: ShieldCheck,
  },
  {
    label: "记忆整理",
    href: "/client-demos/cross-border/employee/memory",
    icon: Database,
  },
];

const NOTIFICATION_READ_STORAGE_KEY = "sentura-cbe-notification-read-task-ids-v1";

function readNotificationIdsFromStorage() {
  if (typeof localStorage === "undefined") return [];
  try {
    const rawIds = localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
    const parsedIds = rawIds ? JSON.parse(rawIds) : [];
    return Array.isArray(parsedIds) ? parsedIds.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function getTaskNotificationHref(task: CbeEmployeeTaskRecord) {
  if (task.kind === "lead" || task.kind === "screening") {
    return "/client-demos/cross-border/employee/customers";
  }
  return "/client-demos/cross-border/employee";
}

function getTaskNotificationSummary(task: CbeEmployeeTaskRecord) {
  if (task.status === "completed") {
    const countText =
      typeof task.resultCount === "number" ? `，返回 ${task.resultCount} 条结果` : "";
    return `${task.message}${countText}`;
  }
  return task.error ?? task.message;
}

function getTaskNotificationTime(task: CbeEmployeeTaskRecord) {
  const finishedAt = task.completedAt ?? task.updatedAt;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(finishedAt));
}

function getTaskNotificationDuration(task: CbeEmployeeTaskRecord) {
  const finishedAt = task.completedAt ?? task.updatedAt;
  return formatCbeTaskDuration(finishedAt - task.startedAt);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tasks = useCbeEmployeeStore((state) => state.tasks);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(readNotificationIdsFromStorage);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const taskNotifications = useMemo(
    () =>
      tasks
        .filter((task) => !isCbeEmployeeTaskActive(task))
        .sort((left, right) => (right.completedAt ?? right.updatedAt) - (left.completedAt ?? left.updatedAt))
        .slice(0, 8),
    [tasks],
  );

  const notificationTaskIds = useMemo(
    () => taskNotifications.map((task) => task.id),
    [taskNotifications],
  );

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(readNotificationIds));
  }, [readNotificationIds]);

  const unreadCount = taskNotifications.filter((task) => !readNotificationIds.includes(task.id)).length;

  const markTaskNotificationRead = (taskId: string) => {
    setReadNotificationIds((current) => (current.includes(taskId) ? current : [...current, taskId]));
  };

  const markAllNotificationsRead = () => {
    setReadNotificationIds((current) => Array.from(new Set([...current, ...notificationTaskIds])));
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-50 text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 lg:px-6">
          <div
            className="flex min-w-[168px] items-center"
            aria-label="Sentura 跨境电商客户系统"
          >
            <div className="min-w-0">
              <Image
                src="/sentura-logo-side.svg"
                alt="Sentura"
                width={156}
                height={28}
                className="h-7 w-auto max-w-[156px]"
                style={{ width: "auto" }}
              />
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                跨境电商客户系统
              </div>
            </div>
          </div>

          <nav className="hidden items-center rounded-md border bg-muted/30 p-1 md:flex">
            {employeeNav.map((item) => {
              const active =
                item.href === "/client-demos/cross-border/employee"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <EmployeeCostMini />
            <ConnectionStatus />
            <div className="relative">
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "relative")}
                aria-label={unreadCount > 0 ? `消息中心，${unreadCount} 条未读` : "消息中心"}
                aria-expanded={notificationOpen}
                aria-haspopup="dialog"
                onClick={() => setNotificationOpen((open) => !open)}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {notificationOpen ? (
                <div
                  role="dialog"
                  aria-label="消息中心"
                  className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
                >
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold">消息中心</div>
                    <div className="text-xs text-muted-foreground">后台任务完成后会在这里提醒</div>
                  </div>
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:pointer-events-none disabled:text-muted-foreground"
                    disabled={unreadCount === 0}
                    onClick={markAllNotificationsRead}
                  >
                    全部已读
                  </button>
                </div>
                {taskNotifications.length > 0 ? (
                  <div className="max-h-96 overflow-auto p-1">
                    {taskNotifications.map((task) => {
                      const unread = !readNotificationIds.includes(task.id);
                      const success = task.status === "completed";
                      return (
                        <Link
                          key={task.id}
                          href={getTaskNotificationHref(task)}
                          className="block rounded-md px-2 py-2 outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
                          onClick={() => {
                            markTaskNotificationRead(task.id);
                            setNotificationOpen(false);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                                success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                              )}
                            >
                              {success ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <AlertTriangle className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-medium">{task.title}</span>
                                {unread ? (
                                  <Badge className="h-4 rounded-full bg-rose-600 px-1.5 text-[10px] text-white hover:bg-rose-600">
                                    新
                                  </Badge>
                                ) : null}
                              </span>
                              <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                                {getTaskNotificationSummary(task)}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                <span>{getTaskNotificationTime(task)}</span>
                                <span>{success ? `完成耗时 ${getTaskNotificationDuration(task)}` : "需要处理"}</span>
                                {task.targetLabel ? <span>{task.targetLabel}</span> : null}
                              </span>
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    暂无任务通知
                  </div>
                )}
                </div>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-2")}
                  />
                }
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {employeeProfile.name.slice(0, 1)}
                </span>
                <span className="hidden text-sm font-medium lg:inline">{employeeProfile.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                  {employeeProfile.tenant} · {employeeProfile.role}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={
                    <Link href="/client-demos/cross-border/employee" />
                  }
                >
                  <UserRound className="h-4 w-4" />
                  个人中心
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link href="/client-demos/cross-border/employee#employee-messages" />
                  }
                >
                  <Bell className="h-4 w-4" />
                  消息中心
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav className="grid grid-cols-3 border-t bg-background md:hidden">
          {employeeNav.map((item) => {
            const active =
              item.href === "/client-demos/cross-border/employee"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <MissingTokenBanner />
      <EmployeeTaskStatusBar />

      <main className="min-h-0 flex-1">
        <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1440px] px-4 py-5 lg:px-6">
          {children}
        </div>
      </main>

      <div
        className="fixed bottom-4 right-4 hidden rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm lg:flex"
        title="页面操作会在后台调用对应 AI 员工，员工不会以聊天框形式显示。"
      >
        <Search className="mr-2 h-3.5 w-3.5" />
        员工界面 · 后台 AI 员工执行
      </div>
    </div>
  );
}
