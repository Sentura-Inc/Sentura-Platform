"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Briefcase,
  CheckCircle2,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/orchestrator` — Mode B operations surface.
 *
 * Reads the four Manager EKG pillars Person B shipped Week 4 at
 * `~/.openclaw/workspace/orchestrator/ekg/{capabilities,conflicts,
 * insights,global-sops}/*.json5` via the server-side Route Handler at
 * `/api/orchestrator/ekg`.
 *
 * Today the only pillar with data is `capabilities/` (populated by
 * Creator's `capability-extraction` SKILL.md after a successful deploy);
 * `conflicts/`, `insights/`, `global-sops/` are populated by Week-5
 * Manager skills (cap #17 Mechanism 2 / 3) so we render honest empty
 * states for those tabs.
 */

interface PillarEntry {
  filename: string;
  data: unknown;
}

interface EkgResponse {
  workspaceRoot: string;
  pillars: {
    capabilities: PillarEntry[];
    conflicts: PillarEntry[];
    insights: PillarEntry[];
    globalSops: PillarEntry[];
  };
  errors: { pillar: string; filename: string; message: string }[];
}

interface CapabilityRecord {
  agentId?: string;
  name?: string;
  department?: string;
  deployedAt?: string;
  deployedBy?: string;
  capabilityTags?: string[];
  invokableSkills?: string[];
  approvalsRequired?: string[];
  costEstimate?: { tokensPerTask?: number; model?: string };
  provenance?: { source?: string; extractedAt?: string; confidence?: number };
  reviewRequired?: boolean;
  ioSchemas?: {
    accepts?: { kind: string; description?: string; required?: string[] }[];
    produces?: { kind: string; description?: string; values?: string[] }[];
  };
}

export default function OrchestratorPage() {
  const [data, setData] = useState<EkgResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orchestrator/ekg");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as EkgResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load EKG");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    if (!data) return { c: 0, x: 0, i: 0, g: 0 };
    return {
      c: data.pillars.capabilities.length,
      x: data.pillars.conflicts.length,
      i: data.pillars.insights.length,
      g: data.pillars.globalSops.length,
    };
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Orchestrator
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Mode B operations — Conductor&apos;s view of every employee&apos;s
              capabilities, cross-department conflicts, periodic insights, and
              canonicalized global SOPs.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={loading ? "h-4 w-4 mr-1 animate-spin" : "h-4 w-4 mr-1"} />
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

      {data?.errors && data.errors.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {data.errors.length} EKG file{data.errors.length === 1 ? "" : "s"} failed to parse
            </div>
            <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
              {data.errors.map((e) => (
                <li key={`${e.pillar}/${e.filename}`}>
                  <code className="font-mono">{e.pillar}/{e.filename}</code> — {e.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="capabilities">
        <TabsList>
          <TabsTrigger value="capabilities" className="gap-2">
            <Bot className="h-3.5 w-3.5" />
            <span>Capabilities</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              M1 · {counts.c}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-2">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Conflicts</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              M2 · {counts.x}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Insights</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              M3 · {counts.i}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="globalSops" className="gap-2">
            <Briefcase className="h-3.5 w-3.5" />
            <span>Global SOPs</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {counts.g}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="capabilities" className="mt-4">
          {loading && !data ? (
            <PillarSkeleton />
          ) : (
            <CapabilitiesPillar entries={data?.pillars.capabilities ?? []} />
          )}
        </TabsContent>

        <TabsContent value="conflicts" className="mt-4">
          <PillarEmpty
            icon={<ShieldAlert className="h-6 w-6 text-primary" />}
            title="No cross-department conflicts detected"
            body={
              <>
                Conflicts are written to <code className="font-mono text-xs">
                  orchestrator/ekg/conflicts/&#123;conflict-id&#125;.json5
                </code>{" "}
                by Manager skill <strong>cross-domain conflict detection</strong>{" "}
                (capability #17 Mechanism 2). That cron-triggered skill is on
                Person B&apos;s Week 5 roadmap. Once running, this tab will
                surface each conflict awaiting <code>ekg_manager</code>{" "}
                resolution.
              </>
            }
          />
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <PillarEmpty
            icon={<Sparkles className="h-6 w-6 text-primary" />}
            title="No optimization insights yet"
            body={
              <>
                Insights come from the <strong>reverse-injection training</strong>{" "}
                skill (capability #17 Mechanism 3, Week 5). Each entry is a
                systemic pattern + prescribed fix written to{" "}
                <code className="font-mono text-xs">
                  orchestrator/ekg/insights/
                </code>
                .
              </>
            }
          />
        </TabsContent>

        <TabsContent value="globalSops" className="mt-4">
          <PillarEmpty
            icon={<Briefcase className="h-6 w-6 text-primary" />}
            title="No global SOPs canonicalized yet"
            body={
              <>
                Global SOPs are born from resolved conflicts. When a row in{" "}
                <strong>Conflicts</strong> is resolved by an{" "}
                <code>ekg_manager</code>, the resolution is canonicalized to{" "}
                <code className="font-mono text-xs">
                  orchestrator/ekg/global-sops/
                </code>{" "}
                so future conflicts can reference the precedent.
              </>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================================
// Capabilities pillar — Person B's capability-extraction skill output
// =============================================================================

function CapabilitiesPillar({ entries }: { entries: PillarEntry[] }) {
  if (entries.length === 0) {
    return (
      <PillarEmpty
        icon={<Bot className="h-6 w-6 text-primary" />}
        title="No employee capabilities recorded yet"
        body={
          <>
            When the Creator agent finishes deploying an employee, its{" "}
            <code className="font-mono text-xs">capability-extraction</code>{" "}
            skill writes the employee&apos;s capability manifest to{" "}
            <code className="font-mono text-xs">
              orchestrator/ekg/capabilities/&#123;agent-id&#125;.json5
            </code>
            . Deploy an employee via <a href="/create" className="underline">/create</a> to see
            it appear here.
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Capability tags</TableHead>
                <TableHead>Approvals required</TableHead>
                <TableHead>Deployed</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <CapabilityRow key={e.filename} entry={e} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CapabilityRow({ entry }: { entry: PillarEntry }) {
  const c = entry.data as CapabilityRecord;
  const tags = c.capabilityTags ?? [];
  const approvals = c.approvalsRequired ?? [];
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-sm">{c.name ?? c.agentId ?? entry.filename}</div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {c.agentId ?? "—"}
        </div>
      </TableCell>
      <TableCell className="text-sm">{c.department ?? "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 max-w-[280px]">
          {tags.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            tags.slice(0, 4).map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="text-[10px] font-normal"
              >
                {t}
              </Badge>
            ))
          )}
          {tags.length > 4 && (
            <Badge variant="outline" className="text-[10px]">
              +{tags.length - 4}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {approvals.length === 0 ? (
          <CheckCircle2 className="h-4 w-4 text-muted-foreground/60" />
        ) : (
          <Badge variant="outline" className="text-[10px]">
            {approvals.length}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {c.deployedAt ? new Date(c.deployedAt).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {typeof c.provenance?.confidence === "number"
          ? `${Math.round(c.provenance.confidence * 100)}%`
          : "—"}
      </TableCell>
    </TableRow>
  );
}

// =============================================================================
// Shared empty / loading
// =============================================================================

function PillarEmpty({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-10">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {icon}
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {body}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PillarSkeleton() {
  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-48 ml-auto" />
          </div>
        ))}
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
          Loading EKG…
        </div>
      </CardContent>
    </Card>
  );
}
