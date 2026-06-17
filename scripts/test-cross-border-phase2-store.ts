#!/usr/bin/env tsx
/**
 * Cross-border e-commerce Phase 2 store foundation checks.
 *
 * Static checks always run. Live database checks run when CBE_DATABASE_URL is
 * set, or are required when --require-db is passed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCbePool } from "../sentura/lib/cross-border-store/db.js";
import { CBE_TENANT_ID, CBE_SEED_USERS } from "../sentura/lib/cross-border-store/ids.js";
import { migrateCbeDatabase } from "../sentura/lib/cross-border-store/migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "sentura/lib/cross-border-store/migrations");
const STORE_DIR = path.join(ROOT, "sentura/lib/cross-border-store");
const DASHBOARD_STORE = path.join(ROOT, "sentura/dashboard/src/lib/cross-border-store/index.ts");
const DASHBOARD_STORE_DIR = path.join(ROOT, "sentura/dashboard/src/lib/cross-border-store");
const DASHBOARD_API_DIR = path.join(ROOT, "sentura/dashboard/src/app/api/client-demos/cross-border");
const DASHBOARD_EMPLOYEE_DIR = path.join(ROOT, "sentura/dashboard/src/app/client-demos/cross-border/employee");
const DASHBOARD_COMPONENTS_DIR = path.join(ROOT, "sentura/dashboard/src/components");
const DASHBOARD_STORES_DIR = path.join(ROOT, "sentura/dashboard/src/stores");
const DASHBOARD_PACKAGE_JSON = path.join(ROOT, "sentura/dashboard/package.json");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const SENTURA_LIB_PACKAGE = path.join(ROOT, "sentura/lib/package.json");
const SENTURA_LIB_TSCONFIG = path.join(ROOT, "sentura/lib/tsconfig.json");
const CBE_DB_INSPECTION_SQL = path.join(ROOT, "scripts/inspect-cross-border-live-db.sql");

const requireDb = process.argv.includes("--require-db");

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

async function runLiveDatabaseChecks() {
  section("CE18 live PostgreSQL migration checks");
  const migrationResult = await migrateCbeDatabase({ seed: true });
  check(
    "fresh/live migration reports both P2.1 migrations as applied or previously skipped",
    migrationResult.applied.length + migrationResult.skipped.length >= 2,
  );
  check("seed summary includes one admin profile", migrationResult.seed?.adminProfiles === 1);
  check("seed summary includes at least two operator profiles", (migrationResult.seed?.operatorProfiles ?? 0) >= 2);

  const rerunResult = await migrateCbeDatabase({ seed: true });
  check("migration rerun is a no-op", rerunResult.applied.length === 0);
  check("migration rerun still sees all migration files", rerunResult.skipped.length >= 2);

  const pool = createCbePool({ max: 2, applicationName: "sentura-cbe-store-test" });
  const client = await pool.connect();
  try {
    const tables = await client.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
          and table_name = any($1::text[])
        order by table_name
      `,
      [requiredTables],
    );
    check("database contains all required P2.1 tables", tables.rows.length === requiredTables.length);

    const views = await client.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.views
        where table_schema = 'public'
          and table_name = any($1::text[])
        order by table_name
      `,
      [requiredViews],
    );
    check("database contains the admin/operator projection views", views.rows.length === requiredViews.length);

    const indexes = await client.query<{ indexname: string }>(
      `
        select indexname
        from pg_indexes
        where schemaname = 'public'
          and indexname = any($1::text[])
      `,
      [requiredIndexes],
    );
    check("database contains required P2.1 indexes", indexes.rows.length === requiredIndexes.length);

    const profiles = await client.query<{ cbe_role: string; count: string }>(
      `
        select cbe_role, count(*)::text as count
        from cbe_user_profiles
        where tenant_id = $1
        group by cbe_role
      `,
      [CBE_TENANT_ID],
    );
    const roleCounts = new Map(profiles.rows.map((row) => [row.cbe_role, Number(row.count)]));
    check("seeded tenant has exactly one customer admin", roleCounts.get("admin") === 1);
    check("seeded tenant has at least two customer operators", (roleCounts.get("operator") ?? 0) >= 2);

    await client.query("begin");
    await client.query(
      `
        insert into agent_runs (
          id,
          tenant_id,
          user_id,
          owner_user_id,
          visibility_scope,
          agent_id,
          status,
          task_kind,
          target_summary
        )
        values ($1, $2, $3, $3, 'private', 'cbe-lead-discovery', 'running', 'lead', 'CE18 probe')
      `,
      ["ce18_probe_agent_run", CBE_TENANT_ID, CBE_SEED_USERS.operatorA.id],
    );
    await client.query(
      `
        insert into agent_run_activity_events (
          id,
          tenant_id,
          agent_run_id,
          operator_user_id,
          agent_id,
          task_kind,
          target_summary,
          stage,
          event_type,
          status
        )
        values ($1, $2, $3, $4, 'cbe-lead-discovery', 'lead', 'CE18 probe', 'source_search', 'tool_call', 'running')
      `,
      ["ce18_probe_activity", CBE_TENANT_ID, "ce18_probe_agent_run", CBE_SEED_USERS.operatorA.id],
    );
    await client.query("rollback");
    check("agent run activity insert probe succeeds inside rollback transaction", true);
  } finally {
    client.release();
    await pool.end();
  }
}

async function cleanupP2DashboardProbe(agentRunIds: string[], leadDomain: string) {
  if (agentRunIds.length === 0) return;
  const pool = createCbePool({ max: 2, applicationName: "sentura-cbe-p2-dashboard-cleanup" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `
        delete from handoff_events
        where tenant_id = $1
          and source_record_id in (
            select id
            from accio_summaries
            where tenant_id = $1 and agent_run_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query(
      `
        delete from memory_facts
        where tenant_id = $1
          and source_record_id in (
            select id
            from accio_summaries
            where tenant_id = $1 and agent_run_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query("delete from accio_summaries where tenant_id = $1 and agent_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      agentRunIds,
    ]);
    await client.query(
      `
        delete from accio_messages
        where tenant_id = $1
          and accio_conversation_id in (
            select id
            from accio_conversations
            where tenant_id = $1
              and accio_import_id in (
                select id from accio_imports where tenant_id = $1 and agent_run_id = any($2::text[])
              )
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query(
      `
        delete from accio_conversations
        where tenant_id = $1
          and accio_import_id in (
            select id from accio_imports where tenant_id = $1 and agent_run_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query("delete from accio_imports where tenant_id = $1 and agent_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      agentRunIds,
    ]);
    await client.query(
      `
        delete from screening_score_blocks
        where tenant_id = $1
          and screening_report_id in (
            select id from screening_reports where tenant_id = $1 and agent_run_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query(
      `
        delete from screening_evidence
        where tenant_id = $1
          and screening_report_id in (
            select id from screening_reports where tenant_id = $1 and agent_run_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query("delete from screening_reports where tenant_id = $1 and agent_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      agentRunIds,
    ]);
    await client.query("delete from screening_targets where tenant_id = $1 and company_name like 'CE19 Probe%'", [
      CBE_TENANT_ID,
    ]);
    await client.query(
      `
        delete from lead_sources
        where tenant_id = $1
          and lead_candidate_id in (
            select id from lead_candidates where tenant_id = $1 and normalized_domain = $2
          )
      `,
      [CBE_TENANT_ID, leadDomain],
    );
    await client.query(
      `
        delete from lead_run_results
        where tenant_id = $1
          and lead_run_id in (
            select id from lead_runs where tenant_id = $1 and agent_run_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query("delete from lead_candidates where tenant_id = $1 and normalized_domain = $2", [
      CBE_TENANT_ID,
      leadDomain,
    ]);
    await client.query("delete from lead_identities where tenant_id = $1 and normalized_domain = $2", [
      CBE_TENANT_ID,
      leadDomain,
    ]);
    await client.query("delete from lead_runs where tenant_id = $1 and agent_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      agentRunIds,
    ]);
    await client.query("delete from agent_run_activity_events where tenant_id = $1 and agent_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      agentRunIds,
    ]);
    await client.query(
      `
        delete from audit_events
        where tenant_id = $1
          and metadata_json->>'agent_run_id' = any($2::text[])
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query("delete from agent_runs where tenant_id = $1 and id = any($2::text[])", [
      CBE_TENANT_ID,
      agentRunIds,
    ]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function runLiveDashboardStoreChecks() {
  section("CE19/P2.2 live Dashboard store API checks");
  const imported = await import("../sentura/dashboard/src/lib/cross-border-store/index.ts");
  const store = (imported.default ?? imported) as Record<string, any>;
  const request = new Request("http://sentura.local/api/client-demos/cross-border/employee/customers", {
    headers: { "x-cbe-user-id": CBE_SEED_USERS.operatorA.id },
  });
  const context = await store.resolveCbeTenantContext(request);
  check("dashboard store resolves seeded operator context", context.userId === CBE_SEED_USERS.operatorA.id);

  const stamp = Date.now().toString(36);
  const leadDomain = `ce19-${stamp}.example.com`;
  const agentRunIds: string[] = [];
  try {
    const leadStart = await store.createLeadRun(context, {
      query_config: { products: ["phone case"], countries: ["GB"], ce19_probe: stamp },
      target_count: 1,
      session_key: `ce19-lead-session-${stamp}`,
      target_summary: `CE19 Probe Lead ${stamp}`,
    });
    agentRunIds.push(leadStart.agentRun.id);
    const fetchedAt = new Date().toISOString();
    const leadResult = await store.saveLeadRunResult(context, leadStart.leadRun.id, {
      agent_run_id: leadStart.agentRun.id,
      session_key: `ce19-lead-session-${stamp}`,
      payload: {
        run_id: `ce19-lead-run-${stamp}`,
        leads: [
          {
            lead_id: `ce19-lead-${stamp}`,
            company_name: `CE19 Probe Buyer ${stamp}`,
            website: `https://${leadDomain}`,
            domain: leadDomain,
            country: "GB",
            buyer_type: "electronics retailer",
            matched_products: ["phone case"],
            source_urls: [`https://${leadDomain}/about`],
            discovery_evidence: [
              {
                source_url: `https://${leadDomain}/about`,
                finding: "Probe public evidence with timestamp.",
                fetched_at: fetchedAt,
                source_type: "public_web",
              },
            ],
            dedupe_key: `domain:${leadDomain}`,
            duplicate_status: "new",
            confidence: 0.91,
          },
        ],
      },
    });
    check("dashboard store saves validated Lead marker payload", leadResult.candidates.length === 1);
    check("dashboard store saves Lead source evidence", leadResult.sources.length === 1);

    const customers = await store.listEmployeeCustomers(context, { limit: 20, offset: 0 });
    check(
      "employee customer read projection returns saved Lead candidate",
      customers.items.some((item: { domain: string | null }) => item.domain === leadDomain),
    );

    const screeningStart = await store.createScreeningRun(context, {
      target_summary: `CE19 Probe Screening ${stamp}`,
      session_key: `ce19-screening-session-${stamp}`,
    });
    agentRunIds.push(screeningStart.agentRun.id);
    const screeningResult = await store.saveScreeningReports(context, {
      agent_run_id: screeningStart.agentRun.id,
      session_key: `ce19-screening-session-${stamp}`,
      payload: {
        reports: [
          {
            report_id: `ce19-screening-report-${stamp}`,
            company_name: `CE19 Probe Buyer ${stamp}`,
            target: {
              source: "manual_input",
              company_name: `CE19 Probe Buyer ${stamp}`,
              country: "GB",
              domain: leadDomain,
              product_interest: ["phone case"],
              supplied_fields: ["company_name", "domain"],
              missing_fields: [],
            },
            risk_tier: "trusted_candidate",
            normalized_score: 82,
            evidence_coverage: 0.8,
            recommended_action: "Proceed with human sales review.",
            score_blocks: [
              {
                block: "public_footprint",
                status: "scored",
                max_points: 20,
                earned_points: 16,
                source_count: 1,
                summary: "Public web evidence is present.",
              },
            ],
            evidence: [
              {
                layer: "public_footprint",
                source_type: "public_web",
                source_url: `https://${leadDomain}/about`,
                finding: "Timestamped public-footprint evidence.",
                fetched_at: fetchedAt,
                confidence: 0.9,
                score_block: "public_footprint",
                score_impact: "positive",
              },
            ],
            coverage_gaps: [],
            open_questions: [],
          },
        ],
      },
    });
    check("dashboard store saves Screening report payload", screeningResult.reports.length === 1);

    const accioStart = await store.saveAccioImport(context, {
      source_file_name: `ce19-${stamp}.json`,
      file_hash: `ce19hash${stamp}000000000000`,
      storage_key: `local://ce19/${stamp}`,
      classification: "T2",
      session_key: `ce19-accio-session-${stamp}`,
      conversations: [
        {
          external_conversation_id: `ce19-conversation-${stamp}`,
          company_name: `CE19 Probe Buyer ${stamp}`,
          country: "GB",
          messages: [
            {
              message_ts: fetchedAt,
              sender_role: "buyer",
              text_hash: `ce19messagehash${stamp}`,
              text_redacted: "Buyer asks for phone case quote.",
            },
          ],
        },
      ],
    });
    agentRunIds.push(accioStart.agentRun.id);
    const accioResult = await store.saveAccioSummaries(context, accioStart.accioImport.id, {
      agent_run_id: accioStart.agentRun.id,
      session_key: `ce19-accio-session-${stamp}`,
      payload: {
        summaries: [
          {
            conversation_id: `ce19-conversation-${stamp}`,
            customer_profile: {
              company_name: `CE19 Probe Buyer ${stamp}`,
              country: "GB",
              contact_person: "Redacted Buyer",
              website: `https://${leadDomain}`,
            },
            purchase_intent: [{ product: "phone case", quantity: 1000 }],
            negotiated_prices: [{ product: "phone case", target_price_usd: 1.8 }],
            negotiation_summary: "Probe summary for durable Accio persistence.",
            next_actions: ["Review memory preview"],
            behavior_signals: { notes: "Professional inquiry" },
            memory_preview: { status: "preview_only", summary: "Probe memory preview" },
            screening_handoff_target: {
              company_name: `CE19 Probe Buyer ${stamp}`,
              country: "GB",
              website: `https://${leadDomain}`,
            },
            source_references: [
              {
                source_type: "self_reported",
                source_file: `ce19-${stamp}.json`,
                conversation_id: `ce19-conversation-${stamp}`,
              },
            ],
          },
        ],
      },
    });
    check("dashboard store saves Accio summaries", accioResult.summaries.length === 1);
    check("dashboard store creates pending memory facts", accioResult.memoryFactIds.length === 1);
    check("dashboard store creates Screening handoffs", accioResult.handoffIds.length === 1);

    const tasks = await store.listEmployeeTasks(context, { limit: 20, offset: 0 });
    check(
      "employee task read projection returns completed probe runs",
      agentRunIds.every((id) => tasks.items.some((task: { id: string; status: string }) => task.id === id && task.status === "completed")),
    );
    const memory = await store.listEmployeeMemoryRecords(context);
    check(
      "employee memory read projection returns saved Accio import",
      memory.items.some((item: { importId: string }) => item.importId === accioStart.accioImport.id),
    );

    const failedRun = await store.createLeadRun(context, {
      query_config: { products: ["charger"], ce19_invalid_probe: stamp },
      target_count: 1,
      session_key: `ce19-invalid-session-${stamp}`,
      target_summary: `CE19 invalid marker ${stamp}`,
    });
    agentRunIds.push(failedRun.agentRun.id);
    await store.failLeadCompletion(context, {
      agentRunId: failedRun.agentRun.id,
      sessionKey: `ce19-invalid-session-${stamp}`,
      message: "Intentional CE19 validation failure probe.",
      details: { reason: "missing timestamp/source" },
    });
    const failedTasks = await store.listEmployeeTasks(context, { limit: 30, offset: 0, status: "failed" });
    check(
      "marker failure path stores failed agent_run",
      failedTasks.items.some((task: { id: string; errorCode: string | null }) => task.id === failedRun.agentRun.id && task.errorCode === "marker_parse_failed"),
    );
  } finally {
    await cleanupP2DashboardProbe(agentRunIds, leadDomain);
    await store.getCbePool().end();
  }
}

const requiredTables = [
  "tenants",
  "sentura_users",
  "cbe_user_profiles",
  "agent_runs",
  "lead_runs",
  "lead_candidates",
  "lead_sources",
  "screening_targets",
  "screening_reports",
  "screening_evidence",
  "screening_score_blocks",
  "accio_imports",
  "accio_conversations",
  "accio_messages",
  "accio_summaries",
  "handoff_events",
  "memory_facts",
  "api_call_ledger",
  "audit_events",
  "agent_run_activity_events",
  "lead_discovery_scopes",
  "lead_run_memberships",
  "lead_identities",
  "lead_run_results",
  "lead_allocations",
  "cbe_schema_migrations",
];

const requiredViews = [
  "cbe_customer_work_items",
  "cbe_operator_workload_daily",
  "cbe_agent_usage_daily",
];

const requiredIndexes = [
  "lead_candidates_tenant_domain_uidx",
  "screening_targets_identity_idx",
  "screening_reports_latest_idx",
  "accio_conversations_lookup_idx",
  "api_call_ledger_rollup_idx",
  "audit_events_rollup_idx",
  "agent_runs_status_idx",
  "lead_scopes_active_idx",
  "cbe_user_profiles_role_idx",
  "lead_candidates_owner_scope_idx",
  "screening_targets_owner_scope_idx",
  "accio_imports_owner_scope_idx",
  "agent_run_activity_monitor_idx",
];

const p22StoreModules = [
  "db.ts",
  "schemas.ts",
  "tenant-context.ts",
  "customers.ts",
  "lead-runs.ts",
  "screening.ts",
  "accio.ts",
  "tasks.ts",
  "notifications.ts",
  "api-ledger.ts",
  "audit.ts",
  "agent-runs.ts",
  "handoffs.ts",
  "route-utils.ts",
];

const p22EmployeeRoutes = [
  "employee/customers/route.ts",
  "employee/lead-runs/route.ts",
  "employee/lead-runs/[id]/complete/route.ts",
  "employee/screening-runs/route.ts",
  "employee/screening-runs/[id]/complete/route.ts",
  "employee/tasks/route.ts",
  "employee/tasks/[id]/dismiss/route.ts",
  "employee/notifications/route.ts",
  "employee/notifications/read/route.ts",
  "employee/memory/route.ts",
  "employee/memory/imports/route.ts",
  "employee/memory/imports/[id]/complete/route.ts",
  "employee/handoffs/route.ts",
];

const p22AdminRoutes = [
  "admin/overview/route.ts",
  "admin/live-tasks/route.ts",
  "admin/customers/route.ts",
  "admin/operators/route.ts",
  "admin/operators/[id]/route.ts",
  "admin/agent-usage/route.ts",
];

const p23EmployeeRoutes = [
  "employee/tasks/[id]/fail/route.ts",
];

section("CE18 migration file structure");
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql")).sort();
check("migration directory exists", exists(MIGRATIONS_DIR));
check("001 initial schema migration exists", migrationFiles.includes("001_initial_schema.sql"));
check("002 lead scope coordinator migration exists", migrationFiles.includes("002_lead_scope_coordinator.sql"));
check("migration filenames are ordered and numeric", migrationFiles.every((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)));

const migrationSql = migrationFiles.map((file) => read(path.join(MIGRATIONS_DIR, file))).join("\n");
for (const table of requiredTables) {
  check(`schema includes table: ${table}`, migrationSql.includes(` ${table} `) || migrationSql.includes(`${table} (`));
}
for (const view of requiredViews) {
  check(`schema includes projection view: ${view}`, migrationSql.includes(`view ${view}`));
}
for (const index of requiredIndexes) {
  check(`schema includes index: ${index}`, migrationSql.includes(index));
}
check("schema defines admin/operator CBE roles", migrationSql.includes("cbe_role in ('admin', 'operator')"));
check("schema defines owner/team/visibility fields", ["owner_user_id", "team_name", "visibility_scope"].every((needle) => migrationSql.includes(needle)));
check("schema defines task activity monitoring events", migrationSql.includes("agent_run_activity_events") && migrationSql.includes("target_summary"));
check("schema defines migration history table", migrationSql.includes("cbe_schema_migrations"));
check(
  "migration SQL does not embed obvious connection secrets",
  !/(postgres:\/\/|password\s*=|api_key|app_secret|bearer\s+)/i.test(migrationSql),
);

section("CE18 TypeScript runner and seed structure");
const dbTs = read(path.join(STORE_DIR, "db.ts"));
const migrateTs = read(path.join(STORE_DIR, "migrate.ts"));
const seedTs = read(path.join(STORE_DIR, "seed.ts"));
const idsTs = read(path.join(STORE_DIR, "ids.ts"));
const schemasTs = read(path.join(STORE_DIR, "schemas.ts"));
const dashboardStore = read(DASHBOARD_STORE);
const rootPackage = read(PACKAGE_JSON);
const dashboardPackage = read(DASHBOARD_PACKAGE_JSON);
const senturaLibPackage = read(SENTURA_LIB_PACKAGE);
const senturaLibTsconfig = read(SENTURA_LIB_TSCONFIG);

check("db.ts requires CBE_DATABASE_URL", dbTs.includes("CBE_DATABASE_URL") && dbTs.includes("do not commit database credentials"));
check("migration runner uses a transaction", migrateTs.includes('client.query("begin")') && migrateTs.includes('client.query("commit")'));
check("migration runner checks immutable checksums", migrateTs.includes("checksum changed after it was applied"));
check("seed creates cross-border tenant id", idsTs.includes(`CBE_TENANT_ID = "${CBE_TENANT_ID}"`));
check("seed defines one admin and two operators", idsTs.includes("admin") && idsTs.includes("operatorA") && idsTs.includes("operatorB"));
check("seed writes cbe_user_profiles", seedTs.includes("insert into cbe_user_profiles"));
check("schemas define customer role enum", schemasTs.includes('z.enum(["admin", "operator"])'));
const dashboardSchemasTs = read(path.join(DASHBOARD_STORE_DIR, "schemas.ts"));
check("dashboard store declares customer role boundary", (dashboardStore + dashboardSchemasTs).includes("CBE_PRODUCT_ROLES") && dashboardSchemasTs.includes("admin") && dashboardSchemasTs.includes("operator"));
check("root package declares pg dependency", rootPackage.includes('"pg"') && rootPackage.includes('"@types/pg"'));
check("sentura/lib package exports cross-border-store", senturaLibPackage.includes('"./cross-border-store"'));
check("sentura/lib typecheck includes cross-border-store", senturaLibTsconfig.includes("cross-border-store/**/*.ts"));
check(
  "seed records do not include email addresses or raw tokens",
  !/[@]|user_token_hash:|tokenHash|password|apiKey|secret/i.test(idsTs + seedTs),
);

