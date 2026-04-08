import type { AuditStore } from "./store.js";
import type { AuditEventType, AuditSeverity } from "./types.js";

export function createAuditQueryTool(store: AuditStore) {
  return {
    name: "sentura_audit_query",
    description:
      "Query the Sentura audit log. Returns recent audit entries filtered by event type, agent, severity, or time range. Use for compliance review, debugging agent behavior, and security investigations.",
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
          ],
          description: "Filter by event type",
        },
        agentId: {
          type: "string",
          description: "Filter by agent ID",
        },
        severity: {
          type: "string",
          enum: ["info", "warning", "critical"],
          description: "Filter by severity level",
        },
        startTime: {
          type: "string",
          description: "ISO 8601 start time for time range filter",
        },
        endTime: {
          type: "string",
          description: "ISO 8601 end time for time range filter",
        },
        limit: {
          type: "number",
          description: "Maximum number of entries to return (default: 50)",
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
    }) {
      const entries = await store.query({
        eventType: args.eventType,
        agentId: args.agentId,
        severity: args.severity,
        startTime: args.startTime,
        endTime: args.endTime,
        limit: args.limit ?? 50,
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
    default:
      return Object.keys(details).slice(0, 3).join(", ");
  }
}
