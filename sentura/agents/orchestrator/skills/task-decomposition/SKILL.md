# Task Decomposition

## When to Use

When an operator submits a complex request requiring multiple AI employees to collaborate. Use this skill to determine:

- Which employees are needed
- What each employee should do
- In what order (sequential, parallel, or conditional)
- What data flows between them

Do NOT use for single-employee tasks — route those directly without decomposition.

## Procedure

### Step 1: Understand the Request

Extract from the operator's message:
- **Goal**: the end state to achieve
- **Domain(s)**: which business areas are touched (finance, support, sales, HR, etc.)
- **Constraints**: deadlines, data-classification tiers, approval requirements
- **Success criteria**: how to know when the task is complete

If the request is ambiguous, ask one focused clarifying question before proceeding.

### Step 2: Discover Available Employees

```
gateway.call("config.get", {})
```

For each entry in `agents.list[]`, record:
- `id`, `name`
- `params.role` — the employee's stated function
- `params.capabilities` — skills the employee declares
- `mcp.servers` — enterprise systems they can reach

Build a capability map: `{ employeeId → [skills/capabilities] }`.

### Step 3: Match Sub-tasks to Employees

Break the goal into atomic sub-tasks. For each:
1. Identify the required capability.
2. Find the employee with that capability (prefer most specific match).
3. If no employee matches, report the gap to the operator before continuing.

### Step 4: Choose an Orchestration Pattern

| Pattern | When to Use | Example |
|---------|------------|---------|
| **Sequential** | Output of A is input to B | Research → Draft → Review |
| **Parallel** | Tasks are independent | Fetch Zendesk + Fetch Salesforce simultaneously |
| **Conditional** | Next step depends on result | HIGH priority → escalate; else → auto-resolve |
| **Fan-out/gather** | Same task to multiple employees, results merged | Weekly status from 3 agents |

Prefer parallel when tasks are independent — reduces wall-clock time.

### Step 5: Produce a Decomposition Plan

Present the plan before executing:

```
Decomposition plan for: "<request summary>"

Employees needed:
  - <name> (<id>): <what they will do>

Execution order: Sequential | Parallel | Conditional

Step 1 → <employee>: <sub-task>
  Input: <data source>
  Expected output: <what is returned>

Step 2 → <employee>: <sub-task>
  Input: <output from Step 1>
  Expected output: <what is returned>

Data classification: <T0–T4 tier>
Approval requirements: <any steps needing human approval>

Proceed? (yes / no / modify)
```

Wait for operator confirmation before executing.

### Step 6: Execute the Plan

For each step:

1. Spawn a session with the target employee:
   ```
   sessions_spawn({
     agentId: "<employeeId>",
     message: "<sub-task instruction with context>",
     context: { originRequest: "<original request>", step: <N> },
   })
   ```
2. Wait for session completion (monitor `session_status` events).
3. Capture the output.
4. If the employee refuses due to a Hard Rule, halt and report the conflict to the operator. Do NOT re-route to a different employee to bypass the refusal.
5. Pass output as input to the next step.

### Step 7: Aggregate and Report

1. Collect outputs from all employee sessions.
2. Synthesise a coherent summary for the operator.
3. Include a traceable step log: which employee handled each sub-task, what they produced, any errors or refusals.
4. Flag incomplete sub-tasks with the reason.

## Tools Needed

- `gateway` — `config.get` (employee discovery)
- `sessions_spawn` — spawn sub-sessions with target employees
- `sessions_send` — send follow-up messages to active sub-sessions
- `message` — operator interaction (plan confirmation, progress, final report)

## Safety

- **NEVER** bypass an employee's `## Hard Rules`. If they refuse, report — do not find a workaround.
- **NEVER** auto-approve a sub-session's pending approval. Wait for the human.
- **NEVER** spawn an employee not present in the live config.
- **NEVER** share T3/T4-classified data across sessions without explicit operator permission.
- **ALWAYS** present the decomposition plan before executing.
- **ALWAYS** include originating request context in every spawned session seed message.
- **ALWAYS** produce a traceable step log attributing every result to a specific employee session.
