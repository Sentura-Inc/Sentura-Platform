import type { GatewayClient, TranscriptMessage } from "@/lib/gateway";
import {
  employeeProfile,
  MAX_LEAD_TARGET_COUNT,
  coverageGapsFromScoreBlocks,
  coverageGapActionForBlock,
  coverageGapReasonForBlock,
  isGenericCoverageGapReason,
  type CustomerAddressFootprint,
  type CustomerListItem,
  type CustomerCoverageGap,
  type CustomerEvidenceItem,
  type CustomerScoreBlock,
  type CustomerScreeningReport,
  type AddressFootprintAddressType,
  type AddressFootprintCoverageStatus,
  type AddressFootprintRelationshipStatus,
  type ScreeningEvidenceLayer,
  type ScreeningEvidenceStatus,
  type ScreeningRiskTier,
  type ScreeningScoreImpact,
  type MemoryRecordItem,
  type ScoreTier,
} from "./employee-data";

export type EmployeeTaskStatus = "queued" | "running" | "polling" | "completed" | "failed";

export interface EmployeeTaskProgress {
  status: EmployeeTaskStatus;
  message: string;
  sessionKey?: string;
  startedAt?: number;
  estimatedMs?: number;
  elapsedMs?: number;
  remainingMs?: number;
  progressPercent?: number;
}

export interface EmployeeTaskResult<T> {
  sessionKey: string;
  assistantText: string;
  payload: unknown;
  records: T;
}

export interface EmployeeLeadTaskInput {
  productKeywords: string;
  countries: string;
  buyerTypes: string;
  targetCount: number;
  maxResultsPerQuery?: number;
  excludeDomains: string;
  runMode?: "new_scope" | "top_up_unique_leads";
  existingIdentityKeys?: string[];
  alreadyCoveredQueries?: string[];
}

export interface EmployeeScreeningTaskOptions {
  paidEmailValidation?: boolean;
  paidTradeData?: boolean;
  maxPaidSpendUsd?: number;
}

export interface ManualScreeningInput {
  companyName: string;
  country: string;
  buyerType: string;
  productInterest: string;
  website: string;
  email: string;
  contactPerson: string;
  operatorNotes: string;
}

export interface ScreeningTarget {
  target_id: string;
  source: "marketing_lead" | "marketing_lead_batch" | "manual_input" | "accio_memory";
  lead_id: string | null;
  company_name?: string;
  country?: string;
  website?: string;
  domain?: string;
  email?: string;
  contact_person?: string;
  buyer_type?: string;
  product_interest: string[];
  operator_notes?: string;
  supplied_fields: string[];
  missing_fields: string[];
}

export interface AccioMemoryTaskInput {
  recordName: string;
  sourceLabel: string;
  chatExport: unknown;
  supplementTarget?: {
    customerId: string;
    companyName: string;
    source: CustomerListItem["source"];
  };
}

export type CbeEmployeeAgentId = "cbe-lead-discovery" | "cbe-buyer-screening" | "cbe-accio-memory";

export const LEAD_AGENT_ID: CbeEmployeeAgentId = "cbe-lead-discovery";
export const SCREENING_AGENT_ID: CbeEmployeeAgentId = "cbe-buyer-screening";
export const ACCIO_AGENT_ID: CbeEmployeeAgentId = "cbe-accio-memory";

const LEADS_JSON_START = "LEAD_CANDIDATES_JSON_START";
const LEADS_JSON_END = "LEAD_CANDIDATES_JSON_END";
const REPORT_JSON_START = "SCREENING_REPORTS_JSON_START";
const REPORT_JSON_END = "SCREENING_REPORTS_JSON_END";
const SUMMARY_JSON_START = "ACCIO_SUMMARIES_JSON_START";
const SUMMARY_JSON_END = "ACCIO_SUMMARIES_JSON_END";
const HIDDEN_TASK_TRANSCRIPT_LIMIT = 80;
const HIDDEN_TASK_TRANSCRIPT_MAX_CHARS = 300_000;
const HIDDEN_TASK_FINAL_TRANSCRIPT_GRACE_MS = 60_000;

const COUNTRY_NAMES: Record<string, string> = {
  BR: "巴西",
  CN: "中国",
  DE: "德国",
  FR: "法国",
  GB: "英国",
  MX: "墨西哥",
  SE: "瑞典",
  US: "美国",
};

export class EmployeeTaskError extends Error {
  readonly code: "gateway" | "backend_error" | "marker_missing" | "parse_error" | "timeout" | "cancelled";
  readonly sessionKey?: string;
  readonly lastAssistantText?: string;

