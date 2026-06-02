import crypto from "node:crypto";
import path from "node:path";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import { createRedactor } from "./src/redaction.js";
import { AuditStore } from "./src/store.js";
import { createAuditQueryTool } from "./src/tool.js";
import type {
  AuditConfig,
  AuditEntry,
  AuditEventType,
  AuditMetadata,
  AuditSeverity,
  DataTier,
} from "./src/types.js";

export type { AuditEntry, AuditEventType, AuditMetadata, AuditSeverity, DataTier } from "./src/types.js";
export { AuditStore } from "./src/store.js";

/**
 * Module-scoped runtime handle for sibling extensions (e.g.
 * `sentura-mcp-health`) that need to append audit entries imperatively
 * without going through a gateway RPC. Mirrors the pattern in
 * `sentura-approval/index.ts` (`getApprovalRuntime`). The handle is set when
 * this extension's `register()` runs and cleared on `gateway_stop`. Sibling
 * extensions should always lazy-resolve through `getAuditRuntime()` since
 * extension load order is not guaranteed.
 */
export type AuditEmitter = (
  eventType: AuditEventType,
  details: Record<string, unknown>,
  agentId?: string,
  sessionKey?: string,
  metadata?: Partial<AuditMetadata>,
  dataTier?: DataTier,
) => Promise<void>;

export interface AuditRuntimeHandle {
  emit: AuditEmitter;
  append: (entry: AuditEntry) => Promise<void>;
}

let runtimeHandle: AuditRuntimeHandle | null = null;

export function getAuditRuntime(): AuditRuntimeHandle | null {
  return runtimeHandle;
}

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
    defaultDataTier: raw.defaultDataTier ?? "T1",
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
    case "mcp_health_change":
      return details.status === "down" ? "critical" : "warning";
    default:
      if (details.error || details.success === false) return "warning";
      return "info";
  }
}

/**
 * Map an event type + payload to a data-classification tier (T0–T4).
 *
 * Callers may pass an explicit `dataTier` that overrides this default.
 */
export function classifyDataTier(
  eventType: AuditEventType,
  details: Record<string, unknown>,
  defaultTier: DataTier,
): DataTier {
  switch (eventType) {
    case "tool_call":
    case "tool_result": {
      const name = String(details.toolName ?? "").toLowerCase();
      if (name.includes("secret") || name.includes("credential")) return "T4";
      if (name.includes("approval") || name.includes("provision")) return "T3";
      return "T2";
    }
    case "approval_requested":
    case "approval_resolved":
    case "config_change":
      return "T3";
    case "message_received":
    case "message_sent":
    case "chat_message":
    case "chat_group_fanout":
      return "T2";
    case "chat_group_created":
    case "chat_group_updated":
    case "chat_group_archived":
      return "T1";
    case "session_start":
    case "session_end":
    case "gateway_start":
    case "gateway_stop":
    case "agent_end":
    case "mcp_health_check":
    case "mcp_health_change":
      return "T1";
    default:
      return defaultTier;
  }
}

/**
 * Sentura embeds the user token inside the session key as
 * `<channel>:<agentId>:<userToken>` (per Person A's Week-2 multi-tenancy
 * design). We extract it so audit entries are queryable by user without the
 * caller having to pass a separate field.
 */
function extractUserTokenFromSessionKey(sessionKey?: string): string | undefined {
  if (!sessionKey) return undefined;
  const parts = sessionKey.split(":");
  if (parts.length < 3) return undefined;
  const last = parts[parts.length - 1];
  if (!last || last.length < 8) return undefined;
  return last;
}

function sha8(input: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(input ?? "")).digest("hex").slice(0, 8);
}

