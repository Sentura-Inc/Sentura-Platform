"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ExternalLink,
  Globe,
  Loader2,
  Package,
  RefreshCw,
  Sparkles,
  WifiOff,
  Wrench,
} from "lucide-react";
import { useGateway } from "@/lib/gateway";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

type Tier = "tier1" | "tier2" | "tier3";

/**
 * Raw MCP server entry shape — OpenClaw config uses `command` + `args`
 * arrays for stdio transport, optionally augmented with `env` and (where
 * Sentura needs it) a Sentura-specific metadata bag for tier classification.
 *
 * Today the config has no formal `tier` field, so we infer with a heuristic
 * (see classifyTier below). Follow-up for Person A: standardize a
 * `tier: 1 | 2 | 3` field on the MCP entry so this client-side guess can
 * become a server-side fact.
 */
interface McpEntry {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Optional Sentura-only fields the dashboard expects for richer rendering */
  sentura?: {
    tier?: 1 | 2 | 3;
    sourcePath?: string;
    generatedFrom?: string;
    generatedAtMs?: number;
    saasProvider?: string;
    accountEmail?: string;
    lastRotationMs?: number;
    status?: "connected" | "needs-reauth" | "suspended";
  };
}

function classifyTier(entry: McpEntry): Tier {
  // Honor explicit tier metadata first.
  if (entry.sentura?.tier === 1) return "tier1";
  if (entry.sentura?.tier === 2) return "tier2";
  if (entry.sentura?.tier === 3) return "tier3";
  // Heuristic: any entry with a Sentura SaaS provider field is T3.
  if (entry.sentura?.saasProvider) return "tier3";
  // Heuristic: a path under sentura/mcp-servers/ is T2.
  const firstArg = entry.args?.[0] ?? "";
  if (
    firstArg.includes("sentura/mcp-servers/") ||
    entry.command?.includes("sentura/mcp-servers/")
  ) {
    return "tier2";
  }
  // Default: T1 (open-source / generic). Most config-only servers fall here.
  return "tier1";
}

/**
 * `/integrations` — MCP server manager.
 *
 * Per Week 4 D2: tabbed by tier (T1 open-source / T2 Sentura-generated /
 * T3 self-provisioned). Each tier has tier-specific metadata and actions
 * so a single unified table is wrong; tabs let each view optimize for
 * its lifecycle (T1: update; T2: regenerate; T3: rotate credential).
 *
 * Today (zero MCP servers configured) all three tabs show explanatory
 * empty states that describe what the tier is and how to add a server
 * in it. This is intentional per Week 4 D5 — honest empty states act as
 * a cross-team signal to the MCP Builder agent (Person B) and the
 * self-provisioning extension (Person D).
 */