  constructor(
    code: EmployeeTaskError["code"],
    message: string,
    options?: { sessionKey?: string; lastAssistantText?: string },
  ) {
    super(message);
    this.name = "EmployeeTaskError";
    this.code = code;
    this.sessionKey = options?.sessionKey;
    this.lastAssistantText = options?.lastAssistantText;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function throwIfTaskCancelled(signal: AbortSignal | undefined, sessionKey?: string) {
  if (!signal?.aborted) return;
  throw new EmployeeTaskError("cancelled", "任务已取消，结果不会写入列表。", { sessionKey });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string") return csv(value);
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function csv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nowLabel() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function uniqueTaskLabel(base: string) {
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${base} ${Date.now().toString(36)}-${nonce}`;
}

function createEmployeeSessionKey(agentId: string) {
  const token = employeeProfile.userToken.trim();
  const cryptoId = globalThis.crypto?.randomUUID?.();
  const nonce = cryptoId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return token ? `agent:${agentId}:user:${token}:${nonce}` : `agent:${agentId}:dashboard:${nonce}`;
}

export function createPlannedEmployeeSessionKey(agentId: CbeEmployeeAgentId) {
  return createEmployeeSessionKey(agentId);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTaskDuration(ms: number) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function progressFields(startedAt: number, waitWindowMs: number) {
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const remainingMs = Math.max(0, waitWindowMs - elapsedMs);
  const progressPercent = Math.min(
    95,
    Math.max(5, Math.round((elapsedMs / Math.max(waitWindowMs, 1)) * 100)),
  );
  return { elapsedMs, remainingMs, progressPercent };
}

function progressMessage(base: string, startedAt: number, waitWindowMs: number, pollCount?: number) {
  const { elapsedMs } = progressFields(startedAt, waitWindowMs);
  const pollText = typeof pollCount === "number" && pollCount > 0 ? `，已轮询 ${pollCount} 次` : "";
  return `${base} 已用 ${formatTaskDuration(elapsedMs)}${pollText}。`;
}

function unknownErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

export function estimateEmployeeTaskTimeoutMs(estimatedMs: number) {
  const graceMs = Math.max(120_000, Math.round(estimatedMs * 0.35));
  return clamp(estimatedMs + graceMs, 300_000, 1_200_000);
}

export function estimateLeadTaskDurationMs(input: EmployeeLeadTaskInput) {
  const productCount = Math.max(1, csv(input.productKeywords).length);
  const buyerTypeCount = Math.max(1, csv(input.buyerTypes).length);
  const countryCount = Math.max(1, csv(input.countries).length);
  const queryCount = productCount * buyerTypeCount * countryCount;
  const maxResults = input.maxResultsPerQuery ?? 10;
  return clamp(
    150_000 + queryCount * 30_000 + Math.max(1, input.targetCount) * 45_000 + maxResults * 5_000,
    300_000,
    900_000,
  );
}

export function estimateScreeningTaskDurationMs(
  targets: ScreeningTarget[],
  options: EmployeeScreeningTaskOptions = {},
) {
  const paidSourceMs = (options.paidEmailValidation ? 20_000 : 0) + (options.paidTradeData ? 35_000 : 0);
  return clamp(70_000 + Math.max(1, targets.length) * (55_000 + paidSourceMs), 120_000, 810_000);
}

function domainFromWebsite(website?: string) {
  if (!website) return undefined;
  try {
    const url = website.includes("://") ? new URL(website) : new URL(`https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function contentToText(content: TranscriptMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (block && typeof block === "object" && "text" in block) {
          return String((block as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text?: unknown }).text ?? "");
  }
  return "";
}

function assistantTexts(messages: TranscriptMessage[]) {
  return messages
    .filter((message) => message.role === "assistant")
    .map((message) => contentToText(message.content))
    .filter(Boolean);
}

function transcriptFailureMessage(messages: TranscriptMessage[]): { message: string; recoverable: boolean } | undefined {
  for (const message of [...messages].reverse()) {
    const raw = asRecord(message);
    const nested = asRecord(raw.message);
    const errorMessage = asString(raw.errorMessage) ?? asString(nested.errorMessage);
    if (errorMessage) {
      if (/LLM idle timeout/i.test(errorMessage)) {
        return {
          message: `任务处理短暂超时，系统已继续等待重试结果：${errorMessage}`,
          recoverable: true,
        };
      }
      return { message: `任务处理失败：${errorMessage}`, recoverable: false };
    }
    const stopReason = asString(raw.stopReason) ?? asString(nested.stopReason);
    if (message.role === "assistant" && stopReason === "aborted" && !contentToText(message.content)) {
      return { message: "任务被中止，未返回报告。", recoverable: true };
    }
  }
  return undefined;
}

function extractMarkerPayload(text: string, startMarker: string, endMarker: string): unknown | null {
  const start = text.lastIndexOf(startMarker);
  if (start === -1) return null;
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end === -1 || end <= start) return null;
  const raw = text
    .slice(start + startMarker.length, end)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

function isGatewayTimeout(error: unknown) {
  const record = asRecord(error);
  const code = asString(record.code);
  const message = unknownErrorMessage(error, "");
  return code === "TIMEOUT" || /timed?\s*out|timeout/i.test(message);
}

async function readHiddenTaskPayload(options: {
  client: GatewayClient;
  sessionKey: string;
  startMarker: string;
  endMarker: string;
}) {
  const messages = await options.client.getTranscript(
    options.sessionKey,
    HIDDEN_TASK_TRANSCRIPT_LIMIT,
    HIDDEN_TASK_TRANSCRIPT_MAX_CHARS,
  );
  const texts = assistantTexts(messages);
  let lastAssistantText = "";
  let parseError: Error | null = null;
  for (const text of texts.reverse()) {
    lastAssistantText = text;
    try {
      const payload = extractMarkerPayload(text, options.startMarker, options.endMarker);
      if (payload !== null) return { messages, lastAssistantText, payload, parseError: null };
    } catch (error) {
      parseError = error instanceof Error ? error : new Error("JSON parse failed");
    }
  }
  return { messages, lastAssistantText, payload: null, parseError };
}

async function runHiddenEmployeeTask(options: {
  client: GatewayClient;
  agentId: string;
  label: string;
  prompt: string;
  startMarker: string;
  endMarker: string;
  sessionKey?: string;
  estimatedMs?: number;
  timeoutMs?: number;
  pollMs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: EmployeeTaskProgress) => void;
}): Promise<{ sessionKey: string; assistantText: string; payload: unknown }> {
  const {
    client,
    agentId,
    label,
    prompt,
    startMarker,
    endMarker,
    sessionKey: plannedSessionKey,
    estimatedMs: rawEstimatedMs,
    timeoutMs = 180_000,
    pollMs = 1_500,
    signal,
    onProgress,
  } = options;
  const startedAt = Date.now();
  const estimatedMs = rawEstimatedMs ?? Math.max(90_000, timeoutMs - 60_000);

  const emitProgress = (status: EmployeeTaskStatus, baseMessage: string, activeSessionKey?: string) => {
    const fields = progressFields(startedAt, timeoutMs);
    onProgress?.({
      status,
      sessionKey: activeSessionKey,
      startedAt,
      estimatedMs,
      ...fields,
      progressPercent: status === "completed" ? 100 : fields.progressPercent,
      remainingMs: status === "completed" ? 0 : fields.remainingMs,
      message:
        status === "completed" || status === "failed"
          ? baseMessage
          : progressMessage(baseMessage, startedAt, timeoutMs),
    });
  };

  throwIfTaskCancelled(signal);
  emitProgress("queued", "正在创建任务...");

  let sessionKey = "";
  const abortGatewaySession = () => {
    if (!sessionKey) return;
    void client.deleteSession(sessionKey, { deleteTranscript: false }).catch(() => undefined);
  };
  signal?.addEventListener("abort", abortGatewaySession, { once: true });
  try {
    try {
      const created = await client.createSession(agentId, undefined, {
        label,
        key: plannedSessionKey ?? createEmployeeSessionKey(agentId),
      });
      sessionKey = created.key;
      throwIfTaskCancelled(signal, sessionKey);
      if (!sessionKey) {
        throw new EmployeeTaskError("gateway", "系统没有返回任务编号。");
      }
      if (created.runError) {
        throw new EmployeeTaskError("gateway", created.runError, { sessionKey });
      }
      emitProgress("running", "任务已创建，正在提交。", sessionKey);
      throwIfTaskCancelled(signal, sessionKey);
      try {
        await client.sendChatMessage(sessionKey, prompt, undefined, { timeoutMs });
      } catch (error) {
        if (!isGatewayTimeout(error)) throw error;
        emitProgress(
          "running",
          "提交请求等待时间较长，系统正在改为读取任务记录。",
          sessionKey,
        );
      }
      throwIfTaskCancelled(signal, sessionKey);
    } catch (error) {
      if (error instanceof EmployeeTaskError) throw error;
      const message = unknownErrorMessage(error, "任务提交失败。");
      emitProgress("failed", message, sessionKey || undefined);
      throw new EmployeeTaskError("gateway", message, { sessionKey: sessionKey || undefined });
    }

    emitProgress("running", "任务已提交，正在等待结果。", sessionKey);

    const deadline = Date.now() + timeoutMs;
    let lastAssistantText = "";
    let lastRecoverableFailureMessage = "";
    let parseError: Error | null = null;
    let pollCount = 0;

    while (Date.now() < deadline) {
      await sleep(pollMs);
      throwIfTaskCancelled(signal, sessionKey);
      pollCount += 1;
      const fields = progressFields(startedAt, timeoutMs);
      onProgress?.({
        status: "polling",
        sessionKey,
        startedAt,
        estimatedMs,
        ...fields,
        message: progressMessage("正在读取任务状态。", startedAt, timeoutMs, pollCount),
      });

      const payloadRead = await readHiddenTaskPayload({ client, sessionKey, startMarker, endMarker });
      throwIfTaskCancelled(signal, sessionKey);
      if (payloadRead.lastAssistantText) lastAssistantText = payloadRead.lastAssistantText;
      if (payloadRead.payload !== null) {
        emitProgress("completed", "任务已返回结果。", sessionKey);
        throwIfTaskCancelled(signal, sessionKey);
        return { sessionKey, assistantText: payloadRead.lastAssistantText, payload: payloadRead.payload };
      }
      parseError = payloadRead.parseError;

      if (parseError) {
        emitProgress("failed", `任务已返回结果，但系统无法读取：${parseError.message}`, sessionKey);
        throw new EmployeeTaskError(
          "parse_error",
          `任务已返回结果，但系统无法读取：${parseError.message}`,
          { sessionKey, lastAssistantText },
        );
      }

      const failure = transcriptFailureMessage(payloadRead.messages);
      if (failure) {
        if (failure.recoverable) {
          lastRecoverableFailureMessage = failure.message;
          continue;
        }
        emitProgress("failed", failure.message, sessionKey);
        throw new EmployeeTaskError("backend_error", failure.message, { sessionKey, lastAssistantText });
      }
    }

    const finalDeadline = Date.now() + HIDDEN_TASK_FINAL_TRANSCRIPT_GRACE_MS;
    while (Date.now() < finalDeadline) {
      await sleep(pollMs);
      throwIfTaskCancelled(signal, sessionKey);
      const payloadRead = await readHiddenTaskPayload({ client, sessionKey, startMarker, endMarker });
      if (payloadRead.lastAssistantText) lastAssistantText = payloadRead.lastAssistantText;
      if (payloadRead.payload !== null) {
        emitProgress("completed", "任务已返回结果。", sessionKey);
        return { sessionKey, assistantText: payloadRead.lastAssistantText, payload: payloadRead.payload };
      }
      const failure = transcriptFailureMessage(payloadRead.messages);
      if (failure && !failure.recoverable) {
        emitProgress("failed", failure.message, sessionKey);
        throw new EmployeeTaskError("backend_error", failure.message, { sessionKey, lastAssistantText });
      }
    }

    const timeoutMessage = lastRecoverableFailureMessage
      ? `${lastRecoverableFailureMessage}；已继续等待到任务超时，仍未收到结果。`
      : "等待任务返回结果超时。";
    emitProgress("failed", timeoutMessage, sessionKey);
    throw new EmployeeTaskError("timeout", timeoutMessage, { sessionKey, lastAssistantText });
  } finally {
    signal?.removeEventListener("abort", abortGatewaySession);
  }
}

function payloadArray(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function scoreTier(score?: number | null): ScoreTier | undefined {
  if (typeof score !== "number") return undefined;
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function countryName(code?: string) {
  return code ? COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase() : "未确认";
}

function evidenceUrl(entry: Record<string, unknown>) {
  return (
    asString(entry.url) ??
    asString(entry.source_url) ??
    asString(entry.sourceUrl) ??
    asString(entry.source)
  );
}

function evidenceSummaryText(entry: Record<string, unknown>) {
  return (
    asString(entry.finding) ??
    asString(entry.summary) ??
    asString(entry.excerpt) ??
    asString(entry.signal) ??
    asString(entry.evidence) ??
    asString(entry.note)
  );
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeRiskTier(value: unknown, score?: number): ScreeningRiskTier {
  if (typeof score === "number") {
    if (score >= 80) return "trusted_candidate";
    if (score >= 60) return "cautious";
    return "high_risk";
  }
  if (
    value === "trusted_candidate" ||
    value === "cautious" ||
    value === "insufficient_evidence" ||
    value === "high_risk"
  ) {
    return value;
  }
  return "insufficient_evidence";
}

function normalizeEvidenceStatus(value: unknown): ScreeningEvidenceStatus {
  if (
    value === "scored" ||
    value === "not_applicable" ||
    value === "unavailable_api" ||
    value === "disabled_by_budget" ||
    value === "pending_human_input"
  ) {
    return value;
  }
  return "pending_human_input";
}

function normalizeScoreImpact(value: unknown): ScreeningScoreImpact {
  if (value === "positive" || value === "negative" || value === "neutral" || value === "coverage_only") {
    return value;
  }
  return "neutral";
}

function scoreBlockLayer(block: string): ScreeningEvidenceLayer {
  if (block === "legal_identity") return "legal_registry";
  if (block === "domain_email") return "email_dns";
  if (block === "business_fit" || block === "public_footprint") return "public_footprint";
  if (block === "trade_financial") return "trade_customs";
  if (block === "conversation_behavior") return "accio_behavior";
  return "public_footprint";
}

function evidenceLayer(entry: Record<string, unknown>, scoreBlock: string, sourceUrl?: string): ScreeningEvidenceLayer {
  const raw = asString(entry.layer) ?? asString(entry.source_layer);
  if (
    raw === "legal_registry" ||
    raw === "domain_rdap" ||
    raw === "email_dns" ||
    raw === "official_contact" ||
    raw === "google_maps_local_presence" ||
    raw === "address_validation" ||
    raw === "public_footprint" ||
    raw === "trade_customs" ||
    raw === "financial_public_filing" ||
    raw === "accio_behavior"
  ) {
    return raw;
  }
  const url = sourceUrl?.toLowerCase() ?? "";
  if (url.includes("rdap")) return "domain_rdap";
  if (url.includes("addressvalidation.googleapis") || raw === "address_validation") return "address_validation";
  if (url.includes("google.com/maps") || url.includes("maps.googleapis") || url.includes("places.googleapis")) {
    return "google_maps_local_presence";
  }
  if (url.includes("company-information.service.gov.uk") || url.includes("opencorporates")) return "legal_registry";
  if (url.includes("sec.gov")) return "financial_public_filing";
  if (url.includes("importyeti") || url.includes("volza") || url.includes("shipment")) return "trade_customs";
  return scoreBlockLayer(scoreBlock);
}

function normalizeEvidenceItem(item: unknown): CustomerEvidenceItem {
  const raw = asRecord(item);
  const scoreBlock = asString(raw.score_block) ?? asString(raw.block) ?? "public_footprint";
  const sourceUrl =
    asString(raw.source_url) ??
    asString(raw.sourceUrl) ??
    asString(raw.url) ??
    "https://sentura.local/cross-border-intel/evidence";
  const finding =
    evidenceSummaryText(raw) ??
    "背调员工返回了证据项，但未提供可读摘要。";
  const scoreImpact = normalizeScoreImpact(raw.score_impact);
  return {
    layer: evidenceLayer(raw, scoreBlock, sourceUrl),
    sourceUrl,
    sourceType: asString(raw.source_type) ?? asString(raw.sourceType),
    fetchedAt: asString(raw.fetched_at) ?? asString(raw.fetchedAt),
    finding,
    confidence: asNumber(raw.confidence),
    scoreBlock,
    scoreImpact,
    affectsScore: asBool(raw.affects_score) ?? (scoreImpact === "positive" || scoreImpact === "negative"),
    costPosture: asString(raw.cost_posture) ?? asString(raw.costPosture),
  };
}

const DEFAULT_SCORE_BLOCKS: Array<{ block: string; maxPoints: number }> = [
  { block: "legal_identity", maxPoints: 25 },
  { block: "domain_email", maxPoints: 25 },
  { block: "public_footprint", maxPoints: 20 },
  { block: "business_fit", maxPoints: 20 },
  { block: "trade_financial", maxPoints: 10 },
  { block: "conversation_behavior", maxPoints: 15 },
];

function normalizeScoreBlock(item: unknown): CustomerScoreBlock {
  const raw = asRecord(item);
  const block = asString(raw.block) ?? asString(raw.score_block) ?? "public_footprint";
  const status = normalizeEvidenceStatus(raw.status);
  return {
    block,
    status,
    maxPoints: asNumber(raw.max_points) ?? asNumber(raw.maxPoints) ?? 10,
    earnedPoints: asNumber(raw.earned_points) ?? asNumber(raw.earnedPoints) ?? null,
    sourceCount: asNumber(raw.source_count) ?? asNumber(raw.sourceCount),
    summary: asString(raw.summary),
    reason: asString(raw.reason),
  };
}

function synthesizeScoreBlocks(
  rawReport: Record<string, unknown>,
  evidence: CustomerEvidenceItem[],
  score?: number,
): CustomerScoreBlock[] {
  const explicitBlocks = [
    rawReport.score_blocks,
    rawReport.scoreBlocks,
    rawReport.blocks,
    asRecord(rawReport.score_debug).blocks,
    asRecord(rawReport.scoreDebug).blocks,
  ].find(Array.isArray);
  if (Array.isArray(explicitBlocks) && explicitBlocks.length > 0) {
    return explicitBlocks.map(normalizeScoreBlock);
  }

  const scoredBlockIds = new Set(
    evidence
      .map((item) => item.scoreBlock)
      .filter((block): block is string => Boolean(block)),
  );
  const scoredDefaults = DEFAULT_SCORE_BLOCKS.filter((block) => scoredBlockIds.has(block.block));
  const activeBlocks = scoredDefaults.length > 0 ? scoredDefaults : DEFAULT_SCORE_BLOCKS.slice(0, 4);
  const normalizedScore = typeof score === "number" ? score : 60;
  return DEFAULT_SCORE_BLOCKS.map((block) => {
    if (!activeBlocks.some((active) => active.block === block.block)) {
      return {
        block: block.block,
        status: block.block === "conversation_behavior" ? "not_applicable" : "pending_human_input",
        maxPoints: block.maxPoints,
        earnedPoints: null,
        sourceCount: evidence.filter((item) => item.scoreBlock === block.block).length,
        reason: block.block === "conversation_behavior" ? "没有聊天或销售对话记录。" : "报告未返回这一项单项分。",
      };
    }
    return {
      block: block.block,
      status: "scored",
      maxPoints: block.maxPoints,
      earnedPoints: Number(((block.maxPoints * normalizedScore) / 100).toFixed(2)),
      sourceCount: evidence.filter((item) => item.scoreBlock === block.block).length,
      summary: "员工报告未返回单项分，系统按总分比例临时拆分展示。",
    };
  });
}

function normalizeCoverageGap(item: unknown, index: number): CustomerCoverageGap {
  if (typeof item === "string") {
    return { block: `coverage-gap-${index + 1}`, reason: item };
  }
  const raw = asRecord(item);
  const block = asString(raw.block) ?? asString(raw.score_block) ?? `coverage-gap-${index + 1}`;
  const rawStatus = asString(raw.status);
  const status = rawStatus ? normalizeEvidenceStatus(rawStatus) : undefined;
  return {
    block,
    reason: asString(raw.reason) ?? asString(raw.summary) ?? asString(raw.note) ?? coverageGapReasonForBlock(block, status),
    action: asString(raw.action) ?? asString(raw.recommended_action) ?? coverageGapActionForBlock(block, status),
  };
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
  if (Object.keys(raw).length === 0) return undefined;
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

function normalizeAddressFootprint(value: unknown): CustomerAddressFootprint | undefined {
  const raw = asRecord(value);
  if (Object.keys(raw).length === 0) return undefined;
  const rawLocations = Array.isArray(raw.locations) ? raw.locations : [];
  const locations = rawLocations
    .map((item, index) => {
      const location = asRecord(item);
      const displayName = asString(location.display_name) ?? asString(location.displayName) ?? `Google Maps location ${index + 1}`;
      const formattedAddress =
        asString(location.formatted_address) ??
        asString(location.formattedAddress) ??
        asString(location.address) ??
        "";
      return {
        googlePlaceId: asString(location.google_place_id) ?? asString(location.googlePlaceId),
        displayName,
        addressType: normalizeAddressType(location.address_type ?? location.addressType),
        relationshipStatus: normalizeRelationshipStatus(location.relationship_status ?? location.relationshipStatus),
        formattedAddress,
        city: asString(location.city),
        region: asString(location.region),
        country: asString(location.country),
        businessStatus: asString(location.business_status) ?? asString(location.businessStatus),
        types: asStringArray(location.types),
        websiteUri: asString(location.website_uri) ?? asString(location.websiteUri),
        domainMatch: normalizeDomainMatch(location.domain_match ?? location.domainMatch),
        phoneMatch: normalizePhoneMatch(location.phone_match ?? location.phoneMatch),
        addressValidation: normalizeAddressValidation(location.address_validation ?? location.addressValidation),
        googleMapsUri: asString(location.google_maps_uri) ?? asString(location.googleMapsUri),
        matchConfidence: asNumber(location.match_confidence) ?? asNumber(location.matchConfidence),
        matchReasons: asStringArray(location.match_reasons ?? location.matchReasons),
        sourceType: asString(location.source_type) ?? asString(location.sourceType),
        fetchedAt: asString(location.fetched_at) ?? asString(location.fetchedAt),
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
    sectionTitle: asString(raw.section_title) ?? asString(raw.sectionTitle) ?? "线下地址线索",
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

function screeningReportFromRaw(
  raw: Record<string, unknown>,
  sessionKey: string,
  evidence: CustomerEvidenceItem[],
  score?: number,
): CustomerScreeningReport {
  const gapsSource = Array.isArray(raw.missing_or_unavailable_evidence)
    ? raw.missing_or_unavailable_evidence
    : Array.isArray(raw.coverage_gaps)
      ? raw.coverage_gaps
      : Array.isArray(raw.coverageGaps)
        ? raw.coverageGaps
        : [];
  const scoreBlocks = synthesizeScoreBlocks(raw, evidence, score);
  const normalizedGaps = gapsSource.map(normalizeCoverageGap);
  const derivedGaps = coverageGapsFromScoreBlocks(scoreBlocks);
  const coverageGaps =
    normalizedGaps.length > 0 && !normalizedGaps.every((gap) => isGenericCoverageGapReason(gap.reason))
      ? normalizedGaps
      : derivedGaps.length > 0
        ? derivedGaps
        : normalizedGaps;
  return {
    reportId: asString(raw.report_id) ?? asString(raw.reportId) ?? sessionKey,
    riskTier: normalizeRiskTier(asString(raw.risk_tier) ?? asString(raw.riskTier), score),
    normalizedScore: typeof score === "number" ? score : null,
    evidenceCoverage: asNumber(raw.evidence_coverage) ?? asNumber(raw.evidenceCoverage),
    recommendedAction: asString(raw.recommended_action) ?? asString(raw.recommendedAction) ?? "复核背调报告后决定是否跟进。",
    createdAt: nowLabel(),
    scoreBlocks,
    evidence,
    coverageGaps,
    addressFootprint: normalizeAddressFootprint(raw.address_footprint ?? raw.addressFootprint),
    openQuestions: asStringArray(raw.open_questions ?? raw.openQuestions),
  };
}

function normalizedTargetCount(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(MAX_LEAD_TARGET_COUNT, Math.max(1, Math.floor(value)))
    : undefined;
}

function leadRowsFromPayload(payload: unknown, sessionKey: string, targetCount?: number): CustomerListItem[] {
  const runId = asString(asRecord(payload).run_id) ?? sessionKey;
  const rows = payloadArray(payload, "leads")
    .map((item, index) => {
      const raw = asRecord(item);
      const companyName = asString(raw.company_name) ?? asString(raw.name);
      const website = asString(raw.website) ?? asString(raw.url);
      const country = asString(raw.country)?.toUpperCase();
      if (!companyName || !country) return null;
      const sourceUrls = asStringArray(raw.source_urls);
      const evidenceText = asString(raw.discovery_evidence);
      const evidence = Array.isArray(raw.discovery_evidence)
        ? raw.discovery_evidence.map(asRecord)
        : [];
      const evidenceUrls = evidence.map(evidenceUrl);
      const evidenceSummary =
        evidence
          .map(evidenceSummaryText)
          .find(Boolean) ??
        evidenceText ??
        asString(raw.dedupe_explanation) ??
        "获客员工返回了候选买家，需要进入背调确认主体和联系信息。";
      const mergedSourceUrls = uniqueStrings([...sourceUrls, ...evidenceUrls]);

      const row: CustomerListItem = {
        customerId:
          asString(raw.lead_id) ??
          `lead-${domainFromWebsite(website) ?? companyName.toLowerCase().replace(/\W+/g, "-")}-${index + 1}`,
        source: "lead_discovery" as const,
        companyName,
        country,
        countryName: countryName(country),
        city: asString(raw.city),
        buyerType: asString(raw.buyer_type) ?? "buyer",
        products: asStringArray(raw.matched_products).length
          ? asStringArray(raw.matched_products)
          : ["mobile accessories"],
        website,
        foundAt: nowLabel(),
        screeningStatus: "not_started" as const,
        latestAgentRunId: runId,
        sourceUrls: mergedSourceUrls.length
          ? mergedSourceUrls
          : [website ?? runId].filter((url): url is string => Boolean(url)),
        evidenceSummary,
        recommendedAction: "进入背调，确认法律主体、域名/邮箱和采购可信度。",
      };
      return row;
    })
    .filter((item): item is CustomerListItem => Boolean(item));
  const limit = normalizedTargetCount(targetCount);
  return limit ? rows.slice(0, limit) : rows;
}

function screeningRowsFromPayload(
  payload: unknown,
  sessionKey: string,
  fallbackTargets: ScreeningTarget[],
): CustomerListItem[] {
  return payloadArray(payload, "reports")
    .map((item, index) => {
      const raw = asRecord(item);
      const target = asRecord(raw.target);
      const fallback = fallbackTargets[index];
      const companyName =
        asString(raw.company_name) ??
        asString(raw.companyName) ??
        asString(target.company_name) ??
        fallback?.company_name;
      const country =
        (asString(target.country) ?? fallback?.country ?? "ZZ").toUpperCase();
      if (!companyName) return null;
      const score =
        asNumber(raw.normalized_score) ??
        asNumber(raw.normalizedScore) ??
        asNumber(raw.score);
      const evidence = Array.isArray(raw.evidence) ? raw.evidence.map(normalizeEvidenceItem) : [];
      const addressFootprint = normalizeAddressFootprint(raw.address_footprint ?? raw.addressFootprint);
      const addressUrls =
        addressFootprint?.locations
          .map((item) => item.googleMapsUri)
          .filter((url): url is string => Boolean(url)) ?? [];
      const sourceUrls = [...evidence.map((item) => item.sourceUrl), ...addressUrls].filter((url): url is string => Boolean(url));
      const status = typeof score !== "number" ? "insufficient_evidence" : "screened";
      const screeningReport = screeningReportFromRaw(raw, sessionKey, evidence, score);

      const row: CustomerListItem = {
        customerId:
          asString(raw.lead_id) ??
          fallback?.lead_id ??
          fallback?.target_id ??
          `screen-${sessionKey}-${index + 1}`,
        source: fallback?.source === "manual_input" ? "manual_screening" : "lead_discovery",
        companyName,
        country,
        countryName: countryName(country),
        city: asString(target.city),
        buyerType: fallback?.buyer_type ?? asString(target.buyer_type) ?? "buyer",
        products: fallback?.product_interest?.length
          ? fallback.product_interest
          : asStringArray(target.product_interest),
        website: asString(target.website) ?? fallback?.website,
        foundAt: nowLabel(),
        screeningStatus: status,
        normalizedScore: typeof score === "number" ? score : undefined,
        scoreTier: scoreTier(score),
        reportId: asString(raw.report_id),
        latestAgentRunId: sessionKey,
        sourceUrls: sourceUrls.length
          ? sourceUrls
          : [asString(target.website) ?? fallback?.website].filter((url): url is string => Boolean(url)),
        evidenceSummary:
          evidence
            .map((item) => item.finding)
            .find(Boolean) ??
          "已返回背调报告，核验依据可在报告详情中查看。",
        recommendedAction: asString(raw.recommended_action) ?? "复核背调报告后决定是否跟进。",
        screeningReport,
      };
      return row;
    })
    .filter((item): item is CustomerListItem => Boolean(item));
}

function memoryRowsFromPayload(payload: unknown, sessionKey: string): MemoryRecordItem[] {
  return payloadArray(payload, "summaries").map((item, index) => {
    const raw = asRecord(item);
    const profile = asRecord(raw.customer_profile);
    const handoff = asRecord(raw.screening_handoff_target);
    const preview = asRecord(raw.memory_preview ?? raw.memory_write_preview);
    const conversationId =
      asString(raw.conversation_id) ??
      asString(raw.conversationId) ??
      `conversation-${index + 1}`;
    const company =
      asString(raw.company_name) ??
      asString(profile.company_name) ??
      asString(handoff.company_name) ??
      "Unknown company";
    const nextActions = asStringArray(raw.next_actions);
    const recordId = conversationId.startsWith("mem-")
      ? conversationId
      : `mem-${conversationId}`;
    return {
      recordId,
      name: `${company} - 聊天记录`,
      source: "accio",
      importedAt: nowLabel(),
      analysisStatus: "analyzed",
      conversationCount: 1,
      reportId: `accio-summary-${conversationId}`,
      latestAgentRunId: sessionKey,
      memoryPreviewStatus: "preview_only",
      summary:
        asString(raw.negotiation_summary) ??
        asString(raw.summary) ??
        asString(preview.summary) ??
        nextActions[0] ??
        "已完成聊天记录整理。",
      handoffCompany: company,
    };
  });
}

function buildLeadPrompt(input: EmployeeLeadTaskInput) {
  const payload = {
    task_type: "lead_discovery",
    run_mode: input.runMode ?? "new_scope",
    product_keywords: csv(input.productKeywords),
    countries: csv(input.countries).map((item) => item.toUpperCase()),
    buyer_types: csv(input.buyerTypes),
    target_count: input.targetCount,
    max_results_per_query: input.maxResultsPerQuery ?? 10,
    exclude_domains: csv(input.excludeDomains),
    existing_identity_keys: input.existingIdentityKeys ?? [],
    already_covered_queries: input.alreadyCoveredQueries ?? [],
  };
  return `[CBE Employee Lead Discovery Task]

请作为 cbe-lead-discovery 员工执行正式获客任务。这是后台自动化任务，不是聊天。

执行契约：
- 不要回复确认、进度、说明、Markdown、引用脚注或自然语言总结。
- 不调用 Dashboard 预计算 API，不伪造工具结果。
- 允许并优先使用工具：cross-border-intel__cbe_intel_google_places_search、cross-border-intel__cbe_intel_google_place_details、web_search、web_fetch。需要 Nearby 坐标时才用 cross-border-intel__cbe_intel_google_geocode。找到候选后可按需使用 cross-border-intel__cbe_intel_domain_rdap_lookup 或 cross-border-intel__cbe_intel_email_domain_check 做轻量验证。
- 严禁调用或提到这些不存在/不适用的工具名：web.run、browser、exec、shell、message、citation。
- 默认先用 Google Maps Places Text Search 为每个产品/国家/买家画像组合寻找本地/门店/维修/电子零售/区域批发候选；Google Maps 不可用、限流、缺 key 或无结果时，记录 coverage gap 并转入 web_search fallback。
- 只对短名单 place_id 调用 Place Details，使用 lead_discovery_basic 级别信息；不要请求或输出 Google review text、photos、raw response 或 API key。
- 最终答案前必须至少调用一个公开证据工具（Google Maps Places、web_search 或 web_fetch）。最终接受 lead 前必须用 web_search/web_fetch 或公司官网证据确认产品/买家适配；Google Maps 单独只能作为 discovery seed。
- 只返回具体下游买家公司，排除 marketplace、目录页、供应商页和社交主页。
- target_count 是本次任务必须新增的净新客户硬目标；普通 new_scope 不能把它理解成“员工列表总数”，top_up_unique_leads 则表示本次必须补齐的缺口数。
- existing_identity_keys 是数据库中已分配或本 scope 已尝试过的客户 identity；无论 run_mode 是什么都必须避开这些客户。命中 denylist 时要丢弃并继续找替代客户，不能把重复客户计入 target_count。
- run_mode 为 top_up_unique_leads 时，本次只补充缺口客户；不要重复 already_covered_queries 中的搜索字符串。
- max_results_per_query 只是单次查询的搜索返回提示，不是最终候选上限。最终必须围绕 target_count 继续扩展查询，直到得到 target_count 个去重合规候选或公开搜索确实耗尽。
- 在最终输出前，先跨产品、国家、buyer_type、Google Maps query family 和 web query family 收集至少 target_count * 3 个原始候选（target_count 小于 5 时至少 12 个），再做排除、去重、排序和截断。
- 不要因为“高质量优先”、web_fetch 被安全策略拦截、部分官网无法抓取或前几条结果重复而主动限制在 5 个以下；web_fetch 被拦截时，使用 web_search 返回的公司官网 URL、标题和摘要作为 public_web 证据，并继续搜索替代客户。
- 如果候选超过 target_count，只保留证据最强且不在 existing_identity_keys 中的 target_count 个。
- 只有在覆盖所有产品/国家组合、至少使用 company-owned website、retail/repair buyer、store/location/contact proof、reseller/import buyer 四类查询，并完成 denylist 替换后仍不足 target_count 时，才可以少于 target_count，并必须在 shortage_reason 中写清楚缺口原因和已尝试的查询范围。
- 最终自然回复只能包含下面两个 marker 和 marker 中间的 JSON 对象，不要输出任何其他文字。

JSON 字段要求：
- 顶层：run_id、leads；可选 shortage_reason。
- leads 每项：company_name、website、country、buyer_type、matched_products、source_urls、discovery_evidence、duplicate_status、dedupe_explanation、recommended_action。
- discovery_evidence 使用数组，每项包含 source_url、fetched_at 和 finding 或 excerpt；fetched_at 使用 ISO 8601 时间。
- Google Maps evidence 可包含 google_place_id、google_maps_uri、field_mask_profile、business_status、formatted_address、types，但不能包含原始 Google response、review text、photos 或 API key。

最终格式：
${LEADS_JSON_START}
<replace this line with the JSON object only>
${LEADS_JSON_END}

任务输入：
${JSON.stringify(payload, null, 2)}`;
}

function buildScreeningPrompt(targets: ScreeningTarget[], options: EmployeeScreeningTaskOptions = {}) {
  return `[CBE Employee Screening Task]

请作为 cbe-buyer-screening 员工对以下目标执行正式背调。这是后台自动化任务，不是聊天。

执行契约：
- 不要回复确认、进度、说明、Markdown、引用脚注或自然语言总结。
- 严禁调用或提到这些不存在/不适用的工具名：web.run、browser、exec、shell、message、citation。
- 必须使用 cross-border-intel 工具执行背调，不能只靠推理生成报告。
- 对每个目标按最低成本顺序尽量调查并写入报告：公司注册信息、域名/RDAP、邮箱/DNS、官网公开联系信息、Google Maps 本地经营足迹/地址一致性、公开网页足迹、贸易/海关记录、SEC/财务公开文件、Accio/销售行为记录。
- 对每个目标必须调用可用的域名/RDAP、邮箱域名、官方联系邮箱、公司注册、Google Maps local-presence、贸易/海关记录、SEC/财务公开文件、买家评分工具；字段缺失、API 不可用、预算关闭、不适用或未命中时记录 coverage gap。
- Google Maps 地址版图是强制报告板块：每个目标都要尝试发现该公司在 Google Maps 上的全部公开地址版图，包括办公室/总部、门店、仓库/分销点、服务/维修点。先用 company_name/legal name/brand、country、city/region、website domain、phone（如有）和官网 location/store/address 页面线索构造最多 6 组 Text Search 查询；调用 cross-border-intel__cbe_intel_google_places_search 做候选发现。
- 对地址版图候选按 google_place_id、formatted_address、phone、website domain、display_name 去重；对短名单逐个调用 cross-border-intel__cbe_intel_google_place_details，参数使用 field_mask_profile="screening_address_footprint"、purpose="screening"，不请求 review text、photos 或原始 Google response。
- 对完整地址在上限内调用 cross-border-intel__cbe_intel_google_address_validate，并把 verdict 写入 address_footprint.locations[].address_validation。
- 如果 target 或 discovery_evidence 中有 google_place_id，仍可做一次 basic local-presence refresh；这不替代地址版图搜索。若 Google API 缺 key、限流或无结果，address_footprint 仍必须返回 coverage_status="unavailable_api" 或 "not_found" 以及 coverage note。
- 每个地址候选要分类 relationship_status：confirmed_company_location、probable_company_location、possible_related_location、rejected_unrelated_location；地址角色 address_type：headquarters_or_office、storefront、warehouse_or_distribution、service_or_repair_location、unknown_business_location。
- Google Maps / Address Validation 只计入 public_footprint、domain_email 或 business_fit 的支持证据，不要当作法律注册、KYB、贸易、财务或 Accio 行为证明。
- SEC/财务公开文件不能留空：即使目标不是美国上市申报主体，也要调用 SEC 查询或写明 not_applicable/not_found 原因，并把结果放入 financial_public_filing 或 coverage_gaps。
- 如果调用了 cross-border-intel 工具，必须把工具返回的关键结果摘要写入 evidence，不要只写最终结论。
- 使用最低成本证据阶梯，缺失 API/付费证据只能标记 coverage gap，不能当作欺诈证据。
- 不发送外联、不写 CRM、不暴露密钥或完整个人联系信息。
- 最终自然回复只能包含下面两个 marker 和 marker 中间的 JSON 对象，不要输出任何其他文字。

JSON 字段要求：
- 顶层：reports。
- reports 每项：report_id、lead_id、company_name、target、normalized_score、evidence_coverage、risk_tier、score_blocks、evidence、address_footprint、coverage_gaps、recommended_action、open_questions。
- score_blocks 每项：block、status、max_points、earned_points、source_count、summary 或 reason。block 必须覆盖 legal_identity、domain_email、public_footprint、business_fit、trade_financial、conversation_behavior；不适用用 not_applicable，API/预算缺失用 unavailable_api 或 disabled_by_budget。
- evidence 每项：source_url、source_type、finding、score_block、score_impact、affects_score、fetched_at；fetched_at 使用 ISO 8601 时间；如能判断请加 layer、confidence、cost_posture。
- layer 用 legal_registry、domain_rdap、email_dns、official_contact、google_maps_local_presence、address_validation、public_footprint、trade_customs、financial_public_filing、accio_behavior 之一。
- address_footprint 必须包含：
  - section_title="Google Maps 地址版图"
  - coverage_status="found|partial|not_found|unavailable_api|not_checked"
  - search_scope.queries_run、countries、capped、limitations
  - summary.total_locations、confirmed_locations、probable_locations、possible_related_locations、operational_locations、closed_locations、countries、cities
  - locations[]：google_place_id、display_name、address_type、relationship_status、formatted_address、city、region、country、business_status、types、website_uri、domain_match、phone_match、address_validation、google_maps_uri、match_confidence、match_reasons、source_type、fetched_at
  - open_questions
- coverage_gaps 写清楚没查到、没启用、没提供还是 API 不可用。

最终格式：
${REPORT_JSON_START}
<replace this line with the JSON object only>
${REPORT_JSON_END}

任务输入：
${JSON.stringify(
  {
    targets,
    options: {
      enable_paid_email_validation: options.paidEmailValidation ?? false,
      enable_paid_trade_data: options.paidTradeData ?? false,
      max_paid_spend_usd: options.maxPaidSpendUsd ?? 0,
    },
  },
  null,
  2,
)}`;
}

function buildAccioPrompt(input: AccioMemoryTaskInput) {
  const supplementInstruction = input.supplementTarget
    ? `
补充目标：
${JSON.stringify({
  customer_id: input.supplementTarget.customerId,
  company_name: input.supplementTarget.companyName,
  source: input.supplementTarget.source,
}, null, 2)}

重要：这是补充到既有客户的聊天记录，不要把聊天里的其他公司另建为新客户。summary.customer_profile.company_name 和 screening_handoff_target.company_name 必须优先使用补充目标 company_name；screening_handoff_target.lead_id 必须使用补充目标 customer_id。`
    : "";
  return `[CBE Employee Accio Memory Task]

请作为 cbe-accio-memory 员工处理以下 Accio/阿里国际站聊天 JSON。这是后台自动化任务，不是聊天。

执行契约：
- 不要回复确认、进度、说明、Markdown、引用脚注或自然语言总结。
- 严禁调用或提到这些不存在/不适用的工具名：web.run、browser、exec、shell、message、citation。
- 必须使用可用的 cross-border-intel Accio/对话解析或摘要工具；如果工具报告输入有缺口，仍然返回结构化 coverage gap。
- 先验证 JSON，再为每条 conversation 生成结构化摘要、记忆写入预览和背调 handoff。
- 不写入长期记忆，只返回 preview_only。
- 最终自然回复只能包含下面两个 marker 和 marker 中间的 JSON 对象，不要输出任何其他文字。

JSON 字段要求：
- 顶层：summaries。
- summaries 每项必须包含：conversation_id、customer_profile、purchase_intent、negotiated_prices、negotiation_summary、next_actions、behavior_signals、screening_handoff_target、memory_preview、source_references。
- purchase_intent 每项尽量包含 product、quantity、target_price_usd、seller_best_price_usd、incoterm、payment_terms；聊天中没有出现的字段不要编造。
- negotiated_prices 每项尽量包含 product、target_price_usd、quoted_price_usd 或 agreed_or_best_price_usd，以及 price_context；聊天中没有出现的字段不要编造。
- behavior_signals 必须包含 summary，尽量包含 urgency、price_sensitivity、decision_role、risk_flags。
- screening_handoff_target 必须包含 source="accio_memory"、company_name、country、website/email/contact_person（如有）、product_interest、supplied_fields、missing_fields。
- memory_preview.status 必须是 "preview_only"。如果你的技能输出字段名是 memory_write_preview，也要同时复制到 memory_preview，便于 Dashboard 写入。
- source_references 每项包含 source_type、source_file、conversation_id。

最终格式：
${SUMMARY_JSON_START}
<replace this line with the JSON object only>
${SUMMARY_JSON_END}

记录名称：${input.recordName}
来源：${input.sourceLabel}
${supplementInstruction}

Accio JSON:
${JSON.stringify(input.chatExport, null, 2)}`;
}

export function customersToScreeningTargets(customers: CustomerListItem[]): ScreeningTarget[] {
  return customers.map((customer) => ({
    target_id: customer.customerId,
    source:
      customer.source === "accio_handoff"
        ? "accio_memory"
        : customer.source === "manual_screening"
          ? "manual_input"
          : "marketing_lead_batch",
    lead_id: customer.source === "manual_screening" ? null : customer.customerId,
    company_name: customer.companyName,
    country: customer.country,
    website: customer.website,
    domain: domainFromWebsite(customer.website),
    buyer_type: customer.buyerType,
    product_interest: customer.products,
    operator_notes: customer.evidenceSummary,
    supplied_fields: [
      "company_name",
      "country",
      ...(customer.website ? ["website"] : []),
      ...(customer.products.length ? ["product_interest"] : []),
    ],
    missing_fields: [
      ...(customer.website ? [] : ["website"]),
      "registry_number",
      "company_email",
    ],
  }));
}

export function manualInputToScreeningTarget(input: ManualScreeningInput): ScreeningTarget {
  const products = csv(input.productInterest);
  return {
    target_id: `manual-${Date.now()}`,
    source: "manual_input",
    lead_id: null,
    company_name: input.companyName.trim(),
    country: input.country.trim().toUpperCase(),
    website: input.website.trim() || undefined,
    domain: domainFromWebsite(input.website),
    email: input.email.trim() || undefined,
    contact_person: input.contactPerson.trim() || undefined,
    buyer_type: input.buyerType.trim() || "manual target",
    product_interest: products.length ? products : ["mobile accessories"],
    operator_notes: input.operatorNotes.trim() || undefined,
    supplied_fields: [
      "company_name",
      "country",
      ...(input.website.trim() ? ["website"] : []),
      ...(input.email.trim() ? ["email"] : []),
      ...(products.length ? ["product_interest"] : []),
    ],
    missing_fields: [
      ...(input.website.trim() ? [] : ["website"]),
      ...(input.email.trim() ? [] : ["company_email"]),
      "registry_number",
    ],
  };
}

export async function runLeadDiscoveryTask(
  client: GatewayClient,
  input: EmployeeLeadTaskInput,
  onProgress?: (progress: EmployeeTaskProgress) => void,
  options: { sessionKey?: string; signal?: AbortSignal } = {},
): Promise<EmployeeTaskResult<CustomerListItem[]>> {
  const estimatedMs = estimateLeadTaskDurationMs(input);
  const timeoutMs = estimateEmployeeTaskTimeoutMs(estimatedMs);
  const result = await runHiddenEmployeeTask({
    client,
    agentId: LEAD_AGENT_ID,
    label: uniqueTaskLabel("CBE Employee lead discovery"),
    prompt: buildLeadPrompt(input),
    startMarker: LEADS_JSON_START,
    endMarker: LEADS_JSON_END,
    sessionKey: options.sessionKey,
    signal: options.signal,
    estimatedMs,
    timeoutMs,
    onProgress,
  });
  const records = leadRowsFromPayload(result.payload, result.sessionKey, input.targetCount);
  throwIfTaskCancelled(options.signal, result.sessionKey);
  if (records.length === 0) {
    throw new EmployeeTaskError("marker_missing", "获客员工返回了结果，但没有可写入客户列表的客户数据。", {
      sessionKey: result.sessionKey,
      lastAssistantText: result.assistantText,
    });
  }
  return { ...result, records };
}

export async function runScreeningTask(
  client: GatewayClient,
  targets: ScreeningTarget[],
  options?: EmployeeScreeningTaskOptions,
  onProgress?: (progress: EmployeeTaskProgress) => void,
  runOptions: { sessionKey?: string; signal?: AbortSignal } = {},
): Promise<EmployeeTaskResult<CustomerListItem[]>> {
  const estimatedMs = estimateScreeningTaskDurationMs(targets, options);
  const timeoutMs = estimateEmployeeTaskTimeoutMs(estimatedMs);
  const result = await runHiddenEmployeeTask({
    client,
    agentId: SCREENING_AGENT_ID,
    label: uniqueTaskLabel("CBE Employee buyer screening"),
    prompt: buildScreeningPrompt(targets, options),
    startMarker: REPORT_JSON_START,
    endMarker: REPORT_JSON_END,
    sessionKey: runOptions.sessionKey,
    signal: runOptions.signal,
    estimatedMs,
    timeoutMs,
    onProgress,
  });
  const records = screeningRowsFromPayload(result.payload, result.sessionKey, targets);
  throwIfTaskCancelled(runOptions.signal, result.sessionKey);
  if (records.length === 0) {
    throw new EmployeeTaskError("marker_missing", "背调员工返回了结果，但没有可写入客户列表的报告数据。", {
      sessionKey: result.sessionKey,
      lastAssistantText: result.assistantText,
    });
  }
  return { ...result, records };
}

export async function runAccioMemoryTask(
  client: GatewayClient,
  input: AccioMemoryTaskInput,
  onProgress?: (progress: EmployeeTaskProgress) => void,
  options: { sessionKey?: string; signal?: AbortSignal } = {},
): Promise<EmployeeTaskResult<MemoryRecordItem[]>> {
  const result = await runHiddenEmployeeTask({
    client,
    agentId: ACCIO_AGENT_ID,
    label: uniqueTaskLabel("CBE Employee Accio memory"),
    prompt: buildAccioPrompt(input),
    startMarker: SUMMARY_JSON_START,
    endMarker: SUMMARY_JSON_END,
    sessionKey: options.sessionKey,
    signal: options.signal,
    onProgress,
  });
  const records = memoryRowsFromPayload(result.payload, result.sessionKey);
  throwIfTaskCancelled(options.signal, result.sessionKey);
  if (records.length === 0) {
    throw new EmployeeTaskError("marker_missing", "记忆员工返回了结果，但没有可写入列表的摘要数据。", {
      sessionKey: result.sessionKey,
      lastAssistantText: result.assistantText,
    });
  }
  return { ...result, records };
}

export function upsertCustomerRows(
  current: CustomerListItem[],
  updates: CustomerListItem[],
): CustomerListItem[] {
  const byId = new Map(current.map((item) => [item.customerId, item]));
  for (const update of updates) {
    byId.set(update.customerId, { ...byId.get(update.customerId), ...update });
  }
  return Array.from(byId.values());
}

export function upsertMemoryRows(
  current: MemoryRecordItem[],
  updates: MemoryRecordItem[],
): MemoryRecordItem[] {
  const byId = new Map(current.map((item) => [item.recordId, item]));
  for (const update of updates) {
    byId.set(update.recordId, { ...byId.get(update.recordId), ...update });
  }
  return Array.from(byId.values());
}

export function employeeTaskErrorMessage(error: unknown) {
  if (error instanceof EmployeeTaskError) return error.message;
  return unknownErrorMessage(error, "员工任务执行失败。");
}

export function isEmployeeTaskCancellation(error: unknown) {
  return error instanceof EmployeeTaskError && error.code === "cancelled";
}
