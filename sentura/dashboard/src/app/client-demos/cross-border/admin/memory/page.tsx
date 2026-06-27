"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Loader2, MessageSquareText, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  MemoryChatCustomerList,
  type MemoryChatCustomerRecord,
} from "@/components/cross-border/memory-chat-customer-list";
import {
  fetchAdminOperatorMemoryImportPayload,
  fetchAdminOperatorMemoryRecords,
  fetchAdminOperators,
  type AdminOperatorRow,
} from "../_data/admin-api";
import type { MemoryRecordItem } from "../../employee/_data/employee-data";
import { cn } from "@/lib/utils";

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function operatorStatusLabel(status: unknown) {
  return status === "active" ? "正常" : "已停用";
}

function chatRecordCount(operator: AdminOperatorRow) {
  return n(operator.all_chat_record_count);
}

function chatCustomerCount(operator: AdminOperatorRow) {
  return n(operator.all_chat_customer_count);
}

function attachOperator(records: MemoryRecordItem[], operator: AdminOperatorRow): MemoryChatCustomerRecord[] {
  return records.map((record) => ({
    ...record,
    ownerUserId: operator.user_id,
    ownerName: operator.display_name,
    teamName: operator.team_name ?? null,
  }));
}

export default function AdminMemoryPage() {
  const [operators, setOperators] = useState<AdminOperatorRow[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [records, setRecords] = useState<MemoryRecordItem[]>([]);
  const [allRecords, setAllRecords] = useState<MemoryChatCustomerRecord[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingAllRecords, setLoadingAllRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOperator = useMemo(
    () => operators.find((operator) => operator.user_id === selectedOperatorId) ?? null,
    [operators, selectedOperatorId],
  );

  const stats = useMemo(() => {
    const totalChats = operators.reduce((sum, operator) => sum + chatRecordCount(operator), 0);
    const analyzedCustomers = operators.reduce((sum, operator) => sum + chatCustomerCount(operator), 0);
    const activeOperators = operators.filter((operator) => operator.status === "active").length;
    return { totalChats, analyzedCustomers, activeOperators };
  }, [operators]);

  const ownerOptions = useMemo(
    () => operators.map((operator) => ({
      value: operator.user_id,
      label: operator.display_name,
    })),
    [operators],
  );

  const refreshAllRecords = useCallback(async (nextOperators: AdminOperatorRow[]) => {
    setLoadingAllRecords(true);
    try {
      const pages = await Promise.all(
        nextOperators.map(async (operator) =>
          attachOperator(await fetchAdminOperatorMemoryRecords(operator.user_id), operator),
        ),
      );
      setAllRecords(pages.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : "全部聊天客户列表加载失败。");
      setAllRecords([]);
    } finally {
      setLoadingAllRecords(false);
    }
  }, []);

  const refreshOperators = useCallback(async () => {
    setLoadingOperators(true);
    setError(null);
    try {
      const result = await fetchAdminOperators();
      setOperators(result.items);
      setSelectedOperatorId((current) => {
        if (current && result.items.some((operator) => operator.user_id === current)) return current;
        return null;
      });
      if (result.items.length === 0) {
        setRecords([]);
        setAllRecords([]);
        setMemoryDialogOpen(false);
      } else {
        void refreshAllRecords(result.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工记忆列表加载失败。");
      setAllRecords([]);
    } finally {
      setLoadingOperators(false);
    }
  }, [refreshAllRecords]);

  const loadMemorySourcePayload = useCallback((record: MemoryChatCustomerRecord) => {
    const operatorId = record.ownerUserId ?? selectedOperatorId;
    const importId = record.importId ?? record.recordId;
    if (!operatorId) throw new Error("无法确认该聊天记录所属员工。");
    return fetchAdminOperatorMemoryImportPayload(operatorId, importId);
  }, [selectedOperatorId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refreshOperators(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [refreshOperators]);

  useEffect(() => {
    if (!selectedOperatorId) return;
    const operatorId = selectedOperatorId;
    let cancelled = false;
    async function refreshRecords() {
      setLoadingRecords(true);
      setError(null);
      try {
        const nextRecords = await fetchAdminOperatorMemoryRecords(operatorId);
        if (!cancelled) setRecords(nextRecords);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "该员工聊天客户列表加载失败。");
          setRecords([]);
        }
      } finally {
        if (!cancelled) setLoadingRecords(false);
      }
    }
    void refreshRecords();
    return () => {
      cancelled = true;
    };
  }, [selectedOperatorId]);

  function openOperatorMemory(operatorId: string) {
    if (operatorId !== selectedOperatorId) setRecords([]);
    setSelectedOperatorId(operatorId);
    setMemoryDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">记忆整理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按员工账户查看聊天记录数，并在总表中筛选所有员工的聊天客户。
          </p>
        </div>
        <Button variant="outline" onClick={refreshOperators} disabled={loadingOperators}>
          {loadingOperators ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          刷新
        </Button>
      </section>

      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card size="sm">
          <CardHeader><CardTitle>员工账户</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <UsersRound className="h-5 w-5 text-primary" />
            {stats.activeOperators}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>聊天记录数</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <MessageSquareText className="h-5 w-5 text-primary" />
            {stats.totalChats}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>已整理客户</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <Database className="h-5 w-5 text-primary" />
            {stats.analyzedCustomers}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>员工账户列表</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {operators.map((operator) => {
              const selected = memoryDialogOpen && operator.user_id === selectedOperatorId;
              return (
                <button
                  key={operator.user_id}
                  type="button"
                  className={cn(
                    "block w-full rounded-md border bg-white/70 p-3 text-left text-sm shadow-sm shadow-sky-950/5 transition-colors hover:border-sky-200 hover:bg-sky-50/50",
                    selected ? "border-primary bg-sky-50/70" : "border-border",
                  )}
                  onClick={() => openOperatorMemory(operator.user_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{operator.display_name}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {operator.team_name ?? operator.user_id}
                      </span>
                    </span>
                    <Badge
                      variant={operator.status === "active" ? "outline" : "destructive"}
                      className={operator.status === "active" ? "shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700" : "shrink-0"}
                    >
                      {operatorStatusLabel(operator.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-muted/35 px-2 py-1.5">
                      <div className="text-xs text-muted-foreground">聊天记录数</div>
                      <div className="font-semibold">{chatRecordCount(operator)}</div>
                    </div>
                    <div className="rounded-md bg-muted/35 px-2 py-1.5">
                      <div className="text-xs text-muted-foreground">已整理客户</div>
                      <div className="font-semibold">{chatCustomerCount(operator)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {!loadingOperators && operators.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无员工账户。</div>
            ) : null}
            {loadingOperators ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">正在加载员工数据...</div>
            ) : null}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>负责人</TableHead>
                  <TableHead>团队</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>聊天记录数</TableHead>
                  <TableHead>已整理客户</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((operator, index) => {
                  const selected = memoryDialogOpen && operator.user_id === selectedOperatorId;
                  return (
                    <AnimatedTableRow
                      key={operator.user_id}
                      index={index}
                      className={selected ? "bg-sky-50/70" : undefined}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="text-left font-medium text-primary hover:underline"
                          onClick={() => openOperatorMemory(operator.user_id)}
                        >
                          {operator.display_name}
                        </button>
                        <div className="text-xs text-muted-foreground">{operator.user_id}</div>
                      </TableCell>
                      <TableCell>{operator.team_name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={operator.status === "active" ? "outline" : "destructive"}
                          className={operator.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : undefined}
                        >
                          {operatorStatusLabel(operator.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{chatRecordCount(operator)}</TableCell>
                      <TableCell>{chatCustomerCount(operator)}</TableCell>
                      <TableCell>
                        <Button
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          onClick={() => openOperatorMemory(operator.user_id)}
                        >
                          打开列表
                        </Button>
                      </TableCell>
                    </AnimatedTableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!loadingOperators && operators.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无员工账户。</div>
            ) : null}
            {loadingOperators ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">正在加载员工数据...</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {loadingAllRecords ? (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在加载全部聊天客户列表
        </div>
      ) : (
        <MemoryChatCustomerList
          records={allRecords}
          storageKeyPrefix="sentura:cbe:admin:memory:all"
          title="全部聊天客户列表"
          description="汇总所有员工已分析聊天客户；筛选逻辑与管理端客户列表保持一致，可按负责人、国家、类型、产品和客户信息筛选。"
          emptyDescription="暂无已分析聊天客户，或当前筛选条件下没有匹配结果。"
          pageSize={10}
          layout="table"
          ownerOptions={ownerOptions}
          loadSourcePayload={loadMemorySourcePayload}
        />
      )}

      <Dialog
        open={memoryDialogOpen && Boolean(selectedOperator)}
        onOpenChange={(open) => {
          setMemoryDialogOpen(open);
          if (!open) setAnalysisDialogOpen(false);
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg p-0 sm:max-h-[calc(100dvh-4rem)] sm:max-w-6xl">
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 z-10 bg-[#020817]/25 opacity-0 backdrop-blur-sm transition-opacity duration-150",
              analysisDialogOpen ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "relative z-0 flex min-h-0 flex-1 flex-col transition duration-150",
              analysisDialogOpen ? "brightness-90 blur-[1px]" : "brightness-100 blur-0",
            )}
          >
            <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-5">
              {loadingRecords ? (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="w-fit gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    正在加载
                  </Badge>
                </div>
              ) : null}
              <DialogTitle className="break-words text-xl font-semibold tracking-normal">
                {selectedOperator ? `${selectedOperator.display_name} 的聊天客户列表` : "聊天客户列表"}
              </DialogTitle>
              <DialogDescription>
                与员工端列表、筛选、分析模板和完整聊天记录查看保持一致。
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              {selectedOperator ? (
                <MemoryChatCustomerList
                  records={records}
                  storageKeyPrefix={`sentura:cbe:admin:memory:${selectedOperator.user_id}`}
                  title="聊天客户列表"
                  description=""
                  emptyDescription="该员工暂无已分析聊天客户，或当前筛选条件下没有匹配结果。"
                  loadSourcePayload={loadMemorySourcePayload}
                  onAnalysisOpenChange={setAnalysisDialogOpen}
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
