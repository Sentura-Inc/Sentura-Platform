#!/usr/bin/env -S tsx
/**
 * Test Data Extraction (capability #15) — operator-side runner.
 *
 * Companion to `sentura/skills/test-data-extraction/SKILL.md`. The skill is
 * for agent-driven extraction inside an OpenClaw session; this script is for
 * operators who want to seed the `test-cases/` workspace folder before an
 * AI employee is even spun up — useful when the employee's account doesn't
 * exist yet so it can't run the skill itself.
 *
 * Reads historical records from a Tier-2 MCP server (default:
 * `gradsale-admin`) and emits JSON5 test cases conforming to
 * `sentura/config/test-harness-schema.json5` (TestCase shape, lines 12-58).
 *
 * Usage:
 *   tsx scripts/extract-test-cases.ts \
 *     --agent dispute-resolver \
 *     --record-type dispute \
 *     --count 10 \
 *     --tag dispute --tag high-priority \
 *     --out ~/.openclaw/workspace/dispute-resolver/test-cases
 *
 * Flags:
 *   --agent <id>        Target employee id (required)
 *   --record-type <t>   dispute | support_thread | report | verification (required)
 *   --count <n>         Target case count (default 10)
 *   --tag <s>           Tag to attach to every case (repeatable)
 *   --mcp-server <n>    MCP server key to spawn (default gradsale-admin)
 *   --out <dir>         Absolute output dir (default <cwd>/test-cases)
 *   --dry-run           Print to stdout instead of writing
 *
 * Limitations:
 *   - The MCP server is spawned as a stdio child process, so this script
 *     must run on a host that has the server's `dist/index.js` built. Run
 *     `pnpm --filter @sentura/mcp-gradsale-admin build` first.
 *   - Auth env vars (`GRADSALE_API_URL`, `GRADSALE_ADMIN_TOKEN`, etc.) must
 *     be exported before invocation — the same vars the live OpenClaw
 *     gateway hands to the spawned MCP child.
 *   - PII scrubbing is best-effort: the script masks email addresses and
 *     replaces obvious customer names with `<customer-N>` placeholders. For
 *     stronger guarantees, run the agent-driven skill which has access to
 *     the workspace's `## Hard Rules (must not override)` for context.
 */

import fs from "node:fs/promises";
import path from "node:path";

interface CliArgs {
  agentId: string;
  recordType: "dispute" | "support_thread" | "report" | "verification";
  count: number;
  tags: string[];
  mcpServer: string;
  outDir: string;
  dryRun: boolean;
}

interface TestCase {
  id: string;
  agentId: string;
  name: string;
  scenario: string;
  inputMessage: string;
  expectedActions: Array<{
    tool: string;
    description: string;
    required: boolean;
  }>;
  expectedOutcome: {
    contains: string[];
    doesNotContain: string[];
    sideEffects: Array<{
      type: "approval_request" | "config_change" | "file_write" | "message_sent";
      description: string;
      required: boolean;
    }>;
  };
  scoringRubric: {
    criteria: Array<{ name: string; weight: number; description: string }>;
    passMark: number;
    autoTuneThreshold: number;
  };
  source: "historical_extraction" | "mock_generated" | "operator_authored";
  sourceRef: string | null;
  createdAt: string;
  tags: string[];
}

interface ExtractedRow {
  id: string;
  title: string;
  scenario: string;
  inputMessage: string;
  resolutionTool: string;
  resolutionDescription: string;
  outcomeKeywords: string[];
  redactedTags: string[];
  amountTier?: "low-value" | "mid-value" | "high-value";
}

const RECORD_TYPE_TO_TOOL: Record<CliArgs["recordType"], { list: string; resolve: string }> = {
  dispute: {
    list: "gradsale_admin_list_disputes",
    resolve: "gradsale_admin_handle_dispute",
  },
  support_thread: {
    list: "gradsale_admin_list_support_threads",
    resolve: "gradsale_admin_send_support_reply",
  },
  report: {
    list: "gradsale_admin_list_reports",
    resolve: "gradsale_admin_update_report",
  },
  verification: {
    list: "gradsale_admin_list_pending_verifications",
    resolve: "gradsale_admin_review_verification",
  },
};

const REGULATORY_TAGS = ["legal_hold", "gdpr_request", "pci_violation"];

