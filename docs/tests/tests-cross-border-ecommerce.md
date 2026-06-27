> **On-demand reference — not read by default.**
>
> Back-link: [`docs/TESTS.md`](../TESTS.md)

# Cross-Border E-Commerce Project Tests

Detailed test cases for the mobile-accessory Cross-border e-commerce / 跨境电商 independent client pilot. This file is not part of the core A/B/C/D sprint plan and should be updated alongside the Cross-border E-commerce section in `docs/TESTS.md`.

Phase 2 split: this file remains the Phase 1/MVP and CE1-CE16 regression detail file. Current and future Phase 2 details (CE17+) live in [`tests-cross-border-phase2.md`](tests-cross-border-phase2.md). Historical CE17/CE18 sections may remain below for audit continuity, but the Phase 2 file is the active detail source.

## CE1 — Phase-1 MVP Design And API Sourcing

Status: PASS (2026-06-08)

Scope: `跨境电商/DESIGN.md`, `跨境电商/MARKET_ACQUISITION.md`, `跨境电商/SCREENING.md`, and `跨境电商/MEMORY_PROCESSING.md`

| # | Check | Method | Expected |
|---|---|---|---|
| CE1.1 | Customer inputs represented | Manual review | Design references the supplied commercial PDF and captures mobile-phone accessories, B2B export, Alibaba/Accio-style chats, target regions, and sales pain points. |
| CE1.2 | Three employees covered | Manual review | Design includes Marketing Acquisition, Screening/Background Investigation, and Accio Memory Processing with distinct employee ids and responsibilities. |
| CE1.3 | OpenClaw/Sentura runtime shape | Manual review | Design uses OpenClaw embedded-agent workspaces, exactly the 8 native files, local stdio MCP, `mcp.servers.<name>`, sandbox tool allowlists, and no custom runtime/gateway/Docker wrapper. |
| CE1.4 | Marketing Acquisition MVP complete | Manual review | Design defines keyword inputs, search strategy, dedupe/ranking, lead schema, completion criteria, and no automatic cold outreach. |
| CE1.5 | Screening MVP low-cost route | Manual review | Design uses public web evidence, DNS/RDAP, Companies House/SEC where applicable, optional Abstract/Hunter, optional capped Volza/ImportYeti, and avoids login-gated scraping. |
| CE1.6 | Contextual scoring model | Manual review | Design uses contextual evidence blocks, excludes not-applicable behavior for cold Marketing leads, reports normalized score and evidence coverage separately, and keeps forced downgrades. |
| CE1.7 | API and price sourcing | Manual review | Design lists official API/doc URLs and price/cost decisions for search, registry, domain/email, trade-record, and financial checks. |
| CE1.8 | Safety and data classification | Manual review | Design classifies raw chats and buyer evidence, stores secrets outside code/config, blocks automatic outreach, and keeps paid API use behind budget controls. |
| CE1.9 | Employee-specific UIs | Manual review | Design defines three distinct demo routes for lead discovery, screening, and Accio memory, each with workflow-specific controls, explicit provenance, and real employee chat only where the workflow still includes a chat surface. |
| CE1.10 | Manual screening intake | Manual review | Design allows Screening to investigate manually entered company name, domain, email, contact person/title, social/profile URL, country, product interest, and notes. |
| CE1.11 | Demo feasibility under missing APIs | Manual review | Design marks unavailable paid/API evidence as coverage gaps rather than fraud penalties, so the demo remains explainable when only low-cost APIs are enabled. |

## CE2 — Shared Fixtures, Ontology, Schemas, And Contextual Scoring

Status: PASS (2026-06-08)

Scope:

- `跨境电商/fixtures/accio-chat-records.sample.json`
- `sentura/config/industry-ontologies/cross-border-mobile-accessories/`
- `sentura/lib/cross-border-ecommerce.ts`
- `scripts/test-cross-border-milestone2.ts`

Validation command:

```bash
python3 -m json.tool 跨境电商/fixtures/accio-chat-records.sample.json >/dev/null
npx tsx scripts/test-cross-border-milestone2.ts
```

| # | Check | Method | Expected |
|---|---|---|---|
| CE2.1 | JSON syntax | Command above | Fixture parses as valid JSON. |
| CE2.2 | Platform/source metadata | Manual review | Top-level object identifies Alibaba Accio-style chat data, source, export timestamp, and classification. |
| CE2.3 | Conversation coverage | Manual review | Fixture includes at least three conversations across different buyer companies/regions. |
| CE2.4 | Company info | Manual review | Each conversation includes company name, country, buyer/contact role, domain/email where available, and marketplace context. |
| CE2.5 | Product and commercial terms | Manual review | Each conversation includes requested mobile-accessory products, quantities, price discussions, Incoterms/payment/logistics details, and next action. |
| CE2.6 | Memory-employee readiness | Manual review | Fixture fields are sufficient for extracting customer-company summary, goods requested, negotiated prices, risks, and follow-up tasks. |
| CE2.7 | Product taxonomy ontology | `scripts/test-cross-border-milestone2.ts` | `assets/product-taxonomy.json5` includes phone cases, screen protectors, chargers, cables, mobile holders, power accessories, repair accessories, buyer personas, geography/language focus, and marketplace exclusions. |
| CE2.8 | Scoring rules ontology | `scripts/test-cross-border-milestone2.ts` | `rules/scoring-rules.json5` defines contextual evidence blocks and status denominator rules instead of a single fixed denominator. |
| CE2.9 | Lead discovery SOP ontology | `scripts/test-cross-border-milestone2.ts` | `workflows/lead-discovery-sop.json5` captures query expansion, public-search-only sourcing, dedupe, audit URLs, structured handoff, and no automatic outreach. |
| CE2.10 | Buyer screening SOP ontology | `scripts/test-cross-border-milestone2.ts` | `workflows/buyer-screening-sop.json5` supports Marketing lead batches and manual inputs, low-cost evidence ladder, contextual scoring, paid-source gaps, and anti-fraud caution rules. |
| CE2.11 | Shared Zod schemas | `scripts/test-cross-border-milestone2.ts` | `LeadCandidateSchema`, `ScreeningReportSchema`, `AccioChatExportSchema`, and `AccioChatSummarySchema` validate design-shaped sample records. |
| CE2.12 | Cold lead behavior handling | `scripts/test-cross-border-milestone2.ts` | `conversation_behavior` is `not_applicable` for cold Marketing leads and is excluded from score and coverage denominators. |
| CE2.13 | Disabled paid API handling | `scripts/test-cross-border-milestone2.ts` | `disabled_by_budget` trade/financial evidence reduces `evidence_coverage` but does not reduce `normalized_score`. |
| CE2.14 | Forced downgrade handling | `scripts/test-cross-border-milestone2.ts` | Forced downgrade flags override otherwise good normalized scores and return `high_risk`. |

## CE3 — `cross-border-intel` MCP Server

Status: PASS (2026-06-08)

Scope:

- `sentura/mcp-servers/cross-border-intel/package.json`
- `sentura/mcp-servers/cross-border-intel/tsconfig.json`
- `sentura/mcp-servers/cross-border-intel/vitest.config.ts`
- `sentura/mcp-servers/cross-border-intel/README.md`
- `sentura/mcp-servers/cross-border-intel/src/index.ts`
- `sentura/mcp-servers/cross-border-intel/src/config.ts`
- `sentura/mcp-servers/cross-border-intel/src/schemas.ts`
- `sentura/mcp-servers/cross-border-intel/src/tools.ts`
- `sentura/mcp-servers/cross-border-intel/src/server.test.ts`

Validation command:

```bash
pnpm --filter @sentura/mcp-cross-border-intel test   # 23/23
pnpm --filter @sentura/mcp-cross-border-intel build
```

