> **On-demand reference — not read by default.** Person C's Week 5 execution plan (2026-05-04 → 2026-05-10). Forward-looking — sessions are appended below as they happen. See [`roadmap.md`](roadmap.md) for the Week 3-8 horizon, [`docs/TeamPlan.md`](../../TeamPlan.md) for cross-team Week 5 deliverables.

# Person C — Dashboard — Week 5 Plan

## Goal of the week

Lock the dashboard's authorization spine (real 7-role RBAC replacing the W3 stub) and ship the `/settings` framework that future weeks fill in. For the four W5 items that hard-depend on other-team backend (audit log schema, employee templates, SSO backend, employee lifecycle API), ship honest skeleton shells using the W4 D5 pattern so the design language is locked, the blocking owners get a cross-team signal, and we don't burn cycles on mock-data UIs that get rewritten when real schemas land.

**Strategic posture (locked with user 2026-04-26):** *self-driven work first, collaborative work later.* W5 has 6 Person C TeamPlan items; only 2 are fully self-driven (RBAC, `/settings` framework). The other 4 (`/audit`, Template Library, SSO login, Employee Lifecycle) are paced by Person A/B/D's W5 backends. We ship the unblocked work first and the blocked work as honest skeletons — same playbook that worked for W4 Phase 3.

## Reality check — TeamPlan W5 vs what Person C can actually do

TeamPlan Week 5 ranks 6 deliverables for Person C, plus 2 W4 carry-overs (`tenant/department selector` + `user-aware session filtering`) still blocked on Person A. = **8 candidate items**. Brutal triage:

| TeamPlan / W4 carry-over | This week? | Why |
|---|---|---|
| Full 7-role RBAC | ✅ Day 2-3 — primary | The W3 `usePermission` stub already exists; W5 swaps the data source from `() => true` to real role lookup. Self-driven if I treat the role itself as injected (env var or query param today; SSO upgrade later) |
| `/settings` framework + non-SSO tabs | ✅ Day 3-4 — primary | Tabs UI + ≥4 tabs that don't need backend (Gateway connection, Approvals policy preview, RBAC roster placeholder, About). SSO tab is a sub-skeleton |
| `/audit` page | ⚠️ Day 5 — skeleton | Blocked on Person D's audit event schema. Ship route + filter UI shell + "awaiting Person D's audit event schema" empty card |
| Employee Template Library | ⚠️ Day 5 — skeleton | Blocked on Person B's 10 role templates. Ship "Start from template" entry inside `/create` + 1 hardcoded preview demonstrating the layout |
| SSO login flow | ⚠️ Day 6 — skeleton | Blocked on Person A's SAML/OIDC backend. Ship "Sign in with SSO" placeholder button on a `/login` route that today just redirects (single-tenant dev mode bypasses login entirely) |
| Employee Lifecycle UI | ⚠️ Day 6 — tab skeleton | Blocked on Person B's lifecycle API. Add a `Lifecycle` tab to `/employees/[id]` with skeleton sections for clone / version history / health score / retire |
| Tenant / department selector (W4 carry) | ⏸ Wait | Still blocked on Person A's multi-tenancy namespace. Re-evaluate end-W5 |
| User-aware session filter (W4 carry) | ⏸ Wait | Still blocked on Person A's `sessions.list { userToken }` filter. Re-evaluate end-W5 |

The reasoning behind "skeleton over mock" stays the same as W4 D5: a mock-data UI that ships looks done; reviewers stop scrutinizing it; when real schemas differ, both UI and tests need rewriting. Honest empty state is also a useful cross-team signal — when Person B reads "awaiting your lifecycle API" on `/employees/[id]`, they know what to ship next.

---

## Phase 1 — Decisions (Day 1, 2026-05-04)

Five decisions to align before code. Recommendations + rationale below; user signs off, decisions log captures the final answer.

### D1 — RBAC enforcement strength — hide vs. block

The dashboard surfaces a lot of actions (delete employee, edit config, create approval, retire). Two ways to enforce permissions:

- **(a) Hard hide** — users without a permission don't see the button / page in the first place. Sidebar nav filtered, action buttons absent, routes 404 if accessed by URL.
- **(b) Soft block** — UI shows everything; clicking an unauthorized action throws a "you don't have permission for X" toast.

