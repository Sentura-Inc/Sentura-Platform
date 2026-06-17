import {
  cbeJson,
  cbeRouteError,
  CompleteLeadRunRequestSchema,
  failLeadCompletion,
  readJsonRequest,
  resolveCbeTenantContext,
  saveLeadRunResult,
} from "@/lib/cross-border-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function stringField(body: unknown, key: string) {
  return body && typeof body === "object" && key in body && typeof (body as Record<string, unknown>)[key] === "string"
    ? String((body as Record<string, unknown>)[key])
    : undefined;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveCbeTenantContext(request);
    const { id } = await params;
    const body = await readJsonRequest(request);
    const parsed = CompleteLeadRunRequestSchema.safeParse(body);
    if (!parsed.success) {
      const agentRunId = stringField(body, "agent_run_id");
      if (agentRunId) {
        await failLeadCompletion(context, {
          agentRunId,
          sessionKey: stringField(body, "session_key"),
          message: "Lead marker payload failed validation.",
          details: parsed.error.flatten(),
        });
      }
      return cbeJson({ error: { code: "validation_failed", details: parsed.error.flatten() } }, 400);
    }
    return cbeJson(await saveLeadRunResult(context, id, parsed.data));
  } catch (error) {
    return cbeRouteError(error);
  }
}
