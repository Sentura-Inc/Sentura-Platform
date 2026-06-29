import {
  cbeJson,
  cbeRouteError,
  createEmployeeCostAllowanceRequest,
  EmployeeCostAllowanceRequestSchema,
  parseJsonRequest,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, EmployeeCostAllowanceRequestSchema);
    return cbeJson(await createEmployeeCostAllowanceRequest(context, body));
  } catch (error) {
    return cbeRouteError(error);
  }
}