**Recommendation: (a) hard hide.** Regulated-industry SOP — what users can't see they can't ask about, so attack surface drops. Also reduces cognitive load (users see a UI tailored to their role). The downside (less discoverable for power users) is acceptable because the platform admin role sees everything.

### D2 — `/audit` query model — server-side vs client-side filter

`/audit` is the searchable trail of every action. Filter by user / agent / date / action / resource. Two paths:

- **(a) Server-side filter** — `audit.search` RPC takes a filter object; gateway returns matching events.
- **(b) Client-side filter** — dashboard fetches a recent N (paginated), filters in browser.

**Recommendation: (a) server-side.** Audit logs grow fast (every tool call, every config change); client-side filter chokes at 1k+ events. (b) is acceptable as a fallback if Person D's audit event schema arrives but query API doesn't (then today we ship "fetch recent 200, filter in browser", and W6 swaps to server query).

### D3 — `/settings` layout — long page vs tabs vs sub-routes

`/settings` will hold ~7 distinct sections (Gateway, RBAC, Scopes, SSO, Approvals, Audit retention, About). Three layouts:

- **(a) Long single page** — Apple-style `<section>` stack with sidebar anchors.
- **(b) Tabs** — top-tab nav, one section visible at a time.
- **(c) Sub-routes** — `/settings/sso`, `/settings/rbac`, etc.

**Recommendation: (b) tabs with hash anchors.** Tabs scan well for 7 categories (long page makes scrolling tedious; sub-routes overkill for 7 small sections). Hash anchors (`/settings#sso`) preserve URL deep-linking from the sidebar without a full route refactor. If a tab grows enormously later (e.g. RBAC roster with hundreds of users), that single tab can split into a sub-route in W6+.

### D4 — Template Library entry — inline `/create` vs separate `/templates`

When B's 10 role templates land, the user starts a new employee from a template. Two entry shapes:

- **(a) Inline in `/create`** — top of `/create` page shows a "Start from template" rail; clicking a template prefills the Creator chat with the template-specific intent ("create an AP clerk for the finance team").
- **(b) Separate `/templates` route** — browse-and-deploy gallery as its own page.

**Recommendation: (a) inline.** "Start from template" is the fast-path entry to the create flow; separating it forces a two-step navigation (`/templates` → `/create`) for what is conceptually one action. The full gallery view (with filters, previews, reviews) can live behind a "Browse all templates" link inside `/create` if needed in W6.

### D5 — Employee Lifecycle UI placement — tab vs separate workflow

Clone / version history / health score / retire are all `/employees/[id]` operations. Two placements:

- **(a) Lifecycle tab on `/employees/[id]`** — a tab alongside Workspace, Bindings, etc.
- **(b) Separate workflow pages** — `/employees/[id]/clone`, `/employees/[id]/versions`, `/employees/[id]/retire`.

**Recommendation: (a) tab on `/employees/[id]`.** All four actions are about the *employee in context*; jumping to a separate URL loses that context (forces a back-button + re-find). Tab + modal for confirmations is the lighter-weight pattern. If retire eventually becomes a multi-step wizard with its own state machine (W7+ polish), that single action can split into a workflow page later.

---

## Phase 2 — RBAC upgrade (Day 2-3, 2026-05-05 → 2026-05-06)

- [ ] **Replace `usePermission` stub with real implementation** — `src/lib/auth/use-permission.ts` reads the connected user's role from a new `useCurrentRole()` hook. Today the role source is a query param (`?as=manager`) for dev parity; W6+ swaps to `sentura-rbac` real lookup once Person D's extension finalizes its RPC surface.
- [ ] **Define the 7-role permission matrix** — `src/lib/auth/roles.ts` exports a `ROLE_PERMISSIONS: Record<Role, Set<PermissionAction>>` map per README §15 (`platform_admin / manager / ekg_manager / agent_manager / auditor / end_user / viewer`). Permissions enumerated explicitly so the matrix doubles as documentation.
- [ ] **Role switcher (dev only)** — small popover on the bottom of the sidebar (only visible if `NEXT_PUBLIC_ENABLE_ROLE_SWITCHER=1`) listing all 7 roles + a "currently as: X" indicator. Lets QA + reviewers preview each role's view without rebuilding.
- [ ] **Apply hard-hide enforcement (per D1) to existing surfaces** — sidebar nav items get `requiresPermission` declarations; right-pane action buttons (delete employee, retire, approve, etc.) check `usePermission` and render null when denied. Routes themselves redirect to `/403` if accessed without permission.
- [ ] **C16 TESTS.md row** — RBAC enforcement: each role sees the documented surface set, permission denial 404/403 properly rather than silent rendering.

