import {
  cbeJson,
  cbeRouteError,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const role = new URL(request.url).searchParams.get("role");
    const expectedRole = role === "admin" || role === "operator" ? role : undefined;
    const context = await resolveCbeTenantContext(request, { expectedRole });
    return cbeJson({
      user: {
        id: context.userId,
        displayName: context.displayName,
        cbeRole: context.cbeRole,
        teamName: context.teamName ?? null,
        departmentId: context.departmentId ?? null,
      },
      redirectTo: context.cbeRole === "admin"
        ? "/client-demos/cross-border/admin/employees"
        : "/client-demos/cross-border/employee",
    });
  } catch (error) {
    return cbeRouteError(error);
  }
}
