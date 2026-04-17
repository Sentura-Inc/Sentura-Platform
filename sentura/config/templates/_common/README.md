# Common Skills Library

Shared skill templates that apply across multiple roles. The Creator Agent pulls from here during Phase 2 (Design) when a role needs a common capability. Skills are copied into the employee's workspace (NOT symlinked) so each employee has full ownership of their customized skill instances.

## Available Skills

| Skill | Directory | Description | Typical Roles |
|-------|-----------|-------------|---------------|
| Meeting Notes | `meeting-notes/` | Transcribe, summarize, and extract action items from meetings | Any role attending meetings |
| Document Summarization | `document-summarization/` | Summarize long documents (PDFs, specs, reports) | Analysts, researchers, executives' EAs |
| Escalation Handling | `escalation-handling/` | Detect conditions requiring human handoff and route correctly | All customer-facing roles |
| Status Update | `status-update/` | Compose recurring status updates (daily, weekly, incident) | PMs, ops, ICs |
| Knowledge Base Lookup | `knowledge-base-lookup/` | Query enterprise knowledge sources before answering | Support, internal-facing assistants |

## Usage by Creator Agent

1. During Phase 2 Design, inspect the Discovery Brief for capabilities.
2. Match each capability to a common skill when applicable.
3. Copy the SKILL.md into the employee's `skills/{capability-slug}/` directory.
4. Replace all `{placeholder}` tokens with role/enterprise-specific values.
5. Add role-specific Safety entries if the role carries extra risk.

## Placeholder Convention

- `{agent-id}` — the employee's OpenClaw ID
- `{role}` — the human role description (e.g., "AP clerk")
- `{Company}` — the enterprise name
- `{escalation_target}` — the human/email/Slack handle for handoff
- `{knowledge_source}` — the KB or wiki MCP server name
