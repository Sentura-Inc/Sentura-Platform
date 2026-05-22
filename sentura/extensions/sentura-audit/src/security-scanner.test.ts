import { describe, expect, it } from "vitest";
import { scan, summarize, type OpenClawConfigShape } from "./security-scanner.js";

const goodAgent = {
  id: "cs-agent",
  sandbox: { mode: "non-main" },
  tools: { profile: "messaging", allow: ["chat", "memory_search"] },
  channels: { bindings: [{ channelId: "webchat" }] },
  escalateTo: "Henry Zhang",
} as const;

const goodWorkspace =
  "# AGENTS.md\n## Hard Rules (must not override)\n- Never refund without approval.\n";

function configWith(...agents: object[]): OpenClawConfigShape {
  return { agents: { list: agents as never }, mcp: { servers: {} } };
}

describe("security scanner", () => {
  it("returns no findings for a healthy agent + workspace", () => {
    const findings = scan({
      openclawConfig: configWith(goodAgent),
      agentsMdByAgentId: { [goodAgent.id]: goodWorkspace },
    });
    expect(findings).toEqual([]);
  });

  it("flags sandbox.mode=main as critical", () => {
    const findings = scan({
      openclawConfig: configWith({ ...goodAgent, sandbox: { mode: "main" } }),
      agentsMdByAgentId: { [goodAgent.id]: goodWorkspace },
    });
    expect(findings.some((f) => f.id.startsWith("sandbox-mode/"))).toBe(true);
    const f = findings.find((x) => x.id.startsWith("sandbox-mode/"))!;
    expect(f.severity).toBe("critical");
  });

  it("flags missing sandbox.mode as high", () => {
    const findings = scan({
      openclawConfig: configWith({ ...goodAgent, sandbox: undefined }),
      agentsMdByAgentId: { [goodAgent.id]: goodWorkspace },
    });
    const f = findings.find((x) => x.id.startsWith("sandbox-mode-missing/"));
    expect(f?.severity).toBe("high");
  });

  it("flags wildcard tools.allow as critical", () => {
    const findings = scan({
      openclawConfig: configWith({ ...goodAgent, tools: { allow: ["*"] } }),
      agentsMdByAgentId: { [goodAgent.id]: goodWorkspace },
    });
    expect(findings.some((f) => f.id.startsWith("tools-wildcard-allow/"))).toBe(true);
  });

  it("flags high-risk tools (exec/browser) as high", () => {
    const findings = scan({
      openclawConfig: configWith({
        ...goodAgent,
        tools: { allow: ["exec", "browser", "fs_read"] },
      }),
      agentsMdByAgentId: { [goodAgent.id]: goodWorkspace },
    });
    expect(findings.some((f) => f.id === "high-risk-tool/cs-agent/exec")).toBe(true);
    expect(findings.some((f) => f.id === "high-risk-tool/cs-agent/browser")).toBe(true);
  });

  it("flags missing Hard Rules header in AGENTS.md as critical", () => {
    const findings = scan({
      openclawConfig: configWith(goodAgent),
      agentsMdByAgentId: { [goodAgent.id]: "# AGENTS.md\nNo hard rules here.\n" },
    });
    expect(findings.some((f) => f.id.startsWith("hard-rules-missing/"))).toBe(true);
  });

  it("flags oversized AGENTS.md as high", () => {
    const big = "x".repeat(12_000);
    const findings = scan({
      openclawConfig: configWith(goodAgent),
      agentsMdByAgentId: {
        [goodAgent.id]: `## Hard Rules (must not override)\n${big}`,
      },
    });
    expect(findings.some((f) => f.id.startsWith("agents-md-oversized/"))).toBe(true);
  });

  it("detects raw OpenAI keys, AWS keys, GitHub PATs in AGENTS.md as critical", () => {
    const dirty = `## Hard Rules (must not override)\nKey: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ12\nAWS: AKIAIOSFODNN7EXAMPLE\nGH: ghp_abcdefghijklmnopqrstuvwxyz0123456789\n`;
    const findings = scan({
      openclawConfig: configWith(goodAgent),
      agentsMdByAgentId: { [goodAgent.id]: dirty },
    });
    const labels = findings
      .filter((f) => f.id.startsWith("secret-in-agents-md/"))
      .map((f) => f.id);
    expect(labels.some((l) => l.includes("OpenAI-style API key"))).toBe(true);
    expect(labels.some((l) => l.includes("AWS access key id"))).toBe(true);
    expect(labels.some((l) => l.includes("GitHub PAT"))).toBe(true);
  });

  it("flags MCP server env values that look like raw secrets", () => {
    const findings = scan({
      openclawConfig: {
        agents: { list: [] },
        mcp: {
          servers: {
            github: {
              command: "npx",
              args: ["@modelcontextprotocol/server-github"],
              env: { GITHUB_TOKEN: "ghp_abcdefghijklmnopqrstuvwxyz0123456789" },
            },
          },
        },
      },
    });
    expect(findings.some((f) => f.id.startsWith("mcp-secret-in-config/github/"))).toBe(true);
  });

  it("does NOT flag $secret: references in MCP env", () => {
    const findings = scan({
      openclawConfig: {
        agents: { list: [] },
        mcp: {
          servers: {
            github: {
              command: "npx",
              env: { GITHUB_TOKEN: "$secret:GITHUB_TOKEN" },
            },
          },
        },
      },
    });
    expect(findings).toEqual([]);
  });

  it("flags channel-bound agents missing escalateTo as medium", () => {
    const findings = scan({
      openclawConfig: configWith({ ...goodAgent, escalateTo: undefined }),
      agentsMdByAgentId: { [goodAgent.id]: goodWorkspace },
    });
    const f = findings.find((x) => x.id.startsWith("escalate-missing/"));
    expect(f?.severity).toBe("medium");
  });

  it("summarize() rolls up severities and detects blockers", () => {
    const findings = scan({
      openclawConfig: configWith({ ...goodAgent, tools: { allow: ["*"] } }),
      agentsMdByAgentId: { [goodAgent.id]: goodWorkspace },
    });
    const s = summarize(findings);
    expect(s.bySeverity.critical).toBeGreaterThanOrEqual(1);
    expect(s.hasBlockers).toBe(true);
  });
});
