# Cross-Border E-Commerce — Screening And Background Employee

> **On-demand reference — not read by default.**
>
> Back-link: [`DESIGN.md`](DESIGN.md)
>
> Agent id: `cbe-buyer-screening`
>
> Chinese name: 跨境筛选背调员工
>
> Last updated: 2026-06-23

This document owns all design, implementation details, current status, and forward plan for the Screening and Background Investigation employee in the mobile-accessory cross-border e-commerce customer lane. Shared platform architecture, database-wide schema, cloud deployment, and cross-agent flow live in [`DESIGN.md`](DESIGN.md). Marketing Acquisition details live in [`MARKET_ACQUISITION.md`](MARKET_ACQUISITION.md). Accio memory details live in [`MEMORY_PROCESSING.md`](MEMORY_PROCESSING.md).

## 1. Role And Current Status

The Screening employee investigates candidate buyers and returns authenticity/risk reports with evidence chains. It supports two intake modes:

1. Batch mode from Marketing Acquisition: accepts `LeadCandidate[]` and preserves `source_run_id`, source URLs, matched products, contact candidates, and dedupe fields.
2. Manual investigation mode: accepts company/email/domain/contact/person/product-interest inputs from Accio, email, trade fair, or offline sales context.

Phase-1 requirement: low-cost evidence route first; public web, registry, domain/email, trade, and financial evidence only where accessible and documented.

Implementation status as of 2026-06-23:

- Source workspace added: `sentura/agents/cbe-buyer-screening/`.
- Workspace uses exactly the 8 OpenClaw-native top-level files plus `config.json5` and skills.
- Skills added:
  - `evidence-collection/SKILL.md`
  - `registry-verification/SKILL.md`
  - `domain-email-verification/SKILL.md`
  - `trade-record-check/SKILL.md`
  - `buyer-scoring/SKILL.md`
  - `report-writing/SKILL.md`
- Config/tool policy allows `web_search`, `web_fetch`, `memory_search`, `memory_get`, and `cross-border-intel__*`.
- Setup registration and webchat binding added.
- UI route exists: `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`.
- Diagnostic provider adapter route exists: `sentura/dashboard/src/app/api/client-demos/cross-border/screening/run/route.ts`.
- Formal page run path now checks Gateway connectivity and `cbe-buyer-screening` registration, then sends the structured investigation task through the real employee AgentChat session.
- If the employee is not registered, the UI fails visibly rather than generating Dashboard-only reports.
- Employee-produced report JSON is normalized before rendering and before local-storage restore.
- Aliases such as `source_url`, `summary`, `detail`, `official_web`, `registry_tool`, and `marketing_lead_batch` populate the evidence timeline, missing-evidence panel, score blocks, and restored reports.
- The page restores last manual/batch input, source toggles, employee session key, selected report, and generated reports from same-origin local storage.
- Phase 2 typed persistence stores Screening targets, reports, evidence, score blocks, and dedicated Google Maps address locations through the CBE store/API boundary.
- Google Maps address-footprint reporting is implemented across the hidden Employee prompt, Screening workspace skills, marker/store schemas, dedicated `screening_address_locations` table, and shared Dashboard report UI.
- Scale-aware first-block scoring is implemented across the hidden Employee prompt, Screening workspace skills, MCP scoring schema/result shape, Dashboard normalization, shared report UI, and regression scripts. The first score block is displayed as `公司注册与线下门店/地址` while retaining `legal_identity` as the JSON block id.

Live provider status from the 2026-06-08 audit:

- Tavily: successful live response after adapter correction.
- SEC: successful no-key live response, including company-name/CIK route.
- Abstract Email Reputation: successful live response after endpoint correction.
- ImportYeti: successful live response after current request format correction.
- Companies House: `401 Invalid Authorization` despite official Basic-auth formatting; handled as `unavailable_api` coverage gap with official public-page fallback.
- Hunter: `429 restricted_account`; handled as provider-side coverage gap.

Report-driven production decision from the 2026-06-19/20 cloud pressure tests:

- The production Screening path must default to one company per `cbe-buyer-screening` AgentChat session.
- A user batch of 10 companies is valid as a UI/business request, but the server must split it into a parent batch task plus single-target child runs.
- Batch-3 is the only optional packed mode that remained clean in the reports, and it should stay behind a feature flag.
- Batch-5 and batch-10 must not be used in the normal production path: batch-5 produced compaction/thinner evidence and repeated paid calls; batch-10 failed with context overflow.
- Paid email and paid trade checks are allowed only as explicit, budgeted per-target calls and must be capped to one call per provider class per target unless the operator re-approves a fresh paid lookup.

## 2. Intake Schemas

Manual investigation input:

```json
{
  "investigation_target": {
    "source": "manual_input",
    "company_name": "Berlin Gadget Wholesale GmbH",
    "country": "DE",
    "website": "https://berlin-gadget-wholesale.example",
    "domain": "berlin-gadget-wholesale.example",
    "email": "daniel.weber@gmail.com",
    "contact_person": "Daniel Weber",
    "contact_title": "Owner",
    "social_or_profile_url": "https://www.linkedin.com/company/example",
    "product_interest": ["65W GaN charger", "EU plug charger"],
    "operator_notes": "客户来自 Accio 对话，需要先判断真实性。"
  }
}
```

Normalized internal target:

```json
{
  "target_id": "screen_target_20260608_0001",
  "source": "manual_input",
  "lead_id": null,
  "company_name": "Berlin Gadget Wholesale GmbH",
  "country": "DE",
  "domain": "berlin-gadget-wholesale.example",
  "email": "daniel.weber@gmail.com",
  "contact_person": "Daniel Weber",
  "product_interest": ["65W GaN charger", "EU plug charger"],
  "supplied_fields": ["company_name", "country", "domain", "email", "contact_person", "product_interest"],
  "missing_fields": ["official_registry_number"]
}
```

Rules:

- Batch and manual inputs must normalize into the same `InvestigationTarget` shape.
- Missing fields are allowed.
- The report must state whether each key field was supplied by the operator, inferred from search, or unavailable.
- Accio Memory handoff targets are treated as manual/contextual targets when they are not already Marketing leads.

## 3. UI Design

Role-level target UI for Employee users is defined in [`UI.md`](UI.md). This section describes the current implemented Screening demo workbench and its evidence/scoring behavior.

Route:

```text
/client-demos/cross-border/screening
```

Page goal: make background investigation understandable and controllable.

Primary layout:

- Top intake tabs:
  - `来自获客列表`: choose a lead batch or paste `LeadCandidate[]`.
  - `手动背调`: company name, country, website/domain, email, contact person, title, social/profile URL, notes, optional product interest.
- Left investigation queue:
  - pending
  - running
  - needs human clue
  - complete
  - insufficient evidence
  - high risk
- Batch controls:
  - run low-cost checks
  - enable paid trade check for selected targets
  - export reports
- Center evidence workspace:
  - legal registry
  - domain/email
  - Google Maps 地址版图
  - website/social footprint
  - trade/customs
  - financial/public filing
  - behavior
- Right score/report panel:
  - contextual score gauge
  - evidence coverage meter
  - follow-up tier
  - forced-downgrade flags
  - recommended next action
  - live `cbe-buyer-screening` AgentChat surface

Display rules:

- Every evidence card shows source type, confidence, cost, and whether it affects score or only coverage.
- Missing API evidence is shown as `未启用/不可用`, not as a fraud signal.
- Final score already includes evidence coverage, e.g. `79.33/100 · 中等 · 证据覆盖 90%`.
- If coverage is low but at least one scored block exists, show the lower final score and explain which evidence would raise it; use `证据不足` only when no normal score can be computed.
- If behavior is not applicable, display `行为记录：未适用（冷启动潜客）` rather than `0/15`.

## 4. Low-Cost Evidence Ladder

The employee must use the following ladder in order:

