import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SourceType = "official_api" | "public_web" | "paid_trade_data" | "self_reported" | "unverified";

interface RunRequest {
  run_id?: unknown;
  product_keywords?: unknown;
  buyer_personas?: unknown;
  countries?: unknown;
  languages?: unknown;
  max_results_per_query?: unknown;
  daily_candidate_target?: unknown;
  exclude_domains?: unknown;
  max_queries?: unknown;
}

interface QueryPlanEntry {
  id: string;
  query: string;
  country: string;
  product: string;
  persona: string;
}

interface QueryLogEntry {
  id: string;
  query: string;
  country: string;
  product: string;
  source_type: SourceType;
  timestamp: string;
  status: "planned" | "sent" | "reviewed";
}

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
  published_date?: unknown;
}

const COUNTRY_LABELS: Record<string, string> = {
  BR: "Brazil",
  CL: "Chile",
  CO: "Colombia",
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  IT: "Italy",
  MX: "Mexico",
  US: "United States",
};

const DEFAULT_PRODUCTS = ["phone case", "tempered glass screen protector", "USB-C charger"];
const DEFAULT_PERSONAS = ["mobile phone repair chain", "electronics retailer", "cell phone accessories retailer"];
const DEFAULT_COUNTRIES = ["GB", "US"];
const DEFAULT_EXCLUDE_DOMAINS = ["amazon.com", "alibaba.com", "aliexpress.com", "temu.com", "ebay.com"];
const BLOCKED_LEAD_DOMAINS = [
  "1688.com",
  "alibaba.com",
  "aliexpress.com",
  "amazon.com",
  "apollo.io",
  "businesswire.com",
  "bonafideresearch.com",
  "clutch.co",
  "company-information.service.gov.uk",
  "crunchbase.com",
  "d7leadfinder.com",
  "dhgate.com",
  "dnb.com",
  "ebay.com",
  "europages.co.uk",
  "europages.com",
  "facebook.com",
  "find-and-update.company-information.service.gov.uk",
  "glassdoor.com",
  "globalsources.com",
  "instagram.com",
  "kompass.com",
  "linkedin.com",
  "made-in-china.com",
  "mapquest.com",
  "pinterest.com",
  "reddit.com",
  "temu.com",
  "thewholesaleforums.co.uk",
  "thomasnet.com",
  "tiktok.com",
  "trustpilot.com",
  "twitter.com",
  "wholesalecentral.com",
  "x.com",
  "yelp.com",
  "yellowpages.com",
  "yell.com",
  "youtube.com",
  "zoominfo.com",
];
const DIRECTORY_DOMAIN_HINTS = [
  "directory",
  "marketplace",
  "supplierdirectory",
  "tradeindia",
  "wholesale-directory",
  "wholesalecentral",
  "yellowpage",
];
const COMPANY_PATH_HINTS = [
  "/about",
  "/about-us",
  "/contact",
  "/contact-us",
  "/locations",
  "/stores",
  "/repair",
  "/services",
  "/products",
  "/accessories",
];
const MOBILE_ACCESSORY_TERMS = [
  "cell phone accessories",
  "charger",
  "charging cable",
  "iphone accessories",
  "magsafe",
  "mobile accessories",
  "mobile phone accessories",
  "mobile phone repair",
  "phone accessories",
  "phone case",
  "phone repair",
  "repair parts",
  "screen protector",
  "smartphone accessories",
  "tempered glass",
  "usb-c",
];
const BUYER_BUSINESS_TERMS = [
  "accessory retailer",
  "cell phone repair",
  "cell phone store",
  "electronics retailer",
  "locations",
  "mobile phone repair",
  "repair centre",
  "repair center",
  "repair shop",
  "retail store",
  "retailer",
  "shop",
  "smartphone repair",
  "store locator",
];
const NON_COMPANY_RESULT_TERMS = [
  "b2b marketplace",
  "best wholesale suppliers",
  "business directory",
  "directory of",
  "facebook",
  "find suppliers",
  "linkedin",
  "list of suppliers",
  "marketplace",
  "manufacturers and suppliers",
  "supplier directory",
  "top wholesale",
  "wholesale directory",
];
const SUPPLIER_ONLY_TERMS = [
  "china supplier",
  "exporter",
  "factory",
  "manufacturer",
  "oem",
  "odm",
  "supplying wholesale",
  "wholesale business",
  "wholesale phone cases",
  "wholesale supplier",
];
const OPENCLAW_ENV_PATH = path.join(os.homedir(), ".openclaw", ".env");

