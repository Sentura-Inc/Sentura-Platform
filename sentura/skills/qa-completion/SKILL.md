# Q&A Completion (EKG Gap-Filling)

## When to Use

Triggered by cron schedule (typically daily or weekly). Scans the agent's `ekg/` directory for incomplete knowledge entries and generates targeted clarifying questions to fill the gaps. Part of Capability #13 (Tier 2: structured gap-filling).

Also triggered manually when an operator says "check my knowledge gaps" or "what information are you missing?"

## Procedure

### Step 1: Scan EKG Directory

`sentura_agents_manage` reads ONE file per call (singular `relPath`, no globs).
Two-pass: list each pillar directory, then read each entry returned.

```
// Pass 1 — list each pillar
for pillar in ["ekg/org", "ekg/rules", "ekg/assets", "ekg/workflows"]:
  sentura_agents_manage { action: "list", agentId: "<self>", relDir: pillar }
  // → { entries: [{ name: "vendors.json5", ... }, ...] }

// Pass 2 — read each .json5 entry
for entry in entries (filtered to *.json5):
  sentura_agents_manage { action: "read", agentId: "<self>", relPath: "<pillar>/<entry.name>" }
  // → { content: "<file body>", ... }
```

Aggregate the parsed JSON5 entities across all four pillars before continuing.

### Step 2: Identify Gaps

For each entity, check for missing or incomplete required fields (per `sentura/config/ekg-schema.json5`):

| Field condition | Gap type | Priority |
|-----------------|----------|----------|
| Required field is `null` or missing | Critical | High |
| Relation array empty when non-empty expected | Missing relation | Medium |
| `provenance.confidence` < 0.5 | Low-confidence entry | Medium |
| `provenance.source` missing | Unattributed entry | High |
| Entity has no relations to any other entity | Isolated entity | Low |

Collect gaps as: `{ entityId, pillar, field, gapType, priority }`.

### Step 3: Prioritise and Group

1. Sort by priority: High → Medium → Low.
2. Group related gaps on the same entity into one combined question.
3. Cap at **5 questions per cron run** — lower-priority gaps roll over to the next run.

### Step 4: Generate Clarifying Questions

For each gap group, compose a question with context:

```
I noticed a gap in my [pillar] knowledge:

Entity: <entity name> (<entityId>)
Missing: <field name or relationship>

Could you help me fill this in? Specifically:
"<specific question tailored to the entity and gap>"

This will help me <concrete benefit>.
```

Examples:
- "I have 'Sarah Chen' as AP Manager, but I'm missing her approval limit. What is the maximum invoice amount she can approve without escalation?"
- "My financial controls policy mentions a 3-way match requirement, but I'm missing the list of approved vendors it applies to."

### Step 5: Deliver Questions

| Trigger | Channel |
|---------|---------|
| Cron (automated) | `message` → Slack/Teams DM to `params.ekgManager` |
| Manual (operator in conversation) | Reply directly in current conversation |
| No channel available | Queue to `MEMORY.md` under `## Pending Q&A:` |

### Step 6: Record Pending Questions

After delivery, write a record to `MEMORY.md`:

```markdown
## Pending Q&A (2026-04-26):
- entityId: fin-001, field: approvalLimit, asked: 2026-04-26, status: pending
```

When answered, update `status: answered` and trigger Data Scavenger to merge the answer into the relevant EKG file.

### Step 7: Process Answers

When the operator provides an answer:
1. Match to the pending Q&A record.
2. Format as a new EKG attribute update.
3. Update via `sentura_agents_manage { action: "write" }` for simple field fills, or trigger Data Scavenger for complex ingestion.
4. Mark Q&A item as `answered` in `MEMORY.md`.
5. Confirm: "Thanks — I've updated my knowledge about [topic]."

## Tools Needed

- `sentura_agents_manage` — read EKG files, write `MEMORY.md` updates
- `message` — deliver questions to EKG Manager via Slack/Teams
- `cron` — schedule recurring gap-check runs
- `memory_search` — detect if a gap was asked recently (avoid re-asking)

## Safety

- **NEVER** fabricate answers to fill gaps — only use information explicitly provided by the operator.
- **NEVER** ask the same question twice within 7 days — check `MEMORY.md` pending records first.
- **NEVER** deliver more than 5 questions per cron run.
- **NEVER** expose T3/T4 data contents in question text — describe the gap without quoting sensitive data.
- **ALWAYS** record pending questions in `MEMORY.md` immediately after delivery.
- **ALWAYS** confirm with the operator when a gap is successfully filled.
