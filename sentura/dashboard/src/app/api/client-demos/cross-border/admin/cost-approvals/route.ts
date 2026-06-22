import {
  cbeJson,
  cbeRouteError,
  AdminCostApprovalDecisionRequestSchema,
  decideAdminCostApproval,
  listAdminCosts,
  parseJsonRequest,
  requireCbeAdmin,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const costs = await listAdminCosts(context, "month");
    return cbeJson({ items: costs.approvals });
  } catch (error) {
    return cbeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const body = await parseJsonRequest(request, AdminCostApprovalDecisionRequestSchema);
    return cbeJson(await decideAdminCostApproval(context, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}
