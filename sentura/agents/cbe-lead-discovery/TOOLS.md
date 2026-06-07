# Cross-Border Lead Discovery — TOOLS.md

## Available Tool Contract

Actual tool availability is controlled by `config.json5` and the live OpenClaw config. This file explains how to use the intended tools.

### `web_search`

Use for public discovery queries only. Every query must be logged in the final audit appendix.

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

### `cross-border-intel__*`

The `cross-border-intel` MCP server is primarily for Screening and Accio Memory. Lead Discovery may use it only for light enrichment that improves candidate quality without turning the run into a full background investigation.

Allowed in this employee:

- `cross-border-intel__cbe_intel_email_domain_check` when a public email/domain candidate is found and the operator wants contact-quality flags.
- `cross-border-intel__cbe_intel_domain_rdap_lookup` when a domain appears ambiguous and a low-cost domain sanity check would help dedupe.

Do not call registry, SEC, trade-record, score, or Accio tools during ordinary lead generation. Those belong to Screening or Accio Memory.

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
