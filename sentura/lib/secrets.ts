import fs from "node:fs/promises";
import path from "node:path";
import {
  appendSenturaConfigDiff,
  resolveSenturaConfigDiffLogPathFromOpenClawDir,
  type SenturaConfigDiffRecord,
} from "./config-versioning.ts";
import { resolveOpenClawConfigPath } from "./openclaw-paths.ts";

export interface SenturaSecretRef {
  source: "file";
  provider: "default";
  id: string;
}

export interface EnsureSenturaSecretProviderResult {
  providerAlias: "default";
  configPath: string;
  secretsFilePath: string;
  created: boolean;
  updated: boolean;
  diffRecord: SenturaConfigDiffRecord | null;
}

export interface PutSenturaSecretOptions {
  agentId: string;
  service: string;
  credential: string;
  value: string;
  configPath?: string;
  actor?: string;
  note?: string;
}

export interface PutSenturaSecretResult {
  ok: true;
  secretId: string;
  pointer: string;
  ref: SenturaSecretRef;
  created: boolean;
  provider: EnsureSenturaSecretProviderResult;
  secretsFilePath: string;
  diffRecord: SenturaConfigDiffRecord | null;
}

export interface HasSenturaSecretOptions {
  agentId: string;
  service: string;
  credential: string;
  configPath?: string;
}

export interface HasSenturaSecretResult {
  ok: true;
  exists: boolean;
  secretId: string;
  pointer: string;
  ref: SenturaSecretRef;
  secretsFilePath: string;
}

const SENTURA_SECRET_POINTER_PREFIX = "$secret:";
const SAFE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSegment(label: string, value: string): string {
  const trimmed = value.trim();
  if (!SAFE_SEGMENT_RE.test(trimmed)) {
    throw new Error(
      `${label} must match /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/; received "${value}".`,
    );
  }
  return trimmed;
}

function secretIdSegments(secretId: string): string[] {
  return secretId.replace(/^\/+/, "").split("/").filter(Boolean);
}

function getNestedValue(root: Record<string, unknown>, segments: string[]): unknown {
  let current: unknown = root;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function setNestedValue(root: Record<string, unknown>, segments: string[], value: string) {
  let current = root;
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

async function ensurePrivateSecretFile(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    await fs.access(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
    await fs.writeFile(filePath, "{}\n", { encoding: "utf8", mode: 0o600 });
  }
  if (process.platform !== "win32") {
    await fs.chmod(path.dirname(filePath), 0o700).catch(() => {});
    await fs.chmod(filePath, 0o600).catch(() => {});
  }
}

async function readJsonFileIfExists(
  filePath: string,
): Promise<{ raw: string | null; parsed: Record<string, unknown>; existed: boolean }> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error(`${filePath} must contain a JSON object.`);
    }
    return { raw, parsed, existed: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { raw: null, parsed: {}, existed: false };
    }
    throw err;
  }
}

export function buildSenturaSecretId(
  agentId: string,
  service: string,
  credential: string,
): string {
  return [
    "",
    "sentura",
    "agents",
    validateSegment("agentId", agentId),
    validateSegment("service", service),
    validateSegment("credential", credential),
  ].join("/");
}

export function buildSenturaSecretPointer(secretId: string): string {
  return `${SENTURA_SECRET_POINTER_PREFIX}${secretId}`;
}

export function parseSenturaSecretPointer(pointer: string): string | null {
  if (!pointer.startsWith(SENTURA_SECRET_POINTER_PREFIX)) {
    return null;
  }
  const secretId = pointer.slice(SENTURA_SECRET_POINTER_PREFIX.length).trim();
  return secretId.startsWith("/") ? secretId : null;
}

export function buildSenturaSecretRef(secretId: string): SenturaSecretRef {
  return {
    source: "file",
    provider: "default",
    id: secretId,
  };
}

