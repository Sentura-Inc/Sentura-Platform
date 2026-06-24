"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
  deleteEmployeeMemoryRecords,
  failEmployeeTaskInDb,
  fetchEmployeeAccioImportPayload,
  fetchEmployeeMemoryRecords,
  fetchEmployeeTasks,
  reviewEmployeeMemoryFacts,
} from "../_data/employee-api";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";

type SheetMode = "add" | "supplement" | "detail" | "filters" | null;
type ImportRange = "all" | "today" | "7d" | "30d";
type MemoryHighlightScope = "memory-results";
type MemorySupplementSource = "lead_discovery" | "manual_screening" | "accio_handoff";

interface MemoryFilters {
  sources: MemoryRecordItem["source"][];
  importRange: ImportRange;
}

interface MemorySupplementContext {
  customerId: string;
  companyName: string;
  source: MemorySupplementSource;
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
  accio: "聊天工具",
  alibaba_international: "平台聊天",
  manual_import: "手动导入",
  demo_data: "演示数据",
  other: "其他",
};

function memoryPreviewStatusLabel(status: MemoryRecordItem["memoryPreviewStatus"]) {
  if (status === "approved") return "已批准";
  if (status === "rejected") return "已拒绝";
  return "仅预览";
}

const memorySourceChoices = ["聊天工具", "平台聊天", "手动导入"] as const;
const memoryStatusFilterChoices = ["all", "not_started", "analyzed"] as const;
const memoryStatusFilterValues: Array<MemoryRecordItem["analysisStatus"] | "all"> = ["all", "not_started", "analyzed"];
const memorySourceValues: MemoryRecordItem["source"][] = ["accio", "alibaba_international", "manual_import", "demo_data", "other"];
const importRangeValues: ImportRange[] = ["all", "today", "7d", "30d"];
const MEMORY_STATUS_FILTER_STORAGE_KEY = "sentura:cbe:employee:memory:status-filter:v1";
const MEMORY_FILTERS_STORAGE_KEY = "sentura:cbe:employee:memory:filters:v1";

function isMemoryStatusFilter(value: unknown): value is MemoryRecordItem["analysisStatus"] | "all" {
  return typeof value === "string" && memoryStatusFilterValues.includes(value as MemoryRecordItem["analysisStatus"] | "all");
}

function isMemorySource(value: unknown): value is MemoryRecordItem["source"] {
  return typeof value === "string" && memorySourceValues.includes(value as MemoryRecordItem["source"]);
}

function isImportRange(value: unknown): value is ImportRange {
  return typeof value === "string" && importRangeValues.includes(value as ImportRange);
}

function isMemoryFilters(value: unknown): value is MemoryFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const filters = value as Partial<Record<keyof MemoryFilters, unknown>>;
  return Array.isArray(filters.sources) && filters.sources.every(isMemorySource) && isImportRange(filters.importRange);
}

const importRangeLabels: Record<ImportRange, string> = {
  all: "全部时间",
  today: "今日",
  "7d": "近 7 天",
  "30d": "近 30 天",
};

const supplementSourceLabels: Record<MemorySupplementSource, string> = {
  lead_discovery: "找客户结果",
  manual_screening: "手动录入",
  accio_handoff: "聊天记录",
};

function highlightFrameClass(active: boolean) {
  return active
    ? "animate-pulse outline outline-2 -outline-offset-2 outline-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.22)]"
    : "";
}

function rowClass(status: MemoryRecordItem["analysisStatus"], isHighlighted = false) {
  if (isHighlighted) return cn("bg-sky-50/60", highlightFrameClass(true));
  if (status === "running") return "bg-sky-50/70";
  if (status === "analyzed") return "bg-emerald-50/70";
  if (status === "failed") return "bg-rose-50/70";
  return "bg-background";
}

function canDeleteMemoryRecord(item: MemoryRecordItem) {
  return item.analysisStatus !== "running";
}

function badgeClass(status: MemoryRecordItem["analysisStatus"]) {
  if (status === "running") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "analyzed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-white text-slate-700";
}

