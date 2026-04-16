/**
 * Week 2 Person A — Automated test runner.
 * Run: npx tsx scripts/test-week2.ts
 */

import { createWorkspace, listWorkspaceFiles } from "../sentura/lib/workspace.ts";
import {
  buildAgentPatch,
  buildMemoryDbPath,
  registerAgentOnDisk,
  isAgentRegistered,
  buildGatewayToolCall,
} from "../sentura/lib/agent-registration.ts";
import {
  createWebchatBinding,
  createSlackChannelBinding,
  createDiscordBinding,
  addBindingsOnDisk,
  removeAgentBindingsOnDisk,
} from "../sentura/lib/channel-bindings.ts";
import {
  agentMemoryDbPath,
  applyMemoryIsolationOnDisk,
  validateMemoryIsolation,
} from "../sentura/lib/memory-isolation.ts";
import {
  generateUserToken,
  buildSessionKey,
  parseSessionKey,
  isUserSession,
  extractUserToken,
  hashUserToken,
  userMemoryFileName,
  ensureUserMemoryFile,
} from "../sentura/lib/user-token.ts";
import { ROLE_DEFINITIONS, getRoleDefinition, getOperatorScopesForRole } from "../sentura/extensions/sentura-rbac/src/roles.ts";
import handler from "../sentura/hooks/sentura-bootstrap/handler.ts";

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

// ─── Part 2: Workspace Creation ───

async function testWorkspace() {
  section("Part 2: Workspace Creation");
  const tmpBase = path.join(os.tmpdir(), "sentura-test-ws-" + Date.now());

  const result = await createWorkspace({
    agentId: "test-agent",
    name: "Test Agent",
    workspaceBase: tmpBase,
  });

  const expectedFiles = [
    "AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md", "USER.md",
    "HEARTBEAT.md", "BOOTSTRAP.md", "MEMORY.md", "RULES.md", "CONTEXT.md",
  ];
  for (const f of expectedFiles) {
    const exists = await fs.access(path.join(result.workspaceDir, f)).then(() => true).catch(() => false);
    check(`File ${f} exists`, exists);
  }

  const expectedDirs = [
    "skills", "ekg/org", "ekg/rules", "ekg/assets",
    "ekg/workflows", "ekg/workflows/experience-links", "memory/users",
  ];
  for (const d of expectedDirs) {
    const exists = await fs.access(path.join(result.workspaceDir, d)).then(() => true).catch(() => false);
    check(`Dir ${d} exists`, exists);
  }

  // Idempotency
  await fs.writeFile(path.join(result.workspaceDir, "SOUL.md"), "# Custom content");
  const result2 = await createWorkspace({ agentId: "test-agent", workspaceBase: tmpBase });
  const soulAfter = await fs.readFile(path.join(result.workspaceDir, "SOUL.md"), "utf-8");
  check("Pre-existing SOUL.md preserved", soulAfter === "# Custom content");
  check("No new files on second run", result2.filesCreated.length === 0);

  // listWorkspaceFiles
  const files = await listWorkspaceFiles("test-agent", tmpBase);
  check("listWorkspaceFiles includes RULES.md", files.includes("RULES.md"));
  check("listWorkspaceFiles includes CONTEXT.md", files.includes("CONTEXT.md"));

  await fs.rm(tmpBase, { recursive: true });
}

// ─── Part 3: Agent Registration ───

