> **On-demand reference — not read by default.**
>
> Back-link: [`docs/TESTS.md`](../TESTS.md)

# Cross-Border E-Commerce Project Tests

Detailed test cases for the mobile-accessory Cross-border e-commerce / 跨境电商 independent client pilot. This file is not part of the core A/B/C/D sprint plan and should be updated alongside the Cross-border E-commerce section in `docs/TESTS.md`.

## CE1 — Phase-1 MVP Design And API Sourcing

Status: PASS (2026-06-08)

Scope: `跨境电商/DESIGN.md`

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
pnpm --filter @sentura/mcp-cross-border-intel test   # 17/17
pnpm --filter @sentura/mcp-cross-border-intel build
```

| # | Check | Expected |
|---|---|---|
| CE3.1 | Package/build contract | `package.json`, `tsconfig.json`, `vitest.config.ts`, and README follow existing Sentura MCP patterns; `pnpm --filter @sentura/mcp-cross-border-intel build` passes. |
| CE3.2 | Tool catalog | MCP `listTools()` exposes exactly 10 designed read-only tools: registry search, company profile, RDAP, email/domain check, official contact email search, SEC lookup, trade-record search, contextual score, Accio parse, Accio summarize. |
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

## CE4 — Marketing Acquisition Employee Workspace

Status: PASS (2026-06-12)

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

Latest CE4+CE5 coverage after Lead execution-path correction: 213/213 PASS (2026-06-08). Latest combined CE4–CE7 coverage after mainland domestic-model options: 296/296 PASS (2026-06-12). After pre-load-test audit fixes (P0/P1-4, see CE10): **302/302 PASS (2026-06-13)**.

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
| CE4.14 | Domestic model options | `config.json5` lists `deepseek/deepseek-chat`, `qwen/qwen3.5-plus`, and `moonshot/kimi-k2.6` as selectable models with the OpenClaw `agentRuntime` pin, and `scripts/sentura-setup.{sh,ps1}` expose the `SENTURA_CBE_AGENT_MODEL` primary-model switch plus the same three allowlisted domestic refs for mainland deployment. |

## CE5 — Screening And Background Employee Workspace + Employee-Executed UI/API

Status: PASS (2026-06-12)

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
npx tsx scripts/test-cross-border-agents.ts   # CE4 + CE5 + CE6 + CE7 — 302/302
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
| CE5.21 | Domestic model options | Screening `config.json5` lists `deepseek/deepseek-chat`, `qwen/qwen3.5-plus`, and `moonshot/kimi-k2.6` as selectable models with the OpenClaw `agentRuntime` pin for mainland deployment. |

## CE6 — Accio Memory Processing Employee Workspace + Report Correctness

Status: PASS (2026-06-12)

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
npx tsx scripts/test-cross-border-agents.ts   # CE4 + CE5 + CE6 + CE7 — 302/302
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
| CE6.13 | Domestic model options | Accio `config.json5` lists `deepseek/deepseek-chat`, `qwen/qwen3.5-plus`, and `moonshot/kimi-k2.6` as selectable models with the OpenClaw `agentRuntime` pin for mainland deployment. |

## CE7 — Cross-Border Employee Demo UIs

Status: PASS (2026-06-12)

Scope:

- `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`

Validation command:

```bash
npx tsx scripts/test-cross-border-agents.ts   # CE4 + CE5 + CE6 + CE7 — 302/302
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

Status: PASS (2026-06-12)

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
| CE8.12 | Mainland domestic model guidance | Manual review | §4 key table and §5.1.1 cover `DEEPSEEK_API_KEY` / `QWEN_API_KEY` / `MOONSHOT_API_KEY` acquisition entries, the `SENTURA_CBE_AGENT_MODEL` setup switch, mainland base-URL overrides for Qwen/Moonshot via `models.providers.<id>.baseUrl`, and the post-switch structured-JSON employee smoke requirement. |

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
| CE9.4 | Env source handling | Static review | Setup reads both current process env and OpenClaw state `.env`, so operators can configure keys before running setup without exposing them in repo files. |
| CE9.5 | Secret handling | Static review | API keys are stored as `${ENV_VAR}` config references when present; missing optional keys are omitted; setup never writes raw API key values into `openclaw.json`. |
| CE9.6 | Budget/default handling | Static review | `SEC_USER_AGENT`, `CBE_ENABLE_PAID_TRADE_DATA`, `CBE_MAX_PAID_SPEND_USD`, and `CBE_INTEL_REQUEST_TIMEOUT_MS` use configured non-secret values or safe defaults. |
| CE9.7 | Web-search boundary | Static review | `TAVILY_API_KEY` is noted for OpenClaw `web_search` and CE4 Dashboard live-search usage, but is not placed into the `cross-border-intel` MCP env block. |

