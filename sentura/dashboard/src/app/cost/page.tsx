"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Building2,
  Cpu,
  DollarSign,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import { useGateway } from "@/lib/gateway";
import type { CostAggregateBucket, CostSummary } from "@/lib/gateway";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * `/cost` — Cost Center.
 *
 * Reads aggregate LLM spend from Person A's `sentura-cost` extension via
 * the `sentura.cost.summary` gateway RPC. The summary endpoint returns
 * 4 parallel breakdown arrays (by agent / department / tenant / model)
 * plus headline totals.
 *
 * Time-range selector lets the user pick a preset window (today / week /
 * month / all). The preset converts to an ISO-8601 startTime; the server
 * defaults endTime to "now" when omitted.
 *
 * Backend reference: `sentura/extensions/sentura-cost/index.ts:140`.
 */

type RangePreset = "today" | "week" | "month" | "all";

interface RangeOption {
  id: RangePreset;
  label: string;
}

const RANGE_OPTIONS: RangeOption[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

function rangeStart(preset: RangePreset): string | undefined {
  const now = new Date();
  if (preset === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (preset === "week") {
    return new Date(now.getTime() - 7 * 86_400_000).toISOString();
  }
  if (preset === "month") {
    return new Date(now.getTime() - 30 * 86_400_000).toISOString();
  }
  return undefined; // "all" — let the server default
}

export default function CostPage() {
  const { client, state } = useGateway();
  const [range, setRange] = useState<RangePreset>("week");
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (state !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const startTime = rangeStart(range);
      const data = await client.getCostSummary(startTime ? { startTime } : {});
      setSummary(data);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to load cost summary";
      // The cost extension may not be registered (fresh install before
      // pnpm install in the new sentura-cost package). Surface a friendly
      // message rather than a raw RPC error.
      if (msg.toLowerCase().includes("method not found")) {
        setError(
          "sentura-cost extension is not registered. Re-run `./scripts/sentura-setup.sh` and restart the gateway.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [client, range, state]);

  useEffect(() => {
    if (state !== "connected") return;
    void refresh();
  }, [state, refresh]);

  const disconnected = state === "disconnected" || state === "reconnecting";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cost Center</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              LLM spend per employee, department, tenant, and model. Backed by
              the <code className="font-mono text-xs">sentura-cost</code> extension&apos;s
              subscription to OpenClaw&apos;s <code className="font-mono text-xs">model.usage</code>{" "}
              diagnostic event. Costs are computed by the provider when available;
              calls without a price are tracked as <em>unpriced</em>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RangeSwitcher value={range} onChange={setRange} disabled={loading} />
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading || state !== "connected"}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {disconnected && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <WifiOff className="h-4 w-4" />
              Gateway disconnected. Cost data will refresh once the connection is restored.
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {loading && !summary ? (
        <CostSkeleton />
      ) : summary ? (
        <>
          <SummaryStrip summary={summary} />
          <BucketsTabs summary={summary} />
        </>
      ) : !error ? (
        <EmptyCostCard />
      ) : null}
    </div>
  );
}

// =============================================================================
// Range switcher
// =============================================================================

function RangeSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: RangePreset;
  onChange: (next: RangePreset) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border bg-card p-0.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded-sm transition-colors",
            value === opt.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Summary strip — 4 headline numbers
// =============================================================================

function SummaryStrip({ summary }: { summary: CostSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SummaryStat
        label="Total spend"
        value={formatUsd(summary.totalCostUsd)}
        sublabel={
          summary.unpricedCalls > 0
            ? `+ ${summary.unpricedCalls} unpriced call${summary.unpricedCalls === 1 ? "" : "s"}`
            : undefined
        }
        accent
      />
      <SummaryStat
        label="LLM calls"
        value={summary.totalCalls.toLocaleString()}
        sublabel={`window: ${formatPeriod(summary.period)}`}
      />
      <SummaryStat
        label="Total tokens"
        value={summary.totalTokens.toLocaleString()}
      />
      <SummaryStat
        label="Avg cost / call"
        value={
          summary.totalCalls > 0 && summary.totalCostUsd > 0
            ? formatUsd(summary.totalCostUsd / summary.totalCalls)
            : "—"
        }
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={cn("text-xl font-semibold mt-1", accent && "text-primary")}>
          {value}
        </div>
        {sublabel && (
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {sublabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Tabs — 4 breakdown views
// =============================================================================

function BucketsTabs({ summary }: { summary: CostSummary }) {
  return (
    <Tabs defaultValue="agent">
      <TabsList>
        <TabsTrigger value="agent" className="gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          By agent
          <Badge variant="secondary" className="text-[10px] ml-1">
            {summary.byAgent.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="department" className="gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          By department
          <Badge variant="secondary" className="text-[10px] ml-1">
            {summary.byDepartment.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="tenant" className="gap-1.5">
          <Users className="h-3.5 w-3.5" />
          By tenant
          <Badge variant="secondary" className="text-[10px] ml-1">
            {summary.byTenant.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="model" className="gap-1.5">
          <Cpu className="h-3.5 w-3.5" />
          By model
          <Badge variant="secondary" className="text-[10px] ml-1">
            {summary.byModel.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agent" className="mt-4">
        <BucketTable
          buckets={summary.byAgent}
          headerLabel="Agent"
          emptyMessage="No agent activity in this window."
        />
      </TabsContent>
      <TabsContent value="department" className="mt-4">
        <BucketTable
          buckets={summary.byDepartment}
          headerLabel="Department"
          emptyMessage="No department-tagged activity in this window."
        />
      </TabsContent>
      <TabsContent value="tenant" className="mt-4">
        <BucketTable
          buckets={summary.byTenant}
          headerLabel="Tenant"
          emptyMessage="No tenant-tagged activity in this window."
        />
      </TabsContent>
      <TabsContent value="model" className="mt-4">
        <BucketTable
          buckets={summary.byModel}
          headerLabel="Provider / model"
          emptyMessage="No model activity in this window."
        />
      </TabsContent>
    </Tabs>
  );
}

function BucketTable({
  buckets,
  headerLabel,
  emptyMessage,
}: {
  buckets: CostAggregateBucket[];
  headerLabel: string;
  emptyMessage: string;
}) {
  const grandTotal = useMemo(
    () => buckets.reduce((acc, b) => acc + b.totalCostUsd, 0),
    [buckets],
  );

  if (buckets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{headerLabel}</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">USD</TableHead>
              <TableHead className="text-right w-[120px]">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((b) => (
              <BucketRow key={b.key} bucket={b} grandTotal={grandTotal} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BucketRow({
  bucket,
  grandTotal,
}: {
  bucket: CostAggregateBucket;
  grandTotal: number;
}) {
  const sharePct =
    grandTotal > 0 ? (bucket.totalCostUsd / grandTotal) * 100 : 0;
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-sm">{bucket.key || "—"}</div>
        {bucket.unpricedCalls > 0 && (
          <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
            <AlertCircle className="h-3 w-3" />
            {bucket.unpricedCalls} unpriced
          </div>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {bucket.totalCalls.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {bucket.totalTokens.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-medium">
        {formatUsd(bucket.totalCostUsd)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {sharePct.toFixed(0)}%
          </span>
          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, sharePct)}%` }}
            />
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

// =============================================================================
// Empty + skeleton + helpers
// =============================================================================

function EmptyCostCard() {
  return (
    <Card>
      <CardContent className="py-10">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No cost events yet</h2>
          <p className="text-sm text-muted-foreground">
            Cost events accumulate as your AI employees handle tasks. Try
            chatting with one via <a href="/chat" className="underline">/chat</a>{" "}
            and refresh — the call should show up in the breakdown below.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Storage:{" "}
            <code className="font-mono">~/.openclaw/sentura-cost/cost-YYYY-MM-DD.jsonl</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CostSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-3 space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading cost summary…
        </CardContent>
      </Card>
    </div>
  );
}

function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPeriod(period: { start: string; end: string }): string {
  const start = period.start ? new Date(period.start) : null;
  const end = period.end ? new Date(period.end) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "—";
  }
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return start.toLocaleDateString();
  return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
}
