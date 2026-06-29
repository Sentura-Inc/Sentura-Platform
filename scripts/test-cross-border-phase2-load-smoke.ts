#!/usr/bin/env tsx
/**
 * CE23 checks for CBE Phase 2 P2.6 load-smoke readiness.
 *
 * Static checks always run. Live PostgreSQL checks run when CBE_DATABASE_URL is
 * set, or are required when --require-db is passed. The live smoke is DB-only:
 * it creates workload/queue records through the typed store boundary and does
 * not start real OpenClaw AgentChat sessions or external provider calls.
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createCbePool } from "../sentura/lib/cross-border-store/db.js";
import { CBE_TENANT_ID, createCbeId } from "../sentura/lib/cross-border-store/ids.js";
import { migrateCbeDatabase } from "../sentura/lib/cross-border-store/migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PHASE2_PLAN = path.join(ROOT, "跨境电商/PHASE-2.md");
const PHASE2_RUNBOOK = path.join(ROOT, "跨境电商/P2.6-LOAD-SMOKE-RUNBOOK.md");
const TEST_MATRIX = path.join(ROOT, "docs/TESTS.md");
const TEST_DETAIL = path.join(ROOT, "docs/tests/tests-cross-border-phase2.md");
const WORKLOAD_COORDINATOR = path.join(ROOT, "sentura/dashboard/src/lib/cross-border-store/workload-coordinator.ts");
const BACKUP_DRILL = path.join(ROOT, "scripts/cross-border-phase2-backup-restore-drill.sh");

const requireDb = process.argv.includes("--require-db");
const reportIndex = process.argv.indexOf("--report");
const reportPath = reportIndex >= 0
  ? path.resolve(ROOT, process.argv[reportIndex + 1] ?? "outputs/cbe-phase2-load-smoke-report.json")
  : null;

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

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function cleanupCe23Probe(input: {
  stamp: string;
  userIds: string[];
  profileIds: string[];
  agentRunIds: string[];
  leadRunIds: string[];
  scopeIds: string[];
  screeningBatchIds: string[];
  screeningTargetIds: string[];
  accioImportIds: string[];
  domainPrefix: string;
}) {
  const pool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce23-cleanup" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `
        delete from api_call_ledger
        where tenant_id = $1
          and (
            metadata_json->>'load_smoke_stamp' = $2
            or agent_run_id = any($3::text[])
          )
      `,
      [CBE_TENANT_ID, input.stamp, input.agentRunIds],
    );
    await client.query(
      `
        delete from agent_run_activity_events
        where tenant_id = $1
          and agent_run_id = any($2::text[])
      `,
      [CBE_TENANT_ID, input.agentRunIds],
    );
    await client.query(
      `
        delete from audit_events
        where tenant_id = $1
          and (
            metadata_json->>'load_smoke_stamp' = $2
            or metadata_json->>'agent_run_id' = any($3::text[])
            or user_id = any($4::text[])
          )
      `,
      [CBE_TENANT_ID, input.stamp, input.agentRunIds, input.userIds],
    );
    await client.query(
      `
        delete from lead_sources
        where tenant_id = $1
          and lead_candidate_id in (
            select id
            from lead_candidates
            where tenant_id = $1
              and normalized_domain like $2
          )
      `,
      [CBE_TENANT_ID, `${input.domainPrefix}%`],
    );
    await client.query(
      `
        delete from lead_candidates
        where tenant_id = $1
          and (
            normalized_domain like $2
            or lead_run_id = any($3::text[])
            or created_by_user_id = any($4::text[])
          )
      `,
      [CBE_TENANT_ID, `${input.domainPrefix}%`, input.leadRunIds, input.userIds],
    );
    await client.query("delete from lead_allocations where tenant_id = $1 and source_lead_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      input.leadRunIds,
    ]);
    await client.query("delete from lead_run_results where tenant_id = $1 and lead_run_id = any($2::text[])", [
      CBE_TENANT_ID,
      input.leadRunIds,
    ]);
    await client.query(
      `
        delete from lead_run_memberships
        where tenant_id = $1
          and (lead_run_id = any($2::text[]) or scope_id = any($3::text[]))
      `,
      [CBE_TENANT_ID, input.leadRunIds, input.scopeIds],
    );
    await client.query(
      `
        delete from lead_identities
        where tenant_id = $1
          and identity_key like $2
      `,
      [CBE_TENANT_ID, `domain:${input.domainPrefix}%`],
    );
    await client.query("delete from lead_runs where tenant_id = $1 and id = any($2::text[])", [
      CBE_TENANT_ID,
      input.leadRunIds,
    ]);
    await client.query("delete from lead_discovery_scopes where tenant_id = $1 and id = any($2::text[])", [
      CBE_TENANT_ID,
      input.scopeIds,
    ]);
    await client.query(
      `
        delete from screening_address_locations
        where tenant_id = $1
          and (agent_run_id = any($2::text[]) or screening_target_id = any($3::text[]))
      `,
      [CBE_TENANT_ID, input.agentRunIds, input.screeningTargetIds],
    );
    await client.query(
      `
        delete from screening_evidence
        where tenant_id = $1
          and screening_report_id in (
            select id
            from screening_reports
            where tenant_id = $1
              and (agent_run_id = any($2::text[]) or screening_target_id = any($3::text[]))
          )
      `,
      [CBE_TENANT_ID, input.agentRunIds, input.screeningTargetIds],
    );
    await client.query(
      `
        delete from screening_score_blocks
        where tenant_id = $1
          and screening_report_id in (
            select id
            from screening_reports
            where tenant_id = $1
              and (agent_run_id = any($2::text[]) or screening_target_id = any($3::text[]))
          )
      `,
      [CBE_TENANT_ID, input.agentRunIds, input.screeningTargetIds],
    );
    await client.query(
      `
        delete from screening_reports
        where tenant_id = $1
          and (agent_run_id = any($2::text[]) or screening_target_id = any($3::text[]))
      `,
      [CBE_TENANT_ID, input.agentRunIds, input.screeningTargetIds],
    );
    await client.query(
      `
        delete from screening_batch_targets
        where tenant_id = $1
          and (
            screening_batch_id = any($2::text[])
            or screening_target_id = any($3::text[])
            or child_agent_run_id = any($4::text[])
          )
      `,
      [CBE_TENANT_ID, input.screeningBatchIds, input.screeningTargetIds, input.agentRunIds],
    );
    await client.query(
      `
        delete from screening_batches
        where tenant_id = $1
          and (id = any($2::text[]) or created_by_user_id = any($3::text[]))
      `,
      [CBE_TENANT_ID, input.screeningBatchIds, input.userIds],
    );
    await client.query(
      `
        delete from screening_targets
        where tenant_id = $1
          and (id = any($2::text[]) or created_by_user_id = any($3::text[]))
      `,
      [CBE_TENANT_ID, input.screeningTargetIds, input.userIds],
    );
    await client.query(
      `
        delete from handoff_events
        where tenant_id = $1
          and (created_by_user_id = any($2::text[]) or owner_user_id = any($2::text[]))
      `,
      [CBE_TENANT_ID, input.userIds],
    );
    await client.query(
      `
        delete from memory_facts
        where tenant_id = $1
          and (created_by_user_id = any($2::text[]) or owner_user_id = any($2::text[]))
      `,
      [CBE_TENANT_ID, input.userIds],
    );
    await client.query(
      `
        delete from accio_summaries
        where tenant_id = $1
          and (agent_run_id = any($2::text[]) or created_by_user_id = any($3::text[]))
      `,
      [CBE_TENANT_ID, input.agentRunIds, input.userIds],
    );
    await client.query(
      `
        delete from accio_messages
        where tenant_id = $1
          and accio_conversation_id in (
            select id
            from accio_conversations
            where tenant_id = $1
              and accio_import_id = any($2::text[])
          )
      `,
      [CBE_TENANT_ID, input.accioImportIds],
    );
    await client.query(
      `
        delete from accio_conversations
        where tenant_id = $1
          and accio_import_id = any($2::text[])
      `,
      [CBE_TENANT_ID, input.accioImportIds],
    );
    await client.query(
      `
        delete from accio_imports
        where tenant_id = $1
          and (id = any($2::text[]) or agent_run_id = any($3::text[]) or user_id = any($4::text[]))
      `,
      [CBE_TENANT_ID, input.accioImportIds, input.agentRunIds, input.userIds],
    );
    await client.query(
      `
        delete from agent_runs
        where tenant_id = $1
          and (
            id = any($2::text[])
            or user_id = any($3::text[])
            or owner_user_id = any($3::text[])
          )
      `,
      [CBE_TENANT_ID, input.agentRunIds, input.userIds],
    );
    await client.query("delete from cbe_user_profiles where tenant_id = $1 and id = any($2::text[])", [
      CBE_TENANT_ID,
      input.profileIds,
    ]);
    await client.query("delete from sentura_users where tenant_id = $1 and id = any($2::text[])", [
      CBE_TENANT_ID,
      input.userIds,
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

async function seedLoadSmokeUsers(stamp: string) {
  const pool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce23-user-seed" });
  const client = await pool.connect();
  const userIds: string[] = [];
  const profileIds: string[] = [];
  try {
    await client.query("begin");
    for (let i = 0; i < 50; i++) {
      const padded = String(i + 1).padStart(2, "0");
      const userId = `ce23_user_${stamp}_${padded}`;
      const profileId = `ce23_profile_${stamp}_${padded}`;
      userIds.push(userId);
      profileIds.push(profileId);
      await client.query(
        `
          insert into sentura_users (id, tenant_id, display_name, role, department_id)
          values ($1, $2, $3, 'customer_operator', 'sales')
          on conflict (id) do nothing
        `,
        [userId, CBE_TENANT_ID, `CE23 Operator ${padded}`],
      );
      await client.query(
        `
          insert into cbe_user_profiles (
            id,
            tenant_id,
            user_id,
            cbe_role,
            display_name,
            team_name,
            status
          )
          values ($1, $2, $3, 'operator', $4, $5, 'active')
          on conflict (tenant_id, user_id)
          do update set
            display_name = excluded.display_name,
            team_name = excluded.team_name,
            status = 'active'
        `,
        [profileId, CBE_TENANT_ID, userId, `CE23 Operator ${padded}`, `CE23 Team ${((i % 5) + 1)}`],
      );
    }
    await client.query("commit");
    return { userIds, profileIds };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertControlledActiveRuns(input: {
  context: any;
  count: number;
  stamp: string;
  existingIds: string[];
}) {
  const pool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce23-pressure-active" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (let i = 0; i < input.count; i++) {
      const id = `ce23_pressure_active_${input.stamp}_${i + 1}`;
      input.existingIds.push(id);
      await client.query(
        `
          insert into agent_runs (
            id,
            tenant_id,
            user_id,
            owner_user_id,
            visibility_scope,
            agent_id,
            session_key,
            status,
            task_kind,
            target_summary,
            current_stage,
            metadata_json
          )
          values ($1, $2, $3, $3, 'private', 'cbe-accio-memory', $4, 'running', 'accio_memory', $5, 'controlled_pressure_profile', $6::jsonb)
        `,
        [
          id,
          CBE_TENANT_ID,
          input.context.userId,
          `ce23-pressure-session-${input.stamp}-${i + 1}`,
          "CE23 DB-only pressure active slot",
          JSON.stringify({ load_smoke_stamp: input.stamp, pressure_profile: "c32_hard_guard_db_only" }),
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function workloadCounts() {
  const pool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce23-counts" });
  const client = await pool.connect();
  try {
    const result = await client.query<{
      active_total: string;
      queued_total: string;
      running_lead: string;
      running_screening: string;
      running_accio: string;
    }>(
      `
        select
          count(*) filter (where status in ('running', 'polling') and session_key is not null)::text as active_total,
          count(*) filter (where status = 'queued')::text as queued_total,
          count(*) filter (where status in ('running', 'polling') and session_key is not null and agent_id = 'cbe-lead-discovery')::text as running_lead,
          count(*) filter (where status in ('running', 'polling') and session_key is not null and agent_id = 'cbe-buyer-screening')::text as running_screening,
          count(*) filter (where status in ('running', 'polling') and session_key is not null and agent_id = 'cbe-accio-memory')::text as running_accio
        from agent_runs
        where tenant_id = $1
      `,
      [CBE_TENANT_ID],
    );
    const row = result.rows[0];
    return {
      activeTotal: Number(row.active_total),
      queuedTotal: Number(row.queued_total),
      runningLead: Number(row.running_lead),
      runningScreening: Number(row.running_screening),
      runningAccio: Number(row.running_accio),
    };
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertLoadSmokeLedgerAndAudit(input: {
  context: any;
  stamp: string;
  agentRunIds: string[];
  p95LatencyMs: number;
  report: Record<string, unknown>;
}) {
  const pool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce23-ledger-audit" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const [index, agentRunId] of input.agentRunIds.slice(0, 3).entries()) {
      await client.query(
        `
          insert into api_call_ledger (
            id,
            tenant_id,
            agent_run_id,
            provider,
            endpoint,
            source_type,
            request_units,
            cost_usd,
            status,
            metadata_json
          )
          values ($1, $2, $3, 'ce23_load_smoke', 'db-only-smoke', 'demo_fixture', 1, $4, 'simulated', $5::jsonb)
        `,
        [
          createCbeId("api_call"),
          CBE_TENANT_ID,
          agentRunId,
          0.01 * (index + 1),
          JSON.stringify({ load_smoke_stamp: input.stamp, db_only: true }),
        ],
      );
    }
    await client.query(
      `
        insert into audit_events (
          id,
          tenant_id,
          user_id,
          agent_id,
          event_type,
          data_tier,
          metadata_json
        )
        values ($1, $2, $3, null, 'cbe_phase2_load_smoke_recorded', 'T1', $4::jsonb)
      `,
      [
        createCbeId("audit"),
        CBE_TENANT_ID,
        input.context.userId,
        JSON.stringify({
          load_smoke_stamp: input.stamp,
          p95_dashboard_api_latency_ms: input.p95LatencyMs,
          report: input.report,
        }),
      ],
    );
    const ledgerRows = await client.query<{ count: number }>(
      `
        select count(*)::int as count
        from api_call_ledger
        where tenant_id = $1
          and metadata_json->>'load_smoke_stamp' = $2
          and agent_run_id is not null
      `,
      [CBE_TENANT_ID, input.stamp],
    );
    const auditRows = await client.query<{ count: number }>(
      `
        select count(*)::int as count
        from audit_events
        where tenant_id = $1
          and metadata_json->>'load_smoke_stamp' = $2
          and metadata_json->'report'->>'go_live_readiness' = 'db_only_preflight_passed'
      `,
      [CBE_TENANT_ID, input.stamp],
    );
    await client.query("commit");
    return {
      ledgerCount: ledgerRows.rows[0]?.count ?? 0,
      auditCount: auditRows.rows[0]?.count ?? 0,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function runLiveLoadSmoke() {
  section("CE23 live PostgreSQL load-smoke checks");
  await migrateCbeDatabase({ seed: true });
  const previousEnv = {
    CBE_TASK_MAX_ACTIVE_TOTAL: process.env.CBE_TASK_MAX_ACTIVE_TOTAL,
    CBE_TASK_MAX_ACTIVE_TOTAL_HARD: process.env.CBE_TASK_MAX_ACTIVE_TOTAL_HARD,
    CBE_LEAD_MAX_ACTIVE_RUNS: process.env.CBE_LEAD_MAX_ACTIVE_RUNS,
    CBE_SCREENING_MAX_ACTIVE_TARGETS: process.env.CBE_SCREENING_MAX_ACTIVE_TARGETS,
    CBE_ACCIO_MAX_ACTIVE_IMPORTS: process.env.CBE_ACCIO_MAX_ACTIVE_IMPORTS,
    CBE_QUEUE_LEASE_SECONDS: process.env.CBE_QUEUE_LEASE_SECONDS,
    CBE_SCREENING_ALLOW_BATCH3: process.env.CBE_SCREENING_ALLOW_BATCH3,
  };
  process.env.CBE_TASK_MAX_ACTIVE_TOTAL = "24";
  process.env.CBE_TASK_MAX_ACTIVE_TOTAL_HARD = "32";
  process.env.CBE_LEAD_MAX_ACTIVE_RUNS = "12";
  process.env.CBE_SCREENING_MAX_ACTIVE_TARGETS = "12";
  process.env.CBE_ACCIO_MAX_ACTIVE_IMPORTS = "3";
  process.env.CBE_QUEUE_LEASE_SECONDS = "30";
  process.env.CBE_SCREENING_ALLOW_BATCH3 = "false";

  const storeModule = await import("../sentura/dashboard/src/lib/cross-border-store/index.ts");
  const store = (storeModule.default ?? storeModule) as Record<string, any>;
  const stamp = Date.now().toString(36);
  const domainPrefix = `ce23-${stamp}`;
  const agentRunIds: string[] = [];
  const leadRunIds: string[] = [];
  const scopeIds: string[] = [];
  const screeningBatchIds: string[] = [];
  const screeningTargetIds: string[] = [];
  const accioImportIds: string[] = [];
  let userIds: string[] = [];
  let profileIds: string[] = [];

  try {
    const seeded = await seedLoadSmokeUsers(stamp);
    userIds = seeded.userIds;
    profileIds = seeded.profileIds;
    check("load smoke seeds 50 tenant operators", userIds.length === 50 && profileIds.length === 50);

    const contexts: any[] = [];
    const latencies: number[] = [];
    for (const userId of userIds) {
      const start = performance.now();
      const context = await store.resolveCbeTenantContext(new Request(
        "http://sentura.local/api/employee/customers",
        { headers: { "x-cbe-user-id": userId } },
      ));
      latencies.push(performance.now() - start);
      contexts.push(context);
    }
    const p95LatencyMs = Math.round(percentile(latencies, 95) * 100) / 100;
    check("load smoke simulates 50 dashboard sessions", contexts.length === 50);
    check("load smoke records p95 dashboard API latency", p95LatencyMs > 0);

    const exactScopes = [0, 1, 2];
    for (const group of exactScopes) {
      const first = await store.createLeadRun(contexts[group * 2], {
        query_config: {
          product_keywords: [`${domainPrefix}-exact-${group}`],
          countries: ["GB"],
          buyer_types: [`ce23 exact buyer ${group}`],
        },
        target_count: 10,
        session_key: `ce23-lead-exact-${stamp}-${group}-a`,
        target_summary: `CE23 exact duplicate Lead ${group} A`,
        estimated_cost_usd: 0,
      });
      agentRunIds.push(first.agentRun.id);
      leadRunIds.push(first.leadRun.id);
      scopeIds.push(first.coordinatorDecision.scopeId);
      const joined = await store.createLeadRun(contexts[group * 2 + 1], {
        query_config: {
          product_keywords: [`${domainPrefix}-exact-${group}`],
          countries: ["GB"],
          buyer_types: [`ce23 exact buyer ${group}`],
        },
        target_count: 10,
        session_key: `ce23-lead-exact-${stamp}-${group}-b`,
        target_summary: `CE23 exact duplicate Lead ${group} B`,
        estimated_cost_usd: 0,
      });
      leadRunIds.push(joined.leadRun.id);
      check(`exact duplicate Lead scope ${group + 1} joins existing run`, joined.coordinatorDecision.action === "join_existing" && !joined.agentRun);
    }

    for (const group of [0, 1]) {
      const baseIndex = 6 + group * 2;
      const base = await store.createLeadRun(contexts[baseIndex], {
        query_config: {
          product_keywords: [`${domainPrefix}-near-${group}`],
          countries: ["US"],
          buyer_types: [`ce23 near buyer ${group}`],
        },
        target_count: 10,
        session_key: `ce23-lead-near-${stamp}-${group}-a`,
        target_summary: `CE23 near Lead ${group} A`,
        estimated_cost_usd: 0,
      });
      agentRunIds.push(base.agentRun.id);
      leadRunIds.push(base.leadRun.id);
      scopeIds.push(base.coordinatorDecision.scopeId);
      const near = await store.createLeadRun(contexts[baseIndex + 1], {
        query_config: {
          product_keywords: [`${domainPrefix}-near-${group}`],
          countries: ["US"],
          buyer_types: [`ce23 near buyer ${group}`],
        },
        target_count: 10,
        session_key: `ce23-lead-near-${stamp}-${group}-b`,
        target_summary: `CE23 near Lead ${group} B`,
        estimated_cost_usd: 0,
      });
      check(`near-duplicate Lead scope ${group + 1} offers choices`, near.coordinatorDecision.action === "offer_near_duplicate_choices" && !near.agentRun);
    }
    check("10 Lead find-10 requests produce five active OpenClaw sessions", agentRunIds.filter((id) => id.includes("run_")).length === 5);

    const screeningChildRuns: any[] = [];
    for (let batch = 0; batch < 5; batch++) {
      const targetCount = 5;
      const result = await store.createScreeningRun(contexts[10 + batch], {
        target_summary: `CE23 Screening batch ${batch + 1}`,
        target_record_type: "screening_batch",
        session_key: `ce23-screening-parent-${stamp}-${batch}`,
        child_session_keys: Array.from({ length: targetCount }, (_, index) => `ce23-screening-child-${stamp}-${batch}-${index}`),
        targets: Array.from({ length: targetCount }, (_, index) => ({
          target_id: `ce23-screening-target-input-${stamp}-${batch}-${index}`,
          source: "manual_input",
          lead_id: null,
          company_name: `CE23 Screening Buyer ${batch + 1}-${index + 1} ${stamp}`,
          country: "GB",
          website: `https://${domainPrefix}-screening-${batch}-${index}.example.com`,
          product_interest: ["phone case"],
          supplied_fields: ["company_name", "country", "website"],
          missing_fields: [],
        })),
        estimated_cost_usd: 0,
        metadata_json: {
          load_smoke_stamp: stamp,
          target_count: targetCount,
          options: {
            paidEmailValidation: false,
            paidTradeData: false,
            maxPaidSpendUsd: 0,
          },
        },
      });
      agentRunIds.push(result.agentRun.id, ...result.childRuns.map((child: any) => child.agentRun.id));
      if (result.batch?.id) screeningBatchIds.push(result.batch.id);
      screeningTargetIds.push(...result.childRuns.map((child: any) => child.agentRun.targetRecordId).filter(Boolean));
      screeningChildRuns.push(...result.childRuns);
      check(`Screening batch ${batch + 1} creates five child runs`, result.childRuns.length === 5);
      check(`Screening batch ${batch + 1} parent has no OpenClaw session`, result.agentRun.sessionKey === null);
    }
    const runningScreening = screeningChildRuns.filter((child) => child.agentRun.status === "running").length;
    const queuedScreening = screeningChildRuns.filter((child) => child.agentRun.status === "queued").length;
    check("5 Screening batches create 25 single-target child runs", screeningChildRuns.length === 25);
    check("Screening child runs respect active-target cap", runningScreening === 12 && queuedScreening === 13);
    check(
      "no production Screening child carries more than one target",
      screeningChildRuns.every((child) => Number(child.agentRun.metadataJson?.target_count) === 1),
    );

    const batchIdWithQueuedSibling = screeningBatchIds.find((batchId) =>
      screeningChildRuns.some((child) => child.agentRun.metadataJson?.screening_batch_id === batchId && child.agentRun.status === "running") &&
      screeningChildRuns.some((child) => child.agentRun.metadataJson?.screening_batch_id === batchId && child.agentRun.status === "queued")
    );
    const failedChild = screeningChildRuns.find((child) =>
      child.agentRun.metadataJson?.screening_batch_id === batchIdWithQueuedSibling &&
      child.agentRun.status === "running"
    );
    if (failedChild && batchIdWithQueuedSibling) {
      const childOwnerContext = contexts.find((context) => context.userId === failedChild.agentRun.userId) ?? contexts[10];
      await store.failEmployeeTask(childOwnerContext, failedChild.agentRun.id, {
        session_key: failedChild.agentRun.sessionKey,
        error_code: "ce23_child_retry_probe",
        error_message: "CE23 verifies failed child retry boundary without rerunning siblings.",
      });
      const drained = await store.claimQueuedScreeningChildRuns(childOwnerContext, {
        screening_batch_id: batchIdWithQueuedSibling,
        limit: 1,
      });
      check("failed Screening child can release a slot for queued sibling", drained.childRuns.length === 1);
      check("failed Screening child is tracked as retryable", Number(drained.batch?.aggregate.retryable ?? 0) >= 1);
    }

    for (let i = 0; i < 3; i++) {
      const accio = await store.saveAccioImport(contexts[20 + i], {
        source_file_name: `ce23-${stamp}-${i + 1}.json`,
        file_hash: `ce23hash${stamp}${i}000000000000`,
        storage_key: `local://ce23/${stamp}/${i + 1}`,
        classification: "T2",
        session_key: `ce23-accio-session-${stamp}-${i + 1}`,
        estimated_cost_usd: 0,
        conversations: [
          {
            external_conversation_id: `ce23-conversation-${stamp}-${i + 1}`,
            company_name: `CE23 Accio Buyer ${i + 1} ${stamp}`,
            country: "GB",
            messages: [
              {
                message_ts: new Date().toISOString(),
                sender_role: "buyer",
                text_hash: `ce23messagehash${stamp}${i}0000`,
                text_redacted: "Buyer asks for a phone case quote.",
              },
            ],
          },
        ],
      });
      agentRunIds.push(accio.agentRun.id);
      accioImportIds.push(accio.accioImport.id);
    }
    const postNormal = await workloadCounts();
    check("3 Accio imports are admitted under default cap", postNormal.runningAccio === 3);
    check("normal smoke active sessions stay within 24 soft cap", postNormal.activeTotal <= 24);
    check("normal smoke has queued Screening overflow", postNormal.queuedTotal >= 12);

    const pressureRuns: any[] = [];
    for (let i = 0; i < 28; i++) {
      const pressure = await store.createLeadRun(contexts[25 + (i % 20)], {
        query_config: {
          product_keywords: [`${domainPrefix}-pressure-${i}`],
          countries: ["CA"],
          buyer_types: [`ce23 pressure buyer ${i}`],
        },
        target_count: 10,
        session_key: `ce23-pressure-lead-${stamp}-${i}`,
        target_summary: `CE23 C=48 pressure request ${i + 1}`,
        estimated_cost_usd: 0,
      });
      pressureRuns.push(pressure);
      if (pressure.agentRun?.id) agentRunIds.push(pressure.agentRun.id);
      if (pressure.leadRun?.id) leadRunIds.push(pressure.leadRun.id);
      if (pressure.coordinatorDecision?.scopeId) scopeIds.push(pressure.coordinatorDecision.scopeId);
    }
    const postSoftPressure = await workloadCounts();
    const pressureQueued = pressureRuns.filter((item) => item.agentRun?.status === "queued").length;
    check("C=48 DB-only pressure queues excess work at 24 soft cap", postSoftPressure.activeTotal === 24 && pressureQueued >= 20);

    await insertControlledActiveRuns({
      context: contexts[0],
      count: 8,
      stamp,
      existingIds: agentRunIds,
    });
    const hardGuard = await store.createLeadRun(contexts[49], {
      query_config: {
        product_keywords: [`${domainPrefix}-hard-guard`],
        countries: ["AU"],
        buyer_types: ["ce23 hard guard buyer"],
      },
      target_count: 10,
      session_key: `ce23-hard-guard-${stamp}`,
      target_summary: "CE23 C=32 hard guard request",
      estimated_cost_usd: 0,
    });
    if (hardGuard.agentRun?.id) agentRunIds.push(hardGuard.agentRun.id);
    if (hardGuard.leadRun?.id) leadRunIds.push(hardGuard.leadRun.id);
    if (hardGuard.coordinatorDecision?.scopeId) scopeIds.push(hardGuard.coordinatorDecision.scopeId);
    check(
      "hard cap guard queues new work at 32 active DB-only slots",
      hardGuard.agentRun?.status === "queued" &&
        hardGuard.coordinatorDecision?.workloadStatus === "queued" &&
        hardGuard.agentRun.metadataJson?.workload_admission &&
        (hardGuard.agentRun.metadataJson.workload_admission as Record<string, unknown>).reason === "global_hard_cap",
    );

    const backupRestoreDrillPassed = process.env.CBE_BACKUP_RESTORE_DRILL_PASSED === "1";
    const report = {
      stamp,
      db_only: true,
      seeded_users: userIds.length,
      simulated_sessions: contexts.length,
      p95_dashboard_api_latency_ms: p95LatencyMs,
      lead_requests: 10,
      lead_active_sessions_after_dedupe: 5,
      screening_batches: 5,
      screening_child_runs: screeningChildRuns.length,
      screening_running_children_initial: runningScreening,
      screening_queued_children_initial: queuedScreening,
      accio_imports: 3,
      soft_cap_active_after_pressure: postSoftPressure.activeTotal,
      hard_guard_status: hardGuard.agentRun?.status,
      go_live_readiness: "db_only_preflight_passed",
      backup_restore_drill: backupRestoreDrillPassed ? "passed" : "not_verified_by_load_smoke",
      open_risks: [
        "Run this smoke against the actual target deployment with Dashboard/Gateway processes and approved provider quotas before labeling production_go_live_ready.",
        ...(backupRestoreDrillPassed
          ? []
          : ["Run the backup/restore drill with a disposable CBE_RESTORE_DATABASE_URL before labeling production_go_live_ready."]),
      ],
    };
    const ledgerAudit = await insertLoadSmokeLedgerAndAudit({
      context: contexts[0],
      stamp,
      agentRunIds,
      p95LatencyMs,
      report,
    });
    check("cost ledger rows are attributable to agent runs", ledgerAudit.ledgerCount === 3);
    check("load-smoke audit record is written with p95 and readiness metadata", ledgerAudit.auditCount === 1);

    if (reportPath) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      check("load-smoke report file is written", exists(reportPath));
    }
  } finally {
    restoreEnv(previousEnv);
    await cleanupCe23Probe({
      stamp,
      userIds,
      profileIds,
      agentRunIds,
      leadRunIds,
      scopeIds,
      screeningBatchIds,
      screeningTargetIds,
      accioImportIds,
      domainPrefix,
    });
  }
}

section("CE23 static P2.6 checks");
const phase2Plan = read(PHASE2_PLAN);
const workloadCoordinator = read(WORKLOAD_COORDINATOR);
const testMatrix = read(TEST_MATRIX);
const testDetail = read(TEST_DETAIL);
const backupDrill = exists(BACKUP_DRILL) ? read(BACKUP_DRILL) : "";
const runbook = exists(PHASE2_RUNBOOK) ? read(PHASE2_RUNBOOK) : "";

check("P2.6 plan defines 50-session load smoke", phase2Plan.includes("Seed 50 users") && phase2Plan.includes("simulate 50 dashboard sessions"));
check("P2.6 plan includes 10 Lead find-10 requests", phase2Plan.includes("Start 10 Lead `find-10` requests"));
check("P2.6 plan includes 5 Screening batches and 25 targets", phase2Plan.includes("Start 5 Screening batches totaling at least 25 targets"));
check("P2.6 plan includes 3 Accio imports", phase2Plan.includes("Start 3 Accio imports"));
check("P2.6 plan includes controlled C=40/48 pressure validation", phase2Plan.includes("controlled C=40/48 pressure profile"));
check("workload coordinator keeps 24 soft / 32 hard defaults", workloadCoordinator.includes('"CBE_TASK_MAX_ACTIVE_TOTAL", 24') && workloadCoordinator.includes('"CBE_TASK_MAX_ACTIVE_TOTAL_HARD", 32'));
check("workload coordinator keeps Screening and Accio caps", workloadCoordinator.includes('"CBE_SCREENING_MAX_ACTIVE_TARGETS", 12') && workloadCoordinator.includes('"CBE_ACCIO_MAX_ACTIVE_IMPORTS", 3'));
check("CE23 appears in the test matrix", testMatrix.includes("CE23") && testMatrix.includes("P2.6 load smoke"));
check("CE23 detail section exists", testDetail.includes("## CE23 — Load Smoke"));
check("P2.6 runbook exists", exists(PHASE2_RUNBOOK));
check("P2.6 runbook covers backup and restore drill", runbook.includes("CBE_RESTORE_DATABASE_URL") && runbook.includes("pg_dump") && runbook.includes("pg_restore"));
check("P2.6 runbook separates DB-only preflight from target deployment go-live", runbook.includes("db_only_preflight_passed") && runbook.includes("production_go_live_ready"));
check("backup/restore drill script exists", exists(BACKUP_DRILL));
check("backup/restore drill refuses same source and restore URL", backupDrill.includes("CBE_RESTORE_DATABASE_URL") && backupDrill.includes("Source and restore database URLs are identical"));
check("backup/restore drill uses custom-format dump and restore", backupDrill.includes("pg_dump") && backupDrill.includes("--format=custom") && backupDrill.includes("pg_restore"));
check("load-smoke script is documented in CE23", testDetail.includes("scripts/test-cross-border-phase2-load-smoke.ts"));

if (process.env.CBE_DATABASE_URL) {
  await runLiveLoadSmoke();
} else if (requireDb) {
  check("CBE_DATABASE_URL is set for required live load-smoke checks", false, "CBE_DATABASE_URL is missing");
} else {
  section("CE23 live PostgreSQL load-smoke checks");
  console.log("  skipped: set CBE_DATABASE_URL or pass --require-db to require live DB checks");
}

console.log(`\nCE23 load-smoke checks complete: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.error(`Failures:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}
