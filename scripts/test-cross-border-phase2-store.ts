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
const PACKAGE_JSON = path.join(ROOT, "package.json");
const SENTURA_LIB_PACKAGE = path.join(ROOT, "sentura/lib/package.json");
const SENTURA_LIB_TSCONFIG = path.join(ROOT, "sentura/lib/tsconfig.json");

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
const senturaLibPackage = read(SENTURA_LIB_PACKAGE);
const senturaLibTsconfig = read(SENTURA_LIB_TSCONFIG);

check("db.ts requires CBE_DATABASE_URL", dbTs.includes("CBE_DATABASE_URL") && dbTs.includes("do not commit database credentials"));
check("migration runner uses a transaction", migrateTs.includes('client.query("begin")') && migrateTs.includes('client.query("commit")'));
check("migration runner checks immutable checksums", migrateTs.includes("checksum changed after it was applied"));
check("seed creates cross-border tenant id", idsTs.includes(`CBE_TENANT_ID = "${CBE_TENANT_ID}"`));
check("seed defines one admin and two operators", idsTs.includes("admin") && idsTs.includes("operatorA") && idsTs.includes("operatorB"));
check("seed writes cbe_user_profiles", seedTs.includes("insert into cbe_user_profiles"));
check("schemas define customer role enum", schemasTs.includes('z.enum(["admin", "operator"])'));
check("dashboard store declares customer role boundary", dashboardStore.includes("CBE_PRODUCT_ROLES") && dashboardStore.includes("admin") && dashboardStore.includes("operator"));
check("root package declares pg dependency", rootPackage.includes('"pg"') && rootPackage.includes('"@types/pg"'));
check("sentura/lib package exports cross-border-store", senturaLibPackage.includes('"./cross-border-store"'));
check("sentura/lib typecheck includes cross-border-store", senturaLibTsconfig.includes("cross-border-store/**/*.ts"));
check(
  "seed records do not include email addresses or raw tokens",
  !/[@]|user_token_hash:|tokenHash|password|apiKey|secret/i.test(idsTs + seedTs),
);

if (process.env.CBE_DATABASE_URL) {
  await runLiveDatabaseChecks();
} else {
  section("CE18 live PostgreSQL migration checks");
  check("CBE_DATABASE_URL available for required live check", !requireDb, "set CBE_DATABASE_URL to run DB migration checks");
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`Failures:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
}
