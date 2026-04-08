export interface AgentConfig {
  id: string;
  name?: string;
  model: string;
  runtime?: { type: string };
  sandbox?: { mode: string };
  tools?: {
    profile?: string;
    alsoAllow?: string[];
    deny?: string[];
  };
  memorySearch?: { enabled: boolean };
}

export interface BindingConfig {
  agentId: string;
  match?: {
    channel?: string;
    accountId?: string;
    peer?: { kind: string; id: string };
  };
}

export interface SessionSummary {
  key: string;
  agentId?: string;
  channel?: string;
  peer?: string;
  messageCount?: number;
  lastActive?: string;
  status?: "active" | "idle" | "archived";
}

export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface TranscriptMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | ContentBlock[] | ContentBlock | unknown;
  timestamp?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  action: string;
  context?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface GatewayHealth {
  status: string;
  uptime?: number;
  version?: string;
}

// OpenClaw Gateway Protocol frames (NOT JSON-RPC 2.0)
// See: openclaw/src/gateway/protocol/schema/frames.ts

export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayErrorShape;
}

export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
}

export interface GatewayErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

export interface RpcError {
  code: string;
  message: string;
  details?: unknown;
}

/** ConnectParams as required by the gateway's connect handshake. */
export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName?: string;
    version: string;
    platform: string;
    deviceFamily?: string;
    mode: string;
    instanceId?: string;
  };
  caps?: string[];
  role?: string;
  scopes?: string[];
  auth?: {
    token?: string;
    password?: string;
  };
}

export interface HelloOk {
  type: "hello-ok";
  protocol: number;
  server: {
    version: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: unknown;
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}

export type GatewayEventType =
  | "session.message"
  | "session.tool"
  | "sessions.changed"
  | "presence"
  | "tick"
  | "cron"
  | "config.changed"
  | "health"
  | "exec.approval.requested"
  | "exec.approval.resolved"
  | "plugin.approval.requested"
  | "plugin.approval.resolved"
  | "connect.challenge";

export interface GatewayEvent {
  type: GatewayEventType | string;
  payload: Record<string, unknown>;
}

export interface GatewayClientOptions {
  url: string;
  token: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}
