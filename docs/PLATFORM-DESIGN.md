# Sentura Platform — High-Level Design (Revised)

> **Status**: Living design document. Supersedes the scattered design notes in `docs/DESIGN.md` for the
> simplified two-tenant product direction agreed on 2026-05-28.
> `docs/DESIGN.md` is retained as historical reference for the full 17-capability spec.
>
> **Last updated**: 2026-05-28 — added GCP data layer (Secret Manager, Cloud SQL, GCS, Cloud Run connectors) and agent template library (§5).

---

## 1. Product Vision

Sentura is a **multi-tenant AI agent platform** built on OpenClaw. Each customer company gets an
isolated **workspace** ("their meshclaw") where a conversational Creator agent helps them build,
deploy, and tune AI agents tailored to their own business. Those agents can connect to the
customer's own services — databases, APIs, Slack, GitHub — via a secure connector layer.

The platform has two product surfaces:

| Surface | Who uses it | What they do |
|---------|-------------|--------------|
| **Admin view** | Tenant admin | Browse the agent library, deploy templates with one click, create custom agents via Creator, tune agents via Tuner, configure service connectors, manage users |
| **Employer view** | Tenant employer | Start sessions with deployed agents and use them; nothing else |

---

## 2. Roles

Three roles exist across the entire platform:

| Role | Scope | Capabilities |
|------|-------|-------------|
| `platform_admin` | Global (Sentura ops) | Create/delete tenants, manage all users, view all telemetry |
| `tenant_admin` | One tenant | Create agents via Creator, tune agents via Tuner, configure connectors, invite employers |
| `employer` | One tenant | Start sessions with deployed agents, chat with them; read-only on agent list |

### Mapping to existing RBAC

The existing 7-role model (`platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`,
`end_user`, `viewer`) in `sentura/extensions/sentura-rbac/` **stays in the codebase** — it is
already wired into the middleware and extension layer. The new `tenant_admin` and `employer` roles
are **added** on top, with `tenant_admin` mapping to `agent_manager`-level scopes and `employer`
mapping to `end_user`-level scopes. The dashboard UI gates views by these two new role labels
without touching the underlying permission logic.

---

## 3. Tenant Model

A **tenant** is one customer company. For the initial two-company scope:

```
tenants/
├── acme/                  ← Tenant slug
│   ├── users.json5        ← admin(s) + employer(s) for this tenant
│   └── connectors.json5   ← external service connections for this tenant
└── globex/
    ├── users.json5
    └── connectors.json5
```

Each tenant's agents are registered in OpenClaw with a `tenantId` tag and their workspaces live
under `~/.openclaw/workspace/{tenantSlug}-{agentId}/`. The existing `sentura-rbac` tenancy store
(`~/.openclaw/sentura-rbac/agent-tenancy.json`) already tracks `tenantId` per agent — Creator
populates this via `register_agent` on deploy.

### What isolation means in practice

- One shared OpenClaw gateway (single process, one port).
- Agent IDs namespaced: `acme-billing-rep`, `globex-support-bot`.
- Workspaces namespaced: `~/.openclaw/workspace/acme-billing-rep/`.
- Memory (LanceDB) namespaced by `tenantId` via `sentura-memory-lancedb` extension (already built).
- `employer` role users from Acme can only start sessions with `acme-*` agents.
- Creator and Tuner are **shared meta-agents** but they receive the active tenant's slug in the
  session context so they namespace all outputs correctly.

---

## 4. How Customers Connect Their Own Services

This is the core infrastructure question. The answer is a **connector layer** — pre-built MCP
servers that agents call as tools, where the connection credentials (DB strings, API keys) are
supplied by the tenant admin and stored securely.

### 4.1 Connector types

| Connector | What it exposes to the agent | Config the admin provides |
|-----------|------------------------------|--------------------------|
| **PostgreSQL** | `query`, `list_tables`, `describe_table` | Connection string |
| **MySQL** | `query`, `list_tables` | Connection string |
| **REST API** | `get`, `post`, `put`, `delete` with auth header | Base URL, API key or Bearer token |
| **Slack** | `send_message`, `get_channel_history`, `list_channels` | Bot token, workspace ID |
| **GitHub** | `list_issues`, `create_issue`, `get_file`, `search_code` | Personal access token, org/repo |
| **Filesystem** | `read_file`, `write_file`, `list_dir` | Root directory path |

Tier-1 connector code for PostgreSQL, Slack, GitHub, and Filesystem already exists under
`sentura/mcp-servers/`. The REST API connector and MySQL connector need to be added.

### 4.2 How connectors wire into an agent

```
  Agent (OpenClaw embedded runtime)
      │
      │ calls MCP tools (e.g. pg_query, slack_send_message)
      ▼
  Connector MCP Server (local subprocess, stdio transport)
      │
      │ uses credentials from secret store
      ▼
  Customer's Service (PostgreSQL, Slack API, REST endpoint, …)
```

The connector runs as a **local subprocess** on the Sentura host (same machine as OpenClaw). It
reads credentials from OpenClaw's secret store (`~/.openclaw/.env`) at startup via
`secrets.reload`. No customer credentials leave the Sentura host — they are encrypted at rest in
the secret store and only read by the connector subprocess.

**Why not a remote MCP server on the customer's own infra?** For two companies running on a
shared host, a local subprocess is simpler. When a customer requires that data never leaves their
network (e.g., self-hosted DB on a private VPC), the connector can be run on their side and
exposed via an authenticated MCP-over-HTTP bridge — but that is a future option, not required now.

