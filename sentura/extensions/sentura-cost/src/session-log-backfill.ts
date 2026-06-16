import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CostEvent } from "./types.js";

type BackfilledCostEvent = Omit<CostEvent, "tenantId" | "departmentId">;

interface SessionIndexEntry {
  sessionId: string;
  sessionKey: string;
  sessionFile?: string;
  provider?: string;
  model?: string;
  durationMs?: number;
}

interface CollectSessionLogCostEventsOptions {
  openClawDir: string;
  defaultDashboardUserToken?: string;
}

const CBE_AGENT_IDS = new Set([
  "cbe-lead-discovery",
  "cbe-buyer-screening",
  "cbe-accio-memory",
]);

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

function stableEventId(parts: Array<string | undefined>): string {
  const input = parts.filter(Boolean).join("|");
  const digest = crypto.createHash("sha256").update(input).digest("hex").slice(0, 24);
  return `sessionlog_${digest}`;
}

function sessionIdFromFile(filePath: string): string {
  return path.basename(filePath).replace(/\.jsonl$/, "");
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim()) return new Date(value).toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  return new Date().toISOString();
}

export function extractSenturaUserToken(sessionKey: string | undefined): string {
  if (!sessionKey) return "";
  const match = /^agent:[^:]+:user:([^:]+):/.exec(sessionKey);
  return match?.[1] ?? "";
}

export function resolveCostUserToken(options: {
  agentId: string;
  sessionKey?: string;
  defaultDashboardUserToken?: string;
}): string {
  const explicit = extractSenturaUserToken(options.sessionKey);
  if (explicit) return explicit;
  if (
    options.defaultDashboardUserToken &&
    options.sessionKey?.startsWith(`agent:${options.agentId}:dashboard:`) &&
    CBE_AGENT_IDS.has(options.agentId)
  ) {
    return options.defaultDashboardUserToken;
  }
  return "";
}

function parseEnvFile(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (key) out[key] = value;
  }
  return out;
}

async function readTokenFromDashboardEnv(workspaceDir: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(workspaceDir, "sentura/dashboard/.env.local"), "utf-8");
    const env = parseEnvFile(raw);
    return env.NEXT_PUBLIC_SENTURA_EMPLOYEE_TOKEN || env.NEXT_PUBLIC_SENTURA_ADMIN_TOKEN;
  } catch {
    return undefined;
  }
}

async function readTokenFromRbacUsers(openClawDir: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(openClawDir, "sentura-rbac/users.json"), "utf-8");
    const users = JSON.parse(raw) as unknown;
    if (!Array.isArray(users)) return undefined;
    const platformAdmin = users
      .map(asRecord)
      .find((user) => asString(user.role) === "platform_admin" && asString(user.userToken));
    return asString(platformAdmin?.userToken) ?? asString(asRecord(users[0]).userToken);
  } catch {
    return undefined;
  }
}

export async function resolveDefaultDashboardUserToken(
  openClawDir: string,
  workspaceDir = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  const envToken =
    env.NEXT_PUBLIC_SENTURA_EMPLOYEE_TOKEN?.trim() ||
    env.NEXT_PUBLIC_SENTURA_ADMIN_TOKEN?.trim() ||
    env.SENTURA_EMPLOYEE_TOKEN?.trim() ||
    env.SENTURA_ADMIN_TOKEN?.trim();
  if (envToken) return envToken;
  return (await readTokenFromDashboardEnv(workspaceDir)) ?? (await readTokenFromRbacUsers(openClawDir));
}

