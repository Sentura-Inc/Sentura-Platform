# Reflection Loop

## When to Use

After Phase 5 (Deploy) completes successfully, the Creator (Forge) starts a bounded reflection loop on the freshly deployed employee. The goal: catch obvious deployment issues before the operator notices them, apply targeted patches via the same workspace tooling used in Phase 4, and exit cleanly once the employee has handled at least 3 real tasks without recurring failures.

This skill is intentionally bounded — it is NOT a long-running supervisor. It runs at most 3 reflection rounds, with at most one targeted patch per round. Anything beyond that escalates to the operator with a structured failure summary.

## Procedure

### Step 0: Preconditions

- Phase 5 completed: `register_agent` succeeded and the smoke test in `employee-deployment/SKILL.md` Step 8 returned a coherent reply.
- The capability manifest has been written via `capability-extraction/SKILL.md`.
- The pre-deployment test suite reported `recommendation: "deploy"` (or no suite was run — flag that gap as round-1 finding).

If any precondition is unmet, do not start the loop — surface the gap to the operator instead.

### Step 1: Wait for real activity

Reflection requires real signal, not synthetic. Wait for one of:

- Operator says "the new employee has been working for a while now" or similar
- 3 sessions exist for the new agent: `gateway.call("sessions.list", { agentId: "<new-agent-id>" })` returns ≥3 entries with `lastTurnAt` populated
- 24 hours since deployment (whichever comes first)

Do not poll continuously — the loop is invoked on demand, not on a timer.

### Step 2: Pull recent transcripts

For each of the most recent up to 5 sessions on the new agent:

```
gateway.call("sessions.history", { sessionKey: "<key>", limit: 30 })
```

Extract per session:
- The user's first message (intent)
- All tool calls (sequence + result success/error)
- The final assistant reply
- Any `exec.approval` events the session triggered

Combine into a `reflection-bundle` (in-memory only — do NOT write transcripts to disk).

#### Sandbox visibility caveat

If `sessions.list` returns zero entries OR `sessions.history` rejects with `"Session not visible from this sandboxed agent session"`, the sandbox session-tools-visibility filter is blocking access to the deployed agent's transcripts. When this happens:

