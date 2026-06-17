import {
  cbeJson,
  cbeRouteError,
  listAdminAgentUsage,
  requireCbeAdmin,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    return cbeJson(await listAdminAgentUsage(context));
  } catch (error) {
    return cbeRouteError(error);
  }
}
