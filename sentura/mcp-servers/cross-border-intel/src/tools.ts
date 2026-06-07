import type { MxRecord } from "node:dns";
import { resolveMx, resolveTxt } from "node:dns/promises";
import { z } from "zod";
import type { CrossBorderIntelConfig } from "./config.js";
import {
  AccioChatExportSchema,
  type AccioChatSummary,
  type AccioConversation,
  CompanyProfileInputShape,
  CompanyRegistrySearchInputShape,
  DomainRdapLookupInputShape,
  EmailDomainCheckInputShape,
  ParseAccioChatInputShape,
  ScoreBuyerInputShape,
  SecLookupInputShape,
  SummarizeAccioChatInputShape,
  TradeRecordSearchInputShape,
  calculateContextualScore,
} from "./schemas.js";

export type RawShape = Record<string, z.ZodTypeAny>;

export interface DnsResolver {
  resolveMx(domain: string): Promise<MxRecord[]>;
  resolveTxt(hostname: string): Promise<string[][]>;
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface ToolContext {
  config: CrossBorderIntelConfig;
  fetchFn: FetchLike;
  dnsResolver: DnsResolver;
  now: () => Date;
}

export interface ToolDefinition<S extends RawShape = RawShape> {
  name: string;
  title: string;
  description: string;
  endpoint: string;
  inputShape: S;
  handler: (ctx: ToolContext, args: { [K in keyof S]: z.infer<S[K]> }) => Promise<unknown>;
}

export const defaultDnsResolver: DnsResolver = {
  resolveMx,
  resolveTxt,
};

function fetchedAt(ctx: ToolContext): string {
  return ctx.now().toISOString();
}

function source<T extends Record<string, unknown>>(
  ctx: ToolContext,
  payload: T,
  meta: { sourceUrl: string; sourceType: string; confidence: number },
) {
  return {
    ...payload,
    source_url: meta.sourceUrl,
    source_type: meta.sourceType,
    fetched_at: fetchedAt(ctx),
    confidence: meta.confidence,
  };
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function companiesHouseAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function fetchJson(ctx: ToolContext, url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ctx.config.requestTimeoutMs);
  try {
    const response = await ctx.fetchFn(url, { ...init, signal: controller.signal });
    const body = await readResponseBody(response);
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCountry(country: string | undefined): string | undefined {
  if (!country) return undefined;
  return country === "UK" ? "GB" : country;
}

function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^www\./, "").split("/")[0] ?? trimmed;
  }
}

function searchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function companyRegistrySearch(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(CompanyRegistrySearchInputShape).parse(rawArgs);
  const country = normalizeCountry(args.country);

  if (country === "GB" && ctx.config.companiesHouseApiKey) {
    const url = new URL(joinUrl(ctx.config.companiesHouseBaseUrl, "/search/companies"));
    url.searchParams.set("q", args.company_name);
    url.searchParams.set("items_per_page", String(args.max_results));
    const { response, body } = await fetchJson(ctx, url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: companiesHouseAuthHeader(ctx.config.companiesHouseApiKey),
      },
    });
    const record = asRecord(body);
    const items = Array.isArray(record.items) ? record.items : [];
    return source(
      ctx,
      {
        status: response.ok ? "found" : "api_error",
        registry: "companies_house",
        endpoint: "GET /search/companies",
        query: args.company_name,
        http_status: response.status,
        companies: items.slice(0, args.max_results),
      },
      { sourceUrl: url.toString(), sourceType: "official_api", confidence: response.ok ? 0.9 : 0.25 },
    );
  }

  if (ctx.config.openCorporatesApiKey) {
    const url = new URL(joinUrl(ctx.config.openCorporatesBaseUrl, "/companies/search"));
    url.searchParams.set("q", args.company_name);
    url.searchParams.set("per_page", String(args.max_results));
    url.searchParams.set("api_token", ctx.config.openCorporatesApiKey);
    const { response, body } = await fetchJson(ctx, url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return source(
      ctx,
      {
        status: response.ok ? "found" : "api_error",
        registry: "opencorporates",
        endpoint: "GET /companies/search",
        query: args.company_name,
        http_status: response.status,
        result: body,
      },
      { sourceUrl: url.toString(), sourceType: "official_api", confidence: response.ok ? 0.78 : 0.25 },
    );
  }

  return source(
    ctx,
    {
      status: "unavailable_api",
      registry: country === "GB" ? "companies_house" : "public_web_registry_search",
      query: args.company_name,
      suggested_query: `${args.company_name} ${country ?? ""} company registry`,
      note: "No registry API key is configured; use web_search/web_fetch for public registry fallback.",
      companies: [],
    },
    {
      sourceUrl: searchUrl(`${args.company_name} ${country ?? ""} company registry`),
      sourceType: "public_web",
      confidence: 0.25,
    },
  );
}

