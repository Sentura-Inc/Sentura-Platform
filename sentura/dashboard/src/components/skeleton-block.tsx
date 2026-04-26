"use client";

/**
 * In-tab / inline skeleton block. Smaller cousin of <SkeletonShell> — used
 * when a section *inside* a page is backend-blocked but the surrounding
 * page is real (e.g. one tab of /settings, one section of an employee
 * detail). Same "honest empty state names the blocker" discipline as
 * SkeletonShell but without the page header / title-badge.
 */

import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface SkeletonBlockProps {
  /** Who is blocking this block from being functional. */
  blockingOwner: string;
  /** What deliverable from blockingOwner unblocks this block. */
  blockingDeliverable: string;
  /** Sprint week the blocker is targeted at. */
  targetWeek: string;
  /** Optional bullets describing what this block will look like once
   * unblocked — sets reviewer expectations + signals to the blocking
   * owner what shape the dashboard expects from them. */
  willInclude?: string[];
}

export function SkeletonBlock({
  blockingOwner,
  blockingDeliverable,
  targetWeek,
  willInclude,
}: SkeletonBlockProps) {
  return (
    <Card>
      <CardContent className="py-8">
        <div className="mx-auto max-w-xl space-y-4">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground opacity-60" />
            </div>
            <p className="text-sm font-medium">Awaiting {blockingOwner}</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Wired into the dashboard and will fill in once{" "}
              <span className="font-medium text-foreground">{blockingOwner}</span>{" "}
              ships{" "}
              <span className="font-medium text-foreground">
                {blockingDeliverable}
              </span>{" "}
              ({targetWeek}).
            </p>
          </div>
          {willInclude && willInclude.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground text-center">
                When wired up, this block will include:
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {willInclude.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
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
  );
}
