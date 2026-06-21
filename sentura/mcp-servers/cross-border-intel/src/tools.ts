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
  GoogleAddressValidateInputShape,
  GoogleGeocodeInputShape,
  GooglePlaceDetailsInputShape,
  GooglePlacesSearchInputShape,
  OfficialContactEmailSearchInputShape,
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

const GOOGLE_PLACES_SEARCH_FIELD_MASKS = {
  lead_discovery_list:
    "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.googleMapsUri",
} as const;

const GOOGLE_PLACE_DETAILS_FIELD_MASKS = {
  lead_discovery_basic:
    "id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,businessStatus,types,rating,userRatingCount,regularOpeningHours,googleMapsUri",
  screening_local_presence:
    "id,displayName,formattedAddress,websiteUri,businessStatus,types,rating,userRatingCount,regularOpeningHours,googleMapsUri",
  screening_address_footprint:
    "id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,internationalPhoneNumber,businessStatus,types,regularOpeningHours,googleMapsUri",
} as const;

function googleUnavailable(ctx: ToolContext, payload: Record<string, unknown>, sourceType = "google_maps_places") {
  return source(
    ctx,
    {
      status: "unavailable_api",
      provider: "google_maps",
      note: "GOOGLE_MAPS_API_KEY is not configured for the cross-border-intel MCP server.",
      ...payload,
    },
    {
      sourceUrl: "https://mapsplatform.google.com/",
      sourceType,
      confidence: 0.1,
    },
  );
}

function googleApiStatus(response: Response, providerStatus?: string): "found" | "validated" | "not_found" | "rate_limited" | "api_error" {
  if (response.status === 429 || providerStatus === "OVER_QUERY_LIMIT" || providerStatus === "RESOURCE_EXHAUSTED") {
    return "rate_limited";
  }
  if (!response.ok || providerStatus === "REQUEST_DENIED" || providerStatus === "INVALID_REQUEST") {
    return "api_error";
  }
  if (providerStatus === "ZERO_RESULTS" || providerStatus === "NOT_FOUND") {
    return "not_found";
  }
  return "found";
}

function googleDisplayName(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return firstString(record.text);
}

