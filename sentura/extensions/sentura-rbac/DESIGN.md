# Sentura RBAC — Design Document

## 1. Overview

Sentura RBAC layers enterprise multi-tenant role-based access control on top of OpenClaw's existing operator-scope system. OpenClaw has two gateway roles (`operator`, `node`) and six operator scopes (`operator.admin`, `operator.read`, `operator.write`, `operator.approvals`, `operator.pairing`, `operator.talk.secrets`). Sentura adds five business roles that map to subsets of these scopes, plus Sentura-specific resource-level access rules (department, employee, data tier).

## 2. Roles

| Role | Description | OpenClaw Scopes Granted |
|------|-------------|-------------------------|
| **platform_admin** | Full platform access. Creates/deletes employees, manages providers, configures approval policies, views all traces. | `operator.admin`, `operator.read`, `operator.write`, `operator.approvals`, `operator.pairing`, `operator.talk.secrets` |
| **dept_admin** | Manages employees within their assigned department(s). Can create employees, view department traces, configure department-level approval policies. | `operator.read`, `operator.write`, `operator.approvals` |
| **employee_owner** | Configures and tunes their assigned AI employees. Can view sessions, modify skills, adjust config for owned employees only. | `operator.read`, `operator.write` |
| **auditor** | Read-only access to audit logs, compliance reports, and trace data. Cannot modify anything. | `operator.read` |
| **end_user** | Interacts with AI employees via channels. Can trigger approval requests and view their own sessions. | `operator.read` (limited to own sessions) |

## 3. Permission Model

Permissions are evaluated in three layers:

### Layer 1: OpenClaw Operator Scope Check
The gateway checks the operator scopes on the connection. Sentura assigns scopes based on the user's role during WebSocket authentication. If the scope check fails, the request is denied before Sentura logic runs.

### Layer 2: Sentura Method-Level Policy
Sentura registers a gateway middleware that intercepts every RPC method call and checks the user's Sentura role against a method-permission map. This catches Sentura-specific methods (`sentura.audit.query`, `sentura.audit.stats`, etc.) and adds finer-grained control to standard OpenClaw methods.

### Layer 3: Resource-Level Filtering
After method-level authorization, resource-level rules scope the results:

| Resource | Scoping Rule |
|----------|-------------|
| **Agents/Employees** | `platform_admin` sees all. `dept_admin` sees department agents. `employee_owner` sees owned agents. `auditor` sees all (read-only). `end_user` sees none via API. |
| **Sessions** | Same hierarchy as agents — can only view sessions of visible agents. |
| **Config** | `platform_admin` can read/write all config. `dept_admin` can read/write department agent config. `employee_owner` can read/write owned agent config. Others read-only or denied. |
| **Audit Logs** | `platform_admin` and `auditor` see all. `dept_admin` sees department events. Others denied. |
| **Approval Policies** | `platform_admin` full access. `dept_admin` read-only for department policies. Others denied. |
| **Secrets** | `platform_admin` only. |

## 4. Sentura Method Permissions

### Standard OpenClaw Methods — Role Mapping

| Method Group | platform_admin | dept_admin | employee_owner | auditor | end_user |
|-------------|:-:|:-:|:-:|:-:|:-:|
| `config.get/set/patch/apply` | full | dept-scoped | owned-scoped | read-only | - |
| `agents.list` | all | dept-scoped | owned-scoped | all (read) | - |
| `agents.create/update/delete` | full | dept-scoped | - | - | - |
| `agents.files.*` | full | dept-scoped | owned-scoped | read-only | - |
| `sessions.*` | full | dept-scoped | owned-scoped | read-only | own-only |
| `cron.*` | full | dept-scoped | owned-scoped | read-only | - |
| `exec.approval.*` | full | dept-scoped | owned-scoped | read-only | resolve-own |
| `secrets.*` | full | - | - | - | - |
| `skills.*` | full | read | read | read | - |
| `models.list` | full | read | read | read | - |
| `tools.*` | full | read | read | read | - |

### Sentura Extension Methods

