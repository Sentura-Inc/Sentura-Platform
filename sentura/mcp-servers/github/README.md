# sentura/mcp-servers/github

**Tier 1 — Open-Source MCP Server.** This directory is *configuration*, not source — there is nothing to build. The actual server is the upstream npm package [`@modelcontextprotocol/server-github`](https://www.npmjs.com/package/@modelcontextprotocol/server-github), which OpenClaw spawns as a child process via the snippet in [`config-snippet.json5`](./config-snippet.json5).

## Why this server

Several Sentura roles need authenticated GitHub access:

- **Engineering Triage** — read incoming issues, label by area, suggest milestone, leave a "thanks for the report" comment.
- **Release Notes Drafter** — read merged PRs since last tag and draft a CHANGELOG entry.
- **Code Review Reminder** — list reviewers with stale assignments, nudge over channel.
- **Compliance / Audit Reviewer** — pull repo settings, branch protection, and recent push activity for compliance reports.

Granting that access through a Personal Access Token + the upstream MCP server is safer than asking the agent to invent shell `gh` commands — the upstream package exposes typed tools so the agent cannot escape into arbitrary HTTP.

## What it exposes (high-level inventory)

The upstream package owns this list — verify it against the version pinned in `config-snippet.json5` before relying on any specific tool name in an SOP. At a glance:

| Area | Representative tools | Read/Write |
| --- | --- | --- |
| Repos | `search_repositories`, `get_file_contents`, `list_commits` | R |
| Files | `create_or_update_file`, `push_files` | **W** |
| Issues | `list_issues`, `get_issue`, `create_issue`, `update_issue`, `add_issue_comment`, `search_issues` | R + **W** |
| Pull Requests | `list_pull_requests`, `get_pull_request`, `create_pull_request`, `merge_pull_request`, `create_pull_request_review` | R + **W** |
| Branches | `create_branch`, `update_pull_request_branch` | **W** |
| Search | `search_code`, `search_users` | R |

## Wiring it into an AI employee

1. **Mint a token, not a session.** Create a fine-grained PAT scoped to the SPECIFIC repos the employee owns; never reuse a developer's personal token.
2. **Stash the token in OpenClaw's secret store.** Add `GITHUB_TOKEN=ghp_xxxxx` to `~/.openclaw/.env` (read by the gateway dotenv loader at startup) or use a configured `secrets.providers.<name>.command`. Reference the secret as `$secret:GITHUB_TOKEN` in the snippet.
3. **Apply [`config-snippet.json5`](./config-snippet.json5)** by calling the gateway's `config.patch` RPC (see `docs/OPENCLAW.md § Configuration is data, not code`).
4. **Allow the tools through the sandbox filter.** Add the github tool names you actually need to the agent's `tools.sandbox.tools.alsoAllow` block (see `docs/OPENCLAW.md § Sandbox tool-policy filter (dashboard vs CLI divergence)` — Round 20 fix). Without this, the dashboard chat path will silently strip them.
5. **Route mutating tools through `sentura-approval`.** Anything that creates or merges a PR, pushes files, or closes issues should require human approval for any non-trivial repo. See `sentura/extensions/sentura-approval/`.

## Security checklist

- [ ] Token is **fine-grained**, scoped to the minimum repo set, with read-only OR read+write minus dangerous scopes (`admin:org`, `delete_repo`).
- [ ] Token expiry is set to ≤90 days; secrets-rotation cron rolls it before expiry.
- [ ] No `repo` *classic* tokens in production — they grant access to every private repo the developer can see.
- [ ] Mutating tools (`create_pull_request`, `merge_pull_request`, `push_files`) are routed through `sentura-approval` for high-risk actions.
- [ ] The agent's `AGENTS.md → Hard Rules` block forbids force-pushing and PR merges to `main`/`master` without an explicit approval ticket.
- [ ] If the employee sandbox is `non-main`, the github tool names are listed in `tools.sandbox.tools.alsoAllow` of the agent config.

## Pattern

This is one of three Tier-1 reference snippets — see `filesystem/`, `slack/`, and the sibling `postgres/` for the others. For Tier 2 (in-tree-generated from `ekg/` API docs) see `gradsale-admin/`, `gradsale-web/`, and `gradsale-search/`. For Tier 3 (self-provisioned via `sentura-provisioner`) see `sentura/extensions/sentura-provisioner/`. The three-tier strategy is documented in `docs/DESIGN.md › Three-tier MCP strategy`.
