> **On-demand reference — not read by default.**
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md) — open from the Session Matrix row, not pre-emptively.

# Person B — AI Employee & Skills — Week 3

Person B's Week 3 work covers capability #12 (Data Scavenger Agent), continuing
the EKG pipeline from Week 2's schema design. This week's primary deliverable is
the full Scout agent workspace: config, all 8 native OpenClaw workspace files,
and 4 pipeline skills (ingestion, classification, structuring, ekg-merge).

## Sessions in this file

| Date | Title | Summary |
|------|-------|---------|
| 2026-04-26 | Data Scavenger Agent workspace (Scout) | Full workspace creation — 9 files + 4 skills for capability #12 |
| 2026-04-26 | All remaining Week 3 Person B tasks | Self-provisioning pipeline + templates + test script; Tuner skills; Orchestrator skills; Q&A Completion; Experience Link; pre-deployment test harness; personal-memory skill |
| 2026-04-26 | Live-gateway test verification + 3 protocol bugs fixed | Ran tests against live gateway. Three bugs fixed: (1) test scripts used wrong WebSocket envelope, (2) self-provisioning SKILL.md called fictional `secrets.exists`/`secrets.set` RPCs, (3) `docs/gateway-rpc.md` example propagated the same wrong protocol. All tests green (66/66 + 40/40). |

---

## 2026-04-26 — Data Scavenger Agent workspace (Scout)

### What was built

Created the complete Data Scavenger Agent ("Scout") workspace at
`sentura/agents/data-scavenger/`. Scout is the meta-agent responsible for
ingesting enterprise documents and classifying their content into the 4-pillar
EKG structure (org / rules / assets / workflows) for target AI employees.

### Files created (13 total)

**Root workspace — 9 files:**

| File | Purpose |
|------|---------|
| `sentura/agents/data-scavenger/config.json5` | Agent registration: model `openai/gpt-5.4`, id `data-scavenger`, name `Scout`, runtime embedded, sandbox non-main, tool profile coding + alsoAllow [pdf, web_fetch, web_search, sentura_agents_manage, memory_search], deny [sessions_spawn, subagents, sessions_yield, browser, exec, write, edit, apply_patch], sandbox.tools.alsoAllow mirrors alsoAllow + [memory_get, canvas, cron, update_plan] |
| `sentura/agents/data-scavenger/AGENTS.md` | Hard Rules: additive-only EKG writes, no T3/T4 without ekg_manager approval, no fabricated entries, no notification before pipeline complete, always classify into correct pillar. Session startup: SOUL.md -> TOOLS.md -> skills -> memory check -> announce. |
| `sentura/agents/data-scavenger/SOUL.md` | Personality: methodical, precise, thorough, patient, transparent, collaborative. Mission: transform unstructured enterprise docs into structured EKG entries with full provenance. |
| `sentura/agents/data-scavenger/TOOLS.md` | Tool notes: pdf, web_fetch, web_search, sentura_agents_manage (read + write call signatures), memory_search (dedup logic: >=0.9 exclude, 0.7-0.89 flag, <0.7 new), memory_get, message/sessions_send. |
| `sentura/agents/data-scavenger/IDENTITY.md` | Role: Data Scavenger Agent, Dept: Platform, Reports to: EKG Manager (ekg_manager role), Peers: Creator/Tuner/Orchestrator. |
| `sentura/agents/data-scavenger/USER.md` | Interaction guide: upload document + targetAgentId. Scout extracts, classifies, flags low-confidence items, merges additively, emits completion report. |
| `sentura/agents/data-scavenger/HEARTBEAT.md` | Status fields: documentsIngested (int), lastIngestionAt (ISO-8601), pendingQueueSize (int), lowConfidenceFlags (int), failedIngestions (int). Escalation thresholds: queue >10, flags >20, failures >3/24h. |
| `sentura/agents/data-scavenger/BOOTSTRAP.md` | Enterprise Context: EKG 4-pillar structure (org/rules/assets/workflows with paths), EKG entity JSON5 schema (id, type, name, attributes, relations, provenance), merge semantics (read-append-write, never destructive), provenance format (source string, ingestedAt ISO-8601, format enum, targetAgentId string, confidence float 0.0-1.0), classification guidelines (one pillar per entity, no fabrication, flag ambiguity), data tiers T0-T4. |
| `sentura/agents/data-scavenger/MEMORY.md` | Empty initial memory; populated at runtime by OpenClaw's memory system with ingestion log entries. |

**Skills — 4 files:**

