# Domain Email Verification

## When to Use

Use when a target has website, domain, email, or a contact candidate from Marketing/Accio.

## Procedure

1. Normalize domain from website or email.
2. Call `cross-border-intel__cbe_intel_domain_rdap_lookup` for domain registration evidence.
3. If `enable_paid_validation=true` and no specific email was supplied, call `cross-border-intel__cbe_intel_official_contact_email_search` with the target `domain` and `website`.
   - Use only public official-site pages such as home, contact, about, support, sales, or wholesale.
   - Prefer same-domain business emails such as `sales@`, `wholesale@`, `support@`, or named employees on the target domain.
   - Do not use personal/free-provider emails found on third-party pages as paid validation targets unless the operator supplied them.
4. Call `cross-border-intel__cbe_intel_email_domain_check` with:
   - `email` when available,
   - the best same-domain public contact email found from the official website when paid validation is enabled,
   - `domain` when no email is available,
   - `enable_paid_validation=true` only when the operator enabled paid/optional validation.
   - Do not make more than one paid validation pass for the same target unless the retry request explicitly says a fresh paid lookup was approved.
5. If paid validation is enabled but no same-domain email is found, still run the domain-only DNS check and record `direct_contact_validation` as `pending_human_input`.
6. Interpret free-provider email carefully:
   - Free email plus verified company domain absent is a risk signal.
   - Free email alone is not fraud for small retailers.
7. Record MX, SPF, DMARC, RDAP status, free-provider flag, disposable-domain flag, role-inbox flag, discovered official-site email source URL, and paid validation provider results.

## Forced Downgrade Candidates

- Disposable email and no verifiable business domain.
- Domain younger than 90 days plus no registry/official source match.
- Website legal name conflicts with registry name without explanation.

## Safety

Never print raw API keys. Paid validation provider details must be summarized without exposing request URLs that contain keys.
