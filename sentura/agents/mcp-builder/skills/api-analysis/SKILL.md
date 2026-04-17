# API Analysis

## When to Use

Trigger this skill when an `ekg_manager` requests a new MCP server and provides API documentation (URL, PDF, OpenAPI spec, etc.). Run before any code generation.

## Procedure

### Step 1: Intake the Documentation

1. If URL: `web_fetch` the main doc landing page. Follow to OpenAPI/Swagger if linked.
2. If PDF: use `pdf` tool to extract text.
3. If attached file in workspace: `fs_read`.
4. If user gives only an API name (e.g., "Stripe"): `web_search` for official docs, confirm canonical URL with user before proceeding.
5. Classify documentation completeness:
   - **A (full)**: OpenAPI/Swagger spec available → automated analysis
   - **B (partial)**: endpoint list + examples but no formal spec → manual mapping
   - **C (sparse)**: marketing doc only → escalate, request better source

### Step 2: Classify the API

Answer these questions and record in `api-brief.md`:

1. **Transport**: REST (HTTP/JSON), GraphQL, gRPC, WebSocket, webhook, or proprietary?
2. **Base URL(s)**: production, sandbox, region-specific endpoints.
3. **Authentication**: API key / OAuth2 / basic / JWT / mTLS / signed request.
4. **Rate limits**: requests per second/minute, quotas, burst tolerance.
5. **Pagination style**: cursor, offset, page-number, keyset, hypermedia links.
6. **Error format**: HTTP status + body schema. Any retry semantics?
7. **Idempotency**: does the API support idempotency keys on writes?
8. **Versioning**: URL path, header, or accept parameter?

### Step 3: Enumerate Endpoints

1. List every endpoint (or GraphQL query/mutation) found in the spec.
2. For each, record: HTTP method, path, summary, required params, auth scope, idempotency, destructive (yes/no).
3. If more than 30 endpoints: cluster into tool families (e.g., "customers", "orders", "payments").

### Step 4: Rank for V1 Tool Selection

Score each endpoint 0-10 on:
- Read vs write (reads generally favored in v1).
- Business value (customer-visible data, common integrations).
- Complexity (simple GETs preferred to complex multi-step workflows).
- Safety (non-destructive preferred).

Select the TOP 10-20 endpoints. Below 10: the API may be too narrow — confirm with user. Above 20: split into multiple tools or scope reductions.

### Step 5: Produce the API Brief

Write `sentura/mcp-servers/{name}/api-brief.md` with:

```markdown
# {API Name} — MCP Server Brief

## Source
- Documentation: {URL or filename}
- Access Date: {ISO-8601}

## Classification
- Transport: ...
- Auth: ...
- Rate Limits: ...

## Selected Tools (v1)
| Tool Name           | Method | Path                | Data Class | Notes                   |
|---------------------|--------|---------------------|------------|-------------------------|
| {api}.customer.get  | GET    | /customers/{id}     | T2         | Returns PII             |
| ...                 | ...    | ...                 | ...        | ...                     |

## Excluded from v1
- {endpoint} — {reason}

## Secrets Required
- `{SECRET_NAME}` — {description}

## Open Questions for User
- {question 1}
- {question 2}
```

### Step 6: Gate on User Approval

Present the API Brief to the user. Do NOT proceed to scaffold generation until they:
1. Confirm selected tools.
2. Provide credentials for smoke testing (test/sandbox environment preferred).
3. Approve destructive tools (if any) explicitly.

## Tools Needed

- `web_fetch` — fetch API documentation pages
- `web_search` — find canonical documentation URLs
- `browser` — JS-rendered API doc portals (via Playwright)
- `pdf` — extract text from PDF specs
- `fs_read` / `fs_write` — load attached docs, write the brief

## Safety

- NEVER guess at auth mechanisms — if the doc is ambiguous, ask the user
- NEVER select destructive endpoints for v1 without explicit approval
- NEVER include production credentials in the API Brief
- ALWAYS present the Brief to the user and await confirmation before scaffolding
- ALWAYS record the source URL and retrieval date (for traceability and upstream change detection later)
