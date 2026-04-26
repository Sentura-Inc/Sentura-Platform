# Experience Link Extraction (Tier 3 Learning)

## When to Use

Triggered as a **post-task hook** after completing a significant task. Evaluates the completed work for reusable patterns that benefit future task execution. Part of Capability #13 (Tier 3: autonomous experience accumulation).

Trigger conditions:
- A task required more than 3 tool calls to complete
- A novel approach was used to solve a problem
- An obstacle was encountered and overcome
- A workflow produced an unusually good or unusually poor outcome

Skip for simple single-step tasks (answering a direct factual question, reading a file, etc.).

## Procedure

### Step 1: Reflect on the Completed Task

At the end of a task, review the conversation and tool-call sequence:

1. **What pattern emerged?** Is there a repeatable sequence that solved a class of problem?
2. **What was novel?** Did this require an approach not in any existing SKILL.md?
3. **What obstacle was overcome?** If something failed initially, what was the fix?
4. **What would help next time?** What pre-fetched context or tool sequence would make this faster?

If all four answers are "nothing interesting", skip — do not force extraction.

### Step 2: Formulate a Candidate Experience Link

```json5
{
  id: "exp-<agentId>-<YYYYMMDD>-<N>",
  pattern: "<short description of the triggering situation — the 'when'>",
  observation: "<the reusable insight or approach that worked>",
  confidence: 0.4,                      // initial; increases with occurrences
  occurrences: 1,
  firstSeen: "2026-04-26T00:00:00Z",    // ISO-8601
  lastSeen: "2026-04-26T00:00:00Z",     // ISO-8601
  context: "<one-sentence description of the specific task instance>",
  source: "autonomous_extraction",
}
```

Initial confidence guidelines:
- 0.3–0.4: single observation, uncertain generalisation
- 0.5–0.6: pattern is clear but seen only once
- 0.7+: do not assign on first extraction — this is the promotion threshold, not a starting value

### Step 3: Check for Existing Similar Links

Before creating a new link, search for duplicates:

```
memory_search({ query: "<pattern text>", limit: 5 })
```

Also scan `ekg/workflows/experience-links/*.json5` for entries with similar `pattern` fields.

**If a similar link exists:**
- Increment `occurrences`
- Update `lastSeen` to now (ISO-8601)
- Recalculate confidence: `min(0.9, existing.confidence + 0.1 * sqrt(occurrences))`
- Write the updated entry back via `sentura_agents_manage { action: "write" }`
- Do NOT create a duplicate

**If no similar link exists:** proceed to Step 4.

### Step 4: Write the Candidate Link

```
sentura_agents_manage {
  action: "write",
  agentId: "<self>",
  relPath: "ekg/workflows/experience-links/<id>.json5",
  content: "<JSON5 content>",
}
```

### Step 5: Check Promotion Threshold

After writing or updating, evaluate for SKILL.md promotion:

| Condition | Action |
|-----------|--------|
| `confidence >= 0.75` AND `occurrences >= 3` | Notify operator — offer to draft a SKILL.md |
| `confidence >= 0.9` | Draft SKILL.md and show to operator for review before writing |
| Neither | Leave in `experience-links/`; re-evaluate on next occurrence |

Promotion notification format:
```
I've noticed a repeatable pattern that might be worth formalising as a skill:

Pattern: "<pattern>"
Observed: <N> times (confidence: <score>)
Observation: "<observation>"

Should I draft this as a formal SKILL.md? (yes / no / not yet)
```

### Step 6: Prune Stale Links

During any extraction run, also check for stale entries:
- `confidence < 0.3` AND `lastSeen` > 30 days ago AND `occurrences === 1` → add `status: "stale"` field (do not delete — audit trail preserved)

## Tools Needed

- `sentura_agents_manage` — read and write `ekg/workflows/experience-links/*.json5`
- `memory_search` — find similar existing patterns before creating new links
- `message` — notify operator when a link reaches promotion threshold

## Safety

- **NEVER** assign initial confidence above 0.6 — promotion requires repeated observation.
- **NEVER** fabricate `occurrences` or backdate `firstSeen` timestamps.
- **NEVER** auto-promote to SKILL.md without operator review.
- **NEVER** include specific user data or PII in `pattern`, `observation`, or `context` — describe patterns at the class level.
- **ALWAYS** check for duplicates before creating a new link.
- **ALWAYS** preserve stale links with `status: "stale"` rather than deleting.
- **ALWAYS** use ISO-8601 (`YYYY-MM-DDTHH:mm:ssZ`) for all timestamps.