## CE10 — Pre-Load-Test Audit Fixes (P0 + P1-4)

Status: PASS (2026-06-13)

Scope (source + server runtime double-write):

- `sentura/agents/cbe-lead-discovery/config.json5`
- `sentura/agents/cbe-buyer-screening/config.json5`
- `sentura/agents/cbe-accio-memory/config.json5`
- `scripts/sentura-setup.sh`
- `scripts/sentura-setup.ps1`
- `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`
- `scripts/test-cross-border-agents.ts`

Context: 2026-06-13 pre-load-test 8-dimension adversarial audit (see [`跨境电商/research/pre-loadtest-audit-2026-06-13.md`](../../跨境电商/research/pre-loadtest-audit-2026-06-13.md)) found 4 P0 load-test blockers + P1-4 (container caps). All fixed and verified.

Validation command:

```bash
npx tsx scripts/test-cross-border-agents.ts   # CE4 + CE5 + CE6 + CE7 + CE10 regression guards — 302/302
```

| # | Check | Expected |
|---|---|---|
| CE10.1 | P0-1 maxConcurrent explicit | `scripts/sentura-setup.{sh,ps1}` set `agents.defaults.maxConcurrent` explicitly (default 8, env-overridable via `SENTURA_MAX_CONCURRENT`) so the gateway Main lane is not silently capped at `DEFAULT_AGENT_MAX_CONCURRENT=4`. Server `~/.openclaw/openclaw.json` mirrors this. |
| CE10.2 | P0-2 model fallback chain | Each `cbe-*/config.json5` `model` is `{ primary: "deepseek/deepseek-chat", fallbacks: ["qwen/qwen3.5-plus", "moonshot/kimi-k2.6"] }` (a real fallback source via `agents.defaults.model.fallbacks` / per-agent `model.fallbacks`, NOT the `models:` registration map). Setup builds the same via `cbeAgentModel`. A 429 switches provider instead of suspending the Main lane for 30 min. |
| CE10.3 | P0-3 alsoAllow not bare allow (regression guard) | All three `cbe-*/config.json5` and the setup scripts use `tools.alsoAllow` (agent layer) and `tools.sandbox.tools.alsoAllow` (sandbox layer) — never bare `tools.allow`. `test-cross-border-agents.ts` asserts `alsoAllow:` present AND no bare `allow: [` line, so a future regression to `allow` fails the test. Reason: `profile:minimal` is a leading intersecting filter; `allow` can only narrow it (→ zero tools), `alsoAllow` merges into the profile allowlist before the filter. |
| CE10.4 | P1-4 sandbox docker caps | Each `cbe-*/config.json5` `sandbox.docker = { memory: "2g", memorySwap: "2g", cpus: 1, pidsLimit: 256, ulimits: { nofile: "4096:8192" } }`; setup builds the same via `cbeSandboxDocker`. `test-cross-border-agents.ts` asserts `docker:` + `pidsLimit` present. Verified live via `docker inspect`: `Memory=2147483648 NanoCpus=1000000000 PidsLimit=256`. |
| CE10.5 | P0-4 accio empty-intent guard | `accio-memory/page.tsx:816` uses `summary.purchase_intent?.[0]` and all `intent` field reads use optional chaining (`intent?.product`, `(intent?.models ?? [])`, `next_actions?.[0]`); an empty `purchase_intent` array renders a placeholder row ("未提取到采购意向") instead of a render-time TypeError / white screen. |
| CE10.6 | Test-suite multi-line sandbox assertion | The 3 `pins non-main sandbox` checks match the multi-line `mode: "non-main"` structure (not the old single-line `sandbox: { mode: "non-main" }` string), so the sandbox-docker block does not break the non-main assertion. |
| CE10.7 | Combined regression count | `npx tsx scripts/test-cross-border-agents.ts` returns 302/302 (was 296; +6 from CE10.3 ×3 alsoAllow guards and CE10.4 ×3 docker-cap guards). |

