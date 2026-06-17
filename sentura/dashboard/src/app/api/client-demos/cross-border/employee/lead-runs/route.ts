import {
  cbeJson,
  cbeRouteError,
  createLeadRun,
  CreateLeadRunRequestSchema,
  parseJsonRequest,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, CreateLeadRunRequestSchema);
    return cbeJson(await createLeadRun(context, body), 201);
  } catch (error) {
    return cbeRouteError(error);
  }
}
