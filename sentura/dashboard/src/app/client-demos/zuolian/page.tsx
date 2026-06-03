"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  BatteryCharging,
  CalendarDays,
  Car,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Hotel,
  Loader2,
  MapPin,
  Plane,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AgentChat, type AgentChatHandle, type ToolCallEvent } from "@/components/agent-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/lib/gateway";
import { cn } from "@/lib/utils";

const AGENT_ID = "zuolian-travel-concierge";
const SESSION_STORAGE_KEY = "sentura:client-demo:zuolian:session-key";
const HIDDEN_SEED_PREFIX = "[座联互动 Demo 扫码上下文]";

const scanContext = {
  event: "charging_qr_scanned",
  scenario: "airport_to_shenzhen",
  userLocation: "深圳宝安国际机场",
  destinationCity: "深圳",
  chargingStation: "SZX-A01",
  detectedAt: "2026-06-02T16:00:00+08:00",
  language: "zh-CN",
};

const seedMessage = `${HIDDEN_SEED_PREFIX}
请根据以下模拟扫码充电上下文，主动向用户发出第一条简体中文客服问候。不要把本条消息当作用户旅行需求，也不要暴露“seed message”或内部实现。

扫码上下文:
${JSON.stringify(scanContext, null, 2)}

问候必须说明你是座联互动 AI 出行客服，看到用户刚在机场扫码充电，可以帮 TA 规划深圳行程、查询酒店/接送/景点方案。`;

type StepStatus = "idle" | "active" | "done" | "error";

interface FlowStep {
  id: string;
  label: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  status: StepStatus;
  toolNames: string[];
}

interface OrderSnapshot {
  bookingId?: string;
  referenceNo?: string;
  status?: number;
  statusName?: string;
  updatedAt?: number;
}

const baseSteps: FlowStep[] = [
  {
    id: "hotel",
    label: "酒店候选",
    detail: "Dida Demo PriceSearch",
    icon: Hotel,
    status: "idle",
    toolNames: ["dida_demo_search_hotels"],
  },
  {
    id: "transfer",
    label: "机场接送",
    detail: "本地专车 fixture",
    icon: Car,
    status: "idle",
    toolNames: ["dida_demo_search_transfer"],
  },
  {
    id: "attraction",
    label: "景点候选",
    detail: "本地票务 fixture",
    icon: MapPin,
    status: "idle",
    toolNames: ["dida_demo_search_attractions"],
  },
  {
    id: "web",
    label: "公开信息",
    detail: "天气/开放时间/交通补充",
    icon: Search,
    status: "idle",
    toolNames: ["web_search", "web_fetch"],
  },
  {
    id: "confirm",
    label: "价格确认",
    detail: "PriceConfirm(preBook=true)",
    icon: CheckCircle2,
    status: "idle",
    toolNames: ["dida_demo_price_confirm"],
  },
  {
    id: "booking",
    label: "模拟预订",
    detail: "BookingConfirm",
    icon: ShieldCheck,
    status: "idle",
    toolNames: ["dida_demo_book_hotel"],
  },
  {
    id: "status",
    label: "订单查询",
    detail: "BookingSearch",
    icon: Clock3,
    status: "idle",
    toolNames: ["dida_demo_get_booking"],
  },
];

const quickActions = [
  {
    label: "制定 5 日深圳旅游攻略",
    icon: CalendarDays,
    message: "我刚在深圳宝安国际机场扫码充电，准备去深圳市区玩。为我制定 5 日深圳旅游攻略。",
  },
  {
    label: "预算低一点",
    icon: Sparkles,
    message: "预算低一点，住得方便就行，不要太赶。请在保留已确认约束的基础上优化方案。",
  },
  {
    label: "住海边",
    icon: MapPin,
    message: "我想住离海边近一点，帮我改一版，并重新说明酒店和交通预算。",
  },
  {
    label: "确认并预订",
    icon: CheckCircle2,
    message:
      "就按第二版订吧。入住人是 Zhang Wei，电话 13800000000，邮箱 zhangwei@example.com。请完成模拟酒店预订并查询订单状态。",
  },
  {
    label: "查询订单",
    icon: Search,
    message: "请查询刚才的模拟酒店订单状态，并用中文解释当前 Dida 状态是否为最终状态。",
  },
];

