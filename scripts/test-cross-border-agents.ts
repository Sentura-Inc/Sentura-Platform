#!/usr/bin/env tsx
/**
 * Cross-border e-commerce employee/static demo checks.
 *
 * Run: npx tsx scripts/test-cross-border-agents.ts
 *
 * Milestone 4 covers Marketing Acquisition and the lead-discovery UI.
 * Milestone 5 covers Screening and Background Investigation.
 * Milestone 6 covers Accio Memory Processing and the Accio UI.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AGENT_DIR = path.join(ROOT, "sentura/agents/cbe-lead-discovery");
const SCREENING_AGENT_DIR = path.join(ROOT, "sentura/agents/cbe-buyer-screening");
const ACCIO_AGENT_DIR = path.join(ROOT, "sentura/agents/cbe-accio-memory");
const ACCIO_FIXTURE = path.join(ROOT, "跨境电商/fixtures/accio-chat-records.sample.json");
const PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx",
);
const API_ROUTE = path.join(
  ROOT,
  "sentura/dashboard/src/app/api/client-demos/cross-border/lead-discovery/run/route.ts",
);
const SCREENING_PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx",
);
const ACCIO_PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx",
);
const SCREENING_API_ROUTE = path.join(
  ROOT,
  "sentura/dashboard/src/app/api/client-demos/cross-border/screening/run/route.ts",
);
const ACCIO_SAMPLE_ROUTE = path.join(
  ROOT,
  "sentura/dashboard/src/app/api/client-demos/cross-border/accio-memory/sample/route.ts",
);
const EMPLOYEE_TASK_RUNNER = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts",
);
const EMPLOYEE_TASK_CANCELLATION = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-cancellation.ts",
);
const EMPLOYEE_API = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts",
);
const EMPLOYEE_NOTIFICATION_TARGETS = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-notification-targets.ts",
);
const EMPLOYEE_DATA = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts",
);
const EMPLOYEE_HOME_PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx",
);
const EMPLOYEE_CUSTOMERS_PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx",
);
const EMPLOYEE_MEMORY_PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx",
);
const ADMIN_EMPLOYEES_PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx",
);
const ADMIN_API = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/admin/_data/admin-api.ts",
);
const ADMIN_OPERATOR_API_ROUTE = path.join(
  ROOT,
  "sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/[id]/route.ts",
);
const ADMIN_COSTS_PAGE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx",
);
const ADMIN_CUSTOMER_LIST_TABLE = path.join(
  ROOT,
  "sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx",
);
const PERSISTENT_UI_STATE_HOOK = path.join(
  ROOT,
  "sentura/dashboard/src/lib/use-persistent-ui-state.ts",
);
const CBE_EMPLOYEE_STORE = path.join(
  ROOT,
  "sentura/dashboard/src/stores/use-cbe-employee-store.ts",
);
const CBE_CUSTOMERS_STORE = path.join(
  ROOT,
  "sentura/dashboard/src/lib/cross-border-store/customers.ts",
);
const CBE_ACCIO_STORE = path.join(
  ROOT,
  "sentura/dashboard/src/lib/cross-border-store/accio.ts",
);
const CBE_STORE_SCHEMAS = path.join(
  ROOT,
  "sentura/dashboard/src/lib/cross-border-store/schemas.ts",
);
const CBE_LEAD_RUNS_STORE = path.join(
  ROOT,
  "sentura/dashboard/src/lib/cross-border-store/lead-runs.ts",
);
const CBE_SCREENING_STORE = path.join(
  ROOT,
  "sentura/dashboard/src/lib/cross-border-store/screening.ts",
);
const CBE_ADMIN_STORE = path.join(
  ROOT,
  "sentura/dashboard/src/lib/cross-border-store/admin.ts",
);
const EMPLOYEE_TASK_STATUS = path.join(
  ROOT,
  "sentura/dashboard/src/components/cross-border/employee-task-status.tsx",
);
const EMPLOYEE_TASK_CANCEL_API = path.join(
  ROOT,
  "sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/[id]/cancel/route.ts",
);
const EMPLOYEE_COST = path.join(
  ROOT,
  "sentura/dashboard/src/components/cross-border/employee-cost.tsx",
);
const EMPLOYEE_COST_BUDGET_API = path.join(
  ROOT,
  "sentura/dashboard/src/app/api/client-demos/cross-border/employee/cost-budget/route.ts",
);
const GATEWAY_CLIENT = path.join(ROOT, "sentura/dashboard/src/lib/gateway/client.ts");
const GATEWAY_TYPES = path.join(ROOT, "sentura/dashboard/src/lib/gateway/types.ts");
const CROSS_BORDER_INTEL_TOOLS = path.join(
  ROOT,
  "sentura/mcp-servers/cross-border-intel/src/tools.ts",
);
const SENTURA_COST_TYPES = path.join(ROOT, "sentura/extensions/sentura-cost/src/types.ts");
const SENTURA_COST_BACKFILL = path.join(ROOT, "sentura/extensions/sentura-cost/src/session-log-backfill.ts");
const APP_SHELL = path.join(ROOT, "sentura/dashboard/src/components/app-shell.tsx");
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
const screeningSkillFiles = [
  "skills/evidence-collection/SKILL.md",
  "skills/registry-verification/SKILL.md",
  "skills/domain-email-verification/SKILL.md",
  "skills/trade-record-check/SKILL.md",
  "skills/buyer-scoring/SKILL.md",
  "skills/report-writing/SKILL.md",
];
const accioSkillFiles = [
  "skills/accio-upload-intake/SKILL.md",
  "skills/chat-normalization/SKILL.md",
  "skills/deal-summary/SKILL.md",
  "skills/customer-profile-memory/SKILL.md",
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
const screeningAgentFiles = exists(SCREENING_AGENT_DIR) ? fs.readdirSync(SCREENING_AGENT_DIR) : [];
const screeningTopLevelMarkdown = screeningAgentFiles.filter((file) => file.endsWith(".md")).sort();
const accioAgentFiles = exists(ACCIO_AGENT_DIR) ? fs.readdirSync(ACCIO_AGENT_DIR) : [];
const accioTopLevelMarkdown = accioAgentFiles.filter((file) => file.endsWith(".md")).sort();
const config = read(path.join(AGENT_DIR, "config.json5"));
const screeningConfig = read(path.join(SCREENING_AGENT_DIR, "config.json5"));
const accioConfig = read(path.join(ACCIO_AGENT_DIR, "config.json5"));
const agents = read(path.join(AGENT_DIR, "AGENTS.md"));
const screeningAgents = read(path.join(SCREENING_AGENT_DIR, "AGENTS.md"));
const accioAgents = read(path.join(ACCIO_AGENT_DIR, "AGENTS.md"));
const tools = read(path.join(AGENT_DIR, "TOOLS.md"));
const screeningTools = read(path.join(SCREENING_AGENT_DIR, "TOOLS.md"));
const accioTools = read(path.join(ACCIO_AGENT_DIR, "TOOLS.md"));
const bootstrap = read(path.join(AGENT_DIR, "BOOTSTRAP.md"));
const screeningBootstrap = read(path.join(SCREENING_AGENT_DIR, "BOOTSTRAP.md"));
const accioBootstrap = read(path.join(ACCIO_AGENT_DIR, "BOOTSTRAP.md"));
const page = read(PAGE);
const apiRoute = read(API_ROUTE);
const screeningPage = read(SCREENING_PAGE);
const screeningApiRoute = read(SCREENING_API_ROUTE);
const accioPage = read(ACCIO_PAGE);
const accioSampleRoute = read(ACCIO_SAMPLE_ROUTE);
const employeeTaskRunner = read(EMPLOYEE_TASK_RUNNER);
const employeeTaskCancellation = read(EMPLOYEE_TASK_CANCELLATION);
const employeeApi = read(EMPLOYEE_API);
const employeeNotificationTargets = read(EMPLOYEE_NOTIFICATION_TARGETS);
const employeeData = read(EMPLOYEE_DATA);
const employeeHomePage = read(EMPLOYEE_HOME_PAGE);
const employeeCustomersPage = read(EMPLOYEE_CUSTOMERS_PAGE);
const employeeMemoryPage = read(EMPLOYEE_MEMORY_PAGE);
const adminEmployeesPage = read(ADMIN_EMPLOYEES_PAGE);
const adminApi = read(ADMIN_API);
const adminOperatorApiRoute = read(ADMIN_OPERATOR_API_ROUTE);
const adminCostsPage = read(ADMIN_COSTS_PAGE);
const adminCustomerListTable = read(ADMIN_CUSTOMER_LIST_TABLE);
const persistentUiStateHook = read(PERSISTENT_UI_STATE_HOOK);
const cbeEmployeeStore = read(CBE_EMPLOYEE_STORE);
const cbeCustomersStore = read(CBE_CUSTOMERS_STORE);
const cbeAccioStore = read(CBE_ACCIO_STORE);
const cbeStoreSchemas = read(CBE_STORE_SCHEMAS);
const leadRunsStore = read(CBE_LEAD_RUNS_STORE);
const screeningStore = read(CBE_SCREENING_STORE);
const cbeAdminStore = read(CBE_ADMIN_STORE);
const employeeTaskStatus = read(EMPLOYEE_TASK_STATUS);
const employeeTaskCancelApi = read(EMPLOYEE_TASK_CANCEL_API);
const employeeCost = read(EMPLOYEE_COST);
const employeeCostBudgetApi = read(EMPLOYEE_COST_BUDGET_API);
const gatewayClient = read(GATEWAY_CLIENT);
const gatewayTypes = read(GATEWAY_TYPES);
const crossBorderIntelTools = read(CROSS_BORDER_INTEL_TOOLS);
const senturaCostTypes = read(SENTURA_COST_TYPES);
const senturaCostBackfill = read(SENTURA_COST_BACKFILL);
const appShell = read(APP_SHELL);
const sidebar = read(SIDEBAR);
const setupSh = read(SETUP_SH);
const setupPs1 = read(SETUP_PS1);
const accioFixture = JSON.parse(read(ACCIO_FIXTURE)) as {
  export_metadata: Record<string, unknown>;
  conversations: Array<{
    conversation_id: string;
    buyer: Record<string, unknown>;
    messages: Array<{ text: string; sender: string }>;
    attachments?: unknown[];
  }>;
};

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
  check(`agent alsoAllow includes ${tool}`, config.includes("alsoAllow") && config.includes(tool));
}
check("sandbox alsoAllow includes cross-border MCP glob", config.includes("sandbox") && config.includes("alsoAllow") && config.includes('"cross-border-intel__*"'));
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
check("list skill defines Dashboard JSON markers", listSkill.includes("LEAD_CANDIDATES_JSON_START") && listSkill.includes("LEAD_CANDIDATES_JSON_END"));
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
  check(`${setup[0]} setup uses cbe lead alsoAllow`, setup[1].includes("alsoAllow: cbeLeadToolAllow") && setup[1].includes("alsoAllow: cbeLeadSandboxAllow"));
  check(`${setup[0]} setup keeps cron for scheduled runs`, setup[1].includes("'web_search','web_fetch','cron','group:plugins'"));
  check(`${setup[0]} setup raises default agent timeout for long CBE tasks`, setup[1].includes("agents.defaults.timeoutSeconds") && setup[1].includes("SENTURA_AGENT_TIMEOUT_SECONDS"));
  check(`${setup[0]} setup raises OpenAI provider idle timeout for long CBE tasks`, setup[1].includes("ensureModelProviderTimeout") && setup[1].includes("models.providers") && setup[1].includes("timeoutSeconds: senturaLongAgentTimeoutSeconds"));
}

section("CE4 lead-discovery UI and diagnostic API route");
check("lead-discovery page exists", exists(PAGE));
check("lead-discovery diagnostic API route exists", exists(API_ROUTE));
check("page is a client component", page.startsWith('"use client";'));
check("lead page does not bypass employee with direct API fetch", !page.includes('fetch("/api/client-demos/cross-border/lead-discovery/run"') && page.includes("chatRef.current.sendMessage") && page.includes("buildEmployeePrompt"));
check("lead page triggers real cbe-lead-discovery AgentChat", page.includes('const LEAD_AGENT_ID = "cbe-lead-discovery"') && page.includes("<AgentChat") && page.includes("agentId={LEAD_AGENT_ID}") && page.includes("useAgent(LEAD_AGENT_ID)") && page.includes("onMessage={handleEmployeeMessage}") && page.includes("onToolCall={handleEmployeeToolCall}"));
check("lead page parses employee lead JSON markers", page.includes("LEAD_CANDIDATES_JSON_START") && page.includes("LEAD_CANDIDATES_JSON_END") && page.includes("extractLeadsFromEmployeeText") && page.includes("normalizeLeadCandidate"));
check("page keeps main table dominant with employee execution panel", page.includes("2xl:grid-cols-[280px_minmax(0,1fr)_380px]") && page.includes("获客员工执行"));
check("removed non-execution auxiliary panels", [
  "查询日志",
  "背调交接包",
  "实时工具轨迹",
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
for (const label of ["产品关键词", "买家画像", "国家 / 语言", "目标数量", "单查询上限", "排除域名", "让获客员工开始搜索"]) {
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
check("page marks table as employee execution", page.includes("表格: 员工执行"));
check("page starts with empty company-lead table", page.includes("useState<LeadCandidate[]>([])") && page.includes("具体公司官网候选"));
check("page has no baked-in sample lead fixture", !page.includes("sampleLeads") && !page.includes(".example") && !page.includes("demo_fixture") && !page.includes("表格: 演示数据"));
check("page preserves source types and timestamps", page.includes("source_type") && page.includes("fetched_at") && page.includes("sourceTypeLabels"));
check("lead table expands source and dedupe details inline", page.includes("expandedLeadId") && page.includes("colSpan={9}") && page.includes("来源与去重") && page.includes("evidence.query") && page.includes("dedupe_explanation"));
check("lead page persists search state and employee session", page.includes("LEAD_DISCOVERY_STORAGE_KEY") && page.includes("sentura:cbe:lead-discovery:v1") && page.includes("localStorage.setItem") && page.includes("localStorage.getItem") && page.includes("leadSessionKey"));
check("lead page has one-click and per-result Screening copy", page.includes("一键复制到背调") && page.includes("复制 ${lead.company_name} 到背调输入格式") && page.includes("navigator.clipboard.writeText"));
check("lead copy payload matches Screening batch input", page.includes("buildScreeningBatchPayload") && page.includes("JSON.stringify({ leads: nextLeads.map(leadToScreeningInput) }") && page.includes("matched_products") && page.includes("contact_candidates"));
check("page shows live source status from env", page.includes("实时来源状态") && page.includes("Tavily 搜索") && page.includes("Companies House") && page.includes("ImportYeti / 贸易数据"));
check("sidebar links to CBE lead demo", sidebar.includes('href: "/client-demos/cross-border/lead-discovery"') && sidebar.includes("CBE Leads"));
check("page does not expose external outreach send action", !page.includes("自动联系客户") && !page.includes("发送邮件"));

section("CE5 workspace convention");
check("screening agent directory exists", exists(SCREENING_AGENT_DIR));
for (const file of nativeFiles) {
  check(`screening native file exists: ${file}`, exists(path.join(SCREENING_AGENT_DIR, file)));
}
check(
  "screening top-level markdown files are exactly the 8 OpenClaw-native files",
  JSON.stringify(screeningTopLevelMarkdown) === JSON.stringify([...nativeFiles].sort()),
  screeningTopLevelMarkdown.join(", "),
);
check("screening config.json5 exists", exists(path.join(SCREENING_AGENT_DIR, "config.json5")));
check("screening BOOTSTRAP.md carries Enterprise Context", screeningBootstrap.includes("## Enterprise Context"));

section("CE5 config and tool policy");
check("screening config targets cbe-buyer-screening", screeningConfig.includes('id: "cbe-buyer-screening"'));
check("screening config uses embedded OpenClaw runtime", screeningConfig.includes('runtime: { type: "embedded" }'));
check("screening config pins non-main sandbox", screeningConfig.includes('sandbox: { mode: "non-main" }'));
check("screening config includes OpenClaw agentRuntime pin", screeningConfig.includes('agentRuntime: { id: "openclaw" }'));
for (const tool of ['"web_search"', '"web_fetch"', '"memory_search"', '"memory_get"', '"group:plugins"']) {
  check(`screening alsoAllow includes ${tool}`, screeningConfig.includes("alsoAllow") && screeningConfig.includes(tool));
}
check("screening sandbox alsoAllow includes cross-border MCP glob", screeningConfig.includes("sandbox") && screeningConfig.includes("alsoAllow") && screeningConfig.includes('"cross-border-intel__*"'));
for (const denied of ['"exec"', '"gateway"', '"write"', '"edit"', '"apply_patch"', '"sessions_spawn"', '"subagents"', '"sessions_yield"', '"message"', '"cron"']) {
  check(`screening dangerous tool denied: ${denied}`, screeningConfig.includes(denied));
}
check("screening config blocks uncapped paid lookup", screeningConfig.includes('"uncapped_paid_lookup"'));

section("CE5 skills");
for (const file of screeningSkillFiles) {
  check(`screening skill exists: ${file}`, exists(path.join(SCREENING_AGENT_DIR, file)));
}
const evidenceSkill = read(path.join(SCREENING_AGENT_DIR, "skills/evidence-collection/SKILL.md"));
const registrySkill = read(path.join(SCREENING_AGENT_DIR, "skills/registry-verification/SKILL.md"));
const domainSkill = read(path.join(SCREENING_AGENT_DIR, "skills/domain-email-verification/SKILL.md"));
const tradeSkill = read(path.join(SCREENING_AGENT_DIR, "skills/trade-record-check/SKILL.md"));
const scoringSkill = read(path.join(SCREENING_AGENT_DIR, "skills/buyer-scoring/SKILL.md"));
const reportSkill = read(path.join(SCREENING_AGENT_DIR, "skills/report-writing/SKILL.md"));
check("evidence skill normalizes batch and manual inputs", evidenceSkill.includes("marketing_lead_batch") && evidenceSkill.includes("manual_input") && evidenceSkill.includes("InvestigationTarget"));
check("registry skill prioritizes Companies House and SEC", registrySkill.includes("cbe_intel_company_registry_search") && registrySkill.includes("cbe_intel_sec_lookup"));
check("registry skill forces GB Companies House and US SEC before web fallback", registrySkill.includes("country=GB") && registrySkill.includes("always call `cross-border-intel__cbe_intel_company_registry_search` before public web search") && registrySkill.includes("country=US") && registrySkill.includes("company_tickers.json") && registrySkill.includes("then state registry or official registry web search fallback"));
check("domain skill calls RDAP/email checks and paid validation only when enabled", domainSkill.includes("cbe_intel_domain_rdap_lookup") && domainSkill.includes("cbe_intel_email_domain_check") && domainSkill.includes("enable_paid_validation=true"));
check("domain skill discovers official-site emails before paid validation", domainSkill.includes("cbe_intel_official_contact_email_search") && domainSkill.includes("same-domain business emails") && domainSkill.includes("best same-domain public contact email"));
check("trade skill preserves budget and missing-data semantics", tradeSkill.includes("ImportYeti") && tradeSkill.includes("disabled_by_budget") && tradeSkill.includes("coverage gap"));
check("scoring skill uses contextual score blocks and forced downgrades", scoringSkill.includes("not_applicable") && scoringSkill.includes("cross-border-intel__cbe_intel_score_buyer") && scoringSkill.includes("forced downgrades"));
check("report skill defines ScreeningReport JSON output", reportSkill.includes("ScreeningReport") && reportSkill.includes("missing_or_unavailable_evidence") && reportSkill.includes("evidence_coverage"));
check("screening Hard Rules forbid invented evidence and missing-data fraud claims", screeningAgents.includes("NEVER invent registry records") && screeningAgents.includes("NEVER treat missing paid/API evidence as proof of fraud"));
check("screening TOOLS.md lists read-only MCP tools", screeningTools.includes("cross-border-intel__cbe_intel_company_registry_search") && screeningTools.includes("cross-border-intel__cbe_intel_official_contact_email_search") && screeningTools.includes("cross-border-intel__cbe_intel_score_buyer"));

section("CE5 setup integration");
for (const setup of [
  ["bash", setupSh],
  ["powershell", setupPs1],
] as const) {
  check(`${setup[0]} setup copies cbe screening workspace`, setup[1].includes("cbe-buyer-screening"));
  check(`${setup[0]} setup registers screening webchat binding`, setup[1].includes("Added webchat binding for cbe-buyer-screening"));
  check(`${setup[0]} setup applies screening MCP sandbox glob`, setup[1].includes("cbeScreeningSandboxAllow") && setup[1].includes("cross-border-intel__*"));
  check(`${setup[0]} setup uses screening alsoAllow`, setup[1].includes("alsoAllow: cbeScreeningToolAllow") && setup[1].includes("alsoAllow: cbeScreeningSandboxAllow"));
  check(`${setup[0]} setup allows screening memory tools`, setup[1].includes("'web_search','web_fetch','memory_search','memory_get','group:plugins'"));
}

section("CE5 Screening UI and live API route");
check("screening page exists", exists(SCREENING_PAGE));
check("screening live API route exists", exists(SCREENING_API_ROUTE));
check("screening page is a client component", screeningPage.startsWith('"use client";'));
check("screening page does not bypass employee with direct API report fetch", !screeningPage.includes('fetch("/api/client-demos/cross-border/screening/run"') && screeningPage.includes("chatRef.current.sendMessage") && screeningPage.includes("buildEmployeePrompt"));
check("screening UI has batch and manual intake tabs", screeningPage.includes("来自获客列表") && screeningPage.includes("手动背调"));
for (const label of ["公司名称", "国家，如 GB", "网站 / Website", "域名 / Domain", "邮箱 / Email", "联系人", "职位", "社媒/公开资料 URL", "产品兴趣，逗号分隔", "操作员备注 / Accio 行为线索"]) {
  check(`manual screening field exists: ${label}`, screeningPage.includes(label));
}
check("screening UI exposes source/budget toggles", screeningPage.includes("Abstract/Hunter 邮箱验证") && screeningPage.includes("ImportYeti 付费贸易数据") && screeningPage.includes("单次预算上限 USD"));
check("screening UI groups evidence timeline", ["法律注册", "域名/邮箱", "公开足迹", "贸易/海关", "财务/公开申报", "行为记录"].every((label) => screeningPage.includes(label)));
check("screening UI separates normalized score and coverage", screeningPage.includes("证据覆盖") && screeningPage.includes("normalized_score") && screeningPage.includes("evidence_coverage"));
check("screening UI shows unavailable sources as gaps", screeningPage.includes("缺口 / 未启用证据") && screeningPage.includes("未启用/不可用"));
check("screening UI triggers real cbe-buyer-screening AgentChat", screeningPage.includes('const SCREENING_AGENT_ID = "cbe-buyer-screening"') && screeningPage.includes("<AgentChat") && screeningPage.includes("agentId={SCREENING_AGENT_ID}") && screeningPage.includes("useAgent(SCREENING_AGENT_ID)") && screeningPage.includes("onMessage={handleEmployeeMessage}"));
check("screening employee prompt enforces official API and paid-email order", screeningPage.includes("GB 目标必须先调用 Companies House") && screeningPage.includes("US 目标必须先调用 SEC") && screeningPage.includes("从目标官网公开 contact/about/sales/wholesale/support 页面寻找同域邮箱") && screeningPage.includes("Abstract/Hunter paid validation"));
check("screening employee prompt defines weighted final score rule", ["证据质量分 80% + 证据覆盖率分 20%", "risk_tier 只按最终分判断", "80-100", "60-79", "完全无法计算时才用 insufficient_evidence"].every((needle) => screeningPage.includes(needle)));
check("screening UI supports JSON report export", screeningPage.includes("导出报告 JSON") && screeningPage.includes("Blob([JSON.stringify(selectedReport"));
check("screening page persists investigation state", screeningPage.includes("SCREENING_STORAGE_KEY") && screeningPage.includes("sentura:cbe:screening:v1") && screeningPage.includes("localStorage.setItem") && screeningPage.includes("localStorage.getItem") && screeningPage.includes("reports"));
check("screening UI maps employee report JSON into visual panels", ["normalizeScreeningReport", "normalizeEvidenceItem", "normalizeMissingEvidence", "normalizeScreeningReports(stored.reports)", "source_url", "summary", "detail", "scoreBlockToLayer", "official_web", "registry_tool"].every((needle) => screeningPage.includes(needle)));
check("sidebar links to CBE Screening demo", sidebar.includes('href: "/client-demos/cross-border/screening"') && sidebar.includes("CBE Screening"));
check("screening route reads OpenClaw env fallback", screeningApiRoute.includes(".openclaw") && screeningApiRoute.includes("envValue("));
check("screening route calls Tavily Search API", screeningApiRoute.includes("https://api.tavily.com/search") && screeningApiRoute.includes("Authorization: `Bearer ${apiKey}`"));
check("screening route calls Companies House API with Basic auth", screeningApiRoute.includes("api.company-information.service.gov.uk/search/companies") && screeningApiRoute.includes("companiesHouseAuthHeader"));
check("screening route treats Companies House API non-2xx as coverage gap", screeningApiRoute.includes("Companies House API 返回 HTTP ${response.status}，改用官方公开网页兜底。") && screeningApiRoute.includes('score_impact: "coverage_only"') && screeningApiRoute.includes("affects_score: false"));
check("screening route falls back to Companies House public official page", screeningApiRoute.includes("https://find-and-update.company-information.service.gov.uk/search/companies") && screeningApiRoute.includes("parseCompaniesHouseSearchResults") && screeningApiRoute.includes('"official_registry_page"'));
check("screening route calls RDAP and DNS checks", screeningApiRoute.includes("https://rdap.org/domain") && screeningApiRoute.includes("resolveMx") && screeningApiRoute.includes("resolveTxt"));
check("screening route calls Abstract Email Reputation API", screeningApiRoute.includes("https://emailreputation.abstractapi.com/v1/") && screeningApiRoute.includes("ABSTRACT_API_KEY") && screeningApiRoute.includes("email_deliverability"));
check("screening route calls Hunter API", screeningApiRoute.includes("https://api.hunter.io/v2/email-verifier") && screeningApiRoute.includes("HUNTER_API_KEY"));
check("screening route calls ImportYeti with documented header, search parameter, and budget controls", screeningApiRoute.includes("https://data.importyeti.com/v1.0/company/search") && screeningApiRoute.includes("IYApiKey") && screeningApiRoute.includes('url.searchParams.set("name"') && screeningApiRoute.includes("CBE_ENABLE_PAID_TRADE_DATA") && screeningApiRoute.includes("CBE_MAX_PAID_SPEND_USD"));
check("screening route treats ImportYeti non-2xx as coverage gap", screeningApiRoute.includes('status = response.ok ? "scored" : "unavailable_api"') && screeningApiRoute.includes("earnedPoints = response.ok ? (hasProductSignal ? 9 : 7) : null") && screeningApiRoute.includes("ImportYeti 返回 HTTP ${response.status}，未计入贸易/财务评分。") && screeningApiRoute.includes("affects_score: response.ok"));
check("screening route calls SEC EDGAR with configured or default User-Agent", screeningApiRoute.includes("https://data.sec.gov/submissions/CIK") && screeningApiRoute.includes("SEC_USER_AGENT") && screeningApiRoute.includes("SEC_DEFAULT_USER_AGENT") && screeningApiRoute.includes('"User-Agent"'));
check("screening route resolves US company name to SEC CIK automatically", screeningApiRoute.includes("https://www.sec.gov/files/company_tickers.json") && screeningApiRoute.includes("resolveSecCikByCompanyName") && screeningApiRoute.includes('target.country === "US" || target.sec_cik'));
check("lead and screening env status mark SEC as no-key public data", apiRoute.includes("no_api_key_required: true") && screeningApiRoute.includes("no_api_key_required: true") && page.includes("无需 API key") && screeningPage.includes("无需 API key"));
check("screening route gates public adverse downgrades by target relevance", screeningApiRoute.includes("const adverse = targetSpecific && adverseTerm") && screeningApiRoute.includes("affects_score: targetSpecific") && screeningApiRoute.includes('"coverage_only"'));
check("screening route weights coverage into final score", ["SCORE_QUALITY_WEIGHT = 0.8", "EVIDENCE_COVERAGE_WEIGHT = 0.2", "HIGH_SCORE_THRESHOLD = 80", "MEDIUM_SCORE_THRESHOLD = 60", "riskTierForFinalScore", "FORCED_DOWNGRADE_SCORE_CAP"].every((needle) => screeningApiRoute.includes(needle)));
check("screening route returns redacted env status only", [
  "TAVILY_API_KEY",
  "COMPANIES_HOUSE_API_KEY",
  "ABSTRACT_API_KEY",
  "HUNTER_API_KEY",
  "IMPORTYETI_API_KEY",
  "SEC_USER_AGENT",
  "CBE_ENABLE_PAID_TRADE_DATA",
  "CBE_MAX_PAID_SPEND_USD",
  "CBE_INTEL_REQUEST_TIMEOUT_MS",
].every((needle) => screeningApiRoute.includes(needle)) && screeningApiRoute.includes("configured("));
check("screening route normalizes manual and lead targets", screeningApiRoute.includes("normalizeManualTarget") && screeningApiRoute.includes("normalizeLeadTarget") && screeningApiRoute.includes("supplied_fields") && screeningApiRoute.includes("missing_fields"));
check("screening route applies contextual scoring and forced downgrades", screeningApiRoute.includes("calculateScore") && screeningApiRoute.includes("not_applicable") && screeningApiRoute.includes("forcedDowngrades"));
check("screening route preserves source metadata", ["source_type", "fetched_at", "confidence", "cost_usd", "score_block", "score_impact"].every((needle) => screeningApiRoute.includes(needle)));

section("CE6 Accio workspace convention");
check("accio agent directory exists", exists(ACCIO_AGENT_DIR));
for (const file of nativeFiles) {
  check(`accio native file exists: ${file}`, exists(path.join(ACCIO_AGENT_DIR, file)));
}
check(
  "accio top-level markdown files are exactly the 8 OpenClaw-native files",
  JSON.stringify(accioTopLevelMarkdown) === JSON.stringify([...nativeFiles].sort()),
  accioTopLevelMarkdown.join(", "),
);
check("accio config.json5 exists", exists(path.join(ACCIO_AGENT_DIR, "config.json5")));
check("accio BOOTSTRAP.md carries Enterprise Context", accioBootstrap.includes("## Enterprise Context"));

section("CE6 config and tool policy");
check("accio config targets cbe-accio-memory", accioConfig.includes('id: "cbe-accio-memory"'));
check("accio config uses embedded OpenClaw runtime", accioConfig.includes('runtime: { type: "embedded" }'));
check("accio config pins non-main sandbox", accioConfig.includes('sandbox: { mode: "non-main" }'));
check("accio config includes OpenClaw agentRuntime pin", accioConfig.includes('agentRuntime: { id: "openclaw" }'));
for (const tool of ['"memory_search"', '"memory_get"', '"group:plugins"']) {
  check(`accio alsoAllow includes ${tool}`, accioConfig.includes("alsoAllow") && accioConfig.includes(tool));
}
check("accio sandbox alsoAllow includes cross-border MCP glob", accioConfig.includes("sandbox") && accioConfig.includes("alsoAllow") && accioConfig.includes('"cross-border-intel__*"'));
for (const denied of ['"exec"', '"gateway"', '"write"', '"edit"', '"apply_patch"', '"sessions_spawn"', '"subagents"', '"sessions_yield"', '"message"', '"read"']) {
  check(`accio dangerous tool denied: ${denied}`, accioConfig.includes(denied));
}
check("accio config blocks raw chat external share", accioConfig.includes('"raw_chat_external_share"') && accioConfig.includes('"raw_chat_memory_write"'));

section("CE6 skills");
for (const file of accioSkillFiles) {
  check(`accio skill exists: ${file}`, exists(path.join(ACCIO_AGENT_DIR, file)));
}
const accioIntakeSkill = read(path.join(ACCIO_AGENT_DIR, "skills/accio-upload-intake/SKILL.md"));
const accioNormalizationSkill = read(path.join(ACCIO_AGENT_DIR, "skills/chat-normalization/SKILL.md"));
const accioDealSkill = read(path.join(ACCIO_AGENT_DIR, "skills/deal-summary/SKILL.md"));
const accioMemorySkill = read(path.join(ACCIO_AGENT_DIR, "skills/customer-profile-memory/SKILL.md"));
const accioHandoffSkill = read(path.join(ACCIO_AGENT_DIR, "skills/handoff-to-screening/SKILL.md"));
check("intake skill validates Accio export and parser tool", accioIntakeSkill.includes("cbe_intel_parse_accio_chat") && accioIntakeSkill.includes("conversation count"));
check("normalization skill preserves source identifiers and attachments", accioNormalizationSkill.includes("conversation_id") && accioNormalizationSkill.includes("attachments") && accioNormalizationSkill.includes("source identifiers"));
check("deal skill calls Accio summarizer and JSON markers", accioDealSkill.includes("cbe_intel_summarize_accio_chat") && accioDealSkill.includes("ACCIO_SUMMARIES_JSON_START") && accioDealSkill.includes("ACCIO_SUMMARIES_JSON_END"));
check("memory skill produces preview_only facts without raw chat", accioMemorySkill.includes("memory_write_preview") && accioMemorySkill.includes("preview_only") && accioMemorySkill.includes("Do not include raw message text"));
check("handoff skill emits accio_memory InvestigationTarget", accioHandoffSkill.includes('source: "accio_memory"') && accioHandoffSkill.includes("InvestigationTarget") && accioHandoffSkill.includes("Do not call Screening tools yourself"));
check("accio Hard Rules forbid raw chat leakage and invented deal facts", accioAgents.includes("NEVER send raw Accio chat") && accioAgents.includes("NEVER invent buyer company information"));
check("accio TOOLS.md lists Accio parser/summarizer tools only", accioTools.includes("cross-border-intel__cbe_intel_parse_accio_chat") && accioTools.includes("cross-border-intel__cbe_intel_summarize_accio_chat") && accioTools.includes("Do not use registry"));

section("CE6 setup integration");
for (const setup of [
  ["bash", setupSh],
  ["powershell", setupPs1],
] as const) {
  check(`${setup[0]} setup copies cbe accio workspace`, setup[1].includes("cbe-accio-memory"));
  check(`${setup[0]} setup registers accio webchat binding`, setup[1].includes("Added webchat binding for cbe-accio-memory"));
  check(`${setup[0]} setup applies accio MCP sandbox glob`, setup[1].includes("cbeAccioSandboxAllow") && setup[1].includes("cross-border-intel__*"));
  check(`${setup[0]} setup uses accio alsoAllow`, setup[1].includes("alsoAllow: cbeAccioToolAllow") && setup[1].includes("alsoAllow: cbeAccioSandboxAllow"));
  check(`${setup[0]} setup allows accio memory tools`, setup[1].includes("'memory_search','memory_get','group:plugins'"));
}

section("CE6 fixture and report correctness");
check("Accio fixture contains exactly three conversations", accioFixture.conversations.length === 3);
check("fixture identifies Alibaba Accio and T3 demo data", accioFixture.export_metadata.platform === "Alibaba Accio" && String(accioFixture.export_metadata.data_classification).includes("T3"));
const fixtureCompanies = accioFixture.conversations.map((conversation) => conversation.buyer.company_name);
check("fixture covers Andes/Berlin/Northstar buyers", ["Andes Mobile Parts SpA", "Berlin Gadget Wholesale GmbH", "Northstar Wireless LLC"].every((name) => fixtureCompanies.includes(name)));
const fixtureText = accioFixture.conversations.map((conversation) => conversation.messages.map((message) => message.text).join(" ")).join("\n");
check("fixture covers required products", ["tempered glass", "65W GaN chargers", "MagSafe accessories"].every((needle) => fixtureText.includes(needle)));
check("fixture covers required quantities", ["10,000 pcs", "500 pcs", "15,000 pcs", "20,000 pcs"].every((needle) => fixtureText.includes(needle)));
check("fixture covers negotiated prices and add-ons", ["USD 0.35", "USD 0.36", "USD 0.03", "USD 6.50", "USD 6.80", "USD 1.10", "USD 0.015", "USD 0.08"].every((needle) => fixtureText.includes(needle)));
check("Accio page does not precompute fixture reports", !["function summarizeExport", "function summarizeConversation", "quantityValue = 10000", "monthlyPotential = 20000"].some((needle) => accioPage.includes(needle)));
check("Accio load clears reports and waits for employee analysis", accioPage.includes("setSummaries([])") && accioPage.includes('setRunStatus("loaded")') && accioPage.includes("等待记忆员工分析后展示高亮、报告和背调预览"));
check("Accio highlights depend on employee returned summary", accioPage.includes("highlightText(text: string, summary?: AccioSummary)") && accioPage.includes("for (const intent of summary.purchase_intent)") && accioPage.includes("highlightText(message.text, selectedSummary)"));
check("Accio summaries include memory preview and Screening handoff", accioPage.includes("memory_write_preview") && accioPage.includes("screening_handoff_target") && accioPage.includes('source: "accio_memory"'));

section("CE7 Accio UI route");
check("accio page exists", exists(ACCIO_PAGE));
check("accio sample API route exists", exists(ACCIO_SAMPLE_ROUTE));
check("accio page is a client component", accioPage.startsWith('"use client";'));
check("accio sample route reads fixture from 跨境电商/fixtures", accioSampleRoute.includes("accio-chat-records.sample.json") && accioSampleRoute.includes("fs.readFile") && accioSampleRoute.includes("演示数据"));
check("accio UI supports sample load and JSON upload", accioPage.includes("加载演示 Accio 记录") && accioPage.includes("上传 Accio JSON") && accioPage.includes("accept=\"application/json,.json\""));
check("accio UI shows validation status and conversation count", accioPage.includes("conversationCount") && accioPage.includes("数据等级") && accioPage.includes("对话数"));
check("accio UI shows conversation list with company/country/product/price context", accioPage.includes("对话列表") && accioPage.includes("conversation.buyer.company_name") && accioPage.includes("intent?.product") && accioPage.includes("quantity(intent?.quantity)"));
check("accio UI renders transcript and employee-returned highlights", accioPage.includes("原始对话与提取高亮") && accioPage.includes("员工返回结构化报告前不显示提取高亮") && accioPage.includes("addHighlightPrice"));
check("accio UI renders attachment list", accioPage.includes("附件") && accioPage.includes("selectedConversation.attachments"));
check("accio UI renders structured report table", accioPage.includes("三条模拟对话结构化报告") && ["公司", "产品/型号", "数量", "目标价", "最佳/约定价", "下一步"].every((needle) => accioPage.includes(needle)));
check("accio UI renders memory/report panel", ["记忆 / 背调预览", "采购意向", "谈判摘要", "行为信号", "写入记忆预览", "发送到背调"].every((needle) => accioPage.includes(needle)));
check("accio UI triggers real cbe-accio-memory AgentChat", accioPage.includes('const ACCIO_AGENT_ID = "cbe-accio-memory"') && accioPage.includes("<AgentChat") && accioPage.includes("agentId={ACCIO_AGENT_ID}") && accioPage.includes("useAgent(ACCIO_AGENT_ID)") && accioPage.includes("onMessage={handleEmployeeMessage}"));
check("accio employee prompt requires tool analysis and JSON markers", accioPage.includes("buildEmployeePrompt") && accioPage.includes("先调用 Accio parser 工具") && accioPage.includes("不要使用示例模板") && accioPage.includes("ACCIO_SUMMARIES_JSON_START") && accioPage.includes("ACCIO_SUMMARIES_JSON_END"));
check("accio UI parses employee summaries from markers", accioPage.includes("extractSummariesFromEmployeeText") && accioPage.includes("normalizeSummary") && accioPage.includes("setSummaries(parsed)"));
check("accio UI preserves local T2/T3 and preview-only memory behavior", accioPage.includes("memory_write_preview 已复制，仍未写入长期记忆") && accioPage.includes("preview_only") && !accioPage.includes("自动联系客户"));
check("accio UI persists last upload/report/session state", accioPage.includes("ACCIO_STORAGE_KEY") && accioPage.includes("sentura:cbe:accio-memory:v2") && accioPage.includes("localStorage.setItem") && accioPage.includes("localStorage.getItem") && accioPage.includes("accioSessionKey"));
check("sidebar links to CBE Accio demo", sidebar.includes('href: "/client-demos/cross-border/accio-memory"') && sidebar.includes("CBE Accio"));

section("CE8 Employee hidden runner");
check("employee hidden runner exists", exists(EMPLOYEE_TASK_RUNNER));
check("employee runner creates session before long task send", employeeTaskRunner.includes("client.createSession(agentId, undefined, {"));
check("employee runner creates user-attributed/planned session keys", employeeTaskRunner.includes("createPlannedEmployeeSessionKey") && employeeTaskRunner.includes("plannedSessionKey ?? createEmployeeSessionKey(agentId)"));
check("employee runner sends hidden task with extended timeout", employeeTaskRunner.includes("client.sendChatMessage(sessionKey, prompt, undefined, { timeoutMs })"));
check("employee runner still parses all three marker contracts", ["LEAD_CANDIDATES_JSON_START", "SCREENING_REPORTS_JSON_START", "ACCIO_SUMMARIES_JSON_START"].every((needle) => employeeTaskRunner.includes(needle)));
check("employee Accio prompt requires concrete deal facts", ["purchase_intent", "negotiated_prices", "behavior_signals", "source=\"accio_memory\"", "memory_write_preview"].every((needle) => employeeTaskRunner.includes(needle)));
check("employee runner reads full structured task output from chat history", ["HIDDEN_TASK_TRANSCRIPT_MAX_CHARS", "300_000", "client.getTranscript(", "HIDDEN_TASK_TRANSCRIPT_LIMIT"].every((needle) => employeeTaskRunner.includes(needle)) && gatewayClient.includes("maxChars?: number") && gatewayClient.includes("...(maxChars ? { maxChars } : {})"));
check("employee runner continues after recoverable LLM idle timeout retries", ["transcriptFailureMessage", "LLM idle timeout", "recoverable", "lastRecoverableFailureMessage", "continue"].every((needle) => employeeTaskRunner.includes(needle)) && gatewayTypes.includes("errorMessage?: string") && gatewayTypes.includes("stopReason?: string"));
check("employee runner still surfaces terminal backend model failures instead of generic marker timeouts", ["transcriptFailureMessage", "backend_error", "后台 AI 员工执行失败"].every((needle) => employeeTaskRunner.includes(needle)) && gatewayTypes.includes("errorMessage?: string") && gatewayTypes.includes("stopReason?: string"));
check("employee lead prompt follows requested target count instead of 1-5 cap", employeeTaskRunner.includes("target_count 是本次任务的硬目标") && employeeTaskRunner.includes("不要因为“高质量优先”而主动限制在 5 个") && !employeeTaskRunner.includes("优先返回 1-5 个高质量候选"));
check("employee lead import caps over-returned rows to requested target count", employeeTaskRunner.includes("function normalizedTargetCount") && employeeTaskRunner.includes("rows.slice(0, limit)") && employeeTaskRunner.includes("leadRowsFromPayload(result.payload, result.sessionKey, input.targetCount)"));
check("employee runner emits measured wait progress without max-wait copy", ["estimateLeadTaskDurationMs", "estimateScreeningTaskDurationMs", "estimateEmployeeTaskTimeoutMs", "已轮询", "progressPercent"].every((needle) => employeeTaskRunner.includes(needle)) && !employeeTaskRunner.includes("预计剩余") && !employeeTaskRunner.includes("最长等待剩余"));
check("employee lead and screening tasks support realtime cancellation", [
  "AbortSignal",
  "throwIfTaskCancelled",
  "isEmployeeTaskCancellation",
  "client.deleteSession(sessionKey",
].every((needle) => employeeTaskRunner.includes(needle)) && [
  "createCbeEmployeeTaskAbortSignal",
  "cancelCbeEmployeeRuntimeTask",
  "clearCbeEmployeeTaskAbortSignal",
].every((needle) => employeeTaskCancellation.includes(needle)) && [
  "createCbeEmployeeTaskAbortSignal",
  "clearCbeEmployeeTaskAbortSignal",
  "isEmployeeTaskCancellation",
  "cancelTask(taskId",
].every((needle) => employeeCustomersPage.includes(needle)));
check("CBE employee persistent store exists", exists(CBE_EMPLOYEE_STORE));
check("CBE employee store persists only draft/cache state", cbeEmployeeStore.includes("persist(") && cbeEmployeeStore.includes("sentura-cbe-employee-draft-cache-v1") && cbeEmployeeStore.includes("draftCache: state.draftCache") && !cbeEmployeeStore.includes("rows: state.rows,") && !cbeEmployeeStore.includes("tasks: trimTasks(state.tasks),"));
check("CBE employee store keeps seed rows behind explicit demo flag", cbeEmployeeStore.includes("CBE_USE_DEMO_SEED") && cbeEmployeeStore.includes("initialCustomerRows") && cbeEmployeeStore.includes("initialMemoryRows"));
check("CBE employee store tracks terminal failures and cancellations with session keys", cbeEmployeeStore.includes("failTask") && cbeEmployeeStore.includes("cancelTask") && cbeEmployeeStore.includes('"cancelled"') && cbeEmployeeStore.includes("sessionKey: sessionKey ?? task.sessionKey") && cbeEmployeeStore.includes("recoverStaleTasks"));
check("employee task status bar exists", exists(EMPLOYEE_TASK_STATUS));
check("employee task status bar shows planned duration, wait window, and progress", ["计划耗时", "最长等待", "剩余等待", "最后活动", "progressPercent", "关闭任务状态"].every((needle) => employeeTaskStatus.includes(needle)) && !employeeTaskStatus.includes("倒计时"));
check("employee task status bar can show concurrent lead and screening tasks", ["visibleTasks", "active.slice(0, 2)", "正在同时运行", "visibleTasks.map"].every((needle) => employeeTaskStatus.includes(needle)));
check("employee task status bar and API expose active task cancel action", [
  "取消任务",
  "cancelCbeEmployeeRuntimeTask",
  "cancelEmployeeTaskInDb",
  "cancelTask(task.id",
].every((needle) => employeeTaskStatus.includes(needle)) && [
  "CancelEmployeeTaskRequestSchema",
  "cancelEmployeeTask",
].every((needle) => employeeTaskCancelApi.includes(needle)) && [
  "cancelEmployeeTaskInDb",
  'record.status === "cancelled"',
].every((needle) => employeeApi.includes(needle)) && cbeStoreSchemas.includes("CancelEmployeeTaskRequestSchema"));
check("AppShell renders global employee task status", appShell.includes("EmployeeTaskStatusBar") && appShell.includes("<EmployeeTaskStatusBar />"));
check("AppShell keeps DB task refresh and task notification links", appShell.includes("fetchEmployeeTasks") && appShell.includes("markEmployeeNotificationsRead") && appShell.includes("EMPLOYEE_MESSAGE_CENTER_HREF") && employeeNotificationTargets.includes("employee-messages") && !appShell.includes("notificationRootRef"));
check("AppShell notification menus show scrollable targeted employee and manager message lists", appShell.includes("notificationListMaxHeight") && appShell.includes("overflow-y-auto") && appShell.includes("previewMessages.map((item)") && appShell.includes("employeeTaskNotificationHref(item)") && appShell.includes("messages.slice(0, EMPLOYEE_NOTIFICATION_PREVIEW_LIMIT)") && appShell.includes("EMPLOYEE_NOTIFICATION_VISIBLE_COUNT") && employeeNotificationTargets.includes("EMPLOYEE_NOTIFICATION_PREVIEW_LIMIT = 10") && employeeNotificationTargets.includes("EMPLOYEE_NOTIFICATION_VISIBLE_COUNT = 3") && employeeNotificationTargets.includes("highlightTask=") && employeeNotificationTargets.includes("employeeCostHighlightHref") && !appShell.includes("messages.slice(0, 4)") && appShell.includes("snapshot.approvals.map") && appShell.includes("snapshot.highValueItems.map") && appShell.includes("limit=100&range=all"));
check("AppShell employee account area uses role-scoped session login and logout instead of personal dropdown", appShell.includes("/api/client-demos/cross-border/session?role=operator") && appShell.includes("/api/auth/logout?role=") && appShell.includes("router.replace(`/auth/login?next=") && appShell.includes("EMPLOYEE_MESSAGE_CENTER_HREF"));
check("AppShell manager account area matches employee name and logout controls", appShell.includes('logoutTo("/client-demos/cross-border/admin/login")') && appShell.includes("AdminNotificationBell") && appShell.includes("<ConnectionStatus />") && !appShell.includes("ChevronDown") && !appShell.includes("管理者系统</div>") && !appShell.includes('href="/client-demos/cross-border/admin/employees" />'));
check("AppShell keeps only the side logo in the header", appShell.includes("sentura-logo-side.svg") && !appShell.includes("sentura-logo-icon.svg"));
check("AppShell exposes personal center as the first employee nav item", appShell.indexOf('label: "个人中心"') > 0 && appShell.indexOf('label: "个人中心"') < appShell.indexOf('label: "获客与背调"'));
check("AppShell logo is not the employee-home navigation entry", appShell.includes("aria-label={`Sentura ${shellTitle}`}") && appShell.includes("跨境电商员工操作系统") && appShell.includes("跨境电商管理者系统") && !appShell.includes('aria-label="回到个人中心"'));
check("CBE persistent UI state hook stores validated button filters in localStorage", ["usePersistentUiState", "window.localStorage.getItem", "window.localStorage.setItem", "validate(parsed)"].every((needle) => persistentUiStateHook.includes(needle)));
check("CBE persistent UI state avoids first-render localStorage hydration mismatch", persistentUiStateHook.includes("useState<T>(defaultValue)") && persistentUiStateHook.includes("setValue(readStoredValue") && persistentUiStateHook.includes("if (!isHydrated) return;"));
check("employee personal center range persists across route switches", ["HOME_RANGE_STORAGE_KEY", "sentura:cbe:employee:home-range:v1", "usePersistentUiState<HomeRange>", "isHomeRange"].every((needle) => employeeHomePage.includes(needle)) && !employeeHomePage.includes('useState<HomeRange>("month")'));
check("employee personal center greeting uses logged-in session display name", [
  "/api/client-demos/cross-border/session",
  "setSessionDisplayName",
  "currentEmployeeName",
  "body?.user?.displayName",
].every((needle) => employeeHomePage.includes(needle)) && !employeeHomePage.includes("你好，{employeeProfile.name}"));
check("employee personal center message reminders use a vertical scroll area", employeeHomePage.includes("max-h-[360px]") && employeeHomePage.includes("overflow-y-auto") && employeeHomePage.includes("taskMessages.map"));
check("employee customer filters persist across route switches", ["CUSTOMER_STATUS_FILTER_STORAGE_KEY", "CUSTOMER_SCORE_SORT_STORAGE_KEY", "CUSTOMER_FILTERS_STORAGE_KEY", "usePersistentUiState<CustomerFilters>", "isCustomerFilters"].every((needle) => employeeCustomersPage.includes(needle)) && !employeeCustomersPage.includes('useState<ScoreSort>("none")') && !employeeCustomersPage.includes('useState<CustomerFilters>(emptyFilters)'));
check("employee memory filters persist across route switches", ["MEMORY_STATUS_FILTER_STORAGE_KEY", "MEMORY_FILTERS_STORAGE_KEY", "usePersistentUiState<MemoryFilters>", "isMemoryFilters"].every((needle) => employeeMemoryPage.includes(needle)) && !employeeMemoryPage.includes('useState<MemoryFilters>(emptyFilters)'));
check("admin CBE range and customer filter buttons persist across route switches", ["ADMIN_EMPLOYEE_RANGE_STORAGE_KEY", "usePersistentUiState<RangeKey>"].every((needle) => adminEmployeesPage.includes(needle)) && ["ADMIN_COST_RANGE_STORAGE_KEY", "usePersistentUiState<RangeKey>"].every((needle) => adminCostsPage.includes(needle)) && ["ADMIN_CUSTOMER_STATUS_FILTER_STORAGE_KEY", "ADMIN_CUSTOMER_SCORE_SORT_STORAGE_KEY", "usePersistentUiState<AdminStatusFilter>"].every((needle) => adminCustomerListTable.includes(needle)));
check("admin cost amounts are capped at two decimals across UI and store", [
  "function money(value: unknown)",
  "moneyInput",
  "limit_usd: money(limitInputs",
  "amount_usd: money(allowanceInputs",
  "approved_amount_usd: money(approvalInputs",
  'step="0.01"',
].every((needle) => adminCostsPage.includes(needle)) && [
  "function money(value: unknown)",
  "limit_usd: money(form.monthLimit)",
  'step="0.01"',
].every((needle) => adminEmployeesPage.includes(needle)) && [
  "function moneyUsd(",
  "function moneyUsdText(",
  "requestedAllowanceUsd = moneyUsd",
].every((needle) => cbeAdminStore.includes(needle)) && cbeStoreSchemas.includes("CbeMoneyUsdSchema") && !cbeAdminStore.includes("toFixed(6)"));
check("employee cost card syncs manager-updated quota from server budget", [
  "fetchEmployeeCostBudget",
  "costBudget.limitUsd",
  "formatBudgetRemaining(snapshot.spendUsd, costBudget)",
  "formatBudgetLimit(costBudget)",
  "TaskCostNotice",
].every((needle) => employeeCost.includes(needle)) && !employeeCost.includes("monthlyCostBudget.limitUsd - snapshot.spendUsd") && !employeeCost.includes("userToken: employeeProfile.userToken") && [
  "getEmployeeCostBudget",
  "resolveCbeTenantContext",
  "runtime = \"nodejs\"",
].every((needle) => employeeCostBudgetApi.includes(needle)) && [
  "export async function getEmployeeCostBudget",
  "getActiveAllowanceForUserPeriod(context, context.userId, period)",
  "remainingUsd: limitEnabled ? moneyUsd(limitUsd - spendUsd) : null",
  "if (scopedEvents.length === 0) return null",
  'const ENFORCED_EMPLOYEE_COST_LIMIT_PERIODS: CbeCostPeriod[] = ["month"]',
  "period = any($3::text[])",
].every((needle) => cbeAdminStore.includes(needle)) && employeeApi.includes("/api/client-demos/cross-border/employee/cost-budget"));
check("admin employee management supports soft deletion", [
  "deleteAdminOperator",
  "deleteTarget",
  "删除员工",
  "Trash2",
].every((needle) => adminEmployeesPage.includes(needle)) && adminApi.includes('method: "DELETE"') && adminOperatorApiRoute.includes("DELETE") && [
  "export async function deleteAdminOperator",
  "status = 'inactive'",
  "p.status <> 'inactive'",
  "operator_deleted",
  "审批自动取消",
].every((needle) => cbeAdminStore.includes(needle)));
check("employee customers page uses DB API for rows and task lifecycle", ["fetchEmployeeCustomers", "fetchEmployeeTasks", "createEmployeeLeadRun", "completeEmployeeLeadRun", "createEmployeeScreeningRun", "completeEmployeeScreeningRun", "failEmployeeTaskInDb"].every((needle) => employeeCustomersPage.includes(needle)) && !employeeCustomersPage.includes("upsertRows(result.records)"));
check("employee API normalizes marker payloads before completion writes", ["normalizeLeadPayload", "normalizeScreeningPayload", "normalizeAccioPayload", "fetched_at", "source_references"].every((needle) => employeeApi.includes(needle)));
check("employee screening missing evidence is saved as insufficient evidence", ["missingEvidenceUrl", "traceabilityGap", '"insufficient_evidence"', "外部可追溯证据 URL"].every((needle) => employeeApi.includes(needle)) && !employeeApi.includes("背调报告缺少可追溯证据 URL"));
check("employee Accio normalization accepts preview aliases and derives report facts", ["memory_write_preview", "derivedIntent", "derivedPrice", "behavior_signals", "screening_handoff_target"].every((needle) => employeeApi.includes(needle)));
check("employee memory task notifications keep highlighted rows until click", ["highlightTaskId", "item.latestAgentRunId === highlightTaskId", "outline-sky-300", "setHighlightedRecordIds", "clearMemoryHighlight", "onMouseDown"].every((needle) => employeeMemoryPage.includes(needle)) && !employeeMemoryPage.includes("3000"));
check("employee memory report opens as centered dialog", ["MemoryReportDialog", "DialogContent", "max-w-5xl", 'open={mode === "add" || mode === "supplement" || mode === "filters"}'].every((needle) => employeeMemoryPage.includes(needle)));
check("employee memory import time displays Beijing seconds format", ["formatBeijingDateTime", 'timeZone: "Asia/Shanghai"', 'second: "2-digit"', "formatBeijingDateTime(item.importedAt)", "formatBeijingDateTime(activeRecord.importedAt)"].every((needle) => employeeMemoryPage.includes(needle)));
check("employee memory filters hide running and failed categories", employeeMemoryPage.includes('const memoryStatusFilterChoices = ["all", "not_started", "analyzed"] as const') && !employeeMemoryPage.includes('["all", "not_started", "running", "analyzed", "failed"]'));
check("employee memory supports selected DB-backed deletion", ["DeleteMemoryRecordsRequestSchema", "deleteEmployeeMemoryRecords", "deletedConversationIds"].every((needle) => cbeStoreSchemas.includes(needle) || cbeAccioStore.includes(needle) || employeeApi.includes(needle)) && ["selectedRecordIds", "MemoryDeleteDialog", "toggleAllVisibleRecords", "删除所选"].every((needle) => employeeMemoryPage.includes(needle)));
check("employee memory supplement flow imports JSON as not-started record", ["supplementCustomer", "supplementCompany", "supplementContext", 'mode === "supplement"', "补充聊天记录", "提交补充记录", "已提交补充聊天记录", 'setStatusFilter("not_started")', "highlightRecord="].every((needle) => employeeMemoryPage.includes(needle)));
check("employee memory supplement keeps original customer binding", ["supplementTarget: toSupplementTarget", "supplementCustomerId: record.supplementTarget?.customerId", "record.supplementCustomerId ?? record.reportId ?? record.recordId"].every((needle) => cbeAccioStore.includes(needle) || employeeApi.includes(needle) || employeeMemoryPage.includes(needle)));
check("employee memory supplement reuses existing Accio analysis record", ["reused_summary_id", "summariesToSave", "Original Accio memory customer was not found", "supplement_mode: \"merge_existing_accio_summary\""].every((needle) => cbeAccioStore.includes(needle)));
check("employee memory supplement keeps customer visible while awaiting reanalysis", ["pendingSupplementRefresh", "recordId: pendingSupplementRefresh ? record.importId", "deleteScreeningReportsForAccioSummary", "on conflict (id) do update"].every((needle) => employeeApi.includes(needle) || cbeAccioStore.includes(needle)));
check("employee memory supplement clears manual insufficient report without deleting manual target", ["deleteScreeningReportsForCustomerReference", 'supplementTargetJson?.source === "manual_screening"', "deleteTargets: false", "sr.screening_target_id = $2"].every((needle) => cbeAccioStore.includes(needle)));
check("employee existing memory analysis reloads stored redacted chat", ["fetchEmployeeAccioImportPayload", "storedPayload", "chatExport: storedPayload"].every((needle) => employeeMemoryPage.includes(needle)) && ["getAccioImportAnalysisPayload", "stored_accio_import", "text_redacted"].every((needle) => cbeAccioStore.includes(needle)));
check("employee memory handoff opens the matching customer row", ["useRouter", "sendToScreening", "highlightCustomer=", "record.reportId ?? record.recordId", "onCreateHandoff(activeRecord)"].every((needle) => employeeMemoryPage.includes(needle)));
check("employee memory projection suppresses duplicate import rows after analysis", ["duplicate_summary", "coalesce(ar.status, 'queued') not in ('running', 'polling')", "recordId: pendingSupplementRefresh ? record.importId : record.summaryId ?? record.importId", "agentRunStatus: row.agent_run_status"].every((needle) => cbeAccioStore.includes(needle) || employeeApi.includes(needle)));
check("employee customer projection includes Accio handoff rows", ["accio_summaries", "'accio_summary'::text as record_type", "'accio_handoff'::text as lead_status", "asum.purchase_intent_json", "record.recordType === \"accio_summary\""].every((needle) => cbeCustomersStore.includes(needle) || employeeApi.includes(needle)));
check("employee customer projection merges Accio screening reports into handoff rows", ["report_json->'target'->>'lead_id' = asum.id", "c.record_type = 'screening_target'", "target'->>'source' = 'accio_memory'", "coalesce(accio_sr.risk_tier, 'not_started')"].every((needle) => cbeCustomersStore.includes(needle)));
check("employee customer projection keeps manual targets when latest report is cleared", ["and coalesce((", "st.source = 'accio_memory'", "), false)"].every((needle) => cbeCustomersStore.includes(needle)));
check("employee customer company-name badge hides insufficient evidence", employeeCustomersPage.includes('if (item.screeningStatus === "insufficient_evidence")') && !employeeCustomersPage.includes('return { label: "证据不足"'));
check("employee manual and Accio insufficient evidence route back to memory supplement", ["needsChatRecordSupplement", 'item.source === "manual_screening"', 'item.source === "accio_handoff"', "补充聊天记录", "supplementCustomer", "supplementCompany", "selectedScreeningCustomers", "runnableTargets"].every((needle) => employeeCustomersPage.includes(needle)));
check("employee customer list does not show unknown city fallback", !employeeCustomersPage.includes("城市未确认"));
check("employee lead target count is manual numeric input capped at 20", ["normalizeLeadTargetCount", "MAX_LEAD_TARGET_COUNT", "目标数量手动输入", "type=\"number\"", "min={1}", "max={MAX_LEAD_TARGET_COUNT}", "leadTargetCountText"].every((needle) => employeeCustomersPage.includes(needle)) && employeeData.includes("export const MAX_LEAD_TARGET_COUNT = 20") && employeeTaskRunner.includes("Math.min(MAX_LEAD_TARGET_COUNT") && employeeApi.includes("Math.min(MAX_LEAD_TARGET_COUNT") && cbeStoreSchemas.includes("target_count: z.number().int().positive().max(20)") && !employeeCustomersPage.includes("[20, 50, 100, 150].map"));
check("employee customer list highlights task-linked rows without new-found badges", ["newlyAddedCustomerIds", "flashNewCustomers", "highlightTaskId", "taskAffectedCustomerIds", "animate-pulse", "outline-sky-300", "workflowBadge", "icon: \"check\"", "clearCustomerHighlight", "onMouseDown"].every((needle) => employeeCustomersPage.includes(needle)) && !employeeCustomersPage.includes("新找到") && !employeeCustomersPage.includes("label: \"✅\""));
check("employee customer product overflow expands in place", ["CustomerProductBadges", "expandedProductRows", "toggleProductsExpanded", "aria-expanded={expanded}", "`+${hiddenCount}`", "收起"].every((needle) => employeeCustomersPage.includes(needle)));
check("employee customer found time uses Beijing display format", ["formatBeijingDateTime", "parseCustomerDate", "Asia/Shanghai", "formatToParts", "YYYY"].every((needle) => employeeCustomersPage.includes(needle)) || (employeeCustomersPage.includes("formatBeijingDateTime") && employeeCustomersPage.includes("Asia/Shanghai") && employeeCustomersPage.includes("formatToParts") && employeeCustomersPage.includes("font-mono text-xs")));
check("employee task dismissal is preserved across task refreshes", ["dismissedTaskIds", "mergeTasksWithLocalDismissals", "rememberDismissedTask"].every((needle) => cbeEmployeeStore.includes(needle)) && employeeTaskStatus.includes("dismissEmployeeTaskInDb") && employeeApi.includes("/tasks/${encodeURIComponent(id)}/dismiss"));
check("CBE employee store supports page-cache and DB-backed customer deletion", cbeEmployeeStore.includes("deleteRows") && cbeEmployeeStore.includes("state.rows.filter((row) => !deleteIds.has(row.customerId))") && cbeEmployeeStore.includes("affectedCustomerIds?: string[]") && ["DeleteCustomerRecordsRequestSchema", "deleteEmployeeCustomers", "method: \"DELETE\""].every((needle) => cbeStoreSchemas.includes(needle) || cbeCustomersStore.includes(needle) || employeeApi.includes(needle)));
check("employee customers page gates lead and screening tasks independently", ["leadRunning", "screeningRunning", "task.kind === \"lead\"", "task.kind === \"screening\"", "leadRunning ? <Loader2", "screeningRunning ? <Loader2"].every((needle) => employeeCustomersPage.includes(needle)) && !employeeCustomersPage.includes("taskRunning !== null"));
check("employee customers page no longer uses page-local taskRunning state", !employeeCustomersPage.includes("setTaskRunning") && !employeeCustomersPage.includes("useState<\"lead\" | \"screening\" | null>"));
check("employee customers page refreshes DB-backed lists after task writes", employeeCustomersPage.includes("refreshDbBackedLists") && employeeCustomersPage.includes("await refreshDbBackedLists()"));
check("employee customer filters use canonical values with Chinese labels", ["canonicalBuyerType", "canonicalProduct", "buyerTypeLabel", "productLabel", "USB-C 充电器", "OLED 屏幕", "filters.products.includes(product.value)", "filters.buyerTypes.includes(buyerType.value)"].every((needle) => employeeCustomersPage.includes(needle)));
check("employee customer date filters use current date, not stale fixture date", employeeCustomersPage.includes("const end = new Date();") && !employeeCustomersPage.includes('new Date("2026-06-14T23:59:59")'));
check("employee customer filters remove running status option", employeeCustomersPage.includes('const quickStatusFilters = ["all", "not_started", "screened", "insufficient_evidence"] as const') && employeeCustomersPage.includes('const sheetStatusFilters = ["all", "not_started", "screened", "insufficient_evidence", "failed"] as const'));
check("employee customer list uses one compact score sort dropdown", ["scoreSortLabels", "评分高到低", "评分低到高", "评分排序", "select", "comparableScore", "setScoreSort"].every((needle) => employeeCustomersPage.includes(needle)) && !employeeCustomersPage.includes("ArrowUpNarrowWide") && !employeeCustomersPage.includes("onClick={() => setScoreSort((current) => (current === \"score_asc\""));
check("employee customer rows remove repeated per-row delete actions", employeeCustomersPage.includes("删除所选") && !employeeCustomersPage.includes("requestDelete={(customerId)") && !employeeCustomersPage.includes("requestDelete: (customerId"));
check("employee score labels use business follow-up wording", ["优先跟进", "谨慎跟进", "暂缓/高风险", "证据不足"].every((needle) => employeeCustomersPage.includes(needle)));
check("employee score tiers are based only on final score", ["function scoreTier(score?: number | null)", "if (score >= 80)", "if (score >= 60)"].every((needle) => employeeApi.includes(needle) && employeeTaskRunner.includes(needle)) && !employeeApi.includes("function scoreTier(score?: number | null, riskTier") && !employeeTaskRunner.includes("function scoreTier(score?: number | null, riskTier"));
check("manager high-value customers use final score threshold only", cbeAdminStore.includes("items: page.items.filter((item) => (item.normalizedScore ?? 0) >= 80)") && !cbeAdminStore.includes("recommendedAction ??") && !cbeAdminStore.includes("screeningStatus === \"trusted_candidate\""));
check("employee task completion metadata carries affected customer ids", ["saved_customer_ids", "lead_candidate_ids"].every((needle) => leadRunsStore.includes(needle)) && ["affectedCustomerIds", "taskAffectedCustomerIds", "target_customer_ids"].every((needle) => employeeApi.includes(needle)) && ["saved_customer_ids", "affected_customer_ids", "screening_target_ids"].every((needle) => screeningStore.includes(needle)));
check("employee report evidence hides scoring calculation layer", !employeeCustomersPage.includes("评分计算") && !employeeCustomersPage.includes('scoring: "评分计算"') && !employeeData.includes('| "scoring"') && !employeeTaskRunner.includes('raw === "scoring"'));
check("employee report detail sheet resets scroll to top", ["contentRef", "scrollTo({ top: 0, left: 0 })", "activeCustomer?.customerId"].every((needle) => employeeCustomersPage.includes(needle)));
check("employee customer deletion requires confirmation", ["requestDeleteCustomers", "确认删除客户", "确认删除", "deleteTargets", "onDeleteConfirm"].every((needle) => employeeCustomersPage.includes(needle)));
check("employee evidence gaps use concrete searched-source reasons", ["coverageGapReasonForBlock", "coverageGapsFromScoreBlocks", "公司注册信息或官方注册页未搜索到", "RDAP、DNS、官网联系邮箱", "贸易/海关记录、SEC 或财务公开文件"].every((needle) => employeeData.includes(needle)) && employeeTaskRunner.includes("coverageGapsFromScoreBlocks(scoreBlocks)") && employeeApi.includes("coverageGapsFromScoreBlocks(scoreBlocks)") && !employeeTaskRunner.includes("\"缺少该维度证据。\"") && !employeeApi.includes("\"缺少该维度证据。\""));
check("employee lead budget estimate is calibrated to recent sentura-cost records", ["leadSourceLabel: \"近期真实成本 + 已定价调用\"", "observedSearchRequestUsd", "observedRetainedCandidateUsd", "pricedExternalUsd", "模型美元成本按 sentura-cost 真实回填校准"].every((needle) => employeeData.includes(needle)) && !employeeData.includes("advanced 2 credits × US$0.008/credit"));
check("employee screening budget estimate does not treat trade-data cap as spend", ["estimateScreeningTaskCost", "observedTargetUsd", "paidTradeDataExpectedUsd: 0", "tradeDataBudgetCapUsd", "贸易数据硬上限", "不当作预计支出", "ImportYeti requestCost=0"].every((needle) => employeeData.includes(needle)) && !employeeData.includes("tradeDataReservedUsd"));
check("sentura-cost schema supports external API cost rows", ["external_api", "local_tool", "CostPricingStatus", "externalUsage", "external_tool_log"].every((needle) => senturaCostTypes.includes(needle)));
check("sentura-cost backfills external CBE tool costs from session logs", ["eventFromToolResultRow", "ImportYeti", "Abstract Email Reputation", "Hunter Email Verifier", "Tavily / web_search", "Companies House", "SEC EDGAR"].every((needle) => senturaCostBackfill.includes(needle)));
check("employee cost mini opens scoped model and external API cost details", ["aria-label=\"查看本月 API 成本明细\"", "hover:scale-[1.03]", "本月 API 成本明细", "模型与外部资料服务调用", "costPricingLabels", "外部回填", "fetchEmployeeTasks", "outsideScopeCount", "当前工作台只统计已写入 CBE 数据库的任务 session"].every((needle) => employeeCost.includes(needle)));
check("cross-border SEC lookup returns compact submission summaries", ["secRecentFilingsSummary", "recent_filings: recentFilings", "submissions_summary", "forms.slice(0, 8)"].every((needle) => crossBorderIntelTools.includes(needle)) && !crossBorderIntelTools.includes("submissions: body"));

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`Failures: ${failures.join(", ")}`);
  process.exit(1);
}
