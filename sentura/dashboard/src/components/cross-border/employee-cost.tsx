"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, DollarSign, Loader2, RefreshCw, Send, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CostEvent } from "@/lib/gateway";
import { cn } from "@/lib/utils";
import { monthlyCostBudget } from "@/app/client-demos/cross-border/employee/_data/employee-data";
import {
  fetchEmployeeCostBudget,
  fetchEmployeeCostEvents,
  requestEmployeeCostAllowance,
  type EmployeeCostBudgetSnapshot,
} from "@/app/client-demos/cross-border/employee/_data/employee-api";
import {
  exportEmployeeCostDocument,
  type ExportFormat,
} from "@/components/cross-border/document-export";
import {
  buildCostBreakdown,
  CostDetailDialog,
  CostEstimateHelp,
  costDetailRanges,
  filterCostEventsByRange,
  formatCompact,
  formatCostEventPeriod,
  formatEstimatedUsd,
  formatUsd,
  getCostEventPeriod,
  summarizeCostEvents,
  type CostDetailExportSnapshot,
  type CostDetailRangeKey,
  type CostSourceBreakdownItem,
} from "@/components/cross-border/cost-detail-dialog";

const EMPLOYEE_COST_REFRESH_INTERVAL_MS = 15_000;
const EMPLOYEE_COST_METRIC_MAX_FONT_PX = 26;
const EMPLOYEE_COST_METRIC_MIN_FONT_PX = 12;
const EMPLOYEE_COST_METRIC_CARD_CLASS = "flex min-h-[112px] min-w-0 flex-col rounded-md border bg-muted/20 p-3.5";

interface EmployeeCostSnapshot {
  spendUsd: number;
  totalTokens: number;
  totalCalls: number;
  unpricedCalls: number;
  source: "recorded" | "empty" | "unavailable";
  sourceBreakdown: CostSourceBreakdownItem[];
  events: CostEvent[];
  scopedSessionCount: number;
  outsideScopeCount: number;
}

type EmployeeCostBudgetView = EmployeeCostBudgetSnapshot | {
  period: "month";
  baseLimitUsd: number;
  activeAllowanceUsd: number;
  limitUsd: number;
  limitEnabled: boolean;
  warningRatio: number;
  hardStopRatio: number;
  spendUsd: number;
  remainingUsd: number | null;
  updatedAt: string | null;
  source: "fallback";
};

function emptyCostSnapshot(source: EmployeeCostSnapshot["source"]): EmployeeCostSnapshot {
  return {
    spendUsd: 0,
    totalTokens: 0,
    totalCalls: 0,
    unpricedCalls: 0,
    source,
    sourceBreakdown: buildCostBreakdown([]),
    events: [],
    scopedSessionCount: 0,
    outsideScopeCount: 0,
  };
}

function fallbackCostBudget(): EmployeeCostBudgetView {
  return {
    ...monthlyCostBudget,
    baseLimitUsd: monthlyCostBudget.limitUsd,
    activeAllowanceUsd: 0,
    limitEnabled: true,
    spendUsd: 0,
    remainingUsd: monthlyCostBudget.limitUsd,
    updatedAt: null,
    source: "fallback",
  };
}

export { formatUsd } from "@/components/cross-border/cost-detail-dialog";

function costBudgetRatio(spendUsd: number, budget: EmployeeCostBudgetView) {
  if (!budget.limitEnabled || budget.limitUsd <= 0) return 0;
  return spendUsd / budget.limitUsd;
}

function formatBudgetLimit(budget: EmployeeCostBudgetView) {
  return budget.limitEnabled ? formatUsd(budget.limitUsd) : "不限额";
}

function formatBudgetRemaining(spendUsd: number, budget: EmployeeCostBudgetView) {
  if (!budget.limitEnabled) return "不限额";
  return formatUsd(Math.max(0, budget.limitUsd - spendUsd));
}

