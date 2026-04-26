# Sentura Tests — Person C (Frontend & Dashboard)

> Detailed test cases. Summary matrix lives in `docs/TESTS.md`. Read on demand.

## Person C — Frontend & Dashboard Engineer

### C1. Dashboard Build & Lint

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C1.1 | Dependencies install | `cd sentura/dashboard && pnpm install` | Exit code 0; no peer dependency errors |
| C1.2 | TypeScript compiles | `cd sentura/dashboard && pnpm build` | Exit code 0; 0 TypeScript errors |
| C1.3 | Lint passes | `cd sentura/dashboard && pnpm lint` | Exit code 0; 0 lint errors |
| C1.4 | Dev server starts | `cd sentura/dashboard && pnpm dev` | Next.js dev server starts on port 3000; no runtime errors in console |
| C1.5 | Framework versions | Read `sentura/dashboard/package.json` | Next.js 16+, React 19+, Tailwind CSS 4 |

### C2. Gateway Client Library (`src/lib/gateway/`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C2.1 | Frame types correct | Read `types.ts` | Defines `RequestFrame` (`type: "req"`), `ResponseFrame` (`type: "res"`), `EventFrame` (`type: "event"`) — NOT JSON-RPC 2.0 |
| C2.2 | ConnectParams | Read `types.ts` | Has `ConnectParams` with protocol version, client.id, client.mode, auth.token |
| C2.3 | GatewayEventType union | Read `types.ts` | Includes `exec.approval.requested`, `exec.approval.resolved`, `plugin.approval.requested`, `plugin.approval.resolved`, `sessions.changed`, `health` |
| C2.4 | Handshake protocol | Read `client.ts` | Listens for `connect.challenge` event, responds with `connect` request containing `ConnectParams` |
| C2.5 | Client identity | Read `client.ts` | Uses `openclaw-control-ui` as client ID, `ui` as mode, protocol version `3` |
| C2.6 | Meta-agent filtering | Read `client.ts` | `getAgents()` filters out `creator`, `tuner`, `orchestrator`; `getAllAgentsIncludingMeta()` returns all |
| C2.7 | Approval routing | Read `client.ts` | `resolveApproval()` branches on `plugin:` prefix in approval ID to route to correct RPC method |
| C2.8 | RPC timeout | Read `client.ts` | RPC calls have 30-second timeout; promise rejects on timeout |
| C2.9 | Reconnect logic | Read `client.ts` | Auto-reconnect with configurable max attempts and interval; state transitions through disconnected → connecting → connected → reconnecting |
| C2.10 | Environment config | Read `client.ts` | `getGatewayClient()` reads `NEXT_PUBLIC_GATEWAY_URL` and `NEXT_PUBLIC_GATEWAY_TOKEN` from env |
| C2.11 | Approvals scope | Read `client.ts` | Client `scopes` array includes `operator.approvals` (required to receive `*.approval.requested`/`*.approval.resolved` events) |
| C2.12 | createSession helper | Read `client.ts` | `createSession(agentId, initialMessage?)` calls `sessions.create` RPC and returns `{ sessionKey, ... }` |
| C2.13 | Agent file helpers | Read `client.ts` | `listAgentFiles(agentId)` calls `agents.files.list`; `getAgentFile(agentId, name)` calls `agents.files.get` and tolerates missing/denied files by returning `null` |
| C2.14 | Bindings helper | Read `client.ts` | `getBindingsForAgent(agentId)` reads `config.bindings` and filters to this agent |
| C2.15 | getAgent includes meta | Read `client.ts` | `getAgent(agentId)` uses `getAllAgentsIncludingMeta()` so `creator`/`tuner`/`orchestrator` can still be fetched by ID |
| C2.16 | deleteAgent helper | Read `client.ts` | `deleteAgent(agentId, { deleteFiles? })` calls `agents.delete` with optional workspace purge; returns `{ ok, agentId, removedBindings? }` |
| C2.17 | resolveApproval options | Read `client.ts` | Accepts `options.kind` (`exec`/`plugin`) to route, and optional `reason` string — passed through to the RPC payload |
| C2.18 | List historical approvals | Read `client.ts` | `listExecApprovals()` and `listPluginApprovals()` call `exec.approval.list` and `plugin.approval.list` respectively; return `[]` on RPC error |

### C3. React Hooks (`src/lib/gateway/hooks.ts`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C3.1 | useGateway hook | Read `hooks.ts` | Manages connection lifecycle; returns client instance + connection state |
| C3.2 | useAgents hook | Read `hooks.ts` | Calls `getAgents()` (filtered); returns agents array, loading, error, refetch |
| C3.3 | useApprovals hook | Read `hooks.ts` | Accumulates approval events by ID (deduplication); listens to both exec and plugin approval events |
| C3.4 | Cleanup on unmount | Read `hooks.ts` | Event subscriptions are cleaned up when components unmount (unsubscribe functions called) |
| C3.5 | useApprovals seeds history | Read `hooks.ts` | On connect, `useApprovals` calls `client.listExecApprovals()` + `client.listPluginApprovals()` and merges results into state without duplicating IDs already received via live events |
| C3.6 | useApprovals resolves cleanup | Trigger a resolve on any pending approval | Approval is removed from the `useApprovals()` data array on `*.approval.resolved` event |

