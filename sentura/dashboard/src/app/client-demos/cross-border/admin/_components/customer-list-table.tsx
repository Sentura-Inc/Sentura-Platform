"use client";

import { useMemo, useState } from "react";
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

const quickStatusFilters = ["all", "not_started", "screened", "insufficient_evidence"] as const;
const adminScoreSortValues: AdminScoreSort[] = ["none", "score_desc", "score_asc"];
const ADMIN_CUSTOMER_STATUS_FILTER_STORAGE_KEY = "sentura:cbe:admin:customer-list:status-filter:v1";
const ADMIN_CUSTOMER_SCORE_SORT_STORAGE_KEY = "sentura:cbe:admin:customer-list:score-sort:v1";

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
  accio_handoff: "聊天记录移交",
};

const evidenceLayerOrder: ScreeningEvidenceLayer[] = [
  "legal_registry",
  "domain_rdap",
  "email_dns",
  "official_contact",
  "public_footprint",
  "trade_customs",
  "financial_public_filing",
  "accio_behavior",
];

const buyerTypeDisplayLabels: Record<string, string> = {
  "repair-chain": "维修连锁",
  "electronics-retailer": "电子零售商",
  "accessory-retailer": "配件零售商",
  "cell-phone-store": "手机门店",
  reseller: "转售采购商",
  importer: "进口采购商",
  distributor: "分销商",
  retailer: "零售商",
  "e-commerce-seller": "电商卖家",
  "manual-input": "手动录入",
  "accio-handoff": "聊天记录移交",
};

const productDisplayLabels: Record<string, string> = {
  "phone-case": "手机壳",
  "tempered-glass": "钢化膜",
  "usb-c-charger": "USB-C 充电器",
  magsafe: "MagSafe 配件",
  "repair-parts": "维修配件",
  cable: "数据线",
  "oled-screen": "OLED 屏幕",
};

const countryLabels: Record<string, string> = {
  BR: "巴西",
  CL: "智利",
  DE: "德国",
  FR: "法国",
  GB: "英国",
  MX: "墨西哥",
  US: "美国",
};

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

function normalizeFilterValue(value: string) {
  return value.trim().toLowerCase().replace(/[_/]+/g, "-").replace(/\s+/g, "-");
}

function canonicalBuyerType(value: string) {
  const normalized = normalizeFilterValue(value);
  if (!normalized) return "";
  if (normalized.includes("聊天") || normalized.includes("accio")) return "accio-handoff";
  if (normalized.includes("manual") || normalized.includes("手动")) return "manual-input";
  if (normalized.includes("repair") || normalized.includes("维修")) return "repair-chain";
  if (normalized.includes("distributor") || normalized.includes("经销") || normalized.includes("分销")) return "distributor";
  if (normalized === "retailer" || normalized.includes("零售商")) return "retailer";
  if (normalized.includes("e-commerce") || normalized.includes("电商")) return "e-commerce-seller";
  if (normalized.includes("cell-phone-store") || normalized.includes("手机门店")) return "cell-phone-store";
  if (normalized.includes("electronics-retailer") || normalized.includes("电子零售")) return "electronics-retailer";
  if (normalized.includes("accessory-retailer") || normalized.includes("配件零售")) return "accessory-retailer";
  if (normalized.includes("reseller") || normalized.includes("转售")) return "reseller";
  if (normalized.includes("importer") || normalized.includes("进口")) return "importer";
  return normalized;
}

function canonicalProduct(value: string) {
  const normalized = normalizeFilterValue(value);
  if (!normalized) return "";
  if (normalized.includes("usb-c") || normalized.includes("charger") || normalized.includes("充电")) return "usb-c-charger";
  if (normalized.includes("oled")) return "oled-screen";
  if (normalized.includes("tempered") || normalized.includes("screen-protector") || normalized.includes("钢化膜")) return "tempered-glass";
  if (normalized.includes("phone-case") || normalized.includes("手机壳")) return "phone-case";
  if (normalized.includes("repair-parts") || normalized.includes("repair-part") || normalized.includes("维修配件")) return "repair-parts";
  if (normalized.includes("magsafe")) return "magsafe";
  if (normalized === "cable" || normalized.includes("数据线")) return "cable";
  return normalized;
}