function useSharedMetricFontSize(values: readonly string[]) {
  const frameRefs = useRef<Array<HTMLDivElement | null>>([]);
  const valueRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [fontSize, setFontSize] = useState(EMPLOYEE_COST_METRIC_MAX_FONT_PX);
  const signature = values.join("\u001f");

  useEffect(() => {
    let animationFrame = 0;
    const applyFontSize = (nextSize: number) => {
      valueRefs.current.forEach((element) => {
        if (element) element.style.fontSize = `${nextSize}px`;
      });
    };
    const fit = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        applyFontSize(EMPLOYEE_COST_METRIC_MAX_FONT_PX);
        let nextSize = EMPLOYEE_COST_METRIC_MAX_FONT_PX;
        for (let index = 0; index < values.length; index += 1) {
          const frame = frameRefs.current[index];
          const element = valueRefs.current[index];
          const availableWidth = frame?.clientWidth ?? 0;
          if (!element || availableWidth <= 0) continue;
          const contentWidth = element.scrollWidth;
          if (contentWidth > availableWidth) {
            nextSize = Math.min(
              nextSize,
              Math.max(
                EMPLOYEE_COST_METRIC_MIN_FONT_PX,
                Math.floor((availableWidth / contentWidth) * EMPLOYEE_COST_METRIC_MAX_FONT_PX * 0.96),
              ),
            );
          }
        }
        applyFontSize(nextSize);
        setFontSize((current) => (current === nextSize ? current : nextSize));
      });
    };

    frameRefs.current.length = values.length;
    valueRefs.current.length = values.length;
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    frameRefs.current.forEach((frame) => {
      if (frame) resizeObserver?.observe(frame);
    });
    fit();
    return () => {
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [signature, values.length]);

  const registerFrame = useCallback((index: number, node: HTMLDivElement | null) => {
    frameRefs.current[index] = node;
  }, []);

  const registerValue = useCallback((index: number, node: HTMLDivElement | null) => {
    valueRefs.current[index] = node;
  }, []);

  return { fontSize, registerFrame, registerValue };
}

