# Capability Extraction (Phase 5 Deploy — Mechanism 1 of capability #17)

## When to Use

Invoke this skill **once** during Phase 5 (Deploy), after `register_agent` succeeds and before the smoke test in `employee-deployment/SKILL.md` Step 8. It writes the new employee's capability manifest into the Orchestrator's EKG (`orchestrator/ekg/capabilities/{agent-id}.json5`) so future Mode B task decomposition can route work to the right employee.

This skill is the Creator's slice of capability #17 (Manager EKG aggregation). Mechanisms 2 (cross-domain conflict detection) and 3 (reverse-injection training) live on the Orchestrator and ship in Week 5.

## Procedure

You have an authoritative source of truth: the workspace files you just wrote in Phase 4 (`SOUL.md`, `BOOTSTRAP.md`, `IDENTITY.md`, `TOOLS.md`, every `skills/*/SKILL.md`) and the `agents.list` entry from `register_agent`. Extract — never invent.

### Step 1: Gather inputs (read-only)

Use `sentura_agents_manage({ action: "read", agentId: "<new-agent-id>", relPath: "..." })` to fetch:

1. `IDENTITY.md` → role + department
2. `SOUL.md` → primary mission statement (first paragraph)
3. `BOOTSTRAP.md` → Enterprise Context section (constraints / approvals)
4. `TOOLS.md` → allowed tools and MCP servers
5. List of skills: `sentura_agents_manage({ action: "list", agentId: "<new-agent-id>", relDir: "skills" })`
6. Each `skills/*/SKILL.md` → "When to Use" line and the first numbered Procedure step

You also need the registered config from `register_agent`'s response (model, tools.alsoAllow, sandbox.mode).

### Step 2: Extract `capabilityTags`

Tags are short kebab-case nouns or verb-noun pairs that describe what this employee can DO. Source them from:

- Skill folder names (each skill is one capability candidate)
- Verbs at the start of each skill's "When to Use" line ("Process invoices…" → `invoice-processing`)
- Department-prefixed domain terms in `BOOTSTRAP.md` Enterprise Context

Rules:

- 3 ≤ `capabilityTags.length` ≤ 10. Fewer than 3 means the employee is too narrow to be Mode-B routable; flag `reviewRequired: true`. More than 10 means tags are too granular; consolidate.
- No proper nouns. `gradsale-listings` ❌; `marketplace-listing-management` ✅. Capability tags must be portable across tenants.
- No internal jargon. `t2-disputes` ❌; `dispute-resolution` ✅.

### Step 3: Extract `ioSchemas`

`accepts[]` and `produces[]` describe what messages/payloads the employee can consume and emit. Source them from each `SKILL.md`'s Procedure section:

- `accepts`: things the user / orchestrator passes IN. Look for "given …", "if the user provides …", "input: …".
- `produces`: outputs / decisions / artifacts. Look for "the output is …", "decision: …", "writes to …".

Format each entry as `{ kind, description, required?: string[], values?: string[] }`. Use closed enums (`values`) for decision outputs; use `required[]` for structured inputs (e.g. an invoice-pdf needs `vendor`, `amount`, `dueDate`).

If you cannot extract at least one accept and one produce, set `reviewRequired: true` — the employee's skills are under-specified.

### Step 4: Compile the rest

| Field | Source | Notes |
|-------|--------|-------|
| `agentId` | `register_agent` response | lowercase, kebab-case |
| `name` | `IDENTITY.md` line "Name: …" or `register_agent` `name` | display name |
| `department` | `IDENTITY.md` "Dept: …" | lowercase, single word preferred (`finance`, `support`) |
| `deployedAt` | `new Date().toISOString()` at write time | ISO-8601 UTC (e.g. `2026-04-30T10:14:00.000Z`) |
| `deployedBy` | literal `"creator"` | always |
| `invokableSkills` | result of `list` (Step 1.5) | list folder names without paths |
| `approvalsRequired` | `BOOTSTRAP.md` Enterprise Context "approval-required:" lines + AGENTS.md "Hard Rules" | extract any rule that says the employee must escalate |
| `costEstimate.tokensPerTask` | heuristic: 4000 (read-only roles) / 8000 (transactional) / 12000 (research-heavy) | document the heuristic in `provenance.note` if used |
| `costEstimate.model` | `register_agent` `model` | as registered |
| `provenance.source` | literal `"creator.phase-5.capability-extraction"` | enables audit attribution |
| `provenance.extractedAt` | same ISO-8601 timestamp as `deployedAt` | |
| `provenance.confidence` | 0.5 if any `reviewRequired` flag was raised; 0.7 if extraction had ≥1 implicit-tag promotion; 0.85 if every field came from explicit text | floor for inclusion in routing is 0.7 |

### Step 5: Write the manifest

```json
{
  "tool": "sentura_agents_manage",
  "args": {
    "action": "write",
    "agentId": "orchestrator",
    "relPath": "ekg/capabilities/<new-agent-id>.json5",
    "content": "{\n  agentId: '<new-agent-id>',\n  name: '...',\n  department: '...',\n  deployedAt: '2026-04-30T10:14:00.000Z',\n  deployedBy: 'creator',\n  capabilityTags: ['...'],\n  ioSchemas: { accepts: [...], produces: [...] },\n  invokableSkills: ['...'],\n  approvalsRequired: ['...'],\n  costEstimate: { tokensPerTask: 8000, model: 'openai/gpt-5.4' },\n  provenance: { source: 'creator.phase-5.capability-extraction', extractedAt: '2026-04-30T10:14:00.000Z', confidence: 0.85 },\n  reviewRequired: false,\n}\n"
  }
}
```

### Step 6: Verify

Read it back with `sentura_agents_manage({ action: "read", agentId: "orchestrator", relPath: "ekg/capabilities/<new-agent-id>.json5" })`. The manifest is now visible to:

- Orchestrator's `task-decomposition` skill (when matching subtasks to candidate employees)
- Manager skills (Week 5: conflict detection, reverse injection)
- The dashboard `/employees` page (capability badges)

## Tools Needed

- `sentura_agents_manage` (actions: `read`, `list`, `write`)

No gateway RPCs. No write to the deployed agent's own workspace — only to the Orchestrator's EKG.

## Safety

- **Never invent capabilities.** If the SKILL.md says nothing about ratings, do not add `rating-management`. Under-specification is preferable to overclaiming.
- **Never write T3/T4 data.** This manifest is consumed by routing logic and the dashboard — keep it at T0/T1. If a skill mentions PII, summarize as a tag (`personal-data-handling`) without specifics.
- **Confidence < 0.7 ⇒ `reviewRequired: true`.** This excludes the entry from auto-routing until a human accepts it via the dashboard.
- **Idempotent overwrite.** A re-deploy (Phase 5 again) may rewrite the same manifest. The Orchestrator's EKG is additive — keep `provenance.extractedAt` accurate so superseding entries can reference the predecessor with `supersedes: ["{previous-iso8601}"]` when meaningful changes are made.
- **No notifications during Phase 5.** Do not message other agents from this skill — Mechanism 2/3 (Week 5) own that. This skill writes a manifest and exits.
