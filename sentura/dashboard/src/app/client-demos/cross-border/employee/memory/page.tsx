"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  Eye,
  FileJson,
  FileText,
  Filter,
  Image as ImageIcon,
  Loader2,
  MapPin,
  PackageSearch,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UserRound,
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
import { CBE_EMPLOYEE_MEMORY_PATH } from "@/lib/cross-border-routes";
import { cn } from "@/lib/utils";
import { ListPagination, usePagedItems } from "@/components/cross-border/brand-ui";
import { AnimatedList, AnimatedTableRow } from "@/components/cross-border/animated-list";
import { TaskCostNotice } from "@/components/cross-border/employee-cost";
import { MemoryAnalysisContent, MemorySourceTranscript } from "@/components/cross-border/memory-chat-customer-list";
import { buyerTypeLabel, canonicalBuyerType, canonicalProduct, productLabel } from "@/components/cross-border/customer-labels";
import {
  CBE_EMPLOYEE_TASK_RETRY_EVENT,
  isCbeEmployeeTaskActive,
  useCbeEmployeeStore,
  type CbeEmployeeTaskRecord,
} from "@/stores/use-cbe-employee-store";
import {
  type MemoryRecordItem,
  estimateMemoryTaskCost,
  leadBuyerTypeOptions,
} from "../_data/employee-data";
import {
  ACCIO_AGENT_ID,
  EmployeeTaskError,
  createPlannedEmployeeSessionKey,
  employeeTaskErrorMessage,
  estimateEmployeeTaskTimeoutMs,
  isEmployeeTaskCancellation,
  runAccioMemoryTask,
  type AccioMemoryTaskInput,
  type EmployeeTaskProgress,
} from "../_data/employee-task-runner";
import {
  CbeEmployeeApiError,
  cancelEmployeeTaskInDb,
  completeEmployeeAccioImport,
  createEmployeeAccioImport,
  deleteEmployeeMemoryRecords,
  failEmployeeTaskInDb,
  fetchEmployeeAccioImportPayload,
  fetchEmployeeMemoryRecords,
  fetchEmployeeTasks,
  startEmployeeAccioImportAnalysis,
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
import {
  clearCbeEmployeeTaskAbortSignal,
  createCbeEmployeeTaskAbortSignal,
} from "../_data/employee-task-cancellation";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";

type SheetMode = "add" | "detail" | "filters" | null;
type ImportMode = "json" | "text" | "image";
type ImportRange = "all" | "today" | "7d" | "30d";
type MemoryHighlightScope = "memory-results";
type ChatCustomerFilter = "all" | "sufficient" | "insufficient" | "priced" | "clear_intent";
type MemoryAnalyzeResult = "completed" | "queued" | "cancelled" | "failed" | "skipped";

interface MemoryFilters {
  sources: MemoryRecordItem["source"][];
  importRange: ImportRange;
  countries: string[];
  buyerTypes: string[];
  products: string[];
}

type FilterOption = {
  value: string;
  label: string;
};

interface ChatCustomerRow {
  record: MemoryRecordItem;
  companyName: string;
  displayName: string;
  companyNameMissing: boolean;
  contact?: string;
  country?: string;
  website?: string;
  email?: string;
  buyerRole?: string;
  buyerType?: string;
  products: string[];
  productCategories: string[];
  intentSummary?: string;
  priceSummary?: string;
  behaviorSummary?: string;
  nextAction?: string;
  missingLabels: string[];
  infoSufficient: boolean;
  hasPrice: boolean;
  demandClear: boolean;
  searchText: string;
}

const emptyFilters: MemoryFilters = {
  sources: [],
  importRange: "all",
  countries: [],
  buyerTypes: [],
  products: [],
};

const memoryBuyerTypeValues = new Set([
  ...leadBuyerTypeOptions.map((item) => item.id),
  "repair-store",
  "distributor",
  "wholesaler",
  "retailer",
  "e-commerce-seller",
]);

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

function recordTextValue(record: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function compactJoin(values: Array<string | undefined>, separator = " · ") {
  return values.filter((value): value is string => Boolean(value)).join(separator);
}

function priceLine(item: Record<string, unknown>) {
  return compactJoin([
    recordTextValue(item, "quantity_context"),
    recordTextValue(item, "price_context_zh", "price_context"),
    recordTextValue(item, "final_total_usd", "agreed_or_best_total_usd", "quoted_total_usd")
      ? `总价 ${recordTextValue(item, "final_total_usd", "agreed_or_best_total_usd", "quoted_total_usd")}`
      : undefined,
    recordTextValue(item, "all_in_unit_price_usd", "agreed_or_best_price_usd", "quoted_price_usd")
      ? `单价 ${recordTextValue(item, "all_in_unit_price_usd", "agreed_or_best_price_usd", "quoted_price_usd")}`
      : undefined,
  ], "；");
}

function intentLine(item: Record<string, unknown>) {
  return compactJoin([
    recordTextValue(item, "product_zh", "product"),
    recordTextValue(item, "quantity") ? `${recordTextValue(item, "quantity")} ${recordTextValue(item, "unit") ?? "pcs"}` : undefined,
    recordTextValue(item, "summary_zh"),
    recordTextValue(item, "payment_terms_zh", "payment_terms"),
  ], "；");
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function textListFromUnknown(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[;,，；]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const text = stringFromUnknown(item);
      if (text) return [text];
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        return [
          recordTextValue(record, "product_zh", "product", "name", "label", "action_zh", "action", "value"),
        ].filter((entry): entry is string => Boolean(entry));
      }
      return [];
    })
    .filter(Boolean);
}

