import {
  cbeJson,
  cbeRouteError,
  AdminUpdateOperatorRequestSchema,
  deleteAdminOperator,
  getAdminOperator,
  parseJsonRequest,
  requireCbeAdmin,
  resolveCbeTenantContext,
  updateAdminOperator,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const { id } = await params;
    const body = await parseJsonRequest(request, AdminUpdateOperatorRequestSchema);
    return cbeJson(await updateAdminOperator(context, id, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const { id } = await params;
    return cbeJson(await deleteAdminOperator(context, id));
  } catch (error) {
    return cbeRouteError(error);
  }
}
