# Report Writing

## When to Use

Use at the end of every Screening run.

## Procedure

1. Produce a short Chinese executive summary:
   - risk tier,
   - normalized score,
   - evidence coverage,
   - recommended sales next action.
2. Produce one JSON `ScreeningReport` per target:
   - `report_id`
   - `lead_id`
   - `target_source`
   - `company_name`
   - `risk_tier`
   - `normalized_score`
   - `evidence_coverage`
   - `recommended_action`
   - `score_blocks`
   - `evidence`
   - `address_footprint`
   - `open_questions`
   - `missing_or_unavailable_evidence`
   - `created_at`
   In Phase 2 production child runs, this normally means exactly one object in the marker array.
3. Evidence items must include:
   - `layer`
   - `source_type`
   - `source`
   - `url`
   - `finding`
   - `confidence`
   - `fetched_at`
   - `cost_usd`
   - `score_block`
   - `score_impact`
4. For Google Maps evidence:
   - use layer `google_maps_local_presence` or `address_validation`;
   - use source types `google_maps_places`, `google_maps_geocoding`, or `google_maps_address_validation`;
   - include `google_place_id`, `google_maps_uri`, endpoint, field mask profile, and provider status when available;
   - do not include raw review text, photos, raw Google responses, or API keys.
5. Add a dedicated `address_footprint` object for the `Google Maps 地址版图` report section:
   - `section_title`: always `Google Maps 地址版图`.
   - `coverage_status`: `found`, `partial`, `not_found`, `unavailable_api`, or `not_checked`.
   - `search_scope`: include `queries_run`, `countries`, `capped`, and `limitations`.
   - `summary`: include total, confirmed/probable/possible, operational/closed, country, and city counts.
   - `locations`: one row per discovered Google Maps place kept after dedupe. Each row includes `google_place_id`, `display_name`, `address_type`, `relationship_status`, `formatted_address`, `city`, `region`, `country`, `business_status`, `types`, `website_uri`, `domain_match`, `phone_match`, `address_validation`, `google_maps_uri`, `match_confidence`, `match_reasons`, `source_type`, and `fetched_at`.
   - `open_questions`: include coverage limitations such as capped search, ambiguous franchise/brand matches, missing store locator, or API unavailability.
   - Do not merge this object into generic evidence cards; the Dashboard renders it as a standalone section before evidence details.
6. Address-footprint evidence may support `public_footprint`, `domain_email`, and `business_fit`, but it must not score `legal_identity` by itself and must not replace registry/KYB/trade/financial/Accio evidence.
7. If coverage is low, say "证据不足，建议补充..." rather than "客户很差".
8. Mask personal emails in customer-facing summaries unless the operator explicitly requests the internal full report.

## Safety

Reports may be exported as JSON/Markdown. They must not send outreach or write external systems.
