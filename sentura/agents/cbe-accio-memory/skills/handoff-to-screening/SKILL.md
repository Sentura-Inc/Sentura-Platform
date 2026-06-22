# Handoff To Screening

## When to Use

Use when the operator wants a buyer from Accio to be investigated by `cbe-buyer-screening`.

## Procedure

For each selected Accio summary, produce an `InvestigationTarget` with:

- `source: "accio_memory"`
- `company_name`
- `country`
- `website`
- `email`
- `contact_person`
- `contact_title`
- `product_interest`
- `operator_notes` containing concise behavior signals and negotiation context
- `supplied_fields`
- `missing_fields`

Do not call Screening tools yourself. The handoff is a typed payload for the Screening employee or dashboard.

## Safety

Do not say the buyer was verified. Accio chat behavior is a useful signal, not legal/company evidence.
