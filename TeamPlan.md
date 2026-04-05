# Sentura Platform — 8-Week Team Sprint Plan

## Team Roles

| Person | Title | Ownership | Directories |
|--------|-------|-----------|-------------|
| **A** | Platform & OpenClaw Engineer | OpenClaw setup, gateway configuration, deployment, infrastructure | `openclaw/` setup, `docker-compose.yml`, deployment configs, CI/CD |
| **B** | AI Employee & Skills Engineer | Meta-agents (Creator, Tuner, Orchestrator), skills, self-provisioning | `sentura/agents/`, `sentura/skills/`, `workspaces/`, skill templates |
| **C** | Frontend & Dashboard Engineer | Sentura admin dashboard, all UI pages, gateway RPC integration | `sentura/dashboard/`, all UI routes, components, WebSocket client |
| **D** | Extensions & Integrations Engineer | Sentura OpenClaw extensions, MCP integrations, security, observability | `sentura/extensions/`, MCP server configs, approval workflows |

## Interface Contracts (Agreed Day 1)

Before Week 1 coding begins, the team agrees on these shared contracts:

| Contract | Owner | Consumers | Format |
|----------|-------|-----------|--------|
| OpenClaw config schema (agents, channels, MCP) | A | B, C, D | JSON5 + Zod schemas (OpenClaw native) |
| Gateway RPC API surface | A | C (dashboard), B (meta-agents) | WebSocket JSON-RPC (OpenClaw protocol) |
| Agent workspace file structure | B | C (UI display), D (extensions) | SOUL.md, SKILL.md, RULES.md, AGENTS.md convention |
| Creator Agent input/output contract | B | C (UI chat interface) | NL input → agent config + workspace files |
| Tuning Agent input/output contract | B | C (UI tuning panel) | NL tuning request → config.patch diff |
| Sentura extension plugin contract | D | B (agents use extensions), C (UI shows status) | `openclaw.plugin.json` manifest + `definePluginEntry` |
| Approval workflow schema | D | B (agents trigger), C (UI approve/reject) | `exec.approval.*` + `plugin.approval.*` RPC |
| RBAC role definitions | D | C (UI access control), A (gateway auth) | Role → permissions mapping |
| Dashboard ↔ Gateway communication | C + A | C | WebSocket client wrapper with typed RPC calls |
| Self-provisioning skill interface | B | D (extension support) | Skill + browser tool + secrets store flow |

---

## Week 1 — Foundation & OpenClaw Setup

> **Goal**: OpenClaw running as the core runtime. Everyone has a working local environment. Shared conventions established.

### Person A — Platform & OpenClaw Engineer
- [ ] Set up OpenClaw in the repository (submodule or local install)
- [ ] Configure OpenClaw gateway with basic settings (port, auth, state dir)
- [ ] Create `docker-compose.yml` with OpenClaw gateway + supporting services
- [ ] Configure at least 2 LLM providers (one cloud API like Anthropic, one local like Ollama)
- [ ] Configure at least 2 channels (Slack + WebChat) for dev testing
- [ ] Write `.env.example` with all environment variables
- [ ] Set up the project monorepo structure (`sentura/`, `workspaces/`, etc.)
- [ ] Document the OpenClaw Gateway RPC methods the team will use
- [ ] Create `docker-compose.onprem.yml` variant for on-premise deployment

### Person B — AI Employee & Skills Engineer
- [ ] Create the Creator Agent workspace: `sentura/agents/creator/SOUL.md`, skills
- [ ] Write the first version of the Creator Agent's system prompt
- [ ] Design the agent workspace file convention (SOUL.md, SKILL.md, RULES.md structure)
- [ ] Create 3 role templates: `sentura/config/templates/` (AP Clerk, CS Agent, SDR)
- [ ] Write the `self-provisioning` skill: `sentura/skills/self-provisioning/SKILL.md`
- [ ] Write the `knowledge-curation` skill: `sentura/skills/knowledge-curation/SKILL.md`
- [ ] Test manual creation of an AI employee by writing config + workspace files by hand

### Person C — Frontend & Dashboard Engineer
- [ ] Scaffold Sentura dashboard (Next.js 15 + Tailwind + shadcn/ui)
- [ ] Build the Gateway WebSocket RPC client library (typed wrapper around OpenClaw protocol)
- [ ] Create the app shell: sidebar navigation, auth placeholder, layout
- [ ] Build the Employee Roster page (list all agents from `config.get` → `agents.entries`)
- [ ] Build the basic session view (list sessions, show transcript)

