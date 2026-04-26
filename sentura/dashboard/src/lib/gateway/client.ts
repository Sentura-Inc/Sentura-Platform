import type {
  AgentConfig,
  AgentFileContent,
  AgentFileEntry,
  ApprovalRequest,
  BindingConfig,
  ConnectParams,
  EventFrame,
  GatewayClientOptions,
  GatewayEvent,
  GatewayEventType,
  GatewayHealth,
  HelloOk,
  RequestFrame,
  ResponseFrame,
  RpcError,
  SessionCreateResult,
  SessionSummary,
  TranscriptMessage,
} from "./types";
import { filterChatSessions } from "./chat-sessions";

type EventHandler = (event: GatewayEvent) => void;
type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

const PROTOCOL_VERSION = 3;
const SENTURA_VERSION = "0.1.0";
const REQUEST_TIMEOUT_MS = 30_000;

function generateIdempotencyKey(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private options: Required<GatewayClientOptions>;
  private pendingCalls = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: RpcError) => void }
  >();
  private eventHandlers = new Map<GatewayEventType | string | "*", Set<EventHandler>>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _state: ConnectionState = "disconnected";
  private idCounter = 0;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;
  private helloOk: HelloOk | null = null;

  constructor(options: GatewayClientOptions) {
    this.options = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  get state(): ConnectionState {
    return this._state;
  }

  get serverInfo(): HelloOk | null {
    return this.helloOk;
  }

  private setState(state: ConnectionState) {
    this._state = state;
    this.stateListeners.forEach((fn) => fn(state));
  }

  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN && this._state === "connected") {
        resolve();
        return;
      }

      this.setState("connecting");
      this.connectResolve = resolve;
      this.connectReject = reject;

      this.ws = new WebSocket(this.options.url);

      this.ws.onclose = () => {
        const wasConnecting = this._state === "connecting";
        this.setState("disconnected");
        this.helloOk = null;
        this.rejectAllPending("Connection closed");
        if (wasConnecting && this.connectReject) {
          this.connectReject(new Error("WebSocket closed before handshake completed"));
          this.connectResolve = null;
          this.connectReject = null;
        }
        if (this.options.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        if (this._state === "connecting" && this.connectReject) {
          this.connectReject(new Error("WebSocket connection failed"));
          this.connectResolve = null;
          this.connectReject = null;
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string);
      };
    });
  }

  disconnect() {
    this.options.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.helloOk = null;
    this.setState("disconnected");
    this.rejectAllPending("Client disconnected");
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }
    this.setState("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // reconnect will be rescheduled via onclose
      });
    }, this.options.reconnectInterval);
  }

  private rejectAllPending(reason: string) {
    for (const [, handler] of this.pendingCalls) {
      handler.reject({ code: "DISCONNECTED", message: reason });
    }
    this.pendingCalls.clear();
  }

  /**
   * Sends the `connect` handshake request in response to the server's
   * `connect.challenge` event. Uses `openclaw-control-ui` client ID with
   * `ui` mode to inherit Control UI scopes (operator.read/write/admin).
   */
  private sendConnectHandshake(nonce: string) {
    const params: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: "openclaw-control-ui",
        displayName: "Sentura Dashboard",
        version: SENTURA_VERSION,
        platform: "browser",
        mode: "ui",
      },
      caps: [],
      role: "operator",
      scopes: [
        "operator.read",
        "operator.write",
        "operator.admin",
        "operator.approvals",
      ],
      auth: {
        token: this.options.token || undefined,
      },
    };

    const id = this.nextId();
    const frame: RequestFrame = { type: "req", id, method: "connect", params };

    this.pendingCalls.set(id, {
      resolve: (value) => {
        const hello = value as HelloOk;
        this.helloOk = hello;
        this.setState("connected");
        this.reconnectAttempts = 0;
        if (this.connectResolve) {
          this.connectResolve();
          this.connectResolve = null;
          this.connectReject = null;
        }
      },
      reject: (err) => {
        if (this.connectReject) {
          this.connectReject(new Error(`Gateway handshake failed: ${err.message}`));
          this.connectResolve = null;
          this.connectReject = null;
        }
      },
    });

    this.ws?.send(JSON.stringify(frame));
  }

  private handleMessage(raw: string) {
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || !("type" in data)) {
        return;
      }

      const frameType = data.type as string;

      if (frameType === "event") {
        this.handleEvent(data as EventFrame);
        return;
      }

      if (frameType === "res") {
        this.handleResponse(data as ResponseFrame);
        return;
      }
    } catch {
      // ignore malformed messages
    }
  }

  private handleEvent(frame: EventFrame) {
    if (frame.event === "connect.challenge") {
      const payload = frame.payload as { nonce?: string } | undefined;
      const nonce = payload?.nonce;
      if (typeof nonce === "string" && nonce.trim()) {
        this.sendConnectHandshake(nonce.trim());
      }
      return;
    }

    const event: GatewayEvent = {
      type: frame.event as GatewayEventType,
      payload: (frame.payload as Record<string, unknown>) ?? {},
    };
    this.emitEvent(event);
  }

  private handleResponse(frame: ResponseFrame) {
    const pending = this.pendingCalls.get(frame.id);
    if (!pending) {
      return;
    }
    this.pendingCalls.delete(frame.id);
    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      pending.reject({
        code: frame.error?.code ?? "UNKNOWN",
        message: frame.error?.message ?? "unknown error",
        details: frame.error?.details,
      });
    }
  }

  private emitEvent(event: GatewayEvent) {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((fn) => fn(event));
    }
    const wildcardHandlers = this.eventHandlers.get("*");
    if (wildcardHandlers) {
      wildcardHandlers.forEach((fn) => fn(event));
    }
  }

  on(type: GatewayEventType | string | "*", handler: EventHandler): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);
    return () => {
      this.eventHandlers.get(type)?.delete(handler);
    };
  }

  private nextId(): string {
    return `rpc-${++this.idCounter}-${Date.now()}`;
  }

  async rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this._state !== "connected") {
      throw { code: "DISCONNECTED", message: "Not connected to gateway" } satisfies RpcError;
    }

    const id = this.nextId();
    const frame: RequestFrame = { type: "req", id, method, params };

    return new Promise<T>((resolve, reject) => {
      this.pendingCalls.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.ws!.send(JSON.stringify(frame));

      setTimeout(() => {
        if (this.pendingCalls.has(id)) {
          this.pendingCalls.delete(id);
          reject({ code: "TIMEOUT", message: "RPC call timed out" } satisfies RpcError);
        }
      }, REQUEST_TIMEOUT_MS);
    });
  }

  // --- Config Methods ---

  async getConfig(): Promise<Record<string, unknown>> {
    const snapshot = await this.rpc<{
      hash?: string;
      config?: Record<string, unknown>;
    }>("config.get");
    return snapshot?.config ?? {};
  }

  async getConfigHash(): Promise<string | undefined> {
    const snapshot = await this.rpc<{ hash?: string }>("config.get");
    return snapshot?.hash;
  }

  async patchConfig(raw: string, baseHash?: string): Promise<unknown> {
    return this.rpc("config.patch", { raw, ...(baseHash ? { baseHash } : {}) });
  }

  // --- Agent Methods ---

  private static readonly META_AGENT_IDS = new Set(["creator", "tuner", "orchestrator"]);

  async getAgents(): Promise<AgentConfig[]> {
    const config = await this.getConfig();
    const agents = config?.agents as { list?: AgentConfig[] } | undefined;
    const all = agents?.list ?? [];
    return all.filter((a) => !GatewayClient.META_AGENT_IDS.has(a.id));
  }

  async getAllAgentsIncludingMeta(): Promise<AgentConfig[]> {
    const config = await this.getConfig();
    const agents = config?.agents as { list?: AgentConfig[] } | undefined;
    return agents?.list ?? [];
  }

  async getAgent(agentId: string): Promise<AgentConfig | undefined> {
    const agents = await this.getAllAgentsIncludingMeta();
    return agents.find((a) => a.id === agentId);
  }

  /**
   * Retire (delete) an AI employee. By default the gateway also trashes the
   * agent's workspace + state directories; set `deleteFiles: false` to keep
   * them on disk for audit/recovery.
   */
  async deleteAgent(
    agentId: string,
    options?: { deleteFiles?: boolean },
  ): Promise<{ ok: boolean; agentId: string; removedBindings?: number }> {
    return this.rpc("agents.delete", {
      agentId,
      ...(options && "deleteFiles" in options
        ? { deleteFiles: options.deleteFiles }
        : {}),
    });
  }

  // --- Session Methods ---

  async listSessions(options?: { agentId?: string }): Promise<SessionSummary[]> {
    const params: Record<string, unknown> = {};
    if (options?.agentId) params.agentId = options.agentId;
    const result = await this.rpc<SessionSummary[] | { sessions: SessionSummary[] }>(
      "sessions.list",
      Object.keys(params).length > 0 ? params : undefined,
    );
    if (Array.isArray(result)) return result;
    return result?.sessions ?? [];
  }

  async getSession(sessionKey: string): Promise<SessionSummary> {
    return this.rpc<SessionSummary>("sessions.get", { sessionKey });
  }

  async getTranscript(sessionKey: string, limit?: number): Promise<TranscriptMessage[]> {
    const result = await this.rpc<{ messages?: TranscriptMessage[] }>(
      "chat.history",
      { sessionKey, ...(limit ? { limit } : {}) }
    );
    return result?.messages ?? [];
  }

  /**
   * Delete a session (and optionally its transcript). Gateway schema expects
   * `key`, not `sessionKey`.
   */
  async deleteSession(
    sessionKey: string,
    options?: { deleteTranscript?: boolean },
  ): Promise<void> {
    await this.rpc("sessions.delete", {
      key: sessionKey,
      ...(options?.deleteTranscript !== undefined
        ? { deleteTranscript: options.deleteTranscript }
        : {}),
    });
  }

  /**
   * Patch an existing session. Primary use case on the dashboard is renaming
   * via `label`. Gateway schema expects `key`, not `sessionKey`.
   */
  async patchSession(
    sessionKey: string,
    patch: { label?: string | null },
  ): Promise<unknown> {
    return this.rpc("sessions.patch", { key: sessionKey, ...patch });
  }

  /**
   * Create a new dashboard-originated session with a specific agent.
   * Returns the canonical session key to use for subsequent chat.send calls
   * and to match against "chat" / "session.message" events.
   */
  async createSession(
    agentId: string,
    initialMessage?: string,
    options?: { label?: string },
  ): Promise<SessionCreateResult> {
    const params: Record<string, unknown> = { agentId };
    if (initialMessage && initialMessage.trim()) {
      params.message = initialMessage;
    }
    const label = options?.label?.trim();
    if (label) params.label = label;
    return this.rpc<SessionCreateResult>("sessions.create", params);
  }

  async createChatSession(
    agentId: string,
    options?: { initialMessage?: string; label?: string },
  ): Promise<SessionCreateResult> {
    return this.createSession(agentId, options?.initialMessage, {
      label: options?.label,
    });
  }

  // --- Chat Methods ---

  async sendChat(
    message: string,
    sessionKey: string,
    idempotencyKey?: string
  ): Promise<unknown> {
    return this.rpc("chat.send", {
      message,
      sessionKey,
      idempotencyKey: idempotencyKey ?? generateIdempotencyKey(),
    });
  }

  async sendChatMessage(
    sessionKey: string,
    message: string,
    idempotencyKey?: string,
  ): Promise<unknown> {
    return this.sendChat(message, sessionKey, idempotencyKey);
  }

  async getChatHistory(
    sessionKey: string,
    limit?: number
  ): Promise<TranscriptMessage[]> {
    return this.getTranscript(sessionKey, limit);
  }

  /**
   * Subscribe this connection to session-scoped events (`session.message`,
   * `session.tool`, `sessions.changed`). Without this call the dashboard
   * only receives the broadcast `chat` stream (merged assistant text). For
   * richer progress surfacing — tool-call starts/results, thinking blocks
   * — callers must subscribe once per connect.
   */
  async subscribeSessions(): Promise<void> {
    await this.rpc("sessions.subscribe");
  }

  async unsubscribeSessions(): Promise<void> {
    await this.rpc("sessions.unsubscribe");
  }

  async listChatSessions(options?: {
    agentId?: string;
    includeMetaAgents?: boolean;
  }): Promise<SessionSummary[]> {
    const sessions = await this.listSessions(
      options?.agentId ? { agentId: options.agentId } : undefined,
    );
    return filterChatSessions(sessions, options);
  }

  // --- Agent Workspace Files ---

  async listAgentFiles(agentId: string): Promise<AgentFileEntry[]> {
    const result = await this.rpc<{ files?: AgentFileEntry[] }>(
      "agents.files.list",
      { agentId }
    );
    return result?.files ?? [];
  }

  async getAgentFile(agentId: string, name: string): Promise<AgentFileContent | null> {
    try {
      const result = await this.rpc<{ file?: AgentFileContent }>(
        "agents.files.get",
        { agentId, name }
      );
      return result?.file ?? null;
    } catch (err) {
      const code = (err as RpcError | undefined)?.code ?? "";
      // Missing file / not in allow-list: surface as null rather than throwing.
      if (
        code === "NOT_FOUND" ||
        code === "INVALID_REQUEST" ||
        code === "invalid-request"
      ) {
        return null;
      }
      throw err;
    }
  }

  // --- Bindings ---

  /** Retrieve channel bindings for a given agent from the live config snapshot. */
  async getBindingsForAgent(agentId: string): Promise<BindingConfig[]> {
    const config = await this.getConfig();
    const raw = (config.bindings as BindingConfig[] | undefined) ?? [];
    return raw.filter((b) => b.agentId === agentId);
  }

  // --- Approval Methods ---
  // OpenClaw approvals are event-driven: the gateway broadcasts
  // `exec.approval.requested` and `plugin.approval.requested` events
  // when agents request approval. There is no "list pending" RPC method.
  // The dashboard accumulates pending approvals by listening to these events.

  async getApproval(id: string): Promise<unknown> {
    return this.rpc("exec.approval.get", { id });
  }

  async listExecApprovals(): Promise<
    Array<{
      id: string;
      request: Record<string, unknown>;
      createdAtMs: number;
      expiresAtMs?: number;
    }>
  > {
    const result = await this.rpc<
      Array<{
        id: string;
        request: Record<string, unknown>;
        createdAtMs: number;
        expiresAtMs?: number;
      }>
    >("exec.approval.list");
    return result ?? [];
  }

  async listPluginApprovals(): Promise<
    Array<{
      id: string;
      request: Record<string, unknown>;
      createdAtMs: number;
      expiresAtMs?: number;
    }>
  > {
    const result = await this.rpc<
      Array<{
        id: string;
        request: Record<string, unknown>;
        createdAtMs: number;
        expiresAtMs?: number;
      }>
    >("plugin.approval.list");
    return result ?? [];
  }

  async resolveApproval(
    id: string,
    decision: "allow-once" | "allow-always" | "deny",
    options?: { kind?: "exec" | "plugin"; reason?: string }
  ): Promise<unknown> {
    const inferredKind =
      options?.kind ?? (id.startsWith("plugin:") ? "plugin" : "exec");
    const method =
      inferredKind === "plugin" ? "plugin.approval.resolve" : "exec.approval.resolve";
    return this.rpc(method, {
      id,
      decision,
      ...(options?.reason ? { reason: options.reason } : {}),
    });
  }

  // --- Discovery Methods ---

  async health(): Promise<GatewayHealth> {
    return this.rpc<GatewayHealth>("health");
  }

  async listModels(): Promise<unknown[]> {
    const result = await this.rpc<unknown[]>("models.list");
    return result ?? [];
  }

  async listTools(): Promise<unknown[]> {
    const result = await this.rpc<unknown[]>("tools.catalog");
    return result ?? [];
  }
}

let _defaultClient: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient {
  if (!_defaultClient) {
    const url =
      typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_GATEWAY_URL ?? "ws://localhost:18789")
        : "ws://localhost:18789";
    const token =
      typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_GATEWAY_TOKEN ?? "")
        : "";
    _defaultClient = new GatewayClient({ url, token });
  }
  return _defaultClient;
}