### 4.3 Admin flow to connect a service

1. Tenant admin opens **Integrations** page in dashboard (route `/integrations` already exists).
2. Selects a connector type (PostgreSQL, Slack, …).
3. Fills in the credential form (connection string, API key, etc.).
4. Dashboard writes credentials to `~/.openclaw/.env` under a tenant-namespaced key
   (e.g. `ACME_POSTGRES_URL=postgres://...`).
5. Dashboard calls `secrets.reload` gateway RPC.
6. Dashboard calls `sentura_agents_manage` to append the connector's MCP server entry to the
   target agent's config (or all agents in the tenant).
7. Agent restarts its MCP subprocess and the new tools appear in its toolset.

The connector MCP server reads `process.env.{TENANT}_POSTGRES_URL` (injected from the secret
store) rather than a hardcoded value.

---

## 5. Agent Template Library

Customers should not have to start from scratch. Sentura ships a **curated library of ready-made
agent templates** — fully-formed workspace files for common business roles — that tenants deploy
with a single click and then customize.

### 5.1 What a template is

A template is a complete, parameterized set of the 8 OpenClaw workspace files plus skills, stored
in the Sentura repo under `sentura/templates/`. Each file uses `{{placeholder}}` tokens for the
values that vary per deployment (company name, escalation contact, etc.).

```
sentura/templates/
├── manifest.json5                          ← index of all templates
├── customer-support/
│   ├── billing-support-rep/
│   │   ├── template.json5                  ← metadata + customization schema
│   │   ├── AGENTS.md
│   │   ├── SOUL.md
│   │   ├── TOOLS.md
│   │   ├── IDENTITY.md
│   │   ├── USER.md
│   │   ├── HEARTBEAT.md
│   │   ├── BOOTSTRAP.md
│   │   ├── MEMORY.md
│   │   └── skills/
│   │       ├── billing-policy/SKILL.md
│   │       └── escalation/SKILL.md
│   └── technical-support/
│       └── ...
├── sales/
│   ├── sdr/
│   └── account-executive/
├── hr/
│   ├── onboarding-specialist/
│   └── policy-advisor/
├── finance/
│   ├── accounts-payable/
│   └── expense-reviewer/
└── operations/
    └── vendor-management/
```

### 5.2 Template metadata (`template.json5`)

```json5
{
  id: "billing-support-rep",
  name: "Billing Support Representative",
  description: "Handles billing inquiries, payment disputes, subscription changes. Escalates refunds and credits to a human.",
  category: "customer-support",
  industries: ["e-commerce", "saas", "financial-services"],
  suggestedConnectors: ["postgres", "rest-api"],  // shown as recommendations in the Integrations page
  model: "anthropic/claude-sonnet-4-6",
  author: "sentura",                             // "sentura" = Sentura-curated; future: tenant slug for custom
  version: "1.2.0",

  // Customization fields shown in the deploy form
  fields: [
    { key: "agentName",       label: "Agent name",          type: "text",     default: "Billing Support Rep" },
    { key: "tenantName",      label: "Company name",        type: "text",     required: true },
    { key: "escalateTo",      label: "Escalation contact",  type: "text",     required: true,  hint: "Full name of the human who handles refunds" },
    { key: "companyContext",  label: "Company description", type: "textarea", hint: "1–2 sentences about what your company does" },
    { key: "tone",            label: "Tone",                type: "select",   options: ["warm", "formal", "neutral"], default: "warm" },
  ],
}
```

The template files use `{{agentName}}`, `{{tenantName}}`, `{{escalateTo}}`, etc. as tokens.
The deploy API renders each file through a simple `str.replaceAll(key, value)` pass before
writing to disk (no template engine needed for v1).

### 5.3 Initial template catalog (17 templates at launch)

| Category | Templates |
|----------|-----------|
| **Customer Support** | Billing Support Rep, Technical Support Agent, Account Manager |
| **Sales** | SDR (Outbound), Account Executive, Demo Specialist |
| **HR** | Onboarding Specialist, Policy Advisor, Recruiter Assistant |
| **Finance** | Accounts Payable Clerk, Expense Reviewer, Accounts Receivable |
| **Operations** | Procurement Coordinator, Vendor Manager, Logistics Tracker |
| **Engineering** | Code Reviewer, Documentation Writer |

These templates are pre-generated from the Creator agent's research skills (role-research + workspace-generation skills run once offline, output is committed to `sentura/templates/`). They are **not generated at runtime** — they are static files that ship with the platform.

### 5.4 GCP storage for the library

| Data | Where |
|------|-------|
| Template source files | `sentura/templates/` in the repo (version-controlled) |
| `manifest.json5` | Also uploaded to `gs://sentura-workspaces-{project}/templates/manifest.json` as part of `sentura-setup.sh`, so the dashboard can read it without bundling it |
| Deploy count + ratings per template | Cloud SQL `template_stats` table |
| Deployed instances (which tenant deployed which template, when) | Cloud SQL `template_deployments` table |

