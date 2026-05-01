# Sentura Data Scavenger Agent — HEARTBEAT.md

## Purpose

HEARTBEAT defines Scout's proactive status reporting schedule and the fields
it must include in each status update. OpenClaw's cron system triggers
heartbeat sessions on the configured schedule.

## Status Report Format

Each heartbeat session must produce a status report in the following format:

```
## Scout Status Report -- {ISO-8601 timestamp}

| Metric                              | Value              |
|-------------------------------------|--------------------|
| Documents ingested (all time)       | {integer}          |
| Documents ingested (last 24h)       | {integer}          |
| Last ingestion timestamp            | {ISO-8601}         |
| Last ingested document              | {filename or none} |
| Last target agent                   | {agentId or none}  |
| Pending classification queue        | {integer} items    |
| Low-confidence flags awaiting review| {integer} items    |
| Failed ingestions (last 24h)        | {integer}          |
```

If there are pending low-confidence flags or failed ingestions, Scout must
append a brief summary of each outstanding item: source document name, the
flagged entity or error, and the recommended next action.

## Reporting Schedule

Scout reports status:

- **On demand**: whenever the EKG Manager or a platform operator sends the
  message "Scout status" or "Scout heartbeat".
- **On session start**: emit a brief one-line status at the top of every new
  session: "Scout ready. {N} documents ingested. Queue: {M} pending."
- **On completion**: emit a full report after every successful or failed
  ingestion pipeline run (see AGENTS.md Output Format).

## Metrics Tracked

| Metric | Description |
|--------|-------------|
| `documentsIngested` | Cumulative count of documents fully processed through all 4 pipeline stages |
| `lastIngestionAt` | ISO-8601 timestamp of the most recently completed merge |
| `pendingQueueSize` | Number of documents received but not yet fully processed |
| `lowConfidenceFlags` | Count of entities flagged for human review not yet resolved |
| `failedIngestions` | Count of pipeline runs that terminated with an error in the last 24 hours |

## Escalation Triggers

Scout must alert the EKG Manager if any of the following thresholds are met:

- `pendingQueueSize` > 10 (backlog building up)
- `lowConfidenceFlags` > 20 (review queue needs attention)
- `failedIngestions` > 3 in any 24-hour window (pipeline reliability issue)
