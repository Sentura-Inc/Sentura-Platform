/**
 * Groups CRUD endpoint.
 *
 *   GET  /api/groups          → { groups: GroupRecord[] }
 *   POST /api/groups          { name, participantAgentIds[] }
 *                             → { group: GroupRecord }
 *
 * Auth: server-side check via `checkServerPermission`. Hard-hide on the
 * client is UI shaping only — the cookie-asserted role is the boundary
 * here. When SSO ships (W6+), the cookie becomes a signed session token.
 *
 * Persists to ~/.openclaw/sentura-group-chats/groups.json via lib/groups/store.
 */

import { NextResponse } from "next/server";
import { createGroup, listGroups, MAX_PARTICIPANTS } from "@/lib/groups/store";
import { checkServerPermission } from "@/lib/auth/server-role";
import { badRequestResponse, internalErrorResponse } from "@/lib/api/errors";

export async function GET(request: Request) {
  const denied = checkServerPermission(request, "agents.read");
  if (denied) {
    return NextResponse.json(
      { error: `Forbidden: ${denied.role} lacks ${denied.action}` },
      { status: 403 },
    );
  }
  try {
    const groups = await listGroups();
    return NextResponse.json({ groups });
  } catch (err) {
    return internalErrorResponse("Failed to list groups", err);
  }
}

export async function POST(request: Request) {
  const denied = checkServerPermission(request, "agents.tune");
  if (denied) {
    return NextResponse.json(
      { error: `Forbidden: ${denied.role} lacks ${denied.action}` },
      { status: 403 },
    );
  }

  let body: { name?: string; participantAgentIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  const name = typeof body.name === "string" ? body.name : "";
  const participantAgentIds = Array.isArray(body.participantAgentIds)
    ? body.participantAgentIds.filter((s): s is string => typeof s === "string")
    : [];

  if (!name.trim()) {
    return badRequestResponse("Group name is required");
  }
  if (participantAgentIds.length < 2) {
    return badRequestResponse("A group needs at least 2 participants");
  }
  if (participantAgentIds.length > MAX_PARTICIPANTS) {
    return badRequestResponse(
      `A group cannot have more than ${MAX_PARTICIPANTS} participants`,
    );
  }
  // Reject duplicates so fan-out doesn't hit the same agent twice.
  const unique = new Set(participantAgentIds);
  if (unique.size !== participantAgentIds.length) {
    return badRequestResponse("Duplicate participantAgentIds");
  }

  try {
    const group = await createGroup({ name, participantAgentIds });
    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    return internalErrorResponse("Failed to create group", err);
  }
}
