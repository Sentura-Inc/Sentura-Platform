"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, X } from "lucide-react";

interface HandshakeBannerProps {
  /** Session key returned by the auto-handshake (e.g.
   *  `agent:billing-support-rep:dashboard:<uuid>`). Clicking the banner
   *  navigates to `/chat?key=<sessionKey>` so the operator sees the welcome
   *  message authored by the new employee. */
  sessionKey: string;
  /** Display name of the new employee (e.g. "Billing Support Rep"). Falls
   *  back to "your new employee" when not available. */
  agentName?: string | null;
  /** Optional dismiss handler. When omitted, the banner is non-dismissable
   *  and only goes away on navigation. */
  onDismiss?: () => void;
}

/**
 * Inline banner shown on /create after a successful deploy + auto-handshake.
 * The new employee has already authored its first message in a freshly
 * created `agent:<newId>:dashboard:<uuid>` session — clicking the banner
 * jumps the operator into that conversation.
 */
export function HandshakeBanner({ sessionKey, agentName, onDismiss }: HandshakeBannerProps) {
  const router = useRouter();
  const display = agentName?.trim() || "your new employee";

  const handleClick = () => {
    router.push(`/chat?key=${encodeURIComponent(sessionKey)}`);
  };

  return (
    <div
      role="alert"
      className="border-b border-emerald-500/60 bg-emerald-50 px-6 py-3 dark:border-emerald-400/40 dark:bg-emerald-950/40"
    >
      <div className="flex items-center gap-3 text-sm">
        <MessageSquare className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <button
          type="button"
          onClick={handleClick}
          className="flex-1 text-left text-emerald-900 hover:underline focus:underline focus:outline-none dark:text-emerald-100"
        >
          <strong>{display}</strong> said hello — click to view the welcome
          conversation.
        </button>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded p-0.5 text-emerald-700/70 hover:bg-emerald-500/10 hover:text-emerald-900 focus:outline-none dark:text-emerald-300/70 dark:hover:text-emerald-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
