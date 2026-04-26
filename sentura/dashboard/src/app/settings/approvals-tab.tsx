"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Edit, ScrollText } from "lucide-react";
import { useGateway } from "@/lib/gateway";
import { usePermission } from "@/lib/auth/use-permission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ExecApprovalPolicy {
  pattern?: string;
  decision?: "allow" | "ask" | "deny" | string;
  reason?: string;
}

interface PluginApprovalPolicy {
  plugin?: string;
  capability?: string;
  decision?: "allow" | "ask" | "deny" | string;
}

/**
 * Approvals tab — read-only display of the active approval policy
 * configuration (`exec.approvals` + `plugins.approvals`). Per Week 5
 * Phase 3: read-only today; "Edit policy" gated by usePermission and
 * disabled until W6 ships Person A's policy patch RPC.
 */
export function ApprovalsTab() {
  const { client, state } = useGateway();
  const { allowed: canWrite } = usePermission("settings.write");

  const [execPolicies, setExecPolicies] = useState<ExecApprovalPolicy[]>([]);
  const [pluginPolicies, setPluginPolicies] = useState<PluginApprovalPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "connected") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const cfg = await client.getConfig();
        if (cancelled) return;
        const exec = cfg?.exec as { approvals?: ExecApprovalPolicy[] } | undefined;
        const plugins = cfg?.plugins as { approvals?: PluginApprovalPolicy[] } | undefined;
        setExecPolicies(Array.isArray(exec?.approvals) ? exec.approvals : []);
        setPluginPolicies(Array.isArray(plugins?.approvals) ? plugins.approvals : []);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load approval policies";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, state]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Approval policies decide which agent actions auto-approve, prompt
          a human, or deny outright. Read-only today — edit support lands
          when Person A ships the policy patch RPC (Week 6).
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!canWrite}
          title={!canWrite ? "Edit requires settings.write" : "Coming Week 6"}
        >
          <Edit className="h-3.5 w-3.5 mr-1" />
          Edit policy
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Exec approvals ({execPolicies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PolicyLoading />
          ) : execPolicies.length === 0 ? (
            <PolicyEmpty kind="exec" />
          ) : (
            <PolicyList
              rows={execPolicies.map((p, i) => ({
                key: `${i}-${p.pattern}`,
                primary: p.pattern ?? "(unnamed pattern)",
                decision: p.decision ?? "ask",
                detail: p.reason,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" />
            Plugin approvals ({pluginPolicies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PolicyLoading />
          ) : pluginPolicies.length === 0 ? (
            <PolicyEmpty kind="plugin" />
          ) : (
            <PolicyList
              rows={pluginPolicies.map((p, i) => ({
                key: `${i}-${p.plugin}-${p.capability}`,
                primary: `${p.plugin ?? "?"} → ${p.capability ?? "?"}`,
                decision: p.decision ?? "ask",
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PolicyLoading() {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading policies…
    </div>
  );
}

function PolicyEmpty({ kind }: { kind: "exec" | "plugin" }) {
  return (
    <div className="text-sm text-muted-foreground py-2">
      No {kind} approval policies configured. Defaults apply: every
      sensitive {kind} action prompts the operator. Configure policies in
      <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-mono">
        ~/.openclaw/openclaw.json
      </code>
      under
      <code className="ml-1 rounded bg-muted px-1 py-0.5 text-xs font-mono">
        {kind === "exec" ? "exec.approvals" : "plugins.approvals"}
      </code>
      .
    </div>
  );
}

function PolicyList({
  rows,
}: {
  rows: Array<{ key: string; primary: string; decision: string; detail?: string }>;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.key} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <code className="text-xs font-mono break-all">{row.primary}</code>
            {row.detail && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {row.detail}
              </p>
            )}
          </div>
          <DecisionBadge decision={row.decision} />
        </li>
      ))}
    </ul>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const variant: Record<string, { label: string; className: string }> = {
    allow: {
      label: "auto-allow",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    ask: {
      label: "ask",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    deny: {
      label: "deny",
      className: "bg-destructive/10 text-destructive",
    },
  };
  const v = variant[decision] ?? {
    label: decision,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`shrink-0 ${v.className}`}>
      {v.label}
    </Badge>
  );
}
