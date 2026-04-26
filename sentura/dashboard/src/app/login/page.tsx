"use client";

/**
 * `/login` — SSO sign-in placeholder.
 *
 * Today (W5 Phase 4): single-tenant local-dev skips auth entirely; this
 * route exists so the future SSO redirect target is reserved + the
 * design language is locked.
 *
 * When Person A's SAML/OIDC backend lands (W5+ → W6):
 *   - The button below becomes a real `<form action="/api/auth/sso/start">`
 *     submit (or fetch-based redirect) that initiates the IdP handshake
 *   - On callback, set the session cookie + role, redirect to `?next=` or `/`
 *   - Add a "trouble signing in?" link for trusted-proxy fallback per
 *     docs/HOSTING.md
 */

import Link from "next/link";
import { Info, KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="py-10 space-y-6">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
              S
            </div>
            <div>
              <h1 className="text-xl font-semibold">Sign in to Sentura</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Enterprise AI employee management
              </p>
            </div>
          </div>

          {/* Primary CTA — disabled today */}
          <div className="space-y-2">
            <button
              type="button"
              disabled
              className={cn(
                buttonVariants({ size: "default" }),
                "w-full justify-center gap-2",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
              title="SSO not wired yet — Person A is shipping the SAML/OIDC backend in Week 5"
            >
              <KeyRound className="h-4 w-4" />
              Sign in with SSO
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Awaiting{" "}
              <span className="font-medium text-foreground">Person A</span>
              &apos;s SAML/OIDC backend (Week 5).
            </p>
          </div>

          {/* Dev mode banner */}
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Local dev mode
              </p>
              <p className="text-amber-700 dark:text-amber-300/90">
                Single-tenant local development bypasses auth entirely. The
                dashboard is open at{" "}
                <Link href="/" className="underline">
                  /
                </Link>{" "}
                without sign-in. Role defaults to <code>platform_admin</code>;
                use the dev role switcher in the sidebar to preview other
                roles.
              </p>
            </div>
          </div>

          {/* Posture summary */}
          <div className="border-t border-border pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              When SSO ships
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <span>SAML or OIDC redirect to your IdP</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <span>
                  Just-in-time provisioning — first sign-in creates a local
                  user record with default role
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <span>
                  Trusted-proxy fallback for air-gapped deployments (per{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">
                    docs/HOSTING.md
                  </code>
                  )
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
