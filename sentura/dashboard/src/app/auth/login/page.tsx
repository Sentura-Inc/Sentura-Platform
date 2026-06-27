"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { LoginWelcomeHeader } from "@/components/cross-border/brand-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CBE_EMPLOYEE_HOME_PATH,
  CBE_EMPLOYEE_LOGIN_PATH,
  isCbeEmployeePath,
} from "@/lib/cross-border-routes";

export default function LoginPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!displayName.trim() || !password) {
      setError("请输入员工姓名和密码。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "登录失败。");
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && isCbeEmployeePath(next) && !next.startsWith(CBE_EMPLOYEE_LOGIN_PATH)
        ? next
        : body.redirectTo ?? CBE_EMPLOYEE_HOME_PATH);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-4xl items-center justify-center px-4">
      <Card className="sentura-login-card w-full max-w-md backdrop-blur-xl">
        <CardHeader className="gap-0 px-7 pb-5 pt-8">
          <LoginWelcomeHeader systemTitle="跨境电商员工操作系统" />
        </CardHeader>
        <CardContent className="space-y-3 px-7 pb-8">
          <Input
            autoComplete="username"
            placeholder="员工姓名"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
          <Input
            autoComplete="current-password"
            type="password"
            placeholder="密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
          {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
          <Button className="h-9 w-full" onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            登录
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
