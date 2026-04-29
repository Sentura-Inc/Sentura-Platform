> **On-demand reference — not read by default.** Person C's pre-W6 global QA + bug-fix pass plan. After 29 commits across W2-W5, run a comprehensive sign-off so W6 starts on a known-good base. This doc is the playbook — designed to survive `/compact` and tell fresh-context me exactly what to run + how to triage findings.

# Pre-W6 Global QA Pass — Plan

## Why now

W5 wrapped with 29 commits on `person-c` covering W2 → W5 deliverables (18 surfaces, 7-role RBAC, group chat fan-out, settings framework, 4 W5-Phase-4 skeletons). PR #1 is sizable. Before W6 starts and we begin layering more onto this base, do **one comprehensive sweep** to catch:

- **Functional bugs** — does every surface still work? Does role-based hide/show fire correctly across all 7 roles? Does refresh / multi-tab / disconnect/reconnect behave?
- **Code-quality drift** — 4-day burst of feature work tends to leave dead code, inconsistent patterns, comment rot.
- **Security holes** — first time dashboard has server-side routes (API endpoints), explicit auth role layer, file-based store at `~/.openclaw/`, env-var-driven token. Worth one focused audit.
- **Hidden regressions** — flipping the Settings button from disabled to enabled may have broken its empty-tab state. Hard-hide enforcement may have over-hidden something needed by `viewer` / `auditor`. Worth a sweep.

Goal: **zero open P0/P1 bugs, lint baseline 21 (no new), all tests pass** before opening W6 plan.

## Tracks (3 parallel angles)

Run as 3 independent tracks. Findings collected centrally; fix prioritization uses the triage protocol below.

### Track 1 — Functional QA across all 18 surfaces (use `qa-only` skill)

**Scope**: every dashboard surface listed in `current_work_state.md` § "总览：18 surfaces". Every nav route + every interactive flow.

**Test matrix** (run each as `platform_admin` first, then sample 2-3 other roles via the dev role switcher):

| Surface | Critical flow |
|---|---|
| `/` Overview | Stats load, Quick Actions render correctly per role, AI Employees list loads |
| `/employees` | Roster loads, search, click into detail |
| `/employees/[id]` | All cards render (Configuration / Workspace Files / Bindings / Lifecycle), file tabs switch correctly, Retire dialog opens (admin only), Lifecycle skeleton names blocker |
| `/create` | Conversation list loads, Template rail visible in empty state, hidden during active conversation, NewEmployee → Creator chat works |
| `/chat` 1:1 | Picker dialog → draft mode → first send creates session → URL adopts ?key= → response streams |
| `/chat` Group | New group dialog → 2+ agents → ?groupKey= → fan-out streams from each agent with sender chips |
| `/tune` | Sidebar filtered to tuner sessions, first send creates session, response streams, suggestion pills prefill input |
| `/integrations` | All 3 tabs load with correct empty states + counts |
| `/orchestrator` /knowledge /cost /testing | Skeleton renders, blocker name visible, no console errors |
| `/audit` | Filter shell renders with disabled inputs, SkeletonBlock present, sidebar nav active |
| `/approvals` | Queue renders, action triplet visible to admin / hidden to auditor |
| `/settings` | All 7 tabs accessible, ?tab= URL state works, Gateway tab shows real data, RBAC matrix renders, skeleton tabs name blockers |
| `/login` | Brand mark + disabled SSO button + amber banner all render |
| `/403` | "Access denied" + current role label + "Back to overview" link work |

**Role-based scenarios** (key acceptance per W5 D1):

- `viewer`: sidebar shrinks to ~4 items; Operations section hidden; Quick Action "Create Employee" hidden; direct nav to /create → /403 redirect
- `auditor`: can see /approvals queue but action buttons hidden
- `end_user`: sidebar shows only Chat + Approvals
- `agent_manager`: sees /create + /tune; doesn't see Operations
- Switch back to `platform_admin`: full sidebar restored

**Edge cases to probe**:

- Disconnect gateway (kill `pnpm gateway:watch`), watch banner appear, surfaces gracefully degrade. Reconnect: do they recover?
- Multi-tab independence: open `/chat?key=A` in tab 1, `/chat?key=B` in tab 2 — verify no cross-contamination of streaming events
- Refresh during active stream: does the message land or get lost?
- Empty server state: zero agents, zero sessions, zero approvals — does every surface render its empty state without error?
- Token missing: rename `.env.local` to disable `NEXT_PUBLIC_GATEWAY_TOKEN`, verify MissingTokenBanner appears

