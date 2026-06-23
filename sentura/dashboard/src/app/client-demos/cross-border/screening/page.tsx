"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  Gauge,
  Globe2,
  Loader2,
  Lock,
  MapPin,
  Play,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { AgentChat, type AgentChatHandle, type ChatMessage, type ToolCallEvent } from "@/components/agent-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgent, useGateway } from "@/lib/gateway";
import { cn } from "@/lib/utils";

const SCREENING_AGENT_ID = "cbe-buyer-screening";
const SCREENING_TASK_PREFIX = "[CBE Screening Employee Task]";
const REPORT_JSON_START = "SCREENING_REPORTS_JSON_START";
const REPORT_JSON_END = "SCREENING_REPORTS_JSON_END";

type SourceType =
  | "official_api"
  | "official_registry_page"
  | "public_web"
  | "public_dns"
  | "google_maps_places"
  | "google_maps_geocoding"
  | "google_maps_address_validation"
  | "paid_trade_data"
  | "demo_fixture"
  | "self_reported"
  | "unverified";

type RiskTier = "trusted_candidate" | "cautious" | "insufficient_evidence" | "high_risk";
type EvidenceLayer = EvidenceItem["layer"];
type ScoreImpact = EvidenceItem["score_impact"];

interface EnvProviderStatus {
  configured?: boolean;
  enabled?: boolean;
  no_api_key_required?: boolean;
  user_agent_configured?: boolean;
  source?: string;
  provider?: string;
}

interface ScreeningEnvStatus {
  tavily_search?: EnvProviderStatus;
  companies_house?: EnvProviderStatus;
  google_maps?: EnvProviderStatus;
  abstract_email_validation?: EnvProviderStatus;
  hunter_email_verifier?: EnvProviderStatus;
  importyeti_trade_data?: EnvProviderStatus;
  sec_edgar?: EnvProviderStatus;
  paid_trade_data?: {
    enabled?: boolean;
    max_paid_spend_usd?: number;
  };
  request_timeout_ms?: number;
}

interface InvestigationTarget {
  target_id: string;
  source: "marketing_lead" | "marketing_lead_batch" | "manual_input";
  lead_id: string | null;
  company_name?: string;
  country?: string;
  website?: string;
  domain?: string;
  email?: string;
  contact_person?: string;
  contact_title?: string;
  social_or_profile_url?: string;
  product_interest: string[];
  operator_notes?: string;
  sec_cik?: string;
  supplied_fields: string[];
  inferred_fields: string[];
  missing_fields: string[];
}

interface EvidenceItem {
  layer:
    | "legal_registry"
    | "domain_email"
    | "google_maps_local_presence"
    | "address_validation"
    | "public_footprint"
    | "trade_customs"
    | "financial_public_filing"
    | "behavior";
  source_type: SourceType;
  source: string;
  url: string;
  finding: string;
  confidence: number;
  fetched_at: string;
  cost_usd: number;
  score_block: string;
  score_impact: "positive" | "negative" | "neutral" | "coverage_only";
  affects_score: boolean;
  raw_status?: string;
}

interface ScoreBlock {
  block: string;
  status:
    | "scored"
    | "not_applicable"
    | "unavailable_api"
    | "disabled_by_budget"
    | "pending_human_input";
  max_points: number;
  earned_points: number | null;
  source_count: number;
  summary: string;
  reason?: string;
}

interface MissingEvidence {
  block: string;
  status: string;
  recommended_next_step: string;
}

interface AddressFootprintLocation {
  google_place_id?: string;
  display_name: string;
  address_type: string;
  relationship_status: string;
  formatted_address: string;
  city?: string;
  region?: string;
  country?: string;
  business_status?: string;
  website_uri?: string;
  google_maps_uri?: string;
  match_confidence?: number;
  match_reasons: string[];
  address_validation?: {
    status?: string;
    address_complete?: boolean;
    possible_next_action?: string;
  };
}

interface AddressFootprint {
  section_title: string;
  coverage_status: "found" | "partial" | "not_found" | "unavailable_api" | "not_checked";
  search_scope: {
    queries_run: string[];
    countries: string[];
    capped: boolean;
    limitations: string[];
  };
  summary: {
    total_locations: number;
    confirmed_locations: number;
    probable_locations: number;
    possible_related_locations: number;
    operational_locations: number;
    closed_locations: number;
    countries: string[];
    cities: string[];
  };
  locations: AddressFootprintLocation[];
  open_questions: string[];
}

interface ScreeningReport {
  report_id: string;
  lead_id: string | null;
  target_source: "marketing_lead" | "marketing_lead_batch" | "manual_input";
  target: InvestigationTarget;
  company_name: string;
  company_scale_assessment?: {
    scale_class: "listed_or_public" | "medium_large_registered" | "small_local_offline" | "small_online_only" | "unknown_scale";
    confidence?: number;
    rationale: string;
    first_block_strategy:
      | "registry_disclosure_primary_maps_support"
      | "maps_physical_address_primary"
      | "domain_public_source_primary"
      | "try_registry_and_maps";
  };
  risk_tier: RiskTier;
  normalized_score: number | null;
  evidence_coverage: number;
  recommended_action: string;
  score_blocks: ScoreBlock[];
  evidence: EvidenceItem[];
  address_footprint?: AddressFootprint;
  open_questions: string[];
  missing_or_unavailable_evidence: MissingEvidence[];
  created_at: string;
}

interface ScreeningStoredState {
  tab: "batch" | "manual";
  batchJson: string;
  companyName: string;
  country: string;
  website: string;
  domain: string;
  email: string;
  contactPerson: string;
  contactTitle: string;
  profileUrl: string;
  secCik: string;
  productInterest: string;
  operatorNotes: string;
  enablePaidEmailValidation: boolean;
  enablePaidTradeData: boolean;
  maxPaidSpendUsd: number;
  reports: ScreeningReport[];
  selectedReportId?: string;
  envStatus?: ScreeningEnvStatus;
  runStatus: "idle" | "running" | "ready" | "error";
  runMessage: string;
  screeningSessionKey?: string;
}

const SCREENING_STORAGE_KEY = "sentura:cbe:screening:v1";

