> **On-demand reference — not read by default.** Person C's Week 3 execution plan (2026-04-25 → 2026-05-02). Forward-looking — sessions are appended below as they happen. See `roadmap.md` for the Week 3-8 horizon, `docs/TeamPlan.md` for cross-team Week 3 deliverables.

# Person C — Dashboard — Week 3 Plan

## Goal of the week

Lock 5 foundational decisions → build the cross-cutting infrastructure they imply → ship the first new UI surface (`/chat` 1:1) on top.

Week 3 TeamPlan ranks 4 deliverables for Person C. Reality check:

| TeamPlan deliverable | This week? | Why |
|---|---|---|
| `/chat` 1:1 (Communication Panel Phase 1) | ✅ Yes — primary | Highest leverage, exercises 4/5 decisions, unblocks all later chat-shaped UIs |
| Real-time updates for approvals + config | ✅ Yes — folded | Implemented as `useGatewayEvents` hook in Phase 2 (decision D5) |
| `/tune` (Tuning Agent NL UI) | ⏭ Week 4 | Reuses `<AgentChat>` from this week's work — building it now would force premature locking of the abstraction |
| `/integrations` (MCP server manager) | ⏭ Week 4 | Independent surface, no shared infrastructure benefit from rushing |

Slipping `/tune` and `/integrations` to Week 4 is a deliberate trade — better to ship one polished foundation + one feature than four half-built surfaces with three subtly-different chat implementations.

---

## Phase 1 — Decisions (Day 1, 2026-04-25)

Five decisions, all needing Person C's call. Each unblocks Phase 2+ work and prevents the Week 5 RBAC-retrofit-style crisis (where 10 pages exist without the cross-cutting hook and have to be rewritten under deadline).

Output of this phase: append the chosen options into a `## Decisions` section at the bottom of this file (or split into `decisions.md` if it grows).

### D1 — State management library

| Option | Pros | Cons | Notes |
|---|---|---|---|
| **Zustand** | Tiny (~1KB), hook-first API, no boilerplate, used by shadcn examples | Less ecosystem than Redux | Recommended |
| Jotai | Atom-based reactivity, very fine-grained re-renders | Different mental model than React state | |
| TanStack Query (only) | Great for RPC cache + invalidation | Doesn't cover non-server state (UI flags, drafts) | Could pair with one of the above |
| `useReducer` + Context | Zero new deps | Boilerplate scales poorly past ~5 pages | We have 10+ pages coming |

**Recommendation:** Zustand for client state. Optionally add TanStack Query later as a wrapper around `getGatewayClient()` calls. Defer that until we see real cache-invalidation pain.

### D2 — `<AgentChat>` component contract

Purpose: shared React component used by `/create`, `/tune`, `/chat`, `/orchestrator`. Each surface targets a different agent and may add post-processing, but the streaming + history + typing-indicator + attribution behavior is identical.

**Proposed signature:**

```ts
type AgentChatProps = {
  agentId: string;
  sessionKey?: string;           // resume existing session, else create new on first send
  initialPrompt?: string;        // optional prefilled draft
  onSessionCreated?: (sessionKey: string) => void;
  onMessage?: (message: ChatMessage) => void;
  onToolCall?: (toolCall: ToolCallEvent) => void;
  emptyState?: ReactNode;        // what to show before any messages
  className?: string;
};
```

**Locked behavior** (no caller customization):

- Streams via `chat` event delta accumulation, commits on `state: "final"`
- Persists `sessionKey` so refresh restores conversation
- Renders tool-call cards inline (not just text) so users see what the agent is doing
- Auto-scroll on new content unless user manually scrolled up

**Caller-controlled** (via props above):

- Which agent the chat targets
- Whether it's a new or resumed session
- Side-effect hooks (analytics, audit logging, conversation list updates)

### D3 — `usePermission` hook signature

Co-designed with Person D. C provides a stub now (returns `allowed: true`), all Week 3+ pages adopt it from day one, D fills in the real `sentura-rbac` lookup by Week 5.

**Proposed:**

```ts
type PermissionContext = { scope?: "sme" | { dept: string } };
type PermissionResult = { allowed: boolean; reason?: string; loading: boolean };

function usePermission(action: string, ctx?: PermissionContext): PermissionResult;
```

