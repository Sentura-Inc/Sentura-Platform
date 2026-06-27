"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  BadgeDollarSign,
  LogOut,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Star,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { ConnectionStatus } from "@/components/connection-status";
import { MissingTokenBanner } from "@/components/missing-token-banner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmployeeCostMini } from "@/components/cross-border/employee-cost";
import { EmployeeTaskStatusBar } from "@/components/cross-border/employee-task-status";
import {
  CBE_ADMIN_API_BASE,
  CBE_ADMIN_COSTS_PATH,
  CBE_ADMIN_EMPLOYEES_PATH,
  CBE_ADMIN_HIGH_VALUE_CUSTOMERS_PATH,
  CBE_ADMIN_LOGIN_PATH,
  CBE_ADMIN_MEMORY_PATH,
  CBE_EMPLOYEE_CUSTOMERS_PATH,
  CBE_EMPLOYEE_HOME_PATH,
  CBE_EMPLOYEE_LOGIN_PATH,
  CBE_EMPLOYEE_MEMORY_PATH,
  CBE_SESSION_API_PATH,
  isCbeAdminLoginPath,
  isCbeAdminPath,
  isCbeEmployeeLoginPath,
  isCbeEmployeePath,
} from "@/lib/cross-border-routes";
import { cn } from "@/lib/utils";
import { fetchEmployeeTasks, markEmployeeNotificationsRead } from "@/app/client-demos/cross-border/employee/_data/employee-api";
import {
  EMPLOYEE_MESSAGE_CENTER_HREF,
  EMPLOYEE_NOTIFICATION_PREVIEW_LIMIT,
  EMPLOYEE_NOTIFICATION_VISIBLE_COUNT,
  employeeTaskNotificationHref,
} from "@/app/client-demos/cross-border/employee/_data/employee-notification-targets";
import {
  isCbeEmployeeTaskActive,
  useCbeEmployeeStore,
} from "@/stores/use-cbe-employee-store";
import {
  clearCbeSessionDisplayName,
  setCbeSessionDisplayName,
} from "@/lib/cbe-session-display-name";

const employeeNav = [
  {
    label: "个人中心",
    href: CBE_EMPLOYEE_HOME_PATH,
    icon: UserRound,
  },
  {
    label: "获客与背调",
    href: CBE_EMPLOYEE_CUSTOMERS_PATH,
    icon: ShieldCheck,
  },
  {
    label: "记忆整理",
    href: CBE_EMPLOYEE_MEMORY_PATH,
    icon: Database,
  },
];

const adminNav = [
  {
    label: "员工管理",
    href: CBE_ADMIN_EMPLOYEES_PATH,
    icon: UsersRound,
  },
  {
    label: "客户列表",
    href: CBE_ADMIN_HIGH_VALUE_CUSTOMERS_PATH,
    icon: Star,
  },
  {
    label: "记忆整理",
    href: CBE_ADMIN_MEMORY_PATH,
    icon: Database,
  },
  {
    label: "费用监控",
    href: CBE_ADMIN_COSTS_PATH,
    icon: BadgeDollarSign,
  },
];

const CBE_ADMIN_USER_ID = process.env.NEXT_PUBLIC_CBE_ADMIN_USER_ID?.trim();
const ADMIN_HIGH_VALUE_SEEN_KEY = "sentura:cbe:admin:seen-high-value-at:v1";

type BrowserFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type BrowserFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

interface HeaderNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface AdminNotificationSnapshot {
  pendingApprovals: number;
  firstApprovalId: string | null;
  approvals: AdminApprovalNotification[];
  highValueCount: number;
  newHighValueCount: number;
  highValueItems: AdminHighValueNotification[];
  latestHighValueRecordId: string | null;
  latestHighValueName: string | null;
  latestHighValueAt: string | null;
  error: string | null;
}

interface AdminApprovalNotification {
  id: string;
  displayName: string;
  taskKind: string;
  targetSummary: string | null;
  requestedAllowanceUsd: string | number | null;
  estimatedCostUsd: string | number | null;
}

interface AdminHighValueNotification {
  recordId: string;
  companyName: string;
  ownerName: string | null;
  normalizedScore: number | null;
  updatedAt: string | null;
}

