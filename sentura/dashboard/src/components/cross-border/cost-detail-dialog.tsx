"use client";

import { useMemo, type ReactNode } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CostEvent } from "@/lib/gateway";
import { cn } from "@/lib/utils";
import type { ExportFormat } from "@/components/cross-border/document-export";
import { AnimatedTableRow } from "@/components/cross-border/animated-list";

export type CostDetailRangeKey = "today" | "week" | "month" | "all";

export const costDetailRanges: Array<{ key: CostDetailRangeKey; label: string }> = [
  { key: "today", label: "今日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "all", label: "全部" },
];

export interface CostSourceBreakdownItem {
  label: string;
  amountUsd: number;
  note: string;
}

export interface CostDetailSummary {
  spendUsd: number;
  totalTokens: number;
  totalCalls: number;
  unpricedCalls: number;
  events: CostEvent[];
}

export interface CostDetailExportSnapshot {
  range: CostDetailRangeKey;
  rangeLabel: string;
  summary: CostDetailSummary;
  sourceBreakdown: CostSourceBreakdownItem[];
}

export interface CostDetailBudget {
  period: "month";
  baseLimitUsd: number;
  activeAllowanceUsd: number;
  limitUsd: number;
  limitEnabled: boolean;
  remainingUsd: number | null;
}

interface CostDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  events: CostEvent[];
  range: CostDetailRangeKey;
  onRangeChange: (range: CostDetailRangeKey) => void;
  loading?: boolean;
  highlight?: boolean;
  technicalDescription?: string;
  emptyMessage?: string;
  outsideScopeCount?: number;
  dataSourceNote?: string;
  exportDisabled?: boolean;
  costBudget?: CostDetailBudget;
  actions?: ReactNode;
  onRefresh?: () => void | Promise<void>;
  onExport?: (format: ExportFormat, snapshot: CostDetailExportSnapshot) => void;
}

