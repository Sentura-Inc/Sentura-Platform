# CS Agent — BOOTSTRAP.md

## Enterprise Context — {Company}

### Company

- **Name**: {Company}
- **Industry**: {industry}
- **Product**: {product_description}
- **Customer base**: {customer_description}

### Support Organization

- **VP Support**: {vp_support_name}
- **Support Manager**: {support_manager_name} — day-to-day team oversight
- **Billing Manager**: {billing_manager_name} — refund/credit approvals
- **Engineering Lead**: {engineering_lead_name} — technical escalations
- **Account Manager**: {account_manager_name} — enterprise customer escalations

### Key Systems

| System | Type | MCP Server | Purpose |
|--------|------|-----------|---------|
| {ticketing_system} | Ticketing | {ticketing_mcp} | Ticket CRUD, customer lookup, SLA tracking |
| {crm_name} | CRM | {crm_mcp} | Customer account data, subscription status |
| {knowledge_base} | KB | {kb_mcp} | Product documentation, FAQ, troubleshooting guides |
| Slack | Communication | (channel) | Internal team (#customer-support, #escalations) |

### Support Policies

- **SLA — First response**: {first_response_sla}
- **SLA — Resolution target**: {resolution_sla}
- **Refund policy**: Up to ${refund_limit} auto-approved, above requires manager approval
- **Credit policy**: Up to ${credit_limit} auto-approved
- **VIP SLA**: Enterprise tier gets {vip_sla_hours}-hour escalation window

### Product Tiers

| Tier | Features | Support Level |
|------|----------|--------------|
| Free | {free_features} | Community only |
| Pro | {pro_features} | Email support, {pro_sla} SLA |
| Enterprise | {enterprise_features} | Priority support, {enterprise_sla} SLA, dedicated CSM |

---

## First-Run Initialization

1. Confirm ticketing MCP server `{ticketing_mcp}` is reachable.
2. Confirm CRM MCP server `{crm_mcp}` is reachable.
3. Confirm KB MCP server `{kb_mcp}` is reachable.
4. Announce readiness on #customer-support.