Outstanding (not blocking load test): P1-1 a real tool-policy resolver test (current alsoAllow string guard is a cheap proxy, not a resolver-level assertion).

## CE11 — Mainland Cloud Load Test (Sweep 1 + Sweep 2 + Sweep 3)

Status: PASS — Sweep 1 (offered-concurrency, pure inference) + Sweep 2 (maxConcurrent sweep) on 2026-06-13; Sweep 3 (real tool-calling load) on 2026-06-15.

Scope:

- `scripts/cbe-loadtest.mjs` (gateway WS production-path driver — pure-inference load)
- `scripts/cbe-loadtest-tools.mjs` (dual-mode real tool-calling driver via `CBE_MODE` — screening: `cbe-buyer-screening` real US-company backgrounding (RDAP+DNS+SEC); lead: `cbe-lead-discovery` real buyer search via Tavily `web_search`)
- `scripts/cbe-loadmon.sh` (resource sampler)
- Report: [`跨境电商/research/loadtest-report.md`](../../跨境电商/research/loadtest-report.md)

Environment: Aliyun ECS `ecs.g9i.xlarge` (4 vCPU / 16 GiB, Ubuntu 24.04), IP `47.96.40.237`, three cbe employees on DeepSeek `deepseek-chat` + Docker non-main sandbox, `maxConcurrent=8` fixed.

How to run (on the server, gateway running, loopback):

```bash
setsid bash /root/sentura/scripts/cbe-loadmon.sh >/dev/null 2>&1 &      # start sampler → /root/loadmon.log
cd /root/sentura/openclaw
OPENCLAW_DIR=/root/sentura/openclaw node /root/sentura/scripts/cbe-loadtest.mjs <concurrency> <total> <rungLabel>
```