### Person D — Extensions & Integrations Engineer
- [ ] Study OpenClaw's plugin SDK thoroughly (`openclaw/plugin-sdk/*`)
- [ ] Scaffold Sentura extension boilerplate: `sentura/extensions/sentura-audit/`
- [ ] Build `sentura-audit` extension: logs all tool calls, approvals, config changes to structured output
- [ ] Study OpenClaw's approval system (`exec.approval.*`, `plugin.approval.*`)
- [ ] Design the RBAC model (Platform Admin, Dept Admin, Employee Owner, Auditor, End User)
- [ ] Write initial approval policy configs (which tools need approval, escalation rules)

---

## Week 2 — AI Employee Creation (V1)

> **Goal**: A human can create an AI employee through the Creator Agent and see it appear in the dashboard.

### Person A — Platform & OpenClaw Engineer
- [ ] Implement automated workspace directory creation (create dirs, write template files)
- [ ] Build a helper script/API that registers a new agent into OpenClaw config via `config.patch`
- [ ] Test hot-reload: adding an agent via `config.patch` makes it immediately available
- [ ] Configure MCP loopback server for tool protocol interop
- [ ] Set up channel binding helpers (programmatically bind agent → channel/peer)

### Person B — AI Employee & Skills Engineer
- [ ] Build Creator Agent Phase 1: Research & Discovery (web search, clarifying questions)
- [ ] Build Creator Agent Phase 2: Design (generate agent config, SOUL.md, SKILL.md, RULES.md)
- [ ] Build Creator Agent Phase 4: Deploy (write workspace, `config.patch`, smoke test)
- [ ] Test end-to-end: describe a role in NL → Creator Agent produces a working AI employee
- [ ] Write 5 more skill templates for common enterprise tasks

### Person C — Frontend & Dashboard Engineer
- [ ] Build the Employee Creator chat UI (talks to Creator Agent via gateway)
- [ ] Build the Employee Detail page (show SOUL.md, skills, rules, channel bindings, config)
- [ ] Build the Session/Conversation viewer with tool call rendering
- [ ] Build the Approval Queue page (list pending approvals, approve/reject)

### Person D — Extensions & Integrations Engineer
- [ ] Build `sentura-rbac` extension: enforce role-based access to gateway RPC methods
- [ ] Implement RBAC middleware: check permissions before every RPC call
- [ ] Configure 3 MCP servers for common enterprise tools (e.g., GitHub, Google Workspace, Jira)
- [ ] Test MCP server integration: AI employee can use MCP tools in conversation
- [ ] Document MCP server configuration patterns for the team

---

## Week 3 — Self-Provisioning & Live Tuning

> **Goal**: AI employees can self-provision new tools. Users can tune employees via NL.

### Person A — Platform & OpenClaw Engineer
- [ ] Build secret store helpers: programmatic write/read of OpenClaw secrets
- [ ] Build MCP server dynamic registration: add MCP server configs via `config.patch`
- [ ] Set up Playwright browser in Docker (for self-provisioning in containers)
- [ ] Implement config versioning: track before/after diffs for every `config.patch`
- [ ] Build deployment documentation for cloud (Docker Compose + Render.yaml)

### Person B — AI Employee & Skills Engineer
- [ ] Build Creator Agent Phase 3: Self-Provisioning (browser-based service registration)
- [ ] Test self-provisioning end-to-end: create employee → needs Zendesk → registers → configures
- [ ] Build Tuning Agent: NL instruction → workspace file edits + config.patch
- [ ] Test Tuning Agent: "make the AP clerk more casual" → SOUL.md updated
- [ ] Create the Orchestrator Agent workspace (Mode B: multi-agent coordination)
- [ ] Write provisioning templates for 5 common SaaS services

### Person C — Frontend & Dashboard Engineer
- [ ] Build the Live Tuning UI (chat with Tuning Agent, show before/after diffs)
- [ ] Build the Integration Manager page (list MCP servers, status, credentials)
- [ ] Build the Employee Editor (edit SOUL.md, RULES.md, skills in the browser)
- [ ] Add real-time updates: WebSocket events for new messages, approvals, config changes

### Person D — Extensions & Integrations Engineer
- [ ] Build `sentura-provisioner` extension: coordinates self-provisioning workflows
- [ ] Implement approval integration for self-provisioning (new accounts need approval)
- [ ] Build `sentura-approval` extension: enhanced HITL with escalation + timeout
- [ ] Configure approval policies: per-tool, per-agent, with escalation chains
- [ ] Test approval flow: AI employee triggers high-risk action → human approves on dashboard

---

