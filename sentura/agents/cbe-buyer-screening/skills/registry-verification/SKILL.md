# Registry Verification

## When to Use

Use when a target has company name, country, registry number, official registry URL, or an inferred legal name.

## Procedure

1. For `country=GB`, always call `cross-border-intel__cbe_intel_company_registry_search` before public web search.
2. If a Companies House company number is selected, call `cross-border-intel__cbe_intel_company_profile`.
3. For `country=US`, always call `cross-border-intel__cbe_intel_sec_lookup` before public web search:
   - pass `cik` when supplied;
   - otherwise pass `company_name` so the tool can resolve `company_tickers.json` and return either SEC submissions or `not_found`.
4. For GB, only use public web registry search after Companies House is missing, rejected, or ambiguous. For US, only use public web state registry search after SEC returns `not_found`, `api_error`, or the target appears private/non-filer.
5. For other countries, use `web_search` to find official registry pages. Fetch only public pages with `web_fetch`.
6. Record whether legal identity is:
   - active/verified,
   - partially matched,
   - not found,
   - `unavailable_api`,
   - `pending_human_input`.
7. Compare registry company name against website/footer/operator-supplied name. If they materially conflict, add a forced-downgrade candidate and explain the evidence.

## Required Ordering

- GB: Companies House API/profile first, then official public Companies House page or web search fallback.
- US: SEC `company_tickers.json`/submissions first, then state registry or official registry web search fallback.
- SEC `not_found` for a private company is `not_applicable` or coverage gap, not a negative signal.

## Evidence Tags

Use `official_api` for Companies House/SEC API responses, `official_registry_page` for official registry web pages, and `public_web` for search-derived registry clues.

## Safety

Do not treat unsupported-country registry absence as fraud. It is a coverage gap unless there is contradictory evidence.
