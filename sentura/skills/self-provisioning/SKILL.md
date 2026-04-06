# Self-Provisioning

## When to Use

When you need access to an external service or API that you don't currently have credentials for, and a task requires it. This includes:
- A new integration identified during employee incubation
- A tool or service needed to complete an assigned task
- An MCP server that requires credentials not yet in the secret store

## Procedure

### Step 1: Check Existing Credentials

1. Query the OpenClaw secret store for credentials matching the service name
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
4. Store credentials in OpenClaw's encrypted secret store:
   - Key naming convention: `{service_name}_{credential_type}` (e.g., `zendesk_api_key`)
   - NEVER store credentials in workspace files, conversation history, or logs

### Step 6: Configure MCP Server

1. Determine the MCP server type:
   - **Tier 1 (npm package)**: Use existing `@mcp-servers/{service}` package if available
   - **Tier 2 (Sentura-generated)**: Use a generated MCP server from enterprise API docs
   - **Tier 3 (custom config)**: Configure with the service's API directly

2. Add MCP server to agent config via `config.patch`:
   ```json5
   {
     mcp: {
       servers: {
         "{service_name}": {
           command: "npx",
           args: ["-y", "@mcp-servers/{service}"],
           env: {
             "{SERVICE}_API_KEY": { $secret: "{service_name}_api_key" },
             "{SERVICE}_BASE_URL": "{base_url}"
           }
         }
       }
     }
   }
   ```

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
2. Update TOOLS.md in the employee's workspace with the new MCP server reference

## Tools Needed

- `browser` — navigate registration pages, extract credentials
- `fs_write` — update workspace TOOLS.md
- `message` — notify humans of approval requests, escalations, and completion
- `web_search` — find service documentation and API setup guides
- `web_fetch` — read API documentation

## Safety

- NEVER store credentials in workspace files or conversation history
- NEVER bypass CAPTCHAs — escalate to human
- NEVER use personal email addresses — always use the enterprise AI email
- NEVER sign up for paid plans without explicit human approval
- NEVER attempt to brute-force or circumvent rate limiting
- ALWAYS request approval for new account creation
- ALWAYS verify credentials work before marking provisioning complete
- ALWAYS log every provisioning action for audit trail
- ALWAYS use minimum necessary permissions when creating API keys
