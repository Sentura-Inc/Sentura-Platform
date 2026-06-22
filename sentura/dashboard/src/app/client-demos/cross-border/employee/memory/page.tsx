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
  FileText,
  Filter,
  Image as ImageIcon,
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
} from "../_data/employee-api";
import {
  normalizeImageMemoryImport,
  normalizeJsonMemoryImport,
  normalizeTextMemoryImport,
  toGatewayChatAttachments,
  type MemoryImageAttachment,
  type MemoryImportInputFormat,
  type MemoryImportSourceKind,
} from "../_data/memory-import-normalizer";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";

type SheetMode = "add" | "supplement" | "detail" | "filters" | null;
type ImportMode = "json" | "text" | "image";
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
  accio: "Accio",
  alibaba_international: "阿里国际站",
  manual_import: "手动导入",
  demo_data: "演示数据",
  other: "其他",
};

const importModeLabels: Record<ImportMode, string> = {
  json: "JSON 文件",
  text: "粘贴文字",
  image: "聊天截图",
};
const importModeDescriptions: Record<ImportMode, string> = {
  json: "上传 Accio/聊天导出的 JSON 文件。",
  text: "粘贴微信、Accio 或阿里聊天片段。",
  image: "上传聊天截图，系统会用当前记忆员工模型读取图片。",
};
const importModeSourceLabels: Record<ImportMode, string> = {
  json: "手动 JSON",
  text: "手动文字",
  image: "手动图片",
};
const importModeSourceKinds: Record<ImportMode, MemoryImportSourceKind> = {
  json: "manual_json",
  text: "manual_text",
  image: "manual_image",
};
const importModeInputFormats: Record<ImportMode, MemoryImportInputFormat> = {
  json: "json",
  text: "pasted_text",
  image: "image",
};
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
  lead_discovery: "获客员工",
  manual_screening: "手动录入",
  accio_handoff: "聊天记录移交",
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

