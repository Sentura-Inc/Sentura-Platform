"use client";

import { AlertTriangle } from "lucide-react";

const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_GATEWAY_TOKEN;
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_SENTURA_ADMIN_TOKEN;

/**
 * Site-wide banner that warns when required dashboard env vars are missing.
 *
 * Dev posture (S3.2 INFO): the `NEXT_PUBLIC_GATEWAY_TOKEN` and
 * `NEXT_PUBLIC_SENTURA_ADMIN_TOKEN` values are inlined into the client
 * bundle by Next.js at build time. They are NOT secrets in the dev
 * deployment — every browser tab can read them. Production deployments
 * (post-W6 SSO) MUST replace this with: (a) a server-only `GATEWAY_TOKEN`
 * read by route handlers, plus (b) an SSO-asserted session cookie that
 * the dashboard server uses to derive the actorId — never inlined into
 * the bundle. The server route handler at `lib/gateway/server-client.ts`
 * already reads only `GATEWAY_TOKEN` (no NEXT_PUBLIC fallback) so the
 * server side is ready for that migration.
 *
 * Banner detection: Next.js inlines `process.env.NEXT_PUBLIC_*` at build
 * time. If the user re-runs `sentura-setup.sh` after the dashboard built,
 * they need to restart `pnpm dev` for the new values to take effect —
 * the banner copy says exactly that.
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
