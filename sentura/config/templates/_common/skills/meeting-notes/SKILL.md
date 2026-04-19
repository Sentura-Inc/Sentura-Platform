# Meeting Notes

## When to Use

- A transcript or recording URL is provided by the user.
- User asks "summarize this meeting" or "extract action items".
- Scheduled cron post-meeting (if configured in HEARTBEAT.md).

## Procedure

1. **Acquire the source**:
   - If audio/video URL: use `mcp.{transcription_provider}` (e.g., `assemblyai`, `deepgram`) to transcribe.
   - If text file: read via `fs_read`.
   - If pasted text: use as-is.

2. **Identify attendees and speakers**:
   - Parse speaker labels from the transcript.
   - Map to real names if a calendar invite or attendee list is available.

3. **Structure the summary** using this format:

   ```
   # {Meeting Title} — {Date}

   **Attendees**: {names}
   **Duration**: {HH:MM}

   ## Summary (3-5 bullets)
   - ...

   ## Decisions
   - {decision}: decided by {person(s)}

   ## Action Items
   | Owner | Action | Due |
   |-------|--------|-----|
   | {person} | {action} | {YYYY-MM-DD or "TBD"} |

   ## Open Questions
   - ...

   ## Follow-ups for {Company}
   - {next-steps}
   ```

4. **Extract action items** with owner and due date. If owner is ambiguous, list the candidate names and flag for confirmation. If due date is ambiguous, default to 7 days out and note the assumption.

5. **Post to destination**:
   - Slack channel: use `slack` channel with `chat.post_message`.
   - Email: use `smtp` or `gmail` tool.
   - Notion/Confluence: use the relevant MCP server.
   - Default: reply in the current session.

6. **Archive the raw transcript** to the meeting-notes subdirectory of the agent's memory for later retrieval (searchable via vector memory).

## Tools Needed

- `fs_read` — load transcript files
- `mcp.{transcription_provider}` — optional, for audio/video
- `slack` / `smtp` / `gmail` — post summary
- `memory_store` — archive the transcript for future reference

## Safety

- NEVER fabricate action items or decisions that weren't in the transcript
- NEVER misattribute quotes — if a speaker is unclear, flag with "[unclear]"
- NEVER forward meeting content to anyone outside the attendee list without explicit authorization
- ALWAYS preserve sensitive information handling: if the meeting contains PII, HIPAA, or financial data, use the T-tier data classification from `BOOTSTRAP.md § Enterprise Context`
- ALWAYS link back to the source transcript or recording URL in the summary footer
- ALWAYS escalate to {escalation_target} if the meeting mentions litigation, termination, or legal/HR-sensitive topics
