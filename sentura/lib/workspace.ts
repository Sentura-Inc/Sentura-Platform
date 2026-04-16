/**
 * Automated workspace directory creation for AI employees.
 *
 * Creates the full directory structure with all 10 workspace files,
 * skills/, ekg/ (4-pillar structure), and memory/users/ for user-level
 * memory isolation.
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface WorkspaceOptions {
  agentId: string;
  name?: string;
  department?: string;
  workspaceBase?: string;
  templateDir?: string;
  industryOntologyDir?: string;
}

export interface WorkspaceResult {
  workspaceDir: string;
  filesCreated: string[];
  dirsCreated: string[];
}

const DEFAULT_WORKSPACE_BASE = path.join(
  process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? "~", ".openclaw"),
  "workspace",
);

const OPENCLAW_BOOTSTRAP_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
] as const;

const SENTURA_FILES = ["RULES.md", "CONTEXT.md"] as const;

const ALL_WORKSPACE_FILES = [...OPENCLAW_BOOTSTRAP_FILES, ...SENTURA_FILES] as const;

const EKG_PILLARS = ["org", "rules", "assets", "workflows"] as const;

const EKG_SUBDIRS = [
  ...EKG_PILLARS.map((p) => `ekg/${p}`),
  "ekg/workflows/experience-links",
] as const;

function defaultFileContent(fileName: string, agentId: string, name?: string): string {
  const displayName = name ?? agentId;

  switch (fileName) {
    case "SOUL.md":
      return `# ${displayName}\n\nYou are ${displayName}, an AI employee.\n\n## Personality\n\n- Professional and helpful\n- Clear and concise communication\n- Ask for clarification when needed\n`;
    case "AGENTS.md":
      return `# ${displayName} — Operating Protocol\n\n## Session Start\n1. Read your workspace files to refresh context\n2. Check for pending tasks\n3. Greet the user appropriately\n\n## Red Lines\n- Never exceed your authorized scope\n- Always escalate when uncertain\n- Follow RULES.md constraints at all times\n`;
    case "RULES.md":
      return `# Safety Rules for ${displayName}\n\n## NEVER\n- Never share credentials or API keys\n- Never access systems outside your authorized scope\n- Never make financial decisions above your threshold without approval\n- Never modify other employees' configurations\n\n## ALWAYS\n- Always verify user identity before sharing sensitive information\n- Always log significant decisions\n- Always escalate to a human when uncertain\n`;
    case "CONTEXT.md":
      return `# Enterprise Context for ${displayName}\n\n## Company\n- Name: [Company Name]\n- Industry: [Industry]\n\n## Systems\n- [List enterprise systems this employee interacts with]\n\n## Policies\n- [Relevant company policies]\n`;
    case "TOOLS.md":
      return `# Tools Available to ${displayName}\n\n## MCP Servers\n- [Configure via config.patch when enterprise integrations are ready]\n\n## Built-in Tools\n- web_search: Research and information gathering\n- web_fetch: Retrieve web content\n- canvas: Create and edit documents\n`;
    case "IDENTITY.md":
      return `name: ${displayName}\nemoji: 🤖\n`;
    case "USER.md":
      return `# Primary User Profile\n\nThe primary users of ${displayName} are enterprise team members who need assistance with their daily tasks.\n`;
    case "HEARTBEAT.md":
      return `# Heartbeat Protocol for ${displayName}\n\nCheck for:\n- Pending tasks or follow-ups\n- System health of connected integrations\n- Upcoming scheduled actions\n\nIf nothing pending: HEARTBEAT_OK\n`;
    case "BOOTSTRAP.md":
      return `# First-Run Bootstrap for ${displayName}\n\n1. Read all workspace files (SOUL.md, RULES.md, CONTEXT.md, AGENTS.md, TOOLS.md)\n2. Verify MCP server connections (if configured)\n3. Announce readiness\n`;
    case "MEMORY.md":
      return "";
    default:
      return "";
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a complete workspace directory for a new AI employee.
 * Writes all 10 workspace files, skills/, ekg/ (4 pillars), and memory/users/.
 * If a template directory is provided, copies files from it instead of using defaults.
 * Does not overwrite existing files.
 */
