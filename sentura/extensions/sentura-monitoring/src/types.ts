export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthGateway {
  status: HealthStatus;
  uptimeSeconds: number;
  memoryRssMb: number;
  startedAt: string;
}

export interface HealthEmployee {
  agentId: string;
  registered: boolean;
  tenantId: string;
  departmentId: string | null;
  /** ISO timestamp of the most recent model.usage event for this agent, or null. */
  lastActivityAt: string | null;
  /** Calls observed since process start. */
  totalCalls: number;
}

export interface HealthEmployees {
  status: HealthStatus;
  count: number;
  registered: number;
  active: number;
  employees: HealthEmployee[];
}

export interface HealthProvider {
  provider: string;
  modelCount: number;
  /** ISO timestamp of the most recent model.usage event from this provider, or null. */
  lastActivityAt: string | null;
  status: HealthStatus;
  recentCalls: number;
}

export interface HealthProviders {
  status: HealthStatus;
  windowMinutes: number;
  providers: HealthProvider[];
}

export interface HealthSummary {
  generatedAt: string;
  gateway: HealthGateway;
  employees: HealthEmployees;
  providers: HealthProviders;
}
