/**
 * Server-only file-based store for group-chat metadata.
 *
 * Group transcripts are NOT persisted here — each participant agent's
 * gateway session retains its own slice of the conversation. The group
 * view is a per-tab ephemeral merge of in-flight responses.
 *
 * Data file: ~/.openclaw/sentura-group-chats/groups.json
 * Format: { groups: GroupRecord[] }
 *
 * Concurrency: every mutation goes through `withLock` (F2.8). Without
 * this, parallel `recordSessionKey` calls during a 3-agent fan-out's
 * read-modify-write cycle would drop session-key records.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { GroupRecord } from "./types";

export type { GroupRecord } from "./types";

interface GroupsFile {
  groups: GroupRecord[];
}

const STORE_DIR = path.join(os.homedir(), ".openclaw", "sentura-group-chats");
const STORE_FILE = path.join(STORE_DIR, "groups.json");

/** F2.7: cap participants so a 100-agent group can't blast the gateway. */
export const MAX_PARTICIPANTS = 8;

/**
 * Single in-process write queue. Read-only operations (listGroups, getGroup)
 * don't need the lock; only mutations do. The lock is intentionally
 * coarse — one writer at a time across the whole file — because the file
 * is tiny and contention is bounded.
 */
let _writeQueue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = _writeQueue.then(fn, fn);
  // Keep the chain alive even if `fn` rejects, so the next caller can run.
  _writeQueue = next.catch(() => {});
  return next;
}

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
  if (input.participantAgentIds.length > MAX_PARTICIPANTS) {
    throw new Error(
      `A group cannot have more than ${MAX_PARTICIPANTS} participants`,
    );
  }

  return withLock(async () => {
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
  });
}

/**
 * Persist a session key adopted for a participant. Called by the fan-out
 * route after the first message creates a session for a given agent.
 *
 * F2.8: serialized via `withLock` — without this, parallel calls during a
 * 3-agent first fan-out would race on the read-modify-write cycle and
 * silently drop one or more session-key records.
 */
export async function recordSessionKey(
  groupId: string,
  agentId: string,
  sessionKey: string,
): Promise<void> {
  await withLock(async () => {
    const file = await readFileRaw();
    const group = file.groups.find((g) => g.id === groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    if (group.archivedAt) {
      throw new Error(`Group ${groupId} is archived`);
    }
    group.underlyingSessionKeys[agentId] = sessionKey;
    await writeFileRaw(file);
  });
}

export async function archiveGroup(id: string): Promise<void> {
  await withLock(async () => {
    const file = await readFileRaw();
    const group = file.groups.find((g) => g.id === id);
    if (!group) return;
    group.archivedAt = Date.now();
    await writeFileRaw(file);
  });
}
