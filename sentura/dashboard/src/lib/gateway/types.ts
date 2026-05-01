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
  /** Human-readable label assigned via sessions.create / sessions.patch. */
  label?: string;
  /** Optional derived/display fields emitted by `sessions.list`. */
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  /** Gateway emits this as epoch-ms. */
  updatedAt?: number | null;
  kind?: "direct" | "group" | "global" | "unknown";
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
  /** Raw request payload from the gateway (command/reason/title/etc). */
  context?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  /**
   * Source of the approval. Drives which resolve RPC the dashboard calls:
   * - `exec`/`plugin`: OpenClaw native approvals (`*.approval.resolve`).
   * - `sentura`: Sentura context-aware approvals from the `sentura-approval`
   *   extension (`sentura.approval.requests.decide`).
   */
  kind?: "exec" | "plugin" | "sentura";
  /** Optional expiration (epoch ms). */
  expiresAtMs?: number;
  /** Sentura-only: risk level surfaced for prioritisation. */
  riskLevel?: "low" | "medium" | "high" | "critical";
  /** Sentura-only: policy id that produced the require_human verdict. */
  policyId?: string;
}

/**
 * Raw shape returned by the `sentura.approval.requests.list` RPC — mirrors
 * `sentura/extensions/sentura-approval/src/types.ts` ApprovalRequest. The
 * dashboard normalises this into the flat ApprovalRequest in the hook layer.
 */
export interface SenturaApprovalRequestRaw {
  id: string;
  agentId: string;
  sessionKey?: string;
  action: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  context: Record<string, unknown>;
  requestedAt: string;
  policyId?: string;
  status:
    | "pending"
    | "approved"
    | "denied"
    | "auto_approved"
    | "auto_denied"
    | "expired";
  expiresAt?: string;
  onTimeoutDecision?: "approve" | "deny";
  decisionReason?: string;
  decidedAt?: string;
  decidedByUserId?: string;
  escalation?: {
    chain: string[];
    currentIndex: number;
  };
}

/** Workspace file metadata returned by agents.files.list. */
export interface AgentFileEntry {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
}

/** Workspace file payload returned by agents.files.get. */
export interface AgentFileContent extends AgentFileEntry {
  content: string;
}

/** Result of sessions.create — the canonical session key for subsequent chat.send calls. */
export interface SessionCreateResult {
  ok: boolean;
  key: string;
  sessionId?: string;
  entry?: SessionSummary;
  runStarted?: boolean;
  runError?: string;
  messageSeq?: number;
}

/** Streaming chat event payload (event: "chat"). */
export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq?: number;
  state: "delta" | "final";
  stopReason?: string;
  message?: {
    role: "user" | "assistant" | "system" | "tool";
    content: string | ContentBlock[];
    timestamp?: number;
  };
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
  | "chat"
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