```sql
CREATE TABLE template_stats (
  template_id   TEXT PRIMARY KEY,
  deploy_count  INT DEFAULT 0,
  avg_rating    NUMERIC(3,2) DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE template_deployments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   TEXT NOT NULL,
  tenant_id     UUID REFERENCES tenants(id),
  agent_id      TEXT,                          -- the deployed agent's namespaced id
  custom_fields JSONB,                         -- values the admin filled in
  deployed_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.5 Dashboard: `/library` route

New route accessible to `tenant_admin`. Layout:

```
┌─────────────────────────────────────────────────────┐
│  Agent Library                    🔍 Search...      │
│                                                     │
│  [All] [Customer Support] [Sales] [HR] [Finance]…  │
│                                                     │
│  ┌───────────────────┐  ┌───────────────────┐       │
│  │ 💳 Billing Support │  │ 📞 Technical Supp │       │
│  │ Rep               │  │ ort Agent         │       │
│  │ Customer Support  │  │ Customer Support  │       │
│  │ ★ 4.8  1,247 dep  │  │ ★ 4.6   983 dep  │       │
│  │ Postgres · REST   │  │ REST              │       │
│  │ [Deploy]          │  │ [Deploy]          │       │
│  └───────────────────┘  └───────────────────┘       │
└─────────────────────────────────────────────────────┘
```

Clicking **Deploy** opens a slide-over panel with the customization form defined by
`template.json5 → fields`. On submit:

1. `POST /api/library/deploy` with `{ templateId, tenantId, fields }`.
2. Server reads the template files from disk.
3. Renders each file (token substitution).
4. Calls `sentura_agents_manage { action: "create_agent" }` with the rendered files.
5. Calls `sentura_agents_manage { action: "register_agent" }`.
6. Increments `template_stats.deploy_count`.
7. Inserts a row into `template_deployments`.
8. Redirects to `/employees` where the new agent appears immediately.

The deploy flow does **not** go through the Creator agent — it is a direct file render + register.
The Creator agent is still available for bespoke builds that don't fit any template.

### 5.6 Creator integration: "Start from template"

When a `tenant_admin` starts a Creator session, the Creator offers: *"Would you like to start
from a template? I can show you what's available and then customize it further."* The Creator's
`research-and-discovery` skill is updated to check the template manifest first and suggest the
closest match before doing a full research pass. If the admin picks a template, Creator skips the
workspace-generation phase and instead calls `sentura_agents_manage { action: "deploy_template" }`
(a new action that wraps the library deploy flow).

---

## 6. GCP Data Layer

All Sentura-owned persistent data moves to Google Cloud. OpenClaw's own runtime state (hot-reload
config, LanceDB memory, session I/O) stays local because it is managed by OpenClaw internals that
we do not modify.

### 6.1 Which GCP service for what

| Data | GCP Service | Why |
|------|------------|-----|
| Users, tenants, agents metadata, connectors config, approvals, sessions metadata, cost records, audit events | **Cloud SQL (PostgreSQL 15)** | Structured, relational, SQL queries, single source of truth. One shared instance, one `sentura` database, schema below. |
| All credentials — connector secrets (DB strings, API keys, tokens), LLM API keys, internal service tokens | **Google Secret Manager** | Built for secrets: versioned, IAM-audited, never written to disk or env files. The only credential store. |
| Agent workspace files (`AGENTS.md`, `SOUL.md`, skills/, etc.) | **Cloud Storage (GCS)** | Durable, shareable if we ever run multiple Sentura instances. Single bucket `sentura-workspaces`, one object per file: `{tenantSlug}/{agentId}/{filename}`. |
| Connector MCP servers | **Cloud Run** | Each connector runs as a managed Cloud Run service instead of a local subprocess. Receives secrets via Secret Manager binding at deploy time. Agents connect via MCP-over-HTTP (StreamableHTTP transport). |

**Not using Firestore** — Cloud SQL covers all data at 2-tenant scale with a cleaner schema.
**Not using BigQuery** — overkill for audit at this stage; revisit when audit table exceeds millions of rows.

---

### 6.2 What stays local (OpenClaw runtime — do not move)

| Local file | Why it stays local |
|------------|-------------------|
| `~/.openclaw/openclaw.json` | OpenClaw reads this at startup and hot-patches it; we cannot redirect it to GCP without modifying OpenClaw core. Sentura seeds it from Cloud SQL on startup via `sentura-setup.sh`. |
| `~/.openclaw/workspace/{agentId}/` | OpenClaw's embedded agent runtime reads workspace files from disk. We **mirror** these to GCS on write (via `sentura-gcp` extension hook) but OpenClaw itself always reads the local copy. |
| LanceDB vector memory files | OpenClaw's `memory-lancedb` extension owns these; they stay local. GCS backup is optional. |
| OpenClaw session state (SQLite) | Managed internally by OpenClaw — no code path to redirect. |

---

### 6.3 Cloud SQL schema

One Cloud SQL instance, one database (`sentura`), all Sentura's structured data.

```sql
-- Tenants (customer companies)
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,      -- 'acme', 'globex'
  name        TEXT NOT NULL,
  gcp_project TEXT,                      -- their GCP project (optional, for future cross-project VPC)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Users (platform_admin + tenant_admin + employer)
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('platform_admin','tenant_admin','employer')),
  user_token   TEXT UNIQUE NOT NULL,     -- token used in OpenClaw session keys
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_token  ON users(user_token);

