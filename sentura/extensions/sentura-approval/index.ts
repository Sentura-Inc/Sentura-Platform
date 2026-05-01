import crypto from "node:crypto";
import path from "node:path";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import { builtinPolicies, evaluate } from "./src/policy.js";
import { ApprovalStore } from "./src/store.js";
import type {
  ApprovalConfig,
  ApprovalDecisionInput,
  ApprovalPolicy,
  ApprovalQueryParams,
  ApprovalRequest,
  EscalationRole,
  RiskLevel,
} from "./src/types.js";

export type {
  ApprovalConfig,
  ApprovalDecision,
  ApprovalDecisionInput,
  ApprovalPolicy,
  ApprovalQueryParams,
  ApprovalRequest,
  ApprovalStatus,
  EscalationRole,
  PolicyMatch,
  PolicyOutcome,
  RiskLevel,
} from "./src/types.js";

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Module-scoped runtime handle for sibling extensions (e.g. sentura-provisioner)
 * that need to file an approval programmatically. The handle is set when this
 * extension's `register()` runs and cleared on `gateway_stop`. Sibling
 * extensions should always lazy-resolve through `getApprovalRuntime()` since
 * extension load order is not guaranteed.
 */
let runtimeHandle: { store: ApprovalStore; config: ApprovalConfig } | null = null;

export function getApprovalRuntime(): { store: ApprovalStore; config: ApprovalConfig } | null {
  return runtimeHandle;
}

export { ApprovalStore } from "./src/store.js";
export { evaluate, builtinPolicies } from "./src/policy.js";

function resolveConfig(pluginConfig: Record<string, unknown>): ApprovalConfig {
  const raw = pluginConfig as Partial<ApprovalConfig>;
  return {
    dataDir: raw.dataDir ?? path.join(resolveOpenClawDir(), "sentura-approval"),
    defaultTimeoutMs: raw.defaultTimeoutMs ?? 30 * 60 * 1000,
    defaultOnTimeout: raw.defaultOnTimeout ?? "deny",
    retention: { maxAgeDays: raw.retention?.maxAgeDays ?? 180 },
  };
}