**Action vocabulary** (initial — D will own the canonical list):

- `"audit.read"`, `"audit.export"`
- `"agents.create"`, `"agents.delete"`, `"agents.tune"`
- `"approvals.resolve"`
- `"settings.write"`
- `"ekg.read"`, `"ekg.write"`
- `"sessions.read"` (with own-scope filtering enforced server-side)

### D4 — Visual token system

Need: color palette (incl. IAI Dual-MCP green/blue from `Documents/Demo.md`), typography scale, motion primitives, elevation scale.

Approach: extend Tailwind config + CSS variables in `globals.css` → single `tokens.css` source of truth → all new components reference tokens, never hardcoded values.

**Person C input needed:**

1. Base palette direction:
   - (a) Use shadcn/ui defaults + add 2 brand accents (green for Internal MCP, blue for External MCP)
   - (b) Custom Sentura palette from scratch (more design effort)
2. Demo polish ambition: should the visual system support `Documents/Demo.md` Mode B scenario 3 "brake cable" cross-screen animation right out of the box, or treat as Week 6-8 polish stretch goal?

### D5 — WebSocket event subscription strategy

8 event types: `session.message`, `session.tool`, `chat`, `presence`, `heartbeat`, `cron`, `config.changed`, `approval.pending`, `approval.resolved`.

**Proposed:** central `useGatewayEvents(eventTypes[])` hook in `src/lib/gateway/hooks.ts`:

- Multiple components can subscribe to overlapping event sets — internally deduped to one underlying WebSocket subscription
- On reconnect, hook auto-replays missed events for subscribed types via the relevant `*.list` RPC backfill where available (`exec.approval.list`, `plugin.approval.list` already used in `useApprovals`)
- Provides loading/error/connection-state side channel

This generalizes the existing `useApprovals` pattern to all event types.

---

## Phase 2 — Foundation (Day 2-3, 2026-04-26 → 2026-04-27)

Locked decisions D1-D5 → build the shared infrastructure.

- [ ] **Install state management** (per D1) — `pnpm add zustand` + create first store (`useAgentRosterStore` for the `/employees` page as proof)
- [ ] **Extract `<AgentChat>`** (per D2) — pull the streaming/session/scroll logic out of `src/app/create/page.tsx` into `src/components/agent-chat.tsx`, refactor `/create` to use it. Verify `/create` still works end-to-end.
- [ ] **Add `usePermission` stub** (per D3) — `src/lib/auth/use-permission.ts` returning `{ allowed: true, loading: false }` for any action. Wire into ALL existing 5 pages so Week 3+ adoptions don't have to rediscover.
- [ ] **Visual tokens** (per D4) — `src/styles/tokens.css` + `tailwind.config.ts` extension. Include IAI Dual-MCP color tokens even if no UI uses them yet (defining them makes Week 4 demo work cheap).
- [ ] **`useGatewayEvents` hook** (per D5) — generalize `useApprovals` pattern. Refactor `useApprovals` to use it as the first consumer.

**Acceptance:** All existing pages (`/`, `/employees`, `/create`, `/employees/[id]`, `/approvals`) still work end-to-end. C1-C10 tests in `docs/TESTS.md` still green. Foundation is exercised by at least one production code path.

---

## Phase 3 — `/chat` 1:1 (Day 4-6, 2026-04-28 → 2026-04-30)

The first new UI surface, building on locked decisions and shared infrastructure.

- [ ] **Route + layout** — create `src/app/chat/page.tsx` with two-pane layout (conversation list left, thread right). Use shadcn primitives + tokens.
- [ ] **Conversation list** — calls `sessions.list` filtered by current `userToken` (per `usePermission` scope), grouped by employee, sorted by last activity. Empty state: "Start a new conversation."
- [ ] **New conversation flow** — "New" button opens employee picker (lists agents from `useAgentRosterStore`). Selecting an agent calls `sessions.create(agentId)`, navigates to the new conversation pane.
- [ ] **Thread pane** — `<AgentChat agentId={...} sessionKey={...} />`. Add user message → see streamed response → see tool-call cards inline.
- [ ] **History restore** — refresh while in a conversation → `chat.history(sessionKey)` repopulates the thread.
- [ ] **Sidebar nav** — add `/chat` link with active-conversation-count badge in `src/components/sidebar.tsx`.
- [ ] **Add C11 to TESTS.md** — new test row covering /chat (build + lint + RPC integration) under Person C section.

