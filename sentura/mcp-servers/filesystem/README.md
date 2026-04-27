# sentura/mcp-servers/filesystem

**Tier 1 — Open-Source MCP Server.** This directory is *configuration*, not source — there is nothing to build. The actual server is the upstream npm package [`@modelcontextprotocol/server-filesystem`](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem), which OpenClaw spawns as a child process via the snippet in [`config-snippet.json5`](./config-snippet.json5).

## Why this server

Many Sentura AI employees need bounded local-file access — an AP Clerk reading attached invoices, a Dispute Resolver reviewing customer-uploaded evidence, a Knowledge Curator scanning a directory of policy PDFs. The reference filesystem server is the safest way to grant that access because it:

- Enforces an explicit allow-list of root directories at startup.
- Rejects any path that escapes those roots (no `..` traversal, no symlink fan-out).
- Exposes typed read/write/list/stat tools so the agent cannot invent shell commands.

## What it exposes (tool inventory at the time of writing)

The upstream package owns this list — verify it against the version pinned in `config-snippet.json5` before relying on any specific tool name in an SOP.

| Tool | Purpose | Read/Write |
| --- | --- | --- |
| `read_file` | Read the contents of an allowed file as UTF-8 | R |
| `write_file` | Replace the contents of an allowed file | **W** |
| `edit_file` | Apply a diff to an existing file | **W** |
| `create_directory` | mkdir -p inside an allowed root | **W** |
| `list_directory` | ls one level | R |
| `directory_tree` | Recursive tree | R |
| `move_file` | Rename / move within allowed roots | **W** |
| `search_files` | Glob / regex search across allowed roots | R |
| `get_file_info` | stat() metadata | R |

## Wiring it into an AI employee

1. Pick an absolute path the employee should own. Treat it like a service account home directory — narrow, dedicated, never shared with another role.
2. Apply [`config-snippet.json5`](./config-snippet.json5) by calling the gateway's `config.patch` RPC (see `docs/OPENCLAW.md § Configuration is data, not code`). Replace the placeholder path with the chosen root.
3. The agent's `TOOLS.md` should explicitly enumerate the filesystem tools it is expected to call — bare access is necessary but not sufficient for the runtime to surface the tool through the dashboard's `chat.send` path (see `docs/OPENCLAW.md § Sandbox tool-policy filter` for the `tools.sandbox.tools.alsoAllow` footgun).

## Security checklist

- [ ] Allowed roots are absolute paths, never `~` or `$HOME`.
- [ ] Roots do **not** overlap with the agent's own `workspaces/{id}/` directory — that is OpenClaw runtime state and must stay off-limits to the agent itself.
- [ ] Mutating tools (`write_file`, `edit_file`, `create_directory`, `move_file`) are routed through `sentura-approval` for any agent that touches money, customer data, or production config (see [`sentura/extensions/sentura-approval/`](../../extensions/sentura-approval/)).
- [ ] If the employee sandbox is `non-main`, the same tool names are listed in `tools.sandbox.tools.alsoAllow` of the agent config — otherwise the dashboard chat path will silently strip them.

## Why `npx -y` and not a direct `node` invocation

Unlike `gradsale-admin/` (Tier 2 — built in-tree), the upstream filesystem server is not vendored. Letting OpenClaw spawn `npx -y` keeps the package install on first launch, transparent to the operator, and means a Sentura re-pull of `openclaw/` does not break the wiring. The `-y` flag suppresses the install confirmation prompt that would otherwise hang the gateway.

## Pattern

This is the reference for the **upstream-MCP → `config.patch`** Tier-1 path. See `docs/DESIGN.md › Three-tier MCP strategy` for when to pick Tier 1 vs Tier 2 (in-tree-generated, e.g. `gradsale-admin/`) vs Tier 3 (self-provisioned via `sentura-provisioner`).