async function testAgentRegistration() {
  section("Part 3: Agent Registration");

  const patch = buildAgentPatch({
    agent: {
      id: "test-emp",
      name: "Test Employee",
      model: "anthropic/claude-sonnet",
      tools: { profile: "minimal", deny: ["exec"] },
    },
    bindings: [{ agentId: "test-emp", channel: "webchat", peer: { kind: "dm", id: "*" } }],
    mcpServers: { "gradsale-api": { command: "node", args: ["server.js"] } },
    memoryLanceDbPath: "~/.openclaw/memory/test-emp/lancedb",
  });
  const parsed = JSON.parse(patch);
  check("Patch has agents.list array", Array.isArray(parsed.agents?.list));
  check("Agent ID correct", parsed.agents.list[0].id === "test-emp");
  check("Patch has bindings", Array.isArray(parsed.bindings));
  check("Patch has mcp.servers", Boolean(parsed.mcp?.servers?.["gradsale-api"]));
  check("Patch has plugins.memory-lancedb", Boolean(parsed.plugins?.["memory-lancedb"]?.dbPath));

  // buildMemoryDbPath
  const dbPath = buildMemoryDbPath("my-agent");
  check("buildMemoryDbPath format", dbPath === "~/.openclaw/memory/my-agent/lancedb");

  // registerAgentOnDisk + isAgentRegistered
  const tmpConfig = path.join(os.tmpdir(), "test-openclaw-" + Date.now() + ".json");
  await fs.writeFile(tmpConfig, JSON.stringify({ agents: { list: [] } }));

  await registerAgentOnDisk({ agent: { id: "emp-1", name: "Employee 1", tools: { profile: "minimal" } } }, tmpConfig);
  check("emp-1 registered", await isAgentRegistered("emp-1", tmpConfig));
  check("emp-2 not registered", !(await isAgentRegistered("emp-2", tmpConfig)));

  // Deduplication
  await registerAgentOnDisk({ agent: { id: "emp-1", name: "Employee 1 Updated" } }, tmpConfig);
  const cfg = JSON.parse(await fs.readFile(tmpConfig, "utf-8"));
  const count = cfg.agents.list.filter((a: { id: string }) => a.id === "emp-1").length;
  check("Deduplication: emp-1 appears once", count === 1);
  check("Name updated on re-register", cfg.agents.list[0].name === "Employee 1 Updated");

  // buildGatewayToolCall
  const toolCall = buildGatewayToolCall({ agent: { id: "emp-2" } });
  check("Gateway tool call tool=gateway", toolCall.tool === "gateway");
  check("Gateway tool call action=config.patch", toolCall.action === "config.patch");
  check("Gateway tool call has raw param", typeof toolCall.params.raw === "string");

  await fs.unlink(tmpConfig);
}

// ─── Part 4: Channel Bindings ───

async function testChannelBindings() {
  section("Part 4: Channel Bindings");

  const wb = createWebchatBinding("my-agent");
  check("Webchat channel=webchat", wb.match.channel === "webchat");
  check("Webchat peer=dm/*", wb.match.peer?.kind === "dm" && wb.match.peer?.id === "*");

  const sb = createSlackChannelBinding("my-agent", "C12345");
  check("Slack channel=slack", sb.match.channel === "slack");
  check("Slack peer=channel/C12345", sb.match.peer?.kind === "channel" && sb.match.peer?.id === "C12345");

  const db = createDiscordBinding("my-agent", "chan-1", { guildId: "guild-1", roles: ["admin"] });
  check("Discord guildId set", db.match.guildId === "guild-1");
  check("Discord roles set", JSON.stringify(db.match.roles) === JSON.stringify(["admin"]));

  // On-disk operations
  const tmpConfig = path.join(os.tmpdir(), "test-bindings-" + Date.now() + ".json");
  await fs.writeFile(tmpConfig, JSON.stringify({ bindings: [] }));

  const added1 = await addBindingsOnDisk([wb], tmpConfig);
  const added2 = await addBindingsOnDisk([wb], tmpConfig);
  const cfg = JSON.parse(await fs.readFile(tmpConfig, "utf-8"));
  check("First add returns 1", added1 === 1);
  check("Second add deduplicates (returns 0)", added2 === 0);
  check("Config has exactly 1 binding", cfg.bindings.length === 1);

  await addBindingsOnDisk([sb], tmpConfig);
  const removed = await removeAgentBindingsOnDisk("my-agent", tmpConfig);
  const cfgAfter = JSON.parse(await fs.readFile(tmpConfig, "utf-8"));
  check("Remove returns 2", removed === 2);
  check("Bindings empty after removal", cfgAfter.bindings.length === 0);

  await fs.unlink(tmpConfig);
}

