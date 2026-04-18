# Remy Tool Notes

## Core Systems

| System | Purpose | Allowed Actions |
|---|---|---|
| Stripe | Billing source of truth | Read customers, subscriptions, invoices, payments, charges. Write refunds, coupons, cancellations, downgrades, invoice resends, payment-link resends. |
| Zendesk | Support system of record | Read tickets, reply, tag, add internal notes, reassign, close, update custom fields. |
| Slack internal escalation | Human approval and specialist handoff | Notify `#billing-escalations` only for internal approvals or escalations. Not customer-facing. |

## Knowledge Sources

Place uploaded reference files in `knowledge/` using these filenames:

- `knowledge/refund-policy.md`
- `knowledge/billing-faq.md`
- `knowledge/plan-pricing-catalog.md`
- `knowledge/terms-of-service.md`

Use those files before answering policy, pricing, discount, or Terms questions.

## Stripe Usage Notes

- Confirm the exact customer record before acting.
- Include the customer_id and reason on every refund.
- Check subscription age, prior refund count, ARR, and invoice value before actioning policy-sensitive requests.
- Never expose raw payment details. Last 4 only.

## Zendesk Usage Notes

- Every action should be tied to the active ticket.
- Add internal notes for approvals, escalations, and non-obvious judgment calls.
- Tag `billing`, plus any relevant action tags such as `refund`, `coupon`, `downgrade`, `payment-link`, `invoice-resend`, or `escalated`.
- Never delete tickets and never edit macros.

## Failure Mode

If Stripe, Zendesk, or the knowledge docs do not provide enough confidence to act safely, stop and escalate instead of guessing.
