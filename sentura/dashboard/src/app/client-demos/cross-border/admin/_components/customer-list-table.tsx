"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  CheckCircle2,
  Eye,
  Filter,
  RotateCcw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerReportDialog } from "@/components/cross-border/customer-report-dialog";
import {
  buyerTypeLabel,
  canonicalBuyerType,
  canonicalProduct,
  productLabel,
} from "@/components/cross-border/customer-labels";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePersistentUiState } from "@/lib/use-persistent-ui-state";
import type { AdminCustomerRow } from "../_data/admin-api";
import type {
  CustomerEvidenceItem,
  CustomerListItem,
  CustomerScoreBlock,
  CustomerScreeningReport,
  ScreeningEvidenceLayer,
  ScreeningEvidenceStatus,
  ScreeningRiskTier,
  ScreeningScoreImpact,
} from "../../employee/_data/employee-data";

type JsonRecord = Record<string, unknown>;

const statusLabels: Record<CustomerListItem["screeningStatus"], string> = {
  not_started: "未背调",
  running: "背调中",
  screened: "已评分",
  insufficient_evidence: "证据不足",
  failed: "失败",
};

type AdminStatusFilter = "all" | "not_started" | "screened" | "insufficient_evidence";
type AdminScoreSort = "none" | "score_desc" | "score_asc";
interface AdminCustomerFilters {
  countries: string[];
  buyerTypes: string[];
  products: string[];
}

type FilterOption = {
  value: string;
  label: string;
};

const quickStatusFilters = ["all", "not_started", "screened", "insufficient_evidence"] as const;
const adminScoreSortValues: AdminScoreSort[] = ["none", "score_desc", "score_asc"];
const ADMIN_CUSTOMER_STATUS_FILTER_STORAGE_KEY = "sentura:cbe:admin:customer-list:status-filter:v1";
const ADMIN_CUSTOMER_SCORE_SORT_STORAGE_KEY = "sentura:cbe:admin:customer-list:score-sort:v1";
const emptyAdminFilters: AdminCustomerFilters = {
  countries: [],
  buyerTypes: [],
  products: [],
};

function isAdminStatusFilter(value: unknown): value is AdminStatusFilter {
  return typeof value === "string" && quickStatusFilters.includes(value as AdminStatusFilter);
}

function isAdminScoreSort(value: unknown): value is AdminScoreSort {
  return typeof value === "string" && adminScoreSortValues.includes(value as AdminScoreSort);
}

const scoreSortLabels: Record<AdminScoreSort, string> = {
  none: "默认排序",
  score_desc: "评分高到低",
  score_asc: "评分低到高",
};

