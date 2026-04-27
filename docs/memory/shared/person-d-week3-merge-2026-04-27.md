> **On-demand reference — not read by default.** Summary row in [`docs/MEMORY.md`](../../MEMORY.md). Read when investigating the merge of `origin/person-d` PR #4 into `merge`, the dashboard wiring of `sentura.approval.*`, the test data extraction tool (capability #15), or the approval-flow E2E test scaffolding.

# Shared — Person D Week 3 PR Merge & Deferred-Task Closure (2026-04-27)

## Context

PR #4 (`person d week 3 + week 2 wrapup`) was open against `merge` with 7 conflicts and 3 explicitly deferred tasks documented in the PR description:

> MCP Builder Agent skills — needs Person B's mcp-builder workspace surface; coordinate before wiring.
> Test data extraction (cap #15) — schema owned by Person B's test harness; skipped until that lands.
> Approval flow E2E test — depends on Person C wiring sentura.approval.requests.list/decide into /approvals.

By the time this session ran, A/B/C had all merged into `merge`, so the dependencies were satisfied:

- B's `sentura/agents/mcp-builder/skills/` directory contains 4 SKILL.md files (api-analysis, mcp-generation, register-server, smoke-test).
- B's `sentura/config/test-harness-schema.json5` defines the `TestCase` shape.
- C's `sentura/dashboard/src/app/approvals/page.tsx` exists and handles exec/plugin approvals; just needed extension for the Sentura kind.

## Sessions in this file

| Date | Section |
|---|---|
| 2026-04-27 | Merge `origin/person-d` into `merge`, evaluate, complete deferred tasks |

---

### 2026-04-27 — Merge `origin/person-d` into `merge`, evaluate, complete deferred tasks

**Conflict resolutions (7 files):**

1. **`.gitignore`** — union of both sides. Kept HEAD's existing entries plus person-d's additions: `CLAUDE.md`, `sentura/mcp-servers/*/dist/`, `sentura/dashboard/next-env.d.ts`, `openclaw/.local/`, `openclaw/pnpm-lock.yaml`, `/memory/`.
2. **`docs/MEMORY.md`** — append-only matrix preserved Person B's three Week-3 rows (Data Scavenger / remaining tasks / live-gateway test verification) AND Person D's two Week-3 rows (kickoff + Week-2 web carry-over) side-by-side. No row deleted.
3. **`docs/TESTS.md`** — preamble line unified (PR #4 rolled D10/D15-D18 onto a 2026-04-27 superset header); section-count row kept A's 21, B's 23, C's 11 from HEAD and adopted D's 18 from PR.
4. **`openclaw/docs/reference/templates/{IDENTITY,USER}.md`** — pure newline-only trivial conflict; took person-d via `git checkout --theirs`.
5. **`pnpm-lock.yaml`** — took person-d (smaller, includes new direct deps `@modelcontextprotocol/sdk` and `ws`). Will regenerate via `pnpm install` after merge.
6. **`scripts/sentura-setup.sh`** — kept HEAD's prose comment ("for example, the openclaw gateway status probe") to honour the prior backtick-escape fix shipped in `38c48715`.

**Pre-existing bug fix found while inspecting the merged tree:** `sentura/extensions/sentura-agents/package.json` had two `"dependencies"` keys (one pinning `0.34.49`, one allowing `^0.34.49`). Collapsed to one caret-prefixed entry. JSON parsers vary on duplicate-key handling — last-key-wins for `JSON.parse`, but lockfile resolution can pick either depending on tool. Fix is lockfile-stable.

**Deferral 1 closed: MCP Builder Agent skills.**

- Verified Person B has shipped 4 skills (`sentura/agents/mcp-builder/skills/{api-analysis,mcp-generation,register-server,smoke-test}/SKILL.md`, 508 lines total).
- Verified Person D's Week-2 `sentura/agents/mcp-builder/config.json5` already declares the sandbox tool-policy override (`tools.sandbox.tools.alsoAllow`) — Round 20 fix from 2026-04-19 — so the model sees `gateway`, `web_fetch`, `browser`, `pdf`, `canvas`, `memory_*`, `update_plan`, `cron` inside the sandbox.
- Verified `sentura/extensions/sentura-rbac/DESIGN.md` lines 13/42 declare `ekg_manager` as the trigger role for the MCP Catalog and document the scope/role table.
- The remaining gap is a dashboard "Trigger MCP Builder" page — that is a Person C deliverable, not Person D. Marked the TeamPlan checkbox `[x]` with an annotation that calls out the cross-team handoff.

**Deferral 2 closed: test data extraction tool (capability #15).**

- New skill: `sentura/skills/test-data-extraction/SKILL.md` — agent-driven extraction. 6 steps: load schema → dispatch on recordType → map row → adversarial padding from Hard Rules → persist → hand off to test runner.
- New script: `scripts/extract-test-cases.ts` — operator-side runner, runnable via `tsx` against an OpenClaw host that has the GradSale admin MCP server built. Currently uses synthetic rows so it's runnable on a machine without a live GradSale backend; a comment in `fetchHistoricalRows()` directs future maintainers to swap to the live MCP Client pattern from `scripts/probe-mcp-gradsale-web.ts`.
- Output JSON5 conforms to `sentura/config/test-harness-schema.json5` — `meta.{agentId, recordType, extractedAt, sourceMcpServer, count}` + `cases[]: TestCase` with `id` format `tc-<agentId>-<YYYYMMDD>-<NNN>`, `source: "historical_extraction"`, `scoringRubric.passMark: 0.75`, `autoTuneThreshold: 0.5`, default 4-criteria scoring rubric (tool sequence 0.3 + outcome keywords 0.3 + Hard Rule compliance 0.25 + tone & escalation 0.15).
- Safety: emails masked to `<email-redacted>`, customer-name patterns replaced with `<customer-N>`, regulatory-tag rows (`legal_hold` / `gdpr_request` / `pci_violation`) dropped before persisting.

**Deferral 3 closed: approval flow E2E test + dashboard wiring.**

Dashboard wiring (4 files):

- `sentura/dashboard/src/lib/gateway/types.ts` — extended `ApprovalRequest.kind` union to `"exec" | "plugin" | "sentura"`, added optional `riskLevel` and `policyId` fields, added `SenturaApprovalRequestRaw` interface mirroring the extension's payload shape.
- `sentura/dashboard/src/lib/gateway/client.ts` — added 3 methods: `listSenturaApprovals(query?)`, `getSenturaApproval(id)`, `decideSenturaApproval(requestId, decision, decidedByUserId, reason?)`. The `get` method swallows NOT_FOUND into `null` so call sites can treat absence as a non-error.
- `sentura/dashboard/src/lib/gateway/hooks.ts` — extended `useApprovals()` initial-seed effect to fetch from three sources in parallel: `exec.approval.list`, `plugin.approval.list`, `sentura.approval.requests.list { status: "pending" }`. Added internal `fromSenturaRaw()` mapper that normalises status (`auto_approved` → `approved`, `auto_denied` → `rejected`, etc.) and converts `expiresAt` ISO string to `expiresAtMs` epoch number.
- `sentura/dashboard/src/app/approvals/page.tsx` — added `kind === "sentura"` branch in `describeApproval()` that prefers `context.justification` for the title and renders `policy: <id> · risk: <level>` as the subtitle. `handleResolve()` dispatches to `decideSenturaApproval` for `kind === "sentura"` (mapping the UI's three-decision shape — `allow-once` / `allow-always` / `deny` — onto the binary `approved` / `denied` the extension expects, since "always allow" is expressed by editing a policy, not by tagging a request). Card surfaces a `riskLevel` badge tinted `destructive` for high/critical. Footer copy updated to mention the third source.

E2E test:

- `scripts/test-approval-flow.ts` — runs offline (21 structural assertions PASS) and live (5 RPC checks that skip cleanly when the gateway is unreachable). Verifies: extension files exist, 6 RPC names registered, `sentura_approval_request` tool registered, `fileApprovalImperative` + `getApprovalRuntime` exported, `ApprovalRequest.onTimeoutDecision` field declared, `sentura-provisioner` declares `@sentura/approval: workspace:*` workspace dep, dashboard client/hooks/page reference the new methods. Live: `policies.list` returns the two builtin policies, `requests.list` reachable, `decide` returns NOT_FOUND for unknown id and BAD_REQUEST for malformed input.

**Files touched / created:**

- Merge resolutions: `.gitignore`, `docs/MEMORY.md`, `docs/TESTS.md`, `openclaw/docs/reference/templates/{IDENTITY,USER}.md`, `pnpm-lock.yaml`, `scripts/sentura-setup.sh`.
- Bug fix: `sentura/extensions/sentura-agents/package.json` (duplicate-key collapse).
- Test data extraction: `sentura/skills/test-data-extraction/SKILL.md` (new), `scripts/extract-test-cases.ts` (new).
- Approval E2E: `scripts/test-approval-flow.ts` (new).
- Dashboard wiring: `sentura/dashboard/src/lib/gateway/types.ts`, `sentura/dashboard/src/lib/gateway/client.ts`, `sentura/dashboard/src/lib/gateway/hooks.ts`, `sentura/dashboard/src/app/approvals/page.tsx`.
- Plan: `docs/TeamPlan.md` (8 Person D Week 3 checkboxes flipped with dated annotations).
- Memory: `docs/MEMORY.md` (this row), `docs/memory/shared/person-d-week3-merge-2026-04-27.md` (this file).

**Verification ran:**

- `tsx scripts/test-approval-flow.ts` against an unreachable gateway URL — `21 passed, 0 failed, 5 skipped`. Live tier will be re-run by the operator when the gateway is up.

**Known follow-ups (NOT closed in this session):**

- `pnpm install` not yet re-run on the merged tree — lockfile inherited from person-d will need a single `pnpm install` to wire dependencies for the new packages. The user is committing manually and will run install.
- TypeScript compile of the dashboard not run end-to-end (depends on `pnpm install` hydrating workspace deps).
- The PowerShell setup script `scripts/sentura-setup.ps1` does not wire any Sentura extensions (pre-existing gap, not introduced by this PR). Bash version's Step 7a should be ported over — flagged for whoever next touches the setup scripts.
- RBAC enforcement on `sentura.approval.requests.decide` and `sentura.approval.policies.{upsert,remove}` is intentionally NOT applied; these need `withRbac` middleware once Person C's platform-admin token plumbing lands. The dashboard already passes `NEXT_PUBLIC_SENTURA_ADMIN_USER_ID` as `decidedByUserId`, so the audit trail is correct even pre-RBAC.
- The `extract-test-cases.ts` script uses synthetic rows pending live MCP Client wiring. This is intentional so the script is runnable without a GradSale backend; the swap-in pattern is documented in the function-level comment.
