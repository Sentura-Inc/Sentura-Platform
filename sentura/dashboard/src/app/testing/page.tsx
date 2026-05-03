"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * `/testing` — Pre-deployment test scorecard.
 *
 * Reads `~/.openclaw/test-runs/{suiteId}-{ISO}.json5` (Person B's
 * `scripts/run-pre-deployment-tests.ts` output) via the server-side
 * Route Handler at `/api/testing/runs`. Click a row → fetch detail
 * from `/api/testing/runs/[runId]`.
 *
 * Schema reference: `sentura/config/test-harness-schema.json5` §
 * "SuiteRunResult".
 */

type Recommendation = "deploy" | "auto-tune" | "block";

interface RunSummary {
  filename: string;
  suiteId?: string;
  suiteName?: string;
  runAt?: string;
  passRate?: number;
  recommendation?: Recommendation;
  iteration?: number;
  totalCases?: number;
  passedCases?: number;
  modifiedAt: number;
  sizeBytes: number;
}

interface RunDetailResponse {
  filename: string;
  modifiedAt: number;
  sizeBytes: number;
  data: unknown;
}

interface ResultRow {
  caseId?: string;
  passed?: boolean;
  score?: number;
  failureReason?: string;
}

export default function TestingPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/testing/runs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { runs: RunSummary[] };
      setRuns(json.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadDetail = useCallback(async (filename: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(
        `/api/testing/runs/${encodeURIComponent(filename)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RunDetailResponse;
      setDetail(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadDetail(selected);
  }, [selected, loadDetail]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Test Results
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Pre-deployment test runs — scorecards, auto-tune iteration
              history, and pass/fail gating from{" "}
              <code className="font-mono text-xs">
                scripts/run-pre-deployment-tests.ts
              </code>
              . Pass mark <strong>0.75</strong>; max <strong>3</strong>{" "}
              auto-tune iterations; Hard-Rule failure → <strong>block</strong>.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {loading && runs.length === 0 ? (
        <RunsSkeleton />
      ) : runs.length === 0 ? (
        <EmptyRunsCard />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,1.4fr)]">
          <RunsTable
            runs={runs}
            selected={selected}
            onSelect={setSelected}
          />
          <RunDetailPane
            detail={detail}
            loading={detailLoading}
            selected={selected}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Runs index table
// =============================================================================

function RunsTable({
  runs,
  selected,
  onSelect,
}: {
  runs: RunSummary[];
  selected: string | null;
  onSelect: (filename: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Suite</TableHead>
              <TableHead>Pass rate</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead className="text-right">Run at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow
                key={r.filename}
                className={cn(
                  "cursor-pointer",
                  selected === r.filename && "bg-accent",
                )}
                onClick={() => onSelect(r.filename)}
              >
                <TableCell>
                  <div className="font-medium text-sm flex items-center gap-1">
                    {r.suiteName ?? r.suiteId ?? "(unparsed)"}
                    {selected === r.filename && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[260px]">
                    {r.filename}
                  </div>
                </TableCell>
                <TableCell>
                  <PassRateCell
                    passRate={r.passRate}
                    passed={r.passedCases}
                    total={r.totalCases}
                  />
                </TableCell>
                <TableCell>
                  <RecommendationBadge value={r.recommendation} />
                  {typeof r.iteration === "number" && r.iteration > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      iter {r.iteration}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {r.runAt ? formatRelative(new Date(r.runAt).getTime()) : formatRelative(r.modifiedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PassRateCell({
  passRate,
  passed,
  total,
}: {
  passRate?: number;
  passed?: number;
  total?: number;
}) {
  if (typeof passRate !== "number") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const pct = Math.round(passRate * 100);
  const meetsBar = passRate >= 0.75;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "text-sm font-medium",
            meetsBar
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400",
          )}
        >
          {pct}%
        </span>
        {typeof passed === "number" && typeof total === "number" && (
          <span className="text-[10px] text-muted-foreground">
            ({passed}/{total})
          </span>
        )}
      </div>
      <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full",
            meetsBar ? "bg-emerald-500" : "bg-amber-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationBadge({ value }: { value?: Recommendation }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const variant: "default" | "secondary" | "destructive" =
    value === "deploy"
      ? "default"
      : value === "block"
        ? "destructive"
        : "secondary";
  const Icon =
    value === "deploy"
      ? CheckCircle2
      : value === "block"
        ? ShieldAlert
        : AlertCircle;
  return (
    <Badge variant={variant} className="text-[10px] gap-1 capitalize">
      <Icon className="h-3 w-3" />
      {value}
    </Badge>
  );
}

// =============================================================================
// Detail pane
// =============================================================================

function RunDetailPane({
  detail,
  loading,
  selected,
}: {
  detail: RunDetailResponse | null;
  loading: boolean;
  selected: string | null;
}) {
  if (!selected) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Select a run from the table to inspect its scorecard, per-case
          results, and auto-tune iteration history.
        </CardContent>
      </Card>
    );
  }
  if (loading || !detail) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading run detail…
        </CardContent>
      </Card>
    );
  }

  const data = (detail.data ?? {}) as Record<string, unknown>;
  const suite = (data.suite ?? {}) as Record<string, unknown>;
  const results = Array.isArray(data.results)
    ? (data.results as ResultRow[])
    : [];
  const passRate =
    typeof data.passRate === "number" ? data.passRate : undefined;
  const recommendation = data.recommendation as Recommendation | undefined;
  const iteration =
    typeof data.iteration === "number" ? data.iteration : undefined;
  const runAt = typeof data.runAt === "string" ? data.runAt : undefined;
  const suiteName = typeof suite.name === "string" ? suite.name : undefined;
  const suiteId = typeof suite.id === "string" ? suite.id : undefined;

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        {/* Header bar */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold truncate">
              {suiteName ?? suiteId ?? detail.filename}
            </h3>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
              {detail.filename}
            </div>
          </div>
          <RecommendationBadge value={recommendation} />
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryChip label="Pass rate" value={passRate !== undefined ? `${Math.round(passRate * 100)}%` : "—"} />
          <SummaryChip
            label="Cases"
            value={
              results.length > 0
                ? `${results.filter((r) => r.passed).length} / ${results.length}`
                : "—"
            }
          />
          <SummaryChip
            label="Iteration"
            value={typeof iteration === "number" ? String(iteration) : "—"}
          />
          <SummaryChip
            label="Run at"
            value={runAt ? new Date(runAt).toLocaleString() : "—"}
          />
        </div>

        {/* Per-case results */}
        {results.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-3">
            No per-case results in this run payload.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead className="w-[80px]">Score</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead>Failure reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, idx) => (
                  <TableRow key={r.caseId ?? idx}>
                    <TableCell className="font-mono text-[11px]">
                      {r.caseId ?? `#${idx + 1}`}
                    </TableCell>
                    <TableCell className="text-xs">
                      {typeof r.score === "number"
                        ? r.score.toFixed(2)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {r.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.failureReason ? (
                        <span
                          className={cn(
                            r.failureReason.startsWith("safety:")
                              && "text-destructive font-medium",
                          )}
                        >
                          {r.failureReason}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}

// =============================================================================
// Empty / loading
// =============================================================================

function EmptyRunsCard() {
  return (
    <Card>
      <CardContent className="py-10">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FlaskConical className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No test runs yet</h2>
          <p className="text-sm text-muted-foreground">
            Run a pre-deployment suite to see results appear here:
          </p>
          <pre className="mx-auto inline-block rounded-md bg-muted px-3 py-2 text-left text-xs font-mono text-foreground">
            node --import ./openclaw/node_modules/tsx/dist/loader.mjs \
{"\n"}  scripts/run-pre-deployment-tests.ts \
{"\n"}  --suite sentura/config/test-suites/&lt;suite&gt;.json5
          </pre>
          <p className="text-xs text-muted-foreground">
            Output lands at <code className="font-mono">~/.openclaw/test-runs/{"{"}suiteId{"}"}-{"{"}ISO{"}"}.json5</code>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RunsSkeleton() {
  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
          Loading runs…
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString();
}
