# Orchestrator EKG — Manager Knowledge Aggregation

> **On-demand reference — not read by default.**
> The Orchestrator (Conductor) keeps cross-employee knowledge under this directory. Other employees use their own `ekg/` for org/rules/assets/workflows; the Orchestrator extends the convention with **manager-level** pillars that aggregate signals across the workforce.

## Pillars

| Pillar | Purpose | Writers | Readers | File pattern |
|--------|---------|---------|---------|--------------|
| `capabilities/` | Per-employee capability metadata (tags, I/O schemas, owner department, deployedAt). Used by `task-decomposition` to discover who can handle a subtask. Auto-populated when the Creator finishes Phase 5 (Deploy). | Creator (capability #17 Mechanism 1) | Orchestrator, dashboard `/employees`, Manager skills | `{agent-id}.json5` |
| `conflicts/` | Detected rule conflicts across departments. Each entry references two or more employee `ekg/rules/` items that contradict and is held until an `ekg_manager` resolves it. Drives capability #17 Mechanism 2 (cross-domain conflict detection — Week 5). | Manager conflict-detection skill | `ekg_manager` via dashboard, audit | `{conflict-id}.json5` |
| `insights/` | Periodic optimization directives produced by reverse-injection training (capability #17 Mechanism 3 — Week 5). Each entry summarizes a systemic pattern (e.g. "80% of contract tasks rejected for missing penalty clause") plus the prescribed fix. | Manager reverse-injection skill | Tuner, Creator, dashboard | `{insight-id}.json5` |
| `global-sops/` | Cross-department SOPs born from resolved conflicts. Once a conflict in `conflicts/` is resolved, the resolution is canonicalized here so future conflicts can reference the precedent. | Manager conflict-resolution skill (post-resolve hook) | All employees (read-only via Knowledge Curator) | `{sop-id}.json5` |

## Schema — `capabilities/{agent-id}.json5`

```json5
{
  agentId: "ap-clerk",
  name: "Avery (AP Clerk)",
  department: "finance",
  deployedAt: "2026-04-30T10:14:00.000Z",
  deployedBy: "creator",
  capabilityTags: ["invoice-processing", "vendor-payment", "expense-reconciliation"],
  ioSchemas: {
    accepts: [
      { kind: "invoice-pdf", description: "Vendor invoice (PDF)", required: ["vendor", "amount", "dueDate"] },
      { kind: "purchase-order-id", description: "Existing PO reference" },
    ],
    produces: [
      { kind: "payment-decision", values: ["approve", "hold-for-review", "reject"] },
      { kind: "audit-event", description: "Mirrored into sentura-audit log" },
    ],
  },
  invokableSkills: ["invoice-triage", "vendor-lookup", "payment-runs"],
  approvalsRequired: ["payment-amount-over-threshold", "new-vendor-onboarding"],
  costEstimate: { tokensPerTask: 8000, model: "openai/gpt-5.4" },
  provenance: {
    source: "creator.phase-5.capability-extraction",
    extractedAt: "2026-04-30T10:14:00.000Z",
    confidence: 0.85,
  },
  reviewRequired: false,
}
```

## Invariants

1. **Additive merge only.** Never delete a capability/conflict/insight/sop — supersede with a new entry that links the predecessor via `supersedes: [oldId]`. The Knowledge Curator and audit trails depend on history being preserved.
2. **Confidence floor for `capabilities/`**: 0.7 minimum. Below 0.7, the entry is written with `reviewRequired: true` and Orchestrator excludes it from `task-decomposition` candidate lists until a human accepts.
3. **No T3/T4 in entries**: data classification stays at T0/T1. If a department's ruleset contains T2+, the conflict/insight references the rule by id only — never inlines it.
4. **Provenance is mandatory.** Every entry carries `provenance: { source, extractedAt, confidence }` so we can trace WHY this entry exists.

## Lifecycle

```
Phase 5 (Creator) ──► capabilities/{agent-id}.json5
                                 │
                                 ▼
       Orchestrator task-decomposition reads capabilities/*.json5
                                 │
                                 ▼
       Mode B execution → multi-agent-routing produces session keys
                                 │
                                 ▼
       Manager periodic skills (Week 5) → conflicts/, insights/
                                 │
                                 ▼
       ekg_manager resolves conflict → global-sops/{sop-id}.json5
```

## Cross-references

- Creator Phase 5 capability extraction: `sentura/agents/creator/skills/capability-extraction/SKILL.md`
- Orchestrator task decomposition: `sentura/agents/orchestrator/skills/task-decomposition/SKILL.md`
- Orchestrator multi-agent routing: `sentura/agents/orchestrator/skills/multi-agent-routing/SKILL.md`
- Capability #17 — Manager capability abstraction (Mechanism 1): `docs/DESIGN.md` (search "capability #17")
