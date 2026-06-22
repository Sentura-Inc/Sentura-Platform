# Incubation Memory

## When to Use

The Creator (Forge) writes a memory entry after every employee deployment — successful, failed, or rolled-back. The Creator reads this memory at the start of every new incubation request (referenced from `incubation/SKILL.md` Step 2.2) so it can reuse proven patterns and avoid known failure modes.

This is the long-term equivalent of OpenClaw's per-session memory: it persists across incubation runs and across operator sessions.

## Storage

Entries live in the Creator's native workspace `MEMORY.md` file:

```
~/.openclaw/workspace/creator/MEMORY.md
```

Read/write through the only path that works from inside the sandbox:

```
sentura_agents_manage { action: "read",  agentId: "creator", relPath: "MEMORY.md" }
sentura_agents_manage { action: "write", agentId: "creator", relPath: "MEMORY.md", content: <full new file> }
```

`write` overwrites the file — always read first, append the new entry, then write the combined contents back.

## Entry format

Append a dated section per deployment. Keep each entry under 30 lines.

```markdown
## 2026-04-30 — ap-clerk-finance (Accounts Payable Clerk)

- Role: Accounts Payable Clerk
- Department: finance
- Outcome: succeeded   <!-- succeeded | failed | rolled-back -->
- DeployedAt: 2026-04-30T10:14:00.000Z
- ConfidenceAfterTests: 0.85   <!-- pre-deploy test runner weighted suite score -->
- KeyDecisions:
  - Used MCP server `gradsale-admin` (read-only) for vendor lookup
  - Approval threshold: $5000 (per BOOTSTRAP.md Enterprise Context)
  - Sandbox: non-main, denied [browser, exec, sessions_spawn]
- ReusedPatterns:
  - finance-template-v1 (Hard Rules § approval-threshold)
- LessonsLearned:
  - Phase-3 self-provisioning unnecessary — vendor MCP already configured globally
  - Required adding `q4-financial-summary` capability tag for Mode-B routing
- Failures: none
- FollowUps: none
```

For failed deploys:

```markdown
## 2026-04-29 — sales-sdr-pacific (SDR — Pacific Region)

- Role: Sales Development Representative
- Department: sales
- Outcome: rolled-back
- AttemptedAt: 2026-04-29T18:02:00.000Z
- KeyDecisions:
  - Tried OAuth provisioning of HubSpot via browser tool
- LessonsLearned:
  - HubSpot OAuth flow requires admin consent — needed Elevated tier approval, not Standard
  - Browser captcha at provisioning step blocks autonomous deployment
- Failures:
  - Phase 3 Step 5 — `secrets.reload` succeeded but smoke test returned 401
- FollowUps:
  - Treat HubSpot as Elevated tier in `sentura/config/provisioning-templates/hubspot.json5`
  - Re-run with operator-assisted OAuth handoff
```

## Procedure

### Step 1: Read existing memory before designing

At the start of `incubation/SKILL.md` Step 2 (Research):

```
sentura_agents_manage { action: "read", agentId: "creator", relPath: "MEMORY.md" }
```

Scan section headers for matches on:
- Role title (substring match)
- Department
- MCP servers used
- Failure modes that may apply

If a similar past deploy succeeded, reuse its `KeyDecisions` and `ReusedPatterns` as the starting point. If a similar past deploy failed, treat its `LessonsLearned` as preconditions for the new attempt.

### Step 2: Write a memory entry after every deployment

Trigger this at the end of `employee-deployment/SKILL.md` (after Step 8 smoke test, or after rollback). Read MEMORY.md, append a new section using the formats above, write back.

For success: include `Outcome: succeeded`, `ConfidenceAfterTests` from the pre-deploy runner suite, and `KeyDecisions` capturing non-obvious choices a future deploy could reuse.

For failure: include `Outcome: failed` or `rolled-back`, exact failure point (Phase + Step), and a concrete `FollowUps` action a human or future Creator run should take.

### Step 3: Promote recurring patterns

If three or more recent entries (last 30 days) share a `ReusedPatterns` reference and `Outcome: succeeded`, suggest in the next deploy that the pattern be promoted to a role template under `sentura/config/templates/`. Do NOT auto-create the template — surface the recommendation to the operator.

## Tools Needed

- `sentura_agents_manage` (actions: `read`, `write`)

No gateway RPCs. No web search. No write to any other agent's workspace.

## Safety

- **Append-only.** Never delete or rewrite a past entry. If a past deploy was wrong about something, append a new entry with `Correction: 2026-04-30 ap-clerk-finance — supersedes the 2026-04-15 lessons …`.
- **No PII in memory.** Department, role, agent-id are fine. Specific user names, emails, ticket subjects, or secrets must NOT be written. The Creator's MEMORY.md is T0/T1.
- **Never reference secrets.** Use the secret pointer (e.g. `$secret.gradsale.api_key`) — never the raw value. Better: do not name the secret at all; record the service.
- **Bound the file.** If MEMORY.md exceeds 800 lines, summarize entries older than 90 days into a `## Archive (pre-{date})` section that retains only Role/Department/Outcome — preserve the latest 30 entries verbatim.
- **No cross-tenant leakage.** Entries describe Sentura's own workforce; do not log details that belong to a customer's enterprise (those go in the deployed agent's `BOOTSTRAP.md` Enterprise Context, not the Creator's MEMORY.md).
