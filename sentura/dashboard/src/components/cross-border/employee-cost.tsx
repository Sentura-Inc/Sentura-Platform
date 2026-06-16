"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, DollarSign, RefreshCw, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGateway } from "@/lib/gateway";
import type { CostEvent } from "@/lib/gateway";
import { cn } from "@/lib/utils";
import { employeeProfile, monthlyCostBudget } from "@/app/client-demos/cross-border/employee/_data/employee-data";

interface EmployeeCostSnapshot {
  spendUsd: number;
  totalTokens: number;
  totalCalls: number;
  unpricedCalls: number;
  source: "recorded" | "empty" | "unavailable";
  sourceBreakdown: Array<{ label: string; amountUsd: number; note: string }>;
  events: CostEvent[];
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function costEventKind(event: CostEvent) {
  return event.kind ?? "model";
}

function buildCostBreakdown(events: CostEvent[]): EmployeeCostSnapshot["sourceBreakdown"] {
  const modelSpend = events
    .filter((event) => costEventKind(event) === "model")
    .reduce((sum, event) => sum + (event.costUsd ?? 0), 0);
  const externalSpend = events
    .filter((event) => costEventKind(event) === "external_api")
    .reduce((sum, event) => sum + (event.costUsd ?? 0), 0);
  const freeExternalCalls = events.filter((event) =>
    costEventKind(event) !== "model" &&
    (event.pricingStatus === "free" || event.pricingStatus === "included") &&
    event.costUsd === 0,
  ).length;
  const unpricedExternalCalls = events.filter((event) =>
    costEventKind(event) !== "model" && event.costUsd === null,
  ).length;

  return [
    { label: "AI 员工模型", amountUsd: modelSpend, note: "来自 OpenClaw model.usage 的真实模型用量记录" },
    {
      label: "外部资料服务",
      amountUsd: externalSpend,
      note:
        unpricedExternalCalls > 0
          ? `${freeExternalCalls} 次 0 美元/套餐内调用，${unpricedExternalCalls} 次按积分或套餐未折算美元`
          : `${freeExternalCalls} 次外部资料调用已记录为 0 美元或套餐内`,
    },
  ];
}

function emptyCostSnapshot(source: EmployeeCostSnapshot["source"]): EmployeeCostSnapshot {
  return {
    spendUsd: 0,
    totalTokens: 0,
    totalCalls: 0,
    unpricedCalls: 0,
    source,
    sourceBreakdown: buildCostBreakdown([]),
    events: [],
  };
}

function summarizeEvents(events: CostEvent[]): Omit<EmployeeCostSnapshot, "source" | "sourceBreakdown"> {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const totals = sortedEvents.reduce(
    (acc, event) => {
      acc.totalCalls += 1;
      acc.totalTokens += event.usage.totalTokens;
      if (event.costUsd === null) acc.unpricedCalls += 1;
      else acc.spendUsd += event.costUsd;
      return acc;
    },
    { spendUsd: 0, totalTokens: 0, totalCalls: 0, unpricedCalls: 0 },
  );
  return { ...totals, events: sortedEvents };
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

function formatCompact(value: number) {
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
  "cbe-lead-discovery": "获客员工",
  "cbe-buyer-screening": "背调员工",
  "cbe-accio-memory": "记忆员工",
};

const costPricingLabels: Record<NonNullable<CostEvent["pricingStatus"]>, string> = {
  priced: "真实美元",
  estimated: "按官方单价估算",
  free: "0 美元",
  included: "套餐内/返回 0",
  unpriced: "未折算美元",
};

function costSourceLabel(event: CostEvent) {
  if (event.source === "external_tool_log") return "外部回填";
  if (event.source === "session_log") return "模型回填";
  return "实时记录";
}

function costServiceLabel(event: CostEvent) {
  if (costEventKind(event) === "model") return event.model;
  return event.service ?? event.provider;
}

function costOperationLabel(event: CostEvent) {
  if (costEventKind(event) === "model") return event.provider;
  return event.operation ?? event.model;
}

function costUsageLabel(event: CostEvent) {
  if (costEventKind(event) === "model") {
    return `${event.usage.totalTokens.toLocaleString("zh-CN")} tokens`;
  }
  if (event.externalUsage?.label) return event.externalUsage.label;
  if (event.externalUsage) {
    return `${event.externalUsage.quantity.toLocaleString("zh-CN")} ${event.externalUsage.unit}`;
  }
  return "--";
}

function costAmountLabel(event: CostEvent) {
  if (event.costUsd !== null) return formatUsd(event.costUsd);
  return "未折算";
}

export function useEmployeeCostSnapshot() {
  const { client, state } = useGateway();
  const [snapshot, setSnapshot] = useState<EmployeeCostSnapshot>(() => emptyCostSnapshot("unavailable"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (state !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.getCostEvents({
        userToken: employeeProfile.userToken,
        startTime: monthStartIso(),
        limit: 500,
      });
      if (result.events.length > 0) {
        const next = summarizeEvents(result.events);
        setSnapshot({
          ...next,
          source: "recorded",
          sourceBreakdown: buildCostBreakdown(next.events),
        });
      } else {
        setSnapshot(emptyCostSnapshot("empty"));
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
  }, [client, state]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void refresh();
    };
    const initial = window.setTimeout(run, 0);
    const timer = window.setInterval(run, 15_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const ratio = snapshot.spendUsd / monthlyCostBudget.limitUsd;
  const status = ratio >= monthlyCostBudget.hardStopRatio ? "blocked" : ratio >= monthlyCostBudget.warningRatio ? "warning" : "ok";

  return { snapshot, ratio, status, loading, error, refresh };
}

export function EmployeeCostMini() {
  const { snapshot, ratio, status, loading, refresh } = useEmployeeCostSnapshot();
  const [open, setOpen] = useState(false);
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
        className="hidden min-w-[220px] items-center gap-3 rounded-md border bg-background px-3 py-2 text-left transition-all duration-150 hover:scale-[1.03] hover:border-primary/40 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.99] md:flex"
        aria-label="查看本月 API 成本明细"
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
            <span className="font-medium">本月 API 成本</span>
            <span className="font-mono text-muted-foreground">{percent}%</span>
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
            <span>上限 {formatUsd(monthlyCostBudget.limitUsd)}</span>
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[86vh] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader className="pr-8">
            <DialogTitle>本月 API 成本明细</DialogTitle>
            <DialogDescription>
              逐条展示 sentura-cost 已记录的模型与外部资料服务调用；可折算美元的计入已用，免费/套餐/积分未折算会单独标明。
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">本月已用</div>
              <div className="mt-1 font-mono text-lg font-semibold">{formatUsd(snapshot.spendUsd)}</div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">调用次数</div>
              <div className="mt-1 font-mono text-lg font-semibold">{snapshot.totalCalls}</div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">模型 tokens</div>
              <div className="mt-1 font-mono text-lg font-semibold">{formatCompact(snapshot.totalTokens)}</div>
            </div>
          </div>

          <div
            className={cn(
              "min-h-[220px] flex-1 overflow-auto rounded-md border bg-background transition-[background-color,box-shadow] duration-200",
              detailsFlash && "bg-sky-50 shadow-[inset_0_0_0_2px_rgba(14,165,233,0.35)]",
            )}
            aria-live="polite"
          >
            {snapshot.events.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                本月还没有真实成本消耗记录。
              </div>
            ) : (
              <table className="w-full min-w-[680px] text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left">时间</th>
                    <th className="px-3 py-2 text-left">员工</th>
                    <th className="px-3 py-2 text-left">服务 / 接口</th>
                    <th className="px-3 py-2 text-right">用量</th>
                    <th className="px-3 py-2 text-right">耗时</th>
                    <th className="px-3 py-2 text-right">成本</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.events.map((event) => (
                    <tr key={event.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{formatCostTime(event.timestamp)}</td>
                      <td className="px-3 py-2">{costAgentLabels[event.agentId] ?? event.agentId}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{costServiceLabel(event)}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{costOperationLabel(event)}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="h-5 rounded px-1.5 text-[10px]">
                            {costSourceLabel(event)}
                          </Badge>
                          {event.pricingStatus ? (
                            <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">
                              {costPricingLabels[event.pricingStatus]}
                            </Badge>
                          ) : null}
                          {event.httpStatus ? (
                            <Badge variant="outline" className="h-5 rounded px-1.5 text-[10px]">
                              HTTP {event.httpStatus}
                            </Badge>
                          ) : null}
                        </div>
                        {event.pricingNote ? (
                          <div className="mt-1 max-w-[320px] text-[11px] leading-4 text-muted-foreground">
                            {event.pricingNote}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{costUsageLabel(event)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{formatDurationMs(event.durationMs)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {costAmountLabel(event)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={refreshDetails} disabled={loading} className="self-end">
            <RefreshCw className={cn("h-3.5 w-3.5", (loading || detailsFlash) && "animate-spin")} />
            {loading ? "正在刷新" : "刷新明细"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function EmployeeCostCard({ compact = false }: { compact?: boolean }) {
  const { snapshot, ratio, status, loading, error, refresh } = useEmployeeCostSnapshot();
  const percent = Math.min(100, Math.round(ratio * 100));
  const remaining = Math.max(0, monthlyCostBudget.limitUsd - snapshot.spendUsd);
  const sourceLabel =
    snapshot.source === "recorded" ? "实时记录" : snapshot.source === "empty" ? "暂无实时记录" : "接口未就绪";
  const costNotice =
    error
      ? "成本接口暂不可用，当前不显示演示成本；修复 sentura-cost/Gateway 后再读取真实记录。"
      : snapshot.source === "unavailable"
        ? "正在等待 sentura-cost 返回真实成本记录；接口未就绪时不使用演示金额代替。"
      : snapshot.source === "empty"
        ? "sentura-cost 当前没有本月真实模型或外部资料服务成本事件；已用显示为 0，且不包含预计任务或演示预算。"
        : status === "blocked"
          ? "额度已达上限，高成本任务将被禁用。"
          : "额度接近 80%，建议控制批量背调和付费数据。";

  return (
    <Card className="overflow-hidden">
      <CardContent className={cn("space-y-4 p-4", compact && "space-y-3")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <DollarSign className="h-4 w-4 text-primary" />
              我的 API 成本
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              显示 sentura-cost 已记录的模型和外部资料服务调用；没有真实事件时显示 0
            </p>
          </div>
          <Badge variant={snapshot.source === "recorded" ? "secondary" : "outline"}>
            {sourceLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">已用</div>
            <div className="mt-1 font-mono text-lg font-semibold">{formatUsd(snapshot.spendUsd)}</div>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">剩余</div>
            <div className="mt-1 font-mono text-lg font-semibold">{formatUsd(remaining)}</div>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">调用</div>
            <div className="mt-1 font-mono text-lg font-semibold">{snapshot.totalCalls}</div>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>本月额度使用</span>
            <span className="font-mono text-muted-foreground">{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={cn(
                "h-2 rounded-full",
                status === "blocked" ? "bg-rose-500" : status === "warning" ? "bg-amber-500" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span title="模型用量单位，主要用于估算 AI 调用成本。">{formatCompact(snapshot.totalTokens)} 用量单位</span>
            <span>{snapshot.unpricedCalls} 次未计价调用</span>
          </div>
        </div>

        {status !== "ok" || error || snapshot.source !== "recorded" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{costNotice}</span>
            </div>
          </div>
        ) : null}

        {!compact && (
          <div className="space-y-2">
            {snapshot.sourceBreakdown.map((item) => (
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

        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="w-full">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          刷新成本
        </Button>
      </CardContent>
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
  const { snapshot } = useEmployeeCostSnapshot();
  const projected = snapshot.spendUsd + estimatedUsd;
  const blocked = projected >= monthlyCostBudget.limitUsd;

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        blocked ? "border-rose-200 bg-rose-50 text-rose-900" : "border-sky-200 bg-sky-50 text-sky-950",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">{label}预算预估</div>
          <Badge variant="outline" className="mt-1 bg-background/70 text-[11px]">
            {source}
          </Badge>
        </div>
        <div className="font-mono">{formatUsd(estimatedUsd)}</div>
      </div>
      <p className="mt-1 text-xs opacity-80">{details}</p>
      <p className="mt-2 text-xs opacity-80">
        按预算预留后约 {formatUsd(projected)} / {formatUsd(monthlyCostBudget.limitUsd)}
        {blocked ? "，已超过账号上限。" : "。"}
      </p>
      <p className="mt-1 text-xs opacity-80">
        预计值不会写入本月 API 成本；实际成本只在任务产生 sentura-cost 真实调用记录后累加。
      </p>
    </div>
  );
}