-- Agents (Sentura metadata mirror of openclaw.json agents.list)
CREATE TABLE agents (
  id             TEXT PRIMARY KEY,       -- e.g. 'acme-billing-rep'
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  role           TEXT,                   -- 'Billing Support Rep'
  model          TEXT,                   -- 'anthropic/claude-sonnet-4-6'
  status         TEXT DEFAULT 'active' CHECK (status IN ('active','paused','retired')),
  workspace_path TEXT,                   -- local path AND GCS prefix
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_agents_tenant ON agents(tenant_id);

-- Connectors (non-sensitive config; secrets live in Secret Manager)
CREATE TABLE connectors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id    TEXT REFERENCES agents(id) ON DELETE SET NULL,  -- NULL = all agents in tenant
  type        TEXT NOT NULL,             -- 'postgres', 'mysql', 'slack', 'github', 'rest-api', 'filesystem'
  name        TEXT NOT NULL,             -- display name set by admin
  config      JSONB DEFAULT '{}',        -- non-sensitive: base URL, DB name, workspace slug, etc.
  secret_name TEXT,                      -- SM resource: 'projects/P/secrets/acme-postgres-url'
  cloud_run_url TEXT,                    -- Cloud Run service URL for this connector (if deployed)
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','disabled','error')),
  health      TEXT DEFAULT 'unknown' CHECK (health IN ('ok','degraded','down','unknown')),
  health_checked_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_connectors_tenant ON connectors(tenant_id);
CREATE INDEX idx_connectors_agent  ON connectors(agent_id);

-- Sessions (metadata only; content/transcripts stay in OpenClaw)
CREATE TABLE sessions (
  session_key  TEXT PRIMARY KEY,
  agent_id     TEXT REFERENCES agents(id),
  user_id      UUID REFERENCES users(id),
  tenant_id    UUID REFERENCES tenants(id),
  label        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_agent  ON sessions(agent_id);
CREATE INDEX idx_sessions_user   ON sessions(user_id);
CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);

-- Approvals (HITL queue)
CREATE TABLE approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  agent_id    TEXT,
  kind        TEXT NOT NULL,             -- 'workspace_edit', 'connector_add', 'provisioning', etc.
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','timeout')),
  payload     JSONB,
  risk_level  TEXT,
  policy_id   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  decided_at  TIMESTAMPTZ,
  decided_by  UUID REFERENCES users(id)
);
CREATE INDEX idx_approvals_tenant ON approvals(tenant_id);
CREATE INDEX idx_approvals_status ON approvals(status);

-- Audit events (replaces sentura-audit local files)
CREATE TABLE audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  agent_id    TEXT,
  user_id     UUID,
  event_type  TEXT NOT NULL,
  severity    TEXT,                      -- 'info', 'warning', 'critical'
  data_tier   TEXT,                      -- 'T0'-'T4'
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant    ON audit_events(tenant_id);
CREATE INDEX idx_audit_created   ON audit_events(created_at DESC);
CREATE INDEX idx_audit_event     ON audit_events(event_type);
-- For free-text search (already supported by sentura-audit):
CREATE INDEX idx_audit_payload_gin ON audit_events USING gin(payload);

-- Cost records (replaces sentura-cost local files)
CREATE TABLE cost_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  agent_id    TEXT,
  user_id     UUID,
  model       TEXT,
  input_tokens  BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  cost_usd    NUMERIC(12,8) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cost_tenant ON cost_records(tenant_id);
CREATE INDEX idx_cost_agent  ON cost_records(agent_id);
CREATE INDEX idx_cost_time   ON cost_records(recorded_at DESC);
```

---

### 6.4 Google Secret Manager — credential naming convention

All secrets are scoped to the GCP project. Naming convention:

```
{tenantSlug}-{connectorType}-{field}

Examples:
  acme-postgres-connection-string
  acme-slack-bot-token
  acme-slack-workspace-id
  acme-github-personal-access-token
  globex-rest-api-key
  globex-rest-api-base-url          ← non-sensitive but stored here for consistency
  sentura-openai-api-key            ← platform-level LLM key (tenant slug = 'sentura')
  sentura-anthropic-api-key
```

The `connectors.secret_name` column in Cloud SQL stores the full resource path
(`projects/{projectId}/secrets/{name}/versions/latest`) so the connector MCP server can fetch
it at startup with one `SecretManagerServiceClient.accessSecretVersion()` call.

**Why Secret Manager instead of `.env` files?**
- No secrets on disk ever.
- IAM-controlled: Cloud Run service accounts get `roles/secretmanager.secretAccessor`; nothing else can read them.
- Automatic versioning + rotation without redeployment.
- Audit trail: every access logged in Cloud Audit Logs.

---

### 6.5 Cloud Storage (GCS) — workspace mirroring

Bucket: `sentura-workspaces-{gcpProjectId}` (one bucket for all tenants, path-based isolation).

Object path: `{tenantSlug}/{agentId}/{relativePath}`

```
acme/billing-rep/AGENTS.md
acme/billing-rep/SOUL.md
acme/billing-rep/TOOLS.md
acme/billing-rep/IDENTITY.md
acme/billing-rep/USER.md
acme/billing-rep/HEARTBEAT.md
acme/billing-rep/BOOTSTRAP.md
acme/billing-rep/MEMORY.md
acme/billing-rep/skills/billing-policy/SKILL.md
```

**Write path** (new `sentura-gcp` extension hook): when `sentura_agents_manage { action: "write" }`
writes a workspace file locally, an `after_tool_call` hook also uploads the file to GCS. This is
async and non-blocking — agent startup is not gated on GCS.

**Read path**: OpenClaw reads local disk only. On a fresh instance (or after a disaster recovery),
`sentura-setup.sh` pulls all workspace files from GCS before starting OpenClaw.

**IAM**: the Sentura Cloud Run service account gets `roles/storage.objectAdmin` on the bucket.
Each tenant's path prefix is enforced by IAM Conditions (`resource.name.startsWith("acme/")`).

---

### 6.6 Cloud Run — connector MCP servers

Instead of running connector MCP servers as local `stdio` subprocesses, each connector runs as a
**Cloud Run service** using MCP's StreamableHTTP transport (SSE + POST). This means:

- **No subprocess management** on the Sentura host.
- **Secrets injected at deploy time** via Cloud Run's Secret Manager binding — the connection
  string is never passed as an argument or env var from the dashboard.
- **Per-tenant, per-connector isolation**: each connector deployment is a separate Cloud Run
  service (`acme-postgres-connector`, `globex-api-connector`).
- **Agent config** uses `mcp.servers.{name}.transport = "http"` and `mcp.servers.{name}.url`
  pointing to the Cloud Run service URL.

```
Agent (OpenClaw embedded runtime)
    │
    │  MCP over HTTP (StreamableHTTP / SSE)
    ▼
