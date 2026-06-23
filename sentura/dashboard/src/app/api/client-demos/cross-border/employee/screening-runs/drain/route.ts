import {
  cbeJson,
  cbeRouteError,
  ClaimQueuedScreeningRunsRequestSchema,
  claimQueuedScreeningChildRuns,
  parseJsonRequest,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, ClaimQueuedScreeningRunsRequestSchema);
    return cbeJson(await claimQueuedScreeningChildRuns(context, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}