async function companyProfile(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(CompanyProfileInputShape).parse(rawArgs);
  const country = normalizeCountry(args.country);

  if (args.registry_url) {
    return source(
      ctx,
      {
        status: "manual_url",
        registry: args.registry,
        registry_url: args.registry_url,
        note: "Fetch and review this registry URL with web_fetch; no API call was made by this tool.",
      },
      { sourceUrl: args.registry_url, sourceType: "official_registry_page", confidence: 0.45 },
    );
  }

  if (args.registry === "companies_house" && country === "GB" && args.company_number && ctx.config.companiesHouseApiKey) {
    const path = `/company/${encodeURIComponent(args.company_number)}`;
    const url = joinUrl(ctx.config.companiesHouseBaseUrl, path);
    const { response, body } = await fetchJson(ctx, url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: companiesHouseAuthHeader(ctx.config.companiesHouseApiKey),
      },
    });
    return source(
      ctx,
      {
        status: response.ok ? "found" : "api_error",
        registry: "companies_house",
        endpoint: "GET /company/{companyNumber}",
        company_number: args.company_number,
        http_status: response.status,
        profile: body,
      },
      { sourceUrl: url, sourceType: "official_api", confidence: response.ok ? 0.95 : 0.25 },
    );
  }

  return source(
    ctx,
    {
      status: "unavailable_api",
      registry: args.registry,
      company_number: args.company_number,
      note: "No supported registry API path is available for this profile request.",
    },
    {
      sourceUrl: searchUrl(`${args.company_number ?? ""} ${country ?? ""} company profile registry`),
      sourceType: "public_web",
      confidence: 0.2,
    },
  );
}

async function domainRdapLookup(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(DomainRdapLookupInputShape).parse(rawArgs);
  const domain = normalizeDomain(args.domain);
  const url = joinUrl(ctx.config.rdapBaseUrl, `/domain/${encodeURIComponent(domain)}`);
  const { response, body } = await fetchJson(ctx, url, {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "application/rdap+json, application/json" },
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const redirectTo = response.headers.get("location");
    return source(
      ctx,
      {
        status: "redirect",
        domain,
        redirect_to: redirectTo,
        http_status: response.status,
        note: "RDAP.org redirected to the authoritative RDAP server.",
      },
      { sourceUrl: redirectTo ?? url, sourceType: "official_api", confidence: 0.6 },
    );
  }

  if (response.status === 404) {
    return source(
      ctx,
      { status: "not_found", domain, http_status: 404, rdap: body },
      { sourceUrl: url, sourceType: "official_api", confidence: 0.2 },
    );
  }

  if (response.status === 429) {
    return source(
      ctx,
      {
        status: "rate_limited",
        domain,
        http_status: 429,
        retry_after: response.headers.get("retry-after"),
        rdap: body,
      },
      { sourceUrl: url, sourceType: "official_api", confidence: 0.1 },
    );
  }

  const record = asRecord(body);
  return source(
    ctx,
    {
      status: response.ok ? "found" : "api_error",
      domain,
      http_status: response.status,
      object_class_name: firstString(record.objectClassName),
      handle: firstString(record.handle),
      events: Array.isArray(record.events) ? record.events : [],
      nameservers: Array.isArray(record.nameservers) ? record.nameservers : [],
      rdap: body,
    },
    { sourceUrl: url, sourceType: "official_api", confidence: response.ok ? 0.82 : 0.2 },
  );
}

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

function flattenTxt(records: string[][]): string[] {
  return records.map((parts) => parts.join(""));
}

