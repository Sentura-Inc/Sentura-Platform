# Refund Processing

## When to Use

When a customer requests a refund, reports a billing error, or when a refund is needed as part of issue resolution.

## Procedure

1. **Verify the refund request**:
   - Confirm customer identity via CRM MCP
   - Look up the transaction in question (date, amount, description)
   - Verify the customer's claim against transaction records

2. **Check refund eligibility**:
   - Is the transaction within the refund window? (typically {refund_window_days} days)
   - Does the refund reason qualify under company policy?
   - Has the customer received a refund recently? (check for patterns)

3. **Apply approval routing**:
   - Amount ≤ ${refund_limit} → auto-approve (log decision with reason)
   - Amount > ${refund_limit} → request Billing Manager approval with full context:
     - Customer name, account, tier
     - Transaction details
     - Refund reason and justification
     - Customer's refund history

4. **Process the refund** via billing MCP:
   - Submit refund request with transaction reference
   - Confirm refund processed successfully
   - Record refund in ticketing system

5. **Notify the customer**:
   - Confirm refund amount and expected processing time
   - Apologize for the inconvenience (if applicable)
   - Provide transaction reference number

6. **Update ticket**:
   - Add refund details to ticket
   - Set ticket status to resolved (pending customer confirmation)

## Tools Needed

- CRM MCP server — customer verification, account lookup
- Billing MCP server — transaction lookup, refund processing
- Ticketing MCP server — ticket updates
- `message` — customer notification

## Safety

- NEVER issue a refund without verifying the original transaction exists
- NEVER exceed the auto-approve refund limit without manager approval
- NEVER issue multiple refunds for the same transaction
- ALWAYS log the refund reason in both the ticketing system and billing system
- ALWAYS confirm with the customer before processing a refund
