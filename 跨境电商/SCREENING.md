# Cross-Border E-Commerce — Screening And Background Employee

> **On-demand reference — not read by default.**
>
> Back-link: [`DESIGN.md`](DESIGN.md)
>
> Agent id: `cbe-buyer-screening`
>
> Chinese name: 跨境筛选背调员工
>
> Last updated: 2026-06-13

This document owns all design, implementation details, current status, and forward plan for the Screening and Background Investigation employee in the mobile-accessory cross-border e-commerce customer lane. Shared platform architecture, database-wide schema, cloud deployment, and cross-agent flow live in [`DESIGN.md`](DESIGN.md). Marketing Acquisition details live in [`MARKET_ACQUISITION.md`](MARKET_ACQUISITION.md). Accio memory details live in [`MEMORY_PROCESSING.md`](MEMORY_PROCESSING.md).

## 1. Role And Current Status

The Screening employee investigates candidate buyers and returns authenticity/risk reports with evidence chains. It supports two intake modes:

1. Batch mode from Marketing Acquisition: accepts `LeadCandidate[]` and preserves `source_run_id`, source URLs, matched products, contact candidates, and dedupe fields.
2. Manual investigation mode: accepts company/email/domain/contact/person/product-interest inputs from Accio, email, trade fair, or offline sales context.

Phase-1 requirement: low-cost evidence route first; public web, registry, domain/email, trade, and financial evidence only where accessible and documented.

Implementation status as of 2026-06-08:

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

Live provider status from the 2026-06-08 audit:

- Tavily: successful live response after adapter correction.
- SEC: successful no-key live response, including company-name/CIK route.
- Abstract Email Reputation: successful live response after endpoint correction.
- ImportYeti: successful live response after current request format correction.
- Companies House: `401 Invalid Authorization` despite official Basic-auth formatting; handled as `unavailable_api` coverage gap with official public-page fallback.
- Hunter: `429 restricted_account`; handled as provider-side coverage gap.

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

1. Registry and legal existence.
2. Website/domain/email credibility.
3. Public digital footprint.
4. Trade behavior / customs evidence.
5. Financial/public filing evidence where applicable.
6. Conversation behavior signals only if Accio history or sales interaction exists.

Evidence source tags:

- `official_api`
- `official_registry_page`
- `public_web`
- `public_dns`
- `paid_trade_data`
- `demo_fixture`
- `self_reported`
- `unverified`

## 5. Registry Checks

| Country / source | Route | Cost posture | Decision |
|---|---|---|---|
| UK Companies House | REST API `GET https://api.company-information.service.gov.uk/search/companies?q=...`, then `GET /company/{companyNumber}`. Auth is HTTP Basic with API key as username and blank password: `Authorization: Basic base64(API_KEY + ":")` / `curl -u API_KEY:`. No-key fallback: official public HTML search at `https://find-and-update.company-information.service.gov.uk/search/companies?q=...`. | No public fee found; REST requires API key; public HTML is free but not JSON API. | Use API first for GB. If missing/401/403, fall back to official public page and mark `official_registry_page`. |
| US SEC EDGAR | Resolve company name/ticker through `https://www.sec.gov/files/company_tickers.json`, then `GET https://data.sec.gov/submissions/CIK##########.json`; use descriptive `User-Agent` and respect 10 requests/sec fair access. | Free; no auth/API key. | Automatically call for US candidates copied into Screening. Useful for public companies/SEC filers, not small private importers. |
| OpenCorporates | `GET https://api.opencorporates.com/v0.4/companies/search?q=...`. | Paid commercial plans: Essentials £225/month for 500 calls/month; Starter £660/month for 2,500 calls/month; Basic £1,200/month for 5,000 calls/month. | Not default MVP; add paid adapter behind feature flag only if client buys a plan. |
| Other countries | Web-search official registry page + manual link capture. | Search API cost only. | Brazil, Mexico, Germany, France, Spain, Italy adapters can be added incrementally. |

Ordering corrections already implemented:

