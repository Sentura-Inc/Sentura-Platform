# Research & Discovery (Phase 1)

## When to Use

Phase 1 of employee incubation. Run this FIRST, before any code or workspace generation. The goal is to understand exactly what the user needs so subsequent phases generate a role-appropriate, enterprise-appropriate employee.

This is a SUPERSET of the `role-research` skill — it covers clarifying questions AND contextual research.

## Procedure

### Step 1: Parse the Initial Request

Extract from the user's natural-language description:

1. **Role category** (what does this person DO?): customer support, AP clerk, SDR, content writer, etc.
2. **Department affiliation**: which team owns this role?
3. **Seniority signals**: "senior", "lead", "junior", "intern" — affects approval authority.
4. **Scope signals**: "just handle L1 tickets", "full accounts payable", "end-to-end" — affects skill breadth.
5. **Explicit integrations**: names of systems (Salesforce, NetSuite, Zendesk, etc.).
6. **Explicit channels**: Slack, Teams, WhatsApp, email, webchat, etc.
7. **Explicit constraints**: compliance (HIPAA, SOC2, PCI), data classifications, geography.

Record what is explicit vs implicit. Implicit items need confirmation.

### Step 2: Classify the Industry

Match to an industry ontology template (`sentura/config/industry-ontologies/`):

- `financial-services` — banking, lending, fintech, wealth, insurance, compliance-heavy finance
- `e-commerce` — online retail, D2C, marketplaces, consumer subscription
- (future) `healthcare`, `saas`, `manufacturing`, etc.

If multiple templates apply (e.g., "an AP clerk at an e-commerce company"): BOTH templates will be merged into the agent's `ekg/`, with industry-specific compliance taking precedence on conflict.

If NO template applies: proceed without one — Phase 2 will note this and use generic defaults. Flag for platform admin to consider adding a new template.

### Step 3: Ask Targeted Clarifying Questions

Always ask; never assume. Structure as a numbered list so the user can answer inline.

Core questions every role needs:

```
1. What systems does this role need to access? (e.g., NetSuite, Salesforce, Slack)
2. Which channels should this employee operate on? (Slack DM, Slack channels, email, Teams, webchat?)
3. Who does this role escalate to — specifically (name, title, email) — and at what triggers?
4. What approval thresholds apply? (e.g., max refund without manager approval, max payment)
5. What should this employee NEVER do? List any hard prohibitions.
6. Tone preference? (Formal / casual / technical / empathetic — or match an existing team style)
7. Should this be a draft-only employee initially, or fully empowered to execute actions?
```

Role-specific follow-ups:
- **Finance/AP/AR**: "What currencies are in scope?", "What's the month-end close day?", "Does this role handle international wires?"
- **Customer Support**: "What's the first-response SLA?", "Tier model (L1/L2/L3)?", "Refund auto-approval cap?"
- **Sales/SDR**: "What data sources can this employee email? (opt-in lists, purchased data, inbound only)", "Email sending authority (draft only vs auto-send)?"
- **HR/Recruiting**: "What ATS? Background check provider? Compliance framework (EEOC, OFCCP)?"
- **Marketing**: "Brand guidelines location? Approval path for publication?"

### Step 4: Research Best Practices

Using `web_search` and `web_fetch`:

1. Search for "`{role} day-to-day responsibilities`" — catalog typical daily tasks.
2. Search for "`{role} KPIs`" — note measurable outcomes.
3. Search for "`{role} common mistakes`" — these become Hard Rules entries in the employee's `AGENTS.md`.
4. If industry-specific: search for `{industry} {role}` to catch industry quirks.
5. Read 2-3 authoritative sources (LinkedIn Learning, Gartner, industry associations, academic papers). Prefer primary sources.

Record findings as a brief; do NOT dump raw search results to the user.

### Step 5: Memory Search

Use `sessions_history` or workspace-level memory search to find similar past incubations:

1. Search for role category keywords in past memory.
2. Review what worked — reuse proven patterns.
3. Review what failed — extract lessons (e.g., "last AP clerk needed explicit rule about duplicate PO numbers").

### Step 6: Assemble the Discovery Brief

Write (in memory, not to disk) a structured summary:

```
## Discovery Brief

### Role Summary
- Job title: ...
- Department: ...
- Industry template(s) to apply: ...

### Core Responsibilities (from user + research)
- ...

### Integrations Required
- {System}: {MCP server name or "needs provisioning"}

### Channels
- {channel}: {scope — DMs, channel #x, etc.}

### Reporting & Escalation
- Escalates to: {name, title, email}
- Approval thresholds: {...}

### Hard Prohibitions (from user)
- ...

### Open Questions Requiring User Answer
- ...
```

### Step 7: Confirm with User

Present the Discovery Brief. Explicitly ask: **"Before I generate the employee, please confirm or correct any of the above."** Only proceed when user confirms or corrects.

If the user says "just do it" without confirmation: push back once, explaining that 2 minutes of confirmation now saves 2 hours of corrections later.

## Tools Needed

- `web_search` — discover role best practices, industry patterns
- `web_fetch` — read authoritative articles
- `fs_read` — scan templates, industry ontologies, past workspace files
- `sessions_history` — learn from past incubations
- `sessions_send` — communicate with the requesting user

## Safety

- NEVER skip the clarifying questions step, even if the user seems sure
- NEVER commit to an industry template match without confirmation
- NEVER start generating workspace files before Discovery is confirmed
- ALWAYS record sources in the brief (source = X URL, retrieved on Y date)
- ALWAYS flag ambiguities explicitly (don't paper over them)
- ALWAYS ask explicitly about hard prohibitions — these become Hard Rules entries in `AGENTS.md`