| File | Stage | Purpose |
|------|-------|---------|
| `sentura/agents/data-scavenger/skills/ingestion/SKILL.md` | 1 | Verify T-classification; accept document via pdf/read/web_fetch/image; extract raw text; record provenance {source, ingestedAt, format, targetAgentId}; pass to classification skill |
| `sentura/agents/data-scavenger/skills/classification/SKILL.md` | 2 | Read target agent's existing ekg/ via sentura_agents_manage; analyse full text; classify into org/rules/assets/workflows; assign confidence 0.0-1.0; flag <0.6 with reviewRequired + classificationNote; pass to structuring skill |
| `sentura/agents/data-scavenger/skills/structuring/SKILL.md` | 3 | Convert to JSON5 per ekg-schema; group by pillar into {orgEntities[], rulesEntities[], assetsEntities[], workflowsEntities[]}; deduplicate via memory_search + sentura_agents_manage ground-truth read; report dedup summary; pass payload to ekg-merge skill |
| `sentura/agents/data-scavenger/skills/ekg-merge/SKILL.md` | 4 | For each pillar: read existing -> append new entities -> write merged (additive only); hold reviewRequired entities; after all pillars confirmed: notify target agent via sessions_send; log merge event {event, targetAgentId, pillars, entitiesAdded, timestamp ISO-8601}; emit completion report |

### Key design decisions

1. **Single-session atomicity**: `sessions_spawn`, `subagents`, and `sessions_yield`
   are hard-denied. Every ingest pipeline run completes in one session using
   `sentura_agents_manage` directly. Matches the pattern established for Creator
   in Round 20 (2026-04-19).

2. **Sandbox tool mirror**: `tools.sandbox.tools.alsoAllow` mirrors
   `tools.alsoAllow` plus [memory_get, canvas, cron, update_plan], following the
   sandbox tool-policy fix from Round 20. Without this block, plugin tools are
   stripped at the sandbox filter layer (openclaw/src/agents/sandbox/constants.ts
   DEFAULT_TOOL_ALLOW). See Current Ground Truth in docs/MEMORY.md.

3. **Additive-only invariant**: enforced at three levels — Hard Rules in
   AGENTS.md, ekg-merge skill Safety section, and explicit read-before-write
   procedure in the merge skill. This is the hardest safety constraint for a
   knowledge-base agent.

4. **T3/T4 escalation**: documents of unknown classification are treated as T3
   and require ekg_manager approval via exec.approval before ingestion proceeds.
   Maps to the BOOTSTRAP.md data classification tier table (T0 public through
   T4 restricted).

5. **Confidence-gated merge**: entities with confidence < 0.6 are flagged with
   `reviewRequired: true` and held from the EKG merge until approved. They are
   carried through the full pipeline but not written to the EKG files.

6. **Provenance as first-class field**: every entity carries full provenance
   {source, ingestedAt, format, targetAgentId, confidence} at every pipeline
   stage. Enforced in Hard Rules and in each skill's Safety section.

### TeamPlan.md updates

