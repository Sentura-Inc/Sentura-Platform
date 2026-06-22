# Chat Normalization

## When to Use

Use after the Accio-compatible JSON export validates or after pasted text / screenshot transcript batches are available.

## Procedure

For every conversation, preserve:

- `conversation_id`
- buyer display name, company name, country, city, email, website, claimed role
- message timestamps, sender, and text
- attachments with file name, type, and description
- screenshot transcript confidence and uncertainties when the source is image-based

Normalize missing optional fields as absent, not fabricated. Keep buyer claims separate from verified company facts.
For incomplete pasted text or screenshots, preserve the visible order and mark unclear sender, timestamp, company, country, and contact fields as missing.

## Output

Produce a normalized conversation list with message count, first/last message timestamps, attachment count, and source metadata.

## Safety

Do not remove source identifiers. Screening and memory preview both need `source_file` plus `conversation_id`.
