/**
 * Server-only singleton gateway client. Reuses the same GatewayClient class
 * the browser uses — Node 22+ provides native WebSocket + crypto.randomUUID
 * globals so no polyfill is required.
 *
 * Lifecycle: connects lazily on first call, holds the WebSocket open across
 * API requests, auto-reconnects on drop. The dev server's hot-reload will
 * tear down the module + spawn a fresh client; that's intentional.
 *
 * Token policy (S3.2 / P0-3): server-side code reads `GATEWAY_TOKEN` only.
 * Falling back to `NEXT_PUBLIC_GATEWAY_TOKEN` would tie server logic to the
 * browser-bundled token and entrench the antipattern. If `GATEWAY_TOKEN` is
 * unset the connect throws — operators must set the server-only env var.
 *
 * Usage from a Route Handler:
 *
 *   const client = await getServerGatewayClient();
 *   await client.subscribeSessions();
 *   const result = await client.createSession(agentId, message);
 */

import { GatewayClient } from "./client";

let _client: GatewayClient | null = null;
let _connectPromise: Promise<GatewayClient> | null = null;
let _subscribed = false;
let _originWarnIssued = false;

function resolveConfig(): { url: string; token: string; origin: string } {
  // GATEWAY_URL stays public-fallback friendly — it's not a secret. Token is.
  const url =
    process.env.GATEWAY_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    "ws://localhost:18789";
  const token = process.env.GATEWAY_TOKEN || "";
  // F2.5: warn once at module load if origin defaults are likely wrong for
  // the deployment. Behind a proxy or on a non-default port, the gateway's
  // `controlUi.allowedOrigins` policy will silently reject the WS handshake
  // until DASHBOARD_ORIGIN is set; this surfaces the real cause early.
  const origin = process.env.DASHBOARD_ORIGIN || "http://localhost:3000";
  if (
    !_originWarnIssued &&
    !process.env.DASHBOARD_ORIGIN &&
    process.env.NODE_ENV === "production"
  ) {
    _originWarnIssued = true;
    console.warn(
      "[server-gateway] DASHBOARD_ORIGIN unset in production; using default 'http://localhost:3000'. " +
        "If the gateway rejects this Origin (controlUi.allowedOrigins), set DASHBOARD_ORIGIN to the dashboard's public URL.",
    );
  }
  return { url, token, origin };
}

/**
 * Server-side WebSocket factory. Node 22+'s native WebSocket constructor
 * accepts a non-standard second-argument `{ headers }` option that the
 * browser's WebSocket does not — we use it to inject `Origin` so the
 * gateway's `controlUi.allowedOrigins` policy treats the server-side
 * connection the same as a browser tab.
 */
function makeServerWebSocket(origin: string): (url: string) => WebSocket {
  return (url: string) => {
    const WS = WebSocket as unknown as new (
      url: string,
      init: { headers: Record<string, string> },
    ) => WebSocket;
    return new WS(url, { headers: { Origin: origin } });
  };
}

/**
 * F2.4: ensure we re-attempt sessions.subscribe every time the singleton is
 * vended, idempotently. The previous implementation set `_subscribed = true`
 * only on first success; if the very first subscribe failed we'd never retry
 * for the lifetime of the process. Now: the flag is reset on disconnect,
 * and a warn-and-retry loop keeps the surface alive.
 */
async function ensureSubscribed(client: GatewayClient): Promise<void> {
  if (_subscribed) return;
  try {
    await client.subscribeSessions();
    _subscribed = true;
  } catch (err) {
    console.error("[server-gateway] sessions.subscribe failed:", err);
    // Stay unsubscribed; next caller retries.
  }
}

export async function getServerGatewayClient(): Promise<GatewayClient> {
  if (_client && _client.state === "connected") {
    await ensureSubscribed(_client);
    return _client;
  }
  if (_connectPromise) return _connectPromise;

  _connectPromise = (async () => {
    const { url, token, origin } = resolveConfig();
    if (!token) {
      throw new Error(
        "[server-gateway] GATEWAY_TOKEN is unset. Set the server-only token in .env.local (NOT NEXT_PUBLIC_GATEWAY_TOKEN, which would leak into the client bundle).",
      );
    }
    const client = new GatewayClient({
      url,
      token,
      wsFactory: makeServerWebSocket(origin),
    });
    // Reset state observers in case a previous client was torn down.
    _subscribed = false;
    client.onStateChange((state) => {
      if (state !== "connected") {
        // Force resubscribe on reconnect.
        _subscribed = false;
      }
    });
    try {
      await client.connect();
    } catch (err) {
      console.error("[server-gateway] connect failed:", err);
      throw err;
    }
    // Only assign the singleton on success — failure paths leave _client null
    // so the next request retries from scratch.
    _client = client;
    await ensureSubscribed(client);
    return client;
  })();

  try {
    return await _connectPromise;
  } finally {
    _connectPromise = null;
  }
}
