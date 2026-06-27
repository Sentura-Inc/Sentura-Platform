import type { CbeDb } from "./db";
import { queryCbe, withCbeTransaction } from "./db";
import { CbeStoreError } from "./errors";
import { createCbeId } from "./ids";
import { hashCbePassword } from "./session";
import { getServerGatewayClient } from "../gateway/server-client";
import type { CostEvent } from "../gateway/types";
import type {
  AdminCostApprovalDecisionRequest,
  AdminCostAllowancePatchRequest,
  AdminCostLimitPatchRequest,
  AdminCreateOperatorRequest,
  AdminUpdateOperatorRequest,
  CbeAgentId,
  CbeCostPeriod,
  CbeTaskKind,
  ListQuery,
  TenantContext,
} from "./schemas";
import { listEmployeeCustomers } from "./customers";
import { listEmployeeMemoryRecords } from "./accio";

const COST_EPSILON_USD = 0.005;
// Manager and employee cost screens currently expose monthly controls only.
const ENFORCED_EMPLOYEE_COST_LIMIT_PERIODS: CbeCostPeriod[] = ["month"];
const MAX_CBE_OPERATOR_ACCOUNTS = 20;

type AdminOperatorProfileInput = AdminCreateOperatorRequest & {
  user_id: string;
  email?: string;
  platform_role?: string;
};

export async function getAdminOverview(context: TenantContext) {
  const result = await queryCbe<{
    lead_count: string;
    screening_count: string;
    accio_import_count: string;
    active_task_count: string;
    failed_task_count: string;
    cost_usd_estimate: string | null;
  }>(
    `
      select
        (select count(*)::text from lead_candidates where tenant_id = $1) as lead_count,
        (select count(*)::text from screening_reports where tenant_id = $1) as screening_count,
        (select count(*)::text from accio_imports where tenant_id = $1) as accio_import_count,
        (select count(*)::text from agent_runs where tenant_id = $1 and status in ('queued', 'running', 'polling')) as active_task_count,
        (select count(*)::text from agent_runs where tenant_id = $1 and status = 'failed') as failed_task_count,
        (select sum(coalesce(cost_usd, 0))::text from api_call_ledger where tenant_id = $1) as cost_usd_estimate
    `,
    [context.tenantId],
  );
  const row = result.rows[0];
  return {
    leadCount: Number(row.lead_count),
    screeningCount: Number(row.screening_count),
    accioImportCount: Number(row.accio_import_count),
    activeTaskCount: Number(row.active_task_count),
    failedTaskCount: Number(row.failed_task_count),
    costUsdEstimate: moneyUsd(row.cost_usd_estimate ?? 0),
  };
}

export async function listAdminLiveTasks(context: TenantContext, query: ListQuery) {
  const result = await queryCbe(
    `
      select
        ev.id,
        ev.agent_run_id,
        ev.operator_user_id,
        prof.display_name as operator_name,
        ev.agent_id,
        ev.task_kind,
        ev.target_record_type,
        ev.target_record_id,
        ev.target_summary,
        ev.stage,
        ev.event_type,
        ev.tool_name,
        ev.source_url,
        ev.status,
        ev.created_at
      from agent_run_activity_events ev
      left join cbe_user_profiles prof
        on prof.tenant_id = ev.tenant_id
       and prof.user_id = ev.operator_user_id
      where ev.tenant_id = $1
      order by ev.created_at desc, ev.id desc
      limit $2
      offset $3
    `,
    [context.tenantId, query.limit, query.offset],
  );
  return { items: result.rows, limit: query.limit, offset: query.offset };
}

export async function listAdminCustomers(context: TenantContext, query: ListQuery) {
  return listEmployeeCustomers(context, query);
}

export async function listAdminOperators(context: TenantContext) {
  const result = await queryCbe(
    `
      select
        p.user_id,
        p.email,
        p.display_name,
        p.team_name,
        p.status,
        coalesce(lc.today_count, 0)::text as today_lead_count,
        coalesce(lc.week_count, 0)::text as week_lead_count,
        coalesce(lc.month_count, 0)::text as month_lead_count,
        coalesce(lc.all_count, 0)::text as all_lead_count,
        coalesce(sr.today_count, 0)::text as today_screening_count,
        coalesce(sr.week_count, 0)::text as week_screening_count,
        coalesce(sr.month_count, 0)::text as month_screening_count,
        coalesce(sr.all_count, 0)::text as all_screening_count,
        coalesce(mem.conversation_count, 0)::text as all_chat_record_count,
        coalesce(mem.analyzed_customer_count, 0)::text as all_chat_customer_count,
        coalesce(costs.today_spend_usd, 0)::text as today_cost_usd,
        coalesce(costs.week_spend_usd, 0)::text as week_cost_usd,
        coalesce(costs.month_spend_usd, 0)::text as month_cost_usd,
        coalesce(costs.all_spend_usd, 0)::text as all_cost_usd,
        coalesce(month_limit.limit_usd, 0)::text as month_limit_usd,
        coalesce(month_allowance.allowance_usd, 0)::text as month_allowance_usd,
        coalesce(pending.pending_count, 0)::text as pending_approval_count
      from cbe_user_profiles p
      left join lateral (
        select
          count(*) filter (where created_at >= date_trunc('day', now())) as today_count,
          count(*) filter (where created_at >= date_trunc('week', now())) as week_count,
          count(*) filter (where created_at >= date_trunc('month', now())) as month_count,
          count(*) as all_count
        from lead_candidates lc
        where lc.tenant_id = p.tenant_id
          and lc.owner_user_id = p.user_id
      ) lc on true
      left join lateral (
        select
          count(*) filter (where created_at >= date_trunc('day', now())) as today_count,
          count(*) filter (where created_at >= date_trunc('week', now())) as week_count,
          count(*) filter (where created_at >= date_trunc('month', now())) as month_count,
          count(*) as all_count
        from screening_reports sr
        where sr.tenant_id = p.tenant_id
          and sr.owner_user_id = p.user_id
      ) sr on true
      left join lateral (
        select
          count(distinct ac.id) as conversation_count,
          count(distinct asum.id) as analyzed_customer_count
        from accio_imports ai
        left join accio_conversations ac
          on ac.tenant_id = ai.tenant_id
         and ac.accio_import_id = ai.id
        left join accio_summaries asum
          on asum.tenant_id = ai.tenant_id
         and asum.accio_conversation_id = ac.id
        where ai.tenant_id = p.tenant_id
          and ai.owner_user_id = p.user_id
      ) mem on true
      left join lateral (
        select
          sum(spend_usd) filter (where started_at >= date_trunc('day', now())) as today_spend_usd,
          sum(spend_usd) filter (where started_at >= date_trunc('week', now())) as week_spend_usd,
          sum(spend_usd) filter (where started_at >= date_trunc('month', now())) as month_spend_usd,
          sum(spend_usd) as all_spend_usd
        from (
          select
            ar.started_at,
            case
              when coalesce(ledger.actual_cost_usd, 0) > 0 then ledger.actual_cost_usd
              else coalesce(ar.cost_usd_estimate, 0)
            end as spend_usd
          from agent_runs ar
          left join lateral (
            select sum(cost_usd) filter (where cost_usd is not null) as actual_cost_usd
            from api_call_ledger l
            where l.tenant_id = ar.tenant_id
              and l.agent_run_id = ar.id
          ) ledger on true
          where ar.tenant_id = p.tenant_id
            and ar.owner_user_id = p.user_id
        ) owned_costs
      ) costs on true
      left join cbe_cost_limits month_limit
        on month_limit.tenant_id = p.tenant_id
       and month_limit.user_id = p.user_id
       and month_limit.period = 'month'
      left join lateral (
        select sum(amount_usd) as allowance_usd
        from cbe_cost_allowances a
        where a.tenant_id = p.tenant_id
          and a.user_id = p.user_id
          and a.period = 'month'
          and a.status = 'active'
          and (a.expires_at is null or a.expires_at > now())
      ) month_allowance on true
      left join lateral (
        select count(*) as pending_count
        from cbe_cost_approval_requests req
        where req.tenant_id = p.tenant_id
          and req.user_id = p.user_id
          and req.status = 'pending'
      ) pending on true
      where p.tenant_id = $1
        and p.cbe_role = 'operator'
        and p.status <> 'inactive'
      order by p.status, p.display_name
    `,
    [context.tenantId],
  );
  const items = (await applySenturaCostToOperatorRows(context, result.rows)).map((row) => ({
    ...row,
    today_cost_usd: moneyUsd(row.today_cost_usd as string | number | null | undefined),
    week_cost_usd: moneyUsd(row.week_cost_usd as string | number | null | undefined),
    month_cost_usd: moneyUsd(row.month_cost_usd as string | number | null | undefined),
    all_cost_usd: moneyUsd(row.all_cost_usd as string | number | null | undefined),
    month_limit_usd: moneyUsd(row.month_limit_usd as string | number | null | undefined),
    month_allowance_usd: moneyUsd(row.month_allowance_usd as string | number | null | undefined),
  }));
  return { items };
}