### C4. App Shell & Navigation

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C4.1 | Sidebar renders | Load dashboard in browser | Sidebar shows three sections: Enterprise, Management, Operations |
| C4.2 | Active route highlighting | Navigate between Overview and Employees | Active page is highlighted in the sidebar |
| C4.3 | Disabled items | Check sidebar items marked W3–W5 (Tune Employee, Channel Bindings, etc.) | Items are visually disabled; clicking does not navigate |
| C4.4 | Control UI links | Check Operations section in sidebar | External links to OpenClaw Control UI use `NEXT_PUBLIC_CONTROL_UI_URL` env var |
| C4.5 | Sidebar collapse | Click collapse toggle | Sidebar collapses; tooltips appear on hover for icon-only mode |
| C4.6 | Connection status | Check header area | Shows colored dot + label matching gateway connection state |
| C4.7 | App shell layout | Load any page | Full viewport height; sidebar + header + scrollable main content area |
| C4.8 | Create/Approvals enabled | Check Management and Operations sections | `/create` and `/approvals` are enabled (navigable) with no disabled styling |
| C4.9 | Live approval badge | Trigger a pending approval while dashboard is connected | Sidebar "Approvals" link shows numeric badge with destructive/alert tone equal to pending count; badge disappears when count drops to 0 |

### C5. Enterprise Overview Page (`/`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C5.1 | Page loads | Navigate to `/` | Page renders without errors |
| C5.2 | Disconnected banner | Load page without gateway running | "Gateway Disconnected" banner appears with guidance |
| C5.3 | Employee count | Load page with gateway running and agents registered | Stat card shows correct number of AI employees (excluding meta-agents) |
| C5.4 | Pending approvals | Check approval stat card | Shows count from event-driven approval list (may be 0 if no pending approvals) |
| C5.5 | Loading skeletons | Observe page during data fetch | Skeleton placeholders appear while data loads |
| C5.6 | Employee cards | Check bottom section | Shows up to 6 employee cards with links to `/employees/{id}` (path param, not query string) |
| C5.7 | Control UI link | Check System Health card | Links to Control UI at correct URL |
| C5.8 | Create Employee quick action | Click "Create Employee" card in Quick Actions | Navigates to `/create`; card is no longer dimmed/disabled |

### C6. Employee Roster Page (`/employees`)

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C6.1 | Page loads | Navigate to `/employees` | Table renders without errors |
| C6.2 | Agent listing | With registered agents | Table shows agent ID, name, model, tools, sandbox status |
| C6.3 | Search filter | Type in search box | Filters agents by ID, name, or model substring match |
| C6.4 | Refresh | Click refresh button | Triggers data refetch; table updates |
| C6.5 | Empty state | No agents registered (or all filtered out) | Empty state message displayed |
| C6.6 | Error state | Gateway disconnected during fetch | Error card displayed |
| C6.7 | Meta-agents excluded | Check table contents | `creator`, `tuner`, `orchestrator` do not appear in the roster |
| C6.8 | Status column | Check Status column | Shows "active" for all agents (placeholder — lifecycle not implemented yet) |
| C6.9 | Config link | Check row actions | External link to Control UI raw config for each agent |
| C6.10 | Create Employee enabled | Check action buttons | "Create Employee" button is enabled and links to `/create`; "Tune" remains disabled (Week 3) |
| C6.11 | Row click navigates | Click anywhere on an agent row (outside the action links) | Navigates to `/employees/{id}` detail page |

### C7. Environment Configuration

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C7.1 | .env.local.example | Read `sentura/dashboard/.env.local.example` | Contains `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_GATEWAY_TOKEN`, `NEXT_PUBLIC_CONTROL_UI_URL` |
| C7.2 | Default gateway URL | Check code | Defaults to `ws://localhost:18789` when env var not set |
| C7.3 | Default Control UI URL | Check sidebar code | Defaults to `http://localhost:18789` when env var not set |

