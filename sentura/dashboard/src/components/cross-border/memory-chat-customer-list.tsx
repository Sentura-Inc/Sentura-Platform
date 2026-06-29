"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  FileJson,
  Filter,
  Loader2,
  MapPin,
  PackageSearch,
  RotateCcw,
  Search,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AnimatedList, AnimatedTableRow } from "@/components/cross-border/animated-list";
import { ListPagination, usePagedItems } from "@/components/cross-border/brand-ui";
import { buyerTypeLabel, canonicalBuyerType, canonicalProduct, productLabel } from "@/components/cross-border/customer-labels";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";
import type { MemoryRecordItem } from "@/app/client-demos/cross-border/employee/_data/employee-data";
import { leadBuyerTypeOptions } from "@/app/client-demos/cross-border/employee/_data/employee-data";

type ImportRange = "all" | "today" | "7d" | "30d";
type ChatCustomerFilter = "all" | "sufficient" | "insufficient" | "priced" | "clear_intent";
type MemoryChatCustomerLayout = "cards" | "table";

export type MemoryChatCustomerRecord = MemoryRecordItem & {
  ownerUserId?: string | null;
  ownerName?: string | null;
  teamName?: string | null;
};

interface MemoryFilters {
  owners: string[];
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
  record: MemoryChatCustomerRecord;
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

interface MemoryChatCustomerListProps {
  records: MemoryChatCustomerRecord[];
  storageKeyPrefix: string;
  title?: string;
  description?: string;
  emptyDescription?: string;
  pageSize?: number;
  layout?: MemoryChatCustomerLayout;
  ownerOptions?: FilterOption[];
  loadSourcePayload?: (record: MemoryChatCustomerRecord) => Promise<unknown>;
  onAnalysisOpenChange?: (open: boolean) => void;
}

const emptyFilters: MemoryFilters = {
  owners: [],
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

function badgeClass(status: MemoryRecordItem["analysisStatus"]) {
  if (status === "analyzed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "running") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

const memoryStatusFilterChoices = ["all", "not_started", "analyzed", "failed"] as const;
const memoryStatusFilterValues: Array<MemoryRecordItem["analysisStatus"] | "all"> = ["all", "not_started", "analyzed", "failed"];
const memorySourceValues: MemoryRecordItem["source"][] = ["accio", "alibaba_international", "manual_import", "demo_data", "other"];
const importRangeValues: ImportRange[] = ["all", "today", "7d", "30d"];
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
const importRangeLabels: Record<ImportRange, string> = {
  all: "全部时间",
  today: "今日",
  "7d": "近 7 天",
  "30d": "近 30 天",
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

function compactJoin(values: Array<string | undefined>, separator = " · ") {
  return values.filter((value): value is string => Boolean(value)).join(separator);
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

function uniqueSorted(values: Array<string | undefined>) {
  return uniqueText(values).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function ownerValue(record: MemoryChatCustomerRecord) {
  return record.ownerUserId?.trim() || record.ownerName?.trim() || undefined;
}

function ownerLabel(record: MemoryChatCustomerRecord) {
  return record.ownerName?.trim() || record.ownerUserId?.trim() || "未分配负责人";
}

function ownerFilterOptions(records: MemoryChatCustomerRecord[]): FilterOption[] {
  const owners = new Map<string, string>();
  for (const record of records) {
    const value = ownerValue(record);
    if (!value) continue;
    owners.set(value, ownerLabel(record));
  }
  return Array.from(owners.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
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

function memoryRecordSearchText(item: MemoryChatCustomerRecord) {
  const profile = item.customerProfile ?? {};
  const behaviorSignals = item.behaviorSignals ?? {};
  return [
    item.ownerName,
    item.ownerUserId,
    item.teamName,
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

function chatCustomerFromRecord(record: MemoryChatCustomerRecord): ChatCustomerRow | null {
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
    record.ownerName,
    record.ownerUserId,
    record.teamName,
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
  return isStringFilterList(filters.owners) &&
    Array.isArray(filters.sources) &&
    filters.sources.every(isMemorySource) &&
    isImportRange(filters.importRange) &&
    isStringFilterList(filters.countries) &&
    isStringFilterList(filters.buyerTypes) &&
    isStringFilterList(filters.products);
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

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function plainArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(plainRecord).filter((item) => Object.keys(item).length > 0)
    : [];
}

function payloadMetadata(payload: unknown) {
  return plainRecord(plainRecord(payload).export_metadata);
}

function payloadConversations(payload: unknown) {
  return plainArray(plainRecord(payload).conversations);
}

function sourceFileLabel(payload: unknown, fallback: string) {
  const metadata = payloadMetadata(payload);
  return recordTextValue(metadata, "source_file", "sourceFile", "file_name", "fileName") ?? fallback;
}

function inputFormatLabel(payload: unknown) {
  const metadata = payloadMetadata(payload);
  const format = recordTextValue(metadata, "input_format", "inputFormat");
  if (format === "pasted_text") return "粘贴文字";
  if (format === "image") return "聊天截图";
  if (format === "json") return "JSON 文件";
  return format ?? "未知格式";
}

function conversationTitle(conversation: Record<string, unknown>, index: number) {
  const buyer = plainRecord(conversation.buyer);
  return recordTextValue(buyer, "company_name", "display_name", "contact_person") ??
    recordTextValue(conversation, "conversation_id", "id") ??
    `对话 ${index + 1}`;
}

function messageText(message: Record<string, unknown>) {
  return recordTextValue(message, "text", "text_redacted", "content", "message") ?? "[空消息]";
}

function messageSenderLabel(message: Record<string, unknown>) {
  const sender = recordTextValue(message, "sender", "sender_role", "role");
  if (sender === "buyer") return "买家";
  if (sender === "seller") return "卖家";
  if (sender === "system") return "系统";
  return sender ?? "未知";
}

function messageTimestampLabel(message: Record<string, unknown>) {
  const value = recordTextValue(message, "timestamp", "message_ts", "timestamp_text");
  return value ? formatBeijingDateTime(value) : undefined;
}

function attachmentLabel(attachment: Record<string, unknown>, index: number) {
  return compactJoin([
    recordTextValue(attachment, "file_name", "fileName") ?? `附件 ${index + 1}`,
    recordTextValue(attachment, "type", "mimeType"),
    recordTextValue(attachment, "sha256") ? `SHA256 ${recordTextValue(attachment, "sha256")}` : undefined,
  ], " · ");
}

export function MemoryChatCustomerList({
  records,
  storageKeyPrefix,
  title = "聊天客户列表",
  description = "基于已分析聊天记录整理客户信息；这里只展示预览整理结果，不写入背调结论。",
  emptyDescription = "导入并分析聊天记录后，系统会按公司、联系人、商品、报价和下一步整理到这里。",
  pageSize = 5,
  layout = "cards",
  ownerOptions,
  loadSourcePayload,
  onAnalysisOpenChange,
}: MemoryChatCustomerListProps) {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<MemoryChatCustomerRecord | null>(null);
  const [statusFilter, setStatusFilter] = usePersistentUiState<MemoryRecordItem["analysisStatus"] | "all">(
    `${storageKeyPrefix}:status-filter:v1`,
    "all",
    isMemoryStatusFilter,
  );
  const [filters, setFilters] = usePersistentUiState<MemoryFilters>(
    `${storageKeyPrefix}:filters:v1`,
    emptyFilters,
    isMemoryFilters,
  );
  const [chatCustomerFilter, setChatCustomerFilter] = usePersistentUiState<ChatCustomerFilter>(
    `${storageKeyPrefix}:chat-customer-filter:v1`,
    "all",
    isChatCustomerFilter,
  );

  const filterOptions = useMemo(
    () => ({
      owners: ownerOptions && ownerOptions.length > 0 ? ownerOptions : ownerFilterOptions(records),
      sources: Array.from(new Set(records.map((item) => item.source))),
      countries: uniqueSorted(records.map(customerCountry)),
      buyerTypes: buyerTypeFilterOptions(records),
      products: productFilterOptions(records),
    }),
    [ownerOptions, records],
  );

  useEffect(() => {
    const allowedOwners = new Set(filterOptions.owners.map((item) => item.value));
    setFilters((current) => {
      if (current.owners.length === 0) return current;
      const owners = current.owners.filter((value) => allowedOwners.has(value));
      return owners.length === current.owners.length ? current : { ...current, owners };
    });
  }, [filterOptions.owners, setFilters]);

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

  useEffect(() => {
    onAnalysisOpenChange?.(Boolean(activeRecord));
  }, [activeRecord, onAnalysisOpenChange]);

  useEffect(() => () => onAnalysisOpenChange?.(false), [onAnalysisOpenChange]);

  const chatCustomers = useMemo(
    () => records.map(chatCustomerFromRecord).filter((item): item is ChatCustomerRow => Boolean(item)),
    [records],
  );

  const filteredChatCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return chatCustomers.filter((row) => {
      const item = row.record;
      const matchesOwner = containsSelected([ownerValue(item)].filter((value): value is string => Boolean(value)), filters.owners);
      const matchesSource = filters.sources.length === 0 || filters.sources.includes(item.source);
      const matchesImportRange = importedAtInRange(item.importedAt, filters.importRange);
      const matchesStatus = statusFilter === "all" || statusFilter === "analyzed";
      const matchesQuery = !normalized || row.searchText.includes(normalized);
      const matchesDimensions =
        containsSelected([row.country].filter((value): value is string => Boolean(value)), filters.countries) &&
        containsSelected([row.buyerType].filter((value): value is string => Boolean(value)), filters.buyerTypes) &&
        containsSelected(row.productCategories, filters.products);
      return matchesOwner &&
        matchesSource &&
        matchesImportRange &&
        matchesStatus &&
        matchesQuery &&
        matchesDimensions &&
        chatCustomerMatchesFilter(row, chatCustomerFilter);
    });
  }, [chatCustomerFilter, chatCustomers, filters, query, statusFilter]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    for (const owner of filters.owners) {
      const label = filterOptions.owners.find((item) => item.value === owner)?.label ?? owner;
      chips.push({
        key: `owner-${owner}`,
        label: `负责人：${label}`,
        clear: () => setFilters((current) => ({ ...current, owners: current.owners.filter((item) => item !== owner) })),
      });
    }
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
  }, [chatCustomerFilter, filterOptions.buyerTypes, filterOptions.owners, filterOptions.products, filters, setChatCustomerFilter, setFilters, setStatusFilter, statusFilter]);

  const chatCustomerPaginationResetKey = useMemo(
    () => JSON.stringify({ chatCustomerFilter, filters, query, statusFilter }),
    [chatCustomerFilter, filters, query, statusFilter],
  );
  const chatCustomerPage = usePagedItems(filteredChatCustomers, pageSize, { resetKey: chatCustomerPaginationResetKey });
  const activeFilterCount = activeFilterChips.length;

  return (
    <>
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
              <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
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
                  <h2 className="text-base font-semibold tracking-normal">{title}</h2>
                  <Badge variant="secondary">{filteredChatCustomers.length} 个客户</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
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
                  {emptyDescription}
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {layout === "table" ? (
                  <ChatCustomerTable
                    rows={chatCustomerPage.items}
                    showOwner={filterOptions.owners.length > 0}
                    openDetail={setActiveRecord}
                  />
                ) : (
                  <AnimatedList viewportClassName="grid gap-3 overflow-visible" displayScrollbar={false} scrollable={false}>
                    {chatCustomerPage.items.map((row) => (
                      <ChatCustomerCard
                        key={row.record.recordId}
                        row={row}
                        openDetail={setActiveRecord}
                      />
                    ))}
                  </AnimatedList>
                )}
                <ListPagination
                  page={chatCustomerPage.page}
                  totalItems={chatCustomerPage.totalItems}
                  pageSize={chatCustomerPage.pageSize}
                  onPageChange={chatCustomerPage.setPage}
                />
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <MemoryFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filters={filters}
        setFilters={setFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        chatCustomerFilter={chatCustomerFilter}
        setChatCustomerFilter={setChatCustomerFilter}
        filterOptions={filterOptions}
        activeFilterCount={activeFilterCount}
      />

      <MemoryAnalysisDialog
        record={activeRecord}
        loadSourcePayload={loadSourcePayload}
        onOpenChange={(open) => {
          if (!open) setActiveRecord(null);
        }}
      />
    </>
  );
}

function chatCustomerContactLine(row: ChatCustomerRow) {
  return uniqueText([row.contact, row.buyerRole]).join(" / ") || "待提取";
}

function chatCustomerLocationLine(row: ChatCustomerRow) {
  return compactJoin([row.country, row.website ?? row.email], " · ") || "暂无";
}

function chatCustomerIntentLine(row: ChatCustomerRow) {
  return row.intentSummary ?? (row.products.length > 0 ? row.products.join("、") : "待提取");
}

function chatCustomerPriceActionLine(row: ChatCustomerRow) {
  return compactJoin([row.priceSummary, row.nextAction], "；") || "暂无明确报价或下一步";
}

function ChatCustomerTable({
  rows,
  showOwner,
  openDetail,
}: {
  rows: ChatCustomerRow[];
  showOwner: boolean;
  openDetail: (item: MemoryRecordItem) => void;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <ChatCustomerCard
            key={row.record.recordId}
            row={row}
            showOwner={showOwner}
            openDetail={openDetail}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto overflow-y-hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">客户</TableHead>
              {showOwner ? <TableHead className="min-w-[150px]">负责人</TableHead> : null}
              <TableHead className="min-w-[150px]">定位 / 类型</TableHead>
              <TableHead className="min-w-[220px]">采购需求</TableHead>
              <TableHead className="min-w-[220px]">报价 / 下一步</TableHead>
              <TableHead className="min-w-[150px]">导入时间</TableHead>
              <TableHead className="min-w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <AnimatedTableRow key={row.record.recordId} index={index}>
                <TableCell className="align-top">
                  <button
                    type="button"
                    className="max-w-[260px] truncate text-left font-medium text-primary hover:underline"
                    onClick={() => openDetail(row.record)}
                  >
                    {row.displayName}
                  </button>
                  <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">
                    {chatCustomerContactLine(row)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={row.infoSufficient ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}
                    >
                      {row.infoSufficient ? "信息充足" : "信息不足"}
                    </Badge>
                    {row.hasPrice ? <Badge variant="secondary">有报价</Badge> : null}
                    {row.demandClear ? <Badge variant="secondary">需求明确</Badge> : null}
                  </div>
                </TableCell>
                {showOwner ? (
                  <TableCell className="align-top">
                    <div className="font-medium">{ownerLabel(row.record)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.record.teamName ?? row.record.ownerUserId ?? "-"}
                    </div>
                  </TableCell>
                ) : null}
                <TableCell className="align-top">
                  <div>{chatCustomerLocationLine(row)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.buyerType ? buyerTypeLabel(row.buyerType) : "类型待确认"}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="max-w-[260px] whitespace-normal break-words text-sm leading-5">
                    {chatCustomerIntentLine(row)}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="max-w-[280px] whitespace-normal break-words text-sm leading-5">
                    {chatCustomerPriceActionLine(row)}
                  </div>
                </TableCell>
                <TableCell className="align-top text-xs text-muted-foreground">
                  <div>{sourceLabels[row.record.source]}</div>
                  <div className="mt-1">{formatBeijingDateTime(row.record.importedAt)}</div>
                </TableCell>
                <TableCell className="align-top text-right">
                  <Button variant="outline" size="sm" onClick={() => openDetail(row.record)}>
                    <Eye className="h-3.5 w-3.5" />
                    查看
                  </Button>
                </TableCell>
              </AnimatedTableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function ChatCustomerCard({
  row,
  showOwner = false,
  openDetail,
}: {
  row: ChatCustomerRow;
  showOwner?: boolean;
  openDetail: (item: MemoryRecordItem) => void;
}) {
  const contactLine = chatCustomerContactLine(row);
  const locationLine = chatCustomerLocationLine(row);
  const intentLineText = chatCustomerIntentLine(row);
  const priceAndAction = chatCustomerPriceActionLine(row);

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
            {showOwner ? <Badge variant="outline">{ownerLabel(row.record)}</Badge> : null}
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
      className="min-w-0 rounded-md border bg-background/80 px-3 py-2 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-md hover:shadow-sky-950/10 active:translate-y-0 active:scale-[0.99]"
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

function MemoryFilterSheet({
  open,
  onOpenChange,
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  chatCustomerFilter,
  setChatCustomerFilter,
  filterOptions,
  activeFilterCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MemoryFilters;
  setFilters: Dispatch<SetStateAction<MemoryFilters>>;
  statusFilter: MemoryRecordItem["analysisStatus"] | "all";
  setStatusFilter: Dispatch<SetStateAction<MemoryRecordItem["analysisStatus"] | "all">>;
  chatCustomerFilter: ChatCustomerFilter;
  setChatCustomerFilter: Dispatch<SetStateAction<ChatCustomerFilter>>;
  filterOptions: {
    owners: FilterOption[];
    sources: MemoryRecordItem["source"][];
    countries: string[];
    buyerTypes: FilterOption[];
    products: FilterOption[];
  };
  activeFilterCount: number;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>筛选记忆记录</SheetTitle>
          <SheetDescription>
            按负责人、来源、导入时间、分析状态、客户信息、国家、类型和产品筛选；搜索词会继续生效。
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4">
          {filterOptions.owners.length > 0 ? (
            <FilterGroup title="负责人">
              {filterOptions.owners.map((owner) => (
                <Button
                  key={owner.value}
                  variant={filters.owners.includes(owner.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      owners: toggleValue(current.owners, owner.value),
                    }))
                  }
                >
                  {owner.label}
                </Button>
              ))}
            </FilterGroup>
          ) : null}

          <FilterGroup title="来源">
            {filterOptions.sources.length > 0 ? filterOptions.sources.map((source) => (
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
            )) : <EmptyFilterOption />}
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
      </SheetContent>
    </Sheet>
  );
}

function MemoryAnalysisDialog({
  record,
  loadSourcePayload,
  onOpenChange,
}: {
  record: MemoryChatCustomerRecord | null;
  loadSourcePayload?: (record: MemoryChatCustomerRecord) => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
}) {
  const [sourceState, setSourceState] = useState<{
    recordId: string;
    payload: unknown | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const sourceSlot = record && loadSourcePayload ? (
    <details
      className="text-xs text-muted-foreground"
      onToggle={(event) => {
        if (!event.currentTarget.open) return;
        if (sourceState?.recordId === record.recordId && (sourceState.payload || sourceState.loading)) return;
        setSourceState({ recordId: record.recordId, payload: null, loading: true, error: null });
        void loadSourcePayload(record)
          .then((payload) => {
            setSourceState({ recordId: record.recordId, payload, loading: false, error: null });
          })
          .catch((error) => {
            setSourceState({
              recordId: record.recordId,
              payload: null,
              loading: false,
              error: error instanceof Error ? error.message : "完整聊天记录读取失败。",
            });
          });
      }}
    >
      <summary className="cursor-pointer font-medium text-foreground">
        查看完整聊天记录
      </summary>
      <MemorySourceTranscript
        payload={sourceState?.recordId === record.recordId ? sourceState.payload : null}
        loading={sourceState?.recordId === record.recordId ? sourceState.loading : false}
        error={sourceState?.recordId === record.recordId ? sourceState.error : null}
        fallbackName={record.name}
      />
    </details>
  ) : undefined;

  return (
    <Dialog open={Boolean(record)} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[70] bg-[#07111f]/40 supports-backdrop-filter:backdrop-blur-md"
        className="z-[80] flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg border border-sky-100 p-0 shadow-2xl shadow-sky-950/30 ring-1 ring-white/60 sm:max-h-[calc(100dvh-4rem)] sm:max-w-5xl"
      >
        {record ? <MemoryAnalysisContent activeRecord={record} sourceSlot={sourceSlot} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export function MemoryAnalysisContent({
  activeRecord,
  sourceSlot,
}: {
  activeRecord: MemoryRecordItem;
  sourceSlot?: ReactNode;
}) {
  const customerProfile = activeRecord.customerProfile ?? {};
  const purchaseIntent = activeRecord.purchaseIntent ?? [];
  const negotiatedPrices = activeRecord.negotiatedPrices ?? [];
  const nextActions = activeRecord.nextActions ?? [];
  const behaviorSignals = activeRecord.behaviorSignals ?? {};
  const extractedCompanyName = recordTextValue(customerProfile, "company_name") ?? activeRecord.companyName;
  const profileIdentity = recordTextValue(
    customerProfile,
    "self_described_identity",
    "buyer_type",
    "shop_or_store_name",
    "store_name",
    "decision_role",
  );
  const profileSummary = compactJoin([
    weakCustomerName(extractedCompanyName) ? undefined : extractedCompanyName,
    recordTextValue(customerProfile, "contact_person"),
    profileIdentity,
    usableCountry(recordTextValue(customerProfile, "country") ?? activeRecord.country),
    recordTextValue(customerProfile, "city"),
    recordTextValue(customerProfile, "website"),
    recordTextValue(customerProfile, "email"),
  ]);
  const behaviorSummary = recordTextValue(behaviorSignals, "summary_zh", "summary");
  return (
    <>
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
                客户画像
              </div>
              <div className="space-y-2 rounded-md bg-muted/40 px-3 py-2 text-sm leading-6">
                <div>
                  {weakCustomerName(extractedCompanyName) && profileIdentity
                    ? `客户标识：${profileIdentity}`
                    : `公司：${extractedCompanyName ?? "待提取"}`}
                </div>
                {profileSummary ? <div className="text-muted-foreground">{profileSummary}</div> : null}
                {behaviorSummary ? <div className="text-muted-foreground">{behaviorSummary}</div> : null}
              </div>
            </section>

            <section className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4 text-primary" />
                整理结果预览
              </div>
              <div className="space-y-3 rounded-md bg-muted/40 p-3 text-sm">
                <div>
                  <div className="mb-1 font-medium">采购需求</div>
                  {purchaseIntent.length > 0 ? (
                    <div className="space-y-2 text-muted-foreground">
                      {purchaseIntent.slice(0, 3).map((item, index) => (
                        <div key={`intent-${index}`}>{intentLine(item) || "已识别一条采购需求。"}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">暂未提取到明确采购需求。</div>
                  )}
                </div>
                <div>
                  <div className="mb-1 font-medium">价格与条款</div>
                  {negotiatedPrices.length > 0 ? (
                    <div className="space-y-2 text-muted-foreground">
                      {negotiatedPrices.slice(0, 5).map((item, index) => (
                        <div key={`price-${index}`}>{priceLine(item) || "已识别一条价格信息。"}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">暂未提取到明确价格条款。</div>
                  )}
                </div>
                <div>
                  <div className="mb-1 font-medium">下一步</div>
                  {nextActions.length > 0 ? (
                    <div className="space-y-1 text-muted-foreground">
                      {nextActions.slice(0, 5).map((action, index) => (
                        <div key={`action-${index}`}>{index + 1}. {action}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">暂无明确下一步。</div>
                  )}
                </div>
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
                  <dt className="text-xs text-muted-foreground">完整聊天记录</dt>
                  <dd className="mt-1">
                    {sourceSlot ?? (
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                        展开客户详情后读取已保存的完整聊天记录。
                      </div>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

export function MemorySourceTranscript({
  payload,
  loading,
  error,
  fallbackName,
}: {
  payload: unknown | null;
  loading: boolean;
  error: string | null;
  fallbackName: string;
}) {
  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        正在读取完整聊天记录
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
        {error}
      </div>
    );
  }
  if (!payload) {
    return (
      <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2">
        展开后读取已保存的导入文本。
      </div>
    );
  }

  const conversations = payloadConversations(payload);
  const metadata = payloadMetadata(payload);
  const attachments = plainArray(metadata.attachment_metadata);
  const inputFormat = inputFormatLabel(payload);

  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-md border bg-muted/30 px-3 py-2">
        <div className="font-medium text-foreground">{sourceFileLabel(payload, fallbackName)}</div>
        <div className="mt-1 text-muted-foreground">
          {inputFormat} · {recordTextValue(metadata, "source_kind", "sourceKind") ?? "手动导入"}
        </div>
        {inputFormat === "聊天截图" ? (
          <div className="mt-1 text-amber-800">
            截图原件不长期保存；这里展示保存的文件元数据和转写后的文本。
          </div>
        ) : (
          <div className="mt-1 text-muted-foreground">
            管理者可查看已保存的完整聊天内容。
          </div>
        )}
      </div>

      {attachments.length > 0 ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <div className="mb-1 font-medium text-foreground">上传文件</div>
          <div className="space-y-1">
            {attachments.map((attachment, index) => (
              <div key={`attachment-${index}`} className="break-words font-mono text-[11px]">
                {attachmentLabel(attachment, index)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {conversations.length > 0 ? (
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-background/70 p-2">
          {conversations.map((conversation, conversationIndex) => {
            const messages = plainArray(conversation.messages);
            const conversationAttachments = plainArray(conversation.attachments);
            return (
              <section key={`conversation-${conversationIndex}`} className="rounded-md border bg-white/70 px-2 py-2">
                <div className="mb-2 font-medium text-foreground">
                  {conversationTitle(conversation, conversationIndex)}
                </div>
                {messages.length > 0 ? (
                  <div className="space-y-2">
                    {messages.map((message, messageIndex) => (
                      <div key={`message-${messageIndex}`} className="rounded-md bg-muted/35 px-2 py-1.5">
                        <div className="mb-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          <span>{messageSenderLabel(message)}</span>
                          {messageTimestampLabel(message) ? <span>{messageTimestampLabel(message)}</span> : null}
                        </div>
                        <div className="whitespace-pre-wrap break-words text-foreground">
                          {messageText(message)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">这条对话没有保存可展示的文本消息。</div>
                )}
                {conversationAttachments.length > 0 ? (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    {conversationAttachments.map((attachment, attachmentIndex) => (
                      <div key={`conversation-attachment-${attachmentIndex}`} className="break-words font-mono text-[11px] text-muted-foreground">
                        {attachmentLabel(attachment, attachmentIndex)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-[11px] text-muted-foreground">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium tracking-normal">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function EmptyFilterOption() {
  return <span className="text-sm text-muted-foreground">暂无可选项</span>;
}
