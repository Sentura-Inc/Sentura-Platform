/**
 * Server-only singleton gateway client. Reuses the same GatewayClient class
 * the browser uses — Node 22+ provides native WebSocket + crypto.randomUUID
 * globals so no polyfill is required.
 *
 * Lifecycle: connects lazily on first call, holds the WebSocket open across
 * API requests, auto-reconnects on drop. The dev server's hot-reload will
 * tear down the module + spawn a fresh client; that's intentional.
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

function resolveConfig(): { url: string; token: string; origin: string } {
  const url =
    process.env.GATEWAY_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    "ws://localhost:18789";
  const token =
    process.env.GATEWAY_TOKEN ||
    process.env.NEXT_PUBLIC_GATEWAY_TOKEN ||
    "";
  // Match the Origin the browser-side dashboard uses, since the gateway's
  // controlUi.allowedOrigins policy is keyed off this header. Default to
  // the dev server URL; override with DASHBOARD_ORIGIN if served behind a
  // proxy or on a different host in prod.
  const origin =
    process.env.DASHBOARD_ORIGIN || "http://localhost:3000";
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

export async function getServerGatewayClient(): Promise<GatewayClient> {
  if (_client && _client.state === "connected") return _client;
  if (_connectPromise) return _connectPromise;

  _connectPromise = (async () => {
    const { url, token, origin } = resolveConfig();
    const client = new GatewayClient({
      url,
      token,
      wsFactory: makeServerWebSocket(origin),
    });
    await client.connect();
    _client = client;
    if (!_subscribed) {
      try {
        await client.subscribeSessions();
        _subscribed = true;
      } catch (err) {
        console.warn("[server-gateway] sessions.subscribe failed:", err);
      }
    }
    return client;
  })();

  try {
    return await _connectPromise;
  } finally {
    _connectPromise = null;
  }
}
