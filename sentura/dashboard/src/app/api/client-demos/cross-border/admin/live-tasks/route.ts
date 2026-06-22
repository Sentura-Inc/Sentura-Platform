import {
  cbeJson,
  cbeRouteError,
  listAdminLiveTasks,
  ListQuerySchema,
  parseListQuery,
  requireCbeAdmin,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const query = parseListQuery(request, ListQuerySchema);
    return cbeJson(await listAdminLiveTasks(context, query));
  } catch (error) {
    return cbeRouteError(error);
  }
}