## Week 4 — Multi-Agent Orchestration & Enterprise Knowledge

> **Goal**: Mode B (multi-agent) working. Enterprise knowledge integration functional.

### Person A — Platform & OpenClaw Engineer
- [ ] Optimize gateway performance for multiple concurrent AI employees
- [ ] Build monitoring: health endpoints, employee status, provider availability
- [ ] Set up OpenTelemetry via `diagnostics-otel` extension
- [ ] Build Kubernetes Helm chart for enterprise deployment
- [ ] Implement gateway auth hardening (token rotation, rate limiting)

### Person B — AI Employee & Skills Engineer
- [ ] Build Orchestrator Agent: task decomposition, assignment to employees, result synthesis
- [ ] Test Mode B: "Prepare Q4 report" → Orchestrator assigns subtasks to AP Clerk + CS Agent
- [ ] Build Knowledge Curator Agent: ingests documents, generates skill files for employees
- [ ] Test knowledge flow: upload PDF → Knowledge Curator → SKILL.md → employee uses it
- [ ] Build incubation memory: Creator Agent remembers past creations, learns from failures
- [ ] Write reflection loop: Creator monitors new employee, auto-patches issues

### Person C — Frontend & Dashboard Engineer
- [ ] Build the Orchestrator dashboard (task decomposition view, progress tracking)
- [ ] Build the Knowledge Manager UI (upload documents, view generated skills)
- [ ] Build the Cost Center page (LLM usage per employee, per department)
- [ ] Build the Health Monitor (employee uptime, error rates, response latency)

### Person D — Extensions & Integrations Engineer
- [ ] Build comprehensive audit logging (every action, every tool call, searchable)
- [ ] Implement data classification (T0–T4 tiers) in audit extension
- [ ] Configure 5 more MCP servers (email, CRM, HRIS, ticketing, file storage)
- [ ] Build MCP server health monitoring (connection status, error tracking)
- [ ] Write security scanner: detect risky agent configurations

---

## Week 5 — Security Hardening & Enterprise Features

> **Goal**: Enterprise-grade security. SSO integration. Complete RBAC.

### Person A — Platform & OpenClaw Engineer
- [ ] Implement enterprise SSO integration (SAML/OIDC for dashboard auth)
- [ ] Build secret rotation automation (API keys, tokens)
- [ ] Implement backup/restore for OpenClaw state directory
- [ ] Build on-premise deployment documentation (air-gapped, no internet)
- [ ] Load testing: verify platform handles 20+ concurrent AI employees

### Person B — AI Employee & Skills Engineer
- [ ] Build 10 role templates covering common enterprise positions
- [ ] Refine Creator Agent with real-world feedback from testing
- [ ] Build employee cloning: duplicate an employee with modifications
- [ ] Build employee versioning: rollback to previous configuration
- [ ] Refine self-provisioning for 10+ common SaaS services

### Person C — Frontend & Dashboard Engineer
- [ ] Implement full RBAC in dashboard (role-based views, permission enforcement)
- [ ] Build the Audit Trail page (searchable, filterable, exportable)
- [ ] Build the Settings page (provider config, channel config, global policies)
- [ ] Build the Employee Template Library (browse, preview, deploy from template)
- [ ] Implement SSO login flow in dashboard

### Person D — Extensions & Integrations Engineer
- [ ] Security audit: review all extensions for vulnerabilities
- [ ] Implement external channel data boundaries (T0/T1 only on Slack/Teams)
- [ ] Build sandbox enforcement: all AI employees run in sandbox mode
- [ ] Implement credential encryption at rest in secret store
- [ ] Build security event monitoring and alerting

---

## Week 6 — Polish & Integration Testing

> **Goal**: All features integrated. End-to-end flows working reliably.

### Person A — Platform & OpenClaw Engineer
- [ ] E2E test: full employee lifecycle (create → provision → work → tune → delete)
- [ ] E2E test: multi-agent orchestration with real channel communication
- [ ] Performance optimization: memory usage, startup time, response latency
- [ ] Docker image optimization: slim build, fast startup
- [ ] CI/CD pipeline: build, test, deploy automation

### Person B — AI Employee & Skills Engineer
- [ ] E2E test: Creator Agent creates employees for all 10 role templates
- [ ] E2E test: self-provisioning works for all supported services
- [ ] E2E test: Tuning Agent handles diverse tuning requests
- [ ] Polish skill templates based on testing feedback
- [ ] Write the employee onboarding skill (new employee introduces itself)

