# Lead Query Generation

## When To Use

Use this skill when the operator asks for new overseas buyer discovery, a scheduled lead-search run, or query expansion for mobile-accessory buyers.

## Procedure

1. Normalize the input.
   - Translate Chinese product terms into English search keywords while preserving the Chinese meaning in the operator summary.
   - Normalize countries to ISO alpha-2 codes and map them to country names/languages.
   - Use defaults from `BOOTSTRAP.md` only when the operator omitted a field.
2. Build query families for each product/country pair:
   - Company-owned website: `phone case phone accessories retailer United Kingdom contact us`.
   - Retail and repair buyer: `mobile phone repair screen protector United Kingdom locations`.
   - Store/location/contact proof: `"cell phone accessories" "retail store" Germany "locations"`, `"smartphone repair" "charger" Brazil "contact us"`.
   - Reseller/import buyer: `"mobile accessories importer buyer" "phone case" Mexico "about us"`, `"electronics reseller buyer" "USB-C charger" France`.
   - Domain exclusions: use tool/API exclude-domain controls for social, directory, marketplace, and generic supplier domains. Avoid stuffing many negative operators into the query when they reduce result relevance.
3. Apply exclusions before and after search:
   - Exclude Amazon, Alibaba, AliExpress, Temu, eBay, and operator-supplied domains.
   - Exclude Facebook, LinkedIn, Instagram, YouTube, TikTok, X/Twitter, Reddit, Pinterest, business directories, marketplace pages, public company-info pages, review sites, supplier directories, and generic wholesale-list pages.
   - Exclude supplier pages that are clearly factories, manufacturers, OEM/ODM sellers, exporters, or China-based marketplace sellers rather than downstream overseas buyers.
4. Call `web_search` with the generated queries.
5. Use `web_fetch` only for public pages on a candidate company's own website that appear likely to prove company identity, product fit, contact candidate provenance, or buyer persona.
6. Record every query string with:
   - query text;
   - target country/language;
   - product keyword;
   - search timestamp;
   - source type `public_web`.

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