function storedImportMetadata(payload: unknown): {
  inputFormat?: MemoryImportInputFormat;
  sourceKind?: MemoryImportSourceKind;
  attachmentMetadata?: Array<Record<string, unknown>>;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const metadata = (payload as { export_metadata?: unknown }).export_metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const record = metadata as Record<string, unknown>;
  const inputFormat = record.input_format;
  const sourceKind = record.source_kind;
  return {
    inputFormat:
      inputFormat === "json" || inputFormat === "pasted_text" || inputFormat === "image"
        ? inputFormat
        : undefined,
    sourceKind:
      sourceKind === "manual_json" || sourceKind === "manual_text" || sourceKind === "manual_image"
        ? sourceKind
        : undefined,
    attachmentMetadata: Array.isArray(record.attachment_metadata)
      ? record.attachment_metadata.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object" && !Array.isArray(item)),
        )
      : undefined,
  };
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
  const [importMode, setImportMode] = useState<ImportMode>("json");
  const [uploadName, setUploadName] = useState("");
  const [uploadPayload, setUploadPayload] = useState<unknown | null>(null);
  const [rawImportText, setRawImportText] = useState("");
  const [imageAttachments, setImageAttachments] = useState<MemoryImageAttachment[]>([]);
  const [attachmentMetadata, setAttachmentMetadata] = useState<Array<Record<string, unknown>>>([]);
  const [highlightedRecordIds, setHighlightedRecordIds] = useState<Set<string>>(() => new Set());
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [deleteIntentIds, setDeleteIntentIds] = useState<string[]>([]);
  const [deletingMemory, setDeletingMemory] = useState(false);
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
    setImportMode("json");
    setUploadName("");
    setUploadPayload(null);
    setRawImportText("");
    setImageAttachments([]);
    setAttachmentMetadata([]);
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

  const resetImportState = (mode: ImportMode = "json") => {
    setImportMode(mode);
    setUploadName("");
    setUploadPayload(null);
    setRawImportText("");
    setImageAttachments([]);
    setAttachmentMetadata([]);
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
    setImageAttachments([]);
    setAttachmentMetadata([]);
    setRawImportText("");
    try {
      const prepared = normalizeJsonMemoryImport(JSON.parse(await file.text()) as unknown, file.name);
      setUploadPayload(prepared.chatExport);
      showNotice(`已读取 ${file.name}，可以导入或提交记忆员工分析。`, "info");
    } catch (error) {
      setUploadPayload(null);
      showNotice(error instanceof Error ? error.message : "聊天记录文件解析失败。", "error", 8000);
    }
  };

  const handlePastedTextChange = (value: string) => {
    setRawImportText(value);
    setUploadName(value.trim() ? "粘贴聊天记录.txt" : "");
    setImageAttachments([]);
    setAttachmentMetadata([]);
    try {
      if (!value.trim()) {
        setUploadPayload(null);
        return;
      }
      const prepared = normalizeTextMemoryImport(value);
      setUploadPayload(prepared.chatExport);
    } catch {
      setUploadPayload(null);
    }
  };

  const handleImageFiles = async (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return;
    setRawImportText("");
    setUploadPayload(null);
    try {
      const prepared = await normalizeImageMemoryImport(files);
      setUploadName(prepared.recordName);
      setUploadPayload(prepared.chatExport);
      setImageAttachments(prepared.attachments ?? []);
      setAttachmentMetadata(prepared.attachmentMetadata ?? []);
      showNotice(`已读取 ${prepared.attachments?.length ?? 0} 张聊天截图，导入并分析时会分批提交给当前记忆员工模型。`, "info", 6000);
    } catch (error) {
      setUploadName("");
      setImageAttachments([]);
      setAttachmentMetadata([]);
      showNotice(error instanceof Error ? error.message : "聊天截图读取失败。", "error", 8000);
    }
  };

  const importOnly = async (recordName: string, sourceLabel: string) => {
    if (!uploadPayload) {
      showNotice("请先上传系统可读取的聊天记录文件。", "error");
      return;
    }
    if (importMode === "image") {
      showNotice("截图导入需要立即分析；系统不会保存原始图片用于之后重新分析。", "error", 8000);
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
        inputFormat: importModeInputFormats[importMode],
        sourceKind: importModeSourceKinds[importMode],
        chatExport: uploadPayload,
        rawText: importMode === "text" ? rawImportText : undefined,
        attachmentMetadata,
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
      setRawImportText("");
      setImageAttachments([]);
      setAttachmentMetadata([]);
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
          ? "记忆员工还没有启动，请先完成系统初始化。"
          : "后台未连接，暂时不能执行记忆分析。",
        "error",
      );
      return;
    }
    const plannedSessionKey = createPlannedEmployeeSessionKey(ACCIO_AGENT_ID);
    const estimatedMs = input.inputFormat === "image"
      ? Math.min(1_200_000, 300_000 + Math.max(1, input.attachments?.length ?? 0) * 45_000)
      : 180_000;
    let taskId: string | undefined;
    let createdImport: Awaited<ReturnType<typeof createEmployeeAccioImport>> | null = null;
    setSheetMode(null);
    try {
      createdImport = await createEmployeeAccioImport(input, plannedSessionKey);
      if (createdImport.agentRun.status === "queued" || !createdImport.agentRun.sessionKey) {
        if (input.inputFormat === "image") {
          const message = "当前后台容量不足，截图任务不能排队执行；系统不会保存原始图片，请稍后重新上传并分析。";
          await failEmployeeTaskInDb({
            agentRunId: createdImport.agentRun.id,
            sessionKey: plannedSessionKey,
            error: new EmployeeTaskError("gateway", message, { sessionKey: plannedSessionKey }),
            message,
          }).catch(() => undefined);
          await refreshDbBackedMemory().catch(() => undefined);
          showNotice(message, "error", 8000);
          return;
        }
        showNotice("当前 CBE 后台任务较多，记忆整理任务已进入排队中；系统不会启动超出容量的员工会话。", "info", 8000);
        await refreshDbBackedMemory().catch(() => undefined);
        return;
      }
      const activeSessionKey = createdImport.agentRun.sessionKey;
      const localTaskId = startTask({
        id: createdImport.agentRun.id,
        kind: "accio_memory",
        title: "记忆整理",
        message: "记忆整理任务已启动，后台员工正在分析聊天记录。",
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
      const message = `记忆员工已返回 ${result.records.length} 份结构化摘要，已更新当前列表。`;
      completeTask(localTaskId, result.records.length, message, result.sessionKey);
      await refreshDbBackedMemory();
      if (!failedRecordId) {
        setUploadName("");
        setUploadPayload(null);
        setRawImportText("");
        setImageAttachments([]);
        setAttachmentMetadata([]);
      }
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
      inputFormat: importModeInputFormats[importMode],
      sourceKind: importModeSourceKinds[importMode],
      chatExport: uploadPayload,
      rawText: importMode === "text" ? rawImportText : undefined,
      attachments: importMode === "image" ? toGatewayChatAttachments(imageAttachments) : undefined,
      attachmentMetadata,
      supplementTarget: supplementContext
        ? {
            customerId: supplementContext.customerId,
            companyName: supplementContext.companyName,
            source: supplementContext.source,
          }
        : undefined,
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
    const metadata = storedImportMetadata(storedPayload);
    if (metadata.inputFormat === "image") {
      setRows((current) =>
        current.map((item) =>
          item.recordId === record.recordId ? { ...item, analysisStatus: "failed" } : item,
        ),
      );
      showNotice("这条记录来自截图导入，系统未保存原图，无法直接重新分析；请重新上传截图。", "error", 8000);
      return;
    }
    await submitMemoryTask({
      recordName: record.name,
      sourceLabel: sourceLabels[record.source],
      inputFormat: metadata.inputFormat ?? "json",
      sourceKind: metadata.sourceKind ?? "manual_json",
      chatExport: storedPayload,
      attachmentMetadata: metadata.attachmentMetadata,
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
                调整筛选条件，或点击“添加新记录”导入 JSON、文字或聊天截图。
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
        importMode={importMode}
        setImportMode={(mode) => {
          resetImportState(mode);
        }}
        uploadName={uploadName}
        setUploadName={setUploadName}
        uploadPayload={uploadPayload}
        rawImportText={rawImportText}
        imageAttachments={imageAttachments}
        onUploadFile={handleUploadFile}
        onPastedTextChange={handlePastedTextChange}
        onImageFiles={handleImageFiles}
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
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  filterOptions,
  activeFilterCount,
  supplementContext,
  importMode,
  setImportMode,
  uploadName,
  setUploadName,
  uploadPayload,
  rawImportText,
  imageAttachments,
  onUploadFile,
  onPastedTextChange,
  onImageFiles,
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
  importMode: ImportMode;
  setImportMode: (mode: ImportMode) => void;
  uploadName: string;
  setUploadName: (name: string) => void;
  uploadPayload: unknown | null;
  rawImportText: string;
  imageAttachments: MemoryImageAttachment[];
  onUploadFile: (file: File | undefined) => void;
  onPastedTextChange: (value: string) => void;
  onImageFiles: (files: FileList | null | undefined) => void;
  canRun: boolean;
  agentLoading: boolean;
  gatewayConnected: boolean;
  taskRunning: boolean;
  onImportOnly: (recordName: string, sourceLabel: string) => void;
  onAnalyzeUpload: (recordName: string, sourceLabel: string) => void;
}) {
  const [recordName, setRecordName] = useState("");
  const isSupplementMode = mode === "supplement" && Boolean(supplementContext);
  const effectiveRecordName = recordName || uploadName.replace(/\.(json|txt)$/i, "");
  const uploadConversationCount = useMemo(() => {
    if (importMode === "image") return Math.max(1, imageAttachments.length);
    if (!uploadPayload || typeof uploadPayload !== "object" || Array.isArray(uploadPayload)) return 1;
    const conversations = (uploadPayload as { conversations?: unknown }).conversations;
    return Array.isArray(conversations) ? conversations.length : 1;
  }, [imageAttachments.length, importMode, uploadPayload]);
  const uploadEstimate = useMemo(
    () => estimateMemoryTaskCost(uploadConversationCount),
    [uploadConversationCount],
  );

  useEffect(() => {
    if (mode !== "supplement" || !supplementContext) return;
    setRecordName(supplementRecordName(supplementContext.companyName));
  }, [mode, supplementContext]);

  useEffect(() => {
    if (mode !== "add") return;
    setRecordName("");
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
                  : "导入手动聊天记录，支持 JSON、粘贴文字和聊天截图。"}
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
              <div className="grid grid-cols-3 gap-2">
                {(["json", "text", "image"] as const).map((modeValue) => {
                  const Icon = modeValue === "json" ? FileJson : modeValue === "text" ? FileText : ImageIcon;
                  return (
                    <Button
                      key={modeValue}
                      type="button"
                      variant={importMode === modeValue ? "default" : "outline"}
                      className="h-auto min-h-16 flex-col gap-1 whitespace-normal px-2 py-2 text-center"
                      onClick={() => setImportMode(modeValue)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{importModeLabels[modeValue]}</span>
                    </Button>
                  );
                })}
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {importModeDescriptions[importMode]}
              </div>
              {importMode === "json" ? (
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
                      if (file && !recordName && !isSupplementMode) setRecordName(file.name.replace(/\.json$/i, ""));
                      onUploadFile(file);
                    }}
                  />
                </label>
              ) : null}
              {importMode === "text" ? (
                <textarea
                  className="min-h-44 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={rawImportText}
                  onChange={(event) => {
                    onPastedTextChange(event.target.value);
                    if (!recordName && event.target.value.trim() && !isSupplementMode) {
                      setRecordName("手动聊天记录");
                    }
                  }}
                  placeholder={"粘贴聊天记录，例如：\nIt's in stock and ships within 1 business day.\n2026-06-22 19:05\n多久可以发货？是现货吗？"}
                />
              ) : null}
              {importMode === "image" ? (
                <div className="space-y-3">
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/40">
                    <ImageIcon className="mb-2 h-5 w-5" />
                    {imageAttachments.length > 0 ? `已选择 ${imageAttachments.length} 张聊天截图` : "上传聊天截图图片"}
                    <Input
                      className="hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.heic,.heif"
                      multiple
                      onChange={(event) => {
                        const files = event.target.files;
                        if (files?.length && !recordName && !isSupplementMode) setRecordName(`聊天截图 ${files.length} 张`);
                        void onImageFiles(files);
                      }}
                    />
                  </label>
                  {imageAttachments.length > 0 ? (
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border bg-muted/20 px-3 py-2 text-xs">
                      {imageAttachments.map((attachment) => (
                        <div key={`${attachment.sha256}-${attachment.fileName}`} className="flex items-center justify-between gap-3">
                          <span className="truncate">{attachment.fileName}</span>
                          <span className="shrink-0 text-muted-foreground">{(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Input
                value={effectiveRecordName}
                onChange={(event) => setRecordName(event.target.value)}
                placeholder="记录名称"
              />
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                记录来源：{importModeSourceLabels[importMode]}
              </div>
              <div
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                title="这是内部安全分级，表示这类数据是业务聊天记录，默认只展示摘要和预览。"
              >
                数据安全：业务聊天记录，只生成摘要和写入预览；截图原图不写入长期记忆
              </div>
              <TaskCostNotice {...uploadEstimate} />
              {importMode === "image" ? (
                <SystemNotice text="截图任务需要立即导入并分析；系统只保存图片 hash/元数据和结构化结果，不保存原图用于之后重新分析。" />
              ) : null}
              {uploadName && !uploadPayload ? (
                <SystemNotice text="当前文件尚未成功读取，请重新选择聊天记录文件。" />
              ) : null}
              {!isSupplementMode && (!gatewayConnected || !canRun) ? (
                <SystemNotice text={gatewayConnected ? "记忆员工还没有启动，请先完成系统初始化。" : "后台未连接，暂时不能执行记忆分析。"} />
              ) : null}
            </div>
            <SheetFooter>
              {isSupplementMode && importMode !== "image" ? (
                <Button disabled={!uploadPayload || taskRunning} onClick={() => onImportOnly(effectiveRecordName, importModeSourceLabels[importMode])}>
                  <Database className="h-4 w-4" />
                  提交补充记录
                </Button>
              ) : (
                <>
                  {importMode !== "image" ? (
                    <Button variant="outline" disabled={!uploadPayload || taskRunning} onClick={() => onImportOnly(effectiveRecordName, importModeSourceLabels[importMode])}>
                      <Database className="h-4 w-4" />
                      仅导入
                    </Button>
                  ) : null}
                  <Button disabled={!canRun || agentLoading || !uploadPayload || taskRunning} onClick={() => onAnalyzeUpload(effectiveRecordName, importModeSourceLabels[importMode])}>
                    {agentLoading || taskRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isSupplementMode ? "提交并分析" : "导入并分析"}
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
            删除后会移除对应聊天记忆、分析摘要和待移交事件；这不会自动删除已生成的背调报告。
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

function detailText(value: unknown, fallback = "待确认"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.map((item) => detailText(item, "")).filter(Boolean).join(", ") || fallback;
  if (value && typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = detailText(item, "");
        return text ? `${key}: ${text}` : null;
      })
      .filter((item): item is string => Boolean(item))
      .slice(0, 4);
    return parts.length > 0 ? parts.join("；") : fallback;
  }
  return fallback;
}

function detailPairs(record: Record<string, unknown> | undefined, keys: Array<[string, string]>) {
  return keys
    .map(([key, label]) => ({ key, label, value: detailText(record?.[key]) }))
    .filter((item) => item.value !== "待确认");
}

function actionText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const primary = detailText(
    record.action ??
      record.next_action ??
      record.task ??
      record.title ??
      record.description ??
      record.summary ??
      record.note,
    "",
  );
  const due = detailText(record.due_date ?? record.deadline ?? record.date ?? record.when, "");
  const owner = detailText(record.owner ?? record.assignee ?? record.responsible, "");
  const amount = detailText(record.amount ?? record.amount_usd ?? record.deposit_usd ?? record.price_usd, "");
  const parts = [
    primary,
    due ? `时间：${due}` : null,
    owner ? `负责人：${owner}` : null,
    amount ? `金额：${amount}` : null,
  ].filter((item): item is string => Boolean(item));
  return parts.length > 0 ? parts.join("，") : detailText(record, "");
}

function actionList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(",").map(actionText).filter((item): item is string => Boolean(item));
  }
  if (!Array.isArray(value)) {
    const single = actionText(value);
    return single ? [single] : [];
  }
  return value.map(actionText).filter((item): item is string => Boolean(item));
}

type FieldLabelMap = Record<string, string>;

const intentFieldLabels: FieldLabelMap = {
  product: "产品",
  product_zh: "产品中文",
  model: "型号",
  specification: "规格",
  specifications: "规格",
  quantity: "数量",
  final_quantity: "最终数量",
  monthly_potential_quantity: "月潜在量",
  unit: "单位",
  incoterm: "贸易条款",
  incoterm_zh: "贸易条款中文",
  packaging: "包装要求",
  customization: "定制要求",
  customization_note: "定制说明",
  lead_time: "交期/发货",
  delivery_time: "交付时间",
  target_price_usd: "目标单价",
  seller_best_price_usd: "卖方最好单价",
  payment_terms: "付款方式",
  payment_terms_zh: "付款方式中文",
  sample_terms: "样品条款",
  sample_status: "样品状态",
  documents: "文件/认证",
  summary_zh: "中文摘要",
  inquiry_summary_zh: "咨询内容中文",
};

const preferredIntentFields = [
  "product",
  "product_zh",
  "model",
  "specification",
  "specifications",
  "quantity",
  "final_quantity",
  "monthly_potential_quantity",
  "unit",
  "incoterm",
  "incoterm_zh",
  "packaging",
  "customization",
  "customization_note",
  "lead_time",
  "delivery_time",
  "target_price_usd",
  "seller_best_price_usd",
  "payment_terms",
  "payment_terms_zh",
  "sample_terms",
  "sample_status",
  "documents",
  "summary_zh",
  "inquiry_summary_zh",
];

const reportZhLabels: FieldLabelMap = {
  executive_summary: "中文摘要",
  customer_profile_summary: "客户画像",
  inquiry_summary: "咨询内容",
  purchase_intent_summary: "采购意图",
  pricing_terms_summary: "价格与条款",
  shipping_timeline_summary: "交付与时效",
  payment_terms_summary: "付款方式",
  sample_status_summary: "样品状态",
  follow_up_summary: "跟进建议",
  risk_or_missing_info: "风险/缺口",
};

const preferredReportZhFields = [
  "executive_summary",
  "customer_profile_summary",
  "inquiry_summary",
  "purchase_intent_summary",
  "pricing_terms_summary",
  "shipping_timeline_summary",
  "payment_terms_summary",
  "sample_status_summary",
  "follow_up_summary",
  "risk_or_missing_info",
];

const behaviorFieldLabels: FieldLabelMap = {
  summary_zh: "中文判断",
  summary: "原文/模型摘要",
  urgency: "紧急度",
  price_sensitivity: "价格敏感度",
  decision_role: "决策角色",
  risk_flags: "风险提示",
  inference_notes: "不确定点",
  credibility: "可信度",
  buying_process: "采购流程",
  negotiation_style: "议价方式",
};

const preferredBehaviorFields = [
  "summary_zh",
  "summary",
  "urgency",
  "price_sensitivity",
  "decision_role",
  "risk_flags",
  "inference_notes",
  "credibility",
  "buying_process",
  "negotiation_style",
];

const handoffFieldLabels: FieldLabelMap = {
  company_name: "公司",
  country: "国家",
  contact_person: "联系人",
  website: "网站",
  email: "邮箱",
  product_interest: "背调关注商品",
  supplied_fields: "已提供字段",
  missing_fields: "待补充字段",
  operator_notes: "交接备注",
};

const preferredHandoffFields = [
  "company_name",
  "country",
  "contact_person",
  "website",
  "email",
  "product_interest",
  "supplied_fields",
  "missing_fields",
  "operator_notes",
];

const missingFieldLabels: FieldLabelMap = {
  company_name: "公司名称",
  country: "国家/地区",
  contact_person: "联系人",
  website: "官网",
  company_email: "公司邮箱",
  email: "邮箱",
  registry_number: "注册号",
  product_interest: "采购商品",
};

function uiRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readableFieldLabel(key: string, labels: FieldLabelMap) {
  return labels[key] ?? humanizeKey(key);
}

function fieldRows(
  record: Record<string, unknown> | undefined,
  preferredFields: string[],
  labels: FieldLabelMap,
  omittedFields: string[] = [],
) {
  if (!record) return [];
  const omitted = new Set(omittedFields);
  const keys = [
    ...preferredFields.filter((key) => key in record),
    ...Object.keys(record).filter((key) => !preferredFields.includes(key)),
  ];
  return keys
    .filter((key, index, all) => all.indexOf(key) === index && !omitted.has(key))
    .map((key) => {
      const value = record[key];
      const text = detailText(value, "");
      return text ? { key, label: readableFieldLabel(key, labels), value: text } : null;
    })
    .filter((row): row is { key: string; label: string; value: string } => Boolean(row));
}

function StructuredFieldBlock({
  record,
  emptyText,
  labels,
  preferredFields,
  omittedFields,
}: {
  record: Record<string, unknown> | undefined;
  emptyText: string;
  labels: FieldLabelMap;
  preferredFields: string[];
  omittedFields?: string[];
}) {
  const rows = fieldRows(record, preferredFields, labels, omittedFields);
  if (!rows.length) {
    return <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
      {rows.map((row) => (
        <div key={row.key} className="flex gap-2">
          <span className="min-w-28 shrink-0 text-xs text-muted-foreground">{row.label}</span>
          <span className="min-w-0 break-words">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function StructuredRecordList({
  items,
  emptyText,
  labels,
  preferredFields,
}: {
  items: Array<Record<string, unknown>> | undefined;
  emptyText: string;
  labels: FieldLabelMap;
  preferredFields: string[];
}) {
  if (!items?.length) {
    return <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
          {fieldRows(item, preferredFields, labels).map((row) => (
            <div key={row.key} className="flex gap-2">
              <span className="min-w-28 shrink-0 text-xs text-muted-foreground">{row.label}</span>
              <span className="min-w-0 break-words">{row.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const priceFieldLabels: Record<string, string> = {
  product: "产品",
  product_zh: "产品中文",
  currency: "币种",
  unit: "单位",
  quantity: "数量",
  final_quantity: "最终数量",
  quantity_context: "数量说明",
  incoterm: "贸易条款",
  packaging: "包装",
  payment_terms: "付款条款",
  sample_terms: "样品条款",
  sample_status: "样品状态",
  price_context: "价格说明",
  price_context_zh: "价格说明中文",
  target_price_usd: "目标单价",
  quoted_price_usd: "报价单价",
  agreed_or_best_price_usd: "成交/最好单价",
  seller_best_price_usd: "卖方最好单价",
  unit_price_usd: "单价",
  quoted_unit_price_usd: "报价单价",
  agreed_unit_price_usd: "成交单价",
  agreed_or_best_unit_price_usd: "成交/最好单价",
  all_in_unit_price_usd: "全包单价",
  freight_usd: "运费",
  goods_total_usd: "货值总价",
  quoted_total_usd: "报价总价",
  agreed_total_usd: "成交总价",
  final_total_usd: "最终总价",
  agreed_or_best_total_usd: "成交/最好总价",
  total_usd: "总价",
  total_price_usd: "总价",
  ddp_total_usd: "DDP 总价",
  sample_price_usd: "样品费",
  sample_invoice_usd: "样品发票金额",
};

const preferredPriceFields = [
  "product",
  "quantity",
  "final_quantity",
  "quantity_context",
  "unit",
  "currency",
  "product_zh",
  "incoterm",
  "packaging",
  "payment_terms",
  "sample_terms",
  "sample_status",
  "price_context",
  "price_context_zh",
  "target_price_usd",
  "quoted_price_usd",
  "agreed_or_best_price_usd",
  "seller_best_price_usd",
  "unit_price_usd",
  "quoted_unit_price_usd",
  "agreed_unit_price_usd",
  "agreed_or_best_unit_price_usd",
  "all_in_unit_price_usd",
  "goods_total_usd",
  "freight_usd",
  "quoted_total_usd",
  "agreed_total_usd",
  "final_total_usd",
  "agreed_or_best_total_usd",
  "total_usd",
  "total_price_usd",
  "ddp_total_usd",
  "sample_price_usd",
  "sample_invoice_usd",
];

function humanizeKey(key: string) {
  return key.replace(/_/g, " ");
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[, ]/g, "").replace(/^US\$|^USD/i, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function priceContextText(item: Record<string, unknown>) {
  return [
    item.price_context,
    item.quantity_context,
    item.product,
    item.incoterm,
  ].map((value) => detailText(value, "").toLowerCase()).join(" ");
}

function isLikelyTotalPrice(key: string, value: unknown, item: Record<string, unknown>) {
  const normalizedKey = key.toLowerCase();
  if (/(total|invoice|freight|goods_total|ddp_total)/.test(normalizedKey)) return true;
  if (!/(target_price_usd|quoted_price_usd|agreed_or_best_price_usd|seller_best_price_usd)/.test(normalizedKey)) {
    return false;
  }
  const amount = numericValue(value);
  if (amount === null || amount < 100) return false;
  const context = priceContextText(item);
  return /\btotal\b|ddp|all[- ]?in|freight|goods total|for \d+|pcs/.test(context);
}

function priceLabel(key: string, value: unknown, item: Record<string, unknown>) {
  if (key === "target_price_usd" && isLikelyTotalPrice(key, value, item)) return "目标总价";
  if (key === "quoted_price_usd" && isLikelyTotalPrice(key, value, item)) return "报价总价";
  if (key === "agreed_or_best_price_usd" && isLikelyTotalPrice(key, value, item)) return "成交/最好总价";
  if (key === "seller_best_price_usd" && isLikelyTotalPrice(key, value, item)) return "卖方最好总价";
  return priceFieldLabels[key] ?? humanizeKey(key);
}

function priceValue(key: string, value: unknown) {
  const amount = numericValue(value);
  if (amount !== null && /(usd|price|total|freight|invoice|cost)/i.test(key)) {
    return `USD ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return detailText(value);
}

function quantityFromPriceItem(item: Record<string, unknown>) {
  const direct = numericValue(item.final_quantity ?? item.quantity);
  if (direct) return direct;
  const text = detailText(item.quantity_context ?? "", "");
  const match = /([0-9][0-9,]*)/.exec(text);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function totalFromPriceItem(item: Record<string, unknown>) {
  const totalKeys = [
    "final_total_usd",
    "agreed_or_best_total_usd",
    "quoted_total_usd",
    "ddp_total_usd",
    "total_price_usd",
    "total_usd",
    "goods_total_usd",
    "agreed_or_best_price_usd",
    "quoted_price_usd",
    "target_price_usd",
    "seller_best_price_usd",
  ];
  for (const key of totalKeys) {
    if (key in item && isLikelyTotalPrice(key, item[key], item)) {
      const amount = numericValue(item[key]);
      if (amount) return amount;
    }
  }
  for (const [key, value] of Object.entries(item)) {
    if (key !== "freight_usd" && isLikelyTotalPrice(key, value, item)) {
      const amount = numericValue(value);
      if (amount) return amount;
    }
  }
  return null;
}

function priceRows(item: Record<string, unknown>) {
  const keys = [
    ...preferredPriceFields.filter((key) => key in item),
    ...Object.keys(item).filter((key) => !preferredPriceFields.includes(key)),
  ];
  const rows = keys
    .map((key) => {
      const value = item[key];
      if (value === undefined || value === null || detailText(value, "") === "") return null;
      return { key, label: priceLabel(key, value, item), value: priceValue(key, value) };
    })
    .filter((row): row is { key: string; label: string; value: string } => Boolean(row));
  const total = totalFromPriceItem(item);
  const quantity = quantityFromPriceItem(item);
  const hasUnitEquivalent = rows.some((row) => row.key === "all_in_unit_price_usd" || row.key === "unit_price_usd");
  if (total && quantity && !hasUnitEquivalent) {
    rows.push({
      key: "__derived_unit_price",
      label: "折合单价",
      value: `USD ${(total / quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc`,
    });
  }
  return rows;
}

function PriceTermList({ items, emptyText }: { items: Array<Record<string, unknown>> | undefined; emptyText: string }) {
  if (!items?.length) {
    return <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const rows = priceRows(item);
        return (
          <div key={index} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            {rows.map((row) => (
              <div key={row.key} className="flex gap-2">
                <span className="min-w-28 shrink-0 text-xs text-muted-foreground">{row.label}</span>
                <span className="min-w-0 break-words">{row.value}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MemoryReportDialog({
  activeRecord,
  onClose,
  onCreateHandoff,
}: {
  activeRecord: MemoryRecordItem;
  onClose: () => void;
  onCreateHandoff: (record: MemoryRecordItem) => void;
}) {
  const profilePairs = detailPairs(activeRecord.customerProfile, [
    ["company_name", "公司"],
    ["contact_person", "联系人"],
    ["country", "国家"],
    ["website", "网站"],
    ["email", "邮箱"],
  ]);
  const behaviorSignals = activeRecord.behaviorSignals ?? {};
  const reportZh = uiRecord(behaviorSignals.report_zh ?? behaviorSignals.translation_zh);
  const chineseSummary = detailText(reportZh?.executive_summary ?? behaviorSignals.summary_zh, "");
  const sourceSummary = detailText(behaviorSignals.summary, activeRecord.summary);
  const behaviorSummary = chineseSummary || sourceSummary;
  const handoff = activeRecord.screeningHandoffTarget;
  const nextActions = actionList(activeRecord.nextActions);
  const missingFields = activeRecord.missingFields?.map((field) => missingFieldLabels[field] ?? field) ?? [];
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
                  完整分析报告
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {activeRecord.analysisStatus === "analyzed"
                    ? behaviorSummary
                    : "等待记忆员工返回结构化摘要后展示客户画像、需求商品、价格、付款/物流条款和跟进上下文。"}
                </p>
                {activeRecord.analysisStatus === "analyzed" && chineseSummary && sourceSummary && chineseSummary !== sourceSummary ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    原文摘要：{sourceSummary}
                  </p>
                ) : null}
                {activeRecord.analysisStatus === "analyzed" ? (
                  <div className="mt-3">
                    <StructuredFieldBlock
                      record={reportZh}
                      emptyText="暂无中文分段报告；重新分析后会生成客户画像、采购意图、价格条款和跟进建议。"
                      labels={reportZhLabels}
                      preferredFields={preferredReportZhFields}
                    />
                  </div>
                ) : null}
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Clock3 className="h-4 w-4 text-sky-600" />
                  客户档案
                </div>
                {profilePairs.length > 0 ? (
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {profilePairs.map((item) => (
                      <div key={item.key} className="rounded-md bg-muted/40 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                        <dd className="mt-1 break-words">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    客户主体仍待确认，已保留为待确认档案。
                  </div>
                )}
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-primary" />
                  咨询内容与采购意图
                </div>
                <StructuredRecordList
                  items={activeRecord.purchaseIntent}
                  emptyText="尚未抽取到明确商品、数量或交期咨询。"
                  labels={intentFieldLabels}
                  preferredFields={preferredIntentFields}
                />
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4 text-primary" />
                  价格与条款
                </div>
                <PriceTermList items={activeRecord.negotiatedPrices} emptyText="尚未抽取到明确价格、付款或贸易条款。" />
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  客户判断与风险信号
                </div>
                <StructuredFieldBlock
                  record={behaviorSignals}
                  emptyText="尚未抽取到客户可信度、采购角色、紧急度或风险提示。"
                  labels={behaviorFieldLabels}
                  preferredFields={preferredBehaviorFields}
                  omittedFields={["report_zh", "translation_zh", "screening_handoff_target", "supplement_target"]}
                />
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4 text-primary" />
                  写入记忆预览
                </div>
                <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                  <div>仅展示简洁事实和来源引用，不写入原始聊天。</div>
                  {nextActions.length ? (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">下一步</div>
                      <ul className="list-disc space-y-1 pl-5">
                        {nextActions.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {missingFields.length ? (
                    <div>待补充字段：{missingFields.join("、")}</div>
                  ) : null}
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
                      {activeRecord.memoryPreviewStatus === "preview_only" ? "仅预览" : activeRecord.memoryPreviewStatus}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">任务 ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {activeRecord.latestAgentRunId ?? "暂无"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">背调交接</dt>
                    <dd className="mt-1">
                      <StructuredFieldBlock
                        record={handoff}
                        emptyText="等待分析完成"
                        labels={handoffFieldLabels}
                        preferredFields={preferredHandoffFields}
                        omittedFields={["source", "lead_id", "target_id"]}
                      />
                    </dd>
                  </div>
                </dl>
              </section>

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
