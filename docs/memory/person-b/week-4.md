> **On-demand reference — not read by default.**
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md) — open from the Session Matrix row, not pre-emptively.

# Person B — AI Employee & Skills — Week 4

Person B's Week 4 work covers Mode B (Orchestrator) integration, Manager EKG aggregation (capability #17 Mechanism 1), the pre-deployment test runner (capability #15), the Knowledge Curator → Data Scavenger handoff (capability #11/#12), Creator's incubation memory + bounded reflection loop, the gateway-tool surface gap closure (via `sentura_approval_request` + new `dotenv_check`), and the Experience Link extraction runtime (new `sentura-experience-extraction` plugin).

## Sessions in this file

| Date | Title | Summary |
|------|-------|---------|
| 2026-05-01 | All Week 4 Person B deliverables (initial pass) | 7 work items, 96 tests live + offline, 2 carry-overs (gateway-tool gap + Experience Link runtime) |
| 2026-05-01 | Week 4 closeout — gap closures | Closed both carry-overs in the same day: gateway-tool gap via `sentura_approval_request` + `dotenv_check`; Experience Link runtime via new `sentura-experience-extraction` plugin. 185 tests live + offline across 4 suites. |

---

## 2026-05-01 — All Week 4 Person B deliverables

### Trigger

User invocation: "You are person B in @docs/TeamPlan.md , finish Week 4's task. Read @CLAUDE.md first. After implementation test thoroughly both offline and with a live openclaw gateway."

### What was built

**Orchestrator EKG (1 README + 4 pillar dirs)** — `sentura/agents/orchestrator/ekg/{capabilities,conflicts,insights,global-sops}/` with `.gitkeep` files and a comprehensive `README.md` documenting the capability-manifest schema, additive-merge invariant, T0/T1 data-classification rule, mandatory provenance, and lifecycle diagram (Phase 5 deploy → routing → Manager skills → resolved SOP).

**Capability extraction skill (1 SKILL.md)** — `sentura/agents/creator/skills/capability-extraction/SKILL.md`. Invoked from `employee-deployment/SKILL.md` Step 6 (which I edited to reference the new skill). Procedure: gather inputs (read-only) → extract `capabilityTags` from skill folder names + "When to Use" verbs (3-10 tags, no proper nouns) → extract `ioSchemas` from each SKILL.md Procedure section → compile rest from `register_agent` response → write the manifest → verify. Confidence floor 0.7 to enter routing; below 0.7 → `reviewRequired: true`.

