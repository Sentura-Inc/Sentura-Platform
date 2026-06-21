import { resolveMx, resolveTxt } from "node:dns/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SourceType =
  | "official_api"
  | "official_registry_page"
  | "public_web"
  | "public_dns"
  | "paid_trade_data"
  | "demo_fixture"
  | "self_reported"
  | "unverified";

type EvidenceLayer =
  | "legal_registry"
  | "domain_email"
  | "public_footprint"
  | "trade_customs"
  | "financial_public_filing"
  | "behavior";

type ScoreBlockId =
  | "legal_identity"
  | "domain_email"
  | "public_footprint"
  | "business_fit"
  | "trade_financial"
  | "conversation_behavior";

type EvidenceStatus =
  | "scored"
  | "not_applicable"
  | "unavailable_api"
  | "disabled_by_budget"
  | "pending_human_input";

interface ScreeningRunRequest {
  mode?: unknown;
  targets?: unknown;
  manual_target?: unknown;
  enable_paid_email_validation?: unknown;
  enable_paid_trade_data?: unknown;
  max_paid_spend_usd?: unknown;
}

interface InvestigationTarget {
  target_id: string;
  source: "marketing_lead" | "manual_input";
  lead_id: string | null;
  source_run_id?: string;
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
  layer: EvidenceLayer;
  source_type: SourceType;
  source: string;
  url: string;
  finding: string;
  confidence: number;
  fetched_at: string;
  cost_usd: number;
  score_block: ScoreBlockId;
  score_impact: "positive" | "negative" | "neutral" | "coverage_only";
  affects_score: boolean;
  raw_status?: string;
}

interface ScoreBlock {
  block: ScoreBlockId;
  status: EvidenceStatus;
  max_points: number;
  earned_points: number | null;
  source_count: number;
  summary: string;
  reason?: string;
}

interface MissingEvidence {
  block: ScoreBlockId;
  status: Exclude<EvidenceStatus, "scored" | "not_applicable">;
  recommended_next_step: string;
}

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
}

interface ScoreResult {
  normalized_score: number | null;
  evidence_coverage: number;
  risk_tier: "trusted_candidate" | "cautious" | "insufficient_evidence" | "high_risk";
  raw_score: number;
  score_denominator: number;
  coverage_denominator: number;
  forced_downgrades: string[];
}

const OPENCLAW_ENV_PATH = path.join(os.homedir(), ".openclaw", ".env");
const ABSTRACT_EMAIL_REPUTATION_API_URL = "https://emailreputation.abstractapi.com/v1/";
const ABSTRACT_EMAIL_REPUTATION_DOC_URL = "https://docs.abstractapi.com/api/email-reputation";
const COMPANIES_HOUSE_PUBLIC_SEARCH_URL = "https://find-and-update.company-information.service.gov.uk/search/companies";
const IMPORTYETI_COMPANY_SEARCH_API_URL = "https://data.importyeti.com/v1.0/company/search";
const SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_DEFAULT_USER_AGENT = "SenturaCrossBorderIntel/0.1 contact=ops@example.invalid";
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "aol.com",
  "qq.com",
  "163.com",
]);
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "yopmail.com",
  "sharklasers.com",
]);
const ROLE_EMAIL_LOCAL_PARTS = new Set([
  "admin",
  "contact",
  "hello",
  "info",
  "office",
  "orders",
  "purchasing",
  "sales",
  "support",
]);
const MOBILE_ACCESSORY_TERMS = [
  "charger",
  "charging cable",
  "magsafe",
  "mobile accessories",
  "phone accessories",
  "phone case",
  "phone repair",
  "screen protector",
  "tempered glass",
  "usb-c",
];

let openClawEnvCache: Record<string, string> | undefined;

function parseEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadOpenClawEnv(): Record<string, string> {
  if (openClawEnvCache) return openClawEnvCache;
  const values: Record<string, string> = {};
  try {
    const text = fs.readFileSync(OPENCLAW_ENV_PATH, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      values[trimmed.slice(0, index).trim()] = parseEnvValue(trimmed.slice(index + 1));
    }
  } catch {
    // Dashboard can still run from process.env or .env.local.
  }
  openClawEnvCache = values;
  return values;
}

function envValue(name: string): string | undefined {
  return process.env[name]?.trim() || loadOpenClawEnv()[name]?.trim();
}

function envSource(name: string): "process" | "openclaw_env" | "missing" {
  if (process.env[name]?.trim()) return "process";
  if (loadOpenClawEnv()[name]?.trim()) return "openclaw_env";
  return "missing";
}

function configured(name: string): boolean {
  return Boolean(envValue(name));
}

