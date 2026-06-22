import {
  cbeJson,
  cbeRouteError,
  AdminCostAllowancePatchRequestSchema,
  parseJsonRequest,
  requireCbeAdmin,
  resolveCbeTenantContext,
  setAdminCostAllowance,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const body = await parseJsonRequest(request, AdminCostAllowancePatchRequestSchema);
    return cbeJson(await setAdminCostAllowance(context, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}
