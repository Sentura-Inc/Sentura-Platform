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
   - a company-owned website or company website page, not a social profile, directory, marketplace, generic wholesale article, or public database page;
   - at least one matched product;
   - at least one source URL;
   - at least one discovery evidence item;
   - dedupe key;
   - created timestamp.
2. Confirm the lead is a downstream buyer candidate:
   - business content mentions mobile accessories, phone repair, screen protectors, phone cases, chargers, repair parts, electronics retail, or phone-store operations;
   - buyer profile is retail store, repair shop/chain, electronics retailer, accessory retailer, reseller, importer buyer, or phone store;
   - reject factories, manufacturers, OEM/ODM sellers, exporters, marketplace listings, supplier directories, and generic "top wholesale suppliers" pages.
3. Separate final output into:
   - `leads_json`: structured array;
   - `operator_markdown`: compact Chinese summary;
   - `audit`: query strings, source URLs, source types, timestamps, and exclusion notes.
4. If requested count is not reached:
   - state actual count;
   - explain shortage by country/source;
   - list recommended next query families or paid/official sources, without implying fraud.
5. Mark source provenance visibly:
   - `official_api`
   - `public_web`
   - `paid_trade_data`
   - `demo_fixture`
   - `self_reported`
   - `unverified`
6. Keep email/contact candidates source-bound. If a contact cannot be sourced, omit it or mark it as unverified evidence, not as a confirmed contact.

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

## Safety

- No outreach instructions unless the operator explicitly asks for a draft, and even then produce a draft only.
- Do not hide missing evidence.
- Do not turn a lead list into a background-screening report; Screening owns risk scoring.
