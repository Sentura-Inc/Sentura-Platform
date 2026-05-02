import { describe, expect, it } from "vitest";
import {
  extractAgentIdFromSessionKey,
  extractUserTokenFromSessionKey,
} from "./session.js";

describe("extractUserTokenFromSessionKey", () => {
  it("extracts a UUID userToken from a Sentura session key", () => {
    const key = "agent:ap-clerk:user:11111111-2222-3333-4444-555555555555:abc123";
    expect(extractUserTokenFromSessionKey(key)).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
  });

  it("returns empty string for raw OpenClaw CLI session keys", () => {
    expect(extractUserTokenFromSessionKey("session-12345")).toBe("");
  });

  it("returns empty string for agent:<id>:cli:<...> (non-Sentura session)", () => {
    expect(extractUserTokenFromSessionKey("agent:cs-agent:cli:xyz")).toBe("");
  });

  it("returns empty string for undefined / null / empty", () => {
    expect(extractUserTokenFromSessionKey(undefined)).toBe("");
    expect(extractUserTokenFromSessionKey(null)).toBe("");
    expect(extractUserTokenFromSessionKey("")).toBe("");
  });

  it("does not confuse a userToken segment that happens to contain digits", () => {
    const key = "agent:cs-agent:user:00000000-0000-0000-0000-000000000000:s1";
    expect(extractUserTokenFromSessionKey(key)).toBe(
      "00000000-0000-0000-0000-000000000000",
    );
  });
});

describe("extractAgentIdFromSessionKey", () => {
  it("extracts agentId from a Sentura session key", () => {
    expect(
      extractAgentIdFromSessionKey(
        "agent:ap-clerk:user:11111111-2222-3333-4444-555555555555:abc",
      ),
    ).toBe("ap-clerk");
  });

  it("extracts agentId from a non-Sentura agent: session", () => {
    expect(extractAgentIdFromSessionKey("agent:cs-agent:cli:xyz")).toBe("cs-agent");
  });

  it("returns null for non-agent session keys", () => {
    expect(extractAgentIdFromSessionKey("session-12345")).toBeNull();
  });
});
