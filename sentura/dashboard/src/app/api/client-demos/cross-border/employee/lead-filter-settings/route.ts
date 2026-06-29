import {
  cbeJson,
  cbeRouteError,
  getLeadFilterSettings,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request, { expectedRole: "operator" });
    return cbeJson({ settings: await getLeadFilterSettings(context) });
  } catch (error) {
    return cbeRouteError(error);
  }
}
