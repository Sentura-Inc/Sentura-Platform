# Cross-Border E-Commerce — Marketing Acquisition Employee

> **On-demand reference — not read by default.**
>
> Back-link: [`DESIGN.md`](DESIGN.md)
>
> Agent id: `cbe-lead-discovery`
>
> Chinese name: 跨境营销获客员工
>
> Last updated: 2026-06-21

This document owns all design, implementation details, current status, and forward plan for the Marketing Acquisition / Lead Discovery employee in the mobile-accessory cross-border e-commerce customer lane. Shared platform architecture, database-wide schema, cloud deployment, and cross-agent flow live in [`DESIGN.md`](DESIGN.md). Screening-specific background investigation design lives in [`SCREENING.md`](SCREENING.md). Accio ingestion and memory design lives in [`MEMORY_PROCESSING.md`](MEMORY_PROCESSING.md).

## 1. Role And Current Status

The Marketing Acquisition employee finds overseas downstream B2B buyer companies for mobile-phone accessories. The target design is now **Google Maps Places API + OpenClaw web search as the primary acquisition route**:

1. Google Maps Places discovers local retail/repair/electronics/wholesale storefront candidates by geography, business category, and product intent.
2. OpenClaw `web_search` / `web_fetch` verifies whether each candidate is a real downstream buyer fit, finds the official website/contact page when available, and cross-checks public B2B/product evidence.
3. Sentura's Lead coordinator and database reconciliation decide whether the candidate is new, duplicate, assignable, or top-up material.

Current implementation uses a controlled read-only `cross-border-intel` MCP boundary for Google Maps Places, Geocoding, and server-side API key handling. Lead Discovery now treats Google Maps Places as the default candidate-discovery source and uses OpenClaw `web_search` / `web_fetch` for independent official-site and product-fit verification.

Phase-1 requirement: all core Lead Discovery functionality is implemented.

Implementation status as of 2026-06-08:

- Source workspace added: `sentura/agents/cbe-lead-discovery/`.
- Workspace uses exactly the 8 OpenClaw-native top-level files plus `config.json5` and skills. No additional top-level agent markdown files.
- Setup-script registration and webchat binding added through `scripts/sentura-setup.{sh,ps1}`.
- Customer-facing UI exists at `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`.
- Diagnostic adapter route exists at `sentura/dashboard/src/app/api/client-demos/cross-border/lead-discovery/run/route.ts`; this is retained for Tavily/provider smoke tests only and is not the formal production lead-generation path.
- Formal page run path checks OpenClaw Gateway connectivity and `cbe-lead-discovery` registration, then sends the structured search task through the real employee `AgentChat` session.
- Employee output is parsed from `LEAD_CANDIDATES_JSON_START` / `LEAD_CANDIDATES_JSON_END`.
- Candidate table starts empty and is populated only from employee output.
- The page stores run configuration, employee session key, run status, expanded row, and returned leads in same-origin local storage so refresh/navigation does not lose the last run.
- CE4 coverage in `scripts/test-cross-border-agents.ts` verifies the employee workspace, UI route, real AgentChat execution path, result parsing, source/dedupe table behavior, copy-to-Screening behavior, state persistence, and no automatic outreach.

Known forward work:

- Add Google Maps Places API integration for location-based candidate discovery, then combine it with web search enrichment as the default Lead route.
- Implement production persistence for `lead_runs`, `lead_candidates`, `lead_sources`, shared lead identity pool, and run-scope dedupe tables.
- Implement Dashboard/server-side run coordinator before AgentChat launch so duplicate concurrent user requests join or top up an active run instead of starting another identical employee run.
- Add automated concurrency tests that simulate two start requests for the same `scope_hash` and assert only one AgentChat run is launched.
- Add optional incremental `LEAD_CANDIDATE_BATCH_JSON_START/END` support for partial result persistence while preserving the final `LEAD_CANDIDATES_JSON_START/END` contract.

## 2. Inputs And Run Configuration

Canonical input:

```json
{
  "run_id": "lead-run-2026-06-07-us-uk",
  "product_keywords": ["phone case", "tempered glass screen protector", "USB-C charger", "MagSafe accessories"],
  "buyer_personas": ["importer", "distributor", "wholesaler", "mobile phone repair chain", "electronics retailer"],
  "countries": ["US", "GB", "DE", "FR", "BR", "MX"],
  "languages": ["en", "de", "fr", "pt", "es"],
  "daily_candidate_target": 10,
  "source_policy": ["google_maps_places", "public_web", "company_site_only"],
  "google_maps": {
    "enabled": true,
    "mode": "text_search_then_details",
    "city_or_region_seeds": ["Los Angeles", "Manchester", "Berlin", "Paris", "Sao Paulo", "Mexico City"],
    "included_place_types": ["electronics_store", "cell_phone_store", "store", "wholesaler"],
    "field_mask_profile": "lead_discovery_basic"
  },
  "exclude_domains": ["amazon.com", "alibaba.com", "aliexpress.com", "temu.com", "ebay.com"]
}
```

