export type ApprovalDecision = "auto_approved" | "auto_denied" | "approved" | "denied" | "expired";

export type ApprovalStatus = "pending" | ApprovalDecision;

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type EscalationRole =
  | "employee_owner"
  | "department_admin"
  | "platform_admin"
  | "auditor"
  | "manager";

export interface ApprovalRequest {
  id: string;
  agentId: string;
  sessionKey?: string;
  action: string;
  riskLevel: RiskLevel;
  context: Record<string, unknown>;
  requestedAt: string;
  policyId?: string;
  status: ApprovalStatus;
  decisionReason?: string;
  decidedAt?: string;
  decidedByUserId?: string;
  expiresAt?: string;
  /**
   * Decision the policy specified should apply if the request expires
   * without a human response. Stored on the request so the caller (and
   * audit log) can recover the configured behaviour even after the policy
   * itself has been edited.
   */
  onTimeoutDecision?: "approve" | "deny";
  escalation?: {
    chain: EscalationRole[];
    currentIndex: number;
  };
  /**
   * Multi-tenancy fields (Week 4 Person D). Tenants are isolation boundaries
   * — approvals filed in one tenant must never appear in another tenant's
   * dashboard. Department drives RBAC `department`-scope filters so a
   * `manager` of `support` only sees `support` approvals.
   */
  tenantId?: string;
  departmentId?: string;
}

export type PolicyOutcome =
  | { kind: "auto_approve"; reason: string }
  | { kind: "auto_deny"; reason: string }
  | {
      kind: "require_human";
      reason: string;
      escalation: EscalationRole[];
      timeoutMs: number;
      onTimeout: "deny" | "approve";
    };

export interface ApprovalPolicy {
  id: string;
  description?: string;
  match: PolicyMatch;
  outcome: PolicyOutcome;
  /** Higher-priority policies are evaluated first. Defaults to 0. */
  priority?: number;
}

export interface PolicyMatch {
  /** Match if `request.action` is in this list. Empty/omitted = match any action. */
  actions?: string[];
  /** Match if `request.riskLevel` is in this list. */
  riskLevels?: RiskLevel[];
  /** Numeric guard: read `context[amountField]` as a number and compare. */
  amountField?: string;
  amountLte?: number;
  amountGte?: number;
  /** Equality guards on arbitrary context fields. */
  contextEquals?: Record<string, unknown>;
}

export interface ApprovalConfig {
  dataDir: string;
  defaultTimeoutMs: number;
  defaultOnTimeout: "deny" | "approve";
  retention: {
    maxAgeDays: number;
  };
}

export interface ApprovalDecisionInput {
  requestId: string;
  decision: "approved" | "denied";
  decidedByUserId: string;
  reason?: string;
}

export interface ApprovalQueryParams {
  status?: ApprovalStatus;
  agentId?: string;
  riskLevel?: RiskLevel;
  limit?: number;
  /** Multi-tenancy filters (Week 4 Person D). */
  tenantId?: string;
  departmentId?: string;
}
