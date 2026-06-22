# EKG → SKILL.md Synthesis

## When to Use

After the Data Scavenger Agent ingests a document and merges new entries into a target agent's `ekg/workflows/*.json5`, the Knowledge Curator runs this skill to generate (or update) corresponding `SKILL.md` files in the target agent's `skills/` directory.

This closes the EKG pipeline: unstructured doc → Scavenger → structured JSON5 → this skill → executable agent skill.

Trigger conditions:
- Scavenger emits a `pipeline-complete` notification listing `pillars: ["workflows", ...]` and `entitiesAdded > 0` for the workflows pillar.
- An operator explicitly requests "Curate skills for `<agent-id>` from new EKG entries".

If only `org/`, `rules/`, or `assets/` were updated (not `workflows/`), do NOT generate skills — those pillars feed `BOOTSTRAP.md` Enterprise Context, not `skills/`.

## Inputs

For each new workflow entity:

```json5
{
  id: "wf-vendor-onboarding-001",
  type: "workflow",
  name: "Vendor Onboarding",
  attributes: {
    steps: [
      "Collect W-9 from vendor",
      "Verify vendor against sanctions list",
      "Create vendor record in ERP",
      "Set initial payment terms",
    ],
    inputs: ["vendor-name", "tax-id", "contact-email"],
    outputs: ["vendor-id", "approval-status"],
    owner: "ap-clerk",
    frequency: "as-needed",
    approvalsRequired: ["new-vendor-onboarding"],
  },
  relations: [
    { kind: "depends-on", target: "rule-vendor-sanctions-001" },
    { kind: "writes-to", target: "asset-erp-vendor-table" },
  ],
  provenance: {
    source: "vendor-onboarding-policy-2026-q1.pdf",
    ingestedAt: "2026-04-30T14:22:00.000Z",
    format: "pdf",
    targetAgentId: "ap-clerk",
    confidence: 0.86,
  },
}
```

Read the workflow entity via:

```
sentura_agents_manage { action: "read", agentId: "<targetAgentId>", relPath: "ekg/workflows/<file>.json5" }
```

## Procedure

### Step 1: Filter

Discard any entity with:
- `provenance.confidence < 0.7` (under the routing floor — wait for Q&A Completion to fill the gap)
- `attributes.steps` empty or fewer than 2 items (too thin to make a skill)
- `attributes.owner !== <targetAgentId>` (workflow belongs to a different agent — log and skip)

### Step 2: Map workflow → SKILL.md

The output filename is `skills/<kebab(name)>/SKILL.md`. If a SKILL.md already exists at that path, this is an UPDATE (Step 5 reconciles); otherwise it is a CREATE.

Construct the SKILL.md content from the entity:

| SKILL.md section | Source field | Notes |
|------------------|--------------|-------|
| Title (`# {name}`) | `attributes.name` | Title case |
| `## When to Use` | Derived from `attributes.inputs` + entity name | One sentence: "Invoke when {agent} receives {first input}" |
| `## Procedure` | `attributes.steps[]` | Numbered list 1..N |
| `## Tools Needed` | Inferred from `relations` (writes-to → MCP server tool, depends-on → memory_search lookup) + agent's existing TOOLS.md | Conservative — list only tools clearly implied |
| `## Safety` | `attributes.approvalsRequired[]` + ekg/rules/ entries reachable via `relations.depends-on` | Each `approvalsRequired` entry becomes a "request approval before …" line |

Always end the SKILL.md with a generated provenance footer (HTML comment, not a section):

```html
<!-- Synthesized 2026-04-30T14:30:00.000Z from ekg/workflows/wf-vendor-onboarding-001 -->
<!-- Source: vendor-onboarding-policy-2026-q1.pdf; confidence 0.86 -->
```

This footer is how Step 5 detects synthesized skills and avoids overwriting hand-edited ones.

### Step 3: Write the SKILL.md

```
sentura_agents_manage { action: "write", agentId: "<targetAgentId>", relPath: "skills/<kebab-name>/SKILL.md", content: <full file> }
```

### Step 4: Notify the target agent

Use OpenClaw's `message` / `sessions_send` to notify the deployed agent that a new skill is available:

```
gateway.call("sessions.send", {
  agentId: "<targetAgentId>",
  text: "New skill 'Vendor Onboarding' is available in your workspace. Review skills/vendor-onboarding/SKILL.md.",
})
```

(The agent picks up the new skill on next session start — OpenClaw hot-reloads the workspace, but the existing chat session uses the original toolset.)

### Step 5: Update existing SKILL.md (UPDATE path)

If a SKILL.md exists at the target path:

1. Read it.
2. Look for the synthesized provenance footer (HTML comments at end).
3. If the footer is missing → the skill is hand-authored. **Do not overwrite.** Instead:
   - Write the proposed content to `skills/<kebab-name>/SKILL.md.proposed` (a side file)
   - Notify the operator: "Manual review needed for skills/<kebab-name>/SKILL.md — proposed update at .proposed sibling."
4. If the footer is present and the new entity's `provenance.ingestedAt` is later → overwrite the file (this is a re-synthesis from a fresher source). Add a `<!-- Replaces: <old-ingestedAt> -->` line above the new footer.
5. If the new entity's `provenance.ingestedAt` is older → skip (we already have a fresher version).

### Step 6: Update Orchestrator capabilities

If the new SKILL.md adds a capability that isn't already in `orchestrator/ekg/capabilities/<targetAgentId>.json5`, schedule a follow-up `capability-extraction` run for that agent (this is the Creator's responsibility — surface as an operator suggestion, do not auto-invoke from this skill).

## Tools Needed

- `sentura_agents_manage` (actions: `read`, `write`, `list`)
- `gateway` (action: `sessions.send`) — only for Step 4 notification

No web search. No browser. No direct LLM provider calls.

## Safety

- **Confidence floor 0.7.** Lower-confidence workflows go through Q&A Completion first. Synthesizing skills from ambiguous data produces unreliable employees.
- **Hand-authored skills are protected.** The `.proposed` sibling pattern (Step 5.3) is the ONLY way the curator updates a hand-authored skill — never directly overwrite.
- **No new tools.** This skill does NOT add to the target agent's `tools.alsoAllow` config — that requires a Tuner `nl-to-config` invocation. If a synthesized SKILL.md references a tool the agent doesn't have, list it in `## Tools Needed` and surface the gap to the operator.
- **No Hard Rule writes.** If a workflow's `approvalsRequired` implies a new Hard Rule, write it into the synthesized `## Safety` section but DO NOT touch the agent's `AGENTS.md`. Hard Rules are operator-owned via Tuner.
- **Provenance footer is mandatory.** Every synthesized SKILL.md ends with the HTML-comment provenance block (Step 2). Without it, Step 5 cannot distinguish synthesized vs hand-authored skills.
- **No T3/T4 inlined into SKILL.md.** Workflow entities may reference T2+ data by id; the SKILL.md must reference by id too — never quote raw fields.
