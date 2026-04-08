import { describe, expect, it } from "vitest";
import { createRedactor } from "./redaction.js";

describe("createRedactor", () => {
  const redact = createRedactor();

  it("redacts fields matching default sensitive patterns", () => {
    const input = {
      apiKey: "sk-12345",
      password: "hunter2",
      token: "tok_abc",
      name: "Alice",
    };
    const result = redact(input) as Record<string, unknown>;
    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.token).toBe("[REDACTED]");
    expect(result.name).toBe("Alice");
  });

  it("handles nested objects", () => {
    const input = {
      config: {
        secretKey: "my-secret",
        host: "localhost",
      },
    };
    const result = redact(input) as { config: Record<string, unknown> };
    expect(result.config.secretKey).toBe("[REDACTED]");
    expect(result.config.host).toBe("localhost");
  });

  it("handles arrays", () => {
    const input = [
      { api_key: "key1", value: "safe" },
      { credential: "cred1", label: "ok" },
    ];
    const result = redact(input) as Array<Record<string, unknown>>;
    expect(result[0].api_key).toBe("[REDACTED]");
    expect(result[0].value).toBe("safe");
    expect(result[1].credential).toBe("[REDACTED]");
    expect(result[1].label).toBe("ok");
  });

  it("returns primitives unchanged", () => {
    expect(redact("hello")).toBe("hello");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(undefined);
    expect(redact(true)).toBe(true);
  });

  it("accepts custom patterns", () => {
    const customRedact = createRedactor(["customField"]);
    const input = { customField: "sensitive", normalField: "ok" };
    const result = customRedact(input) as Record<string, unknown>;
    expect(result.customField).toBe("[REDACTED]");
    expect(result.normalField).toBe("ok");
  });

  it("is case-insensitive for field matching", () => {
    const input = {
      API_KEY: "key",
      Password: "pass",
      SECRET_TOKEN: "tok",
    };
    const result = redact(input) as Record<string, unknown>;
    expect(result.API_KEY).toBe("[REDACTED]");
    expect(result.Password).toBe("[REDACTED]");
    expect(result.SECRET_TOKEN).toBe("[REDACTED]");
  });
});
