import type { AuditStore } from "./store.js";
import type { AuditEventType, AuditSeverity, DataTier } from "./types.js";

export function createAuditQueryTool(store: AuditStore) {
  return {
    name: "sentura_audit_query",
    description:
      "Query the Sentura audit log. Returns recent audit entries filtered by event type, agent, severity, tenant, department, user, group, data tier, time range, or free-text search. Use for compliance review, debugging agent behavior, and security investigations.",
    parameters: {
      type: "object" as const,
      properties: {
        eventType: {
          type: "string",
          enum: [
            "tool_call",
            "tool_result",
            "approval_requested",
            "approval_resolved",
            "config_change",
            "session_start",
            "session_end",
            "message_received",
            "message_sent",
            "gateway_start",
            "gateway_stop",
            "agent_end",
            "chat_message",
            "chat_group_created",
            "chat_group_updated",
            "chat_group_archived",
            "chat_group_fanout",
            "mcp_health_check",
            "mcp_health_change",
          ],
          description: "Filter by event type",
        },
        agentId: { type: "string", description: "Filter by agent ID" },
        severity: {
          type: "string",
          enum: ["info", "warning", "critical"],
          description: "Filter by severity level",
        },
        startTime: { type: "string", description: "ISO 8601 start time for time range filter" },
        endTime: { type: "string", description: "ISO 8601 end time for time range filter" },
        limit: { type: "number", description: "Maximum entries to return (default: 50)" },
        tenantId: { type: "string", description: "Filter to a single tenant (multi-tenancy)" },
        departmentId: { type: "string", description: "Filter to a single department" },
        userId: { type: "string", description: "Filter to a single user" },
        groupId: { type: "string", description: "Filter to a single Communication Panel group" },
        dataTier: {
          type: "string",
          enum: ["T0", "T1", "T2", "T3", "T4"],
          description: "Filter by data classification tier (T0=public … T4=secret)",
        },
        search: {
          type: "string",
          description: "Free-text contains-match against details and metadata (case-insensitive)",
        },
      },
    },
    async execute(args: {
      eventType?: AuditEventType;
      agentId?: string;
      severity?: AuditSeverity;
      startTime?: string;
      endTime?: string;
      limit?: number;
      tenantId?: string;
      departmentId?: string;
      userId?: string;
      groupId?: string;
      dataTier?: DataTier;
      search?: string;
    }) {
      const entries = await store.query({
        eventType: args.eventType,
        agentId: args.agentId,
        severity: args.severity,
        startTime: args.startTime,
        endTime: args.endTime,
        limit: args.limit ?? 50,
        tenantId: args.tenantId,
        departmentId: args.departmentId,
        userId: args.userId,
        groupId: args.groupId,
        dataTier: args.dataTier,
        search: args.search,
      });

      if (entries.length === 0) {
        return { content: "No audit entries found matching the query." };
      }

      const summary = entries.map((e) => ({
        id: e.id,
        time: e.timestamp,
        type: e.eventType,
        severity: e.severity,
        agent: e.agentId ?? "system",
        summary: summarizeDetails(e.eventType, e.details),
      }));

      return {
        content: JSON.stringify(summary, null, 2),
      };
    },
  };
}

function summarizeDetails(eventType: AuditEventType, details: Record<string, unknown>): string {
  switch (eventType) {
    case "tool_call":
      return `Tool: ${details.toolName ?? "unknown"}`;
    case "tool_result":
      return `Tool: ${details.toolName ?? "unknown"}, success: ${details.success ?? "unknown"}`;
    case "approval_requested":
      return `Action: ${details.action ?? "unknown"}, risk: ${details.riskLevel ?? "unknown"}`;
    case "approval_resolved":
      return `Decision: ${details.decision ?? "unknown"}`;
    case "config_change":
      return `Path: ${details.path ?? "unknown"}`;
    case "message_received":
    case "message_sent":
      return `Channel: ${details.channel ?? "unknown"}`;
    case "chat_message":
      return `Direction: ${details.direction ?? "unknown"}, len: ${details.messageLength ?? 0}`;
    case "chat_group_created":
    case "chat_group_updated":
    case "chat_group_archived":
      return `Group: ${details.name ?? "unknown"}, participants: ${
        Array.isArray(details.participants) ? (details.participants as unknown[]).length : 0
      }`;
    case "chat_group_fanout":
      return `Fanout to ${
        Array.isArray(details.fanoutTo) ? (details.fanoutTo as unknown[]).length : 0
      } recipients`;
    case "mcp_health_check":
    case "mcp_health_change":
      return `Status: ${details.status ?? "unknown"}, latency: ${details.latencyMs ?? "?"}ms`;
    default:
      return Object.keys(details).slice(0, 3).join(", ");
  }
}
