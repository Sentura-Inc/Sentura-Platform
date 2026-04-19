> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Read when the current task touches the specific subsystem this session covered.

# Person D — Enterprise Integration & EKG — Week 1

Sessions that completed Person D's Week 1 scope (industries registry, GradSale enterprise scaffold, Sales Manager employee config, sample data loader) and documented the Enterprise Knowledge Graph (EKG) architecture — the four-pillar document model used by every enterprise workspace.

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-08 | Person D Week 1 Complete |
| 2026-04-08 | Enterprise Knowledge Graph (EKG) Architecture Documentation |

---

### 2026-04-08 — Person D Week 1 Complete

**Summary:** Completed all Person D Week 1 tasks: studied OpenClaw's plugin SDK and approval system, built the `sentura-audit` extension, designed and scaffolded the `sentura-rbac` extension, wrote initial approval policy configs, and studied the GradSale API docs for MCP generation prep.

**What was done:**

1. **OpenClaw Plugin SDK study** — Analyzed `definePluginEntry`, `OpenClawPluginApi`, `api.registerTool()`, `api.on()` typed hooks, `api.registerGatewayMethod()`, and `api.registerHttpRoute()`. Identified key hooks: `before_tool_call`, `after_tool_call`, `session_start`, `session_end`, `message_received`, `message_sent`, `agent_end`, `gateway_start`, `gateway_stop`. Extension entry points follow `openclaw.extensions` in `package.json` pointing to `index.ts`.

2. **OpenClaw Approval System study** — Analyzed `exec.approval.*` and `plugin.approval.*` systems. Learned the `ExecApprovalsFile` structure (version, defaults, per-agent overrides, allowlists), security modes (`deny`/`allowlist`/`full`), ask modes (`off`/`on-miss`/`always`), approval persistence (`~/.openclaw/exec-approvals.json`), and human approval via Unix socket.

3. **sentura-audit extension** — Full implementation with:
   - `package.json`, `openclaw.plugin.json` manifest, `api.ts` barrel
   - `src/types.ts` — Audit event types, severity levels, AuditEntry, AuditConfig, AuditQueryParams
   - `src/redaction.ts` — Configurable PII/secret redaction with regex patterns
   - `src/store.ts` — File-based JSONL audit store with daily rotation, age/size retention, query filtering
   - `src/tool.ts` — `sentura_audit_query` agent-facing tool for querying audit logs
   - `index.ts` — Plugin entry registering all hooks (tool_call, tool_result, session_start/end, message_received/sent, agent_end, gateway_start/stop), gateway RPC methods (`sentura.audit.query`, `sentura.audit.stats`)

4. **RBAC model design** — Created `DESIGN.md` documenting the five-role permission model:
   - **platform_admin**: All scopes, all resources, T0-T4 data access
   - **dept_admin**: read/write/approvals scopes, department-scoped resources, T0-T2
   - **employee_owner**: read/write scopes, owned-employee resources, T0-T1
   - **auditor**: read scope, all resources read-only, T0-T2 (redacted PII)
   - **end_user**: read scope (limited), self-scoped sessions/approvals, T0 only
   - Three-layer authorization: OpenClaw scope → Sentura method policy → resource-level filtering
   - Department hierarchy with inheritance for nested departments

5. **sentura-rbac extension** — Scaffolded with:
   - `package.json`, `openclaw.plugin.json`, `api.ts`
   - `src/types.ts` — SenturaRole, SenturaUser, Department, RbacConfig, AuthorizationResult
   - `src/roles.ts` — Complete role definitions with operator scopes, permissions, data tier access
   - `src/store.ts` — File-based CRUD for users and departments with department hierarchy
   - `src/authorizer.ts` — Method-level authorization with role-permission matching and scope resolution
   - `index.ts` — Plugin entry with gateway RPC methods (roles.list, users.list/get/assign/upsert, departments.list, authorize, scope.employees) and `sentura_rbac_manage` agent tool