Customer-facing run-builder controls:

- Product keyword chips:
  - phone case
  - tempered glass
  - USB-C charger
  - MagSafe accessories
  - custom input
- Buyer persona multi-select:
  - repair chain
  - electronics retailer
  - accessories retailer
  - phone store
  - reseller buyer
  - importer buyer
- Country/language selector.
- Result target numeric input, capped at 10.
- Exclusion-domain editor.
- Primary button: `让获客员工开始搜索`.

Phase-1 manual command example:

```text
根据手机壳、钢化膜、充电器关键词，为英国和美国找 10 个潜在 B2B 买家。
```

## 3. Search Strategy

After Google Maps integration, Lead Discovery should use two complementary source families:

1. **Google Maps Places** for location-first discovery of actual stores, repair shops, electronics retailers, wholesalers, and distributors with public business profiles.
2. **OpenClaw web search/fetch** for official-site/product/category/contact verification and non-local B2B sources such as distributor websites, trade fair exhibitors, importer pages, and buyer directories.

The Google Maps path is especially useful for this mobile-accessory customer because many downstream buyers are local or regional storefront businesses that do not rank well in generic web search: phone repair chains, mobile shops, electronics stores, accessory stores, and small distributors. It is less useful for pure importer databases, hidden wholesale buyers, marketplace-only sellers, or companies that have no public storefront profile.

### 3.1 Google Maps Places Discovery

Use Google Maps Places API (New), not Business Profile API, for prospect discovery. Business Profile APIs are for merchants to manage locations they own or administer, so they are not the correct third-party search/backcheck surface.

Primary Google endpoints:

| API | Use in Lead Discovery | Notes |
|---|---|---|
| Text Search (New) `places:searchText` | First pass for product/persona/city queries such as `phone accessories wholesaler Manchester` or `mobile phone repair parts Los Angeles`. | Best for natural-language business intent. Supports field masks and optional location bias/restriction. |
| Nearby Search (New) `places:searchNearby` | Grid/metro sweep when a target city/lat-lng is known. | Requires a geographic `locationRestriction`; use only after geocoding city centers or predefined market grids. |
| Place Details (New) `places/{place_id}` | Enrich shortlisted places with selected fields such as website, phone, address, business status, rating count, hours, Google Maps URI, and types. | Use narrow field masks to control cost and avoid pulling unneeded reviews/photos. |
| Place Photos (New) | Optional visual support for human review only. | Not a Lead default; photos add cost and attribution/caching constraints. |
| Geocoding API | Convert city/region seeds into map points for Nearby Search grids when needed. | Do not use Geocoding as a business verifier. |

Recommended Text Search query families:

| Persona | English query examples | Localized/query expansion examples |
|---|---|---|
| Phone repair chain / repair shop | `phone repair shop mobile accessories {city}`, `cell phone repair parts {city}` | `handy reparatur zubehor Berlin`, `reparation telephone accessoires Paris`, `assistencia celular acessorios Sao Paulo` |
| Electronics retailer | `electronics store phone accessories {city}`, `mobile accessories retailer {city}` | `tienda electronica accesorios moviles Madrid`, `negozio elettronica accessori cellulari Milano` |
| Mobile phone store | `cell phone store accessories {city}`, `mobile phone shop cases chargers {city}` | `loja celular capinha carregador Sao Paulo`, `tienda celulares fundas cargadores Mexico City` |
| Distributor / wholesaler | `phone accessories distributor {city}`, `mobile accessories wholesaler {region}` | `grossiste accessoires telephone Paris`, `distribuidor accesorios celulares Mexico` |
| Repair parts buyer | `LCD screen replacement supplier repair shop {city}`, `phone parts shop {city}` | Use only when the customer sells repair accessories or parts. |

Place type use:

- Use Google `includedType` / `includedTypes` only when it improves precision; keep text query as the main signal for phone-accessory intent.
- Useful types include `electronics_store`, `cell_phone_store`, `store`, `shopping_mall`, and `wholesaler` where supported.
- Do not assume there is a precise Google type for every buyer persona, especially `phone repair chain`, `accessory importer`, or `mobile accessories distributor`; use Text Search terms and downstream validation for those.

