#!/usr/bin/env tsx
/**
 * CE21 checks for CBE Phase 2 P2.4 workload queue and Lead coordinator.
 *
 * Static checks always run. Live PostgreSQL checks run when CBE_DATABASE_URL is
 * set, or are required when --require-db is passed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCbePool } from "../sentura/lib/cross-border-store/db.js";
import { CBE_SEED_USERS, CBE_TENANT_ID } from "../sentura/lib/cross-border-store/ids.js";
import { migrateCbeDatabase } from "../sentura/lib/cross-border-store/migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "sentura/lib/cross-border-store/migrations");
const DASHBOARD_STORE_DIR = path.join(ROOT, "sentura/dashboard/src/lib/cross-border-store");
const EMPLOYEE_DIR = path.join(ROOT, "sentura/dashboard/src/app/client-demos/cross-border/employee");
const LEAD_AGENT_DIR = path.join(ROOT, "sentura/agents/cbe-lead-discovery");

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

async function cleanupCe21Probe(input: {
  agentRunIds: string[];
  leadRunIds: string[];
  scopeIds: string[];
  fakeActivePrefix: string;
  domainPrefix: string;
  screeningBatchIds?: string[];
  screeningTargetIds?: string[];
}) {
  const pool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce21-cleanup" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `
        delete from agent_run_activity_events
        where tenant_id = $1
          and (agent_run_id = any($2::text[]) or agent_run_id like $3)
      `,
      [CBE_TENANT_ID, input.agentRunIds, `${input.fakeActivePrefix}%`],
    );
    await client.query(
      `
        delete from audit_events
        where tenant_id = $1
          and (
            metadata_json->>'agent_run_id' = any($2::text[])
            or metadata_json->>'agent_run_id' like $3
          )
      `,
      [CBE_TENANT_ID, input.agentRunIds, `${input.fakeActivePrefix}%`],
    );
    if (input.screeningBatchIds?.length || input.screeningTargetIds?.length) {
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
        [
          CBE_TENANT_ID,
          input.screeningBatchIds ?? [],
          input.screeningTargetIds ?? [],
          input.agentRunIds,
        ],
      );
      await client.query(
        `
          delete from screening_batches
          where tenant_id = $1
            and id = any($2::text[])
        `,
        [CBE_TENANT_ID, input.screeningBatchIds ?? []],
      );
      await client.query(
        `
          delete from screening_targets
          where tenant_id = $1
            and id = any($2::text[])
        `,
        [CBE_TENANT_ID, input.screeningTargetIds ?? []],
      );
    }
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
          and normalized_domain like $2
      `,
      [CBE_TENANT_ID, `${input.domainPrefix}%`],
    );
    await client.query(
      `
        delete from lead_run_results
        where tenant_id = $1
          and lead_run_id = any($2::text[])
      `,
      [CBE_TENANT_ID, input.leadRunIds],
    );
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
    await client.query(
      `
        delete from lead_runs
        where tenant_id = $1
          and id = any($2::text[])
      `,
      [CBE_TENANT_ID, input.leadRunIds],
    );
    await client.query(
      `
        delete from lead_discovery_scopes
        where tenant_id = $1
          and id = any($2::text[])
      `,
      [CBE_TENANT_ID, input.scopeIds],
    );
    await client.query(
      `
        delete from agent_runs
        where tenant_id = $1
          and (id = any($2::text[]) or id like $3)
      `,
      [CBE_TENANT_ID, input.agentRunIds, `${input.fakeActivePrefix}%`],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function runLiveCe21Checks() {
  section("CE21 live PostgreSQL coordinator checks");
  await migrateCbeDatabase({ seed: true });
  const imported = await import("../sentura/dashboard/src/lib/cross-border-store/index.ts");
  const store = (imported.default ?? imported) as Record<string, any>;
  const requestA = new Request("http://sentura.local/api/client-demos/cross-border/employee/customers", {
    headers: { "x-cbe-user-id": CBE_SEED_USERS.operatorA.id },
  });
  const requestB = new Request("http://sentura.local/api/client-demos/cross-border/employee/customers", {
    headers: { "x-cbe-user-id": CBE_SEED_USERS.operatorB.id },
  });
  const contextA = await store.resolveCbeTenantContext(requestA);
  const contextB = await store.resolveCbeTenantContext(requestB);
  const stamp = Date.now().toString(36);
  const fakeActivePrefix = `ce21_fake_active_${stamp}`;
  const domainPrefix = `ce21-${stamp}`;
  const agentRunIds: string[] = [];
  const leadRunIds: string[] = [];
  const scopeIds: string[] = [];
  const screeningBatchIds: string[] = [];
  const screeningTargetIds: string[] = [];

  try {
    const capPool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce21-cap" });
    const capClient = await capPool.connect();
    try {
      await capClient.query("begin");
      for (let i = 0; i < 24; i++) {
        await capClient.query(
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
              target_summary
            )
            values ($1, $2, $3, $3, 'private', 'cbe-accio-memory', $4, 'running', 'accio_memory', 'CE21 active cap probe')
          `,
          [`${fakeActivePrefix}_${i}`, CBE_TENANT_ID, CBE_SEED_USERS.operatorA.id, `${fakeActivePrefix}_session_${i}`],
        );
      }
      await capClient.query("commit");
    } catch (error) {
      await capClient.query("rollback");
      throw error;
    } finally {
      capClient.release();
      await capPool.end();
    }

    const queued = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-queued-product`],
        countries: ["GB"],
        buyer_types: ["electronics retailer"],
        exclude_domains: [],
      },
      target_count: 10,
      session_key: `ce21-queued-session-${stamp}`,
      target_summary: "CE21 queued workload probe",
    });
    agentRunIds.push(queued.agentRun.id);
    leadRunIds.push(queued.leadRun.id);
    scopeIds.push(queued.coordinatorDecision.scopeId);
    check("global soft cap queues excess Lead work", queued.agentRun.status === "queued" && !queued.agentRun.sessionKey);
    check("queued Lead response preserves coordinator decision", queued.coordinatorDecision.workloadStatus === "queued");

    await cleanupCe21Probe({ agentRunIds, leadRunIds, scopeIds, fakeActivePrefix, domainPrefix });
    agentRunIds.length = 0;
    leadRunIds.length = 0;
    scopeIds.length = 0;

    const previousScreeningCap = process.env.CBE_SCREENING_MAX_ACTIVE_TARGETS;
    process.env.CBE_SCREENING_MAX_ACTIVE_TARGETS = "1";
    try {
      const fanout = await store.createScreeningRun(contextA, {
        target_summary: "CE22 Screening fan-out live probe",
        target_record_type: "screening_batch",
        session_key: `ce22-screening-parent-${stamp}`,
        child_session_keys: [1, 2, 3].map((item) => `ce22-screening-child-${stamp}-${item}`),
        targets: [1, 2, 3].map((item) => ({
          target_id: `ce22-screening-target-input-${stamp}-${item}`,
          source: "manual_input",
          lead_id: null,
          company_name: `CE22 Fanout Buyer ${item} ${stamp}`,
          country: "GB",
          website: `https://ce22-fanout-${item}-${stamp}.example.com`,
          product_interest: ["phone case"],
          supplied_fields: ["company_name", "country", "website"],
          missing_fields: [],
        })),
        estimated_cost_usd: 0,
        metadata_json: {
          target_count: 3,
          options: {
            paidEmailValidation: false,
            paidTradeData: false,
            maxPaidSpendUsd: 0,
          },
        },
      });
      agentRunIds.push(fanout.agentRun.id, ...fanout.childRuns.map((child: any) => child.agentRun.id));
      if (fanout.batch?.id) screeningBatchIds.push(fanout.batch.id);
      screeningTargetIds.push(...fanout.childRuns.map((child: any) => child.target.target_id).filter(Boolean));
      check("Screening batch creates one parent run", fanout.agentRun.parentAgentRunId === null && fanout.agentRun.sessionKey === null);
      check("Screening batch creates one child run per target", fanout.childRuns.length === 3);
      check(
        "Screening cap queues excess child runs",
        fanout.childRuns.filter((child: any) => child.agentRun.status === "running").length === 1 &&
          fanout.childRuns.filter((child: any) => child.agentRun.status === "queued").length === 2,
      );

      const firstRunningChild = fanout.childRuns.find((child: any) => child.agentRun.status === "running");
      if (firstRunningChild) {
        await store.failEmployeeTask(contextA, firstRunningChild.agentRun.id, {
          session_key: firstRunningChild.agentRun.sessionKey,
          error_code: "marker_timeout",
          error_message: "CE22 fan-out claim probe releases one active slot.",
        });
      }
      const parentAggregatePool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce21-screening-parent" });
      const parentAggregateClient = await parentAggregatePool.connect();
      try {
        const parentAfterFirstTerminal = await parentAggregateClient.query<{
          status: string;
          current_stage: string | null;
          metadata_json: Record<string, any>;
        }>(
          `
            select status, current_stage, metadata_json
            from agent_runs
            where tenant_id = $1
              and id = $2
            limit 1
          `,
          [CBE_TENANT_ID, fanout.agentRun.id],
        );
        const parentMetadata = parentAfterFirstTerminal.rows[0]?.metadata_json ?? {};
        const parentAggregate = (parentMetadata.screening_batch as { aggregate?: Record<string, unknown> } | undefined)?.aggregate ?? {};
        check(
          "Screening parent stays running after one child terminal state",
          parentAfterFirstTerminal.rows[0]?.status === "running" &&
            parentAfterFirstTerminal.rows[0]?.current_stage === "screening_children_running" &&
            Number(parentAggregate.total) === 3 &&
            Number(parentAggregate.terminal) === 1,
        );
      } finally {
        parentAggregateClient.release();
        await parentAggregatePool.end();
      }
      const drained = await store.claimQueuedScreeningChildRuns(contextA, {
        screening_batch_id: fanout.batch?.id,
        limit: 3,
      });
      check("Screening drain claims one queued child after a slot opens", drained.childRuns.length === 1 && drained.childRuns[0].agentRun.status === "running");
      check(
        "Screening batch aggregate tracks failed, running, and queued children",
        drained.batch?.aggregate.failed === 1 &&
          drained.batch.aggregate.running === 1 &&
          drained.batch.aggregate.queued === 1,
      );
    } finally {
      if (previousScreeningCap === undefined) delete process.env.CBE_SCREENING_MAX_ACTIVE_TARGETS;
      else process.env.CBE_SCREENING_MAX_ACTIVE_TARGETS = previousScreeningCap;
    }

    const exactA = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-exact-product`],
        countries: ["GB"],
        buyer_types: ["phone repair chain"],
        exclude_domains: [],
      },
      target_count: 10,
      session_key: `ce21-exact-a-${stamp}`,
      target_summary: "CE21 exact A",
    });
    agentRunIds.push(exactA.agentRun.id);
    leadRunIds.push(exactA.leadRun.id);
    scopeIds.push(exactA.coordinatorDecision.scopeId);
    const exactB = await store.createLeadRun(contextB, {
      query_config: {
        product_keywords: [`${domainPrefix}-exact-product`],
        countries: ["GB"],
        buyer_types: ["phone repair chain"],
        exclude_domains: [],
      },
      target_count: 10,
      session_key: `ce21-exact-b-${stamp}`,
      target_summary: "CE21 exact B",
    });
    leadRunIds.push(exactB.leadRun.id);
    check("exact duplicate joins existing Lead run", exactB.coordinatorDecision.action === "join_existing");
    check("exact duplicate does not create second agent_run", !exactB.agentRun);

    const exactPool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce21-exact-count" });
    const exactClient = await exactPool.connect();
    try {
      const membership = await exactClient.query<{ count: string }>(
        "select count(*)::text as count from lead_run_memberships where tenant_id = $1 and scope_id = $2",
        [CBE_TENANT_ID, exactA.coordinatorDecision.scopeId],
      );
      check("exact duplicate creates two memberships", Number(membership.rows[0].count) === 2);
    } finally {
      exactClient.release();
      await exactPool.end();
    }

    const nearA = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-near-product`],
        countries: ["US"],
        buyer_types: ["electronics retailer"],
        exclude_domains: ["amazon.com"],
      },
      target_count: 10,
      session_key: `ce21-near-a-${stamp}`,
      target_summary: "CE21 near A",
    });
    agentRunIds.push(nearA.agentRun.id);
    leadRunIds.push(nearA.leadRun.id);
    scopeIds.push(nearA.coordinatorDecision.scopeId);
    const nearB = await store.createLeadRun(contextB, {
      query_config: {
        product_keywords: [`${domainPrefix}-near-product`],
        countries: ["US"],
        buyer_types: ["electronics retailer"],
        exclude_domains: ["amazon.com", "alibaba.com"],
      },
      target_count: 10,
      session_key: `ce21-near-b-${stamp}`,
      target_summary: "CE21 near B",
    });
    check("near duplicate offers choices instead of starting a run", nearB.coordinatorDecision.action === "offer_near_duplicate_choices" && !nearB.agentRun);

    const completedA = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-completed-product`],
        countries: ["DE"],
        buyer_types: ["accessory importer"],
        exclude_domains: [],
      },
      target_count: 2,
      session_key: `ce21-completed-a-${stamp}`,
      target_summary: "CE21 completed A",
    });
    agentRunIds.push(completedA.agentRun.id);
    leadRunIds.push(completedA.leadRun.id);
    scopeIds.push(completedA.coordinatorDecision.scopeId);
    const fetchedAt = new Date().toISOString();
    await store.saveLeadRunResult(contextA, completedA.leadRun.id, {
      agent_run_id: completedA.agentRun.id,
      session_key: `ce21-completed-a-${stamp}`,
      payload: {
        run_id: `ce21-completed-${stamp}`,
        leads: [1, 2].map((item) => ({
          company_name: `CE21 Completed Buyer ${item} ${stamp}`,
          website: `https://${domainPrefix}-completed-${item}.example.com`,
          domain: `${domainPrefix}-completed-${item}.example.com`,
          country: "DE",
          buyer_type: "accessory importer",
          matched_products: [`${domainPrefix}-completed-product`],
          source_urls: [`https://${domainPrefix}-completed-${item}.example.com/about`],
          discovery_evidence: [{
            source_url: `https://${domainPrefix}-completed-${item}.example.com/about`,
            finding: "CE21 completed public evidence.",
            fetched_at: fetchedAt,
            source_type: "public_web",
          }],
          dedupe_key: `domain:${domainPrefix}-completed-${item}.example.com`,
          duplicate_status: "new",
          confidence: 0.9,
        })),
      },
    });
    const noReuse = await store.createLeadRun(contextB, {
      query_config: {
        product_keywords: [`${domainPrefix}-completed-product`],
        countries: ["DE"],
        buyer_types: ["accessory importer"],
        exclude_domains: [],
      },
      target_count: 2,
      session_key: `ce21-completed-b-${stamp}`,
      target_summary: "CE21 completed B",
    });
    agentRunIds.push(noReuse.agentRun.id);
    leadRunIds.push(noReuse.leadRun.id);
    check("completed same-scope pool is not reused", noReuse.coordinatorDecision.action === "start_new_run");
    check("completed same-scope run asks current operator for full target", noReuse.leadRun.targetCount === 2);
    check("completed same-scope run carries prior identities", [
      `domain:${domainPrefix}-completed-1.example.com`,
      `domain:${domainPrefix}-completed-2.example.com`,
    ].every((identity) => noReuse.coordinatorDecision.denylist?.includes(identity)));
    const preSearchDenylist = await store.createLeadRun(contextB, {
      query_config: {
        product_keywords: [`${domainPrefix}-presearch-product`],
        countries: ["JP"],
        buyer_types: ["electronics retailer"],
        exclude_domains: [],
      },
      target_count: 2,
      session_key: `ce21-presearch-denylist-${stamp}`,
      target_summary: "CE21 pre-search denylist",
    });
    agentRunIds.push(preSearchDenylist.agentRun.id);
    leadRunIds.push(preSearchDenylist.leadRun.id);
    scopeIds.push(preSearchDenylist.coordinatorDecision.scopeId);
    check("new Lead run carries tenant DB pre-search denylist", [
      `domain:${domainPrefix}-completed-1.example.com`,
      `domain:${domainPrefix}-completed-2.example.com`,
    ].every((identity) => preSearchDenylist.coordinatorDecision.denylist?.includes(identity)));
    const duplicateCompletion = await store.saveLeadRunResult(contextB, noReuse.leadRun.id, {
      agent_run_id: noReuse.agentRun.id,
      session_key: `ce21-completed-b-${stamp}`,
      payload: {
        run_id: `ce21-completed-b-${stamp}`,
        leads: [
          {
            company_name: `CE21 Completed Buyer 1 ${stamp}`,
            website: `https://${domainPrefix}-completed-1.example.com`,
            domain: `${domainPrefix}-completed-1.example.com`,
            country: "DE",
            buyer_type: "accessory importer",
            matched_products: [`${domainPrefix}-completed-product`],
            source_urls: [`https://${domainPrefix}-completed-1.example.com/about`],
            discovery_evidence: [{
              source_url: `https://${domainPrefix}-completed-1.example.com/about`,
              finding: "CE21 duplicate public evidence.",
              fetched_at: fetchedAt,
              source_type: "public_web",
            }],
            dedupe_key: `domain:${domainPrefix}-completed-1.example.com`,
            duplicate_status: "new",
            confidence: 0.9,
          },
          {
            company_name: `CE21 Completed Buyer 3 ${stamp}`,
            website: `https://${domainPrefix}-completed-3.example.com`,
            domain: `${domainPrefix}-completed-3.example.com`,
            country: "DE",
            buyer_type: "accessory importer",
            matched_products: [`${domainPrefix}-completed-product`],
            source_urls: [`https://${domainPrefix}-completed-3.example.com/about`],
            discovery_evidence: [{
              source_url: `https://${domainPrefix}-completed-3.example.com/about`,
              finding: "CE21 new public evidence.",
              fetched_at: fetchedAt,
              source_type: "public_web",
            }],
            dedupe_key: `domain:${domainPrefix}-completed-3.example.com`,
            duplicate_status: "new",
            confidence: 0.9,
          },
        ],
      },
    });
    check("completion skips DB duplicate before writing current list", duplicateCompletion.candidates.length === 1);
    check("completion reports duplicate and missing top-up count", duplicateCompletion.reconciliation.duplicateCount === 1 && duplicateCompletion.reconciliation.missingCount === 1);

    const topUp = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-topup-product`],
        countries: ["FR"],
        buyer_types: ["electronics retailer"],
        exclude_domains: [],
      },
      target_count: 3,
      session_key: `ce21-topup-a-${stamp}`,
      target_summary: "CE21 top-up A",
    });
    agentRunIds.push(topUp.agentRun.id);
    leadRunIds.push(topUp.leadRun.id);
    scopeIds.push(topUp.coordinatorDecision.scopeId);
    await store.saveLeadRunResult(contextA, topUp.leadRun.id, {
      agent_run_id: topUp.agentRun.id,
      session_key: `ce21-topup-a-${stamp}`,
      payload: {
        run_id: `ce21-topup-${stamp}`,
        leads: [{
          company_name: `CE21 Topup Buyer ${stamp}`,
          website: `https://${domainPrefix}-topup-1.example.com`,
          domain: `${domainPrefix}-topup-1.example.com`,
          country: "FR",
          buyer_type: "electronics retailer",
          matched_products: [`${domainPrefix}-topup-product`],
          source_urls: [`https://${domainPrefix}-topup-1.example.com/about`],
          discovery_evidence: [{
            source_url: `https://${domainPrefix}-topup-1.example.com/about`,
            finding: "CE21 top-up public evidence.",
            fetched_at: fetchedAt,
            source_type: "public_web",
          }],
          dedupe_key: `domain:${domainPrefix}-topup-1.example.com`,
          duplicate_status: "new",
          confidence: 0.9,
        }],
        shortage_reason: "CE21 intentionally short result.",
      },
    });
    const topUpRetry = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-topup-product`],
        countries: ["FR"],
        buyer_types: ["electronics retailer"],
        exclude_domains: [],
      },
      target_count: 3,
      session_key: `ce21-topup-b-${stamp}`,
      target_summary: "CE21 top-up B",
    });
    agentRunIds.push(topUpRetry.agentRun.id);
    leadRunIds.push(topUpRetry.leadRun.id);
    check("ordinary repeated completed scope creates a fresh new-customer run", topUpRetry.coordinatorDecision.action === "start_new_run");
    check("ordinary repeated completed scope carries existing identity denylist", topUpRetry.coordinatorDecision.denylist?.includes(`domain:${domainPrefix}-topup-1.example.com`) === true);
    check("ordinary repeated completed scope asks for the full requested new count", topUpRetry.leadRun.targetCount === 3);

    const explicitTopUpSeed = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-explicit-topup-product`],
        countries: ["IT"],
        buyer_types: ["electronics retailer"],
        exclude_domains: [],
      },
      target_count: 3,
      session_key: `ce21-explicit-topup-a-${stamp}`,
      target_summary: "CE21 explicit top-up A",
    });
    agentRunIds.push(explicitTopUpSeed.agentRun.id);
    leadRunIds.push(explicitTopUpSeed.leadRun.id);
    scopeIds.push(explicitTopUpSeed.coordinatorDecision.scopeId);
    await store.saveLeadRunResult(contextA, explicitTopUpSeed.leadRun.id, {
      agent_run_id: explicitTopUpSeed.agentRun.id,
      session_key: `ce21-explicit-topup-a-${stamp}`,
      payload: {
        run_id: `ce21-explicit-topup-${stamp}`,
        leads: [{
          company_name: `CE21 Explicit Topup Buyer ${stamp}`,
          website: `https://${domainPrefix}-explicit-topup-1.example.com`,
          domain: `${domainPrefix}-explicit-topup-1.example.com`,
          country: "IT",
          buyer_type: "electronics retailer",
          matched_products: [`${domainPrefix}-explicit-topup-product`],
          source_urls: [`https://${domainPrefix}-explicit-topup-1.example.com/about`],
          discovery_evidence: [{
            source_url: `https://${domainPrefix}-explicit-topup-1.example.com/about`,
            finding: "CE21 explicit top-up public evidence.",
            fetched_at: fetchedAt,
            source_type: "public_web",
          }],
          dedupe_key: `domain:${domainPrefix}-explicit-topup-1.example.com`,
          duplicate_status: "new",
          confidence: 0.9,
        }],
        shortage_reason: "CE21 intentionally short explicit top-up seed.",
      },
    });
    const explicitTopUpRetry = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-explicit-topup-product`],
        countries: ["IT"],
        buyer_types: ["electronics retailer"],
        exclude_domains: [],
      },
      target_count: 2,
      run_mode: "top_up_unique_leads",
      session_key: `ce21-explicit-topup-b-${stamp}`,
      target_summary: "CE21 explicit top-up B",
    });
    agentRunIds.push(explicitTopUpRetry.agentRun.id);
    leadRunIds.push(explicitTopUpRetry.leadRun.id);
    check("explicit top-up request creates top-up run", explicitTopUpRetry.coordinatorDecision.action === "queue_top_up");
    check("explicit top-up request is not double-discounted by existing owner rows", explicitTopUpRetry.leadRun.targetCount === 2);

    const failProbe = await store.createLeadRun(contextA, {
      query_config: {
        product_keywords: [`${domainPrefix}-fail-product`],
        countries: ["ES"],
        buyer_types: ["electronics retailer"],
        exclude_domains: [],
      },
      target_count: 2,
      session_key: `ce21-fail-probe-${stamp}`,
      target_summary: "CE21 failure cascade",
    });
    agentRunIds.push(failProbe.agentRun.id);
    leadRunIds.push(failProbe.leadRun.id);
    scopeIds.push(failProbe.coordinatorDecision.scopeId);
    await store.failEmployeeTask(contextA, failProbe.agentRun.id, {
      session_key: `ce21-fail-probe-${stamp}`,
      error_code: "timeout",
      error_message: "CE21 failure cascade probe.",
    });
    const failPool = createCbePool({ max: 2, applicationName: "sentura-cbe-ce21-failure-cascade" });
    const failClient = await failPool.connect();
    try {
      const failedState = await failClient.query<{ lead_status: string; scope_status: string; active_agent_run_id: string | null }>(
        `
          select lr.status as lead_status, lds.status as scope_status, lds.active_agent_run_id
          from lead_runs lr
          join lead_run_memberships lrm on lrm.tenant_id = lr.tenant_id and lrm.lead_run_id = lr.id
          join lead_discovery_scopes lds on lds.tenant_id = lrm.tenant_id and lds.id = lrm.scope_id
          where lr.tenant_id = $1
            and lr.id = $2
          limit 1
        `,
        [CBE_TENANT_ID, failProbe.leadRun.id],
      );
      check(
        "Lead task failure cascades to lead_run and releases active scope",
        failedState.rows[0]?.lead_status === "failed" &&
          failedState.rows[0]?.scope_status === "failed" &&
          failedState.rows[0]?.active_agent_run_id === null,
      );
    } finally {
      failClient.release();
      await failPool.end();
    }
  } finally {
    await cleanupCe21Probe({
      agentRunIds,
      leadRunIds,
      scopeIds,
      fakeActivePrefix,
      domainPrefix,
      screeningBatchIds,
      screeningTargetIds,
    });
    await store.getCbePool().end();
  }
}

section("CE21 static migration and store structure");
const migration005 = path.join(MIGRATIONS_DIR, "005_workload_queue_and_screening_batches.sql");
const workloadTs = path.join(DASHBOARD_STORE_DIR, "workload-coordinator.ts");
const agentRunsTs = path.join(DASHBOARD_STORE_DIR, "agent-runs.ts");
const leadRunsTs = path.join(DASHBOARD_STORE_DIR, "lead-runs.ts");
const screeningTs = path.join(DASHBOARD_STORE_DIR, "screening.ts");
const accioTs = path.join(DASHBOARD_STORE_DIR, "accio.ts");
const employeeApiTs = path.join(EMPLOYEE_DIR, "_data/employee-api.ts");
const employeeRunnerTs = path.join(EMPLOYEE_DIR, "_data/employee-task-runner.ts");
const customersPageTs = path.join(EMPLOYEE_DIR, "customers/page.tsx");
const memoryPageTs = path.join(EMPLOYEE_DIR, "memory/page.tsx");
const leadAgentsMd = path.join(LEAD_AGENT_DIR, "AGENTS.md");
const leadQuerySkill = path.join(LEAD_AGENT_DIR, "skills/lead-query-generation/SKILL.md");
const leadDedupeSkill = path.join(LEAD_AGENT_DIR, "skills/lead-deduplication/SKILL.md");
const leadListSkill = path.join(LEAD_AGENT_DIR, "skills/lead-list-production/SKILL.md");

check("005 workload queue migration exists", exists(migration005));
const migration005Text = exists(migration005) ? read(migration005) : "";
check("migration adds agent_runs queue and lease columns", ["parent_agent_run_id", "queue_priority", "queued_at", "lease_owner", "lease_until"].every((needle) => migration005Text.includes(needle)));
check("migration adds queue claim and active-session indexes", migration005Text.includes("agent_runs_queue_claim_idx") && migration005Text.includes("agent_runs_active_session_idx"));
check("migration prepares Screening fan-out tables", migration005Text.includes("screening_batches") && migration005Text.includes("screening_batch_targets") && migration005Text.includes("single_target_fanout"));

const workloadText = read(workloadTs);
check("workload coordinator reads P2.4 caps from environment defaults", ["CBE_TASK_MAX_ACTIVE_TOTAL", "24", "CBE_TASK_MAX_ACTIVE_TOTAL_HARD", "32", "CBE_LEAD_MAX_ACTIVE_RUNS", "CBE_QUEUE_LEASE_SECONDS"].every((needle) => workloadText.includes(needle)));
check("workload coordinator serializes tenant admission", workloadText.includes("pg_advisory_xact_lock") && workloadText.includes("cbe-workload"));
check("workload coordinator counts only active OpenClaw sessions", workloadText.includes("session_key is not null") && workloadText.includes("status in ('running', 'polling')"));
check("workload coordinator blocks production multi-target Screening sessions", workloadText.includes("screening_fanout_required") && workloadText.includes("CBE_SCREENING_ALLOW_BATCH3"));

const agentRunsText = read(agentRunsTs);
check("agent run insert persists queue metadata", ["queue_priority", "queued_at", "lease_owner", "lease_until"].every((needle) => agentRunsText.includes(needle)));

const leadRunsText = read(leadRunsTs);
check("Lead coordinator computes canonical scope hash", leadRunsText.includes("leadScopeFingerprint") && leadRunsText.includes("sha256:") && leadRunsText.includes("canonicalScopeJson"));
check("Lead coordinator implements exact join, near duplicate, and top-up decisions without completed-pool reuse", ["join_existing", "offer_near_duplicate_choices", "queue_top_up"].every((needle) => leadRunsText.includes(needle)) && !leadRunsText.includes("action: \"reuse_completed_pool\""));
check("Lead coordinator writes memberships and top-up denylist", leadRunsText.includes("lead_run_memberships") && leadRunsText.includes("existing_identity_keys") && leadRunsText.includes("identityKeysForScope"));
check("Lead completion records DB reconciliation and releases scope lease", ["items_produced", "duplicate_leads", "missing_count", "database_reconciliation", "active_agent_run_id = null"].every((needle) => leadRunsText.includes(needle)));

check("Screening and Accio create paths use workload admission", [screeningTs, accioTs].every((file) => read(file).includes("admitCbeWorkload") && read(file).includes("workloadMetadata")));
const screeningCreateBody = read(screeningTs).slice(read(screeningTs).indexOf("export async function createScreeningRun"));
check(
  "Screening create path implements parent/child fan-out and queued child drain",
  [
    "createScreeningBatchRun",
    "screening_batches",
    "screening_batch_targets",
    "child_session_keys",
    "claimQueuedScreeningChildRuns",
    "for update skip locked",
    "assertScreeningSessionShape",
  ].every((needle) => read(screeningTs).includes(needle)) && screeningCreateBody.includes("shouldFanOut"),
);
check(
  "Screening aggregate refresh resolves child id before counting all batch targets",
  ["with selected_batch as", "exists (", "child_sbt.child_agent_run_id", "sbt.screening_batch_id = selected_batch.id"].every((needle) =>
    read(screeningTs).includes(needle),
  ),
);

const employeeApiText = read(employeeApiTs);
const employeeRunnerText = read(employeeRunnerTs);
const customersPageText = read(customersPageTs);
const memoryPageText = read(memoryPageTs);
check("Employee API exposes Lead coordinator decision shape", employeeApiText.includes("ApiLeadCoordinatorDecision") && employeeApiText.includes("CreateEmployeeLeadRunResponse"));
check("Lead hidden prompt supports strict target and top-up denylist", ["top_up_unique_leads", "existing_identity_keys", "already_covered_queries", "target_count 是本次任务必须新增的净新客户硬目标", "web_fetch 被安全策略拦截"].every((needle) => employeeRunnerText.includes(needle)));
check("Employee Lead page does not launch sessions for join/near/queued decisions and supports auto top-up", ["join_existing", "offer_near_duplicate_choices", "agentRun.status === \"queued\"", "MAX_LEAD_COMPLETION_ATTEMPTS", "top_up_unique_leads"].every((needle) => customersPageText.includes(needle) || employeeApiText.includes(needle)) && !customersPageText.includes("reuse_completed_pool"));
check("Employee Screening fan-out page launches only claimed child sessions and Accio page does not launch queued sessions", ["childRuns", "claimEmployeeQueuedScreeningRuns", "agentRun.status !== \"queued\"", "背调任务已进入排队"].every((needle) => customersPageText.includes(needle)) && memoryPageText.includes("记忆整理已进入排队"));
check("Employee Screening completion count uses saved DB reports", employeeApiText.includes("CompleteEmployeeScreeningRunResponse") && customersPageText.includes("savedResult.reports") && customersPageText.includes("Math.max(savedReportCount, result.records.length)"));
check("Lead workspace documents pre-search denylist, strict target, and top-up mode", read(leadAgentsMd).includes("net-new, non-duplicate customers") && read(leadQuerySkill).includes("max_results_per_query") && read(leadDedupeSkill).includes("Do not count dropped denylist candidates") && read(leadListSkill).includes("The `leads` array should contain exactly `target_count`"));

if (process.env.CBE_DATABASE_URL) {
  await runLiveCe21Checks();
} else {
  section("CE21 live PostgreSQL coordinator checks");
  check("CBE_DATABASE_URL available for required live check", !requireDb, "set CBE_DATABASE_URL to run live coordinator checks");
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`Failures:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
}
