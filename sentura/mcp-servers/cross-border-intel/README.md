# Cross-Border Intel MCP Server

Read-mostly MCP server for the Cross-border e-commerce / 跨境电商 Phase-1 MVP. It gives the Screening and Accio Memory employees deterministic tools for low-cost buyer investigation, contextual scoring, and simulated Alibaba Accio chat parsing.

## Tool Surface

All tools are registered with `readOnlyHint: true` and return `source_url`, `source_type`, `fetched_at`, and `confidence`.

| Tool | Purpose |
|---|---|
| `cbe_intel_company_registry_search` | Companies House search for GB when an API key exists; OpenCorporates only when configured; otherwise public-web registry fallback. |
| `cbe_intel_company_profile` | Companies House company profile by company number, or manual registry URL review stub. |
| `cbe_intel_domain_rdap_lookup` | RDAP.org domain lookup with 200/302/404/429 handling. |
| `cbe_intel_email_domain_check` | Syntax, free/disposable provider, role-email, MX, SPF, DMARC, and optional Abstract + Hunter paid validation. |
| `cbe_intel_official_contact_email_search` | Fetch a small set of public official website pages and extract same-domain contact emails for optional paid validation. |
| `cbe_intel_google_places_search` | Google Maps Places API (New) Text Search and Nearby Search for local/storefront lead seeds with field-mask profiles, request caps, normalized source metadata, attribution flags, and ledger-ready call metadata. |
| `cbe_intel_google_place_details` | Google Maps Place Details for shortlisted place IDs only, returning bounded local-presence evidence such as website, address, phone, business status, types, rating count, opening hours, and Maps URI. |
| `cbe_intel_google_geocode` | Google Geocoding API helper for city/address coordinates used by Nearby Search preparation and address consistency checks. It is not buyer verification by itself. |
| `cbe_intel_google_address_validate` | Google Address Validation API helper for public business address consistency in Screening. It can support address-footprint confidence and the small-local/offline first-block rule, but is not legal ownership or formal KYB proof. |
| `cbe_intel_sec_lookup` | SEC EDGAR company-name-to-CIK resolution through `company_tickers.json`, then submissions lookup by ten-digit CIK. |
| `cbe_intel_trade_record_search` | Volza/ImportYeti paid search only when keys and spend caps are enabled; otherwise weak public-web fallback. |
| `cbe_intel_score_buyer` | Deterministic contextual score with normalized score and evidence coverage separated. Accepts optional `company_scale_assessment` so Screening can apply the 25% `公司注册与线下门店/地址` first-block rule: registry+Maps fusion for listed/medium-large companies, and Maps physical-address primary evidence for small local/offline companies. |
| `cbe_intel_parse_accio_chat` | Validate and normalize an Accio JSON export fixture. |
| `cbe_intel_summarize_accio_chat` | Extract company profile, requested goods, negotiated prices, behavior signals, and follow-up tasks. |

## Country Coverage Boundary

Current implemented registry/identity coverage is intentionally narrow:

| Country/source | Current behavior | Not yet implemented |
|---|---|---|
| GB | Companies House search/profile when `COMPANIES_HOUSE_API_KEY` exists; public-web registry fallback when unavailable. | None for basic GB registry lookup. |
| US | SEC EDGAR lookup for public companies/SEC filers with bounded summary fields. | State registry API adapters. |
| Global fallback | OpenCorporates search only when `OPENCORPORATES_API_KEY` is configured. | Automatic jurisdiction selection beyond current search fallback. |
| Domain/email | RDAP.org, DNS MX/SPF/DMARC, official-site same-domain email discovery, optional Abstract/Hunter verifier. | Paid WHOIS/RDAP provider adapters. |
| Trade evidence | ImportYeti/Volza only when paid trade data and budget are enabled. | Panjiva, ImportGenius, enterprise customs APIs. |
| Google Maps | Places Text/Nearby Search, Place Details, Geocoding, and Address Validation are implemented as read-only server-side MCP tools. | Google Maps is discovery/local-presence/address-consistency evidence and can support the first authenticity block for small local/offline companies. It is still not formal KYB, legal ownership, trade, or financial proof. Reviews/photos/raw responses are not retained by default. |

