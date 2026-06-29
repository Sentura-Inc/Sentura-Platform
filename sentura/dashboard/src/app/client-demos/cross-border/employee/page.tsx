"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPagination, usePagedItems } from "@/components/cross-border/brand-ui";
import { AnimatedList } from "@/components/cross-border/animated-list";
import { EmployeeCostCard } from "@/components/cross-border/employee-cost";
import {
  isCbeEmployeeTaskActive,
  useCbeEmployeeStore,
} from "@/stores/use-cbe-employee-store";
import {
  CBE_EMPLOYEE_CUSTOMERS_PATH,
  CBE_EMPLOYEE_MEMORY_PATH,
  CBE_SESSION_API_PATH,
} from "@/lib/cross-border-routes";
import {
  setCbeSessionDisplayName,
  useCbeSessionDisplayName,
} from "@/lib/cbe-session-display-name";
import {
  employeeProfile,
  type CustomerListItem,
} from "./_data/employee-data";
import {
  deleteEmployeeNotifications,
  fetchEmployeeCustomers,
  fetchEmployeeMemoryRecords,
  fetchEmployeeTasks,
  markEmployeeNotificationsRead,
} from "./_data/employee-api";
import {
  EMPLOYEE_API_COST_ELEMENT_ID,
  EMPLOYEE_API_COST_HIGHLIGHT_PARAM,
  EMPLOYEE_NOTIFICATION_HIGHLIGHT_CLASS,
  employeeTaskNotificationHref,
} from "./_data/employee-notification-targets";
import { cn } from "@/lib/utils";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";

type HomeRange = "today" | "week" | "month" | "all";
type CustomerHighlightScope = "lead-results" | "screening-results" | "trusted" | "pending";

const customerPagePath = CBE_EMPLOYEE_CUSTOMERS_PATH;
const memoryPagePath = CBE_EMPLOYEE_MEMORY_PATH;

const rangeOptions: Array<{ id: HomeRange; label: string }> = [
  { id: "today", label: "今日" },
  { id: "week", label: "本周" },
  { id: "month", label: "本月" },
  { id: "all", label: "全部" },
];
const HOME_RANGE_STORAGE_KEY = "sentura:cbe:employee:home-range:v1";

function isHomeRange(value: unknown): value is HomeRange {
  return rangeOptions.some((item) => item.id === value);
}

function customerHighlightHref(
  scope: CustomerHighlightScope,
  range: HomeRange,
  options: {
    customerId?: string;
    status?: CustomerListItem["screeningStatus"];
  } = {},
) {
  const params = new URLSearchParams({
    highlight: scope,
    highlightRange: range,
  });
  if (options.customerId) params.set("highlightCustomer", options.customerId);
  if (options.status) params.set("highlightStatus", options.status);
  return `${customerPagePath}?${params.toString()}`;
}

function memoryHighlightHref() {
  return `${memoryPagePath}?highlight=memory-results`;
}

function parseFoundAt(value: string) {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const offset = day === 0 ? 6 : day - 1;
  next.setDate(next.getDate() - offset);
  return next;
}

function isInHomeRange(foundAt: string, range: HomeRange, now = new Date()) {
  if (range === "all") return true;
  const foundDate = parseFoundAt(foundAt);
  if (!foundDate) return true;
  if (range === "today") return foundDate >= startOfDay(now);
  if (range === "week") return foundDate >= startOfWeek(now);
  return foundDate.getFullYear() === now.getFullYear() && foundDate.getMonth() === now.getMonth();
}