1. Company scale assessment: classify the target as `listed_or_public`, `medium_large_registered`, `small_local_offline`, `small_online_only`, or `unknown_scale`.
2. Company registration and offline-address authenticity: use registry/disclosure evidence plus Google Maps offline store/address evidence according to the scale-aware scoring rules in §10.
3. Website/domain/email credibility.
4. Google Maps address footprint and broader public local presence.
5. Public digital footprint.
6. Trade behavior / customs evidence.
7. Financial/public filing evidence where applicable.
8. Conversation behavior signals only if Accio history or sales interaction exists.

Evidence source tags:

- `official_api`
- `official_registry_page`
- `public_web`
- `google_maps_places`
- `google_maps_address_validation`
- `public_dns`
- `paid_trade_data`
- `demo_fixture`
- `self_reported`
- `unverified`

Execution granularity:

- Default: one target per session.
- Optional experiment: up to 3 targets per session only when `CBE_SCREENING_ALLOW_BATCH3=true`, load is low, and paid checks are disabled or already budgeted.
- Forbidden production path: 5 or 10 targets in one Screening session.
- Batch UI submissions should be represented as parent/child tasks in the CBE store so one failed target can be retried without rerunning completed siblings.

## 5. Registry Checks

| Country / source | Route | Cost / rate posture | Decision |
|---|---|---|---|
| UK Companies House | REST API `GET https://api.company-information.service.gov.uk/search/companies?q=...`, then `GET /company/{companyNumber}`. Auth is HTTP Basic with API key as username and blank password: `Authorization: Basic base64(API_KEY + ":")` / `curl -u API_KEY:`. No-key fallback: official public HTML search at `https://find-and-update.company-information.service.gov.uk/search/companies?q=...`. | Free public data; REST requires API key. Official limit is 600 requests per 5 minutes per application. | Current default for GB. Use API first when key works; if missing/401/403/429, fall back to official public page and mark `official_registry_page` or `unavailable_api`. |
| US SEC EDGAR | Resolve company name/ticker through `https://www.sec.gov/files/company_tickers.json`, then bounded `GET https://data.sec.gov/submissions/CIK##########.json`; use descriptive `User-Agent`. | Free; no auth/API key. SEC fair access limit is 10 requests/sec. | Current default for US public companies/SEC filers only. Do not treat `not_found` as negative for private importers. Only keep summary fields such as entity name, CIK, SIC, ticker/status, and recent filing summary; do not carry raw submissions history into prompts. |
| France official registry | API Recherche d'Entreprises for SIREN/SIRET/name/address/status; API Entreprise only after customer habilitation/token approval. | Public search is low-cost but rate-limited; API Entreprise has per-habilitation limits and 429/Retry-After behavior. | Planned adapter, not current default. When added, use response headers for throttling and store unsupported/denied access as coverage gap. |
| Japan official registry | National Tax Agency Corporate Number Publication Site / Web-API for 13-digit corporate number, name, address, and changes. | Free application ID required for Web-API; official site also has searchable public pages and downloadable data. | Planned adapter. Do not confuse Corporate Number basic identity data with full legal/financial due diligence. |
| Korea official disclosures | OpenDART for listed/disclosing companies; public web/registry clues for small private importers. | Free authentication key (`crtfc_key`) required; request-limit errors are explicit provider statuses. | Planned adapter. DART `not_found` is neutral for private importers. |
| Brazil CNPJ | Receita Federal / Redesim official CNPJ page for manual/free checks; Serpro Consulta CNPJ/CNPJ API for automated official access; BrasilAPI only as public aggregation if used. | Serpro is contracted/paid official API; public pages may have human verification; aggregation sources are not official_api. | Planned adapter. Do not mark BrasilAPI-only evidence as official registry evidence. |
| OpenCorporates | `GET https://api.opencorporates.com/v0.4/companies/search?q=...`. | Paid commercial fallback. | Not default. Add only behind paid-source configuration when the customer buys a plan or when a country has no usable official API/page path. |
| Germany / Spain / Italy / Mexico official records | Official registry pages/manual portals; Spain/Italy often paid report flows; Mexico registry data is distributed by state and SAT RFC validation is separate. | No stable self-serve REST API assumed from the supplied pricing report. | Use web search to find official registry pages and capture source URLs; do not claim API-backed verification unless a concrete adapter/access proof exists. |

Ordering corrections already implemented:

- GB targets must call Companies House before web fallback.
- US targets must resolve company name/CIK through SEC before state-registry web fallback.
- Non-2xx provider responses are coverage gaps, not fraud evidence.

### 5.1 Country-Aware Verification Playbooks

These country routes are the operational instructions for the Screening employee and the future adapter backlog. They intentionally distinguish current MCP tools from future API/account preparation.

| Country | Best first evidence | When to escalate | Agent report wording |
|---|---|---|---|
| GB | Companies House API/profile; if the key fails, official public Companies House page. | Escalate to OpenCorporates only if Companies House is unavailable and the user approved paid fallback. | `official_api` for Companies House API; `official_registry_page` for public Companies House HTML; missing key is `unavailable_api`. |
| US | SEC only for public-company/filer checks; state registry/official website/public footprint for private importers; ImportYeti/Volza only after paid trade approval. | Escalate to paid trade data when the buyer claims importer/distributor scale or when trade evidence materially improves confidence. | SEC `not_found` for private companies is `not_applicable`; missing import data is coverage gap. |
| FR | Search API Recherche d'Entreprises for SIREN/SIRET and basic identity after adapter exists; otherwise official French registry/search result URLs. | Use API Entreprise only after customer habilitation and legal-use approval. | If only public search evidence exists, say "官方公开检索/页面证据", not API-backed verification. |
| JP | Corporate Number Publication Site/Web-API for corporate number/name/address; public website/domain checks for business fit. | Ask operator for corporate number when name matching is ambiguous; legal registry extracts remain human/manual. | Corporate Number confirms basic identity only; it is not a trade-credit or financial-risk score. |
| KR | OpenDART for listed/disclosure entities; public footprint and domain/email for ordinary private buyers. | Ask for Korean corporate registration number or official profile URL if DART does not match. | DART no result should not lower score unless the buyer claims public/listed status. |
| BR | Receita Federal/Redesim CNPJ official proof when CNPJ is available; Serpro for automated official scale; website/domain/public footprint otherwise. | Ask for CNPJ when missing; use Serpro only after customer contract/key exists. | BrasilAPI or other aggregators, if used later, are `public_api`/supporting evidence, not `official_api`. |
| DE | Unternehmensregister/Handelsregister official page, registration number, city, legal form, and website footer consistency. | Escalate to OpenCorporates or a paid KYB provider for scale or director/shareholder data. | No self-serve REST route is assumed; evidence is official-page/manual unless a signed provider adapter exists. |
| ES | Registro Mercantil Central/provincial registry and BORME notices; collect CIF/NIF and official company extract when available. | Paid RMC/registradores extract when high-value or ambiguous. | Signed/purchased extract is stronger than search snippet; no API-backed claim without adapter. |
| IT | Registro Imprese/InfoCamere pages, PEC, REA, visura, annual accounts when available. | InfoCamere API/Telemaco contract for automated official reports. | Official-page or uploaded visura evidence should stay source-linked and timestamped. |
| MX | SIGER/RPC official registry and SAT RFC validation only when RFC is provided. | Ask operator for RFC/folio/official state registry clue before drawing conclusions. | RFC validity is tax-id evidence, not full company-register verification. |

Implementation backlog:

- Add one adapter at a time, starting with France/Japan/Korea/Brazil only after schema, source tags, fixtures, and rate-limit tests exist.
- Do not add country-specific API env vars to `scripts/sentura-setup.*` until the adapter is implemented and the MCP server tests prove missing-key behavior.
- Every new country adapter must return provider status, source URL, fetched timestamp, rate-limit metadata when available, and a confidence value that the scoring tool can consume.
- Unsupported country or denied provider access must be `unavailable_api` / `pending_human_input`, never fraud evidence.

### 5.2 Company Scale Assessment And First Score Block