| # | Check | Expected |
|---|---|---|
| CE3.1 | Package/build contract | `package.json`, `tsconfig.json`, `vitest.config.ts`, and README follow existing Sentura MCP patterns; `pnpm --filter @sentura/mcp-cross-border-intel build` passes. |
| CE3.2 | Tool catalog | MCP `listTools()` exposes exactly 14 designed read-only tools: registry search, company profile, RDAP, email/domain check, official contact email search, Google Places search/details, Google Geocoding, Google Address Validation, SEC lookup, trade-record search, contextual score, Accio parse, Accio summarize. |
| CE3.3 | Tool annotations and source metadata | Every tool has `readOnlyHint: true`, `destructiveHint: false`, and source doc metadata pointing to `跨境电商/DESIGN.md Milestone 3`. |
| CE3.4 | Companies House routes | `cbe_intel_company_registry_search` builds `GET /search/companies?q=...&items_per_page=...`; `cbe_intel_company_profile` builds `GET /company/{companyNumber}` and uses API-key Basic auth. |
| CE3.5 | SEC adapter | `cbe_intel_sec_lookup` pads numeric CIKs to 10 digits, sends the configured SEC-compliant `User-Agent`, resolves company names through SEC `company_tickers.json`, and returns `not_found` as not-applicable/coverage gap for private/non-filer targets. |
| CE3.6 | RDAP adapter | `cbe_intel_domain_rdap_lookup` handles 200 found, 302 redirect, 404 not found, and 429 rate-limited responses without crashing. |
| CE3.7 | DNS/email checks | `cbe_intel_email_domain_check` covers missing MX, free-provider flag, role inbox flag, SPF, and DMARC through injected DNS resolvers. |
| CE3.8 | Contextual scoring tiers | `cbe_intel_score_buyer` deterministically covers `trusted_candidate`, `cautious`, `insufficient_evidence`, and `high_risk`. |
| CE3.9 | Contextual score denominator rules | `conversation_behavior=not_applicable` is excluded from denominators; `disabled_by_budget` paid evidence lowers coverage but not normalized score; forced downgrades override score. |
| CE3.10 | Trade-data cost controls | `cbe_intel_trade_record_search` does not call Volza/ImportYeti unless paid data is enabled, keys exist, and request budget is within cap; fallback is source-marked `public_web`. |
| CE3.11 | Accio parser/summarizer | Parser validates `跨境电商/fixtures/accio-chat-records.sample.json`; summarizer extracts company profile, requested goods, quantities, target/best prices, packaging add-on, negotiated prices, next actions, and behavior signals. |
| CE3.12 | MCP smoke and hermetic tests | `InMemoryTransport` client lists and calls tools; all HTTP and DNS behavior is mocked/injected, so Vitest performs no real external calls and no secrets appear in outputs. |
| CE3.13 | Abstract + Hunter paid email validation | When `enable_paid_validation=true` and keys exist, `cbe_intel_email_domain_check` calls Abstract Email Reputation at `GET https://emailreputation.abstractapi.com/v1/?api_key=...&email=...` and Hunter at `GET https://api.hunter.io/v2/email-verifier`, returning provider metadata without echoing API keys. |
| CE3.14 | Current ImportYeti endpoint | Paid ImportYeti route uses `GET https://data.importyeti.com/v1.0/company/search?name=...&page_size=...` with the `IYApiKey` header, budget controls, and source type `paid_trade_data`. |
| CE3.15 | Official-site contact email discovery | `cbe_intel_official_contact_email_search` fetches a bounded set of official website pages and extracts same-domain public emails while ignoring third-party/free-provider addresses. |
| CE3.16 | Google Maps adapter | Mocked tests cover missing key behavior, Places Text Search with field mask, Nearby Search with location restriction, Place Details screening field mask, Geocoding key redaction, Address Validation normalization, quota/rate-limit mapping, source attribution, and no API key leakage. |

## CE4 — Marketing Acquisition Employee Workspace

Status: PASS (2026-06-08)

Scope:

- `sentura/agents/cbe-lead-discovery/`
- `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`
- `sentura/dashboard/src/app/api/client-demos/cross-border/lead-discovery/run/route.ts`
- `sentura/dashboard/src/components/sidebar.tsx`
- `scripts/sentura-setup.sh`
- `scripts/sentura-setup.ps1`
- `scripts/test-cross-border-agents.ts`

Validation command:

```bash
npx tsx scripts/test-cross-border-agents.ts
```

Latest CE4+CE5 coverage after Lead execution-path correction: 213/213 PASS (2026-06-08).

| # | Check | Expected |
|---|---|---|
| CE4.1 | Workspace convention | Exactly 8 native OpenClaw workspace files plus `config.json5` and skills; no extra top-level markdown workspace files. |
| CE4.2 | Tool policy | Allows `web_search`, `web_fetch`, `cron`, and `group:plugins`; sandbox allowlist includes `web_search`, `web_fetch`, `cron`, and `cross-border-intel__*`; dangerous tools and external messaging are denied. |
| CE4.3 | Skills | Has `lead-query-generation`, `lead-deduplication`, `lead-list-production`, and `handoff-to-screening` skills covering company-owned downstream buyer query generation, social/directory/marketplace rejection, source capture, dedupe, ranking, JSON/Markdown output, and typed handoff. |
| CE4.4 | Output schema | Produces lead records with company, geography, product fit, source URLs, source timestamps, confidence, duplicate status, and dedupe key matching the design-shaped `LeadCandidate` contract. |
| CE4.5 | No outreach | Hard Rules, TOOLS, skills, config, and UI do not send emails/messages automatically in Phase 1. |
| CE4.6 | Setup registration | `scripts/sentura-setup.{sh,ps1}` copy/stamp/register `cbe-lead-discovery`, apply the OpenClaw runtime/tool override, and add a webchat binding. |
| CE4.7 | UI lead-table contract | `/client-demos/cross-border/lead-discovery` renders keyword/persona/country setup, env/source status, a dominant candidate buyer table, and a real `cbe-lead-discovery` employee execution panel. Clicking the row `查看` action expands source URLs, query strings, snippets, timestamps, dedupe key, and dedupe explanation inline. The query log, Screening handoff package preview, and realtime tool-trace panels are not rendered. |
| CE4.8 | Employee execution path | `/client-demos/cross-border/lead-discovery` formal run path checks Gateway and `cbe-lead-discovery` registration, then sends the structured task through `AgentChat`; it must not generate official lead results by directly fetching the Dashboard route. Employee lead JSON must be parsed from `LEAD_CANDIDATES_JSON_START` / `LEAD_CANDIDATES_JSON_END`. |
| CE4.8a | Diagnostic Tavily route | `/api/client-demos/cross-border/lead-discovery/run` calls `https://api.tavily.com/search` with `Authorization: Bearer`, reads `TAVILY_API_KEY` from process env or `~/.openclaw/.env`, returns source-audited company-website lead candidates, and only exposes redacted configured/enabled env status for cross-border API keys. This route is adapter diagnostics, not the formal Dashboard run path. |
| CE4.9 | No baked-in leads | The page starts with an empty table and has no `sampleLeads`, `.example` domains, or fixture-source fallback for buyer candidates. |
| CE4.10 | Downstream buyer filtering | Live route and skills reject Facebook/LinkedIn/social profiles, directories, marketplaces, public company-info pages, supplier directories, generic wholesale lists, factories, manufacturers, exporters, and wholesale supplier pages; accepted leads must show mobile-accessory/repair/retail relevance on a company-level website. |
| CE4.11 | UI buyer defaults | The default run builder targets downstream buyer personas such as repair chains, electronics retailers, accessory retailers, and phone stores, not generic wholesalers. |
| CE4.12 | Copy to Screening | Lead page has a one-click copy-all action and a per-result copy action; copied JSON is `{"leads":[...]}` with `matched_products`, `contact_candidates`, source URLs, evidence, dedupe, and confidence fields accepted by Screening batch input. |
| CE4.13 | Lead state persistence | Lead page stores run configuration, env status, run message, expanded row, employee session key, and returned leads in same-origin local storage so refresh/navigation return does not clear the last search result. |

## CE5 — Screening And Background Employee Workspace + Employee-Executed UI/API

Status: PASS (2026-06-08)

Scope:

- `sentura/agents/cbe-buyer-screening/`
- `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`
- `sentura/dashboard/src/app/api/client-demos/cross-border/screening/run/route.ts`
- `sentura/dashboard/src/components/sidebar.tsx`
- `scripts/sentura-setup.sh`
- `scripts/sentura-setup.ps1`
- `scripts/test-cross-border-agents.ts`

Validation command:

```bash
npx tsx scripts/test-cross-border-agents.ts   # CE4 + CE5 — 213/213
cd sentura/dashboard && pnpm exec tsc --noEmit
```

Live adapter smoke summary (2026-06-08):

- Directly invoked `/api/client-demos/cross-border/screening/run` with a manual target and `sec_cik` to validate provider adapters only. This route is not the formal dashboard run path.
- HTTP 200.
- Redacted env status showed `TAVILY_API_KEY`, `COMPANIES_HOUSE_API_KEY`, `ABSTRACT_API_KEY`, `HUNTER_API_KEY`, `IMPORTYETI_API_KEY`, `SEC_USER_AGENT`, `CBE_ENABLE_PAID_TRADE_DATA`, `CBE_MAX_PAID_SPEND_USD`, and `CBE_INTEL_REQUEST_TIMEOUT_MS` configured/enabled as applicable.
- Latest API-format audit confirmed Tavily, SEC, Abstract Email Reputation, and ImportYeti return live successful responses with the corrected request formats. A redaction-safe direct provider smoke also confirmed SEC `company_tickers.json` + submissions returned HTTP 200, Abstract Email Reputation returned HTTP 200 for a public same-domain email, and ImportYeti company search returned HTTP 200 with `requestCost=0`.
- Companies House still returns `401 Invalid Authorization` with the official Basic `api_key:` format, so the remaining issue is provider/account acceptance rather than request formatting. Hunter returns HTTP 429, so the endpoint/key path is reachable but current quota/rate limiting blocks validation. Both are expected to be surfaced as coverage gaps, not scored evidence.
- Country-routing smoke confirmed a copied US target (`Apple Inc.`) automatically used SEC `company_tickers.json` and SEC submissions without an API key, while a copied GB target (`Mobile Lab`) fell back from Companies House API 401 to the official public Companies House search page and found `MOBILE LAB LTD (08770672)`.
- Public-adverse gate smoke confirmed generic scam-reporting pages from queries such as `Mobile Lab fraud scam complaint customs GB` are marked `coverage_only` unless the result belongs to the target domain or explicitly names the target company; the same Mobile Lab target scored `84.44` as `trusted_candidate` with no forced downgrade.
- Dashboard execution correction confirmed `/client-demos/cross-border/screening` no longer generates official reports by directly fetching `/api/client-demos/cross-border/screening/run`; the `让背调员工开始调查` action checks Gateway and `cbe-buyer-screening` registration, sends a structured task through `AgentChat`, tracks employee tool calls, and parses `SCREENING_REPORTS_JSON_START/END` output into the report panels.
- Employee-report visual mapping now normalizes employee-returned aliases such as `source_url`, `summary`, `detail`, `official_web`, `registry_tool`, `coverage_gap`, and `marketing_lead_batch` into the dashboard's evidence timeline, missing-evidence, score, and persisted-report model.
- Official-source ordering now requires GB targets to call Companies House before public-web fallback and US targets to call SEC by CIK or company-name-to-CIK lookup before state registry/web fallback.
- Paid email validation now first searches the target's official website for same-domain contact emails when the operator enabled paid validation but did not supply a specific email; discovered emails are then eligible for Abstract/Hunter validation.