function mask(value: string | undefined): string {
  if (!value) return "未生成";
  if (value.length <= 10) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function resultText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(resultText).join("\n");
  if (typeof value === "object") {
    const maybeContent = (value as { content?: unknown }).content;
    if (maybeContent) return resultText(maybeContent);
    const maybeText = (value as { text?: unknown }).text;
    if (typeof maybeText === "string") return maybeText;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function extractOrderSnapshot(value: unknown): OrderSnapshot | null {
  const text = resultText(value);
  if (!text) return null;
  const bookingId =
    text.match(/"bookingId"\s*:\s*"([^"]+)"/)?.[1] ??
    text.match(/\b(DIDATEST-[A-Z0-9-]+)\b/)?.[1];
  const referenceNo =
    text.match(/"referenceNo"\s*:\s*"([^"]+)"/)?.[1] ??
    text.match(/\b(REF-[A-Z0-9-]+)\b/)?.[1];
  const statusText = text.match(/"status"\s*:\s*(\d)/)?.[1];
  const statusName = text.match(/"statusName"\s*:\s*"([^"]+)"/)?.[1];
  if (!bookingId && !referenceNo && statusText === undefined && !statusName) {
    return null;
  }
  return {
    bookingId,
    referenceNo,
    status: statusText === undefined ? undefined : Number(statusText),
    statusName,
    updatedAt: Date.now(),
  };
}

function statusLabel(status: StepStatus): string {
  if (status === "done") return "完成";
  if (status === "active") return "进行中";
  if (status === "error") return "异常";
  return "等待";
}