The first score block is now the 25% `公司注册与线下门店/地址` block. Its storage id can remain `legal_identity` for backward compatibility, but the report label and scoring explanation must make clear that the block measures practical company existence/authenticity, not only formal registry lookup.

Why this change exists:

- Current low-cost registry APIs are strong for listed companies, public filers, and larger registered companies, but many real small retailers, phone repair shops, accessory stores, and local distributors are absent from accessible registry APIs or are hard to match by English name.
- Penalizing those small companies only because Companies House/SEC/OpenDART/etc. cannot match them creates false negatives.
- Google Maps Places can provide strong offline-existence evidence for these small businesses when the listing has a physical address and an operational business status.

Required scale assessment:

| Scale class | Signals | First-block strategy |
|---|---|---|
| `listed_or_public` | SEC/DART/listed-company disclosure, public ticker, annual reports, official investor/disclosure pages. | Registry/disclosure evidence is mandatory primary evidence; Google Maps is supporting local-presence/address consistency. |
| `medium_large_registered` | Official registry match, multiple branches, strong domain, importer/distributor scale, trade/financial evidence, or corporate office evidence. | Fuse registry evidence and Google Maps address-footprint evidence. Lack of registry/API match is a coverage gap only until the company claims regulated/listed/large scale. |
| `small_local_offline` | One or a few stores/offices/repair/service locations, Google Maps category aligns, physical address exists, business is `OPERATIONAL`, website/domain may be weak or absent. | Google Maps can satisfy the first block as real-company/offline-existence evidence when name/category/address confidence is high. |
| `small_online_only` | Website/social marketplace presence but no physical storefront expected. | Do not require Google Maps; first block needs official/business-domain/public source consistency and may remain `pending_human_input` if no stable source exists. |
| `unknown_scale` | Insufficient clues. | Try both registry and Maps; report missing clues instead of forcing a negative. |

For `small_local_offline`, an operational Google Maps Place with a physical address should be treated as satisfying the company-registration/authenticity block for sales-screening purposes when all of the following hold:

- `businessStatus` is `OPERATIONAL`.
- `formattedAddress` is present and Address Validation is `validated`, `complete`, or otherwise not contradictory when validation is available.
- Display name, category/types, country/city, and product/business context plausibly match the target.
- The place is deduped and not rejected as unrelated.
- Any available website, phone, or official-site/store-locator evidence does not contradict the Maps listing.

This does not mean Google Maps is a formal legal registry, director/shareholder proof, credit report, or KYB certificate. The report must phrase it as `线下经营真实性已由 Google Maps 公开门店/地址证据支持`, not `官方注册已验证`.

## 6. Domain And Email Checks

Free checks:

- Email syntax and normalization.
- Domain extraction.
- Free-provider flag (`gmail.com`, `outlook.com`, `yahoo.com`, etc.).
- Role inbox flag (`sales@`, `info@`, `admin@`, and localized equivalents when encountered).
- DNS MX lookup.
- DNS TXT lookup for SPF and DMARC.
- RDAP lookup through `https://rdap.org/domain/{domain}` at low volume.
- For scale, use IANA RDAP bootstrap registries instead of RDAP.org because RDAP.org documents a 10 requests / 10 seconds Cloudflare limit.
- Official-site contact email search before paid validation: fetch bounded official website pages and extract same-domain public emails while ignoring third-party/free-provider addresses.

Production rate/cost rules:

- RDAP.org is acceptable for low-volume demo and pilot checks, but it is limited to 10 requests / 10 seconds. For sustained production volume, move to an IANA bootstrap RDAP client or a budgeted WHOIS/RDAP provider rather than retrying through RDAP.org.
- Paid email validation may call Abstract and Hunter only when `enable_paid_validation=true`, the operator/request budget allows it, and the email is either operator-supplied or discovered as a same-domain email on the target's official website.
- Do not paid-validate third-party directory emails, public social-page emails, or free-provider addresses discovered by search unless the operator explicitly supplied that address as the investigation target.
- Per target, paid email validation is capped to one Abstract/Hunter validation pass unless the user explicitly re-approves another paid lookup after a retry.

Optional paid checks:

| Provider | API route / behavior | Public price verified | Decision |
|---|---|---|---|
| Abstract Email Reputation | `GET https://emailreputation.abstractapi.com/v1/?api_key=...&email=...`; response includes `email_deliverability`, `email_quality`, `email_domain`, risk, and breach signals. | Free 100 requests/month. Starter $17/month paid annually for 60,000 requests/year. Standard $37/month paid annually. Professional $39/month paid annually. | Best low-cost optional add-on after free DNS checks. |
| Hunter | Email Verifier API; verifier costs 0.5 credit/call, Domain Search costs 1 credit for 1-10 emails, Email Count is free. | Free 50 credits; Starter $49/month or $34/month yearly; Growth $149/month or $104/month yearly; Scale $299/month or $209/month yearly. | Use only for verifier in the default Screening path. Domain Search/Finder is a sales-enrichment expansion and needs separate approval/budget. |
| ZeroBounce | Email verification API. | Minimum PAYG purchase 2,000 credits for $39; free account includes 100 monthly credits. | More expensive for MVP; fallback for deliverability-sensitive production. |

## 7. Social And Digital-Footprint Checks

Phase 1 uses public search and fetch only:

- Search for official website.
- Search public LinkedIn company result via `site:linkedin.com/company`.
- Search public Facebook/Instagram business pages via web search only.
- Search YouTube channels related to repair/e-commerce when relevant.
- Fetch public pages for title, description, product/category evidence, contact page, and last-updated hints.

Do not:

- log in to LinkedIn/Meta/X;
- scrape protected pages;
- rely on official LinkedIn API as a low-cost route;
- rely on Meta/Instagram Graph API before app review/business-asset approval.

## 7.1 Google Maps / Places Checks

Google Maps Places is useful for Screening when the target is a storefront, repair chain, electronics retailer, phone shop, local wholesaler, or distributor with public local presence. It is not a formal company registry, trade database, credit bureau, or proof of legal ownership. However, for small local/offline businesses, a high-confidence `OPERATIONAL` Google Maps Place with a physical address can satisfy the 25% company-registration/authenticity score block as practical offline-existence evidence.

Target design after Google Maps integration:

| Screening question | Google Maps field/source | How to interpret |
|---|---|---|
| Does the business appear to operate at a real public location? | Place Details `businessStatus`, `formattedAddress`, `googleMapsUri`, `regularOpeningHours`. | Positive public-footprint signal when `OPERATIONAL`; `CLOSED_PERMANENTLY` is a caution/blocker unless web evidence shows relocation/rebrand. |
| Can a small local/offline company be treated as real even when registry APIs do not find it? | Place Details `businessStatus`, `formattedAddress`, `types`, `googleMapsUri`; Address Validation verdict where available. | For `small_local_offline`, a matched `OPERATIONAL` place with physical address and non-contradictory name/category/address evidence can satisfy the first 25% company-registration/authenticity block. |
| Does the Maps profile connect to the same official website/domain? | Place Details `websiteUri`, then OpenClaw `web_fetch` of that website. | Stronger domain/business-fit evidence when website domain matches operator-supplied lead or official site. |
| Does the phone/address align with other public sources? | Place Details `internationalPhoneNumber` / `nationalPhoneNumber`, `formattedAddress`; registry/website/footer search. | Supporting evidence only; conflicts require explanation or human clue. |
| Is the company in the right business category? | Place types plus Text Search query intent. | Use as weak category evidence; confirm with official site/product pages. |
| Is there enough public customer footprint for human confidence? | `rating`, `userRatingCount`, optional reviews only with attribution and policy compliance. | Business-footprint context, not fraud proof or sales quality score. |

Implementation rules:

