import { describe, expect, it } from "vitest";
import { classifyDataTier } from "../index.js";

describe("classifyDataTier", () => {
  it("upgrades secret/credential tool calls to T4", () => {
    expect(classifyDataTier("tool_call", { toolName: "secrets_resolve" }, "T1")).toBe("T4");
    expect(classifyDataTier("tool_call", { toolName: "credential_lookup" }, "T1")).toBe("T4");
  });

  it("upgrades approval/provisioning tools to T3", () => {
    expect(classifyDataTier("tool_call", { toolName: "sentura_approval_request" }, "T1")).toBe("T3");
    expect(classifyDataTier("tool_call", { toolName: "provisioner_create" }, "T1")).toBe("T3");
  });

  it("classifies generic tool calls as T2", () => {
    expect(classifyDataTier("tool_call", { toolName: "fs_read" }, "T1")).toBe("T2");
    expect(classifyDataTier("tool_result", { toolName: "browser_navigate" }, "T1")).toBe("T2");
  });

  it("classifies approval and config events as T3", () => {
    expect(classifyDataTier("approval_requested", {}, "T1")).toBe("T3");
    expect(classifyDataTier("approval_resolved", {}, "T1")).toBe("T3");
    expect(classifyDataTier("config_change", {}, "T1")).toBe("T3");
  });

  it("classifies chat traffic as T2 / group lifecycle as T1", () => {
    expect(classifyDataTier("chat_message", {}, "T1")).toBe("T2");
    expect(classifyDataTier("chat_group_fanout", {}, "T1")).toBe("T2");
    expect(classifyDataTier("chat_group_created", {}, "T1")).toBe("T1");
    expect(classifyDataTier("chat_group_archived", {}, "T1")).toBe("T1");
  });

  it("classifies session/gateway/MCP-health events as T1", () => {
    expect(classifyDataTier("session_start", {}, "T0")).toBe("T1");
    expect(classifyDataTier("gateway_start", {}, "T0")).toBe("T1");
    expect(classifyDataTier("mcp_health_check", {}, "T0")).toBe("T1");
  });

  it("falls back to the default tier for unrecognized events", () => {
    expect(classifyDataTier("unknown_event" as never, {}, "T0")).toBe("T0");
  });
});