**Output**: structured bug report with each finding tagged P0/P1/P2 + repro steps + expected vs actual. Use `qa-only` skill so we get a report **without** the skill auto-fixing — fixes go in Track 4 (consolidated).

### Track 2 — Code review (use `pr-review-toolkit:review-pr` skill)

**Scope**: full diff `merge..person-c` (29 commits, 8000+ LOC). The `pr-review-toolkit:review-pr` skill spawns specialized agents in parallel:

- **code-reviewer** — adherence to project conventions (CLAUDE.md style, naming, structure)
- **silent-failure-hunter** — try/catch swallowing, fallback masking errors, inadequate error handling
- **type-design-analyzer** — type encapsulation + invariant expression for new types (Role, PermissionAction, GroupRecord, etc.)
- **comment-analyzer** — comment accuracy + technical debt vs real code
- **pr-test-analyzer** — test coverage gaps for critical paths (RBAC enforcement, group fan-out partial-failure, AgentChat session transitions)

**Specific things to check** (top-of-mind concerns):

- Server-side gateway client singleton — connection failure recovery, leak under hot reload
- Group fan-out SSE route — does `closeOnce` actually fire on every error path? What happens if gateway disconnects mid-fan-out?
- `usePermission` swap from stub to real — every call site updated correctly?
- Hard-hide effects on tests — anything we hid from one role that admin tests would have caught?
- Comments referring to "Week N" / commit refs — do they age well or rot?
- Lint baseline 21 — are any of those errors actually masking real bugs?

**Output**: prioritized list of code-review findings, same P0/P1/P2 tagging.

### Track 3 — Security audit (use `cso` skill, daily mode)

**Scope**: dashboard server-side surface area + auth boundary.

**Specific concerns**:

- `~/.openclaw/sentura-group-chats/groups.json` — file-based store, any path traversal risk in `groupId` URL param? `getGroup(id)` doesn't validate `id` shape
- `/api/groups/[id]/send` SSE route — auth check (or lack thereof) — server gateway client uses platform admin token regardless of caller role; is that intended?
- Origin header injection — `DASHBOARD_ORIGIN` env can be set to anything; spoof risk?
- LocalStorage role persistence — XSS could elevate to platform_admin in dev. (Acceptable for dev mode? Document.)
- Error responses — do we leak stack traces / file paths in API route 500 responses?
- Token in `NEXT_PUBLIC_*` env vars — these are inlined into client bundles; secret leakage path
- Hard-hide is UI only — any way for a `viewer` to call a mutation RPC by URL-direct + the dashboard not enforcing?

**Output**: security findings, severity-tagged.

## Triage protocol

After all 3 tracks complete, consolidate findings into a single triage list. Tagging:

- **P0 (blocker)** — broken happy path, security hole with attack path, data loss. Fix immediately, ship hotfix commit before continuing
- **P1 (must-fix-before-W6)** — degraded UX, logic bug under reproducible conditions, lint regression, code-review finding the reviewer rated high-confidence. Bundle into the W5-cleanup wrap commit
- **P2 (nice-to-have)** — polish, low-confidence finding, minor inconsistency, optimization opportunity. Document in this file's "deferred" section, revisit during W6 polish

Skip-criteria — these are NOT bugs:

- Lint warnings about markdown table style in `docs/` — pre-existing project pattern
- The 21 known set-state-in-effect errors — accepted team-wide
- Skeleton surfaces missing real data — that's the deliberate W4 D5 / W5 D5 design
- "Edit policy" / Retire / SSO buttons disabled — deliberate W6+ deferrals

## Track 4 — Fix pass (after triage)

**Single commit covers all P0 + P1 fixes.** Per the new commit-cadence policy (memory: `commit_cadence.md`), the entire QA pass = 1 commit titled approximately:

```
chore(dashboard): pre-W6 QA pass — fix N findings, baseline clean
```

Body lists each fix with finding origin (Track 1/2/3) + before/after.

