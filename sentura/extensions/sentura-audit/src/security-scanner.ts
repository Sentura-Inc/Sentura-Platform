/**
 * Security scanner — detects risky agent configurations.
 *
 * Pure function: takes a parsed `openclaw.json` snapshot + an optional set of
 * workspace AGENTS.md texts and returns a list of findings. Lives next to
 * `sentura-audit` so the audit dashboard can surface findings as
 * critical-severity audit entries via a separate emit step.
 *
 * Owned by Person D (Week 4).
 */

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export interface SecurityFinding {
  id: string;
  severity: FindingSeverity;
  agentId?: string;
  message: string;
  /** Suggested remediation. Concise, actionable, points at a specific file or rule. */
  remediation: string;
}

export interface AgentConfigShape {
  id: string;
  model?: string;
  runtime?: { type?: string };
  sandbox?: { mode?: string };
  tools?: {
    profile?: string;
    allow?: readonly string[];
    deny?: readonly string[];
    alsoAllow?: readonly string[];
    sandbox?: {
      tools?: {
        allow?: readonly string[];
        alsoAllow?: readonly string[];
      };
    };
  };
  channels?: { bindings?: readonly { channelId?: string }[] };
  escalateTo?: string;
}

export interface OpenClawConfigShape {
  agents?: { list?: readonly AgentConfigShape[] };
  mcp?: { servers?: Record<string, unknown> };
}

export interface ScanInput {
  openclawConfig: OpenClawConfigShape;
  /** Map of agent id → AGENTS.md raw text (optional — if missing, the
   *  workspace-scoped checks are skipped for that agent). */
  agentsMdByAgentId?: Record<string, string>;
}

/**
 * Patterns that look like raw secrets pasted directly into config or
 * workspace files. The scanner flags any match as CRITICAL — secrets must
 * live in `~/.openclaw/.env` or OpenClaw's secret store, never in checked-in
 * artifacts.
 */
const RAW_SECRET_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, label: "OpenAI-style API key" },
  { pattern: /AKIA[0-9A-Z]{16}/, label: "AWS access key id" },
  { pattern: /xox[abp]-[a-zA-Z0-9-]{10,}/, label: "Slack token" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, label: "GitHub PAT (classic)" },
  { pattern: /github_pat_[a-zA-Z0-9_]{82}/, label: "GitHub fine-grained PAT" },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: "PEM private key" },
  { pattern: /AIza[0-9A-Za-z_-]{35}/, label: "Google API key" },
];

/**
 * Tools whose names imply unrestricted shell-or-network egress. Surfacing
 * any of these in an agent's allowlist demands a Hard Rule that limits
 * blast radius.
 */
const HIGH_RISK_TOOL_NAMES = [
  "exec",
  "process",
  "shell",
  "bash",
  "node_eval",
  "eval",
  "browser",
  "fetch",
  "http_request",
];

const HARD_RULES_HEADER = /##\s+Hard Rules\s*\(must not override\)/i;

export function scan(input: ScanInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const agents = input.openclawConfig.agents?.list ?? [];

  for (const agent of agents) {
    findings.push(...scanAgent(agent, input.agentsMdByAgentId?.[agent.id]));
  }

  // Top-level config: secrets pasted into MCP server env.
  const mcpServers = input.openclawConfig.mcp?.servers ?? {};
  for (const [name, raw] of Object.entries(mcpServers)) {
    findings.push(...scanMcpServerEnv(name, raw));
  }

  return findings;
}