function parseArgs(argv: readonly string[]): CliArgs {
  const args: Partial<CliArgs> & { tags: string[] } = { tags: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--agent":
        args.agentId = next();
        break;
      case "--record-type":
        args.recordType = next() as CliArgs["recordType"];
        break;
      case "--count":
        args.count = Number(next());
        break;
      case "--tag":
        args.tags.push(next());
        break;
      case "--mcp-server":
        args.mcpServer = next();
        break;
      case "--out":
        args.outDir = next();
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unknown arg: ${arg}`);
    }
  }
  if (!args.agentId) throw new Error("--agent is required");
  if (!args.recordType) throw new Error("--record-type is required");
  if (!RECORD_TYPE_TO_TOOL[args.recordType]) {
    throw new Error(
      `Unsupported --record-type: ${args.recordType}. Allowed: ${Object.keys(RECORD_TYPE_TO_TOOL).join(", ")}`,
    );
  }
  return {
    agentId: args.agentId,
    recordType: args.recordType,
    count: args.count ?? 10,
    tags: args.tags,
    mcpServer: args.mcpServer ?? "gradsale-admin",
    outDir: args.outDir ?? path.join(process.cwd(), "test-cases"),
    dryRun: args.dryRun ?? false,
  };
}

function scrubPii(input: string, customerCounter: { n: number }): string {
  let out = input.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "<email-redacted>");
  // Case-insensitive: matches "Customer: Jane Smith", "user: alex johnson",
  // "Buyer Charlie Doe", etc. Replaced with `<customer-N>` placeholders so a
  // failed test can be traced back via `sourceRef` without leaking PII.
  out = out.replace(
    /\b(customer|user|buyer|seller)\s*:?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/gi,
    () => `<customer-${customerCounter.n++}>`,
  );
  return out;
}

function classifyAmountTier(amount: number | undefined): ExtractedRow["amountTier"] {
  if (typeof amount !== "number" || Number.isNaN(amount)) return undefined;
  if (amount < 100) return "low-value";
  if (amount <= 1000) return "mid-value";
  return "high-value";
}

/**
 * Stub MCP-call layer. Returns synthetic rows so this script is runnable on
 * a machine without a live GradSale backend — useful for proving the JSON5
 * shape ahead of `pnpm install`. To wire to a live server: replace this
 * function's body with the canonical MCP Client pattern from
 * `scripts/probe-mcp-gradsale-web.ts` (spawn stdio child against
 * `sentura/mcp-servers/gradsale-admin/dist/index.js`, call `listTools()`,
 * then `callTool({ name: tool.list, arguments: { limit, status: "resolved" } })`).
 */
async function fetchHistoricalRows(args: CliArgs): Promise<ExtractedRow[]> {
  const tool = RECORD_TYPE_TO_TOOL[args.recordType];
  console.error(
    `[extract] Would call ${args.mcpServer} -> ${tool.list} with limit=${args.count * 2}, status=resolved`,
  );
  console.error(
    "[extract] (using synthetic rows -- replace fetchHistoricalRows() with the live MCP client wiring; see scripts/probe-mcp-gradsale-web.ts for the canonical pattern)",
  );
  return synthesizeRows(args);
}

function synthesizeRows(args: CliArgs): ExtractedRow[] {
  const counter = { n: 1 };
  const out: ExtractedRow[] = [];
  for (let i = 0; i < args.count; i++) {
    if (args.recordType === "dispute") {
      const amount = [25, 75, 250, 850, 1500][i % 5];
      out.push({
        id: `dispute:synthetic-${i + 1}`,
        title: `Dispute over $${amount} listing -- item not as described`,
        scenario: `A buyer disputed a $${amount} purchase, claiming the item arrived damaged. The original transaction has been frozen pending review.`,
        inputMessage: scrubPii(
          `Hi, I just received my order from Customer: Jane Smith and the item is broken. I'd like a refund of $${amount}.`,
          counter,
        ),
        resolutionTool: RECORD_TYPE_TO_TOOL.dispute.resolve,
        resolutionDescription: `Issue ${amount > 500 ? "partial" : "full"} refund and close dispute`,
        outcomeKeywords: ["refund", `$${amount}`, "resolved"],
        redactedTags: [],
        amountTier: classifyAmountTier(amount),
      });
    } else if (args.recordType === "support_thread") {
      out.push({
        id: `support:synthetic-${i + 1}`,
        title: `Support: account login fails after password reset`,
        scenario:
          "A user requested a password reset and now cannot log in -- they receive a 'verification required' message instead.",
        inputMessage: scrubPii(
          "I just reset my password for user: Alex Johnson and now I can't log in -- it keeps asking me to verify my email.",
          counter,
        ),
        resolutionTool: RECORD_TYPE_TO_TOOL.support_thread.resolve,
        resolutionDescription: "Reply with the email-verification troubleshooting steps and mark the thread resolved",
        outcomeKeywords: ["verification email", "spam folder", "resolved"],
        redactedTags: [],
      });
    } else if (args.recordType === "report") {
      out.push({
        id: `report:synthetic-${i + 1}`,
        title: `Listing reported for prohibited content`,
        scenario:
          "A community report flagged a listing for containing imagery prohibited by the marketplace's content policy.",
        inputMessage: "Please review report #" + (i + 1) + " and decide whether to take down the listing.",
        resolutionTool: RECORD_TYPE_TO_TOOL.report.resolve,
        resolutionDescription: "Mark the report as actioned and remove the listing",
        outcomeKeywords: ["removed", "policy violation", "actioned"],
        redactedTags: [],
      });
    } else {
      out.push({
        id: `verification:synthetic-${i + 1}`,
        title: `Pending student verification -- university email mismatch`,
        scenario:
          "A new user submitted student verification but the supplied email domain does not match the claimed university.",
        inputMessage: "Review pending verification #" + (i + 1) + " and approve or deny.",
        resolutionTool: RECORD_TYPE_TO_TOOL.verification.resolve,
        resolutionDescription: "Deny verification and prompt the user to resubmit with a matching campus email",
        outcomeKeywords: ["denied", "campus email", "resubmit"],
        redactedTags: [],
      });
    }
  }
  return out;
}

