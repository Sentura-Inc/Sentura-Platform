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
  // Communication Panel (capability #16) — explicit event types so dashboard
  // chat traffic and group-chat lifecycle events are queryable as a unit.
  | "chat_message"
  | "chat_group_created"
  | "chat_group_updated"
  | "chat_group_archived"
  | "chat_group_fanout"
  // MCP server health monitoring (Week 4 Person D)
  | "mcp_health_check"
  | "mcp_health_change";

export type AuditSeverity = "info" | "warning" | "critical";

/**
 * T0–T4 data classification tiers (per CLAUDE.md rule 20).
 *
 *   T0 — public                      (marketing copy, public docs)
 *   T1 — internal non-sensitive      (general business knowledge)
 *   T2 — confidential                (employee config, EKG insights)
 *   T3 — restricted                  (PII, customer data, financial details)
 *   T4 — secret                      (API keys, credentials, auth tokens)
 *
 * External channels are restricted to T0/T1 traffic only — sensitive flows
 * stay on the dashboard. Audit consumers can filter by tier to satisfy
 * compliance reviews without scanning the full log.
 */
export const DATA_TIERS = ["T0", "T1", "T2", "T3", "T4"] as const;
export type DataTier = (typeof DATA_TIERS)[number];

export interface AuditMetadata {
  channel?: string;
  /** User identifier (Sentura `SenturaUser.id`). */
  userId?: string;
  /** Per-user memory/RBAC token. */
  userToken?: string;
  /** Tenant boundary — Sentura's multi-tenancy unit. */
  tenantId?: string;
  /** Department within a tenant — drives RBAC `department` scope. */
  departmentId?: string;
  /** Communication Panel group identifier (capability #16). */
  groupId?: string;
  /** Originating MCP server name (for `mcp_health_*` events). */
  mcpServer?: string;
  /** Tool argument digest for cross-event correlation (sha256/8 chars). */
  argumentsDigest?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  /** Default `T1` (internal-non-sensitive). High-risk events upgrade to T3/T4. */
  dataTier: DataTier;
  agentId?: string;
  sessionKey?: string;
  details: Record<string, unknown>;
  metadata?: AuditMetadata;
}

export interface AuditConfig {
  logDir: string;
  retention: {
    maxAgeDays: number;
    maxSizeMb: number;
  };
  redaction: {
    enabled: boolean;
    patterns: string[];
  };
  verbose: boolean;
  /** Default tier when an emit() call doesn't specify one. */
  defaultDataTier: DataTier;
}

export interface AuditQueryParams {
  eventType?: AuditEventType;
  agentId?: string;
  severity?: AuditSeverity;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
  // Multi-tenancy & data-tier filters (Week 4)
  tenantId?: string;
  departmentId?: string;
  userId?: string;
  groupId?: string;
  dataTier?: DataTier;
  /** Free-text contains-match against `details` JSON (case-insensitive). */
  search?: string;
}