function timeMs(value: unknown) {
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isHeaderNavItemActive(pathname: string, href: string) {
  if (href === CBE_EMPLOYEE_HOME_PATH) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function browserFullscreenElement() {
  const fullscreenDocument = document as BrowserFullscreenDocument;
  return fullscreenDocument.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

function canRequestBrowserFullscreen() {
  if (typeof document === "undefined") return false;
  const element = document.documentElement as BrowserFullscreenElement;
  return Boolean(element.requestFullscreen ?? element.webkitRequestFullscreen);
}

async function requestBrowserFullscreen() {
  const element = document.documentElement as BrowserFullscreenElement;
  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }
  if (element.webkitRequestFullscreen) {
    await element.webkitRequestFullscreen();
    return;
  }
  throw new Error("browser_fullscreen_unsupported");
}

async function exitBrowserFullscreen() {
  const fullscreenDocument = document as BrowserFullscreenDocument;
  if (fullscreenDocument.exitFullscreen) {
    await fullscreenDocument.exitFullscreen();
    return;
  }
  if (fullscreenDocument.webkitExitFullscreen) {
    await fullscreenDocument.webkitExitFullscreen();
  }
}

function PlatformFullscreenToggle({
  onActiveChange,
}: {
  onActiveChange: (active: boolean) => void;
}) {
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [appFullscreen, setAppFullscreen] = useState(false);
  const [pending, setPending] = useState(false);
  const active = browserFullscreen || appFullscreen;
  const label = active ? "退出全屏模式" : "进入全屏模式";
  const Icon = active ? Minimize2 : Maximize2;

  useEffect(() => {
    const syncBrowserFullscreen = () => {
      const nextBrowserFullscreen = Boolean(browserFullscreenElement());
      setBrowserFullscreen(nextBrowserFullscreen);
      if (nextBrowserFullscreen) setAppFullscreen(false);
    };

    const syncTimer = window.setTimeout(syncBrowserFullscreen, 0);
    document.addEventListener("fullscreenchange", syncBrowserFullscreen);
    document.addEventListener("webkitfullscreenchange", syncBrowserFullscreen);
    return () => {
      window.clearTimeout(syncTimer);
      document.removeEventListener("fullscreenchange", syncBrowserFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncBrowserFullscreen);
    };
  }, []);

  useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);

  useEffect(() => {
    if (!appFullscreen) return;
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAppFullscreen(false);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [appFullscreen]);

  async function toggleFullscreen() {
    if (pending) return;
    setPending(true);
    try {
      if (active) {
        if (browserFullscreen) await exitBrowserFullscreen();
        setAppFullscreen(false);
        return;
      }

      if (canRequestBrowserFullscreen()) {
        try {
          await requestBrowserFullscreen();
          return;
        } catch {
          setAppFullscreen(true);
          return;
        }
      }
      setAppFullscreen(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={pending}
          className={cn(
            "fixed z-[45] inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--sentura-border-strong)] bg-white/88 text-[var(--sentura-ink)] shadow-lg shadow-slate-950/15 backdrop-blur-xl transition hover:border-primary/40 hover:bg-white hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-60 sm:h-11 sm:w-11",
            active ? "border-primary/50 bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : null,
          )}
          style={{
            right: "calc(env(safe-area-inset-right) + 1rem)",
            bottom: "calc(env(safe-area-inset-bottom) + 1rem)",
          }}
          onClick={() => void toggleFullscreen()}
        >
          <Icon className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function HeaderPillNav({
  items,
  pathname,
  ariaLabel,
}: {
  items: HeaderNavItem[];
  pathname: string;
  ariaLabel: string;
}) {
  const circleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timelineRefs = useRef<(ReturnType<typeof gsap.timeline> | null)[]>([]);
  const tweenRefs = useRef<(ReturnType<typeof gsap.to> | null)[]>([]);
  const navItemsRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const ease = "power3.easeOut";
    const timelines = timelineRefs.current;
    const tweens = tweenRefs.current;
    let initialLoadTween: ReturnType<typeof gsap.to> | null = null;
    const layout = () => {
      circleRefs.current.forEach((circle) => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement;
        const rect = pill.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const radius = ((width * width) / 4 + height * height) / (2 * height);
        const diameter = Math.ceil(2 * radius) + 2;
        const delta = Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - (width * width) / 4))) + 1;
        const originY = diameter - delta;

        circle.style.width = `${diameter}px`;
        circle.style.height = `${diameter}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`,
        });

        const label = pill.querySelector<HTMLElement>(".sentura-pill-label");
        const hoverLabel = pill.querySelector<HTMLElement>(".sentura-pill-label-hover");
        if (label) gsap.set(label, { y: 0 });
        if (hoverLabel) gsap.set(hoverLabel, { y: height + 12, opacity: 0 });

        const index = circleRefs.current.indexOf(circle);
        if (index === -1) return;

        timelineRefs.current[index]?.kill();
        const timeline = gsap.timeline({ paused: true });
        timeline.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: "auto" }, 0);
        if (label) timeline.to(label, { y: -(height + 8), duration: 2, ease, overwrite: "auto" }, 0);
        if (hoverLabel) timeline.to(hoverLabel, { y: 0, opacity: 1, duration: 2, ease, overwrite: "auto" }, 0);
        timelineRefs.current[index] = timeline;
      });
    };

    layout();
    const navItems = navItemsRef.current;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (navItems && !prefersReducedMotion) {
      gsap.set(navItems, { clearProps: "width,overflow" });
      const targetWidth = navItems.scrollWidth || navItems.getBoundingClientRect().width;
      if (targetWidth > 0) {
        initialLoadTween = gsap.fromTo(navItems, {
          width: 0,
          overflow: "hidden",
        }, {
          width: targetWidth,
          duration: 0.6,
          ease,
          overwrite: "auto",
          onUpdate: layout,
          onComplete: () => {
            gsap.set(navItems, { clearProps: "width,overflow" });
            layout();
          },
        });
      }
    }

    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(layout).catch(() => undefined);

    return () => {
      window.removeEventListener("resize", onResize);
      initialLoadTween?.kill();
      if (navItems) gsap.set(navItems, { clearProps: "width,overflow" });
      timelines.forEach((timeline) => timeline?.kill());
      tweens.forEach((tween) => tween?.kill());
    };
  }, [items]);

  const handleEnter = (index: number) => {
    const timeline = timelineRefs.current[index];
    if (!timeline) return;
    tweenRefs.current[index]?.kill();
    tweenRefs.current[index] = timeline.tweenTo(timeline.duration(), {
      duration: 0.3,
      ease: "power3.easeOut",
      overwrite: "auto",
    });
  };

  const handleLeave = (index: number) => {
    const timeline = timelineRefs.current[index];
    if (!timeline) return;
    tweenRefs.current[index]?.kill();
    tweenRefs.current[index] = timeline.tweenTo(0, {
      duration: 0.2,
      ease: "power3.easeOut",
      overwrite: "auto",
    });
  };

  return (
    <div className="sentura-pill-nav-container hidden md:block">
      <nav className="sentura-pill-nav" aria-label={ariaLabel}>
        <div className="sentura-pill-nav-items" ref={navItemsRef}>
          <ul className="sentura-pill-list" role="menubar">
            {items.map((item, index) => {
              const active = isHeaderNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} role="none">
                  <Link
                    href={item.href}
                    role="menuitem"
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn("sentura-pill", active ? "is-active" : null)}
                    onMouseEnter={() => handleEnter(index)}
                    onMouseLeave={() => handleLeave(index)}
                  >
                    <span
                      className="sentura-pill-hover-circle"
                      aria-hidden="true"
                      ref={(element) => {
                        circleRefs.current[index] = element;
                      }}
                    />
                    <span className="sentura-pill-label-stack">
                      <span className="sentura-pill-label">
                        <span className="sentura-pill-label-content">
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </span>
                      </span>
                      <span className="sentura-pill-label-hover" aria-hidden="true">
                        <span className="sentura-pill-label-content">
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}

function HeaderMobilePillNav({ items, pathname }: { items: HeaderNavItem[]; pathname: string }) {
  return (
    <nav className="sentura-mobile-pill-nav md:hidden" aria-label="移动端页面切换">
      {items.map((item) => {
        const active = isHeaderNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("sentura-mobile-pill-link", active ? "is-active" : null)}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdminNotificationBell({ enabled }: { enabled: boolean }) {
  const [snapshot, setSnapshot] = useState<AdminNotificationSnapshot>({
    pendingApprovals: 0,
    firstApprovalId: null,
    approvals: [],
    highValueCount: 0,
    newHighValueCount: 0,
    highValueItems: [],
    latestHighValueRecordId: null,
    latestHighValueName: null,
    latestHighValueAt: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function refreshNotifications() {
      try {
        const headers = CBE_ADMIN_USER_ID ? { "x-cbe-admin-user-id": CBE_ADMIN_USER_ID } : undefined;
        const [costsResponse, highValueResponse] = await Promise.all([
          fetch(`${CBE_ADMIN_API_BASE}/costs?range=month`, { cache: "no-store", ...(headers ? { headers } : {}) }),
          fetch(`${CBE_ADMIN_API_BASE}/high-value-customers?limit=100&range=all`, { cache: "no-store", ...(headers ? { headers } : {}) }),
        ]);
        const costsBody = await costsResponse.json().catch(() => ({}));
        const highValueBody = await highValueResponse.json().catch(() => ({}));
        if (!costsResponse.ok || !highValueResponse.ok) {
          throw new Error("admin notification API failed");
        }

        const approvals = Array.isArray(costsBody?.approvals) ? costsBody.approvals : [];
        const highValueItems = Array.isArray(highValueBody?.items) ? highValueBody.items : [];
        const approvalItems: AdminApprovalNotification[] = approvals
          .map((item: Record<string, unknown>) => ({
            id: asText(item.id),
            displayName: asText(item.display_name, asText(item.user_id, "员工")),
            taskKind: asText(item.task_kind, "任务"),
            targetSummary: asText(item.target_summary) || null,
            requestedAllowanceUsd: item.requested_allowance_usd as string | number | null,
            estimatedCostUsd: item.estimated_cost_usd as string | number | null,
          }))
          .filter((item: AdminApprovalNotification) => item.id);
        const firstApproval = approvalItems[0];
        const sortedHighValueItems: AdminHighValueNotification[] = highValueItems
          .slice()
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => timeMs(b.updatedAt) - timeMs(a.updatedAt))
          .map((item: Record<string, unknown>) => ({
            recordId: asText(item.recordId),
            companyName: asText(item.companyName, "优先跟进客户"),
            ownerName: asText(item.ownerName) || null,
            normalizedScore: typeof item.normalizedScore === "number" ? item.normalizedScore : null,
            updatedAt: asText(item.updatedAt) || null,
          }))
          .filter((item: AdminHighValueNotification) => item.recordId);
        const latestHighValue = sortedHighValueItems[0];
        const latestHighValueAt = typeof latestHighValue?.updatedAt === "string" ? latestHighValue.updatedAt : null;
        const latestHighValueName = latestHighValue?.companyName ?? null;
        const latestHighValueRecordId = latestHighValue?.recordId ?? null;

        let newHighValueCount = 0;
        if (latestHighValueAt) {
          const seenAt = window.localStorage.getItem(ADMIN_HIGH_VALUE_SEEN_KEY);
          if (!seenAt) {
            window.localStorage.setItem(ADMIN_HIGH_VALUE_SEEN_KEY, latestHighValueAt);
          } else {
            const seenMs = timeMs(seenAt);
            newHighValueCount = sortedHighValueItems.filter((item) => timeMs(item.updatedAt) > seenMs).length;
          }
        }

        if (!cancelled) {
          setSnapshot({
            pendingApprovals: approvalItems.length,
            firstApprovalId: firstApproval?.id ?? null,
            approvals: approvalItems,
            highValueCount: sortedHighValueItems.length,
            newHighValueCount,
            highValueItems: sortedHighValueItems,
            latestHighValueRecordId,
            latestHighValueName,
            latestHighValueAt,
            error: null,
          });
        }
      } catch {
        if (!cancelled) {
          setSnapshot((current) => ({ ...current, error: "通知加载失败" }));
        }
      }
    }

    void refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  const badgeCount = snapshot.pendingApprovals + snapshot.newHighValueCount;
  const hasAdminMessages = snapshot.approvals.length > 0 || snapshot.highValueItems.length > 0;
  const markHighValueSeen = () => {
    if (snapshot.latestHighValueAt) {
      window.localStorage.setItem(ADMIN_HIGH_VALUE_SEEN_KEY, snapshot.latestHighValueAt);
      setSnapshot((current) => ({ ...current, newHighValueCount: 0 }));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "relative")}
            aria-label="管理者通知"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {badgeCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] max-w-xs">
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <div className="text-sm font-medium">通知</div>
          <div className="text-xs text-muted-foreground">{badgeCount > 0 ? `${badgeCount} 条需关注` : "暂无未读"}</div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto overscroll-contain pr-1">
          {hasAdminMessages ? (
            <>
              <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">费用审批</div>
              {snapshot.approvals.length > 0 ? (
                snapshot.approvals.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    className="items-start gap-2 py-2"
                    render={
                      <Link href={`${CBE_ADMIN_COSTS_PATH}?notify=approvals&highlightApproval=${encodeURIComponent(item.id)}#pending-approvals`} />
                    }
                  >
                    <BadgeDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.displayName} 的额度申请</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.targetSummary ?? item.taskKind}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-muted-foreground">暂无额度申请。</div>
              )}
              <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">优先跟进客户</div>
              {snapshot.highValueItems.length > 0 ? (
                snapshot.highValueItems.map((item) => (
                  <DropdownMenuItem
                    key={item.recordId}
                    className="items-start gap-2 py-2"
                    render={
                      <Link
                        href={`${CBE_ADMIN_HIGH_VALUE_CUSTOMERS_PATH}?highlightCustomer=${encodeURIComponent(item.recordId)}`}
                        onClick={markHighValueSeen}
                      />
                    }
                  >
                    <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">优先跟进：{item.companyName}</span>
                      <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">
                        {item.ownerName ? `${item.ownerName} · ` : ""}评分 {item.normalizedScore ?? "N/A"}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-muted-foreground">暂无优先跟进客户通知。</div>
              )}
            </>
          ) : (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无消息提醒。</div>
          )}
        </div>
        {snapshot.error ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-destructive">{snapshot.error}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmployeeNotificationBell({ enabled }: { enabled: boolean }) {
  const tasks = useCbeEmployeeStore((state) => state.tasks);
  const markTaskNotificationsRead = useCbeEmployeeStore((state) => state.markTaskNotificationsRead);
  const messages = tasks
    .filter((task) => !isCbeEmployeeTaskActive(task))
    .sort((left, right) => (right.completedAt ?? right.updatedAt) - (left.completedAt ?? left.updatedAt));
  const previewMessages = messages.slice(0, EMPLOYEE_NOTIFICATION_PREVIEW_LIMIT);
  const notificationListMaxHeight = EMPLOYEE_NOTIFICATION_VISIBLE_COUNT * 56;
  const unreadMessages = messages.filter((task) => !task.notificationRead);

  async function markMessagesRead(messageIds: string[]) {
    const ids = Array.from(new Set(messageIds)).filter(Boolean);
    if (ids.length === 0) return;
    markTaskNotificationsRead(ids);
    try {
      const result = await markEmployeeNotificationsRead(ids);
      if (result.readIds.length > 0) {
        markTaskNotificationsRead(result.readIds);
      }
    } catch {
      // Keep local read state; the next refresh will reconcile with the server.
    }
  }

  async function markPreviewRead() {
    await markMessagesRead(unreadMessages.map((task) => task.id));
  }

  if (!enabled) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "relative")}
            aria-label="员工消息提醒"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unreadMessages.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unreadMessages.length > 9 ? "9+" : unreadMessages.length}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] max-w-xs">
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <div className="text-sm font-medium">消息提醒</div>
          <div className="text-xs text-muted-foreground">
            {unreadMessages.length > 0 ? `${unreadMessages.length} 条未读` : "暂无未读"}
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="overflow-y-auto overscroll-contain pr-1" style={{ maxHeight: notificationListMaxHeight }}>
          {messages.length > 0 ? (
            previewMessages.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="items-start gap-2 py-2"
                render={
                  <Link
                    href={employeeTaskNotificationHref(item)}
                    onClick={() => void markMessagesRead([item.id])}
                  />
                }
              >
                {item.status === "failed" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">
                    {item.status === "failed" ? item.message : item.targetLabel ?? item.message}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无消息提醒。</div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={EMPLOYEE_MESSAGE_CENTER_HREF} onClick={() => void markPreviewRead()} />}>
          <Bell className="h-4 w-4" />
          查看全部消息
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdminPath = isCbeAdminPath(pathname);
  const isAdminLoginPath = isCbeAdminLoginPath(pathname);
  const isEmployeeLoginPath = isCbeEmployeeLoginPath(pathname) || pathname.startsWith("/auth");
  const isAdminAppPath = isAdminPath && !isAdminLoginPath;
  const isAuthPath = isEmployeeLoginPath || isAdminLoginPath;
  const isEmployeePath = isCbeEmployeePath(pathname);
  const navItems = isAdminPath ? adminNav : employeeNav;
  const shellTitle = isAdminPath ? "跨境电商管理者系统" : "跨境电商员工操作系统";
  const showHeaderTitle = !isAuthPath;
  const accountLabel = isAdminPath ? "管理者" : "员工";
  const setTasks = useCbeEmployeeStore((state) => state.setTasks);
  const [sessionUser, setSessionUser] = useState<{ displayName: string } | null>(null);
  const [fullscreenMode, setFullscreenMode] = useState(false);

  useEffect(() => {
    if (!isEmployeePath || isAuthPath) return;
    let cancelled = false;
    async function refreshSession() {
      try {
        const response = await fetch(`${CBE_SESSION_API_PATH}?role=operator`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.user?.cbeRole !== "operator") {
          if (!cancelled) {
            clearCbeSessionDisplayName("operator");
            router.replace(`${CBE_EMPLOYEE_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
          }
          return;
        }
        const displayName = typeof body.user.displayName === "string" ? body.user.displayName.trim() : "";
        if (!cancelled) {
          if (displayName) setCbeSessionDisplayName("operator", displayName);
          setSessionUser({
            displayName: displayName || body.user.displayName,
          });
        }
      } catch {
        if (!cancelled) {
          clearCbeSessionDisplayName("operator");
          router.replace(`${CBE_EMPLOYEE_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
        }
      }
    }
    void refreshSession();
    return () => {
      cancelled = true;
    };
  }, [isAuthPath, isEmployeePath, pathname, router]);

  useEffect(() => {
    if (!isAdminAppPath) return;
    let cancelled = false;
    async function refreshSession() {
      try {
        const response = await fetch(`${CBE_SESSION_API_PATH}?role=admin`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.user?.cbeRole !== "admin") {
          if (!cancelled) {
            clearCbeSessionDisplayName("admin");
            setSessionUser(null);
            router.replace(`${CBE_ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
          }
          return;
        }
        const displayName = typeof body.user.displayName === "string" ? body.user.displayName.trim() : "";
        if (!cancelled) {
          if (displayName) setCbeSessionDisplayName("admin", displayName);
          setSessionUser({
            displayName: displayName || body.user.displayName,
          });
        }
      } catch {
        if (!cancelled) {
          clearCbeSessionDisplayName("admin");
          setSessionUser(null);
          router.replace(`${CBE_ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
        }
      }
    }
    void refreshSession();
    return () => {
      cancelled = true;
    };
  }, [isAdminAppPath, pathname, router]);

  useEffect(() => {
    if (isAdminPath || isAuthPath) return;
    let cancelled = false;
    async function refreshTasks() {
      try {
        const latestTasks = await fetchEmployeeTasks();
        if (!cancelled) setTasks(latestTasks);
      } catch {
        // The task bar is non-blocking; page-level surfaces show API errors.
      }
    }
    void refreshTasks();
    const timer = window.setInterval(refreshTasks, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAdminPath, isAuthPath, setTasks]);

  async function logoutTo(loginPath: string) {
    const role = loginPath.startsWith(CBE_ADMIN_LOGIN_PATH) ? "admin" : "operator";
    await fetch(`/api/auth/logout?role=${role}`, { method: "POST" }).catch(() => undefined);
    clearCbeSessionDisplayName(role);
    setSessionUser(null);
    router.replace(loginPath);
  }

  return (
    <div
      className={cn(
        "sentura-brand-bg flex min-h-full flex-col text-foreground",
        fullscreenMode ? "min-h-dvh" : null,
      )}
      data-sentura-fullscreen={fullscreenMode ? "true" : undefined}
    >
      <header className="sticky top-0 z-40 border-b border-[var(--sentura-border)] bg-white/76 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4 lg:h-16 lg:flex-nowrap lg:px-6 lg:py-0">
          <div
            className={cn(
              "flex min-w-0 shrink-0 items-center",
              isAuthPath ? "w-[176px] max-w-[54vw] sm:w-[190px]" : "w-[132px] max-w-[42vw] sm:w-[156px] sm:max-w-none",
            )}
            aria-label={`Sentura ${shellTitle}`}
          >
            <div className="min-w-0">
              <Image
                src="/sentura-logo-side.svg"
                alt="Sentura"
                width={isAuthPath ? 190 : 156}
                height={isAuthPath ? 34 : 28}
                priority
                className="h-auto w-full"
                style={{ width: "100%", height: "auto" }}
              />
              {showHeaderTitle ? (
                <div className="mt-0.5 truncate text-[10px] font-medium leading-none text-[var(--sentura-muted)] sm:text-[11px]">
                  {shellTitle}
                </div>
              ) : null}
            </div>
          </div>

          {!isAuthPath ? (
            <HeaderPillNav items={navItems} pathname={pathname} ariaLabel={`${shellTitle}页面切换`} />
          ) : null}

          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none sm:gap-2">
            {!isAdminPath && !isAuthPath ? <EmployeeCostMini subjectLabel={sessionUser?.displayName ?? accountLabel} /> : null}
            <ConnectionStatus />
            {isAdminAppPath ? <AdminNotificationBell enabled={isAdminAppPath} /> : null}
            {!isAdminPath && !isAuthPath ? <EmployeeNotificationBell enabled={!isAdminPath && !isAuthPath} /> : null}
            {!isAdminPath && !isAuthPath ? (
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-[var(--sentura-border)] bg-white/68 px-2 py-1.5 shadow-sm lg:flex">
                <span className="sentura-cta flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground">
                  {(sessionUser?.displayName ?? accountLabel).slice(0, 1)}
                </span>
                <span className="text-sm font-medium">{sessionUser?.displayName ?? accountLabel}</span>
              </div>
              <Button variant="outline" size="sm" className="px-2" onClick={() => void logoutTo(CBE_EMPLOYEE_LOGIN_PATH)} aria-label="退出员工端">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">退出</span>
              </Button>
            </div>
            ) : null}
            {isAdminAppPath ? (
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-[var(--sentura-border)] bg-white/68 px-2 py-1.5 shadow-sm lg:flex">
                <span className="sentura-cta flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground">
                  {(sessionUser?.displayName ?? accountLabel).slice(0, 1)}
                </span>
                <span className="text-sm font-medium">{sessionUser?.displayName ?? accountLabel}</span>
              </div>
              <Button variant="outline" size="sm" className="px-2" onClick={() => void logoutTo(CBE_ADMIN_LOGIN_PATH)} aria-label="退出管理端">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">退出</span>
              </Button>
            </div>
            ) : null}
          </div>
        </div>

        {!isAuthPath ? (
          <HeaderMobilePillNav items={navItems} pathname={pathname} />
        ) : null}
      </header>

      <MissingTokenBanner />
      {!isAdminPath && !isAuthPath ? <EmployeeTaskStatusBar /> : null}

      <main className="min-h-0 flex-1">
        <div
          className={cn(
            "mx-auto",
            fullscreenMode
              ? isAuthPath
                ? "min-h-[calc(100dvh-4rem)] w-full max-w-none px-0 py-0"
                : "min-h-[calc(100dvh-4rem)] max-w-[1440px] px-4 py-5 lg:px-6"
              : isAuthPath
                ? "min-h-[calc(100vh-4rem)] w-full max-w-none px-0 py-0"
                : "min-h-[calc(100vh-4rem)] max-w-[1440px] px-4 py-5 lg:px-6",
          )}
        >
          {children}
        </div>
      </main>

      <PlatformFullscreenToggle onActiveChange={setFullscreenMode} />
    </div>
  );
}
