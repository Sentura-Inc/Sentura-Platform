/**
 * Sentura Bootstrap Hook
 *
 * OpenClaw natively loads 8 workspace files — `AGENTS.md`, `SOUL.md`,
 * `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`,
 * `MEMORY.md`. Hard rules live inside each agent's `AGENTS.md` (Hard Rules
 * section) and enterprise context lives inside `BOOTSTRAP.md` (Enterprise
 * Context section), so they ride at the runtime's highest prompt priority.
 *
 * This hook performs two Sentura-specific bootstrap extensions:
 *
 *   1. Per-user memory (when a session is bound to a user token via the
 *      `agent:{id}:user:{token}:*` session-key convention) — load
 *      `memory/users/MEMORY_USER_{token}.md` so the agent can recall
 *      prior interactions with that specific user.
 *
 *   2. EKG (Enterprise Knowledge Graph) summary (capability #11) —
 *      synthesise a one-pager listing the agent's `ekg/` pillar contents
 *      so the agent knows what enterprise knowledge it owns. The full
 *      JSON5 content is auto-indexed by OpenClaw's memory system; the
 *      summary is just a wayfinding device for the system prompt so the
 *      agent can use `memory_search` deliberately.
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

const EKG_PILLARS = ["org", "rules", "assets", "workflows"] as const;
type EkgPillar = (typeof EKG_PILLARS)[number];

interface EkgPillarSummary {
  pillar: EkgPillar;
  files: Array<{ relPath: string; domain: string | null; entityCount: number; relationCount: number; ruleCount: number }>;
  totalEntities: number;
  totalRelations: number;
  totalRules: number;
}

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

/**
 * Cheap, dependency-free counter for an EKG JSON5 file. We deliberately do
 * NOT pull in a JSON5 parser — the summary only needs entity/relation/rule
 * counts, and a full parse would block bootstrap on every malformed file.
 * The regexes match the canonical 4-pillar shape documented in
 * `docs/DESIGN.md` (entities: [...], relations: [...], rules: [...]).
 */
function summarizeEkgFile(filePath: string): {
  domain: string | null;
  entityCount: number;
  relationCount: number;
  ruleCount: number;
} | null {
  const content = readFileIfExists(filePath);
  if (content === null) return null;
  const domainMatch = content.match(/^\s*domain:\s*["']([^"']+)["']/m);
  const entityMatches = content.match(/{\s*id:\s*["']entity:/g);
  const relationMatches = content.match(/{\s*from:\s*["']entity:/g);
  const ruleMatches = content.match(/{\s*id:\s*["']rule:/g);
  return {
    domain: domainMatch ? domainMatch[1] : null,
    entityCount: entityMatches?.length ?? 0,
    relationCount: relationMatches?.length ?? 0,
    ruleCount: ruleMatches?.length ?? 0,
  };
}

function summarizeEkgPillar(workspaceDir: string, pillar: EkgPillar): EkgPillarSummary | null {
  const pillarDir = path.join(workspaceDir, "ekg", pillar);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(pillarDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const files: EkgPillarSummary["files"] = [];
  let totalEntities = 0;
  let totalRelations = 0;
  let totalRules = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".json5") && !entry.name.endsWith(".json")) continue;
    const summary = summarizeEkgFile(path.join(pillarDir, entry.name));
    if (!summary) continue;
    files.push({
      relPath: path.posix.join("ekg", pillar, entry.name),
      domain: summary.domain,
      entityCount: summary.entityCount,
      relationCount: summary.relationCount,
      ruleCount: summary.ruleCount,
    });
    totalEntities += summary.entityCount;
    totalRelations += summary.relationCount;
    totalRules += summary.ruleCount;
  }

  if (files.length === 0) return null;
  return { pillar, files, totalEntities, totalRelations, totalRules };
}

function renderEkgSummary(workspaceDir: string): BootstrapFile | null {
  const pillarSummaries: EkgPillarSummary[] = [];
  for (const pillar of EKG_PILLARS) {
    const summary = summarizeEkgPillar(workspaceDir, pillar);
    if (summary) pillarSummaries.push(summary);
  }
  if (pillarSummaries.length === 0) return null;

  const totalFiles = pillarSummaries.reduce((acc, p) => acc + p.files.length, 0);
  const totalEntities = pillarSummaries.reduce((acc, p) => acc + p.totalEntities, 0);
  const totalRelations = pillarSummaries.reduce((acc, p) => acc + p.totalRelations, 0);
  const totalRules = pillarSummaries.reduce((acc, p) => acc + p.totalRules, 0);

  const lines: string[] = [];
  lines.push("# Enterprise Knowledge Graph (EKG) — Summary");
  lines.push("");
  lines.push(
    `Your workspace ships with a structured Enterprise Knowledge Graph at \`ekg/\` covering ${pillarSummaries.length} of the 4 pillars (org / rules / assets / workflows). Totals: **${totalFiles} file(s)**, **${totalEntities} entity record(s)**, **${totalRelations} relation(s)**, **${totalRules} rule(s)**.`,
  );
  lines.push("");
  lines.push(
    "The full JSON5 content is auto-indexed by OpenClaw's memory system — use the `memory_search` tool with a domain-specific query (for example `\"AML escalation chain\"` or `\"refund authority limit\"`) to recall the relevant entries on demand. **Do not** assume entity IDs without searching first; structures evolve.",
  );
  lines.push("");
  lines.push("## Pillar inventory");
  lines.push("");
  for (const pillar of pillarSummaries) {
    lines.push(`### \`ekg/${pillar.pillar}/\``);
    lines.push("");
    for (const file of pillar.files) {
      const parts: string[] = [];
      if (file.domain) parts.push(`domain \`${file.domain}\``);
      if (file.entityCount > 0) parts.push(`${file.entityCount} entity`);
      if (file.relationCount > 0) parts.push(`${file.relationCount} relation`);
      if (file.ruleCount > 0) parts.push(`${file.ruleCount} rule`);
      const tail = parts.length > 0 ? ` — ${parts.join(", ")}` : "";
      lines.push(`- \`${file.relPath}\`${tail}`);
    }
    lines.push("");
  }
  lines.push("## Authority");
  lines.push("");
  lines.push(
    "EKG content is enterprise ground truth (org chart, policy rules, owned systems, canonical workflows). When EKG content conflicts with the user's casual phrasing, the EKG wins — surface the discrepancy back to the user instead of silently following the looser instruction.",
  );

  return {
    name: "EKG_SUMMARY.md",
    path: path.join(workspaceDir, "ekg"),
    content: lines.join("\n") + "\n",
    missing: false,
  };
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

  const ekgSummary = renderEkgSummary(workspaceDir);
  if (ekgSummary) {
    extraFiles.push(ekgSummary);
  }

  if (extraFiles.length > 0) {
    context.bootstrapFiles = [...context.bootstrapFiles, ...extraFiles];
  }
};

export default senturaBootstrapHook;
