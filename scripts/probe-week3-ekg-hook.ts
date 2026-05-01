/**
 * Probe: unit-test the sentura-bootstrap EKG summary injection (D15) without
 * needing a running gateway. Builds a fake workspace with two EKG files,
 * invokes the hook handler directly, and asserts the synthesized
 * EKG_SUMMARY.md matches expected counts.
 *
 * Run from the repo root:
 *   npx tsx scripts/probe-week3-ekg-hook.ts
 *
 * Exit code 0 = pass, 1 = fail. No side effects survive — the temp workspace
 * is cleaned up before exit.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import senturaBootstrapHook from "../sentura/hooks/sentura-bootstrap/handler.ts";

interface BootstrapFile {
  name: string;
  path: string;
  content: string;
  missing: boolean;
}

interface BootstrapContext {
  workspaceDir: string;
  bootstrapFiles: BootstrapFile[];
  sessionKey?: string;
  agentId?: string;
}

const ROLES_JSON5 = `{
  schemaVersion: "1.0",
  pillar: "org",
  domain: "roles",
  entities: [
    { id: "entity:role:cfo", type: "role" },
    { id: "entity:role:ap-clerk", type: "role" },
  ],
  relations: [
    { from: "entity:role:ap-clerk", type: "reports-to", to: "entity:role:cfo" },
  ],
}
`;

const REFUNDS_JSON5 = `{
  pillar: "rules",
  domain: "refunds",
  rules: [
    { id: "rule:refund.under-500", text: "auto-approve refunds under $500" },
  ],
}
`;

async function buildWorkspace(): Promise<string> {
  const ws = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sentura-ekg-hook-"));
  await fs.promises.mkdir(path.join(ws, "ekg", "org"), { recursive: true });
  await fs.promises.mkdir(path.join(ws, "ekg", "rules"), { recursive: true });
  await fs.promises.writeFile(path.join(ws, "ekg", "org", "roles.json5"), ROLES_JSON5);
  await fs.promises.writeFile(path.join(ws, "ekg", "rules", "refunds.json5"), REFUNDS_JSON5);
  return ws;
}

async function runCase(label: string, workspaceDir: string): Promise<BootstrapContext> {
  const ctx: BootstrapContext = { workspaceDir, bootstrapFiles: [] };
  await senturaBootstrapHook({ type: "agent", action: "bootstrap", context: ctx as unknown as Record<string, unknown> });
  console.log(`\n--- ${label} ---`);
  console.log("bootstrapFiles count:", ctx.bootstrapFiles.length);
  for (const file of ctx.bootstrapFiles) {
    console.log(`  - ${file.name} (${file.content.length} bytes)`);
  }
  return ctx;
}

async function main() {
  let pass = 0;
  let fail = 0;

  // --- Case 1: workspace WITH ekg/ -> EKG_SUMMARY.md must be injected ---
  const ws = await buildWorkspace();
  try {
    const ctx = await runCase("workspace with ekg/", ws);
    const summary = ctx.bootstrapFiles.find((f) => f.name === "EKG_SUMMARY.md");
    if (!summary) {
      console.log("✗ D15.3 expected EKG_SUMMARY.md to be injected — got none");
      fail++;
    } else {
      const checks: Array<{ label: string; ok: boolean }> = [
        { label: "header present", ok: summary.content.startsWith("# Enterprise Knowledge Graph (EKG) — Summary") },
        { label: "totals line includes 2 file(s)", ok: summary.content.includes("**2 file(s)**") },
        { label: "totals line includes 2 entity record(s)", ok: summary.content.includes("**2 entity record(s)**") },
        { label: "totals line includes 1 relation(s)", ok: summary.content.includes("**1 relation(s)**") },
        { label: "totals line includes 1 rule(s)", ok: summary.content.includes("**1 rule(s)**") },
        { label: "ekg/org/roles.json5 listed", ok: summary.content.includes("`ekg/org/roles.json5`") },
        { label: "ekg/rules/refunds.json5 listed", ok: summary.content.includes("`ekg/rules/refunds.json5`") },
        { label: "memory_search guidance present", ok: summary.content.includes("`memory_search`") },
        { label: "domain `roles` extracted", ok: summary.content.includes("domain `roles`") },
        { label: "domain `refunds` extracted", ok: summary.content.includes("domain `refunds`") },
      ];
      for (const c of checks) {
        console.log(`${c.ok ? "✓" : "✗"} D15.3 ${c.label}`);
        if (c.ok) pass++;
        else fail++;
      }
      // Print the actual summary so you can eyeball it
      console.log("\n--- EKG_SUMMARY.md ---\n" + summary.content);
    }
  } finally {
    await fs.promises.rm(ws, { recursive: true, force: true });
  }

  // --- Case 2: workspace WITHOUT ekg/ -> nothing should be appended ---
  const ws2 = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sentura-ekg-hook-empty-"));
  try {
    const ctx = await runCase("workspace without ekg/", ws2);
    const ok = ctx.bootstrapFiles.length === 0;
    console.log(`${ok ? "✓" : "✗"} D15.4 missing-ekg workspace adds no extra files (got ${ctx.bootstrapFiles.length})`);
    if (ok) pass++;
    else fail++;
  } finally {
    await fs.promises.rm(ws2, { recursive: true, force: true });
  }

  // --- Case 3: workspace with ekg/ AND a user-token session -> both should land ---
  const ws3 = await buildWorkspace();
  await fs.promises.mkdir(path.join(ws3, "memory", "users"), { recursive: true });
  await fs.promises.writeFile(
    path.join(ws3, "memory", "users", "MEMORY_USER_test123.md"),
    "# Personal memory for test user\nLikes coffee.\n",
  );
  try {
    const ctx: BootstrapContext = {
      workspaceDir: ws3,
      bootstrapFiles: [],
      sessionKey: "agent:creator:user:test123:abc",
    };
    await senturaBootstrapHook({ type: "agent", action: "bootstrap", context: ctx as unknown as Record<string, unknown> });
    const names = ctx.bootstrapFiles.map((f) => f.name);
    console.log("\n--- workspace with ekg/ + user-token session ---");
    console.log("bootstrapFiles names:", names);
    const hasUser = names.includes("MEMORY_USER_test123.md");
    const hasEkg = names.includes("EKG_SUMMARY.md");
    console.log(`${hasUser ? "✓" : "✗"} D15.4 per-user memory still injected alongside EKG`);
    console.log(`${hasEkg ? "✓" : "✗"} D15.4 EKG summary still injected alongside per-user memory`);
    if (hasUser) pass++; else fail++;
    if (hasEkg) pass++; else fail++;
  } finally {
    await fs.promises.rm(ws3, { recursive: true, force: true });
  }

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});
