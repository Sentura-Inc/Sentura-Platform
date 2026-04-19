"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Terminal,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useApprovals, useGateway } from "@/lib/gateway";
import type { ApprovalRequest } from "@/lib/gateway";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

type Decision = "allow-once" | "allow-always" | "deny";

/**
 * Derive a short, human-readable description of an approval from its raw
 * request payload. Exec approvals carry `command`/`commandPreview`, plugin
 * approvals carry `title`/`description`.
 */
function describeApproval(a: ApprovalRequest): {
  title: string;
  subtitle?: string;
  commandText?: string;
} {
  const ctx = a.context ?? {};
  if (a.kind === "plugin") {
    const title =
      (typeof ctx.title === "string" && ctx.title) ||
      (typeof ctx.pluginId === "string" && ctx.pluginId) ||
      "Plugin approval";
    const description =
      typeof ctx.description === "string" ? ctx.description : undefined;
    return { title, subtitle: description };
  }
  // exec approval
  const commandText =
    (typeof ctx.commandText === "string" && ctx.commandText) ||
    (typeof ctx.command === "string" && ctx.command) ||
    (typeof ctx.commandPreview === "string" && ctx.commandPreview) ||
    a.action;
  const cwd = typeof ctx.cwd === "string" ? ctx.cwd : undefined;
  return {
    title: "Shell command execution",
    subtitle: cwd ? `cwd: ${cwd}` : undefined,
    commandText,
  };
}

function formatCountdown(expiresAtMs?: number): {
  text: string;
  urgent: boolean;
} {
  if (!expiresAtMs) return { text: "—", urgent: false };
  const remaining = expiresAtMs - Date.now();
  if (remaining <= 0) return { text: "expired", urgent: true };
  const urgent = remaining < 60_000;
  if (remaining < 60_000) return { text: `${Math.ceil(remaining / 1000)}s`, urgent };
  if (remaining < 3_600_000)
    return { text: `${Math.floor(remaining / 60_000)}m`, urgent };
  return { text: `${Math.floor(remaining / 3_600_000)}h`, urgent: false };
}

export default function ApprovalsPage() {
  const { state } = useGateway();
  const { data: approvals, loading } = useApprovals();

  // force periodic re-render so countdowns update
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const pending = useMemo(() => approvals ?? [], [approvals]);

  const disconnected = state === "disconnected" || state === "reconnecting";
  const connecting = state === "connecting";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Approval Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and resolve pending approvals from your AI employees. Decisions
            are forwarded directly to the OpenClaw gateway.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${CONTROL_UI_URL}/#approvals`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open in Control UI
          </a>
        </div>
      </div>

      {disconnected && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <WifiOff className="h-4 w-4" />
              Gateway disconnected. Pending approvals won&apos;t appear until the
              connection is restored.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>
              Pending
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({pending.length})
              </span>
            </span>
            {pending.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading || connecting ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : pending.length === 0 ? (
            <EmptyState />
          ) : (
            pending.map((a) => <ApprovalCard key={a.id} approval={a} />)
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Approvals are event-driven: the gateway broadcasts
        {" "}
        <code className="font-mono">exec.approval.requested</code> and{" "}
        <code className="font-mono">plugin.approval.requested</code>. The list
        shows only approvals observed during this session. Historical approvals
        are available in the Audit Trail (W5).
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
        <CheckCircle2 className="h-6 w-6 opacity-60" />
      </div>
      <p className="text-sm font-medium text-foreground">
        No pending approvals
      </p>
      <p className="text-xs mt-1 max-w-sm text-center">
        When an AI employee requests approval for a high-risk action, it will
        appear here in real time.
      </p>
    </div>
  );
}

function ApprovalCard({ approval }: { approval: ApprovalRequest }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDecision, setConfirmDecision] = useState<Decision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { client } = useGateway();

  const description = describeApproval(approval);
  const countdown = formatCountdown(approval.expiresAtMs);
  const created = new Date(approval.createdAt);

  const handleResolve = useCallback(
    async (decision: Decision) => {
      setSubmitting(true);
      setError(null);
      try {
        await client.resolveApproval(approval.id, decision, {
          kind: approval.kind,
          reason: reason.trim() || undefined,
        });
        setConfirmDecision(null);
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? (err as { message: string }).message
            : "Failed to resolve approval";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [client, approval, reason],
  );

  const isExec = approval.kind !== "plugin";
  const KindIcon = isExec ? Terminal : ShieldCheck;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            isExec ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "bg-primary/10 text-primary",
          )}
        >
          <KindIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">
              {isExec ? "exec" : "plugin"}
            </Badge>
            <h3 className="text-sm font-semibold truncate">{description.title}</h3>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {approval.agentId}
            </Badge>
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {created.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {approval.expiresAtMs && (
                <span
                  className={cn(
                    "font-mono",
                    countdown.urgent && "text-destructive font-semibold",
                  )}
                >
                  · {countdown.text}
                </span>
              )}
            </span>
          </div>
          {description.subtitle && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {description.subtitle}
            </p>
          )}
          {description.commandText && (
            <pre className="mt-2 rounded bg-muted/40 px-2 py-1 text-[12px] leading-relaxed whitespace-pre-wrap break-all font-mono">
              $ {description.commandText}
            </pre>
          )}

          <div className="mt-3 flex items-center flex-wrap gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => setConfirmDecision("allow-once")}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Approve once
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDecision("allow-always")}
            >
              Always allow
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmDecision("deny")}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Deny
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 mr-1" />
              )}
              {expanded ? "Hide details" : "Show details"}
            </Button>
            <Link
              href={`/employees/${approval.agentId}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              View employee
            </Link>
            <span className="font-mono text-[10px] text-muted-foreground ml-auto">
              {approval.id}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Raw request payload
            </p>
            <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono">
              {JSON.stringify(approval.context ?? {}, null, 2)}
            </pre>
          </div>
        </>
      )}

      <Dialog
        open={confirmDecision !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDecision(null);
            setError(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDecision === "deny" ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-primary" />
              )}
              {confirmDecision === "deny"
                ? "Deny this request?"
                : confirmDecision === "allow-always"
                  ? "Always allow this action?"
                  : "Approve this request?"}
            </DialogTitle>
            <DialogDescription>
              {confirmDecision === "allow-always"
                ? "Future identical requests from this agent will be auto-approved without prompting you again."
                : confirmDecision === "deny"
                  ? "The agent will receive a deny decision and the action will not run."
                  : "The agent will be allowed to execute this one action. Future identical requests will prompt again."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Reason (optional, logged for audit)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Verified with finance team"
              className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={submitting} />}
            >
              Cancel
            </DialogClose>
            <Button
              variant={confirmDecision === "deny" ? "destructive" : "default"}
              onClick={() => confirmDecision && handleResolve(confirmDecision)}
              disabled={submitting || confirmDecision === null}
            >
              {submitting && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