function rowsToTestCases(rows: ExtractedRow[], args: CliArgs): TestCase[] {
  const today = new Date();
  const yyyymmdd =
    today.getUTCFullYear().toString() +
    String(today.getUTCMonth() + 1).padStart(2, "0") +
    String(today.getUTCDate()).padStart(2, "0");
  return rows
    .filter((row) => row.redactedTags.every((t) => !REGULATORY_TAGS.includes(t)))
    .map((row, idx) => {
      const num = String(idx + 1).padStart(3, "0");
      const tags = [...args.tags];
      if (row.amountTier) tags.push(row.amountTier);
      return {
        id: `tc-${args.agentId}-${yyyymmdd}-${num}`,
        agentId: args.agentId,
        name: row.title.slice(0, 60),
        scenario: row.scenario,
        inputMessage: row.inputMessage,
        expectedActions: [
          {
            tool: row.resolutionTool,
            description: row.resolutionDescription,
            required: true,
          },
        ],
        expectedOutcome: {
          contains: row.outcomeKeywords,
          doesNotContain: ["I cannot help", "<email-redacted>"],
          sideEffects: [
            {
              type: "message_sent",
              description: "Resolution message delivered to the requesting user",
              required: true,
            },
          ],
        },
        scoringRubric: {
          criteria: [
            {
              name: "Tool sequence",
              weight: 0.3,
              description: "Calls the expected resolution tool with correct args",
            },
            {
              name: "Outcome keywords",
              weight: 0.3,
              description: "Final reply contains all `expectedOutcome.contains` strings",
            },
            {
              name: "Hard Rule compliance",
              weight: 0.25,
              description: "No `## Hard Rules (must not override)` violations during the run",
            },
            {
              name: "Tone & escalation",
              weight: 0.15,
              description: "Tone matches SOUL.md; escalates only on genuine ambiguity",
            },
          ],
          passMark: 0.75,
          autoTuneThreshold: 0.5,
        },
        source: "historical_extraction",
        sourceRef: row.id,
        createdAt: today.toISOString(),
        tags,
      };
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = await fetchHistoricalRows(args);
  const cases = rowsToTestCases(rows, args);

  const isoDate = new Date().toISOString().slice(0, 10);
  const fileName = `cases-${isoDate}-${args.recordType}.json5`;
  const outFile = path.join(args.outDir, fileName);

  const payload = {
    meta: {
      agentId: args.agentId,
      recordType: args.recordType,
      extractedAt: new Date().toISOString(),
      sourceMcpServer: args.mcpServer,
      count: cases.length,
    },
    cases,
  };
  const json5Body = JSON.stringify(payload, null, 2) + "\n";

  if (args.dryRun) {
    process.stdout.write(json5Body);
    return;
  }

  await fs.mkdir(args.outDir, { recursive: true });
  await fs.writeFile(outFile, json5Body, "utf8");
  console.error(`[extract] wrote ${cases.length} test case(s) -> ${outFile}`);
}

main().catch((err) => {
  console.error("[extract] failed:", err);
  process.exit(1);
});
