import {
  cbeJson,
  cbeRouteError,
  AdminBatchDeleteOperatorsRequestSchema,
  AdminCreateOperatorRequestSchema,
  listAdminOperators,
  parseJsonRequest,
  requireCbeAdmin,
  resolveCbeTenantContext,
  deleteAdminOperator,
  upsertAdminOperatorProfile,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreatedOperatorIdentity = {
  id: string;
  email?: string;
  role?: string;
};

function createLocalOperatorIdentity(
  input: { display_name: string; email?: string; department_id?: string },
): CreatedOperatorIdentity {
  const email = input.email ?? `${crypto.randomUUID()}@cbe.local`;
  const userId = `cbe-user-operator-${crypto.randomUUID()}`;
  return { id: userId, email, role: "end_user" };
}

export async function GET(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    return cbeJson(await listAdminOperators(context));
  } catch (error) {
    return cbeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const body = await parseJsonRequest(request, AdminCreateOperatorRequestSchema);
    const platformUser = createLocalOperatorIdentity(body);
    const operator = await upsertAdminOperatorProfile(context, {
      ...body,
      user_id: platformUser.id,
      email: platformUser.email ?? body.email,
      platform_role: platformUser.role ?? "end_user",
    });
    return cbeJson({
      operator,
      tokenDisplayPolicy: "password_only",
    }, 201);
  } catch (error) {
    return cbeRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await resolveCbeTenantContext(request);
    requireCbeAdmin(context);
    const body = await parseJsonRequest(request, AdminBatchDeleteOperatorsRequestSchema);
    const userIds = Array.from(new Set(body.user_ids.map((id) => id.trim()).filter(Boolean)));
    const deleted = [];
    for (const userId of userIds) {
      deleted.push(await deleteAdminOperator(context, userId));
    }
    return cbeJson({ items: deleted });
  } catch (error) {
    return cbeRouteError(error);
  }
}
