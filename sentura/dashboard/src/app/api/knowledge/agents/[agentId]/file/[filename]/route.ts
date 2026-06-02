import { NextResponse } from "next/server";
import {
  getOpenClawWorkspaceRoot,
  readTextUnder,
  statUnder,
} from "@/lib/workspace/server-fs";

/**
 * GET /api/knowledge/agents/[agentId]/file/[filename]
 *
 * Returns raw text content of a single EKG file under
 * `~/.openclaw/workspace/<agentId>/ekg/<filename>`. Path-traversal is
 * checked here (no `/`, `\`, `..`, or hidden-prefix segments) AND
 * inside `safeJoinUnder` — defense in depth. Only `.md` and `.json5`
 * files are served.
 */

const ALLOWED_EXT = [".md", ".json5"];

function isSafeSegment(s: string): boolean {
  if (!s) return false;
  if (s.includes("/") || s.includes("\\")) return false;
  if (s.includes("..") || s.startsWith(".")) return false;
  return true;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ agentId: string; filename: string }> },
): Promise<NextResponse> {
  const { agentId, filename } = await context.params;

  if (!isSafeSegment(agentId) || !isSafeSegment(filename)) {
    return NextResponse.json(
      { error: "Invalid path segment" },
      { status: 400 },
    );
  }
  if (!ALLOWED_EXT.some((ext) => filename.endsWith(ext))) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 },
    );
  }

  const root = getOpenClawWorkspaceRoot();
  const rel = `${agentId}/ekg/${filename}`;
  const meta = await statUnder(root, rel);
  if (!meta) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const content = await readTextUnder(root, rel);
  if (content === null) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: filename,
    content,
    sizeBytes: meta.sizeBytes,
    modifiedAt: meta.modifiedAt,
    contentType: filename.endsWith(".json5") ? "json5" : "markdown",
  });
}
