import {
  cbeJson,
  cbeRouteError,
  parseJsonRequest,
  resolveCbeTenantContext,
  reviewEmployeeMemoryFacts,
  ReviewMemoryFactsRequestSchema,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, ReviewMemoryFactsRequestSchema);
    return cbeJson(await reviewEmployeeMemoryFacts(context, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}