1. **Do NOT propose patches** based on inferred behavior from audit logs alone — that path produces speculative findings that are easy to confabulate (e.g. claiming `sentura_approval_request` fired N times when it actually didn't).
2. **Mark the round `audit-only`** in the bookkeeping entry: `Round N (timestamp): audit-only — sandbox visibility filter blocked sessions.history; surfaced N candidate findings without patches.`
3. **Surface the visibility limitation explicitly** in the operator report, e.g.:
   > "I could not pull full transcripts (sandbox session-tools-visibility blocked `sessions.list`). I can only score what the audit trail shows: tool-call counts and approval events. Heuristics 1 and 4 (explicit triage / tone) are unverified."
4. **Operator workaround**: Run reflection from a non-sandboxed surface (the dashboard `/sessions` page or a CLI script using the operator token) where session visibility is unrestricted. The operator can then paste the reflection-bundle back to Forge for analysis.

The visibility filter is a deliberate safety boundary — Forge's `agents.defaults.sandbox.sessionToolsVisibility: "all"` relaxation only widens the *meta-agent* surface; cross-session reads of *deployed-agent* transcripts can still be filtered by the spawned-session clamp.

### Step 3: Detect issues

Score each session against four heuristic checks:

| Check | Trigger | Fix target |
|-------|---------|------------|
| **Tool-loop** | Same tool called ≥4 times consecutively with errors | `skills/<relevant>/SKILL.md` Procedure step ordering |
| **Hard-rule false positive** | Agent refused with "Hard Rule" wording on a benign-looking task | `AGENTS.md` Hard Rules wording — narrow the rule |
| **Missing approval** | Action that should have triggered `exec.approval.request` did not | `BOOTSTRAP.md` Enterprise Context approval thresholds |
| **Off-tone reply** | Final reply contradicts SOUL.md voice (e.g. clinical when SOUL.md says warm) | `SOUL.md` voice/personality |

A session with no triggers is a clean reflection signal. A session that fires a trigger gets a `findingId` and a target file.

### Step 4: Apply at most one targeted patch

If exactly one finding has high confidence (the same trigger fired in ≥2 of the recent sessions and no benign explanation in the transcript):

1. Read the target file via `sentura_agents_manage { action: "read", agentId: "<new-agent-id>", relPath: "<target>" }`.
2. Generate a minimal patch — change ONLY the section that the trigger points at. Show the patch as a unified diff in the response.
3. Apply via `sentura_agents_manage { action: "write", agentId: "<new-agent-id>", relPath: "<target>", content: <full new file> }`.
4. Wait for OpenClaw's hot-reload (2-3 seconds) — workspace changes are picked up on the next session's startup; existing live sessions are not affected.

If 0 findings: log "round N: clean" and exit the loop.

If ≥2 findings or a single low-confidence finding: log all findings to Creator's MEMORY.md (per `incubation-memory/SKILL.md`) and escalate to the operator with:

```
Reflection round N for <agent-id> — {found-count} findings, none high-confidence.
Targets: {list}.
Recommend operator review before further changes.
```

### Step 5: Re-test the patch

After applying a patch, run the same pre-deploy test suite that was used in capability #15:

```
npx tsx scripts/run-pre-deployment-tests.ts --suite <path-to-suite> --output <result-path>
```

(Or have the operator trigger this — the Creator can read the result file via `fs_read` if the path is outside the workspace mount.)

If the suite still recommends `deploy`, the patch is good. If it now recommends `auto-tune` or worse, revert the patch (write the file back to its pre-patch contents) and escalate.

### Step 6: Bookkeeping

Always log the reflection round to Creator's MEMORY.md per `incubation-memory/SKILL.md` — append to the original deploy entry as a `Reflection rounds:` sub-bullet:

```markdown
- Reflection rounds:
  - Round 1 (2026-04-30T22:00:00.000Z): clean — no findings
  - Round 2 (2026-05-01T15:30:00.000Z): patched skills/invoice-triage/SKILL.md (procedure ordering); re-test passed
```

### Step 7: Exit conditions

Stop reflecting when ANY of:

- 3 reflection rounds have completed with `clean` results in the latest 2 → the employee is stable
- 3 patches have been applied → cap to prevent thrashing; escalate to operator
- A patch failed re-test and was reverted → escalate immediately
- Operator says "stop monitoring" or equivalent

## Tools Needed

- `sentura_agents_manage` (actions: `read`, `write`) — workspace inspection + targeted patches
- `gateway` (actions: `sessions.list`, `sessions.history`) — transcript pulling
- The `incubation-memory/SKILL.md` skill — bookkeeping

The Tuner agent is NOT invoked from this loop. The Creator owns the reflection patches because the Creator owns the employee's design.

## Safety

- **At most one patch per round.** Multiple simultaneous changes obscure cause-and-effect for the next round's findings.
- **At most three patches across all rounds.** After 3 patches, the underlying design has a problem the operator must own.
- **Never patch `## Hard Rules` to weaken safety.** The reflection loop CAN tighten Hard Rules but cannot remove or loosen them; loosening is operator-only via the Tuner.
- **No transcript persistence.** Reflection bundles stay in working memory. Write findings, not raw user/assistant text. Real transcripts may contain T2+ data the Creator's memory must not retain.
- **Revert is mandatory on regression.** If a patch passes Step 4 but fails Step 5 (re-test), revert immediately — do not "try again with a tweak". Escalate.
- **Escalation always includes the diff.** When escalating to the operator, include the patches that were applied (or attempted) so the operator can audit without re-reading transcripts.