const sourceTypeLabels: Record<SourceType, string> = {
  official_api: "官方 API",
  official_registry_page: "官方注册页",
  public_web: "公开网页",
  public_dns: "公开 DNS/RDAP",
  google_maps_places: "Google Maps Places",
  google_maps_geocoding: "Google Maps Geocoding",
  google_maps_address_validation: "Google Address Validation",
  paid_trade_data: "付费贸易数据",
  demo_fixture: "演示数据",
  self_reported: "自报信息",
  unverified: "未验证",
};

const layerLabels: Record<EvidenceItem["layer"], string> = {
  legal_registry: "公司注册/线下地址",
  domain_email: "域名/邮箱",
  google_maps_local_presence: "Google 本地足迹",
  address_validation: "地址一致性",
  public_footprint: "公开足迹",
  trade_customs: "贸易/海关",
  financial_public_filing: "财务/公开申报",
  behavior: "行为记录",
};

const riskLabels: Record<RiskTier, string> = {
  trusted_candidate: "可信候选",
  cautious: "谨慎跟进",
  insufficient_evidence: "证据不足",
  high_risk: "高风险",
};

const scoreBlockLabels: Record<string, string> = {
  legal_identity: "公司注册与线下门店/地址",
  domain_email: "域名/邮箱",
  public_footprint: "公开足迹",
  business_fit: "业务匹配",
  trade_financial: "贸易/财务",
  conversation_behavior: "行为记录",
};

const scoreBlockToLayer: Record<string, EvidenceLayer> = {
  legal_identity: "legal_registry",
  domain_email: "domain_email",
  public_footprint: "public_footprint",
  business_fit: "public_footprint",
  trade_financial: "financial_public_filing",
  conversation_behavior: "behavior",
};

const scaleClassLabels: Record<NonNullable<ScreeningReport["company_scale_assessment"]>["scale_class"], string> = {
  listed_or_public: "上市/公开披露企业",
  medium_large_registered: "中大型注册企业",
  small_local_offline: "中小型线下企业",
  small_online_only: "中小型线上企业",
  unknown_scale: "规模待确认",
};

const firstBlockStrategyLabels: Record<NonNullable<ScreeningReport["company_scale_assessment"]>["first_block_strategy"], string> = {
  registry_disclosure_primary_maps_support: "注册/披露为主，Maps 地址辅助",
  maps_physical_address_primary: "Maps 物理地址和营业状态为主",
  domain_public_source_primary: "官网/公开来源为主",
  try_registry_and_maps: "注册与 Maps 双路径待确认",
};