async function readSessionIndex(sessionsDir: string): Promise<Map<string, SessionIndexEntry>> {
  const index = new Map<string, SessionIndexEntry>();
  try {
    const raw = await fs.readFile(path.join(sessionsDir, "sessions.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray(parsed)
      ? parsed.map((entry) => [asString(asRecord(entry).key) ?? "", entry] as const)
      : Object.entries(asRecord(parsed));

    for (const [sessionKey, rawEntry] of entries) {
      const entry = asRecord(rawEntry);
      const sessionFile = asString(entry.sessionFile);
      const sessionId = asString(entry.sessionId) ?? (sessionFile ? sessionIdFromFile(sessionFile) : undefined);
      if (!sessionId) continue;
      index.set(sessionId, {
        sessionId,
        sessionKey: sessionKey || `agent:${path.basename(path.dirname(sessionsDir))}:session-log:${sessionId}`,
        sessionFile,
        provider: asString(entry.modelProvider),
        model: asString(entry.model),
        durationMs: asNumber(entry.runtimeMs),
      });
    }
  } catch {
    return index;
  }
  return index;
}

async function listSessionFiles(sessionsDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl") && !entry.name.endsWith(".trajectory.jsonl"))
      .map((entry) => path.join(sessionsDir, entry.name))
      .sort();
  } catch {
    return [];
  }
}

function usageFromRow(row: Record<string, unknown>, message: Record<string, unknown>) {
  const rowUsage = asRecord(row.usage);
  const messageUsage = asRecord(message.usage);
  const usage = Object.keys(rowUsage).length > 0 ? rowUsage : messageUsage;
  const cost = asRecord(usage.cost);
  const inputTokens = asNumber(usage.input) ?? asNumber(usage.promptTokens) ?? 0;
  const outputTokens = asNumber(usage.output) ?? 0;
  const cacheReadTokens = asNumber(usage.cacheRead);
  const cacheWriteTokens = asNumber(usage.cacheWrite);
  const totalTokens =
    asNumber(usage.totalTokens) ??
    asNumber(usage.total) ??
    inputTokens + outputTokens + (cacheReadTokens ?? 0) + (cacheWriteTokens ?? 0);
  const costUsd = asNumber(cost.total) ?? asNumber(row.costUsd) ?? null;

  if (totalTokens <= 0 && (costUsd === null || costUsd <= 0)) return null;

  return {
    usage: {
      inputTokens,
      outputTokens,
      ...(cacheReadTokens !== undefined ? { cacheReadTokens } : {}),
      ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
      totalTokens,
    },
    costUsd,
  };
}

function emptyExternalUsage() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function firstTextContent(message: Record<string, unknown>): string | undefined {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const textBlock = content.map(asRecord).find((block) => asString(block.type) === "text" && asString(block.text));
  return asString(textBlock?.text);
}

function parseToolResultJson(message: Record<string, unknown>): Record<string, unknown> {
  const text = firstTextContent(message);
  if (!text) return {};
  try {
    return asRecord(JSON.parse(text) as unknown);
  } catch {
    return {};
  }
}

interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

function extractToolCalls(message: Record<string, unknown>): ToolCallInfo[] {
  const content = message.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap((rawBlock) => {
    const block = asRecord(rawBlock);
    if (asString(block.type) !== "toolCall") return [];
    const id = asString(block.id);
    const name = asString(block.name);
    if (!id || !name) return [];
    return [{ id, name, arguments: asRecord(block.arguments) }];
  });
}

function asHttpStatus(value: unknown): number | undefined {
  const status = asNumber(value);
  return status && status > 0 ? status : undefined;
}

function eventBase(options: {
  row: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  session: SessionIndexEntry;
  defaultDashboardUserToken?: string;
  idSuffix: string;
}) {
  const message = asRecord(options.row.message);
  const timestamp = normalizeTimestamp(options.row.timestamp ?? message.timestamp);
  const sessionKey = options.session.sessionKey;
  return {
    id: stableEventId([
      options.agentId,
      options.sessionId,
      sessionKey,
      asString(message.toolCallId),
      asString(message.toolName),
      asString(options.row.id),
      timestamp,
      options.idSuffix,
    ]),
    timestamp,
    agentId: options.agentId,
    sessionKey,
    userToken: resolveCostUserToken({
      agentId: options.agentId,
      sessionKey,
      defaultDashboardUserToken: options.defaultDashboardUserToken,
    }),
    durationMs: 0,
    source: "external_tool_log" as const,
    messageId: asString(options.row.id),
  };
}

function externalEvent(options: {
  row: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  session: SessionIndexEntry;
  defaultDashboardUserToken?: string;
  idSuffix: string;
  provider: string;
  service: string;
  operation: string;
  costUsd: number | null;
  pricingStatus: NonNullable<CostEvent["pricingStatus"]>;
  pricingNote: string;
  unit: NonNullable<CostEvent["externalUsage"]>["unit"];
  quantity: number;
  label?: string;
  httpStatus?: number;
  toolName?: string;
  kind?: NonNullable<CostEvent["kind"]>;
}): BackfilledCostEvent {
  return {
    ...eventBase(options),
    provider: options.provider,
    model: options.operation,
    kind: options.kind ?? "external_api",
    service: options.service,
    operation: options.operation,
    pricingStatus: options.pricingStatus,
    pricingNote: options.pricingNote,
    externalUsage: {
      unit: options.unit,
      quantity: options.quantity,
      ...(options.label ? { label: options.label } : {}),
    },
    ...(options.httpStatus !== undefined ? { httpStatus: options.httpStatus } : {}),
    ...(options.toolName ? { toolName: options.toolName } : {}),
    usage: emptyExternalUsage(),
    costUsd: options.costUsd,
  };
}

function eventsFromPaidEmailValidation(options: {
  row: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  session: SessionIndexEntry;
  defaultDashboardUserToken?: string;
  toolName: string;
  result: Record<string, unknown>;
}): BackfilledCostEvent[] {
  const paidValidation = asRecord(options.result.paid_validation);
  const providers = Array.isArray(paidValidation.providers)
    ? paidValidation.providers.map(asRecord)
    : [];
  return providers.flatMap((providerResult, index) => {
    const provider = asString(providerResult.provider);
    const httpStatus = asHttpStatus(providerResult.http_status);
    if (provider === "abstract") {
      return [
        externalEvent({
          ...options,
          idSuffix: `abstract-${index}`,
          provider: "abstract",
          service: "Abstract Email Reputation",
          operation: "GET /v1 email reputation",
          costUsd: null,
          pricingStatus: "unpriced",
          pricingNote:
            "Abstract 按月请求额度/套餐计费；响应未返回单次美元成本，未配置账号级分摊价时不折算美元。",
          unit: "request",
          quantity: 1,
          label: "1 request",
          httpStatus,
          toolName: options.toolName,
        }),
      ];
    }
    if (provider === "hunter") {
      return [
        externalEvent({
          ...options,
          idSuffix: `hunter-${index}`,
          provider: "hunter",
          service: "Hunter Email Verifier",
          operation: "GET /v2/email-verifier",
          costUsd: null,
          pricingStatus: "unpriced",
          pricingNote:
            "Hunter Email Verifier 按验证积分计费；官方口径为 0.5 credit/verified email，但响应未返回本账号美元成本。",
          unit: "credit",
          quantity: 0.5,
          label: "最多 0.5 credit",
          httpStatus,
          toolName: options.toolName,
        }),
      ];
    }
    return [];
  });
}

function eventFromCrossBorderToolResult(options: {
  row: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  session: SessionIndexEntry;
  defaultDashboardUserToken?: string;
  toolName: string;
  toolCall?: ToolCallInfo;
  result: Record<string, unknown>;
}): BackfilledCostEvent[] {
  const localToolName = options.toolName.replace(/^cross-border-intel__/, "");
  const httpStatus = asHttpStatus(options.result.http_status);
  const endpoint = asString(options.result.endpoint);
  const sourceType = asString(options.result.source_type);

  if (localToolName === "cbe_intel_company_registry_search") {
    const registry = asString(options.result.registry);
    if (registry === "companies_house") {
      return [
        externalEvent({
          ...options,
          idSuffix: "companies-house-search",
          provider: "companies_house",
          service: "Companies House",
          operation: endpoint ?? "GET /search/companies",
          costUsd: 0,
          pricingStatus: "free",
          pricingNote: "Companies House 官方 API 对公开公司资料免费开放；调用计入次数，不计入美元成本。",
          unit: "request",
          quantity: 1,
          label: "1 request",
          httpStatus,
          toolName: options.toolName,
        }),
      ];
    }
    if (registry === "opencorporates") {
      return [
        externalEvent({
          ...options,
          idSuffix: "opencorporates-search",
          provider: "opencorporates",
          service: "OpenCorporates",
          operation: endpoint ?? "GET /companies/search",
          costUsd: null,
          pricingStatus: "unpriced",
          pricingNote: "OpenCorporates 按账号/套餐计费，当前响应未返回单次美元成本。",
          unit: "request",
          quantity: 1,
          label: "1 request",
          httpStatus,
          toolName: options.toolName,
        }),
      ];
    }
    return [
      externalEvent({
        ...options,
        idSuffix: "registry-public-fallback",
        provider: "public_web",
        service: "Public registry web fallback",
        operation: "public registry search suggestion",
        costUsd: 0,
        pricingStatus: "free",
        pricingNote: "未调用付费注册 API，仅生成/使用公开网页检索线索。",
        unit: "request",
        quantity: 0,
        label: "no paid API call",
        toolName: options.toolName,
      }),
    ];
  }

  if (localToolName === "cbe_intel_company_profile") {
    const registry = asString(options.result.registry);
    return [
      externalEvent({
        ...options,
        idSuffix: `company-profile-${registry ?? "registry"}`,
        provider: registry === "companies_house" ? "companies_house" : "public_registry",
        service: registry === "companies_house" ? "Companies House" : "Company registry",
        operation: endpoint ?? "GET /company/{companyNumber}",
        costUsd: registry === "companies_house" ? 0 : null,
        pricingStatus: registry === "companies_house" ? "free" : "unpriced",
        pricingNote:
          registry === "companies_house"
            ? "Companies House 官方 API 对公开公司资料免费开放；调用计入次数，不计入美元成本。"
            : "注册资料来源未返回单次美元成本。",
        unit: "request",
        quantity: 1,
        label: "1 request",
        httpStatus,
        toolName: options.toolName,
      }),
    ];
  }

  if (localToolName === "cbe_intel_domain_rdap_lookup") {
    return [
      externalEvent({
        ...options,
        idSuffix: "rdap",
        provider: "rdap",
        service: "RDAP.org / authoritative RDAP",
        operation: "GET /domain/{domain}",
        costUsd: 0,
        pricingStatus: "free",
        pricingNote: "RDAP 查询不使用平台付费 API key；当前按公开网络查询记 0 美元。",
        unit: "request",
        quantity: 1,
        label: "1 request",
        httpStatus,
        toolName: options.toolName,
      }),
    ];
  }

  if (localToolName === "cbe_intel_email_domain_check") {
    const dnsEvent = externalEvent({
      ...options,
      idSuffix: "dns",
      provider: "dns",
      service: "DNS MX/SPF/DMARC",
      operation: "DNS MX/TXT lookup",
      costUsd: 0,
      pricingStatus: "free",
      pricingNote: "DNS 查询由本地解析器执行，不调用付费 API。",
      unit: "request",
      quantity: 3,
      label: "MX/SPF/DMARC",
      toolName: options.toolName,
    });
    return [dnsEvent, ...eventsFromPaidEmailValidation(options)];
  }

  if (localToolName === "cbe_intel_official_contact_email_search") {
    const checkedUrls = Array.isArray(options.result.checked_urls) ? options.result.checked_urls : [];
    return [
      externalEvent({
        ...options,
        idSuffix: "official-contact-pages",
        provider: "public_web",
        service: "Official website contact search",
        operation: "GET official contact/about pages",
        costUsd: 0,
        pricingStatus: "free",
        pricingNote: "直接抓取目标公司公开网页，不调用付费搜索或邮箱验证 API。",
        unit: "page",
        quantity: checkedUrls.length || asNumber(options.toolCall?.arguments.max_pages) || 1,
        label: `${checkedUrls.length || asNumber(options.toolCall?.arguments.max_pages) || 1} pages`,
        toolName: options.toolName,
      }),
    ];
  }

  if (localToolName === "cbe_intel_sec_lookup") {
    const requestCount = asString(options.result.resolver_endpoint) ? 2 : 1;
    return [
      externalEvent({
        ...options,
        idSuffix: "sec-edgar",
        provider: "sec_edgar",
        service: "SEC EDGAR",
        operation: endpoint ?? "GET /submissions/CIK##########.json",
        costUsd: 0,
        pricingStatus: "free",
        pricingNote: "SEC data.sec.gov REST API 提供 JSON 公开数据；平台没有为该调用支付第三方 API 费用。",
        unit: "request",
        quantity: requestCount,
        label: `${requestCount} request${requestCount > 1 ? "s" : ""}`,
        httpStatus,
        toolName: options.toolName,
      }),
    ];
  }

  if (localToolName === "cbe_intel_trade_record_search") {
    const provider = asString(options.result.provider);
    if (provider === "importyeti") {
      const records = asRecord(options.result.records);
      const requestCost = asNumber(records.requestCost);
      const costIsZero = requestCost === 0;
      return [
        externalEvent({
          ...options,
          idSuffix: "importyeti",
          provider: "importyeti",
          service: "ImportYeti",
          operation: endpoint ?? "GET /v1.0/company/search",
          costUsd: costIsZero ? 0 : null,
          pricingStatus: costIsZero ? "included" : "unpriced",
          pricingNote: costIsZero
            ? "ImportYeti 响应返回 requestCost=0，本次未消耗可折算美元成本。"
            : "ImportYeti 响应返回 requestCost/credits，但未返回美元单价；未配置账号级分摊价时不折算美元。",
          unit: "credit",
          quantity: requestCost ?? 1,
          label: requestCost !== undefined ? `${requestCost} requestCost` : "1 request",
          httpStatus,
          toolName: options.toolName,
        }),
      ];
    }
    if (provider === "volza") {
      const estimatedCost = asNumber(options.result.estimated_cost_usd);
      return [
        externalEvent({
          ...options,
          idSuffix: "volza",
          provider: "volza",
          service: "Volza",
          operation: "GET /v1/trade/search",
          costUsd: estimatedCost ?? null,
          pricingStatus: estimatedCost !== undefined ? "estimated" : "unpriced",
          pricingNote:
            estimatedCost !== undefined
              ? "根据工具返回的 estimated_cost_usd 计入预算估算。"
              : "Volza 响应未返回单次美元成本。",
          unit: "request",
          quantity: 1,
          label: "1 request",
          httpStatus,
          toolName: options.toolName,
        }),
      ];
    }
    return [
      externalEvent({
        ...options,
        idSuffix: "trade-public-fallback",
        provider: "public_web",
        service: "Trade public web fallback",
        operation: "public trade evidence search suggestion",
        costUsd: 0,
        pricingStatus: "free",
        pricingNote: "付费贸易数据未启用或预算不足，仅使用公开网页线索，不计入美元成本。",
        unit: "request",
        quantity: 0,
        label: "no paid API call",
        toolName: options.toolName,
      }),
    ];
  }

  if (
    localToolName === "cbe_intel_score_buyer" ||
    localToolName === "cbe_intel_parse_accio_chat" ||
    localToolName === "cbe_intel_summarize_accio_chat"
  ) {
    return [
      externalEvent({
        ...options,
        idSuffix: localToolName,
        provider: "sentura_local",
        service: "Sentura local tool",
        operation: localToolName,
        costUsd: 0,
        pricingStatus: "free",
        pricingNote: "本地确定性工具/fixture 处理，不调用外部付费 API。",
        unit: "local_call",
        quantity: 1,
        label: "1 local call",
        toolName: options.toolName,
        kind: "local_tool",
      }),
    ];
  }

  return [
    externalEvent({
      ...options,
      idSuffix: `cross-border-${localToolName}`,
      provider: sourceType === "public_web" ? "public_web" : "cross_border_intel",
      service: "Cross-border intel",
      operation: localToolName,
      costUsd: null,
      pricingStatus: "unpriced",
      pricingNote: "工具结果未携带可折算美元成本。",
      unit: "request",
      quantity: 1,
      label: "1 request",
      httpStatus,
      toolName: options.toolName,
    }),
  ];
}

function eventFromToolResultRow(options: {
  row: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  session: SessionIndexEntry;
  defaultDashboardUserToken?: string;
  toolCalls: Map<string, ToolCallInfo>;
}): BackfilledCostEvent[] {
  const message = asRecord(options.row.message);
  if (asString(message.role) !== "toolResult") return [];
  const toolName = asString(message.toolName);
  if (!toolName) return [];
  const toolCallId = asString(message.toolCallId);
  const toolCall = toolCallId ? options.toolCalls.get(toolCallId) : undefined;
  const result = parseToolResultJson(message);

  if (toolName.startsWith("cross-border-intel__")) {
    return eventFromCrossBorderToolResult({
      ...options,
      toolName,
      toolCall,
      result,
    });
  }

  if (toolName === "web_search") {
    const depth = asString(toolCall?.arguments.search_depth) ?? asString(toolCall?.arguments.depth);
    const credits = depth === "advanced" ? 2 : 1;
    return [
      externalEvent({
        ...options,
        idSuffix: "web-search",
        provider: "tavily",
        service: "Tavily / web_search",
        operation: depth === "advanced" ? "advanced search" : "basic search",
        costUsd: credits * 0.008,
        pricingStatus: "estimated",
        pricingNote:
          "按 Tavily 官方 Pay-as-you-go $0.008/credit 估算；basic search=1 credit，advanced search=2 credits。",
        unit: "credit",
        quantity: credits,
        label: `${credits} credit${credits > 1 ? "s" : ""}`,
        toolName,
      }),
    ];
  }

  if (toolName === "web_fetch") {
    return [
      externalEvent({
        ...options,
        idSuffix: "web-fetch",
        provider: "public_web",
        service: "Public web fetch",
        operation: "web_fetch",
        costUsd: 0,
        pricingStatus: "free",
        pricingNote: "直接抓取公开网页；不消耗 Tavily 搜索 credit，也没有第三方 API key 费用。",
        unit: "request",
        quantity: 1,
        label: "1 fetch",
        toolName,
      }),
    ];
  }

  return [];
}

function eventFromMessageRow(options: {
  row: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  session: SessionIndexEntry;
  defaultDashboardUserToken?: string;
}): BackfilledCostEvent | null {
  const message = asRecord(options.row.message);
  if (asString(message.role) !== "assistant") return null;

  const usage = usageFromRow(options.row, message);
  if (!usage) return null;

  const timestamp = normalizeTimestamp(options.row.timestamp ?? message.timestamp);
  const sessionKey = options.session.sessionKey;
  return {
    id: stableEventId([
      options.agentId,
      options.sessionId,
      sessionKey,
      asString(options.row.responseId),
      asString(options.row.id),
      timestamp,
    ]),
    timestamp,
    agentId: options.agentId,
    sessionKey,
    userToken: resolveCostUserToken({
      agentId: options.agentId,
      sessionKey,
      defaultDashboardUserToken: options.defaultDashboardUserToken,
    }),
    provider: asString(options.row.provider) ?? asString(message.provider) ?? options.session.provider ?? "(unknown)",
    model: asString(options.row.model) ?? asString(message.model) ?? options.session.model ?? "(unknown)",
    kind: "model",
    service: asString(options.row.provider) ?? asString(message.provider) ?? options.session.provider ?? "(unknown)",
    pricingStatus: usage.costUsd === null ? "unpriced" : "priced",
    pricingNote:
      usage.costUsd === null
        ? "OpenClaw 会话日志有 token 用量，但没有美元成本。"
        : "OpenClaw 会话日志 usage.cost.total 回填的真实模型成本。",
    usage: usage.usage,
    costUsd: usage.costUsd,
    durationMs: options.session.durationMs ?? 0,
    source: "session_log",
    messageId: asString(options.row.id),
  };
}

async function collectFromSessionFile(options: {
  filePath: string;
  agentId: string;
  session: SessionIndexEntry;
  defaultDashboardUserToken?: string;
}): Promise<BackfilledCostEvent[]> {
  const out: BackfilledCostEvent[] = [];
  const sessionId = sessionIdFromFile(options.filePath);
  let raw = "";
  try {
    raw = await fs.readFile(options.filePath, "utf-8");
  } catch {
    return out;
  }

  const toolCalls = new Map<string, ToolCallInfo>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = asRecord(JSON.parse(line) as unknown);
      if (row.type !== "message") continue;
      const message = asRecord(row.message);
      for (const toolCall of extractToolCalls(message)) {
        toolCalls.set(toolCall.id, toolCall);
      }
      const event = eventFromMessageRow({
        row,
        agentId: options.agentId,
        sessionId,
        session: options.session,
        defaultDashboardUserToken: options.defaultDashboardUserToken,
      });
      if (event) out.push(event);
      out.push(
        ...eventFromToolResultRow({
          row,
          agentId: options.agentId,
          sessionId,
          session: options.session,
          defaultDashboardUserToken: options.defaultDashboardUserToken,
          toolCalls,
        }),
      );
    } catch {
      continue;
    }
  }

  return out;
}

export async function collectSessionLogCostEvents(
  options: CollectSessionLogCostEventsOptions,
): Promise<BackfilledCostEvent[]> {
  const agentsDir = path.join(options.openClawDir, "agents");
  const out: BackfilledCostEvent[] = [];
  let agentEntries: Array<{ name: string; isDirectory: () => boolean }> = [];
  try {
    agentEntries = await fs.readdir(agentsDir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const agentEntry of agentEntries) {
    if (!agentEntry.isDirectory()) continue;
    const agentId = agentEntry.name;
    const sessionsDir = path.join(agentsDir, agentId, "sessions");
    const index = await readSessionIndex(sessionsDir);
    const files = await listSessionFiles(sessionsDir);

    for (const filePath of files) {
      const sessionId = sessionIdFromFile(filePath);
      const session =
        index.get(sessionId) ??
        ({
          sessionId,
          sessionKey: `agent:${agentId}:session-log:${sessionId}`,
          sessionFile: filePath,
        } satisfies SessionIndexEntry);
      out.push(
        ...(await collectFromSessionFile({
          filePath,
          agentId,
          session,
          defaultDashboardUserToken: options.defaultDashboardUserToken,
        })),
      );
    }
  }

  return out.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
