# @sentura/mcp-gradsale-web

MCP server that exposes the **GradSale web/user-facing API** as tools for Sentura AI employees that act on behalf of (or as) end users — buyer-side concierges, seller inbox triage, support agents walking a user through a transaction.

Sibling to [`@sentura/mcp-gradsale-admin`](../gradsale-admin/) (which covers the platform-admin surface for Dispute Resolver / Trust & Safety / Support staff personas). Both servers share the same authoring pattern; see [`docs/DESIGN.md` › Enterprise MCP Server Pattern](../../../docs/DESIGN.md#enterprise-mcp-server-pattern) for the full recipe.

## What it exposes

**32 tools across 3 capability groups**, each 1:1 with an endpoint from [`ekg/api-web.md`](../../../ekg/api-web.md). Sections covered: 1 Authentication, 3 Listings, 6 Messages. Other web-API sections (Users, Cart, Saved Items, Transactions, Stripe, Ratings, Disputes, Reports, Notifications, Support, Upload, Universities, Waitlist, Geocoding) are intentionally out of scope for this v0.1 — add them in `src/tools.ts` when the next persona surfaces a need.

| Group | Tools | Read/Write |
| --- | --- | --- |
| Authentication | `register`, `login`, `google_oauth`, `get_me`, `logout`, `verify_email`, `resend_verification`, `forgot_password`, `reset_password`, `change_password` | **W**, **W**, **W**, R, **W**, **W**, **W**, **W**, **W**, **W** |
| Listings | `list_listings`, `search_listings`, `get_user_listings`, `get_listing`, `get_similar_listings`, `create_listing`, `create_listings_batch`, `update_listing`, `delete_listing`, `set_listing_status`, `mark_listing_viewed` | R, R, R, R, R, **W**, **W**, **W**, **W**, **W**, **W** |
| Messages | `list_threads`, `get_thread`, `create_thread`, `send_message`, `mark_message_read`, `mark_thread_read`, `accept_reserve`, `decline_reserve`, `accept_price_proposal`, `decline_price_proposal`, `complete_checkout` | R, R, **W**, **W**, **W**, **W**, **W**, **W**, **W**, **W**, **W** |

Every mutating tool carries `annotations.destructiveHint = true` so the [`@sentura/approval`](../../extensions/sentura-approval/) extension can route it through HITL automatically. Tool names are prefixed `gradsale_web_` to avoid collisions with other MCP servers registered on the same employee (notably `gradsale_admin_*`).

### Auth lifecycle nuance

The `login`, `google_oauth`, and `reset_password` tools cache the issued `accessToken` on the running MCP server, so subsequent authenticated tool calls in the same session ride the new token automatically. `logout` clears the cache. The unauthenticated endpoints (`register`, `login`, `google_oauth`, `verify_email`, `resend_verification`, `forgot_password`, `reset_password`) bypass the auth resolver entirely, so they can run before any credential is in hand — exactly the path an onboarding agent needs.

## Configuration

Environment-variable driven (the MCP server process is spawned by OpenClaw with `env:` entries from the agent config). User-auth tokens, **never** admin tokens — for admin work use [`gradsale-admin/`](../gradsale-admin/).

| Env var | Required | Purpose |
| --- | --- | --- |
| `GRADSALE_API_URL` | no (defaults to `http://localhost:3001`) | Base URL of the GradSale NestJS backend |
| `GRADSALE_USER_TOKEN` | one of token / email+password | Pre-issued user JWT — fastest path |
| `GRADSALE_USER_EMAIL` (or `GRADSALE_USER_USERNAME`) | one of token / email+password | Email / username used to log in and fetch a token on first call |
| `GRADSALE_USER_PASSWORD` | one of token / email+password | Password paired with the email/username |
| `GRADSALE_DEVICE_ID` | no | Recorded against the session at login time — useful when running multiple Sentura employees against the same user account |
| `GRADSALE_REQUEST_TIMEOUT_MS` | no (default `30000`) | Per-request timeout in ms |
| `GRADSALE_READ_ONLY` | no (`true` / `1` to enable) | Strip all mutating tools — used for analytics-only personas that browse without touching state |

Credentials should come from OpenClaw's secret store (`$secret:` references) — never inline them in agent config.

## Wiring into an AI employee

Add this MCP server to an employee's agent config via the OpenClaw gateway RPC `config.patch`. Like every other MCP server, the entry **must** live under OpenClaw's native path `mcp.servers.<name>` — see the gradsale-admin README for the mechanics behind that constraint.

```json5
{
  mcp: {
    servers: {
      "gradsale-web": {
        command: "node",
        args: ["./sentura/mcp-servers/gradsale-web/dist/index.js"],
        env: {
          GRADSALE_API_URL: "https://api.gradsale.example",
          GRADSALE_USER_TOKEN: "$secret:gradsale.user_token",
          // OR set the email/password pair to enable auto-login:
          // GRADSALE_USER_EMAIL: "$secret:gradsale.user_email",
          // GRADSALE_USER_PASSWORD: "$secret:gradsale.user_password",
          GRADSALE_READ_ONLY: "false",
        },
      },
    },
  },
}
```

Use `command: "node"` with a direct path to the compiled entry (`dist/index.js`) — same reasoning as gradsale-admin. For a buyer-concierge employee that should never modify anything (analytics, browsing assistance), set `GRADSALE_READ_ONLY: "true"` — write tools disappear from the catalog entirely.

## Persona examples

The web surface unblocks personas that the admin surface can't:

- **Buyer Concierge** — search listings on the user's behalf, open threads with sellers, propose prices, complete checkout. Calls `search_listings` → `create_thread` → `send_message` → `complete_checkout`.
- **Seller Inbox Triage** — list message threads, classify reserve requests vs. price proposals, accept the safe ones automatically and escalate the rest. Calls `list_threads` → `get_thread` → `accept_reserve` / `decline_reserve` / `accept_price_proposal`.
- **Listing Manager** — bulk-create listings from an inventory CSV, hide stale listings, update prices. Calls `create_listings_batch`, `set_listing_status`, `update_listing`.
- **Onboarding Assistant** — help a new user sign up, verify their email, set up their first listing. Calls `register` → `verify_email` → `create_listing`.
- **Support Walk-Through** — when a user is stuck mid-flow, the support agent can read their thread state with `get_thread` and post a guided reply via `send_message`.

## Development

```bash
pnpm install                                  # once, at repo root
pnpm --filter @sentura/mcp-gradsale-web test  # 18 tests (12 unit + 4 e2e via InMemoryTransport)
pnpm --filter @sentura/mcp-gradsale-web build # compile to dist/
pnpm --filter @sentura/mcp-gradsale-web start # run over stdio (for manual testing)
```

Tests use `InMemoryTransport` from the MCP SDK plus a stubbed `fetch`, so they are hermetic — the real GradSale backend does not need to be running. Mirror of the `gradsale-admin` test rigor: per-tool URL/method/body assertions in `tools.test.ts`, persona walk-through (`Buyer Concierge`) in `server.test.ts`.

## Pattern

Reference implementation #2 of the **API-docs → MCP-server → `config.patch`** pattern (the first being [`gradsale-admin/`](../gradsale-admin/)). Notable differences:

- User-auth path (`/api/auth/login`) instead of admin (`/api/auth/admin/login`).
- Login response triggers `client.setToken(...)` so the same MCP server session reuses the freshly-minted token without going back through the auto-login dance.
- A subset of endpoints (`register`, `login`, `verify_email`, `forgot_password`, etc.) are unauthenticated by design — handlers pass `{ auth: false }` to the client to skip the token resolver entirely.
- Tool naming uses `gradsale_web_` to keep both servers loadable side-by-side on the same employee without name collisions.
