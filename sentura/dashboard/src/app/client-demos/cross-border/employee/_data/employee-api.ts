import type {
  CostBudget,
  CustomerCoverageGap,
  CustomerEvidenceItem,
  CustomerListItem,
  CustomerScoreBlock,
  CustomerScreeningReport,
  MemoryRecordItem,
  CustomerAddressFootprint,
  CompanyScaleAssessment,
  AddressFootprintAddressType,
  AddressFootprintCoverageStatus,
  AddressFootprintRelationshipStatus,
  ScreeningRiskTier,
  ScoreTier,
} from "./employee-data";
import {
  MAX_LEAD_TARGET_COUNT,
  coverageGapsFromScoreBlocks,
  coverageGapActionForBlock,
  coverageGapReasonForBlock,
  estimateLeadTaskCost,
  estimateMemoryTaskCost,
  estimateScreeningTaskCost,
  isGenericCoverageGapReason,
} from "./employee-data";
import {
  ACCIO_AGENT_ID,
  EmployeeTaskError,
  SCREENING_AGENT_ID,
  createPlannedEmployeeSessionKey,
  type AccioMemoryTaskInput,
  type CbeEmployeeAgentId,
  type EmployeeLeadTaskInput,
  type EmployeeScreeningTaskOptions,
  type ManualScreeningInput,
  type ScreeningTarget,
} from "./employee-task-runner";
import type { CbeEmployeeTaskRecord, CbeEmployeeTaskStatus } from "@/stores/use-cbe-employee-store";

type JsonRecord = Record<string, unknown>;

interface ApiPage<T> {
  items: T[];
  limit?: number;
  offset?: number;
}

interface ApiAgentRun {
  id: string;
  agentId?: CbeEmployeeAgentId;
  agent_id?: CbeEmployeeAgentId;
  taskKind?: string;
  task_kind?: string;
  status: string;
  targetSummary?: string | null;
  target_summary?: string | null;
  currentStage?: string | null;
  current_stage?: string | null;
  sessionKey?: string | null;
  session_key?: string | null;
  startedAt?: string;
  started_at?: string;
  lastActivityAt?: string | null;
  last_activity_at?: string | null;
  finishedAt?: string | null;
  finished_at?: string | null;
  errorCode?: string | null;
  error_code?: string | null;
  errorMessage?: string | null;
  error_message?: string | null;
  metadataJson?: JsonRecord;
  metadata_json?: JsonRecord;
}

interface ApiLeadRun {
  id: string;
  agentRunId: string | null;
  status: string;
  targetCount: number;
  completedAt: string | null;
}

interface ApiLeadCandidate {
  id: string;
  companyName: string;
  normalizedDomain: string | null;
  country: string | null;
  status: string;
}

export interface ApiScreeningBatch {
  id: string;
  parentAgentRunId: string;
  requestedTargetCount: number;
  executionMode: string;
  status: string;
  aggregate: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    retryable: number;
    terminal: number;
  };
}

export interface ApiScreeningChildRun {
  batchTargetId: string;
  targetOrder: number;
  status: string;
  agentRun: ApiAgentRun;
  target: ScreeningTarget;
  paidSourcePolicy?: {
    paidEmailValidation?: {
      enabled?: boolean;
      allowed?: boolean;
      reapprovalRequired?: boolean;
      callCount?: number;
      callStatus?: string;
    };
    paidTradeData?: {
      enabled?: boolean;
      allowed?: boolean;
      reapprovalRequired?: boolean;
      callCount?: number;
      callStatus?: string;
      budgetUsd?: number;
      spendUsd?: number;
    };
  };
}

export interface CreateEmployeeScreeningRunResponse {
  agentRun: ApiAgentRun;
  batch?: ApiScreeningBatch | null;
  childRuns?: ApiScreeningChildRun[];
}

export interface CompleteEmployeeScreeningRunResponse {
  agentRun?: ApiAgentRun;
  reports?: unknown[];
  targets?: unknown[];
}

interface ApiLeadSource {
  id: string;
  leadCandidateId: string;
  sourceUrl: string | null;
}

export interface ApiLeadRunReconciliation {
  requestedCount: number;
  returnedCount: number;
  newUniqueCount: number;
  duplicateCount: number;
  missingCount: number;
  topUpNeeded: boolean;
  identityDenylist: string[];
  items: Array<{
    rank: number;
    identityKey: string;
    leadIdentityId: string;
    companyName: string;
    normalizedDomain: string | null;
    country: string | null;
    status: "new_unique" | "duplicate_same_owner" | "duplicate_other_operator";
    duplicateReason: string | null;
    existingCandidateId: string | null;
    existingOwnerUserId: string | null;
    existingOwnerName: string | null;
    savedCandidateId: string | null;
  }>;
}

export interface ApiLeadCoordinatorDecision {
  action:
    | "start_new_run"
    | "join_existing"
    | "offer_near_duplicate_choices"
    | "queue_top_up";
  scopeId?: string;
  leadRunId?: string;
  agentRunId?: string;
  activeAgentRunId?: string;
  workloadStatus?: "running" | "queued";
  availableCount?: number;
  missingCount?: number;
  denylist?: string[];
  similarScopes?: Array<{
    scopeId: string;
    scopeHash: string;
    similarity: number;
    activeAgentRunId: string | null;
    requestedTotal: number;
    producedUniqueCount: number;
    lockedUntil: string | null;
  }>;
}

export interface CreateEmployeeLeadRunResponse {
  agentRun?: ApiAgentRun;
  leadRun?: ApiLeadRun;
  coordinatorDecision: ApiLeadCoordinatorDecision;
}

export interface CompleteEmployeeLeadRunResponse {
  agentRun: ApiAgentRun;
  leadRun: ApiLeadRun;
  candidates: ApiLeadCandidate[];
  sources: ApiLeadSource[];
  reconciliation: ApiLeadRunReconciliation;
  topUp: {
    scopeId: string;
    missingCount: number;
    denylist: string[];
  } | null;
}

interface ApiAccioImport {
  id: string;
  agentRunId: string | null;
  sourceFileName: string | null;
  sourceKind?: string | null;
  inputFormat?: string | null;
  attachmentMetadata?: JsonRecord[];
  validationStatus: string;
  classification: string;
  uploadedAt: string;
}

interface ApiCustomerRecord {
  recordType: string;
  recordId: string;
  companyName: string;
  country: string | null;
  buyerType: string | null;
  domain: string | null;
  matchedProducts?: string[];
  website?: string | null;
  leadStatus: string;
  screeningStatus: string;
  latestScreeningReportId: string | null;
  normalizedScore: number | null;
  evidenceCoverage: number | null;
  recommendedAction?: string | null;
  reportJson?: JsonRecord | null;
  leadAgentRunId?: string | null;
  lead_agent_run_id?: string | null;
  screeningAgentRunId?: string | null;
  screening_agent_run_id?: string | null;
  sourceUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ApiMemoryRecord {
  importId: string;
  summaryId: string | null;
  agentRunId: string | null;
  agentRunStatus: string | null;
  sourceFileName: string | null;
  sourceKind?: string | null;
  inputFormat?: string | null;
  attachmentMetadata?: JsonRecord[];
  companyName: string | null;
  country: string | null;
  conversationCount: number;
  nextActions: string[];
  summaryText: string | null;
  memoryFactStatus: string | null;
  validationStatus: string;
  classification: string;
  uploadedAt: string;
  supplementTarget?: {
    customerId?: string;
    companyName?: string;
    source?: string;
  } | null;
}

export interface EmployeeCostBudgetSnapshot extends CostBudget {
  baseLimitUsd: number;
  activeAllowanceUsd: number;
  limitEnabled: boolean;
  spendUsd: number;
  remainingUsd: number | null;
  updatedAt: string | null;
  source: "server";
}

export class CbeEmployeeApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.name = "CbeEmployeeApiError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

const CBE_USER_ID = process.env.NEXT_PUBLIC_CBE_USER_ID;
const REQUEST_HEADERS = {
  "content-type": "application/json",
  ...(CBE_USER_ID ? { "x-cbe-user-id": CBE_USER_ID } : {}),
};
const EMPLOYEE_TASK_PAGE_SIZE = 100;

const COUNTRY_NAMES: Record<string, string> = {
  BR: "巴西",
  CN: "中国",
  DE: "德国",
  FR: "法国",
  GB: "英国",
  MX: "墨西哥",
  SE: "瑞典",
  US: "美国",
  ZZ: "未确认",
};

const ALLOWED_SOURCE_TYPES = new Set([
  "official_api",
  "official_registry_page",
  "public_web",
  "public_dns",
  "google_maps_places",
  "google_maps_geocoding",
  "google_maps_address_validation",
  "paid_email_validation",
  "paid_trade_data",
  "demo_fixture",
  "self_reported",
  "unverified",
]);

const SCORE_BLOCK_IDS = new Set([
  "legal_identity",
  "domain_email",
  "public_footprint",
  "business_fit",
  "trade_financial",
  "conversation_behavior",
]);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function payloadArray(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  return Array.isArray(record[key]) ? record[key] : [];
}

function asRecordArray(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item) => Object.keys(item).length > 0);
  }
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? [record] : [];
}

