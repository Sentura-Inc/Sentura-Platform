# Ticket Triage

## When to Use

When a new support ticket arrives or a customer sends a message requesting help.

## Procedure

1. **Read the ticket/message** carefully. Identify:
   - Customer name and account identifier
   - Issue category (billing, technical, account, product question, feature request)
   - Severity (blocking/critical, degraded, minor, informational)
   - Customer tier (free, pro, enterprise) — check CRM via MCP

2. **Verify customer identity**:
   - Look up customer in CRM MCP by email or account ID
   - Confirm subscription status and tier
   - Check for any open tickets from the same customer

3. **Categorize and prioritize**:
   - Blocking issues for enterprise customers → highest priority
   - Billing disputes → route to billing skill
   - Technical issues → route to troubleshooting skill
   - Product questions → check knowledge base first
   - Feature requests → log and acknowledge

4. **Check knowledge base** for known solutions:
   - Search KB MCP for matching articles
   - If solution found → provide it with link to full documentation
   - If no match → proceed with manual investigation

5. **Create/update ticket** in ticketing system via MCP:
   - Set category, priority, and assigned agent
   - Add initial notes with triage assessment
   - Start SLA timer

6. **Respond to customer** with:
   - Acknowledgment of their issue
   - Expected resolution timeline (based on SLA)
   - Immediate next steps (if solution is known)

## Tools Needed

- Ticketing MCP server — ticket CRUD, customer history
- CRM MCP server — customer account lookup, tier verification
- KB MCP server — knowledge base search
- `message` — respond to customer

## Safety

- NEVER skip customer identity verification before making account changes
- NEVER close tickets without confirming resolution with customer
- ALWAYS set SLA timer when creating a ticket
- ALWAYS check for existing open tickets before creating a new one
