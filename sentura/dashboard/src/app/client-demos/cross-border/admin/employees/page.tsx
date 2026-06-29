"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Plus, RefreshCw, Trash2, UserX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedList, AnimatedTableRow } from "@/components/cross-border/animated-list";
import { AdminCustomerListTable } from "../_components/customer-list-table";
import {
  createAdminOperator,
  deleteAdminOperators,
  fetchAdminOperator,
  fetchAdminOperators,
  updateAdminOperator,
  type AdminCustomerRow,
  type AdminOperatorRow,
} from "../_data/admin-api";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";

type RangeKey = "today" | "week" | "month" | "all";

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "今日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "all", label: "全部" },
];
const ADMIN_EMPLOYEE_RANGE_STORAGE_KEY = "sentura:cbe:admin:employees-range:v1";
const MAX_OPERATOR_ACCOUNTS = 20;

function isRangeKey(value: unknown): value is RangeKey {
  return ranges.some((item) => item.key === value);
}

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  const rounded = Math.round((n(value) + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function usd(value: unknown) {
  return `US$${money(value).toFixed(2)}`;
}

function operatorStatusLabel(status: unknown) {
  return status === "active" ? "正常" : "已停用";
}

export default function AdminEmployeesPage() {
  const [range, setRange] = usePersistentUiState<RangeKey>(
    ADMIN_EMPLOYEE_RANGE_STORAGE_KEY,
    "month",
    isRangeKey,
  );
  const [operators, setOperators] = useState<AdminOperatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [detail, setDetail] = useState<{
    profile: AdminOperatorRow | null;
    customers: AdminCustomerRow[];
    workload: Record<string, unknown>[];
  } | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    password: "",
    teamName: "",
    monthLimit: "",
  });

  const rangePrefix = range === "all" ? "all" : range;
  const remainingOperatorSlots = Math.max(0, MAX_OPERATOR_ACCOUNTS - operators.length);
  const selectedOperators = useMemo(
    () => operators.filter((operator) => selectedOperatorIds.has(operator.user_id)),
    [operators, selectedOperatorIds],
  );
  const allVisibleSelected = operators.length > 0 && operators.every((operator) => selectedOperatorIds.has(operator.user_id));

  const totals = useMemo(() => {
    return operators.reduce(
      (acc, operator) => {
        acc.leads += n(operator[`${rangePrefix}_lead_count`]);
        acc.screenings += n(operator[`${rangePrefix}_screening_count`]);
        acc.cost += n(operator[`${rangePrefix}_cost_usd`]);
        acc.pending += n(operator.pending_approval_count);
        return acc;
      },
      { leads: 0, screenings: 0, cost: 0, pending: 0 },
    );
  }, [operators, rangePrefix]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminOperators();
      setOperators(result.items);
      setSelectedOperatorIds((current) => {
        const validIds = new Set(result.items.map((operator) => operator.user_id));
        return new Set(Array.from(current).filter((id) => validIds.has(id)));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工列表加载失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initialLoad);
  }, []);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    try {
      setDetail(await fetchAdminOperator(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工详情加载失败。");
    }
  }

  async function submitCreate() {
    if (!form.displayName.trim()) {
      setError("请填写员工姓名。");
      return;
    }
    if (!form.password.trim()) {
      setError("请填写员工登录密码。");
      return;
    }
    setBusy("create");
    setError(null);
    setCreateNotice(null);
    try {
      if (remainingOperatorSlots <= 0) {
        setError(`员工账号上限为 ${MAX_OPERATOR_ACCOUNTS} 个，请先删除不需要的员工。`);
        return;
      }
      const initialLimits = form.monthLimit.trim()
        ? [
            {
              period: "month",
              limit_usd: money(form.monthLimit),
              enabled: true,
            },
          ]
        : [];
      const result = await createAdminOperator({
        display_name: form.displayName.trim(),
        password: form.password,
        team_name: form.teamName.trim() || undefined,
        initial_limits: initialLimits,
      });
      setCreateNotice(`员工 ${result.operator.display_name ?? form.displayName.trim()} 已创建，可用员工姓名和管理者设置的密码登录。`);
      setForm({ displayName: "", password: "", teamName: "", monthLimit: "" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工创建失败。");
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus(operator: AdminOperatorRow) {
    const nextStatus = operator.status === "active" ? "suspended" : "active";
    setBusy(operator.user_id);
    setError(null);
    try {
      await updateAdminOperator(operator.user_id, { status: nextStatus });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工状态更新失败。");
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(operator: AdminOperatorRow) {
    const password = (passwordDrafts[operator.user_id] ?? "").trim();
    if (!password) {
      setError(`请为 ${operator.display_name} 输入新密码。`);
      return;
    }
    if (password.length < 4) {
      setError("员工登录密码至少 4 位。");
      return;
    }
    setBusy(`password:${operator.user_id}`);
    setError(null);
    setCreateNotice(null);
    try {
      await updateAdminOperator(operator.user_id, { password });
      setPasswordDrafts((value) => {
        const next = { ...value };
        delete next[operator.user_id];
        return next;
      });
      setCreateNotice(`员工 ${operator.display_name} 的登录密码已更新。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工密码更新失败。");
    } finally {
      setBusy(null);
    }
  }

  async function confirmBatchDeleteOperators() {
    const ids = Array.from(selectedOperatorIds);
    if (ids.length === 0) return;
    setBusy("batch-delete");
    setError(null);
    setCreateNotice(null);
    try {
      await deleteAdminOperators(ids);
      setSelectedOperatorIds(new Set());
      setBatchDeleteOpen(false);
      setCreateNotice(`已删除 ${ids.length} 个员工，相关未完成任务和待审批已取消。`);
      if (selectedId && ids.includes(selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工批量删除失败。");
    } finally {
      setBusy(null);
    }
  }

  function toggleSelectedOperator(operatorId: string) {
    setSelectedOperatorIds((current) => {
      const next = new Set(current);
      if (next.has(operatorId)) next.delete(operatorId);
      else next.add(operatorId);
      return next;
    });
  }

  function toggleAllVisibleOperators() {
    setSelectedOperatorIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        operators.forEach((operator) => next.delete(operator.user_id));
        return next;
      }
      return new Set([...Array.from(current), ...operators.map((operator) => operator.user_id)]);
    });
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">员工管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            汇总每位员工的获客、背调、费用和待审批事项。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <Button
              key={item.key}
              variant={range === item.key ? "default" : "outline"}
              onClick={() => setRange(item.key)}
            >
              {item.label}
            </Button>
          ))}
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>
        </div>
      </section>

      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      {createNotice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {createNotice}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Card size="sm">
          <CardHeader><CardTitle>获客数</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.leads}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>背调数</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.screenings}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>已用费用</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{usd(totals.cost)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>待审批</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.pending}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>创建员工账户</CardTitle>
            <span className="text-sm text-muted-foreground">
              当前 {operators.length}/{MAX_OPERATOR_ACCOUNTS}，还可创建 {remainingOperatorSlots} 个
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr_130px_auto]">
          <Input placeholder="姓名" value={form.displayName} onChange={(event) => setForm((value) => ({ ...value, displayName: event.target.value }))} />
          <Input type="password" placeholder="登录密码" value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} />
          <Input placeholder="团队" value={form.teamName} onChange={(event) => setForm((value) => ({ ...value, teamName: event.target.value }))} />
          <Input type="number" min="0" step="0.01" placeholder="月限额" value={form.monthLimit} onChange={(event) => setForm((value) => ({ ...value, monthLimit: event.target.value }))} />
          <Button onClick={submitCreate} disabled={busy === "create" || remainingOperatorSlots <= 0}>
            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            创建
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>员工账户</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">已选 {selectedOperators.length} 个</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBatchDeleteOpen(true)}
                disabled={selectedOperators.length === 0 || busy === "batch-delete"}
              >
                {busy === "batch-delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                批量删除
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {operators.map((operator) => {
              const monthlyRemaining = n(operator.month_limit_usd) + n(operator.month_allowance_usd) - n(operator.month_cost_usd);
              return (
                <article key={operator.user_id} className="rounded-md border bg-white/70 p-3 shadow-sm shadow-sky-950/5">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex min-w-0 items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        aria-label={`选择员工 ${operator.display_name}`}
                        checked={selectedOperatorIds.has(operator.user_id)}
                        onChange={() => toggleSelectedOperator(operator.user_id)}
                      />
                      <span className="min-w-0">
                        <button type="button" className="block truncate text-left font-medium text-primary hover:underline" onClick={() => openDetail(operator.user_id)}>
                          {operator.display_name}
                        </button>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{operator.team_name ?? operator.user_id}</span>
                      </span>
                    </label>
                    <Badge
                      variant={operator.status === "active" ? "outline" : "destructive"}
                      className={operator.status === "active" ? "shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700" : "shrink-0"}
                    >
                      {operatorStatusLabel(operator.status)}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-muted/35 px-2 py-1.5">
                      <div className="text-xs text-muted-foreground">获客</div>
                      <div className="font-semibold">{n(operator[`${rangePrefix}_lead_count`])}</div>
                    </div>
                    <div className="rounded-md bg-muted/35 px-2 py-1.5">
                      <div className="text-xs text-muted-foreground">背调</div>
                      <div className="font-semibold">{n(operator[`${rangePrefix}_screening_count`])}</div>
                    </div>
                    <div className="rounded-md bg-muted/35 px-2 py-1.5">
                      <div className="text-xs text-muted-foreground">已用费用</div>
                      <div className="font-semibold">{usd(operator[`${rangePrefix}_cost_usd`])}</div>
                    </div>
                    <div className="rounded-md bg-muted/35 px-2 py-1.5">
                      <div className="text-xs text-muted-foreground">剩余额度</div>
                      <div className="font-semibold">{usd(monthlyRemaining)}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <Input
                      type="password"
                      className="h-9"
                      placeholder="新密码"
                      value={passwordDrafts[operator.user_id] ?? ""}
                      onChange={(event) => setPasswordDrafts((value) => ({ ...value, [operator.user_id]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void resetPassword(operator);
                        }
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => resetPassword(operator)} disabled={busy === `password:${operator.user_id}`}>
                        {busy === `password:${operator.user_id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        重置密码
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(operator)} disabled={busy === operator.user_id}>
                        {operator.status === "active" ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        {operator.status === "active" ? "暂停账号" : "恢复账号"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!loading && operators.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无员工账户。</div>
            ) : null}
            {loading ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">正在加载员工数据...</div>
            ) : null}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="选择全部员工"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleOperators}
                  />
                </TableHead>
                <TableHead>员工</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>团队</TableHead>
                <TableHead>获客</TableHead>
                <TableHead>背调</TableHead>
                <TableHead>已用费用</TableHead>
                <TableHead>本月剩余额度</TableHead>
                <TableHead>审批</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operators.map((operator, index) => {
                const monthlyRemaining = n(operator.month_limit_usd) + n(operator.month_allowance_usd) - n(operator.month_cost_usd);
                return (
                  <AnimatedTableRow key={operator.user_id} index={index}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`选择员工 ${operator.display_name}`}
                        checked={selectedOperatorIds.has(operator.user_id)}
                        onChange={() => toggleSelectedOperator(operator.user_id)}
                      />
                    </TableCell>
                    <TableCell>
                      <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => openDetail(operator.user_id)}>
                        {operator.display_name}
                      </button>
                      <div className="text-xs text-muted-foreground">{operator.team_name ?? operator.user_id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={operator.status === "active" ? "outline" : "destructive"}
                        className={operator.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : undefined}
                      >
                        {operatorStatusLabel(operator.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{operator.team_name ?? "-"}</TableCell>
                    <TableCell>{n(operator[`${rangePrefix}_lead_count`])}</TableCell>
                    <TableCell>{n(operator[`${rangePrefix}_screening_count`])}</TableCell>
                    <TableCell>{usd(operator[`${rangePrefix}_cost_usd`])}</TableCell>
                    <TableCell>{usd(monthlyRemaining)}</TableCell>
                    <TableCell>{n(operator.pending_approval_count)}</TableCell>
                    <TableCell className="min-w-[300px] text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Input
                          type="password"
                          className="h-9 w-28"
                          placeholder="新密码"
                          value={passwordDrafts[operator.user_id] ?? ""}
                          onChange={(event) => setPasswordDrafts((value) => ({ ...value, [operator.user_id]: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void resetPassword(operator);
                            }
                          }}
                        />
                        <Button variant="outline" size="sm" onClick={() => resetPassword(operator)} disabled={busy === `password:${operator.user_id}`}>
                          {busy === `password:${operator.user_id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                          重置密码
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleStatus(operator)} disabled={busy === operator.user_id}>
                          {operator.status === "active" ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          {operator.status === "active" ? "暂停账号" : "恢复账号"}
                        </Button>
                      </div>
                    </TableCell>
                  </AnimatedTableRow>
                );
              })}
              {!loading && operators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">暂无员工账户。</TableCell>
                </TableRow>
              ) : null}
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">正在加载员工数据...</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetail(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[96vw] max-w-[1280px] overflow-y-auto overscroll-contain p-0 sm:max-h-[calc(100dvh-4rem)] sm:max-w-[1280px]">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{detail?.profile?.display_name ?? "员工详情"}</DialogTitle>
            <DialogDescription>查看该员工的客户、报告和账号状态。</DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5">
            {!detail ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在加载详情
              </div>
            ) : (
              <div className="space-y-5">
                <section>
                  <h3 className="text-sm font-semibold">获客与背调列表</h3>
                  <div className="mt-2">
                    <AdminCustomerListTable customers={detail.customers} />
                  </div>
                </section>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchDeleteOpen}
        onOpenChange={(open) => {
          if (!open) setBatchDeleteOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量删除员工</DialogTitle>
            <DialogDescription>
              将删除 {selectedOperators.length} 个员工账户，未完成任务与待审批会同步取消，历史客户和费用记录会保留。
            </DialogDescription>
          </DialogHeader>
          <AnimatedList
            className="rounded-md border bg-muted/20"
            viewportClassName="max-h-48 space-y-1 p-2 text-sm"
            showGradients
          >
            {selectedOperators.map((operator) => (
              <div key={operator.user_id} className="flex items-center justify-between gap-3 py-1">
                <span>{operator.display_name}</span>
                <span className="text-xs text-muted-foreground">{operator.team_name ?? operator.user_id}</span>
              </div>
            ))}
          </AnimatedList>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteOpen(false)} disabled={busy === "batch-delete"}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmBatchDeleteOperators} disabled={selectedOperators.length === 0 || busy === "batch-delete"}>
              {busy === "batch-delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              删除所选员工
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
