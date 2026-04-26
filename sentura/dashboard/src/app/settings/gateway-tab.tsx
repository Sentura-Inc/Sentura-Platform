"use client";

import { Activity, Cable, CheckCircle2, Hash, Server, WifiOff } from "lucide-react";
import { useGateway } from "@/lib/gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CONTROL_UI_URL =
  process.env.NEXT_PUBLIC_CONTROL_UI_URL ?? "http://localhost:18789";
const GATEWAY_WS_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "ws://localhost:18789";

/**
 * Gateway tab — read-only diagnostics for the active OpenClaw gateway
 * connection. Useful for debugging hung sessions, version mismatch, and
 * checking which RPC methods / events the gateway supports today.
 */
export function GatewayTab() {
  const { client, state } = useGateway();
  // `client.serverInfo` is set during the connect handshake before the
  // state flips to "connected", so reading it in render is safe whenever
  // the gateway is up. When disconnected it's null and we render dashes.
  const serverInfo = state === "connected" ? client.serverInfo : null;

  const connected = state === "connected";
  const protocol = serverInfo?.protocol;
  const serverVersion = serverInfo?.server?.version;
  const connId = serverInfo?.server?.connId;
  const methods = serverInfo?.features?.methods ?? [];
  const events = serverInfo?.features?.events ?? [];
  const policy = serverInfo?.policy;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cable className="h-4 w-4" />
            Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <KV label="Status">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
                connected
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {connected ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  {state}
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  {state}
                </>
              )}
            </span>
          </KV>
          <KV label="WebSocket URL">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              {GATEWAY_WS_URL}
            </code>
          </KV>
          <KV label="Control UI">
            <a
              href={CONTROL_UI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {CONTROL_UI_URL}
            </a>
          </KV>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Server
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <KV label="OpenClaw version">
            {serverVersion ? (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {serverVersion}
              </code>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </KV>
          <KV label="Protocol version">
            {protocol !== undefined ? (
              <Badge variant="secondary" className="font-mono">
                v{protocol}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </KV>
          <KV label="Connection ID">
            {connId ? (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono break-all">
                {connId}
              </code>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </KV>
          {policy && (
            <KV label="Limits">
              <span className="text-xs text-muted-foreground">
                payload {(policy.maxPayload / 1024).toFixed(0)} KB ·
                buffer {(policy.maxBufferedBytes / 1024).toFixed(0)} KB
              </span>
            </KV>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Hash className="h-3 w-3" />
              RPC methods ({methods.length})
            </p>
            {methods.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {methods.map((m) => (
                  <code
                    key={m}
                    className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono"
                  >
                    {m}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Connect to gateway to see supported methods.
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Hash className="h-3 w-3" />
              Events ({events.length})
            </p>
            {events.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {events.map((e) => (
                  <code
                    key={e}
                    className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono"
                  >
                    {e}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Connect to gateway to see broadcast events.
              </p>
            )}
          </div>
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
