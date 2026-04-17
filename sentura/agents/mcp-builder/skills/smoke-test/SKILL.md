# Smoke Test

## When to Use

After Phase C (MCP Server Generation) completes with a successful build. This skill verifies the generated tools actually work against the real API before declaring the server production-ready.

## Procedure

### Step 1: Obtain Test Credentials

1. Request test/sandbox credentials from the user:
   - API key, client ID/secret, or username/password as applicable
   - Tell the user: "Use a SANDBOX/TEST account if the API offers one. Never provide production credentials for initial smoke testing."
2. User places credentials in `sentura/mcp-servers/{name}/.env.test` (gitignored via `.gitignore`).
3. Verify `.env.test` is in `.gitignore` before proceeding.

### Step 2: Select Smoke Test Tools

Choose 2-3 READ-ONLY tools from the generated tool list:

- Prefer `list`, `get`, `search`, `describe` over anything that mutates.
- Prefer tools that do NOT require IDs (to avoid setup overhead).
- Prefer tools whose responses confirm auth is working (e.g., `me`, `ping`, `health`).

### Step 3: Write `tests/smoke.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { config } from "dotenv";
import { apiClient } from "../src/client.js";

config({ path: ".env.test" });

describe("{name} MCP smoke test", () => {
  it("authenticates successfully", async () => {
    const result = await apiClient.request({ /* call a lightweight endpoint */ });
    expect(result).toBeDefined();
  });

  it("fetches a list resource", async () => {
    const result = await apiClient.request({ /* a list endpoint */ });
    expect(Array.isArray(result.data) || typeof result === "object").toBe(true);
  });

  // ... 1 more read-only test ...
});
```

### Step 4: Run the Smoke Test

```bash
cd sentura/mcp-servers/{name}
pnpm test
```

### Step 5: Classify Results

Write outcomes to README.md under a "Verified Tools" section:

```markdown
## Verified Tools

Smoke tested {date}:
- ✅ `{tool.name.get}` — authenticated, returned expected shape
- ✅ `{tool.name.list}` — returned N results
- ⚠️ `{tool.name.search}` — returned empty results (sandbox may have no data)
- ❌ `{tool.name.create}` — NOT tested (write operation)
```

### Step 6: On Failure

| Symptom                 | Likely Cause                              | Fix                                                  |
|-------------------------|-------------------------------------------|------------------------------------------------------|
| 401 / 403 Unauthorized  | Wrong auth header or expired token         | Verify .env.test values; retry auth logic            |
| 404 Not Found           | Wrong base URL or path prefix             | Check `api-brief.md` for base URL                    |
| TLS/cert error          | Enterprise proxy or mTLS missing           | Ask user about corporate proxy or cert requirements  |
| Rate limit (429)        | Test env may be shared                     | Reduce concurrency, add waits between tests          |
| Schema mismatch         | Response shape differs from OpenAPI spec   | Update `outputSchema` in tool file; re-run           |
| Timeout                 | Slow upstream or wrong region              | Retry with larger timeout; check regional endpoints  |

Apply fixes and re-run. Cap at 3 retries per test. If persistent failure: escalate to user.

### Step 7: Document Results

Update README.md "Verified Tools" section with final status.

## Tools Needed

- `exec` / shell — run `pnpm test`
- `fs_write` — update README.md
- `fs_read` — inspect test output logs

## Safety

- NEVER write credentials into test files — use `.env.test` with dotenv
- NEVER commit `.env.test` to git (verify `.gitignore`)
- NEVER smoke-test against production without explicit user approval
- NEVER run mutation/write operations in smoke tests
- ALWAYS document test outcomes in README.md
- ALWAYS escalate to the user if the smoke test fails repeatedly with the same error