P0 hotfixes during the pass = separate commits as needed (don't wait for the wrap if they unblock testing).

P2 findings = appended to this doc's "Deferred to W6 polish" section, NOT committed today.

## Exit criteria — what "done" looks like

Sign-off when ALL of:

1. ✅ Every surface in the W5 18-surface inventory loads + key flow works for `platform_admin` (Track 1)
2. ✅ At least 3 non-admin roles tested end-to-end with no surprise visibility (Track 1)
3. ✅ Edge cases (disconnect/reconnect, multi-tab, refresh, missing token) handled (Track 1)
4. ✅ `pr-review-toolkit:review-pr` finished, all P0/P1 findings closed (Track 2)
5. ✅ `cso` audit clean of HIGH severity findings (Track 3)
6. ✅ Type-check clean (`npx tsc --noEmit` zero errors)
7. ✅ Lint stable at ≤ 21 errors (no regression)
8. ✅ All Phase 4 verification screenshots still visually correct after fixes
9. ✅ This doc's "Deferred to W6 polish" section captures every P2 not fixed

## Estimated time

- Track 1 (functional QA, 18 surfaces × ~7 roles × edge cases): 30-45 min via `qa-only` skill
- Track 2 (code review via pr-review-toolkit): 15-25 min (parallel agents)
- Track 3 (security audit): 15-20 min via `cso` daily mode
- Track 4 (fix pass): 30-90 min depending on findings count and severity
- **Total: ~2-3 hours of focused work**

If P0 found in Track 1, time balloons — that's the point. Better to find them now than during W6.

## Recovery instructions for fresh-context me (post-/compact)

1. **Read `current_work_state.md`** first to know the W5-wrap state
2. **Read THIS doc** for the QA pass plan
3. **Verify services**:
   ```bash
   curl http://localhost:18789/healthz
   curl http://localhost:3000/
   ```
4. **Verify the 4 meta-agent sandbox.mode = off** (Python snippet in `current_work_state.md`)
5. **Run Track 1**: invoke `qa-only` skill with the test matrix above + "exhaustive" tier
6. **Run Track 2 in parallel**: invoke `pr-review-toolkit:review-pr` skill against `merge..person-c`
7. **Run Track 3**: invoke `cso` skill in daily mode targeted at `sentura/dashboard/`
8. **Triage** findings via the protocol above
9. **Fix pass**: implement P0 + P1 fixes, batch into one commit per new cadence
10. **Append** P2 findings to "Deferred to W6 polish" section below
11. **Commit + push** the QA-pass wrap commit
12. **Update `current_work_state.md`** with the new state ("QA pass closed, ready for W6")
13. **Confirm with user** before kicking off W6 plan

## Deferred to W6 polish (P2 findings appended here, not in commit)

QA pass closed 2026-04-30. **3 P0 + 11 P1 fixed in single wrap commit**. P2s below are not blocking W6; revisit during W6 polish phase.

### Code-quality polish

- **F2.11** `Role` / `PermissionAction` encapsulation — wrap permission Sets in `Object.freeze`; derive `ALL_ACTIONS` from a single source instead of duplicating between `roles.ts` and `rbac-tab.tsx`; add build-time assertion that every PermissionAction appears in at least one role.
- **F2.12** `GroupRecord` invariants — tuple type `[string, string, ...string[]]` for compile-time min-length=2; block writes to archived groups at the lib level not just route. (Mutex already added; archive-write guard added in this pass partially.)
- **F2.13** SSE frame discriminated union — extract `Started | Delta | Final | AgentError | Done` to a shared `lib/groups/sse-frames.ts`; both producer and consumer import. Today producer uses `Record<string, unknown>` and consumer uses an interface with all-optional fields.
- **F2.14** "Week N" comments age poorly — ~20+ comments tie behavior to specific sprint weeks. Drop the "Week N" prefix from current-behavior comments; keep only the design rationale.
- **F2.15** `formatRelativeTime` duplicated across 4+ surfaces — extract to `@/lib/format/relative-time.ts` with `style: "short" | "long"` option.
- **F2.16** `useApprovals` cancelled-after-await tightening — recheck `cancelled` between `await` and `setData`. Today benign (React 19 just warns) but worth fixing.
- **F2.17** `useGatewayEvents` typeKey `|` separator — defensive concern, no current collision since all event types are dotted strings. Switch to `\x00` or `JSON.stringify`.
- **F2.18** Deletion rationale missing in commit bodies — note for next PR cycle: include "removed because…" lines in commit bodies for file deletions.

### Test debt (largest open item)

- **F2.9** Zero tests for ~4600 LOC of W4-W5 dashboard work. Pre-W6 minimum: Vitest + React Testing Library scaffolding; cover hasPermission matrix correctness (7 roles × 11 actions), sidebar role filtering, RequirePermission redirect, SSE frame parser, group-store concurrent write, server-side auth check on /api/groups/*. **Defer to W6 Phase 1.**

### UX polish

- **F1.13** Viewer sidebar over-shows — currently shows Cost Center / Audit Trail / Orchestrator / Testing (6 items, plan said ~4). Either tighten Viewer permission set in `roles.ts` (probably the right call — Audit Trail belongs to Auditor) or add explicit per-link role gating. Discuss with team for source-of-truth alignment.
- **F1.14** `/403` text misleading on direct nav — when a Platform Admin types `/403`, page reads "The Platform Admin role doesn't have permission…". Detect direct nav (no `from` query param) and show a generic "This page is shown when access is denied. Your current role is X." message instead.

### Multi-tenancy forward-compat

- **S3.5** `GroupRecord` lacks `tenantId` / `createdByActorId` — Person A's W4 deferral. Cheap to add the fields now (forward-compat); enforcement waits for sentura-rbac RPC + multi-tenant deploy. **Action**: in W6 add the optional fields + a runtime assertion that fails when `process.env.SENTURA_MULTI_TENANT === "1"` is set but no tenant context is threaded through.
- **S3.7** SSE rate limit per actor — waits for SSO/actorId; add token-bucket or sliding-window in W6 once `getServerRole` returns a real identity instead of dev cookie.
- **S3.6** `DASHBOARD_ORIGIN` doc — comment in code is misleading ("Match the Origin the browser-side dashboard uses" — server is impersonating browser). Rewrite + add CI/setup check that gateway's `allowedOrigins` doesn't contain `*` in non-dev profiles.
- **S3.3** localStorage role no integrity check — auto-mitigated by server-side cookie auth landing in this pass. Doc comment added; nothing further until SSO replaces the cookie with a signed session.
- **S3.8** No unsafe-HTML render sinks today — verified absent. **Re-audit when markdown renderer ships** (use `react-markdown` with explicit allowlist; no `rehype-raw`).

### Cross-team handoffs (not Person C territory)

- **F1.11** `/employees/[id]` shows 7 of 8 workspace files — `BOOTSTRAP.md` hidden by OpenClaw's `agents.files.list` RPC after workspace setup completes (`openclaw/src/gateway/server-methods/agents.ts:684-690`). File is on disk; only the tab is suppressed. Sentura's 8-file convention vs OpenClaw's hide-after-setup design is a cross-team policy question. **Action**: discuss with Person A whether to (a) request OpenClaw upstream remove the hide, (b) add a Sentura-side switch in gateway config, or (c) accept and update Sentura docs to say "8 files during setup, 7 visible after". Dashboard footnote added in this pass to set user expectation.

---

## Decisions locked (2026-04-30 — user signed off all 5 recommendations)

1. **PR title + description refresh** — DO refresh as part of this QA pass. Current "Week 3 Phase 2 (foundation + AgentChat)" is severely stale (29 commits). New title should reflect W2-W5 scope; description should link to `status-report-w2-to-w5.md`. Lands in the QA wrap commit.
2. **Lint refactor** — DEFER. Accept 21 set-state-in-effect errors as the new baseline (matches team pattern). Don't refactor in this pass. Just don't regress.
3. **Security findings auto-P0** — YES. Any HIGH-severity `cso` finding becomes P0 and gets fixed immediately, even mid-track, no user confirmation needed. Document in commit body which finding the fix addresses.
4. **Visual / design pass** — SKIP standalone. Don't invoke `design-review` skill. But if `qa-only` Track 1 surfaces a visual regression while doing functional QA, treat it as a P1 / P2 finding like any other.
5. **Track parallelism** — RUN PARALLEL. Tracks 1+2+3 dispatch as 3 background subagents at the start. Each writes its findings to a known location; triage happens after all 3 return.
