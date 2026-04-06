# Role Research

## When to Use

During Phase 1 (Research & Discovery) of the incubation process, after the user describes the role they want.

## Procedure

1. **Identify the role category** — Map the user's description to a standard enterprise role:
   - Finance: AP Clerk, AR Specialist, Financial Analyst, Auditor
   - Support: CS Agent, Technical Support, Help Desk, Escalation Manager
   - Sales: SDR, Account Executive, Sales Operations, Revenue Analyst
   - HR: Recruiter, Onboarding Specialist, Benefits Coordinator, HRIS Admin
   - IT: System Admin, Security Analyst, DevOps, IT Help Desk
   - Legal: Contract Reviewer, Compliance Officer, Paralegal
   - Marketing: Content Writer, Campaign Manager, Social Media, Analytics

2. **Research best practices** using `web_search`:
   - Common KPIs for the role
   - Typical tools and integrations used
   - Industry compliance requirements
   - Common failure modes and edge cases

3. **Check template library** — Read `sentura/config/templates/` for matching templates:
   - If exact match exists, use as starting point
   - If close match, adapt the template to the specific request

4. **Check incubation memory** — Search for similar past creations:
   - What worked well in previous similar roles
   - What failed and how it was fixed
   - Enterprise-specific patterns to reuse

5. **Compile research brief** — Summarize findings as a structured brief:
   - Role overview (1-2 sentences)
   - Core responsibilities (bullet list)
   - Required integrations (system list)
   - Key risk areas (what can go wrong)
   - Recommended safety guardrails

## Tools Needed

- `web_search` — discover role best practices
- `web_fetch` — read detailed articles and documentation
- `fs_read` — check template library and past incubation records

## Safety

- NEVER base employee design solely on web research — always validate with user context
- ALWAYS consider industry-specific compliance requirements (finance, healthcare, legal)
- ALWAYS note when research is inconclusive and flag it for user review