| # | Check | Expected |
|---|---|---|
| CE5.1 | Workspace convention | Exactly 8 native OpenClaw workspace files plus skills/config; no extra top-level markdown workspace files. |
| CE5.2 | Evidence ladder | Skill prioritizes official registry/domain/email/web/trade/financial evidence by cost and reliability. |
| CE5.3 | Tool policy | Allows only read-only investigation tools and sandbox MCP tool globs. |
| CE5.4 | Manual input normalization | Accepts company name, domain, email, contact person/title, social/profile URL, country, product interest, and notes, then normalizes them into the same investigation target shape as Marketing leads. |
| CE5.5 | Contextual scoring | Applies the CE1 contextual scoring model: no behavior penalty for cold leads, unavailable API data as coverage gap, normalized score separate from evidence coverage. |
| CE5.6 | Forced downgrades | Applies high-risk forced downgrades after normalized scoring. |
| CE5.7 | Report | Produces evidence-cited authenticity/risk report and recommended next action. |
| CE5.8 | Social constraints | Uses public search/fetch only; no login-gated social scraping. |
| CE5.9 | Setup registration | `scripts/sentura-setup.{sh,ps1}` copy/stamp/register `cbe-buyer-screening`, apply OpenClaw runtime/tool overrides, and add a webchat binding. |
| CE5.10 | Employee execution path | `/client-demos/cross-border/screening` formal run path checks Gateway and `cbe-buyer-screening` registration, then sends the structured task through `AgentChat`/Gateway; it must not generate official reports by directly fetching the Dashboard route. |
| CE5.11 | Live API adapter env handling | Screening adapter route reads process env or `~/.openclaw/.env`, returns only redacted configured/enabled provider status, and uses `CBE_INTEL_REQUEST_TIMEOUT_MS`. |
| CE5.12 | Real API adapter calls | Screening adapter route contains live call paths for Tavily, Companies House Basic-auth registry lookup plus official public-page fallback, RDAP/DNS, Abstract Email Reputation, Hunter Email Verifier, ImportYeti `IYApiKey` company search with budget controls, and SEC no-key `company_tickers.json` -> submissions lookup with configured/default User-Agent; non-2xx paid/official providers are coverage gaps, not positive score evidence. |
| CE5.13 | Screening UI contract | `/client-demos/cross-border/screening` supports batch/manual intake tabs, full manual form, source/budget toggles, evidence timeline, score/coverage panel, JSON export, and real `cbe-buyer-screening` AgentChat. |
| CE5.14 | Source metadata | Every adapter-built evidence item carries source type, fetched timestamp, confidence, cost, score block, and score impact. |
| CE5.15 | Screening state persistence | Screening page stores manual/batch inputs, source toggles, employee session key, run status, selected report, and generated reports in same-origin local storage so refresh/navigation return does not clear the last investigation. |
| CE5.16 | Country-specific official routing | Copied/list Screening targets automatically call SEC for `country=US` using company name/CIK and Companies House for `country=GB`, falling back to the official public Companies House page when the REST API key is absent or rejected. |
| CE5.17 | Target-relevant public adverse scoring | Public-search results containing scam/fraud/complaint keywords affect score or forced downgrades only when the result is target-specific by company name or domain; generic consumer-warning pages remain coverage-only evidence. |
| CE5.18 | Employee-report visual mapping | Employee JSON returned by `cbe-buyer-screening` is normalized before rendering and before restoring from local storage, so `source_url`/`summary` evidence and `detail` missing-evidence fields appear in the visual evidence timeline and gap panel. |
| CE5.19 | Official-source-first employee ordering | Screening skills and Dashboard employee prompt require GB Companies House and US SEC lookup before public web registry fallback. |
| CE5.20 | Paid email discovery ordering | Screening skills and Dashboard employee prompt require official-site same-domain email discovery before Abstract/Hunter paid validation when the operator enables paid validation but does not supply an email. |

## CE6 — Accio Memory Processing Employee Workspace + Report Correctness

Status: PASS (2026-06-08)

Scope:

- `sentura/agents/cbe-accio-memory/`
- `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`
- `sentura/dashboard/src/app/api/client-demos/cross-border/accio-memory/sample/route.ts`
- `scripts/sentura-setup.sh`
- `scripts/sentura-setup.ps1`
- `scripts/test-cross-border-agents.ts`
- `跨境电商/fixtures/accio-chat-records.sample.json`

Validation command:

```bash
npx tsx scripts/test-cross-border-agents.ts   # CE4 + CE5 + CE6 + CE7 — 291/291
python3 -m json.tool 跨境电商/fixtures/accio-chat-records.sample.json >/dev/null
pnpm --filter @sentura/mcp-cross-border-intel test
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm build
```

| # | Check | Expected |
|---|---|---|
| CE6.1 | Workspace convention | Exactly 8 native OpenClaw workspace files plus skills/config; no extra top-level markdown workspace files. |
| CE6.2 | Tool policy | Allows `memory_search`, `memory_get`, and `group:plugins`; sandbox allowlist includes `memory_search`, `memory_get`, and `cross-border-intel__*`; dangerous tools, raw filesystem read, external messaging, session/subagent spawn, and mutation tools are denied. |
| CE6.3 | Skills | Has `accio-upload-intake`, `chat-normalization`, `deal-summary`, `customer-profile-memory`, and `handoff-to-screening`; skills call the Accio parser/summarizer tools, preserve source identifiers, emit `ACCIO_SUMMARIES_JSON_START/END`, and produce `preview_only` memory facts plus `accio_memory` Screening targets. |
| CE6.4 | Setup registration | `scripts/sentura-setup.{sh,ps1}` copy/stamp/register `cbe-accio-memory`, apply OpenClaw runtime/tool overrides, and add a webchat binding. |
| CE6.5 | Fixture intake | `跨境电商/fixtures/accio-chat-records.sample.json` parses as JSON and contains exactly three Alibaba Accio demo conversations with T3 business-conversation classification. |
| CE6.6 | Andes report correctness | Employee-returned `accio_conv_001` report, backed by the Accio summarizer tool, extracts Andes Mobile Parts SpA, Chile, tempered glass screen protectors, iPhone 15/Samsung S24, 10,000 pcs, target USD 0.35, best USD 0.36, packaging add-on USD 0.03, FOB Shenzhen, T/T 30% deposit terms, PI next action, and behavior points. |
| CE6.7 | Berlin report correctness | Employee-returned `accio_conv_002` report, backed by the Accio summarizer tool, extracts Berlin Gadget Wholesale GmbH, Germany, 65W GaN EU plug chargers, 500 pcs trial request, seller MOQ 1,000 pcs, target USD 6.50, quote/best USD 6.80, EXW, Hamburg warehouse delivery, CE/RoHS requirements, and a Gmail/domain-screening warning in next actions. |
| CE6.8 | Northstar report correctness | Employee-returned `accio_conv_003` report, backed by the Accio summarizer tool, extracts Northstar Wireless LLC, US, clear MagSafe phone cases, iPhone 16 / 16 Pro / 16 Pro Max, 15,000 pcs current quote, 20,000 pcs/month potential, USD 1.10 best price, FBA barcode sticker USD 0.015, drop-test packaging USD 0.08, and quote/Screening next actions. |
| CE6.9 | Memory policy | Reports include `memory_write_preview.status="preview_only"` with concise facts and source references only; raw chat text is not written to long-term memory or external systems. |
| CE6.10 | Handoff | Reports include `screening_handoff_target.source="accio_memory"` with company, country, website/email/contact where available, product interest, behavior notes, supplied fields, missing fields, and source provenance. |
| CE6.11 | UI preview contract | `/client-demos/cross-border/accio-memory` renders raw transcript immediately, then renders highlighted extracted facts, report table, memory-write preview, and Screening handoff actions only after parsing employee `ACCIO_SUMMARIES_JSON_START/END` output. |
| CE6.12 | Browser validation | Browser loaded the Accio page, clicked "加载演示 Accio 记录", and confirmed the page displays raw conversations, `待员工分析`, and the `ACCIO_SUMMARIES_JSON` waiting copy instead of pre-set Andes/Berlin/Northstar reports; console error count was 0. Screenshot: `/tmp/cbe-accio-memory-wait.png`. |

## CE7 — Cross-Border Employee Demo UIs

Status: PASS (2026-06-08)

Scope:

- `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`

Validation command:

```bash
npx tsx scripts/test-cross-border-agents.ts   # CE4 + CE5 + CE6 + CE7 — 291/291
```

Note: CE4 owns detailed Lead route checks, CE5 owns detailed Screening route checks, and CE6 owns detailed Accio route/report checks. CE7 is the combined three-route demo-suite contract.

