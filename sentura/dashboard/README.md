# Sentura Dashboard

Enterprise-facing frontend for the Sentura platform built on top of OpenClaw. Next.js 16 + React 19 + Tailwind 4 + shadcn/ui + Zustand 5 + a WebSocket RPC client to the OpenClaw gateway.

## Required environment variables

The dashboard reads four `NEXT_PUBLIC_*` keys from `.env.local`. Don't edit by hand — `scripts/sentura-setup.sh` writes all four idempotently:

| Var | Where it goes | Why |
|---|---|---|
| `NEXT_PUBLIC_GATEWAY_URL` | OpenClaw gateway WebSocket URL — default `ws://localhost:18789` | Used by `getGatewayClient()` in `src/lib/gateway/client.ts` |
| `NEXT_PUBLIC_GATEWAY_TOKEN` | OpenClaw gateway auth token | Sent as `auth.token` in the `connect` handshake. Without it the gateway rejects the WebSocket with `device identity required` and the dashboard sits in perpetual `Connecting...` |
| `NEXT_PUBLIC_SENTURA_ADMIN_USER_ID` | Sentura RBAC user store | The dashboard's "acting user" identity. Auto-seeded as `platform_admin` during setup |
| `NEXT_PUBLIC_SENTURA_ADMIN_TOKEN` | Sentura RBAC user store | Auth token for the admin user. Today forwarded implicitly via the connect-time gateway token (single-tenant dev). Per-RPC `params.userToken` / `params.actorToken` forwarding is on the Week 4 roadmap for multi-tenant scenarios |

If either `_TOKEN` key is missing, the dashboard renders a destructive banner at the top of every page (see `src/components/missing-token-banner.tsx`) — that's intentional, the alternative is silent RPC failures that look like the gateway is "just slow."

## Token contract for new pages

When adding a new page that calls a gateway RPC:

1. Get the client via `const { client, state } = useGateway();` from `@/lib/gateway`. The client is a module-level singleton; multiple components share one WebSocket connection.
2. RBAC-guarded RPCs work because the gateway recognises the connect-time admin token. For the current single-tenant dashboard you do **not** need to pass `userToken` per call.
3. Multi-tenant: when Person A's Week 4 `sessions.list { userToken }` filter lands and the dashboard supports multiple admins, switch to forwarding `params.userToken` per-RPC (see `sentura/extensions/sentura-rbac/src/middleware.ts` for which RPCs use `userIdField` vs `actorTokenField`).
4. Permission checks: import `usePermission` from `@/lib/auth/use-permission` and gate any user-mutation action by it. The Week 3 stub returns `{ allowed: true }`; Person D's Week 5 `sentura-rbac` swap fills in real role/scope checks with zero refactor needed across pages that adopted the contract early.
5. For multi-event subscriptions, prefer `useGatewayEvents({ "type": handler })` over multiple `client.on(...)` calls (see `useApprovals` for the canonical pattern).
6. Reuse `<AgentChat>` from `src/components/agent-chat.tsx` for any chat-shaped surface. It encapsulates streaming, sessionKey persistence, tool-call cards, and auto-scroll behind a stable D2 contract.

## Getting started

Prerequisites: OpenClaw gateway running on `ws://localhost:18789`, the four env vars above in `.env.local`. Both are handled by:

```bash
./scripts/sentura-setup.sh
```

Then:

```bash
pnpm dev   # http://localhost:3000
```

## Architecture

The dashboard runs **hybrid** with the OpenClaw Control UI on `http://localhost:18789`:

| Where | Surface | Audience |
|---|---|---|
| Sentura dashboard (port 3000) | `/`, `/employees`, `/employees/[id]`, `/create`, `/approvals`, `/chat` (more in Week 4-5) | Enterprise users / managers / admins |
| OpenClaw Control UI (port 18789) | Raw config editor, session inspector, logs, debug console, cron scheduler | Operators / debugging / break-glass |

The dashboard sidebar's **Operations** section links out to the Control UI surfaces. Dashboard pages that touch operator-only data (e.g. workspace files outside the gateway allow-list on `/employees/[id]`) render an "Edit in Control UI" link instead of duplicating the editor.

## Source layout

```
src/
├── app/                  # App Router pages (one folder per route)
│   ├── chat/             # /chat 1:1 conversation surface (Phase 3)
│   ├── create/           # /create Creator chat
│   ├── employees/        # /employees roster + /employees/[id] detail
│   └── approvals/        # /approvals queue
├── components/
│   ├── agent-chat.tsx    # Shared <AgentChat> (D2 contract)
│   ├── app-shell.tsx     # Layout wrapper (sidebar + header)
│   ├── sidebar.tsx       # Nav with live counts
│   ├── connection-status.tsx
│   ├── missing-token-banner.tsx
│   └── ui/               # shadcn primitives
├── lib/
│   ├── gateway/          # WebSocket RPC client + hooks
│   │   ├── client.ts     # GatewayClient class + singleton getter
│   │   ├── hooks.ts      # useGateway, useAgents, useApprovals, useGatewayEvents...
│   │   ├── helpers.ts    # getSessionAgentId (parses session key prefix)
│   │   ├── types.ts
│   │   └── index.ts
│   ├── auth/
│   │   └── use-permission.ts  # D3 RBAC stub
│   └── utils.ts
├── stores/
│   └── use-agent-roster.ts    # First Zustand store (D1)
└── styles/
    └── tokens.css        # Visual tokens (IAI Dual-MCP, motion, elevation) (D4)
```

Platform-wide context: `~/Agent Factory/Sentura/CLAUDE.md`, `docs/DESIGN.md`, `docs/TeamPlan.md`, and `docs/memory/person-c/week-{N}.md` for week-by-week delivery logs.