- Use Google Maps Places API (New) through a read-only MCP/server-side adapter, not from browser/client JavaScript and not directly from employee prompt code.
- Request narrow field masks. Default Screening details should not fetch reviews/photos.
- Preserve source attribution and `googleMapsUri` whenever Google place data appears in UI/report evidence.
- Store durable `place_id` and source metadata only according to Google Maps Platform policies. Avoid long-term storage of raw place responses, review text, or photos unless the implementation explicitly documents retention/attribution compliance.
- Missing Maps result is neutral. Many legitimate importers/distributors have weak or no storefront listing.
- Do not use Business Profile API for third-party backchecks; it is for managing merchant-owned locations.

Recommended Screening evidence mapping:

| Score block | Maps contribution |
|---|---|
| `legal_identity` / `公司注册与线下门店/地址` | For `listed_or_public` and `medium_large_registered`, Maps supports registry/disclosure evidence through name/address/website consistency. For `small_local_offline`, an `OPERATIONAL` matched place with physical address can satisfy this block as offline-existence evidence, while still not being formal legal/KYB proof. |
| `domain_email` | Positive support when `websiteUri` matches the official domain and the site has MX/SPF/DMARC or same-domain contact email. |
| `public_footprint` | Positive support from `OPERATIONAL` status, stable address, opening hours, Maps URI, and non-trivial rating count. |
| `business_fit` | Weak support from place types/search query; must be strengthened by official-site category/product evidence. |
| `trade_financial` | None. |
| `conversation_behavior` | None. |

Recommended status language:

- `google_maps_operational_match`: Maps profile is operational and website/name/city align with the target.
- `google_maps_needs_cross_check`: Maps listing exists but website/domain/category is missing or ambiguous.
- `google_maps_closed_or_moved`: Google business status indicates closed/permanently closed or web evidence suggests relocation.
- `google_maps_not_found`: no matching place; coverage gap only.

### 7.1.1 Google Maps Address Footprint Workflow

New Screening requirement: when investigating one company, the employee must attempt to discover the full Google Maps address footprint for that company and render it as a dedicated report section that is visually and semantically separate from ordinary evidence cards.

Definition of "full" for this workflow:

- It means "all company-related Google Maps Places that can be discovered through bounded, source-attributed Places searches and confirmed by details/cross-checks."
- It does not mean a legal guarantee of every registered branch, franchise, warehouse, or office worldwide. Google Maps is a public place directory, not a corporate branch registry.
- If the search is capped, ambiguous, or likely incomplete, the report must show an explicit coverage note such as `Google Maps returned more candidate places than the configured cap` or `Only one likely place matched the supplied company/domain`.

Search procedure:

1. Build query variants from the target's legal name, brand/trade names, supplied country, city/region, website domain, phone when available, and official-site location/address pages discovered through `web_search` / `web_fetch`.
2. Run bounded `cbe_intel_google_places_search` Text Search queries for exact company/brand name plus country, company/brand name plus city/region, company/brand name plus product/business category, and domain or website brand name plus country when an official website is known.
3. Deduplicate candidate Places by `google_place_id`, normalized address, phone, website domain, and normalized display name.
4. Call `cbe_intel_google_place_details` for every shortlisted unique place up to the configured per-target cap, using an address-footprint field-mask profile.
5. For each unique formatted address, call `cbe_intel_google_address_validate` when the address is complete enough and within the per-target validation cap.
6. Cross-check each place against official website/store-locator/footer pages, registry/public-page address where available, domain/website match, phone match, and product/category fit.
7. Classify every discovered place as `confirmed_company_location`, `probable_company_location`, `possible_related_location`, or `rejected_unrelated_location`.

Address types:

| Type | When to use |
|---|---|
| `headquarters_or_office` | Official website, registry page, or Maps category suggests office/headquarters/corporate location. |
| `storefront` | Place types/category/opening hours suggest retail shop, phone store, repair shop, electronics store, or public-facing branch. |
| `warehouse_or_distribution` | Website/public text suggests warehouse, depot, wholesaler, distributor, or fulfillment location. |
| `service_or_repair_location` | Place types/category indicate repair/service center. |
| `unknown_business_location` | Address is likely related but business role is unclear. |

Report-display requirement:

- Add a top-level, standalone section named `Google Maps 地址版图` or `Google Maps Address Footprint`.
- Place it after the executive conclusion / score summary and before the generic evidence timeline, so users see the company's physical footprint before reading individual evidence details.
- Render it as a distinct panel, not as another generic evidence card:
  - summary strip: total discovered locations, confirmed/probable/possible counts, operational/closed counts, countries/cities covered, and whether search was capped.
  - grouped address table/cards by `confirmed`, `probable`, and `needs_review`.
  - each row/card shows display name, inferred address type, formatted address, city/region/country, business status, website/domain, phone when allowed, Google Maps URI, Address Validation verdict, match confidence, and match reason.
  - if more than 8 locations exist, show a compact table first and let the report drawer expand all rows.
  - do not mix this section into score-block detail; score-block effects stay summarized separately.

Scoring and safety:

- Address footprint can support `public_footprint`, `domain_email`, and `business_fit` when there is domain/phone/category consistency.
- For `small_local_offline` companies, address footprint can also satisfy the first `legal_identity` / `公司注册与线下门店/地址` block when at least one confirmed or probable company location is `OPERATIONAL`, has a physical address, and has no conflicting website/registry/public evidence.
- For `listed_or_public` and `medium_large_registered` companies, address footprint is fused with registry/disclosure evidence and must not replace registry/disclosure evidence by itself.
- Missing Google Maps addresses are neutral coverage gaps.
- `CLOSED_PERMANENTLY` or many closed locations can create a caution flag, but the report must check official website/registry/web evidence for relocation or rebrand before treating it as a blocker.
- Store/display only bounded normalized place metadata: place id, display name, formatted address, business status, types, website URI/domain, phone if already allowed, Maps URI, fetched timestamp, field mask, attribution, and validation verdict. Do not store raw Google responses, reviews, photos, or long user-generated text by default.

## 8. Customs And Trade-Record Checks

| Source | API / route | Public price verified | Decision |
|---|---|---|---|
| ImportYeti | `GET https://data.importyeti.com/v1.0/company/search?name=...&page_size=...` with `IYApiKey`; other company/BOL routes need API key. | The 2026-06-20 pressure report used it as the paid trade-data path and observed about `$0.09` per target in its cost ledger, while an earlier tool-connectivity report saw credits remain unchanged for the tested company-search calls. Treat cost as configured/observed, not guaranteed free. | Current preferred paid trade source for US import evidence when the customer enables paid trade data. Use at most once per target with `max_records <= 5` and `max_paid_spend_usd <= 1` unless a different approved budget is configured. |
| Volza | Global Trade API, Buyer Insights API, Supplier Insights API, Decision Maker Contact API. | Global search $0.10/search; data from $0.02/record; Buyer/Supplier Insights $5/report; decision-maker contact $1.50/record. | Best paid Phase-1 add-on with capped budget. |
| Panjiva | REST API with Bearer Token; shipment, company, contact data. | Public pricing not exposed; enterprise sales. | Post-MVP only. |
| ImportGenius | Global trade data platform; account/sales-oriented API and pricing. | Public API price not reliably captured. | Post-MVP or manual human research source. |

Trade-data rule:

- Missing customs/trade data does not mean the company is fake.
- Missing trade data lowers evidence coverage and therefore affects the final score through the 20% coverage component, but it must not be treated as fraud evidence.
- Paid trade data is never called by Lead Discovery. It is Screening-only and only after the operator has enabled paid trade data for the target/run.
- Retrying a Screening child run must not repeat ImportYeti/Volza unless prior paid-call state is missing or the user explicitly approves another paid check.

## 9. Financial Checks

Low-cost route:

- SEC EDGAR for US public companies or SEC filers.
- Official company annual reports found through public web search/fetch.
- Registry filing history where the registry exposes it.

Not Phase 1:

- D&B
- Creditsafe
- Experian
- S&P Capital IQ
- direct credit-risk scoring

## 10. Contextual Scoring Model

The PDF's 60/25/15 model remains the long-term reference:

- authenticity 60
- business fit 25
- behavior signal 15

