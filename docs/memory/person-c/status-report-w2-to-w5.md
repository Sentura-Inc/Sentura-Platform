> **Person C — Frontend & Dashboard — status report for the 2026-04-26 team sync.** Snapshot of W2 → W5 deliverables shipped, what C is waiting on from A / B / D, and the open questions for the meeting. Source-of-truth for status: `docs/TeamPlan.md` (per-week checklists) + `docs/TESTS.md` (test matrix). This report is the meeting-friendly summary.

# Person C — W2 → W5 Status (2026-04-26)

## TL;DR

W2 + W3 + W4 + W5 Phase 2-3 — **all of Person C's self-driven dashboard work is shipped.** PR #1 has **27 commits** on `person-c` waiting for team review. The dashboard now covers 16 surfaces across 7 sidebar sections, has a real 7-role RBAC layer with hard-hide enforcement, ships honest skeletons for every backend-blocked surface, and includes the dashboard's first server-side code (Group Chat fan-out via SSE).

The remaining W5 work — `/audit`, Employee Template Library, SSO login, Employee Lifecycle UI — is **fully blocked on A/B/D backends**. C ships skeleton placeholders for each in Phase 4 (next session). Beyond that, **everything new C builds in W6+ depends on at least one other team's deliverable shipping first**.

| Week | C self-driven items | Done | Blocked / deferred |
|---|---:|---:|---:|
| W2 | 8 | 8 | 0 |
| W3 | 5 | 5 | 0 |
| W4 | 7 (8 minus the removed Health Monitor) | 5 | 2 (multi-tenancy + userToken filter, both Person A) |
| W5 | 6 | 2 (RBAC + `/settings`) + 4 (skeletons via Phase 4) | 4 full impls all backend-blocked |

## PR #1 status — 27 commits ahead of `main`

https://github.com/Sentura-Inc/Sentura-Platform/pull/1

Top of branch (most recent first):

```
77a4b234  feat(dashboard): /settings 7-tab framework (Week 5 Phase 3)
1c8bacd7  feat(dashboard): real 7-role RBAC + hard-hide enforcement (Week 5 Phase 2)
68e4abe3  feat(dashboard): /chat group fan-out via SSE (Week 4 Phase 4 / capability #16)
f8f92461  feat(dashboard): 4 skeleton shells + sidebar enable (Week 4 Phase 3)
a030091c  feat(dashboard): /integrations MCP server manager (Week 4 Phase 2.2)
7af91863  feat(dashboard): /tune Live Tuning UI + AgentChat remount-on-create bug fix
6af96df7  feat(dashboard): /chat 1:1 conversation surface (Week 3 Phase 3)
9418c016  refactor(dashboard): extract shared <AgentChat> from /create (Week 3 Phase 2 / D2)
... (W3 plan + onboarding bug fixes + W2 surfaces below)
```

Test coverage: **17 of 17 Person C sections in `docs/TESTS.md` PASS** (W4 dev / W5 dev). C16 + C17 added this week.

## Per-week deliverables shipped

### Week 2 — Dashboard foundation (already complete pre-meeting)

| Deliverable | Status | Surface |
|---|---|---|
| Gateway client library + typed RPC wrappers | ✅ | `src/lib/gateway/` |
| React hooks (useGateway, useAgents, useApprovals, useSessions) | ✅ | `src/lib/gateway/hooks.ts` |
| App shell + sidebar + connection status | ✅ | `src/components/{app-shell,sidebar,connection-status}.tsx` |
| Overview page (`/`) | ✅ | `src/app/page.tsx` |
| Employees roster + detail (`/employees`, `/employees/[id]`) | ✅ | `src/app/employees/` |
| Employee Creator chat (`/create`) | ✅ | `src/app/create/` (refactored Week 3 Phase 2 to use shared `<AgentChat>`) |
| Approvals queue (`/approvals`) | ✅ | `src/app/approvals/` |
| Environment config + dashboard build | ✅ | `.env.local` + `pnpm build`/`pnpm lint` clean |

