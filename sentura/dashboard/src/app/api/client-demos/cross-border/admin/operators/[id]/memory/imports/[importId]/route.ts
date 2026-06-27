import {
  cbeJson,
  cbeRouteError,
  getAccioImportAnalysisPayload,
  requireCbeAdmin,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; importId: string }> },
) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const { id, importId } = await params;
    return cbeJson(await getAccioImportAnalysisPayload(context, importId, { ownerUserId: id }));
  } catch (error) {
    return cbeRouteError(error);
  }
}
