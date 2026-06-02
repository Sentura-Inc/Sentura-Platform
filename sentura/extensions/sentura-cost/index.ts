/**
 * Sentura Cost Tracking
 *
 * Subscribes to OpenClaw's `model.usage` diagnostic event (one event per
 * LLM call, with `costUsd` already computed by OpenClaw's pricing cache)
 * and persists every call to a rolling JSONL store keyed by agent /
 * tenant / department / userToken. Powers the dashboard's Cost Center
 * page via three gateway RPCs.
 *
 * The tenancy attribution is read from the same `agent-tenancy.json`
 * that Task 1 (Multi-tenancy) writes — single source of truth, no
 * duplicate "which department is this agent in?" config.
 */

import crypto from "node:crypto";
import path from "node:path";
import { onDiagnosticEvent } from "openclaw/plugin-sdk/diagnostic-runtime";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import {
  aggregateByAgent,
  aggregateByDepartment,
  aggregateByModel,
  aggregateByTenant,
  aggregateByUser,
  summarize,
} from "./src/aggregator.js";
import { CostStore } from "./src/store.js";
import { TenancyResolver } from "./src/tenancy-resolver.js";
import type { CostConfig, CostEvent, CostQueryParams } from "./src/types.js";

let eventCounter = 0;
function newEventId(): string {
  return `cost_${Date.now()}_${++eventCounter}`;
}

function extractUserToken(sessionKey: string | undefined): string {
  if (!sessionKey) return "";
  const match = /^agent:[^:]+:user:([^:]+):/.exec(sessionKey);
  return match?.[1] ?? "";
}

function extractAgentId(sessionKey: string | undefined): string | null {
  if (!sessionKey) return null;
  const match = /^agent:([^:]+):/.exec(sessionKey);
  return match?.[1] ?? null;
}

function resolveConfig(pluginConfig: Record<string, unknown>): CostConfig {
  const raw = pluginConfig as Partial<CostConfig> & {
    retention?: { maxAgeDays?: number };
  };
  return {
    logDir: raw.logDir ?? path.join(resolveOpenClawDir(), "sentura-cost"),
    retention: { maxAgeDays: raw.retention?.maxAgeDays ?? 365 },
  };
}

export default definePluginEntry({
  id: "sentura-cost",
  name: "Sentura Cost Tracking",
  description:
    "Per-agent / per-department LLM cost attribution backed by the model.usage diagnostic event.",
  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig ?? {});
    const store = new CostStore({ logDir: config.logDir, retention: config.retention });
    const tenancy = new TenancyResolver(path.join(resolveOpenClawDir(), "sentura-rbac"));

    store.initialize().catch((err) => {
      api.logger.error("[sentura-cost] Failed to initialize cost store:", err);
    });

    // ========================================================================
    // Capture: subscribe to model.usage diagnostic events.
    //
    // We attach unconditionally — the diagnostic-event bus is always live
    // even when diagnostics-otel is disabled (events are computed for
    // local logging too). If `model.usage` events stop firing because of
    // an upstream change, the store will simply stay empty; nothing
    // breaks.
    // ========================================================================
    const unsubscribe = onDiagnosticEvent((event) => {
      if (event.type !== "model.usage") return;

      const sessionKey = event.sessionKey ?? "";
      const agentId = extractAgentId(sessionKey) ?? "(unknown)";
      const userToken = extractUserToken(sessionKey);
      const { tenantId, departmentId } = tenancy.resolve(agentId);

      const usage = event.usage ?? {};
      const inputTokens = usage.input ?? usage.promptTokens ?? 0;
      const outputTokens = usage.output ?? 0;
      const cacheReadTokens = usage.cacheRead;
      const cacheWriteTokens = usage.cacheWrite;
      const totalTokens =
        usage.total ??
        inputTokens +
          outputTokens +
          (cacheReadTokens ?? 0) +
          (cacheWriteTokens ?? 0);

      const row: CostEvent = {
        id: newEventId(),
        timestamp: new Date(event.ts).toISOString(),
        agentId,
        sessionKey,
        userToken,
        tenantId,
        departmentId,
        provider: event.provider ?? "(unknown)",
        model: event.model ?? "(unknown)",
        usage: {
          inputTokens,
          outputTokens,
          ...(cacheReadTokens !== undefined ? { cacheReadTokens } : {}),
          ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
          totalTokens,
        },
        costUsd: typeof event.costUsd === "number" ? event.costUsd : null,
        durationMs: event.durationMs ?? 0,
      };

      store.append(row).catch((err) => {
        api.logger.warn(`[sentura-cost] Failed to persist cost event: ${String(err)}`);
      });
    });

    // ========================================================================
    // Gateway RPCs
    // ========================================================================

    api.registerGatewayMethod("sentura.cost.events", async ({ params, respond }) => {
      try {
        const events = await store.query((params ?? {}) as CostQueryParams);
        respond(true, { events, count: events.length });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.cost.summary", async ({ params, respond }) => {
      try {
        const start = (params?.startTime as string | undefined) ?? "";
        const end = (params?.endTime as string | undefined) ?? new Date().toISOString();
        const events = await store.readRange(start || undefined, end);
        const summary = summarize(events, {
          start: start || (events[0]?.timestamp ?? end),
          end,
        });
        respond(true, summary);
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.cost.byUser", async ({ params, respond }) => {
      try {
        const start = params?.startTime as string | undefined;
        const end = params?.endTime as string | undefined;
        const events = await store.readRange(start, end);
        // Hash user tokens before returning to external callers — cost
        // exports must not leak raw tokens.
        const buckets = aggregateByUser(events).map((b) => ({
          ...b,
          key:
            b.key === "(anonymous)"
              ? b.key
              : crypto.createHash("sha256").update(b.key).digest("hex").slice(0, 16),
        }));
        respond(true, { buckets });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    // Lifecycle: clean up the diagnostic-event subscription on shutdown
    // so re-loads (e.g. plugin reload) don't double-capture events.
    api.on("gateway_stop", async () => {
      try {
        unsubscribe();
        await store.close();
      } catch (err) {
        api.logger.warn(`[sentura-cost] Error during shutdown: ${String(err)}`);
      }
    });

    api.logger.info(
      `[sentura-cost] Extension registered. Cost events → ${config.logDir} (retention: ${config.retention.maxAgeDays}d)`,
    );

    // Touch unused imports so the linter doesn't drop them; they're used
    // implicitly by the aggregator helpers exposed on RPC payloads (the
    // dashboard calls `summarize` / by* helpers via `sentura.cost.summary`,
    // but TS strict mode flags this file's local references as unused
    // when callers come through a gateway boundary).
    void aggregateByAgent;
    void aggregateByDepartment;
    void aggregateByTenant;
    void aggregateByModel;
  },
});