section("CE19/P2.2 Dashboard store and route structure");
const dashboardStoreSource = p22StoreModules
  .map((file) => [file, read(path.join(DASHBOARD_STORE_DIR, file))] as const);
for (const [file] of dashboardStoreSource) {
  check(`P2.2 dashboard store module exists: ${file}`, exists(path.join(DASHBOARD_STORE_DIR, file)));
}
for (const route of [...p22EmployeeRoutes, ...p22AdminRoutes]) {
  check(`P2.2 route exists: ${route}`, exists(path.join(DASHBOARD_API_DIR, route)));
}
const p22AllStoreText = dashboardStoreSource.map(([, text]) => text).join("\n");
const completionRouteText = [
  read(path.join(DASHBOARD_API_DIR, "employee/lead-runs/[id]/complete/route.ts")),
  read(path.join(DASHBOARD_API_DIR, "employee/screening-runs/[id]/complete/route.ts")),
  read(path.join(DASHBOARD_API_DIR, "employee/memory/imports/[id]/complete/route.ts")),
].join("\n");
const adminRouteText = p22AdminRoutes.map((route) => read(path.join(DASHBOARD_API_DIR, route))).join("\n");

check("dashboard package declares server store dependencies", dashboardPackage.includes('"pg"') && dashboardPackage.includes('"zod"') && dashboardPackage.includes('"@types/pg"'));
check("P2.2 store uses environment-backed pg pool", read(path.join(DASHBOARD_STORE_DIR, "db.ts")).includes("CBE_DATABASE_URL") && read(path.join(DASHBOARD_STORE_DIR, "db.ts")).includes("application_name"));
check("P2.2 tenant context resolves seeded CBE profiles", read(path.join(DASHBOARD_STORE_DIR, "tenant-context.ts")).includes("cbe_user_profiles") && read(path.join(DASHBOARD_STORE_DIR, "tenant-context.ts")).includes("x-cbe-user-id"));
check("P2.2 schemas require source URLs and fetched timestamps", p22AllStoreText.includes("source_url: z.string().url()") && p22AllStoreText.includes("fetched_at: IsoTimestampSchema"));
check("P2.2 completion routes fail agent_runs on validation errors", completionRouteText.includes("safeParse") && completionRouteText.includes("failLeadCompletion") && completionRouteText.includes("failScreeningCompletion") && completionRouteText.includes("failAccioCompletion"));
check("P2.2 writes audit events for major store actions", p22AllStoreText.includes("createAuditEvent") && p22AllStoreText.includes("lead_run_completed") && p22AllStoreText.includes("screening_reports_saved") && p22AllStoreText.includes("accio_summaries_saved"));
check("P2.2 store writes task activity events for admin monitoring", p22AllStoreText.includes("agent_run_activity_events") && p22AllStoreText.includes("createAgentRunActivityEvent"));
check("P2.2 read endpoints apply server-side tenant/user filters", p22AllStoreText.includes("scopedOwnerClause") && p22AllStoreText.includes("owner_user_id") && p22AllStoreText.includes("tenant_shared"));
check("P2.2 admin routes require CBE admin role", adminRouteText.includes("requireCbeAdmin(context)") && !adminRouteText.includes("POST("));
check("P2.2 route handlers use Next App Router node runtime", [...p22EmployeeRoutes, ...p22AdminRoutes].every((route) => read(path.join(DASHBOARD_API_DIR, route)).includes('runtime = "nodejs"')));
check("P2.2 route handlers do not expose raw SQL to employees", !/\b(select|insert into|update|delete from)\b/i.test(completionRouteText));

