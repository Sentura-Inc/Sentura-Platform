# Sentura RBAC — Design Document

## 1. Overview

Sentura RBAC layers enterprise multi-tenant role-based access control on top of OpenClaw's existing operator-scope system. OpenClaw has two gateway roles (`operator`, `node`) and six operator scopes (`operator.admin`, `operator.read`, `operator.write`, `operator.approvals`, `operator.pairing`, `operator.talk.secrets`). Sentura adds **seven business roles** that map to subsets of these scopes, plus Sentura-specific resource-level access rules (department, employee, data tier).

## 2. Roles (7-role model)

| Role | Description | OpenClaw Scopes Granted |
|------|-------------|-------------------------|
| **platform_admin** | Full platform access. Creates/deletes employees, manages providers, configures approval policies, views all traces. | `operator.admin`, `operator.read`, `operator.write`, `operator.approvals`, `operator.pairing`, `operator.talk.secrets` |
| **manager** | Supervises AI employee actions within a department. Approves/rejects decisions, views department sessions and traces. Scope is SME-wide or per-department. | `operator.read`, `operator.write`, `operator.approvals` |
| **ekg_manager** | Controls the Enterprise Knowledge Graph and MCP catalog. Triggers MCP Builder Agent, manages industry ontologies and knowledge ingestion. Scope is SME-wide. | `operator.read`, `operator.write` |
| **agent_manager** | Creates and tunes AI employees — configures skills, rules, and tools for owned employees. | `operator.read`, `operator.write` |
| **auditor** | Read-only access to audit logs, compliance reports, and trace data. Cannot modify anything. | `operator.read` |
| **end_user** | Interacts with AI employees via channels — identified by `userToken`. Can view their own sessions and resolve their own approvals. | `operator.read` (limited to own sessions) |
| **viewer** | Read-only dashboards for executives/stakeholders — sees aggregate metrics, no session-level access. | `operator.read` |

> `manager` and `ekg_manager` can both be scoped SME-wide or to specific departments via `SenturaUser.departmentIds`. An empty `departmentIds` array for a `manager` means SME-wide.

## 3. Permission Model

Permissions are evaluated in three layers:

### Layer 1: OpenClaw Operator Scope Check
The gateway checks the operator scopes on the connection. Sentura assigns scopes based on the user's role during WebSocket authentication. If the scope check fails, the request is denied before Sentura logic runs.

### Layer 2: Sentura Method-Level Policy
The `Authorizer` evaluates every RPC method call against a method-permission map (`METHOD_POLICIES` in `src/authorizer.ts`). The middleware wrapper (`src/middleware.ts`) composes this check in front of any plugin-registered handler, and the dashboard gates every call via the public `sentura.rbac.authorize` RPC.

### Layer 3: Resource-Level Filtering
After method-level authorization, resource-level rules scope the results:

| Resource | Scoping Rule |
|----------|-------------|
| **Agents/Employees** | `platform_admin` / `auditor` / `viewer` see all. `manager` sees department agents. `ekg_manager` sees all. `agent_manager` sees owned agents. `end_user` sees none via API. |
| **Sessions** | Same hierarchy as agents — can only view sessions of visible agents. `end_user` sees only sessions keyed to its own `userToken`. |
| **Config** | `platform_admin` read/write all. `manager` / `ekg_manager` read dept/all. `agent_manager` read/write owned. `auditor` read-only. `end_user` / `viewer` denied. |
| **Audit Logs** | `platform_admin` / `auditor` / `viewer` see all. `manager` sees department. `ekg_manager` sees SME-wide. Others denied. |
| **Approval Policies** | `platform_admin` full. `manager` resolves department approvals. `agent_manager` resolves owned approvals. Others denied. |
| **EKG** | `platform_admin` / `ekg_manager` full. `manager` / `auditor` / `agent_manager` read-only. `end_user` / `viewer` denied. |
| **MCP Catalog** | `platform_admin` full. `ekg_manager` create/update. Others read-only or denied. |
| **Secrets** | `platform_admin` only. |

## 4. Sentura Method Permissions

### Standard OpenClaw Methods — Role Mapping

| Method Group | platform_admin | manager | ekg_manager | agent_manager | auditor | end_user | viewer |
|-------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `config.get/set/patch/apply` | full | dept-read | SME-read | owned r/w | read-only | - | - |
| `agents.list` | all | dept | all | owned | all (read) | - | all (read) |
| `agents.create/update` | full | - | - | owned | - | - | - |
| `agents.delete` | full | - | - | - | - | - | - |
| `agents.files.*` | full | dept-read | SME-read | owned r/w | read-only | - | - |
| `sessions.*` | full | dept | SME | owned | read-only | own-only | - |
| `cron.*` | full | dept-read | SME-read | owned r/w | read-only | - | - |
| `exec.approval.resolve` | full | dept | - | owned | - | own-only | - |
| `exec.approvals.set` | full | - | - | - | - | - | - |
| `secrets.*` | full | - | - | - | - | - | - |
| `skills.*` | full | read | read | read+install | read | - | - |
| `models.list` / `tools.*` | full | read | read | read | read | - | - |

