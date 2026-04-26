# Skill: EKG Structuring

## When to Use

Use this skill after the classification skill has produced a list of labelled
entity records with confidence scores. This is the third stage of the
ingestion pipeline. Do not begin structuring without receiving the full
classified entity list from the classification skill.

Triggers:
- Classification skill passes labelled entity records to this skill.

## Procedure

1. **Convert classified entities to JSON5 format per ekg-schema.json5.**
   For each classified entity record, produce a fully-formed JSON5 object
   conforming to the EKG entity schema defined in BOOTSTRAP.md:
   ```json5
   {
     id: "<pillar>:<slug>",
     type: "<entity-type>",
     name: "<human-readable name>",
     attributes: {
       description: "<one-sentence summary>",
       // preserve all additional attributes from classification
     },
     relations: [
       // { targetId: "<pillar>:<slug>", relation: "<relation-type>" }
     ],
     provenance: {
       source: "<filename or URL>",
       ingestedAt: "<ISO-8601>",
       format: "<pdf|docx|xlsx|image|html|text>",
       targetAgentId: "<agent-id>",
       confidence: 0.0,
     },
   }
   ```
   Preserve all fields from the classification record. Never drop
   `attributes.reviewRequired` or `attributes.classificationNote` from
   flagged entities.

2. **Group entities by pillar.**
   Sort the structured entity objects into four arrays:
   - `orgEntities[]` -- all entities with `pillar: "org"`
   - `rulesEntities[]` -- all entities with `pillar: "rules"`
   - `assetsEntities[]` -- all entities with `pillar: "assets"`
   - `workflowsEntities[]` -- all entities with `pillar: "workflows"`

3. **Deduplicate using memory_search and exact id match.**
   For each entity, check whether it already exists in the target agent's EKG:

   a. **Exact id match** (primary check): search Scout's memory for an entity
      with the same `id` field using `memory_search`. If similarity >= 0.9:
      mark as "deduplicated", exclude from the structured payload, log it.

   b. **Semantic similarity check** (secondary, for near-matches): search on
      `entity.name + " " + entity.type`.
      - Similarity 0.7-0.89: flag as possible duplicate, add
        `attributes.deduplicationNote`, keep in payload but mark for review.
      - Similarity < 0.7: treat as new entity, include normally.

   c. **Ground-truth check** for near-matches: use
      `sentura_agents_manage { action: "read" }` on the relevant pillar file
      to confirm. If confirmed duplicate, exclude; if distinct, include.

4. **Produce the structured payload.**
   Assemble the final output:
   ```json5
   {
     orgEntities: [...],
     rulesEntities: [...],
     assetsEntities: [...],
     workflowsEntities: [...],
   }
   ```
   Include: all new entities, all flagged low-confidence entities
   (`reviewRequired: true`), all possible-duplicate entities
   (`deduplicationNote`). Exclude: confirmed exact duplicates only.

5. **Report deduplication summary to the user.**
   Before passing to the ekg-merge skill, report:
   - Total entities structured
   - Deduplicated (excluded)
   - Possible duplicates flagged for review
   - Low-confidence flagged for review

6. **Pass structured payload to the ekg-merge skill.**

## Tools Needed

- `read` -- read `ekg-schema.json5` if accessible as a local workspace file
- `memory_search` -- fast pre-filter for deduplication against Scout's memory
- `memory_get` -- retrieve full prior entity record for detailed comparison
- `sentura_agents_manage` (action: `"read"`) -- ground-truth dedup check
  against live EKG pillar files for near-matches

## Safety

- NEVER strip provenance fields from any entity during structuring. All five
  provenance fields (`source`, `ingestedAt`, `format`, `targetAgentId`,
  `confidence`) must be present on every output entity.
- NEVER remove `attributes.reviewRequired` or `attributes.classificationNote`
  from flagged entities -- these flags must survive into the merge step.
- NEVER exclude an entity unless it is a confirmed exact duplicate (similarity
  >= 0.9 AND ground-truth read confirms same id).
- NEVER begin writing to the EKG in this skill -- all writes happen in the
  ekg-merge skill.
- Preserve source attribution through every transformation. Restructuring
  the object shape must not alter provenance field values.