function ResponsiveMetricValue({
  index,
  value,
  fontSize,
  registerFrame,
  registerValue,
}: {
  index: number;
  value: string;
  fontSize: number;
  registerFrame: (index: number, node: HTMLDivElement | null) => void;
  registerValue: (index: number, node: HTMLDivElement | null) => void;
}) {

  return (
    <div ref={(node) => registerFrame(index, node)} className="mt-2 max-w-full min-w-0 overflow-hidden">
      <div
        ref={(node) => registerValue(index, node)}
        className="w-max max-w-none whitespace-nowrap font-mono font-semibold leading-tight tracking-normal tabular-nums"
        style={{ fontSize }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function AllowanceRequestDialog({
  open,
  onOpenChange,
  costBudget,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costBudget: EmployeeCostBudgetView;
  onSubmitted: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("20");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
      setNotice(null);
    }
    onOpenChange(nextOpen);
  }

  async function submit() {
    const requestedAllowanceUsd = Number(amount);
    const normalizedReason = reason.trim();
    if (!Number.isFinite(requestedAllowanceUsd) || requestedAllowanceUsd <= 0) {
      setError("请输入大于 0 的临时额度。");
      return;
    }
    if (normalizedReason.length < 2) {
      setError("请填写申请理由。");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await requestEmployeeCostAllowance({ requestedAllowanceUsd, reason: normalizedReason });
      setNotice("申请已提交，管理员可以在费用监控里查看并审批。");
      setReason("");
      await onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "额度申请提交失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>申请临时额度</DialogTitle>
          <DialogDescription>
            当前本月额度 {formatBudgetLimit(costBudget)}，已用 {formatUsd(costBudget.spendUsd)}，请填写需要增加的额度和原因。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {notice ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <label className="block space-y-1">
            <span className="text-sm font-medium">申请增加额度（美元）</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="例如 20"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">申请理由</span>
            <textarea
              className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="例如：本月需要批量背调新获客客户，当前额度不足以完成筛选。"
            />
            <span className="block text-right text-xs text-muted-foreground">{reason.length}/500</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交申请
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useEmployeeCostSnapshot() {
  const [snapshot, setSnapshot] = useState<EmployeeCostSnapshot>(() => emptyCostSnapshot("unavailable"));
  const [costBudget, setCostBudget] = useState<EmployeeCostBudgetView>(() => fallbackCostBudget());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [costEventsPage, nextBudget] = await Promise.all([
        fetchEmployeeCostEvents().catch(() => null),
        fetchEmployeeCostBudget().catch(() => null),
      ]);
      if (nextBudget) setCostBudget(nextBudget);
      if (!costEventsPage) {
        setSnapshot({
          ...emptyCostSnapshot("unavailable"),
          spendUsd: nextBudget?.spendUsd ?? 0,
        });
        return;
      }
      const scopedEvents = costEventsPage.events;
      const monthEvents = filterCostEventsByRange(scopedEvents, "month");
      const allSummary = summarizeCostEvents(scopedEvents);
      const monthSummary = summarizeCostEvents(monthEvents);
      if (monthEvents.length > 0) {
        setSnapshot({
          ...monthSummary,
          spendUsd: nextBudget?.spendUsd ?? monthSummary.spendUsd,
          events: allSummary.events,
          source: "recorded",
          sourceBreakdown: buildCostBreakdown(monthEvents),
          scopedSessionCount: costEventsPage.scopedSessionCount,
          outsideScopeCount: costEventsPage.outsideScopeCount,
        });
      } else {
        setSnapshot({
          ...emptyCostSnapshot("empty"),
          spendUsd: nextBudget?.spendUsd ?? 0,
          events: allSummary.events,
          scopedSessionCount: costEventsPage.scopedSessionCount,
          outsideScopeCount: costEventsPage.outsideScopeCount,
        });
      }
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "成本数据读取失败";
      setError(message);
      setSnapshot(emptyCostSnapshot("unavailable"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void refresh();
    };
    const initial = window.setTimeout(run, 0);
    const timer = window.setInterval(run, EMPLOYEE_COST_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const ratio = costBudgetRatio(snapshot.spendUsd, costBudget);
  const status = !costBudget.limitEnabled
    ? "ok"
    : ratio >= costBudget.hardStopRatio
      ? "blocked"
      : ratio >= costBudget.warningRatio
        ? "warning"
        : "ok";

  return { snapshot, costBudget, ratio, status, loading, error, refresh };
}

export function EmployeeCostMini({ subjectLabel = "员工端" }: { subjectLabel?: string }) {
  const { snapshot, costBudget, ratio, status, loading, refresh } = useEmployeeCostSnapshot();
  const [open, setOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [detailRange, setDetailRange] = useState<CostDetailRangeKey>("month");
  const [detailsFlash, setDetailsFlash] = useState(false);
  const detailsFlashTimerRef = useRef<number | null>(null);
  const percent = Math.min(100, Math.round(ratio * 100));

  const flashDetails = useCallback(() => {
    if (detailsFlashTimerRef.current !== null) {
      window.clearTimeout(detailsFlashTimerRef.current);
    }
    setDetailsFlash(true);
    detailsFlashTimerRef.current = window.setTimeout(() => {
      setDetailsFlash(false);
      detailsFlashTimerRef.current = null;
    }, 520);
  }, []);

  const refreshDetails = useCallback(async () => {
    flashDetails();
    await refresh();
  }, [flashDetails, refresh]);

  const exportDetails = useCallback((format: ExportFormat, detail: CostDetailExportSnapshot) => {
    exportEmployeeCostDocument({
      range: detail.range,
      rangeLabel: detail.rangeLabel,
      rangePeriodLabel: detail.rangePeriodLabel,
      costFilterLabel: detail.costFilterLabel,
      subjectLabel,
      spendUsd: detail.summary.spendUsd,
      totalTokens: detail.summary.totalTokens,
      totalCalls: detail.summary.totalCalls,
      unpricedCalls: detail.summary.unpricedCalls,
      events: detail.summary.events,
      sourceBreakdown: detail.sourceBreakdown,
      scopedSessionCount: snapshot.scopedSessionCount,
      outsideScopeCount: snapshot.outsideScopeCount,
      costBudget: {
        period: costBudget.period,
        baseLimitUsd: costBudget.baseLimitUsd,
        activeAllowanceUsd: costBudget.activeAllowanceUsd,
        limitUsd: costBudget.limitUsd,
        limitEnabled: costBudget.limitEnabled,
        remainingUsd: costBudget.remainingUsd,
        source: costBudget.source,
        updatedAt: costBudget.updatedAt,
      },
    }, format);
  }, [costBudget, snapshot, subjectLabel]);

  useEffect(() => {
    return () => {
      if (detailsFlashTimerRef.current !== null) {
        window.clearTimeout(detailsFlashTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="hidden min-w-[220px] items-center gap-3 rounded-md border bg-background px-3 py-2 text-left transition-[border-color,box-shadow,transform] duration-150 hover:scale-[1.03] hover:border-primary/40 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.99] md:flex"
        aria-label="查看成本明细"
        onClick={() => setOpen(true)}
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            status === "blocked"
              ? "bg-rose-50 text-rose-700"
              : status === "warning"
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700",
          )}
        >
          <WalletCards className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">工具成本</span>
            <span className="font-mono text-muted-foreground">{costBudget.limitEnabled ? `${percent}%` : "不限额"}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div
              className={cn(
                "h-1.5 rounded-full",
                status === "blocked" ? "bg-rose-500" : status === "warning" ? "bg-amber-500" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{formatUsd(snapshot.spendUsd)}</span>
            <span>剩余 {formatBudgetRemaining(snapshot.spendUsd, costBudget)}</span>
          </div>
        </div>
      </button>

      <CostDetailDialog
        open={open}
        onOpenChange={setOpen}
        events={snapshot.events}
        range={detailRange}
        onRangeChange={setDetailRange}
        loading={loading}
        highlight={detailsFlash}
        outsideScopeCount={snapshot.outsideScopeCount}
        costBudget={{
          period: costBudget.period,
          baseLimitUsd: costBudget.baseLimitUsd,
          activeAllowanceUsd: costBudget.activeAllowanceUsd,
          limitUsd: costBudget.limitUsd,
          limitEnabled: costBudget.limitEnabled,
          remainingUsd: costBudget.remainingUsd,
        }}
        technicalDescription="明细来自后端统一归属到当前员工的费用记录，并和管理员费用监控使用同一口径。需估算的费用不会计入已用。"
        emptyMessage="当前范围还没有实际成本记录。"
        actions={(
          <Button type="button" variant="outline" size="sm" onClick={() => setRequestOpen(true)}>
            <WalletCards className="h-3.5 w-3.5" />
            申请额度
          </Button>
        )}
        onRefresh={refreshDetails}
        onExport={exportDetails}
      />
      <AllowanceRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        costBudget={costBudget}
        onSubmitted={refreshDetails}
      />
    </>
  );
}
export function EmployeeCostCard({
  compact = false,
  range = "month",
}: {
  compact?: boolean;
  range?: CostDetailRangeKey;
}) {
  const { snapshot, costBudget, loading, error, refresh } = useEmployeeCostSnapshot();
  const [requestOpen, setRequestOpen] = useState(false);
  const rangeLabel = costDetailRanges.find((item) => item.key === range)?.label ?? "本月";
  const rangeEvents = useMemo(() => filterCostEventsByRange(snapshot.events, range), [range, snapshot.events]);
  const rangeSummary = useMemo(() => summarizeCostEvents(rangeEvents), [rangeEvents]);
  const rangeBreakdown = useMemo(() => buildCostBreakdown(rangeSummary.events), [rangeSummary.events]);
  const monthEvents = useMemo(() => filterCostEventsByRange(snapshot.events, "month"), [snapshot.events]);
  const monthSummary = useMemo(() => summarizeCostEvents(monthEvents), [monthEvents]);
  const allPeriod = useMemo(() => getCostEventPeriod(rangeSummary.events), [rangeSummary.events]);
  const displaySpendUsd = range === "month" && rangeSummary.events.length === 0
    ? snapshot.spendUsd
    : rangeSummary.spendUsd;
  const isAllRange = range === "all";
  const monthlySpendUsd = monthSummary.events.length === 0 ? snapshot.spendUsd : monthSummary.spendUsd;
  const displaySpendLabel = formatUsd(displaySpendUsd);
  const estimatedCostLabel = formatEstimatedUsd(rangeSummary.estimatedCostUsd);
  const budgetLimitLabel = formatBudgetLimit(costBudget);
  const budgetRemainingLabel = formatBudgetRemaining(monthlySpendUsd, costBudget);
  const metricValues = useMemo(
    () => isAllRange
      ? [displaySpendLabel, estimatedCostLabel]
      : [displaySpendLabel, estimatedCostLabel, budgetLimitLabel, budgetRemainingLabel],
    [budgetLimitLabel, budgetRemainingLabel, displaySpendLabel, estimatedCostLabel, isAllRange],
  );
  const metricFont = useSharedMetricFontSize(metricValues);
  const monthlyRatio = costBudgetRatio(monthlySpendUsd, costBudget);
  const monthlyStatus = !costBudget.limitEnabled
      ? "ok"
      : monthlyRatio >= costBudget.hardStopRatio
        ? "blocked"
        : monthlyRatio >= costBudget.warningRatio
          ? "warning"
          : "ok";
  const percent = Math.min(100, Math.round(monthlyRatio * 100));
  const sourceLabel =
    snapshot.source === "recorded" ? "实时记录" : snapshot.source === "empty" ? "暂无记录" : "暂不可用";
  const costNotice =
    error
      ? "费用记录暂时不可用；恢复后会读取实际费用。"
      : snapshot.source === "unavailable"
        ? "正在等待实际费用记录。"
      : snapshot.source === "empty"
        ? snapshot.outsideScopeCount > 0
          ? `当前员工本月没有实际费用记录；已隐藏 ${snapshot.outsideScopeCount} 条未归属记录，避免混入口径。`
          : "当前员工本月还没有实际费用；已用显示为 0，且不包含需估算任务或演示预算。"
        : monthlyStatus === "blocked"
          ? "额度已达上限，高成本任务将被禁用。"
          : "额度接近 80%，建议控制批量背调和付费数据。";

  return (
    <Card className="overflow-hidden">
      <CardContent className={cn("space-y-4 p-5 sm:p-6", compact && isAllRange && "min-h-[470px]")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <DollarSign className="h-4 w-4 text-primary" />
              我的工具成本
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              只统计系统已记录到当前员工的实际费用；需估算的费用不计入已用
            </p>
          </div>
          <Badge variant={snapshot.source === "recorded" ? "secondary" : "outline"}>
            {sourceLabel}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className={EMPLOYEE_COST_METRIC_CARD_CLASS}>
            <div className="text-[11px] text-muted-foreground">{isAllRange ? "总已用费用" : `${rangeLabel}已用`}</div>
            <ResponsiveMetricValue index={0} value={displaySpendLabel} {...metricFont} />
          </div>
          <div className={EMPLOYEE_COST_METRIC_CARD_CLASS}>
            <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              需估算的费用
              <CostEstimateHelp />
            </div>
            <ResponsiveMetricValue index={1} value={estimatedCostLabel} {...metricFont} />
            <div className="mt-1 text-[11px] text-muted-foreground">
              {rangeSummary.unpricedCalls > 0 ? `仍有 ${rangeSummary.unpricedCalls} 次未估算` : `${rangeSummary.estimatedCalls} 次已估算`}
            </div>
          </div>
          {!isAllRange ? (
            <div className={EMPLOYEE_COST_METRIC_CARD_CLASS}>
              <div className="text-[11px] text-muted-foreground">本月额度</div>
              <ResponsiveMetricValue index={2} value={budgetLimitLabel} {...metricFont} />
            </div>
          ) : null}
          {!isAllRange ? (
            <div className={EMPLOYEE_COST_METRIC_CARD_CLASS}>
              <div className="text-[11px] text-muted-foreground">本月剩余</div>
              <ResponsiveMetricValue index={3} value={budgetRemainingLabel} {...metricFont} />
            </div>
          ) : null}
          {isAllRange ? (
            <div className="min-w-0 rounded-md border bg-muted/20 p-4 sm:col-span-2">
              <div className="text-[11px] text-muted-foreground">全部周期</div>
              <div className="mt-2 break-words font-mono text-sm font-semibold leading-relaxed">{formatCostEventPeriod(allPeriod)}</div>
            </div>
          ) : null}
        </div>

        {!isAllRange ? (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>本月额度使用</span>
            <span className="font-mono text-muted-foreground">{costBudget.limitEnabled ? `${percent}%` : "不限额"}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={cn(
                "h-2 rounded-full",
                monthlyStatus === "blocked" ? "bg-rose-500" : monthlyStatus === "warning" ? "bg-amber-500" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span title="系统处理任务时产生的本月用量。">{formatCompact(monthSummary.totalTokens)} 本月用量单位</span>
            <span>
              剩余 {budgetRemainingLabel}
              {monthSummary.unpricedCalls > 0 ? ` · ${monthSummary.unpricedCalls} 次未估算` : ""}
            </span>
          </div>
        </div>
        ) : null}

        {monthlyStatus !== "ok" || error || snapshot.source !== "recorded" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{costNotice}</span>
            </div>
          </div>
        ) : null}

        {!compact && !isAllRange && (
          <div className="space-y-2">
            {rangeBreakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{item.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{item.note}</div>
                </div>
                <div className="font-mono text-sm">{formatUsd(item.amountUsd)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            刷新费用
          </Button>
          <Button size="sm" onClick={() => setRequestOpen(true)}>
            <WalletCards className="h-3.5 w-3.5" />
            申请额度
          </Button>
        </div>
      </CardContent>
      <AllowanceRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        costBudget={costBudget}
        onSubmitted={refresh}
      />
    </Card>
  );
}

export function TaskCostNotice({
  label,
  estimatedUsd,
  details,
  source = "预算模型",
}: {
  label: string;
  estimatedUsd: number;
  details: string;
  source?: string;
}) {
  const { snapshot, costBudget } = useEmployeeCostSnapshot();
  const projected = snapshot.spendUsd + estimatedUsd;
  const blocked = costBudget.limitEnabled && projected >= costBudget.limitUsd;

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        blocked ? "border-rose-200 bg-rose-50 text-rose-900" : "border-sky-200 bg-sky-50 text-sky-950",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">{label}需估算费用</div>
          <Badge variant="outline" className="mt-1 bg-background/70 text-[11px]">
            {source}
          </Badge>
        </div>
        <div className="font-mono">{formatUsd(estimatedUsd)}</div>
      </div>
      <p className="mt-1 text-xs opacity-80">
        这是提交前估算，实际费用以任务完成后的记录为准。
      </p>
      <details className="mt-1 text-xs opacity-80">
        <summary className="cursor-pointer">费用怎么算</summary>
        <p className="mt-1">{details}</p>
      </details>
      <p className="mt-2 text-xs opacity-80">
        {costBudget.limitEnabled
          ? `按预算预留后约 ${formatUsd(projected)} / ${formatBudgetLimit(costBudget)}${blocked ? "，已超过账号上限。" : "。"}`
          : `按预算预留后约 ${formatUsd(projected)}，当前未启用账号成本上限。`}
      </p>
      <p className="mt-1 text-xs opacity-80">
        需估算值不会写入工具成本；实际费用只在任务完成并产生记录后累加。
      </p>
    </div>
  );
}
