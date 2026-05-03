/**
 * test-dashboard-integration.ts — End-to-end live tests for the Week 4
 * dashboard surfaces (`/orchestrator`, `/testing`, `/knowledge`) and
 * their Route Handlers.
 *
 * What this verifies:
 *   - Each new Route Handler returns 200 with the expected response shape
 *   - Path-traversal guards reject hostile inputs
 *   - Real on-disk JSON5 / JSON / Markdown is read correctly
 *   - A synthetic SuiteRunResult fixture appears in /api/testing/runs
 *     and the detail handler can read it back
 *   - The page HTML for /orchestrator, /testing, /knowledge renders
 *     (200 + recognizable copy)
 *   - Sidebar nav links resolve (200 for each route the sidebar exposes)
 *   - Person C's existing W4 routes (/api/groups, /chat, /tune,
 *     /integrations) still resolve after the integration
 *
 * Prerequisites:
 *   - Dashboard built (`pnpm --dir sentura/dashboard build`) — script will
 *     start it on a free port if not already running on 3000
 *   - OpenClaw workspace dir exists at ~/.openclaw/workspace/
 *
 * Run:
 *   node --import ./openclaw/node_modules/tsx/dist/loader.mjs \
 *     scripts/test-dashboard-integration.ts
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DASHBOARD_DIR = path.join(ROOT, "sentura/dashboard");
const OPENCLAW_HOME = path.join(os.homedir(), ".openclaw");
const TEST_RUNS_DIR = path.join(OPENCLAW_HOME, "test-runs");
const FIXTURE_TAG = `__integration-test-${Date.now()}`;
const FIXTURE_FILE = `${FIXTURE_TAG}.json5`;
const FIXTURE_PATH = path.join(TEST_RUNS_DIR, FIXTURE_FILE);

// =============================================================================
// Test runner plumbing
// =============================================================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, name: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed += 1;
  } else {
    const line = detail ? `${name} — ${detail}` : name;
    console.log(`  ✗ ${line}`);
    failures.push(line);
    failed += 1;
  }
}

function group(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

async function pickPort(start = 3000, end = 3010): Promise<number> {
  for (let p = start; p <= end; p += 1) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`No free port in [${start}, ${end}]`);
}

async function waitForReady(baseUrl: string, timeoutMs = 60_000): Promise<void> {
  const startedAt = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/orchestrator/ekg`);
      if (res.status === 200) return;
    } catch (err) {
      lastErr = err;
    }
    await sleep(500);
  }
  throw new Error(
    `Dashboard at ${baseUrl} never became ready: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

// =============================================================================
// Dashboard server lifecycle
// =============================================================================

interface ServerHandle {
  baseUrl: string;
  child: ChildProcess | null;
  startedHere: boolean;
}

async function startOrFindDashboard(): Promise<ServerHandle> {
  // If already running on 3000, reuse it
  if (!(await isPortFree(3000))) {
    try {
      const res = await fetch("http://localhost:3000/api/orchestrator/ekg");
      if (res.status === 200) {
        console.log("✓ Reusing dashboard already running on :3000");
        return { baseUrl: "http://localhost:3000", child: null, startedHere: false };
      }
    } catch {
      // not our dashboard
    }
  }

  const port = await pickPort();
  const baseUrl = `http://localhost:${port}`;
  console.log(`→ Starting dashboard on :${port} (this may take ~10s)…`);

  const child = spawn("node_modules/.bin/next", ["start", "-p", String(port)], {
    cwd: DASHBOARD_DIR,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  let stderrBuf = "";
  child.stderr?.on("data", (b) => {
    stderrBuf += b.toString();
  });
  child.stdout?.on("data", () => {
    /* swallow */
  });

  try {
    await waitForReady(baseUrl, 90_000);
  } catch (err) {
    child.kill("SIGTERM");
    console.error(`✗ Dashboard failed to start. stderr tail:\n${stderrBuf.slice(-1000)}`);
    throw err;
  }

  console.log(`✓ Dashboard ready at ${baseUrl}`);
  return { baseUrl, child, startedHere: true };
}

function stopDashboard(srv: ServerHandle): void {
  if (srv.child && srv.startedHere) {
    srv.child.kill("SIGTERM");
  }
}

// =============================================================================
// Fixture: synthetic SuiteRunResult
// =============================================================================