function envFlag(name: string): boolean {
  const value = envValue(name)?.toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function budgetNumber(name: string): number {
  const value = Number(envValue(name));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function requestTimeoutMs(): number {
  const value = Number(envValue("CBE_INTEL_REQUEST_TIMEOUT_MS"));
  return Number.isFinite(value) && value > 0 ? Math.min(60_000, Math.max(3_000, Math.floor(value))) : 30_000;
}

function envStatus() {
  const maxPaidSpendUsd = budgetNumber("CBE_MAX_PAID_SPEND_USD");
  const paidTradeDataEnabled = envFlag("CBE_ENABLE_PAID_TRADE_DATA");

  return {
    tavily_search: {
      configured: configured("TAVILY_API_KEY"),
      source: envSource("TAVILY_API_KEY"),
      provider: "Tavily Search API",
    },
    companies_house: {
      configured: configured("COMPANIES_HOUSE_API_KEY"),
      source: envSource("COMPANIES_HOUSE_API_KEY"),
      provider: "Companies House API",
    },
    google_maps: {
      configured: configured("GOOGLE_MAPS_API_KEY"),
      source: envSource("GOOGLE_MAPS_API_KEY"),
      provider: "Google Maps Places/Geocoding/Address Validation via cross-border-intel MCP",
    },
    abstract_email_validation: {
      configured: configured("ABSTRACT_API_KEY"),
      source: envSource("ABSTRACT_API_KEY"),
      provider: "Abstract Email Reputation",
    },
    hunter_email_verifier: {
      configured: configured("HUNTER_API_KEY"),
      source: envSource("HUNTER_API_KEY"),
      provider: "Hunter Email Verifier",
    },
    importyeti_trade_data: {
      configured: configured("IMPORTYETI_API_KEY"),
      enabled: paidTradeDataEnabled && maxPaidSpendUsd > 0,
      source: envSource("IMPORTYETI_API_KEY"),
      provider: "ImportYeti Data API",
    },
    sec_edgar: {
      configured: true,
      no_api_key_required: true,
      user_agent_configured: configured("SEC_USER_AGENT"),
      source: envSource("SEC_USER_AGENT"),
      provider: "SEC EDGAR public data",
    },
    paid_trade_data: { enabled: paidTradeDataEnabled, max_paid_spend_usd: maxPaidSpendUsd },
    request_timeout_ms: requestTimeoutMs(),
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeDomain(input: string | undefined): string | undefined {
  if (!input) return undefined;
  try {
    const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return input.toLowerCase().replace(/^www\./, "").split("/")[0];
  }
}

function domainFromUrl(input: string | undefined): string | undefined {
  return normalizeDomain(input);
}

function normalizeCountry(country: string | undefined): string | undefined {
  if (!country) return undefined;
  const value = country.trim().toUpperCase();
  if (value === "UK") return "GB";
  return /^[A-Z]{2}$/.test(value) ? value : undefined;
}

function suppliedFields(record: Record<string, unknown>, fields: string[]): string[] {
  return fields.filter((field) => {
    const value = record[field];
    return Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
  });
}

function normalizeManualTarget(input: unknown, index: number): InvestigationTarget {
  const record = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const website = asString(record.website);
  const email = asString(record.email)?.toLowerCase();
  const domain = normalizeDomain(asString(record.domain) ?? website ?? email?.split("@")[1]);
  const sourceFields = [
    "company_name",
    "country",
    "website",
    "domain",
    "email",
    "contact_person",
    "contact_title",
    "social_or_profile_url",
    "product_interest",
    "operator_notes",
    "sec_cik",
  ];
  const supplied = suppliedFields(record, sourceFields);
  const inferred = domain && !supplied.includes("domain") ? ["domain"] : [];
  const missing = ["company_name", "country", "domain", "email"].filter((field) => !supplied.includes(field) && !inferred.includes(field));

  return {
    target_id: asString(record.target_id) ?? `manual-screen-${Date.now()}-${String(index + 1).padStart(3, "0")}`,
    source: "manual_input",
    lead_id: null,
    company_name: asString(record.company_name),
    country: normalizeCountry(asString(record.country)),
    website,
    domain,
    email,
    contact_person: asString(record.contact_person),
    contact_title: asString(record.contact_title),
    social_or_profile_url: asString(record.social_or_profile_url),
    product_interest: stringArray(record.product_interest),
    operator_notes: asString(record.operator_notes),
    sec_cik: asString(record.sec_cik),
    supplied_fields: supplied,
    inferred_fields: inferred,
    missing_fields: missing,
  };
}

function normalizeLeadTarget(input: unknown, index: number): InvestigationTarget {
  const record = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const website = asString(record.website);
  const contactCandidates = Array.isArray(record.contact_candidates) ? record.contact_candidates : [];
  const emailCandidate = contactCandidates
    .map((candidate) => (candidate && typeof candidate === "object" ? asString((candidate as Record<string, unknown>).value) : undefined))
    .find((value) => value?.includes("@"));
  const email = asString(record.email)?.toLowerCase() ?? emailCandidate?.toLowerCase();
  const domain = normalizeDomain(asString(record.domain) ?? website ?? email?.split("@")[1]);
  const matchedProducts = stringArray(record.matched_products);
  const supplied = suppliedFields(record, ["company_name", "country", "website", "domain", "email", "contact_person", "matched_products"]);
  const inferred = [
    ...(domain && !supplied.includes("domain") ? ["domain"] : []),
    ...(email && !supplied.includes("email") ? ["email"] : []),
  ];

  return {
    target_id: `screen-target-${asString(record.lead_id) ?? String(index + 1).padStart(3, "0")}`,
    source: "marketing_lead",
    lead_id: asString(record.lead_id) ?? null,
    source_run_id: asString(record.source_run_id),
    company_name: asString(record.company_name),
    country: normalizeCountry(asString(record.country)),
    website,
    domain,
    email,
    contact_person: asString(record.contact_person),
    product_interest: matchedProducts,
    supplied_fields: supplied,
    inferred_fields: inferred,
    missing_fields: ["company_name", "country", "domain", "email"].filter((field) => !supplied.includes(field) && !inferred.includes(field)),
  };
}

function targetsFromRequest(body: ScreeningRunRequest): InvestigationTarget[] {
  if (body.mode === "manual" || body.manual_target) {
    return [normalizeManualTarget(body.manual_target, 0)];
  }
  const targetRecords = Array.isArray(body.targets) ? body.targets : [];
  return targetRecords.map((target, index) => normalizeLeadTarget(target, index));
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function fetchJson(url: string, init: RequestInit, signal: AbortSignal) {
  const response = await fetch(url, { ...init, signal });
  return { response, body: await readJsonResponse(response) };
}

function confidenceFromScore(score: unknown): number {
  const parsed = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(parsed)) return 0.58;
  if (parsed > 1) return Math.min(0.95, Math.max(0.2, parsed / 100));
  return Math.min(0.95, Math.max(0.2, parsed));
}

function includesAny(text: string, terms: string[]): boolean {
  const lowered = text.toLowerCase();
  return terms.some((term) => lowered.includes(term));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "));
}

function normalizeCompanyNameForMatch(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|inc|incorporated|corp|corporation|co|company|ltd|limited|llc|plc|holdings?|group)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCompaniesHouseSearchResults(html: string, maxResults = 3) {
  const results: Array<{ company_number?: string; title: string; description?: string; url: string }> = [];
  const resultsStart = html.search(/<ul[^>]+id=['"]results['"][^>]*>/i);
  const sourceHtml = resultsStart >= 0 ? html.slice(resultsStart) : html;
  const itemPattern = /<li class="type-company">([\s\S]*?)<\/li>/g;
  for (const match of sourceHtml.matchAll(itemPattern)) {
    const item = match[1] ?? "";
    const linkMatch = item.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const href = decodeHtmlEntities(linkMatch[1] ?? "");
    const title = stripHtml(linkMatch[2] ?? "");
    const description = stripHtml(item.match(/<p class="[^"]*meta crumbtrail[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
    const companyNumber = href.match(/\/company\/([^/?#]+)/)?.[1];
    results.push({
      company_number: companyNumber,
      title,
      description,
      url: href.startsWith("http") ? href : `https://find-and-update.company-information.service.gov.uk${href}`,
    });
    if (results.length >= maxResults) break;
  }
  return results;
}

function secUserAgent(): string {
  return envValue("SEC_USER_AGENT") ?? SEC_DEFAULT_USER_AGENT;
}

function normalizeCik(cik: string | number): string {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

async function resolveSecCikByCompanyName(companyName: string, signal: AbortSignal) {
  const { response, body } = await fetchJson(SEC_COMPANY_TICKERS_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": secUserAgent(),
    },
  }, signal);
  if (!response.ok) {
    return { response, match: undefined as Record<string, unknown> | undefined, matchType: "api_error" };
  }

  const query = normalizeCompanyNameForMatch(companyName);
  const records = Object.values(asRecord(body)).filter((record): record is Record<string, unknown> => {
    return record !== null && typeof record === "object" && !Array.isArray(record);
  });
  const exact = records.find((record) => normalizeCompanyNameForMatch(asString(record.title)) === query);
  const ticker = records.find((record) => asString(record.ticker)?.toUpperCase() === companyName.trim().toUpperCase());
  const contains = records.find((record) => {
    const title = normalizeCompanyNameForMatch(asString(record.title));
    return query.length >= 4 && (title.includes(query) || query.includes(title));
  });
  const match = exact ?? ticker ?? contains;
  const matchType = exact ? "exact_name" : ticker ? "ticker" : contains ? "partial_name" : "no_match";
  return { response, match, matchType };
}

function buildEvidence(args: Omit<EvidenceItem, "fetched_at"> & { fetched_at?: string }, fallbackFetchedAt: string): EvidenceItem {
  return {
    ...args,
    fetched_at: args.fetched_at ?? fallbackFetchedAt,
  };
}

function companiesHouseAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function registryEvidence(target: InvestigationTarget, fetchedAt: string, signal: AbortSignal) {
  const evidence: EvidenceItem[] = [];
  const missing: MissingEvidence[] = [];
  let earnedPoints: number | null = null;
  let status: EvidenceStatus = "pending_human_input";
  let summary = "缺少公司名称或国家，无法完成注册主体核验。";
  let officialMatchFound = false;

  if (!target.company_name) {
    missing.push({
      block: "legal_identity",
      status: "pending_human_input",
      recommended_next_step: "补充公司英文法定名称或注册号。",
    });
    return { evidence, missing, block: scoreBlock("legal_identity", status, 25, earnedPoints, evidence, summary), officialMatchFound };
  }

  if (target.country === "US") {
    try {
      const lookup = await resolveSecCikByCompanyName(target.company_name, signal);
      const matchedTitle = asString(lookup.match?.title);
      const matchedTicker = asString(lookup.match?.ticker);
      const matchedCik = asNumber(lookup.match?.cik_str);
      const cik = matchedCik === undefined ? undefined : normalizeCik(matchedCik);
      officialMatchFound = Boolean(cik);
      status = lookup.response.ok ? (cik ? "scored" : "pending_human_input") : "unavailable_api";
      earnedPoints = cik ? (lookup.matchType === "exact_name" || lookup.matchType === "ticker" ? 20 : 14) : null;
      summary = lookup.response.ok
        ? cik
          ? `SEC EDGAR ticker/CIK 映射匹配到 ${matchedTitle ?? target.company_name}${matchedTicker ? ` (${matchedTicker})` : ""}，CIK=${cik}。`
          : "SEC EDGAR ticker/CIK 映射可访问，但未按公司名匹配到公开申报主体。"
        : `SEC EDGAR ticker/CIK 映射返回 HTTP ${lookup.response.status}。`;
      evidence.push(buildEvidence({
        layer: "legal_registry",
        source_type: "official_api",
        source: "SEC EDGAR company tickers",
        url: SEC_COMPANY_TICKERS_URL,
        finding: summary,
        confidence: cik ? (lookup.matchType === "exact_name" || lookup.matchType === "ticker" ? 0.82 : 0.62) : lookup.response.ok ? 0.3 : 0.2,
        cost_usd: 0,
        score_block: "legal_identity",
        score_impact: cik ? "positive" : "coverage_only",
        affects_score: Boolean(cik),
        raw_status: String(lookup.response.status),
      }, fetchedAt));
      if (!cik) {
        missing.push({
          block: "legal_identity",
          status: lookup.response.ok ? "pending_human_input" : "unavailable_api",
          recommended_next_step: lookup.response.ok
            ? "SEC 未按公司名匹配到 CIK；如果目标是上市公司或 SEC filer，请补充 ticker/CIK。"
            : `SEC ticker/CIK 映射返回 HTTP ${lookup.response.status}，稍后重试。`,
        });
      }
    } catch (error) {
      status = "unavailable_api";
      summary = `SEC EDGAR ticker/CIK 映射调用失败：${error instanceof Error ? error.message : String(error)}`;
      missing.push({ block: "legal_identity", status, recommended_next_step: "稍后重试 SEC CIK lookup，或补充 ticker/CIK。" });
    }
  } else if (target.country === "GB") {
    if (configured("COMPANIES_HOUSE_API_KEY")) {
      const url = new URL("https://api.company-information.service.gov.uk/search/companies");
      url.searchParams.set("q", target.company_name);
      url.searchParams.set("items_per_page", "5");
      try {
        const { response, body } = await fetchJson(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: companiesHouseAuthHeader(envValue("COMPANIES_HOUSE_API_KEY") ?? ""),
          },
        }, signal);
        const record = body && typeof body === "object" ? (body as { items?: unknown }) : {};
        const items = Array.isArray(record.items) ? record.items : [];
        const first = items[0] && typeof items[0] === "object" ? (items[0] as Record<string, unknown>) : undefined;
        const companyStatus = asString(first?.company_status);
        if (!response.ok) {
          status = "unavailable_api";
          summary = `Companies House API 返回 HTTP ${response.status}，改用官方公开网页兜底。`;
          evidence.push(buildEvidence({
            layer: "legal_registry",
            source_type: "official_api",
            source: "Companies House API",
            url: url.toString(),
            finding: summary,
            confidence: 0.2,
            cost_usd: 0,
            score_block: "legal_identity",
            score_impact: "coverage_only",
            affects_score: false,
            raw_status: String(response.status),
          }, fetchedAt));
          missing.push({
            block: "legal_identity",
            status,
            recommended_next_step: response.status === 401 || response.status === 403
              ? "检查 Companies House REST API key 是否正确、是否已轮换，并重启运行中的 gateway/dashboard 进程；本次已改用官方公开网页兜底。"
              : "稍后重试 Companies House API，或补充官方注册页 URL/注册号。",
          });
        } else {
          officialMatchFound = items.length > 0;
          status = "scored";
          earnedPoints = officialMatchFound ? (companyStatus === "active" ? 23 : 15) : 8;
          summary = officialMatchFound
            ? `Companies House API 返回 ${items.length} 条候选，首条状态为 ${companyStatus ?? "未确认"}。`
            : `Companies House API 查询完成，但未找到稳定匹配。`;
          evidence.push(buildEvidence({
            layer: "legal_registry",
            source_type: "official_api",
            source: "Companies House API",
            url: url.toString(),
            finding: summary,
            confidence: officialMatchFound ? 0.92 : 0.35,
            cost_usd: 0,
            score_block: "legal_identity",
            score_impact: officialMatchFound ? "positive" : "neutral",
            affects_score: true,
            raw_status: String(response.status),
          }, fetchedAt));
          return { evidence, missing, block: scoreBlock("legal_identity", status, 25, earnedPoints, evidence, summary), officialMatchFound };
        }
      } catch (error) {
        status = "unavailable_api";
        summary = `Companies House API 调用失败：${error instanceof Error ? error.message : String(error)}；改用官方公开网页兜底。`;
        missing.push({ block: "legal_identity", status, recommended_next_step: "稍后重试 Companies House API 或补充官方注册页 URL。" });
      }
    } else {
      missing.push({
        block: "legal_identity",
        status: "unavailable_api",
        recommended_next_step: "Companies House REST API 需要 API key；本次改用官方公开网页兜底。",
      });
    }

    const publicUrl = new URL(COMPANIES_HOUSE_PUBLIC_SEARCH_URL);
    publicUrl.searchParams.set("q", target.company_name);
    try {
      const { response, body } = await fetchJson(publicUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "text/html",
          "User-Agent": secUserAgent(),
        },
      }, signal);
      const html = typeof body === "string" ? body : "";
      const results = response.ok ? parseCompaniesHouseSearchResults(html, 3) : [];
      const first = results[0];
      const exact = normalizeCompanyNameForMatch(first?.title) === normalizeCompanyNameForMatch(target.company_name);
      officialMatchFound = results.length > 0;
      status = response.ok ? "scored" : "unavailable_api";
      earnedPoints = response.ok ? (results.length > 0 ? (exact ? 18 : 12) : 6) : null;
      summary = response.ok
        ? results.length > 0
          ? `Companies House 官方公开网页返回 ${results.length} 条候选，首条为 ${first?.title}${first?.company_number ? ` (${first.company_number})` : ""}。`
          : "Companies House 官方公开网页可访问，但未找到候选公司。"
        : `Companies House 官方公开网页返回 HTTP ${response.status}。`;
      evidence.push(buildEvidence({
        layer: "legal_registry",
        source_type: "official_registry_page",
        source: "Companies House public search",
        url: publicUrl.toString(),
        finding: summary,
        confidence: response.ok ? (results.length > 0 ? (exact ? 0.82 : 0.62) : 0.3) : 0.2,
        cost_usd: 0,
        score_block: "legal_identity",
        score_impact: response.ok && results.length > 0 ? "positive" : "neutral",
        affects_score: response.ok,
        raw_status: String(response.status),
      }, fetchedAt));
      if (!response.ok || results.length === 0 || !exact) {
        missing.push({
          block: "legal_identity",
          status: response.ok ? "pending_human_input" : "unavailable_api",
          recommended_next_step: results.length > 0
            ? "人工确认 Companies House 首条候选是否为目标客户，必要时补充 company number。"
            : "人工补充 UK company number、官方注册页 URL 或更精确法定名称。",
        });
      }
    } catch (error) {
      status = "unavailable_api";
      summary = `Companies House 官方公开网页调用失败：${error instanceof Error ? error.message : String(error)}`;
      missing.push({ block: "legal_identity", status, recommended_next_step: "稍后重试 Companies House 官方公开网页或补充 company number。" });
    }
  } else {
    const reason = "该国家 Phase-1 无低成本注册 API，使用公开网页检索补充。";
    status = "unavailable_api";
    summary = reason;
    missing.push({ block: "legal_identity", status, recommended_next_step: "通过公开官方注册页或注册号补强法律主体证据。" });
  }

  return { evidence, missing, block: scoreBlock("legal_identity", status, 25, earnedPoints, evidence, summary), officialMatchFound };
}

async function rdapLookup(domain: string, fetchedAt: string, signal: AbortSignal) {
  const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  try {
    const { response, body } = await fetchJson(url, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/rdap+json, application/json" },
    }, signal);
    return { response, body, evidenceUrl: response.headers.get("location") ?? url, fetchedAt };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), evidenceUrl: url, fetchedAt };
  }
}

function findRegistrationAgeDays(body: unknown): number | undefined {
  const record = body && typeof body === "object" ? (body as { events?: unknown }) : {};
  if (!Array.isArray(record.events)) return undefined;
  for (const event of record.events) {
    if (!event || typeof event !== "object") continue;
    const e = event as Record<string, unknown>;
    const action = asString(e.eventAction)?.toLowerCase();
    const date = asString(e.eventDate);
    if (!action || !date) continue;
    if (action.includes("registration") || action.includes("domain registration")) {
      const registered = Date.parse(date);
      if (Number.isFinite(registered)) {
        return Math.floor((Date.now() - registered) / 86_400_000);
      }
    }
  }
  return undefined;
}

async function domainEmailEvidence(
  target: InvestigationTarget,
  fetchedAt: string,
  signal: AbortSignal,
  enablePaidEmailValidation: boolean,
) {
  const evidence: EvidenceItem[] = [];
  const missing: MissingEvidence[] = [];
  const domain = target.domain ?? domainFromUrl(target.website) ?? domainFromUrl(target.email?.split("@")[1]);
  const email = target.email;
  if (!domain && !email) {
    const summary = "缺少域名、网站或邮箱，无法完成域名/邮箱可信度核验。";
    missing.push({ block: "domain_email", status: "pending_human_input", recommended_next_step: "补充官网域名或买家公司邮箱。" });
    return {
      evidence,
      missing,
      block: scoreBlock("domain_email", "pending_human_input", 25, null, evidence, summary),
      disposableOrFreeOnly: false,
      youngDomain: false,
      businessDomainVerified: false,
    };
  }

  const normalizedDomain = normalizeDomain(domain ?? email?.split("@")[1]) ?? "";
  const localPart = email?.split("@")[0]?.toLowerCase();
  const freeProvider = FREE_EMAIL_DOMAINS.has(normalizedDomain);
  const disposable = DISPOSABLE_EMAIL_DOMAINS.has(normalizedDomain);
  const roleEmail = localPart ? ROLE_EMAIL_LOCAL_PARTS.has(localPart) : false;
  const [mx, spf, dmarc, rdap] = await Promise.all([
    resolveMx(normalizedDomain).then((records) => ({ ok: true as const, records })).catch((error: Error) => ({ ok: false as const, error: error.message })),
    resolveTxt(normalizedDomain).then((records) => ({ ok: true as const, records })).catch((error: Error) => ({ ok: false as const, error: error.message })),
    resolveTxt(`_dmarc.${normalizedDomain}`).then((records) => ({ ok: true as const, records })).catch((error: Error) => ({ ok: false as const, error: error.message })),
    rdapLookup(normalizedDomain, fetchedAt, signal),
  ]);

  const mxPresent = mx.ok && mx.records.length > 0;
  const spfPresent = spf.ok && spf.records.flat().join("").toLowerCase().includes("v=spf1");
  const dmarcPresent = dmarc.ok && dmarc.records.flat().join("").toLowerCase().includes("v=dmarc1");
  const rdapResponse = "response" in rdap ? rdap.response : undefined;
  const rdapFound = Boolean(rdapResponse?.ok);
  const domainAgeDays = "body" in rdap ? findRegistrationAgeDays(rdap.body) : undefined;
  const youngDomain = typeof domainAgeDays === "number" && domainAgeDays < 90;
  let earnedPoints = 8;
  if (mxPresent) earnedPoints += 6;
  if (spfPresent) earnedPoints += 3;
  if (dmarcPresent) earnedPoints += 3;
  if (rdapFound) earnedPoints += 4;
  if (!freeProvider && !disposable) earnedPoints += 3;
  if (freeProvider) earnedPoints -= 4;
  if (disposable) earnedPoints -= 10;
  if (youngDomain) earnedPoints -= 4;
  earnedPoints = Math.max(0, Math.min(25, earnedPoints));

  const summary = `域名 ${normalizedDomain}：MX ${mxPresent ? "存在" : "缺失"}，SPF ${spfPresent ? "存在" : "未确认"}，DMARC ${dmarcPresent ? "存在" : "未确认"}，RDAP ${rdapFound ? "可查询" : "未确认"}。`;
  evidence.push(buildEvidence({
    layer: "domain_email",
    source_type: "public_dns",
    source: "DNS MX/TXT + RDAP.org",
    url: `https://${normalizedDomain}`,
    finding: `${summary}${freeProvider ? " 邮箱为免费邮箱。" : ""}${disposable ? " 邮箱域名为一次性邮箱。" : ""}${roleEmail ? " 邮箱为角色邮箱。" : ""}`,
    confidence: mxPresent && !freeProvider && !disposable ? 0.82 : disposable ? 0.18 : 0.55,
    cost_usd: 0,
    score_block: "domain_email",
    score_impact: disposable || !mxPresent ? "negative" : "positive",
    affects_score: true,
    raw_status: rdapFound ? "rdap_found" : "rdap_unconfirmed",
  }, fetchedAt));

  if (enablePaidEmailValidation && email) {
    const paidResults = await paidEmailEvidence(email, fetchedAt, signal);
    evidence.push(...paidResults.evidence);
    missing.push(...paidResults.missing);
    if (paidResults.positive) earnedPoints = Math.min(25, earnedPoints + 3);
    if (paidResults.negative) earnedPoints = Math.max(0, earnedPoints - 6);
  } else if (email && (configured("ABSTRACT_API_KEY") || configured("HUNTER_API_KEY"))) {
    missing.push({
      block: "domain_email",
      status: "disabled_by_budget",
      recommended_next_step: "如需验证邮箱可达性，打开 Abstract/Hunter 邮箱验证开关。",
    });
  }

  return {
    evidence,
    missing,
    block: scoreBlock("domain_email", "scored", 25, earnedPoints, evidence, summary),
    disposableOrFreeOnly: (freeProvider || disposable) && !target.website && !target.domain,
    youngDomain,
    businessDomainVerified: mxPresent && !freeProvider && !disposable,
  };
}

async function paidEmailEvidence(email: string, fetchedAt: string, signal: AbortSignal) {
  const evidence: EvidenceItem[] = [];
  const missing: MissingEvidence[] = [];
  let positive = false;
  let negative = false;

  if (configured("ABSTRACT_API_KEY")) {
    const url = new URL(ABSTRACT_EMAIL_REPUTATION_API_URL);
    url.searchParams.set("api_key", envValue("ABSTRACT_API_KEY") ?? "");
    url.searchParams.set("email", email);
    try {
      const { response, body } = await fetchJson(url.toString(), { method: "GET", headers: { Accept: "application/json" } }, signal);
      const record = asRecord(body);
      const deliverabilityRecord = asRecord(record.email_deliverability);
      const qualityRecord = asRecord(record.email_quality);
      const riskRecord = asRecord(record.email_risk);
      const deliverability = (
        asString(deliverabilityRecord.status) ??
        asString(record.deliverability) ??
        "unknown"
      ).toLowerCase();
      const quality = asNumber(qualityRecord.score) ?? asNumber(record.quality_score);
      const addressRisk = asString(riskRecord.address_risk_status)?.toLowerCase();
      const domainRisk = asString(riskRecord.domain_risk_status)?.toLowerCase();
      if (response.ok) {
        positive = positive || deliverability === "deliverable";
        negative = negative ||
          deliverability === "undeliverable" ||
          addressRisk === "high" ||
          domainRisk === "high" ||
          qualityRecord.is_disposable === true;
      }
      evidence.push(buildEvidence({
        layer: "domain_email",
        source_type: "official_api",
        source: "Abstract Email Reputation",
        url: ABSTRACT_EMAIL_REPUTATION_DOC_URL,
        finding: response.ok
          ? `Abstract Email Reputation 返回 deliverability=${deliverability}${typeof quality === "number" ? `, quality_score=${quality}` : ""}${addressRisk ? `, address_risk=${addressRisk}` : ""}${domainRisk ? `, domain_risk=${domainRisk}` : ""}。`
          : `Abstract Email Reputation 返回 HTTP ${response.status}，未计入邮箱评分。`,
        confidence: response.ok ? Math.max(0.25, Math.min(0.95, quality ?? 0.72)) : 0.25,
        cost_usd: 0,
        score_block: "domain_email",
        score_impact: response.ok ? (negative ? "negative" : positive ? "positive" : "neutral") : "coverage_only",
        affects_score: response.ok,
        raw_status: String(response.status),
      }, fetchedAt));
      if (!response.ok) {
        missing.push({
          block: "domain_email",
          status: "unavailable_api",
          recommended_next_step: response.status === 401 || response.status === 403
            ? "检查 ABSTRACT_API_KEY 是否来自 Abstract Email Reputation 产品，并重启运行中的 gateway/dashboard 进程。"
            : `Abstract Email Reputation 返回 HTTP ${response.status}，稍后重试。`,
        });
      }
    } catch (error) {
      missing.push({ block: "domain_email", status: "unavailable_api", recommended_next_step: `Abstract 调用失败：${error instanceof Error ? error.message : String(error)}` });
    }
  } else {
    missing.push({ block: "domain_email", status: "unavailable_api", recommended_next_step: "配置 ABSTRACT_API_KEY 可增加 Email Reputation 证据。" });
  }

  if (configured("HUNTER_API_KEY")) {
    const url = new URL("https://api.hunter.io/v2/email-verifier");
    url.searchParams.set("email", email);
    url.searchParams.set("api_key", envValue("HUNTER_API_KEY") ?? "");
    try {
      const { response, body } = await fetchJson(url.toString(), { method: "GET", headers: { Accept: "application/json" } }, signal);
      const data = body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : body;
      const record = asRecord(data);
      const status = (asString(record.status) ?? asString(record.result) ?? "unknown").toLowerCase();
      const score = asNumber(record.score);
      if (response.ok) {
        positive = positive || status === "valid" || status === "deliverable";
        negative = negative || status === "invalid" || status === "disposable" || status === "undeliverable";
      }
      evidence.push(buildEvidence({
        layer: "domain_email",
        source_type: "official_api",
        source: "Hunter Email Verifier",
        url: "https://hunter.io/api-documentation/v2#email-verifier",
        finding: response.ok
          ? `Hunter 返回 status=${status}${typeof score === "number" ? `, score=${score}` : ""}。`
          : `Hunter 返回 HTTP ${response.status}，未计入邮箱评分。`,
        confidence: response.ok ? Math.max(0.25, Math.min(0.95, typeof score === "number" ? score / 100 : 0.72)) : 0.25,
        cost_usd: 0,
        score_block: "domain_email",
        score_impact: response.ok ? (negative ? "negative" : positive ? "positive" : "neutral") : "coverage_only",
        affects_score: response.ok,
        raw_status: String(response.status),
      }, fetchedAt));
      if (!response.ok) {
        missing.push({
          block: "domain_email",
          status: "unavailable_api",
          recommended_next_step: response.status === 401 || response.status === 403 || response.status === 429
            ? "检查 Hunter API key/账户状态/额度，并重启运行中的 gateway/dashboard 进程。"
            : `Hunter 返回 HTTP ${response.status}，稍后重试。`,
        });
      }
    } catch (error) {
      missing.push({ block: "domain_email", status: "unavailable_api", recommended_next_step: `Hunter 调用失败：${error instanceof Error ? error.message : String(error)}` });
    }
  } else {
    missing.push({ block: "domain_email", status: "unavailable_api", recommended_next_step: "配置 HUNTER_API_KEY 可增加邮箱 verifier/enrichment 证据。" });
  }

  return { evidence, missing, positive, negative };
}

async function tavilySearch(query: string, signal: AbortSignal): Promise<TavilyResult[]> {
  const apiKey = envValue("TAVILY_API_KEY");
  if (!apiKey) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
    signal,
  });
  const body = await readJsonResponse(response);
  if (!response.ok) throw new Error(`Tavily search failed (${response.status})`);
  const record = body && typeof body === "object" ? (body as { results?: unknown }) : {};
  return Array.isArray(record.results) ? (record.results as TavilyResult[]) : [];
}

async function publicFootprintEvidence(target: InvestigationTarget, fetchedAt: string, signal: AbortSignal) {
  const evidence: EvidenceItem[] = [];
  const missing: MissingEvidence[] = [];
  const company = target.company_name ?? target.domain ?? target.email ?? "unknown buyer";
  const productTerms = target.product_interest.join(" ") || "mobile phone accessories";
  if (!configured("TAVILY_API_KEY")) {
    missing.push({ block: "public_footprint", status: "unavailable_api", recommended_next_step: "配置 TAVILY_API_KEY 以进行公开网页背调。" });
    return {
      evidence,
      missing,
      publicBlock: scoreBlock("public_footprint", "unavailable_api", 20, null, evidence, "Tavily 未配置，公开足迹未检查。"),
      fitBlock: scoreBlock("business_fit", target.product_interest.length > 0 ? "scored" : "pending_human_input", 20, target.product_interest.length > 0 ? 10 : null, evidence, target.product_interest.length > 0 ? "使用操作员或 Marketing 提供的产品兴趣作为初始业务匹配证据。" : "缺少产品兴趣或公开业务内容。"),
      adverseFlags: [] as string[],
    };
  }

  const queries = [
    `${company} ${target.country ?? ""} ${productTerms} official website contact`,
    `${company} fraud scam complaint customs ${target.country ?? ""}`,
  ].map((query) => query.trim());
  const adverseFlags: string[] = [];
  let productSignal = target.product_interest.length > 0;

  for (const query of queries) {
    try {
      const results = await tavilySearch(query, signal);
      for (const result of results.slice(0, 3)) {
        const title = asString(result.title) ?? "";
        const url = asString(result.url) ?? "https://www.tavily.com/";
        const content = asString(result.content) ?? "";
        const text = `${title}\n${content}`;
        const targetDomain = target.domain ? normalizeDomain(target.domain) : undefined;
        const resultDomain = normalizeDomain(url);
	        const normalizedTargetName = normalizeCompanyNameForMatch(company);
	        const normalizedResultText = normalizeCompanyNameForMatch(text);
	        const targetSpecific =
	          Boolean(targetDomain && resultDomain && (resultDomain === targetDomain || resultDomain.endsWith(`.${targetDomain}`))) ||
	          (normalizedTargetName.length >= 4 && normalizedResultText.includes(normalizedTargetName));
        const hasProductSignal = targetSpecific && includesAny(text, MOBILE_ACCESSORY_TERMS);
        if (hasProductSignal) productSignal = true;
        const adverseTerm = /\b(fraud|scam|lawsuit|fake|complaint|blacklist)\b/i.test(text);
        const adverse = targetSpecific && adverseTerm;
        if (adverse) adverseFlags.push(`public_adverse_result:${url}`);
        evidence.push(buildEvidence({
          layer: "public_footprint",
          source_type: "public_web",
          source: "Tavily Search",
          url,
          finding: `${title || url}: ${content.slice(0, 240)}`,
          confidence: targetSpecific ? confidenceFromScore(result.score) : Math.min(0.2, confidenceFromScore(result.score)),
          cost_usd: 0,
          score_block: adverse ? "public_footprint" : hasProductSignal ? "business_fit" : "public_footprint",
          score_impact: adverse ? "negative" : targetSpecific ? "positive" : "coverage_only",
          affects_score: targetSpecific,
          raw_status: query,
        }, fetchedAt));
      }
    } catch (error) {
      missing.push({ block: "public_footprint", status: "unavailable_api", recommended_next_step: `Tavily 查询失败：${error instanceof Error ? error.message : String(error)}` });
    }
  }

  const targetSpecificEvidence = evidence.filter((item) => item.affects_score);
  const publicEarned = Math.min(20, Math.max(6, targetSpecificEvidence.length * 3 + (adverseFlags.length === 0 ? 8 : 0)));
  const fitEarned = productSignal ? Math.min(20, 12 + Math.min(8, target.product_interest.length * 2 + evidence.filter((item) => item.score_block === "business_fit" && item.affects_score).length * 2)) : null;
  return {
    evidence,
    missing,
    publicBlock: scoreBlock("public_footprint", evidence.length > 0 ? "scored" : "unavailable_api", 20, evidence.length > 0 ? publicEarned : null, evidence, evidence.length > 0 ? "公开网页/搜索足迹已检查。" : "未获得公开网页证据。"),
    fitBlock: scoreBlock("business_fit", productSignal ? "scored" : "pending_human_input", 20, fitEarned, evidence, productSignal ? "产品兴趣或公开内容与手机配件业务相关。" : "缺少产品兴趣或公开业务内容。"),
    adverseFlags,
  };
}

async function tradeFinancialEvidence(
  target: InvestigationTarget,
  fetchedAt: string,
  signal: AbortSignal,
  enablePaidTradeData: boolean,
  targetBudgetUsd: number,
) {
  const evidence: EvidenceItem[] = [];
  const missing: MissingEvidence[] = [];
  let earnedPoints: number | null = null;
  let status: EvidenceStatus = "disabled_by_budget";
  let summary = "贸易/财务证据未启用，作为覆盖缺口展示。";

  const envBudget = budgetNumber("CBE_MAX_PAID_SPEND_USD");
  const budget = Math.min(envBudget, targetBudgetUsd);
  const canUseImportYeti =
    enablePaidTradeData &&
    envFlag("CBE_ENABLE_PAID_TRADE_DATA") &&
    configured("IMPORTYETI_API_KEY") &&
    budget > 0;

  if (canUseImportYeti && target.company_name) {
    const url = new URL(IMPORTYETI_COMPANY_SEARCH_API_URL);
    url.searchParams.set("name", target.company_name);
    url.searchParams.set("page_size", "5");
    try {
      const { response, body } = await fetchJson(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          IYApiKey: envValue("IMPORTYETI_API_KEY") ?? "",
        },
      }, signal);
      const bodyText = JSON.stringify(body).toLowerCase();
      const hasProductSignal = target.product_interest.some((product) => bodyText.includes(product.toLowerCase()));
      status = response.ok ? "scored" : "unavailable_api";
      earnedPoints = response.ok ? (hasProductSignal ? 9 : 7) : null;
      summary = response.ok ? "ImportYeti 返回公司/进口记录搜索结果。" : `ImportYeti 返回 HTTP ${response.status}，未计入贸易/财务评分。`;
      evidence.push(buildEvidence({
        layer: "trade_customs",
        source_type: "paid_trade_data",
        source: "ImportYeti Data API",
        url: IMPORTYETI_COMPANY_SEARCH_API_URL,
        finding: summary,
        confidence: response.ok ? 0.72 : 0.25,
        cost_usd: response.ok ? 1 : 0,
        score_block: "trade_financial",
        score_impact: response.ok ? "positive" : "coverage_only",
        affects_score: response.ok,
        raw_status: String(response.status),
      }, fetchedAt));
      if (!response.ok) {
        missing.push({
          block: "trade_financial",
          status: "unavailable_api",
          recommended_next_step: response.status === 401 || response.status === 403
            ? "检查 ImportYeti API key 权限，并确认调用使用 IYApiKey header。"
            : `ImportYeti 返回 HTTP ${response.status}，稍后重试。`,
        });
      }
    } catch (error) {
      status = "unavailable_api";
      summary = `ImportYeti 调用失败：${error instanceof Error ? error.message : String(error)}`;
      missing.push({ block: "trade_financial", status, recommended_next_step: "稍后重试 ImportYeti，或降低单次批量数量。" });
    }
  } else {
    missing.push({
      block: "trade_financial",
      status: enablePaidTradeData ? "disabled_by_budget" : "disabled_by_budget",
      recommended_next_step: configured("IMPORTYETI_API_KEY")
        ? "打开付费贸易数据开关并设置足够预算后可查询 ImportYeti。"
        : "配置 IMPORTYETI_API_KEY 后可查询 US import 记录。",
    });
  }

  if (target.country === "US" || target.sec_cik) {
    let cik = target.sec_cik ? normalizeCik(target.sec_cik) : undefined;
    if (!cik && target.company_name) {
      try {
        const lookup = await resolveSecCikByCompanyName(target.company_name, signal);
        const matchedTitle = asString(lookup.match?.title);
        const matchedTicker = asString(lookup.match?.ticker);
        const matchedCik = asNumber(lookup.match?.cik_str);
        if (matchedCik !== undefined) {
          cik = normalizeCik(matchedCik);
        }
        evidence.push(buildEvidence({
          layer: "financial_public_filing",
          source_type: "official_api",
          source: "SEC EDGAR company tickers",
          url: SEC_COMPANY_TICKERS_URL,
          finding: lookup.response.ok
            ? cik
              ? `SEC ticker/CIK 映射按公司名匹配到 ${matchedTitle ?? target.company_name}${matchedTicker ? ` (${matchedTicker})` : ""}，CIK=${cik}。`
              : "SEC ticker/CIK 映射可访问，但未按公司名匹配到公开申报主体。"
            : `SEC ticker/CIK 映射返回 HTTP ${lookup.response.status}。`,
          confidence: cik ? (lookup.matchType === "exact_name" || lookup.matchType === "ticker" ? 0.82 : 0.62) : lookup.response.ok ? 0.3 : 0.2,
          cost_usd: 0,
          score_block: "trade_financial",
          score_impact: "coverage_only",
          affects_score: false,
          raw_status: String(lookup.response.status),
        }, fetchedAt));
        if (!cik) {
          status = status === "scored" ? status : (lookup.response.ok ? "pending_human_input" : "unavailable_api");
          missing.push({
            block: "trade_financial",
            status: lookup.response.ok ? "pending_human_input" : "unavailable_api",
            recommended_next_step: lookup.response.ok
              ? "SEC 未按公司名匹配到 CIK；如果目标是上市公司或 SEC filer，请补充 ticker/CIK。"
              : `SEC ticker/CIK 映射返回 HTTP ${lookup.response.status}，稍后重试。`,
          });
        }
      } catch (error) {
        status = status === "scored" ? status : "unavailable_api";
        missing.push({ block: "trade_financial", status: "unavailable_api", recommended_next_step: `SEC CIK 自动查找失败：${error instanceof Error ? error.message : String(error)}` });
      }
    }

    if (!cik) {
      if (!target.company_name) {
        status = status === "scored" ? status : "pending_human_input";
        missing.push({
          block: "trade_financial",
          status: "pending_human_input",
          recommended_next_step: "补充 US 公司名称或 SEC CIK 后可自动查询 SEC EDGAR。",
        });
      }
      return { evidence, missing, block: scoreBlock("trade_financial", status, 10, earnedPoints, evidence, summary) };
    }

    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    try {
      const { response, body } = await fetchJson(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": secUserAgent(),
        },
      }, signal);
      const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      evidence.push(buildEvidence({
        layer: "financial_public_filing",
        source_type: "official_api",
        source: "SEC EDGAR",
        url,
        finding: response.ok ? `SEC submissions found for ${asString(record.name) ?? cik}。` : `SEC 返回 HTTP ${response.status}。`,
        confidence: response.ok ? 0.86 : 0.22,
        cost_usd: 0,
        score_block: "trade_financial",
        score_impact: response.ok ? "positive" : "coverage_only",
        affects_score: response.ok,
        raw_status: String(response.status),
      }, fetchedAt));
      if (response.ok) {
        status = "scored";
        earnedPoints = earnedPoints === null ? 8 : Math.min(10, earnedPoints + 2);
        summary = `${summary} SEC EDGAR 公开申报可查询。`;
      } else {
        missing.push({
          block: "trade_financial",
          status: "unavailable_api",
          recommended_next_step: `SEC 返回 HTTP ${response.status}，稍后重试或确认 CIK。`,
        });
      }
    } catch (error) {
      missing.push({ block: "trade_financial", status: "unavailable_api", recommended_next_step: `SEC 调用失败：${error instanceof Error ? error.message : String(error)}` });
    }
  }

  return { evidence, missing, block: scoreBlock("trade_financial", status, 10, earnedPoints, evidence, summary) };
}

