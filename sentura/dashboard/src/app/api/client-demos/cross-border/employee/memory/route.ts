import {
  cbeJson,
  cbeRouteError,
  deleteEmployeeMemoryRecords,
  listEmployeeMemoryRecords,
  parseJsonRequest,
  resolveCbeTenantContext,
  DeleteMemoryRecordsRequestSchema,
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

export async function DELETE(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, DeleteMemoryRecordsRequestSchema);
    return cbeJson(await deleteEmployeeMemoryRecords(context, body.ids));
  } catch (error) {
    return cbeRouteError(error);
  }
}