Phase 1 uses contextual scoring because cold leads have no behavior record yet, and paid APIs may be disabled.

Principles:

1. Score only evidence blocks applicable to the current context.
2. Make `normalized_score` the single final score: evidence quality 80% + evidence coverage 20%.
3. Mark unavailable paid/API evidence as `unavailable_api` or `disabled_by_budget`; do not silently penalize as fraud.
4. Show `evidence_coverage` separately as an explanation for the final score, not as a hidden second tier.
5. Forced downgrades must be reflected in the final score, e.g. cap at 59, so the visible score and tier stay consistent.
6. Always run company-scale assessment before scoring the first block. Small local/offline companies must not be punished only because registry APIs cannot find them.

Evidence statuses:

| Status | Meaning | In score denominator? | In coverage denominator? |
|---|---|---:|---:|
| `scored` | Evidence was checked and produced positive/negative/neutral points. | Yes | Yes |
| `not_applicable` | Block does not apply, e.g. behavior for a cold lead. | No | No |
| `unavailable_api` | Relevant block but required API/key/source unavailable. | No | Yes |
| `disabled_by_budget` | Relevant block but paid check disabled. | No | Yes |
| `pending_human_input` | Needs operator clue such as registry number or legal name. | No | Yes |

Default block library:

| Block | Max points | Applicable when | Low-cost source |
|---|---:|---|---|
| `legal_identity` (`公司注册与线下门店/地址`) | 25 | company name, registry number, Google Maps place, physical address, or stable public company identity exists | Scale-aware fusion of registry/disclosure evidence and Google Maps offline store/address evidence |
| `domain_email` | 25 | domain, website, or email exists/can be discovered | DNS MX/SPF/DMARC, RDAP, email syntax/free-provider/disposable checks, optional Abstract/Hunter |
| `public_footprint` | 20 | website, Maps place, social/profile URL, or public search result exists | `web_search`, `web_fetch`, Google Maps Places local-presence evidence, public LinkedIn/company pages, Facebook/Instagram/YouTube public snippets |
| `business_fit` | 20 | product interest or discovered category evidence exists | website categories, search snippets, Accio product requests, lead matched products |
| `trade_financial` | 10 | country/source supports affordable check or paid data enabled | ImportYeti/Volza/SEC/annual report/registry filings |
| `conversation_behavior` | 15 | Accio chat or sales interaction exists | Accio Memory summary, CRM/chat transcript, manual sales notes |

### 10.1 Company Scale-Aware First Block

The first block is fixed at 25 points in the score model and should be displayed as `公司注册与线下门店/地址`. The implementation may keep the JSON block key `legal_identity` for backward compatibility.

For `listed_or_public` and `medium_large_registered` companies:

- Registry/disclosure/official-page evidence should drive the majority of the block.
- Google Maps evidence can add confidence for office/store/address/domain consistency.
- A claimed listed/public/large company with no registry/disclosure match should not receive a full first-block score from Maps alone.
- Suggested allocation: registry/disclosure identity up to 15 points; Google Maps address/local-presence consistency up to 10 points.

For `small_local_offline` companies:

- Google Maps can be the primary source for the first block.
- If there is at least one confirmed/probable company location with `businessStatus=OPERATIONAL`, a physical address, plausible category/type, and no contradictory website/registry evidence, score the company-registration/authenticity block as real for sales-screening purposes.
- Full 25/25 is allowed when name/category/country-city alignment is strong and either website, phone, Address Validation, or official-site/store-locator evidence supports the listing.
- 20-23/25 is appropriate when Maps strongly proves an operating physical business but website/phone/domain corroboration is weak.
- 0-8/25 is appropriate for `CLOSED_PERMANENTLY`, rejected/unrelated listings, no physical address, or material contradictions unless relocation/rebrand evidence explains the issue.

For `small_online_only` and `unknown_scale` companies:

- Do not require a Maps listing if the business model does not imply a storefront.
- Use domain/email/public-source stability and operator-provided clues; mark missing registry/API evidence as `pending_human_input` or `unavailable_api`, not fraud.

Formula:

```text
applicable_blocks = blocks where status != not_applicable
scored_blocks = blocks where status == scored
score_denominator = sum(max_points of scored_blocks)
raw_score = sum(earned_points of scored_blocks)
quality_score = raw_score / score_denominator * 100
evidence_coverage = sum(max_points of scored_blocks) / sum(max_points of applicable_blocks)
normalized_score = quality_score * 0.8 + evidence_coverage * 100 * 0.2
```

If `score_denominator` is `0`, return `risk_tier="insufficient_evidence"` and explain minimum clues needed.

Risk tiers:

- `trusted_candidate`: final normalized score >= 80.
- `cautious`: final normalized score 60-79.
- `high_risk`: final normalized score < 60.
- `insufficient_evidence`: no scored evidence blocks, so no normal score can be computed.

Forced downgrade rules:

- Company name cannot be matched to any registry or stable official source, and website/domain is younger than 90 days.
- Contact uses only disposable/free email and no business domain can be verified.
- Website claims a different company/legal name than registry and no explanation is found.
- Customs/trade evidence materially contradicts claimed country or product category.
- Public sources show fraud/scam accusations from credible official or repeated independent sources.
- Accio chat asks for abnormal payment/compliance behavior, e.g. unrelated third-party bank payment before formal order.

Public adverse correction already implemented:

- Public adverse downgrades must be target-specific to company/domain evidence.
- Generic scam-warning pages must not force `high_risk`.

Cold lead scoring example:

```json
{
  "score": {
    "profile": "cold_lead_low_cost",
    "normalized_score": 79.33,
    "evidence_coverage": 0.9,
    "risk_tier": "cautious",
    "blocks": [
      {
        "block": "legal_identity",
        "status": "scored",
        "max_points": 25,
        "earned_points": 19,
        "source_count": 2
      },
      {
        "block": "domain_email",
        "status": "scored",
        "max_points": 25,
        "earned_points": 20,
        "source_count": 3
      },
      {
        "block": "public_footprint",
        "status": "scored",
        "max_points": 20,
        "earned_points": 15,
        "source_count": 4
      },
      {
        "block": "business_fit",
        "status": "scored",
        "max_points": 20,
        "earned_points": 15,
        "source_count": 2
      },
      {
        "block": "trade_financial",
        "status": "disabled_by_budget",
        "max_points": 10,
        "earned_points": null,
        "reason": "Volza/ImportYeti key not enabled for this demo run"
      },
      {
        "block": "conversation_behavior",
        "status": "not_applicable",
        "max_points": 15,
        "earned_points": null,
        "reason": "Cold lead from Marketing; no Accio or sales conversation yet"
      }
    ]
  }
}
```

## 11. Screening Report Schema

