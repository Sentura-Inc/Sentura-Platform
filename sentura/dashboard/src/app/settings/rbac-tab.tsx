"use client";

import { Check, Minus, ShieldCheck, Users } from "lucide-react";
import {
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from "@/lib/auth/roles";
import type { PermissionAction } from "@/lib/auth/use-permission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonBlock } from "@/components/skeleton-block";
import { cn } from "@/lib/utils";

/**
 * RBAC tab — two halves:
 *   1. Real today: role × permission matrix sourced from
 *      `src/lib/auth/roles.ts` (the same data the live `usePermission`
 *      hook reads). Reviewers + auditors can confirm what each role
 *      actually grants without spelunking through code.
 *   2. Skeleton: user assignment / role binding lives behind Person D's
 *      `sentura-rbac` user/role API which lands later in W5.
 */

const ALL_ACTIONS: PermissionAction[] = [
  "audit.read",
  "audit.export",
  "agents.create",
  "agents.delete",
  "agents.tune",
  "agents.read",
  "approvals.resolve",
  "settings.write",
  "ekg.read",
  "ekg.write",
  "sessions.read",
];

export function RbacTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Role × permission matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground max-w-2xl">
            Sourced from <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">src/lib/auth/roles.ts</code>.
            Mirrors{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              sentura/extensions/sentura-rbac/DESIGN.md § 4
            </code>
            . Resource-level scoping (dept-only, own-only) is enforced
            server-side and not modeled in this matrix.
          </p>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Action
                  </th>
                  {ROLES.map((r) => (
                    <th
                      key={r}
                      className="px-2 py-2 text-center font-medium text-muted-foreground whitespace-nowrap"
                      title={ROLE_DESCRIPTIONS[r]}
                    >
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_ACTIONS.map((action, idx) => (
                  <tr
                    key={action}
                    className={cn(
                      "border-t border-border",
                      idx % 2 === 1 && "bg-muted/20",
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-[11px]">{action}</td>
                    {ROLES.map((r) => {
                      const granted = ROLE_PERMISSIONS[r].has(action);
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          {granted ? (
                            <Check className="inline h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Minus className="inline h-3 w-3 text-muted-foreground/40" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            User assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonBlock
            blockingOwner="Person D"
            blockingDeliverable="sentura-rbac user / role lookup RPC + dashboard wiring"
            targetWeek="Week 5"
            willInclude={[
              "Searchable user roster — every authenticated user, their role, scope (SME-wide or per-department), last activity",
              "Inline role assignment — change a user's role with audit trail entry",
              "Department scope editor — for manager / ekg_manager users, pick which departments they govern",
              "Bulk role import — CSV / SCIM provisioning hook for enterprise SSO sync",
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
