"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
  X,
} from "lucide-react";
import { useGateway } from "@/lib/gateway";
import type {
  AuditEntry,
  AuditEventType,
  AuditQueryParams,
  AuditSeverity,
  AuditStats,
  DataTier,
} from "@/lib/gateway";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
 * `/audit` — Audit Trail.
 *
 * Reads Person D's `sentura-audit` extension via two gateway RPCs:
 *
 *   - `sentura.audit.query` — list audit entries with rich filters
 *     (eventType, agentId, severity, dataTier, tenantId, departmentId,
 *      userId, groupId, time range, free-text search)
 *   - `sentura.audit.stats` — last-24h aggregations (by type, severity,
 *     agent, tier, tenant)
 *
 * Backend reference: `sentura/extensions/sentura-audit/index.ts:221`.
 */

const SEVERITIES: AuditSeverity[] = ["info", "warning", "critical"];
const TIERS: DataTier[] = ["T0", "T1", "T2", "T3", "T4"];
const EVENT_TYPES: AuditEventType[] = [
  "tool_call",
  "tool_result",
  "approval_requested",
  "approval_resolved",
  "config_change",
  "session_start",
  "session_end",
  "message_received",
  "message_sent",
  "gateway_start",
  "gateway_stop",
  "agent_end",
  "chat_message",
  "chat_group_created",
  "chat_group_updated",
  "chat_group_archived",
  "chat_group_fanout",
  "mcp_health_check",
  "mcp_health_change",
];

const PAGE_LIMIT = 100;

export default function AuditPage() {
  const { client, state } = useGateway();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState<AuditEventType | "">("");
  const [severity, setSeverity] = useState<AuditSeverity | "">("");
  const [dataTier, setDataTier] = useState<DataTier | "">("");
  const [agentId, setAgentId] = useState("");

  const buildParams = useCallback((): AuditQueryParams => {
    const p: AuditQueryParams = { limit: PAGE_LIMIT };
    if (search.trim()) p.search = search.trim();
    if (eventType) p.eventType = eventType;
    if (severity) p.severity = severity;
    if (dataTier) p.dataTier = dataTier;
    if (agentId.trim()) p.agentId = agentId.trim();
    return p;
  }, [search, eventType, severity, dataTier, agentId]);

  const refresh = useCallback(async () => {
    if (state !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const [entriesResult, statsResult] = await Promise.allSettled([
        client.queryAudit(buildParams()),
        client.getAuditStats(),
      ]);
      if (entriesResult.status === "fulfilled") {
        setEntries(entriesResult.value.entries);
      } else {
        const msg = errMessage(entriesResult.reason);
        if (msg.toLowerCase().includes("method not found")) {
          setError(
            "sentura-audit extension is not registered. Re-run `./scripts/sentura-setup.sh` and restart the gateway.",
          );
          return;
        }
        setError(msg);
      }
      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }
    } finally {
      setLoading(false);
    }
  }, [client, state, buildParams]);

  useEffect(() => {
    if (state !== "connected") return;
    void refresh();
  }, [state, refresh]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setEventType("");
    setSeverity("");
    setDataTier("");
    setAgentId("");
  }, []);

  const hasActiveFilters =
    search.trim() !== "" ||
    eventType !== "" ||
    severity !== "" ||
    dataTier !== "" ||
    agentId.trim() !== "";

  const disconnected = state === "disconnected" || state === "reconnecting";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Audit Trail
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Every tool call, approval, config change, chat message, and MCP
              health transition. Each entry carries a T0–T4 data tier so
              compliance reviews can filter by sensitivity. Backed by the{" "}
              <code className="font-mono text-xs">sentura-audit</code> extension
              + the new <code className="font-mono text-xs">sentura.audit.&#123;query,stats&#125;</code>{" "}
              gateway RPCs.
            </p>
          </div>
        </div>
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

      {disconnected && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <WifiOff className="h-4 w-4" />
              Gateway disconnected. The audit feed will refresh when the connection is restored.
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {stats && <StatsStrip stats={stats} />}

      <FilterBar
        search={search}
        eventType={eventType}
        severity={severity}
        dataTier={dataTier}
        agentId={agentId}
        onSearchChange={setSearch}
        onEventTypeChange={setEventType}
        onSeverityChange={setSeverity}
        onDataTierChange={setDataTier}
        onAgentIdChange={setAgentId}
        onApply={refresh}
        onClear={clearFilters}
        hasActive={hasActiveFilters}
        disabled={loading}
      />

      {loading && entries.length === 0 ? (
        <EntriesSkeleton />
      ) : entries.length === 0 ? (
        <EmptyEntries hasActiveFilters={hasActiveFilters} />
      ) : (
        <EntriesTable entries={entries} />
      )}
    </div>
  );
}