### Sentura Extension Methods

| Method | platform_admin | manager | ekg_manager | agent_manager | auditor | end_user | viewer |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `sentura.audit.query` | full | dept | SME | - | full | - | SME-agg |
| `sentura.audit.stats` | full | dept | SME | - | full | - | SME-agg |
| `sentura.rbac.users.*` | full | dept-read | SME-read | - | read | - | - |
| `sentura.rbac.departments.*` | full | dept-read | SME-read | - | read | - | read |
| `sentura.rbac.policies.set` | full | - | - | - | - | - | - |
| `sentura.ekg.browse` | full | dept-read | full | owned-read | read | - | - |
| `sentura.ekg.upload/delete` | full | - | full | owned-write | - | - | - |
| `sentura.mcp.list` | full | read | full | read | read | - | - |
| `sentura.mcp.build/configure` | full | - | full | - | - | - | - |

## 5. Data Structures

### User Identity

```typescript
interface SenturaUser {
  id: string;                     // Unique user ID (from SSO/IdP)
  email: string;
  name: string;
  role: SenturaRole;              // One of the 7 roles below
  userToken: string;              // UUID-like token used on channel messages to identify the user
  departmentIds: string[];        // Departments (for manager / ekg_manager / agent_manager scoping)
  ownedEmployeeIds: string[];     // Employee IDs owned (for agent_manager scoping)
  metadata: Record<string, unknown>;
}

type SenturaRole =
  | "platform_admin"
  | "manager"
  | "ekg_manager"
  | "agent_manager"
  | "auditor"
  | "end_user"
  | "viewer";
```

### Role Definition

```typescript
interface RoleDefinition {
  id: SenturaRole;
  name: string;
  description: string;
  operatorScopes: OperatorScope[];
  permissions: SenturaPermission[];
  dataTierAccess: DataTier[];
}
```

### Permission

```typescript
interface SenturaPermission {
  resource: string;
  actions: string[];
  scope: "all" | "department" | "owned" | "self";
}
```

## 6. Department Model

```typescript
interface Department {
  id: string;
  name: string;
  parentId?: string;              // Hierarchical departments
  employeeIds: string[];
  adminUserIds: string[];         // manager-role users assigned to this dept
}
```

Department hierarchy supports inheritance: a `manager` for a parent department automatically has access to all child department resources.

## 7. Data Tier Access

| Role | T0 (Public) | T1 (Internal) | T2 (Confidential) | T3 (Restricted) | T4 (Critical) |
|------|:-:|:-:|:-:|:-:|:-:|
| platform_admin | Y | Y | Y | Y | Y (via secret store) |
| manager | Y | Y | Y | - | - |
| ekg_manager | Y | Y | Y | Y | - |
| agent_manager | Y | Y | - | - | - |
| auditor | Y | Y | Y (redacted PII) | - | - |
| end_user | Y | - | - | - | - |
| viewer | Y | - | - | - | - |

## 8. Authentication Flow

1. User authenticates via SSO/IdP (SAML, OIDC) or local credentials.
2. Sentura RBAC resolves user identity and role from the auth token.
3. Sentura injects the appropriate OpenClaw operator scopes based on role during WebSocket handshake.
4. On each RPC call, the RBAC middleware checks:
   a. OpenClaw scope (gateway-enforced)
   b. Sentura method-level permission (`Authorizer.authorize`)
   c. Resource-level filtering (department / owned / self scoping via `resolveEffectiveScope`)
5. Channel messages carry a `userToken`; Sentura resolves it to a `SenturaUser` via `RbacStore.getUserByToken` before authorizing tool calls.

## 9. Storage

```
~/.openclaw/sentura-rbac/
├── users.json          # User → role assignments (includes userToken)
├── departments.json    # Department definitions and membership
├── policies.json       # Custom permission overrides
└── sessions/           # Active auth session tokens
```

## 10. Implementation Status

| Component | File | Status |
|-----------|------|--------|
| Types | `src/types.ts` | done (7-role model + userToken) |
| Role definitions | `src/roles.ts` | done (7 roles) |
| Store | `src/store.ts` | done (users/departments + token lookup) |
| Authorizer | `src/authorizer.ts` | done (`METHOD_POLICIES` covers OpenClaw + Sentura) |
| Middleware wrapper | `src/middleware.ts` | done (`withRbac` helper for plugin methods) |
| Plugin entry | `index.ts` | done (`sentura.rbac.*` RPCs + `sentura_rbac_manage` tool) |
| Tests | `src/*.test.ts` | done (roles + authorizer, 7-role coverage) |
