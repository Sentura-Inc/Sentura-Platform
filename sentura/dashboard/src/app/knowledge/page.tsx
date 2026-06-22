"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * `/knowledge` — Knowledge Manager UI.
 *
 * Browses the per-employee Enterprise Knowledge Graph: every deployed
 * agent has its own `<agent>/ekg/` directory under
 * `~/.openclaw/workspace/`. Files there are written by Person B's
 * Data Scavenger workspace (markdown today; the `ekg-to-skill-synthesis`
 * skill optionally produces `.json5` skill drafts at sibling paths).
 *
 * Design: agent picker on the left, file list per agent + content
 * preview on the right. No upload zone yet — Data Scavenger ingestion
 * is operator-driven via the agent's own chat session today. The
 * dashboard upload pipeline lands when the Data Scavenger gets a
 * dashboard-side trigger UI (W6+).
 */

interface EkgFileSummary {
  name: string;
  sizeBytes: number;
  modifiedAt: number;
}

interface AgentEntry {
  agentId: string;
  ekgFiles: EkgFileSummary[];
}

interface FileResponse {
  name: string;
  content: string;
  sizeBytes: number;
  modifiedAt: number;
  contentType: "markdown" | "json5";
}

export default function KnowledgePage() {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/agents");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { agents: AgentEntry[] };
      setAgents(json.agents);
      // Auto-select the first agent with EKG files so the page is not
      // a blank pane on first load when data exists.
      if (!activeAgent) {
        const firstWithFiles = json.agents.find(
          (a) => a.ekgFiles.length > 0,
        );
        if (firstWithFiles) setActiveAgent(firstWithFiles.agentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeAgent]);

  useEffect(() => {
    void refresh();
    // refresh has activeAgent in deps, but we only want to fire on
    // mount — the empty deps array would lint-warn, so wrap in a
    // mount-only effect via an ignore flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = useCallback(
    async (agentId: string, name: string) => {
      setFileLoading(true);
      setFileContent(null);
      try {
        const res = await fetch(
          `/api/knowledge/agents/${encodeURIComponent(agentId)}/file/${encodeURIComponent(name)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FileResponse;
        setFileContent(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        setFileLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (activeAgent && activeFile) {
      void loadFile(activeAgent, activeFile);
    } else {
      setFileContent(null);
    }
  }, [activeAgent, activeFile, loadFile]);

  const activeAgentRecord = useMemo(
    () => agents.find((a) => a.agentId === activeAgent) ?? null,
    [agents, activeAgent],
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Knowledge Manager
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Browse the Enterprise Knowledge Graph per employee. Each
              employee&apos;s <code className="font-mono text-xs">ekg/</code>{" "}
              directory holds the Data Scavenger&apos;s output and any
              hand-authored knowledge files. Files are loaded into the
              agent&apos;s system prompt on session start via the{" "}
              <code className="font-mono text-xs">sentura-bootstrap</code>{" "}
              hook.
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

      {loading && agents.length === 0 ? (
        <KnowledgeSkeleton />
      ) : agents.length === 0 ? (
        <EmptyAgents />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <AgentList
            agents={agents}
            activeAgentId={activeAgent}
            onSelect={(id) => {
              setActiveAgent(id);
              setActiveFile(null);
            }}
          />
          <div className="grid gap-6 md:grid-cols-[260px_1fr] min-w-0">
            <FileList
              agent={activeAgentRecord}
              activeFile={activeFile}
              onSelect={setActiveFile}
            />
            <FilePreview
              file={fileContent}
              loading={fileLoading}
              activeFile={activeFile}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Agent picker
// =============================================================================

function AgentList({
  agents,
  activeAgentId,
  onSelect,
}: {
  agents: AgentEntry[];
  activeAgentId: string | null;
  onSelect: (agentId: string) => void;
}) {
  return (
    <Card className="self-start">
      <CardContent className="p-2">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Employees
        </div>
        <ul className="space-y-0.5">
          {agents.map((a) => (
            <li key={a.agentId}>
              <button
                type="button"
                onClick={() => onSelect(a.agentId)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left",
                  a.agentId === activeAgentId
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                )}
              >
                <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-mono text-xs">
                  {a.agentId}
                </span>
                {a.ekgFiles.length > 0 ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {a.ekgFiles.length}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// File list (per active agent)
// =============================================================================

function FileList({
  agent,
  activeFile,
  onSelect,
}: {
  agent: AgentEntry | null;
  activeFile: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <Card className="self-start">
      <CardContent className="p-2">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <FolderOpen className="h-3 w-3" />
          ekg/
        </div>
        {!agent ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Select an employee.
          </p>
        ) : agent.ekgFiles.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No EKG files yet for{" "}
            <code className="font-mono">{agent.agentId}</code>.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {agent.ekgFiles.map((f) => (
              <li key={f.name}>
                <button
                  type="button"
                  onClick={() => onSelect(f.name)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left",
                    f.name === activeFile
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-mono text-xs">
                    {f.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {humanBytes(f.sizeBytes)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// File preview
// =============================================================================

function FilePreview({
  file,
  loading,
  activeFile,
}: {
  file: FileResponse | null;
  loading: boolean;
  activeFile: string | null;
}) {
  if (!activeFile) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Pick a file from the list to view its contents.
        </CardContent>
      </Card>
    );
  }
  if (loading || !file) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <code className="font-mono text-xs truncate">{file.name}</code>
            <Badge variant="outline" className="text-[10px] capitalize">
              {file.contentType}
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground shrink-0">
            {humanBytes(file.sizeBytes)} · {new Date(file.modifiedAt).toLocaleDateString()}
          </div>
        </div>
        <pre className="overflow-auto max-h-[60vh] px-4 py-3 text-xs font-mono whitespace-pre-wrap break-words text-foreground/90">
          {file.content}
        </pre>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Empty / loading
// =============================================================================

function EmptyAgents() {
  return (
    <Card>
      <CardContent className="py-10">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No employees deployed yet</h2>
          <p className="text-sm text-muted-foreground">
            Create an employee via{" "}
            <a href="/create" className="underline">/create</a> first.
            Their <code className="font-mono">ekg/</code> directory will
            appear here once the Data Scavenger has ingested any documents
            for them, or once you hand-author files into{" "}
            <code className="font-mono text-xs">~/.openclaw/workspace/&lt;agent&gt;/ekg/</code>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function KnowledgeSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <Card>
        <CardContent className="py-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading employees…
        </CardContent>
      </Card>
    </div>
  );
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
