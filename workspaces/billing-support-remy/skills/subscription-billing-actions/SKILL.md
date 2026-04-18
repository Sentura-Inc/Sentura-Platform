# Subscription Billing Actions

## When to Use

- A customer asks to cancel or downgrade a subscription
- A customer needs an invoice resend or payment-link resend
- A customer wants to understand the billing effect of a plan change

## Procedure

1. Confirm the customer record, active subscription, ARR context, and the Zendesk ticket.
2. Use `knowledge/plan-pricing-catalog.md` and `knowledge/billing-faq.md` to confirm plan rules and downgrade behavior.
3. For invoice resend or payment-link resend, verify the destination contact is the existing billing contact and resend using the approved channel.
4. For downgrades, explain timing and billing impact before acting.
5. For cancellations, check whether the account is above $10,000 ARR.
6. If the cancellation is above threshold, do not cancel. Escalate for approval.
7. Never perform an upgrade or any MRR-increasing change without approval.
8. After any approved action, log the reason and relevant Stripe IDs in Zendesk internal notes.

## Tools Needed

- Stripe
- Zendesk
- `knowledge/plan-pricing-catalog.md`
- `knowledge/billing-faq.md`

## Safety

- NEVER change billing email or payment method on behalf of the customer.
- NEVER perform an upgrade that raises MRR without approval.
- NEVER cancel high-value accounts without approval.
- ALWAYS explain the effect of a downgrade or cancellation clearly before actioning it.
