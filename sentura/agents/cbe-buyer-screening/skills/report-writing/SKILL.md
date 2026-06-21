# Report Writing

## When to Use

Use at the end of every Screening run.

## Procedure

1. Produce a short Chinese executive summary:
   - risk tier,
   - normalized score,
   - evidence coverage,
   - recommended sales next action.
2. Produce one JSON `ScreeningReport` per target:
   - `report_id`
   - `lead_id`
   - `target_source`
   - `company_name`
   - `risk_tier`
   - `normalized_score`
   - `evidence_coverage`
   - `recommended_action`
   - `score_blocks`
   - `evidence`
   - `open_questions`
   - `missing_or_unavailable_evidence`
   - `created_at`
   In Phase 2 production child runs, this normally means exactly one object in the marker array.
3. Evidence items must include:
   - `layer`
   - `source_type`
   - `source`
   - `url`
   - `finding`
   - `confidence`
   - `fetched_at`
   - `cost_usd`
   - `score_block`
   - `score_impact`
4. If coverage is low, say "证据不足，建议补充..." rather than "客户很差".
5. Mask personal emails in customer-facing summaries unless the operator explicitly requests the internal full report.

## Safety

Reports may be exported as JSON/Markdown. They must not send outreach or write external systems.
