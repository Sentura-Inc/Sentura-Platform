# 跨境筛选背调员工 — TOOLS

Use only read-only investigation tools.

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
- `cross-border-intel__cbe_intel_sec_lookup`
- `cross-border-intel__cbe_intel_trade_record_search`
- `cross-border-intel__cbe_intel_score_buyer`

Do not use Accio parser/summarizer tools unless the operator explicitly supplies Accio chat context for behavior scoring.

## `memory_search` / `memory_get`

Use to retrieve prior Accio summaries, previous Screening reports, or operator-approved customer facts. Never treat memory as proof unless it has source references.

## Not Allowed

No shell, filesystem mutation, gateway config edits, browser signup, external messaging, cold outreach, or subagent spawning.
