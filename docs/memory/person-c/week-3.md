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

(Append D1-D5 decisions here as they're made.)