Cloud Run: acme-postgres-connector
    │  reads secret at startup:
    │  projects/P/secrets/acme-postgres-connection-string/versions/latest
    ▼
Customer's Cloud SQL (PostgreSQL) or any DB accessible from GCP
```

**Admin flow (updated from §4.3)**:

1. Admin fills credential form on Integrations page.
2. Dashboard API route (`/api/integrations/connect`):
   a. Writes the secret to Secret Manager (`client.createSecret + addSecretVersion`).
   b. Stores the `secret_name` + non-sensitive `config` in the `connectors` Cloud SQL table.
   c. Deploys (or re-deploys) the connector Cloud Run service with the secret binding and the
      tenant-specific service account.
   d. Calls `sentura_agents_manage` to update the agent's `mcp.servers` entry with the Cloud Run
      URL (transport = `"http"`).
3. OpenClaw hot-reloads the agent config; the new MCP tools appear within seconds.

**Cloud Run service template** (one per connector type, parameterized):

```yaml
# cloud-run/postgres-connector.yaml
service: acme-postgres-connector
image: gcr.io/{project}/sentura-postgres-connector:latest
env:
  - name: SENTURA_TENANT_SLUG
    value: acme
  - name: PORT
    value: "8080"
secrets:
  - name: POSTGRES_CONNECTION_STRING
    valueFrom:
      secretKeyRef:
        name: acme-postgres-connection-string
        version: latest
```

---

## 7. Architecture Diagram (Updated)

```
┌───────────────────────────────────────────────────────────────┐
│              SENTURA DASHBOARD (Next.js)                      │
│                                                               │
│  [tenant_admin]                  [employer]                   │
│  /create  /tune  /integrations   /employees  /chat           │
│  /approvals  /audit  /cost                                    │
└──────────────────────┬────────────────────────────────────────┘
                       │ WebSocket JSON-RPC
┌──────────────────────▼────────────────────────────────────────┐
│          OPENCLAW GATEWAY  (local host, single process)       │
│                                                               │
│  Meta-agents:  creator │ tuner                               │
│  Tenant agents: acme-billing-rep │ acme-sales │ globex-bot … │
│                                                               │
│  Extensions: sentura-rbac │ sentura-agents │ sentura-audit    │
│              sentura-approval │ sentura-cost │ sentura-gcp    │
│                        [reads workspace files from local disk]│
└──────┬───────────────────────────────────────────────────────┘
       │ MCP over HTTP (StreamableHTTP)
┌──────▼───────────────────────────────────────────────────────┐
│         CLOUD RUN — CONNECTOR MCP SERVERS                    │
│                                                              │
│  acme-postgres-connector   (secret-injected at deploy)       │
│  acme-slack-connector                                        │
│  globex-api-connector                                        │
└──────┬───────────────────────────────────────────────────────┘
       │ SQL / REST / WebSocket
┌──────▼──────┐   ┌──────────────────────────────────────────┐
│  CUSTOMER   │   │              GOOGLE CLOUD                │
│  SERVICES   │   │                                          │
│  (any infra)│   │  Secret Manager  ← all credentials       │
└─────────────┘   │  Cloud SQL       ← users/tenants/agents  │
                  │                    connectors/audit/cost  │
                  │  Cloud Storage   ← workspace file mirror  │
                  └──────────────────────────────────────────┘
