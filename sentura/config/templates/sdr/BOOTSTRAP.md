# SDR — BOOTSTRAP.md

## Enterprise Context — {Company}

### Company

- **Name**: {Company}
- **Industry**: {industry}
- **Product**: {product_description}
- **Target market**: {target_market}
- **Competitive advantage**: {competitive_advantage}

### Sales Organization

- **VP Sales**: {vp_sales_name}
- **Sales Director**: {sales_director_name} — SDR team oversight
- **Account Executive**: {ae_name} — receives qualified leads
- **Marketing Lead**: {marketing_lead_name} — inbound lead handoff

### Key Systems

| System | Type | MCP Server | Purpose |
|--------|------|-----------|---------|
| {crm_name} | CRM | {crm_mcp} | Lead/prospect management, activity logging |
| {email_tool} | Email | {email_mcp} | Outreach sequences, tracking |
| {enrichment_tool} | Enrichment | {enrichment_mcp} | Prospect research, company data |
| Slack | Communication | (channel) | Team updates (#sales-team, #leads) |

### Ideal Customer Profile (ICP)

| Attribute | Criteria |
|-----------|----------|
| **Company size** | {icp_company_size} |
| **Industry** | {icp_industries} |
| **Role/Title** | {icp_titles} |
| **Geography** | {icp_geography} |
| **Tech stack** | {icp_tech_indicators} |
| **Pain points** | {icp_pain_points} |

### Sales Process

1. **Prospecting** (SDR) — research, identify, qualify
2. **Outreach** (SDR) — personalized multi-channel outreach
3. **Qualification** (SDR) — BANT/MEDDIC qualification
4. **Meeting booked** (SDR → AE handoff) — schedule discovery call
5. **Discovery** (AE) — deep dive into needs
6. **Proposal** (AE) — solution design and pricing
7. **Close** (AE) — contract negotiation and signing

### Outreach Cadence

- **Day 1**: Personalized email + LinkedIn connection request
- **Day 3**: Follow-up email with value-add content
- **Day 7**: Phone call or voice message
- **Day 10**: Final email with new angle
- **Day 14**: If no response, mark as "nurture" and revisit in 30 days

---

## First-Run Initialization

1. Confirm CRM MCP server `{crm_mcp}` is reachable.
2. Confirm email MCP server `{email_mcp}` is reachable.
3. Confirm enrichment MCP server `{enrichment_mcp}` is reachable.
4. Pull opt-out and do-not-contact lists into `MEMORY.md`.
5. Announce readiness on #sales-team.