// =============================================================================
// Headline stats (last 24h)
// =============================================================================

function StatsStrip({ stats }: { stats: AuditStats }) {
  const criticalCount = stats.bySeverity?.critical ?? 0;
  const warningCount = stats.bySeverity?.warning ?? 0;
  const t3Count = stats.byTier?.T3 ?? 0;
  const t4Count = stats.byTier?.T4 ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat
        label={`Events / last ${stats.windowHours}h`}
        value={stats.totalEvents.toLocaleString()}
      />
      <Stat
        label="Critical"
        value={criticalCount.toString()}
        accent={criticalCount > 0 ? "destructive" : undefined}
      />
      <Stat
        label="Warnings"
        value={warningCount.toString()}
        accent={warningCount > 0 ? "warning" : undefined}
      />
      <Stat
        label="High-tier (T3+T4)"
        value={(t3Count + t4Count).toString()}
        sublabel={`${t3Count} T3 · ${t4Count} T4`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "destructive" | "warning";
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "text-xl font-semibold mt-1",
            accent === "destructive" && "text-destructive",
            accent === "warning" && "text-amber-600 dark:text-amber-400",
          )}
        >
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
// Filter bar
// =============================================================================

interface FilterBarProps {
  search: string;
  eventType: AuditEventType | "";
  severity: AuditSeverity | "";
  dataTier: DataTier | "";
  agentId: string;
  onSearchChange: (v: string) => void;
  onEventTypeChange: (v: AuditEventType | "") => void;
  onSeverityChange: (v: AuditSeverity | "") => void;
  onDataTierChange: (v: DataTier | "") => void;
  onAgentIdChange: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
  hasActive: boolean;
  disabled?: boolean;
}

function FilterBar(props: FilterBarProps) {
  return (
    <Card>
      <CardContent className="py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Filters
          </span>
          {props.hasActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onClear}
              disabled={props.disabled}
              className="ml-auto h-6 text-[11px]"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              value={props.search}
              onChange={(e) => props.onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") props.onApply();
              }}
              placeholder="Free-text search in details…"
              className="pl-7 h-8 text-xs"
              disabled={props.disabled}
            />
          </div>
          <Select
            value={props.eventType}
            onChange={(v) => props.onEventTypeChange(v as AuditEventType | "")}
            options={[{ value: "", label: "Any event type" }].concat(
              EVENT_TYPES.map((t) => ({ value: t, label: t })),
            )}
            disabled={props.disabled}
          />
          <Select
            value={props.severity}
            onChange={(v) => props.onSeverityChange(v as AuditSeverity | "")}
            options={[{ value: "", label: "Any severity" }].concat(
              SEVERITIES.map((s) => ({ value: s, label: s })),
            )}
            disabled={props.disabled}
          />
          <Select
            value={props.dataTier}
            onChange={(v) => props.onDataTierChange(v as DataTier | "")}
            options={[{ value: "", label: "Any tier" }].concat(
              TIERS.map((t) => ({ value: t, label: t })),
            )}
            disabled={props.disabled}
          />
        </div>
        <div className="flex gap-2">
          <Input
            value={props.agentId}
            onChange={(e) => props.onAgentIdChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onApply();
            }}
            placeholder="Agent id (e.g. billing-support-rep)"
            className="h-8 text-xs"
            disabled={props.disabled}
          />
          <Button
            type="button"
            size="sm"
            onClick={props.onApply}
            disabled={props.disabled}
            className="h-8"
          >
            Apply
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-md border border-input bg-background px-2 text-xs",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// =============================================================================
// Entries table
// =============================================================================