```

---

## 8. What Has Been Built (Inventory)

### 8.1 Meta-agents ✅

| Agent | Skills | Status |
|-------|--------|--------|
| **Creator (Forge)** | agent-config-schema, capability-extraction, employee-deployment, employee-design, incubation, incubation-memory, reflection-loop, research-and-discovery, role-research, self-provisioning, workspace-generation | Built, E2E tested (dashboard deploy path GREEN) |
| **Tuner** | nl-to-config, workspace-edit | Built; live session tested (approval flow verified) |
| **Orchestrator** | task-decomposition, multi-agent-routing | Built; deferred |
| **Data Scavenger** | ingestion, classification, structuring, ekg-merge | Built; deferred |
| **MCP Builder** | api-analysis, mcp-generation, register-server, smoke-test | Built; deferred |

### 8.2 Extensions ✅

| Extension | What it does | GCP migration status |
|-----------|-------------|---------------------|
| `sentura-agents` | In-process agent registration | No change — writes `openclaw.json` locally |
| `sentura-rbac` | 7-role RBAC + tenancy store + middleware | **Migrate**: user/tenant store → Cloud SQL |
| `sentura-approval` | HITL approval workflow | **Migrate**: approval records → Cloud SQL |
| `sentura-audit` | Audit log, T0–T4, 19 event types | **Migrate**: events → Cloud SQL `audit_events` |
| `sentura-cost` | Per-agent LLM spend tracking | **Migrate**: records → Cloud SQL `cost_records` |
| `sentura-memory-lancedb` | LanceDB vector memory by tenantId | No change — stays local |
| `sentura-monitoring` | Gateway/provider health RPCs | No change |
| `sentura-mcp-health` | MCP server health monitor | Update: ping Cloud Run URLs, not stdio PIDs |
| `sentura-experience-extraction` | Experience link extraction | No change; deferred |
| `sentura-provisioner` | Self-provisioning coordinator | No change; deferred |

**New extension needed**: `sentura-gcp` — initializes Google Cloud clients (Cloud SQL pool,
Secret Manager client, GCS client) on plugin startup and exposes them to other extensions via
`api.runtime`. Also provides the GCS workspace-mirror hook.

### 8.3 MCP connector servers ✅ (partial)

| Connector | Tools | GCP migration status |
|-----------|-------|---------------------|
| `gradsale-admin/web/search` | 69 total tools (GradSale test enterprise) | No change — reference only |
| `filesystem` | File read/write/list | Rewrite: Cloud Run + Secret Manager |
| `postgres` | Query/schema tools | Rewrite: Cloud Run + Secret Manager |
| `slack` | Message/channel tools | Rewrite: Cloud Run + Secret Manager |
| `github` | Issues/code tools | Rewrite: Cloud Run + Secret Manager |
| `rest-api` | Generic HTTP tools | **New**: Cloud Run + Secret Manager |

### 8.4 Dashboard (Next.js) ✅

| Route | What it renders | Role gate | GCP impact |
|-------|----------------|-----------|-----------|
| `/` | Login / tenant selector | — | Auth against Cloud SQL `users` table |
| `/employees` | Agent roster | both | Reads Cloud SQL `agents` |
| `/chat` | 1:1 + group chat | both | Session metadata in Cloud SQL |
| `/create` | Creator chat | `tenant_admin` | No direct GCP calls |
| `/tune` | Tuner chat | `tenant_admin` | No direct GCP calls |
| `/integrations` | Connector setup | `tenant_admin` | Writes Secret Manager + Cloud SQL `connectors`; deploys Cloud Run |
| `/approvals` | HITL queue | `tenant_admin` | Reads/writes Cloud SQL `approvals` |
| `/audit` | Audit trail | `tenant_admin` | Reads Cloud SQL `audit_events` |
| `/cost` | Cost center | `tenant_admin` | Reads Cloud SQL `cost_records` |
| `/tenants` | Tenant management | `platform_admin` | **New**: CRUD on Cloud SQL `tenants` + `users` |

### 8.5 Infrastructure ✅

- `scripts/sentura-setup.sh` / `.ps1` — seeds platform_admin, stamps workspaces, injects sandbox policy. **Must add**: GCP project init, Cloud SQL schema apply, GCS bucket create.
- `sentura/lib/tenancy.ts` — tenant resolver (will be updated to read from Cloud SQL).
- `sentura/lib/config-versioning.ts` — config diff log (keep local).
- `sentura/mcp-servers/` — Tier-1 connector templates (will become Cloud Run images).

---

## 9. What Needs to Change

### 9.1 New extension: `sentura-gcp`

**New directory**: `sentura/extensions/sentura-gcp/`

Initializes and exports three GCP clients that all other extensions share:

```ts
// sentura/extensions/sentura-gcp/src/index.ts
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { Storage } from "@google-cloud/storage";
import pg from "pg";

