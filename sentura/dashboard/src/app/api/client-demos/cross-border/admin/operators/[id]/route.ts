import {
  cbeJson,
  cbeRouteError,
  getAdminOperator,
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
    return cbeJson(await getAdminOperator(context, id));
  } catch (error) {
    return cbeRouteError(error);
  }
}
