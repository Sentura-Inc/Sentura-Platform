import type {
  ApprovalConfig,
  ApprovalPolicy,
  ApprovalRequest,
  PolicyMatch,
  PolicyOutcome,
} from "./types.js";

export interface PolicyEvaluation {
  outcome: PolicyOutcome;
  policyId?: string;
}

/**
 * Evaluate the first matching policy. If no policy matches, fall through to
 * a safe default: route through human approval with the configured default
 * timeout and onTimeout=deny. The default is intentionally conservative —
 * an unmatched request is *not* auto-approved.
 */
export function evaluate(
  request: Pick<ApprovalRequest, "action" | "riskLevel" | "context">,
  policies: ApprovalPolicy[],
  config: Pick<ApprovalConfig, "defaultTimeoutMs" | "defaultOnTimeout">,
): PolicyEvaluation {
  const sorted = [...policies].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const policy of sorted) {
    if (matches(request, policy.match)) {
      return { outcome: policy.outcome, policyId: policy.id };
    }
  }
  return {
    outcome: {
      kind: "require_human",
      reason: "No matching policy — defaulting to human review",
      escalation: ["employee_owner", "department_admin", "platform_admin"],
      timeoutMs: config.defaultTimeoutMs,
      onTimeout: config.defaultOnTimeout,
    },
  };
}

export function matches(
  request: Pick<ApprovalRequest, "action" | "riskLevel" | "context">,
  match: PolicyMatch,
): boolean {
  if (match.actions && match.actions.length > 0 && !match.actions.includes(request.action)) {
    return false;
  }
  if (match.riskLevels && match.riskLevels.length > 0 && !match.riskLevels.includes(request.riskLevel)) {
    return false;
  }
  if (match.amountField !== undefined) {
    const raw = request.context[match.amountField];
    const amount = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(amount)) return false;
    if (match.amountLte !== undefined && !(amount <= match.amountLte)) return false;
    if (match.amountGte !== undefined && !(amount >= match.amountGte)) return false;
  }
  if (match.contextEquals) {
    for (const [key, expected] of Object.entries(match.contextEquals)) {
      if (request.context[key] !== expected) return false;
    }
  }
  return true;
}

/**
 * Built-in baseline policies. These ship with the extension so that a fresh
 * install behaves sensibly even before the operator writes any custom rules.
 *
 * Order matters: higher `priority` wins. Custom policies can shadow these by
 * setting a higher priority on a tighter `match`.
 */
export function builtinPolicies(): ApprovalPolicy[] {
  return [
    {
      id: "builtin:critical-always-human",
      description: "Critical-risk actions always require human approval.",
      priority: 100,
      match: { riskLevels: ["critical"] },
      outcome: {
        kind: "require_human",
        reason: "Critical-risk action — human approval mandatory",
        escalation: ["department_admin", "platform_admin"],
        timeoutMs: 1800000,
        onTimeout: "deny",
      },
    },
    {
      id: "builtin:low-risk-auto-approve",
      description: "Low-risk actions auto-approve.",
      priority: 10,
      match: { riskLevels: ["low"] },
      outcome: { kind: "auto_approve", reason: "Low-risk action — auto-approved" },
    },
  ];
}
