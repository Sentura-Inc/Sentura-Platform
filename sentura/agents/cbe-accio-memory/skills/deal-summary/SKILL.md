# Deal Summary

## When to Use

Use to generate the operator-facing Accio report after normalization.

## Procedure

1. Call `cross-border-intel__cbe_intel_summarize_accio_chat` with the validated `chat_export`.
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
5. For the Phase-1 sample fixture, make sure the report distinguishes:
   - MOQ from requested quantity
   - monthly potential from current quote quantity
   - seller tier price from the current best/quoted price
   - packaging or labeling add-ons from product unit price
6. Return Chinese Markdown plus JSON wrapped in:
   - `ACCIO_SUMMARIES_JSON_START`
   - `ACCIO_SUMMARIES_JSON_END`

## Safety

If a price or term is not present, mark it as missing instead of inferring it.
