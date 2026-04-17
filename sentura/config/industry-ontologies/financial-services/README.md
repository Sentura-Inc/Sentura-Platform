# Financial Services Industry Ontology

Template ontology for AI employees in banks, lending institutions, payment processors, wealth management, insurance, and compliance-heavy financial operations.

## What's Included

### `org/` — Organization Pillar
- Standard finance-industry roles (CFO, Controller, Compliance Officer, BSA Officer, Treasurer, Internal Auditor)
- Regulatory reporting chains (Risk → Compliance → Board)
- Segregation-of-duties matrix

### `rules/` — Rules & Policies Pillar
- Dual-approval thresholds (payments, journal entries, customer credits)
- SOX controls (financial reporting accuracy, audit trails)
- AML/KYC requirements (customer identification, transaction monitoring, SAR triggers)
- PCI-DSS data handling (cardholder data scope limits)
- GLBA customer data protection
- Regulator reporting deadlines (SEC, FINRA, FinCEN, OCC, CFPB)

### `assets/` — Assets Pillar
- Common core-banking system references (SWIFT, ACH, FedWire, Plaid)
- Risk data sources (Experian, Equifax, TransUnion, Dun & Bradstreet, OFAC SDN list)
- Financial data warehouses (patterns, not connections)

### `workflows/` — Workflows Pillar
- Invoice intake & 3-way match SOP
- Wire transfer approval workflow
- Customer due diligence (CDD) procedure
- Adverse media screening procedure
- SAR (Suspicious Activity Report) filing workflow
- Month-end close checklist

## Placeholder Convention

Values to be substituted at incubation time use `{placeholder}` form:

- `{company_name}` — enterprise legal name
- `{regulator_primary}` — primary regulator (e.g., "OCC", "SEC", "FINRA")
- `{compliance_contact}` — compliance officer email
- `{cfo_contact}` — CFO email
- `{risk_tolerance}` — "conservative" | "moderate" | "aggressive"
- `{reporting_currency}` — e.g., "USD"
- `{max_auto_payment}` — auto-approval payment ceiling in reporting currency
- `{max_auto_refund}` — auto-approval refund ceiling
- `{month_end_day}` — day of month when books close (typically 28-31)

## How It's Used

The Creator Agent merges this ontology into a new agent's `ekg/` directory during Phase 2 (Design). The additive-only merge semantics defined in `sentura/config/ekg-schema.json5` apply.

To select this ontology at incubation time, the user specifies:

```
industry: financial-services
```

...or the Creator Agent auto-selects based on clarification responses indicating the role involves financial reporting, payments, compliance reporting, or customer financial data.

## Compliance Note

This template encodes widely applicable US-centric financial-services patterns. It is NOT a substitute for jurisdiction-specific legal review. Enterprises operating in EU (GDPR/DORA/PSD2), UK (FCA), APAC, or other jurisdictions must have Compliance review and extend this ontology before production deployment.