### Week 3 — Self-Provisioning & Live Tuning

| TeamPlan item | Status | Notes |
|---|---|---|
| 1. Wire admin token + missing-token banner + README env contract | ✅ | commit `91dd9581` + `76944958` |
| 2. `/tune` Live Tuning UI | ✅ slipped to W4 Phase 2.1 | commit `7af91863` |
| 3. `/integrations` Integration Manager | ✅ slipped to W4 Phase 2.2 | commit `a030091c` |
| 4. Real-time updates (`useGatewayEvents` primitive) | ✅ | commit `42e98f5e`; first consumer = `useApprovals` (4 events → 1 handler map); `/chat` sidebar badge live-updates via `sessions.changed` |
| 5. `/chat` 1:1 Communication Panel MVP (capability #16) | ✅ | commit `6af96df7` + `3468afcc`; 17 sub-tests in C11; all 4 acceptance criteria verified end-to-end via Playwright |

**Architectural decision shipped this week:** Phase 2 introduced `<AgentChat>` shared component (D2 contract — chat-shaped surfaces don't fork; `/create`, `/chat`, `/tune`, future Group Chat all delegate). `<AgentChat>` exposes imperative `setInput / focus / clearInput` via `forwardRef + useImperativeHandle` so emptyState callbacks (suggestion pills) can prefill the composer.

### Week 4 — Multi-Tenancy, Orchestration & Knowledge Pipeline

| TeamPlan item | Status | Notes |
|---|---|---|
| 1. `/orchestrator` skeleton | ✅ | commit `f8f92461`; per W4 D5 honest empty-state — names Person B's blocker |
| 2. `/knowledge` skeleton | ✅ | commit `f8f92461`; blocks on B's Data Scavenger output schema |
| 3. `/cost` skeleton | ✅ | commit `f8f92461`; blocks on A's cost tracking backend |
| 4. ~~Health Monitor~~ | ➖ removed | Deferred to OpenClaw Control UI `/overview` (linked via sidebar) |
| 5. `/testing` skeleton | ✅ | commit `f8f92461`; blocks on B's test runner output schema |
| 6. Tenant / department selector | ⏸ blocked | A's multi-tenancy namespace convention not shipped |
| 7. User-aware session filtering | ⏸ blocked | A's `sessions.list { userToken }` filter not shipped; per W4 D4 deferred to W5 |
| 8. Group Chat fan-out (capability #16 Phase 2) | ✅ | commit `68e4abe3`; **first server-side code on dashboard** (Next.js Route Handler + SSE per W4 D3) |

**Two non-obvious gotchas hit this week worth flagging to the team:**

1. **AgentChat key prop bug** — adding `key={sessionKey}` to `<AgentChat>` caused React unmount + remount on the `undefined → adopted-key` transition (after first send creates a session). Optimistic user message + streaming placeholder were wiped. Fix: **never** add a `key` prop on AgentChat usage; its internal `prevSessionKeyRef` already handles all transitions correctly. Both `/chat` and `/tune` had this; both fixed.

2. **OpenClaw gateway origin policy** — server-side WebSocket connections (Group Chat fan-out) need an explicit `Origin` header to satisfy `gateway.controlUi.allowedOrigins`. Node's `WebSocket` doesn't send Origin by default. Fix: added `wsFactory` option to `GatewayClient`; server-side wrapper injects `{ headers: { Origin: 'http://localhost:3000' } }` via Node 22+'s non-standard 2nd arg. **Anyone adding new server-side dashboard routes will hit this** — see `src/lib/gateway/server-client.ts` for the pattern.

### Week 5 — Security, SSO & Employee Lifecycle (Phase 2 + 3 done)

| TeamPlan item | Status | Notes |
|---|---|---|
| 1. Full 7-role RBAC | ✅ Phase 2 | commit `1c8bacd7`; per W5 D1 hard-hide; matrix mirrors `sentura-rbac/DESIGN.md § 4`; dev-only role switcher gated by `NEXT_PUBLIC_ENABLE_ROLE_SWITCHER=1`; 8 sub-tests in C16; SSO swap-in surface ready (useCurrentRole signature unchanged when role source flips localStorage→SSO) |
| 2. `/settings` 7-tab framework | ✅ Phase 3 | commit `77a4b234`; per W5 D3 tabs with `?tab=` URL state; 3 real (Gateway / Approvals read-only / About) + 1 hybrid (RBAC matrix + skeleton user-list) + 3 pure skeletons; 9 sub-tests in C17 |
| 3. `/audit` Audit Trail page | ⏸ Phase 4 → skeleton | Blocked on Person D's audit event schema — Phase 4 ships route + sidebar enable + filter UI shell + SkeletonShell |
| 4. Employee Template Library | ⏸ Phase 4 → skeleton | Blocked on Person B's 10 role templates + template metadata schema — Phase 4 ships "Start from template" inline rail in `/create` with placeholder card |
| 5. SSO login flow | ⏸ Phase 4 → placeholder | Blocked on Person A's SAML/OIDC backend — Phase 4 ships `/login` placeholder; full redirect waits W6 |
| 6. Employee Lifecycle UI (clone / version / health / retire) | ⏸ Phase 4 → tab skeleton | Blocked on Person B's lifecycle API — Phase 4 ships Lifecycle tab on `/employees/[id]` with 4 inline `<SkeletonBlock>` sections |

## Cross-team dependencies — what C is waiting on

The next ~10 days of dashboard work are paced by other teams' backends. This is the most important section for the meeting — please confirm whether the targets below are realistic so C can plan Phase 4-5 cadence.

### Person A (Platform & OpenClaw)

| What C needs | Used by | Target | Phase 4-5 fallback if late |
|---|---|---|---|
| Multi-tenancy namespace convention | `/settings#scopes` tab + tenant selector + W4-residual user-aware filter | W5 | Skeleton-only `/settings#scopes`; tenant selector deferred to W6+ |
| `sessions.list { userToken }` filter | User-aware session filtering across `/chat` `/tune` `/create` | W5 (W4 carry-over) | C ignores user scoping; single-tenant view continues |
| SAML/OIDC backend + trusted-proxy auth | `/login` route + `/settings#sso` tab + `useCurrentRole` source swap | End-W5 | `/login` stays placeholder ("(SSO not yet wired — local dev bypasses auth)"); `useCurrentRole` keeps reading localStorage via dev role switcher |
| Cost tracking event schema + aggregate API | `/cost` real impl | W5 (W4 carry-over) | `/cost` stays as skeleton from W4 |
| Approval policy patch RPC | `/settings#approvals` "Edit policy" button (currently disabled W6-deferred) | W6 | Approvals tab stays read-only; clearly labeled "Coming Week 6" |

### Person B (AI Employees & Skills)

| What C needs | Used by | Target | Phase 4-5 fallback if late |
|---|---|---|---|
| Orchestrator agent + Manager EKG schema | `/orchestrator` real impl | End-W5 | `/orchestrator` stays as skeleton from W4 |
| Data Scavenger output schema (document → 4-pillar JSON5) | `/knowledge` real impl | End-W5 | `/knowledge` stays as skeleton from W4 |
| Test runner output schema (capability #15) | `/testing` real impl | End-W5 | `/testing` stays as skeleton from W4 |
| 10 role templates + template metadata schema | Employee Template Library inline rail in `/create` | End-W5 | "Start from template" rail shows 1 placeholder card |
| Employee lifecycle API (clone / version / health / retire) | Lifecycle tab on `/employees/[id]` | End-W5 | Lifecycle tab stays as 4 inline skeleton sections |
| Tuner "pending change" event subtype | `/tune` inline diff panel (per W4 D1 deferred to W6+) | W6+ polish | `/tune` stays chat-only; diff routes through `/approvals` via `exec.approval.requested` |

### Person D (Extensions & Integrations)

| What C needs | Used by | Target | Phase 4-5 fallback if late |
|---|---|---|---|
| Audit event schema | `/audit` page real impl | Mid-W5 | `/audit` ships skeleton + filter UI shell only |
| `sentura-rbac` user / role lookup RPC | `/settings#rbac` user-assignment block + `useCurrentRole` server-side source | Mid-W5 → W6 | Dev role switcher (localStorage + URL) covers QA today; SSO + sentura-rbac swap together in W6 |
| Audit retention policy RPC | `/settings#audit-retention` tab | W5+ | Tab stays as `<SkeletonBlock>` |

### Coordination items (both directions)

- **Phase 4 ship target = next 1-2 working days.** All 4 backend-blocked surfaces ship as skeletons (`/audit`, Template rail, Lifecycle tab, `/login`). After Phase 4, **C cannot meaningfully advance new W5 work without at least one of A/B/D landing real backend.**
- **W4 carry-overs** (tenant selector + user-aware filter) need to either land in W5 or get formally re-deferred to W6. Current week-5.md plan has them as "wait" with no Phase 4 work scheduled.
- **PR #1 review.** 27 commits on `person-c` is a lot. Suggest splitting review into 3 chunks: (a) W3 onboarding-bug-fix tail, (b) W3 + W4 surfaces (`/chat` `/tune` `/integrations` + 4 skeletons + Group Chat), (c) W5 RBAC + `/settings`. Or — easier — review per-commit since each commit is self-contained with a detailed body.

## Open questions for the meeting

1. **A — multi-tenancy timing**. If multi-tenancy namespace + userToken filter slip past W5, do we keep the W4 carry-overs in TeamPlan or formally re-bucket them to W6?
2. **B — template metadata schema**. Even if the 10 templates aren't ready, can B publish the *shape* (TypeScript interface or JSON5 sample) so C can build the inline rail against the real schema? Same question for the lifecycle API.
3. **D — audit event shape**. Same as B above — schema-first would let C build `/audit` filters + result table against the real wire format. The current Phase 4 plan ships filter UI shell + skeleton, which means a rewrite when the real schema lands.
4. **PR #1 review cadence.** 27 commits is review fatigue territory. Should we land it in chunks (3 PRs) or one big review session?
5. **Group Chat MVP scope (capability #16 Phase 2).** Today: human + N AI agents broadcast, server-side fan-out, sender attribution. **Not** today: human invitees beyond the platform admin, group archive UI, participant editing, persisted group transcripts. Do these gaps land in W6 polish or earlier?
6. **Dev role switcher.** `NEXT_PUBLIC_ENABLE_ROLE_SWITCHER=1` is set in C's local `.env.local` (not committed because it has secrets) — should the team setup script (`scripts/sentura-setup.sh`) seed it for QA hosts so reviewers can preview each role without rebuilding?
7. **Lint baseline drift.** Started W3 at 13 errors. Now at 21 (all same `setState-in-effect` pattern, accepted team-wide). Worth a sweep to refactor to `useSyncExternalStore` or accept the new floor?

## Where to find more detail

- Per-week C plans + decisions logs: [`docs/memory/person-c/week-{2,3,4,5}.md`](.)
- Test matrix (1-line per surface) + counts: [`docs/TESTS.md`](../../TESTS.md)
- Detailed sub-test specs: [`docs/tests/tests-person-c.md`](../../tests/tests-person-c.md)
- Roadmap overview (W3-W8 horizon): [`docs/memory/person-c/roadmap.md`](roadmap.md)
- Architecture & 17-capability map: [`docs/DESIGN.md`](../../DESIGN.md)
- Source: [`sentura/dashboard/src/`](../../../sentura/dashboard/src/)

---

*Generated by Person C ahead of the 2026-04-26 team sync. Updates after the meeting land in `docs/memory/person-c/week-5.md` § Decisions log.*
