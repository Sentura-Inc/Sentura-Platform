# Personal Memory Management (Per-User Isolation)

## When to Use

Applies to **every session** with a bound user token. The sentura-bootstrap
hook already injects the user's `MEMORY_USER_{token}.md` file at session
start — this skill defines how the agent reads from, writes to, and promotes
across the dual-memory system at runtime.

Two memory scopes exist simultaneously:

| File | Scope | Who sees it |
|------|-------|-------------|
| `MEMORY.md` (workspace root) | General — shared by all users of this employee | Every session |
| `memory/users/MEMORY_USER_{token}.md` | Personal — one file per user token | Only that user's sessions |

## Procedure

### Step 1: Identify Active Memory Scopes

At session start the bootstrap hook has already injected both files into the
system prompt. Confirm scopes by checking context:

- **General scope** is always active.
- **Personal scope** is active when `sessionKey` matches `agent:<id>:user:<token>:*`.
  If no user token is present (e.g. anonymous or system session) only the general
  scope is active — do not create a personal file for anonymous callers.

### Step 2: Read-Priority Rule

When answering questions about a specific user's history, preferences, or
past interactions, **prefer the personal file** over general MEMORY.md.
When answering questions about the team/org/process or general patterns,
use general MEMORY.md.

If a conflict exists between the two (e.g. user's personal preference
contradicts general policy stored in MEMORY.md), honour the general policy
but acknowledge the user's preference in the reply.

### Step 3: Write — Personal Memories

After completing a task, determine if a personal memory should be recorded:

**Write to `memory/users/MEMORY_USER_{token}.md` when:**
- User expresses a preference specific to themselves (tone, format, language)
- User supplies personal context (their role, timezone, recurring tasks)
- A past interaction produced an outcome the user reacted to positively or negatively
- User explicitly asks the agent to remember something for them personally

**Do NOT write personal memories when:**
- The information is organisational (policies, product facts, team structures)
- The insight is reusable across many users (→ candidate for general MEMORY.md)
- The data contains T3/T4 credentials, PII beyond first name, or health/financial data

Format for personal memory entries:

```markdown
## {YYYY-MM-DD} — {one-line topic}
- {fact or preference}
- {fact or preference}
```

Write via:
```
sentura_agents_manage {
  action: "write",
  agentId: "<self>",
  relPath: "memory/users/MEMORY_USER_{token}.md",
  content: "<full updated file>",
}
```

Always read the existing file first, append the new section, and write the
entire file back (immutable pattern — replace, never patch in-place).

### Step 4: Write — General Memories

Write to workspace-root `MEMORY.md` only when the insight is genuinely
cross-user and contains no personal data:

**Good candidates:** recurring workflow patterns, known system quirks,
common misconceptions among multiple users, updated policy facts.

**Privacy gate (CRITICAL):** Before writing to general MEMORY.md, strip
all user-identifying information. Replace names/tokens with role labels
(e.g. "an AP Clerk user" not "Sarah Chen"). If stripping would make the
pattern meaningless, keep it in the personal file only.

### Step 5: Dreaming — Promotion Logic

Dreaming runs on a cron schedule (typically nightly). During each dreaming
cycle the agent examines personal memories for cross-user patterns worth
promoting to general MEMORY.md.

#### 5a. Cross-User Pattern Promotion (Personal → General)

Scan all `memory/users/MEMORY_USER_*.md` files for recurring themes:

```
for each personal memory section:
  if the same insight appears in ≥ 3 distinct user files:
    and the insight contains no PII after stripping:
      candidate for promotion to general MEMORY.md
```

Promotion steps:
1. Draft the generalised entry (strip names/tokens, use role labels).
2. Show draft to operator for approval before writing:
   ```
   Promotion candidate:
   Pattern observed across 3+ users: "<generalised insight>"
   Source files: [MEMORY_USER_abc.md, MEMORY_USER_xyz.md, ...]
   Write to general MEMORY.md? (yes / no)
   ```
3. On approval, append to `MEMORY.md` under a `## Promoted Patterns` heading.
4. Do NOT delete the personal entries — they remain as the audit source.

#### 5b. Personal Memory Consolidation (Personal → Condensed Personal)

If a user's personal file exceeds 150 lines, condense older entries:
1. Read the full file.
2. Merge entries older than 30 days with the same topic into a single
   summary line: `{topic}: {latest value} (updated {YYYY-MM-DD})`.
3. Write the condensed file back.
4. Never delete the most recent entry for any topic.

#### 5c. Stale Entry Pruning

Mark entries as stale (do not delete) when:
- An entry is older than 90 days AND the user has had a more recent session
  that would have overwritten it if still relevant.
- Mark with: `<!-- stale: {YYYY-MM-DD} -->` inline.

### Step 6: Privacy Boundary Enforcement

| Data type | Personal file | General MEMORY.md |
|-----------|--------------|-------------------|
| User first name / preferred name | Allowed | Never |
| User role / department | Allowed | Role label only |
| User-specific preferences | Allowed | Never |
| Workflow pattern (no identity) | Allowed | Allowed |
| Email / phone / PII | Never | Never |
| T3/T4 credentials | Never | Never |
| Health / financial personal data | Never | Never |

If an existing entry in MEMORY.md is discovered to contain PII, redact it
immediately and notify the operator.

## Tools Needed

- `sentura_agents_manage` — read and write `memory/users/MEMORY_USER_*.md` and `MEMORY.md`
- `memory_search` — search existing personal and general memories before writing duplicates
- `message` — operator approval for cross-user promotion
- `cron` — schedule nightly dreaming cycle

## Safety

- **NEVER** write PII, T3/T4 data, or user-identifying details to general `MEMORY.md`.
- **NEVER** share one user's personal memory with another user — the bootstrap hook enforces this at the file-injection level, but the agent must not cross-reference user files within a session.
- **NEVER** create a `MEMORY_USER_*.md` file for anonymous or system sessions (no user token in session key).
- **NEVER** promote personal memories to general MEMORY.md without operator approval.
- **ALWAYS** read the existing file before writing — append new sections; never overwrite prior entries.
- **ALWAYS** strip user identity from any pattern before proposing promotion.
- **ALWAYS** preserve stale entries with a `<!-- stale -->` marker rather than deleting.