```json
{
  "report_id": "screen_20260607_0001",
  "lead_id": "lead_20260607_0001",
  "target_source": "marketing_lead",
  "company_name": "Example Mobile Distribution Ltd",
  "risk_tier": "cautious",
  "normalized_score": 79.33,
  "evidence_coverage": 0.9,
  "recommended_action": "谨慎跟进，要求对方使用公司域名邮箱确认需求，并补充公司注册号或采购历史以提高评分。",
  "score_blocks": [
    {
      "block": "legal_identity",
      "status": "scored",
      "max_points": 25,
      "earned_points": 19,
      "summary": "Company active; registered address matches website footer."
    },
    {
      "block": "conversation_behavior",
      "status": "not_applicable",
      "max_points": 15,
      "earned_points": null,
      "summary": "Cold lead from Marketing; no Accio or sales conversation exists yet."
    }
  ],
  "address_footprint": {
    "section_title": "Google Maps 地址版图",
    "coverage_status": "found",
    "search_scope": {
      "queries_run": [
        "Example Mobile Distribution Ltd US",
        "Example Mobile Distribution phone accessories New York"
      ],
      "countries": ["US"],
      "capped": false,
      "limitations": []
    },
    "summary": {
      "total_locations": 2,
      "confirmed_locations": 1,
      "probable_locations": 1,
      "possible_related_locations": 0,
      "operational_locations": 2,
      "closed_locations": 0,
      "countries": ["US"],
      "cities": ["New York", "Brooklyn"]
    },
    "locations": [
      {
        "google_place_id": "places/ChIJexample",
        "display_name": "Example Mobile Distribution",
        "address_type": "headquarters_or_office",
        "relationship_status": "confirmed_company_location",
        "formatted_address": "123 Example Ave, New York, NY 10001, USA",
        "city": "New York",
        "region": "NY",
        "country": "US",
        "business_status": "OPERATIONAL",
        "types": ["electronics_store", "wholesaler"],
        "website_uri": "https://example-mobile.example",
        "domain_match": true,
        "phone_match": "not_checked",
        "address_validation": {
          "status": "validated",
          "address_complete": true,
          "possible_next_action": "ACCEPT"
        },
        "google_maps_uri": "https://maps.google.com/?cid=example",
        "match_confidence": 0.91,
        "match_reasons": ["display name match", "website domain match", "category fit"],
        "source_type": "google_maps_places",
        "fetched_at": "2026-06-22T00:00:00Z"
      }
    ],
    "open_questions": [
      "未在官网找到完整 store locator；Google Maps 地址版图按公开 Maps 可发现地点生成。"
    ]
  },
  "evidence": [
    {
      "layer": "registry",
      "source_type": "official_api",
      "source": "Companies House",
      "url": "https://api.company-information.service.gov.uk/company/12345678",
      "finding": "Company active; registered address matches website footer.",
      "score_block": "legal_identity",
      "score_impact": "positive"
    },
    {
      "layer": "domain_email",
      "source_type": "public_dns",
      "source": "DNS MX/TXT/RDAP",
      "finding": "Domain has MX and SPF; RDAP creation date older than 3 years.",
      "score_block": "domain_email",
      "score_impact": "positive"
    }
  ],
  "open_questions": [
    "未找到可验证的海关记录；如果客户愿意购买 Volza Buyer Insights，可进一步确认采购历史。"
  ],
  "missing_or_unavailable_evidence": [
    {
      "block": "trade_financial",
      "status": "disabled_by_budget",
      "recommended_next_step": "如需提高证据覆盖率，可为此客户启用一次 Volza Buyer Insights。"
    }
  ],
  "created_at": "2026-06-07T00:00:00Z"
}
```

## 11.1 Production Execution And API Contract

This section is the Screening-specific contract that Phase 2 implementation should follow after the 2026-06-19/20 reports.

Execution mode:

| User request | Server behavior | Agent prompt behavior |
|---|---|---|
| Manual single target | One `cbe-buyer-screening` session for that target. | Complete one company, emit one report object. |
| Batch of 2-10 targets | Create one parent task and one child run per target by default. | Each child sees one target only. |
| Batch-3 experiment | Allowed only when `CBE_SCREENING_ALLOW_BATCH3=true`, load is low, and paid calls are disabled or already budgeted. | Process strictly one target at a time, max 3 reports. |
| Batch-5 or batch-10 session | Block in production. | Do not generate prompts that ask one session to investigate 5 or 10 companies. |

Default API allow scope for `cbe-buyer-screening`:

- `web_search` for public footprint, official-page discovery, source fallback, and bounded adverse-media search.
- `web_fetch` only for public pages returned by search or supplied by the operator.
- `cross-border-intel__cbe_intel_google_places_search` for public local-business presence checks when a manual storefront target lacks a website or Maps place id, and for address-footprint discovery across likely company/brand/city/domain query variants.
- `cross-border-intel__cbe_intel_google_place_details` for one bounded basic local-presence refresh per relevant target and bounded Details calls for shortlisted address-footprint candidates.
- `cross-border-intel__cbe_intel_google_geocode` for coordinate support only.
- `cross-border-intel__cbe_intel_google_address_validate` for public business address consistency and per-location validation verdicts only.
- `cross-border-intel__cbe_intel_company_registry_search`
- `cross-border-intel__cbe_intel_company_profile`
- `cross-border-intel__cbe_intel_domain_rdap_lookup`
- `cross-border-intel__cbe_intel_email_domain_check`
- `cross-border-intel__cbe_intel_official_contact_email_search`
- `cross-border-intel__cbe_intel_sec_lookup`
- `cross-border-intel__cbe_intel_trade_record_search`
- `cross-border-intel__cbe_intel_score_buyer`

Default API deny/defer scope:

- Do not call mutation APIs, outreach APIs, CRM writes, product posting APIs, protected social APIs, or login-gated scraping.
- Do not add Apollo, Hunter Domain Search/Finder, ImportGenius, Panjiva, D&B, Creditsafe, Experian, Surepass, Karza, or Alibaba/ICBU APIs to the default path without a separate adapter, budget, and access-proof decision.
- Do not give the agent raw SQL or direct database credentials.
- Do not expose API keys, tokens, signed request strings, or raw paid-provider responses in prompts, memory, reports, or audit text.

Configuration impact:

| Config | Required behavior |
|---|---|
| `CBE_SCREENING_EXECUTION_MODE=single_target_fanout` | Dashboard/store splits batches into child runs. |
| `CBE_SCREENING_MAX_TARGETS_PER_SESSION=1` | Normal production prompts contain one target. |
| `CBE_SCREENING_ALLOW_BATCH3=false` | Batch-3 remains disabled unless explicitly enabled for a controlled run. |
| `CBE_SCREENING_PAID_EMAIL_MAX_CALLS_PER_TARGET=1` | Abstract/Hunter paid verifier pass is not repeated automatically. |
| `CBE_SCREENING_TRADE_MAX_CALLS_PER_TARGET=1` | ImportYeti/Volza trade search is not repeated automatically. |
| `CBE_SCREENING_TRADE_MAX_SPEND_USD_PER_TARGET=0` by default, `1` for approved paid runs | Paid trade evidence stays budget-gated. |
| `CBE_GOOGLE_MAPS_MAX_DETAILS_PER_SCREENING_TARGET=1` | At most one basic local-presence Place Details lookup per target outside address-footprint mode. |
| `CBE_GOOGLE_MAPS_MAX_ADDRESS_SEARCH_QUERIES_PER_TARGET=6` | Planned address-footprint cap for query variants per target. |
| `CBE_GOOGLE_MAPS_MAX_ADDRESS_PLACES_PER_SCREENING_TARGET=20` | Planned address-footprint cap for unique Google Places carried into the report. |
| `CBE_GOOGLE_MAPS_ADDRESS_VALIDATE_MAX_PER_TARGET=10` | Planned cap for Address Validation calls across discovered locations. |
| `CBE_GOOGLE_MAPS_ENABLE_REVIEWS=false` | Google review text/photos stay disabled unless there is an explicit human-review need and policy-compliant display. |
| `CBE_ENABLE_PAID_TRADE_DATA=false` by default | Trade API adapters stay off until the customer enables paid trade data. |
| `CBE_MAX_PAID_SPEND_USD=0` by default | Global paid-data ceiling remains safe for demo/unapproved runs. |
| `SEC_USER_AGENT` | Required for reliable SEC access. |

Cost and evidence handling:

- Lead Discovery should not call Abstract, Hunter, ImportYeti, Volza, or registry APIs directly; those belong to Screening.
- Lead Discovery may call Google Maps Places because Maps is a discovery source; Screening may reuse the place id/Maps URI and call at most one Details refresh per target when local-presence evidence is relevant.
- For the new address-footprint report section, Screening may run multiple bounded Places searches and Place Details calls per target under the address-footprint caps; this is separate from the single local-presence refresh used by the current basic Screening path.
- Geocoding and Address Validation support coordinates/address consistency only and do not replace legal identity, domain/email, trade, financial, or Accio evidence.
- Screening may call paid sources only when the run request includes paid authorization and the server-side budget check passed.
- `api_call_ledger` should store estimated cost, observed billing deltas when available, provider status, and whether the call was free/included/unpriced/paid.
- Provider 401/403/429, disabled budget, missing key, or unsupported country should lower coverage only; it must not create negative buyer evidence.

