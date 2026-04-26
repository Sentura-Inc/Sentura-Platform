# Sentura Data Scavenger Agent — TOOLS.md

Agent-specific notes on the tools available to Scout. Read this file at
session startup before executing any ingestion pipeline step.

---

## pdf

Extracts raw text from PDF documents uploaded by the user.

- **Use for**: the ingestion skill's extraction step when the document format
  is PDF.
- **Input**: a file reference or URL pointing to the PDF.
- **Output**: raw text string. Structure (headings, tables, bullet lists) is
  partially preserved depending on the PDF's encoding.
- **Notes**:
  - For scanned PDFs (image-based), the `pdf` tool applies OCR. Accuracy
    varies with scan quality — flag entities from OCR'd documents with a
    maximum confidence of 0.8 regardless of classification certainty.
  - For non-PDF formats (DOCX, XLSX, images), use `read` or `web_fetch`
    instead; `pdf` will error on non-PDF MIME types.
  - Always record `format: "pdf"` in the provenance block when using this tool.

---

## web_fetch

Fetches the content of a URL — HTML pages, publicly accessible documents,
or raw file endpoints.

- **Use for**: ingesting documents delivered as URLs rather than file uploads;
  also used to retrieve schema references or public policy documents.
- **Notes**:
  - Returned HTML is stripped of scripts and styles by OpenClaw's fetcher;
    treat the result as plain text.
  - Do NOT use `web_fetch` to retrieve documents from internal enterprise
    systems — those require MCP server access, not a raw HTTP fetch.
  - Record `format: "html"` or `format: "text"` in provenance as appropriate.

---

## web_search

Searches the public web for supplementary context about entities found in
a document (e.g. confirming a regulatory name or role title).

- **Use for**: resolving ambiguity during classification only — not for primary
  document retrieval.
- **Notes**:
  - Never treat web_search results as a source of EKG entries. They are
    context aids only. All EKG entries must trace to the submitted document.
  - If web_search is needed to understand a term, note it in the entity's
    `attributes.notes` field but keep provenance pointing to the source doc.

---

## sentura_agents_manage

The primary tool for reading from and writing to a target agent's workspace,
including its `ekg/` directory.

- **Use for**:
  - Reading the target agent's existing `ekg/{pillar}/*.json5` files before
    merge (action: `"read"`).
  - Writing merged EKG pillar files back to the target agent's workspace
    (action: `"write"`).
  - Reading the target agent's `ekg/ekg-schema.json5` for classification
    reference (action: `"read"`).

- **Write action signature**:
  ```
  sentura_agents_manage({
    action: "write",
    agentId: "<target-agent-id>",
    relPath: "ekg/<pillar>/<filename>.json5",
    content: "<JSON5 string of merged pillar file>"
  })
  ```

- **Read action signature**:
  ```
  sentura_agents_manage({
    action: "read",
    agentId: "<target-agent-id>",
    relPath: "ekg/<pillar>/<filename>.json5"
  })
  ```

- **Critical constraints**:
  - ADDITIVE writes only — read the existing file, merge new entities into it,
    write the combined result. Never pass a payload containing only new entities
    when an existing file is present.
  - If a file does not yet exist in the target agent's `ekg/` directory, the
    write creates it; this is the only safe case for a "new file" write.
  - Never use this tool to write to Scout's own workspace.

---

## memory_search

Searches Scout's vector memory for previously ingested entities, enabling
deduplication during the structuring stage.

- **Use for**: detecting whether an entity being structured already exists in
  the target agent's EKG before writing it.
- **Deduplication logic**:
  1. Search by `entity.id` (exact string match preferred).
  2. Fall back to semantic similarity search on `entity.name + entity.type`.
  3. Similarity >= 0.9: skip — already present; log as "deduplicated".
  4. Similarity 0.7–0.89: flag for human review — possible duplicate.
  5. Below 0.7: treat as new entity; include in merge payload.
- **Notes**:
  - `memory_search` searches Scout's own memory namespace. Use
    `sentura_agents_manage { action: "read" }` for authoritative dedup
    against the live EKG files. Use both in combination: memory_search for
    fast pre-filter, then sentura_agents_manage read for near-matches.

---

## memory_get

Retrieves a specific memory entry by ID from Scout's memory store.

- **Use for**: loading a full prior ingestion record when memory_search returns
  a candidate match and you need the complete entity to compare attributes.

---

## message (sessions_send)

Sends a notification message to a target agent's active session.

- **Use for**: notifying the target agent after a successful EKG merge
  (ekg-merge skill, final step).
- **Message format**:
  ```
  "Your knowledge base was updated. {N} new entities added across {X} pillars."
  ```
- **Constraint**: only call after ALL pillar writes have been confirmed
  successful. Never notify on partial completion.
