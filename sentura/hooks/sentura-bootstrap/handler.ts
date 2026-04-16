/**
 * Sentura Bootstrap Hook
 *
 * Injects Sentura-specific files into the agent system prompt:
 *   1. RULES.md — position-specific safety guardrails (Sentura innovation)
 *   2. CONTEXT.md — enterprise context
 *   3. MEMORY_USER_{token}.md — user-specific memory (if userToken in session context)
 *
 * OpenClaw natively loads 8 workspace files; Sentura adds these enterprise-specific
 * files via the hook pipeline so they appear in the system prompt without modifying
 * OpenClaw core.
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

const SENTURA_FILES = ["RULES.md", "CONTEXT.md"] as const;

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

  for (const fileName of SENTURA_FILES) {
    const filePath = path.join(workspaceDir, fileName);
    const content = readFileIfExists(filePath);
    if (content !== null && content.trim().length > 0) {
      extraFiles.push({
        name: fileName,
        path: filePath,
        content,
        missing: false,
      });
    }
  }

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
