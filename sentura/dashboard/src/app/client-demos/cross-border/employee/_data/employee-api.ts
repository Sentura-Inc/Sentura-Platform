import type {
  CustomerEvidenceItem,
  CustomerListItem,
  CustomerScoreBlock,
  CustomerScreeningReport,
  MemoryRecordItem,
  ScreeningRiskTier,
  ScoreTier,
} from "./employee-data";
import {
  ACCIO_AGENT_ID,
  EmployeeTaskError,
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

interface ApiAccioImport {
  id: string;
  agentRunId: string | null;
  sourceFileName: string | null;
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
  companyName: string | null;
  country: string | null;
  conversationCount: number;
  nextActions: string[];
  summaryText: string | null;
  memoryFactStatus: string | null;
  validationStatus: string;
  classification: string;
  uploadedAt: string;
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

const DEFAULT_CBE_USER_ID = "cbe-user-operator-001";
const CBE_USER_ID = process.env.NEXT_PUBLIC_CBE_USER_ID ?? DEFAULT_CBE_USER_ID;
const REQUEST_HEADERS = {
  "content-type": "application/json",
  "x-cbe-user-id": CBE_USER_ID,
};

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

function scoreTier(score?: number | null, riskTier?: string | null): ScoreTier | undefined {
  if (riskTier === "trusted_candidate") return "high";
  if (riskTier === "high_risk") return "low";
  if (riskTier === "cautious") return "medium";
  if (typeof score !== "number") return undefined;
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function screeningStatusFromRecord(record: ApiCustomerRecord): CustomerListItem["screeningStatus"] {
  if (record.leadStatus === "failed") return "failed";
  if (record.screeningStatus === "running" || record.screeningStatus === "polling") return "running";
  if (record.screeningStatus === "insufficient_evidence") return "insufficient_evidence";
  if (record.screeningStatus === "trusted_candidate" || record.screeningStatus === "cautious" || record.screeningStatus === "high_risk") {
    return "screened";
  }
  return "not_started";
}

function normalizeRiskTier(value: unknown, score?: number | null): ScreeningRiskTier {
  if (value === "trusted_candidate" || value === "cautious" || value === "insufficient_evidence" || value === "high_risk") {
    return value;
  }
  if (typeof score !== "number") return "insufficient_evidence";
  if (score >= 75) return "trusted_candidate";
  if (score >= 55) return "cautious";
  return "high_risk";
}

function scoreBlockId(value: unknown) {
  const raw = asString(value) ?? "public_footprint";
  return SCORE_BLOCK_IDS.has(raw) ? raw : "public_footprint";
}

function sourceType(value: unknown) {
  const raw = asString(value) ?? "public_web";
  return ALLOWED_SOURCE_TYPES.has(raw) ? raw : "public_web";
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
    summary: asString(raw.summary),
    reason: asString(raw.reason),
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
    finding: asString(raw.finding ?? raw.summary ?? raw.excerpt) ?? "背调员工返回了证据项，但未提供可读摘要。",
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

function reportFromRecord(record: ApiCustomerRecord): CustomerScreeningReport | undefined {
  const raw = asRecord(record.reportJson);
  if (!record.latestScreeningReportId && Object.keys(raw).length === 0) return undefined;
  const evidence = payloadArray(raw.evidence ?? [], "evidence").map(normalizeEvidence);
  const scoreBlocks = payloadArray(raw.score_blocks ?? raw.scoreBlocks ?? [], "score_blocks").map(normalizeScoreBlock);
  const riskTier = normalizeRiskTier(raw.risk_tier ?? raw.riskTier ?? record.screeningStatus, record.normalizedScore);
  return {
    reportId: asString(raw.report_id ?? raw.reportId) ?? record.latestScreeningReportId ?? record.recordId,
    riskTier,
    normalizedScore: asNumber(raw.normalized_score ?? raw.normalizedScore) ?? record.normalizedScore,
    evidenceCoverage: asNumber(raw.evidence_coverage ?? raw.evidenceCoverage) ?? record.evidenceCoverage ?? undefined,
    recommendedAction: asString(raw.recommended_action ?? raw.recommendedAction) ?? record.recommendedAction ?? "复核背调报告后决定是否跟进。",
    createdAt: asString(raw.created_at ?? raw.createdAt) ?? record.updatedAt,
    scoreBlocks,
    evidence,
    coverageGaps: payloadArray(raw.coverage_gaps ?? raw.coverageGaps ?? [], "coverage_gaps").map((item, index) => {
      const gap = asRecord(item);
      return {
        block: asString(gap.block ?? gap.score_block) ?? `coverage-gap-${index + 1}`,
        reason: asString(gap.reason ?? gap.summary ?? gap.note) ?? "缺少该维度证据。",
        action: asString(gap.action ?? gap.recommended_action),
      };
    }),
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
    website,
  ].filter((url): url is string => Boolean(url))));
  return {
    customerId: record.recordId,
    source: record.recordType === "screening_target" ? "manual_screening" : "lead_discovery",
    companyName: record.companyName,
    country: record.country ?? "ZZ",
    countryName: countryName(record.country),
    buyerType: record.buyerType ?? "buyer",
    products: record.matchedProducts?.length ? record.matchedProducts : ["mobile accessories"],
    website,
    foundAt: record.createdAt,
    screeningStatus: status,
    normalizedScore: normalizedScore ?? undefined,
    scoreTier: scoreTier(normalizedScore, report?.riskTier ?? record.screeningStatus),
    reportId: record.latestScreeningReportId ?? report?.reportId,
    latestAgentRunId: asString(asRecord(record.reportJson).agent_run_id),
    sourceUrls,
    evidenceSummary:
      report?.evidence.map((item) => item.finding).find(Boolean) ??
      record.recommendedAction ??
      "数据库中已有客户记录，等待下一步背调或人工复核。",
    recommendedAction: report?.recommendedAction ?? record.recommendedAction ?? "进入背调或复核客户资料。",
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

function taskFromApi(record: ApiAgentRun): CbeEmployeeTaskRecord | null {
  const taskKind = record.taskKind ?? record.task_kind ?? "lead";
  const sessionKey = record.sessionKey ?? record.session_key ?? undefined;
  if (taskKind === "accio_memory" && record.status === "queued" && !sessionKey) {
    return null;
  }
  const startedAt = Date.parse(record.startedAt ?? record.started_at ?? "");
  const finishedAt = record.finishedAt ?? record.finished_at;
  const updatedAt = finishedAt ? Date.parse(finishedAt) : startedAt;
  const metadata = record.metadataJson ?? record.metadata_json ?? {};
  const status = (record.status === "completed" || record.status === "failed" || record.status === "running" || record.status === "polling")
    ? record.status
    : "queued";
  const estimatedMs = taskEstimateMs(taskKind);
  const message =
    record.errorMessage ??
    record.error_message ??
    record.currentStage ??
    record.current_stage ??
    (status === "completed" ? "后台任务已完成。" : "后台任务正在执行。");
  return {
    id: record.id,
    kind: taskKind === "screening" ? "screening" : taskKind === "accio_memory" ? "accio_memory" : "lead",
    title: taskKindLabel(taskKind),
    status: status as CbeEmployeeTaskStatus,
    message,
    startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    completedAt: finishedAt ? Date.parse(finishedAt) : undefined,
    estimatedMs,
    timeoutMs: Math.max(estimatedMs + 120_000, 300_000),
    deadlineAt: (Number.isFinite(startedAt) ? startedAt : Date.now()) + Math.max(estimatedMs + 120_000, 300_000),
    sessionKey,
    targetLabel: record.targetSummary ?? record.target_summary ?? undefined,
    resultCount: asNumber(metadata.saved_leads ?? metadata.saved_reports ?? metadata.saved_summaries),
    error: record.errorMessage ?? record.error_message ?? undefined,
    dismissed: typeof metadata.dismissed_at === "string",
    notificationRead: typeof metadata.notification_read_at === "string",
    metadata,
  };
}

function memoryFromApi(record: ApiMemoryRecord): MemoryRecordItem {
  const analyzed = Boolean(record.summaryId);
  return {
    recordId: record.importId,
    name: record.companyName ?? record.sourceFileName ?? "未命名聊天记录",
    source: record.sourceFileName?.toLowerCase().includes("alibaba") ? "alibaba_international" : "accio",
    importedAt: record.uploadedAt,
    analysisStatus: analyzed
      ? "analyzed"
      : record.agentRunStatus === "failed" || record.validationStatus === "failed"
        ? "failed"
        : record.agentRunStatus === "running" || record.agentRunStatus === "polling"
          ? "running"
          : "not_started",
    conversationCount: record.conversationCount,
    reportId: record.summaryId ?? undefined,
    latestAgentRunId: record.agentRunId ?? undefined,
    memoryPreviewStatus:
      record.memoryFactStatus === "approved" || record.memoryFactStatus === "rejected"
        ? record.memoryFactStatus
        : "preview_only",
    summary:
      record.summaryText ??
      record.nextActions[0] ??
      (analyzed ? "记忆员工已生成结构化摘要。" : "已导入，等待记忆员工分析后生成写入预览。"),
    handoffCompany: record.companyName ?? undefined,
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

export async function fetchEmployeeTasks() {
  const page = await fetchEmployeeJson<ApiPage<ApiAgentRun>>("/api/client-demos/cross-border/employee/tasks?limit=50");
  return page.items.map(taskFromApi).filter((item): item is CbeEmployeeTaskRecord => Boolean(item));
}

export async function markEmployeeNotificationsRead(ids: string[]) {
  if (ids.length === 0) return { readIds: [] as string[] };
  return jsonPost<{ readIds: string[] }>("/api/client-demos/cross-border/employee/notifications/read", { ids });
}

export async function createEmployeeLeadRun(input: EmployeeLeadTaskInput, sessionKey: string) {
  return jsonPost<{ agentRun: ApiAgentRun; leadRun: ApiLeadRun }>(
    "/api/client-demos/cross-border/employee/lead-runs",
    {
      query_config: {
        product_keywords: asStringArray(input.productKeywords),
        countries: asStringArray(input.countries).map((item) => item.toUpperCase()),
        buyer_types: asStringArray(input.buyerTypes),
        exclude_domains: asStringArray(input.excludeDomains),
        max_results_per_query: input.maxResultsPerQuery ?? 10,
      },
      target_count: input.targetCount,
      session_key: sessionKey,
      target_summary: `${input.productKeywords} / ${input.countries}`,
    },
  );
}

export async function createEmployeeScreeningRun(
  targets: ScreeningTarget[],
  sessionKey: string,
  options: EmployeeScreeningTaskOptions = {},
) {
  return jsonPost<{ agentRun: ApiAgentRun }>("/api/client-demos/cross-border/employee/screening-runs", {
    target_summary: targets.map((target) => target.company_name ?? target.target_id).join(", ").slice(0, 240),
    target_record_type: targets.length === 1 ? targets[0].source : "screening_batch",
    target_record_id: targets.length === 1 ? targets[0].lead_id ?? targets[0].target_id : undefined,
    session_key: sessionKey,
    metadata_json: {
      target_count: targets.length,
      options,
    },
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

export async function createEmployeeAccioImport(input: AccioMemoryTaskInput, sessionKey?: string) {
  const serialized = JSON.stringify(input.chatExport);
  return jsonPost<{ agentRun: ApiAgentRun; accioImport: ApiAccioImport }>(
    "/api/client-demos/cross-border/employee/memory/imports",
    {
      source_file_name: input.recordName,
      file_hash: await sha256Hex(serialized),
      storage_key: `local-browser-cache://${await sha256Hex(`${input.recordName}:${serialized.length}`)}`,
      classification: "T3",
      session_key: sessionKey,
      conversations: await accioConversationsFromPayload(input.chatExport),
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
        throw new EmployeeTaskError("marker_missing", `获客结果缺少可追溯来源 URL：${asString(lead.company_name ?? lead.name) ?? `Unknown buyer ${index + 1}`}`);
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
      const score = asNumber(report.normalized_score ?? report.normalizedScore ?? report.score);
      const riskTier = normalizeRiskTier(report.risk_tier ?? report.riskTier, score);
      const evidenceRows = Array.isArray(report.evidence) ? report.evidence : [];
      const targetWebsite = toUrl(target.website);
      if (evidenceRows.length === 0 && !targetWebsite) {
        throw new EmployeeTaskError("marker_missing", `背调报告缺少可追溯证据 URL：${companyName}`);
      }
      const evidence = (evidenceRows.length ? evidenceRows : [{ source_url: targetWebsite }])
        .map((evidenceItem) => {
          const evidenceRecord = asRecord(evidenceItem);
          const sourceUrl = toUrl(evidenceRecord.source_url ?? evidenceRecord.sourceUrl ?? evidenceRecord.url);
          if (!sourceUrl) {
            throw new EmployeeTaskError("marker_missing", `背调报告缺少可追溯证据 URL：${companyName}`);
          }
          return {
            layer: asString(evidenceRecord.layer) ?? "public_footprint",
            source_type: sourceType(evidenceRecord.source_type),
            source: asString(evidenceRecord.source),
            source_url: sourceUrl,
            finding: asString(evidenceRecord.finding ?? evidenceRecord.summary ?? evidenceRecord.excerpt) ?? "背调员工返回了证据项。",
            confidence: asNumber(evidenceRecord.confidence),
            fetched_at: toIsoTimestamp(evidenceRecord.fetched_at ?? evidenceRecord.fetchedAt, now),
            cost_usd: asNumber(evidenceRecord.cost_usd ?? evidenceRecord.costUsd),
            score_block: scoreBlockId(evidenceRecord.score_block ?? evidenceRecord.scoreBlock),
            score_impact:
              evidenceRecord.score_impact === "positive" ||
              evidenceRecord.score_impact === "negative" ||
              evidenceRecord.score_impact === "coverage_only"
                ? evidenceRecord.score_impact
                : "neutral",
          };
        });
      const scoreBlocks = payloadArray(report.score_blocks ?? report.scoreBlocks ?? [], "score_blocks");
      return {
        report_id: asString(report.report_id ?? report.reportId) ?? `screening-report-${Date.now()}-${index}`,
        lead_id: asString(report.lead_id ?? target.lead_id) ?? null,
        target_source:
          report.target_source === "marketing_lead" ||
          report.target_source === "marketing_lead_batch" ||
          report.target_source === "accio_memory"
            ? report.target_source
            : "manual_input",
        company_name: companyName,
        target: {
          source:
            target.source === "marketing_lead" ||
            target.source === "marketing_lead_batch" ||
            target.source === "accio_memory"
              ? target.source
              : "manual_input",
          lead_id: asString(target.lead_id ?? report.lead_id) ?? null,
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
        normalized_score: typeof score === "number" ? score : null,
        evidence_coverage: asNumber(report.evidence_coverage ?? report.evidenceCoverage) ?? (evidence.length > 0 ? 0.5 : 0),
        recommended_action: asString(report.recommended_action ?? report.recommendedAction) ?? "复核背调报告后决定是否跟进。",
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
                reason: "员工报告未返回评分维度拆解，已保留证据供人工复核。",
              },
            ],
        evidence,
        coverage_gaps: Array.isArray(report.coverage_gaps) ? report.coverage_gaps.map(asRecord) : [],
        open_questions: asStringArray(report.open_questions),
        created_at: toIsoTimestamp(report.created_at, now),
      };
    }),
  };
}

function normalizeAccioPayload(payload: unknown, sourceFileName: string) {
  return {
    summaries: payloadArray(payload, "summaries").map((item, index) => {
      const summary = asRecord(item);
      const profile = asRecord(summary.customer_profile);
      const conversationId = asString(summary.conversation_id ?? summary.conversationId) ?? `conversation-${index + 1}`;
      const companyName = asString(profile.company_name ?? summary.company_name) ?? `Unknown company ${index + 1}`;
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
        purchase_intent: Array.isArray(summary.purchase_intent) ? summary.purchase_intent.map(asRecord) : [],
        negotiated_prices: Array.isArray(summary.negotiated_prices) ? summary.negotiated_prices.map(asRecord) : [],
        negotiation_summary: asString(summary.negotiation_summary ?? summary.summary) ?? "记忆员工已生成 Accio 对话摘要。",
        next_actions: asStringArray(summary.next_actions).length ? asStringArray(summary.next_actions) : ["复核记忆预览并决定是否移交背调"],
        behavior_signals: asRecord(summary.behavior_signals),
        screening_handoff_target: asRecord(summary.screening_handoff_target),
        memory_preview: {
          ...asRecord(summary.memory_preview),
          status: "preview_only",
        },
        source_references: Array.isArray(summary.source_references) && summary.source_references.length > 0
          ? summary.source_references.map((source) => {
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
  return jsonPost(`/api/client-demos/cross-border/employee/lead-runs/${input.leadRunId}/complete`, {
    agent_run_id: input.agentRunId,
    session_key: input.sessionKey,
    payload: normalizeLeadPayload(input.payload),
  });
}

export async function completeEmployeeScreeningRun(input: {
  agentRunId: string;
  sessionKey: string;
  payload: unknown;
}) {
  return jsonPost(`/api/client-demos/cross-border/employee/screening-runs/${input.agentRunId}/complete`, {
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
}) {
  return jsonPost(`/api/client-demos/cross-border/employee/memory/imports/${input.importId}/complete`, {
    agent_run_id: input.agentRunId,
    session_key: input.sessionKey,
    payload: normalizeAccioPayload(input.payload, input.sourceFileName),
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
