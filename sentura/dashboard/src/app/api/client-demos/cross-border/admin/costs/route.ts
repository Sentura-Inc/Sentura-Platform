import {
  cbeJson,
  cbeRouteError,
  listAdminCosts,
  requireCbeAdmin,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rangeFromRequest(request: Request) {
  const value = new URL(request.url).searchParams.get("range");
  if (value === "today" || value === "week" || value === "month" || value === "all") return value;
  return "month";
}

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    return cbeJson(await listAdminCosts(context, rangeFromRequest(request)));
  } catch (error) {
    return cbeRouteError(error);
  }
}
