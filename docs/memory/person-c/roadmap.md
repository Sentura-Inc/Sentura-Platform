> **On-demand reference — not read by default.** Forward-looking planning document for Person C's Week 3-8 scope. Read when planning cross-team dependencies, dashboard architecture decisions, or UI theme coordination. Session-level completion details live in `week-{1,2,3,...}.md`; this file tracks the plan, not the deliverables.

# Person C — Dashboard Roadmap (Week 3-8)

Multi-week planning document for the remaining Sentura dashboard scope. Week 1-2 delivered the gateway client library, app shell, and five core pages (`/`, `/employees`, `/create`, `/employees/[id]`, `/approvals`) per `docs/TeamPlan.md`. This document organizes the remaining ~15 new UI surfaces by theme (rather than by week) and surfaces decisions that need team input before Week 3 code lands.

## 1. Baseline — what exists today

Delivered in Week 1-2 (full detail in [`week-1.md`](week-1.md), [`week-2.md`](week-2.md)):

| Surface | Scope | Backing RPC |
|---|---|---|
| `/` | Home / overview placeholder | `agents.list`, `health` |
| `/employees` | Employee roster | `agents.list` (incl. meta-agents), `config.bindings` |
| `/create` | Creator chat UI with per-employee conversation sidebar | `sessions.create`, `chat.send`, `chat` events; persistent `sessionKey` per conversation |
| `/employees/[id]` | Employee detail — identity, workspace files (allow-list filtered), channel bindings, lifecycle actions | `agent`, `agents.files.list/get`, `config.bindings`, `agents.delete` |
| `/approvals` | Approval queue — exec + plugin, typed `reason` audit trail | `exec.approval.list/resolve`, `plugin.approval.list/resolve`, live events |

Plus: Gateway WebSocket RPC typed client (`sentura/dashboard/src/lib/gateway/`), shadcn/ui app shell, `useApprovals` hook with event-stream deduplication, and the C1-C10 test matrix in `docs/TESTS.md`.

**Hybrid architecture already in effect:** session viewer, health monitor, and raw-config editor are external links to the OpenClaw Control UI (`/control/` path), not re-implemented in the Sentura dashboard. `/employees/[id]` demonstrates the pattern — files outside the gateway allow-list render an "Edit in Control UI" link rather than surfacing RPC errors.

## 2. Remaining scope — six themes

Week 3-8 deliverables grouped by theme rather than by week, ordered by blocking strength.

### Theme 1 · Communication Panel (capability #16) — largest, spans Week 3-4

**New surface:** `/chat` (two-phase delivery)

Phase 1 (Week 3) — 1:1 chat:

- Two-pane layout (conversation list + thread)
- `sessions.create` against any agent; persistent `sessionKey` per conversation (match the `/create` pattern)
- Streaming via `chat` event `state: "delta"` / `"final"`
- History via `chat.history` on conversation open
- Typing indicator, timestamps, agent attribution
- Add `/chat` link to sidebar

Phase 2 (Week 4) — group chat:

- N underlying OpenClaw sessions (one per participant agent)
- **Sentura-layer fan-out orchestration** (Next.js API route) — receives human message, sends to N agent sessions via `sessions.send`, merges streaming responses into a unified thread
- Group metadata store (Sentura-managed JSON/SQLite) — name, participant list, purpose, underlying session keys
- Demo-aligned "Sentura Approval Center" overlay — aggregates HITL items from group context

**Depends on:** Person A session management helpers (TeamPlan Week 3 § Person A, session.spawn helpers + dashboard session key format).

### Theme 2 · Live Operations (Week 3)

**New surfaces:**

- `/tune` — Tuning Agent NL interface with before/after diffs
- `/integrations` — MCP server manager (Tier 1 open-source list, Tier 2 Sentura-generated status, Tier 3 self-provisioned state)

**Architectural note:** `/tune`, `/create`, and `/orchestrator` are all chat-UI-shaped surfaces against different meta-agents. A shared `<AgentChat>` component abstraction should be defined before `/tune` ships, otherwise three parallel chat implementations will diverge.