const sourceTypeAliases: Record<string, SourceType> = {
  official_api: "official_api",
  official_registry_page: "official_registry_page",
  official_web: "public_web",
  public_web: "public_web",
  public_review_profile: "public_web",
  public_business_profile: "public_web",
  public_dns: "public_dns",
  google_maps_places: "google_maps_places",
  google_maps_geocoding: "google_maps_geocoding",
  google_maps_address_validation: "google_maps_address_validation",
  google_maps_local_presence: "google_maps_places",
  address_validation: "google_maps_address_validation",
  registry_tool: "official_registry_page",
  paid_trade_data: "paid_trade_data",
  demo_fixture: "demo_fixture",
  self_reported: "self_reported",
  unverified: "unverified",
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function parseProductInterest(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function groupEvidence(evidence: EvidenceItem[]) {
  return evidence.reduce<Record<EvidenceItem["layer"], EvidenceItem[]>>((groups, item) => {
    groups[item.layer] = groups[item.layer] ?? [];
    groups[item.layer].push(item);
    return groups;
  }, {} as Record<EvidenceItem["layer"], EvidenceItem[]>);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeTargetSource(value: unknown): ScreeningReport["target_source"] {
  if (value === "marketing_lead" || value === "marketing_lead_batch" || value === "manual_input") return value;
  return "manual_input";
}

function normalizeRiskTier(value: unknown): RiskTier {
  if (value === "trusted_candidate" || value === "cautious" || value === "insufficient_evidence" || value === "high_risk") {
    return value;
  }
  return "insufficient_evidence";
}

function normalizeSourceType(value: unknown): SourceType {
  const key = asString(value)?.toLowerCase();
  return key ? (sourceTypeAliases[key] ?? "unverified") : "unverified";
}

function normalizeScoreImpact(value: unknown): ScoreImpact {
  if (value === "positive" || value === "negative" || value === "neutral" || value === "coverage_only") return value;
  if (value === "coverage_gap" || value === "caution") return "coverage_only";
  if (value === "mixed") return "neutral";
  return "neutral";
}

function normalizeEvidenceLayer(value: unknown, scoreBlock: string, sourceType: SourceType, url: string): EvidenceLayer {
  if (
    value === "legal_registry" ||
    value === "domain_email" ||
    value === "google_maps_local_presence" ||
    value === "address_validation" ||
    value === "public_footprint" ||
    value === "trade_customs" ||
    value === "financial_public_filing" ||
    value === "behavior"
  ) {
    return value;
  }
  if (/(\bdata\.sec\.gov\b|\bsec\.gov\b)/i.test(url)) return "financial_public_filing";
  if (sourceType === "google_maps_address_validation") return "address_validation";
  if (sourceType === "google_maps_places" || sourceType === "google_maps_geocoding") return "google_maps_local_presence";
  if (sourceType === "paid_trade_data" || /(importyeti|customs|shipment|bill-of-lading)/i.test(url)) {
    return "trade_customs";
  }
  return scoreBlockToLayer[scoreBlock] ?? "public_footprint";
}

function normalizeScoreBlock(value: unknown): ScoreBlock {
  const raw = asRecord(value);
  const block = asString(raw.block) ?? "public_footprint";
  const status = asString(raw.status) ?? "pending_human_input";
  return {
    block,
    status: status as ScoreBlock["status"],
    max_points: asNumber(raw.max_points, 0),
    earned_points: typeof raw.earned_points === "number" ? raw.earned_points : null,
    source_count: asNumber(raw.source_count, 0),
    summary: asString(raw.summary) ?? "",
    reason: asString(raw.reason),
  };
}

function normalizeEvidenceItem(value: unknown, index: number): EvidenceItem {
  const raw = asRecord(value);
  const scoreBlock = asString(raw.score_block) ?? asString(raw.block) ?? "public_footprint";
  const sourceType = normalizeSourceType(raw.source_type);
  const impact = normalizeScoreImpact(raw.score_impact);
  const url = asString(raw.url) ?? asString(raw.source_url) ?? "#";
  const finding =
    asString(raw.finding) ??
    asString(raw.summary) ??
    asString(raw.detail) ??
    asString(raw.source) ??
    `证据 ${index + 1}`;
  const rawAffectsScore = raw.affects_score;
  return {
    layer: normalizeEvidenceLayer(raw.layer, scoreBlock, sourceType, url),
    source_type: sourceType,
    source: asString(raw.source) ?? sourceTypeLabels[sourceType] ?? "未标注来源",
    url,
    finding,
    confidence: asNumber(raw.confidence, 0.5),
    fetched_at: asString(raw.fetched_at) ?? new Date().toISOString(),
    cost_usd: asNumber(raw.cost_usd, 0),
    score_block: scoreBlock,
    score_impact: impact,
    affects_score: typeof rawAffectsScore === "boolean" ? rawAffectsScore : impact === "positive" || impact === "negative",
    raw_status: asString(raw.raw_status) ?? asString(raw.cost_posture) ?? asString(raw.status),
  };
}

function normalizeScreeningReports(value: unknown): ScreeningReport[] {
  return Array.isArray(value)
    ? value.map(normalizeScreeningReport).filter((item): item is ScreeningReport => Boolean(item))
    : [];
}

function normalizeMissingEvidence(value: unknown): MissingEvidence {
  const raw = asRecord(value);
  return {
    block: asString(raw.block) ?? asString(raw.type) ?? "evidence_gap",
    status: asString(raw.status) ?? "pending_human_input",
    recommended_next_step:
      asString(raw.recommended_next_step) ??
      asString(raw.detail) ??
      asString(raw.summary) ??
      "补充该证据后重新评估。",
  };
}

function normalizeAddressFootprint(value: unknown): AddressFootprint | undefined {
  const raw = asRecord(value);
  if (Object.keys(raw).length === 0) return undefined;
  const locations = (Array.isArray(raw.locations) ? raw.locations : [])
    .map((item, index): AddressFootprintLocation => {
      const location = asRecord(item);
      const validation = asRecord(location.address_validation ?? location.addressValidation);
      return {
        google_place_id: asString(location.google_place_id ?? location.googlePlaceId),
        display_name:
          asString(location.display_name ?? location.displayName) ??
          `Google Maps location ${index + 1}`,
        address_type: asString(location.address_type ?? location.addressType) ?? "unknown_business_location",
        relationship_status:
          asString(location.relationship_status ?? location.relationshipStatus) ?? "possible_related_location",
        formatted_address:
          asString(location.formatted_address ?? location.formattedAddress ?? location.address) ?? "",
        city: asString(location.city),
        region: asString(location.region),
        country: asString(location.country),
        business_status: asString(location.business_status ?? location.businessStatus),
        website_uri: asString(location.website_uri ?? location.websiteUri),
        google_maps_uri: asString(location.google_maps_uri ?? location.googleMapsUri),
        match_confidence: typeof (location.match_confidence ?? location.matchConfidence) === "number"
          ? (location.match_confidence ?? location.matchConfidence) as number
          : undefined,
        match_reasons: asStringArray(location.match_reasons ?? location.matchReasons),
        address_validation: Object.keys(validation).length
          ? {
              status: asString(validation.status),
              address_complete:
                typeof validation.address_complete === "boolean"
                  ? validation.address_complete
                  : typeof validation.addressComplete === "boolean"
                    ? validation.addressComplete
                    : undefined,
              possible_next_action: asString(validation.possible_next_action ?? validation.possibleNextAction),
            }
          : undefined,
      };
    })
    .filter((location) => location.formatted_address || location.google_maps_uri || location.google_place_id);
  const scope = asRecord(raw.search_scope ?? raw.searchScope);
  const summary = asRecord(raw.summary);
  return {
    section_title: asString(raw.section_title ?? raw.sectionTitle) ?? "Google Maps 地址版图",
    coverage_status:
      raw.coverage_status === "found" ||
      raw.coverage_status === "partial" ||
      raw.coverage_status === "not_found" ||
      raw.coverage_status === "unavailable_api" ||
      raw.coverage_status === "not_checked"
        ? raw.coverage_status
        : "not_checked",
    search_scope: {
      queries_run: asStringArray(scope.queries_run ?? scope.queriesRun),
      countries: asStringArray(scope.countries),
      capped: asBoolean(scope.capped),
      limitations: asStringArray(scope.limitations),
    },
    summary: {
      total_locations: asNumber(summary.total_locations ?? summary.totalLocations, locations.length),
      confirmed_locations: asNumber(summary.confirmed_locations ?? summary.confirmedLocations, locations.filter((item) => item.relationship_status === "confirmed_company_location").length),
      probable_locations: asNumber(summary.probable_locations ?? summary.probableLocations, locations.filter((item) => item.relationship_status === "probable_company_location").length),
      possible_related_locations: asNumber(summary.possible_related_locations ?? summary.possibleRelatedLocations, locations.filter((item) => item.relationship_status === "possible_related_location").length),
      operational_locations: asNumber(summary.operational_locations ?? summary.operationalLocations, locations.filter((item) => item.business_status === "OPERATIONAL").length),
      closed_locations: asNumber(summary.closed_locations ?? summary.closedLocations, locations.filter((item) => /CLOSED/i.test(item.business_status ?? "")).length),
      countries: asStringArray(summary.countries),
      cities: asStringArray(summary.cities),
    },
    locations,
    open_questions: asStringArray(raw.open_questions ?? raw.openQuestions),
  };
}

function normalizeInvestigationTarget(
  value: unknown,
  targetSource: ScreeningReport["target_source"],
  reportId: string,
  leadId: string | null,
): InvestigationTarget {
  const raw = asRecord(value);
  const productInterest = asStringArray(raw.product_interest);
  return {
    target_id: asString(raw.target_id) ?? asString(raw.lead_id) ?? leadId ?? reportId,
    source: normalizeTargetSource(raw.source ?? targetSource),
    lead_id: asString(raw.lead_id) ?? leadId,
    company_name: asString(raw.company_name),
    country: asString(raw.country),
    website: asString(raw.website),
    domain: asString(raw.domain),
    email: asString(raw.email),
    contact_person: asString(raw.contact_person),
    contact_title: asString(raw.contact_title),
    social_or_profile_url: asString(raw.social_or_profile_url),
    product_interest: productInterest.length > 0 ? productInterest : asStringArray(raw.matched_products),
    operator_notes: asString(raw.operator_notes),
    sec_cik: asString(raw.sec_cik),
    supplied_fields: asStringArray(raw.supplied_fields),
    inferred_fields: asStringArray(raw.inferred_fields),
    missing_fields: asStringArray(raw.missing_fields),
  };
}

function normalizeScreeningReport(value: unknown): ScreeningReport | undefined {
  const raw = asRecord(value);
  const reportId = asString(raw.report_id);
  const companyName = asString(raw.company_name);
  if (!reportId || !companyName) return undefined;
  const evidence = Array.isArray(raw.evidence) ? raw.evidence.map(normalizeEvidenceItem) : [];
  const scoreBlocks = Array.isArray(raw.score_blocks) ? raw.score_blocks.map(normalizeScoreBlock) : [];
  const missing = Array.isArray(raw.missing_or_unavailable_evidence)
    ? raw.missing_or_unavailable_evidence.map(normalizeMissingEvidence)
    : [];
  const targetSource = normalizeTargetSource(raw.target_source);
  const leadId = asString(raw.lead_id) ?? null;
  const scaleAssessment = asRecord(raw.company_scale_assessment ?? raw.companyScaleAssessment);
  const scaleClass = asString(scaleAssessment.scale_class ?? scaleAssessment.scaleClass);
  const firstBlockStrategy = asString(scaleAssessment.first_block_strategy ?? scaleAssessment.firstBlockStrategy);
  let companyScaleAssessment: ScreeningReport["company_scale_assessment"];
  if (
    (
      scaleClass === "listed_or_public" ||
      scaleClass === "medium_large_registered" ||
      scaleClass === "small_local_offline" ||
      scaleClass === "small_online_only" ||
      scaleClass === "unknown_scale"
    ) &&
    (
      firstBlockStrategy === "registry_disclosure_primary_maps_support" ||
      firstBlockStrategy === "maps_physical_address_primary" ||
      firstBlockStrategy === "domain_public_source_primary" ||
      firstBlockStrategy === "try_registry_and_maps"
    )
  ) {
    companyScaleAssessment = {
      scale_class: scaleClass,
      confidence: typeof scaleAssessment.confidence === "number" ? scaleAssessment.confidence : undefined,
      rationale: asString(scaleAssessment.rationale ?? scaleAssessment.reason ?? scaleAssessment.summary) ?? "背调员工未返回公司规模判断说明。",
      first_block_strategy: firstBlockStrategy,
    };
  }
  return {
    report_id: reportId,
    lead_id: leadId,
    target_source: targetSource,
    target: normalizeInvestigationTarget(raw.target, targetSource, reportId, leadId),
    company_name: companyName,
    company_scale_assessment: companyScaleAssessment,
    risk_tier: normalizeRiskTier(raw.risk_tier),
    normalized_score: typeof raw.normalized_score === "number" ? raw.normalized_score : null,
    evidence_coverage: asNumber(raw.evidence_coverage, 0),
    recommended_action: asString(raw.recommended_action) ?? "",
    score_blocks: scoreBlocks,
    evidence,
    address_footprint: normalizeAddressFootprint(raw.address_footprint ?? raw.addressFootprint),
    open_questions: Array.isArray(raw.open_questions) ? raw.open_questions.map((item) => String(item)) : [],
    missing_or_unavailable_evidence: missing,
    created_at: asString(raw.created_at) ?? new Date().toISOString(),
  };
}

function riskClass(tier: RiskTier) {
  if (tier === "trusted_candidate") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tier === "cautious") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tier === "high_risk") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function extractReportsFromEmployeeText(text: string): ScreeningReport[] {
  const start = text.indexOf(REPORT_JSON_START);
  const end = text.indexOf(REPORT_JSON_END);
  if (start === -1 || end === -1 || end <= start) return [];
  const raw = text.slice(start + REPORT_JSON_START.length, end).trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  const reports = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { reports?: unknown }).reports)
      ? (parsed as { reports: unknown[] }).reports
      : [];
  return normalizeScreeningReports(reports);
}

