# Deal Summary

## When to Use

Use to generate the operator-facing Accio report after normalization.

## Procedure

1. Call `cross-border-intel__cbe_intel_summarize_accio_chat` with the validated `chat_export` when the input is strict enough for the tool. For pasted text or screenshot transcripts that the tool cannot parse, summarize from the normalized transcript while marking gaps.
2. Verify that every conversation produced one summary.
3. Treat the MCP result as an analysis draft, not as a UI preset. Re-open the uploaded `chat_export.conversations[].messages` and correct any field that is clearly contradicted or missing in the raw chat.
4. For each summary, check that the following fields are populated from the chat, not invented:
   - buyer company and contact role
   - requested product(s)
   - models/specifications
   - current order/trial quantity
   - monthly potential quantity when the buyer states it separately from the current quote
   - quoted, target, agreed, or best price
   - packaging add-ons
   - Incoterm, payment, logistics, certificate, or FBA requirements when present
   - next actions
   - behavior signal points
   - Simplified Chinese report sections in `report_zh`
   - Chinese translations/summaries for English buyer or seller messages where useful
5. For the Phase-1 sample fixture, make sure the report distinguishes:
   - MOQ from requested quantity
   - monthly potential from current quote quantity
   - seller tier price from the current best/quoted price
   - packaging or labeling add-ons from product unit price
   - unit price from order total / DDP total
6. Return Chinese Markdown plus JSON wrapped in:
   - `ACCIO_SUMMARIES_JSON_START`
   - `ACCIO_SUMMARIES_JSON_END`
   The marker body must be one JSON object with top-level `summaries`, not a raw array.
7. Each summary must include `report_zh`, Chinese `next_actions`, `memory_preview.status = "preview_only"`, and `memory_preview.summary_zh`. Preserve original English facts only as supporting source text; the operator-facing summary should be Chinese.

## Safety

If a price or term is not present, mark it as missing instead of inferring it.
