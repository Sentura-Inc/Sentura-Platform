# Knowledge Curation

## When to Use

When enterprise knowledge needs to be ingested, organized, and distributed to AI employees. This includes:
- New documents (PDF, DOCX, wiki pages) that employees need to know about
- API documentation that should become MCP server tools
- Policy changes that affect employee behavior
- New product features or process updates
- Training materials for new or existing employees

## Procedure

### Step 1: Receive Knowledge Source

1. Accept the knowledge source from the user. Supported formats:
   - **URL**: Wiki page, documentation site, knowledge base article
   - **File path**: PDF, DOCX, TXT, Markdown files in the workspace
   - **API endpoint**: REST API documentation, OpenAPI specs
   - **Description**: Verbal description of a process or policy change

2. Classify the knowledge type:
   | Type | Action |
   |------|--------|
   | Procedural (how to do X) | Generate/update SKILL.md files |
   | Contextual (org structure, policies) | Update CONTEXT.md |
   | Safety-critical (new rules, compliance) | Update RULES.md (requires admin approval) |
   | Reference (lookup data, templates) | Store in workspace data/ directory |

### Step 2: Extract Information

1. **For URLs**: Use `web_fetch` or `browser` to crawl the page
   - Extract main content, ignore navigation/ads
   - Follow pagination if multi-page
   - Capture images/diagrams if referenced in procedures

2. **For PDFs**: Use `pdf` tool to extract text
   - Process each page sequentially
   - Identify document structure (headings, sections, tables)
   - Flag sections that need human review (poor OCR, complex tables)

3. **For API docs**: Use `web_fetch` to read documentation
   - Extract endpoints, methods, parameters, response schemas
   - Identify authentication requirements
   - Map endpoints to potential MCP tool definitions

4. **For descriptions**: Parse the verbal description into structured format
   - Ask clarifying questions if the description is ambiguous
   - Verify understanding with the user before proceeding

### Step 3: Structure the Knowledge

1. **For procedural knowledge** → create SKILL.md:
   - Identify the trigger conditions (When to Use)
   - Break the procedure into numbered, verifiable steps
   - List the tools needed for each step
   - Identify safety constraints

2. **For contextual knowledge** → update CONTEXT.md:
   - Identify which section to update (Company, Org Structure, Systems, Policies)
   - Preserve existing content, add new information
   - Flag conflicts with existing context (e.g., changed org structure)

3. **For safety-critical knowledge** → draft RULES.md updates:
   - Convert policy changes into NEVER/ALWAYS rules
   - Flag for admin approval before applying

4. **For reference data** → organize in data/:
   - Create appropriately named files
   - Add index entry in TOOLS.md

### Step 4: Identify Affected Employees

1. Determine which AI employees need this knowledge:
   - By role: "All finance employees need the new procurement policy"
   - By skill: "Any employee with the invoice-processing skill"
   - By department: "All support team employees"
   - Specific: "Only the AP Clerk needs this vendor update"

2. For each affected employee, determine the update type:
   - New skill file → add to skills/ directory
   - Updated skill → modify existing SKILL.md
   - Context change → update CONTEXT.md
   - New rule → update RULES.md (requires approval)

### Step 5: Distribute Knowledge

1. For each affected employee workspace:
   - Write new/updated files using `fs_write`
   - Verify file was written correctly
   - If RULES.md was modified → submit for admin approval

2. Notify affected employees (via `sessions_send` if they have active sessions):
   - What knowledge was added/updated
   - Which files were modified
   - Any behavioral changes expected

3. Notify the knowledge source (the human who provided the input):
   - Summary of what was extracted
   - Which employees received the update
   - Any items flagged for human review

### Step 6: Verify Distribution

1. For each affected employee, verify:
   - The skill/context file exists in their workspace
   - The file content matches the intended update
   - No conflicts with existing RULES.md

2. Log the knowledge distribution event:
   - Source (URL, file, description)
   - Knowledge type (procedural, contextual, safety, reference)
   - Affected employees (list)
   - Files modified (list with before/after summary)
   - Approval status (if RULES.md was modified)

## Tools Needed

- `web_fetch` / `browser` — crawl web-based knowledge sources
- `pdf` — extract text from PDF documents
- `fs_read` / `fs_write` — read existing workspace files, write updates
- `sessions_send` — notify affected AI employees
- `message` — notify humans of distribution results
- `web_search` — find additional context or related documentation

## Safety

- NEVER modify RULES.md without admin approval
- NEVER delete existing skills — only add or update (preserve history)
- NEVER distribute unverified information as fact — flag uncertain content for human review
- NEVER include credentials or secrets in knowledge files
- ALWAYS verify extracted information against the source before distributing
- ALWAYS preserve existing workspace file content when updating (merge, don't overwrite)
- ALWAYS log every knowledge distribution for audit trail
- ALWAYS notify affected employees when their workspace files change
