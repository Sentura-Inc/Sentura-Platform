# Self-Provisioning Pipeline

> ## ⚠️ Implementation caveat (2026-04-26)
>
> Several steps of this pipeline reference gateway RPCs (`secrets.resolve`,
> `secrets.reload`, `exec.approval.request`, `exec.approval.resolve`) that are
> **not** in the agent-callable `gateway` tool's restricted action enum (only
> `restart`, `config.get`, `config.schema.lookup`, `config.apply`,
> `config.patch`, `update.run` are reachable from inside an agent's tool
> palette — see `openclaw/src/agents/tools/gateway-tool.ts:137`). Those RPCs
> exist on the gateway server but are reachable only from typed clients
> (dashboard, CLI).
>
> Until the agent-callable surface grows, the steps below describe the
> intended autonomous flow alongside an **operator-driven fallback** for
> each blocked sub-step:
>
> | Blocked sub-step | Operator-driven fallback |
> |--|--|
> | `secrets.resolve` precheck | Ask operator: "Do you already have `<KEY>` in `~/.openclaw/.env`?" |
> | `exec.approval.request` submit | Approval flow auto-triggers when Creator invokes the `browser` tool (per `approvals.tools` policy). Creator does not submit approvals directly. |
> | `secrets.reload` after .env edit | Operator runs `openclaw secrets reload` (CLI) or clicks "Reload secrets" on the dashboard after pasting the credential into `~/.openclaw/.env`. |
> | `agents.files.get/set` for `TOOLS.md` append | Use `sentura_agents_manage { action: "read"/"write" }` (already covered in Step 8). |
>
> A Week-4 follow-up should either widen the `gateway` tool's action enum or
> add a `sentura_secrets_manage` plugin tool to close the gap and make this
> pipeline fully autonomous. Tracked in `docs/TeamPlan.md` Week 4.

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
   OpenClaw exposes `secrets.resolve` (for known target IDs registered with the
   secret target registry) and `secrets.reload` (warm-reload after .env edits).
   There is **no** `secrets.exists` and **no** `secrets.set` RPC — secret writes
   happen on disk (see Step 5).

   For credentials whose secret target IDs are registered:
   ```
   gateway.call("secrets.resolve", {
     commandName: "self-provisioning-precheck",
     targetIds: ["<knownTargetId>", ...],
   })
   ```
   The result has `assignments[]` (resolved paths/values), `inactiveRefPaths[]`
   (declared `$secret.*` references that did not resolve), and `diagnostics[]`.

   For ad-hoc keys that are not yet in the target registry, read
   `~/.openclaw/.env` directly via the `read` tool and look for the
   `KEY=` line. A missing or empty value means the key needs provisioning.

3. Separate into two lists:
   - `alreadyProvisioned` — key resolves to a non-empty value (or `KEY=...` is present in `.env`)
   - `needsProvisioning` — key missing, empty, or surfaced in `inactiveRefPaths`

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

For each service requiring approval (Standard or Elevated):

1. Construct approval request body:
   ```json5
   {
     action: "self_provisioning",
     agentId: "<target employee id>",
     service: "<service name>",
     url: "<registration URL>",
     reason: "<why this access is needed — from design brief>",
     tier: "<plan/tier name>",
     estimatedCostUSD: null,           // or a number for paid plans
     requestingAgent: "creator",
     escalateTo: "<operator from design brief>",
   }
   ```
2. Submit via the gateway approval tool:
   ```
   gateway.call("exec.approval.request", <above>)
   ```
3. Inform the operator: "Awaiting approval for [service] provisioning. You will receive an approval request on the dashboard."
4. Wait for the approval event (`exec.approval.resolved` with `decision: "approve"`).
   - If rejected: log the rejection, notify operator, mark the service as "needs manual provisioning". Continue with remaining services.

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

5. After writing, reload the gateway's secret cache so subsequent tools see
   the new value:
   ```
   gateway.call("secrets.reload", {})
   // → { ok: true, warningCount: 0 }
   ```

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
- `gateway` — `secrets.resolve` / `secrets.reload`, `tools.effective` (post-provisioning tool-palette refresh), `exec.approval.request` / `exec.approval.resolve`. Secret writes use the file-system (`~/.openclaw/.env`) or a configured `secrets.providers.<name>.command` — there is no `secrets.set` RPC. MCP-server tool verification is a normal tool call against the freshly-registered tool name (no `mcp.invoke` RPC exists).
- `sentura_agents_manage` — `write` (update TOOLS.md)
- `message` — notify operators of approval requests, CAPTCHA blocks, 2FA prompts, and completion
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