Field-mask profiles:

| Profile | Intended endpoint | Fields to request | Why |
|---|---|---|---|
| `lead_discovery_list` | Text/Nearby Search | `places.id`, `places.displayName`, `places.formattedAddress`, `places.location`, `places.types`, `places.businessStatus`, `places.googleMapsUri` | Cheap first-pass candidate list and provenance. |
| `lead_discovery_basic` | Place Details | `id`, `displayName`, `formattedAddress`, `nationalPhoneNumber`, `internationalPhoneNumber`, `websiteUri`, `businessStatus`, `types`, `rating`, `userRatingCount`, `regularOpeningHours`, `googleMapsUri` | Enough to cross-check website, storefront status, phone, and local presence. |
| `human_review_optional` | Place Details | Add `reviews`, `photos`, `editorialSummary` only when explicitly needed for operator review. | Reviews/photos have higher cost/policy burden and should not be default scoring evidence. |

Candidate acceptance from Google Maps:

- Accept a Maps candidate only as a **lead seed** until web search confirms a downstream buyer fit.
- Prefer candidates with `websiteUri` pointing to a company-owned domain or with web-search evidence of mobile accessories, repair parts, electronics retail, accessory retail, or wholesale/distribution.
- `businessStatus = OPERATIONAL` is a positive existence signal; `CLOSED_PERMANENTLY` should usually block the lead unless web search shows a relocation/rebrand.
- Rating and review count are business-footprint signals only. Do not treat low ratings as fraud evidence, and do not use reviews as personal-data memory.
- If Google returns only a map listing with no website and no public web evidence, mark the row as `needs_web_verification` or keep it out of the final actionable lead list.

Google Maps + web search enrichment flow:

1. Build one compact search brief from all selected product keywords, buyer personas, and target countries/cities.
2. Run Text Search against the merged brief with server-side request caps that fit the request budget.
3. Deduplicate by Google `place_id`, normalized website domain, phone, and normalized company name + city/country.
4. Call Place Details only for top candidates needed to satisfy the user target plus a small replacement buffer for duplicates/denylist hits.
5. For candidates with website/domain, run OpenClaw `web_fetch` against official home/contact/product/category pages.
6. For candidates without a website, run `web_search` for exact business name + city + phone/accessory keywords.
7. Reject marketplace pages, generic directory/list pages, factories/manufacturers/exporters, closed businesses, and candidates with no mobile-accessory/business-fit evidence.
8. Save only DB-unique, unassigned candidates after tenant-level reconciliation.

Budget defaults:

- Use Text Search first; Place Details only for shortlisted candidates.
- Do not request reviews/photos by default.
- Cap Places calls per Lead run from server config, not prompt text.
- Cache/store only what Google Maps Platform terms allow. Treat `place_id` and `googleMapsUri` as durable provenance; refresh volatile place fields when showing or scoring if policy requires.

The employee uses the same merged condition brief for web-search verification. Do not build one query family for every product/country/persona combination.

Buyer type:

- `"phone accessories importer" "United Kingdom"`
- `"mobile accessories distributor" Germany`
- `"tempered glass wholesaler" Brazil`

Retail and repair channels:

- `"mobile phone repair chain" "phone parts" "contact"`
- `"electronics retailer" "mobile accessories" "wholesale"`

Trade fair and exhibitor channels:

- `"MWC exhibitor" "mobile accessories distributor"`
- `"IFA exhibitor" "phone accessories"`
- `"CES exhibitor" "mobile accessories"`
- `"Canton Fair buyer mobile accessories"`

B2B platform cross-check:

- `site:globalsources.com "phone accessories" importer`
- `site:made-in-china.com "phone accessories" distributor`

Public social/business pages through search only:

- `site:linkedin.com/company "mobile accessories" "distributor"`
- `site:facebook.com "mobile phone accessories" "wholesale"`
- `site:youtube.com "phone repair" "parts supplier"`

Search boundaries:

- Do not log in to LinkedIn, Meta, X, or other protected social platforms in Phase 1.
- Do not scrape login-gated pages or bypass anti-bot controls.
- Use only public search result snippets and publicly fetchable pages.
- Prefer company-owned downstream buyer websites over social profiles, marketplaces, supplier directories, public company-info pages, generic wholesale lists, factories, manufacturers, exporters, and wholesale supplier pages.
- Accepted leads must be specific downstream buyer companies whose public pages show mobile-accessory, phone-repair, electronics-retail, accessory-retail, reseller/import-buyer, or phone-store relevance.

## 4. Tools And OpenClaw Configuration

Allowed tools:

