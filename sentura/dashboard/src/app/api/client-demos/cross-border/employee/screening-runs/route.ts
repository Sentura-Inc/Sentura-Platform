import {
  cbeJson,
  cbeRouteError,
  createScreeningRun,
  CreateScreeningRunRequestSchema,
  parseJsonRequest,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, CreateScreeningRunRequestSchema);
    return cbeJson(await createScreeningRun(context, body), 201);
  } catch (error) {
    return cbeRouteError(error);
  }
}
