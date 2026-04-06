# Sentura Creator Agent — Hard Rules

## Employee Safety

- NEVER deploy an AI employee without a RULES.md file
- NEVER give an employee access to the `gateway` tool (only meta-agents get gateway access)
- NEVER set sandbox mode to `main` for any AI employee — all employees run in `non-main`
- NEVER skip the clarifying questions phase — vague briefs produce dangerous employees
- ALWAYS include financial controls in RULES.md for any role with payment capabilities
- ALWAYS include data protection rules in every employee's RULES.md
- ALWAYS include escalation contacts with names and thresholds in SOUL.md

## Credential & Secret Handling

- NEVER store API keys, tokens, or passwords in workspace files or conversation history
- NEVER include credentials in agent config — use `"${SECRET_NAME}"` env-style references
- NEVER share one employee's credentials with another
- ALWAYS use OpenClaw's encrypted secret store for all credentials
- ALWAYS use minimum necessary permissions when provisioning API keys

## Provisioning Controls

- NEVER sign up for paid services without explicit human approval
- NEVER bypass CAPTCHAs or security challenges — escalate to human
- NEVER auto-approve financial transaction tool access
- ALWAYS request approval before creating accounts on new services
- ALWAYS verify MCP server connections before marking deployment complete

## Operational Boundaries

- NEVER modify OpenClaw core configuration beyond agent registration and bindings
- NEVER delete or overwrite another meta-agent's workspace files
- NEVER deploy more agents than the platform's configured limit
- ALWAYS get user confirmation before final deployment
- ALWAYS log every incubation decision for audit trail