async function tryResolve<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function emailDomainCheck(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(EmailDomainCheckInputShape).parse(rawArgs);
  if (!args.email && !args.domain) {
    throw new Error("email_domain_check requires either email or domain.");
  }

  const email = args.email?.trim().toLowerCase();
  const domain = normalizeDomain(args.domain ?? email?.split("@")[1] ?? "");
  const localPart = email?.split("@")[0]?.toLowerCase();
  const mx = await tryResolve(() => ctx.dnsResolver.resolveMx(domain));
  const spf = await tryResolve(() => ctx.dnsResolver.resolveTxt(domain));
  const dmarc = await tryResolve(() => ctx.dnsResolver.resolveTxt(`_dmarc.${domain}`));
  const spfRecords = spf.ok ? flattenTxt(spf.value).filter((txt) => txt.toLowerCase().startsWith("v=spf1")) : [];
  const dmarcRecords = dmarc.ok
    ? flattenTxt(dmarc.value).filter((txt) => txt.toLowerCase().startsWith("v=dmarc1"))
    : [];
  const mxRecords = mx.ok ? mx.value : [];
  const freeProvider = FREE_EMAIL_DOMAINS.has(domain);
  const disposableDomain = DISPOSABLE_EMAIL_DOMAINS.has(domain);
  const roleEmail = localPart ? ROLE_EMAIL_LOCAL_PARTS.has(localPart) : false;

  let confidence = 0.72;
  if (!mx.ok || mxRecords.length === 0) confidence = 0.3;
  if (freeProvider) confidence = Math.min(confidence, 0.48);
  if (disposableDomain) confidence = Math.min(confidence, 0.18);
  if (spfRecords.length > 0 && dmarcRecords.length > 0 && mxRecords.length > 0 && !freeProvider) confidence = 0.86;

  let paidValidation: Record<string, unknown> | undefined;
  if (args.enable_paid_validation && ctx.config.abstractApiKey && email) {
    const url = new URL(ctx.config.abstractBaseUrl);
    url.searchParams.set("api_key", ctx.config.abstractApiKey);
    url.searchParams.set("email", email);
    const { response, body } = await fetchJson(ctx, url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    paidValidation = {
      provider: "abstract",
      http_status: response.status,
      result: body,
      source_url: "https://www.abstractapi.com/api/email-verification-validation-api",
      source_type: "official_api",
    };
  }

  return source(
    ctx,
    {
      status: mx.ok && mxRecords.length > 0 ? "checked" : "no_mx",
      email,
      domain,
      checks: {
        syntax_valid: Boolean(email ? z.string().email().safeParse(email).success : true),
        free_provider: freeProvider,
        disposable_domain: disposableDomain,
        role_email: roleEmail,
        mx: {
          present: mx.ok && mxRecords.length > 0,
          records: mxRecords,
          error: mx.ok ? undefined : mx.error,
        },
        spf: {
          present: spfRecords.length > 0,
          records: spfRecords,
          error: spf.ok ? undefined : spf.error,
        },
        dmarc: {
          present: dmarcRecords.length > 0,
          records: dmarcRecords,
          error: dmarc.ok ? undefined : dmarc.error,
        },
      },
      paid_validation: paidValidation,
    },
    { sourceUrl: `https://${domain}`, sourceType: "public_dns", confidence },
  );
}

function padCik(cik: string): string {
  return cik.padStart(10, "0");
}

async function secLookup(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(SecLookupInputShape).parse(rawArgs);
  const padded = padCik(args.cik);
  const url = joinUrl(ctx.config.secBaseUrl, `/submissions/CIK${padded}.json`);
  const { response, body } = await fetchJson(ctx, url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": ctx.config.secUserAgent,
    },
  });
  const record = asRecord(body);
  return source(
    ctx,
    {
      status: response.ok ? "found" : "api_error",
      cik: padded,
      endpoint: "GET /submissions/CIK##########.json",
      http_status: response.status,
      entity_name: firstString(record.name),
      sic: firstString(record.sic),
      tickers: Array.isArray(record.tickers) ? record.tickers : [],
      submissions: body,
    },
    { sourceUrl: url, sourceType: "official_api", confidence: response.ok ? 0.86 : 0.22 },
  );
}