let openClawEnvCache: Record<string, string> | undefined;

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return strings.length > 0 ? Array.from(new Set(strings)) : fallback;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

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
    // The dashboard can still run from process.env or .env.local.
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
  const paidTradeDataEnabled =
    envValue("CBE_ENABLE_PAID_TRADE_DATA") === "true" || envValue("CBE_ENABLE_PAID_TRADE_DATA") === "1";

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
    hunter_enrichment: {
      configured: configured("HUNTER_API_KEY"),
      source: envSource("HUNTER_API_KEY"),
      provider: "Hunter API",
    },
    importyeti_trade_data: {
      configured: configured("IMPORTYETI_API_KEY"),
      enabled: paidTradeDataEnabled && maxPaidSpendUsd > 0,
      source: envSource("IMPORTYETI_API_KEY"),
      provider: "ImportYeti API",
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

function normalizeDomain(input: string): string {
  try {
    const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return input.toLowerCase().replace(/^www\./, "").split("/")[0] ?? input.toLowerCase();
  }
}

function domainFromUrl(url: string): string {
  return normalizeDomain(url);
}

function isExcludedDomain(domain: string, excludedDomains: string[]): boolean {
  return excludedDomains.some((item) => {
    const excluded = normalizeDomain(item);
    return domain === excluded || domain.endsWith(`.${excluded}`);
  });
}

function isBlockedLeadDomain(domain: string, excludedDomains: string[]): boolean {
  return (
    isExcludedDomain(domain, excludedDomains) ||
    isExcludedDomain(domain, BLOCKED_LEAD_DOMAINS) ||
    DIRECTORY_DOMAIN_HINTS.some((hint) => domain.includes(hint))
  );
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function confidenceFromScore(score: unknown): number {
  const parsed = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(parsed)) return 0.58;
  if (parsed > 1) return Math.min(0.95, Math.max(0.35, parsed / 100));
  return Math.min(0.95, Math.max(0.35, parsed));
}

function companyNameFromTitle(title: string, domain: string): string {
  const cleaned = title
    .replace(/\s+/g, " ")
    .split(/\s[-|–—:]\s/)
    .map((part) => part.trim())
    .filter(Boolean)[0];
  const genericTitle =
    !cleaned ||
    /^(about|about us|contact|contact us|home|shop|store|privacy policy|terms)$/i.test(cleaned) ||
    /^(american express|visa|mastercard|paypal|apple pay|google pay)$/i.test(cleaned);
  if (!genericTitle && cleaned.length >= 2) return cleaned.slice(0, 96);
  const root = domain.split(".")[0] ?? domain;
  return root
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstEmail(text: string): string | undefined {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0];
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function normalizedPersona(persona: string): string {
  const normalized = persona.toLowerCase();
  if (normalized.includes("wholesale")) return "retailer or repair shop buyer";
  if (normalized.includes("distributor") || normalized.includes("importer")) return "electronics reseller buyer";
  return persona;
}

function companyWebsiteSignal(url: string, title: string, content: string): boolean {
  const haystack = `${title}\n${content}`.toLowerCase();
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return (
      COMPANY_PATH_HINTS.some((hint) => path.includes(hint)) ||
      includesAny(haystack, ["about us", "contact us", "our stores", "store locator", "locations", "visit us"])
    );
  } catch {
    return includesAny(haystack, ["about us", "contact us", "our stores", "store locator", "locations", "visit us"]);
  }
}

function rejectionReasonForResult(
  result: TavilyResult,
  query: QueryPlanEntry,
  excludedDomains: string[],
): string | undefined {
  const url = asText(result.url);
  if (!url) return "missing_url";
  const domain = domainFromUrl(url);
  if (!domain) return "missing_domain";
  if (isBlockedLeadDomain(domain, excludedDomains)) return `blocked_non_company_domain:${domain}`;

  const title = asText(result.title);
  const content = asText(result.content);
  const haystack = `${title}\n${content}\n${url}`.toLowerCase();
  if (includesAny(haystack, NON_COMPANY_RESULT_TERMS)) return "directory_or_public_info_page";
  if (includesAny(haystack, SUPPLIER_ONLY_TERMS)) {
    return "supplier_or_manufacturer_page";
  }
  if (!includesAny(haystack, MOBILE_ACCESSORY_TERMS) && !haystack.includes(query.product.toLowerCase())) {
    return "missing_mobile_accessory_business_signal";
  }
  if (!includesAny(haystack, BUYER_BUSINESS_TERMS)) {
    return "missing_buyer_company_signal";
  }
  if (!companyWebsiteSignal(url, title, content) && !includesAny(haystack, ["repair", "shop", "store", "retail"])) {
    return "missing_company_website_signal";
  }

  return undefined;
}

function buildQueries(input: {
  products: string[];
  personas: string[];
  countries: string[];
  maxQueries: number;
}): QueryPlanEntry[] {
  const entries: QueryPlanEntry[] = [];
  for (const country of input.countries) {
    const countryName = COUNTRY_LABELS[country] ?? country;
    for (const product of input.products) {
      for (const persona of input.personas) {
        const buyerPersona = normalizedPersona(persona);
        entries.push({
          id: `${country}-${product}-${buyerPersona}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          query: `${product} phone accessories retailer ${countryName} contact us`,
          country,
          product,
          persona: buyerPersona,
        });
        if (entries.length >= input.maxQueries) return entries;
        entries.push({
          id: `${country}-${product}-${buyerPersona}-retail-repair`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          query: `mobile phone repair ${product} ${countryName} locations`,
          country,
          product,
          persona: "repair or retail buyer",
        });
        if (entries.length >= input.maxQueries) return entries;
      }
    }
  }
  return entries;
}

async function tavilySearch(query: string, maxResults: number, excludedDomains: string[], signal: AbortSignal) {
  const apiKey = envValue("TAVILY_API_KEY");
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured for live lead discovery");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: maxResults,
      include_answer: false,
      include_images: false,
      include_raw_content: false,
      exclude_domains: excludedDomains,
    }),
    signal,
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : response.statusText;
    throw new Error(`Tavily search failed (${response.status}): ${detail}`);
  }

  const record = payload && typeof payload === "object" ? (payload as { results?: unknown }) : {};
  return Array.isArray(record.results) ? (record.results as TavilyResult[]) : [];
}

function leadFromResult(args: {
  result: TavilyResult;
  query: QueryPlanEntry;
  runId: string;
  index: number;
  fetchedAt: string;
  excludedDomains: string[];
}) {
  const url = asText(args.result.url);
  if (!url) return undefined;
  const domain = domainFromUrl(url);
  if (!domain) return undefined;
  const rejectionReason = rejectionReasonForResult(args.result, args.query, args.excludedDomains);
  if (rejectionReason) return undefined;

  const title = asText(args.result.title);
  const content = asText(args.result.content);
  const excerpt = content || title || url;
  const email = firstEmail(`${title}\n${content}`);
  const confidence = confidenceFromScore(args.result.score);
  const sourceUrl = url;

  return {
    lead_id: `lead_${args.runId.replace(/[^a-zA-Z0-9]+/g, "_")}_${String(args.index + 1).padStart(4, "0")}`,
    source_run_id: args.runId,
    company_name: companyNameFromTitle(title, domain),
    website: url,
    domain,
    country: args.query.country,
    city: "未确认",
    buyer_type: args.query.persona,
    matched_products: [args.query.product],
    contact_candidates: email
      ? [
          {
            type: "email" as const,
            value: email,
            source_url: sourceUrl,
            confidence: Math.min(0.9, confidence + 0.05),
          },
        ]
      : [],
    source_urls: [sourceUrl],
    discovery_evidence: [
      {
        signal: "company_website_mentions_mobile_accessory_business",
        source_url: sourceUrl,
        excerpt: excerpt.slice(0, 320),
        confidence,
        query: args.query.query,
        fetched_at: args.fetchedAt,
        source_type: "public_web" as SourceType,
      },
    ],
    dedupe_key: domain,
    duplicate_status: "new" as const,
    created_at: args.fetchedAt,
    source_label: "实时查询" as const,
    discovery_confidence: confidence,
    dedupe_explanation: "仅保留公司级官网结果；已过滤社媒、目录、市场平台和泛批发信息页，并按规范化域名去重。",
  };
}

export async function POST(request: Request) {
  const status = envStatus();
  try {
    const body = (await request.json()) as RunRequest;
    const products = stringArray(body.product_keywords, DEFAULT_PRODUCTS);
    const personas = stringArray(body.buyer_personas, DEFAULT_PERSONAS);
    const countries = stringArray(body.countries, DEFAULT_COUNTRIES).map((country) => country.toUpperCase());
    const excludeDomains = Array.from(
      new Set([...stringArray(body.exclude_domains, DEFAULT_EXCLUDE_DOMAINS), ...DEFAULT_EXCLUDE_DOMAINS, ...BLOCKED_LEAD_DOMAINS]),
    ).slice(0, 150);
    const target = boundedNumber(body.daily_candidate_target, 50, 1, 200);
    const maxResultsPerQuery = boundedNumber(body.max_results_per_query, 10, 1, 20);
    const maxQueries = boundedNumber(
      body.max_queries,
      Math.max(1, Math.ceil(target / maxResultsPerQuery)),
      1,
      24,
    );
    const runId = typeof body.run_id === "string" && body.run_id.trim() ? body.run_id.trim() : `lead-run-${Date.now()}`;
    const fetchedAt = new Date().toISOString();
    const queryPlan = buildQueries({ products, personas, countries, maxQueries });
    const queryLog: QueryLogEntry[] = [];
    const leads: ReturnType<typeof leadFromResult>[] = [];
    const seenDomains = new Set<string>();
    const errors: string[] = [];
    const signal = AbortSignal.timeout(status.request_timeout_ms);

    if (!status.tavily_search.configured) {
      return NextResponse.json(
        {
          mode: "live",
          provider: "tavily",
          searched_at: fetchedAt,
          env_status: status,
          query_log: queryPlan.map((query) => ({
            id: query.id,
            query: query.query,
            country: query.country,
            product: query.product,
            source_type: "public_web" as SourceType,
            timestamp: fetchedAt,
            status: "planned" as const,
          })),
          leads: [],
          error: "TAVILY_API_KEY is required for live lead discovery",
        },
        { status: 400 },
      );
    }

    for (const query of queryPlan) {
      queryLog.push({
        id: query.id,
        query: query.query,
        country: query.country,
        product: query.product,
        source_type: "public_web",
        timestamp: fetchedAt,
        status: "sent",
      });
      try {
        const results = await tavilySearch(query.query, maxResultsPerQuery, excludeDomains, signal);
        queryLog[queryLog.length - 1].status = "reviewed";
        for (const result of results) {
          const url = asText(result.url);
          const domain = url ? domainFromUrl(url) : "";
          if (!domain || seenDomains.has(domain) || isBlockedLeadDomain(domain, excludeDomains)) continue;
          const lead = leadFromResult({ result, query, runId, index: leads.length, fetchedAt, excludedDomains: excludeDomains });
          if (!lead) continue;
          seenDomains.add(domain);
          leads.push(lead);
          if (leads.length >= target) break;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      if (leads.length >= target) break;
    }

    const compactLeads = leads.filter(Boolean);
    return NextResponse.json({
      mode: "live",
      provider: "tavily",
      searched_at: fetchedAt,
      env_status: status,
      run_id: runId,
      query_log: queryLog,
      leads: compactLeads,
      errors,
      shortage:
        compactLeads.length < target
          ? `实时查询返回 ${compactLeads.length}/${target} 条去重候选；缺口来自搜索结果不足、排除域名或同域名重复。`
          : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live lead discovery failed";
    return NextResponse.json(
      {
        mode: "live",
        provider: "tavily",
        env_status: status,
        error: message,
      },
      { status: configured("TAVILY_API_KEY") ? 500 : 400 },
    );
  }
}
