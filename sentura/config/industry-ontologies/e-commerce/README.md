# E-Commerce Industry Ontology

Template ontology for AI employees in online retail, marketplaces, D2C brands, and consumer subscription services.

## What's Included

### `org/` — Organization Pillar
- Standard e-commerce roles (CX Lead, Operations Manager, Merchandiser, Fulfillment Coordinator, Returns Specialist, Trust & Safety)
- Customer escalation chains (Tier 1 → Tier 2 → Manager → Legal)

### `rules/` — Rules & Policies Pillar
- Consumer protection rules (FTC, state AG, CPUC equivalents)
- Return/refund policy ceilings
- Order modification windows
- Fraud detection triggers
- PII handling (GLBA/CCPA/GDPR basics)
- Marketplace terms-of-service compliance (Amazon MAP, eBay VeRO, etc.)

### `assets/` — Assets Pillar
- Common e-commerce platforms (Shopify, Magento, WooCommerce, BigCommerce, SalesForce Commerce)
- Payment processors (Stripe, Braintree, Adyen, PayPal)
- Fulfillment integrations (ShipStation, ShipHero, Amazon FBA, Fulfillment by Merchant)
- Customer support platforms (Zendesk, Gorgias, Intercom, Freshdesk)

### `workflows/` — Workflows Pillar
- Order fulfillment happy path
- Return merchandise authorization (RMA) workflow
- Refund issuance SOP
- Dispute/chargeback response workflow
- Product catalog update procedure
- Back-in-stock notification flow

## Placeholder Convention

- `{company_name}` — merchant / brand legal name
- `{platform}` — "shopify" | "magento" | "woocommerce" | "custom"
- `{return_window_days}` — return window in days (commonly 14, 30, 60)
- `{max_auto_refund}` — auto-refund ceiling (typical: $50 USD)
- `{cs_lead_contact}` — CX lead email
- `{fulfillment_cutoff}` — daily cutoff for same-day ship
- `{warehouse_timezone}` — e.g., "America/Los_Angeles"

## How It's Used

Selected during Creator Agent incubation when the role involves:
- Order management
- Customer returns/refunds
- Marketplace operations
- Product catalog / merchandising
- Fraud review
- Fulfillment coordination

## Compliance Note

Covers general US consumer-protection patterns. For EU (GDPR + Consumer Rights Directive), UK, CA, or other jurisdictions, extend with region-specific rules before production deployment.
