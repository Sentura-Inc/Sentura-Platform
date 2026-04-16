/**
 * User token infrastructure for Sentura.
 *
 * Each user gets a UUID userToken that serves as the single identity primitive for:
 *   - Session isolation (session key format)
 *   - Memory partitioning (user-specific MEMORY_USER_{token}.md)
 *   - Audit attribution (all traces tagged with userToken)
 *
 * The userToken is stored in the sentura-rbac user store and attached
 * to every WebSocket connection.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Generate a new user token (UUID v4).
 */
export function generateUserToken(): string {
  return crypto.randomUUID();
}

/**
 * Build a session key for a user-agent conversation.
 * Format: agent:<agentId>:user:<userToken>:<sessionId>
 */
export function buildSessionKey(agentId: string, userToken: string, sessionId?: string): string {
  const sid = sessionId ?? crypto.randomUUID().slice(0, 8);
  return `agent:${agentId}:user:${userToken}:${sid}`;
}

/**
 * Parse a Sentura session key into its components.
 * Returns null if the key doesn't match the expected format.
 */
export function parseSessionKey(sessionKey: string): {
  agentId: string;
  userToken: string;
  sessionId: string;
} | null {
  const match = sessionKey.match(/^agent:([^:]+):user:([^:]+):(.+)$/);
  if (!match) return null;
  return {
    agentId: match[1],
    userToken: match[2],
    sessionId: match[3],
  };
}

/**
 * Check if a session key belongs to a specific user.
 */
export function isUserSession(sessionKey: string, userToken: string): boolean {
  const parsed = parseSessionKey(sessionKey);
  return parsed !== null && parsed.userToken === userToken;
}

/**
 * Extract the userToken from a session key.
 * Returns null for non-Sentura session keys (e.g., OpenClaw native sessions).
 */
export function extractUserToken(sessionKey: string): string | null {
  const parsed = parseSessionKey(sessionKey);
  return parsed?.userToken ?? null;
}

/**
 * Build the path for a user's personal memory file.
 * Format: memory/users/MEMORY_USER_{token}.md
 */
export function userMemoryFileName(userToken: string): string {
  return `MEMORY_USER_${userToken}.md`;
}

export function userMemoryFilePath(workspaceDir: string, userToken: string): string {
  return path.join(workspaceDir, "memory", "users", userMemoryFileName(userToken));
}

/**
 * Ensure a user's personal memory file exists.
 * Creates the directory and file if they don't exist.
 */
export async function ensureUserMemoryFile(
  workspaceDir: string,
  userToken: string,
): Promise<string> {
  const filePath = userMemoryFilePath(workspaceDir, userToken);
  const dir = path.dirname(filePath);

  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "", "utf-8");
  }

  return filePath;
}

/**
 * Build audit event metadata with user token attribution.
 */
export function buildAuditMeta(
  userToken: string | null,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(userToken ? { userToken } : {}),
    ...(extra ?? {}),
    timestamp: new Date().toISOString(),
  };
}

/**
 * WebSocket connection metadata for user-authenticated connections.
 */
export interface UserConnectionMeta {
  userToken: string;
  userId: string;
  role: string;
  departmentIds: string[];
  connectedAt: string;
}

/**
 * Build connection metadata for a user's WebSocket connection.
 */
export function buildConnectionMeta(
  userToken: string,
  userId: string,
  role: string,
  departmentIds: string[] = [],
): UserConnectionMeta {
  return {
    userToken,
    userId,
    role,
    departmentIds,
    connectedAt: new Date().toISOString(),
  };
}

/**
 * Hash a userToken for safe inclusion in external audit exports.
 * Uses SHA-256 to prevent token leakage while maintaining traceability.
 */
export function hashUserToken(userToken: string): string {
  return crypto.createHash("sha256").update(userToken).digest("hex").slice(0, 16);
}
