> **On-demand reference — not read by default.**
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md) — open from the Session Matrix row, not pre-emptively.

# Gateway-Tool Surface Gap — Carry-Over Design (2026-05-01)

The Creator's self-provisioning pipeline currently has an operator-driven fallback because the agent-callable `gateway` tool's restricted action enum does not expose `secrets.resolve`, `secrets.reload`, `exec.approval.request`, or `exec.approval.resolve`. This file documents the gap, two solution options, and the implementation plan for whoever picks this up — most likely Person A (option a, OpenClaw core widen) or Person B / D (option b, Sentura plugin extensions).

This was Person B's first Week-4 task in `docs/TeamPlan.md`. The reflection-loop / capability-extraction / pre-deploy-runner work all assumed the operator-driven fallback would remain in place this week; closing the gap is a Week-5 fit.

## Sessions in this file

| Date | Title | Summary |
|------|-------|---------|
| 2026-05-01 | Carry-over written by Person B | Design spec for the two implementation options and the recommended path |

---

## 2026-05-01 — Carry-over written by Person B

### The current restricted enum

`openclaw/src/agents/tools/gateway-tool.ts:137` declares the agent-callable `gateway` tool's `action` enum as exactly:

```
restart | config.get | config.schema.lookup | config.apply | config.patch | update.run
```

Any other gateway RPC method is unreachable from inside an agent's tool palette. This is the safety boundary OpenClaw chose for the embedded agent runtime — the wider RPC surface is reserved for operator-scope clients (the Lit Control UI, Sentura Dashboard, CLI).

### Self-provisioning needs four additional methods

`sentura/agents/creator/skills/self-provisioning/SKILL.md` documents the autonomous pipeline. Steps that are currently operator-driven because of this gap:

| Step | Method | Used for |
|------|--------|----------|
| 1 | `secrets.resolve` | Check whether a credential pointer (`$secret.<service>.<key>`) is already provisioned without reading raw plaintext |
| 5 | `secrets.reload` | After writing `KEY=VALUE` to `~/.openclaw/.env`, warm-reload the secret cache so the agent can use the new credential without a gateway restart |
| any | `exec.approval.request` | Request human approval for paid/elevated provisioning operations (e.g. OAuth app creation, paid tier signup) |
| any | `exec.approval.resolve` | Resolve a pending approval (operator path — agents would only call this in narrow cases like "mark as cancelled when the upstream service rejected the request") |

`exec.approval.request` is the most important — without it, the agent has no native way to ask the operator for permission inside a deployment flow.

### Option (a) — Widen the OpenClaw core enum

**Where:** `openclaw/src/agents/tools/gateway-tool.ts:137`

Add the four methods to `GATEWAY_ACTIONS`. Add per-method input validation in the tool's execute path. Tighten the scope check so an agent can only request approvals for `actor: "<own-agentId>"` and never resolve approvals it didn't issue.

**Pros:**
- Smallest diff
- Reuses OpenClaw's existing scope/auth machinery (no new auth surface for Sentura to maintain)
- Future Sentura agents (Tuner, MCP Builder, future meta-agents) get the methods automatically

**Cons:**
- Touches OpenClaw core — needs an upstream PR or a vendored fork
- Requires regression testing in OpenClaw's own `gateway-tool.test.ts`
- The `exec.approval.*` methods are operator-scope by default (`method-scopes.ts:44-48`); widening agent access requires a deliberate scope downgrade with audit-trail considerations

### Option (b) — Sentura plugin tools

**Where:** New extensions under `sentura/extensions/`:
- `sentura-secrets/` — registers `sentura_secrets_manage` tool (actions: `resolve`, `reload`, `has`)
- `sentura-approvals/` — registers `sentura_approvals_manage` tool (actions: `request`, `resolve`, `get`, `list`)

Pattern reference: `sentura/extensions/sentura-agents/index.ts:544` — the existing `sentura_agents_manage` tool. Each new tool would:
1. Define a Zod-validated parameter schema with an `action` discriminator.
2. Use the OpenClaw plugin runtime API (`api.runtime.*`) to reach the secret store and `ExecApprovalManager` directly, in-process — avoiding the gateway scope-upgrade pairing requirement that bites the embedded agent runtime.
3. Declare `openclaw.plugin.json` with `provides: ["tool"]` and a manifest describing the action surface.

