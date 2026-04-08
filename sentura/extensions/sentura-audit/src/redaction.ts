const DEFAULT_SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /authorization/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /session[_-]?id/i,
  /cookie/i,
];

export function createRedactor(extraPatterns: string[] = []): (obj: unknown) => unknown {
  const allPatterns = [
    ...DEFAULT_SENSITIVE_PATTERNS,
    ...extraPatterns.map((p) => new RegExp(p, "i")),
  ];

  function isSensitiveKey(key: string): boolean {
    return allPatterns.some((pattern) => pattern.test(key));
  }

  function redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[deep nested]";

    if (value === null || value === undefined) return value;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return value;

    if (Array.isArray(value)) {
      return value.map((item) => redact(item, depth + 1));
    }

    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (isSensitiveKey(key)) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = redact(val, depth + 1);
        }
      }
      return result;
    }

    return String(value);
  }

  return redact;
}
