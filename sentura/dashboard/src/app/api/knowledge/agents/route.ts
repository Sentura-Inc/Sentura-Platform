import { NextResponse } from "next/server";
import {
  getOpenClawWorkspaceRoot,
  listDirUnder,
  statUnder,
} from "@/lib/workspace/server-fs";

/**
 * GET /api/knowledge/agents
 *
 * Walks `~/.openclaw/workspace/<agent>/ekg/` for every agent directory
 * found under the workspace root and returns a list of EKG files per
 * agent. Filters out the orchestrator (its EKG is a separate Manager
 * concern surfaced under `/orchestrator`) and the workspace's `state/`
 * runtime cache.
 *
 * Files at the workspace root (the 8 OpenClaw natives that live there
 * rather than inside an agent subdir) are skipped naturally by the
 * `isDirectory` filter on the top-level walk.
 */

interface EkgFileSummary {
  name: string;
  sizeBytes: number;
  modifiedAt: number;
}

interface AgentEntry {
  agentId: string;
  ekgFiles: EkgFileSummary[];
}

const HIDDEN_AGENT_IDS = new Set([
  "orchestrator", // surfaced separately at /orchestrator
  "state",        // OpenClaw runtime cache
]);

export async function GET(): Promise<NextResponse> {
  const root = getOpenClawWorkspaceRoot();
  const top = await listDirUnder(root, ".");
  const agents: AgentEntry[] = [];

  for (const entry of top) {
    if (!entry.isDirectory) continue;
    if (HIDDEN_AGENT_IDS.has(entry.name)) continue;

    const ekgEntries = await listDirUnder(root, `${entry.name}/ekg`);
    const files: EkgFileSummary[] = [];
    for (const f of ekgEntries) {
      if (!f.isFile) continue;
      if (!f.name.endsWith(".md") && !f.name.endsWith(".json5")) continue;
      const meta = await statUnder(root, `${entry.name}/ekg/${f.name}`);
      if (meta) {
        files.push({
          name: f.name,
          sizeBytes: meta.sizeBytes,
          modifiedAt: meta.modifiedAt,
        });
      }
    }

    agents.push({ agentId: entry.name, ekgFiles: files });
  }

  agents.sort((a, b) => a.agentId.localeCompare(b.agentId));

  return NextResponse.json({ workspaceRoot: root, agents });
}
