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
  stopReason?: string;
  errorMessage?: string;
  [key: string]: unknown;
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

// Person A's sentura-cost extension RPCs (Week 4).
// Source of truth: sentura/extensions/sentura-cost/src/types.ts.
// Mirrored here so dashboard pages can be typed without depending on
// the extension's internal types (which would require a cross-package
// import path that breaks when the dashboard ships standalone).

export interface CostQuerySummaryParams {
  startTime?: string;
  endTime?: string;
}

export interface CostQueryEventsParams {
  agentId?: string;
  tenantId?: string;
  departmentId?: string;
  userToken?: string;
  model?: string;
  provider?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export type CostEventKind = "model" | "external_api" | "local_tool";

export type CostPricingStatus =
  | "priced"
  | "estimated"
  | "free"
  | "included"
  | "unpriced";

export interface ExternalUsageUnit {
  unit: "request" | "credit" | "page" | "local_call";
  quantity: number;
  label?: string;
}

export interface CostEvent {
  id: string;
  timestamp: string;
  agentId: string;
  sessionKey: string;
  userToken: string;
  tenantId: string;
  departmentId: string | null;
  provider: string;
  model: string;
  kind?: CostEventKind;
  service?: string;
  operation?: string;
  pricingStatus?: CostPricingStatus;
  pricingNote?: string;
  externalUsage?: ExternalUsageUnit;
  httpStatus?: number;
  toolName?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens: number;
  };
  costUsd: number | null;
  durationMs: number;
  source?: "diagnostic" | "session_log" | "external_tool_log";
  messageId?: string;
}

export interface CostEventsResponse {
  events: CostEvent[];
  count: number;
}

export interface CostAggregateBucket {
  key: string;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  /** Number of events whose costUsd was null (provider didn't price the call). */
  unpricedCalls: number;
}

export interface CostSummary {
  period: { start: string; end: string };
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  unpricedCalls: number;
  byAgent: CostAggregateBucket[];
  byDepartment: CostAggregateBucket[];
  byTenant: CostAggregateBucket[];
  byModel: CostAggregateBucket[];
}

// Person D's sentura-audit extension RPCs (Week 4).
// Source of truth: sentura/extensions/sentura-audit/src/types.ts.
// Same mirror-not-import pattern as the cost types above.

export type AuditEventType =
  | "tool_call"
  | "tool_result"
  | "approval_requested"
  | "approval_resolved"
  | "config_change"
  | "session_start"
  | "session_end"
  | "message_received"
  | "message_sent"
  | "gateway_start"
  | "gateway_stop"
  | "agent_end"
  | "chat_message"
  | "chat_group_created"
  | "chat_group_updated"
  | "chat_group_archived"
  | "chat_group_fanout"
  | "mcp_health_check"
  | "mcp_health_change";

export type AuditSeverity = "info" | "warning" | "critical";

/** T0–T4 data classification tiers (per CLAUDE.md rule 20). */
export type DataTier = "T0" | "T1" | "T2" | "T3" | "T4";

export interface AuditMetadata {
  channel?: string;
  userId?: string;
  userToken?: string;
  tenantId?: string;
  departmentId?: string;
  groupId?: string;
  mcpServer?: string;
  argumentsDigest?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  dataTier: DataTier;
  agentId?: string;
  sessionKey?: string;
  details: Record<string, unknown>;
  metadata?: AuditMetadata;
}

export interface AuditQueryParams {
  eventType?: AuditEventType;
  agentId?: string;
  severity?: AuditSeverity;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
  tenantId?: string;
  departmentId?: string;
  userId?: string;
  groupId?: string;
  dataTier?: DataTier;
  /** Free-text contains-match against `details` JSON (case-insensitive). */
  search?: string;
}

export interface AuditStats {
  windowHours: number;
  totalEvents: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byAgent: Record<string, number>;
  byTier: Record<string, number>;
  byTenant: Record<string, number>;
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
  /**
   * Optional WebSocket factory. Browser callers should leave this unset
   * (default: `new WebSocket(url)`). Server-side callers (Next.js Route
   * Handlers, etc.) can inject a factory that sets headers like `Origin`
   * — Node 22+'s native WebSocket constructor accepts a second-argument
   * options object (`{ headers: { Origin: '...' } }`) the browser does not.
   */
  wsFactory?: (url: string) => WebSocket;
}