## 12. Alibaba International Station API Enhancement

This section captures the 2026-06-13 Alibaba API investigation and the Screening-specific use of seller-owned first-party data.

Access-right conclusion:

- The customer should be treated as eligible only after a live Open Platform console/API-test proof.
- Signed-seller status likely helps, especially for paid GGS/equivalent supplier packages, but it does not automatically grant every endpoint.
- Alibaba method labels matter:
  - `开放平台免费API`
  - `开放平台增值API`
  - `需要授权`
  - `聚石塔内调用`
  - hidden/private privacy docs
- Any API marked value-added, Jushita-only, or private requires Alibaba/account-manager enablement until the customer's account proves access.

Enablement flow:

1. Confirm paid supplier/GGS or equivalent package, main-account administrator, and sub-account policy.
2. Create developer application in Alibaba.com / Taobao Open Platform console.
3. Configure Sentura callback URL, e.g. `https://sentura.example.com/api/integrations/icbu/callback`.
4. Obtain `app_key` and `app_secret`.
5. Request minimum read scopes: member authorization info, order list/detail, customer batch/single read if available.
6. Main seller account authorizes app.
7. Backend exchanges authorization `code` for access token / refresh token.
8. Store tokens encrypted in OpenClaw/Sentura secret storage; never in workspace files, logs, memory, or prompts.
9. Smoke call `alibaba.member.info.get`, `alibaba.seller.order.list`, and if available `alibaba.seller.customer.batch.get`.
10. Record exact enabled methods, denied methods, error codes, request IDs, and account role.

Priority APIs:

| Priority | API | Status checked | Screening value | Decision |
|---|---|---|---|---|
| P0 | `alibaba.seller.customer.batch.get` | ICBU seller API, free, requires authorization, marked `聚石塔内调用` | Batch-sync seller-owned customer records: company name, country/address, annual procurement, allowed contact fields, email/phone/social lists, customer phase, source list, website, growth level, owner email. | Best optimizer if accessible. Use as first-party internal evidence. |
| P0 | `alibaba.seller.customer.get` | Single customer info listed; public fetch returned privacy-doc block. | Single-customer refresh. | Conditional; implementation must prove access. |
| P0 | `alibaba.seller.order.list` / `alibaba.seller.order.get` | ICBU transaction API, free, requires authorization. | Confirms prior International Station / Trade Assurance order history, order status, counterpart login, salesperson, timestamps. | Strong positive/dedupe evidence; absence is coverage gap. |
| P1 | `alibaba.seller.order.fund.get` / `alibaba.seller.order.logistics.get` / `alibaba.trade.address.*` | Related transaction APIs visible. | Payment, service-fee, logistics, address context for known orders. | Use only after order path works; redact payment/address details. |
| P1 | `alibaba.seller.customer.note.get` / `alibaba.seller.customer.note.query` | Free, authorized, marked `聚石塔内调用`. | Inquiry behavior, no-reply labels, sales notes, owner, timestamps. | Useful T3 internal CRM notes; preview/redact. |
| P1 | `alibaba.member.info.get` | Free, authorized. | Authorized account id, company id, login id, company name, admin flag, email. | Setup validation and tenant binding. |
| P1 | `alibaba.member.sub.account.info.get` | Free, authorized. | Main/sub-account mapping. | Owner attribution and RBAC audit. |
| P2 | `alibaba.buyer.companyprofile.find` | Value-added, authorized. | Buyer company profile. | Validate seller scope and consent before relying. |
| P2 | `alibaba.member.basicprofile.find` | Value-added, authorized. | Member/contact enrichment. | Treat as personal information; validate scope. |
| P2 | `alibaba.icbu.supplier.identity.verified.get` / `alibaba.icbu.data.verified.get` | Free/no auth supplier verified data. | Verified/Gold supplier data, media, certificates, factory profile, export experience, QC fields. | Useful only if target buyer is also supplier or if screening suppliers/competitors later. |
| P3 | `alibaba.procurement.mysupplier.list` / `alibaba.procurement.supplier.items.get` | Buyer procurement semantics. | Buyer-side prior supplier/item history. | Do not use for seller customer unless buyer separately authorizes. |
| P3 | `alibaba.icbu.risk.send` | Tianlu risk event submission. | Returns pass/reject/pending risk categories. | Do not integrate until Alibaba confirms intended partner use; do not use as opaque fraud score. |
| P3 | product/category APIs such as `alibaba.icbu.category.postcat.get`, `alibaba.icbu.category.attr.get`, `alibaba.icbu.open.product.post` | Category APIs no auth/free; product post mutates listings. | Product taxonomy/listing metadata. | Useful for Lead/Accio normalization; product posting out of Phase 1. |

Evidence model additions:

| Evidence block | Source APIs | Score effect |
|---|---|---|
| `icbu_customer_record` | `alibaba.seller.customer.batch.get`, conditional `alibaba.seller.customer.get` | Positive confidence when company/domain/country/contact fields align. Missing record is neutral. |
| `icbu_order_history` | `alibaba.seller.order.list`, `alibaba.seller.order.get` | Strong positive for completed normal orders; neutral/pending for drafts or new buyers. |
| `icbu_payment_logistics_context` | order fund/logistics/address APIs | Positive/caution only when tied to known seller-visible order; redact in prompts. |
| `icbu_customer_behavior_notes` | customer note APIs | Affects behavior only when labels are specific, recent, and source-attributed. Generic comments must not force downgrade. |
| `icbu_account_mapping` | member/sub-account APIs | No score effect; audit/RBAC/owner attribution. |
| `icbu_external_profile` | buyer/company/member profile APIs if seller-accessible | Enrichment only; T2/T3 depending on fields. |

Proposed `icbu-openapi` MCP tools:

| Tool | Methods | Returns |
|---|---|---|
| `cbe_icbu_auth_status` | `alibaba.member.info.get`, optional sub-account check | Authorized account/company id, admin/sub-account status, enabled-method smoke results. |
| `cbe_icbu_customer_sync` | customer batch/single APIs | Normalized buyer/customer records with redacted contact values and source metadata. |
| `cbe_icbu_order_history` | order list/detail/fund/logistics | Per-buyer order summary, status, dates, order count, redacted transaction context. |
| `cbe_icbu_customer_notes` | customer note get/query | Minimal behavior labels, timestamps, owner metadata; raw note redacted by default. |
| `cbe_icbu_profile_enrichment` | conditional buyer/company/member profile APIs | Company/member enrichment only when permitted. |

MCP security:

- All tools `readOnlyHint: true`.
- Reject mutation APIs.
- Never expose `app_key`, `app_secret`, access token, refresh token, signature base string, or raw request body.
- Include `source_method`, `fetched_at`, `authorization_account_id`, `data_tier`, `redacted`, and `coverage_status`.
- Preserve rate limits/error codes as coverage gaps, not risk findings.
- Raw CRM/customer/order data is T2/T3 and may not be written to vector memory.

Suggested DB additions:

```sql
icbu_authorizations(id, tenant_id, account_id, company_id, login_id, admin, scopes_json, token_ref, refresh_token_ref, status, authorized_at, expires_at)
icbu_api_method_status(id, tenant_id, method, status, last_success_at, last_error_code, last_error_message, checked_at)
icbu_customer_snapshots(id, tenant_id, customer_id, buyer_account_ref, company_name, country, website, customer_phase, growth_level, source_json, fetched_at)
icbu_order_evidence(id, tenant_id, buyer_account_ref, trade_id_hash, order_status, order_created_at, order_modified_at, summary_json, fetched_at)
icbu_customer_note_evidence(id, tenant_id, customer_id, note_id_hash, note_code, note_label, note_time, owner_ref, redacted_summary, fetched_at)
```

Implementation recommendation:

