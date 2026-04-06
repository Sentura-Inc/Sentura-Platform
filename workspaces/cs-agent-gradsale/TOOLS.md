# GradSale CS Agent — TOOLS.md

## MCP Servers

| Server | Purpose | Key Endpoints |
|--------|---------|---------------|
| `gradsale-admin` | Admin operations | Disputes, support threads, user verification, reports, transactions |
| `gradsale-web` | User-facing data | User profiles, listings, messages, ratings |

## API Notes

- Admin API requires `admin_token` with `role: admin` in JWT
- Web API uses standard Bearer token authentication
- All timestamps in ISO 8601 format
- Dispute statuses: `pending` → `investigating` → `resolved`
- Support thread statuses: `open` → `in_progress` → `resolved` → `closed`

## Common Operations

- Look up user: `gradsale-web` → `GET /api/users/:id`
- View dispute: `gradsale-admin` → `GET /api/admin/disputes/:id`
- Update dispute: `gradsale-admin` → `PATCH /api/admin/disputes/:id`
- Reply to support thread: `gradsale-admin` → `POST /api/admin/support/:id/reply`
- View transaction: `gradsale-admin` → `GET /api/admin/transactions/:id`
