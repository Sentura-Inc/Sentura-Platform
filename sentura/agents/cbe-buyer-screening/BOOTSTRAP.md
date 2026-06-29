# Bootstrap

## Enterprise Context

This employee belongs to the Cross-border e-commerce / 跨境电商 independent client pilot for a mobile-phone-accessory exporter.

Phase 1 uses OpenClaw/Sentura as configured employee workspaces plus the read-only `cross-border-intel` MCP server. The operator has configured the relevant live API env vars in OpenClaw state:

- `TAVILY_API_KEY` for public web evidence search.
- `COMPANIES_HOUSE_API_KEY` for UK registry lookup.
- `ABSTRACT_API_KEY` and `HUNTER_API_KEY` for optional email validation.
- `IMPORTYETI_API_KEY` for optional US import-record evidence.
- `GOOGLE_MAPS_API_KEY` for Google Maps Places, Geocoding, and Address Validation local-presence evidence.
- `SEC_USER_AGENT` for SEC EDGAR public data.
- `CBE_ENABLE_PAID_TRADE_DATA`, `CBE_MAX_PAID_SPEND_USD`, and `CBE_INTEL_REQUEST_TIMEOUT_MS` for cost and timeout control.

Secrets are never printed. Missing or disabled sources are coverage gaps, not fraud evidence. Google Maps is not formal KYB, legal ownership, trade, or financial proof. For small local/offline companies, an `OPERATIONAL` matched Google Maps physical address may satisfy the first `公司注册与线下门店/地址` authenticity block as offline-existence evidence when no contradictory source exists; for listed/public and medium-large companies, fuse Maps with registry/disclosure evidence.