- Do not block current Phase 1 on Alibaba API approval.
- First run access-validation stage.
- Then add `icbu-openapi`, a Screening source toggle `阿里国际站内部数据`, evidence cards for customer record/order history/CRM notes, and contextual scoring updates.

## 13. Database And Persistence

Screening-specific tables:

```sql
screening_targets(id, tenant_id, source, lead_candidate_id, company_name, country, domain, email, contact_person, product_interest_json, supplied_fields_json, created_at)
screening_reports(id, tenant_id, screening_target_id, agent_run_id, risk_tier, normalized_score, evidence_coverage, recommended_action, created_at)
screening_evidence(id, tenant_id, screening_report_id, layer, source_type, source, source_url, finding, confidence, cost_usd, score_block, score_impact, fetched_at)
screening_score_blocks(id, tenant_id, screening_report_id, block, status, max_points, earned_points, reason)
```

Minimum indexes:

- `screening_targets(tenant_id, domain, email)` for dedupe/repeated checks.
- `screening_reports(tenant_id, screening_target_id, created_at desc)`.

Screening reads:

- selected `lead_candidates`
- prior `screening_reports`
- Accio behavior summaries
- API budget state
- optional Alibaba first-party evidence after authorization

Screening writes:

- `screening_targets`
- `screening_reports`
- `screening_evidence`
- `screening_score_blocks`
- `api_call_ledger`

Memory policy:

- Store concise buyer risk facts and operator decisions only after review.
- Do not write raw adverse-search pages or internal Alibaba/CRM notes to vector memory.

## 14. Cost And Budget Controls

Defaults:

- Registry: Companies House + SEC free/low-cost official APIs first.
- Domain/email: free DNS/RDAP checks first.
- Email validation: `$0-$17/month` unless production deliverability matters.
- Trade records: `$0` for demo; optional Volza pilot capped at `$50-$100`.
- Company registry: `$0` unless OpenCorporates approved.

Paid checks require:

- explicit source toggle;
- budget cap;
- provider key in `~/.openclaw/.env` or OpenClaw secret store;
- `api_call_ledger` row with query, provider, timestamp, status, and cost estimate;
- human approval for cap increases.

## 15. Implementation Plan

Already implemented:

- `cbe-buyer-screening` source workspace.
- Six skills listed above.
- Setup registration/webchat binding.
- Screening UI route.
- Diagnostic provider adapter route.
- Formal AgentChat execution path.
- Batch and manual intake.
- Source/budget toggles.
- Evidence timeline.
- Missing-evidence gap panel.
- Score blocks, normalized score, coverage meter, report export.
- Local state persistence.
- SEC and Companies House country routing.
- Official-site same-domain email discovery before paid validation.
- Public adverse scoring gate.
- CE5 and CE7 validation coverage.
- Google Maps address-footprint workflow and the dedicated `Google Maps 地址版图` report section, including multi-query Places discovery, bounded Details/Address Validation, address classification, coverage notes, `screening_address_locations` row storage, source normalization, and distinct Dashboard UI rendering.
- Scale-aware Google Maps first-block scoring, including `company_scale_assessment`, `公司注册与线下门店/地址` labeling, registry/disclosure + Maps fusion for medium/large/listed companies, and the small-local/offline `OPERATIONAL` physical-address rule.

Still to implement:

- Alibaba `icbu-openapi` access validation, then read-only MCP tools.
- Screening UI source toggle `阿里国际站内部数据`.
- Evidence cards for Alibaba customer record/order history/customer notes.
- Additional country-specific registry adapters beyond GB/US.
- Production budget approval UX for paid checks.
- Full P2.5 parent/child Screening fan-out, queued-run draining outside the original browser request, and durable retry/recovery polish.
- Per-target paid email/trade call-state persistence for retry re-approval enforcement.
- Automated tests for Alibaba evidence block behavior after access is proven.

## 16. Source And Test Traceability

Relevant test rows:

- CE3 — `cross-border-intel` MCP server.
- CE5 — Screening employee workspace + employee-executed UI/API.
- CE7 — Cross-border employee demo UIs.
- CE10 — Production cloud/database/multi-agent operating plan.
- CE11 — Alibaba International Station API access and Screening optimization plan.
- CE17.29 / CE22 — scale-aware Google Maps first-block scoring implementation and P2.5 regression coverage.

Key sources:

- Companies House developer docs: `https://developer.company-information.service.gov.uk`
- Companies House auth: `https://developer.company-information.service.gov.uk/authentication`
- Companies House search/company profile specs:
  - `https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/search-companies`
  - `https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/company-profile/company-profile`
- SEC EDGAR APIs: `https://www.sec.gov/search-filings/edgar-application-programming-interfaces`
- SEC developer resources: `https://www.sec.gov/about/developer-resources`
- SEC company tickers: `https://www.sec.gov/files/company_tickers.json`
- OpenCorporates API: `https://api.opencorporates.com/documentation/API-Reference`
- OpenCorporates pricing: `https://opencorporates.com/pricing/`
- RDAP: `https://about.rdap.org/`
- IANA RDAP: `https://www.iana.org/help/rdap-requirements`
- Abstract Email Reputation: `https://docs.abstractapi.com/api/email-reputation`
- Hunter pricing/API:
  - `https://hunter.io/pricing/`
  - `https://help.hunter.io/en/articles/1970956-hunter-api`
- ZeroBounce pricing FAQ: `https://www.zerobounce.net/docs/frequently-asked-questions/billing-and-payments/how-is-pricing-determined-for-email-verification`
- ImportYeti API:
  - `https://www.importyeti.com/yeti-api`
  - `https://data.importyeti.com/`
- Volza APIs: `https://www.volza.com/trade-intelligence-apis/`
- Panjiva API guide: `https://panjiva.com/api-guide/`
- Google Maps Platform Places API (New):
  - `https://developers.google.com/maps/documentation/places/web-service/text-search`
  - `https://developers.google.com/maps/documentation/places/web-service/nearby-search`
  - `https://developers.google.com/maps/documentation/places/web-service/place-details`
  - `https://developers.google.com/maps/documentation/places/web-service/data-fields`
  - `https://developers.google.com/maps/documentation/places/web-service/place-types`
  - `https://developers.google.com/maps/documentation/places/web-service/usage-and-billing`
  - `https://developers.google.com/maps/documentation/places/web-service/policies`
  - `https://developers.google.com/maps/api-security-best-practices`
- Google Geocoding API: `https://developers.google.com/maps/documentation/geocoding/overview`
- Google Address Validation API: `https://developers.google.com/maps/documentation/address-validation/overview`
- Google Business Profile APIs overview: `https://developers.google.com/my-business`
- LinkedIn API access constraints: `https://www.linkedin.com/help/linkedin/answer/a526048/accessing-linkedin-apis`
- LinkedIn marketing API access: `https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access`
- X API docs: `https://docs.x.com/x-api`
- Alibaba International Station API doc id `25408`: `https://developer.alibaba.com/docs/api.htm?apiId=25408`
- Alibaba.com Open API overview: `https://developer.alibaba.com/docs/doc.htm?articleId=118416&docType=1&treeId=684`
- Alibaba authorization flow: `https://developer.alibaba.com/docs/doc.htm?articleId=121120&docType=1&treeId=735`
- Alibaba seller/order/customer/member APIs:
  - `https://developer.alibaba.com/docs/api.htm?apiId=41047`
  - `https://developer.alibaba.com/docs/api.htm?apiId=41074`
  - `https://developer.alibaba.com/docs/api.htm?apiId=53013`
  - `https://developer.alibaba.com/docs/api.htm?apiId=53014`
  - `https://developer.alibaba.com/docs/api.htm?apiId=53759`
  - `https://developer.alibaba.com/docs/api.htm?apiId=53043`
  - `https://developer.alibaba.com/docs/api.htm?apiId=53715`
  - `https://developer.alibaba.com/docs/api.htm?apiId=68249`
  - `https://developer.alibaba.com/docs/api.htm?apiId=68260`
