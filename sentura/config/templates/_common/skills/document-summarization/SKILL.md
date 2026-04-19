# Document Summarization

## When to Use

- User provides a PDF, Word doc, URL, or long text and asks for a summary.
- User asks "give me the gist" / "TL;DR" / "key points" of a document.
- As part of a larger workflow (e.g., contract review, report triage).

## Procedure

1. **Identify source type**:
   - URL → use `web_fetch` or `browser` for dynamic pages.
   - PDF/DOCX → use `pdf` tool.
   - Plain text / markdown → `fs_read`.
   - Internal doc (Notion, Confluence, SharePoint) → use the enterprise `{knowledge_source}` MCP server.

2. **Extract content**. Preserve structure (headings, bullets, tables). For PDFs with images of text, use OCR if available.

3. **Determine summary depth**:
   - **Executive (≤150 words)**: top-line only. For busy recipients.
   - **Standard (300-500 words)**: main sections + key findings.
   - **Detailed (1000+ words)**: section-by-section with preserved structure.
   Ask the user which depth unless context makes it obvious.

4. **Apply the standard summary format**:

   ```
   ## {Document Title}

   **Source**: {URL or filename}
   **Length**: {N words / M pages}
   **Type**: {contract / report / spec / article / policy / etc.}
   **Summary depth**: {executive / standard / detailed}

   ### TL;DR
   {1-3 sentence takeaway}

   ### Key Points
   - ...

   ### Risks / Concerns
   - (if applicable)

   ### Open Questions
   - (if applicable)

   ### Action Recommended
   - (if the document requires a response or decision)
   ```

5. **Flag red flags explicitly**. If the document contains unusual or risky clauses (auto-renewal, liability transfer, IP assignment, NDA scope expansion, SLA penalty), surface them under "Risks / Concerns".

6. **Preserve citations**. Quote direct text for any claim that could be contested. Use page numbers or section references.

## Tools Needed

- `web_fetch` / `browser` — fetch URLs
- `pdf` — parse PDF text and metadata
- `fs_read` — read local files
- `mcp.{knowledge_source}` — internal document stores

## Safety

- NEVER summarize documents marked confidential/NDA/attorney-client without confirming the caller is authorized (check `AGENTS.md § Hard Rules` and `BOOTSTRAP.md § Enterprise Context` for data-classification policy)
- NEVER omit risks to make a summary look cleaner — surface ALL material concerns
- NEVER rewrite or paraphrase legal/contract language in the "Key Points"; quote directly
- ALWAYS record the source URL/path in the summary for traceability
- ALWAYS apply the enterprise data-classification (T0-T4) tag from `BOOTSTRAP.md § Enterprise Context` to the output
- ALWAYS escalate to {escalation_target} if the document contains unexpected legal obligations, PII regulated data, or compliance-triggering language
