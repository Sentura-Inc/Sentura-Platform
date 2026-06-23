"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { productLabel } from "@/components/cross-border/customer-labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminCustomerReportButton } from "../_components/customer-list-table";
import { fetchHighValueCustomers, type AdminCustomerRow } from "../_data/admin-api";
import { cn } from "@/lib/utils";

function highlightFrameClass(active: boolean) {
  return active
    ? "animate-pulse bg-sky-50/60 outline outline-2 -outline-offset-2 outline-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.22)]"
    : "";
}

function AdminHighValueCustomersContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AdminCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedHighlights, setDismissedHighlights] = useState<Set<string>>(() => new Set());
  const highlightedCustomerId = searchParams.get("highlightCustomer");

  const stats = useMemo(() => {
    const avgScore = items.length
      ? items.reduce((sum, item) => sum + (item.normalizedScore ?? 0), 0) / items.length
      : 0;
    return { count: items.length, avgScore };
  }, [items]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHighValueCustomers();
      setItems(result.items.filter((item) => (item.normalizedScore ?? 0) >= 80));
    } catch (err) {
      setError(err instanceof Error ? err.message : "优先跟进客户加载失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!highlightedCustomerId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`high-value-${highlightedCustomerId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [highlightedCustomerId, items.length]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">优先跟进客户</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            汇总各员工背调后建议优先跟进的客户。
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
          <CardHeader><CardTitle>客户数</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.count}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>平均评分</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.avgScore.toFixed(1)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>入选规则</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 text-amber-600" />
            评分 80 分及以上，建议优先跟进
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户</TableHead>
                <TableHead>国家</TableHead>
                <TableHead>产品</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>评分</TableHead>
                <TableHead>背调时间</TableHead>
                <TableHead>报告</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const activeHighlight = highlightedCustomerId === item.recordId && !dismissedHighlights.has(item.recordId);
                return (
                <TableRow
                  id={`high-value-${item.recordId}`}
                  key={item.recordId}
                  className={cn(highlightFrameClass(activeHighlight))}
                  onClick={() => {
                    if (activeHighlight) {
                      setDismissedHighlights((current) => new Set(current).add(item.recordId));
                    }
                  }}
                >
                  <TableCell>
                    <div className="font-medium">{item.companyName}</div>
                    <div className="text-xs text-muted-foreground">{item.domain ?? item.website ?? item.recordId}</div>
                  </TableCell>
                  <TableCell>{item.country ?? "-"}</TableCell>
                  <TableCell>{item.matchedProducts?.slice(0, 3).map(productLabel).join("、") || "-"}</TableCell>
                  <TableCell>
                    <div>{item.ownerName ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{item.teamName ?? ""}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.normalizedScore ?? "-"}</Badge>
                  </TableCell>
                  <TableCell>{new Date(item.updatedAt).toLocaleString("zh-CN")}</TableCell>
                  <TableCell><AdminCustomerReportButton customer={item} triggerLabel="查看报告" /></TableCell>
                </TableRow>
                );
              })}
              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">暂无优先跟进客户。</TableCell>
                </TableRow>
              ) : null}
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">正在加载优先跟进客户...</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
