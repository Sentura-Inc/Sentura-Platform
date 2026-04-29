"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ConnectionStatus } from "@/components/connection-status";
import { MissingTokenBanner } from "@/components/missing-token-banner";
import { RoleProvider } from "@/lib/auth/use-current-role";
import type { Role } from "@/lib/auth/roles";

/**
 * Routes that render their own full-screen chrome and should NOT be wrapped
 * in the authenticated AppShell (sidebar / top bar / token banner). F1.8:
 * `/login` previously leaked the full nav before SSO existed.
 *
 * Once we introduce a real `(public)` route group post-SSO, this list goes
 * away in favor of separate layouts; the inline check keeps the QA-pass
 * scope small and reversible.
 */
const STANDALONE_ROUTES = new Set(["/login"]);

export function AppShell({
  children,
  initialRole,
}: {
  children: React.ReactNode;
  initialRole?: Role;
}) {
  const pathname = usePathname();
  const standalone = pathname ? STANDALONE_ROUTES.has(pathname) : false;

  if (standalone) {
    // Still mount the RoleProvider so deep components can read role state,
    // but skip the chrome — login is its own self-contained surface.
    return (
      <RoleProvider initialRole={initialRole}>
        <div className="h-full bg-background">{children}</div>
      </RoleProvider>
    );
  }

  return (
    <RoleProvider initialRole={initialRole}>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
            <div />
            <ConnectionStatus />
          </header>
          {/* Site-wide warning when env vars are missing — only renders if so */}
          <MissingTokenBanner />
          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
