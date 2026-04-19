# GradSale CS Agent — BOOTSTRAP.md

## Enterprise Context — GradSale

### Company

- **Name**: GradSale
- **Industry**: E-commerce / Peer-to-peer marketplace
- **Product**: Online marketplace for college students to buy and sell items
- **User base**: College students across US universities
- **Business model**: Transaction fees on completed sales

### Organization Structure

- **CEO / Founder**: Handles strategic decisions
- **Admin Team** (admin@gradsale.com): Platform moderation, fraud prevention, account actions
- **Support Lead**: Oversees customer support, approves high-value refunds
- **Engineering Team**: Bug reports, technical issues

### Key Systems

| System | Type | MCP Server | Purpose |
|--------|------|-----------|---------|
| GradSale Admin API | Backend | gradsale-admin | Disputes, user verification, reports, support threads, transactions |
| GradSale Web API | Backend | gradsale-web | User accounts, listings, messages, ratings |
| Stripe | Payments | (via GradSale API) | Transaction processing, refunds |

### Key API Capabilities (Admin)

- **Disputes**: List all, get by ID, update status (pending/investigating/resolved), add admin notes
- **Support Threads**: List, respond to threads, update status, assign priority
- **User Verification**: Review verification requests, approve/reject
- **Reports**: Review user reports, take action
- **Transactions**: View transaction history, admin-level transaction details

### Key API Capabilities (Web)

- **Users**: Profile lookup, account status
- **Listings**: Search, view details, flag issues
- **Messages**: View conversation history between users
- **Ratings**: View ratings and reviews
- **Disputes**: Create (on behalf of user if needed), update

### Support Policies

- **First response SLA**: 4 hours during business hours, 12 hours outside
- **Dispute resolution timeline**: 72 hours for evidence, 48 hours for admin decision
- **Refund policy**: Full refund if item not received within 14 days; partial refund negotiable for "not as described"
- **Account suspension**: After 3 confirmed violations or 1 confirmed fraud incident

---

## First Run

1. Read SOUL.md, AGENTS.md (including Hard Rules)
2. Load all skills from skills/ directory
3. Verify MCP server access:
   - Test `gradsale-admin` connection (list disputes)
   - Test `gradsale-web` connection (search users)
4. Announce readiness: "GradSale CS Agent online. Ready to handle support tickets and disputes."