function googlePlaceId(value: unknown): string | undefined {
  const record = asRecord(value);
  return firstString(record.id) ?? firstString(record.name)?.replace(/^places\//, "");
}

function googleMapsUri(placeId: string | undefined, value: unknown): string {
  return firstString(value) ?? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId ?? "")}`;
}

function normalizeGoogleLocation(value: unknown) {
  const record = asRecord(value);
  const latitude =
    typeof record.latitude === "number" ? record.latitude : typeof record.lat === "number" ? record.lat : undefined;
  const longitude =
    typeof record.longitude === "number" ? record.longitude : typeof record.lng === "number" ? record.lng : undefined;
  return latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;
}

function normalizeGoogleOpeningHours(value: unknown) {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return undefined;
  const weekdayDescriptions = Array.isArray(record.weekdayDescriptions)
    ? record.weekdayDescriptions.filter((item): item is string => typeof item === "string").slice(0, 7)
    : [];
  return {
    open_now: typeof record.openNow === "boolean" ? record.openNow : undefined,
    weekday_descriptions: weekdayDescriptions,
  };
}

function normalizeGooglePlace(raw: unknown) {
  const record = asRecord(raw);
  const placeId = googlePlaceId(record);
  const mapsUri = googleMapsUri(placeId, record.googleMapsUri);
  return {
    google_place_id: placeId,
    display_name: googleDisplayName(record.displayName),
    formatted_address: firstString(record.formattedAddress),
    location: normalizeGoogleLocation(record.location),
    types: Array.isArray(record.types) ? record.types.filter((item): item is string => typeof item === "string").slice(0, 12) : [],
    business_status: firstString(record.businessStatus),
    google_maps_uri: mapsUri,
    website_uri: firstString(record.websiteUri),
    national_phone_number: firstString(record.nationalPhoneNumber),
    international_phone_number: firstString(record.internationalPhoneNumber),
    rating: typeof record.rating === "number" ? record.rating : undefined,
    user_rating_count: typeof record.userRatingCount === "number" ? record.userRatingCount : undefined,
    regular_opening_hours: normalizeGoogleOpeningHours(record.regularOpeningHours),
    source_attribution_required: true,
  };
}

function googleCircle(value: { latitude: number; longitude: number; radius_meters: number }) {
  return {
    circle: {
      center: {
        latitude: value.latitude,
        longitude: value.longitude,
      },
      radius: value.radius_meters,
    },
  };
}

function cappedGoogleResultCount(ctx: ToolContext, requested: number) {
  return Math.min(requested, ctx.config.googleMapsMaxResultsPerSearch, 20);
}

function sanitizedGoogleUrl(url: URL): string {
  const clone = new URL(url.toString());
  if (clone.searchParams.has("key")) clone.searchParams.set("key", "REDACTED");
  return clone.toString();
}

async function googlePlacesSearch(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(GooglePlacesSearchInputShape).parse(rawArgs);
  if (!ctx.config.googleMapsApiKey) {
    return googleUnavailable(ctx, { endpoint: "places_search", candidates: [] });
  }
  if (args.mode === "text" && !args.text_query) {
    throw new Error("google_places_search text mode requires text_query.");
  }
  if (args.mode === "nearby" && !args.location_restriction) {
    throw new Error("google_places_search nearby mode requires location_restriction.");
  }

  const maxResultCount = cappedGoogleResultCount(ctx, args.max_result_count);
  const endpoint = args.mode === "nearby" ? "/places:searchNearby" : "/places:searchText";
  const url = joinUrl(ctx.config.googleMapsPlacesBaseUrl, endpoint);
  const fieldMask = GOOGLE_PLACES_SEARCH_FIELD_MASKS[args.field_mask_profile];
  const effectiveQuery = [args.text_query, args.city_or_region, args.country].filter(Boolean).join(" ").trim();
  const body: Record<string, unknown> = {
    maxResultCount,
    languageCode: args.language_code,
    regionCode: args.region_code ?? args.country,
  };

  if (args.mode === "nearby") {
    const restriction = args.location_restriction;
    if (!restriction) throw new Error("google_places_search nearby mode requires location_restriction.");
    body.locationRestriction = googleCircle(restriction);
    if (args.included_types.length > 0) body.includedTypes = args.included_types;
  } else {
    body.textQuery = effectiveQuery;
    if (args.included_types[0]) body.includedType = args.included_types[0];
    if (args.location_bias) body.locationBias = googleCircle(args.location_bias);
    if (args.location_restriction) body.locationRestriction = googleCircle(args.location_restriction);
  }

  const { response, body: responseBody } = await fetchJson(ctx, url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": ctx.config.googleMapsApiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  const record = asRecord(responseBody);
  const places = Array.isArray(record.places) ? record.places.slice(0, maxResultCount).map(normalizeGooglePlace) : [];
  const status = response.ok ? (places.length > 0 ? "found" : "not_found") : googleApiStatus(response);
  return source(
    ctx,
    {
      status,
      provider: "google_maps_places",
      endpoint: args.mode === "nearby" ? "POST /places:searchNearby" : "POST /places:searchText",
      http_status: response.status,
      query: {
        mode: args.mode,
        text_query: args.text_query,
        effective_text_query: effectiveQuery || undefined,
        country: args.country,
        city_or_region: args.city_or_region,
        included_types: args.included_types,
      },
      field_mask_profile: args.field_mask_profile,
      field_mask: fieldMask,
      max_result_count: maxResultCount,
      candidates: places,
      attribution: {
        google_maps_uri_required: true,
        raw_reviews_or_photos_retained: false,
      },
      api_call_ledger: {
        provider: "google_maps_places",
        endpoint: args.mode === "nearby" ? "places:searchNearby" : "places:searchText",
        field_mask_profile: args.field_mask_profile,
        request_units: 1,
        cost_posture: "google_maps_billed_or_included",
        status,
      },
    },
    {
      sourceUrl: places[0]?.google_maps_uri ?? "https://developers.google.com/maps/documentation/places/web-service",
      sourceType: "google_maps_places",
      confidence: response.ok ? (places.length > 0 ? 0.72 : 0.35) : 0.18,
    },
  );
}

async function googlePlaceDetails(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(GooglePlaceDetailsInputShape).parse(rawArgs);
  if (!ctx.config.googleMapsApiKey) {
    return googleUnavailable(ctx, { endpoint: "place_details", place_id: args.place_id, details: null });
  }
  const placeId = args.place_id.replace(/^places\//, "");
  const url = joinUrl(ctx.config.googleMapsPlacesBaseUrl, `/places/${encodeURIComponent(placeId)}`);
  const fieldMask = GOOGLE_PLACE_DETAILS_FIELD_MASKS[args.field_mask_profile];
  const { response, body } = await fetchJson(ctx, url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Goog-Api-Key": ctx.config.googleMapsApiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  const details = response.ok ? normalizeGooglePlace(body) : null;
  const status = response.ok ? "found" : googleApiStatus(response);
  return source(
    ctx,
    {
      status,
      provider: "google_maps_places",
      endpoint: "GET /places/{place_id}",
      purpose: args.purpose,
      http_status: response.status,
      place_id: placeId,
      field_mask_profile: args.field_mask_profile,
      field_mask: fieldMask,
      details,
      attribution: {
        google_maps_uri_required: true,
        raw_reviews_or_photos_retained: false,
      },
      api_call_ledger: {
        provider: "google_maps_places",
        endpoint: "places/{place_id}",
        field_mask_profile: args.field_mask_profile,
        request_units: 1,
        cost_posture: "google_maps_billed_or_included",
        status,
      },
    },
    {
      sourceUrl: details?.google_maps_uri ?? googleMapsUri(placeId, undefined),
      sourceType: "google_maps_places",
      confidence: response.ok ? 0.78 : 0.18,
    },
  );
}

async function googleGeocode(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(GoogleGeocodeInputShape).parse(rawArgs);
  if (!ctx.config.googleMapsApiKey) {
    return googleUnavailable(ctx, { endpoint: "geocode", results: [] }, "google_maps_geocoding");
  }
  const url = new URL(ctx.config.googleMapsGeocodingBaseUrl);
  url.searchParams.set("address", args.country ? `${args.address}, ${args.country}` : args.address);
  url.searchParams.set("key", ctx.config.googleMapsApiKey);
  if (args.language_code) url.searchParams.set("language", args.language_code);
  if (args.region_code ?? args.country) url.searchParams.set("region", (args.region_code ?? args.country)?.toLowerCase() ?? "");

  const { response, body } = await fetchJson(ctx, url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const record = asRecord(body);
  const providerStatus = firstString(record.status);
  const rawResults = Array.isArray(record.results) ? record.results.slice(0, args.max_results) : [];
  const results = rawResults.map((result) => {
    const resultRecord = asRecord(result);
    const geometry = asRecord(resultRecord.geometry);
    return {
      formatted_address: firstString(resultRecord.formatted_address),
      place_id: firstString(resultRecord.place_id),
      types: Array.isArray(resultRecord.types) ? resultRecord.types.filter((item): item is string => typeof item === "string") : [],
      location: normalizeGoogleLocation(asRecord(geometry.location)),
      location_type: firstString(geometry.location_type),
      partial_match: typeof resultRecord.partial_match === "boolean" ? resultRecord.partial_match : undefined,
    };
  });
  const status = providerStatus === "OK" ? "found" : googleApiStatus(response, providerStatus);
  return source(
    ctx,
    {
      status,
      provider: "google_maps_geocoding",
      endpoint: "GET /maps/api/geocode/json",
      http_status: response.status,
      provider_status: providerStatus,
      query: {
        address: args.address,
        country: args.country,
        region_code: args.region_code,
      },
      results,
      attribution: {
        google_maps_uri_required: true,
        raw_response_retained: false,
      },
      api_call_ledger: {
        provider: "google_maps_geocoding",
        endpoint: "geocode/json",
        request_units: 1,
        cost_posture: "google_maps_billed_or_included",
        status,
      },
    },
    {
      sourceUrl: sanitizedGoogleUrl(url),
      sourceType: "google_maps_geocoding",
      confidence: status === "found" ? 0.7 : 0.2,
    },
  );
}

async function googleAddressValidate(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(GoogleAddressValidateInputShape).parse(rawArgs);
  if (!ctx.config.googleMapsApiKey) {
    return googleUnavailable(
      ctx,
      { endpoint: "address_validation", address_lines: args.address_lines, validation: null },
      "google_maps_address_validation",
    );
  }
  const url = new URL(ctx.config.googleMapsAddressValidationBaseUrl);
  url.searchParams.set("key", ctx.config.googleMapsApiKey);
  const requestBody = {
    address: {
      regionCode: args.region_code,
      languageCode: args.language_code,
      locality: args.locality,
      administrativeArea: args.administrative_area,
      postalCode: args.postal_code,
      addressLines: args.address_lines,
    },
    enableUspsCass: args.enable_usps_cass,
  };
  const { response, body } = await fetchJson(ctx, url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  const result = asRecord(asRecord(body).result);
  const verdict = asRecord(result.verdict);
  const address = asRecord(result.address);
  const geocode = asRecord(result.geocode);
  const metadata = asRecord(result.metadata);
  const status = response.ok ? "validated" : googleApiStatus(response);
  const addressComplete = verdict.addressComplete === true;
  const hasUnconfirmed = verdict.hasUnconfirmedComponents === true;
  return source(
    ctx,
    {
      status,
      provider: "google_maps_address_validation",
      endpoint: "POST /v1:validateAddress",
      http_status: response.status,
      address_lines: args.address_lines,
      validation: response.ok
        ? {
            address_complete: addressComplete,
            has_unconfirmed_components: hasUnconfirmed,
            has_inferred_components: verdict.hasInferredComponents === true,
            has_replaced_components: verdict.hasReplacedComponents === true,
            possible_next_action: firstString(verdict.possibleNextAction),
            formatted_address: firstString(address.formattedAddress),
            postal_address: asRecord(address.postalAddress),
            missing_component_types: Array.isArray(address.missingComponentTypes) ? address.missingComponentTypes : [],
            unconfirmed_component_types: Array.isArray(address.unconfirmedComponentTypes)
              ? address.unconfirmedComponentTypes
              : [],
            unresolved_tokens: Array.isArray(address.unresolvedTokens) ? address.unresolvedTokens : [],
            geocode: {
              place_id: firstString(geocode.placeId),
              location: normalizeGoogleLocation(geocode.location),
              plus_code: asRecord(geocode.plusCode),
            },
            metadata: {
              business: typeof metadata.business === "boolean" ? metadata.business : undefined,
              residential: typeof metadata.residential === "boolean" ? metadata.residential : undefined,
            },
            usps_data_available: Boolean(result.uspsData),
          }
        : null,
      attribution: {
        raw_response_retained: false,
      },
      api_call_ledger: {
        provider: "google_maps_address_validation",
        endpoint: "v1:validateAddress",
        request_units: 1,
        cost_posture: "google_maps_billed_or_included",
        status,
      },
    },
    {
      sourceUrl: sanitizedGoogleUrl(url),
      sourceType: "google_maps_address_validation",
      confidence: response.ok ? (addressComplete && !hasUnconfirmed ? 0.75 : 0.45) : 0.18,
    },
  );
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

const CONTACT_PAGE_PATHS = [
  "/",
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/support",
  "/customer-service",
  "/sales",
  "/wholesale",
];

function emailDomain(email: string): string {
  return normalizeDomain(email.split("@")[1] ?? "");
}

function roleEmailLocalPart(email: string): boolean {
  return ROLE_EMAIL_LOCAL_PARTS.has(email.split("@")[0]?.toLowerCase() ?? "");
}

function baseWebsiteUrl(domain: string, website: string | undefined): URL {
  const raw = website?.trim() || `https://${domain}`;
  return new URL(raw.includes("://") ? raw : `https://${raw}`);
}

