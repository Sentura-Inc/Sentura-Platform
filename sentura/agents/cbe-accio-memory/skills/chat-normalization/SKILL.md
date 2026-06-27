# Chat Normalization

## When to Use

Use after the Accio JSON export validates.

## Procedure

For every conversation, preserve:

- `conversation_id`
- buyer display name, company name, country, city, email, website, claimed role
- message timestamps, sender, and text
- attachments with file name, type, and description

Normalize missing optional fields as absent, not fabricated. Keep buyer claims separate from verified company facts.

## Output

Produce a normalized conversation list with message count, first/last message timestamps, attachment count, and source metadata.

## Safety

Do not remove source identifiers. The memory analysis report needs `source_file` plus `conversation_id`.
