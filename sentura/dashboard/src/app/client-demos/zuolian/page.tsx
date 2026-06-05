"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  BatteryCharging,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Clock3,
  Hotel,
  ImageIcon,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plane,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
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
  hotelName?: string;
  cityZh?: string;
  districtZh?: string;
  addressZh?: string;
  address?: string;
  starRating?: number;
  descriptionZh?: string;
  facilitiesZh?: string[];
  nearbyZh?: string[];
  sellingPointsZh?: string[];
  checkInInstructionsZh?: string[];
  images?: HotelImage[];
  roomNameZh?: string;
  boardNameZh?: string;
  ratePlanId?: string;
  cancellationPolicyZh?: string;
  pricePerRoomCny?: number;
  estimatedTotalCny?: number;
  displaySummaryZh?: string;
  geo?: {
    latitude?: number;
    longitude?: number;
  };
  didaEndpoint?: string;
  source?: string;
  locale?: string;
}

interface HotelImage {
  caption?: string;
  url?: string;
  isDefault?: boolean;
}

type HotelDetailSnapshot = HotelCandidate;

const demoHotelCatalog: HotelCandidate[] = [
  {"hotelId":"DIDA-SZX-10001","hotelNameZh":"深圳湾安达仕酒店","districtZh":"南山","addressZh":"深圳市南山区科苑南路 2600 号","starRating":5,"roomNameZh":"湾景大床房","pricePerRoomCny":980},
  {"hotelId":"DIDA-SZX-10002","hotelNameZh":"深圳四季酒店","districtZh":"福田","addressZh":"深圳市福田区福华三路 138 号","starRating":5,"roomNameZh":"豪华城景双床房","pricePerRoomCny":690},
  {"hotelId":"DIDA-SZX-10003","hotelNameZh":"深圳大梅沙京基洲际度假酒店","districtZh":"盐田","addressZh":"深圳市盐田区大梅沙盐梅路 9 号","starRating":5,"roomNameZh":"海景度假大床房","pricePerRoomCny":1280},
  {"hotelId":"DIDA-SZX-10004","hotelNameZh":"深圳东海朗廷酒店","districtZh":"福田","addressZh":"深圳市福田区深南大道 7888 号","starRating":5,"roomNameZh":"豪华城景大床房","pricePerRoomCny":920},
  {"hotelId":"DIDA-SZX-10005","hotelNameZh":"深圳中洲万豪酒店","districtZh":"南山","addressZh":"深圳市南山区海德一道 88 号中洲控股中心 A 座","starRating":5,"roomNameZh":"行政城景大床房","pricePerRoomCny":1080},
  {"hotelId":"DIDA-CAN-10001","hotelNameZh":"广州白天鹅宾馆","districtZh":"荔湾","addressZh":"广州市荔湾区沙面南街 1 号","starRating":5,"roomNameZh":"江景大床房","pricePerRoomCny":1180},
  {"hotelId":"DIDA-CAN-10002","hotelNameZh":"广州四季酒店","districtZh":"天河","addressZh":"广州市天河区珠江西路 5 号广州国际金融中心","starRating":5,"roomNameZh":"天际景观大床房","pricePerRoomCny":1380},
  {"hotelId":"DIDA-CAN-10003","hotelNameZh":"广州富力丽思卡尔顿酒店","districtZh":"天河","addressZh":"广州市天河区兴安路 3 号","starRating":5,"roomNameZh":"行政大床房","pricePerRoomCny":1280},
  {"hotelId":"DIDA-CAN-10004","hotelNameZh":"广州文华东方酒店","districtZh":"天河","addressZh":"广州市天河区天河路 389 号太古汇","starRating":5,"roomNameZh":"豪华大床房","pricePerRoomCny":1520},
  {"hotelId":"DIDA-CAN-10005","hotelNameZh":"广州南丰朗豪酒店","districtZh":"海珠","addressZh":"广州市海珠区新港东路 638 号","starRating":5,"roomNameZh":"江景双床房","pricePerRoomCny":760},
  {"hotelId":"DIDA-BJS-10001","hotelNameZh":"北京王府半岛酒店","districtZh":"东城","addressZh":"北京市东城区金鱼胡同 8 号","starRating":5,"roomNameZh":"豪华套房大床","pricePerRoomCny":1880},
  {"hotelId":"DIDA-BJS-10002","hotelNameZh":"北京华尔道夫酒店","districtZh":"东城","addressZh":"北京市东城区金鱼胡同 5-15 号","starRating":5,"roomNameZh":"豪华大床房","pricePerRoomCny":1680},
  {"hotelId":"DIDA-BJS-10003","hotelNameZh":"北京颐和安缦","districtZh":"海淀","addressZh":"北京市海淀区宫门前街 1 号","starRating":5,"roomNameZh":"庭院大床房","pricePerRoomCny":3200},
  {"hotelId":"DIDA-BJS-10004","hotelNameZh":"北京瑰丽酒店","districtZh":"朝阳","addressZh":"北京市朝阳区呼家楼京广中心","starRating":5,"roomNameZh":"豪华大床房","pricePerRoomCny":1480},
  {"hotelId":"DIDA-BJS-10005","hotelNameZh":"北京诺金酒店","districtZh":"朝阳","addressZh":"北京市朝阳区将台路甲 2 号","starRating":5,"roomNameZh":"豪华艺术大床房","pricePerRoomCny":980},
  {"hotelId":"DIDA-SHA-10001","hotelNameZh":"上海和平饭店","districtZh":"黄浦","addressZh":"上海市黄浦区南京东路 20 号","starRating":5,"roomNameZh":"经典大床房","pricePerRoomCny":1780},
  {"hotelId":"DIDA-SHA-10002","hotelNameZh":"上海半岛酒店","districtZh":"黄浦","addressZh":"上海市黄浦区中山东一路 32 号","starRating":5,"roomNameZh":"江景大床房","pricePerRoomCny":2280},
  {"hotelId":"DIDA-SHA-10003","hotelNameZh":"上海浦东文华东方酒店","districtZh":"浦东","addressZh":"上海市浦东新区浦东南路 111 号","starRating":5,"roomNameZh":"浦江景观大床房","pricePerRoomCny":1680},
  {"hotelId":"DIDA-SHA-10004","hotelNameZh":"上海浦东丽思卡尔顿酒店","districtZh":"浦东","addressZh":"上海市浦东新区世纪大道 8 号上海国金中心","starRating":5,"roomNameZh":"天际景观大床房","pricePerRoomCny":1980},
  {"hotelId":"DIDA-SHA-10005","hotelNameZh":"上海建业里嘉佩乐酒店","districtZh":"徐汇","addressZh":"上海市徐汇区建国西路 480 号","starRating":5,"roomNameZh":"石库门别墅房","pricePerRoomCny":2880},
  {"hotelId":"DIDA-HGH-10001","hotelNameZh":"杭州西子湖四季酒店","districtZh":"西湖","addressZh":"杭州市西湖区灵隐路 5 号","starRating":5,"roomNameZh":"园景大床房","pricePerRoomCny":2580},
  {"hotelId":"DIDA-HGH-10002","hotelNameZh":"杭州法云安缦","districtZh":"西湖","addressZh":"杭州市西湖区法云弄 22 号","starRating":5,"roomNameZh":"村落大床房","pricePerRoomCny":3600},
  {"hotelId":"DIDA-HGH-10003","hotelNameZh":"杭州君悦酒店","districtZh":"上城","addressZh":"杭州市上城区湖滨路 28 号","starRating":5,"roomNameZh":"湖景大床房","pricePerRoomCny":1280},
  {"hotelId":"DIDA-HGH-10004","hotelNameZh":"杭州城中香格里拉","districtZh":"拱墅","addressZh":"杭州市拱墅区长寿路 6 号","starRating":5,"roomNameZh":"豪华城景双床房","pricePerRoomCny":980},
  {"hotelId":"DIDA-HGH-10005","hotelNameZh":"杭州康莱德酒店","districtZh":"上城","addressZh":"杭州市上城区新业路 228 号来福士中心","starRating":5,"roomNameZh":"钱江景观大床房","pricePerRoomCny":1180},
  {"hotelId":"DIDA-HKG-10001","hotelNameZh":"香港半岛酒店","districtZh":"尖沙咀","addressZh":"香港九龙尖沙咀梳士巴利道","starRating":5,"roomNameZh":"海港景观大床房","pricePerRoomCny":3980},
  {"hotelId":"DIDA-HKG-10002","hotelNameZh":"香港文华东方酒店","districtZh":"中环","addressZh":"香港中环干诺道中 5 号","starRating":5,"roomNameZh":"城景大床房","pricePerRoomCny":3280},
  {"hotelId":"DIDA-HKG-10003","hotelNameZh":"香港四季酒店","districtZh":"中环","addressZh":"香港中环金融街 8 号","starRating":5,"roomNameZh":"海港双床房","pricePerRoomCny":3600},
  {"hotelId":"DIDA-HKG-10004","hotelNameZh":"香港瑰丽酒店","districtZh":"尖沙咀","addressZh":"香港九龙尖沙咀梳士巴利道 18 号 Victoria Dockside","starRating":5,"roomNameZh":"九龙海港大床房","pricePerRoomCny":4200},
  {"hotelId":"DIDA-HKG-10005","hotelNameZh":"奕居","districtZh":"金钟","addressZh":"香港金钟道 88 号太古广场","starRating":5,"roomNameZh":"单间大床房","pricePerRoomCny":3100},
  {"hotelId":"DIDA-MFM-10001","hotelNameZh":"澳门威尼斯人","districtZh":"路氹","addressZh":"澳门路氹金光大道","starRating":5,"roomNameZh":"贝丽套房","pricePerRoomCny":1280},
  {"hotelId":"DIDA-MFM-10002","hotelNameZh":"澳门上葡京综合度假村","districtZh":"路氹","addressZh":"澳门路氹射击路","starRating":5,"roomNameZh":"皇宫大床房","pricePerRoomCny":1180},
  {"hotelId":"DIDA-MFM-10003","hotelNameZh":"澳门文华东方酒店","districtZh":"澳门半岛","addressZh":"澳门外港新填海区孙逸仙大马路","starRating":5,"roomNameZh":"湾景大床房","pricePerRoomCny":1880},
  {"hotelId":"DIDA-MFM-10004","hotelNameZh":"永利皇宫","districtZh":"路氹","addressZh":"澳门路氹体育馆大马路","starRating":5,"roomNameZh":"喷泉景观大床房","pricePerRoomCny":1680},
  {"hotelId":"DIDA-MFM-10005","hotelNameZh":"澳门银河酒店","districtZh":"路氹","addressZh":"澳门路氹城澳门银河综合度假城","starRating":5,"roomNameZh":"度假双床房","pricePerRoomCny":1380},
];

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
  {
    id: "preCancel",
    label: "预取消",
    detail: "BookingCancel PreCancel",
    icon: CircleAlert,
    status: "idle",
    toolNames: ["dida_demo_pre_cancel_booking"],
  },
  {
    id: "cancel",
    label: "确认取消",
    detail: "BookingCancelConfirm",
    icon: ShieldCheck,
    status: "idle",
    toolNames: ["dida_demo_cancel_booking"],
  },
  {
    id: "modify",
    label: "修改订单",
    detail: "Cancel + Rebook",
    icon: RefreshCw,
    status: "idle",
    toolNames: ["dida_demo_modify_booking"],
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
  const rooms = Array.isArray(item.rooms) ? item.rooms : [];
  const firstRoom =
    rooms[0] && typeof rooms[0] === "object"
      ? (rooms[0] as Record<string, unknown>)
      : null;
  const geo =
    item.geo && typeof item.geo === "object"
      ? (item.geo as Record<string, unknown>)
      : null;
  return {
    hotelId: item.hotelId,
    hotelName: typeof item.hotelName === "string" ? item.hotelName : undefined,
    hotelNameZh: item.hotelNameZh,
    cityZh: typeof item.cityZh === "string" ? item.cityZh : undefined,
    districtZh: typeof item.districtZh === "string" ? item.districtZh : undefined,
    address: typeof item.address === "string" ? item.address : undefined,
    addressZh: typeof item.addressZh === "string" ? item.addressZh : undefined,
    starRating: typeof item.starRating === "number" ? item.starRating : undefined,
    descriptionZh:
      typeof item.descriptionZh === "string" ? item.descriptionZh : undefined,
    facilitiesZh: Array.isArray(item.facilitiesZh)
      ? item.facilitiesZh.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    nearbyZh: Array.isArray(item.nearbyZh)
      ? item.nearbyZh.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    sellingPointsZh: Array.isArray(item.sellingPointsZh)
      ? item.sellingPointsZh.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    checkInInstructionsZh: Array.isArray(item.checkInInstructionsZh)
      ? item.checkInInstructionsZh.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    images: Array.isArray(item.images)
      ? item.images
          .map(toHotelImage)
          .filter((image): image is HotelImage => !!image)
      : undefined,
    roomNameZh:
      typeof item.roomNameZh === "string"
        ? item.roomNameZh
        : typeof firstRoom?.roomNameZh === "string"
          ? firstRoom.roomNameZh
          : undefined,
    boardNameZh:
      typeof item.boardNameZh === "string"
        ? item.boardNameZh
        : typeof firstRoom?.boardNameZh === "string"
          ? firstRoom.boardNameZh
          : undefined,
    ratePlanId:
      typeof item.ratePlanId === "string"
        ? item.ratePlanId
        : typeof firstRoom?.ratePlanId === "string"
          ? firstRoom.ratePlanId
          : undefined,
    cancellationPolicyZh:
      typeof item.cancellationPolicyZh === "string"
        ? item.cancellationPolicyZh
        : typeof firstRoom?.cancellationPolicyZh === "string"
          ? firstRoom.cancellationPolicyZh
          : undefined,
    pricePerRoomCny:
      typeof item.pricePerRoomCny === "number"
        ? item.pricePerRoomCny
        : typeof firstRoom?.pricePerRoomCny === "number"
          ? firstRoom.pricePerRoomCny
          : undefined,
    estimatedTotalCny:
      typeof item.estimatedTotalCny === "number" ? item.estimatedTotalCny : undefined,
    displaySummaryZh:
      typeof item.displaySummaryZh === "string" ? item.displaySummaryZh : undefined,
    geo: geo
      ? {
          latitude: typeof geo.latitude === "number" ? geo.latitude : undefined,
          longitude: typeof geo.longitude === "number" ? geo.longitude : undefined,
        }
      : undefined,
    didaEndpoint: typeof item.didaEndpoint === "string" ? item.didaEndpoint : undefined,
    source: typeof item.source === "string" ? item.source : undefined,
    locale: typeof item.locale === "string" ? item.locale : undefined,
  };
}