### C8. Employee Creator Page (`/create`) — Week 2

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C8.1 | Page loads | Navigate to `/create` | Page renders without runtime errors; shows chat composer and streaming transcript area |
| C8.2 | Disconnected banner | Load page without gateway running | Shows "Gateway disconnected" state; composer is disabled or shows guidance |
| C8.3 | Session creation | Send first message | Dashboard calls `sessions.create` for the `creator` meta-agent; subsequent messages reuse the returned `sessionKey` |
| C8.4 | Message streams | Send a message that triggers a non-trivial Creator response | UI renders incremental deltas from `chat` events with `state: "delta"`, then finalizes on `state: "final"` |
| C8.5 | Creator target | Inspect `chat.send` payload (network tab or `NEXT_PUBLIC_GATEWAY_VERBOSE=1` logs) | `agentId` is `creator` (meta-agent), not a real employee |
| C8.6 | Error handling | Disconnect gateway mid-stream | Assistant message is marked as errored or truncated; composer becomes re-enabled; user can retry |
| C8.7 | Composer keyboard | Press Enter in textarea | Submits message; Shift+Enter inserts newline |
| C8.8 | Transcript scrolls | Send several messages | Transcript auto-scrolls to newest message |
| C8.9 | Cross-link to new employee | When Creator finishes deploying an employee and mentions its id | User can navigate to `/employees/{id}` (either via a link in the UI or via the roster) and see the new agent |
| C8.10 | Session key persists across navigation | Start a chat, navigate away to `/employees`, then back to `/create` | Previous messages are restored via `chat.history`; session badge shows same id; a "Restoring conversation…" indicator briefly appears |
| C8.11 | Session key persists across reload | Start a chat, hard-reload `/create` | After gateway reconnects, transcript is rehydrated; composer reuses the saved `sessionKey` for the next `chat.send` |
| C8.12 | New conversation button | With an active session, click "New" in the header | `sessionKey` and `messages` cleared; `localStorage["sentura.create.sessionKey"]` removed; next message calls `sessions.create` again |
| C8.13 | Stale session recovery | Manually delete the session server-side (or wait for pruning) while a saved `sessionKey` is in `localStorage`, then load `/create` | Hydration fails gracefully; saved key is dropped; empty state renders; user can start a new conversation |
| C8.14 | Idempotency key on chat.send | Send a second message in an existing session | `chat.send` payload includes a non-empty `idempotencyKey` (auto-generated via `crypto.randomUUID`); gateway does not reject with `missing property 'idempotencyKey'` |
| C8.15 | Conversation sidebar renders | Load `/create` with multiple prior creator sessions on the gateway | Left sidebar lists one entry per session filtered to `agentId=creator`; entries show label/displayName and relative `updatedAt`; most recent sits on top |
| C8.16 | New employee draft flow | Click "+ New employee" in the sidebar | A new draft appears as the active conversation with default label "New employee"; transcript area clears; no `sessions.create` call is made yet |
| C8.17 | First message creates server session | Send the first message in a draft | `sessions.create` is called with `{ agentId: "creator", message, label }`; returned `sessionKey` becomes `activeKey`; sidebar refreshes and shows the new entry |
| C8.18 | Switching conversations rehydrates transcript | With ≥2 creator sessions, click another entry in the sidebar | Current transcript clears; `chat.history` is called for the selected `sessionKey`; previous messages render; composer targets the selected session |
| C8.19 | Rename conversation | Click the rename affordance on a sidebar row, edit label, submit | `sessions.patch` is called with `{ key, label }`; sidebar label and header title update immediately; reload confirms label persists |
| C8.20 | Delete conversation | Click delete on a sidebar row and confirm in the dialog | `sessions.delete` is called with `{ key }` (not `sessionKey`); entry disappears; if it was active, view falls back to welcome state or nearest sibling |
| C8.21 | Active conversation persisted across reloads | Select a conversation, hard-reload `/create` | `localStorage["sentura.create.activeKey"]` restores selection; transcript rehydrates via `chat.history`; draft label is restored if the active item is a draft |

### C9. Employee Detail Page (`/employees/[id]`) — Week 2

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C9.1 | Page loads | Navigate to `/employees/{existing-agent-id}` | Page renders with agent name, id, and header actions |
| C9.2 | Agent not found | Navigate to `/employees/does-not-exist` | Friendly "not found" state; link back to `/employees` |
| C9.3 | Workspace file list | Check file section | Shows the 8 native files from `agents.files.list` (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) and `skills/*` |
| C9.4 | Allow-list content | Click into `SOUL.md` or another allow-listed file | File content is rendered inline |
| C9.5 | Denied file fallback | Click into a file not in the dashboard allow-list | File entry appears in list, but content panel shows an "Edit in Control UI" link instead of raw content (no RPC error surfaced to the user) |
| C9.6 | Channel bindings | Section lists bindings | Calls `config.bindings` via `getBindingsForAgent`; shows channel name + target for bindings scoped to this agent |
| C9.7 | Refresh action | Click Refresh | Reloads agent config, files list, and bindings without full page reload |
| C9.8 | Tune disabled | Check Tune button | Present but disabled with "Week 3" tooltip |
| C9.9 | Edit in Control UI | Click the Control UI link | Opens external link to `${NEXT_PUBLIC_CONTROL_UI_URL}` targeting this agent's config |
| C9.10 | Retire (confirmation) | Click Retire | Confirmation dialog appears; cancelling closes dialog without calling `agents.delete` |
| C9.11 | Retire (delete) | Confirm retirement | Calls `client.deleteAgent(agentId)`; on success redirects to `/employees`; agent no longer appears in roster |
| C9.12 | Meta-agent fetch | Navigate to `/employees/creator` | Page loads (meta-agents are not hidden from detail view via direct URL) — confirms `getAgent` uses `getAllAgentsIncludingMeta` |