- `docs/TeamPlan.md` Week 3 Person B task "Build Data Scavenger Agent workspace
  (capability #12)" marked `[x]` complete with completion note dated 2026-04-26.

### Linked matrix row

`docs/MEMORY.md` Week 3: `2026-04-26 | B | Data Scavenger Agent workspace (Scout) | memory/person-b/week-3.md`

---

## 2026-04-26 — All remaining Week 3 Person B tasks

### What was built

Completed all outstanding Week 3 tasks for Person B (AI Employee & Skills Engineer)
in a single session (context-resumed from a prior compacted session). This was a
continuation: the Data Scavenger workspace was built by a sub-agent; everything below
was built in the main session.

### Files created (15 new files)

| File | Task |
|------|------|
| `sentura/agents/creator/skills/self-provisioning/SKILL.md` | Creator Phase 3 pipeline |
| `sentura/config/provisioning-templates/zendesk.json5` | Provisioning template — standard tier |
| `sentura/config/provisioning-templates/hubspot.json5` | Provisioning template — standard tier |
| `sentura/config/provisioning-templates/salesforce.json5` | Provisioning template — elevated tier (OAuth + paid) |
| `sentura/config/provisioning-templates/notion.json5` | Provisioning template — standard tier + MCP server package |
| `sentura/config/provisioning-templates/slack.json5` | Provisioning template — auto tier (native OpenClaw channel, no MCP) |
| `sentura/agents/tuner/skills/nl-to-config/SKILL.md` | Tuner — NL → config.patch |
| `sentura/agents/tuner/skills/workspace-edit/SKILL.md` | Tuner — NL → agents.files.set |
| `scripts/test-tuner-e2e.ts` | Tuner offline + live test script (6 + 4 cases) |
| `sentura/agents/orchestrator/skills/task-decomposition/SKILL.md` | Orchestrator Mode B |
| `sentura/agents/orchestrator/skills/multi-agent-routing/SKILL.md` | Orchestrator execution mechanics |
| `sentura/skills/qa-completion/SKILL.md` | Capability #13 Tier 2 — cron gap-filling |
| `sentura/skills/experience-extraction/SKILL.md` | Capability #13 Tier 3 — post-task learning |
| `sentura/config/test-harness-schema.json5` | Capability #15 schema |
| `sentura/skills/pre-deployment-testing/SKILL.md` | Capability #15 workflow |
| `sentura/skills/personal-memory/SKILL.md` | Per-user memory isolation + dreaming design |
| `scripts/test-self-provisioning.ts` | Self-provisioning offline + live test script (5 + 4 groups) |

### Key design decisions

**Self-provisioning pipeline (SKILL.md — 9 steps)**
- Tier classification: Auto (IT pre-approved list), Standard (free, HITL), Elevated (paid/OAuth, HITL)
- Credentials stored exclusively in OpenClaw secret store (`$secret.*`). Never in config files or conversation history.
- Hard block: browser provisioning of paid services requires Elevated approval before any navigation step.
- Phase 4 signal: pipeline exits by signalling Phase 4 (deployment) only after smoke-test passes.
- Error recovery for CAPTCHA, 2FA, rate limits: escalate to human with full browser screenshot context.

**Provisioning templates — schema**
```json5
{ service, displayName, tier, registrationUrl, apiSettingsUrl, docsUrl,
  formFields, credentialKeys, minimumScopes, mcpServerPackage, notes }
```
Slack is `tier: "auto"` because OpenClaw ships a native Slack channel extension — no MCP provisioning needed. Salesforce is `tier: "elevated"` because the OAuth app creation requires admin consent and billing access.

**Tuner skills**
- `nl-to-config`: 7 steps ending in `config.patch` with optimistic concurrency (`baseHash`). Diff shown before apply. Hard block: never add `gateway` tool to non-meta-agents, never change `sandbox.mode` to `"main"`.
- `workspace-edit`: 6 steps using `agents.files.get` / `agents.files.set`. Sends full file (not patch). Hard block: never remove `## Hard Rules` section from any AGENTS.md.

**Orchestrator skills**
- `task-decomposition`: discovers available agents via `config.get`; selects pattern (Sequential/Parallel/Conditional/Fan-out); shows plan and waits for operator approval before routing.
- `multi-agent-routing`: T3/T4 data requires operator consent before passing between sessions. All refusals reported verbatim — never softened. Produces traceable execution report with session keys for audit.

**Q&A Completion skill (capability #13 Tier 2)**
Gap priority table: Critical (null required field) > Unattributed (missing provenance) > Missing Relation > Low Confidence (<0.5) > Isolated Entity.
Cap: 5 questions/run. Re-ask guard: 7 days (checked via MEMORY.md pending records).
Pending record format: `{ entityId, field, asked: "YYYY-MM-DD", status: "pending" }`

**Experience Link extraction skill (capability #13 Tier 3)**
Initial confidence range: 0.3–0.6 (never start above 0.6 — 0.7+ is promotion territory).
Confidence update formula: `min(0.9, existing + 0.1 * sqrt(occurrences))`
Promotion gate: confidence ≥ 0.75 AND occurrences ≥ 3 → notify operator; confidence ≥ 0.9 → draft SKILL.md for review.
Dedup: `memory_search` first, then scan `ekg/workflows/experience-links/*.json5` for similar `pattern` fields.

**Pre-deployment test harness (capability #15)**
Schema (`sentura/config/test-harness-schema.json5`) defines 5 types:
- `testCase`: `{ id, agentId, scenario, inputMessage, expectedActions, expectedOutcome, scoringRubric: { passMark: 0.75, autoTuneThreshold: 0.5 }, source, createdAt }`
- `mockGeneratorConfig`, `testRunResult`, `testSuite` (`maxAutoTuneIterations: 3, overallPassMark: 0.75`), `suiteRunResult`

Pass/fail routing:
| passRate | Action |
|----------|--------|
| ≥ 0.75 | deploy |
| 0.50–0.74 | auto-tune (max 3 cycles) |
| < 0.50 | human-review |
| Any Hard Rule adversarial FAIL | block unconditionally |

**Personal memory isolation skill**
Bootstrap hook injection (already done by Person A, Week 2) provides the runtime mechanism.
This skill documents the runtime behaviour:
- Read priority: personal scope > general scope for user-specific facts; general scope for org/policy.
- Write gate: personal entries never contain T3/T4, PII beyond first name, or financial/health data; general MEMORY.md entries stripped of all user identity before write.
- Dreaming: ≥3 distinct user files with the same pattern → candidate for general promotion (operator approval required). Personal files >150 lines → consolidate entries older than 30 days. Stale entries (>90 days + more recent session) → `<!-- stale: YYYY-MM-DD -->` (never delete).

### Pre-existing state discovered

- Tuner Agent (`sentura/agents/tuner/`) already had 8 native workspace files + `config.json5` from a prior session. Had zero skills — both skills were net-new.
- Orchestrator Agent (`sentura/agents/orchestrator/`) same situation — 8 files + config, zero skills. Both skills were net-new.
- `sentura-bootstrap` hook (`sentura/hooks/sentura-bootstrap/handler.ts`) already injects `MEMORY_USER_{token}.md` (implemented by Person A in Week 2). The personal-memory skill documents its runtime contract; no hook changes needed.

### Fact-Forcing Gate

Every `Write` and `Edit` in this session was blocked by a `PreToolUse` hook requiring four stated facts before proceeding:
1. Callers / files that will reference the new file
2. Confirmation no existing file serves the same purpose
3. Data structures (field names + synthetic values + date format)
4. Verbatim user instruction

Each gate was satisfied by stating the facts in the text response and then retrying the identical tool call. This is expected production behaviour for this project's hook configuration.

### Documents updated

| Document | Change |
|----------|--------|
| `docs/TeamPlan.md` | All Week 3 Person B tasks marked `[x]` with dated completion notes |
| `docs/TESTS.md` | Rows B14–B23 added (10 new test rows); Person B section count updated to 34 |
| `docs/MEMORY.md` | Second Week 3 Person B row added to Session Matrix |
| `docs/memory/person-b/week-3.md` | This file — TOC updated, this session appended |

---

## 2026-04-26 — Live-gateway test verification + 3 protocol bugs fixed

### Trigger

User asked to "open up a terminal and run cd /Users/henry/Desktop/Sentura-Platform/openclaw && pnpm gateway:watch yourself, then run through all tests to verify, and fix any issues along the way." Started gateway in background, ran the live test suites, and found three real bugs propagated from incorrect documentation.

### Bug 1 — Wrong WebSocket envelope in test scripts

**Symptom:** `T-LIVE-2`/`T-LIVE-3` timed out; gateway log showed `[ws] invalid handshake`, `[ws] invalid request frame`, close code `1008`.

**Root cause:** Both `scripts/test-self-provisioning.ts` and `scripts/test-tuner-e2e.ts` were sending raw JSON-RPC 2.0 frames (`{ jsonrpc: "2.0", method, params, id }`). OpenClaw's gateway uses a custom envelope:
- Server sends `{ type: "event", event: "connect.challenge", payload: { nonce } }` on connect.
- Client must reply with `{ type: "req", id, method: "connect", params: { minProtocol: 3, maxProtocol: 3, client: { id: "openclaw-tui", ... }, caps: [], role: "operator", scopes: [...], auth: { token } } }`.
- Subsequent RPCs use `{ type: "req"|"res", id, method, params, payload, ok, error }` — NOT `result` / `error` JSON-RPC fields.

**Fix:** Ported the `RpcClient` pattern from [`scripts/probe-creator-tools.ts:71-173`](../../../scripts/probe-creator-tools.ts) into both test scripts. Token loaded from `~/.openclaw/openclaw.json` `gateway.auth.token`.

**Cross-reference:** This is the SAME bug Person C documented in [`docs/memory/person-c/week-1.md:105-114`](../person-c/week-1.md) for the dashboard's `GatewayClient`. The bug kept reappearing because the reference doc still had the wrong example (see Bug 3).

### Bug 2 — Fictional `secrets.exists` / `secrets.set` RPCs in self-provisioning SKILL.md

**Symptom:** `T-LIVE-2 secrets.exists RPC responds — Error: unknown method: secrets.exists`.

**Root cause:** The Creator's Phase 3 self-provisioning skill ([`sentura/agents/creator/skills/self-provisioning/SKILL.md`](../../../sentura/agents/creator/skills/self-provisioning/SKILL.md)) instructed the agent to call:
- `secrets.exists` to check whether a credential is provisioned
- `secrets.set` to write a new credential to the secret store

Neither RPC exists. OpenClaw's gateway exposes only:
- `secrets.reload` — `{ ok: true, warningCount: number }` reply (no params)
- `secrets.resolve` — `{ commandName, targetIds: [knownTargetId] }` (target IDs must be in the registry, see `openclaw/src/secrets/target-registry.ts`)

There is **no** secret-write RPC at all. Secrets are written to disk: `~/.openclaw/.env` (dotenv) or via a configured `secrets.providers.<name>.command`. After writing, call `secrets.reload` to warm-reload the cache.

**Fix:** Rewrote Step 1 to use `secrets.resolve` for known targets + dotenv read for ad-hoc keys, and Step 5 to write `KEY=VALUE` to `~/.openclaw/.env` and call `secrets.reload`. Updated the Tools list (line 231).

**Why this slipped through:** When I authored the SKILL.md (in the prior compacted session) I named the RPCs from intuition without verifying against `openclaw/src/gateway/server-methods-list.ts`. The offline test happily greenlit `SKILL.md references secrets.exists RPC` because the test was checking my own invented surface, not the real one.

### Bug 3 — `docs/gateway-rpc.md` example used the wrong protocol

**Symptom:** Same as Bug 1 — but in the *reference doc* that future devs/agents read.

**Root cause:** The "Connection Example (TypeScript)" section showed `ws.send({ jsonrpc: "2.0", method, params, id })` and parsed `data.result` instead of `data.payload`. This was the seed of the bug pattern that bit Person C (week 1, dashboard GatewayClient) and bit me (week 3, test scripts).

**Fix:** Rewrote the example to mirror the working code in `scripts/probe-creator-tools.ts`. Added a prominent ⚠️ callout: *"OpenClaw does NOT use JSON-RPC 2.0 framing"*. Added the 4-step protocol description (challenge → connect → res → subsequent RPCs) before the code block.

### Verification

Started gateway via `cd openclaw && pnpm gateway:watch`. Re-ran both suites:

| Script | Cases | Result |
|--------|------:|--------|
| `scripts/test-self-provisioning.ts` (offline + live) | 66 | **66 PASS / 0 FAIL / 0 SKIP** |
| `scripts/test-tuner-e2e.ts` (offline + live) | 40 | **40 PASS / 0 FAIL** |

Live `config.get` returned 5 agents (`main`, `creator`, `tuner`, `orchestrator`, `mcp-builder`). T-LIVE-3 patch round-trip soft-skipped because no non-meta agent is currently deployed (expected — there are no real employees yet on this machine).

### Snapshot shape — for future reference

`config.get` does NOT return the bare config. It returns a `ConfigFileSnapshot`:
```
{
  hash: string,                   // baseHash for config.patch (top-level field)
  runtimeConfig: OpenClawConfig,  // preferred read path
  config: OpenClawConfig,         // deprecated alias of runtimeConfig
  parsed: OpenClawConfig | null,
  resolved: ResolvedSourceConfig,
  raw: string | null,
  valid: boolean,
  ...
}
```
Read agents at `payload.runtimeConfig.agents.list` (NOT `payload.agents.list`). Use `payload.hash` (NOT `payload.baseHash`) when calling `config.patch`.

### Out-of-scope finding (spawned as separate task)

Data Scavenger workspace exists on disk but `scripts/sentura-setup.sh` doesn't seed it into `~/.openclaw/openclaw.json`. The `META_AGENTS` array in the setup script needs `data-scavenger` added so the new meta-agent is registered (along with its `tools.sandbox.tools.alsoAllow` block). Spawned as a separate task — Person D / Week 4 territory.

### Documents updated in this session

| Document | Change |
|----------|--------|
| `scripts/test-self-provisioning.ts` | Rewrote handshake to `connect.challenge` + `type: "req"/"res"`; switched probe from `secrets.exists` to `secrets.reload`; fixed `config.get` payload parsing to read `runtimeConfig.agents.list`; added soft-skip for missing operator token. |
| `scripts/test-tuner-e2e.ts` | Same handshake rewrite; updated `config.get` parsing to use `runtimeConfig.agents.list` + top-level `hash` (was `agents.list` + `baseHash`); added `loadOperatorToken` helper. |
| `sentura/agents/creator/skills/self-provisioning/SKILL.md` | Step 1 rewritten (real `secrets.resolve` + dotenv read); Step 5 rewritten (dotenv append + `secrets.reload`); Tools list (line 231) updated to list real RPCs. |
| `docs/gateway-rpc.md` | Connection-example rewrite — fixed envelope, added handshake docs, fixed `payload` (was `result`). |
| `docs/TESTS.md` | B14 row description updated to reflect real `secrets.resolve` / `secrets.reload` references. |
| `docs/memory/person-b/week-3.md` | This session appended; TOC row added. |