**Acceptance:** With `?as=viewer`, sidebar shows only the 4 surfaces a viewer can see (Overview, Employees read-only, Cost, Knowledge — all read-only). Clicking the Delete button on `/employees/[id]` is impossible because the button isn't rendered. With `?as=platform_admin`, all surfaces visible + all actions enabled. Role switching takes effect on next page navigation (no stale render).

## Phase 3 — `/settings` framework + non-blocked tabs (Day 3-4, 2026-05-06 → 2026-05-07)

Per D3 (tabs with hash anchors):

- [ ] **`/settings` page** — `src/app/settings/page.tsx` with a 7-tab nav (Gateway / RBAC / Scopes / SSO / Approvals / Audit retention / About). Active tab driven by `?tab=<name>` URL state (refresh-resilient, deep-linkable from sidebar).
- [ ] **Gateway tab (real)** — read-only display of `client.serverInfo` (gateway version, conn ID, supported methods/events) + the dashboard's own connection state. Useful for debugging today and forever.
- [ ] **Approvals tab (real, view-only)** — read-only display of the active `exec.approval` policies from `client.getConfig()`. "Edit policy" button gated `usePermission("settings.approvals.write")` and disabled until W6 (when Person A ships the policy patch RPC).
- [ ] **About tab (real)** — Sentura version, OpenClaw version, license posture, "report an issue" link. Pure presentational, zero deps.
- [ ] **RBAC tab (skeleton)** — "Awaiting Person D's `sentura-rbac` user/role API (Week 5)" — list 7 roles + permission matrix from Phase 2's `ROLE_PERMISSIONS` (this much we already have client-side); user assignment goes to skeleton.
- [ ] **Scopes tab (skeleton)** — "Awaiting Person A's multi-tenancy namespace convention (Week 5+)"
- [ ] **SSO tab (skeleton)** — "Awaiting Person A's SAML/OIDC backend (Week 5)"
- [ ] **Audit retention tab (skeleton)** — "Awaiting Person D's audit event schema (Week 5)"
- [ ] **Sidebar `Settings` nav** — flip from disabled `W5` badge to enabled link.
- [ ] **C17 TESTS.md row** — `/settings` tabs render, real tabs show real data, skeleton tabs show consistent blocking-owner copy, hash anchor deep-linking works.

**Acceptance:** `/settings` loads, 4 tabs are real (Gateway / Approvals / About) + 4 are skeleton (RBAC / Scopes / SSO / Audit retention). Each skeleton tab names its blocking owner + deliverable consistently with W4 Phase 3 surfaces. Hash anchor `/settings#sso` deep-links to SSO tab on first load.

## Phase 4 — Backend-blocked surface skeletons (Day 5-6, 2026-05-08 → 2026-05-09)

Same playbook as W4 Phase 3 — ship route + sidebar nav + honest empty card. No mock data.

- [ ] **`/audit`** — flip sidebar from `disabled: true, badge: "W5"` to enabled. Route mounts a `<SkeletonShell>` (already exists from W4 Phase 3) blocking on Person D's audit event schema. Stub filter UI (date range / user / action) visible but disabled.
- [ ] **Template Library entry in `/create`** — at the top of `/create/page.tsx`, render a "Start from template" rail with a single hardcoded "Coming soon — Person B's 10 role templates (Week 5)" card. Demonstrates the layout without depending on B's templates being ready.
- [ ] **Employee Lifecycle tab in `/employees/[id]`** — add a "Lifecycle" tab (4th tab alongside Workspace / Bindings / Files). Tab body has 4 collapsed sections (Clone / Version history / Health score / Retire), each with `<SkeletonShell>` inline blocking on Person B's lifecycle API.
- [ ] **`/login` placeholder** — new route mounting "Sign in with SSO" placeholder button + dev-mode "(SSO not yet wired — local dev bypasses auth)" copy. Today the dashboard is single-tenant dev; full SSO redirect lands W6+.
- [ ] **C18 TESTS.md row** — 4 skeleton entries (audit + template entry + lifecycle tab + /login) all render with consistent blocking-owner copy.

