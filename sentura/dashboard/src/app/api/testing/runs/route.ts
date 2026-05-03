import { NextResponse } from "next/server";
import {
  getTestRunsRoot,
  listDirUnder,
  readJsonUnder,
  statUnder,
} from "@/lib/workspace/server-fs";

/**
 * GET /api/testing/runs
 *
 * Lists every SuiteRunResult Person B's
 * `scripts/run-pre-deployment-tests.ts` has dropped into
 * `~/.openclaw/test-runs/{suiteId}-{ISO}.json5`. Despite the `.json5`
 * extension the runner uses plain `JSON.stringify`, so we parse with
 * `JSON.parse` (faster + tighter error surface than JSON5).
 *
 * Each row carries the headline fields needed for the index view; the
 * detail view at `/api/testing/runs/[runId]` returns the full payload.
 *
 * Schema reference: `sentura/config/test-harness-schema.json5` §
 * "SuiteRunResult".
 */

interface RunSummary {
  filename: string;
  suiteId?: string;
  suiteName?: string;
  runAt?: string;
  passRate?: number;
  recommendation?: "deploy" | "auto-tune" | "block";
  iteration?: number;
  totalCases?: number;
  passedCases?: number;
  modifiedAt: number;
  sizeBytes: number;
}

export async function GET(): Promise<NextResponse> {
  const root = getTestRunsRoot();
  const entries = await listDirUnder(root, ".");
  const runs: RunSummary[] = [];

  for (const e of entries) {
    if (!e.isFile || !e.name.endsWith(".json5")) continue;
    const meta = await statUnder(root, e.name);
    if (!meta) continue;
    let suiteId: string | undefined;
    let suiteName: string | undefined;
    let runAt: string | undefined;
    let passRate: number | undefined;
    let recommendation: RunSummary["recommendation"];
    let iteration: number | undefined;
    let totalCases: number | undefined;
    let passedCases: number | undefined;
    try {
      const data = (await readJsonUnder(root, e.name)) as
        | Record<string, unknown>
        | null;
      if (data && typeof data === "object") {
        const suite = data.suite as Record<string, unknown> | undefined;
        if (suite && typeof suite === "object") {
          suiteId = typeof suite.id === "string" ? suite.id : undefined;
          suiteName = typeof suite.name === "string" ? suite.name : undefined;
        }
        runAt = typeof data.runAt === "string" ? data.runAt : undefined;
        passRate =
          typeof data.passRate === "number" ? data.passRate : undefined;
        recommendation =
          data.recommendation === "deploy" ||
          data.recommendation === "auto-tune" ||
          data.recommendation === "block"
            ? data.recommendation
            : undefined;
        iteration =
          typeof data.iteration === "number" ? data.iteration : undefined;
        if (Array.isArray(data.results)) {
          totalCases = data.results.length;
          passedCases = (data.results as Record<string, unknown>[]).filter(
            (r) => r.passed === true,
          ).length;
        }
      }
    } catch {
      // Bad JSON — surface the file with no parsed metadata; the UI
      // will render it as "parse error" so the operator can investigate.
    }
    runs.push({
      filename: e.name,
      suiteId,
      suiteName,
      runAt,
      passRate,
      recommendation,
      iteration,
      totalCases,
      passedCases,
      modifiedAt: meta.modifiedAt,
      sizeBytes: meta.sizeBytes,
    });
  }

  runs.sort((a, b) => b.modifiedAt - a.modifiedAt);

  return NextResponse.json({ runsRoot: root, runs });
}
