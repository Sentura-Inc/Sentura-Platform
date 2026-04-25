> **On-demand reference — not read by default.** Person C's Week 4 execution plan (2026-04-26 → 2026-05-03). Forward-looking — sessions are appended below as they happen. See [`roadmap.md`](roadmap.md) for the Week 3-8 horizon, [`docs/TeamPlan.md`](../../TeamPlan.md) for cross-team Week 4 deliverables.

# Person C — Dashboard — Week 4 Plan

## Goal of the week

Ship the W3 slips (`/tune` + `/integrations`), build skeletal shells for the 4 backend-blocked TeamPlan W4 deliverables so the design is locked when other-team work lands, and design the Group Chat fan-out architecture (capability #16 Phase 2). Avoid building mock-data UIs that get rewritten when real schemas ship.

## Reality check — TeamPlan W4 vs what Person C can actually do

TeamPlan ranks 7 deliverables for Person C, plus 2 W3 slips, plus 1 W3 residual = **10 candidate items**. Brutal triage:

| TeamPlan / W3 slip / residual | This week? | Why |
|---|---|---|
| `/tune` (W3 slip) | ✅ Day 2 — primary | Mounts `<AgentChat>` with `agentId="tuner"`; near-zero new infra |
| `/integrations` (W3 slip) | ✅ Day 3 — primary | Independent surface; reads `config.mcp` + per-tier metadata |
| Skeleton `/orchestrator` `/knowledge` `/cost` `/testing` | ✅ Day 4-5 — defensive | Routes + sidebar nav + "Awaiting [owner] [thing]" empty states. **No mock data.** Real wiring when backends ship |
| Group Chat fan-out (capability #16 Phase 2) | ⚠️ Day 6-7 — design + skeleton | Architecture decision (Next.js API route vs client-side fan-out) blocks code. Goal: ship designed-and-routed shell, fill body in W5 once Person A's session helpers land |
| User-aware session filtering | ⏸ Wait | Blocked by Person A's W4 `sessions.list { userToken }` filter. Re-evaluate mid-week |
| Tenant / department selector | ⏸ Wait | Blocked by Person A's W4 multi-tenancy namespace convention. Selector design depends on the namespace shape |
| Per-RPC `userToken` forwarding (W3 residual) | ⏸ Wait | Folds into user-aware session filtering — same blocker, same unblock signal |

The reasoning behind "no mock data" for skeleton shells: a mock-data UI that ships looks done; reviewers stop scrutinizing it; when real data has a different shape than my mock, I have to rewrite both the UI and any tests built against the mock. A skeleton with "Awaiting Person B's Data Scavenger output schema" is honest about its state and signals to the team where unblocking work is needed.

---

## Phase 1 — Decisions (Day 1, 2026-04-26)

Five decisions to lock before Phase 2+ coding. Each unblocks a downstream deliverable.

### D1 — `/tune` UX — chat-only MVP vs chat + diff panel

The Tuning Agent's job is to take NL adjustments ("make billing-support-rep more friendly") and produce config changes (workspace file edits + `config.patch` proposals). Two UX shapes:

| Option | What | Pros | Cons |
|---|---|---|---|
| **A. Chat-only MVP** | Just `<AgentChat agentId="tuner">`; tuner verbally describes changes; user approves via `/approvals` | Ships in ~1 hour; reuses everything from `/chat` | Diff is text-only — user reads "I'll change the tone parameter from 'neutral' to 'friendly'" instead of seeing a side-by-side |
| B. Chat + diff panel | Same chat + a right-side panel showing pending workspace file diffs (monaco editor or similar) before approval | More usable; closer to Demo.md scenario | ~1 day extra; unclear how Tuner agent surfaces "this is a pending change" frame to the dashboard — needs new `chat` event subtype or session metadata |

**Recommendation: A for W4, B for W6-8 polish.** The diff panel needs Tuner-side cooperation (B's work) anyway; W4 ships chat-only and `/approvals` already shows the diff via the existing `exec.approval.requested` payload. Polish phase upgrades to inline diff once we know what the Tuner-agent emits.

### D2 — `/integrations` layout — single table vs tabbed-by-tier

MCP servers come in three tiers with different lifecycle metadata:

- **Tier 1 (open-source npm)**: package name, npm version, last-checked-for-updates, install command
- **Tier 2 (Sentura-generated)**: source path under `sentura/mcp-servers/`, generated-from (API doc URL or filepath), generated-at, last-regenerated, regenerate command
- **Tier 3 (self-provisioned)**: SaaS provider, account email, last-credential-rotation, status (connected / needs-reauth / suspended)

**Options:**

| Option | What | When better |
|---|---|---|
| A. Single unified table | Columns: `name`, `tier`, `status`, `installed-at`, `actions`. Tier-specific metadata in expandable row | Few servers (< 10) |
| **B. Tabbed by tier** | Three tabs (T1 / T2 / T3); each tab is a table optimized for that tier's metadata | Tier-specific actions ("regenerate" only on T2; "rotate credential" only on T3) |
| C. Card grid | Each MCP server is a card; visual but harder to scan | Demo polish only |

**Recommendation: B.** The tier-specific actions (regenerate, rotate, reconnect) make tabs the natural separation. Single table forces awkward "this column N/A for tiers other than T2" empty cells.

### D3 — Group Chat fan-out architecture

Capability #16 Phase 2: a human sends one message to a group of N AI employees; each agent responds independently; responses appear in a unified thread with sender attribution.

**Options:**

| Option | What | Pros | Cons |
|---|---|---|---|
| **A. Next.js API route as fan-out** | Dashboard POSTs to `/api/group-chat/[groupId]/send` → API route opens N WebSocket sessions → merges streams → SSE back to client | Server-side correlation guarantees ordering; one client connection; matches TeamPlan wording ("Sentura-layer fan-out orchestration") | Two WebSocket hops (client → API route → gateway); SSE for streaming back; new API route surface to maintain |
| B. Client-side fan-out via N `<AgentChat>` instances | Render N stacked `<AgentChat>` (one per group member); user types in shared composer that forwards to all N | Zero new server code; reuses everything | Each AgentChat handles its own stream — UI shows N parallel transcripts instead of unified thread; no group-level state (history, participant list) |
| C. Hybrid — client fan-out + group-state API | N AgentChat for streaming, plus thin Next.js API for group metadata (name, members, message log) | Best of both | More moving parts, harder to reason about |

**Recommendation: A.** The unified thread with sender attribution is core to the value proposition (Demo.md Mode B). Client-side fan-out (B) gives N parallel transcripts which is fundamentally a different UX. A is more work but it's the right work; ship the API route + simple unified-thread UI in W4 even if some features (history pagination, participant management) wait for W5.

### D4 — User-aware session filtering — invisible default vs explicit selector

When Person A's `sessions.list { userToken }` filter lands, the dashboard needs to decide what to show:

| Option | What | When better |
|---|---|---|
| **A. Invisible auto-filter** | `sessions.list` always passes the connected user's `userToken`; dashboard never shows other users' sessions | `end_user` role; default for non-admin users |
| B. Explicit "viewing as" selector | Dropdown in header lets `manager` / `auditor` / `platform_admin` switch view to "all users" or specific user | Required for `manager` (SME-wide), `auditor` (read-only over all), `platform_admin` |
| C. Hybrid | A by default; B available only when `usePermission("sessions.read.all")` returns true | Likely correct end-state |

**Recommendation: C, ship A first.** W4 unblocks A immediately when Person A's filter lands; B becomes a Week 5 enhancement once `sentura-rbac` real implementation lets us check the broader scope. C is the eventual shape but stage it in two phases.

### D5 — Skeleton-shell content strategy for backend-blocked surfaces

The 4 surfaces (`/orchestrator`, `/knowledge`, `/cost`, `/testing`) are blocked by other-team backend work. Three approaches to "build something visible":

| Option | What | Pros | Cons |
|---|---|---|---|
| A. Full mock-data UI | Hard-code realistic data, build full UI; swap in real RPC when backend ships | Demo-able now | Throwaway when real schema differs; reviewers may approve as "done" prematurely |
| **B. Empty-state shell only** | Route + sidebar nav + page header + an explicit "Awaiting [owner] [deliverable]" empty card. No data, no widgets | Honest about state; design language locked (header, nav, layout); zero throwaway | Looks unfinished — but it IS unfinished |
| C. Skip entirely | Don't add routes until backend ships | Nothing to clean up | Sidebar nav grows piecemeal across weeks; designers can't see total surface area |

**Recommendation: B.** Establishes routes + sidebar nav + visual consistency now without faking deliverables. The "Awaiting X" copy is also a useful cross-team signal — when Person B reads it, they know `/knowledge` is blocked on their Data Scavenger output schema and may push it earlier.

---

## Phase 2 — Unblocked W3-slip surfaces (Day 2-3, 2026-04-27 → 2026-04-28)

- [ ] **`/tune`** (per D1 — chat-only MVP) — `src/app/tune/page.tsx` + Tuner-specific empty state with adjustment suggestion pills ("make tone friendlier", "add quarterly reminder", "tighten approval threshold"). Sidebar `/tune` link enabled, dynamic conversation count badge per `/chat` pattern.
- [ ] **`/integrations`** (per D2 — tabbed by tier) — `src/app/integrations/page.tsx` + 3 tab components (`integrations-tier1.tsx`, `tier2.tsx`, `tier3.tsx`). Reads MCP server config from `client.getConfig()` (`config.mcpServers` field). Per-tier table columns + tier-specific actions (T1: update; T2: regenerate; T3: re-auth). Sidebar `/integrations` link enabled.
- [ ] **TESTS.md C12 + C13 entries** — same template as C11.

**Acceptance:** `/tune` mounts AgentChat against the Tuner agent and streams a response within 5s. `/integrations` shows all configured MCP servers (Tier-1 npm packages, Tier-2 generated like `gradsale-admin`) correctly bucketed; T3 tab shows empty state today (no self-provisioned servers exist yet).

## Phase 3 — Skeleton shells for blocked surfaces (Day 4-5, 2026-04-29 → 2026-04-30)

- [ ] **`/orchestrator`** (skeleton) — route + sidebar nav + header "Mode B Orchestration" + empty card "Awaiting Person B's Orchestrator agent + Manager EKG schema (Week 4)"
- [ ] **`/knowledge`** (skeleton) — route + sidebar nav + header "Knowledge Manager" + empty card "Awaiting Person B's Data Scavenger output schema (Week 4)"
- [ ] **`/cost`** (skeleton) — route + sidebar nav + header "Cost Center" + empty card "Awaiting Person A's cost tracking backend (Week 4)"
- [ ] **`/testing`** (skeleton) — route + sidebar nav + header "Test Results" + empty card "Awaiting Person B's test runner output schema (Week 4)"
- [ ] **Sidebar nav cleanup** — flip the 4 sidebar items from `disabled: true, badge: "W4"` to enabled (linking to the new skeleton routes). Badges drop.

**Acceptance:** All 4 routes return HTTP 200 with consistent header/empty-state styling using `tokens.css` IAI tokens. Sidebar shows them as live nav targets. Each empty card names the blocking owner and deliverable.

## Phase 4 — Group Chat fan-out (Day 6-7, 2026-05-01 → 2026-05-02)

Per D3 (Next.js API route + SSE):

- [ ] **`/api/group-chat/[groupId]/send` route** — receives `{ message, participantAgentIds[] }`; opens N WebSocket sessions to gateway via Sentura-internal client; aggregates `chat` event streams; emits SSE frames `{ agentId, delta | final }` back to dashboard
- [ ] **Group metadata store** — start with `~/.openclaw/sentura-group-chats/groups.json5` (file-based for W4; SQLite/proper store later if needed). Schema: `{ id, name, participantAgentIds[], underlyingSessionKeys[], createdAt, archivedAt }`
- [ ] **`/chat` extension** — add a "Group" toggle in the picker; group view renders a single thread with sender chips per message instead of N parallel AgentChat instances
- [ ] **C14 TESTS.md row** — group chat stream merging + ordering + multi-agent attribution

**Acceptance:** Create a group with `billing-support-rep` + `main`; send "Status check"; both agents respond into a unified thread within 5s; sender chips clearly label which response came from which agent.

## Phase 5 — Ship + acceptance (Day 7, 2026-05-03)

- [ ] E2E manual: visit each new surface, verify navigation, open Tuner conversation, list integrations, verify all 4 skeletons load with correct copy
- [ ] Append a `## 2026-05-03 — Week 4 ship session` entry to this file documenting what landed, what slipped to Week 5, what backend deliverables actually shipped vs slipped
- [ ] Update `docs/TESTS.md` Person C count from N/11 to N/15 (assuming C12-C15 land)

---

## Open dependencies that might block

| What I need | From | Target | Fallback if late |
|---|---|---|---|
| `sessions.list { userToken }` filter | Person A | Mid-W4 | Skip user-aware filter; ship single-tenant view; user filter slips to W5 |
| Multi-tenancy namespace convention | Person A | Mid-W4 | Skip tenant selector entirely from W4; ship in W5 |
| Cost tracking event schema + aggregate API | Person A | End-W4 | `/cost` stays as skeleton; no W4 wiring |
| Orchestrator agent + Manager EKG schema | Person B | End-W4 | `/orchestrator` stays as skeleton |
| Data Scavenger output schema | Person B | End-W4 | `/knowledge` stays as skeleton |
| Test runner output schema (capability #15) | Person B | End-W4 | `/testing` stays as skeleton |
| Session helpers for group chat (`sessions.send` etc) | Person A | Mid-W4 | Group chat fan-out API uses raw WebSocket multiplexing instead of helper-based; uglier but works |
| `sentura-rbac` real implementation (for D4 option B/C) | Person D | W5 | D4 Option A only for W4; B/C come W5 |
| Tuner-side "pending change" event subtype (D1 option B) | Person B | W6-8 polish | D1 Option A (chat-only) covers W4 ship |

## Risks (Week 4 specifically)

1. **Skeleton-shell discipline drift** — under deadline pressure, "build a quick mock" is tempting. Mitigation: Phase 3 acceptance criteria explicitly bar mock data; reviewer (subagent or self) checks empty-state copy mentions blocking owner.
2. **Group chat over-scoping** — "unified thread with sender attribution" is the MVP scope; add nothing else (no group archive, no participant editing, no group nicknames) in W4. Polish in W5+.
3. **Backend deliverables slipping into W5** — likely for at least 2 of the 4 (cost backend + test runner are heavy). Sidebar shouldn't silently 404 if backend slips; skeleton shells gracefully say "still waiting." Acceptable.
4. **MCP server tier-3 has zero examples today** — `/integrations` T3 tab will look empty. Acceptable for W4; flag in Phase 2 acceptance ("T3 empty state visible" instead of "T3 shows ≥ 1 server").
5. **Group Chat API route is the first server-side code** in this dashboard — no team patterns exist for Next.js API routes here yet. Mitigation: keep the route narrow (single endpoint, no auth wrapping today), document the pattern thoroughly in JSDoc + README.

---

## Decisions log

(Append D1-D5 decisions here as they're made.)