| # | Check | Expected |
|---|---|---|
| CE7.1 | Lead-discovery route exists | `/client-demos/cross-border/lead-discovery` exists and is covered structurally by CE4. |
| CE7.2 | Lead run builder | Page has product keyword chips, buyer persona controls, country/language controls, target count, exclusions, and a clear run action. |
| CE7.3 | Lead table | Page renders lead rows with company, country, buyer type, matched product, domain/contact candidate, source count, confidence, and duplicate status. |
| CE7.4 | Lead inline evidence | Clicking a lead's `查看` action expands query strings, source URLs, snippets, dedupe explanation, dedupe key, and source timestamps inside the candidate buyer table. |
| CE7.5 | Lead execution surface | Lead-discovery does not render the old query log, Screening handoff package preview, or realtime tool-trace panel; it does render the real `cbe-lead-discovery` employee execution session required for the formal run path. |
| CE7.6 | Lead-to-Screening copy | Covered by CE4; lead rows and the table header can copy Screening-ready `{"leads":[...]}` JSON. |
| CE7.7 | Lead/Screening state persistence | Covered by CE4/CE5; lead search and Screening investigation results survive refresh and route navigation. |
| CE7.8 | Screening route exists | Covered by CE5; `/client-demos/cross-border/screening` builds and opens. |
| CE7.9 | Screening intake tabs | Covered by CE5; page supports both Marketing lead batch intake and manual investigation input. |
| CE7.10 | Manual screening form | Covered by CE5; manual form includes company name, country, website/domain, email, contact person/title, social/profile URL, product interest, and notes. |
| CE7.11 | Screening evidence timeline | Covered by CE5; page groups evidence by legal registry, domain/email, public footprint, trade/customs, financial/public filing, and behavior. |
| CE7.12 | Contextual score UI | Covered by CE5; page displays normalized score and evidence coverage separately, shows `not_applicable` behavior for cold leads, and marks disabled/unavailable API evidence as coverage gap. |
| CE7.13 | Screening AgentChat | Covered by CE5; page connects to a real `cbe-buyer-screening` AgentChat session. |
| CE7.14 | Accio route exists | `/client-demos/cross-border/accio-memory` exists, opens in Browser, and exposes a dense Accio ingestion workbench. |
| CE7.15 | Accio upload/sample load | Page supports JSON upload and loading `跨境电商/fixtures/accio-chat-records.sample.json` through the local sample API route. |
| CE7.16 | Accio extraction preview | Page shows transcript immediately, then shows highlighted product/quantity/price/payment/logistics facts, extracted report table, company summary, next actions, memory-write preview, Screening handoff, and behavior signals only after the Accio Memory employee returns structured JSON markers. |
| CE7.17 | No unsafe automation | No page sends outreach, writes raw chat to long-term memory, exposes secrets, or hides demo/live source provenance. |

## CE8 — API Key And OpenClaw Setup Runbook

Status: PASS (2026-06-08)

Scope: `跨境电商/API_KEYS_OPENCLAW_SETUP.md`

| # | Check | Method | Expected |
|---|---|---|---|
| CE8.1 | OpenClaw onboard flow | Manual review | Documents build/onboard commands, gateway URL `http://localhost:18789`, model provider selection, web search provider setup, and gateway start. |
| CE8.2 | Sentura setup aftermath | Manual review | Explains what `scripts/sentura-setup.sh` / `.ps1` does and states that it automatically registers `cross-border-intel` after env vars and MCP build are in place. |
| CE8.3 | Key inventory | Manual review | Covers model provider keys, `BRAVE_API_KEY`, `TAVILY_API_KEY`, `COMPANIES_HOUSE_API_KEY`, `OPENCORPORATES_API_KEY`, `ABSTRACT_API_KEY`, `HUNTER_API_KEY`, `VOLZA_API_KEY`, `IMPORTYETI_API_KEY`, `SEC_USER_AGENT`, RDAP/DNS no-key routes, and CBE budget env vars. |
| CE8.4 | Per-key acquisition steps | Manual review | Each key section explains where to obtain it, what tool uses it, whether it is required, and how absence affects behavior. |
| CE8.5 | Secret placement | Manual review | Uses `~/.openclaw/.env` / Windows equivalent and never instructs storing real keys in repo files, chat history, or workspace prose. |
| CE8.6 | MCP connection | Manual review | Directs operators to rerun Sentura setup, shows the resulting `mcp.servers.cross-border-intel` JSON5 with `command: "node"`, compiled `dist/index.js`, project-root `cwd`, and `${ENV_VAR}` API-key references. |
| CE8.7 | Verification commands | Manual review | Includes `pnpm --filter @sentura/mcp-cross-border-intel build/test`, `scripts/sentura-setup.{sh,ps1}`, `openclaw mcp status --verbose`, `openclaw mcp doctor --probe`, and `openclaw mcp probe`. |
| CE8.8 | Sandbox tool policy | Manual review | Shows agent-level and sandbox-level allowlist examples for `web_search`, `web_fetch`, memory tools, `group:plugins`, and `cross-border-intel__*`. |
| CE8.9 | Cost/safety defaults | Manual review | Defaults paid trade data off, requires budget caps before Volza/ImportYeti calls, and preserves the no-auto-outreach/no-secret/no-raw-Accio-external-channel boundaries. |
| CE8.10 | Source traceability | Manual review | Lists official references for OpenClaw web/MCP/tool config and the third-party APIs used by the runbook. |
| CE8.11 | Doctor warning interpretation | Manual review | Explains that `literal sensitive value` warnings can appear after OpenClaw resolves `${ENV_VAR}` at runtime, and provides a redaction-safe check that actual `openclaw.json` still stores API-key placeholders. |

## CE9 — Sentura Setup Cross-Border MCP Wiring

Status: PASS (2026-06-08)

Scope:

- `scripts/sentura-setup.sh`
- `scripts/sentura-setup.ps1`
- `docs/SETUP.md`
- `sentura/mcp-servers/cross-border-intel/README.md`
- `跨境电商/DESIGN.md`
- `跨境电商/API_KEYS_OPENCLAW_SETUP.md`

Validation command:

```bash
bash -n scripts/sentura-setup.sh
rg -n 'cross-border-intel|buildCrossBorderIntelEnv|COMPANIES_HOUSE_API_KEY|CBE_ENABLE_PAID_TRADE_DATA|TAVILY_API_KEY' scripts/sentura-setup.sh scripts/sentura-setup.ps1
! rg -n '\$secret:.*cross-border|openclaw mcp set cross-border-intel' 跨境电商/API_KEYS_OPENCLAW_SETUP.md 跨境电商/DESIGN.md sentura/mcp-servers/cross-border-intel/README.md
```

| # | Check | Method | Expected |
|---|---|---|---|
| CE9.1 | Bash syntax | `bash -n scripts/sentura-setup.sh` | Bash setup parses successfully. |
| CE9.2 | Bash MCP registration | Static review / `rg` | Bash setup writes `config.mcp.servers['cross-border-intel']` with `command: "node"`, absolute compiled `dist/index.js`, project-root `cwd`, env block, and `requestTimeoutMs`. |
| CE9.3 | PowerShell parity | Static review / `rg` | PowerShell setup mirrors the Bash `cross-border-intel` MCP registration behavior. |
| CE9.4 | Env source handling | Static review | Setup reads project `.env`, OpenClaw state `~/.openclaw/.env`, and current process env, so operators can configure keys before running setup without exposing them in committed files. |
| CE9.5 | Secret handling | Static review | API keys are stored as `${ENV_VAR}` config references when present; missing optional keys are omitted; setup never writes raw API key values into `openclaw.json`. |
| CE9.6 | Budget/default handling | Static review | `SEC_USER_AGENT`, `CBE_ENABLE_PAID_TRADE_DATA`, `CBE_MAX_PAID_SPEND_USD`, and `CBE_INTEL_REQUEST_TIMEOUT_MS` use configured non-secret values or safe defaults. |
| CE9.7 | Web-search boundary | Static review | `TAVILY_API_KEY` is noted for OpenClaw `web_search` and CE4 Dashboard live-search usage, but is not placed into the `cross-border-intel` MCP env block. |

## CE10 — Production Cloud/Database/Multi-Agent Operating Plan

Status: PASS (2026-06-13)

Scope: `跨境电商/DESIGN.md`

