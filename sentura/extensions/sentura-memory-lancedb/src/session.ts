/**
 * Session-key parsing for sentura-memory-lancedb.
 *
 * Sentura session keys follow the format:
 *   `agent:<agentId>:user:<userToken>:<sessionId>`
 *
 * Non-Sentura session keys (e.g. raw OpenClaw CLI sessions) lack the
 * `:user:` segment — those are treated as "no user attached", which means
 * memory writes carry an empty userToken (global scope) and reads see only
 * global entries when `userTokenScope === "user-only"`.
 *
 * This helper is deliberately inlined inside the extension package so the
 * fork stays self-contained (matches the pattern of sentura-agents,
 * sentura-rbac, sentura-audit). The same parser lives in
 * `sentura/lib/user-token.ts` for setup-script and library use.
 */

const SESSION_KEY_PATTERN = /^agent:([^:]+):user:([^:]+):/;

export function extractUserTokenFromSessionKey(sessionKey: string | undefined | null): string {
  if (!sessionKey) return "";
  const match = SESSION_KEY_PATTERN.exec(sessionKey);
  return match?.[2] ?? "";
}

export function extractAgentIdFromSessionKey(sessionKey: string | undefined | null): string | null {
  if (!sessionKey) return null;
  const match = /^agent:([^:]+):/.exec(sessionKey);
  return match?.[1] ?? null;
}