export interface GcpClients {
  sql: pg.Pool;              // Cloud SQL connection pool
  secrets: SecretManagerServiceClient;
  storage: Storage;
  gcpProject: string;
  gcsWorkspaceBucket: string;
}
```

The extension reads config from a top-level `sentura/config/gcp.json5`:

```json5
{
  gcpProject: "sentura-prod",
  cloudSqlConnectionName: "sentura-prod:us-central1:sentura-db",
  cloudSqlDatabase: "sentura",
  gcsWorkspaceBucket: "sentura-workspaces-sentura-prod",
  cloudRunRegion: "us-central1",
}
```

Other extensions import `GcpClients` from `sentura-gcp`'s exported API rather than creating
their own connections.

### 9.2 Migrate `sentura-rbac` storage to Cloud SQL

**Files**: `sentura/extensions/sentura-rbac/src/store.ts` and `tenancy-store.ts`

Current: reads/writes `~/.openclaw/sentura-rbac/users.json` and `agent-tenancy.json`.

After: all reads/writes go through the `sentura-gcp` SQL pool against the `users`, `tenants`,
and `agents` tables. The JSON files become the bootstrap seed only (written once by setup script,
then Cloud SQL is authoritative).

The `middleware.ts` and `authorizer.ts` stay unchanged — they call `store.getUser(token)` which
is now a SQL query instead of a JSON lookup.

### 9.3 Migrate `sentura-audit` to Cloud SQL

**File**: `sentura/extensions/sentura-audit/src/` (store layer)

Current: appends JSON lines to `~/.openclaw/sentura-audit/*.jsonl`.

After: inserts rows into `audit_events` via the shared SQL pool. The `sentura.audit.query` RPC
becomes a SQL query with `WHERE tenant_id = $1 AND ...` filters. The existing free-text search
maps to `payload @> jsonb_build_object(...)` or a GIN index query.

### 9.4 Migrate `sentura-cost` to Cloud SQL

**File**: `sentura/extensions/sentura-cost/src/`

Current: writes JSON files under `~/.openclaw/sentura-cost/`.

After: inserts into `cost_records`. The `sentura.cost.summary` and `sentura.cost.events` RPCs
become SQL aggregation queries (`SUM`, `GROUP BY agent_id`, `GROUP BY tenant_id`, etc.).

### 9.5 Migrate `sentura-approval` to Cloud SQL

**File**: `sentura/extensions/sentura-approval/src/`

Current: approval state is in-memory or file-based.

After: approval records persist in Cloud SQL `approvals` table. `listSenturaApprovals` →
`SELECT * FROM approvals WHERE tenant_id = $1 AND status = 'pending'`.
`decideSenturaApproval` → `UPDATE approvals SET status = $2, decided_at = NOW(), decided_by = $3`.

### 9.6 Update connector MCP servers: stdio → Cloud Run

**Files**: `sentura/mcp-servers/postgres/`, `slack/`, `github/`, `filesystem/`

Each connector server needs three changes:

1. **Use Secret Manager** instead of env vars for credentials:

```ts
// Before: reads env var (set from ~/.openclaw/.env)
const connStr = process.env.POSTGRES_CONNECTION_STRING;

// After: fetches from Secret Manager at startup
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
const client = new SecretManagerServiceClient();
const [version] = await client.accessSecretVersion({ name: process.env.SECRET_NAME });
const connStr = version.payload!.data!.toString();
```

2. **Use StreamableHTTP transport** instead of stdio:

```ts
// After: HTTP server instead of stdio process
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await server.connect(transport);
```

3. **Add a `Dockerfile`** and `cloud-run.yaml` manifest per connector for deployment.

The `mcp.servers` entry in the agent config changes from:
```json5
// Before (stdio subprocess)
{ command: "node", args: ["dist/index.js", "--tenant-slug", "acme"] }
```
to:
```json5
// After (Cloud Run HTTP)
{ transport: "http", url: "https://acme-postgres-connector-xxx-uc.a.run.app/mcp" }
```

### 9.7 Add `sentura-bootstrap` hook: GCS workspace mirror

**File**: `sentura/hooks/sentura-bootstrap/` (existing hook)

After `sentura_agents_manage { action: "write" }` writes a workspace file locally, an async
`after_tool_call` hook uploads the same file to GCS. Non-blocking — a GCS failure does not
fail the agent write. Uses the `sentura-gcp` storage client.

### 9.8 Update dashboard auth: Cloud SQL user lookup

**File**: `sentura/dashboard/src/` (auth layer, login page)

Current: validates token against `~/.openclaw/sentura-rbac/users.json` via a gateway RPC.

After: `POST /api/auth/login` → queries Cloud SQL `users` table by `user_token`; returns the
user row (including `role`, `tenant_id`). JWT or Next-Auth session carries `{ userId, tenantId,
role }` for all subsequent requests.

### 9.9 Update Creator + Tuner: read tenant context from session JWT

**Files**: `sentura/hooks/sentura-bootstrap/` + Creator `BOOTSTRAP.md`

The `tenantSlug` injected into the agent session context comes from the authenticated user's
`tenant_id` (looked up in Cloud SQL), not from a hardcoded config file.

---

## 10. What Needs to Be Added

### 10.1 `sentura-gcp` extension

As described in §8.1. This is the foundation — everything else in §8 depends on it.

**New files**:
- `sentura/extensions/sentura-gcp/src/index.ts` — plugin entry, initializes clients
- `sentura/extensions/sentura-gcp/src/sql.ts` — Cloud SQL pool factory (uses `pg` + Cloud SQL
  Auth Proxy or direct SSL connection)
- `sentura/extensions/sentura-gcp/src/secrets.ts` — Secret Manager helpers (`getSecret`,
  `setSecret`, `listSecrets`)
- `sentura/extensions/sentura-gcp/src/storage.ts` — GCS helpers (`uploadWorkspaceFile`,
  `downloadWorkspaceFile`, `listWorkspaceFiles`)
- `sentura/extensions/sentura-gcp/openclaw.plugin.json`
- `sentura/config/gcp.json5` — GCP project config

### 10.2 Cloud SQL schema migration scripts

**New directory**: `sentura/db/`

```
sentura/db/
├── 001_initial_schema.sql     ← full schema from §5.3
├── 002_seed_roles.sql         ← insert role definitions (for reference)
└── README.md                  ← how to apply with psql or Cloud SQL Studio
```

### 10.3 REST API connector MCP server (Cloud Run)

**New directory**: `sentura/mcp-servers/rest-api/`

Exposes `get`, `post`, `put`, `delete` tools. Reads `BASE_URL` and `AUTH_HEADER` from Secret
Manager. Useful for any customer with a REST API that doesn't have a dedicated connector.

### 10.4 Cloud Run deployment manifests

**New directory**: `sentura/cloud-run/`

One YAML manifest + Dockerfile per connector type:

```
sentura/cloud-run/
├── postgres/
│   ├── Dockerfile
│   └── service.yaml.template  ← parameterized with ${TENANT_SLUG}, ${SECRET_NAME}
├── slack/
│   ├── Dockerfile
│   └── service.yaml.template
├── github/
│   ├── Dockerfile
│   └── service.yaml.template
└── rest-api/
    ├── Dockerfile
    └── service.yaml.template
```

The `/api/integrations/connect` route renders the template with tenant-specific values and calls
`gcloud run deploy` (or the Cloud Run Admin API) to create the service.

### 10.5 Tenant management UI (`/tenants`)

**New route**: `sentura/dashboard/src/app/tenants/`

Platform-admin-only. CRUD:
- Create tenant (name + slug) → inserts into Cloud SQL `tenants`
- Invite user (email + role) → inserts into Cloud SQL `users`, sends invitation email
- View tenant's agents + connectors
- Suspend tenant (sets all agents to `status = 'paused'`)

### 10.6 Employer-facing session flow

**Changes to**: `sentura/dashboard/src/app/employees/page.tsx` and `/chat/page.tsx`

Employers see only their tenant's agents (filtered by `tenant_id` from their JWT). Each card
has a "Start chat" button → `sessions.create` RPC → redirect to `/chat?sessionKey={key}`. No
agent-management controls visible.

### 10.7 Integrations page: full connector setup flow

**File**: `sentura/dashboard/src/app/integrations/page.tsx` + `/api/integrations/connect/route.ts`

The page renders a connector picker. The server route does:
1. Write credential to Secret Manager (`setSecret`).
2. Insert connector row into Cloud SQL `connectors` table.
3. Deploy Cloud Run service with the secret binding (or re-deploy if it already exists).
4. Update agent's `mcp.servers` config via `sentura_agents_manage`.
5. Poll Cloud Run until `status = READY`, then update `connectors.status = 'active'`.

### 10.8 `sentura-setup.sh` GCP bootstrap steps

Add new steps to `scripts/sentura-setup.sh`:

```bash
# Step: Initialize GCP resources (idempotent)
gcloud sql databases create sentura --instance=sentura-db 2>/dev/null || true
psql "$CLOUD_SQL_URL" -f sentura/db/001_initial_schema.sql
gsutil mb -p "$GCP_PROJECT" "gs://sentura-workspaces-$GCP_PROJECT" 2>/dev/null || true
# Seed tenants + platform_admin into Cloud SQL instead of (or alongside) local JSON
```

### 10.9 Agent template library files

**New directory**: `sentura/templates/`

17 pre-built templates (see §5.3 for the full catalog). Each template is a folder with the 8
workspace files, skills, and a `template.json5` metadata + field schema. Files use
`{{placeholder}}` tokens for per-tenant values.

**New route**: `sentura/dashboard/src/app/library/` — browse + deploy UI.

**New API route**: `sentura/dashboard/src/app/api/library/deploy/route.ts` — renders template
tokens, calls `sentura_agents_manage`, records to `template_deployments` Cloud SQL table.

**Two Cloud SQL tables** added to `sentura/db/001_initial_schema.sql`:
- `template_stats` (deploy count + avg rating per template)
- `template_deployments` (who deployed what, when, with which custom fields)

---

## 11. Deferred (Not Now)

| Feature | Why deferred |
|---------|-------------|
| Data Scavenger Agent | EKG pipeline not needed for 2-tenant MVP |
| Orchestrator (Mode B) | Multi-agent decomposition; deferred until core is stable |
| MCP Builder (auto-generate from API docs) | Admin uses pre-built connectors instead |
| Self-provisioning (browser automation) | Manual credential entry is simpler for now |
| SSO / SAML | Not needed for 2 companies — JWT auth is sufficient |
| Experience extraction | Advanced; revisit later |
| Pre-deployment test harness | Deferred until creation flow is solid |
| pgvector / Cloud SQL vector search for LanceDB | LanceDB stays local for now |
| BigQuery audit export | Cloud SQL is sufficient at 2-tenant scale |
| Cloud Memorystore (Redis) session cache | Not needed at this scale |
| Community-submitted templates | After Sentura-curated library is stable |
| Template ratings / user reviews | After deploy count is meaningful |

None of this code needs to be deleted — it just is not wired into the tenant setup flow yet.

---

## 12. Implementation Order

Ordered to unblock each subsequent step. Library work can run in parallel with GCP work from
Step 9 onward since it has no GCP dependency until the deploy API.

| Step | Task | Section | Type | Estimate |
|------|------|---------|------|---------|
| 1 | `sentura-gcp` extension + Cloud SQL schema | §10.1, §10.2 | Add | 2 days |
| 2 | Migrate `sentura-rbac` store to Cloud SQL | §9.2 | Change | 1 day |
| 3 | Migrate `sentura-audit` + `sentura-cost` + `sentura-approval` | §9.3–9.5 | Change | 1.5 days |
| 4 | Add `tenant_admin` + `employer` roles to `sentura-rbac` | §9.2 | Change | 0.5 day |
| 5 | Dashboard auth: Cloud SQL user lookup + JWT | §9.8 | Change | 1 day |
| 6 | Gate dashboard nav by role | §9.8 | Change | 0.5 day |
| 7 | Employer agent-list + start-session flow | §10.6 | Change | 1 day |
| 8 | Creator + Tuner: tenant context from JWT | §9.9 | Change | 0.5 day |
| 9 | **Template library files** (17 templates in `sentura/templates/`) | §5, §10.9 | Add | 3 days |
| 10 | **`/library` dashboard route** (browse + deploy UI) | §5.5, §10.9 | Add | 1.5 days |
| 11 | Connector servers: Secret Manager + StreamableHTTP + Dockerfile | §9.6 | Change | 2 days |
| 12 | REST API connector MCP server (Cloud Run) | §10.3 | Add | 1 day |
| 13 | Cloud Run deployment manifests + deploy script | §10.4 | Add | 1 day |
| 14 | Integrations page: full connector setup flow | §10.7 | Add | 2 days |
| 15 | `sentura-bootstrap` hook: GCS workspace mirror | §9.7 | Change | 0.5 day |
| 16 | Tenant management UI (`/tenants`) | §10.5 | Add | 1 day |
| 17 | Setup script GCP bootstrap steps | §10.8 | Change | 0.5 day |

**Total: ~20 days** for a fully GCP-backed two-tenant platform with the agent library.
