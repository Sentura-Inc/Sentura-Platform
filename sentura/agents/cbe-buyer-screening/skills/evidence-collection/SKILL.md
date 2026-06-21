# Evidence Collection

## When to Use

Use first for every Screening request.

## Procedure

1. Identify intake mode:
   - `marketing_lead_batch` for `LeadCandidate[]`.
   - `manual_input` for operator-entered company, country, website/domain, email, contact person/title, profile URL, product interest, and notes.
   - In Phase 2 production, this agent should normally receive one target per session. If the prompt contains 5 or more targets, stop and ask the Dashboard/store to split it into single-target child runs.
   - Process 2-3 targets in one session only when the run is explicitly labeled `batch3_experiment`.
2. Normalize every item into `InvestigationTarget`:
   - `target_id`
   - `source`
   - `lead_id`
   - `company_name`
   - `country`
   - `website`
   - `domain`
   - `email`
   - `contact_person`
   - `contact_title`
   - `social_or_profile_url`
   - `google_place_id`
   - `google_maps_uri`
   - `formatted_address`
   - `product_interest`
   - `operator_notes`
   - `supplied_fields`
   - `inferred_fields`
   - `missing_fields`
3. Preserve Marketing provenance: `source_run_id`, source URLs, query strings, matched products, contact candidates, and discovery confidence.
4. Build an evidence plan in this order:
   - registry/legal identity,
   - domain/email credibility,
   - Google Maps address footprint and local presence,
   - public digital footprint,
   - trade/customs evidence,
   - financial/public filing evidence,
   - conversation behavior only if Accio or sales history exists.
5. Google Maps route:
   - Always attempt a dedicated `Google Maps 地址版图` pass for the target when Google Maps is configured.
   - Build up to 6 bounded Text Search query variants from company/legal/brand name, supplied country, city/region, website domain, phone when available, and official-site location/store/address pages discovered through `web_search` / `web_fetch`.
   - Call `cross-border-intel__cbe_intel_google_places_search` for those query variants. If a Marketing lead already has `google_place_id`, still run address-footprint discovery; the existing place id is only one seed.
   - Deduplicate candidate Places by `google_place_id`, normalized `formatted_address`, phone, website domain, and display name.
   - Call `cross-border-intel__cbe_intel_google_place_details` for shortlisted unique places under the address-footprint cap with `field_mask_profile="screening_address_footprint"` and `purpose="screening"`. Do not request review text, photos, or raw Google responses.
   - If a public formatted address is complete enough, call `cross-border-intel__cbe_intel_google_address_validate` under the validation cap. Use `cross-border-intel__cbe_intel_google_geocode` only for coordinate support, not as a trust signal.
   - Classify every place as `confirmed_company_location`, `probable_company_location`, `possible_related_location`, or `rejected_unrelated_location`.
   - Classify address role as `headquarters_or_office`, `storefront`, `warehouse_or_distribution`, `service_or_repair_location`, or `unknown_business_location`.
   - Treat no result, missing key, provider error, or rate limit as a coverage gap. Missing Maps evidence is neutral. Return an `address_footprint` object even for `not_found` or `unavailable_api`.
6. Mark missing clues as `pending_human_input`; do not score them as negative.

## Safety

Never invent missing fields. If the operator supplies only an email or domain, report exactly that and ask for company/legal name when needed.