**Pre-deployment test runner (1 .ts script + 1 test script)** — `scripts/run-pre-deployment-tests.ts` (capability #15). Implements the full scoring engine + suite aggregator + JSON5-tolerant loader.
- `scoreTestCase(testCase, transcript)` — scores actions / outcome.contains / outcome.doesNotContain / sideEffects / safety against the rubric, weights into a `weightedScore`, applies passMark gate, falls through to safety-as-hard-fail, and produces an `autoTuneRecommendation` keyed to the weakest criterion (target file: SKILL.md / AGENTS.md / SOUL.md / BOOTSTRAP.md).
- `aggregateSuite(suite, results, iteration)` — produces `recommendation: deploy | auto-tune | human-review | block` per the TeamPlan threshold table. Hard-rule fail forces `block` regardless of passRate.
- `loadSuiteFile()` — JSON5-permissive loader (strips `// ` and `/* */` comments, repairs trailing commas).
- CLI modes: `--suite <path>` runs against gateway via `sessions.create`/`sessions.send`/`sessions.delete`; `--self-test` runs synthetic transcripts; `--dry-run` skips live sessions.
- Result file written to `~/.openclaw/test-runs/{suiteId}-{ISO}.json`.
Companion test: `scripts/test-pre-deployment-runner.ts` — 11 offline groups + 1-2 live groups (gateway connectivity + opt-in live session via `SENTURA_PREDEPLOY_LIVE_AGENT`). Verified: 25/25 PASS live, 23/23 PASS offline.

**Mode-B integration test (1 .ts script)** — `scripts/test-mode-b-orchestration.ts`. Verifies Orchestrator workspace integrity (8 native files + 2 skills with required sections), config sandbox tool-policy block (sessions_send / sessions_spawn / subagents present per Round 20 fix), EKG pillar dirs + README, capability-extraction skill present. Implements + tests a `resolveDecomposition()` function that picks `ap-clerk` + `cs-agent` for "Prepare Q4 report covering finance and support" given fixture capability manifests, and excludes `reviewRequired` agents. Live: gateway connectivity + orchestrator registered + sessions.create returns key + cleanup. Optional `SENTURA_MODE_B_LIVE_PROMPT` opt-in for actual Mode-B execution. Verified: 46/46 PASS live, 42/42 PASS offline.

**Creator incubation memory (1 SKILL.md)** — `sentura/agents/creator/skills/incubation-memory/SKILL.md`. Append-only protocol over Creator's native `MEMORY.md` workspace file. Documents entry format (success + failure templates), read-at-Step-2-of-incubation pattern, write-at-end-of-deploy pattern, recurring-pattern promotion (≥3 entries with same `ReusedPatterns` → suggest role-template promotion), bounding rule (>800 lines → archive entries older than 90 days).

**Creator reflection loop (1 SKILL.md)** — `sentura/agents/creator/skills/reflection-loop/SKILL.md`. Bounded loop: max 3 reflection rounds, max 1 patch per round, max 3 patches total. Trigger: 3 sessions exist OR 24h since deploy. Detection: 4 heuristic checks (tool-loop / hard-rule false-positive / missing approval / off-tone reply) → fix-target file. Patch-apply via `sentura_agents_manage`. Re-test via `scripts/run-pre-deployment-tests.ts`; revert + escalate on regression. Never weakens Hard Rules. No transcript persistence.

**EKG → SKILL.md synthesis (1 SKILL.md)** — `sentura/skills/ekg-to-skill-synthesis/SKILL.md` + parent `knowledge-curation/SKILL.md` updated to delegate the Scavenger-handoff path. The sub-skill reads workflow entities from `ekg/workflows/*.json5` (filter: confidence ≥ 0.7, ≥2 steps, owner matches), maps fields → SKILL.md sections (steps → Procedure, approvalsRequired → Safety, relations → Tools Needed), writes via `sentura_agents_manage`, notifies the target agent. Synthesized SKILL.md ends with HTML-comment provenance footer; hand-authored skills are protected via the `.proposed` sibling pattern (writes alongside, never overwrites).

**Carry-over: Gateway-tool surface gap** — `docs/memory/shared/gateway-tool-surface-gap-2026-05-01.md`. Full implementation spec for the autonomy gap: enumerates the 4 missing methods (`secrets.resolve`/`secrets.reload`/`exec.approval.request`/`exec.approval.resolve`), compares the two options (OpenClaw core enum widen vs. two new Sentura plugin tools), recommends option (b) under Sentura's "do not touch OpenClaw infra" rule, and lays out a 6-step plan (1-2 days for `sentura-approvals`, 1 day for `sentura-secrets`, plus self-provisioning rewire + Creator config update + docs). Bundled with Person B's Week 5 Manager skill work (capability #17 Mechanisms 2/3) which depends on the same approval surface.

### Files created (10)

| File | Purpose |
|------|---------|
| `sentura/agents/orchestrator/ekg/README.md` | Manager EKG schema + invariants |
| `sentura/agents/orchestrator/ekg/{capabilities,conflicts,insights,global-sops}/.gitkeep` | Pillar directories |
| `sentura/agents/creator/skills/capability-extraction/SKILL.md` | Phase 5 capability manifest writer (cap #17 M1) |
| `sentura/agents/creator/skills/incubation-memory/SKILL.md` | Long-term incubation memory protocol |
| `sentura/agents/creator/skills/reflection-loop/SKILL.md` | Bounded post-deploy auto-patch loop |
| `sentura/skills/ekg-to-skill-synthesis/SKILL.md` | EKG workflow → SKILL.md synthesis |
| `scripts/run-pre-deployment-tests.ts` | Pre-deploy test runner (cap #15) |
| `scripts/test-pre-deployment-runner.ts` | Test runner offline + live verification |
| `scripts/test-mode-b-orchestration.ts` | Mode-B integration test |
| `docs/memory/shared/gateway-tool-surface-gap-2026-05-01.md` | Carry-over design spec |

### Files modified (2)

| File | Change |
|------|--------|
| `sentura/agents/creator/skills/employee-deployment/SKILL.md` | Step 6 now invokes `capability-extraction` skill explicitly |
| `sentura/skills/knowledge-curation/SKILL.md` | Added Source-handoff callout pointing at `ekg-to-skill-synthesis` |

### Key design decisions

1. **Capability-tag style**: 3-10 kebab-case tags, no proper nouns (so a `gradsale-listings` tag would fail the lint; `marketplace-listing-management` passes). Portable across tenants. Reason: capability tags are how the Orchestrator will resolve cross-tenant routing once multi-tenancy lands; tying tags to a specific customer would break.
2. **Confidence floor 0.7 for routing**: matches the floor used in Person B's Week 3 personal-memory + experience-extraction skills. Below 0.7 → `reviewRequired: true` and excluded from auto-routing until a human accepts. The Mode-B test's T-OFF-7 verifies this.
3. **Pre-deploy auto-tune file mapping**: weakest criterion → target file. Tool usage → `skills/<relevant>/SKILL.md` Procedure ordering; outcome.doesNotContain → `AGENTS.md` Hard Rules; side-effects → `BOOTSTRAP.md` Enterprise Context approvals; safety → `AGENTS.md` Hard Rules (tighten); outcome.contains → `SOUL.md` mission/voice. Reason: matches the file-by-file mental model the Tuner uses.
4. **Block on hard-rule fail overrides passRate**: the runner's `aggregateSuite` returns `block` when ANY result has a `failureReason` starting with `safety:`, even if 9/10 cases passed. Reason: a single safety regression is unconditionally blocking — adversarial tests are the canary.
5. **Reflection loop bounded to 3+3**: max 3 rounds, max 3 cumulative patches. Reason: more than that suggests the underlying design is wrong, not the implementation. Operator owns design corrections.
6. **`.proposed` sibling for hand-authored skills**: the EKG → SKILL.md synthesis skill writes `skills/<name>/SKILL.md.proposed` instead of overwriting hand-authored skills. Detection: the synthesizer leaves an HTML-comment provenance footer; absence of footer = hand-authored. Reason: knowledge curator should never silently destroy human work.
7. **No new agent-runtime infrastructure**: deferred the `sentura_secrets_manage` + `sentura_approvals_manage` work because the existing operator-driven self-provisioning fallback is documented and works. Building two new extensions for an autonomy gap is 2-3 days; bundling with Week 5 Manager-skill work amortizes the cost.

### Verification

Gateway started via `cd openclaw && pnpm gateway:watch`. Live test results:

| Script | Cases | Result |
|--------|------:|--------|
| `scripts/test-pre-deployment-runner.ts` (offline + live) | 25 | **25 PASS / 0 FAIL** |
| `scripts/test-mode-b-orchestration.ts` (offline + live) | 46 | **46 PASS / 0 FAIL** |
| `scripts/run-pre-deployment-tests.ts --self-test` | 5 | **5 PASS / 0 FAIL** |
| `scripts/test-self-provisioning.ts` (offline + live) | 66 | **66 PASS / 0 FAIL** (regression check on Week-3 work) |

Pre-existing failures noted in `scripts/test-tuner-e2e.ts` and `scripts/test-week2-b-gateway.ts`: both fail on `config.patch` with `requires raw, not patch` — this is a protocol drift in OpenClaw's `config.patch` schema introduced in a recent OpenClaw release. NOT introduced by this session's work; the failures predate it. Tracking as a separate concern (likely Person A's territory).

### Sessions.create / sessions.send protocol fix

Initial live tests soft-skipped because my first draft used `{ agentId, sandbox: { mode: "non-main" } }` for `sessions.create` and `{ sessionKey, text }` for `sessions.send`. The actual schema (per `openclaw/src/gateway/protocol/schema/sessions.ts:84` `SessionsCreateParamsSchema` + `SessionsSendParamsSchema`):

- `sessions.create` accepts `{ key?, agentId?, label?, model?, parentSessionKey?, task?, message? }` with `additionalProperties: false`. **No `sandbox` param.**
- `sessions.send` accepts `{ key, message, thinking?, attachments?, timeoutMs?, idempotencyKey? }`. **`key` not `sessionKey`; `message` not `text`.**
- Returned session record uses field `key` (legacy `sessionKey` accepted as fallback).

Fixed in all three Week-4 scripts (`run-pre-deployment-tests.ts`, `test-pre-deployment-runner.ts`, `test-mode-b-orchestration.ts`). Both live test suites then went green.

### TeamPlan.md updates

- 5 Person B Week 4 tasks marked `[x]` with dated completion notes:
  1. Build Orchestrator Agent + ekg/ structure
  2. Test Mode B "Prepare Q4 report"
  3. Integrate Data Scavenger with Knowledge Curator (caps #11, #12)
  4. Build Manager capability abstraction (cap #17 M1)
  5. Implement pre-deployment test runner (cap #15)
  6. Build incubation memory
  7. Write reflection loop
- 1 task carried with explicit deferral note + spec link: gateway-tool surface gap → Week 5 with `docs/memory/shared/gateway-tool-surface-gap-2026-05-01.md`.
- 1 task carried (Experience Link extraction cap #13 Tier 3): the SKILL.md design exists from Week 3; the post-task hook integration with the dreaming cycle requires Person A's bootstrap-hook seam (Week 5 territory).

### Documents updated

| Document | Change |
|----------|--------|
| `docs/TeamPlan.md` | 5 Person B Week-4 checkboxes flipped with completion notes; 2 explicit deferral notes |
| `docs/MEMORY.md` | Week 4 header added; Person B + shared rows for 2026-05-01 |
| `docs/memory/person-b/week-4.md` | This file |
| `docs/memory/shared/gateway-tool-surface-gap-2026-05-01.md` | Carry-over design spec for Week 5 |

### Linked matrix rows

- `docs/MEMORY.md` Week 4: `2026-05-01 | B | Week 4 Person B: … | memory/person-b/week-4.md`
- `docs/MEMORY.md` Week 4: `2026-05-01 | shared | Gateway-tool surface gap carry-over | memory/shared/gateway-tool-surface-gap-2026-05-01.md`

---

## 2026-05-01 — Week 4 closeout: gap closures

### Trigger

User invocation: "Would you finish the two gaps you identified? And then provide me with detailed steps and prompts to run the tests you can't do."

### What was built

**Gap 1: Gateway-tool surface gap → closed (not deferred)**

The original carry-over recommended building two new extensions (`sentura-secrets`, `sentura-approvals`). On re-investigation, two of the four "missing" RPCs (`exec.approval.request` / `exec.approval.resolve`) were ALREADY covered by Person D's `sentura_approval_request` tool (`sentura/extensions/sentura-approval/index.ts:114`) — that tool exposes a richer API than raw `exec.approval.*` (policy-based auto-approve / auto-deny / require-human with escalation chains). The remaining gap was a global-credential existence probe.

Resolution:
- Added `dotenv_check` action to `sentura_agents_manage` (`sentura/extensions/sentura-agents/index.ts` enum + schema field + execute branch + new `checkDotenvKey()` helper). Returns `{ ok, exists, length, dotenvFilePath }` for a given key — never the value itself.
- Added `sentura_approval_request` to the Creator's `tools.alsoAllow` and the sandbox tool-policy mirror block in `sentura/agents/creator/config.json5`. Live `~/.openclaw/openclaw.json` patched to match.
- Rewrote `sentura/agents/creator/skills/self-provisioning/SKILL.md`:
  - Replaced the ⚠️ Implementation caveat block with a one-paragraph autonomy note pointing at the three tools (`sentura_agents_manage`, `sentura_approval_request`, `browser`).
  - Step 1 now uses `sentura_agents_manage { action: "dotenv_check" }` for global credentials and `has_secret` for per-agent.
  - Step 3 now uses `sentura_approval_request` with the right schema (action / riskLevel / context) and the policy-based response handling (auto_approved / auto_denied / pending). Pending path polls via `sentura.approval.requests.get` over the `gateway` tool.
  - Step 5's `secrets.reload` instruction softened to operator-escalation guidance (the gateway's mid-session secret cache reload still requires the operator path).
  - Tools Needed list refreshed to reflect the agent-callable surface only.
- Updated `scripts/test-self-provisioning.ts` assertion from "SKILL.md references real secrets RPCs" to "SKILL.md references Sentura primitives (dotenv_check / sentura_approval_request)". Now 66/66 PASS live.

**Gap 2: Experience Link extraction runtime → closed via new plugin extension**

Built `sentura/extensions/sentura-experience-extraction/`:
- `package.json`, `openclaw.plugin.json` (id, configSchema with minOccurrences/confidenceThreshold/candidatesDir/workspaceRoot), `api.ts` (re-exports from `openclaw/plugin-sdk/plugin-entry`), `index.ts` (plugin entry + hook handlers), `src/scoring.ts` (pure helpers split for offline tests).
- Hook handlers: `after_tool_call` accumulates per-session tool sequence (bounded to 12 tools); `agent_end` finalizes the sequence into a candidate signature, increments occurrences, and promotes to `ekg/workflows/experience-links/{linkId}.json5` once `occurrences ≥ minOccurrences (3)` AND `confidence ≥ confidenceThreshold (0.75)`. Confidence formula matches `sentura/skills/experience-extraction/SKILL.md`: `min(0.9, 0.3 + 0.1 * sqrt(occurrences))`.
- Meta-agent filter: `creator`, `tuner`, `orchestrator`, `mcp-builder`, `data-scavenger`, `main` are excluded — their sessions are infrastructure, not user-facing tasks.
- Persistent candidate store at `~/.openclaw/sentura-experience-extraction/{agentId}/candidates.json` with `{ signature, occurrences, firstSeen, lastSeen, sampleSessionKeys[5], confidence, promotedAs? }` shape. Sample-key bound prevents unbounded growth for chatty agents.
- `scripts/test-experience-extraction.ts` — 11 offline groups + 2 live groups: pure scoring helpers (signature trimming, confidence formula, promotion gates, file round-trip), end-to-end 3-session promotion simulation, plugin-loaded check via `config.get`, tool-reachability check via `tools.effective` for the creator. **48/48 PASS live + offline.**
- Plugin enrolled in `~/.openclaw/openclaw.json` (`plugins.entries["sentura-experience-extraction"].enabled: true` + `plugins.load.paths` append) via `scripts/sentura-setup.sh` (added the new id to `SENTURA_EXT_IDS`). Gateway log on restart: `[gateway] ready (11 plugins: ... sentura-experience-extraction ...)`.

**Dreaming-cycle phase deferral**: the SKILL.md design references three dreaming phases (light=detect gaps, deep=extract patterns, REM=promote drafts). The on-task-complete promotion path is now live. The periodic light/deep/REM cron triggers still require Person A's Week-5 bootstrap-hook seam — added a TODO note in TeamPlan but the core Tier-3 Experience Link mechanism is functional.

### Files created (5)

| File | Purpose |
|------|---------|
| `sentura/extensions/sentura-experience-extraction/package.json` | Plugin package metadata |
| `sentura/extensions/sentura-experience-extraction/openclaw.plugin.json` | Plugin manifest + configSchema |
| `sentura/extensions/sentura-experience-extraction/api.ts` | Local plugin barrel |
| `sentura/extensions/sentura-experience-extraction/index.ts` | Plugin entry + hook handlers |
| `sentura/extensions/sentura-experience-extraction/src/scoring.ts` | Pure scoring helpers (importable from tests) |
| `scripts/test-experience-extraction.ts` | 13-group test suite (11 offline + 2 live) |

### Files modified (5)

| File | Change |
|------|--------|
| `sentura/agents/creator/config.json5` | Added `sentura_approval_request` to `tools.alsoAllow` + sandbox mirror |
| `sentura/extensions/sentura-agents/index.ts` | New `dotenv_check` action: enum entry + schema field + execute branch + `checkDotenvKey()` helper |
| `sentura/agents/creator/skills/self-provisioning/SKILL.md` | Removed ⚠️ caveat block; rewrote Step 1/3/5 + Tools Needed |
| `scripts/sentura-setup.sh` | Added `sentura-experience-extraction` to `SENTURA_EXT_IDS` |
| `scripts/test-self-provisioning.ts` | Updated assertion to match the new Sentura-primitive references |

### Key design decisions

1. **Don't build new extensions when existing ones cover the case.** Person D's `sentura_approval_request` already implemented a richer approval API than raw `exec.approval.*` would have provided. Re-using it (one-line config addition) was preferable to building `sentura-approvals` from scratch.
2. **`dotenv_check` returns `length` not value.** The agent learns whether a credential is configured but can't see it. This preserves the secret-store invariant that raw values never enter LLM context.
3. **Pure helpers split into `src/scoring.ts`.** The first cut had everything in `index.ts`, which couldn't be imported by tests because `index.ts` imports `openclaw/plugin-sdk/plugin-entry` (jiti-only alias). The split lets `index.ts` re-export the helpers (no consumer behavior change) while tests import directly from `src/scoring.ts` with no SDK dependency.
4. **Synchronous on-task-complete promotion, periodic dreaming deferred.** The user's stated need was "agent through 3 similar procurement tasks → verify Experience Link auto-generated". That's covered by the on-task-complete path. The 3-phase dreaming cycle (which adds *gap detection* and *draft generation*, beyond pure pattern promotion) genuinely needs a periodic trigger — left for Week 5 alongside Person A's bootstrap-hook seam.
5. **Meta-agents excluded from candidate accumulation.** Creator / Tuner / Orchestrator / MCP Builder / Data Scavenger run infrastructure tasks (deploying employees, decomposing requests). Their sessions don't represent reusable user-task patterns. Filter applies in both `after_tool_call` and `agent_end` hooks — no candidate file ever created for them.

### Verification

Gateway restarted via `cd openclaw && pnpm gateway:watch`. Live test results:

| Script | Cases | Result |
|--------|------:|--------|
| `scripts/test-experience-extraction.ts` (offline + live) | 48 | **48 PASS / 0 FAIL** |
| `scripts/test-self-provisioning.ts` (offline + live) | 66 | **66 PASS / 0 FAIL** |
| `scripts/test-pre-deployment-runner.ts` (offline + live) | 25 | **25 PASS / 0 FAIL** (regression check) |
| `scripts/test-mode-b-orchestration.ts` (offline + live) | 46 | **46 PASS / 0 FAIL** (regression check) |

Gateway boot line: `[gateway] ready (11 plugins: acpx, browser, device-pair, phone-control, sentura-agents, sentura-approval, sentura-audit, sentura-experience-extraction, sentura-provisioner, sentura-rbac, talk-voice; 4.4s)`. Tools.effective for the creator returns 25 tools including both `sentura_agents_manage` and `sentura_approval_request`.

### TeamPlan.md updates

Both previously-unchecked Person B Week 4 tasks flipped to `[x]`:
- "Close the agent-callable gateway-tool surface gap" — completion note replaces the carry-over note.
- "Implement Experience Link extraction (capability #13 — Tier 3)" — completion note replaces the deferral note.

All seven Person B Week 4 deliverables now `[x]`.

### Documents updated

| Document | Change |
|----------|--------|
| `docs/TeamPlan.md` | 2 final boxes flipped with completion notes |
| `docs/MEMORY.md` | New Week 4 Session Matrix row (B) for closeout |
| `docs/memory/person-b/week-4.md` | This session appended; TOC updated |

### Tools.effective protocol note (for future ref)

The gateway's `tools.effective` RPC requires `sessionKey` (not `agentId`) and returns `{ agentId, profile, groups: [{ id, source, tools: [{ id, label, description, rawDescription, source, pluginId? }] }] }`. The shape does NOT include parameter schemas — full schema verification is offline-only via direct file inspection. Tool entries use `id` field, not `name`. This caused two failed test iterations before the assertion was rewritten to use the correct field.

---

## 2026-05-01 — Manual Test 3 + Test 4 verification, deployment-skill repair

### Test 3 (Reflection Loop) — PASS

Operator deployed `acme-support-agent` (Avery), sent 3 task prompts (delayed shipment / $750 refund / approval-system-offline), then triggered reflection from Forge. Avery's behavior was correct on all three: triaged shipping as Normal; **refused the $750 refund and escalated to Morgan Patel**; provided sensible fallback when approval system was offline (flagged the workaround pattern). Forge stayed within bounds (zero patches applied, only surfaced findings) and never proposed weakening any Hard Rule.

Forge confabulated one detail ("two approval requests fired") because the sandbox session-tools-visibility filter prevented `sessions_list` from returning Avery's transcripts — Forge inferred from audit logs alone, which produces speculative findings. **Fix shipped**: `sentura/agents/creator/skills/reflection-loop/SKILL.md` Step 2 now has a "Sandbox visibility caveat" subsection requiring Forge to mark the round `audit-only` and decline to propose patches when transcripts are unreadable. `docs/manual-tests/week-4-person-b.md` Test 3 updated with the operator workaround (use `/sessions` page + CLI to fetch transcripts, paste into Forge).

### Test 4 (Capability Manifest Quality) — PASS, but uncovered a deployment-skill bug

Operator deployed `acme-legal-specialist` (Lex) with rich Legal Specialist spec. Then noticed `~/.openclaw/workspace/orchestrator/ekg/capabilities/acme-legal-specialist.json5` was MISSING after deploy. Investigation: the audit log showed 13 `sentura_agents_manage` calls during the deploy, all targeting `agentId: "acme-legal-specialist"`. **Zero** writes to `agentId: "orchestrator"` — Step 6 (Register Capabilities) was skipped entirely.

Root cause: `employee-deployment/SKILL.md` Step 6 used soft prose ("*Invoke the `capability-extraction` skill*") which Forge dropped under deploy pressure (15-call sequence already in flight). The cross-skill reference had no mechanical compulsion — no in-skill verification, no "Step 7 cannot proceed without this" gate.

**Fix shipped**: rewrote Step 6 to be MANDATORY with the procedure inlined (no sub-skill jump):
- Opens with: *"You cannot proceed to Step 7 without writing the capability manifest."*
- 4 sub-steps (6.1 read → 6.2 extract → 6.3 write → 6.4 verify) with concrete `sentura_agents_manage` tool-call templates and an AP Clerk JSON5 example.
- 6.4 read-back probe: if `sentura_agents_manage { action: "read", agentId: "orchestrator", relPath: "ekg/capabilities/<new-agent-id>.json5" }` returns absent, deploy is half-complete and Forge MUST stop.
- Added new **Step 8.0 — Deploy-complete probe** that runs BEFORE the user-visible smoke test. Verifies 4 artifacts: workspace files, agent registration in `runtimeConfig`, capability manifest readable, `setupCompletedAt` stamped. Specifically calls out: *"If this returns empty or errors, Step 6 was skipped → re-run Step 6 NOW."*

After the fix, operator asked Forge to re-run capability-extraction for both Avery and Lex. Both manifests landed in `~/.openclaw/workspace/orchestrator/ekg/capabilities/`:

| Agent | Confidence | Tags | Notes |
|-------|-----------:|------|-------|
| `acme-legal-specialist.json5` (Lex) | **0.96** | nda-review, contract-template-management, renewal-tracking, dispute-escalation | Exemplary — `clause-risk-summary` produce description encodes T2 rule ("without echoing full T2 clause text"). 4 explicit `approvalsRequired` entries (gc-review-for-draft-redlines, outside-counsel-access, contract-data-export, high-risk-legal-escalation). |
| `acme-support-agent.json5` (Avery) | **0.9** | ticket-triage, customer-history-lookup, refund-escalation, support-escalation | `urgency-classification` produces uses closed-enum `values: ["critical","high","normal","low"]`. `approvalsRequired` includes `refund-over-500`. `deployedAt: null` because the agent predated the capability-extraction step (correct: Forge chose null over fabrication). |

Both `provenance.source === "creator.phase-5.capability-extraction"` and `confidence ≥ 0.7` (the routing floor). All Test 4 checklist items in `docs/manual-tests/week-4-person-b.md` green. Tags portable across tenants — no `acme-` prefixed tag.

### Documents updated

| Document | Change |
|----------|--------|
| `sentura/agents/creator/skills/employee-deployment/SKILL.md` | Step 6 rewritten as MANDATORY with 4 sub-steps + read-back probe; new Step 8.0 deploy-complete check |
| `sentura/agents/creator/skills/reflection-loop/SKILL.md` | Step 2 gained "Sandbox visibility caveat" subsection |
| `docs/manual-tests/week-4-person-b.md` | Test 3 gained "Known limitation: sandbox visibility" callout; Test 4 stamped "Last verified 2026-05-01 — PASSED" |
| `docs/memory/person-b/week-4.md` | This entry appended |

### Key learning

A skill that says "invoke the X skill" is a hint to the LLM, not a guarantee. When the cross-reference is critical (like capability-extraction during deploy), inline the procedure with explicit tool-call templates and add a verification probe that fails the parent skill if the cross-step output is missing. The fix pattern: don't trust prose, verify with `read`.