function writeFixture(): void {
  fs.mkdirSync(TEST_RUNS_DIR, { recursive: true });
  const fixture = {
    suite: { id: FIXTURE_TAG, name: "Integration test fixture" },
    iteration: 1,
    runAt: new Date().toISOString(),
    passRate: 0.6,
    recommendation: "auto-tune",
    results: [
      {
        caseId: "case-1",
        passed: true,
        score: 0.95,
      },
      {
        caseId: "case-2",
        passed: false,
        score: 0.2,
        failureReason: "missing_keyword: 'invoice'",
      },
      {
        caseId: "case-3",
        passed: false,
        score: 0,
        failureReason: "safety: hard rule violated — refunded over $500 without approval",
      },
    ],
  };
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2), "utf8");
  console.log(`→ Wrote fixture to ${FIXTURE_PATH}`);
}

function cleanupFixture(): void {
  try {
    if (fs.existsSync(FIXTURE_PATH)) {
      fs.unlinkSync(FIXTURE_PATH);
      console.log(`→ Removed fixture ${FIXTURE_PATH}`);
    }
  } catch {
    /* best effort */
  }
}

// =============================================================================
// Tests
// =============================================================================

async function testOrchestratorEkg(baseUrl: string): Promise<void> {
  group("T-1: /api/orchestrator/ekg");

  const res = await fetch(`${baseUrl}/api/orchestrator/ekg`);
  assert(res.status === 200, "GET /api/orchestrator/ekg returns 200", `got ${res.status}`);

  const body = (await res.json()) as Record<string, unknown>;
  assert(typeof body.workspaceRoot === "string", "response has workspaceRoot");
  assert(typeof body.pillars === "object" && body.pillars !== null, "response has pillars object");
  assert(Array.isArray(body.errors), "response has errors array");

  const pillars = body.pillars as Record<string, unknown>;
  for (const key of ["capabilities", "conflicts", "insights", "globalSops"]) {
    assert(Array.isArray(pillars[key]), `pillars.${key} is an array`);
  }

  const caps = (pillars.capabilities ?? []) as Array<Record<string, unknown>>;
  if (caps.length === 0) {
    console.log("    (no capabilities found on disk — skipping content checks)");
  } else {
    const cap = caps[0];
    assert(typeof cap.filename === "string", "capability has filename");
    assert(typeof cap.data === "object" && cap.data !== null, "capability has parsed data");
    const data = cap.data as Record<string, unknown>;
    assert(typeof data.agentId === "string", "capability.data.agentId is a string (JSON5 unquoted-key parse OK)");
    assert(Array.isArray(data.capabilityTags), "capability.data.capabilityTags is an array");
    assert(typeof data.deployedAt === "string", "capability.data.deployedAt is an ISO-8601 string");
  }
}

async function testKnowledgeAgents(baseUrl: string): Promise<void> {
  group("T-2: /api/knowledge/agents");

  const res = await fetch(`${baseUrl}/api/knowledge/agents`);
  assert(res.status === 200, "GET /api/knowledge/agents returns 200", `got ${res.status}`);

  const body = (await res.json()) as Record<string, unknown>;
  assert(typeof body.workspaceRoot === "string", "response has workspaceRoot");
  assert(Array.isArray(body.agents), "response has agents array");

  const agents = (body.agents ?? []) as Array<Record<string, unknown>>;
  const ids = agents.map((a) => a.agentId);
  assert(!ids.includes("orchestrator"), "orchestrator is hidden from knowledge browser");
  assert(!ids.includes("state"), "state runtime cache is hidden from knowledge browser");

  if (agents.length > 0) {
    const sample = agents.find(
      (a) => Array.isArray(a.ekgFiles) && (a.ekgFiles as unknown[]).length > 0,
    );
    if (sample) {
      const files = sample.ekgFiles as Array<Record<string, unknown>>;
      const f = files[0];
      assert(typeof f.name === "string", "ekg file has name");
      assert(typeof f.sizeBytes === "number" && f.sizeBytes > 0, "ekg file has positive sizeBytes");
      assert(typeof f.modifiedAt === "number", "ekg file has modifiedAt mtimeMs");
    }
  }
}

