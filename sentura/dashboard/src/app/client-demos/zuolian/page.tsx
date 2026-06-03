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
const SESSION_STORAGE_KEY_PREFIX = "sentura:client-demo:zuolian:session-key";
const HIDDEN_SEED_PREFIX = "[座联互动 Demo 扫码上下文]";

interface AirportOption {
  code: string;
  city: string;
  cityZh: string;
  airportNameZh: string;
  chargingStation: string;
}

const airportOptions: AirportOption[] = [
  {
    code: "CAN",
    city: "Guangzhou",
    cityZh: "广州",
    airportNameZh: "广州白云国际机场",
    chargingStation: "CAN-GATE-A01",
  },
  {
    code: "PEK",
    city: "Beijing",
    cityZh: "北京",
    airportNameZh: "北京首都国际机场",
    chargingStation: "PEK-GATE-A01",
  },
  {
    code: "PVG",
    city: "Shanghai",
    cityZh: "上海",
    airportNameZh: "上海浦东国际机场",
    chargingStation: "PVG-GATE-A01",
  },
  {
    code: "HGH",
    city: "Hangzhou",
    cityZh: "杭州",
    airportNameZh: "杭州萧山国际机场",
    chargingStation: "HGH-GATE-A01",
  },
  {
    code: "HKG",
    city: "Hong Kong",
    cityZh: "香港",
    airportNameZh: "香港国际机场",
    chargingStation: "HKG-GATE-A01",
  },
  {
    code: "MFM",
    city: "Macau",
    cityZh: "澳门",
    airportNameZh: "澳门国际机场",
    chargingStation: "MFM-GATE-A01",
  },
  {
    code: "SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    airportNameZh: "深圳宝安国际机场",
    chargingStation: "SZX-GATE-A01",
  },
];

function findAirport(code: string) {
  return airportOptions.find((airport) => airport.code === code) ?? airportOptions[0];
}

function firstDifferentAirport(code: string) {
  return airportOptions.find((airport) => airport.code !== code) ?? airportOptions[0];
}

function buildScanContext(origin: AirportOption, destination: AirportOption) {
  return {
    event: "boarding_gate_qr_scanned",
    scenario: "origin_airport_gate_to_destination_airport",
    entryPlacement: "登机口扫码入口",
    userLocation: origin.airportNameZh,
    originAirportCode: origin.code,
    originCity: origin.cityZh,
    destinationAirport: destination.airportNameZh,
    destinationAirportCode: destination.code,
    destinationCity: destination.cityZh,
    chargingStation: origin.chargingStation,
    detectedAt: "2026-06-03T16:00:00+08:00",
    language: "zh-CN",
  };
}

function buildSeedMessage(origin: AirportOption, destination: AirportOption) {
  const scanContext = buildScanContext(origin, destination);
  return `${HIDDEN_SEED_PREFIX}
请根据以下模拟登机口扫码上下文，主动向用户发出第一条简体中文客服问候。不要把本条消息当作用户旅行需求，也不要暴露“seed message”或内部实现。

扫码上下文:
${JSON.stringify(scanContext, null, 2)}

问候必须说明你是座联互动 AI 出行客服，看到用户刚在${origin.airportNameZh}登机口扫码，目的地是${destination.airportNameZh}，可以帮 TA 规划${destination.cityZh}行程、查询酒店/接送/景点方案。`;
}

function buildSessionLabel(destination: AirportOption) {
  return `座联互动 Demo - 登机口扫码 ${destination.cityZh}5日游`;
}

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

interface HotelCandidate {
  hotelId: string;
  hotelNameZh: string;
  districtZh?: string;
  roomNameZh?: string;
  ratePlanId?: string;
  pricePerRoomCny?: number;
  estimatedTotalCny?: number;
  displaySummaryZh?: string;
}

interface HotelDetailSnapshot extends HotelCandidate {
  descriptionZh?: string;
  facilitiesZh?: string[];
  nearbyZh?: string[];
  addressZh?: string;
  starRating?: number;
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
    id: "hotelDetails",
    label: "酒店详情",
    detail: "Dida Content /hotel/details",
    icon: Hotel,
    status: "idle",
    toolNames: ["dida_demo_get_hotel_details"],
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

function parseToolJson(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const content = (value as { content?: unknown }).content;
    if (content) return parseToolJson(content);
    if ("hotels" in value || "bookingId" in value || "referenceNo" in value) {
      return value as Record<string, unknown>;
    }
  }
  const text = resultText(value);
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function toHotelCandidate(value: unknown): HotelCandidate | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.hotelId !== "string" || typeof item.hotelNameZh !== "string") {
    return null;
  }
  return {
    hotelId: item.hotelId,
    hotelNameZh: item.hotelNameZh,
    districtZh: typeof item.districtZh === "string" ? item.districtZh : undefined,
    roomNameZh: typeof item.roomNameZh === "string" ? item.roomNameZh : undefined,
    ratePlanId: typeof item.ratePlanId === "string" ? item.ratePlanId : undefined,
    pricePerRoomCny:
      typeof item.pricePerRoomCny === "number" ? item.pricePerRoomCny : undefined,
    estimatedTotalCny:
      typeof item.estimatedTotalCny === "number" ? item.estimatedTotalCny : undefined,
    displaySummaryZh:
      typeof item.displaySummaryZh === "string" ? item.displaySummaryZh : undefined,
  };
}