function contactPageUrls(domain: string, website: string | undefined, maxPages: number): string[] {
  const base = baseWebsiteUrl(domain, website);
  const urls = new Set<string>();
  for (const path of CONTACT_PAGE_PATHS) {
    const next = new URL(path, base.origin);
    urls.add(next.toString());
    if (urls.size >= maxPages) break;
  }
  return Array.from(urls);
}

function extractEmails(text: string, domain: string, sourceUrl: string) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const normalizedTargetDomain = normalizeDomain(domain);
  return Array.from(new Set(matches.map((email) => email.toLowerCase()))).flatMap((email) => {
    const foundDomain = emailDomain(email);
    const domainMatch = foundDomain === normalizedTargetDomain || foundDomain.endsWith(`.${normalizedTargetDomain}`);
    if (!domainMatch) return [];
    return {
      email,
      domain: foundDomain,
      source_url: sourceUrl,
      local_part_role: roleEmailLocalPart(email),
    };
  });
}

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

  const paidValidationProviders: Array<Record<string, unknown>> = [];
  if (args.enable_paid_validation && ctx.config.abstractApiKey && email) {
    const url = new URL(ctx.config.abstractBaseUrl);
    url.searchParams.set("api_key", ctx.config.abstractApiKey);
    url.searchParams.set("email", email);
    const { response, body } = await fetchJson(ctx, url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    paidValidationProviders.push({
      provider: "abstract",
      http_status: response.status,
      result: body,
      source_url: "https://docs.abstractapi.com/api/email-reputation",
      source_type: "official_api",
    });
  }
  if (args.enable_paid_validation && ctx.config.hunterApiKey && email) {
    const url = new URL(joinUrl(ctx.config.hunterBaseUrl, "/email-verifier"));
    url.searchParams.set("email", email);
    url.searchParams.set("api_key", ctx.config.hunterApiKey);
    const { response, body } = await fetchJson(ctx, url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    paidValidationProviders.push({
      provider: "hunter",
      endpoint: "GET /v2/email-verifier",
      http_status: response.status,
      result: body,
      source_url: "https://hunter.io/api-documentation/v2#email-verifier",
      source_type: "official_api",
    });
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
      paid_validation:
        paidValidationProviders.length > 0
          ? {
              providers: paidValidationProviders,
            }
          : undefined,
    },
    { sourceUrl: `https://${domain}`, sourceType: "public_dns", confidence },
  );
}

