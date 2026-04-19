> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Read when the current task touches the specific subsystem this session covered.

# Person C — Dashboard & Control UI — Week 1

Sessions that scaffolded the Next.js dashboard, wired the gateway WebSocket RPC client, delivered the employee roster & session view, realigned to the hybrid (Approach C) control-UI + Sentura-custom strategy, and drafted the Sentura Communication Panel design.

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-06 | Week 1 Person C: Dashboard Scaffold, RPC Client, App Shell, Employee Roster, Session View |
| 2026-04-06 | Fix: Gateway WebSocket Protocol Alignment |
| 2026-04-06 | Hybrid Dashboard Revision (Approach C) |
| 2026-04-08 | Sentura Communication Panel Design & Plan |

---

## 2026-04-06 — Week 1 Person C: Dashboard Scaffold, RPC Client, App Shell, Employee Roster, Session View

**What was done:**

All 5 Person C Week 1 tasks completed:

1. **Scaffolded Sentura dashboard** (`sentura/dashboard/`):
   - Next.js 16.2.2 (App Router) with TypeScript strict mode
   - Tailwind CSS v4 with shadcn/ui v4 (base-ui/react)
   - 14 shadcn/ui components installed: button, card, badge, table, scroll-area, separator, skeleton, tooltip, avatar, input, sheet, tabs, dialog, dropdown-menu
   - Geist font family (sans + mono)
   - Dark mode support via CSS custom properties (oklch color scheme)
   - `.env.local.example` with `NEXT_PUBLIC_GATEWAY_URL` and `NEXT_PUBLIC_GATEWAY_TOKEN`

2. **Built the Gateway WebSocket RPC client library** (`src/lib/gateway/`):
   - `types.ts` — full TypeScript interfaces for AgentConfig, SessionSummary, TranscriptMessage, ApprovalRequest, RpcRequest/Response, GatewayEvent, GatewayClientOptions
   - `client.ts` — `GatewayClient` class with:
     - WebSocket connection management with auto-reconnect (configurable max attempts + interval)
     - JSON-RPC 2.0 protocol with `rpc<T>()` generic method and 30s timeout
     - Event subscription system (`on()` returns unsubscribe function)
     - Connection state tracking (disconnected/connecting/connected/reconnecting)
     - Typed convenience methods: `getAgents()`, `listSessions()`, `getTranscript()`, `sendChat()`, `listApprovals()`, `resolveApproval()`, `health()`, `listModels()`, `listTools()`
     - Singleton `getGatewayClient()` factory using env vars
   - `hooks.ts` — React hooks for gateway data:
     - `useGateway()` — manages connection lifecycle, returns client + state
     - `useAgents()`, `useSessions()`, `useTranscript()`, `useApprovals()` — data-fetching hooks with loading/error/refetch
     - `useGatewayEvent()` — subscribe to real-time gateway events
   - `index.ts` — clean re-exports

3. **Created the app shell** (`src/components/` + `src/app/layout.tsx`):
   - `sidebar.tsx` — collapsible sidebar navigation with 8 nav items (Overview, Employees, Sessions, Approvals, Integrations, Cost Center, Audit Trail, Health), disabled items show "W2"–"W5" badges for upcoming sprints, Settings placeholder, user avatar/role placeholder, collapse toggle
   - `app-shell.tsx` — flex layout with sidebar + header + main content area
   - `connection-status.tsx` — real-time gateway connection indicator (colored dot + label)
   - Root layout wraps everything in `TooltipProvider` + `AppShell`

4. **Built the Employee Roster page** (`src/app/employees/page.tsx`):
   - Table listing all agents from `config.get → agents.list`
   - Columns: Employee (name + ID), Model, Tools (profile + count), Sandbox mode
   - Search/filter by name, ID, or model
   - Click-to-open detail dialog showing full agent config (tools allowlist, denylist, sandbox, runtime)
   - Loading skeleton, empty state, error state
   - Refresh button

