import {
  cbeJson,
  cbeRouteError,
  getLeadFilterSettings,
  LeadFilterSettingsInputSchema,
  parseJsonRequest,
  resolveCbeTenantContext,
  updateLeadFilterSettings,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request, { expectedRole: "admin" });
    return cbeJson({ settings: await getLeadFilterSettings(context) });
  } catch (error) {
    return cbeRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request, { expectedRole: "admin" });
    const input = await parseJsonRequest(request, LeadFilterSettingsInputSchema);
    return cbeJson({ settings: await updateLeadFilterSettings(context, input) });
  } catch (error) {
    return cbeRouteError(error);
  }
}
