import type { RiskLevel } from "@sentura/approval";

export type ProvisioningStatus =
  | "pending_approval"
  | "approved"
  | "denied"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface ProvisioningRequest {
  id: string;
  agentId: string;
  /** Stable service identifier — e.g. "zendesk", "stripe", "salesforce". */
  service: string;
  /**
   * Free-text role description the agent will perform inside the service.
   * Used for human review ("does this employee really need an admin account
   * here?"). NOT a structured permission set.
   */
  role: string;
  justification: string;
  riskLevel: RiskLevel;
  status: ProvisioningStatus;
  approvalRequestId?: string;
  /** $secret reference where the harvested credential will live. */
  secretRef?: string;
  /** Optional MCP server config snippet path the skill emitted post-creation. */
  mcpServerConfigPath?: string;
  errorMessage?: string;
  requestedAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
}

export interface ProvisioningConfig {
  dataDir: string;
  approvalDataDir: string;
  defaultRiskLevel: RiskLevel;
  retention: { maxAgeDays: number };
}

export interface ProvisioningQueryParams {
  status?: ProvisioningStatus;
  agentId?: string;
  service?: string;
  limit?: number;
}