export async function createWorkspace(options: WorkspaceOptions): Promise<WorkspaceResult> {
  const {
    agentId,
    name,
    workspaceBase = DEFAULT_WORKSPACE_BASE,
    templateDir,
    industryOntologyDir,
  } = options;

  const workspaceDir = path.join(workspaceBase, agentId);
  const filesCreated: string[] = [];
  const dirsCreated: string[] = [];

  await fs.mkdir(workspaceDir, { recursive: true });
  dirsCreated.push(workspaceDir);

  const skillsDir = path.join(workspaceDir, "skills");
  await fs.mkdir(skillsDir, { recursive: true });
  dirsCreated.push(skillsDir);

  for (const pillarDir of EKG_SUBDIRS) {
    const fullDir = path.join(workspaceDir, pillarDir);
    await fs.mkdir(fullDir, { recursive: true });
    dirsCreated.push(fullDir);
  }

  const memoryUsersDir = path.join(workspaceDir, "memory", "users");
  await fs.mkdir(memoryUsersDir, { recursive: true });
  dirsCreated.push(memoryUsersDir);

  for (const fileName of ALL_WORKSPACE_FILES) {
    const targetPath = path.join(workspaceDir, fileName);

    if (await fileExists(targetPath)) continue;

    let content: string;

    if (templateDir) {
      const templatePath = path.join(templateDir, fileName);
      if (await fileExists(templatePath)) {
        content = await fs.readFile(templatePath, "utf-8");
      } else {
        content = defaultFileContent(fileName, agentId, name);
      }
    } else {
      content = defaultFileContent(fileName, agentId, name);
    }

    await fs.writeFile(targetPath, content, "utf-8");
    filesCreated.push(targetPath);
  }

  if (templateDir) {
    const templateSkillsDir = path.join(templateDir, "skills");
    if (await fileExists(templateSkillsDir)) {
      await copyDirectory(templateSkillsDir, skillsDir);
    }
  }

  if (industryOntologyDir && (await fileExists(industryOntologyDir))) {
    await mergeOntology(industryOntologyDir, path.join(workspaceDir, "ekg"));
  }

  return { workspaceDir, filesCreated, dirsCreated };
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      if (!(await fileExists(destPath))) {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

/**
 * Merge an industry ontology template into the agent's ekg/ directory.
 * Additive only — never overwrites existing files.
 */
async function mergeOntology(ontologyDir: string, ekgDir: string): Promise<void> {
  for (const pillar of EKG_PILLARS) {
    const srcPillarDir = path.join(ontologyDir, pillar);
    const destPillarDir = path.join(ekgDir, pillar);
    if (await fileExists(srcPillarDir)) {
      await copyDirectory(srcPillarDir, destPillarDir);
    }
  }
}

/**
 * List all workspace files that exist on disk for an agent.
 */
export async function listWorkspaceFiles(agentId: string, workspaceBase?: string): Promise<string[]> {
  const base = workspaceBase ?? DEFAULT_WORKSPACE_BASE;
  const workspaceDir = path.join(base, agentId);
  const files: string[] = [];

  try {
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const parentDir = (entry as unknown as { parentPath?: string }).parentPath ?? (entry as unknown as { path: string }).path;
        files.push(path.relative(workspaceDir, path.join(parentDir, entry.name)));
      }
    }
  } catch {
    // workspace doesn't exist
  }

  return files;
}

/**
 * Resolve the workspace directory path for an agent.
 */
export function resolveWorkspaceDir(agentId: string, workspaceBase?: string): string {
  const base = workspaceBase ?? DEFAULT_WORKSPACE_BASE;
  return path.join(base, agentId);
}
