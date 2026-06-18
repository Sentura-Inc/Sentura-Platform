"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  BadgeDollarSign,
  LogOut,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ConnectionStatus } from "@/components/connection-status";
import { MissingTokenBanner } from "@/components/missing-token-banner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeCostMini } from "@/components/cross-border/employee-cost";
import { EmployeeTaskStatusBar } from "@/components/cross-border/employee-task-status";
import { cn } from "@/lib/utils";
import { fetchEmployeeTasks, markEmployeeNotificationsRead } from "@/app/client-demos/cross-border/employee/_data/employee-api";
import {
  isCbeEmployeeTaskActive,
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

const adminNav = [
  {
    label: "员工管理",
    href: "/client-demos/cross-border/admin/employees",
    icon: UsersRound,
  },
  {
    label: "高分客户",
    href: "/client-demos/cross-border/admin/high-value-customers",
    icon: Star,
  },
  {
    label: "成本监控",
    href: "/client-demos/cross-border/admin/costs",
    icon: BadgeDollarSign,
  },
];

const CBE_ADMIN_USER_ID = process.env.NEXT_PUBLIC_CBE_ADMIN_USER_ID?.trim();
const ADMIN_HIGH_VALUE_SEEN_KEY = "sentura:cbe:admin:seen-high-value-at:v1";

interface AdminNotificationSnapshot {
  pendingApprovals: number;
  firstApprovalId: string | null;
  approvals: AdminApprovalNotification[];
  highValueCount: number;
  newHighValueCount: number;
  highValueItems: AdminHighValueNotification[];
  latestHighValueRecordId: string | null;
  latestHighValueName: string | null;
  latestHighValueAt: string | null;
  error: string | null;
}

interface AdminApprovalNotification {
  id: string;
  displayName: string;
  taskKind: string;
  targetSummary: string | null;
  requestedAllowanceUsd: string | number | null;
  estimatedCostUsd: string | number | null;
}

interface AdminHighValueNotification {
  recordId: string;
  companyName: string;
  ownerName: string | null;
  normalizedScore: number | null;
  updatedAt: string | null;
}

function timeMs(value: unknown) {
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function AdminNotificationBell({ enabled }: { enabled: boolean }) {
  const [snapshot, setSnapshot] = useState<AdminNotificationSnapshot>({
    pendingApprovals: 0,
    firstApprovalId: null,
    approvals: [],
    highValueCount: 0,
    newHighValueCount: 0,
    highValueItems: [],
    latestHighValueRecordId: null,
    latestHighValueName: null,
    latestHighValueAt: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function refreshNotifications() {
      try {
        const headers = CBE_ADMIN_USER_ID ? { "x-cbe-admin-user-id": CBE_ADMIN_USER_ID } : undefined;
        const [costsResponse, highValueResponse] = await Promise.all([
          fetch("/api/client-demos/cross-border/admin/costs?range=month", { cache: "no-store", ...(headers ? { headers } : {}) }),
          fetch("/api/client-demos/cross-border/admin/high-value-customers?limit=100&range=all", { cache: "no-store", ...(headers ? { headers } : {}) }),
        ]);
        const costsBody = await costsResponse.json().catch(() => ({}));
        const highValueBody = await highValueResponse.json().catch(() => ({}));
        if (!costsResponse.ok || !highValueResponse.ok) {
          throw new Error("admin notification API failed");
        }

        const approvals = Array.isArray(costsBody?.approvals) ? costsBody.approvals : [];
        const highValueItems = Array.isArray(highValueBody?.items) ? highValueBody.items : [];
        const approvalItems: AdminApprovalNotification[] = approvals
          .map((item: Record<string, unknown>) => ({
            id: asText(item.id),
            displayName: asText(item.display_name, asText(item.user_id, "员工")),
            taskKind: asText(item.task_kind, "任务"),
            targetSummary: asText(item.target_summary) || null,
            requestedAllowanceUsd: item.requested_allowance_usd as string | number | null,
            estimatedCostUsd: item.estimated_cost_usd as string | number | null,
          }))
          .filter((item: AdminApprovalNotification) => item.id);
        const firstApproval = approvalItems[0];
        const sortedHighValueItems: AdminHighValueNotification[] = highValueItems
          .slice()
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => timeMs(b.updatedAt) - timeMs(a.updatedAt))
          .map((item: Record<string, unknown>) => ({
            recordId: asText(item.recordId),
            companyName: asText(item.companyName, "高分客户"),
            ownerName: asText(item.ownerName) || null,
            normalizedScore: typeof item.normalizedScore === "number" ? item.normalizedScore : null,
            updatedAt: asText(item.updatedAt) || null,
          }))
          .filter((item: AdminHighValueNotification) => item.recordId);
        const latestHighValue = sortedHighValueItems[0];
        const latestHighValueAt = typeof latestHighValue?.updatedAt === "string" ? latestHighValue.updatedAt : null;
        const latestHighValueName = latestHighValue?.companyName ?? null;
        const latestHighValueRecordId = latestHighValue?.recordId ?? null;

        let newHighValueCount = 0;
        if (latestHighValueAt) {
          const seenAt = window.localStorage.getItem(ADMIN_HIGH_VALUE_SEEN_KEY);
          if (!seenAt) {
            window.localStorage.setItem(ADMIN_HIGH_VALUE_SEEN_KEY, latestHighValueAt);
          } else {
            const seenMs = timeMs(seenAt);
            newHighValueCount = sortedHighValueItems.filter((item) => timeMs(item.updatedAt) > seenMs).length;
          }
        }

        if (!cancelled) {
          setSnapshot({
            pendingApprovals: approvalItems.length,
            firstApprovalId: firstApproval?.id ?? null,
            approvals: approvalItems,
            highValueCount: sortedHighValueItems.length,
            newHighValueCount,
            highValueItems: sortedHighValueItems,
            latestHighValueRecordId,
            latestHighValueName,
            latestHighValueAt,
            error: null,
          });
        }
      } catch {
        if (!cancelled) {
          setSnapshot((current) => ({ ...current, error: "通知加载失败" }));
        }
      }
    }

    void refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  const badgeCount = snapshot.pendingApprovals + snapshot.newHighValueCount;
  const hasAdminMessages = snapshot.approvals.length > 0 || snapshot.highValueItems.length > 0;
  const markHighValueSeen = () => {
    if (snapshot.latestHighValueAt) {
      window.localStorage.setItem(ADMIN_HIGH_VALUE_SEEN_KEY, snapshot.latestHighValueAt);
      setSnapshot((current) => ({ ...current, newHighValueCount: 0 }));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "relative")}
            aria-label="管理者通知"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {badgeCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <div className="text-sm font-medium">通知</div>
          <div className="text-xs text-muted-foreground">{badgeCount > 0 ? `${badgeCount} 条需关注` : "暂无未读"}</div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto overscroll-contain pr-1">
          {hasAdminMessages ? (
            <>
              <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">成本审批</div>
              {snapshot.approvals.length > 0 ? (
                snapshot.approvals.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    className="items-start gap-2 py-2"
                    render={
                      <Link href={`/client-demos/cross-border/admin/costs?notify=approvals&highlightApproval=${encodeURIComponent(item.id)}#pending-approvals`} />
                    }
                  >
                    <BadgeDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.displayName} 的成本超支审批</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.targetSummary ?? item.taskKind}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-muted-foreground">暂无成本超支审批。</div>
              )}
              <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">高分客户</div>
              {snapshot.highValueItems.length > 0 ? (
                snapshot.highValueItems.map((item) => (
                  <DropdownMenuItem
                    key={item.recordId}
                    className="items-start gap-2 py-2"
                    render={
                      <Link
                        href={`/client-demos/cross-border/admin/high-value-customers?highlightCustomer=${encodeURIComponent(item.recordId)}`}
                        onClick={markHighValueSeen}
                      />
                    }
                  >
                    <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">高分客户：{item.companyName}</span>
                      <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">
                        {item.ownerName ? `${item.ownerName} · ` : ""}评分 {item.normalizedScore ?? "N/A"}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-muted-foreground">暂无高分客户通知。</div>
              )}
            </>
          ) : (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无消息提醒。</div>
          )}
        </div>
        {snapshot.error ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-destructive">{snapshot.error}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmployeeNotificationBell({ enabled }: { enabled: boolean }) {
  const tasks = useCbeEmployeeStore((state) => state.tasks);
  const markTaskNotificationsRead = useCbeEmployeeStore((state) => state.markTaskNotificationsRead);
  const messages = tasks
    .filter((task) => !isCbeEmployeeTaskActive(task) && !task.dismissed)
    .sort((left, right) => (right.completedAt ?? right.updatedAt) - (left.completedAt ?? left.updatedAt));
  const unreadMessages = messages.filter((task) => !task.notificationRead);
  const messageCenterHref = "/client-demos/cross-border/employee#employee-messages";

  async function markPreviewRead() {
    const ids = unreadMessages.map((task) => task.id);
    if (ids.length === 0) return;
    markTaskNotificationsRead(ids);
    try {
      const result = await markEmployeeNotificationsRead(ids);
      if (result.readIds.length > 0) {
        markTaskNotificationsRead(result.readIds);
      }
    } catch {
      // Keep local read state; the next refresh will reconcile with the server.
    }
  }

  if (!enabled) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "relative")}
            aria-label="员工消息提醒"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unreadMessages.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unreadMessages.length > 9 ? "9+" : unreadMessages.length}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <div className="text-sm font-medium">消息提醒</div>
          <div className="text-xs text-muted-foreground">
            {unreadMessages.length > 0 ? `${unreadMessages.length} 条未读` : "暂无未读"}
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto overscroll-contain pr-1">
          {messages.length > 0 ? (
            messages.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="items-start gap-2 py-2"
                render={<Link href={messageCenterHref} onClick={() => void markPreviewRead()} />}
              >
                {item.status === "failed" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {item.targetLabel ?? item.message}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无消息提醒。</div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={messageCenterHref} onClick={() => void markPreviewRead()} />}>
          <Bell className="h-4 w-4" />
          查看全部消息
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdminPath = pathname.startsWith("/client-demos/cross-border/admin");
  const isAdminLoginPath = pathname.startsWith("/client-demos/cross-border/admin/login");
  const isAdminAppPath = isAdminPath && !isAdminLoginPath;
  const isAuthPath = pathname.startsWith("/auth") || isAdminLoginPath;
  const isEmployeePath = pathname.startsWith("/client-demos/cross-border/employee");
  const navItems = isAdminPath ? adminNav : employeeNav;
  const shellTitle = isAdminPath ? "跨境电商管理者系统" : "跨境电商员工操作系统";
  const accountLabel = isAdminPath ? "管理者" : "员工";
  const setTasks = useCbeEmployeeStore((state) => state.setTasks);
  const [sessionUser, setSessionUser] = useState<{ displayName: string } | null>(null);

  useEffect(() => {
    if (!isEmployeePath || isAuthPath) return;
    let cancelled = false;
    async function refreshSession() {
      try {
        const response = await fetch("/api/client-demos/cross-border/session?role=operator", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.user?.cbeRole !== "operator") {
          if (!cancelled) {
            router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
          }
          return;
        }
        if (!cancelled) {
          setSessionUser({
            displayName: body.user.displayName,
          });
        }
      } catch {
        if (!cancelled) router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
      }
    }
    void refreshSession();
    return () => {
      cancelled = true;
    };
  }, [isAuthPath, isEmployeePath, pathname, router]);

  useEffect(() => {
    if (!isAdminAppPath) return;
    let cancelled = false;
    async function refreshSession() {
      try {
        const response = await fetch("/api/client-demos/cross-border/session?role=admin", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.user?.cbeRole !== "admin") {
          if (!cancelled) {
            setSessionUser(null);
            router.replace(`/client-demos/cross-border/admin/login?next=${encodeURIComponent(pathname)}`);
          }
          return;
        }
        if (!cancelled) {
          setSessionUser({
            displayName: body.user.displayName,
          });
        }
      } catch {
        if (!cancelled) {
          setSessionUser(null);
          router.replace(`/client-demos/cross-border/admin/login?next=${encodeURIComponent(pathname)}`);
        }
      }
    }
    void refreshSession();
    return () => {
      cancelled = true;
    };
  }, [isAdminAppPath, pathname, router]);

  useEffect(() => {
    if (isAdminPath || isAuthPath) return;
    let cancelled = false;
    async function refreshTasks() {
      try {
        const latestTasks = await fetchEmployeeTasks();
        if (!cancelled) setTasks(latestTasks);
      } catch {
        // The task bar is non-blocking; page-level surfaces show API errors.
      }
    }
    void refreshTasks();
    const timer = window.setInterval(refreshTasks, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAdminPath, isAuthPath, setTasks]);

  async function logoutTo(loginPath: string) {
    const role = loginPath.startsWith("/client-demos/cross-border/admin") ? "admin" : "operator";
    await fetch(`/api/auth/logout?role=${role}`, { method: "POST" }).catch(() => undefined);
    setSessionUser(null);
    router.replace(loginPath);
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 lg:px-6">
          <div className="flex min-w-[168px] items-center" aria-label={`Sentura ${shellTitle}`}>
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
                {shellTitle}
              </div>
            </div>
          </div>

          {!isAuthPath ? (
          <nav className="hidden items-center rounded-md border bg-muted/30 p-1 md:flex">
            {navItems.map((item) => {
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
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {!isAdminPath && !isAuthPath ? <EmployeeCostMini /> : null}
            <ConnectionStatus />
            {isAdminAppPath ? <AdminNotificationBell enabled={isAdminAppPath} /> : null}
            {!isAdminPath && !isAuthPath ? <EmployeeNotificationBell enabled={!isAdminPath && !isAuthPath} /> : null}
            {!isAdminPath && !isAuthPath ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border bg-background px-2 py-1.5 lg:flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {(sessionUser?.displayName ?? accountLabel).slice(0, 1)}
                </span>
                <span className="text-sm font-medium">{sessionUser?.displayName ?? accountLabel}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void logoutTo("/auth/login")}>
                <LogOut className="h-4 w-4" />
                退出
              </Button>
            </div>
            ) : null}
            {isAdminAppPath ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border bg-background px-2 py-1.5 lg:flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {(sessionUser?.displayName ?? accountLabel).slice(0, 1)}
                </span>
                <span className="text-sm font-medium">{sessionUser?.displayName ?? accountLabel}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void logoutTo("/client-demos/cross-border/admin/login")}>
                <LogOut className="h-4 w-4" />
                退出
              </Button>
            </div>
            ) : null}
          </div>
        </div>

        {!isAuthPath ? (
        <nav className="grid grid-cols-3 border-t bg-background md:hidden">
          {navItems.map((item) => {
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
        ) : null}
      </header>

      <MissingTokenBanner />
      {!isAdminPath && !isAuthPath ? <EmployeeTaskStatusBar /> : null}

      <main className="min-h-0 flex-1">
        <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1440px] px-4 py-5 lg:px-6">
          {children}
        </div>
      </main>

      {!isAdminPath && !isAuthPath ? (
      <div
        className="fixed bottom-4 right-4 hidden rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm lg:flex"
        title="页面操作会在后台调用对应 AI 员工，员工不会以聊天框形式显示。"
      >
        <Search className="mr-2 h-3.5 w-3.5" />
        员工界面 · 后台 AI 员工执行
      </div>
      ) : null}
    </div>
  );
}
