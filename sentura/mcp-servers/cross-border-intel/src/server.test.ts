import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "./index.js";
import type { CrossBorderIntelConfig } from "./config.js";
import type { DnsResolver, FetchLike } from "./tools.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIXTURE = path.join(ROOT, "跨境电商/fixtures/accio-chat-records.sample.json");
const NOW = new Date("2026-06-08T10:00:00.000Z");

async function connect(options: {
  fetchFn?: FetchLike;
  dnsResolver?: DnsResolver;
  config?: Partial<CrossBorderIntelConfig>;
} = {}) {
  const { server } = await createServer({
    config: {
      companiesHouseApiKey: "companies-house-test-key",
      secUserAgent: "SenturaCrossBorderIntel/0.1 test-contact@example.com",
      requestTimeoutMs: 5_000,
      ...options.config,
    },
    fetchFn: options.fetchFn ?? vi.fn(async () => new Response("{}", { status: 200 })),
    dnsResolver: options.dnsResolver ?? okDnsResolver,
    now: () => NOW,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client(
    { name: "sentura-cross-border-test-agent", version: "0.0.0-test" },
    { capabilities: {} },
  );
  await client.connect(clientTransport);
  return { client, server };
}

function parseToolResult(result: Awaited<ReturnType<Client["callTool"]>>) {
  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  return JSON.parse(text) as Record<string, unknown>;
}

const okDnsResolver: DnsResolver = {
  resolveMx: async () => [{ exchange: "mx.example.com", priority: 10 }],
  resolveTxt: async (hostname) => {
    if (hostname.startsWith("_dmarc.")) return [["v=DMARC1; p=reject"]];
    return [["v=spf1 include:_spf.example.com ~all"]];
  },
};

describe("cross-border-intel MCP tool catalog", () => {
  it("exposes exactly the Milestone 3 read-only tool catalog", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "cbe_intel_company_registry_search",
      "cbe_intel_company_profile",
      "cbe_intel_domain_rdap_lookup",
      "cbe_intel_email_domain_check",
      "cbe_intel_official_contact_email_search",
      "cbe_intel_google_places_search",
      "cbe_intel_google_place_details",
      "cbe_intel_google_geocode",
      "cbe_intel_google_address_validate",
      "cbe_intel_sec_lookup",
      "cbe_intel_trade_record_search",
      "cbe_intel_score_buyer",
      "cbe_intel_parse_accio_chat",
      "cbe_intel_summarize_accio_chat",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool._meta?.["sentura/sourceDoc"]).toBe("跨境电商/DESIGN.md Milestone 3");
    }
  });
});