function startOfLocalDay(now = new Date()) {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfLocalWeek(now = new Date()) {
  const value = startOfLocalDay(now);
  const day = value.getDay();
  const daysSinceMonday = (day + 6) % 7;
  value.setDate(value.getDate() - daysSinceMonday);
  return value;
}

function startOfLocalMonth(now = new Date()) {
  const value = startOfLocalDay(now);
  value.setDate(1);
  return value;
}

function rangeStartMs(range: CostDetailRangeKey, now = new Date()) {
  if (range === "today") return startOfLocalDay(now).getTime();
  if (range === "week") return startOfLocalWeek(now).getTime();
  if (range === "month") return startOfLocalMonth(now).getTime();
  return null;
}

function eventTimeMs(event: CostEvent) {
  const time = new Date(event.timestamp).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function filterCostEventsByRange(
  events: CostEvent[],
  range: CostDetailRangeKey,
  now = new Date(),
) {
  const start = rangeStartMs(range, now);
  const filtered = start === null
    ? events
    : events.filter((event) => eventTimeMs(event) >= start);
  return [...filtered].sort((a, b) => eventTimeMs(b) - eventTimeMs(a));
}

export function summarizeCostEvents(events: CostEvent[]): CostDetailSummary {
  const sortedEvents = [...events].sort((a, b) => eventTimeMs(b) - eventTimeMs(a));
  const totals = sortedEvents.reduce(
    (acc, event) => {
      acc.totalCalls += 1;
      acc.totalTokens += event.usage.totalTokens;
      if (event.costUsd === null) acc.unpricedCalls += 1;
      else if (event.pricingStatus !== "estimated") acc.spendUsd += event.costUsd;
      return acc;
    },
    { spendUsd: 0, totalTokens: 0, totalCalls: 0, unpricedCalls: 0 },
  );
  return { ...totals, events: sortedEvents };
}

function costEventKind(event: CostEvent) {
  return event.kind ?? "model";
}

function actualCostUsd(event: CostEvent) {
  if (event.costUsd === null || event.pricingStatus === "estimated") return 0;
  return event.costUsd;
}

export function buildCostBreakdown(events: CostEvent[]): CostSourceBreakdownItem[] {
  const modelSpend = events
    .filter((event) => costEventKind(event) === "model")
    .reduce((sum, event) => sum + actualCostUsd(event), 0);
  const externalSpend = events
    .filter((event) => costEventKind(event) === "external_api")
    .reduce((sum, event) => sum + actualCostUsd(event), 0);
  const freeExternalCalls = events.filter((event) =>
    costEventKind(event) !== "model" &&
    (event.pricingStatus === "free" || event.pricingStatus === "included") &&
    event.costUsd === 0,
  ).length;
  const unpricedExternalCalls = events.filter((event) =>
    costEventKind(event) !== "model" && event.costUsd === null,
  ).length;

  return [
    { label: "智能处理", amountUsd: modelSpend, note: "来自当前任务的实际处理用量" },
    {
      label: "外部资料查询",
      amountUsd: externalSpend,
      note:
        unpricedExternalCalls > 0
          ? `${freeExternalCalls} 次免费或套餐内查询，${unpricedExternalCalls} 次暂未折算美元`
          : `${freeExternalCalls} 次外部资料查询已记录为免费或套餐内`,
    },
  ];
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatCostTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDurationMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

const costAgentLabels: Record<string, string> = {
  "cbe-lead-discovery": "获客",
  "cbe-buyer-screening": "背调",
  "cbe-accio-memory": "聊天整理",
};

function costSourceLabel(event: CostEvent) {
  if (event.source === "external_tool_log") return "外部资料查询";
  if (event.source === "session_log") return "智能处理记录";
  return "实时记录";
}

function costServiceLabel(event: CostEvent) {
  if (costEventKind(event) === "model") return event.model;
  return event.service ?? event.provider;
}

function costUsageLabel(event: CostEvent) {
  if (costEventKind(event) === "model") {
    return `${event.usage.totalTokens.toLocaleString("zh-CN")} 用量单位`;
  }
  if (event.externalUsage?.label) return event.externalUsage.label;
  if (event.externalUsage) {
    return `${event.externalUsage.quantity.toLocaleString("zh-CN")} ${event.externalUsage.unit}`;
  }
  return "--";
}

function costAmountLabel(event: CostEvent) {
  if (event.pricingStatus === "estimated" && event.costUsd !== null) return `预计 ${formatUsd(event.costUsd)}`;
  if (event.costUsd !== null) return formatUsd(event.costUsd);
  return "未折算";
}

export function CostDetailDialog({
  open,
  onOpenChange,
  title = "成本明细",
  description = "逐条展示已记录的智能处理和外部资料查询费用；已发生的实际费用计入已用，预计和暂未折算的项目单独展示。",
  events,
  range,
  onRangeChange,
  loading = false,
  highlight = false,
  technicalDescription,
  emptyMessage = "当前范围还没有实际成本记录。",
  outsideScopeCount = 0,
  dataSourceNote,
  exportDisabled = false,
  costBudget,
  actions,
  onRefresh,
  onExport,
}: CostDetailDialogProps) {
  const rangeLabel = costDetailRanges.find((item) => item.key === range)?.label ?? "本月";
  const summary = useMemo(
    () => summarizeCostEvents(filterCostEventsByRange(events, range)),
    [events, range],
  );
  const sourceBreakdown = useMemo(() => buildCostBreakdown(summary.events), [summary.events]);
  const exportSnapshot = useMemo<CostDetailExportSnapshot>(
    () => ({
      range,
      rangeLabel,
      summary,
      sourceBreakdown,
    }),
    [range, rangeLabel, sourceBreakdown, summary],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="isolate flex max-h-[86vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader className="relative z-20 shrink-0 bg-popover/95 pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border bg-muted/20 p-0.5">
              {costDetailRanges.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={range === item.key ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5"
                  aria-pressed={range === item.key}
                  onClick={() => onRangeChange(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            {onExport ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportDisabled}
                  onClick={() => onExport("docx", exportSnapshot)}
                >
                  <Download className="h-3.5 w-3.5" />
                  导出 DOCX
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportDisabled}
                  onClick={() => onExport("pdf", exportSnapshot)}
                >
                  <Download className="h-3.5 w-3.5" />
                  导出 PDF
                </Button>
              </>
            ) : null}
            {actions}
          </div>
          {dataSourceNote ? <p className="mt-2 text-xs text-muted-foreground">{dataSourceNote}</p> : null}
          {technicalDescription ? (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">查看技术详情</summary>
              <p className="mt-1">{technicalDescription}</p>
            </details>
          ) : null}
        </DialogHeader>

        <div className={cn(
          "relative z-10 grid shrink-0 gap-2 bg-popover/95",
          costBudget ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
        )}>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">{rangeLabel}已用</div>
            <div className="mt-1 font-mono text-lg font-semibold">{formatUsd(summary.spendUsd)}</div>
          </div>
          {costBudget ? (
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">本月额度</div>
              <div className="mt-1 font-mono text-lg font-semibold">
                {costBudget.limitEnabled ? formatUsd(costBudget.limitUsd) : "不限额"}
              </div>
            </div>
          ) : null}
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">调用次数</div>
            <div className="mt-1 font-mono text-lg font-semibold">{summary.totalCalls}</div>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">{costBudget ? "剩余额度" : "智能处理用量"}</div>
            <div className="mt-1 font-mono text-lg font-semibold">
              {costBudget
                ? costBudget.limitEnabled
                  ? formatUsd(costBudget.remainingUsd ?? Math.max(0, costBudget.limitUsd - summary.spendUsd))
                  : "不限额"
                : formatCompact(summary.totalTokens)}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "relative isolate min-h-[220px] flex-1 overflow-auto overscroll-contain rounded-md border bg-background transition-[background-color,box-shadow] duration-200 [scrollbar-gutter:stable]",
            highlight && "bg-sky-50 shadow-[inset_0_0_0_2px_rgba(14,165,233,0.35)]",
          )}
          aria-live="polite"
        >
          {summary.events.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
              {outsideScopeCount > 0
                ? ` 已隐藏 ${outsideScopeCount} 条不属于当前任务范围的历史记录。`
                : null}
            </div>
          ) : (
            <table className="w-full min-w-[680px] text-sm">
              <thead className="sticky top-0 z-10 bg-background/95 text-xs text-muted-foreground shadow-[0_1px_0_var(--sentura-border)] backdrop-blur">
                <tr>
                  <th className="px-3 py-2 text-left">时间</th>
                  <th className="px-3 py-2 text-left">任务</th>
                  <th className="px-3 py-2 text-left">服务项目</th>
                  <th className="px-3 py-2 text-right">用量</th>
                  <th className="px-3 py-2 text-right">耗时</th>
                  <th className="px-3 py-2 text-right">成本</th>
                </tr>
              </thead>
              <tbody>
                {summary.events.map((event, index) => (
                  <AnimatedTableRow key={event.id} index={index} preserveTableRowBase={false} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{formatCostTime(event.timestamp)}</td>
                    <td className="px-3 py-2">{costAgentLabels[event.agentId] ?? event.agentId}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{costServiceLabel(event)}</div>
                      <details className="mt-1 text-[11px] text-muted-foreground">
                        <summary className="cursor-pointer">技术详情</summary>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="h-5 rounded px-1.5 text-[10px]">
                            {costSourceLabel(event)}
                          </Badge>
                        </div>
                        {event.pricingNote ? (
                          <div className="mt-1 max-w-[320px] leading-4">
                            {event.pricingNote}
                          </div>
                        ) : null}
                      </details>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{costUsageLabel(event)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{formatDurationMs(event.durationMs)}</td>
                    <td className="px-3 py-2 text-right font-mono">{costAmountLabel(event)}</td>
                  </AnimatedTableRow>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {onRefresh ? (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="self-end">
            <RefreshCw className={cn("h-3.5 w-3.5", (loading || highlight) && "animate-spin")} />
            {loading ? "正在刷新" : "刷新明细"}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
