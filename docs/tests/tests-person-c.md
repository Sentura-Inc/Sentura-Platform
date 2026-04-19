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

---

