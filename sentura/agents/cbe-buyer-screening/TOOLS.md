# 跨境筛选背调员工 — TOOLS

Use only read-only investigation tools.

Default execution shape:

- Investigate one company per session.
- Treat a 2-10 company operator batch as parent/child work created by the Dashboard/store; each child session sees one target.
- Do not accept prompts that ask this agent to investigate 5 or 10 companies in one session.
- Batch-3 is allowed only when the server explicitly marks the run as a controlled `batch3_experiment`.

## `web_search`

Use for public footprint, official registry-page discovery outside supported APIs, social/profile snippets, public fraud/adverse-media searches, annual-report discovery, and SEC CIK discovery. Keep query strings in evidence.

## `web_fetch`

Use only on public pages returned by search or supplied by the operator. Do not log in, bypass protections, or scrape protected social pages.

## `cross-border-intel__*`

Allowed MCP tools:

- `cross-border-intel__cbe_intel_company_registry_search`
- `cross-border-intel__cbe_intel_company_profile`
- `cross-border-intel__cbe_intel_domain_rdap_lookup`
- `cross-border-intel__cbe_intel_email_domain_check`
- `cross-border-intel__cbe_intel_official_contact_email_search`
- `cross-border-intel__cbe_intel_google_places_search`
- `cross-border-intel__cbe_intel_google_place_details`
- `cross-border-intel__cbe_intel_google_geocode`
- `cross-border-intel__cbe_intel_google_address_validate`
- `cross-border-intel__cbe_intel_sec_lookup`
- `cross-border-intel__cbe_intel_trade_record_search`
- `cross-border-intel__cbe_intel_score_buyer`

Do not use Accio parser/summarizer tools unless the operator explicitly supplies Accio chat context for behavior scoring.

Paid-source constraints:

- `cbe_intel_email_domain_check` may use Abstract/Hunter paid validation only when `enable_paid_validation=true` and the target email is supplied by the operator or discovered as a same-domain email on the official website.
- `cbe_intel_trade_record_search` may use ImportYeti/Volza only when the run includes paid trade authorization and a per-target budget. Use at most one paid trade call per target.
- Google Maps Places must be used for the dedicated `Google Maps 地址版图` address-footprint pass on every company investigation when the API is available. Build bounded query variants from company/legal/brand name, country/city/region, website/domain, phone when available, and official-site location/store/address pages found through web search/fetch.
- Basic local-presence refresh is still capped separately: if a Marketing lead includes `google_place_id`, call `cbe_intel_google_place_details` at most once with `field_mask_profile="screening_local_presence"` and `purpose="screening"` for that basic check.
- Address-footprint discovery may call `cbe_intel_google_places_search` for multiple query variants and `cbe_intel_google_place_details` with `field_mask_profile="screening_address_footprint"` for shortlisted unique places under the configured address-footprint cap. Deduplicate by place id, formatted address, phone, website domain, and display name.
- `cbe_intel_google_address_validate` may validate unique public business addresses from Maps, registry, or the official website under the per-target validation cap. Address validation is supporting evidence only, not legal ownership proof.
- Never call paid sources again during retry unless the Dashboard/store explicitly says a fresh paid lookup was approved.
- Lead Discovery does not use Abstract, Hunter, ImportYeti, Volza, Companies House, or SEC directly; those are Screening evidence sources.

Deferred or blocked APIs:

- No Apollo, Hunter Domain Search/Finder, ImportGenius, Panjiva, D&B, Creditsafe, Experian, Surepass, Karza, Alibaba/ICBU, product-posting, CRM-write, or outreach APIs in the default Screening path.
- Alibaba/ICBU is future read-only internal evidence only after seller authorization/access proof.

## `memory_search` / `memory_get`

Use to retrieve prior Accio summaries, previous Screening reports, or operator-approved customer facts. Never treat memory as proof unless it has source references.

## Not Allowed

No shell, filesystem mutation, gateway config edits, browser signup, external messaging, cold outreach, or subagent spawning.
