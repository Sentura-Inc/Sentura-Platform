# Cross-Border Lead Discovery — TOOLS.md

## Available Tool Contract

Actual tool availability is controlled by `config.json5` and the live OpenClaw config. This file explains how to use the intended tools.

### `cross-border-intel__*`

Use Google Maps tools as the first-pass discovery source when the operator asks for storefront, repair-chain, electronics-retailer, phone-store, regional distributor, or local wholesaler leads.

Primary Maps tools:

- `cross-border-intel__cbe_intel_google_places_search` for Places API (New) Text Search and Nearby Search lead seeds. Prefer Text Search for natural-language buyer intent such as `phone accessories wholesaler Manchester`; use Nearby Search only after a reliable lat/lng city or market grid exists.
- `cross-border-intel__cbe_intel_google_place_details` only for shortlisted place IDs, capped to the target count plus a small replacement buffer. Use it to obtain website URI, address, phone, business status, types, rating count, opening hours, and Google Maps URI.
- `cross-border-intel__cbe_intel_google_geocode` only to convert city/market seeds into coordinates for Nearby Search. Do not treat geocoding as buyer verification.

Allowed light enrichment after a company/domain candidate exists:

- `cross-border-intel__cbe_intel_email_domain_check` when a public email/domain candidate is found and the operator wants contact-quality flags.
- `cross-border-intel__cbe_intel_domain_rdap_lookup` when a domain appears ambiguous and a low-cost domain sanity check would help dedupe.

Do not call registry, SEC, trade-record, score, Address Validation, or Accio tools during ordinary lead generation. Those belong to Screening or Accio Memory. Google Maps is discovery/local-presence evidence only and must be independently confirmed with web evidence before a lead is accepted.

### `web_search`

Use after Google Maps candidate discovery to confirm company-owned website, product/category fit, buyer persona, and non-Maps public evidence. If Google Maps is unavailable or produces a coverage gap, fall back to public discovery queries. Every query must be logged in the final audit appendix.

Allowed query families:

- buyer type: importer, distributor, wholesaler, retailer, electronics store, repair chain;
- retail/repair: mobile phone repair chain, phone parts, contact, wholesale;
- trade fair/exhibitor: MWC, IFA, CES, Canton Fair plus mobile accessories;
- B2B platform cross-check: Global Sources, Made-in-China;
- public social/business pages through search snippets only.

Do not use `web_search` to find login-only social content or to bypass site access controls.

### `web_fetch`

Use only on public pages returned by `web_search` or supplied by the operator. Fetch pages that can prove:

- company identity and country;
- product fit;
- buyer persona;
- contact candidate provenance;
- source timestamp / publication context where available.

Do not fetch private/internal hosts, login-gated pages, or pages whose terms visibly prohibit automated access.

### `cron`

Use only for operator-requested recurring lead-search runs. The scheduled prompt must include:

- products;
- countries/languages;
- target count;
- exclusion domains;
- output destination as chat/report only.

Cron runs still obey the no-outreach rule.

## Prohibited Tools And Actions

- No `exec`, filesystem write/edit, shell scripts, gateway config edits, subagents, or session spawning.
- No external messaging or outreach.
- No secret handling.
- No custom scraping code.
