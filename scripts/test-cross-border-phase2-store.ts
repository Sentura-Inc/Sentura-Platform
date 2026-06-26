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
const DASHBOARD_AUTH_API_DIR = path.join(ROOT, "sentura/dashboard/src/app/api/auth");
const DASHBOARD_EMPLOYEE_DIR = path.join(ROOT, "sentura/dashboard/src/app/client-demos/cross-border/employee");
const DASHBOARD_ADMIN_DIR = path.join(ROOT, "sentura/dashboard/src/app/client-demos/cross-border/admin");
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
        delete from screening_address_locations
        where tenant_id = $1
          and screening_report_id in (
            select id from screening_reports where tenant_id = $1 and agent_run_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
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
    await client.query("delete from api_call_ledger where tenant_id = $1 and agent_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      agentRunIds,
    ]);
    await client.query(
      `
        delete from screening_batch_targets
        where tenant_id = $1
          and (
            child_agent_run_id = any($2::text[])
            or screening_batch_id in (
              select id from screening_batches where tenant_id = $1 and parent_agent_run_id = any($2::text[])
            )
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query("delete from screening_batches where tenant_id = $1 and parent_agent_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      agentRunIds,
    ]);
    await client.query("delete from screening_targets where tenant_id = $1 and (company_name like 'CE19 Probe%' or company_name like 'CE22 Paid Retry%')", [
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
    await client.query(
      `
        delete from lead_run_memberships
        where tenant_id = $1
          and lead_run_id in (
            select id from lead_runs where tenant_id = $1 and agent_run_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query(
      `
        update lead_discovery_scopes
        set active_agent_run_id = null
        where tenant_id = $1
          and active_agent_run_id = any($2::text[])
      `,
      [CBE_TENANT_ID, agentRunIds],
    );
    await client.query(
      `
        delete from lead_discovery_scopes
        where tenant_id = $1
          and canonical_scope_json::text like $2
      `,
      [CBE_TENANT_ID, `%ce19%`],
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
  const request = new Request("http://sentura.local/api/employee/customers", {
    headers: { "x-cbe-user-id": CBE_SEED_USERS.operatorA.id },
  });
  const context = await store.resolveCbeTenantContext(request);
  check("dashboard store resolves seeded operator context", context.userId === CBE_SEED_USERS.operatorA.id);

  const stamp = Date.now().toString(36);
  const leadDomain = `ce19-${stamp}.example.com`;
  const agentRunIds: string[] = [];
  try {
    const leadStart = await store.createLeadRun(context, {
      query_config: {
        product_keywords: [`ce19-phone-case-${stamp}`],
        countries: ["GB"],
        buyer_types: ["electronics retailer"],
        ce19_probe: stamp,
      },
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
            address_footprint: {
              section_title: "Google Maps 地址版图",
              coverage_status: "found",
              search_scope: {
                queries_run: [`CE19 Probe Buyer ${stamp} GB office`],
                countries: ["GB"],
                capped: false,
                limitations: [],
              },
              summary: {
                total_locations: 1,
                confirmed_locations: 1,
                probable_locations: 0,
                possible_related_locations: 0,
                operational_locations: 1,
                closed_locations: 0,
                countries: ["GB"],
                cities: ["London"],
              },
              locations: [
                {
                  google_place_id: `places/ce19-${stamp}`,
                  display_name: `CE19 Probe Buyer ${stamp}`,
                  address_type: "headquarters_or_office",
                  relationship_status: "confirmed_company_location",
                  formatted_address: "1 Probe Street, London, UK",
                  city: "London",
                  country: "GB",
                  business_status: "OPERATIONAL",
                  types: ["electronics_store"],
                  website_uri: `https://${leadDomain}`,
                  domain_match: true,
                  phone_match: "not_checked",
                  address_validation: {
                    status: "validated",
                    address_complete: true,
                    possible_next_action: "ACCEPT",
                  },
                  google_maps_uri: "https://maps.google.com/?cid=ce19",
                  match_confidence: 0.9,
                  match_reasons: ["Domain and company name match probe target."],
                  source_type: "google_maps_places",
                  fetched_at: fetchedAt,
                },
              ],
              open_questions: [],
            },
            coverage_gaps: [],
            open_questions: [],
          },
        ],
      },
    });
    check("dashboard store saves Screening report payload", screeningResult.reports.length === 1);
    const addressRows = await store.getCbePool().query(
      `
        select google_place_id, formatted_address, relationship_status, address_type
        from screening_address_locations
        where tenant_id = $1
          and screening_report_id = $2
      `,
      [CBE_TENANT_ID, screeningResult.reports[0].id],
    );
    check(
      "dashboard store saves Screening address-footprint rows",
      addressRows.rows.length === 1 &&
      addressRows.rows[0].google_place_id === `places/ce19-${stamp}` &&
      addressRows.rows[0].relationship_status === "confirmed_company_location" &&
      addressRows.rows[0].address_type === "headquarters_or_office",
    );
    const listedAddressRows = await store.listScreeningAddressLocations(context, {
      screeningReportId: screeningResult.reports[0].id,
      limit: 5,
    });
    check(
      "dashboard store lists Screening address-footprint rows through typed store",
      listedAddressRows.items.length === 1 &&
      listedAddressRows.items[0].googlePlaceId === `places/ce19-${stamp}` &&
      listedAddressRows.items[0].formattedAddress === "1 Probe Street, London, UK",
    );

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
    check("dashboard store does not create pending memory facts from Accio", accioResult.memoryFactIds.length === 0);
    check("dashboard store does not create Screening handoffs from Accio", accioResult.handoffIds.length === 0);

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
    const accioHandoffs = await store.getCbePool().query(
      `
        select id
        from handoff_events
        where tenant_id = $1
          and source_record_id = $2
      `,
      [CBE_TENANT_ID, accioResult.summaries[0].id],
    );
    check("CE22 live Accio summaries do not create handoff rows", accioHandoffs.rowCount === 0);
    let accioHandoffRejected = false;
    try {
      await store.createHandoffEvent(context, {
        from_agent_id: "cbe-accio-memory",
        to_agent_id: "cbe-buyer-screening",
        source_record_type: "accio_summary",
        source_record_id: accioResult.summaries[0].id,
        payload_json: { company_name: `CE19 Probe Buyer ${stamp}` },
      });
    } catch (error) {
      accioHandoffRejected = (error as { code?: string }).code === "accio_handoff_disabled";
    }
    check("CE22 live store rejects explicit Accio-to-Screening handoff", accioHandoffRejected);

    const paidBatch = await store.createScreeningRun(context, {
      target_summary: `CE22 Paid Retry Probe ${stamp}`,
      session_key: `ce22-paid-retry-a-${stamp}`,
      child_session_keys: [`ce22-paid-retry-a-${stamp}`, `ce22-paid-retry-b-${stamp}`],
      targets: [1, 2].map((item) => ({
        target_id: `ce22-paid-target-${item}-${stamp}`,
        source: "manual_input",
        company_name: `CE22 Paid Retry Buyer ${item} ${stamp}`,
        country: "US",
        domain: `ce22-paid-${item}-${stamp}.example.com`,
        product_interest: ["phone case"],
        supplied_fields: ["company_name", "domain"],
        missing_fields: [],
      })),
      estimated_cost_usd: 2,
      metadata_json: {
        target_count: 2,
        options: {
          paidEmailValidation: true,
          paidTradeData: true,
          maxPaidSpendUsd: 1,
        },
      },
    });
    agentRunIds.push(paidBatch.agentRun.id);
    for (const child of paidBatch.childRuns ?? []) agentRunIds.push(child.agentRun.id);
    const paidChild = paidBatch.childRuns?.[0];
    check(
      "CE22 live Screening fan-out returns initial paid-source policy",
      Boolean(paidChild?.paidSourcePolicy?.paidEmailValidation?.allowed && paidChild?.paidSourcePolicy?.paidTradeData?.allowed),
    );
    if (paidChild) {
      await store.failEmployeeTask(context, paidChild.agentRun.id, {
        error_code: "backend_error",
        error_message: "CE22 paid retry probe marks paid sources as reapproval-required.",
      });
      const retryResult = await store.retryFailedScreeningChildRun(context, paidChild.agentRun.id, {
        session_key: `ce22-paid-retry-retry-${stamp}`,
      });
      check(
        "CE22 live paid retry disables paid sources without explicit re-approval",
        retryResult.childRun.paidSourcePolicy?.paidEmailValidation?.allowed === false &&
          retryResult.childRun.paidSourcePolicy?.paidTradeData?.allowed === false &&
          retryResult.childRun.paidSourcePolicy?.paidEmailValidation?.reapprovalRequired === true &&
          retryResult.childRun.paidSourcePolicy?.paidTradeData?.reapprovalRequired === true,
      );
    }

    const failedRun = await store.createLeadRun(context, {
      query_config: {
        product_keywords: [`ce19-charger-${stamp}`],
        countries: ["US"],
        buyer_types: ["accessory importer"],
        ce19_invalid_probe: stamp,
      },
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
    const gateway = await import("../sentura/dashboard/src/lib/gateway/server-client.ts");
    gateway.disconnectServerGatewayClient();
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
  "screening_address_locations",
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
  "cbe_cost_limits",
  "cbe_cost_allowances",
  "cbe_cost_approval_requests",
  "screening_batches",
  "screening_batch_targets",
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
  "screening_address_locations_report_idx",
  "screening_address_locations_target_idx",
  "screening_address_locations_place_idx",
  "screening_address_locations_country_city_idx",
  "screening_address_locations_domain_idx",
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
  "cbe_cost_limits_user_idx",
  "cbe_cost_allowances_user_idx",
  "cbe_cost_approval_requests_pending_idx",
  "cbe_cost_approval_requests_user_idx",
  "agent_runs_queue_claim_idx",
  "agent_runs_active_session_idx",
  "screening_batches_parent_idx",
  "screening_batch_targets_batch_idx",
  "screening_batch_targets_retry_idx",
  "screening_batch_targets_paid_state_idx",
  "memory_facts_review_idx",
  "handoff_events_screening_consumption_idx",
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
  "admin.ts",
  "session.ts",
  "workload-coordinator.ts",
];

const p22EmployeeRoutes = [
  "employee/customers/route.ts",
  "employee/cost-budget/route.ts",
  "employee/lead-runs/route.ts",
  "employee/lead-runs/[id]/complete/route.ts",
  "employee/screening-runs/route.ts",
  "employee/screening-runs/[id]/complete/route.ts",
  "employee/screening-runs/[id]/retry/route.ts",
  "employee/tasks/route.ts",
  "employee/tasks/[id]/dismiss/route.ts",
  "employee/notifications/route.ts",
  "employee/notifications/read/route.ts",
  "employee/memory/route.ts",
  "employee/memory/facts/route.ts",
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
  "admin/operators/[id]/customers/route.ts",
  "admin/high-value-customers/route.ts",
  "admin/costs/route.ts",
  "admin/cost-limits/route.ts",
  "admin/cost-approvals/route.ts",
  "admin/agent-usage/route.ts",
];

const cbeAuthRoutes = [
  "login/route.ts",
  "logout/route.ts",
];

const cbeManagerPages = [
  "login/page.tsx",
  "page.tsx",
  "employees/page.tsx",
  "high-value-customers/page.tsx",
  "costs/page.tsx",
  "_data/admin-api.ts",
  "_components/report-dialog.tsx",
];

const p23EmployeeRoutes = [
  "employee/tasks/[id]/fail/route.ts",
];

section("CE18 migration file structure");
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql")).sort();
check("migration directory exists", exists(MIGRATIONS_DIR));
check("001 initial schema migration exists", migrationFiles.includes("001_initial_schema.sql"));
check("002 lead scope coordinator migration exists", migrationFiles.includes("002_lead_scope_coordinator.sql"));
check("005 workload queue and Screening fan-out migration exists", migrationFiles.includes("005_workload_queue_and_screening_batches.sql"));
check("006 Screening address locations migration exists", migrationFiles.includes("006_screening_address_locations.sql"));
check("007 Screening retry and memory approval migration exists", migrationFiles.includes("007_screening_retry_memory_approval.sql"));
check("008 Accio manual import formats migration exists", migrationFiles.includes("008_accio_manual_import_formats.sql"));
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
check("schema extends CBE profiles with manager-visible email", migrationSql.includes("add column if not exists email text"));
check("schema defines manager cost control periods", ["'day'", "'week'", "'month'", "'all_time'"].every((needle) => migrationSql.includes(needle)));
check("schema defines cost approval lifecycle", ["cbe_cost_limits", "cbe_cost_allowances", "cbe_cost_approval_requests", "'pending'", "'approved'", "'rejected'"].every((needle) => migrationSql.includes(needle)));
check("schema defines owner/team/visibility fields", ["owner_user_id", "team_name", "visibility_scope"].every((needle) => migrationSql.includes(needle)));
check("schema defines task activity monitoring events", migrationSql.includes("agent_run_activity_events") && migrationSql.includes("target_summary"));
check("schema defines migration history table", migrationSql.includes("cbe_schema_migrations"));
check("schema backfills Screening address-footprint JSON rows", migrationSql.includes("screening_address_backfill_") && migrationSql.includes("address_footprint,locations"));
check("schema persists per-target paid Screening retry state", [
  "paid_email_call_status",
  "paid_trade_call_status",
  "paid_email_reapproved_by_user_id",
  "paid_trade_reapproved_by_user_id",
  "screening_batch_targets_retry_idx",
].every((needle) => migrationSql.includes(needle)));
check("schema persists memory review and handoff consumption timestamps", [
  "reviewed_at",
  "review_note",
  "accepted_at",
  "completed_at",
  "consumed_by_agent_run_id",
].every((needle) => migrationSql.includes(needle)));
check("schema persists Accio manual import source/input/attachment metadata", [
  "source_kind",
  "input_format",
  "attachment_metadata_json",
  "manual_text",
  "manual_image",
  "accio_imports_source_kind_idx",
].every((needle) => migrationSql.includes(needle)));
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
check("dashboard store accepts scale-aware Screening assessment in report JSON", [
  "CompanyScaleClassSchema",
  "company_scale_assessment",
  "maps_physical_address_primary",
  "registry_disclosure_primary_maps_support",
].every((needle) => dashboardSchemasTs.includes(needle)));
check("root package declares pg dependency", rootPackage.includes('"pg"') && rootPackage.includes('"@types/pg"'));
check("sentura/lib package exports cross-border-store", senturaLibPackage.includes('"./cross-border-store"'));
check("sentura/lib typecheck includes cross-border-store", senturaLibTsconfig.includes("cross-border-store/**/*.ts"));
check(
  "seed records do not include email addresses or raw tokens",
  !/[@]|user_token_hash:|tokenHash|apiKey|secret/i.test(idsTs + seedTs),
);
check("seed defines requested temporary manager login", idsTs.includes('displayName: "孙总"') && idsTs.includes('defaultPassword: "1234"') && seedTs.includes("password_hash") && seedTs.includes("hashCbePassword"));

section("CE19/P2.2 Dashboard store and route structure");
const dashboardStoreSource = p22StoreModules
  .map((file) => [file, read(path.join(DASHBOARD_STORE_DIR, file))] as const);
for (const [file] of dashboardStoreSource) {
  check(`P2.2 dashboard store module exists: ${file}`, exists(path.join(DASHBOARD_STORE_DIR, file)));
}
for (const route of [...p22EmployeeRoutes, ...p22AdminRoutes]) {
  check(`P2.2 route exists: ${route}`, exists(path.join(DASHBOARD_API_DIR, route)));
}
for (const route of cbeAuthRoutes) {
  check(`manager auth route exists: ${route}`, exists(path.join(DASHBOARD_AUTH_API_DIR, route)));
}
for (const page of cbeManagerPages) {
  check(`manager UI file exists: ${page}`, exists(path.join(DASHBOARD_ADMIN_DIR, page)));
}
const p22AllStoreText = dashboardStoreSource.map(([, text]) => text).join("\n");
const dashboardAccioStoreTs = read(path.join(DASHBOARD_STORE_DIR, "accio.ts"));
const completionRouteText = [
  read(path.join(DASHBOARD_API_DIR, "employee/lead-runs/[id]/complete/route.ts")),
  read(path.join(DASHBOARD_API_DIR, "employee/screening-runs/[id]/complete/route.ts")),
  read(path.join(DASHBOARD_API_DIR, "employee/memory/imports/[id]/complete/route.ts")),
].join("\n");
const adminRouteText = p22AdminRoutes.map((route) => read(path.join(DASHBOARD_API_DIR, route))).join("\n");
const authRouteText = cbeAuthRoutes.map((route) => read(path.join(DASHBOARD_AUTH_API_DIR, route))).join("\n");
const managerPageText = cbeManagerPages.map((page) => read(path.join(DASHBOARD_ADMIN_DIR, page))).join("\n");
const managerEmployeeApiTs = read(path.join(DASHBOARD_EMPLOYEE_DIR, "_data/employee-api.ts"));
const managerAppShellTs = read(path.join(DASHBOARD_COMPONENTS_DIR, "app-shell.tsx"));
const managerAdminApiTs = read(path.join(DASHBOARD_ADMIN_DIR, "_data/admin-api.ts"));
const managerLoginPageTs = read(path.join(DASHBOARD_ADMIN_DIR, "login/page.tsx"));

check("dashboard package declares server store dependencies", dashboardPackage.includes('"pg"') && dashboardPackage.includes('"zod"') && dashboardPackage.includes('"@types/pg"'));
check("P2.2 store uses environment-backed pg pool", read(path.join(DASHBOARD_STORE_DIR, "db.ts")).includes("CBE_DATABASE_URL") && read(path.join(DASHBOARD_STORE_DIR, "db.ts")).includes("application_name"));
check("P2.2 tenant context resolves seeded CBE profiles", read(path.join(DASHBOARD_STORE_DIR, "tenant-context.ts")).includes("cbe_user_profiles") && read(path.join(DASHBOARD_STORE_DIR, "tenant-context.ts")).includes("x-cbe-user-id"));
check("P2.2 schemas require source URLs and fetched timestamps", p22AllStoreText.includes("source_url: z.string().url()") && p22AllStoreText.includes("fetched_at: IsoTimestampSchema"));
check("P2.2 Accio import schemas include manual source/input metadata", ["AccioImportSourceKindSchema", "AccioImportInputFormatSchema", "source_kind", "input_format", "attachment_metadata"].every((needle) => dashboardSchemasTs.includes(needle)));
check("P2.2 completion routes fail agent_runs on validation errors", completionRouteText.includes("safeParse") && completionRouteText.includes("failLeadCompletion") && completionRouteText.includes("failScreeningCompletion") && completionRouteText.includes("failAccioCompletion"));
check("P2.2 writes audit events for major store actions", p22AllStoreText.includes("createAuditEvent") && p22AllStoreText.includes("lead_run_completed") && p22AllStoreText.includes("screening_reports_saved") && p22AllStoreText.includes("accio_summaries_saved"));
check("P2.2 store writes Screening address-footprint rows", p22AllStoreText.includes("insert into screening_address_locations") && p22AllStoreText.includes("address_footprint") && p22AllStoreText.includes("saved_address_footprint_locations"));
check("P2.2 store exposes typed Screening address-footprint lookup", p22AllStoreText.includes("listScreeningAddressLocations") && p22AllStoreText.includes("from screening_address_locations sal"));
check("CE22 store enforces paid Screening retry re-approval state", [
  "retryFailedScreeningChildRun",
  "reapproval_required",
  "screening_paid_retry_reapproved",
  "paid_source_policy",
].every((needle) => p22AllStoreText.includes(needle)));
check("CE22 Accio completion keeps memory facts and Screening handoffs disabled", [
  "memory_fact_ids: []",
  "handoff_ids: []",
  "interop_disabled: true",
  "accio_interop_disabled",
].every((needle) => p22AllStoreText.includes(needle)) && !dashboardAccioStoreTs.includes("insertHandoffEvent"));
check("CE22 Accio-to-Screening handoff path is removed", [
  "screening_handoff_accepted",
  "screening_handoff_consumed",
].every((needle) => !p22AllStoreText.includes(needle)));
check("P2.2 store writes task activity events for admin monitoring", p22AllStoreText.includes("agent_run_activity_events") && p22AllStoreText.includes("createAgentRunActivityEvent"));
check("P2.2 read endpoints apply server-side tenant/user filters", p22AllStoreText.includes("scopedOwnerClause") && p22AllStoreText.includes("owner_user_id") && p22AllStoreText.includes("tenant_shared"));
check("P2.2 admin routes require CBE admin role", adminRouteText.includes("requireCbeAdmin(context)"));
check("P2.2 route handlers use Next App Router node runtime", [...p22EmployeeRoutes, ...p22AdminRoutes].every((route) => read(path.join(DASHBOARD_API_DIR, route)).includes('runtime = "nodejs"')));
check("P2.2 route handlers do not expose raw SQL to employees", !/\b(select|insert into|update|delete from)\b/i.test(completionRouteText));
check("CE22 retry route uses typed store and memory review route is disabled", [
  read(path.join(DASHBOARD_API_DIR, "employee/screening-runs/[id]/retry/route.ts")),
  read(path.join(DASHBOARD_API_DIR, "employee/memory/facts/route.ts")),
].join("\n").includes("retryFailedScreeningChildRun") && [
  read(path.join(DASHBOARD_API_DIR, "employee/screening-runs/[id]/retry/route.ts")),
  read(path.join(DASHBOARD_API_DIR, "employee/memory/facts/route.ts")),
].join("\n").includes("memory_fact_review_disabled"));

section("CE21 Manager account system");
check("manager schemas define cost limits and approval decisions", ["AdminCostLimitPatchRequestSchema", "AdminCostApprovalDecisionRequestSchema", "AdminCreateOperatorRequestSchema", "estimated_cost_usd"].every((needle) => dashboardSchemasTs.includes(needle)));
const tenantContextTs = read(path.join(DASHBOARD_STORE_DIR, "tenant-context.ts"));
const sessionHelperTs = read(path.join(DASHBOARD_STORE_DIR, "session.ts"));
check("tenant context resolves role-scoped session before debug headers", tenantContextTs.includes("cbeSessionFromRequest(request, role)?.userId") && tenantContextTs.includes("expectedRoleFromPath") && tenantContextTs.includes("x-cbe-user-id"));
check("tenant context recognizes canonical and rewritten CBE API paths", [
  "CBE_ADMIN_API_BASE",
  "CBE_EMPLOYEE_API_BASE",
  "CBE_INTERNAL_ADMIN_API_BASE",
  "CBE_INTERNAL_EMPLOYEE_API_BASE",
  "pathname.includes(`${CBE_ADMIN_API_BASE}/`)",
  "pathname.includes(`${CBE_INTERNAL_ADMIN_API_BASE}/`)",
  "pathname.includes(`${CBE_EMPLOYEE_API_BASE}/`)",
  "pathname.includes(`${CBE_INTERNAL_EMPLOYEE_API_BASE}/`)",
].every((needle) => tenantContextTs.includes(needle)));
check("session helper uses httpOnly-compatible signed role-scoped cookies", ["CBE_SESSION_COOKIE", "CBE_EMPLOYEE_SESSION_COOKIE", "CBE_ADMIN_SESSION_COOKIE", "cbeSessionCookieNameForRole", "createHmac", "timingSafeEqual"].every((needle) => sessionHelperTs.includes(needle)));
check("auth login resolves RBAC token and sets CBE session cookies", authRouteText.includes("sentura.rbac.users.resolveByToken") && authRouteText.includes("response.cookies.set") && authRouteText.includes("CBE_SESSION_COOKIE") && authRouteText.includes("cbeSessionCookieNameForRole"));
check("auth login can self-heal the seeded manager preset without raw DB env access", authRouteText.includes("PRESET_MANAGER_LOGIN") && authRouteText.includes("cbe-user-admin-001") && authRouteText.includes('displayName: "孙总"') && authRouteText.includes('password: "1234"') && authRouteText.includes("hashCbePassword"));
check("manager login page copies employee login layout and submits admin role", managerLoginPageTs.includes('src="/logo-full.svg"') && managerLoginPageTs.includes('placeholder="管理者姓名"') && managerLoginPageTs.includes('cbeRole: "admin"') && managerLoginPageTs.includes("CBE_ADMIN_EMPLOYEES_PATH"));
check("manager login is enforced by admin session instead of default admin header", managerAdminApiTs.includes("NEXT_PUBLIC_CBE_ADMIN_USER_ID?.trim()") && !managerAdminApiTs.includes('?? "cbe-user-admin-001"') && managerAdminApiTs.includes("CBE_ADMIN_LOGIN_PATH") && managerAppShellTs.includes("isAdminLoginPath") && managerAppShellTs.includes("CBE_SESSION_API_PATH") && managerAppShellTs.includes("role=admin") && managerAppShellTs.includes('body?.user?.cbeRole !== "admin"'));
check("employee and manager guards use separate role sessions", managerAppShellTs.includes("role=operator") && managerAppShellTs.includes("role=admin") && managerAppShellTs.includes("logout?role="));
check("admin operator creation writes real CBE name/password profile without gateway dependency", adminRouteText.includes("createLocalOperatorIdentity") && adminRouteText.includes("password_only") && !adminRouteText.includes("sentura.rbac.users.upsert") && p22AllStoreText.includes("upsertAdminOperatorProfile") && p22AllStoreText.includes("password_hash") && p22AllStoreText.includes("operator_name_exists"));
check("CBE route errors surface plain RPC error messages", read(path.join(DASHBOARD_STORE_DIR, "route-utils.ts")).includes('"message" in error') && read(path.join(DASHBOARD_STORE_DIR, "route-utils.ts")).includes("record.message"));
check("admin store exposes manager three-page data functions", ["listAdminOperators", "listAdminHighValueCustomers", "listAdminCosts", "upsertAdminCostLimit", "decideAdminCostApproval"].every((needle) => p22AllStoreText.includes(needle)));
check("admin routes include write endpoints for operator status, limits, approvals", adminRouteText.includes("PATCH(") && adminRouteText.includes("POST(") && adminRouteText.includes("AdminCostLimitPatchRequestSchema") && adminRouteText.includes("AdminCostApprovalDecisionRequestSchema"));
check("employee task create paths call budget preflight before agent run insert", ["lead-runs.ts", "screening.ts", "accio.ts"].every((file) => {
  const text = read(path.join(DASHBOARD_STORE_DIR, file));
  return /await checkCbeCostBudgetBeforeRun[\s\S]+insertAgentRun/.test(text);
}));
check("employee API passes estimated task costs to server", ["estimateLeadTaskCost", "estimateScreeningTaskCost", "estimateMemoryTaskCost", "estimated_cost_usd"].every((needle) => managerEmployeeApiTs.includes(needle)));
check("employee API persists dynamic task timing metadata through coordinator records", [
  "estimateLeadTaskDurationMs",
  "estimateScreeningTaskDurationMs",
  "estimateScreeningTaskDurationMsForTargetCount",
  "metadata_json",
  "estimated_ms",
  "timeout_ms",
  "positiveMs(metadata.estimated_ms)",
  "positiveMs(metadata.timeout_ms)",
  "queuedDelayMs(statusValue, metadata)",
].every((needle) => managerEmployeeApiTs.includes(needle)) && dashboardSchemasTs.includes("metadata_json: JsonRecordSchema.default({})") && [
  "...input.metadata_json",
  "workloadMetadata(admission)",
  "target_count",
  "requested_target_count",
].every((needle) => p22AllStoreText.includes(needle)));
check("AppShell switches employee and manager titles/nav", managerAppShellTs.includes("跨境电商员工操作系统") && managerAppShellTs.includes("跨境电商管理者系统") && managerAppShellTs.includes("员工管理") && managerAppShellTs.includes("优先跟进客户") && managerAppShellTs.includes("费用监控"));
check("manager UI renders only the requested three pages", managerPageText.includes("员工管理") && managerPageText.includes("优先跟进客户") && managerPageText.includes("费用监控") && managerPageText.includes("完整背调报告"));
check("manager cost UI separates actual, estimated, and unpriced cost signals", managerPageText.includes("已发生费用") && managerPageText.includes("预计") && managerPageText.includes("暂未折算"));
check("manager employee cost details moved from employee management to cost monitoring", [
  "selectedCostUserId",
  "fetchAdminOperator",
  "员工费用明细",
  "costDetail.costEvents.map",
].every((needle) => read(path.join(DASHBOARD_ADMIN_DIR, "costs/page.tsx")).includes(needle)) && !read(path.join(DASHBOARD_ADMIN_DIR, "employees/page.tsx")).includes("费用明细") && !read(path.join(DASHBOARD_ADMIN_DIR, "employees/page.tsx")).includes("costEvents.map"));
check("manager cost amounts are capped at two decimals in UI, schema, and overrun math", [
  "function money(value: unknown)",
  "moneyInput",
  "limit_usd: money(limitInputs",
  "amount_usd: money(allowanceInputs",
  "approved_amount_usd: money(approvalInputs",
].every((needle) => managerPageText.includes(needle)) && dashboardSchemasTs.includes("CbeMoneyUsdSchema") && [
  "function moneyUsd(",
  "function moneyUsdText(",
  "requestedAllowanceUsd = moneyUsd",
].every((needle) => p22AllStoreText.includes(needle)) && !p22AllStoreText.includes("toFixed(6)"));

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
const employeeNotificationTargetsTs = read(path.join(DASHBOARD_EMPLOYEE_DIR, "_data/employee-notification-targets.ts"));
const appShellTs = read(path.join(DASHBOARD_COMPONENTS_DIR, "app-shell.tsx"));
const authLoginPageTs = read(path.join(ROOT, "sentura/dashboard/src/app/auth/login/page.tsx"));
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
check("P2.3 customers page applies child paid-source policy before Screening execution", ["screeningOptionsForChild", "paidSourcePolicy", "policy.paidEmailValidation?.allowed", "policy.paidTradeData?.allowed"].every((needle) => employeeCustomersPageTs.includes(needle)));
check("P2.3 memory page starts/completes/fails DB tasks", ["createEmployeeAccioImport", "completeEmployeeAccioImport", "failEmployeeTaskInDb", "refreshDbBackedMemory"].every((needle) => employeeMemoryPageTs.includes(needle)));
check("P2.3 memory page does not expose approval-to-memory action", !["reviewEmployeeMemoryFacts", "批准写入", "memoryPreviewStatusLabel"].some((needle) => employeeMemoryPageTs.includes(needle)) && employeeMemoryPageTs.includes("不写入长期记忆"));
check("P2.3 memory page supports JSON/text/image manual imports through normalizer", ["normalizeJsonMemoryImport", "normalizeTextMemoryImport", "normalizeImageMemoryImport", "toGatewayChatAttachments", "截图导入需要立即分析"].every((needle) => employeeMemoryPageTs.includes(needle)));
check("P2.3 employee header keeps DB task refresh and task notification links", appShellTs.includes("fetchEmployeeTasks") && appShellTs.includes("markEmployeeNotificationsRead") && appShellTs.includes("EMPLOYEE_MESSAGE_CENTER_HREF") && employeeNotificationTargetsTs.includes("employee-messages"));
check("P2.3 employee and manager notifications use scrollable targeted message lists", appShellTs.includes("notificationListMaxHeight") && appShellTs.includes("overflow-y-auto") && appShellTs.includes("previewMessages.map((item)") && appShellTs.includes("employeeTaskNotificationHref(item)") && appShellTs.includes("messages.slice(0, EMPLOYEE_NOTIFICATION_PREVIEW_LIMIT)") && appShellTs.includes("EMPLOYEE_NOTIFICATION_VISIBLE_COUNT") && employeeNotificationTargetsTs.includes("EMPLOYEE_NOTIFICATION_PREVIEW_LIMIT = 10") && employeeNotificationTargetsTs.includes("EMPLOYEE_NOTIFICATION_VISIBLE_COUNT = 3") && employeeNotificationTargetsTs.includes("highlightTask=") && employeeNotificationTargetsTs.includes("employeeCostHighlightHref") && appShellTs.includes("snapshot.approvals.map") && appShellTs.includes("snapshot.highValueItems.map") && employeeHomePageTs.includes("max-h-[360px]") && employeeHomePageTs.includes("overflow-y-auto"));
check("P2.3 employee API cost budget syncs manager limits", employeeApiTs.includes("fetchEmployeeCostBudget") && employeeApiTs.includes('employeeApi("/cost-budget")') && read(path.join(DASHBOARD_API_DIR, "employee/cost-budget/route.ts")).includes("getEmployeeCostBudget") && p22AllStoreText.includes("export async function getEmployeeCostBudget") && p22AllStoreText.includes("limitUsd = limitEnabled ? moneyUsd(baseLimitUsd + activeAllowanceUsd) : 0") && p22AllStoreText.includes("if (scopedEvents.length === 0) return null") && p22AllStoreText.includes('const ENFORCED_EMPLOYEE_COST_LIMIT_PERIODS: CbeCostPeriod[] = ["month"]') && p22AllStoreText.includes("period = any($3::text[])"));
check("P2.3 employee login uses manager-set name/password session", authLoginPageTs.includes("displayName") && authLoginPageTs.includes("password") && authRouteText.includes("verifyCbePassword") && appShellTs.includes("/api/auth/logout"));
check("P2.3 failure route validates stable error codes", p23RouteText.includes("FailEmployeeTaskRequestSchema") && p22AllStoreText.includes("failEmployeeTask") && dashboardSchemasTs.includes("FailEmployeeTaskRequestSchema"));
check("P2.3 customer projection includes report/source detail for UI", read(path.join(DASHBOARD_STORE_DIR, "customers.ts")).includes("report_json") && read(path.join(DASHBOARD_STORE_DIR, "customers.ts")).includes("source_urls") && read(path.join(DASHBOARD_STORE_DIR, "customers.ts")).includes("matchedProducts"));
check("P2.3 memory projection includes agent run status", read(path.join(DASHBOARD_STORE_DIR, "accio.ts")).includes("agent_run_status") && employeeApiTs.includes("agentRunStatus"));
check("P2.3 Accio store persists and projects import source/input metadata", ["source_kind", "input_format", "attachment_metadata_json", "sourceKind", "inputFormat", "attachmentMetadata"].every((needle) => read(path.join(DASHBOARD_STORE_DIR, "accio.ts")).includes(needle) || employeeApiTs.includes(needle)));
check("P2.3 Accio memory projection exposes structured deal facts", ["customerProfile", "purchaseIntent", "negotiatedPrices", "behaviorSignals", "customer_profile_json", "purchase_intent_json", "negotiated_price_json"].every((needle) => read(path.join(DASHBOARD_STORE_DIR, "accio.ts")).includes(needle) || employeeApiTs.includes(needle)));
check("P2.3 Accio memory projection prefers analyzed company over placeholder import company", read(path.join(DASHBOARD_STORE_DIR, "accio.ts")).includes("nullif(asum.customer_profile_json->>'company_name'") && read(path.join(DASHBOARD_STORE_DIR, "accio.ts")).includes("nullif(ac.company_name"));
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
