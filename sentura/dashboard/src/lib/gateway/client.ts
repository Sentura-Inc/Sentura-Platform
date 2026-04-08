import type {
  AgentConfig,
  ApprovalRequest,
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
  SessionSummary,
  TranscriptMessage,
} from "./types";

type EventHandler = (event: GatewayEvent) => void;
type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

const PROTOCOL_VERSION = 3;
const SENTURA_VERSION = "0.1.0";
const REQUEST_TIMEOUT_MS = 30_000;

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
      scopes: ["operator.read", "operator.write", "operator.admin"],
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
    return this.rpc<Record<string, unknown>>("config.get");
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
    const agents = await this.getAgents();
    return agents.find((a) => a.id === agentId);
  }

  // --- Session Methods ---

  async listSessions(): Promise<SessionSummary[]> {
    const result = await this.rpc<SessionSummary[] | { sessions: SessionSummary[] }>(
      "sessions.list"
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

  async deleteSession(sessionKey: string): Promise<void> {
    await this.rpc("sessions.delete", { sessionKey });
  }

  // --- Chat Methods ---

  async sendChat(
    message: string,
    sessionKey: string
  ): Promise<unknown> {
    return this.rpc("chat.send", { message, sessionKey });
  }

  async getChatHistory(
    sessionKey: string,
    limit?: number
  ): Promise<TranscriptMessage[]> {
    return this.getTranscript(sessionKey, limit);
  }

  // --- Approval Methods ---
  // OpenClaw approvals are event-driven: the gateway broadcasts
  // `exec.approval.requested` and `plugin.approval.requested` events
  // when agents request approval. There is no "list pending" RPC method.
  // The dashboard accumulates pending approvals by listening to these events.

  async getApproval(id: string): Promise<unknown> {
    return this.rpc("exec.approval.get", { id });
  }

  async resolveApproval(
    id: string,
    decision: "allow-once" | "allow-always" | "deny"
  ): Promise<unknown> {
    const isPlugin = id.startsWith("plugin:");
    const method = isPlugin ? "plugin.approval.resolve" : "exec.approval.resolve";
    return this.rpc(method, { id, decision });
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