function extractHotelCandidates(value: unknown): HotelCandidate[] {
  const parsed = parseToolJson(value);
  const hotels = parsed?.hotels;
  if (!Array.isArray(hotels)) return [];
  return hotels.map(toHotelCandidate).filter((hotel): hotel is HotelCandidate => !!hotel);
}

function extractHotelDetail(value: unknown): HotelDetailSnapshot | null {
  const candidate = extractHotelCandidates(value)[0];
  if (!candidate) return null;
  const parsed = parseToolJson(value);
  const first = Array.isArray(parsed?.hotels) ? parsed.hotels[0] : null;
  if (!first || typeof first !== "object") return candidate;
  const item = first as Record<string, unknown>;
  return {
    ...candidate,
    descriptionZh:
      typeof item.descriptionZh === "string" ? item.descriptionZh : undefined,
    facilitiesZh: Array.isArray(item.facilitiesZh)
      ? item.facilitiesZh.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    nearbyZh: Array.isArray(item.nearbyZh)
      ? item.nearbyZh.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    addressZh: typeof item.addressZh === "string" ? item.addressZh : undefined,
    starRating: typeof item.starRating === "number" ? item.starRating : undefined,
  };
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
  const [initializing, setInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>(baseSteps);
  const [order, setOrder] = useState<OrderSnapshot | null>(null);
  const [hotelCandidates, setHotelCandidates] = useState<HotelCandidate[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<HotelDetailSnapshot | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);
  const [draftOriginAirportCode, setDraftOriginAirportCode] = useState("CAN");
  const [draftDestinationAirportCode, setDraftDestinationAirportCode] = useState("SZX");
  const [confirmedRoute, setConfirmedRoute] = useState<{ originCode: string; destinationCode: string } | null>(null);

  const draftOriginAirport = useMemo(() => findAirport(draftOriginAirportCode), [draftOriginAirportCode]);
  const draftDestinationAirport = useMemo(
    () => findAirport(draftDestinationAirportCode),
    [draftDestinationAirportCode],
  );
  const originAirport = useMemo(
    () => findAirport(confirmedRoute?.originCode ?? draftOriginAirportCode),
    [confirmedRoute, draftOriginAirportCode],
  );
  const destinationAirport = useMemo(
    () => findAirport(confirmedRoute?.destinationCode ?? draftDestinationAirportCode),
    [confirmedRoute, draftDestinationAirportCode],
  );
  const scanContext = useMemo(
    () => buildScanContext(draftOriginAirport, draftDestinationAirport),
    [draftOriginAirport, draftDestinationAirport],
  );
  const sessionStorageKey = useMemo(
    () => `${SESSION_STORAGE_KEY_PREFIX}:${originAirport.code}:${destinationAirport.code}`,
    [originAirport.code, destinationAirport.code],
  );
  const sessionLabel = useMemo(
    () => buildSessionLabel(destinationAirport),
    [destinationAirport],
  );

  const completedCount = useMemo(
    () => steps.filter((step) => step.status === "done").length,
    [steps],
  );

  const routeConfirmed = Boolean(confirmedRoute);
  const routeHasPendingChanges =
    !confirmedRoute ||
    confirmedRoute.originCode !== draftOriginAirport.code ||
    confirmedRoute.destinationCode !== draftDestinationAirport.code;

  const quickActions = useMemo(
    () => [
      {
        label: `制定 5 日${destinationAirport.cityZh}旅游攻略`,
        icon: CalendarDays,
        message: `我刚在${originAirport.airportNameZh}登机口扫码，目的地是${destinationAirport.airportNameZh}。请为我制定 5 日${destinationAirport.cityZh}旅游攻略，并优先查询${destinationAirport.cityZh}酒店、机场接送和景点候选。`,
      },
      {
        label: "预算低一点",
        icon: Sparkles,
        message: "预算低一点，住得方便就行，不要太赶。请在保留已确认约束的基础上优化方案。",
      },
      {
        label: "住宿更方便",
        icon: MapPin,
        message: `我想住在${destinationAirport.cityZh}交通更方便、适合首次到访的区域，帮我改一版，并重新说明酒店和交通预算。`,
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
    ],
    [destinationAirport, originAirport],
  );

  const createDemoSession = useCallback(async () => {
    const result = await client.createSession(AGENT_ID, buildSeedMessage(originAirport, destinationAirport), {
      label: sessionLabel,
    });
    if (!result?.key) {
      throw new Error("Gateway did not return a session key");
    }
    window.localStorage.setItem(sessionStorageKey, result.key);
    setSessionKey(result.key);
  }, [client, destinationAirport, originAirport, sessionLabel, sessionStorageKey]);

  useEffect(() => {
    if (!confirmedRoute) {
      return;
    }
    if (state !== "connected") return;
    let cancelled = false;
    (async () => {
      setSessionKey(null);
      setSteps(baseSteps);
      setOrder(null);
      setHotelCandidates([]);
      setSelectedHotel(null);
      setLastTool(null);
      setInitializing(true);
      setInitError(null);
      try {
        const stored = window.localStorage.getItem(sessionStorageKey);
        if (stored) {
          try {
            await client.getSession(stored);
            if (!cancelled) setSessionKey(stored);
            return;
          } catch {
            window.localStorage.removeItem(sessionStorageKey);
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
  }, [client, confirmedRoute, createDemoSession, sessionStorageKey, state]);

  const resetDemo = useCallback(async () => {
    if (!confirmedRoute) return;
    window.localStorage.removeItem(sessionStorageKey);
    setSessionKey(null);
    setSteps(baseSteps);
    setOrder(null);
    setHotelCandidates([]);
    setSelectedHotel(null);
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
  }, [confirmedRoute, createDemoSession, sessionStorageKey]);

  const updateOriginAirport = useCallback((code: string) => {
    setDraftOriginAirportCode(code);
    setDraftDestinationAirportCode((current) => (current === code ? firstDifferentAirport(code).code : current));
  }, []);

  const updateDestinationAirport = useCallback(
    (code: string) => {
      if (code === draftOriginAirportCode) return;
      setDraftDestinationAirportCode(code);
    },
    [draftOriginAirportCode],
  );

  const confirmAirports = useCallback(() => {
    setConfirmedRoute({
      originCode: draftOriginAirport.code,
      destinationCode: draftDestinationAirport.code,
    });
  }, [draftDestinationAirport.code, draftOriginAirport.code]);

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
      if (event.toolName.includes("dida_demo_search_hotels")) {
        const hotels = extractHotelCandidates(event.result);
        if (hotels.length > 0) {
          setHotelCandidates(hotels);
        }
      }
      if (event.toolName.includes("dida_demo_get_hotel_details")) {
        const detail = extractHotelDetail(event.result);
        if (detail) {
          setSelectedHotel(detail);
        }
      }
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

  const handleHotelClick = useCallback(
    async (hotel: HotelCandidate) => {
      if (state !== "connected" || !chatRef.current) return;
      setSelectedHotel(hotel);
      await chatRef.current.sendMessage(
        `我想查看酒店「${hotel.hotelNameZh}」的详情。请调用 Dida Content API 模拟详情工具 dida-travel-demo__dida_demo_get_hotel_details，hotelIds 只传 ["${hotel.hotelId}"]，然后用简体中文说明酒店介绍、地址、设施、周边、房型和取消政策。`,
      );
    },
    [state],
  );

  const ready = state === "connected" && !!sessionKey && !initializing && routeConfirmed && !routeHasPendingChanges;

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
              {"登机口扫码上下文 -> AI 出行客服 -> Dida Demo 酒店预订链路"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={ready ? "default" : "outline"}>
            {ready
              ? "Demo 会话已就绪"
              : routeHasPendingChanges
                ? "等待确认机场"
                : "正在连接"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void resetDemo()}
            disabled={!routeConfirmed || state !== "connected" || initializing}
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
                <h2 className="text-sm font-medium">登机口扫码模拟</h2>
                <Badge variant="outline" className="font-mono">
                  {scanContext.chargingStation}
                </Badge>
              </div>
              <div className="mb-4 grid gap-3">
                <AirportSelect
                  label="当前位置机场"
                  value={draftOriginAirport.code}
                  onChange={updateOriginAirport}
                />
                <AirportSelect
                  label="目的地机场"
                  value={draftDestinationAirport.code}
                  onChange={updateDestinationAirport}
                  disabledCode={draftOriginAirport.code}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={confirmAirports}
                  disabled={!routeHasPendingChanges}
                  className="w-full"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  确认
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  {routeHasPendingChanges
                    ? "确认后才会把这组登机口扫码上下文发送给 Agent。"
                    : "机场已确认，当前会话使用这组扫码上下文。"}
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <ContextRow
                  icon={BatteryCharging}
                  label="触发事件"
                  value="登机口扫码入口"
                />
                <ContextRow
                  icon={MapPin}
                  label="当前位置"
                  value={`${scanContext.userLocation}登机口`}
                />
                <ContextRow
                  icon={Plane}
                  label="目的地"
                  value={`${scanContext.destinationAirport} / ${scanContext.destinationCity}`}
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
                <h2 className="text-sm font-medium">酒店候选</h2>
                <Badge variant="outline">{hotelCandidates.length || "等待"}</Badge>
              </div>
              {hotelCandidates.length === 0 ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {`发送“制定 5 日${destinationAirport.cityZh}旅游攻略”后，Dida Demo 酒店候选会出现在这里。点击酒店可查询 Content API 模拟详情。`}
                </p>
              ) : (
                <div className="space-y-2">
                  {hotelCandidates.map((hotel) => (
                    <button
                      key={hotel.hotelId}
                      type="button"
                      disabled={!ready}
                      onClick={() => void handleHotelClick(hotel)}
                      className={cn(
                        "w-full rounded-md border border-border px-3 py-2 text-left transition-colors",
                        "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
                        selectedHotel?.hotelId === hotel.hotelId && "border-iai-internal bg-iai-internal-soft/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-5">
                          {hotel.hotelNameZh}
                        </span>
                        {hotel.pricePerRoomCny !== undefined && (
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            CNY {hotel.pricePerRoomCny}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {[hotel.districtZh, hotel.roomNameZh].filter(Boolean).join(" / ")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {selectedHotel && (
                <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {selectedHotel.hotelNameZh}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {selectedHotel.addressZh ?? selectedHotel.districtZh ?? "等待详情返回"}
                      </p>
                    </div>
                    {selectedHotel.starRating !== undefined && (
                      <Badge variant="outline">{selectedHotel.starRating} 星</Badge>
                    )}
                  </div>
                  {selectedHotel.descriptionZh && (
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                      {selectedHotel.descriptionZh}
                    </p>
                  )}
                  {selectedHotel.facilitiesZh && selectedHotel.facilitiesZh.length > 0 && (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      设施：{selectedHotel.facilitiesZh.slice(0, 4).join("、")}
                    </p>
                  )}
                  {selectedHotel.nearbyZh && selectedHotel.nearbyZh.length > 0 && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      周边：{selectedHotel.nearbyZh.slice(0, 3).join("、")}
                    </p>
                  )}
                </div>
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
          {!routeConfirmed ? (
            <AwaitingAirportConfirmation
              title="请选择并确认机场"
              detail="确认当前位置机场和目的地机场后，页面才会把扫码上下文发送给座联 AI 客服。"
            />
          ) : routeHasPendingChanges ? (
            <AwaitingAirportConfirmation
              title="机场选择尚未确认"
              detail="你已修改机场选择。点击左侧“确认机场并通知客服”后，客服会基于新的目的地生成问候和后续方案。"
            />
          ) : state !== "connected" ? (
            <AwaitingAirportConfirmation
              title="机场已确认，正在连接客服"
              detail="连接恢复后，页面会自动把这组登机口扫码上下文发送给座联 AI 客服。"
            />
          ) : initializing || !sessionKey ? (
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
              sessionLabel={sessionLabel}
              onSessionCreated={(key) => {
                window.localStorage.setItem(sessionStorageKey, key);
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

function AirportSelect({
  label,
  value,
  onChange,
  disabledCode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabledCode?: string;
}) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {airportOptions.map((airport) => (
          <option key={airport.code} value={airport.code} disabled={airport.code === disabledCode}>
            {airport.airportNameZh} ({airport.code})
          </option>
        ))}
      </select>
    </label>
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

function AwaitingAirportConfirmation({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 text-center">
      <div className="max-w-md rounded-lg border border-dashed border-border bg-card px-4 py-8">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-iai-internal-soft text-iai-internal">
          <Plane className="h-5 w-5" />
        </div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mx-auto mt-2 text-sm leading-6 text-muted-foreground">
          {detail}
        </p>
      </div>
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
        页面已注入登机口扫码上下文。客服回复由
        zuolian-travel-concierge 生成，不在前端硬编码。
      </p>
    </div>
  );
}
