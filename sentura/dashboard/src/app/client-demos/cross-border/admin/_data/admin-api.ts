"use client";

import {
  CBE_ADMIN_API_BASE,
  CBE_ADMIN_LOGIN_PATH,
} from "@/lib/cross-border-routes";
import type { CostEvent } from "@/lib/gateway";
import type { LeadFilterSettings } from "@/lib/cross-border-lead-settings";
import type { CbeTrialLimitsSnapshot } from "@/lib/cross-border-trial-limits";
import type { MemoryRecordItem } from "../../employee/_data/employee-data";

type JsonRecord = Record<string, unknown>;

const CBE_ADMIN_USER_ID = process.env.NEXT_PUBLIC_CBE_ADMIN_USER_ID?.trim();

export interface AdminOperatorRow extends JsonRecord {
  user_id: string;
  display_name: string;
  email?: string | null;
  team_name?: string | null;
  status: string;
  all_chat_record_count?: string | number | null;
  all_chat_customer_count?: string | number | null;
}

export interface AdminCustomerRow {
  recordType: string;
  recordId: string;
  companyName: string;
  country: string | null;
  countryName?: string | null;
  buyerType: string | null;
  domain: string | null;
  matchedProducts: string[];
  leadQueryCountries?: string[];
  website: string | null;
  leadStatus?: string | null;
  screeningStatus: string;
  latestScreeningReportId?: string | null;
  normalizedScore: number | null;
  evidenceCoverage: number | null;
  recommendedAction: string | null;
  reportJson: JsonRecord | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  teamName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCostRow extends JsonRecord {
  user_id: string;
  display_name: string;
  spend_usd: number;
  actual_cost_usd: number;
  estimated_cost_usd: number;
  base_limit_usd: number;
  active_allowance_usd: number;
  remaining_usd: number;
  pending_approval_count: number;
  active_task_count: number;
  unpriced_call_count: number;
  total_call_count?: number;
  cost_period_start?: string | null;
  cost_period_end?: string | null;
}

export interface AdminApprovalRow extends JsonRecord {
  id: string;
  user_id: string;
  display_name: string;
  task_kind: string;
  target_summary: string | null;
  request_kind?: string | null;
  request_reason?: string | null;
  requested_allowance_usd: string;
  estimated_cost_usd: string;
  period: string;
  created_at: string;
}

interface ApiMemoryRecord {
  importId: string;
  summaryId?: string | null;
  agentRunId?: string | null;
  agentRunStatus?: string | null;
  sourceFileName?: string | null;
  sourceKind?: string | null;
  companyName?: string | null;
  country?: string | null;
  conversationCount: number;
  customerProfile?: Record<string, unknown> | null;
  purchaseIntent?: Record<string, unknown>[];
  negotiatedPrices?: Record<string, unknown>[];
  nextActions: string[];
  behaviorSignals?: Record<string, unknown> | null;
  memoryFactStatus?: string | null;
  validationStatus?: string | null;
  uploadedAt: string;
  summaryText?: string | null;
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (CBE_ADMIN_USER_ID && !headers.has("x-cbe-admin-user-id")) {
    headers.set("x-cbe-admin-user-id", CBE_ADMIN_USER_ID);
  }

  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = typeof body?.error === "object" ? body.error : {};
    if ((response.status === 401 || response.status === 403) && typeof window !== "undefined") {
      const next = `${window.location.pathname}${window.location.search}`;
      if (!window.location.pathname.startsWith(CBE_ADMIN_LOGIN_PATH)) {
        window.location.assign(`${CBE_ADMIN_LOGIN_PATH}?next=${encodeURIComponent(next)}`);
      }
    }
    throw new Error(typeof error.message === "string" ? error.message : `请求失败：${response.status}`);
  }
  return body as T;
}

export function fetchAdminOperators() {
  return adminFetch<{ items: AdminOperatorRow[] }>(`${CBE_ADMIN_API_BASE}/operators`);
}

export function fetchAdminTrialLimits() {
  return adminFetch<{ trialLimits: CbeTrialLimitsSnapshot }>(`${CBE_ADMIN_API_BASE}/trial-limits`);
}

export function fetchAdminLeadFilterSettings() {
  return adminFetch<{ settings: LeadFilterSettings }>(`${CBE_ADMIN_API_BASE}/lead-filter-settings`);
}

