import crypto from "node:crypto";
import path from "node:path";
import {
  ApprovalStore,
  fileApprovalImperative,
  getApprovalRuntime,
  type ApprovalConfig,
  type RiskLevel,
} from "@sentura/approval";
import { definePluginEntry, resolveOpenClawDir, type OpenClawPluginApi } from "./api.js";
import { ProvisioningStore } from "./src/store.js";
import type {
  ProvisioningConfig,
  ProvisioningQueryParams,
  ProvisioningRequest,
  ProvisioningStatus,
} from "./src/types.js";

export type { ProvisioningRequest, ProvisioningStatus, ProvisioningQueryParams } from "./src/types.js";

function resolveConfig(pluginConfig: Record<string, unknown>): ProvisioningConfig {
  const raw = pluginConfig as Partial<ProvisioningConfig>;
  return {
    dataDir: raw.dataDir ?? path.join(resolveOpenClawDir(), "sentura-provisioner"),
    approvalDataDir: raw.approvalDataDir ?? path.join(resolveOpenClawDir(), "sentura-approval"),
    defaultRiskLevel: raw.defaultRiskLevel ?? "high",
    retention: { maxAgeDays: raw.retention?.maxAgeDays ?? 365 },
  };
}

function generateRequestId(): string {
  return `prv_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function pickRiskLevel(input: unknown, fallback: RiskLevel): RiskLevel {
  const allowed: readonly RiskLevel[] = ["low", "medium", "high", "critical"];
  return allowed.includes(input as RiskLevel) ? (input as RiskLevel) : fallback;
}

const ALLOWED_TERMINAL_STATUSES: readonly ProvisioningStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export default definePluginEntry({
  id: "sentura-provisioner",
  name: "Sentura Provisioner",
  description:
    "Coordinates self-provisioning of new SaaS integrations with HITL approval and credential harvesting.",
  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig ?? {});
    const store = new ProvisioningStore({ dataDir: config.dataDir, retentionDays: config.retention.maxAgeDays });

    store.initialize().catch((err) => {
      api.logger.error("[sentura-provisioner] Failed to initialize store:", err);
    });

    /**
     * Resolve the approval runtime lazily — sentura-approval may register
     * after this extension. If the sibling is not loaded (operator
     * disabled it), we fall back to spinning up our own ApprovalStore
     * pointed at the configured approvalDataDir; the agent-facing tool
     * will then file requests that the dashboard's approval RPCs still
     * read from the same on-disk index. Without sentura-approval loaded,
     * those dashboard RPCs simply won't exist — operators who disable
     * approval entirely should disable provisioner too.
     */
    function resolveApprovalRuntime(): { store: ApprovalStore; config: ApprovalConfig } {
      const runtime = getApprovalRuntime();
      if (runtime) return runtime;
      const fallbackStore = new ApprovalStore({
        dataDir: config.approvalDataDir,
        retention: { maxAgeDays: 180 },
      });
      // Best-effort init — if it fails, fileApprovalImperative will surface
      // the error when it tries to write.
      fallbackStore.initialize([]).catch((err) =>
        api.logger.error("[sentura-provisioner] Fallback approval store init failed:", err),
      );
      const fallbackConfig: ApprovalConfig = {
        dataDir: config.approvalDataDir,
        defaultTimeoutMs: 30 * 60 * 1000,
        defaultOnTimeout: "deny",
        retention: { maxAgeDays: 180 },
      };
      return { store: fallbackStore, config: fallbackConfig };
    }

    // -----------------------------------------------------------------
    // Agent-facing tool — `sentura_provisioner_request`
    //
    // The agent calls this when it discovers it needs a new external
    // integration. We file an approval (defaulting to high risk) and
    // stash a provisioning record. The approval outcome dictates the
    // initial provisioning status:
    //   - auto_approved    → status="approved" (skill can start work)
    //   - auto_denied      → status="denied"
    //   - pending          → status="pending_approval" (skill must wait
    //                        for the dashboard to resolve the approval
    //                        and then call sentura_provisioner_complete)
    // -----------------------------------------------------------------
    api.registerTool(
      {
        name: "sentura_provisioner_request",
        description:
          "Request that Sentura provision a new external integration (e.g. Zendesk, Stripe, Salesforce account). Files a HITL approval and creates a provisioning record. Returns once approval is resolved or pending; the actual account creation is done by a browser-driven skill afterwards.",
        parameters: {
          type: "object" as const,
          properties: {
            service: {
              type: "string",
              description: "Stable service identifier — e.g. 'zendesk', 'stripe', 'salesforce', 'notion'.",
            },
            role: {
              type: "string",
              description:
                "Role / permission level the new account needs inside the service (e.g. 'admin', 'agent', 'read-only-analyst'). Reviewed by humans, not parsed mechanically.",
            },
            justification: {
              type: "string",
              description: "Why the agent needs this integration. Surfaced verbatim to the human approver.",
            },
            riskLevel: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "Optional risk override. Defaults to the extension's defaultRiskLevel ('high').",
            },
            metadata: {
              type: "object",
              description: "Free-form metadata recorded on the provisioning request (e.g. tenant id, region).",
              additionalProperties: true,
            },
          },
          required: ["service", "role", "justification"],
        },
        async execute(args: Record<string, unknown>) {
          const service = String(args.service ?? "").trim();
          const role = String(args.role ?? "").trim();
          const justification = String(args.justification ?? "").trim();
          if (!service || !role || !justification) {
            return JSON.stringify({
              status: "error",
              message: "service, role, and justification are required",
            });
          }
          const riskLevel = pickRiskLevel(args.riskLevel, config.defaultRiskLevel);
          const metadata = (args.metadata && typeof args.metadata === "object")
            ? (args.metadata as Record<string, unknown>)
            : {};

          const requestId = generateRequestId();
          const now = new Date().toISOString();

          const approvalRuntime = resolveApprovalRuntime();
          const approvalResult = await fileApprovalImperative(
            approvalRuntime.store,
            approvalRuntime.config,
            {
              agentId: "",
              action: `provisioner.${service}.create`,
              riskLevel,
              context: { service, role, justification, provisioningRequestId: requestId, ...metadata },
            },
          );

          const initialStatus: ProvisioningStatus =
            approvalResult.decision === "auto_approved"
              ? "approved"
              : approvalResult.decision === "auto_denied"
                ? "denied"
                : "pending_approval";

          const record: ProvisioningRequest = {
            id: requestId,
            agentId: "",
            service,
            role,
            justification,
            riskLevel,
            status: initialStatus,
            approvalRequestId: approvalResult.request.id,
            requestedAt: now,
            updatedAt: now,
            metadata,
          };
          await store.append(record);

          api.logger.info(
            `[sentura-provisioner] Filed provisioning ${requestId} for ${service} (role=${role}, risk=${riskLevel}, status=${initialStatus}, approval=${approvalResult.request.id}/${approvalResult.decision})`,
          );

          return JSON.stringify({
            requestId,
            status: initialStatus,
            approvalRequestId: approvalResult.request.id,
            approvalDecision: approvalResult.decision,
            reason: approvalResult.reason,
          });
        },
      } as Parameters<typeof api.registerTool>[0],
      { name: "sentura_provisioner_request" },
    );

    // -----------------------------------------------------------------
    // Tool — `sentura_provisioner_complete`
    //
    // Called by the browser-driven provisioning skill (or, in dev, by the
    // dashboard) once an external account has been created and its
    // credential has been written into the secret store. The skill is
    // responsible for the actual `secret set` call; the provisioner only
    // records the reference.
    // -----------------------------------------------------------------
    api.registerTool(
      {
        name: "sentura_provisioner_complete",
        description:
          "Mark a provisioning request as completed (or failed). Records the secret-store reference where the harvested credential lives, and optionally a path to the generated MCP server config snippet.",
        parameters: {
          type: "object" as const,
          properties: {
            requestId: { type: "string", description: "Provisioning request id returned by sentura_provisioner_request." },
            outcome: { type: "string", enum: ["completed", "failed"], description: "Terminal outcome of the provisioning run." },
            secretRef: {
              type: "string",
              description: "$secret reference where the harvested credential lives (e.g. '$secret:zendesk.api_token'). Required when outcome=completed.",
            },
            mcpServerConfigPath: {
              type: "string",
              description: "Repo-relative path to the generated MCP server config snippet, when applicable.",
            },
            errorMessage: {
              type: "string",
              description: "Failure reason. Required when outcome=failed.",
            },
          },
          required: ["requestId", "outcome"],
        },
        async execute(args: Record<string, unknown>) {
          const requestId = String(args.requestId ?? "").trim();
          const outcome = args.outcome === "failed" ? "failed" : "completed";
          if (!requestId) {
            return JSON.stringify({ status: "error", message: "requestId is required" });
          }
          const existing = store.get(requestId);
          if (!existing) {
            return JSON.stringify({ status: "error", message: "Provisioning request not found" });
          }
          if (ALLOWED_TERMINAL_STATUSES.includes(existing.status)) {
            return JSON.stringify({
              status: "error",
              message: `Request is already ${existing.status} — cannot re-complete`,
            });
          }

          const patch: Partial<ProvisioningRequest> = {
            status: outcome,
            completedAt: new Date().toISOString(),
          };
          if (outcome === "completed") {
            const secretRef = String(args.secretRef ?? "").trim();
            if (!secretRef) {
              return JSON.stringify({
                status: "error",
                message: "secretRef is required when outcome=completed",
              });
            }
            patch.secretRef = secretRef;
            const mcpPath = typeof args.mcpServerConfigPath === "string" ? args.mcpServerConfigPath : undefined;
            if (mcpPath) patch.mcpServerConfigPath = mcpPath;
          } else {
            const err = String(args.errorMessage ?? "").trim();
            if (!err) {
              return JSON.stringify({
                status: "error",
                message: "errorMessage is required when outcome=failed",
              });
            }
            patch.errorMessage = err;
          }

          const updated = await store.update(requestId, patch);
          api.logger.info(
            `[sentura-provisioner] ${requestId} → ${outcome}` +
              (patch.secretRef ? ` (secretRef=${patch.secretRef})` : "") +
              (patch.errorMessage ? ` (error=${patch.errorMessage})` : ""),
          );
          return JSON.stringify({ status: outcome, request: updated });
        },
      } as Parameters<typeof api.registerTool>[0],
      { name: "sentura_provisioner_complete" },
    );

    // -----------------------------------------------------------------
    // Dashboard-facing gateway RPCs
    // -----------------------------------------------------------------
    api.registerGatewayMethod("sentura.provisioner.requests.list", async ({ params, respond }) => {
      try {
        const requests = store.list((params ?? {}) as ProvisioningQueryParams);
        respond(true, { requests, count: requests.length });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.provisioner.requests.get", async ({ params, respond }) => {
      try {
        const id = (params as { id?: string } | undefined)?.id;
        if (!id) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "id is required" });
          return;
        }
        const request = store.get(id);
        if (!request) {
          respond(false, undefined, { code: "NOT_FOUND", message: "Provisioning request not found" });
          return;
        }
        respond(true, { request });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.registerGatewayMethod("sentura.provisioner.requests.cancel", async ({ params, respond }) => {
      try {
        const id = (params as { id?: string; reason?: string } | undefined)?.id;
        const reason = (params as { id?: string; reason?: string } | undefined)?.reason;
        if (!id) {
          respond(false, undefined, { code: "BAD_REQUEST", message: "id is required" });
          return;
        }
        const existing = store.get(id);
        if (!existing) {
          respond(false, undefined, { code: "NOT_FOUND", message: "Provisioning request not found" });
          return;
        }
        if (ALLOWED_TERMINAL_STATUSES.includes(existing.status)) {
          respond(false, undefined, {
            code: "CONFLICT",
            message: `Request is already ${existing.status} — cannot cancel`,
          });
          return;
        }
        const updated = await store.update(id, {
          status: "cancelled",
          completedAt: new Date().toISOString(),
          errorMessage: reason ?? "Cancelled via dashboard",
        });
        respond(true, { request: updated });
      } catch (err) {
        respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
      }
    });

    api.on("gateway_stop", async () => {
      await store.close();
      return {};
    });

    api.logger.info(
      "[sentura-provisioner] Extension registered. Data dir:",
      config.dataDir,
      "approval data dir:",
      config.approvalDataDir,
    );
  },
});