### Theme 3 · Knowledge & Governance UIs (Week 4)

**New surfaces:**

- `/orchestrator` — Mode B task decomposition + progress tracking + Manager EKG (capabilities / conflicts / global-sops)
- `/knowledge` — Data Scavenger upload + EKG 4-pillar browser + skill distribution view
- `/cost` — per-employee / per-department / per-time-range LLM spend (backed by Person A's cost tracking extension)
- `/testing` — capability #15 test scorecard (6 dimensions × auto-tune history)

**Open design question (needs Person B input):** EKG 4-pillar JSON5 visualization format is not specified in `docs/DESIGN.md`. Options: tree view per pillar, graph view across pillars, or tab-per-pillar with entity tables. Decision affects `/knowledge` and the `ekg/` panel in `/orchestrator`.

**Open design question (needs Person B input):** `/orchestrator` as a read-only dashboard vs. `/chat` group-chat as interactive AI PM command — clarify whether these are two views of the same thing or separate concerns.

### Theme 4 · Enterprise Governance (Week 5) — cross-cutting RBAC

**New surfaces:**

- `/audit` — searchable / filterable / exportable audit trail with `userToken` attribution
- `/settings` — SSO config + 7-role RBAC management + scope model + global approval policies
- Employee Template Library — embedded in `/create`
- Employee Lifecycle UI — embedded in `/employees/[id]` (version history, clone, health score, retire)

**Cross-cutting: 7-role RBAC frontend landing.** The 7 roles (`platform_admin`, `manager`, `ekg_manager`, `agent_manager`, `auditor`, `end_user`, `viewer`) each require different views on nearly every page:

- `viewer` sees aggregate metrics only (not "page hidden" — content differs)
- `auditor` sees everything read-only
- `manager` / `ekg_manager` scope to SME-wide or per-department
- `agent_manager` scopes to owned agents
- `end_user` sees only own sessions

**Proposed approach:** unified `usePermission(action, { scope })` hook, co-designed with Person D's `sentura-rbac` extension. All new Week 3+ pages should gate UI via this hook from day one — retrofitting at Week 5 is high-risk given 10+ pages will exist by then. Source of truth: `sentura/extensions/sentura-rbac/src/types.ts` and `sentura/extensions/sentura-rbac/DESIGN.md` (scope × method permission matrix).

**SSO login flow:** SAML/OIDC redirect → `userToken` → WebSocket connect → session identity binding. Needs alignment with Person A's `trustedProxy.userHeader` mode (`docs/HOSTING.md` § Auth Modes).

### Theme 5 · Polish & Launch (Week 6-8)

- E2E tests via Playwright (page object pattern)
- Accessibility audit — keyboard nav, screen readers, axe-core
- Cross-browser (Chrome / Firefox / Safari / Edge)
- Mobile-responsive optimization
- Onboarding wizard (first-time setup incl. Control UI URL configuration)
- Demo data setup — GradSale enterprise context visible in `/knowledge`, scripted scenarios per `Documents/Demo.md`
- Export features — conversation, audit log, cost report, test results, EKG snapshot

### Theme 6 · Visual System (continuous, starts Week 3)

Not a separate surface but a horizontal concern:

- Visual tokens (color palette, typography, motion primitives) must support `Documents/Demo.md` scenarios — IAI™ Protocol Dual-MCP (green / blue badges), Compliance Circuit Breaker, "brake cable" cross-screen animation (Demo Mode B scenario 3)
- **Decision:** establish tokens in Week 3, not Week 6-8 polish phase. Polish phase should be "tune existing tokens", not "design visual system under deadline pressure"

## 3. Cross-team dependencies

Ordered by when Person C is blocked:

| What Person C needs | Owner | Target week | Notes |
|---|---|---|---|
| `sessions.create` / group session helpers | A | Week 3 | Chat Panel 1:1 foundation |
| Creator workspace file editor capability | B | Week 3 | `/employees/[id]` inline editing |
| `usePermission` contract + `sentura-rbac` frontend hooks | D | Week 3-4 | **Needed day one of Week 3 as stub**; filled in by Week 5 |
| Data Scavenger upload → EKG JSON5 stream | B | Week 3-4 | `/knowledge` upload flow |
| Cost tracking event schema + aggregate API | A | Week 4 | `/cost` backend |
| `sessions.list` `userToken` filter | A | Week 4 | User-aware session scoping |
| Multi-tenancy namespace convention | A | Week 4 | Tenant selector in `/settings` |
| Test runner output schema (capability #15) | B | Week 4 | `/testing` rendering |
| `sentura.audit.query` + userToken attribution | D | Week 5 | `/audit` backend |
| SSO trusted-proxy config | A | Week 5 | Login flow |

**Person C blocks Person C:** 1:1 chat blocks group chat; state management library selection blocks all Week 3+; `usePermission` adoption pattern blocks audit/settings/lifecycle UIs; visual token system blocks demo polish.

## 4. Key decisions needing team alignment before Week 3 starts

These decisions are cheap to make now, expensive to defer.

1. **State management library** — Zustand / Jotai / TanStack Query / plain `useReducer`. Affects 15+ pages. Recommend Zustand for simplicity given the existing event-stream + RPC patterns don't need React Query's cache invalidation story.

2. **`<AgentChat>` component abstraction** — shared contract between `/create`, `/tune`, `/chat`, `/orchestrator`. Must handle: session lifecycle, streaming delta accumulation, history pagination, typing state, attribution. Must NOT bake in agent-specific behavior (kept in callers).

3. **`usePermission` hook contract** — co-design with Person D. Expected shape:

   ```ts
   usePermission(action: string, context?: { scope?: "sme" | { department: string } }):
     { allowed: boolean; reason?: string }
   ```

   Stub implementation returns `{ allowed: true }` in Week 3; Person D fills in real RBAC lookups by Week 5. All new pages adopt from day one.

4. **Visual token system** — color palette (including IAI Dual-MCP green / blue), typography scale, motion primitives (animation durations + easing), elevation scale. Deliver as Tailwind config extension + tokens file. Demo scenarios in `Documents/Demo.md` are the acceptance surface.

5. **WebSocket event subscription strategy** — 8 event types (`session.message`, `session.tool`, `presence`, `heartbeat`, `cron`, `config.changed`, `approval.pending`, `approval.resolved`, `chat`). Which page subscribes to which? Reconnection backfill strategy? Propose a central `useGatewayEvents(eventTypes[])` hook with per-hook subscription deduplication.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Sandbox double-layer tool-policy filter (DESIGN.md "Round 20 finding") means CLI-passed tests ≠ dashboard-passed tests | All `/chat`-adjacent E2E tests must exercise the dashboard `chat.send` path, never CLI directly |
| State management refactor cost grows exponentially with page count | Library selection decision by Week 3 day 1, not Week 5 mid-implementation |
| Hybrid UI seam (dashboard ↔ Control UI) breaks login state / theme / navigation across topologies | Test single-domain, two-subdomain, local-dev deployments before demo (ref: `docs/HOSTING.md` topology matrix) |
| 7-role RBAC retrofitted at Week 5 across 10+ pages | Adopt `usePermission` stub from Week 3 day 1 — Week 5 becomes "fill in the hook", not "wire it into pages" |
| Demo visual requirements (animations, custom badges) treated as Week 6-8 polish | Establish visual token system Week 3; polish phase tunes existing tokens only |

## 6. Status tracking

This roadmap is an on-demand reference. Actual week-by-week delivery tracked in the `week-N.md` files under this directory and in `docs/TESTS.md` C-series cases. `docs/TeamPlan.md` remains the cross-team sprint source of truth; this roadmap expands Person C's portion with dependencies and decision context.

**Last updated:** 2026-04-23
**Next review:** Start of Week 3 (after A/B/D alignment on § 4 decisions)