**Acceptance:** All 4 surfaces accessible via sidebar / nav. Each skeleton names its blocker explicitly. Zero mock data, zero "lorem ipsum". Each empty card actionable for the blocking owner — they read it and know exactly what schema/API the dashboard is waiting on.

## Phase 5 — Ship + acceptance + retro (Day 7, 2026-05-10)

- [ ] **E2E manual smoke**: switch through 7 roles via dev role-switcher, verify each role sees its expected sidebar set, hits 403 on disallowed routes, sees disabled buttons on partially-allowed pages.
- [ ] **`/settings` smoke**: open each tab, verify hash anchor URL updates, real-tab data loads, skeleton tabs name their blocker.
- [ ] **Cross-team status check**: which of the 4 backend deliverables (audit schema / lifecycle API / SSO backend / templates) actually shipped in their team's W5? Update each skeleton card's "Awaiting" copy to "Shipped — wiring in W6" if appropriate.
- [ ] Append a `## 2026-05-10 — Week 5 ship session` entry to this file documenting what landed, what slipped to Week 6, what backend deliverables actually shipped vs slipped.
- [ ] **TeamPlan W5 Person C checkbox flips** for the 2 done items (RBAC + Settings framework). Skeleton items get `[ ]` with "skeleton shipped — full impl pending [owner]" notes.
- [ ] Update `docs/TESTS.md` Person C count from N/15 to whatever lands (target N/18 if C16-C18 ship).

---

## Open dependencies that might block

| What I need | From | Target | Fallback if late |
|---|---|---|---|
| `sentura-rbac` user/role lookup RPC | Person D | Mid-W5 | Phase 2 ships dev-only `?as=role` switcher; sentura-rbac wires up in W6 |
| Audit event schema | Person D | Mid-W5 | `/audit` stays skeleton; Phase 4 audit ships only filter UI shell |
| SAML/OIDC backend | Person A | End-W5 | `/login` stays placeholder; full SSO redirect waits W6 |
| Multi-tenancy namespace convention | Person A | W5 | `/settings#scopes` stays skeleton; tenant selector deferred to W6 |
| `sessions.list { userToken }` filter | Person A | W5 | User-aware session filter (W4 carry) stays deferred |
| 10 role templates + template metadata schema | Person B | End-W5 | `/create` template rail shows 1 placeholder card naming the dependency |
| Employee lifecycle API (clone / version / health / retire) | Person B | End-W5 | Lifecycle tab stays skeleton with 4 inline `SkeletonShell` blocks |
| Cost tracking event schema (W4 carry) | Person A | W5 | `/cost` stays skeleton from W4 Phase 3 — no Phase 4 wiring this week |
| Orchestrator agent + Manager EKG schema (W4 carry) | Person B | W5 | `/orchestrator` stays skeleton from W4 Phase 3 |
| Data Scavenger output schema (W4 carry) | Person B | W5 | `/knowledge` stays skeleton from W4 Phase 3 |
| Test runner output schema (W4 carry) | Person B | W5 | `/testing` stays skeleton from W4 Phase 3 |

## Risks (Week 5 specifically)

1. **Skeleton fatigue** — by W5 the dashboard has 6+ skeleton surfaces (`/orchestrator` `/knowledge` `/cost` `/testing` from W4 + `/audit` + 4 of the 7 `/settings` tabs from W5). Reviewers may start to question whether C is actually shipping. Mitigation: ship the 2 real W5 deliverables (RBAC + `/settings` framework) on Day 2-4 so reviewers see substantial unblocked work first; phase the skeletons to Day 5-6.
2. **RBAC matrix bikeshedding** — 7 roles × N permissions = a big table. The team will have opinions. Mitigation: ship per the explicit README §15 mapping as ground truth; if a permission isn't documented in §15, default to `platform_admin` only; let edge cases surface during Phase 5 acceptance.
3. **D1 (hard-hide) backfires for QA** — testers can't easily preview "what does manager see". Mitigation: the dev role-switcher (Phase 2) is the explicit QA path; document its toggle in dashboard `README.md`.
4. **Backend slip cascade** — if Person A/B/D all slip their W5 work, W6 has 6+ surfaces still on skeleton. Acceptable for W5 ship; flag in retro if 3+ slip.
5. **Settings tab schema drift** — building real Approvals tab today against current `client.getConfig()` shape; if Person A reshapes the config schema in W6, this tab will need rewriting. Mitigation: keep the Approvals tab read-only + thin (~80 lines max); rewrite cost is bounded.

