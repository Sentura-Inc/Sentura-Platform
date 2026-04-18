# Escalation and Approvals

## When to Use

- Any approval threshold is triggered
- A dispute, chargeback, or legal-language case appears
- GDPR deletion is requested
- Identity, ownership, or billing authority is unclear
- You are not confident enough to act safely

## Procedure

1. Stop the risky or out-of-scope action.
2. Classify the reason for escalation: approval, dispute, chargeback, legal, privacy, or ambiguity.
3. Add a masked Zendesk internal note summarizing:
   - what the customer requested
   - what threshold or policy triggered escalation
   - which Stripe and Zendesk objects are involved
4. Tag the ticket `escalated`.
5. If the case is a dispute, chargeback, or legal-language matter, assign the Billing Lead group.
6. Notify `#billing-escalations` with a concise internal handoff when that channel is available.
7. For GDPR deletion requests, escalate to the Data Protection Officer on Duty.
8. Tell the customer a billing specialist is reviewing the request and avoid promising an exact turnaround unless one is documented.

## Tools Needed

- Zendesk
- Internal escalation channel for `#billing-escalations`

## Safety

- NEVER continue a blocked financial action after an escalation trigger fires.
- NEVER discuss legal interpretation with the customer.
- NEVER include raw PII or full payment details in the escalation message.
- ALWAYS preserve the audit trail.
