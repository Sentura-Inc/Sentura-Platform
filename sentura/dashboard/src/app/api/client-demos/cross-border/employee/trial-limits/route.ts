import {
  cbeJson,
  cbeRouteError,
  getCbeTrialLimitsSnapshot,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    return cbeJson({ trialLimits: await getCbeTrialLimitsSnapshot(context) });
  } catch (error) {
    return cbeRouteError(error);
  }
}