The 2026-06-21 API research runbook in `跨境电商/API_KEYS_OPENCLAW_SETUP.md` identifies France API Recherche/API Entreprise, Japan Corporate Number Web-API, Korea OpenDART, Brazil Serpro CNPJ, Italy InfoCamere, and official web/manual routes for Germany/Spain/Mexico. These are planned country adapters or manual routes, not current MCP tools. Do not add their env vars to setup or employee prompts until the TypeScript adapter, schema, mocked tests, missing-key behavior, rate-limit policy, and evidence tags are implemented.

Google Maps is the current exception to the "planned adapter" warning above: the TypeScript tools, mocked tests, field-mask profiles, missing-key behavior, provider/quota handling, source metadata, and server-side env wiring are implemented. Keep `GOOGLE_MAPS_API_KEY` restricted and server-side.

## Environment

Secrets must live in OpenClaw's `.env` / secret store, not in config prose or code.

| Variable | Required | Notes |
|---|---:|---|
| `COMPANIES_HOUSE_API_KEY` | No | Enables GB Companies House search/profile. |
| `OPENCORPORATES_API_KEY` | No | Paid global registry fallback. Disabled when absent. |
| `SEC_USER_AGENT` | Recommended | SEC requests need a descriptive User-Agent. Default is a non-secret Sentura identifier. |
| `ABSTRACT_API_KEY` | No | Optional Abstract Email Reputation lookup when `enable_paid_validation` is requested. |
| `HUNTER_API_KEY` | No | Optional Hunter Email Verifier call when `enable_paid_validation` is requested. |
| `VOLZA_API_KEY` | No | Optional paid trade-data search. |
| `IMPORTYETI_API_KEY` | No | Optional paid trade-data search. |
| `GOOGLE_MAPS_API_KEY` | Recommended for Maps route | Enables Google Maps Places, Geocoding, and Address Validation tools. Keep server-side and API/IP restricted. |
| `CBE_GOOGLE_MAPS_MAX_RESULTS_PER_SEARCH` | No | Search result cap. Default `10`, max `20`. |
| `CBE_GOOGLE_MAPS_MAX_DETAILS_PER_RUN` | No | Details-call cap used by orchestration policy. Default `20`. |
| `CBE_GOOGLE_MAPS_MAX_ADDRESS_VALIDATION_PER_RUN` | No | Address Validation cap used by orchestration policy. Default `5`. |
| `CBE_ENABLE_PAID_TRADE_DATA` | No | Must be `true`/`1` before paid trade calls run. |
| `CBE_MAX_PAID_SPEND_USD` | No | Global per-call paid-data budget ceiling. Default `0`. |
| `CBE_INTEL_REQUEST_TIMEOUT_MS` | No | HTTP timeout. Default `30000`. |

## Google Maps Field Masks

The MCP server uses narrow field-mask profiles so agents receive only the bounded public fields needed for lead discovery or screening.

| Profile | Tool | Fields |
|---|---|---|
| `lead_discovery_list` | `cbe_intel_google_places_search` | `places.id`, `places.displayName`, `places.formattedAddress`, `places.location`, `places.types`, `places.businessStatus`, `places.googleMapsUri` |
| `lead_discovery_basic` | `cbe_intel_google_place_details` | id/name/address, national and international phone, website, business status, types, rating count, opening hours, Maps URI |
| `screening_local_presence` | `cbe_intel_google_place_details` | id/name/address, website, business status, types, rating count, opening hours, Maps URI |
| `screening_address_footprint` | `cbe_intel_google_place_details` | id/name/address, website, national and international phone, business status, types, opening hours, Maps URI |

## OpenClaw MCP Config

`scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` register this server
for local Sentura installs. Operators should put credentials in
`~/.openclaw/.env` (or `%USERPROFILE%\.openclaw\.env` on Windows), build the
package, then rerun the Sentura setup script.

The setup script writes the flat `mcp.servers.<name>` shape consumed by
OpenClaw. API keys are written as `${ENV_VAR}` config references, not literal
secrets and not `$secret:` markers:

```json5
{
  mcp: {
    servers: {
      "cross-border-intel": {
        command: "node",
        args: ["sentura/mcp-servers/cross-border-intel/dist/index.js"],
        cwd: ".",
        env: {
          COMPANIES_HOUSE_API_KEY: "${COMPANIES_HOUSE_API_KEY}",
          SEC_USER_AGENT: "SenturaCrossBorderIntel/0.1 contact=ops@example.invalid",
          ABSTRACT_API_KEY: "${ABSTRACT_API_KEY}",
          HUNTER_API_KEY: "${HUNTER_API_KEY}",
          IMPORTYETI_API_KEY: "${IMPORTYETI_API_KEY}",
          GOOGLE_MAPS_API_KEY: "${GOOGLE_MAPS_API_KEY}",
          CBE_ENABLE_PAID_TRADE_DATA: "false",
          CBE_MAX_PAID_SPEND_USD: "0",
          CBE_INTEL_REQUEST_TIMEOUT_MS: "30000",
          CBE_GOOGLE_MAPS_MAX_RESULTS_PER_SEARCH: "10",
          CBE_GOOGLE_MAPS_MAX_DETAILS_PER_RUN: "20",
          CBE_GOOGLE_MAPS_MAX_ADDRESS_VALIDATION_PER_RUN: "5"
        }
      }
    }
  }
}
```

The script omits optional API-key env references when the corresponding env var
is not configured, so a missing paid provider does not break OpenClaw config
load. `TAVILY_API_KEY` is for OpenClaw `web_search` auto-detection, not for this
MCP server's `env` block. `GOOGLE_MAPS_API_KEY` should also stay out of the
browser/client environment; setup writes it to the MCP env block only as a
`${GOOGLE_MAPS_API_KEY}` reference when the env var exists.

Sandboxed employees also need MCP/plugin tools allowlisted at the sandbox layer:

```json5
{
  tools: {
    allow: ["web_search", "web_fetch", "memory_search", "memory_get", "group:plugins"],
    sandbox: {
      tools: {
        allow: ["web_search", "web_fetch", "memory_search", "memory_get", "cross-border-intel__*"]
      }
    }
  }
}
```

## Cost Controls

The Phase-1 default is low-cost and public:

- RDAP/DNS/SEC are free public routes.
- Companies House requires an API key but no paid route is assumed here.
- OpenCorporates, Volza, ImportYeti, Abstract, and Hunter are optional. Missing keys disable only those adapters.
- `cbe_intel_official_contact_email_search` performs a small public official-site fetch and does not validate deliverability by itself; pass a discovered same-domain email into `cbe_intel_email_domain_check` with `enable_paid_validation=true` to trigger Abstract/Hunter.
- Hunter uses `GET https://api.hunter.io/v2/email-verifier`; Abstract uses `GET https://emailreputation.abstractapi.com/v1/?api_key=...&email=...`. API keys are never returned in tool output.
- ImportYeti uses `GET https://data.importyeti.com/v1.0/company/search?name=...&page_size=...` with the documented `IYApiKey` header when paid trade data and budget are enabled.
- `cbe_intel_trade_record_search` will not call paid trade providers unless `CBE_ENABLE_PAID_TRADE_DATA=true` and the request budget is within `CBE_MAX_PAID_SPEND_USD`.
- Disabled paid evidence is reported as coverage gap, not as a buyer fraud penalty.
- Google Maps tools use field masks, per-search caps, source attribution, and no default reviews/photos/raw-response retention. Tool outputs include `api_call_ledger` metadata that downstream OpenClaw/Sentura run handling can persist with tenant/run context.
- Google Maps evidence must be reported with Google Maps URI/source attribution and no raw review/photo retention unless policy-reviewed. For small local/offline companies, an `OPERATIONAL` matched physical address can support the first `公司注册与线下门店/地址` authenticity block; for listed/public or medium-large companies, Maps must be fused with registry/disclosure evidence and cannot be formal KYB/legal ownership proof.

## Development

```bash
pnpm --filter @sentura/mcp-cross-border-intel test
pnpm --filter @sentura/mcp-cross-border-intel build
```

Tests use `InMemoryTransport`, mocked HTTP, and injected DNS resolvers. No real Companies House, SEC, RDAP, email, Google Maps, or trade-data calls are made during Vitest.
