import {
  cbeJson,
  cbeRouteError,
  resolveCbeTenantContext,
} from "@/lib/cross-border-store";
import {
  CBE_ADMIN_EMPLOYEES_PATH,
  CBE_EMPLOYEE_HOME_PATH,
} from "@/lib/cross-border-routes";

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
        ? CBE_ADMIN_EMPLOYEES_PATH
        : CBE_EMPLOYEE_HOME_PATH,
    });
  } catch (error) {
    return cbeRouteError(error);
  }
}
