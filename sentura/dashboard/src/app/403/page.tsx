"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { useCurrentRole } from "@/lib/auth/use-current-role";

/**
 * `/403` — destination for users hitting a route their role can't access.
 *
 * Per Week 5 D1 (hard-hide), nav items / actions disappear entirely from
 * the UI for unauthorized roles. This page exists for users who arrive at
 * a restricted URL via direct link, browser-back, or shared bookmark.
 */
export default function ForbiddenPage() {
  const { role } = useCurrentRole();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldOff className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Access denied</h1>
            <p className="text-sm text-muted-foreground">
              The{" "}
              <span className="font-medium text-foreground">
                {ROLE_LABELS[role]}
              </span>{" "}
              role doesn&apos;t have permission to view this page. If you
              believe this is a mistake, contact your platform administrator.
            </p>
          </div>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to overview
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