function uniqueText(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function weakCustomerName(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return !normalized ||
    normalized === "unknown" ||
    normalized.startsWith("unknown company") ||
    normalized.includes("待确认") ||
    normalized.includes("未命名");
}

function usableCountry(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const upper = normalized.toUpperCase();
  if (upper === "ZZ" || upper === "UNKNOWN" || normalized.includes("待确认") || normalized.includes("未知")) return undefined;
  return normalized;
}

function customerProducts(record: MemoryRecordItem) {
  const profile = record.customerProfile ?? {};
  const profileProducts = [
    ...textListFromUnknown(profile.product_interest),
    ...textListFromUnknown(profile.products),
    ...textListFromUnknown(profile.matched_products),
    ...textListFromUnknown(profile.product_categories),
    ...textListFromUnknown(profile.categories),
    recordTextValue(profile, "product_zh", "product", "product_name", "product_category", "category", "product_type"),
  ];
  const intentProducts = (record.purchaseIntent ?? []).flatMap((item) => [
    recordTextValue(item, "product_category", "category", "product_type", "product_zh", "product", "product_name"),
  ]);
  return uniqueText([...profileProducts, ...intentProducts]).slice(0, 5);
}

function customerProductCategories(record: MemoryRecordItem) {
  return uniqueText(
    customerProducts(record)
      .map(canonicalProduct)
      .filter((value) => value && productLabel(value) !== "产品待确认"),
  );
}

function customerCountry(record: MemoryRecordItem) {
  const profile = record.customerProfile ?? {};
  return usableCountry(record.country ?? recordTextValue(profile, "country", "country_code", "market"));
}

function customerBuyerType(record: MemoryRecordItem) {
  const profile = record.customerProfile ?? {};
  const rawType = recordTextValue(
    profile,
    "business_type",
    "buyer_type",
    "customer_type",
    "company_type",
    "store_type",
    "channel_type",
    "industry",
    "vertical",
    "segment",
    "market_segment",
    "category",
  );
  if (!rawType) return undefined;
  const canonical = canonicalBuyerType(rawType);
  return memoryBuyerTypeValues.has(canonical) ? canonical : undefined;
}

function customerIdentity(record: MemoryRecordItem) {
  const profile = record.customerProfile ?? {};
  return recordTextValue(
    profile,
    "self_described_identity",
    "shop_or_store_name",
    "store_name",
    "decision_role",
    "role",
    "buyer_type",
  );
}

function uniqueSorted(values: Array<string | undefined>) {
  return uniqueText(values).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function buyerTypeFilterOptions(records: MemoryRecordItem[]): FilterOption[] {
  return uniqueText(records.map(customerBuyerType))
    .map((value) => ({ value, label: buyerTypeLabel(value) }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

function productFilterOptions(records: MemoryRecordItem[]): FilterOption[] {
  const products = new Map<string, string>();
  for (const record of records) {
    for (const product of customerProducts(record)) {
      const value = canonicalProduct(product);
      const label = value ? productLabel(value) : "产品待确认";
      if (value && label !== "产品待确认") products.set(value, label);
    }
  }
  return Array.from(products.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

function containsSelected(values: string[], selected: string[]) {
  if (selected.length === 0) return true;
  const normalizedValues = new Set(values.map((value) => value.toLowerCase()));
  return selected.some((value) => normalizedValues.has(value.toLowerCase()));
}

function memoryRecordSearchText(item: MemoryRecordItem) {
  const profile = item.customerProfile ?? {};
  const behaviorSignals = item.behaviorSignals ?? {};
  return [
    item.name,
    item.summary,
    item.companyName,
    item.country,
    recordTextValue(profile, "company_name", "customer_name", "name"),
    recordTextValue(profile, "contact_person", "contact_name", "contact", "buyer_name"),
    recordTextValue(profile, "country", "country_code", "market"),
    recordTextValue(
      profile,
      "city",
      "website",
      "email",
      "self_described_identity",
      "buyer_type",
      "business_type",
      "customer_type",
      "company_type",
      "shop_or_store_name",
      "store_name",
      "decision_role",
    ),
    customerBuyerType(item) ? buyerTypeLabel(customerBuyerType(item) ?? "") : undefined,
    ...customerProducts(item),
    ...customerProductCategories(item).map(productLabel),
    ...(item.purchaseIntent ?? []).map(intentLine),
    ...(item.negotiatedPrices ?? []).map(priceLine),
    recordTextValue(behaviorSignals, "summary_zh", "summary", "decision_role"),
    ...textListFromUnknown(behaviorSignals.risk_flags),
    ...textListFromUnknown(behaviorSignals.inference_notes),
    ...(item.nextActions ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function chatCustomerFromRecord(record: MemoryRecordItem): ChatCustomerRow | null {
  if (record.analysisStatus !== "analyzed") return null;
  const profile = record.customerProfile ?? {};
  const behaviorSignals = record.behaviorSignals ?? {};
  const companyName =
    recordTextValue(profile, "company_name", "customer_name", "company", "name") ??
    record.companyName ??
    record.name.replace(/\s+-\s+聊天记录$/u, "");
  const contact = recordTextValue(profile, "contact_person", "contact_name", "contact", "buyer_name");
  const country = customerCountry(record);
  const website = recordTextValue(profile, "website", "url", "domain");
  const email = recordTextValue(profile, "email", "contact_email");
  const buyerRole = customerIdentity(record);
  const buyerType = customerBuyerType(record);
  const companyNameMissing = weakCustomerName(companyName);
  const displayName = companyNameMissing ? buyerRole ?? contact ?? "待确认客户" : companyName;
  const products = customerProducts(record);
  const productCategories = customerProductCategories(record);
  const intentSummary = (record.purchaseIntent ?? []).map(intentLine).find(Boolean);
  const priceSummary = (record.negotiatedPrices ?? []).map(priceLine).find(Boolean);
  const behaviorSummary = recordTextValue(behaviorSignals, "summary_zh", "summary");
  const nextAction = (record.nextActions ?? []).find((item) => item.trim());
  const demandClear = products.length > 0 || Boolean(intentSummary);
  const missingLabels = [
    companyNameMissing && !buyerRole ? "公司名" : undefined,
    country ? undefined : "国家/地区",
    contact || email ? undefined : "联系人",
    demandClear ? undefined : "采购需求",
  ].filter((item): item is string => Boolean(item));
  const infoSufficient = missingLabels.length === 0;
  const searchText = [
    memoryRecordSearchText(record),
    companyName,
    displayName,
    contact,
    country,
    website,
    email,
    buyerRole,
    buyerType ? buyerTypeLabel(buyerType) : undefined,
    ...productCategories.map(productLabel),
    intentSummary,
    priceSummary,
    behaviorSummary,
    nextAction,
    missingLabels.join(" "),
  ].filter(Boolean).join(" ").toLowerCase();

  return {
    record,
    companyName,
    displayName,
    companyNameMissing,
    contact,
    country,
    website,
    email,
    buyerRole,
    buyerType,
    products,
    productCategories,
    intentSummary,
    priceSummary,
    behaviorSummary,
    nextAction,
    missingLabels,
    infoSufficient,
    hasPrice: Boolean(priceSummary || (record.negotiatedPrices ?? []).length > 0),
    demandClear,
    searchText,
  };
}

const importModeLabels: Record<ImportMode, string> = {
  json: "JSON 文件",
  text: "粘贴文字",
  image: "聊天截图",
};

const importModeDescriptions: Record<ImportMode, string> = {
  json: "上传 Accio 或平台聊天导出的 JSON 文件。",
  text: "粘贴微信、Accio 或阿里聊天片段。",
  image: "上传一张或多张聊天截图，系统会按批次用当前记忆员工模型读取图片。",
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

const memoryStatusFilterChoices = ["all", "not_started", "analyzed", "failed"] as const;
const memoryStatusFilterValues: Array<MemoryRecordItem["analysisStatus"] | "all"> = ["all", "not_started", "analyzed", "failed"];
const chatCustomerFilterChoices: Array<{ value: ChatCustomerFilter; label: string }> = [
  { value: "all", label: "全部客户" },
  { value: "sufficient", label: "信息充足" },
  { value: "insufficient", label: "信息不足" },
  { value: "priced", label: "有报价" },
  { value: "clear_intent", label: "需求明确" },
];
const chatCustomerFilterValues = chatCustomerFilterChoices.map((item) => item.value);
const chatCustomerFilterLabels: Record<ChatCustomerFilter, string> = {
  all: "全部客户",
  sufficient: "信息充足",
  insufficient: "信息不足",
  priced: "有报价",
  clear_intent: "需求明确",
};
const memorySourceValues: MemoryRecordItem["source"][] = ["accio", "alibaba_international", "manual_import", "demo_data", "other"];
const importRangeValues: ImportRange[] = ["all", "today", "7d", "30d"];
const MEMORY_STATUS_FILTER_STORAGE_KEY = "sentura:cbe:employee:memory:status-filter:v1";
const MEMORY_FILTERS_STORAGE_KEY = "sentura:cbe:employee:memory:filters:v1";
const CHAT_CUSTOMER_FILTER_STORAGE_KEY = "sentura:cbe:employee:memory:chat-customer-filter:v1";

function isMemoryStatusFilter(value: unknown): value is MemoryRecordItem["analysisStatus"] | "all" {
  return typeof value === "string" && memoryStatusFilterValues.includes(value as MemoryRecordItem["analysisStatus"] | "all");
}

function isMemorySource(value: unknown): value is MemoryRecordItem["source"] {
  return typeof value === "string" && memorySourceValues.includes(value as MemoryRecordItem["source"]);
}

function isImportRange(value: unknown): value is ImportRange {
  return typeof value === "string" && importRangeValues.includes(value as ImportRange);
}

function isChatCustomerFilter(value: unknown): value is ChatCustomerFilter {
  return typeof value === "string" && chatCustomerFilterValues.includes(value as ChatCustomerFilter);
}

function isStringFilterList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isMemoryFilters(value: unknown): value is MemoryFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const filters = value as Partial<Record<keyof MemoryFilters, unknown>>;
  return Array.isArray(filters.sources) &&
    filters.sources.every(isMemorySource) &&
    isImportRange(filters.importRange) &&
    isStringFilterList(filters.countries) &&
    isStringFilterList(filters.buyerTypes) &&
    isStringFilterList(filters.products);
}

const importRangeLabels: Record<ImportRange, string> = {
  all: "全部时间",
  today: "今日",
  "7d": "近 7 天",
  "30d": "近 30 天",
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
  return "bg-white/45";
}

function canDeleteMemoryRecord(item: MemoryRecordItem) {
  return item.analysisStatus !== "running";
}

function markMemoryRecordRunning(rows: MemoryRecordItem[], recordId: string) {
  return rows.map((item) =>
    item.recordId === recordId ? { ...item, analysisStatus: "running" as const } : item,
  );
}

function restoreMemoryRecord(rows: MemoryRecordItem[], original: MemoryRecordItem) {
  return rows.map((item) =>
    item.recordId === original.recordId ? original : item,
  );
}

function markMemoryRecordFailed(rows: MemoryRecordItem[], recordId: string) {
  return rows.map((item) =>
    item.recordId === recordId ? { ...item, analysisStatus: "failed" as const } : item,
  );
}

function badgeClass(status: MemoryRecordItem["analysisStatus"]) {
  if (status === "running") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "analyzed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-[var(--sentura-border-strong)] bg-white/72 text-[var(--sentura-muted)]";
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

function chatCustomerMatchesFilter(row: ChatCustomerRow, filter: ChatCustomerFilter) {
  if (filter === "sufficient") return row.infoSufficient;
  if (filter === "insufficient") return !row.infoSufficient;
  if (filter === "priced") return row.hasPrice;
  if (filter === "clear_intent") return row.demandClear;
  return true;
}

function memoryRecordMatchesDimensionFilters(item: MemoryRecordItem, filters: MemoryFilters) {
  return containsSelected([customerCountry(item)].filter((value): value is string => Boolean(value)), filters.countries) &&
    containsSelected([customerBuyerType(item)].filter((value): value is string => Boolean(value)), filters.buyerTypes) &&
    containsSelected(customerProductCategories(item), filters.products);
}

function normalizeMemoryHighlightScope(value: string | null): MemoryHighlightScope | null {
  return value === "memory-results" ? value : null;
}

function normalizeMemoryHighlightStatus(value: string | null): MemoryRecordItem["analysisStatus"] | null {
  if (value === "not_started" || value === "running" || value === "analyzed" || value === "failed") return value;
  return null;
}

function memoryRowSelector(recordId: string) {
  const escaped = typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(recordId)
    : recordId.replace(/["\\]/g, "\\$&");
  return `[data-record-id="${escaped}"]`;
}

function scrollMemoryRecordIntoView(recordId: string) {
  window.requestAnimationFrame(() => {
    const rowCandidates = Array.from(document.querySelectorAll<HTMLElement>(memoryRowSelector(recordId)));
    const visibleRow = rowCandidates.find((element) => element.getClientRects().length > 0) ?? rowCandidates[0];
    visibleRow?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
}

function highlightedPageForRecordIds(rows: MemoryRecordItem[], recordIds: string[], pageSize: number) {
  const highlighted = new Set(recordIds);
  const index = rows.findIndex((item) => highlighted.has(item.recordId));
  if (index < 0) return 1;
  return Math.floor(index / pageSize) + 1;
}

function firstHighlightedRecordIdOnPage(
  rows: MemoryRecordItem[],
  recordIds: string[],
  page: number,
  pageSize: number,
) {
  const highlighted = new Set(recordIds);
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize).find((item) => highlighted.has(item.recordId))?.recordId ?? recordIds[0];
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
  const cancelTask = useCbeEmployeeStore((store) => store.cancelTask);
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
  const [chatCustomerFilter, setChatCustomerFilter] = usePersistentUiState<ChatCustomerFilter>(
    CHAT_CUSTOMER_FILTER_STORAGE_KEY,
    "all",
    isChatCustomerFilter,
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
  const [pendingMemoryHighlight, setPendingMemoryHighlight] = useState<{ ids: string[] } | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [deleteIntentIds, setDeleteIntentIds] = useState<string[]>([]);
  const [deletingMemory, setDeletingMemory] = useState(false);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const handledHighlightRequestRef = useRef<string | null>(null);
  const submitExistingMemoryTaskRef = useRef<(
    (record: MemoryRecordItem, options?: { silentSuccess?: boolean }) => Promise<MemoryAnalyzeResult>
  ) | null>(null);
  const memoryHighlightScope = normalizeMemoryHighlightScope(searchParams.get("highlight"));
  const highlightRecordId = searchParams.get("highlightRecord");
  const highlightTaskId = searchParams.get("highlightTask");
  const highlightStatus = normalizeMemoryHighlightStatus(searchParams.get("highlightStatus"));
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

  const highlightMemoryRecords = useCallback((recordIds: string[]) => {
    const ids = Array.from(new Set(recordIds.filter(Boolean)));
    if (ids.length === 0) return;
    setHighlightedRecordIds(new Set(ids));
  }, []);

  const clearMemoryHighlight = (recordId: string) => {
    setHighlightedRecordIds((current) => {
      if (!current.has(recordId)) return current;
      const next = new Set(current);
      next.delete(recordId);
      return next;
    });
  };

  const filterOptions = useMemo(
    () => ({
      sources: Array.from(new Set(rows.map((item) => item.source))),
      countries: uniqueSorted(rows.map(customerCountry)),
      buyerTypes: buyerTypeFilterOptions(rows),
      products: productFilterOptions(rows),
    }),
    [rows],
  );

  useEffect(() => {
    const allowedBuyerTypes = new Set(filterOptions.buyerTypes.map((item) => item.value));
    setFilters((current) => {
      if (current.buyerTypes.length === 0) return current;
      const buyerTypes = current.buyerTypes.filter((value) => allowedBuyerTypes.has(value));
      return buyerTypes.length === current.buyerTypes.length ? current : { ...current, buyerTypes };
    });
  }, [filterOptions.buyerTypes, setFilters]);

  useEffect(() => {
    const allowedProducts = new Set(filterOptions.products.map((item) => item.value));
    setFilters((current) => {
      if (current.products.length === 0) return current;
      const products = current.products.filter((value) => allowedProducts.has(value));
      return products.length === current.products.length ? current : { ...current, products };
    });
  }, [filterOptions.products, setFilters]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesSource = filters.sources.length === 0 || filters.sources.includes(item.source);
      const matchesImportRange = importedAtInRange(item.importedAt, filters.importRange);
      const matchesQuery = !normalized || memoryRecordSearchText(item).includes(normalized);
      const matchesStatus = statusFilter === "all" || item.analysisStatus === statusFilter;
      const matchesDimensions = memoryRecordMatchesDimensionFilters(item, filters);
      return matchesSource && matchesImportRange && matchesQuery && matchesStatus && matchesDimensions;
    });
  }, [filters, query, rows, statusFilter]);

  const chatCustomers = useMemo(
    () => rows.map(chatCustomerFromRecord).filter((item): item is ChatCustomerRow => Boolean(item)),
    [rows],
  );

  const filteredChatCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return chatCustomers.filter((row) => {
      const item = row.record;
      const matchesSource = filters.sources.length === 0 || filters.sources.includes(item.source);
      const matchesImportRange = importedAtInRange(item.importedAt, filters.importRange);
      const matchesStatus = statusFilter === "all" || statusFilter === "analyzed";
      const matchesQuery = !normalized || row.searchText.includes(normalized);
      const matchesDimensions =
        containsSelected([row.country].filter((value): value is string => Boolean(value)), filters.countries) &&
        containsSelected([row.buyerType].filter((value): value is string => Boolean(value)), filters.buyerTypes) &&
        containsSelected(row.productCategories, filters.products);
      return matchesSource &&
        matchesImportRange &&
        matchesStatus &&
        matchesQuery &&
        matchesDimensions &&
        chatCustomerMatchesFilter(row, chatCustomerFilter);
    });
  }, [chatCustomerFilter, chatCustomers, filters, query, statusFilter]);

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
    for (const country of filters.countries) {
      chips.push({
        key: `country-${country}`,
        label: `国家：${country}`,
        clear: () => setFilters((current) => ({ ...current, countries: current.countries.filter((item) => item !== country) })),
      });
    }
    for (const buyerType of filters.buyerTypes) {
      const label = filterOptions.buyerTypes.find((item) => item.value === buyerType)?.label ?? buyerTypeLabel(buyerType);
      chips.push({
        key: `buyer-type-${buyerType}`,
        label: `类型：${label}`,
        clear: () => setFilters((current) => ({ ...current, buyerTypes: current.buyerTypes.filter((item) => item !== buyerType) })),
      });
    }
    for (const product of filters.products) {
      const label = filterOptions.products.find((item) => item.value === product)?.label ?? productLabel(product);
      chips.push({
        key: `product-${product}`,
        label: `产品：${label}`,
        clear: () => setFilters((current) => ({ ...current, products: current.products.filter((item) => item !== product) })),
      });
    }
    if (statusFilter !== "all") {
      chips.push({
        key: `status-${statusFilter}`,
        label: `状态：${statusLabels[statusFilter]}`,
        clear: () => setStatusFilter("all"),
      });
    }
    if (chatCustomerFilter !== "all") {
      chips.push({
        key: `chat-customer-${chatCustomerFilter}`,
        label: `客户信息：${chatCustomerFilterLabels[chatCustomerFilter]}`,
        clear: () => setChatCustomerFilter("all"),
      });
    }
    return chips;
  }, [chatCustomerFilter, filterOptions.buyerTypes, filterOptions.products, filters, setChatCustomerFilter, setFilters, setStatusFilter, statusFilter]);

  const canRun = state === "connected" && !!accioAgent;
  const activeFilterCount = activeFilterChips.length;
  const chatCustomerPage = usePagedItems(filteredChatCustomers, 5);
  const memoryPage = usePagedItems(filtered, 10);
  const {
    page: currentMemoryPage,
    pageSize: memoryPageSize,
    setPage: setMemoryPage,
  } = memoryPage;
  const pagedMemoryRecords = memoryPage.items;
  const selectableVisibleRecords = pagedMemoryRecords.filter(canDeleteMemoryRecord);
  const selectedRecords = rows.filter((item) => selectedRecordIds.includes(item.recordId));
  const selectedNotStartedRecords = selectedRecords.filter((item) => item.analysisStatus === "not_started");
  const filteredNotStartedRecords = filtered.filter((item) => item.analysisStatus === "not_started");
  const batchAnalyzeTargets = selectedNotStartedRecords.length > 0 ? selectedNotStartedRecords : filteredNotStartedRecords;
  const batchAnalyzeUsesSelection = selectedNotStartedRecords.length > 0;
  const batchAnalyzeCount = batchAnalyzeTargets.length;
  const batchAnalyzeLabel = batchAnalyzeUsesSelection ? "批量分析所选未分析" : "批量分析当前未分析";
  const deleteTargets = rows.filter((item) => deleteIntentIds.includes(item.recordId));
  const allVisibleSelected =
    selectableVisibleRecords.length > 0 &&
    selectableVisibleRecords.every((item) => selectedRecordIds.includes(item.recordId));

  const showNotice = useCallback((text: string, tone: "success" | "error" | "info" = "success", timeoutMs = 4000) => {
    setNotice({ tone, text });
    if (timeoutMs > 0) {
      window.setTimeout(() => {
        setNotice((current) => (current?.text === text ? null : current));
      }, timeoutMs);
    }
  }, []);

  useEffect(() => {
    const highlightRequestKey = [memoryHighlightScope ?? "", highlightTaskId ?? "", highlightRecordId ?? "", highlightStatus ?? ""].join("|");
    const hasHighlightRequest = Boolean(memoryHighlightScope || highlightTaskId || highlightRecordId);
    if (!hasHighlightRequest || handledHighlightRequestRef.current === highlightRequestKey || rows.length === 0) return;
    let ids: string[] = [];
    if (highlightTaskId) {
      ids = rows
        .filter((item) => item.latestAgentRunId === highlightTaskId)
        .map((item) => item.recordId);
    } else if (highlightRecordId) {
      ids = rows.some((item) => item.recordId === highlightRecordId) ? [highlightRecordId] : [];
    } else if (memoryHighlightScope) {
      ids = rows.map((item) => item.recordId);
    }
    ids = Array.from(new Set(ids));
    if (ids.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      handledHighlightRequestRef.current = highlightRequestKey;
      setQuery("");
      setFilters(emptyFilters);
      setStatusFilter(highlightStatus ?? "all");
      setChatCustomerFilter("all");
      setPendingMemoryHighlight({ ids });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightRecordId, highlightStatus, highlightTaskId, memoryHighlightScope, rows, setChatCustomerFilter, setFilters, setStatusFilter]);

  useEffect(() => {
    if (!pendingMemoryHighlight) return;
    const visibleHighlightedIds = pendingMemoryHighlight.ids.filter((recordId) =>
      filtered.some((item) => item.recordId === recordId),
    );
    if (visibleHighlightedIds.length === 0) return;
    const targetPage = highlightedPageForRecordIds(filtered, visibleHighlightedIds, memoryPageSize);
    if (currentMemoryPage !== targetPage) {
      const frame = window.requestAnimationFrame(() => setMemoryPage(targetPage));
      return () => window.cancelAnimationFrame(frame);
    }
    const targetRecordId = firstHighlightedRecordIdOnPage(
      filtered,
      visibleHighlightedIds,
      currentMemoryPage,
      memoryPageSize,
    );
    const frame = window.requestAnimationFrame(() => {
      highlightMemoryRecords(visibleHighlightedIds);
      scrollMemoryRecordIntoView(targetRecordId);
      showNotice(`已定位 ${visibleHighlightedIds.length} 条记忆记录。`, "info");
      setPendingMemoryHighlight(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    currentMemoryPage,
    filtered,
    highlightMemoryRecords,
    memoryPageSize,
    pendingMemoryHighlight,
    setMemoryPage,
    showNotice,
  ]);

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
    const visibleIds = selectableVisibleRecords.map((item) => item.recordId);
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
    const finalRecordName =
      recordName.trim() ||
      uploadName.replace(/\.(json|txt)$/i, "") ||
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
      });
      setUploadName("");
      setUploadPayload(null);
      setRawImportText("");
      setImageAttachments([]);
      setAttachmentMetadata([]);
      setStatusFilter("not_started");
      setFilters(emptyFilters);
      setChatCustomerFilter("all");
      await refreshDbBackedMemory();
      highlightMemoryRecords([created.accioImport.id]);
      window.setTimeout(() => scrollMemoryRecordIntoView(created.accioImport.id), 0);
      showNotice("记录已导入，状态为未分析。", "success", 4000);
      router.replace(`${CBE_EMPLOYEE_MEMORY_PATH}?highlightRecord=${encodeURIComponent(created.accioImport.id)}`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "记忆记录导入失败。", "error", 8000);
    }
  };

  const submitMemoryTask = async (input: AccioMemoryTaskInput, failedRecordId?: string): Promise<MemoryAnalyzeResult> => {
    if (!canRun) {
      showNotice(
        state === "connected"
          ? "记忆整理暂不可用，请先完成系统初始化。"
          : "系统暂未连接，暂时不能执行记忆整理。",
        "error",
      );
      return "skipped";
    }
    const plannedSessionKey = createPlannedEmployeeSessionKey(ACCIO_AGENT_ID);
    const estimatedMs = input.inputFormat === "image"
      ? Math.min(1_200_000, 300_000 + Math.max(1, input.attachments?.length ?? 0) * 45_000)
      : 180_000;
    let taskId: string | undefined;
    let abortSignal: AbortSignal | undefined;
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
          return "failed";
        }
        showNotice("当前任务较多，记忆整理已进入排队；系统不会重复启动超出容量的任务。", "info", 8000);
        await refreshDbBackedMemory().catch(() => undefined);
        return "queued";
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
        metadata: {
          retry_record_name: input.recordName,
          retry_source_label: input.sourceLabel,
          retry_input_format: input.inputFormat ?? "json",
          retry_source_kind: input.sourceKind ?? "manual_json",
        },
      });
      taskId = localTaskId;
      abortSignal = createCbeEmployeeTaskAbortSignal(localTaskId);
      if (failedRecordId) {
        setRows((current) => markMemoryRecordRunning(current, failedRecordId));
      }
      const result = await runAccioMemoryTask(
        client,
        input,
        createProgressHandler(localTaskId),
        { sessionKey: activeSessionKey, signal: abortSignal },
      );
      await completeEmployeeAccioImport({
        importId: createdImport.accioImport.id,
        agentRunId: createdImport.agentRun.id,
        sessionKey: result.sessionKey,
        sourceFileName: input.recordName,
        payload: result.payload,
      });
      const message = `已整理 ${result.records.length} 份聊天记录，当前列表已更新。`;
      completeTask(localTaskId, result.records.length, message, result.sessionKey);
      await refreshDbBackedMemory();
      showNotice(message);
      clearCbeEmployeeTaskAbortSignal(localTaskId);
      taskId = undefined;
      return "completed";
    } catch (error) {
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      if (isEmployeeTaskCancellation(error)) {
        if (createdImport) {
          await cancelEmployeeTaskInDb({
            id: createdImport.agentRun.id,
            sessionKey: sessionKey ?? plannedSessionKey,
          }).catch(() => undefined);
        }
        if (taskId) cancelTask(taskId, message, sessionKey ?? plannedSessionKey);
        await refreshDbBackedMemory().catch(() => undefined);
        showNotice(message, "info", 6000);
        return "cancelled";
      }
      if (failedRecordId) {
        setRows((current) => markMemoryRecordFailed(current, failedRecordId));
      }
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
      return "failed";
    } finally {
      if (taskId) clearCbeEmployeeTaskAbortSignal(taskId);
    }
  };

  const submitUploadedMemoryTask = async (recordName: string, sourceLabel: string) => {
    if (!uploadPayload) {
      showNotice("请先上传系统可读取的聊天记录文件。", "error");
      return;
    }
    await submitMemoryTask({
      recordName: recordName.trim() || uploadName.replace(/\.(json|txt)$/i, "") || "未命名记录",
      sourceLabel,
      inputFormat: importModeInputFormats[importMode],
      sourceKind: importModeSourceKinds[importMode],
      chatExport: uploadPayload,
      rawText: importMode === "text" ? rawImportText : undefined,
      attachments: importMode === "image" ? toGatewayChatAttachments(imageAttachments) : undefined,
      attachmentMetadata,
    });
  };

  const submitExistingMemoryTask = async (
    record: MemoryRecordItem,
    options: { silentSuccess?: boolean } = {},
  ): Promise<MemoryAnalyzeResult> => {
    if (!canRun) {
      showNotice(
        state === "connected"
          ? "记忆整理暂不可用，请先完成系统初始化。"
          : "系统暂未连接，暂时不能执行记忆整理。",
        "error",
      );
      return "skipped";
    }
    const originalRecord = record;
    const importId = record.importId ?? record.recordId;
    setRows((current) => markMemoryRecordRunning(current, record.recordId));
    let storedPayload: unknown;
    try {
      storedPayload = await fetchEmployeeAccioImportPayload(importId);
    } catch (error) {
      setRows((current) => markMemoryRecordFailed(current, record.recordId));
      showNotice(error instanceof Error ? error.message : "无法读取已导入聊天记录。", "error", 8000);
      return "failed";
    }
    const metadata = storedPayload && typeof storedPayload === "object" && !Array.isArray(storedPayload)
      ? ((storedPayload as { export_metadata?: unknown }).export_metadata ?? {})
      : {};
    const metadataRecord = metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : {};
    const rawInputFormat = metadataRecord.input_format;
    const inputFormat: AccioMemoryTaskInput["inputFormat"] =
      rawInputFormat === "pasted_text" || rawInputFormat === "image" ? rawInputFormat : "json";
    const rawSourceKind = metadataRecord.source_kind;
    const sourceKind: AccioMemoryTaskInput["sourceKind"] =
      rawSourceKind === "manual_text" || rawSourceKind === "manual_image" || rawSourceKind === "manual_json"
        ? rawSourceKind
        : inputFormat === "pasted_text"
          ? "manual_text"
          : inputFormat === "image"
            ? "manual_image"
            : "manual_json";
    const storedAttachmentMetadata = Array.isArray(metadataRecord.attachment_metadata)
      ? metadataRecord.attachment_metadata.filter(
          (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item),
        )
      : [];
    if (inputFormat === "image") {
      setRows((current) => markMemoryRecordFailed(current, record.recordId));
      showNotice("这条记录来自截图导入，系统未保存原图，无法直接重新分析；请重新上传截图。", "error", 8000);
      return "failed";
    }
    const plannedSessionKey = createPlannedEmployeeSessionKey(ACCIO_AGENT_ID);
    const estimatedMs = 180_000;
    const estimatedCost = estimateMemoryTaskCost(Math.max(1, record.conversationCount)).estimatedUsd;
    let taskId: string | undefined;
    let abortSignal: AbortSignal | undefined;
    try {
      const started = await startEmployeeAccioImportAnalysis({
        importId,
        sessionKey: plannedSessionKey,
        estimatedCostUsd: estimatedCost,
      });
      if (started.agentRun.status === "queued" || !started.agentRun.sessionKey) {
        setRows((current) => restoreMemoryRecord(current, originalRecord));
        showNotice("当前任务较多，这条记忆记录仍保持未分析，稍后可重新点击批量分析。", "info", 8000);
        await refreshDbBackedMemory().catch(() => undefined);
        return "queued";
      }
      const activeSessionKey = started.agentRun.sessionKey;
      const localTaskId = startTask({
        id: started.agentRun.id,
        kind: "accio_memory",
        title: "记忆整理",
        message: "记忆整理任务已启动，正在分析聊天记录。",
        estimatedMs,
        timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
        sessionKey: activeSessionKey,
        targetLabel: record.name,
        metadata: {
          accio_import_id: importId,
          retry_record_name: record.name,
          retry_source_label: sourceLabels[record.source],
          retry_input_format: inputFormat,
          retry_source_kind: sourceKind,
        },
      });
      taskId = localTaskId;
      abortSignal = createCbeEmployeeTaskAbortSignal(localTaskId);
      const result = await runAccioMemoryTask(
        client,
        {
          recordName: record.name,
          sourceLabel: sourceLabels[record.source],
          inputFormat,
          sourceKind,
          chatExport: storedPayload,
          attachmentMetadata: storedAttachmentMetadata,
        },
        createProgressHandler(localTaskId),
        { sessionKey: activeSessionKey, signal: abortSignal },
      );
      await completeEmployeeAccioImport({
        importId,
        agentRunId: started.agentRun.id,
        sessionKey: result.sessionKey,
        sourceFileName: record.name,
        payload: result.payload,
      });
      const message = `已整理 ${result.records.length} 份聊天记录，当前列表已更新。`;
      completeTask(localTaskId, result.records.length, message, result.sessionKey);
      await refreshDbBackedMemory();
      if (!options.silentSuccess) showNotice(message);
      clearCbeEmployeeTaskAbortSignal(localTaskId);
      taskId = undefined;
      return "completed";
    } catch (error) {
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      if (isEmployeeTaskCancellation(error)) {
        setRows((current) => restoreMemoryRecord(current, originalRecord));
        if (taskId) cancelTask(taskId, message, sessionKey ?? plannedSessionKey);
        await cancelEmployeeTaskInDb({
          id: taskId ?? record.latestAgentRunId ?? importId,
          sessionKey: sessionKey ?? plannedSessionKey,
        }).catch(() => undefined);
        await refreshDbBackedMemory().catch(() => undefined);
        showNotice("分析已取消，未完成的原始记录已恢复为未分析。", "info", 6000);
        return "cancelled";
      }
      setRows((current) => markMemoryRecordFailed(current, record.recordId));
      if (taskId && shouldWriteFailure(error)) {
        await failEmployeeTaskInDb({
          agentRunId: taskId,
          sessionKey: sessionKey ?? plannedSessionKey,
          error,
          message,
        }).catch(() => undefined);
      }
      if (taskId) failTask(taskId, message, sessionKey ?? plannedSessionKey);
      await refreshDbBackedMemory().catch(() => undefined);
      showNotice(message, "error", 8000);
      return "failed";
    } finally {
      if (taskId) clearCbeEmployeeTaskAbortSignal(taskId);
    }
  };

  const analyzeBatchMemoryRecords = async () => {
    if (batchAnalyzing || taskRunning) return;
    if (!canRun) {
      showNotice(
        state === "connected"
          ? "记忆整理暂不可用，请先完成系统初始化。"
          : "系统暂未连接，暂时不能执行记忆整理。",
        "error",
      );
      return;
    }
    const targets = batchAnalyzeTargets.filter((item) => item.analysisStatus === "not_started");
    if (targets.length === 0) {
      showNotice("当前没有可批量分析的未分析原始记录。", "info");
      return;
    }
    setBatchAnalyzing(true);
    setStatusFilter("not_started");
    setChatCustomerFilter("all");
    let completed = 0;
    let failed = 0;
    let queued = 0;
    try {
      showNotice(
        batchAnalyzeUsesSelection
          ? `开始批量分析所选 ${targets.length} 条未分析记录。`
          : `开始批量分析当前筛选下 ${targets.length} 条未分析记录。`,
        "info",
        5000,
      );
      for (const target of targets) {
        const result = await submitExistingMemoryTask(target, { silentSuccess: true });
        if (result === "completed") completed += 1;
        if (result === "failed") failed += 1;
        if (result === "queued") queued += 1;
        if (result === "cancelled") return;
      }
      await refreshDbBackedMemory().catch(() => undefined);
      if (completed > 0 || failed > 0 || queued > 0) {
        showNotice(
          `批量分析结束：完成 ${completed} 条${queued > 0 ? `，排队 ${queued} 条` : ""}${failed > 0 ? `，失败 ${failed} 条` : ""}。`,
          failed > 0 ? "error" : "success",
          failed > 0 ? 10000 : 6000,
        );
      }
    } finally {
      setBatchAnalyzing(false);
    }
  };

  useEffect(() => {
    submitExistingMemoryTaskRef.current = submitExistingMemoryTask;
  });

  useEffect(() => {
    const handleRetryTask = (event: Event) => {
      const task = (event as CustomEvent<{ task?: CbeEmployeeTaskRecord }>).detail?.task;
      if (!task || task.status !== "failed" || task.kind !== "accio_memory") return;
      event.preventDefault();

      const retryRecord = rows.find(
        (item) =>
          item.latestAgentRunId === task.id ||
          item.recordId === task.id ||
          (task.targetLabel ? item.name === task.targetLabel : false),
      );
      if (!retryRecord) {
        setStatusFilter("failed");
        showNotice("未能直接定位这次失败的聊天记录，请在失败记录行点击“重试分析”。", "error", 8000);
        return;
      }
      void submitExistingMemoryTaskRef.current?.(retryRecord);
    };

    window.addEventListener(CBE_EMPLOYEE_TASK_RETRY_EVENT, handleRetryTask);
    return () => window.removeEventListener(CBE_EMPLOYEE_TASK_RETRY_EVENT, handleRetryTask);
  }, [rows, setStatusFilter, showNotice]);

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">记忆整理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {filtered.length} 条记录，当前聊天客户 {filteredChatCustomers.length} 个
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
                placeholder="按公司、联系人、产品、报价或下一步搜索"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSheetMode("filters")}>
                <Filter className="h-3.5 w-3.5" />
                筛选记忆记录
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
                setChatCustomerFilter("all");
              }}>
                <RotateCcw className="h-3.5 w-3.5" />
                重置筛选
              </Button>
            </div>
          ) : null}

          <section className="rounded-md border bg-background/75 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold tracking-normal">聊天客户列表</h2>
                  <Badge variant="secondary">{filteredChatCustomers.length} 个客户</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  基于已分析聊天记录整理客户信息；这里只展示预览整理结果，不写入背调结论。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {chatCustomerFilterChoices.map((choice) => (
                  <Button
                    key={choice.value}
                    variant={chatCustomerFilter === choice.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChatCustomerFilter(choice.value)}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>

            {filteredChatCustomers.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed bg-muted/20 px-4 py-7 text-center">
                <div className="text-sm font-medium">暂无符合条件的聊天客户</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  导入并分析聊天记录后，系统会按公司、联系人、商品、报价和下一步整理到这里。
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <AnimatedList viewportClassName="grid gap-3 overflow-visible" displayScrollbar={false}>
                  {chatCustomerPage.items.map((row) => (
                    <ChatCustomerCard
                      key={row.record.recordId}
                      row={row}
                      openDetail={openDetail}
                    />
                  ))}
                </AnimatedList>
                <ListPagination
                  page={chatCustomerPage.page}
                  totalItems={chatCustomerPage.totalItems}
                  pageSize={chatCustomerPage.pageSize}
                  onPageChange={chatCustomerPage.setPage}
                />
              </div>
            )}
          </section>

          <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-normal">原始记忆记录</h2>
              <p className="text-sm text-muted-foreground">
                保留导入批次、分析状态和删除/重试操作。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{filtered.length} 条记录</Badge>
              <Button
                size="sm"
                disabled={!canRun || taskRunning || batchAnalyzing || batchAnalyzeCount === 0}
                onClick={analyzeBatchMemoryRecords}
              >
                {batchAnalyzing || taskRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                {batchAnalyzeLabel}{batchAnalyzeCount > 0 ? `（${batchAnalyzeCount}）` : ""}
              </Button>
            </div>
          </div>

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
              <AnimatedList viewportClassName="grid gap-3 overflow-visible lg:hidden" displayScrollbar={false}>
                {pagedMemoryRecords.map((item) => {
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
                      taskRunning={taskRunning || batchAnalyzing}
                    />
                  );
                })}
              </AnimatedList>

              <div className="hidden overflow-x-auto rounded-md border lg:block">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          aria-label="选择当前筛选结果"
                          checked={allVisibleSelected}
                          disabled={selectableVisibleRecords.length === 0}
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
                    {pagedMemoryRecords.map((item, index) => {
                      const isHighlighted = highlightedRecordIds.has(item.recordId);
                      return (
                      <AnimatedTableRow
                        index={index}
                        preserveTableRowBase={false}
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
                              <Button variant="outline" size="sm" disabled={!canRun || taskRunning || batchAnalyzing} onClick={() => submitExistingMemoryTask(item)}>
                                开始分析
                              </Button>
                            ) : item.analysisStatus === "failed" ? (
                              <Button variant="outline" size="sm" disabled={!canRun || taskRunning || batchAnalyzing} onClick={() => submitExistingMemoryTask(item)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                                重试分析
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </AnimatedTableRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ListPagination
                page={memoryPage.page}
                totalItems={memoryPage.totalItems}
                pageSize={memoryPage.pageSize}
                onPageChange={memoryPage.setPage}
              />
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
        chatCustomerFilter={chatCustomerFilter}
        setChatCustomerFilter={setChatCustomerFilter}
        filterOptions={filterOptions}
        activeFilterCount={activeFilterCount}
        importMode={importMode}
        setImportMode={resetImportState}
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
  taskRunning,
}: {
  item: MemoryRecordItem;
  isHighlighted: boolean;
  canRun: boolean;
  selected: boolean;
  toggleSelected: (recordId: string) => void;
  openDetail: (item: MemoryRecordItem) => void;
  clearHighlight: (recordId: string) => void;
  submitTask: (item: MemoryRecordItem) => void;
  taskRunning: boolean;
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
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openDetail(item)}>
          <Eye className="h-3.5 w-3.5" />
          {item.analysisStatus === "analyzed" ? "查看报告" : "详情"}
        </Button>
        {item.analysisStatus === "not_started" ? (
          <Button size="sm" disabled={!canRun || taskRunning} onClick={() => submitTask(item)}>
            <Database className="h-3.5 w-3.5" />
            开始分析
          </Button>
        ) : item.analysisStatus === "failed" ? (
          <Button variant="outline" size="sm" disabled={!canRun || taskRunning} onClick={() => submitTask(item)}>
            <RotateCcw className="h-3.5 w-3.5" />
            重试分析
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ChatCustomerCard({
  row,
  openDetail,
}: {
  row: ChatCustomerRow;
  openDetail: (item: MemoryRecordItem) => void;
}) {
  const contactLine = uniqueText([row.contact, row.buyerRole]).join(" / ") || "待提取";
  const locationLine = compactJoin([row.country, row.website ?? row.email], " · ") || "暂无";
  const intentLineText = row.intentSummary ?? (row.products.length > 0 ? row.products.join("、") : "待提取");
  const priceAndAction = compactJoin([row.priceSummary, row.nextAction], "；") || "暂无明确报价或下一步";

  return (
    <article className="rounded-md border bg-white/70 p-3 text-sm shadow-sm shadow-sky-950/5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="min-w-0 truncate text-left text-base font-semibold tracking-normal"
              onClick={() => openDetail(row.record)}
            >
              {row.displayName}
            </button>
            <Badge
              variant="outline"
              className={row.infoSufficient ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}
            >
              {row.infoSufficient ? "信息充足" : "信息不足"}
            </Badge>
            {row.hasPrice ? <Badge variant="secondary">有报价</Badge> : null}
            {row.demandClear ? <Badge variant="secondary">需求明确</Badge> : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {sourceLabels[row.record.source]} · {formatBeijingDateTime(row.record.importedAt)} · {row.record.conversationCount} 条对话
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => openDetail(row.record)}>
          <Eye className="h-3.5 w-3.5" />
          查看分析
        </Button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <ChatCustomerFact
          icon={<UserRound className="h-3.5 w-3.5" />}
          label="联系人"
          value={contactLine}
          onOpen={() => openDetail(row.record)}
        />
        <ChatCustomerFact
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="定位信息"
          value={locationLine}
          onOpen={() => openDetail(row.record)}
        />
        <ChatCustomerFact
          icon={<PackageSearch className="h-3.5 w-3.5" />}
          label="采购需求"
          value={intentLineText}
          onOpen={() => openDetail(row.record)}
        />
        <ChatCustomerFact
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="报价 / 下一步"
          value={priceAndAction}
          onOpen={() => openDetail(row.record)}
        />
      </div>

      {row.behaviorSummary || row.missingLabels.length > 0 ? (
        <div className="mt-3 rounded-md bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {row.behaviorSummary ? <span>{row.behaviorSummary}</span> : null}
          {row.missingLabels.length > 0 ? (
            <span className="block text-amber-800">
              待补充：{row.missingLabels.join("、")}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ChatCustomerFact({
  icon,
  label,
  value,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="min-w-0 rounded-md border bg-background/80 px-3 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-md hover:shadow-sky-950/10 active:translate-y-0 active:scale-[0.99]"
      onClick={onOpen}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 whitespace-normal break-words font-medium leading-5">{value}</div>
    </button>
  );
}

function MemorySheet({
  mode,
  onOpenChange,
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  chatCustomerFilter,
  setChatCustomerFilter,
  filterOptions,
  activeFilterCount,
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
  chatCustomerFilter: ChatCustomerFilter;
  setChatCustomerFilter: Dispatch<SetStateAction<ChatCustomerFilter>>;
  filterOptions: {
    sources: MemoryRecordItem["source"][];
    countries: string[];
    buyerTypes: FilterOption[];
    products: FilterOption[];
  };
  activeFilterCount: number;
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
    if (mode !== "add") return;
    const frame = window.requestAnimationFrame(() => setRecordName(""));
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  return (
    <Sheet open={mode === "add" || mode === "filters"} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {mode === "filters" ? (
          <>
            <SheetHeader>
              <SheetTitle>筛选记忆记录</SheetTitle>
              <SheetDescription>
                按来源、导入时间、分析状态、客户信息、国家、类型和产品筛选；搜索词会继续生效。
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

              <FilterGroup title="客户信息">
                {chatCustomerFilterChoices.map((choice) => (
                  <Button
                    key={choice.value}
                    variant={chatCustomerFilter === choice.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChatCustomerFilter(choice.value)}
                  >
                    {choice.label}
                  </Button>
                ))}
              </FilterGroup>

              <FilterGroup title="国家">
                {filterOptions.countries.length > 0 ? filterOptions.countries.map((country) => (
                  <Button
                    key={country}
                    variant={filters.countries.includes(country) ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        countries: toggleValue(current.countries, country),
                      }))
                    }
                  >
                    {country}
                  </Button>
                )) : <EmptyFilterOption />}
              </FilterGroup>

              <FilterGroup title="类型">
                {filterOptions.buyerTypes.length > 0 ? filterOptions.buyerTypes.map((buyerType) => (
                  <Button
                    key={buyerType.value}
                    variant={filters.buyerTypes.includes(buyerType.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        buyerTypes: toggleValue(current.buyerTypes, buyerType.value),
                      }))
                    }
                  >
                    {buyerType.label}
                  </Button>
                )) : <EmptyFilterOption />}
              </FilterGroup>

              <FilterGroup title="产品">
                {filterOptions.products.length > 0 ? filterOptions.products.map((product) => (
                  <Button
                    key={product.value}
                    variant={filters.products.includes(product.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        products: toggleValue(current.products, product.value),
                      }))
                    }
                  >
                    {product.label}
                  </Button>
                )) : <EmptyFilterOption />}
              </FilterGroup>
            </div>
            <SheetFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setFilters(emptyFilters);
                  setStatusFilter("all");
                  setChatCustomerFilter("all");
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
              <SheetDescription>
                导入手动聊天记录，支持 JSON、粘贴文字和聊天截图；分析完成后自动写入结构化长期记忆。
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
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
                        if (file && !recordName) setRecordName(file.name.replace(/\.json$/i, ""));
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
                    if (!recordName && event.target.value.trim()) {
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
                    {imageAttachments.length > 0 ? `已选择 ${imageAttachments.length} 张聊天截图` : "上传聊天截图图片（可多选）"}
                    <Input
                      className="hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.heic,.heif"
                      multiple
                      onChange={(event) => {
                        const files = event.target.files;
                        if (files?.length && !recordName) setRecordName(`聊天截图 ${files.length} 张`);
                        void onImageFiles(files);
                      }}
                    />
                  </label>
                  {imageAttachments.length > 0 ? (
                    <AnimatedList
                      className="rounded-md border bg-muted/20"
                      viewportClassName="max-h-32 space-y-1 px-3 py-2 text-xs"
                      showGradients
                    >
                      {imageAttachments.map((attachment) => (
                        <div key={`${attachment.sha256}-${attachment.fileName}`} className="flex items-center justify-between gap-3">
                          <span className="truncate">{attachment.fileName}</span>
                          <span className="shrink-0 text-muted-foreground">{(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      ))}
                    </AnimatedList>
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
                数据安全：业务聊天记录完成分析后自动写入结构化长期记忆，截图原图不会进入长期记忆
              </div>
              <TaskCostNotice {...uploadEstimate} />
              {importMode === "image" ? (
                  <SystemNotice text="截图任务支持多张上传并需要立即导入分析；系统只保存图片 hash/元数据和结构化结果，不保存原图用于之后重新分析。" />
              ) : null}
              {uploadName && !uploadPayload ? (
                <SystemNotice text="当前文件尚未成功读取，请重新选择聊天记录文件。" />
              ) : null}
              {!gatewayConnected || !canRun ? (
                <SystemNotice text={gatewayConnected ? "记忆整理暂不可用，请先完成系统初始化。" : "系统暂未连接，暂时不能执行记忆整理。"} />
              ) : null}
            </div>
            <SheetFooter>
              {importMode !== "image" ? (
                <Button variant="outline" disabled={!uploadPayload || taskRunning} onClick={() => onImportOnly(effectiveRecordName, importModeSourceLabels[importMode])}>
                  <Database className="h-4 w-4" />
                  仅导入
                </Button>
              ) : null}
              <Button disabled={!canRun || agentLoading || !uploadPayload || taskRunning} onClick={() => onAnalyzeUpload(effectiveRecordName, importModeSourceLabels[importMode])}>
                {agentLoading || taskRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                导入并分析
              </Button>
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
            删除后会移除对应聊天记录和整理结果；不会影响获客或背调板块。
          </DialogDescription>
        </DialogHeader>
        <AnimatedList viewportClassName="max-h-64 space-y-2" showGradients>
          {targets.map((item) => (
            <div key={item.recordId} className="rounded-md border px-3 py-2 text-sm">
              <div className="truncate font-medium">{item.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {sourceLabels[item.source]} · {statusLabels[item.analysisStatus]} · {formatBeijingDateTime(item.importedAt)}
              </div>
            </div>
          ))}
        </AnimatedList>
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
}: {
  activeRecord: MemoryRecordItem;
  onClose: () => void;
}) {
  const [sourceState, setSourceState] = useState<{
    importId: string;
    payload: unknown | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const sourceImportId = activeRecord.importId ?? activeRecord.recordId;
  const sourcePayload = sourceState?.importId === sourceImportId ? sourceState.payload : null;
  const sourceLoading = sourceState?.importId === sourceImportId ? sourceState.loading : false;
  const sourceError = sourceState?.importId === sourceImportId ? sourceState.error : null;
  const loadSourcePayload = useCallback(async () => {
    if (sourceState?.importId === sourceImportId && (sourceState.payload || sourceState.loading)) return;
    setSourceState({ importId: sourceImportId, payload: null, loading: true, error: null });
    try {
      const payload = await fetchEmployeeAccioImportPayload(sourceImportId);
      setSourceState({ importId: sourceImportId, payload, loading: false, error: null });
    } catch (error) {
      setSourceState({
        importId: sourceImportId,
        payload: null,
        loading: false,
        error: error instanceof Error ? error.message : "完整聊天记录读取失败。",
      });
    }
  }, [sourceImportId, sourceState]);
  const sourceSlot = (
    <details
      className="text-xs text-muted-foreground"
      onToggle={(event) => {
        if (event.currentTarget.open) void loadSourcePayload();
      }}
    >
      <summary className="cursor-pointer font-medium text-foreground">
        查看完整聊天记录
      </summary>
      <MemorySourceTranscript
        payload={sourcePayload}
        loading={sourceLoading}
        error={sourceError}
        fallbackName={activeRecord.name}
      />
    </details>
  );

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden rounded-lg p-0 sm:max-h-[calc(100vh-4rem)] sm:max-w-5xl">
        <MemoryAnalysisContent
          activeRecord={activeRecord}
          sourceSlot={sourceSlot}
        />
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

function EmptyFilterOption() {
  return <span className="text-xs text-muted-foreground">暂无可筛选项</span>;
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
