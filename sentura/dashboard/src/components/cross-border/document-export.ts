import { buyerTypeLabel, productLabel } from "@/components/cross-border/customer-labels";
import {
  businessStatusText,
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
  conversation_behavior: "聊天行为",
};

const scoreBlockStatusLabels: Record<string, string> = {
  scored: "已评分",
  not_applicable: "不适用",
  unavailable_api: "未找到资料",
  disabled_by_budget: "未开启",
  pending_human_input: "待补充",
};

const screeningStatusLabels: Record<CustomerListItem["screeningStatus"], string> = {
  not_started: "未背调",
  running: "背调中",
  screened: "已评分",
  insufficient_evidence: "证据不足",
  failed: "失败",
};

const costAgentLabels: Record<string, string> = {
  "cbe-lead-discovery": "找客户",
  "cbe-buyer-screening": "背调",
  "cbe-accio-memory": "聊天整理",
};

const costPricingLabels: Record<string, string> = {
  priced: "真实美元",
  estimated: "按官方单价估算",
  free: "0 美元",
  included: "套餐内/返回 0",
  unpriced: "未折算美元",
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
    evidence: item.sourceUrls.map((url) => ({
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
  const sections: DocumentSection[] = [
    {
      heading: "一、背调结论",
      paragraphs: [
        normalizeText(report?.recommendedAction ?? customer.recommendedAction, "暂无报告，等待背调结果。"),
      ],
    },
  ];

  if (report?.companyScaleAssessment) {
    sections.push({
      heading: "二、公司规模与核验策略",
      table: {
        columns: ["项目", "内容"],
        rows: [
          ["规模判断", normalizeText(report.companyScaleAssessment.scaleClass)],
          ["核验策略", normalizeText(report.companyScaleAssessment.firstBlockStrategy)],
          ["置信度", formatPercent(report.companyScaleAssessment.confidence)],
          ["判断说明", normalizeText(report.companyScaleAssessment.rationale)],
        ],
      },
    });
  }

  sections.push({
    heading: "三、评分来源",
    paragraphs: report?.scoreBlocks.length ? undefined : ["本次报告暂未提供分项评分。"],
    table: report?.scoreBlocks.length
      ? {
          columns: ["维度", "状态", "得分/权重", "说明"],
          rows: report.scoreBlocks.map((block) => [
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
        normalizeText(location.addressType),
        normalizeText(location.relationshipStatus),
        location.businessStatus ? normalizeText(businessStatusText(location.businessStatus)) : "-",
        typeof location.matchConfidence === "number" ? formatPercent(location.matchConfidence) : "待确认",
      ]);
    sections.push({
      heading: "四、Google Maps 地址线索",
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
    heading: "五、核验依据",
    paragraphs: report?.evidence.length ? undefined : ["暂无核验依据。"],
    table: report?.evidence.length
      ? {
          columns: ["类别", "来源", "判断", "可信度"],
          rows: report.evidence.slice(0, 30).map((item) => [
            scoreBlockLabels[item.scoreBlock ?? ""] ?? item.scoreBlock ?? "-",
            sourceTypeText(item.sourceType) ?? "公开资料",
            evidenceFindingText(item),
            typeof item.confidence === "number" ? formatPercent(item.confidence) : "待确认",
          ]),
        }
      : undefined,
  });

  sections.push({
    heading: "六、待补充事项",
    paragraphs: report?.coverageGaps.length
      ? report.coverageGaps.map((gap) => {
          const block = scoreBlockLabels[gap.block] ?? gap.block;
          const reason = normalizeText(gap.reason);
          const action = gap.action ? `建议：${normalizeText(gap.action)}` : "";
          return `${block}：${reason}${action ? `。${action}` : ""}`;
        })
      : ["暂无需要补充的关键事项。"],
  });

  sections.push({
    heading: "附录：审计信息",
    table: {
      columns: ["项目", "内容"],
      rows: [
        ["客户编号", customer.customerId],
        ["报告编号", report?.reportId ?? customer.reportId ?? customer.customerId],
        ["来源网址", customer.sourceUrls.length ? customer.sourceUrls.join("\n") : "-"],
        ["核验证据网址", report?.evidence.map((item) => item.sourceUrl).filter(Boolean).join("\n") || "-"],
      ],
    },
  });

  return {
    title: "Sentura 跨境电商背调报告",
    subtitle: customer.companyName,
    meta: [
      ["客户名称", customer.companyName],
      ["国家 / 类型", `${customer.countryName} / ${buyerTypeLabel(customer.buyerType)}`],
      ["产品兴趣", productsLabel],
      ["找到时间", formatDateTime(customer.foundAt)],
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

function employeeCostServiceLabel(event: CostEvent) {
  if ((event.kind ?? "model") === "model") return event.model;
  return event.service ?? event.provider;
}

function employeeCostOperationLabel(event: CostEvent) {
  if ((event.kind ?? "model") === "model") return event.provider;
  return event.operation ?? event.model;
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
    event.pricingStatus ? costPricingLabels[event.pricingStatus] ?? event.pricingStatus : "-",
  ]);

  return {
    title: "Sentura 跨境电商成本明细",
    subtitle: "员工端本月工具成本",
    meta: [
      ["范围", "本月"],
      ["生成时间", formatGeneratedAt()],
      ["账本口径", "仅统计已关联到当前跨境电商客户库任务的处理编号"],
      ["数据来源", input.costBudget.source === "fallback" ? "预算兜底" : "系统费用记录"],
    ],
    summary: [
      ["本月已用", formatUsd(input.spendUsd)],
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
            ? "本表展示本月已记录的智能处理与外部资料查询费用，已折算美元的项目计入已用费用。"
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
              columns: ["时间", "员工", "服务项目", "来源", "用量", "耗时", "成本", "计价状态"],
              rows: eventRows,
            }
          : undefined,
      },
      {
        heading: "附录：技术口径",
        table: {
          columns: ["项目", "内容"],
          rows: [
            ["关联任务数", String(input.scopedSessionCount)],
            ["范围外记录", String(input.outsideScopeCount)],
            ["基础额度", formatUsd(input.costBudget.baseLimitUsd)],
            ["临时额度", formatUsd(input.costBudget.activeAllowanceUsd)],
            ["更新时间", input.costBudget.updatedAt ? formatDateTime(input.costBudget.updatedAt) : "-"],
            ["处理编号", input.events.map((event) => event.sessionKey).filter(Boolean).join("\n") || "-"],
            ["服务明细", input.events.map((event) => employeeCostOperationLabel(event)).filter(Boolean).join("\n") || "-"],
          ],
        },
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
  if (raw.includes("lead")) return "找客户";
  return "任务";
}

function adminCostSourceLabel(value: unknown) {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("google") || raw.includes("maps") || raw.includes("places")) return "公开地址查询";
  if (raw.includes("search") || raw.includes("fetch") || raw.includes("web")) return "公开网页查询";
  if (raw.includes("external") || raw.includes("api") || raw.includes("provider")) return "工具调用";
  if (raw.includes("cbe-lead")) return "找客户";
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
  const profileName = input.profile?.display_name ?? "员工费用明细";
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
    title: "Sentura 跨境电商员工费用明细",
    subtitle: profileName,
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
      {
        heading: "附录：技术口径",
        table: {
          columns: ["项目", "内容"],
          rows: [
            ["用户编号", input.profile?.user_id ?? "-"],
            ["记录数量", String(input.events.length)],
            ["处理编号", input.events.map((event) => String(event.session_key ?? "")).filter(Boolean).join("\n") || "-"],
            ["来源", input.events.map((event) => String(event.provider ?? event.agent_id ?? "")).filter(Boolean).join("\n") || "-"],
          ],
        },
      },
    ],
  };
}

export function exportCustomerReportDocument(customer: CustomerListItem, format: ExportFormat) {
  const document = buildCustomerReportDocument(customer);
  downloadExportDocument(document, format, `背调报告-${customer.companyName}`);
}

export function exportEmployeeCostDocument(input: EmployeeCostExportInput, format: ExportFormat) {
  const document = buildEmployeeCostDocument(input);
  downloadExportDocument(document, format, "员工成本明细-本月工具成本");
}

export function exportAdminCostDocument(input: AdminCostExportInput, format: ExportFormat) {
  const document = buildAdminCostDocument(input);
  downloadExportDocument(document, format, `员工费用明细-${input.profile?.display_name ?? "员工"}`);
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
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${styleXml}<w:r>${docxTextRuns(value)}</w:r></w:p>`;
}

function docxTable(table: DocumentTable) {
  const rows = [table.columns, ...table.rows];
  const rowXml = rows
    .map((row, index) => {
      const cells = row
        .map((cell) => {
          const shading = index === 0 ? '<w:shd w:fill="EAF2FF"/>' : "";
          return `<w:tc><w:tcPr>${shading}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>${docxParagraph(cell || "-")}</w:tc>`;
        })
        .join("");
      return `<w:tr>${cells}</w:tr>`;
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D6DEE9"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D6DEE9"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D6DEE9"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D6DEE9"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D6DEE9"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D6DEE9"/></w:tblBorders></w:tblPr>${rowXml}</w:tbl>`;
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
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:sz w:val="21"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:b/><w:color w:val="17324D"/><w:sz w:val="34"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:color w:val="56657A"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:b/><w:color w:val="17324D"/><w:sz w:val="26"/></w:rPr><w:pPr><w:spacing w:before="260" w:after="120"/></w:pPr></w:style></w:styles>`;
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

function flattenPdfLines(document: ExportDocument) {
  const lines: Array<{ text: string; size: number; gap: number; indent: number }> = [];
  const add = (text: string, size = 10, gap = 4, indent = 0) => {
    lines.push({ text, size, gap, indent });
  };
  add(document.title, 18, 8);
  if (document.subtitle) add(document.subtitle, 12, 10);
  add("基础信息", 12, 5);
  for (const [label, value] of document.meta) add(`${label}：${value}`, 9.5, 2);
  add("关键摘要", 12, 5);
  for (const [label, value] of document.summary) add(`${label}：${value}`, 9.5, 2);
  for (const section of document.sections) {
    add(section.heading, 12, 6);
    for (const paragraph of section.paragraphs ?? []) add(paragraph, 9.5, 3);
    if (section.table) {
      add(section.table.columns.join(" / "), 9.5, 3);
      section.table.rows.forEach((row, index) => {
        const text = row.map((cell, cellIndex) => `${section.table?.columns[cellIndex] ?? ""}：${cell || "-"}`).join("；");
        add(`${index + 1}. ${text}`, 8.8, 2, 8);
      });
    }
  }
  return lines;
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

  for (const line of flattenPdfLines(document)) {
    y -= line.gap;
    const wrapped = wrapText(line.text, line.size, contentWidth - line.indent);
    for (const wrappedLine of wrapped) {
      if (y < margin + line.size + 8) newPage();
      commands.push(pdfTextCommand(wrappedLine, margin + line.indent, y, line.size));
      y -= line.size + 4;
    }
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