**Pros:**
- Zero changes to OpenClaw core
- Per-agent tool allowlist already supports per-tool gating in `agents.list[].tools.alsoAllow` and the sandbox tool-policy mirror block (Round 20 fix)
- Audit logging via `sentura-audit` already wraps `before_tool_call` / `after_tool_call`, so every approval request the agent makes is automatically traced

**Cons:**
- Two new extensions to maintain — schema, tests, manifest, package.json
- Risk of drift between Sentura's wrapper semantics and OpenClaw's underlying RPC behavior (e.g. if upstream adds an `expires` field to `exec.approval.request`, the wrapper must mirror it)
- Plugin runtime access to `ExecApprovalManager` is less stable than the public RPC surface — `openclaw/plugin-sdk/*` may not currently export it

### Recommendation

**Pursue option (b).** Sentura's design rule (`CLAUDE.md` rule 7) is "do not touch OpenClaw infra"; widening the core enum is upstream work, and the OpenClaw maintainers may reasonably reject a PR that loosens the agent-callable RPC surface for a downstream consumer.

Concrete next-step plan for whoever picks this up:

1. **Investigate plugin-runtime access** (4-8h)
   - Confirm whether `OpenClawPluginApi.runtime` exposes `secrets.store` and `execApprovalManager` (or equivalent). If not, file an upstream issue requesting a stable `plugin-sdk/*` seam — option (a) becomes more attractive if no seam exists.
   - Reference: `sentura/extensions/sentura-agents/index.ts` already accesses `api.runtime.config.{loadConfig, writeConfigFile}` for `register_agent`; a similar seam is what we need for secrets and approvals.

2. **Build `sentura-approvals` first** (1-2 days)
   - The approval surface is the higher-impact half — without `exec.approval.request`, all paid/elevated provisioning is operator-driven.
   - Action discriminator: `request | resolve | get | list`.
   - Internally the `request` action constructs the same `ExecApprovalRequestPayload` that gateway RPCs build (`openclaw/src/infra/exec-approvals.ts`), tagged with `actor: "<callerAgentId>"`. Sentura's audit extension will pick it up via the standard hook chain.
   - Per-agent allowlist: only meta-agents (Creator, Tuner, MCP Builder) get this tool; deployed employees should NOT (they request approvals through the existing `exec.approval` integration on tool calls — they don't directly call the RPC).

3. **Build `sentura-secrets`** (1 day)
   - Smaller surface — `resolve | reload | has`. Crucially: NO `set` action. The secret-write path stays at the existing `sentura_agents_manage.put_secret` action (which writes via the file provider, not via gateway).
   - This unblocks Step 1 of `self-provisioning/SKILL.md` (check whether a secret pointer resolves) without exposing any write path.

4. **Update self-provisioning skill** (1-2h)
   - Replace the ⚠️ Implementation caveat block at the top of `sentura/agents/creator/skills/self-provisioning/SKILL.md` with the new tool calls.
   - Re-run `scripts/test-self-provisioning.ts` end-to-end. The 5-group offline + 4-group live suite should still pass without operator involvement on the autonomous path.

5. **Update Creator config** (5min)
   - Add `sentura_secrets_manage` and `sentura_approvals_manage` to `sentura/agents/creator/config.json5` `tools.alsoAllow` AND the sandbox tool-policy mirror block (the Round 20 sandbox filter strips plugin tools by default).

6. **Document in `docs/OPENCLAW.md`** — add a new section "Sentura agent-callable RPC wrappers" listing both extensions and their action surfaces.

### Why this didn't ship in Week 4

Person B's Week-4 plan included six other major deliverables (Orchestrator EKG, capability extraction, pre-deploy runner, Mode B test, reflection loop, EKG → SKILL.md synthesis). The gateway-tool work requires either (a) coordinating with the OpenClaw upstream or (b) building two new extensions, both of which are 2-3 day commitments on their own. The operator-driven self-provisioning fallback is documented in `self-provisioning/SKILL.md` and continues to work correctly — there is no production blocker, only an autonomy gap.

Carrying this into Week 5 lets it slot alongside Person B's Manager skills work (capability #17 Mechanisms 2 + 3), which depend on `exec.approval.request` for cross-domain conflict resolution anyway. Bundling both delivers the approval surface once.
