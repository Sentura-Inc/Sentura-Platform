import {
  cbeJson,
  cbeRouteError,
  getEmployeeCostBudget,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    return cbeJson(await getEmployeeCostBudget(context, "month"));
  } catch (error) {
    return cbeRouteError(error);
  }
}