async function officialContactEmailSearch(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(OfficialContactEmailSearchInputShape).parse(rawArgs);
  const domain = normalizeDomain(args.domain);
  const urls = contactPageUrls(domain, args.website, args.max_pages);
  const checkedUrls: Array<{ url: string; http_status?: number; error?: string }> = [];
  const emails: Array<{ email: string; domain: string; source_url: string; local_part_role: boolean }> = [];

  for (const url of urls) {
    try {
      const { response, body } = await fetchJson(ctx, url, {
        method: "GET",
        headers: {
          Accept: "text/html, text/plain;q=0.9,*/*;q=0.8",
        },
      });
      checkedUrls.push({ url, http_status: response.status });
      if (!response.ok) continue;
      const text = typeof body === "string" ? body : JSON.stringify(body);
      emails.push(...extractEmails(text, domain, url));
    } catch (err) {
      checkedUrls.push({ url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const uniqueEmails = Array.from(new Map(emails.map((email) => [email.email, email])).values());
  return source(
    ctx,
    {
      status: uniqueEmails.length > 0 ? "found" : "not_found",
      domain,
      checked_urls: checkedUrls,
      emails: uniqueEmails,
      note:
        uniqueEmails.length > 0
          ? "Found public same-domain contact emails on the target's official website pages. Validate selected addresses with cbe_intel_email_domain_check when paid validation is enabled."
          : "No public same-domain contact email was found on the checked official website pages.",
    },
    {
      sourceUrl: uniqueEmails[0]?.source_url ?? urls[0] ?? `https://${domain}`,
      sourceType: "public_web",
      confidence: uniqueEmails.length > 0 ? 0.72 : 0.35,
    },
  );
}

function padCik(cik: string): string {
  return cik.padStart(10, "0");
}

function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|corp|corporation|company|co|ltd|llc|plc|holdings|group|international)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function secCompanyCandidates(body: unknown) {
  return Object.values(asRecord(body)).flatMap((entry) => {
    const record = asRecord(entry);
    const cik = typeof record.cik_str === "number" || typeof record.cik_str === "string" ? String(record.cik_str) : undefined;
    const title = firstString(record.title);
    const ticker = firstString(record.ticker);
    return cik && title ? [{ cik, title, ticker }] : [];
  });
}

function secRecentFilingsSummary(record: Record<string, unknown>) {
  const filings = asRecord(record.filings);
  const recent = asRecord(filings.recent);
  const forms = Array.isArray(recent.form) ? recent.form : [];
  const filingDates = Array.isArray(recent.filingDate) ? recent.filingDate : [];
  const reportDates = Array.isArray(recent.reportDate) ? recent.reportDate : [];
  const accessionNumbers = Array.isArray(recent.accessionNumber) ? recent.accessionNumber : [];
  const primaryDocuments = Array.isArray(recent.primaryDocument) ? recent.primaryDocument : [];
  const primaryDocDescriptions = Array.isArray(recent.primaryDocDescription)
    ? recent.primaryDocDescription
    : [];
  const recentFilings = forms.slice(0, 8).map((form, index) => ({
    form,
    filing_date: filingDates[index],
    report_date: reportDates[index],
    accession_number: accessionNumbers[index],
    primary_document: primaryDocuments[index],
    description: primaryDocDescriptions[index],
  }));
  return {
    recent_filing_count: forms.length,
    recent_forms: Array.from(new Set(forms.map(String))).slice(0, 12),
    recent_filings: recentFilings,
  };
}

async function resolveSecCikByCompanyName(ctx: ToolContext, companyName: string) {
  const url = "https://www.sec.gov/files/company_tickers.json";
  const { response, body } = await fetchJson(ctx, url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": ctx.config.secUserAgent,
    },
  });
  if (!response.ok) {
    return { response, url, match: undefined };
  }
  const normalizedQuery = normalizeCompanyName(companyName);
  const candidates = secCompanyCandidates(body);
  const match =
    candidates.find((candidate) => normalizeCompanyName(candidate.title) === normalizedQuery) ??
    candidates.find((candidate) => {
      const normalizedTitle = normalizeCompanyName(candidate.title);
      return normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle);
    });
  return { response, url, match };
}