export function updateAdminLeadFilterSettings(input: LeadFilterSettings) {
  return adminFetch<{ settings: LeadFilterSettings }>(
    `${CBE_ADMIN_API_BASE}/lead-filter-settings`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function createAdminOperator(input: {
  display_name: string;
  password: string;
  team_name?: string;
  initial_limits: Array<{ period: string; limit_usd: number; enabled: boolean }>;
}) {
  return adminFetch<{ operator: AdminOperatorRow; loginToken?: string; tokenDisplayPolicy?: string }>(
    `${CBE_ADMIN_API_BASE}/operators`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateAdminOperator(
  id: string,
  input: {
    status?: "active" | "suspended";
    display_name?: string;
    team_name?: string | null;
    password?: string;
  },
) {
  return adminFetch(`${CBE_ADMIN_API_BASE}/operators/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateAdminOwnPassword(input: { current_password: string; new_password: string }) {
  return adminFetch<{ ok: true }>(`${CBE_ADMIN_API_BASE}/profile/password`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAdminOperator(id: string) {
  return adminFetch<{ operator: AdminOperatorRow }>(
    `${CBE_ADMIN_API_BASE}/operators/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function deleteAdminOperators(userIds: string[]) {
  return adminFetch<{ items: Array<{ operator: AdminOperatorRow }> }>(
    "/api/client-demos/cross-border/admin/operators",
    { method: "DELETE", body: JSON.stringify({ user_ids: userIds }) },
  );
}

export function fetchAdminOperator(id: string) {
  return adminFetch<{
    profile: AdminOperatorRow | null;
    workload: JsonRecord[];
    customers: AdminCustomerRow[];
    costEvents: CostEvent[];
    costEventsSource?: "sentura_cost" | "db_fallback";
  }>(`${CBE_ADMIN_API_BASE}/operators/${encodeURIComponent(id)}`);
}

function memorySourceFromKind(sourceKind?: string | null, sourceFileName?: string | null): MemoryRecordItem["source"] {
  if (sourceKind === "manual_json" || sourceKind === "manual_text" || sourceKind === "manual_image") {
    return "manual_import";
  }
  if (sourceKind === "alibaba_international") return "alibaba_international";
  if (sourceKind === "demo_data") return "demo_data";
  if (sourceFileName?.toLowerCase().includes("alibaba")) return "alibaba_international";
  return "accio";
}

function memoryFromApi(record: ApiMemoryRecord): MemoryRecordItem {
  const analyzed = Boolean(record.summaryId);
  return {
    recordId: record.summaryId ?? record.importId,
    importId: record.importId,
    name: record.companyName ?? record.sourceFileName ?? "未命名聊天记录",
    source: memorySourceFromKind(record.sourceKind, record.sourceFileName),
    importedAt: record.uploadedAt,
    analysisStatus: analyzed
      ? "analyzed"
      : record.agentRunStatus === "failed" || record.validationStatus === "failed"
        ? "failed"
        : record.agentRunStatus === "running" || record.agentRunStatus === "polling"
          ? "running"
          : "not_started",
    conversationCount: record.conversationCount,
    reportId: analyzed ? record.summaryId ?? undefined : undefined,
    latestAgentRunId: record.agentRunId ?? undefined,
    memoryPreviewStatus:
      record.memoryFactStatus === "approved" || record.memoryFactStatus === "rejected"
        ? record.memoryFactStatus
        : "preview_only",
    summary:
      record.summaryText ??
      record.nextActions[0] ??
      (analyzed ? "记忆员工已生成结构化摘要。" : "已导入，等待记忆员工分析后生成分析报告。"),
    country: record.country ?? undefined,
    customerProfile: record.customerProfile ?? undefined,
    purchaseIntent: record.purchaseIntent ?? [],
    negotiatedPrices: record.negotiatedPrices ?? [],
    behaviorSignals: record.behaviorSignals ?? undefined,
    nextActions: record.nextActions,
    companyName: record.companyName ?? undefined,
  };
}

export async function fetchAdminOperatorMemoryRecords(id: string) {
  const page = await adminFetch<{ items: ApiMemoryRecord[] }>(
    `${CBE_ADMIN_API_BASE}/operators/${encodeURIComponent(id)}/memory`,
  );
  return page.items.map(memoryFromApi);
}

export function fetchAdminOperatorMemoryImportPayload(operatorId: string, importId: string) {
  return adminFetch<unknown>(
    `${CBE_ADMIN_API_BASE}/operators/${encodeURIComponent(operatorId)}/memory/imports/${encodeURIComponent(importId)}`,
  );
}

export function fetchHighValueCustomers() {
  return adminFetch<{ items: AdminCustomerRow[] }>(`${CBE_ADMIN_API_BASE}/high-value-customers?limit=100&range=all`);
}

export async function fetchAllAdminCustomers() {
  const allItems: AdminCustomerRow[] = [];
  let offset = 0;
  const limit = 100;
  for (let page = 0; page < 20; page += 1) {
    const result = await adminFetch<{ items: AdminCustomerRow[]; limit: number; offset: number }>(
      `/api/client-demos/cross-border/admin/customers?limit=${limit}&offset=${offset}&range=all`,
    );
    allItems.push(...result.items);
    if (result.items.length < limit) break;
    offset += limit;
  }
  return { items: allItems };
}

export function fetchAdminCosts(range: string) {
  return adminFetch<{
    period: string;
    range: string;
    pool: JsonRecord;
    items: AdminCostRow[];
    approvals: AdminApprovalRow[];
  }>(`${CBE_ADMIN_API_BASE}/costs?range=${encodeURIComponent(range)}`);
}

export function updateAdminCostLimit(input: { user_id: string; period: string; limit_usd: number; enabled: boolean }) {
  return adminFetch(`${CBE_ADMIN_API_BASE}/cost-limits`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateAdminCostAllowance(input: { user_id: string; period: string; amount_usd: number }) {
  return adminFetch(`${CBE_ADMIN_API_BASE}/cost-allowances`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function decideCostApproval(input: {
  request_id: string;
  decision: "approved" | "rejected";
  approved_amount_usd?: number;
  decision_note?: string;
}) {
  return adminFetch(`${CBE_ADMIN_API_BASE}/cost-approvals`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
