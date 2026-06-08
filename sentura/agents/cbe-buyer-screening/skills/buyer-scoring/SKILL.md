# Buyer Scoring

## When to Use

Use after evidence collection or when recalculating a report after the operator enables/disables sources.

## Procedure

1. Build contextual evidence blocks:
   - `legal_identity` max 25
   - `domain_email` max 25
   - `public_footprint` max 20
   - `business_fit` max 20
   - `trade_financial` max 10
   - `conversation_behavior` max 15
2. Set block status:
   - `scored` only when evidence was actually checked.
   - `not_applicable` when the block does not apply, such as behavior for a cold lead.
   - `unavailable_api`, `disabled_by_budget`, or `pending_human_input` for relevant but missing checks.
3. Call `cross-border-intel__cbe_intel_score_buyer` with blocks and forced downgrade flags.
4. Explain:
   - `normalized_score`
   - `evidence_coverage`
   - `risk_tier`
   - which blocks are excluded from denominator
   - which blocks reduce coverage only
5. Apply forced downgrades after normalized score:
   - no registry/stable official source plus very young domain,
   - disposable/free email only and no verified business domain,
   - registry/legal-name contradiction,
   - material customs/product/country contradiction,
   - credible repeated fraud/scam evidence,
   - abnormal payment/compliance behavior from Accio or sales notes.

## Safety

Do not use a fixed 100-point denominator. The denominator must adapt to applicable and actually checked evidence.

