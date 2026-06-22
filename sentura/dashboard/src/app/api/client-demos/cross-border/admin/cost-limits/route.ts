import {
  cbeJson,
  cbeRouteError,
  AdminCostLimitPatchRequestSchema,
  parseJsonRequest,
  requireCbeAdmin,
  resolveCbeTenantContext,
  upsertAdminCostLimit,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const body = await parseJsonRequest(request, AdminCostLimitPatchRequestSchema);
    return cbeJson(await upsertAdminCostLimit(context, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}
