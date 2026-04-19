> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Read when the current task touches the specific subsystem this session covered.

# Person C — Dashboard & Control UI — Week 2

Week 2 Person C scope: dashboard UI for Create / Detail / Approvals, per-employee conversation sidebar in `/create` (rename, delete, persistent session keys), and the Creator sandbox-escape fix (the `agent-config-schema` skill + workspace config/ seeding that gave Forge a non-MCP way to answer config questions from inside the sandbox).

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-17 | Week 2 Person C: Dashboard UI for Create / Detail / Approvals |
| 2026-04-17 | Person C: Per-employee conversations in `/create` |
| 2026-04-17 | Person C: Creator sandbox-escape fix (agent-config-schema skill) |

---

## 2026-04-17 — Week 2 Person C: Dashboard UI for Create / Detail / Approvals

**What was done:**
Finished Person C's Week 2 deliverables from `docs/TeamPlan.md`: the three
new dashboard pages (`/create`, `/employees/[id]`, `/approvals`) and the
gateway-client plumbing they need, plus enabling the sidebar + homepage
entry points that Person A had stubbed as "W2".

**Gateway client additions (`sentura/dashboard/src/lib/gateway/`):**
- `types.ts` — added `AgentFileEntry`, `AgentFileContent`,
  `SessionCreateResult`, `ChatEventPayload`, and extended `ApprovalRequest`
  with `kind` (`"exec" | "plugin"`), `expiresAtMs`, and a loose `context`
  payload. `GatewayEventType` union extended with `"chat"` so streaming
  deltas are typed.
