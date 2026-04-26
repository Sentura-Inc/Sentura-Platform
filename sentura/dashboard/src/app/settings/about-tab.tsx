"use client";

import { useGateway } from "@/lib/gateway";
import {
  Code2,
  ExternalLink,
  HardDrive,
  Info,
  Package,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SENTURA_VERSION = "0.1.0"; // Mirrors sentura/dashboard/package.json
const SENTURA_REPO = "https://github.com/Sentura-Inc/Sentura-Platform";
const OPENCLAW_REPO = "https://github.com/openclaw/openclaw";

/**
 * About tab — versions, license posture, support / docs links. Pure
 * presentational, no backend deps; ships real today.
 */
export function AboutTab() {
  const { client, state } = useGateway();
  const openclawVersion =
    state === "connected"
      ? client.serverInfo?.server?.version ?? "unknown"
      : "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Versions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <KV label="Sentura dashboard">
            <Badge variant="secondary" className="font-mono">
              v{SENTURA_VERSION}
            </Badge>
          </KV>
          <KV label="OpenClaw runtime">
            <Badge variant="secondary" className="font-mono">
              {openclawVersion}
            </Badge>
          </KV>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Deployment posture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <KV label="Mode">
            <span className="text-xs text-muted-foreground">
              Local single-tenant dev (SSO + multi-tenancy ship Week 6)
            </span>
          </KV>
          <KV label="Cloud dependency">
            <span className="text-xs text-muted-foreground">
              None — gateway, dashboard, LLM all run in your network
            </span>
          </KV>
          <KV label="Data residency">
            <span className="text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                ~/.openclaw/
              </code>{" "}
              + project workspaces
            </span>
          </KV>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ResourceLink
            href={SENTURA_REPO}
            icon={<Code2 className="h-4 w-4" />}
            label="Sentura platform repository"
          />
          <ResourceLink
            href={OPENCLAW_REPO}
            icon={<Code2 className="h-4 w-4" />}
            label="OpenClaw upstream repository"
          />
          <ResourceLink
            href={`${SENTURA_REPO}/issues/new`}
            icon={<Info className="h-4 w-4" />}
            label="Report an issue"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground shrink-0 pt-0.5">
        {label}
      </span>
      <div className="text-right min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ResourceLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent/50 transition-colors group"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-muted-foreground" />
    </a>
  );
}
