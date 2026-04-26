"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  Plug,
  DollarSign,
  ClipboardList,
  Settings,
  User,
  Plus,
  Sliders,
  GitBranch,
  BookOpen,
  FlaskConical,
  ExternalLink,
  PanelLeft,
  FileCode,
  MessageSquare,
  ScrollText,
  Bug,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useApprovals, useGatewayEvents, useSessions } from "@/lib/gateway";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/roles";
import { useCurrentRole } from "@/lib/auth/use-current-role";
import type { PermissionAction } from "@/lib/auth/use-permission";
import { RoleSwitcher } from "@/components/role-switcher";

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
  badgeTone?: "default" | "alert";
  external?: boolean;
  /**
   * Permission required to see this nav item. If omitted, the item shows for
   * everyone. Per Week 5 D1 (hard-hide): items the current role can't access
   * are filtered out entirely — sidebar surface tailored to the role.
   */
  requiresPermission?: PermissionAction;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Enterprise",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard, requiresPermission: "agents.read" },
      { label: "Employees", href: "/employees", icon: Bot, requiresPermission: "agents.read" },
      { label: "Create Employee", href: "/create", icon: Plus, requiresPermission: "agents.create" },
      { label: "Chat", href: "/chat", icon: MessageSquare, requiresPermission: "sessions.read" },
      { label: "Tune Employee", href: "/tune", icon: Sliders, requiresPermission: "agents.tune" },
      { label: "Approvals", href: "/approvals", icon: ShieldCheck, requiresPermission: "approvals.resolve" },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Cost Center", href: "/cost", icon: DollarSign, requiresPermission: "audit.read" },
      { label: "Audit Trail", href: "/audit", icon: ClipboardList, requiresPermission: "audit.read", disabled: true, badge: "W5" },
      { label: "Integrations", href: "/integrations", icon: Plug, requiresPermission: "ekg.read" },
      { label: "Orchestrator", href: "/orchestrator", icon: GitBranch, requiresPermission: "agents.read" },
      { label: "Knowledge", href: "/knowledge", icon: BookOpen, requiresPermission: "ekg.read" },
      { label: "Testing", href: "/testing", icon: FlaskConical, requiresPermission: "agents.read" },
    ],
  },
  {
    title: "Operations",
    items: [
      // Operations links jump to OpenClaw Control UI — admin-grade access.
      // Gated by settings.write (only platform_admin today).
      { label: "Control Panel", href: CONTROL_UI_URL, icon: PanelLeft, external: true, requiresPermission: "settings.write" },
      { label: "Config Editor", href: `${CONTROL_UI_URL}/#config`, icon: FileCode, external: true, requiresPermission: "settings.write" },
      { label: "Sessions & Chat", href: `${CONTROL_UI_URL}/#sessions`, icon: MessageSquare, external: true, requiresPermission: "settings.write" },
      { label: "Logs", href: `${CONTROL_UI_URL}/#logs`, icon: ScrollText, external: true, requiresPermission: "settings.write" },
      { label: "Debug Console", href: `${CONTROL_UI_URL}/#debug`, icon: Bug, external: true, requiresPermission: "settings.write" },
      { label: "Cron Jobs", href: `${CONTROL_UI_URL}/#cron`, icon: Timer, external: true, requiresPermission: "settings.write" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: approvals } = useApprovals();
  const pendingApprovals = approvals?.length ?? 0;
  const { role } = useCurrentRole();

  // Live count of all conversations for the /chat badge. `useSessions()` is
  // a one-shot fetch on connect; we re-fetch on `sessions.changed` so the
  // badge updates when a conversation is created/deleted in another tab
  // (Week 3 acceptance criteria #4 — proves useGatewayEvents on real event).
  const { data: sessionsData, refetch: refetchSessions } = useSessions();
  const conversationCount = sessionsData?.length ?? 0;
  useGatewayEvents({
    "sessions.changed": () => refetchSessions(),
  });

  const renderNavItem = (item: NavItem) => {
    // Per Week 5 D1 (hard-hide): drop nav items the current role cannot
    // access. Items with no `requiresPermission` are always visible.
    if (item.requiresPermission && !hasPermission(role, item.requiresPermission)) {
      return null;
    }
    if (item.href === "/approvals" && pendingApprovals > 0) {
      item = { ...item, badge: String(pendingApprovals), badgeTone: "alert" };
    }
    if (item.href === "/chat" && conversationCount > 0) {
      item = {
        ...item,
        badge: conversationCount > 99 ? "99+" : String(conversationCount),
      };
    }
    const isActive =
      !item.external &&
      (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));

    if (item.external) {
      const linkContent = (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
            </>
          )}
        </a>
      );

      if (collapsed) {
        return (
          <li key={item.href}>
            <Tooltip>
              <TooltipTrigger>{linkContent}</TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-2">
                {item.label}
                <ExternalLink className="h-3 w-3" />
              </TooltipContent>
            </Tooltip>
          </li>
        );
      }
      return <li key={item.href}>{linkContent}</li>;
    }

    const linkContent = (
      <Link
        href={item.disabled ? "#" : item.href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
          item.disabled && "pointer-events-none opacity-40",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  item.badgeTone === "alert"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <li key={item.href}>
          <Tooltip>
            <TooltipTrigger>{linkContent}</TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              {item.label}
              {item.badge && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                  {item.badge}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        </li>
      );
    }

    return <li key={item.href}>{linkContent}</li>;
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          S
        </div>
        {!collapsed && (
          <span className="font-semibold text-lg tracking-tight">Sentura</span>
        )}
      </div>

      {/* Nav Sections — sections with no visible items (after permission
          filtering) are dropped entirely so we never render an empty header. */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections
          .map((section) => ({
            section,
            visibleItems: section.items.filter(
              (item) =>
                !item.requiresPermission ||
                hasPermission(role, item.requiresPermission),
            ),
          }))
          .filter(({ visibleItems }) => visibleItems.length > 0)
          .map(({ section }, idx) => (
            <div key={section.title}>
              {idx > 0 && <Separator className="my-2" />}
              {!collapsed && (
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {section.title}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {section.items.map(renderNavItem)}
              </ul>
            </div>
          ))}
      </nav>

      <Separator />

      {/* Bottom section */}
      <div className="flex flex-col gap-1 p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger>
              <Link
                href="#"
                className="flex items-center justify-center rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground pointer-events-none opacity-40"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Settings (W5)</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="#"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 pointer-events-none opacity-40"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              W5
            </span>
          </Link>
        )}

        <Separator className="my-1" />

        {/* Dev role switcher — only renders when NEXT_PUBLIC_ENABLE_ROLE_SWITCHER=1.
            Lets QA / reviewers preview each role's view without rebuilding. */}
        <RoleSwitcher collapsed={collapsed} />

        {/* Auth placeholder */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2",
            collapsed && "justify-center px-2"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-medium">Admin User</span>
              <span className="text-[10px] text-muted-foreground">
                {ROLE_LABELS[role]}
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