export async function getAdminOperator(context: TenantContext, operatorId: string) {
  const profile = await queryCbe(
    `
      select user_id, display_name, email, team_name, status
      from cbe_user_profiles
      where tenant_id = $1
        and user_id = $2
        and cbe_role = 'operator'
        and status <> 'inactive'
      limit 1
    `,
    [context.tenantId, operatorId],
  );
  const workload = await queryCbe(
    `
      select work_date, task_kind, run_count, completed_count, failed_count, cost_usd_estimate::text as cost_usd_estimate
      from cbe_operator_workload_daily
      where tenant_id = $1
        and owner_user_id = $2
      order by work_date desc, task_kind
      limit 60
    `,
    [context.tenantId, operatorId],
  );
  const customers = await listEmployeeCustomers(context, {
    limit: 100,
    offset: 0,
    owner_user_id: operatorId,
    range: "all",
  });
  const costEvents = await queryCbe(
    `
      select
        ar.id as agent_run_id,
        ar.agent_id,
        ar.task_kind,
        ar.session_key,
        ar.target_summary,
        ar.status,
        ar.started_at,
        ar.finished_at,
        ar.cost_usd_estimate::text as cost_usd_estimate,
        l.provider,
        l.endpoint,
        l.source_type,
        l.request_units::text as request_units,
        l.cost_usd::text as actual_cost_usd,
        l.status as ledger_status,
        l.created_at as ledger_created_at
      from agent_runs ar
      left join api_call_ledger l
        on l.tenant_id = ar.tenant_id
       and l.agent_run_id = ar.id
      where ar.tenant_id = $1
        and ar.owner_user_id = $2
      order by coalesce(l.created_at, ar.started_at) desc, ar.id desc
      limit 100
    `,
    [context.tenantId, operatorId],
  );
  const senturaCostEvents = await listSenturaCostEventsForOperator(context, operatorId);
  const workloadRows = workload.rows.map((row) => ({
    ...row,
    cost_usd_estimate: moneyUsdText(row.cost_usd_estimate as string | number | null | undefined),
  }));
  const costEventRows = costEvents.rows.map((row) => ({
    ...row,
    cost_usd_estimate: moneyUsdText(row.cost_usd_estimate as string | number | null | undefined),
    actual_cost_usd: row.actual_cost_usd === null
      ? null
      : moneyUsdText(row.actual_cost_usd as string | number | null | undefined),
  }));
  return {
    profile: profile.rows[0] ?? null,
    workload: workloadRows,
    customers: customers.items,
    costEvents: senturaCostEvents ?? costEventRows.map((row) => dbCostEventRowToCostEvent(context, row)),
    costEventsSource: senturaCostEvents ? "sentura_cost" : "db_fallback",
  };
}

export async function listAdminOperatorMemoryRecords(context: TenantContext, operatorId: string) {
  return listEmployeeMemoryRecords(context, {
    ownerUserId: operatorId,
    limit: 300,
  });
}

export async function listAdminAgentUsage(context: TenantContext) {
  const result = await queryCbe(
    `
      select
        agent_id,
        usage_date,
        task_kind,
        status,
        run_count,
        avg_duration_seconds::text as avg_duration_seconds,
        cost_usd_estimate::text as cost_usd_estimate
      from cbe_agent_usage_daily
      where tenant_id = $1
      order by usage_date desc, agent_id, task_kind, status
      limit 180
    `,
    [context.tenantId],
  );
  return {
    items: result.rows.map((row) => ({
      ...row,
      cost_usd_estimate: moneyUsdText(row.cost_usd_estimate as string | number | null | undefined),
    })),
  };
}

