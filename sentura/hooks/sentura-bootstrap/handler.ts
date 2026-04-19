/**
 * Sentura Bootstrap Hook
 *
 * OpenClaw natively loads 8 workspace files — `AGENTS.md`, `SOUL.md`,
 * `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`,
 * `MEMORY.md`. Hard rules live inside each agent's `AGENTS.md` (Hard Rules
 * section) and enterprise context lives inside `BOOTSTRAP.md` (Enterprise
 * Context section), so they ride at the runtime's highest prompt priority.
 *
 * This hook's only job is per-user memory: when a session is bound to a
 * user token (via the `agent:{id}:user:{token}:*` session-key convention),
 * we inject that user's personal memory file at
 * `memory/users/MEMORY_USER_{token}.md` into the bootstrap files so the
 * agent can recall prior interactions with that specific user. This is a
 * Sentura-specific capability (multi-tenant per-user recall on top of
 * shared workspace memory) and cannot be expressed inside the 8 native
 * files because the file it points at is keyed dynamically by session.
 */

import fs from "node:fs";
import path from "node:path";

type HookHandler = (event: {
  type: string;
  action: string;
  context: Record<string, unknown>;
}) => Promise<void> | void;

type BootstrapFile = {
  name: string;
  path: string;
  content: string;
  missing: boolean;
};

type BootstrapContext = {
  workspaceDir: string;
  bootstrapFiles: BootstrapFile[];
  sessionKey?: string;
  agentId?: string;
};

function isBootstrapEvent(event: { type: string; action: string; context: Record<string, unknown> }): boolean {
  if (event.type !== "agent" || event.action !== "bootstrap") {
    return false;
  }
  const ctx = event.context as Partial<BootstrapContext>;
  return typeof ctx.workspaceDir === "string" && Array.isArray(ctx.bootstrapFiles);
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function extractUserTokenFromSessionKey(sessionKey: string | undefined): string | null {
  if (!sessionKey) return null;
  const match = sessionKey.match(/^agent:[^:]+:user:([^:]+):/);
  return match ? match[1] : null;
}

const senturaBootstrapHook: HookHandler = async (event) => {
  if (!isBootstrapEvent(event)) {
    return;
  }

  const context = event.context as BootstrapContext;
  const workspaceDir = context.workspaceDir;

  const extraFiles: BootstrapFile[] = [];

  const userToken = extractUserTokenFromSessionKey(context.sessionKey);
  if (userToken) {
    const userMemoryPath = path.join(workspaceDir, "memory", "users", `MEMORY_USER_${userToken}.md`);
    const userMemoryContent = readFileIfExists(userMemoryPath);
    if (userMemoryContent !== null && userMemoryContent.trim().length > 0) {
      extraFiles.push({
        name: `MEMORY_USER_${userToken}.md`,
        path: userMemoryPath,
        content: userMemoryContent,
        missing: false,
      });
    }
  }

  if (extraFiles.length > 0) {
    context.bootstrapFiles = [...context.bootstrapFiles, ...extraFiles];
  }
};

export default senturaBootstrapHook;
