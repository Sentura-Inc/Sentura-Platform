# Lead Query Generation

## When To Use

Use this skill when the operator asks for new overseas buyer discovery, a scheduled lead-search run, or query expansion for mobile-accessory buyers.

## Procedure

1. Normalize the input.
   - Translate Chinese product terms into English search keywords while preserving the Chinese meaning in the operator summary.
   - Normalize countries to ISO alpha-2 codes and map them to country names/languages.
   - Use defaults from `BOOTSTRAP.md` only when the operator omitted a field.
   - For every run mode, treat `target_count` as the number of net-new customers required for the current task, not as the employee's desired total list size.
   - For every run mode, treat `existing_identity_keys` as a database-derived pre-search denylist. Do not intentionally search for or return those domains/company-country keys; when a search result matches the denylist, replace it with another candidate.
   - If `run_mode` is `top_up_unique_leads`, keep the original scope but generate fresh query variants, still exclude every `existing_identity_keys` domain/name, and do not repeat `already_covered_queries`.
2. Build Google Maps Places query families for each product/country/city or region pair:
   - Text Search first: `phone accessories wholesaler Manchester`, `mobile phone repair parts Los Angeles`, `electronics retailer phone chargers Hamburg`, `cell phone accessories store Mexico City`.
   - Include buyer personas that Maps can reasonably surface: phone store, mobile phone repair, electronics store, accessory store, regional wholesaler, distributor.
   - Use `included_types` only when it improves precision, such as `electronics_store` or `store`; do not assume Google has exact types for `phone repair chain`, `mobile accessories distributor`, or `import buyer`.
   - Use `cross-border-intel__cbe_intel_google_geocode` only when Nearby Search needs a reliable city/market center. Otherwise prefer Text Search with country/city terms.
   - Record Maps query metadata with source type `google_maps_places`, endpoint, field mask profile, Google Maps URI, and fetched timestamp.
3. Build web-search verification query families for each product/country pair:
   - Company-owned website: `phone case phone accessories retailer United Kingdom contact us`.
   - Retail and repair buyer: `mobile phone repair screen protector United Kingdom locations`.
   - Store/location/contact proof: `"cell phone accessories" "retail store" Germany "locations"`, `"smartphone repair" "charger" Brazil "contact us"`.
   - Reseller/import buyer: `"mobile accessories importer buyer" "phone case" Mexico "about us"`, `"electronics reseller buyer" "USB-C charger" France`.
   - Domain exclusions: use tool/API exclude-domain controls for social, directory, marketplace, and generic supplier domains. Avoid stuffing many negative operators into the query when they reduce result relevance.
4. Apply exclusions before and after search:
   - Exclude Amazon, Alibaba, AliExpress, Temu, eBay, and operator-supplied domains.
   - Exclude every domain/name key present in `existing_identity_keys` before writing search queries and again when reviewing search results.
   - Exclude Facebook, LinkedIn, Instagram, YouTube, TikTok, X/Twitter, Reddit, Pinterest, business directories, marketplace pages, public company-info pages, review sites, supplier directories, and generic wholesale-list pages.
   - Exclude supplier pages that are clearly factories, manufacturers, OEM/ODM sellers, exporters, or China-based marketplace sellers rather than downstream overseas buyers.
5. Call Google Maps Places before web search when available.
   - Run `cross-border-intel__cbe_intel_google_places_search` with `field_mask_profile="lead_discovery_list"` and a capped `max_result_count`.
   - Use `cross-border-intel__cbe_intel_google_place_details` only for shortlisted place IDs after dedupe, with `field_mask_profile="lead_discovery_basic"` and purpose `lead_discovery`.
   - Accept Maps candidates only as discovery seeds until web evidence confirms official website/product/buyer fit.
   - If the tool returns `unavailable_api`, `rate_limited`, `api_error`, or no results, record the coverage gap and continue with web-only query families.
6. Call `web_search` with enough generated queries to over-collect raw candidates before final dedupe.
   - Cover every selected country and product where possible.
   - Use at least the company-owned website, retail/repair buyer, store/location/contact proof, and reseller/import buyer families before declaring a shortage.
   - Aim for at least `target_count * 3` raw candidate domains before final filtering; for targets under 5, aim for at least 12 raw candidates.
   - `max_results_per_query` is only a per-query result hint. It is not a cap on total queries, total raw candidates, or final net-new leads.
7. Use `web_fetch` only for public pages on a candidate company's own website that appear likely to prove company identity, product fit, contact candidate provenance, or buyer persona. If `web_fetch` is blocked by security policy, private-IP protection, timeout, or site access failure, keep the company as a candidate only when `web_search` provided a company-owned URL plus a relevant title/snippet, record that source as `public_web`, and continue searching for replacements.
8. Record every query string with:
   - query text;
   - target country/language;
   - product keyword;
   - search timestamp;
   - source type `google_maps_places` or `public_web`.

## Candidate Acceptance

Retain a result only when it is a specific company candidate, not a source page. The source URL should normally be the company's own website, such as an about, contact, product, repair-service, store-location, or business-profile page on that company's domain.

Reject as leads:

- Facebook, LinkedIn, Instagram, YouTube, TikTok, X/Twitter, Reddit, Pinterest, and similar social profiles.
- Directories and data aggregators such as Europages, Kompass, Yellow Pages, Yell, D&B, ZoomInfo, Apollo, Crunchbase, and review sites.
- Marketplaces and supplier directories such as Alibaba, AliExpress, Amazon, eBay, Temu, GlobalSources, Made-in-China, DHgate, WholesaleCentral, and generic "top wholesale suppliers" articles.
- Pages whose main business is manufacturing, OEM/ODM, exporting, or wholesale supply, unless the operator explicitly requested supplier-side leads.

Accepted leads should show both:

- mobile-accessory or phone-repair business relevance; and
- a downstream buyer profile such as retail store, repair shop/chain, electronics retailer, accessory retailer, reseller, importer buyer, or phone store.

## Output

Return a query plan and candidate extraction notes. Include:

```json
{
  "run_id": "lead-run-YYYY-MM-DD-country-slug",
  "query_plan": [
    {
      "query": "phone case phone accessories retailer United Kingdom contact us",
      "country": "GB",
      "language": "en",
      "product_keyword": "phone case",
      "buyer_persona": "electronics retailer",
      "source_type": "public_web"
    }
  ],
  "exclusions": ["amazon.com", "alibaba.com"],
  "search_timestamp": "ISO-8601"
}
```

## Safety

- Do not log in to protected sites.
- Do not bypass robots, paywalls, captchas, rate limits, or marketplace controls.
- Do not invent missing search results.
- Do not send outreach.
