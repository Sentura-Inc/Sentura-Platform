"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGatewayClient, GatewayClient } from "./client";
import type {
  AgentConfig,
  ApprovalRequest,
  GatewayEvent,
  GatewayEventType,
  SenturaApprovalRequestRaw,
  SessionSummary,
  TranscriptMessage,
} from "./types";

/**
 * Translate a sentura-approval extension request into the flat
 * dashboard ApprovalRequest shape used by the queue UI.
 */
function fromSenturaRaw(raw: SenturaApprovalRequestRaw): ApprovalRequest {
  const status: ApprovalRequest["status"] =
    raw.status === "pending"
      ? "pending"
      : raw.status === "approved" || raw.status === "auto_approved"
        ? "approved"
        : raw.status === "denied" || raw.status === "auto_denied"
          ? "rejected"
          : "expired";
  return {
    id: raw.id,
    agentId: raw.agentId,
    action: raw.action,
    context: raw.context ?? {},
    status,
    createdAt: raw.requestedAt,
    resolvedAt: raw.decidedAt,
    resolvedBy: raw.decidedByUserId,
    kind: "sentura",
    expiresAtMs: raw.expiresAt ? Date.parse(raw.expiresAt) : undefined,
    riskLevel: raw.riskLevel,
    policyId: raw.policyId,
  };
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export function useGateway(): {
  client: GatewayClient;
  state: ConnectionState;
} {
  const clientRef = useRef<GatewayClient>(getGatewayClient());
  const [state, setState] = useState<ConnectionState>(clientRef.current.state);

  useEffect(() => {
    const client = clientRef.current;
    const unsub = client.onStateChange(setState);

    if (client.state === "disconnected") {
      client.connect().catch(() => {});
    }

    return unsub;
  }, []);

  return { client: clientRef.current, state };
}

interface UseRpcResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useRpc<T>(fetcher: (client: GatewayClient) => Promise<T>): UseRpcResult<T> {
  const { client, state } = useGateway();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async () => {
    if (state !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(client);
      setData(result);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "RPC call failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [client, state]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useAgents(): UseRpcResult<AgentConfig[]> {
  return useRpc((client) => client.getAgents());
}

export function useAgent(agentId: string): UseRpcResult<AgentConfig | undefined> {
  return useRpc((client) => client.getAgent(agentId));
}

export function useSessions(): UseRpcResult<SessionSummary[]> {
  return useRpc((client) => client.listSessions());
}

export function useChatSessions(options?: {
  agentId?: string;
  includeMetaAgents?: boolean;
}): UseRpcResult<SessionSummary[]> {
  return useRpc((client) => client.listChatSessions(options));
}

export function useTranscript(sessionKey: string): UseRpcResult<TranscriptMessage[]> {
  return useRpc((client) => client.getTranscript(sessionKey));
}

/**
 * Accumulates pending approvals from gateway events.
 *
 * OpenClaw has no "list pending approvals" RPC — approvals arrive as
 * `exec.approval.requested` / `plugin.approval.requested` events and
 * are removed on `exec.approval.resolved` / `plugin.approval.resolved`.
 *
 * Subscriptions go through `useGatewayEvents` (4 event types in one
 * call); the initial seed via `Promise.all` of the two list RPCs stays
 * here because it's request-response, not event-driven.
 */
export function useApprovals(): UseRpcResult<ApprovalRequest[]> {
  const { client, state } = useGateway();
  const [data, setData] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial seed — fetch any approvals already pending when this hook mounts
  // (e.g. raised before the user opened the app, or before this tab connected).
  // Seeds three sources in parallel:
  //   1. exec.approval.list      — OpenClaw native exec approvals
  //   2. plugin.approval.list    — OpenClaw native plugin approvals
  //   3. sentura.approval.requests.list { status: "pending" } — sentura-approval
  //      extension's context-aware approvals (e.g. self-provisioning HITL)
  useEffect(() => {
    if (state !== "connected") return;
    let cancelled = false;
    (async () => {
      try {
        const [execList, pluginList, senturaList] = await Promise.all([
          client.listExecApprovals().catch(() => []),
          client.listPluginApprovals().catch(() => []),
          client
            .listSenturaApprovals({ status: "pending" })
            .catch(() => [] as SenturaApprovalRequestRaw[]),
        ]);
        if (cancelled) return;
        const initial: ApprovalRequest[] = [
          ...execList.map((r) => ({
            id: r.id,
            agentId:
              typeof r.request?.agentId === "string" ? r.request.agentId : "unknown",
            action:
              typeof r.request?.command === "string" ? r.request.command : "exec",
            context: r.request ?? {},
            status: "pending" as const,
            createdAt: new Date(r.createdAtMs ?? Date.now()).toISOString(),
            expiresAtMs: r.expiresAtMs,
            kind: "exec" as const,
          })),
          ...pluginList.map((r) => ({
            id: r.id,
            agentId:
              typeof r.request?.agentId === "string" ? r.request.agentId : "unknown",
            action:
              typeof r.request?.title === "string" ? r.request.title : "plugin",
            context: r.request ?? {},
            status: "pending" as const,
            createdAt: new Date(r.createdAtMs ?? Date.now()).toISOString(),
            expiresAtMs: r.expiresAtMs,
            kind: "plugin" as const,
          })),
          ...senturaList.map(fromSenturaRaw),
        ];
        setData((prev) => {
          const existing = new Set(prev.map((a) => a.id));
          return [...prev, ...initial.filter((a) => !existing.has(a.id))];
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, state]);

  // Live updates — single subscription effect for all 4 event types.
  useGatewayEvents({
    "exec.approval.requested": (event) => {
      const p = event.payload as {
        id?: string;
        request?: Record<string, unknown>;
        createdAtMs?: number;
        expiresAtMs?: number;
      };
      if (!p.id) return;
      const req = p.request ?? {};
      const agentId = typeof req.agentId === "string" ? req.agentId : "unknown";
      const command = typeof req.command === "string" ? req.command : undefined;
      setData((prev) => {
        if (prev.some((a) => a.id === p.id)) return prev;
        return [
          ...prev,
          {
            id: p.id!,
            agentId,
            action: command ?? "exec",
            context: req,
            status: "pending" as const,
            createdAt: p.createdAtMs
              ? new Date(p.createdAtMs).toISOString()
              : new Date().toISOString(),
            expiresAtMs: p.expiresAtMs,
            kind: "exec" as const,
          },
        ];
      });
    },
    "plugin.approval.requested": (event) => {
      const p = event.payload as {
        id?: string;
        request?: Record<string, unknown>;
        createdAtMs?: number;
        expiresAtMs?: number;
      };
      if (!p.id) return;
      const req = p.request ?? {};
      const agentId = typeof req.agentId === "string" ? req.agentId : "unknown";
      const title = typeof req.title === "string" ? req.title : undefined;
      setData((prev) => {
        if (prev.some((a) => a.id === p.id)) return prev;
        return [
          ...prev,
          {
            id: p.id!,
            agentId,
            action: title ?? "plugin",
            context: req,
            status: "pending" as const,
            createdAt: p.createdAtMs
              ? new Date(p.createdAtMs).toISOString()
              : new Date().toISOString(),
            expiresAtMs: p.expiresAtMs,
            kind: "plugin" as const,
          },
        ];
      });
    },
    "exec.approval.resolved": (event) => {
      const p = event.payload as { id?: string };
      if (!p.id) return;
      setData((prev) => prev.filter((a) => a.id !== p.id));
    },
    "plugin.approval.resolved": (event) => {
      const p = event.payload as { id?: string };
      if (!p.id) return;
      setData((prev) => prev.filter((a) => a.id !== p.id));
    },
  });

  return { data, loading, error: null, refetch: () => {} };
}

export function useGatewayEvent(
  type: GatewayEventType | "*",
  handler: (event: GatewayEvent) => void
) {
  const { client } = useGateway();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return client.on(type, (event) => handlerRef.current(event));
  }, [client, type]);
}

export type GatewayEventHandlerMap = Partial<{
  [K in GatewayEventType | "*"]: (event: GatewayEvent) => void;
}>;

/**
 * Subscribe to multiple gateway events via a per-type handler map.
 *
 * Generalizes the `client.on()` boilerplate that consumers (originally
 * useApprovals) had to repeat for each event type. Single subscription
 * effect, one cleanup, fresh handler closures captured via ref.
 *
 * @example
 *   useGatewayEvents({
 *     "exec.approval.requested": (e) => { ... },
 *     "plugin.approval.resolved": (e) => { ... },
 *   });
 *
 * The effect re-subscribes only when the SET of event types changes —
 * not when handler closures change — so consumers can pass inline
 * arrow functions without thrashing the underlying WS subscriptions.
 *
 * TODO(person-c, phase-3): on reconnect, replay missed events via the
 * relevant *.list RPC backfill where available. Deferred until /chat
 * surfaces a real consumer that needs reconnect resilience.
 */
export function useGatewayEvents(handlers: GatewayEventHandlerMap): void {
  const { client, state } = useGateway();
  const handlersRef = useRef(handlers);

  // Refresh the captured handlers after every render so subscription
  // closures pick up the latest values without resubscribing. React 19's
  // strict refs rule disallows assigning to ref.current during render,
  // so this lives in a no-deps effect instead.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Stable dep that changes only when the SET of subscribed types changes.
  const typeKey = Object.keys(handlers).sort().join("|");

  useEffect(() => {
    if (state !== "connected") return;
    const types = typeKey
      ? (typeKey.split("|") as Array<GatewayEventType | "*">)
      : [];
    const unsubs = types.map((type) =>
      client.on(type, (event) => {
        const handler = handlersRef.current[type];
        handler?.(event);
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [client, state, typeKey]);
}