function scanAgent(agent: AgentConfigShape, agentsMdText: string | undefined): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // 1. Sandbox mode check — Sentura mandates `non-main` for AI employees.
  const sandboxMode = agent.sandbox?.mode;
  if (sandboxMode && sandboxMode !== "non-main") {
    findings.push({
      id: `sandbox-mode/${agent.id}`,
      severity: "critical",
      agentId: agent.id,
      message: `Agent '${agent.id}' uses sandbox.mode=${sandboxMode}; Sentura requires 'non-main'.`,
      remediation: `Set 'sandbox.mode' to 'non-main' in the agent's config.json5.`,
    });
  } else if (!sandboxMode) {
    findings.push({
      id: `sandbox-mode-missing/${agent.id}`,
      severity: "high",
      agentId: agent.id,
      message: `Agent '${agent.id}' has no explicit sandbox.mode (defaults vary by OpenClaw version).`,
      remediation: `Set 'sandbox.mode' to 'non-main' in the agent's config.json5.`,
    });
  }

  // 2. Tool-policy: wildcard or empty deny is a red flag.
  if (agent.tools?.allow?.includes("*")) {
    findings.push({
      id: `tools-wildcard-allow/${agent.id}`,
      severity: "critical",
      agentId: agent.id,
      message: `Agent '${agent.id}' has '*' in tools.allow — every tool is exposed.`,
      remediation: `Replace 'tools.allow=["*"]' with an explicit allowlist of the tools the agent actually needs.`,
    });
  }

  // 3. High-risk tools allowed without a deny-list scope.
  const allowedTools = new Set([
    ...(agent.tools?.allow ?? []),
    ...(agent.tools?.alsoAllow ?? []),
    ...(agent.tools?.sandbox?.tools?.alsoAllow ?? []),
  ]);
  for (const toolName of HIGH_RISK_TOOL_NAMES) {
    if (allowedTools.has(toolName)) {
      findings.push({
        id: `high-risk-tool/${agent.id}/${toolName}`,
        severity: "high",
        agentId: agent.id,
        message: `Agent '${agent.id}' allows '${toolName}' — verify a Hard Rule constrains its blast radius.`,
        remediation: `Either remove '${toolName}' from the allowlist or add a Hard Rule in AGENTS.md that bounds usage (e.g. allowed domains, allowed paths).`,
      });
    }
  }

  // 4. Workspace AGENTS.md must contain the Hard Rules header.
  if (agentsMdText !== undefined && !HARD_RULES_HEADER.test(agentsMdText)) {
    findings.push({
      id: `hard-rules-missing/${agent.id}`,
      severity: "critical",
      agentId: agent.id,
      message: `Agent '${agent.id}' AGENTS.md has no '## Hard Rules (must not override)' section.`,
      remediation: `Add the Hard Rules header and rules to AGENTS.md before this agent ships. See docs/workspace-convention.md.`,
    });
  }

  // 5. AGENTS.md size guard (12 000-char OpenClaw injection limit).
  if (agentsMdText !== undefined && agentsMdText.length > 11_500) {
    findings.push({
      id: `agents-md-oversized/${agent.id}`,
      severity: "high",
      agentId: agent.id,
      message: `Agent '${agent.id}' AGENTS.md is ${agentsMdText.length} chars — OpenClaw silently truncates at 12 000.`,
      remediation: `Trim AGENTS.md below ~11 000 chars. Push narrative into skill files. (See docs/MEMORY.md Current Ground Truth #6.)`,
    });
  }

  // 6. Raw secrets pasted into AGENTS.md.
  if (agentsMdText !== undefined) {
    for (const { pattern, label } of RAW_SECRET_PATTERNS) {
      if (pattern.test(agentsMdText)) {
        findings.push({
          id: `secret-in-agents-md/${agent.id}/${label}`,
          severity: "critical",
          agentId: agent.id,
          message: `Agent '${agent.id}' AGENTS.md appears to contain a raw ${label}.`,
          remediation: `Move the secret to ~/.openclaw/.env (or the secret store) and reference it via $secret:NAME — never commit it.`,
        });
      }
    }
  }

  // 7. Channel exposure check — at least one channel binding implies
  //    external traffic; the agent must have an explicit escalateTo.
  const hasChannel = (agent.channels?.bindings?.length ?? 0) > 0;
  if (hasChannel && !agent.escalateTo) {
    findings.push({
      id: `escalate-missing/${agent.id}`,
      severity: "medium",
      agentId: agent.id,
      message: `Agent '${agent.id}' has channel bindings but no escalateTo target.`,
      remediation: `Set 'escalateTo' on the agent config so the dashboard knows who to ping when an approval is required.`,
    });
  }

  return findings;
}

function scanMcpServerEnv(name: string, rawServer: unknown): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  if (!rawServer || typeof rawServer !== "object") return findings;
  const env = (rawServer as { env?: Record<string, string> }).env ?? {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;
    if (value.startsWith("$secret:")) continue; // properly delegated
    for (const { pattern, label } of RAW_SECRET_PATTERNS) {
      if (pattern.test(value)) {
        findings.push({
          id: `mcp-secret-in-config/${name}/${key}`,
          severity: "critical",
          message: `MCP server '${name}' env.${key} contains a raw ${label}.`,
          remediation: `Replace the value with '$secret:${key}' and put the literal secret in ~/.openclaw/.env (or OpenClaw's secret store).`,
        });
      }
    }
  }
  return findings;
}

/**
 * Convenience grouping for dashboards / CLI rollups.
 */
export function summarize(findings: readonly SecurityFinding[]): {
  total: number;
  bySeverity: Record<FindingSeverity, number>;
  byAgent: Record<string, number>;
  hasBlockers: boolean;
} {
  const bySeverity: Record<FindingSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const byAgent: Record<string, number> = {};
  for (const f of findings) {
    bySeverity[f.severity]++;
    if (f.agentId) byAgent[f.agentId] = (byAgent[f.agentId] ?? 0) + 1;
  }
  return {
    total: findings.length,
    bySeverity,
    byAgent,
    hasBlockers: bySeverity.critical > 0,
  };
}
