import {
  cbeJson,
  cbeRouteError,
  getAccioImportAnalysisPayload,
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
    const { id } = await params;
    return cbeJson(await getAccioImportAnalysisPayload(context, id));
  } catch (error) {
    return cbeRouteError(error);
  }
}