| # | Check | Method | Expected |
|---|---|---|---|
| CE10.1 | Database boundary | Manual review | Plan uses one tenant-scoped CBE business database for pipeline records plus three per-agent LanceDB memory namespaces; it does not split the three employees into unrelated databases. |
| CE10.2 | OpenClaw state preservation | Manual review | Plan keeps OpenClaw runtime state, workspaces, sessions, and MCP process management under OpenClaw-managed state/directories. |
| CE10.3 | Structured schema coverage | Manual review | Plan covers lead runs/candidates/sources, screening targets/reports/evidence/score blocks, Accio imports/conversations/messages/summaries, handoff events, memory facts, API call ledger, and audit events. |
| CE10.4 | Typed write boundary | Manual review | Agents do not receive raw SQL credentials or free-form SQL tools; writes go through Dashboard validation in Phase 1 and a future typed Sentura/MCP store tool in production hardening. |
| CE10.5 | Multi-agent runtime shape | Manual review | Plan uses one primary OpenClaw Gateway with three persistent configured CBE agents for the single customer trust boundary, and reserves multiple Gateways for separate tenants, rescue, or stronger isolation. |
| CE10.6 | Sub-agent restraint | Manual review | Plan keeps the three worker employees from spawning recursive sub-agents and makes a future `cbe-orchestrator` the only CBE component allowed to use session/subagent tools. |
| CE10.7 | 30-50 user concurrency | Manual review | Plan defines practical active-run limits for dashboard sessions, Lead runs, Screening batches, Accio imports, browser tasks, and model-call headroom with visible queue/backpressure behavior. |
| CE10.8 | Cloud region decision | Manual review | Plan chooses China primary hosting for the Shenzhen customer, preferably Alibaba Cloud China (Shenzhen) with Tencent Cloud South China as a valid procurement alternative, and explicitly rejects US primary hosting for latency/data-transfer reasons. |
| CE10.9 | Model API decision | Manual review | Plan defaults to China-accessible Qwen/DeepSeek/Volcengine/Kimi routes through OpenClaw providers and does not default to OpenAI for mainland China production traffic. |
| CE10.10 | Compliance posture | Manual review | Plan records ICP filing needs for public mainland hosting and treats overseas hosting/model calls with buyer contact/raw Accio data as PIPL outbound-transfer work. |
| CE10.11 | Security and backups | Manual review | Plan includes data-tier handling, no-auto-outreach, dangerous-tool denial, budget approval, secret handling, encrypted storage, backup/restore, and `openclaw security audit --deep` checks. |
| CE10.12 | Source traceability and self-check | Manual review | Plan lists current OpenClaw, cloud, model, OpenAI availability, and CAC sources, then includes a proofreading/self-check section confirming no custom runtime and no reintroduced deprecated workspace files. |

## CE11 — Alibaba International Station API Access And Screening Optimization Plan

Status: PASS (2026-06-13)

Scope: `跨境电商/SCREENING.md § 12`

| # | Check | Method | Expected |
|---|---|---|---|
| CE11.1 | Signed-seller access caveat | Manual review | Plan says a signed seller is likely eligible only after live Open Platform console/API-test proof, and does not assume all APIs are automatically granted. |
| CE11.2 | Enablement flow | Manual review | Plan covers customer account confirmation, developer app creation, callback URL, `app_key` / `app_secret`, seller authorization, code-to-token exchange, token storage, smoke tests, and production refresh. |
| CE11.3 | API status taxonomy | Manual review | Plan distinguishes free APIs, value-added APIs, authorization-required methods, Jushita-only methods, and private/hidden documents. |
| CE11.4 | High-value seller-owned APIs | Manual review | Plan prioritizes seller-owned customer/order/note methods for Screening, especially customer batch sync, order list/detail, order fund/logistics/address context, and customer notes. |
| CE11.5 | Buyer-side/procurement boundary | Manual review | Plan excludes buyer procurement history APIs unless the buyer separately authorizes, preventing misuse of buyer-side data in seller Screening. |
| CE11.6 | Opaque risk endpoint restraint | Manual review | Plan keeps `alibaba.icbu.risk.send` out of Screening until Alibaba confirms intended partner use and does not turn it into an unexplained fraud score. |
| CE11.7 | Evidence model update | Manual review | Plan adds Alibaba first-party evidence blocks while preserving public registry/domain/email/trade checks and neutral treatment for missing Alibaba records. |
| CE11.8 | Read-only MCP boundary | Manual review | Plan proposes `icbu-openapi` read-only MCP tools and rejects direct employee token/SDK access or mutation APIs. |
| CE11.9 | Data classification | Manual review | Plan treats CRM/customer/order/note data as T2/T3, redacts raw values from LLM prompts, and blocks raw data from vector memory/external APIs. |
| CE11.10 | Source traceability | Manual review | Plan lists the user-supplied doc, Alibaba Open API overview, authorization manual, and each prioritized API doc used for the decision. |

## CE12 — Concurrent Lead Discovery Dedupe Plan

Status: PASS (2026-06-13)

Scope: `跨境电商/MARKET_ACQUISITION.md § 9`

| # | Check | Method | Expected |
|---|---|---|---|
| CE12.1 | Problem framing | Manual review | Plan covers the exact User A/User B concurrent 20-lead, 5-minute run scenario and identifies duplicate search/API spend plus lead ownership conflict. |
| CE12.2 | Scope fingerprinting | Manual review | Plan defines canonical product/persona/country/language/source/exclusion fields, exact `scope_hash`, and weighted near-duplicate `scope_similarity`. |
| CE12.3 | Duplicate policy | Manual review | Exact active scope joins the running task by default; high-overlap scopes show shared-results, unassigned-only top-up, or narrow-search choices. |
| CE12.4 | DB-backed lease | Manual review | Plan uses `lead_discovery_scopes` with `locked_until` and heartbeat instead of in-memory locks or long database transactions. |
| CE12.5 | Shared result pool | Manual review | User B can attach to User A's active scope and see the same progress/final pool rather than starting another AgentChat run. |
| CE12.6 | Candidate identity uniqueness | Manual review | Plan adds `lead_identities` with tenant-scoped unique `identity_key` and defines identity-key precedence from Alibaba customer id, domain, email domain, then country/company fallback. |
| CE12.7 | Allocation separation | Manual review | Plan separates discovered shared leads from active sales ownership via `lead_allocations`, so display does not automatically reserve a buyer. |
| CE12.8 | Top-up behavior | Manual review | Plan starts only missing-count top-up runs when shared/unallocated unique leads cannot satisfy the new user's requested count. |
| CE12.9 | Employee task contract | Manual review | Plan passes existing identity keys and covered queries into top-up employee tasks so the employee avoids known duplicates. |
| CE12.10 | Incremental output option | Manual review | Plan proposes `LEAD_CANDIDATE_BATCH_JSON` for partial persistence while preserving the final `LEAD_CANDIDATES_JSON` contract. |
| CE12.11 | Crash and CBE scope handling | Manual review | Plan covers lease expiry/partial-result recovery and owner/team/visibility-scoped dedupe with hidden details plus hashed denylist behavior. |
| CE12.12 | OpenClaw boundary | Manual review | Plan keeps OpenClaw sessions simple and places business dedupe/ownership coordination in Sentura's database/run coordinator. |

## CE13 — Cross-Border Design Documentation Reorganization

Status: PASS (2026-06-13)

Scope: `跨境电商/DESIGN.md`, `跨境电商/MARKET_ACQUISITION.md`, `跨境电商/SCREENING.md`, `跨境电商/MEMORY_PROCESSING.md`, `README.md`, `AGENTS.md`

| # | Check | Method | Expected |
|---|---|---|---|
| CE13.1 | Shared design ownership | Manual review | `跨境电商/DESIGN.md` is simplified to shared platform, MCP, database, deployment, cross-agent flow, common safety/cost policy, milestone status, source index, and links to the three agent files. |
| CE13.2 | Marketing detail ownership | Manual review | `MARKET_ACQUISITION.md` contains Lead Discovery role/status, inputs, search strategy, tool policy, output schema, UI behavior, acceptance criteria, database/persistence, concurrent dedupe, implementation plan, and source/test traceability. |
| CE13.3 | Screening detail ownership | Manual review | `SCREENING.md` contains Screening role/status, intake schemas, UI, evidence ladder, registry/domain/email/social/trade/finance checks, scoring model, output schema, Alibaba API enhancement, database/persistence, budget controls, implementation plan, and sources. |
| CE13.4 | Memory detail ownership | Manual review | `MEMORY_PROCESSING.md` contains Accio Memory role/status, upload routes, fixture schema, required extraction results, summary output contract, UI, tool policy, memory write rules, database/persistence, Screening handoff, implementation plan, and sources. |
| CE13.5 | Implementation status preserved | Manual review | Each agent doc explicitly lists already implemented work and still-to-implement work; prior CE4/CE5/CE6/CE7 status is not lost. |
| CE13.6 | Recent design decisions preserved | Manual review | CE10 production deployment remains in shared design, CE11 Alibaba API moves to Screening, and CE12 concurrent lead dedupe moves to Marketing. |
| CE13.7 | Cross-links | Manual review | Shared design links to all three agent docs; each agent doc links back to shared design and the other relevant agent docs. |
| CE13.8 | README entrypoint | Manual review | README Key Documentation lists shared CBE design plus the three agent-specific CBE documents. |
| CE13.9 | AGENTS entrypoint | Manual review | AGENTS.md Cross-border task instructions require reading shared design plus the relevant agent detail file. |
| CE13.10 | On-demand banners | Manual review | The shared design and three agent docs carry on-demand-reference banners; the agent docs also carry back-links to the shared design. |
| CE13.11 | Test matrix sync | Manual review | `docs/TESTS.md` includes CE13 and updates CE1/CE10/CE11/CE12 paths to the reorganized docs. |
| CE13.12 | Memory sync | Manual review | `docs/MEMORY.md` and `docs/memory/cross-border-ecommerce/phase-1.md` record the reorganization and changed doc map. |
| CE13.13 | No forbidden workspace artifact reintroduction | Static diff review | The reorganization does not introduce forbidden historical workspace artifacts in new cross-border docs. |
| CE13.14 | Link/path smoke | Static review | New docs exist, are non-empty, and contain the expected headings for shared design plus three agent docs. |

## CE14 — Cross-Border Employee Role UI Design

Status: PASS (2026-06-13)

Scope:

- `跨境电商/UI.md`
- `跨境电商/DESIGN.md`
- `跨境电商/MARKET_ACQUISITION.md`
- `跨境电商/SCREENING.md`
- `跨境电商/MEMORY_PROCESSING.md`
- `README.md`
- `AGENTS.md`

| # | Check | Method | Expected |
|---|---|---|---|
| CE14.1 | Role split | Manual review | `UI.md` separates ordinary Employee/operator use from Admin monitoring, fully designs Employee pages, and reserves detailed Admin page implementation for Phase 2. |
| CE14.2 | Navigation | Manual review | Employee navigation has Sentura logo on the left, `获客与背调` / `记忆整理` center navigation, and a right user center with personal center, messages, settings, and logout. |
| CE14.3 | Personal center | Manual review | Login landing page tracks personal counts for Marketing Acquisition leads, Screening investigations, Accio chat records organized, high-score buyers, pending work, recent activity, and message reminders. |
| CE14.4 | Customer list layout | Manual review | `获客与背调` specifies one customer list with company, country, type, product, website, found time, score, and operation columns. |
| CE14.5 | Customer row status colors | Manual review | Customer rows map uninvestigated to white, running to blue, high score to green, medium score to orange, and low score to red, with text badges. |
| CE14.6 | Customer search/filter/actions | Manual review | Page supports company-name search; country/type/product/found-time/scored/score-tier filters; and `寻找客户`, `批量背调`, `手动背调`, `开始调研`, `查看报告` actions. |
| CE14.7 | Memory list layout | Manual review | `记忆整理` specifies one chat-record list with name, source, import time, and operation columns. |
| CE14.8 | Memory row status colors | Manual review | Memory rows map analyzed records to green and not-analyzed records to white, with running/error states documented for operational feedback. |
| CE14.9 | Memory search/filter/actions | Manual review | Page supports name search; source/import-time/analysis filters; `添加新记录`; and row-level `开始分析` / `查看报告`. |
| CE14.10 | No visible direct Agent chat | Manual review | Employee pages must not render a free-form Agent chat session; business actions use buttons/forms and task progress instead. |
| CE14.11 | Hidden Agent connection | Manual review | Backend connection stays on OpenClaw/Sentura: hidden sessions through Gateway `sessions.create` / `chat.send`, employee registration checks, event subscription, and structured JSON marker parsing for all three employees. |
| CE14.12 | Documentation sync | Manual/static review | README, AGENTS, shared design, and three agent docs link to `UI.md`; tests and memory matrix record this UI design session. |

## CE15 — Cross-Border Employee UI Implementation

Status: PASS (2026-06-14)

Scope:

- `sentura/dashboard/src/app/page.tsx`
- `sentura/dashboard/src/app/layout.tsx`
- `sentura/dashboard/src/components/app-shell.tsx`
- `sentura/dashboard/public/sentura-logo-icon.svg`
- `sentura/dashboard/public/sentura-logo-side.svg`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
- `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
- `sentura/dashboard/src/lib/gateway/{client,index,types}.ts`

Validation command:

```bash
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm build
```

Browser validation:

- Dev server: `cd sentura/dashboard && pnpm exec next dev --hostname 127.0.0.1 --port 3000`
- Checked `/client-demos/cross-border/employee`, `/client-demos/cross-border/employee/customers`, and `/client-demos/cross-border/employee/memory`.
- Checked default desktop viewport and 390px mobile viewport.

| # | Check | Method | Expected |
|---|---|---|---|
| CE15.1 | Root landing | Browser + static review | `/` redirects to `/client-demos/cross-border/employee`, making the Employee personal center the first dashboard screen for this demo build. |
| CE15.2 | Employee shell | Browser | Top shell shows Sentura logo, `跨境电商客户系统`, two work tabs (`获客与背调`, `记忆整理`), user menu, connection status, and personal API cost mini widget. |
| CE15.3 | Chinese metadata | Static review | Dashboard `metadata` and `html lang` are localized for the cross-border Employee system. |
| CE15.4 | Personal center | Browser | Personal center renders greeting, role/tenant badges, range selector, four KPI cards, pending work, recent tasks, funnel, messages, and API cost card. |
| CE15.5 | Customer list | Browser | `获客与背调` renders one customer list with company, country, type, products, website, found time, score, and actions. |
| CE15.6 | Customer filters | Browser interaction | Filter drawer supports country, type, product, found-time, status, and score-tier filters; applying `高分` shows the removable `评分：高分` chip and narrows results to one customer. |
| CE15.7 | Customer actions | Browser/static review | Page exposes `寻找客户`, `批量背调`, `手动背调`, row detail, and start-screening actions with Gateway/employee-missing notices when unavailable. |
| CE15.8 | Customer detail drawer | Browser/static review | Customer drawer includes overview, source evidence, screening report summary, and task-history audit reference without a free-form Agent input. |
| CE15.9 | Memory list | Browser | `记忆整理` renders one record list with name, source, import time, conversation count, status, and actions. |
| CE15.10 | Memory filters | Browser interaction | Filter drawer supports source, import time, and analysis status; applying `已分析` shows the removable `状态：已分析` chip and narrows results to one record. |
| CE15.11 | Memory actions | Browser/static review | Page exposes `添加新记录`, import-only, import-and-analyze, row detail, start-analysis, and send-to-screening actions with Gateway/employee-missing notices when unavailable. |
| CE15.12 | API cost panel | Type/build + browser | Cost UI uses `sentura.cost.events` through the Gateway client when connected and falls back to clearly marked demo estimates when no events are available. |
| CE15.13 | No visible Agent chat | Browser | Employee home, customers, and memory pages do not render direct chat composer strings such as `Type a message to start` or `Continue the conversation`. |
| CE15.14 | Mobile layout | Browser at 390px | All three Employee routes have no horizontal page overflow and retain the two-tab mobile work nav. |
| CE15.15 | Verification caveat | Commands | `pnpm exec tsc --noEmit` and `pnpm build` pass. `pnpm lint` still fails on pre-existing repository-wide React Compiler rules outside this implementation scope; new code-specific unused import and image warnings were cleaned. |

## CE16 — Cross-Border Employee Hidden Task Runner + Progress Persistence

Status: PASS (2026-06-16)

Scope:

- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
- `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`
- `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
- `sentura/dashboard/src/lib/gateway/client.ts`
- `sentura/dashboard/src/components/app-shell.tsx`
- `sentura/extensions/sentura-cost/src/types.ts`
- `sentura/extensions/sentura-cost/src/session-log-backfill.ts`
- `scripts/test-cross-border-agents.ts`
- `scripts/test-week4-cost.ts`
- `outputs/task_handoff.md`

Validation command:

```bash
pnpm exec tsx scripts/test-cross-border-agents.ts   # 335/335
pnpm exec tsx scripts/test-week4-cost.ts            # 37/37
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm exec eslint src/components/cross-border/employee-cost.tsx src/lib/gateway/types.ts
cd sentura/dashboard && pnpm build
```

Browser validation:

- Existing dev server on `http://127.0.0.1:3000`.
- Checked `/client-demos/cross-border/employee`, `/client-demos/cross-border/employee/customers`, and `/client-demos/cross-border/employee/memory`.
- On the customer page, clicked `本月 API 成本` and verified the per-call cost detail dialog opens from real `sentura.cost.events` records.
- Current external-cost backfill probe over `~/.openclaw` collected 220 total cost events: 83 model/session events and 137 external tool-log events. External rows include public/free DNS/RDAP/SEC/official-web fetches, included/zero-cost ImportYeti responses when the provider returns `requestCost=0`, Tavily estimates when web-search tool calls expose enough metadata, and unpriced Abstract/Hunter rows when provider plan/credit-to-dollar conversion is not safely inferable.
- In `筛选客户`, selected `USB-C 充电器`; the table narrowed to the single matching Nordic customer row and the filter chip displayed `产品：USB-C 充电器`.
- Header DOM renders a real `消息中心` button wired to a local task-notification popover; static checks cover the completed/failed task source, red unread badge, and `全部已读` action.
- Header DOM renders only `sentura-logo-side.svg`; the standalone `sentura-logo-icon.svg` is no longer used in the Employee shell.
- Customer page gates `寻找客户` and `背调` independently, so one active Lead task and one active Screening task can run at the same time while same-kind duplicates remain blocked.
- Global task status bar can render two active task cards and labels the simultaneous background work.
- 2026-06-16 live-session evidence: a failed-looking `cbe-buyer-screening` session had a completed backend JSONL output of 10,570 assistant characters with both `SCREENING_REPORTS_JSON_START/END`; the previous frontend read path could miss the end marker when default `chat.history` projection truncated long assistant messages.
- 2026-06-16 repeated-failure evidence: a later `cbe-buyer-screening` session failed on the backend with `LLM idle timeout (120s): no response from model` after tool calls. One SEC lookup result in the transcript was about 64 KB before the fix, so the MCP adapter now returns only compact recent-filing summaries instead of full SEC submissions JSON.
- New 2026-06-16 UI controls, runner behavior, and external-provider cost visibility are covered by source/static/type/build/cost-backfill checks. Live submit was not rerun in this pass to avoid extra external search/LLM/API spend while diagnosing already completed sessions.
- Opened the `寻找客户` drawer without clicking final submit buttons that would trigger live employee work.
- Checked default desktop viewport and 390px mobile viewport.