function buyerTypeLabel(value: string) {
  const canonical = canonicalBuyerType(value);
  return buyerTypeDisplayLabels[canonical] ?? value;
}

function productLabel(value: string) {
  const canonical = canonicalProduct(value);
  return productDisplayLabels[canonical] ?? value;
}

function sourceFromRecordType(value: string): CustomerListItem["source"] {
  if (value.includes("accio")) return "accio_handoff";
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
    summary: asString(block.summary) || undefined,
    reason: asString(block.reason) || undefined,
  }));
  const evidence = asRecordArray(reportJson.evidence).map((item): CustomerEvidenceItem => ({
    layer: evidenceLayer(item.layer ?? item.score_block ?? item.scoreBlock),
    sourceUrl: asString(item.source_url ?? item.url ?? item.source, "-"),
    sourceType: asString(item.source_type ?? item.sourceType) || undefined,
    fetchedAt: asString(item.fetched_at ?? item.fetchedAt) || undefined,
    finding: asString(item.finding, "员工报告未返回该证据的文字说明。"),
    confidence: asNumber(item.confidence),
    scoreBlock: asString(item.score_block ?? item.scoreBlock) || undefined,
    scoreImpact: scoreImpact(item.score_impact ?? item.scoreImpact),
    affectsScore: item.affects_score === undefined ? true : Boolean(item.affects_score),
    costPosture: asString(item.cost_posture ?? item.costPosture) || undefined,
  }));
  const coverageGaps = asRecordArray(reportJson.coverage_gaps).map((gap) => ({
    block: asString(gap.block ?? gap.score_block, "public_footprint"),
    reason: asString(gap.reason ?? gap.summary, "缺少该维度证据。"),
    action: asString(gap.action) || undefined,
  }));
  const openQuestions = Array.isArray(reportJson.open_questions)
    ? reportJson.open_questions.map((question) => String(question))
    : [];

  return {
    reportId: asString(reportJson.report_id ?? row.recordId, row.recordId),
    riskTier,
    normalizedScore: score,
    evidenceCoverage: row.evidenceCoverage ?? asNumber(reportJson.evidence_coverage),
    recommendedAction: asString(reportJson.recommended_action, row.recommendedAction ?? "复核背调结果后再决定是否跟进。"),
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
    buyerType: row.buyerType ?? (source === "accio_handoff" ? "accio-handoff" : source === "manual_screening" ? "manual-input" : "buyer"),
    products,
    website: row.website ?? (row.domain ? `https://${row.domain}` : undefined),
    foundAt: row.updatedAt ?? row.createdAt,
    screeningStatus,
    normalizedScore: row.normalizedScore ?? undefined,
    scoreTier: scoreTierForScore(row.normalizedScore),
    reportId: report?.reportId,
    sourceUrls: row.website ? [row.website] : row.domain ? [`https://${row.domain}`] : [],
    evidenceSummary: row.recommendedAction ?? "暂无背调结论。",
    recommendedAction: row.recommendedAction ?? undefined,
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
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = rows.filter((item) => {
      const matchesQuery = !normalizedQuery || item.companyName.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || item.screeningStatus === statusFilter;
      return matchesQuery && matchesStatus;
    });
    if (scoreSort === "score_desc") {
      next.sort((a, b) => (b.normalizedScore ?? -1) - (a.normalizedScore ?? -1));
    }
    if (scoreSort === "score_asc") {
      next.sort((a, b) => (a.normalizedScore ?? 101) - (b.normalizedScore ?? 101));
    }
    return next;
  }, [query, rows, scoreSort, statusFilter]);

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
              <Button variant="outline" size="sm" type="button">
                <Filter className="h-3.5 w-3.5" />
                国家 / 类型 / 产品
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

          {query || statusFilter !== "all" || scoreSort !== "none" ? (
            <div className="flex flex-wrap items-center gap-2">
              {query ? <Badge variant="secondary">搜索：{query}</Badge> : null}
              {statusFilter !== "all" ? <Badge variant="secondary">{statusLabels[statusFilter]}</Badge> : null}
              {scoreSort !== "none" ? <Badge variant="secondary">{scoreSortLabels[scoreSort]}</Badge> : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
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
              <p className="mt-1 text-sm text-muted-foreground">调整筛选条件后查看该员工的获客与背调记录。</p>
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
