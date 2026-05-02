/**
 * Pure check helpers for sentura-monitoring.
 *
 * Each helper takes the in-memory state (collected by the diagnostic-event
 * subscriber in `index.ts`) plus disk state (the agent-tenancy file +
 * OpenClaw config) and returns one of the four health view-models. Kept
 * side-effect-free so tests can hand them synthetic state objects.
 */

import type {
  HealthEmployee,
  HealthEmployees,
  HealthGateway,
  HealthProvider,
  HealthProviders,
  HealthStatus,
  HealthSummary,
} from "./types.js";

export interface AgentRegistry {
  agentId: string;
  registered: boolean;
}

export interface AgentTenancyRecord {
  agentId: string;
  tenantId: string;
  departmentId: string | null;
}

export interface AgentActivity {
  agentId: string;
  lastActivityAt: string | null;
  totalCalls: number;
}

export interface ProviderActivity {
  provider: string;
  modelCount: number;
  lastActivityAt: string | null;
  recentCalls: number;
}

const DEFAULT_TENANT_ID = "default";

export function checkGateway(now: number, startedAt: number, rssBytes: number): HealthGateway {
  const uptimeSeconds = Math.floor((now - startedAt) / 1000);
  const memoryRssMb = Math.round((rssBytes / (1024 * 1024)) * 10) / 10;
  // The plain "process is up" check is always ok unless an upstream
  // service decides otherwise — we use the `down` value only when this
  // helper is invoked from the wrapping summary that detected a failure.
  return {
    status: "ok",
    uptimeSeconds,
    memoryRssMb,
    startedAt: new Date(startedAt).toISOString(),
  };
}

export function checkEmployees(
  registry: AgentRegistry[],
  tenancy: AgentTenancyRecord[],
  activity: AgentActivity[],
  windowMinutes: number,
  now: number,
): HealthEmployees {
  const tenancyMap = new Map(tenancy.map((r) => [r.agentId, r]));
  const activityMap = new Map(activity.map((a) => [a.agentId, a]));
  const cutoff = now - windowMinutes * 60_000;

  const employees: HealthEmployee[] = registry.map((reg) => {
    const t = tenancyMap.get(reg.agentId);
    const a = activityMap.get(reg.agentId);
    return {
      agentId: reg.agentId,
      registered: reg.registered,
      tenantId: t?.tenantId ?? DEFAULT_TENANT_ID,
      departmentId: t?.departmentId ?? null,
      lastActivityAt: a?.lastActivityAt ?? null,
      totalCalls: a?.totalCalls ?? 0,
    };
  });

  const registered = employees.filter((e) => e.registered).length;
  const active = employees.filter((e) => {
    if (!e.lastActivityAt) return false;
    return new Date(e.lastActivityAt).getTime() >= cutoff;
  }).length;

  let status: HealthStatus = "ok";
  if (registered === 0) status = "down";
  else if (registered < employees.length) status = "degraded";

  return {
    status,
    count: employees.length,
    registered,
    active,
    employees,
  };
}

export function checkProviders(
  activity: ProviderActivity[],
  windowMinutes: number,
  now: number,
): HealthProviders {
  const cutoff = now - windowMinutes * 60_000;
  const providers: HealthProvider[] = activity.map((p) => {
    const lastMs = p.lastActivityAt ? new Date(p.lastActivityAt).getTime() : null;
    let status: HealthStatus;
    if (lastMs === null) {
      status = "down";
    } else if (lastMs >= cutoff) {
      status = "ok";
    } else {
      status = "degraded";
    }
    return {
      provider: p.provider,
      modelCount: p.modelCount,
      lastActivityAt: p.lastActivityAt,
      status,
      recentCalls: p.recentCalls,
    };
  });

  // Aggregate provider status: if any provider is "ok" we're at least
  // partially healthy; if every provider is "down" we report down; if some
  // are degraded we report degraded.
  let status: HealthStatus = "ok";
  if (providers.length === 0) {
    status = "ok"; // no providers = nothing to fail (yet)
  } else if (providers.every((p) => p.status === "down")) {
    status = "down";
  } else if (providers.some((p) => p.status !== "ok")) {
    status = "degraded";
  }

  return { status, windowMinutes, providers };
}

export function buildSummary(
  gateway: HealthGateway,
  employees: HealthEmployees,
  providers: HealthProviders,
  now: number,
): HealthSummary {
  return {
    generatedAt: new Date(now).toISOString(),
    gateway,
    employees,
    providers,
  };
}
