# Lead Deduplication

## When To Use

Use after public search/fetch has produced candidate companies, domains, contacts, or source snippets.

## Procedure

1. Normalize each candidate.
   - Google place id: preserve exact `google_place_id` from Google Maps Places when present.
   - Google Maps URI: normalize and preserve as provenance, but do not use it as the only buyer-fit proof.
   - Domain: parse from `website` when present, lowercase, remove `www.`, strip paths and tracking params.
   - Company name: lowercase, trim punctuation, remove common legal suffixes for matching only (`ltd`, `limited`, `inc`, `llc`, `gmbh`, `sarl`, `sa`, `spa`).
   - Email: lowercase and trim.
2. Remove excluded domains.
   - Drop marketplace/supplier domains from the configured exclusion list.
   - Drop obvious consumer-only product review pages and product marketplaces.
   - In every run mode, drop candidates whose normalized domain or normalized company/country key appears in `existing_identity_keys`; this list comes from the tenant database before search starts.
   - Do not count dropped denylist candidates toward `target_count`. When the retained list falls below `target_count`, return to query generation and collect replacements before producing final JSON.
3. Choose the dedupe key.
   - Prefer Google `place_id` when present and the place refers to a specific business profile.
   - Next prefer normalized domain.
   - If no domain exists, use normalized company name plus city/country.
   - If neither exists, keep only if a contact email has a public source URL.
4. Merge duplicate evidence.
   - Keep all source URLs and source excerpts.
   - Preserve Maps evidence as separate `google_maps_places` provenance with field mask profile and fetched timestamp.
   - Merge matched products and buyer-type evidence.
   - Preserve the highest confidence contact candidate per contact value.
5. Assign `duplicate_status`.
   - `new`: no matching domain/name/email in this run.
   - `possible_duplicate`: fuzzy name/domain overlap but not enough to merge.
   - `duplicate`: merged into another candidate; do not show as a primary lead.
6. Rank candidates.
   - Higher source count.
   - Stronger product fit.
   - Clear buyer persona.
   - Contact candidate backed by a public source.
   - Lower duplicate risk.
7. Enforce the net-new output target.
   - Final primary leads should equal `target_count` whenever public search produced enough non-denylisted buyer candidates.
   - If fewer than `target_count` remain after filtering, record which country/product/query families were exhausted and why replacements could not be found.

## Dedupe Explanation

Every retained lead should carry a concise explanation for the UI/evidence panel:

```json
{
  "dedupe_key": "example-mobile-distribution.co.uk",
  "duplicate_status": "new",
  "dedupe_explanation": "Google place id and normalized website domain are unique in this run; company name and contact email do not overlap with other candidates."
}
```

## Safety

- Do not delete weak-but-plausible leads silently; mark them as low confidence or possible duplicates.
- Do not merge two companies only because their product categories match.
- Do not treat supplier marketplace pages as buyer leads.
