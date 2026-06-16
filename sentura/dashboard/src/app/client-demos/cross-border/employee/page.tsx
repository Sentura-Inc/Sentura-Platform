"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeCostCard } from "@/components/cross-border/employee-cost";
import { useCbeEmployeeStore } from "@/stores/use-cbe-employee-store";
import {
  employeeMessages,
  employeeProfile,
  memoryRows,
} from "./_data/employee-data";
import { cn } from "@/lib/utils";

type HomeRange = "today" | "week" | "month" | "all";

const rangeOptions: Array<{ id: HomeRange; label: string }> = [
  { id: "today", label: "今日" },
  { id: "week", label: "本周" },
  { id: "month", label: "本月" },
  { id: "all", label: "全部" },
];

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

export default function CrossBorderEmployeeHomePage() {
  const customerRows = useCbeEmployeeStore((store) => store.rows);
  const [selectedRange, setSelectedRange] = useState<HomeRange>("month");
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

  const stats = [
    {
      label: "获客结果",
      value: visibleCustomers.length,
      note: `${selectedRangeLabel}获客员工找到的潜在客户`,
      icon: Search,
      href: "/client-demos/cross-border/employee/customers",
    },
    {
      label: "背调结果",
      value: screenedCustomers.length,
      note: "背调员工深度调研客户",
      icon: ShieldCheck,
      href: "/client-demos/cross-border/employee/customers",
    },
    {
      label: "记忆整理",
      value: memoryRows.length,
      note: "记忆员工整理聊天记录",
      icon: Database,
      href: "/client-demos/cross-border/employee/memory",
    },
    {
      label: "高可信客户",
      value: highScoreCustomers.length,
      note: "高可信候选客户",
      icon: TrendingUp,
      href: "/client-demos/cross-border/employee/customers",
    },
  ];

  const funnel = [
    { label: "未背调", count: visibleCustomers.filter((item) => item.screeningStatus === "not_started").length, tone: "bg-slate-200" },
    { label: "背调中", count: visibleCustomers.filter((item) => item.screeningStatus === "running").length, tone: "bg-sky-400" },
    { label: "高分", count: visibleCustomers.filter((item) => item.scoreTier === "high").length, tone: "bg-emerald-500" },
    { label: "中等", count: visibleCustomers.filter((item) => item.scoreTier === "medium").length, tone: "bg-amber-500" },
    { label: "低分", count: visibleCustomers.filter((item) => item.scoreTier === "low").length, tone: "bg-rose-500" },
    { label: "证据不足", count: visibleCustomers.filter((item) => item.screeningStatus === "insufficient_evidence").length, tone: "bg-zinc-400" },
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{employeeProfile.role}</Badge>
            <Badge variant="outline">{employeeProfile.tenant}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">你好，{employeeProfile.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            当前查看 {selectedRangeLabel} 数据，优先处理待背调客户、失败任务和需要补充线索的记录。
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-base">待处理事项</CardTitle>
              <Badge variant={pendingCustomers.length > 0 ? "secondary" : "outline"}>
                {pendingCustomers.length} 项
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {pendingCustomers.length > 0 ? (
                pendingCustomers.map((item) => (
                  <Link
                    key={item.customerId}
                    href="/client-demos/cross-border/employee/customers"
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.companyName}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.recommendedAction}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  当前范围没有待处理客户。
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">高可信客户</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {highScoreCustomers.length > 0 ? (
                highScoreCustomers.map((item) => (
                  <Link
                    key={item.customerId}
                    href="/client-demos/cross-border/employee/customers"
                    className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950 hover:bg-emerald-100/70"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.companyName}</div>
                      <div className="mt-0.5 truncate text-xs opacity-80">{item.recommendedAction}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0 bg-background/70">
                      {item.normalizedScore ?? "N/A"}/100
                    </Badge>
                  </Link>
                ))
              ) : (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  当前范围暂无高可信客户。
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <EmployeeCostCard compact />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">我的客户漏斗</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {funnel.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-mono text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className={cn("h-2 rounded-full", item.tone)} style={{ width: `${Math.max(8, item.count * 20)}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="employee-messages" className="scroll-mt-24">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-base">消息提醒</CardTitle>
              <Badge variant="secondary">{employeeMessages.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {employeeMessages.map((item, index) => (
                <div key={item.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-start gap-2">
                    {index === 1 ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                    <div className="min-w-0">
                      <div className="leading-5">{item.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.time} · {item.target}</div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
