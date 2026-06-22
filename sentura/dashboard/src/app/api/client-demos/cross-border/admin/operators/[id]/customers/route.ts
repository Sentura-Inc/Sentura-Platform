import {
  cbeJson,
  cbeRouteError,
  ListQuerySchema,
  listAdminOperatorCustomers,
  parseListQuery,
  requireCbeAdmin,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const { id } = await params;
    const query = parseListQuery(request, ListQuerySchema);
    return cbeJson(await listAdminOperatorCustomers(context, id, query));
  } catch (error) {
    return cbeRouteError(error);
  }
}
