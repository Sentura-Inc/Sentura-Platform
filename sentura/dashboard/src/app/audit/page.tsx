"use client";

/**
 * `/audit` — Audit Trail page.
 *
 * Per W5 D2 (server-side filter via `audit.search` RPC) — the query model
 * is decided. The query API itself is blocked on Person D's audit event
 * schema (W5 deliverable). Today this surface ships:
 *
 *   - Page header + filter UI shell (date range / user / agent / action /
 *     resource) — all inputs disabled today, will wire when D ships
 *   - SkeletonShell empty state explicitly naming the blocker
 *
 * When the audit event schema lands, the disabled inputs become live
 * filter controls feeding `audit.search` and a result table renders below
 * with userToken-attributed rows.
 */

import { ClipboardList, Calendar, User, Bot, Activity, Database, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonBlock } from "@/components/skeleton-block";

export default function AuditPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header — same shape as SkeletonShell's would be, but rendered
          inline here so we can mount the filter shell between header
          and empty card. */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Searchable log of every action: tool calls, config changes,
            approval decisions, employee lifecycle events. Tagged with{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              userToken
            </code>{" "}
            for attribution.
          </p>
        </div>
      </div>

      {/* Filter UI shell — inputs are visible-but-disabled so reviewers
          see the eventual shape and Person D sees concrete filter
          requirements. Goes live when audit.search RPC ships. */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="Date range" icon={<Calendar className="h-3.5 w-3.5" />}>
              <input
                type="text"
                disabled
                placeholder="Last 24 hours"
                className="w-40 rounded-md border border-input bg-muted/30 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              />
            </FilterField>
            <FilterField label="User" icon={<User className="h-3.5 w-3.5" />}>
              <input
                type="text"
                disabled
                placeholder="any userToken"
                className="w-44 rounded-md border border-input bg-muted/30 px-2.5 py-1.5 text-xs font-mono disabled:cursor-not-allowed disabled:opacity-60"
              />
            </FilterField>
            <FilterField label="Agent" icon={<Bot className="h-3.5 w-3.5" />}>
              <input
                type="text"
                disabled
                placeholder="any agentId"
                className="w-40 rounded-md border border-input bg-muted/30 px-2.5 py-1.5 text-xs font-mono disabled:cursor-not-allowed disabled:opacity-60"
              />
            </FilterField>
            <FilterField label="Action" icon={<Activity className="h-3.5 w-3.5" />}>
              <input
                type="text"
                disabled
                placeholder="any action"
                className="w-36 rounded-md border border-input bg-muted/30 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              />
            </FilterField>
            <FilterField label="Resource" icon={<Database className="h-3.5 w-3.5" />}>
              <input
                type="text"
                disabled
                placeholder="any resource"
                className="w-36 rounded-md border border-input bg-muted/30 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              />
            </FilterField>
            <button
              type="button"
              disabled
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium opacity-60"
              title="Search disabled until audit.search RPC ships (Week 5)"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Empty block naming the blocker. Uses SkeletonBlock (no header)
          since we render one inline above with the filter shell. */}
      <SkeletonBlock
        blockingOwner="Person D"
        blockingDeliverable="audit event schema + audit.search RPC"
        targetWeek="Week 5"
        willInclude={[
          "Result table — paginated rows with timestamp / user / agent / action / resource / decision, sortable",
          "Saved filter sets — common queries like 'last 7d HITL approvals' / 'failed tool calls today' bookmarkable per user",
          "CSV export gated by `audit.export` permission (auditor + platform_admin)",
          "Live tail mode — auto-refresh top of result set as new events arrive (subscription via gateway events)",
        ]}
      />
    </div>
  );
}

function FilterField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
