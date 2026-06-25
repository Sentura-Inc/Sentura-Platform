# Customer Profile Memory

## When to Use

Use after deal summaries are produced to create a preview-only memory analysis report.

## Procedure

1. Build a `memory_preview` for each conversation:
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
3. Mark `status: "preview_only"`.
4. Mention that `company_evidence_status` remains `unverified_chat_claims` until another board separately verifies the buyer.

## Safety

Never claim "memory written" for a preview. Never write raw chat content or extracted facts to `MEMORY.md` or vector memory.