export default function ZuolianClientDemoPage() {
  const { client, state } = useGateway();
  const chatRef = useRef<AgentChatHandle | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>(baseSteps);
  const [order, setOrder] = useState<OrderSnapshot | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);

  const completedCount = useMemo(
    () => steps.filter((step) => step.status === "done").length,
    [steps],
  );

  const createDemoSession = useCallback(async () => {
    const result = await client.createSession(AGENT_ID, seedMessage, {
      label: "座联互动 Demo - 机场扫码 5日深圳游",
    });
    if (!result?.key) {
      throw new Error("Gateway did not return a session key");
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, result.key);
    setSessionKey(result.key);
  }, [client]);

  useEffect(() => {
    if (state !== "connected") return;
    let cancelled = false;
    (async () => {
      setInitializing(true);
      setInitError(null);
      try {
        const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          try {
            await client.getSession(stored);
            if (!cancelled) setSessionKey(stored);
            return;
          } catch {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
        if (!cancelled) {
          await createDemoSession();
        }
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Demo session initialization failed";
        if (!cancelled) setInitError(message);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, createDemoSession, state]);

  const resetDemo = useCallback(async () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionKey(null);
    setSteps(baseSteps);
    setOrder(null);
    setLastTool(null);
    setInitializing(true);
    setInitError(null);
    try {
      await createDemoSession();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Could not restart demo session";
      setInitError(message);
    } finally {
      setInitializing(false);
    }
  }, [createDemoSession]);

  const handleToolCall = useCallback((event: ToolCallEvent) => {
    setLastTool(event.toolName);
    setSteps((current) =>
      current.map((step) => {
        const matches = step.toolNames.some((name) => event.toolName.includes(name));
        if (!matches) return step;
        const status: StepStatus =
          event.phase === "start"
            ? "active"
            : event.phase === "error"
              ? "error"
              : "done";
        return { ...step, status };
      }),
    );
    if (event.phase === "result") {
      const snapshot = extractOrderSnapshot(event.result);
      if (snapshot) {
        setOrder((current) => ({ ...current, ...snapshot }));
      }
    }
  }, []);

  const sendQuickAction = useCallback(async (message: string) => {
    if (state !== "connected") return;
    if (chatRef.current) {
      await chatRef.current.sendMessage(message);
    }
  }, [state]);

  const ready = state === "connected" && !!sessionKey && !initializing;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-iai-internal-soft text-iai-internal">
            <Plane className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              座联互动出行服务 Demo
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {"机场扫码充电上下文 -> AI 出行客服 -> Dida Demo 酒店预订链路"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={ready ? "default" : "outline"}>
            {ready ? "Demo 会话已就绪" : "正在连接"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void resetDemo()}
            disabled={state !== "connected" || initializing}
          >
            <RefreshCw className="h-4 w-4" />
            重开 Demo
          </Button>
        </div>
      </header>

      {initError && (
        <div className="shrink-0 border-b border-destructive/40 bg-destructive/5 px-6 py-2 text-sm text-destructive">
          {initError}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-b border-border bg-card/50 lg:border-b-0 lg:border-r">
          <div className="space-y-4 p-4">
            <section className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">扫码上下文</h2>
                <Badge variant="outline" className="font-mono">
                  {scanContext.chargingStation}
                </Badge>
              </div>
              <div className="space-y-3 text-sm">
                <ContextRow
                  icon={BatteryCharging}
                  label="触发事件"
                  value="交通站点扫码充电"
                />
                <ContextRow
                  icon={MapPin}
                  label="当前位置"
                  value={scanContext.userLocation}
                />
                <ContextRow
                  icon={Plane}
                  label="目的地"
                  value={`${scanContext.destinationCity}市区`}
                />
                <ContextRow
                  icon={CalendarDays}
                  label="语言"
                  value="简体中文客服"
                />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">行程与工具状态</h2>
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{steps.length}
                </span>
              </div>
              <div className="space-y-2">
                {steps.map((step) => (
                  <FlowStepRow key={step.id} step={step} />
                ))}
              </div>
              {lastTool && (
                <p className="mt-3 truncate text-xs text-muted-foreground">
                  最近工具: <span className="font-mono">{lastTool}</span>
                </p>
              )}
            </section>

            <section className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">订单状态</h2>
                <Badge
                  variant={order?.status === 2 ? "default" : "outline"}
                  className="font-mono"
                >
                  {order?.status === undefined
                    ? "未生成"
                    : `${order.status} ${order.statusName ?? ""}`.trim()}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <StatusLine label="BookingID" value={mask(order?.bookingId)} />
                <StatusLine label="ReferenceNo" value={mask(order?.referenceNo)} />
                <StatusLine
                  label="最终状态"
                  value={order?.status === 2 ? "已确认" : "等待 BookingSearch"}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Demo 仅使用 fixture 模拟预订。只有 Dida 状态码 2 Confirmed
                才能向用户说明“预订已确认”。
              </p>
            </section>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!ready}
                  onClick={() => void sendQuickAction(action.message)}
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          {initializing || !sessionKey ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在注入扫码上下文并生成主动问候...
            </div>
          ) : (
            <AgentChat
              ref={chatRef}
              agentId={AGENT_ID}
              sessionKey={sessionKey}
              hiddenUserPrefixes={[HIDDEN_SEED_PREFIX]}
              sessionLabel="座联互动 Demo - 机场扫码 5日深圳游"
              onSessionCreated={(key) => {
                window.localStorage.setItem(SESSION_STORAGE_KEY, key);
                setSessionKey(key);
              }}
              onToolCall={handleToolCall}
              emptyState={<DemoEmptyState />}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ContextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </div>
  );
}

function FlowStepRow({ step }: { step: FlowStep }) {
  const Icon = step.icon;
  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          step.status === "done" && "bg-iai-internal-soft text-iai-internal",
          step.status === "active" && "bg-iai-external-soft text-iai-external",
          step.status === "error" && "bg-destructive/10 text-destructive",
          step.status === "idle" && "bg-muted text-muted-foreground",
        )}
      >
        {step.status === "active" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : step.status === "error" ? (
          <CircleAlert className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{step.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {statusLabel(step.status)}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{step.detail}</p>
      </div>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-mono text-xs">{value}</span>
    </div>
  );
}

function DemoEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-iai-internal-soft text-iai-internal">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="text-base font-medium">等待座联 AI 客服主动问候</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        页面已注入机场扫码充电上下文。客服回复由
        zuolian-travel-concierge 生成，不在前端硬编码。
      </p>
    </div>
  );
}
