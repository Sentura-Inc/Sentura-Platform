# Skill: EKG Merge

## When to Use

Use this skill after the structuring skill has produced a validated JSON5
payload with entities grouped by pillar. This is the fourth and final stage
of the ingestion pipeline. Do not begin merging without a complete structured
payload from the structuring skill.

Triggers:
- Structuring skill passes the structured payload to this skill.

## Procedure

1. **For each pillar, read then additively merge then write.**
   Process pillars in this order: `org`, `rules`, `assets`, `workflows`.
   Complete all three sub-steps for one pillar before moving to the next.

   For each pillar that has new entities in the structured payload:

   a. **Read the existing pillar file** from the target agent's EKG:
      ```
      sentura_agents_manage({
        action: "read",
        agentId: "<targetAgentId>",
        relPath: "ekg/<pillar>/<filename>.json5",
      })
      ```
      If the file does not exist yet, start with an empty entities array.
      This is the only valid case for creating a new pillar file.

   b. **Merge new entities ADDITIVELY into the existing array.**
      Append the new entities from the structured payload to the existing
      entities array. Existing entries are never modified, reordered, or
      deleted. The merged file contains ALL prior entities followed by ALL
      new entities appended after them.

      Do not merge entities flagged with `attributes.reviewRequired: true`
      without EKG Manager approval. Hold them in Scout's memory and report
      them separately to the user after the merge completes.

   c. **Write the merged file back** to the target agent's EKG:
      ```
      sentura_agents_manage({
        action: "write",
        agentId: "<targetAgentId>",
        relPath: "ekg/<pillar>/<filename>.json5",
        content: "<JSON5 string of merged entities array>",
      })
      ```
      If the write fails, log the error verbatim, stop the pipeline, and
      report the failure to the user. Do NOT proceed to the next pillar
      after a write failure.

2. **After all pillars are successfully merged, notify the target agent.**
   Send a message to the target agent's active session:
   ```
   "Your knowledge base was updated. {N} new entities added across {X} pillars."
   ```
   Where N is the total count of entities written (excluding held
   review-required entities) and X is the count of pillars that received
   at least one new entity.

   Only send this notification after ALL pillar writes have been confirmed
   successful. Never notify on partial completion.

3. **Log the merge event.**
   Record the merge event in Scout's memory:
   ```json5
   {
     event: "ekg_merge",
     targetAgentId: "<agent-id>",
     pillars: ["<pillar-1>", "<pillar-2>"],
     entitiesAdded: 0,
     timestamp: "<ISO-8601>",
   }
   ```

4. **Report completion to the requesting user.**
   Emit the full completion report (see AGENTS.md Output Format):
   - Source document name
   - Target agent ID
   - Entities added per pillar
   - Entities held pending review (low-confidence or flagged)
   - Timestamp

## Tools Needed

- `sentura_agents_manage` (action: `"read"`) -- read existing EKG pillar files
  before each merge
- `sentura_agents_manage` (action: `"write"`) -- write merged pillar files back
- `message` / `sessions_send` -- notify the target agent after successful merge

## Safety

- ADDITIVE ONLY. NEVER delete, overwrite, or modify existing EKG entries.
  The merged file must contain every entity that existed before the merge,
  with new entities appended after. Never pass a content payload that contains
  only the new entities.
- NEVER send the target agent a knowledge-update notification before ALL
  pillar writes are confirmed successful.
- NEVER merge `reviewRequired: true` entities without EKG Manager approval.
  Hold them in memory, report them to the user as pending review.
- NEVER proceed to the next pillar after a write failure. Stop, report the
  error verbatim, and wait for user instruction.
- NEVER use destructive merge semantics. Always read first, append new
  entities, then write the full combined result.
- If the target agent has no active session to receive the notification,
  log the notification attempt and continue -- do not fail the pipeline
  because the target agent is offline.
