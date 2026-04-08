"use client";

import { useAgents, useApprovals, useGateway } from "@/lib/gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, ShieldCheck, Plus, ExternalLink, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";

export default function DashboardPage() {
  const { state: gwState } = useGateway();
  const { data: agents, loading: agentsLoading, error: agentsError } = useAgents();
  const { data: approvals, loading: approvalsLoading } = useApprovals();

  const pendingApprovals =
    approvals?.filter((a) => a.status === "pending") ?? [];

  const stats = [
    {
      title: "AI Employees",
      value: agents?.length ?? 0,
      icon: Bot,
      href: "/employees",
      description: "Active in your organization",
    },
    {
      title: "Pending Approvals",
      value: pendingApprovals.length,
      icon: ShieldCheck,
      href: "/approvals",
      description: pendingApprovals.length > 0 ? "Require your attention" : "All clear",
    },
  ];

  const disconnected = gwState === "disconnected";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Enterprise Overview
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sentura AI Employee Management Platform
        </p>
      </div>

      {disconnected && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <WifiOff className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Gateway Disconnected
              </p>
              <p className="text-xs text-muted-foreground">
                Cannot reach the OpenClaw Gateway. Ensure it is running and check your{" "}
                <code className="text-xs">NEXT_PUBLIC_GATEWAY_URL</code> setting.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const loading =
            (stat.title === "AI Employees" && agentsLoading) ||
            (stat.title === "Pending Approvals" && approvalsLoading);

          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{stat.value}</div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {/* Link to Control UI overview */}
        <a
          href={CONTROL_UI_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                System Health
              </CardTitle>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                View in Control Panel
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Gateway status, channels, usage
              </p>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4 opacity-60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Create Employee</p>
                <p className="text-xs text-muted-foreground">
                  Chat with the Creator Agent (Week 2)
                </p>
              </div>
            </div>
          </Card>
          <Link href="/employees">
            <Card className="p-4 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Bot className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Manage Employees</p>
                  <p className="text-xs text-muted-foreground">
                    View roster and lifecycle status
                  </p>
                </div>
              </div>
            </Card>
          </Link>
          <a
            href={`${CONTROL_UI_URL}/#sessions`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Card className="p-4 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ExternalLink className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Sessions & Chat</p>
                  <p className="text-xs text-muted-foreground">
                    Open in Control Panel
                  </p>
                </div>
              </div>
            </Card>
          </a>
        </div>
      </div>

      {/* Employee Roster */}
      {agentsLoading ? (
        <div>
          <h2 className="text-lg font-semibold mb-3">AI Employees</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : agents && agents.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">AI Employees</h2>
            <Link
              href="/employees"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.slice(0, 6).map((agent) => (
              <Link key={agent.id} href={`/employees?id=${agent.id}`}>
                <Card className="p-4 hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {agent.name ?? agent.id}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono truncate">
                          {agent.model}
                        </span>
                        {agent.sandbox?.mode && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {agent.sandbox.mode}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
