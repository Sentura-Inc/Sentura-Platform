import {
  cbeJson,
  cbeRouteError,
  listAdminOperators,
  requireCbeAdmin,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    return cbeJson(await listAdminOperators(context));
  } catch (error) {
    return cbeRouteError(error);
  }
}
