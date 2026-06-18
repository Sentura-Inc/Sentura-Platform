"use client";

type JsonRecord = Record<string, unknown>;

const CBE_ADMIN_USER_ID = process.env.NEXT_PUBLIC_CBE_ADMIN_USER_ID?.trim();

export interface AdminOperatorRow extends JsonRecord {
  user_id: string;
  display_name: string;
  email?: string | null;
  team_name?: string | null;
  status: string;
}

export interface AdminCustomerRow {
  recordType: string;
  recordId: string;
  companyName: string;
  country: string | null;
  buyerType: string | null;
  domain: string | null;
  matchedProducts: string[];
  website: string | null;
  screeningStatus: string;
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
}

export interface AdminApprovalRow extends JsonRecord {
  id: string;
  user_id: string;
  display_name: string;
  task_kind: string;
  target_summary: string | null;
  requested_allowance_usd: string;
  estimated_cost_usd: string;
  period: string;
  created_at: string;
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
      if (!window.location.pathname.startsWith("/client-demos/cross-border/admin/login")) {
        window.location.assign(`/client-demos/cross-border/admin/login?next=${encodeURIComponent(next)}`);
      }
    }
    throw new Error(typeof error.message === "string" ? error.message : `请求失败：${response.status}`);
  }
  return body as T;
}

export function fetchAdminOperators() {
  return adminFetch<{ items: AdminOperatorRow[] }>("/api/client-demos/cross-border/admin/operators");
}

export function createAdminOperator(input: {
  display_name: string;
  password: string;
  team_name?: string;
  initial_limits: Array<{ period: string; limit_usd: number; enabled: boolean }>;
}) {
  return adminFetch<{ operator: AdminOperatorRow; loginToken?: string; tokenDisplayPolicy?: string }>(
    "/api/client-demos/cross-border/admin/operators",
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
  return adminFetch(`/api/client-demos/cross-border/admin/operators/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAdminOperator(id: string) {
  return adminFetch<{ operator: AdminOperatorRow }>(
    `/api/client-demos/cross-border/admin/operators/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function fetchAdminOperator(id: string) {
  return adminFetch<{
    profile: AdminOperatorRow | null;
    workload: JsonRecord[];
    customers: AdminCustomerRow[];
    costEvents: JsonRecord[];
  }>(`/api/client-demos/cross-border/admin/operators/${encodeURIComponent(id)}`);
}

export function fetchHighValueCustomers() {
  return adminFetch<{ items: AdminCustomerRow[] }>("/api/client-demos/cross-border/admin/high-value-customers?limit=100&range=all");
}

export function fetchAdminCosts(range: string) {
  return adminFetch<{
    period: string;
    range: string;
    pool: JsonRecord;
    items: AdminCostRow[];
    approvals: AdminApprovalRow[];
  }>(`/api/client-demos/cross-border/admin/costs?range=${encodeURIComponent(range)}`);
}

export function updateAdminCostLimit(input: { user_id: string; period: string; limit_usd: number; enabled: boolean }) {
  return adminFetch("/api/client-demos/cross-border/admin/cost-limits", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateAdminCostAllowance(input: { user_id: string; period: string; amount_usd: number }) {
  return adminFetch("/api/client-demos/cross-border/admin/cost-allowances", {
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
  return adminFetch("/api/client-demos/cross-border/admin/cost-approvals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