function generateRequestId(): string {
  return `apr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function pickRiskLevel(input: unknown): RiskLevel {
  const allowed: readonly RiskLevel[] = ["low", "medium", "high", "critical"];
  return allowed.includes(input as RiskLevel) ? (input as RiskLevel) : "medium";
}

export default definePluginEntry({
  id: "sentura-approval",
  name: "Sentura Approval",
  description:
    "Context-aware HITL approval — evaluates policy rules to auto-approve, auto-deny, or route requests through configurable escalation chains with timeouts.",
  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig ?? {});
    const store = new ApprovalStore({ dataDir: config.dataDir, retention: config.retention });

    store.initialize(builtinPolicies()).catch((err) => {
      api.logger.error("[sentura-approval] Failed to initialize store:", err);
    });

    runtimeHandle = { store, config };

    // -----------------------------------------------------------------
    // Periodic sweep — terminal-states any pending request whose
    // `expiresAt` has passed. The store flips them to status="expired";
    // the recorded `onTimeoutDecision` lets downstream callers (e.g. the
    // provisioner) replay the policy's intended fall-back without having
    // to re-read the original policy (which may have been edited since).
    // -----------------------------------------------------------------
    const sweepTimer = setInterval(() => {
      store
        .sweepExpired()
        .then((expired) => {
          if (expired.length > 0) {
            api.logger.info(
              `[sentura-approval] Swept ${expired.length} expired approval(s):`,
              expired.map((r) => `${r.id} (${r.action})`).join(", "),
            );
          }
        })
        .catch((err) => api.logger.error("[sentura-approval] Sweep failed:", err));
    }, SWEEP_INTERVAL_MS);

    // -----------------------------------------------------------------
    // Agent-facing tool — `sentura_approval_request`
    //
    // Agents call this BEFORE taking a high-risk action. The tool
    // evaluates the configured policies and either:
    //   - returns an immediate auto_approved / auto_denied decision, or
    //   - records a pending request and returns { status: "pending",
    //     requestId, expiresAt }. The agent must NOT proceed on a
    //     pending result — it should surface the request to the human
    //     channel and wait for the dashboard to resolve it.
    // -----------------------------------------------------------------
    api.registerTool(
      {
        name: "sentura_approval_request",
        description:
          "Request approval for a high-risk action. Returns auto_approved or auto_denied immediately when a matching policy allows; otherwise creates a pending request that a human resolves through the dashboard.",
        parameters: {
          type: "object" as const,
          properties: {
            action: {
              type: "string",
              description:
                "Stable identifier for the action being approved (e.g. 'refund.issue', 'account.create', 'data.export').",
            },
            riskLevel: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "Operator-assessed risk level. Critical-risk actions always require human approval.",
            },
            context: {
              type: "object",
              description:
                "Action-specific context the policy may inspect (e.g. { amount: 250, currency: 'USD', customerId: '...' }). Numeric fields can be matched by amountField/amountLte/amountGte; equality matches use contextEquals.",
              additionalProperties: true,
            },
            sessionKey: {
              type: "string",
              description: "Optional session key the request originated from. Recorded on the audit trail.",
            },
          },
          required: ["action", "riskLevel"],
        },
        async execute(args: Record<string, unknown>) {
          const action = String(args.action ?? "").trim();
          if (!action) {
            return JSON.stringify({ status: "error", message: "action is required" });
          }
          const riskLevel = pickRiskLevel(args.riskLevel);
          const context = (args.context && typeof args.context === "object")
            ? (args.context as Record<string, unknown>)
            : {};
          const sessionKey = typeof args.sessionKey === "string" ? args.sessionKey : undefined;

          const evaluation = evaluate({ action, riskLevel, context }, store.listPolicies(), config);

          // The agentId we surface in audit comes from the runtime — the
          // tool API doesn't pass it directly into execute(), so we leave
          // it blank here and let the audit hook fill it from
          // `before_tool_call.agentId`. The store still keys requests by
          // the random id we generate.
          const id = generateRequestId();
          const now = new Date().toISOString();

          if (evaluation.outcome.kind === "auto_approve") {
            const request: ApprovalRequest = {
              id,
              agentId: "",
              sessionKey,
              action,
              riskLevel,
              context,
              requestedAt: now,
              policyId: evaluation.policyId,
              status: "auto_approved",
              decisionReason: evaluation.outcome.reason,
              decidedAt: now,
            };
            await store.appendRequest(request);
            return JSON.stringify({
              status: "auto_approved",
              requestId: id,
              policyId: evaluation.policyId,
              reason: evaluation.outcome.reason,
            });
          }

          if (evaluation.outcome.kind === "auto_deny") {
            const request: ApprovalRequest = {
              id,
              agentId: "",
              sessionKey,
              action,
              riskLevel,
              context,
              requestedAt: now,
              policyId: evaluation.policyId,
              status: "auto_denied",
              decisionReason: evaluation.outcome.reason,
              decidedAt: now,
            };
            await store.appendRequest(request);
            return JSON.stringify({
              status: "auto_denied",
              requestId: id,
              policyId: evaluation.policyId,
              reason: evaluation.outcome.reason,
            });
          }

          // require_human
          const expiresAt = new Date(Date.now() + evaluation.outcome.timeoutMs).toISOString();
          const request: ApprovalRequest = {
            id,
            agentId: "",
            sessionKey,
            action,
            riskLevel,
            context,
            requestedAt: now,
            policyId: evaluation.policyId,
            status: "pending",
            expiresAt,
            onTimeoutDecision: evaluation.outcome.onTimeout,
            escalation: { chain: evaluation.outcome.escalation, currentIndex: 0 },
          };
          await store.appendRequest(request);
          return JSON.stringify({
            status: "pending",
            requestId: id,
            policyId: evaluation.policyId,
            reason: evaluation.outcome.reason,
            expiresAt,
            escalation: request.escalation,
            onTimeoutDecision: evaluation.outcome.onTimeout,
          });
        },
      } as Parameters<typeof api.registerTool>[0],
      { name: "sentura_approval_request" },
    );

    // -----------------------------------------------------------------
    // Dashboard-facing gateway RPCs
    //
    // RBAC is intentionally NOT applied here yet. The dashboard's gateway
    // client is mid-rewrite for Week 3 (Person C is wiring the auto-seeded
    // platform_admin token through `params.actorToken`); once that lands
    // we'll wrap `*.decide` and `policies.upsert/remove` with `withRbac`
    // from @sentura/rbac. Until then the calls record `actorUserId` from
    // params into the audit trail without enforcing it.
    // -----------------------------------------------------------------
    api.registerGatewayMethod("sentura.approval.requests.list", async ({ params, respond }) => {
      try {
        const query = (params ?? {}) as ApprovalQueryParams;
        const requests = store.query(query);
        respond(true, { requests, count: requests.length });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.approval.requests.get", async ({ params, respond }) => {
      try {
        const id = (params as { id?: string } | undefined)?.id;
        if (!id) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "id is required" });
          return;
        }
        const request = store.getRequest(id);
        if (!request) {
          respond(false, undefined, { code: "NOT_FOUND", message: "Approval request not found" });
          return;
        }
        respond(true, { request });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.approval.requests.decide", async ({ params, respond }) => {
      try {
        const input = (params ?? {}) as Partial<ApprovalDecisionInput>;
        const { requestId, decision, decidedByUserId, reason } = input;
        if (!requestId || !decision || !decidedByUserId) {
          respond(false, undefined, {
            code: "BAD_REQUEST",
            message: "requestId, decision, and decidedByUserId are required",
          });
          return;
        }
        if (decision !== "approved" && decision !== "denied") {
          respond(false, undefined, {
            code: "BAD_REQUEST",
            message: "decision must be 'approved' or 'denied'",
          });
          return;
        }
        const existing = store.getRequest(requestId);
        if (!existing) {
          respond(false, undefined, { code: "NOT_FOUND", message: "Approval request not found" });
          return;
        }
        if (existing.status !== "pending") {
          respond(false, undefined, {
            code: "CONFLICT",
            message: `Request is already ${existing.status} — cannot re-decide`,
          });
          return;
        }
        const updated = await store.updateStatus(requestId, {
          status: decision,
          decisionReason: reason,
          decidedAt: new Date().toISOString(),
          decidedByUserId,
        });
        api.logger.info(
          `[sentura-approval] ${decidedByUserId} ${decision} ${requestId} (${existing.action}, ${existing.riskLevel})`,
        );
        respond(true, { request: updated });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.approval.policies.list", async ({ respond }) => {
      respond(true, { policies: store.listPolicies() });
    });

    api.registerGatewayMethod("sentura.approval.policies.upsert", async ({ params, respond }) => {
      try {
        const policy = params as ApprovalPolicy | undefined;
        if (!policy?.id || !policy.match || !policy.outcome) {
          respond(false, undefined, {
            code: "BAD_REQUEST",
            message: "id, match, and outcome are required",
          });
          return;
        }
        await store.upsertPolicy(policy);
        respond(true, { policy });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.approval.policies.remove", async ({ params, respond }) => {
      try {
        const id = (params as { id?: string } | undefined)?.id;
        if (!id) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "id is required" });
          return;
        }
        const removed = await store.removePolicy(id);
        if (!removed) {
          respond(false, undefined, { code: "NOT_FOUND", message: "Policy not found" });
          return;
        }
        respond(true, { id, removed: true });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.on("gateway_stop", async () => {
      clearInterval(sweepTimer);
      await store.close();
      return {};
    });

    api.logger.info("[sentura-approval] Extension registered. Data dir:", config.dataDir);
  },
});

// Imperative helpers exported for sibling extensions (e.g. sentura-provisioner)
// that need to file an approval programmatically without going through the
// agent-facing tool. They take a pre-built ApprovalStore instance, so the
// caller is responsible for sharing the same data dir.

export interface FileApprovalParams {
  agentId: string;
  sessionKey?: string;
  action: string;
  riskLevel: RiskLevel;
  context: Record<string, unknown>;
}

export interface FileApprovalResult {
  request: ApprovalRequest;
  decision: "auto_approved" | "auto_denied" | "pending";
  reason: string;
  policyId?: string;
}

export async function fileApprovalImperative(
  store: ApprovalStore,
  config: Pick<ApprovalConfig, "defaultTimeoutMs" | "defaultOnTimeout">,
  params: FileApprovalParams,
): Promise<FileApprovalResult> {
  const evaluation = evaluate(params, store.listPolicies(), config);
  const id = generateRequestId();
  const now = new Date().toISOString();
  if (evaluation.outcome.kind === "auto_approve") {
    const request: ApprovalRequest = {
      ...params,
      id,
      requestedAt: now,
      policyId: evaluation.policyId,
      status: "auto_approved",
      decisionReason: evaluation.outcome.reason,
      decidedAt: now,
    };
    await store.appendRequest(request);
    return { request, decision: "auto_approved", reason: evaluation.outcome.reason, policyId: evaluation.policyId };
  }
  if (evaluation.outcome.kind === "auto_deny") {
    const request: ApprovalRequest = {
      ...params,
      id,
      requestedAt: now,
      policyId: evaluation.policyId,
      status: "auto_denied",
      decisionReason: evaluation.outcome.reason,
      decidedAt: now,
    };
    await store.appendRequest(request);
    return { request, decision: "auto_denied", reason: evaluation.outcome.reason, policyId: evaluation.policyId };
  }
  const escalation: { chain: EscalationRole[]; currentIndex: number } = {
    chain: evaluation.outcome.escalation,
    currentIndex: 0,
  };
  const request: ApprovalRequest = {
    ...params,
    id,
    requestedAt: now,
    policyId: evaluation.policyId,
    status: "pending",
    expiresAt: new Date(Date.now() + evaluation.outcome.timeoutMs).toISOString(),
    onTimeoutDecision: evaluation.outcome.onTimeout,
    escalation,
  };
  await store.appendRequest(request);
  return { request, decision: "pending", reason: evaluation.outcome.reason, policyId: evaluation.policyId };
}
