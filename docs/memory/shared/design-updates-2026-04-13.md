> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md).

# Three Major Design Updates — 2026-04-13

Cross-cutting design decisions that reshaped Week 2+ scope for Persons A, B, and D simultaneously:

1. **RBAC redesigned 5 → 7 roles** (Platform Admin, Department Admin, Employee Owner, Auditor, Employee-User, Channel-Guest, Service-Account) — drives Person A's `SenturaUser`/`userToken` work and Person D's RBAC wiring.
2. **Per-user memory isolation** — every user gets a UUID token and `memory/users/MEMORY_USER_{token}.md`; the `sentura-bootstrap` hook injects only that file. Owned by Person A.
3. **MCP Builder meta-agent** — a new Sentura meta-agent that turns natural-language integration requests into MCP server scaffolds. Owned by Person B (joins Creator + Tuner + Orchestrator).

This file is the source for the 7-role RBAC model, the per-user token scheme, and the MCP Builder's initial scope.

---

## 2026-04-13 — Three Major Design Updates: RBAC Redesign, Per-User Memory Isolation, MCP Builder Agent

**What was done:**

Updated `README.md` and `docs/TeamPlan.md` with three major design features based on deep investigation of OpenClaw's memory, MCP, and RBAC subsystems.

### 1. RBAC Redesigned: 5 Roles → 7 Roles

Replaced the original 5-role model (`platform_admin`, `dept_admin`, `employee_owner`, `auditor`, `end_user`) with a 7-role model that separates supervision, knowledge management, and agent engineering:

| New Role | Replaces | Purpose |
|----------|----------|---------|
| `platform_admin` | (unchanged) | Full platform access |
| `manager` | (part of `dept_admin`) | Supervises AI employee actions, approves/rejects decisions |
| `ekg_manager` | (part of `dept_admin`) | Controls Enterprise Knowledge Graph content + triggers MCP Builder |
| `agent_manager` | `employee_owner` | Creates and tunes AI employees (config, skills, rules) |
| `auditor` | (unchanged) | Read-only compliance view |
| `end_user` | (unchanged) | Interacts with AI employees, identified by `userToken` |
| `viewer` | (new) | Read-only dashboards for executives/stakeholders |

Added scope model: SME-wide deployment vs per-department deployment vs multi-department.

### 2. Per-User Memory Isolation

**Critical finding**: OpenClaw's `memory-lancedb` extension is **shared by default** across all agents (single `memories` table with no `agentId` column at `~/.openclaw/memory/lancedb`). `memory-core` (SQLite) is naturally per-agent isolated.

**Two-tier isolation design**:
- **Tier 1 (Agent-level)**: Configure per-agent `dbPath` in `memory-lancedb` plugin config (`~/.openclaw/memory/{agentId}/lancedb`). No OpenClaw core changes — uses existing `api.resolvePath(cfg.dbPath)`.
- **Tier 2 (User-level)**: Add `userToken` metadata field to LanceDB entries. Sentura memory extension wrapper filters on recall (user entries + global entries where `userToken` is null).

**Dual MEMORY.md system**: General `MEMORY.md` at workspace root (shared) + `MEMORY_USER_{token}.md` per user in `memory/users/`. Bootstrap hook extended to inject both.

**Dreaming extensions**: General promotion (cross-user patterns), personal promotion, privacy boundary.

### 3. MCP Builder Agent

Elevated the MCP generation CLI tool (Week 3 Person D) to a **meta-agent** at `sentura/agents/mcp-builder/`:
- Input: OpenAPI specs, markdown API docs, database schemas, raw URLs
- Output: TypeScript MCP server at `sentura/mcp-servers/{name}/` with `index.ts`, `tools/`, `package.json`, `config-snippet.json5`
- Only `ekg_manager` role can trigger it
- Agent can ask clarifying questions about API semantics

**Files modified:**
- `README.md`:
  - Section 1: Updated capability #2 (MCP Builder Agent) and #8 (scope model)
  - Section 3: Added per-user memory note to AI Employee table; updated workspace structure with `memory/users/`; added unified-identity/personalized-memory explanation
  - Section 10: Added LanceDB shared-by-default note; added "Per-User Memory Isolation" subsection (problem, two-tier architecture diagram, 4 mechanisms, dreaming integration)
  - Section 11: Updated observability access control table with 7 roles
  - Section 14: Updated Sentura-generated MCP tier description; added "MCP Builder Agent" subsection with input/output/architecture/access control
  - Section 15: Replaced 5-role RBAC with 7-role table, scope model, role rationale; added "User Token & Identity Isolation" subsection
  - Section 17: Updated dashboard features list with role-based access annotations and added Communication Panel (#12)
  - Section 19: Added `sentura/agents/mcp-builder/`, `sentura/mcp-servers/`, `memory/users/` to project structure; updated bootstrap hook description
- `docs/TeamPlan.md`:
  - Last synced date: 2026-04-13
  - Capability Coverage Map: Updated #2 to include Person B
  - Interface Contracts: Updated RBAC to 7-role model; updated workspace convention to include MEMORY_USER; updated MCP generation contract; added 3 new contracts (user token, per-user memory isolation, MCP Builder Agent I/O)
  - Week 1 Person D: Updated RBAC design task to 7-role model
  - Week 2 Person A: Added per-agent LanceDB `dbPath` isolation + user token infrastructure tasks
  - Week 2 Person B: Added MCP Builder Agent workspace creation; Creator Agent must set `dbPath`
  - Week 2 Person D: Updated RBAC extension for 7 roles
  - Week 3 Person B: Added per-user memory isolation design task (dual MEMORY.md, dreaming extensions)
  - Week 3 Person D: Expanded MCP generation CLI into MCP Builder Agent
  - Week 4 Person A: Added LanceDB user-level metadata partitioning (Sentura memory extension wrapper)
  - Week 4 Person C: Added user-aware session filtering in dashboard
  - Week 5 Person C: Updated for 7-role RBAC
  - Risk Mitigation: Added 4 new risks (user token leakage, memory partition bypass, LanceDB shared-store data leak, MCP Builder insecure code)
- `docs/MEMORY.md` — this entry

**Key architectural decisions:**
1. Per-agent LanceDB isolation via `dbPath` config (no core change) is a prerequisite before user-level isolation
2. `userToken` is the single identity primitive for session isolation, memory partitioning, and audit attribution
3. MCP Builder is an agent (not a script) because API doc analysis requires LLM reasoning
4. `ekg_manager` and `agent_manager` are intentionally separated — knowledge control and agent design are different security domains
5. `viewer` role addresses the executive dashboard need without granting operational access

**Nothing left incomplete.**

**Known issues:** None introduced.

---

