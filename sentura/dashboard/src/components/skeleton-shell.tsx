"use client";

import type { LucideIcon } from "lucide-react";
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface SkeletonShellProps {
  /** Page title shown in the header. */
  title: string;
  /** One-sentence description of what the surface will eventually do. */
  description: string;
  /** Icon for the header avatar (lucide). */
  icon: LucideIcon;
  /** Who is blocking this surface from being functional. */
  blockingOwner: string;
  /** What deliverable from blockingOwner unblocks this surface. */
  blockingDeliverable: string;
  /** Sprint week the blocker is targeted at (e.g. "Week 4"). */
  targetWeek: string;
  /** Optional follow-up bullets describing what this surface will look like
   * once unblocked — helps reviewers form expectations and gives the
   * blocking owner a hint about what the dashboard expects from them. */
  willInclude?: string[];
}

/**
 * Empty-state skeleton route for surfaces that are blocked on other-team
 * deliverables. Per Week 4 D5: no mock data, no fake widgets — just an
 * honest empty state that names the blocker and acts as a cross-team
 * signal. When the blocking owner reads this card they know exactly
 * which deliverable the dashboard is waiting on.
 */
export function SkeletonShell({
  title,
  description,
  icon: Icon,
  blockingOwner,
  blockingDeliverable,
  targetWeek,
  willInclude,
}: SkeletonShellProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              {title}
              <Badge variant="secondary" className="text-[10px]">
                {targetWeek} placeholder
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Blocking-owner empty card */}
      <Card>
        <CardContent className="py-10">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Clock className="h-6 w-6 text-muted-foreground opacity-60" />
              </div>
              <h2 className="text-lg font-semibold">
                Awaiting {blockingOwner}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                This surface is wired into the dashboard nav and will fill
                in once <span className="font-medium text-foreground">{blockingOwner}</span>{" "}
                ships <span className="font-medium text-foreground">{blockingDeliverable}</span>{" "}
                ({targetWeek}).
              </p>
            </div>
            {willInclude && willInclude.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground text-center">
                  When wired up, this page will include:
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {willInclude.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <span className="text-muted-foreground">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
