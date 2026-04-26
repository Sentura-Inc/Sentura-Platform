"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Network,
  RefreshCw,
  Shield,
  Sliders,
  Trash2,
  Wrench,
} from "lucide-react";
import { useGateway } from "@/lib/gateway";
import type {
  AgentConfig,
  AgentFileContent,
  AgentFileEntry,
  BindingConfig,
} from "@/lib/gateway";
import { usePermission } from "@/lib/auth/use-permission";
import { SkeletonBlock } from "@/components/skeleton-block";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

/**
 * The `agents.files.get` RPC serves the 8 OpenClaw-native workspace files
 * (AGENTS/SOUL/TOOLS/IDENTITY/USER/HEARTBEAT/BOOTSTRAP + MEMORY). Sentura
 * agents also author per-skill SKILL.md files and per-user memory under
 * `memory/users/`, which must be read/edited through the Control UI's
 * file editor. We surface that gap explicitly rather than silently hiding
 * those files.
 */

function formatBytes(bytes?: number): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRelativeTime(ms?: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return new Date(ms).toLocaleDateString();
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const agentId = useMemo(
    () => (Array.isArray(rawId) ? rawId[0] : (rawId ?? "")),
    [rawId],
  );

  const { client, state } = useGateway();
  const { allowed: canDelete } = usePermission("agents.delete");

  const [agent, setAgent] = useState<AgentConfig | undefined>(undefined);
  const [files, setFiles] = useState<AgentFileEntry[] | null>(null);
  const [bindings, setBindings] = useState<BindingConfig[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Currently-selected workspace file and its cached content.
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [fileCache, setFileCache] = useState<Record<string, AgentFileContent | null>>({});
  const [fileLoading, setFileLoading] = useState(false);

  const [retireOpen, setRetireOpen] = useState(false);
  const [retireSubmitting, setRetireSubmitting] = useState(false);
  const [retireError, setRetireError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (state !== "connected" || !agentId) return;
    setLoading(true);
    setError(null);
    try {
      const [a, f, b] = await Promise.all([
        client.getAgent(agentId),
        client.listAgentFiles(agentId).catch(() => [] as AgentFileEntry[]),
        client.getBindingsForAgent(agentId).catch(() => [] as BindingConfig[]),
      ]);
      setAgent(a);
      setFiles(f);
      setBindings(b);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to load employee";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [client, state, agentId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-select the first *existing* file (preferring SOUL.md) once files load.
  useEffect(() => {
    if (!files || activeFileName) return;
    const present = files.filter((f) => !f.missing);
    const preferred =
      present.find((f) => f.name === "SOUL.md") ??
      present.find((f) => f.name === "AGENTS.md") ??
      present[0];
    if (preferred) setActiveFileName(preferred.name);
  }, [files, activeFileName]);

  // Lazy-load content when the active tab changes.
  useEffect(() => {
    if (!activeFileName || !agentId) return;
    if (fileCache[activeFileName] !== undefined) return;
    setFileLoading(true);
    client
      .getAgentFile(agentId, activeFileName)
      .then((content) => {
        setFileCache((prev) => ({ ...prev, [activeFileName]: content }));
      })
      .catch(() => {
        setFileCache((prev) => ({ ...prev, [activeFileName]: null }));
      })
      .finally(() => setFileLoading(false));
  }, [client, agentId, activeFileName, fileCache]);

  const handleRetire = useCallback(async () => {
    if (!agentId) return;
    setRetireSubmitting(true);
    setRetireError(null);
    try {
      await client.deleteAgent(agentId, { deleteFiles: true });
      setRetireOpen(false);
      router.push("/employees");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to retire employee";
      setRetireError(msg);
    } finally {
      setRetireSubmitting(false);
    }
  }, [client, agentId, router]);

  const presentFiles = useMemo(
    () => (files ?? []).filter((f) => !f.missing),
    [files],
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href="/employees"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight truncate">
                {agent?.name ?? agentId}
              </h1>
              <p className="text-xs font-mono text-muted-foreground truncate">
                {agentId}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            disabled={loading || state !== "connected"}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {/* W3 placeholder kept disabled — /tune surface ships in W6 employee-detail
              integration (see week-6 plan). Today /tune is its own surface and
              this button stays as a teaser for inline access. */}
          <Button variant="outline" size="sm" disabled>
            <Sliders className="h-4 w-4 mr-1" />
            Tune
            <Badge variant="secondary" className="ml-2 text-[10px]">
              W3
            </Badge>
          </Button>
          <a
            href={`${CONTROL_UI_URL}/#agents`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Edit in Control UI
          </a>
          {/* Per Week 5 D1 (hard-hide): non-platform_admin roles don't see
              the Retire surface at all — drops attack surface + removes
              the "what does this disabled button do?" cognitive load. */}
          {canDelete && (
          <Dialog open={retireOpen} onOpenChange={setRetireOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Retire
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Retire {agent?.name ?? agentId}?
                </DialogTitle>
                <DialogDescription>
                  This will remove the employee from the live config, move their
                  workspace and state to the trash, and detach all channel
                  bindings. Transcripts will be preserved for audit but the
                  agent will no longer respond to messages.
                </DialogDescription>
              </DialogHeader>
              {retireError && (
                <p className="text-sm text-destructive">{retireError}</p>
              )}
              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" disabled={retireSubmitting} />}
                >
                  Cancel
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleRetire}
                  disabled={retireSubmitting}
                >
                  {retireSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Retire Employee
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure the OpenClaw gateway is running and the agent ID is
              valid.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && !agent ? (
        <DetailSkeleton />
      ) : !agent ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No employee found with ID {agentId}.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Config summary */}
          <ConfigSummaryCard agent={agent} />

          {/* Workspace files */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Workspace Files
                {files && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({presentFiles.length} present)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!files ? (
                <Skeleton className="h-32 w-full" />
              ) : presentFiles.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No workspace files have been authored yet.
                </div>
              ) : (
                <Tabs
                  value={activeFileName ?? presentFiles[0].name}
                  onValueChange={(v) =>
                    setActiveFileName(typeof v === "string" ? v : null)
                  }
                  orientation="horizontal"
                >
                  <TabsList className="flex-wrap h-auto">
                    {presentFiles.map((f) => (
                      <TabsTrigger
                        key={f.name}
                        value={f.name}
                        className="text-xs"
                      >
                        {f.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {presentFiles.map((f) => (
                    <TabsContent key={f.name} value={f.name} className="mt-3">
                      <FileMetaBar entry={f} />
                      <Separator className="my-2" />
                      <FileContentPane
                        name={f.name}
                        content={fileCache[f.name] ?? null}
                        loading={fileLoading && activeFileName === f.name}
                        hasLoaded={fileCache[f.name] !== undefined}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              )}

              {/* Extra Sentura files that live outside the RPC allow-list */}
              <Separator className="my-4" />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Additional Sentura files (view in Control UI)
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${CONTROL_UI_URL}/#agents`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    skills/
                    <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                  </a>
                  <a
                    href={`${CONTROL_UI_URL}/#agents`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    memory/users/
                    <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                  </a>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Per-skill SKILL.md files and per-user memory files are not
                  exposed via <code className="font-mono">agents.files.get</code>.
                  Use the Control UI&apos;s file editor to view or edit them.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Channel Bindings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4" />
                Channel Bindings
                {bindings && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({bindings.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BindingsList bindings={bindings} />
            </CardContent>
          </Card>

          {/* Lifecycle — clone / version history / health score / retire.
              Per Week 5 D5 (tab-on-detail vs separate workflow): keep
              everything in /employees/[id] context. Today blocked on
              Person B's lifecycle API; ships as one consolidated
              SkeletonBlock listing all 4 future actions. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Lifecycle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SkeletonBlock
                blockingOwner="Person B"
                blockingDeliverable="employee lifecycle API (clone / version / health / retire)"
                targetWeek="Week 5"
                willInclude={[
                  "Clone employee — duplicate this agent's config + workspace files into a new agent with a chosen name; useful for spinning up A/B variants",
                  "Version history — list of prior config + workspace snapshots with diff viewer; one-click rollback gated by `agents.delete` (since rollback wipes intervening changes)",
                  "Health score — response quality / error rate / approval rejection rate over the last 7d, surfaced as a single 0-100 with drill-down to per-dimension breakdown",
                  "Retire — graceful shutdown wizard: drain in-flight sessions, hand off to backup agent if configured, archive workspace + transcripts to cold storage, audit-log the retirement",
                ]}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ConfigSummaryCard({ agent }: { agent: AgentConfig }) {
  const items: { label: string; value: React.ReactNode }[] = [
    {
      label: "Model",
      value: <span className="font-mono text-xs">{agent.model}</span>,
    },
    {
      label: "Runtime",
      value: (
        <span className="font-mono text-xs">
          {agent.runtime?.type ?? "default"}
        </span>
      ),
    },
    {
      label: "Sandbox",
      value: agent.sandbox?.mode ? (
        <Badge variant="outline" className="text-xs">
          <Shield className="h-3 w-3 mr-1" />
          {agent.sandbox.mode}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
    },
    {
      label: "Tools Profile",
      value: agent.tools?.profile ? (
        <Badge variant="secondary" className="text-xs">
          <Wrench className="h-3 w-3 mr-1" />
          {agent.tools.profile}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">default</span>
      ),
    },
    {
      label: "Memory Search",
      value: agent.memorySearch?.enabled ? (
        <Badge variant="default" className="text-xs">
          enabled
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">disabled</span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {items.map((it) => (
            <div key={it.label} className="flex flex-col gap-1">
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {it.label}
              </dt>
              <dd>{it.value}</dd>
            </div>
          ))}
        </dl>
        {(agent.tools?.alsoAllow?.length ||
          agent.tools?.deny?.length) && (
          <>
            <Separator className="my-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agent.tools?.alsoAllow?.length ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Extra allow
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {agent.tools.alsoAllow.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="font-mono text-[10px]"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {agent.tools?.deny?.length ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Deny
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {agent.tools.deny.map((t) => (
                      <Badge
                        key={t}
                        variant="destructive"
                        className="font-mono text-[10px]"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FileMetaBar({ entry }: { entry: AgentFileEntry }) {
  return (
    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
      <span className="font-mono truncate max-w-[60%]">{entry.path}</span>
      <span>
        {formatBytes(entry.size)} · Updated {formatRelativeTime(entry.updatedAtMs)}
      </span>
    </div>
  );
}

function FileContentPane({
  name,
  content,
  loading,
  hasLoaded,
}: {
  name: string;
  content: AgentFileContent | null;
  loading: boolean;
  hasLoaded: boolean;
}) {
  if (loading || !hasLoaded) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!content) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Unable to load {name}. It may have been deleted or access may be
        restricted.
      </div>
    );
  }
  return (
    <pre className="max-h-[500px] overflow-auto rounded-md bg-muted/40 p-3 text-[12px] leading-relaxed whitespace-pre-wrap break-words font-mono">
      {content.content}
    </pre>
  );
}

function BindingsList({ bindings }: { bindings: BindingConfig[] | null }) {
  if (!bindings) return <Skeleton className="h-20 w-full" />;
  if (bindings.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No channel bindings.{" "}
        <a
          href={`${CONTROL_UI_URL}/#config`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Add one in the Control UI
        </a>
        .
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {bindings.map((b, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Network className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {b.match?.channel ?? "any channel"}
              </p>
              <p className="text-[11px] font-mono text-muted-foreground truncate">
                {b.match?.accountId ? `account: ${b.match.accountId}` : ""}
                {b.match?.peer
                  ? ` · peer: ${b.match.peer.kind}:${b.match.peer.id}`
                  : ""}
                {!b.match?.accountId && !b.match?.peer ? "no filters" : ""}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            binding #{i + 1}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
