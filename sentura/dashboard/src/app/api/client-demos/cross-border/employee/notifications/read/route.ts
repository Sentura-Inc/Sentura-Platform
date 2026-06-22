import {
  cbeJson,
  cbeRouteError,
  getCbePool,
  markEmployeeNotificationsRead,
  NotificationReadRequestSchema,
  parseJsonRequest,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, NotificationReadRequestSchema);
    return cbeJson(await markEmployeeNotificationsRead(getCbePool(), context, body.ids));
  } catch (error) {
    return cbeRouteError(error);
  }
}
