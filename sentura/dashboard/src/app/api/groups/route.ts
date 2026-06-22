/**
 * Groups CRUD endpoint.
 *
 *   GET  /api/groups          → { groups: GroupRecord[] }
 *   POST /api/groups          { name, participantAgentIds[] }
 *                             → { group: GroupRecord }
 *
 * Persists to ~/.openclaw/sentura-group-chats/groups.json via lib/groups/store.
 */

import { NextResponse } from "next/server";
import { createGroup, listGroups } from "@/lib/groups/store";

export async function GET() {
  try {
    const groups = await listGroups();
    return NextResponse.json({ groups });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list groups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { name?: string; participantAgentIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const participantAgentIds = Array.isArray(body.participantAgentIds)
    ? body.participantAgentIds.filter((s): s is string => typeof s === "string")
    : [];

  if (!name.trim()) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }
  if (participantAgentIds.length < 2) {
    return NextResponse.json(
      { error: "A group needs at least 2 participants" },
      { status: 400 },
    );
  }

  try {
    const group = await createGroup({ name, participantAgentIds });
    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
