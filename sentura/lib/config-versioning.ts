import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveOpenClawLogsDir } from "./openclaw-paths.ts";

export type SenturaConfigDiffTarget =
  | "openclaw.config"
  | "agent.config"
  | "secrets.file";

export interface SenturaConfigDiffRecord {
  ts: string;
  operation: string;
  actor?: string;
  note?: string;
  targetType: SenturaConfigDiffTarget;
  targetPath: string;
  agentId?: string;
  sessionKey?: string;
  baseHash: string;
  nextHash: string;
  changedPaths: string[];
  before: unknown;
  after: unknown;
}

export interface AppendSenturaConfigDiffOptions {
  operation: string;
  targetType: SenturaConfigDiffTarget;
  targetPath: string;
  beforeValue: unknown;
  afterValue: unknown;
  actor?: string;
  note?: string;
  agentId?: string;
  sessionKey?: string;
  changedPaths?: string[];
  logPath?: string;
}

const REDACTED = "[REDACTED]";
const ROOT_PATH = "(root)";
const SENSITIVE_KEY_RE = /(secret|token|password|api[_-]?key|authorization|cookie|credential)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableClone);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableClone(value[key])]),
  );
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(stableClone(value));
}

function hashValue(value: unknown): string {
  return crypto.createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function isSecretPointer(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("$secret:");
}

function redactValue(value: unknown, targetType: SenturaConfigDiffTarget, pathKey = ""): unknown {
  if (targetType === "secrets.file") {
    if (Array.isArray(value)) {
      return value.map((entry) => redactValue(entry, targetType, pathKey));
    }
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, redactValue(entry, targetType, key)]),
      );
    }
    return value === undefined ? undefined : REDACTED;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, targetType, pathKey));
  }
  if (!isRecord(value)) {
    if (isSecretPointer(value)) {
      return value;
    }
    if (typeof value === "string" && SENSITIVE_KEY_RE.test(pathKey)) {
      return REDACTED;
    }
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (SENSITIVE_KEY_RE.test(key)) {
        return [key, REDACTED];
      }
      return [key, redactValue(entry, targetType, key)];
    }),
  );
}

function collectChangedPaths(beforeValue: unknown, afterValue: unknown, currentPath = ""): string[] {
  if (stableSerialize(beforeValue) === stableSerialize(afterValue)) {
    return [];
  }
  if (Array.isArray(beforeValue) || Array.isArray(afterValue)) {
    return [currentPath || ROOT_PATH];
  }
  if (isRecord(beforeValue) && isRecord(afterValue)) {
    const keys = new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)]);
    const next = [...keys]
      .toSorted()
      .flatMap((key) =>
        collectChangedPaths(
          beforeValue[key],
          afterValue[key],
          currentPath ? `${currentPath}.${key}` : key,
        ),
      );
    return next.length > 0 ? next : [currentPath || ROOT_PATH];
  }
  return [currentPath || ROOT_PATH];
}

function getAtPath(value: unknown, pathValue: string): unknown {
  if (pathValue === ROOT_PATH || pathValue.length === 0) {
    return value;
  }
  const segments = pathValue.split(".");
  let current: unknown = value;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function setAtPath(target: Record<string, unknown>, pathValue: string, value: unknown) {
  if (pathValue === ROOT_PATH || pathValue.length === 0) {
    if (isRecord(value)) {
      Object.assign(target, value);
    } else {
      target[ROOT_PATH] = value;
    }
    return;
  }
  const segments = pathValue.split(".");
  let current = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const existing = current[segment];
    if (!isRecord(existing)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

function buildSparseProjection(value: unknown, changedPaths: string[]): unknown {
  if (changedPaths.includes(ROOT_PATH)) {
    return value;
  }
  const projected: Record<string, unknown> = {};
  for (const changedPath of changedPaths) {
    const entry = getAtPath(value, changedPath);
    setAtPath(projected, changedPath, entry);
  }
  return projected;
}

export function resolveSenturaConfigDiffLogPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveOpenClawLogsDir(env), "sentura-config-diffs.jsonl");
}

export function resolveSenturaConfigDiffLogPathFromOpenClawDir(openclawDir: string): string {
  return path.join(openclawDir, "logs", "sentura-config-diffs.jsonl");
}

export async function appendSenturaConfigDiff(
  options: AppendSenturaConfigDiffOptions,
): Promise<SenturaConfigDiffRecord | null> {
  const changedPaths = (options.changedPaths ?? collectChangedPaths(options.beforeValue, options.afterValue))
    .filter((entry, index, array) => entry && array.indexOf(entry) === index)
    .toSorted();
  if (changedPaths.length === 0) {
    return null;
  }

  const record: SenturaConfigDiffRecord = {
    ts: new Date().toISOString(),
    operation: options.operation,
    actor: options.actor,
    note: options.note,
    targetType: options.targetType,
    targetPath: options.targetPath,
    agentId: options.agentId,
    sessionKey: options.sessionKey,
    baseHash: hashValue(options.beforeValue),
    nextHash: hashValue(options.afterValue),
    changedPaths,
    before: redactValue(
      buildSparseProjection(options.beforeValue, changedPaths),
      options.targetType,
    ),
    after: redactValue(
      buildSparseProjection(options.afterValue, changedPaths),
      options.targetType,
    ),
  };

  const logPath = options.logPath ?? resolveSenturaConfigDiffLogPath();
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}
