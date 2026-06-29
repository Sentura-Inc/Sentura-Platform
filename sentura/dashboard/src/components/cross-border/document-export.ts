import { buyerTypeLabel, productLabel } from "@/components/cross-border/customer-labels";
import {
  businessStatusText,
  isCoverageGapDisplay,
  screeningCoverageGapDisplay,
  screeningEvidenceFindingText,
  screeningScoreBlockText,
  simplifyScreeningReportText,
  sourceTypeText,
} from "@/components/cross-border/screening-report-copy";
import type {
  CustomerEvidenceItem,
  CustomerListItem,
  CustomerScreeningReport,
} from "@/app/client-demos/cross-border/employee/_data/employee-data";
import type { CostEvent } from "@/lib/gateway";
import { publicReportSourceUrl } from "@/lib/cross-border-source-links";

export type ExportFormat = "docx" | "pdf";

type DocumentTable = {
  columns: string[];
  rows: string[][];
};

type DocumentSection = {
  heading: string;
  paragraphs?: string[];
  table?: DocumentTable;
};

type ExportDocument = {
  title: string;
  subtitle?: string;
  meta: Array<[string, string]>;
  summary: Array<[string, string]>;
  sections: DocumentSection[];
};

type EmployeeCostExportInput = {
  rangeLabel?: string;
  subjectLabel?: string;
  spendUsd: number;
  totalTokens: number;
  totalCalls: number;
  unpricedCalls: number;
  events: CostEvent[];
  sourceBreakdown: Array<{ label: string; amountUsd: number; note: string }>;
  scopedSessionCount: number;
  outsideScopeCount: number;
  costBudget: {
    limitUsd: number;
    limitEnabled: boolean;
    baseLimitUsd: number;
    activeAllowanceUsd: number;
    remainingUsd: number | null;
    period: string;
    source?: string;
    updatedAt?: string | null;
  };
};

type AdminCostExportInput = {
  profile: {
    user_id?: string;
    display_name?: string;
    team_name?: string | null;
    email?: string | null;
  } | null;
  summary?: {
    actual_cost_usd?: number;
    estimated_cost_usd?: number;
    base_limit_usd?: number;
    active_allowance_usd?: number;
    remaining_usd?: number;
    active_task_count?: number;
    unpriced_call_count?: number;
  } | null;
  rangeLabel: string;
  events: Record<string, unknown>[];
};

type CustomerListExportInput = {
  customers: CustomerListItem[];
  filterLabels: string[];
  totalBeforeFilter: number;
  title?: string;
};

const riskTierLabels: Record<string, string> = {
  trusted_candidate: "可信候选",
  cautious: "谨慎跟进",
  insufficient_evidence: "证据不足",
  high_risk: "高风险",
};

const scoreBlockLabels: Record<string, string> = {
  legal_identity: "公司注册与线下门店/地址",
  domain_email: "官网和邮箱",
  google_maps_local_presence: "线下地址线索",
  address_validation: "地址一致性",
  public_footprint: "公开资料",
  business_fit: "业务匹配",
  trade_financial: "贸易和财务",
  legal_disputes: "法律纠纷与案件",
};

const hiddenEvidenceLayers = new Set([
  "google_maps_local_presence",
  "address_validation",
]);

const scoreBlockStatusLabels: Record<string, string> = {
  scored: "已评分",
  not_applicable: "不适用",
  unavailable_api: "未找到资料",
  disabled_by_budget: "未开启",
  pending_human_input: "待补充",
};

const scaleClassLabels: Record<string, string> = {
  listed_or_public: "上市/公开披露企业",
  medium_large_registered: "中大型注册企业",
  small_local_offline: "中小型线下企业",
  small_online_only: "中小型线上企业",
  unknown_scale: "规模待确认",
};

const firstBlockStrategyLabels: Record<string, string> = {
  registry_disclosure_primary_maps_support: "注册/披露为主，Google Maps（谷歌地图）地址辅助",
  maps_physical_address_primary: "Google Maps（谷歌地图）物理地址和营业状态为主",
  domain_public_source_primary: "官网/公开来源为主",
  try_registry_and_maps: "注册与 Google Maps（谷歌地图）双路径待确认",
};

const addressTypeLabels: Record<string, string> = {
  headquarters_or_office: "总部 / 办公",
  storefront: "门店",
  warehouse_or_distribution: "仓库 / 分销",
  service_or_repair_location: "服务 / 维修",
  unknown_business_location: "业务地址",
};

const relationshipLabels: Record<string, string> = {
  confirmed_company_location: "已确认",
  probable_company_location: "高可能",
  possible_related_location: "待复核",
  rejected_unrelated_location: "已排除",
};

const screeningStatusLabels: Record<CustomerListItem["screeningStatus"], string> = {
  not_started: "未背调",
  running: "背调中",
  screened: "已评分",
  insufficient_evidence: "证据不足",
  failed: "失败",
};

