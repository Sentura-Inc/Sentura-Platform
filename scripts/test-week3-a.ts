/**
 * Week 3 Person A — Secrets, per-agent MCP, config diff, and chat helper tests.
 * Run: npx tsx scripts/test-week3-a.ts
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  hasSenturaSecret,
  putSenturaSecret,
} from "../sentura/lib/secrets.ts";
import {
  getSenturaMcpLauncherPath,
  removePerAgentMcpServers,
  upsertPerAgentMcpServers,
} from "../sentura/lib/per-agent-mcp.ts";
import {
  filterChatSessions as filterLibChatSessions,
  isDashboardChatSessionKey,
  parseDashboardChatSessionKey,
} from "../sentura/lib/chat-sessions.ts";
import {
  resolveSenturaConfigDiffLogPathFromOpenClawDir,
} from "../sentura/lib/config-versioning.ts";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed += 1;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}`);
    failed += 1;
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

type SessionSummary = {
  key: string;
  agentId?: string;
  updatedAt?: number | null;
};

function countJsonLines(raw: string): number {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

async function readUtf8(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function main() {
  const dashboardGatewayModule = await import("../sentura/dashboard/src/lib/gateway/client.ts");
  const dashboardChatSessionsModule = await import(
    "../sentura/dashboard/src/lib/gateway/chat-sessions.ts"
  );
  const GatewayClient = (
    (dashboardGatewayModule as Record<string, unknown>).GatewayClient
    ?? ((dashboardGatewayModule as { default?: Record<string, unknown> }).default?.GatewayClient)
  ) as typeof import("../sentura/dashboard/src/lib/gateway/client.ts")["GatewayClient"];
  const filterDashboardChatSessions = (
    (dashboardChatSessionsModule as Record<string, unknown>).filterChatSessions
    ?? ((dashboardChatSessionsModule as { default?: Record<string, unknown> }).default?.filterChatSessions)
  ) as typeof import("../sentura/dashboard/src/lib/gateway/chat-sessions.ts")["filterChatSessions"];
  if (typeof GatewayClient !== "function" || typeof filterDashboardChatSessions !== "function") {
    throw new Error("Failed to load dashboard gateway chat-session helpers.");
  }

  const tmpRoot = path.join(os.tmpdir(), `sentura-week3-a-${Date.now()}`);
  const openclawDir = path.join(tmpRoot, ".openclaw");
  const workspaceRoot = path.join(openclawDir, "workspace");
  const configPath = path.join(openclawDir, "openclaw.json");
  const diffLogPath = resolveSenturaConfigDiffLogPathFromOpenClawDir(openclawDir);
  const launcherPath = getSenturaMcpLauncherPath();
  const originalStateDir = process.env.OPENCLAW_STATE_DIR;

  try {
    process.env.OPENCLAW_STATE_DIR = openclawDir;
    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({ agents: { list: [] } }, null, 2) + "\n",
      "utf8",
    );
    await fs.mkdir(path.join(workspaceRoot, "agent-a"), { recursive: true });
    await fs.mkdir(path.join(workspaceRoot, "agent-b"), { recursive: true });

    section("A16: Secrets");
    const secretValue = "super-secret-value";
    const stored = await putSenturaSecret({
      agentId: "agent-a",
      service: "zendesk",
      credential: "api_key",
      value: secretValue,
      configPath,
      actor: "test-week3-a",
    });
    const secretExists = await hasSenturaSecret({
      agentId: "agent-a",
      service: "zendesk",
      credential: "api_key",
      configPath,
    });
    const configAfterSecret = JSON.parse(await readUtf8(configPath)) as {
      secrets?: { providers?: { default?: { source?: string; path?: string; mode?: string } } };
    };
    const secretsFilePath =
      configAfterSecret.secrets?.providers?.default?.path ?? path.join(openclawDir, "secrets.json");
    const secretsRaw = await readUtf8(secretsFilePath);
    const diffLogAfterSecret = await readUtf8(diffLogPath);

    check(
      "Default file provider bootstrapped to ~/.openclaw/secrets.json equivalent",
      configAfterSecret.secrets?.providers?.default?.source === "file"
        && configAfterSecret.secrets?.providers?.default?.mode === "json"
        && configAfterSecret.secrets?.providers?.default?.path === secretsFilePath,
    );
    check(
      "put_secret returns only pointer metadata",
      stored.pointer === "$secret:/sentura/agents/agent-a/zendesk/api_key"
        && !("value" in (stored as unknown as Record<string, unknown>)),
    );
    check("has_secret returns exists=true for stored secret", secretExists.exists === true);
    check("Secret plaintext is written to the file provider", secretsRaw.includes(secretValue));
    check("Secret plaintext is not written into the diff log", !diffLogAfterSecret.includes(secretValue));

    section("A17 + A18: Per-Agent MCP + Config Diff");
    const pointer = stored.pointer;
    const firstUpsert = await upsertPerAgentMcpServers({
      agentId: "agent-a",
      workspaceRoot,
      actor: "test-week3-a",
      mcpServers: {
        zendesk: {
          command: "node",
          args: ["./dist/index.js"],
          env: {
            ZENDESK_API_KEY: pointer,
            ZENDESK_BASE_URL: "https://zendesk.example.com",
          },
        },
      },
    });
    const configARaw = await readUtf8(path.join(workspaceRoot, "agent-a", "config.json5"));
    const diffLinesAfterFirstUpsert = countJsonLines(await readUtf8(diffLogPath));
    const secondUpsert = await upsertPerAgentMcpServers({
      agentId: "agent-a",
      workspaceRoot,
      actor: "test-week3-a",
      mcpServers: {
        zendesk: {
          command: "node",
          args: ["./dist/index.js"],
          env: {
            ZENDESK_API_KEY: pointer,
            ZENDESK_BASE_URL: "https://zendesk.example.com",
          },
        },
      },
    });
    const diffLinesAfterSecondUpsert = countJsonLines(await readUtf8(diffLogPath));
    await upsertPerAgentMcpServers({
      agentId: "agent-b",
      workspaceRoot,
      actor: "test-week3-a",
      mcpServers: {
        gradsale: {
          command: "node",
          args: ["./server.js"],
          env: {
            GRADSALE_ADMIN_TOKEN: "$secret:/sentura/agents/agent-b/gradsale/admin_token",
          },
        },
      },
    });
    const configBRaw = await readUtf8(path.join(workspaceRoot, "agent-b", "config.json5"));
    const removed = await removePerAgentMcpServers({
      agentId: "agent-a",
      workspaceRoot,
      actor: "test-week3-a",
      serverNames: ["zendesk"],
    });
    const diffLinesBeforeRemoveNoop = countJsonLines(await readUtf8(diffLogPath));
    const removedNoop = await removePerAgentMcpServers({
      agentId: "agent-a",
      workspaceRoot,
      actor: "test-week3-a",
      serverNames: ["zendesk"],
    });
    const diffLinesAfterRemoveNoop = countJsonLines(await readUtf8(diffLogPath));

    check("upsert_mcp_servers writes config.json5 -> mcpServers", firstUpsert.changed === true && configARaw.includes("mcpServers"));
    check(
      "Per-agent MCP config preserves $secret pointer in env",
      configARaw.includes(pointer),
    );
    check(
      "Per-agent MCP config uses the Sentura launcher path",
      configARaw.includes(launcherPath),
    );
    check(
      "No-op upsert does not create a new diff record",
      secondUpsert.changed === false && diffLinesAfterSecondUpsert === diffLinesAfterFirstUpsert,
    );
    check(
      "Different agents keep isolated MCP config files",
      configBRaw.includes("gradsale")
        && !configARaw.includes("gradsale")
        && configBRaw.includes("agent-b"),
    );
    check(
      "remove_mcp_servers is idempotent",
      removed.changed === true && removed.removedServerNames.includes("zendesk")
        && removedNoop.changed === false,
    );
    check(
      "No-op remove does not create a new diff record",
      diffLinesAfterRemoveNoop === diffLinesBeforeRemoveNoop,
    );

    section("A19: Communication Panel Chat Helpers");
    const sessions: SessionSummary[] = [
      {
        key: "agent:sales-rep:dashboard:00000000-0000-0000-0000-000000000001",
        agentId: "sales-rep",
        updatedAt: 100,
      },
      {
        key: "agent:creator:dashboard:00000000-0000-0000-0000-000000000002",
        agentId: "creator",
        updatedAt: 300,
      },
      {
        key: "agent:support-bot:dashboard:00000000-0000-0000-0000-000000000003",
        agentId: "support-bot",
        updatedAt: 200,
      },
      {
        key: "agent:sales-rep:user:user-123:session-1",
        agentId: "sales-rep",
        updatedAt: 500,
      },
    ];
    const filteredLib = filterLibChatSessions(sessions);
    const filteredDashboard = filterDashboardChatSessions(sessions);

    check(
      "parseDashboardChatSessionKey parses dashboard keys",
      parseDashboardChatSessionKey(sessions[0].key)?.agentId === "sales-rep"
        && parseDashboardChatSessionKey(sessions[0].key)?.sessionId === "00000000-0000-0000-0000-000000000001",
    );
    check(
      "isDashboardChatSessionKey rejects non-dashboard session keys",
      isDashboardChatSessionKey(sessions[0].key) === true
        && isDashboardChatSessionKey(sessions[3].key) === false,
    );
    check(
      "filterChatSessions excludes meta agents and sorts updatedAt desc",
      filteredLib.map((entry) => entry.key).join("|")
        === [
          "agent:support-bot:dashboard:00000000-0000-0000-0000-000000000003",
          "agent:sales-rep:dashboard:00000000-0000-0000-0000-000000000001",
        ].join("|"),
    );
    check(
      "Dashboard and Sentura lib chat filters stay in sync",
      filteredDashboard.map((entry) => entry.key).join("|")
        === filteredLib.map((entry) => entry.key).join("|"),
    );

    const client = new GatewayClient({ url: "ws://unit.invalid", token: "test" });
    const createCalls: Array<{ agentId: string; initialMessage?: string; label?: string }> = [];
    const sendCalls: Array<{ message: string; sessionKey: string; idempotencyKey?: string }> = [];
    const listCalls: Array<{ agentId?: string }> = [];
    (client as unknown as { createSession: typeof client.createSession }).createSession = async (
      agentId,
      initialMessage,
      options,
    ) => {
      createCalls.push({ agentId, initialMessage, label: options?.label });
      return {
        ok: true,
        key: "agent:sales-rep:dashboard:00000000-0000-0000-0000-000000000010",
      } as { ok: true; key: string };
    };
    (client as unknown as { sendChat: typeof client.sendChat }).sendChat = async (
      message,
      sessionKey,
      idempotencyKey,
    ) => {
      sendCalls.push({ message, sessionKey, idempotencyKey });
      return { ok: true };
    };
    (client as unknown as { listSessions: typeof client.listSessions }).listSessions = async (
      options,
    ) => {
      listCalls.push(options ?? {});
      return sessions;
    };

    await client.createChatSession("sales-rep", {
      initialMessage: "hello",
      label: "Sales Chat",
    });
    await client.sendChatMessage(
      "agent:sales-rep:dashboard:00000000-0000-0000-0000-000000000001",
      "ping",
      "idem-123",
    );
    const clientFiltered = await client.listChatSessions();

    check(
      "createChatSession proxies to sessions.create",
      createCalls.length === 1
        && createCalls[0].agentId === "sales-rep"
        && createCalls[0].initialMessage === "hello"
        && createCalls[0].label === "Sales Chat",
    );
    check(
      "sendChatMessage proxies to chat.send",
      sendCalls.length === 1
        && sendCalls[0].message === "ping"
        && sendCalls[0].sessionKey === "agent:sales-rep:dashboard:00000000-0000-0000-0000-000000000001"
        && sendCalls[0].idempotencyKey === "idem-123",
    );
    check(
      "listChatSessions proxies to sessions.list then filters",
      listCalls.length === 1
        && clientFiltered.map((entry) => entry.key).join("|")
          === filteredLib.map((entry) => entry.key).join("|"),
    );
  } finally {
    if (originalStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = originalStateDir;
    }
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