async function tradeRecordSearch(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(TradeRecordSearchInputShape).parse(rawArgs);
  const estimatedVolzaSpend = 0.1 + 0.02 * Math.min(args.max_records, 10);
  const budget = Math.min(ctx.config.maxPaidSpendUsd, args.max_paid_spend_usd);

  if (
    (args.source === "volza" || args.source === "auto") &&
    ctx.config.enablePaidTradeData &&
    ctx.config.volzaApiKey &&
    budget >= estimatedVolzaSpend
  ) {
    const url = new URL(joinUrl(ctx.config.volzaBaseUrl, "/v1/trade/search"));
    url.searchParams.set("company", args.company_name);
    if (args.country) url.searchParams.set("country", args.country);
    for (const keyword of args.product_keywords) url.searchParams.append("product", keyword);
    url.searchParams.set("limit", String(args.max_records));
    const { response, body } = await fetchJson(ctx, url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${ctx.config.volzaApiKey}`,
      },
    });
    return source(
      ctx,
      {
        status: response.ok ? "found" : "api_error",
        provider: "volza",
        estimated_cost_usd: estimatedVolzaSpend,
        http_status: response.status,
        records: body,
      },
      { sourceUrl: url.toString(), sourceType: "paid_trade_data", confidence: response.ok ? 0.74 : 0.2 },
    );
  }

  if (
    (args.source === "importyeti" || args.source === "auto") &&
    ctx.config.enablePaidTradeData &&
    ctx.config.importYetiApiKey &&
    budget > 0
  ) {
    const url = new URL(joinUrl(ctx.config.importYetiBaseUrl, "/search"));
    url.searchParams.set("q", args.company_name);
    const { response, body } = await fetchJson(ctx, url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${ctx.config.importYetiApiKey}`,
      },
    });
    return source(
      ctx,
      {
        status: response.ok ? "found" : "api_error",
        provider: "importyeti",
        http_status: response.status,
        records: body,
      },
      { sourceUrl: url.toString(), sourceType: "paid_trade_data", confidence: response.ok ? 0.68 : 0.2 },
    );
  }

  const query = `${args.company_name} import export shipment ${args.product_keywords.join(" ")}`.trim();
  return source(
    ctx,
    {
      status: ctx.config.enablePaidTradeData ? "disabled_by_budget" : "unavailable_api",
      provider: "public_web_fallback",
      estimated_volza_cost_usd: estimatedVolzaSpend,
      budget_usd: budget,
      suggested_query: query,
      note: "Paid trade-data API is not enabled or not within the configured budget; treat public web trade evidence as weak.",
      records: [],
    },
    { sourceUrl: searchUrl(query), sourceType: "public_web", confidence: 0.22 },
  );
}

async function scoreBuyer(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(ScoreBuyerInputShape).parse(rawArgs);
  const score = calculateContextualScore({
    profile: args.profile,
    blocks: args.blocks,
    forcedDowngrades: args.forced_downgrades,
  });
  return source(
    ctx,
    {
      status: "scored",
      ...score,
    },
    {
      sourceUrl: "https://sentura.local/cross-border-intel/scoring",
      sourceType: "self_reported",
      confidence: score.evidence_coverage,
    },
  );
}

async function parseAccioChat(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(ParseAccioChatInputShape).parse(rawArgs);
  const chatExport = AccioChatExportSchema.parse(args.chat_export);
  return source(
    ctx,
    {
      status: "parsed",
      platform: chatExport.export_metadata.platform,
      source_file: chatExport.export_metadata.source_file,
      data_classification: chatExport.export_metadata.data_classification,
      conversation_count: chatExport.conversations.length,
      normalized_conversations: chatExport.conversations.map((conversation) => ({
        conversation_id: conversation.conversation_id,
        buyer: conversation.buyer,
        message_count: conversation.messages.length,
        first_message_at: conversation.messages[0]?.timestamp,
        last_message_at: conversation.messages.at(-1)?.timestamp,
        attachment_count: conversation.attachments.length,
      })),
    },
    {
      sourceUrl: `https://sentura.local/fixtures/${encodeURIComponent(chatExport.export_metadata.source_file)}`,
      sourceType: "demo_fixture",
      confidence: 0.95,
    },
  );
}

function numbersFromText(text: string): number[] {
  const matches = text.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)(?:\s*)(?:pcs|pieces|units)/gi);
  return Array.from(matches, (match) => Number(match[1].replace(/,/g, ""))).filter(Number.isFinite);
}

function pricesFromText(text: string): number[] {
  const matches = text.matchAll(/USD\s*([0-9]+(?:\.[0-9]+)?)/gi);
  return Array.from(matches, (match) => Number(match[1])).filter(Number.isFinite);
}

function detectProduct(text: string): string {
  const lowered = text.toLowerCase();
  if (lowered.includes("tempered glass") || lowered.includes("screen protector")) {
    return "tempered glass screen protectors";
  }
  if (lowered.includes("gan charger") || lowered.includes("charger")) {
    return "65W GaN chargers";
  }
  if (lowered.includes("magsafe") || lowered.includes("phone case")) {
    return "clear MagSafe phone cases";
  }
  return "mobile phone accessories";
}

function detectModels(text: string): string[] {
  const modelPatterns = [
    /iPhone\s+\d+(?:\s+Pro(?:\s+Max)?)?/gi,
    /Samsung\s+S\d+/gi,
    /\d+W\s+GaN/gi,
    /EU plug/gi,
  ];
  const found = new Set<string>();
  for (const pattern of modelPatterns) {
    for (const match of text.matchAll(pattern)) found.add(match[0]);
  }
  return Array.from(found);
}

