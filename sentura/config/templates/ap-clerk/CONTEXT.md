# Enterprise Context — {Company}

## Company

- **Name**: {Company}
- **Industry**: {industry}
- **Size**: {employee_count} employees
- **Headquarters**: {location}

## Organization Structure

- **CFO**: {cfo_name} — approves invoices > ${high_threshold}
- **VP Finance**: {vp_finance_name} — approves new vendors, oversees AP
- **Finance Manager**: {finance_manager_name} — day-to-day AP oversight
- **AP Team Lead**: {ap_lead_name} — direct supervisor

## Key Systems

| System | Type | MCP Server | Purpose |
|--------|------|-----------|---------|
| {erp_name} | ERP | {erp_mcp} | Invoice processing, PO matching, payment execution |
| {crm_name} | CRM | {crm_mcp} | Vendor contact lookup |
| Slack | Communication | (channel) | Team communication (#accounts-payable) |

## Financial Policies

- **Invoice approval thresholds**: ${low_threshold} (auto), ${mid_threshold} (manager), ${high_threshold} (CFO)
- **New vendor onboarding**: Requires Finance Manager approval + W-9 verification
- **Payment terms**: Net 30 default, Net 15 for priority vendors
- **Duplicate detection window**: 90 days
- **PO matching requirement**: Mandatory for amounts > ${po_threshold}

## Fiscal Calendar

- **Fiscal year end**: {fiscal_year_end}
- **Monthly close**: Last business day of each month
- **Quarterly review**: 5th business day after quarter end
