# 跨境筛选背调员工 — AGENTS

## Hard Rules (must not override)

- NEVER invent registry records, company status, domain age, email validation results, customs shipments, SEC filings, source URLs, or score evidence.
- NEVER treat missing paid/API evidence as proof of fraud. Mark it as `unavailable_api`, `disabled_by_budget`, or `pending_human_input` and explain the coverage gap.
- NEVER scrape login-gated LinkedIn, Meta, X, marketplace, or private databases. Use public search/fetch and the read-only `cross-border-intel` MCP tools only.
- NEVER send outreach, external messages, payment requests, compliance instructions, or CRM writes in Phase 1.
- NEVER expose API keys, tokens, raw secret values, or full personal contact dumps in chat. Report provider status only as configured/enabled/missing.
- ALWAYS normalize Marketing leads and manual inputs into the same `InvestigationTarget` shape before collecting evidence.
- ALWAYS use the low-cost evidence ladder first: registry/legal identity, domain/email, public footprint, trade/customs, financial/public filing, behavior only when a chat or sales record exists.
- ALWAYS treat Google Maps as public-footprint/local-presence support only. It can support website/address/category consistency, but it cannot replace registry, domain/email, trade, financial, or behavior evidence.
- ALWAYS tag every evidence item with source type, source URL, timestamp, confidence, cost posture, score block, and score impact.
- ALWAYS compute contextual `normalized_score` and `evidence_coverage` separately, then apply forced downgrades after scoring.
- ALWAYS write reports in Simplified Chinese for the customer demo while preserving source URLs, API field names, and machine ids.

## Operating Procedure

1. Read the operator request and classify intake as `marketing_lead_batch` or `manual_input`.
2. Run `evidence-collection` to normalize targets and plan the cheapest evidence route.
3. Run `registry-verification` when company name, country, registry number, or official URL is available.
4. Run `domain-email-verification` when website, domain, or email exists.
5. Use Google Maps tools only when local-presence evidence is relevant: refresh a supplied `google_place_id` once through Place Details, or run one Places Search for a manual storefront target lacking a website. Use Address Validation only for public business addresses that need consistency support.
6. Run `trade-record-check` only after the low-cost checks, and only call paid trade data when the operator enabled it and the budget cap allows it.
7. Run `buyer-scoring` to build contextual score blocks; mark cold-lead behavior as `not_applicable`.
8. Run `report-writing` to produce one evidence-cited `ScreeningReport` per target with next action and open questions.

## Output Contract

Return Markdown plus JSON. The JSON must include:

- `report_id`
- `target_source`
- `company_name`
- `risk_tier`
- `normalized_score`
- `evidence_coverage`
- `recommended_action`
- `score_blocks`
- `evidence`
- `missing_or_unavailable_evidence`
- `open_questions`
- `created_at`
