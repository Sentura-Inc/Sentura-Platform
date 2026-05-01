"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAgents } from "@/lib/gateway";
import type { AgentConfig } from "@/lib/gateway";
import { usePermission } from "@/lib/auth/use-permission";
import { useAgentRosterStore } from "@/stores/use-agent-roster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sliders,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

type LifecycleStatus = "active" | "paused" | "retired";

function inferStatus(agent: AgentConfig): LifecycleStatus {
  return "active";
}

function StatusBadge({ status }: { status: LifecycleStatus }) {
  const variants: Record<LifecycleStatus, "default" | "secondary" | "outline"> = {
    active: "default",
    paused: "secondary",
    retired: "outline",
  };
  return (
    <Badge variant={variants[status]} className="text-xs capitalize">
      {status}
    </Badge>
  );
}

function EmployeeTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48 ml-auto" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function EmployeesPage() {
  const router = useRouter();
  const { data: agents, loading, error, refetch } = useAgents();
  const [search, setSearch] = useState("");
  const { allowed: canCreate } = usePermission("agents.create");

  // Mirror the fetched roster into the global store so other surfaces
  // (e.g. /chat employee picker in Phase 3) can subscribe without re-fetching.
  const setRosterAgents = useAgentRosterStore((s) => s.setAgents);
  useEffect(() => {
    if (agents) setRosterAgents(agents);
  }, [agents, setRosterAgents]);

  const filtered = agents?.filter((agent) => {
    const q = search.toLowerCase();
    return (
      agent.id.toLowerCase().includes(q) ||
      (agent.name?.toLowerCase().includes(q) ?? false) ||
      agent.model.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI Employees
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization&apos;s AI workforce lifecycle
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${CONTROL_UI_URL}/#agents`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Raw Config
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {canCreate ? (
            <Link
              href="/create"
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Employee
            </Link>
          ) : (
            <Button size="sm" disabled title="You don't have permission to create employees">
              <Plus className="h-4 w-4 mr-2" />
              Create Employee
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID, or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">
              Failed to load employees: {error}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure the OpenClaw gateway is running at the configured URL.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Employee Roster
            {filtered && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filtered.length}{" "}
                {filtered.length === 1 ? "employee" : "employees"})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-6">
              <EmployeeTableSkeleton />
            </div>
          ) : !filtered || filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bot className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {search
                  ? "No employees match your search"
                  : "No AI employees found"}
              </p>
              <p className="text-xs mt-1">
                {search
                  ? "Try a different search term"
                  : "Connect to the gateway to see registered agents"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Employee</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sandbox</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((agent) => {
                  const status = inferStatus(agent);
                  return (
                    <TableRow
                      key={agent.id}
                      className="cursor-pointer hover:bg-accent/40"
                      onClick={() => router.push(`/employees/${agent.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {agent.name ?? agent.id}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {agent.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{agent.model}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell>
                        {agent.sandbox?.mode ? (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            {agent.sandbox.mode}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            ---
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" disabled>
                            <Sliders className="h-3.5 w-3.5 mr-1" />
                            Tune
                          </Button>
                          <a
                            href={`${CONTROL_UI_URL}/#agents`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Config
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