section("CE20/P2.3 Employee DB-backed UI migration");
for (const route of p23EmployeeRoutes) {
  check(`P2.3 route exists: ${route}`, exists(path.join(DASHBOARD_API_DIR, route)));
}
const employeeApiTs = read(path.join(DASHBOARD_EMPLOYEE_DIR, "_data/employee-api.ts"));
const employeeRunnerTs = read(path.join(DASHBOARD_EMPLOYEE_DIR, "_data/employee-task-runner.ts"));
const employeeStoreTs = read(path.join(DASHBOARD_STORES_DIR, "use-cbe-employee-store.ts"));
const employeeHomePageTs = read(path.join(DASHBOARD_EMPLOYEE_DIR, "page.tsx"));
const employeeCustomersPageTs = read(path.join(DASHBOARD_EMPLOYEE_DIR, "customers/page.tsx"));
const employeeMemoryPageTs = read(path.join(DASHBOARD_EMPLOYEE_DIR, "memory/page.tsx"));
const appShellTs = read(path.join(DASHBOARD_COMPONENTS_DIR, "app-shell.tsx"));
const p23RouteText = p23EmployeeRoutes.map((route) => read(path.join(DASHBOARD_API_DIR, route))).join("\n");
const dbInspectionSql = read(CBE_DB_INSPECTION_SQL);