### C10. Approval Queue Page (`/approvals`) — Week 2

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C10.1 | Page loads | Navigate to `/approvals` | Page renders with header, Control UI link, and pending count |
| C10.2 | Empty state | No pending approvals | Shows empty-state message (e.g. "No pending approvals") |
| C10.3 | Disconnected state | Load page without gateway | Card warns user that live approvals require the gateway; list area is empty |
| C10.4 | Historical seed | Start gateway with existing pending approvals, then load `/approvals` | All pre-existing pending approvals appear (seeded via `exec.approval.list` + `plugin.approval.list`) — page does NOT require a fresh event to show them |
| C10.5 | Live request event | Trigger a new high-risk tool call from an employee | New approval card appears in the list without page reload |
| C10.6 | Live resolved event | Approve/deny an approval from another client (e.g. Control UI) | Card disappears from this page within ~1s |
| C10.7 | Exec vs plugin kind | Inspect cards | Exec approvals show a terminal icon + command (`$ ...` code block); plugin approvals show a shield icon + plugin title/subtitle |
| C10.8 | Countdown timer | Card with `expiresAtMs` in the future | Shows remaining time; updates once per second; becomes urgent (alert tone) near expiry |
| C10.9 | Show details toggle | Click "Show details" | Expands to show full raw request payload as formatted JSON; toggles back on second click |
| C10.10 | View employee link | Click "View employee" | Navigates to `/employees/{agentId}` of the approval's agent |
| C10.11 | Approve once | Click Approve once → confirm | Calls `client.resolveApproval(id, "allow-once", { kind, reason })`; card removed |
| C10.12 | Always allow | Click Always allow → confirm | Calls `resolveApproval` with `"allow-always"` — confirmation dialog explicitly warns this persists |
| C10.13 | Deny with reason | Click Deny → type reason → confirm | Calls `resolveApproval` with `"deny"` and the typed `reason`; audit log (via sentura-audit) should contain this reason |
| C10.14 | Confirmation cancel | Open any decision dialog → click Cancel or press Escape | Dialog closes with no RPC call; reason field and any error reset |
| C10.15 | RPC error handling | Simulate RPC failure (e.g. kill gateway mid-confirm) | Error message shown inline on the dialog; card remains pending; user can retry |
| C10.16 | Sidebar sync | Resolve an approval on this page | Sidebar badge count decrements via `useApprovals` (same source) without manual refresh |
| C10.17 | Scope required | Verify client connects with `operator.approvals` scope | Events actually arrive; if scope is stripped, approvals never appear even when triggered (regression guard) |

### C11. Chat — 1:1 (`/chat`) — Week 3