function formatBeijingDateTime(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
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

function normalizeMemoryHighlightScope(value: string | null): MemoryHighlightScope | null {
  return value === "memory-results" ? value : null;
}

function memoryRowSelector(recordId: string) {
  const escaped = typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(recordId)
    : recordId.replace(/["\\]/g, "\\$&");
  return `[data-record-id="${escaped}"]`;
}

function normalizeSupplementSource(value: string | null): MemorySupplementSource {
  if (value === "lead_discovery" || value === "manual_screening" || value === "accio_handoff") {
    return value;
  }
  return "manual_screening";
}

function supplementRecordName(companyName: string) {
  return `补充聊天记录 - ${companyName}`;
}

export default function CrossBorderMemoryPage() {
  return (
    <Suspense fallback={null}>
      <CrossBorderMemoryPageContent />
    </Suspense>
  );
}

function CrossBorderMemoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [statusFilter, setStatusFilter] = usePersistentUiState<MemoryRecordItem["analysisStatus"] | "all">(
    MEMORY_STATUS_FILTER_STORAGE_KEY,
    "all",
    isMemoryStatusFilter,
  );
  const [filters, setFilters] = usePersistentUiState<MemoryFilters>(
    MEMORY_FILTERS_STORAGE_KEY,
    emptyFilters,
    isMemoryFilters,
  );
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [activeRecord, setActiveRecord] = useState<MemoryRecordItem | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadPayload, setUploadPayload] = useState<unknown | null>(null);
  const [highlightedRecordIds, setHighlightedRecordIds] = useState<Set<string>>(() => new Set());
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [deleteIntentIds, setDeleteIntentIds] = useState<string[]>([]);
  const [deletingMemory, setDeletingMemory] = useState(false);
  const [reviewingMemoryFact, setReviewingMemoryFact] = useState(false);
  const handledHighlightRequestRef = useRef<string | null>(null);
  const memoryHighlightScope = normalizeMemoryHighlightScope(searchParams.get("highlight"));
  const highlightRecordId = searchParams.get("highlightRecord");
  const highlightTaskId = searchParams.get("highlightTask");
  const supplementCustomerId = searchParams.get("supplementCustomer");
  const supplementCompanyName = searchParams.get("supplementCompany");
  const supplementSource = normalizeSupplementSource(searchParams.get("supplementSource"));
  const handledSupplementRequestRef = useRef<string | null>(null);
  const taskRunning = tasks.some((task) => task.kind === "accio_memory" && isCbeEmployeeTaskActive(task));
  const supplementContext = useMemo<MemorySupplementContext | null>(() => {
    if (!supplementCustomerId || !supplementCompanyName?.trim()) return null;
    return {
      customerId: supplementCustomerId,
      companyName: supplementCompanyName.trim(),
      source: supplementSource,
    };
  }, [supplementCompanyName, supplementCustomerId, supplementSource]);

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
        const memoryIds = new Set(memory.map((item) => item.recordId));
        setSelectedRecordIds((current) => current.filter((recordId) => memoryIds.has(recordId)));
        setDeleteIntentIds((current) => current.filter((recordId) => memoryIds.has(recordId)));
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

  useEffect(() => {
    if (!supplementContext) return;
    const requestKey = `${supplementContext.customerId}|${supplementContext.companyName}|${supplementContext.source}`;
    if (handledSupplementRequestRef.current === requestKey) return;
    handledSupplementRequestRef.current = requestKey;
    setUploadName("");
    setUploadPayload(null);
    setQuery("");
    setFilters(emptyFilters);
    setStatusFilter("not_started");
    setSheetMode("supplement");
    showNotice(`正在为 ${supplementContext.companyName} 补充聊天记录。`, "info", 6000);
  }, [supplementContext]);

  const highlightMemoryRecords = (recordIds: string[]) => {
    const ids = Array.from(new Set(recordIds.filter(Boolean)));
    if (ids.length === 0) return;
    setHighlightedRecordIds(new Set(ids));
  };

  const scrollMemoryRecordIntoView = (recordId: string) => {
    window.requestAnimationFrame(() => {
      const rowCandidates = Array.from(document.querySelectorAll<HTMLElement>(memoryRowSelector(recordId)));
      const visibleRow = rowCandidates.find((element) => element.getClientRects().length > 0) ?? rowCandidates[0];
      visibleRow?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const clearMemoryHighlight = (recordId: string) => {
    setHighlightedRecordIds((current) => {
      if (!current.has(recordId)) return current;
      const next = new Set(current);
      next.delete(recordId);
      return next;
    });
  };

  useEffect(() => {
    const highlightRequestKey = [memoryHighlightScope ?? "", highlightRecordId ?? "", highlightTaskId ?? ""].join("|");
    const hasHighlightRequest = Boolean(memoryHighlightScope || highlightRecordId || highlightTaskId);
    if (!hasHighlightRequest || handledHighlightRequestRef.current === highlightRequestKey || rows.length === 0) return;
    const ids = highlightRecordId
      ? rows.some((item) => item.recordId === highlightRecordId) ? [highlightRecordId] : []
      : highlightTaskId
        ? rows
            .filter((item) => item.latestAgentRunId === highlightTaskId)
            .map((item) => item.recordId)
      : rows.map((item) => item.recordId);
    if (ids.length === 0) return;
    handledHighlightRequestRef.current = highlightRequestKey;
    setQuery("");
    setFilters(emptyFilters);
    setStatusFilter("all");
    highlightMemoryRecords(ids);
    scrollMemoryRecordIntoView(ids[0]);
    showNotice(`已定位 ${ids.length} 条记忆记录。`, "info");
  }, [highlightRecordId, highlightTaskId, memoryHighlightScope, rows]);

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
  const selectableFiltered = filtered.filter(canDeleteMemoryRecord);
  const selectedRecords = rows.filter((item) => selectedRecordIds.includes(item.recordId));
  const deleteTargets = rows.filter((item) => deleteIntentIds.includes(item.recordId));
  const allVisibleSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((item) => selectedRecordIds.includes(item.recordId));

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
    const memoryIds = new Set(memory.map((item) => item.recordId));
    setSelectedRecordIds((current) => current.filter((recordId) => memoryIds.has(recordId)));
    setDeleteIntentIds((current) => current.filter((recordId) => memoryIds.has(recordId)));
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
    }
  };

  const openDetail = (item: MemoryRecordItem) => {
    setActiveRecord(item);
    setSheetMode("detail");
  };

  const toggleSelectedRecord = (recordId: string) => {
    const record = rows.find((item) => item.recordId === recordId);
    if (!record || !canDeleteMemoryRecord(record)) return;
    setSelectedRecordIds((current) =>
      current.includes(recordId)
        ? current.filter((item) => item !== recordId)
        : [...current, recordId],
    );
  };

  const toggleAllVisibleRecords = () => {
    const visibleIds = selectableFiltered.map((item) => item.recordId);
    if (visibleIds.length === 0) return;
    if (allVisibleSelected) {
      setSelectedRecordIds((current) => current.filter((recordId) => !visibleIds.includes(recordId)));
    } else {
      setSelectedRecordIds((current) => Array.from(new Set([...current, ...visibleIds])));
    }
  };

  const requestDeleteSelectedMemory = () => {
    if (selectedRecords.length === 0) {
      showNotice("请先选择要删除的记忆记录。", "info");
      return;
    }
    const runningRecords = selectedRecords.filter((item) => !canDeleteMemoryRecord(item));
    if (runningRecords.length > 0) {
      showNotice("分析中的记录不能删除，请等待任务完成后再删除。", "error");
      return;
    }
    setDeleteIntentIds(selectedRecords.map((item) => item.recordId));
  };

  const confirmDeleteMemory = async () => {
    const ids = deleteIntentIds;
    if (ids.length === 0 || deletingMemory) return;
    setDeletingMemory(true);
    try {
      await deleteEmployeeMemoryRecords(ids);
      if (activeRecord && ids.includes(activeRecord.recordId)) {
        setActiveRecord(null);
        setSheetMode(null);
      }
      setSelectedRecordIds((current) => current.filter((recordId) => !ids.includes(recordId)));
      setDeleteIntentIds([]);
      await refreshDbBackedMemory();
      showNotice(`已删除 ${ids.length} 条记忆记录。`, "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "记忆记录删除失败。", "error", 8000);
    } finally {
      setDeletingMemory(false);
    }
  };

  const handleUploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadName(file.name);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      setUploadPayload(parsed);
      showNotice(`已读取 ${file.name}，可以导入或提交分析。`, "info");
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
    const isSupplementImport = sheetMode === "supplement" && Boolean(supplementContext);
    const finalRecordName =
      recordName.trim() ||
      (supplementContext ? supplementRecordName(supplementContext.companyName) : "") ||
      uploadName.replace(/\.json$/i, "") ||
      "未命名记录";
    setSheetMode(null);
    try {
      const created = await createEmployeeAccioImport({
        recordName: finalRecordName,
        sourceLabel,
        chatExport: uploadPayload,
        supplementTarget: supplementContext
          ? {
              customerId: supplementContext.customerId,
              companyName: supplementContext.companyName,
              source: supplementContext.source,
            }
          : undefined,
      });
      setUploadName("");
      setUploadPayload(null);
      setStatusFilter("not_started");
      setFilters(emptyFilters);
      await refreshDbBackedMemory();
      highlightMemoryRecords([created.accioImport.id]);
      window.setTimeout(() => scrollMemoryRecordIntoView(created.accioImport.id), 0);
      showNotice(
        isSupplementImport
          ? "已提交补充聊天记录，已绑定到原客户并进入未分析状态。请点击该行“开始分析”，完成后可重新发送到背调。"
          : "记录已导入，状态为未分析。",
        "success",
        isSupplementImport ? 8000 : 4000,
      );
      router.replace(`/client-demos/cross-border/employee/memory?highlightRecord=${encodeURIComponent(created.accioImport.id)}`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "记忆记录导入失败。", "error", 8000);
    }
  };

  const submitMemoryTask = async (input: AccioMemoryTaskInput, failedRecordId?: string) => {
    if (!canRun) {
      showNotice(
        state === "connected"
          ? "记忆整理暂不可用，请先完成系统初始化。"
          : "系统暂未连接，暂时不能执行记忆整理。",
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
      if (createdImport.agentRun.status === "queued" || !createdImport.agentRun.sessionKey) {
        showNotice("当前任务较多，记忆整理已进入排队；系统不会重复启动超出容量的任务。", "info", 8000);
        await refreshDbBackedMemory().catch(() => undefined);
        return;
      }
      const activeSessionKey = createdImport.agentRun.sessionKey;
      const localTaskId = startTask({
        id: createdImport.agentRun.id,
        kind: "accio_memory",
        title: "记忆整理",
        message: "记忆整理任务已启动，正在分析聊天记录。",
        estimatedMs,
        timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
        sessionKey: activeSessionKey,
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
        { sessionKey: activeSessionKey },
      );
      await completeEmployeeAccioImport({
        importId: createdImport.accioImport.id,
        agentRunId: createdImport.agentRun.id,
        sessionKey: result.sessionKey,
        sourceFileName: input.recordName,
        payload: result.payload,
        supplementTarget: input.supplementTarget,
      });
      const message = `已整理 ${result.records.length} 份聊天记录，当前列表已更新。`;
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
    setRows((current) =>
      current.map((item) =>
        item.recordId === record.recordId ? { ...item, analysisStatus: "running" } : item,
      ),
    );
    let storedPayload: unknown;
    try {
      storedPayload = await fetchEmployeeAccioImportPayload(record.recordId);
    } catch (error) {
      setRows((current) =>
        current.map((item) =>
          item.recordId === record.recordId ? { ...item, analysisStatus: "failed" } : item,
        ),
      );
      showNotice(error instanceof Error ? error.message : "无法读取已导入聊天记录。", "error", 8000);
      return;
    }
    await submitMemoryTask({
      recordName: record.name,
      sourceLabel: sourceLabels[record.source],
      chatExport: storedPayload,
      supplementTarget: record.supplementCustomerId && record.supplementCompanyName
        ? {
            customerId: record.supplementCustomerId,
            companyName: record.supplementCompanyName,
            source: record.supplementSource ?? "manual_screening",
          }
        : undefined,
    }, record.recordId);
  };

  const sendToScreening = (record: MemoryRecordItem) => {
    if (record.analysisStatus !== "analyzed") return;
    setSheetMode(null);
    const customerId = record.supplementCustomerId ?? record.reportId ?? record.recordId;
    router.push(`/client-demos/cross-border/employee/customers?highlightCustomer=${encodeURIComponent(customerId)}`);
    showNotice("已定位聊天记录移交客户行，可在获客与背调中继续调研。", "success");
  };

  const approveMemoryFact = async (record: MemoryRecordItem) => {
    if (record.analysisStatus !== "analyzed" || record.memoryPreviewStatus !== "preview_only") return;
    setReviewingMemoryFact(true);
    try {
      await reviewEmployeeMemoryFacts({
        ids: [record.reportId ?? record.recordId],
        decision: "approved",
        reviewNote: "Operator approved concise Accio memory preview for future Screening context.",
      });
      await refreshDbBackedMemory();
      setActiveRecord((current) =>
        current && current.recordId === record.recordId
          ? { ...current, memoryPreviewStatus: "approved" }
          : current,
      );
      showNotice("已批准写入简洁事实；原始聊天不会写入长期记忆。", "success", 6000);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "记忆审批失败。", "error", 8000);
    } finally {
      setReviewingMemoryFact(false);
    }
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
              {memoryStatusFilterChoices.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "all" ? "全部" : statusLabels[status]}
                </Button>
              ))}
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedRecords.length === 0}
                onClick={requestDeleteSelectedMemory}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除所选{selectedRecords.length > 0 ? `（${selectedRecords.length}）` : ""}
              </Button>
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
                调整筛选条件，或点击“添加新记录”导入聊天记录。
              </p>
              <Button className="mt-4" size="sm" onClick={() => setSheetMode("add")}>
                <Upload className="h-4 w-4" />
                添加新记录
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:hidden">
                {filtered.map((item) => {
                  const isHighlighted = highlightedRecordIds.has(item.recordId);
                  return (
                    <MemoryMobileCard
                      key={item.recordId}
                      item={item}
                      isHighlighted={isHighlighted}
                      canRun={canRun}
                      selected={selectedRecordIds.includes(item.recordId)}
                      toggleSelected={toggleSelectedRecord}
                      openDetail={openDetail}
                      clearHighlight={clearMemoryHighlight}
                      submitTask={submitExistingMemoryTask}
                    />
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-md border lg:block">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          aria-label="选择当前筛选结果"
                          checked={allVisibleSelected}
                          disabled={selectableFiltered.length === 0}
                          onChange={toggleAllVisibleRecords}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">名称</th>
                      <th className="px-3 py-2 text-left">来源</th>
                      <th className="px-3 py-2 text-left">导入时间</th>
                      <th className="px-3 py-2 text-left">对话数</th>
                      <th className="px-3 py-2 text-left">状态</th>
                      <th className="px-3 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const isHighlighted = highlightedRecordIds.has(item.recordId);
                      return (
                      <tr
                        key={item.recordId}
                        data-record-id={item.recordId}
                        onMouseDown={() => clearMemoryHighlight(item.recordId)}
                        className={cn("border-t align-top transition-colors", rowClass(item.analysisStatus, isHighlighted))}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`选择 ${item.name}`}
                            checked={selectedRecordIds.includes(item.recordId)}
                            disabled={!canDeleteMemoryRecord(item)}
                            onChange={() => toggleSelectedRecord(item.recordId)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <button type="button" className="max-w-[340px] text-left" onClick={() => openDetail(item)}>
                            <div className="truncate font-medium">{item.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{item.summary}</div>
                          </button>
                        </td>
                        <td className="px-3 py-3">{sourceLabels[item.source]}</td>
                        <td className="px-3 py-3 font-mono">{formatBeijingDateTime(item.importedAt)}</td>
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
                      );
                    })}
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
        filters={filters}
        setFilters={setFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        filterOptions={filterOptions}
        activeFilterCount={activeFilterCount}
        supplementContext={supplementContext}
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
      />

      {sheetMode === "detail" && activeRecord ? (
        <MemoryReportDialog
          activeRecord={activeRecord}
          onClose={() => setSheetMode(null)}
          onCreateHandoff={sendToScreening}
          onApproveMemory={approveMemoryFact}
          approving={reviewingMemoryFact}
        />
      ) : null}

      {deleteIntentIds.length > 0 ? (
        <MemoryDeleteDialog
          targets={deleteTargets}
          deleting={deletingMemory}
          onCancel={() => setDeleteIntentIds([])}
          onConfirm={confirmDeleteMemory}
        />
      ) : null}
    </div>
  );
}

function MemoryMobileCard({
  item,
  isHighlighted,
  canRun,
  selected,
  toggleSelected,
  openDetail,
  clearHighlight,
  submitTask,
}: {
  item: MemoryRecordItem;
  isHighlighted: boolean;
  canRun: boolean;
  selected: boolean;
  toggleSelected: (recordId: string) => void;
  openDetail: (item: MemoryRecordItem) => void;
  clearHighlight: (recordId: string) => void;
  submitTask: (item: MemoryRecordItem) => void;
}) {
  return (
    <div
      data-record-id={item.recordId}
      onMouseDown={() => clearHighlight(item.recordId)}
      className={cn("rounded-md border p-3 text-sm transition-colors", rowClass(item.analysisStatus, isHighlighted))}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={() => openDetail(item)}>
          <div className="font-medium">{item.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{item.summary}</div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={badgeClass(item.analysisStatus)}>
            {statusLabels[item.analysisStatus]}
          </Badge>
          <input
            type="checkbox"
            aria-label={`选择 ${item.name}`}
            checked={selected}
            disabled={!canDeleteMemoryRecord(item)}
            onChange={() => toggleSelected(item.recordId)}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">来源</div>
          <div>{sourceLabels[item.source]}</div>
        </div>
        <div>
          <div className="text-muted-foreground">导入时间</div>
          <div className="font-mono">{formatBeijingDateTime(item.importedAt)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">对话数</div>
          <div>{item.conversationCount}</div>
        </div>
        <div>
          <div className="text-muted-foreground">写入状态</div>
          <div>{memoryPreviewStatusLabel(item.memoryPreviewStatus)}</div>
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
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  filterOptions,
  activeFilterCount,
  supplementContext,
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
}: {
  mode: SheetMode;
  onOpenChange: (open: boolean) => void;
  filters: MemoryFilters;
  setFilters: Dispatch<SetStateAction<MemoryFilters>>;
  statusFilter: MemoryRecordItem["analysisStatus"] | "all";
  setStatusFilter: Dispatch<SetStateAction<MemoryRecordItem["analysisStatus"] | "all">>;
  filterOptions: {
    sources: MemoryRecordItem["source"][];
  };
  activeFilterCount: number;
  supplementContext: MemorySupplementContext | null;
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
}) {
  const [recordName, setRecordName] = useState("");
  const [sourceLabel, setSourceLabel] = useState("聊天工具");
  const isSupplementMode = mode === "supplement" && Boolean(supplementContext);
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

  useEffect(() => {
    if (mode !== "supplement" || !supplementContext) return;
    setRecordName(supplementRecordName(supplementContext.companyName));
    setSourceLabel("聊天工具");
  }, [mode, supplementContext]);

  useEffect(() => {
    if (mode !== "add") return;
    setRecordName("");
    setSourceLabel("聊天工具");
  }, [mode]);

  return (
    <Sheet open={mode === "add" || mode === "supplement" || mode === "filters"} onOpenChange={onOpenChange}>
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
                {memoryStatusFilterChoices.map((status) => (
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

        {mode === "add" || mode === "supplement" ? (
          <>
            <SheetHeader>
              <SheetTitle>{isSupplementMode ? "补充聊天记录" : "添加新记录"}</SheetTitle>
              <SheetDescription>
                {isSupplementMode && supplementContext
                  ? `为 ${supplementContext.companyName} 上传补充聊天记录，提交后会绑定到原客户并进入未分析状态。`
                  : "导入聊天工具、平台聊天或手动整理的聊天记录。"}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              {isSupplementMode && supplementContext ? (
                <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                  <div className="font-medium">{supplementContext.companyName}</div>
                  <div className="mt-0.5 text-xs text-sky-800">
                    来源：{supplementSourceLabels[supplementContext.source]} · 客户 ID：{supplementContext.customerId}
                  </div>
                </div>
              ) : null}
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/40">
                <FileJson className="mb-2 h-5 w-5" />
                {uploadName || "上传聊天记录文件"}
                <Input
                  className="hidden"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setUploadName(file?.name ?? "");
                    if (file && !recordName && !isSupplementMode) setRecordName(file.name.replace(/\.json$/i, ""));
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
                安全处理：只整理摘要，不展示完整原文
              </div>
              <TaskCostNotice {...uploadEstimate} />
              {uploadName && !uploadPayload ? (
                <SystemNotice text="当前文件尚未成功读取，请重新选择聊天记录文件。" />
              ) : null}
              {!isSupplementMode && (!gatewayConnected || !canRun) ? (
                <SystemNotice text={gatewayConnected ? "记忆整理暂不可用，请先完成系统初始化。" : "系统暂未连接，暂时不能执行记忆整理。"} />
              ) : null}
            </div>
            <SheetFooter>
              {isSupplementMode ? (
                <Button disabled={!uploadPayload || taskRunning} onClick={() => onImportOnly(effectiveRecordName, sourceLabel)}>
                  <Database className="h-4 w-4" />
                  提交补充记录
                </Button>
              ) : (
                <>
                  <Button variant="outline" disabled={!uploadPayload || taskRunning} onClick={() => onImportOnly(effectiveRecordName, sourceLabel)}>
                    <Database className="h-4 w-4" />
                    仅导入
                  </Button>
                  <Button disabled={!canRun || agentLoading || !uploadPayload || taskRunning} onClick={() => onAnalyzeUpload(effectiveRecordName, sourceLabel)}>
                    {agentLoading || taskRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    导入并分析
                  </Button>
                </>
              )}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function MemoryDeleteDialog({
  targets,
  deleting,
  onCancel,
  onConfirm,
}: {
  targets: MemoryRecordItem[];
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => {
      if (!open && !deleting) onCancel();
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>删除记忆记录</DialogTitle>
          <DialogDescription>
            删除后会移除对应聊天记录、整理结果和待处理移交；这不会自动删除已生成的背调报告。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {targets.map((item) => (
            <div key={item.recordId} className="rounded-md border px-3 py-2 text-sm">
              <div className="truncate font-medium">{item.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {sourceLabels[item.source]} · {statusLabels[item.analysisStatus]} · {formatBeijingDateTime(item.importedAt)}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={deleting} onClick={onCancel}>
            取消
          </Button>
          <Button variant="destructive" disabled={deleting || targets.length === 0} onClick={onConfirm}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemoryReportDialog({
  activeRecord,
  onClose,
  onCreateHandoff,
  onApproveMemory,
  approving,
}: {
  activeRecord: MemoryRecordItem;
  onClose: () => void;
  onCreateHandoff: (record: MemoryRecordItem) => void;
  onApproveMemory: (record: MemoryRecordItem) => void;
  approving: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden rounded-lg p-0 sm:max-h-[calc(100vh-4rem)] sm:max-w-5xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={badgeClass(activeRecord.analysisStatus)}>
              {statusLabels[activeRecord.analysisStatus]}
            </Badge>
            <Badge variant="secondary">{sourceLabels[activeRecord.source]}</Badge>
          </div>
          <DialogTitle className="break-words text-xl font-semibold tracking-normal">
            {activeRecord.name}
          </DialogTitle>
          <DialogDescription>
            {formatBeijingDateTime(activeRecord.importedAt)} · {activeRecord.conversationCount} 条对话
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <main className="space-y-4">
              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  分析报告
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {activeRecord.analysisStatus === "analyzed"
                    ? activeRecord.summary
                    : "等待整理完成后展示客户画像、需求商品、价格、付款/物流条款和跟进上下文。"}
                </p>
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Clock3 className="h-4 w-4 text-sky-600" />
                  对话列表
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                  公司：{activeRecord.handoffCompany ?? "待提取"} · 记录：{activeRecord.summary}
                </div>
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4 text-primary" />
                  整理结果预览
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                  仅展示简洁事实和来源引用，不写入原始聊天。
                </div>
              </section>
            </main>

            <aside className="space-y-4">
              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <FileJson className="h-4 w-4 text-primary" />
                  原始记录概览
                </div>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">来源</dt>
                    <dd className="mt-1 font-medium">{sourceLabels[activeRecord.source]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">写入状态</dt>
                    <dd className="mt-1 font-medium">
                      {memoryPreviewStatusLabel(activeRecord.memoryPreviewStatus)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">处理编号</dt>
                    <dd className="mt-1">
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">查看诊断信息</summary>
                        <span className="mt-1 block break-all font-mono">{activeRecord.latestAgentRunId ?? "暂无"}</span>
                      </details>
                    </dd>
                  </div>
                </dl>
              </section>

              <Button
                className="w-full justify-start"
                disabled={activeRecord.analysisStatus !== "analyzed" || activeRecord.memoryPreviewStatus !== "preview_only" || approving}
                onClick={() => onApproveMemory(activeRecord)}
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                批准写入
              </Button>

              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={activeRecord.analysisStatus !== "analyzed"}
                onClick={() => onCreateHandoff(activeRecord)}
              >
                <Send className="h-4 w-4" />
                发送到背调
              </Button>
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
