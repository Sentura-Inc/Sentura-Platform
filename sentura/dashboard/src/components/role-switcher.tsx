"use client";

/**
 * Dev-only role switcher. Renders a small popover at the bottom of the
 * sidebar (above the auth placeholder) listing all 7 roles. Picking one
 * updates `useCurrentRole().setRole`, which writes to localStorage and
 * triggers re-render of every `usePermission` consumer.
 *
 * Visibility is gated by `NEXT_PUBLIC_ENABLE_ROLE_SWITCHER=1` (defaults to
 * off so production never accidentally exposes it). Useful for QA / demo:
 * preview "what does an end_user see" without rebuilding tokens or restarting.
 */

import { ShieldCheck, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { useCurrentRole } from "@/lib/auth/use-current-role";
import { cn } from "@/lib/utils";

interface RoleSwitcherProps {
  collapsed?: boolean;
}

export function RoleSwitcher({ collapsed = false }: RoleSwitcherProps) {
  const { role, setRole, switcherEnabled } = useCurrentRole();

  if (!switcherEnabled) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium",
          "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          collapsed && "justify-center px-2",
        )}
        title={`Currently as: ${ROLE_LABELS[role]} (dev)`}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">
              {ROLE_LABELS[role]}
            </span>
            <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
              dev
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-72">
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
          Preview as role
          <span className="ml-auto rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            dev only
          </span>
        </div>
        <DropdownMenuSeparator />
        {ROLES.map((r) => {
          const isActive = r === role;
          return (
            <DropdownMenuItem
              key={r}
              onClick={() => setRole(r)}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <div className="flex w-full items-center gap-2">
                <span className="text-sm font-medium">{ROLE_LABELS[r]}</span>
                {isActive && (
                  <Check className="ml-auto h-3.5 w-3.5 text-emerald-500" />
                )}
              </div>
              <span className="text-[11px] text-muted-foreground leading-snug">
                {ROLE_DESCRIPTIONS[r]}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[10px] font-normal text-muted-foreground">
          Persists in localStorage. Cleared by clearing site data. Disabled
          when <code>NEXT_PUBLIC_ENABLE_ROLE_SWITCHER</code> is unset.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
