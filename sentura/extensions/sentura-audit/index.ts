import path from "node:path";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import { createRedactor } from "./src/redaction.js";
import { AuditStore } from "./src/store.js";
import { createAuditQueryTool } from "./src/tool.js";
import type { AuditConfig, AuditEntry, AuditEventType, AuditSeverity } from "./src/types.js";

let entryCounter = 0;

function generateId(): string {
  return `aud_${Date.now()}_${++entryCounter}`;
}

function resolveConfig(pluginConfig: Record<string, unknown>): AuditConfig {
  const raw = pluginConfig as Partial<AuditConfig>;
  return {
    logDir: raw.logDir ?? path.join(resolveOpenClawDir(), "sentura-audit"),
    retention: {
      maxAgeDays: raw.retention?.maxAgeDays ?? 90,
      maxSizeMb: raw.retention?.maxSizeMb ?? 500,
    },
    redaction: {
      enabled: raw.redaction?.enabled ?? true,
      patterns: raw.redaction?.patterns ?? [],
    },
    verbose: raw.verbose ?? false,
  };
}

function classifySeverity(eventType: AuditEventType, details: Record<string, unknown>): AuditSeverity {
  switch (eventType) {
    case "approval_requested":
    case "approval_resolved":
      return "warning";
    case "config_change":
      return "warning";
    case "gateway_stop":
      return "warning";
    default:
      if (details.error || details.success === false) return "warning";
      return "info";
  }
}

export default definePluginEntry({
  id: "sentura-audit",
  name: "Sentura Audit",
  description: "Enterprise audit logging — captures tool calls, approvals, config changes, session events, and message activity.",
  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig ?? {});
    const store = new AuditStore({ logDir: config.logDir, retention: config.retention });
    const redact = config.redaction.enabled ? createRedactor(config.redaction.patterns) : (v: unknown) => v;

    async function emit(
      eventType: AuditEventType,
      details: Record<string, unknown>,
      agentId?: string,
      sessionKey?: string,
    ): Promise<void> {
      const entry: AuditEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        eventType,
        severity: classifySeverity(eventType, details),
        agentId,
        sessionKey,
        details: redact(details) as Record<string, unknown>,
      };

      try {
        await store.append(entry);
      } catch (err) {
        api.logger.error("[sentura-audit] Failed to write audit entry:", err);
      }
    }

    // --- Initialize store ---
    store.initialize().catch((err) => {
      api.logger.error("[sentura-audit] Failed to initialize audit store:", err);
    });

    // --- Register audit query tool ---
    api.registerTool(createAuditQueryTool(store) as Parameters<typeof api.registerTool>[0], {
      name: "sentura_audit_query",
    });

    // --- Register gateway RPC method for dashboard queries ---
    api.registerGatewayMethod({
      method: "sentura.audit.query",
      handler: async (params) => {
        const entries = await store.query(params as Record<string, unknown>);
        return { entries, count: entries.length };
      },
    });

    api.registerGatewayMethod({
      method: "sentura.audit.stats",
      handler: async () => {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recent = await store.query({ startTime: last24h, limit: 10000 });

        const byType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        const byAgent: Record<string, number> = {};

        for (const entry of recent) {
          byType[entry.eventType] = (byType[entry.eventType] ?? 0) + 1;
          bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
          if (entry.agentId) {
            byAgent[entry.agentId] = (byAgent[entry.agentId] ?? 0) + 1;
          }
        }

        return { period: "24h", total: recent.length, byType, bySeverity, byAgent };
      },
    });

    // --- Hook: before_tool_call ---
    api.on("before_tool_call", async (hookCtx) => {
      const details: Record<string, unknown> = {
        toolName: hookCtx.toolName,
      };
      if (config.verbose && hookCtx.args) {
        details.args = hookCtx.args;
      }
      await emit("tool_call", details, hookCtx.agentId, hookCtx.sessionKey);
      return {};
    });

    // --- Hook: after_tool_call ---
    api.on("after_tool_call", async (hookCtx) => {
      const details: Record<string, unknown> = {
        toolName: hookCtx.toolName,
        success: !hookCtx.error,
        durationMs: hookCtx.durationMs,
      };
      if (hookCtx.error) {
        details.error = String(hookCtx.error);
      }
      if (config.verbose && hookCtx.result) {
        details.result = hookCtx.result;
      }
      await emit("tool_result", details, hookCtx.agentId, hookCtx.sessionKey);
      return {};
    });

    // --- Hook: session_start ---
    api.on("session_start", async (hookCtx) => {
      await emit("session_start", {
        channel: hookCtx.channel,
        mode: hookCtx.mode,
      }, hookCtx.agentId, hookCtx.sessionKey);
      return {};
    });

    // --- Hook: session_end ---
    api.on("session_end", async (hookCtx) => {
      await emit("session_end", {
        reason: hookCtx.reason,
      }, hookCtx.agentId, hookCtx.sessionKey);
      return {};
    });

    // --- Hook: message_received ---
    api.on("message_received", async (hookCtx) => {
      const details: Record<string, unknown> = {
        channel: hookCtx.channel,
        messageLength: hookCtx.text?.length ?? 0,
      };
      await emit("message_received", details, hookCtx.agentId, hookCtx.sessionKey);
      return {};
    });

    // --- Hook: message_sent ---
    api.on("message_sent", async (hookCtx) => {
      const details: Record<string, unknown> = {
        channel: hookCtx.channel,
        messageLength: hookCtx.text?.length ?? 0,
      };
      await emit("message_sent", details, hookCtx.agentId, hookCtx.sessionKey);
      return {};
    });

    // --- Hook: agent_end ---
    api.on("agent_end", async (hookCtx) => {
      await emit("agent_end", {
        reason: hookCtx.reason,
        totalTokens: hookCtx.totalTokens,
        totalCost: hookCtx.totalCost,
      }, hookCtx.agentId, hookCtx.sessionKey);
      return {};
    });

    // --- Hook: gateway_start ---
    api.on("gateway_start", async () => {
      await emit("gateway_start", { startedAt: new Date().toISOString() });
      return {};
    });

    // --- Hook: gateway_stop ---
    api.on("gateway_stop", async () => {
      await emit("gateway_stop", { stoppedAt: new Date().toISOString() });
      await store.close();
      return {};
    });

    api.logger.info("[sentura-audit] Extension registered. Logging to:", config.logDir);
  },
});
