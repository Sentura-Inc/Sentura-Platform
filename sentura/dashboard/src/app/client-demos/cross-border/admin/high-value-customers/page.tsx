"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Star, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminCustomerListTable } from "../_components/customer-list-table";
import { fetchAllAdminCustomers, type AdminCustomerRow } from "../_data/admin-api";

function isScreenedCustomer(item: AdminCustomerRow) {
  return Boolean(
    item.latestScreeningReportId ||
    item.reportJson ||
    typeof item.normalizedScore === "number" ||
    item.leadStatus === "screened",
  );
}

function isPriorityCustomer(item: AdminCustomerRow) {
  return isScreenedCustomer(item) && (item.normalizedScore ?? 0) >= 80;
}

function AdminHighValueCustomersContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AdminCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const highlightedCustomerId = searchParams.get("highlightCustomer");

  const stats = useMemo(() => {
    const screened = items.filter(isScreenedCustomer);
    const priority = screened.filter(isPriorityCustomer);
    const other = screened.filter((item) => !isPriorityCustomer(item));
    const avgScore = screened.length
      ? screened.reduce((sum, item) => sum + (item.normalizedScore ?? 0), 0) / screened.length
      : 0;
    return { screened, priority, other, avgScore };
  }, [items]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllAdminCustomers();
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "客户列表加载失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initialLoad);
  }, []);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">客户列表</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看所有员工已完成背调的客户，并按优先跟进与其他客户分组管理。
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          刷新
        </Button>
      </section>

      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card size="sm">
          <CardHeader><CardTitle>已背调客户</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <UsersRound className="h-5 w-5 text-primary" />
            {stats.screened.length}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>平均评分</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.avgScore.toFixed(1)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>优先跟进</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 text-amber-600" />
            {stats.priority.length} 个客户，评分 80 分及以上
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在加载客户列表
        </div>
      ) : (
        <div className="space-y-5">
          <AdminCustomerListTable
            customers={stats.priority}
            title="优先跟进客户"
            description="评分 80 分及以上，建议优先跟进。"
            showStatusFilters={false}
            storageKeyPrefix="sentura:cbe:admin:priority-customers"
            highlightedCustomerId={highlightedCustomerId}
          />
          <AdminCustomerListTable
            customers={stats.other}
            title="其他客户"
            description="已完成背调但不满足优先跟进规则的客户。"
            showStatusFilters={false}
            storageKeyPrefix="sentura:cbe:admin:other-customers"
            highlightedCustomerId={highlightedCustomerId}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminHighValueCustomersPage() {
  return (
    <Suspense fallback={null}>
      <AdminHighValueCustomersContent />
    </Suspense>
  );
}