// ─── Part 5: Memory Isolation ───

async function testMemoryIsolation() {
  section("Part 5: Memory Isolation");

  check("agentMemoryDbPath format", agentMemoryDbPath("sales-bot") === "~/.openclaw/memory/sales-bot/lancedb");

  const tmpConfig = path.join(os.tmpdir(), "test-mem-" + Date.now() + ".json");
  await fs.writeFile(tmpConfig, JSON.stringify({
    agents: { list: [
      { id: "agent-a" },
      { id: "agent-b", params: {} },
      { id: "agent-c", params: { memoryDbPath: "~/.openclaw/memory/agent-c/lancedb" } },
    ] },
  }));

  const updated = await applyMemoryIsolationOnDisk(tmpConfig);
  check("agent-a got memoryDbPath", updated.includes("agent-a"));
  check("agent-b got memoryDbPath", updated.includes("agent-b"));
  check("agent-c skipped (already set)", !updated.includes("agent-c"));

  const { isolated, shared } = await validateMemoryIsolation(tmpConfig);
  check("All 3 agents isolated", isolated.length === 3);
  check("No shared paths", shared.length === 0);

  await fs.unlink(tmpConfig);
}

// ─── Part 6: User Token Infrastructure ───

async function testUserToken() {
  section("Part 6: User Token Infrastructure");

  const token = generateUserToken();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  check("Token is valid UUID v4", uuidRegex.test(token));

  const key = buildSessionKey("my-agent", token, "sess-001");
  check("Session key format", key === `agent:my-agent:user:${token}:sess-001`);

  const parsed = parseSessionKey(key);
  check("parseSessionKey agentId", parsed?.agentId === "my-agent");
  check("parseSessionKey userToken", parsed?.userToken === token);
  check("parseSessionKey sessionId", parsed?.sessionId === "sess-001");

  check("isUserSession correct token", isUserSession(key, token));
  check("isUserSession wrong token", !isUserSession(key, "wrong-token"));

  check("extractUserToken from Sentura key", extractUserToken(key) === token);
  check("extractUserToken from plain key returns null", extractUserToken("agent:foo:dashboard:abc") === null);

  const h1 = hashUserToken(token);
  const h2 = hashUserToken(token);
  check("Hash is 16 chars", h1.length === 16);
  check("Hash is deterministic", h1 === h2);
  check("Hash is hex", /^[0-9a-f]+$/.test(h1));

  check("userMemoryFileName format", userMemoryFileName(token) === `MEMORY_USER_${token}.md`);

  const tmpWs = path.join(os.tmpdir(), "test-user-mem-" + Date.now());
  const filePath = await ensureUserMemoryFile(tmpWs, token);
  const exists = await fs.access(filePath).then(() => true).catch(() => false);
  check("ensureUserMemoryFile creates file", exists);
  check("File path contains memory/users/", filePath.includes("memory/users/"));

  await fs.rm(tmpWs, { recursive: true });
}

// ─── Part 9: RBAC 7-Role Model ───

function testRbac() {
  section("Part 9: RBAC 7-Role Model");

  check("7 roles defined", ROLE_DEFINITIONS.length === 7);

  const expectedIds = ["platform_admin", "manager", "ekg_manager", "agent_manager", "auditor", "end_user", "viewer"];
  const actualIds = ROLE_DEFINITIONS.map((r) => r.id);
  for (const id of expectedIds) {
    check(`Role ${id} exists`, actualIds.includes(id));
  }

  check("platform_admin has 6 scopes", getOperatorScopesForRole("platform_admin").length === 6);
  check("end_user has 1 scope", getOperatorScopesForRole("end_user").length === 1);
  check("viewer has 1 scope", getOperatorScopesForRole("viewer").length === 1);
  check("Unknown role has 0 scopes", getOperatorScopesForRole("nonexistent").length === 0);

  const admin = getRoleDefinition("platform_admin");
  check("platform_admin has T0-T4", admin?.dataTierAccess?.length === 5);

  const endUser = getRoleDefinition("end_user");
  check("end_user has T0 only", endUser?.dataTierAccess?.length === 1);
}