- GB targets must call Companies House before web fallback.
- US targets must resolve company name/CIK through SEC before state-registry web fallback.
- Non-2xx provider responses are coverage gaps, not fraud evidence.

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

Optional paid checks:

| Provider | API route / behavior | Public price verified | Decision |
|---|---|---|---|
| Abstract Email Reputation | `GET https://emailreputation.abstractapi.com/v1/?api_key=...&email=...`; response includes `email_deliverability`, `email_quality`, `email_domain`, risk, and breach signals. | Free 100 requests/month. Starter $17/month paid annually for 60,000 requests/year. Standard $37/month paid annually. Professional $39/month paid annually. | Best low-cost optional add-on after free DNS checks. |
| Hunter | Email Verifier API; verifier costs 0.5 credit/call, Domain Search costs 1 credit for 1-10 emails, Email Count is free. | Free 50 credits; Starter $49/month or $34/month yearly; Growth $149/month or $104/month yearly; Scale $299/month or $209/month yearly. | Useful if customer wants email discovery, not only validation. |
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

## 8. Customs And Trade-Record Checks

| Source | API / route | Public price verified | Decision |
|---|---|---|---|
| ImportYeti | `GET https://data.importyeti.com/v1.0/company/search?name=...&page_size=...` with `IYApiKey`; other company/BOL routes need API key. | Public API price not confirmed from captured docs; public site emphasizes free search. | Use public web evidence or API only if key/pricing confirmed and budget enabled. Evidence is US-import focused. |
| Volza | Global Trade API, Buyer Insights API, Supplier Insights API, Decision Maker Contact API. | Global search $0.10/search; data from $0.02/record; Buyer/Supplier Insights $5/report; decision-maker contact $1.50/record. | Best paid Phase-1 add-on with capped budget. |
| Panjiva | REST API with Bearer Token; shipment, company, contact data. | Public pricing not exposed; enterprise sales. | Post-MVP only. |
| ImportGenius | Global trade data platform; account/sales-oriented API and pricing. | Public API price not reliably captured. | Post-MVP or manual human research source. |

Trade-data rule:

- Missing customs/trade data does not mean the company is fake.
- Missing trade data lowers evidence coverage and therefore affects the final score through the 20% coverage component, but it must not be treated as fraud evidence.

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
| `legal_identity` | 25 | company name or registry number exists | Companies House/SEC where applicable, official registry web result, public official page |
| `domain_email` | 25 | domain, website, or email exists/can be discovered | DNS MX/SPF/DMARC, RDAP, email syntax/free-provider/disposable checks, optional Abstract/Hunter |
| `public_footprint` | 20 | website, social/profile URL, or public search result exists | `web_search`, `web_fetch`, public LinkedIn/company pages, Facebook/Instagram/YouTube public snippets |
| `business_fit` | 20 | product interest or discovered category evidence exists | website categories, search snippets, Accio product requests, lead matched products |
| `trade_financial` | 10 | country/source supports affordable check or paid data enabled | ImportYeti/Volza/SEC/annual report/registry filings |
| `conversation_behavior` | 15 | Accio chat or sales interaction exists | Accio Memory summary, CRM/chat transcript, manual sales notes |

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

Still to implement:

- Production persistence for `screening_*` tables.
- `cross-border-store` typed write tool or equivalent Sentura plugin.
- Alibaba `icbu-openapi` access validation, then read-only MCP tools.
- Screening UI source toggle `阿里国际站内部数据`.
- Evidence cards for Alibaba customer record/order history/customer notes.
- Additional country-specific registry adapters beyond GB/US.
- Production budget approval UX for paid checks.
- Automated tests for Alibaba evidence block behavior after access is proven.

## 16. Source And Test Traceability

Relevant test rows:

- CE3 — `cross-border-intel` MCP server.
- CE5 — Screening employee workspace + employee-executed UI/API.
- CE7 — Cross-border employee demo UIs.
- CE10 — Production cloud/database/multi-agent operating plan.
- CE11 — Alibaba International Station API access and Screening optimization plan.

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