async function secLookup(ctx: ToolContext, rawArgs: unknown) {
  const args = z.object(SecLookupInputShape).parse(rawArgs);
  let cik = args.cik;
  let resolution: Awaited<ReturnType<typeof resolveSecCikByCompanyName>> | undefined;
  if (!cik && args.company_name) {
    resolution = await resolveSecCikByCompanyName(ctx, args.company_name);
    cik = resolution.match?.cik;
    if (!cik) {
      return source(
        ctx,
        {
          status: "not_found",
          company_name: args.company_name,
          endpoint: "GET /files/company_tickers.json",
          http_status: resolution.response.status,
          note: "No SEC company_tickers.json CIK match was found for this company name. Treat as not applicable for private/non-filer targets, not as negative evidence.",
        },
        { sourceUrl: resolution.url, sourceType: "official_api", confidence: 0.35 },
      );
    }
  }
  if (!cik) {
    throw new Error("sec_lookup requires either cik or company_name.");
  }
  const padded = padCik(cik);
  const url = joinUrl(ctx.config.secBaseUrl, `/submissions/CIK${padded}.json`);
  const { response, body } = await fetchJson(ctx, url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": ctx.config.secUserAgent,
    },
  });
  const record = asRecord(body);
  const filingsSummary = secRecentFilingsSummary(record);
  return source(
    ctx,
    {
      status: response.ok ? "found" : "api_error",
      cik: padded,
      endpoint: "GET /submissions/CIK##########.json",
      http_status: response.status,
      resolved_from_company_name: args.company_name,
      resolver_endpoint: resolution ? "GET /files/company_tickers.json" : undefined,
      resolver_http_status: resolution?.response.status,
      matched_ticker: resolution?.match?.ticker,
      matched_title: resolution?.match?.title,
      entity_name: firstString(record.name),
      sic: firstString(record.sic),
      tickers: Array.isArray(record.tickers) ? record.tickers : [],
      exchanges: Array.isArray(record.exchanges) ? record.exchanges : [],
      fiscal_year_end: firstString(record.fiscalYearEnd),
      state_of_incorporation: firstString(record.stateOfIncorporation),
      submissions_summary: filingsSummary,
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
    const url = new URL(joinUrl(ctx.config.importYetiBaseUrl, "/v1.0/company/search"));
    url.searchParams.set("name", args.company_name);
    url.searchParams.set("page_size", String(args.max_records));
    const { response, body } = await fetchJson(ctx, url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        IYApiKey: ctx.config.importYetiApiKey,
      },
    });
    return source(
      ctx,
      {
        status: response.ok ? "found" : "api_error",
        provider: "importyeti",
        endpoint: "GET /v1.0/company/search",
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

function quantityFromMatch(match: RegExpMatchArray | null): number | undefined {
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function detectMonthlyPotentialQuantity(text: string): number | undefined {
  return quantityFromMatch(text.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*pcs\s+monthly/i));
}

function detectMainQuantity(product: string, allText: string, buyerText: string, sellerText: string): number | undefined {
  const totalQuantity = quantityFromMatch(sellerText.match(/total\s+(\d{1,3}(?:,\d{3})+|\d+)\s*pcs/i));
  if (totalQuantity) return totalQuantity;

  const orderQuantity = quantityFromMatch(
    buyerText.match(/(?:order|quote|need|initial quantity|start with)\s+(\d{1,3}(?:,\d{3})+|\d+)\s*pcs/i),
  );
  if (orderQuantity) return orderQuantity;

  if (product === "clear MagSafe phone cases") {
    const quotedModelQuantities = numbersFromText(buyerText).filter((quantity) => quantity !== detectMonthlyPotentialQuantity(buyerText));
    const summedQuoteQuantity = quotedModelQuantities.reduce((sum, value) => sum + value, 0);
    if (summedQuoteQuantity > 0) return summedQuoteQuantity;
  }

  const buyerQuantities = numbersFromText(buyerText).filter((quantity) => quantity !== detectMonthlyPotentialQuantity(buyerText));
  if (buyerQuantities.length > 0) return Math.max(...buyerQuantities);

  const allQuantities = numbersFromText(allText).filter((quantity) => quantity !== detectMonthlyPotentialQuantity(allText));
  return allQuantities.length > 0 ? Math.max(...allQuantities) : undefined;
}

function detectSellerBestPrice(sellerText: string, sellerProductPrices: number[]): number | undefined {
  const explicitBest = sellerText.match(/best price is USD\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (explicitBest?.[1]) return Number(explicitBest[1]);

  const totalQuote = sellerText.match(/total\s+\d{1,3}(?:,\d{3})*\s*pcs\s+can be USD\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (totalQuote?.[1]) return Number(totalQuote[1]);

  const exwQuote = sellerText.match(/\bEXW price USD\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (exwQuote?.[1]) return Number(exwQuote[1]);

  return sellerProductPrices.length > 0 ? Math.min(...sellerProductPrices) : undefined;
}

function detectPackagingAddon(sellerText: string): number | undefined {
  const addonMatches = [
    ...sellerText.matchAll(/(?:packaging|barcode sticker)[^.]{0,80}?USD\s*([0-9]+(?:\.[0-9]+)?)/gi),
    ...sellerText.matchAll(/USD\s*([0-9]+(?:\.[0-9]+)?)[^.]{0,80}?(?:packaging|barcode sticker)/gi),
  ];
  const addonPrices = addonMatches.map((match) => Number(match[1])).filter(Number.isFinite);
  return addonPrices.length > 0 ? Math.max(...addonPrices) : undefined;
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

function detectCertificationTerms(text: string): string | undefined {
  if (/CE\s*(?:and|\/)\s*RoHS|CE\/RoHS/i.test(text)) return "CE and RoHS certificates requested or available.";
  return undefined;
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
  const buyerPrices = pricesFromText(buyerText);
  const sellerPrices = pricesFromText(sellerText);
  const explicitTargetPrice = buyerText.match(/can\s+(?:you|we)[^.?!]{0,80}?USD\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  const sellerProductPrices = sellerPrices.filter((price) => price >= 0.1);
  const targetPrice = explicitTargetPrice
    ? Number(explicitTargetPrice)
    : buyerPrices.length > 0
      ? Math.max(...buyerPrices)
      : undefined;
  const product = detectProduct(allText);
  const quantity = detectMainQuantity(product, allText, buyerText, sellerText);
  const monthlyPotentialQuantity = detectMonthlyPotentialQuantity(allText);
  const sellerBestPrice = detectSellerBestPrice(sellerText, sellerProductPrices);
  const packagingAddon = detectPackagingAddon(sellerText);
  const packaging = detectPackaging(allText);

  const nextActions: string[] = [];
  if (/send PI/i.test(allText)) nextActions.push("Send PI with agreed price, packaging fee, and T/T payment terms.");
  if (/CE|RoHS|Hamburg/i.test(allText)) nextActions.push("Confirm trial-order MOQ and send CE/RoHS certificate plus Hamburg delivery details.");
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
        monthly_potential_quantity: monthlyPotentialQuantity,
        packaging,
        target_price_usd: targetPrice,
        seller_best_price_usd: sellerBestPrice,
        packaging_addon_usd: packagingAddon,
        incoterm: detectIncoterm(allText),
        payment_terms: detectPaymentTerms(allText),
        logistics_terms: /Hamburg/i.test(allText)
          ? "Delivery to Hamburg warehouse requested."
          : /FBA/i.test(allText)
            ? "Amazon FBA labeling requested."
            : undefined,
        certification_terms: detectCertificationTerms(allText),
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
          ? `Packaging or labeling add-on up to USD ${packagingAddon} per piece was discussed.`
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
    name: "cbe_intel_official_contact_email_search",
    title: "Official Contact Email Search",
    description:
      "Fetch a small set of public official website pages and extract same-domain contact emails for optional paid validation.",
    endpoint: "GET official website contact/about pages",
    inputShape: OfficialContactEmailSearchInputShape,
    handler: officialContactEmailSearch,
  },
  {
    name: "cbe_intel_google_places_search",
    title: "Google Maps Places Search",
    description:
      "Search Google Maps Places API (New) Text Search or Nearby Search for storefront/local-business lead seeds with narrow field masks, request caps, source attribution, and no raw review/photo retention.",
    endpoint: "POST /places:searchText or POST /places:searchNearby",
    inputShape: GooglePlacesSearchInputShape,
    handler: googlePlacesSearch,
  },
  {
    name: "cbe_intel_google_place_details",
    title: "Google Maps Place Details",
    description:
      "Fetch bounded Google Maps Place Details for shortlisted place IDs only, using lead-discovery or screening local-presence field-mask profiles.",
    endpoint: "GET /places/{place_id}",
    inputShape: GooglePlaceDetailsInputShape,
    handler: googlePlaceDetails,
  },
  {
    name: "cbe_intel_google_geocode",
    title: "Google Maps Geocode",
    description:
      "Geocode city or address seeds for Nearby Search preparation and address consistency checks. This is not buyer verification by itself.",
    endpoint: "GET /maps/api/geocode/json",
    inputShape: GoogleGeocodeInputShape,
    handler: googleGeocode,
  },
  {
    name: "cbe_intel_google_address_validate",
    title: "Google Maps Address Validate",
    description:
      "Validate public business address evidence through Google Address Validation API for screening address-consistency support only.",
    endpoint: "POST /v1:validateAddress",
    inputShape: GoogleAddressValidateInputShape,
    handler: googleAddressValidate,
  },
  {
    name: "cbe_intel_sec_lookup",
    title: "SEC EDGAR Lookup",
    description:
      "Resolve SEC CIK by company name when needed, then fetch SEC company submissions for US public-company candidates. Pads CIK to 10 digits and sends a configured User-Agent.",
    endpoint: "GET /files/company_tickers.json + GET /submissions/CIK##########.json",
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
