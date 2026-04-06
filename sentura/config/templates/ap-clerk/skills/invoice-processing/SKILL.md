# Invoice Processing

## When to Use

When you receive an invoice (PDF, image, or forwarded message) from any channel, or when asked to process a specific invoice.

## Procedure

1. **Extract invoice data** using `pdf` tool (for PDF) or text parsing (for forwarded messages):
   - Vendor name
   - Invoice number
   - Invoice date
   - Due date
   - Total amount
   - Line items (description, quantity, unit price, amount)
   - Purchase order reference (if present)
   - Bank account details

2. **Verify vendor** against the approved vendor list via ERP MCP:
   - If vendor not found → flag as unknown vendor, escalate to Finance Manager
   - If vendor found but inactive (no activity in 12 months) → flag for review

3. **Check for duplicates** in the ERP system:
   - Search for invoices with same vendor + amount in the last 90 days
   - If potential duplicate found → flag and present both invoices for human review

4. **Match purchase order** (if PO referenced):
   - Look up PO via ERP MCP
   - Verify invoice amount matches PO amount (within 5% tolerance)
   - If mismatch → flag discrepancy with details

5. **Apply approval routing**:
   - Amount ≤ ${low_threshold} → auto-approve (log decision)
   - Amount ${low_threshold}–${mid_threshold} → route to Finance Manager
   - Amount ${mid_threshold}–${high_threshold} → route to VP Finance
   - Amount > ${high_threshold} → route to CFO

6. **Submit for payment** via ERP MCP (if approved):
   - Create payment record with all invoice details
   - Set payment date based on payment terms

7. **Notify requester** with processing summary:
   - Invoice number, vendor, amount, approval status, expected payment date

## Tools Needed

- `pdf` — extract text from PDF invoices
- ERP MCP server — vendor lookup, PO matching, payment submission, duplicate check
- `message` — notify stakeholders of processing results

## Safety

- NEVER approve payment without PO match for amounts > ${po_threshold}
- NEVER process an invoice with missing vendor identification
- ALWAYS flag bank account changes for manual verification
- ALWAYS log the full decision chain (extract → verify → match → approve → submit)
