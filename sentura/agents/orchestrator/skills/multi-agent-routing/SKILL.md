# Multi-Agent Routing

## When to Use

After `task-decomposition` has produced a confirmed plan. This skill handles the execution mechanics: spawning sessions, routing messages, monitoring progress, and handling inter-agent data flow.

Also use standalone when the routing structure is already known (e.g. a recurring workflow).

## Procedure

### Step 1: Load the Execution Plan

Read the confirmed decomposition plan from context. Required fields:
- `steps[]` — ordered list of sub-tasks with `agentId`, `message`, `inputSource`
- `pattern` — `sequential` | `parallel` | `conditional`
- `dataClassification` — T0–T4 tier of data flowing through the workflow

### Step 2: Sequential Routing

For `pattern: "sequential"`:

```
for each step in steps:
  1. Construct seed message:
       "<sub-task instruction>\n\nContext from previous step:\n<prior output>"
  2. sessions_spawn({ agentId, message: seedMessage, context: { step, originRequest } })
  3. Await session completion (session_status: "complete" | "error")
  4. If "error" or Hard Rule refusal → halt, report to operator, stop workflow
  5. Capture output → pass as context to next step
```

### Step 3: Parallel Routing

For `pattern: "parallel"`:

```
1. Spawn all sessions simultaneously:
     for each step: sessions_spawn({ agentId, message, context })
     record { step, sessionKey }

2. Monitor all sessions concurrently:
     while any session is still running:
       on "complete": capture output, mark step done
       on "error" or refusal: capture error, mark step failed
         (do NOT halt other parallel sessions)

3. After all resolve: report partial failure if any failed; proceed to aggregation
```

### Step 4: Conditional Routing

For `pattern: "conditional"`:

```
1. Execute the condition-evaluation step (always sequential)
2. Read output to determine which branch to take
3. Spawn the appropriate next employee based on the condition result
4. Continue as sequential from the selected branch
```

### Step 5: Data Flow Between Sessions

When passing output from one session as input to another:

1. Check data-classification tier. For T3/T4 data:
   - Ask the operator for explicit permission before including in the next seed message.
   - If denied, substitute a sanitised summary.
2. Format context blocks clearly:
   ```
   --- Context from <employee name> (step <N>) ---
   <output text>
   --- End context ---
   ```
3. Never include credentials, tokens, or PII in inter-session messages.

### Step 6: Monitor and Handle Errors

| Condition | Action |
|-----------|--------|
| Session timeout | Report to operator; offer to retry once |
| Hard Rule refusal | Halt workflow; report verbatim — do not rephrase |
| Approval pending | Pause that branch; continue parallel branches; notify operator |
| Unexpected output format | Ask the producing employee to reformat; do not silently transform |
| agentId not in live config | Report missing employee; halt that sub-task |

### Step 7: Produce the Execution Report

```
Workflow complete: "<original request summary>"

Results:
  Step 1 — <employee name>: ✓ Complete
    Output: <summary>

  Step 2 — <employee name>: ✗ Failed (Hard Rule refusal)
    Reason: <verbatim refusal>

Final answer: <synthesised response>

Trace: <sessionKey list for audit>
```

## Tools Needed

- `sessions_spawn` — start sub-sessions with employee agents
- `sessions_send` — send follow-up messages to active sessions
- `gateway` — `config.get` (verify agentId is live before spawning)
- `message` — operator communication (progress, errors, final report)

## Safety

- **NEVER** re-route a refused sub-task to bypass a Hard Rule.
- **NEVER** auto-resolve a pending approval.
- **NEVER** pass T3/T4 data to another session without explicit operator approval.
- **NEVER** spawn an agent whose `id` is absent from the live config.
- **ALWAYS** include `originRequest` context in every spawned session (audit anchor).
- **ALWAYS** report Hard Rule refusals verbatim — do not soften or rephrase.
- **ALWAYS** produce a traceable execution report with session keys for every step.
