"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  FileJson,
  Filter,
  Loader2,
  RotateCcw,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAgent, useGateway } from "@/lib/gateway";
import { cn } from "@/lib/utils";
import { TaskCostNotice } from "@/components/cross-border/employee-cost";
import {
  isCbeEmployeeTaskActive,
  useCbeEmployeeStore,
} from "@/stores/use-cbe-employee-store";
import {
  type MemoryRecordItem,
  estimateMemoryTaskCost,
} from "../_data/employee-data";
import {
  ACCIO_AGENT_ID,
  EmployeeTaskError,
  createPlannedEmployeeSessionKey,
  employeeTaskErrorMessage,
  estimateEmployeeTaskTimeoutMs,
  runAccioMemoryTask,
  type AccioMemoryTaskInput,
  type EmployeeTaskProgress,
} from "../_data/employee-task-runner";
import {
  CbeEmployeeApiError,
  completeEmployeeAccioImport,
  createEmployeeAccioImport,
  failEmployeeTaskInDb,
  fetchEmployeeMemoryRecords,
  fetchEmployeeTasks,
} from "../_data/employee-api";

type SheetMode = "add" | "detail" | "filters" | null;
type ImportRange = "all" | "today" | "7d" | "30d";

interface MemoryFilters {
  sources: MemoryRecordItem["source"][];
  importRange: ImportRange;
}

const emptyFilters: MemoryFilters = {
  sources: [],
  importRange: "all",
};

const statusLabels: Record<MemoryRecordItem["analysisStatus"], string> = {
  not_started: "未分析",
  running: "分析中",
  analyzed: "已分析",
  failed: "失败",
};

const sourceLabels: Record<MemoryRecordItem["source"], string> = {
  accio: "Accio",
  alibaba_international: "阿里国际站",
  manual_import: "手动导入",
  demo_data: "演示数据",
  other: "其他",
};

const memorySourceChoices = ["Accio", "阿里国际站", "手动导入"] as const;

const importRangeLabels: Record<ImportRange, string> = {
  all: "全部时间",
  today: "今日",
  "7d": "近 7 天",
  "30d": "近 30 天",
};

function rowClass(status: MemoryRecordItem["analysisStatus"]) {
  if (status === "running") return "bg-sky-50/70";
  if (status === "analyzed") return "bg-emerald-50/70";
  if (status === "failed") return "bg-rose-50/70";
  return "bg-background";
}

function badgeClass(status: MemoryRecordItem["analysisStatus"]) {
  if (status === "running") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "analyzed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-white text-slate-700";
}