The first surface that mounts the shared `<AgentChat>` component (D2 contract) outside of `/create`. Acceptance criteria from `docs/memory/person-c/week-3.md` Phase 3: fresh conversation streams, refresh resumes, multi-tab independent, sidebar badge updates live.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C11.1 | Page loads | Navigate to `/chat` | Two-pane layout renders: sidebar with "+ New chat" + conversation list, right pane with "No conversation selected" empty card |
| C11.2 | Sidebar empty state | No prior sessions on the gateway | Sidebar shows "No conversations yet. Click New chat to start one with an AI employee." |
| C11.3 | Picker opens | Click "+ New chat" | `EmployeePickerDialog` modal opens with title "Start a new conversation" |
| C11.4 | Picker filters meta-agents | Inspect picker contents | Only real employees appear (`billing-support-rep`, `penny-ap`, etc.); meta-agents (`creator`, `tuner`, `orchestrator`, `mcp-builder`) are NOT listed — confirms `getAgents()` filter is in effect |
| C11.5 | Pick agent → draft mode | Click an agent in picker | Picker closes; sidebar shows a draft row at top with the agent name + "Draft — send a message to start"; URL becomes `/chat?draft=<agentId>`; right pane shows AgentChat with "Say hello to {agent name}" empty state |
| C11.6 | First send creates session | Type a message, hit Enter in draft mode | `client.createSession(agentId, message)` fires; on success URL updates to `/chat?key=<sessionKey>` (draft param dropped); user message + streaming assistant response appear in transcript; sidebar draft row replaced by real conversation row under the agent's group |
| C11.7 | Conversation switching | Click a different conversation in sidebar | URL updates to `/chat?key=<otherKey>`; right pane re-mounts AgentChat (`key` prop forces remount) so prior message state doesn't bleed; new conversation's transcript hydrates |
| C11.8 | Group + sort order | Have ≥ 2 sessions across ≥ 2 agents | Sidebar groups by agent (header shows agent name + count badge); within each group sessions sorted by `updatedAt` desc; groups themselves ordered by most-recent activity within the group |
| C11.9 | Delete conversation | Click trash icon on a row → confirm | `client.deleteSession(key, { deleteTranscript: true })` fires; row disappears from sidebar; if it was the active conversation, URL drops `key` param and right pane returns to "No conversation selected" |
| C11.10 | Stale URL key | Open `/chat?key=<deleted-or-bogus-key>` | Page loads; once `sessions.list` returns, the stale key is detected (`!sessions.some(s => s.key === activeKey)`) and dropped from URL gracefully (no permanent loading spinner in right pane) |
| C11.11 | Disconnect banner | Stop the gateway with a session active | Red banner appears: "Gateway disconnected. Messages will queue once the connection is restored." AgentChat input becomes disabled but transcript remains visible |
| C11.12 | **Acceptance #1** — fresh conversation streams in <5s | Pick `billing-support-rep` from picker, send "Hello, what can you help with?" | First streamed delta arrives within 5s; `chat` events accumulate visibly into the assistant bubble; final frame commits with the bubble fully rendered |
| C11.13 | **Acceptance #2** — refresh restores conversation | Mid-conversation, hit browser refresh | Same `?key=` param in URL means same conversation reloads; `chat.history(sessionKey)` repopulates the full transcript; user can continue chatting without re-selecting anything |
| C11.14 | **Acceptance #3** — multi-tab independence | Open `/chat?key=A` in tab 1 and `/chat?key=B` in tab 2 | Each tab shows its own conversation; sending in tab 1 doesn't disturb tab 2's transcript or input; `sessionKey` filtering in AgentChat's chat-event subscriber prevents cross-tab leak |
| C11.15 | **Acceptance #4** — sidebar badge live update | Tab 1 viewing `/chat`; tab 2 creates a new conversation via `/chat` New button | Tab 1's sidebar `/chat` link badge increments within ~1s without manual refresh — proves `useGatewayEvents({ "sessions.changed": refetchSessions })` wires through to the dashboard's global Sidebar |
| C11.16 | URL state survives navigation | Active conversation, navigate to `/employees` then back via browser-back | Browser-back returns to `/chat?key=<sessionKey>`; conversation pane restores from URL — confirms `router.replace` (not `push`) on selection means back button doesn't accumulate noise |
| C11.17 | Permission stub gating | Inspect `usePermission` adoption (deferred to Week 5 swap-in) | `/chat` is a read+chat surface; no high-risk mutation buttons require gating today. When sentura-rbac lands in Week 5, gate the picker via `usePermission("sessions.read")` if the role lacks chat access entirely |

### C12. Tune Employee — 1:1 (`/tune`) — Week 4

Single-agent surface targeting the Tuner ("Refine") meta-agent. Mounts the shared `<AgentChat>` (D2 contract from Phase 2) with `agentId="tuner"` hard-coded; sidebar lists past Tuner sessions only (filter via `sessions.list { agentId: "tuner" }`). Per Week 4 D1: chat-only MVP — no inline diff panel; the Tuner verbally describes proposed changes and routes the actual apply through `/approvals`.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C12.1 | Page loads | Navigate to `/tune` | Two-pane layout renders: sidebar with "+ New tuning" + (potentially empty) tuning list; right pane with empty state "What needs tuning?" + 4 suggestion pills + "include the target employee's ID" tip |
| C12.2 | Sidebar empty state | No prior Tuner sessions on the gateway | Sidebar shows "No tuning conversations yet. Click New tuning to start one." |
| C12.3 | Sidebar filtered to Tuner only | Have other agents' sessions on the gateway (e.g. from `/chat` or `/create`) | `/tune` sidebar lists ONLY conversations with `agentId === "tuner"`; other-agent conversations don't leak in (proves `sessions.list { agentId }` filter is respected) |
| C12.4 | First send creates session | Type a message in draft mode, press Enter | `client.createSession("tuner", message)` fires; URL adopts `?key=agent:tuner:dashboard:<uuid>`; user message appears immediately in transcript (no remount-flash empty state — the `key` prop on AgentChat is intentionally NOT bound to sessionKey to avoid remount on the undefined→defined transition); session row appears at top of sidebar |
| C12.5 | Streaming response | Wait for Tuner reply | First delta arrives within ~5s; bubble accumulates via `chat` event subscription; "Progress · N steps" dropdown shows tool calls Refine made (typically `gateway` `config.get` + agents lookups for "what can I tune") |
| C12.6 | Tuner Hard Rules visible | Ask "what can you help me adjust?" | Response mentions guardrails: preserve identity, show diff before apply, never weaken safety, never expose secrets. Confirms Refine's `AGENTS.md` Hard Rules are loaded into context |
| C12.7 | Switch between tunings | Click a different tuning in sidebar | URL updates to new `?key=`; transcript clears and re-hydrates from `chat.history` for the selected session; AgentChat does NOT remount (no `key` prop) but its internal `prevSessionKeyRef` reset effect handles the A→B switch correctly |
| C12.8 | Sandbox failure surfaces | Tuner agent configured with `sandbox.mode: "non-main"` on a host without Docker | Assistant frame contains a system-error message describing the sandbox failure (e.g. "Sandbox mode requires Docker, but the 'docker' command was not found in PATH"); does not silently hang. Workaround documented in `docs/SETUP.md`: patch all 4 meta-agents to `sandbox.mode: "off"` for local dev |
| C12.9 | Diff panel deferred | Inspect right pane during a config-change request | No inline before/after diff panel today (per Week 4 D1: chat-only MVP). Diffs land in `/approvals` via the `exec.approval.requested` payload that the Tuner generates when it's ready to apply. Inline diff panel deferred to Week 6-8 polish once Tuner emits a "pending change" event subtype |

