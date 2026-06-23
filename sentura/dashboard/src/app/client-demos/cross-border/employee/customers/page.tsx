"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  CheckCircle2,
  Eye,
  ExternalLink,
  Filter,
  HelpCircle,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { CustomerReportDialog } from "@/components/cross-border/customer-report-dialog";
import {
  buyerTypeLabel,
  canonicalBuyerType,
  canonicalProduct,
  productLabel,
} from "@/components/cross-border/customer-labels";
import {
  isCbeEmployeeTaskActive,
  useCbeEmployeeStore,
} from "@/stores/use-cbe-employee-store";
import {
  MAX_LEAD_TARGET_COUNT,
  type CustomerListItem,
  type CustomerEvidenceItem,
  type CustomerScoreBlock,
  type CustomerScreeningReport,
  type ScreeningEvidenceLayer,
  type ScoreTier,
  estimateLeadTaskCost,
  estimateScreeningTaskCost,
  leadBuyerTypeOptions,
  leadCountryOptions,
  leadExcludeDomainOptions,
  leadProductOptions,
} from "../_data/employee-data";
import {
  EmployeeTaskError,
  LEAD_AGENT_ID,
  SCREENING_AGENT_ID,
  createPlannedEmployeeSessionKey,
  customersToScreeningTargets,
  employeeTaskErrorMessage,
  estimateEmployeeTaskTimeoutMs,
  estimateLeadTaskDurationMs,
  estimateScreeningTaskDurationMs,
  isEmployeeTaskCancellation,
  manualInputToScreeningTarget,
  runLeadDiscoveryTask,
  runScreeningTask,
  type EmployeeLeadTaskInput,
  type EmployeeScreeningTaskOptions,
  type EmployeeTaskProgress,
  type ManualScreeningInput,
} from "../_data/employee-task-runner";
import {
  CbeEmployeeApiError,
  cancelEmployeeTaskInDb,
  completeEmployeeLeadRun,
  completeEmployeeScreeningRun,
  claimEmployeeQueuedScreeningRuns,
  createEmployeeLeadRun,
  createEmployeeScreeningRun,
  deleteEmployeeCustomers,
  failEmployeeTaskInDb,
  fetchEmployeeCustomers,
  fetchEmployeeTasks,
} from "../_data/employee-api";
import {
  clearCbeEmployeeTaskAbortSignal,
  createCbeEmployeeTaskAbortSignal,
} from "../_data/employee-task-cancellation";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";

type SheetMode = "lead" | "bulk" | "manual" | "detail" | "filters" | "delete" | null;

type FoundRange = "all" | "today" | "7d" | "30d";
type ScoreSort = "none" | "score_desc" | "score_asc";
type CustomerHighlightScope = "lead-results" | "screening-results" | "trusted" | "pending";
type CustomerHighlightRange = "today" | "week" | "month" | "all";

interface CustomerFilters {
  countries: string[];
  buyerTypes: string[];
  products: string[];
  foundRange: FoundRange;
  scoreTiers: ScoreTier[];
}

type FilterOption = {
  value: string;
  label: string;
};

interface LeadSelectionState {
  productIds: string[];
  buyerTypeIds: string[];
  countryCodes: string[];
  targetCount: number;
  maxResultsPerQuery: number;
  excludeDomainIds: string[];
}

interface ScreeningOptionState {
  paidEmailValidation: boolean;
  paidTradeData: boolean;
  maxPaidSpendUsd: number;
}

interface DeleteIntent {
  customerIds: string[];
  source: "single" | "bulk";
}

const emptyFilters: CustomerFilters = {
  countries: [],
  buyerTypes: [],
  products: [],
  foundRange: "all",
  scoreTiers: [],
};

const defaultLeadSelection: LeadSelectionState = {
  productIds: ["phone-case", "tempered-glass", "usb-c-charger"],
  buyerTypeIds: ["repair-chain", "electronics-retailer", "accessory-retailer"],
  countryCodes: ["GB", "US"],
  targetCount: MAX_LEAD_TARGET_COUNT,
  maxResultsPerQuery: 10,
  excludeDomainIds: ["marketplaces", "social", "directories", "supplier-directories"],
};

const defaultScreeningOptions: ScreeningOptionState = {
  paidEmailValidation: false,
  paidTradeData: false,
  maxPaidSpendUsd: 0,
};

const MAX_LEAD_COMPLETION_ATTEMPTS = 8;

function normalizeLeadTargetCount(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_LEAD_TARGET_COUNT, Math.max(1, Math.floor(value)));
}

const statusLabels: Record<CustomerListItem["screeningStatus"], string> = {
  not_started: "未背调",
  running: "背调中",
  screened: "已评分",
  insufficient_evidence: "证据不足",
  failed: "失败",
};

const sourceLabels: Record<CustomerListItem["source"], string> = {
  lead_discovery: "",
  manual_screening: "手动录入",
  accio_handoff: "来自聊天记录",
};

const scoreTierLabels: Record<ScoreTier, string> = {
  high: "高分",
  medium: "中等",
  low: "低分",
};

const riskTierLabels: Record<string, string> = {
  trusted_candidate: "可信候选",
  cautious: "谨慎跟进",
  insufficient_evidence: "证据不足",
  high_risk: "高风险",
};

const scoreBlockLabels: Record<string, string> = {
  legal_identity: "公司注册信息",
  domain_email: "官网和邮箱",
  google_maps_local_presence: "线下地址线索",
  address_validation: "地址一致性",
  public_footprint: "公开资料",
  business_fit: "业务匹配",
  trade_financial: "贸易和财务",
  conversation_behavior: "聊天行为",
};

const evidenceLayerLabels: Record<ScreeningEvidenceLayer, string> = {
  legal_registry: "公司注册信息",
  domain_rdap: "域名信息",
  email_dns: "邮箱信息",
  official_contact: "官网公开联系信息",
  google_maps_local_presence: "线下地址线索",
  address_validation: "地址一致性",
  public_footprint: "公开资料",
  trade_customs: "贸易记录",
  financial_public_filing: "财务公开信息",
  accio_behavior: "聊天行为",
};

const evidenceLayerOrder: ScreeningEvidenceLayer[] = [
  "legal_registry",
  "domain_rdap",
  "email_dns",
  "official_contact",
  "google_maps_local_presence",
  "address_validation",
  "public_footprint",
  "trade_customs",
  "financial_public_filing",
  "accio_behavior",
];

const foundRangeLabels: Record<FoundRange, string> = {
  all: "全部时间",
  today: "今日",
  "7d": "近 7 天",
  "30d": "近 30 天",
};

const scoreSortLabels: Record<ScoreSort, string> = {
  none: "默认排序",
  score_desc: "评分高到低",
  score_asc: "评分低到高",
};

const quickStatusFilters = ["all", "not_started", "screened", "insufficient_evidence"] as const;
const sheetStatusFilters = ["all", "not_started", "screened", "insufficient_evidence", "failed"] as const;
const customerStatusFilterValues: Array<CustomerListItem["screeningStatus"] | "all"> = [
  "all",
  "not_started",
  "running",
  "screened",
  "insufficient_evidence",
  "failed",
];
const scoreSortValues: ScoreSort[] = ["none", "score_desc", "score_asc"];
const foundRangeValues: FoundRange[] = ["all", "today", "7d", "30d"];
const scoreTierValues: ScoreTier[] = ["high", "medium", "low"];
const CUSTOMER_STATUS_FILTER_STORAGE_KEY = "sentura:cbe:employee:customers:status-filter:v1";
const CUSTOMER_SCORE_SORT_STORAGE_KEY = "sentura:cbe:employee:customers:score-sort:v1";
const CUSTOMER_FILTERS_STORAGE_KEY = "sentura:cbe:employee:customers:filters:v1";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCustomerStatusFilter(value: unknown): value is CustomerListItem["screeningStatus"] | "all" {
  return typeof value === "string" && customerStatusFilterValues.includes(value as CustomerListItem["screeningStatus"] | "all");
}

function isScoreSort(value: unknown): value is ScoreSort {
  return typeof value === "string" && scoreSortValues.includes(value as ScoreSort);
}

function isFoundRange(value: unknown): value is FoundRange {
  return typeof value === "string" && foundRangeValues.includes(value as FoundRange);
}

function isScoreTier(value: unknown): value is ScoreTier {
  return typeof value === "string" && scoreTierValues.includes(value as ScoreTier);
}

function isCustomerFilters(value: unknown): value is CustomerFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const filters = value as Partial<Record<keyof CustomerFilters, unknown>>;
  return (
    isStringArray(filters.countries) &&
    isStringArray(filters.buyerTypes) &&
    isStringArray(filters.products) &&
    isFoundRange(filters.foundRange) &&
    Array.isArray(filters.scoreTiers) &&
    filters.scoreTiers.every(isScoreTier)
  );
}

function customerCountryLabel(item: CustomerListItem) {
  const label = item.countryName?.trim();
  if (!label || label === "未确认" || label === "ZZ") return null;
  return label;
}

function customerSubtitle(
  item: CustomerListItem,
  options: { includeCountry?: boolean; includeBuyerType?: boolean } = {},
) {
  return [
    options.includeCountry ? customerCountryLabel(item) : null,
    options.includeBuyerType ? buyerTypeLabel(item.buyerType) : null,
    sourceLabels[item.source],
  ].filter((part): part is string => Boolean(part)).join(" · ");
}

