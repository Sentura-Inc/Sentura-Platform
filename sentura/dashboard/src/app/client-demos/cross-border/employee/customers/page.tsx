"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CheckCircle2,
  Eye,
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
import {
  isCbeEmployeeTaskActive,
  useCbeEmployeeStore,
} from "@/stores/use-cbe-employee-store";
import {
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
  customersToScreeningTargets,
  employeeTaskErrorMessage,
  estimateEmployeeTaskTimeoutMs,
  estimateLeadTaskDurationMs,
  estimateScreeningTaskDurationMs,
  manualInputToScreeningTarget,
  runLeadDiscoveryTask,
  runScreeningTask,
  type EmployeeLeadTaskInput,
  type EmployeeScreeningTaskOptions,
  type EmployeeTaskProgress,
  type ManualScreeningInput,
} from "../_data/employee-task-runner";

type SheetMode = "lead" | "bulk" | "manual" | "detail" | "filters" | "delete" | null;

type FoundRange = "all" | "today" | "7d" | "30d";
type ScoreSort = "none" | "score_desc" | "score_asc";

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
  targetCount: 50,
  maxResultsPerQuery: 10,
  excludeDomainIds: ["marketplaces", "social", "directories", "supplier-directories"],
};

const defaultScreeningOptions: ScreeningOptionState = {
  paidEmailValidation: false,
  paidTradeData: false,
  maxPaidSpendUsd: 0,
};