6. **Approval policy configs** — Created two files:
   - `sentura/config/approval-policies.json5` — Comprehensive Sentura-layer policy with tool-level policies (high/medium/low risk), action-level policies (self-provisioning, financial, data export, permissions), escalation chain (employee_owner → dept_admin → platform_admin), notification channels, reminder settings
   - `sentura/config/exec-approvals-template.json` — OpenClaw-native exec-approvals template with `security: "full"`, `ask: "always"`, `askFallback: "deny"`

7. **GradSale API study** — Analyzed all ekg/ docs. Identified 40+ admin API endpoints and 30+ web API endpoints. Categorized by MCP tool suitability: admin-scoped (user management, dispute resolution, report handling) vs user-scoped (listings, transactions, messaging). Key insight: separate MCP servers for admin vs user operations, with different approval policies.

**Files created:**
- `sentura/extensions/sentura-audit/package.json`
- `sentura/extensions/sentura-audit/openclaw.plugin.json`
- `sentura/extensions/sentura-audit/api.ts`
- `sentura/extensions/sentura-audit/index.ts`
- `sentura/extensions/sentura-audit/src/types.ts`
- `sentura/extensions/sentura-audit/src/redaction.ts`
- `sentura/extensions/sentura-audit/src/store.ts`
- `sentura/extensions/sentura-audit/src/tool.ts`
- `sentura/extensions/sentura-rbac/package.json`
- `sentura/extensions/sentura-rbac/openclaw.plugin.json`
- `sentura/extensions/sentura-rbac/api.ts`
- `sentura/extensions/sentura-rbac/index.ts`
- `sentura/extensions/sentura-rbac/DESIGN.md`
- `sentura/extensions/sentura-rbac/src/types.ts`
- `sentura/extensions/sentura-rbac/src/roles.ts`
- `sentura/extensions/sentura-rbac/src/store.ts`
- `sentura/extensions/sentura-rbac/src/authorizer.ts`
- `sentura/config/approval-policies.json5`
- `sentura/config/exec-approvals-template.json`

**Files modified:**
- `docs/TeamPlan.md` — Marked all Person D Week 1 tasks as done
- `docs/MEMORY.md` — This entry

**Key decisions:**
- Audit logs use daily JSONL files (not SQLite) for simplicity and grep-ability, with configurable retention by age and size
- RBAC uses file-based JSON storage consistent with OpenClaw's state layer (no external DB)
- Sentura roles map to subsets of OpenClaw's six operator scopes — platform_admin gets all six, end_user gets only operator.read
- Approval policies are layered: OpenClaw's exec.approval handles shell commands, Sentura's policy layer handles tool-level and action-level approvals
- Escalation chain follows role hierarchy: employee_owner → dept_admin → platform_admin, with 15-minute escalation timeout
- GradSale MCP servers should be split: admin-scoped vs user-scoped, each with different approval policies

---


---

### 2026-04-08 — Enterprise Knowledge Graph (EKG) Architecture Documentation

**What was done:**

Implemented the EKG architecture design into the project's source-of-truth documents (README.md and docs/TeamPlan.md). This was a documentation-only update — no implementation code was written. The goal was to lock in the EKG architecture before any team member begins building.

**Architecture decisions documented:**

1. **Hybrid EKG design:** Enterprise knowledge stored as structured JSON5 files in per-agent `ekg/` directories (4 pillars: org/, rules/, assets/, workflows/), auto-indexed by OpenClaw's workspace file scanner and searchable via hybrid FTS + vector search. No graph database required.
2. **Three-tiered data source model:** Tier 1 (Industry Ontology Templates at `sentura/config/industry-ontologies/`), Tier 2 (Client data via Data Scavenger Agent + Q&A-based Completion), Tier 3 (Autonomous Experience Links extracted from daily operations).
3. **Data Scavenger Agent:** New meta-agent at `sentura/agents/data-scavenger/` that processes unstructured documents → classifies into 4 pillars → writes structured JSON5 → additive merge only.
4. **AI Manager EKG:** Orchestrator gets its own `ekg/` with capabilities/, conflicts/, insights/, global-sops/ directories. Three mechanisms: capability abstraction, cross-domain conflict detection, reverse-injection training.
5. **Capability count increased from 14 to 17:** Added #11 (Enterprise Knowledge Graph), #12 (Data Scavenger Agent), #13 (Progressive knowledge accumulation), #17 (Cross-agent knowledge aggregation). Renumbered old #11-14 to #14-16.

