import {
  AdminChangePasswordRequestSchema,
  cbeJson,
  cbeRouteError,
  parseJsonRequest,
  requireCbeAdmin,
  resolveCbeTenantContext,
  updateAdminOwnPassword,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request, { expectedRole: "admin" });
    requireCbeAdmin(context);
    const body = await parseJsonRequest(request, AdminChangePasswordRequestSchema);
    return cbeJson(await updateAdminOwnPassword(context, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}
