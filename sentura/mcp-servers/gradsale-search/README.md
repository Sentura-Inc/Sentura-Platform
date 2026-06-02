# sentura/mcp-servers/gradsale-search

**Tier 2 — Sentura-generated MCP server.** Built in-tree from `ekg/api-web.md`, this server exposes the **public discovery surface** of the GradSale platform as MCP tools. Read-only by design — no `POST` / `PATCH` / `DELETE` tools.

## Why this server

`gradsale-admin/` covers the **admin write** surface and `gradsale-web/` covers **auth + listings + messages**. Several Sentura roles need a third, read-only surface to do their jobs:

- **Onboarding Concierge** — validate a user's chosen university (`gradsale_search_list_universities`), geocode their stated address (`gradsale_search_geocode_address`).
- **Recommender / Matchmaker** — look up a counterparty's public profile and ratings before suggesting a buyer to a seller.
- **Trust & Safety Reviewer** — check a flagged user's verification status, transaction stats, and rating history before deciding on an account action.
- **Recovery Drafter** — search the user directory by free-text to find the right person to contact.

Granting these roles the full admin server is overkill (and risky); granting them `gradsale-web` would still expose listing-write tools. This server is the minimum read-only surface that lets discovery roles do their jobs.

## What it exposes

The 8 tools cover four sections of `ekg/api-web.md`:

| Tool | Endpoint | Source section |
| --- | --- | --- |
| `gradsale_search_get_public_profile` | `GET /api/users/:id` | § 2 — Users |
| `gradsale_search_get_user_ratings` | `GET /api/users/:id/ratings` | § 2 / § 9 — Ratings |
| `gradsale_search_get_user_transaction_stats` | `GET /api/users/:id/transaction-stats` | § 2 |
| `gradsale_search_get_user_verification_status` | `GET /api/users/verification/status` | § 2 |
| `gradsale_search_list_universities` | `GET /api/universities` | § 15 — Universities |
| `gradsale_search_geocode_address` | `GET /api/geocoding/address` | § 17 — Geocoding |
| `gradsale_search_reverse_geocode` | `GET /api/geocoding/reverse` | § 17 — Geocoding |
| `gradsale_search_users` | `GET /api/users/search` | § 2 (derived) |

Every tool advertises `readOnlyHint: true` / `destructiveHint: false` MCP annotations, so the client (Sentura agent) can skip the human-approval gate for benign discovery calls.

## Build & run

```sh
pnpm --filter @sentura/mcp-gradsale-search install
pnpm --filter @sentura/mcp-gradsale-search build      # → dist/index.js
pnpm --filter @sentura/mcp-gradsale-search test       # vitest
```

## Wire it into an AI employee

Add to `~/.openclaw/openclaw.json` under `mcp.servers` (per the post-Round-16 native location — see `docs/MEMORY.md` Current Ground Truth #5):

```json5
{
  mcp: {
    servers: {
      "gradsale-search": {
        command: "node",
        args: ["./sentura/mcp-servers/gradsale-search/dist/index.js"],
        env: {
          GRADSALE_API_URL: "https://api.gradsale.example.com",
          // Optional — only needed for the verification-status tool.
          GRADSALE_USER_TOKEN: "$secret:GRADSALE_USER_TOKEN",
        },
      },
    },
  },
}
```

Then list the relevant tool names in the agent's `tools.sandbox.tools.alsoAllow` block (see `docs/OPENCLAW.md § Sandbox tool-policy filter (dashboard vs CLI divergence)` — Round 20 fix). Without that, the dashboard chat path will silently strip them.

## Security checklist

- [ ] `GRADSALE_USER_TOKEN` is sourced from OpenClaw's secret store via `$secret:` reference, never pasted in `openclaw.json`.
- [ ] The token is scoped to a **read-only** GradSale account; do not reuse a moderator/admin token here.
- [ ] All eight tools should be approved as part of the agent's standard read tool-set; none of them require an approval policy.
- [ ] If the agent is `non-main` sandbox: tool names are listed in `tools.sandbox.tools.alsoAllow`.
- [ ] Audit: every tool call is logged via the `sentura-audit` `tool_call` hook (T2 tier — confidential, but not PII-restricted).

## Pattern

Tier 2 = "in-tree-generated from `ekg/` API docs". This is the third such server — see `gradsale-admin/` (admin write surface) and `gradsale-web/` (auth + listings + messages). For Tier 1 (open-source npm packages) see `filesystem/`, `slack/`, `github/`, `postgres/`. For Tier 3 (self-provisioned via `sentura-provisioner`) see `sentura/extensions/sentura-provisioner/`. The three-tier strategy is documented in `docs/DESIGN.md › Three-tier MCP strategy`.
