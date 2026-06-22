# Trade Record Check

## When to Use

Use after registry and domain/email checks. Trade/customs data improves confidence but is not required for every legitimate buyer.

## Procedure

1. Determine whether trade evidence is applicable:
   - applicable for US importers, larger import/distributor claims, or operator-enabled paid checks.
   - `not_applicable` for small retailers where trade data would not reasonably exist.
2. If paid trade data is disabled or budget is zero, call `cross-border-intel__cbe_intel_trade_record_search` only when useful for a public-web fallback, then mark the block `disabled_by_budget` or `unavailable_api`.
3. If paid data is enabled and budget allows it, call `cross-border-intel__cbe_intel_trade_record_search` with `source="importyeti"` for the current paid US import evidence profile, or `source="auto"` only when the server/run explicitly allows provider choice. Use `max_records <= 5` and the operator's per-target spend cap.
4. Do not make more than one paid trade-data call for the same target unless a retry request explicitly says a fresh paid lookup was approved.
5. Preserve provider, query, approximate cost, timestamp, source URL, and whether the result supports or contradicts the target's claimed country/product category.

## Safety

Missing ImportYeti/Volza/customs data is a coverage gap, not a fraud signal. Only contradictory trade data can become a negative score impact.
