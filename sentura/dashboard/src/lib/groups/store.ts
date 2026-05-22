/**
 * Server-only file-based store for group-chat metadata.
 *
 * Assistant replies are NOT persisted here — each participant agent's
 * gateway session retains its own slice of the conversation in OpenClaw's
 * session JSONL, and the group transcript is rebuilt at mount time by
 * fetching each per-agent `chat.history` and merging by timestamp.
 *
 * What IS persisted here: group-level user messages. A group user message
 * is a single typed input fan-out to N agents, so storing it once on the
 * group record (instead of N times across per-agent transcripts) avoids
 * duplicate-rendering on the merged view.
 *
 * Data file: ~/.openclaw/sentura-group-chats/groups.json
 * Format: { groups: GroupRecord[] }
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { GroupRecord, PersistedUserMessage } from "./types";

export type { GroupRecord, PersistedUserMessage } from "./types";

interface GroupsFile {
  groups: GroupRecord[];
}

const STORE_DIR = path.join(os.homedir(), ".openclaw", "sentura-group-chats");
const STORE_FILE = path.join(STORE_DIR, "groups.json");

async function ensureFile(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    const empty: GroupsFile = { groups: [] };
    await fs.writeFile(STORE_FILE, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readFileRaw(): Promise<GroupsFile> {
  await ensureFile();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as GroupsFile;
    if (!parsed || !Array.isArray(parsed.groups)) {
      return { groups: [] };
    }
    return parsed;
  } catch {
    return { groups: [] };
  }
}

async function writeFileRaw(data: GroupsFile): Promise<void> {
  await ensureFile();
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function generateId(): string {
  return `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listGroups(): Promise<GroupRecord[]> {
  const file = await readFileRaw();
  return file.groups
    .filter((g) => !g.archivedAt)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getGroup(id: string): Promise<GroupRecord | null> {
  const file = await readFileRaw();
  return file.groups.find((g) => g.id === id) ?? null;
}

export interface CreateGroupInput {
  name: string;
  participantAgentIds: string[];
}

export async function createGroup(input: CreateGroupInput): Promise<GroupRecord> {
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("Group name is required");
  if (input.participantAgentIds.length < 2) {
    throw new Error("A group needs at least 2 participants");
  }

  const file = await readFileRaw();
  const record: GroupRecord = {
    id: generateId(),
    name: trimmedName,
    participantAgentIds: [...input.participantAgentIds],
    underlyingSessionKeys: {},
    createdAt: Date.now(),
  };
  file.groups.push(record);
  await writeFileRaw(file);
  return record;
}

/**
 * Persist a session key adopted for a participant. Called by the fan-out
 * route after the first message creates a session for a given agent.
 */
export async function recordSessionKey(
  groupId: string,
  agentId: string,
  sessionKey: string,
): Promise<void> {
  const file = await readFileRaw();
  const group = file.groups.find((g) => g.id === groupId);
  if (!group) throw new Error(`Group ${groupId} not found`);
  group.underlyingSessionKeys[agentId] = sessionKey;
  await writeFileRaw(file);
}

export async function archiveGroup(id: string): Promise<void> {
  const file = await readFileRaw();
  const group = file.groups.find((g) => g.id === id);
  if (!group) return;
  group.archivedAt = Date.now();
  await writeFileRaw(file);
}

/**
 * Append a single user-typed message to a group's persisted transcript.
 * Called by the SSE fan-out route AFTER the group exists but BEFORE the
 * per-agent send so a partial fan-out failure still leaves the user's
 * intent preserved (and re-deliverable on retry).
 */
export async function appendUserMessage(
  groupId: string,
  text: string,
): Promise<PersistedUserMessage> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("user message text is required");

  const file = await readFileRaw();
  const group = file.groups.find((g) => g.id === groupId);
  if (!group) throw new Error(`Group ${groupId} not found`);

  const message: PersistedUserMessage = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: trimmed,
    timestamp: Date.now(),
  };
  const existing = group.messages ?? [];
  group.messages = [...existing, message].sort((a, b) => a.timestamp - b.timestamp);
  await writeFileRaw(file);
  return message;
}

/**
 * Read the persisted user-message slice of a group's transcript. Returns
 * an empty array for groups created before the persistence fix (where
 * `messages` is undefined on disk).
 */
export async function getGroupMessages(
  groupId: string,
): Promise<PersistedUserMessage[]> {
  const file = await readFileRaw();
  const group = file.groups.find((g) => g.id === groupId);
  if (!group) throw new Error(`Group ${groupId} not found`);
  return group.messages ?? [];
}
