# Self-Provisioning Pipeline

> **Autonomy note (2026-05-01)** — this pipeline is now agent-callable end-to-end via three Sentura tools: `sentura_agents_manage` (workspace + secret writes + `dotenv_check`), `sentura_approval_request` (HITL approvals with policy-based auto-approve/deny), and the `browser` tool (Playwright automation). Earlier versions of this skill described an operator-driven fallback because the agent-callable `gateway` tool's enum doesn't expose `exec.approval.*`/`secrets.*` directly; those gaps are now closed by the Sentura-named primitives below. The only remaining operator touchpoint is the gateway's secret-cache reload after a `.env` write, which is handled by either (a) a session restart (next session re-reads `.env`) or (b) the operator running `openclaw secrets reload`.

## When to Use

During **Phase 3** of AI employee creation, immediately after the workspace has been generated (Phase 2) and before final deployment (Phase 4). Use this skill when the employee's design brief identifies:

- External services (Zendesk, HubSpot, Salesforce, Notion, Slack, etc.) that the employee needs to call but whose API credentials do not yet exist in the secret store.
- MCP servers listed in the design bundle that reference `$secret.*` keys that are absent from `~/.openclaw/.env`.

Do NOT run Phase 3 if all required credentials are already provisioned (credential pre-check in Phase 2 was green).

## Procedure

### Step 1: Identify Required Credentials

1. Read the design bundle's `mcpServers` array. For each server:
   - Extract all `$secret.*` references from the `env` map.
   - Record: `{ service, secretKey, description, tier }`.
2. Probe whether each `$secret.<key>` already resolves to a non-empty value.
   For PER-AGENT credentials (already in the Sentura file provider):
   ```
   sentura_agents_manage { action: "has_secret", agentId: "<targetAgentId>", service: "<service>", credential: "<credential-key>" }
   ```
   For GLOBAL credentials in `~/.openclaw/.env` (anything matched by a
   `$secret.<KEY>` reference where the key is the dotenv key name):
   ```
   sentura_agents_manage { action: "dotenv_check", agentId: "creator", dotenvKey: "<KEY>" }
   // → { ok: true, exists: true, length: 51, dotenvFilePath: "/Users/.../.openclaw/.env" }
   ```
   The `dotenv_check` action returns only existence + value length — never the
   value itself. (The `agentId: "creator"` is a no-op caller field for
   schema-required validation; the dotenv file is global.)

3. Separate into two lists:
   - `alreadyProvisioned` — `has_secret` returned `true` OR `dotenv_check.exists` is `true`
   - `needsProvisioning` — both probes returned absent/empty

If `needsProvisioning` is empty, skip to Step 7 (smoke-test).

### Step 2: Classify Each Service

For each service in `needsProvisioning`, classify the provisioning tier:

| Tier | Criteria | Approval Required? |
|------|----------|--------------------|
| **Auto** | Pre-approved by IT admin list (`sentura/config/approval-policies.json5`) | No |
| **Standard** | Free tier of known service; new account but no cost | Yes — standard HITL |
| **Elevated** | Paid plan, sensitive system (financial/HR), OAuth with broad scopes | Yes — elevated HITL |

Load the approval policy list:
```
read file: sentura/config/approval-policies.json5
```

### Step 3: Submit Approval Requests

For each service requiring approval (Standard or Elevated), submit via Sentura's policy-based HITL approval tool:

```
sentura_approval_request {
  action: "self_provisioning.<service>",       // stable identifier for policy matching
  riskLevel: "high" | "critical",              // Standard tier → "high"; Elevated → "critical"
  context: {
    agentId: "<target employee id>",
    service: "<service name>",
    url: "<registration URL>",
    reason: "<why this access is needed — from design brief>",
    tier: "<plan/tier name>",
    estimatedCostUSD: null,                    // or a number for paid plans
    requestingAgent: "creator",
    escalateTo: "<operator from design brief>",
  },
}
```

The reply is one of three shapes (no waiting required for the first two):

- `{ status: "auto_approved", requestId, policyId, reason }` — a matching policy in `sentura/config/approval-policies.json5` allowed this combination; proceed to Step 4.
- `{ status: "auto_denied", requestId, policyId, reason }` — a policy explicitly blocked it; mark the service as "manual-only" and continue.
- `{ status: "pending", requestId, policyId, reason, expiresAt, escalation, onTimeoutDecision }` — human review required; inform the operator: *"Awaiting approval for `<service>` provisioning. You will receive an approval request on the dashboard. Pending request id: `<requestId>` (expires `<expiresAt>`)."*

