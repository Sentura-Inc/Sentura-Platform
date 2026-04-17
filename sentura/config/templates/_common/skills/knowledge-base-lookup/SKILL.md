# Knowledge Base Lookup

## When to Use

- Before answering ANY factual question about {Company} policies, products, procedures, or people.
- When a user asks "how do I...", "what's the policy on...", "where do I find...".
- When an answer could be wrong without authoritative confirmation.

**Rule of thumb**: if the question has an enterprise-specific answer, look it up. Don't answer from memory alone.

## Procedure

1. **Decompose the question into search queries**. Generate 2-4 paraphrases:
   - Literal keywords from the user.
   - Synonyms and alternative phrasings.
   - Associated concepts (e.g., "PTO policy" also search "time off", "vacation", "leave").

2. **Select the authoritative source(s)** from CONTEXT.md:
   - Internal docs: Notion, Confluence, SharePoint (`{knowledge_source}`).
   - Code/runbook: GitHub wiki, internal repo READMEs.
   - HR/benefits: HRIS (`{hris_mcp}`) or benefits portal.
   - Customer-facing: help center or public docs.
   - Compliance/legal: regulated repository (only if caller is authorized).

3. **Query in parallel** using the appropriate MCP tool(s):
   - Semantic search first (better for natural language questions).
   - Keyword search as fallback.
   - If no hits: try the agent's vector memory (experience links may cover it).

4. **Evaluate results** against these criteria:
   - **Freshness**: prefer documents with recent `lastModified`. Flag any source older than 12 months for reconfirmation.
   - **Authority**: internal policy docs > team notes > personal pages > Slack messages.
   - **Specificity**: documents that directly address the question > tangential mentions.
   - **Consistency**: if multiple sources disagree, flag the conflict — don't pick one silently.

5. **Compose the answer** with citations:

   ```
   **Answer**: {1-3 sentences}

   **Source**: {doc title} ({URL or path}, last updated {YYYY-MM-DD})

   **Caveats**:
   - (if any — e.g., policy applies only to US employees, exception exists for {condition})
   ```

6. **If you can't find an authoritative answer**:
   - DO NOT fabricate or guess.
   - Say: "I couldn't find a current policy on {X}. The closest source is {Y}, but it doesn't directly address this. I'll escalate to {escalation_target} for confirmation."
   - Log a gap report to `~/.openclaw/workspace/{agent-id}/knowledge-gaps.md` for the knowledge team to fill.

7. **Cache frequently asked questions**. Write high-confidence Q&A pairs to vector memory with a `knowledge-cache` tag, so future sessions can retrieve them faster.

## Tools Needed

- `mcp.{knowledge_source}` — Notion / Confluence / SharePoint
- `mcp.{hris_mcp}` — HR policies (if caller authorized)
- `memory_query` — search prior answered questions
- `memory_store` — cache Q&A pairs
- `web_search` — ONLY for non-confidential external information (e.g., generic regulatory text)

## Safety

- NEVER answer an enterprise-specific factual question without consulting an authoritative source
- NEVER return outdated policies as current — always check `lastModified`
- NEVER mix external web results with internal policy as if they're equivalent
- NEVER cache or expose answers from documents the caller is not cleared to see (check RBAC via RULES.md / CONTEXT.md)
- ALWAYS cite sources inline (doc name + URL + last-updated date)
- ALWAYS flag freshness concerns (>12 months old → add "verify with policy owner")
- ALWAYS record a gap to `knowledge-gaps.md` when authoritative answer is missing
- ALWAYS escalate to {escalation_target} for legal/compliance questions with no clear policy match