### C13. Integrations — MCP server manager (`/integrations`) — Week 4

Tabbed-by-tier layout per Week 4 D2 — three lifecycle paths each get their own table and actions. Today (zero MCP servers configured) all three tabs render explanatory empty states; classification logic ships now so behavior is correct the moment real entries arrive.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C13.1 | Page loads | Navigate to `/integrations` | Header "Integrations" + 3-tier description; Refresh + Edit-raw-config buttons; Tabs row with T1/T2/T3 tabs each showing live count badge `Tn · N` |
| C13.2 | All-empty state | Zero MCP servers configured (default fresh setup) | All three tabs show count `· 0`; T1 (default-selected) renders the "No open-source MCP servers configured" card with explanatory copy + npx command snippet; switching to T2 and T3 shows their tier-specific empty cards |
| C13.3 | Refresh action | Click Refresh button | Calls `client.getConfig()` again; on connected gateway re-renders the tabs with updated counts; on disconnected gateway shows the destructive disconnect banner |
| C13.4 | Tier classification — explicit override | MCP entry with `sentura.tier: 2` | Lands in T2 tab regardless of command/args (explicit metadata wins over heuristic) |
| C13.5 | Tier classification — path heuristic | MCP entry with `command: "node"` and `args[0]` containing `sentura/mcp-servers/` | Lands in T2 tab even without explicit `sentura.tier` field |
| C13.6 | Tier classification — SaaS heuristic | MCP entry with `sentura.saasProvider: "Stripe"` | Lands in T3 tab; status badge renders if `sentura.status` is set |
| C13.7 | Per-agent MCP discovery | Agent in `agents.list` with `mcpServers: { foo: {...} }` | `/integrations` table includes `foo` (proves the extractor walks both top-level `mcp` and `agents[].mcpServers`); de-duplication by name avoids double-listing if a server appears in both places |

### C14. Skeleton shells — `/orchestrator` `/knowledge` `/cost` `/testing` — Week 4

Backend-blocked surfaces shipped as honest empty-state placeholders per Week 4 D5. Each route mounts the shared `<SkeletonShell>` component (DRY across the 4 pages) naming its blocking owner + deliverable.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C14.1 | All 4 routes return 200 | `curl http://localhost:3000/{orchestrator,knowledge,cost,testing}` | Each returns HTTP 200; no 404 placeholders, no broken nav targets |
| C14.2 | Sidebar links enabled | Inspect sidebar `Management` section | `/cost`, `/orchestrator`, `/knowledge`, `/testing` all rendered as enabled links (no `pointer-events-none opacity-40` styling, no `W4` badge). `/audit` still disabled with `W5` badge (intentional — it's Person D's W5 audit-log work) |
| C14.3 | Each shell names its blocker | Inspect each page | Header has `{Week} placeholder` badge; empty card body explicitly names the blocking owner ("Person A" / "Person B") and the specific deliverable ("Orchestrator agent + Manager EKG schema" / "Data Scavenger output schema" / "cost tracking backend (LLM call interceptor + ...)" / "test runner output schema") |
| C14.4 | "Will include" expectations published | Each page lists 4 bullets describing what the surface will eventually contain | Bullet copy is concrete (e.g. /orchestrator: "Task decomposition view — top-level goal → subtasks → assigned employees", /knowledge: "EKG browser — 4 pillars (org / rules / assets / workflows) per agent with provenance"). This sets reviewer expectations and gives the blocking owner a hint about the dashboard's input contract |
| C14.5 | Zero mock data | Inspect page source | No fake numbers, no placeholder rows, no "lorem ipsum" data. Per Week 4 D5: a mock-data UI looks done; reviewers stop scrutinizing it; when real data has a different shape than the mock, both UI and tests need rewriting. Honest empty state is the choice |

