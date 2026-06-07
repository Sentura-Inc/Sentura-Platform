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
| CE1.9 | Employee-specific UIs | Manual review | Design defines three distinct demo routes for lead discovery, screening, and Accio memory, each with workflow-specific controls, evidence panels, and real AgentChat sessions. |
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

## CE3 — `cross-border-intel` MCP Server (Planned)

Status: PEND

Planned scope: `sentura/mcp-servers/cross-border-intel/`

Future checks:

| # | Check | Expected |
|---|---|---|
| CE3.1 | Package/build contract | `package.json`, `tsconfig.json`, and `openclaw.plugin.json` or MCP README follow existing Sentura MCP patterns; `pnpm --filter @sentura/mcp-cross-border-intel build` passes. |
| CE3.2 | Tool catalog | Server exposes the designed read-mostly tools: search leads, fetch evidence, registry search, domain/RDAP, email validation, trade records, financial lookup, score lead, and Accio parser. |
| CE3.3 | Env parsing | Missing optional paid API keys disables only the paid adapter, not the whole server. |
| CE3.4 | Search wrapper | Uses documented provider request shapes and caps result counts/budget per run. |
| CE3.5 | Registry adapters | Companies House and SEC paths match official docs; OpenCorporates is feature-flagged. |
| CE3.6 | Domain/email adapters | RDAP/DNS never require secrets; Abstract/Hunter/ZeroBounce paid calls are optional and redacted in logs. |
| CE3.7 | Trade-data adapters | Volza and ImportYeti calls are budget-gated and clearly marked by source type/confidence. |
| CE3.8 | Contextual scoring engine | Score output is deterministic for the same evidence set, excludes `not_applicable` blocks, reports evidence coverage, and implements forced downgrades. |
| CE3.9 | Audit/safety | Tool outputs include source URLs/timestamps and never expose secret values. |
| CE3.10 | MCP smoke | `InMemoryTransport` client can list and call tools with fixture responses. |
| CE3.11 | Failure behavior | API errors return structured partial evidence, not uncaught exceptions. |
| CE3.12 | Cost controls | Per-run max search calls, paid calls, and paid spend estimates are enforced. |

## CE4 — Marketing Acquisition Employee Workspace (Planned)

Status: PEND

Planned scope: `sentura/agents/cbe-lead-discovery/`

Future checks:

| # | Check | Expected |
|---|---|---|
| CE4.1 | Workspace convention | Exactly 8 native OpenClaw workspace files plus skills/config; no extra top-level markdown workspace files. |
| CE4.2 | Tool policy | Allows `web_search`, `web_fetch`, and `cross-border-intel__*` only as needed, including sandbox allowlists. |
| CE4.3 | Skills | Has a lead-generation skill with keyword expansion, market selection, source capture, dedupe, ranking, and handoff. |
| CE4.4 | Output schema | Produces lead records with company, geography, product fit, source URLs, confidence, and next research action. |
| CE4.5 | No outreach | Does not send emails/messages automatically in Phase 1. |
| CE4.6 | UI handoff contract | Lead output can be rendered in `/client-demos/cross-border/lead-discovery` and selected rows can be handed to Screening as typed targets. |

## CE5 — Screening And Background Employee Workspace (Planned)

Status: PEND

Planned scope: `sentura/agents/cbe-buyer-screening/`

Future checks:

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

## CE6 — Accio Memory Processing Employee Workspace (Planned)

Status: PEND

Planned scope: `sentura/agents/cbe-accio-memory/`

Future checks:

| # | Check | Expected |
|---|---|---|
| CE6.1 | Workspace convention | Exactly 8 native OpenClaw workspace files plus skills/config; no extra top-level markdown workspace files. |
| CE6.2 | Fixture intake | Parses `跨境电商/fixtures/accio-chat-records.sample.json` without schema errors. |
| CE6.3 | Summary extraction | Summary includes company info, buyer role, goods requested, quantities, negotiated prices, terms, risks, and follow-up tasks. |
| CE6.4 | Memory policy | Writes only structured customer summaries and source references; raw chat retention follows T2/T3 policy. |
| CE6.5 | Handoff | Can feed buyer context back to Screening without losing source provenance. |
| CE6.6 | UI preview contract | Summary output can be rendered in `/client-demos/cross-border/accio-memory` with transcript, extracted facts, memory-write preview, and Screening handoff. |

## CE7 — Cross-Border Employee Demo UIs (Planned)

Status: PEND

Planned scope:

- `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`

Future checks:

| # | Check | Expected |
|---|---|---|
| CE7.1 | Lead-discovery route exists | `/client-demos/cross-border/lead-discovery` builds and opens. |
| CE7.2 | Lead run builder | Page has product keyword chips, buyer persona controls, country/language controls, target count, exclusions, and a clear run action. |
| CE7.3 | Lead table | Page renders lead rows with company, country, buyer type, matched product, domain/contact candidate, source count, confidence, and duplicate status. |
| CE7.4 | Lead evidence panel | Selecting a lead shows query strings, source URLs, snippets, dedupe explanation, and source timestamps. |
| CE7.5 | Lead AgentChat | Page connects to a real `cbe-lead-discovery` AgentChat session, not static fake conversation content. |
| CE7.6 | Screening route exists | `/client-demos/cross-border/screening` builds and opens. |
| CE7.7 | Screening intake tabs | Page supports both Marketing lead batch intake and manual investigation input. |
| CE7.8 | Manual screening form | Manual form includes company name, country, website/domain, email, contact person/title, social/profile URL, product interest, and notes. |
| CE7.9 | Screening evidence timeline | Page groups evidence by legal registry, domain/email, public footprint, trade/customs, financial/public filing, and behavior. |
| CE7.10 | Contextual score UI | Page displays normalized score and evidence coverage separately, shows `not_applicable` behavior for cold leads, and marks disabled/unavailable API evidence as coverage gap. |
| CE7.11 | Screening AgentChat | Page connects to a real `cbe-buyer-screening` AgentChat session. |
| CE7.12 | Accio route exists | `/client-demos/cross-border/accio-memory` builds and opens. |
| CE7.13 | Accio upload/sample load | Page supports JSON upload or loading `跨境电商/fixtures/accio-chat-records.sample.json`. |
| CE7.14 | Accio extraction preview | Page shows transcript, extracted products/quantities/prices/terms, company summary, next actions, and behavior signals. |
| CE7.15 | No unsafe automation | No page sends outreach, writes raw chat to long-term memory, or hides demo/live source provenance. |
