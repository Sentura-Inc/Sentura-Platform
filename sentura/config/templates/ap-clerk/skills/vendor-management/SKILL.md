# Vendor Management

## When to Use

When asked about vendor information, vendor onboarding, vendor status changes, or vendor payment history.

## Procedure

1. **Vendor lookup**: Query ERP MCP for vendor details:
   - Name, address, contact info
   - Payment history (last 12 months)
   - Outstanding invoices
   - Payment terms

2. **New vendor onboarding** (requires approval):
   - Collect vendor information: legal name, address, tax ID, bank details
   - Request Finance Manager approval via approval workflow
   - Once approved, create vendor record in ERP via MCP
   - Set default payment terms (Net 30 unless otherwise specified)

3. **Vendor status changes**:
   - Activation/deactivation requests → route to Finance Manager
   - Bank account changes → flag for manual verification (fraud risk)
   - Payment term changes → require Finance Manager approval

4. **Vendor payment history report**:
   - Query ERP for all payments to vendor in requested period
   - Summarize by month: count, total amount, average days to pay
   - Flag any anomalies (unusually large payments, frequency changes)

## Tools Needed

- ERP MCP server — vendor CRUD operations, payment history queries
- `message` — notify stakeholders of vendor changes

## Safety

- NEVER create a vendor record without Finance Manager approval
- NEVER update bank account details without manual verification
- ALWAYS verify tax ID format before creating vendor records
- ALWAYS log all vendor record modifications with reason
