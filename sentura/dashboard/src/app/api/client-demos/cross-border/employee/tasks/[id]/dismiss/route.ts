import {
  cbeJson,
  cbeRouteError,
  dismissEmployeeTask,
  getCbePool,
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
    return cbeJson({ task: await dismissEmployeeTask(getCbePool(), context, id) });
  } catch (error) {
    return cbeRouteError(error);
  }
}
