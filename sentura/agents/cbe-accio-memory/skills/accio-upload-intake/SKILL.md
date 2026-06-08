# Accio Upload Intake

## When to Use

Use when the operator uploads, pastes, or selects an Alibaba Accio-style JSON export.

## Procedure

1. Confirm the source type:
   - `demo_fixture`
   - uploaded JSON
   - pasted JSON
2. Validate that the export has:
   - `export_metadata.platform`
   - `export_metadata.exported_at`
   - `export_metadata.source_file`
   - `export_metadata.data_classification`
   - `conversations[]`
3. Call `cross-border-intel__cbe_intel_parse_accio_chat` when available.
4. Report validation status, source file, data classification, and conversation count.
5. If validation fails, stop and ask the operator for a corrected JSON file. Do not summarize malformed content.

## Safety

Raw Accio chats are T2/T3 business data. Keep them local and do not paste raw transcripts into external systems.

