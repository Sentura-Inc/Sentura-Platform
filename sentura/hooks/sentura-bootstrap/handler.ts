/**
 * Sentura Bootstrap Hook
 *
 * Injects RULES.md and CONTEXT.md into the agent system prompt.
 * OpenClaw natively loads 8 workspace files; Sentura adds these two
 * enterprise-specific files via the hook pipeline so they appear in
 * the system prompt without modifying OpenClaw core.
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

  if (extraFiles.length > 0) {
    context.bootstrapFiles = [...context.bootstrapFiles, ...extraFiles];
  }
};

export default senturaBootstrapHook;