function EntriesTable({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="w-[100px]">Severity</TableHead>
              <TableHead className="w-[60px]">Tier</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EntryRow({ entry }: { entry: AuditEntry }) {
  const detailSummary = useMemo(() => summarizeDetails(entry.details), [entry.details]);
  return (
    <TableRow>
      <TableCell className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
        {formatTimestamp(entry.timestamp)}
      </TableCell>
      <TableCell>
        <code className="font-mono text-[11px]">{entry.eventType}</code>
        {entry.metadata?.tenantId && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            tenant: <code className="font-mono">{entry.metadata.tenantId}</code>
            {entry.metadata.departmentId && (
              <>
                {" · dept: "}
                <code className="font-mono">{entry.metadata.departmentId}</code>
              </>
            )}
          </div>
        )}
      </TableCell>
      <TableCell>
        <SeverityBadge severity={entry.severity} />
      </TableCell>
      <TableCell>
        <TierBadge tier={entry.dataTier} />
      </TableCell>
      <TableCell className="text-xs">
        {entry.agentId ? (
          <code className="font-mono text-[11px]">{entry.agentId}</code>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[400px]">
        <div className="truncate" title={JSON.stringify(entry.details)}>
          {detailSummary}
        </div>
      </TableCell>
    </TableRow>
  );
}

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  if (severity === "critical") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <ShieldAlert className="h-3 w-3" />
        critical
      </Badge>
    );
  }
  if (severity === "warning") {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        warning
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] gap-1">
      <ShieldCheck className="h-3 w-3" />
      info
    </Badge>
  );
}

function TierBadge({ tier }: { tier: DataTier }) {
  const isHighTier = tier === "T3" || tier === "T4";
  return (
    <Badge
      variant={isHighTier ? "destructive" : "outline"}
      className="text-[10px] tabular-nums"
      title={tierLabel(tier)}
    >
      <Shield className="h-2.5 w-2.5 mr-0.5" />
      {tier}
    </Badge>
  );
}

// =============================================================================
// Empty + skeleton + helpers
// =============================================================================

function EmptyEntries({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h2 className="mt-3 text-base font-semibold">No audit entries match</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasActiveFilters
            ? "Try clearing some filters or widening the time range."
            : "Once your AI employees start handling tasks, every action will appear here."}
        </p>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Storage:{" "}
          <code className="font-mono">~/.openclaw/sentura-audit/audit-YYYY-MM-DD.jsonl</code>
        </p>
      </CardContent>
    </Card>
  );
}

function EntriesSkeleton() {
  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading audit entries…
        </div>
      </CardContent>
    </Card>
  );
}

function errMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function summarizeDetails(details: Record<string, unknown>): string {
  const entries = Object.entries(details ?? {});
  if (entries.length === 0) return "—";
  // Prefer human-readable scalar fields first
  const preferred = ["message", "action", "tool", "summary", "reason", "name"];
  for (const key of preferred) {
    const v = details[key];
    if (typeof v === "string" && v.trim().length > 0) {
      return `${key}: ${v.length > 120 ? v.slice(0, 117) + "…" : v}`;
    }
  }
  // Fall back to a compact JSON of the first few keys
  const compact = entries
    .slice(0, 3)
    .map(([k, v]) => `${k}=${stringifyScalar(v)}`)
    .join(", ");
  return compact || "—";
}

function stringifyScalar(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 37) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return Array.isArray(v) ? `[${v.length}]` : "{…}";
}

function tierLabel(tier: DataTier): string {
  switch (tier) {
    case "T0":
      return "T0 — public";
    case "T1":
      return "T1 — internal non-sensitive";
    case "T2":
      return "T2 — confidential";
    case "T3":
      return "T3 — restricted (PII / customer / financial)";
    case "T4":
      return "T4 — secret (API keys / credentials)";
  }
}