function normalizeLeadTargetCount(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

const statusLabels: Record<CustomerListItem["screeningStatus"], string> = {
  not_started: "未背调",
  running: "背调中",
  screened: "已评分",
  insufficient_evidence: "证据不足",
  failed: "失败",
};

const sourceLabels: Record<CustomerListItem["source"], string> = {
  lead_discovery: "获客员工",
  manual_screening: "手动录入",
  accio_handoff: "聊天记录移交",
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
  domain_email: "域名 / 邮箱",
  public_footprint: "公开网页足迹",
  business_fit: "业务匹配",
  trade_financial: "贸易 / 财务",
  conversation_behavior: "Accio 行为记录",
};

const evidenceLayerLabels: Record<ScreeningEvidenceLayer, string> = {
  legal_registry: "公司注册信息",
  domain_rdap: "域名 / RDAP",
  email_dns: "邮箱 / DNS",
  official_contact: "官网公开联系信息",
  public_footprint: "公开网页足迹",
  trade_customs: "贸易 / 海关记录",
  financial_public_filing: "SEC / 财务公开文件",
  accio_behavior: "Accio 行为记录",
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

function rowClass(item: CustomerListItem) {
  if (item.screeningStatus === "running") return "bg-sky-50/70";
  if (item.screeningStatus === "insufficient_evidence") return "bg-zinc-50";
  if (item.scoreTier === "high") return "bg-emerald-50/70";
  if (item.scoreTier === "medium") return "bg-amber-50/70";
  if (item.scoreTier === "low" || item.screeningStatus === "failed") return "bg-rose-50/70";
  return "bg-background";
}

function statusBadgeClass(item: CustomerListItem) {
  if (item.screeningStatus === "running") return "border-sky-200 bg-sky-50 text-sky-800";
  if (item.screeningStatus === "insufficient_evidence") return "border-zinc-200 bg-zinc-50 text-zinc-800";
  if (item.scoreTier === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (item.scoreTier === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  if (item.scoreTier === "low" || item.screeningStatus === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-white text-slate-700";
}

function scoreLabel(item: CustomerListItem) {
  if (item.screeningStatus === "running") return "背调中";
  if (item.screeningStatus === "insufficient_evidence") return "证据不足";
  if (typeof item.normalizedScore === "number") return `${item.normalizedScore}/100`;
  return "未评分";
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

function reportForCustomer(item: CustomerListItem): CustomerScreeningReport | null {
  if (item.screeningReport) return item.screeningReport;
  if (item.screeningStatus !== "screened" && item.screeningStatus !== "insufficient_evidence") return null;
  return {
    reportId: item.reportId ?? item.customerId,
    riskTier: item.screeningStatus === "insufficient_evidence" ? "insufficient_evidence" : item.scoreTier === "low" ? "high_risk" : item.scoreTier === "high" ? "trusted_candidate" : "cautious",
    normalizedScore: item.normalizedScore ?? null,
    evidenceCoverage: undefined,
    recommendedAction: item.recommendedAction ?? "复核背调结果后再决定是否跟进。",
    scoreBlocks: [],
    evidence: item.sourceUrls.map((url) => ({
      layer: "public_footprint",
      sourceUrl: url,
      finding: item.evidenceSummary,
      scoreBlock: "public_footprint",
      scoreImpact: "neutral",
      affectsScore: true,
    })),
    coverageGaps: [],
  };
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
  const foundDate = new Date(foundAt.replace(" ", "T"));
  if (Number.isNaN(foundDate.getTime())) return true;
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
        证据来源与预算
        <InfoTooltip>默认只查公开资料。开启付费来源会提高命中率，也会提高预计成本。</InfoTooltip>
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
            可用时查询贸易记录；预算是硬上限，不是预计花费。没有 key 或未命中时只记为缺口。
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
        <FilterGroup title="单次付费预算上限">
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
  const { client, state } = useGateway();
  const { data: leadAgent, loading: leadLoading } = useAgent("cbe-lead-discovery");
  const { data: screeningAgent, loading: screeningLoading } = useAgent("cbe-buyer-screening");
  const rows = useCbeEmployeeStore((store) => store.rows);
  const setRows = useCbeEmployeeStore((store) => store.setRows);
  const upsertRows = useCbeEmployeeStore((store) => store.upsertRows);
  const deleteRows = useCbeEmployeeStore((store) => store.deleteRows);
  const tasks = useCbeEmployeeStore((store) => store.tasks);
  const startTask = useCbeEmployeeStore((store) => store.startTask);
  const updateTaskProgress = useCbeEmployeeStore((store) => store.updateTaskProgress);
  const completeTask = useCbeEmployeeStore((store) => store.completeTask);
  const failTask = useCbeEmployeeStore((store) => store.failTask);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerListItem["screeningStatus"] | "all">("all");
  const [scoreSort, setScoreSort] = useState<ScoreSort>("none");
  const [filters, setFilters] = useState<CustomerFilters>(emptyFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>(["cust-accio-br"]);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [activeCustomer, setActiveCustomer] = useState<CustomerListItem | null>(null);
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const leadRunning = tasks.some((task) => task.kind === "lead" && isCbeEmployeeTaskActive(task));
  const screeningRunning = tasks.some((task) => task.kind === "screening" && isCbeEmployeeTaskActive(task));

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
  const deleteTargets = deleteIntent
    ? rows.filter((item) => deleteIntent.customerIds.includes(item.customerId))
    : [];
  const canRunLead = state === "connected" && !!leadAgent;
  const canRunScreening = state === "connected" && !!screeningAgent;
  const checkingLeadAgent = state === "connected" && leadLoading;
  const activeFilterCount = activeFilterChips.length;

  const showNotice = (text: string, tone: "success" | "error" | "info" = "success", timeoutMs = 4000) => {
    setNotice({ tone, text });
    if (timeoutMs > 0) {
      window.setTimeout(() => {
        setNotice((current) => (current?.text === text ? null : current));
      }, timeoutMs);
    }
  };

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

  const confirmDeleteCustomers = () => {
    if (!deleteIntent) return;
    const ids = deleteIntent.customerIds;
    const count = ids.length;
    deleteRows(ids);
    setSelectedIds((current) => current.filter((customerId) => !ids.includes(customerId)));
    if (activeCustomer && ids.includes(activeCustomer.customerId)) {
      setActiveCustomer(null);
    }
    setDeleteIntent(null);
    setSheetMode(null);
    showNotice(`已删除 ${count} 个客户。`, "success");
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
    if (!input.productKeywords || !input.countries || !input.buyerTypes) {
      showNotice("请至少选择一个产品、一个买家类型和一个国家。", "error");
      return;
    }
    if (!Number.isFinite(input.targetCount) || input.targetCount < 1) {
      showNotice("目标数量必须大于 0。", "error");
      return;
    }
    if (!canRunLead) {
      showNotice(
        state === "connected"
          ? "获客员工还没有启动，请先完成系统初始化。"
          : "后台未连接，暂时不能执行获客任务。",
        "error",
      );
      return;
    }
    const estimatedMs = estimateLeadTaskDurationMs(input);
    const taskId = startTask({
      kind: "lead",
      title: "寻找客户",
      message: "获客任务已启动，后台员工正在准备搜索。",
      estimatedMs,
      timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
      targetLabel: `${countCsv(input.productKeywords)} 类产品 / ${countCsv(input.countries)} 个国家`,
    });
    setSheetMode(null);
    try {
      const result = await runLeadDiscoveryTask(
        client,
        {
          ...input,
          targetCount: normalizeLeadTargetCount(input.targetCount),
        },
        createProgressHandler(taskId),
      );
      upsertRows(result.records);
      const message = `获客员工已返回 ${result.records.length} 个客户，已写入当前列表。`;
      completeTask(taskId, result.records.length, message, result.sessionKey);
    } catch (error) {
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      failTask(taskId, message, sessionKey);
      showNotice(message, "error", 0);
    }
  };

  const submitScreeningTask = async (
    targets: CustomerListItem[],
    options?: EmployeeScreeningTaskOptions,
  ) => {
    if (screeningRunning) {
      showNotice("已有背调任务正在运行，完成后可再次启动背调。", "info");
      return;
    }
    if (!canRunScreening) {
      showNotice(
        state === "connected"
          ? "背调员工还没有启动，请先完成系统初始化。"
          : "后台未连接，暂时不能执行背调任务。",
        "error",
      );
      return;
    }
    const screeningTargets = customersToScreeningTargets(targets);
    if (screeningTargets.length === 0) {
      showNotice("请先选择至少一个客户。", "error");
      return;
    }
    const ids = new Set(targets.map((item) => item.customerId));
    setRows((current) =>
      current.map((item) =>
        ids.has(item.customerId) ? { ...item, screeningStatus: "running" } : item,
      ),
    );
    const estimatedMs = estimateScreeningTaskDurationMs(screeningTargets, options);
    const taskId = startTask({
      kind: "screening",
      title: targets.length > 1 ? "批量背调" : "单个背调",
      message: "背调任务已启动，后台员工正在核验证据来源。",
      estimatedMs,
      timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
      targetLabel: `${targets.length} 个客户`,
    });
    setSheetMode(null);
    try {
      const result = await runScreeningTask(client, screeningTargets, options, createProgressHandler(taskId));
      upsertRows(result.records);
      const message = `背调员工已返回 ${result.records.length} 份报告，客户评分已更新。`;
      completeTask(taskId, result.records.length, message, result.sessionKey);
    } catch (error) {
      setRows((current) =>
        current.map((item) =>
          ids.has(item.customerId) ? { ...item, screeningStatus: "failed" } : item,
        ),
      );
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      failTask(taskId, message, sessionKey);
      showNotice(message, "error", 0);
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
          ? "背调员工还没有启动，请先完成系统初始化。"
          : "后台未连接，暂时不能执行背调任务。",
        "error",
      );
      return;
    }
    const target = manualInputToScreeningTarget(input);
    const estimatedMs = estimateScreeningTaskDurationMs([target], options);
    const taskId = startTask({
      kind: "screening",
      title: "手动背调",
      message: "手动背调任务已启动，后台员工正在核验证据来源。",
      estimatedMs,
      timeoutMs: estimateEmployeeTaskTimeoutMs(estimatedMs),
      targetLabel: input.companyName.trim(),
    });
    setSheetMode(null);
    try {
      const result = await runScreeningTask(
        client,
        [target],
        options,
        createProgressHandler(taskId),
      );
      upsertRows(result.records);
      const message = `手动背调已完成，已新增/更新 ${result.records.length} 个客户。`;
      completeTask(taskId, result.records.length, message, result.sessionKey);
    } catch (error) {
      const message = employeeTaskErrorMessage(error);
      const sessionKey = error instanceof EmployeeTaskError ? error.sessionKey : undefined;
      failTask(taskId, message, sessionKey);
      showNotice(message, "error", 0);
    }
  };

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
          <Button variant="outline" onClick={() => setSheetMode("bulk")} disabled={selectedCustomers.length === 0 || screeningRunning}>
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
              <Button
                variant={scoreSort === "score_desc" ? "default" : "outline"}
                size="sm"
                onClick={() => setScoreSort((current) => (current === "score_desc" ? "none" : "score_desc"))}
              >
                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                评分高到低
              </Button>
              <Button
                variant={scoreSort === "score_asc" ? "default" : "outline"}
                size="sm"
                onClick={() => setScoreSort((current) => (current === "score_asc" ? "none" : "score_asc"))}
              >
                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                评分低到高
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
                setScoreSort("none");
              }}>
                <RotateCcw className="h-3.5 w-3.5" />
                重置筛选
              </Button>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center">
              <div className="text-sm font-medium">没有符合条件的客户</div>
              <p className="mt-1 text-sm text-muted-foreground">
                调整筛选条件，或点击“寻找客户”启动新的获客任务。
              </p>
              <Button className="mt-4" size="sm" onClick={() => setSheetMode("lead")}>
                <Search className="h-4 w-4" />
                寻找客户
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:hidden">
                {filtered.map((item) => (
                  <CustomerMobileCard
                    key={item.customerId}
                    item={item}
                    selected={selectedIds.includes(item.customerId)}
	                    toggleSelected={toggleSelected}
	                    openDetail={openDetail}
	                    requestDelete={(customerId) => requestDeleteCustomers([customerId], "single")}
	                    startScreening={() => {
                      setSelectedIds([item.customerId]);
                      setSheetMode("bulk");
                    }}
                  />
                ))}
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
                    {filtered.map((item) => (
                      <tr key={item.customerId} className={cn("border-t align-top", rowClass(item))}>
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
                            <div className="font-medium">{item.companyName}</div>
                            <div className="text-xs text-muted-foreground">{item.city ?? "城市未确认"} · {sourceLabels[item.source]}</div>
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <div>{item.country}</div>
                          <div className="text-xs text-muted-foreground">{item.countryName}</div>
                        </td>
                        <td className="px-3 py-3">{buyerTypeLabel(item.buyerType)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.products.slice(0, 2).map((product) => (
                              <Badge key={product} variant="secondary">{productLabel(product)}</Badge>
                            ))}
                            {item.products.length > 2 ? <Badge variant="outline">+{item.products.length - 2}</Badge> : null}
                          </div>
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
                        <td className="px-3 py-3">{item.foundAt}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={statusBadgeClass(item)}>
                            {scoreLabel(item)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openDetail(item)}>
                              <Eye className="h-3.5 w-3.5" />
                              {item.screeningStatus === "screened" ? "查看报告" : item.screeningStatus === "running" ? "查看进度" : "详情"}
                            </Button>
	                            {item.screeningStatus === "not_started" || item.screeningStatus === "insufficient_evidence" ? (
	                              <Button variant="outline" size="sm" onClick={() => {
	                                setSelectedIds([item.customerId]);
	                                setSheetMode("bulk");
	                              }}>
	                                开始调研
	                              </Button>
	                            ) : null}
	                            <Button
	                              variant="ghost"
	                              size="sm"
	                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
	                              onClick={() => requestDeleteCustomers([item.customerId], "single")}
	                            >
	                              <Trash2 className="h-3.5 w-3.5" />
	                              删除
	                            </Button>
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

      <TaskSheet
	        mode={sheetMode}
	        onOpenChange={(open) => {
	          if (!open) {
	            setSheetMode(null);
	            setDeleteIntent(null);
	          }
	        }}
	        activeCustomer={activeCustomer}
	        selectedCustomers={selectedCustomers}
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
  toggleSelected,
  openDetail,
  requestDelete,
  startScreening,
}: {
  item: CustomerListItem;
  selected: boolean;
  toggleSelected: (customerId: string) => void;
  openDetail: (item: CustomerListItem) => void;
  requestDelete: (customerId: string) => void;
  startScreening: () => void;
}) {
  return (
    <div className={cn("rounded-md border p-3 text-sm", rowClass(item))}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={() => openDetail(item)}>
          <div className="font-medium">{item.companyName}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {item.countryName} · {buyerTypeLabel(item.buyerType)} · {sourceLabels[item.source]}
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
        {item.products.map((product) => (
          <Badge key={product} variant="secondary">{productLabel(product)}</Badge>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">找到时间</div>
          <div className="font-mono">{item.foundAt}</div>
        </div>
        <div>
          <div className="text-muted-foreground">评分</div>
          <Badge variant="outline" className={cn("mt-1", statusBadgeClass(item))}>
            {scoreLabel(item)}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openDetail(item)}>
          <Eye className="h-3.5 w-3.5" />
          {item.screeningStatus === "screened" ? "查看报告" : "详情"}
        </Button>
        {item.screeningStatus === "not_started" || item.screeningStatus === "insufficient_evidence" ? (
          <Button size="sm" onClick={startScreening}>
            <ShieldCheck className="h-3.5 w-3.5" />
            开始调研
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => requestDelete(item.customerId)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </Button>
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
    scored: "已计分",
    not_applicable: "不适用",
    unavailable_api: "接口不可用",
    disabled_by_budget: "预算未启用",
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
        本次报告没有返回评分维度拆解。
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
              title={`${scoreBlockLabels[block.block] ?? block.block} · ${block.maxPoints} 权重`}
              style={{ width: `${(block.maxPoints / maxTotal) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        单项合计 {Number(earnedTotal.toFixed(2))} / {maxTotal}，总分按已计分维度动态归一化。
      </div>
      <div className="space-y-2">
        {displayBlocks.map((block) => {
          const earned = block.status === "scored" ? block.earnedPoints ?? 0 : 0;
          const missing = Math.max(0, block.maxPoints - earned);
          return (
            <div key={block.block} className="rounded-md border p-2">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium">{scoreBlockLabels[block.block] ?? block.block}</span>
                <span className="font-mono text-muted-foreground">
                  权重 {block.maxPoints} ·{" "}
                  {block.status === "scored" ? `单项得分 ${earned}/${block.maxPoints}` : statusText(block.status)}
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
                {block.summary ?? block.reason ?? "该维度未返回详细说明。"}
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
    return <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">本维度暂无证据。</div>;
  }
  return (
    <div className="space-y-2">
      {evidence.map((item, index) => (
        <div key={`${item.sourceUrl}-${index}`} className="rounded-md border px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item.scoreImpact === "negative" ? "destructive" : "outline"}>
              {item.scoreImpact ?? "neutral"}
            </Badge>
            {item.sourceType ? <Badge variant="secondary">{item.sourceType}</Badge> : null}
            {item.costPosture ? <span className="text-xs text-muted-foreground">{item.costPosture}</span> : null}
          </div>
          <div className="mt-2 leading-6">{item.finding}</div>
          <a
            href={item.sourceUrl.startsWith("http") ? item.sourceUrl : undefined}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all font-mono text-xs text-primary"
          >
            {item.sourceUrl}
          </a>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.scoreBlock ? <span>维度 {scoreBlockLabels[item.scoreBlock] ?? item.scoreBlock}</span> : null}
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
  onDeleteConfirm: () => void;
}) {
  const open = mode !== null;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [leadSelection, setLeadSelection] = useState<LeadSelectionState>(defaultLeadSelection);
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
  const leadTaskInput = useMemo(() => leadInputFromSelection(leadSelection), [leadSelection]);
  const leadEstimate = useMemo(
    () =>
      estimateLeadTaskCost({
        productCount: leadSelection.productIds.length,
        buyerTypeCount: leadSelection.buyerTypeIds.length,
        countryCount: leadSelection.countryCodes.length,
        targetCount: leadSelection.targetCount,
        maxResultsPerQuery: leadSelection.maxResultsPerQuery,
      }),
    [leadSelection],
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
      }),
    [screeningOptions, selectedCustomers.length],
  );
  const manualEstimate = useMemo(
    () =>
      estimateScreeningTaskCost({
        targetCount: 1,
        paidEmailValidation: screeningOptions.paidEmailValidation,
        paidTradeData: screeningOptions.paidTradeData,
      }),
    [screeningOptions],
  );
  const leadReady =
    leadSelection.productIds.length > 0 &&
    leadSelection.buyerTypeIds.length > 0 &&
    leadSelection.countryCodes.length > 0;

  useEffect(() => {
    if (!open) return;
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
                {(["none", "score_desc", "score_asc"] as const).map((sort) => (
                  <Button
                    key={sort}
                    variant={scoreSort === sort ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScoreSort(sort)}
                  >
                    {scoreSortLabels[sort]}
                  </Button>
                ))}
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
                选择目标后，由后台获客员工搜索真实买家公司，并把结果写回客户列表。
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
                    <InfoTooltip>手动输入希望获得的客户数量。后台获客员工会按这个数量扩展搜索；公开来源不足时才返回不足原因。</InfoTooltip>
                  </span>
                }
              >
                <label className="grid w-full max-w-xs gap-1.5 text-sm">
                  <span className="text-xs text-muted-foreground">客户数</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      aria-label="目标数量手动输入"
                      value={leadSelection.targetCount}
                      onChange={(event) =>
                        setLeadSelection((current) => ({
                          ...current,
                          targetCount: normalizeLeadTargetCount(Number(event.target.value)),
                        }))
                      }
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
                {leadSelection.countryCodes.length} 个国家。结果只保留具体买家公司，默认排除平台页、社媒主页、目录页和供应商目录。
              </div>

              <TaskCostNotice {...leadEstimate} />
              {!leadReady ? <SystemNotice text="请至少选择一个产品、买家类型和国家。" /> : null}
              {!gatewayConnected || !canRunLead ? (
                <SystemNotice text={gatewayConnected ? "获客员工还没有启动，请先完成系统初始化。" : "后台未连接，暂时不能执行获客任务。"} />
              ) : null}
              {leadRunning ? <SystemNotice text="已有获客任务正在运行；背调可以同时继续执行。" /> : null}
            </div>
            <SheetFooter>
              <Button disabled={!canRunLead || !leadReady || leadRunning} onClick={() => onLeadSubmit(leadTaskInput)}>
                {leadRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                提交获客任务
              </Button>
            </SheetFooter>
          </>
        ) : null}

        {mode === "bulk" ? (
          <>
            <SheetHeader>
              <SheetTitle>批量背调</SheetTitle>
              <SheetDescription>对已选客户启动后台背调，完成后自动更新评分和建议。</SheetDescription>
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
                <SystemNotice text={gatewayConnected ? "背调员工还没有启动，请先完成系统初始化。" : "后台未连接，暂时不能执行背调任务。"} />
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
              <SheetDescription>录入公司基础信息后，后台背调员工会自动开始调查。</SheetDescription>
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
                将从当前获客与背调列表中删除 {deleteTargets.length} 个客户。此操作不会停止已经提交到后台的任务。
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

        {mode === "detail" && activeCustomer ? (
          <>
            <SheetHeader>
              <SheetTitle>{activeCustomer.companyName}</SheetTitle>
              <SheetDescription>
                {activeCustomer.countryName} · {buyerTypeLabel(activeCustomer.buyerType)} · {sourceLabels[activeCustomer.source]}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              {(() => {
                const report = reportForCustomer(activeCustomer);
                return (
                  <>
              <section className="rounded-md border p-3">
                <div className="mb-2 text-sm font-medium">客户概览</div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">产品</dt>
                  <dd>{activeCustomer.products.map(productLabel).join(", ")}</dd>
                  <dt className="text-muted-foreground">找到时间</dt>
                  <dd>{activeCustomer.foundAt}</dd>
                  <dt className="text-muted-foreground">状态</dt>
                  <dd>{statusLabels[activeCustomer.screeningStatus]}</dd>
                  <dt className="text-muted-foreground">评分</dt>
                  <dd>{scoreLabel(activeCustomer)}</dd>
                  <dt className="text-muted-foreground">风险层级</dt>
                  <dd>{report ? riskTierLabels[report.riskTier] : "未背调"}</dd>
                  <dt className="text-muted-foreground">证据覆盖</dt>
                  <dd>{report ? percentLabel(report.evidenceCoverage) : "未计算"}</dd>
                </dl>
              </section>

              <section className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  背调结论
                </div>
                <div className={cn("rounded-md border px-3 py-2 text-sm", statusBadgeClass(activeCustomer))}>
                  {report?.recommendedAction ?? activeCustomer.recommendedAction ?? "暂无报告，等待背调员工返回结构化结果。"}
                </div>
              </section>

              {report ? (
                <>
                  <section className="rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      评分维度拆解
                    </div>
                    <ScoreBreakdownChart blocks={report.scoreBlocks} />
                  </section>

                  <ReportEvidenceSections report={report} />

                  {report.coverageGaps.length > 0 ? (
                    <section className="rounded-md border p-3">
                      <div className="mb-2 text-sm font-medium">证据缺口</div>
                      <div className="space-y-2">
                        {report.coverageGaps.map((gap, index) => (
                          <div key={`${gap.block}-${index}`} className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-6">
                            <div>{gap.reason}</div>
                            {gap.action ? <div className="text-xs text-muted-foreground">{gap.action}</div> : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : (
                <section className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    来源证据
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{activeCustomer.evidenceSummary}</p>
                  <div className="mt-3 space-y-2">
                    {activeCustomer.sourceUrls.map((url) => (
                      <div key={url} className="break-all rounded-md bg-muted/40 px-2 py-1.5 font-mono text-xs">
                        {url}
                      </div>
                    ))}
                  </div>
                </section>
              )}
                  </>
                );
              })()}
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