function CrossBorderEmployeeHomeContent() {
  const searchParams = useSearchParams();
  const customerRows = useCbeEmployeeStore((store) => store.rows);
  const memoryRows = useCbeEmployeeStore((store) => store.memoryRows);
  const tasks = useCbeEmployeeStore((store) => store.tasks);
  const setRows = useCbeEmployeeStore((store) => store.setRows);
  const setMemoryRows = useCbeEmployeeStore((store) => store.setMemoryRows);
  const setTasks = useCbeEmployeeStore((store) => store.setTasks);
  const markTaskNotificationsRead = useCbeEmployeeStore((store) => store.markTaskNotificationsRead);
  const deleteTaskNotifications = useCbeEmployeeStore((store) => store.deleteTaskNotifications);
  const [selectedRange, setSelectedRange] = usePersistentUiState<HomeRange>(
    HOME_RANGE_STORAGE_KEY,
    "month",
    isHomeRange,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const sessionDisplayName = useCbeSessionDisplayName("operator");
  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(() => new Set());
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const [costHighlightActive, setCostHighlightActive] = useState(false);
  const handledCostHighlightRef = useRef<string | null>(null);
  const shouldHighlightCost = searchParams.get(EMPLOYEE_API_COST_HIGHLIGHT_PARAM) === "api";
  const costHighlightMessageId = searchParams.get("highlightMessage");

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const [customers, memory, latestTasks] = await Promise.all([
          fetchEmployeeCustomers(),
          fetchEmployeeMemoryRecords(),
          fetchEmployeeTasks(),
        ]);
        if (cancelled) return;
        setRows(customers);
        setMemoryRows(memory);
        setTasks(latestTasks);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "客户状态读取失败。");
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [setMemoryRows, setRows, setTasks]);

  useEffect(() => {
    let cancelled = false;
    async function refreshSessionName() {
      try {
        const response = await fetch(`${CBE_SESSION_API_PATH}?role=operator`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        const displayName = typeof body?.user?.displayName === "string"
          ? body.user.displayName.trim()
          : "";
        if (!cancelled && response.ok && body?.user?.cbeRole === "operator" && displayName) {
          setCbeSessionDisplayName("operator", displayName);
        }
      } catch {
        // Keep the already-confirmed name stable; AppShell handles auth redirects.
      }
    }
    void refreshSessionName();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const highlightKey = shouldHighlightCost ? `${costHighlightMessageId ?? ""}|api` : "";
    if (!shouldHighlightCost || handledCostHighlightRef.current === highlightKey) return;
    handledCostHighlightRef.current = highlightKey;
    setCostHighlightActive(true);
    window.requestAnimationFrame(() => {
      document.getElementById(EMPLOYEE_API_COST_ELEMENT_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    const timer = window.setTimeout(() => setCostHighlightActive(false), 3000);
    return () => window.clearTimeout(timer);
  }, [costHighlightMessageId, shouldHighlightCost]);

  const visibleCustomers = useMemo(
    () => customerRows.filter((item) => isInHomeRange(item.foundAt, selectedRange)),
    [customerRows, selectedRange],
  );
  const selectedRangeLabel = rangeOptions.find((item) => item.id === selectedRange)?.label ?? "本月";
  const screenedCustomers = visibleCustomers.filter((item) => item.screeningStatus === "screened");
  const highScoreCustomers = visibleCustomers.filter((item) => item.scoreTier === "high");
  const pendingCustomers = visibleCustomers.filter(
    (item) => item.screeningStatus === "not_started" || item.screeningStatus === "insufficient_evidence",
  );
  const pendingPage = usePagedItems(pendingCustomers, 10);
  const highScorePage = usePagedItems(highScoreCustomers, 10);
  const taskMessages = useMemo(
    () =>
      tasks
        .filter((task) => !isCbeEmployeeTaskActive(task))
        .sort((left, right) => (right.completedAt ?? right.updatedAt) - (left.completedAt ?? left.updatedAt)),
    [tasks],
  );
  const allMessagesDeleting = taskMessages.length > 0 && taskMessages.every((item) => deletingMessageIds.has(item.id));
  const latestLeadFailure = useMemo(
    () =>
      tasks
        .filter((task) => task.kind === "lead" && task.status === "failed")
        .sort((left, right) => right.updatedAt - left.updatedAt)[0],
    [tasks],
  );

  const stats = [
    {
      label: "找到客户",
      value: visibleCustomers.length,
      note: `${selectedRangeLabel}找到的潜在客户`,
      icon: Search,
      href: customerHighlightHref("lead-results", selectedRange),
    },
    {
      label: "已完成背调",
      value: screenedCustomers.length,
      note: "已完成核验的客户",
      icon: ShieldCheck,
      href: customerHighlightHref("screening-results", selectedRange),
    },
    {
      label: "记忆整理",
      value: memoryRows.length,
      note: "已整理的聊天记录",
      icon: Database,
      href: memoryHighlightHref(),
    },
    {
      label: "优先跟进客户",
      value: highScoreCustomers.length,
      note: "建议优先跟进",
      icon: TrendingUp,
      href: customerHighlightHref("trusted", selectedRange),
    },
  ];

  const funnel = [
    { label: "未背调", count: visibleCustomers.filter((item) => item.screeningStatus === "not_started").length, tone: "bg-[var(--sentura-blue-glow)]" },
    { label: "背调中", count: visibleCustomers.filter((item) => item.screeningStatus === "running").length, tone: "bg-sky-400" },
    { label: "高分", count: visibleCustomers.filter((item) => item.scoreTier === "high").length, tone: "bg-emerald-500" },
    { label: "中等", count: visibleCustomers.filter((item) => item.scoreTier === "medium").length, tone: "bg-amber-500" },
    { label: "低分", count: visibleCustomers.filter((item) => item.scoreTier === "low").length, tone: "bg-rose-500" },
    { label: "证据不足", count: visibleCustomers.filter((item) => item.screeningStatus === "insufficient_evidence").length, tone: "bg-[var(--sentura-muted)]" },
  ];

  async function deleteMessages(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;
    setMessageActionError(null);
    setDeletingMessageIds((current) => new Set([...current, ...uniqueIds]));
    try {
      const result = await deleteEmployeeNotifications(uniqueIds);
      deleteTaskNotifications(result.deletedIds);
    } catch (error) {
      setMessageActionError(error instanceof Error ? error.message : "消息删除失败。");
    } finally {
      setDeletingMessageIds((current) => {
        const next = new Set(current);
        for (const id of uniqueIds) next.delete(id);
        return next;
      });
    }
  }

  async function markMessagesRead(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;
    markTaskNotificationsRead(uniqueIds);
    try {
      const result = await markEmployeeNotificationsRead(uniqueIds);
      if (result.readIds.length > 0) {
        markTaskNotificationsRead(result.readIds);
      }
    } catch {
      // Keep local read state; the next refresh reconciles with the server.
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{employeeProfile.role}</Badge>
            <Badge variant="outline">{employeeProfile.tenant}</Badge>
          </div>
          <h1 className="mt-3 min-h-8 text-2xl font-semibold tracking-normal">
            你好{sessionDisplayName ? `，${sessionDisplayName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            当前查看 {selectedRangeLabel} 数据。建议优先处理待背调、失败或需补充线索的客户。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rangeOptions.map((item) => (
            <Button
              key={item.id}
              variant={selectedRange === item.id ? "default" : "outline"}
              size="sm"
              aria-pressed={selectedRange === item.id}
              onClick={() => setSelectedRange(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </section>

      {loadError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {loadError}
        </div>
      ) : null}

      {!loadError && customerRows.length === 0 ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          {latestLeadFailure
            ? `客户库还没有客户；最近一次找客户失败，未写入客户：${latestLeadFailure.message}`
            : "客户库还没有客户；完成一次找客户任务后会显示在这里。"}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className="h-full transition-colors hover:border-primary/30">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{item.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.note}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-base">待处理事项</CardTitle>
              <div className="flex items-center gap-2">
                {pendingCustomers.length > 0 ? <span className="sentura-alert-dot" aria-hidden="true" /> : null}
                <Badge variant={pendingCustomers.length > 0 ? "secondary" : "outline"}>
                  {pendingCustomers.length} 项
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {pendingCustomers.length > 0 ? (
                <>
                  <AnimatedList viewportClassName="space-y-2 overflow-visible" displayScrollbar={false} scrollable={false}>
                    {pendingPage.items.map((item) => (
	                    <Link
	                      key={item.customerId}
	                      href={customerHighlightHref("pending", selectedRange, {
	                        customerId: item.customerId,
	                        status: item.screeningStatus,
	                      })}
	                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
	                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.companyName}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.recommendedAction}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                    ))}
                  </AnimatedList>
                  <ListPagination
                    page={pendingPage.page}
                    totalItems={pendingPage.totalItems}
                    pageSize={pendingPage.pageSize}
                    onPageChange={pendingPage.setPage}
                  />
                </>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  当前范围没有待处理客户。
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">优先跟进客户</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {highScoreCustomers.length > 0 ? (
                <>
                  <AnimatedList viewportClassName="space-y-2 overflow-visible" displayScrollbar={false} scrollable={false}>
                    {highScorePage.items.map((item) => (
	                    <Link
	                      key={item.customerId}
	                      href={customerHighlightHref("trusted", selectedRange, { customerId: item.customerId })}
	                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950 hover:bg-emerald-100/70"
	                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.companyName}</div>
                        <div className="mt-0.5 truncate text-xs opacity-80">{item.recommendedAction}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-background/70">
                        {item.normalizedScore ?? "N/A"}/100
                      </Badge>
                    </Link>
                    ))}
                  </AnimatedList>
                  <ListPagination
                    page={highScorePage.page}
                    totalItems={highScorePage.totalItems}
                    pageSize={highScorePage.pageSize}
                    onPageChange={highScorePage.setPage}
                  />
                </>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  当前范围暂无优先跟进客户。
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <div
            id={EMPLOYEE_API_COST_ELEMENT_ID}
            className={cn("scroll-mt-24 rounded-lg", costHighlightActive && EMPLOYEE_NOTIFICATION_HIGHLIGHT_CLASS)}
          >
            <EmployeeCostCard compact range={selectedRange} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">我的客户漏斗</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <AnimatedList viewportClassName="space-y-3 overflow-visible" displayScrollbar={false}>
                {funnel.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="font-mono text-muted-foreground">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className={cn("h-2 rounded-full", item.tone)} style={{ width: `${Math.min(100, Math.max(8, item.count * 20))}%` }} />
                    </div>
                  </div>
                ))}
              </AnimatedList>
            </CardContent>
          </Card>

          <Card id="employee-messages" className="scroll-mt-24">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-base">消息提醒</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{taskMessages.length}</Badge>
                {taskMessages.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={allMessagesDeleting}
                    onClick={() => void deleteMessages(taskMessages.map((item) => item.id))}
                  >
                    {allMessagesDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    全部删除
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {messageActionError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {messageActionError}
                </div>
              ) : null}
              {taskMessages.length > 0 ? (
                <AnimatedList
                  className="rounded-md"
                  viewportClassName="max-h-[360px] space-y-2 overscroll-contain pr-1"
                  showGradients
                >
                  {taskMessages.map((item) => (
                    <div key={item.id} className="rounded-md border px-3 py-2 text-sm">
                      <div className="flex items-start gap-2">
                        {item.status === "failed" ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        )}
                        <Link
                          href={employeeTaskNotificationHref(item)}
                          className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => void markMessagesRead([item.id])}
                        >
                          <div className="leading-5">{item.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(item.completedAt ?? item.updatedAt))} · {item.status === "failed" ? item.message : item.targetLabel ?? item.message}
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`删除消息：${item.title}`}
                          title="删除消息"
                          disabled={deletingMessageIds.has(item.id)}
                          onClick={() => void deleteMessages([item.id])}
                        >
                          {deletingMessageIds.has(item.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </AnimatedList>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  暂无任务通知。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default function CrossBorderEmployeeHomePage() {
  return (
    <Suspense fallback={null}>
      <CrossBorderEmployeeHomeContent />
    </Suspense>
  );
}
