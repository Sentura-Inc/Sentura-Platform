import {
  cbeJson,
  cbeRouteError,
  listEmployeeCustomers,
  ListQuerySchema,
  parseListQuery,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const query = parseListQuery(request, ListQuerySchema);
    return cbeJson(await listEmployeeCustomers(context, query));
  } catch (error) {
    return cbeRouteError(error);
  }
}