export async function ensureSenturaSecretProvider(
  configPath = resolveOpenClawConfigPath(),
): Promise<EnsureSenturaSecretProviderResult> {
  const openclawDir = path.dirname(configPath);
  const secretsFilePath = path.join(openclawDir, "secrets.json");
  const { parsed: beforeConfig, existed } = await readJsonFileIfExists(configPath);
  if (!existed) {
    throw new Error(`OpenClaw config not found at ${configPath}.`);
  }

  const beforeProvider = isRecord(beforeConfig.secrets)
    && isRecord(beforeConfig.secrets.providers)
    && isRecord(beforeConfig.secrets.providers.default)
    ? (beforeConfig.secrets.providers.default as Record<string, unknown>)
    : undefined;

  const desiredProvider = {
    source: "file",
    path: secretsFilePath,
    mode: "json",
  };

  const alreadyConfigured =
    beforeProvider?.source === desiredProvider.source
    && beforeProvider?.path === desiredProvider.path
    && beforeProvider?.mode === desiredProvider.mode;

  if (alreadyConfigured) {
    return {
      providerAlias: "default",
      configPath,
      secretsFilePath,
      created: false,
      updated: false,
      diffRecord: null,
    };
  }

  const nextConfig = structuredClone(beforeConfig);
  if (!isRecord(nextConfig.secrets)) {
    nextConfig.secrets = {};
  }
  const secretsRoot = nextConfig.secrets as Record<string, unknown>;
  if (!isRecord(secretsRoot.providers)) {
    secretsRoot.providers = {};
  }
  const providers = secretsRoot.providers as Record<string, unknown>;
  const created = !isRecord(providers.default);
  providers.default = desiredProvider;

  await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  const diffRecord = await appendSenturaConfigDiff({
    operation: "sentura.ensure_secret_provider",
    actor: "sentura.lib.secrets",
    note: "Ensure default file secret provider for Sentura self-provisioning.",
    targetType: "openclaw.config",
    targetPath: configPath,
    beforeValue: { secrets: beforeConfig.secrets ?? {} },
    afterValue: { secrets: nextConfig.secrets ?? {} },
    logPath: resolveSenturaConfigDiffLogPathFromOpenClawDir(openclawDir),
  });

  return {
    providerAlias: "default",
    configPath,
    secretsFilePath,
    created,
    updated: true,
    diffRecord,
  };
}

export async function putSenturaSecret(
  options: PutSenturaSecretOptions,
): Promise<PutSenturaSecretResult> {
  const value = options.value;
  if (!value.trim()) {
    throw new Error("Secret value must be a non-empty string.");
  }

  const secretId = buildSenturaSecretId(options.agentId, options.service, options.credential);
  const pointer = buildSenturaSecretPointer(secretId);
  const ref = buildSenturaSecretRef(secretId);
  const provider = await ensureSenturaSecretProvider(options.configPath);
  const openclawDir = path.dirname(provider.configPath);
  await ensurePrivateSecretFile(provider.secretsFilePath);

  const beforeStore = await readJsonFileIfExists(provider.secretsFilePath);
  const nextStore = structuredClone(beforeStore.parsed);
  const segments = secretIdSegments(secretId);
  const previousValue = getNestedValue(nextStore, segments);
  setNestedValue(nextStore, segments, value);

  await fs.writeFile(
    provider.secretsFilePath,
    `${JSON.stringify(nextStore, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  if (process.platform !== "win32") {
    await fs.chmod(provider.secretsFilePath, 0o600).catch(() => {});
  }

  const diffRecord = await appendSenturaConfigDiff({
    operation: "sentura.put_secret",
    actor: options.actor,
    note: options.note ?? `Write secret pointer ${pointer}.`,
    targetType: "secrets.file",
    targetPath: provider.secretsFilePath,
    beforeValue: beforeStore.parsed,
    afterValue: nextStore,
    logPath: resolveSenturaConfigDiffLogPathFromOpenClawDir(openclawDir),
  });

  return {
    ok: true,
    secretId,
    pointer,
    ref,
    created: typeof previousValue !== "string",
    provider,
    secretsFilePath: provider.secretsFilePath,
    diffRecord,
  };
}

export async function hasSenturaSecret(
  options: HasSenturaSecretOptions,
): Promise<HasSenturaSecretResult> {
  const secretId = buildSenturaSecretId(options.agentId, options.service, options.credential);
  const pointer = buildSenturaSecretPointer(secretId);
  const ref = buildSenturaSecretRef(secretId);
  const provider = await ensureSenturaSecretProvider(options.configPath);
  const store = await readJsonFileIfExists(provider.secretsFilePath);
  const value = getNestedValue(store.parsed, secretIdSegments(secretId));
  return {
    ok: true,
    exists: typeof value === "string" && value.trim().length > 0,
    secretId,
    pointer,
    ref,
    secretsFilePath: provider.secretsFilePath,
  };
}

export async function resolveSenturaSecretPointer(
  pointer: string,
  configPath = resolveOpenClawConfigPath(),
): Promise<string | undefined> {
  const secretId = parseSenturaSecretPointer(pointer);
  if (!secretId) {
    return undefined;
  }
  const provider = await ensureSenturaSecretProvider(configPath);
  const store = await readJsonFileIfExists(provider.secretsFilePath);
  const value = getNestedValue(store.parsed, secretIdSegments(secretId));
  return typeof value === "string" ? value : undefined;
}
