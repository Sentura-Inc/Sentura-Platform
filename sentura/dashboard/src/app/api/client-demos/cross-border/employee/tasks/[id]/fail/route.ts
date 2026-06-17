import {
  cbeJson,
  cbeRouteError,
  failEmployeeTask,
  FailEmployeeTaskRequestSchema,
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
    const body = await parseJsonRequest(request, FailEmployeeTaskRequestSchema);
    return cbeJson(await failEmployeeTask(context, id, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}