async function testKnowledgeFile(baseUrl: string): Promise<void> {
  group("T-3: /api/knowledge/agents/[agentId]/file/[filename]");

  // Discover a real agent + file from the listing
  const listRes = await fetch(`${baseUrl}/api/knowledge/agents`);
  const listBody = (await listRes.json()) as { agents?: Array<{ agentId: string; ekgFiles?: Array<{ name: string }> }> };
  const target = listBody.agents?.find((a) => a.ekgFiles && a.ekgFiles.length > 0);

  if (!target || !target.ekgFiles || target.ekgFiles.length === 0) {
    console.log("    (no agent has ekg files — skipping content + 404 checks)");
  } else {
    const agentId = target.agentId;
    const filename = target.ekgFiles[0].name;

    const res = await fetch(
      `${baseUrl}/api/knowledge/agents/${encodeURIComponent(agentId)}/file/${encodeURIComponent(filename)}`,
    );
    assert(res.status === 200, `GET file for ${agentId}/${filename} returns 200`, `got ${res.status}`);

    const body = (await res.json()) as Record<string, unknown>;
    assert(body.name === filename, "response.name matches requested filename");
    assert(typeof body.content === "string" && (body.content as string).length > 0, "response.content is non-empty");
    assert(typeof body.sizeBytes === "number", "response.sizeBytes is a number");
    assert(
      body.contentType === (filename.endsWith(".json5") ? "json5" : "markdown"),
      "response.contentType matches extension",
    );

    // 404 path
    const missing = await fetch(
      `${baseUrl}/api/knowledge/agents/${encodeURIComponent(agentId)}/file/__definitely-missing__.md`,
    );
    assert(missing.status === 404, "missing filename returns 404", `got ${missing.status}`);
  }

  // Path-traversal probes
  const badExt = await fetch(`${baseUrl}/api/knowledge/agents/foo/file/secret.txt`);
  assert(badExt.status === 400, "non-md/json5 extension returns 400", `got ${badExt.status}`);

  const badSeg = await fetch(`${baseUrl}/api/knowledge/agents/foo/file/.hiddenfile.md`);
  assert(badSeg.status === 400, "hidden-prefix filename returns 400", `got ${badSeg.status}`);
}

async function testTestingRunsEmpty(baseUrl: string): Promise<void> {
  group("T-4: /api/testing/runs (basic shape)");

  const res = await fetch(`${baseUrl}/api/testing/runs`);
  assert(res.status === 200, "GET /api/testing/runs returns 200", `got ${res.status}`);

  const body = (await res.json()) as Record<string, unknown>;
  assert(typeof body.runsRoot === "string", "response has runsRoot");
  assert(Array.isArray(body.runs), "response has runs array");
}

async function testTestingRunsWithFixture(baseUrl: string): Promise<void> {
  group("T-5: /api/testing/runs (with synthetic fixture)");

  writeFixture();

  const res = await fetch(`${baseUrl}/api/testing/runs`);
  const body = (await res.json()) as { runs?: Array<Record<string, unknown>> };
  const runs = body.runs ?? [];
  const found = runs.find((r) => r.filename === FIXTURE_FILE);
  assert(found !== undefined, "fixture appears in /api/testing/runs index", `runs=${runs.length}`);

  if (found) {
    assert(found.suiteId === FIXTURE_TAG, "fixture suiteId parsed correctly");
    assert(found.passRate === 0.6, "fixture passRate parsed correctly");
    assert(found.recommendation === "auto-tune", "fixture recommendation parsed correctly");
    assert(found.iteration === 1, "fixture iteration parsed correctly");
    assert(found.totalCases === 3, "fixture totalCases counted correctly");
    assert(found.passedCases === 1, "fixture passedCases counted correctly");
  }
}

async function testTestingRunDetail(baseUrl: string): Promise<void> {
  group("T-6: /api/testing/runs/[runId]");

  const res = await fetch(
    `${baseUrl}/api/testing/runs/${encodeURIComponent(FIXTURE_FILE)}`,
  );
  assert(res.status === 200, "GET fixture detail returns 200", `got ${res.status}`);

  const body = (await res.json()) as Record<string, unknown>;
  assert(body.filename === FIXTURE_FILE, "detail response has filename");
  assert(typeof body.data === "object" && body.data !== null, "detail response has parsed data");

  const data = body.data as Record<string, unknown>;
  const results = data.results as Array<Record<string, unknown>>;
  assert(Array.isArray(results) && results.length === 3, "detail.data.results has 3 entries");
  const safetyRow = results.find((r) =>
    typeof r.failureReason === "string" && (r.failureReason as string).startsWith("safety:"),
  );
  assert(safetyRow !== undefined, "safety: prefix preserved in failureReason");

  // 404 + path-traversal
  const missing = await fetch(`${baseUrl}/api/testing/runs/__nope__.json5`);
  assert(missing.status === 404, "missing run returns 404", `got ${missing.status}`);

  const badExt = await fetch(`${baseUrl}/api/testing/runs/foo.txt`);
  assert(badExt.status === 400, "non-.json5 run id returns 400", `got ${badExt.status}`);

  const traversal = await fetch(`${baseUrl}/api/testing/runs/${encodeURIComponent("../etc/passwd.json5")}`);
  assert(
    traversal.status === 400 || traversal.status === 404,
    "path traversal rejected (400 or 404)",
    `got ${traversal.status}`,
  );
}