function pickMetadata(input: Partial<AuditMetadata>): AuditMetadata | undefined {
  const out: AuditMetadata = {};
  if (input.channel) out.channel = input.channel;
  if (input.userId) out.userId = input.userId;
  if (input.userToken) out.userToken = input.userToken;
  if (input.tenantId) out.tenantId = input.tenantId;
  if (input.departmentId) out.departmentId = input.departmentId;
  if (input.groupId) out.groupId = input.groupId;
  if (input.mcpServer) out.mcpServer = input.mcpServer;
  if (input.argumentsDigest) out.argumentsDigest = input.argumentsDigest;
  return Object.keys(out).length === 0 ? undefined : out;
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
      explicitMetadata?: Partial<AuditMetadata>,
      explicitTier?: DataTier,
    ): Promise<void> {
      const userToken = explicitMetadata?.userToken ?? extractUserTokenFromSessionKey(sessionKey);
      const metadata = pickMetadata({ ...(explicitMetadata ?? {}), userToken });
      const tier = explicitTier ?? classifyDataTier(eventType, details, config.defaultDataTier);

      const entry: AuditEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        eventType,
        severity: classifySeverity(eventType, details),
        dataTier: tier,
        agentId,
        sessionKey,
        details: redact(details) as Record<string, unknown>,
        metadata,
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

    // --- Expose imperative handle for sibling extensions ---
    runtimeHandle = {
      emit,
      append: (entry) => store.append(entry),
    };

    // --- Register audit query tool ---
    api.registerTool(createAuditQueryTool(store) as Parameters<typeof api.registerTool>[0], {
      name: "sentura_audit_query",
    });

    // --- Register gateway RPC method for dashboard queries ---
    api.registerGatewayMethod("sentura.audit.query", async ({ params, respond }) => {
      try {
        const entries = await store.query(params as Record<string, unknown>);
        respond(true, { entries, count: entries.length });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.audit.stats", async ({ respond }) => {
      try {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recent = await store.query({ startTime: last24h, limit: 10000 });

        const byType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        const byAgent: Record<string, number> = {};
        const byTier: Record<string, number> = {};
        const byTenant: Record<string, number> = {};

        for (const entry of recent) {
          byType[entry.eventType] = (byType[entry.eventType] ?? 0) + 1;
          bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
          // Pre-Week-4 entries lack `dataTier`; bucket them under "unknown"
          // rather than letting `undefined` coerce to the literal "undefined" key.
          const tier = entry.dataTier ?? "unknown";
          byTier[tier] = (byTier[tier] ?? 0) + 1;
          if (entry.agentId) {
            byAgent[entry.agentId] = (byAgent[entry.agentId] ?? 0) + 1;
          }
          const tenantId = entry.metadata?.tenantId;
          if (tenantId) byTenant[tenantId] = (byTenant[tenantId] ?? 0) + 1;
        }

        respond(true, {
          period: "24h",
          total: recent.length,
          byType,
          bySeverity,
          byAgent,
          byTier,
          byTenant,
        });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // -----------------------------------------------------------------
    // Communication Panel audit RPCs (capability #16 — Person C dashboard
    // calls these on chat send/receive and group lifecycle events). Kept
    // distinct from the channel `message_received`/`message_sent` hooks so
    // the dashboard can attribute messages to a `groupId` even when the
    // conversation spans multiple agent sessions.
    // -----------------------------------------------------------------
    api.registerGatewayMethod("sentura.audit.chat.log", async ({ params, respond }) => {
      try {
        const p = (params ?? {}) as {
          direction?: "human_to_agent" | "agent_to_human";
          agentId?: string;
          sessionKey?: string;
          groupId?: string;
          tenantId?: string;
          departmentId?: string;
          userId?: string;
          userToken?: string;
          channel?: string;
          messageLength?: number;
          messageDigest?: string;
          dataTier?: DataTier;
        };
        if (!p.direction || (p.direction !== "human_to_agent" && p.direction !== "agent_to_human")) {
          respond(false, undefined, {
            code: "BAD_REQUEST",
            message: "direction must be 'human_to_agent' or 'agent_to_human'",
          });
          return;
        }
        await emit(
          "chat_message",
          {
            direction: p.direction,
            messageLength: p.messageLength ?? 0,
            messageDigest: p.messageDigest,
          },
          p.agentId,
          p.sessionKey,
          {
            channel: p.channel ?? "dashboard",
            groupId: p.groupId,
            tenantId: p.tenantId,
            departmentId: p.departmentId,
            userId: p.userId,
            userToken: p.userToken,
          },
          p.dataTier,
        );
        respond(true, { logged: true });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.audit.group.log", async ({ params, respond }) => {
      try {
        const p = (params ?? {}) as {
          event?: "created" | "updated" | "archived" | "fanout";
          groupId?: string;
          tenantId?: string;
          departmentId?: string;
          actorUserId?: string;
          actorUserToken?: string;
          participants?: string[];
          name?: string;
          fanoutTo?: string[];
          messageDigest?: string;
        };
        if (!p.event || !p.groupId) {
          respond(false, undefined, {
            code: "BAD_REQUEST",
            message: "event and groupId are required",
          });
          return;
        }
        const eventTypeMap: Record<string, AuditEventType> = {
          created: "chat_group_created",
          updated: "chat_group_updated",
          archived: "chat_group_archived",
          fanout: "chat_group_fanout",
        };
        const eventType = eventTypeMap[p.event];
        if (!eventType) {
          respond(false, undefined, {
            code: "BAD_REQUEST",
            message: `unknown group event '${p.event}'`,
          });
          return;
        }
        await emit(
          eventType,
          {
            name: p.name,
            participants: p.participants,
            fanoutTo: p.fanoutTo,
            messageDigest: p.messageDigest,
            actorUserId: p.actorUserId,
          },
          undefined,
          undefined,
          {
            channel: "dashboard",
            groupId: p.groupId,
            tenantId: p.tenantId,
            departmentId: p.departmentId,
            userId: p.actorUserId,
            userToken: p.actorUserToken,
          },
        );
        respond(true, { logged: true });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // -----------------------------------------------------------------
    // MCP server health event ingest — sentura-mcp-health calls this every
    // time a health-check transitions a server into a new status. Audit
    // captures both the heartbeat tick (`mcp_health_check`) and the change
    // (`mcp_health_change`) so dashboards can render uptime trendlines.
    // -----------------------------------------------------------------
    api.registerGatewayMethod("sentura.audit.mcp.health", async ({ params, respond }) => {
      try {
        const p = (params ?? {}) as {
          server?: string;
          status?: "up" | "down" | "degraded";
          previousStatus?: string;
          latencyMs?: number;
          errorCount?: number;
          lastError?: string;
          isChange?: boolean;
        };
        if (!p.server || !p.status) {
          respond(false, undefined, {
            code: "BAD_REQUEST",
            message: "server and status are required",
          });
          return;
        }
        const eventType: AuditEventType = p.isChange ? "mcp_health_change" : "mcp_health_check";
        await emit(
          eventType,
          {
            status: p.status,
            previousStatus: p.previousStatus,
            latencyMs: p.latencyMs,
            errorCount: p.errorCount,
            lastError: p.lastError,
          },
          undefined,
          undefined,
          { mcpServer: p.server },
        );
        respond(true, { logged: true });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // --- Hook: before_tool_call ---
    api.on("before_tool_call", async (hookCtx) => {
      const details: Record<string, unknown> = { toolName: hookCtx.toolName };
      const argumentsDigest = hookCtx.args ? sha8(hookCtx.args) : undefined;
      if (config.verbose && hookCtx.args) details.args = hookCtx.args;
      // argumentsDigest lives in metadata only — no duplication in details.
      await emit("tool_call", details, hookCtx.agentId, hookCtx.sessionKey, { argumentsDigest });
      return {};
    });

    // --- Hook: after_tool_call ---
    api.on("after_tool_call", async (hookCtx) => {
      const details: Record<string, unknown> = {
        toolName: hookCtx.toolName,
        success: !hookCtx.error,
        durationMs: hookCtx.durationMs,
      };
      if (hookCtx.error) details.error = String(hookCtx.error);
      if (config.verbose && hookCtx.result) details.result = hookCtx.result;
      const argumentsDigest = hookCtx.args ? sha8(hookCtx.args) : undefined;
      await emit("tool_result", details, hookCtx.agentId, hookCtx.sessionKey, { argumentsDigest });
      return {};
    });

    // --- Hook: session_start ---
    api.on("session_start", async (hookCtx) => {
      await emit(
        "session_start",
        { channel: hookCtx.channel, mode: hookCtx.mode },
        hookCtx.agentId,
        hookCtx.sessionKey,
        { channel: hookCtx.channel as string | undefined },
      );
      return {};
    });

    // --- Hook: session_end ---
    api.on("session_end", async (hookCtx) => {
      await emit("session_end", { reason: hookCtx.reason }, hookCtx.agentId, hookCtx.sessionKey);
      return {};
    });

    // --- Hook: message_received ---
    api.on("message_received", async (hookCtx) => {
      await emit(
        "message_received",
        { channel: hookCtx.channel, messageLength: hookCtx.text?.length ?? 0 },
        hookCtx.agentId,
        hookCtx.sessionKey,
        { channel: hookCtx.channel as string | undefined },
      );
      return {};
    });

    // --- Hook: message_sent ---
    api.on("message_sent", async (hookCtx) => {
      await emit(
        "message_sent",
        { channel: hookCtx.channel, messageLength: hookCtx.text?.length ?? 0 },
        hookCtx.agentId,
        hookCtx.sessionKey,
        { channel: hookCtx.channel as string | undefined },
      );
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
      runtimeHandle = null;
      return {};
    });

    api.logger.info("[sentura-audit] Extension registered. Logging to:", config.logDir);
  },
});