const costAgentLabels: Record<string, string> = {
  "cbe-lead-discovery": "获客",
  "cbe-buyer-screening": "背调",
  "cbe-accio-memory": "聊天整理",
};

function normalizeText(value: unknown, fallback = "-") {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return fallback;
  const text = simplifyScreeningReportText(value)?.trim();
  return text || fallback;
}

function formatGeneratedAt() {
  return formatDateTime(new Date().toISOString());
}

function parseDate(value: string) {
  const source = value.trim();
  if (!source) return null;
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(source);
  const normalized = source.includes("T") ? source : source.replace(" ", "T");
  const date = new Date(hasExplicitZone ? normalized : `${normalized}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = parseDate(value);
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

function screeningTimeLabel(customer: CustomerListItem) {
  if (customer.screeningReport?.createdAt) return formatDateTime(customer.screeningReport.createdAt);
  if (customer.screeningStatus === "running") return "背调中";
  if (customer.screeningStatus === "failed") return "背调失败";
  if (customer.screeningStatus === "screened" || customer.screeningStatus === "insufficient_evidence") return "时间待确认";
  return "未背调";
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "未计算";
  return `${Math.round(value * 100)}%`;
}

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "US$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDurationMs(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "-";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
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
    recommendedAction: normalizeText(item.recommendedAction, "复核背调结果后再决定是否跟进。"),
    scoreBlocks: [],
    evidence: item.sourceUrls
      .map(publicReportSourceUrl)
      .filter((url): url is string => Boolean(url))
      .map((url) => ({
        layer: "public_footprint",
        sourceUrl: url,
        finding: normalizeText(item.evidenceSummary, "暂无核验说明。"),
        scoreBlock: "public_footprint",
        scoreImpact: "neutral",
        affectsScore: true,
      })),
    coverageGaps: [],
  };
}

function evidenceFindingText(item: CustomerEvidenceItem) {
  return screeningEvidenceFindingText({
    layer: item.layer,
    sourceType: item.sourceType,
    scoreBlock: item.scoreBlock,
    scoreImpact: item.scoreImpact,
    confidence: item.confidence,
    finding: item.finding,
    sourceUrl: item.sourceUrl,
  });
}

function buildCustomerReportDocument(customer: CustomerListItem): ExportDocument {
  const report = reportForCustomer(customer);
  const riskLabel = report ? riskTierLabels[report.riskTier] ?? report.riskTier : "未背调";
  const productsLabel = customer.products.map(productLabel).join("、") || "未记录";
  const scoreLabel = typeof customer.normalizedScore === "number"
    ? `${customer.normalizedScore}/100`
    : "未评分";
  const footprint = report?.addressFootprint;
  const visibleScoreBlocks = report?.scoreBlocks ?? [];
  const visibleEvidence = report?.evidence.filter((item) => !hiddenEvidenceLayers.has(item.layer)) ?? [];
  const coverageGaps = report
    ? report.coverageGaps.map(screeningCoverageGapDisplay).filter(isCoverageGapDisplay)
    : [];
  const sections: DocumentSection[] = [
    {
      heading: "背调结论",
      paragraphs: [
        normalizeText(report?.recommendedAction ?? customer.recommendedAction, "暂无报告，等待背调结果。"),
      ],
    },
  ];

  if (report?.companyScaleAssessment) {
    sections.push({
      heading: "公司规模评估",
      table: {
        columns: ["项目", "内容"],
        rows: [
          [
            "规模判断",
            scaleClassLabels[report.companyScaleAssessment.scaleClass] ?? normalizeText(report.companyScaleAssessment.scaleClass),
          ],
          [
            "核验策略",
            firstBlockStrategyLabels[report.companyScaleAssessment.firstBlockStrategy] ??
              normalizeText(report.companyScaleAssessment.firstBlockStrategy),
          ],
          ["置信度", formatPercent(report.companyScaleAssessment.confidence)],
          ["判断说明", normalizeText(report.companyScaleAssessment.rationale)],
        ],
      },
    });
  }

  sections.push({
    heading: "评分来源",
    paragraphs: visibleScoreBlocks.length ? undefined : ["本次报告暂未提供评分来源。"],
    table: visibleScoreBlocks.length
      ? {
          columns: ["维度", "状态", "得分/权重", "说明"],
          rows: visibleScoreBlocks.map((block) => [
            scoreBlockLabels[block.block] ?? block.block,
            scoreBlockStatusLabels[block.status] ?? block.status,
            block.status === "scored" ? `${block.earnedPoints ?? 0}/${block.maxPoints}` : "-",
            screeningScoreBlockText(block),
          ]),
        }
      : undefined,
  });

  if (footprint) {
    const locationRows = footprint.locations
      .filter((item) => item.relationshipStatus !== "rejected_unrelated_location")
      .slice(0, 12)
      .map((location) => [
        normalizeText(location.displayName),
        normalizeText(location.formattedAddress),
        addressTypeLabels[location.addressType] ?? normalizeText(location.addressType),
        relationshipLabels[location.relationshipStatus] ?? normalizeText(location.relationshipStatus),
        location.businessStatus ? normalizeText(businessStatusText(location.businessStatus)) : "-",
        typeof location.matchConfidence === "number" ? formatPercent(location.matchConfidence) : "待确认",
      ]);
    sections.push({
      heading: normalizeText(footprint.sectionTitle, "Google Maps（谷歌地图）地址线索"),
      paragraphs: [
        `共发现 ${footprint.summary.totalLocations} 个地址线索，其中确认 ${footprint.summary.confirmedLocations} 个，高可能 ${footprint.summary.probableLocations} 个，待复核 ${footprint.summary.possibleRelatedLocations} 个。`,
        footprint.summary.cities.length ? `覆盖城市：${footprint.summary.cities.join("、")}` : "覆盖城市：未确认",
        "地址线索用于判断实际经营地点，不能替代正式注册/KYB 结论。",
      ],
      table: locationRows.length
        ? {
            columns: ["地点", "地址", "类型", "关系", "状态", "匹配度"],
            rows: locationRows,
          }
        : undefined,
    });
  }

  sections.push({
    heading: "核验依据",
    paragraphs: visibleEvidence.length ? undefined : ["暂无核验依据。"],
    table: visibleEvidence.length
      ? {
          columns: ["类别", "来源", "判断", "可信度"],
          rows: visibleEvidence.slice(0, 30).map((item) => [
            scoreBlockLabels[item.scoreBlock ?? ""] ?? item.scoreBlock ?? "-",
            sourceTypeText(item.sourceType) ?? "公开资料",
            evidenceFindingText(item),
            typeof item.confidence === "number" ? formatPercent(item.confidence) : "待确认",
          ]),
        }
      : undefined,
  });

  if (coverageGaps.length) {
    sections.push({
      heading: "还缺什么",
      table: {
        columns: ["缺少信息", "说明", "下一步"],
        rows: coverageGaps.map((gap) => [
          gap.title,
          gap.reason,
          gap.action ?? "-",
        ]),
      },
    });
  }

  return {
    title: "Sentura 跨境电商背调报告",
    subtitle: customer.companyName,
    meta: [
      ["客户名称", customer.companyName],
      ["国家 / 类型", `${customer.countryName} / ${buyerTypeLabel(customer.buyerType)}`],
      ["产品兴趣", productsLabel],
      ["时间", `获客 ${formatDateTime(customer.foundAt)} / 背调 ${screeningTimeLabel(customer)}`],
      ["生成时间", formatGeneratedAt()],
    ],
    summary: [
      ["背调状态", screeningStatusLabels[customer.screeningStatus]],
      ["综合评分", scoreLabel],
      ["跟进评级", riskLabel],
      ["证据覆盖", report ? formatPercent(report.evidenceCoverage) : "未计算"],
    ],
    sections,
  };
}

function customerProductsLabel(customer: CustomerListItem) {
  return customer.products.map(productLabel).filter(Boolean).join("、") || "未记录";
}

function customerWebsiteLabel(customer: CustomerListItem) {
  if (!customer.website) return "未提供";
  return customer.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function customerListScoreLabel(customer: CustomerListItem) {
  if (customer.screeningStatus === "running") return "背调中";
  if (typeof customer.normalizedScore === "number") {
    const tier = customer.scoreTier === "high"
      ? "高分 · 优先跟进"
      : customer.scoreTier === "medium"
        ? "中等 · 谨慎跟进"
        : customer.scoreTier === "low"
          ? "低分 · 暂缓/高风险"
          : "已评分";
    return `${customer.normalizedScore}/100 · ${tier}`;
  }
  if (customer.screeningStatus === "insufficient_evidence") return "证据不足";
  if (customer.screeningStatus === "failed") return "背调失败";
  return "未评分";
}

function buildCustomerListDocument(input: CustomerListExportInput): ExportDocument {
  const filterText = input.filterLabels.length ? input.filterLabels.join("；") : "全部客户";
  const rows = input.customers.map((customer) => [
    customer.companyName,
    `${customer.country}\n${customer.countryName}`,
    buyerTypeLabel(customer.buyerType),
    customerProductsLabel(customer),
    customerWebsiteLabel(customer),
    `获客 ${formatDateTime(customer.foundAt)}\n背调 ${screeningTimeLabel(customer)}`,
    customerListScoreLabel(customer),
  ]);

  return {
    title: input.title ?? "Sentura 跨境电商客户列表",
    subtitle: "获客与背调",
    meta: [
      ["列表范围", "员工端客户列表"],
      ["导出结果", `${input.customers.length} 个客户`],
      ["客户总数", `${input.totalBeforeFilter} 个客户`],
      ["筛选条件", filterText],
      ["生成时间", formatGeneratedAt()],
    ],
    summary: [
      ["已筛选客户", `${input.customers.length}`],
      ["未背调", `${input.customers.filter((item) => item.screeningStatus === "not_started").length}`],
      ["已评分", `${input.customers.filter((item) => item.screeningStatus === "screened").length}`],
      ["证据不足", `${input.customers.filter((item) => item.screeningStatus === "insufficient_evidence").length}`],
      ["失败", `${input.customers.filter((item) => item.screeningStatus === "failed").length}`],
    ],
    sections: [
      {
        heading: "导出筛选条件",
        paragraphs: [
          `筛选条件：${filterText}`,
          `筛选结果：${input.customers.length} 个客户；筛选前客户总数：${input.totalBeforeFilter} 个客户。`,
        ],
      },
      {
        heading: "客户列表",
        paragraphs: rows.length
          ? ["本表按当前网页筛选条件导出；导出列项与员工端客户列表保持一致，不包含网页选择框和操作列。"]
          : ["当前筛选条件下没有客户。"],
        table: rows.length
          ? {
              columns: ["公司名称", "国家", "类型", "产品", "网站", "时间", "评分"],
              rows,
            }
          : undefined,
      },
    ],
  };
}

function employeeCostServiceLabel(event: CostEvent) {
  if ((event.kind ?? "model") === "model") return event.model;
  return event.service ?? event.provider;
}

function employeeCostUsageLabel(event: CostEvent) {
  if ((event.kind ?? "model") === "model") return `${event.usage.totalTokens.toLocaleString("zh-CN")} 用量单位`;
  if (event.externalUsage?.label) return event.externalUsage.label;
  if (event.externalUsage) return `${event.externalUsage.quantity.toLocaleString("zh-CN")} ${event.externalUsage.unit}`;
  return "-";
}

function employeeCostSourceLabel(event: CostEvent) {
  if (event.source === "external_tool_log") return "外部资料查询";
  if (event.source === "session_log") return "智能处理记录";
  return "实时记录";
}

function buildEmployeeCostDocument(input: EmployeeCostExportInput): ExportDocument {
  const rangeLabel = input.rangeLabel ?? "本月";
  const subjectLabel = input.subjectLabel ?? "员工端";
  const remaining = input.costBudget.limitEnabled
    ? formatUsd(input.costBudget.remainingUsd ?? Math.max(0, input.costBudget.limitUsd - input.spendUsd))
    : "不限额";
  const eventRows = input.events.slice(0, 200).map((event) => [
    formatDateTime(event.timestamp),
    costAgentLabels[event.agentId] ?? event.agentId,
    employeeCostServiceLabel(event),
    employeeCostSourceLabel(event),
    employeeCostUsageLabel(event),
    formatDurationMs(event.durationMs),
    event.costUsd === null ? "未折算" : formatUsd(event.costUsd),
  ]);

  return {
    title: "Sentura 跨境电商成本明细",
    subtitle: `${subjectLabel} · 工具成本（${rangeLabel}）`,
    meta: [
      ["员工", subjectLabel],
      ["范围", rangeLabel],
      ["生成时间", formatGeneratedAt()],
      ["账本口径", "仅统计已关联到当前跨境电商客户库任务的处理编号"],
      ["数据来源", input.costBudget.source === "fallback" ? "预算兜底" : "系统费用记录"],
    ],
    summary: [
      [`${rangeLabel}已用`, formatUsd(input.spendUsd)],
      ["本月额度", input.costBudget.limitEnabled ? formatUsd(input.costBudget.limitUsd) : "不限额"],
      ["剩余额度", remaining],
      ["调用次数", String(input.totalCalls)],
      ["暂未折算", `${input.unpricedCalls} 次`],
      ["智能处理用量", `${input.totalTokens.toLocaleString("zh-CN")} 用量单位`],
    ],
    sections: [
      {
        heading: "一、费用摘要",
        paragraphs: [
          input.events.length
            ? `本表展示${rangeLabel}已记录的智能处理与外部资料查询费用，已折算美元的项目计入已用费用。`
            : "当前任务还没有实际成本记录，已用费用按 0 显示。",
          input.outsideScopeCount > 0
            ? `另有 ${input.outsideScopeCount} 条历史记录不属于当前任务范围，未纳入本报告。`
            : "未发现需要排除的范围外历史记录。",
        ],
      },
      {
        heading: "二、费用来源",
        table: {
          columns: ["来源", "金额", "说明"],
          rows: input.sourceBreakdown.map((item) => [
            item.label,
            formatUsd(item.amountUsd),
            item.note,
          ]),
        },
      },
      {
        heading: "三、费用明细",
        paragraphs: eventRows.length ? undefined : ["暂无费用明细。"],
        table: eventRows.length
          ? {
              columns: ["时间", "任务", "服务项目", "来源", "用量", "耗时", "成本"],
              rows: eventRows,
            }
          : undefined,
      },
    ],
  };
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function adminCostTaskLabel(value: unknown) {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("screening")) return "背调";
  if (raw.includes("accio") || raw.includes("memory")) return "聊天整理";
  if (raw.includes("lead")) return "获客";
  return "任务";
}

function adminCostSourceLabel(value: unknown) {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("google") || raw.includes("maps") || raw.includes("places")) return "公开地址查询";
  if (raw.includes("search") || raw.includes("fetch") || raw.includes("web")) return "公开资料查询";
  if (raw.includes("external") || raw.includes("api") || raw.includes("provider")) return "工具调用";
  if (raw.includes("cbe-lead")) return "获客";
  if (raw.includes("cbe-buyer") || raw.includes("screening")) return "背调";
  if (raw.includes("cbe-accio") || raw.includes("memory")) return "聊天整理";
  return "工具调用";
}

function adminCostAmount(value: unknown, status: unknown) {
  const statusText = String(status ?? "").toLowerCase();
  if ((value === null || value === undefined || value === "") && statusText === "unpriced") return "暂未折算";
  return formatUsd(numberFromUnknown(value));
}

function adminCostEstimate(value: unknown) {
  return formatUsd(numberFromUnknown(value));
}

function buildAdminCostDocument(input: AdminCostExportInput): ExportDocument {
  const profileName = input.profile?.display_name ?? "成本明细";
  const summary = input.summary;
  const eventRows = input.events.slice(0, 200).map((event) => [
    formatDateTime(String(event.created_at ?? event.timestamp ?? "")),
    adminCostTaskLabel(event.task_kind ?? event.agent_id),
    adminCostSourceLabel(event.provider ?? event.agent_id),
    adminCostAmount(event.actual_cost_usd, event.ledger_status),
    adminCostEstimate(event.cost_usd_estimate),
    normalizeText(event.ledger_status ?? event.status, "-"),
  ]);

  return {
    title: "Sentura 跨境电商成本明细",
    subtitle: `${profileName} · ${input.rangeLabel}`,
    meta: [
      ["员工", profileName],
      ["团队", input.profile?.team_name ?? "-"],
      ["邮箱", input.profile?.email ?? "-"],
      ["范围", input.rangeLabel],
      ["生成时间", formatGeneratedAt()],
    ],
    summary: [
      ["已发生费用", formatUsd(summary?.actual_cost_usd ?? numberFromUnknown(input.events.reduce((sum, event) => sum + numberFromUnknown(event.actual_cost_usd), 0)))],
      ["预计费用", formatUsd(summary?.estimated_cost_usd ?? numberFromUnknown(input.events.reduce((sum, event) => sum + numberFromUnknown(event.cost_usd_estimate), 0)))],
      ["基础额度", formatUsd(summary?.base_limit_usd ?? 0)],
      ["临时额度", formatUsd(summary?.active_allowance_usd ?? 0)],
      ["剩余额度", formatUsd(summary?.remaining_usd ?? 0)],
      ["进行中任务", String(summary?.active_task_count ?? 0)],
      ["暂未折算", `${summary?.unpriced_call_count ?? input.events.filter((event) => String(event.ledger_status ?? "").toLowerCase() === "unpriced").length} 次`],
    ],
    sections: [
      {
        heading: "一、费用摘要",
        paragraphs: [
          "本报告与管理端费用监控使用同一员工和账本范围，展示员工最近费用记录及额度情况。",
          "已发生费用为已折算美元的实际记录；预计费用为提交前或运行中预算模型估算。",
        ],
      },
      {
        heading: "二、费用明细",
        paragraphs: eventRows.length ? undefined : ["暂无费用明细。"],
        table: eventRows.length
          ? {
              columns: ["时间", "任务", "来源", "已发生", "预计", "状态"],
              rows: eventRows,
            }
          : undefined,
      },
    ],
  };
}

export function exportCustomerReportDocument(customer: CustomerListItem, format: ExportFormat) {
  const document = buildCustomerReportDocument(customer);
  downloadExportDocument(document, format, `背调报告-${customer.companyName}`);
}

export function exportCustomerListDocument(input: CustomerListExportInput, format: ExportFormat) {
  const document = buildCustomerListDocument(input);
  downloadExportDocument(document, format, `客户列表-${input.customers.length}个客户`);
}

export function exportEmployeeCostDocument(input: EmployeeCostExportInput, format: ExportFormat) {
  const document = buildEmployeeCostDocument(input);
  downloadExportDocument(document, format, `成本明细-${input.subjectLabel ?? "员工"}-${input.rangeLabel ?? "本月"}`);
}

export function exportAdminCostDocument(input: AdminCostExportInput, format: ExportFormat) {
  const document = buildAdminCostDocument(input);
  downloadExportDocument(document, format, `成本明细-${input.profile?.display_name ?? "员工"}-${input.rangeLabel}`);
}

function downloadExportDocument(document: ExportDocument, format: ExportFormat, filenameBase: string) {
  const safeBase = safeFileName(filenameBase);
  if (format === "docx") {
    const bytes = buildDocx(document);
    downloadBlob(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", `${safeBase}.docx`);
    return;
  }
  const bytes = buildPdf(document);
  downloadBlob(bytes, "application/pdf", `${safeBase}.pdf`);
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "sentura-export";
}

function downloadBlob(bytes: Uint8Array, mimeType: string, fileName: string) {
  const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function docxTextRuns(value: string) {
  const lines = value.split(/\r?\n/);
  return lines
    .map((line, index) => `${index > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${xmlEscape(line)}</w:t>`)
    .join("");
}

function docxParagraph(value: string, style?: string) {
  const styleXml = style ? `<w:pStyle w:val="${style}"/>` : "";
  return `<w:p><w:pPr>${styleXml}<w:spacing w:before="20" w:after="120" w:line="276" w:lineRule="auto"/></w:pPr><w:r>${docxTextRuns(value)}</w:r></w:p>`;
}

function docxTableParagraph(value: string, header: boolean) {
  const runStyle = header ? "<w:b/>" : "";
  return `<w:p><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${runStyle}</w:rPr>${docxTextRuns(value)}</w:r></w:p>`;
}

function docxTable(table: DocumentTable) {
  const rows = [table.columns, ...table.rows];
  const totalWidth = 9360;
  const widths = tableColumnWidths(table, totalWidth);
  const gridXml = widths.map((width) => `<w:gridCol w:w="${Math.round(width)}"/>`).join("");
  const rowXml = rows
    .map((row, index) => {
      const cells = row
        .map((cell, cellIndex) => {
          const shading = index === 0 ? '<w:shd w:fill="EAF2FF"/>' : "";
          const width = Math.round(widths[cellIndex] ?? totalWidth / Math.max(1, table.columns.length));
          return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}<w:vAlign w:val="top"/><w:tcMar><w:top w:w="130" w:type="dxa"/><w:left w:w="130" w:type="dxa"/><w:bottom w:w="130" w:type="dxa"/><w:right w:w="130" w:type="dxa"/></w:tcMar></w:tcPr>${docxTableParagraph(cell || "-", index === 0)}</w:tc>`;
        })
        .join("");
      return `<w:tr>${cells}</w:tr>`;
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${totalWidth}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="D6DEE9"/><w:left w:val="single" w:sz="6" w:space="0" w:color="D6DEE9"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="D6DEE9"/><w:right w:val="single" w:sz="6" w:space="0" w:color="D6DEE9"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D6DEE9"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D6DEE9"/></w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${gridXml}</w:tblGrid>${rowXml}</w:tbl>`;
}

function buildDocxBody(document: ExportDocument) {
  const parts: string[] = [
    docxParagraph(document.title, "Title"),
    document.subtitle ? docxParagraph(document.subtitle, "Subtitle") : "",
    docxTable({ columns: ["项目", "内容"], rows: document.meta }),
    docxParagraph("关键摘要", "Heading1"),
    docxTable({ columns: ["指标", "结果"], rows: document.summary }),
  ];

  for (const section of document.sections) {
    parts.push(docxParagraph(section.heading, "Heading1"));
    for (const paragraph of section.paragraphs ?? []) {
      parts.push(docxParagraph(paragraph));
    }
    if (section.table) parts.push(docxTable(section.table));
  }

  return parts.filter(Boolean).join("");
}

function buildDocx(document: ExportDocument) {
  const created = new Date().toISOString();
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${buildDocxBody(document)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:sz w:val="21"/></w:rPr><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:b/><w:color w:val="17324D"/><w:sz w:val="36"/></w:rPr><w:pPr><w:spacing w:after="160"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:color w:val="56657A"/><w:sz w:val="24"/></w:rPr><w:pPr><w:spacing w:after="180"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:b/><w:color w:val="17324D"/><w:sz w:val="26"/></w:rPr><w:pPr><w:spacing w:before="320" w:after="140"/></w:pPr></w:style></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(document.title)}</dc:title><dc:creator>Sentura</dc:creator><cp:lastModifiedBy>Sentura</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Sentura Dashboard</Application></Properties>`;

  return makeZip([
    { path: "[Content_Types].xml", content: contentTypes },
    { path: "_rels/.rels", content: rels },
    { path: "word/document.xml", content: documentXml },
    { path: "word/styles.xml", content: stylesXml },
    { path: "word/_rels/document.xml.rels", content: docRels },
    { path: "docProps/core.xml", content: core },
    { path: "docProps/app.xml", content: app },
  ]);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of data) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function bytesFromString(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function headerBytes(length: number) {
  return new Uint8Array(length);
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function makeZip(files: Array<{ path: string; content: string | Uint8Array }>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = bytesFromString(file.path);
    const content = typeof file.content === "string" ? bytesFromString(file.content) : file.content;
    const crc = crc32(content);
    const localHeader = headerBytes(30);
    const localView = new DataView(localHeader.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, 0);
    writeU16(localView, 12, 0);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, content.length);
    writeU32(localView, 22, content.length);
    writeU16(localView, 26, name.length);
    writeU16(localView, 28, 0);
    localParts.push(localHeader, name, content);

    const centralHeader = headerBytes(46);
    const centralView = new DataView(centralHeader.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, 0);
    writeU16(centralView, 14, 0);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, content.length);
    writeU32(centralView, 24, content.length);
    writeU16(centralView, 28, name.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + content.length;
  }

  const centralOffset = offset;
  const centralDirectory = concatBytes(centralParts);
  const end = headerBytes(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, files.length);
  writeU16(endView, 10, files.length);
  writeU32(endView, 12, centralDirectory.length);
  writeU32(endView, 16, centralOffset);
  writeU16(endView, 20, 0);

  return concatBytes([...localParts, centralDirectory, end]);
}

