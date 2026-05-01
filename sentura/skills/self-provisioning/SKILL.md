# Self-Provisioning

## When to Use

When you need access to an external service or API that you don't currently have credentials for, and a task requires it. This includes:
- A new integration identified during employee incubation
- A tool or service needed to complete an assigned task
- An MCP server that requires credentials not yet in the secret store

## Week 3 A Contracts

- Per-agent secrets live under `/sentura/agents/<agentId>/<service>/<credential>`.
- MCP env entries store secret references as strings such as `"$secret:/sentura/agents/<agentId>/<service>/<credential>"`.
- Only stdio MCP servers may use `$secret:` pointers, and only inside the server's `env` block.
- Remote HTTP/SSE MCP `headers` remain operator-managed this round. Do not place `$secret:` pointers there.
- For employee-local integrations, do **not** use `gateway.config.patch`. Use `sentura_agents_manage` actions `has_secret`, `put_secret`, `upsert_mcp_servers`, and `remove_mcp_servers`.

## Procedure

### Step 1: Check Existing Credentials

1. Call `sentura_agents_manage` with `action: "has_secret"` for each credential you need:
   - `agentId`
   - `service`
   - `credential`
2. If credentials exist:
   - Verify they're still valid (test API call)
   - If valid → skip to Step 6 (configure MCP server)
   - If expired/invalid → proceed to Step 3 (re-provision)

### Step 2: Determine Approval Requirements

Classify the provisioning request:

| Category | Approval Required? | Examples |
|----------|--------------------|----------|
| **Approved service list** | No (auto-approved) | Services pre-approved by IT admin |
| **Free tier of known service** | Yes (standard) | Zendesk free trial, HubSpot free CRM |
| **Paid service** | Yes (elevated) | Any service requiring payment |
| **New account creation** | Yes (standard) | Signing up for a service the company hasn't used |
| **Sensitive system access** | Yes (elevated) | Financial systems, HR systems, production databases |

If approval is required:
1. Submit an approval request via `exec.approval` with:
   - Service name and URL
   - Why this access is needed (specific task context)
   - What tier/plan is needed
   - Estimated cost (if paid)
   - Which AI employee needs it
2. Wait for approval before proceeding
3. If rejected → notify the requesting user with the rejection reason and suggest alternatives

### Step 3: Navigate to Service

1. Use `browser` tool to navigate to the service's registration page
2. If the service has an API-key-only setup (no account needed):
   - Navigate directly to the API settings or developer portal
   - Skip to Step 4

### Step 4: Register / Authenticate

1. Use the enterprise's designated AI email address: `{enterprise_ai_email}`
2. Fill in registration form using `browser` tool:
   - Name: "{Company} AI Integration"
   - Email: `{enterprise_ai_email}`
   - Company: "{Company}"
   - Use case: "Enterprise automation integration"
3. Handle common registration challenges:
   - **Email verification**: Check enterprise email inbox via email MCP (if available), or escalate to human
   - **CAPTCHA**: Escalate to human with screenshot and context. Do NOT attempt to bypass CAPTCHAs.
   - **2FA/MFA**: Escalate to human with instructions for completing the 2FA step
   - **Phone verification**: Escalate to human with the phone number needed
   - **Rate limiting**: Wait the specified duration and retry once. If still blocked, escalate.

### Step 5: Obtain API Credentials

1. Navigate to the service's API settings / developer portal using `browser`
2. Create an API key or OAuth application:
   - Name: "{Company} - Sentura Integration"
   - Permissions: minimum necessary for the required use case
3. Extract the credentials from the page:
   - API key / token
   - API secret (if applicable)
   - Base URL / endpoint
   - Any other required configuration values
4. Store each secret via `sentura_agents_manage { action: "put_secret", ... }`:
   - `service` should be the integration id (for example `zendesk`)
   - `credential` should be the credential field name (for example `api_key`)
   - Save the returned pointer string; never copy the plaintext secret into any file
5. NEVER store credentials in workspace files, conversation history, or logs

### Step 6: Configure MCP Server

1. Determine the MCP server type:
   - **Tier 1 (npm package)**: Use existing `@mcp-servers/{service}` package if available
   - **Tier 2 (Sentura-generated)**: Use a generated MCP server from enterprise API docs
   - **Tier 3 (custom config)**: Configure with the service's API directly

2. Register the employee-local MCP server via `sentura_agents_manage { action: "upsert_mcp_servers", ... }` so it lands in the target workspace's `config.json5 -> mcpServers`:
   ```json5
   {
     action: "upsert_mcp_servers",
     agentId: "{agent_id}",
     mcpServers: {
       "{service_name}": {
         command: "npx",
         args: ["-y", "@mcp-servers/{service}"],
         env: {
           "{SERVICE}_API_KEY": "$secret:/sentura/agents/{agent_id}/{service_name}/api_key",
           "{SERVICE}_BASE_URL": "{base_url}"
         }
       }
     }
   }
   ```
3. Keep secret pointers as strings inside `env`. Do **not** use object form `{ $secret: ... }`.
4. If you need to remove a broken integration, call `sentura_agents_manage { action: "remove_mcp_servers", agentId, serverNames: ["{service_name}"] }`.

### Step 7: Verify Connection

1. Make a test API call through the MCP server to verify:
   - Credentials are valid
   - Permissions are sufficient
   - The correct base URL is configured
2. If verification fails:
   - Check credentials (re-extract if needed)
   - Check permissions (may need to update API key scope)
   - If still failing → escalate to human with full error context

### Step 8: Audit Logging

1. Log the provisioning event with:
   - Service name and URL
   - Provisioning method (new account, existing credentials, re-provision)
   - Approval status (auto-approved, manually approved, approval reference)
   - MCP server configuration (redacted credentials)
   - Verification result (pass/fail)
   - Timestamp and agent ID
2. Sentura automatically records redacted config/secrets diffs in `~/.openclaw/logs/sentura-config-diffs.jsonl` for `put_secret` and `upsert_mcp_servers`.
3. Update `TOOLS.md` in the employee's workspace with the new MCP server reference if your role has workspace-write privileges.

## Tools Needed

- `browser` — navigate registration pages, extract credentials
- `sentura_agents_manage` — secret checks/storage and per-agent MCP registration
- `message` — notify humans of approval requests, escalations, and completion
- `web_search` — find service documentation and API setup guides
- `web_fetch` — read API documentation

## Safety

- NEVER store credentials in workspace files or conversation history
- NEVER echo plaintext secrets back to the user after `put_secret`
- NEVER use `{ $secret: ... }` object syntax in MCP env — use the string pointer form
- NEVER place `$secret:` pointers in remote HTTP/SSE MCP `headers`
- NEVER bypass CAPTCHAs — escalate to human
- NEVER use personal email addresses — always use the enterprise AI email
- NEVER sign up for paid plans without explicit human approval
- NEVER attempt to brute-force or circumvent rate limiting
- ALWAYS request approval for new account creation
- ALWAYS verify credentials work before marking provisioning complete
- ALWAYS log every provisioning action for audit trail
- ALWAYS use minimum necessary permissions when creating API keys