function numeric(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyUsd(value: string | number | null | undefined) {
  const rounded = Math.round((numeric(value) + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function moneyUsdText(value: string | number | null | undefined) {
  return moneyUsd(value).toFixed(2);
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isoDateText(value: unknown, fallback = new Date(0).toISOString()) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

function durationBetweenMs(startedAt: unknown, finishedAt: unknown) {
  const start = new Date(isoDateText(startedAt)).getTime();
  const finish = new Date(isoDateText(finishedAt, isoDateText(startedAt))).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish <= start) return 0;
  return finish - start;
}

function pricingStatusFromDbRow(row: Record<string, unknown>, actualCostUsd: number | null, estimatedCostUsd: number) {
  const raw = optionalText(row.ledger_status)?.toLowerCase();
  if (raw === "priced" || raw === "estimated" || raw === "free" || raw === "included" || raw === "unpriced") {
    return raw as CostEvent["pricingStatus"];
  }
  if (actualCostUsd === null && estimatedCostUsd > 0) return "estimated";
  if (actualCostUsd === null) return "unpriced";
  return actualCostUsd === 0 ? "free" : "priced";
}

function dbCostEventRowToCostEvent(context: TenantContext, row: Record<string, unknown>): CostEvent {
  const actualCostUsd = row.actual_cost_usd === null || row.actual_cost_usd === undefined
    ? null
    : moneyUsd(row.actual_cost_usd as string | number | null | undefined);
  const estimatedCostUsd = moneyUsd(row.cost_usd_estimate as string | number | null | undefined);
  const pricingStatus = pricingStatusFromDbRow(row, actualCostUsd, estimatedCostUsd);
  const fallbackCostUsd = actualCostUsd ?? (pricingStatus === "estimated" ? estimatedCostUsd : null);
  const requestUnits = numeric(row.request_units as string | number | null | undefined) || 1;
  const timestamp = isoDateText(row.ledger_created_at ?? row.started_at, new Date().toISOString());
  const agentId = optionalText(row.agent_id) ?? optionalText(row.task_kind) ?? "cbe-cost-ledger";
  const provider = optionalText(row.provider) ?? optionalText(row.source_type) ?? "cbe-db-ledger";
  const endpoint = optionalText(row.endpoint) ?? provider;

  return {
    id: optionalText(row.id) ?? optionalText(row.agent_run_id) ?? `${agentId}:${timestamp}`,
    timestamp,
    agentId,
    sessionKey: optionalText(row.session_key) ?? optionalText(row.agent_run_id) ?? "",
    userToken: context.userId,
    tenantId: context.tenantId,
    departmentId: null,
    provider,
    model: endpoint,
    kind: "external_api",
    service: provider,
    operation: endpoint,
    pricingStatus,
    pricingNote: "数据库费用账本回退记录；实时 sentura-cost 事件暂不可用时用于只读核对。",
    externalUsage: {
      unit: "request",
      quantity: requestUnits,
      label: `${requestUnits.toLocaleString("zh-CN")} request`,
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    costUsd: fallbackCostUsd,
    durationMs: durationBetweenMs(row.started_at, row.finished_at),
    source: "external_tool_log",
  };
}

function usd(value: string | number | null | undefined) {
  return `US$${moneyUsdText(value)}`;
}

function costPeriodLabel(period: CbeCostPeriod) {
  if (period === "day") return "日";
  if (period === "week") return "周";
  if (period === "month") return "月";
  return "全周期";
}

async function createEmployeeCostControlNotification(
  context: TenantContext,
  input: {
    userId: string;
    kind: string;
    title: string;
    message: string;
    targetLabel: string;
    metadataJson?: Record<string, unknown>;
  },
  db?: CbeDb,
) {
  const sql = `
    insert into agent_runs (
      id,
      tenant_id,
      user_id,
      owner_user_id,
      visibility_scope,
      agent_id,
      status,
      task_kind,
      target_summary,
      current_stage,
      last_activity_at,
      started_at,
      finished_at,
      metadata_json
    )
    values ($1, $2, $3, $3, 'private', 'cbe-lead-discovery', 'completed', 'handoff', $4, $5, now(), now(), now(), $6::jsonb)
  `;
  const metadataJson = {
    notification_kind: input.kind,
    notification_title: input.title,
    notification_message: input.message,
    notification_target_label: input.targetLabel,
    notification_created_by_user_id: context.userId,
    ...input.metadataJson,
  };
  const values = [
    createCbeId("cost_notice"),
    context.tenantId,
    input.userId,
    input.targetLabel,
    input.message,
    JSON.stringify(metadataJson),
  ];
  if (db) {
    await db.query(sql, values);
    return;
  }
  await queryCbe(sql, values);
}

function startOfLocalDay() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfLocalWeek() {
  const value = startOfLocalDay();
  const day = value.getDay();
  const daysSinceMonday = (day + 6) % 7;
  value.setDate(value.getDate() - daysSinceMonday);
  return value;
}

function startOfLocalMonth() {
  const value = startOfLocalDay();
  value.setDate(1);
  return value;
}

function rangeStartDate(range: "today" | "week" | "month" | "all") {
  if (range === "today") return startOfLocalDay();
  if (range === "week") return startOfLocalWeek();
  if (range === "month") return startOfLocalMonth();
  return null;
}

function rangeStartIso(range: "today" | "week" | "month" | "all") {
  return rangeStartDate(range)?.toISOString();
}

function eventCostUsd(event: CostEvent) {
  return typeof event.costUsd === "number" && Number.isFinite(event.costUsd) ? event.costUsd : 0;
}

function eventTimeMs(event: CostEvent) {
  const time = new Date(event.timestamp).getTime();
  return Number.isFinite(time) ? time : 0;
}

function summarizeSenturaCostEvents(events: CostEvent[]) {
  return events.reduce(
    (acc, event) => {
      const amount = eventCostUsd(event);
      acc.spendUsd += amount;
      if (event.costUsd === null) {
        acc.unpricedCallCount += 1;
      } else if (event.pricingStatus === "estimated") {
        acc.estimatedCostUsd += amount;
      } else {
        acc.actualCostUsd += amount;
      }
      return acc;
    },
    { spendUsd: 0, actualCostUsd: 0, estimatedCostUsd: 0, unpricedCallCount: 0 },
  );
}

async function fetchSenturaCostEvents(options: {
  startTime?: string;
  endTime?: string;
  limit?: number;
}) {
  const pageSize = 1000;
  const maxEvents = options.limit ?? 10000;
  const events: CostEvent[] = [];
  try {
    const client = await getServerGatewayClient();
    for (let offset = 0; offset < maxEvents; offset += pageSize) {
      const result = await client.getCostEvents({
        startTime: options.startTime,
        endTime: options.endTime,
        limit: Math.min(pageSize, maxEvents - offset),
        offset,
      });
      events.push(...result.events);
      if (result.events.length < pageSize) break;
    }
    return events;
  } catch (err) {
    console.warn("[cbe-admin] sentura.cost.events unavailable; falling back to DB cost estimates:", err);
    return null;
  }
}

interface OperatorRunScopeRow {
  owner_user_id: string;
  id: string;
  agent_id: string | null;
  task_kind: string | null;
  session_key: string | null;
  target_summary: string | null;
  status: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  cost_usd_estimate: string | null;
}

async function listOperatorRunScopes(context: TenantContext, operatorIds: string[]) {
  if (operatorIds.length === 0) return [];
  const result = await queryCbe<OperatorRunScopeRow>(
    `
      select
        owner_user_id,
        id,
        agent_id,
        task_kind,
        session_key,
        target_summary,
        status,
        started_at,
        finished_at,
        cost_usd_estimate::text as cost_usd_estimate
      from agent_runs
      where tenant_id = $1
        and owner_user_id = any($2::text[])
        and session_key is not null
      order by started_at desc, id desc
    `,
    [context.tenantId, operatorIds],
  );
  return result.rows;
}

async function applySenturaCostToOperatorRows<T extends Record<string, unknown>>(
  context: TenantContext,
  rows: T[],
) {
  const operatorIds = rows.map((row) => String(row.user_id ?? "")).filter(Boolean);
  const runScopes = await listOperatorRunScopes(context, operatorIds);
  if (runScopes.length === 0) return rows;

  const sessionOwner = new Map<string, string>();
  for (const run of runScopes) {
    if (run.session_key) sessionOwner.set(run.session_key, run.owner_user_id);
  }

  const events = await fetchSenturaCostEvents({ limit: 10000 });
  if (!events) return rows;

  const eventsByOperator = new Map<string, CostEvent[]>();
  for (const event of events) {
    const ownerId = sessionOwner.get(event.sessionKey);
    if (!ownerId) continue;
    eventsByOperator.set(ownerId, [...(eventsByOperator.get(ownerId) ?? []), event]);
  }

  const starts = {
    today: startOfLocalDay().getTime(),
    week: startOfLocalWeek().getTime(),
    month: startOfLocalMonth().getTime(),
  };

  return rows.map((row) => {
    const ownerEvents = eventsByOperator.get(String(row.user_id ?? ""));
    if (!ownerEvents) return row;
    const costFor = (range: "today" | "week" | "month" | "all") => {
      const start = range === "all" ? null : starts[range];
      return ownerEvents
        .filter((event) => start === null || eventTimeMs(event) >= start)
        .reduce((sum, event) => sum + eventCostUsd(event), 0);
    };
    return {
      ...row,
      today_cost_usd: moneyUsd(costFor("today")),
      week_cost_usd: moneyUsd(costFor("week")),
      month_cost_usd: moneyUsd(costFor("month")),
      all_cost_usd: moneyUsd(costFor("all")),
    };
  });
}

async function applySenturaCostToCostRows<T extends Record<string, unknown>>(
  context: TenantContext,
  range: "today" | "week" | "month" | "all",
  rows: T[],
) {
  const operatorIds = rows.map((row) => String(row.user_id ?? "")).filter(Boolean);
  const runScopes = await listOperatorRunScopes(context, operatorIds);
  if (runScopes.length === 0) return rows;

  const sessionOwner = new Map<string, string>();
  for (const run of runScopes) {
    if (run.session_key) sessionOwner.set(run.session_key, run.owner_user_id);
  }

  const events = await fetchSenturaCostEvents({ startTime: rangeStartIso(range), limit: 10000 });
  if (!events) return rows;

  const eventsByOperator = new Map<string, CostEvent[]>();
  for (const event of events) {
    const ownerId = sessionOwner.get(event.sessionKey);
    if (!ownerId) continue;
    eventsByOperator.set(ownerId, [...(eventsByOperator.get(ownerId) ?? []), event]);
  }

  return rows.map((row) => {
    const ownerEvents = eventsByOperator.get(String(row.user_id ?? ""));
    if (!ownerEvents) return row;
    const summary = summarizeSenturaCostEvents(ownerEvents);
    const pendingEstimateUsd = Math.max(
      summary.estimatedCostUsd,
      numeric(row.estimated_cost_usd as string | number | null | undefined),
    );
    const spendUsd = summary.actualCostUsd + pendingEstimateUsd;
    const baseLimitUsd = numeric(row.base_limit_usd as string | number | null | undefined);
    const activeAllowanceUsd = numeric(row.active_allowance_usd as string | number | null | undefined);
    return {
      ...row,
      spend_usd: moneyUsd(spendUsd),
      actual_cost_usd: moneyUsd(summary.actualCostUsd),
      estimated_cost_usd: moneyUsd(pendingEstimateUsd),
      unpriced_call_count: summary.unpricedCallCount,
      remaining_usd: moneyUsd(baseLimitUsd + activeAllowanceUsd - spendUsd),
    };
  });
}

async function listSenturaCostEventsForOperator(
  context: TenantContext,
  operatorId: string,
) {
  const runScopes = await listOperatorRunScopes(context, [operatorId]);
  if (runScopes.length === 0) return [];

  const sessionKeys = new Set<string>();
  for (const run of runScopes) {
    if (run.session_key) sessionKeys.add(run.session_key);
  }

  const events = await fetchSenturaCostEvents({ limit: 10000 });
  if (!events) return null;

  return events
    .filter((event) => sessionKeys.has(event.sessionKey))
    .sort((a, b) => eventTimeMs(b) - eventTimeMs(a));
}

function periodToRange(period: CbeCostPeriod): "today" | "week" | "month" | "all" {
  if (period === "day") return "today";
  if (period === "week") return "week";
  if (period === "month") return "month";
  return "all";
}

async function getSenturaCostSpendForUserPeriod(
  context: TenantContext,
  userId: string,
  period: CbeCostPeriod,
) {
  const runScopes = await listOperatorRunScopes(context, [userId]);
  if (runScopes.length === 0) return null;
  const sessionKeys = new Set(runScopes.map((run) => run.session_key).filter((value): value is string => Boolean(value)));
  if (sessionKeys.size === 0) return null;
  const events = await fetchSenturaCostEvents({ startTime: rangeStartIso(periodToRange(period)), limit: 10000 });
  if (!events) return null;
  const scopedEvents = events.filter((event) => sessionKeys.has(event.sessionKey));
  if (scopedEvents.length === 0) return null;
  return moneyUsd(summarizeSenturaCostEvents(scopedEvents).spendUsd);
}

function rangeSql(range: "today" | "week" | "month" | "all") {
  if (range === "today") return "and acl.created_at >= date_trunc('day', now())";
  if (range === "week") return "and acl.created_at >= date_trunc('week', now())";
  if (range === "month") return "and acl.created_at >= date_trunc('month', now())";
  return "";
}

function periodSql(period: CbeCostPeriod, alias = "acl") {
  if (period === "day") return `and ${alias}.created_at >= date_trunc('day', now())`;
  if (period === "week") return `and ${alias}.created_at >= date_trunc('week', now())`;
  if (period === "month") return `and ${alias}.created_at >= date_trunc('month', now())`;
  return "";
}

function agentRunPeriodSql(period: CbeCostPeriod) {
  if (period === "day") return "and ar.started_at >= date_trunc('day', now())";
  if (period === "week") return "and ar.started_at >= date_trunc('week', now())";
  if (period === "month") return "and ar.started_at >= date_trunc('month', now())";
  return "";
}

async function getDbSpendForUserPeriod(
  context: TenantContext,
  userId: string,
  period: CbeCostPeriod,
) {
  const spend = await queryCbe<{ spend_usd: string | null }>(
    `
      select coalesce(sum(
        case
          when coalesce(ledger.actual_cost_usd, 0) > 0 then ledger.actual_cost_usd
          else coalesce(ar.cost_usd_estimate, 0)
        end
      ), 0)::text as spend_usd
      from agent_runs ar
      left join lateral (
        select sum(cost_usd) filter (where cost_usd is not null) as actual_cost_usd
        from api_call_ledger acl
        where acl.tenant_id = ar.tenant_id
          and acl.agent_run_id = ar.id
      ) ledger on true
      where ar.tenant_id = $1
        and coalesce(ar.owner_user_id, ar.user_id) = $2
        ${agentRunPeriodSql(period)}
    `,
    [context.tenantId, userId],
  );
  return moneyUsd(spend.rows[0]?.spend_usd);
}

async function getActiveAllowanceForUserPeriod(
  context: TenantContext,
  userId: string,
  period: CbeCostPeriod,
) {
  const allowance = await queryCbe<{ allowance_usd: string | null }>(
    `
      select coalesce(sum(amount_usd), 0)::text as allowance_usd
      from cbe_cost_allowances
      where tenant_id = $1
        and user_id = $2
        and period = $3
        and status = 'active'
        and (expires_at is null or expires_at > now())
    `,
    [context.tenantId, userId, period],
  );
  return moneyUsd(allowance.rows[0]?.allowance_usd);
}

async function syncOverrunApprovalForUserPeriod(
  context: TenantContext,
  input: {
    userId: string;
    period: CbeCostPeriod;
    baseLimitUsd: number;
    enabled: boolean;
    source: "cost_limit_update" | "cost_monitor_refresh";
  },
) {
  if (!input.enabled) return null;

  const senturaCostSpendUsd = await getSenturaCostSpendForUserPeriod(context, input.userId, input.period);
  const currentSpendUsd = moneyUsd(senturaCostSpendUsd ?? await getDbSpendForUserPeriod(context, input.userId, input.period));
  const activeAllowanceUsd = moneyUsd(await getActiveAllowanceForUserPeriod(context, input.userId, input.period));
  const baseLimitUsd = moneyUsd(input.baseLimitUsd);
  const requestedAllowanceUsd = moneyUsd(Math.max(0, currentSpendUsd - baseLimitUsd - activeAllowanceUsd));

  if (requestedAllowanceUsd <= COST_EPSILON_USD) {
    await queryCbe(
      `
        update cbe_cost_approval_requests
        set
          status = 'cancelled',
          decided_by_user_id = $4,
          decision_note = '当前月真实成本已回到管理者限额内。',
          decided_at = now()
        where tenant_id = $1
          and user_id = $2
          and period = $3
          and status = 'pending'
          and metadata_json->>'syncKind' = 'monthly_overrun'
      `,
      [context.tenantId, input.userId, input.period, context.userId],
    );
    return null;
  }

  if (input.source === "cost_monitor_refresh") {
    const rejected = await queryCbe<{
      id: string;
      current_spend_usd: string;
      requested_allowance_usd: string;
    }>(
      `
        select
          id,
          current_spend_usd::text as current_spend_usd,
          requested_allowance_usd::text as requested_allowance_usd
        from cbe_cost_approval_requests
        where tenant_id = $1
          and user_id = $2
          and period = $3
          and status = 'rejected'
          and (
            metadata_json->>'syncKind' = 'monthly_overrun'
            or target_summary = '本月真实成本已超过管理者设置的月限额。'
          )
        order by decided_at desc nulls last, created_at desc
        limit 1
      `,
      [context.tenantId, input.userId, input.period],
    );
    const rejectedRow = rejected.rows[0];
    if (
      rejectedRow &&
      moneyUsd(rejectedRow.current_spend_usd) + COST_EPSILON_USD >= currentSpendUsd &&
      moneyUsd(rejectedRow.requested_allowance_usd) + COST_EPSILON_USD >= requestedAllowanceUsd
    ) {
      return rejectedRow.id;
    }
  }

  const targetSummary = "本月真实成本已超过管理者设置的月限额。";
  const metadataJson = {
    syncKind: "monthly_overrun",
    source: input.source,
    syncedAt: new Date().toISOString(),
  };
  const automatic = await queryCbe<{ id: string }>(
    `
      select id
      from cbe_cost_approval_requests
      where tenant_id = $1
        and user_id = $2
        and period = $3
        and status = 'pending'
        and metadata_json->>'syncKind' = 'monthly_overrun'
      order by created_at desc
      limit 1
    `,
    [context.tenantId, input.userId, input.period],
  );
  const automaticId = automatic.rows[0]?.id;
  if (automaticId) {
    await queryCbe(
      `
        update cbe_cost_approval_requests
        set
          target_summary = $4,
          estimated_cost_usd = $5,
          current_spend_usd = $6,
          base_limit_usd = $7,
          active_allowance_usd = $8,
          requested_allowance_usd = greatest(requested_allowance_usd, $9),
          metadata_json = metadata_json || $10::jsonb
        where tenant_id = $1
          and user_id = $2
          and period = $3
          and status = 'pending'
          and metadata_json->>'syncKind' = 'monthly_overrun'
      `,
      [
        context.tenantId,
        input.userId,
        input.period,
        targetSummary,
        requestedAllowanceUsd,
        currentSpendUsd,
        baseLimitUsd,
        activeAllowanceUsd,
        requestedAllowanceUsd,
        JSON.stringify(metadataJson),
      ],
    );
    return automaticId;
  }

  const anyPending = await queryCbe<{ id: string }>(
    `
      select id
      from cbe_cost_approval_requests
      where tenant_id = $1
        and user_id = $2
        and period = $3
        and status = 'pending'
      order by created_at desc
      limit 1
    `,
    [context.tenantId, input.userId, input.period],
  );
  if (anyPending.rows[0]?.id) return anyPending.rows[0].id;

  const approvalId = createCbeId("cost_approval");
  await queryCbe(
    `
      insert into cbe_cost_approval_requests (
        id,
        tenant_id,
        user_id,
        agent_id,
        task_kind,
        target_summary,
        estimated_cost_usd,
        period,
        current_spend_usd,
        base_limit_usd,
        active_allowance_usd,
        requested_allowance_usd,
        requested_by_user_id,
        metadata_json
      )
      values ($1, $2, $3, 'cbe-lead-discovery', 'lead', $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    `,
    [
      approvalId,
      context.tenantId,
      input.userId,
      targetSummary,
      requestedAllowanceUsd,
      input.period,
      currentSpendUsd,
      baseLimitUsd,
      activeAllowanceUsd,
      requestedAllowanceUsd,
      context.userId,
      JSON.stringify(metadataJson),
    ],
  );
  return approvalId;
}

async function syncMonthlyOverrunApprovalsForTenant(context: TenantContext) {
  const limits = await queryCbe<{
    user_id: string;
    limit_usd: string | null;
    enabled: boolean;
  }>(
    `
      select
        p.user_id,
        l.limit_usd::text as limit_usd,
        coalesce(l.enabled, false) as enabled
      from cbe_user_profiles p
      left join cbe_cost_limits l
        on l.tenant_id = p.tenant_id
       and l.user_id = p.user_id
       and l.period = 'month'
      where p.tenant_id = $1
        and p.cbe_role = 'operator'
        and p.status = 'active'
        and l.id is not null
      order by p.display_name
    `,
    [context.tenantId],
  );

  for (const limit of limits.rows) {
    await syncOverrunApprovalForUserPeriod(context, {
      userId: limit.user_id,
      period: "month",
      baseLimitUsd: numeric(limit.limit_usd),
      enabled: limit.enabled,
      source: "cost_monitor_refresh",
    });
  }
}

interface CostRow {
  id: string;
  agent_run_id: string | null;
  provider: string;
  endpoint: string | null;
  source_type: string | null;
  request_units: string | null;
  cost_usd: string | null;
  status: string;
  created_at: Date;
  metadata_json: Record<string, unknown>;
  agent_id: string | null;
  task_kind: string | null;
  target_summary: string | null;
  operator_user_id: string | null;
  operator_name: string | null;
}

interface CostLimitRow {
  id: string;
  user_id: string;
  operator_name: string | null;
  period: CbeCostPeriod;
  limit_usd: string;
  enabled: boolean;
  warning_ratio: string;
  updated_at: Date;
}

interface CostApprovalRow {
  id: string;
  user_id: string;
  operator_name: string | null;
  agent_id: string;
  task_kind: string;
  target_summary: string | null;
  estimated_cost_usd: string;
  period: CbeCostPeriod;
  current_spend_usd: string;
  base_limit_usd: string;
  active_allowance_usd: string;
  requested_allowance_usd: string;
  status: string;
  decision_note: string | null;
  decided_at: Date | null;
  created_at: Date;
}

function toCostItem(row: CostRow) {
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    provider: row.provider,
    endpoint: row.endpoint,
    sourceType: row.source_type,
    requestUnits: numeric(row.request_units),
    costUsd: row.cost_usd === null ? null : moneyUsd(row.cost_usd),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    metadataJson: row.metadata_json ?? {},
    agentId: row.agent_id,
    taskKind: row.task_kind,
    targetSummary: row.target_summary,
    operatorUserId: row.operator_user_id,
    operatorName: row.operator_name,
  };
}

function toCostLimit(row: CostLimitRow) {
  return {
    id: row.id,
    userId: row.user_id,
    operatorName: row.operator_name,
    period: row.period,
    limitUsd: moneyUsd(row.limit_usd),
    enabled: row.enabled,
    warningRatio: numeric(row.warning_ratio),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toCostApproval(row: CostApprovalRow) {
  return {
    id: row.id,
    userId: row.user_id,
    operatorName: row.operator_name,
    agentId: row.agent_id,
    taskKind: row.task_kind,
    targetSummary: row.target_summary,
    estimatedCostUsd: moneyUsd(row.estimated_cost_usd),
    period: row.period,
    currentSpendUsd: moneyUsd(row.current_spend_usd),
    baseLimitUsd: moneyUsd(row.base_limit_usd),
    activeAllowanceUsd: moneyUsd(row.active_allowance_usd),
    requestedAllowanceUsd: moneyUsd(row.requested_allowance_usd),
    status: row.status,
    decisionNote: row.decision_note,
    decidedAt: row.decided_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listAdminCosts(
  context: TenantContext,
  range: "today" | "week" | "month" | "all" = "month",
) {
  const period: CbeCostPeriod =
    range === "today" ? "day" : range === "week" ? "week" : range === "all" ? "all_time" : "month";
  const limitPeriod: CbeCostPeriod = "month";
  await syncMonthlyOverrunApprovalsForTenant(context);
  const agentPeriodClause =
    period === "day"
      ? "and ar.started_at >= date_trunc('day', now())"
      : period === "week"
        ? "and ar.started_at >= date_trunc('week', now())"
        : period === "month"
          ? "and ar.started_at >= date_trunc('month', now())"
          : "";
  const costs = await queryCbe<Record<string, unknown>>(
    `
      select
        p.user_id,
        p.display_name,
        p.email,
        p.team_name,
        p.status,
        coalesce(limit_row.limit_usd, 0)::text as base_limit_usd,
        coalesce(limit_row.enabled, false) as limit_enabled,
        coalesce(allowances.allowance_usd, 0)::text as active_allowance_usd,
        coalesce(costs.spend_usd, 0)::text as spend_usd,
        coalesce(costs.actual_cost_usd, 0)::text as actual_cost_usd,
        coalesce(costs.estimated_cost_usd, 0)::text as estimated_cost_usd,
        coalesce(costs.unpriced_call_count, 0)::text as unpriced_call_count,
        coalesce(costs.active_task_count, 0)::text as active_task_count,
        coalesce(pending.pending_count, 0)::text as pending_approval_count
      from cbe_user_profiles p
      left join cbe_cost_limits limit_row
        on limit_row.tenant_id = p.tenant_id
       and limit_row.user_id = p.user_id
       and limit_row.period = $2
      left join lateral (
        select sum(amount_usd) as allowance_usd
        from cbe_cost_allowances a
        where a.tenant_id = p.tenant_id
          and a.user_id = p.user_id
          and a.period = $2
          and a.status = 'active'
          and (a.expires_at is null or a.expires_at > now())
      ) allowances on true
      left join lateral (
        select
          coalesce(sum(
            case
              when coalesce(ledger.actual_cost_usd, 0) > 0 then ledger.actual_cost_usd
              when ar.status in ('queued', 'running', 'polling') then coalesce(ar.cost_usd_estimate, 0)
              else 0
            end
          ), 0) as spend_usd,
          coalesce(sum(coalesce(ledger.actual_cost_usd, 0)), 0) as actual_cost_usd,
          coalesce(sum(
            case
              when coalesce(ledger.actual_cost_usd, 0) > 0 then 0
              when ar.status in ('queued', 'running', 'polling') then coalesce(ar.cost_usd_estimate, 0)
              else 0
            end
          ), 0) as estimated_cost_usd,
          coalesce(sum(coalesce(ledger.unpriced_call_count, 0)), 0) as unpriced_call_count,
          count(*) filter (where ar.status in ('queued', 'running', 'polling')) as active_task_count
        from agent_runs ar
        left join lateral (
          select
            sum(cost_usd) filter (where cost_usd is not null) as actual_cost_usd,
            count(*) filter (where cost_usd is null) as unpriced_call_count
          from api_call_ledger l
          where l.tenant_id = ar.tenant_id
            and l.agent_run_id = ar.id
        ) ledger on true
        where ar.tenant_id = p.tenant_id
          and ar.owner_user_id = p.user_id
          ${agentPeriodClause}
      ) costs on true
      left join lateral (
        select count(*) as pending_count
        from cbe_cost_approval_requests req
        where req.tenant_id = p.tenant_id
          and req.user_id = p.user_id
          and req.status = 'pending'
      ) pending on true
      where p.tenant_id = $1
        and p.cbe_role = 'operator'
        and p.status <> 'inactive'
      order by p.display_name
    `,
    [context.tenantId, limitPeriod],
  );
  const approvals = await queryCbe<CostApprovalRow>(
    `
      select
        req.id,
        req.user_id,
        prof.display_name as operator_name,
        req.agent_id,
        req.task_kind,
        req.target_summary,
        req.estimated_cost_usd::text as estimated_cost_usd,
        req.period,
        req.current_spend_usd::text as current_spend_usd,
        req.base_limit_usd::text as base_limit_usd,
        req.active_allowance_usd::text as active_allowance_usd,
        req.requested_allowance_usd::text as requested_allowance_usd,
        req.status,
        req.decision_note,
        req.decided_at,
        req.created_at
      from cbe_cost_approval_requests req
      left join cbe_user_profiles prof
        on prof.tenant_id = req.tenant_id
       and prof.user_id = req.user_id
      where req.tenant_id = $1
        and req.status = 'pending'
      order by
        req.created_at desc
      limit 200
    `,
    [context.tenantId],
  );
  const items = costs.rows.map((row) => {
    const spendUsd = moneyUsd(row.spend_usd as string | null);
    const baseLimitUsd = moneyUsd(row.base_limit_usd as string | null);
    const activeAllowanceUsd = moneyUsd(row.active_allowance_usd as string | null);
    return {
      ...row,
      spend_usd: spendUsd,
      actual_cost_usd: moneyUsd(row.actual_cost_usd as string | null),
      estimated_cost_usd: moneyUsd(row.estimated_cost_usd as string | null),
      unpriced_call_count: numeric(row.unpriced_call_count as string | null),
      active_task_count: numeric(row.active_task_count as string | null),
      pending_approval_count: numeric(row.pending_approval_count as string | null),
      base_limit_usd: baseLimitUsd,
      active_allowance_usd: activeAllowanceUsd,
      remaining_usd: moneyUsd(baseLimitUsd + activeAllowanceUsd - spendUsd),
    };
  });
  const reconciledItems = await applySenturaCostToCostRows(context, range, items);
  const rawPool = reconciledItems.reduce(
    (acc, item) => ({
      spendUsd: acc.spendUsd + (item.spend_usd as number),
      actualCostUsd: acc.actualCostUsd + (item.actual_cost_usd as number),
      estimatedCostUsd: acc.estimatedCostUsd + (item.estimated_cost_usd as number),
      baseLimitUsd: acc.baseLimitUsd + (item.base_limit_usd as number),
      activeAllowanceUsd: acc.activeAllowanceUsd + (item.active_allowance_usd as number),
      remainingUsd: acc.remainingUsd + (item.remaining_usd as number),
      activeTaskCount: acc.activeTaskCount + (item.active_task_count as number),
      unpricedCallCount: acc.unpricedCallCount + (item.unpriced_call_count as number),
    }),
    {
      spendUsd: 0,
      actualCostUsd: 0,
      estimatedCostUsd: 0,
      baseLimitUsd: 0,
      activeAllowanceUsd: 0,
      remainingUsd: 0,
      activeTaskCount: 0,
      unpricedCallCount: 0,
    },
  );
  const pool = {
    spendUsd: moneyUsd(rawPool.spendUsd),
    actualCostUsd: moneyUsd(rawPool.actualCostUsd),
    estimatedCostUsd: moneyUsd(rawPool.estimatedCostUsd),
    baseLimitUsd: moneyUsd(rawPool.baseLimitUsd),
    activeAllowanceUsd: moneyUsd(rawPool.activeAllowanceUsd),
    remainingUsd: moneyUsd(rawPool.remainingUsd),
    activeTaskCount: rawPool.activeTaskCount,
    unpricedCallCount: rawPool.unpricedCallCount,
  };
  return {
    period,
    range,
    pool,
    items: reconciledItems,
    approvals: approvals.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      display_name: row.operator_name ?? row.user_id,
      team_name: null,
      agent_id: row.agent_id,
      task_kind: row.task_kind,
      target_summary: row.target_summary,
      estimated_cost_usd: moneyUsdText(row.estimated_cost_usd),
      period: row.period,
      current_spend_usd: moneyUsdText(row.current_spend_usd),
      base_limit_usd: moneyUsdText(row.base_limit_usd),
      active_allowance_usd: moneyUsdText(row.active_allowance_usd),
      requested_allowance_usd: moneyUsdText(row.requested_allowance_usd),
      status: row.status,
      created_at: row.created_at.toISOString(),
      decision_note: row.decision_note,
    })),
  };
}

export async function getEmployeeCostBudget(
  context: TenantContext,
  period: CbeCostPeriod = "month",
) {
  const limit = await queryCbe<{
    limit_usd: string | null;
    enabled: boolean;
    warning_ratio: string | null;
    updated_at: Date | null;
  }>(
    `
      select
        limit_usd::text as limit_usd,
        enabled,
        warning_ratio::text as warning_ratio,
        updated_at
      from cbe_cost_limits
      where tenant_id = $1
        and user_id = $2
        and period = $3
      limit 1
    `,
    [context.tenantId, context.userId, period],
  );
  const row = limit.rows[0];
  const limitEnabled = row?.enabled ?? false;
  const baseLimitUsd = moneyUsd(row?.limit_usd);
  const activeAllowanceUsd = await getActiveAllowanceForUserPeriod(context, context.userId, period);
  const limitUsd = limitEnabled ? moneyUsd(baseLimitUsd + activeAllowanceUsd) : 0;
  const senturaCostSpendUsd = await getSenturaCostSpendForUserPeriod(context, context.userId, period);
  const spendUsd = moneyUsd(senturaCostSpendUsd ?? await getDbSpendForUserPeriod(context, context.userId, period));

  return {
    period,
    baseLimitUsd,
    activeAllowanceUsd,
    limitUsd,
    limitEnabled,
    warningRatio: numeric(row?.warning_ratio) || 0.8,
    hardStopRatio: 1,
    spendUsd,
    remainingUsd: limitEnabled ? moneyUsd(limitUsd - spendUsd) : null,
    updatedAt: row?.updated_at?.toISOString() ?? null,
  };
}

export async function upsertAdminCostLimit(
  context: TenantContext,
  input: AdminCostLimitPatchRequest,
) {
  const result = await queryCbe<CostLimitRow>(
    `
      insert into cbe_cost_limits (
        id,
        tenant_id,
        user_id,
        period,
        limit_usd,
        enabled,
        created_by_user_id,
        updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $7)
      on conflict (tenant_id, user_id, period)
      do update set
        limit_usd = excluded.limit_usd,
        enabled = excluded.enabled,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now()
      returning
        id,
        user_id,
        null::text as operator_name,
        period,
        limit_usd::text as limit_usd,
        enabled,
        warning_ratio::text as warning_ratio,
        updated_at
    `,
    [
      createCbeId("cost_limit"),
      context.tenantId,
      input.user_id,
      input.period,
      input.limit_usd,
      input.enabled,
      context.userId,
    ],
  );
  const row = result.rows[0];
  if (input.period === "month") {
    await syncOverrunApprovalForUserPeriod(context, {
      userId: input.user_id,
      period: "month",
      baseLimitUsd: input.limit_usd,
      enabled: input.enabled,
      source: "cost_limit_update",
    });
  }
  const periodLabel = costPeriodLabel(input.period);
  const title = `${periodLabel}限额已更新`;
  const targetLabel = input.enabled
    ? `最终${periodLabel}基础限额：${usd(input.limit_usd)}`
    : `${periodLabel}成本限额已停用`;
  await createEmployeeCostControlNotification(context, {
    userId: input.user_id,
    kind: "cost_limit_updated",
    title,
    message: input.enabled
      ? `管理者已将你的${periodLabel}基础成本限额调整为 ${usd(input.limit_usd)}，新限额已实时生效。`
      : `管理者已停用你的${periodLabel}基础成本限额，该设置已实时生效。`,
    targetLabel,
    metadataJson: {
      period: input.period,
      limit_usd: input.limit_usd,
      enabled: input.enabled,
      final_limit_usd: input.enabled ? input.limit_usd : null,
    },
  });
  return toCostLimit(row);
}

export async function setAdminCostAllowance(
  context: TenantContext,
  input: AdminCostAllowancePatchRequest,
) {
  await queryCbe(
    `
      update cbe_cost_allowances
      set status = 'revoked'
      where tenant_id = $1
        and user_id = $2
        and period = $3
        and status = 'active'
    `,
    [context.tenantId, input.user_id, input.period],
  );

  if (input.amount_usd > 0) {
    await queryCbe(
      `
        insert into cbe_cost_allowances (
          id,
          tenant_id,
          user_id,
          period,
          amount_usd,
          status,
          reason,
          approved_by_user_id
        )
        values ($1, $2, $3, $4, $5, 'active', $6, $7)
      `,
      [
        createCbeId("cost_allowance"),
        context.tenantId,
        input.user_id,
        input.period,
        input.amount_usd,
        "管理者手动设置临时额度。",
        context.userId,
      ],
    );
  }

  const limit = await queryCbe<{ limit_usd: string | null; enabled: boolean }>(
    `
      select limit_usd::text as limit_usd, enabled
      from cbe_cost_limits
      where tenant_id = $1
        and user_id = $2
        and period = $3
      limit 1
    `,
    [context.tenantId, input.user_id, input.period],
  );
  await syncOverrunApprovalForUserPeriod(context, {
    userId: input.user_id,
    period: input.period,
    baseLimitUsd: numeric(limit.rows[0]?.limit_usd),
    enabled: limit.rows[0]?.enabled ?? true,
    source: "cost_limit_update",
  });

  const activeAllowanceUsd = await getActiveAllowanceForUserPeriod(context, input.user_id, input.period);
  const periodLabel = costPeriodLabel(input.period);
  await createEmployeeCostControlNotification(context, {
    userId: input.user_id,
    kind: "cost_allowance_updated",
    title: `${periodLabel}临时额度已更新`,
    message: activeAllowanceUsd > 0
      ? `管理者已将你的${periodLabel}临时额度调整为 ${usd(activeAllowanceUsd)}，该额度已实时生效。`
      : `管理者已清零你的${periodLabel}临时额度，该调整已实时生效。`,
    targetLabel: `最终${periodLabel}临时额度：${usd(activeAllowanceUsd)}`,
    metadataJson: {
      period: input.period,
      requested_amount_usd: input.amount_usd,
      final_allowance_usd: activeAllowanceUsd,
    },
  });

  return {
    userId: input.user_id,
    period: input.period,
    activeAllowanceUsd,
  };
}

export async function upsertAdminOperatorProfiles(
  context: TenantContext,
  inputs: AdminOperatorProfileInput[],
) {
  if (inputs.length === 0) {
    throw new CbeStoreError(400, "operator_batch_empty", "请至少提供一个员工账户。");
  }
  if (inputs.length > MAX_CBE_OPERATOR_ACCOUNTS) {
    throw new CbeStoreError(400, "operator_batch_too_large", `一次最多创建 ${MAX_CBE_OPERATOR_ACCOUNTS} 个员工账户。`);
  }
  const normalizedNames = inputs.map((input) => input.display_name.trim().toLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    throw new CbeStoreError(409, "operator_name_duplicate_in_batch", "批量创建中存在重复员工姓名，请先去重。");
  }

  return withCbeTransaction(async (client) => {
    const inputIds = inputs.map((input) => input.user_id);
    const currentCount = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from cbe_user_profiles
        where tenant_id = $1
          and cbe_role = 'operator'
          and status <> 'inactive'
          and not (user_id = any($2::text[]))
      `,
      [context.tenantId, inputIds],
    );
    const totalAfterCreate = Number(currentCount.rows[0]?.count ?? 0) + inputs.length;
    if (totalAfterCreate > MAX_CBE_OPERATOR_ACCOUNTS) {
      throw new CbeStoreError(
        409,
        "operator_limit_exceeded",
        `员工账号上限为 ${MAX_CBE_OPERATOR_ACCOUNTS} 个，请先删除或停用不需要的员工后再创建。`,
      );
    }

    const duplicateName = await client.query<{ display_name: string }>(
      `
        select display_name
        from cbe_user_profiles
        where tenant_id = $1
          and cbe_role = 'operator'
          and status <> 'inactive'
          and lower(display_name) = any($2::text[])
          and not (user_id = any($3::text[]))
        limit 1
      `,
      [context.tenantId, normalizedNames, inputIds],
    );
    if (duplicateName.rows[0]) {
      throw new CbeStoreError(409, "operator_name_exists", "已有同名员工账户，请换一个员工姓名。");
    }

    const profiles: Array<Record<string, unknown>> = [];
    for (const input of inputs) {
      await client.query(
        `
          insert into sentura_users (id, tenant_id, display_name, role, department_id)
          values ($1, $2, $3, $4, $5)
          on conflict (id)
          do update set
            display_name = excluded.display_name,
            role = excluded.role,
            department_id = excluded.department_id
        `,
        [
          input.user_id,
          context.tenantId,
          input.display_name,
          input.platform_role ?? "end_user",
          input.department_id ?? null,
        ],
      );
      const profile = await client.query(
        `
          insert into cbe_user_profiles (
            id,
            tenant_id,
            user_id,
            cbe_role,
            display_name,
            team_name,
            status,
            email,
            password_hash
          )
          values ($1, $2, $3, 'operator', $4, $5, 'active', $6, $7)
          on conflict (tenant_id, user_id)
          do update set
            display_name = excluded.display_name,
            team_name = excluded.team_name,
            email = excluded.email,
            password_hash = excluded.password_hash,
            status = 'active',
            updated_at = now()
          returning user_id, display_name, team_name, status, email
        `,
        [
          createCbeId("profile"),
          context.tenantId,
          input.user_id,
          input.display_name,
          input.team_name ?? null,
          input.email ?? null,
          hashCbePassword(input.password),
        ],
      );
      for (const limit of input.initial_limits) {
        await client.query(
          `
            insert into cbe_cost_limits (
              id,
              tenant_id,
              user_id,
              period,
              limit_usd,
              enabled,
              created_by_user_id,
              updated_by_user_id
            )
            values ($1, $2, $3, $4, $5, $6, $7, $7)
            on conflict (tenant_id, user_id, period)
            do update set
              limit_usd = excluded.limit_usd,
              enabled = excluded.enabled,
              updated_by_user_id = excluded.updated_by_user_id,
              updated_at = now()
          `,
          [
            createCbeId("cost_limit"),
            context.tenantId,
            input.user_id,
            limit.period,
            limit.limit_usd,
            limit.enabled,
            context.userId,
          ],
        );
      }
      profiles.push(profile.rows[0]);
    }
    return profiles;
  });
}

export async function upsertAdminOperatorProfile(
  context: TenantContext,
  input: AdminOperatorProfileInput,
) {
  const profiles = await upsertAdminOperatorProfiles(context, [input]);
  return profiles[0];
}

export async function updateAdminOperator(
  context: TenantContext,
  operatorId: string,
  input: AdminUpdateOperatorRequest,
) {
  const result = await withCbeTransaction(async (client) => {
    if (input.display_name) {
      await client.query(
        `
          update sentura_users
          set display_name = $3
          where tenant_id = $1
            and id = $2
        `,
        [context.tenantId, operatorId, input.display_name],
      );
    }
    return client.query(
      `
        update cbe_user_profiles
        set
          display_name = coalesce($3, display_name),
          team_name = case when $4::boolean then $5 else team_name end,
          status = coalesce($6, status),
          password_hash = coalesce($7, password_hash),
          updated_at = now()
        where tenant_id = $1
          and user_id = $2
          and cbe_role = 'operator'
          and status <> 'inactive'
        returning user_id, display_name, team_name, status
      `,
      [
        context.tenantId,
        operatorId,
        input.display_name ?? null,
        Object.prototype.hasOwnProperty.call(input, "team_name"),
        input.team_name ?? null,
        input.status ?? null,
        input.password ? hashCbePassword(input.password) : null,
      ],
    );
  });
  if (!result.rows[0]) {
    throw new CbeStoreError(404, "operator_missing", "Requested CBE operator was not found.");
  }
  return getAdminOperator(context, operatorId);
}

export async function deleteAdminOperator(
  context: TenantContext,
  operatorId: string,
) {
  const result = await withCbeTransaction(async (client) => {
    const profile = await client.query(
      `
        update cbe_user_profiles
        set
          status = 'inactive',
          updated_at = now()
        where tenant_id = $1
          and user_id = $2
          and cbe_role = 'operator'
          and status <> 'inactive'
        returning user_id, display_name, team_name, status, email
      `,
      [context.tenantId, operatorId],
    );
    const row = profile.rows[0];
    if (!row) return null;

    const cancelledAt = new Date().toISOString();
    await client.query(
      `
        update agent_runs
        set
          status = 'cancelled',
          current_stage = '员工已删除，任务已取消',
          last_activity_at = now(),
          finished_at = coalesce(finished_at, now()),
          error_code = 'operator_deleted',
          error_message = '员工已被管理者删除。',
          metadata_json = coalesce(metadata_json, '{}'::jsonb) || $3::jsonb
        where tenant_id = $1
          and owner_user_id = $2
          and status in ('queued', 'running', 'polling')
      `,
      [
        context.tenantId,
        operatorId,
        JSON.stringify({
          cancelled_by_user_id: context.userId,
          cancelled_at: cancelledAt,
          cancel_reason: "operator_deleted",
        }),
      ],
    );
    await client.query(
      `
        update lead_runs
        set
          status = 'cancelled',
          completed_at = coalesce(completed_at, now())
        where tenant_id = $1
          and owner_user_id = $2
          and status in ('queued', 'running')
      `,
      [context.tenantId, operatorId],
    );
    await client.query(
      `
        update cbe_cost_approval_requests
        set
          status = 'cancelled',
          decided_by_user_id = $3,
          decided_at = now(),
          decision_note = coalesce(nullif(decision_note, ''), '员工已删除，审批自动取消。')
        where tenant_id = $1
          and user_id = $2
          and status = 'pending'
      `,
      [context.tenantId, operatorId, context.userId],
    );
    return row;
  });
  if (!result) {
    throw new CbeStoreError(404, "operator_missing", "Requested CBE operator was not found.");
  }
  return { operator: result };
}

export async function listAdminOperatorCustomers(
  context: TenantContext,
  operatorId: string,
  query: ListQuery,
) {
  return listEmployeeCustomers(context, { ...query, owner_user_id: operatorId });
}

export async function listAdminHighValueCustomers(context: TenantContext, query: ListQuery) {
  const page = await listEmployeeCustomers(context, query);
  return {
    ...page,
    items: page.items.filter((item) => (item.normalizedScore ?? 0) >= 80),
  };
}

export async function decideAdminCostApproval(
  context: TenantContext,
  input: AdminCostApprovalDecisionRequest,
) {
  return withCbeTransaction(async (client) => {
    const existing = await client.query<CostApprovalRow>(
      `
        select
          id,
          user_id,
          null::text as operator_name,
          agent_id,
          task_kind,
          target_summary,
          estimated_cost_usd::text as estimated_cost_usd,
          period,
          current_spend_usd::text as current_spend_usd,
          base_limit_usd::text as base_limit_usd,
          active_allowance_usd::text as active_allowance_usd,
          requested_allowance_usd::text as requested_allowance_usd,
          status,
          decision_note,
          decided_at,
          created_at
        from cbe_cost_approval_requests
        where tenant_id = $1
          and id = $2
          and status = 'pending'
        for update
      `,
      [context.tenantId, input.request_id],
    );
    const existingRow = existing.rows[0];
    if (!existingRow) {
      throw new CbeStoreError(404, "cost_approval_missing", "Pending cost approval request was not found.");
    }

    const originalRequestedAllowanceUsd = moneyUsd(existingRow.requested_allowance_usd);
    const finalRequestedAllowanceUsd = moneyUsd(input.approved_amount_usd ?? originalRequestedAllowanceUsd);
    const decisionMetadata = {
      decision: input.decision,
      decided_by_user_id: context.userId,
      decided_at: new Date().toISOString(),
      original_requested_allowance_usd: originalRequestedAllowanceUsd,
      final_requested_allowance_usd: finalRequestedAllowanceUsd,
      approved_amount_usd: input.decision === "approved" ? finalRequestedAllowanceUsd : 0,
    };

    const request = await client.query<CostApprovalRow>(
      `
        update cbe_cost_approval_requests
        set
          status = $3,
          decided_by_user_id = $4,
          decision_note = $5,
          decided_at = now(),
          requested_allowance_usd = $6,
          metadata_json = metadata_json || $7::jsonb
        where tenant_id = $1
          and id = $2
          and status = 'pending'
        returning
          id,
          user_id,
          null::text as operator_name,
          agent_id,
          task_kind,
          target_summary,
          estimated_cost_usd::text as estimated_cost_usd,
          period,
          current_spend_usd::text as current_spend_usd,
          base_limit_usd::text as base_limit_usd,
          active_allowance_usd::text as active_allowance_usd,
          requested_allowance_usd::text as requested_allowance_usd,
          status,
          decision_note,
          decided_at,
          created_at
      `,
      [
        context.tenantId,
        input.request_id,
        input.decision,
        context.userId,
        input.decision_note ?? null,
        finalRequestedAllowanceUsd,
        JSON.stringify(decisionMetadata),
      ],
    );
    const row = request.rows[0];
    if (!row) {
      throw new CbeStoreError(404, "cost_approval_missing", "Pending cost approval request was not found.");
    }
    if (input.decision === "approved") {
      await client.query(
        `
          insert into cbe_cost_allowances (
            id,
            tenant_id,
            user_id,
            period,
            amount_usd,
            status,
            reason,
            approval_request_id,
            approved_by_user_id,
            expires_at
          )
          values ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9::timestamptz)
        `,
        [
          createCbeId("cost_allowance"),
          context.tenantId,
          row.user_id,
          row.period,
          finalRequestedAllowanceUsd,
          input.decision_note ?? "Manager approved temporary CBE cost allowance.",
          row.id,
          context.userId,
          input.expires_at ?? null,
        ],
      );
    }
    const periodLabel = costPeriodLabel(row.period);
    const approved = input.decision === "approved";
    await createEmployeeCostControlNotification(context, {
      userId: row.user_id,
      kind: approved ? "cost_approval_approved" : "cost_approval_rejected",
      title: approved ? "超额申请已批准" : "超额申请已拒绝",
      message: approved
        ? `你的${periodLabel}超额申请已批准，最终请求额度 ${usd(finalRequestedAllowanceUsd)} 已作为临时额度生效。`
        : `你的${periodLabel}超额申请已被拒绝，最终请求额度 ${usd(finalRequestedAllowanceUsd)} 未生效。`,
      targetLabel: approved
        ? `最终请求额度：${usd(finalRequestedAllowanceUsd)}；批准额度：${usd(finalRequestedAllowanceUsd)}`
        : `最终请求额度：${usd(finalRequestedAllowanceUsd)}；批准额度：US$0.00`,
      metadataJson: {
        approval_request_id: row.id,
        period: row.period,
        task_kind: row.task_kind,
        target_summary: row.target_summary,
      estimated_cost_usd: moneyUsd(row.estimated_cost_usd),
      current_spend_usd: moneyUsd(row.current_spend_usd),
      base_limit_usd: moneyUsd(row.base_limit_usd),
      active_allowance_usd: moneyUsd(row.active_allowance_usd),
      original_requested_allowance_usd: originalRequestedAllowanceUsd,
      final_requested_allowance_usd: finalRequestedAllowanceUsd,
      approved_amount_usd: approved ? finalRequestedAllowanceUsd : 0,
        decision_note: input.decision_note ?? null,
      },
    }, client);
    return toCostApproval(row);
  });
}

export async function checkCbeCostBudgetBeforeRun(
  context: TenantContext,
  input: {
    agentId: CbeAgentId;
    taskKind: CbeTaskKind;
    targetSummary?: string;
    estimatedCostUsd?: number;
    metadataJson?: Record<string, unknown>;
  },
) {
  const estimatedCostUsd = moneyUsd(input.estimatedCostUsd ?? 0);
  if (estimatedCostUsd <= 0) return { allowed: true as const };

  const limits = await queryCbe<{
    id: string;
    period: CbeCostPeriod;
    limit_usd: string;
    enabled: boolean;
  }>(
    `
      select id, period, limit_usd::text as limit_usd, enabled
      from cbe_cost_limits
      where tenant_id = $1
        and user_id = $2
        and enabled = true
        and period = any($3::text[])
      order by
        case period
          when 'day' then 0
          when 'week' then 1
          when 'month' then 2
          else 3
        end
    `,
    [context.tenantId, context.userId, ENFORCED_EMPLOYEE_COST_LIMIT_PERIODS],
  );
  if (limits.rows.length === 0) return { allowed: true as const };

  for (const limit of limits.rows) {
    const spend = await queryCbe<{ spend_usd: string | null }>(
      `
        select coalesce(sum(
          case
            when coalesce(ledger.actual_cost_usd, 0) > 0 then ledger.actual_cost_usd
            else coalesce(ar.cost_usd_estimate, 0)
          end
        ), 0)::text as spend_usd
        from agent_runs ar
        left join lateral (
          select sum(cost_usd) filter (where cost_usd is not null) as actual_cost_usd
          from api_call_ledger acl
          where acl.tenant_id = ar.tenant_id
            and acl.agent_run_id = ar.id
        ) ledger on true
        where ar.tenant_id = $1
          and coalesce(ar.owner_user_id, ar.user_id) = $2
          ${limit.period === "day" ? "and ar.started_at >= date_trunc('day', now())" : ""}
          ${limit.period === "week" ? "and ar.started_at >= date_trunc('week', now())" : ""}
          ${limit.period === "month" ? "and ar.started_at >= date_trunc('month', now())" : ""}
      `,
      [context.tenantId, context.userId],
    );
    const allowance = await queryCbe<{ allowance_usd: string | null }>(
      `
        select coalesce(sum(amount_usd), 0)::text as allowance_usd
        from cbe_cost_allowances
        where tenant_id = $1
          and user_id = $2
          and period = $3
          and status = 'active'
          and (expires_at is null or expires_at > now())
      `,
      [context.tenantId, context.userId, limit.period],
    );
    const senturaCostSpendUsd = await getSenturaCostSpendForUserPeriod(context, context.userId, limit.period);
    const currentSpendUsd = moneyUsd(senturaCostSpendUsd ?? spend.rows[0]?.spend_usd);
    const activeAllowanceUsd = moneyUsd(allowance.rows[0]?.allowance_usd);
    const baseLimitUsd = moneyUsd(limit.limit_usd);
    const availableUsd = moneyUsd(baseLimitUsd + activeAllowanceUsd);
    const projectedUsd = moneyUsd(currentSpendUsd + estimatedCostUsd);
    if (projectedUsd - availableUsd > COST_EPSILON_USD) {
      const requestedAllowanceUsd = moneyUsd(Math.max(0, projectedUsd - availableUsd));
      const existing = await queryCbe<{ id: string }>(
        `
          select id
          from cbe_cost_approval_requests
          where tenant_id = $1
            and user_id = $2
            and period = $3
            and status = 'pending'
          order by created_at desc
          limit 1
        `,
        [context.tenantId, context.userId, limit.period],
      );
      const approvalId = existing.rows[0]?.id ?? createCbeId("cost_approval");
      if (existing.rows[0]) {
        await queryCbe(
          `
            update cbe_cost_approval_requests
            set
              agent_id = $4,
              task_kind = $5,
              target_summary = $6,
              estimated_cost_usd = $7,
              current_spend_usd = $8,
              base_limit_usd = $9,
              active_allowance_usd = $10,
              requested_allowance_usd = greatest(requested_allowance_usd, $11),
              metadata_json = metadata_json || $12::jsonb
            where tenant_id = $1
              and user_id = $2
              and period = $3
              and status = 'pending'
          `,
          [
            context.tenantId,
            context.userId,
            limit.period,
            input.agentId,
            input.taskKind,
            input.targetSummary ?? null,
            estimatedCostUsd,
            currentSpendUsd,
            baseLimitUsd,
            activeAllowanceUsd,
            requestedAllowanceUsd,
            JSON.stringify(input.metadataJson ?? {}),
          ],
        );
      } else {
        await queryCbe(
          `
            insert into cbe_cost_approval_requests (
              id,
              tenant_id,
              user_id,
              agent_id,
              task_kind,
              target_summary,
              estimated_cost_usd,
              period,
              current_spend_usd,
              base_limit_usd,
              active_allowance_usd,
              requested_allowance_usd,
              requested_by_user_id,
              metadata_json
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $3, $13::jsonb)
          `,
          [
            approvalId,
            context.tenantId,
            context.userId,
            input.agentId,
            input.taskKind,
            input.targetSummary ?? null,
            estimatedCostUsd,
            limit.period,
            currentSpendUsd,
            baseLimitUsd,
            activeAllowanceUsd,
            requestedAllowanceUsd,
            JSON.stringify(input.metadataJson ?? {}),
          ],
        );
      }
      throw new CbeStoreError(
        402,
        "cost_approval_required",
        "当前任务会超过成本限额，已提交管理者审批。",
        {
          approvalId,
          period: limit.period,
          currentSpendUsd,
          baseLimitUsd,
          activeAllowanceUsd,
          estimatedCostUsd,
          requestedAllowanceUsd,
        },
      );
    }
  }
  return { allowed: true as const };
}
