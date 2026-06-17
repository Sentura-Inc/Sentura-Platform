import { queryCbe } from "./db";
import type { ListQuery, TenantContext } from "./schemas";
import { listEmployeeCustomers } from "./customers";

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
    costUsdEstimate: Number(row.cost_usd_estimate ?? 0),
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
        p.display_name,
        p.team_name,
        p.status,
        coalesce(sum(w.run_count), 0)::text as run_count,
        coalesce(sum(w.completed_count), 0)::text as completed_count,
        coalesce(sum(w.failed_count), 0)::text as failed_count,
        coalesce(sum(w.cost_usd_estimate), 0)::text as cost_usd_estimate
      from cbe_user_profiles p
      left join cbe_operator_workload_daily w
        on w.tenant_id = p.tenant_id
       and w.owner_user_id = p.user_id
      where p.tenant_id = $1
        and p.cbe_role = 'operator'
      group by p.user_id, p.display_name, p.team_name, p.status
      order by p.display_name
    `,
    [context.tenantId],
  );
  return { items: result.rows };
}

export async function getAdminOperator(context: TenantContext, operatorId: string) {
  const profile = await queryCbe(
    `
      select user_id, display_name, team_name, status
      from cbe_user_profiles
      where tenant_id = $1
        and user_id = $2
        and cbe_role = 'operator'
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
  return { profile: profile.rows[0] ?? null, workload: workload.rows };
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
  return { items: result.rows };
}
