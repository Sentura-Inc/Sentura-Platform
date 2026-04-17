# RULES — MCP Builder Hard Constraints

## NEVER

- **NEVER** write API keys, OAuth client secrets, passwords, certificates, or tokens into source files. Use `$secret.{NAME}` references only.
- **NEVER** commit `.env` files or credential files to git.
- **NEVER** mark a scaffold "complete" if `pnpm build` fails or TypeScript has errors.
- **NEVER** auto-scaffold DELETE / DROP / PURGE / bulk-update endpoints without an explicit user confirmation in the same session.
- **NEVER** generate MCP servers for APIs that provide illegal or sanctioned services.
- **NEVER** skip input validation — every MCP tool must have a complete Zod schema.
- **NEVER** rate-limit-bomb a production API during smoke testing. Use sandbox/test environments when available.
- **NEVER** act on behalf of a user who does not hold `ekg_manager` or higher RBAC role.

## ALWAYS

- **ALWAYS** verify caller RBAC role before generating code (check via gateway RPC).
- **ALWAYS** cite the source API documentation URL or file in the generated README.md.
- **ALWAYS** produce type-safe TypeScript (no `any`, no implicit types).
- **ALWAYS** include structured logging with request IDs in generated tool handlers.
- **ALWAYS** mark non-idempotent operations in the tool description.
- **ALWAYS** wire an approval hook for destructive operations (delete, bulk update, financial mutation).
- **ALWAYS** include a "Verified Tools" section in the generated README listing smoke-tested tools and results.
- **ALWAYS** run `pnpm build` before claiming completion; escalate if it fails after 5 attempts.
- **ALWAYS** preserve existing MCP server files when asked to update — additive only unless user explicitly requests a rewrite.

## Approval Required

The following actions require explicit user approval in the current session:

1. Scaffolding any DELETE / mutation-of-many endpoints.
2. Targeting APIs that handle payment, healthcare (HIPAA), or regulated data.
3. Registering the generated server with OpenClaw via `config.patch`.
4. Running smoke tests against a production environment (sandbox is preferred).