function toHotelImage(value: unknown): HotelImage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return {
    caption: typeof item.caption === "string" ? item.caption : undefined,
    url: typeof item.url === "string" ? item.url : undefined,
    isDefault: typeof item.isDefault === "boolean" ? item.isDefault : undefined,
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
  return {
    ...candidate,
    didaEndpoint: typeof parsed?.didaEndpoint === "string" ? parsed.didaEndpoint : candidate.didaEndpoint,
    source: typeof parsed?.source === "string" ? parsed.source : candidate.source,
    locale: typeof parsed?.locale === "string" ? parsed.locale : candidate.locale,
  };
}

function extractOrderSnapshot(value: unknown): OrderSnapshot | null {
  const parsed = parseToolJson(value);
  const preferred =
    parsed?.newBooking && typeof parsed.newBooking === "object"
      ? (parsed.newBooking as Record<string, unknown>)
      : parsed;
  if (preferred) {
    const bookingId = typeof preferred.bookingId === "string" ? preferred.bookingId : undefined;
    const referenceNo = typeof preferred.referenceNo === "string" ? preferred.referenceNo : undefined;
    const status = typeof preferred.status === "number" ? preferred.status : undefined;
    const statusName = typeof preferred.statusName === "string" ? preferred.statusName : undefined;
    if (bookingId || referenceNo || status !== undefined || statusName) {
      return {
        bookingId,
        referenceNo,
        status,
        statusName,
        updatedAt: Date.now(),
      };
    }
  }
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
  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);
  const [hotelDetailLoading, setHotelDetailLoading] = useState(false);
  const [hotelDetailError, setHotelDetailError] = useState<string | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);
  const [draftOriginAirportCode, setDraftOriginAirportCode] = useState("CAN");
  const [draftDestinationAirportCode, setDraftDestinationAirportCode] = useState("SZX");
  const [confirmedRoute, setConfirmedRoute] = useState<{ originCode: string; destinationCode: string } | null>(null);
  const [pendingSeed, setPendingSeed] = useState<{ sessionKey: string; message: string } | null>(null);

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
  const hotelInteractiveTerms = useMemo(
    () => {
      const hotelsById = new Map<string, HotelCandidate>();
      for (const hotel of demoHotelCatalog) {
        hotelsById.set(hotel.hotelId, hotel);
      }
      for (const hotel of hotelCandidates) {
        hotelsById.set(hotel.hotelId, hotel);
      }
      return Array.from(hotelsById.values()).map((hotel) => ({
        id: hotel.hotelId,
        label: hotel.hotelNameZh,
      }));
    },
    [hotelCandidates],
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
      {
        label: "取消订单",
        icon: CircleAlert,
        message:
          "我不去了，请取消刚才的模拟酒店订单。请按 Dida Booking Cancel 流程先 pre-cancel 获取 ConfirmID，再 cancelconfirm 确认取消，最后查询订单状态。",
      },
      {
        label: "修改订单",
        icon: RefreshCw,
        message: `我想修改刚才的模拟酒店订单，改成${destinationAirport.cityZh}更方便的酒店。请在后台按 Dida 文档先取消旧订单，再重新执行 PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm，并查询新订单状态。`,
      },
    ],
    [destinationAirport, originAirport],
  );

  const createDemoSession = useCallback(async () => {
    const seedMessage = buildSeedMessage(originAirport, destinationAirport);
    const result = await client.createSession(AGENT_ID, undefined, {
      label: sessionLabel,
    });
    if (!result?.key) {
      throw new Error("Gateway did not return a session key");
    }
    window.localStorage.setItem(sessionStorageKey, result.key);
    setSessionKey(result.key);
    setPendingSeed({ sessionKey: result.key, message: seedMessage });
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
      setHotelDialogOpen(false);
      setHotelDetailLoading(false);
      setHotelDetailError(null);
      setLastTool(null);
      setInitializing(true);
      setInitError(null);
      try {
        const stored = window.localStorage.getItem(sessionStorageKey);
        if (stored) {
          try {
            await client.getSession(stored);
            const transcript = await client.getTranscript(stored, 1);
            if (transcript.length === 0 && !cancelled) {
              setPendingSeed({
                sessionKey: stored,
                message: buildSeedMessage(originAirport, destinationAirport),
              });
            }
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
  }, [client, confirmedRoute, createDemoSession, destinationAirport, originAirport, sessionStorageKey, state]);

  useEffect(() => {
    if (!pendingSeed || pendingSeed.sessionKey !== sessionKey || state !== "connected" || !chatRef.current) {
      return;
    }
    let cancelled = false;
    const seed = pendingSeed;
    setPendingSeed(null);
    (async () => {
      try {
        await chatRef.current?.sendMessage(seed.message);
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Could not send scan context seed";
        if (!cancelled) setInitError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingSeed, sessionKey, state]);

  const resetDemo = useCallback(async () => {
    if (!confirmedRoute) return;
    window.localStorage.removeItem(sessionStorageKey);
    setSessionKey(null);
    setSteps(baseSteps);
    setOrder(null);
    setHotelCandidates([]);
    setSelectedHotel(null);
    setHotelDialogOpen(false);
    setHotelDetailLoading(false);
    setHotelDetailError(null);
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

  const ready = state === "connected" && !!sessionKey && !initializing && routeConfirmed && !routeHasPendingChanges;

  const loadHotelDetail = useCallback(async (hotel: HotelCandidate) => {
    setSelectedHotel(hotel);
    setHotelDialogOpen(true);
    setHotelDetailLoading(true);
    setHotelDetailError(null);
    try {
      const response = await fetch("/api/client-demos/zuolian/hotel-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: hotel.hotelId }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "无法读取酒店详情";
        throw new Error(message);
      }
      const detail = extractHotelDetail(payload);
      if (!detail) {
        throw new Error("MCP 详情返回中没有酒店内容");
      }
      setSelectedHotel(detail);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "无法读取酒店详情";
      setHotelDetailError(message);
    } finally {
      setHotelDetailLoading(false);
    }
  }, []);

  const handleHotelClick = useCallback(
    (hotel: HotelCandidate) => {
      if (!ready) return;
      void loadHotelDetail(hotel);
    },
    [loadHotelDetail, ready],
  );

  const openHotelFromChat = useCallback(
    (hotelId: string) => {
      const hotel =
        hotelCandidates.find((candidate) => candidate.hotelId === hotelId) ??
        demoHotelCatalog.find((candidate) => candidate.hotelId === hotelId);
      if (!hotel) return;
      void loadHotelDetail(hotel);
    },
    [hotelCandidates, loadHotelDetail],
  );

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
                  确认机场并通知客服
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
                  {`发送“制定 5 日${destinationAirport.cityZh}旅游攻略”后，Dida Demo 酒店候选会出现在这里。点击酒店会打开本地详情弹窗。`}
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

        <main className="flex min-h-0 items-center justify-center bg-[#dfe1e7]">
          <IphoneWeComShell
            quickActions={quickActions}
            ready={ready}
            sendQuickAction={sendQuickAction}
            selectedHotel={selectedHotel}
            hotelDialogOpen={hotelDialogOpen}
            hotelDetailLoading={hotelDetailLoading}
            hotelDetailError={hotelDetailError}
            setHotelDialogOpen={setHotelDialogOpen}
          >
            {!routeConfirmed ? (
              <WeComBlankConversation />
            ) : routeHasPendingChanges ? (
              <WeComBlankConversation />
            ) : state !== "connected" ? (
              <WeComBlankConversation />
            ) : initializing || !sessionKey ? (
              <WeComBlankConversation />
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
                presentation="wecom-phone"
                interactiveTerms={hotelInteractiveTerms}
                onInteractiveTermClick={openHotelFromChat}
              />
            )}
          </IphoneWeComShell>
        </main>
      </div>
    </div>
  );
}

function IphoneWeComShell({
  children,
  quickActions,
  ready,
  sendQuickAction,
  selectedHotel,
  hotelDialogOpen,
  hotelDetailLoading,
  hotelDetailError,
  setHotelDialogOpen,
}: {
  children: ReactNode;
  quickActions: Array<{
    label: string;
    icon: ComponentType<{ className?: string }>;
    message: string;
  }>;
  ready: boolean;
  sendQuickAction: (message: string) => Promise<void>;
  selectedHotel: HotelDetailSnapshot | null;
  hotelDialogOpen: boolean;
  hotelDetailLoading: boolean;
  hotelDetailError: string | null;
  setHotelDialogOpen: (open: boolean) => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center px-8 py-6">
      <div className="relative flex h-[604px] max-h-[calc(100vh-8rem)] w-[280px] flex-col overflow-hidden rounded-[23px] bg-[#e9ebf1] shadow-2xl shadow-slate-900/20">
        <div className="shrink-0 bg-[#3977cc] text-white">
          <div className="flex h-8 items-center justify-between px-4 text-[12px] font-semibold">
            <span>15:38</span>
            <div className="flex items-center gap-1">
              <span className="inline-flex h-3 items-end gap-[1px]" aria-hidden="true">
                <span className="h-1.5 w-0.5 rounded-full bg-white/80" />
                <span className="h-2 w-0.5 rounded-full bg-white/80" />
                <span className="h-2.5 w-0.5 rounded-full bg-white/80" />
                <span className="h-3 w-0.5 rounded-full bg-white" />
              </span>
              <span className="text-[10px] font-medium">5G</span>
              <span className="h-3.5 w-6 rounded-[3px] border border-white/70 p-[2px]">
                <span className="block h-full w-4 rounded-[2px] bg-[#ffd84d]" />
              </span>
            </div>
          </div>
          <div className="flex h-10 items-center justify-between px-2.5">
            <ChevronLeft className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 px-2 text-center">
              <div className="truncate text-[13px] font-semibold leading-5">
                23(创建人)
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Video className="h-4 w-4" />
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#2d66b5] text-white"
                aria-label="更多"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="hidden" aria-hidden="true">
            <span>{ready ? "客服在线" : "等待接入"}</span>
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={!ready}
                onClick={() => void sendQuickAction(action.message)}
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
        <HotelDetailDialog
          hotel={selectedHotel}
          open={hotelDialogOpen}
          loading={hotelDetailLoading}
          error={hotelDetailError}
          onOpenChange={setHotelDialogOpen}
        />
      </div>
    </div>
  );
}

function HotelDetailDialog({
  hotel,
  open,
  loading,
  error,
  onOpenChange,
}: {
  hotel: HotelDetailSnapshot | null;
  open: boolean;
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const images =
    hotel?.images && hotel.images.length > 0
      ? hotel.images
      : [
          { caption: "酒店外观空白模拟图", url: "", isDefault: true },
          { caption: "客房空白模拟图", url: "", isDefault: false },
        ];

  if (!open || !hotel) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 px-3 py-10"
      data-testid="phone-hotel-detail-overlay"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${hotel.hotelNameZh}酒店详情`}
        className="max-h-[calc(100%-16px)] w-full overflow-hidden rounded-[10px] bg-white text-[#111] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#e8e8e8] px-3 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold leading-5">{hotel.hotelNameZh}</h2>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#777]">
              {[hotel.districtZh, hotel.addressZh].filter(Boolean).join(" · ") ||
                "Dida Content API 模拟酒店详情"}
            </p>
          </div>
          <button
            type="button"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f2f2f2] text-[18px] leading-none text-[#555]"
            aria-label="关闭酒店详情"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </div>

        <div className="max-h-[430px] overflow-y-auto px-3 py-3">
          {loading && (
            <div className="mb-3 flex items-center gap-2 rounded-[6px] bg-[#eef4ff] px-2.5 py-2 text-[11px] leading-4 text-[#1f5fbf]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在读取 Dida MCP 酒店详情...
            </div>
          )}
          {error && (
            <div className="mb-3 rounded-[6px] bg-[#fff1f0] px-2.5 py-2 text-[11px] leading-4 text-[#b42318]">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {images.slice(0, 2).map((image, index) => (
              <div
                key={`${hotel.hotelId}-${index}`}
                className="flex aspect-[4/3] flex-col items-center justify-center rounded-[6px] border border-dashed border-[#d5d8df] bg-[#f3f4f7] px-2 text-center"
              >
                <ImageIcon className="mb-1.5 h-5 w-5 text-[#9aa0a8]" />
                <span className="text-[10px] font-medium leading-4 text-[#777]">
                  {image.caption ?? (index === 0 ? "酒店外观空白模拟图" : "客房空白模拟图")}
                </span>
                {image.isDefault && (
                  <Badge className="mt-1.5 h-4 px-1.5 text-[10px]" variant="outline">
                    默认图
                  </Badge>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {hotel.starRating !== undefined && (
              <Badge variant="outline">{hotel.starRating} 星</Badge>
            )}
            {hotel.roomNameZh && <Badge variant="outline">{hotel.roomNameZh}</Badge>}
            {hotel.boardNameZh && <Badge variant="outline">{hotel.boardNameZh}</Badge>}
            {hotel.pricePerRoomCny !== undefined && (
              <Badge variant="outline">CNY {hotel.pricePerRoomCny}/晚</Badge>
            )}
          </div>
          {hotel.descriptionZh && (
            <DetailSection title="酒店介绍">
              <p className="text-[12px] leading-5 text-[#333]">{hotel.descriptionZh}</p>
            </DetailSection>
          )}
          <DetailSection title="地址">
            <div className="space-y-1 text-[12px] leading-5 text-[#333]">
              {hotel.addressZh && <p>{hotel.addressZh}</p>}
              {hotel.address && hotel.address !== hotel.addressZh && (
                <p className="text-[#777]">{hotel.address}</p>
              )}
            </div>
          </DetailSection>
          {hotel.sellingPointsZh && hotel.sellingPointsZh.length > 0 && (
            <DetailSection title="推荐理由">
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hotel.sellingPointsZh.map((point) => (
                  <Badge key={point} variant="secondary">
                    {point}
                  </Badge>
                ))}
              </div>
            </DetailSection>
          )}
          {hotel.facilitiesZh && hotel.facilitiesZh.length > 0 && (
            <DetailSection title="设施">
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hotel.facilitiesZh.map((facility) => (
                  <Badge key={facility} variant="secondary">
                    {facility}
                  </Badge>
                ))}
              </div>
            </DetailSection>
          )}
          {hotel.nearbyZh && hotel.nearbyZh.length > 0 && (
            <DetailSection title="周边">
              <p className="mt-1 text-[12px] leading-5 text-[#666]">
                {hotel.nearbyZh.join("、")}
              </p>
            </DetailSection>
          )}
          {(hotel.ratePlanId || hotel.cancellationPolicyZh) && (
            <DetailSection title="房型与政策">
              <div className="space-y-1 text-[12px] leading-5 text-[#333]">
                {hotel.cancellationPolicyZh && <p>{hotel.cancellationPolicyZh}</p>}
              </div>
            </DetailSection>
          )}
          {hotel.checkInInstructionsZh && hotel.checkInInstructionsZh.length > 0 && (
            <DetailSection title="入住说明">
              <ul className="space-y-1 text-[12px] leading-5 text-[#333]">
                {hotel.checkInInstructionsZh.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ul>
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] font-medium text-[#777]">{title}</p>
      <div className="mt-1">{children}</div>
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

function WeComBlankConversation() {
  return (
    <div
      className="flex flex-1 bg-[#e9ebf1]"
      aria-label="企业微信空白聊天页，等待机场确认后由客服发送第一条消息"
    />
  );
}

function DemoEmptyState() {
  return null;
}
