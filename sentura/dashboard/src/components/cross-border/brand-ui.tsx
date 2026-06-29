"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatedLoginGreeting } from "./login-greeting-effects";

const DEFAULT_PAGE_SIZE = 10;

export function LoginWelcomeHeader({ systemTitle }: { systemTitle: string }) {
  return (
    <div className="w-full">
      <div className="flex justify-center">
        <Image
          src="/logo-full.svg"
          alt="Sentura"
          width={129}
          height={156}
          priority
          className="h-[4.5rem] w-auto sm:h-20"
          style={{ width: "auto" }}
        />
      </div>
      <div className="mt-5 text-center">
        <h1 className="sentura-login-greeting-title text-[1.82rem] font-semibold leading-tight sm:text-[2.18rem]">
          <AnimatedLoginGreeting />
        </h1>
        <div className="sentura-login-system-title mt-3 text-center text-[0.95rem] font-semibold text-slate-700 sm:text-base">
          {systemTitle}
        </div>
      </div>
    </div>
  );
}

interface ListPaginationProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function ListPagination({
  page,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  className,
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className={cn("flex flex-col gap-2 border-t pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        显示 {start}-{end} / {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          aria-label="上一页"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          上一页
        </Button>
        <span className="min-w-20 text-center text-xs">
          第 {page} / {totalPages} 页
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          aria-label="下一页"
          onClick={() => onPageChange(page + 1)}
        >
          下一页
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface UsePagedItemsOptions {
  resetKey?: string | number | boolean | null;
}

export function usePagedItems<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE, options: UsePagedItemsOptions = {}) {
  const resetKey = options.resetKey;
  const [pageState, setPageState] = useState(() => ({ page: 1, resetKey }));
  const resetPending = pageState.resetKey !== resetKey;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, resetPending ? 1 : pageState.page), totalPages);

  useEffect(() => {
    if (!resetPending) return;
    const timeoutId = window.setTimeout(() => {
      setPageState({ page: 1, resetKey });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [resetKey, resetPending]);

  const setPage = useCallback((nextPage: number) => {
    setPageState({ page: Math.min(Math.max(1, nextPage), totalPages), resetKey });
  }, [resetKey, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    items: pageItems,
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
    setPage,
  };
}
