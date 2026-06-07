#!/usr/bin/env tsx
/**
 * Cross-border e-commerce employee/static demo checks.
 *
 * Run: npx tsx scripts/test-cross-border-agents.ts
 *
 * Milestone 4 currently covers the Marketing Acquisition employee and the
 * lead-discovery UI route. Future milestones can extend this file for
 * Screening and Accio Memory without weakening the CE4 assertions.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AGENT_DIR = path.join(ROOT, "sentura/agents/cbe-lead-discovery");
const PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx",
);
const API_ROUTE = path.join(
  ROOT,
  "sentura/dashboard/src/app/api/client-demos/cross-border/lead-discovery/run/route.ts",
);
const SIDEBAR = path.join(ROOT, "sentura/dashboard/src/components/sidebar.tsx");
const SETUP_SH = path.join(ROOT, "scripts/sentura-setup.sh");
const SETUP_PS1 = path.join(ROOT, "scripts/sentura-setup.ps1");

const nativeFiles = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
];

const skillFiles = [
  "skills/lead-query-generation/SKILL.md",
  "skills/lead-deduplication/SKILL.md",
  "skills/lead-list-production/SKILL.md",
  "skills/handoff-to-screening/SKILL.md",
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function exists(file: string): boolean {
  return fs.existsSync(file);
}

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

const agentFiles = exists(AGENT_DIR) ? fs.readdirSync(AGENT_DIR) : [];
const topLevelMarkdown = agentFiles.filter((file) => file.endsWith(".md")).sort();
const config = read(path.join(AGENT_DIR, "config.json5"));
const agents = read(path.join(AGENT_DIR, "AGENTS.md"));
const tools = read(path.join(AGENT_DIR, "TOOLS.md"));
const bootstrap = read(path.join(AGENT_DIR, "BOOTSTRAP.md"));
const page = read(PAGE);
const apiRoute = read(API_ROUTE);
const sidebar = read(SIDEBAR);
const setupSh = read(SETUP_SH);
const setupPs1 = read(SETUP_PS1);

section("CE4 workspace convention");
check("agent directory exists", exists(AGENT_DIR));
for (const file of nativeFiles) {
  check(`native file exists: ${file}`, exists(path.join(AGENT_DIR, file)));
}
check(
  "top-level markdown files are exactly the 8 OpenClaw-native files",
  JSON.stringify(topLevelMarkdown) === JSON.stringify([...nativeFiles].sort()),
  topLevelMarkdown.join(", "),
);
check("config.json5 exists", exists(path.join(AGENT_DIR, "config.json5")));
check("BOOTSTRAP.md carries Enterprise Context", bootstrap.includes("## Enterprise Context"));

section("CE4 config and tool policy");
check("config targets cbe-lead-discovery", config.includes('id: "cbe-lead-discovery"'));
check("config uses embedded OpenClaw runtime", config.includes('runtime: { type: "embedded" }'));
check("config pins non-main sandbox", config.includes('sandbox: { mode: "non-main" }'));
check("config includes OpenClaw agentRuntime pin", config.includes('agentRuntime: { id: "openclaw" }'));
for (const tool of ['"web_search"', '"web_fetch"', '"cron"', '"group:plugins"']) {
  check(`agent allowlist includes ${tool}`, config.includes(tool));
}
check("sandbox allowlist includes cross-border MCP glob", config.includes('"cross-border-intel__*"'));
for (const denied of ['"exec"', '"gateway"', '"write"', '"edit"', '"apply_patch"', '"sessions_spawn"', '"subagents"', '"sessions_yield"', '"message"']) {
  check(`dangerous tool denied: ${denied}`, config.includes(denied));
}
check("config records no automatic outreach blocked action", config.includes('"automatic_outreach"'));
check("config records default mobile-accessory inputs", config.includes('"phone case"') && config.includes('"tempered glass screen protector"') && config.includes('"USB-C charger"'));

section("CE4 skills");
for (const file of skillFiles) {
  check(`skill exists: ${file}`, exists(path.join(AGENT_DIR, file)));
}
const querySkill = read(path.join(AGENT_DIR, "skills/lead-query-generation/SKILL.md"));
const dedupeSkill = read(path.join(AGENT_DIR, "skills/lead-deduplication/SKILL.md"));
const listSkill = read(path.join(AGENT_DIR, "skills/lead-list-production/SKILL.md"));
const handoffSkill = read(path.join(AGENT_DIR, "skills/handoff-to-screening/SKILL.md"));
check("query skill targets company-owned downstream buyer websites", [
  "Company-owned website",
  "Retail and repair buyer",
  "Store/location/contact proof",
  "Reseller/import buyer",
  "Domain exclusions",
].every((needle) => querySkill.includes(needle)));
check("query skill blocks protected social scraping", querySkill.includes("Do not log in to protected sites"));
check("query skill rejects social/directories/marketplaces as leads", querySkill.includes("Reject as leads") && querySkill.includes("Facebook") && querySkill.includes("Europages") && querySkill.includes("GlobalSources"));
check("dedupe skill normalizes by domain/company/email", dedupeSkill.includes("Domain:") && dedupeSkill.includes("Company name:") && dedupeSkill.includes("Email:"));
check("dedupe skill assigns duplicate_status", dedupeSkill.includes("duplicate_status"));
check("list skill defines LeadCandidate JSON shape", listSkill.includes('"lead_id"') && listSkill.includes('"source_urls"') && listSkill.includes('"dedupe_key"'));
check("list skill requires downstream buyer company website", listSkill.includes("company-owned website") && listSkill.includes("downstream buyer candidate"));
check("list skill includes shortage explanation", listSkill.includes("requested count is not reached"));
check("handoff skill outputs typed Screening payload", handoffSkill.includes('"to_agent": "cbe-buyer-screening"') && handoffSkill.includes('"targets"'));
check("handoff skill does not claim Screening has started", handoffSkill.includes("Do not claim an investigation has started"));
check("Hard Rules forbid automatic outreach", agents.includes("NEVER send cold email") && agents.includes("NEVER imply that outreach"));
check("TOOLS.md restricts cross-border-intel usage to light enrichment", tools.includes("light enrichment") && tools.includes("Do not call registry"));

section("CE4 setup integration");
for (const setup of [
  ["bash", setupSh],
  ["powershell", setupPs1],
] as const) {
  check(`${setup[0]} setup copies cbe lead workspace`, setup[1].includes("cbe-lead-discovery"));
  check(`${setup[0]} setup registers webchat binding`, setup[1].includes("Added webchat binding for cbe-lead-discovery"));
  check(`${setup[0]} setup applies MCP sandbox glob`, setup[1].includes("cross-border-intel__*"));
  check(`${setup[0]} setup keeps cron for scheduled runs`, setup[1].includes("'web_search','web_fetch','cron','group:plugins'"));
}

section("CE4 lead-discovery UI and live API route");
check("lead-discovery page exists", exists(PAGE));
check("lead-discovery live API route exists", exists(API_ROUTE));
check("page is a client component", page.startsWith('"use client";'));
check("page calls live lead API route", page.includes('fetch("/api/client-demos/cross-border/lead-discovery/run"'));
check("page uses two-column layout with full-width table", page.includes("xl:grid-cols-[280px_minmax(0,1fr)]") && !page.includes("_390px"));
check("removed auxiliary panels", [
  "查询日志",
  "背调交接包",
  "获客员工对话",
  "实时工具轨迹",
  "<AgentChat",
  "onToolCall",
  "handoffPreview",
].every((needle) => !page.includes(needle)));
check("live route uses Tavily Search API", apiRoute.includes("https://api.tavily.com/search"));
check("live route uses TAVILY_API_KEY bearer auth", apiRoute.includes("TAVILY_API_KEY") && apiRoute.includes("Authorization: `Bearer ${apiKey}`"));
check("live route can read OpenClaw env fallback", apiRoute.includes(".openclaw") && apiRoute.includes("envValue("));
check("live route returns redacted env status", [
  "COMPANIES_HOUSE_API_KEY",
  "ABSTRACT_API_KEY",
  "HUNTER_API_KEY",
  "IMPORTYETI_API_KEY",
  "SEC_USER_AGENT",
  "CBE_ENABLE_PAID_TRADE_DATA",
  "CBE_MAX_PAID_SPEND_USD",
  "CBE_INTEL_REQUEST_TIMEOUT_MS",
].every((needle) => apiRoute.includes(needle)) && apiRoute.includes("configured: configured("));
check("live route emits source-audited company website leads", apiRoute.includes("company_website_mentions_mobile_accessory_business") && apiRoute.includes('source_label: "实时查询"'));
check("live route blocks social/directories/marketplaces", apiRoute.includes("BLOCKED_LEAD_DOMAINS") && apiRoute.includes("facebook.com") && apiRoute.includes("europages.com") && apiRoute.includes("wholesalecentral.com"));
check("live route requires buyer-company relevance", apiRoute.includes("rejectionReasonForResult") && apiRoute.includes("MOBILE_ACCESSORY_TERMS") && apiRoute.includes("BUYER_BUSINESS_TERMS"));
for (const label of ["产品关键词", "买家画像", "国家 / 语言", "目标数量", "单查询上限", "排除域名", "开始获客搜索"]) {
  check(`run builder label exists: ${label}`, page.includes(label));
}
for (const label of ["手机壳", "钢化膜", "充电器", "MagSafe 配件", "维修配件"]) {
  check(`product chip exists: ${label}`, page.includes(label));
}
for (const label of ["英国", "美国", "德国", "法国", "巴西", "墨西哥"]) {
  check(`country control exists: ${label}`, page.includes(label));
}
for (const label of ["维修连锁", "电子零售商", "配件零售商", "手机门店"]) {
  check(`downstream buyer persona exists: ${label}`, page.includes(label));
}
for (const column of ["公司", "国家", "类型", "匹配产品", "域名 / 联系", "来源", "置信度", "去重"]) {
  check(`lead table column exists: ${column}`, page.includes(column));
}
check("page marks table as live query", page.includes("表格: 实时查询"));
check("page starts with empty company-lead table", page.includes("useState<LeadCandidate[]>([])") && page.includes("具体公司官网候选"));
check("page has no baked-in sample lead fixture", !page.includes("sampleLeads") && !page.includes(".example") && !page.includes("demo_fixture") && !page.includes("表格: 演示数据"));
check("page preserves source types and timestamps", page.includes("source_type") && page.includes("fetched_at") && page.includes("sourceTypeLabels"));
check("lead table expands source and dedupe details inline", page.includes("expandedLeadId") && page.includes("colSpan={9}") && page.includes("来源与去重") && page.includes("evidence.query") && page.includes("dedupe_explanation"));
check("page shows live source status from env", page.includes("实时来源状态") && page.includes("Tavily 搜索") && page.includes("Companies House") && page.includes("ImportYeti / 贸易数据"));
check("sidebar links to CBE lead demo", sidebar.includes('href: "/client-demos/cross-border/lead-discovery"') && sidebar.includes("CBE Leads"));
check("page does not expose external outreach send action", !page.includes("自动联系客户") && !page.includes("发送邮件"));

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`Failures: ${failures.join(", ")}`);
  process.exit(1);
}
