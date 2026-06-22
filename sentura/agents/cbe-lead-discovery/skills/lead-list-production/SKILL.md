# Lead List Production

## When To Use

Use for final run output, interim progress summaries, JSON export, Markdown export, or dashboard table handoff.

## Required JSON Shape

Each candidate must match the `LeadCandidate` schema:

```json
{
  "lead_id": "lead_20260608_0001",
  "source_run_id": "lead-run-2026-06-08-us-gb",
  "company_name": "Example Mobile Distribution Ltd",
  "website": "https://example-mobile-distribution.co.uk",
  "domain": "example-mobile-distribution.co.uk",
  "country": "GB",
  "city": "Manchester",
  "google_place_id": "ChIJexample",
  "google_maps_uri": "https://maps.google.com/?cid=123",
  "buyer_type": "distributor",
  "matched_products": ["phone case", "screen protector"],
  "contact_candidates": [
    {
      "type": "email",
      "value": "sales@example-mobile-distribution.co.uk",
      "source_url": "https://example-mobile-distribution.co.uk/contact",
      "confidence": 0.74
    }
  ],
  "source_urls": ["https://example-mobile-distribution.co.uk"],
  "discovery_evidence": [
    {
      "signal": "google_maps_local_presence",
      "source_url": "https://maps.google.com/?cid=123",
      "finding": "Google Maps Places returned an OPERATIONAL electronics-store profile with public address and Maps URI.",
      "confidence": 0.72,
      "query": "phone accessories wholesaler Manchester",
      "fetched_at": "2026-06-08T00:00:00Z",
      "source_type": "google_maps_places",
      "google_place_id": "ChIJexample",
      "field_mask_profile": "lead_discovery_list"
    },
    {
      "signal": "website_mentions_mobile_accessories",
      "source_url": "https://example-mobile-distribution.co.uk/products",
      "excerpt": "Wholesale mobile accessories and repair parts",
      "confidence": 0.82,
      "query": "\"mobile accessories distributor\" \"United Kingdom\"",
      "fetched_at": "2026-06-08T00:00:00Z",
      "source_type": "public_web"
    }
  ],
  "dedupe_key": "example-mobile-distribution.co.uk",
  "duplicate_status": "new",
  "created_at": "2026-06-08T00:00:00Z"
}
```

## Procedure

1. Verify that every retained lead has:
   - company name;
   - country;
   - buyer type;
   - a company-owned website or company website page confirmed by web search/fetch when possible. A Google Maps profile alone is not enough for final acceptance unless the run is explicitly a local-presence-only seed list;
   - at least one matched product;
   - at least one source URL;
   - at least one discovery evidence item;
   - dedupe key;
   - created timestamp.
2. Confirm the lead is a downstream buyer candidate:
   - business content mentions mobile accessories, phone repair, screen protectors, phone cases, chargers, repair parts, electronics retail, or phone-store operations;
   - buyer profile is retail store, repair shop/chain, electronics retailer, accessory retailer, reseller, importer buyer, or phone store;
   - reject factories, manufacturers, OEM/ODM sellers, exporters, marketplace listings, supplier directories, and generic "top wholesale suppliers" pages.
   - Google Maps `business_status=OPERATIONAL`, place types, address, phone, rating count, or opening hours are local-presence support only; do not present them as legal/KYB proof.
3. Enforce the run target before final output:
   - `target_count` means the required count of net-new, non-duplicate customers for the current task.
   - Do not include candidates whose normalized domain or company/country key appears in `existing_identity_keys`.
   - Do not count duplicate, marketplace, supplier, directory, or denied candidates toward `target_count`; replace them through additional search when possible.
   - If more than `target_count` retained candidates exist, output the strongest `target_count`; if fewer remain, include `shortage_reason`.
4. Separate final output into:
   - `leads_json`: structured array;
   - `operator_markdown`: compact Chinese summary;
   - `audit`: query strings, source URLs, source types, timestamps, and exclusion notes.
5. If requested count is not reached:
   - state actual count;
   - explain shortage by country/source and by denylist/duplicate pressure;
   - list the query families already attempted;
   - list recommended next query families or paid/official sources, without implying fraud.
6. Mark source provenance visibly:
   - `official_api`
   - `public_web`
   - `google_maps_places`
   - `google_maps_geocoding`
   - `paid_trade_data`
   - `demo_fixture`
   - `self_reported`
   - `unverified`
7. Keep email/contact candidates source-bound. If a contact cannot be sourced, omit it or mark it as unverified evidence, not as a confirmed contact.
8. Preserve Google Maps provenance when used:
   - `google_place_id`;
   - `google_maps_uri`;
   - endpoint and field mask profile;
   - fetched timestamp;
   - bounded normalized fields used for dedupe such as business status, address, website URI, phone, and types.
   Do not include raw Google responses, review text, photos, or API keys.

## Markdown Summary

Use Chinese headings and compact rows:

- run inputs;
- candidate count by country;
- top candidates;
- duplicates/exclusions;
- shortage notes;
- next action: review selected leads or generate Screening handoff.

## Dashboard Output Contract

When the task is sent by `/client-demos/cross-border/lead-discovery`, the final response must include the machine-readable lead list between these exact markers, without a Markdown code block:

```text
LEAD_CANDIDATES_JSON_START
{
  "run_id": "lead-run-YYYY-MM-DD-live",
  "leads": []
}
LEAD_CANDIDATES_JSON_END
```

The `leads` array is the source of truth for the dashboard table. Markdown summaries are allowed before the marker block, but they must not replace it.
The `leads` array should contain exactly `target_count` net-new candidates unless `shortage_reason` explains why public sources and replacement searches could not satisfy the target.

## Safety

- No outreach instructions unless the operator explicitly asks for a draft, and even then produce a draft only.
- Do not hide missing evidence.
- Do not turn a lead list into a background-screening report; Screening owns risk scoring.
