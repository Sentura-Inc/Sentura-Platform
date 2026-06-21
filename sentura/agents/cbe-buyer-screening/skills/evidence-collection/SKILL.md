# Evidence Collection

## When to Use

Use first for every Screening request.

## Procedure

1. Identify intake mode:
   - `marketing_lead_batch` for `LeadCandidate[]`.
   - `manual_input` for operator-entered company, country, website/domain, email, contact person/title, profile URL, product interest, and notes.
   - In Phase 2 production, this agent should normally receive one target per session. If the prompt contains 5 or more targets, stop and ask the Dashboard/store to split it into single-target child runs.
   - Process 2-3 targets in one session only when the run is explicitly labeled `batch3_experiment`.
2. Normalize every item into `InvestigationTarget`:
   - `target_id`
   - `source`
   - `lead_id`
   - `company_name`
   - `country`
   - `website`
   - `domain`
   - `email`
   - `contact_person`
   - `contact_title`
   - `social_or_profile_url`
   - `product_interest`
   - `operator_notes`
   - `supplied_fields`
   - `inferred_fields`
   - `missing_fields`
3. Preserve Marketing provenance: `source_run_id`, source URLs, query strings, matched products, contact candidates, and discovery confidence.
4. Build an evidence plan in this order:
   - registry/legal identity,
   - domain/email credibility,
   - public digital footprint,
   - trade/customs evidence,
   - financial/public filing evidence,
   - conversation behavior only if Accio or sales history exists.
5. Mark missing clues as `pending_human_input`; do not score them as negative.

## Safety

Never invent missing fields. If the operator supplies only an email or domain, report exactly that and ask for company/legal name when needed.
