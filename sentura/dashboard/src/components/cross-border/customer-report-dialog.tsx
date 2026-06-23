"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, MapPin, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buyerTypeLabel, productLabel } from "@/components/cross-border/customer-labels";
import type {
  CustomerEvidenceItem,
  CustomerListItem,
  CustomerScoreBlock,
  CustomerScreeningReport,
  CompanyScaleAssessment,
  CompanyScaleAssessment,
  AddressFootprintAddressType,
  AddressFootprintRelationshipStatus,
  CustomerAddressFootprint,
  ScreeningEvidenceLayer,
} from "@/app/client-demos/cross-border/employee/_data/employee-data";

const statusLabels: Record<CustomerListItem["screeningStatus"], string> = {
  not_started: "未背调",
  running: "背调中",
  screened: "已评分",
  insufficient_evidence: "证据不足",
  failed: "失败",
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

const addressTypeLabels: Record<AddressFootprintAddressType, string> = {
  headquarters_or_office: "总部 / 办公",
  storefront: "门店",
  warehouse_or_distribution: "仓库 / 分销",
  service_or_repair_location: "服务 / 维修",
  unknown_business_location: "业务地址",
};

const relationshipLabels: Record<AddressFootprintRelationshipStatus, string> = {
  confirmed_company_location: "已确认",
  probable_company_location: "高可能",
  possible_related_location: "待复核",
  rejected_unrelated_location: "已排除",
};

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

function evidenceByLayer(evidence: CustomerEvidenceItem[]) {
  const grouped = new Map<ScreeningEvidenceLayer, CustomerEvidenceItem[]>();
  for (const item of evidence) {
    grouped.set(item.layer, [...(grouped.get(item.layer) ?? []), item]);
  }
  return grouped;
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

const scaleClassLabels: Record<CompanyScaleAssessment["scaleClass"], string> = {
  listed_or_public: "上市/公开披露企业",
  medium_large_registered: "中大型注册企业",
  small_local_offline: "中小型线下企业",
  small_online_only: "中小型线上企业",
  unknown_scale: "规模待确认",
};

const firstBlockStrategyLabels: Record<CompanyScaleAssessment["firstBlockStrategy"], string> = {
  registry_disclosure_primary_maps_support: "注册/披露为主，Maps 地址辅助",
  maps_physical_address_primary: "Maps 物理地址和营业状态为主",
  domain_public_source_primary: "官网/公开来源为主",
  try_registry_and_maps: "注册与 Maps 双路径待确认",
};

function CompanyScalePanel({ assessment }: { assessment?: CompanyScaleAssessment }) {
  if (!assessment) return null;
  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-800">公司规模评估</span>
        <Badge variant="outline" className="bg-white text-slate-700">
          {scaleClassLabels[assessment.scaleClass]}
        </Badge>
        <Badge variant="outline" className="bg-white text-slate-700">
          {firstBlockStrategyLabels[assessment.firstBlockStrategy]}
        </Badge>
        {typeof assessment.confidence === "number" ? (
          <span className="text-xs text-muted-foreground">置信度 {Math.round(assessment.confidence * 100)}%</span>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{assessment.rationale}</p>
    </div>
  );
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

function addressFootprintStatusText(status: CustomerAddressFootprint["coverageStatus"]) {
  const labels: Record<CustomerAddressFootprint["coverageStatus"], string> = {
    found: "已发现",
    partial: "部分发现",
    not_found: "未发现",
    unavailable_api: "暂不可用",
    not_checked: "未查询",
  };
  return labels[status];
}

function relationshipClass(status: AddressFootprintRelationshipStatus) {
  if (status === "confirmed_company_location") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "probable_company_location") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "possible_related_location") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function addressValidationText(location: CustomerAddressFootprint["locations"][number]) {
  const validation = location.addressValidation;
  if (!validation?.status && typeof validation?.addressComplete !== "boolean") return "未验证";
  const complete = typeof validation.addressComplete === "boolean"
    ? validation.addressComplete ? "完整" : "不完整"
    : "完整性未返回";
  return [validation.status, complete, validation.possibleNextAction].filter(Boolean).join(" / ");
}

function AddressFootprintPanel({ footprint }: { footprint?: CustomerAddressFootprint }) {
  if (!footprint) return null;
  const groups: Array<{
    id: string;
    label: string;
    locations: CustomerAddressFootprint["locations"];
  }> = [
    {
      id: "confirmed",
      label: "确认地址",
      locations: footprint.locations.filter((item) => item.relationshipStatus === "confirmed_company_location"),
    },
    {
      id: "probable",
      label: "高可能地址",
      locations: footprint.locations.filter((item) => item.relationshipStatus === "probable_company_location"),
    },
    {
      id: "needs_review",
      label: "待复核地址",
      locations: footprint.locations.filter((item) => item.relationshipStatus === "possible_related_location"),
    },
  ];
  const rejectedCount = footprint.locations.filter((item) => item.relationshipStatus === "rejected_unrelated_location").length;
  const cappedNote = footprint.searchScope.capped ? "搜索已触发上限" : "搜索未触发上限";

  return (
    <section className="rounded-md border-2 border-sky-200 bg-sky-50/50 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-950">
            <MapPin className="h-4 w-4 text-sky-700" />
            <span>{footprint.sectionTitle || "线下地址线索"}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-sky-900/75">
            展示公开地址线索，用来辅助判断客户是否有实际经营地点；公司注册结论仍以注册信息为准。
          </p>
        </div>
        <Badge variant="outline" className="border-sky-300 bg-white text-sky-800">
          {addressFootprintStatusText(footprint.coverageStatus)}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetric label="发现地址" value={`${footprint.summary.totalLocations} 个`} />
        <ReportMetric
          label="确认 / 高可能 / 待复核"
          value={`${footprint.summary.confirmedLocations} / ${footprint.summary.probableLocations} / ${footprint.summary.possibleRelatedLocations}`}
        />
        <ReportMetric
          label="营业 / 关闭"
          value={`${footprint.summary.operationalLocations} / ${footprint.summary.closedLocations}`}
        />
        <ReportMetric
          label="覆盖城市"
          value={footprint.summary.cities.length ? footprint.summary.cities.join(", ") : "未确认"}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-sky-900/75">
        <Badge variant="outline" className="bg-white">{cappedNote}</Badge>
        {footprint.summary.countries.length ? <Badge variant="outline" className="bg-white">{footprint.summary.countries.join(", ")}</Badge> : null}
        {rejectedCount > 0 ? <Badge variant="outline" className="bg-white">已排除 {rejectedCount} 个疑似无关地点</Badge> : null}
      </div>

      {footprint.searchScope.limitations.length || footprint.openQuestions.length ? (
        <div className="mt-3 rounded-md border border-sky-200 bg-white px-3 py-2 text-xs leading-5 text-sky-950">
          {[...footprint.searchScope.limitations, ...footprint.openQuestions].map((item, index) => (
            <div key={`${item}-${index}`}>{item}</div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.id} className="rounded-md border border-sky-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-sky-100 px-3 py-2">
              <div className="text-sm font-medium text-sky-950">{group.label}</div>
              <Badge variant="outline">{group.locations.length} 个</Badge>
            </div>
            {group.locations.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">暂无{group.label}。</div>
            ) : (
              <div className="divide-y divide-sky-100">
                {group.locations.map((location, index) => (
                  <div key={`${location.googlePlaceId ?? location.googleMapsUri ?? location.formattedAddress}-${index}`} className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words text-sm font-medium text-slate-950">{location.displayName}</span>
                      <Badge variant="outline" className={relationshipClass(location.relationshipStatus)}>
                        {relationshipLabels[location.relationshipStatus]}
                      </Badge>
                      <Badge variant="secondary">{addressTypeLabels[location.addressType]}</Badge>
                      {location.businessStatus ? <Badge variant="outline">{location.businessStatus}</Badge> : null}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-800">{location.formattedAddress}</div>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>地址验证：{addressValidationText(location)}</div>
                      <div>
                        匹配度：
                        {typeof location.matchConfidence === "number" ? `${Math.round(location.matchConfidence * 100)}%` : "未返回"}
                      </div>
                      <div>官网匹配：{typeof location.domainMatch === "boolean" ? (location.domainMatch ? "是" : "否") : location.domainMatch ?? "未检查"}</div>
                      <div>电话匹配：{typeof location.phoneMatch === "boolean" ? (location.phoneMatch ? "是" : "否") : location.phoneMatch ?? "未检查"}</div>
                    </div>
                    {location.matchReasons.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {location.matchReasons.map((reason) => (
                          <Badge key={reason} variant="outline" className="bg-slate-50 text-[11px]">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {location.googleMapsUri ? (
                      <a
                        href={location.googleMapsUri}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 break-all text-xs font-medium text-primary hover:underline"
                      >
                        打开 Google Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {footprint.searchScope.queriesRun.length ? (
        <details className="mt-3 rounded-md border border-sky-200 bg-white px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-sky-900">查看查询范围</summary>
          <div className="mt-2 space-y-1">
            {footprint.searchScope.queriesRun.map((query) => (
              <div key={query} className="break-words font-mono">{query}</div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

export function CustomerReportDialog({
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

  const dialog = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-3 sm:p-6"
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
                <CompanyScalePanel assessment={report?.companyScaleAssessment} />
              </ReportPanel>

              {report ? (
                <>
                  <AddressFootprintPanel footprint={report.addressFootprint} />

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

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
