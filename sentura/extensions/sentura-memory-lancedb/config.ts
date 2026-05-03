/**
 * Sentura memory-lancedb config.
 *
 * Mirrors `openclaw/extensions/memory-lancedb/config.ts` and adds one
 * Sentura-specific field:
 *
 *   userTokenScope:
 *     "user-plus-global" (default)  — search returns the caller's own entries
 *                                      AND global entries (userToken === "").
 *     "user-only"                    — caller sees ONLY their own entries.
 *     "global-only"                  — partitioning is disabled; behaves like
 *                                      upstream memory-lancedb. Useful for
 *                                      single-tenant deployments that want the
 *                                      Sentura plugin slot without partitioning.
 */

import fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type UserTokenScope = "user-plus-global" | "user-only" | "global-only";

export type MemoryConfig = {
  embedding: {
    provider: "openai";
    model: string;
    apiKey: string;
    baseUrl?: string;
    dimensions?: number;
  };
  dreaming?: Record<string, unknown>;
  dbPath?: string;
  autoCapture?: boolean;
  autoRecall?: boolean;
  userTokenScope: UserTokenScope;
  captureMaxChars?: number;
  storageOptions?: Record<string, string>;
};

export const MEMORY_CATEGORIES = ["preference", "fact", "decision", "entity", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

const DEFAULT_MODEL = "text-embedding-3-small";
export const DEFAULT_CAPTURE_MAX_CHARS = 500;
export const DEFAULT_USER_TOKEN_SCOPE: UserTokenScope = "user-plus-global";
const VALID_USER_TOKEN_SCOPES: readonly UserTokenScope[] = [
  "user-plus-global",
  "user-only",
  "global-only",
];

function resolveDefaultDbPath(): string {
  const home = homedir();
  const preferred = join(home, ".openclaw", "memory", "lancedb");
  try {
    if (fs.existsSync(preferred)) {
      return preferred;
    }
  } catch {
    // best-effort
  }
  return preferred;
}

const DEFAULT_DB_PATH = resolveDefaultDbPath();

const EMBEDDING_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
};

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

export function vectorDimsForModel(model: string): number {
  const dims = EMBEDDING_DIMENSIONS[model];
  if (!dims) {
    throw new Error(`Unsupported embedding model: ${model}`);
  }
  return dims;
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function resolveEmbeddingModel(embedding: Record<string, unknown>): string {
  const model = typeof embedding.model === "string" ? embedding.model : DEFAULT_MODEL;
  if (typeof embedding.dimensions !== "number") {
    vectorDimsForModel(model);
  }
  return model;
}

export const memoryConfigSchema = {
  parse(value: unknown): MemoryConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      [
        "embedding",
        "dreaming",
        "dbPath",
        "autoCapture",
        "autoRecall",
        "userTokenScope",
        "captureMaxChars",
        "storageOptions",
      ],
      "memory config",
    );

    const embedding = cfg.embedding as Record<string, unknown> | undefined;
    if (!embedding || typeof embedding.apiKey !== "string") {
      throw new Error("embedding.apiKey is required");
    }
    assertAllowedKeys(embedding, ["apiKey", "model", "baseUrl", "dimensions"], "embedding config");

    const model = resolveEmbeddingModel(embedding);

    const captureMaxChars =
      typeof cfg.captureMaxChars === "number" ? Math.floor(cfg.captureMaxChars) : undefined;
    if (
      typeof captureMaxChars === "number" &&
      (captureMaxChars < 100 || captureMaxChars > 10_000)
    ) {
      throw new Error("captureMaxChars must be between 100 and 10000");
    }

    let userTokenScope: UserTokenScope = DEFAULT_USER_TOKEN_SCOPE;
    if (typeof cfg.userTokenScope === "string") {
      if (!VALID_USER_TOKEN_SCOPES.includes(cfg.userTokenScope as UserTokenScope)) {
        throw new Error(
          `userTokenScope must be one of: ${VALID_USER_TOKEN_SCOPES.join(", ")}`,
        );
      }
      userTokenScope = cfg.userTokenScope as UserTokenScope;
    }

    const dreaming =
      typeof cfg.dreaming === "undefined"
        ? undefined
        : cfg.dreaming && typeof cfg.dreaming === "object" && !Array.isArray(cfg.dreaming)
          ? (cfg.dreaming as Record<string, unknown>)
          : (() => {
              throw new Error("dreaming config must be an object");
            })();

    let storageOptions: Record<string, string> | undefined;
    const storageOpts = cfg.storageOptions as Record<string, unknown> | undefined;
    if (storageOpts !== undefined && storageOpts !== null) {
      if (!storageOpts || typeof storageOpts !== "object" || Array.isArray(storageOpts)) {
        throw new Error("storageOptions must be an object");
      }
      storageOptions = {};
      for (const [key, value] of Object.entries(storageOpts)) {
        if (typeof value !== "string") {
          throw new Error(`storageOptions.${key} must be a string`);
        }
        storageOptions[key] = resolveEnvVars(value);
      }
    }

    return {
      embedding: {
        provider: "openai",
        model,
        apiKey: resolveEnvVars(embedding.apiKey),
        baseUrl:
          typeof embedding.baseUrl === "string" ? resolveEnvVars(embedding.baseUrl) : undefined,
        dimensions: typeof embedding.dimensions === "number" ? embedding.dimensions : undefined,
      },
      dreaming,
      dbPath: typeof cfg.dbPath === "string" ? cfg.dbPath : DEFAULT_DB_PATH,
      autoCapture: cfg.autoCapture === true,
      autoRecall: cfg.autoRecall !== false,
      userTokenScope,
      captureMaxChars: captureMaxChars ?? DEFAULT_CAPTURE_MAX_CHARS,
      ...(storageOptions ? { storageOptions } : {}),
    };
  },
};