5. **Built the Session View** (`src/app/sessions/page.tsx` + `src/app/sessions/[key]/page.tsx`):
   - Session list page: table with session key, channel, agent, message count, status; search/filter; link to transcript
   - Transcript page: chat-style message bubbles (user messages right-aligned with primary color, assistant left-aligned with avatar, tool calls in bordered panel with mono font, system messages in dashed border), scroll area, loading/error/empty states
   - Chat input at bottom with send button, Enter-to-send, disables when gateway disconnected
   - Back navigation to session list

**Files created:**
- `sentura/dashboard/` — full Next.js project (scaffolded via create-next-app + shadcn init)
- `src/lib/gateway/types.ts` — RPC type definitions
- `src/lib/gateway/client.ts` — WebSocket RPC client
- `src/lib/gateway/hooks.ts` — React hooks
- `src/lib/gateway/index.ts` — re-exports
- `src/components/sidebar.tsx` — navigation sidebar
- `src/components/app-shell.tsx` — layout wrapper
- `src/components/connection-status.tsx` — gateway status indicator
- `src/app/layout.tsx` — root layout (updated)
- `src/app/page.tsx` — dashboard overview
- `src/app/employees/page.tsx` — employee roster
- `src/app/sessions/page.tsx` — session list
- `src/app/sessions/[key]/page.tsx` — session transcript viewer
- `.env.local.example` — environment variable template

**Files modified:**
- `docs/TeamPlan.md` — marked all Person C Week 1 tasks as done
- `docs/MEMORY.md` — this entry

**Key decisions:**
- Used Next.js 16 (latest via create-next-app) with App Router and client components for real-time WebSocket state
- shadcn/ui v4 uses `@base-ui/react` (not Radix) — TooltipProvider uses `delay` prop (not `delayDuration`), TooltipTrigger does not support `asChild`
- Gateway client is a singleton class (`getGatewayClient()`) initialized from `NEXT_PUBLIC_GATEWAY_URL` + `NEXT_PUBLIC_GATEWAY_TOKEN` env vars
- Token is passed as URL query param on WebSocket connection (`ws://host:port?token=...`)
- All data-fetching hooks use a shared `useRpc()` pattern that auto-connects on first use
- Sidebar nav items for future weeks are rendered as disabled with sprint week badges to show the roadmap
- Session transcript page uses `use(params)` (React 19 pattern) for async params in Next.js 16
- Build compiles successfully with 0 TypeScript errors and 0 lint errors

**Nothing left incomplete.** All 5 Person C Week 1 tasks are done.

**Known issues:** None introduced.

---

### 2026-04-06 — Fix: Gateway WebSocket Protocol Alignment (Person C)

**Problem:** The Sentura Dashboard's `GatewayClient` was using JSON-RPC 2.0 framing (`{ jsonrpc: "2.0", method, params, id }`) to communicate with the OpenClaw Gateway, which uses a custom frame protocol (`{ type: "req", id, method, params }`). Additionally, the client did not implement the required `connect.challenge` → `connect` handshake. This caused repeated `[ws] invalid handshake` / `[ws] closed before connect` errors.

**Root cause analysis:**
- OpenClaw Gateway expects custom frames: `RequestFrame { type: "req", id, method, params }`, `ResponseFrame { type: "res", id, ok, payload, error }`, `EventFrame { type: "event", event, payload }`
- Server sends `connect.challenge` event with a `nonce` immediately on connection; client must respond with a `connect` request containing `ConnectParams` (protocol version, client ID, auth token, etc.)
- The original dashboard client resolved its `connect()` promise on `ws.onopen` and sent JSON-RPC 2.0 frames, both incorrect

**Files modified:**
- `sentura/dashboard/src/lib/gateway/types.ts` — Replaced JSON-RPC 2.0 types (`RpcRequest`, `RpcResponse`) with OpenClaw frame types (`RequestFrame`, `ResponseFrame`, `EventFrame`, `ConnectParams`, `HelloOk`, `GatewayErrorShape`)
- `sentura/dashboard/src/lib/gateway/client.ts` — Complete rewrite: implements `connect.challenge` listener, sends proper `connect` handshake with `webchat-ui` client ID and `webchat` mode, uses OpenClaw frame format for all RPC calls, correctly parses `ResponseFrame.ok`/`ResponseFrame.payload` responses
- `sentura/dashboard/src/lib/gateway/index.ts` — Updated barrel exports (removed `RpcResponse`, added new frame types)

