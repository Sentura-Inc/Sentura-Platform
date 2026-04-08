"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGatewayClient, GatewayClient } from "./client";
import type {
  AgentConfig,
  ApprovalRequest,
  GatewayEvent,
  GatewayEventType,
  SessionSummary,
  TranscriptMessage,
} from "./types";

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

export function useTranscript(sessionKey: string): UseRpcResult<TranscriptMessage[]> {
  return useRpc((client) => client.getTranscript(sessionKey));
}

/**
 * Accumulates pending approvals from gateway events.
 * OpenClaw has no "list pending approvals" RPC — approvals arrive as
 * `exec.approval.requested` / `plugin.approval.requested` events and
 * are removed when `exec.approval.resolved` / `plugin.approval.resolved`
 * events fire.
 */
export function useApprovals(): UseRpcResult<ApprovalRequest[]> {
  const { client, state } = useGateway();
  const [data, setData] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (state !== "connected") return;
    setLoading(false);

    const unsubExecReq = client.on("exec.approval.requested", (event) => {
      const p = event.payload as {
        id?: string;
        request?: { agentId?: string; command?: string };
        createdAtMs?: number;
        expiresAtMs?: number;
      };
      if (!p.id) return;
      setData((prev) => {
        if (prev.some((a) => a.id === p.id)) return prev;
        return [
          ...prev,
          {
            id: p.id!,
            agentId: p.request?.agentId ?? "unknown",
            action: p.request?.command ?? "exec",
            status: "pending" as const,
            createdAt: p.createdAtMs ? new Date(p.createdAtMs).toISOString() : new Date().toISOString(),
          },
        ];
      });
    });

    const unsubPluginReq = client.on("plugin.approval.requested", (event) => {
      const p = event.payload as {
        id?: string;
        request?: { agentId?: string; title?: string };
        createdAtMs?: number;
      };
      if (!p.id) return;
      setData((prev) => {
        if (prev.some((a) => a.id === p.id)) return prev;
        return [
          ...prev,
          {
            id: p.id!,
            agentId: p.request?.agentId ?? "unknown",
            action: p.request?.title ?? "plugin",
            status: "pending" as const,
            createdAt: p.createdAtMs ? new Date(p.createdAtMs).toISOString() : new Date().toISOString(),
          },
        ];
      });
    });

    const removeResolved = (event: GatewayEvent) => {
      const p = event.payload as { id?: string };
      if (!p.id) return;
      setData((prev) => prev.filter((a) => a.id !== p.id));
    };

    const unsubExecRes = client.on("exec.approval.resolved", removeResolved);
    const unsubPluginRes = client.on("plugin.approval.resolved", removeResolved);

    return () => {
      unsubExecReq();
      unsubPluginReq();
      unsubExecRes();
      unsubPluginRes();
    };
  }, [client, state]);

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
