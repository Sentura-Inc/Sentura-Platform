# Status Update

## When to Use

- Scheduled cron (daily/weekly) from HEARTBEAT.md.
- User asks "give me a status update" or "what's the state of X".
- Incident or milestone checkpoint.

## Procedure

1. **Identify the update type**:
   - **Daily standup**: yesterday / today / blockers
   - **Weekly**: wins / misses / focus for next week / asks
   - **Incident**: current state / impact / mitigation / ETA
   - **Project**: milestones / risks / budget

2. **Gather data from authoritative sources**:
   - Project tool: `{project_mcp}` (Linear, Jira, Asana, Shortcut).
   - Tickets: `{ticketing_mcp}` (Zendesk, Intercom).
   - Metrics: `{analytics_mcp}` (observability, product analytics).
   - Prior update: read from MEMORY.md or the channel history.

3. **Apply the template for the update type**:

   **Daily standup**:
   ```
   ## Daily Update — {YYYY-MM-DD}

   **Yesterday**
   - Done: {...}

   **Today**
   - Plan: {...}

   **Blockers**
   - {blocker} — need {what} from {whom}
   ```

   **Weekly**:
   ```
   ## Weekly Update — Week of {YYYY-MM-DD}

   ### Wins
   - {shipped/achieved}

   ### Misses
   - {missed commitment} — {why} — {recovery plan}

   ### Next Week Focus
   - {top 3 items}

   ### Asks / Dependencies
   - {what we need from stakeholders}

   ### Metrics
   - {KPI}: {current} (vs {prior} — {trend arrow})
   ```

   **Incident**:
   ```
   ## Incident — {incident-id}

   **Status**: {active / mitigated / resolved}
   **Severity**: {SEV1 / SEV2 / SEV3}
   **Start**: {YYYY-MM-DD HH:MM UTC}
   **Impact**: {what's broken, for whom, how much}
   **Mitigation in progress**: {steps}
   **ETA to resolution**: {time or "unknown"}
   **Next update**: {+30 min / +1 hr / ...}
   ```

4. **Honesty standards**:
   - NEVER hide misses. Report them clearly with recovery plan.
   - Use specific numbers, not adjectives ("ARR +$12k" not "good growth").
   - Cite sources for every metric.

5. **Post to destination**:
   - Slack channel: use `slack.chat.post_message`. Pin weekly/incident updates.
   - Email: format for email readability (shorter paragraphs, no markdown that renders poorly).
   - Doc (Notion/Confluence): create/update the status page.

6. **Archive** to MEMORY.md so next update can compare.

## Tools Needed

- `mcp.{project_mcp}` — tickets, milestones
- `mcp.{ticketing_mcp}` — support volume
- `mcp.{analytics_mcp}` — metrics
- `slack` / `email` / `notion` — post
- `fs_read` — prior updates
- `fs_write` — archive to MEMORY.md

## Safety

- NEVER fabricate metrics — mark unavailable data as "data not available" rather than guessing
- NEVER misrepresent project status to make the team look better
- NEVER omit blockers just because they're uncomfortable (blockers are the point of a standup)
- NEVER post updates containing T3/T4 data to channels where unauthorized people can read
- ALWAYS cite sources for metrics (tool + query/timestamp)
- ALWAYS include the update timestamp and cadence (e.g., "next update in 1 hour")
- ALWAYS escalate to {escalation_target} if the status contains customer-impacting issues not yet triaged
