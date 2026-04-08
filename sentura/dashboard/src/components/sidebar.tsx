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

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
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
      { label: "Create Employee", href: "/create", icon: Plus, disabled: true, badge: "W2" },
      { label: "Tune Employee", href: "/tune", icon: Sliders, disabled: true, badge: "W3" },
      { label: "Approvals", href: "/approvals", icon: ShieldCheck, disabled: true, badge: "W2" },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Cost Center", href: "/cost", icon: DollarSign, disabled: true, badge: "W4" },
      { label: "Audit Trail", href: "/audit", icon: ClipboardList, disabled: true, badge: "W5" },
      { label: "Integrations", href: "/integrations", icon: Plug, disabled: true, badge: "W3" },
      { label: "Orchestrator", href: "/orchestrator", icon: GitBranch, disabled: true, badge: "W4" },
      { label: "Knowledge", href: "/knowledge", icon: BookOpen, disabled: true, badge: "W4" },
      { label: "Testing", href: "/testing", icon: FlaskConical, disabled: true, badge: "W4" },
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

  const renderNavItem = (item: NavItem) => {
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
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section, idx) => (
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