function parseCustomerDate(value: string) {
  const source = value.trim();
  if (!source) return null;
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(source);
  const normalized = source.includes("T") ? source : source.replace(" ", "T");
  const date = new Date(hasExplicitZone ? normalized : `${normalized}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBeijingDateTime(value: string) {
  const date = parseCustomerDate(value);
  if (!date) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
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
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

function highlightFrameClass(active: boolean) {
  return active
    ? "animate-pulse outline outline-2 -outline-offset-2 outline-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.22)]"
    : "";
}

function rowClass(item: CustomerListItem, isHighlighted = false) {
  if (isHighlighted) return cn("bg-sky-50/60", highlightFrameClass(true));
  if (item.screeningStatus === "running") return "bg-sky-50/35";
  if (item.screeningStatus === "not_started") return "bg-sky-50/10";
  if (item.screeningStatus === "failed") return "bg-rose-50/35";
  if (item.scoreTier === "high") return "bg-emerald-50/35";
  if (item.scoreTier === "medium") return "bg-amber-50/35";
  if (item.scoreTier === "low") return "bg-rose-50/35";
  if (item.screeningStatus === "insufficient_evidence") return "bg-zinc-50/60";
  if (item.screeningStatus === "screened") return "bg-emerald-50/20";
  return "bg-background";
}

function workflowBadge(item: CustomerListItem) {
  if (item.screeningStatus === "not_started") {
    return null;
  }
  if (item.screeningStatus === "screened") {
    return { label: "", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: "check" as const };
  }
  if (item.screeningStatus === "running") {
    return { label: "背调中", className: "border-sky-200 bg-sky-50 text-sky-800" };
  }
  if (item.screeningStatus === "insufficient_evidence") {
    return null;
  }
  if (item.screeningStatus === "failed") {
    return { label: "失败", className: "border-rose-200 bg-rose-50 text-rose-800" };
  }
  return null;
}

function statusBadgeClass(item: CustomerListItem) {
  if (item.screeningStatus === "running") return "border-sky-200 bg-sky-50 text-sky-800";
  if (item.screeningStatus === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  if (item.scoreTier === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (item.scoreTier === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  if (item.scoreTier === "low") return "border-rose-200 bg-rose-50 text-rose-800";
  if (item.screeningStatus === "insufficient_evidence") return "border-zinc-200 bg-zinc-50 text-zinc-800";
  return "border-slate-200 bg-white text-slate-700";
}

function scoreLabel(item: CustomerListItem) {
  if (item.screeningStatus === "running") return "背调中";
  if (typeof item.normalizedScore === "number") {
    if (item.scoreTier === "high") return `${item.normalizedScore}/100 · 高分 · 优先跟进`;
    if (item.scoreTier === "medium") return `${item.normalizedScore}/100 · 中等 · 谨慎跟进`;
    if (item.scoreTier === "low") return `${item.normalizedScore}/100 · 低分 · 暂缓/高风险`;
    return `${item.normalizedScore}/100`;
  }
  if (item.screeningStatus === "insufficient_evidence") return "证据不足";
  return "未评分";
}

function CustomerProductBadges({
  products,
  expanded,
  onToggle,
}: {
  products: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const visibleProducts = expanded ? products : products.slice(0, 2);
  const hiddenCount = Math.max(0, products.length - visibleProducts.length);

  return (
    <div className="flex flex-wrap gap-1">
      {visibleProducts.map((product) => (
        <Badge key={product} variant="secondary">
          {productLabel(product)}
        </Badge>
      ))}
      {products.length > 2 ? (
        <button
          type="button"
          aria-expanded={expanded}
          className="inline-flex h-6 items-center rounded-full border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? "收起" : `+${hiddenCount}`}
        </button>
      ) : null}
    </div>
  );
}

function taskAffectedCustomerIds(taskId: string, rows: CustomerListItem[], tasks: Array<{ id: string; affectedCustomerIds?: string[] }>) {
  const task = tasks.find((item) => item.id === taskId);
  const metadataIds = new Set(task?.affectedCustomerIds ?? []);
  const rowIds = rows
    .filter((item) =>
      metadataIds.has(item.customerId) ||
      item.latestAgentRunId === taskId ||
      item.leadAgentRunId === taskId ||
      item.screeningAgentRunId === taskId,
    )
    .map((item) => item.customerId);
  return Array.from(new Set(rowIds));
}

function customerRowSelector(customerId: string) {
  const escaped = typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(customerId)
    : customerId.replace(/["\\]/g, "\\$&");
  return `[data-customer-id="${escaped}"]`;
}

function normalizeCustomerHighlightScope(value: string | null): CustomerHighlightScope | null {
  if (
    value === "lead-results" ||
    value === "screening-results" ||
    value === "trusted" ||
    value === "pending"
  ) {
    return value;
  }
  return null;
}

function normalizeCustomerHighlightRange(value: string | null): CustomerHighlightRange {
  if (value === "today" || value === "week" || value === "month" || value === "all") return value;
  return "all";
}

function customerMatchesHighlightRange(item: CustomerListItem, range: CustomerHighlightRange) {
  if (range === "all") return true;
  const foundDate = parseCustomerDate(item.foundAt);
  if (!foundDate) return true;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "week") {
    const day = start.getDay();
    const offset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - offset);
  }
  if (range === "month") {
    start.setDate(1);
  }
  return foundDate >= start;
}

function highlightedCustomerIdsForScope(
  rows: CustomerListItem[],
  scope: CustomerHighlightScope,
  range: CustomerHighlightRange,
) {
  const rangedRows = rows.filter((item) => customerMatchesHighlightRange(item, range));
  const scopedRows = rangedRows.filter((item) => {
    if (scope === "lead-results") return item.source === "lead_discovery";
    if (scope === "screening-results") return item.screeningStatus === "screened";
    if (scope === "trusted") return item.scoreTier === "high";
    return item.screeningStatus === "not_started" || item.screeningStatus === "insufficient_evidence";
  });
  if (scope === "lead-results" && scopedRows.length === 0) return rangedRows.map((item) => item.customerId);
  return scopedRows.map((item) => item.customerId);
}

function comparableScore(item: CustomerListItem) {
  const reportScore = item.screeningReport?.normalizedScore;
  if (typeof item.normalizedScore === "number") return item.normalizedScore;
  if (typeof reportScore === "number") return reportScore;
  return null;
}

function percentLabel(value: number | undefined) {
  if (typeof value !== "number") return "未计算";
  return `${Math.round(value * 100)}%`;
}

function sourceTypeLabel(value?: string) {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("registry")) return "官方注册资料";
  if (normalized.includes("dns") || normalized.includes("rdap") || normalized.includes("domain")) return "官网和邮箱资料";
  if (normalized.includes("web")) return "公开网页";
  if (normalized.includes("map") || normalized.includes("place")) return "公开地址资料";
  if (normalized.includes("trade") || normalized.includes("custom")) return "贸易资料";
  if (normalized.includes("financial") || normalized.includes("filing")) return "财务公开资料";
  return "公开资料";
}

function scoreImpactLabel(value?: CustomerEvidenceItem["scoreImpact"]) {
  if (value === "positive") return "正向依据";
  if (value === "negative") return "风险依据";
  if (value === "coverage_only") return "仅作覆盖";
  return "参考依据";
}

function simplifyDisplayText(value: string | null | undefined) {
  if (!value) return value ?? undefined;
  return value
    .replace(/外部可追溯证据 URL/g, "可核验来源")
    .replace(/可追溯证据 URL/g, "可核验来源")
    .replace(/来源 URL/g, "来源链接")
    .replace(/证据 URL/g, "核验来源")
    .replace(/工具返回 URL/g, "工具返回的来源链接")
    .replace(/\brdap\b/gi, "域名登记信息")
    .replace(/\bdns\b/gi, "域名解析")
    .replace(/\bjson\b/gi, "结构化结果")
    .replace(/\bsec\b/gi, "财务公开信息")
    .replace(/\bkyb\b/gi, "企业核验")
    .replace(/\bapi_error\b/gi, "查询失败")
    .replace(/\bAPI authorization failure\b/gi, "工具权限异常")
    .replace(/\bAPI\b/gi, "工具查询")
    .replace(/\bHTTP 401\b/gi, "查询权限错误")
    .replace(/\bHTTP \d{3}\b/gi, "查询返回")
    .replace(/\bMX\b/gi, "收信设置")
    .replace(/\bSPF\b/gi, "发信设置")
    .replace(/\bDMARC\b/gi, "邮件安全设置")
    .replace(/\bendpoint\b/gi, "查询入口")
    .replace(/\bprovider\b/gi, "工具")
    .replace(/\bobjectClassName\b/g, "对象类型")
    .replace(/\bself link\b/gi, "来源链接")
    .replace(/\blookup\b/gi, "查询")
    .replace(/\bredirected\b/gi, "跳转")
    .replace(/\breturned\b/gi, "返回")
    .replace(/\binvalid_mailbox\b/gi, "邮箱不可达")
    .replace(/\bundeliverable\b/gi, "邮箱不可达");
}

function riskTierForScore(score?: number | null): CustomerScreeningReport["riskTier"] {
  if (typeof score !== "number") return "insufficient_evidence";
  if (score >= 80) return "trusted_candidate";
  if (score >= 60) return "cautious";
  return "high_risk";
}

function reportForCustomer(item: CustomerListItem): CustomerScreeningReport | null {
  if (item.screeningReport) return item.screeningReport;
  if (item.screeningStatus !== "screened" && item.screeningStatus !== "insufficient_evidence") return null;
  return {
    reportId: item.reportId ?? item.customerId,
    riskTier: riskTierForScore(item.normalizedScore),
    normalizedScore: item.normalizedScore ?? null,
    evidenceCoverage: undefined,
    recommendedAction: simplifyDisplayText(item.recommendedAction) ?? "复核背调结果后再决定是否跟进。",
    scoreBlocks: [],
    evidence: item.sourceUrls.map((url) => ({
      layer: "public_footprint",
      sourceUrl: url,
      finding: simplifyDisplayText(item.evidenceSummary) ?? "暂无核验说明。",
      scoreBlock: "public_footprint",
      scoreImpact: "neutral",
      affectsScore: true,
    })),
    coverageGaps: [],
  };
}

function needsChatRecordSupplement(item: CustomerListItem) {
  return (
    (item.source === "accio_handoff" || item.source === "manual_screening") &&
    item.screeningStatus === "insufficient_evidence"
  );
}

function evidenceByLayer(evidence: CustomerEvidenceItem[]) {
  const grouped = new Map<ScreeningEvidenceLayer, CustomerEvidenceItem[]>();
  for (const item of evidence) {
    grouped.set(item.layer, [...(grouped.get(item.layer) ?? []), item]);
  }
  return grouped;
}

function foundAtInRange(foundAt: string, range: FoundRange) {
  if (range === "all") return true;
  const foundDate = parseCustomerDate(foundAt);
  if (!foundDate) return true;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  if (range === "today") start.setHours(0, 0, 0, 0);
  if (range === "7d") start.setDate(end.getDate() - 6);
  if (range === "30d") start.setDate(end.getDate() - 29);
  return foundDate >= start && foundDate <= end;
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function countCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function leadInputFromSelection(selection: LeadSelectionState): EmployeeLeadTaskInput {
  const products = leadProductOptions.filter((item) => selection.productIds.includes(item.id));
  const buyerTypes = leadBuyerTypeOptions.filter((item) => selection.buyerTypeIds.includes(item.id));
  const countries = leadCountryOptions.filter((item) => selection.countryCodes.includes(item.code));
  const excludedDomains = leadExcludeDomainOptions
    .filter((item) => selection.excludeDomainIds.includes(item.id))
    .flatMap((item) => item.domains);

  return {
    productKeywords: products.map((item) => item.keyword).join(", "),
    countries: countries.map((item) => item.code).join(", "),
    buyerTypes: buyerTypes.map((item) => item.keyword).join(", "),
    targetCount: selection.targetCount,
    maxResultsPerQuery: selection.maxResultsPerQuery,
    excludeDomains: unique(excludedDomains).join(", "),
  };
}

function screeningOptionsFromState(options: ScreeningOptionState): EmployeeScreeningTaskOptions {
  return {
    paidEmailValidation: options.paidEmailValidation,
    paidTradeData: options.paidTradeData,
    maxPaidSpendUsd: options.maxPaidSpendUsd,
  };
}

function InfoTooltip({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 leading-5">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ChoiceButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      title={description}
      className="h-auto min-h-8 justify-start whitespace-normal text-left leading-5"
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      {label}
    </Button>
  );
}

function ScreeningOptionControls({
  options,
  setOptions,
}: {
  options: ScreeningOptionState;
  setOptions: Dispatch<SetStateAction<ScreeningOptionState>>;
}) {
  return (
    <section className="space-y-2">
      <div className="inline-flex items-center gap-1.5 text-sm font-medium">
        核验范围与费用
        <InfoTooltip>默认只查公开资料。开启付费查询可能更完整，也会增加费用。</InfoTooltip>
      </div>
      <label className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm">
        <span>
          <span className="font-medium">邮箱验证</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            找到官网邮箱后，再用付费服务判断邮箱是否可信。
          </span>
        </span>
        <input
          type="checkbox"
          checked={options.paidEmailValidation}
          onChange={(event) =>
            setOptions((current) => ({
              ...current,
              paidEmailValidation: event.target.checked,
            }))
          }
        />
      </label>
      <label className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm">
        <span>
          <span className="font-medium">贸易数据</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            可用时查询贸易记录；额度是硬上限，不是预计花费。查不到时只提示缺口，不当作负面结论。
          </span>
        </span>
        <input
          type="checkbox"
          checked={options.paidTradeData}
          onChange={(event) =>
            setOptions((current) => ({
              ...current,
              paidTradeData: event.target.checked,
              maxPaidSpendUsd: event.target.checked ? Math.max(current.maxPaidSpendUsd, 5) : 0,
            }))
          }
        />
      </label>
      {options.paidTradeData ? (
        <FilterGroup title="单次付费额度上限">
          {[1, 5, 10, 15].map((amount) => (
            <Button
              key={amount}
              type="button"
              variant={options.maxPaidSpendUsd === amount ? "default" : "outline"}
              size="sm"
              onClick={() => setOptions((current) => ({ ...current, maxPaidSpendUsd: amount }))}
            >
              ${amount}
            </Button>
          ))}
        </FilterGroup>
      ) : null}
    </section>
  );
}

export default function CrossBorderCustomersPage() {
  return (
    <Suspense fallback={null}>
      <CrossBorderCustomersPageContent />
    </Suspense>
  );
}

function CrossBorderCustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const { client, state } = useGateway();
  const { data: leadAgent, loading: leadLoading } = useAgent("cbe-lead-discovery");
  const { data: screeningAgent, loading: screeningLoading } = useAgent("cbe-buyer-screening");
  const rows = useCbeEmployeeStore((store) => store.rows);
  const setRows = useCbeEmployeeStore((store) => store.setRows);
  const deleteRows = useCbeEmployeeStore((store) => store.deleteRows);
  const tasks = useCbeEmployeeStore((store) => store.tasks);
  const setTasks = useCbeEmployeeStore((store) => store.setTasks);
  const startTask = useCbeEmployeeStore((store) => store.startTask);
  const updateTaskProgress = useCbeEmployeeStore((store) => store.updateTaskProgress);
  const completeTask = useCbeEmployeeStore((store) => store.completeTask);
  const failTask = useCbeEmployeeStore((store) => store.failTask);
  const cancelTask = useCbeEmployeeStore((store) => store.cancelTask);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = usePersistentUiState<CustomerListItem["screeningStatus"] | "all">(
    CUSTOMER_STATUS_FILTER_STORAGE_KEY,
    "all",
    isCustomerStatusFilter,
  );
  const [scoreSort, setScoreSort] = usePersistentUiState<ScoreSort>(
    CUSTOMER_SCORE_SORT_STORAGE_KEY,
    "none",
    isScoreSort,
  );
  const [filters, setFilters] = usePersistentUiState<CustomerFilters>(
    CUSTOMER_FILTERS_STORAGE_KEY,
    emptyFilters,
    isCustomerFilters,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [activeCustomer, setActiveCustomer] = useState<CustomerListItem | null>(null);
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [newlyAddedCustomerIds, setNewlyAddedCustomerIds] = useState<Set<string>>(() => new Set());
  const [expandedProductRows, setExpandedProductRows] = useState<Set<string>>(() => new Set());
  const handledHighlightRequestRef = useRef<string | null>(null);
  const highlightTaskId = searchParams.get("highlightTask");
  const highlightCustomerId = searchParams.get("highlightCustomer");
  const customerHighlightScope = normalizeCustomerHighlightScope(searchParams.get("highlight"));
  const customerHighlightRange = normalizeCustomerHighlightRange(searchParams.get("highlightRange"));
  const leadRunning = tasks.some((task) => task.kind === "lead" && isCbeEmployeeTaskActive(task));
  const screeningRunning = tasks.some((task) => task.kind === "screening" && isCbeEmployeeTaskActive(task));

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleProductsExpanded = (customerId: string) => {
    setExpandedProductRows((current) => {
      const next = new Set(current);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const flashNewCustomers = (customerIds: string[]) => {
    const ids = Array.from(new Set(customerIds.filter(Boolean)));
    if (ids.length === 0) return;
    setNewlyAddedCustomerIds(new Set(ids));
  };

  const clearCustomerHighlight = (customerId: string) => {
    setNewlyAddedCustomerIds((current) => {
      if (!current.has(customerId)) return current;
      const next = new Set(current);
      next.delete(customerId);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const [customers, latestTasks] = await Promise.all([
          fetchEmployeeCustomers(),
          fetchEmployeeTasks(),
        ]);
        if (cancelled) return;
        setRows(customers);
        setTasks(latestTasks);
        setSelectedIds((current) => current.filter((customerId) => customers.some((item) => item.customerId === customerId)));
      } catch (error) {
        if (!cancelled) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "客户列表读取失败。",
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
    const highlightRequestKey = [
      highlightTaskId ?? "",
      highlightCustomerId ?? "",
      customerHighlightScope ?? "",
      customerHighlightRange,
    ].join("|");
    const hasHighlightRequest = Boolean(highlightTaskId || highlightCustomerId || customerHighlightScope);
    if (!hasHighlightRequest || handledHighlightRequestRef.current === highlightRequestKey || rows.length === 0) return;
    let ids: string[] = [];
    if (highlightCustomerId) {
      ids = rows.some((item) => item.customerId === highlightCustomerId) ? [highlightCustomerId] : [];
    } else if (highlightTaskId) {
      ids = taskAffectedCustomerIds(highlightTaskId, rows, tasks);
    } else if (customerHighlightScope) {
      ids = highlightedCustomerIdsForScope(rows, customerHighlightScope, customerHighlightRange);
    }
    if (ids.length === 0) return;
    handledHighlightRequestRef.current = highlightRequestKey;
    setQuery("");
    setFilters(customerHighlightScope === "trusted" ? { ...emptyFilters, scoreTiers: ["high"] } : emptyFilters);
    setStatusFilter(customerHighlightScope === "screening-results" ? "screened" : "all");
    flashNewCustomers(ids);
    window.requestAnimationFrame(() => {
      const rowCandidates = Array.from(document.querySelectorAll<HTMLElement>(customerRowSelector(ids[0])));
      const visibleRow = rowCandidates.find((element) => element.getClientRects().length > 0) ?? rowCandidates[0];
      visibleRow?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    showNotice(`已定位 ${ids.length} 个相关客户。`, "info");
  }, [customerHighlightRange, customerHighlightScope, highlightCustomerId, highlightTaskId, rows, tasks]);

  const filterOptions = useMemo(() => {
    const countryMap = new Map<string, string>();
    const buyerTypes = new Map<string, string>();
    const products = new Map<string, string>();
    for (const item of rows) {
      countryMap.set(item.country, item.countryName);
      const buyerTypeValue = canonicalBuyerType(item.buyerType);
      if (buyerTypeValue) buyerTypes.set(buyerTypeValue, buyerTypeLabel(item.buyerType));
      item.products.forEach((product) => {
        const productValue = canonicalProduct(product);
        if (productValue) products.set(productValue, productLabel(product));
      });
    }
    return {
      countries: Array.from(countryMap.entries()).map(([code, name]) => ({ code, name })),
      buyerTypes: Array.from(buyerTypes.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
      products: Array.from(products.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visibleRows = rows.filter((item) => {
      const matchesCountry = filters.countries.length === 0 || filters.countries.includes(item.country);
      const itemBuyerType = canonicalBuyerType(item.buyerType);
      const matchesBuyerType = filters.buyerTypes.length === 0 || filters.buyerTypes.includes(itemBuyerType);
      const itemProductValues = item.products.map(canonicalProduct);
      const matchesProduct =
        filters.products.length === 0 ||
        itemProductValues.some((product) => filters.products.includes(product));
      const matchesFoundAt = foundAtInRange(item.foundAt, filters.foundRange);
      const matchesScoreTier =
        filters.scoreTiers.length === 0 ||
        (item.scoreTier !== undefined && filters.scoreTiers.includes(item.scoreTier));
      const matchesQuery =
        !normalized ||
        item.companyName.toLowerCase().includes(normalized) ||
        item.products.join(" ").toLowerCase().includes(normalized) ||
        item.products.map(productLabel).join(" ").toLowerCase().includes(normalized) ||
        buyerTypeLabel(item.buyerType).toLowerCase().includes(normalized) ||
        item.countryName.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === "all" || item.screeningStatus === statusFilter;
      return (
        matchesCountry &&
        matchesBuyerType &&
        matchesProduct &&
        matchesFoundAt &&
        matchesScoreTier &&
        matchesQuery &&
        matchesStatus
      );
    });
    if (scoreSort === "none") return visibleRows;
    return [...visibleRows].sort((a, b) => {
      const aScore = comparableScore(a);
      const bScore = comparableScore(b);
      const left = aScore ?? (scoreSort === "score_desc" ? -Infinity : Infinity);
      const right = bScore ?? (scoreSort === "score_desc" ? -Infinity : Infinity);
      return scoreSort === "score_desc" ? right - left : left - right;
    });
  }, [filters, query, rows, scoreSort, statusFilter]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    for (const code of filters.countries) {
      const label = filterOptions.countries.find((item) => item.code === code)?.name ?? code;
      chips.push({
        key: `country-${code}`,
        label: `国家：${label}`,
        clear: () => setFilters((current) => ({ ...current, countries: current.countries.filter((item) => item !== code) })),
      });
    }
    for (const buyerType of filters.buyerTypes) {
      const label = filterOptions.buyerTypes.find((item) => item.value === buyerType)?.label ?? buyerType;
      chips.push({
        key: `type-${buyerType}`,
        label: `类型：${label}`,
        clear: () => setFilters((current) => ({ ...current, buyerTypes: current.buyerTypes.filter((item) => item !== buyerType) })),
      });
    }
    for (const product of filters.products) {
      const label = filterOptions.products.find((item) => item.value === product)?.label ?? product;
      chips.push({
        key: `product-${product}`,
        label: `产品：${label}`,
        clear: () => setFilters((current) => ({ ...current, products: current.products.filter((item) => item !== product) })),
      });
    }
    if (filters.foundRange !== "all") {
      chips.push({
        key: "foundRange",
        label: `找到时间：${foundRangeLabels[filters.foundRange]}`,
        clear: () => setFilters((current) => ({ ...current, foundRange: "all" })),
      });
    }
    for (const tier of filters.scoreTiers) {
      chips.push({
        key: `tier-${tier}`,
        label: `评分：${scoreTierLabels[tier]}`,
        clear: () => setFilters((current) => ({ ...current, scoreTiers: current.scoreTiers.filter((item) => item !== tier) })),
      });
    }
    if (statusFilter !== "all") {
      chips.push({
        key: `status-${statusFilter}`,
        label: `状态：${statusLabels[statusFilter]}`,
        clear: () => setStatusFilter("all"),
      });
    }
    if (scoreSort !== "none") {
      chips.push({
        key: "score-sort",
        label: `排序：${scoreSortLabels[scoreSort]}`,
        clear: () => setScoreSort("none"),
      });
    }
    return chips;
  }, [filterOptions.buyerTypes, filterOptions.countries, filterOptions.products, filters, scoreSort, statusFilter]);

  const selectedCustomers = rows.filter((item) => selectedIds.includes(item.customerId));
  const selectedScreeningCustomers = selectedCustomers.filter((item) => !needsChatRecordSupplement(item));
  const deleteTargets = deleteIntent
    ? rows.filter((item) => deleteIntent.customerIds.includes(item.customerId))
    : [];
  const canRunLead = state === "connected" && !!leadAgent;
  const canRunScreening = state === "connected" && !!screeningAgent;
  const checkingLeadAgent = state === "connected" && leadLoading;
  const activeFilterCount = activeFilterChips.length;
  const latestLeadFailure = useMemo(
    () =>
      tasks
        .filter((task) => task.kind === "lead" && task.status === "failed")
        .sort((left, right) => right.updatedAt - left.updatedAt)[0],
    [tasks],
  );
  const isCurrentDatabaseEmpty = rows.length === 0;

  const showNotice = (text: string, tone: "success" | "error" | "info" = "success", timeoutMs = 4000) => {
    setNotice({ tone, text });
    if (timeoutMs > 0) {
      window.setTimeout(() => {
        setNotice((current) => (current?.text === text ? null : current));
      }, timeoutMs);
    }
  };

  const refreshDbBackedLists = async () => {
    const [customers, latestTasks] = await Promise.all([
      fetchEmployeeCustomers(),
      fetchEmployeeTasks(),
    ]);
    setRows(customers);
    setTasks(latestTasks);
    setSelectedIds((current) => current.filter((customerId) => customers.some((item) => item.customerId === customerId)));
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

  const openDetail = (item: CustomerListItem) => {
    setActiveCustomer(item);
    setSheetMode("detail");
  };

  const openMemoryRefresh = (item: CustomerListItem) => {
    setSheetMode(null);
    const params = new URLSearchParams({
      supplementCustomer: item.customerId,
      supplementCompany: item.companyName,
      supplementSource: item.source,
    });
    if (item.source === "accio_handoff") {
      params.set("highlightRecord", item.customerId);
    }
    router.push(`/client-demos/cross-border/employee/memory?${params.toString()}`);
  };

  const openBulkScreening = () => {
    const skippedCount = selectedCustomers.length - selectedScreeningCustomers.length;
    if (selectedScreeningCustomers.length === 0) {
      showNotice("证据不足的聊天记录或手动录入客户，需要先补充聊天记录，再送到背调。", "info", 6000);
      return;
    }
    if (skippedCount > 0) {
      showNotice(`已跳过 ${skippedCount} 个需补充聊天记录的客户；其余客户可继续背调。`, "info", 6000);
    }
    setSheetMode("bulk");
  };

  const requestDeleteCustomers = (customerIds: string[], source: DeleteIntent["source"]) => {
    const existingIds = Array.from(new Set(customerIds)).filter((customerId) =>
      rows.some((item) => item.customerId === customerId),
    );
    if (existingIds.length === 0) {
      showNotice("没有可删除的客户。", "info");
      return;
    }
    setDeleteIntent({ customerIds: existingIds, source });
    setSheetMode("delete");
  };

  const confirmDeleteCustomers = async () => {
    if (!deleteIntent) return;
    const ids = deleteIntent.customerIds;
    const count = ids.length;
    try {
      await deleteEmployeeCustomers(ids);
      deleteRows(ids);
      setSelectedIds((current) => current.filter((customerId) => !ids.includes(customerId)));
      if (activeCustomer && ids.includes(activeCustomer.customerId)) {
        setActiveCustomer(null);
      }
      setDeleteIntent(null);
      setSheetMode(null);
      await refreshDbBackedLists();
      showNotice(`已删除 ${count} 个客户。`, "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "客户删除失败。", "error", 8000);
    }
  };

  const toggleSelected = (customerId: string) => {
    setSelectedIds((current) =>
      current.includes(customerId)
        ? current.filter((item) => item !== customerId)
        : [...current, customerId],
    );
  };

  const submitLeadTask = async (input: EmployeeLeadTaskInput) => {
    if (leadRunning) {
      showNotice("已有获客任务正在运行，完成后可再次启动获客。", "info");
      return;
    }
    const normalizedInput = {
      ...input,
      targetCount: normalizeLeadTargetCount(input.targetCount),
    };
    if (!input.productKeywords || !input.countries || !input.buyerTypes) {
      showNotice("请至少选择一个产品、一个买家类型和一个国家。", "error");
      return;
    }
    if (!Number.isFinite(normalizedInput.targetCount) || normalizedInput.targetCount < 1) {
      showNotice("目标数量必须大于 0，最多 20 个。", "error");
      return;
    }
    if (!canRunLead) {
      showNotice(
        state === "connected"
          ? "客户搜索暂不可用，请先完成系统初始化。"
          : "系统暂未连接，暂时不能执行找客户任务。",
        "error",
      );
      return;
    }
    let nextSessionKey = createPlannedEmployeeSessionKey(LEAD_AGENT_ID);
    let taskId: string | undefined;
    let createdRun: Awaited<ReturnType<typeof createEmployeeLeadRun>> | null = null;
    let abortSignal: AbortSignal | undefined;
    let totalSaved = 0;
    let totalReturned = 0;
    let totalDuplicates = 0;
    const savedCustomerIds: string[] = [];
    setSheetMode(null);
    try {
      let nextInput: EmployeeLeadTaskInput = normalizedInput;
      for (let attempt = 1; attempt <= MAX_LEAD_COMPLETION_ATTEMPTS; attempt++) {
        createdRun = await createEmployeeLeadRun(nextInput, nextSessionKey);
        const decision = createdRun.coordinatorDecision;
        if (decision.action === "offer_near_duplicate_choices") {
          const message = totalSaved > 0
            ? `已新增 ${totalSaved} 个唯一客户；仍有相似获客任务正在运行，剩余缺口稍后可继续补查。`
            : "已有相似获客任务正在运行，请稍后补充未分配客户或缩小条件后重试。";
          showNotice(message, "info", 8000);
          await refreshDbBackedLists().catch(() => undefined);
          return;
        }
        if (decision.action === "join_existing") {
          const message = totalSaved > 0
            ? `已新增 ${totalSaved} 个唯一客户；相同条件仍有任务在运行，系统没有重复搜索。`
            : "已有相同找客户任务正在运行，本次不会重复搜索。";
          showNotice(message, "info", 8000);
          await refreshDbBackedLists().catch(() => undefined);
          return;
        }
        if (!createdRun.agentRun || !createdRun.leadRun) {
          showNotice("获客协调器没有返回可执行任务，请稍后重试。", "error", 8000);
          return;
        }
        if (createdRun.agentRun.status === "queued" || !createdRun.agentRun.sessionKey) {
          const queuedMessage = totalSaved > 0
            ? `已新增 ${totalSaved} 个唯一客户；剩余补足任务已进入排队中。`
            : "当前任务较多，找客户任务已进入排队；系统不会重复启动相同任务。";
          showNotice(queuedMessage, "info", 8000);
          await refreshDbBackedLists().catch(() => undefined);
          return;
        }

        const coordinatorDenylist = decision.action === "start_new_run" || decision.action === "queue_top_up"
          ? decision.denylist ?? []
          : [];
        const runInput: EmployeeLeadTaskInput = {
          ...(decision.action === "queue_top_up"
            ? {
                ...normalizedInput,
                targetCount: Math.max(1, decision.missingCount ?? nextInput.targetCount),
                runMode: "top_up_unique_leads" as const,
                alreadyCoveredQueries: nextInput.alreadyCoveredQueries ?? [],
              }
            : nextInput),
          existingIdentityKeys: Array.from(new Set([
            ...(nextInput.existingIdentityKeys ?? []),
            ...coordinatorDenylist,
          ])).sort(),
        };
        const estimatedMs = estimateLeadTaskDurationMs(runInput);
        const activeSessionKey = createdRun.agentRun.sessionKey;
        const localTaskId = startTask({
          id: createdRun.agentRun.id,
          kind: "lead",
          title: decision.action === "queue_top_up" || attempt > 1 ? "补充获客" : "寻找客户",
          message: decision.action === "queue_top_up" || attempt > 1
            ? `第 ${attempt} 轮补充找客户已启动，会避开已有客户。`
            : coordinatorDenylist.length > 0
              ? `找客户任务已启动，已避开 ${coordinatorDenylist.length} 个已有客户。`
              : "找客户任务已启动，正在准备搜索。",
          estimatedMs,
          timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
          sessionKey: activeSessionKey,
          targetLabel: `${countCsv(input.productKeywords)} 类产品 / ${countCsv(input.countries)} 个国家`,
        });
        taskId = localTaskId;
        abortSignal = createCbeEmployeeTaskAbortSignal(localTaskId);
        const result = await runLeadDiscoveryTask(
          client,
          {
            ...runInput,
          },
          createProgressHandler(localTaskId),
          { sessionKey: activeSessionKey, signal: abortSignal },
        );
        const completion = await completeEmployeeLeadRun({
          leadRunId: createdRun.leadRun.id,
          agentRunId: createdRun.agentRun.id,
          sessionKey: result.sessionKey,
          payload: result.payload,
        });
        const reconciliation = completion.reconciliation;
        const newUniqueCount = reconciliation.newUniqueCount;
        const duplicateCount = reconciliation.duplicateCount;
        const returnedCount = reconciliation.returnedCount;
        totalSaved += newUniqueCount;
        totalReturned += returnedCount;
        totalDuplicates += duplicateCount;
        savedCustomerIds.push(...completion.candidates.map((candidate) => candidate.id));
        const attemptMessage = `第 ${attempt} 轮返回 ${returnedCount} 个候选，新增 ${newUniqueCount} 个唯一客户${
          duplicateCount > 0 ? `，跳过 ${duplicateCount} 个重复客户` : ""
        }${reconciliation.missingCount > 0 ? `，还差 ${reconciliation.missingCount} 个` : ""}。`;
        completeTask(localTaskId, newUniqueCount, attemptMessage, result.sessionKey);
        clearCbeEmployeeTaskAbortSignal(localTaskId);
        taskId = undefined;
        abortSignal = undefined;

        const remainingCount = Math.max(0, normalizedInput.targetCount - totalSaved);
        if (!reconciliation.topUpNeeded || remainingCount <= 0) {
          break;
        }
        if (attempt >= MAX_LEAD_COMPLETION_ATTEMPTS) {
          break;
        }
        showNotice(`还差 ${remainingCount} 个客户，正在自动补查第 ${attempt + 1} 轮。`, "info", 7000);
        nextInput = {
          ...normalizedInput,
          targetCount: remainingCount,
          runMode: "top_up_unique_leads",
          existingIdentityKeys: reconciliation.identityDenylist,
          alreadyCoveredQueries: [],
        };
        nextSessionKey = createPlannedEmployeeSessionKey(LEAD_AGENT_ID);
      }
      const finalMessage = totalSaved >= normalizedInput.targetCount
        ? `获客完成：新增 ${totalSaved} 个唯一客户${
            totalDuplicates > 0 ? `，已跳过 ${totalDuplicates} 个重复客户` : ""
          }。`
        : `获客暂时只新增 ${totalSaved}/${normalizedInput.targetCount} 个唯一客户${
            totalDuplicates > 0 ? `，已跳过 ${totalDuplicates} 个重复客户` : ""
          }；共找到 ${totalReturned} 个候选，公开来源暂时不足以补齐。`;
      await refreshDbBackedLists();
      flashNewCustomers(savedCustomerIds);
      showNotice(finalMessage, totalSaved >= normalizedInput.targetCount ? "success" : "error", totalSaved >= normalizedInput.targetCount ? 5000 : 12000);
    } catch (error) {
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      if (isEmployeeTaskCancellation(error)) {
        if (taskId) cancelTask(taskId, message, sessionKey ?? nextSessionKey);
        await refreshDbBackedLists().catch(() => undefined);
        showNotice(message, "info", 6000);
        return;
      }
      if (createdRun?.agentRun && shouldWriteFailure(error)) {
        await failEmployeeTaskInDb({
          agentRunId: createdRun.agentRun.id,
          sessionKey: sessionKey ?? nextSessionKey,
          error,
          message,
        }).catch(() => undefined);
      }
      if (taskId) failTask(taskId, message, sessionKey ?? nextSessionKey);
      await refreshDbBackedLists().catch(() => undefined);
      showNotice(message, "error", 0);
    } finally {
      if (taskId) clearCbeEmployeeTaskAbortSignal(taskId);
    }
  };

  const submitScreeningTask = async (
    targets: CustomerListItem[],
    options?: EmployeeScreeningTaskOptions,
  ) => {
    const runnableTargets = targets.filter((item) => !needsChatRecordSupplement(item));
    if (runnableTargets.length !== targets.length) {
      showNotice("证据不足的聊天记录移交/手动录入客户需要先补充聊天记录，重新分析后再送到背调。", "info", 6000);
    }
    if (runnableTargets.length === 0) return;
    if (screeningRunning) {
      showNotice("已有背调任务正在运行，完成后可再次启动背调。", "info");
      return;
    }
    if (!canRunScreening) {
      showNotice(
        state === "connected"
          ? "背调功能暂不可用，请先完成系统初始化。"
          : "系统暂未连接，暂时不能执行背调任务。",
        "error",
      );
      return;
    }
    const screeningTargets = customersToScreeningTargets(runnableTargets);
    if (screeningTargets.length === 0) {
      showNotice("请先选择至少一个客户。", "error");
      return;
    }
    const ids = new Set(runnableTargets.map((item) => item.customerId));
    const plannedSessionKey = createPlannedEmployeeSessionKey(SCREENING_AGENT_ID);
    const estimatedMs = estimateScreeningTaskDurationMs(screeningTargets, options);
    let taskId: string | undefined;
    let createdRun: Awaited<ReturnType<typeof createEmployeeScreeningRun>> | null = null;
    let abortSignal: AbortSignal | undefined;
    setSheetMode(null);
    try {
      createdRun = await createEmployeeScreeningRun(screeningTargets, plannedSessionKey, options);
      const initialChildRuns = createdRun.childRuns?.length
        ? createdRun.childRuns
        : [{
            batchTargetId: "",
            targetOrder: 1,
            status: createdRun.agentRun.status,
            agentRun: createdRun.agentRun,
            target: screeningTargets[0],
          }];
      const hasRunnableChild = initialChildRuns.some((child) => child.agentRun.status !== "queued" && child.agentRun.sessionKey);
      if (!hasRunnableChild) {
        showNotice("当前任务较多，背调任务已进入排队；系统不会重复启动超出容量的任务。", "info", 8000);
        await refreshDbBackedLists().catch(() => undefined);
        return;
      }
      const localTaskId = startTask({
        id: createdRun.agentRun.id,
        kind: "screening",
        title: runnableTargets.length > 1 ? "批量背调" : "单个背调",
        message: runnableTargets.length > 1
          ? `批量背调已拆分为 ${runnableTargets.length} 个单客户任务。`
          : "背调任务已启动，正在核验客户资料。",
        estimatedMs,
        timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
        sessionKey: createdRun.agentRun.sessionKey ?? initialChildRuns.find((child) => child.agentRun.sessionKey)?.agentRun.sessionKey ?? plannedSessionKey,
        targetLabel: `${runnableTargets.length} 个客户`,
      });
      taskId = localTaskId;
      abortSignal = createCbeEmployeeTaskAbortSignal(localTaskId);
      setRows((current) =>
        current.map((item) =>
          ids.has(item.customerId) ? { ...item, screeningStatus: "running" } : item,
        ),
      );
      let currentChildren = initialChildRuns;
      let failedChildren = 0;
      let savedReports = 0;
      let queuedRemaining = createdRun.batch?.aggregate.queued ?? currentChildren.filter((child) => child.agentRun.status === "queued").length;
      let lastSessionKey = plannedSessionKey;

      const runChild = async (child: (typeof initialChildRuns)[number]) => {
        const activeSessionKey = child.agentRun.sessionKey;
        if (child.agentRun.status === "queued" || !activeSessionKey) return { status: "queued" as const, count: 0 };
        const childLabel = child.target.company_name ?? child.agentRun.targetSummary ?? `第 ${child.targetOrder} 个客户`;
        try {
          const result = await runScreeningTask(
            client,
            [child.target],
            options,
            (progress) => {
              createProgressHandler(localTaskId)({
                ...progress,
                message: `${childLabel}：${progress.message}`,
              });
            },
            { sessionKey: activeSessionKey, signal: abortSignal },
          );
          const savedResult = await completeEmployeeScreeningRun({
            agentRunId: child.agentRun.id,
            sessionKey: result.sessionKey,
            payload: result.payload,
          });
          lastSessionKey = result.sessionKey;
          const savedReportCount = Array.isArray(savedResult.reports) ? savedResult.reports.length : 0;
          return { status: "completed" as const, count: Math.max(savedReportCount, result.records.length) };
        } catch (error) {
          const message = employeeTaskErrorMessage(error);
          const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : activeSessionKey;
          if (isEmployeeTaskCancellation(error)) {
            await cancelEmployeeTaskInDb({
              id: child.agentRun.id,
              sessionKey,
            }).catch(() => undefined);
            throw error;
          }
          if (shouldWriteFailure(error)) {
            await failEmployeeTaskInDb({
              agentRunId: child.agentRun.id,
              sessionKey,
              error,
              message,
            }).catch(() => undefined);
          }
          return { status: "failed" as const, count: 0, message };
        }
      };

      while (currentChildren.length > 0) {
        const activeChildren = currentChildren.filter((child) => child.agentRun.status !== "queued" && child.agentRun.sessionKey);
        if (activeChildren.length === 0) break;
        updateTaskProgress(localTaskId, {
          status: "running",
          message: `正在执行 ${activeChildren.length} 个单客户背调子任务。`,
          sessionKey: activeChildren[0]?.agentRun.sessionKey ?? lastSessionKey,
        });
        const childResults = await Promise.all(activeChildren.map((child) => runChild(child)));
        failedChildren += childResults.filter((item) => item.status === "failed").length;
        savedReports += childResults.reduce((sum, item) => sum + item.count, 0);
        await refreshDbBackedLists().catch(() => undefined);
        if (!createdRun.batch?.id) break;
        const drained = await claimEmployeeQueuedScreeningRuns({
          screeningBatchId: createdRun.batch.id,
          limit: 3,
        });
        queuedRemaining = drained.queuedRemaining;
        currentChildren = drained.childRuns;
      }

      if (savedReports === 0 && failedChildren > 0 && queuedRemaining === 0) {
        const message = `批量背调失败：${failedChildren} 个子任务未完成。`;
        failTask(localTaskId, message, lastSessionKey);
        showNotice(message, "error", 0);
        await refreshDbBackedLists().catch(() => undefined);
        return;
      }
      const message = queuedRemaining > 0
        ? `已完成 ${savedReports} 份背调报告，${queuedRemaining} 个子任务仍在排队。`
        : failedChildren > 0
          ? `已完成 ${savedReports} 份背调报告，${failedChildren} 个子任务失败，可稍后重试。`
          : `已完成 ${savedReports} 份背调报告，客户评分已更新。`;
      completeTask(localTaskId, savedReports, message, lastSessionKey);
      await refreshDbBackedLists();
      showNotice(message, failedChildren > 0 || queuedRemaining > 0 ? "info" : "success", 8000);
    } catch (error) {
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      if (isEmployeeTaskCancellation(error)) {
        if (taskId) cancelTask(taskId, message, sessionKey ?? plannedSessionKey);
        await refreshDbBackedLists().catch(() => undefined);
        showNotice(message, "info", 6000);
        return;
      }
      setRows((current) =>
        current.map((item) =>
          ids.has(item.customerId) ? { ...item, screeningStatus: "failed" } : item,
        ),
      );
      if (createdRun && shouldWriteFailure(error)) {
        await failEmployeeTaskInDb({
          agentRunId: createdRun.agentRun.id,
          sessionKey: sessionKey ?? plannedSessionKey,
          error,
          message,
        }).catch(() => undefined);
      }
      if (taskId) failTask(taskId, message, sessionKey ?? plannedSessionKey);
      await refreshDbBackedLists().catch(() => undefined);
      showNotice(message, "error", 0);
    } finally {
      if (taskId) clearCbeEmployeeTaskAbortSignal(taskId);
    }
  };

  const submitManualScreeningTask = async (
    input: ManualScreeningInput,
    options?: EmployeeScreeningTaskOptions,
  ) => {
    if (screeningRunning) {
      showNotice("已有背调任务正在运行，完成后可再次启动背调。", "info");
      return;
    }
    if (!input.companyName.trim() || !input.country.trim()) {
      showNotice("手动背调至少需要公司名称和国家。", "error");
      return;
    }
    if (!canRunScreening) {
      showNotice(
        state === "connected"
          ? "背调功能暂不可用，请先完成系统初始化。"
          : "系统暂未连接，暂时不能执行背调任务。",
        "error",
      );
      return;
    }
    const target = manualInputToScreeningTarget(input);
    const plannedSessionKey = createPlannedEmployeeSessionKey(SCREENING_AGENT_ID);
    const estimatedMs = estimateScreeningTaskDurationMs([target], options);
    let taskId: string | undefined;
    let createdRun: Awaited<ReturnType<typeof createEmployeeScreeningRun>> | null = null;
    let abortSignal: AbortSignal | undefined;
    setSheetMode(null);
    try {
      createdRun = await createEmployeeScreeningRun([target], plannedSessionKey, options);
      if (createdRun.agentRun.status === "queued" || !createdRun.agentRun.sessionKey) {
        showNotice("当前任务较多，手动背调已进入排队；系统不会重复启动超出容量的任务。", "info", 8000);
        await refreshDbBackedLists().catch(() => undefined);
        return;
      }
      const activeSessionKey = createdRun.agentRun.sessionKey;
      const localTaskId = startTask({
        id: createdRun.agentRun.id,
        kind: "screening",
        title: "手动背调",
        message: "手动背调任务已启动，正在核验客户资料。",
        estimatedMs,
        timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
        sessionKey: activeSessionKey,
        targetLabel: input.companyName.trim(),
      });
      taskId = localTaskId;
      abortSignal = createCbeEmployeeTaskAbortSignal(localTaskId);
      const result = await runScreeningTask(
        client,
        [target],
        options,
        createProgressHandler(localTaskId),
        { sessionKey: activeSessionKey, signal: abortSignal },
      );
      const savedResult = await completeEmployeeScreeningRun({
        agentRunId: createdRun.agentRun.id,
        sessionKey: result.sessionKey,
        payload: result.payload,
      });
      const savedReportCount = Array.isArray(savedResult.reports) ? savedResult.reports.length : 0;
      const completedCount = Math.max(savedReportCount, result.records.length);
      const message = `手动背调已完成，已新增/更新 ${completedCount} 个客户。`;
      completeTask(localTaskId, completedCount, message, result.sessionKey);
      await refreshDbBackedLists();
      showNotice(message);
    } catch (error) {
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      if (isEmployeeTaskCancellation(error)) {
        if (taskId) cancelTask(taskId, message, sessionKey ?? plannedSessionKey);
        await refreshDbBackedLists().catch(() => undefined);
        showNotice(message, "info", 6000);
        return;
      }
      if (createdRun && shouldWriteFailure(error)) {
        await failEmployeeTaskInDb({
          agentRunId: createdRun.agentRun.id,
          sessionKey: sessionKey ?? plannedSessionKey,
          error,
          message,
        }).catch(() => undefined);
      }
      if (taskId) failTask(taskId, message, sessionKey ?? plannedSessionKey);
      await refreshDbBackedLists().catch(() => undefined);
      showNotice(message, "error", 0);
    } finally {
      if (taskId) clearCbeEmployeeTaskAbortSignal(taskId);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">获客与背调</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {filtered.length} 个客户，筛选条件：{statusFilter === "all" ? "全部状态" : statusLabels[statusFilter]} ·{" "}
            {scoreSortLabels[scoreSort]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSheetMode("lead")} disabled={leadRunning}>
            {checkingLeadAgent || leadRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            寻找客户
          </Button>
          <Button variant="outline" onClick={openBulkScreening} disabled={selectedCustomers.length === 0 || screeningRunning}>
            {screeningRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            批量背调
          </Button>
          <Button variant="outline" onClick={() => setSheetMode("manual")} disabled={screeningRunning}>
            <Plus className="h-4 w-4" />
            手动背调
          </Button>
          <Button
            variant="destructive"
            onClick={() => requestDeleteCustomers(selectedCustomers.map((item) => item.customerId), "bulk")}
            disabled={selectedCustomers.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            删除所选{selectedCustomers.length > 0 ? `（${selectedCustomers.length}）` : ""}
          </Button>
        </div>
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
                placeholder="按公司名称搜索"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSheetMode("filters")}>
                <Filter className="h-3.5 w-3.5" />
                国家 / 类型 / 产品
                {activeFilterCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </Button>
              {quickStatusFilters.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "all" ? "全部" : statusLabels[status]}
                </Button>
              ))}
              <label className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-sm text-muted-foreground">
                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                <select
                  aria-label="评分排序"
                  value={scoreSort}
                  onChange={(event) => setScoreSort(event.target.value as ScoreSort)}
                  className="h-full bg-transparent text-sm font-medium text-foreground outline-none"
                >
                  {(["none", "score_desc", "score_asc"] as const).map((sort) => (
                    <option key={sort} value={sort}>
                      {scoreSortLabels[sort]}
                    </option>
                  ))}
                </select>
              </label>
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
                setScoreSort("none");
              }}>
                <RotateCcw className="h-3.5 w-3.5" />
                重置筛选
              </Button>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center">
              <div className="text-sm font-medium">
                {isCurrentDatabaseEmpty ? "客户库还没有客户" : "没有符合条件的客户"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {isCurrentDatabaseEmpty && latestLeadFailure
                  ? `最近一次找客户失败，未写入客户：${latestLeadFailure.message}`
                  : isCurrentDatabaseEmpty
                    ? "点击“寻找客户”后，找到的客户会显示在这里。"
                    : "调整筛选条件，或点击“寻找客户”启动新的任务。"}
              </p>
              {isCurrentDatabaseEmpty && latestLeadFailure?.sessionKey ? (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">查看诊断信息</summary>
                  <p className="mt-1 font-mono">失败任务 {latestLeadFailure.sessionKey}</p>
                </details>
              ) : null}
              <Button className="mt-4" size="sm" onClick={() => setSheetMode("lead")}>
                <Search className="h-4 w-4" />
                寻找客户
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:hidden">
                {filtered.map((item) => {
                  const isNewlyAdded = newlyAddedCustomerIds.has(item.customerId);
                  const requiresMemoryRefresh = needsChatRecordSupplement(item);
                  return (
                    <CustomerMobileCard
                      key={item.customerId}
	                      item={item}
	                      selected={selectedIds.includes(item.customerId)}
	                      isNewlyAdded={isNewlyAdded}
	                      toggleSelected={toggleSelected}
	                      openDetail={openDetail}
	                      clearHighlight={clearCustomerHighlight}
                        openMemoryRefresh={requiresMemoryRefresh ? () => openMemoryRefresh(item) : undefined}
	                      startScreening={() => {
                        setSelectedIds([item.customerId]);
                        setSheetMode("bulk");
                      }}
                      productsExpanded={expandedProductRows.has(item.customerId)}
                      toggleProductsExpanded={() => toggleProductsExpanded(item.customerId)}
                    />
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-md border lg:block">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left" />
                      <th className="px-3 py-2 text-left">公司名称</th>
                      <th className="px-3 py-2 text-left">国家</th>
                      <th className="px-3 py-2 text-left">类型</th>
                      <th className="px-3 py-2 text-left">产品</th>
                      <th className="px-3 py-2 text-left">网站</th>
                      <th className="px-3 py-2 text-left">找到时间</th>
                      <th className="px-3 py-2 text-left">评分</th>
                      <th className="px-3 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const itemWorkflowBadge = workflowBadge(item);
                      const isNewlyAdded = newlyAddedCustomerIds.has(item.customerId);
                      const requiresMemoryRefresh = needsChatRecordSupplement(item);
                      return (
	                      <tr
	                        key={item.customerId}
	                        data-customer-id={item.customerId}
	                        onMouseDown={() => clearCustomerHighlight(item.customerId)}
	                        className={cn("border-t align-top transition-colors", rowClass(item, isNewlyAdded))}
	                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`选择 ${item.companyName}`}
                            checked={selectedIds.includes(item.customerId)}
                            onChange={() => toggleSelected(item.customerId)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <button type="button" className="text-left" onClick={() => openDetail(item)}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{item.companyName}</span>
                              {itemWorkflowBadge ? (
                                <Badge variant="outline" className={cn("gap-1 text-[11px]", itemWorkflowBadge.className)}>
                                  {itemWorkflowBadge.icon === "check" ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  ) : null}
                                  {itemWorkflowBadge.label ? <span>{itemWorkflowBadge.label}</span> : null}
                                </Badge>
                              ) : null}
                            </div>
	                            <div className="text-xs text-muted-foreground">{customerSubtitle(item)}</div>
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <div>{item.country}</div>
                          <div className="text-xs text-muted-foreground">{item.countryName}</div>
                        </td>
                        <td className="px-3 py-3">{buyerTypeLabel(item.buyerType)}</td>
                        <td className="px-3 py-3">
                          <CustomerProductBadges
                            products={item.products}
                            expanded={expandedProductRows.has(item.customerId)}
                            onToggle={() => toggleProductsExpanded(item.customerId)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          {item.website ? (
                            <a href={item.website} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary">
                              {item.website.replace(/^https?:\/\//, "")}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">未提供</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">{formatBeijingDateTime(item.foundAt)}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={cn("whitespace-nowrap", statusBadgeClass(item))}>
                            {scoreLabel(item)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openDetail(item)}>
                              <Eye className="h-3.5 w-3.5" />
                              {item.screeningStatus === "screened" ? "查看报告" : item.screeningStatus === "running" ? "查看进度" : "详情"}
                            </Button>
                              {requiresMemoryRefresh ? (
                                <Button variant="outline" size="sm" onClick={() => openMemoryRefresh(item)}>
                                  <Plus className="h-3.5 w-3.5" />
                                  补充聊天记录
                                </Button>
                              ) : item.screeningStatus === "not_started" || item.screeningStatus === "insufficient_evidence" ? (
	                              <Button variant="outline" size="sm" onClick={() => {
	                                setSelectedIds([item.customerId]);
	                                setSheetMode("bulk");
	                              }}>
	                                开始调研
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

      <TaskSheet
	        mode={sheetMode}
	        onOpenChange={(open) => {
	          if (!open) {
	            setSheetMode(null);
	            setDeleteIntent(null);
	          }
	        }}
	        activeCustomer={activeCustomer}
	        selectedCustomers={selectedScreeningCustomers}
	        deleteTargets={deleteTargets}
	        canRunLead={canRunLead}
        canRunScreening={canRunScreening}
        gatewayConnected={state === "connected"}
        screeningLoading={screeningLoading}
        filters={filters}
        setFilters={setFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        scoreSort={scoreSort}
        setScoreSort={setScoreSort}
        filterOptions={filterOptions}
        activeFilterCount={activeFilterCount}
        leadRunning={leadRunning}
	        screeningRunning={screeningRunning}
	        onLeadSubmit={submitLeadTask}
	        onScreeningSubmit={submitScreeningTask}
	        onManualSubmit={submitManualScreeningTask}
	        onDeleteConfirm={confirmDeleteCustomers}
	      />
    </div>
  );
}

function CustomerMobileCard({
  item,
  selected,
  isNewlyAdded,
  toggleSelected,
  openDetail,
  clearHighlight,
  openMemoryRefresh,
  startScreening,
  productsExpanded,
  toggleProductsExpanded,
}: {
  item: CustomerListItem;
  selected: boolean;
  isNewlyAdded: boolean;
  toggleSelected: (customerId: string) => void;
  openDetail: (item: CustomerListItem) => void;
  clearHighlight: (customerId: string) => void;
  openMemoryRefresh?: () => void;
  startScreening: () => void;
  productsExpanded: boolean;
  toggleProductsExpanded: () => void;
}) {
  const itemWorkflowBadge = workflowBadge(item);
  return (
    <div
      data-customer-id={item.customerId}
      onMouseDown={() => clearHighlight(item.customerId)}
      className={cn("rounded-md border p-3 text-sm transition-colors", rowClass(item, isNewlyAdded))}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={() => openDetail(item)}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.companyName}</span>
            {itemWorkflowBadge ? (
              <Badge variant="outline" className={cn("gap-1 text-[11px]", itemWorkflowBadge.className)}>
                {itemWorkflowBadge.icon === "check" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : null}
                {itemWorkflowBadge.label ? <span>{itemWorkflowBadge.label}</span> : null}
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {customerSubtitle(item, { includeCountry: true, includeBuyerType: true })}
          </div>
        </button>
        <input
          type="checkbox"
          aria-label={`选择 ${item.companyName}`}
          checked={selected}
          onChange={() => toggleSelected(item.customerId)}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <CustomerProductBadges
          products={item.products}
          expanded={productsExpanded}
          onToggle={toggleProductsExpanded}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">找到时间</div>
          <div className="font-mono">{formatBeijingDateTime(item.foundAt)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">评分</div>
          <Badge variant="outline" className={cn("mt-1 whitespace-nowrap", statusBadgeClass(item))}>
            {scoreLabel(item)}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openDetail(item)}>
          <Eye className="h-3.5 w-3.5" />
          {item.screeningStatus === "screened" ? "查看报告" : "详情"}
        </Button>
        {openMemoryRefresh ? (
          <Button variant="outline" size="sm" onClick={openMemoryRefresh}>
            <Plus className="h-3.5 w-3.5" />
            补充聊天记录
          </Button>
        ) : item.screeningStatus === "not_started" || item.screeningStatus === "insufficient_evidence" ? (
          <Button size="sm" onClick={startScreening}>
            <ShieldCheck className="h-3.5 w-3.5" />
            开始调研
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function scoreSegmentClass(block: CustomerScoreBlock) {
  if (block.status === "scored") return "bg-emerald-500";
  if (block.status === "not_applicable") return "bg-slate-300";
  if (block.status === "disabled_by_budget") return "bg-amber-400";
  if (block.status === "unavailable_api") return "bg-zinc-400";
  return "bg-sky-300";
}

function statusText(status: CustomerScoreBlock["status"]) {
  const labels: Record<CustomerScoreBlock["status"], string> = {
    scored: "已评分",
    not_applicable: "不适用",
    unavailable_api: "暂不可用",
    disabled_by_budget: "未开启",
    pending_human_input: "待补充",
  };
  return labels[status];
}

function ScoreBreakdownChart({ blocks }: { blocks: CustomerScoreBlock[] }) {
  const displayBlocks = blocks.length > 0 ? blocks : [];
  const maxTotal = displayBlocks.reduce((sum, block) => sum + block.maxPoints, 0);
  if (displayBlocks.length === 0 || maxTotal <= 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        本次报告暂未返回评分来源。
      </div>
    );
  }
  const earnedTotal = displayBlocks.reduce(
    (sum, block) => sum + (block.status === "scored" ? block.earnedPoints ?? 0 : 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-full bg-muted">
        <div className="flex h-3 w-full">
          {displayBlocks.map((block) => (
            <div
              key={block.block}
              className={scoreSegmentClass(block)}
              title={`${scoreBlockLabels[block.block] ?? block.block} · 权重 ${block.maxPoints}`}
              style={{ width: `${(block.maxPoints / maxTotal) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">评分说明</summary>
        <div className="mt-1">
          单项合计 {Number(earnedTotal.toFixed(2))} / {maxTotal}，总分会按已评分项目折算。
        </div>
      </details>
      <div className="space-y-2">
        {displayBlocks.map((block) => {
          const earned = block.status === "scored" ? block.earnedPoints ?? 0 : 0;
          const missing = Math.max(0, block.maxPoints - earned);
          return (
            <div key={block.block} className="rounded-md border p-2">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium">{scoreBlockLabels[block.block] ?? block.block}</span>
                <span className="font-mono text-muted-foreground">
                  {block.status === "scored" ? `得分 ${earned}/${block.maxPoints}` : statusText(block.status)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                {block.status === "scored" ? (
                  <>
                    <div className="bg-emerald-500" style={{ width: `${(earned / block.maxPoints) * 100}%` }} />
                    <div className="bg-rose-200" style={{ width: `${(missing / block.maxPoints) * 100}%` }} />
                  </>
                ) : (
                  <div className={scoreSegmentClass(block)} style={{ width: "100%" }} />
                )}
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {simplifyDisplayText(block.summary ?? block.reason) ?? "这一项暂无说明。"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: CustomerEvidenceItem[] }) {
  if (evidence.length === 0) {
    return <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">暂无核验依据。</div>;
  }
  return (
    <div className="space-y-2">
      {evidence.map((item, index) => (
        <div key={`${item.sourceUrl}-${index}`} className="rounded-md border px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item.scoreImpact === "negative" ? "destructive" : "outline"}>
              {scoreImpactLabel(item.scoreImpact)}
            </Badge>
            {sourceTypeLabel(item.sourceType) ? <Badge variant="secondary">{sourceTypeLabel(item.sourceType)}</Badge> : null}
            {item.costPosture ? <span className="text-xs text-muted-foreground">{item.costPosture}</span> : null}
          </div>
          <div className="mt-2 leading-6">{simplifyDisplayText(item.finding) ?? "暂无核验说明。"}</div>
          {item.sourceUrl.startsWith("http") ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              查看来源
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.scoreBlock ? <span>来源分类 {scoreBlockLabels[item.scoreBlock] ?? item.scoreBlock}</span> : null}
            {typeof item.confidence === "number" ? <span>可信度 {Math.round(item.confidence * 100)}%</span> : null}
            {item.fetchedAt ? <span>{item.fetchedAt}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportEvidenceSections({ report }: { report: CustomerScreeningReport }) {
  const grouped = evidenceByLayer(report.evidence);
  return (
    <div className="space-y-3">
      {evidenceLayerOrder.map((layer) => {
        const items = grouped.get(layer) ?? [];
        return (
          <section key={layer} className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{evidenceLayerLabels[layer]}</div>
              <Badge variant={items.length > 0 ? "secondary" : "outline"}>{items.length} 条</Badge>
            </div>
            <EvidenceList evidence={items} />
          </section>
        );
      })}
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function ReportPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-background p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function ReportDetailDialog({
  customer,
  onClose,
}: {
  customer: CustomerListItem;
  onClose: () => void;
}) {
  const report = reportForCustomer(customer);
  const riskLabel = report ? riskTierLabels[report.riskTier] ?? report.riskTier : "未背调";
  const productsLabel = customer.products.map(productLabel).join(", ") || "未记录";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-report-title"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border bg-background shadow-2xl sm:max-h-[calc(100vh-4rem)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusBadgeClass(customer)}>
                  {statusLabels[customer.screeningStatus]}
                </Badge>
                {report ? <Badge variant="secondary">{riskLabel}</Badge> : null}
              </div>
              <h2 id="customer-report-title" className="break-words text-xl font-semibold tracking-normal">
                {customer.companyName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {customer.countryName} · {buyerTypeLabel(customer.buyerType)}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="关闭报告详情" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetric label="产品兴趣" value={productsLabel} />
            <ReportMetric label="找到时间" value={formatBeijingDateTime(customer.foundAt)} />
            <ReportMetric label="综合评分" value={scoreLabel(customer)} />
            <ReportMetric label="证据覆盖" value={report ? percentLabel(report.evidenceCoverage) : "未计算"} />
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <main className="space-y-4">
              <ReportPanel
                title="背调结论"
                icon={<ShieldCheck className="h-4 w-4 text-primary" />}
              >
                <div className={cn("rounded-md border px-3 py-2 text-sm leading-6", statusBadgeClass(customer))}>
                  {simplifyDisplayText(report?.recommendedAction ?? customer.recommendedAction) ?? "暂无报告，等待背调结果。"}
                </div>
              </ReportPanel>

              {report ? (
                <>
                  <ReportPanel
                    title="评分来源"
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  >
                    <ScoreBreakdownChart blocks={report.scoreBlocks} />
                  </ReportPanel>

                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">核验依据</div>
                      <Badge variant="outline">{report.evidence.length} 条</Badge>
                    </div>
                    <ReportEvidenceSections report={report} />
                  </section>
                </>
              ) : (
                <ReportPanel
                  title="来源资料"
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                >
                  <p className="text-sm leading-6 text-muted-foreground">{simplifyDisplayText(customer.evidenceSummary) ?? "暂无核验说明。"}</p>
                  <div className="mt-3 space-y-2">
                    {customer.sourceUrls.map((url, index) => (
                      <a
                        key={url}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium text-primary hover:bg-muted/40 hover:underline"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看来源 {index + 1}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </ReportPanel>
              )}
            </main>

            <aside className="space-y-4">
              <ReportPanel title="客户概览">
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">国家 / 类型</dt>
                    <dd className="mt-1 font-medium">{customer.countryName} · {buyerTypeLabel(customer.buyerType)}</dd>
                  </div>
                  {report ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">跟进评级</dt>
                      <dd className="mt-1 font-medium">{riskLabel}</dd>
                    </div>
                  ) : null}
                  <div>
                      <dt className="text-xs text-muted-foreground">报告编号</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {report?.reportId ?? customer.reportId ?? customer.customerId}
                    </dd>
                  </div>
                </dl>
              </ReportPanel>

              {report?.coverageGaps.length ? (
                <ReportPanel title="还缺什么" icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>
                  <div className="space-y-2">
                    {report.coverageGaps.map((gap, index) => (
                      <div key={`${gap.block}-${index}`} className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-6">
                        <div className="mb-1">
                          <Badge variant="outline" className="mr-2 align-middle text-[11px]">
                            {scoreBlockLabels[gap.block] ?? gap.block}
                          </Badge>
                          <span>{gap.reason}</span>
                        </div>
                        {gap.action ? <div className="text-xs text-muted-foreground">{gap.action}</div> : null}
                      </div>
                    ))}
                  </div>
                </ReportPanel>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskSheet({
  mode,
  onOpenChange,
  activeCustomer,
  selectedCustomers,
  deleteTargets,
  canRunLead,
  canRunScreening,
  gatewayConnected,
  screeningLoading,
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  scoreSort,
  setScoreSort,
  filterOptions,
  activeFilterCount,
  leadRunning,
  screeningRunning,
  onLeadSubmit,
  onScreeningSubmit,
  onManualSubmit,
  onDeleteConfirm,
}: {
  mode: SheetMode;
  onOpenChange: (open: boolean) => void;
  activeCustomer: CustomerListItem | null;
  selectedCustomers: CustomerListItem[];
  deleteTargets: CustomerListItem[];
  canRunLead: boolean;
  canRunScreening: boolean;
  gatewayConnected: boolean;
  screeningLoading: boolean;
  filters: CustomerFilters;
  setFilters: Dispatch<SetStateAction<CustomerFilters>>;
  statusFilter: CustomerListItem["screeningStatus"] | "all";
  setStatusFilter: Dispatch<SetStateAction<CustomerListItem["screeningStatus"] | "all">>;
  scoreSort: ScoreSort;
  setScoreSort: Dispatch<SetStateAction<ScoreSort>>;
  filterOptions: {
    countries: Array<{ code: string; name: string }>;
    buyerTypes: FilterOption[];
    products: FilterOption[];
  };
  activeFilterCount: number;
  leadRunning: boolean;
  screeningRunning: boolean;
  onLeadSubmit: (input: EmployeeLeadTaskInput) => void;
  onScreeningSubmit: (customers: CustomerListItem[], options?: EmployeeScreeningTaskOptions) => void;
  onManualSubmit: (input: ManualScreeningInput, options?: EmployeeScreeningTaskOptions) => void;
  onDeleteConfirm: () => void | Promise<void>;
}) {
  const open = mode !== null;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const leadTargetInputRef = useRef<HTMLInputElement | null>(null);
  const [leadSelection, setLeadSelection] = useState<LeadSelectionState>(defaultLeadSelection);
  const [leadTargetCountText, setLeadTargetCountText] = useState(String(defaultLeadSelection.targetCount));
  const [screeningOptions, setScreeningOptions] = useState<ScreeningOptionState>(defaultScreeningOptions);
  const [manualForm, setManualForm] = useState<ManualScreeningInput>({
    companyName: "",
    country: "",
    buyerType: "",
    productInterest: "",
    website: "",
    email: "",
    contactPerson: "",
    operatorNotes: "",
  });
  const effectiveLeadTargetCount = normalizeLeadTargetCount(Number(leadTargetCountText));
  const leadEstimate = useMemo(
    () =>
      estimateLeadTaskCost({
        productCount: leadSelection.productIds.length,
        buyerTypeCount: leadSelection.buyerTypeIds.length,
        countryCount: leadSelection.countryCodes.length,
        targetCount: effectiveLeadTargetCount,
        maxResultsPerQuery: leadSelection.maxResultsPerQuery,
      }),
    [effectiveLeadTargetCount, leadSelection],
  );
  const screeningOptionsPayload = useMemo(
    () => screeningOptionsFromState(screeningOptions),
    [screeningOptions],
  );
  const bulkEstimate = useMemo(
    () =>
      estimateScreeningTaskCost({
        targetCount: Math.max(1, selectedCustomers.length),
        paidEmailValidation: screeningOptions.paidEmailValidation,
        paidTradeData: screeningOptions.paidTradeData,
        maxPaidSpendUsd: screeningOptions.maxPaidSpendUsd,
      }),
    [screeningOptions, selectedCustomers.length],
  );
  const manualEstimate = useMemo(
    () =>
      estimateScreeningTaskCost({
        targetCount: 1,
        paidEmailValidation: screeningOptions.paidEmailValidation,
        paidTradeData: screeningOptions.paidTradeData,
        maxPaidSpendUsd: screeningOptions.maxPaidSpendUsd,
      }),
    [screeningOptions],
  );
  const leadReady =
    leadSelection.productIds.length > 0 &&
    leadSelection.buyerTypeIds.length > 0 &&
    leadSelection.countryCodes.length > 0;
  const buildLeadSubmitInput = () => {
    const submittedTargetCount = normalizeLeadTargetCount(Number(leadTargetInputRef.current?.value ?? leadTargetCountText));
    const submittedSelection = {
      ...leadSelection,
      targetCount: submittedTargetCount,
    };
    setLeadTargetCountText(String(submittedTargetCount));
    setLeadSelection(submittedSelection);
    onLeadSubmit({
      ...leadInputFromSelection(submittedSelection),
      targetCount: submittedTargetCount,
    });
  };

  useEffect(() => {
    if (!open) return;
    if (mode === "lead") {
      setLeadTargetCountText(String(leadSelection.targetCount));
    }
    const resetSheetScroll = () => contentRef.current?.scrollTo({ top: 0, left: 0 });
    resetSheetScroll();
    const frame = window.requestAnimationFrame(resetSheetScroll);
    const shortDelay = window.setTimeout(resetSheetScroll, 50);
    const focusDelay = window.setTimeout(resetSheetScroll, 150);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(shortDelay);
      window.clearTimeout(focusDelay);
    };
  }, [open, mode, activeCustomer?.customerId]);

  if (mode === "detail") {
    if (!activeCustomer) return null;
    return <CustomerReportDialog customer={activeCustomer} onClose={() => onOpenChange(false)} />;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent ref={contentRef} className="w-full overflow-y-auto sm:max-w-xl">
        {mode === "filters" ? (
          <>
            <SheetHeader>
              <SheetTitle>筛选客户</SheetTitle>
              <SheetDescription>
                多个筛选条件按 AND 组合，搜索框会在筛选后继续应用。
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4">
              <FilterGroup title="国家">
                {filterOptions.countries.map((item) => (
                  <Button
                    key={item.code}
                    variant={filters.countries.includes(item.code) ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        countries: toggleValue(current.countries, item.code),
                      }))
                    }
                  >
                    {item.name}
                  </Button>
                ))}
              </FilterGroup>

              <FilterGroup title="类型">
                {filterOptions.buyerTypes.map((buyerType) => (
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
                ))}
              </FilterGroup>

              <FilterGroup title="产品">
                {filterOptions.products.map((product) => (
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
                ))}
              </FilterGroup>

              <FilterGroup title="找到时间">
                {(["all", "today", "7d", "30d"] as const).map((range) => (
                  <Button
                    key={range}
                    variant={filters.foundRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilters((current) => ({ ...current, foundRange: range }))}
                  >
                    {foundRangeLabels[range]}
                  </Button>
                ))}
              </FilterGroup>

              <FilterGroup title="是否评完">
                {sheetStatusFilters.map((status) => (
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

              <FilterGroup title="排序">
                <label className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground">
                  <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                  <select
                    aria-label="筛选抽屉评分排序"
                    value={scoreSort}
                    onChange={(event) => setScoreSort(event.target.value as ScoreSort)}
                    className="h-full bg-transparent font-medium text-foreground outline-none"
                  >
                    {(["none", "score_desc", "score_asc"] as const).map((sort) => (
                      <option key={sort} value={sort}>
                        {scoreSortLabels[sort]}
                      </option>
                    ))}
                  </select>
                </label>
              </FilterGroup>

              <FilterGroup title="评分">
                {(["high", "medium", "low"] as const).map((tier) => (
                  <Button
                    key={tier}
                    variant={filters.scoreTiers.includes(tier) ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        scoreTiers: toggleValue(current.scoreTiers, tier),
                      }))
                    }
                  >
                    {scoreTierLabels[tier]}
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
                  setScoreSort("none");
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

        {mode === "lead" ? (
          <>
            <SheetHeader>
              <SheetTitle>寻找客户</SheetTitle>
              <SheetDescription>
                选择目标后，系统会搜索真实买家公司，并把结果写回客户列表。
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4">
              <FilterGroup
                title={
                  <span className="inline-flex items-center gap-1.5">
                    选择产品
                    <InfoTooltip>要找采购这些产品的海外买家，可多选。</InfoTooltip>
                  </span>
                }
              >
                {leadProductOptions.map((product) => (
                  <ChoiceButton
                    key={product.id}
                    active={leadSelection.productIds.includes(product.id)}
                    label={product.label}
                    description={product.description}
                    onClick={() =>
                      setLeadSelection((current) => ({
                        ...current,
                        productIds: toggleValue(current.productIds, product.id),
                      }))
                    }
                  />
                ))}
              </FilterGroup>

              <FilterGroup
                title={
                  <span className="inline-flex items-center gap-1.5">
                    选择买家类型
                    <InfoTooltip>买家类型用于缩小搜索范围，避免搜到供应商、平台页或无关网站。</InfoTooltip>
                  </span>
                }
              >
                {leadBuyerTypeOptions.map((buyerType) => (
                  <ChoiceButton
                    key={buyerType.id}
                    active={leadSelection.buyerTypeIds.includes(buyerType.id)}
                    label={buyerType.label}
                    description={buyerType.description}
                    onClick={() =>
                      setLeadSelection((current) => ({
                        ...current,
                        buyerTypeIds: toggleValue(current.buyerTypeIds, buyerType.id),
                      }))
                    }
                  />
                ))}
              </FilterGroup>

              <FilterGroup
                title={
                  <span className="inline-flex items-center gap-1.5">
                    选择国家
                    <InfoTooltip>国家会影响搜索语言和后续背调资料来源。</InfoTooltip>
                  </span>
                }
              >
                {leadCountryOptions.map((country) => (
                  <ChoiceButton
                    key={country.code}
                    active={leadSelection.countryCodes.includes(country.code)}
                    label={country.label}
                    description={country.description}
                    onClick={() =>
                      setLeadSelection((current) => ({
                        ...current,
                        countryCodes: toggleValue(current.countryCodes, country.code),
                      }))
                    }
                  />
                ))}
              </FilterGroup>

              <FilterGroup
                title={
                  <span className="inline-flex items-center gap-1.5">
                    目标数量
                    <InfoTooltip>手动输入希望获得的客户数量。系统会按这个数量扩展搜索；公开来源不足时会提示原因。</InfoTooltip>
                  </span>
                }
              >
                <label className="grid w-full max-w-xs gap-1.5 text-sm">
                  <span className="text-xs text-muted-foreground">客户数（最多 {MAX_LEAD_TARGET_COUNT}）</span>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={leadTargetInputRef}
                      type="number"
                      min={1}
                      max={MAX_LEAD_TARGET_COUNT}
                      step={1}
                      inputMode="numeric"
                      aria-label="目标数量手动输入"
                      value={leadTargetCountText}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/[^\d]/g, "");
                        if (!raw) {
                          setLeadTargetCountText("");
                          return;
                        }
                        const nextCount = normalizeLeadTargetCount(Number(raw));
                        setLeadTargetCountText(String(nextCount));
                        setLeadSelection((current) => ({
                          ...current,
                          targetCount: nextCount,
                        }));
                      }}
                      onBlur={() => {
                        const nextCount = normalizeLeadTargetCount(Number(leadTargetCountText));
                        setLeadTargetCountText(String(nextCount));
                        setLeadSelection((current) => ({
                          ...current,
                          targetCount: nextCount,
                        }));
                      }}
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">个客户</span>
                  </div>
                </label>
              </FilterGroup>

              <FilterGroup
                title={
                  <span className="inline-flex items-center gap-1.5">
                    排除无效来源
                    <InfoTooltip>这些来源通常不是具体买家公司，排除后结果更干净。</InfoTooltip>
                  </span>
                }
              >
                {leadExcludeDomainOptions.map((group) => (
                  <ChoiceButton
                    key={group.id}
                    active={leadSelection.excludeDomainIds.includes(group.id)}
                    label={group.label}
                    description={group.description}
                    onClick={() =>
                      setLeadSelection((current) => ({
                        ...current,
                        excludeDomainIds: toggleValue(current.excludeDomainIds, group.id),
                      }))
                    }
                  />
                ))}
              </FilterGroup>

              <FilterGroup
                title={
                  <span className="inline-flex items-center gap-1.5">
                    单组搜索上限
                    <InfoTooltip>每组产品、买家类型、国家组合最多读取多少条搜索结果。越高越贵，也越慢。</InfoTooltip>
                  </span>
                }
              >
                {[5, 10, 20].map((count) => (
                  <Button
                    key={count}
                    type="button"
                    variant={leadSelection.maxResultsPerQuery === count ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setLeadSelection((current) => ({ ...current, maxResultsPerQuery: count }))
                    }
                  >
                    {count} 条
                  </Button>
                ))}
              </FilterGroup>

              <div className="rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                将搜索 {leadSelection.productIds.length} 类产品、{leadSelection.buyerTypeIds.length} 类买家、
                {leadSelection.countryCodes.length} 个国家，目标 {effectiveLeadTargetCount} 个客户。结果只保留具体买家公司，默认排除平台页、社媒主页、目录页和供应商目录。
              </div>

              <TaskCostNotice {...leadEstimate} />
              {!leadReady ? <SystemNotice text="请至少选择一个产品、买家类型和国家。" /> : null}
              {!gatewayConnected || !canRunLead ? (
                <SystemNotice text={gatewayConnected ? "客户搜索暂不可用，请先完成系统初始化。" : "系统暂未连接，暂时不能执行找客户任务。"} />
              ) : null}
              {leadRunning ? <SystemNotice text="已有获客任务正在运行；背调可以同时继续执行。" /> : null}
            </div>
            <SheetFooter>
              <Button disabled={!canRunLead || !leadReady || leadRunning} onClick={buildLeadSubmitInput}>
                {leadRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                提交获客任务（{effectiveLeadTargetCount} 个）
              </Button>
            </SheetFooter>
          </>
        ) : null}

        {mode === "bulk" ? (
          <>
            <SheetHeader>
              <SheetTitle>批量背调</SheetTitle>
              <SheetDescription>对已选客户启动背调，完成后自动更新评分和建议。</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-2">
                {selectedCustomers.map((item) => (
                  <div key={item.customerId} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.companyName}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.countryName} · {buyerTypeLabel(item.buyerType)}</div>
                    </div>
                    <Badge variant="outline">{statusLabels[item.screeningStatus]}</Badge>
                  </div>
                ))}
              </div>
              <ScreeningOptionControls options={screeningOptions} setOptions={setScreeningOptions} />
              <TaskCostNotice {...bulkEstimate} />
              {!gatewayConnected || !canRunScreening ? (
                <SystemNotice text={gatewayConnected ? "背调功能暂不可用，请先完成系统初始化。" : "系统暂未连接，暂时不能执行背调任务。"} />
              ) : null}
              {screeningRunning ? <SystemNotice text="已有背调任务正在运行；获客可以同时继续执行。" /> : null}
            </div>
            <SheetFooter>
              <Button
                disabled={!canRunScreening || selectedCustomers.length === 0 || screeningLoading || screeningRunning}
                onClick={() => onScreeningSubmit(selectedCustomers, screeningOptionsPayload)}
              >
                {screeningRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}
                确认背调
              </Button>
            </SheetFooter>
          </>
        ) : null}

        {mode === "manual" ? (
          <>
            <SheetHeader>
              <SheetTitle>手动背调</SheetTitle>
              <SheetDescription>录入公司基础信息后，系统会自动开始背调。</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4">
              <Input
                value={manualForm.companyName}
                onChange={(event) => setManualForm((current) => ({ ...current, companyName: event.target.value }))}
                placeholder="公司名称"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={manualForm.country}
                  onChange={(event) => setManualForm((current) => ({ ...current, country: event.target.value }))}
                  placeholder="国家，如 GB"
                />
                <Input
                  value={manualForm.buyerType}
                  onChange={(event) => setManualForm((current) => ({ ...current, buyerType: event.target.value }))}
                  placeholder="类型，如 importer"
                />
              </div>
              <Input
                value={manualForm.productInterest}
                onChange={(event) => setManualForm((current) => ({ ...current, productInterest: event.target.value }))}
                placeholder="产品兴趣"
              />
              <Input
                value={manualForm.website}
                onChange={(event) => setManualForm((current) => ({ ...current, website: event.target.value }))}
                placeholder="网站"
              />
              <Input
                value={manualForm.email}
                onChange={(event) => setManualForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="邮箱"
              />
              <Input
                value={manualForm.contactPerson}
                onChange={(event) => setManualForm((current) => ({ ...current, contactPerson: event.target.value }))}
                placeholder="联系人"
              />
              <textarea
                value={manualForm.operatorNotes}
                onChange={(event) => setManualForm((current) => ({ ...current, operatorNotes: event.target.value }))}
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="备注"
              />
              <ScreeningOptionControls options={screeningOptions} setOptions={setScreeningOptions} />
              <TaskCostNotice {...manualEstimate} />
              {screeningRunning ? <SystemNotice text="已有背调任务正在运行；获客可以同时继续执行。" /> : null}
            </div>
            <SheetFooter>
              <Button disabled={!canRunScreening || screeningRunning} onClick={() => onManualSubmit(manualForm, screeningOptionsPayload)}>
                {screeningRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                创建并背调
              </Button>
            </SheetFooter>
          </>
        ) : null}

        {mode === "delete" ? (
          <>
            <SheetHeader>
              <SheetTitle>确认删除客户</SheetTitle>
              <SheetDescription>
                将从当前获客与背调列表中删除 {deleteTargets.length} 个客户。此操作不会停止已经提交的任务。
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm leading-6 text-destructive">
                删除后这些客户、背调报告和本地来源记录会从员工列表移除，当前版本没有回收站。
              </div>
              {deleteTargets.length > 0 ? (
                <div className="space-y-2">
                  {deleteTargets.map((item) => (
                    <div key={item.customerId} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.companyName}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {item.countryName} · {buyerTypeLabel(item.buyerType)} · {statusLabels[item.screeningStatus]}
                        </div>
                      </div>
                      <Badge variant="outline">{scoreLabel(item)}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  这些客户已经不在当前列表中。
                </div>
              )}
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button variant="destructive" disabled={deleteTargets.length === 0} onClick={onDeleteConfirm}>
                <Trash2 className="h-4 w-4" />
                确认删除 {deleteTargets.length} 个客户
              </Button>
            </SheetFooter>
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
  title: React.ReactNode;
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
