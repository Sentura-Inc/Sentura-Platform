import {
  cbeJson,
  cbeRouteError,
  CreateAccioImportRequestSchema,
  parseJsonRequest,
  resolveCbeTenantContext,
  saveAccioImport,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, CreateAccioImportRequestSchema);
    return cbeJson(await saveAccioImport(context, body), 201);
  } catch (error) {
    return cbeRouteError(error);
  }
}