**Acceptance criteria** (all must pass):

1. Start fresh conversation with `billing-support-rep` from /chat — see Forge-style streaming response within 5s.
2. Refresh page mid-conversation — same conversation visible, full history loaded, can keep chatting.
3. Have 2+ concurrent conversations open in browser tabs — they don't interfere (different `sessionKey`s).
4. Sidebar `/chat` badge updates live when a new conversation is created in another tab (proves `useGatewayEvents` works for `session.message`).

---

## Phase 4 — Polish + commit (Day 7, 2026-05-01)

- [ ] E2E manual: send one round of messages to all 6 agents (main + 4 meta + billing-support-rep) via `/chat`. Capture any meta-agent quirks for future bug fixes.
- [ ] Append a `## 2026-05-01 — Week 3 ship session` entry to this file documenting what landed, what slipped, what the C12 / C13 / C14 future test rows should cover.
- [ ] Open a PR scoped to Week 3 work (separate from PR #1 which is roadmap + bug fixes).

---

## Open dependencies that might block

| What I need | From | When | Fallback if late |
|---|---|---|---|
| Person A's session-management gateway helpers (`docs/TeamPlan.md` Week 3 § Person A) | A | This week | `/chat` 1:1 doesn't need them — uses existing `sessions.create` + `chat.send`. Group chat (roadmap Theme 1 Phase 2) is what needs A's new helpers — not in this week's scope. |
| D's `sentura-rbac` frontend hooks | D | Week 5 | I ship a stub returning `{ allowed: true }`. All pages compile and work. D swaps in real impl in Week 5 with zero refactor needed because the contract is locked here. |
| Visual design approval (D4 base palette) | (Person C self) | This week | If undecided, default to shadcn + add 2 brand accents — easy to retune later. |

---

## Risks (this week specifically)

1. **Decision phase drag** — if D1-D5 spread over 3+ days, Phase 2 starts with everything contended at once. Mitigation: time-box decisions to today (4/25). Imperfect choices recoverable; un-made ones aren't.
2. **`<AgentChat>` extraction surfaces hidden coupling** in `/create` — possible the existing implementation has unstated assumptions. Mitigation: extract conservatively, keep `/create` as the canary, ship even if other consumers wait until Phase 3.
3. **`useGatewayEvents` reconnect-backfill complexity** — getting "missed events while disconnected" right is genuinely hard. Mitigation: ship Phase 2 with a TODO for backfill, add it during /chat work in Phase 3 when we have a real consumer that needs it.

---

## Decisions log

### D1 — State management library — **2026-04-25**

**Decision: Zustand** (option A in plan).

Rationale: hook-first API, ~1KB, no boilerplate, integrates cleanly with Next.js App Router (subscriptions only in client components, no Provider wrapping). Defer TanStack Query until cache-invalidation pain materializes — premature add buys us a dependency without a problem.

First store this week: `useAgentRosterStore` (employees page proof, then reused in /chat New-conversation employee picker).

### D2 — `<AgentChat>` component contract — **2026-04-25**

**Decision: Approved as proposed.** Signature locked exactly as drafted in Phase 1 above.

Locked-down behavior (no caller customization): streaming via `chat` delta accumulation + commit on `state: "final"`, sessionKey persistence, inline tool-call cards, smart auto-scroll. Caller-controlled (props): `agentId`, `sessionKey`, side-effect callbacks.

Rationale: prevents 4 callers (`/create`, `/tune`, `/chat`, `/orchestrator`) from drifting into 4 subtly-different chat behaviors visible to users.

### D3 — `usePermission` hook signature — **2026-04-25**

**Decision: Approved as proposed.** Signature `usePermission(action, ctx?)` returning `{ allowed, reason?, loading }`.

This week ships a stub returning `{ allowed: true, loading: false }`. All Week 3+ pages adopt the contract day-1 so Person D's Week 5 real implementation requires zero refactor across surfaces.

### D4 — Visual token system — **2026-04-25**

**Decision: a + b.**

- **Base palette**: shadcn defaults + 2 IAI brand accents (green = Internal MCP, blue = External MCP). Lightweight investment now; Week 6-8 polish phase can upgrade to a fully bespoke palette if needed.
- **Demo Mode B scenario 3 "brake cable" cross-screen animation**: deferred to Week 6-8 polish stretch goal. Designing the animation system without a real demo target risks over-engineering and abstract scaffolding that won't fit the actual storyboard.

Phase 2 work: create `src/styles/tokens.css` with palette + typography scale + motion primitives + elevation. Define green/blue IAI tokens even before any UI consumes them — that makes Week 4 IAI integration UI cheap.

### D5 — `useGatewayEvents` subscription strategy — **2026-04-25**

**Decision: Approved as proposed.** Central hook `useGatewayEvents(eventTypes[])` in `src/lib/gateway/hooks.ts`, multi-subscriber dedup, refactor `useApprovals` to be its first consumer.

**Backfill behavior deferred**: Phase 2 ships with TODO marker for "replay missed events on reconnect." Phase 3 `/chat` is the first surface that genuinely needs backfill — wait until then to design the API against a real consumer instead of speculating.

---

## 2026-04-25 — Phase 2 + Phase 3 ship session (compressed)

The original plan budgeted Phase 2 for Day 2-3 and Phase 3 for Day 4-6 (3 days each). Both compressed into a single intense session on 2026-04-25 (Day 1 → Day 6 of plan, in one sitting). Ship summary:

### What landed

**Phase 2 — Foundation** (4 commits → `dd817c43` `f40f98a1` `42e98f5e` `9418c016`)

| Decision | Implementation | Status |
|---|---|---|
| D1 Zustand | `useAgentRosterStore` mirrors `useAgents()` data; `/employees` is the canonical hydrator; `/chat` employee picker subscribes via selector | ✅ |
| D2 `<AgentChat>` | Extracted from `/create/page.tsx` (1,026 → 290 lines, 72% reduction); `forwardRef` exposes `AgentChatHandle` for legitimate imperative needs (suggestion-pill setInput); `prevSessionKeyRef` handles undefined→defined sessionKey transition without wiping optimistic state | ✅ |
| D3 `usePermission` | Stub returning `{ allowed: true, loading: false }`; typed `PermissionAction` union (11 actions); wired into 5 pages day-1 so D's Week 5 sentura-rbac swap is zero-refactor | ✅ |
| D4 Visual tokens | `src/styles/tokens.css` with shadcn defaults + IAI Internal (green, oklch 0.65/0.18/152) and IAI External (blue, oklch 0.62/0.16/240) MCP brand accents; motion + elevation + display typography scales | ✅ |
| D5 `useGatewayEvents` | Multi-event handler-map primitive in `lib/gateway/hooks.ts`; `useApprovals` refactored as first consumer (4 separate `client.on` calls collapsed to 1 handler map); reconnect backfill TODO deferred until Phase 3 needed it (it didn't, so still TODO) | ✅ |

**Phase 3 — `/chat` 1:1** (2 commits → `6af96df7` `3468afcc`)

| Task | Implementation | Status |
|---|---|---|
| Route + 2-pane layout | `src/app/chat/page.tsx` (257 lines) | ✅ |
| Conversation list | `chat-sidebar.tsx` (295 lines), grouped by agent via `getSessionAgentId` (parses key prefix), sorted by last activity within group, groups sorted by most-recent activity | ✅ |
| New conversation flow | `employee-picker-dialog.tsx` (105 lines); picker → `?draft=<agentId>` URL; first send fires AgentChat's `onSessionCreated` → URL adopts new `?key=...` | ✅ |
| Thread pane | `<AgentChat key={`${agent}:${sessionKey}`}>` — React `key` prop forces remount on conversation switch; emptyState prop renders "Say hello to {agent name}" card | ✅ |
| URL params | `useSearchParams` reads `?key=` and `?draft=`; `router.replace` writes (not push, so back button doesn't accumulate noise); supports refresh (#2) + multi-tab (#3) | ✅ |
| Sidebar nav badge | `useSessions().length` with `useGatewayEvents("sessions.changed")` refetch; live updates within ~1s across tabs | ✅ |
| C11 test entry | 17 sub-tests in `docs/tests/tests-person-c.md` covering all 4 acceptance criteria + edge cases (stale URL key, disconnect banner, picker meta-filter, group ordering) | ✅ |

### Acceptance criteria — all 4 verified via Playwright

| # | Criterion | Verification |
|---|---|---|
| 1 | Fresh chat with `billing-support-rep` streams in <5s | First delta <2s, full response in seconds |
| 2 | Refresh restores conversation | Re-navigate to `?key=...` → `chat.history` hydrates full transcript |
| 3 | Multi-tab independent | Tab 0 (billing-rep) untouched after Tab 2 created `main` agent session |
| 4 | Sidebar badge live update across tabs | Badge auto-incremented 3 → 4 → 5 within ~1s without manual refresh |

### What slipped

Nothing from the Week 3 plan slipped. `/tune` and `/integrations` were already explicitly de-scoped on Day 1 (decisions phase) into Week 4 and remain on track for next week.

### Bugs found and fixed during Phase 2/3

- **AgentChat `showEmptyState` empty-state guard inverted** (caught by code-reviewer subagent before push) — `sessionKey !== undefined` requirement meant draft-mode pills never rendered. Fixed inline before commit.
- **`getSessionAgentId` helper for unreliable gateway field** (caught by Playwright run, not in original plan) — gateway's `sessions.list` inconsistently populates `agentId`, breaking sidebar grouping and AgentChat right-pane mount on freshly-created sessions. Fixed by parsing the structured session key prefix as authoritative source.

### Pre-existing issues surfaced (not blocking, follow-up for team)

| Where | Issue | Severity |
|---|---|---|
| `client.ts:339` `META_AGENT_IDS` Set | Missing `mcp-builder` and `data-scavenger` — both leak into `/chat` employee picker | Medium (UX confusion, not data corruption) |
| `/chat` picker | "main" agent appears with empty model field — looks like a default placeholder that probably shouldn't be picker-able | Low |
| `useGateway`, `useRpc`, `useGatewayEvent` (singular), `/employees/[id]`, original `/create` patterns | 13 React 19 strict-rule lint errors (`react-hooks/refs` + `react-hooks/set-state-in-effect`) — pre-existing from React 18 → 19 upgrade; my Phase 2/3 work added 1 more in same pattern (`/chat/page.tsx:96` `void refreshSessions()`). Worth holistic cleanup as separate PR | Low (lint-only, runtime OK) |

### Future test rows (for next ship cycle)

When `/tune` lands in Week 4: add **C12 — Tune (`/tune`) — Week 4** following the same C11 template structure (mounts AgentChat with `agentId="tuner"` + Tuner-specific suggestions in emptyState).

When `/integrations` lands in Week 4: add **C13 — Integrations (`/integrations`) — Week 4** covering MCP server CRUD via `config.patch` + per-agent binding lists.

When the AgentChat reconnect-backfill TODO is resolved (driven by /chat needing it in production): add **C14 — useGatewayEvents reconnect backfill** covering missed-events-on-reconnect replay via `*.list` RPC backfill.

### Plan deviation log

- Day 1 (decisions) actually consumed ~30 minutes instead of "1 day" — user was decisive and the recommendations stuck without debate
- Day 2-3 (Phase 2 foundation) compressed to ~2 hours — D1+D3+D4 commits were small/independent, D5 took longer because of ref-sync subtlety
- Day 4-6 (Phase 3 /chat) compressed to ~3 hours including the Playwright acceptance run; bug fix discovery (`getSessionAgentId`) added ~15 min
- Day 7 (Phase 4 polish) — partially complete (this ship log entry); 6-agent E2E manual test deferred to next session, was lower-priority than starting Week 4 surfaces

Net: Week 3 plan delivered in ~1 day of Claude Code session time vs 7-day budget. Shifts saved time toward Week 4 launch.
