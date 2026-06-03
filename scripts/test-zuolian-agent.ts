#!/usr/bin/env tsx
/**
 * Sitlink / Zuolian Milestone 2 offline smoke test.
 *
 * Run: npx tsx scripts/test-zuolian-agent.ts
 *
 * This does not invoke an LLM or a live OpenClaw gateway. It verifies the
 * deployable source shape for the `zuolian-travel-concierge` employee:
 * native workspace files, skill files, MCP wiring, tool allowlists, and
 * load-bearing safety instructions.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSON5 from "../openclaw/node_modules/json5/lib/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AGENT_DIR = path.join(ROOT, "sentura/agents/zuolian-travel-concierge");

const NATIVE_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
];

const SKILLS = [
  "travel-intake",
  "itinerary-planning",
  "dida-hotel-booking",
  "booking-status",
  "feedback-refinement",
];

const DIDA_TOOLS = [
  "dida-travel-demo__dida_demo_search_hotels",
  "dida-travel-demo__dida_demo_get_hotel_details",
  "dida-travel-demo__dida_demo_price_confirm",
  "dida-travel-demo__dida_demo_book_hotel",
  "dida-travel-demo__dida_demo_get_booking",
  "dida-travel-demo__dida_demo_search_transfer",
  "dida-travel-demo__dida_demo_search_attractions",
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(label);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(AGENT_DIR, rel), "utf8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(AGENT_DIR, rel));
}

function parseConfig(): any {
  return JSON5.parse(read("config.json5"));
}

section("Workspace shape");
check("agent directory exists", fs.existsSync(AGENT_DIR), AGENT_DIR);
for (const file of NATIVE_FILES) {
  check(`${file} exists`, exists(file));
}
check("config.json5 exists", exists("config.json5"));
check("no RULES.md present", !exists("RULES.md"));
check("no CONTEXT.md present", !exists("CONTEXT.md"));

section("Skills");
for (const skill of SKILLS) {
  const rel = `skills/${skill}/SKILL.md`;
  const content = exists(rel) ? read(rel) : "";
  check(`${rel} exists`, !!content);
  check(`${skill} has When/Procedure guidance`, /When to Use/i.test(content) && /Procedure/i.test(content));
}

section("Config");
const config = parseConfig();
const agent = config.agents?.list?.find((entry: any) => entry.id === "zuolian-travel-concierge");
check("agents.list contains zuolian-travel-concierge", !!agent);
check("agent runtime is embedded", agent?.runtime?.type === "embedded");
check("agent sandbox is non-main", agent?.sandbox?.mode === "non-main");
check("agent has no systemPrompt field", agent?.systemPrompt === undefined);
check("agent has no workspace override", agent?.workspace === undefined);
check(
  "agent model is pinned to OpenClaw harness",
  agent?.models?.[agent?.model]?.agentRuntime?.id === "openclaw",
  "OpenAI models default to the Codex app-server harness, which can re-expose web_search outside the normal OpenClaw tool policy",
);
check("webchat binding exists", config.bindings?.some((b: any) => b.agentId === "zuolian-travel-concierge" && b.match?.channel === "webchat"));

const allow = agent?.tools?.allow ?? [];
const alsoAllow = agent?.tools?.alsoAllow ?? [];
const sandboxAllow = agent?.tools?.sandbox?.tools?.allow ?? [];
const sandboxAlsoAllow = agent?.tools?.sandbox?.tools?.alsoAllow ?? [];
const toolsMdForConfig = read("TOOLS.md");
const bookingSkillForConfig = read("skills/dida-hotel-booking/SKILL.md");
const itinerarySkillForConfig = read("skills/itinerary-planning/SKILL.md");
check("agent tool profile is coding for OpenClaw MCP bundle exposure", agent?.tools?.profile === "coding");
check("tools.allow exposes Dida MCP plus web supplement", allow.length === 3 && allow.includes("group:plugins") && allow.includes("web_search") && allow.includes("web_fetch"));
check("tools.alsoAllow is not used for Dida runtime exposure", alsoAllow.length === 0);
check("tools.sandbox.tools.allow exposes Dida MCP plus web supplement", sandboxAllow.length === 3 && sandboxAllow.includes("dida-travel-demo__*") && sandboxAllow.includes("web_search") && sandboxAllow.includes("web_fetch"));
check("tools.sandbox.tools.alsoAllow is not used for Dida runtime exposure", sandboxAlsoAllow.length === 0);
check("tools.sandbox.tools.allow does not include non-callable bundle-mcp sentinel", !sandboxAllow.includes("bundle-mcp"));
for (const tool of DIDA_TOOLS) {
  check(
    `workspace references OpenClaw MCP tool ${tool}`,
    toolsMdForConfig.includes(tool) || bookingSkillForConfig.includes(tool),
  );
}
for (const denied of ["exec", "gateway", "write", "edit", "apply_patch"]) {
  check(`tools.deny includes ${denied}`, agent?.tools?.deny?.includes(denied));
}

const mcp = config.mcp?.servers?.["dida-travel-demo"];
check("mcp.servers.dida-travel-demo configured", !!mcp);
check("Dida demo MCP uses node command", mcp?.command === "node");
check("Dida demo MCP points to compiled dist", mcp?.args?.some((arg: string) => arg.endsWith("sentura/mcp-servers/dida-travel-demo/dist/index.js")));
check("Dida demo MCP fixture mode set", mcp?.env?.DIDA_DEMO_MODE === "fixture");

section("Safety instructions");
const agentsMd = read("AGENTS.md");
const toolsMd = read("TOOLS.md");
const bookingSkill = read("skills/dida-hotel-booking/SKILL.md");
const statusSkill = read("skills/booking-status/SKILL.md");

check("Hard Rules section present", agentsMd.includes("## Hard Rules (must not override)"));
check("Simplified Chinese output required", agentsMd.includes("ALWAYS write user-facing replies in Simplified Chinese"));
check("Only status 2 may be confirmed", agentsMd.includes("ONLY say \"酒店预订已确认\" when `dida-travel-demo__dida_demo_get_booking` returns status `2`"));
check("PriceConfirm is source of truth", agentsMd.includes("ALWAYS treat `dida-travel-demo__dida_demo_price_confirm` as the source of truth"));
check("Itinerary must call Dida before final answer", agentsMd.includes("ALWAYS call the Dida demo tools before writing the final answer") && itinerarySkillForConfig.includes("Do not produce the final itinerary"));
check("Web research remains supplement after Dida", agentsMd.includes("use web search only as public-information supplement") && itinerarySkillForConfig.includes("Use web search only after the Dida demo calls"));
check("Booking chain documented in TOOLS.md", toolsMd.includes("dida-travel-demo__dida_demo_price_confirm(preBook=true)") && toolsMd.includes("dida-travel-demo__dida_demo_book_hotel"));
check("Booking skill requires preBook true", bookingSkill.includes("preBook: true") && bookingSkill.includes("referenceNo"));
check("Status skill marks 0/1/5/6 non-final", ["0", "1", "5", "6"].every((s) => statusSkill.includes(`| ${s} |`)) && statusSkill.includes("不是最终状态"));

section("Setup wiring");
const setupSh = fs.readFileSync(path.join(ROOT, "scripts/sentura-setup.sh"), "utf8");
const setupPs1 = fs.readFileSync(path.join(ROOT, "scripts/sentura-setup.ps1"), "utf8");
for (const [label, content] of [
  ["sentura-setup.sh", setupSh],
  ["sentura-setup.ps1", setupPs1],
] as const) {
  check(`${label} copies/registers zuolian client demo agent`, content.includes("zuolian-travel-concierge"));
  check(`${label} wires dida-travel-demo MCP`, content.includes("dida-travel-demo") && content.includes("DIDA_DEMO_MODE"));
  check(`${label} pins zuolian model runtime to OpenClaw`, content.includes("agentRuntime: { id: 'openclaw' }"));
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`Failures: ${failures.join(", ")}`);
  process.exit(1);
}
