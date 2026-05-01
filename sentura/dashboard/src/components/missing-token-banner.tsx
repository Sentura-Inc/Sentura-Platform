"use client";

import { AlertTriangle } from "lucide-react";

const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_GATEWAY_TOKEN;
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_SENTURA_ADMIN_TOKEN;

/**
 * Site-wide banner that warns when required dashboard env vars are missing.
 *
 * The dashboard relies on `.env.local` having both `NEXT_PUBLIC_GATEWAY_TOKEN`
 * (for the OpenClaw connect handshake) and `NEXT_PUBLIC_SENTURA_ADMIN_TOKEN`
 * (for RBAC-guarded RPCs). When either is missing, RPCs fail silently — the
 * gateway WebSocket either rejects with `device identity required` or a
 * dispatched RPC returns `unauthorized`, neither of which surface obviously
 * to the user. Without this banner the symptom is just an empty page or a
 * perpetual "Connecting..." badge.
 *
 * Detection happens at build time: Next.js inlines `process.env.NEXT_PUBLIC_*`
 * into the client bundle. If the user re-runs `sentura-setup.sh` after the
 * dashboard built, they need to restart `pnpm dev` for the new values to
 * take effect — the banner copy says exactly that.
 */
export function MissingTokenBanner() {
  const missing: string[] = [];
  if (!GATEWAY_TOKEN || GATEWAY_TOKEN.trim() === "") {
    missing.push("NEXT_PUBLIC_GATEWAY_TOKEN");
  }
  if (!ADMIN_TOKEN || ADMIN_TOKEN.trim() === "") {
    missing.push("NEXT_PUBLIC_SENTURA_ADMIN_TOKEN");
  }
  if (missing.length === 0) return null;

  return (
    <div
      role="alert"
      className="border-b border-destructive/50 bg-destructive/10 px-6 py-2"
    >
      <div className="flex items-start gap-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <strong>Missing dashboard env var{missing.length > 1 ? "s" : ""}:</strong>{" "}
          {missing.map((name, i) => (
            <span key={name}>
              <code className="rounded bg-destructive/15 px-1 py-0.5 font-mono text-xs">
                {name}
              </code>
              {i < missing.length - 1 ? ", " : ""}
            </span>
          ))}
          . Re-run{" "}
          <code className="rounded bg-destructive/15 px-1 py-0.5 font-mono text-xs">
            ./scripts/sentura-setup.sh
          </code>{" "}
          and restart{" "}
          <code className="rounded bg-destructive/15 px-1 py-0.5 font-mono text-xs">
            pnpm dev
          </code>
          .
        </div>
      </div>
    </div>
  );
}