describe("Google Maps local-presence tools", () => {
  it("returns unavailable_api without exposing Google Maps key state when no key is configured", async () => {
    const { client } = await connect();
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_google_places_search",
        arguments: { text_query: "phone accessories wholesaler Manchester", country: "GB" },
      }),
    );
    expect(result).toMatchObject({
      status: "unavailable_api",
      provider: "google_maps",
      endpoint: "places_search",
      source_type: "google_maps_places",
    });
    expect(JSON.stringify(result)).not.toContain("GOOGLE_MAPS_API_KEY=");
  });

  it("calls Places Text Search with a narrow field mask and normalized lead candidates", async () => {
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = new URL(String(url));
      expect(u.origin).toBe("https://places.googleapis.test");
      expect(u.pathname).toBe("/v1/places:searchText");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-goog-api-key")).toBe("google-test-key");
      expect(headers.get("x-goog-fieldmask")).toBe(
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.googleMapsUri",
      );
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        textQuery: "phone accessories wholesaler Manchester GB",
        maxResultCount: 3,
        regionCode: "GB",
        includedType: "electronics_store",
      });
      return new Response(
        JSON.stringify({
          places: [
            {
              id: "ChIJ123",
              displayName: { text: "Example Phone Parts" },
              formattedAddress: "1 Market Street, Manchester, UK",
              location: { latitude: 53.4808, longitude: -2.2426 },
              types: ["electronics_store", "point_of_interest"],
              businessStatus: "OPERATIONAL",
              googleMapsUri: "https://maps.google.com/?cid=123",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const { client } = await connect({
      fetchFn,
      config: {
        googleMapsApiKey: "google-test-key",
        googleMapsPlacesBaseUrl: "https://places.googleapis.test/v1",
        googleMapsMaxResultsPerSearch: 3,
      },
    });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_google_places_search",
        arguments: {
          text_query: "phone accessories wholesaler",
          country: "GB",
          city_or_region: "Manchester",
          included_types: ["electronics_store", "store"],
          max_result_count: 10,
        },
      }),
    );
    expect(result).toMatchObject({
      status: "found",
      provider: "google_maps_places",
      endpoint: "POST /places:searchText",
      field_mask_profile: "lead_discovery_list",
      source_type: "google_maps_places",
    });
    expect(result.max_result_count).toBe(3);
    expect((result.api_call_ledger as Record<string, unknown>).field_mask_profile).toBe("lead_discovery_list");
    const candidate = (result.candidates as Array<Record<string, unknown>>)[0];
    expect(candidate).toMatchObject({
      google_place_id: "ChIJ123",
      display_name: "Example Phone Parts",
      business_status: "OPERATIONAL",
      google_maps_uri: "https://maps.google.com/?cid=123",
      source_attribution_required: true,
    });
    expect(JSON.stringify(result)).not.toContain("google-test-key");
  });

  it("calls Places Nearby Search only with locationRestriction", async () => {
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = new URL(String(url));
      expect(u.pathname).toBe("/v1/places:searchNearby");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        maxResultCount: 2,
        includedTypes: ["electronics_store"],
        locationRestriction: {
          circle: {
            center: { latitude: 40.7128, longitude: -74.006 },
            radius: 5000,
          },
        },
      });
      return new Response(JSON.stringify({ places: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const { client } = await connect({
      fetchFn,
      config: {
        googleMapsApiKey: "google-test-key",
        googleMapsPlacesBaseUrl: "https://places.googleapis.test/v1",
      },
    });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_google_places_search",
        arguments: {
          mode: "nearby",
          location_restriction: { latitude: 40.7128, longitude: -74.006, radius_meters: 5000 },
          included_types: ["electronics_store"],
          max_result_count: 2,
        },
      }),
    );
    expect(result).toMatchObject({
      status: "not_found",
      endpoint: "POST /places:searchNearby",
      source_type: "google_maps_places",
    });
  });

  it("calls Place Details with lead and screening field-mask profiles", async () => {
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = new URL(String(url));
      expect(u.pathname).toBe("/v1/places/ChIJ123");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-goog-api-key")).toBe("google-test-key");
      expect(headers.get("x-goog-fieldmask")).toBe(
        "id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,internationalPhoneNumber,businessStatus,types,regularOpeningHours,googleMapsUri",
      );
      return new Response(
        JSON.stringify({
          id: "ChIJ123",
          displayName: { text: "Example Phone Parts" },
          formattedAddress: "1 Market Street, Manchester, UK",
          websiteUri: "https://example-phone-parts.co.uk",
          internationalPhoneNumber: "+44 161 555 0100",
          businessStatus: "OPERATIONAL",
          types: ["electronics_store"],
          rating: 4.4,
          userRatingCount: 87,
          regularOpeningHours: { openNow: true, weekdayDescriptions: ["Monday: 9:00 AM - 6:00 PM"] },
          googleMapsUri: "https://maps.google.com/?cid=123",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const { client } = await connect({
      fetchFn,
      config: {
        googleMapsApiKey: "google-test-key",
        googleMapsPlacesBaseUrl: "https://places.googleapis.test/v1",
      },
    });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_google_place_details",
        arguments: { place_id: "places/ChIJ123", field_mask_profile: "screening_address_footprint", purpose: "screening" },
      }),
    );
    expect(result).toMatchObject({
      status: "found",
      endpoint: "GET /places/{place_id}",
      purpose: "screening",
      place_id: "ChIJ123",
      source_type: "google_maps_places",
    });
    expect(result.field_mask).not.toContain("reviews");
    expect(result.field_mask_profile).toBe("screening_address_footprint");
    const details = result.details as Record<string, unknown>;
    expect(details).toMatchObject({
      display_name: "Example Phone Parts",
      website_uri: "https://example-phone-parts.co.uk",
      user_rating_count: 87,
    });
    expect(JSON.stringify(result)).not.toContain("google-test-key");
  });

  it("normalizes Geocoding and Address Validation outputs without leaking query API keys", async () => {
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = new URL(String(url));
      if (u.hostname === "maps.googleapis.test") {
        expect(u.searchParams.get("key")).toBe("google-test-key");
        expect(u.searchParams.get("address")).toBe("Manchester, GB");
        return new Response(
          JSON.stringify({
            status: "OK",
            results: [
              {
                formatted_address: "Manchester, UK",
                place_id: "geo-place",
                types: ["locality", "political"],
                geometry: {
                  location: { lat: 53.4808, lng: -2.2426 },
                  location_type: "APPROXIMATE",
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (u.hostname === "addressvalidation.googleapis.test") {
        expect(u.searchParams.get("key")).toBe("google-test-key");
        const body = JSON.parse(String(init?.body)) as Record<string, Record<string, unknown>>;
        expect(body.address.addressLines).toEqual(["1 Market Street"]);
        return new Response(
          JSON.stringify({
            result: {
              verdict: { addressComplete: true, hasUnconfirmedComponents: false },
              address: {
                formattedAddress: "1 Market Street, Manchester, UK",
                postalAddress: { regionCode: "GB", locality: "Manchester", addressLines: ["1 Market Street"] },
                missingComponentTypes: [],
                unconfirmedComponentTypes: [],
              },
              geocode: {
                placeId: "validated-place",
                location: { latitude: 53.4808, longitude: -2.2426 },
              },
              metadata: { business: true, residential: false },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const { client } = await connect({
      fetchFn,
      config: {
        googleMapsApiKey: "google-test-key",
        googleMapsGeocodingBaseUrl: "https://maps.googleapis.test/maps/api/geocode/json",
        googleMapsAddressValidationBaseUrl: "https://addressvalidation.googleapis.test/v1:validateAddress",
      },
    });
    const geocode = parseToolResult(
      await client.callTool({
        name: "cbe_intel_google_geocode",
        arguments: { address: "Manchester", country: "GB" },
      }),
    );
    expect(geocode).toMatchObject({
      status: "found",
      provider: "google_maps_geocoding",
      source_type: "google_maps_geocoding",
    });
    expect(geocode.source_url).toContain("key=REDACTED");

    const validation = parseToolResult(
      await client.callTool({
        name: "cbe_intel_google_address_validate",
        arguments: { address_lines: ["1 Market Street"], region_code: "GB", locality: "Manchester" },
      }),
    );
    expect(validation).toMatchObject({
      status: "validated",
      provider: "google_maps_address_validation",
      source_type: "google_maps_address_validation",
    });
    expect((validation.validation as Record<string, unknown>).metadata).toMatchObject({ business: true, residential: false });
    expect(JSON.stringify({ geocode, validation })).not.toContain("google-test-key");
  });

  it("maps Google provider quota errors to rate_limited coverage state", async () => {
    const fetchFn: FetchLike = vi.fn(async () =>
      new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    const { client } = await connect({
      fetchFn,
      config: {
        googleMapsApiKey: "google-test-key",
        googleMapsPlacesBaseUrl: "https://places.googleapis.test/v1",
      },
    });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_google_place_details",
        arguments: { place_id: "ChIJ123" },
      }),
    );
    expect(result).toMatchObject({
      status: "rate_limited",
      http_status: 429,
      source_type: "google_maps_places",
    });
  });
});

describe("registry and public-company routes", () => {
  it("builds Companies House search and profile requests with API-key basic auth", async () => {
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = new URL(String(url));
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toMatch(/^Basic /);

      if (u.pathname === "/search/companies") {
        expect(u.searchParams.get("q")).toBe("Example Mobile Ltd");
        expect(u.searchParams.get("items_per_page")).toBe("3");
        return new Response(
          JSON.stringify({
            items: [
              {
                title: "EXAMPLE MOBILE LTD",
                company_number: "12345678",
                company_status: "active",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (u.pathname === "/company/12345678") {
        return new Response(
          JSON.stringify({
            company_name: "EXAMPLE MOBILE LTD",
            company_number: "12345678",
            company_status: "active",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    const { client } = await connect({ fetchFn });

    const search = parseToolResult(
      await client.callTool({
        name: "cbe_intel_company_registry_search",
        arguments: { company_name: "Example Mobile Ltd", country: "GB", max_results: 3 },
      }),
    );
    expect(search).toMatchObject({
      status: "found",
      registry: "companies_house",
      endpoint: "GET /search/companies",
      source_type: "official_api",
      fetched_at: NOW.toISOString(),
    });
    expect((search.companies as unknown[]).length).toBe(1);

    const profile = parseToolResult(
      await client.callTool({
        name: "cbe_intel_company_profile",
        arguments: { registry: "companies_house", country: "GB", company_number: "12345678" },
      }),
    );
    expect(profile).toMatchObject({
      status: "found",
      endpoint: "GET /company/{companyNumber}",
      company_number: "12345678",
      source_type: "official_api",
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("pads SEC CIK to ten digits and sends a configured User-Agent", async () => {
    const manyFilings = Array.from({ length: 40 }, (_, index) => index);
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = new URL(String(url));
      expect(u.pathname).toBe("/submissions/CIK0000320193.json");
      const headers = new Headers(init?.headers);
      expect(headers.get("user-agent")).toBe("SenturaCrossBorderIntel/0.1 test-contact@example.com");
      return new Response(
        JSON.stringify({
          cik: "320193",
          name: "APPLE INC",
          tickers: ["AAPL"],
          exchanges: ["Nasdaq"],
          sic: "3571",
          fiscalYearEnd: "0928",
          stateOfIncorporation: "CA",
          filings: {
            recent: {
              form: manyFilings.map((index) => (index % 2 === 0 ? "10-K" : "10-Q")),
              filingDate: manyFilings.map((index) => `2026-01-${String((index % 28) + 1).padStart(2, "0")}`),
              reportDate: manyFilings.map((index) => `2025-12-${String((index % 28) + 1).padStart(2, "0")}`),
              accessionNumber: manyFilings.map((index) => `0000320193-26-${String(index).padStart(6, "0")}`),
              primaryDocument: manyFilings.map((index) => `aapl-${index}.htm`),
              primaryDocDescription: manyFilings.map((index) => `Apple filing ${index}`),
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const { client } = await connect({ fetchFn });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_sec_lookup",
        arguments: { cik: "320193" },
      }),
    );
    expect(result).toMatchObject({
      status: "found",
      cik: "0000320193",
      endpoint: "GET /submissions/CIK##########.json",
      entity_name: "APPLE INC",
      submissions_summary: {
        recent_filing_count: 40,
      },
      source_type: "official_api",
    });
    expect(result).not.toHaveProperty("submissions");
    expect((result.submissions_summary as { recent_filings: unknown[] }).recent_filings).toHaveLength(8);
    expect(JSON.stringify(result).length).toBeLessThan(4000);
  });

  it("resolves SEC CIK by company name before submissions lookup", async () => {
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = new URL(String(url));
      const headers = new Headers(init?.headers);
      expect(headers.get("user-agent")).toBe("SenturaCrossBorderIntel/0.1 test-contact@example.com");
      if (u.pathname === "/files/company_tickers.json") {
        return new Response(
          JSON.stringify({
            0: { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
            1: { cik_str: 1267238, ticker: "AIZ", title: "Assurant, Inc." },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (u.pathname === "/submissions/CIK0000320193.json") {
        return new Response(
          JSON.stringify({ cik: "320193", name: "Apple Inc.", tickers: ["AAPL"], sic: "3571" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const { client } = await connect({ fetchFn });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_sec_lookup",
        arguments: { company_name: "Apple Inc" },
      }),
    );
    expect(result).toMatchObject({
      status: "found",
      cik: "0000320193",
      resolved_from_company_name: "Apple Inc",
      resolver_endpoint: "GET /files/company_tickers.json",
      matched_ticker: "AAPL",
      entity_name: "Apple Inc.",
      source_type: "official_api",
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("returns SEC not_found for private companies without treating it as an API error", async () => {
    const fetchFn: FetchLike = vi.fn(async (url) => {
      const u = new URL(String(url));
      expect(u.pathname).toBe("/files/company_tickers.json");
      return new Response(JSON.stringify({ 0: { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const { client } = await connect({ fetchFn });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_sec_lookup",
        arguments: { company_name: "Cellairis" },
      }),
    );
    expect(result).toMatchObject({
      status: "not_found",
      company_name: "Cellairis",
      endpoint: "GET /files/company_tickers.json",
      http_status: 200,
      source_type: "official_api",
    });
    expect(String(result.note)).toContain("not applicable");
  });
});

describe("RDAP and DNS evidence", () => {
  it.each([
    { status: 200, expected: "found" },
    { status: 302, expected: "redirect" },
    { status: 404, expected: "not_found" },
    { status: 429, expected: "rate_limited" },
  ])("handles RDAP HTTP $status as $expected", async ({ status, expected }) => {
    const fetchFn: FetchLike = vi.fn(async () => {
      if (status === 302) {
        return new Response(null, {
          status,
          headers: { location: "https://rdap.verisign.com/com/v1/domain/example.com" },
        });
      }
      if (status === 429) {
        return new Response(JSON.stringify({ errorCode: 429 }), {
          status,
          headers: { "retry-after": "10", "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          objectClassName: "domain",
          handle: "EXAMPLE-COM",
          events: [{ eventAction: "registration" }],
          nameservers: [{ ldhName: "ns1.example.com" }],
        }),
        { status, headers: { "content-type": "application/json" } },
      );
    });
    const { client } = await connect({ fetchFn });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_domain_rdap_lookup",
        arguments: { domain: "example.com" },
      }),
    );
    expect(result.status).toBe(expected);
    expect(result.source_type).toBe("official_api");
    expect(result.source_url).toBeTruthy();
    if (status === 429) expect(result.retry_after).toBe("10");
  });

  it("checks MX, free-provider, role email, SPF, and DMARC signals", async () => {
    const { client } = await connect({ dnsResolver: okDnsResolver });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_email_domain_check",
        arguments: { email: "sales@gmail.com" },
      }),
    );
    const checks = result.checks as Record<string, unknown>;
    expect(result).toMatchObject({
      status: "checked",
      domain: "gmail.com",
      source_type: "public_dns",
    });
    expect(checks.free_provider).toBe(true);
    expect(checks.role_email).toBe(true);
    expect((checks.mx as Record<string, unknown>).present).toBe(true);
    expect((checks.spf as Record<string, unknown>).present).toBe(true);
    expect((checks.dmarc as Record<string, unknown>).present).toBe(true);
    expect(result.confidence).toBeLessThanOrEqual(0.48);
  });

  it("marks missing MX as no_mx without throwing", async () => {
    const noMxResolver: DnsResolver = {
      resolveMx: async () => [],
      resolveTxt: async () => [],
    };
    const { client } = await connect({ dnsResolver: noMxResolver });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_email_domain_check",
        arguments: { domain: "nomx.example" },
      }),
    );
    expect(result.status).toBe("no_mx");
    expect((result.checks as Record<string, Record<string, unknown>>).mx.present).toBe(false);
    expect(result.confidence).toBeLessThan(0.4);
  });

  it("calls Abstract and Hunter paid email validation when enabled and configured", async () => {
    const fetchFn: FetchLike = vi.fn(async (url) => {
      const u = new URL(String(url));
      if (u.hostname === "emailreputation.abstractapi.com") {
        expect(u.pathname).toBe("/v1/");
        expect(u.searchParams.get("email")).toBe("buyer@example.com");
        expect(u.searchParams.get("api_key")).toBe("abstract-test-key");
        return new Response(
          JSON.stringify({
            email_deliverability: { status: "deliverable", is_format_valid: true },
            email_quality: { score: 0.91 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (u.hostname === "api.hunter.io") {
        expect(u.pathname).toBe("/v2/email-verifier");
        expect(u.searchParams.get("email")).toBe("buyer@example.com");
        expect(u.searchParams.get("api_key")).toBe("hunter-test-key");
        return new Response(
          JSON.stringify({ data: { status: "valid", score: 92 } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const { client } = await connect({
      fetchFn,
      config: {
        abstractApiKey: "abstract-test-key",
        hunterApiKey: "hunter-test-key",
      },
    });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_email_domain_check",
        arguments: { email: "buyer@example.com", enable_paid_validation: true },
      }),
    );
    const paidValidation = result.paid_validation as { providers: Array<Record<string, unknown>> };
    expect(paidValidation.providers.map((provider) => provider.provider)).toEqual(["abstract", "hunter"]);
    expect(JSON.stringify(paidValidation)).not.toContain("abstract-test-key");
    expect(JSON.stringify(paidValidation)).not.toContain("hunter-test-key");
  });

  it("extracts same-domain public emails from official website contact pages", async () => {
    const fetchFn: FetchLike = vi.fn(async (url) => {
      const u = new URL(String(url));
      if (u.pathname === "/") {
        return new Response("<html>No email here</html>", { status: 200 });
      }
      if (u.pathname === "/contact") {
        return new Response(
          "<html>Email sales@example.com or support@sub.example.com. Ignore vendor@other.com.</html>",
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });
    const { client } = await connect({ fetchFn });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_official_contact_email_search",
        arguments: { domain: "example.com", website: "https://www.example.com", max_pages: 3 },
      }),
    );
    expect(result).toMatchObject({
      status: "found",
      domain: "example.com",
      source_type: "public_web",
    });
    const emails = result.emails as Array<Record<string, unknown>>;
    expect(emails.map((email) => email.email)).toEqual(["sales@example.com", "support@sub.example.com"]);
    expect(JSON.stringify(emails)).not.toContain("vendor@other.com");
  });
});

describe("contextual score and paid evidence behavior", () => {
  it("uses final score for tiers and includes evidence coverage in the score", async () => {
    const { client } = await connect();
    const baseBlocks = [
      { block: "legal_identity", status: "scored", max_points: 25, earned_points: 23 },
      { block: "domain_email", status: "scored", max_points: 20, earned_points: 17 },
      { block: "public_footprint", status: "scored", max_points: 20, earned_points: 16 },
      { block: "business_fit", status: "scored", max_points: 20, earned_points: 18 },
      {
        block: "trade_financial",
        status: "disabled_by_budget",
        max_points: 20,
        reason: "Volza disabled for demo budget.",
      },
      {
        block: "conversation_behavior",
        status: "not_applicable",
        max_points: 15,
        reason: "Cold lead from Marketing.",
      },
    ];

    const trusted = parseToolResult(
      await client.callTool({
        name: "cbe_intel_score_buyer",
        arguments: { blocks: baseBlocks },
      }),
    );
    expect(trusted.risk_tier).toBe("trusted_candidate");
    expect(trusted.normalized_score).toBe(85.84);
    expect(trusted.evidence_coverage).toBe(0.8095);

    const cautious = parseToolResult(
      await client.callTool({
        name: "cbe_intel_score_buyer",
        arguments: {
          blocks: baseBlocks.map((block) =>
            block.status === "scored" ? { ...block, earned_points: Math.max(1, Number(block.earned_points) - 4) } : block,
          ),
        },
      }),
    );
    expect(cautious.risk_tier).toBe("cautious");
    expect(cautious.normalized_score).toBe(70.78);

    const lowCoverage = parseToolResult(
      await client.callTool({
        name: "cbe_intel_score_buyer",
        arguments: {
          blocks: [
            { block: "legal_identity", status: "scored", max_points: 25, earned_points: 20 },
            { block: "domain_email", status: "unavailable_api", max_points: 20 },
            { block: "public_footprint", status: "unavailable_api", max_points: 20 },
            { block: "business_fit", status: "disabled_by_budget", max_points: 20 },
            { block: "trade_financial", status: "disabled_by_budget", max_points: 20 },
            { block: "conversation_behavior", status: "not_applicable", max_points: 15 },
          ],
        },
      }),
    );
    expect(lowCoverage.risk_tier).toBe("cautious");
    expect(lowCoverage.normalized_score).toBe(68.76);
    expect(lowCoverage.evidence_coverage).toBeLessThan(0.4);

    const insufficient = parseToolResult(
      await client.callTool({
        name: "cbe_intel_score_buyer",
        arguments: {
          blocks: [
            { block: "legal_identity", status: "pending_human_input", max_points: 25 },
            { block: "domain_email", status: "unavailable_api", max_points: 20 },
            { block: "public_footprint", status: "unavailable_api", max_points: 20 },
          ],
        },
      }),
    );
    expect(insufficient.risk_tier).toBe("insufficient_evidence");
    expect(insufficient.normalized_score).toBeNull();

    const lowScore = parseToolResult(
      await client.callTool({
        name: "cbe_intel_score_buyer",
        arguments: {
          blocks: [
            { block: "legal_identity", status: "scored", max_points: 25, earned_points: 5 },
            { block: "domain_email", status: "scored", max_points: 20, earned_points: 5 },
            { block: "public_footprint", status: "scored", max_points: 20, earned_points: 6 },
            { block: "business_fit", status: "scored", max_points: 20, earned_points: 8 },
          ],
        },
      }),
    );
    expect(lowScore.risk_tier).toBe("high_risk");

    const forced = parseToolResult(
      await client.callTool({
        name: "cbe_intel_score_buyer",
        arguments: { blocks: baseBlocks, forced_downgrades: ["domain_age_under_30_days"] },
      }),
    );
    expect(forced.risk_tier).toBe("high_risk");
    expect(forced.normalized_score).toBe(59);
    expect(forced.forced_downgrades).toEqual(["domain_age_under_30_days"]);
  });

  it("keeps paid trade-data disabled by budget as coverage gap, not score penalty", async () => {
    const { client } = await connect();
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_trade_record_search",
        arguments: {
          company_name: "Andes Mobile Parts SpA",
          country: "CL",
          product_keywords: ["tempered glass", "screen protector"],
          max_paid_spend_usd: 0,
        },
      }),
    );
    expect(result.status).toBe("unavailable_api");
    expect(result.source_type).toBe("public_web");
    expect(result.note).toMatch(/Paid trade-data API is not enabled/);
  });

  it("uses the current ImportYeti company-search endpoint when paid trade data is enabled", async () => {
    const fetchFn: FetchLike = vi.fn(async (url, init) => {
      const u = new URL(String(url));
      expect(u.origin).toBe("https://data.importyeti.com");
      expect(u.pathname).toBe("/v1.0/company/search");
      expect(u.searchParams.get("name")).toBe("Wave Case Ltd");
      expect(u.searchParams.get("page_size")).toBe("10");
      const headers = new Headers(init?.headers);
      expect(headers.get("iyapikey")).toBe("importyeti-test-key");
      return new Response(
        JSON.stringify({ requestCost: 1, data: [{ title: "Wave Case Ltd", shipments: 12 }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const { client } = await connect({
      fetchFn,
      config: {
        enablePaidTradeData: true,
        importYetiApiKey: "importyeti-test-key",
        maxPaidSpendUsd: 5,
      },
    });
    const result = parseToolResult(
      await client.callTool({
        name: "cbe_intel_trade_record_search",
        arguments: {
          company_name: "Wave Case Ltd",
          country: "US",
          product_keywords: ["phone case"],
          source: "importyeti",
          max_paid_spend_usd: 2,
        },
      }),
    );
    expect(result).toMatchObject({
      status: "found",
      provider: "importyeti",
      endpoint: "GET /v1.0/company/search",
      source_type: "paid_trade_data",
    });
  });
});

describe("Accio fixture parser and summarizer", () => {
  it("parses the simulated Accio export and summarizes product, price, and follow-up fields", async () => {
    const chatExport = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, unknown>;
    const { client } = await connect();

    const parsed = parseToolResult(
      await client.callTool({
        name: "cbe_intel_parse_accio_chat",
        arguments: { chat_export: chatExport },
      }),
    );
    expect(parsed).toMatchObject({
      status: "parsed",
      platform: "Alibaba Accio",
      conversation_count: 3,
      source_type: "demo_fixture",
    });
    expect((parsed.normalized_conversations as unknown[]).length).toBe(3);

    const summaryResult = parseToolResult(
      await client.callTool({
        name: "cbe_intel_summarize_accio_chat",
        arguments: { chat_export: chatExport, conversation_id: "accio_conv_001" },
      }),
    );
    expect(summaryResult).toMatchObject({
      status: "summarized",
      summary_count: 1,
      source_type: "demo_fixture",
    });
    const summary = (summaryResult.summaries as Array<Record<string, unknown>>)[0];
    const purchaseIntent = (summary.purchase_intent as Array<Record<string, unknown>>)[0];
    const negotiatedPrice = (summary.negotiated_prices as Array<Record<string, unknown>>)[0];
    expect(summary.customer_profile).toMatchObject({
      company_name: "Andes Mobile Parts SpA",
      country: "CL",
      contact_person: "Maria Torres",
      company_evidence_status: "needs_screening",
    });
    expect(purchaseIntent.product).toContain("tempered glass");
    expect(purchaseIntent.quantity).toBe(10000);
    expect(purchaseIntent.target_price_usd).toBe(0.35);
    expect(purchaseIntent.seller_best_price_usd).toBe(0.36);
    expect(purchaseIntent.packaging_addon_usd).toBe(0.03);
    expect(negotiatedPrice.agreed_or_best_price_usd).toBe(0.36);
    expect(summary.next_actions).toEqual(
      expect.arrayContaining([expect.stringContaining("Send PI")]),
    );

    const allSummaryResult = parseToolResult(
      await client.callTool({
        name: "cbe_intel_summarize_accio_chat",
        arguments: { chat_export: chatExport },
      }),
    );
    expect(allSummaryResult).toMatchObject({
      status: "summarized",
      summary_count: 3,
      source_type: "demo_fixture",
    });
    const summaries = allSummaryResult.summaries as Array<Record<string, unknown>>;
    const byCompany = new Map(
      summaries.map((item) => [
        (item.customer_profile as Record<string, unknown>).company_name as string,
        item,
      ]),
    );

    const berlinIntent = (byCompany.get("Berlin Gadget Wholesale GmbH")?.purchase_intent as Array<Record<string, unknown>>)[0];
    expect(berlinIntent).toMatchObject({
      product: "65W GaN chargers",
      quantity: 500,
      target_price_usd: 6.5,
      seller_best_price_usd: 6.8,
      incoterm: "EXW",
      logistics_terms: "Delivery to Hamburg warehouse requested.",
      certification_terms: "CE and RoHS certificates requested or available.",
    });

    const northstarIntent = (byCompany.get("Northstar Wireless LLC")?.purchase_intent as Array<Record<string, unknown>>)[0];
    expect(northstarIntent).toMatchObject({
      product: "clear MagSafe phone cases",
      quantity: 15000,
      monthly_potential_quantity: 20000,
      seller_best_price_usd: 1.1,
      packaging_addon_usd: 0.08,
      packaging: "Amazon FBA barcode stickers and drop-test packaging",
      incoterm: "FOB Shenzhen",
    });
    expect(northstarIntent.models).toEqual(
      expect.arrayContaining(["iPhone 16", "iPhone 16 Pro", "iPhone 16 Pro Max"]),
    );
  });
});