- `web_search`
- `web_fetch`
- `cron`
- `group:plugins`
- `cross-border-intel__cbe_intel_google_places_search`
- `cross-border-intel__cbe_intel_google_place_details`
- `cross-border-intel__cbe_intel_google_geocode`
- `cross-border-intel__*` for narrowly allowed domain/email light enrichment only

Sandbox tool allowlist:

- `web_search`
- `web_fetch`
- `cron`
- `cross-border-intel__*`

Denied tools:

- shell / exec
- filesystem mutation
- direct gateway mutation
- external messaging/outreach
- `sessions_spawn`
- `subagents`
- `sessions_yield`

Model route:

- Default: `deepseek/deepseek-v4-flash` or `qwen/qwen3.5-plus`.
- Fallback: Volcengine/Doubao fast model.
- Reason: high-volume query expansion and lead JSON cleanup need structured-output reliability and cost control more than maximum reasoning.

Search provider policy:

- Formal Lead Discovery uses OpenClaw `web_search` and `web_fetch`.
- Target design makes Google Maps Places + OpenClaw web search the main Lead route after a read-only Google Maps adapter is implemented.
- `TAVILY_API_KEY` and `BRAVE_API_KEY` belong to OpenClaw web-search provider auto-detection, not to the `cross-border-intel` MCP env block.
- `GOOGLE_MAPS_API_KEY` must live in `~/.openclaw/.env` or secret injection and must never appear in prompts, workspace prose, logs, or client-side JavaScript. The adapter should call Google from the server/MCP side only.
- The diagnostic Dashboard Tavily route may read `TAVILY_API_KEY` from `process.env` or `~/.openclaw/.env`, but it must be clearly treated as adapter diagnostics, not official lead generation.

Google Maps adapter policy:

- Use the Places API (New) Web Service with explicit field masks for every request.
- Use server-side API keys restricted to required Maps APIs and deployment egress IPs where possible.
- Write `api_call_ledger` rows for Text Search, Nearby Search, Place Details, and optional Photos calls.
- Do not expose raw Google responses to the LLM. Return normalized, bounded candidate/evidence objects with `provider_status`, `field_mask`, `fetched_at`, `google_place_id`, `google_maps_uri`, source attribution fields, and cost/usage posture.
- Treat Google Maps as discovery/existence evidence, not a legal registry or KYB source.

## 5. Output Schema

Canonical `LeadCandidate` shape:

```json
{
  "lead_id": "lead_20260607_0001",
  "source_run_id": "lead-run-2026-06-07-us-uk",
  "company_name": "Example Mobile Distribution Ltd",
  "website": "https://example-mobile-distribution.co.uk",
  "country": "GB",
  "city": "Manchester",
  "buyer_type": "distributor",
  "matched_products": ["phone case", "screen protector"],
  "contact_candidates": [
    {
      "type": "email",
      "value": "sales@example-mobile-distribution.co.uk",
      "source_url": "https://example-mobile-distribution.co.uk/contact",
      "confidence": 0.74
    }
  ],
  "source_urls": [
    "https://example-mobile-distribution.co.uk",
    "https://www.linkedin.com/company/example-mobile-distribution"
  ],
  "google_maps_evidence": {
    "place_id": "ChIJREPLACE_ME",
    "google_maps_uri": "https://maps.google.com/?cid=REPLACE_ME",
    "business_status": "OPERATIONAL",
    "formatted_address": "Example address, Manchester, UK",
    "rating": 4.3,
    "user_rating_count": 42,
    "fetched_at": "2026-06-21T00:00:00Z",
    "field_mask": "id,displayName,formattedAddress,websiteUri,businessStatus,types,rating,userRatingCount,googleMapsUri"
  },
  "discovery_evidence": [
    {
      "signal": "website_mentions_mobile_accessories",
      "source_url": "https://example-mobile-distribution.co.uk/products",
      "excerpt": "Wholesale mobile accessories and repair parts",
      "confidence": 0.82
    }
  ],
  "dedupe_key": "example-mobile-distribution.co.uk",
  "created_at": "2026-06-07T00:00:00Z"
}
```

Required output fields:

- company name
- website/domain
- country/city when available
- buyer type
- matched products
- contact candidates when publicly available
- source URLs
- source excerpts/evidence
- query strings and source timestamps in expandable details
- Google Maps provenance when used: `place_id`, `google_maps_uri`, endpoint, field mask, fetched timestamp, business status, address/phone/website fields requested, and attribution handling
- `dedupe_key`
- `normalized_domain`
- `dedupe_explanation`
- `duplicate_status`