| # | Check | Method | Expected |
|---|---|---|---|
| CE16.1 | Non-visual runner helper | Static review | `employee-task-runner.ts` centralizes hidden employee execution through `GatewayClient.createSession(...)`, polls `chat.history`, and returns parsed records without rendering `AgentChat`. |
| CE16.2 | Lead task path | Static review | Customer `寻找客户` submits a structured prompt to `cbe-lead-discovery`, requires `LEAD_CANDIDATES_JSON_START/END`, converts parsed leads into local customer rows, and reports marker-missing/parse/timeout errors. |
| CE16.3 | Screening task path | Static review | Customer `批量背调` and `手动背调` submit normalized targets to `cbe-buyer-screening`, require `SCREENING_REPORTS_JSON_START/END`, and upsert scored/insufficient-evidence rows. |
| CE16.4 | Accio memory path | Static review | Memory `导入并分析` and row-level `开始分析` submit Accio/manual-normalized payloads to `cbe-accio-memory`, require `ACCIO_SUMMARIES_JSON_START/END`, and upsert memory preview rows. |
| CE16.5 | Upload JSON actually read | Static/browser review | `添加新记录` reads and parses the selected JSON file; `仅导入` is disabled until a valid payload exists and adds a local `未分析` row. |
| CE16.6 | Gateway unavailable UX | Browser interaction | `寻找客户` drawer remains openable even when Gateway/agent lookup is unavailable, but final submit remains disabled and shows the Gateway/agent-missing notice. |
| CE16.7 | No free-form chat | Browser | Employee home, customer, and memory routes expose no visible chat/message composer fields while still using OpenClaw hidden sessions for task execution. |
| CE16.8 | Desktop Browser smoke | Browser | Home, customers, lead drawer, memory page, and add-record drawer render expected labels and produce zero console errors. |
| CE16.9 | Mobile Browser smoke | Browser at 390px | Home, customers, and memory pages render expected labels, produce zero console errors, and have no horizontal page overflow. |
| CE16.10 | Build/type/lint status | Commands | `pnpm exec tsc --noEmit`, focused ESLint for the changed Employee files, and `pnpm build` pass. |
| CE16.11 | Dynamic ETA and timeout | Static review | `employee-task-runner.ts` estimates Lead/Screening duration from task scope, extends hidden task timeout from that estimate, and emits progress fields including remaining time and percent. |
| CE16.12 | Visible countdown | Static/browser review | The global Employee task status bar shows `预计`, `已用`, `倒计时`, percent progress, result count, and session key where available instead of only `正在读取后台任务进度...`. |
| CE16.13 | Cross-route task state | Static review | Customer `寻找客户`, `批量背调`, and `手动背调` create global task records via `useCbeEmployeeStore` and no longer use page-local `setTaskRunning`. |
| CE16.14 | Row persistence | Static review | Customer rows live in the CBE Employee store and are persisted with task records under `sentura-cbe-employee-state-v1`, so completed hidden-task rows survive route navigation. |
| CE16.15 | Terminal failure visibility | Static review | Failures call `failTask`, retain `sessionKey` when available, and remain visible until dismissed instead of disappearing after an 8-second toast timeout. |
| CE16.16 | Global shell placement | Static review | `AppShell` renders `EmployeeTaskStatusBar` above page content so active Lead/Screening progress remains visible after switching to `记忆整理`. |
| CE16.17 | Stale local recovery | Static review | The CBE store marks active tasks stale only after their hard deadline plus grace period, making route reload/long-wait failures explicit instead of silently vanishing. |
| CE16.18 | Current verification | Commands + Browser | `scripts/test-cross-border-agents.ts` passes 335/335, `scripts/test-week4-cost.ts` passes 37/37; `@sentura/mcp-cross-border-intel` test/build pass; dashboard `tsc --noEmit`, focused lint, and `next build` pass; prior Browser customer page checks remain recorded, and the current pass avoided new live submit calls. |
| CE16.19 | Single task-progress surface | Static/browser review | Ongoing task progress is shown by the global `EmployeeTaskStatusBar`; customer-page local notices no longer duplicate `正在读取后台任务进度` or task success messages under the page header. |
| CE16.20 | Cost detail interaction | Static/browser review | `EmployeeCostMini` has hover scaling, opens `本月 API 成本明细`, and lists each recorded cost event with time, employee, service/interface, usage, pricing status, duration, and cost. |
| CE16.21 | Customer filters use stable values | Static/browser review | `筛选客户` renders Chinese labels for buyer type/product filters while filtering by canonical internal values, preserving product terms such as `USB-C`, `OLED`, and `MagSafe`. |
| CE16.22 | Date filter freshness | Static review | Customer `时间` filtering uses the current browser date instead of a hard-coded fixture date, so `今日` / `近 7 天` / `近 30 天` do not drift stale after 2026-06-14. |
| CE16.23 | Bell notification center | Static review + DOM smoke | The header `消息中心` is wired to a real notification popover backed by terminal CBE task records, shows a red unread number badge after completed/failed tasks, and supports marking notifications read. |
| CE16.24 | Single clean header logo | Static review + DOM smoke | The Employee shell keeps only `sentura-logo-side.svg` in the top-left brand area and does not render the standalone `sentura-logo-icon.svg`, avoiding the double-logo layout. |
| CE16.25 | Parallel Lead and Screening task gates | Static review | Customer page derives `leadRunning` and `screeningRunning` independently, allowing one active `寻找客户` and one active `背调` task to run together while blocking same-kind duplicate starts. |
| CE16.26 | Multi-task status bar | Static review | `EmployeeTaskStatusBar` renders up to two active task cards and shows `正在同时运行 N 个后台任务` when Lead and Screening are both active. |
| CE16.27 | No running status filter | Static/browser review | Customer quick filters and filter sheet remove `背调中` as a filter option while row status can still display `背调中` for active customers. |
| CE16.28 | Score sorting | Static/browser review | Customer list supports `评分高到低` and `评分低到高` sort controls with clearable chips/reset behavior. |
| CE16.29 | No scoring-calculation evidence layer | Static review | Screening report evidence no longer renders the `评分计算` layer; scoring remains in score blocks and final score fields instead of a fake evidence source. |
| CE16.30 | Long Screening output read | Static review + live-session evidence | Hidden employee polling passes a high `maxChars` value to `chat.history` so long `SCREENING_REPORTS_JSON` messages can include both start and end markers instead of timing out after frontend-side truncation. |
| CE16.31 | Lead target count hard target | Static review | The Lead prompt treats `target_count` as the requested count, removes the old 1-5 high-quality cap, and requires `shortage_reason` only when compliant public sources remain insufficient. |
| CE16.32 | Manual numeric Lead target input | Static review | The `寻找客户` sheet uses a numeric input with `min=1` and normalization instead of fixed 20/50/100/150 preset buttons. |
| CE16.33 | Lead over-return cap | Static review | Parsed Lead rows are capped to the normalized requested `targetCount`, so an employee over-return does not insert more rows than requested. |
| CE16.34 | External API cost event schema | Static review | `sentura-cost` supports `model`, `external_api`, and `local_tool` cost events, plus pricing status, service/interface labels, HTTP status, tool name, and external usage units such as request, credit, page, or local call. |
| CE16.35 | External tool-log cost backfill | Static/cost test | OpenClaw session `toolResult` logs for CBE tools are backfilled into cost rows for Companies House, RDAP, DNS, Abstract Email Reputation, Hunter, SEC EDGAR, ImportYeti, Tavily/web_search, public web fetches, and local scoring; free/included/unpriced rows are visible without fabricating USD spend. |
| CE16.36 | Backend model failure surfacing | Static review + live-session evidence | Hidden task polling inspects transcript `errorMessage` / `stopReason` fields and raises `backend_error` with a specific Chinese message for `LLM idle timeout`, instead of waiting until the generic marker timeout path. |
| CE16.37 | Compact SEC lookup payload | MCP unit test + static review | `cross-border-intel` `cbe_intel_sec_lookup` returns `submissions_summary` with bounded recent filings instead of full SEC submissions JSON, keeping the tool payload under the regression threshold while preserving official filing evidence. |
| CE16.38 | Lead target submit snapshot | Static review + live-session evidence | After a 2026-06-21 live run showed Google Maps succeeded but the submitted prompt/database `target_count` was 3, the `寻找客户` submit button now reads the current target input ref at click time, rebuilds the lead payload from that snapshot, and visibly echoes `目标 N 个客户` in the sheet summary and submit button. |

## CE17 — Cross-Border Phase 2 Execution Plan

Status: PASS (2026-06-16)

Scope:

- `跨境电商/PHASE-2.md`
- `跨境电商/DESIGN.md`
- `README.md`
- `AGENTS.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-1.md`

Validation method:

```bash
test -s 跨境电商/PHASE-2.md
rg -n 'PHASE-2.md|CE17|Phase 2' README.md AGENTS.md 跨境电商/DESIGN.md docs/TESTS.md docs/tests/tests-cross-border-ecommerce.md docs/MEMORY.md docs/memory/cross-border-ecommerce/phase-1.md
git diff --check
```

