# Cross-Border Intel MCP Server

Read-mostly MCP server for the Cross-border e-commerce / 跨境电商 Phase-1 MVP. It gives the Screening and Accio Memory employees deterministic tools for low-cost buyer investigation, contextual scoring, and simulated Alibaba Accio chat parsing.

## Tool Surface

All tools are registered with `readOnlyHint: true` and return `source_url`, `source_type`, `fetched_at`, and `confidence`.

| Tool | Purpose |
|---|---|
| `cbe_intel_company_registry_search` | Companies House search for GB when an API key exists; OpenCorporates only when configured; otherwise public-web registry fallback. |
| `cbe_intel_company_profile` | Companies House company profile by company number, or manual registry URL review stub. |
| `cbe_intel_domain_rdap_lookup` | RDAP.org domain lookup with 200/302/404/429 handling. |
| `cbe_intel_email_domain_check` | Syntax, free/disposable provider, role-email, MX, SPF, DMARC, and optional Abstract + Hunter paid validation. |
| `cbe_intel_official_contact_email_search` | Fetch a small set of public official website pages and extract same-domain contact emails for optional paid validation. |
| `cbe_intel_sec_lookup` | SEC EDGAR company-name-to-CIK resolution through `company_tickers.json`, then submissions lookup by ten-digit CIK. |
| `cbe_intel_trade_record_search` | Volza/ImportYeti paid search only when keys and spend caps are enabled; otherwise weak public-web fallback. |
| `cbe_intel_score_buyer` | Deterministic contextual score with normalized score and evidence coverage separated. |
| `cbe_intel_parse_accio_chat` | Validate and normalize an Accio JSON export fixture. |
| `cbe_intel_summarize_accio_chat` | Extract company profile, requested goods, negotiated prices, behavior signals, and follow-up tasks. |

## Environment

Secrets must live in OpenClaw's `.env` / secret store, not in config prose or code.

| Variable | Required | Notes |
|---|---:|---|
| `COMPANIES_HOUSE_API_KEY` | No | Enables GB Companies House search/profile. |
| `OPENCORPORATES_API_KEY` | No | Paid global registry fallback. Disabled when absent. |
| `SEC_USER_AGENT` | Recommended | SEC requests need a descriptive User-Agent. Default is a non-secret Sentura identifier. |
| `ABSTRACT_API_KEY` | No | Optional Abstract Email Reputation lookup when `enable_paid_validation` is requested. |
| `HUNTER_API_KEY` | No | Optional Hunter Email Verifier call when `enable_paid_validation` is requested. |
| `VOLZA_API_KEY` | No | Optional paid trade-data search. |
| `IMPORTYETI_API_KEY` | No | Optional paid trade-data search. |
| `CBE_ENABLE_PAID_TRADE_DATA` | No | Must be `true`/`1` before paid trade calls run. |
| `CBE_MAX_PAID_SPEND_USD` | No | Global per-call paid-data budget ceiling. Default `0`. |
| `CBE_INTEL_REQUEST_TIMEOUT_MS` | No | HTTP timeout. Default `30000`. |

## OpenClaw MCP Config

`scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` register this server
for local Sentura installs. Operators should put credentials in
`~/.openclaw/.env` (or `%USERPROFILE%\.openclaw\.env` on Windows), build the
package, then rerun the Sentura setup script.

The setup script writes the flat `mcp.servers.<name>` shape consumed by
OpenClaw. API keys are written as `${ENV_VAR}` config references, not literal
secrets and not `$secret:` markers:

```json5
{
  mcp: {
    servers: {
      "cross-border-intel": {
        command: "node",
        args: ["sentura/mcp-servers/cross-border-intel/dist/index.js"],
        cwd: ".",
        env: {
          COMPANIES_HOUSE_API_KEY: "${COMPANIES_HOUSE_API_KEY}",
          SEC_USER_AGENT: "SenturaCrossBorderIntel/0.1 contact=ops@example.invalid",
          ABSTRACT_API_KEY: "${ABSTRACT_API_KEY}",
          HUNTER_API_KEY: "${HUNTER_API_KEY}",
          IMPORTYETI_API_KEY: "${IMPORTYETI_API_KEY}",
          CBE_ENABLE_PAID_TRADE_DATA: "false",
          CBE_MAX_PAID_SPEND_USD: "0",
          CBE_INTEL_REQUEST_TIMEOUT_MS: "30000"
        }
      }
    }
  }
}
```

The script omits optional API-key env references when the corresponding env var
is not configured, so a missing paid provider does not break OpenClaw config
load. `TAVILY_API_KEY` is for OpenClaw `web_search` auto-detection, not for this
MCP server's `env` block.

Sandboxed employees also need MCP/plugin tools allowlisted at the sandbox layer:

```json5
{
  tools: {
    allow: ["web_search", "web_fetch", "memory_search", "memory_get", "group:plugins"],
    sandbox: {
      tools: {
        allow: ["web_search", "web_fetch", "memory_search", "memory_get", "cross-border-intel__*"]
      }
    }
  }
}
```

## Cost Controls

The Phase-1 default is low-cost and public:

- RDAP/DNS/SEC are free public routes.
- Companies House requires an API key but no paid route is assumed here.
- OpenCorporates, Volza, ImportYeti, Abstract, and Hunter are optional. Missing keys disable only those adapters.
- `cbe_intel_official_contact_email_search` performs a small public official-site fetch and does not validate deliverability by itself; pass a discovered same-domain email into `cbe_intel_email_domain_check` with `enable_paid_validation=true` to trigger Abstract/Hunter.
- Hunter uses `GET https://api.hunter.io/v2/email-verifier`; Abstract uses `GET https://emailreputation.abstractapi.com/v1/?api_key=...&email=...`. API keys are never returned in tool output.
- ImportYeti uses `GET https://data.importyeti.com/v1.0/company/search?name=...&page_size=...` with the documented `IYApiKey` header when paid trade data and budget are enabled.
- `cbe_intel_trade_record_search` will not call paid trade providers unless `CBE_ENABLE_PAID_TRADE_DATA=true` and the request budget is within `CBE_MAX_PAID_SPEND_USD`.
- Disabled paid evidence is reported as coverage gap, not as a buyer fraud penalty.

## Development

```bash
pnpm --filter @sentura/mcp-cross-border-intel test
pnpm --filter @sentura/mcp-cross-border-intel build
```

Tests use `InMemoryTransport`, mocked HTTP, and injected DNS resolvers. No real Companies House, SEC, RDAP, email, or trade-data calls are made during Vitest.