UI parsing contract:

- Final canonical block: `LEAD_CANDIDATES_JSON_START` / `LEAD_CANDIDATES_JSON_END`.
- Production hardening option: `LEAD_CANDIDATE_BATCH_JSON_START` / `LEAD_CANDIDATE_BATCH_JSON_END` every 5-10 candidates for partial progress and concurrent join behavior.

Copy-to-Screening contract:

- One-click copy-all and per-row copy output `{"leads":[...]}`.
- Copied records include `company_name`, `website`, `domain`, `country`, `matched_products`, `contact_candidates`, source URLs/evidence, dedupe data, confidence, and timestamps.
- Screening normalizes copied leads into `InvestigationTarget`.

## 6. UI Design

Role-level target UI for Employee users is defined in [`UI.md`](UI.md). This section describes the current implemented Lead Discovery demo workbench and its source/audit behavior.

Route:

```text
/client-demos/cross-border/lead-discovery
```

Page goal: make lead generation feel like a sales-research console, not a chat-only bot.

Primary layout:

- Left run builder with product/persona/country/source controls.
- Center/right lead table as the main workspace.
- Inline source/dedupe details inside expanded table rows.
- Real employee execution surface connected to `cbe-lead-discovery`.

Lead table columns:

- company
- country
- buyer type
- matched product
- domain
- contact candidate
- source count
- discovery confidence
- duplicate status

Row actions:

- `查看` expands source URLs, query strings, snippets, timestamps, dedupe key, and dedupe explanation.

Panels intentionally not rendered on this page:

- old query log panel
- live Screening handoff preview panel
- realtime tool-trace panel
- generic Marketing AgentChat conversation panel for operator chat noise

Source labels:

- demo fixture data: `演示数据`
- employee-produced live results: `员工执行`
- diagnostic adapter output: `实时查询`

Human workflow:

1. Operator configures a run using business terms.
2. Dashboard submits the structured task to `cbe-lead-discovery` through OpenClaw Gateway/AgentChat.
3. Employee expands queries, calls OpenClaw search/fetch tools, and returns structured lead JSON.
4. Operator inspects sources inline using `查看`.
5. Operator exports or copies qualified buyers into Screening.

## 7. Completion And Acceptance Criteria

The employee is acceptable when it:

- Runs from a manual command.
- Can be scheduled through cron/heartbeat later.
- Produces JSON and Markdown list outputs.
- Produces at least the requested candidate count or explains shortage by country/source.
- Returns specific downstream buyer company websites, not generic social/directory/marketplace/supplier pages.
- Deduplicates by normalized domain, company name, and contact email.
- Applies marketplace/supplier exclusions.
- Logs every source URL and query string for audit.
- Hands candidates to Screening in a structured list.
- Sends no automatic outreach.
- Restores last UI state after refresh/navigation.

Current test coverage:

- CE4 validates workspace files, tool policy, skills, setup registration, webchat binding, UI route, real AgentChat formal path, lead JSON marker parsing, source/dedupe row expansion, copy-to-Screening, state persistence, and no baked-in sample leads.
- CE7 verifies this route as part of the three-route demo UI suite.

## 8. Business Database And Persistence

Shared production database recommendation lives in [`DESIGN.md`](DESIGN.md). Marketing-specific tables and writes:

```sql
lead_runs(id, tenant_id, user_id, agent_run_id, query_config_json, status, target_count, created_at)
lead_candidates(id, tenant_id, lead_run_id, normalized_domain, company_name, country, buyer_type, confidence, dedupe_key, status, created_at)
lead_sources(id, tenant_id, lead_candidate_id, source_type, source_url, query, excerpt, fetched_at, confidence)
```

Google Maps source records:

- `lead_sources.source_type` should support `google_maps_places_text_search`, `google_maps_places_nearby_search`, and `google_maps_place_details`.
- The durable source URL should usually be `googleMapsUri` plus the Google `place_id`; do not store raw Google response bodies unless the implementation has a documented retention/attribution policy that satisfies Google Maps Platform terms.
- `lead_run_results.source_snapshot_json` may carry bounded, policy-reviewed Maps metadata such as endpoint name, field mask, place id, Google Maps URI, business status, fetched timestamp, and non-sensitive normalized fields used for dedupe.
- Official website/domain evidence derived from `websiteUri` should be confirmed through `web_fetch` / `web_search` before it becomes the primary business-fit source.

Marketing reads:

- product ontology
- country/persona config
- prior lead dedupe keys
- shared lead identity pool after production dedupe is implemented

Marketing writes:

- `lead_runs`
- `lead_candidates`
- `lead_sources`
- `api_call_ledger`
- `handoff_events`