**Files modified:**

- `README.md`:
  - Section 1: Capability table expanded from 14 to 17 capabilities (added #11 EKG, #12 Data Scavenger, #13 Progressive accumulation, #17 Cross-agent aggregation; renumbered old #11-14 to #14-16)
  - Section 6: Full rewrite from "From EKG to Knowledge Skills" → "Enterprise Knowledge Graph (EKG)" — 3-tier model, 4-pillar ontology, per-agent `ekg/` directory, Data Scavenger Agent, Q&A-based Completion, Experience Links, industry ontology templates, knowledge source ingestion table
  - Section 10: Expanded memory architecture — added three-tier memory model (static EKG + dynamic LanceDB + live MCP), EKG-memory integration (auto-indexing, hybrid search), dreaming extensions for Experience Link extraction and gap detection
  - Section 12: Expanded multi-agent orchestration — added AI Manager EKG directory structure, Mechanism 1 (capability abstraction), Mechanism 2 (cross-domain conflict detection), Mechanism 3 (reverse-injection training), updated cross-employee knowledge sharing list
  - Section 19: Project structure updated — added `sentura/agents/data-scavenger/`, `sentura/config/industry-ontologies/`, `sentura/skills/qa-completion/`, `sentura/skills/experience-extraction/`, per-agent `ekg/` directory in workspaces, Orchestrator EKG subdirectories

- `docs/TeamPlan.md`:
  - Header: Updated from 13 to 17 capabilities, last synced date to 2026-04-08
  - Capability Coverage Map: Expanded from 14 to 17 rows with new EKG capabilities and sprint week assignments
  - Interface Contracts: Added 7 new contracts (EKG pillar JSON5 schema, Data Scavenger I/O, Experience Link format, Manager capability tag schema, cross-domain conflict resolution protocol, industry ontology template format, updated workspace convention)
  - Week 2 Person A: Workspace creation now includes `ekg/` directory
  - Week 2 Person B: Added EKG pillar JSON5 schema design task, 2 industry ontology template tasks, Creator Agent Phase 2 now creates `ekg/` and merges industry ontology
  - Week 3 Person B: Added Data Scavenger Agent workspace build, Q&A Completion skill design, Experience Link extraction skill design
  - Week 3 Person D: Added bootstrap hook extension to load `ekg/` files into agent context
  - Week 4 Person B: Added Data Scavenger + Knowledge Curator integration tests, Experience Link implementation, Manager capability abstraction (Mechanism 1), pre-deployment test runner now includes `ekg/` files in auto-tune
  - Week 4 Person C: Knowledge Manager UI now includes EKG upload/browse
  - Week 5 Person B: Added Manager cross-domain conflict detection skill (Mechanism 2), reverse-injection training skill (Mechanism 3), 3rd industry ontology template (healthcare)
  - Week 6 Person B: Added E2E tests for full EKG pipeline and Manager EKG aggregation
  - Week 8 All: Updated demo scenarios from 3 to 5 (added EKG data flow demo and Manager training demo)
  - Integration Checkpoints: Updated IC-2 through IC-8 to include EKG verification steps
  - Risk Mitigation: Added 5 new EKG-specific risks (misclassification, false experience patterns, false conflict positives, ontology mismatch, JSON5 file growth)
  - Capability-to-README Traceability: Updated all 17 capabilities with correct README section references
  - All capability number references updated throughout (old #11-14 → new #14-16)

- `docs/MEMORY.md` — This entry

**What's left (implementation, not yet started):**
- Design and implement the EKG pillar JSON5 schema (`sentura/config/ekg-schema.json5`)
- Build industry ontology templates (financial-services, e-commerce, healthcare)
- Build Data Scavenger Agent workspace and skills
- Build Q&A-based Completion and Experience Link extraction skills
- Extend bootstrap hook to load `ekg/` files
- Build Manager EKG mechanisms (capability abstraction, conflict detection, reverse injection)
- Dashboard UI for EKG browsing and document upload

---

