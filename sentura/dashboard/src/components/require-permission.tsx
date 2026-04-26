"use client";

/**
 * Page-level permission guard. Wraps a route's body content; redirects to
 * `/403` if the current role lacks the required permission. Use for
 * mutation surfaces that should be inaccessible to read-only roles
 * (`/create`, settings tabs that mutate, lifecycle actions, etc.).
 *
 * Read-only surfaces typically don't need this guard — the sidebar
 * filtering already hides the link, and the page renders read-only views
 * naturally. Use only when "the page itself is the action."
 */

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usePermission, type PermissionAction } from "@/lib/auth/use-permission";

interface RequirePermissionProps {
  action: PermissionAction;
  children: ReactNode;
  /** Optional fallback while redirecting. Default: a small loader. */
  fallback?: ReactNode;
}

export function RequirePermission({
  action,
  children,
  fallback,
}: RequirePermissionProps) {
  const router = useRouter();
  const { allowed, loading } = usePermission(action);

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/403");
    }
  }, [allowed, loading, router]);

  if (loading || !allowed) {
    return (
      fallback ?? (
        <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Checking access…
        </div>
      )
    );
  }

  return <>{children}</>;
}
