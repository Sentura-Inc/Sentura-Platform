import {
  cbeJson,
  cbeRouteError,
  countUnreadEmployeeNotifications,
  deleteEmployeeNotifications,
  getCbePool,
  listEmployeeNotifications,
  NotificationDeleteRequestSchema,
  ListQuerySchema,
  parseJsonRequest,
  parseListQuery,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const query = parseListQuery(request, ListQuerySchema);
    const page = await listEmployeeNotifications(context, query);
    const unreadCount = await countUnreadEmployeeNotifications(context);
    return cbeJson({ ...page, unreadCount });
  } catch (error) {
    return cbeRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    const body = await parseJsonRequest(request, NotificationDeleteRequestSchema);
    return cbeJson(await deleteEmployeeNotifications(getCbePool(), context, body.ids));
  } catch (error) {
    return cbeRouteError(error);
  }
}