const sourceLabels: Record<CustomerListItem["source"], string> = {
  lead_discovery: "",
  manual_screening: "手动录入",
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

const countryLabels: Record<string, string> = {
  BR: "巴西",
  CL: "智利",
  DE: "德国",
  FR: "法国",
  GB: "英国",
  MX: "墨西哥",
  US: "美国",
};

function toggleFilterValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const validEvidenceStatuses = new Set<ScreeningEvidenceStatus>([
  "scored",
  "not_applicable",
  "unavailable_api",
  "disabled_by_budget",
  "pending_human_input",
]);

const validRiskTiers = new Set<ScreeningRiskTier>([
  "trusted_candidate",
  "cautious",
  "insufficient_evidence",
  "high_risk",
]);

const validEvidenceLayers = new Set<ScreeningEvidenceLayer>(evidenceLayerOrder);

const validScoreImpacts = new Set<ScreeningScoreImpact>([
  "positive",
  "negative",
  "neutral",
  "coverage_only",
]);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sourceFromRecordType(value: string): CustomerListItem["source"] {
  if (value.includes("manual")) return "manual_screening";
  return "lead_discovery";
}

function statusFromAdmin(value: string): CustomerListItem["screeningStatus"] {
  if (value === "running" || value === "screened" || value === "insufficient_evidence" || value === "failed") return value;
  return "not_started";
}

function riskTierForScore(score?: number | null): CustomerScreeningReport["riskTier"] {
  if (typeof score !== "number") return "insufficient_evidence";
  if (score >= 80) return "trusted_candidate";
  if (score >= 60) return "cautious";
  return "high_risk";
}

function scoreTierForScore(score?: number | null): CustomerListItem["scoreTier"] | undefined {
  if (typeof score !== "number") return undefined;
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function evidenceStatus(value: unknown): ScreeningEvidenceStatus {
  const raw = asString(value);
  return validEvidenceStatuses.has(raw as ScreeningEvidenceStatus) ? (raw as ScreeningEvidenceStatus) : "pending_human_input";
}

function evidenceLayer(value: unknown): ScreeningEvidenceLayer {
  const raw = asString(value);
  return validEvidenceLayers.has(raw as ScreeningEvidenceLayer) ? (raw as ScreeningEvidenceLayer) : "public_footprint";
}

function scoreImpact(value: unknown): ScreeningScoreImpact {
  const raw = asString(value);
  return validScoreImpacts.has(raw as ScreeningScoreImpact) ? (raw as ScreeningScoreImpact) : "neutral";
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

function parseReport(row: AdminCustomerRow): CustomerScreeningReport | undefined {
  const reportJson = asRecord(row.reportJson);
  if (!row.reportJson && row.screeningStatus !== "screened" && row.screeningStatus !== "insufficient_evidence") return undefined;

  const score = row.normalizedScore ?? asNumber(reportJson.normalized_score) ?? null;
  const rawRiskTier = asString(reportJson.risk_tier);
  const riskTier = validRiskTiers.has(rawRiskTier as ScreeningRiskTier)
    ? (rawRiskTier as ScreeningRiskTier)
    : riskTierForScore(score);
  const scoreBlocks = asRecordArray(reportJson.score_blocks).map((block): CustomerScoreBlock => ({
    block: asString(block.block, "public_footprint"),
    status: evidenceStatus(block.status),
    maxPoints: asNumber(block.max_points ?? block.maxPoints) ?? 0,
    earnedPoints: asNumber(block.earned_points ?? block.earnedPoints) ?? null,
    sourceCount: asNumber(block.source_count ?? block.sourceCount),
    summary: simplifyDisplayText(asString(block.summary)) || undefined,
    reason: simplifyDisplayText(asString(block.reason)) || undefined,
  }));
  const evidence = asRecordArray(reportJson.evidence).map((item): CustomerEvidenceItem => ({
    layer: evidenceLayer(item.layer ?? item.score_block ?? item.scoreBlock),
    sourceUrl: asString(item.source_url ?? item.url ?? item.source, "-"),
    sourceType: asString(item.source_type ?? item.sourceType) || undefined,
    fetchedAt: asString(item.fetched_at ?? item.fetchedAt) || undefined,
    finding: simplifyDisplayText(asString(item.finding)) ?? "报告暂未返回这一条说明。",
    confidence: asNumber(item.confidence),
    scoreBlock: asString(item.score_block ?? item.scoreBlock) || undefined,
    scoreImpact: scoreImpact(item.score_impact ?? item.scoreImpact),
    affectsScore: item.affects_score === undefined ? true : Boolean(item.affects_score),
    costPosture: asString(item.cost_posture ?? item.costPosture) || undefined,
  }));
  const coverageGaps = asRecordArray(reportJson.coverage_gaps).map((gap) => ({
    block: asString(gap.block ?? gap.score_block, "public_footprint"),
    reason: simplifyDisplayText(asString(gap.reason ?? gap.summary)) ?? "缺少这一项核验依据。",
    action: simplifyDisplayText(asString(gap.action)) || undefined,
  }));
  const openQuestions = Array.isArray(reportJson.open_questions)
    ? reportJson.open_questions.map((question) => String(question))
    : [];

  return {
    reportId: asString(reportJson.report_id ?? row.recordId, row.recordId),
    riskTier,
    normalizedScore: score,
    evidenceCoverage: row.evidenceCoverage ?? asNumber(reportJson.evidence_coverage),
    recommendedAction: simplifyDisplayText(asString(reportJson.recommended_action, row.recommendedAction ?? "复核背调结果后再决定是否跟进。")) ?? "复核背调结果后再决定是否跟进。",
    createdAt: asString(reportJson.created_at ?? row.updatedAt) || undefined,
    scoreBlocks,
    evidence,
    coverageGaps,
    openQuestions,
  };
}

function adminCustomerToListItem(row: AdminCustomerRow): CustomerListItem {
  const country = row.country ?? "ZZ";
  const source = sourceFromRecordType(row.recordType);
  const report = parseReport(row);
  const screeningStatus = report && row.normalizedScore !== null
    ? "screened"
    : statusFromAdmin(row.screeningStatus);
  const reportTarget = asRecord(row.reportJson ? asRecord(row.reportJson).target : undefined);
  const products = row.matchedProducts.length ? row.matchedProducts : [asString(reportTarget.product_interest)].filter(Boolean);
  return {
    customerId: row.recordId,
    source,
    companyName: row.companyName,
    country,
    countryName: countryLabels[country] ?? country,
    buyerType: row.buyerType ?? (source === "manual_screening" ? "manual-input" : "buyer"),
    products,
    website: row.website ?? (row.domain ? `https://${row.domain}` : undefined),
    foundAt: row.updatedAt ?? row.createdAt,
    screeningStatus,
    normalizedScore: row.normalizedScore ?? undefined,
    scoreTier: scoreTierForScore(row.normalizedScore),
    reportId: report?.reportId,
    sourceUrls: row.website ? [row.website] : row.domain ? [`https://${row.domain}`] : [],
    evidenceSummary: simplifyDisplayText(row.recommendedAction) ?? "暂无背调结论。",
    recommendedAction: simplifyDisplayText(row.recommendedAction),
    screeningReport: report,
  };
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

function rowClass(item: CustomerListItem) {
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

function AdminFilterGroup({
  title,
  options,
  selectedValues,
  emptyText,
  onToggle,
}: {
  title: ReactNode;
  options: FilterOption[];
  selectedValues: string[];
  emptyText: string;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {options.length ? (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={selectedValues.includes(option.value) ? "default" : "outline"}
              size="sm"
              onClick={() => onToggle(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">{emptyText}</div>
      )}
    </div>
  );
}

export function AdminCustomerReportButton({
  customer,
  triggerLabel,
}: {
  customer: AdminCustomerRow;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const item = useMemo(() => adminCustomerToListItem(customer), [customer]);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={!item.screeningReport && item.screeningStatus === "not_started"}>
        <Eye className="h-3.5 w-3.5" />
        {triggerLabel ?? (item.screeningReport ? "查看报告" : item.screeningStatus === "running" ? "查看进度" : "详情")}
      </Button>
      {open ? <CustomerReportDialog customer={item} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function AdminCustomerListTable({ customers }: { customers: AdminCustomerRow[] }) {
  const [expandedProductRows, setExpandedProductRows] = useState<Set<string>>(() => new Set());
  const [activeCustomer, setActiveCustomer] = useState<CustomerListItem | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<AdminCustomerFilters>(emptyAdminFilters);
  const [statusFilter, setStatusFilter] = usePersistentUiState<AdminStatusFilter>(
    ADMIN_CUSTOMER_STATUS_FILTER_STORAGE_KEY,
    "all",
    isAdminStatusFilter,
  );
  const [scoreSort, setScoreSort] = usePersistentUiState<AdminScoreSort>(
    ADMIN_CUSTOMER_SCORE_SORT_STORAGE_KEY,
    "none",
    isAdminScoreSort,
  );
  const rows = useMemo(() => customers.map(adminCustomerToListItem), [customers]);
  const filterOptions = useMemo(() => {
    const countryMap = new Map<string, string>();
    const buyerTypes = new Map<string, string>();
    const products = new Map<string, string>();
    for (const item of rows) {
      if (item.country) countryMap.set(item.country, item.countryName);
      const buyerTypeValue = canonicalBuyerType(item.buyerType);
      if (buyerTypeValue) buyerTypes.set(buyerTypeValue, buyerTypeLabel(item.buyerType));
      item.products.forEach((product) => {
        const productValue = canonicalProduct(product);
        if (productValue) products.set(productValue, productLabel(product));
      });
    }
    return {
      countries: Array.from(countryMap.entries())
        .map(([code, name]) => ({ value: code, label: name || code }))
        .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
      buyerTypes: Array.from(buyerTypes.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
      products: Array.from(products.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
    };
  }, [rows]);
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    for (const country of filters.countries) {
      const label = filterOptions.countries.find((item) => item.value === country)?.label ?? country;
      chips.push({
        key: `country-${country}`,
        label: `国家：${label}`,
        clear: () => setFilters((current) => ({ ...current, countries: current.countries.filter((item) => item !== country) })),
      });
    }
    for (const buyerType of filters.buyerTypes) {
      const label = filterOptions.buyerTypes.find((item) => item.value === buyerType)?.label ?? buyerTypeLabel(buyerType);
      chips.push({
        key: `type-${buyerType}`,
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
    if (scoreSort !== "none") {
      chips.push({
        key: "score-sort",
        label: `排序：${scoreSortLabels[scoreSort]}`,
        clear: () => setScoreSort("none"),
      });
    }
    return chips;
  }, [filterOptions.buyerTypes, filterOptions.countries, filterOptions.products, filters, scoreSort, statusFilter, setScoreSort, setStatusFilter]);
  const activeFilterCount = activeFilterChips.length;
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = rows.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.companyName.toLowerCase().includes(normalizedQuery) ||
        item.products.join(" ").toLowerCase().includes(normalizedQuery) ||
        item.products.map(productLabel).join(" ").toLowerCase().includes(normalizedQuery) ||
        buyerTypeLabel(item.buyerType).toLowerCase().includes(normalizedQuery) ||
        item.countryName.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || item.screeningStatus === statusFilter;
      const matchesCountry = filters.countries.length === 0 || filters.countries.includes(item.country);
      const matchesBuyerType = filters.buyerTypes.length === 0 || filters.buyerTypes.includes(canonicalBuyerType(item.buyerType));
      const itemProducts = item.products.map(canonicalProduct);
      const matchesProduct = filters.products.length === 0 || itemProducts.some((product) => filters.products.includes(product));
      return matchesQuery && matchesStatus && matchesCountry && matchesBuyerType && matchesProduct;
    });
    if (scoreSort === "score_desc") {
      next.sort((a, b) => (b.normalizedScore ?? -1) - (a.normalizedScore ?? -1));
    }
    if (scoreSort === "score_asc") {
      next.sort((a, b) => (a.normalizedScore ?? 101) - (b.normalizedScore ?? 101));
    }
    return next;
  }, [filters, query, rows, scoreSort, statusFilter]);

  const toggleProductsExpanded = (customerId: string) => {
    setExpandedProductRows((current) => {
      const next = new Set(current);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        暂无客户记录。
      </div>
    );
  }

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
                placeholder="按公司名称搜索"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filtersOpen || activeFilterCount > 0 ? "default" : "outline"}
                size="sm"
                type="button"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <Filter className="h-3.5 w-3.5" />
                筛选客户
                {activeFilterCount > 0 ? `（${activeFilterCount}）` : ""}
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
                  onChange={(event) => setScoreSort(event.target.value as AdminScoreSort)}
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

          {filtersOpen ? (
            <div className="space-y-4 rounded-md border bg-muted/20 p-3">
              <div className="grid gap-4 md:grid-cols-3">
                <AdminFilterGroup
                  title="国家"
                  options={filterOptions.countries}
                  selectedValues={filters.countries}
                  emptyText="暂无国家可筛选。"
                  onToggle={(value) =>
                    setFilters((current) => ({
                      ...current,
                      countries: toggleFilterValue(current.countries, value),
                    }))
                  }
                />
                <AdminFilterGroup
                  title="类型"
                  options={filterOptions.buyerTypes}
                  selectedValues={filters.buyerTypes}
                  emptyText="暂无类型可筛选。"
                  onToggle={(value) =>
                    setFilters((current) => ({
                      ...current,
                      buyerTypes: toggleFilterValue(current.buyerTypes, value),
                    }))
                  }
                />
                <AdminFilterGroup
                  title="产品"
                  options={filterOptions.products}
                  selectedValues={filters.products}
                  emptyText="暂无产品可筛选。"
                  onToggle={(value) =>
                    setFilters((current) => ({
                      ...current,
                      products: toggleFilterValue(current.products, value),
                    }))
                  }
                />
              </div>
            </div>
          ) : null}

          {query || activeFilterCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {query ? <Badge variant="secondary">搜索：{query}</Badge> : null}
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="inline-flex items-center rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                  onClick={chip.clear}
                >
                  {chip.label}
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setFilters(emptyAdminFilters);
                  setStatusFilter("all");
                  setScoreSort("none");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置筛选
              </Button>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center">
              <div className="text-sm font-medium">没有符合条件的客户</div>
              <p className="mt-1 text-sm text-muted-foreground">调整筛选条件后查看客户记录。</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
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
                    return (
                      <tr
                        key={item.customerId}
                        data-customer-id={item.customerId}
                        className={cn("border-t align-top transition-colors", rowClass(item))}
                      >
                        <td className="px-3 py-3">
                          <button type="button" className="text-left" onClick={() => setActiveCustomer(item)}>
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
                          <Button variant="ghost" size="sm" onClick={() => setActiveCustomer(item)}>
                            <Eye className="h-3.5 w-3.5" />
                            {item.screeningReport ? "查看报告" : item.screeningStatus === "running" ? "查看进度" : "详情"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {activeCustomer ? (
        <CustomerReportDialog customer={activeCustomer} onClose={() => setActiveCustomer(null)} />
      ) : null}
    </>
  );
}
