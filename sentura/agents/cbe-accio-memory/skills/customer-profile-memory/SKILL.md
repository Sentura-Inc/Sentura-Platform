# Customer Profile Memory

## When to Use

Use after deal summaries are produced and before any memory promotion.

## Procedure

1. Build a `memory_write_preview` for each conversation:
   - `memory_fact_id`
   - buyer company and country
   - contact person and role
   - product interest
   - quantity
   - negotiated price facts
   - next action
   - behavior summary
   - source file and conversation id
2. Keep the preview concise. Do not include raw message text.
3. Mark `status: "preview_only"` unless an approved memory-write path is available and the operator explicitly approves it.
4. Mention that `company_evidence_status` remains `needs_screening` until the Screening employee verifies the buyer.

## Safety

Never claim "memory written" for a preview. Never write raw chat content to `MEMORY.md` or vector memory.

