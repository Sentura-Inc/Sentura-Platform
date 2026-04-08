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
  | "agent_end";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  agentId?: string;
  sessionKey?: string;
  details: Record<string, unknown>;
  metadata?: {
    channel?: string;
    userId?: string;
    tenantId?: string;
    departmentId?: string;
  };
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
}

export interface AuditQueryParams {
  eventType?: AuditEventType;
  agentId?: string;
  severity?: AuditSeverity;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}