function readStoredScreeningState(): ScreeningStoredState | undefined {
  try {
    const raw = window.localStorage.getItem(SCREENING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScreeningStoredState) : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredScreeningState(state: ScreeningStoredState) {
  try {
    window.localStorage.setItem(SCREENING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is best-effort; blocked storage should not break live investigations.
  }
}

export default function CrossBorderScreeningPage() {
  const chatRef = useRef<AgentChatHandle | null>(null);
  const { state: gatewayState } = useGateway();
  const { data: screeningAgent, loading: screeningAgentLoading } = useAgent(SCREENING_AGENT_ID);
  const [tab, setTab] = useState<"batch" | "manual">("manual");
  const [batchJson, setBatchJson] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("GB");
  const [website, setWebsite] = useState("");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [secCik, setSecCik] = useState("");
  const [productInterest, setProductInterest] = useState("phone case, USB-C charger");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [enablePaidEmailValidation, setEnablePaidEmailValidation] = useState(true);
  const [enablePaidTradeData, setEnablePaidTradeData] = useState(true);
  const [maxPaidSpendUsd, setMaxPaidSpendUsd] = useState(5);
  const [reports, setReports] = useState<ScreeningReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>();
  const [envStatus, setEnvStatus] = useState<ScreeningEnvStatus | undefined>();
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [runMessage, setRunMessage] = useState("等待输入背调对象");
  const [screeningSessionKey, setScreeningSessionKey] = useState<string | undefined>();
  const [hasHydratedState, setHasHydratedState] = useState(false);

  const selectedReport = reports.find((report) => report.report_id === selectedReportId) ?? reports[0];
  const groupedEvidence = useMemo(() => groupEvidence(selectedReport?.evidence ?? []), [selectedReport]);

  useEffect(() => {
    const stored = readStoredScreeningState();
    if (stored) {
      setTab(stored.tab);
      setBatchJson(stored.batchJson);
      setCompanyName(stored.companyName);
      setCountry(stored.country);
      setWebsite(stored.website);
      setDomain(stored.domain);
      setEmail(stored.email);
      setContactPerson(stored.contactPerson);
      setContactTitle(stored.contactTitle);
      setProfileUrl(stored.profileUrl);
      setSecCik(stored.secCik);
      setProductInterest(stored.productInterest);
      setOperatorNotes(stored.operatorNotes);
      setEnablePaidEmailValidation(stored.enablePaidEmailValidation);
      setEnablePaidTradeData(stored.enablePaidTradeData);
      setMaxPaidSpendUsd(stored.maxPaidSpendUsd);
      const storedReports = normalizeScreeningReports(stored.reports);
      setReports(storedReports);
      setSelectedReportId(
        storedReports.some((report) => report.report_id === stored.selectedReportId)
          ? stored.selectedReportId
          : storedReports[0]?.report_id,
      );
      setEnvStatus(stored.envStatus);
      setRunStatus(stored.runStatus === "running" ? "idle" : stored.runStatus);
      setRunMessage(stored.runStatus === "running" ? "上次背调未完成，请重新发起调查" : stored.runMessage);
      setScreeningSessionKey(stored.screeningSessionKey);
    }
    setHasHydratedState(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedState) return;
    writeStoredScreeningState({
      tab,
      batchJson,
      companyName,
      country,
      website,
      domain,
      email,
      contactPerson,
      contactTitle,
      profileUrl,
      secCik,
      productInterest,
      operatorNotes,
      enablePaidEmailValidation,
      enablePaidTradeData,
      maxPaidSpendUsd,
      reports,
      selectedReportId,
      envStatus,
      runStatus,
      runMessage,
      screeningSessionKey,
    });
  }, [
    batchJson,
    companyName,
    contactPerson,
    contactTitle,
    country,
    domain,
    email,
    enablePaidEmailValidation,
    enablePaidTradeData,
    envStatus,
    hasHydratedState,
    maxPaidSpendUsd,
    operatorNotes,
    productInterest,
    profileUrl,
    reports,
    runMessage,
    runStatus,
    secCik,
    selectedReportId,
    screeningSessionKey,
    tab,
    website,
  ]);

  const sourceStatuses = [
    {
      label: "Tavily 公开搜索",
      note: envStatus ? (envStatus.tavily_search?.configured ? "已配置，员工工具可调用" : "缺少 TAVILY_API_KEY") : "由背调员工执行时检测",
      icon: envStatus?.tavily_search?.configured ? CheckCircle2 : Lock,
    },
    {
      label: "Companies House",
      note: envStatus ? (envStatus.companies_house?.configured ? "已配置，英国主体核验" : "未配置") : "由背调员工执行时检测",
      icon: envStatus?.companies_house?.configured ? CheckCircle2 : Lock,
    },
    {
      label: "Google Maps",
      note: envStatus
        ? envStatus.google_maps?.configured
          ? "已配置，本地足迹/地址一致性可用"
          : "缺少 GOOGLE_MAPS_API_KEY"
        : "由背调员工执行时检测",
      icon: envStatus?.google_maps?.configured ? CheckCircle2 : Lock,
    },
    {
      label: "Abstract / Hunter",
      note: envStatus
        ? envStatus.abstract_email_validation?.configured || envStatus.hunter_email_verifier?.configured
          ? "已配置，邮箱验证可用"
          : "未配置"
        : "由背调员工执行时检测",
      icon:
        envStatus?.abstract_email_validation?.configured || envStatus?.hunter_email_verifier?.configured
          ? CheckCircle2
          : Lock,
    },
    {
      label: "ImportYeti",
      note: envStatus
        ? envStatus.importyeti_trade_data?.enabled
          ? `已启用，预算 $${envStatus.paid_trade_data?.max_paid_spend_usd ?? 0}`
          : envStatus.importyeti_trade_data?.configured
            ? "key 已配置，等待预算/开关"
            : "未配置"
        : "由背调员工执行时检测",
      icon: envStatus?.importyeti_trade_data?.enabled ? CheckCircle2 : Lock,
    },
    {
      label: "SEC EDGAR",
      note: envStatus
        ? envStatus.sec_edgar?.user_agent_configured
          ? "无需 API key，User-Agent 已配置"
          : "无需 API key，使用默认 User-Agent"
        : "无需 API key，员工按需调用",
      icon: CheckCircle2,
    },
  ];

  const buildScreeningPayload = useCallback((): Record<string, unknown> => {
    let payload: Record<string, unknown>;
    if (tab === "manual") {
      payload = {
        mode: "manual",
        manual_target: {
          source: "manual_input",
          company_name: companyName,
          country,
          website,
          domain,
          email,
          contact_person: contactPerson,
          contact_title: contactTitle,
          social_or_profile_url: profileUrl,
          sec_cik: secCik,
          product_interest: parseProductInterest(productInterest),
          operator_notes: operatorNotes,
        },
      };
    } else {
      const parsed = JSON.parse(batchJson || "[]") as unknown;
      const targets = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { leads?: unknown }).leads)
          ? (parsed as { leads: unknown[] }).leads
          : [];
      payload = { mode: "batch", targets };
    }
    payload.enable_paid_email_validation = enablePaidEmailValidation;
    payload.enable_paid_trade_data = enablePaidTradeData;
    payload.max_paid_spend_usd = maxPaidSpendUsd;
    return payload;
  }, [
    batchJson,
    companyName,
    contactPerson,
    contactTitle,
    country,
    domain,
    email,
    enablePaidEmailValidation,
    enablePaidTradeData,
    maxPaidSpendUsd,
    operatorNotes,
    productInterest,
    profileUrl,
    secCik,
    tab,
    website,
  ]);

  const buildEmployeePrompt = useCallback((payload: Record<string, unknown>) => {
    return `${SCREENING_TASK_PREFIX}
你是 OpenClaw 员工 \`${SCREENING_AGENT_ID}\`。请你真实执行跨境买家背调，不要使用 Dashboard mock 数据，不要臆造证据。

执行要求：
1. 按你的 skills 走低成本证据阶梯：company scale assessment -> 公司注册与线下门店/地址 -> domain/email -> Google Maps address footprint/local presence -> public footprint -> trade/customs -> SEC/financial/public filing -> behavior only if supplied.
2. 对 GB 目标必须先调用 Companies House / cross-border-intel registry tools；无命中、401/403、歧义或公司不适用时，再用官方 Companies House public page / web_search/fetch 补证。
3. 对 US 目标必须先调用 SEC no-key public data：有 CIK 传 CIK，没有 CIK 就把 company_name 传给 cross-border-intel SEC tool 解析 company_tickers.json；SEC not_found 只说明可能是私营/非申报主体，然后再查州 registry / 官方网页。
4. 如果 enable_paid_email_validation=true 且输入没有 email，先从目标官网公开 contact/about/sales/wholesale/support 页面寻找同域邮箱，再用 cross-border-intel email_domain_check 对找到的同域邮箱做 Abstract/Hunter paid validation；如果官网没有同域邮箱，才做 domain-only DNS 并记录 direct_contact_validation 缺口。
5. 每个目标都必须尝试 Google Maps 地址版图：用 company/legal/brand、country、city/region、website domain、phone 和官网 location/store/address 页面线索构造最多 6 组 Text Search 查询，调用 cross-border-intel__cbe_intel_google_places_search 找办公室/总部、门店、仓库/分销点、服务/维修点候选。
6. 对地址候选按 google_place_id、formatted_address、phone、website domain、display_name 去重；对短名单调用 cross-border-intel__cbe_intel_google_place_details，参数使用 field_mask_profile="screening_address_footprint"、purpose="screening"；对完整地址在上限内调用 cross-border-intel__cbe_intel_google_address_validate。
7. 评分前必须输出 company_scale_assessment：scale_class 只能是 listed_or_public、medium_large_registered、small_local_offline、small_online_only、unknown_scale；first_block_strategy 只能是 registry_disclosure_primary_maps_support、maps_physical_address_primary、domain_public_source_primary、try_registry_and_maps。
8. legal_identity 的展示含义是“公司注册与线下门店/地址”，固定 25 分。listed_or_public / medium_large_registered 必须融合注册/披露证据 + Google Maps 地址一致性，不能只靠 Maps 拿满分；small_local_offline 如果有 confirmed/probable 且 OPERATIONAL 的 Google Maps 物理地址、名称/类别/城市匹配且无矛盾证据，可以把 legal_identity 按真实线下经营计算。报告措辞用“线下经营真实性由 Google Maps 公开门店/地址证据支持”，不要写成正式 KYB 或法律注册证明。
9. address_footprint 是必填报告对象；即使 Google API 不可用、无结果或搜索触发上限，也要写 coverage_status、limitations 和 open_questions。
10. 可用时调用 cross-border-intel MCP 工具；工具或 API key 不可用时标记为 coverage gap，不要当成负面证据。
11. 公开 scam/fraud/complaint 结果只有在命中目标公司名或目标域名时才可作为负面证据；通用消费者警示页只能作为 coverage_only。
12. 最终 normalized_score 必须把证据覆盖率纳入分数：证据质量分 80% + 证据覆盖率分 20%；risk_tier 只按最终分判断，80-100 为 trusted_candidate，60-79 为 cautious，60 以下为 high_risk；完全无法计算时才用 insufficient_evidence。
13. 不允许自动外联，不允许登录态社媒抓取，不允许泄露 API key。

背调输入 JSON：
${JSON.stringify(payload, null, 2)}

输出要求：
- 先给简短中文结论。
- 然后必须输出可被 Dashboard 解析的 JSON，放在以下两个标记之间，不要用 Markdown 代码块：
${REPORT_JSON_START}
[
  {
    "report_id": "screen-...",
    "lead_id": null,
    "target_source": "manual_input",
    "target": {},
    "company_name": "...",
    "company_scale_assessment": {
      "scale_class": "unknown_scale",
      "confidence": 0,
      "rationale": "",
      "first_block_strategy": "try_registry_and_maps"
    },
    "risk_tier": "trusted_candidate|cautious|insufficient_evidence|high_risk",
    "normalized_score": 0,
    "evidence_coverage": 0,
    "recommended_action": "...",
    "score_blocks": [],
    "evidence": [],
    "address_footprint": {
      "section_title": "Google Maps 地址版图",
      "coverage_status": "found|partial|not_found|unavailable_api|not_checked",
      "search_scope": { "queries_run": [], "countries": [], "capped": false, "limitations": [] },
      "summary": {
        "total_locations": 0,
        "confirmed_locations": 0,
        "probable_locations": 0,
        "possible_related_locations": 0,
        "operational_locations": 0,
        "closed_locations": 0,
        "countries": [],
        "cities": []
      },
      "locations": [],
      "open_questions": []
    },
    "open_questions": [],
    "missing_or_unavailable_evidence": [],
    "created_at": "ISO timestamp"
  }
]
${REPORT_JSON_END}`;
  }, []);

  async function runScreening() {
    if (gatewayState !== "connected") {
      setRunStatus("error");
      setRunMessage("OpenClaw Gateway 未连接，无法让背调员工执行任务。");
      return;
    }
    if (screeningAgentLoading) {
      setRunStatus("error");
      setRunMessage("正在确认背调员工是否已注册，请稍后重试。");
      return;
    }
    if (!screeningAgent) {
      setRunStatus("error");
      setRunMessage("未在 OpenClaw 注册 cbe-buyer-screening。请先运行 scripts/sentura-setup.sh 后刷新页面。");
      return;
    }
    if (!chatRef.current) {
      setRunStatus("error");
      setRunMessage("背调员工对话尚未初始化，请稍后重试。");
      return;
    }
    try {
      const payload = buildScreeningPayload();
      setReports([]);
      setSelectedReportId(undefined);
      setRunStatus("running");
      setRunMessage("已提交给 cbe-buyer-screening 员工，等待工具调用和结构化报告。");
      await chatRef.current.sendMessage(buildEmployeePrompt(payload));
    } catch (error) {
      setRunStatus("error");
      setRunMessage(error instanceof Error ? error.message : "背调员工任务提交失败");
    }
  }

  const handleEmployeeMessage = useCallback((message: ChatMessage) => {
    if (message.role !== "assistant") return;
    if (runStatus !== "running") return;
    try {
      const nextReports = extractReportsFromEmployeeText(message.text);
      if (nextReports.length === 0) {
        setRunStatus("error");
        setRunMessage("背调员工已回复，但没有返回可解析的 ScreeningReport JSON。请查看右侧对话并要求员工按指定标记补交 JSON。");
        return;
      }
      setReports(nextReports);
      setSelectedReportId(nextReports[0]?.report_id);
      setRunStatus("ready");
      setRunMessage(`背调员工已完成 ${nextReports.length} 个目标的调查报告`);
    } catch (error) {
      setRunStatus("error");
      setRunMessage(error instanceof Error ? error.message : "无法解析背调员工返回的报告 JSON");
    }
  }, [runStatus]);

  const handleEmployeeToolCall = useCallback((event: ToolCallEvent) => {
    if (event.phase === "start") {
      setRunMessage(`背调员工正在调用工具：${event.toolName}`);
    } else if (event.phase === "error") {
      setRunMessage(`背调员工工具失败：${event.toolName}`);
    } else if (event.phase === "result") {
      setRunMessage(`背调员工已收到工具结果：${event.toolName}`);
    }
  }, []);

  function exportSelectedReport() {
    if (!selectedReport) return;
    const blob = new Blob([JSON.stringify(selectedReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedReport.report_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-full bg-muted/20 p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>跨境电商 / 背调筛选 / Phase 1</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">买家背调工作台</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" />
            员工执行
          </Badge>
          <Badge variant={gatewayState === "connected" ? "outline" : "destructive"} className="gap-1">
            <Globe2 className="h-3 w-3" />
            Gateway {gatewayState === "connected" ? "已连接" : "未连接"}
          </Badge>
          <Badge variant={screeningAgent ? "outline" : "destructive"} className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {screeningAgent ? "员工已注册" : screeningAgentLoading ? "检查员工" : "员工未注册"}
          </Badge>
          <Badge variant={runStatus === "error" ? "destructive" : "outline"} className="gap-1">
            {runStatus === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : <SearchCheck className="h-3 w-3" />}
            {runStatus === "ready" ? "报告可复核" : runStatus === "running" ? "运行中" : runStatus === "error" ? "需调整" : "未运行"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        <aside className="rounded-md border bg-background p-3">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">输入与数据源</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">提交给 OpenClaw 背调员工执行，默认低成本路线优先</p>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1">
            <Button variant={tab === "batch" ? "default" : "ghost"} size="sm" onClick={() => setTab("batch")}>
              来自获客列表
            </Button>
            <Button variant={tab === "manual" ? "default" : "ghost"} size="sm" onClick={() => setTab("manual")}>
              手动背调
            </Button>
          </div>

          {tab === "batch" ? (
            <section className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">粘贴 LeadCandidate[] 或 {"{\"leads\": [...]}"}</div>
              <textarea
                className="min-h-44 w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={batchJson}
                onChange={(event) => setBatchJson(event.target.value)}
                placeholder='[{"lead_id":"lead_...","company_name":"...","country":"GB","website":"https://..."}]'
              />
            </section>
          ) : (
            <section className="space-y-2">
              <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="公司名称" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} placeholder="国家，如 GB" />
                <Input value={secCik} onChange={(event) => setSecCik(event.target.value)} placeholder="SEC CIK（可选）" />
              </div>
              <Input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="网站 / Website" />
              <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="域名 / Domain" />
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="邮箱 / Email" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} placeholder="联系人" />
                <Input value={contactTitle} onChange={(event) => setContactTitle(event.target.value)} placeholder="职位" />
              </div>
              <Input value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder="社媒/公开资料 URL" />
              <Input value={productInterest} onChange={(event) => setProductInterest(event.target.value)} placeholder="产品兴趣，逗号分隔" />
              <textarea
                className="min-h-20 w-full rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={operatorNotes}
                onChange={(event) => setOperatorNotes(event.target.value)}
                placeholder="操作员备注 / Accio 行为线索"
              />
            </section>
          )}

          <section className="mt-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">数据源与预算</div>
            <label className="flex items-center justify-between rounded-md border bg-muted/20 px-2 py-1.5 text-xs">
              Abstract/Hunter 邮箱验证
              <input
                type="checkbox"
                checked={enablePaidEmailValidation}
                onChange={(event) => setEnablePaidEmailValidation(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-md border bg-muted/20 px-2 py-1.5 text-xs">
              ImportYeti 付费贸易数据
              <input
                type="checkbox"
                checked={enablePaidTradeData}
                onChange={(event) => setEnablePaidTradeData(event.target.checked)}
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              单次预算上限 USD
              <Input
                type="number"
                min={0}
                max={500}
                value={maxPaidSpendUsd}
                onChange={(event) => setMaxPaidSpendUsd(Number(event.target.value) || 0)}
              />
            </label>
          </section>

          <section className="mt-4 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">实时来源状态</div>
            {sourceStatuses.map((source) => (
              <div key={source.label} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                <source.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{source.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{source.note}</div>
                </div>
              </div>
            ))}
          </section>

          <Button className="mt-4 w-full" onClick={runScreening} disabled={runStatus === "running" || screeningAgentLoading}>
            {runStatus === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            让背调员工开始调查
          </Button>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="rounded-md border bg-background">
            <div className="flex flex-col gap-2 border-b px-3 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold">调查队列</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{runMessage}</p>
              </div>
              <Button size="sm" variant="outline" onClick={exportSelectedReport} disabled={!selectedReport}>
                <Download className="h-3.5 w-3.5" />
                导出报告 JSON
              </Button>
            </div>
            <div className="grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
              {reports.length === 0 ? (
                <div className="col-span-full px-3 py-8 text-center text-sm text-muted-foreground">
                  输入目标后点击“让背调员工开始调查”，这里会显示员工返回的结构化报告。
                </div>
              ) : (
                reports.map((report) => (
                  <button
                    key={report.report_id}
                    type="button"
                    onClick={() => setSelectedReportId(report.report_id)}
                    className={cn(
                      "flex min-h-24 flex-col items-start gap-2 px-3 py-3 text-left text-sm hover:bg-muted/40",
                      selectedReport?.report_id === report.report_id && "bg-muted/50",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate font-medium">{report.company_name}</span>
                      <Badge variant="outline" className={cn("shrink-0", riskClass(report.risk_tier))}>
                        {riskLabels[report.risk_tier]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      分数 {report.normalized_score ?? "N/A"} · 覆盖 {percent(report.evidence_coverage)}
                    </div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{report.recommended_action}</div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-md border bg-background">
            <div className="border-b px-3 py-3">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">证据时间线</h2>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                按法律注册、域名/邮箱、公开足迹、贸易/海关、财务/公开申报、行为记录分组
              </p>
            </div>
            <div className="space-y-4 p-3">
              {!selectedReport ? (
                <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                  暂无证据。运行背调后会显示每条证据的来源、时间、置信度、成本和是否影响分数。
                </div>
              ) : (
                (Object.keys(layerLabels) as EvidenceItem["layer"][]).map((layer) => {
                  const items = groupedEvidence[layer] ?? [];
                  return (
                    <div key={layer} className="rounded-md border">
                      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                        <div className="text-sm font-medium">{layerLabels[layer]}</div>
                        <Badge variant="outline">{items.length} 条</Badge>
                      </div>
                      <div className="divide-y">
                        {items.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-muted-foreground">未启用/不可用，或当前目标不适用。</div>
                        ) : (
                          items.map((item, index) => (
                            <div key={`${item.url}-${index}`} className="px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{sourceTypeLabels[item.source_type]}</Badge>
                                <Badge variant={item.score_impact === "negative" ? "destructive" : "outline"}>
                                  {item.score_impact}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{new Date(item.fetched_at).toLocaleString()}</span>
                                <span className="text-xs text-muted-foreground">置信度 {percent(item.confidence)}</span>
                                <span className="text-xs text-muted-foreground">成本 ${item.cost_usd}</span>
                              </div>
                              <div className="mt-2 text-sm">{item.finding}</div>
                              <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary">
                                {item.url}
                              </a>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-md border bg-background">
            <div className="border-b px-3 py-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">评分与报告</h2>
              </div>
            </div>
            {selectedReport ? (
              <div className="space-y-4 p-3">
                <div className={cn("rounded-md border px-3 py-3", riskClass(selectedReport.risk_tier))}>
                  <div className="text-xs">跟进评级</div>
                  <div className="mt-1 text-xl font-semibold">{riskLabels[selectedReport.risk_tier]}</div>
                  <div className="mt-1 text-sm">
                    {selectedReport.normalized_score ?? "N/A"}/100 · 证据覆盖 {percent(selectedReport.evidence_coverage)}
                  </div>
                </div>

                {selectedReport.company_scale_assessment ? (
                  <div className="rounded-md border bg-muted/20 px-3 py-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">公司规模评估</span>
                      <Badge variant="outline">
                        {scaleClassLabels[selectedReport.company_scale_assessment.scale_class]}
                      </Badge>
                      <Badge variant="outline">
                        {firstBlockStrategyLabels[selectedReport.company_scale_assessment.first_block_strategy]}
                      </Badge>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {selectedReport.company_scale_assessment.rationale}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">证据覆盖</div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: percent(selectedReport.evidence_coverage) }} />
                  </div>
                </div>

                {selectedReport.address_footprint ? (
                  <div className="rounded-md border-2 border-sky-200 bg-sky-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-sky-950">
                        <MapPin className="h-4 w-4 text-sky-700" />
                        {selectedReport.address_footprint.section_title}
                      </div>
                      <Badge variant="outline" className="bg-white">
                        {selectedReport.address_footprint.coverage_status}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border bg-white px-2 py-1.5">
                        地址 {selectedReport.address_footprint.summary.total_locations}
                      </div>
                      <div className="rounded-md border bg-white px-2 py-1.5">
                        营业 {selectedReport.address_footprint.summary.operational_locations}
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedReport.address_footprint.locations.slice(0, 8).map((location, index) => (
                        <div key={`${location.google_place_id ?? location.formatted_address}-${index}`} className="rounded-md border bg-white px-2 py-2 text-xs">
                          <div className="font-medium text-slate-950">{location.display_name}</div>
                          <div className="mt-1 leading-5 text-muted-foreground">{location.formatted_address}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline">{location.relationship_status}</Badge>
                            <Badge variant="secondary">{location.address_type}</Badge>
                          </div>
                        </div>
                      ))}
                      {selectedReport.address_footprint.locations.length === 0 ? (
                        <div className="rounded-md border bg-white px-2 py-2 text-xs text-muted-foreground">
                          未发现可确认的 Google Maps 地址。
                        </div>
                      ) : null}
                    </div>
                    {selectedReport.address_footprint.search_scope.limitations.length ? (
                      <div className="mt-2 text-xs leading-5 text-sky-900">
                        {selectedReport.address_footprint.search_scope.limitations.join("；")}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">分块计分</div>
                  {selectedReport.score_blocks.map((block) => (
                    <div key={block.block} className="rounded-md border px-2 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-medium">{scoreBlockLabels[block.block] ?? block.block}</div>
                        <Badge variant={block.status === "scored" ? "outline" : "secondary"}>{block.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {block.status === "scored" ? `${block.earned_points}/${block.max_points}` : block.reason ?? block.summary}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="text-xs font-medium text-muted-foreground">建议动作</div>
                  <p className="mt-1 text-sm">{selectedReport.recommended_action}</p>
                </div>

                {selectedReport.missing_or_unavailable_evidence.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      缺口 / 未启用证据
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {selectedReport.missing_or_unavailable_evidence.slice(0, 5).map((item, index) => (
                        <li key={`${item.block}-${index}`}>{item.status}: {item.recommended_next_step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">暂无报告</div>
            )}
          </section>

          <section className="rounded-md border bg-background">
            <div className="flex items-center justify-between border-b px-3 py-3">
              <div>
                <h2 className="text-sm font-semibold">背调员工对话</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">正式背调由这个 OpenClaw 员工会话执行</p>
              </div>
              <FileJson className="h-4 w-4 text-muted-foreground" />
            </div>
            <AgentChat
              ref={chatRef}
              agentId={SCREENING_AGENT_ID}
              sessionKey={screeningSessionKey}
              sessionLabel="CBE Screening"
              onSessionCreated={setScreeningSessionKey}
              onMessage={handleEmployeeMessage}
              onToolCall={handleEmployeeToolCall}
              hiddenUserPrefixes={[SCREENING_TASK_PREFIX]}
              initialPrompt={
                selectedReport
                  ? `请复核这份背调报告并指出还需要补充哪些证据：${JSON.stringify({
                      company_name: selectedReport.company_name,
                      risk_tier: selectedReport.risk_tier,
                      normalized_score: selectedReport.normalized_score,
                      evidence_coverage: selectedReport.evidence_coverage,
                      open_questions: selectedReport.open_questions,
                    })}`
                  : "请根据左侧输入执行跨境买家背调，使用低成本证据优先并输出中文报告。"
              }
              presentation="default"
              className="h-[520px] border-0"
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
