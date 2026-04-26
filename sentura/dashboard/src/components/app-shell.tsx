"use client";

import { Sidebar } from "@/components/sidebar";
import { ConnectionStatus } from "@/components/connection-status";
import { MissingTokenBanner } from "@/components/missing-token-banner";
import { RoleProvider } from "@/lib/auth/use-current-role";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
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