---

## Decisions log

User signed off all 5 recommendations on **2026-04-26** along with the strategic posture *"self-driven first, blocked work later"*.

### D1 — RBAC enforcement strength — **2026-04-26**

**Decision: (a) hard hide.** Users without a permission don't see the button / page in the first place. Sidebar nav filtered, action buttons absent, routes redirect to `/403` if accessed by URL.

Rationale: regulated-industry SOP — what users can't see they can't ask about, so attack surface drops. Also reduces cognitive load (users see a UI tailored to their role). Downside (less discoverable for power users) acceptable because the `platform_admin` role sees everything. Dev role-switcher (Phase 2) is the explicit preview path for QA.

### D2 — `/audit` query model — **2026-04-26**

**Decision: (a) server-side filter via `audit.search` RPC.** Filter object `{ user, agent, dateRange, action, resource }` shipped to gateway; gateway returns only matching events.

Rationale: audit logs grow fast (every tool call, every config change, every approval). Client-side filter chokes at 1k+ events. Acceptable fallback if Person D's audit event schema arrives but query API doesn't: ship "fetch recent 200 + filter in browser" today, swap to server query in W6 when API ready.

### D3 — `/settings` layout — **2026-04-26**

**Decision: (b) tabs with hash anchors.** Top-tab nav, one section visible at a time. Active tab driven by `?tab=<name>` URL state; hash anchor (`/settings#sso`) deep-link supported from sidebar / docs.

Rationale: 7 sections (Gateway / RBAC / Scopes / SSO / Approvals / Audit retention / About) — long single page makes scrolling tedious; sub-routes overkill for sections this small. Hash anchors give URL deep-linking without route refactor. If a tab grows enormously later (e.g. RBAC roster with hundreds of users), that single tab can split into a sub-route in W6+.

### D4 — Template Library entry — **2026-04-26**

**Decision: (a) inline at the top of `/create`.** Top of `/create/page.tsx` renders a "Start from template" rail. Clicking a template prefills the Creator chat with template-specific intent ("create an AP clerk for the finance team").

Rationale: "Start from template" is the fast-path entry to the create flow. Separate `/templates` route forces a two-step navigation for what is conceptually one action. Full gallery view (filters / previews / reviews) can live behind a "Browse all templates" link inside `/create` if it grows beyond a rail in W6.

### D5 — Employee Lifecycle UI placement — **2026-04-26**

**Decision: (a) `Lifecycle` tab on `/employees/[id]`.** A 4th tab alongside Workspace / Bindings / Files. Tab body has 4 collapsed sections (Clone / Version history / Health score / Retire), each backed by `<SkeletonShell>` until Person B's lifecycle API ships.

Rationale: all four actions are about the *employee in context*; jumping to a separate URL loses that context (forces back-button + re-find). Tab + modal for confirmations is the lighter-weight pattern. If retire eventually becomes a multi-step wizard with its own state machine (W7+ polish), that single action can split into a workflow page later.

### Strategic posture — **2026-04-26** (recorded alongside D1-D5)

**Decision:** *Self-driven work first, collaborative work later.* The two real-data deliverables (RBAC + `/settings` framework) ship Day 2-4. The four backend-blocked deliverables (`/audit` + Template entry + Lifecycle tab + `/login`) ship as honest skeletons Day 5-6.

Rationale: 4 of 6 W5 Person C items hard-depend on Person A/B/D backends. Strategy A (skeleton everything blocked) is safer than Strategy B (mock data) because mock-data UIs that ship look done — reviewers stop scrutinizing them, and when real schemas land different, both UI + tests need rewriting. Strategy C (proactively coordinate schemas with A/B/D in Day 1) was considered but rejected as too coordination-heavy for a 7-day sprint where C can self-drive 2 substantial items already.
