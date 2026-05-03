/**
 * Sentura Monitoring Extension
 *
 * Aggregates health signals from across the platform into four gateway
 * RPCs that the dashboard's `/cost` and `/overview` pages consume:
 *
 *   sentura.health.gateway    — process uptime, memory, started-at
 *   sentura.health.employees  — registered agents + per-agent recent activity
 *   sentura.health.providers  — provider availability based on recent
 *                               model.usage events (default 5min window)
 *   sentura.health.summary    — one-shot aggregate of the three above
 *
 * Activity tracking subscribes to the `model.usage` diagnostic event the
 * same way `sentura-cost` does — both extensions are independent
 * subscribers and don't need to coordinate.
 */

import fs from "node:fs";
import path from "node:path";
import { onDiagnosticEvent } from "openclaw/plugin-sdk/diagnostics-otel";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import {
  buildSummary,
  checkEmployees,
  checkGateway,
  checkProviders,
  type AgentActivity,
  type AgentRegistry,
  type AgentTenancyRecord,
  type ProviderActivity,
} from "./src/checks.js";

interface MonitoringConfig {
  providerWindowMinutes: number;
}

function resolveConfig(pluginConfig: Record<string, unknown>): MonitoringConfig {
  const raw = pluginConfig as Partial<MonitoringConfig>;
  return {
    providerWindowMinutes:
      typeof raw.providerWindowMinutes === "number" ? raw.providerWindowMinutes : 5,
  };
}

function loadAgentRegistry(): AgentRegistry[] {
  const cfgPath = path.join(resolveOpenClawDir(), "openclaw.json");
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8")) as {
      agents?: { list?: Array<{ id?: string }> };
    };
    return (cfg.agents?.list ?? [])
      .filter((a) => typeof a.id === "string")
      .map((a) => ({ agentId: a.id as string, registered: true }));
  } catch {
    return [];
  }
}

function loadAgentTenancy(): AgentTenancyRecord[] {
  const tenancyPath = path.join(
    resolveOpenClawDir(),
    "sentura-rbac",
    "agent-tenancy.json",
  );
  try {
    const raw = fs.readFileSync(tenancyPath, "utf-8");
    return JSON.parse(raw) as AgentTenancyRecord[];
  } catch {
    return [];
  }
}

export default definePluginEntry({
  id: "sentura-monitoring",
  name: "Sentura Monitoring",
  description: "Aggregated health endpoints for the Sentura platform.",
  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig ?? {});
    const startedAt = Date.now();

    /**
     * In-memory activity map keyed by agentId — tracks the most recent
     * model.usage event for each agent. Per-process; resets on gateway
     * restart. This is intentionally a hot-path data structure: every
     * LLM call writes here, and every health RPC reads it. The cost
     * store on disk is the durable record; this is the live view.
     */
    const agentActivity = new Map<string, AgentActivity>();

    /**
     * Provider activity: tracks the model set seen per provider plus a
     * running count of calls within the window. Pruned lazily on read.
     */
    interface ProviderState {
      provider: string;
      models: Set<string>;
      lastActivityAt: string | null;
      callTimestamps: number[]; // millis, used to compute recentCalls
    }
    const providerActivity = new Map<string, ProviderState>();

    const unsubscribe = onDiagnosticEvent((event) => {
      if (event.type !== "model.usage") return;

      const sessionKey = event.sessionKey ?? "";
      const agentMatch = /^agent:([^:]+):/.exec(sessionKey);
      const agentId = agentMatch?.[1] ?? null;
      const ts = event.ts;
      const isoTs = new Date(ts).toISOString();

      if (agentId) {
        const cur = agentActivity.get(agentId) ?? {
          agentId,
          lastActivityAt: null,
          totalCalls: 0,
        };
        cur.lastActivityAt = isoTs;
        cur.totalCalls += 1;
        agentActivity.set(agentId, cur);
      }

      const provider = event.provider;
      const model = event.model;
      if (provider) {
        const cur = providerActivity.get(provider) ?? {
          provider,
          models: new Set<string>(),
          lastActivityAt: null,
          callTimestamps: [],
        };
        if (model) cur.models.add(model);
        cur.lastActivityAt = isoTs;
        cur.callTimestamps.push(ts);
        // Cap memory: only keep timestamps from the last hour, regardless
        // of the configured window. Aggregations re-trim per-window on read.
        const oneHourAgo = ts - 60 * 60_000;
        cur.callTimestamps = cur.callTimestamps.filter((t) => t >= oneHourAgo);
        providerActivity.set(provider, cur);
      }
    });

    function snapshotProviders(now: number): ProviderActivity[] {
      const cutoff = now - config.providerWindowMinutes * 60_000;
      const out: ProviderActivity[] = [];
      for (const state of providerActivity.values()) {
        const recent = state.callTimestamps.filter((t) => t >= cutoff).length;
        out.push({
          provider: state.provider,
          modelCount: state.models.size,
          lastActivityAt: state.lastActivityAt,
          recentCalls: recent,
        });
      }
      return out.sort((a, b) => b.recentCalls - a.recentCalls);
    }

    // ========================================================================
    // Gateway RPCs
    // ========================================================================

    api.registerGatewayMethod("sentura.health.gateway", async ({ respond }) => {
      const now = Date.now();
      const rssBytes = process.memoryUsage().rss;
      respond(true, checkGateway(now, startedAt, rssBytes));
    });

    api.registerGatewayMethod("sentura.health.employees", async ({ respond }) => {
      const now = Date.now();
      const registry = loadAgentRegistry();
      const tenancy = loadAgentTenancy();
      const activity = Array.from(agentActivity.values());
      respond(
        true,
        checkEmployees(registry, tenancy, activity, config.providerWindowMinutes, now),
      );
    });

    api.registerGatewayMethod("sentura.health.providers", async ({ respond }) => {
      const now = Date.now();
      const snapshot = snapshotProviders(now);
      respond(true, checkProviders(snapshot, config.providerWindowMinutes, now));
    });

    api.registerGatewayMethod("sentura.health.summary", async ({ respond }) => {
      const now = Date.now();
      const rssBytes = process.memoryUsage().rss;
      const gateway = checkGateway(now, startedAt, rssBytes);
      const employees = checkEmployees(
        loadAgentRegistry(),
        loadAgentTenancy(),
        Array.from(agentActivity.values()),
        config.providerWindowMinutes,
        now,
      );
      const providers = checkProviders(snapshotProviders(now), config.providerWindowMinutes, now);
      respond(true, buildSummary(gateway, employees, providers, now));
    });

    api.on("gateway_stop", async () => {
      try {
        unsubscribe();
      } catch {
        // best-effort
      }
    });

    api.logger.info(
      `[sentura-monitoring] Extension registered. Provider window: ${config.providerWindowMinutes} minutes`,
    );
  },
});