- `client.ts` — new helpers:
  - `createSession(agentId, initialMessage?)` → `sessions.create`
  - `listAgentFiles(agentId)` → `agents.files.list`
  - `getAgentFile(agentId, name)` → `agents.files.get`, tolerates
    allow-list denials by returning `null` (so `RULES.md` / `CONTEXT.md`
    don't crash the detail page)
  - `getBindingsForAgent(agentId)` → filters `config.bindings`
  - `deleteAgent(agentId, { deleteFiles? })` → `agents.delete`
  - `listExecApprovals()` / `listPluginApprovals()` → `exec.approval.list`
    and `plugin.approval.list` (to seed historical pending approvals)
  - `resolveApproval(..., { kind, reason })` — now routes by `kind`
    explicitly and forwards an optional operator-typed reason for audit.
  - `getAgent(id)` now calls `getAllAgentsIncludingMeta()` so the detail
    page can render `creator` / `tuner` / `orchestrator` via direct URL.
- `client.ts` scopes — added `"operator.approvals"` to the connect
  scopes. Without this, the gateway does **not** route
  `*.approval.requested`/`*.approval.resolved` events to the client,
  which was silently breaking the approval flow.
- `hooks.ts` — `useApprovals` now seeds from the two `*.approval.list`
  RPCs on connect and merges the result into the live-event stream,
  deduplicating by ID. This fixes the UX where the page would be empty
  until a brand-new approval fired.

**New pages:**
- `src/app/create/page.tsx` — Employee Creator chat UI.
  - Creates a session against the `creator` meta-agent via
    `sessions.create`, reuses the returned `sessionKey` for follow-ups.
  - Streams assistant responses by subscribing to the `chat` event and
    concatenating `state: "delta"` payloads, committing on
    `state: "final"`.
  - Inline `<textarea>` (shadcn/ui doesn't ship one) with Enter-to-send
    / Shift+Enter for newlines. Auto-scrolls transcript.
  - Disabled/guidance state when gateway is disconnected.
- `src/app/employees/[id]/page.tsx` — Employee Detail page.
  - Panels: identity header, workspace files (tabs), channel bindings,
    lifecycle actions.
  - File list comes from `agents.files.list`. Files on the gateway's
    allow-list (notably `SOUL.md` and memory snapshots) render inline;
    files outside the allow-list (`RULES.md`, `CONTEXT.md`, anything
    under `skills/`) are still listed, but their content panel shows an
    "Edit in Control UI" link pointing at the OpenClaw raw-config
    editor. This preserves the hybrid-UI split without either hiding
    files or surfacing a noisy RPC error.
  - Lifecycle: Refresh (re-fetches config + files + bindings), Tune
    (disabled, Week 3), Edit in Control UI (external link), Retire
    (confirmation `Dialog` → `client.deleteAgent(id)` → redirect to
    `/employees`).
- `src/app/approvals/page.tsx` — Approval Queue page.
  - Uses `useApprovals()` directly so it stays in sync with the
    sidebar badge.
  - `ApprovalCard` shows kind-specific framing: exec approvals get a
    terminal icon + `$ command` code block from `context.command`;
    plugin approvals get a shield icon + title/subtitle derived from
    the request payload.
  - Each card has Approve-once / Always-allow / Deny buttons, all of
    which open a confirmation `Dialog` with an optional reason
    textarea. The reason is forwarded to
    `client.resolveApproval(id, decision, { kind, reason })` so
    sentura-audit captures why the operator decided what they decided.
  - Collapsible raw payload, countdown based on `expiresAtMs` (1s
    re-render tick, turns urgent near expiry), deep-link to
    `/employees/{agentId}`.
  - Disconnected / connecting / empty states all handled separately.

**Sidebar + homepage wiring:**
- `src/components/sidebar.tsx`
  - Removed `disabled: true` + "W2" badge from "Create Employee" and
    "Approvals". Kept "Tune Employee" disabled with a "W3" badge.
  - Added a `badgeTone` ("default" | "alert") field to `NavItem` and
    wired the Approvals link to show a live pending count via
    `useApprovals()`. Non-zero counts render as a destructive-tone
    numeric badge; zero hides the badge entirely.
- `src/app/page.tsx`
  - "Create Employee" quick-action card is now wrapped in
    `<Link href="/create">` and no longer dimmed.
  - Employee quick-access cards now point at `/employees/{id}`
    (path param), matching the new detail route. The old
    `?id=` query-param pattern would not have loaded anything.
- `src/app/employees/page.tsx`
  - The roster's "Create Employee" button is an actual
    `<Link href="/create">` now.
  - Whole table rows are clickable and route to
    `/employees/{id}`; the per-row Control UI link still opens
    externally and stops propagation so it doesn't double-navigate.

**Hybrid UI decisions documented inline:**
- The detail page deliberately does NOT try to render
  `RULES.md` / `CONTEXT.md` even when the user clicks them — per
  the Sentura split, anything that requires writing to the
  agent workspace routes through Control UI. The dashboard is
  read-most / action-oriented.
- "Tune" is wired up visually but disabled; Week 3 brings the
  tuner chat UI.

**Documentation updates:**
- `docs/TeamPlan.md` — Person C Week 2 tasks checked off with
  implementation notes (streaming chat, file-access limitation,
  approval seeding + scope requirement).
- `docs/TESTS.md` — bumped `Last updated` to 2026-04-17; added
  C2.11–C2.18 (gateway client helpers + approvals scope),
  C3.5–C3.6 (approval seeding & resolve cleanup), C4.8–C4.9
  (sidebar enablement + live badge), C5.8 (Create quick action
  enabled), C6.11 (row-click navigation), and brand-new
  C8 / C9 / C10 sections (38 cases total for the three new
  pages); updated C4.3, C5.6, C6.10 to reflect the now-enabled
  state; bumped Person C total from 33 → 85 and the grand
  template total accordingly.
- `docs/MEMORY.md` — this entry.

**Lessons / gotchas surfaced this pass:**
- `agents.files.get` is allow-list-gated on the gateway. The
  allow-list currently covers `SOUL.md` and memory files but not
  `RULES.md`, `CONTEXT.md`, or `skills/*.md`. Attempting to fetch
  outside the list returns an RPC error — so the detail page had
  to swallow it and fall back to a Control-UI CTA.
- `operator.approvals` is a separate scope. The Week 1 client
  only requested `operator.read/write/admin`, which is why the
  approval flow had been silently inert until now. Any future
  RBAC tightening needs to keep this scope on the UI client
  (otherwise the dashboard looks broken even when everything
  else is healthy).
- `useApprovals` cannot rely on live events alone — the
  `*.approval.list` RPCs are needed to seed state for approvals
  that existed before the dashboard connected. Worth copying
  this pattern anywhere else we subscribe to stateful events.
- `client.getAgents()` filters meta-agents, so `getAgent(id)`
  needed to be re-pointed at `getAllAgentsIncludingMeta()` to
  keep direct `/employees/creator` links working. Anything in
  the dashboard that looks up a single agent by id should use
  `getAgent`, not search the filtered list.
- Homepage had a stale `href={`/employees?id=${id}`}` pattern
  that never matched a route. Fixed in this pass; worth a grep
  next time we add dynamic routes.

**Files created:**
- `sentura/dashboard/src/app/create/page.tsx`
- `sentura/dashboard/src/app/employees/[id]/page.tsx`
- `sentura/dashboard/src/app/approvals/page.tsx`

**Files modified:**
- `sentura/dashboard/src/lib/gateway/types.ts`
- `sentura/dashboard/src/lib/gateway/client.ts`
- `sentura/dashboard/src/lib/gateway/hooks.ts`
- `sentura/dashboard/src/components/sidebar.tsx`
- `sentura/dashboard/src/app/page.tsx`
- `sentura/dashboard/src/app/employees/page.tsx`
- `docs/TeamPlan.md`
- `docs/TESTS.md`
- `docs/MEMORY.md` (this entry)

**Verification performed:**
- `ReadLints` on every touched file: no new errors introduced.
  The pre-existing `react-hooks/refs` warnings in
  `src/lib/gateway/hooks.ts` and unused-variable warnings in
  `src/app/page.tsx` / `src/app/employees/page.tsx` /
  `src/lib/gateway/client.ts` are Person A artifacts and were
  left alone per scope.
- TypeScript type error in `/create/page.tsx` around the `chat`
  event payload was resolved with an explicit
  `as unknown as ChatEventPayload` cast — `GatewayEvent.payload`
  is typed as `Record<string, unknown>` at the transport layer,
  which is intentional.

**Still open / follow-ups for other people:**
- Person D: hook a `config_change` audit entry when the Creator
  actually deploys a new employee (currently the entry page
  assumes audit is automatic via hooks but does not inject a
  dashboard-side `reason`).
- Person B: an "events" stream RPC or `sessions.changed` push
  would let us reflect newly-created employees in the roster
  without a manual refresh after the Creator completes. For now
  the user has to refresh `/employees` (the Creator page does
  not own that list).
- Week 3 Person C: wire the Tune button to a `/tune/{id}` page
  backed by the Tuner meta-agent; will likely reuse the same
  streaming chat composer as `/create`.

---

## 2026-04-17 — Person C: Per-employee conversations in `/create` (sidebar, rename, delete)

**What changed:**
Replaced the single-session `/create` page with a per-employee
conversation model backed by the Gateway's `sessions.list/patch/delete`
RPCs filtered to `agentId=creator`. Each new AI employee now starts its
own conversation thread, and users can navigate the full history of
creator conversations from a left-hand sidebar, rename them, or delete
them.

**Files touched:**
- `sentura/dashboard/src/lib/gateway/client.ts`
  - `listSessions(options?: { agentId?: string })` now forwards
    `{ agentId }` to `sessions.list` so the sidebar only sees
    creator conversations.
  - `deleteSession(sessionKey, { deleteTranscript? })` now sends
    `{ key, … }` (gateway schema uses `key`, not `sessionKey`).
  - New `patchSession(sessionKey, { label })` for rename.
  - `createSession(agentId, initialMessage?, { label? })` — label is
    forwarded so draft conversations get a real server-side title on
    their first message.
- `sentura/dashboard/src/lib/gateway/types.ts`
  - Extended `SessionSummary` with `label`, `displayName`,
    `derivedTitle`, `lastMessagePreview`, `updatedAt` (epoch-ms), and
    `kind` — matches `GatewaySessionRow` in the gateway.
- `sentura/dashboard/src/app/create/conversation-sidebar.tsx` (new)
  - `ConversationSidebar` + `ConversationRow` components. Handles
    inline rename, delete-confirmation dialog, relative timestamps,
    and the "+ New employee" CTA.
- `sentura/dashboard/src/app/create/page.tsx` (rewritten)
  - Two-column layout: sidebar + chat.
  - New state: `sessions`, `sessionsLoading`, `activeKey`,
    `draftLabel`. `activeKey` and `draftLabel` are mirrored into
    `localStorage` (`sentura.create.activeKey`,
    `sentura.create.draftLabel`).
  - `handleNewConversation` creates a local-only draft — we defer
    `sessions.create` until the first message so the user can rename
    the draft before any server state exists.
  - `handleSubmit` uses `sessions.create({ label: draftLabel })` for
    drafts and `chat.send` for existing sessions; the idempotency key
    auto-generation added in the previous pass is unchanged.
- `docs/TESTS.md` — added C8.15–C8.21 (sidebar, draft flow,
  first-message session creation, rename, delete, reload
  persistence).

**Verification performed:**
- `ReadLints` on every touched file: no new errors introduced.
- `npx tsc --noEmit` in `sentura/dashboard/`: clean (exit 0).
- Gateway-side schema double-checked against
  `openclaw/src/gateway/protocol/schema/sessions.ts` —
  `sessions.delete` expects `key` (not `sessionKey`), and
  `sessions.patch`/`sessions.create` both accept an optional `label`.

**Lessons / gotchas:**
- The gateway's `SessionSummary` does not always populate `label`;
  `displayName`/`derivedTitle` are the correct fallbacks for rendering
  (used in `ConversationRow.title`).
- We intentionally don't call `sessions.create` on "+ New employee"
  click — a draft-only state is cheaper and lets the user rename
  before a session exists. The trade-off is that if the user refreshes
  without sending a message, the draft survives via `localStorage` but
  nothing is on the server yet (matches the behavior users expect from
  modern chat UIs).
- `sessions.list` is authoritative; `refreshSessions` is called after
  every create/rename/delete to keep the sidebar in sync rather than
  mutating local state speculatively (except for optimistic rename,
  where we patch the local row before the RPC returns).

**Still open / follow-ups:**
- No live `sessions.changed` event yet, so if a second tab creates a
  creator session, this tab won't see it until the next manual action.
  Noted in the previous MEMORY entry as a Person B follow-up.
- Week 3 will likely need the same multi-conversation pattern in
  `/tune/{id}` — the sidebar component is generic enough to reuse once
  we scope it by `agentId`.

---

## 2026-04-17 — Person C: Creator sandbox-escape fix (agent-config-schema skill)

**Symptom observed:**
While generating the first AI employee ("Remy") the Creator agent
tried to `read` `~/Desktop/Sentura-Platform/openclaw/docs` and
`~/Desktop/Sentura-Platform/openclaw/docs/README.md`. The gateway
correctly rejected both with `Path escapes sandbox root` — the
Creator's sandbox root is `~/.openclaw/sandboxes/agent-creator-*` and
the repo checkout is outside that root.

**Root cause:**
The Creator's skills told it to "use the correct schema" but did not
provide the schema inline. When it went looking for authoritative
docs, its only resort was the OpenClaw repo — which it cannot reach
from inside its sandbox, by design.

**Fix shipped:**
- Added `sentura/agents/creator/skills/agent-config-schema/SKILL.md`
  — an authoritative, inline reference for every field the gateway
  accepts in `config.patch`. Derived directly from the zod schemas
  in `openclaw/src/config/zod-schema.agent-runtime.ts` and
  `openclaw/src/config/zod-schema.agents.ts`:
  - `agents.list[*]` (strict) — full field table, including
    `sandbox`, `tools`, `runtime`, `heartbeat`, and the forbidden
    `systemPrompt` / `workspace` / `agentDir` fields.
  - Top-level `bindings` — Route vs ACP, `peer.kind ∈ {direct,
    group, channel, dm}`.
  - `tools.profile ∈ {minimal, coding, messaging, full}`,
    allow/alsoAllow mutual exclusion rule.
  - `sandbox.mode ∈ {off, non-main, all}` with the "employees MUST
    be non-main" invariant.
  - A minimal Remy walk-through (`config.get` → build entry →
    `fs_write` workspace → `config.patch`).
- Extended `sentura/agents/creator/RULES.md` with a "Sandbox
  Boundaries" section making the no-repo-access policy explicit and
  pointing at the new skill as the replacement.
- Updated `sentura/agents/creator/AGENTS.md` Phase 2 to require
  opening the schema skill before assembling any `config.patch`.
- Updated `sentura/agents/creator/BOOTSTRAP.md` step 3 so first-run
  self-introspection surfaces the schema skill and explains why
  reading the repo is off-limits.
- `rsync`'d the full source `skills/` into the runtime workspace at
  `~/.openclaw/workspace/creator/skills/`. Before this sync the
  runtime was missing three source skills (`employee-design`,
  `employee-deployment`, `research-and-discovery`) as well as the
  new `agent-config-schema`. Also copied the updated `AGENTS.md`,
  `BOOTSTRAP.md`, `RULES.md`, and `CONTEXT.md` into the runtime
  workspace so the currently-live Creator instance sees them on its
  next session turn.

**Files touched:**
- `sentura/agents/creator/skills/agent-config-schema/SKILL.md` (new)
- `sentura/agents/creator/RULES.md`
- `sentura/agents/creator/AGENTS.md`
- `sentura/agents/creator/BOOTSTRAP.md`
- `~/.openclaw/workspace/creator/**` (runtime sync — not in repo)
- `docs/MEMORY.md` (this entry)

**Follow-ups / open questions:**
- The runtime workspace at `~/.openclaw/workspace/creator/` drifted
  from the source — today's fix only catches up manually. There is
  no automated sync in `scripts/sentura-setup.sh` for incremental
  edits to the source. Worth a small watcher or `make sync-creator`
  target for Person A/B.
- The Creator's config.json5 grants `gateway`, `sessions_send`,
  `sessions_spawn`, and the `coding` tool profile, but the sandbox
  root it was given (`agent-creator-b40f8302`) is per-instance.
  Today's fix sidesteps the question of whether repo docs should
  ever be mountable — kept sandbox pristine, solved the knowledge
  gap inline.
- Week 3 Tuner agent will inherit the same problem if it ever needs
  to reason about schema; the `agent-config-schema/SKILL.md` is
  generic enough to symlink or copy into Tuner's workspace when we
  get there.

---