function textVisualWidth(value: string) {
  return Array.from(value).reduce((sum, char) => {
    if (/[\x00-\x7f]/.test(char)) return sum + 0.55;
    return sum + 1;
  }, 0);
}

function isPdfAsciiChar(char: string) {
  return /^[\x20-\x7e]$/.test(char);
}

function pdfEscapeLiteral(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function splitPdfRuns(text: string) {
  const runs: Array<{ text: string; ascii: boolean }> = [];
  for (const char of Array.from(text)) {
    const ascii = isPdfAsciiChar(char);
    const previous = runs[runs.length - 1];
    if (previous && previous.ascii === ascii) {
      previous.text += char;
    } else {
      runs.push({ text: char, ascii });
    }
  }
  return runs;
}

function pdfAsciiWidth(value: string, fontSize: number) {
  const units = Array.from(value).reduce((sum, char) => {
    if (char === " ") return sum + 0.28;
    if (/[ilI.,:;|'`!]/.test(char)) return sum + 0.25;
    if (/[mwMW@#%&]/.test(char)) return sum + 0.78;
    return sum + 0.52;
  }, 0);
  return units * fontSize;
}

function pdfCjkWidth(value: string, fontSize: number) {
  return textVisualWidth(value) * fontSize;
}

function pdfRunWidth(run: { text: string; ascii: boolean }, fontSize: number) {
  return run.ascii ? pdfAsciiWidth(run.text, fontSize) : pdfCjkWidth(run.text, fontSize);
}

function pdfTextWidth(value: string, fontSize: number) {
  return splitPdfRuns(value).reduce((sum, run) => sum + pdfRunWidth(run, fontSize), 0);
}

function wrapText(value: string, fontSize: number, maxWidth: number) {
  const lines: string[] = [];
  for (const raw of value.split(/\r?\n/)) {
    let current = "";
    for (const char of Array.from(raw)) {
      const next = `${current}${char}`;
      if (current && pdfTextWidth(next, fontSize) > maxWidth) {
        lines.push(current);
        current = char;
      } else {
        current = next;
      }
    }
    lines.push(current || " ");
  }
  return lines;
}

function utf16Hex(value: string) {
  const chars = Array.from(value);
  let hex = "";
  for (const char of chars) {
    const code = char.codePointAt(0) ?? 0x20;
    const safe = code > 0xffff ? 0x3f : code;
    hex += safe.toString(16).padStart(4, "0");
  }
  return hex;
}

function pdfTextCommand(text: string, x: number, y: number, size: number) {
  const commands: string[] = [];
  let currentX = x;
  for (const run of splitPdfRuns(text)) {
    const font = run.ascii ? "/F2" : "/F1";
    const payload = run.ascii ? `(${pdfEscapeLiteral(run.text)})` : `<${utf16Hex(run.text)}>`;
    commands.push(`BT ${font} ${size.toFixed(2)} Tf 1 0 0 1 ${currentX.toFixed(2)} ${y.toFixed(2)} Tm ${payload} Tj ET`);
    currentX += pdfRunWidth(run, size);
  }
  return commands.join("\n");
}

function pdfFillRectCommand(x: number, y: number, width: number, height: number, color: [number, number, number]) {
  return `q ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`;
}

function pdfStrokeRectCommand(x: number, y: number, width: number, height: number, color: [number, number, number]) {
  return `q ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG 0.45 w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q`;
}

function pdfLineCommand(x1: number, y1: number, x2: number, y2: number, color: [number, number, number]) {
  return `q ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG 0.7 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`;
}

function tableColumnWidths(table: DocumentTable, totalWidth: number) {
  if (table.columns.length === 0) return [];
  const sampleRows = [table.columns, ...table.rows.slice(0, 24)];
  const weights = table.columns.map((_, index) => {
    const maxWidth = sampleRows.reduce((max, row) => Math.max(max, textVisualWidth(row[index] ?? "")), 1);
    return Math.min(5.5, Math.max(1, Math.sqrt(maxWidth)));
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const minFraction = table.columns.length >= 6 ? 0.075 : table.columns.length >= 4 ? 0.105 : 0.16;
  const rawWidths = weights.map((weight) => Math.max(totalWidth * minFraction, (weight / totalWeight) * totalWidth));
  const rawTotal = rawWidths.reduce((sum, width) => sum + width, 0) || totalWidth;
  return rawWidths.map((width) => (width / rawTotal) * totalWidth);
}

function buildPdf(document: ExportDocument) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const pageContents: string[] = [];
  let commands: string[] = [];
  let y = pageHeight - margin;

  const newPage = () => {
    pageContents.push(commands.join("\n"));
    commands = [];
    y = pageHeight - margin;
  };

  const ensureSpace = (height: number) => {
    if (y - height < margin) newPage();
  };

  const drawTextBlock = (text: string, size = 9.5, gap = 4, indent = 0) => {
    y -= gap;
    const wrapped = wrapText(text, size, contentWidth - indent);
    for (const line of wrapped) {
      ensureSpace(size + 6);
      commands.push(pdfTextCommand(line, margin + indent, y, size));
      y -= size + 4;
    }
  };

  const drawHeading = (text: string) => {
    y -= 8;
    ensureSpace(20);
    commands.push(pdfTextCommand(text, margin, y, 12));
    y -= 10;
    commands.push(pdfLineCommand(margin, y, margin + contentWidth, y, [0.82, 0.87, 0.94]));
    y -= 6;
  };

  const drawTable = (table: DocumentTable) => {
    const widths = tableColumnWidths(table, contentWidth);
    if (!widths.length) return;
    const padding = 4.5;
    const borderColor: [number, number, number] = [0.82, 0.86, 0.91];
    const headerFill: [number, number, number] = [0.92, 0.95, 1];

    const rowSpec = (row: string[], header: boolean) => {
      const fontSize = header ? 8.4 : 7.8;
      const lineHeight = fontSize + 3.2;
      const cells = widths.map((width, index) => {
        const text = row[index]?.trim() || "-";
        return wrapText(text, fontSize, Math.max(16, width - padding * 2));
      });
      const lineCount = Math.max(1, ...cells.map((cell) => cell.length));
      return {
        cells,
        fontSize,
        lineHeight,
        height: Math.max(22, lineCount * lineHeight + padding * 2),
      };
    };

    const drawRow = (row: string[], header: boolean) => {
      const spec = rowSpec(row, header);
      const bottom = y - spec.height;
      let x = margin;
      widths.forEach((width, index) => {
        if (header) commands.push(pdfFillRectCommand(x, bottom, width, spec.height, headerFill));
        commands.push(pdfStrokeRectCommand(x, bottom, width, spec.height, borderColor));
        let textY = y - padding - spec.fontSize;
        for (const line of spec.cells[index]) {
          if (textY > bottom + padding / 2) {
            commands.push(pdfTextCommand(line, x + padding, textY, spec.fontSize));
          }
          textY -= spec.lineHeight;
        }
        x += width;
      });
      y = bottom;
    };

    y -= 4;
    const headerSpec = rowSpec(table.columns, true);
    ensureSpace(headerSpec.height + 8);
    drawRow(table.columns, true);
    for (const row of table.rows) {
      const spec = rowSpec(row, false);
      if (y - spec.height < margin) {
        newPage();
        drawRow(table.columns, true);
      }
      drawRow(row, false);
    }
    y -= 8;
  };

  drawTextBlock(document.title, 18, 0);
  if (document.subtitle) drawTextBlock(document.subtitle, 11.5, 2);
  drawHeading("基础信息");
  drawTable({ columns: ["项目", "内容"], rows: document.meta });
  drawHeading("关键摘要");
  drawTable({ columns: ["指标", "结果"], rows: document.summary });

  for (const section of document.sections) {
    drawHeading(section.heading);
    for (const paragraph of section.paragraphs ?? []) {
      drawTextBlock(paragraph, 9.2, 2);
    }
    if (section.table) drawTable(section.table);
  }
  if (commands.length || pageContents.length === 0) newPage();

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>";
  objects[4] = "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor 5 0 R /DW 1000 >>";
  objects[5] = "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>";
  objects[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  const pageObjectNumbers: number[] = [];
  let nextObject = 7;
  for (const content of pageContents) {
    const pageObj = nextObject;
    const contentObj = nextObject + 1;
    nextObject += 2;
    pageObjectNumbers.push(pageObj);
    const contentBytes = bytesFromString(content);
    objects[pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 6 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objects[contentObj] = `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`;
  }
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;

  const header = "%PDF-1.7\n";
  let body = header;
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = bytesFromString(body).length;
    body += `${i} 0 obj\n${objects[i] ?? "<<>>"}\nendobj\n`;
  }
  const xrefOffset = bytesFromString(body).length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return bytesFromString(body);
}