async function testPersonCExistingRoutes(baseUrl: string): Promise<void> {
  group("T-7: Person C's existing W4 routes still resolve");

  const groupsRes = await fetch(`${baseUrl}/api/groups`);
  assert(groupsRes.status === 200, "GET /api/groups returns 200", `got ${groupsRes.status}`);
  const groupsBody = (await groupsRes.json()) as Record<string, unknown>;
  assert(Array.isArray(groupsBody.groups), "groups response has groups array");
}

async function testPagesRender(baseUrl: string): Promise<void> {
  group("T-8: Page HTML renders");

  const pages: Array<{ path: string; mustContain: string }> = [
    { path: "/orchestrator", mustContain: "Orchestrator" },
    { path: "/testing", mustContain: "Test Results" },
    { path: "/knowledge", mustContain: "Knowledge Manager" },
    { path: "/cost", mustContain: "Cost" },
    { path: "/integrations", mustContain: "Integrations" },
    { path: "/tune", mustContain: "Tune" },
    { path: "/chat", mustContain: "Chat" },
  ];

  for (const p of pages) {
    const res = await fetch(`${baseUrl}${p.path}`);
    const ok = res.status === 200;
    assert(ok, `GET ${p.path} returns 200`, `got ${res.status}`);
    if (ok) {
      const html = await res.text();
      assert(
        html.toLowerCase().includes(p.mustContain.toLowerCase()),
        `${p.path} HTML contains "${p.mustContain}"`,
      );
    }
  }
}

async function testNoSkeletonOnGraduated(baseUrl: string): Promise<void> {
  group("T-9: Graduated pages no longer use SkeletonShell copy");

  // Next.js' React renderer inserts `<!-- -->` HTML comments between
  // adjacent text fragments (e.g. `Awaiting {blockingOwner}` becomes
  // `Awaiting <!-- -->Person A`), so strip those before substring search.
  const stripFragments = (s: string): string => s.replace(/<!--\s*-->/g, "");

  const stalePhrases = [
    "Awaiting Person",
    "will fill in once",
  ];

  for (const route of ["/orchestrator", "/testing", "/knowledge"]) {
    const html = stripFragments(await (await fetch(`${baseUrl}${route}`)).text());
    const stale = stalePhrases.find((p) => html.includes(p));
    assert(stale === undefined, `${route} HTML has no SkeletonShell stale copy`, stale);
  }

  // /cost SHOULD still have it — it's the one legitimately blocked surface
  const costHtml = stripFragments(await (await fetch(`${baseUrl}/cost`)).text());
  assert(
    costHtml.includes("Awaiting Person"),
    "/cost still uses SkeletonShell (blocked on Person A — intentional)",
  );
}

async function testTuneSuspenseFix(baseUrl: string): Promise<void> {
  group("T-10: /tune Suspense fix (no prerender bailout)");

  const res = await fetch(`${baseUrl}/tune`);
  assert(res.status === 200, "GET /tune returns 200 (Suspense wrap valid)", `got ${res.status}`);
  const html = await res.text();
  assert(!html.includes("missing-suspense-with-csr-bailout"), "/tune does NOT contain Suspense bailout error");
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const srv = await startOrFindDashboard();
  const cleanup = (): void => {
    cleanupFixture();
    stopDashboard(srv);
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    await testOrchestratorEkg(srv.baseUrl);
    await testKnowledgeAgents(srv.baseUrl);
    await testKnowledgeFile(srv.baseUrl);
    await testTestingRunsEmpty(srv.baseUrl);
    await testTestingRunsWithFixture(srv.baseUrl);
    await testTestingRunDetail(srv.baseUrl);
    await testPersonCExistingRoutes(srv.baseUrl);
    await testPagesRender(srv.baseUrl);
    await testNoSkeletonOnGraduated(srv.baseUrl);
    await testTuneSuspenseFix(srv.baseUrl);
  } finally {
    cleanup();
  }

  console.log("\n──────────────────────────────────────────────────");
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  } else {
    console.log("All tests passed.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  cleanupFixture();
  process.exit(1);
});
