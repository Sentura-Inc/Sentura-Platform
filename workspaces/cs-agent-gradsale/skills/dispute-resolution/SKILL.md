# Dispute Resolution

## When to Use

When a dispute is filed between a buyer and seller on GradSale, or when a support thread involves a buyer-seller conflict about a transaction.

## Procedure

1. **Review the dispute** via `gradsale-admin` MCP:
   - `GET /api/admin/disputes/:id` for full dispute details
   - Identify: buyer, seller, transaction, claimed issue, amount, evidence submitted
   - Check dispute status (pending, investigating, resolved)

2. **Review the transaction** via admin API:
   - `GET /api/admin/transactions/:transactionId` for payment details
   - Verify transaction amount, date, and status
   - Check if payment was completed, pending, or refunded

3. **Review both parties**:
   - Look up buyer profile: account age, previous disputes, ratings
   - Look up seller profile: account age, previous disputes, ratings, listing history
   - Check message history between buyer and seller (via `gradsale-web` MCP if available)

4. **Gather evidence** (if not already submitted):
   - Update dispute status to `investigating` via `PATCH /api/admin/disputes/:id`
   - If evidence is missing from either party, reply to the support thread requesting:
     - Photos of item received (if "not as described")
     - Shipping/tracking proof (if "not received")
     - Screenshots of listing description
   - Allow 72 hours for evidence submission

5. **Evaluate the dispute**:
   - **Item not received**: Check tracking info. If no proof of delivery after 14 days → full refund to buyer
   - **Not as described**: Compare listing photos/description with buyer's evidence. If substantial difference → partial or full refund
   - **Damaged in shipping**: If seller packed adequately → seller not at fault; if poor packaging → seller liable
   - **Buyer's remorse**: No refund (marketplace policy)
   - **Fraudulent listing**: Full refund + escalate seller to Admin Team for account action

6. **Determine resolution**:
   - Refund amount (if any): ≤ $200 → process directly; > $200 → escalate to Support Lead
   - Account action (if any): Warning, temporary suspension, permanent ban → escalate to Admin Team
   - Both parties must be notified of the decision with reasoning

7. **Execute resolution**:
   - Update dispute status to `resolved` via admin API
   - Add resolution notes to the dispute record
   - Process refund if applicable (via admin API → Stripe)
   - Notify buyer with resolution details
   - Notify seller with resolution details

8. **Follow up**:
   - Check that refund was processed (if applicable)
   - Update the support thread status to `resolved`
   - Log the resolution for future reference

## Tools Needed

- `gradsale-admin` MCP — dispute CRUD, transaction details, user verification
- `gradsale-web` MCP — user profiles, listing details, message history
- `message` — notify both parties

## Safety

- NEVER reveal one party's private information to the other
- NEVER issue refunds above $200 without Support Lead approval
- NEVER take sides before reviewing evidence from both parties
- NEVER close a dispute without notifying both buyer and seller
- ALWAYS give both parties the 72-hour evidence window
- ALWAYS document the reasoning behind the resolution decision
- ALWAYS escalate fraud cases to the Admin Team