**Key design decisions:**
- Client uses `webchat-ui` as `client.id` and `webchat` as `client.mode` (matching OpenClaw's `GATEWAY_CLIENT_IDS` / `GATEWAY_CLIENT_MODES`)
- Protocol version hardcoded to `3` (current `PROTOCOL_VERSION` from OpenClaw)
- Role set to `operator` with `operator.admin` scope for dashboard admin access
- Auth token passed in `ConnectParams.auth.token` (from `NEXT_PUBLIC_GATEWAY_TOKEN` env var)
- No changes needed to `hooks.ts` — method names and types remained compatible

**Build status:** Compiles successfully with 0 TypeScript errors.

---


---

### 2026-04-06 — Hybrid Dashboard Revision (Approach C)

**Architectural Decision:**
Adopted a hybrid UI approach for the Sentura platform. Instead of rebuilding all OpenClaw Control UI features in the Next.js dashboard (Approach A) or abandoning the Next.js dashboard to extend the Lit-based Control UI (Approach B), the platform uses both UIs with a clear responsibility split:

- **Sentura Dashboard (Next.js)** — enterprise management features OpenClaw lacks: employee lifecycle, approvals, cost center, audit trail, integrations, orchestrator, knowledge manager, testing, settings, SSO
- **OpenClaw Control UI (Lit, served by gateway)** — operational/developer tools already built: config editor, sessions & chat, logs, debug console, cron, skills browser, channel status, usage stats

The Sentura Dashboard sidebar includes external links to the Control UI. In production, both UIs are served from a single domain using path-based routing (see `docs/HOSTING.md`).

**What was done:**
- Deleted duplicate pages: `sentura/dashboard/src/app/sessions/page.tsx` and `sentura/dashboard/src/app/sessions/[key]/page.tsx`
- Rewrote `sentura/dashboard/src/components/sidebar.tsx` with three nav sections (Enterprise, Management, Operations) and external links to Control UI
- Repurposed `sentura/dashboard/src/app/page.tsx` — removed Sessions stat card, added Pending Approvals count, added System Health link to Control UI, replaced "View Sessions" quick action with "Create Employee" placeholder
- Repurposed `sentura/dashboard/src/app/employees/page.tsx` — removed raw config detail dialog, replaced with enterprise lifecycle table (Status column, Tune/Config actions, "Create Employee" button, external link to Control UI raw config)
- Added `NEXT_PUBLIC_CONTROL_UI_URL` environment variable to `.env.local` and `.env.local.example`
- Updated `docs/HOSTING.md` — revised production topology to show hybrid UI architecture, replaced two-subdomain Nginx config with single-domain path-based routing as recommended approach, updated dashboard client configuration table with `NEXT_PUBLIC_CONTROL_UI_URL`
- Updated `README.md` §17 — replaced "Dashboard Features" with "Hybrid UI Architecture" section documenting the responsibility split, listed 11 enterprise-only features, added "Deferred to OpenClaw Control UI" section
- Updated `docs/TeamPlan.md` — revised Person C tasks across Weeks 1–8: marked session-related tasks as removed/deferred, added hybrid architecture tasks, added route paths to task descriptions, updated Week 7-8 validation to reference 11 enterprise features

**Files modified:**
- `sentura/dashboard/src/app/sessions/page.tsx` — deleted
- `sentura/dashboard/src/app/sessions/[key]/page.tsx` — deleted
- `sentura/dashboard/src/components/sidebar.tsx` — rewritten
- `sentura/dashboard/src/app/page.tsx` — repurposed for enterprise overview
- `sentura/dashboard/src/app/employees/page.tsx` — repurposed for lifecycle management
- `sentura/dashboard/.env.local` — added `NEXT_PUBLIC_CONTROL_UI_URL`
- `sentura/dashboard/.env.local.example` — added `NEXT_PUBLIC_CONTROL_UI_URL`
- `docs/HOSTING.md` — updated topology, Nginx config, client config table
- `README.md` — updated §17 with hybrid UI architecture
- `docs/TeamPlan.md` — revised Person C tasks Weeks 1–8
- `docs/MEMORY.md` — this entry

**Key decisions:**
- OpenClaw Control UI has no documented plugin API for custom tabs, so extending it would require modifying core OpenClaw files (violates project rule #6)
- The gateway client library (`sentura/dashboard/src/lib/gateway/client.ts`) remains unchanged — all RPC methods are still useful for enterprise pages
- Hooks for sessions/transcripts remain in the gateway library for potential future use but are no longer imported by any page

---


---

## 2026-04-08 — Sentura Communication Panel Design & Plan

**What was done:**

Deep investigation of OpenClaw's session, channel, binding, and multi-agent orchestration systems to design Sentura's Communication Panel — a WhatsApp/Slack-style chat interface for the dashboard.

**Key investigation findings:**

- OpenClaw sessions use keys of the form `agent:<agentId>:<rest>`, and the embedded `agentId` determines which agent handles the conversation
- `sessions.create` RPC accepts an explicit `agentId` parameter, creating keys like `agent:<agentId>:dashboard:<uuid>` — this is the supported way to start direct sessions with non-main agents
- `chat.send` resolves the agent from the session key via `resolveSessionAgentId` — no separate agent parameter needed
- The gateway broadcasts `chat` events with `state: "delta"` / `"final"` for real-time streaming
- OpenClaw's Control UI can already target any agent by changing `sessionKey`, but its UX is a single-pane developer tool, not an enterprise messaging experience
- `webchat` is a built-in internal channel constant (`INTERNAL_MESSAGE_CHANNEL`), not a plugin — identified by `client.mode === "webchat"`
- Bindings map `{ channel, accountId, peer }` → `agentId` via tiered first-match resolution, but `sessions.create` with explicit `agentId` bypasses binding resolution entirely
- Multi-agent orchestration uses `sessions_spawn` (agent tool, NOT an RPC) for subagent delegation; there is no `sessions.spawn` RPC
- ACP (`@agentclientprotocol/sdk`) is used for external ACP-capable child processes, not for intra-OpenClaw agent-to-agent messaging

**Critical decision: No OpenClaw core modifications needed for 1:1 chat.** All required RPCs (`sessions.create`, `chat.send`, `chat.history`, `sessions.list`, `chat.abort`) already exist. Group chat requires a Sentura-level fan-out orchestration layer but still uses the same underlying RPCs.

**Architecture decisions:**

- Dual-mode communication: external channels (Slack, Teams, etc.) for daily operations + Sentura dashboard chat for management/testing/debugging
- 1:1 chat: two-pane layout (conversation list + chat thread), uses `sessions.create` with `agentId` + `chat.send` with `sessionKey`
- Group chat: Sentura maintains group metadata and N underlying OpenClaw sessions (one per agent), fans out messages via `sessions.send`, merges responses into a unified thread
- Communication panel added as capability #14 (was 13 capabilities, now 14)
- Sprint allocation: 1:1 chat in Week 3 (Person C + Person A), group chat in Week 4 (Person C + Person D for audit)

**Files modified:**
- `README.md` — Added "Sentura Communication Panel" subsection to Section 7 (Communication & Channels) with 1:1 chat design, group chat architecture, enterprise interaction strategy; updated capability count from 13 to 14; added capability #14 to the Sentura Builds table
- `docs/TeamPlan.md` — Updated capability coverage map (13→14 capabilities); added capability #14 row; added Week 3 tasks: Person A session management helpers, Person C 1:1 Chat Panel; added Week 4 tasks: Person C group chat, Person D audit integration for chat; updated integration checkpoints IC-3 and IC-4; added communication panel session contract to Interface Contracts; updated all "13 capabilities" references to "14"
- `docs/MEMORY.md` — This entry

**Also fixed in this session:**
- Dashboard `config.get` bug: `sentura/dashboard/src/lib/gateway/client.ts` `getConfig()` was not unwrapping the `{ hash, config }` snapshot wrapper from OpenClaw's `config.get` RPC, causing `getAgents()` to return empty. Fixed by extracting `snapshot.config` before returning.

---

