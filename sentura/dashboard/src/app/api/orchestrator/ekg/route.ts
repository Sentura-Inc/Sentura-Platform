import { NextResponse } from "next/server";
import {
  getOpenClawWorkspaceRoot,
  listDirUnder,
  readJson5Under,
} from "@/lib/workspace/server-fs";

/**
 * GET /api/orchestrator/ekg
 *
 * Reads the four Manager EKG pillars Person B shipped at
 * `~/.openclaw/workspace/orchestrator/ekg/{capabilities,conflicts,
 * insights,global-sops}/*.json5` and returns them as four parallel
 * arrays. Each entry includes the parsed JSON5 plus the source
 * filename so the dashboard can deep-link / show provenance.
 *
 * Schema reference: `sentura/agents/orchestrator/ekg/README.md` §
 * "Schema — capabilities/{agent-id}.json5".
 */
const PILLARS = [
  { dir: "capabilities", key: "capabilities" },
  { dir: "conflicts", key: "conflicts" },
  { dir: "insights", key: "insights" },
  { dir: "global-sops", key: "globalSops" },
] as const;

interface PillarEntry {
  filename: string;
  data: unknown;
}

export async function GET(): Promise<NextResponse> {
  const root = getOpenClawWorkspaceRoot();
  const pillars: Record<string, PillarEntry[]> = {
    capabilities: [],
    conflicts: [],
    insights: [],
    globalSops: [],
  };

  const errors: { pillar: string; filename: string; message: string }[] = [];

  for (const { dir, key } of PILLARS) {
    const relDir = `orchestrator/ekg/${dir}`;
    const entries = await listDirUnder(root, relDir);
    for (const e of entries) {
      if (!e.isFile || !e.name.endsWith(".json5")) continue;
      try {
        const data = await readJson5Under(root, `${relDir}/${e.name}`);
        if (data !== null) {
          pillars[key].push({ filename: e.name, data });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ pillar: key, filename: e.name, message });
      }
    }
  }

  return NextResponse.json({
    workspaceRoot: root,
    pillars,
    errors,
  });
}