| # | Check | Method | Expected |
|---|---|---|---|
| CE11.1 | Production path, not /run | Code review | Driver uses gateway WS `agent` (enqueue → runId) + `agent.wait` (block to completion) — the shared Main-lane path, NOT the Next.js `/run` diagnostic routes (off-path, unauthenticated, real-money). |
| CE11.2 | Gateway protocol | Code review | Driver uses the OpenClaw `connect.challenge` handshake + `gateway.auth.token` from `~/.openclaw/openclaw.json` (NOT JSON-RPC 2.0); `agent` params include required `message` + `idempotencyKey`. |
| CE11.3 | Real inference verified | Trajectory + monitor | Rung0 trajectory shows `prompt.submitted → model.completed → session.ended`; `model.completed` carries `provider: deepseek`, `modelId: deepseek-chat`, `usage {input:82, output:152, cacheRead:13568}`; the two idle cbe sandbox containers spin up during the run. |
| CE11.4 | Sweep 1 success rate | Driver summary | Across rungs C=1/4/8/12/30 (N=3/40/80/96/150 = 369 requests), `ok` = total, `errors` = {} — 100% success, 0 timeouts, 0 empty, 0 DeepSeek 429. |
| CE11.5 | Throughput plateau | Driver summary | Beyond `maxConcurrent=8`, throughput plateaus at ~74–76 tasks/min (C=8/12/30 → 76/73.9/74.5); raising offered concurrency only deepens the queue, never increases throughput. |
| CE11.6 | Graceful queueing | Driver summary | Mean latency grows monotonically with offered concurrency (C=1/8/12/30 → ~3.7/6.1/9.2/22.4 s) with zero drops/errors — FIFO queueing, not collapse. |
| CE11.7 | Bottleneck = gateway RSS | Monitor log | Host load stays ~1.0 on 4 cores; per-container mem stays ~432 KiB (inference is remote at DeepSeek); gateway RSS climbs 447 → 1610 MB and stays ~1630 MB after load stops (~3.1 MB/session sticky) — RSS, not CPU/containers/429, is the single-gateway ceiling. |
| CE11.8 | Container caps active under load | Monitor log | `docker stats` shows each cbe container against a 2 GiB limit throughout (P1-4 / CE10.4 confirmed live under load). |
| CE11.9 | Sweep 2 — maxConcurrent is past optimum at 8 | Driver summary | Raising `agents.defaults.maxConcurrent` (8→12→16, each with a gateway restart and offered C = maxConcurrent) monotonically REDUCES throughput (76→68.2→65.8 tasks/min) and raises mean latency (6.1→10.0→13.8 s), all at 100% success. `maxConcurrent=8` is optimal for this 4C16G + single DeepSeek key; higher is a net negative due to host-side `workspace-sandbox` prep contention (gateway log shows single-run `workspace-sandbox:5383ms`) plus DeepSeek single-key soft slowdown. No hard 429 even at 16 concurrent (key tolerance > 16), so the P0-2 fallback chain remains unvalidated under a real 429. |
| CE11.10 | Sweep 2 — gateway restart must fully warm (pitfall guard) | Code review / log | Changing `maxConcurrent` requires a gateway restart (Main lane sized at boot). The restart helper must wait for `agent runtime plugins pre-warmed` in `gateway.log` before driving load and must kill all prior gateway instances — otherwise a `--force` start SIGTERMs the instance mid-test (`[gateway] signal SIGTERM received`), producing a false "0/N total collapse" that looks like a capacity cliff but is a test-harness race. `gw-restart2.sh` (full-warm wait + thorough kill) fixes it; the same scenario re-run cleanly returned 96/96. Lesson: a "total failure" rung is a harness/process-race suspect first, a capacity conclusion last. |

| CE11.11 | Sweep 3 — real tool-calling is ~5–8× heavier than pure inference | Driver summary | `scripts/cbe-loadtest-tools.mjs` (`CBE_MODE` switch) drives two tool-heavy employees: `cbe-buyer-screening` (RDAP+DNS+SEC) and `cbe-lead-discovery` (Tavily `web_search`). Real task ≈ 20–25 s solo / 26–42 s at 8-concurrent (vs 4–6 s pure inference). Throughput @ `maxConcurrent=8` ≈ 10/min (screening) and 15/min (lead-discovery) ≈ 600–900/hour (vs 76/min pure inference — ~1/5–1/8). Both employees C=8 and C=30 = 100% success, 0 errors/timeouts/429; C=30 tail latency 187 s (screening) / 153 s (lead-discovery). Pure-inference numbers overstate real-world capacity ~5–8×. |
| CE11.12 | Sweep 3 — tools actually fired (real foreign data) | Trajectory | Screening answer contains real RDAP data (apple.com registered 1987-02-19), input tokens jump 82 → ~3900; lead-discovery answer returns real UK firms (Carphone Warehouse, MobileBitz ~70 stores) with input tokens ~11000 (search results fed back) — confirms real multi-turn tool-calling, not hallucination. host load < 0.7 and container CPU ~0 throughout (work is remote DeepSeek + cross-border network wait). |
| CE11.13 | Sweep 3 — mainland foreign-API latency spread | Direct curl + trajectory | Direct curl from the mainland ECS (2026-06-15): all listed foreign APIs except OpenAI/Claude are reachable — DeepSeek 0.12s (domestic), Tavily 0.66s, RDAP 0.74s, Companies House 1.66s, **SEC data.sec.gov 2.96s (slowest)**; OpenAI timed out (confirmed blocked), Anthropic 403 (vendor geo-block, not GFW). So **SEC is reachable-but-slow, not blocked** (corrects an earlier "SEC fails" wording): its multi-step lookup (≈1MB company_tickers.json + submissions) times out under concurrent load, so the agent retries then falls back to RDAP/DNS — a latency/timeout issue, not a network block. The ~25× cross-border latency spread (DeepSeek 0.12s vs SEC 2.96s) is the real data point for the server-location decision (reachable ≠ performant from mainland to US APIs). Note: server `.env` had only `DEEPSEEK_API_KEY`; a free `SEC_USER_AGENT` + a user-provided Tavily key were added for this sweep; Companies House/Hunter keys still absent. This direct probe also independently validates the reachability matrix in `server-location-llm-decision-report.md`. |

