import { NextResponse } from "next/server";
import {
  getTestRunsRoot,
  readJsonUnder,
  statUnder,
} from "@/lib/workspace/server-fs";

/**
 * GET /api/testing/runs/[runId]
 *
 * Returns the full SuiteRunResult for a single run. `runId` is the
 * filename (e.g. `billing-support-rep-2026-05-01T18-22-00.json5`).
 *
 * The path-traversal guard is enforced both here (must not contain `/`
 * or `..`) AND inside `safeJoinUnder` — defense in depth. Only `.json5`
 * filenames are accepted to keep the handler scoped to the runner's
 * output convention.
 */

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await context.params;

  if (
    !runId ||
    runId.includes("/") ||
    runId.includes("..") ||
    !runId.endsWith(".json5")
  ) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }

  const root = getTestRunsRoot();
  const meta = await statUnder(root, runId);
  if (!meta) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  try {
    const data = await readJsonUnder(root, runId);
    return NextResponse.json({
      filename: runId,
      modifiedAt: meta.modifiedAt,
      sizeBytes: meta.sizeBytes,
      data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to parse run: ${message}` },
      { status: 500 },
    );
  }
}