// ─── Part 10: Bootstrap Hook ───

async function testBootstrapHook() {
  section("Part 10: Bootstrap Hook");

  const tmpWs = path.join(os.tmpdir(), "test-hook-" + Date.now());
  await fs.mkdir(path.join(tmpWs, "memory", "users"), { recursive: true });
  await fs.writeFile(path.join(tmpWs, "RULES.md"), "# No sharing secrets");
  await fs.writeFile(path.join(tmpWs, "CONTEXT.md"), "# GradSale context");

  const userToken = "abc-def-123";
  await fs.writeFile(
    path.join(tmpWs, "memory", "users", `MEMORY_USER_${userToken}.md`),
    "# User memory\nPrefers concise answers.",
  );

  // Test 1: Static file injection
  const ctx1: Record<string, unknown> = { workspaceDir: tmpWs, bootstrapFiles: [] };
  await handler({ type: "agent", action: "bootstrap", context: ctx1 });
  const bf1 = ctx1.bootstrapFiles as any[];
  check("Injects RULES.md", bf1.some((f: any) => f.name === "RULES.md"));
  check("Injects CONTEXT.md", bf1.some((f: any) => f.name === "CONTEXT.md"));

  // Test 2: User memory injection
  const ctx2: Record<string, unknown> = {
    workspaceDir: tmpWs,
    bootstrapFiles: [],
    sessionKey: `agent:test:user:${userToken}:sess-001`,
  };
  await handler({ type: "agent", action: "bootstrap", context: ctx2 });
  const bf2 = ctx2.bootstrapFiles as any[];
  check("Injects user memory file", bf2.some((f: any) => f.name?.includes("MEMORY_USER_abc-def-123")));
  const userMem = bf2.find((f: any) => f.name?.includes("MEMORY_USER")) as any;
  check("User memory has correct content", userMem?.content?.includes("Prefers concise"));

  // Test 3: Non-bootstrap event ignored
  const bf3: unknown[] = [];
  await handler({
    type: "other",
    action: "something",
    context: { workspaceDir: tmpWs, bootstrapFiles: bf3 } as Record<string, unknown>,
  });
  check("Non-bootstrap event: no files injected", bf3.length === 0);

  // Test 4: Missing workspace files don't error
  const emptyWs = path.join(os.tmpdir(), "test-hook-empty-" + Date.now());
  await fs.mkdir(emptyWs, { recursive: true });
  const bf4: unknown[] = [];
  await handler({
    type: "agent",
    action: "bootstrap",
    context: { workspaceDir: emptyWs, bootstrapFiles: bf4 } as Record<string, unknown>,
  });
  check("Empty workspace: no files injected", bf4.length === 0);

  await fs.rm(tmpWs, { recursive: true });
  await fs.rm(emptyWs, { recursive: true });
}

// ─── Run All ───

async function main() {
  console.log("\x1b[1m\n╔════════════════════════════════════════╗");
  console.log("║  Sentura Week 2 — Person A Test Suite  ║");
  console.log("╚════════════════════════════════════════╝\x1b[0m");

  await testWorkspace();
  await testAgentRegistration();
  await testChannelBindings();
  await testMemoryIsolation();
  await testUserToken();
  testRbac();
  await testBootstrapHook();

  console.log(`\n\x1b[1m━━━ Results ━━━\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m`);
  if (failed > 0) {
    console.log(`  \x1b[31m${failed} failed\x1b[0m`);
  }
  console.log(`  ${passed + failed} total\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