Pass criteria for any rung: 100% success, no `agent_timeout`, no sustained 429 (a 429 must show provider fallback, never a 30-min Main-lane suspension), gwRSS not approaching host limit, no container OOM-kill. **A rung showing 0/N total failure is a restart-race / SSH-drop artifact until `gateway.log` is checked for `SIGTERM` — never a capacity conclusion on its own.**

## CE12 — Dashboard Object-Model Render + Connect Diagnosis + Server Cleanup (2026-06-16)

Deliverables from the dashboard-connect debugging session. The dashboard renders `agent.model`, which for the three cbe agents is the routing object `{primary, fallbacks}` (CE10.2 / P0-2), not a string. Verify the render-side handling, the connect-path facts, and the cleanup.

Verify (headless browser, model render) — load the dashboard with Playwright (or a real browser via the `:13000` tunnel) and check the console:

```
# tunnel up: ssh -f -N -L 13000:127.0.0.1:3000 -L 28789:127.0.0.1:18789 root@47.96.40.237
# navigate http://localhost:13000/employees ; wait for "deepseek"; console errors must be 0
```

| # | Check | Method | Expected |
|---|---|---|---|
| CE12.1 | `model` typed as union | Code review | `src/lib/gateway/types.ts` declares `export type AgentModel = string \| { primary: string; fallbacks?: string[] }` and `AgentConfig.model: AgentModel` (was `string`). |
| CE12.2 | `modelPrimary()` helper exists + exported | Code review | `types.ts` exports `function modelPrimary(model: AgentModel): string` (object → `.primary`, string → itself); `src/lib/gateway/index.ts` re-exports `modelPrimary` (value) and `AgentModel` (type). |
| CE12.3 | All 5 render/filter sites use the helper | Code review | `grep -rn "agent\.model" sentura/dashboard/src` shows **no bare** `agent.model` render — all wrapped in `modelPrimary(agent.model)`: `page.tsx:238`, `chat/employee-picker-dialog.tsx:97`, `employees/page.tsx:89` (filter `.toLowerCase()`) + `:235`, `employees/[id]/page.tsx:460`. |
| CE12.4 | No crash on object model (runtime) | Playwright | Load `/employees` (renders the 3 object-model cbe agents); `browser_console_messages level=error all=true` returns **0 errors, 0 warnings**; model cell shows `deepseek/deepseek-chat`. Pre-fix this threw `Objects are not valid as a React child (found: object with keys {primary, fallbacks})`. |
| CE12.5 | Hydration warning suppressed | Code review | `src/app/layout.tsx` `<html>` has `suppressHydrationWarning` (for browser-extension-injected `data-immersive-translate-page-theme`). |
| CE12.6 | No other object-render latent crashes | Audit | Sub-agent audit of all 13 pages + components + `lib/gateway`: every other config object field (`runtime?.type`, `sandbox?.mode`, `tools.*`, `memorySearch?.enabled`, binding `match.*`) extracts a primitive sub-field or `JSON.stringify`s; the model bug was the only one. |
| CE12.7 | Connect is NOT a version problem | Log + probe | Local & server openclaw both `2026.6.2`; `grep -a "protocol mismatch" /root/gateway.log` = 0. `scripts/gw-protocol-probe.mjs` (client.id=`openclaw-control-ui`, protocol 4, token, `Origin: http://localhost:13000`) returns `CONNECT_OK protocol=4` + `RPC_OK config.get`. Real cause was: dashboard process down + `NEXT_PUBLIC_GATEWAY_URL` set to `:18789` instead of tunnel `:28789` + tunnel down. |
| CE12.8 | Browser gateway URL = tunnel port | Code review / build | `.env.local` `NEXT_PUBLIC_GATEWAY_URL=ws://localhost:28789` (set by `dash-dev2.sh`); compiled `.next` chunk `sentura_dashboard_src_*.js` contains `localhost:28789`. Browser-evaluated `NEXT_PUBLIC_*` must point at the Mac-side tunnel port, not the server-side `:18789`. |
| CE12.9 | `next.config.ts` pins turbopack root | Code review / log | `next.config.ts` sets `turbopack.root` to the monorepo root (`resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")`); after a clean restart `dashboard.log` shows `✓ Ready` with **no** "Detected additional lockfiles / inferred workspace root" warning. |
| CE12.10 | Broken dida MCP removed (server runtime) | Server config | `/root/.openclaw/openclaw.json` `mcp.servers` no longer contains `dida-travel-demo` (only `cross-border-intel`); fresh gateway startup has 0 `[bundle-mcp] failed to start ... dida-travel-demo` errors. Source `sentura/mcp-servers/dida-travel-demo/` retained. NOTE: this is a server-runtime cleanup of an unbuilt server-side config, not a source change; rebuilding + re-adding restores the 座联 demo tools. |

