import {
  cbeJson,
  cbeRouteError,
  listEmployeeMemoryRecords,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    return cbeJson(await listEmployeeMemoryRecords(context));
  } catch (error) {
    return cbeRouteError(error);
  }
}
