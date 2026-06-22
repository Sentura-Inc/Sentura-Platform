import {
  CancelEmployeeTaskRequestSchema,
  cancelEmployeeTask,
  cbeJson,
  cbeRouteError,
  parseJsonRequest,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveCbeTenantContext(request);
    const { id } = await params;
    const body = await parseJsonRequest(request, CancelEmployeeTaskRequestSchema);
    return cbeJson({ task: await cancelEmployeeTask(context, id, body) });
  } catch (error) {
    return cbeRouteError(error);
  }
}
