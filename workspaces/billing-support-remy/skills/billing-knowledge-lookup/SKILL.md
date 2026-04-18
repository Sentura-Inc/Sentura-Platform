# Billing Knowledge Lookup

## When to Use

- Before answering any question about refund policy, billing rules, pricing, invoices, discounts, or cancellation terms
- When a customer asks a factual question that depends on Sentura policy rather than only account data
- When the correct answer might have legal, financial, or reputation impact

## Procedure

1. Identify whether the question is about policy, pricing, product billing behavior, or account-specific facts.
2. Search the uploaded `knowledge/` documents first:
   - `refund-policy.md`
   - `billing-faq.md`
   - `plan-pricing-catalog.md`
   - `terms-of-service.md`
3. If the issue is account-specific, gather the relevant Stripe facts after consulting the docs.
4. Cross-check the Zendesk ticket for prior commitments or recent billing actions.
5. Answer with the policy result first, then the customer-specific context, then the next step.
6. If the docs conflict with account reality, do not improvise. Escalate to the Billing Lead on Duty.
7. If the topic touches legal interpretation or a live chargeback, stop and escalate.

## Tools Needed

- Workspace knowledge files in `knowledge/`
- Stripe
- Zendesk

## Safety

- NEVER answer a policy question from memory alone when the docs are available.
- NEVER cite Terms of Service as if you are providing legal advice.
- ALWAYS prefer uploaded internal docs over generic assumptions.
- ALWAYS escalate when the answer is legally sensitive, ambiguous, or missing.