Marketing memory:

- successful query strategies
- blocked-source lessons
- high-quality buyer patterns

Do not write raw search result dumps or full contact lists to vector memory.

## 9. Concurrent Lead Discovery Dedupe

This section owns the solution to the User A / User B overlap problem.

Problem:

1. User A starts a 20-lead run that takes about 5 minutes.
2. At minute 2.5, User B starts a same or highly similar 20-lead run.
3. If both runs launch separate AgentChat sessions, the platform wastes search quota, returns duplicate companies, and creates sales ownership conflict.

Design principle:

- OpenClaw may run concurrent sessions, but business-level dedupe is Sentura's responsibility.
- Default behavior inside one tenant: share work, dedupe results, and only run top-up searches when the existing pool cannot satisfy the requested count.

Three dedupe layers:

1. Run-scope dedupe before starting an employee session.
2. Candidate-identity dedupe while saving results.
3. Allocation/ownership dedupe when users act on leads.

### 9.1 Scope Fingerprint

Normalize the request before sending anything to `cbe-lead-discovery`:

```json
{
  "tenant_id": "seller_001",
  "products": ["phone_case", "screen_protector", "charger"],
  "buyer_personas": ["electronics_retailer", "phone_repair_chain", "accessory_importer"],
  "countries": ["US", "GB", "DE"],
  "languages": ["en", "de"],
  "source_policy": ["public_web", "company_site_only"],
  "exclude_domains": ["facebook.com", "linkedin.com", "alibaba.com"],
  "time_window_hours": 24
}
```

Compute:

- `scope_hash`: exact hash of canonical JSON fields.
- `scope_similarity`: weighted overlap for near duplicates:
  - product/category overlap: 35%
  - buyer-persona overlap: 25%
  - country/region overlap: 25%
  - source policy/exclusion overlap: 10%
  - language overlap: 5%

Policy:

- `scope_hash` match: exact duplicate task shape. User B may join the same coordination scope, but must not receive the same customer rows as User A. The coordinator allocates only unique, unassigned customers to each human employee and top-ups any missing count.
- `scope_similarity >= 0.75`: likely overlap. User B sees an overlap warning and chooses unassigned-only top-up or narrower search; shared progress is allowed, shared duplicate customers are not.
- `scope_similarity < 0.75`: independent run, still candidate-deduped on save.
- Scope prediction is only a pre-run cost/backpressure hint. It is not the source of truth for business dedupe. The database identity/allocation tables are the source of truth before any candidate enters an employee's customer list.

### 9.2 Required Tables

```sql
lead_discovery_scopes(
  id,
  tenant_id,
  scope_hash,
  canonical_scope_json,
  status,
  active_agent_run_id,
  requested_total,
  produced_unique_count,
  locked_until,
  heartbeat_at,
  created_at,
  updated_at
)

lead_run_memberships(
  id,
  tenant_id,
  scope_id,
  lead_run_id,
  user_id,
  mode,
  requested_count,
  joined_at
)

lead_identities(
  id,
  tenant_id,
  identity_key,
  normalized_domain,
  normalized_company_name,
  country,
  confidence,
  first_seen_at,
  last_seen_at
)

lead_run_results(
  id,
  tenant_id,
  lead_run_id,
  lead_identity_id,
  rank,
  duplicate_status,
  duplicate_reason,
  source_snapshot_json,
  created_at
)

lead_allocations(
  id,
  tenant_id,
  lead_identity_id,
  allocated_to_user_id,
  source_lead_run_id,
  allocation_status,
  expires_at,
  allocated_at
)
```

Uniqueness and locking:

- `lead_discovery_scopes(tenant_id, scope_hash)` unique.
- `lead_identities(tenant_id, identity_key)` unique.
- `lead_run_results(tenant_id, lead_run_id, lead_identity_id)` unique.
- `lead_allocations(tenant_id, lead_identity_id)` unique for active allocations.
- `locked_until` is a lease, not a 5-minute database transaction.
- Run coordinator refreshes the lease every 30-60 seconds.

Identity-key precedence:

1. Alibaba first-party customer id if available.
2. Normalized company website domain.
3. Same-domain business email domain.
4. `country + normalized_company_name` fallback.

### 9.3 Runtime Flow

Exact duplicate:

1. A requests 20 leads.
2. Run coordinator computes `scope_hash` and acquires the scope lease.
3. Coordinator starts one `cbe-lead-discovery` AgentChat run.
4. B requests 20 leads for the same scope at minute 2.5.
5. Coordinator finds active scope lease and adds B to `lead_run_memberships`.
6. B sees shared progress, but B is not assigned A's customer rows.
7. When candidates return, the store reconciles them against `lead_identities`, `lead_candidates`, and active allocations before writing to any employee list.
8. If the active run yields fewer than 40 unique, unassigned customers for A+B combined, the coordinator starts a top-up run for the missing count with a database-derived `existing_identity_keys` denylist.
9. No duplicate customer appears in either employee's list.

Near duplicate:

1. B starts a similar request.
2. Coordinator computes `scope_similarity`.
3. If similarity is high, UI shows:
   - `已有相似获客任务正在运行，预计还需 2 分钟。`
   - `只看当前任务进度`
   - `只要未分配的新客户`
   - `缩小条件并重新搜索`
4. If B chooses unassigned-only results, coordinator waits for or consumes the active pool, counts unallocated unique leads, and starts only a missing-count top-up run.
5. If B narrows the search, it can start an independent run, but completion still must reconcile against the tenant database before writing results.

Example:

- A asks for 20.
- B asks for the same 20 at minute 2.5.
- A's active run may finish with 20 unique leads, but those 20 are assigned to A and are not reused as B's customer list.
- If B needs 20 not allocated to A and only 8 unallocated remain, top-up asks the employee for 12 additional unique leads with a database-derived `existing_identity_keys` denylist.

### 9.4 Result Reconciliation Contract

Pre-run scope prediction is intentionally conservative and can miss subset overlaps such as:

- User A: `phone case + tempered glass screen protector / GB + US`
- User B: `phone case / GB`

Therefore every Lead Discovery completion must run database reconciliation before writing visible customer rows:

1. Parse the employee marker into candidate objects.
2. Normalize domain, business email domain, company name, and country.
3. Query tenant-level `lead_identities`, `lead_candidates`, `lead_run_results`, and active/claimed allocations for each candidate.
4. Classify each candidate as:
   - `new_unique`: no existing tenant identity or allocation.
   - `duplicate_same_owner`: already in the same employee's list.
   - `duplicate_other_operator`: already assigned to another employee.
   - `duplicate_team_or_tenant`: already present in a team/tenant-shared pool.
   - `possible_duplicate`: fuzzy company-name/country match without a confirmed domain.
5. Only `new_unique` candidates may create visible employee customer rows by default.
6. Duplicate candidates are recorded in `lead_run_results` for audit/provenance but are not added to the employee's actionable customer list.
7. If `new_unique_count < requested_target_count`, the coordinator must immediately create a top-up run for `requested_target_count - new_unique_count`.
8. The top-up prompt must include all known tenant identity keys and already-used queries as denylist context.
9. The user-facing completion message must report returned, new unique, duplicate, possible duplicate, and top-up counts separately.

The business invariant is strict: no two human employees should be assigned the same buyer/customer unless a manager explicitly transfers or shares ownership through a separate workflow.

### 9.5 Top-Up Employee Task Contract

```json
{
  "run_mode": "top_up_unique_leads",
  "target_count": 4,
  "scope_hash": "sha256:...",
  "existing_identity_keys": [
    "domain:mobile-example.com",
    "company:US:mobile lab"
  ],
  "already_covered_queries": [
    "phone repair chain mobile accessories wholesale USA"
  ],
  "dedupe_instruction": "Do not return candidates whose domain, company name, or email domain matches existing_identity_keys."
}
```

### 9.6 UI Behavior For Concurrency

| Situation | UI behavior |
|---|---|
| Exact active duplicate | Show existing coordination progress, but explain that each employee will receive different unique customers. Do not assign the same customer rows to both employees. |
| High-overlap active run | Show overlap warning with choices: unassigned-only top-up or narrow search. |
| Finished same scope within TTL | Allocate only unassigned unique customers. Do not duplicate another employee's customer list. |
| User wants exclusive leads | Use allocation mode. Leads are reserved when written to the employee customer list, not merely when displayed in a shared pool. |
| Active run crashed | Lease expires, partial results remain; next user can resume/top-up rather than restart from zero. |

Recommended Chinese labels:

- `已有相同获客任务正在运行`
- `只看当前任务进度`
- `只补充未分配客户`
- `当前已发现 9/20 个唯一客户`
- `为避免重复客户，本次只会写入未分配的新客户`

### 9.7 Race-Condition Handling

Start-run transaction:

1. Insert `agent_runs` and `lead_runs` as `pending`.
2. Insert or fetch `lead_discovery_scopes` by `(tenant_id, scope_hash)`.
3. If scope has `status = running` and `locked_until > now()`, create `lead_run_memberships` with `mode = joined_existing` or `queued_top_up`; do not start AgentChat.
4. If no active lease exists, atomically set `active_agent_run_id`, `status = running`, `locked_until = now() + interval '90 seconds'`.
5. Start OpenClaw AgentChat after the lease is acquired.
6. Heartbeat the lease while the run is alive.
7. On completion, upsert candidates into `lead_identities`, create `lead_run_results`, update `produced_unique_count`, set status to `completed`, and clear active lease.

RBAC note:

- If A and B are in departments that cannot share lead details, the platform still dedupes at identity level but hides restricted details.
- B can run a top-up search with a hashed denylist so repeated public candidates are suppressed.

## 10. Implementation Plan

Already implemented:

- `cbe-lead-discovery` source workspace.
- Skills:
  - `lead-query-generation/SKILL.md`
  - `lead-deduplication/SKILL.md`
  - `lead-list-production/SKILL.md`
  - `handoff-to-screening/SKILL.md`
- Config/tool policy for public search/fetch.
- Setup registration and webchat binding.
- Lead Discovery UI route.
- Diagnostic Tavily route.
- AgentChat formal execution path.
- Result marker parsing.
- Inline source/dedupe table.
- Copy to Screening.
- Local UI state persistence.
- CE4 and CE7 validation coverage.

Still to implement:

- Production persistence migrations for `lead_runs`, `lead_candidates`, `lead_sources`, and the dedupe tables.
- Run-scope coordinator in the Dashboard/server layer.
- Shared result pool and progress stream for joined users.
- Top-up-only mode and `existing_identity_keys` denylist injection.
- Incremental candidate batch marker parsing.
- Lead allocation/claim UI and expiry policy.
- Automated concurrency tests.
- Optional paid search provider procurement/smoke tests from the selected China cloud region.

## 11. Source And Test Traceability

Relevant test rows:

- CE4 — Marketing Acquisition employee workspace.
- CE7 — Cross-border employee demo UIs.
- CE10 — Production cloud/database/multi-agent operating plan.
- CE12 — Concurrent Lead Discovery dedupe plan.

Relevant source docs and APIs:

- OpenClaw `web_search` / `web_fetch`: `https://docs.openclaw.ai/tools/web`
- OpenClaw config/tools: `https://docs.openclaw.ai/gateway/config-tools`
- Google Maps Platform Places API (New) Text Search: `https://developers.google.com/maps/documentation/places/web-service/text-search`
- Google Maps Platform Places API (New) Nearby Search: `https://developers.google.com/maps/documentation/places/web-service/nearby-search`
- Google Maps Platform Places API (New) Place Details: `https://developers.google.com/maps/documentation/places/web-service/place-details`
- Google Maps Platform Places API place data fields: `https://developers.google.com/maps/documentation/places/web-service/data-fields`
- Google Maps Platform place types: `https://developers.google.com/maps/documentation/places/web-service/place-types`
- Google Maps Platform usage, billing, quotas, and field masks: `https://developers.google.com/maps/documentation/places/web-service/usage-and-billing`
- Google Maps Platform policies: `https://developers.google.com/maps/documentation/places/web-service/policies`
- Google Maps Platform API key and security best practices: `https://developers.google.com/maps/documentation/places/web-service/get-api-key`, `https://developers.google.com/maps/api-security-best-practices`
- Google Business Profile APIs overview: `https://developers.google.com/my-business`
- Brave Search API: `https://brave.com/search/api/`
- Tavily search API: `https://docs.tavily.com/documentation/api-reference/endpoint/search`
- Tavily credits: `https://docs.tavily.com/documentation/api-credits`
- Exa search: `https://exa.ai/docs/reference/search`
- Exa pricing: `https://exa.ai/pricing`
- SerpApi: `https://serpapi.com/search-api`
- SerpApi pricing: `https://serpapi.com/pricing`
- Google Custom Search JSON API: `https://developers.google.com/custom-search/v1/overview`

Cost defaults:

- Search API: `$0-$30/month` during development.
- Use OpenClaw managed/free provider or Brave/Tavily low tier first.
- Paid API keys live in OpenClaw secrets / `~/.openclaw/.env`, never in config files or chat.

Safety defaults:

- No automatic outreach.
- No login-gated scraping.
- Every candidate must carry source URL(s), query string, timestamp, confidence, and dedupe explanation.
- Google Maps candidates are discovery seeds until web search/fetch or another independent public source confirms downstream buyer relevance.
- Google Maps review text/photos are optional human-review evidence only; do not write review text into vector memory or treat ratings as authenticity/KYB proof.
