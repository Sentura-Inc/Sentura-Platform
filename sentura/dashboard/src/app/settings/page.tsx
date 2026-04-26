"use client";

/**
 * `/settings` — platform-wide configuration surfaces.
 *
 * Per Week 5 D3 (tabs with URL state): top-tab nav, one section visible
 * at a time. Active tab driven by `?tab=<name>` URL param so reloads /
 * deep-links land on the right tab.
 *
 * Today (W5 Phase 3) ships:
 *   - 3 real tabs: Gateway (diagnostics), Approvals (read-only policies),
 *     About (versions / posture)
 *   - 1 hybrid tab: RBAC (real matrix display today, user-assignment
 *     skeleton until Person D's RPC ships)
 *   - 3 pure-skeleton tabs: Scopes (multi-tenancy), SSO (SAML/OIDC),
 *     Audit retention — all backend-blocked
 */

import { useCallback, useMemo, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Cable,
  Globe,
  KeyRound,
  Settings as SettingsIcon,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GatewayTab } from "./gateway-tab";
import { ApprovalsTab } from "./approvals-tab";
import { AboutTab } from "./about-tab";
import { RbacTab } from "./rbac-tab";
import { ScopesTab, SsoTab, AuditRetentionTab } from "./skeleton-tabs";

type TabId =
  | "gateway"
  | "rbac"
  | "scopes"
  | "sso"
  | "approvals"
  | "audit-retention"
  | "about";

interface TabDef {
  id: TabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  status: "real" | "hybrid" | "skeleton";
  Component: ComponentType;
}

const TABS: TabDef[] = [
  { id: "gateway", label: "Gateway", icon: Cable, status: "real", Component: GatewayTab },
  { id: "rbac", label: "RBAC", icon: ShieldCheck, status: "hybrid", Component: RbacTab },
  { id: "scopes", label: "Scopes", icon: Globe, status: "skeleton", Component: ScopesTab },
  { id: "sso", label: "SSO", icon: KeyRound, status: "skeleton", Component: SsoTab },
  { id: "approvals", label: "Approvals", icon: Users, status: "real", Component: ApprovalsTab },
  { id: "audit-retention", label: "Audit retention", icon: Timer, status: "skeleton", Component: AuditRetentionTab },
  { id: "about", label: "About", icon: Activity, status: "real", Component: AboutTab },
];

const DEFAULT_TAB: TabId = "gateway";

function isTabId(value: string | null): value is TabId {
  return value !== null && TABS.some((t) => t.id === value);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : DEFAULT_TAB;

  const setActive = useCallback(
    (next: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const ActiveComponent = useMemo(
    () => TABS.find((t) => t.id === activeTab)?.Component ?? GatewayTab,
    [activeTab],
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Platform-wide configuration. Some sections are backend-blocked
            and ship as honest skeletons today — see each tab for the
            specific blocker.
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.status === "skeleton" && (
                <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  skeleton
                </span>
              )}
              {tab.status === "hybrid" && (
                <span className="rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  partial
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <ActiveComponent />
    </div>
  );
}
