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
  Compass,
  Search,
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
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Enterprise",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Employees", href: "/employees", icon: Bot },
      { label: "Create Employee", href: "/create", icon: Plus },
      { label: "Chat", href: "/chat", icon: MessageSquare },
      { label: "Zuolian Demo", href: "/client-demos/zuolian", icon: Compass },
      { label: "CBE Leads", href: "/client-demos/cross-border/lead-discovery", icon: Search },
      { label: "CBE Screening", href: "/client-demos/cross-border/screening", icon: ShieldCheck },
      { label: "Tune Employee", href: "/tune", icon: Sliders },
      { label: "Approvals", href: "/approvals", icon: ShieldCheck },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Cost Center", href: "/cost", icon: DollarSign },
      { label: "Audit Trail", href: "/audit", icon: ClipboardList },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Orchestrator", href: "/orchestrator", icon: GitBranch },
      { label: "Knowledge", href: "/knowledge", icon: BookOpen },
      { label: "Testing", href: "/testing", icon: FlaskConical },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Control Panel", href: CONTROL_UI_URL, icon: PanelLeft, external: true },
      { label: "Config Editor", href: `${CONTROL_UI_URL}/#config`, icon: FileCode, external: true },
      { label: "Sessions & Chat", href: `${CONTROL_UI_URL}/#sessions`, icon: MessageSquare, external: true },
      { label: "Logs", href: `${CONTROL_UI_URL}/#logs`, icon: ScrollText, external: true },
      { label: "Debug Console", href: `${CONTROL_UI_URL}/#debug`, icon: Bug, external: true },
      { label: "Cron Jobs", href: `${CONTROL_UI_URL}/#cron`, icon: Timer, external: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: approvals } = useApprovals();
  const pendingApprovals = approvals?.length ?? 0;

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
            "max-md:justify-center max-md:px-2",
            collapsed && "justify-center px-2"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="hidden flex-1 md:inline">{item.label}</span>
              <ExternalLink className="hidden h-3 w-3 text-muted-foreground/60 md:block" />
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
          "max-md:justify-center max-md:px-2",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="hidden flex-1 md:inline">{item.label}</span>
            {item.badge && (
              <span
                className={cn(
                  "hidden rounded px-1.5 py-0.5 text-[10px] font-medium md:inline",
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
        collapsed ? "w-16" : "w-16 md:w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          S
        </div>
        {!collapsed && (
          <span className="hidden font-semibold text-lg tracking-tight md:inline">
            Sentura
          </span>
        )}
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 && <Separator className="my-2" />}
            {!collapsed && (
              <p className="hidden px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 md:block">
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
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 pointer-events-none opacity-40 max-md:justify-center max-md:px-2"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden md:inline">Settings</span>
            <span className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline">
              W5
            </span>
          </Link>
        )}

        <Separator className="my-1" />

        {/* Auth placeholder */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2",
            "max-md:justify-center max-md:px-2",
            collapsed && "justify-center px-2"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {!collapsed && (
            <div className="hidden flex-col md:flex">
              <span className="text-xs font-medium">Admin User</span>
              <span className="text-[10px] text-muted-foreground">
                Platform Admin
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