function detectIncoterm(text: string): string | undefined {
  const match = text.match(/\b(FOB\s+Shenzhen|EXW|CIF|DAP|DDP)\b/i);
  return match?.[1];
}

function detectPaymentTerms(text: string): string | undefined {
  const match = text.match(/T\/T\s+30%\s+deposit,\s*balance before shipment/i);
  return match?.[0];
}

function detectPackaging(text: string): string | undefined {
  if (/retail packaging/i.test(text)) return "custom retail packaging";
  if (/FBA barcode/i.test(text) || /drop-test packaging/i.test(text)) {
    return "Amazon FBA barcode stickers and drop-test packaging";
  }
  return undefined;
}

function summarizeConversation(chatExport: z.infer<typeof AccioChatExportSchema>, conversation: AccioConversation): AccioChatSummary {
  const allText = conversation.messages.map((message) => message.text).join(" ");
  const buyerText = conversation.messages
    .filter((message) => message.sender === "buyer")
    .map((message) => message.text)
    .join(" ");
  const sellerText = conversation.messages
    .filter((message) => message.sender === "seller")
    .map((message) => message.text)
    .join(" ");
  const quantity = Math.max(...numbersFromText(allText), 0) || undefined;
  const buyerPrices = pricesFromText(buyerText);
  const sellerPrices = pricesFromText(sellerText);
  const packagingAddon = sellerText.match(/packaging (?:adds|is) USD\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  const explicitTargetPrice = buyerText.match(/can\s+(?:you|we)[^.?!]{0,80}?USD\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  const sellerProductPrices = sellerPrices.filter((price) => price >= 0.1);
  const targetPrice = explicitTargetPrice
    ? Number(explicitTargetPrice)
    : buyerPrices.length > 0
      ? Math.max(...buyerPrices)
      : undefined;
  const sellerBestPrice = sellerProductPrices.length > 0 ? Math.min(...sellerProductPrices) : undefined;
  const product = detectProduct(allText);
  const packaging = detectPackaging(allText);

  const nextActions: string[] = [];
  if (/send PI/i.test(allText)) nextActions.push("Send PI with agreed price, packaging fee, and T/T payment terms.");
  if (/quote/i.test(allText)) nextActions.push("Prepare formal quotation with product models and add-on packaging fees.");
  if (nextActions.length === 0) nextActions.push("Confirm MOQ, price acceptance, and next buyer decision date.");

  return {
    conversation_id: conversation.conversation_id,
    customer_profile: {
      company_name: conversation.buyer.company_name,
      country: conversation.buyer.country,
      city: conversation.buyer.city,
      contact_person: conversation.buyer.display_name,
      role: conversation.buyer.claimed_role,
      email: conversation.buyer.email,
      website: conversation.buyer.website,
      company_evidence_status: "needs_screening",
    },
    purchase_intent: [
      {
        product,
        models: detectModels(allText),
        quantity,
        packaging,
        target_price_usd: targetPrice,
        seller_best_price_usd: sellerBestPrice,
        packaging_addon_usd: packagingAddon ? Number(packagingAddon) : undefined,
        incoterm: detectIncoterm(allText),
        payment_terms: detectPaymentTerms(allText),
        logistics_terms: /Hamburg/i.test(allText)
          ? "Delivery to Hamburg warehouse requested."
          : /FBA/i.test(allText)
            ? "Amazon FBA labeling requested."
            : undefined,
      },
    ],
    negotiated_prices: [
      {
        product,
        quoted_price_usd: sellerPrices[0],
        target_price_usd: targetPrice,
        agreed_or_best_price_usd: sellerBestPrice,
        currency: "USD",
        notes: packagingAddon
          ? `Packaging add-on USD ${packagingAddon} per piece was discussed.`
          : "Negotiation extracted from Accio fixture messages.",
      },
    ],
    negotiation_summary: `${conversation.buyer.company_name} discussed ${product}; extracted quantity ${quantity ?? "unknown"} and seller best price ${
      sellerBestPrice ?? "unknown"
    } USD.`,
    next_actions: nextActions,
    behavior_signals: {
      inquiry_professionalism_points: /certificates|PI|payment|warehouse|FBA|packaging/i.test(allText) ? 8 : 6,
      responsiveness_points: conversation.messages.length >= 4 ? 8 : 6,
      notes: "Buyer asked concrete product, quantity, price, logistics, or certification questions in the Accio fixture.",
    },
    source_references: [
      {
        source_type: "demo_fixture",
        source_file: chatExport.export_metadata.source_file,
        conversation_id: conversation.conversation_id,
      },
    ],
  };
}

async function summarizeAccioChat(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(SummarizeAccioChatInputShape).parse(rawArgs);
  const chatExport = AccioChatExportSchema.parse(args.chat_export);
  const conversations = args.conversation_id
    ? chatExport.conversations.filter((conversation) => conversation.conversation_id === args.conversation_id)
    : chatExport.conversations;
  if (conversations.length === 0) {
    throw new Error(`Conversation not found: ${args.conversation_id}`);
  }
  const summaries = conversations.map((conversation) => summarizeConversation(chatExport, conversation));
  return source(
    ctx,
    {
      status: "summarized",
      summary_count: summaries.length,
      summaries,
    },
    {
      sourceUrl: `https://sentura.local/fixtures/${encodeURIComponent(chatExport.export_metadata.source_file)}`,
      sourceType: "demo_fixture",
      confidence: 0.86,
    },
  );
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "cbe_intel_company_registry_search",
    title: "Company Registry Search",
    description:
      "Search low-cost company registry sources. Uses Companies House for GB when configured, OpenCorporates only when a paid key exists, otherwise returns a public-web registry fallback query.",
    endpoint: "GET /search/companies or public-web fallback",
    inputShape: CompanyRegistrySearchInputShape,
    handler: companyRegistrySearch,
  },
  {
    name: "cbe_intel_company_profile",
    title: "Company Profile",
    description:
      "Fetch a company profile from a known registry source when a supported API key is configured, or return a registry URL review stub.",
    endpoint: "GET /company/{companyNumber}",
    inputShape: CompanyProfileInputShape,
    handler: companyProfile,
  },
  {
    name: "cbe_intel_domain_rdap_lookup",
    title: "Domain RDAP Lookup",
    description: "Look up domain registration evidence through RDAP.org for low-volume Phase-1 screening.",
    endpoint: "GET /domain/{domain}",
    inputShape: DomainRdapLookupInputShape,
    handler: domainRdapLookup,
  },
  {
    name: "cbe_intel_email_domain_check",
    title: "Email Domain Check",
    description:
      "Check email/domain syntax, free/disposable provider flags, role inboxes, MX, SPF, DMARC, and optional paid email validation.",
    endpoint: "DNS MX/TXT + optional email validation API",
    inputShape: EmailDomainCheckInputShape,
    handler: emailDomainCheck,
  },
  {
    name: "cbe_intel_sec_lookup",
    title: "SEC EDGAR Lookup",
    description:
      "Fetch SEC company submissions by numeric CIK for US public-company candidates. Pads CIK to 10 digits and sends a configured User-Agent.",
    endpoint: "GET /submissions/CIK##########.json",
    inputShape: SecLookupInputShape,
    handler: secLookup,
  },
  {
    name: "cbe_intel_trade_record_search",
    title: "Trade Record Search",
    description:
      "Search optional paid trade-data providers only when keys and budget are configured; otherwise return weak public-web evidence guidance.",
    endpoint: "Volza/ImportYeti optional paid API or public-web fallback",
    inputShape: TradeRecordSearchInputShape,
    handler: tradeRecordSearch,
  },
  {
    name: "cbe_intel_score_buyer",
    title: "Contextual Buyer Score",
    description:
      "Compute deterministic Phase-1 contextual buyer score, excluding not-applicable blocks and separating normalized score from evidence coverage.",
    endpoint: "local deterministic scoring",
    inputShape: ScoreBuyerInputShape,
    handler: scoreBuyer,
  },
  {
    name: "cbe_intel_parse_accio_chat",
    title: "Parse Accio Chat Export",
    description: "Validate and normalize an Alibaba Accio-style JSON chat export fixture.",
    endpoint: "local Accio fixture parser",
    inputShape: ParseAccioChatInputShape,
    handler: parseAccioChat,
  },
  {
    name: "cbe_intel_summarize_accio_chat",
    title: "Summarize Accio Chat",
    description:
      "Summarize Accio conversations into company profile, requested goods, negotiated prices, behavior signals, and next actions.",
    endpoint: "local Accio fixture summarizer",
    inputShape: SummarizeAccioChatInputShape,
    handler: summarizeAccioChat,
  },
];

export function listTools() {
  return TOOLS;
}