function behaviorBlock(target: InvestigationTarget): ScoreBlock {
  const notes = target.operator_notes ?? "";
  const hasBehavior = /accio|聊天|付款|payment|pi|报价|responsive|响应/i.test(notes);
  if (!hasBehavior) {
    return scoreBlock("conversation_behavior", "not_applicable", 15, null, [], "行为记录：未适用（冷启动潜客）。", "Cold Marketing/manual target has no Accio or sales interaction.");
  }
  let points = 8;
  if (/PI|报价|payment|付款|deposit|定金|证书|certificate/i.test(notes)) points += 4;
  if (/第三方|third-party bank|unrelated bank|异常/i.test(notes)) points -= 8;
  return scoreBlock("conversation_behavior", "scored", 15, Math.max(0, Math.min(15, points)), [], "根据操作员提供的 Accio/销售行为备注计入行为信号。");
}

function scoreBlock(
  block: ScoreBlockId,
  status: EvidenceStatus,
  maxPoints: number,
  earnedPoints: number | null,
  evidence: EvidenceItem[],
  summary: string,
  reason?: string,
): ScoreBlock {
  return {
    block,
    status,
    max_points: maxPoints,
    earned_points: status === "scored" ? Math.max(0, Math.min(maxPoints, earnedPoints ?? 0)) : null,
    source_count: evidence.filter((item) => item.score_block === block || (block === "trade_financial" && (item.layer === "trade_customs" || item.layer === "financial_public_filing"))).length,
    summary,
    reason,
  };
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

const SCORE_QUALITY_WEIGHT = 0.8;
const EVIDENCE_COVERAGE_WEIGHT = 0.2;
const HIGH_SCORE_THRESHOLD = 80;
const MEDIUM_SCORE_THRESHOLD = 60;
const FORCED_DOWNGRADE_SCORE_CAP = MEDIUM_SCORE_THRESHOLD - 1;

function riskTierForFinalScore(score: number | null): ScoreResult["risk_tier"] {
  if (score === null) return "insufficient_evidence";
  if (score >= HIGH_SCORE_THRESHOLD) return "trusted_candidate";
  if (score >= MEDIUM_SCORE_THRESHOLD) return "cautious";
  return "high_risk";
}

function calculateScore(blocks: ScoreBlock[], forcedDowngrades: string[]): ScoreResult {
  const applicableBlocks = blocks.filter((block) => block.status !== "not_applicable");
  const scoredBlocks = blocks.filter((block) => block.status === "scored");
  const rawScore = scoredBlocks.reduce((sum, block) => sum + (block.earned_points ?? 0), 0);
  const scoreDenominator = scoredBlocks.reduce((sum, block) => sum + block.max_points, 0);
  const coverageDenominator = applicableBlocks.reduce((sum, block) => sum + block.max_points, 0);
  const evidenceCoverage = coverageDenominator === 0 ? 0 : scoreDenominator / coverageDenominator;
  const qualityScore = scoreDenominator === 0 ? null : (rawScore / scoreDenominator) * 100;
  const weightedScore =
    qualityScore === null
      ? null
      : qualityScore * SCORE_QUALITY_WEIGHT + evidenceCoverage * 100 * EVIDENCE_COVERAGE_WEIGHT;
  const normalizedScore =
    weightedScore === null
      ? forcedDowngrades.length > 0 ? 0 : null
      : forcedDowngrades.length > 0 ? Math.min(weightedScore, FORCED_DOWNGRADE_SCORE_CAP) : weightedScore;
  const riskTier = riskTierForFinalScore(normalizedScore);

  return {
    normalized_score: normalizedScore === null ? null : round(normalizedScore),
    evidence_coverage: round(evidenceCoverage, 4),
    risk_tier: riskTier,
    raw_score: round(rawScore),
    score_denominator: round(scoreDenominator),
    coverage_denominator: round(coverageDenominator),
    forced_downgrades: forcedDowngrades,
  };
}

function recommendedAction(score: ScoreResult): string {
  if (score.risk_tier === "trusted_candidate") {
    return "可进入试探接触；建议要求对方使用公司域名邮箱确认需求，并补充注册号或采购历史。";
  }
  if (score.risk_tier === "cautious") {
    return "谨慎跟进；先补充公司注册号、公司域名邮箱或采购证明，再投入高成本销售资源。";
  }
  if (score.risk_tier === "high_risk") {
    return "暂缓推进；需人工复核高风险证据，避免预付款、异常收款账户或敏感合规承诺。";
  }
  return "证据不足；建议补充公司官网、注册号、公司邮箱或 Accio 聊天记录后重新背调。";
}

async function buildReport(
  target: InvestigationTarget,
  fetchedAt: string,
  signal: AbortSignal,
  options: { enablePaidEmailValidation: boolean; enablePaidTradeData: boolean; maxPaidSpendUsd: number },
) {
  const registry = await registryEvidence(target, fetchedAt, signal);
  const domainEmail = await domainEmailEvidence(target, fetchedAt, signal, options.enablePaidEmailValidation);
  const publicFootprint = await publicFootprintEvidence(target, fetchedAt, signal);
  const tradeFinancial = await tradeFinancialEvidence(target, fetchedAt, signal, options.enablePaidTradeData, options.maxPaidSpendUsd);
  const behavior = behaviorBlock(target);

  const evidence = [
    ...registry.evidence,
    ...domainEmail.evidence,
    ...publicFootprint.evidence,
    ...tradeFinancial.evidence,
  ];
  if (behavior.status === "scored") {
    evidence.push(buildEvidence({
      layer: "behavior",
      source_type: "self_reported",
      source: "Operator notes",
      url: "sentura://operator-notes",
      finding: behavior.summary,
      confidence: 0.5,
      cost_usd: 0,
      score_block: "conversation_behavior",
      score_impact: "neutral",
      affects_score: true,
    }, fetchedAt));
  }

  const blocks = [
    registry.block,
    domainEmail.block,
    publicFootprint.publicBlock,
    publicFootprint.fitBlock,
    tradeFinancial.block,
    behavior,
  ];
  const forcedDowngrades = [
    ...(domainEmail.youngDomain && !registry.officialMatchFound ? ["young_domain_without_registry_match"] : []),
    ...(domainEmail.disposableOrFreeOnly && !domainEmail.businessDomainVerified ? ["free_or_disposable_email_without_business_domain"] : []),
    ...publicFootprint.adverseFlags,
    ...(/第三方|third-party bank|unrelated bank|异常/i.test(target.operator_notes ?? "") ? ["abnormal_payment_behavior"] : []),
  ];
  const score = calculateScore(blocks, forcedDowngrades);
  const missingOrUnavailableEvidence = [
    ...registry.missing,
    ...domainEmail.missing,
    ...publicFootprint.missing,
    ...tradeFinancial.missing,
  ];

  return {
    report_id: `screen-${target.target_id}-${Date.now()}`.replace(/[^a-zA-Z0-9-]+/g, "-"),
    lead_id: target.lead_id,
    target_source: target.source,
    target,
    company_name: target.company_name ?? target.domain ?? target.email ?? "未命名目标",
    risk_tier: score.risk_tier,
    normalized_score: score.normalized_score,
    evidence_coverage: score.evidence_coverage,
    recommended_action: recommendedAction(score),
    score_blocks: blocks,
    score_debug: score,
    evidence,
    open_questions: [
      ...target.missing_fields.map((field) => `缺少 ${field}，建议操作员补充。`),
      ...(score.evidence_coverage < 0.7 ? ["证据覆盖率已计入最终评分；如需提高分数，应补充注册号、公司邮箱或采购记录。"] : []),
    ],
    missing_or_unavailable_evidence: missingOrUnavailableEvidence,
    created_at: fetchedAt,
  };
}

export async function POST(request: Request) {
  const status = envStatus();
  const fetchedAt = new Date().toISOString();
  try {
    const body = (await request.json()) as ScreeningRunRequest;
    const targets = targetsFromRequest(body);
    if (targets.length === 0) {
      return NextResponse.json(
        {
          mode: "live",
          env_status: status,
          reports: [],
          error: "No investigation targets supplied",
        },
        { status: 400 },
      );
    }

    const enablePaidEmailValidation = body.enable_paid_email_validation !== false;
    const requestedPaidTrade = body.enable_paid_trade_data === true;
    const maxPaidSpendUsd = boundedNumber(body.max_paid_spend_usd, status.paid_trade_data.max_paid_spend_usd ?? 0, 0, 500);
    const signal = AbortSignal.timeout(status.request_timeout_ms);
    const reports = [];

    for (const target of targets.slice(0, 10)) {
      reports.push(
        await buildReport(target, fetchedAt, signal, {
          enablePaidEmailValidation,
          enablePaidTradeData: requestedPaidTrade,
          maxPaidSpendUsd,
        }),
      );
    }

    return NextResponse.json({
      mode: "live",
      provider: "cross-border-screening-live",
      investigated_at: fetchedAt,
      env_status: status,
      normalized_target_count: targets.length,
      reports,
    });
  } catch (error) {
    return NextResponse.json(
      {
        mode: "live",
        env_status: status,
        error: error instanceof Error ? error.message : "Live screening failed",
      },
      { status: 500 },
    );
  }
}