## CE13 — All-Tools (8/8) Key Configuration + Verification (2026-06-17)

The 4 paid-source keys were registered and configured on the server, each curl-verified at the API level and wired into the `cross-border-intel` MCP via `${ENV_VAR}` references. Full plan: [`跨境电商/research/full-tool-test-plan.md`](../../跨境电商/research/full-tool-test-plan.md).

| # | Check | Method | Expected |
|---|---|---|---|
| CE13.1 | Companies House Live key | curl (key not printed) | `GET api.company-information.service.gov.uk/company/00445790` with Basic auth (`-u "$KEY:"`) → **200** TESCO PLC. A Test/Sandbox key returns 401 on live (sandbox 200 / live 401 distinguishes env). |
| CE13.2 | Abstract Email Reputation key | curl | `emailreputation.abstractapi.com/v1/?api_key=$KEY&email=...` → **200** with `email_deliverability`/`email_quality`. Must be the **Email Reputation** product key (not Email Validation — separate keys per product). |
| CE13.3 | Hunter key (free plan has API) | curl | `api.hunter.io/v2/account?api_key=$KEY` → 200 `plan=Free`, 100 verifications + 50 searches/month; `/v2/email-verifier?email=...` → 200 result/status/score. |
| CE13.4 | ImportYeti key ($9/100 tier) | curl | `data.importyeti.com/v1.0/company/search?name=Apple` with header `IYApiKey: $KEY` → **200** `requestCost`/`creditsRemaining`/`data` (real shipment records). |
| CE13.5 | Keys wired into MCP (not just .env) | Config | `openclaw.json` → `mcp.servers.cross-border-intel.env` contains `${COMPANIES_HOUSE_API_KEY}`, `${ABSTRACT_API_KEY}`, `${HUNTER_API_KEY}`, `${IMPORTYETI_API_KEY}` references (real values stay in `/root/.openclaw/.env`; OpenClaw resolves `${}` at runtime per CE8.11). |
| CE13.6 | Paid-trade gate enabled | Config | MCP env `CBE_ENABLE_PAID_TRADE_DATA=true` + `CBE_MAX_PAID_SPEND_USD=1` (was false/0); `tools.ts:701-705` only calls ImportYeti when `enablePaidTradeData && key && budget>0`. |
| CE13.7 | Quota map documented | Plan | 🟢 unlimited RDAP/DNS/SEC; 🟡 CH 600/5min, Tavily ~1000/mo; 🔴 limited Abstract 100/mo, Hunter 100/mo, ImportYeti ~99. Stress test must keep the 🔴 sources out of high concurrency. |
| CE13.8 | Functional + stress test plan | Plan (pending exec) | Phase 1 functional (`scripts/cbe-functional-test.mjs` TBD — Tesco UK + Apple US screenings confirm employee invokes all 8 tools end-to-end) + Phase 2 stress (Track A free-source high-concurrency throughput; Track B all-tools small-batch N=10~20 low-concurrency with budget cutoff ≤30 calls/source). Execution pending. |
