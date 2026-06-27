"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, HelpCircle, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedTableRow } from "@/components/cross-border/animated-list";
import {
  decideCostApproval,
  fetchAdminOperator,
  fetchAdminCosts,
  updateAdminCostAllowance,
  updateAdminCostLimit,
  type AdminApprovalRow,
  type AdminCostRow,
  type AdminOperatorRow,
} from "../_data/admin-api";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";
import {
  exportEmployeeCostDocument,
  type ExportFormat,
} from "@/components/cross-border/document-export";
import {
  CostDetailDialog,
  type CostDetailExportSnapshot,
  type CostDetailRangeKey,
} from "@/components/cross-border/cost-detail-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CostEvent } from "@/lib/gateway";

type RangeKey = "today" | "week" | "month" | "all";

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "今日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "all", label: "全部" },
];
const ADMIN_COST_RANGE_STORAGE_KEY = "sentura:cbe:admin:cost-range:v1";

function isRangeKey(value: unknown): value is RangeKey {
  return ranges.some((item) => item.key === value);
}

function usd(value: unknown) {
  return `US$${money(value).toFixed(2)}`;
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  const rounded = Math.round((num(value) + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function moneyInput(value: unknown) {
  return money(value).toFixed(2);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function highlightFrameClass(active: boolean) {
  return active
    ? "animate-pulse bg-sky-50/60 outline outline-2 -outline-offset-2 outline-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.22)]"
    : "";
}

function FieldHelp({ label, children }: { label: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top">{children}</TooltipContent>
    </Tooltip>
  );
}

function AdminCostsContent() {
  const searchParams = useSearchParams();
  const [range, setRange] = usePersistentUiState<RangeKey>(
    ADMIN_COST_RANGE_STORAGE_KEY,
    "month",
    isRangeKey,
  );
  const [items, setItems] = useState<AdminCostRow[]>([]);
  const [approvals, setApprovals] = useState<AdminApprovalRow[]>([]);
  const [pool, setPool] = useState<Record<string, unknown>>({});
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [allowanceInputs, setAllowanceInputs] = useState<Record<string, string>>({});
  const [approvalInputs, setApprovalInputs] = useState<Record<string, string>>({});
  const [selectedBudgetUserIds, setSelectedBudgetUserIds] = useState<Set<string>>(() => new Set());
  const [batchLimitInput, setBatchLimitInput] = useState("");
  const [batchAllowanceInput, setBatchAllowanceInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedHighlights, setDismissedHighlights] = useState<Set<string>>(() => new Set());
  const [selectedCostUserId, setSelectedCostUserId] = useState<string | null>(null);
  const [costDetailRange, setCostDetailRange] = useState<CostDetailRangeKey>("month");
  const [costDetail, setCostDetail] = useState<{
    profile: AdminOperatorRow | null;
    summary: AdminCostRow | null;
    costEvents: CostEvent[];
    costEventsSource?: "sentura_cost" | "db_fallback";
  } | null>(null);

  const highlightedApprovalId = searchParams.get("highlightApproval");
  const highlightedSection = searchParams.get("notify");
  const selectedBudgetRows = useMemo(
    () => items.filter((item) => selectedBudgetUserIds.has(item.user_id)),
    [items, selectedBudgetUserIds],
  );
  const allBudgetRowsSelected = items.length > 0 && items.every((item) => selectedBudgetUserIds.has(item.user_id));

  const refresh = useCallback(async function refresh(nextRange = range, options: { background?: boolean } = {}) {
    if (!options.background) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await fetchAdminCosts(nextRange);
      setItems((current) => (sameJson(current, result.items) ? current : result.items));
      setApprovals((current) => (sameJson(current, result.approvals) ? current : result.approvals));
      setPool((current) => (sameJson(current, result.pool) ? current : result.pool));
      setSelectedBudgetUserIds((current) => {
        const validIds = new Set(result.items.map((item) => item.user_id));
        return new Set(Array.from(current).filter((id) => validIds.has(id)));
      });
      setLimitInputs((current) => {
        const next = { ...current };
        for (const item of result.items) {
          if (next[item.user_id] === undefined) next[item.user_id] = moneyInput(item.base_limit_usd);
        }
        return next;
      });
      setAllowanceInputs((current) => {
        const next = { ...current };
        for (const item of result.items) {
          if (next[item.user_id] === undefined) next[item.user_id] = moneyInput(item.active_allowance_usd);
        }
        return next;
      });
      setApprovalInputs((current) => {
        const next = { ...current };
        for (const approval of result.approvals) {
          if (next[approval.id] === undefined) next[approval.id] = moneyInput(approval.requested_allowance_usd);
        }
        return next;
      });
    } catch (err) {
      if (!options.background) setError(err instanceof Error ? err.message : "费用数据加载失败。");
    } finally {
      if (!options.background) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(range), 0);
    const timer = window.setInterval(() => void refresh(range, { background: true }), 15_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [range, refresh]);

  useEffect(() => {
    const targetId = highlightedApprovalId
      ? `approval-${highlightedApprovalId}`
      : highlightedSection === "approvals"
        ? "pending-approvals"
        : null;
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [highlightedApprovalId, highlightedSection, approvals.length]);

  async function saveLimit(item: AdminCostRow) {
    setBusy(`limit:${item.user_id}`);
    setError(null);
    try {
      await updateAdminCostLimit({
        user_id: item.user_id,
        period: "month",
        limit_usd: money(limitInputs[item.user_id]),
        enabled: true,
      });
      await refresh(range, { background: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "限额更新失败。");
    } finally {
      setBusy(null);
    }
  }

  function toggleBudgetRow(userId: string) {
    setSelectedBudgetUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAllBudgetRows() {
    setSelectedBudgetUserIds((current) => {
      if (allBudgetRowsSelected) {
        const next = new Set(current);
        items.forEach((item) => next.delete(item.user_id));
        return next;
      }
      return new Set([...Array.from(current), ...items.map((item) => item.user_id)]);
    });
  }

  async function applyBatchBudget() {
    const hasLimit = batchLimitInput.trim() !== "";
    const hasAllowance = batchAllowanceInput.trim() !== "";
    if (selectedBudgetRows.length === 0) {
      setError("请先选择需要修改预算的员工。");
      return;
    }
    if (!hasLimit && !hasAllowance) {
      setError("请填写基础限额或临时额度，至少一项。");
      return;
    }
    if (hasLimit && !Number.isFinite(Number(batchLimitInput))) {
      setError("批量基础限额不是有效数字。");
      return;
    }
    if (hasAllowance && !Number.isFinite(Number(batchAllowanceInput))) {
      setError("批量临时额度不是有效数字。");
      return;
    }
    setBusy("batch-budget");
    setError(null);
    try {
      for (const row of selectedBudgetRows) {
        if (hasLimit) {
          await updateAdminCostLimit({
            user_id: row.user_id,
            period: "month",
            limit_usd: money(batchLimitInput),
            enabled: true,
          });
        }
        if (hasAllowance) {
          await updateAdminCostAllowance({
            user_id: row.user_id,
            period: "month",
            amount_usd: money(batchAllowanceInput),
          });
        }
      }
      if (hasLimit) {
        setLimitInputs((current) => {
          const next = { ...current };
          selectedBudgetRows.forEach((row) => {
            next[row.user_id] = moneyInput(batchLimitInput);
          });
          return next;
        });
      }
      if (hasAllowance) {
        setAllowanceInputs((current) => {
          const next = { ...current };
          selectedBudgetRows.forEach((row) => {
            next[row.user_id] = moneyInput(batchAllowanceInput);
          });
          return next;
        });
      }
      setBatchLimitInput("");
      setBatchAllowanceInput("");
      await refresh(range, { background: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量预算更新失败。");
    } finally {
      setBusy(null);
    }
  }

  async function decide(approval: AdminApprovalRow, decision: "approved" | "rejected") {
    setBusy(`approval:${approval.id}:${decision}`);
    setError(null);
    try {
      await decideCostApproval({
        request_id: approval.id,
        decision,
        approved_amount_usd: money(approvalInputs[approval.id]),
        decision_note: decision === "approved" ? "管理者批准临时额度" : "管理者拒绝超额申请",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "审批处理失败。");
    } finally {
      setBusy(null);
    }
  }

  async function saveAllowance(item: AdminCostRow) {
    setBusy(`allowance:${item.user_id}`);
    setError(null);
    try {
      await updateAdminCostAllowance({
        user_id: item.user_id,
        period: "month",
        amount_usd: money(allowanceInputs[item.user_id]),
      });
      await refresh(range, { background: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "临时额度更新失败。");
    } finally {
      setBusy(null);
    }
  }

  async function openCostDetail(item: AdminCostRow) {
    setSelectedCostUserId(item.user_id);
    setCostDetailRange(range);
    setCostDetail(null);
    setError(null);
    try {
      const detail = await fetchAdminOperator(item.user_id);
      setCostDetail({
        profile: detail.profile,
        summary: item,
        costEvents: detail.costEvents,
        costEventsSource: detail.costEventsSource,
      });
    } catch (err) {
      setSelectedCostUserId(null);
      setCostDetail(null);
      setError(err instanceof Error ? err.message : "成本明细加载失败。");
    }
  }

  function dismissHighlight(key: string) {
    setDismissedHighlights((current) => new Set(current).add(key));
  }

  function exportCostDetail(format: ExportFormat, detail: CostDetailExportSnapshot) {
    if (!costDetail) return;
    exportEmployeeCostDocument({
      rangeLabel: detail.rangeLabel,
      subjectLabel: costDetail.profile?.display_name ?? "员工",
      spendUsd: detail.summary.spendUsd,
      totalTokens: detail.summary.totalTokens,
      totalCalls: detail.summary.totalCalls,
      unpricedCalls: detail.summary.unpricedCalls,
      events: detail.summary.events,
      sourceBreakdown: detail.sourceBreakdown,
      scopedSessionCount: detail.summary.events.length,
      outsideScopeCount: 0,
      costBudget: {
        period: "month",
        baseLimitUsd: money(costDetail.summary?.base_limit_usd),
        activeAllowanceUsd: money(costDetail.summary?.active_allowance_usd),
        limitUsd: money(costDetail.summary?.base_limit_usd) + money(costDetail.summary?.active_allowance_usd),
        limitEnabled: true,
        remainingUsd: money(costDetail.summary?.remaining_usd),
        source: costDetail.costEventsSource ?? "sentura_cost",
        updatedAt: null,
      },
    }, format);
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">费用监控</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看各员工本月已用费用和额度审批。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <Button key={item.key} variant={range === item.key ? "default" : "outline"} onClick={() => setRange(item.key)}>
              {item.label}
            </Button>
          ))}
          <Button variant="outline" onClick={() => refresh()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>
        </div>
      </section>

      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Card size="sm">
          <CardHeader><CardTitle>总已用费用</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(pool.spendUsd)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              总基础额度
              <FieldHelp label="基础额度说明">员工本月默认可用预算，由管理者设置。</FieldHelp>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(pool.baseLimitUsd)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              总临时额度
              <FieldHelp label="临时额度说明">本月额外增加的预算，用于临时放宽费用上限。</FieldHelp>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(pool.activeAllowanceUsd)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>剩余额度</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(pool.remainingUsd)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>批量修改预算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">本月基础限额</div>
              <div className="relative">
                <Input
                  className="pr-7 text-right"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="不修改"
                  value={batchLimitInput}
                  onChange={(event) => setBatchLimitInput(event.target.value)}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">本月临时额度</div>
              <div className="relative">
                <Input
                  className="pr-7 text-right"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="不修改"
                  value={batchAllowanceInput}
                  onChange={(event) => setBatchAllowanceInput(event.target.value)}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={applyBatchBudget} disabled={selectedBudgetRows.length === 0 || busy === "batch-budget"}>
                {busy === "batch-budget" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                应用到 {selectedBudgetRows.length} 人
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            先在下方员工费用表勾选员工；留空的字段不会被修改。临时额度为替换当前本月临时额度。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>员工费用情况</CardTitle>
            <span className="text-sm text-muted-foreground">已选 {selectedBudgetRows.length} 人</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <article key={item.user_id} className="rounded-md border bg-white/70 p-3 shadow-sm shadow-sky-950/5">
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label={`选择 ${item.display_name} 的预算`}
                      checked={selectedBudgetUserIds.has(item.user_id)}
                      onChange={() => toggleBudgetRow(item.user_id)}
                    />
                    <span className="min-w-0">
                      <button
                        type="button"
                        className="block truncate text-left font-medium text-primary hover:underline"
                        onClick={() => openCostDetail(item)}
                      >
                        {item.display_name}
                      </button>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{String(item.team_name ?? item.user_id)}</span>
                    </span>
                  </label>
                  <Button variant="outline" size="sm" onClick={() => openCostDetail(item)}>
                    明细
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted/35 px-2 py-1.5">
                    <div className="text-xs text-muted-foreground">已发生费用</div>
                    <div className="font-semibold">{usd(item.actual_cost_usd)}</div>
                  </div>
                  <div className="rounded-md bg-muted/35 px-2 py-1.5">
                    <div className="text-xs text-muted-foreground">剩余</div>
                    <div className={cn("font-semibold", item.remaining_usd < 0 ? "text-destructive" : "")}>{usd(item.remaining_usd)}</div>
                  </div>
                  <div className="rounded-md bg-muted/35 px-2 py-1.5">
                    <div className="text-xs text-muted-foreground">暂未折算</div>
                    <div className="font-semibold">{num(item.unpriced_call_count)}</div>
                  </div>
                  <div className="rounded-md bg-muted/35 px-2 py-1.5">
                    <div className="text-xs text-muted-foreground">进行中任务</div>
                    <div className="font-semibold">{num(item.active_task_count)}</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">本月临时额度</div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <div className="relative min-w-0">
                        <Input
                          className="pr-7 text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={allowanceInputs[item.user_id] ?? moneyInput(item.active_allowance_usd)}
                          onChange={(event) => setAllowanceInputs((value) => ({ ...value, [item.user_id]: event.target.value }))}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => saveAllowance(item)} disabled={busy === `allowance:${item.user_id}`}>
                        保存
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">本月基础限额</div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <div className="relative min-w-0">
                        <Input
                          className="pr-7 text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={limitInputs[item.user_id] ?? moneyInput(item.base_limit_usd)}
                          onChange={(event) => setLimitInputs((value) => ({ ...value, [item.user_id]: event.target.value }))}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      </div>
                      <Button size="sm" onClick={() => saveLimit(item)} disabled={busy === `limit:${item.user_id}`}>
                        保存
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {!loading && items.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无费用数据。</div>
            ) : null}
            {loading ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">正在加载费用数据...</div>
            ) : null}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="选择全部费用员工"
                    checked={allBudgetRowsSelected}
                    onChange={toggleAllBudgetRows}
                  />
                </TableHead>
                <TableHead>员工</TableHead>
                <TableHead>已发生费用</TableHead>
                <TableHead>暂未折算</TableHead>
                <TableHead>进行中任务</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1.5">
                    基础额度
                    <FieldHelp label="基础额度说明">员工本月默认可用预算，由管理者设置。</FieldHelp>
                  </span>
                </TableHead>
                <TableHead className="w-[220px]">
                  <span className="inline-flex items-center gap-1.5">
                    临时额度
                    <FieldHelp label="临时额度说明">本月额外增加的预算，用于临时放宽费用上限。</FieldHelp>
                  </span>
                </TableHead>
                <TableHead>剩余</TableHead>
                <TableHead className="w-[220px]">本月限额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <AnimatedTableRow key={item.user_id} index={index}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`选择 ${item.display_name} 的预算`}
                      checked={selectedBudgetUserIds.has(item.user_id)}
                      onChange={() => toggleBudgetRow(item.user_id)}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium text-primary hover:underline"
                      onClick={() => openCostDetail(item)}
                    >
                      {item.display_name}
                    </button>
                    <div className="text-xs text-muted-foreground">{String(item.team_name ?? item.user_id)}</div>
                  </TableCell>
                  <TableCell>{usd(item.actual_cost_usd)}</TableCell>
                  <TableCell>{num(item.unpriced_call_count)}</TableCell>
                  <TableCell>{num(item.active_task_count)}</TableCell>
                  <TableCell>{usd(item.base_limit_usd)}</TableCell>
                  <TableCell className="w-[220px]">
                    <div className="flex items-center gap-2">
                      <div className="relative w-28">
                        <Input
                          className="pr-7 text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={allowanceInputs[item.user_id] ?? moneyInput(item.active_allowance_usd)}
                          onChange={(event) => setAllowanceInputs((value) => ({ ...value, [item.user_id]: event.target.value }))}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => saveAllowance(item)} disabled={busy === `allowance:${item.user_id}`}>
                        保存
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className={item.remaining_usd < 0 ? "text-destructive" : ""}>{usd(item.remaining_usd)}</TableCell>
                  <TableCell className="w-[220px]">
                    <div className="flex items-center gap-2">
                      <div className="relative w-28">
                        <Input
                          className="pr-7 text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={limitInputs[item.user_id] ?? moneyInput(item.base_limit_usd)}
                          onChange={(event) => setLimitInputs((value) => ({ ...value, [item.user_id]: event.target.value }))}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      </div>
                      <Button size="sm" onClick={() => saveLimit(item)} disabled={busy === `limit:${item.user_id}`}>
                        保存
                      </Button>
                    </div>
                  </TableCell>
                </AnimatedTableRow>
              ))}
              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">暂无费用数据。</TableCell>
                </TableRow>
              ) : null}
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">正在加载费用数据...</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <CostDetailDialog
        open={Boolean(selectedCostUserId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCostUserId(null);
            setCostDetail(null);
          }
        }}
        title={costDetail?.profile?.display_name ? `${costDetail.profile.display_name} · 成本明细` : "成本明细"}
        events={costDetail?.costEvents ?? []}
        range={costDetailRange}
        onRangeChange={setCostDetailRange}
        loading={Boolean(selectedCostUserId && !costDetail)}
        exportDisabled={!costDetail}
        dataSourceNote={
          costDetail?.costEventsSource === "db_fallback"
            ? "实时 sentura-cost 事件暂不可用；当前显示数据库费用账本回退记录，员工端恢复实时连接后会以 sentura-cost 为准。"
            : "管理端与员工端使用同一批 sentura-cost 工具成本事件。"
        }
        technicalDescription="管理端按员工处理编号关联 sentura-cost 事件；时间筛选和费用来源与员工端成本明细共用同一套展示逻辑。"
        emptyMessage={costDetail ? "当前范围暂无费用明细。" : "正在加载费用明细。"}
        onExport={exportCostDetail}
      />

      <Card
        id="pending-approvals"
        className={highlightFrameClass(highlightedSection === "approvals" && !highlightedApprovalId && !dismissedHighlights.has("approvals"))}
        onClick={() => dismissHighlight("approvals")}
      >
        <CardHeader>
          <CardTitle>待审批额度申请</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {approvals.map((approval) => {
              const activeHighlight = highlightedApprovalId === approval.id && !dismissedHighlights.has(`approval:${approval.id}`);
              return (
                <article
                  id={`approval-${approval.id}-mobile`}
                  key={approval.id}
                  className={cn("rounded-md border bg-white/70 p-3 shadow-sm shadow-sky-950/5", highlightFrameClass(activeHighlight))}
                  onClick={() => {
                    if (activeHighlight) dismissHighlight(`approval:${approval.id}`);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{approval.display_name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{approval.task_kind} · {approval.period}</div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold">{usd(approval.requested_allowance_usd)}</div>
                  </div>
                  <div className="mt-2 line-clamp-3 rounded-md bg-muted/35 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                    {approval.target_summary ?? "暂无任务内容"}
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div className="relative">
                      <Input
                        className="pr-7 text-right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={approvalInputs[approval.id] ?? moneyInput(approval.requested_allowance_usd)}
                        onChange={(event) => setApprovalInputs((value) => ({ ...value, [approval.id]: event.target.value }))}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" onClick={() => decide(approval, "approved")} disabled={busy?.startsWith(`approval:${approval.id}`)}>
                        <Check className="h-4 w-4" />
                        批准
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => decide(approval, "rejected")} disabled={busy?.startsWith(`approval:${approval.id}`)}>
                        <X className="h-4 w-4" />
                        拒绝
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
            {approvals.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无待审批申请。</div>
            ) : null}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>员工</TableHead>
                <TableHead>任务</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>请求额度</TableHead>
                <TableHead>任务内容</TableHead>
                <TableHead className="text-right">处理</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval, index) => {
                const activeHighlight = highlightedApprovalId === approval.id && !dismissedHighlights.has(`approval:${approval.id}`);
                return (
                <AnimatedTableRow
                  index={index}
                  id={`approval-${approval.id}`}
                  key={approval.id}
                  className={highlightFrameClass(activeHighlight)}
                  onClick={() => {
                    if (activeHighlight) dismissHighlight(`approval:${approval.id}`);
                  }}
                >
                  <TableCell>{approval.display_name}</TableCell>
                  <TableCell>{approval.task_kind}</TableCell>
                  <TableCell>{approval.period}</TableCell>
                  <TableCell>
                    <div className="relative w-28">
                      <Input
                        className="pr-7 text-right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={approvalInputs[approval.id] ?? moneyInput(approval.requested_allowance_usd)}
                        onChange={(event) => setApprovalInputs((value) => ({ ...value, [approval.id]: event.target.value }))}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs"><span className="line-clamp-2">{approval.target_summary ?? "-"}</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => decide(approval, "approved")} disabled={busy?.startsWith(`approval:${approval.id}`)}>
                        <Check className="h-4 w-4" />
                        批准
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => decide(approval, "rejected")} disabled={busy?.startsWith(`approval:${approval.id}`)}>
                        <X className="h-4 w-4" />
                        拒绝
                      </Button>
                    </div>
                  </TableCell>
                </AnimatedTableRow>
              );
              })}
              {approvals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">暂无待审批申请。</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminCostsPage() {
  return (
    <Suspense fallback={null}>
      <AdminCostsContent />
    </Suspense>
  );
}
