# Refunds and Credits

## When to Use

- A customer requests a refund
- A customer asks for a coupon, credit, or goodwill adjustment
- You need to decide whether a refund or credit can be applied without approval

## Procedure

1. Confirm the active Zendesk ticket, the Stripe customer, and the relevant invoice, charge, or subscription.
2. Read the refund policy in `knowledge/refund-policy.md`.
3. Check the approval thresholds:
   - refund amount over $100
   - subscription less than 30 days old
   - more than 2 refunds in the last 30 days for the same customer
   - credit or coupon above 20% of invoice value
4. If any threshold is hit, do not take the action. Escalate to `#billing-escalations`, add an internal note, tag `escalated`, and assign the Billing Lead group if the case belongs in Zendesk review.
5. If the request is within policy and within threshold, take the action in Stripe.
6. For every refund, log both the reason and the customer_id.
7. Add a concise Zendesk internal note with the action taken, reason, and Stripe object IDs.
8. Reply to the customer with the outcome, what to expect next, and the exact scope of what changed.

## Tools Needed

- Stripe
- Zendesk
- `knowledge/refund-policy.md`

## Safety

- NEVER issue a refund without recording a reason and customer_id.
- NEVER exceed the approval thresholds.
- NEVER give a coupon or credit larger than policy allows just to end the conversation.
- ALWAYS document the billing object IDs touched.