check("P2.3 client API reads Employee projections", ["fetchEmployeeCustomers", "fetchEmployeeMemoryRecords", "fetchEmployeeTasks"].every((needle) => employeeApiTs.includes(needle)));
check("P2.3 client API writes task lifecycle endpoints", ["createEmployeeLeadRun", "completeEmployeeLeadRun", "createEmployeeScreeningRun", "completeEmployeeScreeningRun", "createEmployeeAccioImport", "completeEmployeeAccioImport", "failEmployeeTaskInDb"].every((needle) => employeeApiTs.includes(needle)));
check("P2.3 client API normalizes strict marker contracts", ["normalizeLeadPayload", "normalizeScreeningPayload", "normalizeAccioPayload", "fetched_at", "source_references", "sha256Hex"].every((needle) => employeeApiTs.includes(needle)));
check("P2.3 hidden runner supports pre-created DB session keys", employeeRunnerTs.includes("createPlannedEmployeeSessionKey") && employeeRunnerTs.includes("plannedSessionKey ?? createEmployeeSessionKey(agentId)"));
check("P2.3 store persists draft/cache only", employeeStoreTs.includes("sentura-cbe-employee-draft-cache-v1") && employeeStoreTs.includes("draftCache: state.draftCache") && !employeeStoreTs.includes("rows: state.rows,") && !employeeStoreTs.includes("tasks: trimTasks(state.tasks),"));
check("P2.3 demo seed fallback is explicit", employeeStoreTs.includes("CBE_USE_DEMO_SEED") && employeeStoreTs.includes("initialCustomerRows") && employeeStoreTs.includes("initialMemoryRows"));
check("P2.3 home page hydrates customers, memory, and tasks from APIs", ["fetchEmployeeCustomers", "fetchEmployeeMemoryRecords", "fetchEmployeeTasks"].every((needle) => employeeHomePageTs.includes(needle)));
check("P2.3 customers page starts/completes/fails DB tasks", ["createEmployeeLeadRun", "completeEmployeeLeadRun", "createEmployeeScreeningRun", "completeEmployeeScreeningRun", "failEmployeeTaskInDb", "refreshDbBackedLists"].every((needle) => employeeCustomersPageTs.includes(needle)));
check("P2.3 memory page starts/completes/fails DB tasks", ["createEmployeeAccioImport", "completeEmployeeAccioImport", "failEmployeeTaskInDb", "refreshDbBackedMemory"].every((needle) => employeeMemoryPageTs.includes(needle)));
check("P2.3 notification center uses DB read markers", appShellTs.includes("fetchEmployeeTasks") && appShellTs.includes("markEmployeeNotificationsRead") && !appShellTs.includes("NOTIFICATION_READ_STORAGE_KEY"));
check("P2.3 failure route validates stable error codes", p23RouteText.includes("FailEmployeeTaskRequestSchema") && p22AllStoreText.includes("failEmployeeTask") && dashboardSchemasTs.includes("FailEmployeeTaskRequestSchema"));
check("P2.3 customer projection includes report/source detail for UI", read(path.join(DASHBOARD_STORE_DIR, "customers.ts")).includes("report_json") && read(path.join(DASHBOARD_STORE_DIR, "customers.ts")).includes("source_urls") && read(path.join(DASHBOARD_STORE_DIR, "customers.ts")).includes("matchedProducts"));
check("P2.3 memory projection includes agent run status", read(path.join(DASHBOARD_STORE_DIR, "accio.ts")).includes("agent_run_status") && employeeApiTs.includes("agentRunStatus"));
check("P2.3 live DB inspection SQL exists", exists(CBE_DB_INSPECTION_SQL));
check("P2.3 live DB inspection SQL derives website from physical schema", dbInspectionSql.includes("lrr.source_snapshot_json->>'website'") && dbInspectionSql.includes("supplied_fields_json->>'website'"));
check("P2.3 live DB inspection SQL joins through real FK path", dbInspectionSql.includes("left join lead_runs lr") && dbInspectionSql.includes("lc.lead_run_id = lr.id") && dbInspectionSql.includes("join screening_targets st"));
check("P2.3 live DB inspection SQL avoids stale projection-only columns", !dbInspectionSql.includes("lc.agent_run_id") && !dbInspectionSql.includes("ls.finding") && !dbInspectionSql.includes("sr.company_name"));

if (process.env.CBE_DATABASE_URL) {
  await runLiveDatabaseChecks();
  await runLiveDashboardStoreChecks();
} else {
  section("CE18 live PostgreSQL migration checks");
  check("CBE_DATABASE_URL available for required live check", !requireDb, "set CBE_DATABASE_URL to run DB migration checks");
  section("CE19/P2.2 live Dashboard store API checks");
  check("CBE_DATABASE_URL available for live Dashboard store check", !requireDb, "set CBE_DATABASE_URL to run store round-trip checks");
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`Failures:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
}
