# Skill: Document Ingestion

## When to Use

Use this skill when you receive a document upload (PDF, DOCX, Excel, or image)
along with a target agentId. This is always the first stage of the ingestion
pipeline. Do not skip to classification without completing ingestion first.

Triggers:
- User uploads a file attachment (any format) and specifies a target agent ID.
- User provides a URL to a document and specifies a target agent ID.
- A queued ingestion task is resumed from memory.

## Procedure

1. **Verify data classification before ingesting.**
   Ask the submitting user: "What is the data classification level of this
   document? (T0 Public / T1 Internal / T2 Sensitive / T3 Confidential /
   T4 Restricted)"
   - If T3 or T4: STOP. Request elevated approval from the EKG Manager via
     OpenClaw's `exec.approval` system before proceeding.
   - If classification is unknown: treat as T3 and request approval.
   - Only proceed for T0, T1, or T2 documents (or after approved T3/T4).

2. **Accept the document and extract raw text content.**
   - For PDF files: use the `pdf` tool.
   - For plain text or DOCX files: use the `read` tool if accessible as a
     local path, or `web_fetch` if delivered as a URL.
   - For Excel/XLSX files: use `web_fetch` or `read`; note tabular structure
     will be partially preserved.
   - For image files: use the `image` tool for OCR-based text extraction.
     Flag all entities from images with a maximum confidence ceiling of 0.8.
   - For scanned PDFs: the `pdf` tool applies OCR automatically. Apply the
     same 0.8 confidence ceiling.

3. **Record provenance.**
   Construct the provenance object immediately after extraction, before any
   classification work begins:
   ```json5
   {
     source: "<original filename or URL>",
     ingestedAt: "<ISO-8601 timestamp>",
     format: "<pdf|docx|xlsx|image|text|html>",
     targetAgentId: "<agent-id from user>",
   }
   ```
   Store this in working memory. Every EKG entity produced downstream must
   carry this provenance block plus a `confidence` field added during
   classification.

4. **Validate extraction quality.**
   If the extracted text is empty or fewer than 50 characters, report to the
   user and stop the pipeline for this document. If OCR artefacts are
   present, note this in `attributes.extractionNote` on affected entities
   during classification.

5. **Pass to classification skill.**
   Hand off the extracted raw text and the provenance object to the
   classification skill. Do not begin classification within this skill.

## Tools Needed

- `pdf` — primary tool for PDF text extraction
- `read` — for plain text, DOCX, and local file paths
- `web_fetch` — for URL-delivered documents and HTML pages
- `image` — for image-based documents requiring OCR (if available in session)

## Safety

- NEVER ingest a T3 or T4 document without prior `ekg_manager` approval via
  `exec.approval`. Treat unknown classification as T3.
- NEVER pass raw document content into EKG entries — only extracted,
  structured metadata belongs in the EKG.
- NEVER proceed past step 1 if the document classification check is skipped
  or unanswered.
- ALWAYS record the provenance object in step 3 before passing to the next
  skill. A pipeline without provenance cannot proceed.
- If the `pdf` tool returns an error, do not silently fall back to `read` on
  the same file — report the error to the user first and confirm the
  alternative approach.