| Method | platform_admin | dept_admin | employee_owner | auditor | end_user |
|--------|:-:|:-:|:-:|:-:|:-:|
| `sentura.audit.query` | full | dept-scoped | - | full | - |
| `sentura.audit.stats` | full | dept-scoped | - | full | - |
| `sentura.rbac.roles.list` | full | read | read | read | - |
| `sentura.rbac.users.list` | full | dept-scoped | - | read | - |
| `sentura.rbac.users.assign` | full | dept-scoped | - | - | - |
| `sentura.rbac.policies.get` | full | dept-scoped | read | read | - |
| `sentura.rbac.policies.set` | full | - | - | - | - |

## 5. Data Structures

### User Identity

```typescript
interface SenturaUser {
  id: string;                     // Unique user ID (from SSO/IdP)
  email: string;                  // User email
  name: string;                   // Display name
  role: SenturaRole;              // Primary role
  departmentIds: string[];        // Departments this user belongs to (for dept_admin scoping)
  ownedEmployeeIds: string[];     // Employee IDs owned (for employee_owner scoping)
  metadata: Record<string, unknown>;
}

type SenturaRole = "platform_admin" | "dept_admin" | "employee_owner" | "auditor" | "end_user";
```

### Role Definition

```typescript
interface RoleDefinition {
  id: SenturaRole;
  name: string;
  description: string;
  operatorScopes: OperatorScope[];  // OpenClaw scopes granted
  senturaPermissions: SenturaPermission[];
  dataTierAccess: DataTier[];       // T0-T4 tiers this role can access
}
```

### Permission

```typescript
interface SenturaPermission {
  resource: string;     // e.g. "agents", "sessions", "audit", "config", "secrets"
  actions: string[];    // e.g. ["read", "write", "delete", "create"]
  scope: "all" | "department" | "owned" | "self";
}
```

## 6. Department Model

```typescript
interface Department {
  id: string;
  name: string;
  parentId?: string;              // For hierarchical departments
  employeeIds: string[];          // AI employee IDs in this department
  adminUserIds: string[];         // Users with dept_admin role for this department
}
```

Department hierarchy supports inheritance: a dept_admin for a parent department automatically has access to all child department resources.

## 7. Data Tier Access

| Role | T0 (Public) | T1 (Internal) | T2 (Confidential) | T3 (Restricted) | T4 (Critical) |
|------|:-:|:-:|:-:|:-:|:-:|
| platform_admin | Y | Y | Y | Y | Y (via secret store) |
| dept_admin | Y | Y | Y | - | - |
| employee_owner | Y | Y | - | - | - |
| auditor | Y | Y | Y (redacted PII) | - | - |
| end_user | Y | - | - | - | - |

## 8. Authentication Flow

1. User authenticates via SSO/IdP (SAML, OIDC) or local credentials
2. Sentura RBAC extension resolves user identity and role from the auth token
3. During WebSocket handshake, Sentura injects the appropriate OpenClaw operator scopes based on role
4. On each RPC call, the RBAC middleware checks:
   a. OpenClaw scope (already enforced by gateway)
   b. Sentura method-level permission
   c. Resource-level filtering (department/owner scoping)

## 9. Storage

RBAC data is stored in file-based JSON alongside OpenClaw's existing file-based state:

```
~/.openclaw/sentura-rbac/
├── users.json          # User → role assignments
├── departments.json    # Department definitions and membership
├── policies.json       # Custom permission overrides
└── sessions/           # Active auth session tokens
```

## 10. Implementation Plan

1. **Types** (`src/types.ts`) — Role, User, Department, Permission types
2. **Store** (`src/store.ts`) — File-based CRUD for users, departments, policies
3. **Middleware** (`src/middleware.ts`) — Gateway method interceptor for authorization
4. **Resolver** (`src/resolver.ts`) — Resolves user identity from auth context
5. **Tool** (`src/tool.ts`) — `sentura_rbac_manage` tool for agent-driven RBAC queries
6. **Entry** (`index.ts`) — Plugin registration: middleware, tools, gateway methods
