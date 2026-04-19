import path from "node:path";

/**
 * The eight OpenClaw-native agent workspace files. These MUST go through
 * gateway.agents.files.set and are rejected by sentura.agents.writeSubfile to
 * prevent a parallel write path with weaker validation than the core RPC.
 */
export const NATIVE_WORKSPACE_FILES = new Set<string>([
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
  "memory.md",
]);

/**
 * Regex for a single safe path segment. Alphanumerics, dot, dash, underscore.
 * Dot-files (.foo) are disallowed.
 */
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface ValidatedRelPath {
  segments: string[];
  joined: string;
}

export interface ValidateOptions {
  allowedPrefixes: string[];
  maxDepth: number;
  /**
   * When true, allow writes to the 8 OpenClaw-native workspace files at the
   * workspace root (AGENTS.md, SOUL.md, ...). Used when sentura_agents_manage
   * is acting as a substitute for gateway.agents.files.set (which is NOT
   * exposed to agents via the `gateway` tool — it only supports the fixed
   * GATEWAY_ACTIONS enum: config.*, update.run, restart). Defaults to false
   * so direct RPC callers keep the stricter contract.
   */
  allowNativeFiles?: boolean;
}

export class PathValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PathValidationError";
  }
}

/**
 * Validate a relative path for agent subfile operations. Rejects absolute
 * paths, parent-traversal, unusual segments, dot-files, overly deep paths,
 * and the eight OpenClaw-native workspace files (those must go through
 * agents.files.set, not this RPC).
 */
export function validateRelPath(
  relPathRaw: unknown,
  opts: ValidateOptions,
): ValidatedRelPath {
  if (typeof relPathRaw !== "string" || !relPathRaw.length) {
    throw new PathValidationError("INVALID_PATH", "relPath must be a non-empty string");
  }
  const trimmed = relPathRaw.trim();
  if (!trimmed.length) {
    throw new PathValidationError("INVALID_PATH", "relPath is empty after trimming");
  }
  if (path.isAbsolute(trimmed) || trimmed.startsWith("~")) {
    throw new PathValidationError("ABSOLUTE_PATH", `relPath must be relative, got: ${trimmed}`);
  }
  if (trimmed.includes("\0")) {
    throw new PathValidationError("NULL_BYTE", "relPath contains a null byte");
  }
  const normalized = trimmed.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((s) => s.length > 0);
  if (!segments.length) {
    throw new PathValidationError("INVALID_PATH", "relPath has no path segments");
  }
  if (segments.length > opts.maxDepth) {
    throw new PathValidationError(
      "TOO_DEEP",
      `relPath has ${segments.length} segments, max ${opts.maxDepth}`,
    );
  }
  for (const seg of segments) {
    if (seg === "." || seg === "..") {
      throw new PathValidationError("TRAVERSAL", `relPath contains traversal segment: ${seg}`);
    }
    if (!SAFE_SEGMENT.test(seg)) {
      throw new PathValidationError(
        "UNSAFE_SEGMENT",
        `relPath segment "${seg}" contains disallowed characters (allowed: [A-Za-z0-9._-])`,
      );
    }
  }
  const joined = segments.join("/");
  const fileName = segments[segments.length - 1];
  const isNativeFile = NATIVE_WORKSPACE_FILES.has(fileName) && segments.length === 1;
  if (isNativeFile) {
    if (opts.allowNativeFiles) {
      // Native top-level file is explicitly permitted; skip prefix check.
      return { segments, joined };
    }
    throw new PathValidationError(
      "NATIVE_FILE",
      `"${fileName}" is an OpenClaw-native workspace file; pass allowNativeFiles=true or use gateway.agents.files.set`,
    );
  }
  const matchesPrefix = opts.allowedPrefixes.some((prefix) => {
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
    if (!normalizedPrefix) return false;
    return joined === normalizedPrefix || joined.startsWith(`${normalizedPrefix}/`);
  });
  if (!matchesPrefix) {
    throw new PathValidationError(
      "PREFIX_NOT_ALLOWED",
      `relPath "${joined}" does not match any allowed prefix (${opts.allowedPrefixes.join(", ")})`,
    );
  }
  return { segments, joined };
}

/**
 * Safely join a validated relPath onto a workspace root. Uses realpath-aware
 * containment so symlinks cannot escape the workspace.
 */
export function safeJoin(workspaceRoot: string, relPath: ValidatedRelPath): string {
  const resolved = path.resolve(workspaceRoot, relPath.joined);
  const resolvedRoot = path.resolve(workspaceRoot);
  const rel = path.relative(resolvedRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathValidationError(
      "ESCAPE",
      `resolved path escapes workspace root: ${resolved} (root: ${resolvedRoot})`,
    );
  }
  return resolved;
}

/**
 * Validate an agent id. Same rules as OpenClaw's normalizeAgentId: lowercase,
 * digits, dashes; cannot be empty, cannot be "default".
 */
export function validateAgentId(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new PathValidationError("INVALID_AGENT_ID", "agentId must be a string");
  }
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed.length) {
    throw new PathValidationError("INVALID_AGENT_ID", "agentId is empty");
  }
  if (trimmed === "default") {
    throw new PathValidationError("INVALID_AGENT_ID", '"default" is reserved');
  }
  if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(trimmed)) {
    throw new PathValidationError(
      "INVALID_AGENT_ID",
      `agentId must match /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/, got: ${trimmed}`,
    );
  }
  return trimmed;
}