| # | Check | Method | Expected |
|---|---|---|---|
| CE17.1 | On-demand banner | Static review | `PHASE-2.md` starts with the standard `On-demand reference — not read by default` banner and links back to `DESIGN.md`. |
| CE17.2 | Existing-doc grounding | Manual review | The plan explicitly maps decisions from `DESIGN.md`, `UI.md`, `MARKET_ACQUISITION.md`, `SCREENING.md`, `MEMORY_PROCESSING.md`, `docs/TESTS.md`, and `docs/MEMORY.md`. |
| CE17.3 | Runtime boundary | Manual review | The plan preserves OpenClaw as the agent runtime and Sentura as control plane; it forbids custom runtime/Gateway/Docker wrappers, direct LLM provider calls, and raw SQL access for employees. |
| CE17.4 | Phase-2 goals | Manual review | The plan defines production persistence, typed store, DB-backed Employee UI state, Lead coordinator, durable Screening/Accio records, agent contract tuning, and multi-user/load-smoke coverage. |
| CE17.5 | Execution order | Manual review | The plan orders work as DB foundation, typed store/routes, UI migration, Lead coordinator, Screening/Accio durable workflows, and load smoke. |
| CE17.6 | Business DB schema | Manual review | The plan includes tenant/user/run, Lead, Screening, Accio, handoff, memory-fact, API ledger, audit, and Lead coordinator tables with minimum indexes. |
| CE17.7 | Store and route boundary | Manual review | The plan defines typed store modules and Next.js App Router route handlers that validate employee marker JSON before DB writes. |
| CE17.8 | LocalStorage migration | Manual review | The plan makes DB the source of truth for customers, tasks, reports, notifications, memory rows, and handoffs while keeping localStorage only for drafts/cache. |
| CE17.9 | Lead coordinator design | Manual review | The plan defines `scope_hash`, leases, memberships, shared result pool, near-duplicate choices, top-up-only mode, and `existing_identity_keys` denylist. |
| CE17.10 | Screening durability | Manual review | The plan persists targets, reports, evidence, score blocks, cost/audit rows, and failure codes without erasing prior good reports. |
| CE17.11 | Accio durability and memory approval | Manual review | The plan stores raw uploads outside vector memory, persists redacted/hash-only messages, writes summaries and handoffs, and requires approval before memory facts become approved. |
| CE17.12 | Backpressure/load smoke | Manual review | The plan uses the existing 30-50 user concurrency targets and describes queued `agent_runs`, row locks/leases, duplicate-run tests, and staged load-smoke expectations. |
| CE17.13 | Test roadmap | Manual review | The plan defines CE18-CE22 implementation-test targets and minimum commands for each implementation slice. |
| CE17.14 | Documentation sync | Static review | README, AGENTS, `DESIGN.md`, `docs/TESTS.md`, and memory files all link to or record the Phase 2 plan. |
| CE17.15 | Customer-specific user levels | Manual review | `PHASE-2.md` defines only two customer-facing CBE product roles, `operator` and `admin`, and explicitly avoids exposing the full Sentura platform role model in this client UI. |
| CE17.16 | Ordinary-user product surface | Manual review | The plan and `UI.md` state that the existing `个人中心`, `获客与背调`, and `记忆整理` pages are the ordinary-user surface for starting Lead/Screening/Accio work and viewing own/shared records. |
| CE17.17 | Admin monitoring boundary | Manual review | Admin is a customer-side supervisor role with read-mostly monitoring over live tasks, aggregate lead/screening lists, per-user lists, per-agent usage, statistics, costs, and failures; it cannot create AI employees or edit prompts/tools/model/provider/OpenClaw config. |
| CE17.18 | Monitoring database design | Manual review | The schema includes `cbe_user_profiles` with `admin`/`operator`, `agent_runs` target/stage fields, `agent_run_activity_events`, and owner/team/visibility fields for Lead, Screening, Accio, handoff, and memory records. |
| CE17.19 | Admin monitoring route planning | Static review | `PHASE-2.md` includes planned Admin monitoring route handlers and page files for `overview`, `live-tasks`, `customers`, `operators`, `operators/[id]`, and `agent-usage`. |

## CE18 — Phase 2 P2.1 Business Database Foundation

Status: PASS (2026-06-16)

Scope:

- `sentura/lib/cross-border-store/migrations/001_initial_schema.sql`
- `sentura/lib/cross-border-store/migrations/002_lead_scope_coordinator.sql`
- `sentura/lib/cross-border-store/db.ts`
- `sentura/lib/cross-border-store/ids.ts`
- `sentura/lib/cross-border-store/migrate.ts`
- `sentura/lib/cross-border-store/schemas.ts`
- `sentura/lib/cross-border-store/seed.ts`
- `sentura/lib/cross-border-store/index.ts`
- `sentura/dashboard/src/lib/cross-border-store/index.ts`
- `scripts/test-cross-border-phase2-store.ts`
- `package.json`
- `pnpm-lock.yaml`
- `sentura/lib/package.json`
- `sentura/lib/tsconfig.json`

Validation commands:

```bash
pnpm exec tsx scripts/test-cross-border-phase2-store.ts
CBE_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sentura_cbe_dev" pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db
CBE_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sentura_cbe_dev" pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed
sentura/dashboard/node_modules/.bin/tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck sentura/lib/cross-border-store/*.ts scripts/test-cross-border-phase2-store.ts sentura/dashboard/src/lib/cross-border-store/index.ts
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store/index.ts
pnpm exec tsx scripts/test-cross-border-agents.ts
git diff --check
```

| # | Check | Method | Expected |
|---|---|---|---|
| CE18.1 | Migration files exist | `scripts/test-cross-border-phase2-store.ts` | `001_initial_schema.sql` and `002_lead_scope_coordinator.sql` exist under `sentura/lib/cross-border-store/migrations/` with ordered numeric names. |
| CE18.2 | Core tenant/user/profile schema | Static/live DB check | Migrations create `tenants`, `sentura_users`, and `cbe_user_profiles`, with CBE product roles limited to `admin` and `operator`. |
| CE18.3 | Agent-run monitoring schema | Static/live DB check | `agent_runs` stores tenant/user/owner, visibility, agent id, session key, status, task kind, target summary, stage, timestamps, model/cost, and error fields. |
| CE18.4 | Activity-event monitoring schema | Static/live DB check | `agent_run_activity_events` records operator, Agent, task kind, target record/summary, stage, event type, tool/source, status, timestamp, and metadata for Admin live-task monitoring. |
| CE18.5 | Lead persistence schema | Static/live DB check | Lead tables cover `lead_runs`, `lead_candidates`, `lead_sources`, owner/team/visibility fields, matched products JSON, dedupe keys, and source metadata. |
| CE18.6 | Screening persistence schema | Static/live DB check | Screening tables cover targets, reports, evidence, score blocks, risk tier, normalized score, evidence coverage, recommended action, and report JSON. |
| CE18.7 | Accio persistence schema | Static/live DB check | Accio tables cover imports, conversations, redacted/hash-only messages, summaries, source file hash, storage key, validation status, and behavior summary JSON. |
| CE18.8 | Handoff/memory/cost/audit schema | Static/live DB check | `handoff_events`, `memory_facts`, `api_call_ledger`, and `audit_events` exist with tenant scope and structured JSON payload fields. |
| CE18.9 | Lead coordinator schema | Static/live DB check | `lead_discovery_scopes`, `lead_run_memberships`, `lead_identities`, `lead_run_results`, and `lead_allocations` exist with scope hash, lease, identity, membership, result, and allocation fields. |
| CE18.10 | Index coverage | Static/live DB check | Required indexes exist for lead domain uniqueness, Screening lookups/latest report, Accio lookup, cost/audit rollups, run status, active scopes, profile role, owner scopes, and activity monitoring. |
| CE18.11 | Projection views | Static/live DB check | `cbe_customer_work_items`, `cbe_operator_workload_daily`, and `cbe_agent_usage_daily` exist for Employee/Admin read projections. |
| CE18.12 | Config boundary | Static check | `db.ts` requires `CBE_DATABASE_URL` and tells callers to use environment/secret injection rather than committed credentials. |
| CE18.13 | Migration runner | Static/live DB check | Runner creates migration history, uses a transaction, records checksums, rejects changed applied migrations, and re-runs as no-op. |
| CE18.14 | Seed records | Static/live DB check | Seed creates tenant `cross-border-ecommerce`, one admin profile, and at least two operator profiles without storing emails, raw tokens, or credentials. |
| CE18.15 | Dashboard boundary placeholder | Static check | Dashboard `src/lib/cross-border-store/index.ts` exposes CBE product role and Admin/ordinary-user module constants without giving employees raw SQL access. |
| CE18.16 | Live local PostgreSQL migration | `--require-db` command | On the local `sentura_cbe_dev` database, migrations apply successfully, seed succeeds, rerun is a no-op, and required tables/views/indexes/profiles are present. |
| CE18.17 | Activity write probe | `--require-db` command | A rollback-scoped insert into `agent_runs` plus `agent_run_activity_events` succeeds, proving the monitoring FK path is writable without leaving test rows. |
| CE18.18 | Type/lint compatibility | Commands above | New store files compile under strict NodeNext settings; dashboard typecheck and focused lint pass. Existing full `sentura/lib` typecheck remains blocked by pre-existing `.ts` import-extension settings outside the new store files. |
| CE18.19 | Legacy CBE suite preserved | `pnpm exec tsx scripts/test-cross-border-agents.ts` | Existing CE4-CE7/CE16 checks remain green at 335/335 after adding P2.1 files. |
| CE18.20 | Secret hygiene | Static check | Migration and seed files do not embed connection strings, passwords, API keys, app secrets, bearer tokens, email addresses, or raw user tokens. |
