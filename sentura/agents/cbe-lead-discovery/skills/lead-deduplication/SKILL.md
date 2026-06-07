# Lead Deduplication

## When To Use

Use after public search/fetch has produced candidate companies, domains, contacts, or source snippets.

## Procedure

1. Normalize each candidate.
   - Domain: parse from `website` when present, lowercase, remove `www.`, strip paths and tracking params.
   - Company name: lowercase, trim punctuation, remove common legal suffixes for matching only (`ltd`, `limited`, `inc`, `llc`, `gmbh`, `sarl`, `sa`, `spa`).
   - Email: lowercase and trim.
2. Remove excluded domains.
   - Drop marketplace/supplier domains from the configured exclusion list.
   - Drop obvious consumer-only product review pages and product marketplaces.
3. Choose the dedupe key.
   - Prefer normalized domain.
   - If no domain exists, use normalized company name plus country.
   - If neither exists, keep only if a contact email has a public source URL.
4. Merge duplicate evidence.
   - Keep all source URLs and source excerpts.
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

## Dedupe Explanation

Every retained lead should carry a concise explanation for the UI/evidence panel:

```json
{
  "dedupe_key": "example-mobile-distribution.co.uk",
  "duplicate_status": "new",
  "dedupe_explanation": "Normalized website domain is unique in this run; company name and contact email do not overlap with other candidates."
}
```

## Safety

- Do not delete weak-but-plausible leads silently; mark them as low confidence or possible duplicates.
- Do not merge two companies only because their product categories match.
- Do not treat supplier marketplace pages as buyer leads.
