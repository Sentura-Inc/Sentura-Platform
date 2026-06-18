"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  decideCostApproval,
  fetchAdminCosts,
  updateAdminCostAllowance,
  updateAdminCostLimit,
  type AdminApprovalRow,
  type AdminCostRow,
} from "../_data/admin-api";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";

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

export default function AdminCostsPage() {
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedHighlights, setDismissedHighlights] = useState<Set<string>>(() => new Set());

  const highlightedApprovalId = searchParams.get("highlightApproval");
  const highlightedSection = searchParams.get("notify");

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
      if (!options.background) setError(err instanceof Error ? err.message : "成本数据加载失败。");
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

  function dismissHighlight(key: string) {
    setDismissedHighlights((current) => new Set(current).add(key));
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">成本监控</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            真实外部账本优先，缺少真实账本时标注为任务估算；页面每 15 秒刷新。
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
          <CardHeader><CardTitle>总成本消耗池</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(pool.spendUsd)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>总基础限额</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(pool.baseLimitUsd)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>总临时额度</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(pool.activeAllowanceUsd)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>剩余额度</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(pool.remainingUsd)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>员工实时消耗</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>员工</TableHead>
                <TableHead>真实成本</TableHead>
                <TableHead>估算成本</TableHead>
                <TableHead>未定价调用</TableHead>
                <TableHead>活跃任务</TableHead>
                <TableHead>基础限额</TableHead>
                <TableHead className="w-[220px]">临时额度</TableHead>
                <TableHead>剩余</TableHead>
                <TableHead className="w-[220px]">限额设置（月限额）</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.user_id}>
                  <TableCell>
                    <div className="font-medium">{item.display_name}</div>
                    <div className="text-xs text-muted-foreground">{String(item.team_name ?? item.user_id)}</div>
                  </TableCell>
                  <TableCell>{usd(item.actual_cost_usd)}</TableCell>
                  <TableCell>
                    <div>{usd(item.estimated_cost_usd)}</div>
                    {item.estimated_cost_usd > 0 ? <Badge variant="outline">estimated</Badge> : null}
                  </TableCell>
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
                </TableRow>
              ))}
              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">暂无成本数据。</TableCell>
                </TableRow>
              ) : null}
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">正在加载成本数据...</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card
        id="pending-approvals"
        className={highlightFrameClass(highlightedSection === "approvals" && !highlightedApprovalId && !dismissedHighlights.has("approvals"))}
        onClick={() => dismissHighlight("approvals")}
      >
        <CardHeader>
          <CardTitle>待审批超额申请</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>员工</TableHead>
                <TableHead>任务</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>预估成本</TableHead>
                <TableHead>请求额度</TableHead>
                <TableHead>目标</TableHead>
                <TableHead className="text-right">处理</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval) => {
                const activeHighlight = highlightedApprovalId === approval.id && !dismissedHighlights.has(`approval:${approval.id}`);
                return (
                <TableRow
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
                  <TableCell>{usd(approval.estimated_cost_usd)}</TableCell>
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
                </TableRow>
              );
              })}
              {approvals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">暂无待审批申请。</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