async function fetchEmployeeJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...REQUEST_HEADERS,
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    const error = asRecord(body.error);
    throw new CbeEmployeeApiError(
      response.status,
      asString(error.message) ?? `CBE API request failed: ${response.status}`,
      {
        code: asString(error.code),
        details: error.details,
      },
    );
  }
  return body as T;
}

function jsonPost<T>(path: string, body: unknown): Promise<T> {
  return fetchEmployeeJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function jsonPatch<T>(path: string, body: unknown): Promise<T> {
  return fetchEmployeeJson<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function toIsoTimestamp(value: unknown, fallback = new Date().toISOString()) {
  const raw = asString(value);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function toCountryCode(value: unknown) {
  const raw = asString(value)?.toUpperCase();
  return raw && /^[A-Z]{2}$/.test(raw) ? raw : "ZZ";
}

function toOptionalCountryCode(value: unknown) {
  const raw = asString(value)?.toUpperCase();
  return raw && /^[A-Z]{2}$/.test(raw) ? raw : undefined;
}

function toUrl(value: unknown) {
  const raw = asString(value);
  if (!raw) return undefined;
  const candidate = raw.includes("://") ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function toEmail(value: unknown) {
  const raw = asString(value);
  return raw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : undefined;
}

function domainFromUrl(value: string | null | undefined) {
  const url = toUrl(value);
  if (!url) return undefined;
  return new URL(url).hostname.replace(/^www\./, "");
}

function countryName(code: string | null | undefined) {
  return code ? COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase() : "未确认";
}

function scoreTier(score?: number | null): ScoreTier | undefined {
  if (typeof score !== "number") return undefined;
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function screeningStatusFromRecord(record: ApiCustomerRecord): CustomerListItem["screeningStatus"] {
  if (record.leadStatus === "failed") return "failed";
  if (record.screeningStatus === "running" || record.screeningStatus === "polling") return "running";
  if (record.screeningStatus === "insufficient_evidence" && typeof record.normalizedScore !== "number") return "insufficient_evidence";
  if (record.screeningStatus === "trusted_candidate" || record.screeningStatus === "cautious" || record.screeningStatus === "high_risk") {
    return "screened";
  }
  return "not_started";
}

function normalizeRiskTier(value: unknown, score?: number | null): ScreeningRiskTier {
  if (typeof score === "number") {
    if (score >= 80) return "trusted_candidate";
    if (score >= 60) return "cautious";
    return "high_risk";
  }
  if (value === "trusted_candidate" || value === "cautious" || value === "insufficient_evidence" || value === "high_risk") {
    return value;
  }
  return "insufficient_evidence";
}

function scoreBlockId(value: unknown) {
  const raw = asString(value) ?? "public_footprint";
  return SCORE_BLOCK_IDS.has(raw) ? raw : "public_footprint";
}

function sourceType(value: unknown) {
  const raw = asString(value) ?? "public_web";
  return ALLOWED_SOURCE_TYPES.has(raw) ? raw : "public_web";
}

function isNonEmptyRecord(value: JsonRecord) {
  return Object.keys(value).length > 0;
}

function firstTextValue(...values: unknown[]) {
  for (const value of values) {
    const direct = asString(value);
    if (direct) return direct;
    if (Array.isArray(value)) {
      const joined = asStringArray(value).join(", ");
      if (joined) return joined;
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
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

function missingEvidenceUrl(companyName: string, evidenceIndex = 0) {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "unknown-target";
  return `https://sentura.local/cross-border-screening/evidence-gap/${slug}-${evidenceIndex + 1}`;
}

function normalizeScoreBlock(value: unknown): CustomerScoreBlock {
  const raw = asRecord(value);
  const status = asString(raw.status);
  return {
    block: scoreBlockId(raw.block ?? raw.score_block),
    status:
      status === "scored" ||
      status === "not_applicable" ||
      status === "unavailable_api" ||
      status === "disabled_by_budget" ||
      status === "pending_human_input"
        ? status
        : "pending_human_input",
    maxPoints: asNumber(raw.max_points ?? raw.maxPoints) ?? 10,
    earnedPoints: asNumber(raw.earned_points ?? raw.earnedPoints) ?? null,
    sourceCount: asNumber(raw.source_count ?? raw.sourceCount),
    summary: simplifyDisplayText(asString(raw.summary)),
    reason: simplifyDisplayText(asString(raw.reason)),
  };
}

function normalizeEvidence(value: unknown): CustomerEvidenceItem {
  const raw = asRecord(value);
  const sourceUrl = toUrl(raw.source_url ?? raw.sourceUrl ?? raw.url) ?? "https://sentura.local/cross-border-intel/evidence";
  return {
    layer: (asString(raw.layer) ?? "public_footprint") as CustomerEvidenceItem["layer"],
    sourceUrl,
    sourceType: sourceType(raw.source_type ?? raw.sourceType),
    fetchedAt: toIsoTimestamp(raw.fetched_at ?? raw.fetchedAt),
    finding: simplifyDisplayText(asString(raw.finding ?? raw.summary ?? raw.excerpt)) ?? "背调员工返回了证据项，但未提供可读摘要。",
    confidence: asNumber(raw.confidence),
    scoreBlock: scoreBlockId(raw.score_block ?? raw.scoreBlock),
    scoreImpact:
      raw.score_impact === "positive" ||
      raw.score_impact === "negative" ||
      raw.score_impact === "neutral" ||
      raw.score_impact === "coverage_only"
        ? raw.score_impact
        : "neutral",
    affectsScore: typeof raw.affects_score === "boolean" ? raw.affects_score : undefined,
    costPosture: asString(raw.cost_posture ?? raw.costPosture),
  };
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeAddressCoverageStatus(value: unknown): AddressFootprintCoverageStatus {
  if (
    value === "found" ||
    value === "partial" ||
    value === "not_found" ||
    value === "unavailable_api" ||
    value === "not_checked"
  ) {
    return value;
  }
  return "not_checked";
}

function normalizeAddressType(value: unknown): AddressFootprintAddressType {
  if (
    value === "headquarters_or_office" ||
    value === "storefront" ||
    value === "warehouse_or_distribution" ||
    value === "service_or_repair_location" ||
    value === "unknown_business_location"
  ) {
    return value;
  }
  return "unknown_business_location";
}

function normalizeRelationshipStatus(value: unknown): AddressFootprintRelationshipStatus {
  if (
    value === "confirmed_company_location" ||
    value === "probable_company_location" ||
    value === "possible_related_location" ||
    value === "rejected_unrelated_location"
  ) {
    return value;
  }
  return "possible_related_location";
}

function normalizeAddressValidation(value: unknown) {
  const raw = asRecord(value);
  if (!isNonEmptyRecord(raw)) return undefined;
  return {
    status: asString(raw.status),
    addressComplete: asBool(raw.address_complete) ?? asBool(raw.addressComplete),
    possibleNextAction: asString(raw.possible_next_action) ?? asString(raw.possibleNextAction),
  };
}

function normalizeDomainMatch(value: unknown): boolean | "not_checked" | undefined {
  if (typeof value === "boolean") return value;
  return asString(value) === "not_checked" ? "not_checked" : undefined;
}

function normalizePhoneMatch(value: unknown): boolean | "not_checked" | "conflict" | undefined {
  if (typeof value === "boolean") return value;
  const raw = asString(value);
  return raw === "not_checked" || raw === "conflict" ? raw : undefined;
}

function normalizeCompanyScaleAssessment(value: unknown): CompanyScaleAssessment | undefined {
  const raw = asRecord(value);
  if (!isNonEmptyRecord(raw)) return undefined;
  const scaleClass = asString(raw.scale_class ?? raw.scaleClass);
  const firstBlockStrategy = asString(raw.first_block_strategy ?? raw.firstBlockStrategy);
  if (
    scaleClass !== "listed_or_public" &&
    scaleClass !== "medium_large_registered" &&
    scaleClass !== "small_local_offline" &&
    scaleClass !== "small_online_only" &&
    scaleClass !== "unknown_scale"
  ) {
    return undefined;
  }
  if (
    firstBlockStrategy !== "registry_disclosure_primary_maps_support" &&
    firstBlockStrategy !== "maps_physical_address_primary" &&
    firstBlockStrategy !== "domain_public_source_primary" &&
    firstBlockStrategy !== "try_registry_and_maps"
  ) {
    return undefined;
  }
  return {
    scaleClass,
    confidence: asNumber(raw.confidence),
    rationale: asString(raw.rationale ?? raw.reason ?? raw.summary) ?? "背调员工未返回公司规模判断说明。",
    firstBlockStrategy,
  };
}

function companyScaleAssessmentPayload(value: CompanyScaleAssessment | undefined) {
  if (!value) return undefined;
  return {
    scale_class: value.scaleClass,
    confidence: value.confidence,
    rationale: value.rationale,
    first_block_strategy: value.firstBlockStrategy,
  };
}

function normalizeAddressFootprint(value: unknown): CustomerAddressFootprint | undefined {
  const raw = asRecord(value);
  if (!isNonEmptyRecord(raw)) return undefined;
  const locations = (Array.isArray(raw.locations) ? raw.locations : [])
    .map((item, index) => {
      const location = asRecord(item);
      const formattedAddress =
        asString(location.formatted_address) ??
        asString(location.formattedAddress) ??
        asString(location.address) ??
        "";
      return {
        googlePlaceId: asString(location.google_place_id) ?? asString(location.googlePlaceId),
        displayName:
          asString(location.display_name) ??
          asString(location.displayName) ??
          `Google Maps location ${index + 1}`,
        addressType: normalizeAddressType(location.address_type ?? location.addressType),
        relationshipStatus: normalizeRelationshipStatus(location.relationship_status ?? location.relationshipStatus),
        formattedAddress,
        city: asString(location.city),
        region: asString(location.region),
        country: asString(location.country),
        businessStatus: asString(location.business_status) ?? asString(location.businessStatus),
        types: asStringArray(location.types),
        websiteUri: toUrl(location.website_uri ?? location.websiteUri),
        domainMatch: normalizeDomainMatch(location.domain_match ?? location.domainMatch),
        phoneMatch: normalizePhoneMatch(location.phone_match ?? location.phoneMatch),
        addressValidation: normalizeAddressValidation(location.address_validation ?? location.addressValidation),
        googleMapsUri: toUrl(location.google_maps_uri ?? location.googleMapsUri),
        matchConfidence: asNumber(location.match_confidence ?? location.matchConfidence),
        matchReasons: asStringArray(location.match_reasons ?? location.matchReasons),
        sourceType: asString(location.source_type ?? location.sourceType)
          ? sourceType(location.source_type ?? location.sourceType)
          : "google_maps_places",
        fetchedAt: asString(location.fetched_at ?? location.fetchedAt),
      };
    })
    .filter((location) => location.formattedAddress || location.googleMapsUri || location.googlePlaceId);
  const summary = asRecord(raw.summary);
  const searchScope = asRecord(raw.search_scope ?? raw.searchScope);
  const confirmed = locations.filter((item) => item.relationshipStatus === "confirmed_company_location").length;
  const probable = locations.filter((item) => item.relationshipStatus === "probable_company_location").length;
  const possible = locations.filter((item) => item.relationshipStatus === "possible_related_location").length;
  const operational = locations.filter((item) => item.businessStatus === "OPERATIONAL").length;
  const closed = locations.filter((item) => /CLOSED/i.test(item.businessStatus ?? "")).length;
  return {
    sectionTitle: asString(raw.section_title ?? raw.sectionTitle) ?? "线下地址线索",
    coverageStatus: normalizeAddressCoverageStatus(raw.coverage_status ?? raw.coverageStatus),
    searchScope: {
      queriesRun: asStringArray(searchScope.queries_run ?? searchScope.queriesRun),
      countries: asStringArray(searchScope.countries),
      capped: asBool(searchScope.capped) ?? false,
      limitations: asStringArray(searchScope.limitations),
    },
    summary: {
      totalLocations: asNumber(summary.total_locations ?? summary.totalLocations) ?? locations.length,
      confirmedLocations: asNumber(summary.confirmed_locations ?? summary.confirmedLocations) ?? confirmed,
      probableLocations: asNumber(summary.probable_locations ?? summary.probableLocations) ?? probable,
      possibleRelatedLocations:
        asNumber(summary.possible_related_locations ?? summary.possibleRelatedLocations) ?? possible,
      operationalLocations: asNumber(summary.operational_locations ?? summary.operationalLocations) ?? operational,
      closedLocations: asNumber(summary.closed_locations ?? summary.closedLocations) ?? closed,
      countries: asStringArray(summary.countries).length
        ? asStringArray(summary.countries)
        : uniqueStrings(locations.map((item) => item.country)),
      cities: asStringArray(summary.cities).length
        ? asStringArray(summary.cities)
        : uniqueStrings(locations.map((item) => item.city)),
    },
    locations,
    openQuestions: asStringArray(raw.open_questions ?? raw.openQuestions),
  };
}

function normalizeAddressFootprintPayload(value: unknown) {
  const footprint = normalizeAddressFootprint(value);
  if (!footprint) return undefined;
  return {
    section_title: footprint.sectionTitle,
    coverage_status: footprint.coverageStatus,
    search_scope: {
      queries_run: footprint.searchScope.queriesRun,
      countries: footprint.searchScope.countries,
      capped: footprint.searchScope.capped,
      limitations: footprint.searchScope.limitations,
    },
    summary: {
      total_locations: footprint.summary.totalLocations,
      confirmed_locations: footprint.summary.confirmedLocations,
      probable_locations: footprint.summary.probableLocations,
      possible_related_locations: footprint.summary.possibleRelatedLocations,
      operational_locations: footprint.summary.operationalLocations,
      closed_locations: footprint.summary.closedLocations,
      countries: footprint.summary.countries,
      cities: footprint.summary.cities,
    },
    locations: footprint.locations.map((location) => ({
      google_place_id: location.googlePlaceId,
      display_name: location.displayName,
      address_type: location.addressType,
      relationship_status: location.relationshipStatus,
      formatted_address: location.formattedAddress,
      city: location.city,
      region: location.region,
      country: location.country,
      business_status: location.businessStatus,
      types: location.types,
      website_uri: location.websiteUri,
      domain_match: location.domainMatch,
      phone_match: location.phoneMatch,
      address_validation: location.addressValidation
        ? {
            status: location.addressValidation.status,
            address_complete: location.addressValidation.addressComplete,
            possible_next_action: location.addressValidation.possibleNextAction,
          }
        : undefined,
      google_maps_uri: location.googleMapsUri,
      match_confidence: location.matchConfidence,
      match_reasons: location.matchReasons,
      source_type: location.sourceType,
      fetched_at: location.fetchedAt,
    })),
    open_questions: footprint.openQuestions,
  };
}

function reportFromRecord(record: ApiCustomerRecord): CustomerScreeningReport | undefined {
  const raw = asRecord(record.reportJson);
  if (!record.latestScreeningReportId && Object.keys(raw).length === 0) return undefined;
  const evidence = payloadArray(raw.evidence ?? [], "evidence").map(normalizeEvidence);
  const scoreBlocks = payloadArray(raw.score_blocks ?? raw.scoreBlocks ?? [], "score_blocks").map(normalizeScoreBlock);
  const normalizedScore = asNumber(raw.normalized_score ?? raw.normalizedScore) ?? record.normalizedScore;
  const riskTier = normalizeRiskTier(raw.risk_tier ?? raw.riskTier ?? record.screeningStatus, normalizedScore);
  const normalizedCoverageGaps = payloadArray(raw.coverage_gaps ?? raw.coverageGaps ?? [], "coverage_gaps").map((item, index): CustomerCoverageGap => {
    const gap = asRecord(item);
    const block = asString(gap.block ?? gap.score_block) ?? `coverage-gap-${index + 1}`;
    const status = asString(gap.status);
    const normalizedStatus =
      status === "scored" ||
      status === "not_applicable" ||
      status === "unavailable_api" ||
      status === "disabled_by_budget" ||
      status === "pending_human_input"
        ? status
        : undefined;
    return {
      block,
      reason: simplifyDisplayText(asString(gap.reason ?? gap.summary ?? gap.note)) ?? coverageGapReasonForBlock(block, normalizedStatus),
      action: simplifyDisplayText(asString(gap.action ?? gap.recommended_action)) ?? coverageGapActionForBlock(block, normalizedStatus),
    };
  });
  return {
    reportId: asString(raw.report_id ?? raw.reportId) ?? record.latestScreeningReportId ?? record.recordId,
    riskTier,
    normalizedScore,
    evidenceCoverage: asNumber(raw.evidence_coverage ?? raw.evidenceCoverage) ?? record.evidenceCoverage ?? undefined,
    recommendedAction: simplifyDisplayText(asString(raw.recommended_action ?? raw.recommendedAction) ?? record.recommendedAction) ?? "复核背调报告后决定是否跟进。",
    createdAt: asString(raw.created_at ?? raw.createdAt) ?? record.updatedAt,
    companyScaleAssessment: normalizeCompanyScaleAssessment(raw.company_scale_assessment ?? raw.companyScaleAssessment),
    scoreBlocks,
    evidence,
    coverageGaps:
      normalizedCoverageGaps.length > 0 &&
      !normalizedCoverageGaps.every((gap) => isGenericCoverageGapReason(gap.reason))
        ? normalizedCoverageGaps
        : coverageGapsFromScoreBlocks(scoreBlocks).length > 0
          ? coverageGapsFromScoreBlocks(scoreBlocks)
          : normalizedCoverageGaps,
    addressFootprint: normalizeAddressFootprint(raw.address_footprint ?? raw.addressFootprint),
    openQuestions: asStringArray(raw.open_questions ?? raw.openQuestions),
  };
}

function customerFromApi(record: ApiCustomerRecord): CustomerListItem {
  const report = reportFromRecord(record);
  const status = screeningStatusFromRecord(record);
  const normalizedScore = record.normalizedScore ?? report?.normalizedScore ?? undefined;
  const website = toUrl(record.website) ?? (record.domain ? `https://${record.domain}` : undefined);
  const sourceUrls = Array.from(new Set([
    ...(record.sourceUrls ?? []),
    ...(report?.evidence.map((item) => item.sourceUrl) ?? []),
    ...(report?.addressFootprint?.locations.map((item) => item.googleMapsUri).filter(Boolean) ?? []),
    website,
  ].filter((url): url is string => Boolean(url))));
  return {
    customerId: record.recordId,
    source:
      record.recordType === "accio_summary"
        ? "accio_handoff"
        : record.recordType === "screening_target"
          ? "manual_screening"
          : "lead_discovery",
    companyName: record.companyName,
    country: record.country ?? "ZZ",
    countryName: countryName(record.country),
    buyerType: record.buyerType ?? "buyer",
    products: record.matchedProducts?.length ? record.matchedProducts : ["mobile accessories"],
    website,
    foundAt: record.createdAt,
    screeningStatus: status,
    normalizedScore: normalizedScore ?? undefined,
    scoreTier: scoreTier(normalizedScore),
    reportId: record.latestScreeningReportId ?? report?.reportId,
    leadAgentRunId: asString(record.leadAgentRunId ?? record.lead_agent_run_id),
    screeningAgentRunId: asString(record.screeningAgentRunId ?? record.screening_agent_run_id),
    latestAgentRunId:
      asString(record.screeningAgentRunId ?? record.screening_agent_run_id) ??
      asString(record.leadAgentRunId ?? record.lead_agent_run_id) ??
      asString(asRecord(record.reportJson).agent_run_id),
    sourceUrls,
    evidenceSummary:
      simplifyDisplayText(report?.evidence.map((item) => item.finding).find(Boolean) ?? record.recommendedAction) ??
      "客户库中已有客户记录，等待下一步背调或人工复核。",
    recommendedAction: simplifyDisplayText(report?.recommendedAction ?? record.recommendedAction) ?? "进入背调或复核客户资料。",
    screeningReport: report,
  };
}

function taskKindLabel(kind: string) {
  if (kind === "screening") return "背调任务";
  if (kind === "accio_memory") return "记忆整理";
  return "寻找客户";
}

function taskEstimateMs(kind: string) {
  if (kind === "screening") return 240_000;
  if (kind === "accio_memory") return 180_000;
  return 180_000;
}

function taskAffectedCustomerIds(metadata: JsonRecord) {
  const supplementTarget = asRecord(metadata.supplement_target);
  const supplementCustomerId = asString(supplementTarget.customer_id ?? supplementTarget.customerId);
  return Array.from(new Set([
    ...asStringArray(metadata.affected_customer_ids),
    ...asStringArray(metadata.saved_customer_ids),
    ...asStringArray(metadata.target_customer_ids),
    ...asStringArray(metadata.lead_candidate_ids),
    ...asStringArray(metadata.screening_target_ids),
    ...(supplementCustomerId ? [supplementCustomerId] : []),
  ]));
}

function taskFromApi(record: ApiAgentRun): CbeEmployeeTaskRecord | null {
  const taskKind = record.taskKind ?? record.task_kind ?? "lead";
  const sessionKey = record.sessionKey ?? record.session_key ?? undefined;
  if (taskKind === "accio_memory" && record.status === "queued" && !sessionKey) {
    return null;
  }
  const startedAt = Date.parse(record.startedAt ?? record.started_at ?? "");
  const lastActivityAt = Date.parse(record.lastActivityAt ?? record.last_activity_at ?? "");
  const finishedAt = record.finishedAt ?? record.finished_at;
  const updatedAt = finishedAt
    ? Date.parse(finishedAt)
    : Number.isFinite(lastActivityAt)
      ? lastActivityAt
      : startedAt;
  const metadata = record.metadataJson ?? record.metadata_json ?? {};
  const status = (
    record.status === "completed" ||
    record.status === "failed" ||
    record.status === "cancelled" ||
    record.status === "running" ||
    record.status === "polling"
  )
    ? record.status
    : "queued";
  const estimatedMs = taskEstimateMs(taskKind);
  const notificationTitle = asString(metadata.notification_title);
  const notificationMessage = asString(metadata.notification_message);
  const notificationTargetLabel = asString(metadata.notification_target_label);
  const message =
    notificationMessage ??
    record.errorMessage ??
    record.error_message ??
    record.currentStage ??
    record.current_stage ??
    (status === "completed"
      ? "任务已完成。"
      : status === "cancelled"
        ? "任务已取消，结果不会写入列表。"
        : "任务正在执行。");
  return {
    id: record.id,
    kind: taskKind === "screening" ? "screening" : taskKind === "accio_memory" ? "accio_memory" : "lead",
    title: notificationTitle ?? taskKindLabel(taskKind),
    status: status as CbeEmployeeTaskStatus,
    message: simplifyDisplayText(message) ?? message,
    startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    lastActivityAt: Number.isFinite(lastActivityAt) ? lastActivityAt : undefined,
    completedAt: finishedAt ? Date.parse(finishedAt) : undefined,
    estimatedMs,
    timeoutMs: Math.max(estimatedMs + 120_000, 300_000),
    deadlineAt: (Number.isFinite(startedAt) ? startedAt : Date.now()) + Math.max(estimatedMs + 120_000, 300_000),
    sessionKey,
    targetLabel: simplifyDisplayText(notificationTargetLabel ?? record.targetSummary ?? record.target_summary ?? undefined),
    resultCount: asNumber(metadata.saved_leads ?? metadata.saved_reports ?? metadata.saved_summaries),
    affectedCustomerIds: taskAffectedCustomerIds(metadata),
    error: record.errorMessage ?? record.error_message ?? undefined,
    dismissed: typeof metadata.dismissed_at === "string",
    notificationRead: typeof metadata.notification_read_at === "string",
    metadata,
  };
}

function memorySourceFromKind(sourceKind?: string | null, sourceFileName?: string | null): MemoryRecordItem["source"] {
  if (sourceKind === "manual_json" || sourceKind === "manual_text" || sourceKind === "manual_image") {
    return "manual_import";
  }
  if (sourceKind === "alibaba_international") return "alibaba_international";
  if (sourceKind === "demo_data") return "demo_data";
  if (sourceFileName?.toLowerCase().includes("alibaba")) return "alibaba_international";
  return "accio";
}

function memoryFromApi(record: ApiMemoryRecord): MemoryRecordItem {
  const pendingSupplementRefresh = Boolean(
    record.summaryId &&
    record.supplementTarget &&
    (
      record.agentRunStatus === "queued" ||
      record.agentRunStatus === "running" ||
      record.agentRunStatus === "polling" ||
      record.agentRunStatus === "failed"
    ),
  );
  const analyzed = Boolean(record.summaryId) && !pendingSupplementRefresh;
  const supplementSource = record.supplementTarget?.source;
  return {
    recordId: pendingSupplementRefresh ? record.importId : record.summaryId ?? record.importId,
    name: record.companyName ?? record.sourceFileName ?? "未命名聊天记录",
    source: memorySourceFromKind(record.sourceKind, record.sourceFileName),
    importedAt: record.uploadedAt,
    analysisStatus: analyzed
      ? "analyzed"
      : record.agentRunStatus === "failed" || record.validationStatus === "failed"
        ? "failed"
        : record.agentRunStatus === "running" || record.agentRunStatus === "polling"
          ? "running"
          : "not_started",
    conversationCount: record.conversationCount,
    reportId: analyzed ? record.summaryId ?? undefined : undefined,
    latestAgentRunId: record.agentRunId ?? undefined,
    memoryPreviewStatus:
      record.memoryFactStatus === "approved" || record.memoryFactStatus === "rejected"
        ? record.memoryFactStatus
        : "preview_only",
    summary:
      pendingSupplementRefresh
        ? "已补充聊天记录，等待记忆员工重新分析后更新客户画像和移交背调信息。"
        : record.summaryText ??
      record.nextActions[0] ??
      (analyzed ? "记忆员工已生成结构化摘要。" : "已导入，等待记忆员工分析后生成写入预览。"),
    handoffCompany: record.companyName ?? undefined,
    supplementCustomerId: record.supplementTarget?.customerId,
    supplementCompanyName: record.supplementTarget?.companyName,
    supplementSource:
      supplementSource === "lead_discovery" ||
      supplementSource === "manual_screening" ||
      supplementSource === "accio_handoff"
        ? supplementSource
        : undefined,
  };
}

export async function fetchEmployeeCustomers() {
  const page = await fetchEmployeeJson<ApiPage<ApiCustomerRecord>>("/api/client-demos/cross-border/employee/customers?limit=100");
  return page.items.map(customerFromApi);
}

export async function fetchEmployeeMemoryRecords() {
  const page = await fetchEmployeeJson<{ items: ApiMemoryRecord[] }>("/api/client-demos/cross-border/employee/memory");
  return page.items.map(memoryFromApi);
}

export async function deleteEmployeeMemoryRecords(ids: string[]) {
  if (ids.length === 0) return { deletedRecordIds: [] as string[] };
  return fetchEmployeeJson<{
    deletedRecordIds: string[];
    deletedSummaryIds: string[];
    deletedConversationIds: string[];
    deletedImportIds: string[];
  }>("/api/client-demos/cross-border/employee/memory", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}

export async function deleteEmployeeCustomers(ids: string[]) {
  if (ids.length === 0) return { deletedCustomerIds: [] as string[] };
  return fetchEmployeeJson<{
    deletedCustomerIds: string[];
    deletedLeadCandidateIds: string[];
    deletedScreeningTargetIds: string[];
    deletedAccioSummaryIds: string[];
  }>("/api/client-demos/cross-border/employee/customers", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}

export async function fetchEmployeeAccioImportPayload(importId: string) {
  return fetchEmployeeJson<unknown>(
    `/api/client-demos/cross-border/employee/memory/imports/${encodeURIComponent(importId)}`,
  );
}

export async function fetchEmployeeTasks() {
  const records: ApiAgentRun[] = [];
  let offset = 0;
  while (true) {
    const page = await fetchEmployeeJson<ApiPage<ApiAgentRun>>(
      `/api/client-demos/cross-border/employee/tasks?limit=${EMPLOYEE_TASK_PAGE_SIZE}&offset=${offset}`,
    );
    records.push(...page.items);
    if (page.items.length < EMPLOYEE_TASK_PAGE_SIZE) break;
    offset += EMPLOYEE_TASK_PAGE_SIZE;
  }
  return records.map(taskFromApi).filter((item): item is CbeEmployeeTaskRecord => Boolean(item));
}

export async function fetchEmployeeCostBudget(): Promise<EmployeeCostBudgetSnapshot> {
  const body = await fetchEmployeeJson<JsonRecord>("/api/client-demos/cross-border/employee/cost-budget");
  return {
    period: "month",
    baseLimitUsd: asNumber(body.baseLimitUsd ?? body.base_limit_usd) ?? 0,
    activeAllowanceUsd: asNumber(body.activeAllowanceUsd ?? body.active_allowance_usd) ?? 0,
    limitUsd: asNumber(body.limitUsd ?? body.limit_usd) ?? 0,
    limitEnabled: typeof body.limitEnabled === "boolean" ? body.limitEnabled : Boolean(body.limit_enabled),
    warningRatio: asNumber(body.warningRatio ?? body.warning_ratio) ?? 0.8,
    hardStopRatio: asNumber(body.hardStopRatio ?? body.hard_stop_ratio) ?? 1,
    spendUsd: asNumber(body.spendUsd ?? body.spend_usd) ?? 0,
    remainingUsd: asNumber(body.remainingUsd ?? body.remaining_usd) ?? null,
    updatedAt: asString(body.updatedAt ?? body.updated_at) ?? null,
    source: "server",
  };
}

export async function markEmployeeNotificationsRead(ids: string[]) {
  if (ids.length === 0) return { readIds: [] as string[] };
  return jsonPost<{ readIds: string[] }>("/api/client-demos/cross-border/employee/notifications/read", { ids });
}

export async function deleteEmployeeNotifications(ids: string[]) {
  if (ids.length === 0) return { deletedIds: [] as string[] };
  return fetchEmployeeJson<{ deletedIds: string[] }>("/api/client-demos/cross-border/employee/notifications", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}

export async function dismissEmployeeTaskInDb(id: string) {
  const result = await jsonPost<{ task: ApiAgentRun }>(
    `/api/client-demos/cross-border/employee/tasks/${encodeURIComponent(id)}/dismiss`,
    {},
  );
  return taskFromApi(result.task);
}

export async function cancelEmployeeTaskInDb(input: { id: string; sessionKey?: string }) {
  const result = await jsonPost<{ task: ApiAgentRun }>(
    `/api/client-demos/cross-border/employee/tasks/${encodeURIComponent(input.id)}/cancel`,
    { session_key: input.sessionKey },
  );
  return taskFromApi(result.task);
}

export async function createEmployeeLeadRun(input: EmployeeLeadTaskInput, sessionKey: string) {
  const rawTargetCount = Math.floor(input.targetCount);
  const targetCount = Number.isFinite(rawTargetCount)
    ? Math.min(MAX_LEAD_TARGET_COUNT, Math.max(1, rawTargetCount))
    : 1;
  const productKeywords = asStringArray(input.productKeywords);
  const countries = asStringArray(input.countries).map((item) => item.toUpperCase());
  const buyerTypes = asStringArray(input.buyerTypes);
  const maxResultsPerQuery = input.maxResultsPerQuery ?? 10;
  const estimatedCost = estimateLeadTaskCost({
    productCount: productKeywords.length,
    buyerTypeCount: buyerTypes.length,
    countryCount: countries.length,
    targetCount,
    maxResultsPerQuery,
  });
  return jsonPost<CreateEmployeeLeadRunResponse>(
    "/api/client-demos/cross-border/employee/lead-runs",
    {
      query_config: {
        product_keywords: productKeywords,
        countries,
        buyer_types: buyerTypes,
        exclude_domains: asStringArray(input.excludeDomains),
        max_results_per_query: maxResultsPerQuery,
      },
      target_count: targetCount,
      run_mode: input.runMode ?? "new_scope",
      session_key: sessionKey,
      target_summary: `${input.productKeywords} / ${input.countries}`,
      estimated_cost_usd: estimatedCost.estimatedUsd,
    },
  );
}

export async function createEmployeeScreeningRun(
  targets: ScreeningTarget[],
  sessionKey: string,
  options: EmployeeScreeningTaskOptions = {},
) {
  const estimatedCost = estimateScreeningTaskCost({
    targetCount: targets.length,
    paidEmailValidation: options.paidEmailValidation,
    paidTradeData: options.paidTradeData,
    maxPaidSpendUsd: options.maxPaidSpendUsd,
  });
  const childSessionKeys = targets.map((_, index) =>
    index === 0 ? sessionKey : createPlannedEmployeeSessionKey(SCREENING_AGENT_ID),
  );
  return jsonPost<CreateEmployeeScreeningRunResponse>("/api/client-demos/cross-border/employee/screening-runs", {
    target_summary: targets.map((target) => target.company_name ?? target.target_id).join(", ").slice(0, 240),
    target_record_type: targets.length === 1 ? targets[0].source : "screening_batch",
    target_record_id: targets.length === 1 ? targets[0].lead_id ?? targets[0].target_id : undefined,
    session_key: sessionKey,
    child_session_keys: childSessionKeys,
    targets,
    estimated_cost_usd: estimatedCost.estimatedUsd,
    metadata_json: {
      target_count: targets.length,
      target_customer_ids: targets.map((target) => target.lead_id ?? target.target_id).filter(Boolean),
      target_sources: targets.map((target) => ({
        target_id: target.target_id,
        lead_id: target.lead_id,
        source: target.source,
        company_name: target.company_name,
      })),
      options,
    },
  });
}

export async function claimEmployeeQueuedScreeningRuns(input: {
  screeningBatchId?: string;
  limit?: number;
}) {
  return jsonPost<{
    batch: ApiScreeningBatch | null;
    childRuns: ApiScreeningChildRun[];
    queuedRemaining: number;
  }>("/api/client-demos/cross-border/employee/screening-runs/drain", {
    screening_batch_id: input.screeningBatchId,
    limit: input.limit ?? 3,
  });
}

export async function retryEmployeeScreeningChildRun(input: {
  agentRunId: string;
  sessionKey?: string;
  reapprovePaidEmail?: boolean;
  reapprovePaidTrade?: boolean;
  approvalReason?: string;
}) {
  return jsonPost<{
    batch: ApiScreeningBatch | null;
    childRun: ApiScreeningChildRun;
  }>(`/api/client-demos/cross-border/employee/screening-runs/${input.agentRunId}/retry`, {
    session_key: input.sessionKey,
    reapprove_paid_email: Boolean(input.reapprovePaidEmail),
    reapprove_paid_trade: Boolean(input.reapprovePaidTrade),
    approval_reason: input.approvalReason,
  });
}

export async function reviewEmployeeMemoryFacts(input: {
  ids: string[];
  decision: "approved" | "rejected";
  reviewNote?: string;
  vectorMemoryRef?: string;
}) {
  return jsonPatch<{
    reviewed: Array<{ id: string; sourceRecordId: string; status: string }>;
  }>("/api/client-demos/cross-border/employee/memory/facts", {
    ids: input.ids,
    decision: input.decision,
    review_note: input.reviewNote,
    vector_memory_ref: input.vectorMemoryRef,
  });
}

function redactText(value: unknown) {
  const raw = asString(value) ?? "";
  return raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d ()-]{6,}\d/g, "[phone]")
    .slice(0, 500);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function accioConversationsFromPayload(payload: unknown) {
  const conversations = payloadArray(payload, "conversations");
  return Promise.all(
    conversations.map(async (item, index) => {
      const raw = asRecord(item);
      const buyer = asRecord(raw.buyer);
      const messages = Array.isArray(raw.messages) ? raw.messages : [];
      return {
        external_conversation_id: asString(raw.conversation_id ?? raw.id) ?? `conversation-${index + 1}`,
        company_name: asString(buyer.company_name ?? raw.company_name),
        country: toOptionalCountryCode(buyer.country ?? raw.country),
        contact_person: asString(buyer.display_name ?? buyer.contact_person ?? raw.contact_person),
        email: toEmail(buyer.email ?? raw.email),
        website: toUrl(buyer.website ?? raw.website),
        messages: await Promise.all(
          messages.map(async (message, messageIndex) => {
            const msg = asRecord(message);
            const text = redactText(msg.text ?? msg.content ?? msg.message);
            return {
              message_ts: toIsoTimestamp(msg.timestamp ?? msg.message_ts),
              sender_role: asString(msg.sender ?? msg.sender_role) ?? "unknown",
              text_hash: await sha256Hex(`${index}:${messageIndex}:${text}`),
              text_redacted: text || "[empty]",
              attachment_json: Array.isArray(msg.attachments) ? msg.attachments.map(asRecord) : [],
            };
          }),
        ),
      };
    }),
  );
}

function supplementTargetFromPayload(payload: unknown): AccioMemoryTaskInput["supplementTarget"] | undefined {
  const metadata = asRecord(asRecord(payload).export_metadata);
  const target = asRecord(metadata.supplement_target);
  const customerId = asString(target.customer_id ?? target.customerId);
  const companyName = asString(target.company_name ?? target.companyName);
  const source = asString(target.source);
  if (
    customerId &&
    companyName &&
    (source === "lead_discovery" || source === "manual_screening" || source === "accio_handoff")
  ) {
    return { customerId, companyName, source };
  }
  return undefined;
}

export async function createEmployeeAccioImport(input: AccioMemoryTaskInput, sessionKey?: string) {
  const serialized = JSON.stringify(input.chatExport);
  const conversations = await accioConversationsFromPayload(input.chatExport);
  const estimatedCost = sessionKey ? estimateMemoryTaskCost(conversations.length) : { estimatedUsd: 0 };
  const supplementTarget = input.supplementTarget ?? supplementTargetFromPayload(input.chatExport);
  return jsonPost<{ agentRun: ApiAgentRun; accioImport: ApiAccioImport }>(
    "/api/client-demos/cross-border/employee/memory/imports",
    {
      source_file_name: input.recordName,
      source_kind: input.sourceKind ?? "manual_json",
      input_format: input.inputFormat ?? "json",
      attachment_metadata: input.attachmentMetadata ?? [],
      file_hash: await sha256Hex(serialized),
      storage_key: `local-browser-cache://${await sha256Hex(`${input.recordName}:${serialized.length}`)}`,
      classification: "T3",
      session_key: sessionKey,
      estimated_cost_usd: estimatedCost.estimatedUsd,
      supplement_target: supplementTarget
        ? {
            customer_id: supplementTarget.customerId,
            company_name: supplementTarget.companyName,
            source: supplementTarget.source,
          }
        : undefined,
      conversations,
    },
  );
}

function normalizeLeadPayload(payload: unknown) {
  const now = new Date().toISOString();
  const raw = asRecord(payload);
  return {
    run_id: asString(raw.run_id),
    shortage_reason: asString(raw.shortage_reason),
    leads: payloadArray(payload, "leads").map((item, index) => {
      const lead = asRecord(item);
      const website = toUrl(lead.website ?? lead.url);
      const evidenceRows = Array.isArray(lead.discovery_evidence) ? lead.discovery_evidence : [];
      const sourceUrls = Array.from(new Set([
        ...asStringArray(lead.source_urls).map(toUrl),
        ...evidenceRows.map((evidence) => toUrl(asRecord(evidence).source_url ?? asRecord(evidence).url)),
        website,
      ].filter((url): url is string => Boolean(url))));
      if (sourceUrls.length === 0) {
        throw new EmployeeTaskError("marker_missing", `获客结果缺少可核验来源：${asString(lead.company_name ?? lead.name) ?? `Unknown buyer ${index + 1}`}`);
      }
      const evidence = (evidenceRows.length ? evidenceRows : sourceUrls.map((sourceUrl) => ({ source_url: sourceUrl })))
        .map((evidenceItem, evidenceIndex) => {
          const evidenceRecord = asRecord(evidenceItem);
          return {
            signal: asString(evidenceRecord.signal),
            source_url: toUrl(evidenceRecord.source_url ?? evidenceRecord.url) ?? sourceUrls[evidenceIndex] ?? sourceUrls[0],
            excerpt: asString(evidenceRecord.excerpt),
            finding: asString(evidenceRecord.finding ?? evidenceRecord.summary) ?? "公开来源显示该公司与目标品类相关。",
            confidence: asNumber(evidenceRecord.confidence),
            query: asString(evidenceRecord.query),
            fetched_at: toIsoTimestamp(evidenceRecord.fetched_at ?? evidenceRecord.fetchedAt, now),
            source_type: sourceType(evidenceRecord.source_type),
          };
        });
      return {
        lead_id: asString(lead.lead_id) ?? `lead-${domainFromUrl(website) ?? index + 1}`,
        company_name: asString(lead.company_name ?? lead.name) ?? `Unknown buyer ${index + 1}`,
        website,
        domain: asString(lead.domain) ?? domainFromUrl(website),
        country: toCountryCode(lead.country),
        city: asString(lead.city),
        buyer_type: asString(lead.buyer_type) ?? "buyer",
        matched_products: asStringArray(lead.matched_products).length ? asStringArray(lead.matched_products) : ["mobile accessories"],
        source_urls: sourceUrls,
        discovery_evidence: evidence,
        dedupe_key: asString(lead.dedupe_key),
        duplicate_status:
          lead.duplicate_status === "possible_duplicate" || lead.duplicate_status === "duplicate"
            ? lead.duplicate_status
            : "new",
        confidence: asNumber(lead.confidence),
        created_at: toIsoTimestamp(lead.created_at, now),
      };
    }),
  };
}

function normalizeScreeningPayload(payload: unknown) {
  const now = new Date().toISOString();
  return {
    reports: payloadArray(payload, "reports").map((item, index) => {
      const report = asRecord(item);
      const target = asRecord(report.target);
      const companyName = asString(report.company_name ?? target.company_name) ?? `Unknown target ${index + 1}`;
      const targetId = asString(target.target_id ?? target.targetId);
      const targetLeadId = asString(target.lead_id ?? report.lead_id);
      const sourceHint = asString(target.source ?? report.target_source);
      const inferredTargetSource =
        sourceHint === "marketing_lead" ||
        sourceHint === "marketing_lead_batch" ||
        sourceHint === "manual_input" ||
        sourceHint === "accio_memory"
          ? sourceHint
          : targetLeadId?.startsWith("accio_summary") || targetId?.startsWith("accio_summary")
            ? "accio_memory"
            : targetId?.startsWith("screening_target") || targetLeadId?.startsWith("screening_target")
              ? "manual_input"
              : "manual_input";
      const score = asNumber(report.normalized_score ?? report.normalizedScore ?? report.score);
      const evidenceRows = Array.isArray(report.evidence) ? report.evidence : [];
      const targetWebsite = toUrl(target.website);
      const addressFootprint = normalizeAddressFootprintPayload(report.address_footprint ?? report.addressFootprint);
      const companyScaleAssessment = normalizeCompanyScaleAssessment(
        report.company_scale_assessment ?? report.companyScaleAssessment,
      );
      let traceabilityGap = evidenceRows.length === 0;
      const evidence = (evidenceRows.length ? evidenceRows : [{ source_url: targetWebsite }])
        .map((evidenceItem, evidenceIndex) => {
          const evidenceRecord = asRecord(evidenceItem);
          const sourceUrl = toUrl(evidenceRecord.source_url ?? evidenceRecord.sourceUrl ?? evidenceRecord.url);
          const usesGapMarker = !sourceUrl;
          if (usesGapMarker) traceabilityGap = true;
          return {
            layer: asString(evidenceRecord.layer) ?? "public_footprint",
            source_type: usesGapMarker ? "unverified" : sourceType(evidenceRecord.source_type),
            source: asString(evidenceRecord.source),
            source_url: sourceUrl ?? missingEvidenceUrl(companyName, evidenceIndex),
            finding: usesGapMarker
              ? `背调员工未返回 ${companyName} 的可核验来源，已记录为证据缺口。`
              : asString(evidenceRecord.finding ?? evidenceRecord.summary ?? evidenceRecord.excerpt) ?? "背调员工返回了证据项。",
            confidence: usesGapMarker ? 0 : asNumber(evidenceRecord.confidence),
            fetched_at: toIsoTimestamp(evidenceRecord.fetched_at ?? evidenceRecord.fetchedAt, now),
            cost_usd: asNumber(evidenceRecord.cost_usd ?? evidenceRecord.costUsd),
            score_block: scoreBlockId(evidenceRecord.score_block ?? evidenceRecord.scoreBlock),
            score_impact:
              usesGapMarker
                ? "coverage_only"
                : evidenceRecord.score_impact === "positive" ||
                    evidenceRecord.score_impact === "negative" ||
                    evidenceRecord.score_impact === "coverage_only"
                  ? evidenceRecord.score_impact
                  : "neutral",
          };
        });
      const riskTier = traceabilityGap ? "insufficient_evidence" : normalizeRiskTier(report.risk_tier ?? report.riskTier, score);
      const scoreBlocks = payloadArray(report.score_blocks ?? report.scoreBlocks ?? [], "score_blocks");
      const reportCoverageGaps = Array.isArray(report.coverage_gaps) ? report.coverage_gaps.map(asRecord) : [];
      const traceabilityGapRecord = {
        block: "public_footprint",
        status: "pending_human_input",
        reason: `背调员工未返回 ${companyName} 的可核验来源，无法核验公开信息。`,
        action: "补充官网、注册页、公开网页或工具返回的来源链接后重新背调。",
      };
      const coverageGaps = traceabilityGap &&
        !reportCoverageGaps.some((gap) => asString(gap.reason)?.includes("可核验来源"))
          ? [...reportCoverageGaps, traceabilityGapRecord]
          : reportCoverageGaps;
      const evidenceCoverage = asNumber(report.evidence_coverage ?? report.evidenceCoverage);
      return {
        report_id: asString(report.report_id ?? report.reportId) ?? `screening-report-${Date.now()}-${index}`,
        lead_id: targetLeadId ?? (inferredTargetSource === "accio_memory" ? targetId : null),
        target_source: inferredTargetSource,
        company_name: companyName,
        ...(companyScaleAssessment ? { company_scale_assessment: companyScaleAssessmentPayload(companyScaleAssessment) } : {}),
        target: {
          target_id: targetId,
          source: inferredTargetSource,
          lead_id: targetLeadId ?? (inferredTargetSource === "accio_memory" ? targetId : null),
          company_name: companyName,
          country: toOptionalCountryCode(target.country ?? report.country),
          website: targetWebsite,
          domain: asString(target.domain) ?? domainFromUrl(targetWebsite),
          email: toEmail(target.email),
          contact_person: asString(target.contact_person),
          product_interest: asStringArray(target.product_interest).length ? asStringArray(target.product_interest) : ["mobile accessories"],
          supplied_fields: asStringArray(target.supplied_fields),
          missing_fields: asStringArray(target.missing_fields),
        },
        risk_tier: riskTier,
        normalized_score: traceabilityGap ? null : typeof score === "number" ? score : null,
        evidence_coverage: traceabilityGap ? Math.min(evidenceCoverage ?? 0, 0.2) : evidenceCoverage ?? (evidence.length > 0 ? 0.5 : 0),
        recommended_action: traceabilityGap
          ? `背调员工未返回 ${companyName} 的可核验来源，已标记为证据不足；请补充官网、注册页或公开来源后重新评估。`
          : asString(report.recommended_action ?? report.recommendedAction) ?? "复核背调报告后决定是否跟进。",
        score_blocks: scoreBlocks.length
          ? scoreBlocks.map((block) => {
              const normalized = normalizeScoreBlock(block);
              return {
                block: scoreBlockId(normalized.block),
                status: normalized.status,
                max_points: normalized.maxPoints,
                earned_points: normalized.earnedPoints,
                source_count: normalized.sourceCount ?? evidence.length,
                summary: normalized.summary,
                reason: normalized.reason,
              };
            })
          : [
              {
                block: "public_footprint",
                status: "pending_human_input",
                max_points: 20,
                earned_points: null,
                source_count: evidence.length,
                reason: traceabilityGap
                  ? `背调员工未返回 ${companyName} 的可核验来源。`
                  : "报告未返回评分来源，已保留核验依据供人工复核。",
              },
            ],
        evidence,
        ...(addressFootprint ? { address_footprint: addressFootprint } : {}),
        coverage_gaps: coverageGaps,
        open_questions: asStringArray(report.open_questions),
        created_at: toIsoTimestamp(report.created_at, now),
      };
    }),
  };
}

function normalizeAccioPayload(
  payload: unknown,
  sourceFileName: string,
  supplementTarget?: AccioMemoryTaskInput["supplementTarget"],
) {
  return {
    summaries: payloadArray(payload, "summaries").map((item, index) => {
      const summary = asRecord(item);
      const profile = asRecord(summary.customer_profile);
      const memoryPreview = asRecord(summary.memory_preview ?? summary.memoryWritePreview ?? summary.memory_write_preview);
      const handoff = asRecord(summary.screening_handoff_target ?? summary.screeningHandoffTarget);
      const behaviorSignals = asRecord(summary.behavior_signals ?? summary.behaviorSignals);
      const conversationId = asString(summary.conversation_id ?? summary.conversationId) ?? `conversation-${index + 1}`;
      const companyName =
        supplementTarget?.companyName ??
        firstTextValue(profile.company_name, handoff.company_name, memoryPreview.company_name, summary.company_name) ??
        `Unknown company ${index + 1}`;
      const productInterest = firstTextValue(
        summary.product,
        summary.product_interest,
        memoryPreview.product,
        memoryPreview.product_interest,
        handoff.product_interest,
      );
      const purchaseIntent = asRecordArray(summary.purchase_intent ?? summary.purchaseIntent);
      const negotiatedPricesFromPreview = asRecordArray(memoryPreview.negotiated_price_facts ?? memoryPreview.negotiated_prices);
      const negotiatedPrices = asRecordArray(summary.negotiated_prices ?? summary.negotiatedPrices);
      const derivedIntent: JsonRecord = {};
      const derivedProduct = productInterest;
      const derivedQuantity = firstTextValue(
        summary.quantity,
        summary.target_quantity,
        memoryPreview.quantity,
        memoryPreview.target_quantity,
        memoryPreview.order_quantity,
        handoff.quantity,
      );
      const derivedTargetPrice = firstTextValue(
        summary.target_price_usd,
        memoryPreview.target_price_usd,
        memoryPreview.buyer_target_price_usd,
      );
      const derivedSellerPrice = firstTextValue(
        summary.seller_best_price_usd,
        memoryPreview.seller_best_price_usd,
        memoryPreview.quoted_price_usd,
        memoryPreview.seller_price_usd,
      );
      const derivedIncoterm = firstTextValue(summary.incoterm, memoryPreview.incoterm, memoryPreview.trade_terms);
      const derivedPaymentTerms = firstTextValue(summary.payment_terms, memoryPreview.payment_terms);
      if (derivedProduct) derivedIntent.product = derivedProduct;
      if (derivedQuantity) derivedIntent.quantity = derivedQuantity;
      if (derivedTargetPrice) derivedIntent.target_price_usd = derivedTargetPrice;
      if (derivedSellerPrice) derivedIntent.seller_best_price_usd = derivedSellerPrice;
      if (derivedIncoterm) derivedIntent.incoterm = derivedIncoterm;
      if (derivedPaymentTerms) derivedIntent.payment_terms = derivedPaymentTerms;
      const derivedPrice: JsonRecord = {};
      if (derivedProduct) derivedPrice.product = derivedProduct;
      if (derivedTargetPrice) derivedPrice.target_price_usd = derivedTargetPrice;
      if (derivedSellerPrice) derivedPrice.agreed_or_best_price_usd = derivedSellerPrice;
      const nextActions = asStringArray(summary.next_actions ?? summary.nextActions);
      const negotiationSummary =
        firstTextValue(summary.negotiation_summary, summary.summary, memoryPreview.summary, behaviorSignals.summary) ??
        "已完成聊天记录整理。";
      const normalizedProductInterest = asStringArray(handoff.product_interest).length
        ? asStringArray(handoff.product_interest)
        : derivedProduct
          ? [derivedProduct]
          : ["mobile accessories"];
      const hasCountry = Boolean(profile.country ?? handoff.country);
      const hasWebsite = Boolean(profile.website ?? handoff.website);
      const hasEmail = Boolean(profile.email ?? handoff.email);
      const normalizedHandoff = {
        ...handoff,
        source:
          supplementTarget?.source === "manual_screening"
            ? "manual_input"
            : asString(handoff.source) ?? "accio_memory",
        lead_id: supplementTarget?.customerId ?? asString(handoff.lead_id ?? handoff.target_id) ?? conversationId,
        target_id: supplementTarget?.customerId ?? asString(handoff.target_id),
        company_name: companyName,
        country: toOptionalCountryCode(handoff.country ?? profile.country),
        website: toUrl(handoff.website ?? profile.website),
        email: toEmail(handoff.email ?? profile.email),
        contact_person: asString(handoff.contact_person ?? profile.contact_person),
        product_interest: normalizedProductInterest,
        supplied_fields: asStringArray(handoff.supplied_fields).length
          ? asStringArray(handoff.supplied_fields)
          : [
              "company_name",
              ...(hasCountry ? ["country"] : []),
              ...(hasWebsite ? ["website"] : []),
              ...(hasEmail ? ["email"] : []),
              ...(normalizedProductInterest.length ? ["product_interest"] : []),
            ],
        missing_fields: asStringArray(handoff.missing_fields),
      };
      const sourceReferences = Array.isArray(summary.source_references) && summary.source_references.length > 0
        ? summary.source_references
        : Array.isArray(memoryPreview.source_references) && memoryPreview.source_references.length > 0
          ? memoryPreview.source_references
          : [];
      return {
        conversation_id: conversationId,
        customer_profile: {
          ...profile,
          company_name: companyName,
          country: toOptionalCountryCode(profile.country),
          contact_person: asString(profile.contact_person),
          email: toEmail(profile.email),
          website: toUrl(profile.website),
        },
        purchase_intent: purchaseIntent.length
          ? purchaseIntent
          : isNonEmptyRecord(derivedIntent)
            ? [derivedIntent]
            : [],
        negotiated_prices: negotiatedPrices.length
          ? negotiatedPrices
          : negotiatedPricesFromPreview.length
            ? negotiatedPricesFromPreview
            : isNonEmptyRecord(derivedPrice)
              ? [derivedPrice]
              : [],
        negotiation_summary: negotiationSummary,
        next_actions: nextActions.length ? nextActions : ["复核记忆预览并决定是否移交背调"],
        behavior_signals: isNonEmptyRecord(behaviorSignals)
          ? {
              ...behaviorSignals,
              ...(supplementTarget
                ? {
                    supplement_target: {
                      customer_id: supplementTarget.customerId,
                      company_name: supplementTarget.companyName,
                      source: supplementTarget.source,
                    },
                  }
                : {}),
            }
          : memoryPreview.summary
            ? {
                summary: memoryPreview.summary,
                ...(supplementTarget
                  ? {
                      supplement_target: {
                        customer_id: supplementTarget.customerId,
                        company_name: supplementTarget.companyName,
                        source: supplementTarget.source,
                      },
                    }
                  : {}),
              }
            : {
                summary: negotiationSummary,
                ...(supplementTarget
                  ? {
                      supplement_target: {
                        customer_id: supplementTarget.customerId,
                        company_name: supplementTarget.companyName,
                        source: supplementTarget.source,
                      },
                    }
                  : {}),
              },
        screening_handoff_target: normalizedHandoff,
        memory_preview: {
          ...memoryPreview,
          summary: firstTextValue(memoryPreview.summary, negotiationSummary),
          status: "preview_only",
        },
        source_references: sourceReferences.length > 0
          ? sourceReferences.map((source) => {
              const sourceRecord = asRecord(source);
              return {
                source_type: sourceType(sourceRecord.source_type ?? "self_reported"),
                source_file: asString(sourceRecord.source_file) ?? sourceFileName,
                conversation_id: asString(sourceRecord.conversation_id) ?? conversationId,
              };
            })
          : [
              {
                source_type: "self_reported",
                source_file: sourceFileName,
                conversation_id: conversationId,
              },
            ],
      };
    }),
  };
}

export async function completeEmployeeLeadRun(input: {
  leadRunId: string;
  agentRunId: string;
  sessionKey: string;
  payload: unknown;
}) {
  return jsonPost<CompleteEmployeeLeadRunResponse>(
    `/api/client-demos/cross-border/employee/lead-runs/${input.leadRunId}/complete`,
    {
      agent_run_id: input.agentRunId,
      session_key: input.sessionKey,
      payload: normalizeLeadPayload(input.payload),
    },
  );
}

export async function completeEmployeeScreeningRun(input: {
  agentRunId: string;
  sessionKey: string;
  payload: unknown;
}) {
  return jsonPost<CompleteEmployeeScreeningRunResponse>(`/api/client-demos/cross-border/employee/screening-runs/${input.agentRunId}/complete`, {
    agent_run_id: input.agentRunId,
    session_key: input.sessionKey,
    payload: normalizeScreeningPayload(input.payload),
  });
}

export async function completeEmployeeAccioImport(input: {
  importId: string;
  agentRunId: string;
  sessionKey: string;
  sourceFileName: string;
  payload: unknown;
  supplementTarget?: AccioMemoryTaskInput["supplementTarget"];
}) {
  return jsonPost(`/api/client-demos/cross-border/employee/memory/imports/${input.importId}/complete`, {
    agent_run_id: input.agentRunId,
    session_key: input.sessionKey,
    payload: normalizeAccioPayload(input.payload, input.sourceFileName, input.supplementTarget),
  });
}

export function employeeTaskFailureCode(error: unknown) {
  if (error instanceof EmployeeTaskError) return error.code;
  return "unknown";
}

export async function failEmployeeTaskInDb(input: {
  agentRunId: string;
  sessionKey?: string;
  error: unknown;
  message: string;
}) {
  return jsonPost(`/api/client-demos/cross-border/employee/tasks/${input.agentRunId}/fail`, {
    session_key: input.sessionKey,
    error_code: employeeTaskFailureCode(input.error),
    error_message: input.message,
    details: input.error instanceof CbeEmployeeApiError
      ? { api_status: input.error.status, api_code: input.error.code, api_details: input.error.details }
      : {},
  });
}

export function manualInputToSyntheticAccio(input: ManualScreeningInput) {
  return {
    conversations: [
      {
        conversation_id: `manual-${Date.now()}`,
        buyer: {
          company_name: input.companyName,
          country: input.country,
          display_name: input.contactPerson,
          email: input.email,
          website: input.website,
        },
        messages: [
          {
            timestamp: new Date().toISOString(),
            sender: "operator",
            text: input.operatorNotes || input.productInterest || "Manual screening context.",
          },
        ],
      },
    ],
  };
}

export function isAccioAgent(agentId: string) {
  return agentId === ACCIO_AGENT_ID;
}