### Person C — Frontend & Dashboard Engineer
- [ ] E2E test: all dashboard pages with real data
- [ ] UI polish: loading states, error handling, empty states, responsive design
- [ ] Accessibility audit (keyboard nav, screen readers)
- [ ] Build the onboarding wizard (first-time setup experience)
- [ ] Dashboard performance optimization

### Person D — Extensions & Integrations Engineer
- [ ] E2E test: approval flows for all risk categories
- [ ] E2E test: audit logging captures all required events
- [ ] E2E test: RBAC prevents unauthorized access at every level
- [ ] Integration test: MCP servers with real enterprise tools
- [ ] Write security documentation

---

## Week 7 — Documentation & Edge Cases

> **Goal**: Comprehensive documentation. Edge cases handled. Ready for beta.

### Person A — Platform & OpenClaw Engineer
- [ ] Write deployment guide (cloud, on-premise, hybrid)
- [ ] Write admin guide (configuration, monitoring, troubleshooting)
- [ ] Handle edge cases: gateway restart with active sessions, provider failover
- [ ] Build health check dashboard page
- [ ] Final performance benchmarks

### Person B — AI Employee & Skills Engineer
- [ ] Write user guide (creating employees, tuning, orchestration)
- [ ] Handle edge cases: Creator Agent failures, incomplete provisioning, bad user input
- [ ] Build fallback strategies: if self-provisioning fails, graceful degradation
- [ ] Write skill authoring guide (how to write custom SKILL.md files)
- [ ] Final skill template polish

### Person C — Frontend & Dashboard Engineer
- [ ] Write UI component documentation
- [ ] Handle edge cases: offline gateway, long-running operations, concurrent edits
- [ ] Build export features (conversation export, audit log export)
- [ ] Final UI polish and cross-browser testing
- [ ] Mobile-responsive dashboard optimization

### Person D — Extensions & Integrations Engineer
- [ ] Write extension development guide
- [ ] Write MCP server configuration guide
- [ ] Handle edge cases: approval timeout handling, secret rotation during active sessions
- [ ] Final security review and penetration testing
- [ ] Write compliance documentation (data handling, audit capabilities)

---

## Week 8 — Beta Release & Stabilization

> **Goal**: Beta-ready platform. All features stable. Documentation complete.

### All Team Members
- [ ] Full regression testing
- [ ] Fix all critical and high-priority bugs
- [ ] Review and merge all pending PRs
- [ ] Final documentation review
- [ ] Prepare demo scenarios for 3 enterprise use cases
- [ ] Record demo video
- [ ] Tag beta release

### Person A
- [ ] Final deployment pipeline validation (cloud + on-premise)
- [ ] Write release notes
- [ ] Set up monitoring and alerting for beta deployment

### Person B
- [ ] Final Creator Agent testing with diverse role descriptions
- [ ] Validate all role templates work end-to-end
- [ ] Prepare beta feedback collection mechanism

### Person C
- [ ] Final dashboard polish and performance optimization
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Prepare demo dashboard with sample data

### Person D
- [ ] Final security audit
- [ ] Validate all approval and RBAC policies
- [ ] Prepare security whitepaper for enterprise customers

---

## Integration Checkpoints

| Checkpoint | Week | What Gets Tested |
|------------|------|-----------------|
| **IC-1** | End of Week 1 | OpenClaw gateway runs, channels connected, LLM responds |
| **IC-2** | End of Week 2 | Creator Agent produces a working AI employee; visible in dashboard |
| **IC-3** | End of Week 3 | Self-provisioning works; Tuning Agent modifies employees; approvals flow |
| **IC-4** | End of Week 4 | Multi-agent orchestration works; knowledge ingestion functional |
| **IC-5** | End of Week 5 | RBAC enforced; SSO login works; security policies active |
| **IC-6** | End of Week 6 | Full E2E lifecycle tested; all features integrated |
| **IC-7** | End of Week 7 | Documentation complete; edge cases handled |
| **IC-8** | End of Week 8 | Beta release tagged; demo-ready |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| OpenClaw API breaking changes | Pin OpenClaw version; use stable Plugin SDK only |
| Self-provisioning unreliable (websites change) | Graceful degradation + manual provisioning fallback |
| Creator Agent generates poor configs | Human review step before deployment; reflection loop |
| Browser automation blocked by CAPTCHAs | Approval-based manual fallback; enterprise SSO for known services |
| LLM provider outages | Model fallback chains configured in OpenClaw |
| Channel integration complexity | Start with Slack + WebChat; add others incrementally |
| Dashboard performance with many employees | Pagination, virtual scrolling, lazy loading |