function importedAtInRange(importedAt: string, range: ImportRange) {
  if (range === "all") return true;
  const importedDate = new Date(importedAt.replace(" ", "T"));
  if (Number.isNaN(importedDate.getTime())) return true;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  if (range === "today") start.setHours(0, 0, 0, 0);
  if (range === "7d") start.setDate(end.getDate() - 6);
  if (range === "30d") start.setDate(end.getDate() - 29);
  return importedDate >= start && importedDate <= end;
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function CrossBorderMemoryPage() {
  const { client, state } = useGateway();
  const { data: accioAgent, loading: agentLoading } = useAgent("cbe-accio-memory");
  const rows = useCbeEmployeeStore((store) => store.memoryRows);
  const setRows = useCbeEmployeeStore((store) => store.setMemoryRows);
  const tasks = useCbeEmployeeStore((store) => store.tasks);
  const setTasks = useCbeEmployeeStore((store) => store.setTasks);
  const startTask = useCbeEmployeeStore((store) => store.startTask);
  const updateTaskProgress = useCbeEmployeeStore((store) => store.updateTaskProgress);
  const completeTask = useCbeEmployeeStore((store) => store.completeTask);
  const failTask = useCbeEmployeeStore((store) => store.failTask);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemoryRecordItem["analysisStatus"] | "all">("all");
  const [filters, setFilters] = useState<MemoryFilters>(emptyFilters);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [activeRecord, setActiveRecord] = useState<MemoryRecordItem | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadPayload, setUploadPayload] = useState<unknown | null>(null);
  const taskRunning = tasks.some((task) => task.kind === "accio_memory" && isCbeEmployeeTaskActive(task));

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const [memory, latestTasks] = await Promise.all([
          fetchEmployeeMemoryRecords(),
          fetchEmployeeTasks(),
        ]);
        if (cancelled) return;
        setRows(memory);
        setTasks(latestTasks);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "记忆记录读取失败。",
          });
        }
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [setRows, setTasks]);

  const filterOptions = useMemo(
    () => ({
      sources: Array.from(new Set(rows.map((item) => item.source))),
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesSource = filters.sources.length === 0 || filters.sources.includes(item.source);
      const matchesImportRange = importedAtInRange(item.importedAt, filters.importRange);
      const matchesQuery =
        !normalized ||
        item.name.toLowerCase().includes(normalized) ||
        item.summary.toLowerCase().includes(normalized) ||
        (item.handoffCompany?.toLowerCase().includes(normalized) ?? false);
      const matchesStatus = statusFilter === "all" || item.analysisStatus === statusFilter;
      return matchesSource && matchesImportRange && matchesQuery && matchesStatus;
    });
  }, [filters, query, rows, statusFilter]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    for (const source of filters.sources) {
      chips.push({
        key: `source-${source}`,
        label: `来源：${sourceLabels[source]}`,
        clear: () => setFilters((current) => ({ ...current, sources: current.sources.filter((item) => item !== source) })),
      });
    }
    if (filters.importRange !== "all") {
      chips.push({
        key: "importRange",
        label: `导入时间：${importRangeLabels[filters.importRange]}`,
        clear: () => setFilters((current) => ({ ...current, importRange: "all" })),
      });
    }
    if (statusFilter !== "all") {
      chips.push({
        key: `status-${statusFilter}`,
        label: `状态：${statusLabels[statusFilter]}`,
        clear: () => setStatusFilter("all"),
      });
    }
    return chips;
  }, [filters, statusFilter]);

  const canRun = state === "connected" && !!accioAgent;
  const activeFilterCount = activeFilterChips.length;

  const showNotice = (text: string, tone: "success" | "error" | "info" = "success", timeoutMs = 4000) => {
    setNotice({ tone, text });
    if (timeoutMs > 0) {
      window.setTimeout(() => {
        setNotice((current) => (current?.text === text ? null : current));
      }, timeoutMs);
    }
  };

  const refreshDbBackedMemory = async () => {
    const [memory, latestTasks] = await Promise.all([
      fetchEmployeeMemoryRecords(),
      fetchEmployeeTasks(),
    ]);
    setRows(memory);
    setTasks(latestTasks);
  };

  const shouldWriteFailure = (error: unknown) =>
    !(error instanceof CbeEmployeeApiError && error.code === "validation_failed");

  const createProgressHandler = (taskId: string) => (progress: EmployeeTaskProgress) => {
    if (progress.status === "failed") {
      failTask(taskId, progress.message, progress.sessionKey);
      showNotice(progress.message, "error", 0);
    } else {
      updateTaskProgress(taskId, {
        status: progress.status,
        message: progress.message,
        sessionKey: progress.sessionKey,
      });
      showNotice(progress.message, "info", 0);
    }
  };

  const openDetail = (item: MemoryRecordItem) => {
    setActiveRecord(item);
    setSheetMode("detail");
  };

  const handleUploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadName(file.name);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      setUploadPayload(parsed);
      showNotice(`已读取 ${file.name}，可以导入或提交记忆员工分析。`, "info");
    } catch (error) {
      setUploadPayload(null);
      showNotice(error instanceof Error ? error.message : "聊天记录文件解析失败。", "error", 8000);
    }
  };

  const importOnly = async (recordName: string, sourceLabel: string) => {
    if (!uploadPayload) {
      showNotice("请先上传系统可读取的聊天记录文件。", "error");
      return;
    }
    setSheetMode(null);
    try {
      await createEmployeeAccioImport({
        recordName: recordName.trim() || uploadName.replace(/\.json$/i, "") || "未命名记录",
        sourceLabel,
        chatExport: uploadPayload,
      });
      await refreshDbBackedMemory();
      showNotice("记录已导入，状态为未分析。");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "记忆记录导入失败。", "error", 8000);
    }
  };

  const submitMemoryTask = async (input: AccioMemoryTaskInput, failedRecordId?: string) => {
    if (!canRun) {
      showNotice(
        state === "connected"
          ? "记忆员工还没有启动，请先完成系统初始化。"
          : "后台未连接，暂时不能执行记忆分析。",
        "error",
      );
      return;
    }
    const plannedSessionKey = createPlannedEmployeeSessionKey(ACCIO_AGENT_ID);
    const estimatedMs = 180_000;
    let taskId: string | undefined;
    let createdImport: Awaited<ReturnType<typeof createEmployeeAccioImport>> | null = null;
    setSheetMode(null);
    try {
      createdImport = await createEmployeeAccioImport(input, plannedSessionKey);
      const localTaskId = startTask({
        id: createdImport.agentRun.id,
        kind: "accio_memory",
        title: "记忆整理",
        message: "记忆整理任务已启动，后台员工正在分析聊天记录。",
        estimatedMs,
        timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
        sessionKey: plannedSessionKey,
        targetLabel: input.recordName,
      });
      taskId = localTaskId;
      if (failedRecordId) {
        setRows((current) =>
          current.map((item) =>
            item.recordId === failedRecordId ? { ...item, analysisStatus: "running" } : item,
          ),
        );
      }
      const result = await runAccioMemoryTask(
        client,
        input,
        createProgressHandler(localTaskId),
        { sessionKey: plannedSessionKey },
      );
      await completeEmployeeAccioImport({
        importId: createdImport.accioImport.id,
        agentRunId: createdImport.agentRun.id,
        sessionKey: result.sessionKey,
        sourceFileName: input.recordName,
        payload: result.payload,
      });
      const message = `记忆员工已返回 ${result.records.length} 份结构化摘要，已更新当前列表。`;
      completeTask(localTaskId, result.records.length, message, result.sessionKey);
      await refreshDbBackedMemory();
      showNotice(message);
    } catch (error) {
      if (failedRecordId) {
        setRows((current) =>
          current.map((item) =>
            item.recordId === failedRecordId ? { ...item, analysisStatus: "failed" } : item,
          ),
        );
      }
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      if (createdImport && shouldWriteFailure(error)) {
        await failEmployeeTaskInDb({
          agentRunId: createdImport.agentRun.id,
          sessionKey: sessionKey ?? plannedSessionKey,
          error,
          message,
        }).catch(() => undefined);
      }
      if (taskId) failTask(taskId, message, sessionKey ?? plannedSessionKey);
      await refreshDbBackedMemory().catch(() => undefined);
      showNotice(message, "error", 8000);
    }
  };

  const submitUploadedMemoryTask = async (recordName: string, sourceLabel: string) => {
    if (!uploadPayload) {
      showNotice("请先上传系统可读取的聊天记录文件。", "error");
      return;
    }
    await submitMemoryTask({
      recordName: recordName.trim() || uploadName.replace(/\.json$/i, "") || "未命名记录",
      sourceLabel,
      chatExport: uploadPayload,
    });
  };

  const submitExistingMemoryTask = async (record: MemoryRecordItem) => {
    const localPayload = {
      export_metadata: {
        platform: record.source,
        exported_at: new Date().toISOString(),
        seller_company: "Sentura cross-border demo",
        source_file: record.name,
        data_classification: "T3-business-conversation",
      },
      conversations: [
        {
          conversation_id: record.recordId,
          buyer: {
            display_name: record.handoffCompany ?? record.name,
            company_name: record.handoffCompany ?? record.name,
            country: "ZZ",
            claimed_role: "manual_import",
          },
          messages: [
            {
              timestamp: new Date().toISOString(),
              sender: "buyer",
              text: record.summary,
            },
          ],
          attachments: [],
        },
      ],
    };
    setRows((current) =>
      current.map((item) =>
        item.recordId === record.recordId ? { ...item, analysisStatus: "running" } : item,
      ),
    );
    await submitMemoryTask({
      recordName: record.name,
      sourceLabel: sourceLabels[record.source],
      chatExport: localPayload,
    }, record.recordId);
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">记忆整理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {filtered.length} 条记录，当前筛选：{statusFilter === "all" ? "全部状态" : statusLabels[statusFilter]}
          </p>
        </div>
        <Button onClick={() => setSheetMode("add")}>
          <Upload className="h-4 w-4" />
          添加新记录
        </Button>
      </section>

      {notice ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            notice.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : notice.tone === "info"
                ? "border-sky-200 bg-sky-50 text-sky-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          {notice.text}
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="按名称搜索"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSheetMode("filters")}>
                <Filter className="h-3.5 w-3.5" />
                来源 / 导入时间
                {activeFilterCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </Button>
              {(["all", "not_started", "running", "analyzed", "failed"] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "all" ? "全部" : statusLabels[status]}
                </Button>
              ))}
            </div>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`移除${chip.label}`}
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={chip.clear}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={() => {
                setFilters(emptyFilters);
                setStatusFilter("all");
              }}>
                <RotateCcw className="h-3.5 w-3.5" />
                重置筛选
              </Button>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center">
              <div className="text-sm font-medium">没有符合条件的记录</div>
              <p className="mt-1 text-sm text-muted-foreground">
                调整筛选条件，或点击“添加新记录”导入 Accio / 阿里国际站记录。
              </p>
              <Button className="mt-4" size="sm" onClick={() => setSheetMode("add")}>
                <Upload className="h-4 w-4" />
                添加新记录
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:hidden">
                {filtered.map((item) => (
                  <MemoryMobileCard
                    key={item.recordId}
                    item={item}
                    canRun={canRun}
                    openDetail={openDetail}
                    submitTask={submitExistingMemoryTask}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-md border lg:block">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">名称</th>
                      <th className="px-3 py-2 text-left">来源</th>
                      <th className="px-3 py-2 text-left">导入时间</th>
                      <th className="px-3 py-2 text-left">对话数</th>
                      <th className="px-3 py-2 text-left">状态</th>
                      <th className="px-3 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.recordId} className={cn("border-t align-top", rowClass(item.analysisStatus))}>
                        <td className="px-3 py-3">
                          <button type="button" className="max-w-[340px] text-left" onClick={() => openDetail(item)}>
                            <div className="truncate font-medium">{item.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{item.summary}</div>
                          </button>
                        </td>
                        <td className="px-3 py-3">{sourceLabels[item.source]}</td>
                        <td className="px-3 py-3">{item.importedAt}</td>
                        <td className="px-3 py-3">{item.conversationCount}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={badgeClass(item.analysisStatus)}>
                            {statusLabels[item.analysisStatus]}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openDetail(item)}>
                              <Eye className="h-3.5 w-3.5" />
                              {item.analysisStatus === "analyzed" ? "查看报告" : item.analysisStatus === "running" ? "查看进度" : "详情"}
                            </Button>
                            {item.analysisStatus === "not_started" ? (
                              <Button variant="outline" size="sm" disabled={!canRun || taskRunning} onClick={() => submitExistingMemoryTask(item)}>
                                开始分析
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MemorySheet
        mode={sheetMode}
        onOpenChange={(open) => {
          if (!open) setSheetMode(null);
        }}
        activeRecord={activeRecord}
        filters={filters}
        setFilters={setFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        filterOptions={filterOptions}
        activeFilterCount={activeFilterCount}
        uploadName={uploadName}
        setUploadName={setUploadName}
        uploadPayload={uploadPayload}
        onUploadFile={handleUploadFile}
        canRun={canRun}
        agentLoading={agentLoading}
        gatewayConnected={state === "connected"}
        taskRunning={taskRunning}
        onImportOnly={importOnly}
        onAnalyzeUpload={submitUploadedMemoryTask}
        onCreateHandoff={() => showNotice("已创建聊天记录移交客户行，可在获客与背调中继续调研。")}
      />
    </div>
  );
}

function MemoryMobileCard({
  item,
  canRun,
  openDetail,
  submitTask,
}: {
  item: MemoryRecordItem;
  canRun: boolean;
  openDetail: (item: MemoryRecordItem) => void;
  submitTask: (item: MemoryRecordItem) => void;
}) {
  return (
    <div className={cn("rounded-md border p-3 text-sm", rowClass(item.analysisStatus))}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={() => openDetail(item)}>
          <div className="font-medium">{item.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{item.summary}</div>
        </button>
        <Badge variant="outline" className={badgeClass(item.analysisStatus)}>
          {statusLabels[item.analysisStatus]}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">来源</div>
          <div>{sourceLabels[item.source]}</div>
        </div>
        <div>
          <div className="text-muted-foreground">导入时间</div>
          <div className="font-mono">{item.importedAt}</div>
        </div>
        <div>
          <div className="text-muted-foreground">对话数</div>
          <div>{item.conversationCount}</div>
        </div>
        <div>
          <div className="text-muted-foreground">写入状态</div>
          <div>{item.memoryPreviewStatus === "preview_only" ? "仅预览" : item.memoryPreviewStatus}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openDetail(item)}>
          <Eye className="h-3.5 w-3.5" />
          {item.analysisStatus === "analyzed" ? "查看报告" : "详情"}
        </Button>
        {item.analysisStatus === "not_started" ? (
          <Button size="sm" disabled={!canRun} onClick={() => submitTask(item)}>
            <Database className="h-3.5 w-3.5" />
            开始分析
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MemorySheet({
  mode,
  onOpenChange,
  activeRecord,
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  filterOptions,
  activeFilterCount,
  uploadName,
  setUploadName,
  uploadPayload,
  onUploadFile,
  canRun,
  agentLoading,
  gatewayConnected,
  taskRunning,
  onImportOnly,
  onAnalyzeUpload,
  onCreateHandoff,
}: {
  mode: SheetMode;
  onOpenChange: (open: boolean) => void;
  activeRecord: MemoryRecordItem | null;
  filters: MemoryFilters;
  setFilters: Dispatch<SetStateAction<MemoryFilters>>;
  statusFilter: MemoryRecordItem["analysisStatus"] | "all";
  setStatusFilter: Dispatch<SetStateAction<MemoryRecordItem["analysisStatus"] | "all">>;
  filterOptions: {
    sources: MemoryRecordItem["source"][];
  };
  activeFilterCount: number;
  uploadName: string;
  setUploadName: (name: string) => void;
  uploadPayload: unknown | null;
  onUploadFile: (file: File | undefined) => void;
  canRun: boolean;
  agentLoading: boolean;
  gatewayConnected: boolean;
  taskRunning: boolean;
  onImportOnly: (recordName: string, sourceLabel: string) => void;
  onAnalyzeUpload: (recordName: string, sourceLabel: string) => void;
  onCreateHandoff: () => void;
}) {
  const [recordName, setRecordName] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Accio");
  const effectiveRecordName = recordName || uploadName.replace(/\.json$/i, "");
  const uploadConversationCount = useMemo(() => {
    if (!uploadPayload || typeof uploadPayload !== "object" || Array.isArray(uploadPayload)) return 1;
    const conversations = (uploadPayload as { conversations?: unknown }).conversations;
    return Array.isArray(conversations) ? conversations.length : 1;
  }, [uploadPayload]);
  const uploadEstimate = useMemo(
    () => estimateMemoryTaskCost(uploadConversationCount),
    [uploadConversationCount],
  );

  return (
    <Sheet open={mode !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {mode === "filters" ? (
          <>
            <SheetHeader>
              <SheetTitle>筛选记忆记录</SheetTitle>
              <SheetDescription>
                按来源、导入时间和分析状态筛选；名称搜索会继续生效。
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4">
              <FilterGroup title="来源">
                {filterOptions.sources.map((source) => (
                  <Button
                    key={source}
                    variant={filters.sources.includes(source) ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        sources: toggleValue(current.sources, source),
                      }))
                    }
                  >
                    {sourceLabels[source]}
                  </Button>
                ))}
              </FilterGroup>

              <FilterGroup title="导入时间">
                {(["all", "today", "7d", "30d"] as const).map((range) => (
                  <Button
                    key={range}
                    variant={filters.importRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilters((current) => ({ ...current, importRange: range }))}
                  >
                    {importRangeLabels[range]}
                  </Button>
                ))}
              </FilterGroup>

              <FilterGroup title="分析状态">
                {(["all", "not_started", "running", "analyzed", "failed"] as const).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === "all" ? "全部" : statusLabels[status]}
                  </Button>
                ))}
              </FilterGroup>
            </div>
            <SheetFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setFilters(emptyFilters);
                  setStatusFilter("all");
                }}
              >
                <RotateCcw className="h-4 w-4" />
                重置
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                应用筛选
                {activeFilterCount > 0 ? `（${activeFilterCount}）` : ""}
              </Button>
            </SheetFooter>
          </>
        ) : null}

        {mode === "add" ? (
          <>
            <SheetHeader>
              <SheetTitle>添加新记录</SheetTitle>
              <SheetDescription>导入 Accio、阿里国际站或手动聊天记录。</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/40">
                <FileJson className="mb-2 h-5 w-5" />
                {uploadName || "上传聊天记录 JSON 文件"}
                <Input
                  className="hidden"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setUploadName(file?.name ?? "");
                    if (file && !recordName) setRecordName(file.name.replace(/\.json$/i, ""));
                    onUploadFile(file);
                  }}
                />
              </label>
              <Input
                value={effectiveRecordName}
                onChange={(event) => setRecordName(event.target.value)}
                placeholder="记录名称"
              />
              <FilterGroup title="记录来源">
                {memorySourceChoices.map((source) => (
                  <Button
                    key={source}
                    type="button"
                    variant={sourceLabel === source ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSourceLabel(source)}
                  >
                    {source}
                  </Button>
                ))}
              </FilterGroup>
              <div
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                title="这是内部安全分级，表示这类数据是业务聊天记录，默认只展示摘要和预览。"
              >
                数据安全：业务聊天记录，只生成摘要和写入预览
              </div>
              <TaskCostNotice {...uploadEstimate} />
              {uploadName && !uploadPayload ? (
                <SystemNotice text="当前文件尚未成功读取，请重新选择聊天记录文件。" />
              ) : null}
              {!gatewayConnected || !canRun ? (
                <SystemNotice text={gatewayConnected ? "记忆员工还没有启动，请先完成系统初始化。" : "后台未连接，暂时不能执行记忆分析。"} />
              ) : null}
            </div>
            <SheetFooter>
              <Button variant="outline" disabled={!uploadPayload || taskRunning} onClick={() => onImportOnly(effectiveRecordName, sourceLabel)}>
                <Database className="h-4 w-4" />
                仅导入
              </Button>
              <Button disabled={!canRun || agentLoading || !uploadPayload || taskRunning} onClick={() => onAnalyzeUpload(effectiveRecordName, sourceLabel)}>
                {agentLoading || taskRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                导入并分析
              </Button>
            </SheetFooter>
          </>
        ) : null}

        {mode === "detail" && activeRecord ? (
          <>
            <SheetHeader>
              <SheetTitle>{activeRecord.name}</SheetTitle>
              <SheetDescription>
                {sourceLabels[activeRecord.source]} · {activeRecord.importedAt} · {statusLabels[activeRecord.analysisStatus]}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <FileJson className="h-4 w-4 text-primary" />
                  原始记录概览
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">来源</dt>
                  <dd>{sourceLabels[activeRecord.source]}</dd>
                  <dt className="text-muted-foreground">对话数量</dt>
                  <dd>{activeRecord.conversationCount}</dd>
                  <dt className="text-muted-foreground">写入状态</dt>
                  <dd>{activeRecord.memoryPreviewStatus === "preview_only" ? "仅预览" : activeRecord.memoryPreviewStatus}</dd>
                  <dt className="text-muted-foreground">任务 ID</dt>
                  <dd className="font-mono text-xs">{activeRecord.latestAgentRunId ?? "暂无"}</dd>
                </dl>
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Clock3 className="h-4 w-4 text-sky-600" />
                  对话列表
                </div>
                <div className="space-y-2 text-sm">
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    公司：{activeRecord.handoffCompany ?? "待提取"} · 记录：{activeRecord.summary}
                  </div>
                </div>
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  分析报告
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {activeRecord.analysisStatus === "analyzed"
                    ? activeRecord.summary
                    : "等待记忆员工返回结构化摘要后展示客户画像、需求商品、价格、付款/物流条款和跟进上下文。"}
                </p>
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4 text-primary" />
                  写入记忆预览
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                  仅展示简洁事实和来源引用，不写入原始聊天。
                </div>
              </section>

              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={activeRecord.analysisStatus !== "analyzed"}
                onClick={onCreateHandoff}
              >
                <Send className="h-4 w-4" />
                发送到背调
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function SystemNotice({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{text}</span>
      </div>
    </div>
  );
}