export default function IntegrationsPage() {
  const { client, state } = useGateway();
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (state !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const cfg = await client.getConfig();
      setConfig(cfg);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to load config";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [client, state]);

  useEffect(() => {
    if (state !== "connected") return;
    void refresh();
  }, [state, refresh]);

  const entries = useMemo(() => extractMcpEntries(config), [config]);

  const grouped = useMemo(() => {
    const out: Record<Tier, McpEntry[]> = { tier1: [], tier2: [], tier3: [] };
    for (const e of entries) out[classifyTier(e)].push(e);
    return out;
  }, [entries]);

  const disconnected = state === "disconnected" || state === "reconnecting";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            MCP servers wired into your AI employees. Sentura uses a
            three-tier strategy: open-source packages (T1), enterprise-
            generated servers built from your API docs (T2), and
            self-provisioned SaaS connections (T3) the agent sets up
            on its own with your approval.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading || state !== "connected"}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <a
            href={`${CONTROL_UI_URL}/#config`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Edit raw config
          </a>
        </div>
      </div>

      {disconnected && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <WifiOff className="h-4 w-4" />
              Gateway disconnected. MCP server status will refresh once the
              connection is restored.
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tier1">
        <TabsList>
          <TabsTrigger value="tier1" className="gap-2">
            <Package className="h-3.5 w-3.5" />
            <span>Open-source</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              T1 · {grouped.tier1.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="tier2" className="gap-2">
            <Wrench className="h-3.5 w-3.5" />
            <span>Sentura-generated</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              T2 · {grouped.tier2.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="tier3" className="gap-2">
            <Globe className="h-3.5 w-3.5" />
            <span>Self-provisioned</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              T3 · {grouped.tier3.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tier1" className="mt-4">
          {loading && grouped.tier1.length === 0 ? (
            <TableSkeleton />
          ) : grouped.tier1.length === 0 ? (
            <Tier1EmptyState />
          ) : (
            <Tier1Table entries={grouped.tier1} />
          )}
        </TabsContent>

        <TabsContent value="tier2" className="mt-4">
          {loading && grouped.tier2.length === 0 ? (
            <TableSkeleton />
          ) : grouped.tier2.length === 0 ? (
            <Tier2EmptyState />
          ) : (
            <Tier2Table entries={grouped.tier2} />
          )}
        </TabsContent>

        <TabsContent value="tier3" className="mt-4">
          {loading && grouped.tier3.length === 0 ? (
            <TableSkeleton />
          ) : grouped.tier3.length === 0 ? (
            <Tier3EmptyState />
          ) : (
            <Tier3Table entries={grouped.tier3} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

/** Pull MCP entries from the gateway config. Looks at the top-level
 * `mcp` / `mcpServers` map (used by OpenClaw native), and at each agent's
 * `mcpServers` (Sentura adds these per-agent). De-duplicates by name. */
function extractMcpEntries(
  config: Record<string, unknown> | null,
): McpEntry[] {
  if (!config) return [];
  const out = new Map<string, McpEntry>();

  const addFromMap = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      out.set(name, {
        name,
        command: typeof v.command === "string" ? v.command : undefined,
        args: Array.isArray(v.args) ? (v.args as string[]) : undefined,
        env:
          v.env && typeof v.env === "object"
            ? (v.env as Record<string, string>)
            : undefined,
        sentura:
          v.sentura && typeof v.sentura === "object"
            ? (v.sentura as McpEntry["sentura"])
            : undefined,
      });
    }
  };

  addFromMap(config.mcp);
  addFromMap(config.mcpServers);

  const agents = config.agents as { list?: unknown[] } | undefined;
  if (agents?.list && Array.isArray(agents.list)) {
    for (const agent of agents.list) {
      if (!agent || typeof agent !== "object") continue;
      addFromMap((agent as Record<string, unknown>).mcpServers);
    }
  }

  return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatRelativeTime(ms?: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return new Date(ms).toLocaleDateString();
}

// =============================================================================
// Tier 1 — open-source npm packages
// =============================================================================

function Tier1Table({ entries }: { entries: McpEntry[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Server</TableHead>
              <TableHead>Command</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.name}>
                <TableCell>
                  <div className="font-medium text-sm">{e.name}</div>
                </TableCell>
                <TableCell>
                  <code className="font-mono text-xs">
                    {e.command ?? "—"}
                    {e.args?.length ? ` ${e.args.join(" ")}` : ""}
                  </code>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" disabled>
                    Check updates
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      W5
                    </Badge>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Tier1EmptyState() {
  return (
    <EmptyTierCard
      icon={<Package className="h-6 w-6 text-primary" />}
      title="No open-source MCP servers configured"
    >
      <p>
        Tier 1 servers are off-the-shelf MCP packages from npm — anything
        from the official MCP registry that wraps a public API or local
        capability (filesystem, search, GitHub, etc).
      </p>
      <p>
        Add one by editing the raw config in the Control UI:{" "}
        <code className="font-mono text-xs">
          {`mcp.<name> = { command: "npx", args: ["@modelcontextprotocol/server-…"] }`}
        </code>
        . Sentura&apos;s 3-tier MCP doc lives in{" "}
        <code className="font-mono text-xs">docs/DESIGN.md</code> § Section 14.
      </p>
    </EmptyTierCard>
  );
}

// =============================================================================
// Tier 2 — Sentura-generated (built by MCP Builder agent from API docs)
// =============================================================================

function Tier2Table({ entries }: { entries: McpEntry[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Server</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Generated from</TableHead>
              <TableHead>Last regenerated</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.name}>
                <TableCell className="font-medium text-sm">{e.name}</TableCell>
                <TableCell>
                  <code className="font-mono text-[11px]">
                    {e.sentura?.sourcePath ?? "—"}
                  </code>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {e.sentura?.generatedFrom ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelativeTime(e.sentura?.generatedAtMs)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" disabled>
                    Regenerate
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      W5
                    </Badge>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Tier2EmptyState() {
  return (
    <EmptyTierCard
      icon={<Wrench className="h-6 w-6 text-primary" />}
      title="No Sentura-generated MCP servers yet"
    >
      <p>
        Tier 2 servers are TypeScript MCP servers built by the MCP Builder
        agent (&quot;Socket&quot;) from your API documentation. The Builder
        reads OpenAPI specs, markdown API docs (like the ones under{" "}
        <code className="font-mono text-xs">ekg/</code>), or raw URLs and
        generates a typed server under{" "}
        <code className="font-mono text-xs">sentura/mcp-servers/&lt;name&gt;/</code>
        .
      </p>
      <p>
        The first Tier 2 server in this repo is{" "}
        <code className="font-mono text-xs">gradsale-admin</code> (29 tools
        wrapping the GradSale admin API; not auto-loaded into the live
        config — wire it via Control UI when an agent needs it).
      </p>
      <p>
        Trigger a new generation: ask the MCP Builder via chat (Week 5
        when its dashboard surface lands), or invoke directly via the
        Builder&apos;s gateway tool.
      </p>
    </EmptyTierCard>
  );
}

// =============================================================================
// Tier 3 — self-provisioned SaaS (agent set up via browser automation)
// =============================================================================

function Tier3Table({ entries }: { entries: McpEntry[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Server</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last credential rotation</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.name}>
                <TableCell className="font-medium text-sm">{e.name}</TableCell>
                <TableCell className="text-xs">
                  {e.sentura?.saasProvider ?? "—"}
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {e.sentura?.accountEmail ?? "—"}
                </TableCell>
                <TableCell>
                  <Tier3StatusBadge status={e.sentura?.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelativeTime(e.sentura?.lastRotationMs)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" disabled>
                    Rotate credential
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      W5
                    </Badge>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Tier3StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const variant: "default" | "secondary" | "destructive" =
    status === "connected"
      ? "default"
      : status === "needs-reauth"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] capitalize">
      {status.replace("-", " ")}
    </Badge>
  );
}

function Tier3EmptyState() {
  return (
    <EmptyTierCard
      icon={<Globe className="h-6 w-6 text-primary" />}
      title="No self-provisioned SaaS connections yet"
    >
      <p>
        Tier 3 is the most autonomous: an AI employee (with your approval)
        navigates to a SaaS site via the{" "}
        <code className="font-mono text-xs">browser</code> tool, signs up
        for an account, captures the API key, stores it in Sentura&apos;s
        secret store, and writes the resulting MCP server entry to its
        own config — all under HITL gates routed through{" "}
        <a
          href="/approvals"
          className="underline hover:text-foreground"
        >
          /approvals
        </a>
        .
      </p>
      <p>
        Tier 3 lifecycle work (registration flow, credential rotation,
        re-auth on token expiry) is owned by Person D&apos;s{" "}
        <code className="font-mono text-xs">sentura-provisioner</code>{" "}
        extension — Week 3 deliverable, expected to start producing
        entries here once an agent triggers self-provisioning.
      </p>
    </EmptyTierCard>
  );
}

// =============================================================================
// Shared empty-state card
// =============================================================================

function EmptyTierCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
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
          <div className="space-y-3 text-sm text-muted-foreground">
            {children}
          </div>
          <div className="flex items-center justify-center gap-1 pt-2 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>3-tier MCP strategy is documented in</span>
            <code className="font-mono">docs/DESIGN.md § Section 14</code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48 ml-auto" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
          Loading MCP servers…
        </div>
      </CardContent>
    </Card>
  );
}