### C15. Group Chat fan-out (capability #16 Phase 2) — Week 4

Per Week 4 D3 (Next.js Route Handler + SSE). First server-side code path on the dashboard. Group metadata persists at `~/.openclaw/sentura-group-chats/groups.json`; group transcripts are intentionally NOT persisted (each participant's underlying gateway session retains their slice — group view is a per-tab ephemeral merge of in-flight responses, simplifying the data model and keeping Phase 4 in 5 net new files).

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C15.1 | Page renders new group button | Navigate to `/chat` | Sidebar header shows BOTH "+ New chat" (primary) AND "+ New group" (outline variant); existing 1:1 button styling unchanged |
| C15.2 | Empty groups state | Fresh setup with no groups | Sidebar omits the "GROUPS" section entirely (no empty header); empty-state copy mentions both "New chat" and "New group" CTAs |
| C15.3 | Group creation flow | Click "+ New group" → multi-select 2+ agents → name "QA Triage" → Create | `POST /api/groups` returns 201; sidebar gains "GROUPS · 1" section with "QA Triage · 2 agents"; URL changes to `?groupKey=<id>`; right pane swaps from `<AgentChat>` to `<GroupChat>` showing group name + participant chips + "Broadcast to N agents" empty state |
| C15.4 | Group fan-out send | In group view, type "Status check" → Send | `POST /api/groups/[id]/send` opens SSE stream; user message appears immediately; for each participant: `started` frame logs the new sessionKey (recorded back to groups.json via `recordSessionKey`); per-agent assistant bubbles stream in parallel via `delta` frames; sender chip on each bubble identifies which agent (via `agents[agentId].name` lookup); each finalizes via `final` frame |
| C15.5 | Best-effort partial failure | Configure one of the participating agents to be temporarily unhealthy (e.g. delete its workspace mid-flight) and send | Other agents still stream their replies normally; failing agent's bubble is replaced by an inline `agent-error` system message naming the agent and the error; the SSE `done` frame fires only after ALL participants reach terminal state (success OR error); does NOT abort the whole fan-out |
| C15.6 | URL state survives refresh | After group send completes, hit browser refresh | `?groupKey=<id>` persists; `/api/groups` rehydrates the groups list on mount; sidebar reselects the group; right pane re-mounts `<GroupChat>` (transcript intentionally empty per MVP design — D3 follow-up may merge per-agent transcripts in W5) |
| C15.7 | Stale groupKey cleanup | Open `/chat?groupKey=ghost-id` directly (id doesn't exist) | After `groupsLoaded` flag flips true and the id isn't found, `setUrlState({ groupKey: null })` strips the param; right pane shows the standard "No conversation selected" card. No infinite loading spinner |
| C15.8 | Switch between group + 1:1 | While in group mode, click an existing 1:1 conversation in the sidebar | URL clears `groupKey` and sets `key`; `<GroupChat>` unmounts (clearing its in-memory transcript) and `<AgentChat>` mounts. Switching back to the group later starts a fresh group view (no stale state from prior session) |

### C16. 7-role RBAC enforcement (Week 5 Phase 2)

Per Week 5 D1 (hard-hide). Source-of-truth matrix mirrors `sentura/extensions/sentura-rbac/DESIGN.md` § 4 — 7 roles × 11 actions encoded in `src/lib/auth/roles.ts`. Current role sourced from `useCurrentRole()`: localStorage value (set by dev `<RoleSwitcher>`) with `?as=<role>` URL param as one-shot override; default `platform_admin` for single-tenant local-dev. SSO swap (W6+) replaces the role source — hook signature stays identical.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C16.1 | Default role is platform_admin | Fresh setup, no localStorage, no `?as=` param | Sidebar shows ALL 18 nav items + 6 Operations links; sidebar bottom shows "Platform Admin" label; no surface is hidden |
| C16.2 | Role switcher visibility gated | `NEXT_PUBLIC_ENABLE_ROLE_SWITCHER` unset | Switcher button does NOT appear in sidebar bottom; with env=`1` the switcher button appears with current role label + "dev" badge |
| C16.3 | Hard-hide nav (viewer) | Switch to `viewer` via switcher | Sidebar shrinks: only Overview + Employees + Cost Center visible (the 4 read-only surfaces a viewer can access). Empty section headers (Operations, etc.) entirely dropped |
| C16.4 | Hard-hide nav (end_user) | Switch to `end_user` | Sidebar shrinks further: only Chat + Approvals visible (end_user has `sessions.read` + `approvals.resolve` only). All `Management` and `Operations` sections hidden |
| C16.5 | Hard-hide action buttons (auditor on /approvals) | Switch to `auditor`, navigate to `/approvals` | Page renders with the approval queue (auditor has `audit.read`). The Approve once / Always allow / Deny buttons are NOT rendered (no disabled stub). Show details + View employee links remain |
| C16.6 | Hard-hide action buttons (auditor on /employees/[id]) | Open any employee detail as auditor | Retire button is NOT in DOM. Refresh + Edit in Control UI links remain |
| C16.7 | /403 redirect on direct URL access | As `viewer`, navigate directly to `/create` | `<RequirePermission>` wrapper checks `agents.create`, fails, redirects to `/403`. Page shows ShieldOff icon + "Access denied" + current role label + "Back to overview" link |
| C16.8 | Role persistence across navigation | Switch to `manager` via switcher → click any sidebar item → refresh page | Selected role survives navigation (localStorage write); refresh re-reads localStorage; sidebar still shows manager-scoped nav set. Clearing site data resets to `platform_admin` |

### C17. `/settings` 7-tab framework (Week 5 Phase 3)

Per Week 5 D3 (tabs with `?tab=<id>` URL state). Top-tab nav: 7 categories (Gateway / RBAC / Scopes / SSO / Approvals / Audit retention / About). Each tab is its own component file under `src/app/settings/`. Real tabs read from gateway today; skeleton tabs use new `<SkeletonBlock>` helper (smaller in-tab cousin of full-page `<SkeletonShell>`). Sidebar `Settings` link gated by `usePermission("settings.write")` so non-admin roles don't see it.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| C17.1 | `/settings` loads with default tab | Navigate to `/settings` (no `?tab=`) | Lands on Gateway tab; tab nav shows 7 pills with status markers (`partial` on RBAC, `skeleton` on Scopes / SSO / Audit retention, none on Gateway / Approvals / About) |
| C17.2 | Gateway tab shows real connection data | Connected gateway | Connection card shows status `connected` (green badge), WebSocket URL `ws://localhost:18789`, Control UI link. Server card shows OpenClaw version (e.g. `2026.4.19-beta.2`), protocol `v3`, conn ID, payload/buffer limits. Capabilities card shows ≥ 100 RPC methods + ≥ 5 events as inline `<code>` chips |
| C17.3 | Approvals tab graceful empty state | Connected to gateway with no `exec.approvals` / `plugins.approvals` configured (default dev setup) | Both cards show count `(0)` + helper copy explaining defaults apply ("every sensitive exec/plugin action prompts the operator") + path to configure (`~/.openclaw/openclaw.json` under `exec.approvals`); "Edit policy" button visible but disabled with W6-deferred title |
| C17.4 | Approvals tab populated rows | Add at least one entry to `exec.approvals` in openclaw.json | Card count updates to N; row shows pattern as monospace `<code>`, optional reason as muted subtext, decision badge color-coded (green=auto-allow, amber=ask, red=deny) |
| C17.5 | RBAC matrix renders 7 × 11 | Open `/settings?tab=rbac` | Table renders with columns for all 7 roles + rows for all 11 actions; checkmarks (✓ green) appear where `ROLE_PERMISSIONS[role].has(action)` is true, dashes (—) where not. Spot-check: `agents.delete` only has ✓ in `Platform Admin` column |
| C17.6 | RBAC user-assignment skeleton block | Same tab, scroll down | Second card "User assignments" shows `<SkeletonBlock>` "Awaiting Person D" + `sentura-rbac user / role lookup RPC + dashboard wiring` (Week 5) + 4 willInclude bullets |
| C17.7 | About tab versions + posture | Open `/settings?tab=about` | Versions card shows `Sentura dashboard v0.1.0` + `OpenClaw runtime 2026.4.19-beta.2` (live from server-info). Deployment posture card shows mode/cloud/data-residency. Resources card has 3 GitHub links (all open in new tab) |
| C17.8 | Skeleton tabs name their blocker | Open each of `/settings?tab={scopes,sso,audit-retention}` | Each renders `<SkeletonBlock>` with explicit blocking owner (`Person A` for scopes/sso, `Person D` for audit-retention) + concrete deliverable copy + 4 willInclude bullets describing eventual functionality |
| C17.9 | URL state survives refresh + tab clicks update URL | Open `/settings?tab=sso` → refresh → click "Approvals" tab button | After refresh URL `?tab=sso` persists, SSO tab still active. After tab click URL becomes `?tab=approvals` via `router.replace` (no scroll, no history pollution). Sidebar `Settings` link href = `/settings` so clicking it returns to default Gateway tab |

---

