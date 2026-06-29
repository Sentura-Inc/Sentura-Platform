# Buyer Scoring

## When to Use

Use after evidence collection or when recalculating a report after the operator enables/disables sources.

## Procedure

1. Build contextual evidence blocks:
   - `legal_identity` max 20, displayed as `公司注册与线下门店/地址`
   - `domain_email` max 20
   - `public_footprint` max 15
   - `business_fit` max 20
   - `trade_financial` max 10
   - `legal_disputes` max 15
2. Set block status:
   - `scored` only when evidence was actually checked.
   - `not_applicable` when the block does not apply.
   - `unavailable_api`, `disabled_by_budget`, or `pending_human_input` for relevant but missing checks.
   - Before scoring, set `company_scale_assessment`:
     - `scale_class`: `listed_or_public`, `medium_large_registered`, `small_local_offline`, `small_online_only`, or `unknown_scale`.
     - `first_block_strategy`: `registry_disclosure_primary_maps_support`, `maps_physical_address_primary`, `domain_public_source_primary`, or `try_registry_and_maps`.
     - Include `confidence` and `rationale`.
   - For `listed_or_public` and `medium_large_registered`, score `legal_identity` from registry/disclosure/official-page evidence first, then add Google Maps address/website/phone consistency as support. Do not give full first-block credit from Maps alone.
   - For `small_local_offline`, Google Maps address-footprint, local-presence Place Details, Geocoding, and Address Validation can satisfy `legal_identity` when at least one confirmed/probable location is `OPERATIONAL`, has a physical address, matches name/category/city/country, and has no contradictory website/registry/public evidence.
   - For `small_online_only`, do not require Maps; use stable domain/public-source consistency and mark registry gaps as coverage gaps or pending human input.
   - Outside the small-local/offline first-block rule, Google Maps can contribute to `public_footprint`, `domain_email` website/address consistency, or `business_fit` category/location context. Do not use Maps rating count, address count, or business status as formal KYB, ownership, trade, financial, or fraud proof.
   - `businessStatus=CLOSED_PERMANENTLY` is a public-footprint caution or forced-downgrade candidate for active outreach unless web evidence shows relocation or rebrand. No Maps result is coverage-only.
   - Official registry sources are primary evidence. A matching Companies House, SEC, state registry, or equivalent official profile should normally score the relevant registry/legal block with confidence 0.95-1.0. Do not reduce confidence just because the company is small, privately held, or lacks trade/financial filings.
   - For small private/local/offline companies, missing customs/trade records, SEC filings, or financial statements should be `not_applicable` when the buyer does not claim importer/distributor/public-company scale. Treat it as an optional limitation only when useful for sales prioritization.
   - Score `legal_disputes` from public legal-risk evidence: court dockets/judgments, official case-law, insolvency/bankruptcy notices, regulatory enforcement, and public legal databases. No-hit results from searched official/public sources can earn positive coverage points, but must be described as "not found in checked public sources", not proof of no legal issues.
   - Confirmed recent/material lawsuits, insolvency, bankruptcy, regulatory enforcement, fraud judgments, unpaid debt enforcement, counterfeit/IP disputes, sanctions/compliance actions, or repeated corroborated litigation should reduce `legal_disputes` and may trigger a forced downgrade. Name collisions or generic snippets must be neutral or pending human review.
3. Call `cross-border-intel__cbe_intel_score_buyer` with `company_scale_assessment`, blocks, and forced downgrade flags.
4. Explain:
   - `normalized_score`
   - `evidence_coverage`
   - `risk_tier`
   - `company_scale_assessment`
   - which blocks are excluded from denominator
   - which blocks reduce coverage only
   - which, if any, unresolved gaps are actually actionable for a human employee.
   These explanations must be natural Simplified Chinese for non-technical users. Do not put raw enum names, tool/source field names, or technical checks such as RDAP, MX, SPF, DMARC, API, endpoint, provider, or payload into score summaries; translate them into normal business language such as "域名登记记录", "邮箱能收信", and "邮件防冒用记录".
5. Apply forced downgrades after normalized score:
   - no registry/stable official source plus very young domain,
   - disposable/free email only and no verified business domain,
   - registry/legal-name contradiction,
   - confirmed material lawsuit, insolvency, bankruptcy, regulatory enforcement, fraud judgment, unpaid-debt enforcement, IP/counterfeit case, sanctions/compliance action, or equivalent seller-risk legal dispute,
   - material customs/product/country contradiction,
   - credible repeated fraud/scam evidence,
6. Before handing the result to report writing, reconcile block status with gaps:
   - A `scored` block cannot also be a missing-evidence gap unless the reason names a concrete contradiction or risk.
   - A `not_applicable` block must be excluded from `missing_or_unavailable_evidence` / `coverage_gaps`.
   - Missing source classes should lower `evidence_coverage` only when they were relevant and available for this target profile.
   - If the evidence is enough for a practical sales decision but not enough for formal KYB, say that explicitly instead of creating vague follow-up questions.

## Safety

Do not use a fixed 100-point denominator. The denominator must adapt to applicable and actually checked evidence.