For pending approvals, poll the decision via `sentura.approval.requests.get` (gateway RPC, available via the `gateway` tool):

```
gateway.call("sentura.approval.requests.get", { requestId: "<requestId>" })
// → { request: { status: "pending" | "approved" | "denied" | ... } }
```

Poll every 30s up to 10 minutes. On `approved` → continue to Step 4. On `denied` → log the rejection and continue with remaining services. On `expired` → escalate to operator with a fresh request having `escalation.currentIndex + 1`.

### Step 4: Navigate and Register

For each approved (or auto-approved) service, use the `browser` tool:

1. Look up the provisioning template:
   ```
   read file: sentura/config/provisioning-templates/<service>.json5
   ```
   Template fields: `registrationUrl`, `apiSettingsUrl`, `formFields`, `credentialKeys`, `minimumScopes`, `notes`.

2. Navigate to `registrationUrl` with the browser tool.

3. Fill registration form fields from the template's `formFields`:
   - Name: `{Company} AI Integration`
   - Email: `{enterprise_ai_email}` (from target employee's BOOTSTRAP.md Enterprise Context)
   - Company: `{Company}`
   - Use case: `"Enterprise automation integration"`

4. Handle registration challenges (see Safety section for hard stops):
   - **Email verification**: Attempt to read the verification link via the enterprise email MCP tool if available. If unavailable, escalate to human with the email address used.
   - **CAPTCHA**: Stop immediately. Send a message to the operator with a screenshot. Wait for human to complete it.
   - **2FA/MFA**: Stop. Send instructions to operator for the 2FA step. Wait for confirmation.
   - **Phone verification**: Stop. Send the phone number requirement to operator. Wait.
   - **Rate limiting**: Wait the specified duration (max 10 min). Retry once. If still blocked, escalate.

### Step 5: Extract API Credentials

1. Navigate to `apiSettingsUrl` from the template.
2. Create an API key or OAuth app:
   - Name: `{Company} - Sentura Integration`
   - Permissions: minimum scopes listed in the template's `minimumScopes` field
3. Extract credentials from the page (screenshot + structured extraction).
4. Persist each credential to the on-disk secret store. OpenClaw does **not**
   expose a `secrets.set` RPC — the supported write paths are:

   **a. Dotenv append (default for self-hosted single-tenant):**
   ```
   write_file: ~/.openclaw/.env
   append: <SECRET_KEY>=<credential value>
   ```
   The `~/.openclaw/.env` file is the canonical key/value secret store
   loaded by the gateway's dotenv loader at startup and by `secrets.reload`.

   **b. Pluggable provider command (multi-tenant / vault-backed deployments):**
   If `secrets.providers.<name>.command` is configured, invoke that command
   with the secret payload. Refer to the operator's SOP for the exact
   contract — never assume a default vault path.

5. After writing, the gateway's secret cache must pick up the new value. The
   agent-callable `gateway` tool's enum does not include `secrets.reload`, so:
   - **Default path**: do nothing further — OpenClaw's MCP loader spawns
     server processes that read `~/.openclaw/.env` directly on launch, and
     the next session start re-reads `.env` for in-process tool resolution.
     Write the credential, register the MCP server (Step 6), and the next
     `sessions.create` against the target agent will see the new value.
   - **Mid-session escalation path**: if a still-running session must use the
     new credential immediately, ask the operator to run
     `openclaw secrets reload` (CLI) or click "Reload secrets" on the
     dashboard. Do not retry the dependent tool until the operator confirms.

**NEVER** log the raw credential value, echo it in agent replies, or place it in
conversation history. The dotenv write is a tool call with the value as the
parameter — the value never appears in the LLM context after that turn.

### Step 6: Verify Credentials

After registering the MCP server (via `sentura_agents_manage` writing
`mcp.servers.<service_name>` into the target agent's config), OpenClaw's MCP
loader spawns the server and adds its tools to the runtime tool palette.
Verification = call one of those new tools directly by name. There is **no**
`mcp.invoke` gateway RPC.

For each newly provisioned service:

1. Re-fetch the target agent's effective tools to confirm the MCP server's
   tools are present:
   ```
   gateway.call("tools.effective", { agentId: "<targetAgentId>" })
   ```
2. Pick the lightest available tool from the new MCP server (e.g.
   `list_<resource>`, `whoami`, `me`, or any read-only listing endpoint) and
   invoke it as a normal tool call from the test session — exactly like any
   other tool the agent would call. The MCP server contributes the tool by
   the name it declares in its server manifest.
3. On success: record `{ service, status: "verified", timestamp: "<ISO-8601>" }`.
4. On failure:
   - Check credential format (try re-extracting from the registration page).
   - Check permissions (may need to expand API key scopes).
   - If still failing after one retry: escalate to operator with full error
     context. Mark service as `"unverified"`.

### Step 7: Audit Log

After all services are processed the `sentura-audit` extension captures a tool-call audit entry automatically. Produce a structured summary as a tool result or message, containing:

```json5
{
  event: "self_provisioning_complete",
  agentId: "<target employee id>",
  timestamp: "<ISO-8601>",
  services: [
    {
      name: "<service>",
      method: "new_account",      // or "existing_credentials" | "re_provision"
      approvalStatus: "approved", // or "auto" | "rejected" | "pending"
      approvalRef: "<approval id or null>",
      verificationStatus: "verified", // or "unverified" | "skipped"
      secretKey: "<key name — NOT the value>",
      mcpServer: "<server name in config>",
    },
  ],
  summary: "<human-readable summary>",
}
```

Do NOT include any credential values in this output.

### Step 8: Update Employee TOOLS.md

Append a new section to the target employee's `TOOLS.md` for each verified MCP server:

```
sentura_agents_manage {
  action: "write",
  agentId: "<id>",
  relPath: "TOOLS.md",
  content: "<existing TOOLS.md content + new section appended below>",
}
```

New section format:
```markdown
### <Service Name> (MCP)

- Provisioned: <YYYY-MM-DD>
- MCP server: `<server name in config>`
- Credentials: stored in secret store as `<secretKey>` (never inline)
- Available tools: <list from template or discovery>
```

### Step 9: Signal Phase 4 Readiness

Return the provisioning summary to the Phase 4 orchestration:

```json5
{
  phase: 3,
  status: "complete",    // or "partial" | "failed"
  provisionedServices: [...],
  pendingManual: [],     // services that need operator manual setup
  blockers: [],          // hard blockers that must be resolved before Phase 4
}
```

If `status === "partial"`, continue to Phase 4 but note in the deployment record that some integrations require manual credential setup.

## Tools Needed

- `browser` — navigate registration pages, extract credentials from web UI
- `sentura_approval_request` — submit Standard / Elevated tier approval requests with policy-based auto-approve / auto-deny / require-human routing
- `sentura_agents_manage` — `dotenv_check` (probe global credentials in `~/.openclaw/.env`), `has_secret` / `put_secret` (per-agent secret store), `read` / `write` (workspace files, including TOOLS.md), `upsert_mcp_servers` (per-agent MCP wiring)
- `gateway` — `config.get` (snapshot read), `tools.effective` (post-provisioning tool-palette refresh). Note: `secrets.*` and `exec.approval.*` are NOT in the agent-callable enum; use the `sentura_*` tools above instead. MCP-server tool verification is a normal tool call against the freshly-registered tool name (no `mcp.invoke` RPC exists).
- `message` — notify operators of pending approvals, CAPTCHA blocks, 2FA prompts, and completion
- `web_search` — find service API documentation when template is missing
- `web_fetch` — read API docs directly

## Safety

- **NEVER** store credentials in workspace files, conversation history, audit logs, or TOOLS.md content.
- **NEVER** attempt to bypass CAPTCHAs — always escalate to human.
- **NEVER** use personal email addresses — always use the enterprise AI email from the employee's BOOTSTRAP.md Enterprise Context.
- **NEVER** sign up for a paid plan without explicit elevated-tier human approval.
- **NEVER** attempt to brute-force or circumvent rate limiting — one retry, then escalate.
- **ALWAYS** request approval before creating any new external account.
- **ALWAYS** verify credentials work before marking provisioning complete.
- **ALWAYS** log every provisioning event (service, method, approval reference) — never just the credential.
- **ALWAYS** use minimum necessary permissions when creating API keys.
- **ALWAYS** report partial success clearly — an employee with some integrations missing is better than blocking deployment entirely.
