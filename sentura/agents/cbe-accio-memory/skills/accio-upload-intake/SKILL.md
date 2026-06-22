# Accio Upload Intake

## When to Use

Use when the operator uploads JSON, pastes manual chat text, or submits screenshot transcript batches for an Alibaba Accio-style conversation.

## Procedure

1. Confirm the source type:
   - `demo_fixture`
   - uploaded JSON
   - pasted/manual text normalized by Dashboard
   - screenshot transcript batches from `ACCIO_IMAGE_TRANSCRIPT_BATCH_*`
2. Validate that the export has:
   - `export_metadata.platform`
   - `export_metadata.exported_at`
   - `export_metadata.source_file`
   - `export_metadata.data_classification`
   - `conversations[]`
   - for image imports, attachment metadata and prior screenshot transcript batch markers
3. Call `cross-border-intel__cbe_intel_parse_accio_chat` when available.
4. Report validation status, source file, data classification, and conversation count.
5. If JSON validation fails, report the schema gap. If pasted text or screenshot transcripts are incomplete, continue with explicit `missing_fields` and `inference_notes` instead of inventing facts.

## Safety

Raw Accio chats are T2/T3 business data. Keep them local and do not paste raw transcripts into external systems.
