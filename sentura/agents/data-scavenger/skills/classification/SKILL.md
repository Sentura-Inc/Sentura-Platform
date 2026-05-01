# Skill: EKG Classification

## When to Use

Use this skill after the ingestion skill has successfully extracted raw text
and recorded the provenance object. This is the second stage of the ingestion
pipeline. Do not begin classification without a complete provenance object
from the ingestion stage.

Triggers:
- Ingestion skill passes extracted text + provenance to this skill.

## Procedure

1. **Read the target agent's existing EKG directory structure.**
   Use `sentura_agents_manage` to read the target agent's current EKG state
   so classifications can be informed by what already exists:
   ```
   // List each pillar (read takes a file, list takes a directory).
   sentura_agents_manage({ action: "list", agentId: "<targetAgentId>", relDir: "ekg/org" })
   sentura_agents_manage({ action: "list", agentId: "<targetAgentId>", relDir: "ekg/rules" })
   sentura_agents_manage({ action: "list", agentId: "<targetAgentId>", relDir: "ekg/assets" })
   sentura_agents_manage({ action: "list", agentId: "<targetAgentId>", relDir: "ekg/workflows" })
   // Then read each *.json5 entry returned:
   //   sentura_agents_manage({ action: "read", agentId, relPath: "ekg/<pillar>/<entry.name>" })
   ```
   If the target agent has an `ekg/ekg-schema.json5`, read it as the
   authoritative schema reference for that agent's EKG.

2. **Analyse the extracted text against the 4-pillar schema.**
   Read the full extracted text before making any classification decisions.
   Identify all discrete entities, relationships, policies, and procedures
   present in the document.

3. **Classify each entity into the correct pillar.**
   Apply the classification guidelines from BOOTSTRAP.md:
   - `org`: people, departments, roles, reporting relationships
   - `rules`: policies, compliance requirements, approval chains, SLAs
   - `assets`: systems, tools, data sources, templates, credential references
   - `workflows`: procedures, SOPs, process steps, experience links

   For each entity, produce a classification record:
   ```json5
   {
     id: "<pillar>:<slug>",
     type: "<entity-type>",
     name: "<human-readable name>",
     pillar: "<org|rules|assets|workflows>",
     confidence: 0.0,
     attributes: {
       description: "<one-sentence summary from source text>",
       // additional attributes extracted verbatim or closely paraphrased
     },
     relations: [],
     provenance: {
       source: "<from ingestion>",
       ingestedAt: "<from ingestion>",
       format: "<from ingestion>",
       targetAgentId: "<from ingestion>",
       confidence: 0.0,
     },
   }
   ```

4. **Assign confidence scores (0.0-1.0) per classified entity.**
   Score based on:
   - How explicitly the entity is named in the source text (explicit = higher)
   - How clearly it maps to a single pillar (clear = higher)
   - Whether extraction was from OCR or image (apply 0.8 ceiling if so)
   - Whether the entity type is ambiguous across pillars (ambiguous = lower)

5. **Flag low-confidence items for human review.**
   For any entity with `confidence < 0.6`:
   - Set `attributes.reviewRequired: true`
   - Add `attributes.classificationNote` explaining the ambiguity
   - Do NOT exclude these from the output — pass them to the structuring
     skill with the flag set; the structuring skill will segregate them
   - Report the count of flagged items to the user before proceeding

6. **Pass labelled entities to the structuring skill.**
   Hand off the full list of classified entity records (including flagged
   items) plus the original provenance object to the structuring skill.

## Tools Needed

- `sentura_agents_manage` (action: `"read"`) — read target agent's existing
  EKG directory and schema file
- `read` — read `ekg-schema.json5` if accessible as a local workspace file

## Safety

- NEVER invent entities not explicitly present or clearly implied in the
  source document. General industry knowledge is not a valid source.
- NEVER assign an entity to a pillar based on assumption — if the pillar
  is genuinely ambiguous, flag it with `confidence < 0.6` and a
  `classificationNote`.
- NEVER strip the provenance object received from the ingestion skill.
  Carry it forward to every entity produced.
- NEVER begin writing to the EKG in this skill — classification only
  produces labelled records. All writes happen in the ekg-merge skill.
- If `sentura_agents_manage` read fails for a pillar directory, note the
  failure and continue classification without that context — do not abort
  the pipeline.
